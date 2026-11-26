// Blind demo round 1, group A (feedback 2026-11-26-blind-demo-skipper and -newcomer; BACKLOG 2026-11-26 A; draft): danger
// before the click. 1. The reinforcement a fight calls in (Signal, rules 7.12): signalPlan (mapView `calls`, `fightCalls`)
// and R.fightSignal agree with the fights the engine plays: every signal summon was announced, at its round, and a fight
// announced as calling nobody never gets one. 2. A demo run's zone (demo.md 4.4, draft): no quest is set up twice, and no
// quest is above the zone's band; zone 1 of a guided run keeps its scripted roles. 3. With the demo off nothing changes
// (the full game's run hashes: sim/blindahash.mjs).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { signalPlan } from '../../src/engine/track.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
const base = () => ({ ...R.newProfile(), runs: 2, welcome: true, guide: 'done' });
/** A later profile (no lean first run); in a Legacy build (the demo) with the class's hero at level H. */
const later = (classId, H = 1) => (C.GATES.legacy ? R.debug.setHero(base(), classId, { level: H, xp: 0 }) : base());
const ended = (s) => s.phase === 'SUMMARY' || s.phase === 'ENDED';
function demoGates() {
  let saved = null;
  before(() => { saved = { ...C.GATES }; R.applyDemo(); });
  after(() => { R.setGates(saved); });
}
/** A demo run of classId (hero H) after START_RUN, autoplayed to zone 1's hub. */
function demoZone1(classId, seed, H = 1) {
  let s = R.step(R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile: later(classId, H) }), { type: 'START_RUN' }).state;
  for (let n = 0; n < 400 && !(s.zone && s.zone.z === 1 && !s.zone.camp); n++) { const a = R.autoAction(s); if (!a) break; s = R.step(s, a).state; }
  return s;
}
const top = (mv) => Math.max(...mv.bands.map((b) => b[1]));

describe('signalPlan and fightSignal (rules 7.12 Signal)', () => {
  test('the script\'s Signal turn is not a signature turn; one caller, SIGNAL_ADDS, at round 4 with the engage round', () => {
    const k = C.OPENING_SCRIPT.skulker.indexOf('signal') + 1;
    assert.notEqual(k, C.SIGNATURE_TURN);
    assert.notEqual(k, C.SIGNATURE_TURN_2);
    const sk = Object.keys(CONTENT.enemies).find((t) => CONTENT.enemies[t].archetype === 'skulker');
    const br = Object.keys(CONTENT.enemies).find((t) => CONTENT.enemies[t].archetype === 'brute');
    assert.equal(signalPlan(CONTENT, [sk]), null, 'alone: no Signal');
    assert.deepEqual(signalPlan(CONTENT, [br, sk, sk]), { count: C.SIGNAL_ADDS, round: 4, by: 1 });
    assert.deepEqual(signalPlan(CONTENT, [br, sk], false), { count: C.SIGNAL_ADDS, round: 3, by: 1 });
    assert.equal(signalPlan(CONTENT, [br, br]), null);
  });
  for (const gate of ['full', 'demo']) {
    describe(gate, () => {
      if (gate === 'demo') demoGates();
      test('autoplayed runs: the plan at each fight start matches the map view, fightSignal and every signal summon', () => {
        let fights = 0; let called = 0; let planned = 0;
        for (const classId of ['rogue', 'mage', 'hunter']) for (const seed of [11, 12, 13]) {
          let s = gate === 'demo' ? demoZone1(classId, seed) : R.step(R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile: later(classId) }), { type: 'START_RUN' }).state;
          let cur = null; // the fight under way: { plan, seen }
          for (let n = 0; n < 6000 && !ended(s); n++) {
            const a = R.autoAction(s); if (!a) break;
            const prev = s; const r = R.step(s, a); s = r.state;
            if (s.fight && (!prev.fight || prev.fight !== s.fight && prev.fight.over) && s.fight.round === 1 && s.node && s.node.id != null) {
              const f = s.fight; const zn = s.zone.nodes[s.node.id];
              const startTids = f.enemies.filter((e) => !e.unscripted).map((e) => e.tid);
              const plan = signalPlan(CONTENT, startTids);
              const live = R.fightSignal(s);
              assert.deepEqual(live && { count: live.count, round: live.round }, plan && { count: plan.count, round: plan.round }, 'fightSignal = plan at round 1');
              // the map's plan for the node's fight (Dimmed encounters and guided overlays aside)
              const mvn = R.mapView(s).nodes[zn.id];
              const own = f.kind === 'quest' || f.kind === 'grind' || f.kind === 'elite' || f.kind === 'trash';
              if (own && !zn.tutRole && !mvn.dimmed && f.k === 0 && mvn.calls !== undefined && f.kind !== 'trash') assert.deepEqual(mvn.calls, plan && { count: plan.count, round: plan.round }, `${f.kind} node ${zn.id}`);
              if (f.kind === 'trash' && mvn.fightCalls && !mvn.dimmed) assert.deepEqual(mvn.fightCalls[f.k], plan && { count: plan.count, round: plan.round }, `dungeon fight ${f.k}`);
              cur = { plan, round: null };
              fights++; if (plan) planned++;
            }
            const sum = r.events.filter((e) => e.t === 'summon' && e.signal);
            if (sum.length && prev.fight) {
              assert.ok(cur && cur.plan, 'a signal summon in a fight planned to call nobody');
              assert.equal(prev.fight.round, cur.plan.round, 'the summon came at the planned round');
              assert.equal(sum.length, cur.plan.count);
              called++;
            }
          }
        }
        assert.ok(fights > 30 && planned > 3 && called > 0, `fights ${fights}, planned ${planned}, called ${called}`);
      });
    });
  }
});

describe('demo.md 4.4 (draft): a demo zone\'s quests', () => {
  demoGates();
  test('zones 1 and 2: no quest set up twice, none above the band; Quest nodes past the zone\'s quests are Grinds', () => {
    let z2 = 0; let grinds = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = demoZone1('rogue', seed, 1 + (seed % 5));
      const checked = new Set();
      for (let n = 0; n < 6000 && !ended(s); n++) {
        if (s.zone && !s.zone.camp && s.zone.mode === 'expedition' && !checked.has(s.zone.z)) {
          checked.add(s.zone.z);
          const qs = s.zone.nodes.filter((x) => x.type === 'quest');
          const ids = qs.map((x) => x.quest);
          assert.equal(new Set(ids).size, ids.length, `seed ${seed} zone ${s.zone.z}: ${ids}`);
          const mv = R.mapView(s);
          for (const x of qs) assert.ok(x.cl <= top(mv), `seed ${seed} zone ${s.zone.z}: quest at ${x.cl} above ${top(mv)}`);
          if (ids.length === CONTENT.zones[s.zone.z - 1].quests.length) grinds++;
          if (s.zone.z === 2) { z2++; break; }
        }
        const a = R.autoAction(s); if (!a) break; s = R.step(s, a).state;
      }
    }
    assert.ok(z2 > 5, `zone 2 reached ${z2} times`);
    assert.ok(grinds > 0);
  });
  test('the guided first run keeps its zone 1 (scripted quest roles)', () => {
    const s0 = R.step(R.newRun({ classId: 'rogue', seed: 7, content: CONTENT, profile: R.newProfile(), tutorial: true }), { type: 'START_RUN' }).state;
    let s = s0;
    for (let n = 0; n < 400 && !(s.zone && s.zone.z === 1 && !s.zone.camp); n++) { const a = R.autoAction(s); if (!a) break; s = R.step(s, a).state; }
    assert.ok(s.tutorial && s.tutorial.on);
    const qs = s.zone.nodes.filter((x) => x.type === 'quest');
    assert.ok(qs.length > CONTENT.zones[0].quests.length || qs.some((x, i) => qs.findIndex((y) => y.quest === x.quest) !== i), 'the guided zone draws as before');
  });
});

describe('demo off: quests drawn as before', () => {
  test('a full-game zone can offer a quest twice (the rule is the demo\'s alone)', () => {
    let rep = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = R.step(R.newRun({ classId: 'rogue', seed, content: CONTENT, profile: later('rogue') }), { type: 'START_RUN' }).state;
      let t = s;
      for (let n = 0; n < 400 && !(t.zone && t.zone.z === 1 && !t.zone.camp); n++) { const a = R.autoAction(t); if (!a) break; t = R.step(t, a).state; }
      const ids = t.zone.nodes.filter((x) => x.type === 'quest').map((x) => x.quest);
      if (new Set(ids).size < ids.length) rep++;
    }
    assert.ok(rep > 0);
  });
});
