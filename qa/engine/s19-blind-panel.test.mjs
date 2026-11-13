// Blind tester pilot follow-ups, engine and content side (D144; docs/feedback/2026-11-13-blind-casual.md and
// -tactician.md; docs/handoffs/engine-2026-11-13d.md): (2) the hub's trainer advice follows R.trainerView (nothing to learn
// at level 1), and the off-balance hint's "spend your big hit" has a shield line when the target's shield absorbs a whole
// hit (R.offBalance `shield`, `absorbs`); (5) a hit roll that decides a control is shown (spellInfo `hit`, `hitAll`;
// windupView answers' `chance`), and the tactician's s0204 (Rime Burst left one of three wind-ups unanswered) is that
// roll, not a rule or a bug.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, inFight, tweak, forceDraws, ev } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { mainHitEstimate } from '../../src/engine/spells.js';

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

describe('blind panel (2a): the hub does not send a character with nothing to learn to the trainer (R.trainerView)', () => {
  const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
  const hub = (classId, tutorial) => {
    let s = R.newRun({ classId, petId: PET(classId), seed: 5, content: REAL, tutorial });
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }]) s = R.step(s, a).state;
    return s;
  };

  test('at the first hub (level 1), every class, guided or not: nothing to learn or train, the next spell at level 4, not useful; autoplay leaves without the trainer', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      for (const tutorial of [false, true]) {
        let s = hub(classId, tutorial);
        assert.deepEqual([s.phase, s.player.level], ['ZONE_HUB', 1]);
        assert.deepEqual(R.trainerView(s), { learn: [], train: [], next: 4, useful: false }, `${classId} ${tutorial}`);
        const seen = [];
        for (let n = 0; s.phase === 'ZONE_HUB' && n < 20; n++) { const a = R.autoAction(s); seen.push(a.type === 'SERVICE' ? a.service : a.type); s = R.step(s, a).state; }
        assert.ok(!seen.includes('trainer') && seen[seen.length - 1] === 'LEAVE_HUB', `${classId}: ${seen.join(' ')}`);
      }
    }
    assert.equal(R.trainerView(R.newRun({ classId: 'mage', content: REAL })), null, 'null before START_RUN');
  });

  test('a spell to learn or a rank to train makes it useful only when the gold covers it; prices are the trainer\'s', () => {
    const s = hub('mage', false);
    const lvl4 = tweak(s, (x) => { x.player.level = 4; x.player.gold = 1e6; });
    const v = R.trainerView(lvl4);
    assert.ok(v.learn.length > 0 && v.learn.every((x) => x.lvl <= 4 && x.cost > 0 && C.SPELL[x.id].cls === 'mage'), JSON.stringify(v.learn));
    assert.deepEqual(v.train.map((x) => x.id).sort(), Object.keys(s.player.spells).sort(), 'the start spells trained at level 1 rank up');
    assert.ok(v.next > 4 && v.useful);
    const poor = R.trainerView(tweak(lvl4, (x) => { x.player.gold = 0; }));
    assert.deepEqual([poor.learn.length, poor.train.length, poor.useful], [v.learn.length, v.train.length, false]);
    // only ranks: every spell up to the level known, trained below it
    const ranks = tweak(lvl4, (x) => { for (const l of v.learn) { x.player.spells[l.id] = { tl: 4, rank: 1 }; x.player.spellOrder.push(l.id); } });
    const r = R.trainerView(ranks);
    assert.deepEqual([r.learn, r.train.length > 0, r.train.every((x) => x.tl < 4 && x.cost === r.train[0].cost), r.useful], [[], true, true, true]);
  });

  test('content: the hub lines (draft) say {zone}; the plain one does not send to the trainer; both fit ONB_HINT_MAX_CHARS with the longest zone name', () => {
    const g = REAL.tutorial.guide;
    const longest = Math.max(...REAL.zones.map((z) => z.name.length));
    for (const line of [g.hubLine, g.hubTrainerLine]) {
      assert.ok(line.includes('{zone}'), line);
      assert.ok(line.length - '{zone}'.length + longest <= C.ONB_HINT_MAX_CHARS, line);
    }
    assert.ok(!/visit the trainer/i.test(g.hubLine) && /trainer/i.test(g.hubTrainerLine));
  });
});

describe('blind panel (2b): "spend your big hit now" is not the advice when the target\'s shield absorbs a whole hit (casual s0193)', () => {
  /** A Rogue of level L in an elite fight with Bargh (zone 2's elite, level 18) and his Fenmother Acolyte (a mender). */
  const bargh = (L = 10) => {
    const s = atLevel(started('rogue', { content: REAL, seed: 3 }), L);
    return inFight(s, [{ tid: 'z2_bargh', level: 18, variant: 'elite' }, { tid: 'z2_fen_healer', level: 18 }], { kind: 'elite', noStealth: true }).state;
  };
  const offBal = (x, i = 0, id = 'OFF_BALANCE') => { x.fight.enemies[i].st.push({ id, dur: 2, value: C.OFFBAL_TAKEN }); };

  test('offBalance: shield (its enemy shield, 0 without) and absorbs (shield >= the main attack\'s average hit on it now)', () => {
    const s = bargh();
    const plain = R.offBalance(tweak(s, (x) => offBal(x)), 0);
    assert.deepEqual([plain.status, plain.shield, plain.absorbs], ['OFF_BALANCE', 0, false]);
    // the casual's case: a Bolster's shield (BOLSTER_PCT of max HP) on a level 18 elite against a level 10 Rogue
    const bolstered = tweak(s, (x) => { offBal(x); x.fight.enemies[0].shield = Math.round(C.BOLSTER_PCT * x.fight.enemies[0].maxHp); });
    const est = mainHitEstimate(bolstered, 0);
    assert.ok(bolstered.fight.enemies[0].shield > 3 * est, `shield ${bolstered.fight.enemies[0].shield}, hit ${est}`);
    assert.deepEqual([R.offBalance(bolstered, 0).shield, R.offBalance(bolstered, 0).absorbs], [bolstered.fight.enemies[0].shield, true]);
    // the boundary: a shield smaller than one hit lets the big hit through
    const at = (sh) => R.offBalance(tweak(bolstered, (x) => { x.fight.enemies[0].shield = sh; }), 0);
    assert.deepEqual([at(est - 1).absorbs, at(est).absorbs], [false, true]);
    // a FROZEN window counts as off-balance, the same rule
    const fr = R.offBalance(tweak(s, (x) => { offBal(x, 0, 'FROZEN'); x.fight.enemies[0].shield = 1e5; }), 0);
    assert.deepEqual([fr.status, fr.absorbs], ['FROZEN', true]);
    // the window's +OFFBAL_TAKEN is in the estimate (the snapshot reads the target's statuses)
    assert.ok(mainHitEstimate(tweak(s, (x) => offBal(x)), 0) > mainHitEstimate(s, 0));
  });

  test('content: H05 keeps its line and has the shield line (draft) for that case, within ONB_HINT_MAX_CHARS, without "spend your big hit now"', () => {
    const h = REAL.tutorial.hints.find((x) => x.id === 'H05');
    assert.match(h.line, /Spend your big hit now/);
    assert.ok(h.alt && typeof h.alt.shield === 'string');
    assert.ok(h.alt.shield.length <= C.ONB_HINT_MAX_CHARS && /shield/.test(h.alt.shield) && !/now/.test(h.alt.shield), h.alt.shield);
    assert.deepEqual(R.validateContent(REAL, { strict: true }), []);
  });
});
