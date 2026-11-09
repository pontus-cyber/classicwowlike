// Public API helpers for the simulator and the UI (engine-api.md 1): V, xpCurve, diffMod, bagCapacity.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started } from './helpers.mjs';
import { V as engineV, bagCapacity as engineBag } from '../../src/engine/items.js';
import { xpCurve as engineCurve, diffMod as engineDiff } from '../../src/engine/progress.js';

describe('public rule helpers (engine-api.md 1)', () => {
  test('V, xpCurve and diffMod are the engine functions; xpCurve is defined at MAX_LEVEL where xpToNext is 0', () => {
    for (const L of [1, 2, 10, 30, 59, 60, 62]) {
      assert.equal(R.V(L), engineV(L), `V(${L})`);
      assert.equal(R.xpCurve(L), engineCurve(L), `xpCurve(${L})`);
      if (L < C.MAX_LEVEL) assert.equal(R.xpToNext(L), R.xpCurve(L));
    }
    assert.equal(R.V(30), Math.round(C.VALUE_BASE + C.VALUE_COEF * Math.pow(30, C.VALUE_EXP)));
    assert.equal(R.xpCurve(C.MAX_LEVEL), C.XP_A * C.MAX_LEVEL ** 2 + C.XP_B * C.MAX_LEVEL + C.XP_C);
    assert.equal(R.xpToNext(C.MAX_LEVEL), 0);
    for (let d = -9; d <= 9; d++) assert.equal(R.diffMod(d), engineDiff(d), `diffMod(${d})`);
    assert.equal(R.diffMod(0), 1);
    assert.equal(R.diffMod(20), C.XP_DIFF_MAX);
    assert.equal(R.diffMod(C.XP_GREY_DIFF), C.XP_GREY_MOD);
  });

  test('bagCapacity: BAG_SLOTS plus Deeper Pockets, in CREATE (from the profile) and during the run', () => {
    const prof = { ...R.newProfile(), unlocks: { pockets: 2 } };
    const create = R.newRun({ classId: 'mage', seed: 1, content: CONTENT, profile: prof });
    assert.equal(R.bagCapacity(create), C.BAG_SLOTS + 2 * C.META.pockets.slots);
    assert.equal(R.bagCapacity(R.newRun({ seed: 1, content: CONTENT })), C.BAG_SLOTS, 'no class chosen, fresh profile');
    const run = R.step(create, { type: 'START_RUN' }).state;
    assert.equal(R.bagCapacity(run), engineBag(run));
    assert.equal(R.bagCapacity(run), C.BAG_SLOTS + 2 * C.META.pockets.slots);
    assert.equal(R.bagCapacity(started('rogue')), C.BAG_SLOTS);
  });
});
