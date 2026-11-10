// rules.md sections 8 (items) and 9 (death and resurrection).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, atLevel, withSpells, inFight, tweak, forceDraws, ev, st, cloneState, play } from './helpers.mjs';
import { rollDrop, V, itemScore, sellValue, bagCapacity } from '../../src/engine/items.js';
import { makeRng, nextU32 } from '../../src/rng.js';

const mob = (tid = 'z1_brute', level = 20, variant = 'normal') => ({ tid, level, variant });
function rolls(classId, table, level, n, profile) {
  const s = cloneState(started(classId, { profile }));
  const g = makeRng(77);
  const out = [];
  for (let i = 0; i < n; i++) out.push(...rollDrop(s, g, table, level, 1));
  return { items: out, s };
}

describe('rules 8 items', () => {
  test('8.1 / 8.3 generated gear: ilvl, budget, stat split, affix, weapon damage and armor follow the formulas', () => {
    const { items } = rolls('rogue', 'treasure', 30, 600);
    let checked = 0;
    for (const it of items) {
      if (it.kind !== 'gear') continue;
      const R0 = C.RARITY[it.rarity];
      const sw = C.SLOT[it.slot].slotW;
      assert.equal(it.ilvl, Math.min(C.ILVL_MAX, 30 + R0.ilvlBonus));
      const B = Math.round(it.ilvl * C.BUDGET_PER_ILVL * sw * R0.mult + 1e-9);
      const A = R0.affix ? Math.round(C.AFFIX_SHARE * B + 1e-9) : 0;
      const S = B - A;
      const stats = it.stats.AGI + it.stats.INT + it.stats.STA + it.stats.SPI;
      assert.equal(stats, S, `${it.rarity} ${it.slot}`);
      const prim = Math.max(it.stats.AGI, it.stats.INT);
      if (R0.stats === 2) assert.equal(prim, Math.round(C.SPLIT2_MAIN * S + 1e-9));
      if (R0.stats === 3) { assert.equal(prim, Math.round(C.SPLIT3_MAIN * S + 1e-9)); assert.equal(it.stats.STA, Math.round(C.SPLIT3_SECOND * S + 1e-9)); }
      if (it.affix === 'crit') assert.ok(Math.abs(it.crit - C.AFFIX_CRIT_PCT * sw * (it.rarity === 'epic' ? C.AFFIX_EPIC_MULT : 1)) < 1e-12);
      if (it.affix === 'power') assert.equal(it.power, C.AFFIX_POWER_PER_PT * A);
      if (it.affix === 'armor') assert.equal(it.bonusArmor, C.AFFIX_ARMOR_PER_PT * A);
      assert.equal(!!it.affix, !!R0.affix);
      assert.equal(it.wd, it.slot === 'weapon' ? Math.round((C.WEAPON_DMG_BASE + C.WEAPON_DMG_PER_ILVL * it.ilvl) * R0.mult + 1e-9) : 0);
      assert.equal(it.armor, C.SLOT[it.slot].armor ? Math.round(C.ARMOR_PER_ILVL * it.ilvl * sw * R0.mult + 1e-9) : 0);
      assert.ok(it.name.length > 0);
      checked++;
    }
    assert.ok(checked > 500);
  });

  test('8.2 rarity: common 1 stat, uncommon 2, rare 2 + affix, epic 3 + affix; ilvl bonus rare +1, epic +3; max ILVL_MAX', () => {
    const { items } = rolls('mage', 'mob', 62, 3000);
    const seen = {};
    for (const it of items.filter((x) => x.kind === 'gear')) {
      seen[it.rarity] = true;
      assert.ok(it.ilvl <= C.ILVL_MAX);
      if (it.rarity === 'common') assert.equal([it.stats.AGI, it.stats.INT, it.stats.STA, it.stats.SPI].filter((x) => x > 0).length <= 1, true);
    }
    assert.ok(seen.common && seen.uncommon && seen.rare);
  });

  test('8.3 primary stat leans to the class (DROP_CLASS_BIAS); item score weights', () => {
    const { items } = rolls('mage', 'quest', 40, 1500);
    const two = items.filter((x) => x.kind === 'gear');
    const share = two.filter((x) => x.stats.INT > x.stats.AGI).length / two.length;
    assert.ok(Math.abs(share - C.DROP_CLASS_BIAS) < 0.06, `share ${share}`);
    const it = { kind: 'gear', stats: { AGI: 10, INT: 5, STA: 4, SPI: 2 }, power: 3, crit: 0.02, armor: 50, bonusArmor: 10, wd: 7 };
    assert.ok(Math.abs(itemScore(it, 'rogue') - (10 + 4 * 0.6 + 2 * 0.3 + 3 * 1.1 + 2 * 1.5 + 60 * 0.02 + 7 * 2)) < 1e-9);
    assert.ok(Math.abs(itemScore(it, 'mage') - (5 + 4 * 0.6 + 2 * 0.3 + 3 * 1.1 + 2 * 1.5 + 60 * 0.02)) < 1e-9, 'Mage: WD scores 0, wrong primary scores 0');
  });

  test('8.4 drop tables: item and junk chances, rarity weights, order of draws (2 draws when nothing drops)', () => {
    const N = 6000;
    const { items } = rolls('hunter', 'mob', 20, N);
    const gear = items.filter((x) => x.kind === 'gear');
    const junk = items.filter((x) => x.kind === 'junk');
    assert.ok(Math.abs(gear.length / N - C.MOB_ITEM_CHANCE) < 0.02);
    assert.ok(Math.abs(junk.length / N - C.MOB_JUNK_CHANCE) < 0.025);
    const rare = gear.filter((x) => x.rarity === 'rare').length / gear.length;
    assert.ok(Math.abs(rare - 0.05) < 0.025);
    assert.equal(gear.filter((x) => x.rarity === 'epic').length, 0);
    const el = rolls('hunter', 'elite', 20, 1000).items;
    assert.equal(el.filter((x) => x.kind === 'gear').length, 1000, 'elite: guaranteed item');
    assert.equal(el.filter((x) => x.kind === 'junk').length, 1000, 'elite: guaranteed junk');
    const db = rolls('hunter', 'dboss', 20, 1000).items;
    assert.ok(db.every((x) => x.kind === 'gear' && ['rare', 'epic'].includes(x.rarity)));
    // A roll that yields nothing consumes exactly the item and junk draws.
    const s = cloneState(started('mage'));
    let g;
    for (let i = 0; ; i++) { g = makeRng(i); const p = g.slice(); const a = nextU32(p) / 4294967296; const b = nextU32(p) / 4294967296; if (a >= C.MOB_ITEM_CHANCE && b >= C.MOB_JUNK_CHANCE) break; }
    const ref = g.slice();
    nextU32(ref); nextU32(ref);
    assert.deepEqual(rollDrop(s, g, 'mob', 10, 1), []);
    assert.deepEqual(g, ref);
  });

  test('8.4 elites can drop an Ember of Return (EMBER_ELITE_DROP_CHANCE); uniques replace items at UNIQUE_DROP_CHANCE with the unlock', () => {
    const { items } = rolls('rogue', 'rare', 20, 2000, { ...R.newProfile(), unlocks: { cache: 1 } });
    const uniques = items.filter((x) => x.unique);
    assert.equal(uniques.length, 1, 'a unique drops once per run');
    assert.equal(uniques[0].unique, 'u_rare_z1');
    assert.equal(uniques[0].rarity, 'rare');
    const none = rolls('rogue', 'rare', 20, 500).items.filter((x) => x.unique);
    assert.equal(none.length, 0, 'no unlock, no uniques');
    let embers = 0;
    for (let seed = 0; seed < 300; seed++) {
      let s = withSpells(atLevel(started('rogue', { seed }), 40), []);
      s = inFight(s, [mob('z1_elite', 3, 'elite')], { kind: 'elite' }).state;
      s = tweak(s, (x) => { x.fight.enemies[0].hp = 1; x.fight.enemies[0].dodge = 0; });
      const c = cloneState(s);
      forceDraws(c, 3, (d) => d[0] > 0.9);
      const r = R.step(c, { type: 'ATTACK', target: 0 });
      if (r.events.some((e) => e.t === 'loot' && e.item.id === 'ember_of_return')) embers++;
    }
    assert.ok(embers >= 3 && embers <= 30, `embers ${embers}/300`);
  });

  test('8.5 gold: V(1) = 13, V(30) = 503, V(60) = 1404; sell = V(ilvl) × slotW × sell mult; junk JUNK_V × V(level)', () => {
    assert.equal(V(1), 13);
    assert.equal(V(30), 503);
    assert.equal(V(60), 1404);
    const s = started('rogue');
    const it = { kind: 'gear', slot: 'hands', rarity: 'rare', ilvl: 20 };
    assert.equal(sellValue(s, it), Math.round(V(20) * 0.75 * 2.5));
    assert.equal(sellValue(s, { kind: 'junk', level: 30, qty: 2 }), 2 * Math.round(C.JUNK_V * V(30)));
  });

  test('8.6 consumables out of combat: Trail Rations restore 40 % HP, mana and pet HP; Elixir +10 % damage for 3 nodes', () => {
    let s = tweak(atLevel(started('hunter'), 20), (x) => { x.player.hp = 1; x.player.pet.hp = 1; x.player.bag.push({ uid: 'e', kind: 'cons', id: 'elixir_ferocity', qty: 1 }); });
    s = R.step(s, { type: 'USE_ITEM', itemId: 'trail_rations' }).state;
    assert.equal(s.player.hp, 1 + Math.round(C.RATION_PCT * s.player.d.maxHp));
    assert.equal(s.player.pet.hp, 1 + Math.round(C.RATION_PCT * s.player.d.petMaxHp));
    s = R.step(s, { type: 'USE_ITEM', itemId: 'elixir_ferocity' }).state;
    assert.deepEqual(s.player.buffs.elixir, { left: C.ELIXIR_NODES, active: false });
    assert.ok(!R.isLegal(s, { type: 'USE_ITEM', itemId: 'spark_flask' }));
  });

  test('8.6 Ember of Return: at most EMBER_MAX_CARRIED; Greater Healing Draught sold with Alchemist\'s Notes', () => {
    let s = tweak(started('rogue', { profile: { ...R.newProfile(), unlocks: { alchemist: 1, satchel: 1 } } }), (x) => { x.player.gold = 1e6; });
    s = R.step(s, { type: 'SERVICE', service: 'vendor' }).state;
    assert.ok(s.service.stock.some((e) => e.id === 'greater_healing_draught'));
    s = tweak(s, (x) => { x.service.stock.push({ kind: 'cons', id: 'ember_of_return', price: 1, sold: false }); x.player.bag.push({ uid: 'em', kind: 'cons', id: 'ember_of_return', qty: 1 }); });
    assert.match(R.whyIllegal(s, { type: 'BUY', index: s.service.stock.length - 1 }), /at most 1/);
  });

  test('8.7 bag: 16 slots (+4 per Deeper Pockets rank); stacks 5/10/10; overflow goes to the loot window, which blocks progress', () => {
    const s0 = started('rogue');
    assert.equal(bagCapacity(s0), C.BAG_SLOTS);
    assert.equal(bagCapacity(started('rogue', { profile: { ...R.newProfile(), unlocks: { pockets: 2 } } })), C.BAG_SLOTS + 8);
    let s = tweak(R.step(s0, { type: 'LEAVE_HUB' }).state, (x) => {
      while (x.player.bag.length < C.BAG_SLOTS) x.player.bag.push({ uid: `j${x.player.bag.length}`, kind: 'junk', name: `J${x.player.bag.length}`, level: 1, qty: 1 });
      x.loot = [{ uid: 'L1', kind: 'gear', slot: 'ring', rarity: 'common', ilvl: 1, name: 'R', stats: { AGI: 0, INT: 0, STA: 0, SPI: 0 }, power: 0, crit: 0, armor: 0, bonusArmor: 0, wd: 0, affix: null, unique: null, effect: null }];
    });
    assert.match(R.whyIllegal(s, { type: 'CHOOSE_NODE', lane: 0 }), /loot window/);
    assert.match(R.whyIllegal(s, { type: 'LOOT_TAKE', itemId: 'L1' }), /bag is full/);
    s = R.step(s, { type: 'DISCARD', itemId: 'j3' }).state;
    s = R.step(s, { type: 'LOOT_TAKE', itemId: 'L1' }).state;
    assert.equal(s.loot.length, 0);
    assert.ok(R.isLegal(s, { type: 'CHOOSE_NODE', lane: 0 }));
    // stacking
    const t = tweak(s0, (x) => { x.player.bag = []; });
    const add = (it) => import('../../src/engine/items.js').then(({ addToBag }) => addToBag(t, it));
    return Promise.all([
      add({ uid: 'p1', kind: 'cons', id: 'healing_draught', qty: 7 }),
    ]).then(() => {
      assert.deepEqual(t.player.bag.map((x) => x.qty), [C.STACK_POTION, 2]);
    });
  });
});

describe('rules 9 death and resurrection', () => {
  const lethal = (s) => tweak(s, (x) => { x.player.hp = 1; x.fight.enemies[0].intent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, heavy: false, school: 'magic', cd: 0, pct: 50, hits: 1, target: 'player', est: 1 }; x.fight.p.st.push({ id: 'CURSED', dur: 3 }); });
  const fightAt = (profile, prep) => {
    let s = withSpells(atLevel(started('mage', { profile, seed: 5 }), 20), []);
    s = inFight(s, [mob('z1_brute', 20)]).state;
    return lethal(prep ? tweak(s, prep) : s);
  };
  const die = (s) => { const c = cloneState(s); forceDraws(c, 3, (d) => d[0] > 0.2); return R.step(c, { type: 'PASS' }); };

  test('9 resurrect charges are used in order Boon of Return, Second Breath, Ember; return at 40 % HP / mana, debuffs removed', () => {
    const prof = { ...R.newProfile(), unlocks: { second_breath: 1 } };
    let r = die(fightAt(prof, (x) => { x.player.res.boon = 1; x.player.bag.push({ uid: 'em', kind: 'cons', id: 'ember_of_return', qty: 1 }); }));
    assert.equal(ev(r.events, 'resurrect')[0].source, 'boon');
    assert.equal(r.state.player.hp, Math.round(C.RES_HP_PCT * r.state.player.d.maxHp));
    const mm = r.state.player.d.maxMana;
    assert.equal(r.state.player.mana, Math.round(C.RES_MANA_PCT * mm) + Math.round(C.MANA_REGEN_ROUND_PCT * mm), 'then the round ends (mana regen)');
    assert.ok(!st(r.state.fight.p.st, 'CURSED'));
    assert.ok(r.state.fight, 'same fight continues');
    r = die(fightAt(prof, (x) => { x.player.bag.push({ uid: 'em', kind: 'cons', id: 'ember_of_return', qty: 1 }); }));
    assert.equal(ev(r.events, 'resurrect')[0].source, 'second_breath');
    r = die(fightAt(null, (x) => { x.player.bag.push({ uid: 'em', kind: 'cons', id: 'ember_of_return', qty: 1 }); }));
    assert.equal(ev(r.events, 'resurrect')[0].source, 'ember');
    assert.ok(!r.state.player.bag.some((x) => x.id === 'ember_of_return'));
  });

  test('9 Second Breath is not used in the end-boss fight (M2 v3): the next charge in the order is used, or the run ends', () => {
    const prof = { ...R.newProfile(), unlocks: { second_breath: 1 }, reachedBoss: true };
    const ember = (x) => x.player.bag.push({ uid: 'em', kind: 'cons', id: 'ember_of_return', qty: 1 });
    // A level-60 mage at the end boss (round 1: Umbral Strike) with 1 HP.
    const atBoss = (prep) => {
      let s = R.step(started('mage', { seed: 5, profile: prof }), { type: 'LEAVE_HUB' }).state;
      s = tweak(atLevel(s, 60), (x) => { x.zone.z = 6; x.hours = 100; });
      s = play(s, [{ type: 'TRAVEL_ON' }, { type: 'FIGHT_BOSS' }]).state;
      assert.equal(s.fight.kind, 'boss');
      return tweak(s, (x) => { x.player.hp = 1; if (prep) prep(x); });
    };
    const bossDie = (s) => { const c = cloneState(s); forceDraws(c, 3, (d) => d[0] > 0.2 && d[1] > 0.1); return R.step(c, { type: 'PASS' }); };
    // Only Second Breath: the run ends, the charge stays unused.
    let r = bossDie(atBoss());
    assert.equal(ev(r.events, 'resurrect').length, 0);
    assert.equal(r.state.phase, 'SUMMARY');
    assert.equal(r.state.outcome, 'death');
    assert.equal(r.state.death.nodeType, 'boss');
    assert.equal(r.state.player.res.meta, C.RES_META_CHARGES, 'Second Breath unused');
    assert.equal(R.summary(r.state).resurrectsUsed, 0);
    // Second Breath and an Ember: the Ember is used.
    r = bossDie(atBoss(ember));
    assert.equal(ev(r.events, 'resurrect')[0].source, 'ember');
    assert.equal(r.state.player.res.meta, C.RES_META_CHARGES);
    assert.ok(r.state.fight);
    // Boon of Return first, as on the journey.
    r = bossDie(atBoss((x) => { x.player.res.boon = 1; ember(x); }));
    assert.equal(ev(r.events, 'resurrect')[0].source, 'boon');
    // On the journey it works in every other fight: dungeon boss and Camp wave.
    for (const kind of ['dboss', 'camp']) {
      let s = withSpells(atLevel(started('mage', { seed: 5, profile: prof }), 20), []);
      s = lethal(inFight(s, [mob('z1_dboss', 20, 'dboss')], { kind }).state);
      r = die(s);
      assert.equal(ev(r.events, 'resurrect')[0].source, 'second_breath', kind);
      assert.equal(r.state.player.res.meta, C.RES_META_CHARGES - 1);
    }
  });

  test('9 resurrectCharges(state): counts, and the order used now and in the end-boss fight (M2 v3)', () => {
    const prof = { ...R.newProfile(), unlocks: { second_breath: 1 }, reachedBoss: true };
    assert.equal(R.resurrectCharges(R.newRun({ classId: 'mage', content: CONTENT, profile: prof })), null, 'CREATE');
    const s = tweak(started('mage', { profile: prof }), (x) => { x.player.res.boon = 1; x.player.bag.push({ uid: 'em', kind: 'cons', id: 'ember_of_return', qty: 1 }); });
    const sb = new Array(C.RES_META_CHARGES).fill('second_breath');
    assert.deepEqual(R.resurrectCharges(s), { boon: 1, secondBreath: C.RES_META_CHARGES, ember: 1, now: ['boon', ...sb, 'ember'], boss: ['boon', 'ember'] });
    const inBoss = tweak(s, (x) => { x.fight = { kind: 'boss' }; });
    assert.deepEqual(R.resurrectCharges(inBoss).now, ['boon', 'ember']);
    const inDungeon = tweak(s, (x) => { x.fight = { kind: 'dboss' }; });
    assert.deepEqual(R.resurrectCharges(inDungeon).now, ['boon', ...sb, 'ember']);
    const frail = tweak(s, (x) => { x.oaths = ['frailty']; });
    assert.deepEqual(R.resurrectCharges(frail), { boon: 1, secondBreath: C.RES_META_CHARGES, ember: 1, now: [], boss: [] });
  });

  test('9 no charge left: the run ends in SUMMARY with the death location recorded', () => {
    const r = die(fightAt(null));
    assert.equal(r.state.phase, 'SUMMARY');
    assert.equal(r.state.outcome, 'death');
    const d = r.state.death;
    assert.equal(d.zone, 1);
    assert.equal(d.nodeType, 'quest');
    assert.equal(d.fightIdx, 0);
    assert.deepEqual(d.enemies, ['z1_brute']);
    assert.equal(d.killer.idx, 0);
    assert.equal(d.killer.ability, 'strike');
    assert.equal(typeof d.round, 'number');
    const sum = R.summary(r.state);
    assert.equal(sum.outcome, 'death');
    for (const k of ['level', 'hours', 'kills', 'damage', 'topSpells', 'equipped', 'echoes', 'minutes', 'nodes', 'gold', 'talents']) assert.ok(k in sum, k);
    const end = R.step(r.state, { type: 'END_RUN' }).state;
    assert.equal(end.phase, 'ENDED');
    assert.equal(end.result.profile.echoes, sum.echoes.total);
    assert.equal(R.autoAction(end), null);
    assert.deepEqual(R.legalActions(end), []);
  });

  test('9 / 11.5 Oath of Frailty: no resurrect charges at all', () => {
    let s = R.newRun({ classId: 'mage', seed: 5, content: CONTENT, profile: { ...R.newProfile(), unlocks: { oaths: 1 }, bossKills: 1 } });
    s = play(s, [{ type: 'SET_OATH', oath: 'frailty', on: true }, { type: 'START_RUN' }]).state;
    s = withSpells(atLevel(s, 20), []);
    s = lethal(tweak(inFight(s, [mob('z1_brute', 20)]).state, (x) => { x.player.res.boon = 1; }));
    const r = die(s);
    assert.equal(r.state.phase, 'SUMMARY');
  });
});
