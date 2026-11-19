// Legacy progression, phase 1 (D154-D155; docs/specs/legacy.md 1, 2, 4.1, 4.6, 5.1, draft for owner steering): the
// persistent hero per class on a version 3 profile, the power level of a hero level and the level shown for a power
// level, hero XP to the next level, the profile migration (Echoes become Legacy points; D160: the old hall refunded once), the zones' bands at the hero's
// level, the Camp's level, the zone tier's damage, the content and item level caps, and Oruvath's scaling (one function,
// oruvathScale, over the one constants block of legacy.md 2.4, so the Designer's rework of the fight replaces it in one
// place). Played only by a run created while C.GATES.legacy is on (newRun marks it: state.legacy); every helper here that
// takes a state reads that mark, never the switch, so a run keeps its rules to its end. Pure helpers; no import from
// another engine module but util.js, so every module can read them (nodes.js plays the run start and the bookkeeping).
import {
  GATES, CLASS_IDS, HERO_MAX_LEVEL, POWER_OF_LEVEL, HERO_XP, HERO_XP_AT_MAX, MAX_LEVEL, ZONE_TIER, ZONE_TIER_DMG, CL_MAX,
  ILVL_MAX, ILVL_MAX_HERO, CAMP_TIER, BOSS_TIER, BOSS_REF_LEVEL, BOSS_HP_LEVEL_BASE, BOSS_HP_LEVEL_STEP, ENEMY_HP_BASE,
  ENEMY_HP_PER_LEVEL, ENEMY_DMG_BASE, ENEMY_DMG_PER_LEVEL, ZONE_COUNT, ZONE_LEVELS, CONTRACT_CL_OFFSET,
  CONTRACT_CL_OFFSET_HERO, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MIN_HERO, META, CLASS, TALENT,
  BOSS_HP_LEVEL, BOSS_DMG_LEVEL_BASE, BOSS_DMG_LEVEL_STEP, BOSS_DMG_LEVEL_MIN, BOSS_DMG_LEVEL_MAX, SHARD_HP_LEVEL_LOW,
  SHARD_HP_RAMP_FROM, SHARD_HP_RAMP_TO, FINAL_DARK_LEVEL_STEP, FINAL_DARK_ROUND_MAX, BOSS_ENRAGE_ROUND, ZONE_DANGER_STEP,
  ZONE_DANGER_FROM, HERO_XP_ECON2, ZONE_LAG, LEGACY_PER_ZONE, LEGACY_PER_ZONE_HERO, LEGACY_PER_PREP_POINT,
  LEGACY_PER_PREP_POINT_HERO, META_HERO,
} from '../constants.js';
import { rnd, deepClone, clamp } from './util.js';

/** A Legacy run (legacy.md; GATES.legacy when newRun made the state). */
export const isLegacy = (s) => !!(s && s.legacy);
/**
 * D158: the D156 / D157 numbers (legacy.md 2.4.1-2.4.2, draft) are on: GATES.legacy and GATES.oruvathLegacy both on. The
 * class numbers (constants.js ORUVATH_SPELL, ORUVATH_TALENT getters) read the same two switches.
 */
export const legacyNumbersOn = () => !!(GATES.legacy && GATES.oruvathLegacy);
/** D158: the 2.4.1 boss rules apply to this run: a Legacy run (state.legacy) with both switches on; never a level-60 run. */
export const oruvathRules = (s) => isLegacy(s) && legacyNumbersOn();

/**
 * D159 (legacy.md 4.7 Economy v2, draft): the Economy v2 rules apply to this run: a Legacy run (state.legacy) with
 * GATES.economyV2 on; never a level-60 run (D158). Read at each use, as oruvathRules.
 */
export const econV2 = (s) => isLegacy(s) && !!GATES.economyV2;
/** legacy.md 4.7 E1: Legacy points per zone left in run s: LEGACY_PER_ZONE_HERO under Economy v2, else LEGACY_PER_ZONE. */
export const legacyPerZone = (s) => (econV2(s) ? LEGACY_PER_ZONE_HERO : LEGACY_PER_ZONE);
/** legacy.md 4.7 E1: Legacy points per camp point kept in run s: LEGACY_PER_PREP_POINT_HERO under Economy v2, else LEGACY_PER_PREP_POINT. */
export const legacyPerPrepPoint = (s) => (econV2(s) ? LEGACY_PER_PREP_POINT_HERO : LEGACY_PER_PREP_POINT);
/**
 * The Legacy hall a profile is sold (legacy.md 4.2, 4.7 E5): META_HERO for a version 3 profile while GATES.economyV2 is
 * on, else `fallback` (META). The run's meta effects (nodes.js metaFromProfile) read the same table.
 */
export const hallOf = (profile, fallback) => (profile && profile.v >= 3 && GATES.economyV2 ? META_HERO : fallback);

// ---------------- Levels (legacy.md 1.2-1.4) ----------------
/** Hero level H clamped to 1..HERO_MAX_LEVEL. */
const heroClamp = (H) => clamp(Math.round(H), 1, HERO_MAX_LEVEL);
/** The power level (the engine's 1-60 level) of hero level H: POWER_OF_LEVEL[H - 1]. */
export const powerOf = (H) => POWER_OF_LEVEL[heroClamp(H) - 1];
/** The hero level shown for power level M (legacy.md 1.2): 1 + round((M - 1) × (HERO_MAX_LEVEL - 1) / (MAX_LEVEL - 1)). */
export const shownLevelOf = (M) => 1 + rnd(((M - 1) * (HERO_MAX_LEVEL - 1)) / (MAX_LEVEL - 1));
/**
 * The first hero level whose power level reaches M (legacy.md 1.7: a spell of learn level M is trained at the run start
 * from that hero level on); HERO_MAX_LEVEL when no hero level reaches it. Unlike shownLevelOf (the nearest hero level),
 * never below the level that learns it: Shadowstep Strike (power 4) shows 3, not 2.
 */
export function learnHeroLevel(M) {
  for (let H = 1; H <= HERO_MAX_LEVEL; H++) if (POWER_OF_LEVEL[H - 1] >= M) return H;
  return HERO_MAX_LEVEL;
}
/** The highest hero level whose power level is at most M (at least 1): the dev tools' hero for a power level. */
export function heroLevelAt(M) {
  let H = 1;
  while (H < HERO_MAX_LEVEL && POWER_OF_LEVEL[H] <= M) H += 1;
  return H;
}
/** The hero XP table (legacy.md 1.4): HERO_XP_ECON2 while GATES.economyV2 is on (4.7 E4; heroes exist only in Legacy), else HERO_XP. */
export const heroXpTable = () => (GATES.economyV2 ? HERO_XP_ECON2 : HERO_XP);
/**
 * Hero XP from hero level H to H + 1 (heroXpTable()[H - 1]); at HERO_MAX_LEVEL the XP that pays one more LEGACY_PER_LEVEL
 * at the run's end (HERO_XP_AT_MAX, legacy.md 1.3).
 */
export const heroXpToNext = (H) => (heroClamp(H) < HERO_MAX_LEVEL ? heroXpTable()[heroClamp(H) - 1] : HERO_XP_AT_MAX);

// ---------------- The hero on the profile (legacy.md 1.1, 1.5-1.6) ----------------
/**
 * A new hero (legacy.md 1.1): level 1, no XP; talents, spells, spell order and action bar null until a run has set them
 * (the run start then plays the class's defaults); runs and wins counted at each run's end.
 */
export function newHero(classId, name = '') {
  return { classId, name: typeof name === 'string' ? name.trim().slice(0, 24) : '', level: 1, xp: 0, talents: null, spells: null, spellOrder: null, bar: null, runs: 0, wins: 0 };
}

/** The class's hero on a version 3 profile, or null (none made yet). */
export const heroOf = (profile, classId) => (profile && profile.heroes && profile.heroes[classId]) || null;

/**
 * The hero as the run's character has it now (legacy.md 1.5-1.6): name, level, hero XP, talents, known spells with their
 * training, spell order and action bar; runs and wins as the profile holds them (applyRunToProfile counts the run).
 */
export function heroRecord(s) {
  const p = s.player;
  const old = heroOf(s.profile, p.classId);
  return {
    classId: p.classId, name: p.name, level: p.heroLevel, xp: p.xp, talents: { ...p.talents }, spells: deepClone(p.spells),
    spellOrder: p.spellOrder.slice(), bar: p.bar.slice(), runs: old ? old.runs : 0, wins: old ? old.wins : 0,
  };
}

/**
 * The hero written to the run's profile (legacy.md 1.5: at every zone arrival and at the run's end), so a closed browser
 * loses at most the zone in progress: state.profile then holds it. Not in a dev run (its profile stays as it was).
 */
export function checkpointHero(s) {
  if (!isLegacy(s) || s.dev || !s.player || !s.profile || !s.profile.heroes) return;
  s.profile.heroes[s.player.classId] = heroRecord(s);
}

// ---------------- The profile (legacy.md 4.6) ----------------
/** The profile's spendable balance: Legacy points (version 3) or Echoes (version 1). */
export const balanceOf = (profile) => (profile && profile.v >= 3 ? profile.legacy || 0 : (profile && profile.echoes) || 0);
/** The name of the balance's field: 'legacy' (version 3) or 'echoes'. */
export const balanceKey = (profile) => (profile && profile.v >= 3 ? 'legacy' : 'echoes');

/**
 * A version 1 profile as a version 3 one (legacy.md 4.6): every Echo ever spent comes back (`legacy` = echoes + spent),
 * the catalogue's ranks are cleared except Packed Satchel (kept so the first-run nudge does not repeat; its price is not
 * refunded), the boss flags, runs, guide, welcome and Deathblow flags are kept; no hero yet (each is made at hero select,
 * at level 1). `earned` keeps every Echo earned. A version 3 profile gets its missing keys only. Pure.
 */
export function legacyProfile(profile) {
  const p = deepClone(profile);
  if (p.v >= 3) {
    if (typeof p.legacy !== 'number') p.legacy = 0;
    if (!p.heroes || typeof p.heroes !== 'object') p.heroes = {};
    for (const c of Object.keys(p.heroes)) if (!CLASS_IDS.includes(c) || !p.heroes[c]) delete p.heroes[c];
    return hallRefund(p);
  }
  const unlocks = p.unlocks || {};
  const satchel = (unlocks.satchel || 0) > 0;
  const paid = satchel ? Math.min(p.spent || 0, META.satchel.costs[0]) : 0;
  p.legacy = (p.echoes || 0) + (p.spent || 0) - paid;
  p.spent = paid;
  p.unlocks = satchel ? { satchel: 1 } : {};
  delete p.echoes;
  p.heroes = {};
  p.v = 3;
  return hallRefund(p);
}

/**
 * D160 (legacy.md 4.7 E5, draft): the first time a version 3 profile is read with GATES.economyV2 on, every Legacy point it
 * spent under the old catalogue comes back (`legacy` += `spent`, `spent` 0) and its purchases are cleared (`unlocks` {},
 * Packed Satchel included: the v2 hall sells it again); `hallV2` true marks the profile so it happens once. A profile made
 * or migrated with the switch on gets the mark at once (nothing of it was bought under the old catalogue). Off: unchanged.
 * Mutates and returns p (legacyProfile's own copy).
 */
function hallRefund(p) {
  if (!GATES.economyV2 || p.hallV2 === true) return p;
  p.legacy = (p.legacy || 0) + (p.spent || 0);
  p.spent = 0;
  p.unlocks = {};
  p.hallV2 = true;
  return p;
}

/** Profile keys while GATES.legacy is on: newProfile and migrateProfile give version 3 (legacy.md 4.6). */
export const legacyProfiles = () => !!GATES.legacy;

// ---------------- Zones (legacy.md 2.1-2.4) ----------------
/** The highest content level of the run (CL_MAX in a Legacy run, else MAX_LEVEL). */
export const clMax = (s) => (isLegacy(s) ? CL_MAX : MAX_LEVEL);
/** The highest item level of the run (ILVL_MAX_HERO in a Legacy run, else ILVL_MAX). */
export const ilvlMax = (s) => (isLegacy(s) ? ILVL_MAX_HERO : ILVL_MAX);
/** Gorrak's lowest level in the guided zone (legacy.md 5.1: ONB_ELITE_LEVEL_MIN_HERO in a Legacy run). */
export const onbEliteMin = (s) => (isLegacy(s) ? ONB_ELITE_LEVEL_MIN_HERO : ONB_ELITE_LEVEL_MIN);

/**
 * Zone z's band if the hero arrived now (legacy.md 2.1): clamp(P + ZONE_TIER[z - 1], 1, CL_MAX); under Economy v2 (4.7
 * E3) clamp(P + ZONE_TIER[z - 1] - round(ZONE_LAG[z - 1] × (P - 1)), 1, CL_MAX): zone 1 trails the hero.
 */
export function bandNow(s, z) {
  const i = clamp(z, 1, ZONE_COUNT) - 1;
  const P = s.player.level;
  const lag = econV2(s) ? rnd(ZONE_LAG[i] * (P - 1)) : 0;
  return clamp(P + ZONE_TIER[i] - lag, 1, CL_MAX);
}

/**
 * Zone z's band: in a Legacy run the band fixed at the hero's arrival (state.hero.bands; legacy.md 2.1), else, for a zone
 * not reached yet, the band at the hero's power level now (the contract board's estimate, 5.3); outside a Legacy run
 * the zone's first level, ZONE_LEVELS × (z - 1) + 1.
 */
export function zoneBand(s, z) {
  if (!isLegacy(s)) return ZONE_LEVELS * (z - 1) + 1;
  const b = s.hero && s.hero.bands ? s.hero.bands[z] : undefined;
  return b !== undefined && b !== null ? b : bandNow(s, z);
}

/**
 * The contract level CL_c of zone z (expedition.md 3.1; legacy.md 2.1, 5.3): in a Legacy run the zone's band +
 * CONTRACT_CL_OFFSET_HERO (set when the hero arrives; before, the estimate at the hero's level now), clamped at CL_MAX;
 * else ZONE_LEVELS × (z - 1) + CONTRACT_CL_OFFSET.
 */
export function contractLevelOf(s, z) {
  if (!isLegacy(s)) return ZONE_LEVELS * (z - 1) + CONTRACT_CL_OFFSET;
  return clamp(zoneBand(s, z) + CONTRACT_CL_OFFSET_HERO, 1, CL_MAX);
}

/** The Camp's level (legacy.md 2.4): the hero's power level at arrival + CAMP_TIER (state.hero.camp), clamped at CL_MAX. */
export const campLevelNow = (s) => clamp(s.player.level + CAMP_TIER, 1, CL_MAX);

/**
 * legacy.md 4.7 E2: the level Z an XP award is counted against: at the Camp and in Oruvath's fight the Camp's level
 * (state.hero.camp, fixed at arrival); in zone z its band (state.hero.bands[z], fixed at arrival; zoneBand); where there
 * is no zone the hero's power level.
 */
export function xpRef(s) {
  const z = s.zone;
  if (z && z.camp) return s.hero && s.hero.camp ? s.hero.camp : campLevelNow(s);
  if (z && Number.isInteger(z.z)) return zoneBand(s, z.z);
  return s.player.level;
}

/**
 * legacy.md 4.7 E7 (D161): an XP award in run s is a Camp wave's (its kills and its wave bonus) and takes the Camp's
 * level-gap falloff: at the Camp, outside Oruvath's fight (whose Shards and adds pay as E2).
 */
export const campWaveXp = (s) => !!(s.zone && s.zone.camp) && !(s.fight && s.fight.kind === 'boss');

/**
 * × the damage of a template enemy of a fight in zone z (legacy.md 2.2): ZONE_TIER_DMG[z - 1] for zones 1-6, zone 6's at
 * the Camp (z = ZONE_COUNT + 1); 1 outside a Legacy run.
 */
/** legacy.md 2.2: × the damage of every template enemy of zone z in a Legacy run (ZONE_TIER_DMG; the Camp, z 7: zone 6's), else 1. */
export const zoneTierDmg = (s, z) => (isLegacy(s) ? ZONE_TIER_DMG[clamp(z, 1, ZONE_COUNT) - 1] : 1);

// ---------------- Oruvath (legacy.md 2.4; one place for the Designer's rework) ----------------
/**
 * Oruvath's numbers at the hero's level (legacy.md 2.4), for FIGHT_BOSS: { level LB = P + BOSS_TIER (at most CL_MAX), hp
 * (× his and the Shards' HP: hpScale(LB) × min(1, BOSS_HP_LEVEL_BASE + BOSS_HP_LEVEL_STEP × H)), dmg (× every damage of
 * the fight: dmgScale(LB)), armor (× BOSS_ARMOR: LB / BOSS_REF_LEVEL), shardLevel (LB - 2) }, with hpScale(M) = (ENEMY_HP_BASE
 * + ENEMY_HP_PER_LEVEL × M) / (the same at BOSS_REF_LEVEL), the normal enemy curve, and dmgScale(M) the same ratio for a
 * normal enemy's damage with zone danger. `danger` is the zone danger function (combat.js zoneDanger), passed in so this
 * module imports no other engine module. P and H: the hero's power and hero level when the fight starts. null outside a
 * Legacy run (the fight as tuned at BOSS_LEVEL). Under GATES.oruvathLegacy (D156; D158: oruvathRules, GATES.legacy on as
 * well) the numbers of 2.4.1: oruvathScale241.
 */
export function oruvathScale(s, danger) {
  if (!isLegacy(s)) return null;
  const p = s.player;
  const LB = Math.min(CL_MAX, p.level + BOSS_TIER);
  const hpAt = (M) => ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL * M;
  if (oruvathRules(s)) return oruvathScale241(p, LB, hpAt);
  const dmgAt = (M) => (ENEMY_DMG_BASE + ENEMY_DMG_PER_LEVEL * M) * danger(M, 'normal');
  const hpLevel = Math.min(1, BOSS_HP_LEVEL_BASE + BOSS_HP_LEVEL_STEP * p.heroLevel);
  return { level: LB, hp: (hpAt(LB) / hpAt(BOSS_REF_LEVEL)) * hpLevel, dmg: dmgAt(LB) / dmgAt(BOSS_REF_LEVEL), armor: LB / BOSS_REF_LEVEL, shardLevel: LB - 2 };
}

/** legacy.md 2.4.1 item 3: × the Shards' HP by hero level (SHARD_HP_LEVEL_LOW to RAMP_FROM, linear to 1 at RAMP_TO). */
export function shardHpLevel(H) {
  const h = heroClamp(H);
  if (h <= SHARD_HP_RAMP_FROM) return SHARD_HP_LEVEL_LOW;
  return Math.min(1, SHARD_HP_LEVEL_LOW + ((1 - SHARD_HP_LEVEL_LOW) * (h - SHARD_HP_RAMP_FROM)) / (SHARD_HP_RAMP_TO - SHARD_HP_RAMP_FROM));
}
/** legacy.md 2.4.1 item 2: × every damage of Oruvath's fight by hero level, BASE - STEP × H between MIN and MAX. */
export const bossDmgLevel = (H) => Math.max(BOSS_DMG_LEVEL_MIN, Math.min(BOSS_DMG_LEVEL_MAX, BOSS_DMG_LEVEL_BASE - BOSS_DMG_LEVEL_STEP * heroClamp(H)));
/** legacy.md 2.4.1 item 4: Final Dark's round by hero level, BOSS_ENRAGE_ROUND + round(STEP × (25 - H)), at most ROUND_MAX. */
export const finalDarkRound = (H) => Math.min(FINAL_DARK_ROUND_MAX, BOSS_ENRAGE_ROUND + rnd(FINAL_DARK_LEVEL_STEP * (HERO_MAX_LEVEL - heroClamp(H))));
/** legacy.md 2.4.1 item 2: the normal enemy damage curve with zone danger, without the early factors (smooth in level). */
const dmg0At = (M) => (ENEMY_DMG_BASE + ENEMY_DMG_PER_LEVEL * M) * (1 + (ZONE_DANGER_STEP * Math.max(0, M - ZONE_DANGER_FROM)) / 10);

/**
 * oruvathScale under GATES.oruvathLegacy (legacy.md 2.4.1, D156, draft): hp hpScale(LB) × BOSS_HP_LEVEL[H - 1], dmg
 * dmgScale0(LB) × bossDmgLevel(H), armor and shardLevel as 2.4, plus shardHp (× the Shards' HP after the HP scale) and
 * finalDark (Final Dark's round; boss.js reads it from the fight).
 */
function oruvathScale241(p, LB, hpAt) {
  const H = heroClamp(p.heroLevel);
  return {
    level: LB,
    hp: (hpAt(LB) / hpAt(BOSS_REF_LEVEL)) * BOSS_HP_LEVEL[H - 1],
    dmg: (dmg0At(LB) / dmg0At(BOSS_REF_LEVEL)) * bossDmgLevel(H),
    armor: LB / BOSS_REF_LEVEL,
    shardLevel: LB - 2,
    shardHp: shardHpLevel(H),
    finalDark: finalDarkRound(H),
  };
}

// ---------------- Views (legacy.md 1.1-1.4; engine-api.md 15) ----------------
/**
 * The run's hero for the HUD and the summary, null outside a Legacy run: { classId, level (1-25), xp, xpToNext (hero XP
 * of this level; at 25 the XP that pays LEGACY_PER_LEVEL), atMax, power (the engine's level), start { level, xp }, gained
 * (hero levels gained this run, with each HERO_XP_AT_MAX at 25) }.
 */
export function heroView(s) {
  if (!isLegacy(s) || !s.player) return null;
  const p = s.player;
  const h = s.hero || {};
  return {
    classId: p.classId, level: p.heroLevel, xp: p.xp, xpToNext: heroXpToNext(p.heroLevel), atMax: p.heroLevel >= HERO_MAX_LEVEL,
    power: p.level, start: h.start ? { ...h.start } : null, gained: (h.gained || 0) + (h.over || 0),
  };
}

/**
 * Hero select (legacy.md 1.1): one entry per class in CLASS_IDS order: null (no hero yet: "New hero"), else { classId,
 * className, name, level, xp, xpToNext, power, runs, wins, talents (points per tree), tree (the tree with the most points,
 * null without any) }.
 */
export function heroesView(profile) {
  return CLASS_IDS.map((c) => {
    const h = heroOf(profile, c);
    if (!h) return null;
    const perTree = [0, 0, 0];
    for (const [id, r] of Object.entries(h.talents || {})) if (TALENT[id]) perTree[TALENT[id].tree] += r;
    const top = Math.max(...perTree);
    return {
      classId: c, className: CLASS[c].name, name: h.name, level: h.level, xp: h.xp, xpToNext: heroXpToNext(h.level),
      power: powerOf(h.level), runs: h.runs || 0, wins: h.wins || 0, talents: perTree, tree: top > 0 ? CLASS[c].trees[perTree.indexOf(top)] : null,
    };
  });
}
