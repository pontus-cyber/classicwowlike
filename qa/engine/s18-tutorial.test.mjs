// M3 guided first run (docs/specs/m3-onboarding.md 2, 4.2, 5 E1-E8; D135, D137, D138; engine-api.md 14): newRun's
// `tutorial` option, zone 1 on TUTORIAL_SEED with the content's overlay (board slot 1, site fights, scripts S1-S4, S1's
// loot, the D138 wind-ups, Gorrak and his gate), the rescue, SKIP_GUIDE, the beats and tutorialView, the profile's guide
// and welcome, the summary's welcome line and tutorial block, debug.resetOnboarding, the table's validation, and the
// golden check: rows and expedition runs without the option play exactly as before task 3.4 (hashes recorded on 25a8879).
// D142 (M3 3.7): G10 only on the map, G12's return cap.
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

describe('M3 guided run: newRun, seed and overlay (m3-onboarding 2.1-2.3, E1, E2)', () => {
  test('E1 tutorial is an expedition option with the start camp; state.tutorial from START_RUN; never in a normal run', () => {
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, tutorial: true, mapMode: 'rows' }), /tutorial/);
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, tutorial: true, prep: false }), /tutorial/);
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, tutorial: 'yes' }), /tutorial/);
    assert.throws(() => R.newRun({ classId: 'mage', content: { ...CONTENT, tutorial: undefined }, tutorial: true, validate: false }), /CONTENT.tutorial/);
    const s = steps(run(), [{ type: 'START_RUN' }]).state;
    assert.equal(s.phase, 'PREP');
    assert.deepEqual({ ...s.tutorial, beats: undefined }, { on: true, skipped: false, ended: false, rescues: 0, script: 0, sites: 0, beats: undefined });
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
    assert.deepEqual(seen, [
      ['s1', 'Furrow Boar', 3, false], ['site_1', 'Furrow Boar', 4, false], ['s2', 'Hedge Ogre', 2, false],
      ['s3', 'Hedge Ogre+Barn Wolf', 4, false], ['site_2', 'Furrow Boar+Barn Wolf', 3, false],
    ]);
    assert.deepEqual([s.tutorial.script, s.tutorial.sites], [3, 2]);
    // S4 (the fourth scripted fight): only the Hexer, marked windup, winds up (turn 2, Hex Bolt)
    const t = withScript(atHub('mage', 5), 3);
    const f = R.step(t, { type: 'MOVE', nodeId: 2 }).state.fight;
    assert.equal(f.tut.id, 's4');
    const w = f.enemies.map((e) => e.track.filter((x) => x.windup).map((x) => [x.turn, x.id]));
    assert.deepEqual(w, [[[C.SIGNATURE_TURN, 'hex_bolt']], []]);
    // After the scripts, a quest fight of the guided zone has no first-meeting wind-up (D138)
    const u = withScript(atHub('mage', 5), 4);
    const q = R.step(u, { type: 'MOVE', nodeId: 6 }).state.fight;
    assert.equal(q.tut, undefined);
    assert.ok(q.enemies.every((e) => !e.firstMeet && !e.track.some((x) => x.windup)));
  });

  test('2.3 Gorrak: the nearest Elite, alone, never rare, level clamp; barred until s4 ended (D138), open after SKIP_GUIDE', () => {
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
    assert.deepEqual([R.tutorialView(s).elite.barred, R.tutorialView(s).elite.left], [true, 4 - s.tutorial.script]);
    assert.ok(!R.legalActions(s).some((a) => a.nodeId === 18 && (a.type === 'MOVE' || a.type === 'PASS_THROUGH')));
    const open = withScript(s, 4);
    assert.equal(R.whyIllegal(open, { type: 'MOVE', nodeId: 18 }), null);
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
    const unbar = (nodes) => nodes.map((n) => ({ ...n, barred: undefined }));
    assert.deepEqual([r.state.tutorial.skipped, unbar(r.state.zone.nodes), r.state.fight.enemies], [true, unbar(f.zone.nodes), f.fight.enemies]);
    assert.deepEqual([f.zone.nodes[18].barred, r.state.zone.nodes[18].barred], [true, undefined], 'only Gorrak opens (D138)');
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

describe('M3 guided run: beats and tutorialView (2.4-2.7, E5)', () => {
  test('autoplay guided runs reach zone 2 for every class; beats open once each, G1-G5 learned, the guide ends at zone 2', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      let s = steps(run(classId, 11), [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }]).state;
      assert.deepEqual([R.tutorialView(s).beat, R.tutorialView(s).line], ['G1', 'G1']);
      const ev = [];
      for (let n = 0; !(s.zone && s.zone.z === 2) && s.phase !== 'ENDED' && n < 3000; n++) { const r = R.step(s, R.autoAction(s)); s = r.state; ev.push(...r.events); }
      assert.equal(s.zone.z, 2, `${classId} reaches zone 2`);
      const opened = ev.filter((e) => e.t === 'beat' && e.what === 'open').map((e) => e.id);
      assert.equal(new Set(opened).size, opened.length, 'each beat opens once');
      for (const id of ['G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G12', 'G13']) assert.ok(opened.includes(id), `${classId} ${id}`);
      const v = R.tutorialView(s);
      for (const id of ['G1', 'G2', 'G3', 'G4', 'G5']) assert.ok(v.learned.includes(id), `${classId} learned ${id}`);
      assert.ok(ev.filter((e) => e.t === 'beat' && e.id === 'G12' && e.what === 'line' && e.line === 'G12').length <= C.ONB_LINE_RETURNS, 'G12 returns at most once');
      assert.deepEqual([v.ended, v.guidedZone, v.beat, v.open], [true, false, null, []]);
      assert.equal(ev.filter((e) => e.t === 'guideEnd').length, 1);
      assert.ok(ev.some((e) => e.t === 'beat' && e.id === 'G13' && e.what === 'done'));
    }
  });

  test('G1 without a contract: missed and G10 skipped; G9 opens with the class line in the Gorrak fight', () => {
    const s = steps(run('hunter', 4), [{ type: 'START_RUN' }, { type: 'SET_OUT' }]).state;
    const v = R.tutorialView(s);
    assert.deepEqual([v.done.includes('G1'), v.learned.includes('G1'), v.skippedBeats], [true, false, ['G10']]);
    const g = R.step(withScript(settle(R.step(atHub('hunter', 4), { type: 'MOVE', nodeId: 1 }).state), 4), { type: 'MOVE', nodeId: 18 });
    assert.ok(g.events.some((e) => e.t === 'beat' && e.id === 'G9' && e.what === 'open' && e.line === 'G9.hunter'));
    assert.deepEqual([R.tutorialView(g.state).beat, R.tutorialView(g.state).line], ['G9', 'G9.hunter']);
  });
});

describe('M3 coach lines yield after showing (2.5, D141)', () => {
  test('seed 8736: G12 is the line for ONB_LINE_STEPS steps or more, then G13 becomes the line while G12 stays open; G12 comes back when its trigger fires again', () => {
    assert.equal(C.ONB_LINE_STEPS, 2);
    let s = run('rogue', 8736);
    let g12Steps = 0;
    let at = null;
    for (let n = 0; !(s.zone && s.zone.z === 2) && s.phase !== 'ENDED' && n < 3000; n++) {
      const r = R.step(s, R.autoAction(s));
      const v = R.tutorialView(r.state);
      if (v.open.some((o) => o.id === 'G13') && v.open.some((o) => o.id === 'G12')) { at = r; break; }
      s = r.state;
      if (v.beat === 'G12') g12Steps += 1;
    }
    assert.ok(at, 'G13 opens while G12 is open');
    assert.ok(g12Steps >= C.ONB_LINE_STEPS, `G12 was the line for ${g12Steps} steps`);
    const v = R.tutorialView(at.state);
    assert.deepEqual([v.beat, v.line], ['G13', 'G13.onRoad']);
    assert.deepEqual(v.open.find((o) => o.id === 'G12'), { id: 'G12', line: 'G12', rest: true });
    assert.ok(!at.events.some((e) => e.t === 'beat' && e.id === 'G12'), 'G12 stays open, no event');
    // its trigger again: the front was not within ONB_DIM_NEAR_HOPS on the last step and is now
    s = at.state;
    s.tutorial.beats.G12.near = false;
    const back = R.step(s, R.legalActions(s).find((x) => x.type === 'SET_AUTOPLAY'));
    assert.ok(back.events.some((e) => e.t === 'beat' && e.id === 'G12' && e.what === 'line' && e.line === 'G12'));
    assert.deepEqual([R.tutorialView(back.state).beat, R.tutorialView(back.state).line], ['G12', 'G12']);
  });

  test('a line with no other open beat line to yield to stays the line (G1 at the start camp after 3 steps)', () => {
    let s = steps(run('mage', 11), [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }, { type: 'DROP_CONTRACT', index: 0 }, { type: 'TAKE_CONTRACT', index: 0 }]).state;
    const v = R.tutorialView(s);
    assert.deepEqual([v.beat, v.line, v.open], ['G1', 'G1', [{ id: 'G1', line: 'G1', rest: false }]]);
  });
});

describe('M3 D142: coach-line returns (G10, G12)', () => {
  test('G10 opens on the map when a held contract\'s site is first in view, never at the hub screen', () => {
    const p = steps(run('mage', 5), [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }, { type: 'SET_OUT' }, { type: 'SERVICE', service: 'vendor' }, { type: 'LEAVE' }]);
    assert.equal(p.state.phase, 'ZONE_HUB');
    assert.ok(p.state.zone.seen[1] && p.state.zone.nodes[1].sites, 'a site next to the hub is already seen');
    assert.ok(!p.events.some((e) => e.t === 'beat' && e.id === 'G10'));
    assert.ok(!R.tutorialView(p.state).open.some((o) => o.id === 'G10'));
    const r = R.step(p.state, { type: 'LEAVE_HUB' });
    assert.ok(r.events.some((e) => e.t === 'beat' && e.id === 'G10' && e.what === 'open' && e.line === 'G10'));
    assert.ok(R.mapView(r.state).nodes.some((n) => n.sites));
    // back to the hub screen by a walk: nothing new
    const back = R.step(walkTo(r.state, 3), { type: 'MOVE', nodeId: 0 });
    assert.equal(back.state.phase, 'ZONE_HUB');
    assert.ok(!back.events.some((e) => e.t === 'beat' && e.id === 'G10' && e.what === 'open'));
  });

  test('G12 comes back on its trigger at most ONB_LINE_RETURNS (1) times per zone', () => {
    assert.equal(C.ONB_LINE_RETURNS, 1);
    let s = run('rogue', 8736);
    for (let n = 0; n < 3000; n++) {
      const r = R.step(s, R.autoAction(s));
      s = r.state;
      if (s.tutorial.beats.G12 && s.tutorial.beats.G12.st === 'open' && s.tutorial.beats.G12.rest) break;
    }
    assert.ok(s.tutorial.beats.G12.rest, 'G12 open and resting');
    const nudge = (x) => { x.tutorial.beats.G12.near = false; };
    const isBack = (ev) => ev.some((e) => e.t === 'beat' && e.id === 'G12' && e.what === 'line' && e.line === 'G12');
    const near = (x) => R.mapView(x).dim.front >= x.zone.shardDist[x.zone.pos] - C.ONB_DIM_NEAR_HOPS;
    assert.ok(near(s), 'the front is within ONB_DIM_NEAR_HOPS of the player');
    const ev1 = [];
    const once = tweak(s, nudge, ev1);
    assert.ok(isBack(ev1), 'the first return');
    assert.equal(once.tutorial.beats.G12.rest, false);
    const ev2 = [];
    const twice = tweak(once, (x) => { x.tutorial.beats.G12.rest = true; nudge(x); }, ev2);
    assert.ok(!isBack(ev2), 'no second return');
    assert.equal(twice.tutorial.beats.G12.rest, true);
    assert.ok(!R.tutorialView(twice).open.find((o) => o.id === 'G12').line || R.tutorialView(twice).beat !== 'G12');
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

  test('golden: rows and expedition runs without the option are unchanged run for run (actions, events, states, summaries)', () => {
    const GOLDEN = {
      'rows:rogue:11': '41798041347ce9f8:108', 'rows:rogue:4242': '00886b4b19e73a89:653', 'rows:mage:11': '60aad992e05fee5a:304',
      'rows:mage:4242': '88c9a2eeacfb1665:208', 'rows:hunter:11': 'b7c11055704ada75:719', 'rows:hunter:4242': '168bb8f07d4247bd:599',
      'exp:rogue:11': 'ace46bd9e084ae03:101', 'exp:rogue:4242': '4c729a13470c3484:86', 'exp:mage:11': '89d14027e228430a:208',
      'exp:mage:4242': '03209131f3c277a4:285', 'exp:hunter:11': '0c57c016c169696a:338', 'exp:hunter:4242': '3da7d90c8a5401b9:401',
      'expPrep:rogue:11': '69d8cbffae60e74b:111', 'expPrep:rogue:4242': 'b6bcb252e1e8744d:88', 'expPrep:mage:11': '1054d25f06e0865a:212',
      'expPrep:mage:4242': '3970be1838c40992:296', 'expPrep:hunter:11': '9b27dda4deba5907:332', 'expPrep:hunter:4242': '084a85890a562b3f:427',
    };
    const strip = (s) => { const o = JSON.parse(R.serialize(s)); delete o.profile; if (o.result) delete o.result.profile; return JSON.stringify(o); };
    for (const key of Object.keys(GOLDEN)) {
      const [mode, classId, seed] = key.split(':');
      // A profile that had its welcome (its keys are not hashed): the runs are compared, not the M3 profile keys.
      let s = R.newRun({ classId, petId: PET(classId), seed: Number(seed), content: CONTENT, profile: { ...R.newProfile(), runs: 1, welcome: true },
        mapMode: mode === 'rows' ? 'rows' : 'expedition', prep: mode === 'rows' ? null : mode === 'expPrep' });
      const h = createHash('sha256');
      let n = 0;
      while (s.phase !== 'ENDED' && n < 20000) { const a = R.autoAction(s); const r = R.step(s, a); s = r.state; h.update(JSON.stringify(a)); h.update(JSON.stringify(r.events)); n++; }
      h.update(strip(s));
      h.update(JSON.stringify({ ...s.result.summary }));
      assert.equal(`${h.digest('hex').slice(0, 16)}:${n}`, GOLDEN[key], key);
    }
  });
});
