// Items, drops (heat: the rarity step, rules 8.4; D144: a reward choice's primary at REWARD_CLASS_BIAS), gold values, bag
// (rules 8). Generated names (rules 12.5; D150: at most one affix word, never two "of").
import {
  VALUE_BASE, VALUE_COEF, VALUE_EXP, RARITY, RARITY_ORDER, SLOT, SLOT_IDS, DROP_TABLE, ILVL_MAX,
  BUDGET_PER_ILVL, AFFIX_SHARE, AFFIX_CRIT_PCT, AFFIX_EPIC_MULT, AFFIX_POWER_PER_PT, AFFIX_ARMOR_PER_PT,
  SPLIT2_MAIN, SPLIT3_MAIN, SPLIT3_SECOND, DROP_CLASS_BIAS, REWARD_CLASS_BIAS, REWARD_DROP_TABLES, GATES, WEAPON_DMG_BASE, WEAPON_DMG_PER_ILVL,
  ARMOR_PER_ILVL, STAT1_PRIMARY_CHANCE, STAT2_STA_CHANCE, AFFIX_KINDS, ITEM_SCORE, ITEM_SCORE_CRIT_UNIT,
  CLASS, CONSUMABLE, CONTENT_RANGE, STACK_JUNK, BAG_SLOTS, PREP_MULE_SLOTS, JUNK_V, BUY_MULT, UNIQUE_DROP_CHANCE, ZONE_COUNT, ZONE_LEVELS,
  OATH_THRIFT_MULT, MAX_LEVEL, HEAT_RARITY_UP,
} from '../constants.js';
import { nextFloat, nextInt, weightedIndex, hash32 } from '../rng.js';
import { rnd } from './util.js';
import { zoneContent } from './content.js';

/** Value scale V(L) (rules 8.5). */
export function V(L) {
  return rnd(VALUE_BASE + VALUE_COEF * Math.pow(L, VALUE_EXP));
}

export function newUid(s) {
  const id = `i${s.nextUid}`;
  s.nextUid += 1;
  return id;
}

const otherPrimary = (p) => (p === 'AGI' ? 'INT' : 'AGI');

/**
 * Stats of a gear item (rules 8.3). Draw order: split (1 or 2 stats), primary, affix (rare/epic).
 * fixed: { primary, second, affix } skips the draws (uniques, starting gear). pad (items rolled on a drop table, rules
 * 8.4 heat): all three draws are made for every rarity, each used only when the rarity needs it, so the draws that
 * follow do not depend on the rarity (a heat rarity step changes no later draw). bias: the chance that the primary is
 * the class's (DROP_CLASS_BIAS; a reward choice REWARD_CLASS_BIAS, D144); the primary draw is made whatever it is.
 */
function rollStats(rng, ilvl, rarity, slot, clsPrimary, fixed, pad = false, bias = DROP_CLASS_BIAS) {
  const R = RARITY[rarity];
  const sw = SLOT[slot].slotW;
  const B = rnd(ilvl * BUDGET_PER_ILVL * sw * R.mult);
  const A = R.affix ? rnd(AFFIX_SHARE * B) : 0;
  const S = B - A;
  let split = null;
  if (!fixed && (pad || R.stats === 1 || R.stats === 2)) split = nextFloat(rng);
  const primary = fixed ? fixed.primary : (nextFloat(rng) < bias ? clsPrimary : otherPrimary(clsPrimary));
  const st = { AGI: 0, INT: 0, STA: 0, SPI: 0 };
  if (R.stats === 1) {
    if (fixed || split < STAT1_PRIMARY_CHANCE) st[primary] = S; else st.STA = S;
  } else if (R.stats === 2) {
    const main = rnd(SPLIT2_MAIN * S);
    st[primary] = main;
    const second = fixed ? fixed.second : (split < STAT2_STA_CHANCE ? 'STA' : 'SPI');
    st[second] += S - main;
  } else if (R.stats === 3) {
    const main = rnd(SPLIT3_MAIN * S);
    const sta = rnd(SPLIT3_SECOND * S);
    st[primary] = main;
    st.STA = sta;
    st.SPI = S - main - sta;
  }
  let affix = null;
  let power = 0;
  let crit = 0;
  let bonusArmor = 0;
  if (R.affix) {
    affix = fixed ? fixed.affix : AFFIX_KINDS[nextInt(rng, AFFIX_KINDS.length)];
    if (affix === 'crit') crit = AFFIX_CRIT_PCT * sw * (rarity === 'epic' ? AFFIX_EPIC_MULT : 1);
    else if (affix === 'power') power = AFFIX_POWER_PER_PT * A;
    else bonusArmor = AFFIX_ARMOR_PER_PT * A;
  } else if (pad && !fixed) nextFloat(rng); // the unused affix draw of a padded roll
  const wd = slot === 'weapon' ? rnd((WEAPON_DMG_BASE + WEAPON_DMG_PER_ILVL * ilvl) * R.mult) : 0;
  const armor = SLOT[slot].armor ? rnd(ARMOR_PER_ILVL * ilvl * sw * R.mult) : 0;
  return { budget: B, stats: st, primary, affix, power, crit, bonusArmor, wd, armor };
}

/** Stat signature for affix words: stats with points, in the order AGI, INT, STA, SPI. */
function statKey(st) {
  return ['AGI', 'INT', 'STA', 'SPI'].filter((k) => st[k] > 0).join('_');
}

function pick(list, h, salt) {
  return list[(h >>> salt) % list.length];
}

/** The words of a name that count for a repeat (lower case, without "of", "the" and "a"). */
const nameWords = (x) => x.toLowerCase().split(/[^a-z']+/).filter((w) => w && w !== 'of' && w !== 'the' && w !== 'a');
/**
 * An affix word for `base` from `list`, picked with the hash at `salt`; when it repeats a word of the base ("Skinning Blade
 * of the Still Blade") or makes the name longer than CONTENT_RANGE.len.itemName (long names clipped the reward cards), the
 * next one in the list that does not, else none (D150, cut list item 20).
 */
function affixFor(list, h, salt, base) {
  if (!list || !list.length) return null;
  const have = new Set(nameWords(base));
  const i0 = (h >>> salt) % list.length;
  for (let k = 0; k < list.length; k++) {
    const w = list[(i0 + k) % list.length];
    if (base.length + 1 + w.length <= CONTENT_RANGE.len.itemName && !nameWords(w).some((x) => have.has(x))) return w;
  }
  return null;
}

/**
 * Name of a generated item from content, picked with a hash (never a game stream). D150 (cut list item 20, owner-approved):
 * at most one affix word and never two "of": an item with an affix (crit, power, armor) takes its prefix ("Keen Hempen
 * Hood"), any other its stat suffix ("Hempen Hood of the Fox") unless the base name has an "of" ("Cord of Wheat"); within
 * CONTENT_RANGE.len.itemName characters (affixFor); the zone base names stay. Stats and draws are unchanged: only the name
 * differs from before.
 */
function gearName(s, item) {
  const c = s.content;
  const h = hash32(`${s.seed}|name|${item.uid}`);
  const band = c.itemNames[Math.min(ZONE_COUNT, Math.max(1, Math.ceil(item.ilvl / ZONE_LEVELS))) - 1];
  let names = band[item.slot];
  if (!Array.isArray(names)) names = names[item.stats.INT > item.stats.AGI ? 'INT' : 'AGI'] || names.AGI;
  const base = pick(names, h, 0);
  const pfx = item.affix ? affixFor(c.affixWords.prefix[item.affix], h, 16, base) : null;
  if (pfx) return `${pfx} ${base}`;
  if (/\bof\b/i.test(base)) return base;
  const sfx = affixFor(c.affixWords.suffix[statKey(item.stats)], h, 8, base);
  return sfx ? `${base} ${sfx}` : base;
}

function buildGear(s, rng, { level, rarity, slot, fixed, ilvl, pad = false, bias }) {
  const il = ilvl !== undefined ? ilvl : Math.min(ILVL_MAX, Math.max(1, level) + RARITY[rarity].ilvlBonus);
  const r = rollStats(rng, il, rarity, slot, CLASS[s.player.classId].primary, fixed, pad, bias);
  const item = {
    uid: newUid(s), kind: 'gear', slot, rarity, ilvl: il, name: '',
    stats: r.stats, power: r.power, crit: r.crit, armor: r.armor, bonusArmor: r.bonusArmor, wd: r.wd,
    affix: r.affix, unique: null, effect: null,
  };
  item.name = gearName(s, item);
  return item;
}

/** Turn a unique id into an item at the given ilvl (stats follow the normal budget, fixed choices). */
export function makeUnique(s, uniqueId, ilvl) {
  const u = s.content.uniques[uniqueId];
  const rarity = u.kind === 'rare' ? 'rare' : 'epic';
  const primary = u.kind === 'weapon' ? CLASS[u.classId].primary : CLASS[s.player.classId].primary;
  const item = buildGear(s, null, { rarity, slot: u.slot, ilvl, fixed: { primary, second: 'STA', affix: u.affix } });
  item.name = u.name;
  item.unique = uniqueId;
  item.effect = u.effect;
  return item;
}

/**
 * Starting / heirloom gear: deterministic stats (no draws). name null (the dev tools' gear, engine-api.md 12): the
 * generated name of rules 12.5.
 */
export function makeFixedGear(s, slot, rarity, ilvl, name) {
  const primary = CLASS[s.player.classId].primary;
  const item = buildGear(s, null, { rarity, slot, ilvl, fixed: { primary, second: 'STA', affix: 'power' } });
  if (name !== null) item.name = name;
  return item;
}

export function makeJunk(s, level, z) {
  const zn = zoneContent(s.content, z);
  const uid = newUid(s);
  const h = hash32(`${s.seed}|name|${uid}`);
  return { uid, kind: 'junk', name: pick(zn.junkNames, h, 0), level, qty: 1 };
}

export function makeConsumable(s, id, qty = 1) {
  return { uid: newUid(s), kind: 'cons', id, qty };
}

/**
 * Can a drop from this source be replaced by a unique for this run's profile (rules 8.4, 11.3): Cache of the Wanderer
 * for elite, rare and treasure drops, Relics of the Deep for dungeon boss drops? Depends on the profile only.
 */
const uniqueSource = (s, source) => !!((s.meta.cache && (source === 'elite' || source === 'rare' || source === 'treasure')) || (s.meta.relics && source === 'dboss'));

/** Unique that may replace a generated item (rules 8.4, 11.3), or null. */
function uniqueFor(s, source, z, rarity) {
  const m = s.meta;
  let want = null;
  if ((source === 'elite' || source === 'rare' || source === 'treasure') && rarity === 'rare' && m.cache) want = 'rare';
  else if (source === 'dboss' && rarity === 'epic' && m.relics) want = 'epic';
  if (!want) return null;
  for (const [id, u] of Object.entries(s.content.uniques)) {
    if (u.kind === want && u.zone === Math.min(z, ZONE_COUNT) && !s.player.uniquesFound.includes(id)) return id;
  }
  return null;
}

/**
 * Chance that an item rolled now is one rarity step higher (rules 8.4, heat): HEAT_RARITY_UP of the state the current
 * node was entered in (rules 1.7.3); 0 outside such a node (the Camp, the boss, a Dimmed encounter).
 */
export const rarityUpChance = (s) => (s.node && s.node.heat ? HEAT_RARITY_UP[s.node.heat] : 0);

/**
 * The chance that an item rolled on drop table `table` has the class's primary stat (rules 8.3): REWARD_CLASS_BIAS for a
 * reward choice (REWARD_DROP_TABLES: quest, story, contract, bounty) while GATES.rewardPrimary is on (D144), else
 * DROP_CLASS_BIAS.
 */
export const classBias = (table) => (GATES.rewardPrimary && REWARD_DROP_TABLES.includes(table) ? REWARD_CLASS_BIAS : DROP_CLASS_BIAS);

/**
 * One roll on a drop table (rules 8.4). Draw order: item chance, junk chance; when an item is rolled: rarity, the heat
 * step (always drawn; below rarityUpChance the rarity is one step higher, epic stays), slot, stats (padded: always the
 * three draws, rules 8.3; the primary at classBias(table), D144), then the unique draw whenever the profile makes this
 * source a unique source (uniqueSource), applied only when an eligible unique of the final rarity exists. So the number
 * of draws never depends on heat, on the rarity drawn or on the table's class bias (heat, rules 8.4). dropMult
 * multiplies item and junk chances (Grind). Returns the items (gear, then junk).
 */
export function rollDrop(s, rng, table, level, z, dropMult = 1) {
  const t = DROP_TABLE[table];
  const rItem = nextFloat(rng);
  const rJunk = nextFloat(rng);
  const out = [];
  if (rItem < Math.min(1, t.item * dropMult)) {
    let ri = weightedIndex(rng, t.weights);
    if (nextFloat(rng) < rarityUpChance(s)) ri = Math.min(RARITY_ORDER.length - 1, ri + 1);
    const rarity = RARITY_ORDER[ri];
    const slot = SLOT_IDS[nextInt(rng, SLOT_IDS.length)];
    let item = buildGear(s, rng, { level, rarity, slot, pad: true, bias: classBias(table) });
    if (uniqueSource(s, table)) {
      const u = nextFloat(rng);
      const uq = uniqueFor(s, table, z, rarity);
      if (uq && u < UNIQUE_DROP_CHANCE) {
        s.player.uniquesFound.push(uq);
        item = makeUnique(s, uq, item.ilvl);
      }
    }
    out.push(item);
  }
  if (rJunk < Math.min(1, t.junk * dropMult)) out.push(makeJunk(s, level, z));
  return out;
}

/** Generated item of a known rarity table without the junk part (vendor stock). */
export function rollGear(s, rng, table, level) {
  const t = DROP_TABLE[table];
  const rarity = RARITY_ORDER[weightedIndex(rng, t.weights)];
  const slot = SLOT_IDS[nextInt(rng, SLOT_IDS.length)];
  return buildGear(s, rng, { level, rarity, slot });
}

/** Item score for the upgrade arrow and bots (rules 8.3). */
export function itemScore(item, classId) {
  if (!item || item.kind !== 'gear') return 0;
  const prim = CLASS[classId].primary;
  return item.stats[prim] * ITEM_SCORE.primary + item.stats.STA * ITEM_SCORE.STA + item.stats.SPI * ITEM_SCORE.SPI
    + item.power * ITEM_SCORE.power + (item.crit / ITEM_SCORE_CRIT_UNIT) * ITEM_SCORE.crit
    + (item.armor + item.bonusArmor) * ITEM_SCORE.armor + (classId === 'mage' ? 0 : item.wd * ITEM_SCORE.wd);
}

/** Sell value of one bag entry (whole stack). */
export function sellValue(s, item) {
  if (item.kind === 'gear') return rnd(V(item.ilvl) * SLOT[item.slot].slotW * RARITY[item.rarity].sellMult);
  if (item.kind === 'junk') return rnd(JUNK_V * V(item.level)) * item.qty;
  return rnd((CONSUMABLE[item.id].priceV * V(s.player.level)) / BUY_MULT) * item.qty;
}

export function priceMult(s) {
  return s.oaths.includes('thrift') ? OATH_THRIFT_MULT : 1;
}

export function consumablePrice(s, id, cl) {
  return rnd(CONSUMABLE[id].priceV * V(cl) * priceMult(s));
}

export function gearPrice(s, item) {
  return rnd(BUY_MULT * sellValue(s, item) * priceMult(s));
}

// ---------------- Bag ----------------
export function bagCapacity(s) {
  // prep (expedition.md 2.3): the Pack Mule's slots for the run
  return BAG_SLOTS + s.meta.bagSlots + (s.exp && s.exp.mule ? PREP_MULE_SLOTS : 0);
}

function stackLimit(item) {
  if (item.kind === 'cons') return CONSUMABLE[item.id].stack;
  if (item.kind === 'junk') return STACK_JUNK;
  return 1;
}

function sameStack(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'cons') return a.id === b.id;
  if (a.kind === 'junk') return a.name === b.name && a.level === b.level;
  return false;
}

export function countConsumable(s, id) {
  let n = 0;
  for (const it of s.player.bag) if (it.kind === 'cons' && it.id === id) n += it.qty;
  return n;
}

/** Can the item (its whole qty) be added to the bag? Gear always takes one slot. */
export function canAdd(s, item) {
  if (item.kind === 'gear') return s.player.bag.length < bagCapacity(s);
  if (item.kind === 'cons') {
    const c = CONSUMABLE[item.id];
    if (c.max !== undefined && countConsumable(s, item.id) + item.qty > c.max) return false;
  }
  const lim = stackLimit(item);
  let need = item.qty;
  for (const it of s.player.bag) if (sameStack(it, item) && it.qty < lim) need -= lim - it.qty;
  if (need <= 0) return true;
  const slotsNeeded = Math.ceil(need / lim);
  return s.player.bag.length + slotsNeeded <= bagCapacity(s);
}

/** Add an item (any qty) to the bag; returns false and changes nothing when it does not fit. */
export function addToBag(s, item) {
  if (!canAdd(s, item)) return false;
  if (item.kind === 'gear') {
    s.player.bag.push(item);
    return true;
  }
  const lim = stackLimit(item);
  let left = item.qty;
  for (const it of s.player.bag) {
    if (left <= 0) break;
    if (sameStack(it, item) && it.qty < lim) {
      const take = Math.min(lim - it.qty, left);
      it.qty += take;
      left -= take;
    }
  }
  let first = true;
  while (left > 0) {
    const take = Math.min(lim, left);
    s.player.bag.push(first ? { ...item, qty: take } : { ...item, uid: newUid(s), qty: take });
    first = false;
    left -= take;
  }
  return true;
}

/** Remove n units of a consumable (from the last stacks first). */
export function takeConsumable(s, id, n = 1) {
  const bag = s.player.bag;
  for (let i = bag.length - 1; i >= 0 && n > 0; i--) {
    const it = bag[i];
    if (it.kind === 'cons' && it.id === id) {
      const t = Math.min(n, it.qty);
      it.qty -= t;
      n -= t;
      if (it.qty === 0) bag.splice(i, 1);
    }
  }
}

export function bagIndex(s, uid) {
  return s.player.bag.findIndex((it) => it.uid === uid);
}

/** Level used for junk sell values outside a node (player level). */
export function clampLevel(L) {
  return Math.max(1, Math.min(MAX_LEVEL, L));
}
