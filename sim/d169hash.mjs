#!/usr/bin/env node
// D169 (Hunter package, docs/specs/legacy.md 2.4.3, draft; hand-off engine-2026-11-25): run-hash identity of the sim on
// two engines (REF: the engine before the package, NEW: this one), on cells where the package must not act:
//   off   every C.GATES switch at its default (legacy off: level-60 runs), classic and expedition (start camp) maps,
//         profiles 'all' (Lost Technique I owned) and 'fresh'; planner for every class, greedy and speedrunner for the Hunter
//   leg   GATES.legacy and economyV2 on, oruvathLegacy off (Legacy runs without the D157 numbers): Hunter planner, hero 10,
//         20, 25, the v3d hall (techniques owned) and nothing bought
//   rm    both gates on (the package acts on the Hunter only): Rogue and Mage planner, hero 20 and 25, v3d hall and none
// Every run must end in the same state hash on both engines.
//
//   node sim/d169hash.mjs <REF root (src/ and sim/)> <NEW root> [--seeds 1000-1009]
const argv = process.argv.slice(2);
const [REF, NEW] = argv;
if (!REF || !NEW) throw new Error('usage: node sim/d169hash.mjs <ref root> <new root> [--seeds a-b]');
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
const on = Object.fromEntries(Object.keys(now.gates).filter((k) => now.gates[k]).map((k) => [k, true]));
const hash = (s, cell, seed) => { const r = s.runWithBot(cell, seed, null, { hash: true }).record; return r.err ? `ERR ${r.err}` : r.hash; };

const sets = { off: [], leg: [], rm: [] };
for (const map of ['classic', 'expedition']) for (const prof of ['all', 'fresh']) {
  const m = map === 'expedition' ? { map: 'expedition', prep: true } : {};
  for (const cls of ['rogue', 'mage', 'hunter']) sets.off.push({ bot: 'planner', cls, prof, tree: TREES[cls], ...m });
  for (const bot of ['greedy', 'speedrunner']) sets.off.push({ bot, cls: 'hunter', prof, tree: TREES.hunter, ...m });
}
const exp = { map: 'expedition', prep: true, prof: 'later', bot: 'planner' };
for (const hero of [10, 20, 25]) for (const hall of ['v3d', null]) {
  sets.leg.push({ ...exp, cls: 'hunter', tree: TREES.hunter, hero, ...(hall ? { hall } : {}), gates: { ...on, legacy: true, economyV2: true } });
}
for (const hero of [20, 25]) for (const hall of ['v3d', null]) for (const cls of ['rogue', 'mage']) {
  sets.rm.push({ ...exp, cls, tree: TREES[cls], hero, ...(hall ? { hall } : {}), gates: { ...on, legacy: true, oruvathLegacy: true, economyV2: true } });
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
console.log(bad ? 'D169 hash identity: FAIL' : 'D169 hash identity: pass');
process.exitCode = bad ? 1 : 0;
