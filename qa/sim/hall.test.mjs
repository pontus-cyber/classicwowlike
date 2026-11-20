// Hall arms (sim/lib/hall.mjs; D164, legacy-hall-v3-draft.md 2, 3, 5, 7): the v2 arm is the hall as built before D167, the
// v3 arm moves only Vigor, Edge, Pockets and prices, the v3d arm is the engine's hall (D167: C.META_HERO, read, not
// copied), a hero cell with an arm owns its hall, and a cell without one resets the effect fields (a worker plays runs of
// several cells).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../../sim/lib/engine.mjs';
import { runWithBot, cellProfile, setGates } from '../../sim/lib/runner.mjs';
import { HALL_ARMS, BUY_ORDER, priceOf, parseHall, hallUnlocks, applyHall } from '../../sim/lib/hall.mjs';

const GATES = { ...Object.fromEntries(Object.entries(C.GATES).filter(([, on]) => on)), legacy: true, oruvathLegacy: true, economyV2: true };
const cell = (hall, cls = 'mage') => ({ bot: 'planner', cls, prof: 'later', tree: 0, map: 'expedition', prep: true, hero: 10, gates: GATES, ...(hall ? { hall } : {}) });
const metaAfter = (c) => runWithBot(c, 9001, null, { maxActions: 2 }).state.meta;

test('the v2 arm is the hall before D167; the account wing + techniques cost 1 640 (v2), 1 540 (v3) and 1 650 (v3d)', () => {
  assert.deepEqual(HALL_ARMS.v2.vigor, [0.01, 0.01]);
  assert.equal(HALL_ARMS.v2.slots, 4);
  const sum = (arm) => BUY_ORDER.reduce((s, [id, r]) => s + priceOf(arm, id, r), 0);
  assert.equal(sum('v2'), 1640);
  assert.equal(sum('v3'), 1540);
  assert.equal(sum('v3fb'), 1540);
  assert.equal(sum('v3d'), 1650);
  assert.deepEqual([priceOf('v2', 'pockets', 1), priceOf('v2', 'stormhawk', 1), priceOf('v3d', 'pockets', 1), priceOf('v3d', 'stormhawk', 1)], [40, 150, 50, 90]);
});

test('D167: arm v3d is the engine\'s catalogue (effects and every price), so the two cannot drift', () => {
  const v3d = HALL_ARMS.v3d;
  assert.deepEqual([v3d.vigor, v3d.edge, v3d.slots], [C.HALL_VIGOR_PCT, C.HALL_EDGE_PCT, C.HALL_POCKETS_SLOTS]);
  assert.deepEqual(v3d.price, {});
  for (const m of Object.values(C.META_HERO)) for (let r = 1; r <= m.ranks; r++) assert.equal(priceOf('v3d', m.id, r), m.costs[r - 1], `${m.id} ${r}`);
  // the LH1 report's v3d (section 10): v3c effects, Vigor / Edge II 130, Second Breath 200, Pockets 50 for +8, Stormhawk 90
  assert.deepEqual([v3d.vigor, v3d.edge, v3d.slots], [HALL_ARMS.v3c.vigor, HALL_ARMS.v3c.edge, HALL_ARMS.v3c.slots]);
  assert.deepEqual(['vigor', 'edge', 'second_breath', 'pockets', 'stormhawk'].map((id) => C.META_HERO[id].costs), [[70, 130], [70, 130], [200], [50], [90]]);
});

test('hall specs: the whole hall, a stage, the class techniques, no techniques', () => {
  assert.equal(parseHall('v3').arm, 'v3');
  assert.deepEqual(hallUnlocks('v3:vigor1,tech2', 'rogue'), { vigor: 1, sp_r1: 1, sp_r2: 1 });
  assert.equal(hallUnlocks('v2', 'mage').sp_m2, 1);
  assert.equal(hallUnlocks('v2', 'mage').sp_r1, undefined);
  assert.equal(hallUnlocks('v2', 'mage').stormhawk, undefined);
  assert.equal(hallUnlocks('v2', 'hunter').stormhawk, 1);
  assert.equal(hallUnlocks('v3-nt', 'mage').sp_m1, undefined);
  assert.equal(hallUnlocks('v3-nt', 'mage').vigor, 2);
  assert.deepEqual(hallUnlocks('none', 'mage'), {});
  assert.throws(() => parseHall('v9'));
  assert.throws(() => parseHall('v3:nonsense1'));
});

test('a hero cell with a hall arm plays that arm\'s effects, and one without it plays the engine\'s', () => {
  setGates(GATES);
  const v2 = metaAfter(cell('v2'));
  assert.equal(v2.hpPct, 0.02);
  assert.equal(v2.powerPct, 0.02);
  assert.equal(v2.bagSlots, 4);
  const v3 = metaAfter(cell('v3'));
  assert.ok(Math.abs(v3.hpPct - 0.08) < 1e-9 && Math.abs(v3.powerPct - 0.06) < 1e-9);
  assert.equal(v3.bagSlots, 8);
  const fb = metaAfter(cell('v3fb'));
  assert.ok(Math.abs(fb.hpPct - 0.07) < 1e-9 && Math.abs(fb.powerPct - 0.05) < 1e-9);
  const r1 = metaAfter(cell('v3:vigor1,edge1'));
  assert.ok(Math.abs(r1.hpPct - 0.05) < 1e-9 && Math.abs(r1.powerPct - 0.04) < 1e-9);
  const d = metaAfter(cell('v3d'));
  assert.ok(Math.abs(d.hpPct - 0.04) < 1e-9 && Math.abs(d.powerPct - 0.03) < 1e-9);
  assert.equal(d.bagSlots, 8);
  const none = metaAfter(cell(null));
  assert.equal(none.hpPct, 0);
  assert.deepEqual(C.META_HERO.vigor.hpPct, C.HALL_VIGOR_PCT, 'a cell without an arm resets the table to the engine\'s');
  assert.equal(C.META_HERO.pockets.slots, C.HALL_POCKETS_SLOTS);
  assert.ok(cellProfile(cell('v2')).reachedBoss, 'Second Breath needs Oruvath reached once');
  applyHall(null);
});
