// M3 guided first run (docs/specs/m3-onboarding.md 2, 4.2, 5 E1-E8; D135, D137, D138; engine-api.md 14): newRun's
// `tutorial` option, zone 1 on TUTORIAL_SEED with the content's overlay (board slot 1, site fights, scripts S1-S4, S1's
// loot, the D138 wind-ups, Gorrak and his gate), the rescue, SKIP_GUIDE, the beats and tutorialView, the profile's guide
// and welcome, the summary's welcome line and tutorial block, debug.resetOnboarding, the table's validation, and the
// golden check: rows and expedition runs without the option play exactly as before task 3.4 (hashes recorded on 25a8879)
// with C.GATES.rewardPrimary (D144), zone2InnerCap (D146) and z1Dmg (D147) off; each switch's arm has its own recorded hashes.
// D142 (M3 3.7): the guided zone's Roads closed until Gorrak's fight has ended (won, fled or rescued), open on a skip, the
// fallback when he can no longer be fought, G13.closed, the autoplay's way to him; G10 only on the map, G12's return cap.
// D147: a rescue lands on the map with no fight started (it looped in Dimmed nodes), and ONB_RESCUE_MAX rescues end the
// guide. D149: S3's Hexer winds up on its turn ONB_WINDUP_TURN (1), so W in the engage round answers it in that step
// (the route measure per class, autoplay and following the joint line); ui-2026-11-14 finding 1 (draft): the joint line
// gives way after the engage round; the content lines guide.rescueLeftLine and guide.skipLine (draft). Spec 2.8 item 8
// (Lead decision 2026-11-14, draft): from round 2 G8's own line only while windupView lists an answer; guide.roadsOpenLine.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
const run = (classId = 'mage', seed = 5, opts = {}) => R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, tutorial: true, ...opts });
const steps = (s, list) => { const events = []; for (const a of list) { const r = R.step(s, a); s = r.state; events.push(...r.events); } return { state: s, events }; };
/** A guided run on the map at zone 1's hub, the board slot 1 Cull taken. */
const atHub = (classId = 'mage', seed = 5, take = true) => steps(run(classId, seed), [{ type: 'START_RUN' }, ...(take ? [{ type: 'TAKE_CONTRACT', index: 0 }] : []), { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]).state;
/** Autoplay until no fight, node, reward or loot window is open. */
function settle(s, events = []) {
  for (let n = 0; (s.fight || s.phase === 'NODE' || (s.loot && s.loot.length)) && n < 400; n++) { const r = R.step(s, R.autoAction(s)); s = r.state; events.push(...r.events); }
  return s;
}
/** Kill the player in the current fight: HP 1, every enemy's damage huge, PASS until the fight ends. */
function die(s, events = []) {
  s = JSON.parse(JSON.stringify({ ...s, content: undefined })); s.content = CONTENT;
  s.player.hp = 1;
  for (const e of s.fight.enemies) e.dmg = 1e6;
  for (let n = 0; s.fight && n < 10; n++) { const r = R.step(s, { type: 'PASS' }); s = r.state; events.push(...r.events); }
  return s;
}
/** The state with a changed tutorial counter, refreshed by a no-op action (the overlay is laid on after each action). */
function withScript(s, script) {
  s = JSON.parse(R.serialize(s)); s.content = CONTENT;
  s.tutorial.script = script;
  return steps(s, [{ type: 'SET_AUTOPLAY', on: true }, { type: 'SET_AUTOPLAY', on: false }]).state;
}
/** A copy changed by fn, refreshed by a no-op action (two SET_AUTOPLAY; no tolls, so no settle step). */
function tweak(s, fn, events = []) {
  s = JSON.parse(R.serialize(s)); s.content = CONTENT;
  fn(s);
  const r = steps(s, [{ type: 'SET_AUTOPLAY', on: true }, { type: 'SET_AUTOPLAY', on: false }]);
  events.push(...r.events);
  return r.state;
}
/** Walk to node `to` by the fewest hops around barred nodes: PASS_THROUGH where legal, else MOVE (a walk). */
function walkTo(s, to, events = []) {
  const nodes = s.zone.nodes;
  const prev = nodes.map(() => -1);
  const q = [s.zone.pos];
  for (let i = 0; i < q.length; i++) for (const v of nodes[q[i]].nb) if (prev[v] < 0 && v !== s.zone.pos && !nodes[v].barred) { prev[v] = q[i]; q.push(v); }
  const path = [];
  for (let x = to; x !== s.zone.pos; x = prev[x]) path.unshift(x);
  for (const id of path) {
    const a = R.whyIllegal(s, { type: 'PASS_THROUGH', nodeId: id }) ? { type: 'MOVE', nodeId: id } : { type: 'PASS_THROUGH', nodeId: id };
    const r = R.step(s, a); s = r.state; events.push(...r.events);
  }
  return s;
}
/** Win the current fight: every enemy at 1 HP, then the autoplay (settle) ends it. */
function win(s, events = []) {
  s = JSON.parse(R.serialize(s)); s.content = CONTENT;
  for (const e of s.fight.enemies) e.hp = 1;
  return settle(s, events);
}
const roadsOf = (s) => s.zone.roads.map((r) => !!s.zone.nodes[r].closed);
/** The Dimming's front at zone toll zt (expedition.js frontAt, from C). */
const frontAt = (zt) => (zt < C.DIM_GRACE ? -1 : Math.floor((C.DIM_FRONT_HOPS * (zt - C.DIM_GRACE)) / C.DIM_FRONT_TIME));
/**
 * G12's trigger anew (D141): the zone time moved to the first toll at which the front is within ONB_DIM_NEAR_HOPS of the
 * player, its `near` mark cleared, refreshed by tweak's no-op steps (which see the trigger; their events go to `events`).
 */
function frontNear(s, events = []) {
  let zt = s.time - s.zone.start;
  while (frontAt(zt) < s.zone.shardDist[s.zone.pos] - C.ONB_DIM_NEAR_HOPS) zt++;
  return tweak(s, (x) => { x.time = x.zone.start + zt; x.tutorial.beats.G12.near = false; }, events);
}
/** On node 1 next to Gorrak (node 18), his gate open: the scripts counted as ended. */
const nextToGorrak = (classId = 'mage') => withScript(walkTo(atHub(classId, 5), 1), 4);

describe('M3 guided run: newRun, seed and overlay (m3-onboarding 2.1-2.3, E1, E2)', () => {
  test('E1 tutorial is an expedition option with the start camp; state.tutorial from START_RUN; never in a normal run', () => {
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, tutorial: true, mapMode: 'rows' }), /tutorial/);
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, tutorial: true, prep: false }), /tutorial/);
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, tutorial: 'yes' }), /tutorial/);
    assert.throws(() => R.newRun({ classId: 'mage', content: { ...CONTENT, tutorial: undefined }, tutorial: true, validate: false }), /CONTENT.tutorial/);
    const s = steps(run(), [{ type: 'START_RUN' }]).state;
    assert.equal(s.phase, 'PREP');
    assert.deepEqual({ ...s.tutorial, beats: undefined }, { on: true, skipped: false, ended: false, rescues: 0, script: 0, sites: 0, elite: null, beats: undefined });
    const n = steps(R.newRun({ classId: 'mage', seed: 5, content: CONTENT }), [{ type: 'START_RUN' }]).state;
    assert.equal(n.tutorial, undefined);
    assert.equal(n.create.tutorial, undefined);
    assert.equal(R.tutorialView(n), null);
  });

  test('2.3 zone 1 is the same on every run seed and class (TUTORIAL_SEED 8736: sites 1, 4, 7, Gorrak on 18); zone 2 is not', () => {
    const z1 = new Set();
    const z2 = new Set();
    for (const [classId, seed] of [['rogue', 1], ['mage', 2], ['hunter', 99], ['mage', 4242], ['rogue', 123456]]) {
      const s = atHub(classId, seed);
      const z = s.zone;
      z1.add(JSON.stringify({ map: z.nodes.map((n) => [n.type, n.nb, n.cl, n.mobs || (n.waves && n.waves[0]) || n.elite || null]), sites: z.nodes.filter((n) => n.sites).map((n) => n.id), roads: z.roads, shard: z.shardfall }));
      const t = R.debug.nextZone(s).state;
      z2.add(JSON.stringify(t.zone.nodes.map((n) => [n.type, n.nb])));
    }
    assert.equal(z1.size, 1, 'one guided zone');
    assert.ok(z2.size > 1, 'zone 2 follows the run seed');
    const s = atHub();
    assert.deepEqual(s.zone.nodes.filter((n) => n.sites).map((n) => n.id), [1, 4, 7]);
    assert.deepEqual([s.zone.roads, s.zone.shardfall], [[23, 27, 19], 25]);
    assert.equal(R.tutorialView(s).eliteNodeId, 18);
    assert.equal(C.TUTORIAL_SEED, CONTENT.tutorial.seed);
  });

  test('2.3 board slot 1 is the content Cull; the other slots are those of the same seed without the option', () => {
    const g = R.prepView(steps(run('rogue', 77), [{ type: 'START_RUN' }]).state);
    const n = R.prepView(steps(R.newRun({ classId: 'rogue', seed: 77, content: CONTENT }), [{ type: 'START_RUN' }]).state);
    assert.deepEqual([g.board[0].z, g.board[0].kind, g.board[0].regionName, g.board[0].family, g.board[0].need], [1, 'cull', 'Barleyreach Verge', 'wild', C.CONTRACT.cull.sites]);
    assert.deepEqual(g.board.slice(1), n.board.slice(1));
  });

  test('2.3 scripts S1-S4 play by order on non-site Quest or Grind nodes, sites play site_1 then site_2; levels; D138 wind-ups; S1 loot', () => {
    let s = atHub('mage', 5);
    assert.equal(s.zone.nodes[9].cl, Math.min(s.zone.nodes[9].gen.cl, C.ONB_SCRIPT_LEVEL_MAX), 'a script node shows the capped level');
    const seen = [];
    for (const id of [2, 1, 6, 5, 4]) {
      const r = R.step(s, { type: 'MOVE', nodeId: id });
      s = r.state;
      const f = r.events.find((e) => e.t === 'fight');
      seen.push([s.fight.tut.id, f.enemies.map((e) => e.name).join('+'), f.enemies[0].level, s.fight.enemies.some((e) => e.track.some((x) => x.windup))]);
      const ev = [];
      s = settle(s, ev);
      if (id === 2) {
        const loot = ev.filter((e) => e.t === 'loot').map((e) => e.item);
        assert.equal(loot.length, 2, 'S1: fixed loot only');
        assert.deepEqual([loot[0].kind, loot[0].rarity, loot[0].slot], ['gear', 'uncommon', 'head'], 'the weakest slot');
        assert.ok(R.itemScore(loot[0], 'mage') > 0);
        assert.deepEqual([loot[1].id, loot[1].qty], ['healing_draught', C.ONB_LOOT_POTIONS]);
      }
    }
    // D147 (spec 2.8, the D145 fix): S3 is the wind-up fight (the Hexer and the Boar), S4 the Ogre and the Wolf
    assert.deepEqual(seen, [
      ['s1', 'Furrow Boar', 3, false], ['site_1', 'Furrow Boar', 4, false], ['s2', 'Hedge Ogre', 2, false],
      ['s3', 'Scarecrow Hexer+Furrow Boar', 4, true], ['site_2', 'Furrow Boar+Barn Wolf', 3, false],
    ]);
    assert.deepEqual([s.tutorial.script, s.tutorial.sites], [3, 2]);
    // S3 (the third scripted fight, before Gorrak's gate): only the Hexer, marked windup, winds up; D149 (spec 2.8 item 6):
    // on its turn ONB_WINDUP_TURN (1, round 2), its Bolt; Hex Bolt on turn 2 is a normal cast. Its quest is Straw and Tusk
    const t3 = withScript(atHub('mage', 5), 2);
    const f3 = R.step(t3, { type: 'MOVE', nodeId: 2 }).state.fight;
    assert.equal(f3.tut.id, 's3');
    assert.equal(C.ONB_WINDUP_TURN, 1);
    assert.deepEqual(f3.enemies.map((e) => e.track.filter((x) => x.windup).map((x) => [x.turn, x.id])), [[[C.ONB_WINDUP_TURN, 'bolt']], []]);
    assert.deepEqual(f3.enemies.map((e) => [e.firstMeet, e.windupTurn]), [[true, C.ONB_WINDUP_TURN], [undefined, undefined]]);
    const hex2 = f3.enemies[0].track.find((x) => x.turn === 2);
    assert.deepEqual([hex2.id, !!hex2.windup, hex2.cast], ['hex_bolt', false, true], 'turn 2: Hex Bolt, a normal cast');
    assert.deepEqual(R.windupView(R.step(t3, { type: 'MOVE', nodeId: 2 }).state).map((w) => [w.u, w.turn, w.round, w.firstMeet, w.deathblow]), [[0, 1, 2, true, false]]);
    assert.deepEqual(CONTENT.tutorial.scripts.map((x) => x.quest), ['q_z1_guide_rooted_rows', 'q_z1_guide_hedge_breaker', 'q_z1_guide_straw_and_tusk', 'q_z1_lost_lambs']);
    // S4 (after the gate): the Ogre and the Wolf, no wind-up in the guided zone
    const t = withScript(atHub('mage', 5), 3);
    const f = R.step(t, { type: 'MOVE', nodeId: 2 }).state.fight;
    assert.equal(f.tut.id, 's4');
    assert.deepEqual(f.enemies.map((e) => e.name), ['Hedge Ogre', 'Barn Wolf']);
    const w = f.enemies.map((e) => e.track.filter((x) => x.windup).map((x) => [x.turn, x.id]));
    assert.deepEqual(w, [[], []]);
    // After the scripts, a quest fight of the guided zone has no first-meeting wind-up (D138)
    const u = withScript(atHub('mage', 5), 4);
    const q = R.step(u, { type: 'MOVE', nodeId: 6 }).state.fight;
    assert.equal(q.tut, undefined);
    assert.ok(q.enemies.every((e) => !e.firstMeet && !e.track.some((x) => x.windup)));
  });

  test('2.3 Gorrak: the nearest Elite, alone, never rare, level clamp; barred until s3 ended (D138, D143), open after SKIP_GUIDE', () => {
    let s = steps(atHub('rogue', 3), [{ type: 'MOVE', nodeId: 1 }]).state;
    s = settle(s);
    const n = s.zone.nodes[18];
    assert.deepEqual([n.elite, n.rare, n.add], [CONTENT.tutorial.elite.enemy, false, null]);
    assert.equal(n.eliteLevel, Math.max(C.ONB_ELITE_LEVEL_MIN, Math.min(C.ONB_ELITE_LEVEL_MAX, s.player.level)));
    assert.match(R.whyIllegal(s, { type: 'MOVE', nodeId: 18 }), /closed/);
    assert.match(R.whyIllegal(s, { type: 'PASS_THROUGH', nodeId: 18 }), /closed/);
    const mv = R.mapView(s);
    assert.equal(mv.nodes[18].barred, true);
    assert.equal(mv.moves.find((m) => m.nodeId === 18).barred, true);
    // D143: the gate is S3 (the third scripted fight), so `left` counts down from 3
    assert.equal(CONTENT.tutorial.elite.gate.afterScript, 's3');
    assert.deepEqual([R.tutorialView(s).elite.barred, R.tutorialView(s).elite.left], [true, 3 - s.tutorial.script]);
    assert.ok(!R.legalActions(s).some((a) => a.nodeId === 18 && (a.type === 'MOVE' || a.type === 'PASS_THROUGH')));
    const two = withScript(s, 2);
    assert.match(R.whyIllegal(two, { type: 'MOVE', nodeId: 18 }), /closed/, 'barred after S2');
    assert.deepEqual([R.tutorialView(two).elite.barred, R.tutorialView(two).elite.left], [true, 1]);
    const open = withScript(s, 3);
    assert.equal(R.whyIllegal(open, { type: 'MOVE', nodeId: 18 }), null, 'open once S3 has ended');
    assert.deepEqual([R.tutorialView(open).elite.barred, R.tutorialView(open).elite.left], [false, 0]);
    const skipped = R.step(s, { type: 'SKIP_GUIDE' }).state;
    assert.equal(R.whyIllegal(skipped, { type: 'MOVE', nodeId: 18 }), null);
    assert.equal(skipped.zone.nodes[18].barred, undefined);
    const g = R.step(open, { type: 'MOVE', nodeId: 18 }).state.fight;
    assert.deepEqual([g.enemies.length, g.enemies[0].tid, g.enemies[0].level], [1, 'z1_gorrak', open.zone.nodes[18].eliteLevel]);
    assert.ok(g.enemies[0].track.some((x) => x.deathblow && x.heavy), 'his Deathblow (Threshing Blow, heavy)');
  });
});

describe('M3 guided run: rescue and SKIP_GUIDE (2.2, 2.6, E3, E4)', () => {
  test('E3 a death in the guided zone is a rescue: back to the last node, full HP and mana, node unresolved, +ONB_RESCUE_TOLLS, Ember kept', () => {
    let s = R.step(atHub('hunter', 8), { type: 'MOVE', nodeId: 2 }).state;
    s.player.bag.push({ uid: 9999, kind: 'cons', id: 'ember_of_return', qty: 1 });
    const t0 = s.time;
    const ev = [];
    s = die(s, ev);
    const r = ev.find((e) => e.t === 'rescue');
    assert.ok(r && !ev.some((e) => e.t === 'death' && e.u === 'player') && !ev.some((e) => e.t === 'resurrect'));
    assert.deepEqual([r.tolls, r.node, r.to], [C.ONB_RESCUE_TOLLS, 2, 0]);
    assert.equal(s.time, t0 + C.ONB_RESCUE_TOLLS);
    assert.deepEqual([s.zone.pos, s.phase, s.zone.nodes[2].done, s.node, s.fight], [0, 'ZONE_HUB', false, null, null]);
    assert.deepEqual([s.player.hp, s.player.mana, s.player.pet.alive, s.player.pet.hp], [s.player.d.maxHp, s.player.d.maxMana, true, s.player.d.petMaxHp]);
    assert.equal(s.player.bag.filter((x) => x.id === 'ember_of_return').length, 1, 'no resurrect used');
    assert.deepEqual([s.tutorial.rescues, s.tutorial.script], [1, 1], 'S1 ended by the rescue (D138)');
    assert.equal(R.tutorialView(s).rescues, 1);
    assert.equal(R.summary(s).tutorial.rescues, 1);
  });

  test('E3 after SKIP_GUIDE, and in zone 2, a death ends the run', () => {
    const a = die(R.step(R.step(atHub('rogue', 8), { type: 'MOVE', nodeId: 2 }).state, { type: 'SKIP_GUIDE' }).state);
    assert.deepEqual([a.phase, a.outcome], ['SUMMARY', 'death']);
    let b = R.debug.nextZone(atHub('rogue', 8)).state;
    b = steps(b, [{ type: 'LEAVE_HUB' }]).state;
    const id = b.zone.nodes[0].nb.find((x) => ['quest', 'grind'].includes(b.zone.nodes[x].type));
    b = R.step(b, { type: 'MOVE', nodeId: id }).state;
    while (!b.fight && b.node) b = R.step(b, R.autoAction(b)).state;
    b = die(b);
    assert.deepEqual([b.phase, b.outcome], ['SUMMARY', 'death']);
  });

  test('E4 SKIP_GUIDE: any phase of a guided run (a fight, the loot window) until the guide ends; once; guideSkipped; no other change', () => {
    const p = steps(run(), [{ type: 'START_RUN' }]).state;
    assert.equal(R.whyIllegal(p, { type: 'SKIP_GUIDE' }), null);
    assert.ok(R.legalActions(p).some((a) => a.type === 'SKIP_GUIDE'));
    const f = R.step(atHub(), { type: 'MOVE', nodeId: 2 }).state;
    const r = R.step(f, { type: 'SKIP_GUIDE' });
    assert.deepEqual(r.events.filter((e) => e.t === 'guideSkipped').length, 1);
    const unbar = (nodes) => nodes.map((n) => ({ ...n, barred: undefined, closed: undefined }));
    assert.deepEqual([r.state.tutorial.skipped, unbar(r.state.zone.nodes), r.state.fight.enemies], [true, unbar(f.zone.nodes), f.fight.enemies]);
    assert.deepEqual([f.zone.nodes[18].barred, r.state.zone.nodes[18].barred], [true, undefined], 'Gorrak opens (D138)');
    assert.deepEqual([roadsOf(f), roadsOf(r.state)], [[true, true, true], [false, false, false]], 'and the Roads (D142)');
    assert.match(R.whyIllegal(r.state, { type: 'SKIP_GUIDE' }), /already/);
    const v = R.tutorialView(r.state);
    assert.deepEqual([v.guidedZone, v.beat, v.line], [false, null, null]);
    const loot = JSON.parse(R.serialize(atHub())); loot.content = CONTENT;
    loot.loot = [{ uid: 777, kind: 'junk', name: 'x', level: 1, qty: 1 }];
    assert.equal(R.whyIllegal(loot, { type: 'SKIP_GUIDE' }), null);
    const n = steps(R.newRun({ classId: 'mage', content: CONTENT }), [{ type: 'START_RUN' }]).state;
    assert.match(R.whyIllegal(n, { type: 'SKIP_GUIDE' }), /not a guided run/);
    assert.ok(!R.legalActions(n).some((a) => a.type === 'SKIP_GUIDE'));
    const z2 = R.step(atHub(), { type: 'SET_AUTOPLAY', on: true }).state;
    const ended = R.debug.nextZone(z2).state;
    const e2 = R.step(ended, { type: 'SET_AUTOPLAY', on: false });
    assert.ok(e2.events.some((e) => e.t === 'guideEnd'));
    assert.match(R.whyIllegal(e2.state, { type: 'SKIP_GUIDE' }), /ended/);
  });
});

describe('M3 D147: a rescue starts no fight; ONB_RESCUE_MAX rescues end the guide (2.6)', () => {
  /** Guided Hunter at the hub with the zone time at zt (seed 8736: node 4 dims at 11, node 3 and the hub at 14). */
  const atTime = (zt) => tweak(atHub('hunter', 8), (x) => { x.time = x.zone.start + zt; });
  const kinds = (ev) => ev.map((e) => e.t);

  test('a death in a Dimmed encounter: back on the map on its Dimmed node with no fight (it started another one at once, for ever); the next step is checked as usual', () => {
    assert.equal(C.ONB_RESCUE_MAX, 3);
    const s0 = atTime(11);
    assert.deepEqual([R.mapView(s0).nodes[4].dimmed, R.mapView(s0).nodes[0].dimmed], [true, false]);
    let s = R.step(s0, { type: 'MOVE', nodeId: 4 }).state; // a walk onto a Dimmed node: the settle step's encounter
    assert.equal(s.node.type, 'dim');
    const ev = [];
    s = die(s, ev);
    const r = ev.find((e) => e.t === 'rescue');
    assert.deepEqual([r.node, r.to], [4, 4]);
    assert.ok(!kinds(ev.slice(ev.indexOf(r))).includes('dim') && !kinds(ev.slice(ev.indexOf(r))).includes('fight'), 'no encounter after the rescue');
    assert.deepEqual([s.zone.pos, s.phase, s.node, s.fight, s.exp.pending], [4, 'MAP', null, null, false]);
    assert.ok(R.mapView(s).nodes[4].dimmed, 'still on a Dimmed node');
    assert.deepEqual([s.tutorial.rescues, s.tutorial.skipped, R.tutorialView(s).guidedZone], [1, false, true]);
    assert.ok(R.legalActions(s).some((a) => a.type === 'MOVE') && R.legalActions(s).some((a) => a.type === 'RING_BELL'), 'the player can act');
    // the next step's tolls are checked as usual: a walk onto Dimmed node 3 starts its encounter
    const m = R.step(s, { type: 'MOVE', nodeId: 3 });
    assert.ok(m.events.some((e) => e.t === 'dim' && e.id === 3));
    assert.equal(m.state.node.type, 'dim');
  });

  test('a death in a node fight back to a Dimmed node: on the map there with no fight; a Bell that was ringing completes', () => {
    // through node 3 (a pass) into node 11's fight; node 3 dims (zone toll 14) during it
    let s = R.step(walkTo(atHub('hunter', 8), 3), { type: 'MOVE', nodeId: 11 }).state;
    assert.ok(s.fight && s.zone.pos === 11);
    s = tweak(s, (x) => { x.time = x.zone.start + 14; });
    const ev = [];
    s = die(s, ev);
    assert.deepEqual([ev.find((e) => e.t === 'rescue').to, s.zone.pos, s.phase, s.fight], [3, 3, 'MAP', null]);
    assert.ok(R.mapView(s).nodes[3].dimmed && !kinds(ev).includes('dim'));
    assert.equal(s.zone.nodes[11].done, false, 'the node stays unresolved');
    // the Bell on a Dimmed node: its encounter first (rules 1.9.7); a rescue from it lands with no fight and the Bell completes
    const b = R.step(s, { type: 'RING_BELL' }).state;
    assert.deepEqual([b.node.type, b.exp.bellPending], ['dim', true]);
    const bev = [];
    const t = die(b, bev);
    assert.ok(bev.some((e) => e.t === 'rescue') && bev.some((e) => e.t === 'travel' && e.by === 'bell'));
    assert.deepEqual([t.zone.z, t.phase, t.fight, t.tutorial.rescues, t.tutorial.ended], [2, 'ZONE_HUB', null, 2, true]);
  });

  test('the ONB_RESCUE_MAX-th rescue ends the guide as SKIP_GUIDE (guideSkipped why rescues; the Roads and Gorrak open); the next death ends the run', () => {
    let s = atHub('rogue', 8);
    const evs = [];
    for (let k = 1; k <= C.ONB_RESCUE_MAX; k++) {
      if (s.phase === 'ZONE_HUB') s = R.step(s, { type: 'LEAVE_HUB' }).state;
      s = R.step(s, { type: 'MOVE', nodeId: 2 }).state; // node 2 stays unresolved: each rescue brings the player back
      assert.ok(s.fight, `fight ${k}`);
      const ev = [];
      s = die(s, ev);
      evs.push(ev);
      assert.equal(s.tutorial.rescues, k);
      assert.equal(ev.some((e) => e.t === 'guideSkipped'), k === C.ONB_RESCUE_MAX, `rescue ${k}`);
    }
    const last = evs[evs.length - 1];
    assert.deepEqual(last.find((e) => e.t === 'guideSkipped'), { t: 'guideSkipped', why: 'rescues', rescues: C.ONB_RESCUE_MAX });
    assert.ok(kinds(last).indexOf('rescue') < kinds(last).indexOf('guideSkipped'), 'the rescue first');
    const v = R.tutorialView(s);
    assert.deepEqual([v.skipped, v.guidedZone, v.rescues, v.rescueMax, v.beat, v.open], [true, false, 3, C.ONB_RESCUE_MAX, null, []]);
    assert.deepEqual([s.zone.nodes[18].barred, roadsOf(s), R.tutorialView(s).roads.closed], [undefined, [false, false, false], false], 'as after SKIP_GUIDE');
    assert.match(R.whyIllegal(s, { type: 'SKIP_GUIDE' }), /already/);
    // the fourth death is a normal one
    if (s.phase === 'ZONE_HUB') s = R.step(s, { type: 'LEAVE_HUB' }).state;
    s = R.step(s, { type: 'MOVE', nodeId: 2 }).state;
    assert.ok(s.fight);
    const d = die(s);
    assert.deepEqual([d.phase, d.outcome, R.summary(d).tutorial.rescues, R.summary(d).tutorial.skipped], ['SUMMARY', 'death', 3, true]);
    const end = R.step(d, { type: 'END_RUN' }).state;
    assert.equal(end.result.profile.guide, 'skipped');
  });
});

describe('M3 content lines for the UI (draft, engine-2026-11-14b: ui-2026-11-14 findings 3 and 4)', () => {
  /** A line as the UI fills it (placeholders from `num`), and the checks of spec 7.1.7 and SCHEMA 2.11. */
  const fill = (raw, num) => raw.replace(/\{(\w+)\}/g, (m, k) => (k in num ? String(num[k]) : m));
  const plain = (line) => {
    assert.ok(line.length <= C.ONB_HINT_MAX_CHARS, `${line.length} characters: ${line}`);
    assert.ok(!/[{}]/.test(line), `every placeholder filled: ${line}`);
    assert.ok(/\.$/.test(line) && !/[.!?]\s/.test(line), `one sentence: ${line}`);
    assert.ok(!/\bhours?\b|\bh\b|\d\.\d/.test(line), `no hours or decimals: ${line}`);
  };

  test('guide.rescueLeftLine: after each rescue that leaves the guide on, {rescuesLeft} = tutorialView rescueMax - rescues; the ONB_RESCUE_MAX-th shows rescueCapLine instead', () => {
    const G = CONTENT.tutorial.guide;
    assert.ok(G.rescueLeftLine.includes('{rescuesLeft}'), G.rescueLeftLine);
    let s = atHub('rogue', 8);
    const left = [];
    for (let k = 1; k <= C.ONB_RESCUE_MAX; k++) {
      if (s.phase === 'ZONE_HUB') s = R.step(s, { type: 'LEAVE_HUB' }).state;
      s = R.step(s, { type: 'MOVE', nodeId: 2 }).state;
      const ev = [];
      s = die(s, ev);
      const v = R.tutorialView(s);
      assert.ok(ev.some((e) => e.t === 'rescue'), `rescue ${k}`);
      if (ev.some((e) => e.t === 'guideSkipped' && e.why === 'rescues')) { left.push('cap'); continue; }
      const line = fill(G.rescueLeftLine, { rescuesLeft: v.rescueMax - v.rescues });
      plain(line);
      left.push(line);
    }
    assert.deepEqual(left, [...Array.from({ length: C.ONB_RESCUE_MAX - 1 }, (_, i) => fill(G.rescueLeftLine, { rescuesLeft: C.ONB_RESCUE_MAX - 1 - i })), 'cap']);
    assert.equal(left[0], 'Rescues left before the guide ends: 2.');
  });

  test('guide.skipLine: the line of SKIP_GUIDE (guideSkipped without why), one sentence; the end and cap lines stay', () => {
    const G = CONTENT.tutorial.guide;
    const r = R.step(atHub('mage', 5), { type: 'SKIP_GUIDE' });
    assert.deepEqual(r.events.find((e) => e.t === 'guideSkipped'), { t: 'guideSkipped' });
    plain(G.skipLine);
    assert.ok(G.skipLine !== G.endLine && G.skipLine !== G.rescueCapLine && /skip the guide/i.test(G.skipLine));
    for (const k of ['rescueLine', 'rescueCapLine', 'endLine', 'hubLine', 'hubTrainerLine']) assert.equal(typeof G[k], 'string', k);
  });

  test('guide.roadsOpenLine (draft): one plain sentence for the step the guided zone\'s Roads open (tutorialView.roads.closed true, then false, same zone): after Gorrak\'s fight on the autoplay route, and on SKIP_GUIDE', () => {
    const G = CONTENT.tutorial.guide;
    plain(G.roadsOpenLine);
    assert.ok(G.roadsOpenLine.length <= C.ONB_HINT_MAX_CHARS && /\bRoads\b/.test(G.roadsOpenLine) && !/Gorrak/.test(G.roadsOpenLine), G.roadsOpenLine);
    assert.ok(![G.skipLine, G.endLine, G.rescueCapLine].includes(G.roadsOpenLine));
    // its moment on the route (seed 8736): the step that ends Gorrak's fight opens the Roads, in zone 1
    let s = steps(run('mage', 8736), [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }]).state;
    let opened = null;
    for (let n = 0; !opened && n < 3000 && !(s.zone && s.zone.z === 2); n++) {
      const was = R.tutorialView(s).roads;
      const r = R.step(s, R.autoAction(s));
      const now = R.tutorialView(r.state).roads;
      if (was && was.closed && now && !now.closed && r.state.zone.z === 1) opened = r;
      s = r.state;
    }
    assert.ok(opened, 'the Roads opened in zone 1');
    assert.equal(opened.state.tutorial.elite, 'victory', 'after Gorrak\'s fight');
    // ... and at once on a skip
    const k = R.step(atHub('rogue', 5), { type: 'SKIP_GUIDE' });
    assert.deepEqual([R.tutorialView(atHub('rogue', 5)).roads.closed, R.tutorialView(k.state).roads.closed], [true, false]);
  });
});

describe('M3 guided run: beats and tutorialView (2.4-2.7, E5)', () => {
  test('autoplay guided runs reach zone 2 for every class; beats open once each, G1-G5 and G7 learned, the guide ends at zone 2', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      let s = steps(run(classId, 11), [{ type: 'START_RUN' }]).state;
      assert.deepEqual([R.tutorialView(s).beat, R.tutorialView(s).line], ['G1', 'G1']);
      // D150 (verdict "stays after the action"): with a contract held G1's line waits
      s = R.step(s, { type: 'TAKE_CONTRACT', index: 0 }).state;
      assert.deepEqual([R.tutorialView(s).beat, R.tutorialView(s).line, R.tutorialView(s).open], [null, null, [{ id: 'G1', line: null, rest: false }]]);
      const ev = [];
      for (let n = 0; !(s.zone && s.zone.z === 2) && s.phase !== 'ENDED' && n < 3000; n++) { const r = R.step(s, R.autoAction(s)); s = r.state; ev.push(...r.events); }
      assert.equal(s.zone.z, 2, `${classId} reaches zone 2`);
      const opened = ev.filter((e) => e.t === 'beat' && e.what === 'open').map((e) => e.id);
      assert.equal(new Set(opened).size, opened.length, 'each beat opens once');
      // D143: Gorrak opens after S3, so the autoplay route fights him and leaves by a Road without S4; D147 (the D145 fix):
      // S3 is the wind-up fight, so G8 opens there too, before G9
      for (const id of ['G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G12', 'G13']) assert.ok(opened.includes(id), `${classId} ${id}`);
      assert.ok(opened.indexOf('G8') < opened.indexOf('G9'), `${classId}: G8 before G9`);
      // D150: G5 at the first hub, before G2 (the map) and G7 (fight 1); G3 and G9 open with no line
      assert.ok(opened.indexOf('G5') < opened.indexOf('G2') && opened.indexOf('G2') < opened.indexOf('G7'), `${classId}: ${opened.join(' ')}`);
      assert.deepEqual(ev.filter((e) => e.t === 'beat' && ['G3', 'G9'].includes(e.id) && e.line && e.line !== 'G9.landed'), [], 'no G3 or G9 line but the landed one');
      // D142: the autoplay goes to Gorrak while the Roads are closed, so the Deathblow beat happens on its route
      assert.ok(['victory', 'fled', 'rescue'].includes(s.tutorial.elite), `${classId} fought Gorrak`);
      const v = R.tutorialView(s);
      for (const id of ['G1', 'G2', 'G3', 'G4', 'G5', 'G7', 'G9']) assert.ok(v.learned.includes(id), `${classId} learned ${id}`);
      // D150: the Dimming line once (ONB_LINE_RETURNS 0), then G12.road once the Roads are open; no G12.caught
      assert.equal(C.ONB_LINE_RETURNS, 0);
      assert.deepEqual(ev.filter((e) => e.t === 'beat' && e.id === 'G12' && e.line).map((e) => [e.what, e.line]), [['open', 'G12'], ['line', 'G12.road']], `${classId}: G12's lines`);
      assert.deepEqual([v.ended, v.guidedZone, v.beat, v.open], [true, false, null, []]);
      assert.equal(ev.filter((e) => e.t === 'guideEnd').length, 1);
      assert.ok(ev.some((e) => e.t === 'beat' && e.id === 'G13' && e.what === 'done'));
    }
  });

  test('G1 without a contract: missed and G10 skipped; G9 opens in the Gorrak fight with no line (D150: the UI\'s prompt bar gives its answer); a landed Deathblow: G9.landed', () => {
    const s = steps(run('hunter', 4), [{ type: 'START_RUN' }, { type: 'SET_OUT' }]).state;
    const v = R.tutorialView(s);
    assert.deepEqual([v.done.includes('G1'), v.learned.includes('G1'), v.skippedBeats], [true, false, ['G10']]);
    const g = R.step(withScript(settle(R.step(atHub('hunter', 4), { type: 'MOVE', nodeId: 1 }).state), 4), { type: 'MOVE', nodeId: 18 });
    assert.ok(g.events.some((e) => e.t === 'beat' && e.id === 'G9' && e.what === 'open' && e.line === null));
    assert.ok(R.tutorialView(g.state).open.some((o) => o.id === 'G9' && o.line === null));
    assert.notEqual(R.tutorialView(g.state).beat, 'G9');
    const g9 = CONTENT.tutorial.beats.find((b) => b.id === 'G9');
    assert.deepEqual([g9.line, g9.byClass, typeof g9.alt.landed], [undefined, undefined, 'string']);
    // PASS until the Deathblow lands: the landed line
    let t = g.state; const ev = [];
    for (let n = 0; t.fight && n < 6 && !ev.some((e) => e.t === 'empower' && e.deathblow); n++) { const r = R.step(t, { type: 'PASS' }); t = r.state; ev.push(...r.events); }
    assert.ok(ev.some((e) => e.t === 'beat' && e.id === 'G9' && e.what === 'line' && e.line === 'G9.landed'), 'G9.landed');
  });
});

describe('M3 D150: the coach lines\' moments (owner text pass; docs/feedback/2026-11-14-blind-wording.md 4 items 11, 12, 18)', () => {
  test('G5 at the first hub (before the map), G7 in fight 1 (one enemy) and its ENGAGE learns it, G4 on the first upgrade in a fight\'s spoils and never at a reward choice; content lines as approved', () => {
    const T = CONTENT.tutorial;
    const line = (id) => T.beats.find((b) => b.id === id).line;
    assert.equal(line('G5'), 'Every move costs tolls. Spend too many and the final boss gets stronger.');
    assert.equal(line('G7'), 'Round 1 is yours: they act from round 2. Open with {key_engage1}, {key_engage2} or {key_engage3}.');
    assert.equal(line('G4'), 'Green arrow means upgrade. Equip it in your bags {key_bags}.');
    assert.equal(line('G12'), 'The dark spreads from the purple star. Places it reaches are lost.');
    assert.equal(T.beats.find((b) => b.id === 'G12').alt.road, 'Take a Road to leave.');
    assert.equal(line('G3'), null);
    for (const classId of ['rogue', 'mage', 'hunter']) {
      let s = steps(run(classId, 1000), [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }]).state;
      const r = R.step(s, { type: 'SET_OUT' });
      assert.deepEqual([r.state.phase, R.tutorialView(r.state).beat, R.tutorialView(r.state).line], ['ZONE_HUB', 'G5', 'G5'], `${classId}: the hub`);
      s = r.state;
      const seen = [];
      let g4 = null;
      for (let n = 0; !(s.zone && s.zone.z === 2) && n < 3000 && !(g4 && s.tutorial.beats.G7 && s.tutorial.beats.G7.st !== 'open'); n++) {
        const a = R.autoAction(s);
        const x = R.step(s, a);
        const opened = x.events.filter((e) => e.t === 'beat' && e.what === 'open').map((e) => e.id);
        if (opened.includes('G7')) seen.push(['G7', x.state.fight.enemies.length, x.state.stats.fights, x.state.fight.tut.kind]);
        if (x.events.some((e) => e.t === 'loot' && e.item.kind === 'gear') && a.type === 'CHOOSE_REWARD') seen.push(['reward gear', opened.includes('G4')]);
        if (opened.includes('G4')) {
          const it = x.events.find((e) => e.t === 'loot' && e.item.kind === 'gear').item;
          g4 = { a: a.type, victory: x.events.some((e) => e.t === 'victory'), up: R.itemScore(it, classId) > R.itemScore(x.state.player.equipped[it.slot], classId) };
        }
        s = x.state;
      }
      assert.deepEqual(seen[0], ['G7', 1, 1, 'site'], `${classId}: G7 in fight 1, a lone Furrow Boar (${JSON.stringify(seen)})`);
      assert.ok(seen.some((x) => x[0] === 'reward gear') && seen.filter((x) => x[0] === 'reward gear').every((x) => x[1] === false), `${classId}: no G4 at a reward choice`);
      assert.deepEqual(g4, { a: g4.a, victory: true, up: true }, `${classId}: G4 with a fight's spoils, an upgrade`);
      assert.equal(s.tutorial.beats.G7.st, 'done', `${classId}: fight 1's ENGAGE learns G7`);
    }
  });
});

describe('M3 D150 follow-up (Lead 2026-11-14, draft): G14 combo points, G15 resource, G16 Bloodlust, G17 targets', () => {
  const NEW = ['G14', 'G15', 'G16', 'G17'];
  /** The autoplay route (seed 1000), per step: the view's line, the fight's id and round, the G14-G17 beat events. */
  function newMoments(classId) {
    let s = steps(run(classId, 1000), [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }]).state;
    const log = [];
    for (let n = 0; !(s.zone && s.zone.z === 2) && n < 3000; n++) {
      const a = R.autoAction(s);
      const r = R.step(s, a);
      const f = r.state.fight;
      log.push({ n, a, line: R.tutorialView(r.state).line, fight: f && f.tut ? f.tut.id : f ? f.kind : null, round: f ? f.round : null, state: r.state,
        ev: r.events.filter((e) => e.t === 'beat' && NEW.includes(e.id)).map((e) => [e.id, e.what, e.line]) });
      s = r.state;
    }
    return { s, log };
  }
  /** Separate runs of steps in which `id`'s line was the view's line. */
  const showings = (log, id) => log.reduce((k, x, i) => k + ((x.line || '').split('.')[0] === id && !(i > 0 && (log[i - 1].line || '').split('.')[0] === id) ? 1 : 0), 0);

  test('content: four lines (G15 one per class), each one sentence within ONB_HINT_MAX_CHARS, no placeholder; ONB_BEATS has G14-G17 after G13 and they rank after G6, before G10', () => {
    const T = CONTENT.tutorial;
    assert.deepEqual(C.ONB_BEATS.slice(13), NEW);
    const pr = C.ONB_BEAT_PRIORITY;
    assert.ok(NEW.every((id) => pr.indexOf(id) > pr.indexOf('G6') && pr.indexOf(id) < pr.indexOf('G10')));
    const g15 = T.beats.find((b) => b.id === 'G15');
    assert.deepEqual(Object.keys(g15.byClass), ['rogue', 'mage', 'hunter']);
    const lines = [...['G14', 'G16', 'G17'].map((id) => T.beats.find((b) => b.id === id).line), ...Object.values(g15.byClass)];
    for (const line of lines) {
      assert.ok(line.length <= C.ONB_HINT_MAX_CHARS && /\.$/.test(line) && !/[.!?]\s/.test(line) && !/[{}]/.test(line), line);
    }
    assert.match(g15.byClass.rogue, /energy/);
    assert.match(g15.byClass.mage, /mana/);
    assert.match(g15.byClass.hunter, /focus/);
    assert.match(T.beats.find((b) => b.id === 'G17').line, /Tab/);
  });

  test('on the autoplay route (seed 8736, run seed 1000): each opens at its moment from round 2 of a fight, shows once, and the route is unchanged', () => {
    const at = {};
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const { s, log } = newMoments(classId);
      assert.deepEqual(routeSeen(s), ROUTE_SEEN, `${classId}: the route`);
      at[classId] = {};
      for (const id of NEW) {
        const i = log.findIndex((x) => x.ev.some(([b, w]) => b === id && w === 'open'));
        if (i < 0) continue;
        const x = log[i];
        const opened = x.ev.find(([b, w]) => b === id && w === 'open');
        assert.ok(x.round >= 2 && x.state.fight && !x.state.fight.over, `${classId} ${id}: in a fight, round ${x.round}`);
        assert.equal(opened[2], id === 'G15' ? `G15.${classId}` : id, `${classId} ${id}: its line`);
        assert.ok(showings(log, id) <= 1, `${classId} ${id}: shown once (${showings(log, id)})`);
        at[classId][id] = `${x.fight}:R${x.round}:${showings(log, id)}`;
      }
      // G14 only where a finisher can be cast (the Rogue); G16 the step after the first beast acted (site 1's Furrow Boar)
      const g16 = log.find((x) => x.ev.some(([b, w]) => b === 'G16' && w === 'open'));
      assert.ok(g16.state.fight.enemies.some((e) => e.alive && e.arch === 'beast' && e.acted === 1), `${classId}: the badge's first round`);
    }
    assert.deepEqual(at, {
      rogue: { G14: 'site_1:R2:1', G15: 'site_1:R7:1', G16: 'site_1:R3:1' },
      mage: { G16: 'site_1:R3:1', G17: 's3:R2:1' },
      hunter: { G16: 'site_1:R3:1', G17: 's3:R2:1' },
    }, JSON.stringify(at));
  });

  test('G14 opens when a finisher becomes castable (combo points) and a finisher cast learns it; G15 only when a bar spell lacks only resource (by class)', () => {
    // a Rogue in S3's engage round (atS3 below: S1 and S2 counted as ended): Ambush on the Boar gives combo points, the Hexer lives
    const s3 = R.step(withScript(atHub('rogue', 5), 2), { type: 'MOVE', nodeId: 2 }).state;
    const amb = R.legalActions(s3).find((x) => x.type === 'ENGAGE' && x.option === C.ENGAGE_OPTIONS.rogue[0] && x.target === 1);
    const r2 = R.step(s3, amb);
    assert.ok(r2.state.fight.p.cp >= 1 && r2.state.fight.round === 2);
    assert.ok(r2.events.some((e) => e.t === 'beat' && e.id === 'G14' && e.what === 'open' && e.line === 'G14'));
    const fin = r2.state.player.bar.find((id) => id && C.SPELL[id].tags.includes('finisher'));
    const tgt = r2.state.fight.enemies.findIndex((e) => e.alive);
    const r3 = R.step(r2.state, { type: 'CAST', spellId: fin, target: tgt });
    assert.ok(r3.events.some((e) => e.t === 'beat' && e.id === 'G14' && e.what === 'done'), 'a finisher cast learns it');
    // no energy (fight.p.energy 0): Gutting Jab lacks only energy: G15 opens with the Rogue's line
    const live = r3.state.fight.enemies.findIndex((e) => e.alive);
    const dry = tweak(r3.state, (x) => { x.fight.p.energy = 0; x.tutorial.beats.G14 = { st: 'done', line: null, n: 0 }; });
    assert.match(R.whyIllegal(dry, { type: 'CAST', spellId: 'gutting_jab', target: live }) || '', /not enough resource/);
    assert.deepEqual([dry.tutorial.beats.G15.st, dry.tutorial.beats.G15.line], ['open', 'G15.rogue']);
    // energy enough but the spell on cooldown, or only a finisher without combo points: no shortage of resource alone
    const cd = tweak(r3.state, (x) => { x.fight.p.energy = 100; delete x.tutorial.beats.G15; x.fight.p.cp = 0; });
    assert.ok(!cd.tutorial.beats.G15, 'enough energy: no G15');
    // a Mage: never G14 (no finisher)
    const m = R.step(withScript(atHub('mage', 5), 2), { type: 'MOVE', nodeId: 2 }).state;
    const m2 = R.step(m, { type: 'PASS' }).state;
    assert.ok(!m2.tutorial.beats.G14);
  });

  test('G17 opens in round 2 of a fight with two living enemies and is learned by acting on the other one; G16 waits when its moment passes unseen', () => {
    // the Mage in S3: W (Binding Glyph) on the Hexer, then both live in round 2
    const s3 = R.step(withScript(atHub('mage', 5), 2), { type: 'MOVE', nodeId: 2 }).state;
    const r2 = R.step(s3, { type: 'ENGAGE', option: C.ENGAGE_OPTIONS.mage[1], target: 0 });
    assert.ok(r2.events.some((e) => e.t === 'beat' && e.id === 'G17' && e.what === 'open' && e.line === 'G17'));
    assert.deepEqual(R.tutorialView(r2.state).open.find((o) => o.id === 'G17'), { id: 'G17', line: 'G17', rest: false });
    const cast = (x, u) => R.step(x, { type: 'CAST', spellId: x.player.bar.find((id) => id && R.whyIllegal(x, { type: 'CAST', spellId: id, target: u }) === null), target: u });
    const a = cast(tweak(r2.state, (x) => { for (const e of x.fight.enemies) e.hp = e.maxHp = 1e6; }), 1);
    assert.ok(!a.events.some((e) => e.t === 'beat' && e.id === 'G17' && e.what === 'done'), 'the first target is no change');
    const b = cast(a.state, 0);
    assert.ok(b.events.some((e) => e.t === 'beat' && e.id === 'G17' && e.what === 'done'), 'acting on the other living enemy learns it');
    // G16 opened while another line was the top line and its beast died before it showed: it waits (null), open
    const w = tweak(r2.state, (x) => { x.tutorial.beats.G16 = { st: 'open', line: 'G16', n: 0, shown: 0, rest: false, back: 0 }; for (const e of x.fight.enemies) if (e.arch === 'beast') { e.alive = false; e.hp = 0; } });
    assert.deepEqual([w.tutorial.beats.G16.st, w.tutorial.beats.G16.line], ['open', null]);
  });
});

describe('M3 coach lines yield after showing (2.5, D141)', () => {
  test('seed 8736 (D150, the Dimming line once): G12 is the line for ONB_LINE_STEPS map steps, then rests with no other line open; G13 becomes the line when it opens; its trigger again brings nothing back (ONB_LINE_RETURNS 0)', () => {
    assert.deepEqual([C.ONB_LINE_STEPS, C.ONB_LINE_RETURNS], [2, 0]);
    let s = run('rogue', 8736);
    let mapSteps = 0;
    let rested = null;
    let at = null;
    for (let n = 0; !(s.zone && s.zone.z === 2) && s.phase !== 'ENDED' && n < 3000; n++) {
      const r = R.step(s, R.autoAction(s));
      const v = R.tutorialView(r.state);
      const g12 = v.open.find((o) => o.id === 'G12');
      // a map step with G12 the line (its steps count only there: the UI shows it on the map)
      if (v.beat === 'G12' && r.state.phase === 'MAP' && !r.state.node && !r.state.fight) mapSteps += 1;
      if (g12 && g12.rest && !rested) rested = { n, others: v.open.filter((o) => o.line && !o.rest && o.id !== 'G12').map((o) => o.id) };
      if (v.open.some((o) => o.id === 'G13') && g12) { at = r; break; }
      s = r.state;
    }
    assert.ok(rested && at, 'G12 rested, then G13 opened while G12 is open');
    assert.deepEqual(rested.others, [], 'it rested with no other line to yield to');
    assert.equal(mapSteps, C.ONB_LINE_STEPS, 'G12 was the line on ONB_LINE_STEPS map steps');
    const v = R.tutorialView(at.state);
    assert.deepEqual([v.beat, v.line, v.elite.barred, v.roads.closed], ['G13', 'G13.closed', false, true]);
    assert.deepEqual(v.open.find((o) => o.id === 'G12'), { id: 'G12', line: 'G12', rest: true });
    assert.ok(!at.events.some((e) => e.t === 'beat' && e.id === 'G12'), 'G12 stays open, no event');
    // its trigger again (the front comes within ONB_DIM_NEAR_HOPS after a step on which it was not): no return
    const evs = [];
    const back = frontNear(at.state, evs);
    assert.ok(!evs.some((e) => e.t === 'beat' && e.id === 'G12'), 'no return');
    assert.deepEqual(R.tutorialView(back).open.find((o) => o.id === 'G12'), { id: 'G12', line: 'G12', rest: true });
  });

  test('a line with no other open beat line to yield to stays the line (G1 at the start camp after 3 steps); D150: G1 waits (null) while a contract is held, back when none is', () => {
    let s = steps(run('mage', 11), [{ type: 'START_RUN' }, { type: 'SET_AUTOPLAY', on: true }, { type: 'SET_AUTOPLAY', on: false }, { type: 'SET_AUTOPLAY', on: true }]).state;
    let v = R.tutorialView(s);
    assert.deepEqual([v.beat, v.line, v.open], ['G1', 'G1', [{ id: 'G1', line: 'G1', rest: false }]]);
    s = R.step(s, { type: 'TAKE_CONTRACT', index: 0 }).state;
    v = R.tutorialView(s);
    assert.deepEqual([v.beat, v.line, v.open], [null, null, [{ id: 'G1', line: null, rest: false }]]);
    s = R.step(s, { type: 'DROP_CONTRACT', index: 0 }).state;
    assert.deepEqual([R.tutorialView(s).beat, R.tutorialView(s).line], ['G1', 'G1']);
    // learned at SET_OUT with one held, as before
    s = steps(s, [{ type: 'TAKE_CONTRACT', index: 0 }, { type: 'SET_OUT' }]).state;
    assert.ok(R.tutorialView(s).learned.includes('G1'));
  });
});

describe('M3 D142: the Roads open after Gorrak\'s fight (2.3, 2.4 G13)', () => {
  test('in the guided zone the Roads are closed before Gorrak\'s fight: TAKE_ROAD refused, mapView and tutorialView say so; the Bell stays', () => {
    const hub = atHub('mage', 5);
    const v = R.tutorialView(hub);
    assert.deepEqual(v.roads, { closed: true, why: 'elite', node: 18, line: 'G13.closed' });
    assert.deepEqual([v.elite.outcome, v.elite.barred], [null, true]);
    const ev = [];
    const s = walkTo(hub, 23, ev); // through 3 and 11 to Road 23
    assert.equal(s.zone.pos, 23);
    const mv = R.mapView(s);
    assert.deepEqual([mv.onRoad, mv.nodes[23].road], [false, true], 'onRoad: TAKE_ROAD is legal here');
    for (const r of s.zone.roads) assert.equal(mv.nodes[r].closed, true);
    assert.ok(mv.nodes.filter((n) => !n.road).every((n) => n.closed === undefined));
    assert.match(R.whyIllegal(s, { type: 'TAKE_ROAD' }), /closed/);
    assert.ok(!R.legalActions(s).some((a) => a.type === 'TAKE_ROAD'));
    assert.equal(R.whyIllegal(s, { type: 'RING_BELL' }), null, 'the Homeward Bell stays legal');
    // on a closed Road G13 opens with the line that points to Gorrak, even while his node is still barred
    assert.ok(ev.some((e) => e.t === 'beat' && e.id === 'G13' && e.what === 'open' && e.line === 'G13.closed'));
    const raw = CONTENT.tutorial.beats.find((b) => b.id === 'G13').alt.closed;
    assert.ok(typeof raw === 'string' && raw.length <= C.ONB_HINT_MAX_CHARS && raw.includes('Gorrak'));
  });

  test('they open once Gorrak\'s fight has ended: won, fled or rescued (elite.outcome); TAKE_ROAD legal on a Road again', () => {
    const cases = [
      ['mage', (s) => win(s), 'victory', 18],
      ['rogue', (s) => R.step(s, { type: 'FLEE' }).state, 'fled', 18], // a Rogue flees from stealth in round 1 for sure
      ['hunter', (s) => die(s), 'rescue', 1],
    ];
    for (const [classId, end, outcome, pos] of cases) {
      let s = R.step(nextToGorrak(classId), { type: 'MOVE', nodeId: 18 }).state;
      assert.equal(s.fight.tut.kind, 'elite');
      assert.deepEqual([R.tutorialView(s).roads.closed, roadsOf(s)], [true, [true, true, true]], `${classId}: closed during his fight`);
      s = end(s);
      assert.deepEqual([s.fight, s.zone.pos, s.tutorial.elite, R.tutorialView(s).elite.outcome], [null, pos, outcome, outcome], classId);
      assert.deepEqual([R.tutorialView(s).roads, roadsOf(s)], [{ closed: false, why: null, node: null, line: null }, [false, false, false]], classId);
      s = walkTo(s, 19);
      assert.deepEqual([R.whyIllegal(s, { type: 'TAKE_ROAD' }), R.mapView(s).onRoad], [null, true], classId);
      const r = R.step(s, { type: 'TAKE_ROAD' });
      assert.equal(r.state.zone.z, 2);
    }
    // a rescue leaves his node unresolved: he can be fought again, the Roads stay open
    const resc = die(R.step(nextToGorrak('hunter'), { type: 'MOVE', nodeId: 18 }).state);
    assert.equal(resc.zone.nodes[18].done, false);
  });

  test('SKIP_GUIDE opens them at once; a run without the option, the classic map and zone 2 never close them', () => {
    const s = walkTo(atHub('rogue', 7), 23);
    const k = R.step(s, { type: 'SKIP_GUIDE' }).state;
    assert.deepEqual([R.whyIllegal(k, { type: 'TAKE_ROAD' }), R.mapView(k).onRoad, roadsOf(k)], [null, true, [false, false, false]]);
    assert.deepEqual(R.tutorialView(k).roads, { closed: false, why: null, node: null, line: null });
    const early = steps(run('rogue', 7), [{ type: 'START_RUN' }, { type: 'SKIP_GUIDE' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]).state;
    assert.deepEqual([R.tutorialView(early).roads.closed, roadsOf(early)], [false, [false, false, false]], 'skipped at the start camp');
    let n = steps(R.newRun({ classId: 'rogue', seed: 7, content: CONTENT }), [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]).state;
    n = walkTo(n, n.zone.roads[0]);
    assert.deepEqual([R.whyIllegal(n, { type: 'TAKE_ROAD' }), R.mapView(n).onRoad, R.tutorialView(n)], [null, true, null]);
    assert.ok(n.zone.nodes.every((x) => x.closed === undefined) && R.mapView(n).nodes.every((x) => x.closed === undefined));
    const rows = steps(R.newRun({ classId: 'rogue', seed: 7, content: CONTENT, mapMode: 'rows' }), [{ type: 'START_RUN' }, { type: 'LEAVE_HUB' }]).state;
    assert.equal(R.tutorialView(rows), null);
    const z2 = R.step(R.debug.nextZone(atHub()).state, { type: 'SET_AUTOPLAY', on: true }).state;
    assert.deepEqual([z2.zone.z, R.tutorialView(z2).roads.closed, z2.zone.nodes.some((x) => x.closed)], [2, false, false]);
  });

  test('they open when Gorrak can no longer be fought (his node Dimmed, or barred with no script left), never during his fight', () => {
    const hub = atHub('mage', 5);
    const dimAt = R.mapView(hub).nodes[18].dimAt;
    const at = (s, zt) => tweak(s, (x) => { x.time = x.zone.start + zt; });
    assert.deepEqual(roadsOf(at(hub, dimAt - 1)), [true, true, true]);
    const lost = at(hub, dimAt);
    assert.deepEqual([roadsOf(lost), R.tutorialView(lost).roads.closed, lost.tutorial.elite], [[false, false, false], false, null], 'his node Dimmed');
    // barred and every Quest or Grind node that could play a script resolved: the gate can never open
    const scripts = (s) => s.zone.nodes.filter((x) => ['quest', 'grind'].includes(x.type) && !x.sites).map((x) => x.id);
    const one = tweak(hub, (x) => { for (const id of scripts(x).slice(1)) x.zone.nodes[id].done = true; });
    assert.deepEqual([one.zone.nodes[18].barred, roadsOf(one)], [true, [true, true, true]], 'one script left');
    const none = tweak(hub, (x) => { for (const id of scripts(x)) x.zone.nodes[id].done = true; });
    assert.deepEqual([none.zone.nodes[18].barred, roadsOf(none)], [true, [false, false, false]], 'no script left');
    // entered one toll before his node dims: his own tolls dim it during the fight, the Roads stay closed until it ends
    let s = R.step(at(nextToGorrak(), dimAt - 1), { type: 'MOVE', nodeId: 18 }).state;
    assert.ok(R.mapView(s).nodes[18].dimmed);
    assert.equal(R.tutorialView(s).roads.closed, true);
    s = win(s);
    assert.deepEqual([s.tutorial.elite, R.tutorialView(s).roads.closed], ['victory', false]);
  });

  test('G13 points to Gorrak: G13.closed once his node opens; from his fight on its line waits (null), then G13.onRoad on a Road', () => {
    const ev = [];
    let s = tweak(walkTo(atHub('mage', 5), 1), (x) => { x.tutorial.script = 4; }, ev);
    assert.ok(ev.some((e) => e.t === 'beat' && e.id === 'G13' && e.what === 'open' && e.line === 'G13.closed'));
    assert.deepEqual(R.tutorialView(s).open.find((o) => o.id === 'G13'), { id: 'G13', line: 'G13.closed', rest: false });
    assert.equal(R.tutorialView(s).line, 'G13.closed');
    const go = R.step(s, { type: 'MOVE', nodeId: 18 });
    s = go.state;
    assert.ok(go.events.some((e) => e.t === 'beat' && e.id === 'G13' && e.what === 'line' && e.line === null), 'cleared when his fight starts');
    // D150: G9 opens with no line (the UI's prompt bar gives the Deathblow's answer), so no G9 line here
    assert.equal(R.tutorialView(s).roads.closed, true);
    assert.ok(R.tutorialView(s).open.some((o) => o.id === 'G9' && o.line === null) && !/^G9/.test(R.tutorialView(s).line || ''));
    const end = [];
    s = win(s, end);
    assert.ok(!end.some((e) => e.t === 'beat' && e.id === 'G13' && e.line === 'G13.closed'));
    assert.equal(R.tutorialView(s).open.find((o) => o.id === 'G13').line, null);
    s = walkTo(s, 19);
    assert.equal(R.tutorialView(s).open.find((o) => o.id === 'G13').line, 'G13.onRoad');
    const r = R.step(s, { type: 'TAKE_ROAD' });
    assert.ok(r.events.some((e) => e.t === 'beat' && e.id === 'G13' && e.what === 'done'));
  });

  test('autoplay: with the Roads closed it goes to Gorrak once his node opens, and to the next script where it would leave while his node is barred', () => {
    const firstFight = (s) => {
      for (let n = 0; !s.fight && n < 40; n++) { const a = R.autoAction(s); assert.notEqual(a.type, 'TAKE_ROAD'); s = R.step(s, a).state; }
      return s;
    };
    // his node open: from next to him, and from a far Road, the first fight is his (no Road, no other fight on the way)
    for (const start of [nextToGorrak('rogue'), tweak(walkTo(atHub('rogue', 5), 23), (x) => { x.tutorial.script = 4; })]) {
      const t = firstFight(start);
      assert.equal(t.fight && t.fight.tut.kind, 'elite');
    }
    // barred, at the zone's exit level on a closed Road: the nearest scripted fight instead of leaving
    const b = tweak(walkTo(atHub('rogue', 5), 23), (x) => { x.player.level = C.ZONE_LEVELS; });
    assert.equal(R.tutorialView(b).elite.barred, true);
    const u = firstFight(b);
    assert.equal(u.fight && u.fight.tut.kind, 'script');
  });
});

/**
 * The D143 route measure's run (seed 8736, board slot 1 taken): autoplay to zone 2, except S3's engage round under policy
 * 'follow' (D149, spec 2.8 item 6: W, the class's control option, on the winding-up Hexer, as the joint line says), 'pass'
 * (X) or 'boar' (Q, the class's strike option, on the Boar; spec 2.8 item 8). Returns
 * the state at zone 2, the scripted fights started (`id@node:zone toll`), the G7-G9 beat events by step and the steps of
 * the ENGAGE actions.
 */
function guidedRoute(classId, seed, policy = 'auto') {
  let s = steps(run(classId, seed), [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }]).state;
  const fights = [];
  const beats = [];
  const engages = [];
  for (let n = 0; !(s.zone && s.zone.z === 2) && n < 3000; n++) {
    let a = R.autoAction(s);
    const f = s.fight;
    if (policy !== 'auto' && f && f.tut && f.tut.id === 's3' && f.round === 1 && f.engage) {
      if (policy === 'follow') a = { type: 'ENGAGE', option: C.ENGAGE_OPTIONS[classId][1], target: f.enemies.findIndex((e) => e.firstMeet) };
      else if (policy === 'pass') a = { type: 'PASS' };
      else if (policy === 'boar') a = R.legalActions(s).find((x) => x.type === 'ENGAGE' && x.option === C.ENGAGE_OPTIONS[classId][0] && !f.enemies[x.target].firstMeet);
    }
    if (a.type === 'ENGAGE') engages.push(n);
    const r = R.step(s, a);
    if (r.state.fight && !s.fight && r.state.fight.tut) fights.push(`${r.state.fight.tut.id}@${r.state.zone.pos}:${r.state.time - r.state.zone.start}`);
    for (const e of r.events) {
      if (e.t === 'beat' && ['G7', 'G8', 'G9'].includes(e.id)) beats.push({ n, id: e.id, what: e.what, line: e.line, fight: r.state.fight && r.state.fight.tut ? r.state.fight.tut.id : null });
      else if (e.t === 'stagger' && !e.deathblow) beats.push({ n, id: 'stagger', what: e.why, line: null, fight: null, turn: e.turn });
    }
    s = r.state;
  }
  return { s, fights, beats, engages };
}
/** The route's outcome as the D143 measure reads it. */
function routeSeen(s) {
  const z1 = s.stats.exp.zones.find((x) => x.z === 1);
  return { exit: z1.exit, zt: z1.time, dimFights: z1.dimFights, bell: s.exp.bell, elite: s.tutorial.elite, rescues: s.tutorial.rescues, script: s.tutorial.script, level: s.player.level };
}
const ROUTE_SEEN = { exit: 'road', zt: 19, dimFights: 0, bell: C.BELL_START_CHARGES, elite: 'victory', rescues: 0, script: 3, level: 12 };

describe('M3 D143, D147 and D149: Gorrak\'s gate after S3, the wind-up fight S3 before it; the guided zone ends by a Road', () => {
  test('seed 8736, autoplay, 20 run seeds per class: S3 (the wind-up fight) then Gorrak, won, G8 open before G9, G9 learned, zone 1 left by Road 19 at zone toll 19 with no Dimmed encounter, the Bell kept, no rescue; one route per class', () => {
    // D147 (spec 2.8 done-when), D149 (2.8 item 6: the Hexer winds up on its turn ONB_WINDUP_TURN, 1): per class, whether
    // G8 was learned or landed on this route. Mage (Binding Glyph, W) and Hunter (Lay Trap, W) on the Hexer cancel its
    // wind-up at round 2's start, in the step of the W press: STAGGERED, learned. Rogue: rule E never Saps (D49), Ambush (Q)
    // kills the Hexer in the engage round, so its wind-up neither lands nor is answered; G8's line goes (null) in that step
    // (ui-2026-11-14 finding 1) and G8 closes missed when zone 1 is left.
    const G8_AT_END = { rogue: 'missed', mage: 'done', hunter: 'done' };
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const routes = new Set();
      for (let k = 0; k < 20; k++) {
        const { s, fights, beats } = guidedRoute(classId, 1000 + 7919 * k);
        const v = R.tutorialView(s);
        assert.deepEqual(routeSeen(s), ROUTE_SEEN, `${classId} seed ${1000 + 7919 * k}`);
        for (const id of ['G7', 'G9', 'G12', 'G13']) assert.ok(v.learned.includes(id), `${classId}: ${id} learned`);
        // Gorrak right after S3 (the third scripted fight), before any later script
        const i = fights.findIndex((x) => x.startsWith('gorrak@'));
        assert.ok(i > 0 && fights[i - 1].startsWith('s3@'), `${classId}: ${fights.join(' ')}`);
        // D150 (item 11): G7 opens on its own line in fight 1 (site 1) and its ENGAGE learns it; S3's engage round opens G8
        // on its own line (no joint line: G7 has fired); G8 before G9 (Gorrak's fight, no line, D150)
        const o7 = beats.find((b) => b.id === 'G7' && b.what === 'open');
        const d7 = beats.find((b) => b.id === 'G7' && b.what === 'done');
        const o8 = beats.find((b) => b.id === 'G8' && b.what === 'open');
        const o9 = beats.find((b) => b.id === 'G9' && b.what === 'open');
        assert.deepEqual([o7.fight, o7.line, d7.n, o8.fight, o8.line, o9.line], ['site_1', 'G7', o7.n + 1, 's3', 'G8', null], classId);
        assert.ok(o8.n < o9.n && o9.fight === 'gorrak', classId);
        // D149: the engage round's step ends G8's line: learned (W) or, the Hexer dead, no line (finding 1)
        const next8 = beats.filter((b) => b.id === 'G8' && b.n === o8.n + 1).map((b) => [b.what, b.line]);
        assert.deepEqual(next8, classId === 'rogue' ? [['line', null]] : [['done', null]], `${classId}: G8 after the engage round`);
        assert.equal(s.tutorial.beats.G8.st, G8_AT_END[classId], `${classId}: G8 ${s.tutorial.beats.G8.st}`);
        assert.ok(!beats.some((b) => b.id === 'G8' && b.line === 'G8.landed'), `${classId}: no wind-up landed`);
        routes.add(JSON.stringify([fights, s.stats.exp.zones.find((x) => x.z === 1).time, s.player.level, beats]));
      }
      assert.equal(routes.size, 1, `${classId}: one route for every run seed`);
    }
  });

  test('D149: following G8\'s line (W on the Hexer in S3\'s engage round, then autoplay) learns G8 for every class in the W step; the route is the autoplay route, unchanged', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const auto = guidedRoute(classId, 1000);
      for (let k = 0; k < 20; k++) {
        const seed = 1000 + 7919 * k;
        const { s, fights, beats, engages } = guidedRoute(classId, seed, 'follow');
        assert.deepEqual(routeSeen(s), ROUTE_SEEN, `${classId} seed ${seed}`);
        assert.deepEqual(fights, auto.fights, `${classId} seed ${seed}: the autoplay route`);
        assert.ok(R.tutorialView(s).learned.includes('G9'), `${classId}: G9 learned`);
        // the stagger (turn ONB_WINDUP_TURN) and G8's done come in the W step itself, which is S3's engage round
        const o8 = beats.find((b) => b.id === 'G8' && b.what === 'open');
        const w = engages.find((n) => n > o8.n);
        assert.equal(w, o8.n + 1, `${classId}: W in S3's engage round`);
        const inW = beats.filter((b) => b.n === w && (b.id === 'G8' || b.id === 'stagger')).map((b) => [b.id, b.what, b.turn]);
        assert.deepEqual(inW, [['stagger', classId === 'hunter' ? 'trap' : 'control', C.ONB_WINDUP_TURN], ['G8', 'done', undefined]], `${classId} seed ${seed}`);
        assert.equal(s.tutorial.beats.G8.st, 'done', classId);
      }
    }
  });
});

describe('M3 D147: G7 and G8 share S3\'s engage round (spec 2.8, the D145 fix)', () => {
  /** A guided run in S3's engage round (node 2 after S1 and S2 counted as ended): its events and the state. */
  const atS3 = (classId) => { const s = withScript(atHub(classId, 5), 2); const r = R.step(s, { type: 'MOVE', nodeId: 2 }); return r; };

  test('one joint line: G8 opens on G8.withEngage, G7 opens waiting (null); the view\'s line is the joint line; content has it', () => {
    const r = atS3('mage');
    assert.equal(r.state.fight.tut.id, 's3');
    const open = r.events.filter((e) => e.t === 'beat' && e.what === 'open' && ['G7', 'G8'].includes(e.id)).map((e) => [e.id, e.line]);
    assert.deepEqual(open, [['G7', null], ['G8', 'G8.withEngage']]);
    const v = R.tutorialView(r.state);
    assert.deepEqual([v.beat, v.line], ['G8', 'G8.withEngage']);
    assert.deepEqual(v.open.filter((o) => ['G7', 'G8'].includes(o.id)), [{ id: 'G8', line: 'G8.withEngage', rest: false }, { id: 'G7', line: null, rest: false }]);
    const raw = CONTENT.tutorial.beats.find((b) => b.id === 'G8').alt.withEngage;
    assert.ok(typeof raw === 'string' && raw.length <= C.ONB_HINT_MAX_CHARS && raw.includes('{key_engage2}'), raw);
  });

  test('each is learned as before: any ENGAGE learns G7; W on the Hexer answers its wind-up (Rogue Sap, Mage Binding Glyph, Hunter trap: STAGGERED) and learns G8, both in the W step (D149)', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const w = { type: 'ENGAGE', option: C.ENGAGE_OPTIONS[classId][1], target: 0 };
      assert.equal(C.ENGAGE_OPTION[w.option].kind, 'control');
      const r = R.step(atS3(classId).state, w);
      // D149 (spec 2.8 item 6): the wind-up is the Hexer's turn ONB_WINDUP_TURN (round 2), cancelled at round 2's start
      const ev = r.events;
      const st = ev.find((e) => e.t === 'stagger');
      assert.ok(st && st.u === 0 && !st.deathblow && st.turn === C.ONB_WINDUP_TURN && st.id === 'bolt', `${classId}: the Hexer staggered in the W step ${JSON.stringify(st)}`);
      assert.equal(st.why, classId === 'hunter' ? 'trap' : 'control', classId);
      const beat = (id) => ev.filter((e) => e.t === 'beat' && e.id === id).map((e) => e.what);
      assert.deepEqual([beat('G7'), beat('G8')], [['done'], ['done']], `${classId}: G7 on ENGAGE, G8 on the stagger, in that step`);
      assert.ok(ev.findIndex((e) => e.t === 'stagger') < ev.findIndex((e) => e.t === 'beat' && e.id === 'G8'));
      assert.deepEqual([r.state.fight.round, r.state.tutorial.beats.G8.st], [2, 'done'], classId);
      assert.ok(!R.tutorialView(r.state).open.some((x) => x.id === 'G8'), `${classId}: no G8 line after it`);
    }
  });

  test('D149 (ui-2026-11-14 finding 1): after the engage round the joint line gives way: G8\'s own line while the wind-up can still come and an answer is on the bar (2.8 item 8), no line once it cannot (the Hexer dead); its own line follows the same rule', () => {
    /** The beat events of G8 in a step's events. */
    const g8 = (ev) => ev.filter((e) => e.t === 'beat' && e.id === 'G8').map((e) => [e.what, e.line]);
    /** A copy with the Hexer (enemy 0) at 1 HP, so one hit kills it (the route's level-5 Ambush does; a level-1 one may not). */
    const frail = (x) => { const y = JSON.parse(R.serialize(x)); y.content = CONTENT; y.fight.enemies[0].hp = 1; return y; };
    const ambush = { type: 'ENGAGE', option: C.ENGAGE_OPTIONS.rogue[0], target: 0 };
    // Ambush (Q, the Rogue's autoplay opener by rule E) kills the Hexer in the engage round: its wind-up cannot come, no line
    const a = R.step(frail(atS3('rogue').state), ambush);
    assert.deepEqual([a.state.fight.round, a.state.fight.enemies[0].alive], [2, false]);
    assert.deepEqual(g8(a.events), [['line', null]]);
    assert.deepEqual(R.tutorialView(a.state).open.find((x) => x.id === 'G8'), { id: 'G8', line: null, rest: false }, 'open, waiting (no line)');
    // the own line, the Hexer killed before its wind-up's turn (round 2, the player's action first): no line in that step
    // (an interrupt on the bar keeps the own line up in round 2, item 8)
    const up = tweak(R.step(atS3('mage').state, { type: 'PASS' }).state, (x) => { x.player.bar[x.player.bar.indexOf(null)] = 'spellsnap'; });
    assert.equal(up.tutorial.beats.G8.line, 'G8', 'Spellsnap on the bar answers it: the own line');
    const kill = R.step(frail(up), { type: 'ATTACK', target: 0 });
    assert.ok(!kill.state.fight.enemies[0].alive && kill.state.fight.round === 3, 'the Hexer died before acting');
    assert.ok(!kill.events.some((e) => e.t === 'empower' || e.t === 'stagger'));
    assert.deepEqual(g8(kill.events), [['line', null]]);
    // G8 opening alone on its own line (G7 fired at an earlier fight, so no joint line): the same rule after round 1
    const solo = tweak(withScript(atHub('rogue', 5), 2), (x) => { x.tutorial.beats.G7 = { st: 'done', line: null, n: 1, shown: 0, rest: false, back: 0 }; });
    const o = R.step(solo, { type: 'MOVE', nodeId: 2 });
    assert.deepEqual(g8(o.events), [['open', 'G8']], 'its own line, not the joint one');
    const b = R.step(frail(o.state), ambush);
    assert.deepEqual([b.state.fight.round, b.state.fight.enemies[0].alive, g8(b.events)], [2, false, [['line', null]]]);
  });

  test('2.8 item 8 (Lead decision, draft): from round 2 G8\'s own line shows only while windupView lists an answer with the current bar; X (pass) or a strike on the Boar in S3\'s engage round leave none, so no line, then "It landed"; an interrupt on the bar brings the line', () => {
    const g8 = (ev) => ev.filter((e) => e.t === 'beat' && e.id === 'G8').map((e) => [e.what, e.line]);
    const INTERRUPT = { rogue: 'throat_jab', mage: 'spellsnap', hunter: 'muzzle_shot' };
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const s3 = atS3(classId).state;
      // Q (the class's strike option) on the Boar, enemy 1: the Hexer lives, its wind-up is not answered
      const q = R.legalActions(s3).find((x) => x.type === 'ENGAGE' && x.option === C.ENGAGE_OPTIONS[classId][0] && x.target === 1);
      assert.ok(q, `${classId}: Q on the Boar is legal`);
      for (const [arm, act] of [['X', { type: 'PASS' }], ['Q on the Boar', q]]) {
        const p = R.step(s3, act);
        const hexer = p.state.fight.enemies[0];
        assert.ok(p.state.fight.round === 2 && hexer.alive && hexer.intent.windup, `${classId} ${arm}: the wind-up is the Hexer's intent in round 2`);
        const w = R.windupView(p.state).filter((x) => x.u === 0 && x.turn === C.ONB_WINDUP_TURN);
        assert.deepEqual(w.map((x) => x.answers), [[]], `${classId} ${arm}: windupView lists no answer on this bar`);
        // the joint line goes, and G8's own line (it names W, now illegal) does not come: no line
        assert.deepEqual(g8(p.events), [['line', null]], `${classId} ${arm}`);
        assert.notEqual(R.tutorialView(p.state).line, 'G8', `${classId} ${arm}`);
        assert.deepEqual(R.tutorialView(p.state).open.find((x) => x.id === 'G8'), { id: 'G8', line: null, rest: false });
        // ... and it lands in round 2: "It landed" (G8.landed, unchanged)
        const l = R.step(p.state, { type: 'PASS' });
        assert.ok(l.events.some((e) => e.t === 'empower' && e.u === 0 && e.turn === C.ONB_WINDUP_TURN), `${classId} ${arm}: landed`);
        assert.deepEqual(g8(l.events), [['line', 'G8.landed']], `${classId} ${arm}`);
        // the same round with the class's interrupt on the bar (off cooldown): windupView lists it, the own line shows
        const i = tweak(p.state, (x) => { x.player.bar[x.player.bar.indexOf(null)] = INTERRUPT[classId]; });
        assert.ok(R.windupView(i).some((x) => x.u === 0 && x.answers.some((y) => y.id === INTERRUPT[classId] && y.how === 'interrupt')), `${classId} ${arm}: the interrupt answers it`);
        assert.deepEqual(R.tutorialView(i).open.find((x) => x.id === 'G8'), { id: 'G8', line: 'G8', rest: false }, `${classId} ${arm}: the own line with an answer`);
        // its cooldown not over by the wind-up's round: no answer, the line goes again
        const cd = tweak(i, (x) => { x.fight.p.cds[INTERRUPT[classId]] = x.fight.round + 1; });
        assert.equal(cd.tutorial.beats.G8.line, null, `${classId} ${arm}: on cooldown, no line`);
      }
    }
  });

  test('2.8 item 8 on the route (seed 8736, run seed 1000, level 7): X or Q on the Boar in S3\'s engage round, then autoplay: G8\'s own line does not show after the engage round, the wind-up lands ("It landed"), the route is unchanged', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const auto = guidedRoute(classId, 1000);
      for (const policy of ['pass', 'boar']) {
        const { s, fights, beats } = guidedRoute(classId, 1000, policy);
        assert.deepEqual(routeSeen(s), ROUTE_SEEN, `${classId} ${policy}`);
        assert.deepEqual(fights, auto.fights, `${classId} ${policy}: the autoplay route`);
        const lines = beats.filter((b) => b.id === 'G8').map((b) => [b.what, b.line]);
        // D150: S3 opens G8 on its own line (G7 fired in fight 1); after the engage round no line, then "It landed"
        assert.deepEqual(lines.slice(0, 3), [['open', 'G8'], ['line', null], ['line', 'G8.landed']], `${classId} ${policy}: ${JSON.stringify(lines)}`);
        assert.ok(!lines.slice(1).some(([, line]) => line === 'G8'), `${classId} ${policy}: no own line after the engage round`);
      }
    }
  });

  test('without an ENGAGE in S3, G7\'s own line shows once at the next engage fight (S4), then G7 is missed', () => {
    /** A bar spell on enemy 0 in the engage round (legal there, and no ENGAGE). */
    const cast = (x) => R.step(x, { type: 'CAST', spellId: x.player.bar.find((id) => id && R.whyIllegal(x, { type: 'CAST', spellId: id, target: 0 }) === null), target: 0 }).state;
    let s = cast(atS3('mage').state);
    assert.equal(s.tutorial.beats.G7.st, 'open', 'a bar spell in the engage round is no ENGAGE');
    s = win(s);
    assert.deepEqual([s.fight, s.tutorial.beats.G7.st, s.tutorial.beats.G7.line], [null, 'open', null]);
    // S4 (node 3, a Quest node next to node 2, no site): G7's own line in its engage round
    const r = R.step(s, { type: 'MOVE', nodeId: 3 });
    assert.equal(r.state.fight.tut.id, 's4');
    assert.ok(r.events.some((e) => e.t === 'beat' && e.id === 'G7' && e.what === 'line' && e.line === 'G7'));
    assert.equal(R.tutorialView(r.state).line, 'G7');
    const t = cast(r.state); // round 2 comes: the line's second showing is over
    assert.equal(t.tutorial.beats.G7.st, 'missed');
  });
});

describe('M3 D142 and D150: coach-line moments (G10, G12)', () => {
  test('D150 (draft, "Contract site" once): G10 opens at the first held site\'s fight with no line (never on the map or the hub screen), shows its line from round 2 of that fight to its end, not at the next site; G10.done once the contract\'s reward choice is up', () => {
    const p = steps(run('mage', 5), [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }, { type: 'SET_OUT' }, { type: 'SERVICE', service: 'vendor' }, { type: 'LEAVE' }, { type: 'LEAVE_HUB' }]);
    assert.ok(p.state.zone.nodes[1].sites && R.mapView(p.state).nodes.some((n) => n.sites), 'a site in view next to the hub');
    assert.ok(!p.events.some((e) => e.t === 'beat' && e.id === 'G10'), 'not at the hub screen or on the map');
    let s = p.state;
    const log = [];
    const go = (a) => { const r = R.step(s, a); s = r.state; for (const e of r.events) if (e.t === 'beat' && e.id === 'G10') log.push([a.type, e.what, e.line]); };
    const fightOut = () => { for (let n = 0; n < 80 && (s.fight || s.phase === 'NODE'); n++) go(R.autoAction(s)); };
    // site 1 (node 1, a Quest node): fight 1, whose engage round shows G7's line
    go({ type: 'MOVE', nodeId: 1 });
    assert.deepEqual([s.fight.tut.kind, R.tutorialView(s).line], ['site', 'G7']);
    fightOut();
    assert.deepEqual(log, [['MOVE', 'open', null], ['ENGAGE', 'line', 'G10'], ['CAST', 'line', null]], JSON.stringify(log));
    // site 2 on node 4 (a Quest node, by the hub): no line again; the contract completes there, and G10.done comes with its
    // reward choice, after the quest's (not at the fight's end, three screens earlier)
    log.length = 0;
    go({ type: 'MOVE', nodeId: 0 });
    go({ type: 'LEAVE_HUB' });
    go({ type: 'MOVE', nodeId: 4 });
    assert.equal(s.fight.tut.id, 'site_2');
    let doneAt = null;
    for (let n = 0; n < 80 && (s.fight || s.phase === 'NODE'); n++) {
      const a = R.autoAction(s);
      const up = !!(s.node && s.node.stage === 'reward' && s.node.rewards[0] && s.node.rewards[0].contract);
      go(a);
      if (!doneAt && log.some((x) => x[2] === 'G10.done')) doneAt = { a: a.type, contractUp: !!(s.node && s.node.rewards && s.node.rewards[0] && s.node.rewards[0].contract), before: up };
    }
    assert.deepEqual(log, [['CHOOSE_REWARD', 'line', 'G10.done'], ['CHOOSE_REWARD', 'done', null]], JSON.stringify(log));
    assert.deepEqual(doneAt, { a: 'CHOOSE_REWARD', contractUp: true, before: false }, 'the quest\'s reward first, then the contract\'s with its line');
  });

  test('D150 (draft): G12 never comes back on its trigger (ONB_LINE_RETURNS 0) and has no Dimmed-encounter line; once its line has rested and the Roads open, G12.road, also once', () => {
    assert.equal(C.ONB_LINE_RETURNS, 0);
    let s = run('rogue', 8736);
    for (let n = 0; n < 3000; n++) {
      const r = R.step(s, R.autoAction(s));
      s = r.state;
      if (s.tutorial.beats.G12 && s.tutorial.beats.G12.st === 'open' && s.tutorial.beats.G12.rest) break;
    }
    assert.ok(s.tutorial.beats.G12.rest, 'G12 open and resting');
    assert.equal(R.tutorialView(s).roads.closed, true, 'the Roads still wait for Gorrak');
    // its trigger: the front comes within ONB_DIM_NEAR_HOPS of the player: nothing comes back
    const ev1 = [];
    const once = frontNear(s, ev1);
    assert.ok(R.mapView(once).dim.front >= once.zone.shardDist[once.zone.pos] - C.ONB_DIM_NEAR_HOPS, 'the front is within ONB_DIM_NEAR_HOPS');
    assert.ok(!ev1.some((e) => e.t === 'beat' && e.id === 'G12'));
    assert.equal(once.tutorial.beats.G12.rest, true);
    // a Dimmed encounter: no line (G12.caught is gone)
    const raw = CONTENT.tutorial.beats.find((b) => b.id === 'G12');
    assert.deepEqual(Object.keys(raw.alt), ['road']);
    // on the map (G12 rested in a fight on this route), the Roads open (SKIP_GUIDE would end the beats; Gorrak's fight
    // recorded as won opens them): G12.road, a new moment
    const onMap = settle(once);
    assert.ok(onMap.phase === 'MAP' && !onMap.fight && R.tutorialView(onMap).roads.closed, 'on the map, the Roads still closed');
    const ev2 = [];
    const open = tweak(onMap, (x) => { x.tutorial.elite = 'victory'; }, ev2);
    assert.equal(R.tutorialView(open).roads.closed, false);
    assert.ok(ev2.some((e) => e.t === 'beat' && e.id === 'G12' && e.what === 'line' && e.line === 'G12.road'));
    assert.deepEqual(R.tutorialView(open).open.find((o) => o.id === 'G12'), { id: 'G12', line: 'G12.road', rest: false });
    // shown on ONB_LINE_STEPS map steps, then it rests for good
    let t = open;
    for (let k = 0; k < C.ONB_LINE_STEPS + 1; k++) t = tweak(t, () => {});
    assert.deepEqual(R.tutorialView(t).open.find((o) => o.id === 'G12'), { id: 'G12', line: 'G12.road', rest: true });
  });
});

describe('M3 profile, welcome and summary (4.2, E6-E8)', () => {
  const finish = (s) => { while (s.phase !== 'SUMMARY') s = R.step(s, R.autoAction(s)).state; return R.step(s, { type: 'END_RUN' }).state; };
  test('E6 newProfile and migrateProfile: guide and welcome; setGuide', () => {
    assert.deepEqual([R.newProfile().guide, R.newProfile().welcome], ['todo', false]);
    const old = { ...R.newProfile(), runs: 3 }; delete old.guide; delete old.welcome;
    assert.deepEqual([R.migrateProfile(old).guide, R.migrateProfile(old).welcome], ['done', true]);
    const fresh = { ...R.newProfile() }; delete fresh.guide; delete fresh.welcome;
    assert.deepEqual([R.migrateProfile(fresh).guide, R.migrateProfile(fresh).welcome], ['todo', false]);
    assert.equal(R.setGuide(R.newProfile(), 'skipped').guide, 'skipped');
    assert.throws(() => R.setGuide(R.newProfile(), 'later'), /guide must be/);
    assert.equal(R.newRun({ content: CONTENT, profile: old }).profile.welcome, true);
  });

  test('4.2 the welcome: ONB_WELCOME_ECHOES (= Packed Satchel) once, in the first non-dev run; never in a dev run or a migrated profile', () => {
    assert.equal(C.ONB_WELCOME_ECHOES, C.META.satchel.costs[0]);
    const a = finish(steps(R.newRun({ classId: 'mage', seed: 3, content: CONTENT }), [{ type: 'START_RUN' }]).state);
    const w = a.result.summary.echoes.lines.find((l) => l.id === 'welcome');
    assert.deepEqual([w.count, w.echoes], [1, C.ONB_WELCOME_ECHOES]);
    assert.equal(a.result.profile.welcome, true);
    assert.ok(R.metaOffers(a.result.profile).find((o) => o.id === 'satchel').affordable, 'ONB4: Packed Satchel affordable');
    const b = finish(steps(R.newRun({ classId: 'mage', seed: 4, content: CONTENT, profile: a.result.profile }), [{ type: 'START_RUN' }]).state);
    assert.ok(!b.result.summary.echoes.lines.some((l) => l.id === 'welcome'), 'not again');
    const d = finish(R.debug.build({ content: CONTENT, classId: 'rogue', zone: 1 }).state);
    assert.deepEqual([d.result.summary.echoes.total, d.result.profile.welcome], [0, false], 'a dev run neither pays nor sets it');
    const old = { ...R.newProfile(), runs: 2 }; delete old.welcome; delete old.guide;
    const m = finish(steps(R.newRun({ classId: 'mage', seed: 3, content: CONTENT, profile: old }), [{ type: 'START_RUN' }]).state);
    assert.ok(!m.result.summary.echoes.lines.some((l) => l.id === 'welcome'));
  });

  test('E6-E7 END_RUN of a guided run sets guide done, or skipped after SKIP_GUIDE; the summary block; E8 resetOnboarding', () => {
    const g = finish(steps(run('mage', 6), [{ type: 'START_RUN' }]).state);
    assert.deepEqual([g.result.profile.guide, g.result.summary.tutorial.skipped], ['done', false]);
    assert.deepEqual(Object.keys(g.result.summary.tutorial), ['rescues', 'skipped', 'learned']);
    const k = finish(steps(run('mage', 6), [{ type: 'START_RUN' }, { type: 'SKIP_GUIDE' }]).state);
    assert.equal(k.result.profile.guide, 'skipped');
    const n = finish(steps(R.newRun({ classId: 'mage', seed: 6, content: CONTENT }), [{ type: 'START_RUN' }]).state);
    assert.deepEqual([n.result.profile.guide, n.result.summary.tutorial], ['todo', undefined]);
    const r = R.debug.resetOnboarding({ ...g.result.profile, runs: 5, echoes: 40 });
    assert.deepEqual([r.guide, r.welcome, r.runs, r.echoes], ['todo', false, 5, 40]);
  });
});

describe('M3 table validation and the golden check (E2, E9)', () => {
  test('validateContent checks CONTENT.tutorial (ids, scripts, gate, seed); the shipped table is valid in strict mode', () => {
    assert.deepEqual(R.validateContent(CONTENT, { strict: true }), []);
    const T = CONTENT.tutorial;
    const bad = { ...CONTENT, tutorial: {
      ...T, seed: 1, board: { ...T.board, region: 'nowhere' }, scripts: T.scripts.slice(0, 3),
      siteFights: [{ id: 'x', enemies: [{ enemy: 'z1_gorrak' }] }], elite: { ...T.elite, gate: { afterScript: 's9' } },
    } };
    const errs = R.validateContent(bad).join('\n');
    for (const w of ['tutorial.seed', 'tutorial.board.region', 'tutorial.scripts', 'tutorial.siteFights[0].enemies[0]', 'tutorial.elite.gate.afterScript']) assert.ok(errs.includes(w), w);
  });

  test('golden: rows and expedition runs without the option are unchanged run for run (actions, events, states, summaries); only the switched rules change them: D144 reward bias, D146 zone 2 inner-ring cap, D147 zone 1 enemy damage', () => {
    // The hashes recorded on 25a8879 (M3 3.4), unchanged through D143: with C.GATES.rewardPrimary, zone2InnerCap and z1Dmg off
    // they still hold, so every later change leaves these runs as they were except the switched rules. D150 (generated item
    // names, cut list item 20: at most one affix word): every run here loots gear, so all four tables were re-recorded on that
    // change; with every item name masked each run hashes as before (scratch check, docs/handoffs/engine-2026-11-14d.md).
    // D150 (naming rule): the final boss is "Oruvath" (C.BOSS_TEXT.name), so the five runs that reach it were re-recorded too.
    const PRE_D144 = {
      'rows:rogue:11': '11e1fabb61b05aea:108', 'rows:rogue:4242': 'd2e85b9ad06b91cc:653', 'rows:mage:11': '44e31ffd7d438f6d:304',
      'rows:mage:4242': '9ea1e1d35dfcf3d7:208', 'rows:hunter:11': '77360495fa13ea25:719', 'rows:hunter:4242': '53a6759892b9a8c3:599',
      'exp:rogue:11': 'f2f926428d80e86a:101', 'exp:rogue:4242': '32dab45425e89087:86', 'exp:mage:11': '8bdbbae46757fb6f:208',
      'exp:mage:4242': '93156d8006a22d14:285', 'exp:hunter:11': '1065164137292f55:338', 'exp:hunter:4242': '981d0aba511cb52d:401',
      'expPrep:rogue:11': 'fc58bb181263d684:111', 'expPrep:rogue:4242': 'f33a5256e44daa5a:88', 'expPrep:mage:11': '57c2f35af04d4056:212',
      'expPrep:mage:4242': 'fd353e23a02e2d6f:296', 'expPrep:hunter:11': '34a6fbdbe8314bdc:332', 'expPrep:hunter:4242': 'f4a1064925b31c5b:427',
    };
    // D144 (rewardPrimary on), zone2InnerCap and z1Dmg off: recorded on 24f15c5; the two runs that met no other-primary reward
    // equal PRE_D144.
    const D144 = {
      'rows:rogue:11': '98a760d6d9a0fc9c:107', 'rows:rogue:4242': '7c76f5cddbae5923:653', 'rows:mage:11': '2a55d46b3729e550:750',
      'rows:mage:4242': 'bae6d8c54e2fa402:208', 'rows:hunter:11': '1de20860eebdc2b4:728', 'rows:hunter:4242': 'ffbb9cbe880c24f0:604',
      'exp:rogue:11': '7c79f63464f99480:102', 'exp:rogue:4242': '32dab45425e89087:86', 'exp:mage:11': '3dc17da0efc374ce:212',
      'exp:mage:4242': 'c0ce742263fdc50f:289', 'exp:hunter:11': '0a2c252685e06483:338', 'exp:hunter:4242': '41b811a18b095fd3:246',
      'expPrep:rogue:11': 'fbe5f96b58c626dd:112', 'expPrep:rogue:4242': 'f33a5256e44daa5a:88', 'expPrep:mage:11': '17dc61ef0f48e29b:91',
      'expPrep:mage:4242': '4953498640cfa892:298', 'expPrep:hunter:11': '5928220098aa1a93:333', 'expPrep:hunter:4242': '7e863abf12d0619c:421',
    };
    // D146 (rewardPrimary and zone2InnerCap on), z1Dmg off: recorded on 321f2aa: the classic map is untouched by D146 (rows =
    // D144); every expedition run here reaches zone 2 and changes there. D147's rescue rule and S3/S4 swap change only guided runs.
    const D146 = {
      'rows:rogue:11': '98a760d6d9a0fc9c:107', 'rows:rogue:4242': '7c76f5cddbae5923:653', 'rows:mage:11': '2a55d46b3729e550:750',
      'rows:mage:4242': 'bae6d8c54e2fa402:208', 'rows:hunter:11': '1de20860eebdc2b4:728', 'rows:hunter:4242': 'ffbb9cbe880c24f0:604',
      'exp:rogue:11': '9497780498d96976:109', 'exp:rogue:4242': '69497220ebc3587c:176', 'exp:mage:11': '057d31953d3f3d98:206',
      'exp:mage:4242': 'ee07042beffbec7d:278', 'exp:hunter:11': '0b747bb17b07d39d:410', 'exp:hunter:4242': '06fbd32b7230ef8a:390',
      'expPrep:rogue:11': 'b87303fc962cf60b:365', 'expPrep:rogue:4242': 'f3af7787359c671a:266', 'expPrep:mage:11': '3d7ab76070ffbc35:220',
      'expPrep:mage:4242': '17d543036d92bbb6:464', 'expPrep:hunter:11': 'd2b7efd32e330587:397', 'expPrep:hunter:4242': '66ace69a9540cd5f:421',
    };
    // As built (D147: z1Dmg on too), recorded on this change: every run here meets enemies of level <= Z1_DMG_MAX_LEVEL, on
    // both maps, so all 18 change.
    const GOLDEN = {
      'rows:rogue:11': '7af0bbdc229d0a65:104', 'rows:rogue:4242': '4f15f5bc5f013856:655', 'rows:mage:11': '9e1b9973092d5b08:88',
      'rows:mage:4242': '0fec85e0eaa302e2:208', 'rows:hunter:11': 'fb7de4f0c9196e46:98', 'rows:hunter:4242': 'd96f17a16d118ca8:604',
      'exp:rogue:11': '0714d1d1d429349a:128', 'exp:rogue:4242': 'de94fe3dc2dc1b1c:177', 'exp:mage:11': '5c5b689a5630b292:210',
      'exp:mage:4242': '0830e815429032d4:278', 'exp:hunter:11': 'f5ba7096add4b624:330', 'exp:hunter:4242': '7320eff79764b1d3:390',
      'expPrep:rogue:11': '108f944be1932112:206', 'expPrep:rogue:4242': '0baae593d80ad163:268', 'expPrep:mage:11': '5cd1adde9256d3f2:224',
      'expPrep:mage:4242': '211b9a372d428826:464', 'expPrep:hunter:11': '5daa137174a4179a:400', 'expPrep:hunter:4242': '1fc57e1a4aa4bdb0:421',
    };
    const strip = (s) => { const o = JSON.parse(R.serialize(s)); delete o.profile; if (o.result) delete o.result.profile; return JSON.stringify(o); };
    const hashOf = (key) => {
      const [mode, classId, seed] = key.split(':');
      // A profile that had its welcome (its keys are not hashed): the runs are compared, not the M3 profile keys.
      let s = R.newRun({ classId, petId: PET(classId), seed: Number(seed), content: CONTENT, profile: { ...R.newProfile(), runs: 1, welcome: true },
        mapMode: mode === 'rows' ? 'rows' : 'expedition', prep: mode === 'rows' ? null : mode === 'expPrep' });
      const h = createHash('sha256');
      let n = 0;
      while (s.phase !== 'ENDED' && n < 20000) { const a = R.autoAction(s); const r = R.step(s, a); s = r.state; h.update(JSON.stringify(a)); h.update(JSON.stringify(r.events)); n++; }
      h.update(strip(s));
      h.update(JSON.stringify({ ...s.result.summary }));
      return `${h.digest('hex').slice(0, 16)}:${n}`;
    };
    assert.deepEqual([C.GATES.rewardPrimary, C.GATES.zone2InnerCap, C.GATES.z1Dmg], [true, true, true]);
    for (const key of Object.keys(GOLDEN)) assert.equal(hashOf(key), GOLDEN[key], key);
    const arms = [
      [{ z1Dmg: false }, D146, 'z1Dmg off'],
      [{ zone2InnerCap: false, z1Dmg: false }, D144, 'zone2InnerCap and z1Dmg off'],
      [{ rewardPrimary: false, zone2InnerCap: false, z1Dmg: false }, PRE_D144, 'all three off'],
    ];
    for (const [set, want, label] of arms) {
      Object.assign(C.GATES, set);
      try {
        for (const key of Object.keys(want)) assert.equal(hashOf(key), want[key], `${key}, ${label}`);
      } finally { Object.assign(C.GATES, { rewardPrimary: true, zone2InnerCap: true, z1Dmg: true }); }
    }
  });
});
