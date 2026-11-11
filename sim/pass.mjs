#!/usr/bin/env node
// Full balance pass (M2 2.2): every cell the balance report needs, in dependency order, then campaigns, the
// replay check (B35) and the throughput check (B37). Results go to <out>/<cell>/ (see sim/run.mjs) plus
// <out>/pass.json; build the report with sim/report.mjs.
//
//   node sim/pass.mjs --out sim/out/pass-2026-11-09 [--runs 2000] [--style-runs 1000] [--workers N]
//                     [--stages A,T,G,H,B,C,D,E,F] [--resume] [--warmup 1000] [--campaigns 50] [--replay 1000] [--half-runs 1000]
//                     [--variant-runs 2000] [--pall-runs 2000] [--diag-runs 1000] [--opener-runs 1000] [--tact-runs 2000]
//                     [--heat-runs 2000]
// Stages run in the order A, T, G, B, C, D, H, E, F whatever the order given; a later invocation with --resume reloads
// the cells an earlier one wrote (stage T and H need stage A's results on disk).
//
// Order and risk-table chain (balance.md 1.1; each cell keeps refreshing its own table every SIM_RISK_REFRESH runs).
// Default trees (balance.md 1.3, M2 v5, D43): one per class and profile group, chosen by the switch rule
// (sim/lib/trees.mjs) from that group's planner cells with each tree, the incumbents being SIM.DEFAULT_TREE (P0 group)
// and SIM.DEFAULT_TREE_PALL (PALL group); pass.json records the incumbents, the choice and both tree sets.
//   A  P0:   planner warm-up (P0 incumbents) -> B7 planner with each tree -> P0-group trees by the switch rule ->
//            random, greedy, speedrunner; all start from the chosen-tree planner's final observations.
//   T  P0 tactician (--tact-runs, default --runs; the most expensive P0 cell, so it has its own stage and size), from
//            the chosen-tree planner's final observations. B5 fallback (balance.md 1.3): if tactician - planner on P0 is
//            under B5's floor, the tactician cell is re-run with each class's best B7 point-estimate tree
//            (tactician-P0-b5, only the classes whose tree differs; the others keep their tactician-P0 runs, which the
//            same tree and seeds would repeat) and that cell counts for B1 tactician and B5. B5's floor is the lower
//            bound of MANUAL_GAP_V2 (combat-v2.md 12 changed B5's band from MANUAL_GAP) [inference: "its floor" in 1.3
//            is the band in force]. The comparison uses the planner on the tactician's seeds (paired subset).
//   B  P10:  planner warm-up from the P0 observations -> planner, random (P0-group trees).
//   C  PALL: planner warm-up (PALL incumbents) from the P0 observations -> planner with each tree (--pall-runs) ->
//            PALL-group trees by the switch rule; the chosen-tree cell of each class is the planner PALL cell, whose
//            observations become obs-PALL.json -> random, greedy, speedrunner (--pall-runs; also caps the PALL
//            route-style cells of stage E), B26-B28 variants (--variant-runs, paired with the planner's first seeds);
//            all on the PALL-group trees and from the PALL planner's observations.
//   D  campaigns (P0-group trees, frozen P0 planner table), B35 replay of 1 000 random runs, B37 autoplay throughput.
//   F  the PALL tactician (PALL-group trees; --half-runs; last, so its size can follow the compute left).
//   E  P2 and diagnostic cells: B9 pets and B8 styles (P0 from the P0 planner's observations, PALL from the PALL
//            planner's, each on its group's trees), the rules-only tactician (telegraph rules, no search;
//            --diag-runs; P0-group trees).
//   G  combat v2 cells (combat-v2.md 11-12; B48-B55): masher P0 with the B50 fight replays and opener P0
//            (--opener-runs, default --half-runs), P0-group trees, from the P0 planner's observations.
//   H  heat (expedition.md H.6; B58, B56, B57): heat-seek and heat-avoid planner P0 cells (--heat-runs, default --runs),
//            P0-group trees, from the P0 warm-up observations (warmup-P0.json), as the B7 cells, so they are paired by
//            class and seed with the planner P0 cell. B57's arm (the planner on an engine without the H.3 rewards) is a
//            scratch copy outside this script (sim/report.mjs --heat-off).
import { cpus } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { BAL, SIM, C2 } from './lib/params.mjs';
import { Pool } from './lib/pool.mjs';
import { runBatch, CLASSES } from './lib/session.mjs';
import { runCell, runCampaigns } from './lib/batch.mjs';
import { buildTable } from './lib/risk.mjs';
import { campaignMarkdown } from './lib/campaignreport.mjs';
import { replayHash } from './lib/runner.mjs';
import { R, newRunFor } from './lib/engine.mjs';
import { readJson, writeJson, readJsonl, commitInfo, ensureDir } from './lib/output.mjs';
import { treeSwitch, bestPointTree, defaultTrees } from './lib/trees.mjs';
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
const STAGES = new Set(String(args.stages || 'A,T,G,B,C,D,H,E,F').split(','));
const WARM = Number(args.warmup ?? SIM.WARMUP_RUNS);
const CAMPAIGNS = Number(args.campaigns ?? BAL.N_CAMPAIGNS);
const REPLAY = Number(args.replay ?? BAL.QA_REPLAY_RUNS);
// The PALL tactician (B3 is an upper bound) runs at half size (compute budget); the diagnostic rules-only tactician
// (no search, cheap) at --diag-runs (default: the same).
const HALF = Number(args['half-runs'] || Math.round(RUNS / 2));
const DIAG_RUNS = Number(args['diag-runs'] || HALF);
// Combat v2 opener cell (stage G; the second most expensive bot).
const OPENER_RUNS = Number(args['opener-runs'] || HALF);
// PALL planner, random, greedy and speedrunner cells (the first to cut when compute is short).
const PALL_RUNS = Number(args['pall-runs'] || RUNS);
// P0 tactician (stage T; B1 tactician and B5) and the heat cells (stage H).
const TACT_RUNS = Number(args['tact-runs'] || RUNS);
const HEAT_RUNS = Number(args['heat-runs'] || RUNS);
// B5's floor for the fallback (balance.md 1.3): the lower bound of the B5 band in force (combat-v2.md 12, MANUAL_GAP_V2 in pp).
const B5_FLOOR = C2.MANUAL_GAP_V2[0] / 100;
// B26-B28 variants run on the first VARIANT_RUNS seeds of the PALL planner cell (paired seeds, so at most PALL_RUNS).
const VARIANT_RUNS = Math.min(PALL_RUNS, Number(args['variant-runs'] || RUNS));
const SEED = BAL.SEED_BASE;
const pool = new Pool(WORKERS);
const manifestFile = join(OUT, 'pass.json');
const manifest = existsSync(manifestFile) ? readJson(manifestFile) : { cells: {}, warmups: {} };
// Each invocation records its own commit and sizes (a pass made in several invocations keeps the list in meta.runsBy).
const invocation = { commit: commitInfo(), stages: [...STAGES].join(','), at: new Date().toISOString(), runs: RUNS, tactRuns: TACT_RUNS, openerRuns: OPENER_RUNS, heatRuns: HEAT_RUNS, halfRuns: HALF, simOverride: process.env.SIM_OVERRIDE || null };
manifest.meta = { ...(manifest.meta || {}), commit: commitInfo(), started: manifest.meta ? manifest.meta.started : new Date().toISOString(), runs: RUNS, styleRuns: STYLE_RUNS, halfRuns: HALF, diagRuns: DIAG_RUNS, openerRuns: OPENER_RUNS, tactRuns: TACT_RUNS, heatRuns: HEAT_RUNS, variantRuns: VARIANT_RUNS, pallRuns: PALL_RUNS, campaigns: CAMPAIGNS, seedBase: SEED, workers: WORKERS, node: process.version };
manifest.meta.runsBy = [...((manifest.meta && manifest.meta.runsBy) || []), invocation];
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
  manifest.cells[name] = { dir: name, bot: o.bot, prof: o.prof, trees: o.trees, style: o.style || null, variant: o.variant || null, pet: o.pet || null, runs: o.runs || RUNS, classes: o.classes, replay: !!o.replay, wallS: Math.round(r.meta.wallMs / 1000) };
  save();
  const brief = Object.entries(r.perClass).map(([c, x]) => `${c} ${(x.metrics.win.p * 100).toFixed(1)} %/${(x.metrics.boss.p * 100).toFixed(0)} %`).join(', ');
  log(`${name}: done in ${(r.meta.wallMs / 1000).toFixed(0)} s (win/boss: ${brief})`);
  return r;
}

/** Reload a cell written earlier (by this or an earlier invocation); throws if it is missing. */
function loadCell(name) {
  const dir = join(OUT, name);
  if (!existsSync(join(dir, 'summary.json'))) throw new Error(`cell ${name} missing (run its stage first)`);
  const sum = readJson(join(dir, 'summary.json'));
  const risk = readJson(join(dir, 'risk.json'));
  const perClass = {};
  for (const cls of Object.keys(sum.classes)) perClass[cls] = { records: readJsonl(join(dir, `runs-${cls}.jsonl`)), metrics: sum.classes[cls].metrics, obs: risk[cls], tree: sum.classes[cls].tree };
  return { perClass };
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

/**
 * Default trees of a profile group by the switch rule (balance.md 1.3, M2 v5): byTree[t] = the planner cell with
 * tree t for every class; incumbents = the recorded defaults. Records the choice in the manifest; returns the trees.
 */
function chooseTrees(group, byTree, incumbents) {
  const choice = {};
  for (const cls of CLASSES) choice[cls] = treeSwitch(byTree.map((r) => r.perClass[cls].metrics), incumbents[cls]);
  manifest.incumbents = { ...(manifest.incumbents || {}), [group]: incumbents };
  manifest.treeChoice = { ...(manifest.treeChoice || {}), [group]: choice };
  const trees = Object.fromEntries(CLASSES.map((c) => [c, choice[c].tree]));
  const note = CLASSES.map((c) => {
    const x = choice[c];
    const b = x.best;
    return `${c} ${x.switched ? 'switch' : 'keep'} ${x.tree} (incumbent ${x.incumbent} ${(x.incP * 100).toFixed(1)} %; best challenger ${b.tree} ${(b.p * 100).toFixed(1)} %, gap ${(b.gap * 100).toFixed(1)} pp, threshold ${(b.threshold * 100).toFixed(1)} pp)`;
  }).join('; ');
  log(`${group}-group trees: ${note}`);
  return trees;
}

/** Pooled win rate { k, n, p } of per-class metrics (all classes of the cell). */
function pooledWin(perClass) {
  let k = 0;
  let n = 0;
  for (const x of Object.values(perClass)) { k += x.metrics.win.k; n += x.metrics.win.n; }
  return { k, n, p: n ? k / n : null };
}

const t0 = performance.now();
try {
  let trees = manifest.trees || null;
  let treesPALL = manifest.treesPALL || null;
  let obsP0 = existsSync(join(OUT, 'obs-P0.json')) ? readJson(join(OUT, 'obs-P0.json')) : null;
  if (STAGES.has('A')) {
    const incP0 = manifest.incumbents && manifest.incumbents.P0 ? manifest.incumbents.P0 : defaultTrees('P0');
    const w0 = await warmup('P0', 'fresh', incP0, null, WARM);
    const byTree = [];
    for (let t = 0; t < 3; t++) {
      const tr = Object.fromEntries(CLASSES.map((c) => [c, t]));
      byTree.push(await cell(`planner-P0-tree${t}`, { bot: 'planner', classes: CLASSES, prof: 'fresh', trees: tr, obsIn: w0 }));
    }
    trees = chooseTrees('P0', byTree, incP0);
    manifest.trees = trees;
    manifest.plannerP0 = Object.fromEntries(CLASSES.map((c) => [c, `planner-P0-tree${trees[c]}`]));
    save();
    obsP0 = Object.fromEntries(CLASSES.map((c) => [c, byTree[trees[c]].perClass[c].obs]));
    writeJson(join(OUT, 'obs-P0.json'), obsP0);
    await cell('random-P0', { bot: 'random', classes: CLASSES, prof: 'fresh', trees });
    for (const bot of ['greedy', 'speedrunner']) await cell(`${bot}-P0`, { bot, classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0 });
    save();
  }
  if (!trees || !obsP0) throw new Error('stage A results missing (run stage A first)');
  if (STAGES.has('T')) {
    // The P0 tactician from the chosen-tree planner's final observations (stage A's obs-P0.json).
    const tac = await cell('tactician-P0', { bot: 'tactician', classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0, runs: TACT_RUNS });
    // B5 fallback (balance.md 1.3, M2 v5): tactician - planner on P0 under B5's floor -> re-run the tactician with each
    // class's best B7 point-estimate tree; that cell counts for B1 tactician and B5. The planner side is the default-tree
    // B7 cells on the tactician's seeds (the first TACT_RUNS seeds of each class).
    const byTree = [0, 1, 2].map((t) => loadCell(`planner-P0-tree${t}`));
    const plannerWin = { k: 0, n: 0 };
    for (const cls of CLASSES) {
      const xs = byTree[trees[cls]].perClass[cls].records.filter((r) => r.seed < SEED + TACT_RUNS && r.out !== 'x');
      plannerWin.k += xs.filter((r) => r.out === 'v').length;
      plannerWin.n += xs.length;
    }
    const tacWin = pooledWin(tac.perClass);
    const b5 = tacWin.p - plannerWin.k / plannerWin.n;
    const fbTrees = Object.fromEntries(CLASSES.map((c) => [c, bestPointTree(byTree.map((r) => r.perClass[c].metrics))]));
    const rerun = CLASSES.filter((c) => fbTrees[c] !== trees[c]);
    manifest.b5 = { onGroupTrees: b5, floor: B5_FLOOR, floorSource: 'MANUAL_GAP_V2 (combat-v2.md 12)', applied: b5 < B5_FLOOR, trees: fbTrees, rerun, plannerSeeds: `first ${TACT_RUNS} per class` };
    manifest.tacticianP0 = Object.fromEntries(CLASSES.map((c) => [c, 'tactician-P0']));
    if (manifest.b5.applied) {
      log(`B5 on the P0-group trees ${(b5 * 100).toFixed(1)} pp < ${(B5_FLOOR * 100).toFixed(0)} pp: fallback trees ${JSON.stringify(fbTrees)} (re-run: ${rerun.join(', ') || 'none, same trees'})`);
      if (rerun.length) {
        const obsFb = Object.fromEntries(rerun.map((c) => [c, byTree[fbTrees[c]].perClass[c].obs]));
        await cell('tactician-P0-b5', { bot: 'tactician', classes: rerun, prof: 'fresh', trees: fbTrees, obsIn: obsFb, runs: TACT_RUNS });
        for (const c of rerun) manifest.tacticianP0[c] = 'tactician-P0-b5';
      }
    } else log(`B5 on the P0-group trees ${(b5 * 100).toFixed(1)} pp: no fallback`);
    save();
  }
  if (STAGES.has('G')) {
    await cell('masher-P0', { bot: 'masher', classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0, replay: true });
    await cell('opener-P0', { bot: 'opener', classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0, runs: OPENER_RUNS });
  }
  if (STAGES.has('B')) {
    const w10 = await warmup('P10', 'meta10', trees, obsP0, Math.round(WARM / 2));
    await cell('planner-P10', { bot: 'planner', classes: CLASSES, prof: 'meta10', trees, obsIn: w10 });
    await cell('random-P10', { bot: 'random', classes: CLASSES, prof: 'meta10', trees });
  }
  if (STAGES.has('C')) {
    const incPALL = manifest.incumbents && manifest.incumbents.PALL ? manifest.incumbents.PALL : defaultTrees('PALL');
    const wall = await warmup('PALL', 'all', incPALL, obsP0, WARM);
    const byTree = [];
    for (let t = 0; t < 3; t++) {
      const tr = Object.fromEntries(CLASSES.map((c) => [c, t]));
      byTree.push(await cell(`planner-PALL-tree${t}`, { bot: 'planner', classes: CLASSES, prof: 'all', trees: tr, obsIn: wall, runs: PALL_RUNS }));
    }
    treesPALL = chooseTrees('PALL', byTree, incPALL);
    manifest.treesPALL = treesPALL;
    manifest.plannerPALL = Object.fromEntries(CLASSES.map((c) => [c, `planner-PALL-tree${treesPALL[c]}`]));
    save();
    const obsAll = Object.fromEntries(CLASSES.map((c) => [c, byTree[treesPALL[c]].perClass[c].obs]));
    writeJson(join(OUT, 'obs-PALL.json'), obsAll);
    await cell('random-PALL', { bot: 'random', classes: CLASSES, prof: 'all', trees: treesPALL, runs: PALL_RUNS });
    for (const bot of ['greedy', 'speedrunner']) await cell(`${bot}-PALL`, { bot, classes: CLASSES, prof: 'all', trees: treesPALL, obsIn: obsAll, runs: PALL_RUNS });
    for (const variant of ['noInterrupt', 'noCleanse', 'noAoe']) await cell(`planner-PALL-${variant}`, { bot: 'planner', classes: CLASSES, prof: 'all', trees: treesPALL, obsIn: obsAll, variant, runs: VARIANT_RUNS });
  }
  const needPALL = () => {
    if (!treesPALL) throw new Error('stage C results missing (run stage C first: the PALL-group trees)');
    return treesPALL;
  };
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
      writeFileSync(join(dir, 'summary.md'), campaignMarkdown(meta, Object.fromEntries(Object.entries(res).map(([c, r]) => [c, r.campaigns]))));
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
  if (STAGES.has('H')) {
    // Heat policies (expedition.md H.6): from the P0 warm-up observations, as the B7 cells (paired with planner P0).
    const wh = readJson(join(OUT, 'warmup-P0.json'));
    for (const variant of ['heatSeek', 'heatAvoid']) await cell(`planner-P0-${variant}`, { bot: 'planner', classes: CLASSES, prof: 'fresh', trees, obsIn: wh, variant, runs: HEAT_RUNS });
  }
  if (STAGES.has('E')) {
    // P2 and diagnostic cells: B9 pets, B8 route styles, the rules-only tactician.
    const obsAll = readJson(join(OUT, 'obs-PALL.json'));
    for (const pet of ['thornback', 'duskcat']) await cell(`planner-P0-${pet}`, { bot: 'planner', classes: ['hunter'], prof: 'fresh', trees, obsIn: obsP0, pet });
    for (const style of ['quest', 'grind', 'elite', 'speed']) await cell(`planner-P0-${style}`, { bot: 'planner', classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0, style, runs: STYLE_RUNS });
    for (const style of ['quest', 'grind', 'elite', 'speed']) await cell(`planner-PALL-${style}`, { bot: 'planner', classes: CLASSES, prof: 'all', trees: needPALL(), obsIn: obsAll, style, runs: Math.min(STYLE_RUNS, PALL_RUNS) });
    await cell('tactician-P0-rulesOnly', { bot: 'tactician', classes: CLASSES, prof: 'fresh', trees, obsIn: obsP0, variant: 'rulesOnly', runs: DIAG_RUNS });
  }
  if (STAGES.has('F')) {
    // The PALL tactician (B3 upper bound; the most expensive cell) runs last, sized to the compute that is left.
    const obsAll = readJson(join(OUT, 'obs-PALL.json'));
    await cell('tactician-PALL', { bot: 'tactician', classes: CLASSES, prof: 'all', trees: needPALL(), obsIn: obsAll, runs: HALF });
  }
  manifest.meta.finished = new Date().toISOString();
  manifest.meta.wallMin = Math.round((performance.now() - t0) / 60000);
  save();
  log(`pass done in ${manifest.meta.wallMin} min (this invocation)`);
} finally {
  await pool.close();
}
