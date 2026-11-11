#!/usr/bin/env node
// Heat report tables (docs/specs/expedition.md H.6: B58, B56, B57; the PLANNER_HOUR_MULT check of D61; the Ascendancy
// calibration of SIM.VAL_ASC; scratch proposals): reads planner P0 cells written by sim/run.mjs and prints the
// generated block of docs/reports/balance-2026-11-11.md (Markdown) to stdout. Pure reads of the run records.
//
//   node sim/heatreport.mjs --main <dir: planner-P0, planner-P0-heatSeek, planner-P0-heatAvoid>
//        [--noheat <dir: planner-P0 on an engine without H.3 rewards>] [--sweep <dir: planner-P0-hm<x>, planner-P0-noHeat>]
//        [--calib-base <cell dir> --calib-asc0 <cell dir>] [--var <label>=<dir> ...] [--var-runs N]
//
// Every comparison is paired by (class, seed). The proposals (--var) are scratch engines; their cells hold the first
// --var-runs seeds per class, compared with the same seeds of --main and --noheat.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, readJsonl, pct, num, table } from './lib/output.mjs';
import { pairedDiff } from './lib/combatchecks.mjs';
import { heatChecks, heatCell, hotRun } from './lib/heatchecks.mjs';
import { rate, median, mean } from './lib/stats.mjs';

const argv = process.argv.slice(2);
const args = { var: [] };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  const v = argv[i + 1];
  if (k === 'var') args.var.push(v); else args[k] = v;
  i++;
}
const CLASSES = ['rogue', 'mage', 'hunter'];

/** Records per class of a cell directory (null if missing). */
function cellDir(d) {
  if (!d || !existsSync(join(d, 'summary.json'))) return null;
  const sum = readJson(join(d, 'summary.json'));
  const out = {};
  for (const cls of Object.keys(sum.classes)) out[cls] = readJsonl(join(d, `runs-${cls}.jsonl`));
  out.meta = sum.meta;
  return out;
}
const cell = (dir, name) => (dir ? cellDir(join(dir, name)) : null);
const flat = (c) => (c ? CLASSES.flatMap((k) => c[k] || []) : null);
const firstSeeds = (recs, n) => recs.filter((r) => r.seed < 1000 + n);
const win = (r) => (r.out === 'v' ? 1 : 0);
const reach = (r) => r.rb;
const dcell = (d) => (d && d.v !== null ? `${d.v >= 0 ? '+' : ''}${num(d.v * 100, 1)} pp (${num(d.ci[0] * 100, 1)} - ${num(d.ci[1] * 100, 1)})` : 'n/a');
const rc = (r) => (r && r.n ? `${pct(r.p)} (${pct(r.ci[0])} - ${pct(r.ci[1])})` : 'n/a');
const res = (ok) => (ok === null || ok === undefined ? 'n/a' : ok ? 'pass' : '**FAIL**');

/** One row of facts of a cell (all classes pooled): win, reach, hours and Ascendancy at the boss, heat use, gear. */
function facts(recs) {
  const c = heatCell(recs);
  const boss = recs.filter((r) => r.out !== 'x' && r.rb);
  const nodes = [0, 1, 2, 3].map((i) => mean(recs.filter((r) => r.ht).map((r) => r.ht[i])));
  const tot = nodes.reduce((a, b) => a + b, 0) || 1;
  const gs = boss.filter((r) => r.boss && typeof r.boss.gs === 'number').map((r) => r.boss.gs);
  return {
    ...c,
    nodeShare: nodes.map((x) => x / tot),
    gs: gs.length ? median(gs) : null,
    rare: boss.length ? mean(boss.filter((r) => r.boss).map((r) => r.boss.rare)) : null,
    lvl: boss.length ? mean(boss.map((r) => r.lvl)) : null,
    bossWin: rate(boss.filter((r) => r.out === 'v').length, boss.length),
  };
}
const byClass = (c) => CLASSES.map((k) => (c[k] ? `${pct(heatCell(c[k]).win.p)} / ${pct(heatCell(c[k]).reach.p)}` : 'n/a')).join(' | ');
const shares = (f) => f.nodeShare.map((x) => Math.round(x * 100)).join(' / ');

const L = [];
const main = { planner: cell(args.main, 'planner-P0'), seek: cell(args.main, 'planner-P0-heatSeek'), avoid: cell(args.main, 'planner-P0-heatAvoid') };
const noHeat = args.noheat ? cell(args.noheat, 'planner-P0') : null;
const meta = main.planner ? main.planner.meta : null;
if (meta) L.push(`Setup: planner P0 cells of \`${args.main}\` (commit ${meta.commit}; ${meta.runs} runs per class, seeds ${meta.seedStart}-${meta.seedStart + meta.runs - 1}; trees ${JSON.stringify(meta.trees)}; risk table: ${meta.warmupNote}). B57 arm: \`${args.noheat || 'n/a'}\`${noHeat ? ` (commit ${noHeat.meta.commit})` : ''}.`, '');

// ---------------- Heat targets ----------------
if (main.planner) {
  const rows = heatChecks({ planner: flat(main.planner), seek: flat(main.seek), avoid: flat(main.avoid), noHeat: flat(noHeat) });
  L.push('### Heat targets (expedition.md H.6)', '');
  L.push(table(['ID', 'Pri', 'Metric', 'Value (95 % interval)', 'Target', 'Result'], rows.map((r) => [r.id, r.pri, r.metric, r.value, r.target, res(r.ok)])), '');
  const cells = [['planner (default: heat valued, hour weight 2)', main.planner], ['heat-seek', main.seek], ['heat-avoid', main.avoid], ['planner, engine without heat rewards (B57 arm)', noHeat]];
  L.push('### Heat cells, planner P0', '');
  L.push(table(['Cell', 'Runs', 'rogue: win / boss', 'mage: win / boss', 'hunter: win / boss', 'All: win / boss', 'Win at the boss', 'Hours at the boss (median)', 'Ascendancy (median)', 'Runs with a Hot or Scorched node', 'Nodes Clear / Warm / Hot / Scorched (%)', 'Gear score at the boss (median)', 'Rare or epic slots at the boss'],
    cells.filter(([, c]) => c).map(([label, c]) => {
      const f = facts(flat(c));
      return [label, f.n, byClass(c), `${pct(f.win.p)} / ${pct(f.reach.p)}`, pct(f.bossWin.p), num(f.hours, 0), num(f.asc, 2), pct(f.hotRuns.p), shares(f), num(f.gs, 0), pct(f.rare, 0)];
    })), '');
  const pr = [['heat-seek - planner', main.seek, main.planner], ['heat-avoid - planner', main.avoid, main.planner], ['heat-seek - heat-avoid', main.seek, main.avoid], ['planner - engine without heat rewards', main.planner, noHeat]]
    .filter(([, a, b]) => a && b).map(([label, a, b]) => [label, dcell(pairedDiff(flat(a), flat(b), win)), dcell(pairedDiff(flat(a), flat(b), reach))]);
  L.push('Paired differences (all classes, same seeds and starting risk table):', '');
  L.push(table(['Pair', 'Win', 'Reach the boss'], pr), '');
}

// ---------------- Hour weight ----------------
if (args.sweep) {
  const names = ['hm1', 'hm2', 'hm3', 'hm4', 'noHeat'].filter((v) => cell(args.sweep, `planner-P0-${v}`));
  const ref = cell(args.sweep, 'planner-P0-hm2');
  const sm = ref.meta;
  L.push('### Hour weight with heat valued (PLANNER_HOUR_MULT check, D61)', '');
  L.push(`Planner P0, ${sm.runs} runs per class (seeds ${sm.seedStart}-${sm.seedStart + sm.runs - 1}), each cell from the same starting risk table; hm<x> = the planner with heat terms and hour weight x; noHeat = the planner before 2026-11-11 (no heat terms) at weight 2. Paired against hm2 (today's PLANNER_HOUR_MULT).`, '');
  L.push(table(['Cell', 'rogue: win / boss', 'mage: win / boss', 'hunter: win / boss', 'All: win (95 %)', 'Reach', 'Win - hm2, paired', 'Reach - hm2, paired', 'Hours at the boss (median)', 'Ascendancy (median)', 'Runs with a Hot node', 'Gear score at the boss'],
    names.map((v) => {
      const c = cell(args.sweep, `planner-P0-${v}`);
      const f = facts(flat(c));
      return [v, ...CLASSES.map((k) => `${pct(heatCell(c[k]).win.p)} / ${pct(heatCell(c[k]).reach.p)}`), rc(f.win), pct(f.reach.p),
        v === 'hm2' ? '-' : dcell(pairedDiff(flat(c), flat(ref), win)), v === 'hm2' ? '-' : dcell(pairedDiff(flat(c), flat(ref), reach)), num(f.hours, 0), num(f.asc, 2), pct(f.hotRuns.p), num(f.gs, 0)];
    })), '');
}

// ---------------- Ascendancy calibration ----------------
if (args['calib-base'] && args['calib-asc0']) {
  const a = cellDir(args['calib-base']);
  const b = cellDir(args['calib-asc0']);
  const A = flat(a);
  const B = new Map(flat(b).map((r) => [`${r.cls}|${r.seed}`, r]));
  let same = 0;
  let dw = 0;
  let sa = 0;
  const by = {};
  for (const r of A) {
    const o = B.get(`${r.cls}|${r.seed}`);
    if (!o || r.rb !== o.rb || r.hb !== o.hb || r.lvl !== o.lvl) continue;
    same++;
    if (!r.rb) continue;
    const d = win(o) - win(r);
    dw += d;
    sa += r.asc;
    const k = num(r.asc, 2);
    by[k] = by[k] || { n: 0, d: 0, w: 0 };
    by[k].n++; by[k].d += d; by[k].w += win(r);
  }
  L.push('### Ascendancy calibration (SIM.VAL_ASC)', '');
  L.push(`The planner before 2026-11-11 (it does not read Ascendancy, and the risk table holds no boss fights) on the engine and on a scratch copy with ASC_CAP 0, same seeds and risk table: the runs are identical up to FIGHT_BOSS (${same} of ${A.length} runs have the same level, reach and hours at the boss). Commits ${a.meta.commit} / ${b.meta.commit}.`, '');
  L.push(table(['Ascendancy at the boss', 'Runs reaching the boss', 'Boss win with Ascendancy', 'Boss win without, paired'],
    Object.entries(by).sort().map(([k, v]) => [k, v.n, pct(v.w / v.n), `${v.d >= 0 ? '+' : ''}${num((100 * v.d) / v.n, 1)} pp`])), '');
  L.push(`Win rate ${pct(rate(A.filter((r) => win(r)).length, A.length).p)} with Ascendancy, ${pct(rate(flat(b).filter((r) => win(r)).length, A.length).p)} without (${dcell(pairedDiff(flat(b), A, win))}, paired). Per 1.0 of Ascendancy a run that reaches the boss loses ${num(dw / sa, 2)} of win probability (sum of paired win differences / sum of Ascendancy, runs reaching the boss).`, '');
}

// ---------------- Proposals (scratch engines) ----------------
if (args.var.length) {
  const n = Number(args['var-runs'] || 300);
  const sub = (c) => (c ? firstSeeds(flat(c), n) : null);
  const basePl = sub(main.planner);
  const baseNo = sub(noHeat);
  L.push(`### Proposals (scratch engines; first ${n} seeds per class, paired with the same seeds of the measure)`, '');
  const rows = [];
  const add = (label, pl, sk, av) => {
    const f = (x) => (x ? pct(heatCell(x).win.p) : 'n/a');
    const gap = sk && av ? pairedDiff(sk, av, win) : null;
    rows.push([label, f(pl), f(sk), f(av), gap ? dcell(gap) : 'n/a', gap && gap.v !== null ? res(Math.abs(gap.v) <= 0.05) : 'n/a',
      pl && baseNo ? dcell(pairedDiff(pl, baseNo, win)) : 'n/a', sk ? num(heatCell(sk).hours, 0) : 'n/a', sk ? pct(heatCell(sk).hotRuns.p) : 'n/a', pl ? pct(facts(pl).hotRuns.p) : 'n/a']);
  };
  add('measure (today\'s constants)', basePl, sub(main.seek), sub(main.avoid));
  for (const v of args.var) {
    const [label, dir] = v.split('=');
    add(label, sub(cell(dir, 'planner-P0')), sub(cell(dir, 'planner-P0-heatSeek')), sub(cell(dir, 'planner-P0-heatAvoid')));
  }
  L.push(table(['Variant', 'Planner win', 'Seek win', 'Avoid win', 'B58: seek - avoid, paired', 'B58', 'B57: planner - no-heat engine, paired', 'Seek hours at the boss', 'Seek runs with a Hot node', 'Planner runs with a Hot node'], rows), '');
}

process.stdout.write(`${L.join('\n')}\n`);
