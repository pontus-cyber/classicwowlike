#!/usr/bin/env node
// Flip rows of the M2b v13 measure (changes-m2b-v10.md "Criteria to flip"; report docs/reports/balance-2026-11-12.md):
// B11, B12, B39-B43, B53, planner P0 / PALL on the expedition with the start camp, from the cells of sim/measure-v13.sh
// (IN: exp/, cal/, clock0/), paired by class and seed with the v12 pass (V12: sim/out/pass-v12, the 11-11h flip cells; same
// tables and seeds). Adapted from the 11-11h scratch script (sim/out/pass-v12/v12tables.mjs). Prints JSON.
//
//   node sim/v13flip.mjs [--in sim/out/pass-v13] [--v12 sim/out/pass-v12] > flip.json
import { existsSync, readdirSync } from 'node:fs';
import { readJsonl } from './lib/output.mjs';
import { expMetrics, runLength, contractMetrics } from './lib/metrics.mjs';
import { combatMinutes, pairedDiff } from './lib/combatchecks.mjs';
import { rate, median } from './lib/stats.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const O = args.in || 'sim/out/pass-v13';
const G = args.v12 || 'sim/out/pass-v12';
const X = `${O}/exp`;
const GX = `${G}/exp`;
const CL = ['rogue', 'mage', 'hunter'];
const recs = (d, cl = CL) => (d && existsSync(`${d}/runs-${cl[0]}.jsonl`) ? cl.flatMap((c) => readJsonl(`${d}/runs-${c}.jsonl`)) : null);
const firstDir = (dir, re) => { if (!existsSync(dir)) return null; const n = readdirSync(dir).find((x) => re.test(x)); return n ? `${dir}/${n}` : null; };
const r3 = (x) => { if (x && typeof x === 'object') x = x.v; return x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 1000) / 1000; };
const ok = (r) => !r.err;
const win = (rs) => { const w = rs.filter(ok); return rate(w.filter((r) => r.out === 'v').length, w.length); };
const byCls = (rs, f) => Object.fromEntries(CL.map((c) => [c, f(rs.filter((r) => r.cls === c))]));
const pd = (a, b, f = (r) => (r.out === 'v' ? 1 : 0)) => { const d = pairedDiff(a, b, f); return { v: r3(d.v), ci: d.ci.map(r3), n: d.n }; };

function cellRows(rs) {
  if (!rs || !rs.length) return null;
  const e = expMetrics(rs);
  const l = runLength(rs, combatMinutes);
  const c = contractMetrics(rs);
  const reach = rs.filter((r) => ok(r) && r.rb && r.boss);
  const wins = rs.filter((r) => ok(r) && r.out === 'v');
  const deaths = {};
  for (const r of rs) if (ok(r) && r.death) deaths[r.death.type] = (deaths[r.death.type] || 0) + 1;
  const crs = rs.filter((r) => r.xs && r.xs.cr);
  const dm = { n: [0, 0, 0], d: [0, 0, 0], esc: [0, 0], fight: [0, 0], perRun: 0 };
  let dmN = 0;
  for (const r of rs) for (const x of r.dm || []) { const b = Math.min(2, x[0]); dm.n[b]++; dm.d[b] += x[1]; const k = x[4] === 1 ? 'esc' : 'fight'; dm[k][0]++; dm[k][1] += x[1]; dmN++; }
  dm.perRun = r3(dmN / rs.length);
  const avg = (a, f) => (a.length ? r3(a.reduce((x, r) => x + f(r), 0) / a.length) : null);
  const tollsPerZone = (() => { let t = 0; let n = 0; for (const r of wins) for (const z of (r.ex ? r.ex.zones : [])) { t += z[1]; n++; } return n ? r3(t / n) : null; })();
  return {
    runs: rs.length, errors: rs.filter((r) => r.err).length,
    win: win(rs), winByCls: byCls(rs, (x) => r3(win(x).p)), reach: r3(l.reach.p),
    b11: l.manualReach.v, b12auto: l.autoWins.v, b12SetOut: l.autoWinsSetOut ? l.autoWinsSetOut.v : null, b12ci: l.autoWinsSetOut ? l.autoWinsSetOut.ci : null,
    nWins: l.win.k, winsByCls: byCls(wins, (x) => x.length), b53: l.combatReach.v,
    nodesWin: avg(wins, (r) => r.nodes), fightsWin: avg(wins, (r) => r.fights), nodesReach: l.nodesReach.v, tollsPerZoneWin: tollsPerZone,
    gear: reach.length ? { ilvl: r3(reach.reduce((a, r) => a + r.boss.ilvl, 0) / reach.length), rare: r3(reach.reduce((a, r) => a + r.boss.rare, 0) / reach.length) } : null,
    caught: e.caught, dimShare: e.dimDeathShare, closeCalls: e.closeCalls, walks: r3(e.walksPerZone), passes: r3(e.passesPerZone),
    bells: r3(e.bellsPerRun), cStep: e.cStep,
    cRoute: crs.length ? rate(crs.reduce((a, r) => a + r.xs.cr[0], 0), crs.reduce((a, r) => a + r.xs.cr[1], 0)) : null,
    completion: c.completion, xpShare: r3(c.xpShare), deaths, dim: dm,
    dungeonsPerRun: r3(rs.filter(ok).reduce((a, r) => a + (r.dungeons || 0), 0) / rs.filter(ok).length),
    bossWinGivenReach: r3(rs.filter((r) => ok(r) && r.rb).length ? wins.length / rs.filter((r) => ok(r) && r.rb).length : null),
  };
}

const out = { cells: {} };
const R = {};
const put = (k, rs) => { R[k] = rs; out.cells[k] = cellRows(rs); };
put('p0', recs(`${X}/planner-P0-exp-prep`));
put('pall', recs(`${X}/planner-PALL-exp-prep`));
put('speed', recs(`${X}/speedrunner-PALL-exp-prep`));
put('speedV11', recs(firstDir(X, /^speedrunner-PALL-v11-exp-prep$/)));
put('greedy', recs(`${X}/greedy-P0-exp-prep`));
put('none', recs(`${X}/planner-P0-exp-prepnone`));
put('random', recs(`${X}/planner-P0-exp-preprandom`));
put('oracleP0', recs(`${X}/planner-P0-exp-prep-oracle-route`));
put('oraclePALL', recs(`${X}/planner-PALL-exp-prep-oracle-route`));
put('clock0P0', recs(`${O}/clock0/planner-P0-exp-prep`));
put('clock0PALL', recs(`${O}/clock0/planner-PALL-exp-prep`));
// Speedrunner calibration arms (cal/<arm>/...): level prices and the v11 policy.
if (existsSync(`${O}/cal`)) for (const a of readdirSync(`${O}/cal`)) put(`cal_${a}`, recs(firstDir(`${O}/cal/${a}`, /^speedrunner-PALL/)));
// v12 pass (11-11h) cells: same tables and seeds.
put('v12_p0', recs(`${GX}/planner-P0-exp-prep`));
put('v12_pall', recs(`${GX}/planner-PALL-exp-prep-rcg`));
put('v12_speed', recs(`${GX}/speedrunner-PALL-exp-prep-rcg`));
put('v12_speedV11', recs(`${GX}/speedrunner-PALL-v11-exp-prep-rcg`));
put('v12_greedy', recs(`${GX}/greedy-P0-exp-prep`));
const P = (a, b, f) => (R[a] && R[b] ? pd(R[a], R[b], f) : null);
out.b40none = P('p0', 'none'); out.b40random = P('p0', 'random');
out.vsV12 = { p0: P('p0', 'v12_p0'), pall: P('pall', 'v12_pall'), p0reach: P('p0', 'v12_p0', (r) => r.rb), pallReach: P('pall', 'v12_pall', (r) => r.rb), greedy: P('greedy', 'v12_greedy') };
out.clock = { p0: P('p0', 'clock0P0'), pall: P('pall', 'clock0PALL') };
out.cal = {};
for (const k of Object.keys(R)) if (k.startsWith('cal_') && R.cal_v11) out.cal[k] = { vsV11: P(k, 'cal_v11') };
out.speedVsV11 = P('speed', 'cal_v11');
const same = (a, b) => { if (!a || !b) return null; const B = new Map(b.map((r) => [`${r.cls}|${r.seed}`, r])); let s = 0; let d = 0; const k = (x) => JSON.stringify([x.out, x.lvl, x.nodes, x.fights, x.rounds, x.death, x.min]); for (const r of a) { const o = B.get(`${r.cls}|${r.seed}`); if (!o) continue; if (k(r) === k(o)) s++; else d++; } return { same: s, diff: d }; };
out.oracleIdentity = { p0: same(R.oracleP0, R.p0), pall: same(R.oraclePALL, R.pall) };
for (const k of ['p0', 'pall']) if (R[k]) { const w = byCls(R[k], (x) => win(x).p); const v = Object.values(w); out[`b6_${k}`] = { spread: r3(Math.max(...v) - Math.min(...v)) }; }
console.log(JSON.stringify(out, null, 1));
