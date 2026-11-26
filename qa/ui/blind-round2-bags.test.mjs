// Demo blind round 2, R2-3 Inventory and Space (BACKLOG 2026-11-26; feedback 2026-11-26-blind-demo-returning items 2, 5,
// 6 and -skipper-retest; lines draft), the bridge's side in Node: junk never stays in the bags (CASH_JUNK after the step,
// one log line, one row in the spoils); a closed chest with full bags shows no "Items waiting" before it is opened and is
// opened once (bug); Take all with full bags takes what fits, leaves the rest and moves on (Space always moves on).
// The browser side (Leave in one click, the default reward pick, Equip on purchase) is ui-regress part AE.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const R = await import('../../src/rules.js');
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { junkSoldName, leftBehindLine } = await import('../../src/ui/ui-text.js');

const nodeOf = (b) => R.deserialize(b.backend.serialized(), CONTENT);
/** Zone 1's map beside a chest (seed 2: the engine opens it on entry), the bags full of gear copies. */
function besideChest() {
  let s = R.debug.build({ content: CONTENT, classId: 'rogue', zone: 1, level: 3, seed: 2 }).state;
  s = R.step(s, { type: 'LEAVE_HUB' }).state;
  const z = s.zone; const id = z.nodes[z.pos].nb.find((i) => z.nodes[i].type === 'treasure');
  const g = s.player.equipped.chest; let k = 0;
  while (s.player.bag.length < R.bagCapacity(s)) s.player.bag.push({ ...g, uid: `fill${k++}` });
  const b = createBridge({ seed: 2 });
  b.testLoad(R.serialize(s));
  return { b, id };
}

test('a closed chest with full bags: no "Items waiting" before it is opened, and it opens once', () => {
  const { b, id } = besideChest();
  assert.ok(b.dispatch({ type: 'ENGINE', action: { type: 'MOVE', nodeId: id } }).ok);
  assert.equal(nodeOf(b).loot.length, 1, 'the chest\'s item waits in the engine\'s loot window');
  assert.equal(b.view.node.step, 'chest');
  assert.equal(b.view.loot, null, 'the chest shows first, not the loot window');
  const gold0 = b.view.player.gold;
  const o = b.dispatch({ type: 'OPEN_CHEST' });
  assert.ok(o.ok);
  const L = b.view.loot;
  assert.equal(L.title, 'Treasure chest');
  assert.equal(L.items.filter((x) => x.pending).length, 1);
  assert.deepEqual(L.fit, { take: 0, left: 1 });
  assert.ok(b.view.player.gold > gold0, 'the gold comes with the opening');
  const gold1 = b.view.player.gold;
  const t = b.dispatch({ type: 'LOOT_TAKE_ALL' });
  assert.ok(t.ok);
  assert.equal(b.view.loot, null, 'Take all moved on');
  assert.notEqual(b.view.node && b.view.node.step, 'chest', 'the chest is not offered again');
  assert.equal(nodeOf(b).loot.length, 0);
  assert.equal(b.view.player.gold, gold1, 'no second payment');
  const msg = t.events.find((e) => e.t === 'msg');
  assert.ok(msg && msg.quiet && msg.text.startsWith('Left behind (bags full): '), JSON.stringify(t.events));
  assert.equal(t.events.filter((e) => e.t === 'msg' && /bags are full/i.test(e.text)).length, 0, 'no second bags-full line');
  assert.equal(b.dispatch({ type: 'OPEN_CHEST' }).ok, false);
});

test('Take all takes what fits and leaves the rest', () => {
  let s = R.debug.build({ content: CONTENT, classId: 'rogue', zone: 1, level: 3, seed: 2 }).state;
  const g = s.player.equipped.chest; let k = 0;
  while (s.player.bag.length < R.bagCapacity(s) - 1) s.player.bag.push({ ...g, uid: `fill${k++}` });
  s.loot.push({ ...g, uid: 'w1', name: 'First Vest' }, { ...g, uid: 'w2', name: 'Second Vest' });
  const b = createBridge({ seed: 2 });
  b.testLoad(R.serialize(s));
  assert.deepEqual(b.view.loot.fit, { take: 1, left: 1 });
  const t = b.dispatch({ type: 'LOOT_TAKE_ALL' });
  assert.ok(t.ok);
  const after = nodeOf(b);
  assert.equal(after.loot.length, 0);
  assert.ok(after.player.bag.some((x) => x.uid === 'w1'));
  assert.ok(!after.player.bag.some((x) => x.uid === 'w2'));
  assert.ok(t.events.some((e) => e.t === 'msg' && e.text === leftBehindLine(['Second Vest'])));
});

test('junk is sold as it comes: never in the bags, one log line, one row in the spoils', () => {
  const b = createBridge({ seed: 7 });
  b.dispatch({ type: 'SET_GUIDE', on: false });
  b.dispatch({ type: 'SELECT_CLASS', classId: 'rogue' });
  b.dispatch({ type: 'START_RUN' });
  let lines = 0; let rows = 0; let inBags = 0;
  for (let i = 0; i < 1500 && b.view.phase !== 'SUMMARY'; i++) {
    const r = b.dispatch({ type: 'AUTO' });
    if (!r.ok) break;
    const sells = r.events.filter((e) => e.t === 'sell' && /junk/.test(e.name));
    lines += sells.length;
    assert.ok(sells.length <= 1, 'one sale line a step');
    assert.ok(!r.events.some((e) => e.t === 'gotItem' && /junk/i.test(e.rarity || '')), 'no "You receive loot" line for junk');
    if (b.view.player && b.view.player.bag.some((x) => x && x.kind === 'junk')) inBags++;
    if (b.view.loot && b.view.loot.junk) { rows++; assert.equal(b.view.loot.items.filter((x) => x.kind === 'junk').length, 0); }
  }
  assert.ok(lines > 0, 'some junk was sold');
  assert.ok(rows > 0, 'a spoils window showed its junk row');
  assert.equal(inBags, 0);
  assert.equal(junkSoldName(2), '2 junk items');
  assert.ok(b.engineLog().some((a) => a.type === 'CASH_JUNK'), 'the sale is an engine action (the Node twins replay it)');
});
