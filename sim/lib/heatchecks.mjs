// Heat targets (docs/specs/expedition.md H.6: B58, B56, B57; B58 was B55 of section H before D61) from run records of
// planner P0 cells: the default planner, heat-seek and heat-avoid (sim/bots/planner.mjs variants: the value function
// prices the heat rewards and the boss term, 2026-11-11) and the planner on an engine without the H.3 rewards (a
// scratch copy). Pure functions of the records (out, seed, cls, ht, rb, hb, asc); used by sim/combatreport.mjs,
// sim/heatreport.mjs and sim/report.mjs.
// B56 (M2b v6, D63, docs/specs/changes-m2b-v6.md row 4): (a) heat-seek minus planner win rate, paired, >= -HEAT_POLICY_GAP_MAX
// pp; (b) share of heat-seek's winning runs with a Hot or Scorched node inside HEAT_WIN_SHARE; B56 passes when both
// pass. The old B56 (the default planner's winning runs with a Hot node) is a diagnostic row without a target.
import { HEAT } from './params.mjs';
import { pairedDiff } from './combatchecks.mjs';
import { rate, median } from './stats.mjs';
import { pct, num } from './output.mjs';

const ok = (r) => r.out !== 'x';
const win = (r) => (r.out === 'v' ? 1 : 0);
const pp = (x) => x / 100;
/** The run entered at least one node in a Hot or Scorched state (recorder ht = nodes per state). */
export const hotRun = (r) => !!(r.ht && r.ht[2] + r.ht[3] > 0);
const dc = (d) => (d && d.v !== null ? `${d.v >= 0 ? '+' : ''}${num(d.v * 100, 1)} pp (${num(d.ci[0] * 100, 1)} - ${num(d.ci[1] * 100, 1)}; n=${d.n})` : 'n/a');
const rc = (r) => (r.n ? `${pct(r.p)} (${pct(r.ci[0])} - ${pct(r.ci[1])}; n=${r.n})` : 'n/a');

/** Summary of a heat cell: { n, win, reach, hotRuns (share of runs with a Hot or Scorched node), hours (median at the boss), asc (median) }. */
export function heatCell(records) {
  const x = records.filter(ok);
  const boss = x.filter((r) => r.rb && typeof r.hb === 'number');
  return {
    n: x.length,
    win: rate(x.filter((r) => r.out === 'v').length, x.length),
    reach: rate(x.filter((r) => r.rb).length, x.length),
    hotRuns: rate(x.filter(hotRun).length, x.filter((r) => r.ht).length),
    hours: boss.length ? median(boss.map((r) => r.hb)) : null,
    asc: boss.length ? median(boss.map((r) => r.asc || 0)) : null,
  };
}

/** Share of a cell's winning runs (with heat fields) that entered a Hot or Scorched node: rate { k, n, p, ci }. */
export function hotWinShare(records) {
  const wins = records.filter((r) => ok(r) && r.out === 'v' && r.ht);
  return rate(wins.filter(hotRun).length, wins.length);
}

/** B56 (M2b v6) from heat-seek and planner records: { a: paired seek - planner, b: seek's hot win share, okA, okB, ok }. */
export function b56Parts(seek, planner) {
  const a = pairedDiff(seek, planner, win);
  const b = hotWinShare(seek);
  const okA = a.v === null ? null : a.v >= -pp(HEAT.HEAT_POLICY_GAP_MAX);
  const okB = b.n ? b.p >= HEAT.HEAT_WIN_SHARE[0] && b.p <= HEAT.HEAT_WIN_SHARE[1] : null;
  return { a, b, okA, okB, ok: okA === null || okB === null ? null : okA && okB };
}

/** Rows { id, pri, metric, value, target, ok, note } for B58, B56 (and its diagnostic), B57 from cells { planner, seek, avoid, noHeat }. */
export function heatChecks({ planner, seek, avoid, noHeat }) {
  const rows = [];
  const add = (id, pri, metric, value, target, okv, note = '') => rows.push({ id, pri, metric, value, target, ok: okv, note });
  if (seek && avoid) {
    const d = pairedDiff(seek, avoid, win);
    const s = heatCell(seek);
    const a = heatCell(avoid);
    add('B58', 'P1', `Heat is a real option (heat, expedition.md H.6): win rate heat-seek minus heat-avoid, planner P0, paired (seek ${pct(s.win.p)}, reach ${pct(s.reach.p)}, ${num(s.hours, 0)} tolls at the boss; avoid ${pct(a.win.p)}, reach ${pct(a.reach.p)}, ${num(a.hours, 0)} tolls)`,
      dc(d), `within +-${HEAT.HEAT_POLICY_GAP_MAX} pp`, d.v === null ? null : Math.abs(d.v) <= pp(HEAT.HEAT_POLICY_GAP_MAX));
  }
  if (seek && planner) {
    const x = b56Parts(seek, planner);
    const s = heatCell(seek);
    const p = heatCell(planner);
    add('B56', 'P2', `Heat is used, not forced (heat, M2b v6): (a) win rate heat-seek minus planner, planner P0, paired (seek ${pct(s.win.p)}, planner ${pct(p.win.p)}); (b) share of heat-seek's winning P0 runs with at least one Hot or Scorched node; passes when both pass (a ${x.okA === null ? 'n/a' : x.okA ? 'pass' : 'fail'}, b ${x.okB === null ? 'n/a' : x.okB ? 'pass' : 'fail'})`,
      `(a) ${dc(x.a)}; (b) ${rc(x.b)}`, `(a) >= -${HEAT.HEAT_POLICY_GAP_MAX} pp; (b) ${pct(HEAT.HEAT_WIN_SHARE[0], 0)} - ${pct(HEAT.HEAT_WIN_SHARE[1], 0)}`, x.ok);
  }
  if (planner) {
    const r = hotWinShare(planner);
    add('B56', 'diag', 'Old B56 (diagnostic, no target since M2b v6): share of winning default-planner P0 runs with at least one Hot or Scorched node', rc(r), '', null);
  }
  if (planner && noHeat) {
    const d = pairedDiff(planner, noHeat, win);
    add('B57', 'P2', `Heat rewards do not inflate power (heat): planner P0 win rate with H.3 minus without, paired (with ${pct(heatCell(planner).win.p)}, without ${pct(heatCell(noHeat).win.p)})`,
      dc(d), `<= +${HEAT.HEAT_POWER_MAX} pp`, d.v === null ? null : d.v <= pp(HEAT.HEAT_POWER_MAX), 'without = scratch engine with HEAT_GAIN and HEAT_RARITY_UP 0');
  }
  return rows;
}
