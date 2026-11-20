// Heat readability (D163; docs/handoffs/engine-2026-11-20b.md recommendation 3; BACKLOG 2026-11-20 "Heat readability"): a
// pure read for the node tooltip, heatPreview `dims`: the places the Dimming takes while an action's tolls are spent. The
// blind tester saw 0 -> 10 -> 16 -> 24 of 31 places across one dungeon and two quests and could not tell a dungeon's cost in
// spread from the map (s0453-s0551). No rule changes: `dims` is the list of the nodes whose dimAt falls in the action's
// tolls, the same nodes the step's `dimming` events list. Legacy on and off alike.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { dimAt, zoneTime } from '../../src/engine/expedition.js';

const C = R.C;
const LEGACY = { legacy: true, oruvathLegacy: true, economyV2: true };
const OFF = { legacy: false, oruvathLegacy: false, economyV2: false };
function gates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
const ARMS = [['Legacy on', LEGACY], ['Legacy off', OFF]];
const run0 = (seed, opts = {}) => R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed, content: CONTENT, ...opts });

/** Every step of autoplay runs (Hunter, seeds 1..n) with its preview before it and the step's result. */
function steps(n, fn, opts = {}) {
  for (let seed = 1; seed <= n; seed++) {
    let s = run0(seed, opts);
    for (let i = 0; i < 20000 && s.phase !== 'SUMMARY' && s.phase !== 'ENDED'; i++) {
      const a = R.autoAction(s);
      if (!a) break;
      const pv = s.player && s.zone ? R.heatPreview(s, a) : null;
      const r = R.step(s, a);
      fn({ seed, s, a, pv, r });
      s = r.state;
    }
  }
}

describe('heatPreview dims: the places the Dimming takes while an action\'s tolls are spent (D163)', () => {
  test('every step of autoplay runs: dims lists exactly the nodes the step\'s dimming events list', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      let checked = 0; let entered = 0; let some = 0;
      steps(8, ({ seed, s, a, pv, r }) => {
        if (!pv || pv.dims === null) return;
        // a guided rescue moves the Dimming back; not met on autoplay outside the guided zone
        if (r.events.some((e) => e.t === 'dimBack' || e.t === 'rescue')) return;
        const got = r.events.filter((e) => e.t === 'dimming').flatMap((e) => e.dimmed);
        assert.deepEqual([...got].sort((x, y) => x - y), [...pv.dims].sort((x, y) => x - y), `${arm} seed ${seed} ${JSON.stringify(a)}: dims ${JSON.stringify(pv.dims)}, events ${JSON.stringify(got)}`);
        assert.ok(pv.dims.length <= C.DIM_MAX_PER_TOLL * pv.time || s.zone.hold, `${arm}: at most DIM_MAX_PER_TOLL a toll`);
        checked += 1;
        if (pv.pays) entered += 1;
        if (pv.dims.length) some += 1;
      });
      assert.ok(checked > 100 && entered > 20 && some > 20, `${arm}: ${checked} steps, ${entered} entering a node, ${some} with places taken`);
    });
  });

  test('ordered by the toll they dim at, then by id; none already Dimmed', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      let n = 0;
      steps(6, ({ s, pv }) => {
        if (!pv || !pv.dims || !pv.dims.length) return;
        const zt = zoneTime(s);
        const at = pv.dims.map((id) => dimAt(s.zone, id));
        assert.ok(at.every((x) => x > zt && x <= zt + pv.time), `${arm}: within (zt, zt + time]`);
        for (let i = 1; i < at.length; i++) assert.ok(at[i - 1] < at[i] || (at[i - 1] === at[i] && pv.dims[i - 1] < pv.dims[i]), `${arm}: order`);
        n += 1;
      });
      assert.ok(n > 10, `${arm}: ${n} previews with places taken`);
    });
  });

  test('null where no Dimming clock runs: leaving the zone (Road, Bell), the Camp, today\'s map, a run without the Dimming', () => {
    for (const [arm, set] of ARMS) gates(set, () => {
      let road = 0;
      steps(4, ({ a, pv }) => {
        if (!pv) return;
        if (a.type === 'TAKE_ROAD' || a.type === 'RING_BELL' || a.type === 'CAMP_GRIND' || a.type === 'TRAVEL_ON') { assert.equal(pv.dims, null, `${arm} ${a.type}`); road += 1; }
      });
      assert.ok(road > 0, `${arm}: Roads met`);
      steps(2, ({ pv }) => { if (pv) assert.equal(pv.dims, null, `${arm}: today's map`); }, { mapMode: 'rows' });
      steps(2, ({ pv }) => { if (pv) assert.equal(pv.dims, null, `${arm}: without the Dimming`); }, { dimming: false });
    });
  });

  test('a pure read: heatPreview with dims changes nothing and draws nothing; heatView.next carries it', () => {
    let s = R.step(run0(5), { type: 'START_RUN' }).state;
    if (s.phase === 'PREP') s = R.step(s, { type: 'SET_OUT' }).state;
    s = R.step(s, { type: 'LEAVE_HUB' }).state;
    const json = JSON.stringify(s);
    const hv = R.heatView(s);
    assert.ok(hv.next.length > 0);
    for (const x of hv.next) assert.deepEqual(x.dims, R.heatPreview(s, x.action).dims);
    assert.equal(JSON.stringify(s), json);
  });
});
