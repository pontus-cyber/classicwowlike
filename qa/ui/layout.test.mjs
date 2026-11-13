// UI layout rules of the blind tester panel of 2026-11-13 and D143 (docs/handoffs/ui-2026-11-13d.md), pure parts in Node:
// bag slots that stay put (src/ui/windows.js stableBag, item 9), rim names moved apart along the map's rim
// (src/ui/screens.js spreadAngles, item 5), the Inn's ask at nearly full health and mana (screens.js nearlyFull, item 8),
// the beat lines that wait for the map and the closed Road's line (src/ui/onboarding.js MAP_LINES, closedRoadLine, D143).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const { stableBag } = await import('../../src/ui/windows.js');
const { spreadAngles, nearlyFull, INN_ASK_SHARE } = await import('../../src/ui/screens.js');
const { MAP_LINES, closedRoadLine, rawLine } = await import('../../src/ui/onboarding.js');
const { CONTENT } = await import('../../src/content/index.js');
const C = await import('../../src/constants.js');

/** A bag as the bridge gives it: items (by uid) first, then nulls up to the capacity. */
const bag = (uids, cap = 8) => [...uids.map((uid) => ({ uid })), ...Array(cap - uids.length).fill(null)];

test('item 9: an item that leaves the bags leaves a gap; the others keep their slots', () => {
  const a = stableBag(null, bag(['a', 'b', 'c', 'd']));
  assert.deepEqual(a.uids.slice(0, 5), ['a', 'b', 'c', 'd', null], 'first draw: the engine order');
  const b = stableBag(a, bag(['a', 'c', 'd'])); // b equipped into an empty slot: the engine splices it out
  assert.deepEqual(b.uids.slice(0, 4), ['a', null, 'c', 'd']);
  const c = stableBag(b, bag(['a', 'c', 'd', 'e'])); // a new item (looted, bought) fills the first gap
  assert.deepEqual(c.uids.slice(0, 4), ['a', 'e', 'c', 'd']);
});

test('item 9: equipping over a worn piece puts the worn piece in the same slot (the engine puts it at the same index)', () => {
  const a = stableBag(null, bag(['a', 'b', 'c']));
  const gap = stableBag(a, bag(['b', 'c'])); // a used up: slot 0 empty
  assert.deepEqual(gap.uids.slice(0, 3), [null, 'b', 'c']);
  const swap = stableBag(gap, bag(['b', 'w'])); // c equipped over the worn w: the engine puts w at c's index
  assert.deepEqual(swap.uids.slice(0, 3), [null, 'b', 'w'], 'w takes c\'s slot, not the first gap');
});

test('item 9: no item is ever lost, also with more items than slots', () => {
  const a = stableBag(null, bag(['a', 'b'], 2));
  const b = stableBag(a, [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }]);
  assert.deepEqual([...b.uids].sort(), ['a', 'b', 'c']);
});

test('item 5: rim names that would meet move apart, equally, by the gap; names apart stay put', () => {
  const sep = (m, i, j, h) => Math.abs(((((m[i] - m[j]) % 360) + 540) % 360) - 180) - h[i] - h[j];
  const halves = [19, 19];
  const m = spreadAngles([{ mid: 200, half: 19 }, { mid: 220, half: 19 }], 4);
  assert.ok(sep(m, 0, 1, halves) >= 4 - 1e-6, `apart: ${m}`);
  assert.ok(Math.abs((m[0] + m[1]) / 2 - 210) < 1e-6, 'pushed apart around their middle');
  assert.deepEqual(spreadAngles([{ mid: 10, half: 10 }, { mid: 100, half: 10 }], 4), [10, 100], 'already apart: unchanged');
  // across 0 / 360, and three names in a row
  const w = spreadAngles([{ mid: 355, half: 12 }, { mid: 8, half: 12 }], 4);
  assert.ok(sep(w, 0, 1, [12, 12]) >= 4 - 1e-6, `across 0: ${w}`);
  const three = spreadAngles([{ mid: 90, half: 15 }, { mid: 100, half: 15 }, { mid: 110, half: 15 }], 4);
  for (const [i, j] of [[0, 1], [1, 2], [0, 2]]) assert.ok(sep(three, i, j, [15, 15, 15]) >= 4 - 1e-6, `three: ${three}`);
});

test('item 5: random sets of rim names that fit the circle never meet after spreadAngles', () => {
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let trial = 0; trial < 300; trial++) {
    const n = 2 + Math.floor(rnd() * 5); const items = Array.from({ length: n }, () => ({ mid: rnd() * 360, half: 6 + rnd() * 18 }));
    if (items.reduce((a, x) => a + 2 * x.half + 4, 0) >= 360) continue;
    const m = spreadAngles(items, 4);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.abs(((((m[i] - m[j]) % 360) + 540) % 360) - 180) - items[i].half - items[j].half;
      assert.ok(d >= 4 - 1e-6, `trial ${trial}: ${JSON.stringify(items)} -> ${m}`);
    }
  }
});

test('item 8: the Inn asks when health and mana (a mana class) are at INN_ASK_SHARE or more', () => {
  assert.equal(INN_ASK_SHARE, 0.9);
  const p = (hp, cur, kind = 'mana') => ({ hp, maxHp: 100, res: { kind, cur, max: 100 } });
  assert.equal(nearlyFull(p(100, 100)), true);
  assert.equal(nearlyFull(p(90, 95)), true);
  assert.equal(nearlyFull(p(89, 100)), false, 'hurt: rests at once');
  assert.equal(nearlyFull(p(100, 50)), false, 'low mana: rests at once');
  assert.equal(nearlyFull(p(95, 0, 'energy')), true, 'energy refills every fight: only health counts');
});

test('D143: the map lines wait for the map (G2, G12, G13 and its closed line); G10 does not; the closed Road\'s line is the content\'s', () => {
  for (const id of ['G2', 'G12', 'G12.caught', 'G13', 'G13.onRoad', 'G13.closed']) assert.ok(MAP_LINES.has(id), id);
  assert.ok(!MAP_LINES.has('G10') && !MAP_LINES.has('G3'));
  const data = { tutorial: { table: CONTENT.tutorial, num: { bellTolls: C.BELL_CHANNEL_TIME } } };
  assert.equal(closedRoadLine(data), rawLine(CONTENT.tutorial, 'G13.closed'));
  assert.ok(/Gorrak/.test(closedRoadLine(data)) && closedRoadLine(data).length <= C.ONB_HINT_MAX_CHARS);
  assert.equal(closedRoadLine({ tutorial: null }), null);
});
