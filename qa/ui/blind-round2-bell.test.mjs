// Demo blind round 2, R2-3 (the reward's default pick) and R2-4 (the Bell's fight in the Dimming) in Node (BACKLOG
// 2026-11-26; feedback 2026-11-26-blind-demo-returning item 1, -skipper-retest s0205-s0207; lines draft). The bridge's
// bellFight is the engine's own RING_BELL step on a copy (the run is not changed) and names the fight that comes first;
// bellFightInfo turns it into the confirm's line and threat; defaultPick is the reward Space takes. The browser side
// (the pause of autoplay and speed, the last moment before the fallen screen) is ui-regress part AE.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const R = await import('../../src/rules.js');
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { bellFightInfo } = await import('../../src/ui/ui-text.js');
const { defaultPick } = await import('../../src/ui/screens.js');

/** Zone 2's map on the node the Dimming took first, a few tolls after it dimmed (seed 3). */
function inTheDimming() {
  let s = R.debug.build({ content: CONTENT, classId: 'rogue', zone: 2, level: 6, seed: 3 }).state;
  s = R.step(s, { type: 'LEAVE_HUB' }).state;
  const n = [...R.mapView(s).nodes].filter((x) => !x.hub).sort((a, b) => a.dimAt - b.dimAt)[0];
  s.zone.pos = n.id; s.zone.start -= n.dimAt + 3;
  return s;
}

test('bellFight: the fight RING_BELL starts first, read from the engine\'s own step; the run is not changed', () => {
  const s = inTheDimming();
  const b = createBridge({ seed: 3 });
  b.testLoad(R.serialize(s));
  const before = b.backend.serialized();
  const f = b.bellFight();
  assert.ok(f, 'a fight comes first');
  const n = R.step(R.deserialize(before, CONTENT), { type: 'RING_BELL' }).state;
  assert.equal(n.node.type, 'dim');
  assert.equal(f.level, n.node.cl);
  assert.deepEqual(f.enemies.map((e) => e.name), n.fight.enemies.map((e) => e.name));
  assert.equal(b.backend.serialized(), before, 'the dry step left the run as it was');
  assert.deepEqual(b.engineLog(), [], 'and sent nothing');
  // the step itself starts that very fight
  assert.ok(b.dispatch({ type: 'RING_BELL' }).ok);
  assert.deepEqual(b.view.combat.enemies.map((e) => e.name), f.enemies.map((e) => e.name));
});

test('bellFight is null where the Bell starts no fight', () => {
  let s = R.debug.build({ content: CONTENT, classId: 'rogue', zone: 2, level: 6, seed: 3 }).state;
  s = R.step(s, { type: 'LEAVE_HUB' }).state;
  const b = createBridge({ seed: 3 });
  b.testLoad(R.serialize(s));
  assert.equal(b.bellFight(), null);
});

test('bellFightInfo: the confirm\'s line and the threat by the level gap and the count (draft)', () => {
  const two = [{ name: 'Peat Sentinel' }, { name: 'Mistfang Hound' }];
  const i = bellFightInfo({ level: 9, hero: 6, enemies: two });
  assert.equal(i.text, 'First a fight in the Dimming: 2 enemies at level 9, 3 levels above you (Peat Sentinel, Mistfang Hound).');
  assert.equal(i.threat, 'deadly');
  assert.equal(bellFightInfo({ level: 7, hero: 6, enemies: two }).threat, 'high');
  assert.equal(bellFightInfo({ level: 6, hero: 6, enemies: [...two, { name: 'Peat Sentinel' }] }).threat, 'high', 'three enemies at your level');
  assert.equal(bellFightInfo({ level: 6, hero: 6, enemies: two }).threat, 'even');
  assert.match(bellFightInfo({ level: 6, hero: 6, enemies: two }).text, /at level 6, your level \(/);
  assert.equal(bellFightInfo({ level: 3, hero: 6, enemies: [{ name: 'A' }] }).threat, 'low');
  assert.match(bellFightInfo({ level: 3, hero: 6, enemies: [{ name: 'A' }] }).text, /^First a fight in the Dimming: 1 enemy at level 3, 3 levels below you \(A\)\.$/);
  assert.equal(bellFightInfo(null), null);
  // a Legacy run: the levels as shown (the hero scale)
  assert.match(bellFightInfo({ level: 30, hero: 24, enemies: two }, (x) => Math.round(x / 6)).text, /at level 5, 1 level above you/);
});

test('defaultPick: the biggest upgrade (put on); with none, the closest to what is worn; another class\'s main stat last', () => {
  const U = { a: { up: true, diff: 2 }, b: { up: true, diff: 5 }, c: { up: false, diff: -1 }, d: { up: false, diff: -4 }, e: { up: false, diff: 3, off: true }, f: { up: true, diff: 1, empty: true } };
  const up = (it) => U[it.id];
  const g = (id) => ({ id, kind: 'gear' });
  assert.deepEqual(defaultPick([g('a'), g('b')], up), { i: 1, equip: true });
  assert.deepEqual(defaultPick([g('a'), g('f')], up), { i: 1, equip: true }, 'an empty slot first');
  assert.deepEqual(defaultPick([g('d'), g('c')], up), { i: 1, equip: false }, 'no upgrade: the closest');
  assert.deepEqual(defaultPick([g('e'), g('d')], up), { i: 1, equip: false }, 'another class\'s main stat last');
  assert.equal(defaultPick([], up), null);
});
