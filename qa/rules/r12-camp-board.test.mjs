// QA rule tests for the start camp's board drawn across the run (docs/specs/expedition.md 2.2 and 3.5, D132): the three
// offers come one from each band of CONTRACT_BOARD_BANDS (zones 1-2, 3-4, 5-6) while GATES.boardAcrossRun is on; each
// one can be taken (legalActions), and a late contract taken at the camp is held through the early zones ('later'), gets
// its sites when its own zone is generated and expires only when that zone is left. Off: the D128 board, zones 1-3.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';

const atCamp = (seed) => R.step(R.newRun({ classId: 'mage', seed, content: REAL, mapMode: 'expedition', prep: true }), { type: 'START_RUN' }).state;
const go = (s, a) => R.step(s, a).state;
function withGate(key, value, fn) {
  const old = C.GATES[key];
  C.GATES[key] = value;
  try { return fn(); } finally { C.GATES[key] = old; }
}

describe('expedition.md 2.2 (D132): the camp board across the run', () => {
  test('one offer from each band, each listed by legalActions as TAKE_CONTRACT; switch off: zones 1, 2, 3', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = atCamp(seed);
      const v = R.prepView(s);
      assert.equal(v.board.length, C.CONTRACT_BOARD_BANDS.length);
      v.board.forEach((b, i) => {
        const [lo, hi] = C.CONTRACT_BOARD_BANDS[i];
        assert.ok(b.z >= lo && b.z <= hi, `seed ${seed}: card ${i + 1} zone ${b.z} in ${lo}-${hi}`);
        assert.equal(b.zoneName, REAL.zones[b.z - 1].name);
      });
      const takes = R.legalActions(s).filter((a) => a.type === 'TAKE_CONTRACT').map((a) => a.index);
      assert.deepEqual(takes, v.board.filter((b) => b.canTake).map((b) => b.index));
      assert.ok(v.board.every((b) => b.canTake), `seed ${seed}: all three affordable at the start`);
      assert.deepEqual(withGate('boardAcrossRun', false, () => R.prepView(atCamp(seed)).board.map((b) => b.z)), [1, 2, 3]);
    }
  });

  test('a late contract taken at the camp is held through the early zones, gets its sites in its zone and expires when that zone is left', () => {
    let s = atCamp(3);
    for (const b of R.prepView(s).board) s = go(s, { type: 'TAKE_CONTRACT', index: b.index });
    s = go(s, { type: 'SET_OUT' });
    const held = s.exp.contracts.map((k) => ({ id: k.id, z: k.z }));
    assert.equal(held.length, 3);
    const late = held[2];
    assert.ok(late.z >= 5);
    for (let z = 1; z <= late.z; z++) {
      assert.equal(s.zone.z, z);
      const cv = R.contractView(s);
      const st = cv.contracts.find((k) => k.id === late.id).status;
      if (z < late.z) assert.equal(st, 'later', `zone ${z}`);
      else {
        assert.equal(st, 'active', `zone ${z}`);
        const k = s.exp.contracts.find((x) => x.id === late.id);
        assert.ok(k.sites.length > 0, 'sites placed in its own zone');
        for (const id of k.sites) assert.ok(s.zone.nodes[id].sites.includes(late.id));
      }
      if (z < late.z) s = R.debug.nextZone(s).state;
    }
    s = R.debug.nextZone(s).state;
    assert.equal(R.contractView(s).contracts.find((k) => k.id === late.id).status, 'expired');
  });
});
