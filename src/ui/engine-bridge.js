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
//   hours, autoplay, seed, mode ('engine' | 'mock')
//   create:  { classId, petId, name, seed }
//   player:  { name, classId, className, petId, level, xp, xpToNext, rested, hp, maxHp,
//              res: { kind: 'energy'|'mana'|'focus', cur, max }, cp, cpMax, gold (copper),
//              stats: { sta, agi, int, spi, power, crit, critMult, dodge, armor, wd },
//              equip: { [slot]: item|null }, bag: (item|null)[], spells: [{ id, tl, rank }],
//              bar: (spellId|null)[7], itemBar: (consumableId|null)[3], talents: { id: rank },
//              talentPoints, talentSpent: { tree: n }, statuses: [{ id, rounds, stacks, value }],
//              boons: [{ id, name, nodesLeft }], resurrect: [source], resurrectHeld: { boon, meta, ember }, resurrectBoss: [source],
//              pet: { id, name, hp, maxHp, alive, statuses } | null }
//              resurrect: what a death would use now, in order ('boon' | 'meta' (Second Breath) | 'ember'; R.resurrectCharges);
//              resurrectBoss: the same in the end-boss fight; resurrectHeld (engine only): the charges held
//   zone:    { idx, id, camp, name, hubName, hubText, theme, band, exitLevel, travelLevel, blurb, rows: node[rows][lanes], pos: { row, lane }, path,
//              questsDone, storyDone, travelHours }   rows and lanes: as many as the engine's map has (mapView); travelLevel: the level
//              from which TRAVEL_ON is legal before the last row (rules 1.5, R.travelLevel); travelHours: what TRAVEL_ON
//              costs now (a dry step; null while it is not legal)
//   hub:     { used: { trainer, vendor, inn } }
//   node:    { type, step, cl, row, lane, ... }  step: intro|combat|reward|story|between|chest|rest|vendor|trainer|shrine
//   combat:  { round, enemies: [{ idx, uid, name, level, rank, arch, hp, maxHp, statuses, alive, intent }], target,
//              cooldowns: { spellId: roundsLeft }, potionCd, kind, isBoss, boss: { phase, asc, telegraph }, over, title, fightNo, fights }
//   data.rules: rule numbers that screens show in text, read from the engine's constants (rulesTable below)
//   loot:    { kind: 'loot'|'reward'|'story', title, text?, gold, xp, items?, choices? }
//   summary: run summary (rules.md 9)
//   camp:    { par, asc } at the camp (asc: the engine's Ascendancy if the boss were faced now), else null
//   legal:   { lanes, travelOn, mustTravel, outOfCombat, spells: { id: { ok, reason, cd } }, items: [{ ok, reason, count, cd }],
//              attack, flee, fleeChance?, services, talents, trainer }
//   oaths:   Oaths of the run (rules 11.5); create.oaths in CREATE
//   meta:    engine mode, CREATE and SUMMARY only (rules 11): the profile between runs, see metaView() below.
//   data.meta: the catalogue (R.C.META), Oaths (R.C.OATH) and the names and numbers its texts use.
// UI action META_BUY { id } (CREATE only): R.buyMeta on the stored profile; the run being created picks up the new profile.
// Events: { t: 'damage'|'heal'|'action'|'status'|'death'|'interrupt'|'skip'|'xp'|'levelUp'|'victory'|'flee'|'resurrect'|'bossPhase'|'summon'|... }

import * as R from '../rules.js';
import { CONTENT } from '../content/index.js';
import * as mock from './mock-engine.js';
import * as TXT from './ui-text.js';

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
    campGrindLevel: K.CAMP_GRIND_LEVEL, par: K.BOSS_TIME_PAR, ascStepHours: K.ASC_STEP_HOURS, cpMax: K.CP_MAX, potionCd: K.POTION_CD,
    hours: { trainer: K.HOURS_TRAINER, vendor: K.HOURS_VENDOR, inn: K.HOURS_REST, travel: K.HOURS_TRAVEL, grindWave: K.HOURS_GRIND_WAVE },
    linkPerShard: per ?? null, linkCap: K.LINK_DR, linkDr, shardAoeTaken: K.SHARD_AOE_TAKEN ?? null,
    // Round time budget at the default animation speed (rules 3, M2 v2); null on an engine without it.
    roundAnimMs: K.PACE_ROUND_ANIM_S != null ? K.PACE_ROUND_ANIM_S * 1000 : null,
    // Zone danger (rules 7.6, M2 v3): enemies above dangerFrom deal +dangerStep damage per 10 levels; null without it.
    dangerFrom: K.ZONE_DANGER_FROM ?? null, dangerStep: K.ZONE_DANGER_STEP ?? null,
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
    num: { maxLevel: K.MAX_LEVEL, travelHours: K.HOURS_TRAVEL, zoneCount: K.ZONE_COUNT, firstKill: K.ECHO_FIRST_KILL_CLASS, oathEcho: K.OATH_ECHO_BONUS, oathHaste: K.OATH_HASTE_HOURS, oathThrift: K.OATH_THRIFT_MULT },
    names: { boon: K.BOON.return.name, ember: K.CONSUMABLE.ember_of_return.name, potion: K.CONSUMABLE.healing_draught.name, greater: K.CONSUMABLE.greater_healing_draught.name, boss: K.BOSS_TEXT.name.split(',')[0], camp: (CONTENT.camp && CONTENT.camp.name) || 'the camp' },
    greaterHeal: K.CONSUMABLE.greater_healing_draught.heal,
    uniques: { rare: byZone('rare'), epic: byZone('epic'), weapon: Object.fromEntries(uniq.filter((u) => u.kind === 'weapon').map((u) => [u.classId, { name: u.name, text: u.text }])) },
    zones: zones.map((z) => z.name),
  };
}

// ====================================================================================== mock
function mockBackend(seed) {
  let state = mock.createState({ seed });
  const MC = mock.data.constants; // the mock's own simplified numbers
  // Screen texts use the rules table; the mock's own par replaces the engine's (the mock computes Ascendancy itself),
  // and the mock has no zone danger.
  const data = { ...mock.data, rules: { ...rulesTable(R.C), par: MC.BOSS_TIME_PAR, ascStepHours: MC.ASC_STEP, dangerFrom: null, dangerStep: null } };
  return {
    mode: 'mock', data, canDebug: true,
    view() {
      const camp = state.phase === 'CAMP' ? { par: MC.BOSS_TIME_PAR, asc: Math.min(MC.ASC_CAP, MC.ASC_PER * Math.floor(Math.max(0, state.hours - MC.BOSS_TIME_PAR) / MC.ASC_STEP)) } : null; // mock rule
      return { ...state, camp, legal: state.player ? mock.legalInfo(state) : { lanes: [], services: {}, items: [], spells: {} }, mode: 'mock' };
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
const RES_KEY = { boon: 'boon', second_breath: 'meta', ember: 'ember' }; // engine resurrect source -> view source
const USE_MAP = { any: 'both', both: 'both', out: 'out', combat: 'combat', passive: 'passive' };
const hash = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const reasonOf = (err) => { const m = String((err && err.message) || err || ''); const i = m.lastIndexOf(': '); return cap(i >= 0 ? m.slice(i + 2) : m); };

/** The stored meta profile, completed with the fields of R.newProfile() a stored copy may lack; null without one. */
function loadProfile() {
  try {
    const raw = globalThis.localStorage && localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw); const base = R.newProfile();
      if (p && typeof p === 'object') return { ...base, ...p, unlocks: { ...(p.unlocks || {}) }, firstKill: { ...base.firstKill, ...(p.firstKill || {}) } };
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

function engineBackend(seedOpt) {
  const C = R.C;
  let profile = loadProfile();
  let history = loadHistory();
  /** A run in CREATE. keep: { classId, petId } of the run before (the next run starts on the same class). */
  const mkRun = (seed, keep = {}) => {
    const classId = keep.classId || 'rogue'; const petId = classId === 'hunter' ? keep.petId || 'ridgewolf' : null;
    try { return R.newRun({ classId, petId, seed, content: CONTENT, profile: profile || undefined }); } catch (e) {
      try { return R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed, content: CONTENT, profile: profile || undefined }); } catch (e2) {
        profile = null; return R.newRun({ classId: 'rogue', seed, content: CONTENT });
      }
    }
  };
  let st = mkRun(seedOpt ?? randomSeed());
  const local = { introSeen: new Set(), spoils: null, hold: null, reward: null, fightNo: 0, lastRun: null, runNo: 0 };

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
    consumables: Object.fromEntries(Object.values(C.CONSUMABLE).map((c) => [c.id, { id: c.id, name: c.name, use: USE_MAP[c.use] || 'both', stack: c.stack, mana: !!c.mana, text: TXT.consumableText(c.id, CONTENT) }])),
    statuses: TXT.STATUS_INFO,
    boons: Object.fromEntries(Object.values(C.BOON).map((b) => [b.id, { id: b.id, name: b.name, text: TXT.boonText(b.id, CONTENT) }])),
    slots: C.SLOT_IDS, zones: CONTENT.zones, camp: CONTENT.camp,
    nodeHours: Object.fromEntries(Object.values(C.NODE_TYPE).map((t) => [t.id, t.hours])),
    boss: { name: C.BOSS_TEXT.name, intro: (CONTENT.camp && CONTENT.camp.bossText) || '' },
    rules: rulesTable(C),
    meta: metaData(C),
  };
  /** A pet that needs a meta unlock (Stormhawk) is locked until the profile owns it; refreshed after every purchase. */
  const refreshPets = () => { for (const pd of Object.values(data.pets)) pd.locked = !!pd.meta && !(profile && (profile.unlocks[pd.meta] || 0) > 0); };
  const consName = (id) => (C.CONSUMABLE[id] ? C.CONSUMABLE[id].name : null);
  // a damage or heal source: a spell, the pet, or a consumable (potions, Spark Flask)
  const spellName = (id) => (C.SPELL[id] ? C.SPELL[id].name : id === 'pet' ? 'Pet' : consName(id) || TXT.humanize(id));

  // ---------------------------------------------------------------- conversions
  const gearKind = (slot, cls) => (slot === 'weapon' ? { rogue: 'dagger', mage: 'staff', hunter: 'bow' }[cls] : slot === 'offhand' ? { rogue: 'dagger', mage: 'tome', hunter: 'quiver' }[cls] : slot);
  function item(it, cls, extra = {}) {
    if (!it) return null;
    if (it.kind === 'gear') {
      const s = it.stats || {};
      return { uid: it.uid, kind: 'gear', slot: it.slot, gearKind: gearKind(it.slot, cls), name: it.name, rarity: it.rarity, ilvl: it.ilvl,
        stats: { sta: s.STA || 0, agi: s.AGI || 0, int: s.INT || 0, spi: s.SPI || 0, power: it.power || 0, crit: it.crit || 0, armor: (it.armor || 0) + (it.bonusArmor || 0), wd: it.wd || 0 },
        effectText: it.effect ? TXT.UNIQUE_EFFECT_TEXT[it.effect] || null : null, unique: !!it.unique, _raw: it, ...extra };
    }
    if (it.kind === 'cons') { const c = C.CONSUMABLE[it.id] || { name: it.id, stack: 5 }; return { uid: it.uid, kind: 'consumable', id: it.id, name: c.name, rarity: it.id === 'ember_of_return' ? 'rare' : 'common', count: it.qty, stack: c.stack, use: USE_MAP[c.use] || 'both', _raw: it, ...extra }; }
    return { uid: it.uid, kind: 'junk', id: 'junk', name: it.name, rarity: 'junk', count: it.qty || 1, stack: 10, _raw: it, ...extra };
  }
  const statuses = (list, shield) => {
    const out = (list || []).map((x) => ({ id: x.id, rounds: x.dur == null ? 99 : x.dur, stacks: x.stacks || 1, value: x.value || 0 }));
    if (shield > 0 && !out.some((x) => x.id === 'WARD')) out.push({ id: 'WARD', rounds: 99, stacks: 1, value: shield });
    return out;
  };

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
      statuses: f ? statuses(f.p.st) : [], boons, resurrect, resurrectHeld, resurrectBoss,
      pet: p.pet ? { id: p.pet.id, name: C.PET[p.pet.id].name, hp: p.pet.hp, maxHp: d.petMaxHp, alive: p.pet.alive, statuses: f && f.pet ? statuses(f.pet.st) : [] } : null,
    };
  }

  function zoneContent(z) { return z >= 1 && z <= C.ZONE_COUNT ? CONTENT.zones[z - 1] : null; }
  function convZone(s) {
    const z = s.zone ? s.zone.z : 1;
    if (z > C.ZONE_COUNT || (s.zone && s.zone.camp)) {
      const camp = CONTENT.camp || {};
      return { idx: C.ZONE_COUNT + 1, id: 'camp', camp: true, name: camp.name || 'Observatory Steps', hubName: camp.name || 'Observatory Steps', hubText: camp.text, blurb: camp.text, theme: 'observatory',
        band: [C.MAX_LEVEL, C.MAX_LEVEL], exitLevel: C.MAX_LEVEL, travelLevel: null, rows: [], pos: { row: 0, lane: null }, path: [], questsDone: 0, storyDone: false };
    }
    const zc = zoneContent(z);
    const mv = R.mapView(s);
    const rows = mv ? mv.rows.map((row) => row.map((n) => {
      const out = { row: n.r, lane: n.l, type: n.type, cl: n.cl, visited: !!n.done, title: n.title, level: n.level };
      if (n.archetypes) out.enemyNames = n.archetypes.map(TXT.humanize); // one entry per enemy (grind: the first wave)
      if (n.type === 'elite') { out.eliteName = n.name || null; out.rare = n.rare; }
      if (n.type === 'dungeon') { out.dungeon = n.name; out.bossLevel = n.bossLevel; out.bossName = zc && CONTENT.enemies[zc.dungeon.boss] ? CONTENT.enemies[zc.dungeon.boss].name : ''; }
      if (n.type === 'quest' && n.title) { const q = Object.values(CONTENT.quests).find((x) => x.title === n.title); if (q) out.giver = q.giver; }
      return out;
    })) : [];
    const path = (s.zone.path || []).map((lane, i) => ({ row: i + 1, lane }));
    const exitLevel = C.ZONE_LEVELS * z; // rules 1.3: a zone's band ends at its exit level
    return { idx: z, id: `z${z}`, camp: false, name: zc ? zc.name : `Zone ${z}`, hubName: zc ? zc.hubName : 'Hub', hubText: zc ? zc.hubText : '', blurb: zc ? zc.theme : '',
      theme: THEMES[z - 1] || 'farmland', band: [exitLevel - C.ZONE_LEVELS + 1, exitLevel], exitLevel, travelLevel: R.travelLevel(s) ?? exitLevel, rows,
      pos: { row: s.zone.pos.r, lane: s.zone.pos.l }, path, questsDone: s.zone.questsDone || 0, storyDone: !!s.zone.storyDone, next: mv ? mv.next : [],
      travelHours: travelHours(s) };
  }
  /** Hours TRAVEL_ON spends now (meta Wayfinder: none), from a dry step; null while it is not legal. */
  function travelHours(s) {
    if (s.phase !== 'MAP' || !R.isLegal(s, { type: 'TRAVEL_ON' })) return null;
    try { return R.step(s, { type: 'TRAVEL_ON' }).state.hours - s.hours; } catch { return null; }
  }

  const rankOf = (e) => (e.boss ? 'boss' : e.kind === 'shard' ? 'shard' : e.kind || 'normal');
  function fightKey(s) { const n = s.node; return `${s.zone ? s.zone.z : 0}:${n ? `${n.r}:${n.l}` : `h${s.hours}`}:${s.fight ? s.fight.k : 0}:${s.fight ? s.fight.kind : ''}`; }
  function convIntent(it, e) {
    if (!it) return null;
    if (it.kind === 'boss') {
      const acts = it.actions || [];
      const lit = acts.find((a) => a.id === 'collapse_litany');
      const tg = it.telegraph || {};
      return { id: 'boss', name: acts.map((a) => a.name).join(' + ') || it.name, target: it.target || 'player', est: it.est || 0, cast: !!it.cast, heavy: !!it.heavy,
        channel: lit && lit.step ? [lit.step, 2] : null, label: lit && lit.step === 2 ? 'Resolves this round' : null,
        next: tg.crushNextRound ? 'Gravity Crush next round' : null, school: 'shadow', telegraph: tg, interrupted: !!it.interrupted };
    }
    const tgt = it.target === 'all' ? 'both' : typeof it.target === 'number' ? 'ally' : it.target || 'player';
    const label = { curse: 'Curse: you deal less damage', brace: 'Braces: takes less damage', shieldAlly: 'Shields an ally', heal: 'Heals an ally', selfHeal: 'Heals itself', selfShield: 'Shields itself', summon: 'Calls for help', cleave: 'Hits you and your pet', rend: 'Hit and bleed' }[it.kind] || null;
    const none = it.kind === 'none';
    return { id: none ? (it.name === 'Unaware' ? 'unaware' : 'none') : it.id, name: it.name, target: none ? 'none' : tgt, est: none ? 0 : it.est || 0, cast: !!it.cast, heavy: !!it.heavy,
      school: it.school || 'phys', hits: it.hits || 1, label, interrupted: !!(it.interrupted || it.skipped),
      selfHeal: it.kind === 'selfHeal', mend: it.kind === 'heal', shield: it.kind === 'selfShield', brace: it.kind === 'brace', curse: it.kind === 'curse' };
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
    const enemies = f.enemies.map((e) => ({ idx: e.idx, uid: `${key}:${e.idx}`, tplId: e.tid, name: e.name, level: e.level, rank: rankOf(e), arch: e.arch || (e.boss ? 'boss' : 'shard'),
      hp: e.hp, maxHp: e.maxHp, alive: e.alive, statuses: statuses(e.st, e.shield), intent: e.alive ? convIntent(e.intent, e) : null }));
    const cds = {};
    for (const [id, ready] of Object.entries(f.p.cds || {})) { const left = ready - f.round; if (left > 0) cds[id] = left; }
    const firstAlive = enemies.find((e) => e.alive);
    const bossE = f.enemies.find((e) => e.boss);
    const n = s.node;
    let title = ''; let fights = 1;
    if (n && n.type === 'dungeon') { fights = C.DUNGEON_TRASH_FIGHTS + 1; title = (zoneContent(s.zone.z) || { dungeon: { name: 'Dungeon' } }).dungeon.name; }
    if (n && n.type === 'grind') { fights = n.planned || 1; title = `Wave ${(n.wavesDone || 0) + 1} of ${n.planned}`; }
    return { round: f.round, enemies, target: f.p.target != null && enemies[f.p.target] && enemies[f.p.target].alive ? f.p.target : firstAlive ? firstAlive.idx : 0,
      cooldowns: cds, potionCd: Math.max(0, (f.p.potionReady || 0) - f.round), kind: f.kind === 'trash' ? 'dungeon' : f.kind, isBoss: f.kind === 'boss',
      boss: f.boss ? { phase: f.boss.phase, asc: f.boss.asc || 0, telegraph: bossE && bossE.intent ? bossE.intent.telegraph : null, linked: linkedOf(f) } : null,
      over: f.over, canFlee: f.canFlee, title, fightNo: (f.k || 0) + 1, fights };
  }

  function nodeKey(s) { return s.node ? `${s.zone.z}:${s.node.r}:${s.node.l}` : ''; }
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
    const v = { type: n.type, row: n.r, lane: n.l, cl: n.cl, fightNo: (n.k || 0) + 1, waves: n.wavesDone || 0, wavesChosen: n.planned || 0 };
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
    if (s.phase === 'MAP') { const mv = R.mapView(s); L.lanes = mv ? [...mv.next] : []; L.mustTravel = L.travelOn && !L.lanes.length; }
    for (const svc of ['trainer', 'vendor', 'inn']) L.services[svc] = has('SERVICE', (a) => a.service === svc);
    const f = s.fight;
    const tgt = f ? (f.enemies.find((e) => e.alive) || { idx: 0 }).idx : 0;
    for (const id of Object.keys(p.spells)) {
      if (!f) { L.spells[id] = { ok: false, reason: 'Only in combat' }; continue; }
      const ok = has('CAST', (a) => a.spellId === id);
      const cd = f.p.cds && f.p.cds[id] ? Math.max(0, f.p.cds[id] - f.round) : 0;
      if (ok) L.spells[id] = { ok: true, cd };
      else {
        const target = C.SPELL[id] && C.SPELL[id].target === 'enemy' ? tgt : null;
        L.spells[id] = { ok: false, cd, reason: p.bar.includes(id) ? reasonOf(R.whyIllegal(s, { type: 'CAST', spellId: id, target }) || 'Not usable now') : 'Not on the action bar' };
      }
    }
    L.items = p.itemBar.map((id, slot) => {
      if (!id) return { ok: false, reason: 'Empty', count: 0 };
      const count = p.bag.reduce((a, it) => a + (it.kind === 'cons' && it.id === id ? it.qty : 0), 0);
      const cd = f ? Math.max(0, (f.p.potionReady || 0) - f.round) : 0;
      const ok = f ? has('USE_ITEM', (a) => a.slot === slot) : has('USE_ITEM', (a) => a.itemId === id);
      const reason = ok ? null : count ? reasonOf(R.whyIllegal(s, f ? { type: 'USE_ITEM', slot, target: null } : { type: 'USE_ITEM', itemId: id }) || 'Not usable now') : 'None left';
      return { ok, reason, count, cd: C.CONSUMABLE[id] && C.CONSUMABLE[id].potion ? cd : 0 };
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
    const death = sm.death ? { killer: sm.death.killer ? sm.death.killer.name : 'unknown', ability: TXT.humanize(sm.death.killer ? sm.death.killer.ability : ''), node: sm.death.nodeType || '', round: sm.death.round } : null;
    return {
      outcome: sm.outcome, name: sm.name, classId: sm.classId, className: sm.className, petId: sm.petId, level: sm.level, xp: sm.xp,
      zone: z.camp ? ((CONTENT.camp && CONTENT.camp.name) || 'the camp') : zc ? zc.name : '', zoneIdx: z.camp ? 7 : z.zone, row: z.camp ? 0 : z.row,
      hours: sm.hours, asc: sm.ascendancy || 0, seed: sm.seed, death, kills: sm.kills, quests: sm.quests, story: sm.stories, dungeons: sm.dungeons,
      fights: sm.fights, rounds: sm.rounds, goldEarned: sm.gold.earned, goldSpent: sm.gold.spent, potions: sm.potionsUsed, resurrects: sm.resurrectsUsed,
      dealt: sm.damage.dealt, taken: sm.damage.taken, topSpells: (sm.topSpells || []).map((t) => [spellName(t.id), t.dmg]),
      equipped: (sm.equipped || []).map((e) => ({ uid: `sum-${e.slot}`, kind: 'gear', slot: e.slot, name: e.name, rarity: e.rarity, ilvl: e.ilvl, stats: {} })),
      estMinutes: { manual: Math.round(sm.minutes.manual), auto: Math.round(sm.minutes.autoplay) }, bossPhase: sm.bossPhase,
      echoes: ((sm.echoes && sm.echoes.lines) || []).map((l) => [`${TXT.ECHO_LINE[l.id] || TXT.humanize(l.id)}${l.count > 1 ? ` (${l.count})` : ''}`, l.echoes]),
      echoTotal: sm.echoes ? sm.echoes.total : 0,
      // Oaths (rules 11.5): the engine's multiplier on the sum of the lines
      echoMult: sm.echoes ? sm.echoes.oathMult : 1, oaths: (sm.oaths || []).map((o) => (C.OATH[o] ? C.OATH[o].name : TXT.humanize(o))),
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
    let s = R.newRun({ classId: c.classId, petId: c.classId === 'hunter' ? c.petId : null, name: c.name || '', seed: c.seed, profile, content: CONTENT });
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
      oathsOwned: create ? R.isLegal(s, { type: 'SET_OATH', oath: C.OATH_IDS[0], on: true }) : (p.unlocks.oaths || 0) > 0,
      history: { logged: history.logged || 0, classes: Object.fromEntries(C.CLASS_IDS.map((id) => { const c = history.classes[id] || {}; return [id, { runs: c.runs || 0, kills: c.kills || 0, bestLevel: c.bestLevel || 0, best: stageText(c.bestStage, c.bestPhase), firstKill: !!p.firstKill[id] }]; })) },
      lastRun: local.lastRun,
      next: create ? nextRun(s) : null,
      after: s.phase === 'SUMMARY' ? afterRun(s) : null,
    };
  }

  function view() {
    const s = st;
    const v = { hours: s.hours || 0, autoplay: !!s.autoplay, seed: s.create ? s.create.seed : s.seed, mode: 'engine' };
    if (s.phase === 'CREATE') {
      return { ...v, phase: 'CREATE', create: { classId: s.create.classId || 'rogue', petId: s.create.petId || 'ridgewolf', name: s.create.name || '', seed: s.create.seed, oaths: (s.create.oaths || []).slice() }, oaths: (s.create.oaths || []).slice(), meta: metaView(s), player: null, zone: null, node: null, combat: null, loot: null, summary: null, legal: { lanes: [], services: {}, items: [], spells: {} } };
    }
    v.oaths = (s.oaths || []).slice();
    v.phase = s.phase === 'ENDED' ? 'SUMMARY' : s.phase;
    v.player = convPlayer(s);
    v.zone = convZone(s);
    v.hub = s.hub || { used: {} };
    v.node = convNode(s);
    v.combat = convFight(s);
    v.loot = null;
    v.summary = v.phase === 'SUMMARY' ? convSummary(s) : null;
    v.meta = v.phase === 'SUMMARY' ? metaView(s) : null;
    v.camp = s.phase === 'CAMP' && !s.fight && !s.service ? { par: C.BOSS_TIME_PAR, asc: dryBossAsc(s) } : null;
    if (v.phase === 'CAMP' && s.fight) v.phase = 'NODE';
    if (v.node && v.node.step === 'intro' && s.fight) v.combat = null; // the intro dialog is read before the fight is shown
    const win = (s.loot || []).map((it) => item(it, s.player.classId, { pending: true }));
    if (local.hold) { v.phase = 'NODE'; v.node = local.hold.node; v.combat = null; }
    if (local.spoils) {
      const sp = local.spoils;
      v.phase = sp.phase || 'NODE'; v.node = sp.node; v.combat = sp.combat;
      v.loot = { kind: 'loot', title: sp.title, gold: sp.gold, xp: sp.xp, trap: sp.trap, items: [...win, ...sp.items.filter((it) => it.inBag)] };
    } else if (win.length) {
      v.loot = { kind: 'loot', title: 'Items waiting', gold: 0, xp: 0, items: win, windowOnly: true };
    } else if (s.node && s.node.stage === 'reward' && s.node.rewards[0].kind === 'items') {
      const r0 = s.node.rewards[0]; const q = CONTENT.quests[s.node.quest] || {};
      const rw = local.reward || {};
      v.loot = r0.story
        ? { kind: 'story', title: `${v.zone.name}: the story is told`, text: 'Three tasks done; the people of this land will remember your name.', xp: rw.storyXp || 0, gold: 0, choices: r0.items.map((it) => item(it, s.player.classId)) }
        : { kind: 'reward', title: q.title || 'Quest', giver: q.giver, text: q.turnIn || '', xp: rw.xp || 0, gold: rw.gold || 0, choices: r0.items.map((it) => item(it, s.player.classId)) };
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
          if (e.kind === 'flee') { out.push({ t: 'flee', ok: !!e.success }); break; }
          if (e.kind === 'skip') { out.push({ t: 'skip', src: ref('player'), reason: 'Frozen in time' }); break; }
          if (e.cost) res = Math.max(0, res - e.cost);
          const sp = e.spell ? C.SPELL[e.spell] : null;
          const kind = e.kind === 'cast' ? 'spell' : e.kind;
          out.push({ t: 'action', src: ref('player'), kind, id: e.spell || e.item, name: sp ? sp.name : e.item ? (C.CONSUMABLE[e.item] || {}).name || e.item : C.CLASS[s.player.classId].basic.name,
            school: sp ? sp.school || 'arcane' : C.CLASS[s.player.classId].basic.school, dst: e.target != null ? ref(e.target) : null, aoe: !!(sp && sp.tags && sp.tags.includes('aoe')), tags: sp ? sp.tags : [], resAfter: kind === 'spell' ? res : undefined });
          break;
        }
        case 'petAction': out.push({ t: 'action', src: ref('pet'), kind: 'attack', name: 'Pet attack', dst: ref(e.target) }); break;
        case 'enemyAction': {
          const it = prevIntent(e.u) || {};
          out.push({ t: 'action', src: ref(e.u), kind: it.cast ? 'cast' : 'attack', id: e.id, name: e.name, dst: it.target === 'pet' ? ref('pet') : ref('player'), heavy: !!it.heavy, school: it.school || 'phys', boss: it.id === 'boss' });
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
        case 'heal': { const k = key(e.dst); const m = max.get(k) ?? Infinity; const after = Math.min(m, (hp.get(k) ?? 0) + (e.amount || 0)); hp.set(k, after); out.push({ t: 'heal', dst: ref(e.dst), amount: e.amount || 0, name: e.spell ? spellName(e.spell) : lastUsed || 'Healing', hpAfter: after, maxHp: max.get(k) }); break; }
        case 'petRevive': hp.set('pet', e.hp); out.push({ t: 'heal', dst: ref('pet'), amount: e.hp, name: 'Revive', hpAfter: e.hp, maxHp: max.get('pet') }); break;
        case 'mana': res = Math.max(0, res + (e.amount || 0)); out.push({ t: 'resource', amount: e.amount, after: res }); break;
        case 'status': out.push({ t: 'status', dst: ref(e.u), id: e.id, op: e.on ? 'add' : 'remove', stacks: e.stacks }); break;
        case 'interrupt': out.push({ t: 'interrupt', dst: ref(e.u), name: (prevIntent(e.u) || {}).name || 'cast' }); break;
        case 'skip': out.push({ t: 'skip', src: ref(e.u), reason: 'Time stopped' }); break;
        case 'channel': out.push({ t: 'channel', src: ref(e.u), name: e.name, step: e.step }); break;
        case 'summon': hp.set(`e${e.u}`, e.hp); max.set(`e${e.u}`, e.hp); out.push({ t: 'summon', idxs: [e.u], names: [e.name] }); break;
        case 'despawn': out.push({ t: 'death', dst: ref(e.u), name: enemyName(e.u), despawn: true }); break;
        case 'linked': out.push({ t: 'linked', on: !!e.on, n: e.n ?? null }); break;
        case 'shield': out.push({ t: 'status', dst: ref(e.u), id: 'WARD', op: 'add' }); break;
        case 'enrage': out.push({ t: 'status', dst: ref(e.u), id: 'ENRAGED', op: 'add' }); break;
        case 'image': out.push({ t: 'damage', src: ref(e.src), dst: ref('player'), amount: 0, miss: true, name: 'Mirror image', school: 'arcane', hpAfter: hp.get('player'), maxHp: max.get('player') }); break;
        case 'phaseChange': out.push({ t: 'bossPhase', phase: e.phase, name: e.phase === 2 ? 'The Dimming' : 'Eclipse', text: e.phase === 2 ? TXT.linkedText(data.rules, 'banner') : 'The light dies. Oruvath grows stronger every round.' }); break;
        case 'death':
          if (e.u === 'player') { out.push({ t: 'death', dst: ref('player'), name: s.player.name }); if (s.phase === 'SUMMARY' || s.phase === 'ENDED') out.push({ t: 'defeat' }); }
          else { hp.set(key(e.u), 0); out.push({ t: 'death', dst: ref(e.u), name: e.name || enemyName(e.u) }); }
          break;
        case 'resurrect': hp.set('player', s.player.hp); out.push({ t: 'resurrect', source: { boon: 'Boon of Return', second_breath: 'Second Breath', ember: 'Ember of Return' }[e.source] || 'A resurrection', hpAfter: s.player.hp, maxHp: s.player.d.maxHp }); break;
        case 'xp': if (e.amount > 0) out.push({ t: 'xp', amount: e.amount, rested: e.rested || 0, why: e.why }); break;
        case 'levelUp': out.push({ t: 'levelUp', level: e.level, talentPoint: !!e.talentPoint, newSpells: Object.values(C.SPELL).filter((sp) => sp.cls === s.player.classId && sp.source === 'class' && sp.lvl === e.level).map((sp) => sp.name), hp: s.player.hp, maxHp: s.player.d.maxHp }); break;
        case 'gold': if (e.amount > 0 && e.why !== 'sell') out.push({ t: 'gold', amount: e.amount, why: e.why }); break; // a sale says its price itself
        case 'loot': out.push({ t: 'gotItem', name: e.item.name || (C.CONSUMABLE[e.item.id] || {}).name || 'item', rarity: e.item.rarity || 'common', to: e.to }); break;
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
        default: break;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- actions
  function apply(action, events) {
    const r = R.step(st, action);
    st = r.state;
    events.push(...r.events);
    return r;
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
            recordRun(sum);
            local.lastRun = { n: ++local.runNo, name: sum.name, classId: sum.classId, className: sum.className, outcome: sum.outcome, level: sum.level,
              gained: st.result.echoes, before, after: profile.echoes, firstKill: ((sum.echoes && sum.echoes.lines) || []).some((l) => l.id === 'firstKill') };
          }
          st = mkRun(randomSeed(), keep); // the next run starts on the same class
          local.introSeen.clear(); local.spoils = null; local.hold = null; local.reward = null;
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
      if (err && err.code === 'ILLEGAL_ACTION') return { ok: false, error: reasonOf(err) };
      throw err;
    }
    afterStep(prev, events);
    return { ok: true, events: convEvents(prev, events, st) };
  }

  /** Presentation holds after a step: spoils window, rest screen, unopened chest. */
  function afterStep(prev, events) {
    const has = (t) => events.some((e) => e.t === t);
    const sum = (t, pred) => events.filter((e) => e.t === t && (!pred || pred(e))).reduce((a, e) => a + (e.amount || 0), 0);
    const items = events.filter((e) => e.t === 'loot').map((e) => item(e.item, st.player ? st.player.classId : 'rogue', { inBag: e.to === 'bag', pending: e.to === 'window' }));
    if (events.some((e) => e.t === 'questComplete')) local.reward = { xp: sum('xp', (e) => e.why === 'quest'), gold: sum('gold', (e) => e.why === 'quest' && e.amount > 0), storyXp: sum('xp', (e) => e.why === 'story') };
    const entered = events.find((e) => e.t === 'node');
    if (entered && entered.type === 'rest' && has('rest')) {
      local.hold = { node: { type: 'rest', step: 'rest', row: entered.r, lane: entered.l, cl: entered.cl } };
      return;
    }
    if (entered && entered.type === 'treasure' && !st.fight && has('nodeDone')) {
      local.hold = { node: { type: 'treasure', step: 'chest', row: entered.r, lane: entered.l, cl: entered.cl, text: lineFor(zoneContent(st.zone.z) && zoneContent(st.zone.z).treasureLines, { node: { r: entered.r, l: entered.l }, zone: st.zone }) },
        gold: sum('gold', (e) => e.why === 'treasure'), trap: sum('trap'), items };
      return;
    }
    if (has('victory') && st.phase !== 'SUMMARY' && st.phase !== 'ENDED') {
      const pc = prev.combat ? { ...prev.combat, over: 'victory', enemies: prev.combat.enemies.map((e) => ({ ...e, alive: false, hp: 0, intent: null })) } : null;
      const kind = prev.combat ? prev.combat.kind : '';
      local.spoils = {
        title: kind === 'dboss' ? `${(prev.node && prev.node.dungeon) || 'Dungeon'} cleared` : prev.node && prev.node.type === 'treasure' ? 'Treasure chest' : 'Loot',
        phase: 'NODE', node: prev.node ? { ...prev.node, step: 'combat' } : { type: 'camp_grind', step: 'combat', cl: C.CAMP_GRIND_LEVEL },
        combat: pc, gold: sum('gold', (e) => e.amount > 0 && e.why !== 'quest'), xp: sum('xp', (e) => e.why !== 'quest' && e.why !== 'story'), trap: sum('trap') > 0, items,
      };
    }
  }

  return {
    mode: 'engine', data, canDebug: false,
    view,
    step,
    autoAction() { const a = st.phase === 'ENDED' ? null : R.autoAction(st); return a ? { type: 'ENGINE', action: a } : { type: 'PASS' }; },
    describeSpell(id) {
      const s = st; const sp = C.SPELL[id]; if (!sp || !s.player) return null;
      const f = s.fight;
      const tgt = f ? (f.enemies.find((e) => e.alive) || { idx: 0 }).idx : null;
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
      const k = s.player.spells[id];
      return {
        cost: info && info.cost ? `${info.cost} ${resName}` : 'No cost', cd: info && info.cd ? `${info.cd} round cooldown` : null, lines,
        rank: k ? `Rank ${k.rank}` : null, flavour: info && info.text,
        trained: k && k.tl < s.player.level && !(sp.source === 'talent') ? `Trained to level ${k.tl}. A trainer can raise it to ${s.player.level}.` : null,
      };
    },
    itemScore(it) { if (!it || it.kind !== 'gear' || !st.player) return 0; try { return R.itemScore(it._raw || it, st.player.classId); } catch { return 0; } },
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
  describeSpell(id) { return this.backend.describeSpell(id); }
  itemScore(item) { return this.backend.itemScore(item); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  get canDebug() { return !!this.backend.canDebug; }
}

/** Create the bridge. Flags: ?mock=1 uses the mock engine, ?seed=N fixes the run seed. */
export function createBridge(opts = {}) {
  const seedParam = params.get('seed');
  const seed = opts.seed ?? (seedParam !== null && seedParam !== '' ? Number(seedParam) >>> 0 : undefined);
  const useMock = opts.mock ?? params.get('mock') === '1';
  return new Bridge(useMock ? mockBackend(seed) : engineBackend(seed));
}

export const flags = {
  mock: params.get('mock') === '1',
  debug: params.get('debug') === '1',
  speed: params.get('speed'),
};
