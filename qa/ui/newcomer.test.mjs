// Newcomer check 2026-11-15 (docs/feedback/2026-11-15-blind-newcomer.md; docs/handoffs/ui-2026-11-15.md): the UI's pure parts
// in Node. The nearest Road (hops and tolls) on a real mapView, the red-label node U02 points at, the UI hints' lines, the
// Furnace's line and tooltip while the Dimming sets the state. The browser checks are ui-regress part X.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const R = await import('../../src/rules.js');
const { CONTENT } = await import('../../src/content/index.js');
const { nearestRoad, hopsText, UI_HINTS, NEAREST_ROAD_TAIL } = await import('../../src/ui/ui-text.js');
const { rawLine, lineParts, redPassNode, UI_HINT_IDS } = await import('../../src/ui/onboarding.js');
const fill = (raw, num) => ({ text: lineParts(raw, num).map((x) => (typeof x === 'string' ? x : x.key)).join('') }); // onboarding.js fillLine's text, no DOM
const { meterText, dimTipLine, DIM_NEAR_WORDS, DIM_MARK_LINE } = await import('../../src/ui/heat.js');

/** A small map: 0 hub; 1, 2 ring 1; 3 a Road via 1; 4 a Road via 2 and 5 (5 Dimmed). */
const toy = (over = {}) => ({
  pos: 0, walkTime: 1, travelTime: 2, roads: [3, 4],
  nodes: [{ id: 0, hub: true }, { id: 1 }, { id: 2 }, { id: 3, road: true }, { id: 4, road: true }, { id: 5 }].map((n) => ({ ...n, ...(over[n.id] || {}) })),
  edges: [[0, 1], [0, 2], [1, 3], [2, 5], [5, 4]],
});

test('nearestRoad: fewest hops along the paths, tolls = hops x walk + the Road; closed Roads, Dimmed and barred nodes', () => {
  assert.deepEqual(nearestRoad(toy()), { id: 3, hops: 2, tolls: 4 });
  // the nearer Road closed (D142): the other one, through the Dimmed node only when there is no other way
  assert.deepEqual(nearestRoad(toy({ 3: { closed: true }, 5: { dimmed: true } })), { id: 4, hops: 3, tolls: 5 });
  // a barred node is never walked through
  assert.equal(nearestRoad(toy({ 3: { closed: true }, 5: { barred: true } })), null);
  // standing on a Road: none
  assert.equal(nearestRoad({ ...toy(), pos: 3 }), null);
  assert.equal(hopsText(1), '1 step'); assert.equal(hopsText(2), '2 steps');
});

test('nearestRoad on a real zone 1 mapView: a reachable open Road, its hops the BFS distance', () => {
  let s = R.newRun({ classId: 'rogue', seed: 7, content: CONTENT, mapMode: 'expedition', prep: true });
  for (let i = 0; i < 40 && !(s.phase === 'MAP'); i++) s = R.step(s, R.autoAction(s)).state;
  const mv = R.mapView(s);
  const r = nearestRoad(mv);
  assert.ok(r && mv.roads.includes(r.id));
  assert.equal(r.tolls, r.hops * mv.walkTime + mv.travelTime);
  assert.ok(r.hops >= 1 && r.hops <= 4, `hops ${r.hops}`);
});

test('U01 and U02 lines (draft): their placeholders filled; the "Take a Road" tail', () => {
  const T = CONTENT.tutorial;
  assert.deepEqual(UI_HINT_IDS, ['U01', 'U02']);
  assert.equal(rawLine(T, 'U01'), UI_HINTS.U01);
  assert.equal(fill(rawLine(T, 'U01'), { hops: '2 steps', tolls: '4 tolls' }).text, 'Nearest Road: 2 steps, 4 tolls.');
  assert.equal(fill(rawLine(T, 'U02'), { passTolls: '1 toll' }).text, 'Pass through a place for 1 toll X.');
  assert.equal(fill(NEAREST_ROAD_TAIL, { hops: '1 hop', tolls: '3 tolls' }).text, 'Nearest: 1 hop, 3 tolls.');
});

test('redPassNode: a reachable node whose MOVE ends Burning or Infernal (a red toll label) and that can be passed through', () => {
  const v = (next, moves) => ({ zone: { exp: { moves, nodes: [{ id: 0 }, { id: 1 }, { id: 2, barred: true }] } }, heat: { next } });
  const moves = [{ nodeId: 1, passTime: 1 }, { nodeId: 2, passTime: 1 }];
  assert.equal(redPassNode(v({ 'MOVE:1': { change: true, state: 'warm' } }, moves)), null);
  assert.equal(redPassNode(v({ 'MOVE:1': { change: true, state: 'hot' } }, moves)), 1);
  assert.equal(redPassNode(v({ 'MOVE:1': { change: false, state: 'hot' } }, moves)), null);
  assert.equal(redPassNode(v({ 'MOVE:2': { change: true, state: 'scorched' } }, moves)), null, 'a barred node is no way through');
  assert.equal(redPassNode(v({ 'MOVE:1': { change: true, state: 'scorched' } }, [{ nodeId: 1, passTime: null }])), null, 'a walk (nothing to pass) offers no pass');
});

test('the Furnace while the Dimming sets the state: the line says why, the tooltip has the clock; the diamond\'s line', () => {
  assert.equal(meterText({ by: 'dim', heat: -3, dimIn: 2 }), DIM_NEAR_WORDS);
  assert.equal(DIM_NEAR_WORDS, 'Raised by the Dimming nearby'); // demo blind round 1 B (draft; was 'The Dimming is near')
  assert.equal(meterText({ by: 'run', heat: -3, dimIn: 2 }), '3 tolls to spare');
  assert.match(dimTipLine({ heat: -3, dimIn: 1 }), /^Your node dims in 1 toll\. Tolls: 3 to spare\./);
  assert.ok(DIM_MARK_LINE.startsWith('◆'));
});

test('engine-2026-11-15 UI needs 5 and 8: the cost line split by heatPreview parts; the carry line', async () => {
  const { costText, carryLine } = await import('../../src/ui/heat.js');
  assert.equal(costText({ time: 5, dimFight: true, parts: [{ why: 'quest', tolls: 3 }, { why: 'dimFight', tolls: 2 }] }), 'Costs 5 tolls: 3 for the quest, +2 for a fight in the Dimming (it dims before you finish).');
  assert.equal(costText({ time: 2, dimFight: true, parts: [{ why: 'walk', tolls: 1 }, { why: 'dimFight', tolls: 1, escape: true }] }), 'Costs 2 tolls: 1 for the walk, +1 for a fight in the Dimming.');
  assert.equal(costText({ time: 3, parts: [{ why: 'quest', tolls: 3 }] }), 'Costs 3 tolls.');
  assert.equal(carryLine({ carry: { cumulative: true, carried: 3, share: 20 } }), 'Tolls carry over: 3 overspent before this zone; this zone gives 20.');
  assert.equal(carryLine({ carry: { cumulative: true, carried: -4, share: 20 } }), 'Tolls carry over: 4 saved before this zone; this zone gives 20.');
  assert.equal(carryLine({ carry: { cumulative: true, carried: 0, share: 20 } }), '');
  assert.equal(carryLine({}), '');
});

test('engine-2026-11-15 UI needs 2 and 6 through the bridge: each levelUp event carries the trainer as at that level; the talent rule numbers', async () => {
  mem.clear();
  const { createBridge } = await import('../../src/ui/engine-bridge.js');
  const C = await import('../../src/constants.js');
  const b = createBridge({});
  assert.equal(b.data.rules.talentFirst, C.TALENT_FIRST_LEVEL);
  assert.equal(b.data.rules.talentStep, C.TALENT_LEVEL_STEP);
  assert.ok(CONTENT.texts.progress.talent_points.includes('{first}'));
  b.dispatch({ type: 'START_RUN' });
  const ups = [];
  for (let i = 0; i < 400 && ups.length < 6 && b.view.phase !== 'SUMMARY'; i++) {
    const r = b.dispatch({ type: 'AUTO' }); if (!r.ok) break;
    for (const e of r.events) if (e.t === 'levelUp') ups.push(e);
  }
  assert.ok(ups.length >= 3, `level-ups seen: ${ups.length}`);
  for (const e of ups) {
    assert.ok(e.trainer, `level ${e.level}: a trainer view`);
    for (const x of e.trainer.learn || []) assert.ok(C.SPELL[x.id].lvl <= e.level, `level ${e.level} banner names ${x.id} (level ${C.SPELL[x.id].lvl})`);
  }
});
