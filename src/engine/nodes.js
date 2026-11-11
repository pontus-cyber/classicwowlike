// Run flow outside combat (rules 1, 2, 9): run start, zones and hubs, map moves, node types, rewards,
// loot window, vendor and trainer services, camp, boss start, fight outcomes and run end. Expedition map (rules 1.9):
// MOVE, PASS_THROUGH, hub revisits, Dimmed encounters, Roads, the Homeward Bell and the settle step after an action.
// Heat (rules 1.7.3, 1.7.4): a node's heat state is fixed on entry (state.node.heat, the fight's `heat`), and the
// summary's heat counters follow hours, zones, nodes and fights won (heat.js).
// Dev tools (engine-api.md 12): a fight a dev tool starts (node type `dev`) ends back where it was started.
import {
  CLASS, PET, SPELL, META, SLOT_IDS, START_GOLD, START_RATIONS, SPELL_BAR_SLOTS, ITEM_BAR_SLOTS, ZONE_COUNT,
  ZONE_LEVELS, ZONE_CHOICE_ROWS, HOURS_REST, HOURS_VENDOR, HOURS_TRAINER, HOURS_TRAVEL, QUEST_TURNIN_XP_FRAC, QUEST_GOLD_V,
  QUEST_REWARD_CHOICES, STORY_QUESTS, STORY_XP_FRAC, STORY_REWARD_CHOICES, GRIND_WAVE_XP_FRAC, GRIND_DROP_MULT,
  GRIND_WAVE_SIZE, DUNGEON_CLEAR_XP_FRAC, DUNGEON_GOLD_V, TREASURE_GOLD_V,
  TREASURE_TRAP_CHANCE, TREASURE_TRAP_PCT, REST_RESTED_FRAC, BOON, BOON_GOLD_V, BOON_NODES, CAMP_GRIND_LEVEL,
  MAX_LEVEL, TRAIN_NEW_V, TRAIN_RANK_V, TRAVEL_EARLY_LEVELS,
  RESPEC_V, CONSUMABLE, ELIXIR_NODES, RES_META_CHARGES, BOSS_LEVEL, UNIQUE_POTION_PCT, HOURS_WALK, DIM_PACK_SIZE,
  DIM_LEVEL_PER_DEPTH, HOURS_DIM_FIGHT, BELL_START_CHARGES, BELL_MAX_CHARGES, BELL_CHANNEL_H,
} from '../constants.js';
import { STREAM, nextFloat, nextInt } from '../rng.js';
import { rnd, frac6, deepClone } from './util.js';
import { refreshDerived, hasEffect } from './stats.js';
import { eventXp, gainXp, gainGold, addRested, spendGold, addGoldRaw } from './progress.js';
import {
  V, rollDrop, makeFixedGear, makeConsumable, addToBag, bagIndex, sellValue, takeConsumable,
} from './items.js';
import { generateZone, contentLevel, vendorStock, composeEncounter, pickFrom } from './map.js';
import { zoneContent, campEnemies, CAMP_Z } from './content.js';
import { startFight, endFight } from './combat.js';
import { parHours } from './meta.js';
import { makeBoss } from './boss.js';
import { ascOver, newHeatStats, heatHours, heatZoneEntered, heatNodeEntered, heatFightWon } from './heat.js';
import {
  isExpedition, grindMaxWaves, xpWeight, nodeHours, generateExpZone, refreshVision, zoneHours, frontAt, dimmedNow,
  visionKit, canEnter, roadNameOf,
} from './expedition.js';

// ---------------- Meta at run start (rules 11.4) ----------------
/**
 * Run modifiers from the profile's unlocks. A rank above the catalogue's ranks (a profile saved under an older
 * catalogue, e.g. Keen 3 or Ancestral Insight 2 before M2 v3, Vigor 5 before M2 v4) counts as the maximum rank, so a
 * profile never exceeds the meta power budget (rules 11.2, D32). An owned id that is not in the catalogue (Wayfinder,
 * removed in M2 v4; Starforged Arms, removed in M2 v5) is ignored: no effect and no refund; the profile keeps it
 * stored (D42, D45).
 */
export function metaFromProfile(profile, classId) {
  const u = (profile && profile.unlocks) || {};
  const r = (id) => Math.min(u[id] || 0, META[id].ranks);
  return {
    hpPct: r('vigor') * META.vigor.hpPct,
    powerPct: r('edge') * META.edge.powerPct,
    crit: r('keen') * META.keen.crit,
    xpPct: r('quick_study') * META.quick_study.xpPct,
    goldPct: r('prospector') * META.prospector.goldPct,
    bagSlots: r('pockets') * META.pockets.slots,
    satchel: r('satchel') > 0,
    heirloom: r('heirloom_blade') > 0,
    ledger: r('ledger') > 0,
    scout: r('scout') > 0,
    swiftBoots: r('swift_boots') > 0,
    alchemist: r('alchemist') > 0,
    cache: r('cache') > 0,
    relics: r('relics') > 0,
    spells: Object.values(META).filter((m) => m.spell && r(m.id) > 0 && SPELL[m.spell].cls === classId).map((m) => m.spell),
    stormhawk: r('stormhawk') > 0,
    talentPoints: r('talent_pt') * META.talent_pt.points,
    resCharges: r('second_breath') > 0 ? RES_META_CHARGES : 0,
    oaths: r('oaths') > 0,
  };
}

export function newStats() {
  return {
    nodes: { quest: 0, grind: 0, elite: 0, dungeon: 0, rest: 0, vendor: 0, trainer: 0, treasure: 0, shrine: 0 },
    nodesTotal: 0, fights: 0, engages: 0, rounds: 0, bossRounds: 0, kills: { normal: 0, elite: 0, rare: 0, boss: 0 },
    quests: 0, stories: 0, dungeons: 0, goldEarned: 0, goldSpent: 0, potionsUsed: 0, resUsed: 0, dmgDealt: 0,
    dmgTaken: 0, spellDmg: {}, zonesLeft: 0, levelUps: 0, talentPoints: 0, equipDrops: 0, rests: 0, shrines: 0,
    treasures: 0, vendorVisits: 0, vendorTx: 0, trainerVisits: 0, trainerTx: 0, xpGained: 0, campWaves: 0,
    reachedBoss: false, bossPhase: 0, bossHpPct: null, hoursAtBoss: null, asc: null, maxZone: 1, maxRow: 0,
    heat: newHeatStats(),
  };
}

/** Pets the profile can pick (rules 5.5; Stormhawk is a meta unlock). */
export function availablePets(profile) {
  const u = (profile && profile.unlocks) || {};
  return Object.values(PET).filter((p) => !p.meta || (u[p.meta] || 0) > 0).map((p) => p.id);
}

// ---------------- Run start (rules 1.2) ----------------
export function startRun(s, ev) {
  const c = s.create;
  const cls = CLASS[c.classId];
  s.seed = c.seed;
  s.meta = metaFromProfile(s.profile, c.classId);
  s.oaths = c.oaths.slice();
  s.nextUid = 1;
  s.hours = 0;
  s.player = {
    name: c.name || cls.name, classId: c.classId, level: 1, xp: 0, rested: 0, hp: 0, mana: 0, gold: START_GOLD,
    spells: {}, spellOrder: [], bar: new Array(SPELL_BAR_SLOTS).fill(null), itemBar: new Array(ITEM_BAR_SLOTS).fill(null),
    talents: {}, talentSpent: 0, equipped: {}, bag: [], buffs: {}, res: { boon: 0, meta: s.meta.resCharges },
    pet: c.classId === 'hunter' ? { id: c.petId, hp: 0, alive: true } : null, uniquesFound: [], freeRespec: false, d: null,
  };
  const p = s.player;
  for (const slot of SLOT_IDS) p.equipped[slot] = null;
  cls.startSpells.forEach((id, i) => { p.spells[id] = { tl: 1, rank: 1 }; p.spellOrder.push(id); p.bar[i] = id; });
  const txt = s.content.classes[c.classId];
  p.equipped.weapon = s.meta.heirloom
    ? makeFixedGear(s, 'weapon', META.heirloom_blade.rarity, META.heirloom_blade.ilvl, txt.heirloomWeapon)
    : makeFixedGear(s, 'weapon', 'common', 1, txt.startWeapon);
  p.equipped.chest = makeFixedGear(s, 'chest', 'common', 1, txt.startChest);
  s.stats = newStats();
  refreshDerived(s);
  addToBag(s, makeConsumable(s, 'trail_rations', START_RATIONS));
  if (s.meta.satchel) addToBag(s, makeConsumable(s, 'healing_draught', META.satchel.potions));
  p.hp = p.d.maxHp;
  p.mana = p.d.maxMana;
  if (p.pet) p.pet.hp = p.d.petMaxHp;
  s.loot = [];
  s.node = null;
  s.fight = null;
  s.service = null;
  s.lootRng = null;
  s.death = null;
  s.outcome = null;
  s.result = null;
  if (isExpedition(s)) startExpedition(s);
  ev.push({ t: 'runStart', classId: c.classId, petId: c.petId, seed: s.seed, oaths: s.oaths });
  enterZone(s, ev, 1);
}

/**
 * Expedition map (rules 1.9) at run start (also debug.setMapMode, engine-api.md 12): the vision kit and the Dimming option
 * of state.create, Homeward Bell charges, the settle flags (pending: hours were spent since the last Dimming check;
 * bellPending: the Bell is ringing), and the per-run and per-zone counters.
 */
export function startExpedition(s) {
  const c = s.create;
  s.exp = { vision: visionKit(c.vision), bell: Math.min(BELL_MAX_CHARGES, BELL_START_CHARGES), pending: false, bellPending: false, dimming: c.dimming !== false };
  s.stats.exp = { walks: 0, passes: 0, dimFights: 0, bells: 0, bellExits: 0, roads: 0, maxRing: 0, zones: [] };
}

// ---------------- Zones, hub, camp ----------------
export function addHours(s, ev, h, why) {
  if (h <= 0) return;
  heatHours(s, h, why); // rules 1.7.4: each hour counted in the heat state it starts in
  s.hours += h;
  ev.push({ t: 'hours', add: h, total: s.hours, why });
  if (s.exp && s.zone && !s.zone.camp) dimmingAfterHours(s, ev, h, why);
}

/**
 * Expedition (rules 1.9.6): hours in a zone move the Dimming. A `dimming` event lists the nodes the front newly covers.
 * Hours other than a Dimmed encounter's own mark the step for the settle check (settleExpedition).
 */
function dimmingAfterHours(s, ev, h, why) {
  if (why === 'travel') return; // on the Road: the zone is left
  const zone = s.zone;
  const hz = zoneHours(s);
  if (why !== 'dim') s.exp.pending = true;
  if (zone.dimOff) return; // a run without the Dimming (newRun option dimming: false, D50)
  const before = frontAt(hz - h);
  const now = frontAt(hz);
  if (now > before) {
    const dimmed = zone.nodes.filter((n) => zone.shardDist[n.id] > before && zone.shardDist[n.id] <= now).map((n) => n.id);
    ev.push({ t: 'dimming', front: now, dimmed });
  }
}

function setPhase(s, ev, phase) {
  if (s.phase !== phase) ev.push({ t: 'phase', phase });
  s.phase = phase;
}

/**
 * Enter zone z's hub (the Camp after zone ZONE_COUNT). again: a dev tool draws the same zone again (debug.setMapMode,
 * engine-api.md 12): the zone's heat record stays as it is.
 */
export function enterZone(s, ev, z, { again = false } = {}) {
  if (z > ZONE_COUNT) { enterCamp(s, ev); return; }
  if (isExpedition(s)) {
    // Expedition map (rules 1.9): the zone graph; the player starts on the hub, its neighbours in view.
    s.zone = generateExpZone(s, z);
    s.exp.pending = false;
    s.exp.bellPending = false;
    refreshVision(s);
    s.stats.exp.zones.push({ z, hours: 0, nodes: 0, walks: 0, passes: 0, dimFights: 0, exit: null });
  } else {
    s.zone = generateZone(s, z);
  }
  s.hub = { used: { trainer: false, vendor: false, inn: false }, ledgerFree: s.meta.ledger };
  s.service = null;
  s.stats.maxZone = Math.max(s.stats.maxZone, z);
  if (!again) heatZoneEntered(s); // rules 1.7.1: the line moves one share ahead
  ev.push({ t: 'zone', z, name: zoneContent(s.content, z).name });
  setPhase(s, ev, 'ZONE_HUB');
}

function enterCamp(s, ev) {
  s.zone = { z: CAMP_Z, camp: true };
  heatZoneEntered(s); // rules 1.7.1: at the Camp the line is the par
  s.hub = { used: { trainer: false, vendor: false, inn: false }, ledgerFree: s.meta.ledger };
  s.camp = { waves: 0 };
  s.service = null;
  ev.push({ t: 'camp', name: s.content.camp.name });
  setPhase(s, ev, 'CAMP');
}

export const exitLevel = (z) => ZONE_LEVELS * z;

/** Level from which TRAVEL_ON is legal in zone z (rules 1.5, M2 v2): exit level - TRAVEL_EARLY_LEVELS, Swift Boots one lower. */
export function travelLevel(s, z = s.zone.z) {
  return exitLevel(z) - TRAVEL_EARLY_LEVELS - (s.meta.swiftBoots ? META.swift_boots.levels : 0);
}

/** TRAVEL_ON allowed (rules 1.5): at travelLevel or after the last row (then forced). */
export function canTravel(s) {
  if (s.phase !== 'MAP' || s.node || !s.zone || s.zone.camp) return false;
  return s.player.level >= travelLevel(s) || s.zone.pos.r >= ZONE_CHOICE_ROWS;
}

export function travelOn(s, ev) {
  addHours(s, ev, HOURS_TRAVEL, 'travel'); // every profile (M2 v4: Wayfinder removed)
  s.stats.zonesLeft += 1;
  ev.push({ t: 'travel', from: s.zone.z });
  enterZone(s, ev, s.zone.z + 1);
}

/** Rest effect (rules 2.5): full HP, mana and pet HP, dead pet revived, rested pool. */
export function restEffect(s, ev) {
  const p = s.player;
  p.hp = p.d.maxHp;
  p.mana = p.d.maxMana;
  if (p.pet) { p.pet.alive = true; p.pet.hp = p.d.petMaxHp; }
  addRested(s, REST_RESTED_FRAC);
  s.stats.rests += 1;
  ev.push({ t: 'rest', hp: p.hp, mana: p.mana, rested: p.rested });
}

export function openService(s, ev, kind) {
  const camp = s.phase === 'CAMP';
  s.hub.used[kind] = true;
  if (kind === 'inn') {
    addHours(s, ev, HOURS_REST, 'inn');
    restEffect(s, ev);
    return;
  }
  if (kind === 'trainer') {
    addHours(s, ev, HOURS_TRAINER, 'trainer');
    s.service = { kind: 'trainer', where: camp ? 'camp' : 'hub' };
    s.stats.trainerVisits += 1;
  } else {
    addHours(s, ev, HOURS_VENDOR, 'vendor');
    const z = camp ? CAMP_Z : s.zone.z;
    const cl = camp ? MAX_LEVEL : contentLevel(z, 0);
    let stock;
    if (!camp && isExpedition(s)) {
      // Expedition (rules 1.9.2): the hub vendor's stock is drawn once per zone (nodeId(z, 0)) and keeps what was sold.
      if (!s.zone.hubStock) s.zone.hubStock = vendorStock(s, STREAM.nodeId(s.seed, z, 0), cl);
      stock = deepClone(s.zone.hubStock);
    } else stock = vendorStock(s, STREAM.node(s.seed, z, 0, 0), cl);
    s.service = { kind: 'vendor', where: camp ? 'camp' : 'hub', cl, stock };
    s.stats.vendorVisits += 1;
  }
  ev.push({ t: 'service', service: kind, where: s.service.where });
}

export function leaveService(s, ev) {
  const where = s.service.where;
  if (where === 'hub' && s.service.kind === 'vendor' && s.zone && s.zone.hubStock) s.zone.hubStock = s.service.stock;
  s.service = null;
  ev.push({ t: 'serviceClosed' });
  if (where === 'node') completeNode(s, ev);
}

// ---------------- Timed buffs (boons, elixir) ----------------
/** Called when a node is entered (map node, camp wave, boss): BOON_NODES / ELIXIR_NODES count entered nodes. */
function advanceBuffs(s, ev) {
  const b = s.player.buffs;
  for (const k of Object.keys(b)) {
    if (b[k].left > 0) { b[k].active = true; b[k].left -= 1; }
    else { delete b[k]; ev.push({ t: 'buffEnd', id: k }); }
  }
}

// ---------------- Map and nodes ----------------
/** Fight stream of the current node: fight(z,r,l,k), or fightId(z,id,k) on the expedition map (rules 1.9.2). */
function fightRng(s, k) {
  const n = s.node;
  return n.id !== undefined ? STREAM.fightId(s.seed, s.zone.z, n.id, k) : STREAM.fight(s.seed, s.zone.z, n.r, n.l, k);
}

/** The map definition of the current node. */
function nodeDef(s) {
  const n = s.node;
  return n.id !== undefined ? s.zone.nodes[n.id] : s.zone.rows[n.r - 1][n.l];
}

/** Add pool of a zone's fights (rules 7.12, combat v2): summons and Signal reinforcements; zone `addPool` or normals. */
export const zoneAddPool = (zn) => (Array.isArray(zn.addPool) && zn.addPool.length ? zn.addPool : zn.normals);

function nodeFight(s, ev, kind, k, enemies, extra = {}) {
  const n = s.node;
  const zn = zoneContent(s.content, s.zone.z);
  startFight(s, ev, {
    kind, k, z: s.zone.z, rng: fightRng(s, k), enemies, addLevel: extra.addLevel || n.cl, addPool: zoneAddPool(zn),
    dropMult: extra.dropMult || 1, canFlee: kind !== 'dboss', noStealth: kind === 'dboss', heat: n.heat || null,
  });
}

/** CHOOSE_NODE (rules 1.4): enter lane `lane` of the next row. */
export function chooseNode(s, ev, lane) {
  const zone = s.zone;
  const r = zone.pos.r + 1;
  const def = zone.rows[r - 1][lane];
  zone.pos = { r, l: lane };
  zone.path.push(lane);
  s.stats.maxRow = Math.max(s.stats.maxRow, r);
  beginNode(s, ev, def, r, lane);
}

/**
 * Enter a node and start its content (rules 2): on today's map at (r, l), on the expedition map at node id def.id
 * (r undefined). Hours by type (nodeHours: rules 2.0, 1.9.8). Heat (rules 1.7.3): the node's heat state is fixed first,
 * before its hours (on the expedition map with the Dimming's clock of this node), and pays everything the node pays.
 */
function beginNode(s, ev, def, r, lane) {
  const zone = s.zone;
  const exp = r === undefined;
  const heat = heatNodeEntered(s);
  advanceBuffs(s, ev);
  s.stats.nodes[def.type] += 1;
  s.stats.nodesTotal += 1;
  if (exp) zoneRecord(s).nodes += 1;
  s.lootRng = exp ? STREAM.lootId(s.seed, zone.z, def.id) : STREAM.loot(s.seed, zone.z, r, lane);
  s.node = exp ? { type: def.type, id: def.id, cl: def.cl, stage: 'fight', k: 0, heat } : { type: def.type, r, l: lane, cl: def.cl, stage: 'fight', k: 0, heat };
  const n = s.node;
  setPhase(s, ev, 'NODE');
  ev.push(exp ? { t: 'node', type: def.type, id: def.id, ring: def.ring, cl: def.cl, heat } : { t: 'node', type: def.type, r, l: lane, cl: def.cl, heat });
  switch (def.type) {
    case 'quest':
      addHours(s, ev, nodeHours(s, 'quest'), 'quest');
      n.quest = def.quest;
      ev.push({ t: 'quest', quest: def.quest });
      nodeFight(s, ev, 'quest', 0, def.mobs.map((tid) => ({ tid, level: def.cl, variant: 'normal' })));
      break;
    case 'grind':
      n.stage = 'grindSetup';
      n.planned = 0;
      n.wavesDone = 0;
      // A Grind that allows one wave starts it on entry (rules 1.9.8: no choice to make).
      if (grindMaxWaves(s) === 1) startGrind(s, ev, 1);
      break;
    case 'elite': {
      addHours(s, ev, nodeHours(s, 'elite'), 'elite');
      const en = [{ tid: def.elite, level: def.eliteLevel, variant: def.rare ? 'rare' : 'elite' }];
      if (def.add) en.push({ tid: def.add, level: def.cl, variant: 'normal' });
      nodeFight(s, ev, 'elite', 0, en);
      break;
    }
    case 'dungeon':
      addHours(s, ev, nodeHours(s, 'dungeon'), 'dungeon');
      n.bossLevel = def.bossLevel;
      startDungeonFight(s, ev, 0);
      break;
    case 'rest':
      addHours(s, ev, nodeHours(s, 'rest'), 'rest');
      restEffect(s, ev);
      completeNode(s, ev);
      break;
    case 'vendor':
      addHours(s, ev, nodeHours(s, 'vendor'), 'vendor');
      n.stage = 'service';
      s.service = { kind: 'vendor', where: 'node', cl: def.cl, stock: deepClone(def.stock) };
      s.stats.vendorVisits += 1;
      ev.push({ t: 'service', service: 'vendor', where: 'node' });
      break;
    case 'trainer':
      addHours(s, ev, nodeHours(s, 'trainer'), 'trainer');
      n.stage = 'service';
      s.service = { kind: 'trainer', where: 'node' };
      s.stats.trainerVisits += 1;
      ev.push({ t: 'service', service: 'trainer', where: 'node' });
      break;
    case 'treasure':
      addHours(s, ev, nodeHours(s, 'treasure'), 'treasure');
      s.stats.treasures += 1;
      n.trap = nextFloat(s.lootRng) < TREASURE_TRAP_CHANCE; // first draw of loot(z,r,l) / loot(z,id)
      if (def.guard) nodeFight(s, ev, 'treasure', 0, [{ tid: def.guard, level: def.cl, variant: 'normal' }]);
      else { openChest(s, ev); completeNode(s, ev); }
      break;
    case 'shrine':
      addHours(s, ev, nodeHours(s, 'shrine'), 'shrine');
      s.stats.shrines += 1;
      n.stage = 'reward';
      n.rewards = [{ kind: 'boons', boons: def.boons.slice() }];
      break;
    default:
      throw new Error(`unknown node type ${def.type}`);
  }
}

function startDungeonFight(s, ev, k) {
  const n = s.node;
  const def = nodeDef(s);
  n.k = k;
  n.stage = 'fight';
  // def.trash.length = DUNGEON_TRASH_FIGHTS (rules 2.4), EXPED_DUNGEON_TRASH_FIGHTS on the expedition map (1.9.8).
  if (k < def.trash.length) nodeFight(s, ev, 'trash', k, def.trash[k].map((tid) => ({ tid, level: def.trashLevel, variant: 'trash' })), { addLevel: def.trashLevel });
  else nodeFight(s, ev, 'dboss', k, [{ tid: def.boss, level: def.bossLevel, variant: 'dboss' }], { addLevel: def.trashLevel });
}

export function startGrind(s, ev, waves) {
  const n = s.node;
  n.planned = waves;
  startGrindWave(s, ev);
}

function startGrindWave(s, ev) {
  const n = s.node;
  const def = nodeDef(s);
  addHours(s, ev, nodeHours(s, 'grind'), 'grind');
  n.k = n.wavesDone;
  n.stage = 'fight';
  nodeFight(s, ev, 'grind', n.k, def.waves[n.k].map((tid) => ({ tid, level: def.cl, variant: 'normal' })), { dropMult: GRIND_DROP_MULT });
}

export function nextFight(s, ev) {
  const n = s.node;
  if (n.type === 'grind') startGrindWave(s, ev);
  else startDungeonFight(s, ev, n.k + 1);
}

export function completeNode(s, ev) {
  const n = s.node;
  if (n) {
    if (n.id !== undefined) {
      s.zone.nodes[n.id].done = true;
      ev.push({ t: 'nodeDone', type: n.type, id: n.id });
    } else {
      s.zone.rows[n.r - 1][n.l].done = true;
      ev.push({ t: 'nodeDone', type: n.type, r: n.r, l: n.l });
    }
  }
  s.node = null;
  s.lootRng = null;
  s.service = null;
  setPhase(s, ev, 'MAP');
}

// ---------------- Expedition map (rules 1.9) ----------------
/** The per-zone counters of the current expedition zone (summary `expedition.zones`). */
const zoneRecord = (s) => s.stats.exp.zones[s.stats.exp.zones.length - 1];

/** Can MOVE enter node id's content (rules 1.9.4)? Defined in expedition.js (heat.js previews use it too). */
export { canEnter };

function stepTo(s, ev, id, via) {
  const zone = s.zone;
  const from = zone.pos;
  zone.pos = id;
  zone.path.push(id);
  s.stats.exp.maxRing = Math.max(s.stats.exp.maxRing, zone.nodes[id].ring);
  ev.push({ t: 'move', from, to: id, via, seen: refreshVision(s) });
}

/**
 * MOVE (rules 1.9.4): to an adjacent node. Unresolved, not the hub and not Dimmed: enter it (its content and hours).
 * Otherwise a walk of HOURS_WALK; walking onto the hub when it is not Dimmed starts a new hub visit (services again).
 */
export function moveTo(s, ev, id) {
  if (canEnter(s, id)) {
    stepTo(s, ev, id, 'enter');
    beginNode(s, ev, s.zone.nodes[id]);
    return;
  }
  stepTo(s, ev, id, 'walk');
  s.stats.exp.walks += 1;
  zoneRecord(s).walks += 1;
  addHours(s, ev, HOURS_WALK, 'walk');
  if (s.zone.nodes[id].ring === 0 && !dimmedNow(s, id)) {
    s.hub.used = { trainer: false, vendor: false, inn: false };
    setPhase(s, ev, 'ZONE_HUB');
  }
}

/** PASS_THROUGH (rules 1.9.4): walk through an adjacent unresolved node for HOURS_WALK; it stays unresolved. */
export function passThrough(s, ev, id) {
  stepTo(s, ev, id, 'pass');
  s.stats.exp.passes += 1;
  zoneRecord(s).passes += 1;
  addHours(s, ev, HOURS_WALK, 'pass');
}

/**
 * Dimmed encounter (rules 1.9.6) at node id: DIM_PACK_SIZE of the zone's normal templates (stream dim(z, id, n), n =
 * Dimmed encounters at this node so far; composition repair 7.14), variant shardspawn, level min(MAX_LEVEL, max(CL, L)
 * + DIM_LEVEL_PER_DEPTH × depth), depth = front - hops from the Shardfall. HOURS_DIM_FIGHT; fought in phase NODE as
 * node type `dim`; the node is not resolved by it.
 */
export function startDimEncounter(s, ev, id) {
  const zone = s.zone;
  const z = zone.z;
  const def = zone.nodes[id];
  const depth = frontAt(zoneHours(s)) - zone.shardDist[id];
  const level = Math.min(MAX_LEVEL, Math.max(def.cl, s.player.level) + DIM_LEVEL_PER_DEPTH * depth);
  const k = zone.dimN[id];
  zone.dimN[id] = k + 1;
  const zn = zoneContent(s.content, z);
  const rng = STREAM.dim(s.seed, z, id, k);
  let tids = [];
  for (let i = 0; i < DIM_PACK_SIZE; i++) tids.push(pickFrom(rng, zn.normals));
  tids = composeEncounter(s.content, rng, tids, zn.normals);
  s.stats.exp.dimFights += 1;
  zoneRecord(s).dimFights += 1;
  s.lootRng = null;
  s.node = { type: 'dim', id, cl: level, stage: 'fight', k, depth };
  setPhase(s, ev, 'NODE');
  ev.push({ t: 'dim', id, depth, level, k });
  addHours(s, ev, HOURS_DIM_FIGHT, 'dim');
  startFight(s, ev, {
    kind: 'dim', k, z, rng, enemies: tids.map((tid) => ({ tid, level, variant: 'shardspawn' })), addLevel: level,
    addPool: zoneAddPool(zn), canFlee: true,
  });
}

/** After a Dimmed encounter won or fled ("passing through"): back on the map, on the same node. */
function endDimEncounter(s, ev) {
  s.node = null;
  s.lootRng = null;
  s.service = null;
  setPhase(s, ev, 'MAP');
}

/**
 * After a fight a dev tool started (node type `dev`, debug.encounter, engine-api.md 12), won or fled: back where it was
 * started (`node.from`: the map, the hub or the Camp); no map node is resolved by it.
 */
export function endDevEncounter(s, ev) {
  const from = s.node.from;
  s.node = null;
  s.lootRng = null;
  s.service = null;
  setPhase(s, ev, from);
}

/**
 * Leave the zone (Road or Bell, rules 1.9.7): record its hours, count it, enter the next zone (zone 6: the Camp). The
 * travel event names the Road taken (content zones[i].roads, D51; null by the Bell or without names).
 */
function leaveZone(s, ev, by) {
  const from = s.zone.z;
  const node = s.zone.pos;
  s.stats.zonesLeft += 1;
  ev.push({ t: 'travel', from, by, node, road: by === 'road' ? roadNameOf(s, node) : null });
  enterZone(s, ev, from + 1);
}

/** TAKE_ROAD (rules 1.9.7): on a Road node, HOURS_TRAVEL, then the next zone's hub. */
export function takeRoad(s, ev) {
  const rec = zoneRecord(s);
  rec.hours = zoneHours(s);
  rec.exit = 'road';
  s.stats.exp.roads += 1;
  addHours(s, ev, HOURS_TRAVEL, 'travel');
  leaveZone(s, ev, 'road');
}

/**
 * RING_BELL (rules 1.9.7): one charge, BELL_CHANNEL_H hours. The settle step then runs a Dimmed encounter first if the
 * player's node is Dimmed, and completes the Bell (completeBell): the next zone's hub, no HOURS_TRAVEL.
 */
export function ringBell(s, ev) {
  s.exp.bell -= 1;
  s.exp.bellPending = true;
  s.stats.exp.bells += 1;
  ev.push({ t: 'bell', charges: s.exp.bell, node: s.zone.pos });
  addHours(s, ev, BELL_CHANNEL_H, 'bell');
}

function completeBell(s, ev) {
  s.exp.bellPending = false;
  const rec = zoneRecord(s);
  rec.hours = zoneHours(s);
  rec.exit = 'bell';
  s.stats.exp.bellExits += 1;
  leaveZone(s, ev, 'bell');
}

/**
 * Settle step of an expedition run (rules 1.9.6, 1.9.7), after every action: when the player is back on the map or in
 * the hub with nothing open (no node, fight, service or loot window) and hours were spent since the last check, a
 * Dimmed encounter starts if the player's node is Dimmed (once per such action; its own hours do not count). Then a
 * ringing Bell completes.
 */
export function settleExpedition(s, ev) {
  const x = s.exp;
  if (!x || !s.zone || s.zone.camp || (s.phase !== 'MAP' && s.phase !== 'ZONE_HUB')) return;
  if (s.node || s.fight || s.service || (s.loot && s.loot.length)) return;
  if (x.pending) {
    x.pending = false;
    if (dimmedNow(s)) {
      startDimEncounter(s, ev, s.zone.pos);
      return;
    }
  }
  if (x.bellPending) completeBell(s, ev);
}


function openChest(s, ev) {
  const n = s.node;
  const p = s.player;
  gainGold(s, ev, TREASURE_GOLD_V * V(n.cl), 'treasure');
  if (n.trap) {
    const loss = Math.min(p.hp - 1, rnd(TREASURE_TRAP_PCT * p.d.maxHp));
    p.hp -= Math.max(0, loss);
    ev.push({ t: 'trap', amount: Math.max(0, loss) });
  }
  receiveItems(s, ev, rollDrop(s, s.lootRng, 'treasure', n.cl, s.zone.z));
}

// ---------------- Items received ----------------
/** Items into the bag; what does not fit goes to the loot window (rules 8.7). */
export function receiveItems(s, ev, items) {
  for (const it of items) {
    if (it.kind === 'gear') s.stats.equipDrops += 1;
    if (addToBag(s, it)) ev.push({ t: 'loot', item: deepClone(it), to: 'bag' });
    else { s.loot.push(it); ev.push({ t: 'loot', item: deepClone(it), to: 'window' }); }
  }
}

// ---------------- Fight outcomes ----------------
/** Called after the fight's round resolution when s.fight.over is set. */
export function finishFight(s, ev) {
  const f = s.fight;
  const kind = f.kind;
  if (kind === 'boss') {
    s.stats.bossHpPct = frac6(f.enemies[0].hp / f.enemies[0].maxHp);
  }
  const { outcome, drops } = endFight(s, ev);
  if (outcome === 'death') { endRun(s, ev, 'death'); return; }
  if (outcome === 'victory') heatFightWon(s, f.heat); // rules 1.7.4, 11.1: fights won by the node's entry state
  receiveItems(s, ev, drops);
  if (kind === 'boss') { endRun(s, ev, 'victory'); return; }
  if (kind === 'camp') {
    if (outcome === 'victory') gainXp(s, ev, eventXp(s, GRIND_WAVE_XP_FRAC * xpWeight(s), CAMP_GRIND_LEVEL), 'wave');
    s.lootRng = null;
    return;
  }
  // A Dimmed encounter (rules 1.9.6), won or fled: back on the map; the node is not resolved by it.
  if (kind === 'dim') { endDimEncounter(s, ev); return; }
  // A dev tool's fight (engine-api.md 12): back where it was started.
  if (s.node && s.node.type === 'dev') { endDevEncounter(s, ev); return; }
  const n = s.node;
  if (outcome === 'fled') { completeNode(s, ev); return; }
  if (kind === 'quest') {
    s.stats.quests += 1;
    s.zone.questsDone += 1;
    ev.push({ t: 'questComplete', quest: n.quest });
    gainXp(s, ev, eventXp(s, QUEST_TURNIN_XP_FRAC * xpWeight(s), n.cl), 'quest');
    gainGold(s, ev, QUEST_GOLD_V * V(n.cl), 'quest');
    n.rewards = [{ kind: 'items', items: genChoices(s, 'quest', QUEST_REWARD_CHOICES, n.cl) }];
    if (s.zone.questsDone === STORY_QUESTS) {
      s.stats.stories += 1;
      ev.push({ t: 'story', z: s.zone.z });
      gainXp(s, ev, eventXp(s, STORY_XP_FRAC, n.cl), 'story');
      n.rewards.push({ kind: 'items', items: genChoices(s, 'story', STORY_REWARD_CHOICES, n.cl), story: true });
    }
    n.stage = 'reward';
  } else if (kind === 'grind') {
    gainXp(s, ev, eventXp(s, GRIND_WAVE_XP_FRAC * xpWeight(s), n.cl), 'wave');
    n.wavesDone += 1;
    if (n.wavesDone < n.planned) n.stage = 'between';
    else completeNode(s, ev);
  } else if (kind === 'elite') {
    completeNode(s, ev);
  } else if (kind === 'trash') {
    n.stage = 'between';
  } else if (kind === 'dboss') {
    s.stats.dungeons += 1;
    ev.push({ t: 'dungeonClear', z: s.zone.z });
    gainXp(s, ev, eventXp(s, DUNGEON_CLEAR_XP_FRAC * xpWeight(s), n.bossLevel), 'dungeon');
    gainGold(s, ev, DUNGEON_GOLD_V * V(n.bossLevel), 'dungeon');
    completeNode(s, ev);
  } else if (kind === 'treasure') {
    openChest(s, ev);
    completeNode(s, ev);
  }
}

function genChoices(s, table, count, cl) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(...rollDrop(s, s.lootRng, table, cl, s.zone.z));
  return out;
}

/** CHOOSE_REWARD (quest items, story items, shrine boons). */
export function chooseReward(s, ev, index) {
  const n = s.node;
  const set = n.rewards.shift();
  if (set.kind === 'items') {
    const it = set.items[index];
    s.stats.equipDrops += 1;
    if (addToBag(s, it)) ev.push({ t: 'loot', item: deepClone(it), to: 'bag' });
    else { s.loot.push(it); ev.push({ t: 'loot', item: deepClone(it), to: 'window' }); }
  } else {
    applyBoon(s, ev, set.boons[index]);
  }
  if (!n.rewards.length) completeNode(s, ev);
}

function applyBoon(s, ev, id) {
  const p = s.player;
  ev.push({ t: 'boon', id, name: BOON[id].name });
  if (id === 'return') p.res.boon += 1;
  else if (id === 'insight' || id === 'fury') p.buffs[id] = { left: BOON_NODES, active: false };
  else if (id === 'plenty') gainGold(s, ev, BOON_GOLD_V * V(s.node.cl), 'boon');
  else if (id === 'mending') {
    p.hp = p.d.maxHp;
    p.mana = p.d.maxMana;
    addRested(s, BOON.mending.restedFrac);
  } else if (id === 'clarity') {
    p.freeRespec = true;
    for (const sid of Object.keys(p.spells)) {
      if (SPELL[sid].source !== 'talent' && p.spells[sid].tl < p.level) { p.spells[sid].tl = p.level; p.spells[sid].rank += 1; }
    }
  }
}

// ---------------- Camp and boss (rules 1.6, 1.7, 10) ----------------
export function campGrind(s, ev) {
  s.camp.waves += 1;
  s.stats.campWaves += 1;
  const w = s.camp.waves;
  advanceBuffs(s, ev);
  addHours(s, ev, nodeHours(s, 'grind'), 'camp');
  s.lootRng = STREAM.loot(s.seed, CAMP_Z, w, 0);
  const pool = campEnemies(s.content);
  const setup = STREAM.node(s.seed, CAMP_Z, w, 0);
  let tids = [];
  for (let i = 0; i < GRIND_WAVE_SIZE; i++) tids.push(pool[nextInt(setup, pool.length)]);
  tids = composeEncounter(s.content, setup, tids, pool); // rules 7.14 (combat v2)
  const en = tids.map((tid) => ({ tid, level: CAMP_GRIND_LEVEL, variant: 'normal' }));
  startFight(s, ev, {
    kind: 'camp', k: 0, z: CAMP_Z, rng: STREAM.fight(s.seed, CAMP_Z, w, 0, 0), enemies: en,
    addLevel: CAMP_GRIND_LEVEL, addPool: pool, dropMult: GRIND_DROP_MULT, canFlee: true,
  });
}

/** Boss Ascendancy from hours (rules 1.7): the hours past the par (heat at the Camp, rules 1.7.1). */
export function ascendancy(s) {
  return ascOver(s.hours - parHours(s.oaths));
}

export function fightBoss(s, ev) {
  advanceBuffs(s, ev);
  const asc = ascendancy(s);
  s.stats.reachedBoss = true;
  s.stats.bossPhase = 1;
  s.stats.hoursAtBoss = s.hours;
  s.stats.asc = asc;
  s.lootRng = null;
  setPhase(s, ev, 'BOSS');
  ev.push({ t: 'bossStart', asc, hours: s.hours, level: BOSS_LEVEL });
  startFight(s, ev, {
    kind: 'boss', k: 0, z: CAMP_Z, rng: STREAM.boss(s.seed), enemies: [], bossEnemy: makeBoss(asc),
    addLevel: BOSS_LEVEL, addPool: [], canFlee: false, noStealth: true,
    boss: { asc, phase: 1, resume: null, nextShard: null, nextPulse: null, eclipse: 0 },
  });
}

// ---------------- Run end (rules 9) ----------------
export function endRun(s, ev, outcome) {
  s.outcome = outcome;
  s.loot = [];
  s.node = null;
  s.service = null;
  s.fight = null;
  ev.push({ t: 'runEnd', outcome });
  setPhase(s, ev, 'SUMMARY');
}

// ---------------- Trainer (rules 2.7) ----------------
/** Spells the trainer offers this class: class spells plus unlocked meta spells (rules 11.4). */
export function trainerSpells(s) {
  const cls = s.player.classId;
  return Object.values(SPELL).filter((sp) => sp.cls === cls && (sp.source === 'class' || (sp.source === 'meta' && s.meta.spells.includes(sp.id)))).map((sp) => sp.id);
}

const ledgerActive = (s) => s.service && s.service.where !== 'node' && s.hub && s.hub.ledgerFree;

export function learnCost(s, id) {
  return ledgerActive(s) ? 0 : rnd(TRAIN_NEW_V * V(SPELL[id].lvl));
}

export function trainCost(s) {
  return ledgerActive(s) ? 0 : rnd(TRAIN_RANK_V * V(s.player.level));
}

export function respecCost(s) {
  return s.player.freeRespec ? 0 : rnd(RESPEC_V * V(s.player.level));
}

function useLedger(s) {
  if (ledgerActive(s)) s.hub.ledgerFree = false;
}

function placeOnBar(s, id) {
  const bar = s.player.bar;
  if (bar.includes(id)) return;
  const i = bar.indexOf(null);
  if (i >= 0) bar[i] = id;
}

export function learnSpell(s, ev, id) {
  const p = s.player;
  const cost = learnCost(s, id);
  useLedger(s);
  if (cost) spendGold(s, ev, cost, 'learn');
  p.spells[id] = { tl: p.level, rank: 1 };
  p.spellOrder.push(id);
  placeOnBar(s, id);
  s.stats.trainerTx += 1;
  ev.push({ t: 'learn', spell: id, tl: p.level });
}

export function trainSpell(s, ev, id) {
  const p = s.player;
  const cost = trainCost(s);
  useLedger(s);
  if (cost) spendGold(s, ev, cost, 'train');
  p.spells[id].tl = p.level;
  p.spells[id].rank += 1;
  s.stats.trainerTx += 1;
  ev.push({ t: 'train', spell: id, tl: p.level, rank: p.spells[id].rank });
}

/** Known trainable spells in bar order, then learn order (rules 2.7 TRAIN_ALL). */
export function trainable(s) {
  const p = s.player;
  const order = [...p.bar.filter((x) => x), ...p.spellOrder.filter((x) => !p.bar.includes(x))];
  return order.filter((id) => SPELL[id].source !== 'talent' && p.spells[id] && p.spells[id].tl < p.level);
}

export function trainAll(s, ev) {
  for (const id of trainable(s)) {
    if (s.player.gold >= trainCost(s)) trainSpell(s, ev, id);
  }
}

export function respec(s, ev) {
  const p = s.player;
  const cost = respecCost(s);
  if (cost) spendGold(s, ev, cost, 'respec');
  p.freeRespec = false;
  for (const id of Object.keys(p.spells)) {
    if (SPELL[id].source === 'talent') {
      delete p.spells[id];
      p.spellOrder = p.spellOrder.filter((x) => x !== id);
      p.bar = p.bar.map((x) => (x === id ? null : x));
    }
  }
  p.talents = {};
  p.talentSpent = 0;
  refreshDerived(s);
  clampAfterStatChange(s);
  ev.push({ t: 'respec' });
}

/** After gear/talent changes: current HP, mana and pet HP stay, clamped to the new maxima. */
export function clampAfterStatChange(s) {
  const p = s.player;
  p.hp = Math.min(p.hp, p.d.maxHp);
  p.mana = Math.min(p.mana, p.d.maxMana);
  if (p.pet) p.pet.hp = Math.min(p.pet.hp, p.d.petMaxHp);
}

// ---------------- Vendor (rules 2.6) ----------------
export function buy(s, ev, i) {
  const e = s.service.stock[i];
  spendGold(s, ev, e.price, 'buy');
  s.stats.vendorTx += 1;
  if (e.kind === 'cons') {
    if (!e.unlimited) e.sold = true;
    addToBag(s, makeConsumable(s, e.id));
    ev.push({ t: 'buy', item: e.id, price: e.price });
  } else {
    e.sold = true;
    addToBag(s, deepClone(e.item));
    ev.push({ t: 'buy', item: e.item.uid, price: e.price });
  }
}

export function sell(s, ev, uid) {
  const i = bagIndex(s, uid);
  const it = s.player.bag[i];
  const v = sellValue(s, it);
  s.player.bag.splice(i, 1);
  addGoldRaw(s, ev, v, 'sell');
  s.stats.vendorTx += 1;
  ev.push({ t: 'sell', item: uid, value: v });
}

export function sellJunk(s, ev) {
  for (const it of s.player.bag.filter((x) => x.kind === 'junk')) sell(s, ev, it.uid);
}

// ---------------- Out-of-combat item use (rules 8.6) ----------------
export function useItemOutOfCombat(s, ev, id) {
  const p = s.player;
  const c = CONSUMABLE[id];
  takeConsumable(s, id, 1);
  ev.push({ t: 'useItem', item: id });
  if (c.potion) s.stats.potionsUsed += 1;
  if (c.heal) healUnitOoc(s, ev, rnd(c.heal * p.d.maxHp * (1 + potionBonus(s))));
  if (c.mana) p.mana = Math.min(p.d.maxMana, p.mana + rnd(c.mana * p.d.maxMana));
  if (c.restore) {
    healUnitOoc(s, ev, rnd(c.restore * p.d.maxHp));
    p.mana = Math.min(p.d.maxMana, p.mana + rnd(c.restore * p.d.maxMana));
    if (p.pet && p.pet.alive) p.pet.hp = Math.min(p.d.petMaxHp, p.pet.hp + rnd(c.restore * p.d.petMaxHp));
  }
  if (c.dmgPct) p.buffs.elixir = { left: ELIXIR_NODES, active: false };
}

function potionBonus(s) {
  return UNIQUE_POTION_PCT * hasEffect(s, 'potion');
}

/** Out-of-combat heal; like healUnit, no heal event when nothing is restored. */
function healUnitOoc(s, ev, amount) {
  const p = s.player;
  const n = Math.max(0, Math.min(amount, p.d.maxHp - p.hp));
  p.hp += n;
  if (n > 0) ev.push({ t: 'heal', dst: 'player', amount: n });
}

