#!/usr/bin/env node
// The demo (docs/specs/demo.md 2.1, D171; task D.3): with the demo switch off the full game is unchanged. Run-hash identity
// of the sim on two engines (REF: the engine before the demo, NEW: this one) on the full game's cells:
//   off   every C.GATES switch at its default (level-60 runs), classic and expedition (start camp), profiles 'all' and
//         'fresh', planner for every class, greedy and speedrunner for the Rogue
//   leg   the Legacy set on (legacy, oruvathLegacy, economyV2; demo off): planner for every class, hero 1, 7 and 20, the v3d
//         hall and nothing bought
// Every run must end in the same state hash on both engines (the NEW engine's C.GATES has one key more, `demo`, off).
//
//   node sim/demohash.mjs <REF root (src/ and sim/)> <NEW root> [--seeds 1000-1009]
const argv = process.argv.slice(2);
const [REF, NEW] = argv;
if (!REF || !NEW) throw new Error('usage: node sim/demohash.mjs <ref root> <new root> [--seeds a-b]');
const si = argv.indexOf('--seeds');
const [s0, s1] = (si >= 0 ? argv[si + 1] : '1000-1009').split('-').map(Number);
const SEEDS = Array.from({ length: s1 - s0 + 1 }, (_, i) => s0 + i);
const TREES = { rogue: 2, mage: 1, hunter: 2 };

async function sim(root) {
  const { runWithBot } = await import(`${root}/sim/lib/runner.mjs`);
  const { C } = await import(`${root}/sim/lib/engine.mjs`);
  return { runWithBot, gates: { ...C.GATES } };
}
const ref = await sim(REF);
const now = await sim(NEW);
if (now.gates.demo !== false) throw new Error('NEW: C.GATES.demo must be off by default');
const extra = Object.keys(now.gates).filter((k) => !(k in ref.gates));
if (extra.join() !== 'demo') throw new Error(`NEW: C.GATES keys beyond REF's: ${extra}`);
const on = Object.fromEntries(Object.keys(ref.gates).filter((k) => ref.gates[k]).map((k) => [k, true]));
const hash = (s, cell, seed) => { const r = s.runWithBot(cell, seed, null, { hash: true }).record; return r.err ? `ERR ${r.err}` : r.hash; };

const sets = { off: [], leg: [] };
for (const map of ['classic', 'expedition']) for (const prof of ['all', 'fresh']) {
  const m = map === 'expedition' ? { map: 'expedition', prep: true } : {};
  for (const cls of ['rogue', 'mage', 'hunter']) sets.off.push({ bot: 'planner', cls, prof, tree: TREES[cls], ...m });
  for (const bot of ['greedy', 'speedrunner']) sets.off.push({ bot, cls: 'rogue', prof, tree: TREES.rogue, ...m });
}
const exp = { map: 'expedition', prep: true, prof: 'later', bot: 'planner' };
for (const hero of [1, 7, 20]) for (const hall of ['v3d', null]) for (const cls of ['rogue', 'mage', 'hunter']) {
  sets.leg.push({ ...exp, cls, tree: TREES[cls], hero, ...(hall ? { hall } : {}), gates: { ...on, legacy: true, oruvathLegacy: true, economyV2: true } });
}
let bad = 0;
for (const [name, cells] of Object.entries(sets)) {
  let same = 0; let n = 0;
  for (const cell of cells) for (const seed of SEEDS) {
    const a = hash(ref, cell, seed); const b = hash(now, cell, seed);
    n++;
    if (a === b && !String(a).startsWith('ERR')) same++;
    else console.log(`differs: ${name} ${JSON.stringify(cell)} seed ${seed}: ${a} / ${b}`);
  }
  if (same !== n) bad++;
  console.log(`${name}: ${same}/${n} run hashes identical (${cells.length} cells x ${SEEDS.length} seeds)`);
}
console.log(bad ? 'demo hash identity: FAIL' : 'demo hash identity: pass');
process.exitCode = bad ? 1 : 0;
