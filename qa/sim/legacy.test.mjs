// D154-D155 (docs/specs/legacy.md 5.7-5.8, phase 1): the simulator's hero cells on the engine's Legacy switch. The profile
// `later` (two runs played, nothing bought); a hero cell (cell.hero, C.GATES.legacy among its gates: sim/run.mjs --hero) plays
// the class's hero at that level on the version 3 profile; the bots have no zone exit level and no Camp grind in a Legacy
// run (5.8 items 1 and 4); the cell marks 'leg' and 'h<H>'; a plain cell after a hero cell plays the defaults again.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, GATE_DEFAULTS } from '../../sim/lib/engine.mjs';
import { buildProfile, profileLabel, FIXED_PROFILE_RUNS } from '../../sim/lib/profiles.mjs';
import { cellName, GATE_TAG } from '../../sim/lib/output.mjs';
import { runWithBot, setGates, cellProfile } from '../../sim/lib/runner.mjs';
import { expExitLevel } from '../../sim/bots/planner.mjs';

after(() => setGates(null));
const LEG = { ...Object.fromEntries(Object.entries(GATE_DEFAULTS).filter(([, on]) => on)), legacy: true };

describe('Legacy hero cells (legacy.md 5.7-5.8)', () => {
  test('profile later: FIXED_PROFILE_RUNS runs, nothing bought, label PL; the switch is off by default (tag leg)', () => {
    const p = buildProfile('later', 'mage');
    assert.deepEqual([p.runs, p.unlocks, p.welcome, profileLabel('later')], [FIXED_PROFILE_RUNS, {}, true, 'PL']);
    assert.deepEqual([GATE_DEFAULTS.legacy, GATE_TAG.legacy], [false, 'leg']);
  });

  test('cellProfile: a hero cell gets the version 3 profile with the class hero at its level; without the switch it is refused', () => {
    setGates(LEG);
    const p = cellProfile({ bot: 'planner', cls: 'hunter', prof: 'later', hero: 12 });
    assert.equal(p.v, 3);
    assert.deepEqual([p.heroes.hunter.level, p.heroes.hunter.xp, p.runs], [12, 0, FIXED_PROFILE_RUNS]);
    setGates(null);
    assert.throws(() => cellProfile({ bot: 'planner', cls: 'hunter', prof: 'later', hero: 12 }), /legacy/);
    assert.equal(cellProfile({ bot: 'planner', cls: 'hunter', prof: 'later' }).v, 1);
  });

  test('no zone exit level in a Legacy run (the planner leaves by value); the cell name marks leg and the hero level', () => {
    setGates(null);
    assert.equal(expExitLevel(3), 30);
    setGates(LEG);
    assert.equal(expExitLevel(3), 0);
    setGates(null);
    assert.equal(cellName({ bot: 'planner', prof: 'later', cls: 'rogue', map: 'expedition', prep: true, gates: LEG, hero: 10 }), 'planner-PL-exp-prep-leg-h10');
  });

  test('a planner hero cell plays a Legacy run to its end: no error, the hero at its level, no Camp grind; a plain cell after it plays the defaults', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const { record, state } = runWithBot({ bot: 'planner', cls, prof: 'later', tree: null, map: 'expedition', prep: true, gates: LEG, hero: 10 }, 1000, null);
      assert.equal(record.err, null, cls);
      assert.equal(state.legacy, true);
      assert.equal(state.result.summary.hero.start.level, 10);
      assert.ok(state.result.summary.hero.level >= 10);
      assert.equal(state.stats.campWaves, 0);
      assert.equal(state.result.profile.heroes[cls].runs, 1);
    }
    const plain = runWithBot({ bot: 'planner', cls: 'mage', prof: 'fresh', tree: null, map: 'expedition', prep: true }, 1000, null);
    assert.equal(plain.record.err, null);
    assert.equal(C.GATES.legacy, false);
    assert.equal(plain.state.legacy, undefined);
    assert.equal(plain.state.profile.v, 1);
  });
});
