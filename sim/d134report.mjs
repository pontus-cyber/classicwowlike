#!/usr/bin/env node
// Tables of the D134 measure (autoplay's start camp buys the Ember of Return first, GATES.autoEmberFirst; report
// docs/reports/balance-2026-11-13b.md) from the cells of sim/measure-d134.sh, paired by class and seed: IN/on = the
// switch on (as built), IN/off = the switch off (the order before D133, cell mark '-noae'), IN/own = the planner's own
// camp (planner P0, the default cell) on the same seeds. Prints Markdown.
//
//   node sim/d134report.mjs [--in sim/out/pass-d134] > tables.md
import { existsSync } from 'node:fs';
import { readJsonl } from './lib/output.mjs';
import { contractMetrics } from './lib/metrics.mjs';
import { pairedDiff } from './lib/combatchecks.mjs';
import { rate } from './lib/stats.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const I = args.in || 'sim/out/pass-d134';
const CL = ['rogue', 'mage', 'hunter'];
const recs = (d) => (existsSync(`${d}/runs-${CL[0]}.jsonl`) ? CL.flatMap((c) => readJsonl(`${d}/runs-${c}.jsonl`)) : null);
const ok = (r) => !r.err;
const P = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : `${(x * 100).toFixed(d)} %`);
const N = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : Number(x).toFixed(d));
const PP = (d) => (!d || d.v === null ? 'n/a' : `${d.v >= 0 ? '+' : ''}${(d.v * 100).toFixed(1)} pp (${(d.ci[0] * 100).toFixed(1)} - ${(d.ci[1] * 100).toFixed(1)}; n ${d.n})`);
const DN = (d, k = 2) => (!d || d.v === null ? 'n/a' : `${d.v >= 0 ? '+' : ''}${d.v.toFixed(k)} (${d.ci[0].toFixed(k)} - ${d.ci[1].toFixed(k)}; n ${d.n})`);
const RT = (r) => (r && r.n ? `${P(r.p)} (${r.k} / ${r.n})` : 'n/a');

const A = { on: recs(`${I}/on/planner-P0-exp-prepauto`), off: recs(`${I}/off/planner-P0-exp-prepauto-noae`), own: recs(`${I}/own/planner-P0-exp-prep`) };
const LABEL = { on: 'autoplay, Ember first (switch on, as built)', off: 'autoplay, Draughts first (switch off, before D133)', own: "planner's own camp" };
if (!A.on || !A.off) throw new Error(`no on / off cells under ${I}`);
const keys = new Set(A.on.map((r) => `${r.cls}|${r.seed}`));
if (A.own) A.own = A.own.filter((r) => keys.has(`${r.cls}|${r.seed}`));

const cs = (r) => (r.ct ? r.ct.c : []);
const taken = (r) => cs(r).length;
const completed = (r) => cs(r).filter((k) => k[3] === 'c').length;
const board = (r) => cs(r).filter((k) => k[2] !== 'h').length;
const boardDone = (r) => cs(r).filter((k) => k[2] !== 'h' && k[3] === 'c').length;
const xpC = (r) => (r.ct ? r.ct.xpC : 0) / 1000;
const emb = (r, i) => (r.emb ? r.emb[i] : 0);
const win = (r) => (r.out === 'v' ? 1 : 0);
const reach = (r) => (r.rb ? 1 : 0);
const res = (r) => r.res || 0;

function row(rs) {
  const x = rs.filter(ok);
  const per = (f) => x.reduce((a, r) => a + f(r), 0) / x.length;
  const c = contractMetrics(x);
  const at = x.filter((r) => r.rb);
  return {
    n: x.length, win: rate(x.filter((r) => r.out === 'v').length, x.length), reach: rate(at.length, x.length),
    bossWin: rate(x.filter((r) => r.out === 'v').length, at.length),
    taken: per(taken), done: per(completed), board: per(board), boardDone: per(boardDone), hub: c.hubPerRun, b39: c.completion, b46: c.xpShare,
    xpC: per(xpC), reserve: c.reserve, bought: c.bought,
    emberRes: per((r) => emb(r, 0)), emberResRuns: rate(x.filter((r) => emb(r, 0) > 0).length, x.length), emberBoss: per((r) => emb(r, 1)),
    carriedAtBoss: rate(at.filter((r) => emb(r, 2) > 0).length, at.length), res: per(res),
  };
}
const T = Object.fromEntries(Object.entries(A).filter(([, v]) => v).map(([k, v]) => [k, row(v)]));
const out = [];
const line = (s = '') => out.push(s);
const tbl = (head, rows) => { line(`| ${head.join(' | ')} |`); line(`|${head.map(() => '---').join('|')}|`); for (const r of rows) line(`| ${r.join(' | ')} |`); line(); };
const arms = Object.keys(T);

line(`### Autoplay's camp with the switch on and off, and the planner's own camp (planner P0 elsewhere, --map expedition --prep, ${T.on.n} runs)`);
line();
tbl(['Camp', 'win', 'reach', 'boss win (reached)', 'camp purchases', 'Reserve left'], arms.map((k) => [LABEL[k], RT(T[k].win), RT(T[k].reach), RT(T[k].bossWin), Object.entries(T[k].bought).map(([id, s]) => `${id.replace('prep_', '')} ${P(s, 0)}`).join(', '), N(T[k].reserve)]));
tbl(['Camp', 'contracts taken / completed per run', 'camp board taken / completed', 'hub taken', 'B39 completion', 'contract XP (k)', 'B46'], arms.map((k) => [LABEL[k], `${N(T[k].taken)} / ${N(T[k].done)}`, `${N(T[k].board)} / ${N(T[k].boardDone)}`, N(T[k].hub), RT(T[k].b39), N(T[k].xpC, 1), P(T[k].b46)]));
tbl(['Camp', 'Ember resurrects per run', 'runs with an Ember resurrect', 'Ember resurrects in the boss fight per run', 'Ember carried at the boss (runs that reach it)', 'resurrects per run (all sources)'], arms.map((k) => [LABEL[k], N(T[k].emberRes), RT(T[k].emberResRuns), N(T[k].emberBoss), RT(T[k].carriedAtBoss), N(T[k].res)]));

line('Paired by class and seed:');
line();
const pr = (a, b) => [PP(pairedDiff(A[a], A[b], win)), PP(pairedDiff(A[a], A[b], reach)), DN(pairedDiff(A[a], A[b], taken)), DN(pairedDiff(A[a], A[b], completed)), DN(pairedDiff(A[a], A[b], xpC), 1), DN(pairedDiff(A[a], A[b], (r) => emb(r, 0)))];
const pairs = [['on', 'off', 'on - off (the switch)'], ...(A.own ? [['own', 'on', "planner's camp - on (gap left)"], ['own', 'off', "planner's camp - off (gap before, report 2026-11-13: +11.5 pp)"]] : [])];
tbl(['Pair', 'win', 'reach', 'contracts taken', 'contracts completed', 'contract XP (k)', 'Ember resurrects'], pairs.map(([a, b, l]) => [l, ...pr(a, b)]));
line('Win by class (rogue / mage / hunter):');
line();
for (const k of arms) line(`- ${LABEL[k]}: ${CL.map((c) => { const x = A[k].filter((r) => ok(r) && r.cls === c); return RT(rate(x.filter((r) => r.out === 'v').length, x.length)); }).join(' / ')}`);
console.log(out.join('\n'));
