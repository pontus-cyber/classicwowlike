// The simulator's only gateway to the rules engine (src/rules.js). sim/ never copies a rule: every outcome
// comes from the engine. The read-only rule helpers V(L) (value scale, rules 8.5), xpCurve(L) and diffMod(d)
// (XP curve and level-difference modifier, rules 4.3-4.4) come from the public API (src/rules.js); bots use them
// only to estimate node values, the engine decides what actually happens.
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { STREAM, makeRng, nextFloat, nextU32, hash32 } from '../../src/rng.js';

const { V, xpCurve, diffMod } = R;
export const C = R.C;
export { R, CONTENT, STREAM, makeRng, nextFloat, nextU32, hash32, V, xpCurve, diffMod };

/**
 * The engine's switches (C.GATES, M2b v13-v14) as built: read once at load, before any cell sets them (runner.mjs
 * setGates), so a cell that names no gates plays the game as built. null for an engine without C.GATES.
 */
export const GATE_DEFAULTS = C.GATES ? Object.freeze({ ...C.GATES }) : null;

/**
 * The switches a cell plays: the engine's defaults when the cell names no gates (null), else the named switches on and
 * every other off (the v13 sim's rule, so a cell that names its gates plays as before). null without C.GATES.
 */
export function gatesFor(gates = null) {
  if (!GATE_DEFAULTS) return null;
  if (!gates) return { ...GATE_DEFAULTS };
  return Object.fromEntries(Object.keys(GATE_DEFAULTS).map((k) => [k, !!gates[k]]));
}
// M2b v12 (D101; engine-api.md 10): the engine's own escape rule helpers, so the bots price a Dimmed encounter after a
// walk as the engine spends it: outwardStep(zone-like { shardDist }, from, to), dimFightTime(escape) -> tolls.
export { outwardStep, dimFightTime } from '../../src/engine/expedition.js';

const errors = R.validateContent(CONTENT);
if (errors.length) throw new Error(`sim: content is invalid:\n  ${errors.slice(0, 10).join('\n  ')}`);

/**
 * A run in phase CREATE (content validated once at module load). mapMode 'expedition' (rules 1.9), its vision kit
 * ({ guide, charts, pathfinder }), dimming (false: B44's diagnostic cell) and prep (true: the start camp and contracts,
 * expedition.md 2-3) are passed to the engine only when set, so a rows run is created exactly as before.
 */
export function newRunFor({ classId, petId = null, seed, profile = null, mapMode = null, vision = null, dimming = null, prep = false }) {
  const o = { classId, petId: classId === 'hunter' ? petId : null, seed, profile, content: CONTENT, validate: false };
  if (mapMode) o.mapMode = mapMode;
  if (vision) o.vision = vision;
  if (dimming === false) o.dimming = false;
  if (prep) o.prep = true;
  return R.newRun(o);
}

/**
 * The expedition meta entries the start camp reads (expedition.md 8.2; engine C.META_EXPEDITION: quartermaster,
 * cartographer, old_hand), added to a profile as unlock ranks: they are not in the rows catalogue (C.META) until the
 * switch-over, so the PALL profile does not have them. expMeta: { id: rank } or null (profile unchanged).
 */
export function withExpMeta(profile, expMeta) {
  if (!expMeta) return profile;
  const p = { ...profile, unlocks: { ...profile.unlocks } };
  for (const [id, r] of Object.entries(expMeta)) if (C.META_EXPEDITION[id]) p.unlocks[id] = Math.min(Number(r) || 1, C.META_EXPEDITION[id].ranks);
  return p;
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
