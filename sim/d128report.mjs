#!/usr/bin/env node
// Tables of the D128 / D130 re-measure (the lean start camp; report docs/reports/balance-2026-11-12d.md) from the cells of
// sim/measure-d128.sh (IN: exp/ = the engine as built, ref/ = the engine just before D128, 61052ac) paired by class and
// seed with report 2026-11-12c (C12: sim/out/pass-v15/exp, its -noswift cells = the D126 engine with Mawgrim at 1.0; same
// tables and seeds; the 700-per-class speedrunner cell is cut to the seeds measured here). Prints Markdown.
//
//   node sim/d128report.mjs [--in sim/out/pass-d128] [--c12 sim/out/pass-v15] > tables.md
import { existsSync } from 'node:fs';
import { readJsonl } from './lib/output.mjs';
import { runLength, contractMetrics } from './lib/metrics.mjs';
import { combatMinutes, pairedDiff } from './lib/combatchecks.mjs';
import { rate, median } from './lib/stats.mjs';
import { BAL, EXP, C2 } from './lib/params.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const I = args.in || 'sim/out/pass-d128';
const CC = args.c12 || 'sim/out/pass-v15';
const CL = ['rogue', 'mage', 'hunter'];
const recs = (d) => (d && existsSync(`${d}/runs-${CL[0]}.jsonl`) ? CL.flatMap((c) => readJsonl(`${d}/runs-${c}.jsonl`)) : null);
const ok = (r) => !r.err;
const P = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : `${(x * 100).toFixed(d)} %`);
const N = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : Number(x).toFixed(d));
const PP = (d) => (!d || d.v === null ? 'n/a' : `${d.v >= 0 ? '+' : ''}${(d.v * 100).toFixed(1)} pp (${(d.ci[0] * 100).toFixed(1)} - ${(d.ci[1] * 100).toFixed(1)}; n ${d.n})`);
const DN = (d, k = 2) => (!d || d.v === null ? 'n/a' : `${d.v >= 0 ? '+' : ''}${d.v.toFixed(k)} (${d.ci[0].toFixed(k)} - ${d.ci[1].toFixed(k)}; n ${d.n})`);
const RT = (r) => (r && r.n ? `${P(r.p)} (${r.k} / ${r.n})` : 'n/a');

const cells = {
  now: { p0: 'exp/planner-P0-exp-prep', pall: 'exp/planner-PALL-exp-prep', speed: 'exp/speedrunner-PALL-v11-exp-prep', none: 'exp/planner-P0-exp-prepnone', random: 'exp/planner-P0-exp-preprandom', greedy: 'exp/greedy-P0-exp-prep', novis: 'exp/planner-PALL-exp-prep-banchartstracker-dropscoucartoldh' },
  ref: { p0: 'ref/planner-P0-exp-prep', pall: 'ref/planner-PALL-exp-prep', speed: 'ref/speedrunner-PALL-v11-exp-prep', none: 'ref/planner-P0-exp-prepnone', random: 'ref/planner-P0-exp-preprandom', greedy: 'ref/greedy-P0-exp-prep' },
  c12: { p0: 'exp/planner-P0-exp-prep-noswift', pall: 'exp/planner-PALL-exp-prep-noswift', speed: 'exp/speedrunner-PALL-v11-exp-prep-noswift' },
};
const R = {};
for (const [arm, list] of Object.entries(cells)) { R[arm] = {}; for (const [k, d] of Object.entries(list)) R[arm][k] = recs(`${arm === 'c12' ? CC : I}/${d}`); }
// 12c's speedrunner cell ran 700 per class: keep the seeds measured here, so every column holds the same runs.
const seedsOf = (rs) => new Set((rs || []).map((r) => `${r.cls}|${r.seed}`));
for (const k of Object.keys(R.c12)) if (R.c12[k] && R.now[k]) { const s = seedsOf(R.now[k]); R.c12[k] = R.c12[k].filter((r) => s.has(`${r.cls}|${r.seed}`)); }

const travel = (rs, z) => median(rs.filter((r) => ok(r) && r.travelLv && r.travelLv.length >= z).map((r) => r.travelLv[z - 1]));
const taken = (r) => (r.ct ? r.ct.c.length : 0);
const completed = (r) => (r.ct ? r.ct.c.filter((k) => k[3] === 'c').length : 0);
function row(rs) {
  if (!rs || !rs.length) return null;
  const x = rs.filter(ok);
  const l = runLength(x, combatMinutes);
  const c = contractMetrics(x);
  const reach = x.filter((r) => r.rb && r.boss);
  const wins = x.filter((r) => r.out === 'v');
  const kind = (k) => (c.byKind[k] ? c.byKind[k] : null);
  const zone = (zs) => { const l2 = []; for (const r of x) for (const k of r.ct ? r.ct.c : []) if (zs.includes(k[0]) && k[3] !== 'a') l2.push(k); return rate(l2.filter((k) => k[3] === 'c').length, l2.length); };
  return {
    n: x.length, errors: rs.length - x.length, win: rate(wins.length, x.length), reach: rate(x.filter((r) => r.rb).length, x.length),
    winGivenReach: rate(wins.length, x.filter((r) => r.rb).length),
    b11: l.manualReach.v, b12: l.autoWinsSetOut ? l.autoWinsSetOut.v : null, b12start: l.autoWins.v, wins: wins.length, b53: l.combatReach.v,
    b20: [1, 2, 3, 4, 5, 6].map((z) => travel(x, z)),
    b39: c.completion, b46: c.xpShare, takenPerRun: c.perRun, hubPerRun: c.hubPerRun, donePerRun: x.reduce((a, r) => a + completed(r), 0) / x.length,
    abandoned: c.abandoned / x.length, delve: kind('delve'), cull: kind('cull'), bounty: kind('bounty'), z13: zone([1, 2, 3]), z46: zone([4, 5, 6]),
    bought: c.bought, reserve: c.reserve, ilvl: reach.length ? reach.reduce((a, r) => a + r.boss.ilvl, 0) / reach.length : null,
    dungeons: x.reduce((a, r) => a + (r.dungeons || 0), 0) / x.length,
  };
}
const T = {};
for (const arm of Object.keys(R)) { T[arm] = {}; for (const k of Object.keys(R[arm])) T[arm][k] = row(R[arm][k]); }
const pd = (a, b, f = (r) => (r.out === 'v' ? 1 : 0)) => (a && b ? pairedDiff(a, b, f) : null);
const reachF = (r) => (r.rb ? 1 : 0);
const out = [];
const line = (s = '') => out.push(s);
const tbl = (head, rows) => { line(`| ${head.join(' | ')} |`); line(`|${head.map(() => '---').join('|')}|`); for (const r of rows) line(`| ${r.join(' | ')} |`); line(); };

// ---------------- Win rates, criterion 2, B10 ----------------
line('### Win rates (flip criterion 2: planner P0 >= 20 %, PALL >= 50 %, 900 runs each) and reach');
line();
const ARMS = [['now', 'lean camp (as built)'], ['ref', 'camp before D128 (61052ac)'], ['c12', 'report 12c, same seeds (-noswift)']];
const winRows = [];
for (const [k, label] of [['p0', 'planner P0'], ['pall', 'planner PALL'], ['speed', 'speedrunner v11 PALL'], ['greedy', 'greedy P0'], ['none', 'planner P0, prep none'], ['random', 'planner P0, prep random'], ['novis', 'planner PALL, no vision (B42)']]) {
  const t = (a) => (T[a][k] ? `${RT(T[a][k].win)}; reach ${P(T[a][k].reach.p)}` : '-');
  winRows.push([label, t('now'), t('ref'), t('c12'), R.now[k] && R.ref[k] ? PP(pd(R.now[k], R.ref[k])) : '-', R.now[k] && R.c12[k] ? PP(pd(R.now[k], R.c12[k])) : '-', R.now[k] && R.c12[k] ? PP(pd(R.now[k], R.c12[k], reachF)) : '-']);
}
tbl(['Cell', ...ARMS.map((a) => a[1]), 'win, now - before D128 (paired)', 'win, now - 12c (paired)', 'reach, now - 12c (paired)'], winRows);
for (const k of ['p0', 'pall', 'speed']) {
  if (!R.now[k]) continue;
  line(`- ${k} by class, now / before D128 / 12c: ${CL.map((c) => { const f = (a) => (R[a][k] ? RT(rate(R[a][k].filter((r) => ok(r) && r.cls === c && r.out === 'v').length, R[a][k].filter((r) => ok(r) && r.cls === c).length)) : 'n/a'); return `${c} ${f('now')} / ${f('ref')} / ${f('c12')}`; }).join('; ')}.`);
}
if (R.ref.p0 && R.c12.p0) line(`- Before D128 against 12c (Mawgrim hpMult 0.95 on the expedition, D126; same sim, same seeds): P0 win ${PP(pd(R.ref.p0, R.c12.p0))}, reach ${PP(pd(R.ref.p0, R.c12.p0, reachF))}; PALL win ${PP(pd(R.ref.pall, R.c12.pall))}, reach ${PP(pd(R.ref.pall, R.c12.pall, reachF))}.`);
for (const a of ['now', 'ref', 'c12']) if (T[a].p0 && T[a].pall) line(`- B10 (PALL - P0 win, ${BAL.META_GAP_MIN_PP * 100}-${BAL.META_GAP_MAX_PP * 100} pp), ${a}: ${N((T[a].pall.win.p - T[a].p0.win.p) * 100)} pp.`);
line();

// ---------------- Flip rows and contract rows ----------------
line('### Flip and contract rows (B11, B12, B20, B39, B46, B53; contracts per run)');
line();
const v = (a, k, f) => (T[a][k] ? f(T[a][k]) : '-');
const rowsM = [
  ['B39 completion, planner P0 (45-65 %)', (a) => v(a, 'p0', (t) => RT(t.b39))],
  ['B39 completion, planner PALL (65-85 %)', (a) => v(a, 'pall', (t) => RT(t.b39))],
  ['B39 completion, greedy P0 (>= 8 pp under P0)', (a) => v(a, 'greedy', (t) => `${RT(t.b39)}${T[a].p0 ? `; ${N((T[a].p0.b39.p - t.b39.p) * 100)} pp under` : ''}`)],
  ['B39 Delve / Cull / Bounty, planner P0', (a) => v(a, 'p0', (t) => [t.delve, t.cull, t.bounty].map((x) => (x ? `${P(x.p)} (${x.taken})` : '-')).join(' / '))],
  ['B39 zones 1-3 / 4-6, planner P0', (a) => v(a, 'p0', (t) => `${RT(t.z13)} / ${RT(t.z46)}`)],
  ['Contracts taken / completed per run, planner P0', (a) => v(a, 'p0', (t) => `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)} (hub ${N(t.hubPerRun, 2)}; swapped away ${N(t.abandoned, 2)})`)],
  ['Contracts taken / completed per run, planner PALL', (a) => v(a, 'pall', (t) => `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)} (hub ${N(t.hubPerRun, 2)}; swapped away ${N(t.abandoned, 2)})`)],
  ['Contracts taken / completed per run, greedy P0', (a) => v(a, 'greedy', (t) => `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)} (hub ${N(t.hubPerRun, 2)})`)],
  ['Contracts taken / completed per run, speedrunner', (a) => v(a, 'speed', (t) => `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)} (hub ${N(t.hubPerRun, 2)})`)],
  ['Contracts taken / completed per run, prep random', (a) => v(a, 'random', (t) => `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)} (hub ${N(t.hubPerRun, 2)})`)],
  ['Contracts taken / completed per run, prep none (hub only)', (a) => v(a, 'none', (t) => `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)}`)],
  ['B46 contract XP share, planner P0 (8-20 %)', (a) => v(a, 'p0', (t) => P(t.b46))],
  ['B46 contract XP share, planner PALL', (a) => v(a, 'pall', (t) => P(t.b46))],
  ['B20 level leaving Z1..Z6, planner P0 (10z ± 1)', (a) => v(a, 'p0', (t) => t.b20.map((x) => N(x, 0)).join(', '))],
  ['B11 minutes, planner P0 reach (40-50)', (a) => v(a, 'p0', (t) => N(t.b11))],
  ['B53 combat minutes, planner P0 reach (<= 21)', (a) => v(a, 'p0', (t) => N(t.b53))],
  [`B12 speedrunner wins, from SET_OUT (<= 30; >= ${EXP.B12_MIN_WINS} wins to read)`, (a) => v(a, 'speed', (t) => `${N(t.b12)} (${t.wins} wins); from run start ${N(t.b12start)}${T[a].p0 ? ` = ${N(t.b12start / T[a].p0.b11, 3)} × B11` : ''}`)],
  ['Boss ilvl (reach) P0 / PALL', (a) => `${v(a, 'p0', (t) => N(t.ilvl))} / ${v(a, 'pall', (t) => N(t.ilvl))}`],
  ['Dungeons per run P0 / PALL', (a) => `${v(a, 'p0', (t) => N(t.dungeons, 2))} / ${v(a, 'pall', (t) => N(t.dungeons, 2))}`],
  ['Reserve left per run P0 / PALL', (a) => `${v(a, 'p0', (t) => N(t.reserve, 2))} / ${v(a, 'pall', (t) => N(t.reserve, 2))}`],
];
tbl(['Row', ...ARMS.map((a) => a[1])], rowsM.map(([label, f]) => [label, ...ARMS.map(([a]) => f(a))]));
const pairRows = [];
for (const [k, label] of [['p0', 'planner P0'], ['pall', 'planner PALL'], ['speed', 'speedrunner v11 PALL'], ['greedy', 'greedy P0'], ['random', 'prep random']]) {
  if (!R.now[k]) continue;
  pairRows.push([label, DN(pd(R.now[k], R.ref[k], taken)), DN(pd(R.now[k], R.ref[k], completed)), DN(pd(R.now[k], R.c12[k], taken)), DN(pd(R.now[k], R.c12[k], completed))]);
}
const lvF = (z) => (r) => (r.travelLv && r.travelLv.length >= z ? r.travelLv[z - 1] : null);
const pdN = (a, b, f) => { if (!a || !b) return null; const g = (r) => f(r); const A = a.filter((r) => g(r) !== null); const B = b.filter((r) => g(r) !== null); const keys = new Set(B.map((r) => `${r.cls}|${r.seed}`)); return pairedDiff(A.filter((r) => keys.has(`${r.cls}|${r.seed}`)), B, g); };
const meanLv = (rs, z) => { const xs = (rs || []).filter((r) => ok(r) && r.travelLv && r.travelLv.length >= z).map((r) => r.travelLv[z - 1]); return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null; };
line('B20, mean level leaving each zone, planner P0 (now / before D128 / 12c; paired now - before D128, runs that left the zone in both):');
line();
tbl(['Zone', 'band', 'now', 'before D128', '12c', 'now - before D128', 'now - 12c'], [1, 2, 3, 4, 5, 6].map((z) => [`Z${z}`, `${10 * z - BAL.ZONE_LVL_SLACK}-${10 * z + BAL.ZONE_LVL_SLACK}`, N(meanLv(R.now.p0, z), 2), N(meanLv(R.ref.p0, z), 2), N(meanLv(R.c12.p0, z), 2), DN(pdN(R.now.p0, R.ref.p0, lvF(z))), DN(pdN(R.now.p0, R.c12.p0, lvF(z)))]));
const ilF = (r) => (r.rb && r.boss ? r.boss.ilvl : null);
for (const k of ['p0', 'pall']) line(`- Boss ilvl, ${k}, paired (runs at the boss in both): now - before D128 ${DN(pdN(R.now[k], R.ref[k], ilF))}; now - 12c ${DN(pdN(R.now[k], R.c12[k], ilF))}.`);
line();
line('Contracts per run, paired by class and seed:');
line();
tbl(['Cell', 'taken, now - before D128', 'completed, now - before D128', 'taken, now - 12c', 'completed, now - 12c'], pairRows);
line('Camp purchases (share of runs), now / before D128:');
line();
for (const k of ['p0', 'pall', 'speed', 'greedy', 'random', 'novis']) {
  if (!T.now[k]) continue;
  const f = (t) => (t ? Object.entries(t.bought).map(([id, s]) => `${id.replace('prep_', '')} ${P(s, 0)}`).join(', ') || 'none' : '-');
  line(`- ${k}: ${f(T.now[k])} / ${f(T.ref[k])}`);
}
line();

// ---------------- B40, B42 ----------------
line('### B40 (plan value) and B42 (vision value)');
line();
const b40 = (a) => (R[a].p0 && R[a].none && R[a].random ? [PP(pd(R[a].p0, R[a].none)), PP(pd(R[a].p0, R[a].random))] : ['-', '-']);
tbl(['Arm', `B40 planned - none (>= +${EXP.PLAN_GAIN_MIN * 100} pp)`, `B40 planned - random (>= +${EXP.PLAN_VS_RANDOM_MIN * 100} pp)`], [['lean camp (as built)', ...b40('now')], ['camp before D128', ...b40('ref')]]);
if (T.now.pall && T.now.novis) {
  const a = T.now.pall.b39; const b = T.now.novis.b39;
  const d = a.p - b.p; const se = Math.sqrt((a.p * (1 - a.p)) / a.n + (b.p * (1 - b.p)) / b.n);
  line(`- B42 completion (>= ${EXP.VISION_COMPLETION_MIN * 100} pp; no-vision cell: --meta-drop ${EXP.B42_VISION_ENTRIES.join(',')} --prep-ban ${EXP.B42_VISION_PERKS.map((x) => x.replace('prep_', '')).join(',')}): PALL ${RT(a)} against ${RT(b)}: **${d >= 0 ? '+' : ''}${N(d * 100)} pp** (${N((d - 1.96 * se) * 100)} - ${N((d + 1.96 * se) * 100)}, by contract, unpaired); win, paired: ${PP(pd(R.now.pall, R.now.novis))}; contracts taken per run ${N(T.now.pall.takenPerRun, 2)} against ${N(T.now.novis.takenPerRun, 2)}.`);
  line('- B42 last measured: report 2026-11-11g, +11.9 pp (69.9 % against 58.0 %, 150 per class; the no-vision cell also without the Local Guide and the Spyglass); win +5.1 pp (-0.8 - 11.0).');
}
line();
console.log(out.join('\n'));
