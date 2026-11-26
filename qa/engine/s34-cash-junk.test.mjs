// Demo blind round 2 R2-3 (feedback 2026-11-26-blind-demo-returning item 5, -skipper item 23; BACKLOG 2026-11-26 R2-3;
// draft): CASH_JUNK, the client's junk auto-sale. Out of a fight, anywhere in the run, the junk in the bags and the loot
// window is sold at its vendor price (sellValue); refused in a fight and with no junk; not listed by legalActions (bots and
// autoplay never send it, so the simulator's runs are unchanged); no draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { sellValue } from '../../src/engine/items.js';

const junk = (uid, level = 3, qty = 1) => ({ uid, kind: 'junk', name: `Junk ${uid}`, level, qty });
const hub = () => R.debug.build({ content: CONTENT, classId: 'rogue', zone: 1, level: 3, seed: 4 }).state;

test('CASH_JUNK sells the junk of the bags and the loot window at its vendor price, out of a vendor', () => {
  const s = hub();
  assert.equal(s.phase, 'ZONE_HUB');
  s.player.bag.push(junk('j1', 3, 2), junk('j2', 4));
  s.loot.push(junk('j3', 5));
  const gear = s.player.bag.filter((x) => x.kind !== 'junk').length;
  const want = [junk('j1', 3, 2), junk('j2', 4), junk('j3', 5)].reduce((a, x) => a + sellValue(s, x), 0);
  assert.equal(R.whyIllegal(s, { type: 'CASH_JUNK' }), null);
  const g0 = s.player.gold;
  const r = R.step(s, { type: 'CASH_JUNK' });
  const sold = r.events.find((e) => e.t === 'junkSold');
  assert.deepEqual(sold, { t: 'junkSold', count: 4, value: want, items: ['j1', 'j2', 'j3'] });
  assert.ok(r.events.some((e) => e.t === 'gold' && e.why === 'sell' && e.amount === want));
  assert.equal(r.state.player.gold, g0 + want);
  assert.equal(r.state.player.bag.length, gear, 'the other items stay');
  assert.equal(r.state.loot.length, 0);
  assert.equal(r.state.stats.vendorTx, s.stats.vendorTx, 'no vendor transaction');
});

test('CASH_JUNK: refused with no junk and in a fight; never listed by legalActions', () => {
  let s = hub();
  s.player.bag = s.player.bag.filter((x) => x.kind !== 'junk');
  assert.match(R.whyIllegal(s, { type: 'CASH_JUNK' }), /no junk/);
  s.player.bag.push(junk('j1'));
  assert.ok(!R.legalActions(s).some((a) => a.type === 'CASH_JUNK'));
  const tid = Object.keys(CONTENT.enemies).find((t) => /^z1_/.test(t) && CONTENT.enemies[t].archetype === 'brute');
  s = R.debug.encounter(s, { ids: [tid] }).state;
  assert.ok(s.fight);
  assert.ok(R.whyIllegal(s, { type: 'CASH_JUNK' }));
});

test('CASH_JUNK with the loot window open clears its junk and moves no random stream', () => {
  const s = hub();
  s.loot.push(junk('j9', 2, 3));
  const a = R.step(s, { type: 'CASH_JUNK' }).state;
  assert.equal(a.loot.length, 0);
  // no draw: every random stream position is as before
  assert.deepEqual(a.zone, s.zone);
});
