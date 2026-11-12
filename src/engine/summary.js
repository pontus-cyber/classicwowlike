// Run summary (rules 9) and the real-time estimate (rules 3; combat v2: PACE_ENGAGE_S per fight with an engage round;
// expedition, rules 1.9.8: walks and passes, the Homeward Bell, and the `expedition` block of the summary; heat, rules
// 1.7.4: the `heat` block and the Echo line of fights won in heat; M2b v7: time in whole tolls, `time`, `timeAtBoss`,
// `heat.timeByState`). Dev tools (engine-api.md 12): a dev run's summary has a `dev` block and no Echoes. Start camp and
// contracts (prep, expedition.md 8.1, 9.4): the `expedition.contracts` lines, the prep screen and hub decisions in the
// estimate, the Echo lines of contracts completed and Reserve left. M2b v15 (D124): Swift passage counts in `expedition`.
import {
  PACE_CREATE_S, PACE_DECIDE_S, PACE_TRAVEL_NODE_S, PACE_ZONE_TRAVEL_S, PACE_QUEST_TEXT_S, PACE_FIGHT_OVERHEAD_S,
  PACE_MANUAL_ROUND_S, PACE_AUTO_ROUND_S, PACE_LOOT_S, PACE_LEVELUP_S, PACE_TALENT_S, PACE_REST_S, PACE_SHRINE_S,
  PACE_TREASURE_S, PACE_VENDOR_S, PACE_VENDOR_TX_S, PACE_TRAINER_S, PACE_TRAINER_TX_S, PACE_BOSS_INTRO_S,
  PACE_ENGAGE_S, PACE_BELL_S, PACE_PREP_S, PACE_HUB_CONTRACT_S, SLOT_IDS, TALENT, CLASS,
} from '../constants.js';
import { contractSummary } from './contracts.js';
import { echoes, profileHash } from './meta.js';
import { deepClone } from './util.js';
import { heatSummary } from './heat.js';

/**
 * estSeconds (rules 3): sum of pace terms; rounds at the manual or autoplay rate. The manual profile also reads the
 * tracks and picks the engage: PACE_ENGAGE_S per fight with an engage round (combat v2). Expedition (rules 1.9.8): a
 * walk or a pass costs PACE_DECIDE_S + PACE_TRAVEL_NODE_S; a Bell costs PACE_BELL_S, and a zone it leaves no
 * PACE_ZONE_TRAVEL_S.
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
    + (st.reachedBoss ? PACE_BOSS_INTRO_S : 0)
    + (st.exp ? (st.exp.walks + st.exp.passes) * (PACE_DECIDE_S + PACE_TRAVEL_NODE_S) + st.exp.bells * PACE_BELL_S - st.exp.bellExits * PACE_ZONE_TRAVEL_S : 0)
    // prep (expedition.md 9.4): the prep screen once, a hub contract decision per hub that offers one
    + (st.exp ? (st.exp.preps || 0) * PACE_PREP_S + (st.exp.hubOffers || 0) * PACE_HUB_CONTRACT_S : 0);
}

/** Run summary (rules 9). Works in any phase after START_RUN; final in SUMMARY. */
export function summary(s) {
  if (!s.player) return null;
  const st = s.stats;
  const p = s.player;
  const trees = [0, 0, 0];
  for (const [id, r] of Object.entries(p.talents)) trees[TALENT[id].tree] += r;
  const top = Object.entries(st.spellDmg).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([id, dmg]) => ({ id, dmg }));
  const heat = heatSummary(s);
  const facts = {
    classId: p.classId, level: p.level, zonesLeft: st.zonesLeft, dungeons: st.dungeons, kills: st.kills,
    quests: st.quests, reachedBoss: st.reachedBoss, bossPhase: st.bossPhase, outcome: s.outcome,
    timeAtBoss: st.timeAtBoss, oaths: s.oaths, heatFights: heat.heatFights,
    // prep (expedition.md 2.6, 8.1, 11.1): contracts completed and Reserve left
    ...(s.exp && s.exp.prep ? { contracts: contractSummary(s).completed, reserve: s.exp.reserve || 0 } : {}),
  };
  // Dev tools (engine-api.md 12): a dev run earns no Echoes; `withheld` is what the run would have earned.
  const dev = s.dev ? { god: !!s.dev.godUsed, tools: s.dev.tools.slice() } : null;
  let ech = echoes(facts, s.profile);
  if (dev) ech = { lines: [], base: 0, oathMult: ech.oathMult, total: 0, withheld: ech.total };
  const heatLine = ech.lines.find((l) => l.id === 'heat');
  return deepClone({
    name: p.name, classId: p.classId, className: CLASS[p.classId].name, petId: p.pet ? p.pet.id : null,
    talents: { perTree: trees, trees: CLASS[p.classId].trees, ranks: { ...p.talents } },
    seed: s.seed, profileHash: profileHash(s.profile), contentVersion: s.contentVersion, oaths: s.oaths.slice(),
    outcome: s.outcome, death: s.death, level: p.level, xp: p.xp,
    reached: { zone: st.maxZone, row: st.maxRow, camp: !!(s.zone && s.zone.camp) || st.reachedBoss },
    time: s.time, ascendancy: st.asc, timeAtBoss: st.timeAtBoss,
    minutes: { manual: estSeconds(st, 'manual') / 60, autoplay: estSeconds(st, 'auto') / 60 },
    nodes: { ...st.nodes, total: st.nodesTotal }, campWaves: st.campWaves, fights: st.fights, rounds: st.rounds,
    bossRounds: st.bossRounds, kills: { ...st.kills }, quests: st.quests, stories: st.stories, dungeons: st.dungeons,
    gold: { earned: st.goldEarned, spent: st.goldSpent, now: p.gold }, potionsUsed: st.potionsUsed,
    resurrectsUsed: st.resUsed, damage: { dealt: st.dmgDealt, taken: st.dmgTaken }, topSpells: top,
    equipped: SLOT_IDS.filter((k) => p.equipped[k]).map((k) => ({ slot: k, name: p.equipped[k].name, ilvl: p.equipped[k].ilvl, rarity: p.equipped[k].rarity })),
    reachedBoss: st.reachedBoss, bossPhase: st.bossPhase, bossHpPct: st.bossHpPct,
    echoes: ech,
    heat: {
      trackPerZone: heat.trackPerZone, timeByState: heat.timeByState, nodesByState: heat.nodesByState,
      fightsByState: heat.fightsByState, echoHeat: heatLine ? heatLine.echoes : 0,
    },
    ...(st.exp ? { mapMode: 'expedition', expedition: expeditionSummary(s) } : {}),
    ...(dev ? { dev } : {}),
  });
}

/**
 * Expedition lines of the summary (rules 1.9, 9): walks (steps to resolved nodes, the hub or Dimmed nodes), passes
 * (PASS_THROUGH), Dimmed encounters and the zones that had one, Bell charges rung and left, Roads taken, the furthest
 * ring, and per zone { z, time (zone tolls; the current zone so far), nodes, walks, passes, dimFights, exit, swift }.
 * M2b v15 (D124): `swift` = Roads taken with the Swift passage; a zone's `swift` = the XP its Road paid (0 without).
 */
function expeditionSummary(s) {
  const x = s.stats.exp;
  const zones = x.zones.map((r, i) => ({ ...r, time: r.exit === null && i === x.zones.length - 1 && s.zone && !s.zone.camp ? s.time - s.zone.start : r.time }));
  return {
    walks: x.walks, passes: x.passes, dimFights: x.dimFights, dimZones: zones.filter((r) => r.dimFights > 0).length,
    bellsRung: x.bells, bellCharges: s.exp.bell, roads: x.roads, swift: x.swift || 0, maxRing: x.maxRing, zones, dimming: s.exp.dimming !== false,
    ...(s.exp.prep ? { contracts: contractSummary(s) } : {}),
  };
}
