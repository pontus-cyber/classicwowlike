// Blind tester pilot follow-ups, engine and content side (D144; docs/feedback/2026-11-13-blind-casual.md and
// -tactician.md; docs/handoffs/engine-2026-11-13d.md): (5) a hit roll that decides a control is shown (spellInfo `hit`,
// `hitAll`; windupView answers' `chance`), and the tactician's s0204 (Rime Burst left one of three wind-ups unanswered)
// is that roll, not a rule or a bug.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, inFight, tweak, forceDraws, ev } from './helpers.mjs';

const near = (a, b) => Math.abs(a - b) < 1e-12;

describe('blind panel (5): the hit roll of a control that lands only on a hit is shown (tactician s0204)', () => {
  /** A class at level L with these bar spells in a quest fight (engage round) against `foes` at level `lvl`, everyone tough. */
  const fightOf = (cls, L, spells, foes, lvl) => {
    let s = withSpells(atLevel(started(cls, { seed: 21 }), L), spells);
    s = inFight(s, foes.map((tid) => ({ tid, level: lvl })), { kind: 'quest', noStealth: true }).state;
    return tweak(s, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; x.player.d.maxHp = x.player.hp = 1e6; });
  };
  /** Three guardians met for the first time: each one's turn 2 (round 3) is a wind-up; PASS to round 3. */
  const sentinels = () => {
    let s = fightOf('mage', 13, ['ember_bolt', 'rime_burst', 'spellsnap'], ['z1_guardian', 'z1_guardian', 'z1_guardian'], 15);
    assert.ok(s.fight.enemies.every((e) => e.firstMeet));
    for (let i = 0; i < 2; i++) s = R.step(s, { type: 'PASS' }).state;
    assert.equal(s.fight.round, 3);
    assert.ok(s.fight.enemies.every((e) => e.intent.windup), 'every wind-up is now');
    return s;
  };

  test('spellInfo hit / hitAll: 1 - (MISS_BASE + MISS_PER_LEVEL per level above, at most MISS_CAP) (- dodge for a physical hit); 1 for an interrupt; null outside a fight', () => {
    const s = fightOf('mage', 13, ['ember_bolt', 'rime_burst', 'spellsnap'], ['z1_guardian', 'z1_guardian', 'z1_brute'], 15);
    const want = 1 - (C.MISS_BASE + C.MISS_PER_LEVEL * 2);
    assert.ok(near(R.spellInfo(s, 'ember_bolt', 0).hit, want));
    const all = R.spellInfo(s, 'rime_burst', null);
    assert.equal(all.hit, null);
    assert.deepEqual(all.hitAll.map((x) => x.u), [0, 1, 2]);
    for (const x of all.hitAll) assert.ok(near(x.chance, want), 'each enemy its own roll');
    assert.equal(R.spellInfo(s, 'spellsnap', 0).hit, 1, 'an interrupt never misses');
    assert.ok(near(R.spellInfo(fightOf('mage', 13, ['ember_bolt'], ['z1_brute'], 40), 'ember_bolt', 0).hit, 1 - C.MISS_CAP), 'capped');
    assert.ok(near(R.spellInfo(fightOf('mage', 13, ['ember_bolt'], ['z1_brute'], 9), 'ember_bolt', 0).hit, 1 - C.MISS_BASE), 'below: the base');
    // a physical hit can be dodged: the skulker's dodge counts
    const r = fightOf('rogue', 10, ['gutting_jab'], ['z1_skulker'], 10);
    assert.ok(near(R.spellInfo(r, 'gutting_jab', 0).hit, 1 - (C.MISS_BASE + C.ENEMY_DODGE + C.ARCHETYPE.skulker.dodge)));
    assert.deepEqual([R.spellInfo(started('mage'), 'ember_bolt', 0).hit, R.spellInfo(started('mage'), 'ember_bolt', 0).hitAll], [null, null]);
  });

  test('windupView: Rime Burst\'s answer to each wind-up carries the hit chance on that enemy (sure false); sure answers carry none', () => {
    const s = sentinels();
    const w = R.windupView(s);
    assert.equal(w.length, 3);
    const hitAll = R.spellInfo(s, 'rime_burst', null).hitAll;
    for (const x of w) {
      const rb = x.answers.find((a) => a.id === 'rime_burst');
      assert.deepEqual([rb.how, rb.sure, rb.now], ['stun', false, true]);
      assert.ok(near(rb.chance, hitAll.find((h) => h.u === x.u).chance) && rb.chance < 1, `enemy ${x.u}: ${rb.chance}`);
      const sn = x.answers.find((a) => a.id === 'spellsnap');
      assert.deepEqual([sn.how, sn.sure, sn.chance], ['interrupt', true, undefined]);
    }
  });

  test('s0204 is the hit roll: Rime Burst missing one of three wind-up enemies leaves that wind-up to land (EMPOWERED); the two it hit are staggered; the miss is an event', () => {
    const c = tweak(sentinels(), () => {});
    // draws: Rime Burst's three hits (3 draws each: r1 miss, r2 crit, r3 variance), then enemy 1's wind-up hit on the player
    forceDraws(c, 12, (d) => d[0] >= 0.5 && d[3] < 0.05 && d[6] >= 0.5 && d[9] >= 0.5);
    const r = R.step(c, { type: 'CAST', spellId: 'rime_burst', target: null });
    assert.deepEqual(ev(r.events, 'miss').map((x) => [x.dst, x.spell]), [[1, 'rime_burst']]);
    assert.deepEqual(ev(r.events, 'stagger').map((x) => [x.u, x.why]), [[0, 'interrupt'], [2, 'interrupt']]);
    assert.deepEqual(ev(r.events, 'empower').map((x) => x.u), [1], 'the missed one\'s wind-up landed');
  });
});
