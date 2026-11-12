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
//            --think (mash report: replay every non-boss fight with the bot's own combat policy, the opener's opening
//            then autoplay, and autoplay; the record's `tk`, sim/lib/replay.mjs replayThink)   --think-mash (the same
//            fights with the bot's own policy and the masher; `tm`, replayMash)
//            onebutton: --variant nopot (no healing items in fights); default trees: the slot-1 trees
//            expedition map (expedition.md 10-11, MILESTONES 2b.4): --map expedition   --vision guide,charts,pathfinder
//            (vision kit, any subset)   --dimming off (B44 diagnostic)   --oracle (record C_step against the oracle, B41)
//            --route (with --oracle: C_route, the oracle replays every zone from its entry state on a copy, B41)
//            start camp and contracts (expedition.md 2-3, 10.2; MILESTONES 2b.5): --prep (with --map expedition)
//            --prep-policy none|random|auto (B40: every point to Reserve, or random purchases; D132: auto = autoplay's
//            start camp, the engine's R.autoAction; the bot's map play and hub contract are kept)
//            --exp-meta quartermaster:2,cartographer:1,old_hand:1 (expedition meta entries of 8.2 as profile unlocks)
//            M2b v10: --prep-force ember,draughts / --prep-ban draughts (start-camp options the planner family buys
//            first / never; cell 9 calibration)
//            --tables-in <risk.json> (the contract completion `ct` and Dimmed encounter `dim` observations of each class
//            are taken from this file, replacing those of --risk-in: the table pass of changes-m2b-v10.md cell 1)
//            M2b v11: --meta-drop scout,cartographer,old_hand (catalogue entries removed from the profile: B42's no-vision
//            cell, row 8's attribution arm)   --beastcall-gated (row 8 arm: Beastcall Horn cooldown BEASTCALL_HORN_CD_GATED)
//            PALL (--profile all) holds the expedition entries of 8.2 since the M2b v11 engine: no --exp-meta stand-in needed
//            M2b v12: --ricochet-gated (row 5 arm: Ricochet Bolt bounce RICOCHET_BOUNCE_FRAC_GATED; campaigns too)
//            speedrunner --variant v11 (row 4 off: the v11 expedition map policy, arm 9)
//            D128: --camp-options all|draughts,ember,... (the options the start camp offers: default the engine's
//            C.PREP_CAMP_OPTIONS; 'all' = every option, the camp before D128; cell mark 'campall' / 'camp<ids>');
//            --prep-force / --prep-ban refuse an option the cell's camp does not offer
//            M2b v13: --gates rareHpMultZ1,firstMeetWindup (the named C.GATES switches on, every other off)
//            M2b v14: without --gates a cell plays the engine's C.GATES defaults (the game as built); the cell name marks
//            every switch played at another value than its default ('g5', 'g6', 'sap', 'pst'; 'no<tag>' when off)
//            M2b v15: tag 'swift' (swiftRoad; off by default since D126, so the passage-on arm is '-swift':
//            --gates rareHpMultZ1,firstMeetWindup,sapHold,passStealth,swiftRoad); an arm names every switch that stays on
//            D128: tag 'rr' (campReroll, the start camp's reroll; off by default; the bots never reroll)
//   campaigns: --map expedition --prep also apply (B31 / B32 on the expedition with the start camp)
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
import { C, CAMP_LIST, campRefusal } from './lib/engine.mjs';
import { campaignMarkdown } from './lib/campaignreport.mjs';
import { defaultTrees, profileGroup } from './lib/trees.mjs';
import { oneButtonTrees } from './bots/onebutton.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const k = a.slice(2);
    if (k === 'log' || k === 'replay' || k === 'pairs' || k === 'think' || k === 'think-mash' || k === 'oracle' || k === 'route' || k === 'prep' || k === 'beastcall-gated' || k === 'ricochet-gated') { o[k] = true; continue; }
    o[k] = argv[++i];
  }
  return o;
}

const args = parse(process.argv.slice(2));
if (args.prep && args.map !== 'expedition') throw new Error('--prep needs --map expedition');
if (args['prep-policy'] && !['none', 'random', 'auto'].includes(args['prep-policy'])) throw new Error('--prep-policy must be none, random or auto');
const classes = !args.class || args.class === 'all' ? CLASSES : args.class.split(',');
for (const c of classes) if (!CLASSES.includes(c)) throw new Error(`unknown class ${c}`);
const workers = Number(args.workers || cpus().length);
const out = args.out || join('sim', 'out', new Date().toISOString().slice(0, 10));
// Campaigns start from P0, so they play the P0-group trees.
// The onebutton bot plays the slot-1 tree of each class (sim/bots/onebutton.mjs slot1Tree) unless --tree is given.
const groupTrees = args.bot === 'onebutton' && !args.campaign ? oneButtonTrees() : defaultTrees(args.campaign ? 'P0' : profileGroup(args.profile || 'fresh'));
const trees = Object.fromEntries(classes.map((c) => [c, args.tree !== undefined ? Number(args.tree) : groupTrees[c]]));
const obsIn = args['risk-in'] ? readJson(args['risk-in']) : null;
// M2b v10: completion and Dimmed encounter tables from a table pass, on top of --risk-in's node-risk observations.
if (args['tables-in']) {
  if (!obsIn) throw new Error('--tables-in needs --risk-in');
  const t = readJson(args['tables-in']);
  for (const c of classes) {
    if (!obsIn[c] || !t[c]) throw new Error(`--risk-in / --tables-in: no observations for ${c}`);
    delete obsIn[c].ct;
    delete obsIn[c].dim;
    if (t[c].ct) obsIn[c].ct = t[c].ct;
    if (t[c].dim) obsIn[c].dim = t[c].dim;
  }
}
// D128: --camp-options all | <ids> (the options the start camp offers; default the engine's C.PREP_CAMP_OPTIONS).
const prepList = (k) => args[k].split(',').map((x) => (x.startsWith('prep_') ? x : `prep_${x}`));
const campOptions = (() => {
  if (!args['camp-options']) return null;
  if (!args.prep) throw new Error('--camp-options needs --prep');
  if (args['camp-options'] === 'all') return 'all';
  const ids = prepList('camp-options');
  for (const id of ids) if (!C.PREP_OPTION[id]) throw new Error(`--camp-options: unknown option ${id}`);
  if (!CAMP_LIST) throw new Error('--camp-options <ids> needs an engine with C.PREP_CAMP_OPTIONS (D128); before it the camp offered every option');
  return ids;
})();
const prepIds = (k) => {
  if (!args[k]) return null;
  const ids = prepList(k);
  for (const id of ids) if (!C.PREP_OPTION[id]) throw new Error(`--${k}: unknown option ${id}`);
  if (!args.prep) throw new Error(`--${k} needs --prep`);
  // D128: an option the camp does not offer is never bought (BUY_PREP refuses it), so forcing or banning it is refused.
  const why = campRefusal(`--${k}`, ids, campOptions);
  if (why) throw new Error(why);
  return ids;
};
const prepForce = prepIds('prep-force');
const prepBan = prepIds('prep-ban');
const metaDrop = args['meta-drop'] ? args['meta-drop'].split(',') : null;
if (metaDrop) for (const id of metaDrop) if (!C.META[id]) throw new Error(`--meta-drop: unknown catalogue entry ${id}`);
if (args['beastcall-gated'] && C.BEASTCALL_HORN_CD_GATED === undefined) throw new Error('--beastcall-gated needs an engine with BEASTCALL_HORN_CD_GATED');
if (args['ricochet-gated'] && C.RICOCHET_BOUNCE_FRAC_GATED === undefined) throw new Error('--ricochet-gated needs an engine with RICOCHET_BOUNCE_FRAC_GATED');
const gates = args.gates ? Object.fromEntries(args.gates.split(',').map((k) => [k, true])) : null;
if (gates) for (const k of Object.keys(gates)) if (!C.GATES || !(k in C.GATES)) throw new Error(`--gates: unknown gate ${k} (C.GATES: ${C.GATES ? Object.keys(C.GATES).join(', ') : 'none'})`);
const pool = new Pool(workers);
try {
  if (args.campaign) {
    const n = Number(args.campaign);
    const res = {};
    for (const cls of classes) {
      const table = buildTable(obsIn && obsIn[cls] ? obsIn[cls] : { full: {}, td: {}, t: {}, runs: 0 });
      const ccell = { bot: 'planner', cls, tree: trees[cls], ...(args.map ? { map: args.map } : {}), ...(args.prep ? { prep: true } : {}), ...(args.vision ? { vision: Object.fromEntries(args.vision.split(',').map((k) => [k, true])) } : {}), ...(args['ricochet-gated'] ? { ricochetGated: true } : {}) };
      res[cls] = await runCampaigns(pool, ccell, { count: n, seedStart: Number(args['seed-start'] || SIM.CAMPAIGN_SEED_BASE), maxRuns: BAL.CAMPAIGN_MAX_RUNS, table });
      process.stderr.write(`campaigns ${cls}: ${n} done in ${(res[cls].wallMs / 1000).toFixed(1)} s\n`);
    }
    const dir = ensureDir(join(out, 'campaigns'));
    const meta = { commit: commitInfo(), date: new Date().toISOString().slice(0, 10), count: n, seedStart: Number(args['seed-start'] || SIM.CAMPAIGN_SEED_BASE), maxRuns: BAL.CAMPAIGN_MAX_RUNS, trees, riskIn: args['risk-in'] || null, map: args.map || 'rows', prep: !!args.prep, tablesIn: args['tables-in'] || null, ricochetGated: !!args['ricochet-gated'] };
    writeJson(join(dir, 'campaigns.json'), { meta, classes: Object.fromEntries(Object.entries(res).map(([c, r]) => [c, r.campaigns])) });
    writeFileSync(join(dir, 'summary.md'), campaignMarkdown(meta, Object.fromEntries(Object.entries(res).map(([c, r]) => [c, r.campaigns]))));
    console.log(`wrote ${dir}`);
  } else {
    if (!BOT_NAMES.includes(args.bot)) throw new Error(`--bot must be one of ${BOT_NAMES.join(', ')}`);
    const r = await runBatch({
      pool, bot: args.bot, classes, runs: Number(args.runs || BAL.N_RUNS_PER_CELL), seedStart: Number(args['seed-start'] || BAL.SEED_BASE),
      prof: args.profile || 'fresh', trees, style: args.style || null, variant: args.variant || null, pet: args.pet || null,
      out, warmup: args.warmup !== undefined ? Number(args.warmup) : SIM.WARMUP_RUNS, obsIn, log: !!args.log, workers, replay: !!args.replay, pairs: !!args.pairs, think: !!args.think, thinkMash: !!args['think-mash'],
      map: args.map || null, vision: args.vision ? Object.fromEntries(args.vision.split(',').map((k) => [k, true])) : null, dimming: args.dimming === 'off' ? false : true, oracle: !!args.oracle, route: !!args.route,
      prep: !!args.prep, prepPolicy: args['prep-policy'] || null, prepForce, prepBan, campOptions, tablesIn: args['tables-in'] || null, metaDrop, beastcallGated: !!args['beastcall-gated'], ricochetGated: !!args['ricochet-gated'], gates,
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
