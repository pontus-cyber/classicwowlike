// Action table: legality checks, enumeration (legalActions) and application (step). docs/specs/engine-api.md.
import {
  CLASS, CLASS_IDS, PET, SPELL, TALENT, TALENT_TIER_GATE, SPELL_BAR_SLOTS, ITEM_BAR_SLOTS, CONSUMABLE, OATH_IDS,
  GRIND_MAX_WAVES, SLOT_IDS,
} from '../constants.js';
import { normaliseSeed } from '../rng.js';
import { refreshDerived } from './stats.js';
import { talentPointsFree } from './progress.js';
import { addToBag, canAdd, bagIndex, countConsumable } from './items.js';
import { nextLanes } from './map.js';
import { castError, itemUsableInCombat } from './spells.js';
import { resolveRound } from './combat.js';
import {
  availablePets, startRun, canTravel, travelOn, openService, leaveService, chooseNode, startGrind, nextFight,
  completeNode, chooseReward, campGrind, fightBoss, finishFight, trainerSpells, learnCost, trainCost,
  respecCost, learnSpell, trainSpell, trainAll, trainable, respec, buy, sell, sellJunk, useItemOutOfCombat,
  clampAfterStatChange,
} from './nodes.js';
import { summary } from './summary.js';
import { applyRunToProfile } from './meta.js';

const OOC = new Set(['EQUIP', 'UNEQUIP', 'DISCARD', 'USE_ITEM', 'SET_BAR', 'SET_ITEM_BAR', 'SPEND_TALENT']);
const LOOT_OK = new Set(['LOOT_TAKE', 'LOOT_DROP', 'SET_AUTOPLAY', ...OOC]);
const COMBAT = new Set(['CAST', 'ATTACK', 'USE_ITEM', 'FLEE', 'PASS']);
export const NAME_MAX = 24;

const oocAllowed = (s) => !s.fight && ['ZONE_HUB', 'MAP', 'NODE', 'CAMP'].includes(s.phase);
const lootOpen = (s) => !!(s.loot && s.loot.length);
const svc = (s, kind) => (s.service && s.service.kind === kind ? null : `no ${kind} is open`);
const isInt = (x) => Number.isInteger(x);

function findGear(s, uid) {
  const i = bagIndex(s, uid);
  if (i >= 0) return { item: s.player.bag[i], where: 'bag', i };
  const j = s.loot.findIndex((x) => x.uid === uid);
  if (j >= 0) return { item: s.loot[j], where: 'loot', i: j };
  return null;
}

function treeSpent(s, tree) {
  let n = 0;
  for (const [id, r] of Object.entries(s.player.talents)) if (TALENT[id].tree === tree) n += r;
  return n;
}

const A = {
  // ---------------- CREATE ----------------
  SELECT_CLASS: {
    check: (s, a) => (s.phase !== 'CREATE' ? 'only during CREATE' : !CLASS[a.classId] ? `unknown class ${a.classId}` : null),
    apply: (s, ev, a) => {
      s.create.classId = a.classId;
      if (a.classId !== 'hunter') s.create.petId = null;
      ev.push({ t: 'create', classId: a.classId });
    },
  },
  SELECT_PET: {
    check: (s, a) => (s.phase !== 'CREATE' ? 'only during CREATE' : s.create.classId !== 'hunter' ? 'only a Hunter picks a pet'
      : !availablePets(s.profile).includes(a.petId) ? `pet ${a.petId} is not available` : null),
    apply: (s, ev, a) => { s.create.petId = a.petId; ev.push({ t: 'create', petId: a.petId }); },
  },
  SET_NAME: {
    check: (s, a) => (s.phase !== 'CREATE' ? 'only during CREATE' : typeof a.name !== 'string' || !a.name.trim() || a.name.trim().length > NAME_MAX ? `name must be 1-${NAME_MAX} characters` : null),
    apply: (s, ev, a) => { s.create.name = a.name.trim(); },
  },
  SET_SEED: {
    check: (s, a) => (s.phase !== 'CREATE' ? 'only during CREATE' : !isInt(a.seed) ? 'seed must be an integer (the front end draws a random one)' : null),
    apply: (s, ev, a) => { s.create.seed = normaliseSeed(a.seed); },
  },
  SET_OATH: {
    check: (s, a) => (s.phase !== 'CREATE' ? 'only during CREATE' : !((s.profile.unlocks || {}).oaths > 0) ? 'Oaths are not unlocked'
      : !OATH_IDS.includes(a.oath) ? `unknown oath ${a.oath}` : typeof a.on !== 'boolean' ? 'on must be true or false' : null),
    apply: (s, ev, a) => {
      s.create.oaths = s.create.oaths.filter((o) => o !== a.oath);
      if (a.on) s.create.oaths.push(a.oath);
      s.create.oaths.sort();
    },
  },
  START_RUN: {
    check: (s) => (s.phase !== 'CREATE' ? 'only during CREATE' : !s.create.classId ? 'select a class first'
      : s.create.classId === 'hunter' && !s.create.petId ? 'a Hunter needs a pet' : null),
    apply: (s, ev) => startRun(s, ev),
  },
  SET_AUTOPLAY: {
    check: (s, a) => (typeof a.on !== 'boolean' ? 'on must be true or false' : null),
    apply: (s, ev, a) => { s.autoplay = a.on; ev.push({ t: 'autoplay', on: a.on }); },
  },
  // ---------------- Hub, camp, services ----------------
  SERVICE: {
    check: (s, a) => (!['ZONE_HUB', 'CAMP'].includes(s.phase) || s.fight ? 'services are in the hub or camp' : s.service ? 'a service is already open'
      : !['trainer', 'vendor', 'inn'].includes(a.service) ? `unknown service ${a.service}` : s.hub.used[a.service] ? `${a.service} already used this visit` : null),
    apply: (s, ev, a) => openService(s, ev, a.service),
  },
  LEAVE: {
    check: (s) => (!s.service ? 'no service is open' : null),
    apply: (s, ev) => leaveService(s, ev),
  },
  LEAVE_HUB: {
    check: (s) => (s.phase !== 'ZONE_HUB' ? 'only in a zone hub' : s.service ? 'close the service first (LEAVE)' : null),
    apply: (s, ev) => { s.phase = 'MAP'; ev.push({ t: 'phase', phase: 'MAP' }); },
  },
  LEARN: {
    check: (s, a) => {
      const e = svc(s, 'trainer');
      if (e) return e;
      const sp = SPELL[a.spellId];
      if (!sp || !trainerSpells(s).includes(a.spellId)) return `${a.spellId} is not taught here`;
      if (s.player.spells[a.spellId]) return `${a.spellId} is already known`;
      if (sp.lvl > s.player.level) return `${a.spellId} needs level ${sp.lvl}`;
      if (s.player.gold < learnCost(s, a.spellId)) return 'not enough gold';
      return null;
    },
    apply: (s, ev, a) => learnSpell(s, ev, a.spellId),
  },
  TRAIN: {
    check: (s, a) => {
      const e = svc(s, 'trainer');
      if (e) return e;
      const k = s.player.spells[a.spellId];
      if (!k || SPELL[a.spellId].source === 'talent') return `${a.spellId} is not a trainable known spell`;
      if (k.tl >= s.player.level) return `${a.spellId} is already trained to your level`;
      if (s.player.gold < trainCost(s)) return 'not enough gold';
      return null;
    },
    apply: (s, ev, a) => trainSpell(s, ev, a.spellId),
  },
  TRAIN_ALL: {
    check: (s) => svc(s, 'trainer') || (trainable(s).length === 0 ? 'nothing to train' : s.player.gold < trainCost(s) ? 'not enough gold' : null),
    apply: (s, ev) => trainAll(s, ev),
  },
  RESPEC: {
    check: (s) => svc(s, 'trainer') || (s.player.talentSpent === 0 ? 'no talent points spent' : s.player.gold < respecCost(s) ? 'not enough gold' : null),
    apply: (s, ev) => respec(s, ev),
  },
  BUY: {
    check: (s, a) => {
      const e = svc(s, 'vendor');
      if (e) return e;
      const it = s.service.stock[a.index];
      if (!isInt(a.index) || !it) return 'no such stock entry';
      if (it.sold) return 'already sold';
      if (s.player.gold < it.price) return 'not enough gold';
      const probe = it.kind === 'cons' ? { kind: 'cons', id: it.id, qty: 1 } : it.item;
      if (!canAdd(s, probe)) return it.kind === 'cons' && CONSUMABLE[it.id].max !== undefined && countConsumable(s, it.id) >= CONSUMABLE[it.id].max ? `you can carry at most ${CONSUMABLE[it.id].max}` : 'bag is full';
      return null;
    },
    apply: (s, ev, a) => buy(s, ev, a.index),
  },
  SELL: {
    check: (s, a) => svc(s, 'vendor') || (bagIndex(s, a.itemId) < 0 ? 'item not in bag' : null),
    apply: (s, ev, a) => sell(s, ev, a.itemId),
  },
  SELL_JUNK: {
    check: (s) => svc(s, 'vendor') || (!s.player.bag.some((x) => x.kind === 'junk') ? 'no junk to sell' : null),
    apply: (s, ev) => sellJunk(s, ev),
  },
  // ---------------- Map ----------------
  CHOOSE_NODE: {
    check: (s, a) => (s.phase !== 'MAP' || s.node ? 'only on the map' : !nextLanes(s.zone).includes(a.lane) ? `lane ${a.lane} is not reachable` : null),
    apply: (s, ev, a) => chooseNode(s, ev, a.lane),
  },
  TRAVEL_ON: {
    check: (s) => (s.phase !== 'MAP' ? 'only on the map' : !canTravel(s) ? 'reach the exit level or finish row 8 first' : null),
    apply: (s, ev) => travelOn(s, ev),
  },
  // ---------------- Node ----------------
  GRIND_SET_WAVES: {
    check: (s, a) => (!s.node || s.node.type !== 'grind' || s.node.stage !== 'grindSetup' ? 'only when entering a Grind'
      : !isInt(a.n) || a.n < 1 || a.n > GRIND_MAX_WAVES ? `waves must be 1-${GRIND_MAX_WAVES}` : null),
    apply: (s, ev, a) => startGrind(s, ev, a.n),
  },
  NEXT_FIGHT: {
    check: (s) => (!s.node || s.node.stage !== 'between' ? 'only between fights of a Grind or Dungeon' : null),
    apply: (s, ev) => nextFight(s, ev),
  },
  GRIND_STOP: {
    check: (s) => (!s.node || s.node.type !== 'grind' || s.node.stage !== 'between' ? 'only between Grind waves' : null),
    apply: (s, ev) => completeNode(s, ev),
  },
  DUNGEON_LEAVE: {
    check: (s) => (!s.node || s.node.type !== 'dungeon' || s.node.stage !== 'between' ? 'only between Dungeon fights' : null),
    apply: (s, ev) => { ev.push({ t: 'dungeonLeft' }); completeNode(s, ev); },
  },
  CHOOSE_REWARD: {
    check: (s, a) => {
      if (!s.node || s.node.stage !== 'reward' || !s.node.rewards.length) return 'no reward to choose';
      const set = s.node.rewards[0];
      const n = set.kind === 'items' ? set.items.length : set.boons.length;
      return !isInt(a.index) || a.index < 0 || a.index >= n ? `index must be 0-${n - 1}` : null;
    },
    apply: (s, ev, a) => chooseReward(s, ev, a.index),
  },
  LOOT_TAKE: {
    check: (s, a) => {
      const it = (s.loot || []).find((x) => x.uid === a.itemId);
      return !it ? 'item not in the loot window' : !canAdd(s, it) ? 'bag is full (DISCARD or LOOT_DROP)' : null;
    },
    apply: (s, ev, a) => {
      const i = s.loot.findIndex((x) => x.uid === a.itemId);
      const it = s.loot.splice(i, 1)[0];
      addToBag(s, it);
      ev.push({ t: 'loot', item: { ...it }, to: 'bag' });
    },
  },
  LOOT_DROP: {
    check: (s, a) => (!(s.loot || []).some((x) => x.uid === a.itemId) ? 'item not in the loot window' : null),
    apply: (s, ev, a) => {
      const i = s.loot.findIndex((x) => x.uid === a.itemId);
      const it = s.loot.splice(i, 1)[0];
      ev.push({ t: 'lootDropped', item: it.uid });
    },
  },
  // ---------------- Camp ----------------
  CAMP_GRIND: {
    check: (s) => (s.phase !== 'CAMP' || s.fight ? 'only in the Camp' : s.service ? 'close the service first (LEAVE)' : null),
    apply: (s, ev) => campGrind(s, ev),
  },
  FIGHT_BOSS: {
    check: (s) => (s.phase !== 'CAMP' || s.fight ? 'only in the Camp' : s.service ? 'close the service first (LEAVE)' : null),
    apply: (s, ev) => fightBoss(s, ev),
  },
  END_RUN: {
    check: (s) => (s.phase !== 'SUMMARY' ? 'only in SUMMARY' : null),
    apply: (s, ev) => {
      const sum = summary(s);
      s.result = { summary: sum, echoes: sum.echoes.total, profile: applyRunToProfile(s.profile, sum) };
      s.phase = 'ENDED';
      ev.push({ t: 'phase', phase: 'ENDED' }, { t: 'echoes', total: sum.echoes.total });
    },
  },
  // ---------------- Out of combat ----------------
  EQUIP: {
    check: (s, a) => {
      if (!oocAllowed(s)) return 'not during a fight';
      const g = findGear(s, a.itemId);
      return !g ? 'item not in bag or loot window' : g.item.kind !== 'gear' ? 'not equipment' : null;
    },
    apply: (s, ev, a) => {
      const p = s.player;
      const g = findGear(s, a.itemId);
      const old = p.equipped[g.item.slot];
      p.equipped[g.item.slot] = g.item;
      if (g.where === 'bag') {
        if (old) p.bag[g.i] = old; else p.bag.splice(g.i, 1);
      } else {
        s.loot.splice(g.i, 1);
        if (old && !addToBag(s, old)) s.loot.push(old);
      }
      refreshDerived(s);
      clampAfterStatChange(s);
      ev.push({ t: 'equip', item: g.item.uid, slot: g.item.slot, old: old ? old.uid : null });
    },
  },
  UNEQUIP: {
    check: (s, a) => (!oocAllowed(s) ? 'not during a fight' : !SLOT_IDS.includes(a.slot) || !s.player.equipped[a.slot] ? 'nothing equipped there'
      : !canAdd(s, s.player.equipped[a.slot]) ? 'bag is full' : null),
    apply: (s, ev, a) => {
      const it = s.player.equipped[a.slot];
      s.player.equipped[a.slot] = null;
      addToBag(s, it);
      refreshDerived(s);
      clampAfterStatChange(s);
      ev.push({ t: 'unequip', slot: a.slot, item: it.uid });
    },
  },
  DISCARD: {
    check: (s, a) => (!oocAllowed(s) ? 'not during a fight' : bagIndex(s, a.itemId) < 0 ? 'item not in bag' : null),
    apply: (s, ev, a) => {
      const i = bagIndex(s, a.itemId);
      s.player.bag.splice(i, 1);
      ev.push({ t: 'discard', item: a.itemId });
    },
  },
  SET_BAR: {
    check: (s, a) => (!oocAllowed(s) ? 'bar edits are out of combat only' : !isInt(a.slot) || a.slot < 0 || a.slot >= SPELL_BAR_SLOTS ? `slot must be 0-${SPELL_BAR_SLOTS - 1}`
      : a.spellId !== null && !s.player.spells[a.spellId] ? `${a.spellId} is not known` : null),
    apply: (s, ev, a) => {
      const bar = s.player.bar;
      const j = a.spellId === null ? -1 : bar.indexOf(a.spellId);
      if (j >= 0) bar[j] = bar[a.slot];
      bar[a.slot] = a.spellId;
      ev.push({ t: 'bar', bar: bar.slice() });
    },
  },
  SET_ITEM_BAR: {
    check: (s, a) => {
      if (!oocAllowed(s)) return 'bar edits are out of combat only';
      if (!isInt(a.slot) || a.slot < 0 || a.slot >= ITEM_BAR_SLOTS) return `slot must be 0-${ITEM_BAR_SLOTS - 1}`;
      if (a.itemId === null) return null;
      const c = CONSUMABLE[a.itemId];
      return !c || !(c.use === 'any' || c.use === 'combat') ? `${a.itemId} cannot be used in combat` : null;
    },
    apply: (s, ev, a) => {
      const bar = s.player.itemBar;
      const j = a.itemId === null ? -1 : bar.indexOf(a.itemId);
      if (j >= 0) bar[j] = bar[a.slot];
      bar[a.slot] = a.itemId;
      ev.push({ t: 'itemBar', bar: bar.slice() });
    },
  },
  SPEND_TALENT: {
    check: (s, a) => {
      if (!oocAllowed(s)) return 'talents are spent out of combat';
      const t = TALENT[a.talentId];
      if (!t || t.cls !== s.player.classId) return `unknown talent ${a.talentId}`;
      if ((s.player.talents[a.talentId] || 0) >= t.ranks) return `${a.talentId} is at max rank`;
      if (talentPointsFree(s) < 1) return 'no free talent points';
      if (treeSpent(s, t.tree) < TALENT_TIER_GATE * (t.tier - 1)) return `tier ${t.tier} needs ${TALENT_TIER_GATE * (t.tier - 1)} points in ${CLASS[t.cls].trees[t.tree]}`;
      return null;
    },
    apply: (s, ev, a) => {
      const p = s.player;
      const t = TALENT[a.talentId];
      p.talents[a.talentId] = (p.talents[a.talentId] || 0) + 1;
      p.talentSpent += 1;
      s.stats.talentPoints += 1;
      if (t.spell && !p.spells[t.spell]) {
        p.spells[t.spell] = { tl: p.level, rank: 1 };
        p.spellOrder.push(t.spell);
        const i = p.bar.indexOf(null);
        if (i >= 0) p.bar[i] = t.spell;
      }
      refreshDerived(s);
      clampAfterStatChange(s);
      ev.push({ t: 'talent', id: a.talentId, rank: p.talents[a.talentId] });
    },
  },
  // ---------------- Combat (and USE_ITEM out of combat) ----------------
  USE_ITEM: {
    check: (s, a) => {
      if (s.fight) {
        const e = combatGate(s, a);
        if (e) return e;
        if (!isInt(a.slot) || a.slot < 0 || a.slot >= ITEM_BAR_SLOTS) return `slot must be 0-${ITEM_BAR_SLOTS - 1}`;
        const id = s.player.itemBar[a.slot];
        return !id ? 'item bar slot is empty' : !itemUsableInCombat(s, id) ? `${id} cannot be used now` : null;
      }
      if (!oocAllowed(s)) return 'not now';
      const c = CONSUMABLE[a.itemId];
      if (!c || !(c.use === 'any' || c.use === 'out')) return `${a.itemId} cannot be used out of combat`;
      if (countConsumable(s, a.itemId) < 1) return `no ${a.itemId} in the bag`;
      if (c.mana && !s.player.d.maxMana) return 'no mana to restore';
      return null;
    },
    apply: (s, ev, a) => (s.fight ? combat(s, ev, a) : useItemOutOfCombat(s, ev, a.itemId)),
  },
  CAST: {
    check: (s, a) => combatGate(s, a) || (!s.player.bar.includes(a.spellId) ? `${a.spellId} is not on the action bar` : castError(s, a.spellId, a.target)),
    apply: (s, ev, a) => combat(s, ev, a),
  },
  ATTACK: {
    check: (s, a) => combatGate(s, a) || (!isInt(a.target) || !s.fight.enemies[a.target] || !s.fight.enemies[a.target].alive ? 'target must be a living enemy' : null),
    apply: (s, ev, a) => combat(s, ev, a),
  },
  FLEE: {
    check: (s, a) => combatGate(s, a) || (!s.fight.canFlee ? 'cannot flee from this fight' : null),
    apply: (s, ev, a) => combat(s, ev, a),
  },
  PASS: {
    check: (s) => (!s.fight ? 'PASS is a combat action' : null),
    apply: (s, ev, a) => combat(s, ev, a),
  },
};

function combatGate(s, a) {
  if (!s.fight) return 'not in a fight';
  if (s.fight.p.skip && a.type !== 'PASS') return 'your action is skipped this round (PASS)';
  return null;
}

function combat(s, ev, a) {
  resolveRound(s, ev, a);
  if (s.fight && s.fight.over) finishFight(s, ev);
}

/** Why an action is illegal in this state, or null when it is legal. Never throws, never mutates. */
export function checkAction(s, a) {
  if (!a || typeof a !== 'object' || typeof a.type !== 'string') return 'an action is an object with a string "type"';
  const def = A[a.type];
  if (!def) return `unknown action type "${a.type}"`;
  if (s.phase === 'ENDED') return 'the run has ended';
  if (s.fight && !COMBAT.has(a.type) && a.type !== 'SET_AUTOPLAY') return `${a.type} is not allowed during a fight`;
  if (!s.fight && lootOpen(s) && !LOOT_OK.has(a.type)) return 'resolve the loot window first (LOOT_TAKE, LOOT_DROP, DISCARD or EQUIP)';
  if (OOC.has(a.type) && a.type !== 'USE_ITEM' && !oocAllowed(s)) return `${a.type} is only allowed out of combat`;
  return def.check(s, a) || null;
}

export function applyAction(s, ev, a) {
  A[a.type].apply(s, ev, a);
}

/** Every concrete legal action. SET_NAME and SET_SEED take free values and are not listed. */
export function legalActions(s) {
  const out = [];
  const push = (a) => { if (!checkAction(s, a)) out.push(a); };
  if (s.phase === 'ENDED') return out;
  if (s.phase === 'CREATE') {
    for (const c of CLASS_IDS) push({ type: 'SELECT_CLASS', classId: c });
    if (s.create.classId === 'hunter') for (const p of Object.keys(PET)) push({ type: 'SELECT_PET', petId: p });
    for (const o of OATH_IDS) push({ type: 'SET_OATH', oath: o, on: !s.create.oaths.includes(o) });
    push({ type: 'START_RUN' });
  } else if (s.phase === 'SUMMARY') {
    push({ type: 'END_RUN' });
  } else if (s.fight) {
    const f = s.fight;
    const p = s.player;
    push({ type: 'PASS' });
    for (const e of f.enemies) if (e.alive) push({ type: 'ATTACK', target: e.idx });
    for (const id of p.bar) {
      if (!id) continue;
      if (SPELL[id].target === 'enemy') for (const e of f.enemies) { if (e.alive) push({ type: 'CAST', spellId: id, target: e.idx }); }
      else push({ type: 'CAST', spellId: id, target: null });
    }
    for (let i = 0; i < ITEM_BAR_SLOTS; i++) push({ type: 'USE_ITEM', slot: i, target: null });
    push({ type: 'FLEE' });
  } else {
    const p = s.player;
    for (const it of s.loot) { push({ type: 'LOOT_TAKE', itemId: it.uid }); push({ type: 'LOOT_DROP', itemId: it.uid }); push({ type: 'EQUIP', itemId: it.uid }); }
    if (s.service) {
      push({ type: 'LEAVE' });
      if (s.service.kind === 'trainer') {
        for (const id of trainerSpells(s)) { push({ type: 'LEARN', spellId: id }); push({ type: 'TRAIN', spellId: id }); }
        push({ type: 'TRAIN_ALL' });
        push({ type: 'RESPEC' });
      } else {
        s.service.stock.forEach((_, i) => push({ type: 'BUY', index: i }));
        for (const it of p.bag) push({ type: 'SELL', itemId: it.uid });
        push({ type: 'SELL_JUNK' });
      }
    }
    if (s.phase === 'ZONE_HUB' || s.phase === 'CAMP') {
      for (const sv of ['trainer', 'vendor', 'inn']) push({ type: 'SERVICE', service: sv });
      push({ type: 'LEAVE_HUB' });
      push({ type: 'CAMP_GRIND' });
      push({ type: 'FIGHT_BOSS' });
    }
    if (s.phase === 'MAP') {
      for (const l of nextLanes(s.zone)) push({ type: 'CHOOSE_NODE', lane: l });
      push({ type: 'TRAVEL_ON' });
    }
    if (s.phase === 'NODE' && s.node) {
      for (let n = 1; n <= GRIND_MAX_WAVES; n++) push({ type: 'GRIND_SET_WAVES', n });
      push({ type: 'NEXT_FIGHT' });
      push({ type: 'GRIND_STOP' });
      push({ type: 'DUNGEON_LEAVE' });
      if (s.node.rewards && s.node.rewards.length) {
        const set = s.node.rewards[0];
        const n = set.kind === 'items' ? set.items.length : set.boons.length;
        for (let i = 0; i < n; i++) push({ type: 'CHOOSE_REWARD', index: i });
      }
    }
    // Out-of-combat actions
    for (const it of p.bag) {
      if (it.kind === 'gear') push({ type: 'EQUIP', itemId: it.uid });
      push({ type: 'DISCARD', itemId: it.uid });
    }
    for (const slot of SLOT_IDS) if (p.equipped[slot]) push({ type: 'UNEQUIP', slot });
    const consIds = [...new Set(p.bag.filter((x) => x.kind === 'cons').map((x) => x.id))];
    for (const id of consIds) push({ type: 'USE_ITEM', itemId: id });
    const known = p.spellOrder.filter((id) => p.spells[id]);
    for (let i = 0; i < SPELL_BAR_SLOTS; i++) {
      if (p.bar[i] !== null) push({ type: 'SET_BAR', slot: i, spellId: null });
      for (const id of known) if (p.bar[i] !== id) push({ type: 'SET_BAR', slot: i, spellId: id });
    }
    const combatItems = Object.keys(CONSUMABLE).filter((id) => CONSUMABLE[id].use === 'any' || CONSUMABLE[id].use === 'combat');
    for (let i = 0; i < ITEM_BAR_SLOTS; i++) {
      if (p.itemBar[i] !== null) push({ type: 'SET_ITEM_BAR', slot: i, itemId: null });
      for (const id of combatItems) if (p.itemBar[i] !== id) push({ type: 'SET_ITEM_BAR', slot: i, itemId: id });
    }
    for (const id of Object.keys(TALENT)) if (TALENT[id].cls === p.classId) push({ type: 'SPEND_TALENT', talentId: id });
  }
  push({ type: 'SET_AUTOPLAY', on: !s.autoplay });
  return out;
}
