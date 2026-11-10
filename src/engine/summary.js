// Run summary (rules 9) and the real-time estimate (rules 3; combat v2: PACE_ENGAGE_S per fight with an engage round).
import {
  PACE_CREATE_S, PACE_DECIDE_S, PACE_TRAVEL_NODE_S, PACE_ZONE_TRAVEL_S, PACE_QUEST_TEXT_S, PACE_FIGHT_OVERHEAD_S,
  PACE_MANUAL_ROUND_S, PACE_AUTO_ROUND_S, PACE_LOOT_S, PACE_LEVELUP_S, PACE_TALENT_S, PACE_REST_S, PACE_SHRINE_S,
  PACE_TREASURE_S, PACE_VENDOR_S, PACE_VENDOR_TX_S, PACE_TRAINER_S, PACE_TRAINER_TX_S, PACE_BOSS_INTRO_S,
  PACE_ENGAGE_S, SLOT_IDS, TALENT, CLASS,
} from '../constants.js';
import { echoes, profileHash } from './meta.js';
import { deepClone } from './util.js';

/**
 * estSeconds (rules 3): sum of pace terms; rounds at the manual or autoplay rate. The manual profile also reads the
 * tracks and picks the engage: PACE_ENGAGE_S per fight with an engage round (combat v2).
 */
export function estSeconds(st, profile = 'manual') {
  const round = profile === 'auto' ? PACE_AUTO_ROUND_S : PACE_MANUAL_ROUND_S;
  return PACE_CREATE_S
    + (profile === 'auto' ? 0 : (st.engages || 0) * PACE_ENGAGE_S)
    + st.nodesTotal * (PACE_DECIDE_S + PACE_TRAVEL_NODE_S)
    + st.zonesLeft * PACE_ZONE_TRAVEL_S
    + st.quests * PACE_QUEST_TEXT_S
    + st.fights * PACE_FIGHT_OVERHEAD_S
    + st.rounds * round
    + st.equipDrops * PACE_LOOT_S
    + st.levelUps * PACE_LEVELUP_S
    + st.talentPoints * PACE_TALENT_S
    + st.rests * PACE_REST_S + st.shrines * PACE_SHRINE_S + st.treasures * PACE_TREASURE_S
    + st.vendorVisits * PACE_VENDOR_S + st.vendorTx * PACE_VENDOR_TX_S
    + st.trainerVisits * PACE_TRAINER_S + st.trainerTx * PACE_TRAINER_TX_S
    + (st.reachedBoss ? PACE_BOSS_INTRO_S : 0);
}

/** Run summary (rules 9). Works in any phase after START_RUN; final in SUMMARY. */
export function summary(s) {
  if (!s.player) return null;
  const st = s.stats;
  const p = s.player;
  const trees = [0, 0, 0];
  for (const [id, r] of Object.entries(p.talents)) trees[TALENT[id].tree] += r;
  const top = Object.entries(st.spellDmg).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([id, dmg]) => ({ id, dmg }));
  const facts = {
    classId: p.classId, level: p.level, zonesLeft: st.zonesLeft, dungeons: st.dungeons, kills: st.kills,
    quests: st.quests, reachedBoss: st.reachedBoss, bossPhase: st.bossPhase, outcome: s.outcome,
    hoursAtBoss: st.hoursAtBoss, oaths: s.oaths,
  };
  return deepClone({
    name: p.name, classId: p.classId, className: CLASS[p.classId].name, petId: p.pet ? p.pet.id : null,
    talents: { perTree: trees, trees: CLASS[p.classId].trees, ranks: { ...p.talents } },
    seed: s.seed, profileHash: profileHash(s.profile), contentVersion: s.contentVersion, oaths: s.oaths.slice(),
    outcome: s.outcome, death: s.death, level: p.level, xp: p.xp,
    reached: { zone: st.maxZone, row: st.maxRow, camp: !!(s.zone && s.zone.camp) || st.reachedBoss },
    hours: s.hours, ascendancy: st.asc, hoursAtBoss: st.hoursAtBoss,
    minutes: { manual: estSeconds(st, 'manual') / 60, autoplay: estSeconds(st, 'auto') / 60 },
    nodes: { ...st.nodes, total: st.nodesTotal }, campWaves: st.campWaves, fights: st.fights, rounds: st.rounds,
    bossRounds: st.bossRounds, kills: { ...st.kills }, quests: st.quests, stories: st.stories, dungeons: st.dungeons,
    gold: { earned: st.goldEarned, spent: st.goldSpent, now: p.gold }, potionsUsed: st.potionsUsed,
    resurrectsUsed: st.resUsed, damage: { dealt: st.dmgDealt, taken: st.dmgTaken }, topSpells: top,
    equipped: SLOT_IDS.filter((k) => p.equipped[k]).map((k) => ({ slot: k, name: p.equipped[k].name, ilvl: p.equipped[k].ilvl, rarity: p.equipped[k].rarity })),
    reachedBoss: st.reachedBoss, bossPhase: st.bossPhase, bossHpPct: st.bossHpPct,
    echoes: echoes(facts, s.profile),
  });
}
