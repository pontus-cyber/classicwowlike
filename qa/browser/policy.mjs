// qa/browser/policy.mjs - a "sensible player" policy for QA playtests (M1 1.5).
//
// One function, playerAction(state, opts), returns the next engine action a careful human would take.
// It is used by qa/browser/full-run.mjs (which turns each action into clicks on the real UI) and by
// qa/browser/playtest.mjs (the same player through the engine API, headless). It never reads the
// fight RNG and never looks ahead: it only uses what the screen shows (state, intents, map view).
//
// Every action it returns can be done with the UI's own controls (no item-bar entries for items that
// are not in the bag, no unequip), so the browser run and the Node run make the same choices.
import * as R from '../../src/rules.js';

const C = R.C;
const EA = C.ENGINE_ASSUMPTION;
const V = (L) => Math.round(C.VALUE_BASE + C.VALUE_COEF * L ** C.VALUE_EXP);
const count = (s, id) => s.player.bag.reduce((n, it) => n + (it.kind === 'cons' && it.id === id ? it.qty : 0), 0);
const hpF = (s) => s.player.hp / s.player.d.maxHp;
const manaF = (s) => (s.player.d.maxMana > 0 ? s.player.mana / s.player.d.maxMana : 1);
const legal = (s, a) => R.isLegal(s, a);
const bagCap = (s) => C.BAG_SLOTS + ((s.meta && s.meta.bagSlots) || 0);
const score = (s, it) => (it ? R.itemScore(it, s.player.classId) : 0);

/** Things the player wants to keep stocked (counts). */
function wants(s) {
  const mage = s.player.classId === 'mage';
  const camp = s.phase === 'CAMP';
  return [
    ['healing_draught', camp ? 5 : 4],
    ...(mage ? [['mana_draught', camp ? 4 : 3]] : []),
    ['trail_rations', 4],
    ...(camp ? [['purifying_tonic', 3]] : []),
  ];
}

/** Item bar: only consumables the player carries, healing first. */
function desiredItemBar(s) {
  const mage = s.player.classId === 'mage';
  const order = ['greater_healing_draught', 'healing_draught', ...(mage ? ['mana_draught'] : []), 'purifying_tonic', 'spark_flask'];
  const have = order.filter((id) => count(s, id) > 0);
  if (have.includes('greater_healing_draught') && have.includes('healing_draught')) have.splice(have.indexOf('healing_draught'), 1);
  const bar = have.slice(0, C.ITEM_BAR_SLOTS);
  while (bar.length < C.ITEM_BAR_SLOTS) bar.push(null);
  return bar;
}

function bestUpgrade(s, pool) {
  let best = null;
  let gain = 0.5; // ignore tiny score differences
  for (const it of pool) {
    if (it.kind !== 'gear') continue;
    const g = score(s, it) - score(s, s.player.equipped[it.slot]);
    if (g > gain) { gain = g; best = it; }
  }
  return best;
}

/** Out-of-combat housekeeping that is legal in hub, map, camp and between fights. */
function housekeeping(s) {
  const p = s.player;
  if (R.talentPointsFree(s) > 0) {
    const a = R.autoAction(s); // the standard build of balance.md 1.3, tree EA.AUTO_TREE
    if (a && a.type === 'SPEND_TALENT') return a;
  }
  const up = bestUpgrade(s, p.bag);
  if (up && legal(s, { type: 'EQUIP', itemId: up.uid })) return { type: 'EQUIP', itemId: up.uid };
  // Bar: the engine's default bar (conditional spells first, interrupt and cleanse first at the Camp).
  const a = R.autoAction(s);
  if (a && a.type === 'SET_BAR') return a;
  const ib = desiredItemBar(s);
  for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) {
    if (ib[i] && p.itemBar[i] !== ib[i]) return { type: 'SET_ITEM_BAR', slot: i, itemId: ib[i] };
  }
  const low = hpF(s) < 0.55 || manaF(s) < 0.4;
  if (low && count(s, 'trail_rations') > 0 && legal(s, { type: 'USE_ITEM', itemId: 'trail_rations' })) return { type: 'USE_ITEM', itemId: 'trail_rations' };
  return null;
}

function lootAction(s) {
  // The engine's loot rule (rules 8.7: equip an upgrade, take, else drop the lowest sell value, junk first).
  return R.autoAction(s);
}

function trainerAction(s) {
  const p = s.player;
  const learn = Object.values(C.SPELL).filter((sp) => sp.cls === p.classId && legal(s, { type: 'LEARN', spellId: sp.id }))
    .sort((a, b) => a.lvl - b.lvl || (a.id < b.id ? -1 : 1));
  if (learn.length) return { type: 'LEARN', spellId: learn[0].id };
  if (legal(s, { type: 'TRAIN_ALL' })) return { type: 'TRAIN_ALL' };
  return { type: 'LEAVE' };
}

function vendorAction(s) {
  const p = s.player;
  if (p.bag.some((x) => x.kind === 'junk') && legal(s, { type: 'SELL_JUNK' })) return { type: 'SELL_JUNK' };
  for (const it of p.bag) {
    if (it.kind === 'gear' && score(s, it) <= score(s, p.equipped[it.slot]) && legal(s, { type: 'SELL', itemId: it.uid })) return { type: 'SELL', itemId: it.uid };
  }
  const stock = s.service.stock;
  const reserve = 2 * V(p.level);
  const can = (i) => legal(s, { type: 'BUY', index: i }) && p.gold - stock[i].price >= reserve;
  for (const [id, n] of wants(s)) {
    const i = stock.findIndex((e) => e.kind === 'cons' && e.id === id);
    if (i >= 0 && count(s, id) < n && can(i)) return { type: 'BUY', index: i };
  }
  // An Ember of Return when it leaves gold for potions.
  const ei = stock.findIndex((e) => e.kind === 'cons' && e.id === 'ember_of_return' && !e.sold);
  if (ei >= 0 && count(s, 'ember_of_return') === 0 && legal(s, { type: 'BUY', index: ei }) && p.gold - stock[ei].price >= 4 * V(p.level)) return { type: 'BUY', index: ei };
  for (let i = 0; i < stock.length; i++) {
    const e = stock[i];
    if (e.kind === 'gear' && !e.sold && score(s, e.item) - score(s, p.equipped[e.item.slot]) > 2 && can(i)) return { type: 'BUY', index: i };
  }
  return { type: 'LEAVE' };
}

function trainerUseful(s) {
  const p = s.player;
  return Object.values(C.SPELL).some((sp) => sp.cls === p.classId && legal(s, { type: 'LEARN', spellId: sp.id }))
    || Object.entries(p.spells).some(([id, k]) => C.SPELL[id].source !== 'talent' && k.tl < p.level);
}
function vendorUseful(s) {
  const p = s.player;
  return p.bag.some((x) => x.kind !== 'cons') || wants(s).some(([id, n]) => count(s, id) < n);
}

function hubAction(s) {
  const u = s.hub.used;
  if (!u.trainer && trainerUseful(s) && legal(s, { type: 'SERVICE', service: 'trainer' })) return { type: 'SERVICE', service: 'trainer' };
  if (!u.vendor && vendorUseful(s) && legal(s, { type: 'SERVICE', service: 'vendor' })) return { type: 'SERVICE', service: 'vendor' };
  if (!u.inn && hpF(s) < 0.6 && legal(s, { type: 'SERVICE', service: 'inn' })) return { type: 'SERVICE', service: 'inn' };
  return null;
}

/** How attractive a map node is right now (higher is better). Uses only what the map shows. */
function nodeValue(s, n, view) {
  const p = s.player;
  const L = p.level;
  const h = hpF(s);
  const pots = count(s, 'healing_draught') + count(s, 'greater_healing_draught');
  const mobs = (view && view.archetypes) ? view.archetypes.length : 1;
  switch (n.type) {
    case 'quest': {
      let v = 10 + (s.zone.questsDone < C.STORY_QUESTS ? 3 : 0);
      if (mobs >= 3 && n.cl > L) v -= 6;
      if (h < 0.6) v -= 6;
      return v;
    }
    case 'grind': return (L < n.cl ? 9 : 6) - (h < 0.6 ? 6 : 0);
    case 'elite': {
      const el = view && view.level ? view.level : n.cl + C.ELITE_LEVEL_OFFSET;
      return L >= el - 1 && h >= 0.8 && pots >= 1 ? 12 : -8;
    }
    case 'dungeon': {
      const trash = n.cl;
      return L >= trash - 1 && h >= 0.85 && pots >= 2 ? 15 : -12;
    }
    case 'rest': return h < 0.6 ? 14 : h < 0.85 ? 5 : 1;
    case 'vendor': return vendorUseful(s) ? 7 : 1;
    case 'trainer': return trainerUseful(s) ? 6 : 0;
    case 'treasure': return 6;
    case 'shrine': return 7;
    default: return 0;
  }
}

function mapAction(s) {
  const z = s.zone;
  const p = s.player;
  const exit = C.ZONE_LEVELS * z.z;
  const lanes = R.mapView(s).next;
  const legalTravel = legal(s, { type: 'TRAVEL_ON' });
  if (legalTravel && (p.level >= exit || !lanes.length)) return { type: 'TRAVEL_ON' };
  if (!lanes.length) return { type: 'TRAVEL_ON' };
  const mv = R.mapView(s);
  let best = null;
  let bv = -Infinity;
  for (const l of lanes) {
    const n = z.rows[z.pos.r][l];
    const view = mv.rows[z.pos.r][l];
    // One row of lookahead: the best node reachable after this one, at half weight.
    let ahead = 0;
    if (z.pos.r + 1 < z.rows.length) {
      ahead = -Infinity;
      for (const nl of [l - 1, l, l + 1]) if (nl >= 0 && nl < C.LANES) ahead = Math.max(ahead, nodeValue(s, z.rows[z.pos.r + 1][nl], mv.rows[z.pos.r + 1][nl]));
    }
    const v = nodeValue(s, n, view) + 0.5 * ahead;
    if (v > bv) { bv = v; best = l; }
  }
  return { type: 'CHOOSE_NODE', lane: best };
}

function rewardAction(s) {
  const set = s.node.rewards[0];
  if (set.kind === 'items') {
    let bi = 0;
    for (let i = 1; i < set.items.length; i++) if (score(s, set.items[i]) > score(s, set.items[bi])) bi = i;
    return { type: 'CHOOSE_REWARD', index: bi };
  }
  const order = hpF(s) < 0.5 ? ['return', 'mending', 'fury', 'insight', 'plenty', 'clarity'] : ['return', 'fury', 'insight', 'mending', 'plenty', 'clarity'];
  for (const b of order) { const i = set.boons.indexOf(b); if (i >= 0) return { type: 'CHOOSE_REWARD', index: i }; }
  return { type: 'CHOOSE_REWARD', index: 0 };
}

function nodeAction(s) {
  const n = s.node;
  const h = hpF(s);
  if (n.stage === 'grindSetup') return { type: 'GRIND_SET_WAVES', n: h > 0.9 && s.player.level < n.cl ? 3 : h > 0.7 ? 2 : 1 };
  if (n.stage === 'reward') return rewardAction(s);
  if (n.stage === 'between') {
    if (n.type === 'grind') return h < 0.5 ? { type: 'GRIND_STOP' } : { type: 'NEXT_FIGHT' };
    const pots = count(s, 'healing_draught') + count(s, 'greater_healing_draught');
    if (h < 0.4 && pots === 0 && legal(s, { type: 'DUNGEON_LEAVE' })) return { type: 'DUNGEON_LEAVE' };
    return { type: 'NEXT_FIGHT' };
  }
  if (n.stage === 'service') return s.service.kind === 'trainer' ? trainerAction(s) : vendorAction(s);
  return null;
}

function campAction(s) {
  const p = s.player;
  const hub = hubAction(s);
  if (hub && hub.service !== 'inn') return hub;
  if (p.level < C.MAX_LEVEL) {
    if (hpF(s) < 0.5 && !s.hub.used.inn) return { type: 'SERVICE', service: 'inn' };
    return { type: 'CAMP_GRIND' };
  }
  if (!s.hub.used.inn && p.hp < p.d.maxHp) return { type: 'SERVICE', service: 'inn' };
  return { type: 'FIGHT_BOSS' };
}

/** Manual combat: the autoplay rules (7.9) plus what a careful player adds. */
function combatAction(s) {
  const f = s.fight;
  const p = s.player;
  const a = R.autoAction(s);
  const live = f.enemies.filter((e) => e.alive);
  const incoming = live.reduce((n, e) => n + (e.intent && (e.intent.target === 'player' || e.intent.target === 'all') ? e.intent.est || 0 : 0), 0);
  // Drink earlier than the autoplay threshold when the telegraphed hits would take us below 20 %.
  if (p.hp - incoming < 0.2 * p.d.maxHp) {
    for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) {
      const id = p.itemBar[i];
      if (id && /healing/.test(id) && legal(s, { type: 'USE_ITEM', slot: i, target: null })) return { type: 'USE_ITEM', slot: i, target: null };
    }
    // No heal left and the next round is likely lethal: run if we can.
    if (p.hp <= incoming && f.canFlee && legal(s, { type: 'FLEE' })) return { type: 'FLEE' };
  }
  return a;
}

/**
 * The next action. opts.manual: combat decisions are made here (true) or by the game's autoplay (false:
 * the caller lets autoplay act and this function is not asked in fights).
 */
export function playerAction(s, opts = {}) {
  if (s.phase === 'ENDED') return null;
  if (s.phase === 'SUMMARY') return { type: 'END_RUN' };
  if (s.fight) return opts.manual === false ? R.autoAction(s) : combatAction(s);
  if (s.loot && s.loot.length) return lootAction(s);
  const hk = housekeeping(s);
  if (hk) return hk;
  if (s.service) return s.service.kind === 'trainer' ? trainerAction(s) : vendorAction(s);
  if (s.phase === 'ZONE_HUB') return hubAction(s) || { type: 'LEAVE_HUB' };
  if (s.phase === 'MAP') return mapAction(s);
  if (s.phase === 'NODE') return nodeAction(s);
  if (s.phase === 'CAMP') return campAction(s);
  return R.autoAction(s);
}

/** Character creation choices as engine actions (the UI does the same with its controls). */
export function createActions({ classId, petId, name, seed }) {
  const acts = [{ type: 'SELECT_CLASS', classId }];
  if (classId === 'hunter') acts.push({ type: 'SELECT_PET', petId: petId || 'ridgewolf' });
  if (name) acts.push({ type: 'SET_NAME', name });
  if (seed != null) acts.push({ type: 'SET_SEED', seed });
  acts.push({ type: 'START_RUN' });
  return acts;
}
