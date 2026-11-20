// Blind Legacy v2 2026-11-20, heat state (docs/feedback/2026-11-20-blind-legacy-returning-v2.md "Wrong or confusing";
// BACKLOG 2026-11-20 "heat state"; docs/handoffs/engine-2026-11-20b.md): the Furnace's label, its markers and the run
// summary agree. The bug: a walk's or a pass's toll was counted in the summary's tolls by state (rules 1.7.4: "every toll
// spent counts in the state it starts in") on the Dimming clock of the node walked TO, so a step away from the dark that
// started in Smouldering counted Calm (about 4 in 10 walks and passes of a Legacy Hunter on autoplay landed in a state the
// meter never showed). Now it counts on the clock of the node walked from: the meter's reading when the toll starts. The
// rest is the rules working as written, pinned here: the meter's state is the hotter of the run clock and the player's
// node's Dimming clock (rules 1.9.10), a node's tolls dim at most DIM_MAX_PER_TOLL places each (1.9.6), and the tolls to
// spare on arrival in a zone are the line there less the run's tolls (1.7.1). Legacy on and off alike.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { cloneState } from '../../src/engine/util.js';
import { dimAt, dimmedAt, zoneTime } from '../../src/engine/expedition.js';
import { lineAt, hotter } from '../../src/engine/heat.js';

const C = R.C;
const ST = C.HEAT_STATES;
const LEGACY = { legacy: true, oruvathLegacy: true, economyV2: true };
const OFF = { legacy: false, oruvathLegacy: false, economyV2: false };
function gates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
const ARMS = [['Legacy on', LEGACY], ['Legacy off', OFF]];
const run0 = (seed, classId = 'hunter') => R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed, content: CONTENT });

/**
 * Every step of autoplay runs (Hunter, seeds 1..n) with what the meter showed before it (heatView), the step's preview
 * (heatPreview), its first `time` event and the summary's tolls by state before and after.
 */
function steps(n, fn) {
  for (let seed = 1; seed <= n; seed++) {
    let s = run0(seed);
    for (let i = 0; i < 20000 && s.phase !== 'SUMMARY' && s.phase !== 'ENDED'; i++) {
      const a = R.autoAction(s);
      if (!a) break;
      const hv = R.heatView(s);
      const pv = hv ? R.heatPreview(s, a) : null;
      const before = s.stats && s.stats.heat ? s.stats.heat.timeByState.slice() : null;
      const r = R.step(s, a);
      fn({ seed, s, a, hv, pv, before, r, t: r.state });
      s = r.state;
    }
  }
}

describe('heat state: the summary counts each toll in the state the meter showed when it started (rules 1.7.4)', () => {
  test('a pass from a Smouldering node to a Calm one counts Smouldering (was: Calm, the clock of the node walked to)', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      let found = 0;
      for (let seed = 1; seed <= 40 && found < 3; seed++) {
        let s = R.step(run0(seed), { type: 'START_RUN' }).state;
        if (s.phase === 'PREP') s = R.step(s, { type: 'SET_OUT' }).state;
        s = R.step(s, { type: 'LEAVE_HUB' }).state;
        const z = s.zone;
        const here = z.pos;
        const nb = z.nodes[here].nb.find((id) => dimAt(z, id) - dimAt(z, here) >= C.HEAT_DIM_WARM - 1 + 2);
        if (nb === undefined) continue;
        // put the zone clock 3 tolls before the player's node dims (Smouldering by the Dimming), the run well in hand
        const t = cloneState(s);
        const zt = dimAt(z, here) - 3;
        t.time = t.zone.start + zt;
        const hv = R.heatView(t);
        assert.ok(hv.heat < C.HEAT_WARM_AT, `${arm} ${seed}: the run clock is Calm (${hv.heat})`);
        assert.deepEqual([hv.state, hv.by, hv.stateRun, hv.dimIn], ['warm', 'dim', 'clear', 3], `${arm} ${seed}`);
        const p = R.heatPreview(t, { type: 'PASS_THROUGH', nodeId: nb });
        assert.equal(p.state, 'clear', `${arm} ${seed}: the node passed to is Calm after the step`);
        const before = t.stats.heat.timeByState.slice();
        const u = R.step(t, { type: 'PASS_THROUGH', nodeId: nb }).state;
        const d = u.stats.heat.timeByState.map((x, i) => x - before[i]);
        assert.deepEqual(d, [0, 1, 0, 0], `${arm} ${seed}: the pass's toll counts Smouldering, the meter's state when it started`);
        assert.equal(R.heatView(u).state, 'clear', `${arm} ${seed}: and the meter reads Calm after it`);
        found += 1;
      }
      assert.ok(found >= 1, `${arm}: a set-up found`);
    });
  });

  test('autoplay runs: every action\'s first toll counts in the meter\'s state before it (a node entered: the state it pays; the Road: the run clock)', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      const seen = {};
      steps(8, ({ seed, a, hv, pv, before, r, t }) => {
        const te = r.events.find((e) => e.t === 'time');
        if (!hv || !te || !before || !t.stats || !t.stats.heat) return;
        const d = t.stats.heat.timeByState.map((x, i) => x - before[i]);
        const want = te.why === 'travel' ? hv.stateRun : pv && pv.pays ? pv.pays : hv.state;
        const k = te.why === 'travel' ? 'road' : pv && pv.pays ? 'enter' : te.why;
        seen[k] = (seen[k] || 0) + 1;
        if (te.add === 1 && r.events.filter((e) => e.t === 'time').length === 1) assert.deepEqual(d, ST.map((x) => (x === want ? 1 : 0)), `${arm} seed ${seed} ${JSON.stringify(a)}: one toll, counted ${want}`);
        else assert.ok(d[ST.indexOf(want)] >= 1, `${arm} seed ${seed} ${JSON.stringify(a)}: first toll ${want}, got ${d}`);
      });
      for (const k of ['walk', 'pass', 'enter', 'road']) assert.ok(seen[k] > 5, `${arm}: ${k} steps checked (${JSON.stringify(seen)})`);
    });
  });

  test('the summary block adds up: tolls by state = the run\'s tolls; nodes by entry state = nodes entered; a node\'s entry state = its preview\'s `pays`', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      let checked = 0;
      steps(4, ({ a, pv, t, r }) => {
        const node = r.events.find((e) => e.t === 'node');
        if (node && pv && pv.pays) { assert.equal(node.heat, pv.pays, `${arm}: ${JSON.stringify(a)}`); checked += 1; }
        if (t.phase === 'SUMMARY') {
          const h = R.summary(t).heat;
          assert.equal(h.timeByState.reduce((x, y) => x + y, 0), t.time, arm);
          assert.equal(h.nodesByState.reduce((x, y) => x + y, 0), t.stats.nodesTotal, arm);
        }
      });
      assert.ok(checked > 20, `${arm}: ${checked} nodes entered`);
    });
  });
});

describe('heat state: the rules working as written (no change)', () => {
  test('the meter: state = the hotter of the run clock and the node\'s Dimming clock; the run marker = the heat; the setting clock\'s state is the state', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      let flips = 0; let byDim = 0;
      steps(6, ({ hv, t }) => {
        const w = R.heatView(t);
        if (!w) return;
        assert.equal(w.state, hotter(w.stateRun, w.stateDim), arm);
        assert.equal(w.bar.marker, Math.min(C.HEAT_BAR_MAX, Math.max(C.HEAT_BAR_MIN, w.heat)), arm);
        assert.equal(w.by === 'dim' ? w.stateDim : w.stateRun, w.state, arm);
        if (w.by === 'dim') byDim += 1;
        if (hv && hv.state !== w.state && w.z === hv.z && hv.stateRun === w.stateRun) flips += 1;
      });
      // the label changes with the Dimming clock alone (the run clock's state unchanged) after a step of a few tolls (s0254-s0257)
      assert.ok(flips > 10 && byDim > 10, `${arm}: ${flips} changes of state by the Dimming alone, ${byDim} views set by it`);
    });
  });

  test('the Dimming takes at most DIM_MAX_PER_TOLL places per toll spent: a Dungeon (EXPED_TIME_DUNGEON tolls) up to 10, a Quest up to 6 (s0453-s0551)', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      let dungeons = 0;
      steps(10, ({ s, r, t }) => {
        if (!s.zone || s.zone.camp || !t.zone || t.zone.z !== s.zone.z || t.zone.camp) return;
        if (!s.player || s.phase === 'PREP' || s.phase === 'CREATE') return;
        const cnt = (x) => x.zone.nodes.filter((n) => dimmedAt(x.zone, n.id, zoneTime(x))).length;
        const tolls = t.time - s.time;
        assert.ok(cnt(t) - cnt(s) <= C.DIM_MAX_PER_TOLL * Math.max(0, tolls), `${arm}: ${cnt(s)} -> ${cnt(t)} in ${tolls} tolls`);
        const nd = r.events.find((e) => e.t === 'node');
        if (nd && nd.type === 'dungeon') dungeons += 1;
      });
      assert.ok(dungeons >= 1, `${arm}: a dungeon entered`);
    });
    assert.equal(C.DIM_MAX_PER_TOLL * C.EXPED_TIME_DUNGEON, 10);
    assert.equal(C.DIM_MAX_PER_TOLL * C.EXPED_TIME_QUEST, 6);
  });

  test('tolls to spare on arrival in zone 2 = the line there less the run\'s tolls, by Road or by Bell (s0299, s0433: 18 and 30)', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      let n = 0;
      for (let seed = 1; seed <= 6; seed++) {
        for (const exit of ['TAKE_ROAD', 'RING_BELL']) {
          let s = run0(seed);
          for (let i = 0; i < 5000 && !(s.zone && s.zone.z === 2) && s.phase !== 'SUMMARY'; i++) {
            const a = R.autoAction(s);
            // leave by the Bell at the first chance in the zone's map (the earlier, the more tolls in hand)
            const bell = exit === 'RING_BELL' && s.phase === 'MAP' && s.zone && s.zone.z === 1 && R.isLegal(s, { type: 'RING_BELL' });
            s = R.step(s, bell ? { type: 'RING_BELL' } : a).state;
          }
          if (!(s.zone && s.zone.z === 2)) continue;
          const hv = R.heatView(s);
          assert.equal(-hv.heat, lineAt(s.oaths, 2) - s.time, `${arm} ${seed} ${exit}`);
          assert.equal(hv.carry.carried, s.time - lineAt(s.oaths, 1), `${arm} ${seed} ${exit}: what zone 1 carried`);
          assert.equal(hv.carry.share, lineAt(s.oaths, 2) - lineAt(s.oaths, 1));
          n += 1;
        }
      }
      assert.ok(n >= 8, `${arm}: ${n} arrivals`);
    });
  });
});
