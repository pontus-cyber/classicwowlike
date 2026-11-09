// Rules engine: public API (docs/specs/engine-api.md has the full contract and the event list).
//
//   newRun({classId, petId, name, seed, profile, content}) -> state      state in phase CREATE
//   legalActions(state) -> action[]                                      every concrete legal action
//   step(state, action) -> {state, events}                               pure; throws IllegalActionError
//   autoAction(state) -> action | null                                   autoplay policy (rules 7.9) + default policy
//   summary(state) -> object | null                                      run summary and Echoes (rules 9, 11.1)
//   serialize(state) -> string, deserialize(string, content) -> state    save / load (content is not saved)
//
// Pure and seeded (D5): no DOM, no clock, no Math.random, no globals. State is plain JSON except
// `state.content`, a shared reference to the immutable content tables, which step() never copies or changes
// and serialize() leaves out. ES modules; runs in Node and in the browser (D13).
//
// Also exported: validateContent, newProfile, metaOffers, buyMeta, mapView, isLegal, whyIllegal, stepInPlace,
// IllegalActionError, display helpers (xpToNext, talentPointsFree, itemScore, spellCost, spellCooldown,
// spellInfo, fleeChance) and every constant via `C`.
import * as C from './constants.js';
import { normaliseSeed } from './rng.js';
import { cloneState, deepClone, deepFreeze, IllegalActionError } from './engine/util.js';
import { validateContent, zoneContent } from './engine/content.js';
import { checkAction, applyAction, legalActions as legal } from './engine/actions.js';
import { autoAction as auto } from './engine/autoplay.js';
import { summary as sum } from './engine/summary.js';
import { newProfile, metaOffers, buyMeta, applyRunToProfile } from './engine/meta.js';
import { availablePets } from './engine/nodes.js';
import { nextLanes } from './engine/map.js';
import { xpToNext, talentPointsFree as freePoints } from './engine/progress.js';
import { itemScore } from './engine/items.js';
import { spellCost as cost, spellCd, spellAmount, fleeChance as flee, castError } from './engine/spells.js';

export const STATE_VERSION = 1;
export { C, validateContent, newProfile, metaOffers, buyMeta, applyRunToProfile, IllegalActionError, xpToNext, itemScore };

/** Unspent talent points (rules 6). */
export function talentPointsFree(state) {
  return state.player ? freePoints(state) : 0;
}

/** Resource cost of a known spell for the action bar (rules 7.3; includes talents and free-cast effects in a fight). */
export function spellCost(state, spellId) {
  return cost(state, spellId);
}

/** Cooldown in rounds after talents. Rounds left in a fight: max(0, state.fight.p.cds[id] - state.fight.round). */
export function spellCooldown(state, spellId) {
  return spellCd(state, spellId);
}

/**
 * Tooltip data for a class spell: names, numbers and, in a fight, whether it can be cast on `target`.
 * amount = base amount (before level, target, crit and variance modifiers); null for pure utility spells.
 */
export function spellInfo(state, spellId, target = null) {
  const sp = C.SPELL[spellId];
  if (!sp || !state.player || sp.cls !== state.player.classId) return null;
  const known = state.player.spells[spellId] || null;
  const f = state.fight;
  return {
    id: sp.id, name: sp.name, lvl: sp.lvl, tags: sp.tags.slice(), target: sp.target, source: sp.source,
    resource: C.CLASS[sp.cls].resource, cost: cost(state, spellId), cd: spellCd(state, spellId),
    cdLeft: f ? Math.max(0, (f.p.cds[spellId] || 0) - f.round) : 0,
    tl: known ? known.tl : null, rank: known ? known.rank : 0, amount: spellAmount(state, spellId),
    usable: f && known ? !castError(state, spellId, sp.target === 'enemy' ? target : null) : false,
    reason: f && known ? castError(state, spellId, sp.target === 'enemy' ? target : null) : null,
    text: (state.content.texts && state.content.texts.spells && state.content.texts.spells[spellId]) || null,
  };
}

/** FLEE success chance in the current fight (rules 7.8); 0 when fleeing is not allowed. */
export function fleeChance(state) {
  return flee(state);
}

/**
 * Create a run in phase CREATE. Any of classId, petId, name and seed may be preset; the player confirms with
 * START_RUN. seed: integer (the front end draws a random one; the engine never does). profile: meta profile
 * (newProfile() when omitted). content: the CONTENT object (src/content/index.js); it is validated
 * (structural check) and frozen.
 */
export function newRun({ classId = null, petId = null, name = '', seed = 0, profile = null, content, validate = true } = {}) {
  if (!content) throw new Error('newRun: content is required (import { CONTENT } from src/content/index.js)');
  if (validate) {
    const errors = validateContent(content);
    if (errors.length) throw new Error(`newRun: content is invalid:\n  ${errors.slice(0, 20).join('\n  ')}`);
  }
  deepFreeze(content);
  const prof = deepClone(profile || newProfile());
  if (classId !== null && !C.CLASS[classId]) throw new Error(`newRun: unknown class ${classId}`);
  if (petId !== null && (classId !== 'hunter' || !availablePets(prof).includes(petId))) throw new Error(`newRun: pet ${petId} is not available for ${classId}`);
  return {
    v: STATE_VERSION,
    content,
    contentVersion: content.version || null,
    phase: 'CREATE',
    create: { classId, petId, name: typeof name === 'string' ? name.trim().slice(0, 24) : '', seed: normaliseSeed(seed), oaths: [] },
    profile: prof,
    autoplay: false,
  };
}

/** Every concrete legal action (SET_NAME and SET_SEED take free values and are not listed). */
export function legalActions(state) {
  return legal(state);
}

/** null when legal, else the reason. */
export function whyIllegal(state, action) {
  return checkAction(state, action);
}

export function isLegal(state, action) {
  return !checkAction(state, action);
}

/**
 * Apply one action. Pure: returns a new state and the events to animate/log; the input is never changed.
 * Throws IllegalActionError (code 'ILLEGAL_ACTION') with the reason when the action is not legal.
 */
export function step(state, action) {
  const err = checkAction(state, action);
  if (err) throw new IllegalActionError(`Illegal action ${JSON.stringify(action)} in phase ${state.phase}: ${err}`, action);
  const s = cloneState(state);
  const events = [];
  applyAction(s, events, action);
  return { state: s, events };
}

/**
 * Same as step but changes `state` in place and returns the events. For simulators that own their state and
 * want to skip the copy. Never use it on a state the UI still renders.
 */
export function stepInPlace(state, action) {
  const err = checkAction(state, action);
  if (err) throw new IllegalActionError(`Illegal action ${JSON.stringify(action)} in phase ${state.phase}: ${err}`, action);
  const events = [];
  applyAction(state, events, action);
  return events;
}

/** The autoplay policy's action for this state (deterministic). null when the run has ended. */
export function autoAction(state) {
  return auto(state);
}

/** Run summary (rules 9) with the Echoes breakdown (rules 11.1). null before START_RUN. */
export function summary(state) {
  return sum(state);
}

/** JSON string of the state without the content tables. */
export function serialize(state) {
  const o = {};
  for (const k in state) if (k !== 'content') o[k] = state[k];
  return JSON.stringify(o);
}

/** State from serialize() output. content must be the same tables the run started with. */
export function deserialize(str, content) {
  const o = JSON.parse(str);
  if (o.v !== STATE_VERSION) throw new Error(`deserialize: state version ${o.v}, engine expects ${STATE_VERSION}`);
  if (!content) throw new Error('deserialize: content is required');
  if (o.contentVersion && content.version && o.contentVersion !== content.version) {
    throw new Error(`deserialize: saved with content ${o.contentVersion}, given ${content.version}`);
  }
  deepFreeze(content);
  return { content, ...o };
}

/**
 * What the player may see of the current zone map (rules 1.4): types, content level, quest titles, enemy
 * archetypes. Rare elites, treasure traps and vendor Embers only with meta Scout's Eye.
 */
export function mapView(state) {
  const s = state;
  if (!s.zone || s.zone.camp) return null;
  const c = s.content;
  const scout = !!(s.meta && s.meta.scout);
  const arch = (tid) => c.enemies[tid].archetype;
  const rows = s.zone.rows.map((row) => row.map((n) => {
    const v = { type: n.type, r: n.r, l: n.l, cl: n.cl, done: n.done };
    if (n.type === 'quest') { v.title = c.quests[n.quest].title; v.archetypes = n.mobs.map(arch); }
    if (n.type === 'grind') v.archetypes = n.waves[0].map(arch);
    if (n.type === 'elite') {
      v.level = n.eliteLevel;
      v.archetypes = [arch(n.elite), ...(n.add ? [arch(n.add)] : [])];
      v.rare = scout ? n.rare : null;
      v.name = scout || !n.rare ? c.enemies[n.elite].name : null;
    }
    if (n.type === 'dungeon') { v.name = zoneContent(c, s.zone.z).dungeon.name; v.level = n.trashLevel; v.bossLevel = n.bossLevel; }
    if (n.type === 'treasure') { v.guarded = !!n.guard; v.trap = scout ? n.trap : null; }
    if (n.type === 'vendor') v.ember = scout ? n.stock.some((e) => e.id === 'ember_of_return') : null;
    return v;
  }));
  return { z: s.zone.z, name: zoneContent(c, s.zone.z).name, pos: { ...s.zone.pos }, next: nextLanes(s.zone), rows };
}
