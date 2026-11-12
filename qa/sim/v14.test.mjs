// M2b v14 sim rows (docs/specs/changes-m2b-v14.md "What the sim must run"; report docs/reports/balance-2026-11-12b.md):
// a cell without gates plays the engine's C.GATES defaults (the game as built), a cell with gates plays the named switches
// on and every other off (as the v13 sim), and the cell name marks every switch played at another value than its default.
// M2b v15: the switch list and defaults come from the engine (GATE_DEFAULTS), not a fixed list.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { C, GATE_DEFAULTS, gatesFor } from '../../sim/lib/engine.mjs';
import { setGates, runWithBot } from '../../sim/lib/runner.mjs';
import { cellName, GATE_TAG } from '../../sim/lib/output.mjs';

// M2b v15: the switches and their defaults are read from the engine (C.GATES as built), not from a fixed list, so a new
// switch (v15: swiftRoad on, mawgrimHp off) keeps these checks valid. ALL: every switch that is on by default, named.
const KEYS = Object.keys(GATE_DEFAULTS);
const ALL = Object.fromEntries(KEYS.filter((k) => GATE_DEFAULTS[k]).map((k) => [k, true]));
const marks = (named) => KEYS.filter((k) => !!named[k] !== GATE_DEFAULTS[k]).map((k) => `${named[k] ? '' : 'no'}${GATE_TAG[k] || k}`);

describe('C.GATES defaults of a cell (M2b v14)', () => {
  test('the defaults are the engine as built (C.GATES at load; v14 switches on, D111, D113)', () => {
    assert.deepEqual(GATE_DEFAULTS, { ...C.GATES });
    assert.ok(KEYS.length >= 4);
    for (const k of ['rareHpMultZ1', 'firstMeetWindup', 'sapHold', 'passStealth']) assert.equal(GATE_DEFAULTS[k], true, k);
    assert.ok(Object.isFrozen(GATE_DEFAULTS));
  });

  test('gatesFor: no gates = the defaults; named gates = those on, every other off (each subset)', () => {
    assert.deepEqual(gatesFor(null), { ...GATE_DEFAULTS });
    for (let m = 0; m < 1 << KEYS.length; m++) {
      const named = Object.fromEntries(KEYS.filter((_, i) => m & (1 << i)).map((k) => [k, true]));
      assert.deepEqual(gatesFor(named), Object.fromEntries(KEYS.map((k) => [k, !!named[k]])));
    }
  });

  test('a plain cell plays the defaults after a gated cell; it equals the cell that names every default switch', () => {
    for (const cell of [{ bot: 'planner', cls: 'rogue', prof: 'fresh', tree: 2 }, { bot: 'onebutton', cls: 'mage', prof: 'fresh', tree: 1, map: 'expedition', prep: true }]) {
      setGates({});
      const plain = runWithBot(cell, 1003, null, { hash: true }).record;
      assert.deepEqual(C.GATES, { ...GATE_DEFAULTS });
      const named = runWithBot({ ...cell, gates: ALL }, 1003, null, { hash: true }).record;
      assert.equal(plain.err, null);
      assert.equal(plain.hash, named.hash, `${cell.bot} ${cell.map || 'classic'}`);
    }
    setGates(null);
  });

  test('the cell name marks every switch played at another value than its default', () => {
    const name = (gates) => cellName({ bot: 'planner', prof: 'fresh', ...(gates ? { gates } : {}) });
    const want = (named) => ['planner', 'P0', ...marks(named)].join('-');
    assert.equal(name(null), 'planner-P0');
    assert.equal(name(ALL), 'planner-P0');
    for (const g of [{ rareHpMultZ1: true, firstMeetWindup: true }, { rareHpMultZ1: true, firstMeetWindup: true, sapHold: true }, { rareHpMultZ1: true }, {}]) assert.equal(name(g), want(g));
    // The v14 tags, whatever switches come after them in the engine's order.
    assert.ok(name({ rareHpMultZ1: true, firstMeetWindup: true }).startsWith('planner-P0-nosap-nopst'));
    assert.ok(name({ ...ALL, passStealth: false }).startsWith('planner-P0-nopst'));
    assert.ok(name({}).startsWith('planner-P0-nog5-nog6-nosap-nopst'));
    // Every switch of the engine has a tag (a switch without one would be marked by its key).
    for (const k of KEYS) assert.ok(GATE_TAG[k], `GATE_TAG.${k}`);
  });
});
