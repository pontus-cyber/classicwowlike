// engine-bridge.js - the ONLY module of the visual client that talks to the rules engine.
//
// Backends: the real engine src/rules.js (default; API in docs/specs/engine-api.md) and the mock
// src/ui/mock-engine.js (?mock=1). The UI reads one plain "view" and sends UI actions; this file
// converts engine state to that view, UI actions to engine actions, and engine events to the
// animation events the director plays. It decides no rules: legality, costs, cooldowns, item scores
// and autoplay all come from the engine (legalActions, whyIllegal, spellCost, spellCooldown,
// itemScore, autoAction). The only state kept here is presentation: which intro dialogs the
// player has read and which result windows (spoils, rest, chest) are still on screen.
//
// View shape consumed by the UI:
//   phase: 'CREATE' | 'ZONE_HUB' | 'MAP' | 'NODE' | 'CAMP' | 'BOSS' | 'SUMMARY'      (rules.md 1.1)
//   time (the run's tolls, whole; R state.time, M2b v7), autoplay, seed, mode ('engine' | 'mock')
//   create:  { classId, petId, name, seed }
//   player:  { name, classId, className, petId, level, xp, xpToNext, rested, hp, maxHp,
//              res: { kind: 'energy'|'mana'|'focus', cur, max }, cp, cpMax, gold (copper),
//              stats: { sta, agi, int, spi, power, crit, critMult, dodge, armor, wd },
//              equip: { [slot]: item|null }, bag: (item|null)[], spells: [{ id, tl, rank }],
//              bar: (spellId|null)[7], itemBar: (consumableId|null)[3], talents: { id: rank },
//              talentPoints, talentSpent: { tree: n }, statuses: [{ id, rounds, stacks, value }],
//              boons: [{ id, name, nodesLeft }], resurrect: [source], resurrectHeld: { boon, meta, ember }, resurrectBoss: [source],
//              pet: { id, name, hp, maxHp, alive, statuses, dot } | null, dot }
//              dot (player, pet, each combat enemy): the DoT preview, R.pendingTicks (engine-api.md 6.1; dotOf below), or null
//              resurrect: what a death would use now, in order ('boon' | 'meta' (Second Breath) | 'ember'; R.resurrectCharges);
//              resurrectBoss: the same in the end-boss fight; resurrectHeld (engine only): the charges held
//   zone:    { idx, id, camp, name, hubName, hubText, theme, band, exitLevel, travelLevel, blurb, rows: node[rows][lanes], pos: { row, lane }, path,
//              questsDone, storyDone, travelTime }   rows and lanes: as many as the engine's map has (mapView); travelLevel: the level
//              from which TRAVEL_ON is legal before the last row (rules 1.5, R.travelLevel); travelTime: the tolls TRAVEL_ON
//              costs now (a dry step; null while it is not legal)
//   hub:     { used: { trainer, vendor, inn } }
//   trainer: R.trainerView ({ learn, train, next, useful }; D144: the hub's welcome line and Trainer card), or null
//   node:    { type, step, cl, row, lane, ... }  step: intro|combat|reward|story|between|chest|rest|vendor|trainer|shrine
//   combat:  { round, enemies: [{ idx, uid, name, level, rank, arch, hp, maxHp, statuses, alive, intent, track, role, offBalance,
//              ccImmune }], target, cooldowns: { spellId: roundsLeft }, potionCd, kind, isBoss, boss: { phase, asc, telegraph },
//              over, title, fightNo, fights, engage }
//              combat v2 (docs/specs/combat-v2.md 10, engine-api.md 6): track = the enemy's intent track (convTrack), role =
//              its archetype and pack role (convRole), offBalance = R.offBalance (D144: with `shield` and `absorbs`, the
//              enemy shield takes the main attack's whole hit), engage = the engage round's options
//              (R.isEngageRound, R.engageOptions) or null; bridge.engagePreview(option, target, spellId) = R.engagePreview
//              combat v2.1 (combat-v2.md 16, engine-api.md 5, 6): track entries and intents carry `windup` (cancel.stagger:
//              the predicted cancel answers it), statuses hold EMPOWERED and STAGGERED ({ stacks, value }), engage options
//              `disrupt` (targets where the control option is Disrupt) and `why` (the engine's reason per target it may not
//              take); events `windup` { result: 'answered' | 'landed', why, by, stacks, value } from `stagger` and `empower`
//   data.rules: rule numbers that screens show in text, read from the engine's constants (rulesTable below)
//   loot:    { kind: 'loot'|'reward'|'story', title, text?, gold, xp, items?, choices? }
//   summary: run summary (rules.md 9)
//   par:     the run's boss par in tolls (R.bossPar: BOSS_TIME_PAR, shorter under the Oath of Haste); mock: its own
//   camp:    { par, asc } at the camp (asc: the engine's Ascendancy if the boss were faced now), else null
//   zone.danger, node.danger { lo, hi }: zone danger (rules 7.6) from R.zoneDanger; the zone's at its highest level
//   legal:   { lanes, travelOn, mustTravel, outOfCombat, spells: { id: { ok, reason, cd, window } }, items: [{ ok, reason, count, cd, free }],
//              attack, flee, fleeChance?, services, talents, trainer }   window (combat v2): the enemies on which the spell
//              lands in an OFF_BALANCE window (R.spellInfo(...).window per enemy; 'all' for an area spell), else null;
//              items[].free (M2b v6): a potion that Packed Satchel's free potion would make a free action now (R.freePotion);
//              the `action` event of that potion carries free: true. M2b v8: items[].mult (FREE_POTION_MULT when free, else
//              1), items[].heal and items[].mana: what one use restores now, the engine's numbers (R.potionInfo; null on an
//              engine without it); the free potion's `action` event carries `mult`
//   oaths:   Oaths of the run (rules 11.5); create.oaths in CREATE
//   meta:    engine mode, CREATE and SUMMARY only (rules 11): the profile between runs, see metaView() below.
//   data.meta: the catalogue (R.C.META), Oaths (R.C.OATH) and the names and numbers its texts use.
//   heat:    the heat meter (docs/specs/expedition.md H, engine-api.md 11): R.heatView in every phase of a run but SUMMARY
//            (null in CREATE, SUMMARY and the mock), with `next` keyed by heatKey(action) (src/ui/heat.js) and `list` (the
//            engine's array); heatPreview(action) = R.heatPreview for any other UI action. data.rules.heat: the HEAT_*
//            constants the texts name. summary.heat: the summary's heat block (engine-api.md 11.3).
//   Items carry heatUp ('hot' | 'scorched') when heat raised them one rarity (heatSteps below); map nodes carry heat
//   (the state a visited node was entered in, from the `node` event); node.heat: the entry state of the node shown.
//   mapMode: 'rows' or 'expedition'. Since D116 new runs are expedition runs with the start camp (rules 1.9): zone.exp is
//   then R.mapView (engine-api.md 10.3) and zone.rows is empty. ?classic=1 or the Dev menu's "Classic map (old)" (App:
//   createBridge({ classic }), setRunMode) starts classic runs (mapMode 'rows'); ?expedition=1 expedition runs without the
//   start camp (a test switch; ?prep=1 keeps the camp).
//   Start camp and contracts (docs/specs/expedition.md 2, 3, 9.1, 9.3; engine-api.md 13): runs start with newRun({ mapMode:
//   'expedition', prep: true }), the default. phase 'PREP' (after START_RUN, no zone): prep = R.prepView; zone, node, combat and heat
//   are null. contracts: R.contractView in every phase of such a run (null otherwise): the tracker and the hub offer. The
//   reward window of a completed contract is loot.kind 'contract' (its contract, XP and gold). Contract, prep and Spyglass
//   events become log lines and toasts (msg).
// UI action META_BUY { id } (CREATE only): R.buyMeta on the stored profile; the run being created picks up the new profile.
//   dev:     the dev tools' marker of the run (engine-api.md 12: { god, tools }), null for a normal run; data.dev: what the Dev
//            menu lists (the enemy templates from R.debug.enemies, rarities, limits, heat states, zones' first levels).
// Dev tools (engine-api.md 12; src/ui/dev-menu.js): bridge.dev(op, args) runs R.debug on the run or the profile and replaces
//   the run with the result; every op goes into the engine log as { type: 'DEV', fn, args } so a Node twin replays it. A dev
//   run is left out of the run log (tbwcr.history.v1); its summary carries `dev` { god, tools, withheld }.
// Events: { t: 'damage'|'heal'|'action'|'status'|'death'|'interrupt'|'skip'|'xp'|'levelUp'|'victory'|'flee'|'resurrect'|'bossPhase'|'summon'|... }
// Names (owner screenshot 2026-11-11 08:31): actionName gives every damage source and enemy action by its display name (a
// content ability by its content name), never an id; the summary's Killed by and the combat log use it.
// bridge.talentInfo(id) = R.talentInfo (talent totals, owner feedback 2026-11-11 08:14); mock: null.
// bridge.damageView() = R.damageView (the character sheet's damage block, owner feedback 2026-11-11 11:58); mock: null.

import * as R from '../rules.js';
import { CONTENT } from '../content/index.js';
import * as mock from './mock-engine.js';
import * as TXT from './ui-text.js';
import { heatKey } from './heat.js';

const params = (() => {
  try { return new URLSearchParams(globalThis.location ? globalThis.location.search : ''); } catch { return new URLSearchParams(''); }
})();

/**
 * Rule numbers the screens put into text, read from the engine's constants (`C` of src/rules.js) so that UI
 * code never copies a number from the rules. Rows and lanes are not here: the screens count them on the map.
 */
function rulesTable(K) {
  // Linked (rules 10.2, M2 v2): -LINK_DR_PER_SHARD per living Shard, at most -LINK_DR. An engine without the
  // per-Shard constant has the older rule: -LINK_DR while any Shard lives.
  const per = K.LINK_DR_PER_SHARD;
  const linkDr = Array.from({ length: (K.SHARD_MAX || 4) + 1 }, (_, n) => (n === 0 ? 0 : per != null ? Math.min(K.LINK_DR, per * n) : K.LINK_DR));
  return {
    zoneCount: K.ZONE_COUNT, maxLevel: K.MAX_LEVEL, storyQuests: K.STORY_QUESTS, dungeonTrashFights: K.DUNGEON_TRASH_FIGHTS,
    grindMaxWaves: K.GRIND_MAX_WAVES, grindWaveSize: K.GRIND_WAVE_SIZE, eliteLevelOffset: K.ELITE_LEVEL_OFFSET,
    campGrindLevel: K.CAMP_GRIND_LEVEL, ascStepTime: K.ASC_STEP_TIME, cpMax: K.CP_MAX, potionCd: K.POTION_CD,
    time: { trainer: K.TIME_TRAINER, vendor: K.TIME_VENDOR, inn: K.TIME_REST, travel: K.TIME_TRAVEL, grindWave: K.TIME_GRIND_WAVE },
    linkPerShard: per ?? null, linkCap: K.LINK_DR, linkDr, shardAoeTaken: K.SHARD_AOE_TAKEN ?? null,
    // Round time budget at the default animation speed (rules 3, M2 v2); null on an engine without it.
    roundAnimMs: K.PACE_ROUND_ANIM_S != null ? K.PACE_ROUND_ANIM_S * 1000 : null,
    // Status numbers that live in the rules, not on the status object (rules 7.4): status tooltips state them.
    status: { cursePct: K.CURSE_PCT ?? null, brandDmg: K.BRAND_DMG ?? null, brandMax: K.BRAND_MAX ?? null, stealthMiss: K.STEALTH_MISS_BONUS ?? null, dodgeCap: K.DODGE_CAP ?? null,
      offbalCrit: K.OFFBAL_CRIT ?? null },
    // Zone danger (rules 7.6, M2 v3; dungeons M2 v4): enemies above dangerFrom hit harder. dangerStep and
    // dangerStepDungeon: the extra damage TXT.DANGER_LEVELS levels above dangerFrom, in the open world and in a dungeon
    // (trash), from the engine's zoneDanger; null without zone danger.
    dangerFrom: K.ZONE_DANGER_FROM ?? null,
    dangerStep: K.ZONE_DANGER_FROM != null ? R.zoneDanger(K.ZONE_DANGER_FROM + TXT.DANGER_LEVELS, 'normal') - 1 : null,
    dangerStepDungeon: K.ZONE_DANGER_FROM != null ? R.zoneDanger(K.ZONE_DANGER_FROM + TXT.DANGER_LEVELS, 'trash') - 1 : null,
    // Heat (rules 1.7.1-1.7.4, 1.9.10; expedition.md H): the thresholds, rewards and bar range the meter's texts and its
    // segments use; null on an engine without heat. The meter's state, line, heat and previews come from R.heatView.
    heat: K.HEAT_STATES ? {
      states: [...K.HEAT_STATES], warmAt: K.HEAT_WARM_AT, hotAt: K.HEAT_HOT_AT, scorchAt: K.HEAT_SCORCH_AT,
      dimWarm: K.HEAT_DIM_WARM, dimHot: K.HEAT_DIM_HOT, gain: { ...K.HEAT_GAIN }, rarityUp: { ...K.HEAT_RARITY_UP },
      barMin: K.HEAT_BAR_MIN, barMax: K.HEAT_BAR_MAX, echoPerFight: K.ECHO_PER_HEAT_FIGHT ?? null,
      ascPerStep: K.ASC_PER_STEP, ascStepTime: K.ASC_STEP_TIME, ascCap: K.ASC_CAP, parBase: K.BOSS_TIME_PAR,
    } : null,
    // Start camp and contracts (expedition.md 2.4, 3.3, 5.1; prep): the radii and counts the prep screen's and the
    // tracker's texts name; every price, point and reward comes from R.prepView / R.contractView. null without them.
    prep: K.PREP_OPTION ? {
      vision: K.VISION_RADIUS, visionMax: K.VISION_RADIUS_MAX, guide: K.GUIDE_RADIUS_BONUS, tracker: K.TRACKER_RADIUS,
      bountyPlaced: K.BOUNTY_PLACED, bellMax: K.BELL_MAX_CHARGES, emberMax: K.EMBER_MAX_CARRIED,
    } : null,
  };
}

/**
 * Meta progression data for the Echoes screen and the Oaths (rules 11): the catalogue as the engine has it (R.C.META:
 * kind, ranks, costs and the effect per rank), the Oaths (R.C.OATH), and the names and numbers their texts use. Rank,
 * next cost and state of an unlock always come from R.metaOffers, never from these tables.
 */
function metaData(K) {
  const uniq = Object.values(CONTENT.uniques || {});
  const zones = CONTENT.zones || [];
  const byZone = (kind) => uniq.filter((u) => u.kind === kind).sort((a, b) => (a.zone || 0) - (b.zone || 0))
    .map((u) => ({ name: u.name, zone: u.zone, slot: u.slot, text: u.text, zoneName: zones[u.zone - 1] ? zones[u.zone - 1].name : '', dungeon: zones[u.zone - 1] && zones[u.zone - 1].dungeon ? zones[u.zone - 1].dungeon.name : '' }));
  return {
    kinds: [...new Set(Object.values(K.META).map((m) => m.kind))], // catalogue order (rules 11.2)
    entries: Object.fromEntries(Object.values(K.META).map((m) => [m.id, { ...m, costs: [...m.costs], req: [...m.req] }])),
    oathIds: [...(K.OATH_IDS || [])],
    oaths: Object.fromEntries(Object.values(K.OATH || {}).map((o) => [o.id, { ...o }])),
    // expedition.md 8.2 (M2b v11): the numbers and names of the expedition entries' texts (bellMax, trackerRadius, prepPoints, charts, tracker)
    num: { maxLevel: K.MAX_LEVEL, zoneCount: K.ZONE_COUNT, firstKill: K.ECHO_FIRST_KILL_CLASS, oathEcho: K.OATH_ECHO_BONUS, oathHaste: K.OATH_HASTE_TIME, oathThrift: K.OATH_THRIFT_MULT,
      bellMax: K.BELL_MAX_CHARGES ?? null, trackerRadius: K.TRACKER_RADIUS ?? null, prepPoints: K.PREP_POINTS ?? null },
    names: { boon: K.BOON.return.name, ember: K.CONSUMABLE.ember_of_return.name, potion: K.CONSUMABLE.healing_draught.name, greater: K.CONSUMABLE.greater_healing_draught.name, boss: K.BOSS_TEXT.name.split(',')[0], camp: (CONTENT.camp && CONTENT.camp.name) || 'the camp',
      charts: K.PREP_OPTION ? K.PREP_OPTION.prep_charts.name : 'Region Charts', tracker: K.PREP_OPTION ? K.PREP_OPTION.prep_tracker.name : "Tracker's Notes" },
    greaterHeal: K.CONSUMABLE.greater_healing_draught.heal,
    freePotionMult: K.FREE_POTION_MULT ?? null, // M2b v8 (rules 7.5): the free potion's share of its normal amount
    uniques: { rare: byZone('rare'), epic: byZone('epic'), weapon: Object.fromEntries(uniq.filter((u) => u.kind === 'weapon').map((u) => [u.classId, { name: u.name, text: u.text }])) },
    zones: zones.map((z) => z.name),
  };
}

/**
 * What the Dev menu offers (engine-api.md 12; src/ui/dev-menu.js): every enemy template with its home zone and kind
 * (R.debug.enemies), the gear rarities, the limits of the level and item level, the heat states, each zone's first level
 * (rules 1.3: the level debug.build gives a zone when none is chosen), and the build defaults (C.DEV).
 */
function devData(K) {
  return {
    enemies: R.debug.enemies(CONTENT), rarities: [...K.RARITY_ORDER], maxLevel: K.MAX_LEVEL, ilvlMax: K.ILVL_MAX, heatStates: [...K.HEAT_STATES],
    zoneCount: K.ZONE_COUNT, firstLevel: Array.from({ length: K.ZONE_COUNT + 1 }, (_, i) => (i < K.ZONE_COUNT ? K.ZONE_LEVELS * i + 1 : K.MAX_LEVEL)),
    defaults: { ...K.DEV }, kinds: ['normal', 'elite', 'rare', 'trash', 'dboss'],
  };
}

/**
 * Combat v2 data for the engage panel, role badges and the intent track (docs/specs/combat-v2.md 10): the engage options
 * (R.C.ENGAGE_OPTION and the class order of ENGAGE_OPTIONS), each archetype's opening script (OPENING_SCRIPT) and actions
 * (ARCHETYPE, SCRIPT_ACTION), and the numbers the texts of ui-text.js name. null on an engine before combat v2.
 */
function v2Data(K) {
  if (!K.ENGAGE_OPTION || !K.OPENING_SCRIPT) return null;
  const act = (x) => ({ id: x.id, name: x.name, kind: x.kind, heavy: !!x.heavy, cast: !!x.cast });
  return {
    options: Object.fromEntries(Object.values(K.ENGAGE_OPTION).map((o) => [o.id, { ...o }])),
    classOptions: Object.fromEntries(Object.entries(K.ENGAGE_OPTIONS).map(([c, l]) => [c, [...l]])),
    scripts: Object.fromEntries(Object.entries(K.OPENING_SCRIPT).map(([a, l]) => [a, [...l]])),
    actions: Object.fromEntries(Object.values(K.ARCHETYPE).map((a) => [a.id, a.actions.map(act)])),
    scriptActions: Object.fromEntries(Object.values(K.SCRIPT_ACTION || {}).map((x) => [x.id, act(x)])),
    num: {
      trackLen: K.INTENT_TRACK_LEN, openingTurns: K.OPENING_TURNS, signatureTurn: K.SIGNATURE_TURN, offbalTaken: K.OFFBAL_TAKEN,
      offbalBossTaken: K.OFFBAL_BOSS_TAKEN, offbalCrit: K.OFFBAL_CRIT, bolsterPct: K.BOLSTER_PCT, bloodlustStep: K.BLOODLUST_STEP,
      bloodlustMax: K.BLOODLUST_MAX, signalAdds: K.SIGNAL_ADDS, markValue: K.SPELL.mark_prey ? K.SPELL.mark_prey.marked : null,
      shadowstep: K.SPELL.shadowstep_strike ? K.SPELL.shadowstep_strike.name : 'Shadowstep Strike',
      jab: K.SPELL.gutting_jab ? K.SPELL.gutting_jab.name : 'Gutting Jab', keen: K.SPELL.keen_shot ? K.SPELL.keen_shot.name : 'Keen Shot',
      // combat v2.1 (rules 7.12): a wind-up answered gives a STAGGERED stack (-STAGGER_DMG damage dealt), landed an
      // EMPOWERED stack (+EMPOWER_DMG); null on an engine before combat v2.1
      empowerDmg: K.EMPOWER_DMG ?? null, staggerDmg: K.STAGGER_DMG ?? null, signatureTurn2: K.SIGNATURE_TURN_2 ?? null,
      // M2b v13 (rules 7.12, 7.4): a Deathblow's damage multiplier, its EMPOWERED value and MAIMED's healing cut; null before v13
      deathblowMult: K.DEATHBLOW_MULT ?? null, deathblowEmpower: K.DEATHBLOW_EMPOWER ?? null, maimHeal: K.MAIM_HEAL ?? null,
    },
  };
}

// ====================================================================================== mock
function mockBackend(seed) {
  let state = mock.createState({ seed });
  const MC = mock.data.constants; // the mock's own simplified numbers
  // Screen texts use the rules table; the mock's own par and Ascendancy step replace the engine's (the mock computes
  // Ascendancy itself), and the mock has no zone danger.
  const data = { ...mock.data, rules: { ...rulesTable(R.C), ascStepTime: MC.ASC_STEP, dangerFrom: null, dangerStep: null, dangerStepDungeon: null } };
  return {
    mode: 'mock', data, canDebug: true,
    view() {
      const camp = state.phase === 'CAMP' ? { par: MC.BOSS_TIME_PAR, asc: Math.min(MC.ASC_CAP, MC.ASC_PER * Math.floor(Math.max(0, state.time - MC.BOSS_TIME_PAR) / MC.ASC_STEP)) } : null; // mock rule
      return { ...state, par: MC.BOSS_TIME_PAR, camp, legal: state.player ? mock.legalInfo(state) : { lanes: [], services: {}, items: [], spells: {} }, mode: 'mock' };
    },
    step(action) {
      const r = mock.step(state, action);
      if (r.ok) state = r.state;
      return { ok: r.ok, error: r.error, events: r.events || [] };
    },
    autoAction() { return mock.autoAction(state); },
    describeSpell(id) { return mock.describeSpell(state, id); },
    itemScore(item) { return mock.itemScore(item, state.player ? state.player.classId : 'rogue'); },
  };
}

// ====================================================================================== engine
const THEMES = ['farmland', 'wetlands', 'highlands', 'ruins', 'haunted', 'scorched'];
const PROFILE_KEY = 'tbwcr.profile.v1';
const RES_LETTER = { energy: 'E', mana: 'M', focus: 'F' };
/** Keys of the engage options in the engage panel (strike, control, setup; combat-v2.md 10.3). */
export const ENGAGE_KEYS = ['Q', 'W', 'E'];
/**
 * How an engage option's action plays (combat-v2.md 6.2; presentation only): at the target (strikes, Sap, Binding Glyph),
 * on the hero (setups; Lay Trap shows on the target through its TRAP status), on the pet (Send the Pet), and its school.
 */
const ENGAGE_FX = {
  ambush: { at: 'target', school: 'phys' }, sap: { at: 'target', school: 'phys' }, premeditate: { at: 'self', school: 'shadow', tags: ['resource'] },
  binding_glyph: { at: 'target', school: 'frost' }, gather_power: { at: 'self', school: 'arcane', tags: ['resource'] },
  opening_shot: { at: 'target', school: 'phys' }, lay_trap: { at: 'self', school: 'nature', tags: ['resource'] }, send_pet: { at: 'pet', school: 'nature', tags: ['defensive'] },
};
const RES_KEY = { boon: 'boon', second_breath: 'meta', ember: 'ember' }; // engine resurrect source -> view source
const USE_MAP = { any: 'both', both: 'both', out: 'out', combat: 'combat', passive: 'passive' };
const hash = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// a reason names spells by name (QA playtest 2026-11-13, finding 5): the engine's may carry a spell id ("severing_flourish
// needs a combo point" reads "Severing Flourish needs a combo point")
const SPELL_IDS = new RegExp(`\\b(${Object.keys(R.C.SPELL).sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
const reasonOf = (err) => { const m = String((err && err.message) || err || ''); const i = m.lastIndexOf(': '); return cap((i >= 0 ? m.slice(i + 2) : m).replace(SPELL_IDS, (id) => R.C.SPELL[id].name)); };
/**
 * A cast refused for its cost, in the player's words (blind panel 2026-11-13: "Not enough resource for X" read as nothing):
 * "Not enough energy for Gutting Jab: it costs 40, you have 30" (the engine's cost, R.spellCost, and the fight's resource).
 * Any other reason: reasonOf's.
 */
const castReason = (s, err) => {
  const m = /not enough resource for (\w+)/.exec(String((err && err.message) || err || ''));
  if (!m || !R.C.SPELL[m[1]] || !s || !s.player) return reasonOf(err);
  const kind = R.C.CLASS[s.player.classId].resource;
  const have = kind === 'mana' ? s.player.mana : s.fight && s.fight.p ? s.fight.p[kind] : null;
  let cost = null; try { cost = R.spellCost(s, m[1]); } catch { cost = null; }
  const name = R.C.SPELL[m[1]].name;
  return cost == null || have == null ? `Not enough ${kind} for ${name}` : `Not enough ${kind} for ${name}: it costs ${Math.round(cost)}, you have ${Math.floor(have)}`;
};

/** The stored meta profile, completed with the fields of R.newProfile() a stored copy may lack; null without one. */
function loadProfile() {
  try {
    const raw = globalThis.localStorage && localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw); const base = R.newProfile();
      // M3 (m3-onboarding.md E6): a profile saved before the guide keys gets them (runs > 0: guide done, welcome had)
      if (p && typeof p === 'object') return R.migrateProfile({ ...base, ...p, guide: p.guide, welcome: p.welcome, unlocks: { ...(p.unlocks || {}) }, firstKill: { ...base.firstKill, ...(p.firstKill || {}) } });
    }
  } catch { /* storage blocked or bad JSON */ }
  return null;
}
function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* storage blocked: the profile lives until the page closes */ } }

/**
 * Run log (presentation only; the engine's profile keeps counts, not records): per class the runs, Oruvath kills, best
 * level and the furthest point reached, in localStorage next to the profile. Written at END_RUN from the engine's summary.
 * stage: 1..ZONE_COUNT a zone, then the camp, the boss reached, the boss defeated.
 */
const HISTORY_KEY = 'tbwcr.history.v1';
const newHistory = () => ({ v: 1, logged: 0, classes: {} });
function loadHistory() {
  try {
    const raw = globalThis.localStorage && localStorage.getItem(HISTORY_KEY);
    const h = raw ? JSON.parse(raw) : null;
    if (h && typeof h === 'object' && h.classes && typeof h.classes === 'object') return { ...newHistory(), ...h };
  } catch { /* storage blocked or bad JSON */ }
  return newHistory();
}
function saveHistory(h) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* storage blocked */ } }
const randomSeed = () => Math.floor(Math.random() * 0xffffffff) >>> 0;

/**
 * Display name of a damage source or an enemy action by its engine id (engine-api.md 5: a `damage` event's `spell`, the
 * death record's `ability`, a status's `src`): a spell or a basic attack, the pet, a consumable, a talent or its proc, an enemy's DoT
 * ('<ability>@<enemy index>'), a content ability (its content name), an archetype action, the end boss's actions, Brand
 * and the Shards' strike, a status tick without a source ('poison'), the dev tools. Never an id: null when the id is
 * unknown, and the caller words the line without it (owner screenshot 2026-11-11 08:31: "Killed by" showed
 * "Ab Z3 King Aldrec Heavy Blow", the humanized id of Crown-Breaker).
 */
export function actionName(id) {
  if (typeof id !== 'string' || !id) return null;
  const C = R.C;
  if (id.includes('@')) return actionName(id.slice(0, id.indexOf('@')));
  if (C.SPELL[id]) return C.SPELL[id].name;
  for (const c of Object.values(C.CLASS)) if (c.basic && c.basic.id === id) return c.basic.name; // Strike, Spark, Auto Shot
  if (id === 'pet') return 'Pet';
  if (C.CONSUMABLE[id]) return C.CONSUMABLE[id].name;
  if (C.TALENT[id]) return C.TALENT[id].name;
  if (SRC_TALENT[id] && C.TALENT[SRC_TALENT[id]]) return C.TALENT[SRC_TALENT[id]].name;
  if (CONTENT.abilities && CONTENT.abilities[id]) return CONTENT.abilities[id].name || null;
  for (const a of Object.values(C.ARCHETYPE || {})) for (const x of a.actions || []) if (x.id === id) return x.name || null;
  const boss = { umbral_strike: 'strike', gravity_crush: 'crush', collapse_litany: 'litany', starless_pulse: 'pulse', final_dark: 'finalDark', brand: 'brand' }[id];
  if (boss) return C.BOSS_TEXT[boss];
  if (id === 'shard_hit') return `${C.BOSS_TEXT.shard} Strike`;
  const st = TXT.STATUS_INFO[id.toUpperCase()];
  if (st && st.name) return st.name;
  return SRC_OTHER[id] || null;
}
// Engine source ids that name a talent (status sources, heals and shares; rules 6) or something else of the player's.
const SRC_TALENT = { ignite: 'm_a5', heat_haze: 'm_a8', shared_wounds: 'h_a8', deaths_sidestep: 'r_b9', fire_snare: 'h_c7' };
const SRC_OTHER = { unique_proc: 'Unique item', unique: 'Unique item', dev_kill: 'Dev tools' };

function engineBackend(seedOpt, runOpts = {}) {
  const C = R.C;
  let profile = loadProfile();
  // newRun's map options for this session, always explicit ({ mapMode: 'rows' } or { mapMode: 'expedition', prep, dimming? };
  // D116: the expedition with the start camp unless ?classic=1, ?expedition=1, the setting); the Dev menu can switch it
  let runMode = { ...runOpts };
  let history = loadHistory();
  // M3 guided first run (m3-onboarding.md 2.1, 2.2; E1, E6): the run being created is guided while the profile's guide is
  // 'todo', the class select toggle is on (guideOn; ?guide=0 starts it off, a test switch) and the run is an expedition with
  // the start camp. START_RUN with the toggle off sets the profile's guide to 'skipped' (a normal run).
  let guideOn = params.get('guide') !== '0';
  const guideTodo = () => (profile ? R.migrateProfile(profile).guide : 'todo') === 'todo';
  const guided = () => !!CONTENT.tutorial && guideOn && guideTodo() && runMode.mapMode === 'expedition' && runMode.prep !== false;
  const modeNow = () => ({ ...runMode, ...(guided() ? { tutorial: true } : {}) });
  /** A run in CREATE. keep: { classId, petId } of the run before (the next run starts on the same class). runOpts: mapMode. */
  const mkRun = (seed, keep = {}) => {
    const classId = keep.classId || 'rogue'; const petId = classId === 'hunter' ? keep.petId || 'ridgewolf' : null;
    try { return R.newRun({ classId, petId, seed, content: CONTENT, profile: profile || undefined, ...modeNow() }); } catch (e) {
      try { return R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed, content: CONTENT, profile: profile || undefined, ...modeNow() }); } catch (e2) {
        profile = null; return R.newRun({ classId: 'rogue', seed, content: CONTENT, ...runMode });
      }
    }
  };
  let st = mkRun(seedOpt ?? randomSeed());
  // engineLog: the engine actions applied to this run, in order (a test hook: a Node twin replays them, qa/browser)
  // heatUp: uid -> the heat state that raised the item one rarity (heatSteps); nodeHeat: node key -> its entry state
  const local = { introSeen: new Set(), spoils: null, hold: null, reward: null, fightNo: 0, lastRun: null, runNo: 0, engineLog: [], heatUp: new Map(), nodeHeat: new Map() };
  /** A new run on screen: the presentation state and the engine log start afresh. */
  const resetLocal = () => { local.introSeen.clear(); local.spoils = null; local.hold = null; local.reward = null; local.engineLog = []; local.heatUp.clear(); local.nodeHeat.clear(); };

  // ---------------------------------------------------------------- static data for the UI
  const treeId = (cls, i) => C.CLASS[cls].trees[i].toLowerCase().replace(/\W+/g, '');
  const data = {
    classes: Object.fromEntries(Object.keys(C.CLASS).map((id) => {
      const c = C.CLASS[id]; const ui = TXT.CLASS_UI[id] || {};
      return [id, { id, name: c.name, resource: c.resource, primary: c.primary.toLowerCase(), color: ui.color, role: ui.role,
        blurb: (CONTENT.classes && CONTENT.classes[id] && CONTENT.classes[id].text) || ui.blurb,
        basic: { name: c.basic.name, school: c.basic.school }, trees: c.trees.map((n, i) => [treeId(id, i), n]) }];
    })),
    spells: Object.fromEntries(Object.values(C.SPELL).map((s) => [s.id, {
      id: s.id, cls: s.cls, name: s.name, lvl: s.lvl, cd: s.cd || 0, tags: s.tags || [], school: s.school, target: s.target, raw: s,
      cost: s.cost ? [RES_LETTER[C.CLASS[s.cls].resource], s.cost] : null, text: TXT.spellText(s.id, CONTENT, s),
      fx: { meta: s.source === 'meta', talent: s.source === 'talent' },
    }])),
    talents: Object.fromEntries(Object.values(C.TALENT).map((t) => [t.id, { id: t.id, tree: treeId(t.cls, t.tree), tier: t.tier, name: t.name, ranks: t.ranks, spell: t.spell || null, text: TXT.talentText(t.id, CONTENT) }])),
    pets: Object.fromEntries(Object.values(C.PET).map((p) => [p.id, { id: p.id, name: p.name, text: TXT.petText(p.id, CONTENT), meta: p.meta || null, locked: !!p.meta && !(profile && profile.unlocks && profile.unlocks[p.meta]) }])),
    // heal: it restores health (the low-health potion hint, hud.js)
    consumables: Object.fromEntries(Object.values(C.CONSUMABLE).map((c) => [c.id, { id: c.id, name: c.name, use: USE_MAP[c.use] || 'both', stack: c.stack, mana: !!c.mana, heal: !!c.heal, text: TXT.consumableText(c.id, CONTENT, c) }])),
    // names and texts from the UI table; buff or debuff from the engine's DEBUFFS list (rules 7.4). The combat v2 enemy
    // statuses OFF_BALANCE, SAPPED and TRAP never land on the player, so DEBUFFS (what dispersal removes) leaves them out;
    // on an enemy they work against it and show as debuffs (STATUS_INFO.v2).
    statuses: Object.fromEntries(Object.entries(TXT.STATUS_INFO).map(([id, x]) => [id, { ...x, debuff: C.DEBUFFS ? C.DEBUFFS.includes(id) || !!x.v2Debuff : x.debuff }])),
    boons: Object.fromEntries(Object.values(C.BOON).map((b) => [b.id, { id: b.id, name: b.name, text: TXT.boonText(b.id, CONTENT) }])),
    slots: C.SLOT_IDS, zones: CONTENT.zones, camp: CONTENT.camp,
    content: { texts: CONTENT.texts || {} }, // texts.families, .prep, .contracts: the contract and start-camp words (ui-text.js)
    nodeTime: Object.fromEntries(Object.values(C.NODE_TYPE).map((t) => [t.id, t.time])),
    boss: { name: C.BOSS_TEXT.name, intro: (CONTENT.camp && CONTENT.camp.bossText) || '' },
    rules: rulesTable(C),
    // M3 onboarding (m3-onboarding.md 2.4-4.3; onboarding.js): the content's lines (src/content/tutorial.js) and the numbers
    // their placeholders and the hint rules name, from C (never typed into a line)
    tutorial: CONTENT.tutorial ? {
      table: CONTENT.tutorial,
      num: { deathblowTurn: C.SIGNATURE_TURN, bellTolls: C.BELL_CHANNEL_TIME, offbalPct: Math.round((C.OFFBAL_TAKEN || 0) * 100), rescueTolls: C.ONB_RESCUE_TOLLS,
        satchelPotions: C.META.satchel ? C.META.satchel.potions : null, satchelPrice: C.META.satchel ? C.META.satchel.cost || null : null },
      rules: { hintMinMs: C.ONB_HINT_MIN_MS, hintShows: C.ONB_HINT_SHOWS, hintsPerFight: C.ONB_HINTS_PER_FIGHT, queueMax: C.ONB_QUEUE_MAX, potionHp: C.ONB_POTION_HP, fleeHp: C.ONB_FLEE_HP,
        autoplayAfter: C.ONB_AUTOPLAY_AFTER, maxChars: C.ONB_HINT_MAX_CHARS, talentFirst: C.TALENT_FIRST_LEVEL || 10, priority: C.ONB_BEAT_PRIORITY },
    } : null,
    meta: metaData(C),
    v2: v2Data(C),
    dev: devData(C),
  };
  /** A pet that needs a meta unlock (Stormhawk) is locked until the profile owns it; refreshed after every purchase. */
  const refreshPets = () => { for (const pd of Object.values(data.pets)) pd.locked = !!pd.meta && !(profile && (profile.unlocks[pd.meta] || 0) > 0); };
  const consName = (id) => (C.CONSUMABLE[id] ? C.CONSUMABLE[id].name : null);
  // a damage or heal source: a spell, the pet, or a consumable (potions, Spark Flask)
  // (an enemy's DoT carries 'ability@enemyIdx'; talent procs their engine id; both read as names)
  // an enemy's template ability (a wind-up's hit carries its content id) reads as its content name
  const spellName = (id) => actionName(id) || 'an attack';

  // ---------------------------------------------------------------- conversions
  const gearKind = (slot, cls) => (slot === 'weapon' ? { rogue: 'dagger', mage: 'staff', hunter: 'bow' }[cls] : slot === 'offhand' ? { rogue: 'dagger', mage: 'tome', hunter: 'quiver' }[cls] : slot);
  function item(it, cls, extra = {}) {
    if (!it) return null;
    if (it.kind === 'gear') {
      const s = it.stats || {};
      return { uid: it.uid, kind: 'gear', slot: it.slot, gearKind: gearKind(it.slot, cls), name: it.name, rarity: it.rarity, ilvl: it.ilvl,
        stats: { sta: s.STA || 0, agi: s.AGI || 0, int: s.INT || 0, spi: s.SPI || 0, power: it.power || 0, crit: it.crit || 0, armor: (it.armor || 0) + (it.bonusArmor || 0), wd: it.wd || 0 },
        effectText: it.effect ? TXT.UNIQUE_EFFECT_TEXT[it.effect] || null : null, unique: !!it.unique, heatUp: local.heatUp.get(it.uid) || null, _raw: it, ...extra };
    }
    if (it.kind === 'cons') { const c = C.CONSUMABLE[it.id] || { name: it.id, stack: 5 }; return { uid: it.uid, kind: 'consumable', id: it.id, name: c.name, rarity: it.id === 'ember_of_return' ? 'rare' : 'common', count: it.qty, stack: c.stack, use: USE_MAP[c.use] || 'both', _raw: it, ...extra }; }
    return { uid: it.uid, kind: 'junk', id: 'junk', name: it.name, rarity: 'junk', count: it.qty || 1, stack: 10, _raw: it, ...extra };
  }
  /**
   * Statuses for the view, from the engine's status objects (engine-api.md 6: { id, dur, stacks, value, tick, amount, src }).
   * value: the status's number (a WARD's absorb left: its `amount`); tick: damage per tick (per stack for POISON);
   * amount: heal per tick of HOT; full: the duration it was applied with (DoTs); max: stack cap; srcName: what applied it.
   * An enemy's shield is a WARD; an enraged enemy (template ability, rules 12.4) gets ENRAGED with its damage bonus.
   */
  const statuses = (list, f, shield = 0, enraged = 0) => {
    const out = (list || []).map((x) => ({ id: x.id, rounds: x.dur == null ? 99 : x.dur, full: x.full || null, stacks: x.stacks || 1,
      value: x.id === 'WARD' ? x.amount || 0 : x.value || 0, tick: x.tick || 0, amount: x.amount || 0, max: x.max || x.maxStacks || null,
      canCrit: !!x.canCrit, focus: x.focus || 0, srcName: statusSource(x, f),
      // combat v2: a laid trap's spring turn and stun (TRAP), engine-api.md 6
      ...(x.id === 'TRAP' ? { turn: x.turn ?? null, stun: x.stun ?? null } : {}),
      // M2b v13 (engine-api.md 6): EMPOWERED's stacks and value from Deathblows (shown apart: "+100 % (Deathblow)"); MAIMED's
      // Deathblow by name (srcName is the enemy that landed it)
      ...(x.id === 'EMPOWERED' ? { deathblows: x.deathblows || 0, deathblowValue: x.deathblowValue || 0 } : {}),
      ...(x.id === 'MAIMED' ? { ability: x.name || null } : {}) }));
    if (shield > 0 && !out.some((x) => x.id === 'WARD')) out.push({ id: 'WARD', rounds: 99, stacks: 1, value: shield, amount: shield, srcName: null });
    if (enraged > 0) out.push({ id: 'ENRAGED', rounds: 99, stacks: 1, value: enraged, srcName: null });
    return out;
  };
  /** Name of an enemy action (archetype action or template ability) from its id; never the id (actionName). */
  const abilityName = (id) => actionName(id) || 'an attack';
  /** What applied a status: a spell, a talent, equipment, or an enemy's action ('ability@enemyIdx'); null when unknown. */
  function statusSource(x, f) {
    const src = x.src; const foe = (i) => (f && f.enemies[i]) || null;
    if (typeof src === 'string' && src.includes('@')) { const [id, idx] = src.split('@'); const e = foe(Number(idx)); return `${abilityName(id)}${e ? ` (${e.name})` : ''}`; }
    if (src && C.SPELL[src]) return C.SPELL[src].name;
    if (src && SRC_TALENT[src] && C.TALENT[SRC_TALENT[src]]) return C.TALENT[SRC_TALENT[src]].name;
    if (src === 'unique') return 'your equipment';
    if (typeof x.by === 'number' && foe(x.by)) return foe(x.by).name;
    return null;
  }

  // ---------------------------------------------------------------- DoT preview (engine-api.md 6.1; owner 2026-11-11 08:11)
  /** R.pendingTicks of a state, computed once per state (the view asks for each unit). */
  const ticks = { of: null, list: null };
  function ticksOf(s) {
    if (ticks.of !== s) {
      ticks.of = s; ticks.list = null;
      if (s.fight && !s.fight.over && R.pendingTicks) { try { ticks.list = R.pendingTicks(s); } catch { ticks.list = null; } }
    }
    return ticks.list;
  }
  /**
   * A tick's source for the tooltip: the spell or ability by name with its stacks ("Poison ×3"), an enemy's DoT with the
   * enemy ("Rend (Cutpurse)"). st: the unit's statuses.
   */
  function tickName(spell, f, st) {
    const nm = spell === 'poison' ? 'Poison' : actionName(spell) || 'A wound';
    const at = typeof spell === 'string' ? spell.indexOf('@') : -1;
    const e = at >= 0 && f ? f.enemies[Number(spell.slice(at + 1))] : null;
    const x = (st || []).find((y) => (spell === 'poison' ? y.id === 'POISON' : y.src === spell) && (y.stacks || 1) > 1);
    return `${nm}${x ? ` ×${x.stacks}` : ''}${e ? ` (${e.name})` : ''}`;
  }
  /**
   * What the ticks at the end of this round do to a unit if nothing else happens first (R.pendingTicks), or null when they
   * take no HP and absorb nothing: { amount (damage after absorbs), loss (the HP it ends lower: hp - hpAfter, all of it when
   * lethal), hpAfter, heal, absorbed, lethal, resurrect (the engine's source a lethal tick would use), ticks: [{ name, amount,
   * absorbed, immune, sidestep, crit }], crit: { amount, loss, lethal } (every tick that can crit crits) | null }. The HUD
   * marks `loss` as the hatched end of the HP bar, a skull when lethal.
   */
  function dotOf(s, u) {
    const list = ticksOf(s); const x = list && list.find((t) => t.u === u);
    if (!x || (!x.amount && !x.absorbed && !x.lethal)) return null;
    const lossOf = (y) => Math.max(0, x.hp - (y.lethal ? 0 : y.hpAfter));
    return { amount: x.amount, loss: lossOf(x), hpAfter: x.hpAfter, heal: x.heal, absorbed: x.absorbed, lethal: x.lethal, resurrect: x.resurrect || null,
      ticks: x.ticks.map((t) => ({ name: tickName(t.spell, s.fight, u === 'player' ? s.fight.p.st : u === 'pet' ? s.fight.pet.st : s.fight.enemies[u].st), amount: t.amount, absorbed: t.absorbed, immune: !!t.immune, sidestep: !!t.sidestep })),
      crit: x.crit ? { amount: x.crit.amount, loss: lossOf(x.crit), lethal: x.crit.lethal } : null };
  }

  function convPlayer(s) {
    const p = s.player; const d = p.d; const f = s.fight; const cls = C.CLASS[p.classId];
    const kind = cls.resource;
    const res = kind === 'mana' ? { kind, cur: p.mana, max: d.maxMana } : { kind, cur: f ? f.p[kind] : 100, max: f ? f.p[`${kind}Max`] : 100 };
    const spent = {};
    for (const [id, r] of Object.entries(p.talents || {})) { const t = C.TALENT[id]; if (t) { const k = treeId(t.cls, t.tree); spent[k] = (spent[k] || 0) + r; } }
    const bag = (p.bag || []).map((it) => item(it, p.classId));
    while (bag.length < R.bagCapacity(s)) bag.push(null);
    const boons = Object.entries(p.buffs || {}).filter(([, b]) => b && b.left > 0).map(([id, b]) => ({ id, name: id === 'elixir' ? 'Elixir of Ferocity' : (C.BOON[id] || {}).name || id, nodesLeft: b.left }));
    // Resurrect charges (rules 9, M2 v3) from the engine: `resurrect` = what a death would use now, in order (in the
    // end-boss fight without Second Breath); `resurrectHeld` = the charges held; `resurrectBoss` = what works at the boss.
    const rc = R.resurrectCharges(s);
    const resurrect = rc.now.map((x) => RES_KEY[x] || x);
    const resurrectHeld = { boon: rc.boon, meta: rc.secondBreath, ember: rc.ember };
    const resurrectBoss = rc.boss.map((x) => RES_KEY[x] || x);
    return {
      name: p.name, classId: p.classId, className: cls.name, petId: p.pet ? p.pet.id : null,
      level: p.level, xp: p.xp, xpToNext: R.xpToNext(p.level), rested: p.rested || 0, hp: p.hp, maxHp: d.maxHp,
      res, cp: f ? f.p.cp || 0 : 0, cpMax: C.CP_MAX,
      stats: { sta: d.STA, agi: d.AGI, int: d.INT, spi: d.SPI, power: Math.round(d.power), crit: d.crit, critMult: d.critMult, dodge: d.dodge, armor: Math.round(d.armor), wd: d.wd },
      gold: p.gold, equip: Object.fromEntries(Object.entries(p.equipped).map(([k, it]) => [k, item(it, p.classId)])), bag,
      spells: (p.spellOrder || Object.keys(p.spells)).map((id) => ({ id, tl: p.spells[id].tl, rank: p.spells[id].rank })),
      bar: [...p.bar], itemBar: [...p.itemBar], talents: { ...p.talents }, talentPoints: R.talentPointsFree(s), talentSpent: spent,
      statuses: f ? statuses(f.p.st, f) : [], boons, resurrect, resurrectHeld, resurrectBoss, dot: f ? dotOf(s, 'player') : null,
      pet: p.pet ? { id: p.pet.id, name: C.PET[p.pet.id].name, hp: p.pet.hp, maxHp: d.petMaxHp, alive: p.pet.alive, statuses: f && f.pet ? statuses(f.pet.st, f) : [], dot: f && p.pet.alive ? dotOf(s, 'pet') : null } : null,
    };
  }

  function zoneContent(z) { return z >= 1 && z <= C.ZONE_COUNT ? CONTENT.zones[z - 1] : null; }
  /** Zone danger (rules 7.6): the extra damage of an enemy of this level and variant, from the engine's zoneDanger. */
  const dangerOf = (level, variant) => R.zoneDanger(level, variant) - 1;
  /**
   * Zone danger of a fight node's enemies, { lo, hi }, or null: the engine's zoneDanger at the levels and variants it
   * builds the fight with (src/engine/nodes.js): quest and grind at cl; the elite at its level, its escort at cl;
   * dungeon trash at its level and the dungeon boss at its own (M2 v4: DUNGEON_DANGER_FRAC of the bonus).
   */
  function nodeDanger(n) {
    const foes = n.type === 'quest' || n.type === 'grind' ? [[n.cl, 'normal']]
      : n.type === 'elite' ? [[n.level, 'elite'], ...(n.archetypes && n.archetypes.length > 1 ? [[n.cl, 'normal']] : [])]
        : n.type === 'dungeon' ? [[n.level, 'trash'], [n.bossLevel, 'dboss']] : null;
    if (!foes) return null;
    const d = foes.map(([lv, va]) => dangerOf(lv, va));
    return { lo: Math.min(...d), hi: Math.max(...d) };
  }
  function convZone(s) {
    const z = s.zone ? s.zone.z : 1;
    if (z > C.ZONE_COUNT || (s.zone && s.zone.camp)) {
      const camp = CONTENT.camp || {};
      return { idx: C.ZONE_COUNT + 1, id: 'camp', camp: true, name: camp.name || 'Observatory Steps', hubName: camp.name || 'Observatory Steps', hubText: camp.text, blurb: camp.text, theme: 'observatory',
        band: [C.MAX_LEVEL, C.MAX_LEVEL], exitLevel: C.MAX_LEVEL, travelLevel: null, rows: [], pos: { row: 0, lane: null }, path: [], questsDone: 0, storyDone: false,
        danger: dangerOf(C.MAX_LEVEL, 'normal') };
    }
    const zc = zoneContent(z);
    const mv = R.mapView(s);
    if (mv && mv.mode === 'expedition') return convExpZone(s, z, zc, mv);
    const rows = mv ? mv.rows.map((row) => row.map((n) => {
      const out = { row: n.r, lane: n.l, type: n.type, cl: n.cl, visited: !!n.done, title: n.title, level: n.level, danger: nodeDanger(n),
        heat: n.done ? local.nodeHeat.get(`${z}:${n.r}:${n.l}`) || null : null }; // the state the node was entered in (`node` event)
      if (n.archetypes) { out.archetypes = [...n.archetypes]; out.enemyNames = n.archetypes.map(TXT.humanize); } // one entry per enemy (grind: the first wave)
      // combat v2 (rules 7.14): a dungeon's trash fights and boss, a treasure's guard (archetypes [] when unguarded)
      if (n.fights) out.fights = n.fights.map((x) => [...x]);
      if (n.bossArchetype) out.bossArchetype = n.bossArchetype;
      if (n.type === 'treasure') out.guarded = !!n.guarded;
      if (n.type === 'elite') { out.eliteName = n.name || null; out.rare = n.rare; out.deathblow = n.deathblow ? { ...n.deathblow } : null; } // M2b v13: shown with its name
      if (n.type === 'dungeon') { out.dungeon = n.name; out.bossLevel = n.bossLevel; out.bossDeathblow = n.bossDeathblow ? { ...n.bossDeathblow } : null; out.bossName = zc && CONTENT.enemies[zc.dungeon.boss] ? CONTENT.enemies[zc.dungeon.boss].name : ''; }
      if (n.type === 'quest' && n.title) { const q = Object.values(CONTENT.quests).find((x) => x.title === n.title); if (q) out.giver = q.giver; }
      return out;
    })) : [];
    const path = (s.zone.path || []).map((lane, i) => ({ row: i + 1, lane }));
    const exitLevel = C.ZONE_LEVELS * z; // rules 1.3: a zone's band ends at its exit level
    return { idx: z, id: `z${z}`, camp: false, name: zc ? zc.name : `Zone ${z}`, hubName: zc ? zc.hubName : 'Hub', hubText: zc ? zc.hubText : '', blurb: zc ? zc.theme : '',
      theme: THEMES[z - 1] || 'farmland', band: [exitLevel - C.ZONE_LEVELS + 1, exitLevel], exitLevel, travelLevel: R.travelLevel(s) ?? exitLevel, rows,
      pos: { row: s.zone.pos.r, lane: s.zone.pos.l }, path, questsDone: s.zone.questsDone || 0, storyDone: !!s.zone.storyDone, next: mv ? mv.next : [],
      travelTime: travelTime(s), danger: dangerOf(exitLevel, 'normal') };
  }
  /**
   * An expedition zone (rules 1.9; the default map since D116): the rows view is empty and `exp` is the
   * engine's mapView (engine-api.md 10.3) with each node's entry heat state when it was visited (`node` event).
   */
  function convExpZone(s, z, zc, mv) {
    const exitLevel = C.ZONE_LEVELS * z;
    const nodes = mv.nodes.map((n) => ({ ...n, heat: n.done ? local.nodeHeat.get(`${z}:#${n.id}`) || null : null }));
    return { idx: z, id: `z${z}`, camp: false, name: zc ? zc.name : mv.name || `Zone ${z}`, hubName: zc ? zc.hubName : 'Hub', hubText: zc ? zc.hubText : '', blurb: zc ? zc.theme : '',
      theme: THEMES[z - 1] || 'farmland', band: [exitLevel - C.ZONE_LEVELS + 1, exitLevel], exitLevel, travelLevel: null, rows: [], pos: { row: 0, lane: null }, path: [],
      questsDone: s.zone.questsDone || 0, storyDone: !!s.zone.storyDone, next: [], travelTime: null, danger: dangerOf(exitLevel, 'normal'),
      exp: { ...mv, nodes } };
  }
  /** Tolls TRAVEL_ON spends now, from a dry step; null while it is not legal. */
  function travelTime(s) {
    if (s.phase !== 'MAP' || !R.isLegal(s, { type: 'TRAVEL_ON' })) return null;
    try { return R.step(s, { type: 'TRAVEL_ON' }).state.time - s.time; } catch { return null; }
  }

  // The end boss is kind 'boss'; a dungeon boss is kind 'dboss' (both carry boss: true, engine-api.md 6), so the rank
  // reads the kind: a dungeon boss is drawn and framed as itself, not as the end boss.
  const rankOf = (e) => (e.kind === 'boss' ? 'boss' : e.kind === 'shard' ? 'shard' : e.kind || 'normal');
  function fightKey(s) { const n = s.node; return `${s.zone ? s.zone.z : 0}:${n ? `${n.r}:${n.l}` : `t${s.time}`}:${s.fight ? s.fight.k : 0}:${s.fight ? s.fight.kind : ''}`; }
  const INTENT_LABEL = { curse: 'Curse: you deal less damage', brace: 'Braces: takes less damage', shieldAlly: 'Shields an ally', heal: 'Heals an ally', selfHeal: 'Heals itself',
    selfShield: 'Shields itself', summon: 'Calls for help', cleave: 'Hits you and your pet', rend: 'Hit and bleed', bolster: 'Shields its weakest ally', signal: 'Calls a reinforcement' };
  const SUPPORT = ['selfHeal', 'heal', 'selfShield', 'shieldAlly', 'brace', 'summon', 'bolster', 'signal'];
  /** View target of an intent or track entry: 'player', 'pet', 'both' (all), 'self', 'ally' (an ally's index in allyIdx). */
  const viewTarget = (t) => (t === 'all' ? 'both' : typeof t === 'number' ? 'ally' : t || 'player');
  function convIntent(it, e) {
    if (!it) return null;
    if (it.kind === 'boss') {
      const acts = it.actions || [];
      const lit = acts.find((a) => a.id === 'collapse_litany');
      const tg = it.telegraph || {};
      return { id: 'boss', name: acts.map((a) => a.name).join(' + ') || it.name, target: it.target || 'player', est: it.est || 0, cast: !!it.cast, heavy: !!it.heavy,
        channel: lit && lit.step ? [lit.step, 2] : null, label: lit && lit.step === 2 ? 'Resolves this round' : null,
        next: tg.crushNextRound ? 'Gravity Crush next round' : null, school: 'shadow', telegraph: tg, interrupted: !!it.interrupted, turn: it.turn ?? null };
    }
    const tgt = viewTarget(it.target);
    const none = it.kind === 'none';
    return { id: none ? (it.name === 'Unaware' ? 'unaware' : 'none') : it.id, name: it.name, kind: it.kind, target: none ? 'none' : tgt, allyIdx: typeof it.target === 'number' ? it.target : null,
      est: none ? 0 : it.est || 0, cast: !!it.cast, heavy: !!it.heavy, school: it.school || 'phys', hits: it.hits || 1, label: INTENT_LABEL[it.kind] || null,
      interrupted: !!(it.interrupted || it.skipped), turn: it.turn ?? null, scripted: !!it.scripted,
      selfHeal: it.kind === 'selfHeal', mend: it.kind === 'heal', shield: it.kind === 'selfShield', brace: it.kind === 'brace', curse: it.kind === 'curse',
      bolster: it.kind === 'bolster', signal: it.kind === 'signal', summon: it.kind === 'summon', shieldAlly: it.kind === 'shieldAlly',
      support: SUPPORT.includes(it.kind),
      // combat v2.1 (rules 7.12): this round's action is a wind-up; M2b v13: a Deathblow, a first meeting's wind-up
      windup: !!it.windup, deathblow: !!it.deathblow, firstMeet: !!it.firstMeet,
      // combat v2 (engine-api.md 6): control cancelled this turn's action, or the entry could not be played; combat v2.1:
      // `windup` on either when the action that did not happen was a wind-up
      cancelled: it.cancelled ? { by: it.cancelled.by, id: it.cancelled.id, name: it.cancelled.name, cast: !!it.cancelled.cast, heavy: !!it.cancelled.heavy, windup: !!it.cancelled.windup } : null,
      replaced: it.replaced ? { id: it.replaced.id, name: it.replaced.name, reason: it.replaced.reason, windup: !!it.replaced.windup } : null };
  }

  // ---------------------------------------------------------------- combat v2: intent track, roles (docs/specs/combat-v2.md 3, 4, 10)
  /** Control statuses that cancel an enemy's now-entry (engine-api.md 6: intent.cancelled.by); HEXED and SAPPED break on damage. */
  const CONTROL = ['STUN', 'FROZEN', 'HEXED', 'SAPPED'];
  const BREAKS = new Set(['HEXED', 'SAPPED']);
  /**
   * An enemy's intent track for the view (rules 7.11), oldest first, or null (no track: dead, an older engine, the mock).
   * Entry: { turn, round, id, name, kind, cast, heavy, scripted, signature, school, hits, target, allyIdx, est, support,
   * now, cancel, replaced, boss }. round: the fight round the entry plays in (its turn0 + turn - 1). now: the entry it plays
   * this round (its current turn; none in the engage round or before an add's turn 1); it shows the intent as it will be
   * played (a replaced entry shows the basic attack and why). signature: a template ability on a scripted turn (rules 7.12).
   * cancel { by, offBalance, breaks, done }: the engine's prediction on the entry (D52, engine-api.md 6: the now-entry
   * that control cancelled, a later entry a control status still covers, the turns a laid trap's STUN covers). Without it
   * (the mock engine) it is inferred: the now-entry from intent.cancelled, later entries from the control status's rounds
   * left (rules 7.4: a status with n rounds left is on at the start of the next n - 1 rounds), the trap from TRAP.turn.
   * breaks: SAPPED and HEXED end on any damage. offBalance: the cancelled entry is a heavy or a cast (rules 7.13).
   * The end boss's entries (rules 10.3) carry boss { actions, brand, shards, ifPhase, alt }.
   * Combat v2.1 (rules 7.12): windup = the entry is a wind-up (the engine's flag, set from the round it enters the track;
   * a replaced now-entry keeps it: the wind-up that did not happen); heavy and cast are the ability's own flags (a wind-up
   * always has cast). cancel.stagger: the predicted cancel answers the wind-up (D52: the engine's `stagger`).
   */
  function convTrack(e, f) {
    if (!e.alive || !Array.isArray(e.track) || !e.track.length) return null;
    const T = e.turn || 0; // 0 before its turn 1: every entry is still to come
    const ctl = CONTROL.map((id) => (e.st || []).find((x) => x.id === id)).find(Boolean);
    const trap = (e.st || []).find((x) => x.id === 'TRAP');
    const it = e.intent || {};
    return e.track.map((x) => {
      const round = (e.turn0 || 1) + x.turn - 1;
      const now = T >= 1 && x.turn === T;
      if (e.kind === 'boss' || x.actions) {
        const acts = x.actions || [];
        const anyAll = acts.some((a) => a.target === 'all');
        return { turn: x.turn, round, id: 'boss', name: acts.map((a) => a.name).join(' + ') || e.name, kind: 'boss', cast: !!x.cast, heavy: !!x.heavy, scripted: false,
          signature: false, school: 'shadow', hits: 1, target: anyAll ? 'both' : viewTarget(x.target), allyIdx: null, est: x.est || 0, support: false, now,
          cancel: null, replaced: null, boss: { actions: acts.map((a) => ({ id: a.id, name: a.name, est: a.est || 0, cast: !!a.cast, heavy: !!a.heavy, target: viewTarget(a.target) })),
            brand: !!x.brand, shards: !!x.shards, ifPhase: x.ifPhase ?? null, alt: x.alt ? x.alt.map((a) => a.name) : null } };
      }
      let src = x;
      let replaced = null;
      if (now && it.replaced && !it.cancelled) { src = it; replaced = { from: it.replaced.name, reason: it.replaced.reason }; }
      let cancel = null;
      const wu = !!x.windup;
      if ('cancel' in x) { // D52: the engine predicts it
        if (x.cancel) cancel = { by: x.cancel.by, offBalance: !!x.cancel.offBalance, breaks: !!x.cancel.breaks, stagger: !!x.cancel.stagger, ...(x.cancel.done ? { done: true } : {}) };
      } else if (now && it.cancelled) cancel = { by: it.cancelled.by, offBalance: !!(it.cancelled.cast || it.cancelled.heavy), breaks: false, stagger: wu, done: true };
      else if (trap && trap.turn === x.turn && x.turn >= T) cancel = { by: 'TRAP', offBalance: !!(x.cast || x.heavy), breaks: false, stagger: wu };
      else if (ctl && ctl.dur != null && x.turn >= Math.max(1, T) && x.turn - Math.max(1, T) < ctl.dur - (T >= 1 ? 0 : 1)) cancel = { by: ctl.id, offBalance: !!(x.cast || x.heavy), breaks: BREAKS.has(ctl.id), stagger: wu };
      const sig = !!(x.scripted && CONTENT.abilities && CONTENT.abilities[x.id]);
      // what it shows: the intent as it will be played for the now-entry (target and estimate of this round), the entry
      // itself otherwise and for a cancelled now-entry (the action that will not happen, struck through)
      const live = now && !cancel;
      let tg = live && it.target != null ? it.target : x.target;
      if (tg === e.idx) tg = 'self'; // Mend or Bolster on the weakest ally when that is itself
      return { turn: x.turn, round, id: src.id, name: src.name, kind: src.kind, cast: !!src.cast, heavy: !!src.heavy, scripted: !!x.scripted, signature: sig,
        school: src.school || 'phys', hits: src.hits || 1, target: viewTarget(tg), allyIdx: typeof tg === 'number' ? tg : null,
        est: (live ? it.est : x.est) || 0, support: SUPPORT.includes(src.kind), now, cancel, replaced, boss: null,
        // combat v2.1: the wind-up flag, and the wind-up's own name and heavy flag when the shown action replaced it
        windup: wu, ...(wu && src !== x ? { windupOf: { id: x.id, name: x.name, heavy: !!x.heavy } } : {}),
        // M2b v13 (rules 7.12): the entry is a Deathblow (its est includes DEATHBLOW_MULT), or a first meeting's wind-up
        deathblow: !!x.deathblow, firstMeet: !!x.firstMeet };
    });
  }
  /**
   * An enemy's role (combat v2, rules 7.12) for the badge: { id: archetype, ward (a guardian: its ward's index), guardedBy
   * (the guardians whose ward it is), bloodlust (a beast: min(BLOODLUST_MAX, BLOODLUST_STEP × turns acted), engine-api.md 6),
   * lookout (a skulker whose track holds Signal: the round it signals) }; null for the end boss and Shards.
   */
  function convRole(e, f, track) {
    if (!e.arch || !C.ARCHETYPE || !C.ARCHETYPE[e.arch]) return null;
    const r = { id: e.arch, ward: null, guardedBy: [], bloodlust: null, lookout: null };
    const live = (i) => i != null && f.enemies[i] && f.enemies[i].alive;
    if (e.arch === 'guardian' && live(e.ward)) r.ward = e.ward;
    r.guardedBy = f.enemies.filter((g) => g.alive && g.arch === 'guardian' && g.ward === e.idx && g.idx !== e.idx).map((g) => g.idx);
    if (e.arch === 'beast' && C.BLOODLUST_STEP != null) r.bloodlust = Math.min(C.BLOODLUST_MAX, C.BLOODLUST_STEP * (e.acted || 0));
    const sig = (track || []).find((x) => x.kind === 'signal' && !x.cancel);
    if (sig) r.lookout = sig.round;
    return r;
  }
  /** Living Dimming Shards and the Linked damage reduction they give the boss now (rules 10.2), or null. */
  function linkedOf(f) {
    if (!f.boss) return null;
    const n = f.enemies.filter((e) => e.alive && e.kind === 'shard').length;
    return { shards: n, dr: data.rules.linkDr[Math.min(n, data.rules.linkDr.length - 1)] };
  }
  function convFight(s) {
    const f = s.fight; if (!f) return null;
    const key = fightKey(s);
    const enemies = f.enemies.map((e) => {
      const track = convTrack(e, f);
      let ob = null;
      if (e.alive && R.offBalance) { try { ob = R.offBalance(s, e.idx); } catch { ob = null; } }
      return { idx: e.idx, uid: `${key}:${e.idx}`, tplId: e.tid, name: e.name, level: e.level, rank: rankOf(e), arch: e.arch || (e.kind === 'boss' ? 'boss' : 'shard'),
        hp: e.hp, maxHp: e.maxHp, alive: e.alive, statuses: statuses(e.st, f, e.shield, e.enraged), intent: e.alive ? convIntent(e.intent, e) : null,
        track, role: e.alive ? convRole(e, f, track) : null, offBalance: ob ? { status: ob.status, taken: ob.taken, crit: ob.crit, rounds: ob.rounds, shield: ob.shield || 0, absorbs: !!ob.absorbs } : null,
        ccImmune: !!e.ccImmune, firstMeet: !!e.firstMeet, turn: e.turn || 0, added: !!(e.summoned || e.noReward || (e.unscripted && e.kind !== 'boss' && e.kind !== 'shard')),
        dot: e.alive ? dotOf(s, e.idx) : null }; // the DoT preview (engine-api.md 6.1)
    });
    const cds = {};
    for (const [id, ready] of Object.entries(f.p.cds || {})) { const left = ready - f.round; if (left > 0) cds[id] = left; }
    const firstAlive = enemies.find((e) => e.alive);
    const bossE = f.enemies.find((e) => e.kind === 'boss');
    const n = s.node;
    let title = ''; let fights = 1;
    if (n && n.type === 'dungeon') { fights = C.DUNGEON_TRASH_FIGHTS + 1; title = (zoneContent(s.zone.z) || { dungeon: { name: 'Dungeon' } }).dungeon.name; }
    if (n && n.type === 'grind') { fights = n.planned || 1; title = `Wave ${(n.wavesDone || 0) + 1} of ${n.planned}`; }
    return { round: f.round, enemies, target: f.p.target != null && enemies[f.p.target] && enemies[f.p.target].alive ? f.p.target : firstAlive ? firstAlive.idx : 0,
      cooldowns: cds, potionCd: Math.max(0, (f.p.potionReady || 0) - f.round), kind: f.kind === 'trash' ? 'dungeon' : f.kind, isBoss: f.kind === 'boss',
      boss: f.boss ? { phase: f.boss.phase, asc: f.boss.asc || 0, telegraph: bossE && bossE.intent ? bossE.intent.telegraph : null, linked: linkedOf(f) } : null,
      over: f.over, canFlee: f.canFlee, title, fightNo: (f.k || 0) + 1, fights, engage: engageView(s), hasEngage: !!f.engage,
      windups: windupsOf(s), autoEngage: autoEngageOf(s) };
  }
  /**
   * M2b v13 (engine-api.md 6.2): every wind-up on the living enemies' tracks with its Deathblow flag, estimate, stakes and
   * answers (R.windupView), a copy; [] on an engine before v13. The badges, the bar and the engage cards read it; never
   * computed here.
   */
  function windupsOf(s) {
    if (!R.windupView || s.fight.over) return [];
    try { return JSON.parse(JSON.stringify(R.windupView(s) || [])); } catch { return []; }
  }
  /**
   * Autoplay's engage answer (R.autoplayEngage, rule E2): { option, name, target, enemy, windup, wait } or null; the hint reads
   * it. M2b v14: `wait` when autoplay will then wait a round (rule H: Sap cancels the Deathblow).
   */
  function autoEngageOf(s) {
    if (!R.autoplayEngage || s.fight.over) return null;
    try { const a = R.autoplayEngage(s); return a ? { option: a.option, name: a.name, target: a.target, enemy: a.enemy, windup: { ...a.windup }, wait: !!a.wait } : null; } catch { return null; }
  }
  /**
   * The engage round (rules 7.10, combat v2) for the engage panel, or null outside it: R.engageOptions in the class order
   * strike, control, setup, each with its key (Q, W, E). Hover previews come from bridge.engagePreview (R.engagePreview).
   * Combat v2.1: disrupt = the targets on which a control option is Disrupt (R.engageOptions `disrupt`); why = for each
   * living enemy the option may not take, the engine's reason (R.whyIllegal of that ENGAGE: e.g. a dungeon boss that
   * shows no wind-up), so the panel greys the option out with it while that enemy is the target.
   */
  function engageView(s) {
    if (!R.isEngageRound || !R.isEngageRound(s)) return null;
    let opts = null;
    try { opts = R.engageOptions(s); } catch { opts = null; }
    if (!opts) return null;
    const live = s.fight.enemies.filter((e) => e.alive).map((e) => e.idx);
    const whyNot = (o) => {
      const eo = C.ENGAGE_OPTION[o.id] || {};
      if (o.spells || !(eo.target === 'enemy' || eo.target === 'control')) return {};
      const out = {};
      for (const t of live) {
        if ((o.targets || []).includes(t)) continue;
        let r = null;
        try { r = R.whyIllegal(s, { type: 'ENGAGE', option: o.id, target: t }); } catch { r = null; }
        if (r) out[t] = cap(r);
      }
      return out;
    };
    return { options: opts.map((o, i) => ({ id: o.id, kind: o.kind, name: o.name, key: ENGAGE_KEYS[i] || null, targets: [...(o.targets || [])],
      spells: o.spells ? o.spells.map((x) => ({ spellId: x.spellId, targets: [...x.targets] })) : null, reason: o.reason ? cap(o.reason) : null,
      disrupt: [...(o.disrupt || [])], why: whyNot(o) })) };
  }

  // a node of today's map by row and lane; an expedition node (rules 1.9) by its id
  function nodeKey(s) { return s.node ? `${s.zone.z}:${s.node.id != null ? `#${s.node.id}` : `${s.node.r}:${s.node.l}`}` : ''; }
  const NEEDS_INTRO = new Set(['quest', 'elite', 'dungeon', 'treasure']);
  function convStock(s) {
    const cls = s.player.classId;
    return (s.service.stock || []).map((x, i) => {
      if (x.kind === 'cons') { const c = C.CONSUMABLE[x.id]; return { uid: `stock${i}`, kind: 'consumable', id: x.id, name: c.name, rarity: x.id === 'ember_of_return' ? 'rare' : 'common', count: 1, price: x.price, sold: !!x.sold }; }
      return { ...item(x.item, cls), price: x.price, sold: !!x.sold };
    });
  }
  function lineFor(list, s) { return list && list.length ? list[hash(nodeKey(s)) % list.length] : ''; }
  function convNode(s) {
    if (s.service && (s.phase === 'ZONE_HUB' || s.phase === 'CAMP')) return { type: s.service.kind, origin: 'hub', step: s.service.kind, cl: s.service.cl, stock: s.service.kind === 'vendor' ? convStock(s) : null };
    if (s.phase === 'CAMP' && s.fight) return { type: 'camp_grind', step: 'combat', cl: C.CAMP_GRIND_LEVEL, origin: 'camp', fightNo: 1 };
    const n = s.node; if (!n) return null;
    const zc = zoneContent(s.zone.z);
    // heat: the state the node was entered in, which fixes what it pays (rules 1.7.3); id: an expedition node (rules 1.9)
    const v = { type: n.type, row: n.r, lane: n.l, id: n.id ?? null, cl: n.cl, fightNo: (n.k || 0) + 1, waves: n.wavesDone || 0, wavesChosen: n.planned || 0, heat: n.heat || null };
    const f = s.fight;
    if (n.stage === 'fight') v.step = NEEDS_INTRO.has(n.type) && (n.k || 0) === 0 && !local.introSeen.has(nodeKey(s)) ? 'intro' : 'combat';
    else if (n.stage === 'grindSetup') v.step = 'intro';
    else if (n.stage === 'between') v.step = 'between';
    else if (n.stage === 'service') { v.step = s.service.kind; v.stock = s.service.kind === 'vendor' ? convStock(s) : null; }
    else if (n.stage === 'reward') { const r0 = n.rewards[0]; v.step = r0.kind === 'boons' ? 'shrine' : r0.story ? 'story' : 'reward'; if (r0.kind === 'boons') v.boons = r0.boons.map((id) => ({ id, name: C.BOON[id].name, text: TXT.boonText(id, CONTENT) })); }
    if (n.type === 'quest') { const q = CONTENT.quests[n.quest] || {}; Object.assign(v, { questId: n.quest, title: q.title, giver: q.giver, text: q.text, turnIn: q.turnIn }); }
    if (f) v.mobs = f.enemies.filter((e) => !e.summoned).map((e) => ({ name: e.name, level: e.level }));
    if (n.type === 'grind' && !f) { const mn = convZone(s).rows[n.r - 1]; v.mobs = ((mn && mn[n.l] && mn[n.l].enemyNames) || []).map((nm) => ({ name: nm })); }
    if (n.type === 'elite' && f) { const e0 = f.enemies[0]; v.eliteName = e0.name; v.rare = e0.kind === 'rare'; v.elite = { text: (CONTENT.enemies[e0.tid] || {}).text || '' }; const add = f.enemies[1]; v.add = add ? { name: add.name } : null; }
    if (n.type === 'dungeon' && zc) { v.dungeon = zc.dungeon.name; v.dungeonText = zc.dungeon.text; v.bossName = (CONTENT.enemies[zc.dungeon.boss] || {}).name || 'the boss'; }
    if (n.type === 'treasure') { v.text = lineFor(zc && zc.treasureLines, s); if (f) v.guard = { name: f.enemies[0].name }; }
    if (n.type === 'shrine') v.text = lineFor(zc && zc.shrineLines, s);
    return v;
  }

  function convLegal(s) {
    const acts = s.phase === 'ENDED' ? [] : R.legalActions(s);
    const has = (t, pred) => acts.some((a) => a.type === t && (!pred || pred(a)));
    const L = { lanes: [], travelOn: has('TRAVEL_ON'), mustTravel: false, outOfCombat: !s.fight, spells: {}, items: [], attack: has('ATTACK'), flee: has('FLEE'), services: {}, talents: {}, trainer: null };
    if (s.fight) { try { L.fleeChance = R.fleeChance(s); } catch { /* older engine */ } }
    const p = s.player; if (!p) return L;
    // today's map: the reachable lanes; an expedition map (rules 1.9) has its moves in zone.exp (mapView)
    if (s.phase === 'MAP') { const mv = R.mapView(s); L.lanes = mv && mv.next ? [...mv.next] : []; L.mustTravel = L.travelOn && !L.lanes.length; }
    for (const svc of ['trainer', 'vendor', 'inn']) L.services[svc] = has('SERVICE', (a) => a.service === svc);
    const f = s.fight;
    const tgt = f ? (f.enemies.find((e) => e.alive) || { idx: 0 }).idx : 0;
    // OFF_BALANCE windows (combat v2, rules 7.13): which enemies a bar spell would hit inside a window (R.spellInfo window)
    const open = f && R.offBalance ? f.enemies.filter((e) => e.alive && (() => { try { return !!R.offBalance(s, e.idx); } catch { return false; } })()).map((e) => e.idx) : [];
    const windowOf = (id) => {
      if (!open.length || !p.bar.includes(id)) return null;
      try {
        if (C.SPELL[id] && C.SPELL[id].target === 'all') return R.spellInfo(s, id, null).window ? 'all' : null;
        const w = open.filter((i) => { const info = R.spellInfo(s, id, i); return !!(info && info.window); });
        return w.length ? w : null;
      } catch { return null; }
    };
    for (const id of Object.keys(p.spells)) {
      if (!f) { L.spells[id] = { ok: false, reason: 'Only in combat' }; continue; }
      const ok = has('CAST', (a) => a.spellId === id);
      const cd = f.p.cds && f.p.cds[id] ? Math.max(0, f.p.cds[id] - f.round) : 0;
      if (ok) L.spells[id] = { ok: true, cd, window: windowOf(id) };
      else {
        const target = C.SPELL[id] && C.SPELL[id].target === 'enemy' ? tgt : null;
        L.spells[id] = { ok: false, cd, window: null, reason: p.bar.includes(id) ? castReason(s, R.whyIllegal(s, { type: 'CAST', spellId: id, target }) || 'Not usable now') : 'Not on the action bar' };
      }
    }
    L.items = p.itemBar.map((id, slot) => {
      if (!id) return { ok: false, reason: 'Empty', count: 0 };
      const count = p.bag.reduce((a, it) => a + (it.kind === 'cons' && it.id === id ? it.qty : 0), 0);
      const cd = f ? Math.max(0, (f.p.potionReady || 0) - f.round) : 0;
      const ok = f ? has('USE_ITEM', (a) => a.slot === slot) : has('USE_ITEM', (a) => a.itemId === id);
      const reason = ok ? null : count ? reasonOf(R.whyIllegal(s, f ? { type: 'USE_ITEM', slot, target: null } : { type: 'USE_ITEM', itemId: id }) || 'Not usable now') : 'None left';
      // free (M2b v6, rules 7.5): Packed Satchel's free potion of this fight is unused (R.freePotion) and this is a potion
      const potion = !!(C.CONSUMABLE[id] && C.CONSUMABLE[id].potion);
      const free = !!(f && potion && R.freePotion && (() => { try { return R.freePotion(s); } catch { return false; } })());
      // M2b v8 (rules 7.5): what one use restores now, from the engine (the free potion at FREE_POTION_MULT); never computed here
      const info = R.potionInfo ? (() => { try { return R.potionInfo(s, id); } catch { return null; } })() : null;
      // M2b v13 (rules 7.5): maim = the MAIMED share while the player is MAIMED (heal is then the cut amount), else 0
      return { ok, reason, count, cd: potion ? cd : 0, free, mult: info ? info.mult : null, heal: info ? info.heal : null, mana: info ? info.mana : null, maim: info ? info.maim || 0 : 0 };
    });
    const cls = p.classId;
    for (const t of Object.values(C.TALENT)) {
      if (t.cls !== cls) continue;
      const rank = p.talents[t.id] || 0;
      const tree = treeId(cls, t.tree);
      const spentTree = Object.entries(p.talents).filter(([k]) => C.TALENT[k] && C.TALENT[k].tree === t.tree && C.TALENT[k].cls === cls).reduce((a, [, r]) => a + r, 0);
      const need = 4 * (t.tier - 1);
      const canSpend = has('SPEND_TALENT', (a) => a.talentId === t.id);
      L.talents[t.id] = { canSpend, rank, need, spentTree, tree, locked: spentTree < need, reason: canSpend ? null : rank >= t.ranks ? 'Maxed' : spentTree < need ? `Requires ${need} points in this tree` : reasonOf(R.whyIllegal(s, { type: 'SPEND_TALENT', talentId: t.id })) };
    }
    if (s.service && s.service.kind === 'trainer') L.trainer = trainerList(s, has);
    return L;
  }

  function dryCost(s, action) {
    try { const r = R.step(s, action); return s.player.gold - r.state.player.gold; } catch { return null; }
  }
  /**
   * The heat meter's data (engine-api.md 11.1): R.heatView with the previews keyed by heatKey(action) (`next`) and in the
   * engine's order (`list`); null before START_RUN, after the run, or on an engine without heat.
   */
  function heatOf(s) {
    if (!R.heatView || !s.player) return null;
    let hv = null;
    try { hv = R.heatView(s); } catch { hv = null; }
    if (!hv) return null;
    const list = (hv.next || []).map((x) => ({ ...x, key: heatKey(x.action) }));
    return { ...hv, bar: { ...hv.bar }, node: hv.node ? { ...hv.node } : null, list, next: Object.fromEntries(list.map((x) => [x.key, x])) };
  }
  /** The start camp screen's data (R.prepView, engine-api.md 13.2), a copy; null outside PREP or on an engine without it. */
  function prepOf(s) {
    if (!R.prepView) return null;
    try { const pv = R.prepView(s); return pv ? JSON.parse(JSON.stringify(pv)) : null; } catch { return null; }
  }
  /**
   * The contract tracker (R.contractView, engine-api.md 13.3), a copy: every contract of the run with its status and the
   * hub offer with its legal modes. null in a run without the start camp. Never names a site's node.
   */
  function contractsOf(s) {
    if (!R.contractView || !s.player) return null;
    try { const cv = R.contractView(s); return cv ? JSON.parse(JSON.stringify(cv)) : null; } catch { return null; }
  }
  /** The boss's Ascendancy if the player faced it now: read from a dry FIGHT_BOSS step, not recomputed here. */
  function dryBossAsc(s) {
    try { const f = R.step(s, { type: 'FIGHT_BOSS' }).state.fight; return f && f.boss ? f.boss.asc : null; } catch { return null; }
  }
  function trainerList(s, has) {
    const p = s.player;
    const list = Object.values(C.SPELL).filter((sp) => sp.cls === p.classId && (sp.source === 'class' || has('LEARN', (a) => a.spellId === sp.id)) && sp.source !== 'talent').sort((a, b) => a.lvl - b.lvl);
    return list.map((sp) => {
      const k = p.spells[sp.id];
      if (k) {
        if (k.tl >= p.level) return { id: sp.id, name: sp.name, lvl: sp.lvl, state: 'current', rank: k.rank, tl: k.tl };
        const ok = has('TRAIN', (a) => a.spellId === sp.id);
        return { id: sp.id, name: sp.name, lvl: sp.lvl, state: 'trainable', rank: k.rank, tl: k.tl, cost: ok ? dryCost(s, { type: 'TRAIN', spellId: sp.id }) : null, affordable: ok };
      }
      if (sp.lvl > p.level) return { id: sp.id, name: sp.name, lvl: sp.lvl, state: 'locked' };
      const ok = has('LEARN', (a) => a.spellId === sp.id);
      return { id: sp.id, name: sp.name, lvl: sp.lvl, state: 'learnable', cost: ok ? dryCost(s, { type: 'LEARN', spellId: sp.id }) : null, affordable: ok };
    });
  }

  function convSummary(s) {
    const sm = s.result ? s.result.summary : R.summary(s);
    if (!sm) return null;
    const z = sm.reached || {};
    const zc = zoneContent(z.zone || 1);
    // the killing blow's name (actionName: a content ability by its content name, never its id; null: unnamed)
    const death = sm.death ? { killer: sm.death.killer ? sm.death.killer.name : 'unknown', ability: actionName(sm.death.killer ? sm.death.killer.ability : null), node: sm.death.nodeType || '', round: sm.death.round } : null;
    return {
      outcome: sm.outcome, name: sm.name, classId: sm.classId, className: sm.className, petId: sm.petId, level: sm.level, xp: sm.xp,
      zone: z.camp ? ((CONTENT.camp && CONTENT.camp.name) || 'the camp') : zc ? zc.name : '', zoneIdx: z.camp ? 7 : z.zone, row: z.camp ? 0 : z.row,
      time: sm.time, asc: sm.ascendancy || 0, seed: sm.seed, death, kills: sm.kills, quests: sm.quests, story: sm.stories, dungeons: sm.dungeons,
      fights: sm.fights, rounds: sm.rounds, goldEarned: sm.gold.earned, goldSpent: sm.gold.spent, potions: sm.potionsUsed, resurrects: sm.resurrectsUsed,
      dealt: sm.damage.dealt, taken: sm.damage.taken, topSpells: (sm.topSpells || []).map((t) => [spellName(t.id), t.dmg]),
      equipped: (sm.equipped || []).map((e) => ({ uid: `sum-${e.slot}`, kind: 'gear', slot: e.slot, name: e.name, rarity: e.rarity, ilvl: e.ilvl, stats: {} })),
      estMinutes: { manual: Math.round(sm.minutes.manual), auto: Math.round(sm.minutes.autoplay) }, bossPhase: sm.bossPhase,
      // the welcome (M3, m3-onboarding.md 4.2): its label from content (nudge.welcomeLabel); [label, Echoes, line id]
      echoes: ((sm.echoes && sm.echoes.lines) || []).map((l) => [`${l.id === 'welcome' && CONTENT.tutorial ? CONTENT.tutorial.nudge.welcomeLabel : TXT.ECHO_LINE[l.id] || TXT.humanize(l.id)}${l.count > 1 ? ` (${l.count})` : ''}`, l.echoes, l.id]),
      // heat (rules 1.7.4, engine-api.md 11.3): the zone track, tolls / nodes / fights won by state, the Echo line's
      // Echoes; par: the run's boss par (R.bossPar) for "tolls over par"
      heat: sm.heat ? { trackPerZone: sm.heat.trackPerZone.map((r) => ({ ...r })), timeByState: [...sm.heat.timeByState], nodesByState: [...sm.heat.nodesByState],
        fightsByState: [...sm.heat.fightsByState], echoHeat: sm.heat.echoHeat || 0 } : null,
      par: R.bossPar(s), reachedCamp: !!z.camp, reachedBoss: !!sm.reachedBoss,
      echoTotal: sm.echoes ? sm.echoes.total : 0,
      // Oaths (rules 11.5): the engine's multiplier on the sum of the lines
      echoMult: sm.echoes ? sm.echoes.oathMult : 1, oaths: (sm.oaths || []).map((o) => (C.OATH[o] ? C.OATH[o].name : TXT.humanize(o))),
      // a dev run (engine-api.md 12): no Echoes; withheld = what it would have earned
      dev: sm.dev ? { god: !!sm.dev.god, tools: [...sm.dev.tools], withheld: (sm.echoes && sm.echoes.withheld) || 0 } : null,
      // contracts (expedition.md 8.1; prep): taken, completed, expired, abandoned, held, bought, reserve; null without
      contracts: sm.expedition && sm.expedition.contracts ? JSON.parse(JSON.stringify(sm.expedition.contracts)) : null,
    };
  }

  // ---------------------------------------------------------------- meta progression (rules 11)
  // Dry steps answer "what would the engine do": START_RUN for the run about to start, END_RUN for the profile a run
  // will leave. Each result is kept for the state it was computed from (step() returns a new state every time).
  const dry = { nextOf: null, next: null, afterOf: null, after: null };
  /** The next run, from a dry START_RUN of the CREATE state: the engine's run modifiers (state.meta) for this class. */
  function nextRun(s) {
    if (dry.nextOf === s) return dry.next;
    let out = null;
    try {
      const r = R.step(s, { type: 'START_RUN' }).state;
      const sm = R.summary(r);
      const count = (id) => (r.player.bag || []).reduce((a, it) => a + (it.kind === 'cons' && it.id === id ? it.qty : 0), 0);
      out = {
        classId: r.player.classId, className: C.CLASS[r.player.classId].name, meta: JSON.parse(JSON.stringify(r.meta)), oaths: r.oaths.slice(),
        oathMult: sm && sm.echoes ? sm.echoes.oathMult : 1, bagSlots: R.bagCapacity(r), potions: count('healing_draught'),
        weapon: item(r.player.equipped.weapon, r.player.classId), resurrect: ((R.resurrectCharges(r) || {}).now || []).map((x) => RES_KEY[x] || x),
        // expedition.md 8.2 (M2b v11): a run on the expedition map with the start camp: what the catalogue gives it
        exp: r.exp && r.exp.prep ? {
          typeRadius: r.exp.vision.typeRadius, bell: r.exp.bell, points: r.prep ? r.prep.points : null,
          unlocks: Object.fromEntries(['cartographer', 'old_hand', 'quartermaster'].map((id) => [id, C.META[id] ? Math.min((r.profile && r.profile.unlocks && r.profile.unlocks[id]) || 0, C.META[id].ranks) : 0])),
        } : null,
      };
    } catch { out = null; }
    dry.nextOf = s; dry.next = out;
    return out;
  }
  /** The profile END_RUN will store (SUMMARY), from a dry END_RUN: its balance and how many unlocks it can buy. */
  function afterRun(s) {
    if (dry.afterOf === s) return dry.after;
    let out = null;
    try {
      const r = R.step(s, { type: 'END_RUN' }).state;
      const p = r.result.profile;
      out = { echoes: p.echoes, gained: r.result.echoes, affordable: R.metaOffers(p).filter((o) => o.affordable).length };
    } catch { out = null; }
    dry.afterOf = s; dry.after = out;
    return out;
  }
  /** Furthest point of a run as the run log stores it: 1..ZONE_COUNT a zone, then the camp, the boss, the boss defeated. */
  const stageOf = (sum) => (sum.outcome === 'victory' ? C.ZONE_COUNT + 3 : sum.reachedBoss ? C.ZONE_COUNT + 2 : sum.reached && sum.reached.camp ? C.ZONE_COUNT + 1 : (sum.reached && sum.reached.zone) || 1);
  function stageText(stage, phase) {
    const Z = C.ZONE_COUNT; const boss = data.meta.names.boss;
    if (!stage) return null;
    if (stage <= Z) return (zoneContent(stage) || {}).name || `Zone ${stage}`;
    if (stage === Z + 1) return data.meta.names.camp;
    if (stage === Z + 2) return `${boss}, phase ${Math.max(1, phase || 1)}`;
    return `${boss} defeated`;
  }
  /** END_RUN: one more run in the log of its class (presentation; see loadHistory). */
  function recordRun(sum) {
    const c = history.classes[sum.classId] || (history.classes[sum.classId] = { runs: 0, kills: 0, bestLevel: 0, bestStage: 0, bestPhase: 0 });
    const stage = stageOf(sum); const phase = sum.bossPhase || 0;
    c.runs = (c.runs || 0) + 1;
    if (sum.outcome === 'victory') c.kills = (c.kills || 0) + 1;
    c.bestLevel = Math.max(c.bestLevel || 0, sum.level || 0);
    if (stage > (c.bestStage || 0) || (stage === c.bestStage && phase > (c.bestPhase || 0))) { c.bestStage = stage; c.bestPhase = phase; }
    history.logged = (history.logged || 0) + 1;
    saveHistory(history);
  }
  /** After a purchase: the run being created takes the new profile; class, pet, name, seed and Oaths stay. */
  function rebuildCreate() {
    const c = st.create;
    let s = R.newRun({ classId: c.classId, petId: c.classId === 'hunter' ? c.petId : null, name: c.name || '', seed: c.seed, profile, content: CONTENT, ...modeNow() });
    for (const o of c.oaths || []) { const a = { type: 'SET_OATH', oath: o, on: true }; if (R.isLegal(s, a)) s = R.step(s, a).state; }
    st = s;
  }
  /**
   * The profile between runs (CREATE and SUMMARY): balance and counts, the engine's offers (R.metaOffers: rank, ranks,
   * nextCost, req, available, affordable), the run log per class, the last run's Echoes (after END_RUN), the next run
   * (CREATE: dry START_RUN) and what this run leaves (SUMMARY: dry END_RUN).
   */
  function metaView(s) {
    const p = profile || R.newProfile();
    const create = s.phase === 'CREATE';
    return {
      echoes: p.echoes, earned: p.earned, spent: p.spent, runs: p.runs, bossKills: p.bossKills, reachedBoss: !!p.reachedBoss,
      firstKill: { ...p.firstKill }, unlocks: { ...p.unlocks }, offers: R.metaOffers(p),
      // M3 (m3-onboarding.md 2.2): the profile's guide; guided: the run being created is the guided run (class select toggle)
      guide: R.migrateProfile(p).guide, guided: create ? !!(s.create && s.create.tutorial) : null, guideOffer: create ? guideTodo() && runMode.mapMode === 'expedition' && runMode.prep !== false && !!CONTENT.tutorial : null,
      oathsOwned: create ? R.isLegal(s, { type: 'SET_OATH', oath: C.OATH_IDS[0], on: true }) : (p.unlocks.oaths || 0) > 0,
      history: { logged: history.logged || 0, classes: Object.fromEntries(C.CLASS_IDS.map((id) => { const c = history.classes[id] || {}; return [id, { runs: c.runs || 0, kills: c.kills || 0, bestLevel: c.bestLevel || 0, best: stageText(c.bestStage, c.bestPhase), firstKill: !!p.firstKill[id] }]; })) },
      lastRun: local.lastRun,
      next: create ? nextRun(s) : null,
      after: s.phase === 'SUMMARY' ? afterRun(s) : null,
    };
  }

  function view() {
    const s = st;
    const v = { time: s.time || 0, autoplay: !!s.autoplay, seed: s.create ? s.create.seed : s.seed, mode: 'engine' };
    if (s.phase === 'CREATE') {
      return { ...v, phase: 'CREATE', create: { classId: s.create.classId || 'rogue', petId: s.create.petId || 'ridgewolf', name: s.create.name || '', seed: s.create.seed, oaths: (s.create.oaths || []).slice() }, oaths: (s.create.oaths || []).slice(), meta: metaView(s), player: null, zone: null, node: null, combat: null, loot: null, summary: null, dev: null, mapMode: s.mapMode || 'rows', legal: { lanes: [], services: {}, items: [], spells: {} } };
    }
    v.oaths = (s.oaths || []).slice();
    v.phase = s.phase === 'ENDED' ? 'SUMMARY' : s.phase;
    v.tutorial = R.tutorialView ? R.tutorialView(s) : null; // M3 guided run (engine-api.md 14.3); null in any other run
    v.player = convPlayer(s);
    // D144 (engine-2026-11-13d UI need 1): what a trainer would teach now ({ learn, train, next, useful }), for the hub's
    // welcome line and its Trainer card
    v.trainer = (() => { try { return R.trainerView ? R.trainerView(s) : null; } catch { return null; } })();
    v.mapMode = s.mapMode || 'rows';
    // the start camp (prep; expedition.md 2, 9.1): no zone yet; the screen reads R.prepView, the tracker R.contractView
    v.contracts = contractsOf(s);
    if (s.phase === 'PREP') {
      return { ...v, prep: prepOf(s), zone: null, hub: { used: {} }, node: null, combat: null, loot: null, summary: null, meta: null, par: R.bossPar(s),
        dev: s.dev ? { god: !!s.dev.god, tools: [...s.dev.tools] } : null, heat: null, camp: null, legal: convLegal(s) };
    }
    v.prep = null;
    v.zone = convZone(s);
    v.hub = s.hub || { used: {} };
    v.node = convNode(s);
    v.combat = convFight(s);
    v.loot = null;
    v.summary = v.phase === 'SUMMARY' ? convSummary(s) : null;
    v.meta = v.phase === 'SUMMARY' ? metaView(s) : null;
    v.par = R.bossPar(s); // the run's par (rules 1.7), the Oath of Haste included
    v.dev = s.dev ? { god: !!s.dev.god, tools: [...s.dev.tools] } : null; // dev tools (engine-api.md 12)
    v.heat = v.phase === 'SUMMARY' ? null : heatOf(s);
    // the camp panel reads the meter's numbers (heatView: at the Camp the line is the par and ascIfPar is the Ascendancy
    // FIGHT_BOSS gives), so the panel, the tracker, the minimap and the meter agree; a dry FIGHT_BOSS without heat
    v.camp = s.phase === 'CAMP' && !s.fight && !s.service ? (v.heat ? { par: v.heat.par, asc: v.heat.ascIfPar } : { par: v.par, asc: dryBossAsc(s) }) : null;
    if (v.phase === 'CAMP' && s.fight) v.phase = 'NODE';
    if (v.node && v.node.step === 'intro' && s.fight) v.combat = null; // the intro dialog is read before the fight is shown
    const win = (s.loot || []).map((it) => item(it, s.player.classId, { pending: true }));
    // the reward windows still to come after the one on screen, in order (QA playtest 2026-11-11 finding 8: the spoils,
    // then a quest's or a contract's choice, say what follows): { kind: 'quest' | 'story' | 'contract', title }
    const pend = s.node && s.node.stage === 'reward' ? s.node.rewards.filter((r) => r.kind === 'items') : [];
    const nextOf = (list) => list.map((r) => {
      if (r.contract) { const c = v.contracts ? v.contracts.contracts.find((x) => x.id === r.contract) : null; return { kind: 'contract', title: c ? TXT.contractTitle(c, CONTENT) : 'a contract' }; }
      if (r.story) return { kind: 'story', title: v.zone ? `${v.zone.name}: the story` : 'the story' };
      return { kind: 'quest', title: (CONTENT.quests[s.node.quest] || {}).title || 'the quest' };
    });
    if (local.hold) { v.phase = 'NODE'; v.node = local.hold.node; v.combat = null; }
    if (local.spoils) {
      const sp = local.spoils;
      v.phase = sp.phase || 'NODE'; v.node = sp.node; v.combat = sp.combat;
      v.loot = { kind: 'loot', title: sp.title, gold: sp.gold, xp: sp.xp, trap: sp.trap, items: [...win, ...sp.items.filter((it) => it.inBag)], next: nextOf(pend) };
    } else if (win.length) {
      v.loot = { kind: 'loot', title: 'Items waiting', gold: 0, xp: 0, items: win, windowOnly: true };
    } else if (s.node && s.node.stage === 'reward' && s.node.rewards[0].kind === 'items') {
      const r0 = s.node.rewards[0]; const q = CONTENT.quests[s.node.quest] || {};
      const rw = local.reward || {};
      // a completed contract's item choice (prep, expedition.md 3.1, 9.3): after the node's own rewards, as the story's
      const kc = r0.contract && v.contracts ? v.contracts.contracts.find((c) => c.id === r0.contract) || null : null;
      const paid = (rw.contracts || {})[r0.contract] || {};
      if (r0.contract) v.loot = { kind: 'contract', title: 'Contract complete', contract: kc, hubName: v.zone.hubName, xp: paid.xp || 0, gold: paid.gold || 0, choices: r0.items.map((it) => item(it, s.player.classId)) };
      else v.loot = r0.story
        ? { kind: 'story', title: `${v.zone.name}: the story is told`, text: 'Three tasks done; the people of this land will remember your name.', xp: rw.storyXp || 0, gold: 0, choices: r0.items.map((it) => item(it, s.player.classId)) }
        : { kind: 'reward', title: q.title || 'Quest', giver: q.giver, text: q.turnIn || '', xp: rw.xp || 0, gold: rw.gold || 0, choices: r0.items.map((it) => item(it, s.player.classId)) };
      v.loot.next = nextOf(pend.slice(1));
    }
    v.legal = convLegal(s);
    if (local.hold || local.spoils) { v.legal = { ...v.legal, lanes: [], travelOn: false, attack: false, flee: false }; }
    return v;
  }

  // ---------------------------------------------------------------- events
  function convEvents(prevView, events, s) {
    const out = [];
    const hp = new Map(); const max = new Map();
    const key = (u) => (u === 'player' ? 'player' : u === 'pet' ? 'pet' : `e${u}`);
    if (prevView && prevView.player) { hp.set('player', prevView.player.hp); max.set('player', prevView.player.maxHp); if (prevView.player.pet) { hp.set('pet', prevView.player.pet.hp); max.set('pet', prevView.player.pet.maxHp); } }
    if (prevView && prevView.combat) for (const e of prevView.combat.enemies) { hp.set(`e${e.idx}`, e.hp); max.set(`e${e.idx}`, e.maxHp); }
    const nf = s.fight;
    const setFromNext = () => {
      if (nf) for (const e of nf.enemies) { if (!hp.has(`e${e.idx}`)) hp.set(`e${e.idx}`, e.maxHp); max.set(`e${e.idx}`, e.maxHp); }
    };
    setFromNext();
    const ref = (u) => (u === 'player' ? { side: 'player', idx: 0 } : u === 'pet' ? { side: 'pet', idx: 0 } : typeof u === 'number' ? { side: 'enemy', idx: u } : { side: 'env', idx: 0 });
    const enemyName = (u) => { const e = (nf && nf.enemies[u]) || (prevView && prevView.combat && prevView.combat.enemies.find((x) => x.idx === u)); return e ? e.name : 'Enemy'; };
    const prevIntent = (u) => { const e = prevView && prevView.combat && prevView.combat.enemies.find((x) => x.idx === u); return e ? e.intent : null; };
    // Item events carry a consumable id or an item uid: find the name after the step (bags, equipment,
    // loot window) or before it (an item just sold).
    const itemName = (idOrUid) => {
      if (consName(idOrUid)) return consName(idOrUid);
      const p = s.player;
      const now = p ? [...(p.bag || []), ...Object.values(p.equipped || {}), ...(s.loot || [])].find((x) => x && x.uid === idOrUid) : null;
      if (now) return now.name || consName(now.id) || 'an item';
      const before = prevView && prevView.player ? prevView.player.bag.find((x) => x && x.uid === idOrUid) : null;
      return before ? before.name : 'an item';
    };
    let lastUsed = null; // name of the last item used in this step (out-of-combat heals carry no source)
    let res = prevView && prevView.player ? prevView.player.res.cur : 0;
    for (const e of events) {
      switch (e.t) {
        case 'fight': local.fightNo++; out.push({ t: 'fightStart', kind: e.kind, enemies: e.enemies.map((x) => x.name) }); for (const x of e.enemies) { hp.set(`e${x.u}`, x.hp); max.set(`e${x.u}`, x.hp); } break;
        case 'round': out.push({ t: 'round', round: e.n }); break;
        case 'action': {
          // a flight that works also gives `fled` (below): the action says only a failed one (D144 UI need 7: logged twice)
          if (e.kind === 'flee') { if (!e.success) out.push({ t: 'flee', ok: false }); break; }
          if (e.kind === 'skip') { out.push({ t: 'skip', src: ref('player'), reason: 'Frozen in time' }); break; }
          if (e.kind === 'engage') {
            // an engage option (rules 7.10): strike and control options play at the target, setup options on the hero (the pet
            // for Send the Pet), Lay Trap without a projectile; ENGAGE_FX holds the presentation. Combat v2.1: a Disrupt
            // (`disrupt`) names the wind-up its trap will stop: the entry on the TRAP's turn (the first visible wind-up)
            const o = (C.ENGAGE_OPTION || {})[e.option] || {}; const fx = ENGAGE_FX[e.option] || {};
            let disrupt = null;
            if (e.disrupt && nf && nf.enemies[e.target]) {
              const en = nf.enemies[e.target]; const trap = (en.st || []).find((x) => x.id === 'TRAP');
              const x = trap ? en.track.find((y) => y.turn === trap.turn) : null;
              disrupt = { name: x ? x.name : null, round: x ? (en.turn0 || 1) + x.turn - 1 : null };
            }
            out.push({ t: 'action', src: ref('player'), kind: 'engage', option: e.option, id: e.option, name: o.name || TXT.humanize(e.option), school: fx.school || 'phys',
              dst: fx.at === 'target' && e.target != null ? ref(e.target) : fx.at === 'pet' ? ref('pet') : null, target: e.target != null ? ref(e.target) : null,
              aoe: false, tags: fx.tags || [], disrupt });
            break;
          }
          if (e.cost) res = Math.max(0, res - e.cost);
          const sp = e.spell ? C.SPELL[e.spell] : null;
          const kind = e.kind === 'cast' ? 'spell' : e.kind;
          out.push({ t: 'action', src: ref('player'), kind, id: e.spell || e.item, name: sp ? sp.name : e.item ? (C.CONSUMABLE[e.item] || {}).name || e.item : C.CLASS[s.player.classId].basic.name,
            school: sp ? sp.school || 'arcane' : C.CLASS[s.player.classId].basic.school, dst: e.target != null ? ref(e.target) : null, aoe: !!(sp && sp.tags && sp.tags.includes('aoe')), tags: sp ? sp.tags : [], resAfter: kind === 'spell' ? res : undefined,
            engage: e.engage || null, free: !!e.free, mult: e.free ? e.mult ?? null : null }); // free (M2b v6): Packed Satchel's free potion, the round goes on; mult (M2b v8): its strength
          break;
        }
        case 'petAction': out.push({ t: 'action', src: ref('pet'), kind: 'attack', name: 'Pet attack', dst: ref(e.target) }); break;
        case 'enemyAction': {
          const it = prevIntent(e.u) || {};
          // support: an action that heals, shields or braces an enemy (no projectile toward the player's side)
          out.push({ t: 'action', src: ref(e.u), kind: it.cast ? 'cast' : 'attack', id: e.id, name: e.name, dst: it.target === 'pet' ? ref('pet') : ref('player'), heavy: !!it.heavy, school: it.school || 'phys', boss: it.id === 'boss',
            support: !!it.support });
          break;
        }
        case 'damage': {
          const k = key(e.dst); const after = Math.max(0, (hp.get(k) ?? 0) - (e.amount || 0)); hp.set(k, after);
          out.push({ t: 'damage', src: ref(e.src), dst: ref(e.dst), amount: e.amount || 0, absorbed: e.absorbed || 0, crit: !!e.crit, tick: !!e.tick, immune: !!e.immune, school: e.school || 'phys',
            name: e.spell === 'pet' ? (s.player.pet ? C.PET[s.player.pet.id].name : 'Pet') : e.spell === 'brand' ? 'Brand of the Hollow' : spellName(e.spell), hpAfter: after, maxHp: max.get(k) });
          if (e.sidestep) out.push({ t: 'msg', text: "Death's Sidestep! You slip away.", kind: 'good' });
          break;
        }
        case 'miss': out.push({ t: 'damage', src: ref(e.src), dst: ref(e.dst), amount: 0, miss: true, dodge: !!e.dodge, name: e.spell === 'pet' ? 'Pet' : spellName(e.spell), school: 'phys', hpAfter: hp.get(key(e.dst)), maxHp: max.get(key(e.dst)) }); break;
        case 'heal': { const k = key(e.dst); const m = max.get(k) ?? Infinity; const after = Math.min(m, (hp.get(k) ?? 0) + (e.amount || 0)); hp.set(k, after); out.push({ t: 'heal', dst: ref(e.dst), amount: e.amount || 0, name: e.spell ? spellName(e.spell) : lastUsed || 'Healing', hpAfter: after, maxHp: max.get(k), maimed: !!e.maimed }); break; }
        case 'petRevive': hp.set('pet', e.hp); out.push({ t: 'heal', dst: ref('pet'), amount: e.hp, name: 'Revive', hpAfter: e.hp, maxHp: max.get('pet') }); break;
        case 'mana': res = Math.max(0, res + (e.amount || 0)); out.push({ t: 'resource', amount: e.amount, after: res }); break;
        case 'status': out.push({ t: 'status', dst: ref(e.u), id: e.id, op: e.on ? 'add' : 'remove', stacks: e.stacks }); break;
        case 'interrupt': out.push({ t: 'interrupt', dst: ref(e.u), name: (prevIntent(e.u) || {}).name || 'cast' }); break;
        case 'skip': out.push({ t: 'skip', src: ref(e.u), reason: 'Time stopped' }); break;
        case 'channel': out.push({ t: 'channel', src: ref(e.u), name: e.name, step: e.step }); break;
        case 'summon': hp.set(`e${e.u}`, e.hp); max.set(`e${e.u}`, e.hp); out.push({ t: 'summon', idxs: [e.u], names: [e.name], signal: !!e.signal }); break;
        case 'despawn': out.push({ t: 'death', dst: ref(e.u), name: enemyName(e.u), despawn: true }); break;
        case 'linked': out.push({ t: 'linked', on: !!e.on, n: e.n ?? null }); break;
        case 'shield':
          // Bolster (combat v2): the mender's shield on its weakest ally
          if (e.spell === 'bolster') out.push({ t: 'bolster', src: ref(e.by), dst: ref(e.u), amount: e.amount || 0, by: enemyName(e.by), name: enemyName(e.u) });
          out.push({ t: 'status', dst: ref(e.u), id: 'WARD', op: 'add' }); break;
        // combat v2 (engine-api.md 5): control cancelled an entry, an entry was replaced, a window opened, a trap sprang, a Signal
        case 'cancel': out.push({ t: 'cancel', dst: ref(e.u), who: enemyName(e.u), name: e.name, by: e.by, offBalance: !!e.offBalance, turn: e.turn }); break;
        case 'replace': out.push({ t: 'replace', dst: ref(e.u), who: enemyName(e.u), fromName: e.fromName, toName: e.toName, reason: e.reason }); break;
        case 'offBalance': out.push({ t: 'offBalance', dst: ref(e.u), who: enemyName(e.u), why: e.why, name: e.name || null }); break;
        case 'trapSprung': out.push({ t: 'trapSprung', dst: ref(e.u), who: enemyName(e.u), disrupt: !!e.disrupt }); break;
        // combat v2.1 (rules 7.12, engine-api.md 5): a wind-up answered (a STAGGERED stack) or landed (an EMPOWERED stack);
        // the stack's status event comes first. why/by: what answered it (interrupt, control, trap, disrupt, silenced, avoided)
        case 'stagger': case 'empower':
          out.push({ t: 'windup', result: e.t === 'stagger' ? 'answered' : 'landed', dst: ref(e.u), who: enemyName(e.u), id: e.id, name: e.name, turn: e.turn,
            why: e.why || null, by: e.by ?? null, byName: e.by && (C.SPELL[e.by] || (C.ENGAGE_OPTION || {})[e.by]) ? (C.SPELL[e.by] || C.ENGAGE_OPTION[e.by]).name : null,
            stacks: e.stacks || 1, value: e.value || 0, deathblow: !!e.deathblow, maimed: !!e.maimed });
          break;
        case 'signal': out.push({ t: 'signal', src: ref(e.u), who: enemyName(e.u), adds: e.adds || 1 }); break;
        case 'enrage': out.push({ t: 'status', dst: ref(e.u), id: 'ENRAGED', op: 'add' }); break;
        case 'image': out.push({ t: 'damage', src: ref(e.src), dst: ref('player'), amount: 0, miss: true, name: 'Mirror image', school: 'arcane', hpAfter: hp.get('player'), maxHp: max.get('player') }); break;
        case 'phaseChange': out.push({ t: 'bossPhase', phase: e.phase, name: e.phase === 2 ? 'The Dimming' : 'Eclipse', text: e.phase === 2 ? TXT.linkedText(data.rules, 'banner') : 'The light dies. Oruvath grows stronger every round.' }); break;
        case 'death':
          if (e.u === 'player') { out.push({ t: 'death', dst: ref('player'), name: s.player.name }); if (s.phase === 'SUMMARY' || s.phase === 'ENDED') out.push({ t: 'defeat' }); }
          else { hp.set(key(e.u), 0); out.push({ t: 'death', dst: ref(e.u), name: e.name || enemyName(e.u) }); }
          break;
        case 'resurrect': hp.set('player', s.player.hp); out.push({ t: 'resurrect', source: { boon: 'Boon of Return', second_breath: 'Second Breath', ember: 'Ember of Return' }[e.source] || 'A resurrection', hpAfter: s.player.hp, maxHp: s.player.d.maxHp }); break;
        // heat (rules 1.7.3): the extra XP and gold of a node entered Hot or Scorched, carried by the events as `heat`
        case 'xp': if (e.amount > 0) out.push({ t: 'xp', amount: e.amount, rested: e.rested || 0, why: e.why, heat: e.heat || 0 }); break;
        case 'levelUp': out.push({ t: 'levelUp', level: e.level, talentPoint: !!e.talentPoint, newSpells: Object.values(C.SPELL).filter((sp) => sp.cls === s.player.classId && sp.source === 'class' && sp.lvl === e.level).map((sp) => sp.name), hp: s.player.hp, maxHp: s.player.d.maxHp }); break;
        case 'gold': if (e.amount > 0 && e.why !== 'sell') out.push({ t: 'gold', amount: e.amount, why: e.why, heat: e.heat || 0 }); break; // a sale says its price itself
        case 'loot': out.push({ t: 'gotItem', name: e.item.name || (C.CONSUMABLE[e.item.id] || {}).name || 'item', rarity: e.item.rarity || 'common', to: e.to, heatUp: local.heatUp.get(e.item.uid) || null }); break;
        case 'victory': out.push({ t: 'victory' }); break;
        case 'fled': out.push({ t: 'flee', ok: true }); break;
        case 'questComplete': out.push({ t: 'msg', text: 'Quest complete!', kind: 'good' }); break;
        case 'story': out.push({ t: 'msg', text: 'Zone story complete: a rare reward awaits.', kind: 'good' }); break;
        case 'dungeonClear': out.push({ t: 'msg', text: 'Dungeon cleared!', kind: 'good' }); break;
        case 'boon': out.push({ t: 'boon', id: e.id, name: e.name || (C.BOON[e.id] || {}).name }); break;
        case 'trap': out.push({ t: 'damage', src: ref(null), dst: ref('player'), amount: e.amount, name: 'Needle trap', school: 'phys', hpAfter: s.player.hp, maxHp: s.player.d.maxHp }); break;
        case 'rest': out.push({ t: 'rest', rested: e.rested }); break;
        case 'learn': out.push({ t: 'learn', id: e.spellId || e.spell, name: spellName(e.spellId || e.spell) }); break;
        case 'train': out.push({ t: 'train', id: e.spellId || e.spell, name: spellName(e.spellId || e.spell), rank: e.rank || '' }); break;
        case 'buy': out.push({ t: 'buy', name: itemName(e.item), price: e.price || 0 }); break;
        case 'sell': out.push({ t: 'sell', name: itemName(e.item), gold: e.value || 0 }); break;
        case 'equip': out.push({ t: 'equip', name: itemName(e.item) }); break;
        case 'talent': out.push({ t: 'talent', name: (C.TALENT[e.talentId || e.id] || {}).name || 'talent', rank: e.rank || '' }); break;
        case 'useItem': lastUsed = consName(e.item) || 'An item'; out.push({ t: 'used', name: lastUsed }); break;
        case 'zone': out.push({ t: 'zone' }); break;
        // start camp and contracts (prep, engine-api.md 5): the screens show PREP's own steps; these say what changed
        case 'contract': { const m = contractMsg(e, s); if (m) out.push(m); break; }
        case 'prep':
          if (e.what === 'setOut') out.push({ t: 'msg', text: `You set out with ${e.contracts} ${TXT.plural(e.contracts, 'contract')} and ${e.reserve} ${TXT.plural(e.reserve, 'point')} of Reserve.`, kind: 'good' });
          break;
        // M3 guided run (engine-api.md 14): the beats (onboarding.js reads them), the rescue, the skip and the guide's end
        case 'beat': out.push({ t: 'beat', id: e.id, what: e.what, line: e.line ?? null }); break;
        case 'rescue': out.push({ t: 'rescue', tolls: e.tolls, to: e.to, node: e.node }); break;
        case 'guideSkipped': out.push({ t: 'guideSkipped' }); break;
        case 'guideEnd': out.push({ t: 'guideEnd' }); break;
        case 'spyglass': out.push({ t: 'msg', text: `Spyglass: ${e.seen.length ? `${e.seen.length} more ${TXT.plural(e.seen.length, 'place')} in view` : 'nothing new in view'} · ${e.charges} ${TXT.plural(e.charges, 'look')} left`, kind: 'good' }); break;
        default: break;
      }
    }
    return out;
  }
  /** A contract event (prep) as a toast and log line, named as the tracker names it; take and drop at PREP say nothing. */
  function contractMsg(e, s) {
    if (s.phase === 'PREP' && (e.what === 'take' || e.what === 'drop')) return null;
    const cv = contractsOf(s);
    const c = cv ? cv.contracts.find((x) => x.id === e.id) : null;
    const name = c ? TXT.contractTitle(c, CONTENT) : TXT.CONTRACT_KIND[e.kind] || 'A contract';
    switch (e.what) {
      case 'take': return { t: 'msg', text: `Contract taken: ${name}`, kind: 'good' };
      case 'site': return { t: 'msg', text: `Contract site won: ${name} · ${e.progress} / ${e.need}`, kind: 'good' };
      case 'complete': return { t: 'msg', text: `Contract complete: ${name}`, kind: 'good' };
      case 'expire': return { t: 'msg', text: `Contract expired: ${name}`, kind: 'info' };
      case 'abandon': return { t: 'msg', text: `Contract given up: ${name}`, kind: 'info' };
      default: return null;
    }
  }

  // ---------------------------------------------------------------- actions
  function apply(action, events) {
    const before = st;
    const r = R.step(st, action);
    st = r.state;
    local.engineLog.push(JSON.parse(JSON.stringify(action)));
    events.push(...r.events);
    for (const e of r.events) if (e.t === 'node' && e.heat && st.zone) local.nodeHeat.set(e.id != null ? `${st.zone.z}:#${e.id}` : `${st.zone.z}:${e.r}:${e.l}`, e.heat);
    heatSteps(before, action, r);
    return r;
  }

  /**
   * Items that heat raised one rarity in this engine step (rules 8.4, expedition.md H.3), recorded in local.heatUp for the
   * loot window, the reward cards and item tooltips. The engine does not mark the step on the item (engine-api.md 11.3:
   * the rarity is the final one), so the bridge asks the engine the same step with the node entered in Clear: the heat
   * draw is made in every state and the loot stream does not depend on heat (rules 8.4), so the same items roll and an
   * item whose rarity differs is one that heat raised. Only in a node entered Hot or Scorched (the only states with a
   * HEAT_RARITY_UP above 0), and only when the step rolled items. Interim until the engine marks the step itself
   * (hand-off ui-2026-11-10f); any failure marks nothing.
   */
  function heatSteps(before, action, r) {
    // reward choices of the node (quest items, then the story's), and the items that existed before the step (taking,
    // choosing or equipping an item rolls nothing)
    const rw = (x) => (x && x.node && x.node.rewards ? x.node.rewards.filter((set) => set.kind === 'items').flatMap((set) => set.items) : []);
    const p0 = before.player;
    const known = new Set([...(p0 ? [...(p0.bag || []), ...Object.values(p0.equipped || {})] : []), ...(before.loot || []), ...rw(before)].filter(Boolean).map((it) => it.uid));
    const drops = r.events.filter((e) => e.t === 'loot' && e.item && e.item.kind === 'gear' && !known.has(e.item.uid));
    const choices = rw(r.state).filter((it) => it.kind === 'gear' && !known.has(it.uid));
    if (!drops.length && !choices.length) return;
    const entered = r.events.find((e) => e.t === 'node');
    const paid = before.node ? before.node.heat : entered ? entered.heat : null;
    const rate = paid && C.HEAT_RARITY_UP ? C.HEAT_RARITY_UP[paid] || 0 : 0;
    if (!(rate > 0)) return;
    try {
      const alt = R.deserialize(R.serialize(before), before.content);
      if (alt.node) { alt.node.heat = 'clear'; if (alt.fight) alt.fight.heat = 'clear'; } else alt.time = Math.min(0, alt.zone && alt.zone.start != null ? alt.zone.start : 0); // a node entered now enters Clear
      const ar = R.step(alt, action);
      const altDrops = ar.events.filter((e) => e.t === 'loot' && e.item && e.item.kind === 'gear' && !known.has(e.item.uid));
      if (altDrops.length === drops.length) drops.forEach((e, i) => { if (e.item.rarity !== altDrops[i].item.rarity) local.heatUp.set(e.item.uid, paid); });
      const altChoices = rw(ar.state).filter((it) => it.kind === 'gear' && !known.has(it.uid));
      if (altChoices.length === choices.length) choices.forEach((it, i) => { if (it.rarity !== altChoices[i].rarity) local.heatUp.set(it.uid, paid); });
    } catch { /* the interim lookup failed: no item is marked */ }
  }
  function translate(a) {
    const p = st.player;
    switch (a.type) {
      case 'HUB_SERVICE': return { type: 'SERVICE', service: a.service };
      case 'CONTINUE': return { type: 'NEXT_FIGHT' };
      case 'CHOOSE_REWARD': return { type: 'CHOOSE_REWARD', index: a.i };
      case 'BUY': return { type: 'BUY', index: a.i };
      case 'SELL': return { type: 'SELL', itemId: a.uid };
      case 'EQUIP': return { type: 'EQUIP', itemId: a.uid };
      case 'DISCARD': return { type: 'DISCARD', itemId: a.uid };
      case 'USE_ITEM':
        if (st.fight) return { type: 'USE_ITEM', slot: a.slot, target: null };
        { const it = p && p.bag.find((x) => x.uid === a.uid); return { type: 'USE_ITEM', itemId: it ? it.id : a.itemId }; }
      case 'CAST': { const sp = C.SPELL[a.spellId]; return { type: 'CAST', spellId: a.spellId, target: sp && sp.target === 'enemy' ? (a.target ?? 0) : null }; }
      case 'ATTACK': return { type: 'ATTACK', target: a.target ?? 0 };
      case 'ENGAGE': {
        // engine-api.md 3: { type, option, target }, Pre-cast { type, option, spellId, target }; options without a target take null
        const o = (C.ENGAGE_OPTION || {})[a.option] || {};
        if (o.target === 'spell') return { type: 'ENGAGE', option: a.option, spellId: a.spellId, target: C.SPELL[a.spellId] && C.SPELL[a.spellId].target === 'enemy' ? (a.target ?? null) : null };
        return { type: 'ENGAGE', option: a.option, target: o.target === 'none' ? null : (a.target ?? null) };
      }
      case 'SET_NAME': return a.name ? { type: 'SET_NAME', name: String(a.name).slice(0, 24) } : null;
      case 'SET_SEED': return a.seed === null || a.seed === undefined || a.seed === '' ? null : { type: 'SET_SEED', seed: Number(a.seed) >>> 0 };
      default: return { ...a };
    }
  }

  function step(action) {
    const prev = view();
    const events = [];
    try {
      switch (action.type) {
        case 'ENGINE': apply(action.action, events); break;
        case 'AUTO': {
          // test / bot helper: first close presentation windows, then let the engine pick
          if (local.hold && local.hold.node.step === 'chest') return step({ type: 'OPEN_CHEST' });
          if (local.hold) { local.hold = null; return { ok: true, events: [] }; }
          if (local.spoils && !(st.loot && st.loot.length)) { local.spoils = null; return { ok: true, events: [] }; }
          if (st.node && st.fight && !local.introSeen.has(nodeKey(st)) && NEEDS_INTRO.has(st.node.type) && (st.node.k || 0) === 0) { local.introSeen.add(nodeKey(st)); return { ok: true, events: [] }; }
          const a = R.autoAction(st); if (!a) return { ok: false, error: 'Nothing to do' };
          return step({ type: 'ENGINE', action: a });
        }
        case 'ACCEPT':
          if (!st.node || !st.fight || local.introSeen.has(nodeKey(st))) return { ok: false, error: 'Nothing to accept' };
          local.introSeen.add(nodeKey(st));
          return { ok: true, events: [] };
        case 'OPEN_CHEST': {
          if (!local.hold || local.hold.node.step !== 'chest') return { ok: false, error: 'No chest here' };
          const h = local.hold; local.hold = null;
          local.spoils = { title: 'Treasure chest', node: { ...h.node, step: 'opened' }, combat: null, gold: h.gold, xp: 0, trap: h.trap > 0, items: h.items };
          const evs = [{ t: 'chest', gold: h.gold }];
          if (h.trap > 0) evs.push({ t: 'damage', src: { side: 'env', idx: 0 }, dst: { side: 'player', idx: 0 }, amount: h.trap, name: 'Needle trap', school: 'phys', hpAfter: st.player.hp, maxHp: st.player.d.maxHp });
          // the chest's gold and loot as the log says them, now that it is open (held back on entry, above)
          evs.push(...convEvents(view(), (h.held || []).filter((e) => e.t !== 'trap'), st));
          return { ok: true, events: evs };
        }
        case 'LEAVE':
          if (local.hold && local.hold.node.type === 'rest') { local.hold = null; return { ok: true, events: [] }; }
          apply({ type: 'LEAVE' }, events); break;
        case 'LOOT_TAKE': {
          const v = view(); const it = v.loot && v.loot.items[action.i];
          if (!it || !it.pending) return { ok: false, error: 'Already in your bags' };
          apply({ type: 'LOOT_TAKE', itemId: it.uid }, events); break;
        }
        case 'LOOT_EQUIP': { const v = view(); const it = v.loot && v.loot.items[action.i]; if (!it) return { ok: false, error: 'No such item' }; apply({ type: 'EQUIP', itemId: it.uid }, events); break; }
        case 'LOOT_DROP': { const v = view(); const it = v.loot && v.loot.items[action.i]; if (!it || !it.pending) return { ok: false, error: 'No such item' }; apply({ type: 'LOOT_DROP', itemId: it.uid }, events); break; }
        case 'LOOT_TAKE_ALL': {
          let left = 0;
          for (const it of [...(st.loot || [])]) { if (R.isLegal(st, { type: 'LOOT_TAKE', itemId: it.uid })) apply({ type: 'LOOT_TAKE', itemId: it.uid }, events); else left++; }
          if (left) { const ce = convEvents(prev, events, st); ce.push({ t: 'msg', text: 'Your bags cannot hold everything: equip, drop or discard first.', kind: 'warn' }); return { ok: true, events: ce }; }
          local.spoils = null;
          break;
        }
        case 'LOOT_CLOSE':
          for (const it of [...(st.loot || [])]) apply({ type: 'LOOT_DROP', itemId: it.uid }, events);
          local.spoils = null;
          break;
        case 'END_RUN': {
          const before = st.profile ? st.profile.echoes : 0;
          if (st.phase === 'SUMMARY') apply({ type: 'END_RUN' }, events);
          const keep = st.create ? { classId: st.create.classId, petId: st.create.petId } : {};
          if (st.result && st.result.profile) {
            const sum = st.result.summary;
            profile = st.result.profile; saveProfile(profile); refreshPets();
            if (!sum.dev) recordRun(sum); // a dev run (engine-api.md 12) stays out of the run log
            local.lastRun = { n: ++local.runNo, name: sum.name, classId: sum.classId, className: sum.className, outcome: sum.outcome, level: sum.level,
              gained: st.result.echoes, before, after: profile.echoes, firstKill: ((sum.echoes && sum.echoes.lines) || []).some((l) => l.id === 'firstKill'), dev: !!sum.dev };
          }
          st = mkRun(randomSeed(), keep); // the next run starts on the same class
          resetLocal();
          return { ok: true, events: [] };
        }
        case 'META_BUY': {
          // a meta unlock (rules 11.2), between runs only; the engine's offers say what can be bought
          if (st.phase !== 'CREATE') return { ok: false, error: 'Unlocks are bought between runs' };
          const p0 = profile || R.newProfile();
          const was = R.metaOffers(p0);
          const o0 = was.find((o) => o.id === action.id);
          if (!o0) return { ok: false, error: 'No such unlock' };
          if (!o0.available) return { ok: false, error: o0.rank >= o0.ranks ? `${o0.name} is at its highest rank` : `${o0.name} is still locked` };
          if (!o0.affordable) return { ok: false, error: 'Not enough Echoes' };
          profile = R.buyMeta(p0, action.id);
          saveProfile(profile); refreshPets(); rebuildCreate();
          const now = R.metaOffers(profile); const o1 = now.find((o) => o.id === action.id);
          const opened = now.filter((o) => o.available && o.rank === 0 && !was.find((x) => x.id === o.id).available).map((o) => o.id);
          return { ok: true, events: [{ t: 'metaBuy', id: o1.id, name: o1.name, rank: o1.rank, ranks: o1.ranks, cost: o0.nextCost, echoes: profile.echoes, opened }] };
        }
        case 'SET_GUIDE': {
          // class select's "Guided first run" toggle (m3-onboarding.md 2.2): the run being created, rebuilt (class, pet, name,
          // seed and Oaths kept); the profile's guide changes only when the run starts (START_RUN below)
          if (st.phase !== 'CREATE') return { ok: false, error: 'The guide is chosen at class select' };
          guideOn = !!action.on; rebuildCreate();
          return { ok: true, events: [] };
        }
        case 'GUIDE_AGAIN': {
          // Settings, "Play the guide again" (2.2): the profile's guide back to 'todo'; the next run (at class select: this
          // one) is guided. The welcome is not paid again (the profile keeps welcome: true).
          profile = R.setGuide(profile || R.newProfile(), 'todo'); saveProfile(profile); guideOn = true;
          if (st.phase === 'CREATE') rebuildCreate();
          return { ok: true, events: [], now: st.phase === 'CREATE' };
        }
        case 'START_RUN': {
          // the toggle off at the start of a new profile's first run: a normal run, and the guide is 'skipped' (2.2)
          if (st.phase === 'CREATE' && !guideOn && guideTodo() && runMode.mapMode === 'expedition' && runMode.prep !== false) {
            profile = R.setGuide(profile || R.newProfile(), 'skipped'); saveProfile(profile); rebuildCreate();
          }
          apply({ type: 'START_RUN' }, events); break;
        }
        case 'SELECT_CLASS': {
          apply({ type: 'SELECT_CLASS', classId: action.classId }, events);
          if (action.classId === 'hunter' && !st.create.petId) apply({ type: 'SELECT_PET', petId: 'ridgewolf' }, events);
          break;
        }
        case 'SET_TARGET': return { ok: true, events: [] };
        case 'DEBUG_JUMP': return { ok: false, error: 'Debug jumps need the mock engine (?mock=1)' };
        default: {
          const a = translate(action);
          if (!a) return { ok: true, events: [] };
          apply(a, events);
        }
      }
    } catch (err) {
      if (err && err.code === 'ILLEGAL_ACTION') return { ok: false, error: castReason(st, err) };
      throw err;
    }
    const hold0 = local.hold;
    afterStep(prev, events);
    // D144 (engine-2026-11-13d UI need 6): an unguarded chest is opened by the engine on entry, but the screen holds it
    // until "Open the chest": its gold, loot and trap wait for OPEN_CHEST (they were in the log before it was opened)
    if (local.hold && local.hold !== hold0 && local.hold.node.step === 'chest') {
      const inChest = (e) => e.t === 'loot' || e.t === 'trap' || (e.t === 'gold' && e.why === 'treasure');
      local.hold.held = events.filter(inChest);
      return { ok: true, events: convEvents(prev, events.filter((e) => !inChest(e)), st) };
    }
    return { ok: true, events: convEvents(prev, events, st) };
  }

  /** Presentation holds after a step: spoils window, rest screen, unopened chest. */
  function afterStep(prev, events) {
    const has = (t) => events.some((e) => e.t === t);
    const sum = (t, pred) => events.filter((e) => e.t === t && (!pred || pred(e))).reduce((a, e) => a + (e.amount || 0), 0);
    const items = events.filter((e) => e.t === 'loot').map((e) => item(e.item, st.player ? st.player.classId : 'rogue', { inBag: e.to === 'bag', pending: e.to === 'window' }));
    if (events.some((e) => e.t === 'questComplete')) local.reward = { xp: sum('xp', (e) => e.why === 'quest'), gold: sum('gold', (e) => e.why === 'quest' && e.amount > 0), storyXp: sum('xp', (e) => e.why === 'story') };
    // contracts completed in this step (prep): each one's XP and gold (the events after its `contract` complete event,
    // why 'contract'), shown on its reward window
    const done = events.map((e, i) => [e, i]).filter(([e]) => e.t === 'contract' && e.what === 'complete');
    if (done.length) {
      const r = local.reward && events.some((e) => e.t === 'questComplete') ? local.reward : (local.reward = {});
      r.contracts = r.contracts || {};
      done.forEach(([e, i], k) => {
        const end = k + 1 < done.length ? done[k + 1][1] : events.length;
        const mine = events.slice(i + 1, end).filter((x) => x.why === 'contract');
        r.contracts[e.id] = { xp: mine.filter((x) => x.t === 'xp').reduce((a, x) => a + (x.amount || 0), 0), gold: mine.filter((x) => x.t === 'gold' && x.amount > 0).reduce((a, x) => a + x.amount, 0) };
      });
    }
    const entered = events.find((e) => e.t === 'node');
    if (entered && entered.type === 'rest' && has('rest')) {
      local.hold = { node: { type: 'rest', step: 'rest', row: entered.r, lane: entered.l, id: entered.id ?? null, cl: entered.cl, heat: entered.heat || null } };
      return;
    }
    if (entered && entered.type === 'treasure' && !st.fight && has('nodeDone')) {
      local.hold = { node: { type: 'treasure', step: 'chest', row: entered.r, lane: entered.l, id: entered.id ?? null, cl: entered.cl, heat: entered.heat || null, text: lineFor(zoneContent(st.zone.z) && zoneContent(st.zone.z).treasureLines, { node: { r: entered.r, l: entered.l, id: entered.id }, zone: st.zone }) },
        gold: sum('gold', (e) => e.why === 'treasure'), trap: sum('trap'), items };
      return;
    }
    if (has('victory') && st.phase !== 'SUMMARY' && st.phase !== 'ENDED') {
      const pc = prev.combat ? { ...prev.combat, over: 'victory', enemies: prev.combat.enemies.map((e) => ({ ...e, alive: false, hp: 0, intent: null })) } : null;
      const kind = prev.combat ? prev.combat.kind : '';
      local.spoils = {
        title: kind === 'dboss' ? `${(prev.node && prev.node.dungeon) || 'Dungeon'} cleared` : prev.node && prev.node.type === 'treasure' ? 'Treasure chest' : 'Loot',
        phase: 'NODE', node: prev.node ? { ...prev.node, step: 'combat' } : { type: 'camp_grind', step: 'combat', cl: C.CAMP_GRIND_LEVEL },
        // a contract's XP and gold show on its own reward window (prep), not with the fight's spoils
        combat: pc, gold: sum('gold', (e) => e.amount > 0 && e.why !== 'quest' && e.why !== 'contract'), xp: sum('xp', (e) => e.why !== 'quest' && e.why !== 'story' && e.why !== 'contract'), trap: sum('trap') > 0, items,
      };
    }
  }

  /**
   * Dev tools (engine-api.md 12; the Dev menu): op on the run or the profile through R.debug, then the run on screen is the
   * result. Ops: build (Start at), camp, boss { phase }, nextZone, fight { ids, level }, kill { target }, refill, god { on },
   * give { gold, potions, talentPoints }, time { time } (whole tolls), heat { state }, reveal, mapMode { mode }, echoes { n }, catalogue,
   * seed { seed } (a new run in CREATE on that seed, class and pet kept). Each op on the run goes into the engine log as
   * { type: 'DEV', fn, args } (R.debug.fn(state, ...args); build: R.debug.build({ ...args[0], content })). Jumps start the
   * presentation afresh (no spoils, intros or holds); a kill that ends a fight shows its spoils as a victory would. The
   * result is checked with R.debug.validate (no steps): a failure is logged as a console error. Returns { ok, error, note }.
   */
  function dev(op, args = {}) {
    const D = R.debug;
    const before = st; const logLen = local.engineLog.length;
    const prev = view();
    const events = [];
    let note = null; let fresh = false;
    const copy = (x) => JSON.parse(JSON.stringify(x));
    const run = (fn, ...a) => { const r = D[fn](st, ...a); st = r.state; events.push(...r.events); local.engineLog.push({ type: 'DEV', fn, args: copy(a) }); return r; };
    // the map new runs get, explicit (D116: newRun's default is the expedition with the start camp)
    const modeOf = (mode, prep = true) => (mode === 'expedition' ? { mapMode: 'expedition', prep: !!prep } : { mapMode: 'rows' });
    try {
      switch (op) {
        case 'build': {
          // a build that names no map gets the map new runs get (D116: the expedition with the start camp; the setting)
          const map = args.mapMode ? {} : { mapMode: runMode.mapMode || 'expedition', ...(runMode.mapMode === 'rows' ? {} : { prep: runMode.prep !== false, ...(runMode.dimming === false ? { dimming: false } : {}) }) };
          const o = { ...map, ...args, seed: args.seed ?? (st.create ? st.create.seed : st.seed), profile: profile || null };
          const r = D.build({ ...o, content: CONTENT });
          st = r.state; resetLocal(); fresh = true;
          local.engineLog = [{ type: 'DEV', fn: 'build', args: [copy(o)] }];
          runMode = modeOf(st.mapMode, !!(st.exp && st.exp.prep)); // the next runs keep the map mode (and the start camp)
          break;
        }
        case 'camp': run('toCamp'); fresh = true; break;
        case 'boss': run('toBoss', { phase: args.phase || 1 }); fresh = true; break;
        case 'nextZone': run('nextZone'); fresh = true; break;
        case 'fight': run('encounter', { ids: args.ids, level: args.level ?? null }); fresh = true; break;
        case 'kill': run('killTarget', args.target ?? null); break;
        case 'refill': run('refill'); break;
        case 'god': run('setGod', !!args.on); break;
        case 'give': note = run('give', { gold: args.gold || 0, potions: args.potions || 0, talentPoints: args.talentPoints || 0 }).given; break;
        case 'time': run('setTime', args.time); break;
        case 'heat': run('setHeat', args.state); break;
        case 'reveal': run('revealMap'); break;
        case 'mapMode':
          runMode = modeOf(args.mode); // the next runs: that map (the expedition with its start camp)
          if (st.phase === 'CREATE') { rebuildCreate(); local.engineLog = []; } else { run('setMapMode', args.mode); fresh = true; }
          break;
        case 'echoes': case 'catalogue':
          profile = op === 'echoes' ? D.grantEchoes(profile || R.newProfile(), args.n) : D.fullCatalogue(profile || R.newProfile());
          saveProfile(profile); refreshPets();
          if (st.phase === 'CREATE') rebuildCreate();
          else if (st.phase !== 'ENDED') run('setProfile', profile);
          break;
        case 'resetOnboarding':
          // M3 (m3-onboarding.md E8, 7.2 setup): the profile's guide back to 'todo' and the welcome unpaid (R.debug); the class
          // select toggle on again. In a run the run takes the profile (a dev run, so its END_RUN keeps both) and the next run
          // is the guided one. The Dev menu clears the hint store (tbwcr.hints.v2) itself
          profile = D.resetOnboarding(profile || R.newProfile()); saveProfile(profile); refreshPets(); guideOn = true;
          if (st.phase === 'CREATE') rebuildCreate();
          else if (st.phase !== 'ENDED') run('setProfile', profile);
          break;
        case 'seed': {
          const keep = st.create ? { classId: st.create.classId, petId: st.create.petId } : { classId: st.player.classId, petId: st.player.pet ? st.player.pet.id : null };
          st = mkRun(Number(args.seed) >>> 0, keep); resetLocal(); fresh = true;
          break;
        }
        default: return { ok: false, error: `Unknown dev tool ${op}` };
      }
    } catch (err) {
      st = before; local.engineLog.length = Math.min(local.engineLog.length, logLen);
      if (err && err.code === 'ILLEGAL_ACTION') return { ok: false, error: reasonOf(err) };
      console.error(err); // not a refusal: a fault of the dev tools, shown and logged
      return { ok: false, error: `Dev tools: ${(err && err.message) || err}` };
    }
    if (fresh) { local.spoils = null; local.hold = null; local.reward = null; } else afterStep(prev, events);
    const bad = R.debug.validate(st, { steps: false });
    if (bad.length) console.error(`[dev] ${op}: the state fails the engine's checks: ${bad.join('; ')}`);
    return { ok: true, note };
  }

  return {
    mode: 'engine', data, canDebug: false,
    view,
    step,
    autoAction() { const a = st.phase === 'ENDED' ? null : R.autoAction(st); return a ? { type: 'ENGINE', action: a } : { type: 'PASS' }; },
    describeSpell(id, target = null) {
      const s = st; const sp = C.SPELL[id]; if (!sp || !s.player) return null;
      const f = s.fight;
      // the UI's target when it is alive (the hit chance is the target's), else the first living enemy
      const tgt = f ? (target != null && f.enemies[target] && f.enemies[target].alive ? target : (f.enemies.find((e) => e.alive) || { idx: 0 }).idx) : null;
      let info = null;
      try { info = R.spellInfo(s, id, tgt); } catch { info = null; }
      const resName = { energy: 'energy', mana: 'mana', focus: 'focus' }[C.CLASS[sp.cls].resource];
      const lines = [];
      const school = (x) => ({ phys: 'physical' }[x] || x || '');
      const a = info && info.amount;
      // Ricochet Bolt (M2 v3): the target takes `amount`, up to `bounces` other enemies `bounceAmount` (spellInfo)
      if (a && a.kind === 'damage' && a.bounces) lines.push(`Deals about ${a.amount} ${school(a.school)} damage to the target, then about ${a.bounceAmount} to up to ${TXT.numWord(a.bounces)} other ${TXT.plural(a.bounces, 'enemy', 'enemies')}.`);
      else if (a && a.kind === 'damage') lines.push(`${sp.target === 'all' ? 'Hits every enemy for' : 'Deals'} about ${a.amount} ${school(a.school)} damage${a.perCp ? ' per combo point' : ''}${a.hits > 1 ? `, ${a.hits} times` : ''}.`);
      if (a && a.kind === 'dot') lines.push(`About ${a.perTick} ${school(a.school)} damage per round for ${a.rounds} rounds.`);
      if (a && a.kind === 'ward') lines.push(`Absorbs about ${a.amount} damage for ${a.rounds} rounds.`);
      if (a && a.kind === 'heal') lines.push(`Heals about ${a.amount}.`);
      if (a) lines.push('Before level difference, crits and the target\'s defences.');
      // D144 (engine-2026-11-13d UI need 11; tactician: "hit/miss chance shown nowhere"): the hit roll's chance now
      const pc = (x) => `${Math.round(x * 100)} %`;
      const enemyName = (u) => (f && f.enemies[u] ? f.enemies[u].name : 'it');
      if (info && typeof info.hit === 'number') lines.push(`Hit chance on ${enemyName(tgt)}: ${pc(info.hit)}`);
      else if (info && Array.isArray(info.hitAll) && info.hitAll.length) lines.push(`Hit chance: ${info.hitAll.map((x) => `${enemyName(x.u)} ${pc(x.chance)}`).join(', ')}`);
      const k = s.player.spells[id];
      return {
        cost: info && info.cost ? `${info.cost} ${resName}` : 'No cost', cd: info && info.cd ? `${info.cd} round cooldown` : null, lines,
        rank: k ? `Rank ${k.rank}` : null, flavour: info && info.text,
        trained: k && k.tl < s.player.level && !(sp.source === 'talent') ? `Trained to level ${k.tl}. A trainer can raise it to ${s.player.level}.` : null,
      };
    },
    itemScore(it) { if (!it || it.kind !== 'gear' || !st.player) return 0; try { return R.itemScore(it._raw || it, st.player.classId); } catch { return 0; } },
    /**
     * What an engage option would do to the tracks (R.engagePreview, rules 7.10; no draw): { enemies: [{ u, cancelled,
     * offBalance, window, pet }] } with turn numbers, or null when the action is not legal.
     */
    /** Test hook: the engine actions applied to this run so far (copies), for a Node twin to replay. */
    engineLog() { return local.engineLog.map((a) => ({ ...a })); },
    /**
     * Test hook (qa/browser/ui-regress.mjs part J): replace the run with a state saved by R.serialize, so a check can show a
     * state the real content never reaches (a dungeon boss without a visible wind-up: Disrupt greyed out with the engine's
     * reason). The presentation state starts afresh and the engine log is cleared (a twin cannot replay a loaded run).
     */
    testLoad(serialized) {
      st = R.deserialize(serialized, CONTENT);
      resetLocal();
      if (st.node && st.fight) local.introSeen.add(nodeKey(st));
      return true;
    },
    /** Test hook (qa/browser/ui-regress.mjs part K): the run as R.serialize has it. */
    serialized() { return R.serialize(st); },
    dev,
    /**
     * The map mode of new runs (the Dev menu's "Classic map (old)"; ?classic=1, ?expedition=1): { mapMode: 'rows' } or
     * { mapMode: 'expedition', prep } (prep: the start camp, on unless false; D116). At class select the run being created
     * takes it at once (class, pet, name, seed and Oaths kept); in a run it applies from the next one. Returns { ok, now }
     * (now: the run on screen changed).
     */
    setRunMode(m = {}) {
      const next = m.mapMode === 'rows' ? { mapMode: 'rows' } : { mapMode: 'expedition', prep: m.prep !== false, ...(runMode.dimming === false ? { dimming: false } : {}) };
      if (JSON.stringify(next) === JSON.stringify(runMode)) return { ok: true, now: false };
      runMode = next;
      if (st.phase === 'CREATE') { rebuildCreate(); local.engineLog = []; return { ok: true, now: true }; }
      return { ok: true, now: false };
    },
    runMode() { return { ...runMode }; },
    /** Why an engine action is not legal now (R.whyIllegal, capitalised), or null when it is (the prep screen's tooltips). */
    why(a) { try { const r = R.whyIllegal(st, a); return r ? reasonOf(r) : null; } catch { return null; } },
    /** Heat after a UI action (R.heatPreview, engine-api.md 11.2; no step), or null when it costs no time or is not legal. */
    heatPreview(action) {
      if (!R.heatPreview || !st.player) return null;
      const a = action && action.type === 'ENGINE' ? action.action : translate(action);
      if (!a) return null;
      try { return R.heatPreview(st, a); } catch { return null; }
    },
    engagePreview(option, target, spellId) {
      if (!R.engagePreview || !st.fight) return null;
      const o = (C.ENGAGE_OPTION || {})[option]; if (!o) return null;
      const a = o.target === 'spell' ? { type: 'ENGAGE', option, spellId, target: target ?? null } : { type: 'ENGAGE', option, target: target ?? null };
      try { return R.engagePreview(st, a); } catch { return null; }
    },
    /** Talent totals (R.talentInfo, engine-api.md 1; owner feedback 2026-11-11 08:14) for the talent tooltip. */
    talentInfo(id) {
      if (!R.talentInfo) return null;
      try { return R.talentInfo(st, id); } catch { return null; }
    },
    /** The character sheet's damage block (R.damageView, engine-api.md 1; owner feedback 2026-11-11 11:58). */
    damageView() {
      if (!R.damageView) return null;
      try { return R.damageView(st); } catch { return null; }
    },
  };
}

// ====================================================================================== bridge
export class Bridge {
  constructor(backend) {
    this.backend = backend;
    this.mode = backend.mode;
    this.data = backend.data;
    this.listeners = new Set();
    this.history = [];
    this._view = backend.view();
  }
  /** Current view (read-only by convention). */
  get view() { return this._view; }
  /** Send an action. Returns { ok, error, events, view }. */
  dispatch(action) {
    const r = this.backend.step(action);
    if (r.ok) {
      this.history.push(action);
      if (this.history.length > 5000) this.history.shift();
      this._view = this.backend.view();
      for (const fn of this.listeners) fn(this._view, r.events || [], action);
    }
    return { ok: r.ok, error: r.error, events: r.events || [], view: this._view };
  }
  /** The action the engine's autoplay policy (rules.md 7.9) picks for the current state. */
  autoAction() { return this.backend.autoAction(); }
  describeSpell(id, target = null) { return this.backend.describeSpell(id, target); }
  itemScore(item) { return this.backend.itemScore(item); }
  /** Test hook: the engine actions applied to the run (engine mode), or [] (mock). */
  engineLog() { return this.backend.engineLog ? this.backend.engineLog() : []; }
  /** Test hook: replace the run with a serialized engine state (engine mode; false in mock mode). Listeners see the new view. */
  testLoad(serialized) {
    if (!this.backend.testLoad) return false;
    this.backend.testLoad(serialized);
    this._view = this.backend.view();
    for (const fn of this.listeners) fn(this._view, [], { type: 'TEST_LOAD' });
    return true;
  }
  /**
   * Dev tools (engine-api.md 12; src/ui/dev-menu.js): run a dev op (engine backend dev(): R.debug on the run or the
   * profile). Listeners see the new view. Returns { ok, error, note, view }; mock mode: not available.
   */
  dev(op, args = {}) {
    if (!this.backend.dev) return { ok: false, error: 'The dev tools need the engine (not ?mock=1)', view: this._view };
    const r = this.backend.dev(op, args);
    if (r.ok) {
      this._view = this.backend.view();
      for (const fn of this.listeners) fn(this._view, [], { type: 'DEV', op });
    }
    return { ...r, view: this._view };
  }
  /** Test hook: the run as R.serialize has it (engine mode), or null. */
  serialized() { return this.backend.serialized ? this.backend.serialized() : null; }
  /**
   * The map mode of new runs ({ mapMode, prep }; engine mode). At class select the run on screen changes at once and
   * listeners see it; returns { ok, now, view }. The mock has none.
   */
  setRunMode(m) {
    if (!this.backend.setRunMode) return { ok: false, now: false, view: this._view };
    const r = this.backend.setRunMode(m);
    if (r.now) { this._view = this.backend.view(); for (const fn of this.listeners) fn(this._view, [], { type: 'RUN_MODE' }); }
    return { ...r, view: this._view };
  }
  /** The map mode new runs get ({ mapMode: 'rows' } or { mapMode: 'expedition', prep }), {} for the mock. */
  runMode() { return this.backend.runMode ? this.backend.runMode() : {}; }
  /** Why an engine action is not legal now (the engine's reason), or null; null in mock mode. */
  why(a) { return this.backend.why ? this.backend.why(a) : null; }
  /** Engage panel hover preview (combat v2, R.engagePreview); null in mock mode or when the option is not legal. */
  engagePreview(option, target, spellId) { return this.backend.engagePreview ? this.backend.engagePreview(option, target, spellId) : null; }
  /** Heat after a UI action (R.heatPreview); null in mock mode, for an action without time or an illegal one. */
  heatPreview(action) { return this.backend.heatPreview ? this.backend.heatPreview(action) : null; }
  /** Talent totals (R.talentInfo: per rank, now, next); null in mock mode. */
  talentInfo(id) { return this.backend.talentInfo ? this.backend.talentInfo(id) : null; }
  /** The character sheet's damage block (R.damageView: main attack, pet, bonus, value per point); null in mock mode. */
  damageView() { return this.backend.damageView ? this.backend.damageView() : null; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  get canDebug() { return !!this.backend.canDebug; }
}

/**
 * Create the bridge. Flags: ?mock=1 uses the mock engine, ?seed=N fixes the run seed. New runs (D116): the expedition map
 * with the start camp (newRun mapMode 'expedition', prep; rules 1.9, expedition.md 2); ?classic=1 (or opts.classic: the Dev
 * menu's "Classic map (old)") the classic map (mapMode 'rows'); ?expedition=1 (opts.expedition) the expedition without the
 * start camp (a test switch; ?prep=1 or opts.prep keeps it); with ?dimming=0 an expedition run without the Dimming (D50).
 */
export function createBridge(opts = {}) {
  const seedParam = params.get('seed');
  const seed = opts.seed ?? (seedParam !== null && seedParam !== '' ? Number(seedParam) >>> 0 : undefined);
  const useMock = opts.mock ?? params.get('mock') === '1';
  const classic = !!(opts.classic ?? params.get('classic') === '1');
  const prep = !!(opts.prep ?? params.get('prep') === '1') || !(opts.expedition ?? params.get('expedition') === '1');
  const runOpts = classic ? { mapMode: 'rows' } : { mapMode: 'expedition', prep, ...(params.get('dimming') === '0' ? { dimming: false } : {}) };
  return new Bridge(useMock ? mockBackend(seed) : engineBackend(seed, runOpts));
}

export const flags = {
  mock: params.get('mock') === '1',
  // the Dev menu (engine-api.md 12): on unless ?dev=0 (the settings can hide it too)
  dev: params.get('dev') !== '0',
  debug: params.get('debug') === '1',
  speed: params.get('speed'),
  expedition: params.get('expedition') === '1',
  // the start camp on the expedition map (prep): the default since D116; ?prep=1 keeps it with ?expedition=1
  prep: params.get('prep') === '1',
  // the classic map (old) for this page: ?classic=1; the Dev menu's setting keeps it between visits
  classic: params.get('classic') === '1',
};
