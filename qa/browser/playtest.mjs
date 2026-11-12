#!/usr/bin/env node
/**
 * qa/browser/playtest.mjs - the QA player (qa/browser/policy.mjs) through the engine API, headless.
 *
 * Same choices as the browser run (qa/browser/full-run.mjs): manual combat decisions in zone 1, the
 * game's autoplay in combat after that, the player's own choices out of combat everywhere. Prints one
 * line per run and a summary of what the playtest notes use (death places, levels and tolls per zone,
 * empty decisions). With --trace it prints the run as a readable log (one line per decision).
 *
 *   node qa/browser/playtest.mjs [--classes rogue,mage,hunter] [--seeds 1-20] [--trace] [--json out.json]
 */
import { writeFileSync } from 'node:fs';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { playerAction, createActions } from './policy.mjs';

const C = R.C;
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CLASSES = arg('--classes', 'rogue,mage,hunter').split(',');
const [S0, S1] = arg('--seeds', '1-20').split('-').map(Number);
const TRACE = args.includes('--trace');
const JSON_OUT = arg('--json', null);
const MAX = 20000;

/** Play one run. Returns a record of what happened. */
export function playRun({ classId, petId = 'ridgewolf', seed, name = 'Qa', manualZones = 1, log = null }) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' }); // policy.mjs plays the classic map (D116: no longer the default)
  for (const a of createActions({ classId, petId, name, seed })) s = R.step(s, a).state;
  const rec = {
    classId, seed, zones: [], deaths: null, rewardChoices: 0, emptyRewardChoices: 0, shrines: 0, grindWaves: [], potionsBought: 0,
    fleeTries: 0, interrupts: 0, manualRounds: 0, autoRounds: 0, nodeTypes: {}, hpAtNodeEntry: [], closeCalls: 0, actions: 0,
    firstNewSpellLevel: null, barAtZ1End: null, hubTrainer: { visits: 0, short: 0 }, fatalFight: null,
  };
  let fightStart = null;
  let zoneStart = { z: 1, time: 0, level: 1 };
  let autoplayOn = false;
  let n = 0;
  while (s.phase !== 'SUMMARY' && s.phase !== 'ENDED' && n++ < MAX) {
    const inManualZone = s.zone && !s.zone.camp && s.zone.z <= manualZones && s.phase !== 'CAMP' && s.phase !== 'BOSS';
    if (!inManualZone && !autoplayOn && !s.fight) {
      s = R.step(s, { type: 'SET_AUTOPLAY', on: true }).state; autoplayOn = true;
      if (log) log(`-- autoplay on (zone ${s.zone ? s.zone.z : '?'})`);
    }
    const a = playerAction(s, { manual: inManualZone || !s.fight ? true : false });
    if (!a) break;
    const before = s;
    if (s.fight && s.fight.round === 1) fightStart = { enemies: s.fight.enemies.length, levelDiff: Math.max(...s.fight.enemies.map((e) => e.level)) - s.player.level, hp: s.player.hp / s.player.d.maxHp, kind: s.fight.kind };
    if (a.type === 'SERVICE' && a.service === 'trainer') {
      // Can the gold pay for learning and training everything (rules 1.8 "spells vs gold")?
      const p = s.player;
      const V = (L) => Math.round(C.VALUE_BASE + C.VALUE_COEF * L ** C.VALUE_EXP);
      let cost = 0;
      for (const sp of Object.values(C.SPELL)) if (sp.cls === p.classId && sp.source === 'class' && !p.spells[sp.id] && sp.lvl <= p.level) cost += Math.round(C.TRAIN_NEW_V * V(sp.lvl));
      cost += Object.entries(p.spells).filter(([id, k]) => C.SPELL[id].source !== 'talent' && k.tl < p.level).length * Math.round(C.TRAIN_RANK_V * V(p.level));
      if (cost > 0) { rec.hubTrainer.visits++; if (p.gold < cost) rec.hubTrainer.short++; }
    }
    if (s.fight) { if (inManualZone) rec.manualRounds++; else rec.autoRounds++; }
    if (a.type === 'FLEE') rec.fleeTries++;
    if (a.type === 'CHOOSE_NODE') {
      const node = s.zone.rows[s.zone.pos.r][a.lane];
      rec.nodeTypes[node.type] = (rec.nodeTypes[node.type] || 0) + 1;
      rec.hpAtNodeEntry.push(+(s.player.hp / s.player.d.maxHp).toFixed(2));
    }
    if (a.type === 'CHOOSE_REWARD' && s.node && s.node.rewards[0].kind === 'items') {
      rec.rewardChoices++;
      const p = s.player;
      const ups = s.node.rewards[0].items.filter((it) => R.itemScore(it, p.classId) > R.itemScore(p.equipped[it.slot], p.classId));
      if (!ups.length) rec.emptyRewardChoices++;
    }
    if (a.type === 'CHOOSE_REWARD' && s.node && s.node.rewards[0].kind === 'boons') rec.shrines++;
    if (a.type === 'GRIND_SET_WAVES') rec.grindWaves.push(a.n);
    if (a.type === 'BUY' && s.service.stock[a.index].kind === 'cons' && /healing/.test(s.service.stock[a.index].id)) rec.potionsBought++;
    const r = R.step(s, a);
    s = r.state;
    rec.actions++;
    for (const e of r.events) {
      if (e.t === 'learn' && rec.firstNewSpellLevel === null && C.SPELL[e.spell].lvl > 1) rec.firstNewSpellLevel = before.player.level;
      if ((e.t === 'travel' || e.t === 'camp') && zoneStart.z === 1) rec.barAtZ1End = before.player.bar.filter(Boolean).length;
      if (e.t === 'interrupt') rec.interrupts++;
      if (e.t === 'victory' && s.player.hp < 0.2 * s.player.d.maxHp) rec.closeCalls++;
      if (e.t === 'travel' || e.t === 'camp') {
        rec.zones.push({ z: zoneStart.z, time: before.time + (C.TIME_TRAVEL) - zoneStart.time, levelIn: zoneStart.level, levelOut: before.player.level, row: before.zone.pos.r, quests: before.zone.questsDone });
        zoneStart = { z: zoneStart.z + 1, time: s.time, level: s.player.level };
      }
    }
    if (log) log(describe(before, a, r));
  }
  const sm = R.summary(s);
  rec.outcome = s.outcome;
  rec.level = s.player.level;
  rec.time = s.time;
  rec.minutes = sm.minutes;
  rec.reached = sm.reached;
  rec.summary = sm;
  if (s.death) {
    rec.deaths = { zone: s.death.zone, camp: !!s.death.camp, row: s.death.row, node: s.death.nodeType, fight: s.death.fightIndex, round: s.death.round, killer: s.death.killer };
    rec.fatalFight = fightStart;
  }
  rec.finalState = s;
  return rec;
}

function describe(s, a, r) {
  const p = s.player;
  const where = s.zone ? `Z${s.zone.z}${s.zone.camp ? 'camp' : ''} r${s.zone.pos.r}` : '';
  const hp = `${p.hp}/${p.d.maxHp}`;
  let what = a.type;
  if (a.type === 'CHOOSE_NODE') { const n = s.zone.rows[s.zone.pos.r][a.lane]; what = `CHOOSE_NODE ${n.type} cl${n.cl}${n.mobs ? ' x' + n.mobs.length : ''}`; }
  else if (a.type === 'CAST') what = `CAST ${a.spellId} -> ${a.target}`;
  else if (a.spellId || a.itemId || a.index != null || a.service || a.n != null) what = `${a.type} ${a.spellId || a.itemId || a.service || a.index || a.n}`;
  const ev = r.events.filter((e) => ['levelUp', 'death', 'victory', 'questComplete', 'story', 'dungeonClear', 'resurrect'].includes(e.t)).map((e) => e.t + (e.level ? e.level : '')).join(',');
  return `${where.padEnd(10)} L${String(p.level).padEnd(2)} hp ${hp.padEnd(9)} h${String(s.time).padEnd(4)} ${what}${ev ? '  [' + ev + ']' : ''}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = [];
  for (const classId of CLASSES) {
    for (let seed = S0; seed <= S1; seed++) {
      const lines = [];
      const rec = playRun({ classId, seed, log: TRACE ? (l) => lines.push(l) : null });
      if (TRACE) console.log(lines.join('\n'));
      const d = rec.deaths;
      console.log(`${classId.padEnd(6)} seed ${String(seed).padEnd(4)} ${String(rec.outcome).padEnd(8)} L${rec.level} ${rec.time} h ~${Math.round(rec.minutes.manual)} min manual` +
        `${d ? `  died Z${d.camp ? 'camp' : d.zone} r${d.row} ${d.node} round ${d.round} by ${d.killer ? d.killer.name + ' (' + d.killer.ability + ')' : '?'}` : ''}` +
        `  zones ${rec.zones.map((z) => `Z${z.z}:L${z.levelOut}/${z.time}h/r${z.row}`).join(' ')}`);
      delete rec.finalState;
      all.push(rec);
    }
  }
  const by = (k) => all.reduce((m, r) => { const key = k(r); m[key] = (m[key] || 0) + 1; return m; }, {});
  console.log('\noutcomes', JSON.stringify(by((r) => `${r.classId}:${r.outcome}`)));
  console.log('deaths', JSON.stringify(by((r) => (r.deaths ? `${r.classId}:${r.deaths.camp ? 'boss' : 'Z' + r.deaths.zone + '-' + r.deaths.node}` : `${r.classId}:none`))));
  const rc = all.reduce((n, r) => n + r.rewardChoices, 0);
  const er = all.reduce((n, r) => n + r.emptyRewardChoices, 0);
  console.log(`quest reward choices ${rc}, with no upgrade among the options ${er} (${Math.round((100 * er) / Math.max(1, rc))} %)`);
  const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
  for (const c of CLASSES) {
    const rs = all.filter((r) => r.classId === c);
    const boss = rs.filter((r) => r.reached && r.reached.camp);
    const lv = [1, 2, 3, 4, 5, 6].map((z) => med(rs.map((r) => (r.zones.find((q) => q.z === z) || {}).levelOut)));
    const tv = rs.reduce((n, r) => n + r.hubTrainer.visits, 0);
    const ts = rs.reduce((n, r) => n + r.hubTrainer.short, 0);
    const nodes = rs.reduce((m, r) => { for (const [k, v] of Object.entries(r.nodeTypes)) m[k] = (m[k] || 0) + v; return m; }, {});
    console.log(`${c}: boss ${boss.length}/${rs.length}; boss runs: median ${med(boss.map((r) => r.summary.rounds))} rounds, ${med(boss.map((r) => r.time))} h, ~${Math.round(med(boss.map((r) => r.minutes.manual)) || 0)} min manual, ~${Math.round(med(boss.map((r) => r.minutes.autoplay)) || 0)} min autoplay`);
    console.log(`   level when leaving zones 1-6: ${lv.join(', ')}; first spell above level 1 learned at level ${med(rs.map((r) => r.firstNewSpellLevel))}; spells on the bar leaving zone 1: ${med(rs.map((r) => r.barAtZ1End))}`);
    console.log(`   trainer visits where gold could not pay for everything: ${ts}/${tv}; elites entered ${nodes.elite || 0}, dungeons ${nodes.dungeon || 0}, trainer nodes ${nodes.trainer || 0}`);
  }
  const z1q = all.filter((r) => r.deaths && r.deaths.zone === 1 && !r.deaths.camp && r.deaths.node === 'quest' && r.fatalFight);
  if (z1q.length) {
    const cnt = (f) => z1q.reduce((m, r) => { const k = f(r.fatalFight); m[k] = (m[k] || 0) + 1; return m; }, {});
    console.log(`zone 1 quest deaths ${z1q.length}: enemies ${JSON.stringify(cnt((x) => x.enemies))}, levels above the player ${JSON.stringify(cnt((x) => x.levelDiff))}, HP at the start ${JSON.stringify(cnt((x) => (x.hp >= 0.6 ? '>=60%' : '<60%')))}`);
  }
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(all.map((r) => ({ ...r, summary: undefined })), null, 1));
}
