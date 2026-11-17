#!/usr/bin/env node
// Legacy boss bench (report legacy-calibration-2026-11-17; legacy.md 2.4, 6.6 reading 3): Oruvath's fight alone, per
// class and power level at the boss, on a scratch engine built by sim/legacy-patch.py (run it from the scratch copy,
// LEG in the environment: the boss tier and HP factor; `learn` for the spell arms). A character is built at the level
// with debug.build (every class spell up to the level trained to it; gear of `--rarity` at item level level + 1 in
// every slot, the measured gear of legacy.md 6.3; the sim's default tree spent by the standard build, balance.md 1.3;
// the planner's Camp bars), then debug.toBoss and autoplay to the end of the fight (the planner's combat).
//
//   LEG='<json>' node sim/legacy-boss.mjs --levels 3-63 [--step 1] [--seeds 200] [--rarity rare] [--potions 5]
//        [--ember 1] [--classes rogue,mage,hunter] [--json <file>]
//   or --hero 1-25 [--gain 5]: power level at the boss = POWER_OF_LEVEL[H] + gain (at most 60; the planner gains about
//        five power levels in a run at every hero level, legacy.md 6.3)
// --tree: talent tree (default SIM.DEFAULT_TREE, the P0 group's).
// --ilvl-off: item level - power level of the gear (default 1).
// --ember: Embers of Return carried (the planner buys one at the start camp in most runs: record `emb`).
// Prints win %, median rounds of the wins, boss HP left (mean of losses) and the loss phase per class and level.
import { writeFileSync } from 'node:fs';
import { R, C, CONTENT } from './lib/engine.mjs';
import { SIM } from './lib/params.mjs';
import { standardTalent, templateBar, desiredItemBar, barAction } from './lib/policy.mjs';
import { addToBag, makeConsumable } from '../src/engine/items.js';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  return o;
}
const a = parse(process.argv.slice(2));
const powerOf = (h) => Math.round(1 + ((h - 1) * 59) / 24);
const gainL = Number(a.gain ?? 5);
const LEVELS = (() => {
  if (a.hero) { const [h0, h1] = a.hero.split('-').map(Number); const out = []; for (let h = h0; h <= (h1 ?? h0); h++) out.push([h, Math.min(C.MAX_LEVEL, powerOf(h) + gainL)]); return out; }
  const [lo, hi] = (a.levels || '3-60').split('-').map(Number); const out = []; for (let L = lo; L <= (hi ?? lo); L += Number(a.step || 1)) out.push([null, L]); return out;
})();
const seeds = Number(a.seeds || 200);
const rarity = a.rarity || 'rare';
const potions = Number(a.potions ?? 5);
const embers = Number(a.ember ?? 1);
const ilvlOff = Number(a['ilvl-off'] ?? 1);
const treeArg = a.tree !== undefined ? Number(a.tree) : null;
const classes = (a.classes || 'rogue,mage,hunter').split(',');
const CAMP = C.ZONE_COUNT + 1;

function act(s, action) {
  const r = R.step(s, action);
  return r.state;
}

/** One fight: { win, rounds, hpLeft (boss HP fraction), phase }. */
export function bossFight(cls, level, seed) {
  let s = R.debug.build({ content: CONTENT, classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, zone: CAMP, level, rarity,
    ilvl: Math.max(1, Math.min(C.ILVL_MAX, level + ilvlOff)), talents: 'unspent', potions }).state;
  for (let i = 0; i < embers; i++) addToBag(s, makeConsumable(s, 'ember_of_return', 1));
  const tree = treeArg ?? SIM.DEFAULT_TREE[cls];
  for (let t = standardTalent(s, tree); t && R.talentPointsFree(s) > 0; t = standardTalent(s, tree)) s = act(s, { type: 'SPEND_TALENT', talentId: t });
  const bar = templateBar(s, { camp: true });
  const items = desiredItemBar(s);
  for (let b = barAction(s, bar, items), n = 0; b && n < 40; b = barAction(s, bar, items), n++) {
    if (!R.isLegal(s, b)) break;
    s = act(s, b);
  }
  s = R.debug.toBoss(s).state;
  let rounds = 0;
  let boss = s.fight.enemies[0];
  for (let n = 0; s.fight && n < 5000; n++) {
    boss = s.fight.enemies[0];
    rounds = s.fight.round ?? rounds;
    const x = R.autoAction(s);
    if (!x) break;
    R.stepInPlace(s, x);
  }
  const win = s.outcome === 'victory';
  const st = s.stats || {};
  return { win: !!win, rounds, hpLeft: boss ? Math.max(0, boss.hp) / boss.maxHp : 0, phase: st.bossPhase ?? null, outcome: s.outcome };
}

const res = {};
const med = (v) => { if (!v.length) return NaN; const b = [...v].sort((x, y) => x - y); return b[Math.floor((b.length - 1) / 2)]; };
console.log(`| class | hero level | power level | wins % | median rounds (wins) | boss HP left (losses) | loss phase 1/2/3 % |`);
console.log('|---|---|---|---|---|---|---|');
for (const cls of classes) {
  res[cls] = {};
  for (const [H, L] of LEVELS) {
    const rs = [];
    for (let i = 0; i < seeds; i++) rs.push(bossFight(cls, L, 5000 + i));
    const w = rs.filter((r) => r.win);
    const l = rs.filter((r) => !r.win);
    const ph = [1, 2, 3].map((p) => l.filter((r) => r.phase === p).length);
    res[cls][H ?? L] = { H, L, n: rs.length, win: w.length / rs.length, rounds: med(w.map((r) => r.rounds)), hpLeft: l.length ? l.reduce((x, r) => x + r.hpLeft, 0) / l.length : 0, phase: ph };
    console.log(`| ${cls} | ${H ?? '-'} | ${L} | ${(100 * w.length / rs.length).toFixed(1)} | ${med(w.map((r) => r.rounds))} | ${(100 * res[cls][H ?? L].hpLeft).toFixed(0)} % | ${ph.map((x) => (l.length ? (100 * x / l.length).toFixed(0) : '-')).join(' / ')} |`);
  }
}
if (a.json) writeFileSync(a.json, JSON.stringify({ leg: process.env.LEG || null, rarity, potions, seeds, res }, null, 1));
