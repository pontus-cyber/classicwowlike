// docs/specs/changes-m2b-v15.md engine and content rows (D123-D125): the Swift passage (row 2; rules 1.9.7, expedition.md
// 7.1: a Road taken within ROAD_SWIFT_TOLLS of arriving at the zone's hub grants round(ROAD_SWIFT_XP_FRAC × xpToNext(L))
// XP, before TIME_TRAVEL; the `swift` event, mapView `swift`, heatPreview `swift`, the summary's counts; GATES.swiftRoad),
// Warden Belk's HP (row 1, content) and Mawgrim's gated HP arm (row 4: the template's content `gated` entry,
// GATES.mawgrimHp, combat.js tplMult; content validation of `gated`).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, ev, tweak, gates, atLevel } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { zoneTime, swiftXp, swiftView } from '../../src/engine/expedition.js';
import { makeEnemy, tplMult } from '../../src/engine/combat.js';

const pet = (cls) => (cls === 'hunter' ? 'ridgewolf' : null);
/** An expedition run in zone 1's hub (without the start camp unless `prep`: then after SET_OUT). */
function expRun({ seed = 1, classId = 'mage', prep = false } = {}) {
  let s = R.step(R.newRun({ classId, petId: pet(classId), seed, content: REAL, mapMode: 'expedition', prep }), { type: 'START_RUN' }).state;
  if (prep) s = R.step(s, { type: 'SET_OUT' }).state;
  return s;
}
/** Stand on Road k of the zone, on the map, at zone toll zt (test set-up; nothing pending). */
const onRoad = (s, zt, k = 0) => tweak(s, (x) => { x.zone.pos = x.zone.roads[k]; x.zone.seen[x.zone.pos] = true; x.time = x.zone.start + zt; x.phase = 'MAP'; });
const swiftOf = (s) => Math.round(C.ROAD_SWIFT_XP_FRAC * R.xpToNext(s.player.level));
const road = { type: 'TAKE_ROAD' };

describe('M2b v15 row 2 (D124): the Swift passage, rules 1.9.7', () => {
  test('constants and switch: ROAD_SWIFT_TOLLS 15, ROAD_SWIFT_XP_FRAC 0.75, GATES.swiftRoad on', () => {
    assert.deepEqual([C.ROAD_SWIFT_TOLLS, C.ROAD_SWIFT_XP_FRAC, C.GATES.swiftRoad], [15, 0.75, true]);
  });

  test('a Road taken at zone time <= ROAD_SWIFT_TOLLS pays round(ROAD_SWIFT_XP_FRAC × xpToNext(L)) before the travel: `swift`, then its `xp` (why swift), then TIME_TRAVEL and the next hub; one more toll and it pays nothing', () => {
    for (const [seed, zt] of [[3, 0], [3, 7], [5, C.ROAD_SWIFT_TOLLS]]) {
      const s = onRoad(expRun({ seed }), zt);
      assert.equal(zoneTime(s), zt);
      const xp = swiftOf(s);
      assert.ok(xp > 0);
      const r = R.step(s, road);
      assert.deepEqual(ev(r.events, 'swift'), [{ t: 'swift', xp, zt, tolls: C.ROAD_SWIFT_TOLLS, node: s.zone.roads[0] }], `zt ${zt}`);
      assert.deepEqual(ev(r.events, 'xp'), [{ t: 'xp', amount: xp, rested: 0, why: 'swift' }]);
      const order = r.events.map((e) => e.t);
      assert.ok(order.indexOf('swift') < order.indexOf('xp') && order.indexOf('xp') < order.indexOf('time') && order.indexOf('time') < order.indexOf('travel') && order.indexOf('travel') < order.indexOf('zone'), order.join(' '));
      assert.deepEqual(ev(r.events, 'time').map((e) => [e.add, e.why]), [[C.TIME_TRAVEL, 'travel']]);
      assert.deepEqual([r.state.player.xp, r.state.player.level, r.state.time, r.state.zone.z], [s.player.xp + xp, s.player.level, s.time + C.TIME_TRAVEL, 2]);
      assert.equal(r.state.stats.xpGained, s.stats.xpGained + xp);
      const sum = R.summary(r.state).expedition;
      assert.deepEqual([sum.swift, sum.roads, sum.zones[0].swift, sum.zones[0].exit, sum.zones[0].time, sum.zones[1].swift], [1, 1, xp, 'road', zt, 0]);
    }
    const late = onRoad(expRun({ seed: 3 }), C.ROAD_SWIFT_TOLLS + 1);
    const r = R.step(late, road);
    assert.deepEqual([ev(r.events, 'swift').length, ev(r.events, 'xp').length, r.state.player.xp, r.state.zone.z], [0, 0, late.player.xp, 2]);
    assert.deepEqual([R.summary(r.state).expedition.swift, R.summary(r.state).expedition.zones[0].swift], [0, 0]);
  });

  test('level-ups apply as for any XP gain, before the travel; no rested doubling, Quick Study, Insight or heat (the formula of expedition.md 7.1)', () => {
    const s = tweak(atLevel(onRoad(expRun({ seed: 4 }), 3), 9), (x) => {
      x.player.xp = R.xpToNext(9) - 5;
      x.player.rested = 1000;
      x.meta.xpPct = 0.5;
      x.player.buffs.insight = { active: true, nodes: 3 };
    });
    const xp = swiftOf(s);
    const r = R.step(s, road);
    assert.deepEqual(ev(r.events, 'xp'), [{ t: 'xp', amount: xp, rested: 0, why: 'swift' }]);
    assert.deepEqual(ev(r.events, 'levelUp').map((e) => e.level), [10]);
    const order = r.events.map((e) => e.t);
    assert.ok(order.indexOf('levelUp') < order.indexOf('time'), 'the level-up comes before the travel');
    assert.deepEqual([r.state.player.level, r.state.player.xp, r.state.player.rested], [10, xp - 5, 1000]);
  });

  test('every zone\'s Road counts, zone 6\'s to the Camp too (once per zone: the Road leaves it); the summary counts them', () => {
    let s = expRun({ seed: 6 });
    const paid = [];
    for (let z = 1; z <= C.ZONE_COUNT; z++) {
      s = onRoad(s, 1);
      const want = swiftOf(s);
      const r = R.step(s, road);
      paid.push(ev(r.events, 'swift').map((e) => e.xp)[0] === want);
      s = r.state;
    }
    assert.deepEqual(paid, new Array(C.ZONE_COUNT).fill(true));
    assert.equal(s.phase, 'CAMP');
    const sum = R.summary(s).expedition;
    assert.equal(sum.swift, C.ZONE_COUNT);
    assert.ok(sum.zones.every((x) => x.swift > 0 && x.exit === 'road'));
  });

  test('the Homeward Bell never pays it, however soon it is rung', () => {
    const s = R.step(expRun({ seed: 2 }), { type: 'LEAVE_HUB' }).state;
    assert.ok(zoneTime(s) <= C.ROAD_SWIFT_TOLLS && R.isLegal(s, { type: 'RING_BELL' }));
    const r = R.step(s, { type: 'RING_BELL' });
    assert.equal(r.state.zone.z, 2, 'the Bell completed');
    assert.deepEqual([ev(r.events, 'swift').length, ev(r.events, 'xp').length, r.state.player.xp], [0, 0, s.player.xp]);
    assert.equal(R.summary(r.state).expedition.swift, 0);
  });

  test('mapView `swift` { tolls, frac, left, xp, eligible } on the hub and the map; heatPreview of TAKE_ROAD `swift` (the XP, null when none; null for every other action); heatView.next agrees', () => {
    const hub = expRun({ seed: 3 });
    assert.equal(hub.phase, 'ZONE_HUB');
    const xp = swiftOf(hub);
    assert.deepEqual(R.mapView(hub).swift, { tolls: C.ROAD_SWIFT_TOLLS, frac: C.ROAD_SWIFT_XP_FRAC, left: C.ROAD_SWIFT_TOLLS, xp, eligible: true });
    for (const [zt, left] of [[4, C.ROAD_SWIFT_TOLLS - 4], [C.ROAD_SWIFT_TOLLS, 0], [C.ROAD_SWIFT_TOLLS + 1, null], [40, null]]) {
      const s = onRoad(hub, zt);
      const on = left !== null;
      assert.deepEqual(R.mapView(s).swift, { tolls: C.ROAD_SWIFT_TOLLS, frac: C.ROAD_SWIFT_XP_FRAC, left, xp: on ? xp : 0, eligible: on }, `zt ${zt}`);
      assert.deepEqual([swiftView(s), swiftXp(s)], [R.mapView(s).swift, on ? xp : 0]);
      assert.equal(R.heatPreview(s, road).swift, on ? xp : null, `zt ${zt}: preview`);
      const next = R.heatView(s).next.find((n) => n.action.type === 'TAKE_ROAD');
      assert.equal(next.swift, on ? xp : null);
      for (const n of R.heatView(s).next.filter((x) => x.action.type !== 'TAKE_ROAD')) assert.equal(n.swift, null, n.action.type);
      const r = R.step(s, road);
      assert.equal(ev(r.events, 'swift').length, on ? 1 : 0, 'the view says what the Road pays');
    }
  });

  test('at MAX_LEVEL a Road pays nothing (xpToNext is 0): no event, the view says xp 0, not eligible', () => {
    const s = onRoad(tweak(expRun({ seed: 3 }), (x) => { x.player.level = C.MAX_LEVEL; x.player.xp = 0; }), 2);
    assert.deepEqual(R.mapView(s).swift, { tolls: C.ROAD_SWIFT_TOLLS, frac: C.ROAD_SWIFT_XP_FRAC, left: C.ROAD_SWIFT_TOLLS - 2, xp: 0, eligible: false });
    assert.equal(R.heatPreview(s, road).swift, null);
    const r = R.step(s, road);
    assert.deepEqual([ev(r.events, 'swift').length, ev(r.events, 'xp').length], [0, 0]);
    assert.equal(R.summary(r.state).expedition.swift, 0);
  });

  test('the default run (start camp, D116): zone time starts at the hub after SET_OUT, so the window is the whole ROAD_SWIFT_TOLLS', () => {
    const s = expRun({ seed: 8, prep: true });
    assert.deepEqual([s.phase, zoneTime(s), R.mapView(s).swift.left], ['ZONE_HUB', 0, C.ROAD_SWIFT_TOLLS]);
  });

  test('the rows map has no Swift passage: TRAVEL_ON pays nothing, its mapView has no `swift`', () => {
    const s = tweak(R.step(R.newRun({ classId: 'rogue', seed: 2, content: REAL, mapMode: 'rows' }), { type: 'START_RUN' }).state, (x) => { x.player.level = 9; });
    assert.equal('swift' in R.mapView(s), false);
    assert.equal(swiftXp(s), 0);
    const m = R.step(s, { type: 'LEAVE_HUB' }).state;
    const r = R.step(m, { type: 'TRAVEL_ON' });
    assert.deepEqual([ev(r.events, 'swift').length, ev(r.events, 'xp').length, r.state.zone.z], [0, 0, 2]);
  });

  test('debug.nextZone (dev) takes the Road without the Swift passage: the level stays as built', () => {
    const s = R.debug.build({ content: REAL, classId: 'hunter', zone: 3, mapMode: 'expedition' }).state;
    assert.ok(zoneTime(s) <= C.ROAD_SWIFT_TOLLS);
    const r = R.debug.nextZone(s);
    assert.deepEqual([r.state.zone.z, r.state.player.level, r.state.player.xp, ev(r.events, 'swift').length], [4, s.player.level, s.player.xp, 0]);
    assert.deepEqual([r.state.stats.exp.roads, r.state.stats.exp.swift], [1, 0]);
  });

  describe('with GATES.swiftRoad off', () => {
    gates({ swiftRoad: false });
    test('no XP, no event, mapView `swift` null, heatPreview `swift` null', () => {
      const s = onRoad(expRun({ seed: 3 }), 0);
      assert.equal(R.mapView(s).swift, null);
      assert.equal(R.heatPreview(s, road).swift, null);
      const r = R.step(s, road);
      assert.deepEqual([ev(r.events, 'swift').length, ev(r.events, 'xp').length, r.state.player.xp], [0, 0, s.player.xp]);
    });
  });
});

describe('M2b v15 rows 1 and 4 (D123, content): Warden Belk\'s HP; Mawgrim\'s HP arm behind GATES.mawgrimHp', () => {
  const s = R.step(R.newRun({ classId: 'rogue', seed: 1, content: REAL, mapMode: 'rows' }), { type: 'START_RUN' }).state;
  const hpOf = (tid, level) => makeEnemy(s, 0, tid, level, 'dboss').maxHp;
  const base = (level) => (C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * level) * C.ARCHETYPE.brute.hp * C.VARIANT.dboss.hp;

  test('row 1: z1_belk.hpMult 0.9: 629 HP at level 7 (734 at the old 1.05), damage unchanged', () => {
    assert.deepEqual([REAL.enemies.z1_belk.hpMult, REAL.enemies.z1_belk.dmgMult], [0.9, 1.05]);
    assert.deepEqual([hpOf('z1_belk', 7), Math.round(base(7) * 1.05)], [629, 734]);
  });

  test('row 4: z2_mawgrim is made with hpMult 1.1 while GATES.mawgrimHp is off (the default) and with its gated 0.95 while on; damage and every other template unchanged', () => {
    assert.equal(C.GATES.mawgrimHp, false);
    const lv = 17;
    const off = makeEnemy(s, 0, 'z2_mawgrim', lv, 'dboss');
    const others = Object.keys(REAL.enemies).filter((t) => t !== 'z2_mawgrim').map((t) => makeEnemy(s, 0, t, lv, 'normal'));
    assert.equal(off.maxHp, Math.max(1, Math.round(base(lv) * 1.1)));
    C.GATES.mawgrimHp = true;
    try {
      const on = makeEnemy(s, 0, 'z2_mawgrim', lv, 'dboss');
      assert.equal(on.maxHp, Math.max(1, Math.round(base(lv) * 0.95)));
      assert.equal(on.dmg, off.dmg);
      assert.deepEqual(Object.keys(REAL.enemies).filter((t) => t !== 'z2_mawgrim').map((t) => makeEnemy(s, 0, t, lv, 'normal')), others);
      assert.deepEqual([tplMult(REAL.enemies.z2_mawgrim, 'hpMult'), tplMult(REAL.enemies.z2_mawgrim, 'dmgMult'), tplMult(REAL.enemies.z1_belk, 'hpMult')], [0.95, 1, 0.9]);
    } finally { C.GATES.mawgrimHp = false; }
    assert.equal(tplMult(REAL.enemies.z2_mawgrim, 'hpMult'), 1.1);
  });

  test('content validation of `gated`: a C.GATES switch, only hpMult / dmgMult, each in its range, the product too; the real content passes (strict)', () => {
    assert.deepEqual(R.validateContent(REAL, { strict: true }), []);
    const withGated = (gated) => ({ ...REAL, enemies: { ...REAL.enemies, z2_mawgrim: { ...REAL.enemies.z2_mawgrim, gated } } });
    const errs = (gated) => R.validateContent(withGated(gated));
    assert.deepEqual(errs({ mawgrimHp: { hpMult: 0.95 }, swiftRoad: { dmgMult: 0.95 } }), []);
    assert.match(errs({ swiftRoad: { dmgMult: 1.1 } }).join(), /gated\.swiftRoad: hpMult × dmgMult: 1\.21/, 'the template\'s hpMult 1.1 with the gated dmgMult');
    assert.match(errs({ nope: { hpMult: 0.95 } }).join(), /gated\.nope: unknown switch/);
    assert.match(errs({ mawgrimHp: { armor: 2 } }).join(), /gated\.mawgrimHp\.armor: only hpMult and dmgMult/);
    assert.match(errs({ mawgrimHp: { hpMult: 0.5 } }).join(), /gated\.mawgrimHp\.hpMult: 0\.5 outside/);
    assert.match(errs({ mawgrimHp: { hpMult: 0.85, dmgMult: 0.9 } }).join(), /gated\.mawgrimHp: hpMult × dmgMult/);
    assert.match(errs({ mawgrimHp: {} }).join(), /gated\.mawgrimHp: needs hpMult or dmgMult/);
    assert.match(errs([0.95]).join(), /gated: not an object/);
  });
});
