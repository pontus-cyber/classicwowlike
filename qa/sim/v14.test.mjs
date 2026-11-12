// M2b v14 sim rows (docs/specs/changes-m2b-v14.md "What the sim must run"; report docs/reports/balance-2026-11-12b.md):
// a cell without gates plays the engine's C.GATES defaults (the game as built), a cell with gates plays the named switches
// on and every other off (as the v13 sim), and the cell name marks every switch played at another value than its default.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { C, GATE_DEFAULTS, gatesFor } from '../../sim/lib/engine.mjs';
import { setGates, runWithBot } from '../../sim/lib/runner.mjs';
import { cellName } from '../../sim/lib/output.mjs';

const KEYS = ['rareHpMultZ1', 'firstMeetWindup', 'sapHold', 'passStealth'];
const ALL = Object.fromEntries(KEYS.map((k) => [k, true]));

describe('C.GATES defaults of a cell (M2b v14)', () => {
  test('the defaults are the engine as built (D111, D113: every switch on)', () => {
    assert.deepEqual(GATE_DEFAULTS, ALL);
    assert.ok(Object.isFrozen(GATE_DEFAULTS));
  });

  test('gatesFor: no gates = the defaults; named gates = those on, every other off (each subset)', () => {
    assert.deepEqual(gatesFor(null), ALL);
    for (let m = 0; m < 1 << KEYS.length; m++) {
      const named = Object.fromEntries(KEYS.filter((_, i) => m & (1 << i)).map((k) => [k, true]));
      assert.deepEqual(gatesFor(named), Object.fromEntries(KEYS.map((k) => [k, !!named[k]])));
    }
  });

  test('a plain cell plays the defaults after a gated cell; it equals the cell that names every default switch', () => {
    for (const cell of [{ bot: 'planner', cls: 'rogue', prof: 'fresh', tree: 2 }, { bot: 'onebutton', cls: 'mage', prof: 'fresh', tree: 1, map: 'expedition', prep: true }]) {
      setGates({});
      const plain = runWithBot(cell, 1003, null, { hash: true }).record;
      assert.deepEqual(C.GATES, ALL);
      const named = runWithBot({ ...cell, gates: ALL }, 1003, null, { hash: true }).record;
      assert.equal(plain.err, null);
      assert.equal(plain.hash, named.hash, `${cell.bot} ${cell.map || 'classic'}`);
    }
    setGates(null);
  });

  test('the cell name marks every switch played at another value than its default', () => {
    const name = (gates) => cellName({ bot: 'planner', prof: 'fresh', ...(gates ? { gates } : {}) });
    assert.equal(name(null), 'planner-P0');
    assert.equal(name(ALL), 'planner-P0');
    assert.equal(name({ rareHpMultZ1: true, firstMeetWindup: true }), 'planner-P0-nosap-nopst');
    assert.equal(name({ rareHpMultZ1: true, firstMeetWindup: true, sapHold: true }), 'planner-P0-nopst');
    assert.equal(name({ rareHpMultZ1: true }), 'planner-P0-nog6-nosap-nopst');
    assert.equal(name({}), 'planner-P0-nog5-nog6-nosap-nopst');
  });
});
