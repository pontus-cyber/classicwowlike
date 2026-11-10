// Heat targets (docs/specs/expedition.md H.6: B55-B57 of section H) from run records of planner P0 cells: the default
// planner, heat-seek and heat-avoid (sim/bots/planner.mjs variants) and the planner on an engine without the H.3
// rewards (a scratch copy). Pure functions of the records (out, seed, cls, ht); used by sim/combatreport.mjs. The
// IDs B55-B57 of section H collide with combat-v2.md's B55, so rows carry the id 'B55h' and the metric says "heat".
// [assumption: approximation] heat-seek and heat-avoid differ from the planner only in the hour weight: the value
// function does not yet price the heat rewards (H.6), so B55h measures the hour-weight styles on today's rewards.
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

/** Rows { id, pri, metric, value, target, ok, note } for B55h, B56, B57 from cells { planner, seek, avoid, noHeat }. */
export function heatChecks({ planner, seek, avoid, noHeat }) {
  const rows = [];
  const add = (id, pri, metric, value, target, okv, note = '') => rows.push({ id, pri, metric, value, target, ok: okv, note });
  if (seek && avoid) {
    const d = pairedDiff(seek, avoid, win);
    const s = heatCell(seek);
    const a = heatCell(avoid);
    add('B55h', 'P1', `Heat is a real option (heat, expedition.md H.6): win rate heat-seek minus heat-avoid, planner P0, paired (seek ${pct(s.win.p)}, reach ${pct(s.reach.p)}, ${num(s.hours, 0)} h at the boss; avoid ${pct(a.win.p)}, reach ${pct(a.reach.p)}, ${num(a.hours, 0)} h)`,
      dc(d), `within +-${HEAT.HEAT_POLICY_GAP_MAX} pp`, d.v === null ? null : Math.abs(d.v) <= pp(HEAT.HEAT_POLICY_GAP_MAX), 'hour-weight approximation: the value function does not price heat rewards yet');
  }
  if (planner) {
    const wins = planner.filter((r) => ok(r) && r.out === 'v' && r.ht);
    const r = rate(wins.filter(hotRun).length, wins.length);
    add('B56', 'P2', 'Heat is used, not forced (heat): share of winning planner P0 runs with at least one Hot or Scorched node', r.n ? `${pct(r.p)} (${pct(r.ci[0])} - ${pct(r.ci[1])}; n=${r.n})` : 'n/a',
      `${pct(HEAT.HEAT_WIN_SHARE[0], 0)} - ${pct(HEAT.HEAT_WIN_SHARE[1], 0)}`, r.n ? r.p >= HEAT.HEAT_WIN_SHARE[0] && r.p <= HEAT.HEAT_WIN_SHARE[1] : null);
  }
  if (planner && noHeat) {
    const d = pairedDiff(planner, noHeat, win);
    add('B57', 'P2', `Heat rewards do not inflate power (heat): planner P0 win rate with H.3 minus without, paired (with ${pct(heatCell(planner).win.p)}, without ${pct(heatCell(noHeat).win.p)})`,
      dc(d), `<= +${HEAT.HEAT_POWER_MAX} pp`, d.v === null ? null : d.v <= pp(HEAT.HEAT_POWER_MAX), 'without = scratch engine with HEAT_GAIN and HEAT_RARITY_UP 0');
  }
  return rows;
}
