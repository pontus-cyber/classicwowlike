#!/usr/bin/env node
// Combat v2 measure (M2b 2b.2; combat-v2.md 11-12): the P0 cells the combat checks need, with the risk-table chain of
// the full pass (sim/pass.mjs stage A), then the cheap M2 cells combat touches. Results go to <out>/<cell>/ plus
// <out>/combat.json; build the report with sim/combatreport.mjs.
//
//   node sim/combatpass.mjs --out sim/out/m2b-2026-11-10d [--runs 1000] [--tact-runs 1000] [--opener-runs 1000]
//                           [--workers N] [--stages W,P,M,O,T,X] [--resume] [--warmup 1000]
//
// Stages (P0-group trees, SIM.DEFAULT_TREE; seeds SEED_BASE..):
//   W  planner warm-up (WARMUP_RUNS from RISK_PRIOR, seeds WARMUP_SEED_BASE..), as pass stage A
//   P  planner P0 from the warm-up observations; its final observations (obs-P0.json) start every other P0 cell
//   M  masher P0 with the B50 replays (cell.replay)
//   O  opener P0 (--opener-runs)
//   T  tactician P0 with the engage search (--tact-runs)
//   X  random, greedy, speedrunner P0 (B1, B4); planner PALL (PALL-group trees, warm-up from obs-P0; B3, B6)
import { cpus } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { BAL, SIM } from './lib/params.mjs';
import { Pool } from './lib/pool.mjs';
import { runBatch, CLASSES } from './lib/session.mjs';
import { runCell } from './lib/batch.mjs';
import { readJson, writeJson, readJsonl, commitInfo, ensureDir } from './lib/output.mjs';
import { defaultTrees } from './lib/trees.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

const args = parse(process.argv.slice(2));
const OUT = ensureDir(args.out || join('sim', 'out', `m2b-${new Date().toISOString().slice(0, 10)}`));
const RUNS = Number(args.runs || 1000);
const TACT_RUNS = Number(args['tact-runs'] || RUNS);
const OPENER_RUNS = Number(args['opener-runs'] || RUNS);
const WORKERS = Number(args.workers || cpus().length);
const STAGES = new Set(String(args.stages || 'W,P,M,O,T,X').split(','));
const WARM = Number(args.warmup ?? SIM.WARMUP_RUNS);
const SEED = BAL.SEED_BASE;
const TREES = defaultTrees('P0');
const TREES_PALL = defaultTrees('PALL');
const pool = new Pool(WORKERS);
const manifestFile = join(OUT, 'combat.json');
const manifest = existsSync(manifestFile) ? readJson(manifestFile) : { cells: {}, warmups: {} };
manifest.meta = { commit: commitInfo(), started: manifest.meta ? manifest.meta.started : new Date().toISOString(), runs: RUNS, tactRuns: TACT_RUNS, openerRuns: OPENER_RUNS, seedBase: SEED, workers: WORKERS, node: process.version, trees: TREES, treesPALL: TREES_PALL, simOverride: process.env.SIM_OVERRIDE || null };
const save = () => writeJson(manifestFile, manifest);
const log = (m) => process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${m}\n`);

async function cell(name, o) {
  const dir = join(OUT, name);
  if (args.resume && existsSync(join(dir, 'summary.json'))) {
    const sum = readJson(join(dir, 'summary.json'));
    const risk = readJson(join(dir, 'risk.json'));
    const perClass = {};
    for (const cls of Object.keys(sum.classes)) perClass[cls] = { records: readJsonl(join(dir, `runs-${cls}.jsonl`)), metrics: sum.classes[cls].metrics, obs: risk[cls] };
    log(`${name}: reloaded`);
    return { perClass };
  }
  log(`${name}: start`);
  const r = await runBatch({ pool, out: OUT, name, workers: WORKERS, quiet: true, warmup: 0, runs: RUNS, seedStart: SEED, classes: CLASSES, ...o });
  manifest.cells[name] = { dir: name, bot: o.bot, prof: o.prof, trees: o.trees, runs: o.runs || RUNS, replay: !!o.replay, wallS: Math.round(r.meta.wallMs / 1000) };
  save();
  const brief = Object.entries(r.perClass).map(([c, x]) => `${c} ${(x.metrics.win.p * 100).toFixed(1)} %/${(x.metrics.boss.p * 100).toFixed(0)} %`).join(', ');
  log(`${name}: done in ${(r.meta.wallMs / 1000).toFixed(0)} s (win/boss: ${brief})`);
  return r;
}

async function warmup(key, prof, trees, obsIn, runs) {
  const file = join(OUT, `warmup-${key}.json`);
  if (args.resume && existsSync(file)) { log(`warm-up ${key}: reloaded`); return readJson(file); }
  const obs = {};
  for (const cls of CLASSES) {
    const w = await runCell(pool, { bot: 'planner', cls, prof, tree: trees[cls], style: null, variant: null, pet: null }, { runs, seedStart: SIM.WARMUP_SEED_BASE, obsIn: obsIn ? obsIn[cls] : null });
    obs[cls] = w.obs;
  }
  writeJson(file, obs);
  manifest.warmups[key] = { prof, trees, runs, seeds: `${SIM.WARMUP_SEED_BASE}-${SIM.WARMUP_SEED_BASE + runs - 1}`, inherited: !!obsIn };
  save();
  log(`warm-up ${key}: ${runs} planner runs per class`);
  return obs;
}

const obsOf = (r) => Object.fromEntries(Object.entries(r.perClass).map(([c, x]) => [c, x.obs]));
try {
  const t0 = Date.now();
  let w = null;
  if (STAGES.has('W') || STAGES.has('P')) w = await warmup('P0', 'fresh', TREES, null, WARM);
  let obsP0 = existsSync(join(OUT, 'obs-P0.json')) ? readJson(join(OUT, 'obs-P0.json')) : null;
  if (STAGES.has('P')) {
    const r = await cell('planner-P0', { bot: 'planner', prof: 'fresh', trees: TREES, obsIn: w });
    obsP0 = obsOf(r);
    writeJson(join(OUT, 'obs-P0.json'), obsP0);
  }
  if (!obsP0) throw new Error('no obs-P0.json: run stage P first');
  if (STAGES.has('M')) await cell('masher-P0', { bot: 'masher', prof: 'fresh', trees: TREES, obsIn: obsP0, replay: true });
  if (STAGES.has('O')) await cell('opener-P0', { bot: 'opener', prof: 'fresh', trees: TREES, obsIn: obsP0, runs: OPENER_RUNS });
  if (STAGES.has('T')) await cell('tactician-P0', { bot: 'tactician', prof: 'fresh', trees: TREES, obsIn: obsP0, runs: TACT_RUNS });
  if (STAGES.has('X')) {
    for (const bot of ['random', 'greedy', 'speedrunner']) await cell(`${bot}-P0`, { bot, prof: 'fresh', trees: TREES, obsIn: bot === 'random' ? null : obsP0 });
    const wp = await warmup('PALL', 'all', TREES_PALL, obsP0, WARM);
    await cell('planner-PALL', { bot: 'planner', prof: 'all', trees: TREES_PALL, obsIn: wp });
  }
  manifest.meta.finished = new Date().toISOString();
  manifest.meta.wallMin = Math.round((Date.now() - t0) / 60000);
  save();
  log(`done: ${OUT}`);
} finally {
  await pool.close();
}
