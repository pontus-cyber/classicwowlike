#!/usr/bin/env node
// Tables of the D132 re-measure (the camp board across the run; report docs/reports/balance-2026-11-13.md) from the cells
// of sim/measure-d132.sh, paired by class and seed: IN/exp = the engine as built (GATES.boardAcrossRun on); OFF = the
// board-off arm (the D128 board): the lean-camp cells of report 2026-11-12d (sim/out/pass-d128/exp), run for run the same
// as this engine with the switch off (stage H, sim/samerecords.mjs), or IN/off after stage O; REF = the camp before D128
// (sim/out/pass-d128/ref, engine 61052ac). Autoplay's camp (stage A): IN/exp and IN/apz6 planner-P0-exp-prepauto
// (AUTO_PREP_ZONES 3 as built / 6). Prints Markdown.
//
//   node sim/d132report.mjs [--in sim/out/pass-d132] [--off sim/out/pass-d128/exp] [--ref sim/out/pass-d128/ref] > tables.md
import { existsSync } from 'node:fs';
import { readJsonl } from './lib/output.mjs';
import { runLength, contractMetrics } from './lib/metrics.mjs';
import { combatMinutes, pairedDiff } from './lib/combatchecks.mjs';
import { rate, median } from './lib/stats.mjs';
import { BAL, EXP } from './lib/params.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const I = args.in || 'sim/out/pass-d132';
const OFF = args.off || 'sim/out/pass-d128/exp';
const REF = args.ref || 'sim/out/pass-d128/ref';
const CL = ['rogue', 'mage', 'hunter'];
const recs = (d) => (d && existsSync(`${d}/runs-${CL[0]}.jsonl`) ? CL.flatMap((c) => readJsonl(`${d}/runs-${c}.jsonl`)) : null);
const ok = (r) => !r.err;
const P = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : `${(x * 100).toFixed(d)} %`);
const N = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : Number(x).toFixed(d));
const PP = (d) => (!d || d.v === null ? 'n/a' : `${d.v >= 0 ? '+' : ''}${(d.v * 100).toFixed(1)} pp (${(d.ci[0] * 100).toFixed(1)} - ${(d.ci[1] * 100).toFixed(1)}; n ${d.n})`);
const DN = (d, k = 2) => (!d || d.v === null ? 'n/a' : `${d.v >= 0 ? '+' : ''}${d.v.toFixed(k)} (${d.ci[0].toFixed(k)} - ${d.ci[1].toFixed(k)}; n ${d.n})`);
const RT = (r) => (r && r.n ? `${P(r.p)} (${r.k} / ${r.n})` : 'n/a');

const name = { p0: 'planner-P0-exp-prep', pall: 'planner-PALL-exp-prep', speed: 'speedrunner-PALL-v11-exp-prep', none: 'planner-P0-exp-prepnone', random: 'planner-P0-exp-preprandom', greedy: 'greedy-P0-exp-prep', novis: 'planner-PALL-exp-prep-banchartstracker-dropscoucartoldh' };
// The off arm: IN/off cells carry the '-noba' mark (stage O); the 12d cells name no gates.
const offName = (k) => (existsSync(`${OFF}/${name[k]}-noba`) ? `${name[k]}-noba` : name[k]);
const R = { now: {}, off: {}, ref: {} };
for (const k of Object.keys(name)) {
  R.now[k] = recs(`${I}/exp/${name[k]}`);
  R.off[k] = k === 'novis' ? null : recs(`${OFF}/${offName(k)}`);
  R.ref[k] = k === 'novis' ? null : recs(`${REF}/${name[k]}`);
}
const AUTO = { a3: recs(`${I}/exp/planner-P0-exp-prepauto`), a6: recs(`${I}/apz6/planner-P0-exp-prepauto`) };
// Every column holds the runs measured here (the off and ref speedrunner cells ran 700 per class as well).
const keysOf = (rs) => new Set((rs || []).map((r) => `${r.cls}|${r.seed}`));
for (const a of ['off', 'ref']) for (const k of Object.keys(R[a])) if (R[a][k] && R.now[k]) { const s = keysOf(R.now[k]); R[a][k] = R[a][k].filter((r) => s.has(`${r.cls}|${r.seed}`)); }

const travel = (rs, z) => median(rs.filter((r) => ok(r) && r.travelLv && r.travelLv.length >= z).map((r) => r.travelLv[z - 1]));
const cs = (r) => (r.ct ? r.ct.c : []);
const taken = (r) => cs(r).length;
const completed = (r) => cs(r).filter((k) => k[3] === 'c').length;
const BANDS = [[1, 2], [3, 4], [5, 6]];
const inB = (b) => (k) => k[0] >= b[0] && k[0] <= b[1];
const boardIn = (b) => (r) => cs(r).filter((k) => k[2] !== 'h' && inB(b)(k)).length;
const boardDoneIn = (b) => (r) => cs(r).filter((k) => k[2] !== 'h' && inB(b)(k) && k[3] === 'c').length;
const lateTaken = (r) => cs(r).filter((k) => k[0] >= 4).length;
const lateDone = (r) => cs(r).filter((k) => k[0] >= 4 && k[3] === 'c').length;
const xpC = (r) => (r.ct ? r.ct.xpC : 0);
// B46 (contract XP share = sum of contract XP / sum of XP) with a 95 % run-level bootstrap interval (fixed LCG stream);
// paired: the same resampled (class, seed) keys in both arms, so the interval is that of the paired difference.
function b46Boot(a, b = null, nBoot = 2000) {
  const keyed = (rs) => new Map(rs.filter((r) => ok(r) && r.ct).map((r) => [`${r.cls}|${r.seed}`, [r.ct.xpC, r.ct.xp]]));
  const A = keyed(a); const B = b ? keyed(b) : null;
  const keys = [...A.keys()].filter((k) => !B || B.has(k));
  const share = (m, ks) => { let c = 0; let t = 0; for (const k of ks) { const [x, y] = m.get(k); c += x; t += y; } return t ? c / t : 0; };
  const stat = (ks) => share(A, ks) - (B ? share(B, ks) : 0);
  let s = 12345;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const xs = [];
  for (let i = 0; i < nBoot; i++) xs.push(stat(keys.map(() => keys[Math.floor(rnd() * keys.length)])));
  xs.sort((p, q) => p - q);
  return { v: stat(keys), ci: [xs[Math.floor(0.025 * nBoot)], xs[Math.floor(0.975 * nBoot)]], n: keys.length };
}
function row(rs) {
  if (!rs || !rs.length) return null;
  const x = rs.filter(ok);
  const l = runLength(x, combatMinutes);
  const c = contractMetrics(x);
  const reach = x.filter((r) => r.rb && r.boss);
  const wins = x.filter((r) => r.out === 'v');
  const kind = (k) => (c.byKind[k] ? c.byKind[k] : null);
  const zone = (zs) => { const l2 = []; for (const r of x) for (const k of cs(r)) if (zs.includes(k[0]) && k[3] !== 'a') l2.push(k); return rate(l2.filter((k) => k[3] === 'c').length, l2.length); };
  const per = (f) => x.reduce((a, r) => a + f(r), 0) / x.length;
  return {
    n: x.length, errors: rs.length - x.length, win: rate(wins.length, x.length), reach: rate(x.filter((r) => r.rb).length, x.length),
    winGivenReach: rate(wins.length, x.filter((r) => r.rb).length),
    b11: l.manualReach.v, b12: l.autoWinsSetOut ? l.autoWinsSetOut.v : null, b12start: l.autoWins.v, wins: wins.length, b53: l.combatReach.v,
    b20: [1, 2, 3, 4, 5, 6].map((z) => travel(x, z)),
    b39: c.completion, b46: c.xpShare, takenPerRun: c.perRun, hubPerRun: c.hubPerRun, donePerRun: per(completed),
    abandoned: c.abandoned / x.length, delve: kind('delve'), cull: kind('cull'), bounty: kind('bounty'), z13: zone([1, 2, 3]), z46: zone([4, 5, 6]),
    bands: BANDS.map((b) => [per(boardIn(b)), per(boardDoneIn(b))]), late: [per(lateTaken), per(lateDone)], xpC: per(xpC),
    bought: c.bought, reserve: c.reserve, ilvl: reach.length ? reach.reduce((a, r) => a + r.boss.ilvl, 0) / reach.length : null,
    dungeons: per((r) => r.dungeons || 0),
  };
}
const T = {};
for (const arm of Object.keys(R)) { T[arm] = {}; for (const k of Object.keys(R[arm])) T[arm][k] = row(R[arm][k]); }
const pd = (a, b, f = (r) => (r.out === 'v' ? 1 : 0)) => (a && b ? pairedDiff(a, b, f) : null);
const reachF = (r) => (r.rb ? 1 : 0);
const out = [];
const line = (s = '') => out.push(s);
const tbl = (head, rows) => { line(`| ${head.join(' | ')} |`); line(`|${head.map(() => '---').join('|')}|`); for (const r of rows) line(`| ${r.join(' | ')} |`); line(); };
const ARMS = [['now', 'board across the run (as built)'], ['off', 'board off (D128 board)'], ['ref', 'camp before D128 (61052ac)']];

// ---------------- Win rates, criterion 2, B10 ----------------
line('### Win rates (flip criterion 2: planner P0 >= 20 %, PALL >= 50 %, 900 runs each), reach and boss win');
line();
const winRows = [];
for (const [k, label] of [['p0', 'planner P0'], ['pall', 'planner PALL'], ['speed', 'speedrunner v11 PALL'], ['greedy', 'greedy P0'], ['none', 'planner P0, prep none'], ['random', 'planner P0, prep random'], ['novis', 'planner PALL, no vision (B42)']]) {
  const t = (a) => (T[a][k] ? `${RT(T[a][k].win)}; reach ${P(T[a][k].reach.p)}; boss win ${P(T[a][k].winGivenReach.p)}` : '-');
  const both = (b) => R.now[k] && R[b][k];
  winRows.push([label, t('now'), t('off'), t('ref'), both('off') ? PP(pd(R.now[k], R.off[k])) : '-', both('off') ? PP(pd(R.now[k], R.off[k], reachF)) : '-', both('ref') ? PP(pd(R.now[k], R.ref[k])) : '-']);
}
tbl(['Cell', ...ARMS.map((a) => a[1]), 'win, now - off (paired)', 'reach, now - off (paired)', 'win, now - before D128 (paired)'], winRows);
for (const k of ['p0', 'pall', 'speed']) {
  if (!R.now[k]) continue;
  line(`- ${k} by class, now / off / before D128: ${CL.map((c) => { const f = (a) => (R[a][k] ? RT(rate(R[a][k].filter((r) => ok(r) && r.cls === c && r.out === 'v').length, R[a][k].filter((r) => ok(r) && r.cls === c).length)) : 'n/a'); return `${c} ${f('now')} / ${f('off')} / ${f('ref')}`; }).join('; ')}.`);
}
for (const a of ['now', 'off', 'ref']) if (T[a].p0 && T[a].pall) line(`- B10 (PALL - P0 win, ${BAL.META_GAP_MIN_PP * 100}-${BAL.META_GAP_MAX_PP * 100} pp), ${a}: ${N((T[a].pall.win.p - T[a].p0.win.p) * 100)} pp.`);
line();

// ---------------- Flip rows and contract rows ----------------
line('### Flip and contract rows (B11, B12, B20, B39, B46, B53; contracts per run)');
line();
const v = (a, k, f) => (T[a][k] ? f(T[a][k]) : '-');
const tc = (t) => `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)} (hub ${N(t.hubPerRun, 2)})`;
const bandsTxt = (t) => t.bands.map(([a, b]) => `${N(a, 2)} / ${N(b, 2)}`).join('; ');
const rowsM = [
  ['B39 completion, planner P0 (45-65 %)', (a) => v(a, 'p0', (t) => RT(t.b39))],
  ['B39 completion, planner PALL (65-85 %)', (a) => v(a, 'pall', (t) => RT(t.b39))],
  ['B39 completion, greedy P0 (>= 8 pp under P0)', (a) => v(a, 'greedy', (t) => `${RT(t.b39)}${T[a].p0 ? `; ${N((T[a].p0.b39.p - t.b39.p) * 100)} pp under` : ''}`)],
  ['B39 Delve / Cull / Bounty, planner P0', (a) => v(a, 'p0', (t) => [t.delve, t.cull, t.bounty].map((x) => (x ? `${P(x.p)} (${x.taken})` : '-')).join(' / '))],
  ['B39 zones 1-3 / 4-6, planner P0', (a) => v(a, 'p0', (t) => `${RT(t.z13)} / ${RT(t.z46)}`)],
  ['B39 zones 1-3 / 4-6, planner PALL', (a) => v(a, 'pall', (t) => `${RT(t.z13)} / ${RT(t.z46)}`)],
  ['Contracts taken / completed per run, planner P0', (a) => v(a, 'p0', (t) => `${tc(t)}; swapped away ${N(t.abandoned, 2)}`)],
  ['Contracts taken / completed per run, planner PALL', (a) => v(a, 'pall', (t) => `${tc(t)}; swapped away ${N(t.abandoned, 2)}`)],
  ['Contracts taken / completed per run, greedy P0', (a) => v(a, 'greedy', tc)],
  ['Contracts taken / completed per run, speedrunner', (a) => v(a, 'speed', tc)],
  ['Contracts taken / completed per run, prep random', (a) => v(a, 'random', tc)],
  ['Contracts taken / completed per run, prep none (hub only)', (a) => v(a, 'none', (t) => `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)}`)],
  ['Camp contracts by band, taken / completed per run, planner P0 (zones 1-2; 3-4; 5-6)', (a) => v(a, 'p0', bandsTxt)],
  ['Camp contracts by band, taken / completed per run, planner PALL (zones 1-2; 3-4; 5-6)', (a) => v(a, 'pall', bandsTxt)],
  ['Zone 4-6 contracts (camp and hub), taken / completed per run, P0 / PALL', (a) => `${v(a, 'p0', (t) => `${N(t.late[0], 2)} / ${N(t.late[1], 2)}`)}; ${v(a, 'pall', (t) => `${N(t.late[0], 2)} / ${N(t.late[1], 2)}`)}`],
  ['Contract XP per run (k), P0 / PALL', (a) => `${v(a, 'p0', (t) => N(t.xpC / 1000, 0))} / ${v(a, 'pall', (t) => N(t.xpC / 1000, 0))}`],
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

const lvF = (z) => (r) => (r.travelLv && r.travelLv.length >= z ? r.travelLv[z - 1] : null);
const pdN = (a, b, f) => { if (!a || !b) return null; const A = a.filter((r) => f(r) !== null); const B = b.filter((r) => f(r) !== null); const keys = new Set(B.map((r) => `${r.cls}|${r.seed}`)); return pairedDiff(A.filter((r) => keys.has(`${r.cls}|${r.seed}`)), B, f); };
const meanLv = (rs, z) => { const xs = (rs || []).filter((r) => ok(r) && r.travelLv && r.travelLv.length >= z).map((r) => r.travelLv[z - 1]); return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null; };
line('B20, mean level leaving each zone, planner P0 (paired now - off: runs that left the zone in both):');
line();
tbl(['Zone', 'band', 'now', 'off', 'before D128', 'now - off'], [1, 2, 3, 4, 5, 6].map((z) => [`Z${z}`, `${10 * z - BAL.ZONE_LVL_SLACK}-${10 * z + BAL.ZONE_LVL_SLACK}`, N(meanLv(R.now.p0, z), 2), N(meanLv(R.off.p0, z), 2), N(meanLv(R.ref.p0, z), 2), DN(pdN(R.now.p0, R.off.p0, lvF(z)))]));
const ilF = (r) => (r.rb && r.boss ? r.boss.ilvl : null);
for (const k of ['p0', 'pall']) line(`- Boss ilvl, ${k}, paired (runs at the boss in both): now - off ${DN(pdN(R.now[k], R.off[k], ilF))}; now - before D128 ${DN(pdN(R.now[k], R.ref[k], ilF))}.`);
line();
line('Contracts per run, paired by class and seed (now - off):');
line();
const pairRows = [];
for (const [k, label] of [['p0', 'planner P0'], ['pall', 'planner PALL'], ['speed', 'speedrunner v11 PALL'], ['greedy', 'greedy P0'], ['random', 'prep random']]) {
  if (!R.now[k] || !R.off[k]) continue;
  pairRows.push([label, DN(pd(R.now[k], R.off[k], taken)), DN(pd(R.now[k], R.off[k], completed)), DN(pd(R.now[k], R.off[k], lateTaken)), DN(pd(R.now[k], R.off[k], lateDone)), DN(pd(R.now[k], R.off[k], (r) => xpC(r) / 1000), 1)]);
}
tbl(['Cell', 'taken', 'completed', 'zone 4-6 taken', 'zone 4-6 completed', 'contract XP (k)'], pairRows);
for (const k of ['p0', 'pall']) {
  if (!R.now[k]) continue;
  const one = b46Boot(R.now[k]);
  line(`- B46 ${k} (${EXP.CONTRACT_XP_SHARE.map((x) => x * 100).join('-')} %): now ${P(one.v)} (${P(one.ci[0])} - ${P(one.ci[1])}; run bootstrap, n ${one.n}); now - off ${R.off[k] ? PP(b46Boot(R.now[k], R.off[k])) : 'n/a'} (paired bootstrap).`);
}
line();
line('Camp purchases (share of runs), now / off:');
line();
for (const k of ['p0', 'pall', 'speed', 'greedy', 'random', 'novis']) {
  if (!T.now[k]) continue;
  const f = (t) => (t ? Object.entries(t.bought).map(([id, s]) => `${id.replace('prep_', '')} ${P(s, 0)}`).join(', ') || 'none' : '-');
  line(`- ${k}: ${f(T.now[k])} / ${f(T.off[k])}`);
}
line();

// ---------------- B40, B42 ----------------
line('### B40 (plan value) and B42 (vision value)');
line();
const b40 = (a) => (R[a].p0 && R[a].none && R[a].random ? [PP(pd(R[a].p0, R[a].none)), PP(pd(R[a].p0, R[a].random))] : ['-', '-']);
tbl(['Arm', `B40 planned - none (>= +${EXP.PLAN_GAIN_MIN * 100} pp)`, `B40 planned - random (>= +${EXP.PLAN_VS_RANDOM_MIN * 100} pp)`], [['board across the run (as built)', ...b40('now')], ['board off (D128 board)', ...b40('off')], ['camp before D128', ...b40('ref')]]);
if (T.now.pall && T.now.novis) {
  const a = T.now.pall.b39; const b = T.now.novis.b39;
  const d = a.p - b.p; const se = Math.sqrt((a.p * (1 - a.p)) / a.n + (b.p * (1 - b.p)) / b.n);
  line(`- B42 completion (>= ${EXP.VISION_COMPLETION_MIN * 100} pp; no-vision cell: --meta-drop ${EXP.B42_VISION_ENTRIES.join(',')} --prep-ban ${EXP.B42_VISION_PERKS.map((x) => x.replace('prep_', '')).join(',')}): PALL ${RT(a)} against ${RT(b)}: **${d >= 0 ? '+' : ''}${N(d * 100)} pp** (${N((d - 1.96 * se) * 100)} - ${N((d + 1.96 * se) * 100)}, by contract, unpaired); win, paired: ${PP(pd(R.now.pall, R.now.novis))}; contracts taken per run ${N(T.now.pall.takenPerRun, 2)} against ${N(T.now.novis.takenPerRun, 2)}.`);
  line('- B42 on the D128 board (report 2026-11-12d): +15.1 pp (73.4 % against 58.3 %); win +0.6 pp (-3.8 - 4.9).');
}
line();

// ---------------- Autoplay's camp ----------------
if (AUTO.a3 && AUTO.a6) {
  const A3 = row(AUTO.a3); const A6 = row(AUTO.a6);
  const own = R.now.p0 ? R.now.p0.filter((r) => keysOf(AUTO.a3).has(`${r.cls}|${r.seed}`)) : null;
  const OW = own ? row(own) : null;
  line(`### Autoplay's camp (--prep-policy auto: the engine's R.autoAction at the camp, the planner elsewhere; planner P0, ${A3.n} runs)`);
  line();
  const ar = (t) => [RT(t.win), P(t.reach.p), `${N(t.takenPerRun, 2)} / ${N(t.donePerRun, 2)}`, `${N(t.late[0], 2)} / ${N(t.late[1], 2)}`, P(t.b46), N(t.reserve, 2), Object.entries(t.bought).map(([id, s]) => `${id.replace('prep_', '')} ${P(s, 0)}`).join(', ')];
  tbl(['Camp', 'win', 'reach', 'contracts taken / completed', 'zone 4-6 taken / completed', 'B46', 'Reserve left', 'camp purchases'], [
    ['autoplay, AUTO_PREP_ZONES 3 (as built)', ...ar(A3)], ['autoplay, AUTO_PREP_ZONES 6 (all zones)', ...ar(A6)], ...(OW ? [["planner's own camp, same seeds", ...ar(OW)]] : []),
  ]);
  line(`- 6 - 3, paired: win ${PP(pd(AUTO.a6, AUTO.a3))}; reach ${PP(pd(AUTO.a6, AUTO.a3, reachF))}; contracts taken ${DN(pd(AUTO.a6, AUTO.a3, taken))}, completed ${DN(pd(AUTO.a6, AUTO.a3, completed))}; contract XP (k) ${DN(pd(AUTO.a6, AUTO.a3, (r) => xpC(r) / 1000), 1)}.`);
  if (own) line(`- Planner's camp - autoplay's (3), paired: win ${PP(pd(own, AUTO.a3))}; reach ${PP(pd(own, AUTO.a3, reachF))}.`);
  line();
}
console.log(out.join('\n'));
