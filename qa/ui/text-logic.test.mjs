// Text logic of the demo text pass (hand-off content-2026-11-25 L1-L6; BACKLOG "Text logic from content-2026-11-25"), in Node:
// L1 the TUTORIAL.demo lines (G5, H16, H17) and DEMO_TEXT.furnaceLine under C.GATES.demo and the full game's lines otherwise;
// L3 one-rank wording of the demo hall (and the full game's unchanged); L5 the gold and sell log lines in gold, silver and
// copper; L6 one Ember of Return count. L2 (one "nothing can stop it" line), L4 (no Engine footer) and the meter's hidden
// "Boss +N %" build DOM: qa/browser/ui-regress.mjs part TL and qa/browser/demo-campaign.mjs. Every line is a draft.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); }, key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
let prevLs = null;
const own = () => { prevLs = globalThis.localStorage; Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true }); mem.clear(); };
const R = await import('../../src/rules.js');
const C = R.C;
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { DEMO_TEXT } = await import('../../src/ui/demo.js');
const { furnaceLine, FURNACE_LINE } = await import('../../src/ui/heat.js');
const { metaEffect, resurrectText, goldLogLine, sellLogLine } = await import('../../src/ui/ui-text.js');
const { setDisplay } = await import('../../src/ui/util.js');

const MAIN = { ...C.GATES };
const done = () => { R.setGates(MAIN); setDisplay({}); mem.clear(); if (prevLs) globalThis.localStorage = prevLs; prevLs = null; };
const T = CONTENT.tutorial;
const beat = (id) => T.beats.find((x) => x.id === id);
const hint = (id) => T.hints.find((x) => x.id === id);
const DEMO_LINES = { G5: T.demo.beats.G5.line, H16: T.demo.hints.H16.line, H17: T.demo.hints.H17.line };

test('L1: G5, H16 and H17 read TUTORIAL.demo under C.GATES.demo, the full game\'s lines otherwise', () => {
  const full = { G5: beat('G5').line, H16: hint('H16').line, H17: hint('H17').line };
  assert.match(full.G5, /final boss gets stronger/);
  assert.match(full.H16, /final boss gets stronger/);
  assert.match(full.H17, /final boss gets stronger/);
  try {
    R.applyDemo();
    assert.equal(beat('G5').line, 'Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll.');
    assert.equal(hint('H16').line, 'Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll.');
    assert.equal(hint('H17').line, 'Burning: more XP, gold and better drops. The Dimming still spreads with every toll.');
    for (const l of Object.values(DEMO_LINES)) assert.doesNotMatch(l, /boss/i);
    // the other fields of those entries are untouched
    assert.equal(hint('H16').system, 'The Furnace');
    assert.equal(beat('G5').hint, 'H16');
    // a line not in TUTORIAL.demo still reads as written (and the Legacy wording of H37 still binds under the demo's legacy switch)
    assert.equal(hint('H37').line, T.legacy.hints.H37.line);
  } finally { R.setGates(MAIN); }
  assert.deepEqual({ G5: beat('G5').line, H16: hint('H16').line, H17: hint('H17').line }, full, 'switch off again: the full game\'s lines');
  // Legacy alone (no demo) leaves them as written
  try { R.setGates({ ...MAIN, legacy: true, oruvathLegacy: true, economyV2: true }); assert.deepEqual({ G5: beat('G5').line, H16: hint('H16').line, H17: hint('H17').line }, full); } finally { R.setGates(MAIN); }
});

test('L1: the meter tooltip and hub intro line is DEMO_TEXT.furnaceLine in the demo, FURNACE_LINE otherwise', () => {
  assert.equal(DEMO_TEXT.furnaceLine, 'Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll.');
  assert.equal(furnaceLine({ data: { demo: { build: true } } }), DEMO_TEXT.furnaceLine);
  assert.equal(furnaceLine({ data: { demo: null } }), FURNACE_LINE);
  assert.equal(furnaceLine({ data: {} }), FURNACE_LINE);
  assert.match(FURNACE_LINE, /final boss gets stronger/);
  assert.doesNotMatch(DEMO_TEXT.furnaceLine, /boss/i);
});

test('L3: the demo hall\'s five entries read one rank (no "per rank", "for each rank", "with rank I", "(N in all)")', () => {
  own();
  try {
    const b = createBridge({ seed: 3, demo: true });
    const D = b.data.meta; const fx = (id) => metaEffect(D.entries[id], D, b.data, 'expedition');
    const want = {
      vigor: ['+3 % max health', 'Every hero starts with 3 % more maximum health.'],
      edge: ['+2 % Power', 'Every hero has 2 % more Power: more damage from every attack and spell.'],
      quick_study: ['+5 % experience', 'Every hero earns 5 % more experience: levels come sooner.'],
      pockets: ['+8 bag slots', 'Your bags hold 8 more items.'],
      quartermaster: ['+2 camp points', 'On the expedition map you have two more camp points to spend at the start camp.'],
    };
    for (const [id, [short, long]] of Object.entries(want)) { assert.equal(fx(id).short, short, id); assert.equal(fx(id).long, long, id); }
    for (const id of C.DEMO_HALL) assert.doesNotMatch(`${fx(id).short} ${fx(id).long}`, /per rank|each rank|rank I\b|in all/, id);
  } finally { done(); }
});

test('L3: with the demo off the hall\'s rank wording is as before', () => {
  own();
  try {
    const b = createBridge({ seed: 3, legacy: true });
    const D = b.data.meta; const fx = (id, mode) => metaEffect(D.entries[id], D, b.data, mode);
    assert.equal(fx('vigor').short, '+3 % max health, then +1 %');
    assert.equal(fx('vigor').long, 'Every hero starts with 3 % more maximum health with rank I and 1 % more with rank II (4 % in all).');
    assert.equal(fx('edge').short, '+2 % Power, then +1 %');
    assert.equal(fx('pockets').short, `+${C.HALL_POCKETS_SLOTS} bag slots per rank`);
    assert.equal(fx('quick_study').short, '+5 % experience per rank');
    assert.match(fx('quick_study').long, /for each rank/);
    assert.match(fx('quartermaster', 'expedition').long, /for each rank/);
  } finally { done(); }
});

test('L5: the gold and sell log lines use gold, silver and copper', () => {
  assert.equal(goldLogLine(42, 0), 'You receive 42 c.');
  assert.equal(goldLogLine(1234, 0), 'You receive 12 s 34 c.');
  assert.equal(goldLogLine(120505, 0), 'You receive 12 g 5 s 5 c.');
  assert.equal(goldLogLine(1234, 200), 'You receive 12 s 34 c (+2 s 0 c from the Furnace).');
  assert.equal(sellLogLine('Trail Rations', 85), 'You sell Trail Rations for 85 c.');
  assert.equal(sellLogLine('4 junk items', 10250), 'You sell 4 junk items for 1 g 2 s 50 c.');
  for (const l of [goldLogLine(1234, 5), sellLogLine('x', 1234)]) assert.doesNotMatch(l, /copper/);
});

test('L6: one Ember of Return count in the revive badge and tooltip', () => {
  const t = (resurrect, extra = {}, boss = false) => resurrectText({ resurrect, ...extra }, boss);
  assert.deepEqual(t(['boon', 'ember']), { list: 'Ember of Return ×2', note: null, count: 2 });
  assert.equal(t(['ember', 'ember', 'boon']).list, 'Ember of Return ×3');
  assert.equal(t(['boon']).list, 'Ember of Return');
  assert.equal(t(['ember']).list, 'Ember of Return');
  const mixed = t(['boon', 'meta', 'ember']);
  assert.equal(mixed.list, 'Ember of Return ×2, Second Breath (not in the final fight)');
  assert.equal(mixed.count, 3);
  assert.equal(t([]).list, 'None');
  assert.equal(t([], { resurrectHeld: { meta: 1 } }, true).note, 'Second Breath does not work in the final fight.');
});
