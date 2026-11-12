// rules.md 2.3, 7.4, 7.5, 7.9, 7.12 and 13, the lines marked "(M2b v13)" (docs/specs/changes-m2b-v13.md rows 1-6,
// D105-D109): the Deathblow (DEATHBLOW_MULT, DEATHBLOW_EMPOWER, summed stacks), MAIMED (MAIM_HEAL), autoplay rule E2,
// the gated zone-1 rare HP and first meeting (GATES), and the views for the UI (windupView, autoplayEngage, potionInfo's
// MAIMED amount, the map's Deathblow fields). One test (at least) per rule; each fails when its rule is reverted. The
// constants are checked against the v13 table by s13.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, inFight, tweak, forceDraws, ev, st } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { hitEst } from '../../src/engine/track.js';
import { makeEnemy } from '../../src/engine/combat.js';
import { makeConsumable, addToBag } from '../../src/engine/items.js';

const mob = (tid, level = 20, variant = 'normal') => ({ tid, level, variant });
// Fixture content (qa/fixtures/content-min.js): elites z1 Heavy Blow (brute), z2 Dark Cast, z3 Cleave, z5 Curse, z6
// Shield; rare z1 Enrage + Heavy Blow; dungeon boss z1 Heavy Blow 1.9 + Dark Cast 2.1 (Dark Cast is its Deathblow).
const elite = (z, level = 20) => mob(`z${z}_elite`, level, 'elite');
const rare = (z, level = 20) => mob(`z${z}_rare`, level, 'rare');
const dboss = (z, level = 20) => mob(`z${z}_dboss`, level, 'dboss');

function fight(cls, L, spells, enemies, opts = {}) {
  let s = withSpells(atLevel(started(cls, { seed: opts.seed ?? 77, petId: opts.petId }), L), spells);
  const v = enemies[0].variant;
  const kind = opts.kind || (v === 'dboss' ? 'dboss' : v === 'elite' || v === 'rare' ? 'elite' : 'quest');
  s = inFight(s, enemies, { noStealth: !opts.stealth, kind }).state;
  return opts.prep ? tweak(s, opts.prep) : s;
}
const tough = (x) => { x.player.d.maxHp = x.player.hp = 1e6; for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; };
const pass = (s, n = 1) => { for (let i = 0; i < n; i++) s = R.step(s, { type: 'PASS' }).state; return s; };
const toTurn = (s, t) => pass(s, t + 1 - s.fight.round);
const engage = (option, target = null) => ({ type: 'ENGAGE', option, target });
const LAND = (d) => d[0] > 0.9 && d[1] > 0.1;
function passDrawn(s, prep, pred = LAND, n = 3) {
  const c = tweak(s, prep || (() => {}));
  forceDraws(c, n, pred);
  return R.step(c, { type: 'PASS' });
}
const at = (s, t, i = 0) => s.fight.enemies[i].track.find((x) => x.turn === t);
/** Lands the Deathblow of enemy 0 (a heavy hit on the player) and returns the step. */
const landed = (cls = 'mage', spells = [], extra = []) => passDrawn(toTurn(fight(cls, 20, spells, [elite(1), ...extra], { prep: tough }), C.SIGNATURE_TURN));
/** Potions on the item bar (as s16) and the player hurt to `hurt` of max HP. */
const potions = (hurt) => (x) => {
  for (const id of ['healing_draught', 'purifying_tonic']) addToBag(x, makeConsumable(x, id, 3));
  x.player.itemBar = ['healing_draught', 'purifying_tonic', null];
  x.player.hp = Math.round(x.player.d.maxHp * hurt);
};

describe('rules 7.12 the Deathblow (M2b v13 row 1, D105)', () => {
  test('the SIGNATURE_TURN wind-up of an elite, rare or dungeon boss is a Deathblow: `deathblow` on entry and intent; a damaging one × DEATHBLOW_MULT on top of the script multiplier, its est too; heals, shields and curses keep their pct; the dungeon boss\'s SIGNATURE_TURN_2 wind-up and normal enemies have none', () => {
    const D = C.DEATHBLOW_MULT;
    const flags = (x) => [x.id, !!x.windup, !!x.deathblow, x.pct];
    let s = fight('mage', 20, [], [elite(1)], { prep: tough });
    const x = at(s, C.SIGNATURE_TURN);
    assert.deepEqual(flags(x), ['ab_heavy', true, true, 1.9 * C.HEAVY_SCRIPT_MULT * D]);
    const e = s.fight.enemies[0];
    assert.ok(Math.abs(x.est / hitEst(s, e, { ...x, pct: x.pct / D }, x.target) - D) < 0.02, `est ${x.est} shows the multiplied hit`);
    assert.deepEqual(flags(at(fight('mage', 20, [], [elite(2)]), C.SIGNATURE_TURN)), ['ab_dark', true, true, 2.1 * C.CAST_SCRIPT_MULT * D]);
    assert.deepEqual(flags(at(fight('mage', 20, [], [elite(3)]), C.SIGNATURE_TURN)), ['ab_cleave', true, true, 0.85 * D]);
    assert.deepEqual(flags(at(fight('mage', 20, [], [elite(5)]), C.SIGNATURE_TURN)).slice(0, 3), ['ab_curse', true, true]);
    assert.deepEqual(flags(at(fight('mage', 20, [], [elite(6)]), C.SIGNATURE_TURN)), ['ab_shield', true, true, 0.2], 'a shield keeps its pct (D60)');
    assert.deepEqual(flags(at(fight('mage', 20, [], [rare(1)]), C.SIGNATURE_TURN)).slice(0, 3), ['ab_heavy', true, true], 'rare');
    let b = fight('mage', 20, [], [dboss(1)], { prep: tough });
    assert.deepEqual(flags(at(b, C.SIGNATURE_TURN)), ['ab_dark', true, true, 2.1 * C.CAST_SCRIPT_MULT * D], 'dungeon boss, first: the Deathblow');
    b = toTurn(b, C.SIGNATURE_TURN);
    assert.equal(b.fight.enemies[0].intent.deathblow, true, 'the intent shows it');
    assert.deepEqual(flags(at(b, C.SIGNATURE_TURN_2)), ['ab_heavy', true, false, 1.9 * C.HEAVY_SCRIPT_MULT], 'dungeon boss, second: a wind-up, no Deathblow');
    // A normal enemy (and the second enemy of an elite fight): no Deathblow in turns 1..8.
    s = fight('mage', 20, [], [elite(1), mob('z1_brute')], { prep: tough });
    for (let r = 0; r < 8; r++) { assert.ok(s.fight.enemies[1].track.every((y) => !y.deathblow)); s = pass(s); }
  });
});

describe('rules 7.4, 7.12 a landed Deathblow: DEATHBLOW_EMPOWER and MAIMED (M2b v13 rows 2-3, D106-D107)', () => {
  test('landed: the EMPOWERED stack is worth DEATHBLOW_EMPOWER (deathblows, deathblowValue), the player is MAIMED (dur null, value MAIM_HEAL; status event); the empower event has deathblow and maimed; later hits and estimates double', () => {
    const s0 = toTurn(fight('mage', 20, [], [elite(1)], { prep: tough }), C.SIGNATURE_TURN);
    const est3 = at(s0, 3).est;
    const r = landed();
    const emp = ev(r.events, 'empower');
    assert.deepEqual(emp.map((x) => [x.u, x.id, x.stacks, x.value, x.deathblow, x.maimed]), [[0, 'ab_heavy', 1, C.DEATHBLOW_EMPOWER, true, true]]);
    const em = st(r.state.fight.enemies[0].st, 'EMPOWERED');
    assert.deepEqual([em.stacks, em.value, em.deathblows, em.deathblowValue], [1, C.DEATHBLOW_EMPOWER, 1, C.DEATHBLOW_EMPOWER]);
    const m = st(r.state.fight.p.st, 'MAIMED');
    assert.deepEqual([m.dur, m.value, m.by, m.src], [null, C.MAIM_HEAL, 0, 'ab_heavy']);
    assert.ok(ev(r.events, 'status').some((x) => x.u === 'player' && x.id === 'MAIMED' && x.on));
    const later = at(r.state, 3).est;
    assert.ok(Math.abs(later / est3 - (1 + C.DEATHBLOW_EMPOWER)) < 0.05, `turn-3 estimate ${est3} -> ${later}`);
  });

  test('one MAIMED per fight: a second landed Deathblow adds its EMPOWERED stack but changes nothing on the player (maimed false); a non-Deathblow wind-up adds EMPOWER_DMG and never MAIMS', () => {
    const r = landed('mage', [], [elite(3)]); // the cleave Deathblow of enemy 1 lands whenever played
    assert.deepEqual(ev(r.events, 'empower').map((x) => [x.u, x.deathblow, x.maimed]), [[0, true, true], [1, true, false]]);
    assert.equal(r.state.fight.p.st.filter((x) => x.id === 'MAIMED').length, 1);
    assert.equal(ev(r.events, 'status').filter((x) => x.id === 'MAIMED').length, 1);
    // The dungeon boss's second wind-up (turn 4), the first answered: EMPOWER_DMG, no MAIMED.
    let b = toTurn(fight('rogue', 20, ['throat_jab'], [dboss(1)], { prep: tough }), C.SIGNATURE_TURN);
    b = R.step(tweak(b, (x) => { x.fight.p.energy = 100; }), { type: 'CAST', spellId: 'throat_jab', target: 0 }).state;
    const q = passDrawn(toTurn(b, C.SIGNATURE_TURN_2));
    assert.deepEqual(ev(q.events, 'empower').map((x) => [x.id, x.value, !!x.deathblow]), [['ab_heavy', C.EMPOWER_DMG, false]]);
    assert.equal(st(q.state.fight.p.st, 'MAIMED'), null);
  });

  test('answered: STAGGERED as before (STAGGER_DMG), the stagger event has deathblow; no MAIMED (an interrupt; a heavy one that cost 0 HP)', () => {
    const s = toTurn(fight('rogue', 20, ['throat_jab'], [elite(1)], { prep: tough }), C.SIGNATURE_TURN);
    const r = R.step(tweak(s, (x) => { x.fight.p.energy = 100; }), { type: 'CAST', spellId: 'throat_jab', target: 0 });
    assert.deepEqual(ev(r.events, 'stagger').map((x) => [x.why, x.value, x.deathblow]), [['interrupt', C.STAGGER_DMG, true]]);
    const sg = st(r.state.fight.enemies[0].st, 'STAGGERED');
    assert.deepEqual([sg.value, sg.deathblows], [C.STAGGER_DMG, 1]);
    assert.equal(st(r.state.fight.p.st, 'MAIMED'), null);
    const w = R.step(tweak(s, (x) => { x.fight.p.st.push({ id: 'WARD', dur: 4, amount: 1e7 }); }), { type: 'PASS' });
    assert.deepEqual(ev(w.events, 'stagger').map((x) => [x.why, x.deathblow]), [['avoided', true]]);
    assert.equal(st(w.state.fight.p.st, 'MAIMED'), null);
  });

  // QA 2026-11-12 (playtest finding 8): a heavy Deathblow aimed at the pet. The UI's text says what this test pins.
  test('aimed at the pet by its own aggro draw: a hit the pet loses HP to lands it (EMPOWERED, the player MAIMED though the player lost 0 HP: 7.13 (3) does not count the pet\'s own draw), a miss is neither; sent to the pet by TAUNT (Send the Pet) it is answered (STAGGERED, no MAIMED) though the pet loses HP', () => {
    const atPet = (x) => { tough(x); x.fight.pet.maxHp = x.fight.pet.hp = 1e6; for (const t of x.fight.enemies[0].track) if (t.deathblow) { t.aggro = 'pet'; t.target = 'pet'; } };
    const dbOf = (r) => r.events.filter((x) => x.t === 'damage' && x.src === 0 && x.spell === 'ab_heavy');
    let landedSeen = 0;
    for (const seed of [71, 72, 73, 74, 75, 76]) {
      const s = fight('hunter', 20, [], [elite(1)], { seed, prep: atPet });
      const w = R.windupView(s).find((x) => x.deathblow);
      assert.deepEqual([w.target, w.heavy, w.maims], ['pet', true, true], 'the view: aimed at the pet, MAIMS if it lands');
      assert.ok(w.answers.some((a) => a.id === 'send_pet' && a.how === 'pet'), 'Send the Pet answers it');
      const r = R.step(toTurn(s, C.SIGNATURE_TURN), { type: 'PASS' });
      const hits = dbOf(r);
      assert.ok(hits.every((x) => x.dst === 'pet'), 'the pet takes it');
      if (hits.some((x) => x.hpLost > 0)) {
        landedSeen++;
        assert.deepEqual(ev(r.events, 'empower').map((x) => [x.deathblow, x.maimed]), [[true, true]], `seed ${seed}: landed`);
        assert.ok(st(r.state.fight.p.st, 'MAIMED'), `seed ${seed}: the player is MAIMED`);
      } else assert.equal(ev(r.events, 'empower').length + ev(r.events, 'stagger').length, 0, `seed ${seed}: a miss on the pet is neither`);
      assert.equal(ev(r.events, 'stagger').length, 0, `seed ${seed}: never answered by the pet's own draw`);
      // Send the Pet in the engage round: TAUNT sends it to the pet on purpose (7.13 (3)): answered
      const rt = R.step(toTurn(R.step(s, engage('send_pet', 0)).state, C.SIGNATURE_TURN), { type: 'PASS' });
      assert.ok(dbOf(rt).every((x) => x.dst === 'pet'));
      assert.deepEqual(ev(rt.events, 'stagger').map((x) => [x.why, x.deathblow]), [['avoided', true]], `seed ${seed}: TAUNT answers it`);
      assert.equal(st(rt.state.fight.p.st, 'MAIMED'), null);
    }
    assert.ok(landedSeen > 0, 'at least one seed lands it on the pet');
  });
});

describe('rules 7.4, 7.5 MAIMED (M2b v13 row 3, D107)', () => {
  test('every heal on the player × (1 - MAIM_HEAL), rounded once: a Healing Draught (potionInfo shows it, maim 0.5; the heal event has maimed) and a HOT tick; dispersal (Purifying Tonic) keeps MAIMED; the next fight starts without it', () => {
    let s = tweak(landed().state, potions(0.2));
    s = tweak(s, (x) => { x.fight.p.potionReady = 0; });
    const full = Math.round(C.HEAL_DRAUGHT_PCT * s.player.d.maxHp);
    const info = R.potionInfo(s, 'healing_draught');
    assert.deepEqual([info.heal, info.maim], [Math.round(full * (1 - C.MAIM_HEAL)), C.MAIM_HEAL]);
    const r = R.step(s, { type: 'USE_ITEM', slot: 0, target: null });
    const h = ev(r.events, 'heal').find((x) => x.dst === 'player' && x.spell === 'healing_draught');
    assert.deepEqual([h.amount, h.maimed], [info.heal, true]);
    // A HOT tick of 100 heals 50.
    const t = R.step(tweak(r.state, (x) => { x.fight.p.st.push({ id: 'HOT', dur: 3, amount: 100, src: 'test_hot' }); }), { type: 'PASS' });
    assert.ok(ev(t.events, 'heal').some((x) => x.dst === 'player' && x.spell === 'test_hot' && x.amount === Math.round(100 * (1 - C.MAIM_HEAL))));
    // Purifying Tonic (dispersal) does not remove it.
    const p = R.step(tweak(t.state, (x) => { x.fight.p.st.push({ id: 'CURSED', dur: 3 }); }), { type: 'USE_ITEM', slot: 1, target: null });
    assert.equal(st(p.state.fight.p.st, 'CURSED'), null, 'the tonic dispersed the curse');
    assert.ok(st(p.state.fight.p.st, 'MAIMED'), 'MAIMED stays');
    // Not maimed: potionInfo maim 0 and the full amount; a new fight starts without MAIMED.
    const fresh = tweak(fight('mage', 20, [], [mob('z1_brute')]), potions(0.2));
    assert.deepEqual([R.potionInfo(fresh, 'healing_draught').maim, st(fresh.fight.p.st, 'MAIMED')], [0, null]);
  });
});

describe('rules 7.9 autoplay rule E2 (M2b v13 row 4, D108)', () => {
  const CONTROL = { rogue: 'sap', mage: 'binding_glyph', hunter: 'lay_trap' };
  test('engage round: the control option on the first special enemy with a visible wind-up, a lone elite or rare included, the Rogue\'s Sap too (supersedes D49 here); Disrupt on a dungeon boss; rule E without a special wind-up; only in the engage round', () => {
    for (const cls of C.CLASS_IDS) {
      const opts = { petId: cls === 'hunter' ? 'ridgewolf' : undefined, prep: tough };
      assert.deepEqual(R.autoAction(fight(cls, 20, [], [elite(1)], opts)), engage(CONTROL[cls], 0), `${cls}: a lone elite`);
      assert.deepEqual(R.autoAction(fight(cls, 20, [], [rare(1)], opts)), engage(CONTROL[cls], 0), `${cls}: a lone rare`);
      assert.deepEqual(R.autoAction(fight(cls, 20, [], [mob('z1_caster'), elite(2)], opts)), engage(CONTROL[cls], 1), `${cls}: the elite, not the add`);
      const b = fight(cls, 20, [], [dboss(1)], opts);
      assert.deepEqual(R.autoAction(b), engage(CONTROL[cls], 0), `${cls}: Disrupt on the dungeon boss`);
      assert.equal(R.autoplayEngage(b).name, 'Disrupt');
    }
    // Normal enemies only: rule E as before (the Rogue never Saps there: Ambush).
    assert.deepEqual(R.autoAction(fight('rogue', 20, [], [mob('z1_brute'), mob('z1_caster')], { prep: tough })).option, 'ambush');
    // After the engage round: no ENGAGE.
    assert.notEqual(R.autoAction(pass(fight('mage', 20, [], [elite(1)], { prep: tough }))).type, 'ENGAGE');
  });

  test('a wind-up answered by E2 is cancelled at its turn (Binding Glyph, Lay Trap, Disrupt): STAGGERED, no MAIMED', () => {
    for (const [cls, en] of [['mage', elite(1)], ['hunter', elite(2)], ['rogue', dboss(1)]]) {
      let s = fight(cls, 20, [], [en], { petId: cls === 'hunter' ? 'ridgewolf' : undefined, prep: tough });
      s = R.step(s, R.autoAction(s)).state;
      s = toTurn(s, C.SIGNATURE_TURN);
      const e = s.fight.enemies[0];
      assert.equal(e.intent.cancelled && e.intent.cancelled.deathblow, true, cls);
      assert.deepEqual([st(e.st, 'STAGGERED').deathblows, st(s.fight.p.st, 'MAIMED')], [1, null], cls);
    }
  });
});

describe('rules 2.3, 7.12 gated rows 5-6 (M2b v13, D109): switches the sim sets; on by default since M2b v14 (D113)', () => {
  test('row 5: a zone-1 rare uses RARE_HP_MULT, with GATES.rareHpMultZ1 RARE_HP_MULT_Z1; other zones and elites never', () => {
    const s = started('mage', { seed: 3 });
    const hp = (z, tid, v) => makeEnemy({ ...s, fight: { z, kind: 'elite' } }, 0, tid, 10, v).maxHp;
    assert.equal(C.GATES.rareHpMultZ1, true, 'on by default (M2b v14, D113)');
    const on = [hp(1, 'z1_rare', 'rare'), hp(2, 'z1_rare', 'rare'), hp(1, 'z1_elite', 'elite')];
    try {
      C.GATES.rareHpMultZ1 = false;
      const off = [hp(1, 'z1_rare', 'rare'), hp(2, 'z1_rare', 'rare'), hp(1, 'z1_elite', 'elite')];
      assert.ok(Math.abs(on[0] / off[0] - C.RARE_HP_MULT_Z1 / C.RARE_HP_MULT) < 0.01, `${off[0]} -> ${on[0]}`);
      assert.deepEqual(on.slice(1), off.slice(1));
    } finally { C.GATES.rareHpMultZ1 = true; }
  });

  test('row 6: s.met records the normal templates of every fight but grind, trash, Camp, Dimmed and boss fights; with GATES.firstMeetWindup a first meeting in a quest fight (`firstMeet`) plays its turn-2 scripted action as a wind-up (pct unchanged, no Deathblow, EMPOWER_DMG if it lands); off: none', () => {
    const base = started('mage', { seed: 3 });
    assert.deepEqual(base.met, []);
    assert.equal(C.GATES.firstMeetWindup, true, 'on by default (M2b v14, D113)');
    let s;
    try {
      C.GATES.firstMeetWindup = false;
      s = inFight(atLevel(base, 20), [mob('z1_brute'), mob('z1_brute')], { kind: 'quest' }).state;
      assert.deepEqual([s.met, s.fight.enemies.map((e) => !!e.firstMeet), s.fight.enemies[0].track.some((x) => x.windup)], [['z1_brute'], [false, false], false]);
    } finally { C.GATES.firstMeetWindup = true; }
    assert.deepEqual(inFight(atLevel(base, 20), [mob('z1_brute')], { kind: 'grind' }).state.met, [], 'grind: not met');
    { // on (the default)
      s = tweak(inFight(atLevel(base, 20), [mob('z1_brute'), mob('z1_caster')], { kind: 'quest' }).state, tough);
      assert.deepEqual(s.fight.enemies.map((e) => e.firstMeet), [true, true]);
      const x = at(s, 2);
      assert.deepEqual([x.id, x.windup, x.cast, !!x.deathblow, x.firstMeet, x.pct], ['heavy_smash', true, true, false, true, C.ARCHETYPE.brute.actions[1].pct * C.HEAVY_SCRIPT_MULT]);
      assert.ok(s.fight.enemies[0].track.every((y) => y.turn === 2 || !y.windup));
      const r = passDrawn(toTurn(s, 2));
      assert.deepEqual(ev(r.events, 'empower').filter((y) => y.u === 0).map((y) => [y.value, !!y.deathblow]), [[C.EMPOWER_DMG, false]]);
      assert.equal(st(r.state.fight.p.st, 'MAIMED'), null);
      // Met now: the next quest fight with a brute has no first meeting; an elite fight's normal add none either.
      const again = inFight(tweak(base, (y) => { y.met = ['z1_brute']; }), [mob('z1_brute')], { kind: 'quest' }).state;
      assert.equal(!!again.fight.enemies[0].firstMeet, false);
      const add = inFight(atLevel(base, 20), [elite(1), mob('z1_skulker')], { kind: 'elite' }).state;
      assert.deepEqual([!!add.fight.enemies[1].firstMeet, add.met], [false, ['z1_skulker']]);
    }
  });
});

describe('views for the UI (M2b v13 UI list; engine-api.md 6.2)', () => {
  test('windupView: each wind-up with its Deathblow flag, est, empower, maims and answers (engage control or Disrupt in the engage round, interrupts and stuns off cooldown by its round, defensives for a heavy one); ready false when none', () => {
    const s = fight('rogue', 20, ['throat_jab'], [elite(1)], { prep: tough });
    const v = R.windupView(s);
    assert.equal(v.length, 1);
    const w = v[0];
    assert.deepEqual([w.u, w.turn, w.round, w.inRounds, w.id, w.deathblow, w.heavy, w.empower, w.maims, w.ready], [0, C.SIGNATURE_TURN, 3, 2, 'ab_heavy', true, true, C.DEATHBLOW_EMPOWER, true, true]);
    assert.equal(w.est, at(s, C.SIGNATURE_TURN).est);
    assert.deepEqual(w.answers.map((a) => [a.via, a.id, a.how, a.now]), [['engage', 'sap', 'control', true], ['spell', 'throat_jab', 'interrupt', false]]);
    assert.equal(w.answers[0].breaks, true, 'Sap breaks on damage');
    // After the engage round, no interrupt on the bar: no answer ready.
    const t = pass(fight('mage', 20, [], [elite(1)], { prep: tough }));
    assert.deepEqual(R.windupView(t).map((x) => [x.deathblow, x.answers.length, x.ready]), [[true, 0, false]]);
    // A heavy Deathblow: Arcane Ward is a defensive answer (not sure).
    const m = pass(fight('mage', 20, ['arcane_ward'], [elite(1)], { prep: tough }));
    assert.deepEqual(R.windupView(m)[0].answers.map((a) => [a.id, a.how, a.sure]), [['arcane_ward', 'ward', false]]);
    // A laid trap that covers it: ready through its cancel.
    const h = R.step(fight('hunter', 20, [], [elite(2)], { petId: 'ridgewolf', prep: tough }), engage('lay_trap', 0)).state;
    const hv = R.windupView(h)[0];
    assert.deepEqual([hv.cancel && hv.cancel.by, hv.ready], ['TRAP', true]);
    assert.equal(R.windupView(R.step(s, { type: 'PASS' }).state)[0].maims, true);
  });

  test('autoplayEngage names the E2 answer; null without one or after the engage round', () => {
    const s = fight('hunter', 20, [], [elite(2)], { petId: 'ridgewolf', prep: tough });
    const h = R.autoplayEngage(s);
    assert.deepEqual([h.option, h.name, h.target, h.windup.id, h.windup.deathblow, h.windup.turn], ['lay_trap', 'Lay Trap', 0, 'ab_dark', true, C.SIGNATURE_TURN]);
    assert.deepEqual(h.action, R.autoAction(s));
    assert.equal(R.autoplayEngage(fight('hunter', 20, [], [mob('z1_brute')], { petId: 'ridgewolf' })), null);
    assert.equal(R.autoplayEngage(pass(s)), null);
  });

  test('map tooltips: elite nodes carry their Deathblow when their name shows (a rare only with Scout\'s Eye); a hidden name shows only its type (M2b v14, D112; every expedition elite, D50); dungeon nodes the boss\'s', () => {
    let seen = 0;
    for (const mapMode of ['rows', 'expedition']) {
      for (let seed = 1; seed <= 6; seed++) {
        let s = R.step(R.newRun({ classId: 'mage', seed, content: REAL, mapMode }), { type: 'START_RUN' }).state;
        if (s.phase === 'PREP') s = R.step(s, { type: 'SET_OUT' }).state; // the start camp (expedition default, D116)
        const v = R.mapView(s);
        const nodes = mapMode === 'rows' ? v.rows.flat() : v.nodes.filter((n) => n.know === 'full');
        for (const n of nodes) {
          if (n.type === 'elite') {
            if (mapMode === 'expedition' || n.name === null) assert.ok(n.deathblow && Object.keys(n.deathblow).join() === 'type' && ['heavy', 'cast'].includes(n.deathblow.type), JSON.stringify(n));
            else { assert.ok(n.deathblow && n.deathblow.name && ['heavy', 'cast'].includes(n.deathblow.type), JSON.stringify(n)); seen++; }
          }
          if (n.type === 'dungeon') { assert.ok(n.bossDeathblow && n.bossDeathblow.name, JSON.stringify(n)); seen++; }
        }
      }
    }
    assert.ok(seen >= 6, `checked ${seen}`);
  });
});

describe('full autoplay runs (M2b v13)', () => {
  test('Deathblows land or are answered in special fights only; MAIMED only after a landed one; E2 engages; runs end (classic and expedition, real content)', () => {
    const tally = { db: 0, landed: 0, answered: 0, e2: 0, maimed: 0 };
    for (const [mapMode, cls, seed] of [['rows', 'rogue', 11], ['rows', 'mage', 12], ['rows', 'hunter', 13], ['expedition', 'mage', 14]]) {
      let s = R.step(R.newRun({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, content: REAL, mapMode }), { type: 'START_RUN' }).state;
      for (let n = 0; s.phase !== 'ENDED' && n < 20000; n++) {
        const a = R.autoAction(s);
        if (a.type === 'ENGAGE' && R.autoplayEngage(s)) tally.e2++;
        const r = R.step(s, a);
        for (const x of r.events) {
          if ((x.t === 'empower' || x.t === 'stagger') && x.deathblow) {
            tally.db++;
            assert.ok(['elite', 'rare', 'dboss'].includes(s.fight.enemies[x.u].kind), 'a special enemy');
            if (x.t === 'empower') tally.landed++; else tally.answered++;
          }
          if (x.t === 'status' && x.id === 'MAIMED' && x.on) {
            tally.maimed++;
            assert.ok(r.events.some((y) => y.t === 'empower' && y.deathblow && y.maimed));
          }
        }
        s = r.state;
      }
      assert.equal(s.phase, 'ENDED', `${mapMode} ${cls} ${seed}`);
    }
    assert.ok(tally.db > 5 && tally.answered > 0 && tally.e2 > 0, JSON.stringify(tally));
    assert.ok(tally.maimed <= tally.landed, JSON.stringify(tally));
  });
});
