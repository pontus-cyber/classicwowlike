// rules.md 1.7.1-1.7.2 and 1.9.10 (heat): the line, the player's heat, the four states, the Dimming's clock in an
// expedition zone, projected Ascendancy, heatView and heatPreview (exact against the engine's own hours and states).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, tweak, atLevel } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { dimAt, zoneHours } from '../../src/engine/expedition.js';
import { lineAt, runState, dimState, ascOver, hotter } from '../../src/engine/heat.js';

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
    assert.deepEqual(C.HEAT_RARITY_UP, { clear: 0, warm: 0, hot: 0.25, scorched: 0.4 });
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
    for (const [mapMode, seed, content, cls] of [['rows', 1, CONTENT, 'hunter'], ['rows', 3, REAL, 'mage'], ['expedition', 7, CONTENT, 'hunter'], ['expedition', 12, REAL, 'rogue']]) {
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
