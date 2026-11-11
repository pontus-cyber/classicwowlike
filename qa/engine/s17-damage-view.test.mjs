// Owner feedback 2026-11-11 11:58 (docs/feedback/2026-11-11-1158-owner.md): the character sheet's damage block from the
// engine, R.damageView (engine-api.md 1; src/engine/damageview.js). Its ranges are checked against real hits of the
// damage pipeline: the main attack (and the Hunter's pet) cast on a foe of the player's level with no armour and no
// statuses, over many fight streams.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withTalents, inFight, tweak, ev, STREAM } from './helpers.mjs';

const L = 12;
/** A class at level L in a fight against one enemy of its level, past the engage round, with no armour, dodge or statuses. */
function fight(cls, talents = {}) {
  let s = withTalents(atLevel(started(cls, { seed: 4 }), L), talents);
  s = inFight(s, [{ tid: 'z1_brute', level: L }], { noStealth: true }).state;
  s = R.step(s, { type: 'PASS' }).state;
  return tweak(s, (x) => {
    for (const e of x.fight.enemies) { e.maxHp = e.hp = 1e6; e.armor = 0; e.dodge = 0; e.st = []; }
    x.fight.p.st = []; if (x.fight.pet) x.fight.pet.st = [];
    x.player.hp = x.player.d.maxHp; if (x.player.d.maxMana) x.player.mana = x.player.d.maxMana;
    x.fight.p.energy = 100; x.fight.p.focus = 100;
  });
}
/** The main attack's and the pet's hits over `n` fight streams: { main: [{ amount, crit }], pet: [...] }. */
function hits(s, id, n = 80) {
  const out = { main: [], pet: [] };
  for (let k = 1; k <= n; k++) {
    const t = tweak(s, (x) => { x.fight.rng = STREAM.fight(1000 + k, 1, 1, 0, 0); });
    const r = R.step(t, { type: 'CAST', spellId: id, target: 0 });
    for (const e of ev(r.events, 'damage')) {
      if (e.tick || e.dst !== 0) continue;
      if (e.src === 'player' && e.spell === id) out.main.push({ amount: e.amount, crit: e.crit });
      if (e.src === 'pet') out.pet.push({ amount: e.amount, crit: e.crit });
    }
  }
  return out;
}
const inRange = (list, lo, hi, critLo, critHi) => list.filter((h) => (h.crit ? h.amount < critLo || h.amount > critHi : h.amount < lo || h.amount > hi));

describe('R.damageView: the character sheet\'s damage block (owner 2026-11-11 11:58)', () => {
  test('null without a character; the class\'s main attack is its first start spell, at its training level', () => {
    assert.equal(R.damageView(R.newRun({ classId: 'rogue', seed: 1, content: started().content })), null);
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const s = atLevel(started(cls), L);
      const d = R.damageView(s);
      assert.equal(d.main.spellId, C.CLASS[cls].startSpells[0]);
      assert.equal(d.main.tl, R.spellInfo(s, d.main.spellId).tl);
      assert.equal(d.main.base, Math.round(R.spellInfo(s, d.main.spellId).amount.amount), 'base = the spell tooltip\'s amount');
      assert.ok(d.main.lo <= d.main.hi && d.main.hi < d.main.critHi && d.main.lo <= d.main.avg && d.main.avg <= d.main.critHi, JSON.stringify(d.main));
      assert.equal(d.main.crit, Math.round(s.player.d.crit * 1e4) / 1e4);
      assert.equal(!!d.pet, cls === 'hunter');
      const sp = C.SPELL[d.main.spellId];
      assert.ok(Math.abs(d.perPower - sp.p * (1 + d.main.pct) * (1 + d.main.crit * (d.main.critMult - 1))) < 0.011, 'per Power point');
    }
  });

  for (const [cls, talents, why] of [['rogue', {}, ''], ['mage', { m_a1: 2, m_a2: 2 }, ', fire talents (damage and crit)'], ['hunter', { h_b1: 3 }, ', Steady Aim on Keen Shot']]) {
    test(`${cls}: every real hit of the main attack${cls === 'hunter' ? ' and the pet' : ''} lies in the view's ranges${why}`, () => {
      const s = fight(cls, talents);
      const d = R.damageView(s);
      const id = d.main.spellId;
      if (cls === 'hunter') assert.equal(d.main.pct, Math.round(3 * C.TALENT.h_b1.pct * 1e4) / 1e4, 'Steady Aim in the main attack\'s %');
      if (cls === 'mage') assert.ok(d.main.pct > 0 && d.main.crit > Math.round(s.player.d.crit * 1e4) / 1e4, 'fire talents in damage and crit');
      const h = hits(s, id);
      assert.ok(h.main.length > 40 && h.main.some((x) => x.crit) && h.main.some((x) => !x.crit), `hits and crits seen (${h.main.length})`);
      assert.deepEqual(inRange(h.main, d.main.lo, d.main.hi, d.main.critLo, d.main.critHi), [], JSON.stringify(d.main));
      const plain = h.main.filter((x) => !x.crit).map((x) => x.amount);
      assert.ok(Math.min(...plain) <= d.main.lo + 1 && Math.max(...plain) >= d.main.hi - 1, `the range is tight: seen ${Math.min(...plain)}-${Math.max(...plain)}, view ${d.main.lo}-${d.main.hi}`);
      if (cls === 'hunter') {
        assert.ok(h.pet.length > 40, `pet hits seen (${h.pet.length})`);
        assert.deepEqual(inRange(h.pet, d.pet.lo, d.pet.hi, d.pet.critLo, d.pet.critHi), [], JSON.stringify(d.pet));
      }
    });
  }

  test('pure: the state is not changed, in a fight or out of it', () => {
    for (const s of [atLevel(started('hunter'), L), fight('hunter')]) {
      const before = JSON.stringify(R.serialize(s));
      R.damageView(s);
      assert.equal(JSON.stringify(R.serialize(s)), before);
    }
  });
});
