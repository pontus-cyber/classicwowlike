// Legacy phase 1, UI (D154-D157; docs/specs/legacy.md 1.1-1.8, 4.1, 4.6; engine-api.md 15; docs/handoffs/ui-2026-11-18.md):
// the UI's pure parts in Node. With C.GATES.legacy off the display hooks are identities and the bridge's view has no hero;
// with it on (createBridge({ legacy: true }), the ?legacy=1 switch) the hero scale on every level, the hero's XP bar, the
// level-up banner's hero level, the checkpoint stored at every zone, the run summary's hero line and Legacy points, hero
// select's cards, and the migration of a version 1 profile with its refund note once. The browser checks are ui-regress
// part Y and full-run --legacy.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem0 = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem0.has(k) ? mem0.get(k) : null), setItem: (k, v) => { mem0.set(k, String(v)); }, removeItem: (k) => { mem0.delete(k); } };
// qa/ui/index.js runs every file in one process: the storage may be another file's, so this file uses the keys it names
const KEYS = ['tbwcr.profile.v1', 'tbwcr.profile.v3', 'tbwcr.history.v1', 'tbwcr.history.v3', 'tbwcr.legacy.refund.v1'];
const mem = {
  clear: () => { for (const k of KEYS) globalThis.localStorage.removeItem(k); },
  has: (k) => globalThis.localStorage.getItem(k) !== null,
  get: (k) => globalThis.localStorage.getItem(k),
  set: (k, v) => globalThis.localStorage.setItem(k, v),
};
const R = await import('../../src/rules.js');
const C = R.C;
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { lv, lvLearn, legacyShown, legacyWords, setDisplay } = await import('../../src/ui/util.js');
const { bandText, xpPayText } = await import('../../src/ui/ui-text.js');

const gateOff = () => { C.GATES.legacy = false; };

test('switch off: the bridge shows no hero, the display hooks are identities, the version 1 key is used', () => {
  mem.clear(); gateOff();
  const b = createBridge({ seed: 7 });
  assert.equal(b.view.meta.legacy, false);
  assert.equal(b.view.meta.heroes, null);
  assert.equal(legacyShown(), false);
  assert.equal(lv(40), 40); assert.equal(lvLearn(46), 46);
  assert.equal(legacyWords('Hall of Echoes: 12 Echoes'), 'Hall of Echoes: 12 Echoes');
  assert.equal(bandText([5, 9]), 'levels 5-9');
  assert.equal(xpPayText({ xpFrac: 2.84, xp: 280 }), '2.8 levels of XP');
  b.dispatch({ type: 'START_RUN' });
  assert.equal(b.view.player.heroLevel, null);
  assert.equal(b.view.player.xpToNext, R.xpToNext(b.view.player.level));
  for (let i = 0; i < 60 && b.view.phase !== 'MAP'; i++) b.dispatch({ type: 'AUTO' });
  assert.ok(!mem.has('tbwcr.profile.v3'), 'no version 3 profile is written with the switch off');
});

test('the hero scale: shownLevel inverts POWER_OF_LEVEL; a learn level shows the first hero level that reaches it (1.7)', () => {
  setDisplay({ level: (n) => R.shownLevel({ legacy: true }, n), learn: (M) => { for (let H = 1; H <= C.HERO_MAX_LEVEL; H++) if (R.powerOfLevel(H) >= M) return H; return C.HERO_MAX_LEVEL; }, words: true });
  try {
    for (let H = 1; H <= C.HERO_MAX_LEVEL; H++) assert.equal(lv(R.powerOfLevel(H)), H, `hero ${H}`);
    for (const sp of Object.values(C.SPELL)) {
      if (!sp.lvl) continue;
      const H = lvLearn(sp.lvl);
      assert.ok(R.powerOfLevel(H) >= sp.lvl && (H === 1 || R.powerOfLevel(H - 1) < sp.lvl), `${sp.id} (${sp.lvl}): hero ${H}`);
    }
    // 1.7's table: Shadowstep Strike at hero 3, Starlance Barrage and Heartseeker Shot at 20 (shownLevel would say 2 and 19)
    assert.equal(lvLearn(C.SPELL.shadowstep_strike.lvl), 3);
    assert.equal(lvLearn(C.SPELL.heartseeker_shot.lvl), 20);
    assert.equal(legacyWords('Spend Echoes in the Hall of Echoes'), 'Spend Legacy points in the Legacy hall');
    assert.equal(xpPayText({ xpFrac: 2.84, xp: 280 }), '280 XP');
    assert.equal(bandText([R.powerOfLevel(4), R.powerOfLevel(6)]), 'levels 4-6');
  } finally { setDisplay({}); }
});

test('switch on: hero select, the hero XP bar, banners on the hero scale, the zone checkpoint stored, the summary', () => {
  mem.clear();
  try {
    const b = createBridge({ seed: 3, legacy: true }) // seed 3: the autoplay run reaches the Camp at hero level 6;
    assert.equal(C.GATES.legacy, true);
    const m = b.view.meta;
    assert.equal(m.legacy, true);
    assert.deepEqual(m.heroes, [null, null, null], 'a new profile: three new heroes');
    assert.equal(legacyShown(), true);
    b.dispatch({ type: 'SET_GUIDE', on: false });
    b.dispatch({ type: 'START_RUN' });
    let p = b.view.player;
    assert.equal(p.heroLevel, 1);
    assert.equal(p.xpToNext, C.HERO_XP[0]);
    assert.equal(lv(p.level), p.heroLevel);
    const ups = []; let stored = 0;
    for (let i = 0; i < 3000 && b.view.phase !== 'SUMMARY'; i++) {
      const r = b.dispatch({ type: 'AUTO' }); if (!r.ok) break;
      for (const e of r.events) if (e.t === 'levelUp') ups.push(e);
      const raw = mem.get('tbwcr.profile.v3');
      if (raw) { const pr = JSON.parse(raw); if (pr.heroes && pr.heroes.rogue) stored = Math.max(stored, pr.heroes.rogue.level); }
      p = b.view.player;
      if (p) {
        assert.equal(lv(p.level), p.heroLevel, 'the HUD level is the hero level');
        if (i % 50 === 0) { const hv = R.heroView(R.deserialize(b.backend.serialized(), CONTENT)); assert.equal(p.xpToNext, hv.xpToNext); assert.equal(p.xp, hv.xp); }
      }
    }
    assert.ok(ups.length >= 3, `level-ups: ${ups.length}`);
    for (const e of ups) {
      assert.equal(e.heroLevel, lv(e.level), 'the banner level is the hero level');
      assert.equal(e.xpToNext, R.heroXpToNext(e.heroLevel));
    }
    assert.ok(stored >= 1, 'the checkpoint was stored under the version 3 key');
    assert.equal(b.view.phase, 'SUMMARY');
    const s = b.view.summary;
    assert.ok(s.hero, 'the summary has the hero line');
    assert.equal(s.hero.from, 1);
    assert.equal(s.hero.level, ups.length ? ups[ups.length - 1].heroLevel : 1);
    assert.ok(s.hero.xpGained > 0);
    const lvl = s.echoes.find((x) => x[2] === 'levels');
    if (s.hero.gained) { assert.ok(lvl && lvl[0].startsWith('Hero levels gained')); assert.equal(lvl[1], s.hero.gained * C.LEGACY_PER_LEVEL); }
    const after = b.view.meta.after;
    b.dispatch({ type: 'END_RUN' });
    const m2 = b.view.meta;
    assert.equal(m2.echoes, after.echoes, 'the balance is the Legacy points END_RUN stored');
    assert.equal(m2.heroes[0].level, s.hero.level, 'hero select: the Rogue keeps its level');
    assert.equal(m2.heroes[0].runs, 1);
    assert.equal(JSON.parse(mem.get('tbwcr.profile.v3')).v, 3);
    assert.ok(!mem.has('tbwcr.profile.v1'), 'the version 1 key is not written');
  } finally { gateOff(); setDisplay({}); }
});

test('switch on: a version 1 profile migrates under its own key; the refund note shows on one page only', () => {
  mem.clear();
  try {
    const v1 = { ...(gateOff(), R.newProfile()), echoes: 40, earned: 400, spent: 360, runs: 4, guide: 'done', welcome: true, unlocks: { satchel: 1, vigor: 2 } };
    mem.set('tbwcr.profile.v1', JSON.stringify(v1));
    const b = createBridge({ seed: 3, legacy: true });
    const m = b.view.meta;
    assert.equal(m.legacy, true);
    assert.equal(m.echoes, 40 + 360 - C.META.satchel.costs[0], 'Legacy points = Echoes + spent, Packed Satchel kept');
    assert.ok(m.refund && m.refund.back === 360 - C.META.satchel.costs[0], JSON.stringify(m.refund));
    assert.equal(mem.get('tbwcr.profile.v1'), JSON.stringify(v1), 'the version 1 profile is left as it was');
    assert.equal(JSON.parse(mem.get('tbwcr.profile.v3')).v, 3);
    b.dispatch({ type: 'START_RUN' });
    for (let i = 0; i < 5 && b.view.phase !== 'PREP'; i++) b.dispatch({ type: 'AUTO' });
    // a second page: the note was shown already
    const b2 = createBridge({ seed: 3, legacy: true });
    assert.equal(b2.view.meta.refund, null);
  } finally { gateOff(); setDisplay({}); }
});
