// Metrics on a tiny fixed sample match hand-checked values (balance.md 3, sim/lib/metrics.mjs).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cellMetrics, deathStage } from '../../sim/lib/metrics.mjs';
import { wilson, median, quantile } from '../../sim/lib/stats.mjs';
import { campaignMetrics } from '../../sim/lib/campaignreport.mjs';
import { FK } from '../../sim/lib/recorder.mjs';

// Five runs, written by hand. Fights: [kind, rounds, outcome (1 won, 0 lost, 2 fled), HP % at the end].
const base = { min: [0, 0], nodes: 0, fights: 0, hb: null, asc: null, bp: 0, bhp: null, rests: 0, potions: 0, ech: 0, echFirst: 0, travelLv: [], train: [], boss: null, steps: 10, ms: 1, zone: 1, fx: [], res: 0 };
const RUNS = [
  // 1: win. Boss reached with level 60, ilvl 58, 6/10 rare slots, Ember bought; 45 min manual / 30 autoplay.
  { ...base, seed: 1, out: 'v', rb: 1, lvl: 60, hb: 150, asc: 0.08, bp: 3, min: [45, 30], nodes: 48, fights: 66, rests: 8, potions: 12, ech: 540, echFirst: 100,
    travelLv: [10, 20, 30, 40, 50, 60], train: [1, 1, 0], boss: { lvl: 60, ilvl: 58, rare: 0.6, empty: 0, ember: 1 },
    fx: [[FK.quest, 5, 1, 50], [FK.elite, 8, 1, 15], [FK.dboss, 10, 1, 40], [FK.boss, 40, 1, 30]], death: null },
  // 2: boss loss in phase 2 at round 30; level 59.
  { ...base, seed: 2, out: 'd', rb: 1, lvl: 59, hb: 170, asc: 0.12, bp: 2, bhp: 0.5, min: [55, 35], nodes: 50, fights: 70, rests: 10, potions: 16, ech: 300,
    travelLv: [10, 20, 30, 39, 49, 59], train: [1, 0], boss: { lvl: 59, ilvl: 52, rare: 0.3, empty: 1, ember: 0 },
    fx: [[FK.quest, 3, 1, 10], [FK.grind, 6, 1, 90], [FK.boss, 30, 0, 0]], death: { z: 7, type: 'boss', round: 30, ab: 'shard_hit' } },
  // 3: boss loss to Final Dark (round 50, phase 3).
  { ...base, seed: 3, out: 'd', rb: 1, lvl: 60, hb: 160, asc: 0.12, bp: 3, bhp: 0.2, min: [50, 33], nodes: 46, fights: 60, rests: 6, potions: 8, ech: 320,
    travelLv: [10, 21, 31, 41, 51, 60], train: [1], boss: { lvl: 60, ilvl: 55, rare: 0.5, empty: 0, ember: 0 },
    fx: [[FK.treasure, 4, 1, 60], [FK.boss, 50, 0, 0]], death: { z: 7, type: 'boss', round: 50, ab: 'final_dark' } },
  // 4: died in a Z2 dungeon.
  { ...base, seed: 4, out: 'd', rb: 0, lvl: 15, min: [12, 9], ech: 60, travelLv: [10], train: [0],
    fx: [[FK.quest, 7, 1, 30], [FK.trash, 6, 0, 0]], death: { z: 2, type: 'dungeon', round: 6, ab: 'strike' } },
  // 5: died in a Z4 quest; one fled fight.
  { ...base, seed: 5, out: 'd', rb: 0, lvl: 33, min: [25, 18], ech: 150, travelLv: [10, 20, 30],
    fx: [[FK.quest, 2, 2, 70], [FK.quest, 9, 0, 0]], death: { z: 4, type: 'quest', round: 9, ab: 'bolt' } },
];

describe('cell metrics on a fixed sample (hand-checked)', () => {
  const m = cellMetrics(RUNS, { enrageRound: 50, timeProfile: 'manual' });

  test('win and reach-boss rates with Wilson intervals', () => {
    assert.equal(m.win.k, 1); assert.equal(m.win.n, 5); assert.equal(m.win.p, 0.2);
    assert.equal(m.boss.k, 3); assert.equal(m.boss.p, 0.6);
    assert.equal(m.bossWin.p, 1 / 3);
    // Wilson 95 % for 1/5: centre (0.2 + 1.9208/5)/(1 + 3.8416/5) = 0.3302..., half 0.2852...
    assert.ok(Math.abs(m.win.ci[0] - 0.0362) < 1e-3 && Math.abs(m.win.ci[1] - 0.6245) < 1e-3, JSON.stringify(m.win.ci));
  });

  test('pacing and character at the boss', () => {
    assert.equal(m.minutesBoss.v, 50); // runs at boss: 45, 55, 50
    assert.equal(m.minutesWinManual.v, 45);
    assert.equal(m.minutesWinAuto.v, 30);
    assert.equal(m.hoursBoss.v, 160);
    assert.equal(m.ascBoss.v, 0.12);
    assert.equal(m.nodesBoss.v, 48);
    assert.equal(m.fightsBoss.v, 66);
    assert.equal(m.lvl60.k, 2); assert.equal(m.lvl60.n, 3);
    assert.ok(Math.abs(m.ilvlBoss.v - 55) < 1e-9); // (58 + 52 + 55) / 3
    assert.ok(Math.abs(m.rareShareBoss.v - 1.4 / 3) < 1e-9);
    assert.equal(m.emberBuy.k, 1); assert.equal(m.emberBuy.n, 3);
  });

  test('level when leaving each zone', () => {
    assert.equal(m.travelLv[0].v, 10); // five runs left Z1 at 10
    assert.equal(m.travelLv[3].v, 40); // 40, 39, 41
    assert.equal(m.travelLv[3].n, 3);
  });

  test('deaths by stage, node type, boss phase and Final Dark', () => {
    assert.equal(m.deathStage.early.k, 1); // Z2 dungeon
    assert.equal(m.deathStage.mid.k, 1); // Z4 quest
    assert.equal(m.deathStage.late.k, 0);
    assert.equal(m.deathStage.boss.k, 2);
    assert.equal(m.deathStage.boss.n, 4);
    assert.deepEqual(Object.keys(m.deathType).sort(), ['dungeon', 'quest']);
    assert.equal(m.deathType.dungeon.p, 0.5);
    assert.equal(m.bossLossPhase['2'].k, 1);
    assert.equal(m.bossLossPhase.enrage.k, 1); // round 50 >= BOSS_ENRAGE_ROUND
    assert.equal(m.finalDarkLoss.p, 0.5);
    assert.equal(deathStage({ z: 6, type: 'camp' }), 'late');
  });

  test('fight rounds by kind (won fights) and close fights', () => {
    assert.equal(m.rounds.normal.v, 5); // won quest/grind/treasure fights: 5, 3, 6, 4, 7 -> median 5
    assert.equal(m.rounds.elite.v, 8);
    assert.equal(m.rounds.dboss.v, 10);
    assert.equal(m.rounds.boss.v, 40);
    // won non-boss fights: 5r50, 8r15, 10r40, 3r10, 6r90, 4r60, 7r30 -> below 20 %: 15 and 10 -> 2/7
    assert.equal(m.closeFights.k, 2); assert.equal(m.closeFights.n, 7);
  });

  test('resources, Echoes and trainer affordability', () => {
    assert.equal(m.rests.v, 8); // runs at boss: 8, 10, 6
    assert.equal(m.potions.v, 12);
    assert.equal(m.echoes.v, 274); // (540 + 300 + 320 + 60 + 150) / 5
    assert.equal(m.echoesWin.v, 540);
    assert.equal(m.echoesWinNoFirst.v, 440);
    assert.equal(m.trainAfford.k, 4); assert.equal(m.trainAfford.n, 7); // 1,1,0 + 1,0 + 1 + 0
  });

  test('stats helpers', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
    assert.equal(quantile([0, 10], 0.1), 1);
    assert.deepEqual(wilson(0, 0), [null, null]);
  });
});

describe('campaign metrics (hand-checked)', () => {
  const run = (k, out) => ({ k, out, ech: 100, owned: k });
  const camps = [
    { complete: 3, runs: [run(1, 'd'), run(2, 'v'), run(3, 'v')] },
    { complete: null, runs: [run(1, 'd'), run(2, 'd'), run(3, 'd'), run(4, 'd'), run(5, 'v'), run(6, 'd')] },
    { complete: 5, runs: [run(1, 'v'), run(2, 'd'), run(3, 'd'), run(4, 'v'), run(5, 'v')] },
  ];
  const m = campaignMetrics(camps);
  test('runs to catalogue, censoring and win rates by block', () => {
    assert.equal(m.completed, 2);
    assert.equal(m.censored, 1);
    assert.equal(m.medianRuns, 5); // 3, 5, >max -> middle = 5
    assert.equal(m.minRuns, 3);
    assert.equal(m.wr1to5.k, 6); assert.equal(m.wr1to5.n, 13); // wins in runs 1-5: 2 + 1 + 3
    assert.equal(m.blocks[0].p, 6 / 13);
    assert.equal(m.blocks[1].p, 0); // run 6 of campaign 2 only
    assert.ok(Math.abs(m.maxDip - 6 / 13) < 1e-12);
  });
});
