// Legacy Economy v2 in the UI (D159-D160; docs/specs/legacy.md 4.7 E5-E6, engine-api.md 15.5; docs/handoffs/
// engine-2026-11-19c.md section 4; docs/handoffs/ui-2026-11-19b.md): the ?legacy=1 set turns economyV2 on; the hall's
// cards read C.META_HERO and the level-20 wing's prices; the D160 refund note once for a version 3 profile; the one name
// "camp points" (econLine, the Set out log line); the second camp's flag; the run end's next hall entry; the level-up
// event's banner fields; hero select's "Level 4 → 7". With the switch off nothing of it shows. Browser check: ui-regress
// part Y6.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem0 = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem0.has(k) ? mem0.get(k) : null), setItem: (k, v) => { mem0.set(k, String(v)); }, removeItem: (k) => { mem0.delete(k); } };
const KEYS = ['tbwcr.profile.v1', 'tbwcr.profile.v3', 'tbwcr.history.v1', 'tbwcr.history.v3', 'tbwcr.legacy.refund.v1'];
const clearKeys = () => { for (const k of KEYS) globalThis.localStorage.removeItem(k); };
const get = (k) => globalThis.localStorage.getItem(k);
const set = (k, v) => globalThis.localStorage.setItem(k, v);
const R = await import('../../src/rules.js');
const C = R.C;
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { econShown, setDisplay } = await import('../../src/ui/util.js');
const { econLine, campPoints, metaEffect } = await import('../../src/ui/ui-text.js');

const gateOff = () => { C.GATES.legacy = false; C.GATES.oruvathLegacy = false; C.GATES.economyV2 = false; };
const done = () => { gateOff(); setDisplay({}); clearKeys(); };
const later = () => ({ ...R.newProfile(), runs: 2, welcome: true, guide: 'done' });
/** A version 3 profile that bought entries under the old catalogue (legacy on, economyV2 off). */
const oldBuyer = () => {
  C.GATES.legacy = true; C.GATES.economyV2 = false;
  let p = { ...R.newProfile(), legacy: 900, runs: 3, welcome: true, guide: 'done' };
  for (const id of ['satchel', 'vigor', 'vigor', 'keen']) p = R.buyMeta(p, id);
  gateOff();
  return p;
};

test('switch: the ?legacy=1 set turns economyV2 on; off, nothing of it shows', () => {
  clearKeys(); gateOff();
  try {
    const off = createBridge({ seed: 3 });
    assert.equal(C.GATES.economyV2, false);
    assert.equal(econShown(), false);
    assert.equal(off.data.meta.wing, null);
    assert.deepEqual(off.data.meta.entries.vigor.costs, C.META.vigor.costs);
    const b = createBridge({ seed: 3, legacy: true });
    assert.deepEqual([C.GATES.legacy, C.GATES.oruvathLegacy, C.GATES.economyV2], [true, true, true]);
    assert.equal(econShown(), true);
    assert.equal(b.view.meta.offers.length, 18);
  } finally { done(); }
});

test('the hall: cards read C.META_HERO (ranks, costs, effect); the level-20 wing is priced, not sold', () => {
  clearKeys();
  try {
    const b = createBridge({ seed: 3, legacy: true });
    const D = b.data.meta;
    for (const id of Object.keys(C.META_HERO)) assert.deepEqual([D.entries[id].ranks, D.entries[id].costs], [C.META_HERO[id].ranks, C.META_HERO[id].costs], id);
    assert.equal(metaEffect(D.entries.vigor, D, b.data).short, '+1 % max health per rank');
    assert.equal(metaEffect(D.entries.quick_study, D, b.data).short, '+5 % experience per rank');
    assert.match(metaEffect(D.entries.quartermaster, D, b.data, 'expedition').short, /camp points per rank$/);
    assert.deepEqual(D.wing, { level: C.TREE_OPEN_LEVEL, trees: C.TREE_OPEN_COST, armoury: C.ARMOURY_COST });
    // the wing is not among the offers (nothing to buy)
    assert.ok(!b.view.meta.offers.some((o) => /tree|armoury/.test(o.id)));
    assert.ok(!b.view.meta.offers.some((o) => ['keen', 'prospector', 'ledger', 'cache', 'relics', 'talent_pt'].includes(o.id)));
  } finally { done(); }
});

test('D160: a version 3 profile bought under the old hall is refunded once; the note says the hall has new prices', () => {
  clearKeys();
  try {
    const p0 = oldBuyer();
    set('tbwcr.profile.v3', JSON.stringify(p0));
    const b = createBridge({ seed: 3, legacy: true });
    const m = b.view.meta;
    assert.deepEqual([m.echoes, m.spent, m.unlocks], [p0.legacy + p0.spent, 0, {}]);
    assert.deepEqual(m.refund, { back: p0.spent, legacy: p0.legacy + p0.spent, hall: true });
    const stored = JSON.parse(get('tbwcr.profile.v3'));
    assert.deepEqual([stored.hallV2, stored.legacy, stored.spent], [true, p0.legacy + p0.spent, 0], 'stored at once');
    // a second page: no second refund, no note
    const b2 = createBridge({ seed: 3, legacy: true });
    assert.equal(b2.view.meta.refund, null);
    assert.equal(b2.view.meta.echoes, p0.legacy + p0.spent);
  } finally { done(); }
});

test('one name, "camp points": the content lines, the Set out log line, the second camp\'s flag', () => {
  clearKeys();
  try {
    const T = CONTENT.texts;
    assert.equal(econLine(T, 'tracker', { points: 3 }), '3 camp points');
    assert.equal(econLine(T, 'hub_offer', { price: 2, points: 3 }), 'Take for 2 camp points (you have 3).');
    assert.equal(econLine(T, 'level_progress', { from: 4, to: 7 }), 'Level 4 → 7');
    assert.equal(econLine(T, 'nope'), '');
    assert.equal(campPoints(1), '1 camp point');
    // the second run's camp (profile runs 1): secondCamp; a later one: not
    set('tbwcr.profile.v3', JSON.stringify((() => { C.GATES.legacy = true; C.GATES.economyV2 = true; const p = { ...R.newProfile(), runs: 1, welcome: true, guide: 'done' }; gateOff(); return p; })()));
    const b = createBridge({ seed: 5, legacy: true });
    b.dispatch({ type: 'START_RUN' });
    assert.equal(b.view.phase, 'PREP');
    assert.equal(b.view.prep.secondCamp, true);
    assert.equal(econLine(T, 'second_camp', { points: b.view.prep.points }), `Your camp has grown: ${b.view.prep.points} camp points and a contract board. Contracts pay XP, gold and a choice of gear.`);
    const r = b.dispatch({ type: 'SET_OUT' });
    const msg = r.events.find((e) => e.t === 'msg' && /^You set out/.test(e.text));
    assert.match(msg.text, /^You set out with \d+ contracts? and \d+ camp points?\.$/);
    assert.ok(!/Reserve/.test(msg.text));
    clearKeys();
    set('tbwcr.profile.v3', JSON.stringify((() => { C.GATES.legacy = true; C.GATES.economyV2 = true; const p = later(); gateOff(); return p; })()));
    const b2 = createBridge({ seed: 5, legacy: true });
    b2.dispatch({ type: 'START_RUN' });
    assert.equal(b2.view.prep.secondCamp, false);
  } finally { done(); }
});

test('the level-up event carries the banner\'s fields; the summary names the next hall entry; hero select reads "Level 1 → N"', () => {
  clearKeys();
  try {
    const b = createBridge({ seed: 3, legacy: true });
    b.dispatch({ type: 'SET_GUIDE', on: false });
    b.dispatch({ type: 'START_RUN' });
    const ups = [];
    for (let i = 0; i < 3000 && b.view.phase !== 'SUMMARY'; i++) { const r = b.dispatch({ type: 'AUTO' }); if (!r.ok) break; for (const e of r.events) if (e.t === 'levelUp') ups.push(e); }
    assert.ok(ups.length >= 2, `level-ups ${ups.length}`);
    for (const e of ups) {
      assert.ok(e.hpGain > 0 && e.maxHp > e.hpGain, JSON.stringify(e));
      assert.ok(Array.isArray(e.heroSpells) && typeof e.ranks === 'number');
      assert.equal(e.xpToNext, R.heroXpToNext(e.heroLevel));
      // heroSpells: the class spells whose hero learn level is this one
      const want = Object.values(C.SPELL).filter((sp) => sp.cls === 'rogue' && sp.source === 'class' && R.learnLevel({ legacy: true }, sp.id) === e.heroLevel).map((sp) => sp.name);
      assert.deepEqual(e.heroSpells, want);
    }
    assert.equal(b.view.phase, 'SUMMARY');
    const after = b.view.meta.after;
    assert.ok(after.nextHall && after.nextHall.id === 'satchel' && after.nextHall.cost === C.META_HERO.satchel.costs[0], JSON.stringify(after.nextHall));
    assert.equal(econLine(CONTENT.texts, 'run_balance', { legacy: after.echoes, next: after.nextHall.name, cost: after.nextHall.cost }), `You have ${after.echoes} Legacy points. Next in the hall: Packed Satchel, 50.`);
    assert.ok(!b.view.summary.echoes.some((x) => x[2] === 'reserve'), 'no reserve line');
    const s = b.view.summary;
    assert.ok(s.hero.xpToNext > 0 && s.hero.xp >= 0);
    b.dispatch({ type: 'END_RUN' });
    const lr = b.view.meta.lastRun;
    assert.deepEqual([lr.classId, lr.from, lr.level], ['rogue', 1, s.hero.level]);
  } finally { done(); }
});
