// Meta progression (rules 11): profile, catalogue purchases, Echoes per run (a dev run leaves the profile as it was,
// engine-api.md 12; prep, expedition.md 8.1: the lines of contracts completed and Reserve left).
import {
  META, CLASS_IDS, ECHO_PER_LEVEL, ECHO_PER_ZONE, ECHO_PER_DUNGEON, ECHO_PER_ELITE, ECHO_PER_RARE, ECHO_PER_QUEST,
  ECHO_BOSS_REACHED, ECHO_BOSS_PHASE, ECHO_BOSS_KILL, ECHO_SPEED_BONUS, ECHO_FIRST_KILL_CLASS, OATH_ECHO_BONUS,
  BOSS_TIME_PAR, OATH_HASTE_TIME, ECHO_PER_HEAT_FIGHT, ECHO_CONTRACT_MULT, PREP_ECHO_PER_POINT,
} from '../constants.js';
import { IllegalActionError, deepClone, rnd } from './util.js';
import { hash32 } from '../rng.js';

/**
 * Boss time par in tolls (rules 1.7, 11.5): BOSS_TIME_PAR, OATH_HASTE_TIME less under the Oath of Haste. Ascendancy
 * counts the tolls past it; the Echoes speed bonus needs a kill at or under it.
 */
export function parTime(oaths) {
  return BOSS_TIME_PAR - (oaths && oaths.includes('haste') ? OATH_HASTE_TIME : 0);
}

/** A fresh profile (no unlocks). Plain JSON; the front end stores it. */
export function newProfile() {
  return {
    v: 1, echoes: 0, earned: 0, spent: 0, unlocks: {}, reachedBoss: false, bossKills: 0,
    firstKill: { rogue: false, mage: false, hunter: false }, runs: 0,
  };
}

function reqMet(profile, req) {
  if (req === 'flag:bossKill') return profile.bossKills > 0;
  if (req === 'flag:reachedBoss') return !!profile.reachedBoss;
  return (profile.unlocks[req] || 0) > 0;
}

/**
 * Catalogue view: every entry with rank, next cost and whether it can be bought now (rules 11.2). A stored rank
 * above the entry's ranks (older catalogue) shows as the maximum rank, as it counts in a run. Only catalogue entries
 * are listed: an owned id that is not in META (Wayfinder, removed in M2 v4; Starforged Arms, removed in M2 v5) is
 * ignored, and buyMeta throws for it.
 */
export function metaOffers(profile) {
  return Object.values(META).map((m) => {
    const rank = Math.min(profile.unlocks[m.id] || 0, m.ranks);
    const maxed = rank >= m.ranks;
    const nextCost = maxed ? null : m.costs[rank];
    const reqOk = m.req.every((r) => reqMet(profile, r));
    return {
      id: m.id, name: m.name, kind: m.kind, rank, ranks: m.ranks, nextCost, req: m.req.slice(),
      available: !maxed && reqOk, affordable: !maxed && reqOk && profile.echoes >= nextCost,
    };
  });
}

/** Buy one rank. Returns a new profile; throws IllegalActionError when not allowed. */
export function buyMeta(profile, id) {
  const m = META[id];
  if (!m) throw new IllegalActionError(`unknown meta unlock ${id}`);
  const offer = metaOffers(profile).find((o) => o.id === id);
  if (!offer.available) throw new IllegalActionError(`meta unlock ${id} is not available (rank ${offer.rank}/${m.ranks}, requires ${m.req.join(', ') || 'nothing'})`);
  if (profile.echoes < offer.nextCost) throw new IllegalActionError(`meta unlock ${id} costs ${offer.nextCost} Echoes, profile has ${profile.echoes}`);
  const p = deepClone(profile);
  p.echoes -= offer.nextCost;
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
 * rounded lines × the Oath multiplier, rounded. Heat: line `heat`, fights won in nodes entered Hot or Scorched.
 */
export function echoes(facts, profile) {
  const lines = [];
  const add = (id, count, each) => { if (count > 0) lines.push({ id, count, each, echoes: rnd(count * each) }); };
  add('levels', facts.level - 1, ECHO_PER_LEVEL);
  add('zones', facts.zonesLeft, ECHO_PER_ZONE);
  add('dungeons', facts.dungeons, ECHO_PER_DUNGEON);
  add('elites', facts.kills.elite, ECHO_PER_ELITE);
  add('rares', facts.kills.rare, ECHO_PER_RARE);
  add('quests', facts.quests, ECHO_PER_QUEST);
  add('heat', facts.heatFights || 0, ECHO_PER_HEAT_FIGHT);
  // prep (expedition.md 8.1, 2.6): contracts completed × ECHO_PER_QUEST × ECHO_CONTRACT_MULT; Reserve × PREP_ECHO_PER_POINT
  add('contracts', facts.contracts || 0, ECHO_PER_QUEST * ECHO_CONTRACT_MULT);
  add('reserve', facts.reserve || 0, PREP_ECHO_PER_POINT);
  if (facts.reachedBoss) {
    add('bossReached', 1, ECHO_BOSS_REACHED);
    add('bossPhases', Math.max(0, facts.bossPhase - 1), ECHO_BOSS_PHASE);
  }
  if (facts.outcome === 'victory') {
    add('bossKill', 1, ECHO_BOSS_KILL);
    const par = parTime(facts.oaths);
    if (facts.timeAtBoss !== null && facts.timeAtBoss <= par) add('speed', 1, ECHO_SPEED_BONUS);
    if (profile && profile.firstKill && !profile.firstKill[facts.classId]) add('firstKill', 1, ECHO_FIRST_KILL_CLASS);
  }
  const base = lines.reduce((n, l) => n + l.echoes, 0);
  const mult = 1 + OATH_ECHO_BONUS * facts.oaths.length;
  return { lines, base, oathMult: mult, total: rnd(base * mult) };
}

/**
 * Profile after a run (END_RUN): Echoes added, flags updated. Returns a new profile. A dev run (summary `dev`, engine-api.md
 * 12) leaves the profile as it was: no Echoes, no run counted, no boss flags.
 */
export function applyRunToProfile(profile, sum) {
  const p = deepClone(profile);
  if (sum.dev) return p;
  p.echoes += sum.echoes.total;
  p.earned += sum.echoes.total;
  p.runs += 1;
  if (sum.reachedBoss) p.reachedBoss = true;
  if (sum.outcome === 'victory') {
    p.bossKills += 1;
    if (CLASS_IDS.includes(sum.classId)) p.firstKill[sum.classId] = true;
  }
  return p;
}
