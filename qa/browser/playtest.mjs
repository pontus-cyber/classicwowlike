#!/usr/bin/env node
/**
 * qa/browser/playtest.mjs - the QA player (qa/browser/policy.mjs) through the engine API, headless.
 *
 * Same choices as the browser run (qa/browser/full-run.mjs): manual combat decisions in zone 1, the
 * game's autoplay in combat after that, the player's own choices out of combat everywhere. Prints one
 * line per run and a summary of what the playtest notes use (death places, levels and hours per zone,
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
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT });
  for (const a of createActions({ classId, petId, name, seed })) s = R.step(s, a).state;
  const rec = {
    classId, seed, zones: [], deaths: null, rewardChoices: 0, emptyRewardChoices: 0, shrines: 0, grindWaves: [], potionsBought: 0,
    fleeTries: 0, interrupts: 0, manualRounds: 0, autoRounds: 0, nodeTypes: {}, hpAtNodeEntry: [], closeCalls: 0, actions: 0,
  };
  let zoneStart = { z: 1, hours: 0, level: 1 };
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
      if (e.t === 'interrupt') rec.interrupts++;
      if (e.t === 'victory' && s.player.hp < 0.2 * s.player.d.maxHp) rec.closeCalls++;
      if (e.t === 'travel' || e.t === 'camp') {
        rec.zones.push({ z: zoneStart.z, hours: before.hours + (C.HOURS_TRAVEL) - zoneStart.hours, levelIn: zoneStart.level, levelOut: before.player.level, row: before.zone.pos.r, quests: before.zone.questsDone });
        zoneStart = { z: zoneStart.z + 1, hours: s.hours, level: s.player.level };
      }
    }
    if (log) log(describe(before, a, r));
  }
  const sm = R.summary(s);
  rec.outcome = s.outcome;
  rec.level = s.player.level;
  rec.hours = s.hours;
  rec.minutes = sm.minutes;
  rec.reached = sm.reached;
  rec.summary = sm;
  if (s.death) rec.deaths = { zone: s.death.zone, camp: !!s.death.camp, row: s.death.row, node: s.death.nodeType, fight: s.death.fightIndex, round: s.death.round, killer: s.death.killer };
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
  return `${where.padEnd(10)} L${String(p.level).padEnd(2)} hp ${hp.padEnd(9)} h${String(s.hours).padEnd(4)} ${what}${ev ? '  [' + ev + ']' : ''}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = [];
  for (const classId of CLASSES) {
    for (let seed = S0; seed <= S1; seed++) {
      const lines = [];
      const rec = playRun({ classId, seed, log: TRACE ? (l) => lines.push(l) : null });
      if (TRACE) console.log(lines.join('\n'));
      const d = rec.deaths;
      console.log(`${classId.padEnd(6)} seed ${String(seed).padEnd(4)} ${String(rec.outcome).padEnd(8)} L${rec.level} ${rec.hours} h ~${Math.round(rec.minutes.manual)} min manual` +
        `${d ? `  died Z${d.camp ? 'camp' : d.zone} r${d.row} ${d.node} round ${d.round} by ${d.killer ? d.killer.name + ' (' + d.killer.ability + ')' : '?'}` : ''}` +
        `  zones ${rec.zones.map((z) => `Z${z.z}:L${z.levelOut}/${z.hours}h/r${z.row}`).join(' ')}`);
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
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(all.map((r) => ({ ...r, summary: undefined })), null, 1));
}
