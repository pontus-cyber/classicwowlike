// Blind Legacy v2 2026-11-20, heat state (BACKLOG 2026-11-20; docs/handoffs/engine-2026-11-20b.md), the UI's pure parts
// in Node: the Furnace's line, its lit segment and its markers come from one reading of the bridge's heatView
// (heat.js meterReading), the marker of the clock that sets the state lies in the segment the line names, and the run
// summary's tolls by state are the engine's and count each walk's or pass's toll in the state the meter showed before it.
// Whole runs through the bridge on autoplay, Legacy on (?legacy=1) and off. The browser check is ui-regress part I.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem0 = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem0.has(k) ? mem0.get(k) : null), setItem: (k, v) => { mem0.set(k, String(v)); }, removeItem: (k) => { mem0.delete(k); } };
const R = await import('../../src/rules.js');
const C = R.C;
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { meterReading, segmentAt, standText, meterText, HEAT_NAME } = await import('../../src/ui/heat.js');

const KEYS = ['tbwcr.profile.v1', 'tbwcr.profile.v3', 'tbwcr.history.v1', 'tbwcr.history.v3', 'tbwcr.legacy.refund.v1'];
const clear = () => { for (const k of KEYS) globalThis.localStorage.removeItem(k); };
const nodeOf = (b) => R.deserialize(b.backend.serialized(), CONTENT);

/**
 * A Hunter's bridge run on autoplay to its end; fn(prevView, action, result, nextView, eng, bridge) per step, eng: the same
 * engine action on a Node twin of the run before it ({ before, state, events }: the engine's own events), or null.
 */
function bridgeRun(seed, legacy, fn) {
  const saved = { ...C.GATES };
  clear();
  // with the switch off, a profile's third run (a first run's Hunter at level 1 seldom leaves zone 1)
  if (!legacy) globalThis.localStorage.setItem('tbwcr.profile.v1', JSON.stringify({ ...R.newProfile(), runs: 2, guide: 'done', welcome: true }));
  try {
    const b = createBridge({ seed, legacy });
    b.dispatch({ type: 'SET_GUIDE', on: false });
    b.dispatch({ type: 'SELECT_CLASS', classId: 'hunter' });
    b.dispatch({ type: 'START_RUN' });
    for (let i = 0; i < 8000; i++) {
      const prev = b.view;
      const a = b.autoAction();
      if (a.type !== 'ENGINE') break;
      const before = prev.heat ? nodeOf(b) : null;
      const eng = before ? { before, ...R.step(before, a.action) } : null;
      const r = b.dispatch(a);
      if (!r.ok) break;
      if (eng) assert.equal(nodeOf(b).time, eng.state.time, 'the twin keeps step');
      fn(prev, a, r, b.view, eng, b);
    }
    return b;
  } finally { Object.assign(C.GATES, saved); clear(); }
}

for (const [arm, legacy] of [['Legacy on', true], ['Legacy off', false]]) {
  test(`${arm}: the line, the lit segment and the setting marker agree on every view of a run (s0254-s0257, s0460-s0465)`, () => {
    let views = 0; let byDim = 0;
    for (const seed of [3, 7]) {
      bridgeRun(seed, legacy, (prev, a, r, v, eng, br) => {
        const hv = v.heat;
        if (!hv) return;
        const HH = br.data.rules.heat;
        const m = meterReading(hv, HH);
        views += 1;
        assert.equal(m.name, HEAT_NAME[hv.state]);
        assert.equal(m.lit, hv.state);
        assert.equal(m.line, meterText(hv));
        assert.equal(segmentAt(m.setter.x, HH), hv.state, `${arm} seed ${seed}: the setting marker at ${m.setter.x} in the ${hv.state} segment (by ${hv.by})`);
        assert.equal(m.run.x, hv.bar.marker);
        assert.equal(segmentAt(m.run.x, HH), hv.stateRun, 'the player\'s marker is the run clock');
        if (m.dim) assert.equal(segmentAt(m.dim.x, HH), hv.stateDim, 'the diamond is the Dimming clock');
        if (hv.by === 'dim') { byDim += 1; assert.ok(m.dim && m.dim.sets && !m.run.sets); } else { assert.ok(m.run.sets); assert.equal(m.line, standText(hv)); }
      });
    }
    assert.ok(views > 200 && byDim > 5, `${arm}: ${views} views, ${byDim} set by the Dimming`);
  });

  test(`${arm}: the summary's tolls by state are the engine's, and a walk's or pass's toll lands in the state the meter showed before it (s0561)`, () => {
    let steps = 0;
    let b = null;
    for (const seed of [1, 6]) b = bridgeRun(seed, legacy, (prev, a, r, v, eng) => {
      if (!eng || !eng.before.stats || !eng.before.stats.heat) return;
      const t = eng.events.find((e) => e.t === 'time');
      if (!t || (t.why !== 'walk' && t.why !== 'pass') || eng.events.filter((e) => e.t === 'time').length !== 1) return;
      const d = eng.state.stats.heat.timeByState.map((x, i) => x - eng.before.stats.heat.timeByState[i]);
      assert.deepEqual(d, C.HEAT_STATES.map((st) => (st === prev.heat.state ? 1 : 0)), `${arm} ${JSON.stringify(a)}: counted in ${prev.heat.state}`);
      steps += 1;
    });
    const sum = b.view.summary;
    assert.ok(sum && sum.heat, 'a summary with its heat block');
    const sm = R.summary(nodeOf(b));
    assert.deepEqual(sum.heat.timeByState, sm.heat.timeByState);
    assert.deepEqual(sum.heat.nodesByState, sm.heat.nodesByState);
    assert.equal(sum.heat.timeByState.reduce((x, y) => x + y, 0), sum.time);
    assert.ok(steps > 10, `${arm}: ${steps} walks and passes`);
  });
}
