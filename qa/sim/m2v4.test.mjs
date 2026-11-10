// M2 v4 simulator changes (docs/specs/changes-m2-v4.md "Target and metric changes", X2 sim line): the standard
// purchase order without Wayfinder, P10 unchanged, the campaign rule on the engine's catalogue.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { C, R } from '../../sim/lib/engine.mjs';
import { BAL } from '../../sim/lib/params.mjs';
import { standardOrder, buildProfile, campaignBuy, nextPurchase } from '../../sim/lib/profiles.mjs';

describe('meta profiles (balance.md 1.4, M2 v4)', () => {
  test('the standard order has no Wayfinder; P10 is the same ten entries as before', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const order = standardOrder(cls);
      assert.ok(!order.some(([id]) => id === 'wayfinder'));
      assert.deepEqual(order.map(([id, k]) => `${id} ${k}`).slice(0, 10), ['satchel 1', 'vigor 1', 'edge 1', 'quick_study 1', 'pockets 1', 'ledger 1', 'scout 1', 'vigor 2', 'edge 2', `sp_${cls[0]}1 1`]);
      assert.deepEqual(order.slice(10).map(([id, k]) => `${id} ${k}`), ['cache 1', 'keen 1', 'quick_study 2', 'second_breath 1']);
      for (const [id, k] of order) assert.ok(C.META[id] && C.META[id].ranks >= k, `${id} ${k} is in the engine's catalogue`);
      const p10 = buildProfile('p10', cls);
      assert.deepEqual(Object.keys(p10.unlocks).filter((id) => p10.unlocks[id] > 0).sort(), ['edge', 'ledger', 'pockets', 'quick_study', 'satchel', 'scout', `sp_${cls[0]}1`, 'vigor'].sort());
    }
  });

  test('PALL owns every catalogue entry at its top rank; a campaign buys only catalogue entries, in order', () => {
    const all = buildProfile('all', 'mage');
    for (const m of Object.values(C.META)) assert.equal(all.unlocks[m.id], m.ranks, m.id);
    let p = R.newProfile();
    p.echoes = 100000;
    const { profile, bought } = campaignBuy(p, 'mage');
    for (const id of bought) assert.ok(C.META[id], id);
    assert.deepEqual(bought.slice(0, 12), standardOrder('mage').slice(0, 12).map(([id]) => id));
    // What is left is waiting for a requirement (boss reached or killed), not for Echoes.
    const next = nextPurchase(profile, 'mage');
    if (next) assert.ok(!R.metaOffers(profile).find((o) => o.id === next).available || profile.echoes < R.metaOffers(profile).find((o) => o.id === next).nextCost);
  });

  test('B12 p10 is report-only and B32 counts blocks of at least CURVE_BLOCK_MIN_RUNS runs (balance.md 6)', () => {
    assert.equal(BAL.MIN_SPEED_P10_MAX, null);
    assert.equal(BAL.CURVE_BLOCK_MIN_RUNS, 50);
  });
});
