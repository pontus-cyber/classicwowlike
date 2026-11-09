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
//              boons: [{ id, name, nodesLeft }], resurrect: [source], pet: { id, name, hp, maxHp, alive, statuses } | null }
//   zone:    { idx, id, name, hubName, hubText, theme, band, exitLevel, blurb, rows: node[8][3], pos: { row, lane }, path, questsDone, storyDone }
//   hub:     { used: { trainer, vendor, inn } }
//   node:    { type, step, cl, row, lane, ... }  step: intro|combat|reward|story|between|chest|rest|vendor|trainer|shrine
//   combat:  { round, enemies: [{ idx, uid, name, level, rank, arch, hp, maxHp, statuses, alive, intent }], target,
//              cooldowns: { spellId: roundsLeft }, potionCd, kind, isBoss, boss: { phase, asc, telegraph }, over, title, fightNo, fights }
//   loot:    { kind: 'loot'|'reward'|'story', title, text?, gold, xp, items?, choices? }
//   summary: run summary (rules.md 9)
//   legal:   { lanes, travelOn, mustTravel, outOfCombat, spells: { id: { ok, reason, cd } }, items: [{ ok, reason, count, cd }],
//              attack, flee, fleeChance?, services, talents, trainer }
// Events: { t: 'damage'|'heal'|'action'|'status'|'death'|'interrupt'|'skip'|'xp'|'levelUp'|'victory'|'flee'|'resurrect'|'bossPhase'|'summon'|... }

import * as R from '../rules.js';
import { CONTENT } from '../content/index.js';
import * as mock from './mock-engine.js';
import * as TXT from './ui-text.js';

const params = (() => {
  try { return new URLSearchParams(globalThis.location ? globalThis.location.search : ''); } catch { return new URLSearchParams(''); }
})();

// ====================================================================================== mock
function mockBackend(seed) {
  let state = mock.createState({ seed });
  return {
    mode: 'mock', data: mock.data, canDebug: true,
    view() { return { ...state, legal: state.player ? mock.legalInfo(state) : { lanes: [], services: {}, items: [], spells: {} }, mode: 'mock' }; },
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
const USE_MAP = { any: 'both', both: 'both', out: 'out', combat: 'combat', passive: 'passive' };
const hash = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const reasonOf = (err) => { const m = String((err && err.message) || err || ''); const i = m.lastIndexOf(': '); return cap(i >= 0 ? m.slice(i + 2) : m); };

function loadProfile() {
  try { const raw = globalThis.localStorage && localStorage.getItem(PROFILE_KEY); if (raw) return JSON.parse(raw); } catch { /* storage blocked */ }
  return null;
}
function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* ignore */ } }
const randomSeed = () => Math.floor(Math.random() * 0xffffffff) >>> 0;

function engineBackend(seedOpt) {
  const C = R.C;
  let profile = loadProfile();
  const mkRun = (seed) => {
    try { return R.newRun({ classId: 'rogue', seed, content: CONTENT, profile: profile || undefined }); } catch (e) {
      profile = null; return R.newRun({ classId: 'rogue', seed, content: CONTENT });
    }
  };
  let st = mkRun(seedOpt ?? randomSeed());
  const local = { introSeen: new Set(), spoils: null, hold: null, reward: null, fightNo: 0 };

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
      cost: s.cost ? [RES_LETTER[C.CLASS[s.cls].resource], s.cost] : null, text: TXT.spellText(s.id, CONTENT),
      fx: { meta: s.source === 'meta', talent: s.source === 'talent' },
    }])),
    talents: Object.fromEntries(Object.values(C.TALENT).map((t) => [t.id, { id: t.id, tree: treeId(t.cls, t.tree), tier: t.tier, name: t.name, ranks: t.ranks, spell: t.spell || null, text: TXT.talentText(t.id, CONTENT) }])),
    pets: Object.fromEntries(Object.values(C.PET).map((p) => [p.id, { id: p.id, name: p.name, text: TXT.petText(p.id, CONTENT), locked: !!p.meta && !(profile && profile.unlocks && profile.unlocks[p.meta]) }])),
    consumables: Object.fromEntries(Object.values(C.CONSUMABLE).map((c) => [c.id, { id: c.id, name: c.name, use: USE_MAP[c.use] || 'both', stack: c.stack, text: TXT.consumableText(c.id, CONTENT) }])),
    statuses: TXT.STATUS_INFO,
    boons: Object.fromEntries(Object.values(C.BOON).map((b) => [b.id, { id: b.id, name: b.name, text: TXT.boonText(b.id, CONTENT) }])),
    slots: C.SLOT_IDS, zones: CONTENT.zones, camp: CONTENT.camp,
    boss: { name: C.BOSS_TEXT.name, intro: (CONTENT.camp && CONTENT.camp.bossText) || '' },
  };
  const spellName = (id) => (C.SPELL[id] ? C.SPELL[id].name : id === 'pet' ? 'Pet' : TXT.humanize(id));

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
  const capacity = () => 16 + 4 * ((profile && profile.unlocks && profile.unlocks.pockets) || 0);

  function convPlayer(s) {
    const p = s.player; const d = p.d; const f = s.fight; const cls = C.CLASS[p.classId];
    const kind = cls.resource;
    const res = kind === 'mana' ? { kind, cur: p.mana, max: d.maxMana } : { kind, cur: f ? f.p[kind] : 100, max: f ? f.p[`${kind}Max`] : 100 };
    const spent = {};
    for (const [id, r] of Object.entries(p.talents || {})) { const t = C.TALENT[id]; if (t) { const k = treeId(t.cls, t.tree); spent[k] = (spent[k] || 0) + r; } }
    const bag = (p.bag || []).map((it) => item(it, p.classId));
    while (bag.length < capacity()) bag.push(null);
    const boons = Object.entries(p.buffs || {}).filter(([, b]) => b && b.left > 0).map(([id, b]) => ({ id, name: id === 'elixir' ? 'Elixir of Ferocity' : (C.BOON[id] || {}).name || id, nodesLeft: b.left }));
    const resurrect = [];
    for (let i = 0; i < ((p.res && p.res.boon) || 0); i++) resurrect.push('boon');
    for (let i = 0; i < ((p.res && p.res.meta) || 0); i++) resurrect.push('meta');
    for (const it of p.bag || []) if (it.kind === 'cons' && it.id === 'ember_of_return') resurrect.push('ember');
    return {
      name: p.name, classId: p.classId, className: cls.name, petId: p.pet ? p.pet.id : null,
      level: p.level, xp: p.xp, xpToNext: R.xpToNext(p.level), rested: p.rested || 0, hp: p.hp, maxHp: d.maxHp,
      res, cp: f ? f.p.cp || 0 : 0, cpMax: 5,
      stats: { sta: d.STA, agi: d.AGI, int: d.INT, spi: d.SPI, power: Math.round(d.power), crit: d.crit, critMult: d.critMult, dodge: d.dodge, armor: Math.round(d.armor), wd: d.wd },
      gold: p.gold, equip: Object.fromEntries(Object.entries(p.equipped).map(([k, it]) => [k, item(it, p.classId)])), bag,
      spells: (p.spellOrder || Object.keys(p.spells)).map((id) => ({ id, tl: p.spells[id].tl, rank: p.spells[id].rank })),
      bar: [...p.bar], itemBar: [...p.itemBar], talents: { ...p.talents }, talentPoints: R.talentPointsFree(s), talentSpent: spent,
      statuses: f ? statuses(f.p.st) : [], boons, resurrect,
      pet: p.pet ? { id: p.pet.id, name: C.PET[p.pet.id].name, hp: p.pet.hp, maxHp: d.petMaxHp, alive: p.pet.alive, statuses: f && f.pet ? statuses(f.pet.st) : [] } : null,
    };
  }

  function zoneContent(z) { return z >= 1 && z <= 6 ? CONTENT.zones[z - 1] : null; }
  function convZone(s) {
    const z = s.zone ? s.zone.z : 1;
    if (z > 6 || (s.zone && s.zone.camp)) {
      const camp = CONTENT.camp || {};
      return { idx: 7, id: 'camp', name: camp.name || 'Observatory Steps', hubName: camp.name || 'Observatory Steps', hubText: camp.text, blurb: camp.text, theme: 'observatory', band: [60, 60], exitLevel: 60, rows: [], pos: { row: 0, lane: null }, path: [], questsDone: 0, storyDone: false };
    }
    const zc = zoneContent(z);
    const mv = R.mapView(s);
    const rows = mv ? mv.rows.map((row) => row.map((n) => {
      const out = { row: n.r, lane: n.l, type: n.type, cl: n.cl, visited: !!n.done, title: n.title, level: n.level };
      if (n.archetypes) out.enemyNames = [...new Set(n.archetypes.map(TXT.humanize))];
      if (n.type === 'elite') { out.eliteName = n.name || null; out.rare = n.rare; }
      if (n.type === 'dungeon') { out.dungeon = n.name; out.bossName = zc && CONTENT.enemies[zc.dungeon.boss] ? CONTENT.enemies[zc.dungeon.boss].name : ''; }
      if (n.type === 'quest' && n.title) { const q = Object.values(CONTENT.quests).find((x) => x.title === n.title); if (q) out.giver = q.giver; }
      return out;
    })) : [];
    const path = (s.zone.path || []).map((lane, i) => ({ row: i + 1, lane }));
    return { idx: z, id: `z${z}`, name: zc ? zc.name : `Zone ${z}`, hubName: zc ? zc.hubName : 'Hub', hubText: zc ? zc.hubText : '', blurb: zc ? zc.theme : '',
      theme: THEMES[z - 1] || 'farmland', band: [10 * (z - 1) + 1, 10 * z], exitLevel: 10 * z, rows,
      pos: { row: s.zone.pos.r, lane: s.zone.pos.l }, path, questsDone: s.zone.questsDone || 0, storyDone: !!s.zone.storyDone, next: mv ? mv.next : [] };
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
    if (n && n.type === 'dungeon') { fights = 4; title = (zoneContent(s.zone.z) || { dungeon: { name: 'Dungeon' } }).dungeon.name; }
    if (n && n.type === 'grind') { fights = n.planned || 1; title = `Wave ${(n.wavesDone || 0) + 1} of ${n.planned}`; }
    return { round: f.round, enemies, target: f.p.target != null && enemies[f.p.target] && enemies[f.p.target].alive ? f.p.target : firstAlive ? firstAlive.idx : 0,
      cooldowns: cds, potionCd: Math.max(0, (f.p.potionReady || 0) - f.round), kind: f.kind === 'trash' ? 'dungeon' : f.kind, isBoss: f.kind === 'boss',
      boss: f.boss ? { phase: f.boss.phase, asc: f.boss.asc || 0, telegraph: bossE && bossE.intent ? bossE.intent.telegraph : null } : null,
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
    if (s.phase === 'CAMP' && s.fight) return { type: 'camp_grind', step: 'combat', cl: 58, origin: 'camp', fightNo: 1 };
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
    };
  }

  function view() {
    const s = st;
    const v = { hours: s.hours || 0, autoplay: !!s.autoplay, seed: s.create ? s.create.seed : s.seed, mode: 'engine' };
    if (s.phase === 'CREATE') {
      return { ...v, phase: 'CREATE', create: { classId: s.create.classId || 'rogue', petId: s.create.petId || 'ridgewolf', name: s.create.name || '', seed: s.create.seed }, player: null, zone: null, node: null, combat: null, loot: null, summary: null, legal: { lanes: [], services: {}, items: [], spells: {} } };
    }
    v.phase = s.phase === 'ENDED' ? 'SUMMARY' : s.phase;
    v.player = convPlayer(s);
    v.zone = convZone(s);
    v.hub = s.hub || { used: {} };
    v.node = convNode(s);
    v.combat = convFight(s);
    v.loot = null;
    v.summary = v.phase === 'SUMMARY' ? convSummary(s) : null;
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
        case 'heal': { const k = key(e.dst); const m = max.get(k) ?? Infinity; const after = Math.min(m, (hp.get(k) ?? 0) + (e.amount || 0)); hp.set(k, after); out.push({ t: 'heal', dst: ref(e.dst), amount: e.amount || 0, name: spellName(e.spell), hpAfter: after, maxHp: max.get(k) }); break; }
        case 'petRevive': hp.set('pet', e.hp); out.push({ t: 'heal', dst: ref('pet'), amount: e.hp, name: 'Revive', hpAfter: e.hp, maxHp: max.get('pet') }); break;
        case 'mana': res = Math.max(0, res + (e.amount || 0)); out.push({ t: 'resource', amount: e.amount, after: res }); break;
        case 'status': out.push({ t: 'status', dst: ref(e.u), id: e.id, op: e.on ? 'add' : 'remove', stacks: e.stacks }); break;
        case 'interrupt': out.push({ t: 'interrupt', dst: ref(e.u), name: (prevIntent(e.u) || {}).name || 'cast' }); break;
        case 'skip': out.push({ t: 'skip', src: ref(e.u), reason: 'Time stopped' }); break;
        case 'channel': out.push({ t: 'channel', src: ref(e.u), name: e.name, step: e.step }); break;
        case 'summon': hp.set(`e${e.u}`, e.hp); max.set(`e${e.u}`, e.hp); out.push({ t: 'summon', idxs: [e.u], names: [e.name] }); break;
        case 'despawn': out.push({ t: 'death', dst: ref(e.u), name: enemyName(e.u), despawn: true }); break;
        case 'linked': out.push({ t: 'linked', on: !!e.on }); break;
        case 'shield': out.push({ t: 'status', dst: ref(e.u), id: 'WARD', op: 'add' }); break;
        case 'enrage': out.push({ t: 'status', dst: ref(e.u), id: 'ENRAGED', op: 'add' }); break;
        case 'image': out.push({ t: 'damage', src: ref(e.src), dst: ref('player'), amount: 0, miss: true, name: 'Mirror image', school: 'arcane', hpAfter: hp.get('player'), maxHp: max.get('player') }); break;
        case 'phaseChange': out.push({ t: 'bossPhase', phase: e.phase, name: e.phase === 2 ? 'The Dimming' : 'Eclipse', text: e.phase === 2 ? 'Shards of dead light tear free. While they live, Oruvath is Linked.' : 'The light dies. Oruvath grows stronger every round.' }); break;
        case 'death':
          if (e.u === 'player') { out.push({ t: 'death', dst: ref('player'), name: s.player.name }); if (s.phase === 'SUMMARY' || s.phase === 'ENDED') out.push({ t: 'defeat' }); }
          else { hp.set(key(e.u), 0); out.push({ t: 'death', dst: ref(e.u), name: e.name || enemyName(e.u) }); }
          break;
        case 'resurrect': hp.set('player', s.player.hp); out.push({ t: 'resurrect', source: { boon: 'Boon of Return', second_breath: 'Second Breath', ember: 'Ember of Return' }[e.source] || 'A resurrection', hpAfter: s.player.hp, maxHp: s.player.d.maxHp }); break;
        case 'xp': if (e.amount > 0) out.push({ t: 'xp', amount: e.amount, rested: e.rested || 0, why: e.why }); break;
        case 'levelUp': out.push({ t: 'levelUp', level: e.level, talentPoint: !!e.talentPoint, newSpells: Object.values(C.SPELL).filter((sp) => sp.cls === s.player.classId && sp.source === 'class' && sp.lvl === e.level).map((sp) => sp.name), hp: s.player.hp, maxHp: s.player.d.maxHp }); break;
        case 'gold': if (e.amount > 0) out.push({ t: 'gold', amount: e.amount, why: e.why }); break;
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
        case 'buy': out.push({ t: 'buy', name: e.name || (e.item && e.item.name) || (C.CONSUMABLE[e.id] || {}).name || 'item' }); break;
        case 'sell': out.push({ t: 'sell', name: e.name || 'item', gold: e.gold || e.amount || 0 }); break;
        case 'equip': out.push({ t: 'equip', name: e.name || (e.item && e.item.name) || 'item' }); break;
        case 'talent': out.push({ t: 'talent', name: (C.TALENT[e.talentId || e.id] || {}).name || 'talent', rank: e.rank || '' }); break;
        case 'useItem': out.push({ t: 'used', name: (C.CONSUMABLE[e.id || e.itemId] || {}).name || 'item' }); break;
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
          if (st.phase === 'SUMMARY') apply({ type: 'END_RUN' }, events);
          if (st.result && st.result.profile) { profile = st.result.profile; saveProfile(profile); }
          st = mkRun(randomSeed());
          local.introSeen.clear(); local.spoils = null; local.hold = null; local.reward = null;
          return { ok: true, events: [] };
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
        phase: 'NODE', node: prev.node ? { ...prev.node, step: 'combat' } : { type: 'camp_grind', step: 'combat', cl: 58 },
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
      if (a && a.kind === 'damage') lines.push(`${sp.tags && sp.tags.includes('aoe') ? 'Hits every enemy for' : 'Deals'} about ${a.amount} ${school(a.school)} damage${a.perCp ? ' per combo point' : ''}${a.hits > 1 ? `, ${a.hits} times` : ''}.`);
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
