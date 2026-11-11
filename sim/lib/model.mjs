// Node value model of the greedy, planner, speedrunner and tactician bots (balance.md 1.1):
//   value(node) = XP_in_levels × VAL_XP + expected item-score gain × VAL_GEAR + gold / V(L) × VAL_GOLD
//                 - hours × VAL_TIME × hourMult - P(death) × VAL_DEATH
//                 - (projected Ascendancy after the node - before) × VAL_ASC                       (heat: boss term)
// hourMult (M2 v3): 1 for the greedy, PLANNER_TIME_MULT for the bots with lookahead, × STYLE_SPEED_TIME_MULT for the
// speed route style (makeCtx opts.hourMult).
// Heat (expedition.md H.3, H.6; rules 1.7.1-1.7.3; makeCtx opts.heat, the planner family only): the XP and gold of a
// node × (1 + HEAT_GAIN) and its drop-table items with the HEAT_RARITY_UP rarity step, both of the state the node is
// entered in (the first node of a choice: R.heatPreview's `pays`; later nodes of a path: the model's hours), and the
// boss term: the node's change of the projected boss Ascendancy (ascIfPar, rules 1.7.1) × SIM.VAL_ASC. Hours in hand
// cost no Ascendancy, hours past the line do. The greedy and the speedrunner keep balance.md 1.1 as it is (H.6).
// The model only estimates; the engine decides. It reads what the player may see (mapView, heatView) plus the
// character, and it predicts the character after the node (level, XP, rested pool, HP, rations, hours) so the
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

/**
 * Context of one decision: the character as the model sees it. opts: { style (route style, default 'balanced'),
 * hourMult (bot hour weight, balance.md 1.1: 1 greedy, PLANNER_TIME_MULT planner/tactician/speedrunner; default 1),
 * heat (expedition.md H.6; null = balance.md 1.1 without heat): { rewards (value HEAT_GAIN and HEAT_RARITY_UP of the
 * entry state; default true), ascW (boss term: value units per 1.0 projected Ascendancy; default SIM.VAL_ASC) } }.
 */
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
  // Resurrects usable at the end boss (balance.md 1.1, M2 v3; engine resurrectCharges): Second Breath does not count.
  const res = R.resurrectCharges(s).boss.length;
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
    style: opts.style || 'balanced', hourMult: (opts.hourMult ?? 1) * (opts.style === 'speed' ? SIM.STYLE_SPEED_TIME_MULT : 1),
    heat: opts.heat ? heatCtx(s, opts.heat) : null,
    m: { L: p.level, xp: p.xp, rested: p.rested, hp: p.hp / p.d.maxHp, q: s.zone && !s.zone.camp ? s.zone.questsDone : 0, rations, tAt: 0, dh: 0 },
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

/** Mean gain over the slots of an item of rarity index ri at a level (ilvl from the final rarity, rules 8.4). */
function rarityGain(ctx, ri, level) {
  const rar = C.RARITY_ORDER[ri];
  const il = Math.min(C.ILVL_MAX, Math.max(1, level) + C.RARITY_ILVL_BONUS[rar]);
  let sum = 0;
  for (const slot of C.SLOT_IDS) sum += Math.max(0, expItemScore(ctx.cls, slot, il, rar) - ctx.eq[slot]);
  return sum / C.SLOT_IDS.length;
}

/**
 * Expected item-score gain of one roll on a drop table (8.4) at a level, against what is equipped now. up (heat, rules
 * 8.4): the chance that the rarity is one step higher (common -> uncommon -> rare -> epic; epic stays).
 */
export function expGain(ctx, table, level, up = 0) {
  const key = `${table}|${level}|${up}`;
  let g = ctx.gainCache.get(key);
  if (g !== undefined) return g;
  const w = C.DROP_TABLE[table].weights;
  const tot = w.reduce((a, b) => a + b, 0);
  const top = C.RARITY_ORDER.length - 1;
  g = 0;
  for (let i = 0; i < C.RARITY_ORDER.length; i++) {
    if (!w[i]) continue;
    const base = rarityGain(ctx, i, level);
    const stepped = up > 0 ? rarityGain(ctx, Math.min(top, i + 1), level) : base;
    g += (w[i] / tot) * ((1 - up) * base + up * stepped);
  }
  ctx.gainCache.set(key, g);
  return g;
}

// ---------------- Heat (expedition.md H.1-H.3; rules 1.7.1-1.7.3) ----------------
/** Run heat state of a heat value (rules 1.7.2; a rows run has no Dimming clock). */
export function heatStateOf(heat) {
  if (heat < C.HEAT_WARM_AT) return 'clear';
  if (heat < C.HEAT_HOT_AT) return 'warm';
  if (heat < C.HEAT_SCORCH_AT) return 'hot';
  return 'scorched';
}

/**
 * Projected boss Ascendancy of a heat value (rules 1.7.1 ascIfPar: the boss Ascendancy if every later zone keeps its
 * line share). SIM.HEAT_ASC_FLOOR 1: the meter's stepped formula; 0 (the bots' default): the same without the floor,
 * ASC_PER_STEP per ASC_STEP_TIME hours past the line [assumption: the expected step count when the hours of the
 * later zones are not known; the stepped form makes a path's value jump at the step boundaries].
 */
export function ascProjected(heat) {
  const steps = Math.max(0, heat) / C.ASC_STEP_TIME;
  return Math.min(C.ASC_CAP, C.ASC_PER_STEP * (SIM.HEAT_ASC_FLOOR ? Math.floor(steps + 1e-9) : steps));
}

/** Heat of the decision state (rows runs: the line is fixed within a zone, so a path's heat is heat0 + hours). */
function heatCtx(s, opts) {
  const v = R.heatView(s);
  return { h0: v ? v.heat : 0, rewards: opts.rewards !== false, ascW: opts.ascW ?? SIM.VAL_ASC };
}

/** Heat reward of a state (rules 1.7.3) as the model values it: { gain, up }; none when rewards are not valued. */
function heatReward(ctx, state) {
  if (!ctx.heat || !ctx.heat.rewards || !state) return { gain: 0, up: 0 };
  return { gain: C.HEAT_GAIN[state] || 0, up: C.HEAT_RARITY_UP[state] || 0 };
}

/** Boss term (value units) of `hours` spent from model hours dh: the change of projected Ascendancy × ascW. */
function bossCost(ctx, dh, hours) {
  if (!ctx.heat || !ctx.heat.ascW || !(hours > 0)) return 0;
  const h = ctx.heat.h0 + dh;
  return (ascProjected(h + hours) - ascProjected(h)) * ctx.heat.ascW;
}

// ---------------- Character progression in the model ----------------
const killXp = (ctx, M, mult, L) => (L >= C.MAX_LEVEL ? 0 : C.MOB_XP_FRAC * mult * XC[Math.min(MAXL, M)] * dmod(M - L) * (1 + ctx.xpPct));
const evXp = (ctx, frac, cl, L) => (L >= C.MAX_LEVEL ? 0 : frac * XC[Math.min(MAXL, cl)] * dmod(cl - L) * (1 + ctx.xpPct));

/**
 * Apply XP to model state m (in place): kills use the rested pool (rules 2.5), then heat × (1 + hg) (rules 1.7.3, after
 * every other modifier). Returns the rested extra.
 */
function giveXp(m, amount, kill, hg = 0) {
  if (m.L >= C.MAX_LEVEL || amount <= 0) return 0;
  let extra = 0;
  if (kill && m.rested > 0) {
    extra = Math.min(m.rested, amount * (C.RESTED_MULT - 1));
    m.rested -= extra;
  }
  m.xp += (amount + extra) * (1 + hg);
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
 * the node (m.dh: model hours since the decision). Returns { value, hours, pDeath, waves, state }. opts.grindWaves
 * fixes the wave count (else the model picks waves while the marginal value is positive); opts.pays (heat) is the
 * state the node is entered in when the engine has said it (R.heatPreview `pays`, or state.node.heat inside a node);
 * else the model's heat at entry decides.
 */
export function evalNode(ctx, m, v, opts = {}) {
  const L0 = m.L;
  const Vl = vAt(L0);
  const pos0 = bankedPos(m);
  const dh0 = m.dh || 0;
  let gear = 0;
  let gold = 0;
  let hours = 0;
  let pDeath = 0;
  let waves = 0;
  const type = v.type;
  // Heat (rules 1.7.3): the state is fixed at entry, before the node's hours, and pays everything the node pays.
  const state = ctx.heat ? (opts.pays || heatStateOf(ctx.heat.h0 + dh0)) : null;
  const { gain: hg, up } = heatReward(ctx, state);
  const kill = (M, mult, n = 1) => {
    for (let i = 0; i < n; i++) giveXp(m, killXp(ctx, M, mult, m.L), true, hg);
  };
  const event = (frac, cl) => giveXp(m, evXp(ctx, frac, cl, m.L), false, hg);
  const g = (copper) => { gold += copper * (1 + ctx.goldPct) * (1 + hg); };
  const eg = (table, level) => expGain(ctx, table, level, up);
  switch (type) {
    case 'quest': {
      const n = v.archetypes ? v.archetypes.length : 2;
      const dl = v.cl - m.L;
      const rt = riskType(v);
      pDeath = riskP(ctx.risk, rt, dl, m.hp);
      kill(v.cl, 1, n);
      event(C.QUEST_TURNIN_XP_FRAC, v.cl);
      g(n * C.MOB_COIN_V * vAt(v.cl) + C.QUEST_GOLD_V * vAt(v.cl));
      gear += n * C.MOB_ITEM_CHANCE * eg('mob', v.cl) + 1.5 * eg('quest', v.cl);
      if (m.q + 1 === C.STORY_QUESTS) {
        event(C.STORY_XP_FRAC, v.cl);
        gear += 1.8 * eg('story', v.cl);
      }
      m.q += 1;
      hours = C.TIME_QUEST;
      afterFightHp(ctx, m, rt, dl);
      break;
    }
    case 'grind': {
      const maxW = opts.grindWaves || C.GRIND_MAX_WAVES;
      let value = 0;
      for (let w = 0; w < maxW; w++) {
        const dl = v.cl - m.L;
        const p = riskP(ctx.risk, 'grind', dl, m.hp);
        const save = { L: m.L, xp: m.xp, rested: m.rested, hp: m.hp, rations: m.rations, dh: m.dh };
        const p0 = bankedPos(m);
        const gd0 = gold;
        const ge0 = gear;
        kill(v.cl, 1, C.GRIND_WAVE_SIZE);
        event(C.GRIND_WAVE_XP_FRAC, v.cl);
        g(C.GRIND_WAVE_SIZE * C.MOB_COIN_V * vAt(v.cl));
        gear += C.GRIND_WAVE_SIZE * C.MOB_ITEM_CHANCE * C.GRIND_DROP_MULT * eg('mob', v.cl);
        const sm = styleMult(ctx, 'grind');
        const marginal = ((bankedPos(m) - p0) * BAL.VAL_XP + (gear - ge0) * BAL.VAL_GEAR + ((gold - gd0) / Vl) * BAL.VAL_GOLD) * sm
          - C.TIME_GRIND_WAVE * BAL.VAL_TIME * ctx.hourMult - p * BAL.VAL_DEATH - bossCost(ctx, m.dh, C.TIME_GRIND_WAVE);
        if (!opts.grindWaves && w > 0 && marginal <= 0) {
          gold = gd0; gear = ge0; Object.assign(m, save);
          break;
        }
        value += marginal;
        waves += 1;
        hours += C.TIME_GRIND_WAVE;
        m.dh += C.TIME_GRIND_WAVE;
        pDeath = 1 - (1 - pDeath) * (1 - p);
        afterFightHp(ctx, m, 'grind', dl);
        eatModel(m);
      }
      return { value, hours, pDeath, waves, state };
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
      gear += (1 - rareP) * eg('elite', M) + rareP * eg('rare', M);
      if (v.archetypes && v.archetypes.length > 1) {
        kill(v.cl, 1, 1);
        g(C.MOB_COIN_V * vAt(v.cl));
        gear += C.MOB_ITEM_CHANCE * eg('mob', v.cl);
      }
      hours = C.TIME_ELITE;
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
      gear += nTrash * C.DUNGEON_ITEM_CHANCE * eg('trash', T) + C.DUNGEON_BOSS_DROPS * eg('dboss', B);
      hours = C.TIME_DUNGEON;
      afterFightHp(ctx, m, 'dungeon', dl);
      break;
    }
    case 'rest': {
      const xn = xpNext(m.L);
      if (xn) m.rested = Math.min(C.RESTED_CAP_FRAC * xn, m.rested + C.REST_RESTED_FRAC * xn);
      m.hp = 1;
      hours = C.TIME_REST;
      break;
    }
    case 'treasure': {
      const dl = v.cl - m.L;
      if (v.guarded) {
        pDeath = riskP(ctx.risk, 'treasure', dl, m.hp);
        kill(v.cl, 1, 1);
        g(C.MOB_COIN_V * vAt(v.cl));
        gear += C.MOB_ITEM_CHANCE * eg('mob', v.cl);
        afterFightHp(ctx, m, 'treasure', dl);
      }
      const trapP = v.trap === true ? 1 : v.trap === false ? 0 : C.TREASURE_TRAP_CHANCE;
      m.hp = Math.max(0.02, m.hp - trapP * C.TREASURE_TRAP_PCT);
      g(C.TREASURE_GOLD_V * vAt(v.cl));
      gear += eg('treasure', v.cl);
      hours = C.TIME_TREASURE;
      break;
    }
    case 'shrine': {
      hours = C.TIME_SHRINE;
      const value = BOON_MEAN - hours * BAL.VAL_TIME * ctx.hourMult - bossCost(ctx, dh0, hours);
      m.dh = dh0 + hours;
      return { value, hours, pDeath: 0, waves: 0, state };
    }
    case 'vendor': {
      hours = C.TIME_VENDOR;
      // Vendor stock is not a drop table: no heat step (rules 1.7.3).
      gear += 1.5 * expGain(ctx, 'vendor', v.cl);
      break;
    }
    case 'trainer':
      hours = C.TIME_TRAINER;
      gear += trainerGain(ctx, m);
      break;
    default:
      hours = 1;
  }
  eatModel(m);
  const sm = styleMult(ctx, type);
  const value = ((bankedPos(m) - pos0) * BAL.VAL_XP + gear * BAL.VAL_GEAR + (gold / Vl) * BAL.VAL_GOLD) * sm
    - hours * BAL.VAL_TIME * ctx.hourMult - pDeath * BAL.VAL_DEATH - bossCost(ctx, dh0, hours);
  m.dh = dh0 + hours;
  return { value, hours, pDeath, waves, state };
}

/** Value of the hub Inn from model state m (mutates m like a Rest node). */
export function innValue(ctx, m) {
  return evalNode(ctx, m, { type: 'rest' }).value;
}

export const copyM = (m) => ({ L: m.L, xp: m.xp, rested: m.rested, hp: m.hp, q: m.q, rations: m.rations, tAt: m.tAt, dh: m.dh || 0 });

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
