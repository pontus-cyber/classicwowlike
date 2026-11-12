// One batch invocation (used by sim/run.mjs and sim/pass.mjs): per class, an optional risk warm-up, the
// measured runs, metrics, and the output files (runs.jsonl, summary.json, summary.md, risk.json).
import { join } from 'node:path';
import { BAL, SIM } from './params.mjs';
import { runCell } from './batch.mjs';
import { cellMetrics } from './metrics.mjs';
import { cellMarkdown } from './cellreport.mjs';
import { TIME_PROFILE } from '../bots/index.mjs';
import { commitInfo, cellName, writeJson, writeJsonl, ensureDir } from './output.mjs';
import { gatesFor, campOptionsFor } from './engine.mjs';
import { writeFileSync } from 'node:fs';

export const CLASSES = ['rogue', 'mage', 'hunter'];

/**
 * opts: { pool, bot, classes, runs, seedStart, prof, trees: {cls: tree}, style, variant, pet, out,
 *         warmup (runs, 0 = none), obsIn: {cls: obs}, log, quiet, workers, name, replay (B50 replays, combat-v2.md 11),
 *         think (mash report: replayThink of every non-boss fight, the record's `tk`), thinkMash (replayMash, `tm`),
 *         map ('expedition'), vision ({ guide, charts, pathfinder }), dimming (false: no Dimming), oracle (C_step), route (C_route),
 *         prep (start camp and contracts), prepPolicy ('none' | 'random', B40), expMeta ({ quartermaster, cartographer, old_hand }),
 *         prepForce / prepBan ([option id]: bought first / never by the planner family, M2b v10 cell 9), tablesIn (file name,
 *         for meta only), metaDrop ([catalogue id] removed from the profile), beastcallGated (M2b v11 row 8 arm), ricochetGated
 *         (M2b v12 row 5 arm), gates ({ key: true }: the C.GATES switches on, every other off; none: the engine's defaults,
 *         M2b v14; the meta's gatesPlayed holds the switches played), campOptions ('all' or [option id]: the start camp's
         options, D128; none: the engine's C.PREP_CAMP_OPTIONS; the meta's campPlayed holds the list played) }
 * Returns { name, dir, perClass: { cls: { records, metrics, obs, table } } }.
 */
export async function runBatch(opts) {
  const commit = commitInfo();
  const date = new Date().toISOString().slice(0, 10);
  const cellBase = {
    bot: opts.bot, prof: opts.prof, style: opts.style || null, variant: opts.variant || null, pet: opts.pet || null, ...(opts.replay ? { replay: true } : {}), ...(opts.pairs ? { pairs: true } : {}), ...(opts.think ? { think: true } : {}), ...(opts.thinkMash ? { thinkMash: true } : {}),
    // Expedition cells (MILESTONES 2b.4): map mode, vision kit, Dimming off (B44), oracle C_step (B41).
    ...(opts.map ? { map: opts.map } : {}), ...(opts.vision ? { vision: opts.vision } : {}), ...(opts.dimming === false ? { dimming: false } : {}), ...(opts.oracle ? { oracle: true } : {}), ...(opts.route ? { route: true } : {}),
    // Start camp and contracts (MILESTONES 2b.5): prep, the B40 prep overrides, the expedition meta entries.
    ...(opts.prep ? { prep: true } : {}), ...(opts.prepPolicy ? { prepPolicy: opts.prepPolicy } : {}), ...(opts.expMeta ? { expMeta: opts.expMeta } : {}),
    // M2b v10 cell 9: start-camp options the planner family buys first / never.
    ...(opts.prepForce ? { prepForce: opts.prepForce } : {}), ...(opts.prepBan ? { prepBan: opts.prepBan } : {}),
    // M2b v11: catalogue entries removed from the profile (B42 no-vision cell, row 8 attribution); row 8 arm.
    ...(opts.metaDrop ? { metaDrop: opts.metaDrop } : {}), ...(opts.beastcallGated ? { beastcallGated: true } : {}),
    // M2b v12 row 5 arm (gated Ricochet Bolt bounce).
    ...(opts.ricochetGated ? { ricochetGated: true } : {}),
    // M2b v13 gated rows 5-6 (C.GATES.rareHpMultZ1, C.GATES.firstMeetWindup; cells 6-7).
    ...(opts.gates ? { gates: opts.gates } : {}),
    // D128: the start camp's options ('all' or ids; none: the engine's C.PREP_CAMP_OPTIONS).
    ...(opts.campOptions ? { campOptions: opts.campOptions } : {}),
  };
  const name = opts.name || cellName({ ...cellBase, tree: null });
  const dir = opts.out ? ensureDir(join(opts.out, name)) : null;
  const perClass = {};
  const t0 = performance.now();
  let total = 0;
  const notes = [];
  for (const cls of opts.classes) {
    const tree = opts.trees[cls];
    const cell = { ...cellBase, cls, tree };
    let obsIn = opts.obsIn && opts.obsIn[cls] ? opts.obsIn[cls] : null;
    if (!obsIn && opts.warmup > 0 && opts.bot !== 'random') {
      const wcell = { bot: 'planner', cls, prof: opts.prof, tree, style: null, variant: null, pet: opts.pet || null, ...(opts.map ? { map: opts.map } : {}), ...(opts.prep ? { prep: true } : {}), ...(opts.expMeta ? { expMeta: opts.expMeta } : {}) };
      const w = await runCell(opts.pool, wcell, { runs: opts.warmup, seedStart: SIM.WARMUP_SEED_BASE });
      obsIn = w.obs;
      total += opts.warmup;
      notes.push(`${cls}: ${opts.warmup} planner runs, seeds ${SIM.WARMUP_SEED_BASE}-${SIM.WARMUP_SEED_BASE + opts.warmup - 1}`);
    } else if (obsIn) notes.push(`${cls}: inherited observations (${obsIn.runs} runs)`);
    else notes.push(`${cls}: none (RISK_PRIOR)`);
    const res = await runCell(opts.pool, cell, {
      runs: opts.runs, seedStart: opts.seedStart, obsIn, log: opts.log,
      onBlock: opts.quiet ? null : (d, n) => process.stderr.write(`  ${name} ${cls}: ${d}/${n}\n`),
    });
    total += opts.runs;
    const metrics = cellMetrics(res.records, { timeProfile: TIME_PROFILE[opts.bot] });
    perClass[cls] = { records: res.records, metrics, obs: res.obs, table: res.table, tree };
    if (dir) writeJsonl(join(dir, `runs-${cls}.jsonl`), res.records.map((r) => { const { ne, ...rest } = r; return rest; }));
  }
  const wallMs = performance.now() - t0;
  const meta = {
    name, commit, date, runs: opts.runs, seedStart: opts.seedStart, workers: opts.workers || 1, wallMs, totalRuns: total,
    warmupNote: notes.join('; '), bot: opts.bot, prof: opts.prof, trees: opts.trees, style: opts.style || 'balanced', variant: opts.variant || null, pet: opts.pet || null,
    replay: !!opts.replay, pairs: !!opts.pairs, think: !!opts.think, thinkMash: !!opts.thinkMash, simOverride: process.env.SIM_OVERRIDE || null,
    map: opts.map || 'rows', vision: opts.vision || null, dimming: opts.dimming !== false, oracle: !!opts.oracle, route: !!opts.route,
    ...(opts.prep ? { prep: true, prepPolicy: opts.prepPolicy || null, expMeta: opts.expMeta || null, prepForce: opts.prepForce || null, prepBan: opts.prepBan || null } : {}),
    ...(opts.tablesIn ? { tablesIn: opts.tablesIn } : {}),
    ...(opts.metaDrop ? { metaDrop: opts.metaDrop } : {}), ...(opts.beastcallGated ? { beastcallGated: true } : {}),
    ...(opts.ricochetGated ? { ricochetGated: true } : {}),
    ...(opts.gates ? { gates: opts.gates } : {}),
    // M2b v14: the C.GATES switches the cell played (the engine's defaults when it names none).
    gatesPlayed: gatesFor(opts.gates || null),
    // D128: the options the start camp offered (the engine's list when the cell names none).
    ...(opts.prep ? { campOptions: opts.campOptions || null, campPlayed: campOptionsFor(opts.campOptions || null) } : {}),
  };
  if (dir) {
    writeJson(join(dir, 'summary.json'), { meta, classes: Object.fromEntries(Object.entries(perClass).map(([c, x]) => [c, { tree: x.tree, metrics: x.metrics }])) });
    writeJson(join(dir, 'risk.json'), Object.fromEntries(Object.entries(perClass).map(([c, x]) => [c, x.obs])));
    writeFileSync(join(dir, 'summary.md'), cellMarkdown({ name, cell: { ...cellBase, trees: opts.trees }, perClass, meta }));
  }
  return { name, dir, meta, perClass };
}

export { BAL };
