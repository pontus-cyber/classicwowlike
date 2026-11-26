// Heat readability (D163; docs/handoffs/engine-2026-11-20b.md recommendations 1-4; BACKLOG 2026-11-20 "Heat readability"),
// the UI's pure parts in Node: the clock tag on the Furnace's label, the line inside a node, the node tooltip's places taken
// by the Dimming and the toll carry-over on arrival in a zone. Every line is a draft for the owner. Whole bridge runs on
// autoplay, Legacy on and off. The browser checks are in ui-regress part I (expedition).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem0 = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem0.has(k) ? mem0.get(k) : null), setItem: (k, v) => { mem0.set(k, String(v)); }, removeItem: (k) => { mem0.delete(k); } };
const R = await import('../../src/rules.js');
const C = R.C;
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { meterReading, clockTag, countsLine, arrivalLine, atArrival, dimsLine, CLOCK_TAG, HEAT_NAME } = await import('../../src/ui/heat.js');

const KEYS = ['tbwcr.profile.v1', 'tbwcr.profile.v3', 'tbwcr.history.v1', 'tbwcr.history.v3', 'tbwcr.legacy.refund.v1'];
const clear = () => { for (const k of KEYS) globalThis.localStorage.removeItem(k); };

/** A Hunter's bridge run on autoplay to its end; fn(prevView, nextView, bridge) per step. */
function bridgeRun(seed, legacy, fn) {
  const saved = { ...C.GATES };
  clear();
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
      const r = b.dispatch(a);
      if (!r.ok) break;
      fn(prev, b.view, b);
    }
    return b;
  } finally { Object.assign(C.GATES, saved); clear(); }
}

test('the draft lines read as written', () => {
  assert.deepEqual(CLOCK_TAG, { run: 'Set by your tolls', dim: 'Set by this place' });
  // demo blind round 1 B (2026-11-26, draft): while the Dimming sets the state the meter's line says so; no tag
  assert.equal(clockTag({ by: 'dim', dimIn: 3, stateDim: 'warm' }), null);
  assert.deepEqual(clockTag({ by: 'run', dimIn: 9, stateDim: 'clear' }), { by: 'run', glyph: '▼', text: 'Set by your tolls' });
  assert.equal(clockTag({ by: 'run', dimIn: null, stateDim: null }), null, 'one clock only (today\'s map, the Camp): no tag');
  assert.equal(countsLine({ node: { state: 'clear' }, state: 'clear' }), 'This place counts as Calm');
  // demo blind round 1 B (draft): a hotter meter than the place's state says why; only inside a place, not at a hub service
  assert.equal(countsLine({ node: { state: 'clear' }, state: 'warm' }), 'Entered while Calm: this place still counts as Calm');
  assert.equal(countsLine({ node: { state: 'warm' }, state: 'warm' }, { phase: 'NODE', node: { type: 'quest' } }), 'This place counts as Smouldering');
  assert.equal(countsLine({ node: { state: 'clear' }, state: 'clear' }, { phase: 'ZONE_HUB', node: { type: 'vendor', origin: 'hub' } }), '');
  assert.equal(countsLine({ node: { state: 'clear' }, state: 'clear' }, { phase: 'MAP', node: null }), '');
  assert.equal(countsLine({ node: null }), '');
  const hv = (carried, share = 20, z = 2) => ({ z, heat: carried - share, carry: { cumulative: true, carried, share } });
  assert.equal(arrivalLine(hv(-10)), 'Zone 2 gives you 20 tolls, plus the 10 you saved: 30 to spare.');
  assert.equal(arrivalLine(hv(5)), 'Zone 2 gives you 20 tolls, less the 5 you overspent: 15 to spare.');
  assert.equal(arrivalLine(hv(20)), 'Zone 2 gives you 20 tolls, less the 20 you overspent: none to spare.');
  assert.equal(arrivalLine(hv(25, 20, 3)), 'Zone 3 gives you 20 tolls, less the 25 you overspent: still 5 overspent.');
  assert.equal(arrivalLine(hv(0)), 'Zone 2 gives you 20 tolls: 20 to spare.');
  assert.equal(arrivalLine(hv(0, 20, 1)), '', 'zone 1: nothing carried');
  assert.equal(arrivalLine(hv(-3, 0, 7)), '', 'the Camp: no share');
  assert.equal(atArrival(hv(-10)), true);
  assert.equal(atArrival({ ...hv(-10), heat: -29 }), false, 'a toll spent since arriving');
  assert.equal(dimsLine({ pays: 'clear', dims: [4, 9, 11] }), 'The Dimming takes 3 places while you are inside.');
  assert.equal(dimsLine({ pays: 'warm', dims: [4] }), 'The Dimming takes 1 place while you are inside.');
  assert.equal(dimsLine({ pays: 'clear', dims: [] }), '', 'none taken: no line');
  assert.equal(dimsLine({ pays: null, dims: [4] }), '', 'a walk or a pass: no line');
  assert.equal(dimsLine({ pays: 'clear', dims: [4], perWave: true }), '', 'a Grind whose waves are chosen inside');
  assert.equal(dimsLine({ pays: 'clear', dims: null }), '');
});

for (const [arm, legacy] of [['Legacy on', true], ['Legacy off', false]]) {
  test(`${arm}: on every view the tag names the clock that sets the state, and inside a node the line names its entry state`, () => {
    let views = 0; let tags = { run: 0, dim: 0 }; let inNode = 0; let differs = 0;
    for (const seed of [3, 7]) {
      bridgeRun(seed, legacy, (prev, v, br) => {
        const hv = v.heat; if (!hv) return;
        const m = meterReading(hv, br.data.rules.heat, v);
        views += 1;
        if (hv.dimIn === null || hv.dimIn === undefined) assert.equal(m.clock, null);
        else if (hv.by === 'dim') { assert.equal(m.clock, null); assert.match(m.line, /Dimming/); assert.equal(m.setter.sets, true); tags.dim += 1; } // demo blind round 1 B: the line names it
        else { assert.equal(m.clock.by, hv.by); assert.equal(m.clock.text, CLOCK_TAG[hv.by]); assert.equal(m.setter.sets, true); tags[hv.by] += 1; }
        const inside = v.phase === 'NODE' && v.node && v.node.origin !== 'hub' && v.node.origin !== 'camp';
        if (hv.node && inside) {
          inNode += 1;
          const was = HEAT_NAME[hv.node.state];
          // demo blind round 1 B (draft): a meter in another state says why the place still counts as its entry state
          assert.equal(m.counts, hv.node.state !== hv.state ? `Entered while ${was}: this place still counts as ${was}` : `This place counts as ${was}`);
          if (hv.node.state !== hv.state) differs += 1;
        } else assert.equal(m.counts, '');
      });
    }
    assert.ok(views > 200 && tags.run > 50 && tags.dim > 5 && inNode > 50 && differs > 0, `${arm}: ${views} views, tags ${JSON.stringify(tags)}, ${inNode} in a node (${differs} counting another state than the meter's)`);
  });

  test(`${arm}: on arrival in zone 2 or later the carry-over line's figure is the meter's, and a node tooltip's places are the engine's`, () => {
    let arrivals = 0; let tips = 0;
    // a Hunter on autoplay often ends in zone 1: seeds until two runs have arrived in a later zone
    for (let seed = 1; seed <= 16 && arrivals < 2; seed++) {
      // the step that arrives in a zone after zone 1 (heatView.z changes; on autoplay the bridge may keep a quest's reward
      // view on screen, so the view's phase is not used)
      bridgeRun(seed, legacy, (prev, v) => {
        const hv = v.heat; if (!hv) return;
        if (prev.heat && prev.heat.z !== hv.z && hv.z > 1 && hv.carry.share > 0) {
          assert.ok(atArrival(hv), `${arm}: the meter reads the arrival figure`);
          const line = arrivalLine(hv);
          const left = hv.carry.carried - hv.carry.share;
          assert.match(line, new RegExp(`^Zone ${hv.z} gives you ${hv.carry.share} tolls`));
          assert.ok(line.endsWith(left < 0 ? `${-left} to spare.` : left === 0 ? 'none to spare.' : `still ${left} overspent.`), line);
          assert.equal(hv.heat, left);
          arrivals += 1;
        }
        for (const p of hv.list || []) {
          if (p.action.type !== 'MOVE' || !p.pays || !p.dims || !p.dims.length || p.perWave) continue;
          assert.equal(dimsLine(p), `The Dimming takes ${p.dims.length} ${p.dims.length === 1 ? 'place' : 'places'} while you are inside.`);
          tips += 1;
        }
      });
    }
    assert.ok(arrivals >= 2 && tips > 10, `${arm}: ${arrivals} arrivals, ${tips} node previews with places taken`);
  });
}
