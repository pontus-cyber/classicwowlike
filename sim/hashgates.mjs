#!/usr/bin/env node
// Hash identity of the C.GATES rule of a cell (M2b v14; docs/reports/balance-2026-11-12b.md). Two sims on their own
// engine copies (REF: the sim before the v14 change, whose setGates turned every unnamed switch off; NEW: this sim, whose
// cells without gates play the engine's defaults) play the same cells that name their gates, classic and expedition (start
// camp), and must end in the same state hash run for run. NEW also checks that a cell without gates plays like the cell
// that names every default switch.
//
//   node sim/hashgates.mjs <REF root (src/ and sim/)> <NEW root>
const [REF, NEW] = process.argv.slice(2);
if (!REF || !NEW) throw new Error('usage: node sim/hashgates.mjs <ref root> <new root>');
const BOTS = ['planner', 'onebutton', 'greedy'];
const TREES = { rogue: 2, mage: 1, hunter: 2 };
const SEEDS = [1000, 1001];

async function sim(root) {
  const { runWithBot } = await import(`${root}/sim/lib/runner.mjs`);
  const { C } = await import(`${root}/sim/lib/engine.mjs`);
  return { runWithBot, keys: Object.keys(C.GATES) };
}
const ref = await sim(REF);
const now = await sim(NEW);
if (ref.keys.join() !== now.keys.join()) throw new Error(`C.GATES keys differ: ${ref.keys} / ${now.keys}`);
const all = Object.fromEntries(now.keys.map((k) => [k, true]));
const sets = [
  ['every switch named', all],
  ['row 1 off (rareHpMultZ1, firstMeetWindup)', { rareHpMultZ1: true, firstMeetWindup: true }],
  ['row 1 (a) only (+ sapHold)', { rareHpMultZ1: true, firstMeetWindup: true, sapHold: true }],
  ['none named ({}: every switch off)', {}],
];
const hash = (s, cell, seed) => { const r = s.runWithBot(cell, seed, null, { hash: true }).record; return r.err ? `ERR ${r.err}` : r.hash; };
let bad = 0;
for (const map of ['classic', 'expedition']) {
  const t = { same: 0, n: 0, plain: 0, pn: 0 };
  for (const bot of BOTS) for (const cls of Object.keys(TREES)) for (const seed of SEEDS) {
    const base = { bot, cls, prof: 'fresh', tree: TREES[cls], ...(map === 'expedition' ? { map: 'expedition', prep: true } : {}) };
    for (const [, gates] of sets) {
      const a = hash(ref, { ...base, gates }, seed); const b = hash(now, { ...base, gates }, seed);
      t.n++; if (a === b && !String(a).startsWith('ERR')) t.same++;
    }
    const p = hash(now, base, seed); const q = hash(now, { ...base, gates: all }, seed);
    t.pn++; if (p === q && !String(p).startsWith('ERR')) t.plain++;
  }
  if (t.same !== t.n || t.plain !== t.pn) bad++;
  console.log(`hash ${map}: cells that name their gates ${t.same}/${t.n} identical with the old sim (${sets.length} gate sets x ${BOTS.join(', ')} x 3 classes x ${SEEDS.length} seeds); plain cells = every default named ${t.plain}/${t.pn}`);
}
console.log(bad ? 'hash identity: FAIL' : 'hash identity: pass');
process.exitCode = bad ? 1 : 0;
