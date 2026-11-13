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
/**
 * The start camp's options (D128, D130; expedition.md 2.3-2.4): C.PREP_CAMP_OPTIONS as built (Field Draughts, Ember of
 * Return, Region Charts, Tracker's Notes), read once at load like GATE_DEFAULTS. An engine before D128 has no such list:
 * its camp offered every C.PREP_OPTION, so that is its default. CAMP_LIST: the engine has the list (it can be set per cell).
 */
export const CAMP_LIST = Array.isArray(C.PREP_CAMP_OPTIONS);
export const CAMP_DEFAULTS = Object.freeze([...(CAMP_LIST ? C.PREP_CAMP_OPTIONS : Object.keys(C.PREP_OPTION || {}))]);

/**
 * The options a cell's start camp offers, in C.PREP_OPTION order: the engine's defaults (null), every option ('all', the
 * camp before D128; --camp-options all), or the named ids (a later meta unlock that puts an option back).
 */
export function campOptionsFor(campOptions = null) {
  const ids = Object.keys(C.PREP_OPTION || {});
  if (!campOptions) return [...CAMP_DEFAULTS];
  if (campOptions === 'all') return ids;
  for (const id of campOptions) if (!C.PREP_OPTION[id]) throw new Error(`campOptions: unknown option ${id}`);
  return ids.filter((id) => campOptions.includes(id));
}

/**
 * --prep-force / --prep-ban against the cell's camp (D128): the message refusing ids the camp does not offer (the engine's
 * BUY_PREP refuses them and R.prepView does not list them, so a forced id would never be bought and a ban would measure
 * nothing), or null when every id is offered.
 */
export function campRefusal(flag, ids, campOptions = null) {
  const offered = campOptionsFor(campOptions);
  const out = (ids || []).filter((id) => !offered.includes(id));
  if (!out.length) return null;
  return `${flag}: ${out.join(', ')} not offered at the start camp (it offers ${offered.join(', ')}; D128). `
    + 'Use --camp-options all (every option, the camp before D128) or --camp-options <ids> to offer it';
}

// M2b v12 (D101; engine-api.md 10): the engine's own escape rule helpers, so the bots price a Dimmed encounter after a
// walk as the engine spends it: outwardStep(zone-like { shardDist }, from, to), dimFightTime(escape) -> tolls.
export { outwardStep, dimFightTime } from '../../src/engine/expedition.js';
// M3 3.2 (sim/pick-tutorial-seed.mjs): the zone graph's own helpers, hops(nodes, from) (BFS) and angDist(a, b) (degrees).
export { hops, angDist } from '../../src/engine/expedition.js';

const errors = R.validateContent(CONTENT);
if (errors.length) throw new Error(`sim: content is invalid:\n  ${errors.slice(0, 10).join('\n  ')}`);

/**
 * A run in phase CREATE (content validated once at module load). mapMode 'expedition' (rules 1.9), its vision kit
 * ({ guide, charts, pathfinder }), dimming (false: B44's diagnostic cell) and prep (true: the start camp and contracts,
 * expedition.md 2-3). The sim names the map on every run (D118): no mapMode = the rows (classic) map, and an
 * expedition cell plays the start camp only when prep is set, so cells stay as they were before the game's
 * default switched to the expedition with the start camp (D116).
 */
export function newRunFor({ classId, petId = null, seed, profile = null, mapMode = null, vision = null, dimming = null, prep = false, tutorial = false }) {
  const o = { classId, petId: classId === 'hunter' ? petId : null, seed, profile, content: CONTENT, validate: false };
  o.mapMode = mapMode || 'rows';
  if (vision) o.vision = vision;
  if (dimming === false) o.dimming = false;
  if (o.mapMode === 'expedition') o.prep = !!prep;
  // M3 (report balance-2026-11-13c): the guided first run (newRun tutorial: zone 1 on TUTORIAL_SEED with the overlay;
  // expedition with the start camp only). The bots never press SKIP_GUIDE.
  if (tutorial) o.tutorial = true;
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
