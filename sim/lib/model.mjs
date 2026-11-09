// Node value model of the greedy, planner, speedrunner and tactician bots (balance.md 1.1):
//   value(node) = XP_in_levels × VAL_XP + expected item-score gain × VAL_GEAR + gold / V(L) × VAL_GOLD
//                 - hours × VAL_HOUR - P(death) × VAL_DEATH
// The model only estimates; the engine decides. It reads what the player may see (mapView) plus the
// character, and it predicts the character after the node (level, XP, rested pool, HP, rations) so the
// planners can chain nodes along a path. P(death) and the HP change come from the risk table (risk.mjs).
import { C, R, V, xpCurve, diffMod } from './engine.mjs';
import { BAL, SIM } from './params.mjs';
import { riskP, riskDh, riskType } from './risk.mjs';

// ---------------- Lookup tables (engine helpers, cached) ----------------
const MAXL = 70;
const VT = [];
const XC = [];
const XN = [];
for (let L = 0; L <= MAXL; L++) { VT[L] = V(Math.max(1, L)); XC[L] = xpCurve(L); XN[L] = R.xpToNext(Math.max(1, L)); }
const DM_OFF = 80;
const DM = [];
for (let d = -DM_OFF; d <= DM_OFF; d++) DM[d + DM_OFF] = diffMod(d);
export const vAt = (L) => VT[Math.max(1, Math.min(MAXL, L))];
const dmod = (d) => DM[Math.max(-DM_OFF, Math.min(DM_OFF, d)) + DM_OFF];
const xpNext = (L) => (L >= C.MAX_LEVEL ? 0 : XN[L]);

// ---------------- Expected item scores (bot estimate of unseen items) ----------------
// Mean item score of a generated item of a rarity at an ilvl in a slot, for the class (rules 8.3 budget split,
// DROP_CLASS_BIAS for the primary, the three affix kinds uniform). Used only to value unseen drops.
const RAR = C.RARITY;
function statScorePerPoint(rarity) {
  const pv = C.DROP_CLASS_BIAS * C.ITEM_SCORE.primary; // wrong primary scores 0
  const second = C.STAT2_STA_CHANCE * C.ITEM_SCORE.STA + (1 - C.STAT2_STA_CHANCE) * C.ITEM_SCORE.SPI;
  if (RAR[rarity].stats === 1) return C.STAT1_PRIMARY_CHANCE * pv + (1 - C.STAT1_PRIMARY_CHANCE) * C.ITEM_SCORE.STA;
  if (RAR[rarity].stats === 2) return C.SPLIT2_MAIN * pv + (1 - C.SPLIT2_MAIN) * second;
  return C.SPLIT3_MAIN * pv + C.SPLIT3_SECOND * C.ITEM_SCORE.STA + (1 - C.SPLIT3_MAIN - C.SPLIT3_SECOND) * C.ITEM_SCORE.SPI;
}
const SPP = Object.fromEntries(C.RARITY_ORDER.map((r) => [r, statScorePerPoint(r)]));

export function expItemScore(cls, slot, ilvl, rarity) {
  const R_ = RAR[rarity];
  const sw = C.SLOT[slot].slotW;
  const B = Math.round(ilvl * C.BUDGET_PER_ILVL * sw * R_.mult);
  const A = R_.affix ? Math.round(C.AFFIX_SHARE * B) : 0;
  let score = (B - A) * SPP[rarity];
  if (R_.affix) {
    const crit = (C.AFFIX_CRIT_PCT * sw * (rarity === 'epic' ? C.AFFIX_EPIC_MULT : 1) / C.ITEM_SCORE_CRIT_UNIT) * C.ITEM_SCORE.crit;
    const power = C.AFFIX_POWER_PER_PT * A * C.ITEM_SCORE.power;
    const armor = C.AFFIX_ARMOR_PER_PT * A * C.ITEM_SCORE.armor;
    score += (crit + power + armor) / 3;
  }
  if (slot === 'weapon' && cls !== 'mage') score += Math.round((C.WEAPON_DMG_BASE + C.WEAPON_DMG_PER_ILVL * ilvl) * R_.mult) * C.ITEM_SCORE.wd;
  if (C.SLOT[slot].armor) score += Math.round(C.ARMOR_PER_ILVL * ilvl * sw * R_.mult) * C.ITEM_SCORE.armor;
  return score;
}

/** Context of one decision: the character as the model sees it. */
export function makeCtx(s, risk, opts = {}) {
  const p = s.player;
  const eq = {};
  for (const slot of C.SLOT_IDS) eq[slot] = R.itemScore(p.equipped[slot], p.classId);
  let rations = 0;
  let potions = 0;
  for (const it of p.bag) {
    if (it.kind !== 'cons') continue;
    if (it.id === 'trail_rations') rations += it.qty;
    if (it.id === 'healing_draught' || it.id === 'greater_healing_draught') potions += it.qty;
  }
  const res = p.res.boon + p.res.meta + p.bag.filter((x) => x.kind === 'cons' && x.id === 'ember_of_return').length;
  // Training (no term in balance.md 1.1; SIM.TRAIN_*): a damage spell's gain per trained level, l, is valued like
  // the Power that gives the same gain (l / p Power, ITEM_SCORE.power each), averaged over the bar's damage spells.
  const train = [];
  for (const id of p.bar) {
    if (!id) continue;
    const sp = C.SPELL[id];
    if (sp.source === 'talent') continue;
    const src = sp.dot || sp;
    if (!src.l || !p.spells[id]) continue;
    train.push({ coef: (src.l / Math.max(SIM.TRAIN_MIN_P, src.p || 0)) * C.ITEM_SCORE.power, tl: p.spells[id].tl });
  }
  for (const t of train) t.coef /= train.length;
  const metaSpells = (s.meta && s.meta.spells) || [];
  const unknown = Object.values(C.SPELL).filter((sp) => sp.cls === p.classId && !p.spells[sp.id]
    && (sp.source === 'class' || (sp.source === 'meta' && metaSpells.includes(sp.id)))).map((sp) => sp.lvl);
  return {
    cls: p.classId, risk, eq, gainCache: new Map(), xpPct: s.meta.xpPct, goldPct: s.meta.goldPct,
    swift: !!s.meta.swiftBoots, res, potions, train, unknown,
    style: opts.style || 'balanced', hourMult: opts.style === 'speed' ? SIM.STYLE_SPEED_HOUR_MULT : 1,
    m: { L: p.level, xp: p.xp, rested: p.rested, hp: p.hp / p.d.maxHp, q: s.zone && !s.zone.camp ? s.zone.questsDone : 0, rations, tAt: 0 },
  };
}

/** Value of visiting a trainer at model state m (and mark the model as trained at m.L). */
function trainerGain(ctx, m) {
  let v = 0;
  for (const t of ctx.train) v += t.coef * Math.max(0, m.L - Math.max(t.tl, m.tAt));
  for (const lvl of ctx.unknown) if (lvl <= m.L && lvl > m.tAt) v += SIM.LEARN_VALUE;
  m.tAt = m.L;
  return v * SIM.TRAIN_VALUE_MULT;
}

/** Expected item-score gain of one roll on a drop table (8.4) at a level, against what is equipped now. */
export function expGain(ctx, table, level) {
  const key = `${table}|${level}`;
  let g = ctx.gainCache.get(key);
  if (g !== undefined) return g;
  const w = C.DROP_TABLE[table].weights;
  const tot = w.reduce((a, b) => a + b, 0);
  g = 0;
  for (let i = 0; i < C.RARITY_ORDER.length; i++) {
    if (!w[i]) continue;
    const rar = C.RARITY_ORDER[i];
    const il = Math.min(C.ILVL_MAX, Math.max(1, level) + C.RARITY_ILVL_BONUS[rar]);
    let sum = 0;
    for (const slot of C.SLOT_IDS) sum += Math.max(0, expItemScore(ctx.cls, slot, il, rar) - ctx.eq[slot]);
    g += (w[i] / tot) * (sum / C.SLOT_IDS.length);
  }
  ctx.gainCache.set(key, g);
  return g;
}

// ---------------- Character progression in the model ----------------
const killXp = (ctx, M, mult, L) => (L >= C.MAX_LEVEL ? 0 : C.MOB_XP_FRAC * mult * XC[Math.min(MAXL, M)] * dmod(M - L) * (1 + ctx.xpPct));
const evXp = (ctx, frac, cl, L) => (L >= C.MAX_LEVEL ? 0 : frac * XC[Math.min(MAXL, cl)] * dmod(cl - L) * (1 + ctx.xpPct));

/** Apply XP to model state m (in place): kills use the rested pool (rules 2.5). Returns the rested extra. */
function giveXp(m, amount, kill) {
  if (m.L >= C.MAX_LEVEL || amount <= 0) return 0;
  let extra = 0;
  if (kill && m.rested > 0) {
    extra = Math.min(m.rested, amount * (C.RESTED_MULT - 1));
    m.rested -= extra;
  }
  m.xp += amount + extra;
  while (m.L < C.MAX_LEVEL && m.xp >= XN[m.L]) { m.xp -= XN[m.L]; m.L += 1; }
  if (m.L >= C.MAX_LEVEL) { m.xp = 0; m.rested = 0; }
  return extra;
}

function afterFightHp(ctx, m, type, dl) {
  m.hp = Math.max(0.02, Math.min(1, m.hp + riskDh(ctx.risk, type, dl, m.hp)));
}

/** Rations between nodes (the bots eat below SIM.FOOD_HP). */
export function eatModel(m) {
  while (m.hp < SIM.FOOD_HP && m.rations > 0) { m.hp = Math.min(1, m.hp + C.RATION_PCT); m.rations -= 1; }
}

const STYLE_TYPES = { quest: ['quest'], grind: ['grind'], elite: ['elite', 'dungeon'] };
function styleMult(ctx, type) {
  const t = STYLE_TYPES[ctx.style];
  return t && t.includes(type) ? SIM.STYLE_WEIGHT : 1;
}

const BOON_MEAN = (() => {
  let w = 0;
  let v = 0;
  for (const b of Object.values(C.BOON)) { w += b.weight; v += b.weight * SIM.BOON_VALUE[b.id]; }
  return v / w;
})();

/**
 * Value of entering map node v (a mapView cell) from model state m. Mutates m into the predicted state after
 * the node. Returns { value, hours, pDeath, waves }. opts.grindWaves fixes the wave count (else the model picks
 * waves while the marginal value is positive).
 */
export function evalNode(ctx, m, v, opts = {}) {
  const L0 = m.L;
  const Vl = vAt(L0);
  const pos0 = bankedPos(m);
  let gear = 0;
  let gold = 0;
  let hours = 0;
  let pDeath = 0;
  let waves = 0;
  const type = v.type;
  const kill = (M, mult, n = 1) => {
    for (let i = 0; i < n; i++) giveXp(m, killXp(ctx, M, mult, m.L), true);
  };
  const event = (frac, cl) => giveXp(m, evXp(ctx, frac, cl, m.L), false);
  const g = (copper) => { gold += copper * (1 + ctx.goldPct); };
  switch (type) {
    case 'quest': {
      const n = v.archetypes ? v.archetypes.length : 2;
      const dl = v.cl - m.L;
      const rt = riskType(v);
      pDeath = riskP(ctx.risk, rt, dl, m.hp);
      kill(v.cl, 1, n);
      event(C.QUEST_TURNIN_XP_FRAC, v.cl);
      g(n * C.MOB_COIN_V * vAt(v.cl) + C.QUEST_GOLD_V * vAt(v.cl));
      gear += n * C.MOB_ITEM_CHANCE * expGain(ctx, 'mob', v.cl) + 1.5 * expGain(ctx, 'quest', v.cl);
      if (m.q + 1 === C.STORY_QUESTS) {
        event(C.STORY_XP_FRAC, v.cl);
        gear += 1.8 * expGain(ctx, 'story', v.cl);
      }
      m.q += 1;
      hours = C.HOURS_QUEST;
      afterFightHp(ctx, m, rt, dl);
      break;
    }
    case 'grind': {
      const maxW = opts.grindWaves || C.GRIND_MAX_WAVES;
      let value = 0;
      for (let w = 0; w < maxW; w++) {
        const dl = v.cl - m.L;
        const p = riskP(ctx.risk, 'grind', dl, m.hp);
        const save = { L: m.L, xp: m.xp, rested: m.rested, hp: m.hp, rations: m.rations };
        const p0 = bankedPos(m);
        const gd0 = gold;
        const ge0 = gear;
        kill(v.cl, 1, C.GRIND_WAVE_SIZE);
        event(C.GRIND_WAVE_XP_FRAC, v.cl);
        g(C.GRIND_WAVE_SIZE * C.MOB_COIN_V * vAt(v.cl));
        gear += C.GRIND_WAVE_SIZE * C.MOB_ITEM_CHANCE * C.GRIND_DROP_MULT * expGain(ctx, 'mob', v.cl);
        const sm = styleMult(ctx, 'grind');
        const marginal = ((bankedPos(m) - p0) * BAL.VAL_XP + (gear - ge0) * BAL.VAL_GEAR + ((gold - gd0) / Vl) * BAL.VAL_GOLD) * sm
          - C.HOURS_GRIND_WAVE * BAL.VAL_HOUR * ctx.hourMult - p * BAL.VAL_DEATH;
        if (!opts.grindWaves && w > 0 && marginal <= 0) {
          gold = gd0; gear = ge0; Object.assign(m, save);
          break;
        }
        value += marginal;
        waves += 1;
        hours += C.HOURS_GRIND_WAVE;
        pDeath = 1 - (1 - pDeath) * (1 - p);
        afterFightHp(ctx, m, 'grind', dl);
        eatModel(m);
      }
      return { value, hours, pDeath, waves };
    }
    case 'elite': {
      const M = v.level;
      const dl = M - m.L;
      const rt = riskType(v);
      pDeath = riskP(ctx.risk, rt, dl, m.hp);
      const rareP = v.rare === true ? 1 : v.rare === false ? 0 : C.RARE_CHANCE;
      const mult = (1 - rareP) * C.ELITE_XP_MULT + rareP * C.RARE_XP_MULT;
      kill(M, mult, 1);
      g(C.ELITE_GOLD_V * vAt(M));
      gear += (1 - rareP) * expGain(ctx, 'elite', M) + rareP * expGain(ctx, 'rare', M);
      if (v.archetypes && v.archetypes.length > 1) {
        kill(v.cl, 1, 1);
        g(C.MOB_COIN_V * vAt(v.cl));
        gear += C.MOB_ITEM_CHANCE * expGain(ctx, 'mob', v.cl);
      }
      hours = C.HOURS_ELITE;
      afterFightHp(ctx, m, rt, dl);
      break;
    }
    case 'dungeon': {
      const T = v.level;
      const B = v.bossLevel;
      const dl = T - m.L;
      pDeath = riskP(ctx.risk, 'dungeon', dl, m.hp);
      const meanSize = (2 * C.DUNGEON_SIZE_W2 + 3 * C.DUNGEON_SIZE_W3) / (C.DUNGEON_SIZE_W2 + C.DUNGEON_SIZE_W3);
      const nTrash = Math.round(C.DUNGEON_TRASH_FIGHTS * meanSize);
      kill(T, C.DUNGEON_MOB_XP_MULT, nTrash);
      kill(B, C.DUNGEON_BOSS_XP_MULT, 1);
      event(C.DUNGEON_CLEAR_XP_FRAC, B);
      g(nTrash * C.MOB_COIN_V * vAt(T) + C.MOB_COIN_V * vAt(B) + C.DUNGEON_GOLD_V * vAt(B));
      gear += nTrash * C.DUNGEON_ITEM_CHANCE * expGain(ctx, 'trash', T) + C.DUNGEON_BOSS_DROPS * expGain(ctx, 'dboss', B);
      hours = C.HOURS_DUNGEON;
      afterFightHp(ctx, m, 'dungeon', dl);
      break;
    }
    case 'rest': {
      const xn = xpNext(m.L);
      if (xn) m.rested = Math.min(C.RESTED_CAP_FRAC * xn, m.rested + C.REST_RESTED_FRAC * xn);
      m.hp = 1;
      hours = C.HOURS_REST;
      break;
    }
    case 'treasure': {
      const dl = v.cl - m.L;
      if (v.guarded) {
        pDeath = riskP(ctx.risk, 'treasure', dl, m.hp);
        kill(v.cl, 1, 1);
        g(C.MOB_COIN_V * vAt(v.cl));
        gear += C.MOB_ITEM_CHANCE * expGain(ctx, 'mob', v.cl);
        afterFightHp(ctx, m, 'treasure', dl);
      }
      const trapP = v.trap === true ? 1 : v.trap === false ? 0 : C.TREASURE_TRAP_CHANCE;
      m.hp = Math.max(0.02, m.hp - trapP * C.TREASURE_TRAP_PCT);
      g(C.TREASURE_GOLD_V * vAt(v.cl));
      gear += expGain(ctx, 'treasure', v.cl);
      hours = C.HOURS_TREASURE;
      break;
    }
    case 'shrine': {
      hours = C.HOURS_SHRINE;
      const value = BOON_MEAN - hours * BAL.VAL_HOUR * ctx.hourMult;
      return { value, hours, pDeath: 0, waves: 0 };
    }
    case 'vendor': {
      hours = C.HOURS_VENDOR;
      gear += 1.5 * expGain(ctx, 'vendor', v.cl);
      break;
    }
    case 'trainer':
      hours = C.HOURS_TRAINER;
      gear += trainerGain(ctx, m);
      break;
    default:
      hours = 1;
  }
  eatModel(m);
  const sm = styleMult(ctx, type);
  const value = ((bankedPos(m) - pos0) * BAL.VAL_XP + gear * BAL.VAL_GEAR + (gold / Vl) * BAL.VAL_GOLD) * sm
    - hours * BAL.VAL_HOUR * ctx.hourMult - pDeath * BAL.VAL_DEATH;
  return { value, hours, pDeath, waves };
}

/** Value of the hub Inn from model state m (mutates m like a Rest node). */
export function innValue(ctx, m) {
  return evalNode(ctx, m, { type: 'rest' }).value;
}

export const copyM = (m) => ({ L: m.L, xp: m.xp, rested: m.rested, hp: m.hp, q: m.q, rations: m.rations, tAt: m.tAt });

/**
 * XP_in_levels of the value function: the fractional level the model would have with its rested pool added
 * (rested XP is banked when a Rest grants it, so a kill's rested extra is not valued twice).
 */
export function bankedPos(m) {
  let L = m.L;
  let x = m.xp + m.rested;
  while (L < C.MAX_LEVEL && x >= XN[L]) { x -= XN[L]; L += 1; }
  return L >= C.MAX_LEVEL ? C.MAX_LEVEL : L + x / XN[L];
}

/** Fractional level of a model state (for level deficits). */
export function levelPos(m) {
  const xn = xpNext(m.L);
  return m.L + (xn ? m.xp / xn : 0);
}
