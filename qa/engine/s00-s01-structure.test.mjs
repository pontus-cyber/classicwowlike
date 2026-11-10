// rules.md sections 0 (conventions) and 1 (run structure).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, play, atLevel, tweak, autoUntil, ev, STREAM, nextFloat } from './helpers.mjs';
import { rnd } from '../../src/engine/util.js';
import { hash32, makeRng, weightedIndex, streamSeed, nextInt } from '../../src/rng.js';
import { generateLayout, contentLevel, dungeonLevels, nextLanes, setupNode } from '../../src/engine/map.js';
import { cloneState } from '../../src/engine/util.js';
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
        assert.ok(g.slice(C.TRAINER_ROW_MIN - 1, C.TRAINER_ROW_MAX).some((row) => row.includes('trainer')), 'trainer guarantee (M2 v2)');
        for (const t of g[0]) assert.ok(!forbidden.has(t), `row 1 has ${t}`);
        g.forEach((row) => {
          for (const t of new Set(row)) if (t !== 'quest') assert.ok(row.filter((x) => x === t).length <= C.MAX_SAME_TYPE_PER_ROW);
        });
        for (const t of flat) assert.ok(C.NODE_TYPE[t]);
      }
    }
  });

  test('1.4 step 2b: the Trainer guarantee is drawn after the dungeon and the rest, before the weighted fill (M2 v2)', () => {
    let n = 0;
    for (let seed = 0; seed < 200; seed++) {
      for (let z = 1; z <= C.ZONE_COUNT; z++) {
        const rng = STREAM.map(seed, z);
        const filled = Array.from({ length: C.ZONE_CHOICE_ROWS }, () => [false, false, false]);
        const dRow = C.DUNGEON_ROW_MIN + nextInt(rng, C.DUNGEON_ROW_MAX - C.DUNGEON_ROW_MIN + 1);
        filled[dRow - 1][nextInt(rng, C.LANES)] = true;
        const cell = (min, max) => {
          const row = min + nextInt(rng, max - min + 1);
          const free = [0, 1, 2].filter((l) => !filled[row - 1][l]);
          const lane = free[nextInt(rng, free.length)];
          filled[row - 1][lane] = true;
          return [row, lane];
        };
        const [rr, rl] = cell(C.REST_ROW_MIN, C.REST_ROW_MAX);
        const [tr, tl] = cell(C.TRAINER_ROW_MIN, C.TRAINER_ROW_MAX);
        const g = generateLayout(seed, z);
        assert.equal(g[rr - 1][rl], 'rest', `seed ${seed} zone ${z} rest`);
        assert.equal(g[tr - 1][tl], 'trainer', `seed ${seed} zone ${z} trainer at row ${tr} lane ${tl}`);
        n++;
      }
    }
    assert.equal(n, 200 * C.ZONE_COUNT);
  });

  test('1.4 node setup: quest offsets, elite +ELITE_LEVEL_OFFSET, rare at RARE_CHANCE, encounter sizes 1-3', () => {
    let rare = 0;
    let elites = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = started('rogue', { seed });
      for (const row of s.zone.rows) {
        for (const n of row) {
          const base = contentLevel(1, n.r);
          if (n.type === 'quest') {
            assert.ok(n.cl - base >= -1 && n.cl - base <= 1);
            assert.ok(n.mobs.length >= 1 && n.mobs.length <= C.QUEST_MAX_SIZE_Z1, 'zone 1 cap (M2 v2)');
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

  test('2.1 zone 1 quest cap: the size draw is unchanged, its result capped at QUEST_MAX_SIZE_Z1, then mobs, the composition repair (combat v2) and the level offset are drawn (M2 v2)', () => {
    const at = cloneState(started('rogue', { seed: 1 }));
    const counts = { 1: [0, 0, 0, 0], 2: [0, 0, 0, 0] };
    let capped = 0;
    // rules 7.14 (combat v2): 2+ enemies hold 2+ archetypes; 3+ a caster, mender, skulker or beast; no guardian
    // alone with menders. A broken encounter redraws its last enemy among the valid templates (pool, else normals).
    const valid = (mobs) => {
      const a = mobs.map((x) => CONTENT.enemies[x].archetype);
      const set = new Set(a);
      if (mobs.length < 2) return true;
      if (set.size < 2) return false;
      if (mobs.length >= 3 && !a.some((x) => ['caster', 'mender', 'skulker', 'beast'].includes(x))) return false;
      return !(set.size === 2 && set.has('guardian') && set.has('mender'));
    };
    let repaired = 0;
    for (let seed = 0; seed < 300; seed++) {
      at.seed = seed;
      for (const z of [1, 2]) {
        const zn = CONTENT.zones[z - 1];
        const node = setupNode(at, z, 3, 1, 'quest');
        // Replay the node(z,r,l) stream: template, size, mobs (capped size), level offset.
        const rng = STREAM.node(seed, z, 3, 1);
        const q = CONTENT.quests[zn.quests[nextInt(rng, zn.quests.length)]];
        const drawn = 1 + weightedIndex(rng, q.sizeWeights || [C.QUEST_SIZE_W1, C.QUEST_SIZE_W2, C.QUEST_SIZE_W3]);
        const size = z === 1 ? Math.min(C.QUEST_MAX_SIZE_Z1, drawn) : drawn;
        const pool = q.enemies && q.enemies.length ? q.enemies : zn.normals;
        let mobs = Array.from({ length: size }, () => pool[nextInt(rng, pool.length)]);
        if (!valid(mobs)) {
          const rest = mobs.slice(0, -1);
          const ok = pool.filter((x) => valid([...rest, x]));
          const list = ok.length ? ok : zn.normals.filter((x) => valid([...rest, x]));
          mobs = [...rest, list[nextInt(rng, list.length)]];
          repaired++;
        }
        const off = C.QUEST_LEVEL_OFFSETS[nextInt(rng, C.QUEST_LEVEL_OFFSETS.length)];
        assert.equal(node.quest, q.id);
        assert.deepEqual(node.mobs, mobs, `seed ${seed} zone ${z}`);
        assert.ok(valid(node.mobs));
        assert.equal(node.cl, contentLevel(z, 3) + off);
        counts[z][node.mobs.length]++;
        if (z === 1 && drawn > size) capped++;
      }
    }
    assert.equal(counts[1][3], 0, 'no 3-mob quest in zone 1');
    assert.ok(capped > 0 && counts[2][3] > 0, `${capped} capped zone-1 draws; ${counts[2][3]} 3-mob quests in zone 2`);
    assert.ok(repaired > 0, 'some drawn encounters were repaired');
  });

  test('1.4 movement: hub -> any lane of row 1; then (r+1, l-1..l+1); nothing after the last row', () => {
    assert.deepEqual(nextLanes({ pos: { r: 0, l: null } }), [0, 1, 2]);
    assert.deepEqual(nextLanes({ pos: { r: 3, l: 0 } }), [0, 1]);
    assert.deepEqual(nextLanes({ pos: { r: 3, l: 1 } }), [0, 1, 2]);
    assert.deepEqual(nextLanes({ pos: { r: 3, l: 2 } }), [1, 2]);
    assert.deepEqual(nextLanes({ pos: { r: C.ZONE_CHOICE_ROWS, l: 1 } }), []);
    assert.deepEqual(nextLanes({ pos: { r: C.ZONE_CHOICE_ROWS - 1, l: 1 } }), [0, 1, 2]);
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

  test('1.5 TRAVEL_ON: legal from exit level - TRAVEL_EARLY_LEVELS (Swift Boots: one lower) or after the last row, costs HOURS_TRAVEL with any profile (M2 v4: Wayfinder removed)', () => {
    const m = R.step(started('rogue'), { type: 'LEAVE_HUB' }).state;
    assert.ok(!R.isLegal(m, { type: 'TRAVEL_ON' }));
    assert.equal(C.TRAVEL_EARLY_LEVELS, 1);
    assert.equal(R.travelLevel(m), 10 - C.TRAVEL_EARLY_LEVELS);
    assert.ok(!R.isLegal(atLevel(m, 8), { type: 'TRAVEL_ON' }), 'level 8 in zone 1: too early');
    assert.match(R.whyIllegal(atLevel(m, 8), { type: 'TRAVEL_ON' }), /reach level 9 or finish the last row/);
    const at9 = atLevel(m, 9);
    assert.ok(R.isLegal(at9, { type: 'TRAVEL_ON' }), 'one level under the exit level');
    const r = R.step(at9, { type: 'TRAVEL_ON' });
    assert.equal(r.state.hours, C.HOURS_TRAVEL);
    assert.equal(r.state.zone.z, 2);
    assert.equal(r.state.phase, 'ZONE_HUB');
    assert.equal(r.state.stats.zonesLeft, 1);
    assert.equal(R.travelLevel(R.step(r.state, { type: 'LEAVE_HUB' }).state), 20 - C.TRAVEL_EARLY_LEVELS, 'zone 2');
    const last = tweak(m, (x) => { x.zone.pos = { r: C.ZONE_CHOICE_ROWS, l: 1 }; });
    assert.deepEqual(R.legalActions(last).filter((a) => a.type === 'CHOOSE_NODE' || a.type === 'TRAVEL_ON'), [{ type: 'TRAVEL_ON' }], 'after the last row TRAVEL_ON is the only move');
    // Swift Boots alone; and a profile saved before M2 v4 that still owns Wayfinder: travel costs HOURS_TRAVEL for both.
    for (const unlocks of [{ swift_boots: 1 }, { wayfinder: 1, swift_boots: 1 }]) {
      const way = R.step(started('rogue', { profile: { ...R.newProfile(), unlocks } }), { type: 'LEAVE_HUB' }).state;
      assert.equal(R.travelLevel(way), 10 - C.TRAVEL_EARLY_LEVELS - C.META.swift_boots.levels);
      assert.ok(!R.isLegal(atLevel(way, 7), { type: 'TRAVEL_ON' }));
      const at8 = atLevel(way, 8);
      assert.ok(R.isLegal(at8, { type: 'TRAVEL_ON' }), 'Swift Boots: exit level - 2');
      const t = R.step(at8, { type: 'TRAVEL_ON' });
      assert.equal(t.state.hours, C.HOURS_TRAVEL, `${Object.keys(unlocks)}: TRAVEL_ON costs HOURS_TRAVEL`);
      assert.deepEqual(t.events.filter((e) => e.t === 'hours').map((e) => [e.add, e.why]), [[C.HOURS_TRAVEL, 'travel']]);
    }
    // Full catalogue: TRAVEL_ON costs HOURS_TRAVEL from every zone, the last one to the Camp included.
    const full = { ...R.newProfile(), unlocks: Object.fromEntries(Object.values(C.META).map((x) => [x.id, x.ranks])), reachedBoss: true, bossKills: 1 };
    for (let z = 1; z <= C.ZONE_COUNT; z++) {
      const m2 = tweak(atLevel(R.step(started('mage', { profile: full }), { type: 'LEAVE_HUB' }).state, 60), (x) => { x.zone.z = z; });
      assert.equal(R.step(m2, { type: 'TRAVEL_ON' }).state.hours, C.HOURS_TRAVEL, `zone ${z}`);
    }
    assert.equal(R.travelLevel(R.newRun({ classId: 'rogue', content: CONTENT })), null, 'no zone in CREATE');
  });

  test('1.5 / 1.6 Z6 travels to the Camp; camp grind waves at level 58 cost 1 h and can repeat', () => {
    let s = R.step(started('hunter'), { type: 'LEAVE_HUB' }).state;
    s = tweak(atLevel(s, 60), (x) => { x.zone.z = 6; });
    s = R.step(s, { type: 'TRAVEL_ON' }).state;
    assert.equal(s.phase, 'CAMP');
    assert.equal(R.travelLevel(s), null, 'no travel level at the Camp');
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
