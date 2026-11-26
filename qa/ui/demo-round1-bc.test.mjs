// Demo blind round 1, B and C (BACKLOG 2026-11-26; docs/feedback/2026-11-26-blind-demo-skipper.md, -newcomer.md;
// docs/handoffs/ui-2026-11-26b.md), the UI's pure parts in Node: the Furnace's one sentence in the demo and the full game,
// the meter's line while the Dimming sets the state (no clock tag then), the "counts as" line only inside a place and with
// its reason when the meter shows another state, the toll tag colour line, and the way-out words (Road signs, the Bell's
// button and tooltip, a Dimming fight before the Bell). Every line is a draft. The DOM parts (the first-map note, the Key's
// labels, the confirm dialogs and the tooltip layering) are checked in qa/browser/ui-regress.mjs part BC.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const { CONTENT } = await import('../../src/content/index.js');
const { DEMO_TEXT } = await import('../../src/ui/demo.js');
const { furnaceLine, FURNACE_LINE, meterText, clockTag, countsLine, insidePlace, tagLine, DIM_NEAR_WORDS, DIM_IN_WORDS } = await import('../../src/ui/heat.js');
const { EXIT_WORDS, bellLabel, bellLine, bellCharges, roadLine, roadSignWord, leaveFightLine } = await import('../../src/ui/ui-text.js');

test('B: the Furnace says what overspending costs, in the demo and in the full game, in one wording everywhere', () => {
  const demo = 'Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll.';
  const full = 'Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll and the final boss gets stronger.';
  assert.equal(DEMO_TEXT.furnaceLine, demo);
  assert.equal(FURNACE_LINE, full);
  assert.equal(furnaceLine({ data: { demo: { lastZone: 2 } } }), demo);
  assert.equal(furnaceLine({ data: {} }), full);
  // the coach lines that introduce it say the same sentence (G5 in the guide, H16 outside it)
  const T = CONTENT.tutorial;
  assert.equal(T.beats.find((x) => x.id === 'G5').line, full);
  assert.equal(T.hints.find((x) => x.id === 'H16').line, full);
  assert.equal(T.demo.hints.H16.line, demo);
});

test('B: while the Dimming sets the state the line says so and no tag stands beside it', () => {
  assert.equal(DIM_NEAR_WORDS, 'Raised by the Dimming nearby');
  assert.equal(DIM_IN_WORDS, 'You stand in the Dimming');
  assert.equal(meterText({ by: 'dim', heat: -9, dimIn: 2 }), DIM_NEAR_WORDS);
  assert.equal(meterText({ by: 'dim', heat: -9, dimIn: 0 }), DIM_IN_WORDS);
  assert.equal(meterText({ by: 'run', heat: -9, dimIn: 7 }), '9 tolls to spare');
  assert.equal(clockTag({ by: 'dim', dimIn: 2, stateDim: 'hot' }), null);
  assert.deepEqual(clockTag({ by: 'run', dimIn: 7, stateDim: 'clear' }), { by: 'run', glyph: '▼', text: 'Set by your tolls' });
});

test('B: "counts as" only inside a place, and with its reason when the meter shows another state', () => {
  const inNode = { phase: 'NODE', node: { type: 'dungeon' } };
  assert.equal(insidePlace(inNode), true);
  assert.equal(insidePlace({ phase: 'ZONE_HUB', node: { type: 'trainer', origin: 'hub' } }), false);
  assert.equal(insidePlace({ phase: 'CAMP', node: { type: 'camp_grind', origin: 'camp' } }), false);
  assert.equal(insidePlace({ phase: 'MAP', node: null }), false);
  assert.equal(countsLine({ state: 'warm', node: { state: 'clear' } }, inNode), 'Entered while Calm: this place still counts as Calm');
  assert.equal(countsLine({ state: 'hot', node: { state: 'hot' } }, inNode), 'This place counts as Burning');
  assert.equal(countsLine({ state: 'warm', node: { state: 'clear' } }, { phase: 'ZONE_HUB', node: { origin: 'hub' } }), '');
});

test('B: a coloured toll tag says what its colour means; a plain one says nothing', () => {
  assert.equal(tagLine({ change: true, state: 'warm', time: 3 }), 'Tag colour: after this the Furnace turns Smouldering.');
  assert.equal(tagLine({ change: true, state: 'clear', time: 0 }), 'Tag colour: after this the Furnace turns Calm.');
  assert.equal(tagLine({ change: false, state: 'warm', time: 3 }), '');
  assert.equal(tagLine(null), '');
});

test('C: Road signs name the goal; the Bell says where it takes you and what its number is', () => {
  assert.equal(roadSignWord('next', 'Greywater Fens', 'End of the demo'), 'Next zone');
  assert.equal(roadSignWord('demo', 'End of the demo', 'End of the demo'), 'End of the demo');
  assert.equal(roadSignWord('camp', 'Ashen Camp', 'End of the demo'), 'Ashen Camp');
  assert.equal(bellLabel(1, 'next'), 'Ring the Bell: next zone (1 left)');
  assert.equal(bellLabel(2, 'demo'), 'Ring the Bell: end of the demo (2 left)');
  assert.equal(bellLabel(1, 'camp', 'Ashen Camp'), 'Ring the Bell: Ashen Camp (1 left)');
  assert.equal(bellLine('next', 'Greywater Fens'), 'Rings you on to the next zone, the hub of Greywater Fens, from anywhere on this map. No way back.');
  assert.equal(bellLine('demo', 'End of the demo'), '', 'the demo\'s last zone: its leave line says it');
  assert.equal(bellCharges(1), 'The number on the button: 1 charge left this run. A Road needs none.');
  assert.equal(bellCharges(2), 'The number on the button: 2 charges left this run. A Road needs none.');
  assert.equal(roadLine('next', 'Greywater Fens'), 'You stand on a Road: walk on to Greywater Fens.');
  assert.notEqual(bellLine('next', 'X'), roadLine('next', 'X'), 'the Bell\'s and the Road\'s tips differ');
  assert.equal(EXIT_WORDS.roadFree, 'Uses no Bell charge.');
});

test('C: a ring that ends in a Dimming fight says so before the click', () => {
  assert.equal(leaveFightLine({ time: 4, parts: [{ why: 'bell', tolls: 2 }, { why: 'dimFight', tolls: 2 }] }), 'A fight comes first: the Dimming reaches you while the Bell rings.');
  assert.equal(leaveFightLine({ time: 4, dimFight: true }, true), 'A fight comes first: you stand in the Dimming.');
  assert.equal(leaveFightLine({ time: 2, parts: [{ why: 'bell', tolls: 2 }] }), '');
  assert.equal(leaveFightLine(null), '');
});
