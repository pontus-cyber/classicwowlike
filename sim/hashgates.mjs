#!/usr/bin/env node
// Hash identity of the sim against a reference sim on the same engine (M2b v14, docs/reports/balance-2026-11-12b.md; M2b
// v15, docs/reports/balance-2026-11-12c.md). Two sims on their own engine copies (REF: an earlier sim, NEW: this sim) play
// the same cells that name their C.GATES switches, classic and expedition (start camp), and must end in the same state
// hash run for run wherever the sim change cannot act. NEW also checks that a cell without gates plays like the cell that
// names every switch that is on by default (the engine's defaults, read from C.GATES at load).
// v15: the gate sets are built from the engine's keys; a set that plays the Swift passage (swiftRoad on) on the expedition
// map is reported but not required to match (the v15 fog searches value the passage XP, so the planner family's map
// choices differ there by design). Every other set, and every classic set, must match.
//
//   node sim/hashgates.mjs <REF root (src/ and sim/)> <NEW root>
const [REF, NEW] = process.argv.slice(2);
if (!REF || !NEW) throw new Error('usage: node sim/hashgates.mjs <ref root> <new root>');
const BOTS = [['planner', null], ['onebutton', null], ['greedy', null], ['speedrunner', null], ['speedrunner', 'v11']];
const TREES = { rogue: 2, mage: 1, hunter: 2 };
const SEEDS = [1000, 1001];

async function sim(root) {
  const { runWithBot } = await import(`${root}/sim/lib/runner.mjs`);
  const { C } = await import(`${root}/sim/lib/engine.mjs`);
  return { runWithBot, gates: { ...C.GATES } };
}
const ref = await sim(REF);
const now = await sim(NEW);
const keys = Object.keys(now.gates);
if (Object.keys(ref.gates).join() !== keys.join()) throw new Error(`C.GATES keys differ: ${Object.keys(ref.gates)} / ${keys}`);
const on = Object.fromEntries(keys.filter((k) => now.gates[k]).map((k) => [k, true]));
const without = (o, k) => { const x = { ...o }; delete x[k]; return x; };
const sets = [
  ['every default-on switch named', on],
  ...(on.swiftRoad ? [['row 2 off (swiftRoad not named)', without(on, 'swiftRoad')]] : []),
  ...('mawgrimHp' in now.gates ? [['row 4 arm (+ mawgrimHp)', { ...on, mawgrimHp: true }]] : []),
  ['row 1 off (rareHpMultZ1, firstMeetWindup)', { rareHpMultZ1: true, firstMeetWindup: true }],
  ['none named ({}: every switch off)', {}],
];
const hash = (s, cell, seed) => { const r = s.runWithBot(cell, seed, null, { hash: true }).record; return r.err ? `ERR ${r.err}` : r.hash; };
let bad = 0;
for (const map of ['classic', 'expedition']) {
  const t = { same: 0, n: 0, plain: 0, pn: 0, swSame: 0, swN: 0 };
  for (const [bot, variant] of BOTS) for (const cls of Object.keys(TREES)) for (const seed of SEEDS) {
    const base = { bot, cls, prof: 'fresh', tree: TREES[cls], ...(variant ? { variant } : {}), ...(map === 'expedition' ? { map: 'expedition', prep: true } : {}) };
    for (const [, gates] of sets) {
      const a = hash(ref, { ...base, gates }, seed); const b = hash(now, { ...base, gates }, seed);
      const same = a === b && !String(a).startsWith('ERR');
      if (map === 'expedition' && gates.swiftRoad) { t.swN++; if (same) t.swSame++; continue; }
      t.n++; if (same) t.same++;
    }
    const p = hash(now, base, seed); const q = hash(now, { ...base, gates: on }, seed);
    t.pn++; if (p === q && !String(p).startsWith('ERR')) t.plain++;
  }
  if (t.same !== t.n || t.plain !== t.pn) bad++;
  const bots = BOTS.map(([b, v]) => (v ? `${b} ${v}` : b)).join(', ');
  console.log(`hash ${map}: required sets ${t.same}/${t.n} identical with the reference sim (${sets.length} gate sets x ${bots} x 3 classes x ${SEEDS.length} seeds)${t.swN ? `; Swift passage on (reported): ${t.swSame}/${t.swN} identical` : ''}; plain cells = every default-on switch named ${t.plain}/${t.pn}`);
}
console.log(bad ? 'hash identity: FAIL' : 'hash identity: pass');
process.exitCode = bad ? 1 : 0;
