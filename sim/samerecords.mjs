#!/usr/bin/env node
// Run-for-run identity of two passes (D132, report 2026-11-13): for every cell directory under A, each run record of
// runs-<class>.jsonl must equal the record of the same seed in B/<cellB> (every field except the wall time `ms`).
// A may hold fewer seeds than B (a check on the first seeds of a cell). The cell name in B is A's with the suffix
// --strip removed (e.g. '-noba': the board-off arm on this engine against the cells of the D128 engine, whose cells name
// no gates).
//
//   node sim/samerecords.mjs <A> <B> [--strip -noba]
// Prints one line per cell and class, then "identity: pass" or "identity: FAIL" (exit 1 on a difference).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const [A, B] = argv;
const si = argv.indexOf('--strip');
const strip = si >= 0 ? argv[si + 1] : '';
if (!A || !B) throw new Error('usage: node sim/samerecords.mjs <A> <B> [--strip <suffix>]');

const recs = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const norm = (r) => { const x = { ...r }; delete x.ms; return JSON.stringify(x); };
let bad = 0;
let n = 0;
for (const cell of readdirSync(A).sort()) {
  const cb = strip && cell.endsWith(strip) ? cell.slice(0, -strip.length) : cell;
  for (const f of readdirSync(join(A, cell)).filter((x) => /^runs-.*\.jsonl$/.test(x)).sort()) {
    const fb = join(B, cb, f);
    if (!existsSync(fb)) { console.log(`${cell} ${f}: no ${fb}`); bad++; continue; }
    const ref = new Map(recs(fb).map((r) => [r.seed, norm(r)]));
    let same = 0;
    let diff = 0;
    for (const r of recs(join(A, cell, f))) {
      n++;
      if (ref.get(r.seed) === norm(r)) same++;
      else diff++;
    }
    bad += diff;
    console.log(`${cell} ${f.replace(/^runs-|\.jsonl$/g, '')}: ${same} / ${same + diff} identical with ${cb}`);
  }
}
console.log(`identity: ${bad || !n ? 'FAIL' : 'pass'} (${n - bad} / ${n} runs)`);
if (bad || !n) process.exit(1);
