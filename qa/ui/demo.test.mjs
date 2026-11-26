// The demo in the UI (docs/specs/demo.md 1.3, 1.4, 2.1-2.4, 3.1, 3.2, 4.1, 4.3; D171, task D.3), in Node: the bridge with
// the demo's switches (opts.demo, the team build's ?demo=1; the demo build applies them itself and locks them), the storage
// prefix tbwcr.demo., Start over, the summary's demo fields and "So far", the hall's seven entries at rank I and no wing, no
// Stormhawk, the cap on the view, the demo's draft lines (the D150 naming rule, the 80-word block), and the builder's
// --demo switch (one line differs). With the switch off nothing of it shows. Browser checks: qa/browser/demo-campaign.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// a localStorage stand-in with key() and length (store.clearDemo walks the keys)
const mem = new Map();
const ls = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); },
  key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
};
Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
const R = await import('../../src/rules.js');
const C = R.C;
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { store, keyOf } = await import('../../src/ui/store.js');
const { DEMO_TEXT, fill, andList, wordCount, leaveLine, bellLabelDemo, demoEarly, demoExitOf } = await import('../../src/ui/demo.js');
const { DEMO_BUILD } = await import('../../src/build-flags.js');
const { setDisplay } = await import('../../src/ui/util.js');

const MAIN = { ...C.GATES };
/** This file's storage stand-in, empty (another test file may have put its own in place). */
let prevLs = null;
const own = () => { prevLs = globalThis.localStorage; globalThis.localStorage = ls; mem.clear(); };
const done = () => { R.setGates(MAIN); setDisplay({}); mem.clear(); if (prevLs) globalThis.localStorage = prevLs; prevLs = null; };
const BANNED = /\bpar\b|Ascendancy|Star's line|\bPays\b|Spoils|\bilvl\b|Echoes|Reserve|https?:|www\.|wishlist|buy now|sign up|e-?mail|coming soon/i;
/** Autoplay a bridge's run to its summary (the UI's AUTO step). */
function playOut(b, max = 8000) {
  for (let i = 0; i < max && b.view.phase !== 'SUMMARY'; i++) { const r = b.dispatch({ type: 'AUTO' }); if (!r.ok && /Nothing to do/.test(r.error || '')) break; }
  return b.view;
}

test('src/build-flags.js: DEMO_BUILD is false in src/ (the full game)', () => {
  assert.equal(DEMO_BUILD, false);
});

test('the switch off: no data.demo, the full hall and the wing, Stormhawk listed, full-game keys', () => {
  own();
  try {
    const b = createBridge({ seed: 3, legacy: true });
    assert.equal(b.data.demo, null);
    assert.ok(b.data.meta.wing);
    assert.equal(Object.keys(b.data.meta.entries).length, Object.keys({ ...C.META, ...C.META_HERO }).length);
    assert.ok(b.data.pets.stormhawk);
    assert.equal(keyOf('tbwcr.profile.v3'), 'tbwcr.profile.v3');
  } finally { done(); }
});

test('2.1-2.2: opts.demo (?demo=1 in a team build) applies DEMO_GATES; data.demo; the hall is DEMO_HALL at rank I, no wing; no Stormhawk', () => {
  own();
  try {
    const b = createBridge({ seed: 3, demo: true });
    assert.deepEqual({ ...C.GATES }, { ...C.DEMO_GATES });
    const d = b.data.demo;
    assert.deepEqual([d.build, d.lastZone, d.heroMax, d.hallSize, d.maxWords], [false, 2, 7, 7, C.DEMO_END_MAX_WORDS]);
    assert.deepEqual(d.zones, CONTENT.zones.slice(0, 2).map((z) => z.name));
    assert.equal(d.moreZones, C.ZONE_COUNT - 2);
    assert.equal(d.canSave, true);
    assert.deepEqual(Object.keys(b.data.meta.entries), [...C.DEMO_HALL]);
    for (const e of Object.values(b.data.meta.entries)) { assert.equal(e.ranks, 1, e.id); assert.equal(e.costs.length, 1, e.id); }
    assert.deepEqual(b.data.meta.entries.vigor.hpPct, C.HALL_VIGOR_PCT.slice(0, 1));
    assert.equal(b.data.meta.wing, null);
    assert.equal(b.data.pets.stormhawk, undefined);
    assert.ok(b.data.pets.ridgewolf);
    assert.deepEqual(b.view.meta.offers.map((o) => o.id), [...C.DEMO_HALL]);
  } finally { done(); }
});

test('2.4: the demo keeps every key under tbwcr.demo.; a full-game key is never touched; storage blocked: canSave false', () => {
  own();
  try {
    mem.set('tbwcr.profile.v3', '{"v":3,"legacy":999}');
    const b = createBridge({ seed: 5, demo: true });
    assert.equal(keyOf('tbwcr.profile.v3'), 'tbwcr.demo.profile.v3');
    assert.equal(b.view.meta.echoes, 0, 'the full game\'s profile is not read');
    b.dispatch({ type: 'START_RUN' });
    playOut(b);
    b.dispatch({ type: 'END_RUN' });
    const keys = [...mem.keys()];
    assert.ok(keys.includes('tbwcr.demo.profile.v3'), keys.join());
    assert.deepEqual(keys.filter((k) => !k.startsWith('tbwcr.demo.')), ['tbwcr.profile.v3']);
    assert.equal(mem.get('tbwcr.profile.v3'), '{"v":3,"legacy":999}');
    // storage that throws: ok() false, reads null, writes refused (the game plays on)
    const saved = globalThis.localStorage;
    globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); }, key() { return null; }, length: 0 };
    try {
      assert.equal(store.ok(), false);
      assert.equal(store.get('tbwcr.profile.v3'), null);
      assert.equal(store.set('tbwcr.profile.v3', 'x'), false);
      const b2 = createBridge({ seed: 6, demo: true });
      assert.equal(b2.data.demo.canSave, false);
      b2.dispatch({ type: 'START_RUN' });
      assert.equal(b2.view.phase, 'PREP');
    } finally { globalThis.localStorage = saved; }
  } finally { done(); }
});

test('1.2, 1.4: a run that ends at the cut: summary demo { lastZone, zones }, demoRun; "So far" from the dry END_RUN; END_RUN back to hero select', () => {
  own();
  try {
    let found = false;
    for (const seed of [11, 12, 13, 14, 15]) {
      const b = createBridge({ seed, demo: true });
      b.dispatch({ type: 'START_RUN' });
      const v = playOut(b);
      assert.equal(v.phase, 'SUMMARY');
      assert.equal(v.summary.demoRun, true);
      if (v.summary.outcome !== 'demo') { assert.equal(v.summary.demo, null); b.dispatch({ type: 'END_RUN' }); continue; }
      found = true;
      assert.deepEqual(v.summary.demo, { lastZone: 2, zones: CONTENT.zones.slice(0, 2).map((z) => z.name) });
      const so = v.meta.after.demo;
      assert.equal(so.runs, v.meta.runs + 1);
      assert.equal(so.total, C.DEMO_HALL.length);
      assert.equal(so.owned, 0);
      assert.ok(so.heroes.some((x) => x.classId === v.summary.classId && x.level === v.summary.hero.level));
      b.dispatch({ type: 'END_RUN' });
      assert.equal(b.view.phase, 'CREATE');
      break;
    }
    assert.ok(found, 'one of five runs reached the cut');
  } finally { done(); }
});

test('1.2a (R2-1, draft): zone 2 shows the demo end\'s progress; the Bell reads differently; an early leave is a plain run end', () => {
  own();
  try {
    const b = createBridge({ seed: 21, demo: true });
    b.dispatch({ type: 'START_RUN' });
    for (let i = 0; i < 8000 && b.view.phase !== 'SUMMARY' && !(b.view.zone && b.view.zone.idx === 2); i++) b.dispatch({ type: 'AUTO' });
    let v = b.view;
    if (v.phase === 'SUMMARY') return; // died in zone 1: the engine tests cover the rule
    const ctx = { data: b.data };
    if (v.phase === 'ZONE_HUB') { b.dispatch({ type: 'LEAVE_HUB' }); v = b.view; }
    assert.deepEqual(demoExitOf(v), { wins: 0, need: C.DEMO_END_WINS, done: false });
    assert.ok(demoEarly(v, ctx));
    assert.equal(bellLabelDemo(v, ctx), 'End this run early');
    const z2 = CONTENT.zones[1].name;
    assert.equal(leaveLine(ctx, v), `Leaving now ends this run early. Win three more fights in ${z2} to finish the demo; an early leave earns nothing for ${z2}.`);
    // zone 1's Bell is the plain one
    assert.equal(bellLabelDemo({ zone: { idx: 1, exp: {} } }, ctx), null);
    // done: the demo end's own label and line
    const vd = { ...v, zone: { ...v.zone, exp: { ...v.zone.exp, demoExit: { wins: 3, need: 3, done: true } } } };
    assert.equal(bellLabelDemo(vd, ctx), 'End the demo run');
    assert.equal(leaveLine(ctx, vd), `Leaving ${z2} ends this demo run. You keep your levels and Legacy points.`);
    // the early leave by the Bell (from the map; a Dimmed node fights first, which is a zone 2 win)
    const r = b.dispatch({ type: 'RING_BELL' });
    if (!r.ok) return; // no charge left (the policy rang it): nothing to check here
    for (let i = 0; i < 400 && b.view.phase !== 'SUMMARY'; i++) b.dispatch({ type: 'AUTO' });
    const sm = b.view.summary;
    if (sm.outcome !== 'left') return;
    assert.equal(sm.demo, null);
    assert.equal(sm.demoLeft.need, C.DEMO_END_WINS);
    assert.ok(sm.demoLeft.wins < C.DEMO_END_WINS);
    for (const id of ['bellDone', 'bellEarly', 'askDone', 'askEarly', 'progress', 'progressDone', 'earlyLine', 'leftHeading', 'leftLine', 'welcomeWaits']) assert.doesNotMatch(DEMO_TEXT[id], BANNED, id);
    assert.doesNotMatch(fill('leftHeading', { who: 'Vex', last: z2 }), /made it through/);
  } finally { done(); }
});

test('3.1: the cap on the view: heroCap demo, the levelUp event to 7 carries cap; no XP event shows at the cap', () => {
  own();
  try {
    R.applyDemo();
    const prof = R.debug.setHero(R.newProfile(), 'rogue', { level: 7, xp: 0 });
    mem.set('tbwcr.demo.profile.v3', JSON.stringify({ ...prof, runs: 3, welcome: true, guide: 'done' }));
    const b2 = createBridge({ seed: 21, demo: true });
    assert.equal(b2.view.meta.heroes[0].cap, 'demo');
    b2.dispatch({ type: 'START_RUN' });
    b2.dispatch({ type: 'SET_OUT' });
    assert.equal(b2.view.player.heroCap, 'demo');
    assert.equal(b2.view.player.heroMax, true);
    let xpShown = 0;
    b2.subscribe((v, ev) => { xpShown += ev.filter((e) => e.t === 'xp').length; });
    for (let i = 0; i < 400 && b2.view.phase !== 'SUMMARY'; i++) b2.dispatch({ type: 'AUTO' });
    assert.equal(xpShown, 0, 'no XP number at the cap');
  } finally { done(); }
});

test('2.4: START_OVER clears the demo keys only and gives a new profile with the guided run; refused in the full game', () => {
  own();
  try {
    const off = createBridge({ seed: 2 });
    assert.equal(off.dispatch({ type: 'START_OVER' }).ok, false);
    mem.set('tbwcr.profile.v1', '{"v":1}');
    const b = createBridge({ seed: 7, demo: true });
    b.dispatch({ type: 'START_RUN' });
    playOut(b);
    b.dispatch({ type: 'END_RUN' });
    assert.ok(b.view.meta.runs >= 1);
    mem.set('tbwcr.demo.ui.settings.v1', '{"speed":0}');
    const r = b.dispatch({ type: 'START_OVER' });
    assert.equal(r.ok, true);
    assert.deepEqual([...mem.keys()].filter((k) => k.startsWith('tbwcr.demo.')), []);
    assert.equal(mem.get('tbwcr.profile.v1'), '{"v":1}');
    assert.equal(b.view.phase, 'CREATE');
    assert.equal(b.view.meta.runs, 0);
    assert.equal(b.view.meta.echoes, 0);
    assert.equal(b.view.meta.guided, true);
    assert.deepEqual(b.view.meta.heroes, [null, null, null]);
  } finally { done(); }
});

test('4.1, 4.3, A9: the demo\'s lines are drafts within the naming rule; the block stays within DEMO_END_MAX_WORDS at its longest', () => {
  for (const [id, line] of Object.entries(DEMO_TEXT)) assert.doesNotMatch(line, BANNED, id);
  // the longest block: three named heroes, the cap line, the longest zone names
  const zones = CONTENT.zones.slice(0, 2).map((z) => z.name);
  const block = [
    DEMO_TEXT.heading, fill('madeIt', { zones: andList(zones) }),
    [fill('runs', { n: 99 }), ...['Rogue', 'Mage', 'Hunter'].map((c) => fill('hero', { who: `Abcdefghijklmnop, ${c}`, level: 7 }))].join(' · '),
    fill('hall', { owned: 7, total: 7 }), fill('capReached', { who: 'Abcdefghijklmnop', cap: 7 }),
    fill('fullGame', { last: zones[1], more: 'four', boss: C.BOSS_TEXT.name }),
  ].join(' ');
  assert.ok(wordCount(block) <= C.DEMO_END_MAX_WORDS, `${wordCount(block)} words`);
  assert.equal(fill('leaveLine', { last: zones[1] }), `Leaving ${zones[1]} ends this demo run. You keep your levels and Legacy points.`);
  assert.equal(DEMO_TEXT.cannotSave, 'This browser window cannot save your progress.');
  assert.equal(DEMO_TEXT.startOverAsk, 'Start over? Your heroes and Legacy unlocks are deleted.');
  assert.equal(fill('capLevel', { cap: 7 }), 'Level 7: the demo\'s highest');
});

test('2.1: tools/build.mjs --demo differs from the full build in the DEMO_BUILD line only', () => {
  const ROOT = fileURLToPath(new URL('../../', import.meta.url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tbwcr-demo-build-'));
  const run = (extra, out) => spawnSync(process.execPath, [path.join(ROOT, 'tools/build.mjs'), ...extra, '--out', path.join(dir, out), '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run([], 'game.html').status, 0);
  assert.equal(run(['--demo'], 'demo.html').status, 0);
  const strip = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\(([0-9a-f]+|nogit) [0-9TZ:-]+\)/g, '()').replace(/"([0-9a-f]+|nogit) [0-9TZ:-]+"/g, '""').split('\n');
  const a = strip('game.html'); const b = strip('demo.html');
  assert.equal(a.length, b.length);
  const diff = a.map((l, i) => (l === b[i] ? null : [l, b[i]])).filter(Boolean);
  assert.deepEqual(diff, [['const DEMO_BUILD = false;', 'const DEMO_BUILD = true;']]); // the bundle drops the export keyword
  fs.rmSync(dir, { recursive: true, force: true });
});
