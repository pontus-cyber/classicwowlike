// rules.md 1.7.1-1.7.2 and 1.9.10 (heat): the line, the player's heat, the four states, the Dimming's clock in an
// expedition zone, projected Ascendancy, heatView and heatPreview (exact against the engine's own hours and states).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, tweak, atLevel, withSpells, inFight, forceDraws, ev, peek, cloneState } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { dimAt, zoneHours } from '../../src/engine/expedition.js';
import { lineAt, runState, dimState, ascOver, hotter } from '../../src/engine/heat.js';
import { rollDrop } from '../../src/engine/items.js';
import { vendorStock } from '../../src/engine/map.js';
import { echoes } from '../../src/engine/meta.js';
import { makeRng } from '../../src/rng.js';

/** A started expedition run (phase ZONE_HUB of zone 1). */
function expRun(classId = 'mage', opts = {}) {
  const s = R.newRun({
    classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed: opts.seed ?? 1, content: opts.content || CONTENT,
    profile: opts.profile || null, mapMode: 'expedition',
  });
  return R.step(s, { type: 'START_RUN' }).state;
}
const onMap = (s) => R.step(s, { type: 'LEAVE_HUB' }).state;
const OATHS = { ...R.newProfile(), unlocks: { oaths: 1 }, bossKills: 1 };
/**
 * Does the step of a previewed action spend all of its previewed hours? Not for Grind waves chosen inside (spent as
 * each wave starts), and not when a Dimmed encounter follows something that stays open (a node, a trainer or vendor,
 * or the Bell, which completes after the encounter).
 */
function sameStep(p) {
  const a = p.action;
  if (p.perWave || (a.type === 'GRIND_SET_WAVES' && a.n > 1)) return false;
  if (!p.dimFight) return true;
  return a.type === 'PASS_THROUGH' || (a.type === 'MOVE' && p.pays === null) || (a.type === 'SERVICE' && a.service === 'inn');
}

describe('rules 1.7.1 the line and the heat', () => {
  test('line(z) = parHours × min(z, ZONE_COUNT) / ZONE_COUNT: 20 h per zone at par 120, the Camp at the par; Haste lowers it', () => {
    for (let z = 1; z <= C.ZONE_COUNT + 1; z++) assert.equal(lineAt([], z), (C.BOSS_TIME_PAR * Math.min(z, C.ZONE_COUNT)) / C.ZONE_COUNT);
    assert.equal(lineAt([], 1), 20);
    assert.equal(lineAt([], C.ZONE_COUNT + 1), C.BOSS_TIME_PAR);
    const par = C.BOSS_TIME_PAR - C.OATH_HASTE_HOURS;
    for (let z = 1; z <= C.ZONE_COUNT; z++) assert.equal(lineAt(['haste'], z), Math.round(((par * z) / C.ZONE_COUNT) * 1e6) / 1e6, `haste z${z}`);
    // In a run: heat = hours - line of the current zone; the hub of zone 1 starts with a full share in hand.
    let s = started('rogue');
    let v = R.heatView(s);
    assert.deepEqual([v.hours, v.par, v.z, v.line, v.heat, v.inHand, v.past], [0, C.BOSS_TIME_PAR, 1, 20, -20, 20, 0]);
    s = tweak(s, (x) => { x.hours = 27; });
    v = R.heatView(s);
    assert.deepEqual([v.heat, v.inHand, v.past], [7, 0, 7]);
    // Haste: the line of zone 1 is 100 / 6 (6 decimals); the heat keeps 6 decimals.
    let h = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT, profile: OATHS });
    h = R.step(R.step(h, { type: 'SET_OATH', oath: 'haste', on: true }).state, { type: 'START_RUN' }).state;
    v = R.heatView(tweak(h, (x) => { x.hours = 17; }));
    assert.equal(v.par, par);
    assert.equal(v.line, 16.666667);
    assert.equal(v.heat, 0.333333);
    assert.equal(v.state, 'warm');
  });

  test('entering the next zone moves the line one share ahead; TRAVEL_ON hours count against the zone left; the Camp line is the par', () => {
    let s = R.step(started('mage'), { type: 'LEAVE_HUB' }).state;
    s = tweak(atLevel(s, 10), (x) => { x.hours = 25; });
    const before = R.heatView(s);
    assert.equal(before.heat, 5);
    const pv = R.heatPreview(s, { type: 'TRAVEL_ON' });
    assert.equal(pv.hours, C.HOURS_TRAVEL);
    s = R.step(s, { type: 'TRAVEL_ON' }).state;
    const after = R.heatView(s);
    assert.deepEqual([after.z, after.line, after.hours, after.heat], [2, 40, 27, -13]);
    assert.deepEqual([pv.line, pv.heat, pv.state], [after.line, after.heat, after.state]);
    // The Camp: the line is the par, heat at FIGHT_BOSS is the over-par hours of the Ascendancy formula.
    for (const over of [-7, 0, 9, 10, 25, 39, 40, 200]) {
      let c = tweak(atLevel(started('mage'), 60), (x) => { x.zone.z = C.ZONE_COUNT; x.hours = C.BOSS_TIME_PAR + over - C.HOURS_TRAVEL; });
      c = R.step(R.step(c, { type: 'LEAVE_HUB' }).state, { type: 'TRAVEL_ON' }).state;
      assert.equal(c.phase, 'CAMP');
      const v = R.heatView(c);
      assert.deepEqual([v.z, v.line, v.heat], [C.ZONE_COUNT + 1, C.BOSS_TIME_PAR, over]);
      const b = R.step(c, { type: 'FIGHT_BOSS' }).state;
      assert.equal(v.ascIfPar, b.fight.boss.asc, `over ${over}: ascIfPar is the boss Ascendancy at the Camp`);
    }
  });

  test('ascIfPar = min(ASC_CAP, ASC_PER_STEP × floor(max(0, heat) / ASC_STEP_HOURS))', () => {
    for (const heat of [-20, -0.5, 0, 0.333333, 9, 10, 19.5, 20, 30.333333, 99, 1000]) {
      const want = Math.round(Math.min(C.ASC_CAP, C.ASC_PER_STEP * Math.floor(Math.max(0, heat) / C.ASC_STEP_HOURS)) * 1e6) / 1e6;
      assert.equal(ascOver(heat), want, `heat ${heat}`);
      assert.equal(R.heatView(tweak(started('rogue'), (x) => { x.hours = 20 + heat; })).ascIfPar, want);
    }
  });
});

describe('rules 1.7.2 heat states', () => {
  test('Clear below HEAT_WARM_AT, Warm from it, Hot from HEAT_HOT_AT (= ASC_STEP_HOURS), Scorched from HEAT_SCORCH_AT; rewards by state', () => {
    assert.equal(C.HEAT_HOT_AT, C.ASC_STEP_HOURS);
    assert.deepEqual(C.HEAT_STATES, ['clear', 'warm', 'hot', 'scorched']);
    const cases = [[-20, 'clear'], [-1, 'clear'], [-0.000001, 'clear'], [0, 'warm'], [9, 'warm'], [10, 'hot'], [29, 'hot'], [30, 'scorched'], [80, 'scorched']];
    for (const [heat, st] of cases) {
      assert.equal(runState(heat), st, `heat ${heat}`);
      if (Number.isInteger(heat)) {
        const v = R.heatView(tweak(started('hunter'), (x) => { x.hours = 20 + heat; }));
        assert.deepEqual([v.stateRun, v.state, v.by, v.dimIn, v.stateDim], [st, st, 'run', null, null], `rows run at heat ${heat}`);
        assert.equal(v.gain, C.HEAT_GAIN[st]);
        assert.equal(v.rarityUp, C.HEAT_RARITY_UP[st]);
      }
    }
    assert.deepEqual(C.HEAT_GAIN, { clear: 0, warm: 0, hot: 0.35, scorched: 0.5 });
    assert.deepEqual(C.HEAT_RARITY_UP, { clear: 0, warm: 0, hot: 0.5, scorched: 0.7 }); // M2b v6 (D62): was 0.25 / 0.40
    assert.equal(hotter('warm', null), 'warm');
    assert.equal(hotter('clear', 'hot'), 'hot');
    assert.equal(hotter('scorched', 'warm'), 'scorched');
  });

  test('the bar: HEAT_BAR_MIN..HEAT_BAR_MAX, the marker clamped, beyond -1 / 0 / 1', () => {
    for (const [heat, marker, beyond] of [[-25, C.HEAT_BAR_MIN, -1], [-20, -20, 0], [7, 7, 0], [40, 40, 0], [41, C.HEAT_BAR_MAX, 1]]) {
      const v = R.heatView(tweak(started('rogue'), (x) => { x.hours = 20 + heat; }));
      assert.deepEqual(v.bar, { min: C.HEAT_BAR_MIN, max: C.HEAT_BAR_MAX, marker, beyond }, `heat ${heat}`);
    }
  });
});

describe('rules 1.9.10 heat in an expedition zone', () => {
  test('dimIn = dimAt(player node) - hz; Dimming states by HEAT_DIM_WARM_H and HEAT_DIM_HOT_H; the hotter state counts, by = dim', () => {
    const s = onMap(expRun('mage', { seed: 4 }));
    const at = dimAt(s.zone, 0);
    for (const [left, st] of [[at, 'clear'], [C.HEAT_DIM_WARM_H + 1, 'clear'], [C.HEAT_DIM_WARM_H, 'warm'], [C.HEAT_DIM_HOT_H + 1, 'warm'], [C.HEAT_DIM_HOT_H, 'hot'], [1, 'hot'], [0, 'scorched'], [-3, 'scorched']]) {
      assert.equal(dimState(left), st);
      const t = tweak(s, (x) => { x.hours = x.zone.start + at - left; });
      const v = R.heatView(t);
      assert.equal(v.dimIn, dimAt(t.zone, t.zone.pos) - zoneHours(t));
      assert.equal(v.dimIn, left);
      assert.equal(v.stateDim, st, `${left} h left`);
      // Zone 1 at hz <= at: the run state is Clear (at most 14 of its 20 h), so the Dimming sets the state.
      assert.equal(v.stateRun, 'clear');
      assert.equal(v.state, st);
      assert.equal(v.by, st === 'clear' ? 'run' : 'dim');
    }
    // The run state wins when it is hotter.
    const hot = R.heatView(tweak(s, (x) => { x.hours = 40; x.zone.start = 40 - (at - 3); }));
    assert.equal(hot.stateDim, 'warm');
    assert.equal(hot.stateRun, 'hot');
    assert.deepEqual([hot.state, hot.by], ['hot', 'run']);
  });

  test('no Dimming clock in a rows run or at the Camp', () => {
    assert.equal(R.heatView(started('rogue')).dimIn, null);
    let c = expRun('mage', { seed: 5 });
    c = tweak(atLevel(c, 60), (x) => { x.zone.z = C.ZONE_COUNT; });
    c = onMap(c);
    c = R.step(c, { type: 'RING_BELL' }).state;
    assert.equal(c.phase, 'CAMP');
    const v = R.heatView(c);
    assert.deepEqual([v.dimIn, v.stateDim, v.line], [null, null, C.BOSS_TIME_PAR]);
  });
});

describe('heatView and heatPreview (engine-api.md 11)', () => {
  test('null before START_RUN; defined in every later phase of full autoplay runs; reading it changes nothing', () => {
    assert.equal(R.heatView(R.newRun({ classId: 'mage', seed: 1, content: CONTENT })), null);
    for (const mapMode of ['rows', 'expedition']) {
      let s = R.step(R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 9, content: REAL, mapMode }), { type: 'START_RUN' }).state;
      const phases = new Set();
      for (let n = 0; s.phase !== 'ENDED' && n < 20000; n++) {
        const before = R.serialize(s);
        const v = R.heatView(s);
        assert.ok(v && C.HEAT_STATES.includes(v.state), `${mapMode} ${s.phase}`);
        if (s.fight) assert.deepEqual(v.next, []);
        assert.equal(R.serialize(s), before);
        phases.add(s.phase);
        s = R.step(s, R.autoAction(s)).state;
      }
      assert.ok(phases.has('MAP') && phases.has('NODE') && phases.has('ZONE_HUB'));
    }
  });

  test('previews are exact: hours, heat and state after each listed choice equal the engine\'s (rows and expedition, fixture and real content)', () => {
    let checked = 0;
    const dimFights = { seen: 0 };
    // Rows seeds whose autoplay runs reach the Camp (hubs, travel, Camp services and waves); expedition seeds that meet the Dimming.
    // (Seeds re-picked when the heat step landed in the loot stream, rules 8.4: the runs changed.)
    for (const [mapMode, seed, content, cls] of [['rows', 1, CONTENT, 'hunter'], ['rows', 3, REAL, 'mage'], ['expedition', 6, CONTENT, 'hunter'], ['expedition', 1, REAL, 'rogue']]) {
      let s = R.step(R.newRun({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, content, mapMode }), { type: 'START_RUN' }).state;
      const kinds = new Set();
      for (let n = 0; s.phase !== 'ENDED' && n < 20000; n++) {
        const v = R.heatView(s);
        for (const p of v.next) {
          assert.deepEqual(R.heatPreview(s, p.action), (({ action, ...rest }) => rest)(p));
          if (!sameStep(p)) continue;
          const r = R.step(s, p.action);
          const w = R.heatView(r.state);
          assert.equal(w.hours, s.hours + p.hours, `${JSON.stringify(p.action)} hours`);
          assert.deepEqual([w.line, w.heat, w.stateRun, w.state, w.ascIfPar], [p.line, p.heat, p.stateRun, p.state, p.ascIfPar], JSON.stringify(p.action));
          // Leaving the zone: the next zone's map is drawn on arrival, so the preview has no Dimming clock; its hub starts Clear.
          if (w.z !== v.z) { assert.equal(p.dimIn, null); assert.ok(w.stateDim === null || w.stateDim === 'clear'); }
          else assert.deepEqual([w.dimIn, w.stateDim], [p.dimIn, p.stateDim], JSON.stringify(p.action));
          assert.equal(p.change, p.state !== v.state);
          if (p.dimFight) { dimFights.seen++; assert.equal(r.state.node.type, 'dim'); }
          kinds.add(p.action.type);
          checked++;
        }
        s = R.step(s, R.autoAction(s)).state;
      }
      const want = mapMode === 'rows' ? ['CHOOSE_NODE', 'TRAVEL_ON', 'SERVICE', 'CAMP_GRIND'] : ['MOVE', 'PASS_THROUGH', 'RING_BELL', 'SERVICE'];
      for (const k of want) assert.ok(kinds.has(k), `${mapMode} seed ${seed}: ${k} checked`);
    }
    assert.ok(checked > 1000, `checked ${checked}`);
    assert.ok(dimFights.seen > 10, `dimFight previews checked ${dimFights.seen}`);
  });

  test('a walk that ends in the Dimming previews its Dimmed encounter (dimFight, Scorched); pays only on node entries', () => {
    let s = onMap(expRun('mage', { seed: 8 }));
    const nb = s.zone.nodes[0].nb[0];
    // The neighbour dims one hour from now: a pass through it ends in the dark.
    s = tweak(s, (x) => { x.hours = x.zone.start + dimAt(x.zone, nb) - 1; });
    const pass = R.heatPreview(s, { type: 'PASS_THROUGH', nodeId: nb });
    assert.equal(pass.dimFight, true);
    assert.equal(pass.hours, C.HOURS_WALK + C.HOURS_DIM_FIGHT);
    assert.equal(pass.state, 'scorched');
    assert.equal(pass.pays, null);
    const r = R.step(s, { type: 'PASS_THROUGH', nodeId: nb }).state;
    assert.equal(r.node.type, 'dim');
    assert.equal(r.hours, s.hours + pass.hours);
    // Entering it now pays at its clock now: 1 h left = Hot.
    const enter = R.heatPreview(s, { type: 'MOVE', nodeId: nb });
    assert.equal(enter.pays, 'hot');
    assert.equal(R.heatPreview(s, { type: 'LEAVE_HUB' }), null, 'not legal');
    assert.equal(R.heatPreview(started('rogue'), { type: 'LEAVE_HUB' }), null, 'costs no hours');
  });
});

// ---------------- Rewards (rules 1.7.3, 8.4, 11.1) and the summary (1.7.4) ----------------
const mob = (level, tid = 'z1_brute') => ({ tid, level, variant: 'normal' });
/** A one-mob quest fight in a node entered in `heat`, won with one forced hit: { state, events }. */
function winQuest(heat, { seed = 5, rested = 0, profile = null, L = 10 } = {}) {
  let s = withSpells(atLevel(started('rogue', { seed, profile }), L), []);
  s = inFight(s, [mob(L)], { kind: 'quest' }).state;
  s = tweak(s, (x) => {
    x.node.heat = heat; x.fight.heat = heat; x.player.rested = rested;
    const e = x.fight.enemies[0]; e.hp = 1; e.dodge = 0; e.shield = 0;
  });
  forceDraws(s, 3, (d) => d[0] > 0.6);
  return R.step(s, { type: 'ATTACK', target: 0 });
}
const amounts = (events, t) => ev(events, t).map((e) => [e.why, e.amount, e.heat || 0]);

describe('rules 1.7.3 what heat gives', () => {
  test('the heat state is fixed on node entry, before the node\'s hours: on the node, its fights and the node event; it equals heatPreview.pays', () => {
    // Today's map: Warm at entry (heat 9); the 2 h quest ends Hot, the node pays Warm.
    let s = R.step(started('rogue', { seed: 2 }), { type: 'LEAVE_HUB' }).state;
    const lane = R.mapView(s).next.find((l) => s.zone.rows[0][l].type === 'quest');
    for (const [hours, want] of [[29, 'warm'], [19, 'clear'], [30, 'hot'], [55, 'scorched']]) {
      const t0 = tweak(s, (x) => { x.hours = hours; });
      const pv = R.heatPreview(t0, { type: 'CHOOSE_NODE', lane });
      assert.equal(pv.pays, want);
      const r = R.step(t0, { type: 'CHOOSE_NODE', lane });
      assert.equal(r.state.node.heat, want, `heat ${hours - 20}`);
      assert.equal(r.state.fight.heat, want);
      assert.equal(ev(r.events, 'node')[0].heat, want);
      assert.equal(ev(r.events, 'fight')[0].heat, want);
      assert.deepEqual(R.heatView(r.state).node, { state: want, gain: C.HEAT_GAIN[want], rarityUp: C.HEAT_RARITY_UP[want] });
    }
    // The meter moves on inside the node; the node keeps its state.
    const w = R.step(tweak(s, (x) => { x.hours = 29; }), { type: 'CHOOSE_NODE', lane }).state;
    assert.equal(R.heatView(w).state, 'hot');
    assert.equal(R.heatView(w).node.state, 'warm');
    // Camp waves and the boss have none.
    let c = tweak(atLevel(started('mage'), 60), (x) => { x.zone.z = C.ZONE_COUNT; x.hours = 400; });
    c = R.step(R.step(c, { type: 'LEAVE_HUB' }).state, { type: 'TRAVEL_ON' }).state;
    const wave = R.step(c, { type: 'CAMP_GRIND' });
    assert.equal(wave.state.fight.heat, null);
    assert.equal(ev(wave.events, 'fight')[0].heat, null);
    assert.equal(R.heatView(wave.state).state, 'scorched');
    assert.equal(R.heatView(wave.state).node, null);
    assert.equal(R.step(c, { type: 'FIGHT_BOSS' }).state.fight.heat, null);
  });

  test('XP and gold of the node × (1 + HEAT_GAIN[state]) after rested, Boon of Insight and meta; the events carry the extra as heat', () => {
    const prof = { ...R.newProfile(), unlocks: { prospector: 3, quick_study: 2 } };
    for (const opts of [{}, { rested: 900 }, { profile: prof }, { seed: 9, L: 20 }]) {
      const base = winQuest('clear', opts);
      const warm = winQuest('warm', opts);
      assert.deepEqual(amounts(warm.events, 'xp'), amounts(base.events, 'xp'), 'Warm pays nothing');
      assert.deepEqual(amounts(warm.events, 'gold'), amounts(base.events, 'gold'));
      for (const st of ['hot', 'scorched']) {
        const g = C.HEAT_GAIN[st];
        const r = winQuest(st, opts);
        for (const t of ['xp', 'gold']) {
          const want = amounts(base.events, t).map(([why, a]) => [why, Math.round(a * (1 + g) + 1e-9), Math.round(a * (1 + g) + 1e-9) - a]);
          assert.deepEqual(amounts(r.events, t), want, `${st} ${t} ${JSON.stringify(opts)}`);
          assert.ok(want.length >= 2, 'kill and quest turn-in');
        }
        assert.equal(r.state.player.rested, base.state.player.rested, 'the rested pool pays only the doubling');
        assert.equal(r.state.stats.xpGained - base.state.stats.xpGained, ev(r.events, 'xp').reduce((n, e) => n + e.heat, 0));
      }
    }
  });

  test('treasure gold, grind waves and the dungeon clear pay by the entry state too; selling does not', () => {
    // Grind wave bonus and kill: a grind fight in a Hot node.
    for (const kind of ['grind', 'dboss']) {
      const run = (heat) => {
        let s = withSpells(atLevel(started('rogue', { seed: 4 }), 12), []);
        s = inFight(s, [mob(12, kind === 'dboss' ? 'z1_dboss' : 'z1_brute')].map((m) => (kind === 'dboss' ? { ...m, variant: 'dboss' } : m)), { kind }).state;
        s = tweak(s, (x) => { x.node.heat = heat; x.node.k = kind === 'dboss' ? 99 : 0; const e = x.fight.enemies[0]; e.hp = 1; e.dodge = 0; e.shield = 0; });
        forceDraws(s, 3, (d) => d[0] > 0.6);
        return R.step(s, { type: 'ATTACK', target: 0 });
      };
      const a = run('clear');
      const b = run('hot');
      const whys = kind === 'grind' ? ['kill', 'wave'] : ['kill', 'dungeon'];
      for (const why of whys) {
        const x = ev(a.events, 'xp').find((e) => e.why === why);
        const y = ev(b.events, 'xp').find((e) => e.why === why);
        assert.ok(x && y, `${kind} ${why}`);
        assert.equal(y.amount, Math.round(x.amount * (1 + C.HEAT_GAIN.hot) + 1e-9), `${kind} ${why} XP`);
      }
      if (kind === 'dboss') {
        const x = ev(a.events, 'gold').find((e) => e.why === 'dungeon');
        const y = ev(b.events, 'gold').find((e) => e.why === 'dungeon');
        assert.equal(y.amount, Math.round(x.amount * (1 + C.HEAT_GAIN.hot) + 1e-9), 'dungeon clear gold');
      }
    }
    // Treasure: an unguarded chest entered Scorched.
    let s = R.step(started('hunter', { seed: 6 }), { type: 'LEAVE_HUB' }).state;
    s = tweak(s, (x) => { const n = x.zone.rows[0][0]; n.type = 'treasure'; n.guard = null; n.trap = false; });
    const chest = (hours) => ev(R.step(tweak(s, (x) => { x.hours = hours; }), { type: 'CHOOSE_NODE', lane: 0 }).events, 'gold').find((e) => e.why === 'treasure');
    assert.equal(chest(60).amount, Math.round(chest(0).amount * (1 + C.HEAT_GAIN.scorched) + 1e-9));
    // Selling in a vendor node entered Scorched: raw value, no heat.
    let v = tweak(s, (x) => { const n = x.zone.rows[0][1]; n.type = 'vendor'; n.stock = vendorStock(x, makeRng(3), n.cl); x.hours = 60; });
    v = R.step(v, { type: 'CHOOSE_NODE', lane: 1 }).state;
    assert.equal(v.node.heat, 'scorched');
    const junk = { uid: 'jk', kind: 'junk', name: 'J', level: 5, qty: 2 };
    v = tweak(v, (x) => { x.player.bag.push(junk); });
    const sold = R.step(v, { type: 'SELL', itemId: 'jk' });
    assert.equal(ev(sold.events, 'gold')[0].heat, undefined);
    assert.equal(ev(sold.events, 'gold')[0].amount, 2 * Math.round(C.JUNK_V * R.V(5) + 1e-9));
  });

  test('not paid: Camp waves, the boss and Dimmed encounters, whatever the meter shows', () => {
    let c = tweak(atLevel(started('mage', { seed: 3 }), 59), (x) => { x.zone.z = C.ZONE_COUNT; x.hours = 400; });
    c = R.step(R.step(c, { type: 'LEAVE_HUB' }).state, { type: 'TRAVEL_ON' }).state;
    let w = R.step(c, { type: 'CAMP_GRIND' }).state;
    w = tweak(w, (x) => { for (const e of x.fight.enemies) { e.hp = 1; e.dodge = 0; } });
    const all = [];
    for (let i = 0; w.fight && i < 40; i++) { const r = R.step(w, R.autoAction(w)); all.push(...r.events); w = r.state; }
    assert.ok(ev(all, 'xp').length > 0 && ev(all, 'xp').every((e) => !e.heat), 'Camp wave XP');
    assert.ok(ev(all, 'gold').every((e) => !e.heat), 'Camp wave gold');
    // A Dimmed encounter: the player's node is Dimmed (the meter is Scorched), the kills pay no heat.
    let s = onMap(atLevel(expRun('mage', { seed: 9 }), 12));
    const target = s.zone.nodes[0].nb[0];
    s = tweak(s, (x) => { x.hours = x.zone.start + dimAt(x.zone, target) + 1; });
    let d = R.step(s, { type: 'MOVE', nodeId: target }).state;
    assert.equal(d.node.type, 'dim');
    assert.equal(d.node.heat, undefined);
    assert.equal(d.fight.heat, null);
    assert.equal(R.heatView(d).state, 'scorched');
    d = tweak(d, (x) => { for (const e of x.fight.enemies) { e.hp = 1; e.dodge = 0; } });
    const dim = [];
    for (let i = 0; d.fight && i < 40; i++) { const r = R.step(d, R.autoAction(d)); dim.push(...r.events); d = r.state; }
    assert.ok(ev(dim, 'xp').length > 0 && ev(dim, 'xp').every((e) => !e.heat));
  });
});

describe('rules 8.4 the heat step on drops', () => {
  const roll = (heat, table, level, g) => {
    const s = tweak(started('rogue'), (x) => { x.node = heat ? { type: 'quest', r: 1, l: 0, cl: level, heat } : null; });
    return rollDrop(s, g, table, level, 1);
  };
  test('one draw right after the rarity draw, in every state: below HEAT_RARITY_UP one rarity step up, epic stays; the stream does not depend on heat', () => {
    const tables = ['mob', 'trash', 'elite', 'rare', 'dboss', 'quest', 'story', 'treasure'];
    let ups = 0;
    let n = 0;
    for (const table of tables) {
      const T = C.DROP_TABLE[table];
      for (let i = 0; i < 400; i++) {
        const g0 = makeRng(1000 * tables.indexOf(table) + i);
        const [item, , rar, step] = peek(g0, 4);
        const outs = {};
        const after = {};
        for (const heat of [null, 'clear', 'warm', 'hot', 'scorched']) {
          const g = g0.slice();
          outs[heat] = roll(heat, table, 20, g).filter((x) => x.kind === 'gear');
          after[heat] = g;
        }
        for (const heat of ['clear', 'warm', 'hot', 'scorched']) assert.deepEqual(after[heat], after[null], 'same draws in every state');
        if (!(item < Math.min(1, T.item))) { assert.equal(outs.hot.length, 0); continue; }
        const tot = T.weights.reduce((a, b) => a + b, 0);
        let acc = 0;
        let base = -1;
        for (let k = 0; k < T.weights.length; k++) { acc += T.weights[k]; if (rar * tot < acc && T.weights[k] > 0) { base = k; break; } }
        for (const heat of ['clear', 'warm', 'hot', 'scorched']) {
          const up = step < C.HEAT_RARITY_UP[heat];
          const want = C.RARITY_ORDER[Math.min(3, base + (up ? 1 : 0))];
          assert.equal(outs[heat][0].rarity, want, `${table} ${heat}`);
          assert.equal(outs[heat][0].slot, outs[null][0].slot, 'the slot draw follows the heat step');
        }
        assert.equal(outs.clear[0].rarity, C.RARITY_ORDER[base], 'Clear: the table rarity');
        if (step < C.HEAT_RARITY_UP.hot) ups++;
        n++;
      }
    }
    assert.ok(Math.abs(ups / n - C.HEAT_RARITY_UP.hot) < 0.04, `step share ${ups / n}`);
    // M2b v6 (D62): about 1 in 2 items rolled in a Hot node and 7 in 10 in a Scorched one go one rarity up
    assert.ok(Math.abs(ups / n - 0.5) < 0.04, `Hot step share ${ups / n}, spec 0.50`);
    // With Cache of the Wanderer and Relics of the Deep the unique draw is made for every elite, rare, treasure and
    // dungeon boss drop, whatever the rarity: the draws still match across states (a stepped-up rare may become the unique).
    const uq = { ...R.newProfile(), unlocks: { cache: 1, relics: 1 } };
    for (const table of ['elite', 'treasure', 'dboss', 'mob']) {
      for (let i = 0; i < 200; i++) {
        const after = [];
        for (const heat of ['clear', 'scorched']) {
          const s = tweak(started('rogue', { profile: uq }), (x) => { x.node = { type: 'elite', r: 1, l: 0, cl: 20, heat }; });
          const g = makeRng(5000 + i);
          rollDrop(s, g, table, 20, 1);
          after.push(g);
        }
        assert.deepEqual(after[0], after[1], `${table}: same draws with the unique unlocks`);
      }
    }
    // Epic stays epic: a dungeon boss's epic in a Scorched node.
    let epics = 0;
    for (let i = 0; i < 300; i++) for (const it of roll('scorched', 'dboss', 30, makeRng(i))) { assert.ok(['rare', 'epic'].includes(it.rarity)); if (it.rarity === 'epic') epics++; }
    assert.ok(epics > 0);
  });

  test('in a node: kill drops, treasure and quest reward choices step up by the entry state; vendor stock never does', () => {
    // Quest reward choices of a Scorched quest node against a Clear one (same seed, same draws).
    const a = winQuest('clear', { seed: 21 });
    const b = winQuest('scorched', { seed: 21 });
    const ra = a.state.node.rewards[0].items.map((x) => x.rarity);
    const rb = b.state.node.rewards[0].items.map((x) => x.rarity);
    assert.equal(ra.length, rb.length);
    ra.forEach((r, i) => assert.ok(C.RARITY_ORDER.indexOf(rb[i]) - C.RARITY_ORDER.indexOf(r) <= 1 && C.RARITY_ORDER.indexOf(rb[i]) >= C.RARITY_ORDER.indexOf(r)));
    assert.deepEqual(a.state.node.rewards[0].items.map((x) => x.slot), b.state.node.rewards[0].items.map((x) => x.slot));
    // Vendor stock: the same items whatever the state the vendor node is entered in.
    const st = (heat) => vendorStock(tweak(started('mage'), (x) => { x.node = heat ? { type: 'vendor', r: 1, l: 0, cl: 20, heat } : null; }), makeRng(8), 20);
    assert.deepEqual(st('scorched'), st(null));
  });
});

describe('rules 11.1 and 1.7.4 the Echo line and the summary block', () => {
  test('Echo line heat: ECHO_PER_HEAT_FIGHT per fight won in a node entered Hot or Scorched; fled fights and Clear or Warm nodes give none', () => {
    const facts = { level: 1, zonesLeft: 0, dungeons: 0, kills: { elite: 0, rare: 0 }, quests: 0, reachedBoss: false, outcome: 'death', oaths: [], heatFights: 7 };
    const e = echoes(facts, R.newProfile());
    assert.deepEqual(e.lines.find((l) => l.id === 'heat'), { id: 'heat', count: 7, each: C.ECHO_PER_HEAT_FIGHT, echoes: 7 * C.ECHO_PER_HEAT_FIGHT });
    assert.equal(echoes({ ...facts, heatFights: 0 }, null).lines.length, 0);
    for (const [heat, won] of [['clear', 0], ['warm', 0], ['hot', 1], ['scorched', 1]]) {
      const r = winQuest(heat);
      const sum = R.summary(r.state);
      assert.equal(sum.heat.fightsByState[C.HEAT_STATES.indexOf(heat)], 1);
      assert.equal((sum.echoes.lines.find((l) => l.id === 'heat') || { count: 0 }).count, won);
      assert.equal(sum.heat.echoHeat, won * C.ECHO_PER_HEAT_FIGHT);
    }
    // A fled fight in a Hot node is not won.
    let s = withSpells(atLevel(started('rogue', { seed: 5 }), 10), []);
    s = tweak(inFight(s, [mob(10)], { kind: 'quest' }).state, (x) => { x.node.heat = 'hot'; x.fight.heat = 'hot'; });
    forceDraws(s, 1, (d) => d[0] < 0.01);
    const fled = R.step(s, { type: 'FLEE' });
    assert.equal(ev(fled.events, 'fled').length, 1);
    assert.deepEqual(R.summary(fled.state).heat.fightsByState, [0, 0, 0, 0]);
  });

  test('summary heat block: trackPerZone (line, entry, exit), hoursByState adds up to the hours, nodesByState to the nodes, fightsByState', () => {
    // Hours by the state each hour starts in: a 2 h quest entered at heat -1 is 1 h Clear and 1 h Warm.
    let s = R.step(started('rogue', { seed: 2 }), { type: 'LEAVE_HUB' }).state;
    const lane = R.mapView(s).next.find((l) => s.zone.rows[0][l].type === 'quest');
    const q = R.step(tweak(s, (x) => { x.hours = 19; x.stats.heat.hoursByState = [19, 0, 0, 0]; }), { type: 'CHOOSE_NODE', lane }).state;
    assert.deepEqual(R.summary(q).heat.hoursByState, [20, 1, 0, 0]);
    assert.deepEqual(R.summary(q).heat.nodesByState, [1, 0, 0, 0]);
    for (const [mapMode, seed, cls, content] of [['rows', 1, 'hunter', CONTENT], ['rows', 3, 'mage', REAL], ['expedition', 5, 'hunter', CONTENT], ['expedition', 1, 'mage', REAL]]) {
      let r = R.step(R.newRun({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, content, mapMode }), { type: 'START_RUN' }).state;
      let won = 0;
      for (let n = 0; r.phase !== 'SUMMARY' && n < 20000; n++) {
        const st = R.step(r, R.autoAction(r));
        won += ev(st.events, 'victory').filter((e) => !['camp', 'boss', 'dim'].includes(e.kind)).length;
        r = st.state;
      }
      const sm = R.summary(r);
      const h = sm.heat;
      assert.equal(h.hoursByState.reduce((a, b) => a + b, 0), sm.hours, `${mapMode} ${seed}: hours`);
      assert.equal(h.nodesByState.reduce((a, b) => a + b, 0), sm.nodes.total, 'nodes');
      assert.equal(h.fightsByState.reduce((a, b) => a + b, 0), won, 'fights won in map nodes');
      assert.equal(h.trackPerZone[0].entry, 0);
      h.trackPerZone.forEach((z, i) => {
        assert.equal(z.line, lineAt(r.oaths, z.z));
        if (i > 0) assert.equal(z.entry, h.trackPerZone[i - 1].exit, 'a zone is entered when the last is left');
        assert.ok(z.exit >= z.entry);
      });
      assert.equal(h.trackPerZone[h.trackPerZone.length - 1].exit, sm.hours);
      assert.equal(h.trackPerZone.length, sm.reached.zone + (sm.reached.camp ? 1 : 0));
    }
  });
});

describe('rules 1.9.10 heat rewards in an expedition zone', () => {
  test('a node entered at the Dimming\'s edge (dimIn <= HEAT_DIM_HOT_H) pays as Hot', () => {
    let s = onMap(atLevel(expRun('mage', { seed: 14 }), 6));
    const id = s.zone.nodes[0].nb.find((x) => s.zone.nodes[x].type === 'quest') ?? s.zone.nodes[0].nb[0];
    for (const [left, want] of [[2, 'hot'], [1, 'hot'], [3, 'warm'], [9, 'clear']]) {
      const t0 = tweak(s, (x) => { x.hours = x.zone.start + dimAt(x.zone, id) - left; });
      assert.equal(R.heatView(t0).stateRun, 'clear');
      assert.equal(R.heatPreview(t0, { type: 'MOVE', nodeId: id }).pays, want);
      const r = R.step(t0, { type: 'MOVE', nodeId: id });
      assert.equal(r.state.node.heat, want, `${left} h before the node dims`);
      assert.equal(ev(r.events, 'node')[0].heat, want);
    }
  });
});
