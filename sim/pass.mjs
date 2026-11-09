#!/usr/bin/env node
// Full balance pass (M2 2.2): every cell the balance report needs, in dependency order, then campaigns, the
// replay check (B35) and the throughput check (B37). Results go to <out>/<cell>/ (see sim/run.mjs) plus
// <out>/pass.json; build the report with sim/report.mjs.
//
//   node sim/pass.mjs --out sim/out/pass-2026-11-09 [--runs 2000] [--style-runs 1000] [--workers N]
//                     [--stages A,B,C,D] [--resume] [--warmup 1000] [--campaigns 50] [--replay 1000] [--half-runs 1000]
//                     [--variant-runs 2000] [--pall-runs 2000] [--diag-runs 1000]
//
// Order and risk-table chain (balance.md 1.1; each cell keeps refreshing its own table every SIM_RISK_REFRESH runs):
//   A  P0:   planner warm-up (default trees) -> B7 planner with each tree -> best tree per class (win rate, then
//            reach-boss rate) -> random, greedy, speedrunner, tactician; all start from the best-tree planner's
//            final observations.
//   B  P10:  planner warm-up from the P0 observations -> planner, random.
//   C  PALL: planner warm-up from the P0 observations -> planner -> random, greedy, speedrunner (--pall-runs; also
//            caps the PALL route-style cells of stage E),
//            tactician (--half-runs), B26-B28 variants (--variant-runs, paired with the planner's first seeds); all
//            start from the PALL planner's observations.
//   D  campaigns (frozen P0 planner table), B35 replay of 1 000 random runs, B37 autoplay throughput.
//   E  P2 and diagnostic cells: B9 pets and B8 styles (P0 from the P0 planner's observations, PALL from the PALL
//            planner's), the rules-only tactician (telegraph rules, no search; --half-runs).
import { cpus } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { BAL, SIM } from './lib/params.mjs';
import { Pool } from './lib/pool.mjs';
import { runBatch, CLASSES } from './lib/session.mjs';
import { runCell, runCampaigns } from './lib/batch.mjs';
import { buildTable } from './lib/risk.mjs';
import { campaignMetrics, campaignMarkdown } from './lib/campaignreport.mjs';
import { replayHash } from './lib/runner.mjs';
import { R, newRunFor } from './lib/engine.mjs';
import { readJson, writeJson, readJsonl, commitInfo, ensureDir } from './lib/output.mjs';
import { writeFileSync } from 'node:fs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

const args = parse(process.argv.slice(2));
const OUT = ensureDir(args.out || join('sim', 'out', `pass-${new Date().toISOString().slice(0, 10)}`));
const RUNS = Number(args.runs || BAL.N_RUNS_PER_CELL);
const STYLE_RUNS = Number(args['style-runs'] || Math.round(RUNS / 2));
const WORKERS = Number(args.workers || cpus().length);
const STAGES = new Set(String(args.stages || 'A,B,C,D,E').split(','));
const WARM = Number(args.warmup ?? SIM.WARMUP_RUNS);
const CAMPAIGNS = Number(args.campaigns ?? BAL.N_CAMPAIGNS);
const REPLAY = Number(args.replay ?? BAL.QA_REPLAY_RUNS);
// The PALL tactician (B3 is an upper bound) runs at half size (compute budget); the diagnostic rules-only tactician
// (no search, cheap) at --diag-runs (default: the same).
const HALF = Number(args['half-runs'] || Math.round(RUNS / 2));
const DIAG_RUNS = Number(args['diag-runs'] || HALF);
// PALL planner, random, greedy and speedrunner cells (the first to cut when compute is short).
const PALL_RUNS = Number(args['pall-runs'] || RUNS);
// B26-B28 variants run on the first VARIANT_RUNS seeds of the PALL planner cell (paired seeds, so at most PALL_RUNS).
const VARIANT_RUNS = Math.min(PALL_RUNS, Number(args['variant-runs'] || RUNS));
const SEED = BAL.SEED_BASE;
const pool = new Pool(WORKERS);
const manifestFile = join(OUT, 'pass.json');
const manifest = existsSync(manifestFile) ? readJson(manifestFile) : { cells: {}, warmups: {} };
manifest.meta = { commit: commitInfo(), started: manifest.meta ? manifest.meta.started : new Date().toISOString(), runs: RUNS, styleRuns: STYLE_RUNS, halfRuns: HALF, diagRuns: DIAG_RUNS, variantRuns: VARIANT_RUNS, pallRuns: PALL_RUNS, campaigns: CAMPAIGNS, seedBase: SEED, workers: WORKERS, node: process.version };
const save = () => writeJson(manifestFile, manifest);
const log = (m) => process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${m}\n`);

/** Run (or, with --resume, reload) one batch cell. Returns { perClass: {cls: {records, metrics, obs}} }. */
async function cell(name, o) {
  const dir = join(OUT, name);
  if (args.resume && existsSync(join(dir, 'summary.json'))) {
    const sum = readJson(join(dir, 'summary.json'));
    const risk = readJson(join(dir, 'risk.json'));
    const perClass = {};
    for (const cls of Object.keys(sum.classes)) perClass[cls] = { records: readJsonl(join(dir, `runs-${cls}.jsonl`)), metrics: sum.classes[cls].metrics, obs: risk[cls], tree: sum.classes[cls].tree };
    log(`${name}: reloaded`);
    return { perClass };
  }
  log(`${name}: start`);
  const r = await runBatch({ pool, out: OUT, name, workers: WORKERS, quiet: true, warmup: 0, runs: RUNS, seedStart: SEED, ...o });
  manifest.cells[name] = { dir: name, bot: o.bot, prof: o.prof, trees: o.trees, style: o.style || null, variant: o.variant || null, pet: o.pet || null, runs: o.runs || RUNS, classes: o.classes, wallS: Math.round(r.meta.wallMs / 1000) };
  save();
  const brief = Object.entries(r.perClass).map(([c, x]) => `${c} ${(x.metrics.win.p * 100).toFixed(1)} %/${(x.metrics.boss.p * 100).toFixed(0)} %`).join(', ');
  log(`${name}: done in ${(r.meta.wallMs / 1000).toFixed(0)} s (win/boss: ${brief})`);
  return r;
}

/** Planner warm-up for the risk table (observations only; runs discarded). */
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
const t0 = performance.now();
try {
  let trees = manifest.trees || null;
  let obsP0 = existsSync(join(OUT, 'obs-P0.json')) ? readJson(join(OUT, 'obs-P0.json')) : null;
  if (STAGES.has('A')) {
    const w0 = await warmup('P0', 'fresh', SIM.DEFAULT_TREE, null, WARM);
    const byTree = [];
    for (let t = 0; t < 3; t++) {
      const tr = Object.fromEntries(CLASSES.map((c) => [c, t]));
      byTree.push(await cell(`planner-P0-tree${t}`, { bot: 'planner', classes: CLASSES, prof: 'fresh', trees: tr, obsIn: w0 }));
    }
    trees = {};
    for (const cls of CLASSES) {
      let best = 0;
      for (let t = 1; t < 3; t++) {
        const a = byTree[t].perClass[cls].metrics;
        const b = byTree[best].perClass[cls].metrics;
        if (a.win.p > b.win.p || (a.win.p === b.win.p && a.boss.p > b.boss.p)) best = t;
      }
      trees[cls] = best;
    }
    manifest.trees = trees;
    manifest.plannerP0 = Object.fromEntries(CLASSES.map((c) => [c, `planner-P0-tree${trees[c]}`]));
    save();
    log(`B7 best trees: ${JSON.stringify(trees)}`);
    obsP0 = Object.fromEntries(CLASSES.map((c) => [c, byTree[trees[c]].perClass[c].obs]));
    writeJson(join(OUT, 'obs-P0.json'), obsP0);
    await cell('random-P0', { bot: 'random', classes: CLASSES, prof: 'fresh', trees });
    for (const bot of ['greedy', 'speedrunner', 'tactician']) await cell(`${bot}-P0`, { bot, classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0 });
  }
  if (!trees || !obsP0) throw new Error('stage A results missing (run stage A first)');
  if (STAGES.has('B')) {
    const w10 = await warmup('P10', 'meta10', trees, obsP0, Math.round(WARM / 2));
    await cell('planner-P10', { bot: 'planner', classes: CLASSES, prof: 'meta10', trees, obsIn: w10 });
    await cell('random-P10', { bot: 'random', classes: CLASSES, prof: 'meta10', trees });
  }
  if (STAGES.has('C')) {
    const wall = await warmup('PALL', 'all', trees, obsP0, WARM);
    const pall = await cell('planner-PALL', { bot: 'planner', classes: CLASSES, prof: 'all', trees, obsIn: wall, runs: PALL_RUNS });
    const obsAll = obsOf(pall);
    writeJson(join(OUT, 'obs-PALL.json'), obsAll);
    await cell('random-PALL', { bot: 'random', classes: CLASSES, prof: 'all', trees, runs: PALL_RUNS });
    for (const bot of ['greedy', 'speedrunner']) await cell(`${bot}-PALL`, { bot, classes: CLASSES, prof: 'all', trees, obsIn: obsAll, runs: PALL_RUNS });
    await cell('tactician-PALL', { bot: 'tactician', classes: CLASSES, prof: 'all', trees, obsIn: obsAll, runs: HALF });
    for (const variant of ['noInterrupt', 'noCleanse', 'noAoe']) await cell(`planner-PALL-${variant}`, { bot: 'planner', classes: CLASSES, prof: 'all', trees, obsIn: obsAll, variant, runs: VARIANT_RUNS });
  }
  if (STAGES.has('D')) {
    // Campaigns (B31, B32): frozen table from the P0 planner of each class.
    if (!(args.resume && existsSync(join(OUT, 'campaigns', 'campaigns.json')))) {
      log('campaigns: start');
      const res = {};
      for (const cls of CLASSES) {
        res[cls] = await runCampaigns(pool, { bot: 'planner', cls, tree: trees[cls] }, { count: CAMPAIGNS, seedStart: SIM.CAMPAIGN_SEED_BASE, maxRuns: BAL.CAMPAIGN_MAX_RUNS, table: buildTable(obsP0[cls]) });
        log(`campaigns ${cls}: ${(res[cls].wallMs / 1000).toFixed(0)} s`);
      }
      const meta = { commit: commitInfo(), date: new Date().toISOString().slice(0, 10), count: CAMPAIGNS, seedStart: SIM.CAMPAIGN_SEED_BASE, maxRuns: BAL.CAMPAIGN_MAX_RUNS, trees, riskIn: 'P0 planner final observations (obs-P0.json)' };
      const dir = ensureDir(join(OUT, 'campaigns'));
      writeJson(join(dir, 'campaigns.json'), { meta, classes: Object.fromEntries(Object.entries(res).map(([c, r]) => [c, r.campaigns])) });
      writeFileSync(join(dir, 'summary.md'), campaignMarkdown(meta, Object.fromEntries(Object.entries(res).map(([c, r]) => [c, campaignMetrics(r.campaigns)]))));
    }
    // B35: replay QA_REPLAY_RUNS random runs from seed + action log with the pure step; compare final state hashes.
    if (!(args.resume && existsSync(join(OUT, 'health.json')))) {
      log('B35 replay: start');
      const n = REPLAY;
      const per = Math.ceil(n / CLASSES.length);
      let same = 0;
      let total = 0;
      const mismatches = [];
      for (const cls of CLASSES) {
        const c = { bot: 'random', cls, prof: 'fresh', tree: trees[cls], style: null, variant: null, pet: null };
        const tasks = [];
        for (let i = 0; i < per && total + i < n; i += SIM.TASK_RUNS) {
          const seeds = [];
          for (let j = i; j < Math.min(per, i + SIM.TASK_RUNS); j++) seeds.push(SIM.REPLAY_SEED_BASE + j);
          tasks.push({ kind: 'runs', cell: c, seeds, table: null, opts: { log: true, hash: true } });
        }
        const res = await pool.all(tasks);
        for (const r of res) for (const rec of r.records) {
          total++;
          const h = replayHash(c, rec.seed, rec.log);
          if (h === rec.hash) same++; else mismatches.push({ cls, seed: rec.seed });
        }
      }
      // B37: autoplay throughput on one core (engine autoAction from CREATE to ENDED, no rendering).
      const tp = {};
      for (const cls of CLASSES) {
        const t1 = performance.now();
        const N = 100;
        for (let i = 0; i < N; i++) {
          const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed: SIM.REPLAY_SEED_BASE + i });
          while (s.phase !== 'ENDED') R.stepInPlace(s, R.autoAction(s));
        }
        tp[cls] = Math.round(N / ((performance.now() - t1) / 60000));
      }
      writeJson(join(OUT, 'health.json'), { replay: { runs: total, identical: same, mismatches: mismatches.slice(0, 20), seeds: `${SIM.REPLAY_SEED_BASE}-${SIM.REPLAY_SEED_BASE + per - 1} per class` }, autoplayRunsPerMinPerCore: tp });
      log(`B35: ${same}/${total} identical; B37 autoplay runs/min/core ${JSON.stringify(tp)}`);
    }
  }
  if (STAGES.has('E')) {
    // P2 and diagnostic cells: B9 pets, B8 route styles, the rules-only tactician.
    const obsAll = readJson(join(OUT, 'obs-PALL.json'));
    for (const pet of ['thornback', 'duskcat']) await cell(`planner-P0-${pet}`, { bot: 'planner', classes: ['hunter'], prof: 'fresh', trees, obsIn: obsP0, pet });
    for (const style of ['quest', 'grind', 'elite', 'speed']) await cell(`planner-P0-${style}`, { bot: 'planner', classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0, style, runs: STYLE_RUNS });
    for (const style of ['quest', 'grind', 'elite', 'speed']) await cell(`planner-PALL-${style}`, { bot: 'planner', classes: CLASSES, prof: 'all', trees, obsIn: obsAll, style, runs: Math.min(STYLE_RUNS, PALL_RUNS) });
    await cell('tactician-P0-rulesOnly', { bot: 'tactician', classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0, variant: 'rulesOnly', runs: DIAG_RUNS });
  }
  manifest.meta.finished = new Date().toISOString();
  manifest.meta.wallMin = Math.round((performance.now() - t0) / 60000);
  save();
  log(`pass done in ${manifest.meta.wallMin} min (this invocation)`);
} finally {
  await pool.close();
}
