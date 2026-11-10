// Meta progression (rules 11): profile, catalogue purchases, Echoes per run.
import {
  META, CLASS_IDS, ECHO_PER_LEVEL, ECHO_PER_ZONE, ECHO_PER_DUNGEON, ECHO_PER_ELITE, ECHO_PER_RARE, ECHO_PER_QUEST,
  ECHO_BOSS_REACHED, ECHO_BOSS_PHASE, ECHO_BOSS_KILL, ECHO_SPEED_BONUS, ECHO_FIRST_KILL_CLASS, OATH_ECHO_BONUS,
  BOSS_TIME_PAR, OATH_HASTE_HOURS,
} from '../constants.js';
import { IllegalActionError, deepClone, rnd } from './util.js';
import { hash32 } from '../rng.js';

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
 * above the entry's ranks (older catalogue) shows as the maximum rank, as it counts in a run.
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
 * rounded lines × the Oath multiplier, rounded.
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
  if (facts.reachedBoss) {
    add('bossReached', 1, ECHO_BOSS_REACHED);
    add('bossPhases', Math.max(0, facts.bossPhase - 1), ECHO_BOSS_PHASE);
  }
  if (facts.outcome === 'victory') {
    add('bossKill', 1, ECHO_BOSS_KILL);
    const par = BOSS_TIME_PAR - (facts.oaths.includes('haste') ? OATH_HASTE_HOURS : 0);
    if (facts.hoursAtBoss !== null && facts.hoursAtBoss <= par) add('speed', 1, ECHO_SPEED_BONUS);
    if (profile && profile.firstKill && !profile.firstKill[facts.classId]) add('firstKill', 1, ECHO_FIRST_KILL_CLASS);
  }
  const base = lines.reduce((n, l) => n + l.echoes, 0);
  const mult = 1 + OATH_ECHO_BONUS * facts.oaths.length;
  return { lines, base, oathMult: mult, total: rnd(base * mult) };
}

/** Profile after a run (END_RUN): Echoes added, flags updated. Returns a new profile. */
export function applyRunToProfile(profile, sum) {
  const p = deepClone(profile);
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
