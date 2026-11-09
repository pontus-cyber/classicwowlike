// XP, levels, rested pool, talent points, gold income (rules 2.5, 4.3, 4.4, 6, 8.5).
import {
  XP_A, XP_B, XP_C, MAX_LEVEL, XP_DIFF_STEP, XP_DIFF_MAX, XP_DIFF_SOFT_FLOOR, XP_DIFF_FALL, XP_GREY_DIFF,
  XP_GREY_MOD, RESTED_MULT, RESTED_CAP_FRAC, TALENT_FIRST_LEVEL, TALENT_LEVEL_STEP, BOON_XP_PCT,
} from '../constants.js';
import { rnd, flr } from './util.js';
import { refreshDerived } from './stats.js';

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

/** Talent points earned by level L (rules 6), plus meta Ancestral Insight at MAX_LEVEL. */
export function talentPointsEarned(s, L = s.player.level) {
  const base = L >= TALENT_FIRST_LEVEL ? flr((L - TALENT_FIRST_LEVEL) / TALENT_LEVEL_STEP) + 1 : 0;
  return base + (L >= MAX_LEVEL ? s.meta.talentPoints : 0);
}

export function talentPointsFree(s) {
  return talentPointsEarned(s) - s.player.talentSpent;
}

/** Percentage XP modifiers (Boon of Insight while active, meta Quick Study). */
export function xpPct(s) {
  return (s.player.buffs.insight && s.player.buffs.insight.active ? BOON_XP_PCT : 0) + s.meta.xpPct;
}

/** XP for an event (rules 4.4): round(frac × xpToNext(CL) × diffMod(CL - L) × (1 + xpPctMods)). */
export function eventXp(s, frac, cl) {
  const L = s.player.level;
  if (L >= MAX_LEVEL) return 0;
  return rnd(frac * xpCurve(cl) * diffMod(cl - L) * (1 + xpPct(s)));
}

/**
 * Give XP. kill = true applies the rested doubling (rules 2.5): XP × RESTED_MULT, the extra paid from the pool.
 * Handles level-ups (rules 4.3): carry-over, max HP/mana rise and current values rise by the same amount.
 */
export function gainXp(s, ev, amount, why, kill = false) {
  const p = s.player;
  if (p.level >= MAX_LEVEL || amount <= 0) return 0;
  let rested = 0;
  if (kill && p.rested > 0) {
    rested = Math.min(p.rested, amount * (RESTED_MULT - 1));
    p.rested -= rested;
  }
  const total = amount + rested;
  p.xp += total;
  s.stats.xpGained += total;
  ev.push({ t: 'xp', amount: total, rested, why });
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    const before = p.d;
    p.level += 1;
    const d = refreshDerived(s);
    p.hp += d.maxHp - before.maxHp;
    p.mana += d.maxMana - before.maxMana;
    if (p.pet && p.pet.alive) p.pet.hp = Math.max(1, p.pet.hp + (d.petMaxHp - before.petMaxHp));
    s.stats.levelUps += 1;
    const gotPoint = talentPointsEarned(s, p.level) > talentPointsEarned(s, p.level - 1);
    ev.push({ t: 'levelUp', level: p.level, talentPoint: gotPoint });
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return total;
}

/** Add rested XP, capped (rules 2.5). */
export function addRested(s, fracOfLevel) {
  const p = s.player;
  const need = xpToNext(p.level);
  if (!need) return;
  p.rested = Math.min(rnd(RESTED_CAP_FRAC * need), p.rested + rnd(fracOfLevel * need));
}

/** Gold found (kills, rewards, boons). Meta Prospector applies. Selling uses addGoldRaw. */
export function gainGold(s, ev, copper, why) {
  const amount = rnd(copper * (1 + s.meta.goldPct));
  if (amount <= 0) return 0;
  s.player.gold += amount;
  s.stats.goldEarned += amount;
  ev.push({ t: 'gold', amount, why });
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
