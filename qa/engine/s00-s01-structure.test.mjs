// rules.md sections 0 (conventions) and 1 (run structure).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, play, atLevel, tweak, autoUntil, ev, STREAM, nextFloat } from './helpers.mjs';
import { rnd } from '../../src/engine/util.js';
import { hash32, makeRng, weightedIndex, streamSeed } from '../../src/rng.js';
import { generateLayout, contentLevel, dungeonLevels, nextLanes } from '../../src/engine/map.js';
import { ascendancy } from '../../src/engine/nodes.js';

describe('rules 0 conventions', () => {
  test('0 integers: rounding is half away from zero at the end of a formula', () => {
    assert.equal(rnd(2.5), 3);
    assert.equal(rnd(-2.5), -3);
    assert.equal(rnd(2.49), 2);
    assert.equal(rnd(0.6 * 2.5), 2); // 1.5 -> 2 despite float noise
  });

  test('0 RNG: a stream is a pure function of its keys; different keys give different streams', () => {
    const a = STREAM.map(7, 1);
    const b = STREAM.map(7, 1);
    const c = STREAM.map(7, 2);
    const da = [nextFloat(a), nextFloat(a), nextFloat(a)];
    assert.deepEqual(da, [nextFloat(b), nextFloat(b), nextFloat(b)]);
    assert.notDeepEqual(da, [nextFloat(c), nextFloat(c), nextFloat(c)]);
    assert.equal(streamSeed(7, 'map', 1), hash32('7|map|1'));
    for (const x of da) assert.ok(x >= 0 && x < 1);
  });

  test('0 RNG: generator state is plain JSON and resumes exactly after a round trip', () => {
    const g = makeRng(123);
    nextFloat(g);
    const copy = JSON.parse(JSON.stringify(g));
    assert.equal(nextFloat(g), nextFloat(copy));
  });

  test('0 RNG: weighted draws never pick a zero weight', () => {
    const g = makeRng(5);
    for (let i = 0; i < 2000; i++) assert.notEqual(weightedIndex(g, [3, 0, 1]), 1);
  });

  test('0 consequence: the map and a node loot stream do not depend on how earlier fights were played', () => {
    const base = started('mage', { seed: 99 });
    const s1 = autoUntil(base, (s) => s.phase === 'NODE' && !s.fight);
    // Same seed, but fight the first node only with basic attacks.
    let s2 = play(base, [{ type: 'LEAVE_HUB' }]).state;
    const lane = R.mapView(s2).next[0];
    s2 = play(s2, [{ type: 'CHOOSE_NODE', lane }]).state;
    let guard = 0;
    while (s2.fight && guard++ < 500) {
      const t = s2.fight.enemies.find((e) => e.alive).idx;
      s2 = R.step(s2, { type: 'ATTACK', target: t }).state;
    }
    const strip = (rows) => JSON.stringify(rows.map((r) => r.map((n) => ({ ...n, done: false, stock: n.stock ? n.stock.length : null }))));
    assert.equal(strip(s1.zone.rows), strip(s2.zone.rows));
    // loot(z,r,l) is created fresh at node entry: identical for any history.
    const a = STREAM.loot(99, 1, 3, 1);
    const b = STREAM.loot(99, 1, 3, 1);
    assert.equal(nextFloat(a), nextFloat(b));
  });
});

describe('rules 1 run structure', () => {
  test('1.1 phases: CREATE -> ZONE_HUB -> MAP -> NODE -> MAP', () => {
    let s = R.newRun({ content: CONTENT, seed: 3 });
    assert.equal(s.phase, 'CREATE');
    s = play(s, [{ type: 'SELECT_CLASS', classId: 'rogue' }, { type: 'SET_NAME', name: 'Ash' }, { type: 'SET_SEED', seed: 77 }, { type: 'START_RUN' }]).state;
    assert.equal(s.phase, 'ZONE_HUB');
    assert.equal(s.player.name, 'Ash');
    assert.equal(s.seed, 77);
    s = R.step(s, { type: 'LEAVE_HUB' }).state;
    assert.equal(s.phase, 'MAP');
    s = R.step(s, { type: 'CHOOSE_NODE', lane: 0 }).state;
    assert.equal(s.phase, 'NODE');
    s = autoUntil(s, (x) => x.phase === 'MAP');
    assert.equal(s.phase, 'MAP');
  });

  test('1.1 out-of-combat actions are legal in hub, map and between fights, never during a fight', () => {
    const s = started('rogue');
    const eq = { type: 'SET_BAR', slot: 3, spellId: 'gutting_jab' };
    assert.ok(R.isLegal(s, eq));
    const m = R.step(s, { type: 'LEAVE_HUB' }).state;
    assert.ok(R.isLegal(m, eq));
    const f = R.step(m, { type: 'CHOOSE_NODE', lane: R.mapView(m).next[0] }).state;
    if (f.fight) {
      assert.ok(!R.isLegal(f, eq));
      assert.match(R.whyIllegal(f, eq), /not allowed during a fight/);
      assert.ok(R.isLegal(f, { type: 'SET_AUTOPLAY', on: true }));
    }
  });

  test('1.2 character creation: level 1, full HP, start gold, gear, rations, two level-1 spells on slots 1-2', () => {
    for (const c of C.CLASS_IDS) {
      const s = started(c);
      const p = s.player;
      assert.equal(p.level, 1);
      assert.equal(p.xp, 0);
      assert.equal(p.hp, p.d.maxHp);
      assert.equal(p.mana, p.d.maxMana);
      assert.equal(p.gold, C.START_GOLD);
      assert.equal(p.equipped.weapon.rarity, 'common');
      assert.equal(p.equipped.weapon.ilvl, 1);
      assert.equal(p.equipped.chest.ilvl, 1);
      assert.equal(p.equipped.weapon.name, CONTENT.classes[c].startWeapon);
      assert.equal(p.bag.find((x) => x.id === 'trail_rations').qty, C.START_RATIONS);
      assert.deepEqual(p.bar.slice(0, 2), C.CLASS[c].startSpells);
      for (const id of C.CLASS[c].startSpells) assert.deepEqual(p.spells[id], { tl: 1, rank: 1 });
      assert.equal(p.bar.length, C.SPELL_BAR_SLOTS);
      assert.equal(p.itemBar.length, C.ITEM_BAR_SLOTS);
    }
  });

  test('1.2 / 11.4 meta unlocks are applied at creation', () => {
    const profile = { ...R.newProfile(), unlocks: { satchel: 1, heirloom_blade: 1, pockets: 2, vigor: 3, second_breath: 1 } };
    const s = started('hunter', { profile });
    const plain = started('hunter');
    assert.equal(s.player.bag.find((x) => x.id === 'healing_draught').qty, C.META.satchel.potions);
    assert.equal(s.player.equipped.weapon.rarity, 'uncommon');
    assert.equal(s.player.equipped.weapon.ilvl, 3);
    assert.equal(s.meta.bagSlots, 8);
    assert.ok(s.player.d.maxHp > plain.player.d.maxHp);
    assert.equal(s.player.res.meta, C.RES_META_CHARGES);
  });

  test('1.3 zones: six bands of ten levels, exit level 10 × z', () => {
    for (let z = 1; z <= C.ZONE_COUNT; z++) {
      assert.equal(contentLevel(z, 1), C.ZONE_LEVELS * (z - 1) + 1);
      assert.equal(contentLevel(z, C.ZONE_CHOICE_ROWS), C.ZONE_LEVELS * z, 'the last row is at the exit level');
    }
  });

  test('1.4 content level of row r: Z1 rows 1..7 are 1,2,4,5,7,8,10 (M2 v2); dungeon levels', () => {
    assert.equal(C.ZONE_CHOICE_ROWS, 7);
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((r) => contentLevel(1, r)), [1, 2, 4, 5, 7, 8, 10]);
    assert.deepEqual(dungeonLevels(1), { trash: 1 + C.DUNGEON_LEVEL_OFFSET, boss: 1 + C.DUNGEON_LEVEL_OFFSET + C.DUNGEON_BOSS_LEVEL_OFFSET });
    assert.deepEqual(dungeonLevels(1), { trash: 5, boss: 7 });
    assert.deepEqual(dungeonLevels(6), { trash: 55, boss: 57 });
  });

  test('1.4 map generation constraints hold over 300 seeds × 6 zones', () => {
    const forbidden = new Set(C.ROW1_FORBIDDEN);
    for (let seed = 0; seed < 300; seed++) {
      for (let z = 1; z <= 6; z++) {
        const g = generateLayout(seed, z);
        assert.equal(g.length, C.ZONE_CHOICE_ROWS);
        const flat = g.flat();
        assert.equal(flat.filter((t) => t === 'dungeon').length, 1, 'exactly one dungeon');
        const dRow = g.findIndex((row) => row.includes('dungeon')) + 1;
        assert.ok(dRow >= C.DUNGEON_ROW_MIN && dRow <= C.DUNGEON_ROW_MAX);
        assert.ok(g.slice(C.REST_ROW_MIN - 1, C.REST_ROW_MAX).some((row) => row.includes('rest')), 'rest guarantee');
        for (const t of g[0]) assert.ok(!forbidden.has(t), `row 1 has ${t}`);
        g.forEach((row) => {
          for (const t of new Set(row)) if (t !== 'quest') assert.ok(row.filter((x) => x === t).length <= C.MAX_SAME_TYPE_PER_ROW);
        });
        for (const t of flat) assert.ok(C.NODE_TYPE[t]);
      }
    }
  });

  test('1.4 node setup: quest offsets, elite +2, rare at RARE_CHANCE, encounter sizes 1-3', () => {
    let rare = 0;
    let elites = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = started('rogue', { seed });
      for (const row of s.zone.rows) {
        for (const n of row) {
          const base = contentLevel(1, n.r);
          if (n.type === 'quest') {
            assert.ok(n.cl - base >= -1 && n.cl - base <= 1);
            assert.ok(n.mobs.length >= 1 && n.mobs.length <= 3);
            for (const m of n.mobs) assert.ok(CONTENT.zones[0].normals.includes(m));
          }
          if (n.type === 'elite') {
            elites++;
            if (n.rare) rare++;
            assert.equal(n.eliteLevel, base + C.ELITE_LEVEL_OFFSET);
            assert.ok((n.rare ? CONTENT.zones[0].rares : CONTENT.zones[0].elites).includes(n.elite));
          }
        }
      }
    }
    assert.ok(elites > 50);
    assert.ok(rare / elites > 0.08 && rare / elites < 0.35, `rare share ${rare / elites}`);
  });

  test('1.4 movement: hub -> any lane of row 1; then (r+1, l-1..l+1); nothing after row 8', () => {
    assert.deepEqual(nextLanes({ pos: { r: 0, l: null } }), [0, 1, 2]);
    assert.deepEqual(nextLanes({ pos: { r: 3, l: 0 } }), [0, 1]);
    assert.deepEqual(nextLanes({ pos: { r: 3, l: 1 } }), [0, 1, 2]);
    assert.deepEqual(nextLanes({ pos: { r: 3, l: 2 } }), [1, 2]);
    assert.deepEqual(nextLanes({ pos: { r: 8, l: 1 } }), []);
    const s = R.step(started('mage'), { type: 'LEAVE_HUB' }).state;
    assert.ok(!R.isLegal(tweak(s, (x) => { x.zone.pos = { r: 2, l: 0 }; }), { type: 'CHOOSE_NODE', lane: 2 }));
  });

  test('1.4 hub services: each once per visit, hours trainer 1, vendor 1, inn 4', () => {
    let s = started('rogue');
    s = play(s, [{ type: 'SERVICE', service: 'trainer' }, { type: 'LEAVE' }]).state;
    assert.equal(s.hours, C.HOURS_TRAINER);
    assert.ok(!R.isLegal(s, { type: 'SERVICE', service: 'trainer' }));
    s = play(s, [{ type: 'SERVICE', service: 'vendor' }, { type: 'LEAVE' }]).state;
    assert.equal(s.hours, C.HOURS_TRAINER + C.HOURS_VENDOR);
    s = tweak(s, (x) => { x.player.hp = 1; });
    s = R.step(s, { type: 'SERVICE', service: 'inn' }).state;
    assert.equal(s.hours, C.HOURS_TRAINER + C.HOURS_VENDOR + C.HOURS_REST);
    assert.equal(s.player.hp, s.player.d.maxHp);
    assert.ok(!R.isLegal(s, { type: 'SERVICE', service: 'inn' }));
  });

  test('1.5 TRAVEL_ON: legal at exit level or after row 8, costs HOURS_TRAVEL; Wayfinder 0 h; Swift Boots one level early', () => {
    const m = R.step(started('rogue'), { type: 'LEAVE_HUB' }).state;
    assert.ok(!R.isLegal(m, { type: 'TRAVEL_ON' }));
    const at10 = atLevel(m, 10);
    assert.ok(R.isLegal(at10, { type: 'TRAVEL_ON' }));
    const r = R.step(at10, { type: 'TRAVEL_ON' });
    assert.equal(r.state.hours, C.HOURS_TRAVEL);
    assert.equal(r.state.zone.z, 2);
    assert.equal(r.state.phase, 'ZONE_HUB');
    assert.equal(r.state.stats.zonesLeft, 1);
    const row8 = tweak(m, (x) => { x.zone.pos = { r: 8, l: 1 }; });
    assert.deepEqual(R.legalActions(row8).filter((a) => a.type === 'CHOOSE_NODE' || a.type === 'TRAVEL_ON'), [{ type: 'TRAVEL_ON' }]);
    const way = R.step(started('rogue', { profile: { ...R.newProfile(), unlocks: { wayfinder: 1, swift_boots: 1 } } }), { type: 'LEAVE_HUB' }).state;
    const at9 = atLevel(way, 9);
    assert.ok(R.isLegal(at9, { type: 'TRAVEL_ON' }), 'Swift Boots: exit level - 1');
    assert.equal(R.step(at9, { type: 'TRAVEL_ON' }).state.hours, 0, 'Wayfinder: 0 hours');
  });

  test('1.5 / 1.6 Z6 travels to the Camp; camp grind waves at level 58 cost 1 h and can repeat', () => {
    let s = R.step(started('hunter'), { type: 'LEAVE_HUB' }).state;
    s = tweak(atLevel(s, 60), (x) => { x.zone.z = 6; });
    s = R.step(s, { type: 'TRAVEL_ON' }).state;
    assert.equal(s.phase, 'CAMP');
    const h = s.hours;
    s = R.step(s, { type: 'CAMP_GRIND' }).state;
    assert.equal(s.hours, h + C.HOURS_GRIND_WAVE);
    assert.ok(s.fight);
    assert.equal(s.fight.kind, 'camp');
    assert.ok(s.fight.enemies.every((e) => e.level === C.CAMP_GRIND_LEVEL));
    assert.equal(s.fight.enemies.length, C.GRIND_WAVE_SIZE);
    s = autoUntil(s, (x) => !x.fight);
    if (s.phase === 'CAMP') assert.ok(R.isLegal(s, { type: 'CAMP_GRIND' }) && R.isLegal(s, { type: 'FIGHT_BOSS' }));
  });

  test('1.7 Ascendancy: 0.04 per full 10 h over par BOSS_TIME_PAR, capped at 0.40; Oath of Haste lowers par by 20', () => {
    const par = C.BOSS_TIME_PAR;
    const cases = [[par - 30, 0], [par, 0], [par + 9, 0], [par + 10, 0.04], [par + 20, 0.08], [par + 99, 0.36], [500, 0.4]];
    for (const [hours, asc] of cases) assert.equal(ascendancy({ hours, oaths: [] }), asc, `${hours} h`);
    assert.equal(ascendancy({ hours: par - C.OATH_HASTE_HOURS + 10, oaths: ['haste'] }), 0.04);
  });

  test('1.7 boss HP and damage scale with (1 + asc)', () => {
    let s = R.step(started('rogue'), { type: 'LEAVE_HUB' }).state;
    s = tweak(atLevel(s, 60), (x) => { x.zone.z = 6; x.hours = C.BOSS_TIME_PAR + 30 - C.HOURS_TRAVEL; });
    s = play(s, [{ type: 'TRAVEL_ON' }, { type: 'FIGHT_BOSS' }]).state;
    const asc = 0.12;
    assert.equal(s.stats.asc, asc);
    assert.equal(s.fight.enemies[0].maxHp, Math.round(C.BOSS_HP * (1 + asc)));
    assert.equal(s.fight.enemies[0].asc, asc);
  });

  test('1.8 trade-offs are emergent (covered by the node, item and boss tests); events report hours for every node', () => {
    const s = R.step(started('mage'), { type: 'LEAVE_HUB' }).state;
    const r = R.step(s, { type: 'CHOOSE_NODE', lane: 0 });
    const type = s.zone.rows[0][0].type;
    const want = { quest: C.HOURS_QUEST, grind: 0, treasure: C.HOURS_TREASURE, shrine: C.HOURS_SHRINE }[type];
    assert.equal(ev(r.events, 'hours').reduce((n, e) => n + e.add, 0), want);
  });
});
