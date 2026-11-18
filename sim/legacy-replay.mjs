#!/usr/bin/env node
// Legacy Oruvath replay (report legacy-oruvath-2026-11-18; legacy.md 2.5): replays Oruvath's fight from states written
// before FIGHT_BOSS by a legacy grid run with env BOSSDUMP=<dir> (sim/legacy-patch.py), under the boss settings of the
// LEG in the environment. The run up to the boss does not depend on Oruvath's settings (HP, damage, Shards, Final Dark),
// so a grid's wins under another boss setting are the wins of these replays; the grid's run counts are the denominator.
// Run from a scratch copy built by `node sim/legacy-run.mjs build` (the engine reads LEG at load):
//   LEG='<json>' node sim/legacy-replay.mjs <dump dir> [--part i/n] [--json out.json]
// Prints (or writes) per "<hero level>|<class>": { n: fights, w: wins, fd: losses to Final Dark }. The hero level is the
// cell's (from the file name's power level at the run's start). RELEARN=1: the hero's class spells are reconciled with
// this engine's learn levels (LEG.learn) before the fight: a spell now learnable at the hero's level is added trained to
// it, one no longer learnable is removed, and the planner's Camp bar is rebuilt (balance.md 1.2). That approximates a
// learn-level change for the boss fight only; the zones are played as dumped, so a grid run measures it exactly.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { R, C, CONTENT } from './lib/engine.mjs';
import { templateBar, desiredItemBar, barAction } from './lib/policy.mjs';

/** RELEARN: the hero's class spells as this engine's learn levels give them at the hero's level; the Camp bar rebuilt. */
export function relearn(s) {
  const p = s.player;
  let changed = false;
  for (const sp of Object.values(C.SPELL)) {
    if (sp.cls !== p.classId || sp.source !== 'class') continue;
    if (sp.lvl <= p.level && !p.spells[sp.id]) { p.spells[sp.id] = { tl: p.level, rank: 1 }; p.spellOrder.push(sp.id); changed = true; }
    else if (sp.lvl > p.level && p.spells[sp.id]) {
      delete p.spells[sp.id];
      p.spellOrder = p.spellOrder.filter((x) => x !== sp.id);
      p.bar = p.bar.map((x) => (x === sp.id ? null : x));
      changed = true;
    }
  }
  if (!changed) return s;
  const bar = templateBar(s, { camp: true });
  const items = desiredItemBar(s);
  for (let b = barAction(s, bar, items), n = 0; b && n < 40; b = barAction(s, bar, items), n++) {
    if (!R.isLegal(s, b)) break;
    s = R.step(s, b).state;
  }
  return s;
}

/** One replayed fight: { win, fd } (fd: lost to Final Dark). */
export function replayBoss(str) {
  let s = R.deserialize(str, CONTENT);
  if (globalThis.process.env.RELEARN) s = relearn(s);
  s = R.step(s, { type: 'FIGHT_BOSS' }).state;
  for (let n = 0; s.fight && n < 6000; n++) {
    const a = R.autoAction(s);
    if (!a) break;
    R.stepInPlace(s, a);
  }
  const win = s.outcome === 'victory';
  return { win, fd: !win && !!(s.death && s.death.killer && s.death.killer.ability === 'final_dark') };
}

const args = process.argv.slice(2);
if (args[0]) {
  const dir = args[0];
  const part = args.includes('--part') ? args[args.indexOf('--part') + 1].split('/').map(Number) : [0, 1];
  const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
  const heroOf = (P) => Math.round(1 + ((P - 1) * 24) / 59);
  const files = readdirSync(dir).filter((f) => /^P\d+-\w+-\d+\.json$/.test(f)).sort().filter((_, i) => i % part[1] === part[0]);
  const out = {};
  for (const f of files) {
    const [, P, cls] = f.match(/^P(\d+)-(\w+)-\d+\.json$/);
    const k = `${heroOf(Number(P))}|${cls}`;
    const r = replayBoss(readFileSync(join(dir, f), 'utf8'));
    out[k] = out[k] || { n: 0, w: 0, fd: 0 };
    out[k].n++;
    if (r.win) out[k].w++;
    if (r.fd) out[k].fd++;
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out));
  else for (const [k, v] of Object.entries(out).sort()) console.log(k, JSON.stringify(v));
}
