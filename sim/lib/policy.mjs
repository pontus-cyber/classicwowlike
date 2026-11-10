// Shared bot policies (balance.md 1): talents (1.3), bar template (1.2), loot and gear, consumables, trainer,
// vendor, hub, camp, node stages. A bot is makeBot(spec): spec supplies the parts that differ per bot.
// Every policy returns one action; the engine checks legality and the batch runner logs anything illegal.
import { C, R, SPELL, TALENT, countCons, equippedScore, hpFrac, manaFrac, legal } from './engine.mjs';
import { BAL, SIM } from './params.mjs';

// ---------------- Talents (balance.md 1.3) ----------------
const orderCache = new Map();
/** Talents of a tree in standard order: tier ascending, highest-rank talents first within a tier, then id. */
export function talentOrder(cls, tree) {
  const key = `${cls}|${tree}`;
  if (!orderCache.has(key)) {
    orderCache.set(key, Object.values(TALENT).filter((t) => t.cls === cls && t.tree === tree)
      .sort((a, b) => a.tier - b.tier || b.ranks - a.ranks || (a.id < b.id ? -1 : 1)).map((t) => t.id));
  }
  return orderCache.get(key);
}

/** Standard build of `tree` (balance.md 1.3): capstone of the tree first, then the other two trees alternately. */
export function standardTalent(s, tree) {
  const p = s.player;
  const ok = (id) => legal(s, { type: 'SPEND_TALENT', talentId: id });
  const main = talentOrder(p.classId, tree);
  const cap = main.find((id) => TALENT[id].tier === 5);
  if (!p.talents[cap]) {
    if (ok(cap)) return cap;
    for (const id of main) if (ok(id)) return id;
  }
  const others = [0, 1, 2].filter((t) => t !== tree);
  let outside = 0;
  for (const [id, r] of Object.entries(p.talents)) if (TALENT[id].tree !== tree) outside += r;
  const seq = outside % 2 === 0 ? others : [others[1], others[0]];
  for (const t of seq) for (const id of talentOrder(p.classId, t)) if (ok(id)) return id;
  for (const id of main) if (ok(id)) return id;
  return null;
}

export function randomTalent(s, rng) {
  const opts = Object.keys(TALENT).filter((id) => TALENT[id].cls === s.player.classId && legal(s, { type: 'SPEND_TALENT', talentId: id }));
  return opts.length ? rng.pick(opts) : null;
}

// ---------------- Spells and the bar template (balance.md 1.2) ----------------
export const MAIN_SPELL = { rogue: 'gutting_jab', mage: 'ember_bolt', hunter: 'keen_shot' };
/**
 * Spells whose autoplay condition (rules 7.9 rule 5; src/engine/autoplay.js) is "always". On the bar they go
 * after every conditional spell, highest damage first, so an always-castable builder or filler never blocks a
 * finisher, interrupt or defensive (engine hand-off, spec question 8).
 */
export const ALWAYS_CAST = new Set(['gutting_jab', 'ember_bolt', 'keen_shot', 'pyre_comet', 'starlance_barrage', 'heartseeker_shot', 'glacier_spike', 'starfall_arrow']);
const tags = (id) => SPELL[id].tags;
const hasTag = (id, t) => SPELL[id].tags.includes(t);

/** Damage of one cast (engine spellInfo base amount; finishers at 4 combo points, DOTs over their duration). */
function rawDamage(s, id) {
  const info = R.spellInfo(s, id);
  const a = info && info.amount;
  if (!a) return 0;
  if (a.kind === 'damage') return a.amount * (a.hits || 1) * (a.perCp ? 4 : 1) * (SPELL[id].bounces ? 1 + SPELL[id].bounces * SPELL[id].bounceFrac : 1);
  if (a.kind === 'dot') return a.perTick * a.rounds * (SPELL[id].dot.perCp ? 4 : 1);
  return 0;
}

/**
 * Spells whose autoplay condition (rules 7.9, 5.3-5.5) fires only in some rounds: execute windows, elite-only
 * debuffs, openers, burst cooldowns, fresh-target DOTs. Their template value is damage × this usage share, and
 * they are not candidates for the "finisher or second nuke" step. [assumption: sim heuristic]
 */
export const SITUATIONAL = {
  shadowstep_strike: 0.3, final_reckoning: 0.35, open_vein: 0.3, expose_weakness: 0.3, temple_blow: 0.3,
  bloodprice_gambit: 0.5, living_flame: 0.5, barbed_arrow: 0.5, mark_prey: 0.5, conflagrant_core: 0.5,
  rapid_volley: 0.5, wild_communion: 0.5, hexbind: 0.5, chrono_sigil: 0.5,
};
/** The same shares for the boss bar: elite/boss-only spells always qualify, openers never (no STEALTH). */
export const SITUATIONAL_BOSS = {
  ...SITUATIONAL, shadowstep_strike: 0, open_vein: 1, expose_weakness: 1, bloodprice_gambit: 1, mark_prey: 1,
  conflagrant_core: 1, rapid_volley: 1, wild_communion: 1, hexbind: 0, living_flame: 0.8, barbed_arrow: 0.8,
};
/** Burst and debuff windows are worth about one main-spell cast each (utility default: UTILITY_SPELL_VALUE). */
const BURST = new Set(['rapid_volley', 'conflagrant_core', 'wild_communion', 'adrenal_surge', 'bloodprice_gambit', 'expose_weakness', 'mark_prey']);

/** Template value of a spell: damage (× usage share if situational); utility spells a share of the main spell. */
export function spellValue(s, id, boss = false) {
  const table = boss ? SITUATIONAL_BOSS : SITUATIONAL;
  const share = table[id] ?? 1;
  const d = rawDamage(s, id);
  if (d > 0) return d * share;
  const main = MAIN_SPELL[s.player.classId];
  const unit = s.player.spells[main] ? rawDamage(s, main) : 10;
  return (BURST.has(id) ? 1 : SIM.UTILITY_SPELL_VALUE) * share * unit;
}

/**
 * Bar from template 1.2: interrupt, main nuke/builder, finisher or second nuke, defensive, cleanse, AoE, then
 * highest value; at the Camp (camp = true) interrupt and cleanse first. exclude: spells kept off the bar
 * (B26-B28 variants). Order on the bar: conditional spells first in template order, then always-castable spells
 * by damage (the hand-off fix). Returns 7 entries (null = empty).
 */
export function templateBar(s, { camp = false, exclude = null } = {}) {
  const p = s.player;
  const known = p.spellOrder.filter((id) => p.spells[id] && !(exclude && exclude.has(id)));
  const sit = camp ? SITUATIONAL_BOSS : SITUATIONAL;
  const val = new Map(known.map((id) => [id, spellValue(s, id, camp)]));
  const byVal = (a, b) => val.get(b) - val.get(a) || known.indexOf(a) - known.indexOf(b);
  const pick = [];
  const take = (id) => { if (id && !pick.includes(id) && pick.length < C.SPELL_BAR_SLOTS) pick.push(id); };
  const best = (f) => known.filter((id) => !pick.includes(id) && f(id)).sort(byVal)[0] || null;
  const main = MAIN_SPELL[p.classId];
  const steps = camp ? ['interrupt', 'cleanse', 'main', 'second', 'defensive', 'aoe'] : ['interrupt', 'main', 'second', 'defensive', 'cleanse', 'aoe'];
  for (const st of steps) {
    if (st === 'interrupt') take(best((id) => hasTag(id, 'interrupt')));
    else if (st === 'main') take(known.includes(main) ? main : null);
    else if (st === 'second') take(best((id) => id !== main && (sit[id] ?? 1) >= 1 && (hasTag(id, 'finisher') || hasTag(id, 'nuke')) && rawDamage(s, id) > 0)
      || best((id) => id !== main && (hasTag(id, 'finisher') || hasTag(id, 'nuke') || hasTag(id, 'dot')) && rawDamage(s, id) > 0));
    else if (st === 'defensive') take(best((id) => (hasTag(id, 'defensive') || hasTag(id, 'heal')) && !hasTag(id, 'cleanse')) || best((id) => hasTag(id, 'defensive') || hasTag(id, 'heal')));
    else if (st === 'cleanse') take(best((id) => hasTag(id, 'cleanse')));
    else if (st === 'aoe') take(best((id) => hasTag(id, 'aoe')));
  }
  for (const id of known.filter((x) => !pick.includes(x)).sort(byVal)) take(id);
  const cond = pick.filter((id) => !ALWAYS_CAST.has(id));
  const always = pick.filter((id) => ALWAYS_CAST.has(id)).sort(byVal);
  const bar = [...cond, ...always];
  while (bar.length < C.SPELL_BAR_SLOTS) bar.push(null);
  return bar;
}

/** Random bot: known spells in learn order (balance.md 1, random). */
export function learnOrderBar(s) {
  const p = s.player;
  const bar = p.spellOrder.filter((id) => p.spells[id]).slice(0, C.SPELL_BAR_SLOTS);
  while (bar.length < C.SPELL_BAR_SLOTS) bar.push(null);
  return bar;
}

export function desiredItemBar(s, { noTonic = false } = {}) {
  const heal = countCons(s, 'greater_healing_draught') > 0 ? 'greater_healing_draught' : 'healing_draught';
  const tonic = noTonic ? null : 'purifying_tonic';
  return s.player.classId === 'mage' ? [heal, 'mana_draught', tonic] : [heal, tonic, 'spark_flask'];
}

/** First SET_BAR / SET_ITEM_BAR step towards the wanted bars, or null when they match. */
export function barAction(s, bar, itemBar) {
  const p = s.player;
  for (let i = 0; i < C.SPELL_BAR_SLOTS; i++) if (p.bar[i] !== bar[i]) return { type: 'SET_BAR', slot: i, spellId: bar[i] };
  if (itemBar) for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) if (p.itemBar[i] !== itemBar[i]) return { type: 'SET_ITEM_BAR', slot: i, itemId: itemBar[i] };
  return null;
}

// ---------------- Gear and loot ----------------
const gain = (s, it) => R.itemScore(it, s.player.classId) - equippedScore(s, it.slot);

export function bestUpgrade(s, list) {
  let best = null;
  let g = 0;
  for (const it of list) {
    if (it.kind !== 'gear') continue;
    const x = gain(s, it);
    if (x > g) { g = x; best = it; }
  }
  return best;
}

/** Loot window (rules 8.7): equip an upgrade, take what fits, else drop the least useful item. */
export function lootAction(s) {
  const p = s.player;
  const up = bestUpgrade(s, s.loot);
  if (up) return { type: 'EQUIP', itemId: up.uid };
  for (const it of s.loot) if (legal(s, { type: 'LOOT_TAKE', itemId: it.uid })) return { type: 'LOOT_TAKE', itemId: it.uid };
  const junkLoot = s.loot.find((x) => x.kind === 'junk');
  if (junkLoot) return { type: 'LOOT_DROP', itemId: junkLoot.uid };
  const junkBag = p.bag.find((x) => x.kind === 'junk');
  if (junkBag) return { type: 'DISCARD', itemId: junkBag.uid };
  // Lowest-scoring gear among the loot window and the bag; consumables in the bag are kept.
  let worst = null;
  for (const it of s.loot) if (it.kind === 'gear' && (!worst || R.itemScore(it, p.classId) < R.itemScore(worst.it, p.classId))) worst = { it, where: 'loot' };
  for (const it of p.bag) if (it.kind === 'gear' && (!worst || R.itemScore(it, p.classId) < R.itemScore(worst.it, p.classId))) worst = { it, where: 'bag' };
  if (worst) return worst.where === 'loot' ? { type: 'LOOT_DROP', itemId: worst.it.uid } : { type: 'DISCARD', itemId: worst.it.uid };
  return { type: 'LOOT_DROP', itemId: s.loot[0].uid };
}

export function equipAction(s) {
  const up = bestUpgrade(s, s.player.bag);
  return up ? { type: 'EQUIP', itemId: up.uid } : null;
}

/** Out of combat: Trail Rations below `hp` (Mage: also mana). */
export function foodAction(s, hp) {
  if (countCons(s, 'trail_rations') < 1) return null;
  if (hpFrac(s) < hp || (s.player.d.maxMana > 0 && manaFrac(s) < hp)) return { type: 'USE_ITEM', itemId: 'trail_rations' };
  return null;
}

// ---------------- Trainer and vendor ----------------
export function trainerUseful(s) {
  const p = s.player;
  const cls = p.classId;
  const metaSpells = (s.meta && s.meta.spells) || [];
  for (const sp of Object.values(SPELL)) {
    if (sp.cls !== cls || sp.source === 'talent') continue;
    if (sp.source === 'meta' && !metaSpells.includes(sp.id)) continue;
    const k = p.spells[sp.id];
    if (!k && sp.lvl <= p.level) return true;
    if (k && k.tl < p.level) return true;
  }
  return false;
}

/** Trainer: learn every new spell (cheapest first), then TRAIN_ALL, then LEAVE. */
export function trainAllAction(s) {
  const learn = Object.values(SPELL).filter((sp) => sp.cls === s.player.classId && legal(s, { type: 'LEARN', spellId: sp.id }))
    .sort((a, b) => a.lvl - b.lvl || (a.id < b.id ? -1 : 1));
  if (learn.length) return { type: 'LEARN', spellId: learn[0].id };
  if (legal(s, { type: 'TRAIN_ALL' })) return { type: 'TRAIN_ALL' };
  return { type: 'LEAVE' };
}

function stockIndex(s, id) {
  return s.service.stock.findIndex((e) => e.kind === 'cons' && e.id === id && !e.sold);
}

/**
 * Vendor for the non-random bots. kit: { potions, rations, mana, tonics, elixir, ember, gear }.
 * Sell junk and non-upgrade gear, then buy consumables to the stock targets, then an Ember (planner rule),
 * then gear upgrades while GEAR_RESERVE_V × V(L) gold stays.
 */
export function vendorAction(s, kit, vOf) {
  const p = s.player;
  if (p.bag.some((x) => x.kind === 'junk')) return { type: 'SELL_JUNK' };
  for (const it of p.bag) if (it.kind === 'gear' && gain(s, it) <= 0) return { type: 'SELL', itemId: it.uid };
  const buy = (id, target) => {
    if (!target || countCons(s, id) >= target) return null;
    const i = stockIndex(s, id);
    return i >= 0 && legal(s, { type: 'BUY', index: i }) ? { type: 'BUY', index: i } : null;
  };
  const heal = s.service.stock.some((e) => e.kind === 'cons' && e.id === 'greater_healing_draught') ? 'greater_healing_draught' : 'healing_draught';
  // HEAL_STOCK_TARGET counts the draughts the item bar holds in combat (desiredItemBar: Greater while any are held).
  // Where Greater Healing Draughts are sold, plain Healing Draughts (Packed Satchel) do not count: they are not on the
  // item bar while Greater ones are held, so counting them left the bot with fewer usable potions (2026-11-10: the
  // PALL rogue reached the boss with 2-3 usable potions instead of 5).
  const healHave = heal === 'greater_healing_draught' ? countCons(s, 'greater_healing_draught')
    : countCons(s, 'healing_draught') + countCons(s, 'greater_healing_draught');
  const mana = p.classId === 'mage' ? kit.mana : 0;
  // Two passes: a minimum of each consumable first (SIM.KIT_MIN), then up to the targets.
  for (const pass of [SIM.KIT_MIN, null]) {
    const cap = (n) => (pass === null ? n : Math.min(n, pass));
    if (kit.potions && healHave < cap(kit.potions)) { const a = buy(heal, countCons(s, heal) + 1); if (a) return a; }
    for (const [id, n] of [['trail_rations', kit.rations], ['mana_draught', mana], ['purifying_tonic', kit.tonics], ['elixir_ferocity', kit.elixir]]) {
      const a = buy(id, cap(n || 0));
      if (a) return a;
    }
  }
  if (kit.ember && countCons(s, 'ember_of_return') < 1) {
    const i = stockIndex(s, 'ember_of_return');
    if (i >= 0 && legal(s, { type: 'BUY', index: i }) && p.gold - s.service.stock[i].price >= BAL.EMBER_RESERVE_V * vOf(p.level)) return { type: 'BUY', index: i };
  }
  if (kit.gear) {
    const stock = s.service.stock;
    let bi = -1;
    let bg = 0;
    for (let i = 0; i < stock.length; i++) {
      const e = stock[i];
      if (e.kind !== 'gear' || e.sold) continue;
      const g = gain(s, e.item);
      if (g > bg && legal(s, { type: 'BUY', index: i }) && p.gold - e.price >= SIM.GEAR_RESERVE_V * vOf(p.level)) { bg = g; bi = i; }
    }
    if (bi >= 0) return { type: 'BUY', index: bi };
  }
  return { type: 'LEAVE' };
}

// ---------------- Rewards and node stages ----------------
export function bestRewardIndex(s, set) {
  let bi = 0;
  let bg = -Infinity;
  set.items.forEach((it, i) => {
    const g = gain(s, it) + R.itemScore(it, s.player.classId) * 1e-3;
    if (g > bg) { bg = g; bi = i; }
  });
  return bi;
}

const BOON_ORDER = ['return', 'fury', 'insight', 'mending', 'clarity', 'plenty'];
/**
 * Resurrect charges usable at the end boss (balance.md 1.1, M2 v3): Boon of Return and Embers of Return. Second
 * Breath (p.res.meta) does not work in the end-boss fight (rules 9), so it does not count.
 */
export function bossResurrects(s) {
  return s.player.res.boon + countCons(s, 'ember_of_return');
}
export function bestBoonIndex(s, boons) {
  const res = bossResurrects(s);
  let order = BOON_ORDER;
  if (res > 0) order = order.filter((b) => b !== 'return').concat(['return']);
  if (hpFrac(s) < SIM.STOP_HP) order = ['mending', ...order.filter((b) => b !== 'mending')];
  for (const b of order) { const i = boons.indexOf(b); if (i >= 0) return i; }
  return 0;
}

/** Between Grind waves or Dungeon fights (non-random bots): go on unless HP is low and no potion is left. */
export function betweenAction(s) {
  const n = s.node;
  const hp = hpFrac(s);
  const potions = countCons(s, 'healing_draught') + countCons(s, 'greater_healing_draught');
  const bossNext = n.type === 'dungeon' && n.k + 1 >= C.DUNGEON_TRASH_FIGHTS;
  const need = bossNext ? Math.max(SIM.STOP_HP, 0.6) : SIM.STOP_HP;
  const go = hp >= need || (potions >= 2 && hp >= need - 0.15);
  if (n.type === 'grind') return go ? { type: 'NEXT_FIGHT' } : { type: 'GRIND_STOP' };
  return go ? { type: 'NEXT_FIGHT' } : { type: 'DUNGEON_LEAVE' };
}

// ---------------- The bot shell ----------------
/**
 * spec: { name, combat(s), talent(s) -> talentId|null, bar(s) -> bar[7], itemBar(s) -> [3] | null,
 *         food(s) -> action|null, trainer(s), vendor(s), hub(s), map(s), grindWaves(s), reward(s), between(s),
 *         camp(s), pickPet(pets) (optional, Hunter without a preset pet) }
 */
export function makeBot(spec) {
  const ooc = (s) => {
    if (R.talentPointsFree(s) > 0) {
      const t = spec.talent(s);
      if (t) return { type: 'SPEND_TALENT', talentId: t };
    }
    const eq = equipAction(s);
    if (eq) return eq;
    const b = barAction(s, spec.bar(s), spec.itemBar ? spec.itemBar(s) : null);
    if (b) return b;
    return spec.food ? spec.food(s) : null;
  };
  return {
    name: spec.name,
    spec,
    choose(s) {
      if (s.phase === 'ENDED') return null;
      if (s.phase === 'SUMMARY') return { type: 'END_RUN' };
      if (s.phase === 'CREATE') {
        if (s.create.classId === 'hunter' && !s.create.petId) {
          const pets = R.legalActions(s).filter((a) => a.type === 'SELECT_PET').map((a) => a.petId);
          return { type: 'SELECT_PET', petId: spec.pickPet ? spec.pickPet(pets) : (pets.includes(SIM.DEFAULT_PET) ? SIM.DEFAULT_PET : pets[0]) };
        }
        return { type: 'START_RUN' };
      }
      if (s.fight) return spec.combat(s);
      if (s.loot.length) return lootAction(s);
      const o = ooc(s);
      if (o) return o;
      if (s.service) return s.service.kind === 'trainer' ? spec.trainer(s) : spec.vendor(s);
      if (s.phase === 'ZONE_HUB') return spec.hub(s);
      if (s.phase === 'MAP') return spec.map(s);
      if (s.phase === 'CAMP') return spec.camp(s);
      if (s.phase === 'NODE') {
        const st = s.node.stage;
        if (st === 'grindSetup') return { type: 'GRIND_SET_WAVES', n: spec.grindWaves(s) };
        if (st === 'reward') return spec.reward(s);
        if (st === 'between') return spec.between(s);
      }
      throw new Error(`${spec.name}: no decision for phase ${s.phase} stage ${s.node && s.node.stage}`);
    },
  };
}

/** Default reward choice for the non-random bots. */
export function rewardAction(s) {
  const set = s.node.rewards[0];
  return { type: 'CHOOSE_REWARD', index: set.kind === 'items' ? bestRewardIndex(s, set) : bestBoonIndex(s, set.boons) };
}

/**
 * Camp for the non-random bots: vendor, Camp grind to MAX_LEVEL, trainer, Inn, Elixir, boss bar, FIGHT_BOSS.
 * (The boss bar is set by the bot's bar() at phase CAMP before FIGHT_BOSS.)
 */
export function campAction(s, { vendor = true } = {}) {
  const p = s.player;
  const u = s.hub.used;
  if (vendor && !u.vendor) return { type: 'SERVICE', service: 'vendor' };
  // Grind to MAX_LEVEL, but not past SIM.CAMP_MAX_WAVES waves, and not on low HP with no food (a fled wave
  // gives no post-fight regen): use the Inn once, then go to the boss.
  const weak = hpFrac(s) < SIM.STOP_HP && countCons(s, 'trail_rations') < 1;
  if (weak && !u.inn) return { type: 'SERVICE', service: 'inn' };
  if (p.level < C.MAX_LEVEL && !weak && s.camp.waves < SIM.CAMP_MAX_WAVES) return { type: 'CAMP_GRIND' };
  if (!u.trainer && trainerUseful(s)) return { type: 'SERVICE', service: 'trainer' };
  if (!u.inn && (p.hp < p.d.maxHp || p.mana < p.d.maxMana || (p.pet && p.pet.hp < p.d.petMaxHp))) return { type: 'SERVICE', service: 'inn' };
  if (countCons(s, 'elixir_ferocity') > 0 && !p.buffs.elixir) return { type: 'USE_ITEM', itemId: 'elixir_ferocity' };
  return { type: 'FIGHT_BOSS' };
}
