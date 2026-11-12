// docs/specs/changes-m2b-v11.md engine rows 1-4 and 8 (D91-D94, D98; rules 1.9.6, 1.9.8, 5.6, 8.4; expedition.md 6.3, 13)
// and the meta catalogue of expedition.md 8.2 (rules 11.2): the expedition kill loot weight and dungeon boss rolls, the
// Delve's price, the Dimmed encounter's tolls, Beastcall Horn's cooldown as a named constant (gated, not applied), the
// expedition entries in the catalogue (Cartographer, Old Hand, Quartermaster) and the expedition effects of Scout's Eye
// (Pathfinder) and Swift Boots (a Bell charge) in runs with the start camp; rows runs unchanged.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, STREAM, nextFloat, ev, tweak } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { killDropMult, bossDropRolls } from '../../src/engine/expedition.js';

const pet = (cls) => (cls === 'hunter' ? 'ridgewolf' : null);
const prof = (unlocks) => ({ ...R.newProfile(), unlocks });
/** A started run (after START_RUN): rows, expedition, or expedition at the start camp (prep). */
function startedRun(mode, { seed = 1, classId = 'rogue', profile = null, prep = false } = {}) {
  const o = { classId, petId: pet(classId), seed, content: REAL, profile, mapMode: mode === 'expedition' ? 'expedition' : 'rows' };
  if (mode === 'expedition') o.prep = !!prep; // D116: prep is newRun's default on the expedition map
  return R.step(R.newRun(o), { type: 'START_RUN' }).state;
}
/** Kill one enemy by template id in a dev fight (engine-api.md 12: loot on STREAM.dev(seed, 0, 1)); the loot events. */
function devKill(s, id) {
  let r = R.debug.encounter(s, { ids: [id] });
  const all = [...r.events];
  while (r.state.fight) { r = R.debug.killTarget(r.state); all.push(...r.events); }
  return ev(all, 'loot').map((e) => e.item);
}

describe('M2b v11 rows 1-2 (D91, D92): expedition kill loot × EXPED_DROP_MULT, EXPED_DUNGEON_BOSS_DROPS boss rolls', () => {
  test('mode helpers: rows × 1 and DUNGEON_BOSS_DROPS; expedition EXPED_DROP_MULT and EXPED_DUNGEON_BOSS_DROPS', () => {
    const rows = startedRun('rows');
    const exp = startedRun('expedition');
    assert.deepEqual([killDropMult(rows), bossDropRolls(rows)], [1, C.DUNGEON_BOSS_DROPS]);
    assert.deepEqual([killDropMult(exp), bossDropRolls(exp)], [C.EXPED_DROP_MULT, C.EXPED_DUNGEON_BOSS_DROPS]);
  });

  test('8.4: a normal and a dungeon-trash kill drop an item below min(1, chance × m) and junk below min(1, MOB_JUNK_CHANCE × m); m = 1 rows, EXPED_DROP_MULT expedition; same draws', () => {
    const z = REAL.zones[0];
    let more = 0;
    for (const [id, table] of [[z.normals[0], 'mob'], [z.dungeon.trash[0], 'trash']]) {
      for (let seed = 1; seed <= 40; seed++) {
        const g = STREAM.dev(seed, 0, 1);
        const [rItem, rJunk] = [nextFloat(g), nextFloat(g)];
        for (const mode of ['rows', 'expedition']) {
          const m = mode === 'rows' ? 1 : C.EXPED_DROP_MULT;
          const items = devKill(startedRun(mode, { seed }), id);
          const want = [rItem < Math.min(1, C.DROP_TABLE[table].item * m), rJunk < Math.min(1, C.DROP_TABLE[table].junk * m)];
          assert.deepEqual([items.some((x) => x.kind === 'gear'), items.some((x) => x.kind === 'junk')], want, `${mode} ${table} seed ${seed}`);
          if (mode === 'expedition' && (rItem >= C.DROP_TABLE[table].item || rJunk >= C.DROP_TABLE[table].junk) && (want[0] || want[1])) more++;
        }
      }
    }
    assert.ok(more > 0, 'some kill drops only with the expedition weight');
  });

  test('8.4: a Grind node of an expedition zone: the first kill drops below min(1, MOB_ITEM_CHANCE × GRIND_DROP_MULT × EXPED_DROP_MULT) on loot(z, id)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 60 && checked < 6; seed++) {
      let s = startedRun('expedition', { seed, classId: 'mage' });
      s = R.step(s, { type: 'LEAVE_HUB' }).state;
      const v = R.mapView(s);
      const mv = v.moves.find((m) => m.via === 'enter' && v.nodes[m.nodeId].type === 'grind');
      if (!mv) continue;
      s = R.step(s, { type: 'MOVE', nodeId: mv.nodeId }).state;
      if (!s.fight) s = R.step(s, R.autoAction(s)).state; // an engage choice first, when one is offered
      if (!s.fight) continue;
      assert.equal(s.fight.dropMult, C.GRIND_DROP_MULT);
      const g = STREAM.lootId(seed, 1, mv.nodeId);
      const [rItem, rJunk] = [nextFloat(g), nextFloat(g)];
      const first = R.debug.killTarget(s).state;
      const drops = first.fight ? first.fight.drops : null;
      if (!drops) continue; // the wave had one enemy: the fight ended (checked by the dev kills above)
      const m = C.GRIND_DROP_MULT * C.EXPED_DROP_MULT;
      assert.deepEqual([drops.some((x) => x.kind === 'gear'), drops.some((x) => x.kind === 'junk')],
        [rItem < Math.min(1, C.MOB_ITEM_CHANCE * m), rJunk < Math.min(1, C.MOB_JUNK_CHANCE * m)], `seed ${seed} node ${mv.nodeId}`);
      checked++;
    }
    assert.ok(checked >= 3, `grind nodes checked: ${checked}`);
  });

  test('2.4, 8.4: a dungeon boss rolls DUNGEON_BOSS_DROPS times on the rows map and EXPED_DUNGEON_BOSS_DROPS times on the expedition map', () => {
    const boss = REAL.zones[0].dungeon.boss;
    for (let seed = 1; seed <= 3; seed++) {
      for (const [mode, n] of [['rows', C.DUNGEON_BOSS_DROPS], ['expedition', C.EXPED_DUNGEON_BOSS_DROPS]]) {
        const items = devKill(startedRun(mode, { seed }), boss);
        assert.equal(items.length, n, `${mode} seed ${seed}`);
        assert.ok(items.every((x) => x.kind === 'gear' && ['rare', 'epic'].includes(x.rarity)));
      }
    }
  });
});

describe('M2b v11 rows 3, 4 and 8 (D93, D94, D98)', () => {
  test('row 3: a Delve costs CONTRACT.delve.price on the board and the hub (1 in v11; 2 again since M2b v12, D100)', () => {
    assert.equal(C.CONTRACT.delve.price, 2);
    let seen = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const v = R.prepView(startedRun('expedition', { seed, prep: true }));
      for (const o of v.board.filter((x) => x.kind === 'delve')) { assert.equal(o.price, C.CONTRACT.delve.price); seen++; }
    }
    assert.ok(seen > 0);
  });

  test('row 4: a Dimmed encounter costs TIME_DIM_FIGHT 2 tolls (the `time` event why "dim")', () => {
    assert.equal(C.TIME_DIM_FIGHT, 2);
    let s = startedRun('expedition', { seed: 3 });
    s = R.step(s, { type: 'LEAVE_HUB' }).state;
    // a walk onto a resolved neighbour of the hub when every node is Dimmed: the walk, then the Dimmed encounter
    // (M2b v12: a neighbour no farther from the Shardfall, so the encounter is not an escape)
    const zone = s.zone;
    const nb = zone.nodes[0].nb.find((id) => zone.shardDist[id] <= zone.shardDist[0]);
    s = tweak(s, (x) => { x.zone.nodes[nb].done = true; x.zone.start = x.time - 40; }); // zone toll 40: every node Dimmed
    const r = R.step(s, { type: 'MOVE', nodeId: nb });
    const dim = ev(r.events, 'time').filter((e) => e.why === 'dim');
    assert.equal(dim.length, 1);
    assert.equal(dim[0].add, C.TIME_DIM_FIGHT);
  });

  test('row 8 (void since M2b v12, D100): SPELL.beastcall_horn.cd = BEASTCALL_HORN_CD 12, no gated switch; the engine reads the field at each cast', () => {
    assert.equal(C.BEASTCALL_HORN_CD, 12);
    assert.equal('BEASTCALL_HORN_CD_GATED' in C, false, 'the gated switch is removed (M2b v12 row 1)');
    assert.equal(C.SPELL.beastcall_horn.cd, C.BEASTCALL_HORN_CD);
    const castAt = () => {
      let s = startedRun('rows', { classId: 'hunter', seed: 4 });
      s = tweak(s, (x) => { x.player.level = 40; x.player.spells.beastcall_horn = { tl: 40, rank: 1 }; x.player.spellOrder.push('beastcall_horn'); x.player.bar[5] = 'beastcall_horn'; });
      let r = R.debug.encounter(s, { ids: [REAL.zones[0].normals[0]], level: 40 });
      s = tweak(r.state, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; });
      if (s.fight.engage) s = R.step(s, R.autoAction(s)).state;
      r = R.step(s, { type: 'CAST', spellId: 'beastcall_horn', target: null });
      return r.state.fight.p.cds.beastcall_horn - s.fight.round;
    };
    assert.equal(castAt(), C.BEASTCALL_HORN_CD);
    try {
      C.SPELL.beastcall_horn.cd = 15;
      assert.equal(castAt(), 15);
    } finally {
      C.SPELL.beastcall_horn.cd = C.BEASTCALL_HORN_CD;
    }
  });
});

describe('expedition.md 8.2 (rules 11.2): the expedition entries of the catalogue (M2b v11 build)', () => {
  test('catalogue: Cartographer 100, Old Hand 150, Quartermaster 120 / 200 with mapMode expedition; Scout\'s Eye and Swift Boots carry their expedition effect; total 7 130', () => {
    const M = C.META;
    assert.deepEqual([M.cartographer.costs, M.old_hand.costs, M.quartermaster.costs], [[C.META_COST_CARTOGRAPHER], [C.META_COST_OLD_HAND], [C.META_COST_QM_1, C.META_COST_QM_2]]);
    assert.deepEqual([C.META_COST_CARTOGRAPHER, C.META_COST_OLD_HAND, C.META_COST_QM_1, C.META_COST_QM_2], [100, 150, 120, 200]);
    assert.deepEqual(Object.values(M).filter((m) => m.mapMode === 'expedition').map((m) => m.id).sort(), ['cartographer', 'old_hand', 'quartermaster']);
    assert.deepEqual(Object.keys(C.META_EXPEDITION).sort(), ['cartographer', 'old_hand', 'quartermaster']);
    for (const id of Object.keys(C.META_EXPEDITION)) assert.equal(C.META_EXPEDITION[id], M[id], `${id}: the same object`);
    assert.equal(M.quartermaster.ranks, 2);
    assert.equal(M.quartermaster.points, C.PREP_POINTS_PER_QM);
    assert.deepEqual([M.cartographer.perk, M.old_hand.perk], ['prep_charts', 'prep_tracker']);
    assert.deepEqual(M.scout.expedition, { name: 'Pathfinder', typeRadius: C.PATHFINDER_RADIUS });
    assert.deepEqual(M.swift_boots.expedition, { bell: 1 });
    const total = Object.values(M).reduce((n, m) => n + m.costs.reduce((a, b) => a + b, 0), 0);
    assert.equal(total, 7130);
    let p = prof({}); p.echoes = 1000;
    p = R.buyMeta(R.buyMeta(R.buyMeta(p, 'cartographer'), 'quartermaster'), 'quartermaster');
    assert.deepEqual([p.unlocks.cartographer, p.unlocks.quartermaster, p.echoes], [1, 2, 1000 - 100 - 120 - 200]);
    assert.throws(() => R.buyMeta(p, 'quartermaster'), /not available/);
  });

  test('with the start camp: Quartermaster points, Cartographer and Old Hand owned, Scout\'s Eye as Pathfinder, Swift Boots +1 Bell charge (the Second Clapper then refused)', () => {
    const all = prof({ scout: 1, swift_boots: 1, cartographer: 1, old_hand: 1, quartermaster: 2 });
    let s = startedRun('expedition', { seed: 2, profile: all, prep: true });
    // D128: the camp offers C.PREP_CAMP_OPTIONS only; the Guide and the Second Clapper are read with every option offered
    const camp = C.PREP_CAMP_OPTIONS.splice(0, C.PREP_CAMP_OPTIONS.length, ...C.PREP_OPTION_IDS);
    let v;
    try { v = R.prepView(s); } finally { C.PREP_CAMP_OPTIONS.splice(0, C.PREP_CAMP_OPTIONS.length, ...camp); }
    assert.equal(v.points, C.PREP_POINTS + 2 * C.PREP_POINTS_PER_QM);
    const opt = (id) => v.options.find((o) => o.id === id);
    assert.deepEqual([opt('prep_charts').owned, opt('prep_tracker').owned, opt('prep_guide').owned], [true, true, false]);
    assert.equal(opt('prep_bell').canBuy, false);
    assert.match(opt('prep_bell').why, /at most 2/);
    assert.deepEqual(R.prepView(s).options.filter((o) => o.owned).map((o) => o.id), ['prep_charts', 'prep_tracker'], 'the camp shows both owned');
    s = R.step(s, { type: 'SET_OUT' }).state;
    const mv = R.mapView(s);
    assert.equal(mv.vision.typeRadius, C.PATHFINDER_RADIUS);
    assert.equal(mv.vision.regions, true);
    assert.equal(mv.bell.charges, Math.min(C.BELL_MAX_CHARGES, C.BELL_START_CHARGES + 1));
    // node types within PATHFINDER_RADIUS hops are known (type only), farther ones are not
    for (const n of mv.nodes) if (n.know === 'none') assert.ok(n.hops > C.PATHFINDER_RADIUS, `node ${n.id}`);
    assert.ok(mv.nodes.some((n) => n.know === 'type'));
    // a fresh profile: none of it
    let f = startedRun('expedition', { seed: 2, prep: true });
    assert.equal(R.prepView(f).points, C.PREP_POINTS);
    f = R.step(f, { type: 'SET_OUT' }).state;
    assert.deepEqual([R.mapView(f).vision.typeRadius, R.mapView(f).bell.charges], [0, C.BELL_START_CHARGES]);
  });

  test('without the start camp an expedition run has none of the expedition effects (as before); a rows run keeps Scout\'s Eye and Swift Boots as rules 11.2', () => {
    const all = prof({ scout: 1, swift_boots: 1, cartographer: 1, old_hand: 1, quartermaster: 2 });
    let s = startedRun('expedition', { seed: 2, profile: all });
    s = R.step(s, { type: 'LEAVE_HUB' }).state;
    const mv = R.mapView(s);
    assert.deepEqual([mv.vision.typeRadius, mv.vision.regions, mv.bell.charges], [0, false, C.BELL_START_CHARGES]);
    const rows = startedRun('rows', { seed: 2, profile: all });
    assert.equal(rows.meta.scout, true);
    assert.equal(rows.meta.swiftBoots, true);
    assert.deepEqual(Object.keys(rows.meta).filter((k) => /cartographer|old_?hand|quartermaster|pathfinder/i.test(k)), [], 'no state.meta flag for the expedition entries');
  });

  test('rows runs are unchanged by the expedition entries: a profile with them plays every step as without them (autoplay, 3 classes × 2 seeds)', () => {
    const base = { vigor: 2, edge: 2, satchel: 1, scout: 1, swift_boots: 1, ledger: 1 };
    const strip = (e) => JSON.stringify(e, (k, x) => (k === 'profileHash' || k === 'profile' ? undefined : x));
    for (const classId of ['rogue', 'mage', 'hunter']) {
      for (const seed of [11, 12]) {
        const run = (unlocks) => {
          let s = startedRun('rows', { seed, classId, profile: prof(unlocks) });
          const out = [];
          for (let n = 0; n < 20000 && s.phase !== 'ENDED'; n++) { const r = R.step(s, R.autoAction(s)); out.push(strip(r.events)); s = r.state; }
          return { out, meta: s.meta, sum: strip(R.summary(s)) };
        };
        const a = run(base);
        const b = run({ ...base, cartographer: 1, old_hand: 1, quartermaster: 2 });
        assert.equal(a.out.length, b.out.length, `${classId} ${seed}: steps`);
        assert.deepEqual(a.out, b.out, `${classId} ${seed}: events`);
        assert.deepEqual(a.meta, b.meta, `${classId} ${seed}: state.meta`);
        assert.equal(a.sum, b.sum, `${classId} ${seed}: summary`);
      }
    }
  });
});
