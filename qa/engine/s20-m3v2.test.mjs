// docs/specs/changes-m3-v2.md (D151, D152; M3 v2): a lean first run (1.1-1.3: no contracts, Reserve, hub contract, tracker
// or vision perk, PREP_POINTS_FIRST points, the unspent ones worth Echoes, no Homeward Bell in zone 1; the second run's one
// offer, three from the third), Gorrak's bounty (1.4), the guided zone's lesson protected (2.1: every fight counts, his node
// opens after ONB_ELITE_FIGHTS or when no Quest or Grind node outside the Dimming is left; 2.2: the held corridor and its
// release), the steady Dimming (3.2: the order and the cap, DIM_FRONT_TIME 4; 3.3: depth by time, the panel data) and the
// rescue's pause and fall-back (3.4). Each rule behind its C.GATES switch: off, the rule before D152 (the golden arms of
// s18 check the old game run for run). The guided route measure is in s18 (the D143 block).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, ev } from './helpers.mjs';
import { CONTENT } from '../../src/content/index.js';
import {
  generateExpZone, dimSchedule, dimAt, dimAtHops, angDist, frontAt, zoneTime, bellHidden, leanFirst, firstRun, nextDim,
} from '../../src/engine/expedition.js';
import { corridorOf, fightNodes } from '../../src/engine/tutorial.js';

const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
const runs = (n) => ({ ...R.newProfile(), runs: n });
const steps = (s, list) => { const events = []; for (const a of list) { const r = R.step(s, a); s = r.state; events.push(...r.events); } return { state: s, events }; };
/** A run at the start camp (phase PREP): a profile with `n` runs played (0: its first run). */
const camp = (n = 0, opts = {}) => R.step(R.newRun({ classId: opts.classId || 'mage', petId: PET(opts.classId || 'mage'), seed: opts.seed ?? 5, content: CONTENT, profile: runs(n), ...(opts.tutorial ? { tutorial: true } : {}) }), { type: 'START_RUN' }).state;
/** A copy changed by fn, refreshed by a no-op action pair (no tolls). */
function tweak(s, fn) {
  s = JSON.parse(R.serialize(s)); s.content = CONTENT;
  fn(s);
  return steps(s, [{ type: 'SET_AUTOPLAY', on: true }, { type: 'SET_AUTOPLAY', on: false }]).state;
}
/** Run fn with C.GATES[key] = value (restored after). */
function withGate(key, value, fn) {
  const old = C.GATES[key];
  C.GATES[key] = value;
  try { return fn(); } finally { C.GATES[key] = old; }
}
/** Autoplay until pred(state) or the run ends; returns the state and the events. */
function autoUntil(s, pred, max = 6000) {
  const events = [];
  for (let n = 0; n < max && s.phase !== 'ENDED' && !pred(s); n++) { const r = R.step(s, R.autoAction(s)); s = r.state; events.push(...r.events); }
  return { state: s, events };
}
/** Win the current fight: every enemy at 1 HP and harmless, then autoplay until no fight is open. */
function win(s) {
  s = JSON.parse(R.serialize(s)); s.content = CONTENT;
  for (const e of s.fight.enemies) Object.assign(e, { hp: 1, dmg: 0 });
  return autoUntil(s, (x) => !x.fight && x.phase !== 'NODE').state;
}

describe('changes-m3-v2.md 1.1-1.3: a profile\'s first run is lean (GATES.firstRunLean)', () => {
  test('1.1 a first run: profile.runs 0 with the start camp; not a later profile, a guided replay or the expedition without the camp', () => {
    assert.equal(C.GATES.firstRunLean, true);
    const f = camp(0);
    assert.deepEqual([firstRun(f), leanFirst(f)], [true, true]);
    assert.deepEqual([leanFirst(camp(1)), leanFirst(camp(1, { tutorial: true })), leanFirst(camp(0, { tutorial: true }))], [false, false, true]);
    const noCamp = R.step(R.newRun({ classId: 'mage', seed: 5, content: CONTENT, mapMode: 'expedition', prep: false }), { type: 'START_RUN' }).state;
    assert.deepEqual([firstRun(noCamp), leanFirst(noCamp)], [true, false], 'the expedition map without the start camp (a simulator option) keeps every system');
    withGate('firstRunLean', false, () => assert.equal(leanFirst(f), false));
  });

  test('1.2-1.3 the camp: no board (TAKE_CONTRACT and DROP_CONTRACT refused), Field Draughts and the Ember of Return only, PREP_POINTS_FIRST points; prepView first and unspent (no reserve)', () => {
    const s = camp(0);
    const v = R.prepView(s);
    assert.deepEqual([v.first, v.points, v.left, v.board], [true, C.PREP_POINTS_FIRST, C.PREP_POINTS_FIRST, []]);
    assert.equal(C.PREP_POINTS_FIRST, C.PREP_OPTION.prep_draughts.price + C.PREP_OPTION.prep_ember.price);
    assert.deepEqual(v.options.map((o) => [o.id, o.kind]), [['prep_draughts', 'supply'], ['prep_ember', 'supply']]);
    assert.deepEqual(v.unspent, { points: C.PREP_POINTS_FIRST, echoes: C.PREP_POINTS_FIRST * C.PREP_ECHO_PER_POINT });
    assert.equal(v.reserve, undefined, 'no Reserve on a first run');
    for (const a of [{ type: 'TAKE_CONTRACT', index: 0 }, { type: 'DROP_CONTRACT', index: 0 }]) assert.equal(R.whyIllegal(s, a), 'no contract on the board');
    for (const id of ['prep_charts', 'prep_tracker']) assert.equal(R.whyIllegal(s, { type: 'BUY_PREP', id }), 'not offered on a first run');
    assert.ok(!R.legalActions(s).some((a) => a.type === 'TAKE_CONTRACT' || (a.type === 'BUY_PREP' && !['prep_draughts', 'prep_ember'].includes(a.id))));
    // both supplies spend every point
    const both = steps(s, [{ type: 'BUY_PREP', id: 'prep_draughts' }, { type: 'BUY_PREP', id: 'prep_ember' }]).state;
    assert.deepEqual([R.prepView(both).left, R.prepView(both).unspent], [0, { points: 0, echoes: 0 }]);
    // a later run keeps its camp: points, the Reserve line, the board, the vision perks
    const later = R.prepView(camp(2));
    assert.deepEqual([later.first, later.points, later.unspent, later.board.length, later.options.length], [false, C.PREP_POINTS, undefined, C.CONTRACT_BOARD_SIZE, C.PREP_CAMP_OPTIONS.length]);
    assert.deepEqual(later.reserve, { points: C.PREP_POINTS, echoes: C.PREP_POINTS * C.PREP_ECHO_PER_POINT });
  });

  test('1.2 the run: contractView null all run, no hub contract (TAKE_HUB_CONTRACT refused), the SET_OUT event marks it first; the points left pay PREP_ECHO_PER_POINT at the summary (line reserve, summary firstRun)', () => {
    let r = steps(camp(0, { seed: 7 }), [{ type: 'BUY_PREP', id: 'prep_ember' }, { type: 'SET_OUT' }]);
    let s = r.state;
    const set = r.events.find((e) => e.t === 'prep' && e.what === 'setOut');
    assert.deepEqual([set.first, set.reserve, set.contracts], [true, 1, 0]);
    assert.equal(R.contractView(s), null);
    // played (no dev tool: a dev run earns no Echoes) to zone 2's hub, then to the end
    s = autoUntil(s, (x) => x.phase === 'ZONE_HUB' && x.zone.z === 2).state;
    assert.deepEqual([s.zone.z, s.zone.hubOffer, R.contractView(s)], [2, null, null]);
    assert.equal(R.whyIllegal(s, { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }), 'no hub contract on offer');
    const end = autoUntil(s, () => false).state;
    assert.equal(end.phase, 'ENDED');
    const sum = R.summary(end);
    assert.equal(sum.firstRun, true);
    const line = sum.echoes.lines.find((l) => l.id === 'reserve');
    assert.deepEqual([line.count, line.each, line.echoes], [1, C.PREP_ECHO_PER_POINT, C.PREP_ECHO_PER_POINT]);
    // a later run: the tracker and the hub offers, no firstRun mark
    let l = steps(camp(2, { seed: 7 }), [{ type: 'SET_OUT' }]).state;
    assert.ok(R.contractView(l));
    l = R.debug.nextZone(l).state;
    assert.ok(l.zone.hubOffer && R.contractView(l).hub);
    assert.equal(R.summary(l).firstRun, undefined);
  });

  test('1.2 the Homeward Bell: in zone 1 of a first run RING_BELL is refused, mapView bell { charges 0, hidden true }, the charge kept; from zone 2\'s hub it is there', () => {
    let s = steps(camp(0), [{ type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]).state;
    assert.equal(bellHidden(s), true);
    assert.equal(R.whyIllegal(s, { type: 'RING_BELL' }), 'the Homeward Bell is not in hand yet');
    assert.ok(!R.legalActions(s).some((a) => a.type === 'RING_BELL'));
    assert.deepEqual(R.mapView(s).bell, { charges: 0, hidden: true, channelTime: C.BELL_CHANNEL_TIME });
    assert.equal(s.exp.bell, C.BELL_START_CHARGES, 'the charge is kept');
    const z2 = R.step(R.debug.nextZone(s).state, { type: 'LEAVE_HUB' }).state;
    assert.equal(bellHidden(z2), false);
    assert.deepEqual(R.mapView(z2).bell, { charges: C.BELL_START_CHARGES, hidden: false, channelTime: C.BELL_CHANNEL_TIME });
    assert.equal(R.whyIllegal(z2, { type: 'RING_BELL' }), null);
    // a later run, and the switch off: the Bell in zone 1
    const later = steps(camp(1), [{ type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]).state;
    assert.deepEqual([bellHidden(later), R.whyIllegal(later, { type: 'RING_BELL' })], [false, null]);
    withGate('firstRunLean', false, () => assert.equal(R.whyIllegal(s, { type: 'RING_BELL' }), null));
  });

  test('autoplay\'s camp on a first run (engine choice, draft): the Ember of Return, then Field Draughts with the last point (no Reserve kept: no hub contract); its map policy never rings the hidden Bell', () => {
    const r = autoUntil(camp(0, { seed: 3 }), (x) => x.phase !== 'PREP');
    assert.deepEqual(r.state.prep.bought, ['prep_ember', 'prep_draughts']);
    assert.equal(r.state.exp.reserve, 0);
    // later run: AUTO_PREP_RESERVE kept as before
    const later = autoUntil(camp(2, { seed: 3 }), (x) => x.phase !== 'PREP').state;
    assert.ok(later.exp.reserve >= C.ENGINE_ASSUMPTION.AUTO_PREP_RESERVE);
    const z1 = autoUntil(r.state, (x) => x.zone && x.zone.z === 2);
    assert.ok(!z1.events.some((e) => e.t === 'bell'), 'no Bell rung in zone 1');
  });
});

describe('changes-m3-v2.md 1.4: Gorrak\'s bounty on a first run (GATES.gorrakBounty)', () => {
  /** A guided run next to Gorrak (node 1) with his node open (fights counted), the guide on. */
  const nextTo = (n, classId = 'mage') => {
    const s = steps(camp(n, { tutorial: true, classId }), [...(n ? [{ type: 'TAKE_CONTRACT', index: 0 }] : []), { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }, { type: 'MOVE', nodeId: 1 }]).state;
    return tweak(autoUntil(s, (x) => !x.fight && x.phase === 'MAP').state, (x) => { x.tutorial.fights = C.ONB_ELITE_FIGHTS; });
  };
  test('his victory pays the guided Cull\'s reward: XP CULL_XP_FRAC × XP_WEIGHT_MULT × xpToNext(CL_c of zone 1), gold CULL_GOLD_V × V(CL_c), a choice of CONTRACT_REWARD_CHOICES items on table "Contract"; event bounty { xp, gold } (D153\'s GATES.bountyRoad off: the XP with them; on, qa/engine/s22)', () => withGate('bountyRoad', false, () => {
    const s = nextTo(0);
    assert.equal(s.zone.nodes[18].barred, undefined);
    const f = R.step(s, { type: 'MOVE', nodeId: 18 }).state;
    assert.equal(f.fight.tut.kind, 'elite');
    const w = JSON.parse(R.serialize(f)); w.content = CONTENT;
    for (const e of w.fight.enemies) e.hp = 1;
    let t = w;
    const events = [];
    for (let n = 0; t.fight && n < 40; n++) { const r = R.step(t, R.autoAction(t)); t = r.state; events.push(...r.events); }
    const b = events.find((e) => e.t === 'bounty');
    assert.ok(b, 'bounty event');
    const xp = events.filter((e) => e.t === 'xp' && e.why === 'bounty');
    const gold = events.filter((e) => e.t === 'gold' && e.why === 'bounty');
    assert.deepEqual([b.xp, b.gold], [xp.reduce((n, e) => n + e.amount, 0), gold.reduce((n, e) => n + e.amount, 0)]);
    const cl = C.ZONE_LEVELS * 0 + C.CONTRACT_CL_OFFSET;
    const heat = xp[0].heat || 0;
    assert.equal(xp[0].amount - heat, Math.round(C.CULL_XP_FRAC * C.XP_WEIGHT_MULT * R.xpToNext(cl)), 'no level-difference modifier');
    assert.equal(gold.length, 1);
    const set = t.node.rewards[0];
    assert.deepEqual([set.kind, set.bounty, set.items.length], ['items', true, C.CONTRACT_REWARD_CHOICES]);
    assert.ok(set.items.every((it) => ['rare', 'epic'].includes(it.rarity)), 'table "Contract": rare or epic');
    assert.equal(t.tutorial.elite, 'victory');
  }));
  test('not on a flight or a rescue, not on a later run ("Play the guide again": the Cull is back), not with the switch off', () => {
    const fled = R.step(R.step(nextTo(0, 'rogue'), { type: 'MOVE', nodeId: 18 }).state, { type: 'FLEE' });
    assert.ok(!fled.events.some((e) => e.t === 'bounty') && fled.state.tutorial.elite === 'fled');
    const later = R.step(nextTo(1), { type: 'MOVE', nodeId: 18 }).state;
    const w = win(later);
    assert.equal(w.tutorial.elite, 'victory');
    assert.ok(!(w.node && w.node.rewards && w.node.rewards.some((x) => x.bounty)));
    withGate('gorrakBounty', false, () => {
      const v = win(R.step(nextTo(0), { type: 'MOVE', nodeId: 18 }).state);
      assert.ok(!(v.node && v.node.rewards && v.node.rewards.some((x) => x.bounty)));
    });
  });
  test('content line guide.bountyLine (draft): one plain sentence', () => {
    const line = CONTENT.tutorial.guide.bountyLine;
    assert.ok(line.length <= C.ONB_HINT_MAX_CHARS && /Gorrak/.test(line) && /\.$/.test(line), line);
  });
});

describe('changes-m3-v2.md 2.1: every fight counts towards Gorrak\'s return (GATES.guidedHold)', () => {
  const atHub = (n = 0) => steps(camp(n, { tutorial: true }), [...(n ? [{ type: 'TAKE_CONTRACT', index: 0 }] : []), { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]).state;
  test('state.tutorial.fights counts every fight that ends in the guided zone (won, fled or rescued; a Dimmed encounter, a site, a script); Gorrak\'s own does not; his node opens at ONB_ELITE_FIGHTS; the barred line\'s {n} is tutorialView.elite.left', () => {
    let s = atHub(1); // "Play the guide again": site 1 on node 1 is a fight that is not a script
    assert.deepEqual([s.tutorial.fights, R.tutorialView(s).elite.left, R.tutorialView(s).elite.barred], [0, C.ONB_ELITE_FIGHTS, true]);
    s = autoUntil(R.step(s, { type: 'MOVE', nodeId: 1 }).state, (x) => !x.fight && x.phase === 'MAP').state;
    assert.deepEqual([s.tutorial.fights, s.tutorial.script, R.tutorialView(s).elite.left], [1, 0, C.ONB_ELITE_FIGHTS - 1], 'a site fight counts');
    // a Dimmed encounter counts: walk onto a Dimmed node (the zone time moved on) and flee
    const d = tweak(s, (x) => { x.time = x.zone.start + 40; });
    const dimmed = d.zone.nodes[1].nb.find((id) => R.mapView(d).nodes[id].dimmed);
    let e = R.step(d, { type: 'MOVE', nodeId: dimmed }).state;
    assert.equal(e.fight.kind, 'dim');
    e = autoUntil(tweak(e, (x) => { for (const m of x.fight.enemies) Object.assign(m, { hp: 1, dmg: 0 }); }), (x) => !x.fight).state;
    assert.deepEqual([e.tutorial.fights, e.tutorial.rescues], [2, 0], 'a Dimmed encounter counts');
    // still barred: Grind node 7 is held in the corridor, so a Quest or Grind node outside the Dimming is left
    assert.deepEqual([fightNodes(e), e.zone.nodes[18].barred, R.tutorialView(e).elite.left], [[7], true, 1]);
    // the third fight (node 7) opens his node
    const third = win(R.step(tweak(e, (x) => { x.zone.pos = 1; x.zone.seen[7] = true; }), { type: 'MOVE', nodeId: 7 }).state);
    assert.deepEqual([third.tutorial.fights, third.zone.nodes[18].barred, R.tutorialView(third).elite.left], [3, undefined, 0]);
    // Gorrak's own fight does not count
    const g = tweak(s, (x) => { x.tutorial.fights = C.ONB_ELITE_FIGHTS; });
    const gw = win(R.step(g, { type: 'MOVE', nodeId: 18 }).state);
    assert.deepEqual([gw.tutorial.elite, gw.tutorial.fights], ['victory', C.ONB_ELITE_FIGHTS]);
  });
  test('it opens at once when no unresolved Quest or Grind node outside the Dimming is left, and stays open; with the switch off the D143 gate after ONB_GATE_SCRIPTS scripts', () => {
    const s = atHub();
    const qg = s.zone.nodes.filter((n) => ['quest', 'grind'].includes(n.type)).map((n) => n.id);
    const none = tweak(s, (x) => { for (const id of qg) x.zone.nodes[id].done = true; });
    assert.deepEqual([none.zone.nodes[18].barred, none.zone.tut.open, R.tutorialView(none).elite.left], [undefined, true, C.ONB_ELITE_FIGHTS]);
    assert.equal(tweak(none, (x) => { x.zone.nodes[qg[0]].done = false; }).zone.nodes[18].barred, undefined, 'open for good');
    withGate('guidedHold', false, () => {
      const o = atHub();
      assert.equal(o.tutorial.fights, undefined, 'no counter with the switch off');
      assert.equal(tweak(o, (x) => { x.tutorial.script = C.ONB_GATE_SCRIPTS - 1; }).zone.nodes[18].barred, true);
      assert.equal(tweak(o, (x) => { x.tutorial.script = C.ONB_GATE_SCRIPTS; }).zone.nodes[18].barred, undefined);
      assert.equal(R.tutorialView(o).elite.left, C.ONB_GATE_SCRIPTS);
    });
  });
});

describe('changes-m3-v2.md 2.2: the corridor held from the Dimming until Gorrak\'s fight or the guide ends (GATES.guidedHold)', () => {
  const atHub = () => steps(camp(0, { tutorial: true }), [{ type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]).state;
  test('on TUTORIAL_SEED the corridor is nodes 0 (hub), 1, 18 (Gorrak), 7 and 19 (the Road nearest him): one shortest path each, ties by lowest id', () => {
    const s = atHub();
    assert.deepEqual(s.zone.hold, { ids: [0, 1, 7, 18, 19], release: null, at: {} });
    assert.deepEqual(corridorOf(s.zone, 18), [0, 1, 7, 18, 19]);
    assert.ok(s.zone.roads.includes(19));
    assert.deepEqual(R.tutorialView(s).hold, { ids: [0, 1, 7, 18, 19], released: false, release: null });
  });
  test('held: never Dimmed (dimAt Infinity), the map marks it held with no "dims in" chip; the other nodes are scheduled without it (the cap counts only them)', () => {
    const s = atHub();
    const z = s.zone;
    for (const zt of [0, 10, 20, 40, 80]) {
      const v = R.mapView(tweak(s, (x) => { x.time = x.zone.start + zt; }));
      for (const id of z.hold.ids) assert.deepEqual([v.nodes[id].dimmed, v.nodes[id].held, v.nodes[id].dimsIn, v.nodes[id].dimAt], [false, true, null, Infinity], `zt ${zt} node ${id}`);
    }
    const sched = dimSchedule(z, new Set(z.hold.ids));
    assert.deepEqual(z.dimBase, sched);
    const at = z.nodes.map((n) => n.id).filter((id) => !z.hold.ids.includes(id)).map((id) => dimAt(z, id));
    const per = {};
    for (const t of at) per[t] = (per[t] || 0) + 1;
    assert.ok(Math.max(...Object.values(per)) <= C.DIM_MAX_PER_TOLL);
    assert.equal(at.length, z.nodes.length - z.hold.ids.length);
  });
  test('released when his fight ends: node i in order of hops from the Shardfall (ties: lowest id) dims at max(dimAtHops(hops), tRelease + ONB_HOLD_RELEASE + i); the Road last; no corridor node dims before', () => {
    let s = tweak(atHub(), (x) => { x.tutorial.fights = C.ONB_ELITE_FIGHTS; x.zone.pos = 1; x.zone.seen[1] = true; x.zone.seen[18] = true; });
    s = R.step(s, { type: 'MOVE', nodeId: 18 }).state;
    assert.equal(s.zone.hold.release, null, 'held during his fight');
    s = win(s);
    const z = s.zone;
    const t = z.hold.release;
    assert.equal(t, s.time - z.start);
    const order = z.hold.ids.slice().sort((a, b) => z.shardDist[a] - z.shardDist[b] || a - b);
    order.forEach((id, i) => assert.equal(dimAt(z, id), Math.max(dimAtHops(z.shardDist[id]), t + C.ONB_HOLD_RELEASE + i), `node ${id}`));
    assert.equal(order[order.length - 1], 19, 'the Road dims last');
    assert.ok(Math.min(...z.hold.ids.map((id) => dimAt(z, id))) >= t + C.ONB_HOLD_RELEASE);
    assert.deepEqual(R.tutorialView(s).hold, { ids: [0, 1, 7, 18, 19], released: true, release: t });
    assert.equal(R.mapView(s).nodes[0].held, undefined);
  });
  test('released when the guide ends (SKIP_GUIDE), not held when the guide was skipped at the camp, none with the switch off', () => {
    const k = R.step(tweak(atHub(), (x) => { x.time = x.zone.start + 5; }), { type: 'SKIP_GUIDE' }).state;
    assert.equal(k.zone.hold.release, 5);
    const early = steps(camp(0, { tutorial: true }), [{ type: 'SKIP_GUIDE' }, { type: 'SET_OUT' }]).state;
    assert.equal(early.zone.hold, undefined);
    withGate('guidedHold', false, () => assert.equal(atHub().zone.hold, undefined));
  });
  test('content line guide.holdLine (draft) and G13 on a Road with no Bell (G13.onRoadFirst)', () => {
    const T = CONTENT.tutorial;
    assert.match(T.guide.holdLine, /Gorrak/);
    assert.equal(T.beats.find((b) => b.id === 'G13').alt.onRoadFirst, 'On a Road: take it to the next zone.');
  });
});

describe('changes-m3-v2.md 3.2-3.3: the steady Dimming (GATES.steadyDim)', () => {
  const zones = () => {
    const out = [];
    for (let seed = 1; seed <= 300; seed++) {
      const s = R.step(R.step(R.newRun({ classId: 'mage', seed, content: CONTENT, profile: runs(2), mapMode: 'expedition', prep: false }), { type: 'START_RUN' }).state, { type: 'LEAVE_HUB' }).state;
      out.push(s.zone);
    }
    return out;
  };
  test('DIM_FRONT_TIME 4 (was 5: DIM_FRONT_TIME_NOCAP with the switch off); dimAtHops 6, 8, 10, ...', () => {
    assert.deepEqual([C.DIM_FRONT_TIME, C.DIM_FRONT_TIME_NOCAP, C.DIM_MAX_PER_TOLL], [4, 5, 2]);
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(dimAtHops), [6, 8, 10, 12, 14, 16, 18]);
    assert.deepEqual([6, 7, 8, 9, 10].map(frontAt), [0, 0, 1, 1, 2]);
    withGate('steadyDim', false, () => assert.deepEqual([0, 1, 2, 3].map(dimAtHops), [6, 9, 11, 14]));
  });
  test('the order (hops from the Shardfall, angular distance, id) and the schedule dimAt_k = max(dimAtHops(h_k), dimAt_(k-1), dimAt_(k-DIM_MAX_PER_TOLL) + 1) on 300 maps: at most DIM_MAX_PER_TOLL nodes a toll, never before the hop pace, one connected patch', () => {
    let maxPer = 0;
    for (const z of zones()) {
      assert.deepEqual(z.dimBase, dimSchedule(z));
      const a0 = z.nodes[z.shardfall].angle;
      const order = z.nodes.map((n) => n.id).sort((a, b) => z.shardDist[a] - z.shardDist[b] || angDist(z.nodes[a].angle, a0) - angDist(z.nodes[b].angle, a0) || a - b);
      let prev = [];
      order.forEach((id, k) => {
        const want = Math.max(dimAtHops(z.shardDist[id]), k > 0 ? prev[k - 1] : -Infinity, k >= C.DIM_MAX_PER_TOLL ? prev[k - C.DIM_MAX_PER_TOLL] + 1 : -Infinity);
        assert.equal(dimAt(z, id), want, `node ${id}`);
        prev.push(want);
      });
      assert.equal(dimAt(z, z.shardfall), C.DIM_GRACE, 'the Shardfall first, at DIM_GRACE');
      const per = {};
      for (const t of prev) per[t] = (per[t] || 0) + 1;
      maxPer = Math.max(maxPer, ...Object.values(per));
      // connected: every node but the first dims no earlier than a neighbour that is nearer the Shardfall
      for (const n of z.nodes) if (n.id !== z.shardfall) assert.ok(n.nb.some((v) => z.shardDist[v] < z.shardDist[n.id] && dimAt(z, v) <= dimAt(z, n.id)), `node ${n.id}`);
      prev = null;
    }
    assert.equal(maxPer, C.DIM_MAX_PER_TOLL);
  });
  test('the depth of a Dimmed encounter is the time since its node dimmed: max(0, floor(DIM_FRONT_HOPS × (zt - dimAt) / DIM_FRONT_TIME)); switch off: front - hops', () => {
    const base = R.step(R.step(R.newRun({ classId: 'mage', seed: 9, content: CONTENT, profile: runs(2) }), { type: 'START_RUN' }).state, { type: 'SET_OUT' }).state;
    const s0 = R.step(base, { type: 'LEAVE_HUB' }).state;
    const target = s0.zone.nodes[0].nb[0];
    for (const dt of [0, 1, 2, 3, 4, 7]) {
      const at = dimAt(s0.zone, target);
      const s = tweak(s0, (x) => { x.time = x.zone.start + at + dt - 1; x.zone.nodes[target].done = true; });
      const r = R.step(s, { type: 'MOVE', nodeId: target });
      const zt = zoneTime(s) + 1;
      assert.equal(r.state.node.depth, Math.max(0, Math.floor((C.DIM_FRONT_HOPS * (zt - at)) / C.DIM_FRONT_TIME)), `dt ${dt}`);
    }
  });
  test('a `dimming` event lists the nodes whose dimAt falls in the tolls just spent (no more than DIM_MAX_PER_TOLL per toll)', () => {
    let s = R.step(R.step(R.step(R.newRun({ classId: 'mage', seed: 2, content: CONTENT, profile: runs(2) }), { type: 'START_RUN' }).state, { type: 'SET_OUT' }).state, { type: 'LEAVE_HUB' }).state;
    s = tweak(s, (x) => { x.time = x.zone.start + C.DIM_GRACE + 1; });
    const zt = zoneTime(s);
    const id = s.zone.nodes[0].nb.find((x) => R.isLegal(s, { type: 'PASS_THROUGH', nodeId: x }));
    const r = R.step(s, { type: 'PASS_THROUGH', nodeId: id });
    const want = s.zone.nodes.filter((n) => { const a = dimAt(s.zone, n.id); return a > zt && a <= zt + 1; }).map((n) => n.id);
    const got = ev(r.events, 'dimming');
    if (want.length) assert.deepEqual(got.map((e) => e.dimmed), [want]); else assert.deepEqual(got, []);
    assert.ok(want.length <= C.DIM_MAX_PER_TOLL);
  });
  test('mapView.dim: steady, maxPerToll, nextIn (the smallest dimAt - zt above 0), nextCount, count, total, shift; switch off: nextIn the front\'s next step, maxPerToll null', () => {
    const s0 = R.step(R.step(R.step(R.newRun({ classId: 'mage', seed: 4, content: CONTENT, profile: runs(2) }), { type: 'START_RUN' }).state, { type: 'SET_OUT' }).state, { type: 'LEAVE_HUB' }).state;
    for (const zt of [0, 5, 6, 9, 13, 18, 30]) {
      const s = tweak(s0, (x) => { x.time = x.zone.start + zt; });
      const d = R.mapView(s).dim;
      const ats = s.zone.nodes.map((n) => dimAt(s.zone, n.id));
      const future = ats.filter((a) => a > zt);
      const nextIn = future.length ? Math.min(...future) - zt : Infinity;
      assert.deepEqual([d.steady, d.maxPerToll, d.nextIn, d.nextCount, d.count, d.total, d.shift], [true, C.DIM_MAX_PER_TOLL, nextIn, future.filter((a) => a - zt === nextIn).length, ats.filter((a) => a <= zt).length, 31, 0], `zt ${zt}`);
      assert.deepEqual(nextDim(s.zone, zt), { nextIn, nextCount: d.nextCount });
    }
    withGate('steadyDim', false, () => {
      const o = R.step(R.step(R.step(R.newRun({ classId: 'mage', seed: 4, content: CONTENT, profile: runs(2) }), { type: 'START_RUN' }).state, { type: 'SET_OUT' }).state, { type: 'LEAVE_HUB' }).state;
      const d = R.mapView(o).dim;
      assert.deepEqual([d.steady, d.maxPerToll, d.frontTime, d.nextIn], [false, null, C.DIM_FRONT_TIME_NOCAP, C.DIM_GRACE]);
    });
    assert.match(CONTENT.texts.expedition.dimming_pace, /\{maxPerToll\}.*\{grace\}/);
  });
  test('no Infinity in the state: the schedule and the corridor serialise (a held node\'s base is null)', () => {
    const g = steps(camp(0, { tutorial: true }), [{ type: 'SET_OUT' }]).state;
    const back = R.deserialize(R.serialize(g), CONTENT);
    assert.deepEqual(back.zone.dimBase, g.zone.dimBase);
    assert.ok(g.zone.hold.ids.every((id) => g.zone.dimBase[id] === null));
    assert.ok(g.zone.dimBase.every((x) => x === null || Number.isInteger(x)));
    for (const n of back.zone.nodes) assert.equal(dimAt(back.zone, n.id), dimAt(g.zone, n.id));
  });
});

describe('changes-m3-v2.md 3.4: a rescue never lands in a mostly dark zone (GATES.rescueDim)', () => {
  /** "Play the guide again" (the Bell in hand; no difference for the rule) at zone toll zt, a fight on node 2 lost. */
  const rescueAt = (zt) => {
    let s = steps(camp(1, { tutorial: true, classId: 'hunter' }), [{ type: 'SET_OUT' }, { type: 'LEAVE_HUB' }, { type: 'MOVE', nodeId: 2 }]).state;
    s = JSON.parse(R.serialize(s)); s.content = CONTENT;
    s.time = s.zone.start + zt; s.player.hp = 1;
    for (const e of s.fight.enemies) e.dmg = 1e6;
    const s0 = s;
    const events = [];
    for (let n = 0; s.fight && n < 10; n++) { const r = R.step(s, { type: 'PASS' }); s = r.state; events.push(...r.events); }
    return { s0, s, events };
  };
  const dark = (x) => x.zone.nodes.filter((n) => zoneTime(x) >= dimAt(x.zone, n.id)).map((n) => n.id);
  test('the rescue\'s ONB_RESCUE_TOLLS count on the Furnace, not on the Dimming (zone.dimShift): no node dims during a rescue', () => {
    const { s0, s, events } = rescueAt(10);
    assert.ok(events.some((e) => e.t === 'rescue'));
    assert.equal(s.zone.dimShift, C.ONB_RESCUE_TOLLS);
    assert.equal(zoneTime(s) - zoneTime(s0), C.ONB_RESCUE_TOLLS, 'the run tolls');
    assert.ok(ev(events, 'time').some((e) => e.why === 'rescue' && e.add === C.ONB_RESCUE_TOLLS));
    assert.deepEqual(ev(events, 'dimming'), []);
    assert.ok(dark(s0).length > 0 && dark(s0).length <= 15, `${dark(s0).length} Dimmed before`);
    assert.deepEqual(dark(s), dark(s0), 'the same nodes Dimmed after the rescue');
    assert.deepEqual(R.mapView(s).nodes.filter((n) => n.dimmed).map((n) => n.id), dark(s0));
  });
  test('then, while more than floor(DIM_RESCUE_MAX_SHARE × nodes) are Dimmed, the Dimming falls back toll by toll (event dimBack { tolls }); nodes come back with their content', () => {
    const cap = Math.floor(C.DIM_RESCUE_MAX_SHARE * 31);
    assert.equal(cap, 15);
    const { s, events } = rescueAt(30);
    const back = events.find((e) => e.t === 'dimBack');
    assert.ok(back && back.tolls > 0, 'it fell back');
    const zt = zoneTime(s);
    const dark = s.zone.nodes.filter((n) => zt >= dimAt(s.zone, n.id)).length;
    assert.ok(dark <= cap, `${dark} Dimmed`);
    assert.equal(s.zone.dimShift, C.ONB_RESCUE_TOLLS + back.tolls);
    // one toll less would leave more than the cap
    const less = s.zone.nodes.filter((n) => zt >= dimAt(s.zone, n.id) - 1).length;
    assert.ok(less > cap, 'the smallest fall-back');
    const lit = s.zone.nodes.find((n) => !n.done && ['quest', 'grind'].includes(n.type) && zt < dimAt(s.zone, n.id));
    assert.ok(lit && R.mapView(s).nodes[lit.id].lost !== true);
    assert.equal(R.mapView(s).dim.shift, s.zone.dimShift);
  });
  test('switch off: the rescue\'s tolls move the Dimming (no shift, no fall-back)', () => withGate('rescueDim', false, () => {
    const { s, events } = rescueAt(30);
    assert.equal(s.zone.dimShift || 0, 0);
    assert.ok(!events.some((e) => e.t === 'dimBack'));
  }));
  test('content line guide.dimBackLine (draft)', () => {
    assert.equal(CONTENT.tutorial.guide.dimBackLine, 'The Bellwrights ring their bells, and the dark falls back.');
  });
});

describe('changes-m3-v2.md 1.3 content: the first-run camp lines (draft)', () => {
  test('prep.unspentFirst names {echoes}; prep.unspentLabel is the summary\'s label of the reserve line on a first run', () => {
    const P = CONTENT.tutorial.prep;
    assert.equal(P.unspentFirst, 'Points you do not spend: +{echoes} Echoes at the end of the run.');
    assert.equal(P.unspentLabel, 'Unspent camp points');
  });
});
