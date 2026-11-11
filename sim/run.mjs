#!/usr/bin/env node
// Batch mode (M2 2.1-2.2): N seeded runs per class with one bot, across worker threads.
//
//   node sim/run.mjs --bot <random|greedy|planner|speedrunner|tactician|masher|opener> --class <rogue|mage|hunter|all>
//                    --runs N --seed-start S --profile <fresh|metaN|all> --out <dir>
//   options: --tree <0|1|2> (default: the recorded default tree of the class and profile group, balance.md 1.3:
//            SIM.DEFAULT_TREE, with --profile all SIM.DEFAULT_TREE_PALL)   --style <balanced|quest|grind|elite|speed>
//            --variant <noInterrupt|noCleanse|noAoe|heatSeek|heatAvoid>   --pet <id>   --workers N (default: all cores)
//            --warmup N (planner warm-up runs for the risk table, default SIM.WARMUP_RUNS; 0 = start at RISK_PRIOR)
//            --risk-in <risk.json of an earlier batch>   --log (keep action logs in runs-*.jsonl)
//            --replay (B50, combat-v2.md 11: replay every non-boss fight that ends a run in death; used with the masher)
//            --pairs (diagnostic: replay every non-boss fight with autoplay's, the opener's and the masher's opening)
//            expedition map (expedition.md 10-11, MILESTONES 2b.4): --map expedition   --vision guide,charts,pathfinder
//            (vision kit, any subset)   --dimming off (B44 diagnostic)   --oracle (record C_step against the oracle, B41)
//            --route (with --oracle: C_route, the oracle replays every zone from its entry state on a copy, B41)
//            start camp and contracts (expedition.md 2-3, 10.2; MILESTONES 2b.5): --prep (with --map expedition)
//            --prep-policy none|random (B40: every point to Reserve, or random purchases; the bot's map play is kept)
//            --exp-meta quartermaster:2,cartographer:1,old_hand:1 (expedition meta entries of 8.2 as profile unlocks)
//   campaigns: node sim/run.mjs --campaign N --class <c|all> --out <dir> [--risk-in <risk.json>]
//
// Writes <out>/<bot>-<profile>[-style][-variant][-pet]/{runs-<class>.jsonl, summary.json, summary.md, risk.json}.
// Same seeds and options give the same results for any --workers (see sim/lib/batch.mjs).
import { cpus } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { BAL, SIM } from './lib/params.mjs';
import { Pool } from './lib/pool.mjs';
import { runBatch, CLASSES } from './lib/session.mjs';
import { runCampaigns } from './lib/batch.mjs';
import { buildTable } from './lib/risk.mjs';
import { BOT_NAMES } from './bots/index.mjs';
import { readJson, writeJson, commitInfo, ensureDir } from './lib/output.mjs';
import { campaignMarkdown } from './lib/campaignreport.mjs';
import { defaultTrees, profileGroup } from './lib/trees.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const k = a.slice(2);
    if (k === 'log' || k === 'replay' || k === 'pairs' || k === 'oracle' || k === 'route' || k === 'prep') { o[k] = true; continue; }
    o[k] = argv[++i];
  }
  return o;
}

const args = parse(process.argv.slice(2));
if (args.prep && args.map !== 'expedition') throw new Error('--prep needs --map expedition');
if (args['prep-policy'] && !['none', 'random'].includes(args['prep-policy'])) throw new Error('--prep-policy must be none or random');
const classes = !args.class || args.class === 'all' ? CLASSES : args.class.split(',');
for (const c of classes) if (!CLASSES.includes(c)) throw new Error(`unknown class ${c}`);
const workers = Number(args.workers || cpus().length);
const out = args.out || join('sim', 'out', new Date().toISOString().slice(0, 10));
// Campaigns start from P0, so they play the P0-group trees.
const groupTrees = defaultTrees(args.campaign ? 'P0' : profileGroup(args.profile || 'fresh'));
const trees = Object.fromEntries(classes.map((c) => [c, args.tree !== undefined ? Number(args.tree) : groupTrees[c]]));
const obsIn = args['risk-in'] ? readJson(args['risk-in']) : null;
const pool = new Pool(workers);
try {
  if (args.campaign) {
    const n = Number(args.campaign);
    const res = {};
    for (const cls of classes) {
      const table = buildTable(obsIn && obsIn[cls] ? obsIn[cls] : { full: {}, td: {}, t: {}, runs: 0 });
      res[cls] = await runCampaigns(pool, { bot: 'planner', cls, tree: trees[cls] }, { count: n, seedStart: Number(args['seed-start'] || SIM.CAMPAIGN_SEED_BASE), maxRuns: BAL.CAMPAIGN_MAX_RUNS, table });
      process.stderr.write(`campaigns ${cls}: ${n} done in ${(res[cls].wallMs / 1000).toFixed(1)} s\n`);
    }
    const dir = ensureDir(join(out, 'campaigns'));
    const meta = { commit: commitInfo(), date: new Date().toISOString().slice(0, 10), count: n, seedStart: Number(args['seed-start'] || SIM.CAMPAIGN_SEED_BASE), maxRuns: BAL.CAMPAIGN_MAX_RUNS, trees, riskIn: args['risk-in'] || null };
    writeJson(join(dir, 'campaigns.json'), { meta, classes: Object.fromEntries(Object.entries(res).map(([c, r]) => [c, r.campaigns])) });
    writeFileSync(join(dir, 'summary.md'), campaignMarkdown(meta, Object.fromEntries(Object.entries(res).map(([c, r]) => [c, r.campaigns]))));
    console.log(`wrote ${dir}`);
  } else {
    if (!BOT_NAMES.includes(args.bot)) throw new Error(`--bot must be one of ${BOT_NAMES.join(', ')}`);
    const r = await runBatch({
      pool, bot: args.bot, classes, runs: Number(args.runs || BAL.N_RUNS_PER_CELL), seedStart: Number(args['seed-start'] || BAL.SEED_BASE),
      prof: args.profile || 'fresh', trees, style: args.style || null, variant: args.variant || null, pet: args.pet || null,
      out, warmup: args.warmup !== undefined ? Number(args.warmup) : SIM.WARMUP_RUNS, obsIn, log: !!args.log, workers, replay: !!args.replay, pairs: !!args.pairs,
      map: args.map || null, vision: args.vision ? Object.fromEntries(args.vision.split(',').map((k) => [k, true])) : null, dimming: args.dimming === 'off' ? false : true, oracle: !!args.oracle, route: !!args.route,
      prep: !!args.prep, prepPolicy: args['prep-policy'] || null,
      expMeta: args['exp-meta'] ? Object.fromEntries(args['exp-meta'].split(',').map((x) => { const [id, r] = x.split(':'); return [id, Number(r || 1)]; })) : null,
    });
    for (const [cls, x] of Object.entries(r.perClass)) {
      const m = x.metrics;
      console.log(`${r.name} ${cls}: win ${(m.win.p * 100).toFixed(1)} % (${m.win.k}/${m.win.n}), boss ${(m.boss.p * 100).toFixed(1)} %, errors ${m.errors}, ${m.msPerRun.v.toFixed(1)} ms/run`);
    }
    console.log(`wrote ${r.dir} (${(r.meta.wallMs / 1000).toFixed(1)} s, commit ${r.meta.commit})`);
  }
} finally {
  await pool.close();
}
