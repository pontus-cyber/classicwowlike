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
// Expedition map (rules 1.9): newRun({ mapMode: 'expedition' }) plays the roamable zone graph with vision, the Dimming,
// Roads and the Homeward Bell; mapView then returns the player-visible zone graph (engine-api.md 10). D116 (the flip): it is
// newRun's default, with the start camp (prep); mapMode 'rows' plays the classic map (rules 1.4), an option.
//
// Also exported: validateContent, newProfile, metaOffers, buyMeta, mapView, isLegal, whyIllegal, stepInPlace,
// IllegalActionError, display helpers (xpToNext, talentPointsFree, itemScore, spellCost, spellCooldown,
// spellInfo, fleeChance, bagCapacity, travelLevel, resurrectCharges, bossPar, defaultTarget), combat v2 helpers
// (engageOptions, engagePreview, isEngageRound, offBalance; rules 7.10-7.13), the heat meter (heatView, heatPreview;
// rules 1.7.1-1.7.2, 1.9.10), rule helpers (V, xpCurve, diffMod, zoneDanger), every constant via `C`, and the dev tools
// `debug` (engine-api.md 12, dev only: src/engine/debug.js). Owner feedback 2026-11-11: pendingTicks (the DoT preview,
// engine-api.md 6.1) and talentInfo (talent totals, rules 6). M2b v6: freePotion (Packed Satchel's free potion, rules 7.5).
// M2b v8: potionInfo (what a consumable restores now; the free potion at FREE_POTION_MULT, rules 7.5); zoneDanger's early factor.
// Start camp and contracts (prep, docs/specs/expedition.md 2-3, task 2b.5): an expedition run starts in phase PREP;
// prepView (the prep screen) and contractView (the contract tracker). M2b v13 (docs/specs/changes-m2b-v13.md): windupView
// (wind-ups and Deathblows with their answers), autoplayEngage (rule E2's engage answer), potionInfo's MAIMED amount and the
// map's Deathblow fields (engine-api.md 6.2). M3 onboarding (docs/specs/m3-onboarding.md 2, 4.2, 5; engine-api.md 14):
// newRun's `tutorial` option (the guided first run), tutorialView, SKIP_GUIDE, the rescue, the profile's guide and welcome
// (migrateProfile, setGuide) and debug.resetOnboarding.
import * as C from './constants.js';
import { normaliseSeed } from './rng.js';
import { cloneState, deepFreeze, IllegalActionError } from './engine/util.js';
import { validateContent, zoneContent } from './engine/content.js';
import { checkAction, applyAction, legalActions as legal } from './engine/actions.js';
import { autoAction as auto } from './engine/autoplay.js';
import { summary as sum } from './engine/summary.js';
import { newProfile, metaOffers, buyMeta, applyRunToProfile, parTime, migrateProfile, setGuide } from './engine/meta.js';
import { tutorialView as guidedView } from './engine/tutorial.js';
import { zoneDanger, defaultTarget as defaultTgt, pendingTicks as previewTicks } from './engine/combat.js';
import { availablePets, metaFromProfile, travelLevel as travelAt } from './engine/nodes.js';
import { nextLanes } from './engine/map.js';
import { xpToNext, xpCurve, diffMod, talentPointsFree as freePoints } from './engine/progress.js';
import { itemScore, V, bagCapacity as bagCap, countConsumable } from './engine/items.js';
import { spellCost as cost, spellCd, spellAmount, spellTl, fleeChance as flee, castError, itemAmount, spellHitChance } from './engine/spells.js';
import { resurrectOrder, offBalanceOpen, findSt, maimedHeal } from './engine/damage.js';
import { engageOptions as engageList, engagePreview as previewEngage } from './engine/engage.js';
import { isEngageRound as engageRound } from './engine/track.js';
import { MAP_MODES, isExpedition, expMapView } from './engine/expedition.js';
import { heatView as heatMeter, heatPreview as previewHeat } from './engine/heat.js';
import { prepView as prepScreen, contractView as contractTracker } from './engine/contracts.js';
import { createDebug } from './engine/debug.js';
import { windupView as windups, autoplayEngage as autoEngage } from './engine/answers.js';
import { deathblowOf, deathblowType } from './engine/track.js';
import { damageView as dmgView } from './engine/damageview.js';

/**
 * 3 (M2b v7): the run's time is `state.time` in whole tolls (was `hours`), with `stats.timeAtBoss`,
 * `stats.heat.timeByState` and the expedition zone records' `time`. 2 (combat v2): enemies carry intent tracks.
 * deserialize refuses a state saved by any other version (no conversion).
 */
export const STATE_VERSION = 3;
export { C, validateContent, newProfile, metaOffers, buyMeta, applyRunToProfile, IllegalActionError, xpToNext, itemScore };
/**
 * M3 (m3-onboarding.md E6): migrateProfile(profile) fills a stored profile's `guide` and `welcome` (runs > 0: 'done' and
 * true, else 'todo' and false); setGuide(profile, 'todo' | 'done' | 'skipped') for class select and Settings. Both pure.
 */
export { migrateProfile, setGuide };

/**
 * The guided first run for the UI (m3-onboarding.md 2.4-2.7, E5; engine-api.md 14), null in any other run: { on,
 * skipped, ended, guidedZone, script, scripts, next, sites, eliteNodeId, elite, rescues, rescueTolls, beat, line, open,
 * done, learned, skippedBeats }. Pure and cheap.
 */
export function tutorialView(state) {
  return state.player ? guidedView(state) : null;
}
/**
 * Read-only rule helpers for front ends and the simulator (never re-implement them):
 *   V(L)        value scale (rules 8.5): prices, gold, sell values are multiples of V
 *   xpCurve(L)  the levelling polynomial (rules 4.3), defined for every L (xpToNext(60) is 0, xpCurve(60) is not)
 *   diffMod(d)  XP level-difference modifier for d = content level - character level (rules 4.4)
 *   zoneDanger(level, variant = 'normal')  damage multiplier of an enemy built from a template (rules 7.6): 1 at or
 *               below ZONE_DANGER_FROM; 'trash' and 'dboss' (dungeon) take DUNGEON_DANGER_FRAC of the bonus (M2 v4);
 *               'normal' (quest, grind, Camp waves, summoned adds), 'elite', 'rare' the full bonus. Not the end boss.
 *               M2b v8: × EARLY_DMG_MULT (0.80) at level <= EARLY_DMG_MAX_LEVEL, so below 1 there.
 */
export { V, xpCurve, diffMod, zoneDanger };

/**
 * Boss time par in tolls (rules 1.7, 11.5): BOSS_TIME_PAR, OATH_HASTE_TIME less under the Oath of Haste. Ascendancy
 * counts the tolls past it; the speed bonus needs a kill at or under it. In CREATE: from the Oaths chosen so far.
 */
export function bossPar(state) {
  return parTime(state.player ? state.oaths : (state.create && state.create.oaths) || []);
}

/** Bag slots of the run: BAG_SLOTS plus meta Deeper Pockets (rules 8.7, 11.2). In CREATE: from the profile. */
export function bagCapacity(state) {
  if (state.meta) return bagCap(state);
  return C.BAG_SLOTS + metaFromProfile(state.profile, state.create ? state.create.classId : null).bagSlots;
}

/**
 * Level from which TRAVEL_ON is legal in the current zone (rules 1.5): exit level - TRAVEL_EARLY_LEVELS, one lower
 * with Swift Boots. After the last row TRAVEL_ON is legal at any level. null outside a zone (CREATE, Camp, run over)
 * and in an expedition run, which has no level gate (rules 1.9.7).
 */
export function travelLevel(state) {
  if (isExpedition(state)) return null; // expedition map: no level gate (rules 1.9.7)
  return state.player && state.zone && !state.zone.camp && state.phase !== 'SUMMARY' && state.phase !== 'ENDED' ? travelAt(state) : null;
}

/**
 * Resurrect charges (rules 9): `{ boon, secondBreath, ember, now, boss }`. The counts are what the player holds;
 * `now` and `boss` list the sources a death would use, in order ('boon', 'second_breath', 'ember'): `now` in the
 * current fight (out of combat: on the journey), `boss` in the end-boss fight, where Second Breath is not used
 * (M2 v3). Both are empty under the Oath of Frailty. null before START_RUN.
 */
export function resurrectCharges(state) {
  if (!state.player) return null;
  const p = state.player;
  return {
    boon: p.res.boon, secondBreath: p.res.meta, ember: countConsumable(state, 'ember_of_return'),
    now: resurrectOrder(state, !!(state.fight && state.fight.kind === 'boss')),
    boss: resurrectOrder(state, true),
  };
}

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
 * window (combat v2): the spell deals damage and `target` is in an OFF_BALANCE window (rules 7.13).
 * hit (blind tester report 2026-11-13): in a fight, the chance that its direct hit lands on `target` now (rules 7.2 step
 * 3: the level step, a physical hit's dodge; 1 for an interrupt), else null; hitAll: for a spell on every enemy, [{ u,
 * chance }] per living enemy (each has its own roll; Rime Burst and Deadfall Trap control only the enemies they hit),
 * else null.
 */
export function spellInfo(state, spellId, target = null) {
  const sp = C.SPELL[spellId];
  if (!sp || !state.player || sp.cls !== state.player.classId) return null;
  const known = state.player.spells[spellId] || null;
  const f = state.fight;
  const amount = spellAmount(state, spellId);
  const hits = !!amount && (amount.kind === 'damage' || amount.kind === 'dot');
  const open = (i) => !!(f && f.enemies[i] && f.enemies[i].alive && offBalanceOpen(f.enemies[i]));
  const window = hits && (sp.target === 'all' ? !!f && f.enemies.some((e, i) => open(i)) : typeof target === 'number' && open(target));
  const direct = !!(f && amount && amount.kind === 'damage');
  const live = (i) => !!(f && f.enemies[i] && f.enemies[i].alive);
  return {
    window,
    hit: direct && sp.target === 'enemy' && typeof target === 'number' && live(target) ? spellHitChance(state, spellId, target) : null,
    hitAll: direct && sp.target === 'all' ? f.enemies.filter((e) => e.alive).map((e) => ({ u: e.idx, chance: spellHitChance(state, spellId, e.idx) })) : null,
    id: sp.id, name: sp.name, lvl: sp.lvl, tags: sp.tags.slice(), target: sp.target, source: sp.source,
    resource: C.CLASS[sp.cls].resource, cost: cost(state, spellId), cd: spellCd(state, spellId),
    cdLeft: f ? Math.max(0, (f.p.cds[spellId] || 0) - f.round) : 0,
    tl: known ? spellTl(state, spellId) : null, rank: known ? known.rank : 0, amount,
    usable: f && known ? !castError(state, spellId, sp.target === 'enemy' ? target : null) : false,
    reason: f && known ? castError(state, spellId, sp.target === 'enemy' ? target : null) : null,
    text: (state.content.texts && state.content.texts.spells && state.content.texts.spells[spellId]) || null,
  };
}

/**
 * Autoplay's default target in the current fight (rules 7.9): living, not HEXED or SAPPED, mender > caster > others,
 * lowest HP, lowest index (HEXED or SAPPED enemies only when no other is left). null outside a fight.
 */
export function defaultTarget(state) {
  return state.fight ? defaultTgt(state) : null;
}

/** Is the current fight in its engage round (rules 7.10, combat v2)? ENGAGE is legal only then. */
export function isEngageRound(state) {
  return engageRound(state.fight);
}

/**
 * Engage options of the class for the engage panel (rules 7.10), or null outside the engage round: [{ id, kind
 * ('strike'|'control'|'setup'), name, targets (enemy indices, or [null]), spells (Pre-cast: [{ spellId, targets }]),
 * disrupt (combat v2.1: the targets on which the control option is Disrupt), reason (why it cannot be used, e.g. an
 * immune enemy without a wind-up) }]. Send each as ENGAGE { option, target } (Pre-cast also `spellId`).
 */
export function engageOptions(state) {
  return engageList(state);
}

/**
 * What an ENGAGE action would do to the tracks (rules 7.10, combat v2), for the engage panel's hover preview; no
 * draw, so it shows nothing the player cannot see. null when the action is not legal, else { enemies: [{ u,
 * cancelled, offBalance, window, pet, stagger, disrupt }] } (turn numbers): entries it cancels, those that leave the
 * enemy OFF_BALANCE, turns FROZEN (a window), turns whose single-target hits go to the pet, (combat v2.1) cancelled
 * wind-ups (STAGGERED), and whether it is a Disrupt.
 */
export function engagePreview(state, action) {
  return previewEngage(state, action);
}

/**
 * The OFF_BALANCE window on an enemy (rules 7.13, combat v2), or null: { status ('OFF_BALANCE' or 'FROZEN', which
 * counts as OFF_BALANCE while it lasts), taken (extra damage taken from the player and pet), crit (extra player
 * crit chance), rounds (status rounds left) }.
 */
export function offBalance(state, enemyIdx) {
  const e = state.fight && state.fight.enemies[enemyIdx];
  if (!e || !e.alive || !offBalanceOpen(e)) return null;
  const ob = findSt(e.st, 'OFF_BALANCE');
  const fr = findSt(e.st, 'FROZEN');
  const x = ob || fr;
  return { status: ob ? 'OFF_BALANCE' : 'FROZEN', taken: ob ? ob.value : C.OFFBAL_TAKEN, crit: C.OFFBAL_CRIT, rounds: x.dur };
}

/**
 * The heat meter, shown as the Furnace (rules 1.7.1-1.7.2, 1.9.10; expedition.md H.4, H.6; M2b v7: whole tolls), or
 * null before START_RUN: time, par, line, heat (tolls past the line; negative = tolls in hand), inHand, past, stateRun,
 * dimIn and stateDim (expedition zones: the Dimming's clock on the player's node, else null), state (the hotter one)
 * and by ('run' | 'dim'), ascIfPar (boss Ascendancy if every later zone keeps its line share), gain and rarityUp (the
 * state's rewards, rules 1.7.3), bar (HEAT_BAR_MIN..HEAT_BAR_MAX, marker, beyond), and next: heatPreview of every legal
 * time-costing choice now ("3 tolls, ends Smouldering"). Cheap and pure; usable in any phase.
 */
export function heatView(state) {
  return heatMeter(state, (a) => !checkAction(state, a));
}

/**
 * Heat after one time-costing action (rules 1.7.1, 1.9.10): { time, timeAfter, line, heat, stateRun, dimIn, stateDim,
 * state, by, ascIfPar, change, dimFight, perWave, pays }, `pays` being the state a node entered by this action pays at
 * (rules 1.7.3); null when the action costs no time or is not legal now.
 */
export function heatPreview(state, action) {
  return checkAction(state, action) ? null : previewHeat(state, action);
}

/**
 * The start camp (prep; expedition.md 2, 9.1), null outside PREP: { points, spent, left, slots, held, board: [{ index, z,
 * zoneName, band, kind, region, regionName, family, template, name, dungeon, need, price, reward, taken, canTake, canDrop
 * }], options: [{ id, name, kind, price, owned, bought, canBuy, canSell, why, item, qty, bell, slots, charges }], reroll:
 * { used, max, price, can }, reserve: { points, echoes } }. Fields in engine-api.md 13.
 */
export function prepView(state) {
  return prepScreen(state);
}

/**
 * The contract tracker (prep; expedition.md 3, 9.3): { slots, held, reserve, contracts: [{ id, z, zoneName, band, kind,
 * region, regionName, family, template, name, dungeon, need, price, reward, from, progress, status }], hub: the hub
 * contract on offer with the legal modes, or null }. Never the sites' nodes (mapView marks the ones the player sees).
 * null in a rows run and before START_RUN. Fields in engine-api.md 13.
 */
export function contractView(state) {
  return contractTracker(state, (a) => !checkAction(state, a));
}

/** FLEE success chance in the current fight (rules 7.8); 0 when fleeing is not allowed. */
export function fleeChance(state) {
  return flee(state);
}

/**
 * Packed Satchel's free potion (rules 7.5, M2b v6): true while the current fight's free potion is unused, so the next
 * potion (an item with `C.CONSUMABLE[id].potion`) the player drinks costs no turn. false outside a fight, without the
 * unlock, once it is used, and while the player's action is skipped. Its item event carries `free: true`.
 */
export function freePotion(state) {
  const f = state.fight;
  return !!(f && !f.over && f.p.freePotion && !f.p.skip);
}

/**
 * What one use of a consumable restores now (rules 8.6; M2b v8, rules 7.5): { id, free, mult, heal, mana, maim }. heal and
 * mana are the amounts before the cap at max HP and max mana (the `heal` and `mana` events show what was restored), 0
 * when it restores none (Purifying Tonic, Spark Flask). free: in a fight, this use would be Packed Satchel's free potion
 * (freePotion(state) and a potion); then mult = FREE_POTION_MULT and the amounts are that share of the normal ones, else
 * mult = 1. M2b v13 (rules 7.5, D107): while the player is MAIMED, `heal` is the cut amount (× (1 - MAIM_HEAL), rounded
 * once, as healUnit applies it) and maim = the MAIMED share (0 when not MAIMED); mana is not healing and stays. The
 * engine's own numbers (spells.js itemAmount, damage.js maimedHeal): show these, never recompute them. null for an id
 * that is not a consumable, or before START_RUN.
 */
export function potionInfo(state, itemId) {
  const c = C.CONSUMABLE[itemId];
  if (!c || !state.player || !state.player.d) return null;
  const free = !!(c.potion && freePotion(state));
  const a = itemAmount(state, itemId, free);
  const m = state.fight ? findSt(state.fight.p.st, 'MAIMED') : null;
  return { id: itemId, free, mult: a.mult, heal: a.heal > 0 && m ? maimedHeal(state, a.heal) : a.heal, mana: a.mana, maim: m ? m.value : 0 };
}

/**
 * Wind-ups and Deathblows on the enemies' tracks with their answers (M2b v13; engine-api.md 6.2): [{ u, enemy, turn, round,
 * inRounds, id, name, kind, deathblow, firstMeet, heavy, target, est, empower, maims, maimHeal, stagger, cancel, answers,
 * ready }], null outside a fight. answers: the player's options that answer it now (engage control or Disrupt in the
 * engage round, interrupt, stun and control spells off cooldown by its round, defensives for a heavy one); ready: "answers
 * ready" (false: show "no answer ready").
 */
export function windupView(state) {
  return windups(state);
}

/**
 * Autoplay's engage answer (M2b v13, rules 7.9 rule E2): in the engage round, the ENGAGE autoplay plays on a special
 * enemy's visible wind-up, { action, option, name ('Disrupt' or the option's name), target, enemy, windup: { turn, id, name,
 * deathblow } }, else null ("Autoplay will answer the Deathblow with <name>").
 */
export function autoplayEngage(state) {
  return autoEngage(state);
}

/**
 * DoT preview (owner feedback 2026-11-11 08:11; engine-api.md 6.1): what the ticks at the end of the current round
 * (rules 7.1 step 5) will do if nothing else happens before them, played exactly on a copy of the state without draws:
 * [{ u, hp, amount, hpLost, absorbed, heal, hpAfter, lethal, resurrect, ticks, crit }] in tick order (player, pet,
 * enemies), one entry per unit the ticks touch. With `unit` ('player', 'pet' or an enemy index): that unit's entry, or
 * null when no tick touches it. null outside a fight.
 */
export function pendingTicks(state, unit) {
  const all = previewTicks(state);
  if (unit === undefined || !all) return all;
  return all.find((x) => x.u === unit) || null;
}

/**
 * The character sheet's damage block (owner feedback 2026-11-11 11:58; engine-api.md 1): the class's main attack's hit
 * range, crit range and average (crit included) on a target-free foe, the Hunter pet's, the summed % modifiers and what one
 * point of Power or Weapon damage adds. From the damage pipeline (src/engine/damageview.js); null without a character.
 */
export function damageView(state) {
  return dmgView(state);
}

/**
 * Talent totals (owner feedback 2026-11-11 08:14; rules 6, engine-api.md 1): { id, name, ranks, rank, per, now, next }.
 * per = the per-rank values (C.TALENT_PER_RANK), now = their totals at the ranks taken (null at rank 0), next = at one
 * more rank (null at the maximum). `base` (Toxic Coating, Trapper) is the damage formula evaluated with the character's
 * level, Power and the spell's training level, before modifiers. Hemorrhage Mastery: { dotCrit, dotPct } by rank. null
 * for an unknown talent. Works in any phase; without a character (CREATE) `base` is null.
 */
export function talentInfo(state, talentId) {
  const t = C.TALENT[talentId];
  if (!t) return null;
  const p = state && state.player;
  const rank = p && p.talents ? p.talents[talentId] || 0 : 0;
  const keys = C.TALENT_PER_RANK[talentId] || [];
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  const baseOf = () => {
    if (!p || !p.d) return null;
    const lvl = talentId === 'h_c3' && p.spells.snare_trap ? spellTl(state, 'snare_trap') : p.level;
    return t.b + t.l * lvl + t.p * p.d.power;
  };
  const at = (n) => {
    if (talentId === 'r_c5') return { dotCrit: n >= 1, dotPct: n >= 2 ? t.rank2DotPct : 0 };
    const o = {};
    for (const k of keys) {
      if (k === 'base') { const b = baseOf(); o.base = b === null ? null : Math.round(b * n * 10) / 10; } else o[k] = r6(t[k] * n);
    }
    return o;
  };
  return { id: t.id, name: t.name, ranks: t.ranks, rank, per: at(1), now: rank > 0 ? at(rank) : null, next: rank < t.ranks ? at(rank + 1) : null };
}

/**
 * Create a run in phase CREATE. Any of classId, petId, name and seed may be preset; the player confirms with
 * START_RUN. seed: integer (the front end draws a random one; the engine never does). profile: meta profile
 * (newProfile() when omitted). content: the CONTENT object (src/content/index.js); it is validated
 * (structural check) and frozen. mapMode: 'expedition' (rules 1.9; the default since D116) or 'rows' (the classic
 * map, rules 1.4; an option for the simulator and the Dev menu).
 * vision (expedition only): { guide, charts, pathfinder } booleans for Local Guide, Region Charts and Pathfinder
 * (rules 1.9.5), owned from the start. dimming (expedition only, D50): false plays the run without the Dimming (no front,
 * no Dimmed nodes or encounters), a measurement option for the simulator (balance.md B44). prep (expedition only; prep,
 * expedition.md 2-3): true (the default on the expedition map since D116) starts the run at the start camp (phase PREP)
 * and plays contracts, the hub contract and the Spyglass, with the story chain retired; false plays the expedition map
 * without the start camp, as before task 2b.5. Left out (null), prep is true on the expedition map and false on the rows map.
 * tutorial (M3, m3-onboarding.md 2, E1): true plays the guided first run (expedition with the start camp only; needs
 * CONTENT.tutorial): zone 1 on TUTORIAL_SEED with the content's overlay, the rescue, the beats, SKIP_GUIDE; default false.
 */
export function newRun({ classId = null, petId = null, name = '', seed = 0, profile = null, content, validate = true, mapMode = 'expedition', vision = null, dimming = true, prep = null, tutorial = false } = {}) {
  if (!content) throw new Error('newRun: content is required (import { CONTENT } from src/content/index.js)');
  if (!MAP_MODES.includes(mapMode)) throw new Error(`newRun: mapMode must be one of ${MAP_MODES.join(', ')}`);
  if (vision !== null && (mapMode !== 'expedition' || typeof vision !== 'object' || Object.keys(vision).some((k) => !['guide', 'charts', 'pathfinder'].includes(k)))) {
    throw new Error('newRun: vision is an expedition option: { guide, charts, pathfinder }');
  }
  if (typeof dimming !== 'boolean' || (!dimming && mapMode !== 'expedition')) throw new Error('newRun: dimming is an expedition option: true (default) or false');
  if (prep !== null && (typeof prep !== 'boolean' || (prep && mapMode !== 'expedition'))) throw new Error('newRun: prep is an expedition option: true (default) or false');
  if (prep === null) prep = mapMode === 'expedition'; // D116: the start camp comes with the expedition map unless turned off
  // M3 (m3-onboarding.md 2.1, E1): the guided first run needs the expedition map, the start camp and CONTENT.tutorial.
  if (typeof tutorial !== 'boolean' || (tutorial && (mapMode !== 'expedition' || !prep))) throw new Error('newRun: tutorial is an expedition option with the start camp (prep): true or false (default)');
  if (tutorial && !content.tutorial) throw new Error('newRun: tutorial needs the guided-run table CONTENT.tutorial (src/content/tutorial.js)');
  if (validate) {
    const errors = validateContent(content);
    if (errors.length) throw new Error(`newRun: content is invalid:\n  ${errors.slice(0, 20).join('\n  ')}`);
  }
  deepFreeze(content);
  const prof = migrateProfile(profile || newProfile()); // M3 (E6): a stored profile gets its guide and welcome keys
  if (classId !== null && !C.CLASS[classId]) throw new Error(`newRun: unknown class ${classId}`);
  if (petId !== null && (classId !== 'hunter' || !availablePets(prof).includes(petId))) throw new Error(`newRun: pet ${petId} is not available for ${classId}`);
  return {
    v: STATE_VERSION,
    content,
    contentVersion: content.version || null,
    mapMode,
    phase: 'CREATE',
    create: {
      classId, petId, name: typeof name === 'string' ? name.trim().slice(0, 24) : '', seed: normaliseSeed(seed), oaths: [],
      ...(mapMode === 'expedition' ? { vision: { guide: !!(vision && vision.guide), charts: !!(vision && vision.charts), pathfinder: !!(vision && vision.pathfinder) }, dimming, prep } : {}),
      ...(tutorial ? { tutorial: true } : {}), // M3: the guided first run (state.tutorial from START_RUN)
    },
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

/**
 * State from serialize() output. content must be the same tables the run started with. A state of another
 * STATE_VERSION is refused (M2b v7: a version 2 save counts hours and cannot be loaded; start a new run).
 */
export function deserialize(str, content) {
  const o = JSON.parse(str);
  if (o.v !== STATE_VERSION) {
    const why = o.v === 2 ? ' (saved before M2b v7: it counts time in hours, the engine counts tolls)' : '';
    throw new Error(`deserialize: state version ${o.v}, engine expects ${STATE_VERSION}${why}; old saves cannot be loaded, start a new run`);
  }
  if (!content) throw new Error('deserialize: content is required');
  if (o.contentVersion && content.version && o.contentVersion !== content.version) {
    throw new Error(`deserialize: saved with content ${o.contentVersion}, given ${content.version}`);
  }
  deepFreeze(content);
  return { content, ...o };
}

/**
 * What the player may see of the current zone map (rules 1.4): types, content level, quest titles, enemy
 * archetypes. Rare elites, treasure traps and vendor Embers only with meta Scout's Eye. In an expedition run (rules
 * 1.9.5) the zone graph as the player sees it: skeleton, landmarks and the Dimming everywhere, contents only of nodes
 * in view or seen (engine-api.md 10). null outside a zone.
 */
export function mapView(state) {
  const s = state;
  if (!s.zone || s.zone.camp) return null;
  if (isExpedition(s)) return expMapView(s);
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
      // M2b v13 (UI list 7): its Deathblow, shown when its name is (a rare's only with Scout's Eye); M2b v14 (row 2, D112):
      // a hidden name shows only the Deathblow's type
      v.deathblow = v.name !== null ? deathblowOf(c, n.elite, n.rare ? 'rare' : 'elite') : deathblowType(c, n.elite, n.rare);
    }
    if (n.type === 'dungeon') {
      v.name = zoneContent(c, s.zone.z).dungeon.name; v.level = n.trashLevel; v.bossLevel = n.bossLevel;
      // Combat v2 (rules 7.14): archetypes of each trash fight and of the boss, so a pull can be planned from the map.
      v.fights = n.trash.map((f) => f.map(arch));
      v.bossArchetype = arch(n.boss);
      v.bossDeathblow = deathblowOf(c, n.boss, 'dboss'); // M2b v13 (UI list 7)
    }
    if (n.type === 'treasure') { v.guarded = !!n.guard; v.trap = scout ? n.trap : null; v.archetypes = n.guard ? [arch(n.guard)] : []; }
    if (n.type === 'vendor') v.ember = scout ? n.stock.some((e) => e.id === 'ember_of_return') : null;
    return v;
  }));
  return { z: s.zone.z, name: zoneContent(c, s.zone.z).name, pos: { ...s.zone.pos }, next: nextLanes(s.zone), rows };
}

/**
 * Dev tools (engine-api.md 12; dev only, not game rules): build a run at any zone and level, jump to the Camp or the
 * end-boss fight, start any encounter, set the run's time, grant Echoes, god mode, validate a state. A run they change is a
 * dev run: no Echoes, the profile stays as it was. Pure and seeded like step.
 */
export const debug = createDebug({ newRun, step, serialize, deserialize, mapView, heatView, summary, STATE_VERSION });
