#!/usr/bin/env node
// LE3 attribution (docs/reports/legacy-le3-2026-11-20.md, draft): which hall entries raise the Legacy a run, line by line.
// Plays the hero cells of sim/legacy-run.mjs (planner, --native --oruvath --econ, profile later, band tables sim/tables/legacy-hx,
// seeds 9000-, the same cells as sim/lh1-chain.sh) in this process and adds the record field `ln` = { line id: [count, points] }
// (the Legacy lines of the run summary, rules in legacy.md 4.1), which the batch record does not keep. Nothing in src/ or sim/lib
// changes: Recorder.prototype.finish and Pool.prototype.all are wrapped here, so a cell's runs equal sim/run.mjs's for the same seeds
// (the record's `ech` is the check).
//   [LE3_SEED=9060] node sim/legacy-le3.mjs cell <hero> <hall spec> <runs per class> <out dir>      one cell (first seed LE3_SEED, default 9000), written to <out>/H<NN>/<cell>/ (readable by lh1report load)
//   node sim/legacy-le3.mjs jobs <out dir> [hero levels, default 19,14,11]            the cells the chain and the ladders need and that are not played, one per line:
//                                                                                    "<hero> <hall spec> <cell dir>" (feed to `cell`, e.g. with xargs -P2)
// Tables: sim/legacy-le3report.mjs.
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BANDS = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25]];
const bandOf = (h) => BANDS.find(([lo, hi]) => h >= lo && h <= hi);
const pad = (n) => String(n).padStart(2, '0');

if (process.argv[2] === 'cell') {
  const [, , , hero, hall, runs, out] = process.argv;
  const H = Number(hero);
  const [lo, hi] = bandOf(H);
  const { Recorder } = await import('./lib/recorder.mjs');
  const { R } = await import('./lib/engine.mjs');
  const { Pool } = await import('./lib/pool.mjs');
  const finish = Recorder.prototype.finish;
  Recorder.prototype.finish = function wrapped(s, meta) {
    const rec = finish.call(this, s, meta);
    const sum = s.result ? s.result.summary : (s.player ? R.summary(s) : null);
    rec.ln = sum ? Object.fromEntries(sum.echoes.lines.map((l) => [l.id, [l.count, l.echoes]])) : {};
    return rec;
  };
  const local = await import('./lib/runner.mjs');
  Pool.prototype.all = async function all(tasks) {
    return tasks.map((t) => ({ records: t.seeds.map((sd) => local.playRun(t.cell, sd, t.table, t.opts || {})) }));
  };
  const cellOut = join(resolve(out), `H${pad(H)}`);
  mkdirSync(cellOut, { recursive: true });
  process.argv = ['node', join(HERE, 'run.mjs'), '--bot', 'planner', '--class', 'all', '--runs', runs, '--seed-start', process.env.LE3_SEED || '9000', '--warmup', '0', '--workers', '1',
    '--profile', 'later', '--map', 'expedition', '--prep', '--out', cellOut, '--risk-in', join(HERE, 'tables', 'legacy-hx', `risk-H${pad(lo)}-${pad(hi)}.json`),
    '--hero', String(H), '--oruvath', '--econ', ...(hall && hall !== 'none' ? ['--hall', hall] : [])];
  await import('./run.mjs');
} else if (process.argv[2] === 'jobs') {
  // cells the ladder needs, in priority order: "<hero> <hall spec> <cell dir>" (cells already played are left out)
  const out = resolve(process.argv[3]);
  const { BUY_ORDER } = await import('./lib/hall.mjs');
  const spec = (n) => {
    const owned = {};
    for (const [id, rank] of BUY_ORDER.slice(0, n)) owned[id] = rank;
    return n === 0 ? 'none' : `v3d:${Object.entries(owned).map(([id, r]) => `${id}${r}`).join(',')}`;
  };
  const cell = (H, n) => ({ H, n, spec: spec(n), dir: join(out, 'c', `H${pad(H)}-p${pad(n)}`) });
  // chain stages of the v3d chain (report LH1 section 10): hero level at the start of runs 1-7 and the prefix of BUY_ORDER owned
  const CHAIN = [[1, 0], [4, 3], [7, 5], [11, 8], [14, 11], [17, 14], [19, 16]];
  const want = [...CHAIN.map(([H, n]) => cell(H, n)), ...CHAIN.filter(([, n]) => n > 0).map(([H]) => cell(H, 0))];
  // ladders: every prefix at these hero levels, highest first
  for (const H of (process.argv[4] || '19,14,11').split(',').map(Number)) {
    const top = CHAIN.find(([h]) => h === H)[1];
    for (let n = top - 1; n >= 1; n--) want.push(cell(H, n));
  }
  const seen = new Set();
  for (const c of want) {
    if (seen.has(c.dir)) continue;
    seen.add(c.dir);
    const d = join(c.dir, `H${pad(c.H)}`);
    if (existsSync(d) && readdirSync(d).some((x) => existsSync(join(d, x, 'summary.md')))) continue;
    console.log(`${c.H} ${c.spec} ${c.dir}`);
  }
}
