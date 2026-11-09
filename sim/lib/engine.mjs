// The simulator's only gateway to the rules engine (src/rules.js). sim/ never copies a rule: every outcome
// comes from the engine. The few read-only helpers below come from engine modules because the public API
// does not export them yet (listed in docs/handoffs/sim-2026-11-09.md as a request to the Engineer):
//   V(L)            value scale (rules 8.5)            src/engine/items.js
//   xpCurve, diffMod XP curve and level-difference mod src/engine/progress.js
// Bots use them only to estimate node values; the engine decides what actually happens.
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { STREAM, makeRng, nextFloat, nextU32, hash32 } from '../../src/rng.js';
import { V } from '../../src/engine/items.js';
import { xpCurve, diffMod } from '../../src/engine/progress.js';

export const C = R.C;
export { R, CONTENT, STREAM, makeRng, nextFloat, nextU32, hash32, V, xpCurve, diffMod };

const errors = R.validateContent(CONTENT);
if (errors.length) throw new Error(`sim: content is invalid:\n  ${errors.slice(0, 10).join('\n  ')}`);

/** A run in phase CREATE (content validated once at module load). */
export function newRunFor({ classId, petId = null, seed, profile = null }) {
  return R.newRun({ classId, petId: classId === 'hunter' ? petId : null, seed, profile, content: CONTENT, validate: false });
}

/** Pets a profile can pick for the Hunter. */
export function petsFor(profile) {
  const u = (profile && profile.unlocks) || {};
  return Object.values(C.PET).filter((p) => !p.meta || (u[p.meta] || 0) > 0).map((p) => p.id);
}

/** Bot random stream (balance.md 1): hash(runSeed, "bot"), never a game stream. */
export class BotRng {
  constructor(seed) { this.s = STREAM.bot(seed >>> 0); }
  float() { return nextFloat(this.s); }
  int(n) { return Math.floor(nextFloat(this.s) * n); }
  pick(list) { return list[Math.floor(nextFloat(this.s) * list.length)]; }
  u32() { return nextU32(this.s); }
  chance(p) { return nextFloat(this.s) < p; }
}

export const SPELL = C.SPELL;
export const TALENT = C.TALENT;
export const CONSUMABLE = C.CONSUMABLE;

/** Count of a consumable in the bag (read from the state). */
export function countCons(s, id) {
  let n = 0;
  for (const it of s.player.bag) if (it.kind === 'cons' && it.id === id) n += it.qty;
  return n;
}

/** Score of the item equipped in a slot (rules 8.3 via the engine's itemScore). */
export function equippedScore(s, slot) {
  return R.itemScore(s.player.equipped[slot], s.player.classId);
}

export const hpFrac = (s) => s.player.hp / s.player.d.maxHp;
export const manaFrac = (s) => (s.player.d.maxMana ? s.player.mana / s.player.d.maxMana : 1);
export const legal = (s, a) => R.isLegal(s, a);
