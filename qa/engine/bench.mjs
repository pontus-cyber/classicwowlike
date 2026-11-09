// Throughput benchmark (balance.md B37): full autoplay runs from CREATE to ENDED in Node.
// Usage: node qa/engine/bench.mjs [runsPerClass=200]
// Not a test file (node --test ignores it). Prints runs per minute per content set and step mode.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { newRun, step, stepInPlace, autoAction } from '../../src/rules.js';
import { CONTENT as FIXTURE } from '../fixtures/content-min.js';

const N = Number(process.argv[2] || 200);
const REAL = fileURLToPath(new URL('../../src/content/index.js', import.meta.url));
const sets = [['fixture', FIXTURE]];
if (existsSync(REAL)) sets.push(['src/content', (await import(REAL)).CONTENT]);

function run(content, classId, seed, inPlace) {
  const t0 = process.hrtime.bigint();
  let s = newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed, content });
  let n = 0;
  while (s.phase !== 'ENDED') {
    const a = autoAction(s);
    if (inPlace) stepInPlace(s, a); else s = step(s, a).state;
    n++;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { n, ms, reached: s.result.summary.reachedBoss, won: s.result.summary.outcome === 'victory' };
}

console.log(`node ${process.version}, ${N} runs per class`);
for (const [name, content] of sets) {
  for (const inPlace of [false, true]) {
    const t0 = process.hrtime.bigint();
    let steps = 0;
    let boss = 0;
    let wins = 0;
    let fullSteps = 0;
    let fullMs = 0;
    for (const classId of ['rogue', 'mage', 'hunter']) {
      for (let i = 0; i < N; i++) {
        const r = run(content, classId, 1000 + i, inPlace);
        steps += r.n;
        if (r.reached) { boss++; fullSteps += r.n; fullMs += r.ms; }
        wins += r.won ? 1 : 0;
      }
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const runs = 3 * N;
    const full = boss ? `; runs that reach the boss: ${Math.round(fullSteps / boss)} steps, ${(fullMs / boss).toFixed(1)} ms each = ${Math.round(60000 / (fullMs / boss))} runs/min` : '';
    console.log(`${name.padEnd(12)} ${inPlace ? 'stepInPlace' : 'step (pure)'}: ${Math.round(runs / (ms / 60000))} runs/min, ${(ms / runs).toFixed(1)} ms/run, ${Math.round(steps / runs)} steps/run, ${Math.round(steps / (ms / 1000))} steps/s, reached boss ${boss}/${runs}, wins ${wins}${full}`);
  }
}
