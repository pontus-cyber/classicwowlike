// Meta progression (rules 11): profile, catalogue purchases, Echoes per run (a dev run leaves the profile as it was,
// engine-api.md 12; prep, expedition.md 8.1: the lines of contracts completed and Reserve left). M3 onboarding
// (m3-onboarding.md 4.2, E6): the profile's `guide` and `welcome`, their migration, setGuide, and the welcome line. M3 v3
// (D153, changes-m3-v3.md 4): the profile's `deathblowMet`, per class. Legacy (D154, legacy.md 1.1, 4.1, 4.6; GATES.legacy,
// draft): the version 3 profile (Legacy points in `legacy`, one hero per class in `heroes`), the migration of a version 1
// profile, the level line LEGACY_PER_LEVEL a hero level gained, and the hero written back at the run's end. The lines are
// the LEGACY_* constants (the Echo lines renamed, same values). Economy v2 (D159, legacy.md 4.7 E1 and E5, draft;
// GATES.economyV2): a Legacy run's camp points kept pay nothing (no line `reserve`) and a zone left pays
// LEGACY_PER_ZONE_HERO; a version 3 profile is sold the hall of META_HERO (legacy.js hallOf).
import {
  META, CLASS_IDS, ECHO_PER_LEVEL, LEGACY_PER_ZONE, LEGACY_PER_DUNGEON, LEGACY_PER_ELITE, LEGACY_PER_RARE, LEGACY_PER_QUEST,
  LEGACY_BOSS_REACHED, LEGACY_BOSS_PHASE, LEGACY_BOSS_KILL, LEGACY_SPEED_BONUS, LEGACY_FIRST_KILL_CLASS, LEGACY_OATH_BONUS,
  BOSS_TIME_PAR, OATH_HASTE_TIME, LEGACY_PER_HEAT_FIGHT, LEGACY_CONTRACT_MULT, LEGACY_PER_PREP_POINT, LEGACY_WELCOME,
  ONB_GUIDE_STATES, LEGACY_PER_LEVEL, LEGACY_PER_ZONE_HERO,
} from '../constants.js';
import { IllegalActionError, deepClone, rnd } from './util.js';
import { hash32 } from '../rng.js';
import { legacyProfile, legacyProfiles, balanceOf, balanceKey, heroOf, hallOf } from './legacy.js';

/**
 * Boss time par in tolls (rules 1.7, 11.5): BOSS_TIME_PAR, OATH_HASTE_TIME less under the Oath of Haste. Ascendancy
 * counts the tolls past it; the Echoes speed bonus needs a kill at or under it.
 */
export function parTime(oaths) {
  return BOSS_TIME_PAR - (oaths && oaths.includes('haste') ? OATH_HASTE_TIME : 0);
}

/**
 * A fresh profile (no unlocks). Plain JSON; the front end stores it. M3 (m3-onboarding.md E6): `guide` 'todo' (the next
 * run is offered as the guided run), `welcome` false (the first non-dev run's summary pays ONB_WELCOME_ECHOES). Legacy
 * (GATES.legacy; legacy.md 4.6): version 3, Legacy points in `legacy` instead of `echoes`, and `heroes` (none yet).
 */
export function newProfile() {
  const p = {
    v: 1, echoes: 0, earned: 0, spent: 0, unlocks: {}, reachedBoss: false, bossKills: 0,
    firstKill: { rogue: false, mage: false, hunter: false }, runs: 0, guide: 'todo', welcome: false,
    deathblowMet: noDeathblowMet(),
  };
  return legacyProfiles() ? legacyProfile(p) : p;
}

/**
 * M3 v3 (D153, changes-m3-v3.md 4): per class, whether a fight with a Deathblow has ended on this profile (combat.js
 * endFight sets it in the run's profile, any outcome; a dev run never does). Until then the class's Deathblow fights are its
 * first (windupView `firstDeathblow`), where the UI's prompt names the answer and its key. A guided run starts with every
 * class cleared ("Play the guide again" teaches the answers again, rules.js newRun).
 */
export const noDeathblowMet = () => Object.fromEntries(CLASS_IDS.map((c) => [c, false]));

/**
 * A stored profile with the M3 keys (m3-onboarding.md E6): a profile saved before them loads with `guide` 'done' and
 * `welcome` true when it has played a run (runs > 0; the owner's profile gets no welcome and no guide), else 'todo' and
 * false. Returns a new profile; newRun and applyRunToProfile apply it; the front end calls it when it loads a profile.
 */
export function migrateProfile(profile) {
  const p = deepClone(profile);
  if (!ONB_GUIDE_STATES.includes(p.guide)) p.guide = p.runs > 0 ? 'done' : 'todo';
  if (typeof p.welcome !== 'boolean') p.welcome = p.runs > 0;
  // M3 v3 (D153): a profile saved before it has met no Deathblow (each class's next one names its answer once)
  const met = p.deathblowMet && typeof p.deathblowMet === 'object' ? p.deathblowMet : {};
  p.deathblowMet = Object.fromEntries(CLASS_IDS.map((c) => [c, met[c] === true]));
  // Legacy (GATES.legacy; legacy.md 4.6): a version 1 profile becomes version 3 (Echoes in, Legacy points out: every Echo
  // spent comes back, the catalogue cleared but Packed Satchel); a version 3 profile is kept as it is, switch or not.
  return legacyProfiles() || p.v >= 3 ? legacyProfile(p) : p;
}

/** The profile with guide = value ('todo', 'done', 'skipped'): class select's toggle and Settings (E6). Pure. */
export function setGuide(profile, value) {
  if (!ONB_GUIDE_STATES.includes(value)) throw new IllegalActionError(`guide must be one of ${ONB_GUIDE_STATES.join(', ')}`);
  const p = migrateProfile(profile);
  p.guide = value;
  return p;
}

/** The welcome is still to be paid (m3-onboarding.md 4.2): `welcome` false, or a profile without the key and no run. */
export const welcomeDue = (profile) => !!profile && (typeof profile.welcome === 'boolean' ? !profile.welcome : !(profile.runs > 0));

function reqMet(profile, req) {
  if (req === 'flag:bossKill') return profile.bossKills > 0;
  if (req === 'flag:reachedBoss') return !!profile.reachedBoss;
  return (profile.unlocks[req] || 0) > 0;
}

/**
 * Catalogue view: every entry with rank, next cost and whether it can be bought now (rules 11.2). A stored rank
 * above the entry's ranks (older catalogue) shows as the maximum rank, as it counts in a run. Only catalogue entries
 * are listed: an owned id that is not in META (Wayfinder, removed in M2 v4; Starforged Arms, removed in M2 v5) is
 * ignored, and buyMeta throws for it. Economy v2 (legacy.md 4.7 E5): a version 3 profile is offered META_HERO (the 13
 * entries of 4.2 at the E5 prices; legacy.js hallOf), and only those.
 */
export function metaOffers(profile) {
  return Object.values(hallOf(profile, META)).map((m) => {
    const rank = Math.min(profile.unlocks[m.id] || 0, m.ranks);
    const maxed = rank >= m.ranks;
    const nextCost = maxed ? null : m.costs[rank];
    const reqOk = m.req.every((r) => reqMet(profile, r));
    return {
      id: m.id, name: m.name, kind: m.kind, rank, ranks: m.ranks, nextCost, req: m.req.slice(),
      available: !maxed && reqOk, affordable: !maxed && reqOk && balanceOf(profile) >= nextCost,
    };
  });
}

/** Buy one rank (Echoes, or Legacy points on a version 3 profile). Returns a new profile; throws IllegalActionError when not allowed. */
export function buyMeta(profile, id) {
  const m = hallOf(profile, META)[id];
  if (!m) throw new IllegalActionError(`unknown meta unlock ${id}`);
  const offer = metaOffers(profile).find((o) => o.id === id);
  if (!offer.available) throw new IllegalActionError(`meta unlock ${id} is not available (rank ${offer.rank}/${m.ranks}, requires ${m.req.join(', ') || 'nothing'})`);
  const have = balanceOf(profile);
  if (have < offer.nextCost) throw new IllegalActionError(`meta unlock ${id} costs ${offer.nextCost} ${profile.v >= 3 ? 'Legacy points' : 'Echoes'}, profile has ${have}`);
  const p = deepClone(profile);
  p[balanceKey(p)] -= offer.nextCost;
  p.spent += offer.nextCost;
  p.unlocks[id] = offer.rank + 1;
  return p;
}

/** Hash of the profile's unlocks (run summary, rules 11.4). */
export function profileHash(profile) {
  const keys = Object.keys(profile.unlocks || {}).sort();
  return hash32(keys.map((k) => `${k}:${profile.unlocks[k]}`).join(','));
}

/**
 * Echoes earned by a run, line by line (rules 11.1). facts: see summary(). Each line is rounded half away from
 * zero, round(count × each) (M2 v3: ECHO_PER_LEVEL and ECHO_PER_ZONE are fractional); the total is the sum of the
 * rounded lines × the Oath multiplier, rounded. Heat: line `heat`, fights won in nodes entered Hot or Scorched. Legacy
 * (legacy.md 4.1): the same lines (the LEGACY_* constants) in Legacy points; in a Legacy run (facts.heroLevels set) the
 * line `levels` is LEGACY_PER_LEVEL per hero level gained (each HERO_XP_AT_MAX at level 25 counts as one). Economy v2
 * (legacy.md 4.7 E1; facts.econV2, a Legacy run under GATES.economyV2): no line `reserve` (camp points kept pay nothing, a
 * lean first run's included) and the line `zones` at LEGACY_PER_ZONE_HERO.
 */
export function echoes(facts, profile) {
  const lines = [];
  const add = (id, count, each) => { if (count > 0) lines.push({ id, count, each, echoes: rnd(count * each) }); };
  if (facts.heroLevels !== undefined) add('levels', facts.heroLevels, LEGACY_PER_LEVEL);
  else add('levels', facts.level - 1, ECHO_PER_LEVEL);
  add('zones', facts.zonesLeft, facts.econV2 ? LEGACY_PER_ZONE_HERO : LEGACY_PER_ZONE);
  add('dungeons', facts.dungeons, LEGACY_PER_DUNGEON);
  add('elites', facts.kills.elite, LEGACY_PER_ELITE);
  add('rares', facts.kills.rare, LEGACY_PER_RARE);
  add('quests', facts.quests, LEGACY_PER_QUEST);
  add('heat', facts.heatFights || 0, LEGACY_PER_HEAT_FIGHT);
  // prep (expedition.md 8.1, 2.6): contracts completed × LEGACY_PER_QUEST × LEGACY_CONTRACT_MULT; Reserve × LEGACY_PER_PREP_POINT
  add('contracts', facts.contracts || 0, LEGACY_PER_QUEST * LEGACY_CONTRACT_MULT);
  if (!facts.econV2) add('reserve', facts.reserve || 0, LEGACY_PER_PREP_POINT);
  // M3 (m3-onboarding.md 4.2): the Bellwrights' welcome, once per profile, in the first non-dev run's summary
  if (facts.welcome) add('welcome', 1, LEGACY_WELCOME);
  if (facts.reachedBoss) {
    add('bossReached', 1, LEGACY_BOSS_REACHED);
    add('bossPhases', Math.max(0, facts.bossPhase - 1), LEGACY_BOSS_PHASE);
  }
  if (facts.outcome === 'victory') {
    add('bossKill', 1, LEGACY_BOSS_KILL);
    const par = parTime(facts.oaths);
    if (facts.timeAtBoss !== null && facts.timeAtBoss <= par) add('speed', 1, LEGACY_SPEED_BONUS);
    if (profile && profile.firstKill && !profile.firstKill[facts.classId]) add('firstKill', 1, LEGACY_FIRST_KILL_CLASS);
  }
  const base = lines.reduce((n, l) => n + l.echoes, 0);
  const mult = 1 + LEGACY_OATH_BONUS * facts.oaths.length;
  return { lines, base, oathMult: mult, total: rnd(base * mult) };
}

/**
 * Profile after a run (END_RUN): Echoes added, flags updated. Returns a new profile. A dev run (summary `dev`, engine-api.md
 * 12) leaves the profile as it was: no Echoes, no run counted, no boss flags, no welcome, no guide. M3: `welcome` true after
 * any other run; a guided run's `guide` 'done', or 'skipped' after SKIP_GUIDE. Legacy (legacy.md 1.5, 4.1): on a version
 * 3 profile the total goes to Legacy points, and a Legacy run's hero (summary `hero.record`: level, XP, talents, spells,
 * bar) is written back whatever the outcome, with its runs and wins counted.
 */
export function applyRunToProfile(profile, sum) {
  if (sum.dev) return deepClone(profile);
  const p = migrateProfile(profile);
  // M3 (m3-onboarding.md 4.2, E6): every non-dev run sets the welcome (paid or not); a guided run sets the guide.
  p.welcome = true;
  if (sum.tutorial) p.guide = sum.tutorial.skipped ? 'skipped' : 'done';
  p[balanceKey(p)] += sum.echoes.total;
  p.earned += sum.echoes.total;
  p.runs += 1;
  if (sum.reachedBoss) p.reachedBoss = true;
  if (sum.outcome === 'victory') {
    p.bossKills += 1;
    if (CLASS_IDS.includes(sum.classId)) p.firstKill[sum.classId] = true;
  }
  if (sum.hero && sum.hero.record && p.heroes && CLASS_IDS.includes(sum.classId)) {
    const old = heroOf(profile, sum.classId);
    p.heroes[sum.classId] = { ...deepClone(sum.hero.record), runs: (old ? old.runs || 0 : 0) + 1, wins: (old ? old.wins || 0 : 0) + (sum.outcome === 'victory' ? 1 : 0) };
  }
  return p;
}
