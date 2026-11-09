// Character stats and derived values (rules 4.1, 4.2, 5.5 pet values).
import {
  CLASS, PET, SLOT_IDS, HP_PER_STA, POWER_PER_PRIMARY, RATING_K, RATING_C, CRIT_BASE, CRIT_FROM_PRIMARY,
  CRIT_CAP, CRIT_MULT, DODGE_CAP, MANA_BASE, MANA_PER_LEVEL, MANA_PER_INT, POST_FIGHT_REGEN_BASE,
  POST_FIGHT_REGEN_SPI, REGEN_SPI_K, REGEN_SPI_C, PET_DMG_BASE, PET_DMG_PER_LEVEL, PET_DMG_POWER, TALENT,
} from '../constants.js';
import { rnd } from './util.js';

export const rating = (L) => RATING_K * L + RATING_C;

/** Talent rank owned (0 if none). */
export function tr(s, id) {
  return s.player.talents[id] || 0;
}

/** Base value of a stat at level L (no items, no mods). */
export function baseStat(classId, stat, L) {
  const [b, g] = CLASS[classId].stats[stat];
  return b + g * (L - 1);
}

/** Base mana (Mage cost basis, rules 4.2): no items, no mods. */
export function baseMana(classId, L) {
  return rnd(MANA_BASE + MANA_PER_LEVEL * (L - 1) + MANA_PER_INT * baseStat(classId, 'INT', L));
}

/**
 * Recompute derived values into s.player.d. Call after level, gear, talent, meta or pet changes.
 * Combat-only modifiers (EVASION, buffs) are applied in the damage pipeline, not here.
 */
export function refreshDerived(s) {
  const p = s.player;
  const cls = CLASS[p.classId];
  const L = p.level;
  const st = { STA: 0, AGI: 0, INT: 0, SPI: 0 };
  for (const k of Object.keys(st)) st[k] = baseStat(p.classId, k, L);
  let itemPower = 0;
  let itemCrit = 0;
  let itemArmor = 0;
  let affixArmor = 0;
  let wd = 0;
  const effects = [];
  for (const slot of SLOT_IDS) {
    const it = p.equipped[slot];
    if (!it) continue;
    for (const k of Object.keys(st)) st[k] += it.stats[k];
    itemPower += it.power;
    itemCrit += it.crit;
    itemArmor += it.armor;
    affixArmor += it.bonusArmor;
    if (slot === 'weapon') wd = it.wd;
    if (it.effect) effects.push(it.effect);
  }
  const primary = st[cls.primary];
  const m = s.meta;
  const hpPct = tr(s, 'm_b2') * TALENT.m_b2.hpPct + tr(s, 'h_c1') * TALENT.h_c1.hpPct + m.hpPct;
  const maxHp = rnd((cls.hpBase + cls.hpPerLevel * (L - 1) + HP_PER_STA * st.STA) * (1 + hpPct));
  const powerPct = tr(s, 'm_c2') * TALENT.m_c2.powerPct + m.powerPct;
  const power = (POWER_PER_PRIMARY * primary + itemPower) * (1 + powerPct);
  const R = rating(L);
  const talentCrit = tr(s, 'r_a1') * TALENT.r_a1.crit + tr(s, 'h_b2') * TALENT.h_b2.crit;
  const crit = Math.min(CRIT_CAP, CRIT_BASE + (CRIT_FROM_PRIMARY * primary) / R + itemCrit + talentCrit + m.crit);
  const critMult = CRIT_MULT + tr(s, 'r_a5') * TALENT.r_a5.critMult + tr(s, 'h_b4') * TALENT.h_b4.critMult;
  const talentDodge = tr(s, 'r_b2') * TALENT.r_b2.dodge + tr(s, 'h_c5') * TALENT.h_c5.dodge;
  const dodge = Math.min(DODGE_CAP, cls.dodgeBase + (cls.dodgeFromAgi * st.AGI) / R + talentDodge);
  const armor = cls.armorBase + cls.armorPerLevel * (L - 1) + cls.armorMult * itemArmor + affixArmor;
  let maxMana = 0;
  if (cls.resource === 'mana') {
    const manaPct = tr(s, 'm_c1') * TALENT.m_c1.manaPct;
    maxMana = rnd((MANA_BASE + MANA_PER_LEVEL * (L - 1) + MANA_PER_INT * st.INT) * (1 + manaPct));
  }
  const regenPct = POST_FIGHT_REGEN_BASE + (POST_FIGHT_REGEN_SPI * st.SPI) / (st.SPI + REGEN_SPI_K * L + REGEN_SPI_C);
  const d = {
    STA: st.STA, AGI: st.AGI, INT: st.INT, SPI: st.SPI, primary, maxHp, power, crit, critMult, dodge, armor,
    maxMana, baseMana: cls.resource === 'mana' ? baseMana(p.classId, L) : 0, wd, regenPct, effects,
  };
  if (p.pet) {
    const pet = PET[p.pet.id];
    d.petMaxHp = rnd(pet.hpPct * maxHp * (1 + tr(s, 'h_a1') * TALENT.h_a1.petHpPct));
    d.petArmor = armor * pet.armorMult;
    d.petDmg = (PET_DMG_BASE + PET_DMG_PER_LEVEL * L + PET_DMG_POWER * power) * pet.dmgMult;
    d.petCrit = crit + pet.critBonus + tr(s, 'h_a4') * TALENT.h_a4.petCrit;
  }
  p.d = d;
  return d;
}

export function hasEffect(s, effect) {
  return s.player.d.effects.filter((e) => e === effect).length;
}
