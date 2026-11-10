// Metrics of one cell (class × bot × profile [× variant]) from run records (balance.md 3). Pure functions of
// the records, so a fixed sample gives fixed numbers (qa/sim/metrics.test.mjs checks them by hand).
import { C } from './engine.mjs';
import { BAL } from './params.mjs';
import { FIGHT_KINDS } from './recorder.mjs';
import { rate, med, avg, quantile, medianDiff } from './stats.mjs';

const FK = Object.fromEntries(FIGHT_KINDS.map((k, i) => [k, i]));
/** Fight groups for B16: normal encounters are Quest, Grind and Treasure fights of normal mobs (rules 2). */
export const ROUND_GROUPS = { normal: [FK.quest, FK.grind, FK.treasure], elite: [FK.elite], trash: [FK.trash], dboss: [FK.dboss], camp: [FK.camp], boss: [FK.boss] };

/** Death stage (B21): Z1-Z2 early, Z3-Z4 mid, Z5-Z6 and Camp waves late, the end boss. */
export function deathStage(d) {
  if (!d) return null;
  if (d.type === 'boss') return 'boss';
  if (d.type === 'camp' || d.z >= 5) return 'late';
  if (d.z >= 3) return 'mid';
  return 'early';
}

/** Boss loss phase (B23): 1, 2, 3, or 'enrage' (died at or after BOSS_ENRAGE_ROUND, Final Dark active). */
export function bossLossPhase(r, enrageRound) {
  if (r.death && r.death.round >= enrageRound) return 'enrage';
  return String(r.bp);
}

/**
 * Won non-boss fights of a record with the M2 v3 fight fields (zone, lowest HP): [zone, lowest HP fraction].
 * Records written before M2 v3 (4-field fights) give none.
 */
export function wonFightLows(r) {
  const out = [];
  for (const f of r.fx) if (f[2] === 1 && f[0] !== FK.boss && f.length >= 6) out.push([f[4], f[5] / 1000]);
  return out;
}

/**
 * B38 (M2 v3): mean lowest HP in won non-boss fights per zone 1..ZONE_COUNT; spread = max - min over Z2-Z5.
 * Returns { zones: [{ z, v, n }], spread, z6 }.
 */
export function tensionPerZone(records) {
  const sum = new Array(C.ZONE_COUNT + 2).fill(0);
  const cnt = new Array(C.ZONE_COUNT + 2).fill(0);
  for (const r of records) for (const [z, low] of wonFightLows(r)) { sum[z] += low; cnt[z] += 1; }
  const zones = [];
  for (let z = 1; z <= C.ZONE_COUNT; z++) zones.push({ z, v: cnt[z] ? sum[z] / cnt[z] : null, n: cnt[z] });
  const mid = zones.filter((x) => x.z >= 2 && x.z <= 5 && x.v !== null).map((x) => x.v);
  return { zones, spread: mid.length === 4 ? Math.max(...mid) - Math.min(...mid) : null, z6: zones[5] ? zones[5].v : null };
}

/**
 * B17 time budget (M2 v4, rules 11.2): median hours at the boss of the P0 records minus that of the PALL records
 * (runs that reach the boss; all classes pooled by the caller), with a bootstrap 95 % interval.
 * Returns { v, ci, p0, pall, na, nb } (p0 / pall: the two medians).
 */
export function timeBudget(p0, pall) {
  const hb = (rs) => rs.filter((r) => r.out !== 'x' && r.rb && r.hb !== null && r.hb !== undefined).map((r) => r.hb);
  const a = hb(p0);
  const b = hb(pall);
  return { ...medianDiff(a, b), p0: a.length ? quantile(a, 0.5) : null, pall: b.length ? quantile(b, 0.5) : null };
}

export function cellMetrics(records, { enrageRound = C.BOSS_ENRAGE_ROUND, timeProfile = 'manual' } = {}) {
  const n = records.length;
  const ok = records.filter((r) => r.out !== 'x');
  const wins = ok.filter((r) => r.out === 'v');
  const boss = ok.filter((r) => r.rb);
  const deaths = ok.filter((r) => r.out === 'd');
  const minIdx = timeProfile === 'autoplay' ? 1 : 0;
  const m = {
    n, errors: n - ok.length, errorSamples: records.filter((r) => r.err).slice(0, 3).map((r) => `seed ${r.seed}: ${r.err}`),
    win: rate(wins.length, n), boss: rate(boss.length, n),
    bossWin: rate(wins.length, boss.length),
  };
  // Pacing (B11-B14, B17)
  m.minutesBoss = med(boss.map((r) => r.min[minIdx]));
  m.minutesBossManual = med(boss.map((r) => r.min[0]));
  m.minutesWin = med(wins.map((r) => r.min[minIdx]));
  m.minutesWinManual = med(wins.map((r) => r.min[0]));
  m.minutesWinAuto = med(wins.map((r) => r.min[1]));
  m.minutesWinAutoP10 = wins.length ? quantile(wins.map((r) => r.min[1]), 0.1) : null;
  m.minutesAll = med(ok.map((r) => r.min[minIdx]));
  m.nodesBoss = med(boss.map((r) => r.nodes));
  m.fightsBoss = med(boss.map((r) => r.fights));
  m.hoursBoss = med(boss.map((r) => r.hb));
  m.ascBoss = med(boss.map((r) => r.asc));
  // Character at the boss (B18, B19)
  m.lvl60 = rate(boss.filter((r) => r.boss && r.boss.lvl >= 60).length, boss.length);
  m.lvlBoss = med(boss.map((r) => (r.boss ? r.boss.lvl : r.lvl)));
  m.ilvlBoss = avg(boss.filter((r) => r.boss).map((r) => r.boss.ilvl));
  m.rareShareBoss = avg(boss.filter((r) => r.boss).map((r) => r.boss.rare));
  m.emptySlotsBoss = avg(boss.filter((r) => r.boss).map((r) => r.boss.empty));
  // Level when leaving each zone (B20)
  m.travelLv = [];
  for (let z = 1; z <= 6; z++) m.travelLv.push(med(ok.filter((r) => r.travelLv.length >= z).map((r) => r.travelLv[z - 1])));
  // Deaths (B21-B23, B29)
  const stage = { early: 0, mid: 0, late: 0, boss: 0 };
  for (const r of deaths) stage[deathStage(r.death)] += 1;
  // Share of deaths (the pre-M2 v3 B21 definition; still the B21 boss band) and share of all runs (M2 v3 stage bands).
  m.deathStage = Object.fromEntries(Object.entries(stage).map(([k, v]) => [k, rate(v, deaths.length)]));
  m.deathStageRuns = Object.fromEntries(Object.entries(stage).map(([k, v]) => [k, rate(v, ok.length)]));
  const nb = deaths.filter((r) => r.death.type !== 'boss');
  const types = {};
  for (const r of nb) types[r.death.type] = (types[r.death.type] || 0) + 1;
  m.deathType = Object.fromEntries(Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, rate(v, nb.length)]));
  const bossLosses = deaths.filter((r) => r.death.type === 'boss');
  const ph = { 1: 0, 2: 0, 3: 0, enrage: 0 };
  for (const r of bossLosses) ph[bossLossPhase(r, enrageRound)] += 1;
  m.bossLossPhase = Object.fromEntries(Object.entries(ph).map(([k, v]) => [k, rate(v, bossLosses.length)]));
  m.finalDarkLoss = rate(bossLosses.filter((r) => r.death.ab === 'final_dark').length, bossLosses.length);
  m.bossHpLeft = med(bossLosses.map((r) => r.bhp));
  // Fights (B16, B24)
  const rounds = {};
  for (const [g, kinds] of Object.entries(ROUND_GROUPS)) {
    const xs = [];
    for (const r of ok) for (const f of r.fx) if (f[2] === 1 && kinds.includes(f[0])) xs.push(f[1]);
    rounds[g] = med(xs);
  }
  m.rounds = rounds;
  // B24 (M2 v3): won non-boss fights whose lowest HP fell below CLOSE_FIGHT_HP; closeFightsEnd: the pre-M2 v3
  // reading (HP at the fight's end below 20 %), kept for comparison.
  let won = 0;
  let closeEnd = 0;
  let wonLow = 0;
  let close = 0;
  const lim = Math.round(BAL.CLOSE_FIGHT_HP * 1000);
  for (const r of ok) {
    for (const f of r.fx) {
      if (f[2] !== 1 || f[0] === FK.boss) continue;
      won++;
      if (f[3] < 20) closeEnd++;
      if (f.length >= 6) { wonLow++; if (f[5] < lim) close++; }
    }
  }
  m.closeFights = rate(close, wonLow);
  m.closeFightsEnd = rate(closeEnd, won);
  m.tension = tensionPerZone(ok);
  // Resources (B25), economy (B30, B33, B34)
  m.rests = avg(boss.map((r) => r.rests));
  m.potions = avg(boss.map((r) => r.potions));
  m.restsAll = avg(ok.map((r) => r.rests));
  m.potionsAll = avg(ok.map((r) => r.potions));
  // Dungeons cleared (engine stat; B22 context, M2 v4 problem 5).
  m.dungeons = avg(ok.map((r) => r.dungeons || 0));
  m.dungeonsBoss = avg(boss.map((r) => r.dungeons || 0));
  m.echoes = avg(ok.map((r) => r.ech));
  m.echoesWin = avg(wins.map((r) => r.ech));
  m.echoesWinNoFirst = avg(wins.map((r) => r.ech - r.echFirst));
  let tv = 0;
  let tc = 0;
  for (const r of ok) for (const c of r.train) { tv++; tc += c; }
  m.trainAfford = rate(tc, tv);
  m.emberBuy = rate(boss.filter((r) => r.boss && r.boss.ember).length, boss.length);
  // Engine health and cost
  m.steps = avg(ok.map((r) => r.steps));
  m.msPerRun = avg(records.map((r) => r.ms));
  m.zoneReached = avg(ok.map((r) => r.zone));
  return m;
}
