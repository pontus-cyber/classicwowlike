#!/usr/bin/env node
/**
 * qa/browser/demo/run-all.mjs - the whole demo stability harness in one go, one line per check.
 *
 *   node qa/browser/demo/run-all.mjs [--file demo.html] [--skip long,perf] [--fuzz-runs 3]
 *
 * Runs matrix, reload, fuzz, perf and long-session as child processes with the same --file and prints their exit codes.
 * The long session takes about 6-7 minutes at instant speed (8 runs); perf about 3 minutes.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILE, arg } from './lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const skip = arg('--skip', '').split(',');
const extra = ['--file', FILE];
const jobs = [['matrix', []], ['reload', []], ['fuzz', ['--runs', arg('--fuzz-runs', '3')]], ['perf', []], ['long-session', []]];
const out = [];
for (const [name, a] of jobs) {
  if (skip.includes(name) || skip.includes(name.split('-')[0])) { out.push([name, 'skipped']); continue; }
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.execPath, [path.join(dir, `${name}.mjs`), ...extra, ...a], { stdio: 'inherit' });
  out.push([name, r.status === 0 ? 'PASS' : `FAIL (exit ${r.status})`]);
}
console.log('\n' + out.map(([n, s]) => `${s.padEnd(14)} ${n}`).join('\n'));
process.exit(out.some(([, s]) => s.startsWith('FAIL')) ? 1 : 0);
