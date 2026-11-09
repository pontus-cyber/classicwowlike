// QA rule tests, rules.md sections 1 (map, hub, camp) and 2 (node types): the parts qa/engine/ does not
// assert (draw frequencies, exact XP of quest turn-in, grind waves and dungeon clears, hours of a stopped
// grind, loot kept on DUNGEON_LEAVE, trap damage, shrine boon weights).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, play, atLevel, tweak, ev, cloneState, enterNode, winFight, setupNode, xpOf, hoursOf } from './helpers.mjs';
import { generateLayout, contentLevel, dungeonLevels } from '../../src/engine/map.js';
import { xpToNext, diffMod } from '../../src/engine/progress.js';
import { V } from '../../src/engine/items.js';
import { STREAM, nextFloat } from '../../src/rng.js';

/** setupNode reads only the seed, content and meta of a state: one started run, re-seeded per sample. */
function seeded(classId = 'rogue') {
  const base = cloneState(started(classId, { seed: 1 }));
  return (seed) => { base.seed = seed; return base; };
}
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(3)} vs ${want.toFixed(3)} (±${tol})`);

describe('rules 1.4 map generation and visibility', () => {
  test('1.4 step 3: node types in rows without forced cells follow the weights W_*', () => {
    // Rows 2, 7 and 8 never hold the dungeon (rows 4-6) or the rest guarantee (rows 3-5), and row 1 rules do not apply.
    const counts = {};
    let cells = 0;
    for (let seed = 0; seed < 400; seed++) for (let z = 1; z <= C.ZONE_COUNT; z++) {
      const g = generateLayout(seed, z);
      for (const r of [2, 7, 8]) for (const t of g[r - 1]) { counts[t] = (counts[t] || 0) + 1; cells++; }
    }
    const total = Object.values(C.NODE_TYPE).filter((t) => t.id !== 'dungeon').reduce((n, t) => n + t.weight, 0);
    assert.equal(counts.dungeon || 0, 0, 'no dungeon outside step 1');
    for (const t of Object.values(C.NODE_TYPE)) {
      if (t.id === 'dungeon') continue;
      // MAX_SAME_TYPE_PER_ROW re-draws lower the quest share by about 0.02; other types move less than 0.01.
      near((counts[t.id] || 0) / cells, t.weight / total, t.id === 'quest' ? 0.035 : 0.015, `share of ${t.id}`);
    }
  });

  test('1.4 node offsets: quest CL + one of -1, 0, 0, +1 (uniform), elite CL + 2; never above 60 (zone 6 rows 7-8)', () => {
    const offs = { '-1': 0, 0: 0, 1: 0 };
    let n = 0;
    const at = seeded();
    for (let seed = 0; seed < 300; seed++) {
      const s = at(seed);
      for (let r = 1; r <= C.ZONE_CHOICE_ROWS; r++) {
        const q = setupNode(s, 2, r, 1, 'quest');
        offs[q.cl - contentLevel(2, r)] += 1;
        n++;
        assert.equal(setupNode(s, 2, r, 1, 'elite').eliteLevel, contentLevel(2, r) + C.ELITE_LEVEL_OFFSET);
      }
      for (const r of [7, 8]) {
        assert.ok(setupNode(s, 6, r, 0, 'quest').cl <= C.MAX_LEVEL);
        assert.ok(setupNode(s, 6, r, 0, 'elite').eliteLevel <= C.MAX_LEVEL);
      }
    }
    near(offs[-1] / n, 0.25, 0.04, 'offset -1');
    near(offs[0] / n, 0.5, 0.04, 'offset 0');
    near(offs[1] / n, 0.25, 0.04, 'offset +1');
  });

  test('1.4 the whole map is visible on entry: type and level of every node, quest titles, one archetype per enemy; rare elites hidden', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = R.step(started('hunter', { seed }), { type: 'LEAVE_HUB' }).state;
      const mv = R.mapView(s);
      assert.equal(mv.rows.length, C.ZONE_CHOICE_ROWS);
      mv.rows.forEach((row, ri) => row.forEach((n, l) => {
        const node = s.zone.rows[ri][l];
        assert.equal(n.type, node.type);
        assert.equal(n.cl, node.cl);
        if (node.type === 'quest') {
          assert.equal(n.title, CONTENT.quests[node.quest].title);
          assert.equal(n.archetypes.length, node.mobs.length, 'one archetype per quest enemy (the player can count them)');
        }
        if (node.type === 'grind') assert.equal(n.archetypes.length, C.GRIND_WAVE_SIZE);
        if (node.type === 'elite') {
          assert.equal(n.rare, null, 'rare elites stay hidden without Scout\'s Eye');
          assert.equal(n.archetypes.length, node.add ? 2 : 1, 'the add is shown');
        }
      }));
    }
  });

  test('1.4 hub vendor stock is at the zone band minimum; 1.6 the camp vendor is at content level 60', () => {
    for (let z = 1; z <= C.ZONE_COUNT; z++) {
      let s = tweak(atLevel(started('mage', { seed: 21 }), C.ZONE_LEVELS * (z - 1) + 1), (x) => { x.zone.z = z; x.player.gold = 1e6; });
      s = R.step(s, { type: 'SERVICE', service: 'vendor' }).state;
      const cl = C.ZONE_LEVELS * (z - 1) + 1;
      assert.equal(s.service.cl, cl, `zone ${z}`);
      assert.equal(s.service.stock.find((e) => e.id === 'healing_draught').price, Math.round(C.PRICE_HEAL_V * V(cl)));
      for (const g of s.service.stock.filter((e) => e.kind === 'gear')) assert.equal(g.item.ilvl, cl + C.RARITY_ILVL_BONUS[g.item.rarity]);
    }
    let c = R.step(started('rogue', { seed: 21 }), { type: 'LEAVE_HUB' }).state;
    c = tweak(atLevel(c, 60), (x) => { x.zone.z = 6; x.player.gold = 1e6; });
    c = play(c, [{ type: 'TRAVEL_ON' }, { type: 'SERVICE', service: 'vendor' }]).state;
    assert.equal(c.phase, 'CAMP');
    assert.equal(c.service.cl, C.MAX_LEVEL);
    assert.equal(c.service.stock.find((e) => e.id === 'healing_draught').price, Math.round(C.PRICE_HEAL_V * V(60)));
  });
});

describe('rules 2 node rewards and rules', () => {
  test('2.1 quest turn-in XP = round(QUEST_TURNIN_XP_FRAC × xpToNext(CL) × diffMod(CL - L)), at, above and below the quest level', () => {
    for (const [L, cl] of [[5, 5], [5, 7], [9, 5], [9, 3]]) {
      const { state } = enterNode(started('mage', { seed: 31 }), 'quest', { level: L, patch: (n) => { n.mobs = ['z1_brute']; n.cl = cl; } });
      const { events } = winFight(tweak(state, (x) => { x.player.rested = 0; }));
      assert.equal(ev(events, 'questComplete').length, 1);
      assert.equal(xpOf(events, 'quest'), Math.round(C.QUEST_TURNIN_XP_FRAC * xpToNext(cl) * diffMod(cl - L)), `L${L} quest CL${cl}`);
    }
  });

  test('2.1 quest encounters use the zone\'s normal templates; sizes follow the quest\'s weights (fixture: QUEST_SIZE_W*)', () => {
    const sizes = [0, 0, 0];
    const at = seeded();
    for (let seed = 0; seed < 2000; seed++) {
      const n = setupNode(at(seed), 1, 1 + (seed % 8), seed % 3, 'quest');
      if (CONTENT.quests[n.quest].sizeWeights) continue;
      sizes[n.mobs.length - 1] += 1;
      for (const m of n.mobs) assert.ok(CONTENT.zones[0].normals.includes(m));
    }
    const tot = sizes.reduce((a, b) => a + b, 0);
    const w = C.QUEST_SIZE_W1 + C.QUEST_SIZE_W2 + C.QUEST_SIZE_W3;
    near(sizes[0] / tot, C.QUEST_SIZE_W1 / w, 0.05, '1 mob');
    near(sizes[1] / tot, C.QUEST_SIZE_W2 / w, 0.05, '2 mobs');
    near(sizes[2] / tot, C.QUEST_SIZE_W3 / w, 0.05, '3 mobs');
  });

  test('2.2 grind: wave bonus XP is exact; a grind stopped after wave 1 of 3 costs one hour and completes the node', () => {
    const L = 6;
    let { state: s, events } = enterNode(started('hunter', { seed: 32 }), 'grind', { level: L, r: 4 });
    const cl = s.node.cl;
    s = R.step(s, { type: 'GRIND_SET_WAVES', n: 3 }).state;
    const h0 = s.hours;
    assert.equal(h0 - hoursOf(events), C.HOURS_GRIND_WAVE, 'the first wave costs its hour when it starts');
    const w = winFight(tweak(s, (x) => { x.player.rested = 0; }));
    assert.equal(xpOf(w.events, 'wave'), Math.round(C.GRIND_WAVE_XP_FRAC * xpToNext(cl) * diffMod(cl - L)));
    assert.equal(w.state.node.stage, 'between');
    const stop = R.step(w.state, { type: 'GRIND_STOP' });
    assert.equal(stop.state.phase, 'MAP');
    assert.equal(stop.state.hours, h0, 'waves that never started cost nothing');
    assert.ok(stop.state.zone.rows[s.node.r - 1][s.node.l].done);
  });

  test('2.3 elite node set-up: add at ELITE_ADD_CHANCE, rare at RARE_CHANCE; elites carry 1 ability, rares 2 (rules 12.2)', () => {
    let adds = 0;
    let rares = 0;
    const N = 3000;
    const at = seeded();
    for (let i = 0; i < N; i++) {
      const n = setupNode(at(i), 1 + (i % 6), 2 + (i % 7), i % 3, 'elite');
      if (n.add) adds++;
      if (n.rare) rares++;
      const t = CONTENT.enemies[n.elite];
      assert.equal(t.abilities.length, n.rare ? 2 : 1, n.elite);
    }
    near(adds / N, C.ELITE_ADD_CHANCE, 0.03, 'add share');
    near(rares / N, C.RARE_CHANCE, 0.03, 'rare share');
  });

  test('2.3 rare elite kill XP = RARE_XP_MULT × MOB_XP_FRAC × xpToNext(level) × diffMod; rare loot is rare or epic', () => {
    const { state } = enterNode(started('mage', { seed: 33 }), 'elite', { level: 12, r: 6, patch: (n) => { n.rare = true; n.elite = 'z1_rare'; n.add = null; } });
    const lvl = state.fight.enemies[0].level;
    const { events } = winFight(tweak(state, (x) => { x.player.rested = 0; }));
    assert.equal(xpOf(events, 'kill'), Math.round(C.MOB_XP_FRAC * C.RARE_XP_MULT * xpToNext(lvl) * diffMod(lvl - 12)));
    const gear = ev(events, 'loot').filter((e) => e.item.kind === 'gear');
    assert.ok(gear.length >= 1 && gear.every((e) => ['rare', 'epic'].includes(e.item.rarity)), JSON.stringify(gear.map((e) => e.item.rarity)));
  });

  test('2.4 dungeon trash fights hold 2 or 3 enemies, about half each (DUNGEON_SIZE_W2 / W3)', () => {
    const sizes = { 2: 0, 3: 0 };
    const at = seeded();
    for (let i = 0; i < 1500; i++) for (const f of setupNode(at(i), 1 + (i % 6), 4 + (i % 3), i % 3, 'dungeon').trash) sizes[f.length] += 1;
    near(sizes[2] / (sizes[2] + sizes[3]), C.DUNGEON_SIZE_W2 / (C.DUNGEON_SIZE_W2 + C.DUNGEON_SIZE_W3), 0.03, 'two-enemy share');
  });

  test('2.4 DUNGEON_LEAVE keeps the loot so far and the hours; the clear gives DUNGEON_CLEAR_XP_FRAC × xpToNext(boss level) × diffMod', () => {
    const L = 8;
    let s;
    let w;
    let got = [];
    for (let seed = 34; seed < 80 && !got.length; seed++) {
      s = enterNode(started('rogue', { seed }), 'dungeon', { level: L, r: 4 }).state;
      w = winFight(s);
      got = ev(w.events, 'loot').map((e) => e.item.uid);
    }
    assert.ok(got.length, 'a first trash fight that drops loot');
    const h = s.hours;
    const left = R.step(w.state, { type: 'DUNGEON_LEAVE' }).state;
    assert.equal(left.phase, 'MAP');
    assert.equal(left.hours, h, 'no hours refunded');
    assert.equal(left.stats.dungeons, 0, 'not cleared');
    for (const uid of got) assert.ok(left.player.bag.some((b) => b.uid === uid) || w.state.player.bag.every((b) => b.uid !== uid), `loot ${uid} kept`);
    assert.ok(got.some((uid) => left.player.bag.some((b) => b.uid === uid)));
    // Clear the whole dungeon and check the clear XP.
    s = w.state;
    let pre = s;
    for (let k = 1; k <= C.DUNGEON_TRASH_FIGHTS; k++) { pre = R.step(s, { type: 'NEXT_FIGHT' }).state; w = winFight(tweak(pre, (x) => { x.player.rested = 0; })); s = w.state; }
    const boss = dungeonLevels(1).boss;
    assert.equal(pre.fight.kind, 'dboss');
    assert.equal(ev(w.events, 'dungeonClear').length, 1);
    // XP uses the level at the moment of the event: the boss kill XP may level the character first.
    let lvl = pre.player.level;
    let found = false;
    for (const e of w.events) {
      if (e.t === 'levelUp') lvl = e.level;
      if (e.t === 'xp' && e.why === 'dungeon') { assert.equal(e.amount, Math.round(C.DUNGEON_CLEAR_XP_FRAC * xpToNext(boss) * diffMod(boss - lvl))); found = true; break; }
    }
    assert.ok(found, 'a dungeon clear XP event');
  });

  test('2.8 treasure: guard at TREASURE_GUARD_CHANCE, trap at TREASURE_TRAP_CHANCE (first draw of loot(z,r,l)), trap takes 15 % of max HP', () => {
    let guards = 0;
    let traps = 0;
    const N = 3000;
    const at = seeded();
    for (let i = 0; i < N; i++) {
      const s = at(i);
      const n = setupNode(s, 1, 3, 1, 'treasure');
      if (n.guard) guards++;
      if (n.trap) traps++;
      assert.equal(n.trap, nextFloat(STREAM.loot(s.seed, 1, 3, 1)) < C.TREASURE_TRAP_CHANCE);
    }
    near(guards / N, C.TREASURE_GUARD_CHANCE, 0.03, 'guard share');
    near(traps / N, C.TREASURE_TRAP_CHANCE, 0.02, 'trap share');
    // A trapped, unguarded chest: damage = round(TREASURE_TRAP_PCT × max HP).
    for (let seed = 0; seed < 400; seed++) {
      const r = enterNode(started('mage', { seed }), 'treasure', { level: 10, patch: (n) => { n.guard = null; } });
      const t = ev(r.events, 'trap');
      if (!t.length) continue;
      assert.equal(t[0].amount, Math.round(C.TREASURE_TRAP_PCT * r.state.player.d.maxHp));
      assert.equal(r.state.player.hp, r.state.player.d.maxHp - t[0].amount);
      return;
    }
    assert.fail('no trapped chest in 400 seeds');
  });

  test('2.9 shrine: two different boons drawn by weight without replacement (Return and Clarity half as likely)', () => {
    const ids = Object.keys(C.BOON);
    const w = Object.fromEntries(ids.map((b) => [b, C.BOON[b].weight]));
    const T = Object.values(w).reduce((a, b) => a + b, 0);
    const expect = Object.fromEntries(ids.map((b) => [b, w[b] / T + ids.filter((j) => j !== b).reduce((n, j) => n + (w[j] / T) * (w[b] / (T - w[j])), 0)]));
    const seen = Object.fromEntries(ids.map((b) => [b, 0]));
    const N = 4000;
    const at = seeded('hunter');
    for (let i = 0; i < N; i++) {
      const n = setupNode(at(i), 1 + (i % 6), 1 + (i % 8), i % 3, 'shrine');
      assert.equal(new Set(n.boons).size, 2);
      for (const b of n.boons) seen[b] += 1;
    }
    for (const b of ids) near(seen[b] / N, expect[b], 0.035, `P(${b} offered)`);
  });

  test('2.9 Boon of Insight: +BOON_XP_PCT on XP in the next BOON_NODES nodes entered, not in the shrine node itself', () => {
    let { state: s } = enterNode(started('mage', { seed: 35 }), 'shrine', { level: 5, patch: (n) => { n.boons = ['insight', 'plenty']; } });
    s = R.step(s, { type: 'CHOOSE_REWARD', index: 0 }).state;
    assert.deepEqual(s.player.buffs.insight, { left: C.BOON_NODES, active: false });
    s = tweak(s, (x) => { x.zone.rows[1][0] = { ...setupNode(x, 1, 2, 0, 'quest'), mobs: ['z1_brute'], cl: 5 }; x.zone.pos = { r: 1, l: 0 }; x.player.rested = 0; });
    s = R.step(s, { type: 'CHOOSE_NODE', lane: 0 }).state;
    assert.ok(s.player.buffs.insight.active);
    const { events } = winFight(s);
    assert.equal(xpOf(events, 'quest'), Math.round(C.QUEST_TURNIN_XP_FRAC * xpToNext(5) * (1 + C.BOON_XP_PCT)));
  });
});
