// QA rule tests, rules.md sections 4, 5 and 7: level-up mana, talent spell ranks, end-of-round order, heals,
// STEALTH gained mid-fight, item cooldowns, flee from a dungeon, autoplay rules that qa/engine/ does not assert.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, withTalents, inFight, tweak, ev, st, cloneState, forceDraws, enterNode, winFight, hoursOf } from './helpers.mjs';
import { gainXp, xpToNext } from '../../src/engine/progress.js';

const mob = (tid = 'z1_brute', level = 20, variant = 'normal') => ({ tid, level, variant });
const tough = (x) => { for (const e of x.fight.enemies) { e.maxHp = e.hp = 1e7; } };
const stunAll = (x, dur = 9) => { for (const e of x.fight.enemies) e.st.push({ id: 'STUN', dur }); };

describe('rules 4-5 character and spells', () => {
  test('4.3 a level-up raises current mana by the max-mana gain (no refill), like HP', () => {
    const s = cloneState(atLevel(started('mage'), 5));
    s.player.mana = 40;
    s.player.hp = 60;
    const { maxMana: m0, maxHp: h0 } = s.player.d;
    gainXp(s, [], xpToNext(5) + 3, 'test');
    assert.equal(s.player.level, 6);
    assert.equal(s.player.mana, 40 + (s.player.d.maxMana - m0));
    assert.equal(s.player.hp, 60 + (s.player.d.maxHp - h0));
  });

  /** A level-42 Mage with the Rimecraft capstone Winter's Crown (spell glacier_spike). */
  function capstoneMage() {
    const tree = Object.values(C.TALENT).filter((x) => x.cls === 'mage' && x.tree === 1 && x.tier < 5).sort((a, b) => a.tier - b.tier);
    const ranks = {};
    let n = 0;
    for (const x of tree) { const r = Math.min(x.ranks, 16 - n); if (r > 0) { ranks[x.id] = r; n += r; } }
    return R.step(withTalents(atLevel(started('mage'), 42), ranks), { type: 'SPEND_TALENT', talentId: 'm_b9' }).state;
  }

  test('5.2 talent spells always use tl = L: their strength follows each level-up without a trainer; class spells wait for one', () => {
    const s = capstoneMage();
    assert.ok(s.player.bar.includes('glacier_spike'), 'a new talent spell takes a free bar slot');
    const amount = (x, id, tl) => { const sp = C.SPELL[id]; return Math.round(sp.b + sp.l * tl + sp.p * x.player.d.power); };
    assert.equal(R.spellInfo(s, 'glacier_spike', null).amount.amount, amount(s, 'glacier_spike', 42));
    const c = cloneState(s);
    c.player.spells.ember_bolt.tl = 42;
    gainXp(c, [], xpToNext(42) + xpToNext(43) + 1, 'test');
    assert.equal(c.player.level, 44);
    assert.equal(R.spellInfo(c, 'glacier_spike', null).amount.amount, amount(c, 'glacier_spike', 44), 'glacier_spike: 10 + 2.6L + 1.4P at L = 44');
    assert.equal(R.spellInfo(c, 'ember_bolt', null).amount.amount, amount(c, 'ember_bolt', 42), 'ember_bolt keeps tl = 42 until trained');
  });

  test('5.2 spellInfo reports the trained level a talent spell uses (tl = L) (BUG-QA-06)', () => {
    const c = cloneState(capstoneMage());
    c.player.spells.ember_bolt.tl = 42;
    gainXp(c, [], xpToNext(42) + xpToNext(43) + 1, 'test');
    assert.equal(R.spellInfo(c, 'glacier_spike', null).tl, 44);
    assert.equal(R.spellInfo(c, 'ember_bolt', null).tl, 42, 'a class spell reports its trained level');
  });

  test('5.2 bar edits are out of combat only; only bar spells and item-bar items are usable in a fight', () => {
    let s = withSpells(atLevel(started('mage', { seed: 2 }), 20), ['ember_bolt']);
    s = tweak(s, (x) => { x.player.spells.frost_lance = { tl: 20, rank: 1 }; x.player.bag.push({ uid: 'h1', kind: 'cons', id: 'healing_draught', qty: 2 }); });
    const f = inFight(s, [mob()]).state;
    assert.ok(!R.isLegal(f, { type: 'CAST', spellId: 'frost_lance', target: 0 }), 'known but not on the bar');
    assert.ok(!R.isLegal(f, { type: 'SET_BAR', slot: 1, spellId: 'frost_lance' }));
    assert.ok(!R.isLegal(f, { type: 'SET_ITEM_BAR', slot: 0, itemId: 'healing_draught' }));
    assert.ok(!R.isLegal(f, { type: 'USE_ITEM', slot: 0, target: null }), 'potion in the bag but not on the item bar');
  });
});

describe('rules 7 combat details', () => {
  test('7.1 end of round: player-side ticks (DOT, HOT) first, then enemies in index order', () => {
    let s = withSpells(atLevel(started('hunter', { seed: 3 }), 30), []);
    s = inFight(s, [mob('z1_brute', 30), mob('z1_brute', 30)]).state;
    s = tweak(s, (x) => {
      x.player.pet = null; tough(x); stunAll(x, 5); x.player.hp = 100;
      for (const e of x.fight.enemies) e.st.push({ id: 'BURN', src: 'living_flame', dur: 3, tick: 7 });
      // A HOT heals `amount` per tick (as Field Dressing sets it); DOTs use `tick`.
      x.fight.p.st.push({ id: 'BLEED', src: 'rend', dur: 3, tick: 5 }, { id: 'HOT', src: 'field_dressing', dur: 3, amount: 4 });
    });
    const r = R.step(s, { type: 'PASS' });
    const order = r.events.filter((e) => (e.t === 'damage' && e.tick) || e.t === 'heal').map((e) => `${e.dst}`);
    assert.deepEqual(order, ['player', 'player', '0', '1']);
    assert.equal(r.state.player.hp, 100 - 5 + 4);
  });

  test('7.2 heals use no random draws and never crit (Field Dressing: 12 % now, HOT 4 % for 3 rounds)', () => {
    let s = withSpells(atLevel(started('hunter', { seed: 4 }), 30), ['field_dressing']);
    s = inFight(s, [mob('z1_brute', 30)]).state;
    s = tweak(s, (x) => { x.player.pet = null; tough(x); stunAll(x); x.player.hp = 10; });
    const c = cloneState(s);
    const before = c.fight.rng.slice();
    const r = R.step(c, { type: 'CAST', spellId: 'field_dressing', target: null });
    const heals = ev(r.events, 'heal');
    assert.equal(heals[0].amount, Math.round(0.12 * s.player.d.maxHp));
    assert.ok(heals.every((h) => !h.crit));
    assert.deepEqual(r.state.fight.rng, before, 'no draw for a heal, a HOT tick or a stunned enemy');
    const hot = st(r.state.fight.p.st, 'HOT');
    assert.equal(hot.amount, Math.round(0.04 * s.player.d.maxHp));
    assert.equal(hot.dur, 2, 'the first of 3 ticks lands at the end of the casting round');
    assert.equal(heals[1].amount, hot.amount);
  });

  test('7.4 STEALTH gained mid-fight (Vanishing Step) lasts one round, even when the next action is an opener', () => {
    let s = withSpells(atLevel(started('rogue', { seed: 3 }), 40), ['vanishing_step', 'shadowstep_strike']);
    s = tweak(inFight(s, [mob('z1_brute', 40)], { noStealth: true }).state, tough);
    const a = R.step(s, { type: 'CAST', spellId: 'vanishing_step', target: null }).state;
    assert.ok(st(a.fight.p.st, 'STEALTH'), 'stealthed for the next round');
    assert.ok(R.isLegal(a, { type: 'CAST', spellId: 'shadowstep_strike', target: 0 }), 'openers usable');
    const b = R.step(a, { type: 'CAST', spellId: 'shadowstep_strike', target: 0 }).state;
    assert.equal(st(b.fight.p.st, 'STEALTH'), null, 'gone after that round');
  });

  test('7.3 Rogue energy +ENERGY_REGEN per round up to ENERGY_MAX; costs are paid on a miss', () => {
    let s = withSpells(atLevel(started('rogue', { seed: 5 }), 20), ['gutting_jab']);
    s = tweak(inFight(s, [mob('z1_brute', 20)], { noStealth: true }).state, (x) => { tough(x); stunAll(x); x.fight.p.energy = 50; });
    const c = cloneState(s);
    forceDraws(c, 3, (d) => d[0] < 0.01);
    const r = R.step(c, { type: 'CAST', spellId: 'gutting_jab', target: 0 });
    assert.ok(ev(r.events, 'miss').length === 1);
    assert.equal(r.state.fight.p.energy, 50 - 40 + C.ENERGY_REGEN);
    assert.equal(r.state.fight.p.cp, 0, 'no combo point on a miss');
    const full = R.step(tweak(s, (x) => { x.fight.p.energy = 90; }), { type: 'PASS' }).state;
    assert.equal(full.fight.p.energy, C.ENERGY_MAX);
  });

  test('7.5 Spark Flask and Purifying Tonic have no cooldown and do not start POTION_CD; Spark hits for SPARK_BASE + SPARK_PER_LEVEL × L (magic)', () => {
    let s = withSpells(atLevel(started('rogue', { seed: 6 }), 20), []);
    s = tweak(inFight(s, [mob('z1_guardian', 20)], { noStealth: true }).state, (x) => {
      tough(x); stunAll(x);
      x.player.bag.push({ uid: 'f', kind: 'cons', id: 'spark_flask', qty: 3 }, { uid: 't', kind: 'cons', id: 'purifying_tonic', qty: 2 }, { uid: 'h', kind: 'cons', id: 'healing_draught', qty: 2 });
      x.player.itemBar = ['spark_flask', 'purifying_tonic', 'healing_draught'];
      x.fight.p.st.push({ id: 'CURSED', dur: 5 });
      x.player.hp = 50;
    });
    const c = cloneState(s);
    forceDraws(c, 3, (d) => d[0] > 0.9 && d[1] > 0.5);
    const r1 = R.step(c, { type: 'USE_ITEM', slot: 0, target: null });
    const hit = ev(r1.events, 'damage').find((e) => e.spell === 'spark_flask');
    const base = (C.SPARK_BASE + C.SPARK_PER_LEVEL * 20) * (1 - C.CURSE_PCT);
    assert.ok(hit.amount >= Math.floor(base * 0.9) && hit.amount <= Math.ceil(base * 1.1), `spark ${hit.amount} vs base ${base} (armor ignored: guardian armor ×2)`);
    assert.ok(R.isLegal(r1.state, { type: 'USE_ITEM', slot: 0, target: null }), 'Spark Flask again next round');
    assert.ok(R.isLegal(r1.state, { type: 'USE_ITEM', slot: 2, target: null }), 'Healing Draught not blocked by Spark Flask');
    const r2 = R.step(r1.state, { type: 'USE_ITEM', slot: 1, target: null });
    assert.equal(st(r2.state.fight.p.st, 'CURSED'), null);
    assert.ok(R.isLegal(r2.state, { type: 'USE_ITEM', slot: 2, target: null }), 'Healing Draught not blocked by the Tonic');
  });

  test('7.8 flee from a dungeon trash fight: the node ends, the dungeon is not cleared, its hours stay spent', () => {
    let { state: s, events } = enterNode(started('mage', { seed: 7 }), 'dungeon', { level: 9, r: 4 });
    assert.equal(hoursOf(events), C.HOURS_DUNGEON);
    let fled = null;
    for (let k = 0; k < 200 && !fled; k++) {
      const c = cloneState(s);
      forceDraws(c, 1, (d) => d[0] < 0.01);
      const r = R.step(c, { type: 'FLEE' });
      if (r.state.phase === 'MAP') fled = r;
    }
    assert.ok(fled, 'flee succeeded on a low draw');
    assert.equal(fled.state.hours, s.hours);
    assert.equal(fled.state.stats.dungeons, 0);
    assert.equal(ev(fled.events, 'dungeonClear').length, 0);
    assert.ok(fled.state.zone.rows[3][0].done, 'the node cannot be entered again');
  });

  test('7.9 autoplay counts only living, non-HEXED enemies for ">= N enemies" (Cinder Storm needs 3)', () => {
    let s = withSpells(atLevel(started('mage', { seed: 3 }), 30), ['cinder_storm', 'ember_bolt']);
    s = inFight(s, [mob('z1_brute', 30), mob('z1_brute', 30), mob('z1_brute', 30)]).state;
    assert.equal(R.autoAction(s).spellId, 'cinder_storm');
    const hexed = tweak(s, (x) => { x.fight.enemies[2].st.push({ id: 'HEXED', dur: 3 }); });
    assert.equal(R.autoAction(hexed).spellId, 'ember_bolt');
    const dead = tweak(s, (x) => { x.fight.enemies[1].alive = false; x.fight.enemies[1].hp = 0; });
    assert.equal(R.autoAction(dead).spellId, 'ember_bolt');
  });

  test('7.9 between fights in a node, autoplay eats Trail Rations below AUTO_FOOD_HP (Mage: also low mana)', () => {
    for (const [cls, low] of [['rogue', (x) => { x.player.hp = Math.floor(x.player.d.maxHp * 0.4); }], ['mage', (x) => { x.player.mana = Math.floor(x.player.d.maxMana * 0.3); }]]) {
      let { state: s } = enterNode(started(cls, { seed: 8 }), 'dungeon', { level: 9, r: 4 });
      s = winFight(s).state;
      assert.equal(s.node.stage, 'between');
      s = tweak(s, low);
      let a = null;
      for (let i = 0; i < 20; i++) {
        a = R.autoAction(s);
        if (a.type === 'USE_ITEM' || a.type === 'NEXT_FIGHT' || a.type === 'DUNGEON_LEAVE') break;
        s = R.step(s, a).state; // talents, gear and bars come first
      }
      assert.deepEqual(a, { type: 'USE_ITEM', itemId: 'trail_rations' }, cls);
    }
  });
});
