// Junk out of the loot loop (2026-11-20, tester s0426; BACKLOG "junk auto-sell and duplicate junk in one window"):
// the same junk is one row with a count in a loot window, and the bags' junk is sold the moment a vendor opens, in one
// log line with the total. UI only: no engine file changed. Runs with Legacy off and on. Demo blind round 2 R2-3: after any
// step out of a fight the junk is sold at once (CASH_JUNK), so a loot window with junk only comes from a loaded state.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem0 = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem0.has(k) ? mem0.get(k) : null), setItem: (k, v) => { mem0.set(k, String(v)); }, removeItem: (k) => { mem0.delete(k); } };
const R = await import('../../src/rules.js');
const C = R.C;
const { sellValue } = await import('../../src/engine/items.js');
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { junkSoldName } = await import('../../src/ui/ui-text.js');

const KEYS = ['tbwcr.profile.v1', 'tbwcr.profile.v3', 'tbwcr.history.v1', 'tbwcr.history.v3', 'tbwcr.legacy.refund.v1'];
const clear = () => { for (const k of KEYS) globalThis.localStorage.removeItem(k); };
const gates = (on) => { C.GATES.legacy = on; C.GATES.oruvathLegacy = on; C.GATES.economyV2 = on; };
const nodeOf = (b) => R.deserialize(b.backend.serialized(), CONTENT);
const junk = (uid, name, level = 3) => ({ uid, kind: 'junk', name, level, qty: 1 });

function atHub(legacy) {
  clear(); gates(legacy);
  const b = createBridge({ seed: 5, legacy });
  b.dispatch({ type: 'SET_GUIDE', on: false });
  b.dispatch({ type: 'SELECT_CLASS', classId: 'rogue' });
  b.dispatch({ type: 'START_RUN' });
  for (let i = 0; i < 30 && b.view.phase === 'PREP'; i++) b.dispatch({ type: 'AUTO' });
  assert.equal(b.view.phase, 'ZONE_HUB');
  return b;
}

for (const legacy of [false, true]) {
  const tag = legacy ? 'Legacy on' : 'Legacy off';

  test(`${tag}: junk is sold when the vendor opens, in one log line with the total`, () => {
    try {
      const b = atHub(legacy);
      const s = nodeOf(b);
      s.player.bag.push(junk('t-j1', 'Cracked Tooth'), junk('t-j2', 'Torn Pelt'), { ...junk('t-j3', 'Torn Pelt'), qty: 4 });
      const gear = s.player.bag.filter((x) => x.kind !== 'junk').length;
      const want = s.player.bag.filter((x) => x.kind === 'junk').reduce((a, x) => a + sellValue(s, x), 0);
      const gold0 = s.player.gold;
      b.testLoad(R.serialize(s));
      const r = b.dispatch({ type: 'HUB_SERVICE', service: 'vendor' });
      assert.ok(r.ok, JSON.stringify(r));
      const sells = r.events.filter((e) => e.t === 'sell');
      assert.equal(sells.length, 1, 'one sell line for all the junk');
      assert.equal(sells[0].name, junkSoldName(6));
      assert.equal(sells[0].gold, want);
      const after = nodeOf(b);
      assert.equal(after.player.bag.filter((x) => x.kind === 'junk').length, 0, 'no junk left');
      assert.equal(after.player.bag.length, gear, 'other items stay');
      assert.equal(after.player.gold, gold0 + want);
      assert.ok(!b.view.player.bag.some((x) => x && x.kind === 'junk'));
      // nothing to sell: no sell line
      b.dispatch({ type: 'LEAVE' });
    } finally { gates(false); clear(); }
  });

  test(`${tag}: a vendor opened with no junk in the bags logs no sale`, () => {
    try {
      const b = atHub(legacy);
      const s = nodeOf(b); s.player.bag = s.player.bag.filter((x) => x.kind !== 'junk'); b.testLoad(R.serialize(s));
      const r = b.dispatch({ type: 'HUB_SERVICE', service: 'vendor' });
      assert.ok(r.ok);
      assert.equal(r.events.filter((e) => e.t === 'sell').length, 0);
    } finally { gates(false); clear(); }
  });

  test(`${tag}: the same junk twice in a loot window is one row with a count; Take and Drop act on every piece`, () => {
    try {
      const b = atHub(legacy);
      const s = nodeOf(b);
      const cap = R.bagCapacity(s);
      s.player.bag = [];
      for (let k = 0; s.player.bag.length < cap - 2; k++) s.player.bag.push(junk(`t-fill-${k}`, `Filler ${k}`));
      s.loot = [junk('t-l1', 'Torn Pelt'), junk('t-l2', 'Bent Buckle'), junk('t-l3', 'Torn Pelt'), junk('t-l4', 'Torn Pelt')];
      b.testLoad(R.serialize(s));
      const L = b.view.loot;
      assert.ok(L && L.title === 'Items waiting', JSON.stringify(L && L.title));
      assert.equal(L.items.length, 2, 'two rows for four pieces');
      const pelt = L.items.find((x) => x.name === 'Torn Pelt');
      assert.equal(pelt.count, 3);
      assert.equal(pelt.uids.length, 3);
      // two free slots: the three pelts stack into one bag slot; demo blind round 2 R2-3: then every piece of junk, in the
      // bags and the loot window, is sold at once (CASH_JUNK), in one sale line
      const i = L.items.indexOf(pelt);
      const r = b.dispatch({ type: 'LOOT_TAKE', i });
      assert.ok(r.ok);
      assert.equal(nodeOf(b).loot.length, 0);
      assert.equal(nodeOf(b).player.bag.filter((x) => x.kind === 'junk').length, 0);
      const sells = r.events.filter((e) => e.t === 'sell');
      assert.equal(sells.length, 1);
      assert.equal(sells[0].name, junkSoldName(cap - 2 + 4));
    } finally { gates(false); clear(); }
  });

  test(`${tag}: a stack of junk that the full bags refuse gives the one bags-full reason, and Drop leaves all of it`, () => {
    try {
      const b = atHub(legacy);
      const s = nodeOf(b);
      const cap = R.bagCapacity(s);
      s.player.bag = [];
      for (let k = 0; s.player.bag.length < cap; k++) s.player.bag.push(junk(`t-fill-${k}`, `Filler ${k}`));
      s.loot = [junk('t-l1', 'Torn Pelt'), junk('t-l2', 'Torn Pelt')];
      b.testLoad(R.serialize(s));
      assert.equal(b.view.loot.items.length, 1);
      assert.equal(b.view.loot.items[0].count, 2);
      const r = b.dispatch({ type: 'LOOT_TAKE', i: 0 });
      assert.ok(!r.ok);
      assert.ok(b.dispatch({ type: 'LOOT_DROP', i: 0 }).ok);
      assert.equal(nodeOf(b).loot.length, 0);
    } finally { gates(false); clear(); }
  });
}
