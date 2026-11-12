// Dev tools (owner feedback 2026-11-11 07:41; docs/specs/engine-api.md section 12, a dev-only API, not game rules):
// pure, seeded helpers that build or change a run so any stage can be tested without playing to it. src/rules.js
// exports them as `debug` (R.debug.*), made by createDebug with the public functions they need (no import cycle).
//
//   build(opts)                       a run at a zone and level: gear, spells, talents, gold, potions (phase ZONE_HUB or CAMP)
//   toCamp(s), toBoss(s, {phase}), nextZone(s)        jumps (the end-boss fight in phase 1, 2 or 3)
//   encounter(s, {ids, level})        a fight against any enemy templates (node type `dev`; back where it started)
//   killTarget(s, idx), refill(s), setGod(s, on), give(s, {gold, potions, talentPoints})
//   setTime(s, time), setHeat(s, state), revealMap(s), setMapMode(s, mode)       (time in whole tolls, M2b v7)
//   grantEchoes(profile, n), fullCatalogue(profile), setProfile(s, profile)      the meta profile
//   enemies(content)                  every enemy template with its zone and kind (the Dev menu's list)
//   validate(s, {steps})              the state checks every helper's result passes (string[]; empty = valid)
//
// Each run helper returns { state, events } with a new state (its input is never changed) and marks the run a dev run
// (state.dev: { tools, god, godUsed, n, talentPoints }): its summary has a `dev` block, it earns no Echoes and END_RUN
// leaves the profile as it was (summary.js, meta.js). God mode stops all damage to the player (damage.js). Draws come
// only from the engine's own streams and the dev stream (rng.js STREAM.dev): same state + same calls = same result.
import {
  CLASS, SPELL, TALENT, META, SLOT_IDS, RARITY, RARITY_ORDER, ILVL_MAX, ZONE_COUNT, ZONE_LEVELS, MAX_LEVEL, P2_AT,
  P3_AT, HEAT_STATES, HEAT_WARM_AT, HEAT_HOT_AT, HEAT_SCORCH_AT, SPELL_BAR_SLOTS, ITEM_BAR_SLOTS, CONSUMABLE, STACK_JUNK,
  INTENT_TRACK_LEN, DEV, TALENT_TIER_GATE,
} from '../constants.js';
import { STREAM } from '../rng.js';
import { cloneState, deepClone, rnd, IllegalActionError } from './util.js';
import { refreshDerived } from './stats.js';
import { talentPointsFree, xpToNext } from './progress.js';
import { V, makeFixedGear, makeConsumable, addToBag, canAdd, countConsumable, bagCapacity } from './items.js';
import { checkAction, applyAction, legalActions } from './actions.js';
import { autoAction, nextTalent, desiredBar, desiredItemBar } from './autoplay.js';
import {
  enterZone, completeNode, endDevEncounter, travelOn, takeRoad, fightBoss, finishFight, zoneAddPool, trainerSpells,
  availablePets, startExpedition, settleExpedition, setOut,
} from './nodes.js';
import { startFight, defaultTarget } from './combat.js';
import { applyDamage } from './damage.js';
import { onBossDamaged, bossIntent, bossTrackView } from './boss.js';
import { refreshTrack } from './track.js';
import { lineAt, newHeatStats } from './heat.js';
import { isExpedition, MAP_MODES } from './expedition.js';
import { zoneContent } from './content.js';
import { newProfile } from './meta.js';

const RUN_PHASES = ['ZONE_HUB', 'MAP', 'NODE', 'CAMP', 'BOSS'];
const PHASES = ['CREATE', 'PREP', ...RUN_PHASES, 'SUMMARY', 'ENDED'];
const CAMP = ZONE_COUNT + 1;

const fail = (msg) => { throw new IllegalActionError(msg); };
const isInt = (x) => Number.isInteger(x);

/** A copy of a state in a run (ZONE_HUB, MAP, NODE, CAMP, BOSS), or an IllegalActionError naming the helper. */
function runCopy(state, what) {
  if (!state || !state.player || !RUN_PHASES.includes(state.phase)) fail(`${what}: only during a run (phase ${state ? state.phase : 'none'})`);
  return cloneState(state);
}

/** Mark the run a dev run and record the tool (state.dev). Returns state.dev. */
function mark(s, tool) {
  if (!s.dev) s.dev = { tools: [], god: false, godUsed: false, n: 0, talentPoints: 0 };
  if (!s.dev.tools.includes(tool)) s.dev.tools.push(tool);
  return s.dev;
}

function setPhase(s, ev, phase) {
  if (s.phase !== phase) ev.push({ t: 'phase', phase });
  s.phase = phase;
}

/** Apply one engine action in place, as step would (its own legality check). */
function act(s, ev, a) {
  const err = checkAction(s, a);
  if (err) fail(`debug: ${a.type} ${JSON.stringify(a)}: ${err}`);
  applyAction(s, ev, a);
}

/**
 * Leave whatever is open before a jump, by the engine's own exits: the loot window's items are dropped, a fight is left
 * (its rewards with it), a service closes, a map node is resolved as after a flight (completeNode), a Dimmed encounter
 * or a dev fight ends where it would. The end-boss fight is left for the Camp.
 */
function leaveAll(s, ev) {
  for (const it of s.loot || []) ev.push({ t: 'lootDropped', item: it.uid });
  s.loot = [];
  s.fight = null;
  if (s.service) {
    if (s.service.where === 'hub' && s.service.kind === 'vendor' && s.zone && s.zone.hubStock) s.zone.hubStock = s.service.stock;
    s.service = null;
    ev.push({ t: 'serviceClosed' });
  }
  if (s.node) {
    if (s.node.type === 'dev') endDevEncounter(s, ev);
    else if (s.node.type === 'dim') { s.node = null; setPhase(s, ev, 'MAP'); }
    else completeNode(s, ev);
  }
  s.lootRng = null;
  if (s.phase === 'BOSS') setPhase(s, ev, 'CAMP');
}

/** Add n units of a consumable while the bag takes them (rules 8.7). Returns how many were added. */
function addUnits(s, id, n) {
  let k = 0;
  while (k < n && canAdd(s, { kind: 'cons', id, qty: 1 })) { addToBag(s, makeConsumable(s, id, 1)); k++; }
  return k;
}

/** Healing Draughts, and Mana Draughts for a class with mana. Returns the Healing Draughts added. */
function addPotions(s, n) {
  const k = addUnits(s, 'healing_draught', n);
  if (CLASS[s.player.classId].resource === 'mana') addUnits(s, 'mana_draught', n);
  return k;
}

/** The default policy's bar and item bar (autoplay, rules 7.9), set by SET_BAR and SET_ITEM_BAR. */
function setBars(s, ev) {
  const p = s.player;
  const bar = desiredBar(s);
  for (let i = 0; i < SPELL_BAR_SLOTS; i++) if (p.bar[i] !== bar[i]) act(s, ev, { type: 'SET_BAR', slot: i, spellId: bar[i] });
  const ib = desiredItemBar(s);
  for (let i = 0; i < ITEM_BAR_SLOTS; i++) if (p.itemBar[i] !== ib[i]) act(s, ev, { type: 'SET_ITEM_BAR', slot: i, itemId: ib[i] });
}

/** Go to the Camp from a zone: counted as ZONE_COUNT zones left (rules 1.6). */
function enterCampNow(s, ev) {
  s.stats.zonesLeft = Math.max(s.stats.zonesLeft, ZONE_COUNT);
  s.stats.maxZone = ZONE_COUNT;
  enterZone(s, ev, CAMP);
}

/** Every enemy template with the first zone that lists it (its home zone; null when no zone does) and its kind. */
function enemies(content) {
  const out = [];
  const seen = new Set();
  const add = (id, z) => {
    const t = content.enemies[id];
    if (!t || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: t.name, kind: t.kind, archetype: t.archetype, family: t.family || null, zone: z });
  };
  content.zones.forEach((zn, i) => {
    for (const id of [...zn.normals, ...zn.elites, ...zn.rares, ...zn.dungeon.trash, zn.dungeon.boss]) add(id, i + 1);
  });
  for (const id of Object.keys(content.enemies)) add(id, null);
  return out;
}

/** The tolls past the line that put the run in a heat state (rules 1.7.2): the middle of its band (whole numbers). */
function heatTarget(state) {
  if (state === 'clear') return HEAT_WARM_AT - (HEAT_HOT_AT - HEAT_WARM_AT) / 2;
  if (state === 'warm') return (HEAT_WARM_AT + HEAT_HOT_AT) / 2;
  if (state === 'hot') return (HEAT_HOT_AT + HEAT_SCORCH_AT) / 2;
  return HEAT_SCORCH_AT + (HEAT_SCORCH_AT - HEAT_HOT_AT) / 2;
}

/** Path of an object that appears twice in the state tree (content excluded), or null. */
function sharedPath(root) {
  const seen = new Set();
  const walk = (v, path) => {
    if (v === null || typeof v !== 'object') return null;
    if (seen.has(v)) return path;
    seen.add(v);
    for (const k of Object.keys(v)) { const r = walk(v[k], `${path}.${k}`); if (r) return r; }
    return null;
  };
  for (const k of Object.keys(root)) if (k !== 'content') { const r = walk(root[k], k); if (r) return r; }
  return null;
}

/**
 * Make the dev tools around the public engine functions they need: { newRun, step, serialize, deserialize, mapView,
 * heatView, summary, STATE_VERSION } of src/rules.js.
 */
export function createDebug(api) {
  const { newRun, step, serialize, deserialize, mapView, heatView, summary, STATE_VERSION } = api;

  /**
   * A run at a zone and level (phase ZONE_HUB of zone `zone`, or CAMP for zone ZONE_COUNT + 1). opts: content (required),
   * classId ('rogue'), petId (Hunter: the first pet the profile has), name, seed (0), profile, oaths ([]: Oaths sworn in
   * CREATE, the profile must own them), mapMode ('expedition'; 'rows' the classic map), vision, dimming, prep (newRun
   * options and defaults: the start camp on the expedition map, left with nothing bought), zone (1), level (the zone's
   * first level; the Camp MAX_LEVEL), rarity (DEV.RARITY) and ilvl (level + the rarity's ilvlBonus, at most ILVL_MAX) of
   * the gear in every slot (fixed stats as starting gear: the class's primary, STA, the power affix), talents ('auto':
   * the default build of autoplay; 'unspent'), gold (DEV.GOLD_V × V(level) copper), potions (DEV.POTIONS Healing
   * Draughts, and as many Mana Draughts for a Mage), time (tolls; the line of zone - 1: on schedule). Every class spell up to
   * the level (and the profile's meta spells) is learned and trained to the level; the bars are autoplay's. Full HP and
   * mana. Returns { state, events }.
   */
  function build(opts = {}) {
    const o = opts || {};
    if (!o.content) throw new Error('debug.build: content is required');
    const classId = o.classId || 'rogue';
    if (!CLASS[classId]) fail(`debug.build: unknown class ${classId}`);
    const zone = o.zone ?? 1;
    if (!isInt(zone) || zone < 1 || zone > CAMP) fail(`debug.build: zone must be 1-${CAMP} (${CAMP}: the Camp)`);
    const level = o.level ?? (zone === CAMP ? MAX_LEVEL : ZONE_LEVELS * (zone - 1) + 1);
    if (!isInt(level) || level < 1 || level > MAX_LEVEL) fail(`debug.build: level must be 1-${MAX_LEVEL}`);
    const rarity = o.rarity || DEV.RARITY;
    if (!RARITY_ORDER.includes(rarity)) fail(`debug.build: rarity must be one of ${RARITY_ORDER.join(', ')}`);
    const ilvl = o.ilvl ?? Math.min(ILVL_MAX, level + RARITY[rarity].ilvlBonus);
    if (!isInt(ilvl) || ilvl < 1 || ilvl > ILVL_MAX) fail(`debug.build: item level must be 1-${ILVL_MAX}`);
    const talents = o.talents || 'auto';
    if (!['auto', 'unspent'].includes(talents)) fail("debug.build: talents must be 'auto' or 'unspent'");
    if (o.hours !== undefined) fail('debug.build: `hours` is now `time` (whole tolls, M2b v7)');
    for (const [k, v] of [['gold', o.gold], ['potions', o.potions], ['time', o.time]]) if (v != null && (!isInt(v) || v < 0)) fail(`debug.build: ${k} must be a whole number >= 0`);
    const profile = o.profile || null;
    const petId = classId === 'hunter' ? o.petId || availablePets(profile || newProfile())[0] : null;
    if (petId && !availablePets(profile || newProfile()).includes(petId)) fail(`debug.build: the pet ${petId} is not unlocked in the profile`);
    if (o.mapMode && !MAP_MODES.includes(o.mapMode)) fail(`debug.build: mapMode must be one of ${MAP_MODES.join(', ')}`);
    let s = newRun({ classId, petId, name: o.name || '', seed: o.seed ?? 0, profile, content: o.content, mapMode: o.mapMode || 'expedition', vision: o.vision ?? null, dimming: o.dimming ?? true, prep: o.prep ?? null });
    const ev = [];
    for (const oath of o.oaths || []) { const r = step(s, { type: 'SET_OATH', oath, on: true }); s = r.state; ev.push(...r.events); }
    const r0 = step(s, { type: 'START_RUN' });
    s = r0.state;
    ev.push(...r0.events);
    // Expedition (prep): the start camp is left with nothing bought, every point kept as Reserve.
    if (s.phase === 'PREP') setOut(s, ev, { enter: false });
    mark(s, 'build');
    const p = s.player;
    // Level (rules 4.3): the character has just reached it.
    p.level = level;
    p.xp = 0;
    p.rested = 0;
    // Spells (rules 2.7): every spell the trainer teaches up to the level, learned in level order, all trained to it.
    const learn = trainerSpells(s).filter((id) => SPELL[id].lvl <= level && !p.spells[id]).sort((a, b) => SPELL[a].lvl - SPELL[b].lvl || (a < b ? -1 : 1));
    for (const id of learn) { p.spells[id] = { tl: level, rank: 1 }; p.spellOrder.push(id); }
    for (const id of Object.keys(p.spells)) if (SPELL[id].source !== 'talent') p.spells[id].tl = level;
    // Gear (rules 8.3): every slot, fixed stats, the generated name.
    for (const slot of SLOT_IDS) p.equipped[slot] = makeFixedGear(s, slot, rarity, ilvl, null);
    refreshDerived(s);
    // Talents (rules 6): the default build, one SPEND_TALENT at a time, or left unspent.
    if (talents === 'auto') {
      for (let t = talentPointsFree(s) > 0 ? nextTalent(s) : null; t; t = talentPointsFree(s) > 0 ? nextTalent(s) : null) act(s, ev, { type: 'SPEND_TALENT', talentId: t });
    }
    p.gold = o.gold ?? rnd(DEV.GOLD_V * V(level));
    addPotions(s, o.potions ?? DEV.POTIONS);
    // The zone (rules 1.3): its hub, arrived at `time` (whole tolls); the heat records start there.
    s.time = o.time ?? lineAt(s.oaths, zone - 1);
    s.stats.heat = newHeatStats();
    if (s.stats.exp) s.stats.exp.zones = [];
    s.stats.zonesLeft = zone - 1;
    if (zone === CAMP) enterCampNow(s, ev);
    else enterZone(s, ev, zone);
    setBars(s, ev);
    p.hp = p.d.maxHp;
    p.mana = p.d.maxMana;
    if (p.pet) { p.pet.alive = true; p.pet.hp = p.d.petMaxHp; }
    return { state: s, events: ev };
  }

  /** To the Camp (phase CAMP), leaving whatever is open; the run's time stays. At the Camp: what is open closes. */
  function toCamp(state) {
    const s = runCopy(state, 'debug.toCamp');
    const ev = [];
    mark(s, 'camp');
    leaveAll(s, ev);
    if (!s.zone.camp) enterCampNow(s, ev);
    return { state: s, events: ev };
  }

  /**
   * Into the end-boss fight (phase BOSS, round 1; from anywhere: the Camp first). phase 2: the boss at P2_AT of its HP,
   * phase 3: just below P3_AT, both reached by the engine's own phase change (rules 10.2: Shards, Eclipse); its intent
   * and track are shown for the new phase. Ascendancy from the run's time (rules 1.7).
   */
  function toBoss(state, { phase = 1 } = {}) {
    if (![1, 2, 3].includes(phase)) fail('debug.toBoss: phase must be 1, 2 or 3');
    const s = runCopy(state, 'debug.toBoss');
    const ev = [];
    mark(s, 'boss');
    leaveAll(s, ev);
    if (!s.zone.camp) enterCampNow(s, ev);
    fightBoss(s, ev);
    if (phase > 1) {
      const b = s.fight.enemies[0];
      b.hp = phase === 2 ? Math.floor(P2_AT * b.maxHp) : Math.ceil(P3_AT * b.maxHp) - 1;
      onBossDamaged(s, ev);
      b.intent = bossIntent(s, b);
      bossTrackView(s, b);
      ev.push({ t: 'intent', u: 0, intent: deepClone(b.intent) });
    }
    return { state: s, events: ev };
  }

  /**
   * On to the next zone's hub as by Travel on (a Road on the expedition map): TIME_TRAVEL, no level gate. Zone 6: the Camp.
   * A dev jump never pays the Swift passage XP (M2b v15, D124): the level stays as built.
   */
  function nextZone(state) {
    const s = runCopy(state, 'debug.nextZone');
    if (s.zone.camp) fail('debug.nextZone: the Camp is the last stop (debug.toBoss)');
    const ev = [];
    mark(s, 'nextZone');
    leaveAll(s, ev);
    if (isExpedition(s)) takeRoad(s, ev, { swift: false });
    else travelOn(s, ev);
    return { state: s, events: ev };
  }

  /**
   * A fight against enemy templates by id (any kind: normal, elite, rare, dungeon trash or boss) at `level` (the
   * player's), leaving whatever is open first. Each enemy is its template's kind; the fight kind is dboss, elite, trash or
   * grind by the strongest; no heat (rules 1.7.3). It is played in phase NODE as node type `dev` on the dev stream
   * (STREAM.dev(seed, n, 0), loot n, 1); won or fled, the player is back where it started (map, hub or Camp).
   */
  function encounter(state, { ids, level = null } = {}) {
    const list = Array.isArray(ids) ? ids.slice() : ids != null ? [ids] : [];
    const s = runCopy(state, 'debug.encounter');
    const c = s.content;
    if (!list.length) fail('debug.encounter: give one or more enemy ids');
    for (const id of list) if (!c.enemies[id]) fail(`debug.encounter: unknown enemy ${id}`);
    const L = level ?? s.player.level;
    if (!isInt(L) || L < 1 || L > MAX_LEVEL) fail(`debug.encounter: level must be 1-${MAX_LEVEL}`);
    const ev = [];
    const dev = mark(s, 'encounter');
    leaveAll(s, ev);
    const kinds = list.map((id) => c.enemies[id].kind);
    const kind = kinds.includes('dboss') ? 'dboss' : kinds.some((k) => k === 'elite' || k === 'rare') ? 'elite' : kinds.includes('trash') ? 'trash' : 'grind';
    const n = dev.n;
    dev.n += 1;
    const home = (enemies(c).find((x) => x.id === list[0]) || {}).zone || Math.min(s.zone.z, ZONE_COUNT);
    const from = s.zone.camp ? 'CAMP' : s.phase === 'ZONE_HUB' ? 'ZONE_HUB' : 'MAP';
    // id: the expedition node the player stands on (a death there is recorded at it, rules 9)
    s.node = { type: 'dev', ...(isExpedition(s) && !s.zone.camp ? { id: s.zone.pos } : {}), cl: L, stage: 'fight', k: 0, heat: null, from, enemies: list };
    s.lootRng = STREAM.dev(s.seed, n, 1);
    setPhase(s, ev, 'NODE');
    startFight(s, ev, {
      kind, k: 0, z: home, rng: STREAM.dev(s.seed, n, 0), enemies: list.map((tid) => ({ tid, level: L, variant: c.enemies[tid].kind })),
      addLevel: L, addPool: zoneAddPool(zoneContent(c, home)), dropMult: 1, canFlee: kind !== 'dboss', noStealth: kind === 'dboss', heat: null,
    });
    return { state: s, events: ev };
  }

  /**
   * Kill an enemy of the current fight (default: autoplay's default target) through the damage pipeline (rules 7.2:
   * its kill rewards, a boss's phase changes). The last one ends the fight as a victory would.
   */
  function killTarget(state, target = null) {
    const s = runCopy(state, 'debug.killTarget');
    const f = s.fight;
    if (!f) fail('debug.killTarget: not in a fight');
    const i = target ?? defaultTarget(s);
    const e = isInt(i) ? f.enemies[i] : null;
    if (!e || !e.alive) fail('debug.killTarget: the target must be a living enemy');
    const ev = [];
    mark(s, 'kill');
    applyDamage(s, ev, 'dev', i, e.hp + e.shield, { spell: 'dev_kill', school: 'magic' });
    if (f.over) finishFight(s, ev);
    else for (const x of f.enemies) if (x.alive) { if (x.kind === 'boss') bossTrackView(s, x); else refreshTrack(s, x); }
    if (isExpedition(s)) settleExpedition(s, ev); // as after every action (actions.js applyAction)
    return { state: s, events: ev };
  }

  /** Full HP and mana, the pet alive at full HP; in a fight also full energy and focus, no cooldowns, potions ready. */
  function refill(state) {
    const s = runCopy(state, 'debug.refill');
    mark(s, 'refill');
    const p = s.player;
    p.hp = p.d.maxHp;
    p.mana = p.d.maxMana;
    if (p.pet) { p.pet.alive = true; p.pet.hp = p.d.petMaxHp; }
    const f = s.fight;
    if (f) Object.assign(f.p, { energy: f.p.energyMax, focus: f.p.focusMax, potionReady: 0, cds: {} });
    return { state: s, events: [] };
  }

  /** God mode on or off (damage.js: the player takes no damage). A run that had it on is marked `god` in its summary. */
  function setGod(state, on = true) {
    if (typeof on !== 'boolean') fail('debug.setGod: on must be true or false');
    const s = runCopy(state, 'debug.setGod');
    if (!on && !(s.dev && s.dev.god)) return { state: s, events: [] };
    const dev = mark(s, 'god');
    dev.god = on;
    if (on) dev.godUsed = true;
    return { state: s, events: [] };
  }

  /**
   * Give gold (copper), potions (Healing Draughts while the bag takes them; a Mage as many Mana Draughts) and unspent
   * talent points (on top of the level's, rules 6). Returns { state, events, given: { gold, potions, talentPoints } }.
   */
  function give(state, { gold = 0, potions = 0, talentPoints = 0 } = {}) {
    for (const [k, v] of [['gold', gold], ['potions', potions], ['talentPoints', talentPoints]]) if (!isInt(v) || v < 0) fail(`debug.give: ${k} must be a whole number >= 0`);
    const s = runCopy(state, 'debug.give');
    const dev = mark(s, 'give');
    s.player.gold += gold;
    const k = addPotions(s, potions);
    dev.talentPoints += talentPoints;
    return { state: s, events: [], given: { gold, potions: k, talentPoints } };
  }

  /**
   * Set the run's time in whole tolls (rules 1.7: heat, the boss's Ascendancy). The zone's own clock stays: on the
   * expedition map its arrival toll moves with the run's, so the Dimming stands where it was; the zone's heat record
   * moves the same way.
   */
  function setTime(state, time) {
    if (!isInt(time) || time < 0) fail('debug.setTime: time must be a whole number >= 0');
    const s = runCopy(state, 'debug.setTime');
    mark(s, 'time');
    const d = time - s.time;
    s.time = time;
    if (isExpedition(s) && !s.zone.camp) s.zone.start += d;
    const recs = s.stats.heat ? s.stats.heat.zones : [];
    const last = recs[recs.length - 1];
    if (last && last.exit === null) last.entry += d;
    return { state: s, events: [] };
  }

  /** Set the time so the run's own heat is in `heatState` (HEAT_STATES; the middle of its band, rules 1.7.2): line + x. */
  function setHeat(state, heatState) {
    if (!HEAT_STATES.includes(heatState)) fail(`debug.setHeat: state must be one of ${HEAT_STATES.join(', ')}`);
    if (!state || !state.zone) fail('debug.setHeat: only during a run');
    const line = lineAt(state.oaths, state.zone.camp ? CAMP : state.zone.z);
    return setTime(state, Math.max(0, line + heatTarget(heatState)));
  }

  /**
   * Show the whole map: on the expedition map every node of the zone is seen (rules 1.9.5); on today's map, which hides
   * only rare elites, traps and vendor Embers, Scout's Eye is on for the rest of the run (rules 1.4).
   */
  function revealMap(state) {
    const s = runCopy(state, 'debug.revealMap');
    if (s.zone.camp) fail('debug.revealMap: the Camp has no map');
    mark(s, 'reveal');
    if (isExpedition(s)) s.zone.seen = s.zone.nodes.map(() => true);
    else s.meta.scout = true;
    return { state: s, events: [] };
  }

  /**
   * Play on with the other map (rules 1.4 rows or 1.9 expedition): the current zone is drawn again in that mode and
   * the player is at its hub (its heat record stays); at the Camp only the mode changes. The expedition starts with no
   * vision unlocks and the Dimming on.
   */
  function setMapMode(state, mode) {
    if (!MAP_MODES.includes(mode)) fail(`debug.setMapMode: mode must be one of ${MAP_MODES.join(', ')}`);
    const s = runCopy(state, 'debug.setMapMode');
    const ev = [];
    if ((s.mapMode || 'rows') === mode) return { state: s, events: ev };
    mark(s, 'mapMode');
    leaveAll(s, ev);
    s.mapMode = mode;
    if (mode === 'expedition') {
      s.create.vision = { guide: false, charts: false, pathfinder: false };
      s.create.dimming = true;
      startExpedition(s);
    } else {
      delete s.exp;
      delete s.stats.exp;
      delete s.create.vision;
      delete s.create.dimming;
    }
    if (!s.zone.camp) enterZone(s, ev, s.zone.z, { again: true });
    return { state: s, events: ev };
  }

  /** The profile with n more Echoes to spend (rules 11.2; not counted as earned). */
  function grantEchoes(profile, n) {
    if (!isInt(n) || n < 1) fail('debug.grantEchoes: n must be a whole number >= 1');
    const p = deepClone(profile || newProfile());
    p.echoes += n;
    return p;
  }

  /** The profile with every catalogue entry at its highest rank (rules 11.2; no Echoes spent). */
  function fullCatalogue(profile) {
    const p = deepClone(profile || newProfile());
    for (const m of Object.values(META)) p.unlocks[m.id] = m.ranks;
    return p;
  }

  /**
   * The state with another profile (the meta profile END_RUN updates; in CREATE also the one START_RUN reads). The run's
   * own modifiers (state.meta, rules 11.4) were fixed at START_RUN and do not change, so the run is not marked.
   */
  function setProfile(state, profile) {
    if (!state || state.phase === 'ENDED') fail('debug.setProfile: not after the run has ended');
    if (!profile || typeof profile !== 'object' || !profile.unlocks) fail('debug.setProfile: a profile is required');
    const s = cloneState(state);
    s.profile = deepClone(profile);
    return { state: s, events: [] };
  }

  /**
   * Check a state as the engine's guarantees have it (engine-api.md 1, 4, 6; qa/engine/health.test.mjs): version and
   * phase, plain JSON (serialize/deserialize round trip, no shared object), the character (level, XP, HP, mana, pet,
   * derived values current, talents and tier gates, spells, bars, gear, bag, item uids, gold), the zone and node for the
   * phase, the fight (enemy indices, HP, intents and tracks), the views (mapView, heatView, summary), and the actions:
   * legalActions not empty, autoAction legal, and with `steps` (default) every listed action steps without error.
   * Returns the problems found (empty = valid).
   */
  function validate(state, { steps = true } = {}) {
    const errs = [];
    const e = (m) => errs.push(m);
    const s = state;
    if (!s || typeof s !== 'object') return ['not a state'];
    if (s.v !== STATE_VERSION) e(`state version ${s.v}, engine ${STATE_VERSION}`);
    if (!PHASES.includes(s.phase)) e(`unknown phase ${s.phase}`);
    try {
      const str = serialize(s);
      if (serialize(deserialize(str, s.content)) !== str) e('serialize/deserialize does not round-trip');
    } catch (err) { e(`serialize: ${err.message}`); }
    const sh = sharedPath(s);
    if (sh) e(`object shared at ${sh}`);
    const guard = (what, fn) => { try { fn(); } catch (err) { e(`${what} throws: ${err.message}`); } };
    if (s.phase !== 'CREATE') {
      const p = s.player;
      if (!p) return [...errs, 'no player after START_RUN'];
      const cls = CLASS[p.classId];
      if (!cls) e(`unknown class ${p.classId}`);
      if (!isInt(p.level) || p.level < 1 || p.level > MAX_LEVEL) e(`level ${p.level}`);
      if (p.level < MAX_LEVEL ? !(p.xp >= 0 && p.xp < xpToNext(p.level)) : p.xp !== 0) e(`xp ${p.xp} at level ${p.level}`);
      const c = cloneState(s);
      guard('refreshDerived', () => { refreshDerived(c); if (JSON.stringify(c.player.d) !== JSON.stringify(p.d)) e('derived values (player.d) are not current'); });
      const over = s.phase === 'SUMMARY' || s.phase === 'ENDED';
      if (over ? !(p.hp >= 0 && p.hp <= p.d.maxHp) : !(isInt(p.hp) && p.hp >= 1 && p.hp <= p.d.maxHp)) e(`hp ${p.hp} of ${p.d.maxHp}`);
      if (!(p.mana >= 0 && p.mana <= p.d.maxMana)) e(`mana ${p.mana} of ${p.d.maxMana}`);
      if (p.pet && (p.pet.alive ? !(p.pet.hp >= 1 && p.pet.hp <= p.d.petMaxHp) : p.pet.hp !== 0)) e(`pet hp ${p.pet.hp} (alive ${p.pet.alive})`);
      if (p.pet && !p.pet.alive && !s.fight && !over) e('the pet is dead out of combat');
      if (!isInt(p.gold) || p.gold < 0) e(`gold ${p.gold}`);
      // talents (rules 6)
      let spent = 0;
      const tree = [0, 0, 0];
      for (const [id, r] of Object.entries(p.talents)) {
        const t = TALENT[id];
        if (!t || t.cls !== p.classId) { e(`talent ${id} is not a ${p.classId} talent`); continue; }
        if (!isInt(r) || r < 1 || r > t.ranks) e(`talent ${id} rank ${r}`);
        spent += r;
        tree[t.tree] += r;
      }
      for (const id of Object.keys(p.talents)) { const t = TALENT[id]; if (t && tree[t.tree] < TALENT_TIER_GATE * (t.tier - 1)) e(`talent ${id}: tier ${t.tier} without ${TALENT_TIER_GATE * (t.tier - 1)} points in its tree`); }
      if (spent !== p.talentSpent) e(`talentSpent ${p.talentSpent}, ranks sum to ${spent}`);
      if (talentPointsFree(s) < 0) e(`talent points free ${talentPointsFree(s)}`);
      // spells and bars (rules 2.7, 5, 6)
      const known = Object.keys(p.spells);
      const metaSpells = (s.meta && s.meta.spells) || [];
      for (const id of known) {
        const sp = SPELL[id];
        if (!sp || sp.cls !== p.classId) { e(`spell ${id} is not a ${p.classId} spell`); continue; }
        if (sp.source === 'talent' && !Object.keys(p.talents).some((t) => TALENT[t] && TALENT[t].spell === id)) e(`talent spell ${id} without its talent`);
        if (sp.source === 'meta' && !metaSpells.includes(id)) e(`meta spell ${id} without its unlock`);
        if (sp.source !== 'talent' && (sp.lvl > p.level || p.spells[id].tl > p.level)) e(`spell ${id} (level ${sp.lvl}, trained ${p.spells[id].tl}) at level ${p.level}`);
      }
      if (p.spellOrder.length !== known.length || !known.every((id) => p.spellOrder.includes(id))) e('spellOrder does not list the known spells');
      const barIds = p.bar.filter(Boolean);
      if (p.bar.length !== SPELL_BAR_SLOTS || barIds.some((id) => !p.spells[id]) || new Set(barIds).size !== barIds.length) e(`bar ${JSON.stringify(p.bar)}`);
      const items = p.itemBar.filter(Boolean);
      if (p.itemBar.length !== ITEM_BAR_SLOTS || items.some((id) => !CONSUMABLE[id] || !['any', 'combat'].includes(CONSUMABLE[id].use)) || new Set(items).size !== items.length) e(`item bar ${JSON.stringify(p.itemBar)}`);
      // gear, bag, uids (rules 8)
      const uids = [];
      for (const slot of SLOT_IDS) {
        const it = p.equipped[slot];
        if (it && (it.kind !== 'gear' || it.slot !== slot)) e(`equipped ${slot}: ${it.kind} for ${it.slot}`);
        if (it) uids.push(it.uid);
      }
      if (p.bag.length > bagCapacity(s)) e(`bag ${p.bag.length} of ${bagCapacity(s)} slots`);
      for (const it of p.bag) {
        uids.push(it.uid);
        if (it.kind === 'cons' && (!CONSUMABLE[it.id] || !(it.qty >= 1 && it.qty <= CONSUMABLE[it.id].stack))) e(`bag stack ${it.id} × ${it.qty}`);
        if (it.kind === 'junk' && !(it.qty >= 1 && it.qty <= STACK_JUNK)) e(`junk stack ${it.qty}`);
        if (!['gear', 'cons', 'junk'].includes(it.kind)) e(`bag item kind ${it.kind}`);
      }
      for (const it of s.loot || []) uids.push(it.uid);
      if (new Set(uids).size !== uids.length) e('an item uid is used twice');
      if (uids.some((u) => !/^i\d+$/.test(u) || Number(u.slice(1)) >= s.nextUid)) e('an item uid is not below nextUid');
      for (const [id, c0] of Object.entries(CONSUMABLE)) if (c0.max !== undefined && countConsumable(s, id) > c0.max) e(`${id} × ${countConsumable(s, id)} over its maximum`);
      // phase, zone, node, fight (rules 1.1)
      const z = s.zone;
      if (s.phase === 'PREP') {
        // The start camp (prep): no zone yet, the board and the budget in place.
        if (z) e('a zone at the start camp');
        if (!s.prep || s.prep.done) e('phase PREP without an open start camp');
      } else if (!over) {
        if (!z) e(`phase ${s.phase} without a zone`);
        else {
          if (['ZONE_HUB', 'MAP'].includes(s.phase) && z.camp) e(`phase ${s.phase} at the Camp`);
          if (['CAMP', 'BOSS'].includes(s.phase) && !z.camp) e(`phase ${s.phase} outside the Camp`);
          if (s.phase === 'NODE' && z.camp && !(s.node && s.node.type === 'dev')) e('phase NODE at the Camp');
          if (!z.camp && !(z.z >= 1 && z.z <= ZONE_COUNT)) e(`zone ${z.z}`);
        }
        if (s.phase === 'NODE' && !s.node) e('phase NODE without a node');
        if (s.node && s.phase !== 'NODE') e(`a node in phase ${s.phase}`);
        if (s.node && s.node.stage === 'fight' && !s.fight) e('a node in its fight stage without a fight');
        if (s.node && s.node.type === 'dev' && !['MAP', 'ZONE_HUB', 'CAMP'].includes(s.node.from)) e(`dev node from ${s.node.from}`);
        if (s.fight && !['NODE', 'CAMP', 'BOSS'].includes(s.phase)) e(`a fight in phase ${s.phase}`);
        if (s.phase === 'BOSS' && !(s.fight && s.fight.kind === 'boss')) e('phase BOSS without the boss fight');
        if (s.service && !['ZONE_HUB', 'CAMP', 'NODE'].includes(s.phase)) e(`a service in phase ${s.phase}`);
      }
      const f = s.fight;
      if (f) {
        if (f.over) e(`fight over (${f.over}) between steps`);
        if (!f.enemies.some((x) => x.alive)) e('a fight without a living enemy');
        f.enemies.forEach((x, i) => {
          if (x.idx !== i) e(`enemy ${i} has idx ${x.idx}`);
          if (x.alive ? !(x.hp >= 1 && x.hp <= x.maxHp) : x.hp < 0) e(`enemy ${i} hp ${x.hp} of ${x.maxHp} (alive ${x.alive})`);
          if (x.alive && x.turn0 <= f.round && !x.intent) e(`enemy ${i} has no intent`);
          if (x.alive && (!Array.isArray(x.track) || x.track.length !== INTENT_TRACK_LEN)) e(`enemy ${i} track of ${x.track ? x.track.length : 0}`);
        });
      }
      if (s.dev && (!Array.isArray(s.dev.tools) || typeof s.dev.god !== 'boolean' || !isInt(s.dev.n) || !isInt(s.dev.talentPoints))) e('state.dev is malformed');
      if (!over) {
        guard('mapView', () => mapView(s));
        guard('heatView', () => heatView(s));
      }
      guard('summary', () => summary(s));
    }
    if (s.phase !== 'ENDED') {
      let list = [];
      guard('legalActions', () => { list = legalActions(s); });
      if (!list.length) e(`no legal action in ${s.phase}`);
      guard('autoAction', () => { const a = autoAction(s); const why = a ? checkAction(s, a) : 'none'; if (why) e(`autoAction ${JSON.stringify(a)} is not legal: ${why}`); });
      if (steps) for (const a of list) guard(`step ${JSON.stringify(a)}`, () => step(s, a));
    }
    return errs;
  }

  return Object.freeze({
    build, toCamp, toBoss, nextZone, encounter, killTarget, refill, setGod, give, setTime, setHeat, revealMap, setMapMode,
    grantEchoes, fullCatalogue, setProfile, enemies, validate,
  });
}
