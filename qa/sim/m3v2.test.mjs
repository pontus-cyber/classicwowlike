// D152 (docs/specs/changes-m3-v2.md 5, M3 v2): the simulator side of the change. The fixed profiles PN (N >= 1) and PALL
// have played FIXED_PROFILE_RUNS runs (P0 stays a profile's first run, the lean one); the five new C.GATES switches have cell
// tags; the guided harness rule (sim/lib/runner.mjs followsGuide): on the guided zone's map, with the Roads closed and
// Gorrak's node open, a guided cell plays autoplay's action, so the bots follow the coach line to him.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, newRunFor, GATE_DEFAULTS } from '../../sim/lib/engine.mjs';
import { buildProfile, FIXED_PROFILE_RUNS } from '../../sim/lib/profiles.mjs';
import { cellName, GATE_TAG } from '../../sim/lib/output.mjs';
import { followsGuide, runWithBot, setGates } from '../../sim/lib/runner.mjs';

const D152 = ['firstRunLean', 'gorrakBounty', 'guidedHold', 'steadyDim', 'rescueDim'];
after(() => setGates(null));

describe('D152 simulator: profiles, cell tags, the guided harness', () => {
  test('P0 is a first run (runs 0); P1, P10 and PALL have played FIXED_PROFILE_RUNS (2) runs', () => {
    assert.equal(FIXED_PROFILE_RUNS, 2);
    for (const cls of ['rogue', 'mage', 'hunter']) {
      assert.deepEqual(['fresh', 'p0', 'p1', 'p10', 'all'].map((n) => buildProfile(n, cls).runs), [0, 0, 2, 2, 2], cls);
    }
  });

  test('the five switches: on by default, tags frl gb gh sd rd; a cell that plays them off is named no<tag>', () => {
    assert.deepEqual(D152.map((k) => GATE_DEFAULTS[k]), [true, true, true, true, true]);
    assert.deepEqual(D152.map((k) => GATE_TAG[k]), ['frl', 'gb', 'gh', 'sd', 'rd']);
    const gates = Object.fromEntries(Object.keys(GATE_DEFAULTS).filter((k) => GATE_DEFAULTS[k] && !D152.includes(k)).map((k) => [k, true]));
    const name = cellName({ bot: 'planner', prof: 'fresh', cls: 'mage', map: 'expedition', prep: true, guided: true, gates });
    assert.equal(name, 'planner-P0-exp-prep-nofrl-nogb-nogh-nosd-nord-guided');
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', cls: 'mage', map: 'expedition', prep: true, gates: { ...gates, steadyDim: true } }), 'planner-P0-exp-prep-nofrl-nogb-nogh-nord');
  });

  test('followsGuide: false while Gorrak is barred, true once his node is open (the Roads closed), false after his fight (the Roads open) and outside the guided zone', () => {
    setGates(null);
    const s = newRunFor({ classId: 'mage', seed: 3, profile: buildProfile('fresh', 'mage'), mapMode: 'expedition', prep: true, tutorial: true });
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) R.stepInPlace(s, a);
    assert.equal(s.phase, 'MAP');
    assert.equal(followsGuide(s), false, 'barred');
    s.tutorial.fights = C.ONB_ELITE_FIGHTS;
    R.stepInPlace(s, { type: 'SET_AUTOPLAY', on: false });
    assert.equal(R.tutorialView(s).elite.barred, false);
    assert.equal(followsGuide(s), true, 'open, the Roads closed');
    s.tutorial.elite = 'victory';
    R.stepInPlace(s, { type: 'SET_AUTOPLAY', on: false });
    assert.equal(R.tutorialView(s).roads.closed, false);
    assert.equal(followsGuide(s), false, 'the Roads open');
    const plain = newRunFor({ classId: 'mage', seed: 3, profile: buildProfile('fresh', 'mage'), mapMode: 'expedition', prep: true });
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) R.stepInPlace(plain, a);
    assert.equal(followsGuide(plain), false, 'no guide');
  });

  test('a guided planner run per class (P0, the prior tables): the harness takes over, Gorrak is fought, the run ends without error', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const cell = { bot: 'planner', prof: 'fresh', cls, map: 'expedition', prep: true, guided: true };
      const { record, state } = runWithBot(cell, 1000, null, {});
      assert.equal(record.err, null, cls);
      assert.equal(state.phase, 'ENDED', cls);
      assert.ok(['victory', 'fled', 'rescue'].includes(state.tutorial.elite), `${cls}: Gorrak ${state.tutorial.elite}`);
      assert.ok(record.gfb > 0, `${cls}: harness actions ${record.gfb}`);
    }
  });
});
