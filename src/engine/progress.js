// XP, levels, rested pool, talent points, gold income (rules 2.5, 4.3, 4.4, 6, 8.5); heat's XP and gold multiplier
// (rules 1.7.3); contract XP without the level-difference modifier (expedition.md 3.1, M2b v10: flatXp). Legacy (D154,
// legacy.md 1.2-1.4; a run made under GATES.legacy): every award in hero XP (HERO_XP_UNIT per level-equivalent at the
// hero's power level), the rested pool in hero XP, and the hero's levels (HERO_XP; a level-up raises the power level to
// POWER_OF_LEVEL[H]; past HERO_MAX_LEVEL each HERO_XP_AT_MAX counts for the run's Legacy level line). Economy v2 (D159,
// legacy.md 4.7 E2, draft; legacy.js econV2): a Legacy award is counted against the level of the place it is earned
// (legacy.js xpRef), × (1 + XP_ZONE_STEP × max(0, CL - Z)), no xpCurve ratio and no diffMod; contracts at
// CONTRACT_CL_OFFSET_HERO. Camp waves (4.7 E7, D161; legacy.js campWaveXp) also × min(1, diffMod(Z - L)), the rules 4.4
// level-gap falloff against the Camp's level Z, so a hero past the Camp's level earns little there.
import {
  XP_A, XP_B, XP_C, MAX_LEVEL, XP_DIFF_STEP, XP_DIFF_MAX, XP_DIFF_SOFT_FLOOR, XP_DIFF_FALL, XP_GREY_DIFF,
  XP_GREY_MOD, RESTED_MULT, RESTED_CAP_FRAC, TALENT_FIRST_LEVEL, TALENT_LEVEL_STEP, BOON_XP_PCT, HEAT_GAIN,
  HERO_XP_UNIT, HERO_MAX_LEVEL, HERO_XP_AT_MAX, XP_ZONE_STEP, CONTRACT_CL_OFFSET_HERO,
} from '../constants.js';
import { rnd, flr } from './util.js';
import { refreshDerived } from './stats.js';
import { isLegacy, powerOf, heroXpToNext, econV2, xpRef, campWaveXp, heroCap, demoCapped } from './legacy.js';

/** The levelling polynomial XP_A×L² + XP_B×L + XP_C (rules 4.3), defined for any level (event XP at CL 60). */
export function xpCurve(L) {
  return XP_A * L * L + XP_B * L + XP_C;
}

/** XP needed from level L to L+1 (rules 4.3). 0 at MAX_LEVEL (no XP is gained there). */
export function xpToNext(L) {
  if (L >= MAX_LEVEL) return 0;
  return xpCurve(L);
}

/** XP level-difference modifier, d = content level - character level (rules 4.4). */
export function diffMod(d) {
  if (d >= XP_DIFF_SOFT_FLOOR) return Math.min(XP_DIFF_MAX, 1 + XP_DIFF_STEP * d);
  if (d > XP_GREY_DIFF) return 1 + XP_DIFF_STEP * XP_DIFF_SOFT_FLOOR - XP_DIFF_FALL * (XP_DIFF_SOFT_FLOOR - d);
  return XP_GREY_MOD;
}

/**
 * Talent points earned by level L (rules 6), plus meta Ancestral Insight at MAX_LEVEL, plus the points a dev tool gave
 * (debug.give, engine-api.md 12; dev runs only).
 */
export function talentPointsEarned(s, L = s.player.level) {
  const base = L >= TALENT_FIRST_LEVEL ? flr((L - TALENT_FIRST_LEVEL) / TALENT_LEVEL_STEP) + 1 : 0;
  return base + (L >= MAX_LEVEL ? s.meta.talentPoints : 0) + (s.dev ? s.dev.talentPoints : 0);
}

export function talentPointsFree(s) {
  return talentPointsEarned(s) - s.player.talentSpent;
}

/** Percentage XP modifiers (Boon of Insight while active, meta Quick Study). */
export function xpPct(s) {
  return (s.player.buffs.insight && s.player.buffs.insight.active ? BOON_XP_PCT : 0) + s.meta.xpPct;
}

/**
 * XP for an event (rules 4.4): round(frac × xpToNext(CL) × diffMod(CL - L) × (1 + xpPctMods)). Legacy (legacy.md 1.3): in
 * hero XP, round(HERO_XP_UNIT × frac × xpCurve(CL) / xpCurve(L) × diffMod(CL - L) × (1 + xpPctMods)), CL and L power
 * levels, at every hero level (XP keeps counting at HERO_MAX_LEVEL). Economy v2 (legacy.md 4.7 E2): round(HERO_XP_UNIT ×
 * frac × (1 + XP_ZONE_STEP × max(0, CL - Z)) × (1 + xpPctMods)), Z = xpRef(s), the level of the place it is earned; a Camp
 * wave's award (4.7 E7, D161) × campFalloff(s).
 */
export function eventXp(s, frac, cl) {
  const L = s.player.level;
  if (econV2(s)) {
    const Z = xpRef(s);
    return rnd(HERO_XP_UNIT * frac * (1 + XP_ZONE_STEP * Math.max(0, cl - Z)) * campFalloff(s, Z) * (1 + xpPct(s)));
  }
  if (isLegacy(s)) return rnd((HERO_XP_UNIT * frac * xpCurve(cl) * diffMod(cl - L) * (1 + xpPct(s))) / xpCurve(L));
  if (L >= MAX_LEVEL) return 0;
  return rnd(frac * xpCurve(cl) * diffMod(cl - L) * (1 + xpPct(s)));
}

/**
 * legacy.md 4.7 E7 (D161): × a Camp wave's XP under Economy v2: min(1, diffMod(Z - L)), Z the Camp's level (fixed at
 * arrival), L the hero's power level now. 1 up to the Camp's level, then the rules 4.4 falloff (0.95, 0.90, 0.70, 0.50,
 * 0.30 at 1-5 power levels past it, XP_GREY_MOD 0.10 from XP_GREY_DIFF); 1 for every other award.
 */
export function campFalloff(s, Z = xpRef(s)) {
  return econV2(s) && campWaveXp(s) ? Math.min(1, diffMod(Z - s.player.level)) : 1;
}

/**
 * XP of an event without the level-difference modifier (expedition.md 3.1, M2b v10: contracts, as the retired story
 * chain): round(frac × xpToNext(CL) × (1 + xpPctMods)); 0 at MAX_LEVEL. Contract levels are at most 58, where xpToNext
 * and xpCurve agree. Legacy: in hero XP, round(HERO_XP_UNIT × frac × xpCurve(CL) / xpCurve(L) × (1 + xpPctMods)).
 * Economy v2 (legacy.md 4.7 E2): CL - Z is CONTRACT_CL_OFFSET_HERO at every level, so round(HERO_XP_UNIT × frac × (1 +
 * XP_ZONE_STEP × CONTRACT_CL_OFFSET_HERO) × (1 + xpPctMods)) whatever cl (the board's pay line is exact).
 */
export function flatXp(s, frac, cl) {
  if (econV2(s)) return rnd(HERO_XP_UNIT * frac * (1 + XP_ZONE_STEP * CONTRACT_CL_OFFSET_HERO) * (1 + xpPct(s)));
  if (isLegacy(s)) return rnd((HERO_XP_UNIT * frac * xpCurve(cl) * (1 + xpPct(s))) / xpCurve(s.player.level));
  if (s.player.level >= MAX_LEVEL) return 0;
  return rnd(frac * xpCurve(cl) * (1 + xpPct(s)));
}

/**
 * Heat (rules 1.7.3): extra XP and gold of everything the current node pays, HEAT_GAIN of the state it was entered in;
 * 0 outside such a node (hub services, walks, travel, the Camp, the boss, a Dimmed encounter).
 */
export const heatGain = (s) => (s.node && s.node.heat ? HEAT_GAIN[s.node.heat] : 0);

/**
 * Give XP. kill = true applies the rested doubling (rules 2.5): XP × RESTED_MULT, the extra paid from the pool.
 * Then heat (rules 1.7.3): × (1 + heatGain), after every other modifier; the `xp` event's `heat` is the extra.
 * Handles level-ups (rules 4.3): carry-over, max HP/mana rise and current values rise by the same amount.
 */
export function gainXp(s, ev, amount, why, kill = false) {
  const p = s.player;
  const hero = isLegacy(s);
  if ((!hero && p.level >= MAX_LEVEL) || amount <= 0) return 0;
  // demo.md 3.1: at the demo's cap the XP is not counted (no rested XP spent); the event says so (`capped`, amount 0)
  if (hero && demoCapped(s)) { ev.push({ t: 'xp', amount: 0, rested: 0, why, capped: true }); return 0; }
  let rested = 0;
  if (kill && p.rested > 0) {
    rested = Math.min(p.rested, amount * (RESTED_MULT - 1));
    p.rested -= rested;
  }
  const base = amount + rested;
  const g = heatGain(s);
  const total = g > 0 ? rnd(base * (1 + g)) : base;
  p.xp += total;
  s.stats.xpGained += total;
  ev.push(total > base ? { t: 'xp', amount: total, rested, why, heat: total - base } : { t: 'xp', amount: total, rested, why });
  if (hero) {
    heroLevelUps(s, ev);
    return total;
  }
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    const before = p.d;
    const hp0 = p.hp;
    const mana0 = p.mana;
    const pet0 = p.pet ? p.pet.hp : 0;
    p.level += 1;
    const d = refreshDerived(s);
    p.hp += d.maxHp - before.maxHp;
    p.mana += d.maxMana - before.maxMana;
    if (p.pet && p.pet.alive) p.pet.hp = Math.max(1, p.pet.hp + (d.petMaxHp - before.petMaxHp));
    s.stats.levelUps += 1;
    const gotPoint = talentPointsEarned(s, p.level) > talentPointsEarned(s, p.level - 1);
    // Current HP, mana and pet HP rise by the max gains (rules 4.3); the event carries the gains and new maxima.
    ev.push({
      t: 'levelUp', level: p.level, talentPoint: gotPoint,
      hpGain: p.hp - hp0, manaGain: p.mana - mana0, petHpGain: p.pet ? p.pet.hp - pet0 : 0,
      maxHp: d.maxHp, maxMana: d.maxMana, petMaxHp: p.pet ? d.petMaxHp : 0,
    });
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return total;
}

/**
 * The hero's level-ups after XP (legacy.md 1.3-1.4): while the hero XP reaches HERO_XP of its level, the hero levels up
 * (carry-over), the power level becomes POWER_OF_LEVEL[H] (2 or 3 levels at once; max HP, mana and pet HP rise and the
 * current values by the same amount, rules 4.3) and a `levelUp` event { level (power), heroLevel, talentPoint,
 * talentPoints (points the step gave), ... } follows; at HERO_MAX_LEVEL every HERO_XP_AT_MAX is one more line of
 * LEGACY_PER_LEVEL at the run's end (state.hero.over; event `heroMax` { over }). XP is never lost.
 */
function heroLevelUps(s, ev) {
  const p = s.player;
  const cap = heroCap(s); // demo.md 3.1: HERO_MAX_DEMO in a demo run
  while (p.heroLevel < cap && p.xp >= heroXpToNext(p.heroLevel)) {
    p.xp -= heroXpToNext(p.heroLevel);
    const before = p.d;
    const hp0 = p.hp;
    const mana0 = p.mana;
    const pet0 = p.pet ? p.pet.hp : 0;
    const L0 = p.level;
    p.heroLevel += 1;
    p.level = powerOf(p.heroLevel);
    const d = refreshDerived(s);
    p.hp += d.maxHp - before.maxHp;
    p.mana += d.maxMana - before.maxMana;
    if (p.pet && p.pet.alive) p.pet.hp = Math.max(1, p.pet.hp + (d.petMaxHp - before.petMaxHp));
    s.stats.levelUps += 1;
    s.hero.gained += 1;
    const points = talentPointsEarned(s, p.level) - talentPointsEarned(s, L0);
    ev.push({
      t: 'levelUp', level: p.level, heroLevel: p.heroLevel, talentPoint: points > 0, talentPoints: points,
      hpGain: p.hp - hp0, manaGain: p.mana - mana0, petHpGain: p.pet ? p.pet.hp - pet0 : 0,
      maxHp: d.maxHp, maxMana: d.maxMana, petMaxHp: p.pet ? d.petMaxHp : 0,
      ...(s.demo && p.heroLevel >= cap ? { cap: 'demo' } : {}), // demo.md 3.1: the level-up to the demo's highest level
    });
  }
  if (demoCapped(s)) { p.xp = 0; return; } // demo.md 3.1: at the demo's cap the XP stays 0 into the next level
  while (p.heroLevel >= HERO_MAX_LEVEL && p.xp >= HERO_XP_AT_MAX) {
    p.xp -= HERO_XP_AT_MAX;
    s.hero.over += 1;
    ev.push({ t: 'heroMax', over: s.hero.over });
  }
}

/** Add rested XP, capped (rules 2.5). Legacy (legacy.md 1.3): a level is HERO_XP_UNIT hero XP (the pool's 60, cap 150). */
export function addRested(s, fracOfLevel) {
  const p = s.player;
  const need = isLegacy(s) ? HERO_XP_UNIT : xpToNext(p.level);
  if (!need) return;
  p.rested = Math.min(rnd(RESTED_CAP_FRAC * need), p.rested + rnd(fracOfLevel * need));
}

/**
 * Gold found (kills, rewards, boons). Meta Prospector applies, then heat (rules 1.7.3): × (1 + heatGain); the `gold`
 * event's `heat` is the extra. Selling uses addGoldRaw (no Prospector, no heat).
 */
export function gainGold(s, ev, copper, why) {
  const base = rnd(copper * (1 + s.meta.goldPct));
  if (base <= 0) return 0;
  const g = heatGain(s);
  const amount = g > 0 ? rnd(base * (1 + g)) : base;
  s.player.gold += amount;
  s.stats.goldEarned += amount;
  ev.push(amount > base ? { t: 'gold', amount, why, heat: amount - base } : { t: 'gold', amount, why });
  return amount;
}

export function addGoldRaw(s, ev, copper, why) {
  s.player.gold += copper;
  s.stats.goldEarned += copper;
  ev.push({ t: 'gold', amount: copper, why });
}

export function spendGold(s, ev, copper, why) {
  s.player.gold -= copper;
  s.stats.goldSpent += copper;
  ev.push({ t: 'gold', amount: -copper, why });
}
