// Batch mode: N seeded runs of one cell across worker threads, with the death-risk table refreshed every
// SIM_RISK_REFRESH runs (balance.md 1.1). Runs are processed in blocks of SIM_RISK_REFRESH seeds: every run of
// block b uses the table built from all runs of blocks < b (plus the starting observations), so the results do
// not depend on the number of workers or on scheduling.
import { BAL, SIM } from './params.mjs';
import { newObs, addRecord, buildTable } from './risk.mjs';

const cloneObs = (o) => JSON.parse(JSON.stringify(o));

/**
 * pool: Pool (or null to run in this thread); cell: { bot, cls, prof, tree, style, variant, pet };
 * opts: { runs, seedStart, obsIn, refresh, taskRuns, log, onBlock(done, total) }.
 * Returns { records (seed order), obs (final observations), table (final lookup table), wallMs }.
 */
export async function runCell(pool, cell, opts) {
  const { runs, seedStart } = opts;
  const refresh = opts.refresh || BAL.SIM_RISK_REFRESH;
  const taskRuns = opts.taskRuns || SIM.TASK_RUNS;
  const obs = opts.obsIn ? cloneObs(opts.obsIn) : newObs();
  let table = buildTable(obs);
  const records = [];
  const t0 = performance.now();
  let local = null;
  if (!pool) local = await import('./runner.mjs');
  for (let b = 0; b < runs; b += refresh) {
    const n = Math.min(refresh, runs - b);
    const tasks = [];
    for (let i = 0; i < n; i += taskRuns) {
      const seeds = [];
      for (let j = i; j < Math.min(n, i + taskRuns); j++) seeds.push(seedStart + b + j);
      tasks.push({ kind: 'runs', cell, seeds, table, opts: { log: !!opts.log } });
    }
    const results = pool
      ? await pool.all(tasks)
      : tasks.map((t) => ({ records: t.seeds.map((sd) => local.playRun(cell, sd, table, t.opts)) }));
    for (const r of results) for (const rec of r.records) { records.push(rec); addRecord(obs, rec); }
    table = buildTable(obs);
    if (opts.onBlock) opts.onBlock(b + n, runs);
  }
  return { records, obs, table, wallMs: performance.now() - t0 };
}

/** Campaigns of one class: N_CAMPAIGNS independent campaigns with a frozen risk table, results in order. */
export async function runCampaigns(pool, cell, { count, seedStart, maxRuns, table }) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const seeds = [];
    for (let k = 0; k < maxRuns; k++) seeds.push(seedStart + i * maxRuns + k);
    tasks.push({ kind: 'campaign', cell, index: i, seeds, table });
  }
  const t0 = performance.now();
  let out;
  if (pool) out = (await pool.all(tasks)).map((r) => r.campaign);
  else {
    const { playCampaign } = await import('./campaign.mjs');
    out = tasks.map((t) => playCampaign(t.cell, t.index, t.seeds, t.table));
  }
  return { campaigns: out, wallMs: performance.now() - t0 };
}
