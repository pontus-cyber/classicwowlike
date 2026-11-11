// rules.md 7.5 and 11.2 (M2b v6, D66; docs/specs/changes-m2b-v6.md row 8): Packed Satchel's free potion (the first
// potion each fight costs no turn) and Vigor and Edge at 0.005 per rank. engine-api.md 1 (freePotion), 5 (`free`).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, inFight, tweak, ev, st } from './helpers.mjs';
import { makeConsumable, addToBag, countConsumable } from '../../src/engine/items.js';

const SATCHEL = { ...R.newProfile(), unlocks: { satchel: 1 } };
const mob = (tid = 'z1_brute', level = 20, variant = 'normal') => ({ tid, level, variant });
const tough = (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; };
/** A class at level L in a fight, with or without Packed Satchel; item bar: Healing Draught, Mana Draught (Mage) or Purifying Tonic, Spark Flask. */
function fight(cls, { satchel = true, L = 20, spells = [], enemies = [mob('z1_brute'), mob('z1_caster')], kind = 'quest', engage, stealth = false, hurt = 0.5, immortal = false } = {}) {
  let s = withSpells(atLevel(started(cls, { seed: 5, profile: satchel ? SATCHEL : null }), L), spells);
  s = tweak(s, (x) => {
    for (const id of ['healing_draught', 'mana_draught', 'purifying_tonic', 'spark_flask']) addToBag(x, makeConsumable(x, id, 3));
    x.player.itemBar = cls === 'mage' ? ['healing_draught', 'mana_draught', 'spark_flask'] : ['healing_draught', 'purifying_tonic', 'spark_flask'];
  });
  s = inFight(s, enemies, { kind, engage, noStealth: !stealth }).state;
  return tweak(s, (x) => {
    tough(x);
    if (immortal) x.player.d.maxHp = 1e6;
    x.player.hp = Math.round(x.player.d.maxHp * hurt);
    if (x.player.d.maxMana) x.player.mana = Math.round(x.player.d.maxMana * hurt);
  });
}
const USE = (slot) => ({ type: 'USE_ITEM', slot, target: null });
const pass = (s) => R.step(s, { type: 'PASS' }).state;
/** Past the engage round. */
const round2 = (s) => pass(s);

describe('rules 7.5 Packed Satchel: the first potion each fight costs no turn (M2b v6, D66)', () => {
  test('the free potion resolves as the player action (heal, POTION_CD from this round, potions used) and the round waits: no pet, no enemy, no end of round', () => {
    const s = round2(fight('hunter'));
    assert.equal(s.fight.round, 2);
    assert.equal(R.freePotion(s), true);
    const hp0 = s.player.hp; const n0 = countConsumable(s, 'healing_draught'); const rounds0 = s.stats.rounds; const used0 = s.stats.potionsUsed;
    const r = R.step(s, USE(0));
    const t = r.state;
    assert.deepEqual(ev(r.events, 'action'), [{ t: 'action', kind: 'item', item: 'healing_draught', free: true }]);
    assert.ok(ev(r.events, 'heal').length === 1 && t.player.hp > hp0, 'healed');
    for (const k of ['round', 'intent', 'petAction', 'enemyAction', 'damage', 'miss']) assert.equal(ev(r.events, k).length, 0, `no ${k} event`);
    assert.equal(t.fight.round, 2, 'same round');
    assert.equal(t.stats.rounds, rounds0, 'rounds not counted');
    assert.equal(t.stats.potionsUsed, used0 + 1, 'the free potion counts as a potion used');
    assert.equal(countConsumable(t, 'healing_draught'), n0 - 1);
    assert.equal(t.fight.p.potionReady, 2 + C.POTION_CD, 'POTION_CD from this round');
    assert.equal(R.freePotion(t), false, 'used');
    assert.deepEqual(t.fight.enemies.map((e) => e.hp), s.fight.enemies.map((e) => e.hp));
    // the player chooses again in the same round: the potion is on cooldown, everything else as before
    assert.ok(!R.isLegal(t, USE(0)), 'a second potion is on cooldown');
    const kinds = (x) => [...new Set(R.legalActions(x).map((a) => a.type))].sort();
    assert.deepEqual(kinds(t), kinds(s));
    const n = R.step(t, { type: 'ATTACK', target: 0 });
    assert.equal(n.state.fight.round, 3, 'the next action plays the round');
    assert.equal(n.state.stats.rounds, rounds0 + 1);
    assert.ok(ev(n.events, 'enemyAction').length > 0 && ev(n.events, 'round').length === 1);
  });

  test('once per fight: a later potion costs the turn; the next fight has its own free potion', () => {
    let s = round2(fight('mage', { spells: [], immortal: true }));
    s = R.step(s, USE(0)).state; // free Healing Draught
    for (let i = 0; i < C.POTION_CD; i++) s = pass(s);
    assert.ok(R.isLegal(s, USE(1)), 'Mana Draught off cooldown');
    const r0 = s.fight.round;
    const r = R.step(s, USE(1));
    assert.deepEqual(ev(r.events, 'action'), [{ t: 'action', kind: 'item', item: 'mana_draught' }], 'not free');
    assert.equal(r.state.fight.round, r0 + 1, 'the turn is spent');
    // a new fight: free again (the Mana Draught counts as a potion)
    const again = round2(fight('mage', { spells: [] }));
    const m = R.step(again, USE(1));
    assert.equal(ev(m.events, 'action')[0].free, true);
    assert.equal(m.state.fight.round, again.fight.round);
    assert.ok(ev(m.events, 'mana').length === 1);
  });

  test('never free: without Packed Satchel, Purifying Tonic and Spark Flask (they keep the free potion unused)', () => {
    const no = round2(fight('rogue', { satchel: false }));
    assert.equal(R.freePotion(no), false);
    const a = R.step(no, USE(0));
    assert.equal(ev(a.events, 'action')[0].free, undefined);
    assert.equal(a.state.fight.round, no.fight.round + 1);
    for (const slot of [1, 2]) {
      const s = round2(fight('rogue'));
      const r = R.step(s, USE(slot));
      assert.equal(ev(r.events, 'action')[0].free, undefined, s.player.itemBar[slot]);
      assert.equal(r.state.fight.round, s.fight.round + 1, `${s.player.itemBar[slot]} costs the turn`);
      assert.equal(R.freePotion(r.state), true, 'the free potion is still there');
      const q = R.step(r.state, USE(0));
      assert.equal(ev(q.events, 'action')[0].free, true);
    }
    // the satchel's start kit is unchanged: META.satchel.potions Healing Draughts
    assert.equal(countConsumable(started('rogue', { profile: SATCHEL }), 'healing_draught'), C.META.satchel.potions);
  });

  test('side effects of a player action: STEALTH is removed (rules 7.4), Arcane Momentum resets', () => {
    const s = fight('rogue', { stealth: true, engage: false });
    assert.ok(st(s.fight.p.st, 'STEALTH'), 'in Stealth before');
    const r = R.step(s, USE(0));
    assert.ok(!st(r.state.fight.p.st, 'STEALTH'), 'Stealth gone');
    assert.equal(r.state.fight.round, s.fight.round);
    const m = tweak(round2(fight('mage', { spells: ['ember_bolt'] })), (x) => { x.fight.p.momentum = 3; });
    assert.equal(R.step(m, USE(0)).state.fight.p.momentum, 0);
  });

  test('engage round: after the free potion it is still round 1 and the engage options stay legal', () => {
    const s = fight('hunter', { enemies: [mob('z1_brute'), mob('z1_caster')] });
    assert.ok(R.isEngageRound(s));
    const r = R.step(s, USE(0));
    assert.equal(r.state.fight.round, 1);
    assert.ok(R.isEngageRound(r.state) && R.engageOptions(r.state).length === 3);
    const a = { type: 'ENGAGE', option: 'opening_shot', target: 0 };
    assert.ok(R.isLegal(r.state, a));
    const e = R.step(r.state, a);
    assert.equal(e.state.fight.round, 2);
    assert.ok(!R.isEngageRound(e.state));
  });

  test('the end-boss fight has its free potion too; Brand and the boss do not act on it', () => {
    let s = R.step(started('mage', { seed: 51, profile: SATCHEL }), { type: 'LEAVE_HUB' }).state;
    s = tweak(atLevel(s, 60), (x) => { x.zone.z = 6; x.hours = 100; });
    s = R.step(R.step(s, { type: 'TRAVEL_ON' }).state, { type: 'FIGHT_BOSS' }).state;
    s = tweak(s, (x) => { x.player.itemBar = ['healing_draught', null, null]; x.player.hp = Math.round(x.player.d.maxHp / 2); x.fight.p.st.push({ id: 'BRAND', stacks: 2, dur: null }); });
    assert.equal(s.fight.kind, 'boss');
    assert.equal(R.freePotion(s), true);
    const b0 = s.stats.bossRounds;
    const r = R.step(s, USE(0));
    assert.equal(ev(r.events, 'action')[0].free, true);
    assert.equal(ev(r.events, 'damage').length, 0, 'no boss action, no Brand tick');
    assert.equal(r.state.fight.round, s.fight.round);
    assert.equal(r.state.stats.bossRounds, b0);
    assert.equal(R.freePotion(r.state), false);
  });

  test('not while the player\'s action is skipped (Glacial Tomb, Chrono Sigil): USE_ITEM is illegal and freePotion is false', () => {
    const s = tweak(round2(fight('hunter')), (x) => { x.fight.p.skip = true; });
    assert.equal(R.freePotion(s), false);
    assert.ok(!R.isLegal(s, USE(0)));
  });

  test('autoplay drinks it below AUTO_POTION_HP and runs its policy again in the same round; full runs with the unlock end', () => {
    const s = round2(fight('rogue', { hurt: C.AUTO_POTION_HP / 2 }));
    assert.deepEqual(R.autoAction(s), USE(0));
    const t = R.step(s, R.autoAction(s)).state;
    assert.equal(t.fight.round, s.fight.round);
    const next = R.autoAction(t);
    assert.ok(next.type !== 'USE_ITEM' && R.isLegal(t, next), JSON.stringify(next));
    assert.equal(R.step(t, next).state.fight.round, s.fight.round + 1);
    for (const cls of C.CLASS_IDS) {
      let r = R.newRun({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed: 11, content: started(cls).content, profile: SATCHEL });
      r = R.step(r, { type: 'START_RUN' }).state;
      let free = 0; let steps = 0;
      while (r.phase !== 'ENDED' && steps < 20000) {
        const out = R.step(r, R.autoAction(r));
        free += ev(out.events, 'action').filter((e) => e.free).length;
        r = out.state;
        steps++;
      }
      assert.equal(r.phase, 'ENDED', `${cls} run ended`);
      assert.ok(free > 0, `${cls}: autoplay drank free potions (${free})`);
      assert.ok(free <= r.stats.fights, 'at most one per fight');
    }
  });
});

describe('rules 11.2 Vigor and Edge 0.005 per rank (M2b v6, D66)', () => {
  test('META.vigor.hpPct and META.edge.powerPct 0.005; four ranks give +2 % max HP and Power', () => {
    assert.equal(C.META.vigor.hpPct, 0.005);
    assert.equal(C.META.edge.powerPct, 0.005);
    const full = { ...R.newProfile(), unlocks: { vigor: 4, edge: 4 } };
    const s = started('mage', { profile: full });
    const b = started('mage');
    assert.ok(Math.abs(s.meta.hpPct - 0.02) < 1e-12 && Math.abs(s.meta.powerPct - 0.02) < 1e-12, JSON.stringify(s.meta));
    assert.equal(s.player.d.maxHp, Math.round((C.CLASS.mage.hpBase + C.HP_PER_STA * b.player.d.STA) * 1.02));
    assert.ok(Math.abs(s.player.d.power - b.player.d.power * 1.02) < 1e-9);
  });
});
