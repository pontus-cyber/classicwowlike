// Mock rules engine for the visual client. Used until src/rules.js can complete a run, and later
// only behind the ?mock=1 flag. It follows docs/specs/rules.md for phases (1.1), action names, node
// flow (2), combat with intents (7) and the end boss (10), with simplified numbers. It is NOT the
// rules engine: src/ui/engine-bridge.js is the only module that talks to it, and the UI only ever
// sees the view shape documented there.
//
// API: createState(opts) -> state; step(state, action) -> { ok, error, state, events };
//      legalInfo(state) -> legal; autoAction(state) -> action; data -> static tables.
import * as D from './mock-data.js';
import { CONTENT } from '../content/index.js';

// Content (src/content, schema in src/content/SCHEMA.md) supplies names and text; the mock falls back
// to its own placeholders where a table is missing.
const CT = CONTENT || {};
const zoneCt = (z) => (CT.zones && CT.zones[z - 1]) || null;
const enemyCt = (id) => (CT.enemies && CT.enemies[id]) || null;
const abilityCt = (id) => (CT.abilities && CT.abilities[id]) || null;
const questCt = (id) => (CT.quests && CT.quests[id]) || null;

const C = {
  MAX_LEVEL: 60, ZONE_LEVELS: 10, ROWS: 8, LANES: 3, BAG_SLOTS: 16, BAR: 7, ITEM_BAR: 3,
  W: { quest: 38, grind: 14, elite: 14, rest: 12, vendor: 6, trainer: 4, treasure: 6, shrine: 6 },
  HOURS: { quest: 2, grind: 1, elite: 2, dungeon: 5, rest: 4, vendor: 1, trainer: 1, treasure: 1, shrine: 1, travel: 2, inn: 4 },
  BOSS_TIME_PAR: 130, ASC_STEP: 10, ASC_PER: 0.04, ASC_CAP: 0.4,
  ENERGY_REGEN: 30, FOCUS_REGEN: 25, MANA_REGEN: 0.02, POTION_CD: 4,
  MOB_XP_FRAC: 0.2, QUEST_XP: 0.8, STORY_XP: 0.8, GRIND_WAVE_XP: 0.1, DUNGEON_CLEAR_XP: 0.6,
  ELITE_XP: 6, RARE_XP: 8, DBOSS_XP: 8, REST_RESTED: 0.6, RESTED_CAP: 1.5,
  // mock-only softening so demo runs progress; the real balance lives in src/constants.js
  MOCK_ENEMY_DMG: 0.75, MOCK_REGEN_BASE: 0.30,
};

// ------------------------------------------------------------------ helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const xpToNext = (L) => 20 * L * L + 180 * L + 200;
const V = (L) => Math.round(10 + 3 * Math.pow(Math.max(1, L), 1.5));
const R = (L) => 4 * L + 20;
const CL = (z, r) => C.ZONE_LEVELS * (z - 1) + 1 + Math.floor(((r - 1) * (C.ZONE_LEVELS - 1)) / (C.ROWS - 1));

function hashSeed(x) {
  let h = 2166136261 >>> 0; const s = String(x);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rnd(st) {
  st._rng = (st._rng + 0x6D2B79F5) | 0;
  let t = st._rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (st, arr) => arr[Math.floor(rnd(st) * arr.length)];
function weighted(st, entries) { // [[value, weight]]
  const total = entries.reduce((a, e) => a + e[1], 0);
  let r = rnd(st) * total;
  for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
  return entries[entries.length - 1][0];
}
const ev = (st, e) => { st.events.push(e); return e; };
const uid = (st) => `i${st._uid++}`;

// ------------------------------------------------------------------ state
export function createState(opts = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  return {
    phase: 'CREATE', hours: 0, autoplay: false, seed, _rng: hashSeed(seed), _uid: 1,
    create: { classId: 'rogue', petId: 'ridgewolf', name: '', seed: null },
    player: null, zone: null, node: null, combat: null, loot: null, summary: null, hub: null,
    run: { kills: { normal: 0, elite: 0, rare: 0, boss: 0 }, quests: 0, story: 0, dungeons: 0, nodes: {}, fights: 0, rounds: 0,
      goldEarned: 0, goldSpent: 0, potions: 0, resurrects: 0, dealt: 0, taken: 0, bySpell: {}, zonesLeft: 0, bossPhase: 0 },
    events: [],
  };
}

function makePlayer(st) {
  const c = st.create; const cls = D.CLASSES[c.classId];
  const firstSpells = Object.values(D.SPELLS).filter((s) => s.cls === c.classId && s.lvl === 1 && !s.fx.meta && !s.fx.talent).map((s) => s.id);
  const p = {
    name: (c.name || '').trim() || { rogue: 'Vessa', mage: 'Aldren', hunter: 'Kael' }[c.classId],
    classId: c.classId, className: cls.name, petId: c.classId === 'hunter' ? c.petId : null,
    level: 1, xp: 0, xpToNext: xpToNext(1), rested: 0, gold: 50,
    hp: 1, maxHp: 1, res: { kind: cls.resource, cur: 0, max: 0 }, cp: 0, cpMax: 5,
    stats: {}, equip: Object.fromEntries(D.SLOTS.map((s) => [s, null])), bag: new Array(C.BAG_SLOTS).fill(null),
    spells: firstSpells.map((id) => ({ id, tl: 1, rank: 1 })), bar: [...firstSpells, null, null, null, null, null],
    itemBar: ['healing_draught', c.classId === 'mage' ? 'mana_draught' : 'trail_rations', null],
    talents: {}, talentPoints: 0, statuses: [], boons: [], resurrect: [], elixirNodes: 0, pet: null,
  };
  p.itemBar = [null, null, null];
  const ctc = (CT.classes && CT.classes[c.classId]) || {};
  p.equip.weapon = gear(st, 'weapon', 1, 'common', c.classId, ctc.startWeapon || cls.startWeapon);
  p.equip.chest = gear(st, 'chest', 1, 'common', c.classId, ctc.startChest || { rogue: 'Patched Leather Vest', mage: 'Novice Robe', hunter: 'Trapper Jerkin' }[c.classId]);
  if (p.petId) {
    const pd = D.PETS[p.petId];
    p.pet = { id: pd.id, name: pd.name, hp: 1, maxHp: 1, alive: true, statuses: [] };
  }
  recalc(p);
  p.hp = p.maxHp; p.res.cur = p.res.max; if (p.pet) p.pet.hp = p.pet.maxHp;
  bagAdd(st, p, consumable(st, 'trail_rations', 2));
  bagAdd(st, p, consumable(st, 'healing_draught', 2));
  p.itemBar = ['healing_draught', null, null];
  return p;
}

function recalc(p) {
  const cls = D.CLASSES[p.classId]; const L = p.level;
  const it = { sta: 0, agi: 0, int: 0, spi: 0, power: 0, crit: 0, armor: 0, wd: 0 };
  for (const s of D.SLOTS) { const g = p.equip[s]; if (g) for (const k in it) it[k] += g.stats[k] || 0; }
  const t = p.talents; const tr = (id) => t[id] || 0;
  const base = (k) => Math.round(cls.base[k][0] + cls.base[k][1] * (L - 1));
  const sta = base('sta') + it.sta, agi = base('agi') + it.agi, int = base('int') + it.int, spi = base('spi') + it.spi;
  const primary = cls.primary === 'agi' ? agi : int;
  const hpPct = 0.03 * tr('m_b2') + 0.04 * tr('h_c1');
  const oldMax = p.maxHp;
  p.maxHp = Math.round((cls.hpBase + cls.hpPerLevel * (L - 1) + 10 * sta) * (1 + hpPct));
  const power = Math.round((primary + it.power) * (1 + 0.03 * tr('m_c2')));
  const crit = Math.min(0.5, 0.05 + (0.12 * primary) / R(L) + it.crit + 0.03 * tr('r_a1') + 0.02 * tr('h_b2'));
  const dodge = Math.min(0.75, cls.dodgeBase + (cls.dodgeFromAgi * agi) / R(L) + 0.02 * tr('r_b2') + 0.03 * tr('h_c5'));
  const armor = Math.round(cls.armorBase + cls.armorPerLevel * (L - 1) + cls.armorMult * it.armor);
  p.stats = { sta, agi, int, spi, power, crit, critMult: 1.5 + 0.2 * tr('r_a5') + 0.2 * tr('h_b4'), dodge, armor, wd: it.wd };
  if (cls.resource === 'mana') p.res.max = Math.round((50 + 12 * (L - 1) + 6 * int) * (1 + 0.05 * tr('m_c1')));
  else p.res.max = 100;
  p.res.baseMana = Math.round(50 + 12 * (L - 1) + 6 * base('int'));
  if (oldMax > 1 && p.maxHp > oldMax) p.hp += p.maxHp - oldMax;
  p.hp = Math.min(p.hp, p.maxHp);
  p.res.cur = Math.min(p.res.cur, p.res.max);
  if (p.pet) {
    const pd = D.PETS[p.pet.id];
    const old = p.pet.maxHp;
    p.pet.maxHp = Math.round(pd.hpPct * p.maxHp * (1 + 0.08 * tr('h_a1')));
    if (old > 1 && p.pet.maxHp > old) p.pet.hp += p.pet.maxHp - old;
    p.pet.hp = Math.min(p.pet.hp, p.pet.maxHp);
  }
  p.talentSpent = {};
  for (const [id, r] of Object.entries(p.talents)) { const tree = D.TALENTS[id].tree; p.talentSpent[tree] = (p.talentSpent[tree] || 0) + r; }
}

// ------------------------------------------------------------------ items
function itemScore(item, classId) {
  if (!item || item.kind !== 'gear') return 0;
  const prim = D.CLASSES[classId].primary; const s = item.stats;
  return Math.round(((s[prim] || 0) * 1 + (s.sta || 0) * 0.6 + (s.spi || 0) * 0.3 + (s.power || 0) * 1.1 + (s.crit || 0) * 150 + (s.armor || 0) * 0.02 + (classId === 'mage' ? 0 : (s.wd || 0) * 2)) * 10) / 10;
}

function gear(st, slot, cl, rarity, classId, fixedName) {
  const rr = D.RARITY[rarity];
  const ilvl = Math.min(63, Math.max(1, cl + (rr.ilvl || 0)));
  const B = Math.max(1, Math.round(ilvl * 0.6 * D.SLOT_W[slot] * rr.mult * 2.2));
  const A = rr.affix ? Math.round(0.25 * B) : 0;
  const prim = rnd(st) < 0.7 ? D.CLASSES[classId].primary : (D.CLASSES[classId].primary === 'agi' ? 'int' : 'agi');
  const stats = {};
  const pts = B - A;
  if (rr.stats === 1) stats[rnd(st) < 0.5 ? prim : 'sta'] = pts;
  else if (rr.stats === 2) { stats[prim] = Math.max(1, Math.round(pts * 0.6)); stats[rnd(st) < 0.7 ? 'sta' : 'spi'] = Math.max(1, pts - Math.round(pts * 0.6)); }
  else { stats[prim] = Math.max(1, Math.round(pts * 0.45)); stats.sta = Math.max(1, Math.round(pts * 0.35)); stats.spi = Math.max(1, pts - stats[prim] - stats.sta); }
  if (A) { const a = pick(st, ['crit', 'power', 'armor']); if (a === 'crit') stats.crit = Math.round(0.015 * D.SLOT_W[slot] * (rarity === 'epic' ? 1.4 : 1) * 1000) / 1000; else if (a === 'power') stats.power = A; else stats.armor = (stats.armor || 0) + A * 10; }
  if (['head', 'chest', 'legs', 'hands', 'feet'].includes(slot)) stats.armor = (stats.armor || 0) + Math.round(5 * ilvl * D.SLOT_W[slot] * rr.mult);
  if (slot === 'weapon') stats.wd = Math.round((4 + 1.8 * ilvl) * rr.mult);
  let kind = slot;
  const cls = D.CLASSES[classId];
  if (slot === 'weapon') kind = cls.weaponKind;
  if (slot === 'offhand') kind = cls.offhandKind;
  let name = fixedName;
  if (!name) name = gearName(st, slot, ilvl, stats, rarity, prim, cls);
  const sell = Math.max(1, Math.round(V(ilvl) * D.SLOT_W[slot] * ({ common: 0.5, uncommon: 1, rare: 2.5, epic: 6 }[rarity])));
  const it = { uid: uid(st), kind: 'gear', slot, gearKind: kind, name, rarity, ilvl, stats, sell };
  return it;
}
function gearName(st, slot, ilvl, stats, rarity, prim, cls) {
  const band = CT.itemNames && CT.itemNames[Math.min(5, Math.floor((ilvl - 1) / 10))];
  let base;
  if (band && band[slot]) { const b = band[slot]; base = pick(st, Array.isArray(b) ? b : (b[prim.toUpperCase()] || b.AGI || Object.values(b)[0])); }
  else base = pick(st, D.ITEM_BASES[slot === 'weapon' ? `weapon_${cls.weaponKind}` : slot === 'offhand' ? `offhand_${cls.offhandKind}` : slot]);
  const sig = ['agi', 'int', 'sta', 'spi'].filter((k) => (stats[k] || 0) > 0).map((k) => k.toUpperCase()).join('_');
  const aw = CT.affixWords;
  let suffix = '';
  if (aw && aw.suffix) {
    const list = aw.suffix[sig] || aw.suffix[sig.split('_').slice(0, 2).join('_')] || aw.suffix[sig.split('_')[0]];
    if (list) suffix = pick(st, list);
  } else suffix = D.ITEM_SUFFIX[sig.toLowerCase()] || '';
  let prefix = '';
  const affix = stats.crit ? 'crit' : stats.power ? 'power' : null;
  if ((rarity === 'rare' || rarity === 'epic') && aw && aw.prefix) { const l = aw.prefix[affix || 'armor']; if (l) prefix = pick(st, l) + ' '; }
  if (rarity === 'common') return base;
  return `${prefix}${base}${suffix ? ' ' + suffix : ''}`;
}
function consumable(st, id, count = 1) {
  const c = D.CONSUMABLES[id];
  return { uid: uid(st), kind: 'consumable', id, name: c.name, rarity: id === 'ember_of_return' ? 'rare' : 'common', count, stack: c.stack, sell: 1, use: c.use };
}
function junk(st, L) {
  const zc = st.zone && zoneCt(st.zone.idx);
  return { uid: uid(st), kind: 'junk', id: 'junk', name: pick(st, (zc && zc.junkNames) || D.JUNK), rarity: 'junk', count: 1, stack: 10, sell: Math.max(1, Math.round(0.6 * V(L))) };
}
function bagAdd(st, p, item) { // returns true if fully stored
  if (item.kind !== 'gear') {
    for (const s of p.bag) {
      if (s && s.kind === item.kind && s.id === item.id && (item.kind !== 'junk' || s.name === item.name) && s.count < s.stack) {
        const n = Math.min(item.count, s.stack - s.count); s.count += n; item.count -= n;
        if (!item.count) return true;
      }
    }
  }
  const free = p.bag.indexOf(null);
  if (free < 0) return false;
  p.bag[free] = item;
  return true;
}
const bagFind = (p, uidv) => p.bag.findIndex((s) => s && s.uid === uidv);
const bagCount = (p, id) => p.bag.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0);
function bagTake(p, id, n = 1) {
  for (let i = 0; i < p.bag.length && n > 0; i++) {
    const s = p.bag[i];
    if (s && s.id === id) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (!s.count) p.bag[i] = null; }
  }
}
function rollRarity(st, w) { return weighted(st, [['common', w[0]], ['uncommon', w[1]], ['rare', w[2]], ['epic', w[3]]]); }

// ------------------------------------------------------------------ map
function genZone(st, z) {
  const zd = z <= 6 ? D.ZONES[z - 1] : D.CAMP;
  const zc = z <= 6 ? zoneCt(z) : null;
  const camp = z > 6 ? CT.camp : null;
  const zone = { idx: z, id: zd.id, name: zc ? zc.name : camp ? D.CAMP.name : zd.name, hubName: zc ? zc.hubName : camp ? camp.name : zd.hub,
    theme: zd.theme, band: zd.band, blurb: zc ? zc.theme : camp ? camp.text : zd.blurb, hubText: zc ? zc.hubText : camp ? camp.text : '',
    exitLevel: C.ZONE_LEVELS * z, rows: [], pos: { row: 0, lane: null }, path: [], questsDone: 0, storyDone: false,
    dungeonName: zc ? zc.dungeon.name : zd.dungeon ? zd.dungeon.name : null };
  if (z > 6) return zone;
  const grid = Array.from({ length: C.ROWS }, () => [null, null, null]);
  const dr = 4 + Math.floor(rnd(st) * 3); const dl = Math.floor(rnd(st) * 3);
  grid[dr - 1][dl] = 'dungeon';
  for (;;) { const r = 3 + Math.floor(rnd(st) * 3); const l = Math.floor(rnd(st) * 3); if (!grid[r - 1][l]) { grid[r - 1][l] = 'rest'; break; } }
  for (let r = 1; r <= C.ROWS; r++) for (let l = 0; l < 3; l++) {
    if (grid[r - 1][l]) continue;
    let t = 'quest';
    for (let k = 0; k < 10; k++) {
      const c = weighted(st, Object.entries(C.W));
      const same = grid[r - 1].filter((x) => x === c).length;
      if (same >= 2) continue;
      if (r === 1 && ['elite', 'rest', 'vendor', 'trainer'].includes(c)) continue;
      t = c; break;
    }
    grid[r - 1][l] = t;
  }
  const arche = Object.keys(D.ARCHETYPES);
  // enemy templates: content when present, otherwise placeholder names per archetype
  const tplFromArch = (a, kind = 'normal') => ({ id: `${zd.id}_${a}`, name: zd.enemies[a], archetype: a, hpMult: 1, dmgMult: 1, abilities: [], kind });
  const normals = zc ? zc.normals.map(enemyCt).filter(Boolean) : arche.map((a) => tplFromArch(a));
  const elites = zc ? zc.elites.map(enemyCt).filter(Boolean) : zd.elites.map(([nm, a]) => ({ ...tplFromArch(a, 'elite'), name: nm, abilities: [] }));
  const rares = zc ? zc.rares.map(enemyCt).filter(Boolean) : [{ ...tplFromArch(zd.rare[1], 'rare'), name: zd.rare[0] }];
  const quests = zc ? zc.quests.map(questCt).filter(Boolean) : D.QUESTS.map(([title, giver, text, turnIn], i) => ({ id: `q${i}`, title, giver, text, turnIn }));
  zone.normals = normals;
  for (let r = 1; r <= C.ROWS; r++) {
    const row = [];
    for (let l = 0; l < 3; l++) {
      const type = grid[r - 1][l]; const base = CL(z, r);
      const n = { row: r, lane: l, type, cl: base, visited: false };
      if (type === 'quest') {
        const q = pick(st, quests); n.cl = clamp(base + pick(st, [-1, 0, 0, 1]), 1, 60);
        n.questId = q.id; n.title = q.title; n.giver = q.giver; n.text = q.text; n.turnIn = q.turnIn; n.objective = q.objective || 'slay';
        const w = q.sizeWeights || [25, 50, 25];
        const size = weighted(st, [[1, w[0]], [2, w[1]], [3, w[2]]]);
        const pool = q.enemies ? q.enemies.map(enemyCt).filter(Boolean) : normals;
        n.mobs = Array.from({ length: size }, () => pick(st, pool.length ? pool : normals));
      } else if (type === 'grind') { n.mobs = [pick(st, normals), pick(st, normals)]; }
      else if (type === 'elite') {
        n.cl = Math.min(60, base + 2);
        n.rare = rnd(st) < 0.2;
        n.elite = n.rare ? pick(st, rares) : pick(st, elites);
        n.eliteName = n.elite.name;
        n.add = rnd(st) < 0.3 ? pick(st, normals) : null;
      } else if (type === 'dungeon') {
        n.cl = Math.min(60, zd.band[0] + 6);
        n.dungeon = zc ? zc.dungeon.name : zd.dungeon.name;
        n.dungeonText = zc ? zc.dungeon.text : '';
        n.trash = zc ? zc.dungeon.trash.map(enemyCt).filter(Boolean) : normals;
        n.boss = zc ? enemyCt(zc.dungeon.boss) : { ...tplFromArch('brute', 'dboss'), name: zd.dungeon.boss };
        n.bossName = n.boss.name;
      } else if (type === 'treasure') {
        n.guard = rnd(st) < 0.5 ? pick(st, normals) : null; n.trap = rnd(st) < 0.1;
        n.text = zc ? pick(st, zc.treasureLines) : 'A chest lies half hidden by the road.';
      } else if (type === 'shrine') n.text = zc ? pick(st, zc.shrineLines) : 'An old shrine hums softly.';
      if (n.mobs) n.enemyNames = [...new Set(n.mobs.map((m) => m.name))];
      row.push(n);
    }
    zone.rows.push(row);
  }
  return zone;
}

// ------------------------------------------------------------------ combat
const FALLBACK_ABILITIES = { elite: ['heavy_blow'], rare: ['heavy_blow', 'curse'], dboss: ['heavy_blow', 'dark_cast'] };
function makeEnemy(st, idx, tpl, level, rank) {
  const arch = tpl.archetype;
  const A = D.ARCHETYPES[arch] || D.ARCHETYPES.brute;
  const mult = { normal: [1, 1], trash: [1.2, 1.1], elite: [3.5, 1.5], rare: [4.5, 1.6], dboss: [7, 1.7] }[rank] || [1, 1];
  const hp = Math.round((20 + 12 * level) * A.hp * mult[0] * (tpl.hpMult || 1));
  let abilities = (tpl.abilities || []).map(abilityCt).filter(Boolean);
  if (!abilities.length && FALLBACK_ABILITIES[rank]) abilities = FALLBACK_ABILITIES[rank].map((t) => ({ id: t, template: t, name: { heavy_blow: 'Crushing Blow', dark_cast: 'Dark Torrent', curse: 'Curse of Frailty' }[t], pct: 2, cd: 4 }));
  return { idx, uid: uid(st), tplId: tpl.id, name: tpl.name, text: tpl.text || '', arch, level, rank, hp, maxHp: hp, armor: Math.round(15 * level * A.armor),
    dmg: (4 + 2.6 * level) * A.dmg * mult[1] * (tpl.dmgMult || 1) * C.MOCK_ENEMY_DMG, dodge: 0.05 + A.dodge, statuses: [], cds: {}, intent: null, alive: true, abilities };
}

function startFight(st, enemies, opts = {}) {
  const p = st.player;
  p.res.cur = p.res.kind === 'mana' ? p.res.cur : p.res.max;
  p.cp = 0;
  p.statuses = p.statuses.filter((s) => s.id === 'BRAND');
  if (p.classId === 'rogue' && !opts.noStealth) addStatus(p, 'STEALTH', 99);
  st.combat = { round: 1, enemies, target: 0, cooldowns: {}, potionCd: 0, kind: opts.kind || 'normal', canFlee: opts.canFlee !== false,
    isBoss: !!opts.isBoss, title: opts.title || '', over: null, fightNo: opts.fightNo || 1, fights: opts.fights || 1,
    boss: opts.isBoss ? { phase: 1, asc: opts.asc || 0, brand: 0, litany: null, crushNext: false, enrageRound: 50 } : null,
    unaware: p.classId === 'rogue' && !opts.noStealth, deathSidestep: false };
  st.run.fights++;
  ev(st, { t: 'fightStart', kind: st.combat.kind, isBoss: st.combat.isBoss, enemies: enemies.map((e) => e.name) });
  rollIntents(st);
}

function hasStatus(u, id) { return u.statuses.find((s) => s.id === id); }
function addStatus(u, id, rounds, extra = {}) {
  const s = hasStatus(u, id);
  if (s) { s.rounds = Math.max(s.rounds, rounds); Object.assign(s, extra); return s; }
  const n = { id, rounds, stacks: 1, ...extra };
  u.statuses.push(n);
  return n;
}
function removeStatus(u, id) { u.statuses = u.statuses.filter((s) => s.id !== id); }
const isCC = (e) => hasStatus(e, 'STUN') || hasStatus(e, 'FROZEN') || hasStatus(e, 'HEXED');
const living = (st) => st.combat.enemies.filter((e) => e.alive);
const unitRef = (side, idx) => ({ side, idx });

function mitigation(armor, attackerLevel) { return Math.min(0.75, armor / (armor + 40 * attackerLevel + 100)); }

function estEnemyDamage(st, e, mult, school) {
  const p = st.player; const c = st.combat;
  let d = e.dmg * mult * (1 + (c.boss ? c.boss.asc : 0)) * clamp(1 + 0.04 * (e.level - p.level), 0.7, 1.3);
  if (hasStatus(e, 'CHILLED')) d *= 0.8;
  if (hasStatus(e, 'ENRAGED')) d *= 1.4;
  if (school === 'phys') d *= 1 - mitigation(p.stats.armor, e.level);
  return Math.max(1, Math.round(d));
}

function rollIntents(st) {
  const c = st.combat; const p = st.player;
  for (const e of c.enemies) {
    e.intent = null;
    if (!e.alive) continue;
    if (c.round === 1 && c.unaware && hasStatus(p, 'STEALTH')) { e.intent = { id: 'unaware', name: 'Unaware', target: 'none', est: 0, cast: false, heavy: false }; continue; }
    if (hasStatus(e, 'HEXED')) { e.intent = { id: 'none', name: 'Hexed', target: 'none', est: 0 }; continue; }
    if (hasStatus(e, 'STUN') || hasStatus(e, 'FROZEN')) { e.intent = { id: 'none', name: hasStatus(e, 'STUN') ? 'Stunned' : 'Frozen', target: 'none', est: 0 }; continue; }
    if (e.rank === 'boss') { bossIntent(st, e); continue; }
    if (e.rank === 'shard') { e.intent = { id: 'shard_hit', name: 'Shard Lash', target: 'player', est: estEnemyDamage(st, e, 1, 'phys'), cast: false, heavy: false, school: 'phys', mult: 1 }; continue; }
    const A = D.ARCHETYPES[e.arch];
    const opts = [];
    for (const [id, name, w, mult, school, extra = {}] of A.actions) {
      if (extra.cd && (e.cds[id] || 0) > 0) continue;
      if (extra.cast && hasStatus(e, 'SILENCED')) continue;
      if (extra.mend && !c.enemies.some((x) => x.alive && x.hp / x.maxHp < 0.7)) continue;
      opts.push([{ id, name, mult, school, ...extra }, w]);
    }
    for (const ab of e.abilities) {
      if ((e.cds[ab.id] || 0) > 0 || e.used?.[ab.id]) continue;
      const pct = ab.pct || 1;
      const T = { heavy_blow: { mult: pct, school: 'phys', heavy: true }, dark_cast: { mult: pct, school: 'shadow', cast: true },
        cleave_all: { mult: pct, school: 'phys', cleave: true }, rend: { mult: pct, school: 'phys', bleed: ab.tickPct || 0.2 },
        curse: { mult: 0, school: 'shadow', cast: true, curse: true }, self_heal: { mult: 0, school: 'shadow', cast: true, selfHeal: pct },
        self_shield: { mult: 0, school: 'arcane', shield: pct } }[ab.template];
      if (!T) continue;
      if (T.cast && hasStatus(e, 'SILENCED')) continue;
      if (T.selfHeal && e.hp / e.maxHp > 0.6) continue;
      if (T.shield && hasStatus(e, 'WARD')) continue;
      opts.push([{ id: ab.id, name: ab.name, cd: ab.cd || 3, ...T }, 35]);
    }
    const a = weighted(st, opts);
    let target = 'player';
    if (p.pet && p.pet.alive && !a.mend && !a.brace && !a.shieldAlly && !a.selfHeal && !a.shield && !a.cleave) {
      if (hasStatus(p.pet, 'TAUNT') || c.feign > 0) target = 'pet';
      else if (rnd(st) < D.PETS[p.pet.id].aggro) target = 'pet';
    }
    const hits = a.hits || 1;
    let est = a.mult ? estEnemyDamage(st, e, a.mult, a.school) * hits : 0;
    let label = null;
    if (a.mend) { const tgt = lowestAlly(st); label = `Heals ${tgt.name}`; est = Math.round(tgt.maxHp * a.mend); target = 'ally'; }
    if (a.selfHeal) { label = 'Heals itself'; est = Math.round(e.maxHp * a.selfHeal); target = 'self'; }
    if (a.brace) { label = 'Braces (-50 % damage)'; target = 'self'; }
    if (a.shieldAlly) { label = 'Shields an ally'; target = 'ally'; }
    if (a.curse) label = 'Curse: -15 % damage';
    if (a.shield) { label = 'Shields itself'; est = Math.round(e.maxHp * a.shield); target = 'self'; }
    if (a.cleave) { target = p.pet && p.pet.alive ? 'both' : 'player'; label = p.pet && p.pet.alive ? 'Hits you and your pet' : null; }
    e.intent = { id: a.id, name: a.name, target, est, cast: !!a.cast, heavy: !!a.heavy, school: a.school, mult: a.mult, hits, label,
      bleed: a.bleed || 0, curse: !!a.curse, mend: a.mend || 0, selfHeal: a.selfHeal || 0, brace: !!a.brace, shieldAlly: !!a.shieldAlly,
      shield: a.shield || 0, cleave: !!a.cleave, cd: a.cd || 0 };
  }
}

function lowestAlly(st) { return living(st).slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; }

function bossIntent(st, e) {
  const c = st.combat; const b = c.boss; const r = c.round;
  if (r >= b.enrageRound) { e.intent = { id: 'final_dark', name: 'Final Dark', target: 'player', est: 99999, cast: false, heavy: true, school: 'shadow', mult: 0, flat: 99999 }; return; }
  if (b.litany) { e.intent = { id: 'litany', name: 'Collapse Litany', channel: [2, 2], label: '2/2 - resolves', target: 'player', est: Math.round(850 * (1 + b.asc)), cast: true, heavy: true, school: 'shadow', flat: 850 }; return; }
  if (r >= 3 && (r - 3) % 5 === 0 && !hasStatus(e, 'SILENCED')) { e.intent = { id: 'litany', name: 'Collapse Litany', channel: [1, 2], label: '1/2', target: 'player', est: Math.round(850 * (1 + b.asc)), cast: true, heavy: true, school: 'shadow', flat: 850, start: true }; return; }
  if (b.phase === 3 && r % 3 === 0) { e.intent = { id: 'pulse', name: 'Starless Pulse', target: 'player', est: Math.round(280 * (1 + b.asc) * (1 + 0.05 * (b.p3Rounds || 0))), cast: false, heavy: false, school: 'shadow', flat: 280 }; return; }
  if (r % 6 === 0) { e.intent = { id: 'crush', name: 'Gravity Crush', target: 'player', est: estFlat(st, 380, 'phys'), cast: false, heavy: true, school: 'phys', flat: 380 }; return; }
  e.intent = { id: 'umbral', name: 'Umbral Strike', target: 'player', est: estFlat(st, 200, 'phys'), cast: false, heavy: false, school: 'phys', flat: 200, next: (r + 1) % 6 === 0 ? 'Gravity Crush next round' : null };
}
function estFlat(st, dmg, school) {
  const b = st.combat.boss; let d = dmg * (1 + b.asc) * (1 + 0.05 * (b.p3Rounds || 0));
  if (school === 'phys') d *= 1 - mitigation(st.player.stats.armor, 62);
  return Math.round(d);
}

function spellDamageBase(p, sp, mult = 1) {
  const s = D.SPELLS[sp.id || sp]; const known = p.spells.find((k) => k.id === s.id);
  const tl = s.fx.talent ? p.level : known ? known.tl : p.level;
  const [, b, l, pw, w] = s.fx.dmg;
  return (b + l * tl + pw * p.stats.power + w * (p.stats.wd || 0)) * mult;
}

function playerDamageMods(st) {
  const p = st.player; let m = 1;
  if (p.boons.some((b) => b.id === 'fury')) m += 0.15;
  if (p.elixirNodes > 0) m += 0.10;
  const rapid = hasStatus(p, 'RAPID'); if (rapid) m += rapid.value || 0.4;
  if (hasStatus(p, 'CHILLED')) m -= 0.2;
  if (hasStatus(p, 'CURSED')) m -= 0.15;
  return m;
}

/** Player (or pet) deals damage to enemy e. Returns the damage event. */
function hitEnemy(st, e, base, school, name, opts = {}) {
  const p = st.player; const c = st.combat;
  if (!e.alive) return null;
  const src = opts.pet ? unitRef('pet', 0) : unitRef('player', 0);
  let dmg = base * (opts.noMods ? 1 : playerDamageMods(st)) * clamp(1 + 0.04 * (p.level - e.level), 0.7, 1.3);
  const missChance = opts.tick ? 0 : Math.min(0.35, 0.05 + 0.02 * Math.max(0, e.level - p.level)) + (school === 'phys' ? e.dodge : 0);
  const out = { t: 'damage', src, dst: unitRef('enemy', e.idx), school, name, amount: 0, crit: false, miss: false, tick: !!opts.tick };
  if (!opts.tick && rnd(st) < missChance) { out.miss = true; out.dodge = school === 'phys' && rnd(st) < 0.5; rnd(st); }
  else {
    const crit = !opts.tick && rnd(st) < Math.min(0.9, p.stats.crit + (opts.critBonus || 0));
    if (crit) { dmg *= p.stats.critMult; out.crit = true; }
    dmg *= 0.9 + 0.2 * rnd(st);
    let tm = 1;
    const ex = hasStatus(e, 'EXPOSED'); if (ex) tm += ex.value || 0.12;
    if (hasStatus(e, 'MARKED')) tm += 0.08;
    if (hasStatus(e, 'SHIELDED')) tm -= 0.5;
    if (e.rank === 'boss' && c.enemies.some((x) => x.alive && x.rank === 'shard')) tm -= 0.6;
    dmg *= Math.max(0.1, tm);
    if (school === 'phys' && !opts.tick) dmg *= 1 - mitigation(e.armor, p.level);
    dmg = Math.max(1, Math.round(dmg));
    const ward = hasStatus(e, 'WARD');
    if (ward) { const ab = Math.min(ward.value, dmg); ward.value -= ab; dmg -= ab; out.absorbed = ab; if (ward.value <= 0) removeStatus(e, 'WARD'); }
    out.amount = dmg;
    e.hp = Math.max(0, e.hp - dmg);
    st.run.dealt += dmg;
    st.run.bySpell[name] = (st.run.bySpell[name] || 0) + dmg;
    if (hasStatus(e, 'HEXED')) { removeStatus(e, 'HEXED'); ev(st, { t: 'status', dst: out.dst, id: 'HEXED', op: 'remove' }); }
  }
  out.hpAfter = e.hp; out.maxHp = e.maxHp;
  ev(st, out);
  if (e.hp <= 0 && e.alive) killEnemy(st, e);
  else if (e.rank === 'boss') checkBossPhase(st, e);
  return out;
}

function killEnemy(st, e) {
  e.alive = false; e.intent = null; e.statuses = [];
  ev(st, { t: 'death', dst: unitRef('enemy', e.idx), name: e.name });
  const p = st.player; const c = st.combat;
  if (e.rank === 'shard' || e.rank === 'boss') return;
  // kill XP
  const mult = { normal: 1, trash: 1, elite: C.ELITE_XP, rare: C.RARE_XP, dboss: C.DBOSS_XP }[e.rank] || 1;
  const xp = Math.round(C.MOB_XP_FRAC * mult * xpToNext(Math.min(59, e.level)) * diffMod(e.level - p.level) * xpBoon(p));
  c.xpGained = (c.xpGained || 0) + gainXp(st, xp, true);
  c.goldGained = (c.goldGained || 0) + Math.round(0.5 * V(e.level) * (e.rank === 'elite' || e.rank === 'rare' ? 2 : 1));
  st.run.kills[e.rank === 'rare' ? 'rare' : e.rank === 'elite' ? 'elite' : e.rank === 'dboss' ? 'boss' : 'normal']++;
  // drops
  c.drops = c.drops || [];
  const dropTable = { normal: [0.15, [60, 35, 5, 0]], trash: [0.25, [30, 50, 18, 2]], elite: [1, [0, 40, 55, 5]], rare: [1, [0, 0, 75, 25]], dboss: [1, [0, 0, 85, 15]] }[e.rank];
  const n = e.rank === 'dboss' ? 2 : 1;
  for (let k = 0; k < n; k++) {
    if (rnd(st) < dropTable[0] * (c.kind === 'grind' ? 1.5 : 1)) c.drops.push(gear(st, pick(st, D.SLOTS), e.level, rollRarity(st, dropTable[1]), p.classId));
  }
  if (e.rank !== 'dboss' && rnd(st) < 0.3) c.drops.push(junk(st, e.level));
}

function diffMod(d) {
  if (d >= -2) return Math.min(1.25, 1 + 0.05 * d);
  if (d > -6) return 1 + 0.05 * -2 - 0.2 * (-2 - d);
  return 0.1;
}
const xpBoon = (p) => (p.boons.some((b) => b.id === 'insight') ? 1.2 : 1);

function gainXp(st, amount, isKill) {
  const p = st.player;
  if (p.level >= C.MAX_LEVEL) return 0;
  let rested = 0;
  if (isKill && p.rested > 0) { rested = Math.min(p.rested, amount); p.rested -= rested; }
  const total = amount + rested;
  ev(st, { t: 'xp', amount: total, rested });
  p.xp += total;
  while (p.level < C.MAX_LEVEL && p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext; p.level++; p.xpToNext = xpToNext(p.level);
    const newSpells = Object.values(D.SPELLS).filter((s) => s.cls === p.classId && s.lvl === p.level && !s.fx.meta && !s.fx.talent).map((s) => s.name);
    let tp = false;
    if (p.level >= 10 && (p.level - 10) % 2 === 0) { p.talentPoints++; tp = true; }
    recalc(p);
    ev(st, { t: 'levelUp', level: p.level, talentPoint: tp, newSpells, hp: p.hp, maxHp: p.maxHp });
  }
  if (p.level >= C.MAX_LEVEL) { p.xp = 0; }
  return total;
}

function damagePlayer(st, e, amount, school, name, opts = {}) {
  const p = st.player; const c = st.combat;
  const out = { t: 'damage', src: e ? unitRef('enemy', e.idx) : unitRef('env', 0), dst: unitRef('player', 0), school, name, amount: 0, crit: false, miss: false, tick: !!opts.tick };
  if (hasStatus(p, 'IMMUNE') && !opts.ignoreImmune) { out.immune = true; out.hpAfter = p.hp; out.maxHp = p.maxHp; ev(st, out); return out; }
  let dmg = amount;
  if (!opts.tick && !opts.flat) {
    const stealth = hasStatus(p, 'STEALTH');
    const evasion = hasStatus(p, 'EVASION');
    const dodge = school === 'phys' ? p.stats.dodge + (evasion ? evasion.value || 0.45 : 0) : 0;
    const miss = 0.05 + dodge + (stealth ? 0.5 : 0);
    if (rnd(st) < miss) { out.miss = true; out.dodge = dodge > 0 && rnd(st) < 0.7; out.hpAfter = p.hp; out.maxHp = p.maxHp; ev(st, out); return out; }
    if (rnd(st) < 0.05) { dmg *= 1.5; out.crit = true; }
    dmg *= 0.9 + 0.2 * rnd(st);
  }
  dmg = Math.max(1, Math.round(dmg));
  const ward = hasStatus(p, 'WARD');
  if (ward && !opts.ignoreWard) { const ab = Math.min(ward.value, dmg); ward.value -= ab; dmg -= ab; out.absorbed = ab; if (ward.value <= 0) { removeStatus(p, 'WARD'); ev(st, { t: 'status', dst: unitRef('player', 0), id: 'WARD', op: 'remove' }); } }
  // Death's Sidestep
  if (p.talents.r_b9 && !c.deathSidestep && p.hp - dmg < p.maxHp * 0.2) {
    c.deathSidestep = true; dmg = 0; p.statuses = p.statuses.filter((s) => !D.STATUS_INFO[s.id]?.debuff); addStatus(p, 'STEALTH', 2);
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.2));
    ev(st, { t: 'msg', text: "Death's Sidestep! You slip away.", kind: 'good' });
  }
  out.amount = dmg;
  p.hp = Math.max(0, p.hp - dmg);
  st.run.taken += dmg;
  out.hpAfter = p.hp; out.maxHp = p.maxHp;
  ev(st, out);
  if (p.hp <= 0) playerDies(st, e, name);
  return out;
}

function damagePet(st, e, amount, school, name) {
  const p = st.player; const pet = p.pet;
  if (!pet || !pet.alive) return null;
  let dmg = Math.max(1, Math.round(amount * (school === 'phys' ? 1 - mitigation(p.stats.armor * D.PETS[pet.id].armorMult, e.level) : 1) * (0.9 + 0.2 * rnd(st))));
  const out = { t: 'damage', src: unitRef('enemy', e.idx), dst: unitRef('pet', 0), school, name, amount: dmg, crit: false, miss: false };
  if (rnd(st) < 0.08) { out.miss = true; out.amount = 0; dmg = 0; }
  pet.hp = Math.max(0, pet.hp - dmg);
  out.hpAfter = pet.hp; out.maxHp = pet.maxHp;
  ev(st, out);
  if (pet.hp <= 0) { pet.alive = false; pet.statuses = []; ev(st, { t: 'death', dst: unitRef('pet', 0), name: pet.name }); }
  return out;
}

function playerDies(st, killer, ability) {
  const p = st.player; const c = st.combat;
  if (p.resurrect.length) {
    const src = p.resurrect.shift();
    if (src === 'ember') bagTake(p, 'ember_of_return', 1);
    if (src === 'boon') p.boons = p.boons.filter((b) => b.id !== 'return');
    p.hp = Math.round(p.maxHp * 0.4);
    if (p.res.kind === 'mana') p.res.cur = Math.max(p.res.cur, Math.round(p.res.max * 0.4));
    p.statuses = p.statuses.filter((s) => !D.STATUS_INFO[s.id]?.debuff);
    st.run.resurrects++;
    ev(st, { t: 'resurrect', source: { ember: 'Ember of Return', boon: 'Boon of Return', meta: 'Second Breath' }[src], hpAfter: p.hp, maxHp: p.maxHp });
    return;
  }
  c.over = 'defeat';
  ev(st, { t: 'death', dst: unitRef('player', 0), name: p.name });
  ev(st, { t: 'defeat' });
  st.deathInfo = { zone: st.zone.name, row: st.zone.pos.row, node: st.node ? st.node.type : c.isBoss ? 'boss' : 'camp', killer: killer ? killer.name : 'unknown', ability, round: c.round };
  toSummary(st, 'death');
}

// ------------------------------------------------------------------ spells
function knownSpell(p, id) { return p.spells.find((s) => s.id === id); }
function spellCost(p, s) {
  if (!s.cost) return 0;
  const [k, v] = s.cost;
  if (k === 'M') return Math.round(v * p.res.baseMana);
  let c = v;
  if (s.id === 'gutting_jab') c -= 3 * (p.talents.r_a2 || 0);
  if (s.id === 'temple_blow') c -= 10 * (p.talents.r_b5 || 0);
  if ((s.id === 'keen_shot' || s.id === 'heartseeker_shot')) c -= 5 * (p.talents.h_b3 || 0);
  return Math.max(0, c);
}

export function canCast(st, id) {
  const p = st.player; const c = st.combat; const s = D.SPELLS[id];
  if (!s || !knownSpell(p, id)) return { ok: false, reason: 'Not known' };
  if (!c || c.over) return { ok: false, reason: 'Only in combat' };
  if (!p.bar.includes(id)) return { ok: false, reason: 'Not on the action bar' };
  const cd = c.cooldowns[id] || 0;
  if (cd > 0) return { ok: false, reason: `Ready in ${cd} round${cd > 1 ? 's' : ''}`, cd };
  const cost = spellCost(p, s);
  if (p.res.cur < cost) return { ok: false, reason: `Not enough ${p.res.kind}` };
  if (s.fx.req === 'STEALTH' && !hasStatus(p, 'STEALTH')) return { ok: false, reason: 'Requires Stealth' };
  if (s.fx.fin && p.cp < 1) return { ok: false, reason: 'Requires combo points' };
  if ((s.fx.petStrike || s.fx.feign && s.id === 'wild_communion') && !(p.pet && p.pet.alive)) return { ok: false, reason: 'Requires a living pet' };
  if (s.fx.petHeal && !p.pet) return { ok: false, reason: 'Requires a pet' };
  return { ok: true, cost };
}

function useSpell(st, id, targetIdx) {
  const p = st.player; const c = st.combat; const s = D.SPELLS[id]; const fx = s.fx;
  const chk = canCast(st, id);
  if (!chk.ok) return chk.reason;
  let target = c.enemies[targetIdx];
  if (!target || !target.alive) target = defaultTarget(st);
  p.res.cur -= chk.cost;
  let cd = s.cd;
  if (id === 'temple_blow') cd -= p.talents.r_b5 || 0;
  if (id === 'pyre_comet') cd -= p.talents.m_a6 || 0;
  if (id === 'rime_burst') cd -= p.talents.m_b5 || 0;
  if (cd > 0) c.cooldowns[id] = cd + 1; // decremented at end of this round
  const cp = p.cp;
  const fromStealth = !!hasStatus(p, 'STEALTH');
  ev(st, { t: 'action', src: unitRef('player', 0), kind: 'spell', id, name: s.name, school: fx.dmg ? fx.dmg[0] : (fx.dot ? (fx.dot[0] === 'BURN' ? 'fire' : 'phys') : 'arcane'), dst: unitRef('enemy', target.idx), aoe: !!fx.aoe, tags: s.tags, resAfter: p.res.cur });
  if (s.tags.includes('opener') === false && id !== 'vanishing_step') removeStatus(p, 'STEALTH');
  const targets = fx.aoe ? living(st) : [target];
  const finMult = fx.fin ? Math.max(1, cp) : 1;
  if (fx.dmg) {
    for (const t of targets) {
      const hits = fx.hits || 1;
      for (let h = 0; h < hits; h++) {
        let base = spellDamageBase(p, id, fx.fin && fx.dmg ? finMult : 1);
        if (fx.finW) base += fx.finW * p.stats.wd;
        if (fx.execute && t.hp / t.maxHp < fx.execute) base *= 2;
        if (fromStealth && s.tags.includes('opener')) base *= 1 + 0.1 * (p.talents.r_b1 || 0);
        if (id === 'ricochet_bolt' && t !== target) base *= 0.7;
        const critBonus = (id === 'pyre_comet' && hasStatus(t, 'BURN')) ? 0.25 : (id === 'heartseeker_shot' && t.hp / t.maxHp < 0.3) ? 0.5 : 0;
        hitEnemy(st, t, base, fx.dmg[0], s.name, { critBonus });
        if (fx.interrupt && t.alive && t.intent && t.intent.cast && !t.intent.interrupted) { t.intent.interrupted = true; ev(st, { t: 'interrupt', dst: unitRef('enemy', t.idx), name: t.intent.name }); }
      }
    }
  }
  if (fx.dot) {
    const [sid, rounds, b, l, pw] = fx.dot; const tl = knownSpell(p, id)?.tl || p.level;
    const tick = Math.max(1, Math.round((b + l * tl + pw * p.stats.power) * finMult * playerDamageMods(st)));
    for (const t of targets) if (t.alive) { addStatus(t, sid, rounds, { tick, source: s.name }); ev(st, { t: 'status', dst: unitRef('enemy', t.idx), id: sid, op: 'add' }); }
  }
  if (fx.st) {
    const [sid, rounds] = fx.st;
    for (const t of targets) {
      if (!t.alive) continue;
      if ((sid === 'STUN' || sid === 'FROZEN' || sid === 'HEXED') && (t.rank === 'boss' || t.rank === 'dboss')) {
        if (t.intent && t.intent.cast && !t.intent.interrupted) { t.intent.interrupted = true; ev(st, { t: 'interrupt', dst: unitRef('enemy', t.idx), name: t.intent.name }); }
        else ev(st, { t: 'immune', dst: unitRef('enemy', t.idx), text: 'Immune' });
        continue;
      }
      const extra = sid === 'EXPOSED' ? { value: 0.04 * Math.max(1, cp) } : {};
      addStatus(t, sid, rounds, extra);
      ev(st, { t: 'status', dst: unitRef('enemy', t.idx), id: sid, op: 'add' });
      if ((sid === 'STUN' || sid === 'FROZEN' || sid === 'HEXED') && t.intent && t.intent.cast && !t.intent.interrupted) { t.intent.interrupted = true; ev(st, { t: 'interrupt', dst: unitRef('enemy', t.idx), name: t.intent.name }); }
    }
  }
  if (fx.stunFin) {
    const rounds = Math.min(3, 1 + Math.floor(cp / 2));
    if (target.rank === 'boss' || target.rank === 'dboss') { if (target.intent?.cast) { target.intent.interrupted = true; ev(st, { t: 'interrupt', dst: unitRef('enemy', target.idx), name: target.intent.name }); } }
    else { addStatus(target, 'STUN', rounds); ev(st, { t: 'status', dst: unitRef('enemy', target.idx), id: 'STUN', op: 'add' }); if (target.intent?.cast) target.intent.interrupted = true; }
  }
  if (fx.self) {
    const [sid, rounds, value] = fx.self;
    addStatus(p, sid, rounds, value ? { value } : {});
    ev(st, { t: 'status', dst: unitRef('player', 0), id: sid, op: 'add' });
  }
  if (fx.ward) {
    const [b, l, pw, rounds] = fx.ward; const tl = knownSpell(p, id)?.tl || p.level;
    const v = Math.round((b + l * tl + pw * p.stats.power) * (1 + 0.15 * (p.talents.m_b7 || 0) + 0.2 * (p.talents.m_c4 || 0)));
    const w = hasStatus(p, 'WARD');
    if (!w || w.value < v) { removeStatus(p, 'WARD'); addStatus(p, 'WARD', rounds, { value: v, max: v }); }
    ev(st, { t: 'status', dst: unitRef('player', 0), id: 'WARD', op: 'add', value: v });
  }
  if (fx.disperse) {
    const before = p.statuses.length;
    p.statuses = p.statuses.filter((x) => !D.STATUS_INFO[x.id]?.debuff);
    if (p.statuses.length !== before) ev(st, { t: 'cleanse', dst: unitRef('player', 0) });
  }
  if (fx.heal) healPlayer(st, Math.round(p.maxHp * fx.heal), s.name);
  if (fx.energy && p.res.kind === 'energy') { p.res.cur = Math.min(p.res.max, p.res.cur + fx.energy); ev(st, { t: 'resource', amount: fx.energy, after: p.res.cur }); }
  if (fx.mana && p.res.kind === 'mana') { const g = Math.round(p.res.max * fx.mana); p.res.cur = Math.min(p.res.max, p.res.cur + g); ev(st, { t: 'resource', amount: g, after: p.res.cur }); }
  if (fx.resetCd) for (const k in c.cooldowns) if (k !== id) c.cooldowns[k] = 0;
  if (fx.petHeal && p.pet) {
    const tl = knownSpell(p, id)?.tl || p.level;
    if (!p.pet.alive) { p.pet.alive = true; p.pet.hp = Math.round(p.pet.maxHp * 0.3); ev(st, { t: 'heal', dst: unitRef('pet', 0), amount: p.pet.hp, name: 'Revive', hpAfter: p.pet.hp, maxHp: p.pet.maxHp }); }
    else { const h = Math.round(fx.petHeal[0] + fx.petHeal[1] * tl + fx.petHeal[2] * p.stats.power); p.pet.hp = Math.min(p.pet.maxHp, p.pet.hp + h); ev(st, { t: 'heal', dst: unitRef('pet', 0), amount: h, name: s.name, hpAfter: p.pet.hp, maxHp: p.pet.maxHp }); }
  }
  if (fx.petStrike && p.pet?.alive) { const tl = knownSpell(p, id)?.tl || p.level; hitEnemy(st, target, fx.petStrike[0] + fx.petStrike[1] * tl + fx.petStrike[2] * p.stats.power, 'phys', s.name, { pet: true }); }
  if (fx.petFull && p.pet) { p.pet.alive = true; p.pet.hp = p.pet.maxHp; addStatus(p.pet, 'TAUNT', 2); ev(st, { t: 'heal', dst: unitRef('pet', 0), amount: p.pet.maxHp, name: s.name, hpAfter: p.pet.hp, maxHp: p.pet.maxHp }); }
  if (fx.feign) { c.feign = fx.feign; if (p.pet?.alive) { addStatus(p.pet, 'TAUNT', fx.feign); ev(st, { t: 'status', dst: unitRef('pet', 0), id: 'TAUNT', op: 'add' }); } else addStatus(p, 'STEALTH', 2); }
  if (id === 'bloodprice_gambit') { const loss = Math.round(p.hp * 0.1); p.hp -= loss; ev(st, { t: 'damage', src: unitRef('player', 0), dst: unitRef('player', 0), amount: loss, school: 'phys', name: s.name, hpAfter: p.hp, maxHp: p.maxHp }); }
  // combo points
  if (fx.fin) { p.cp = 0; ev(st, { t: 'cp', after: 0 }); }
  if (fx.cp) { const gain = fx.cp + (s.tags.includes('opener') ? (p.talents.r_b3 || 0) : 0); p.cp = Math.min(p.cpMax, p.cp + gain); ev(st, { t: 'cp', after: p.cp }); }
  return null;
}

function healPlayer(st, amount, name) {
  const p = st.player; const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  ev(st, { t: 'heal', dst: unitRef('player', 0), amount: p.hp - before, name, hpAfter: p.hp, maxHp: p.maxHp });
}

function defaultTarget(st) {
  const pr = (e) => (e.arch === 'mender' ? 0 : e.arch === 'caster' ? 1 : 2);
  return living(st).filter((e) => !hasStatus(e, 'HEXED')).sort((a, b) => pr(a) - pr(b) || a.hp - b.hp || a.idx - b.idx)[0] || living(st)[0];
}

function useCombatItem(st, slot, targetIdx) {
  const p = st.player; const c = st.combat;
  const id = p.itemBar[slot];
  if (!id) return 'Empty slot';
  const chk = canUseItem(st, slot);
  if (!chk.ok) return chk.reason;
  bagTake(p, id, 1);
  st.run.potions++;
  const item = D.CONSUMABLES[id];
  ev(st, { t: 'action', src: unitRef('player', 0), kind: 'item', id, name: item.name });
  removeStatus(p, 'STEALTH');
  if (id === 'healing_draught' || id === 'greater_healing_draught') { healPlayer(st, Math.round(p.maxHp * (id === 'healing_draught' ? 0.35 : 0.5)), item.name); c.potionCd = C.POTION_CD + 1; }
  else if (id === 'mana_draught') { const g = Math.round(p.res.max * 0.35); p.res.cur = Math.min(p.res.max, p.res.cur + g); ev(st, { t: 'resource', amount: g, after: p.res.cur }); c.potionCd = C.POTION_CD + 1; }
  else if (id === 'purifying_tonic') { p.statuses = p.statuses.filter((x) => !D.STATUS_INFO[x.id]?.debuff); ev(st, { t: 'cleanse', dst: unitRef('player', 0) }); }
  else if (id === 'spark_flask') { for (const e of living(st)) hitEnemy(st, e, 6 + 2.2 * p.level, 'arcane', item.name, { noMods: true }); }
  return null;
}

export function canUseItem(st, slot) {
  const p = st.player; const c = st.combat; const id = p.itemBar[slot];
  if (!id) return { ok: false, reason: 'Empty' };
  const cnt = bagCount(p, id);
  if (!cnt) return { ok: false, reason: 'None left', count: 0 };
  const item = D.CONSUMABLES[id];
  if (c && !c.over) {
    if (item.use === 'out' || item.use === 'passive') return { ok: false, reason: 'Not usable in combat', count: cnt };
    if (['healing_draught', 'mana_draught', 'greater_healing_draught'].includes(id) && c.potionCd > 0) return { ok: false, reason: `Ready in ${c.potionCd} round${c.potionCd > 1 ? 's' : ''}`, count: cnt, cd: c.potionCd };
    if (id === 'mana_draught' && p.res.kind !== 'mana') return { ok: false, reason: 'You have no mana', count: cnt };
    return { ok: true, count: cnt };
  }
  if (item.use === 'combat' || item.use === 'passive') return { ok: false, reason: 'Only in combat', count: cnt };
  return { ok: true, count: cnt };
}

// ------------------------------------------------------------------ round
function petAct(st) {
  const p = st.player; const pet = p.pet; const c = st.combat;
  if (!pet || !pet.alive || c.over) return;
  const t = c.enemies[c.target]?.alive ? c.enemies[c.target] : defaultTarget(st);
  if (!t) return;
  const pd = D.PETS[pet.id];
  const dmg = (2 + 0.55 * p.level + 0.3 * p.stats.power) * pd.dmgMult * (1 + 0.06 * (p.talents.h_a2 || 0));
  ev(st, { t: 'action', src: unitRef('pet', 0), kind: 'attack', name: 'Pet attack', dst: unitRef('enemy', t.idx) });
  c.petActs = (c.petActs || 0) + 1;
  hitEnemy(st, t, dmg, 'phys', pet.name, { pet: true, critBonus: pd.critBonus });
  if (pet.id === 'ridgewolf' && c.petActs % 3 === 0 && t.alive) hitEnemy(st, t, dmg, 'phys', pet.name, { pet: true });
  if (pet.id === 'thornback' && (c.round === 1 || (c.round - 1) % 4 === 0)) { addStatus(pet, 'TAUNT', 1); ev(st, { t: 'status', dst: unitRef('pet', 0), id: 'TAUNT', op: 'add' }); }
}

function enemiesAct(st) {
  const c = st.combat; const p = st.player;
  for (const e of c.enemies) {
    if (c.over) return;
    if (!e.alive || !e.intent) continue;
    const it = e.intent;
    if (it.id === 'none' || it.id === 'unaware') { ev(st, { t: 'skip', src: unitRef('enemy', e.idx), reason: it.name }); continue; }
    if (isCC(e)) { ev(st, { t: 'skip', src: unitRef('enemy', e.idx), reason: 'Stunned' }); continue; }
    if (it.interrupted) { ev(st, { t: 'skip', src: unitRef('enemy', e.idx), reason: 'Interrupted' }); if (it.cd) e.cds[it.id] = it.cd; if (e.rank === 'boss' && it.id === 'litany') c.boss.litany = null; continue; }
    if (it.cd) e.cds[it.id] = it.cd + 1;
    if (e.rank === 'boss') { bossAct(st, e); continue; }
    let tgt = it.target;
    if (tgt === 'pet' && !(p.pet && p.pet.alive)) tgt = 'player';
    if ((hasStatus(p.pet || { statuses: [] }, 'TAUNT') || c.feign > 0) && p.pet?.alive && tgt === 'player' && it.mult) tgt = 'pet';
    ev(st, { t: 'action', src: unitRef('enemy', e.idx), kind: it.cast ? 'cast' : 'attack', id: it.id, name: it.name, dst: tgt === 'pet' ? unitRef('pet', 0) : tgt === 'player' ? unitRef('player', 0) : unitRef('enemy', e.idx), heavy: it.heavy, school: it.school });
    if (it.mend) { const a = lowestAlly(st); const h = Math.round(a.maxHp * it.mend); a.hp = Math.min(a.maxHp, a.hp + h); ev(st, { t: 'heal', dst: unitRef('enemy', a.idx), amount: h, name: it.name, hpAfter: a.hp, maxHp: a.maxHp }); continue; }
    if (it.selfHeal) { const h = Math.round(e.maxHp * it.selfHeal); e.hp = Math.min(e.maxHp, e.hp + h); ev(st, { t: 'heal', dst: unitRef('enemy', e.idx), amount: h, name: it.name, hpAfter: e.hp, maxHp: e.maxHp }); continue; }
    if (it.brace) { addStatus(e, 'SHIELDED', 2); ev(st, { t: 'status', dst: unitRef('enemy', e.idx), id: 'SHIELDED', op: 'add' }); continue; }
    if (it.shieldAlly) { const a = lowestAlly(st); addStatus(a, 'SHIELDED', 2); ev(st, { t: 'status', dst: unitRef('enemy', a.idx), id: 'SHIELDED', op: 'add' }); continue; }
    if (it.curse) { addStatus(p, 'CURSED', 3); ev(st, { t: 'status', dst: unitRef('player', 0), id: 'CURSED', op: 'add' }); continue; }
    if (it.shield) { addStatus(e, 'WARD', 3, { value: Math.round(e.maxHp * it.shield) }); ev(st, { t: 'status', dst: unitRef('enemy', e.idx), id: 'WARD', op: 'add' }); continue; }
    if (it.cleave && p.pet?.alive) damagePet(st, e, e.dmg * it.mult, 'phys', it.name);
    const soft = c.round >= 20 && !c.isBoss ? 1 + 0.25 * (c.round - 19) : 1;
    for (let h = 0; h < (it.hits || 1); h++) {
      const raw = e.dmg * it.mult * soft * clamp(1 + 0.04 * (e.level - p.level), 0.7, 1.3) * (hasStatus(e, 'CHILLED') ? 0.8 : 1) * (hasStatus(e, 'ENRAGED') ? 1.4 : 1);
      if (tgt === 'pet') damagePet(st, e, raw, it.school, it.name);
      else {
        const mit = it.school === 'phys' ? 1 - mitigation(p.stats.armor, e.level) : 1;
        const out = damagePlayer(st, e, raw * mit, it.school, it.name);
        if (it.bleed && out && !out.miss && out.amount > 0 && !c.over) { addStatus(p, 'BLEED', 3, { tick: Math.max(1, Math.round(e.dmg * it.bleed)), source: it.name }); ev(st, { t: 'status', dst: unitRef('player', 0), id: 'BLEED', op: 'add' }); }
      }
      if (c.over) return;
    }
    if (e.rank !== 'normal' && e.rank !== 'trash' && !e.enraged && e.hp / e.maxHp < 0.3 && e.rank !== 'boss') { e.enraged = true; addStatus(e, 'ENRAGED', 99); ev(st, { t: 'status', dst: unitRef('enemy', e.idx), id: 'ENRAGED', op: 'add' }); }
  }
}

function bossAct(st, e) {
  const c = st.combat; const b = c.boss; const it = e.intent; const p = st.player;
  ev(st, { t: 'action', src: unitRef('enemy', e.idx), kind: it.cast ? 'cast' : 'attack', id: it.id, name: it.name, dst: unitRef('player', 0), heavy: it.heavy, school: it.school, boss: true });
  const scale = (1 + b.asc) * (1 + 0.05 * (b.p3Rounds || 0));
  if (it.id === 'litany') {
    if (it.start) { b.litany = { step: 1 }; ev(st, { t: 'msg', text: 'Oruvath begins the Collapse Litany!', kind: 'warn' }); return; }
    b.litany = null;
    damagePlayer(st, e, 850 * scale, 'shadow', 'Collapse Litany', { flat: true });
    if (!c.over) damagePet(st, e, 850 * scale, 'shadow', 'Collapse Litany');
    return;
  }
  if (it.id === 'final_dark') { damagePlayer(st, e, 99999, 'shadow', 'Final Dark', { flat: true, ignoreImmune: true, ignoreWard: true }); return; }
  if (it.id === 'pulse') { damagePlayer(st, e, 280 * scale, 'shadow', 'Starless Pulse', { flat: true }); if (!c.over) damagePet(st, e, 280 * scale, 'shadow', 'Starless Pulse'); return; }
  const raw = it.flat * scale * (1 - mitigation(p.stats.armor, 62));
  if (p.pet?.alive && (hasStatus(p.pet, 'TAUNT') || c.feign > 0)) damagePet(st, e, it.flat * scale, 'phys', it.name);
  else damagePlayer(st, e, raw, 'phys', it.name);
}

function checkBossPhase(st, e) {
  const c = st.combat; const b = c.boss; const f = e.hp / e.maxHp;
  if (b.phase === 1 && f <= 0.7) { b.phase = 2; st.run.bossPhase = 2; ev(st, { t: 'bossPhase', phase: 2, name: 'The Dimming', text: 'Shards of dead light tear free. While they live, Oruvath is Linked.' }); summonShards(st); }
  if (b.phase === 2 && f <= 0.4) {
    b.phase = 3; st.run.bossPhase = 3; b.p3Rounds = 0;
    for (const s of c.enemies) if (s.rank === 'shard' && s.alive) { s.alive = false; s.hp = 0; ev(st, { t: 'death', dst: unitRef('enemy', s.idx), name: s.name, despawn: true }); }
    ev(st, { t: 'bossPhase', phase: 3, name: 'Eclipse', text: 'The light dies. Oruvath grows stronger every round.' });
  }
}
function summonShards(st) {
  const c = st.combat;
  const alive = c.enemies.filter((x) => x.alive && x.rank === 'shard').length;
  const n = Math.min(2, 4 - alive);
  const idxs = [];
  for (let k = 0; k < n; k++) {
    const sh = { idx: c.enemies.length, uid: uid(st), name: 'Dimming Shard', arch: 'shard', level: 60, rank: 'shard', hp: 1300, maxHp: 1300, armor: 400, dmg: 110 * (1 + c.boss.asc), dodge: 0, statuses: [], cds: {}, intent: null, alive: true, abilities: [] };
    c.enemies.push(sh); idxs.push(sh.idx);
  }
  if (idxs.length) ev(st, { t: 'summon', idxs, names: idxs.map(() => 'Dimming Shard') });
}

function endRound(st) {
  const c = st.combat; const p = st.player;
  if (c.over) return;
  // ticks: player side first
  for (const s of [...p.statuses]) {
    if (s.id === 'BLEED' || s.id === 'BURN') damagePlayer(st, null, s.tick || 3, s.id === 'BURN' ? 'fire' : 'phys', s.source || s.id, { tick: true });
    if (s.id === 'BRAND') damagePlayer(st, null, 35 * s.stacks * (1 + c.boss.asc), 'shadow', 'Brand of the Hollow', { tick: true });
    if (s.id === 'HOT') healPlayer(st, Math.round(p.maxHp * (s.value || 0.04)), 'Field Dressing');
    if (s.id === 'EVASION' && p.talents.r_b4) healPlayer(st, Math.round(p.maxHp * 0.03 * p.talents.r_b4), 'Veiled Recovery');
    if (c.over) return;
  }
  for (const e of c.enemies) {
    if (!e.alive) continue;
    for (const s of [...e.statuses]) {
      if ((s.id === 'BLEED' || s.id === 'BURN' || s.id === 'POISON') && e.alive) hitEnemy(st, e, s.tick || 3, s.id === 'BURN' ? 'fire' : s.id === 'POISON' ? 'nature' : 'phys', s.source || s.id, { tick: true, noMods: true });
    }
  }
  if (living(st).length === 0) return victory(st);
  // durations
  const dec = (u, side, idx) => {
    for (const s of u.statuses) if (s.id !== 'BRAND' && s.id !== 'ENRAGED') s.rounds--;
    const gone = u.statuses.filter((s) => s.rounds <= 0 && s.id !== 'BRAND' && s.id !== 'ENRAGED');
    u.statuses = u.statuses.filter((s) => !gone.includes(s));
    for (const g of gone) ev(st, { t: 'status', dst: unitRef(side, idx), id: g.id, op: 'remove' });
  };
  dec(p, 'player', 0);
  if (p.pet) dec(p.pet, 'pet', 0);
  for (const e of c.enemies) if (e.alive) { dec(e, 'enemy', e.idx); for (const k in e.cds) if (e.cds[k] > 0) e.cds[k]--; }
  for (const k in c.cooldowns) if (c.cooldowns[k] > 0) c.cooldowns[k]--;
  if (c.potionCd > 0) c.potionCd--;
  if (c.feign > 0) c.feign--;
  // regen
  const rapid = hasStatus(p, 'RAPID');
  if (p.res.kind === 'energy') p.res.cur = Math.min(p.res.max, p.res.cur + C.ENERGY_REGEN);
  if (p.res.kind === 'focus') p.res.cur = Math.min(p.res.max, p.res.cur + Math.round(C.FOCUS_REGEN * (rapid ? 1.5 : 1)));
  if (p.res.kind === 'mana') p.res.cur = Math.min(p.res.max, p.res.cur + Math.round(p.res.max * C.MANA_REGEN));
  // boss timers
  if (c.isBoss) {
    const b = c.boss;
    if (b.phase === 3) b.p3Rounds = (b.p3Rounds || 0) + 1;
    if (c.round % 4 === 0) {
      const br = hasStatus(p, 'BRAND');
      if (br) br.stacks = Math.min(10, br.stacks + 1); else addStatus(p, 'BRAND', 999, { stacks: 1 });
      ev(st, { t: 'status', dst: unitRef('player', 0), id: 'BRAND', op: 'add', stacks: hasStatus(p, 'BRAND').stacks });
    }
    if (b.phase === 2 && (c.round - (b.p2Start || c.round)) % 8 === 7) summonShards(st);
  }
  c.round++;
  st.run.rounds++;
  c.unaware = false;
  ev(st, { t: 'round', round: c.round });
  rollIntents(st);
}

function victory(st) {
  const c = st.combat; const p = st.player;
  c.over = 'victory';
  removeStatus(p, 'STEALTH');
  ev(st, { t: 'victory' });
  if (c.isBoss) {
    st.run.kills.boss++;
    st.run.bossKilled = true;
    toSummary(st, 'victory');
    return;
  }
  // post-fight regen
  const pct = C.MOCK_REGEN_BASE + 0.12 * p.stats.spi / (p.stats.spi + 2 * p.level + 10);
  p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * pct));
  if (p.res.kind === 'mana') p.res.cur = Math.min(p.res.max, p.res.cur + Math.round(p.res.max * pct));
  if (p.pet) { if (!p.pet.alive) { p.pet.alive = true; p.pet.hp = Math.round(p.pet.maxHp * 0.25); } else p.pet.hp = Math.min(p.pet.maxHp, p.pet.hp + Math.round(p.pet.maxHp * pct)); p.pet.statuses = []; }
  p.statuses = p.statuses.filter((s) => s.id === 'BRAND');
  p.cp = 0;
  const gold = c.goldGained || 0;
  p.gold += gold; st.run.goldEarned += gold;
  st.loot = { kind: 'loot', title: 'Loot', gold, xp: c.xpGained || 0, items: c.drops || [] };
}

// ------------------------------------------------------------------ nodes
function enterNode(st, n) {
  const z = st.zone; const p = st.player;
  st.hours += C.HOURS[n.type] || 0;
  st.run.nodes[n.type] = (st.run.nodes[n.type] || 0) + 1;
  z.pos = { row: n.row, lane: n.lane };
  z.path.push({ row: n.row, lane: n.lane });
  z.rows[n.row - 1][n.lane].visited = true;
  st.phase = 'NODE';
  st.node = { ...n, step: 'intro', fightNo: 0 };
  ev(st, { t: 'enterNode', type: n.type, row: n.row, lane: n.lane });
  const node = st.node;
  if (n.type === 'rest') { doRest(st); node.step = 'rest'; }
  if (n.type === 'vendor') { node.step = 'vendor'; node.stock = vendorStock(st, n.cl); }
  if (n.type === 'trainer') { node.step = 'trainer'; }
  if (n.type === 'shrine') { node.step = 'shrine'; node.boons = shrineBoons(st); }
  if (n.type === 'treasure' && !n.guard) { node.step = 'chest'; }
  if (n.type === 'grind') node.waves = 0;
  if (n.type === 'dungeon') { node.fights = 4; }
  if (p.elixirNodes > 0) p.elixirNodes--;
  for (const b of p.boons) if (b.nodesLeft) b.nodesLeft--;
  p.boons = p.boons.filter((b) => b.nodesLeft === undefined || b.nodesLeft > 0);
}

function doRest(st) {
  const p = st.player;
  p.hp = p.maxHp; p.res.cur = p.res.max;
  if (p.pet) { p.pet.alive = true; p.pet.hp = p.pet.maxHp; }
  const add = Math.round(C.REST_RESTED * p.xpToNext);
  p.rested = Math.min(Math.round(C.RESTED_CAP * p.xpToNext), p.rested + add);
  ev(st, { t: 'rest', rested: p.rested });
}

function vendorStock(st, cl) {
  const p = st.player;
  const items = ['healing_draught', 'mana_draught', 'trail_rations', 'purifying_tonic', 'spark_flask', 'elixir_ferocity'].map((id) => ({ ...consumable(st, id, 1), price: Math.max(1, Math.round(D.CONSUMABLES[id].price * V(cl))) }));
  for (let k = 0; k < 3; k++) { const g = gear(st, pick(st, D.SLOTS), cl, rnd(st) < 0.4 ? 'rare' : 'uncommon', p.classId); g.price = g.sell * 4; items.push(g); }
  if (rnd(st) < 0.15 || cl >= 58) items.push({ ...consumable(st, 'ember_of_return', 1), price: 30 * V(cl) });
  return items;
}

function shrineBoons(st) {
  const ids = Object.keys(D.BOONS);
  const a = weighted(st, ids.map((i) => [i, D.BOONS[i].w]));
  let b = a; while (b === a) b = weighted(st, ids.map((i) => [i, D.BOONS[i].w]));
  return [a, b].map((id) => ({ id, name: D.BOONS[id].name, text: D.BOONS[id].text }));
}

function startNodeFight(st) {
  const n = st.node; const z = st.zone;
  n.fightNo++;
  if (n.type === 'quest') startFight(st, n.mobs.map((t, i) => makeEnemy(st, i, t, n.cl, 'normal')), { kind: 'quest', title: n.title });
  else if (n.type === 'grind') { n.waves++; st.hours += n.waves > 1 ? C.HOURS.grind : 0; startFight(st, n.mobs.map((t, i) => makeEnemy(st, i, t, n.cl, 'normal')), { kind: 'grind', title: `Wave ${n.waves} of ${n.wavesChosen}`, fightNo: n.waves, fights: n.wavesChosen }); }
  else if (n.type === 'elite') {
    const es = [makeEnemy(st, 0, n.elite, n.cl, n.rare ? 'rare' : 'elite')];
    if (n.add) es.push(makeEnemy(st, 1, n.add, n.cl - 2, 'normal'));
    startFight(st, es, { kind: n.rare ? 'rare' : 'elite', title: n.eliteName });
  } else if (n.type === 'dungeon') {
    const lvl = n.cl;
    if (n.fightNo <= 3) {
      const size = rnd(st) < 0.5 ? 2 : 3;
      startFight(st, Array.from({ length: size }, (_, i) => makeEnemy(st, i, pick(st, n.trash), lvl, 'trash')), { kind: 'dungeon', title: `${n.dungeon}: ${n.fightNo} of 4`, fightNo: n.fightNo, fights: 4 });
    } else startFight(st, [makeEnemy(st, 0, n.boss, Math.min(62, lvl + 2), 'dboss')], { kind: 'dboss', title: n.bossName, canFlee: false, noStealth: true, fightNo: 4, fights: 4 });
  } else if (n.type === 'treasure') startFight(st, [makeEnemy(st, 0, n.guard, n.cl, 'normal')], { kind: 'treasure', title: 'Treasure guardian' });
  else if (n.type === 'camp_grind') {
    const pool = (CT.camp && CT.camp.enemies ? CT.camp.enemies.map(enemyCt).filter(Boolean) : null) || (zoneCt(6) ? zoneCt(6).normals.map(enemyCt).filter(Boolean) : [{ name: 'Starbound Husk', archetype: 'brute' }, { name: 'Void-touched Seer', archetype: 'caster' }]);
    startFight(st, [makeEnemy(st, 0, pick(st, pool), 58, 'normal'), makeEnemy(st, 1, pick(st, pool), 58, 'normal')], { kind: 'grind', title: 'Camp wave' });
  }
  n.step = 'combat';
}

function afterLoot(st) {
  const n = st.node; const p = st.player; const z = st.zone;
  st.combat = null;
  if (!n) { st.loot = null; return; }
  if (n.type === 'camp_grind') { st.loot = null; st.node = null; st.phase = 'CAMP'; return; }
  if (n.type === 'quest' && n.step === 'combat') {
    const xp = Math.round(C.QUEST_XP * xpToNext(Math.min(59, n.cl)) * diffMod(n.cl - p.level) * xpBoon(p));
    const gold = 2 * V(n.cl);
    n.step = 'reward';
    st.loot = { kind: 'reward', title: n.title, giver: n.giver, text: n.turnIn, xp, gold, choices: [gear(st, pick(st, D.SLOTS), n.cl, rnd(st) < 0.8 ? 'uncommon' : 'rare', p.classId), gear(st, pick(st, D.SLOTS), n.cl, rnd(st) < 0.8 ? 'uncommon' : 'rare', p.classId)] };
    return;
  }
  if (n.type === 'quest' && n.step === 'reward') {
    z.questsDone++; st.run.quests++;
    if (z.questsDone === 3 && !z.storyDone) {
      z.storyDone = true; st.run.story++;
      n.step = 'story';
      st.loot = { kind: 'story', title: `${z.name}: the story ends`, text: 'Three tasks done; the people of the zone will remember your name.', xp: Math.round(C.STORY_XP * xpToNext(Math.min(59, n.cl))), gold: 0, choices: [0, 1, 2].map(() => gear(st, pick(st, D.SLOTS), n.cl + 1, 'rare', p.classId)) };
      return;
    }
  }
  if (n.type === 'grind' && n.waves < n.wavesChosen) { st.loot = null; n.step = 'between'; return; }
  if (n.type === 'grind') gainXp(st, Math.round(C.GRIND_WAVE_XP * xpToNext(Math.min(59, n.cl)) * n.waves), false);
  if (n.type === 'dungeon' && n.fightNo < 4) { st.loot = null; n.step = 'between'; return; }
  if (n.type === 'dungeon' && n.fightNo === 4 && n.step !== 'cleared') {
    st.run.dungeons++;
    const xp = gainXp(st, Math.round(C.DUNGEON_CLEAR_XP * xpToNext(Math.min(59, n.cl)) * diffMod(n.cl - p.level)), false);
    const gold = 6 * V(n.cl); p.gold += gold; st.run.goldEarned += gold;
    n.step = 'cleared';
    st.loot = { kind: 'loot', title: `${n.dungeon} cleared`, gold, xp, items: [] };
    return;
  }
  if (n.type === 'treasure' && n.step !== 'chest' && n.step !== 'opened') { st.loot = null; n.step = 'chest'; return; }
  st.loot = null;
  finishNode(st);
}

function finishNode(st) {
  const z = st.zone;
  st.node = null; st.combat = null; st.loot = null;
  st.phase = 'MAP';
  z.mustTravel = z.pos.row >= C.ROWS;
}

function toSummary(st, outcome) {
  const p = st.player; const r = st.run;
  const asc = ascendancy(st.hours);
  const echoes = [
    ['Levels gained', (p.level - 1) * 2], ['Zones completed', r.zonesLeft * 10], ['Dungeons cleared', r.dungeons * 8],
    ['Elites slain', r.kills.elite * 3], ['Rares slain', r.kills.rare * 6], ['Quests completed', r.quests],
  ];
  if (st.zone.idx === 7) echoes.push(['Reached the boss', 20]);
  if (r.bossPhase > 1) echoes.push(['Boss phases reached', (r.bossPhase - 1) * 15]);
  if (outcome === 'victory') { echoes.push(['Oruvath defeated', 120]); if (st.hours <= C.BOSS_TIME_PAR) echoes.push(['Swift victory', 40]); }
  const top = Object.entries(r.bySpell).sort((a, b) => b[1] - a[1]).slice(0, 3);
  st.summary = {
    outcome, name: p.name, classId: p.classId, className: p.className, petId: p.petId, level: p.level, xp: p.xp, xpToNext: p.xpToNext,
    zone: st.zone.name, zoneIdx: st.zone.idx, row: st.zone.pos.row, hours: st.hours, asc, seed: st.seed,
    death: st.deathInfo || null, talents: { ...p.talentSpent }, kills: { ...r.kills }, quests: r.quests, story: r.story, dungeons: r.dungeons,
    fights: r.fights, rounds: r.rounds, goldEarned: r.goldEarned, goldSpent: r.goldSpent, potions: r.potions, resurrects: r.resurrects,
    dealt: r.dealt, taken: r.taken, topSpells: top, equipped: D.SLOTS.map((s) => p.equip[s]).filter(Boolean),
    estMinutes: { manual: Math.round((r.rounds * 2.5 + r.fights * 3 + 40) / 60), auto: Math.round((r.rounds * 0.8 + r.fights * 3 + 40) / 60) },
    bossPhase: r.bossPhase, echoes, echoTotal: echoes.reduce((a, e) => a + e[1], 0),
  };
  st.phase = 'SUMMARY';
}

const ascendancy = (h) => Math.min(C.ASC_CAP, C.ASC_PER * Math.floor(Math.max(0, h - C.BOSS_TIME_PAR) / C.ASC_STEP));

function enterZone(st, z) {
  st.zone = genZone(st, z);
  st.hub = { used: { trainer: false, vendor: false, inn: false } };
  st.phase = z > 6 ? 'CAMP' : 'ZONE_HUB';
  ev(st, { t: 'zone', idx: z, name: st.zone.name, band: st.zone.band, theme: st.zone.theme });
}

// ------------------------------------------------------------------ action handlers
const outOfCombat = (st) => !st.combat || !!st.combat.over;
const H = {};

H.SELECT_CLASS = (st, a) => { if (st.phase !== 'CREATE') return 'Not now'; if (!D.CLASSES[a.classId]) return 'Unknown class'; st.create.classId = a.classId; };
H.SELECT_PET = (st, a) => { if (st.phase !== 'CREATE') return 'Not now'; const pd = D.PETS[a.petId]; if (!pd || pd.locked) return 'Pet locked'; st.create.petId = a.petId; };
H.SET_NAME = (st, a) => { if (st.phase !== 'CREATE') return 'Not now'; st.create.name = String(a.name || '').slice(0, 16); };
H.SET_SEED = (st, a) => { if (st.phase !== 'CREATE') return 'Not now'; st.create.seed = a.seed === 'random' || a.seed === null || a.seed === '' ? null : Number(a.seed) >>> 0; };
H.START_RUN = (st) => {
  if (st.phase !== 'CREATE') return 'Not now';
  if (st.create.seed !== null) { st.seed = st.create.seed; st._rng = hashSeed(st.seed); }
  st.player = makePlayer(st);
  enterZone(st, 1);
};

H.HUB_SERVICE = (st, a) => {
  if (st.phase !== 'ZONE_HUB' && st.phase !== 'CAMP') return 'Not in a hub';
  if (st.node) return 'Finish the current service first';
  if (!['trainer', 'vendor', 'inn'].includes(a.service)) return 'Unknown service';
  if (st.hub.used[a.service]) return 'Already used this visit';
  st.hub.used[a.service] = true;
  if (a.service === 'inn') { st.hours += C.HOURS.inn; doRest(st); return; }
  st.hours += 1;
  const cl = st.zone.idx > 6 ? 60 : st.zone.band[0];
  st.node = { type: a.service, cl, step: a.service, origin: 'hub', stock: a.service === 'vendor' ? vendorStock(st, cl) : null };
};
H.LEAVE_HUB = (st) => { if (st.phase !== 'ZONE_HUB' || st.node) return 'Not now'; st.phase = 'MAP'; };

H.CHOOSE_NODE = (st, a) => {
  if (st.phase !== 'MAP') return 'Not on the map';
  const L = legalInfo(st);
  if (!L.lanes.includes(a.lane)) return 'That path is not reachable';
  const row = st.zone.pos.row + 1;
  enterNode(st, st.zone.rows[row - 1][a.lane]);
};
H.TRAVEL_ON = (st) => {
  if (st.phase !== 'MAP') return 'Not on the map';
  if (!legalInfo(st).travelOn) return `Reach level ${st.zone.exitLevel} or finish the zone first`;
  st.hours += C.HOURS.travel; st.run.zonesLeft++;
  enterZone(st, st.zone.idx + 1);
};

H.ACCEPT = (st) => {
  const n = st.node;
  if (!n || st.phase !== 'NODE' || !['quest', 'elite', 'dungeon', 'treasure'].includes(n.type) || n.step !== 'intro') return 'Nothing to accept';
  startNodeFight(st);
};
H.GRIND_SET_WAVES = (st, a) => {
  const n = st.node;
  if (!n || n.type !== 'grind' || n.step !== 'intro') return 'Not now';
  const w = Math.round(a.n);
  if (!(w >= 1 && w <= 3)) return 'Choose 1 to 3 waves';
  n.wavesChosen = w;
  startNodeFight(st);
};
H.CONTINUE = (st) => {
  const n = st.node;
  if (!n || n.step !== 'between') return 'Not now';
  startNodeFight(st);
};
H.GRIND_STOP = (st) => { const n = st.node; if (!n || n.type !== 'grind' || n.step !== 'between') return 'Not now'; gainXp(st, Math.round(C.GRIND_WAVE_XP * xpToNext(Math.min(59, n.cl)) * n.waves), false); finishNode(st); };
H.DUNGEON_LEAVE = (st) => { const n = st.node; if (!n || n.type !== 'dungeon' || n.step !== 'between') return 'Not now'; st.hours += 0; finishNode(st); };
H.OPEN_CHEST = (st) => {
  const n = st.node; const p = st.player;
  if (!n || n.type !== 'treasure' || n.step !== 'chest') return 'Not now';
  n.step = 'opened';
  const gold = 3 * V(n.cl); p.gold += gold; st.run.goldEarned += gold;
  ev(st, { t: 'chest', gold });
  if (n.trap) { const loss = Math.min(p.hp - 1, Math.round(p.maxHp * 0.15)); p.hp -= loss; ev(st, { t: 'damage', src: unitRef('env', 0), dst: unitRef('player', 0), amount: loss, school: 'phys', name: 'Needle trap', hpAfter: p.hp, maxHp: p.maxHp }); }
  st.loot = { kind: 'loot', title: 'Treasure chest', gold, xp: 0, items: [gear(st, pick(st, D.SLOTS), n.cl, rollRarity(st, [0, 70, 27, 3]), p.classId)], trap: n.trap };
};

H.LOOT_TAKE = (st, a) => {
  if (!st.loot || st.loot.kind !== 'loot') return 'No loot';
  const it = st.loot.items[a.i];
  if (!it) return 'No such item';
  if (!bagAdd(st, st.player, it)) return 'Your bags are full';
  st.loot.items.splice(a.i, 1);
  ev(st, { t: 'gotItem', name: it.name, rarity: it.rarity });
};
H.LOOT_TAKE_ALL = (st) => {
  if (!st.loot || st.loot.kind !== 'loot') return 'No loot';
  const keep = [];
  for (const it of st.loot.items) { if (bagAdd(st, st.player, it)) ev(st, { t: 'gotItem', name: it.name, rarity: it.rarity }); else keep.push(it); }
  st.loot.items = keep;
  if (keep.length) { ev(st, { t: 'msg', text: 'Your bags are full.', kind: 'warn' }); return; }
  afterLoot(st);
};
H.LOOT_CLOSE = (st) => { if (!st.loot || st.loot.kind !== 'loot') return 'No loot'; afterLoot(st); };
H.CHOOSE_REWARD = (st, a) => {
  const L = st.loot; const p = st.player; const n = st.node;
  if (n && n.type === 'shrine' && n.step === 'shrine') {
    const b = n.boons[a.i]; if (!b) return 'No such boon';
    if (b.id === 'return') { p.boons.push({ id: 'return', name: b.name }); p.resurrect.unshift('boon'); }
    if (b.id === 'insight' || b.id === 'fury') p.boons.push({ id: b.id, name: b.name, nodesLeft: 4 });
    if (b.id === 'plenty') { const g = 4 * V(n.cl); p.gold += g; st.run.goldEarned += g; ev(st, { t: 'gold', amount: g }); }
    if (b.id === 'mending') { p.hp = p.maxHp; p.res.cur = p.res.max; p.rested = Math.min(Math.round(1.5 * p.xpToNext), p.rested + Math.round(0.6 * p.xpToNext)); }
    if (b.id === 'clarity') { for (const s of p.spells) { if (s.tl < p.level) { s.tl = p.level; s.rank++; } } p.freeRespec = true; }
    ev(st, { t: 'boon', id: b.id, name: b.name });
    finishNode(st);
    return;
  }
  if (!L || (L.kind !== 'reward' && L.kind !== 'story')) return 'Nothing to choose';
  const it = L.choices[a.i]; if (!it) return 'No such reward';
  if (!bagAdd(st, p, it)) return 'Your bags are full';
  if (L.xp) gainXp(st, L.xp, false);
  if (L.gold) { p.gold += L.gold; st.run.goldEarned += L.gold; ev(st, { t: 'gold', amount: L.gold }); }
  ev(st, { t: 'gotItem', name: it.name, rarity: it.rarity });
  afterLoot(st);
};

H.BUY = (st, a) => {
  const n = st.node; const p = st.player;
  if (!n || n.type !== 'vendor') return 'No vendor';
  const it = n.stock[a.i]; if (!it) return 'No such item';
  if (p.gold < it.price) return 'Not enough gold';
  if (it.id === 'ember_of_return' && bagCount(p, 'ember_of_return') >= 1) return 'You can carry only one Ember';
  const copy = { ...structuredClone(it), uid: uid(st) }; delete copy.price;
  if (!bagAdd(st, p, copy)) return 'Your bags are full';
  p.gold -= it.price; st.run.goldSpent += it.price;
  if (it.kind === 'gear' || it.id === 'ember_of_return') n.stock.splice(a.i, 1);
  if (it.id === 'ember_of_return') p.resurrect.push('ember');
  ev(st, { t: 'buy', name: it.name, price: it.price });
};
H.SELL = (st, a) => {
  const n = st.node; const p = st.player;
  if (!n || n.type !== 'vendor') return 'No vendor';
  const i = bagFind(p, a.uid); if (i < 0) return 'No such item';
  const it = p.bag[i];
  const gold = it.sell * (it.count || 1);
  p.gold += gold; p.bag[i] = null;
  if (it.id === 'ember_of_return') p.resurrect = p.resurrect.filter((x) => x !== 'ember');
  ev(st, { t: 'sell', name: it.name, gold });
};
H.SELL_JUNK = (st) => {
  const n = st.node; const p = st.player;
  if (!n || n.type !== 'vendor') return 'No vendor';
  let gold = 0;
  p.bag = p.bag.map((s) => { if (s && s.kind === 'junk') { gold += s.sell * s.count; return null; } return s; });
  if (!gold) return 'No junk to sell';
  p.gold += gold;
  ev(st, { t: 'sell', name: 'Junk', gold });
};

export function trainerList(st) {
  const p = st.player;
  return Object.values(D.SPELLS).filter((s) => s.cls === p.classId && !s.fx.meta && !s.fx.talent).sort((a, b) => a.lvl - b.lvl).map((s) => {
    const k = knownSpell(p, s.id);
    if (!k) return { id: s.id, name: s.name, lvl: s.lvl, state: s.lvl <= p.level ? 'learnable' : 'locked', cost: 2 * V(s.lvl) };
    return { id: s.id, name: s.name, lvl: s.lvl, state: k.tl < p.level ? 'trainable' : 'current', rank: k.rank, tl: k.tl, cost: Math.round(0.5 * V(p.level)) };
  });
}
H.LEARN = (st, a) => {
  const n = st.node; const p = st.player;
  if (!n || n.type !== 'trainer') return 'No trainer';
  const e = trainerList(st).find((x) => x.id === a.spellId);
  if (!e || e.state !== 'learnable') return 'Cannot learn that';
  if (p.gold < e.cost) return 'Not enough gold';
  p.gold -= e.cost; st.run.goldSpent += e.cost;
  p.spells.push({ id: e.id, tl: p.level, rank: 1 });
  const free = p.bar.indexOf(null); if (free >= 0) p.bar[free] = e.id;
  ev(st, { t: 'learn', id: e.id, name: e.name });
};
H.TRAIN = (st, a) => {
  const n = st.node; const p = st.player;
  if (!n || n.type !== 'trainer') return 'No trainer';
  const e = trainerList(st).find((x) => x.id === a.spellId);
  if (!e || e.state !== 'trainable') return 'Nothing to train';
  if (p.gold < e.cost) return 'Not enough gold';
  p.gold -= e.cost; st.run.goldSpent += e.cost;
  const k = knownSpell(p, e.id); k.tl = p.level; k.rank++;
  ev(st, { t: 'train', id: e.id, name: e.name, rank: k.rank });
};
H.TRAIN_ALL = (st) => {
  const n = st.node; if (!n || n.type !== 'trainer') return 'No trainer';
  const list = trainerList(st).filter((e) => e.state === 'trainable');
  if (!list.length) return 'Nothing to train';
  let any = false;
  for (const e of list) if (!H.TRAIN(st, { spellId: e.id })) any = true;
  if (!any) return 'Not enough gold';
};
H.RESPEC = (st) => {
  const n = st.node; const p = st.player;
  if (!n || n.type !== 'trainer') return 'No trainer';
  const spent = Object.values(p.talents).reduce((a, b) => a + b, 0);
  if (!spent) return 'No talents to reset';
  const cost = p.freeRespec ? 0 : 10 * V(p.level);
  if (p.gold < cost) return 'Not enough gold';
  p.gold -= cost; p.freeRespec = false;
  for (const [id] of Object.entries(p.talents)) { const t = D.TALENTS[id]; if (t.spell) { p.spells = p.spells.filter((s) => s.id !== t.spell); p.bar = p.bar.map((b) => (b === t.spell ? null : b)); } }
  p.talentPoints += spent; p.talents = {}; recalc(p);
  ev(st, { t: 'msg', text: 'Your talents have been reset.', kind: 'info' });
};
H.LEAVE = (st) => {
  const n = st.node;
  if (!n) return 'Nothing to leave';
  if (n.origin === 'hub') { st.node = null; return; }
  if (['rest', 'vendor', 'trainer'].includes(n.type) || (n.type === 'treasure' && n.step === 'opened' && !st.loot)) { finishNode(st); return; }
  return 'You cannot leave now';
};

// combat
H.CAST = (st, a) => {
  if (!st.combat || st.combat.over) return 'Not in combat';
  const tgt = st.combat.enemies[a.target];
  if (tgt && tgt.alive) st.combat.target = tgt.idx;
  const err = useSpell(st, a.spellId, a.target ?? st.combat.target);
  if (err) return err;
  finishTurn(st);
};
H.ATTACK = (st, a) => {
  const c = st.combat; const p = st.player;
  if (!c || c.over) return 'Not in combat';
  let t = c.enemies[a.target ?? c.target]; if (!t || !t.alive) t = defaultTarget(st);
  c.target = t.idx;
  const cls = D.CLASSES[p.classId];
  ev(st, { t: 'action', src: unitRef('player', 0), kind: 'attack', name: cls.basic.name, school: cls.basic.school, dst: unitRef('enemy', t.idx) });
  removeStatus(p, 'STEALTH');
  const [b, l, pw, w] = cls.basic.f;
  hitEnemy(st, t, b + l * p.level + pw * p.stats.power + w * p.stats.wd, cls.basic.school, cls.basic.name);
  finishTurn(st);
};
H.USE_ITEM = (st, a) => {
  const p = st.player;
  if (st.combat && !st.combat.over) {
    const err = useCombatItem(st, a.slot, a.target ?? st.combat.target);
    if (err) return err;
    finishTurn(st);
    return;
  }
  // out of combat: by item uid
  const i = bagFind(p, a.uid); if (i < 0) return 'No such item';
  const it = p.bag[i];
  if (it.kind !== 'consumable') return 'Not usable';
  const c = D.CONSUMABLES[it.id];
  if (c.use === 'combat' || c.use === 'passive') return 'Only in combat';
  if (it.id === 'trail_rations') { if (p.hp >= p.maxHp && p.res.cur >= p.res.max) return 'You are not hungry'; p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.4)); p.res.cur = Math.min(p.res.max, p.res.cur + Math.round(p.res.max * 0.4)); if (p.pet) { p.pet.alive = true; p.pet.hp = Math.min(p.pet.maxHp, p.pet.hp + Math.round(p.pet.maxHp * 0.4)); } }
  else if (it.id === 'healing_draught' || it.id === 'greater_healing_draught') { if (p.hp >= p.maxHp) return 'Already at full health'; p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * (it.id === 'healing_draught' ? 0.35 : 0.5))); }
  else if (it.id === 'mana_draught') { if (p.res.kind !== 'mana') return 'You have no mana'; p.res.cur = Math.min(p.res.max, p.res.cur + Math.round(p.res.max * 0.35)); }
  else if (it.id === 'elixir_ferocity') p.elixirNodes = 3;
  it.count--; if (!it.count) p.bag[i] = null;
  ev(st, { t: 'used', name: it.name, hp: p.hp });
};
H.FLEE = (st) => {
  const c = st.combat; const p = st.player;
  if (!c || c.over) return 'Not in combat';
  if (!c.canFlee || c.isBoss) return 'You cannot flee from this fight';
  const chance = hasStatus(p, 'STEALTH') ? 1 : 0.6 - 0.05 * (living(st).length - 1);
  const ok = rnd(st) < chance;
  ev(st, { t: 'flee', ok });
  if (ok) { c.over = 'fled'; p.statuses = p.statuses.filter((s) => s.id === 'BRAND'); p.cp = 0; finishNode(st); return; }
  finishTurn(st, true);
};
H.PASS = (st) => { if (!st.combat || st.combat.over) return 'Not in combat'; ev(st, { t: 'action', src: unitRef('player', 0), kind: 'pass', name: 'Pass' }); finishTurn(st); };
H.SET_TARGET = (st, a) => { const c = st.combat; if (!c) return 'Not in combat'; const e = c.enemies[a.target]; if (!e || !e.alive) return 'Invalid target'; c.target = a.target; };
H.AUTO = (st) => { if (!st.combat || st.combat.over) return 'Not in combat'; const act = autoAction(st); return H[act.type](st, act); };

function finishTurn(st, skipPlayer) {
  const c = st.combat;
  if (c.over) return;
  if (living(st).length === 0) return victory(st);
  petAct(st);
  if (living(st).length === 0) return victory(st);
  enemiesAct(st);
  if (c.over) return;
  if (living(st).length === 0) return victory(st);
  endRound(st);
  if (!c.over && !c.enemies[c.target]?.alive) { const d = defaultTarget(st); if (d) c.target = d.idx; }
}

// out of combat
H.EQUIP = (st, a) => {
  const p = st.player; if (!outOfCombat(st)) return 'Not in combat';
  const i = bagFind(p, a.uid); if (i < 0) return 'No such item';
  const it = p.bag[i]; if (it.kind !== 'gear') return 'Cannot equip that';
  const old = p.equip[it.slot]; p.equip[it.slot] = it; p.bag[i] = old || null;
  recalc(p);
  ev(st, { t: 'equip', slot: it.slot, name: it.name });
};
H.UNEQUIP = (st, a) => {
  const p = st.player; if (!outOfCombat(st)) return 'Not in combat';
  const it = p.equip[a.slot]; if (!it) return 'Nothing equipped';
  const free = p.bag.indexOf(null); if (free < 0) return 'Your bags are full';
  p.bag[free] = it; p.equip[a.slot] = null; recalc(p);
};
H.DISCARD = (st, a) => {
  const p = st.player; if (!outOfCombat(st)) return 'Not in combat';
  const i = bagFind(p, a.uid); if (i < 0) return 'No such item';
  if (p.bag[i].id === 'ember_of_return') p.resurrect = p.resurrect.filter((x) => x !== 'ember');
  p.bag[i] = null;
};
H.SET_BAR = (st, a) => {
  const p = st.player; if (!outOfCombat(st)) return 'Bar changes only out of combat';
  if (a.slot < 0 || a.slot >= C.BAR) return 'No such slot';
  if (a.spellId && !knownSpell(p, a.spellId)) return 'Spell not known';
  const prev = p.bar.indexOf(a.spellId);
  if (a.spellId && prev >= 0) p.bar[prev] = p.bar[a.slot];
  p.bar[a.slot] = a.spellId || null;
};
H.SET_ITEM_BAR = (st, a) => {
  const p = st.player; if (!outOfCombat(st)) return 'Bar changes only out of combat';
  if (a.slot < 0 || a.slot >= C.ITEM_BAR) return 'No such slot';
  if (a.itemId && !D.CONSUMABLES[a.itemId]) return 'Only consumables';
  const prev = p.itemBar.indexOf(a.itemId);
  if (a.itemId && prev >= 0) p.itemBar[prev] = p.itemBar[a.slot];
  p.itemBar[a.slot] = a.itemId || null;
};
H.SPEND_TALENT = (st, a) => {
  const p = st.player; if (!outOfCombat(st)) return 'Not in combat';
  const chk = talentState(p, a.talentId);
  if (!chk.canSpend) return chk.reason;
  p.talents[a.talentId] = (p.talents[a.talentId] || 0) + 1; p.talentPoints--;
  const t = D.TALENTS[a.talentId];
  if (t.spell && !knownSpell(p, t.spell)) { p.spells.push({ id: t.spell, tl: p.level, rank: 1 }); const free = p.bar.indexOf(null); if (free >= 0) p.bar[free] = t.spell; }
  recalc(p);
  ev(st, { t: 'talent', id: a.talentId, name: t.name, rank: p.talents[a.talentId] });
};
export function talentState(p, id) {
  const t = D.TALENTS[id]; const cur = p.talents[id] || 0;
  const spentTree = Object.entries(p.talents).filter(([k]) => D.TALENTS[k].tree === t.tree).reduce((a, [, r]) => a + r, 0);
  const need = 4 * (t.tier - 1);
  if (cur >= t.ranks) return { canSpend: false, reason: 'Maxed', rank: cur, need, spentTree };
  if (spentTree < need) return { canSpend: false, reason: `Requires ${need} points in ${t.tree}`, rank: cur, need, spentTree, locked: true };
  if (p.talentPoints < 1) return { canSpend: false, reason: 'No talent points', rank: cur, need, spentTree };
  return { canSpend: true, rank: cur, need, spentTree };
}
H.SET_AUTOPLAY = (st, a) => { st.autoplay = !!a.on; };

H.CAMP_GRIND = (st) => {
  if (st.phase !== 'CAMP' || st.node) return 'Not now';
  st.hours += 1;
  st.phase = 'NODE';
  st.node = { type: 'camp_grind', cl: 58, step: 'intro', fightNo: 0, origin: 'camp' };
  startNodeFight(st);
};
H.FIGHT_BOSS = (st) => {
  if (st.phase !== 'CAMP' || st.node) return 'Not now';
  const asc = ascendancy(st.hours);
  st.phase = 'BOSS';
  st.run.bossPhase = 1;
  const boss = { idx: 0, uid: uid(st), name: D.BOSS.name, arch: 'boss', level: 62, rank: 'boss', hp: Math.round(D.BOSS.hp * (1 + asc)), maxHp: Math.round(D.BOSS.hp * (1 + asc)), armor: D.BOSS.armor, dmg: 200, dodge: 0.05, statuses: [], cds: {}, intent: null, alive: true, abilities: [] };
  startFight(st, [boss], { kind: 'boss', isBoss: true, canFlee: false, noStealth: true, asc, title: D.BOSS.name });
};
H.END_RUN = (st) => {
  if (st.phase !== 'SUMMARY') return 'Not now';
  const fresh = createState({ seed: Math.floor(rnd(st) * 1e9) });
  Object.keys(st).forEach((k) => delete st[k]);
  Object.assign(st, fresh);
  st.create.classId = 'rogue';
};

// debug helpers (mock only)
H.DEBUG_JUMP = (st, a) => {
  if (!st.player) { st.create.classId = a.classId || st.create.classId; H.START_RUN(st); }
  const p = st.player;
  const lvl = clamp(a.level || p.level, 1, 60);
  while (p.level < lvl) { p.level++; if (p.level >= 10 && (p.level - 10) % 2 === 0) p.talentPoints++; }
  p.xpToNext = xpToNext(p.level); p.xp = Math.round(p.xpToNext * 0.35); p.rested = Math.round(p.xpToNext * 0.3);
  for (const s of Object.values(D.SPELLS)) if (s.cls === p.classId && s.lvl <= p.level && !s.fx.meta && !s.fx.talent && !knownSpell(p, s.id)) p.spells.push({ id: s.id, tl: p.level, rank: 1 + Math.floor(p.level / 8) });
  for (const s of p.spells) { s.tl = p.level; }
  if (a.gear) for (const sl of D.SLOTS) p.equip[sl] = gear(st, sl, p.level, sl === 'weapon' ? 'epic' : rnd(st) < 0.5 ? 'rare' : 'uncommon', p.classId);
  const bar = p.spells.map((s) => s.id).slice(-7);
  if (a.level >= 10) p.bar = [...bar, null, null, null, null, null, null, null].slice(0, 7);
  bagAdd(st, p, consumable(st, 'healing_draught', 5));
  if (p.res.kind === 'mana') bagAdd(st, p, consumable(st, 'mana_draught', 3));
  bagAdd(st, p, consumable(st, 'purifying_tonic', 2));
  p.itemBar = ['healing_draught', p.res.kind === 'mana' ? 'mana_draught' : 'purifying_tonic', p.res.kind === 'mana' ? 'purifying_tonic' : null];
  p.gold += a.gold || 0;
  recalc(p); p.hp = p.maxHp; p.res.cur = p.res.max; if (p.pet) { p.pet.alive = true; p.pet.hp = p.pet.maxHp; }
  st.node = null; st.combat = null; st.loot = null;
  if (a.to === 'camp' || a.to === 'boss') { st.hours = a.hours ?? 128; enterZone(st, 7); if (a.to === 'boss') H.FIGHT_BOSS(st); }
  else if (a.to === 'zone') { enterZone(st, clamp(a.zone || 1, 1, 6)); if (a.map) st.phase = 'MAP'; }
};

// ------------------------------------------------------------------ public API
export function step(state, action) {
  const h = H[action && action.type];
  if (!h) return { ok: false, error: `Unknown action ${action && action.type}`, state, events: [] };
  const st = structuredClone(state);
  st.events = [];
  const err = h(st, action);
  if (typeof err === 'string') return { ok: false, error: err, state, events: [] };
  return { ok: true, error: null, state: st, events: st.events };
}

export function legalInfo(st) {
  const L = { lanes: [], travelOn: false, mustTravel: false, outOfCombat: outOfCombat(st), spells: {}, items: [], attack: false, flee: false, services: {} };
  const p = st.player;
  if (st.phase === 'MAP') {
    const z = st.zone; const r = z.pos.row;
    if (r < C.ROWS) {
      if (r === 0) L.lanes = [0, 1, 2];
      else L.lanes = [z.pos.lane - 1, z.pos.lane, z.pos.lane + 1].filter((l) => l >= 0 && l < 3);
    }
    L.mustTravel = r >= C.ROWS;
    L.travelOn = p.level >= z.exitLevel || r >= C.ROWS;
  }
  if ((st.phase === 'ZONE_HUB' || st.phase === 'CAMP') && st.hub) for (const s of ['trainer', 'vendor', 'inn']) L.services[s] = !st.hub.used[s] && !st.node;
  if (st.combat && !st.combat.over) {
    for (const s of p.spells) L.spells[s.id] = canCast(st, s.id);
    L.items = p.itemBar.map((_, i) => canUseItem(st, i));
    L.attack = true;
    L.flee = st.combat.canFlee && !st.combat.isBoss;
    L.fleeChance = hasStatus(p, 'STEALTH') ? 1 : Math.max(0, 0.6 - 0.05 * (living(st).length - 1));
  } else if (p) {
    L.items = p.itemBar.map((_, i) => canUseItem(st, i));
  }
  if (p) {
    L.talents = {};
    for (const id of Object.keys(D.TALENTS)) if (D.TALENTS[id].id[0] === p.classId[0]) L.talents[id] = talentState(p, id);
  }
  if (st.node && st.node.type === 'trainer') L.trainer = trainerList(st);
  return L;
}

export function autoAction(st) {
  const p = st.player; const c = st.combat;
  const L = legalInfo(st);
  const tgt = defaultTarget(st);
  const ti = tgt ? tgt.idx : 0;
  const slotOf = (id) => p.itemBar.indexOf(id);
  const hs = slotOf('healing_draught');
  if (p.hp / p.maxHp < 0.35 && hs >= 0 && L.items[hs]?.ok) return { type: 'USE_ITEM', slot: hs, target: ti };
  const debuffs = p.statuses.filter((s) => D.STATUS_INFO[s.id]?.debuff).reduce((a, s) => a + (s.id === 'BRAND' ? s.stacks : 1), 0);
  if (debuffs >= 3) {
    const cl = p.bar.find((id) => id && D.SPELLS[id].tags.includes('cleanse') && L.spells[id]?.ok);
    if (cl) return { type: 'CAST', spellId: cl, target: ti };
    const ts = slotOf('purifying_tonic'); if (ts >= 0 && L.items[ts]?.ok) return { type: 'USE_ITEM', slot: ts, target: ti };
  }
  const casting = living(st).filter((e) => e.intent && e.intent.cast && !e.intent.interrupted).sort((a, b) => b.intent.est - a.intent.est)[0];
  if (casting) {
    const intr = p.bar.find((id) => id && (D.SPELLS[id].tags.includes('interrupt') || D.SPELLS[id].tags.includes('stun')) && L.spells[id]?.ok);
    if (intr) return { type: 'CAST', spellId: intr, target: casting.idx };
  }
  const ms = slotOf('mana_draught');
  if (p.res.kind === 'mana' && p.res.cur / p.res.max < 0.2 && ms >= 0 && L.items[ms]?.ok) return { type: 'USE_ITEM', slot: ms, target: ti };
  for (const id of p.bar) {
    if (!id || !L.spells[id]?.ok) continue;
    if (autoCond(st, id, tgt)) return { type: 'CAST', spellId: id, target: ti };
  }
  return { type: 'ATTACK', target: ti };
}

function autoCond(st, id, t) {
  const p = st.player; const n = living(st).filter((e) => !hasStatus(e, 'HEXED')).length;
  const big = t && (t.rank !== 'normal' && t.rank !== 'trash');
  const hpf = p.hp / p.maxHp; const thp = t ? t.hp / t.maxHp : 1;
  const has = (u, s) => u && hasStatus(u, s);
  switch (id) {
    case 'severing_flourish': return p.cp >= 4 || (p.cp >= 2 && thp < 0.25);
    case 'shadowstep_strike': return has(p, 'STEALTH');
    case 'throat_jab': case 'spellsnap': case 'muzzle_shot': return t && t.intent && t.intent.cast;
    case 'open_vein': return p.cp >= 4 && big && !has(t, 'BLEED');
    case 'temple_blow': return p.cp >= 1 && t && t.intent && (t.intent.cast || t.intent.heavy);
    case 'smoke_veil': return hpf < 0.5 && (n >= 2 || big);
    case 'whirling_edges': return n >= 2;
    case 'expose_weakness': return p.cp >= 4 && big && !has(t, 'EXPOSED');
    case 'adrenal_surge': return p.res.cur < 40;
    case 'vanishing_step': case 'glacial_tomb': case 'feign_stillness': return hpf < 0.3;
    case 'final_reckoning': return thp < 0.35 && p.cp >= 3;
    case 'frost_lance': return !has(t, 'CHILLED');
    case 'arcane_ward': return !has(p, 'WARD');
    case 'rime_burst': return n >= 2 || hpf < 0.5;
    case 'living_flame': return thp >= 0.6 && !has(t, 'BURN');
    case 'hexbind': return n >= 2;
    case 'cinder_storm': case 'volley_rain': return n >= 3;
    case 'mana_siphon': return p.res.cur / p.res.max < 0.3;
    case 'barbed_arrow': return thp >= 0.6 && !has(t, 'BLEED');
    case 'mark_prey': return big && !has(t, 'MARKED');
    case 'mend_companion': return p.pet && (!p.pet.alive || p.pet.hp / p.pet.maxHp < 0.45);
    case 'snare_trap': return n >= 2 || hpf < 0.4;
    case 'field_dressing': return hpf < 0.5;
    case 'savage_order': return p.pet && p.pet.alive;
    case 'rapid_volley': return big;
    case 'ricochet_bolt': return n >= 2;
    default: return true;
  }
}

/** Numbers for spell tooltips (the mock knows its own formulas). */
export function describeSpell(st, id) {
  const p = st.player; const s = D.SPELLS[id];
  if (!s || !p) return null;
  const out = { cost: s.cost ? (s.cost[0] === 'M' ? `${spellCost(p, s)} mana` : `${spellCost(p, s)} ${s.cost[0] === 'E' ? 'energy' : 'focus'}`) : 'No cost', cd: s.cd ? `${s.cd} round cooldown` : null, lines: [] };
  const k = knownSpell(p, id);
  if (s.fx.dmg) {
    const base = spellDamageBase(p, id) * playerDamageMods(st);
    const lo = Math.round(base * 0.9); const hi = Math.round(base * 1.1);
    const per = s.fx.fin ? ' per combo point' : '';
    out.lines.push(`${s.fx.aoe ? 'Hits all enemies for' : 'Deals'} ${lo}–${hi} ${schoolName(s.fx.dmg[0])} damage${per}${s.fx.hits ? ` × ${s.fx.hits}` : ''}.`);
  }
  if (s.fx.dot) { const [, rounds, b, l, pw] = s.fx.dot; const tl = k?.tl || p.level; out.lines.push(`${Math.round(b + l * tl + pw * p.stats.power)} damage per round for ${rounds} rounds${s.fx.fin ? ', per combo point' : ''}.`); }
  if (s.fx.ward) { const [b, l, pw] = s.fx.ward; const tl = k?.tl || p.level; out.lines.push(`Absorbs ${Math.round(b + l * tl + pw * p.stats.power)} damage.`); }
  out.rank = k ? `Rank ${k.rank}` : null;
  out.trained = k ? (k.tl < p.level ? `Trained to level ${k.tl}. A trainer can raise it to ${p.level}.` : null) : null;
  return out;
}
const schoolName = (s) => ({ phys: 'physical', fire: 'fire', frost: 'frost', arcane: 'arcane', shadow: 'shadow', nature: 'nature' }[s] || s);

export const data = {
  classes: D.CLASSES, spells: D.SPELLS, talents: D.TALENTS, pets: D.PETS, consumables: D.CONSUMABLES,
  statuses: D.STATUS_INFO, boons: D.BOONS, slots: D.SLOTS, slotNames: D.SLOT_NAME, zones: D.ZONES, camp: D.CAMP, boss: D.BOSS,
  nodeHours: { ...C.HOURS },
  constants: { ...C, xpToNext },
};
export { itemScore };
