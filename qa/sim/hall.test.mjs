// Hall arms (sim/lib/hall.mjs; D164, legacy-hall-v3-draft.md 2, 3, 5, 7): the v2 arm is the engine's hall as built, the v3
// arm moves only Vigor, Edge, Pockets and prices, a hero cell with an arm owns its hall, and a cell without one resets the
// effect fields (a worker plays runs of several cells).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../../sim/lib/engine.mjs';
import { runWithBot, cellProfile, setGates } from '../../sim/lib/runner.mjs';
import { HALL_ARMS, BUY_ORDER, priceOf, parseHall, hallUnlocks, applyHall } from '../../sim/lib/hall.mjs';

const GATES = { ...Object.fromEntries(Object.entries(C.GATES).filter(([, on]) => on)), legacy: true, oruvathLegacy: true, economyV2: true };
const cell = (hall, cls = 'mage') => ({ bot: 'planner', cls, prof: 'later', tree: 0, map: 'expedition', prep: true, hero: 10, gates: GATES, ...(hall ? { hall } : {}) });
const metaAfter = (c) => runWithBot(c, 9001, null, { maxActions: 2 }).state.meta;

test('the v2 arm is the engine hall as built; the account wing + techniques cost 1 640 (v2) and 1 540 (v3)', () => {
  assert.deepEqual(HALL_ARMS.v2.vigor, [0.01, 0.01]);
  assert.equal(HALL_ARMS.v2.slots, 4);
  const sum = (arm) => BUY_ORDER.reduce((s, [id, r]) => s + priceOf(arm, id, r), 0);
  assert.equal(sum('v2'), 1640);
  assert.equal(sum('v3'), 1540);
  assert.equal(sum('v3fb'), 1540);
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
  const none = metaAfter(cell(null));
  assert.equal(none.hpPct, 0);
  assert.equal(C.META_HERO.vigor.hpPct, 0.01, 'a cell without an arm resets the table');
  assert.equal(C.META_HERO.pockets.slots, 4);
  assert.ok(cellProfile(cell('v2')).reachedBoss, 'Second Breath needs Oruvath reached once');
  applyHall(null);
});
