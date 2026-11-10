// One batch invocation (used by sim/run.mjs and sim/pass.mjs): per class, an optional risk warm-up, the
// measured runs, metrics, and the output files (runs.jsonl, summary.json, summary.md, risk.json).
import { join } from 'node:path';
import { BAL, SIM } from './params.mjs';
import { runCell } from './batch.mjs';
import { cellMetrics } from './metrics.mjs';
import { cellMarkdown } from './cellreport.mjs';
import { TIME_PROFILE } from '../bots/index.mjs';
import { commitInfo, cellName, writeJson, writeJsonl, ensureDir } from './output.mjs';
import { writeFileSync } from 'node:fs';

export const CLASSES = ['rogue', 'mage', 'hunter'];

/**
 * opts: { pool, bot, classes, runs, seedStart, prof, trees: {cls: tree}, style, variant, pet, out,
 *         warmup (runs, 0 = none), obsIn: {cls: obs}, log, quiet, workers, name, replay (B50 replays, combat-v2.md 11) }
 * Returns { name, dir, perClass: { cls: { records, metrics, obs, table } } }.
 */
export async function runBatch(opts) {
  const commit = commitInfo();
  const date = new Date().toISOString().slice(0, 10);
  const cellBase = { bot: opts.bot, prof: opts.prof, style: opts.style || null, variant: opts.variant || null, pet: opts.pet || null, ...(opts.replay ? { replay: true } : {}) };
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
      const wcell = { bot: 'planner', cls, prof: opts.prof, tree, style: null, variant: null, pet: opts.pet || null };
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
    replay: !!opts.replay, simOverride: process.env.SIM_OVERRIDE || null,
  };
  if (dir) {
    writeJson(join(dir, 'summary.json'), { meta, classes: Object.fromEntries(Object.entries(perClass).map(([c, x]) => [c, { tree: x.tree, metrics: x.metrics }])) });
    writeJson(join(dir, 'risk.json'), Object.fromEntries(Object.entries(perClass).map(([c, x]) => [c, x.obs])));
    writeFileSync(join(dir, 'summary.md'), cellMarkdown({ name, cell: { ...cellBase, trees: opts.trees }, perClass, meta }));
  }
  return { name, dir, meta, perClass };
}

export { BAL };
