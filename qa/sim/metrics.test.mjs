// Metrics on a tiny fixed sample match hand-checked values (balance.md 3, sim/lib/metrics.mjs).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cellMetrics, deathStage, tensionPerZone, timeBudget } from '../../sim/lib/metrics.mjs';
import { wilson, median, quantile, medianDiff } from '../../sim/lib/stats.mjs';
import { campaignMetrics, campaignMetricsByClass } from '../../sim/lib/campaignreport.mjs';
import { BAL } from '../../sim/lib/params.mjs';
import { FK } from '../../sim/lib/recorder.mjs';

// Five runs, written by hand. Fights (M2 v3 format): [kind, rounds, outcome (1 won, 0 lost, 2 fled), HP % at the end,
// zone (7 = Camp / end boss), lowest HP during the fight in per mille, potions used].
const base = { min: [0, 0], nodes: 0, fights: 0, hb: null, asc: null, bp: 0, bhp: null, rests: 0, potions: 0, ech: 0, echFirst: 0, travelLv: [], train: [], boss: null, steps: 10, ms: 1, zone: 1, fx: [], res: 0 };
const RUNS = [
  // 1: win. Boss reached with level 60, ilvl 58, 6/10 rare slots, Ember bought; 45 min manual / 30 autoplay.
  { ...base, seed: 1, out: 'v', rb: 1, lvl: 60, hb: 150, asc: 0.08, bp: 3, min: [45, 30], nodes: 48, fights: 66, rests: 8, potions: 12, ech: 540, echFirst: 100, dungeons: 1,
    travelLv: [10, 20, 30, 40, 50, 60], train: [1, 1, 0], boss: { lvl: 60, ilvl: 58, rare: 0.6, empty: 0, ember: 1 },
    fx: [[FK.quest, 5, 1, 50, 1, 400, 0], [FK.elite, 8, 1, 15, 3, 150, 1], [FK.dboss, 10, 1, 40, 4, 300, 1], [FK.boss, 40, 1, 30, 7, 200, 2]], death: null },
  // 2: boss loss in phase 2 at round 30; level 59.
  { ...base, seed: 2, out: 'd', rb: 1, lvl: 59, hb: 170, asc: 0.12, bp: 2, bhp: 0.5, min: [55, 35], nodes: 50, fights: 70, rests: 10, potions: 16, ech: 300,
    travelLv: [10, 20, 30, 39, 49, 59], train: [1, 0], boss: { lvl: 59, ilvl: 52, rare: 0.3, empty: 1, ember: 0 },
    fx: [[FK.quest, 3, 1, 10, 2, 100, 1], [FK.grind, 6, 1, 90, 5, 900, 0], [FK.boss, 30, 0, 0, 7, 0, 3]], death: { z: 7, type: 'boss', round: 30, ab: 'shard_hit' } },
  // 3: boss loss to Final Dark (round 50, phase 3).
  { ...base, seed: 3, out: 'd', rb: 1, lvl: 60, hb: 160, asc: 0.12, bp: 3, bhp: 0.2, min: [50, 33], nodes: 46, fights: 60, rests: 6, potions: 8, ech: 320,
    travelLv: [10, 21, 31, 41, 51, 60], train: [1], boss: { lvl: 60, ilvl: 55, rare: 0.5, empty: 0, ember: 0 },
    fx: [[FK.treasure, 4, 1, 60, 6, 600, 0], [FK.boss, 50, 0, 0, 7, 0, 2]], death: { z: 7, type: 'boss', round: 50, ab: 'final_dark' } },
  // 4: died in a Z2 dungeon.
  { ...base, seed: 4, out: 'd', rb: 0, lvl: 15, min: [12, 9], ech: 60, travelLv: [10], train: [0],
    fx: [[FK.quest, 7, 1, 30, 1, 300, 0], [FK.trash, 6, 0, 0, 2, 0, 1]], death: { z: 2, type: 'dungeon', round: 6, ab: 'strike' } },
  // 5: died in a Z4 quest; one fled fight.
  { ...base, seed: 5, out: 'd', rb: 0, lvl: 33, min: [25, 18], ech: 150, travelLv: [10, 20, 30],
    fx: [[FK.quest, 2, 2, 70, 3, 700, 0], [FK.quest, 9, 0, 0, 4, 0, 1]], death: { z: 4, type: 'quest', round: 9, ab: 'bolt' } },
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
    // B21 (M2 v3): stage bands as a share of all runs, the boss band as a share of deaths.
    assert.equal(m.deathStageRuns.early.k, 1); assert.equal(m.deathStageRuns.early.n, 5);
    assert.equal(m.deathStageRuns.mid.p, 0.2);
    assert.equal(m.deathStageRuns.late.p, 0);
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
    // won non-boss fights: 5r50, 8r15, 10r40, 3r10, 6r90, 4r60, 7r30 -> ending below 20 %: 15 and 10 -> 2/7
    assert.equal(m.closeFightsEnd.k, 2); assert.equal(m.closeFightsEnd.n, 7);
    // B24 (M2 v3): lowest HP below CLOSE_FIGHT_HP (350 per mille): 400, 150, 300, 100, 900, 600, 300 -> 4/7
    assert.equal(m.closeFights.k, 4); assert.equal(m.closeFights.n, 7);
  });

  test('B38 tension: mean lowest HP in won non-boss fights per zone (fled and lost fights excluded)', () => {
    const t = m.tension;
    // Z1: 400, 300 -> 0.35; Z2: 100; Z3: 150 (the fled Z3 quest is excluded); Z4: 300; Z5: 900; Z6: 600
    assert.deepEqual(t.zones.map((z) => z.n), [2, 1, 1, 1, 1, 1]);
    assert.deepEqual(t.zones.map((z) => Math.round(z.v * 1000)), [350, 100, 150, 300, 900, 600]);
    assert.ok(Math.abs(t.spread - 0.8) < 1e-12); // Z2-Z5: 0.90 - 0.10
    assert.equal(t.z6, 0.6);
    // A zone without won fights: no spread.
    assert.equal(tensionPerZone([RUNS[3]]).spread, null);
    // Records written before M2 v3 (4-field fights) give no B24 and no B38 data.
    const old = RUNS.map((r) => ({ ...r, fx: r.fx.map((f) => f.slice(0, 4)) }));
    const mo = cellMetrics(old, { enrageRound: 50 });
    assert.equal(mo.closeFights.n, 0);
    assert.equal(mo.tension.spread, null);
    assert.equal(mo.closeFightsEnd.k, 2);
  });

  test('resources, Echoes and trainer affordability', () => {
    assert.equal(m.rests.v, 8); // runs at boss: 8, 10, 6
    assert.equal(m.potions.v, 12);
    assert.equal(m.echoes.v, 274); // (540 + 300 + 320 + 60 + 150) / 5
    assert.equal(m.echoesWin.v, 540);
    assert.equal(m.echoesWinNoFirst.v, 440);
    assert.equal(m.trainAfford.k, 4); assert.equal(m.trainAfford.n, 7); // 1,1,0 + 1,0 + 1 + 0
    assert.equal(m.dungeons.v, 0.2); // one dungeon cleared in five runs (records without the field count 0)
    assert.equal(m.dungeonsBoss.v, 1 / 3);
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
  // Every block counted (the pre-M2 v4 dip definition).
  const m = campaignMetrics(camps, { minBlockRuns: 0 });
  test('runs to catalogue, censoring and win rates by block', () => {
    assert.equal(m.completed, 2);
    assert.equal(m.censored, 1);
    assert.equal(m.medianRuns, 5); // 3, 5, >max -> middle = 5
    assert.equal(m.minRuns, 3);
    assert.equal(m.wr1to5.k, 6); assert.equal(m.wr1to5.n, 13); // wins in runs 1-5: 2 + 1 + 3
    assert.equal(m.blocks[0].p, 6 / 13);
    assert.equal(m.blocks[1].p, 0); // run 6 of campaign 2 only
    assert.ok(Math.abs(m.maxDip - 6 / 13) < 1e-12);
    assert.equal(m.maxDipAll, m.maxDip);
  });

  test('B32 dip (M2 v4): blocks under CURVE_BLOCK_MIN_RUNS runs are listed but left out of the dip', () => {
    assert.equal(BAL.CURVE_BLOCK_MIN_RUNS, 50);
    const d = campaignMetrics(camps); // 13 and 1 runs: neither block counts
    assert.deepEqual(d.blocks.map((b) => [b.runs, b.n, b.counted]), [['1-5', 13, false], ['6-10', 1, false]]);
    assert.equal(d.maxDip, 0);
    assert.ok(Math.abs(d.maxDipAll - 6 / 13) < 1e-12);
    const t = campaignMetrics(camps, { minBlockRuns: 13 }); // the 13-run block counts, the 1-run block does not
    assert.deepEqual(t.countedBlocks, ['1-5']);
    assert.equal(t.maxDip, 0);
    // 50 copies of the sample: blocks of 650 and 50 runs both count, so the 1-5 -> 6-10 drop is a dip.
    const big = Array.from({ length: 50 }, () => camps).flat();
    const b = campaignMetrics(big);
    assert.deepEqual(b.blocks.map((x) => x.n), [650, 50]);
    assert.deepEqual(b.countedBlocks, ['1-5', '6-10']);
    assert.ok(Math.abs(b.maxDip - 6 / 13) < 1e-12);
  });

  test('B32 dip: per-class metrics count the blocks the pooled sample counts', () => {
    // Class a: 40 campaigns of 6 runs (block 6-10 has 40 runs); class b: 20 of 6 runs. Pooled block 6-10: 60 runs.
    const six = (w6) => ({ complete: null, runs: [run(1, 'v'), run(2, 'v'), run(3, 'v'), run(4, 'v'), run(5, 'v'), run(6, w6)] });
    const byClass = { a: Array.from({ length: 40 }, () => six('d')), b: Array.from({ length: 20 }, () => six('v')) };
    const { all, per } = campaignMetricsByClass(byClass);
    assert.deepEqual(all.countedBlocks, ['1-5', '6-10']);
    assert.ok(Math.abs(all.maxDip - 40 / 60) < 1e-12); // 100 % -> 33 %
    assert.deepEqual(per.a.countedBlocks, ['1-5', '6-10']); // 40 runs alone would not count
    assert.equal(per.a.maxDip, 1);
    assert.equal(per.b.maxDip, 0);
    assert.equal(campaignMetrics(byClass.a).maxDip, 0, 'on its own, class a has no counted 6-10 block');
  });
});

describe('B17 time budget (M2 v4, hand-checked)', () => {
  const r = (hb, extra = {}) => ({ out: 'd', rb: 1, hb, ...extra });
  test('P0 median hours at the boss minus PALL median, runs that reach the boss only', () => {
    const p0 = [r(138), r(140), r(141), r(null, { rb: 0 }), r(150, { out: 'x' })];
    const pall = [r(134), r(137), r(139), r(null, { rb: 0 })];
    const t = timeBudget(p0, pall);
    assert.equal(t.p0, 140);
    assert.equal(t.pall, 137);
    assert.equal(t.v, 3);
    assert.equal(t.na, 3); assert.equal(t.nb, 3);
    assert.ok(t.ci[0] <= t.v && t.v <= t.ci[1], JSON.stringify(t.ci));
    assert.equal(timeBudget([], pall).v, null);
  });
  test('medianDiff interval: two fixed samples, a fixed result', () => {
    const a = Array.from({ length: 500 }, (_, i) => 130 + ((i * 7919) % 23));
    const b = Array.from({ length: 400 }, (_, i) => 125 + ((i * 104729) % 19));
    const d = medianDiff(a, b);
    assert.equal(d.v, median(a) - median(b));
    assert.deepEqual(medianDiff(a, b).ci, d.ci, 'fixed seeds');
    assert.ok(d.ci[0] <= d.v && d.v <= d.ci[1]);
  });
});
