// rules.md 7.2, 7.4, 7.7, 7.10, 7.12 and 13, the lines marked "(combat v2.1)" (docs/specs/combat-v2.md 16, D55-D57):
// wind-ups on the signature turns, their lasting result (STAGGERED when answered, EMPOWERED when landed), Disrupt on
// CC-immune enemies, the setup values, determinism and full runs (both map modes, fixture and real content). One test
// (at least) per rule; each fails when its rule is reverted. The constants are checked by s13.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  R, C, CONTENT, started, atLevel, withSpells, inFight, tweak, forceDraws, ev, st, cloneState, MAX_ACTIONS_PER_RUN,
} from './helpers.mjs';

const REAL_PATH = fileURLToPath(new URL('../../src/content/index.js', import.meta.url));
const REAL = existsSync(REAL_PATH) ? (await import(REAL_PATH)).CONTENT : null;

const mob = (tid, level = 20, variant = 'normal') => ({ tid, level, variant });
// Fixture content (qa/fixtures/content-min.js): elites z1 Heavy Blow (brute), z2 Dark Cast (caster), z3 Cleave, z4
// Rend, z5 Curse, z6 Shield; rare z1 Enrage + Heavy Blow; dungeon bosses (brute) z1 Heavy Blow 1.9 + Dark Cast 2.1,
// z5 Heavy Blow + Self Heal.
const elite = (z, level = 20) => mob(`z${z}_elite`, level, 'elite');
const rare = (z, level = 20) => mob(`z${z}_rare`, level, 'rare');
const dboss = (z, level = 20) => mob(`z${z}_dboss`, level, 'dboss');

/** A class at level L with these bar spells in a fight with an engage round; the fight kind follows the first enemy. */
function fight(cls, L, spells, enemies, opts = {}) {
  let s = withSpells(atLevel(started(cls, { seed: opts.seed ?? 77, petId: opts.petId }), L), spells);
  const v = enemies[0].variant;
  const kind = opts.kind || (v === 'dboss' ? 'dboss' : v === 'elite' || v === 'rare' ? 'elite' : 'quest');
  s = inFight(s, enemies, { noStealth: !opts.stealth, kind }).state;
  return opts.prep ? tweak(s, opts.prep) : s;
}
const tough = (x) => { x.player.d.maxHp = x.player.hp = 1e6; for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; };
const petTough = (x) => { tough(x); x.player.d.petMaxHp = x.player.pet.hp = 1e6; x.fight.pet.actions = 0; };
const noPet = (x) => { tough(x); x.player.pet.alive = false; };
const pass = (s, n = 1, prep = null) => { for (let i = 0; i < n; i++) s = R.step(prep ? tweak(s, prep) : s, { type: 'PASS' }).state; return s; };
/** PASS until enemy 0's turn t is now (its turn t is round t + 1 after the engage round). */
const toTurn = (s, t, prep) => pass(s, t + 1 - s.fight.round, prep);
const engage = (option, target = null, spellId) => (C.ENGAGE_OPTION[option].target === 'spell' ? { type: 'ENGAGE', option, spellId, target } : { type: 'ENGAGE', option, target });
const stacks = (e, id) => { const x = st(e.st, id); return x ? x.stacks : 0; };
/** The wind-up results of a step: stagger and empower events. */
const results = (events) => events.filter((x) => x.t === 'stagger' || x.t === 'empower');
const brief = (events) => results(events).map((x) => (x.t === 'stagger' ? [x.t, x.id, x.why, x.by] : [x.t, x.id]));
const LAND = (d) => d[0] > 0.9 && d[1] > 0.1; // the enemy's hit lands, no crit
const MISS = (d) => d[0] < 0.01;
const ward = (x) => { x.fight.p.st.push({ id: 'WARD', dur: 4, amount: 1e7 }); };
/** PASS with the round's first n draws chosen by pred (the enemy's hit when nothing acts before it). */
function passDrawn(s, prep, pred = LAND, n = 3) {
  const c = tweak(s, prep || (() => {}));
  forceDraws(c, n, pred);
  return R.step(c, { type: 'PASS' });
}

describe('rules 7.12 wind-ups (combat v2.1)', () => {
  test('signature entries are wind-ups: `windup` and `cast` on SIGNATURE_TURN (elite, rare, dungeon boss) and a dungeon boss\'s SIGNATURE_TURN_2; the pct takes only the multiplier of its own flag; no other entry is one', () => {
    const at = (s, t) => s.fight.enemies[0].track.find((x) => x.turn === t);
    const flags = (x) => [x.id, !!x.windup, !!x.cast, !!x.heavy, x.pct];
    assert.deepEqual(flags(at(fight('mage', 20, [], [elite(1)]), C.SIGNATURE_TURN)), ['ab_heavy', true, true, true, 1.9 * C.HEAVY_SCRIPT_MULT], 'heavy: × HEAVY_SCRIPT_MULT');
    assert.deepEqual(flags(at(fight('mage', 20, [], [elite(2)]), C.SIGNATURE_TURN)), ['ab_dark', true, true, false, 2.1 * C.CAST_SCRIPT_MULT], 'cast: × CAST_SCRIPT_MULT once');
    assert.deepEqual(flags(at(fight('mage', 20, [], [elite(3)]), C.SIGNATURE_TURN)), ['ab_cleave', true, true, false, 0.85], 'neither: the added cast adds nothing');
    assert.deepEqual(flags(at(fight('mage', 20, [], [elite(6)]), C.SIGNATURE_TURN)), ['ab_shield', true, true, false, 0.2], 'a shield: no multiplier (D60)');
    assert.deepEqual(flags(at(fight('mage', 20, [], [rare(1)]), C.SIGNATURE_TURN)).slice(0, 3), ['ab_heavy', true, true], 'rare');
    let b = fight('mage', 20, [], [dboss(1)], { prep: tough });
    assert.deepEqual(flags(at(b, C.SIGNATURE_TURN)).slice(0, 3), ['ab_dark', true, true], 'dungeon boss, first');
    b = toTurn(b, C.SIGNATURE_TURN);
    assert.equal(b.fight.enemies[0].intent.windup, true, 'the intent shows it when it becomes now');
    assert.equal(b.fight.enemies[0].intent.cast, true);
    assert.deepEqual(flags(at(b, C.SIGNATURE_TURN_2)), ['ab_heavy', true, true, true, 1.9 * C.HEAVY_SCRIPT_MULT], 'dungeon boss, second');
    // Turns 1..8: only the signature turns hold wind-ups; normal enemies (and the second enemy here) none.
    for (const [m, want] of [[elite(1), [C.SIGNATURE_TURN]], [dboss(1), [C.SIGNATURE_TURN, C.SIGNATURE_TURN_2]], [mob('z1_brute'), []]]) {
      let s = fight('mage', 20, [], [m, mob('z1_caster')], { prep: tough });
      const seen = new Map();
      for (let r = 0; r < 7; r++) {
        for (const x of s.fight.enemies[0].track) seen.set(x.turn, !!x.windup);
        assert.ok(s.fight.enemies[1].track.every((x) => !x.windup));
        s = pass(s);
      }
      assert.deepEqual([...seen].filter(([, w]) => w).map(([t]) => t), want, m.tid);
      assert.ok(seen.size >= 8);
    }
  });

  test('every interrupt, stun or control stops a wind-up, on a dungeon boss too (a stun-tagged spell interrupts a CC-immune enemy): interrupted, its cooldown starts, OFF_BALANCE and one STAGGERED stack; autoplay rule 3 interrupts it', () => {
    const ready = (x) => { x.fight.p.energy = 100; x.fight.p.cp = 5; x.fight.p.cds = {}; };
    // Elite, heavy wind-up: Throat Jab interrupts it (a heavy without `cast` could not be interrupted).
    const s = toTurn(fight('rogue', 20, ['throat_jab', 'temple_blow'], [elite(1)], { prep: tough }), C.SIGNATURE_TURN);
    assert.equal(s.fight.enemies[0].intent.id, 'ab_heavy');
    let r = R.step(tweak(s, ready), { type: 'CAST', spellId: 'throat_jab', target: 0 });
    let e = r.state.fight.enemies[0];
    assert.ok(ev(r.events, 'interrupt').some((x) => x.u === 0 && x.by === 'throat_jab'));
    assert.ok(!ev(r.events, 'enemyAction').some((x) => x.u === 0), 'it does not act');
    assert.equal(e.cds.ab_heavy, s.fight.round + 3, 'its cooldown starts (cd 3)');
    assert.ok(st(e.st, 'OFF_BALANCE'));
    assert.deepEqual([stacks(e, 'STAGGERED'), stacks(e, 'EMPOWERED')], [1, 0]);
    assert.deepEqual(results(r.events).map((x) => [x.t, x.u, x.id, x.name, x.why, x.by, x.stacks, x.value]),
      [['stagger', 0, 'ab_heavy', 'Fixture Heavy Blow', 'interrupt', 'throat_jab', 1, C.STAGGER_DMG]]);
    assert.deepEqual(R.autoAction(tweak(s, ready)), { type: 'CAST', spellId: 'throat_jab', target: 0 }, 'rule 3: the wind-up is a cast');
    // Dungeon boss (CC-immune): Temple Blow (stun-tagged) interrupts the Dark Cast of turn 2 and the Heavy Blow of turn 4.
    let b = toTurn(fight('rogue', 20, ['temple_blow'], [dboss(1)], { prep: tough }), C.SIGNATURE_TURN);
    r = R.step(tweak(b, ready), { type: 'CAST', spellId: 'temple_blow', target: 0 });
    assert.ok(ev(r.events, 'interrupt').some((x) => x.u === 0 && x.by === 'temple_blow'));
    assert.ok(!st(r.state.fight.enemies[0].st, 'STUN'), 'immune: interrupted, not stunned');
    b = toTurn(r.state, C.SIGNATURE_TURN_2);
    assert.equal(b.fight.enemies[0].intent.id, 'ab_heavy');
    r = R.step(tweak(b, ready), { type: 'CAST', spellId: 'temple_blow', target: 0 });
    e = r.state.fight.enemies[0];
    assert.ok(ev(r.events, 'interrupt').some((x) => x.by === 'temple_blow'), 'a heavy wind-up of a CC-immune boss is stopped by a stun');
    assert.deepEqual(brief(r.events), [['stagger', 'ab_heavy', 'interrupt', 'temple_blow']]);
    assert.deepEqual([stacks(e, 'STAGGERED'), st(e.st, 'STAGGERED').value], [2, 2 * C.STAGGER_DMG]);
    // Control landing mid-round on a non-immune enemy: Hexbind on the elite caster's Dark Cast.
    const m = toTurn(fight('mage', 20, ['hexbind'], [elite(2)], { prep: tough }), C.SIGNATURE_TURN);
    assert.deepEqual(brief(R.step(m, { type: 'CAST', spellId: 'hexbind', target: 0 }).events), [['stagger', 'ab_dark', 'interrupt', 'hexbind']]);
  });

  test('answered at the turn\'s start: STUN, FROZEN, HEXED, SAPPED or a trap cancels the wind-up (OFF_BALANCE, a STAGGERED stack); SILENCED replaces it by the basic attack (a STAGGERED stack, no OFF_BALANCE)', () => {
    for (const id of ['STUN', 'FROZEN', 'HEXED', 'SAPPED']) {
      const s = tweak(toTurn(fight('mage', 20, [], [elite(1)], { prep: tough }), 1), (x) => { x.fight.enemies[0].st.push({ id, dur: 2 }); });
      const r = R.step(s, { type: 'PASS' }); // round 3 starts: turn 2, the wind-up
      const e = r.state.fight.enemies[0];
      assert.deepEqual([e.intent.cancelled.id, e.intent.cancelled.windup], ['ab_heavy', true], id);
      assert.ok(st(e.st, 'OFF_BALANCE'), id);
      assert.deepEqual(brief(r.events), [['stagger', 'ab_heavy', 'control', id]], id);
      assert.equal(stacks(e, 'STAGGERED'), 1);
    }
    // Lay Trap on the elite springs on the first heavy or cast turn: the wind-up.
    const h = R.step(fight('hunter', 20, [], [elite(1)], { prep: noPet }), engage('lay_trap', 0)).state;
    assert.equal(st(h.fight.enemies[0].st, 'TRAP').turn, C.SIGNATURE_TURN);
    const rt = R.step(h, { type: 'PASS' }); // round 3 starts: the trap springs
    assert.deepEqual(brief(rt.events), [['stagger', 'ab_heavy', 'trap', 'STUN']]);
    assert.ok(st(rt.state.fight.enemies[0].st, 'OFF_BALANCE'));
    assert.deepEqual(brief(R.step(rt.state, { type: 'PASS' }).events), [], 'nothing more');
    assert.equal(stacks(rt.state.fight.enemies[0], 'STAGGERED'), 1);
    // SILENCED: Spellsnap on turn 1 (its 2-round silence covers turn 2): the Dark Cast becomes Bolt, answered.
    const m = toTurn(fight('mage', 20, ['spellsnap'], [elite(2)], { prep: tough }), 1);
    const rs = R.step(m, { type: 'CAST', spellId: 'spellsnap', target: 0 });
    const e = rs.state.fight.enemies[0];
    assert.deepEqual([e.intent.id, e.intent.replaced.id, e.intent.replaced.reason, e.intent.replaced.windup], ['bolt', 'ab_dark', 'silenced', true]);
    assert.deepEqual(brief(rs.events), [['stagger', 'ab_dark', 'silenced', 'SILENCED']]);
    assert.ok(!st(e.st, 'OFF_BALANCE'), 'no OFF_BALANCE: it was replaced, not interrupted');
  });

  test('answered: a heavy wind-up that costs the player 0 HP (a miss, a full WARD, the pet by TAUNT) gives OFF_BALANCE and a STAGGERED stack; a wind-up that is not heavy and costs 0 HP is neither', () => {
    const heavy = toTurn(fight('mage', 20, [], [elite(1)], { prep: tough }), C.SIGNATURE_TURN);
    for (const [what, prep, pred] of [['miss', null, MISS], ['WARD', ward, LAND]]) {
      const r = passDrawn(heavy, prep, pred);
      assert.deepEqual(brief(r.events), [['stagger', 'ab_heavy', 'avoided', null]], what);
      assert.ok(st(r.state.fight.enemies[0].st, 'OFF_BALANCE'), what);
      assert.equal(stacks(r.state.fight.enemies[0], 'EMPOWERED'), 0, what);
    }
    // TAUNT sends it to the pet: answered although the pet loses HP (rules 7.13 (3)).
    const h = toTurn(fight('hunter', 20, [], [elite(1)], { prep: petTough }), C.SIGNATURE_TURN);
    const rp = passDrawn(h, (x) => { petTough(x); x.fight.pet.st.push({ id: 'TAUNT', dur: 2 }); }, (d) => d[3] > 0.9, 6);
    assert.ok(rp.events.some((x) => x.t === 'damage' && x.src === 0 && x.dst === 'pet' && x.hpLost > 0));
    assert.deepEqual(brief(rp.events), [['stagger', 'ab_heavy', 'avoided', null]]);
    // Dark Cast (not heavy): a miss or a full WARD is neither.
    const cast = toTurn(fight('mage', 20, [], [elite(2)], { prep: tough }), C.SIGNATURE_TURN);
    for (const [prep, pred] of [[null, MISS], [ward, LAND]]) {
      const r = passDrawn(cast, prep, pred);
      assert.ok(ev(r.events, 'enemyAction').some((x) => x.u === 0 && x.id === 'ab_dark'));
      assert.deepEqual(results(r.events), []);
    }
  });

  test('landed: an EMPOWERED stack when its hit or rend costs the player or the pet HP (the pet by its own aggro draw too); cleave, curse and self_shield whenever played; self_heal when played; a dungeon boss stacks two', () => {
    let r = passDrawn(toTurn(fight('mage', 20, [], [elite(1)], { prep: tough }), C.SIGNATURE_TURN));
    assert.deepEqual(results(r.events).map((x) => [x.t, x.u, x.id, x.name, x.stacks, x.value]), [['empower', 0, 'ab_heavy', 'Fixture Heavy Blow', 1, C.EMPOWER_DMG]]);
    assert.ok(!st(r.state.fight.enemies[0].st, 'OFF_BALANCE'));
    assert.ok(ev(r.events, 'status').some((x) => x.u === 0 && x.id === 'EMPOWERED' && x.on && x.stacks === 1 && x.dur === null));
    // The pet by its own aggro draw (no TAUNT): landed.
    const h = toTurn(fight('hunter', 20, [], [elite(1)], { prep: petTough }), C.SIGNATURE_TURN);
    r = passDrawn(h, (x) => { petTough(x); x.fight.enemies[0].intent.target = 'pet'; }, (d) => d[3] > 0.9, 6);
    assert.ok(r.events.some((x) => x.t === 'damage' && x.src === 0 && x.dst === 'pet' && x.hpLost > 0));
    assert.deepEqual(brief(r.events), [['empower', 'ab_heavy']]);
    // Rend (z4): the hit costs HP, BLEED follows.
    r = passDrawn(toTurn(fight('mage', 20, [], [elite(4)], { prep: tough }), C.SIGNATURE_TURN));
    assert.ok(ev(r.events, 'status').some((x) => x.u === 'player' && x.id === 'BLEED' && x.on));
    assert.deepEqual(brief(r.events), [['empower', 'ab_rend']]);
    // Cleave, Curse, Shield: landed whenever played, a full WARD on the player included.
    for (const [z, id] of [[3, 'ab_cleave'], [5, 'ab_curse'], [6, 'ab_shield']]) {
      r = R.step(tweak(toTurn(fight('mage', 20, [], [elite(z)], { prep: tough }), C.SIGNATURE_TURN), ward), { type: 'PASS' });
      assert.ok(ev(r.events, 'enemyAction').some((x) => x.u === 0 && x.id === id), id);
      assert.deepEqual(brief(r.events), [['empower', id]], id);
    }
    // Self Heal (dungeon boss z5, turn SIGNATURE_TURN_2) played below 70 % HP. A heal keeps its pct (0.18, no
    // CAST_SCRIPT_MULT: D60), so it heals 18 % of its max HP.
    let b = toTurn(fight('mage', 20, [], [dboss(5)], { prep: tough }), C.SIGNATURE_TURN_2 - 1);
    b = R.step(tweak(b, (x) => { x.fight.enemies[0].hp = 0.5e6; }), { type: 'PASS' }).state;
    assert.deepEqual([b.fight.enemies[0].intent.id, b.fight.enemies[0].intent.windup, b.fight.enemies[0].intent.pct], ['ab_heal', true, 0.18]);
    r = R.step(b, { type: 'PASS' });
    assert.ok(ev(r.events, 'heal').some((x) => x.dst === 0 && x.spell === 'ab_heal' && x.amount === Math.round(0.18 * 1e6)), 'D60: no script multiplier on a heal');
    assert.deepEqual(brief(r.events), [['empower', 'ab_heal']]);
    // A dungeon boss stacks: both wind-ups land (z1: Dark Cast on turn 2, Heavy Blow on turn 4).
    b = fight('mage', 20, [], [dboss(1)], { prep: tough });
    r = passDrawn(toTurn(b, C.SIGNATURE_TURN));
    r = passDrawn(toTurn(r.state, C.SIGNATURE_TURN_2));
    const e = r.state.fight.enemies[0];
    assert.deepEqual(brief(r.events), [['empower', 'ab_heavy']]);
    assert.deepEqual([stacks(e, 'EMPOWERED'), st(e.st, 'EMPOWERED').value, stacks(e, 'STAGGERED')], [2, 2 * C.EMPOWER_DMG, 0]);
  });

  test('neither: a wind-up replaced for another reason (Self Heal not wounded) or skipped by Chrono Sigil gives no stack', () => {
    const b = toTurn(fight('mage', 20, [], [dboss(5)], { prep: tough }), C.SIGNATURE_TURN_2 - 1);
    const r = R.step(b, { type: 'PASS' });
    const it = r.state.fight.enemies[0].intent;
    assert.deepEqual([it.id, it.replaced.id, it.replaced.reason, it.replaced.windup], ['strike', 'ab_heal', 'not wounded', true]);
    assert.deepEqual(results(r.events), []);
    assert.deepEqual(results(R.step(r.state, { type: 'PASS' }).events), []);
    const m = toTurn(fight('mage', 20, ['chrono_sigil'], [elite(1)], { prep: tough }), C.SIGNATURE_TURN);
    const rc = R.step(m, { type: 'CAST', spellId: 'chrono_sigil', target: 0 });
    assert.equal(ev(rc.events, 'skip').length, 1);
    assert.deepEqual(results(rc.events), []);
    assert.deepEqual([stacks(rc.state.fight.enemies[0], 'STAGGERED'), stacks(rc.state.fight.enemies[0], 'EMPOWERED')], [0, 0]);
  });

  test('EMPOWERED and STAGGERED are the enemy\'s attacker modifiers (rules 7.2 step 2): +EMPOWER_DMG and -STAGGER_DMG per stack in its hits and in the estimates the track shows', () => {
    const s = toTurn(fight('mage', 40, [], [elite(1, 40)], { prep: tough }), 1); // round 2: turn 1 Strike
    const base = cloneState(s);
    const draws = forceDraws(base, 3, LAND);
    const hitOf = (events) => events.find((x) => x.t === 'damage' && x.src === 0 && x.dst === 'player').amount;
    const play = (prep) => { const c = tweak(s, prep); forceDraws(c, 3, (d) => d.join() === draws.join()); return R.step(c, { type: 'PASS' }); };
    const plain = R.step(base, { type: 'PASS' });
    const add = (em, sg) => (x) => {
      const e = x.fight.enemies[0];
      if (em) e.st.push({ id: 'EMPOWERED', dur: null, stacks: em, value: em * C.EMPOWER_DMG });
      if (sg) e.st.push({ id: 'STAGGERED', dur: null, stacks: sg, value: sg * C.STAGGER_DMG });
    };
    for (const [em, sg] of [[1, 0], [2, 0], [0, 1], [0, 2], [1, 1]]) {
      const r = play(add(em, sg));
      const want = 1 + em * C.EMPOWER_DMG - sg * C.STAGGER_DMG;
      const got = hitOf(r.events) / hitOf(plain.events);
      assert.ok(Math.abs(got - want) < 0.02, `${em} EMPOWERED, ${sg} STAGGERED: ${got} vs ${want}`);
      // The next round's track estimates (the heavy wind-up and the Strikes) carry the same factor.
      const ests = r.state.fight.enemies[0].track.map((x) => x.est);
      plain.state.fight.enemies[0].track.forEach((x, i) => { if (x.est > 0) assert.ok(Math.abs(ests[i] / x.est - want) < 0.02, `estimate turn ${x.turn}`); });
    }
  });

  test('the stacks are enemy statuses { id, dur: null, stacks, value }: nothing removes them before the fight ends (rounds, interrupts, dispersal of the player)', () => {
    const ready = (x) => { x.fight.p.energy = 100; x.fight.p.cp = 5; x.fight.p.cds = {}; };
    let b = toTurn(fight('rogue', 20, ['throat_jab', 'vanishing_step'], [dboss(1)], { prep: tough }), C.SIGNATURE_TURN);
    b = R.step(tweak(b, ready), { type: 'CAST', spellId: 'throat_jab', target: 0 }).state;
    b = passDrawn(toTurn(b, C.SIGNATURE_TURN_2)).state;
    const want = [{ id: 'STAGGERED', dur: null, stacks: 1, value: C.STAGGER_DMG }, { id: 'EMPOWERED', dur: null, stacks: 1, value: C.EMPOWER_DMG }];
    const mine = (s) => s.fight.enemies[0].st.filter((x) => x.id === 'STAGGERED' || x.id === 'EMPOWERED');
    assert.deepEqual(mine(b), want);
    b = R.step(tweak(b, ready), { type: 'CAST', spellId: 'vanishing_step', target: null }).state;
    for (let i = 0; i < 8; i++) b = R.step(tweak(b, ready), { type: i % 2 ? 'PASS' : 'CAST', spellId: 'throat_jab', target: 0 }).state;
    assert.deepEqual(mine(b), want, 'still there after 9 more rounds');
    assert.ok(b.fight.round >= 14);
  });
});

describe('rules 7.10 Disrupt (combat v2.1)', () => {
  const CONTROL = { rogue: 'sap', mage: 'binding_glyph', hunter: 'lay_trap' };
  const boss = (cls, extra = [], opts = {}) => fight(cls, 20, opts.spells || [], [dboss(1), ...extra], { petId: cls === 'hunter' ? 'ridgewolf' : undefined, prep: cls === 'hunter' ? noPet : tough, ...opts });

  test('on a dungeon boss every class\'s control option is Disrupt: a trap on its first visible wind-up that cancels that one entry at its turn\'s start (STUN for that turn only: OFF_BALANCE, STAGGERED) and does nothing else', () => {
    for (const cls of C.CLASS_IDS) {
      const s = boss(cls);
      const r = R.step(s, engage(CONTROL[cls], 0));
      assert.ok(ev(r.events, 'action').some((x) => x.kind === 'engage' && x.option === CONTROL[cls] && x.target === 0 && x.disrupt), cls);
      let e = r.state.fight.enemies[0];
      const trap = st(e.st, 'TRAP');
      assert.deepEqual([trap.turn, trap.stun, trap.disrupt], [C.SIGNATURE_TURN, 1, true], cls);
      assert.ok(!e.st.some((x) => x.id === 'SAPPED' || x.id === 'FROZEN' || x.id === 'STUN'), `${cls}: no SAPPED, no FROZEN`);
      assert.equal(e.wasSapped, false);
      assert.deepEqual(e.track.find((x) => x.turn === C.SIGNATURE_TURN).cancel, { by: 'TRAP', offBalance: true, stagger: true, breaks: false, done: false }, `${cls}: D52`);
      assert.equal(e.intent.id, 'strike', `${cls}: turn 1 plays`);
      // Round 3 starts: the trap springs on the Dark Cast.
      const r2 = R.step(r.state, { type: 'PASS' });
      e = r2.state.fight.enemies[0];
      assert.ok(ev(r2.events, 'trapSprung').some((x) => x.u === 0 && x.turn === C.SIGNATURE_TURN && x.disrupt), cls);
      assert.deepEqual([e.intent.cancelled.id, e.intent.cancelled.by, e.intent.cancelled.windup], ['ab_dark', 'STUN', true], cls);
      assert.equal(st(e.st, 'OFF_BALANCE').dur, C.OFFBAL_DURATION - 1, `${cls}: the player's next action`);
      assert.deepEqual(brief(r2.events), [['stagger', 'ab_dark', 'disrupt', 'STUN']], cls);
      // Only that entry: the boss does not act in round 3 and acts again in round 4 (its turn 3).
      const r3 = R.step(r2.state, { type: 'PASS' });
      assert.ok(!ev(r3.events, 'enemyAction').some((x) => x.u === 0), cls);
      assert.ok(!st(r3.state.fight.enemies[0].st, 'STUN'), `${cls}: STUN for that turn only`);
      const r4 = R.step(r3.state, { type: 'PASS' });
      assert.ok(ev(r4.events, 'enemyAction').some((x) => x.u === 0 && x.id === 'strike'), `${cls}: turn 3 plays`);
    }
    // The second wind-up (turn 4) still needs its own answer: it lands here, so the boss ends with one stack of each.
    const s = boss('mage');
    let r = R.step(s, engage('binding_glyph', 0));
    r = passDrawn(toTurn(r.state, C.SIGNATURE_TURN_2));
    const e = r.state.fight.enemies[0];
    assert.deepEqual([stacks(e, 'STAGGERED'), stacks(e, 'EMPOWERED')], [1, 1]);
    // Sap keeps the Rogue in STEALTH as usual (a stealthed Rogue against an immune enemy).
    const ro = fight('rogue', 20, [], [dboss(1)], { stealth: true, kind: 'quest', prep: tough });
    assert.ok(st(ro.fight.p.st, 'STEALTH'));
    assert.ok(st(R.step(ro, engage('sap', 0)).state.fight.p.st, 'STEALTH'));
  });

  test('Disrupt is legal only on a visible wind-up, in the engage round; legalActions and engageOptions list it; its preview is the one entry; autoplay rule E Disrupts the boss when it has adds (not alone; the Rogue never: Ambush)', () => {
    for (const cls of C.CLASS_IDS) {
      const s = boss(cls);
      const a = engage(CONTROL[cls], 0);
      assert.equal(R.whyIllegal(s, a), null, cls);
      assert.ok(R.legalActions(s).some((x) => x.type === 'ENGAGE' && x.option === CONTROL[cls] && x.target === 0), cls);
      const o = R.engageOptions(s).find((x) => x.id === CONTROL[cls]);
      assert.deepEqual([o.targets, o.disrupt, o.reason], [[0], [0], null], cls);
      assert.deepEqual(R.engagePreview(s, a), { enemies: [{ u: 0, cancelled: [C.SIGNATURE_TURN], offBalance: [C.SIGNATURE_TURN], window: [], pet: [], stagger: [C.SIGNATURE_TURN], disrupt: true }] }, cls);
      const none = tweak(s, (x) => { for (const y of x.fight.enemies[0].track) delete y.windup; });
      assert.match(R.whyIllegal(none, a), /Disrupt needs a wind-up/, cls);
      assert.equal(R.engagePreview(none, a), null);
      assert.match(R.whyIllegal(pass(s), a), /only in the engage round/, cls);
    }
    // Rule E (rules 7.9): with 2 or more enemies the control option goes to the enemy with the most track damage on
    // the player over turns 1..ENGAGE_AUTO_LOOK: the boss and its wind-up.
    for (const cls of ['mage', 'hunter']) {
      const s = boss(cls, [mob('z1_brute')]);
      assert.deepEqual(R.autoAction(s), engage(CONTROL[cls], 0), cls);
    }
    assert.deepEqual(R.autoAction(boss('rogue', [mob('z1_brute')])), engage('ambush', 0), 'the Rogue: Ambush on the default target');
    assert.deepEqual(R.autoAction(boss('hunter')), engage('opening_shot', 0), 'alone: the strike option');
    assert.deepEqual(R.autoAction(boss('mage', [], { spells: ['ember_bolt'] })), engage('precast', 0, 'ember_bolt'), 'alone: Pre-cast');
  });
});

describe('rules 7.10 setup values (combat v2.1, D57)', () => {
  test('Premeditate gives PREMED_CP = CP_MAX: a full Temple Blow (STUN stunMax) on the turn-2 wind-up from round 2, answered', () => {
    assert.equal(C.PREMED_CP, C.CP_MAX);
    let s = fight('rogue', 20, ['temple_blow'], [elite(1), mob('z1_caster')], { stealth: true, prep: tough });
    s = R.step(s, engage('premeditate')).state;
    assert.equal(s.fight.p.cp, C.CP_MAX);
    const r = R.step(tweak(s, (x) => { x.fight.p.energy = 100; }), { type: 'CAST', spellId: 'temple_blow', target: 0 });
    assert.ok(ev(r.events, 'status').some((x) => x.u === 0 && x.id === 'STUN' && x.on && x.dur === C.SPELL.temple_blow.stunMax), 'STUN stunMax (turns 1-3; rules 7.4 counts this round)');
    const e = r.state.fight.enemies[0];
    assert.deepEqual([e.intent.cancelled.id, stacks(e, 'STAGGERED')], ['ab_heavy', 1], 'the wind-up of turn 2 is cancelled at its start');
    assert.equal(R.step(r.state, { type: 'PASS' }).state.fight.enemies[0].intent.cancelled.by, 'STUN', 'turn 3 too');
  });

  test('Gathered Power: GATHER_SPELLS free damaging spells that always crit (GATHER_CRIT 1.0)', () => {
    let s = fight('mage', 20, ['ember_bolt'], [mob('z1_brute')], { prep: tough });
    s = R.step(s, engage('gather_power')).state;
    for (let i = 0; i < C.GATHER_SPELLS; i++) {
      const c = cloneState(s);
      forceDraws(c, 3, (d) => d[0] > 0.9 && d[1] > 0.99);
      const r = R.step(c, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
      assert.ok(r.events.find((x) => x.t === 'damage' && x.src === 'player' && x.dst === 0).crit, `gathered spell ${i + 1} crits on r2 > 0.99`);
      assert.ok(ev(r.events, 'action').some((x) => x.kind === 'cast' && x.cost === 0));
      s = r.state;
    }
    assert.equal(st(s.fight.p.st, 'GATHER'), null);
    assert.ok(C.GATHER_CRIT >= 1);
  });
});

describe('rules 7.11 the predicted cancel of a wind-up (D52, combat v2.1)', () => {
  test('a wind-up entry\'s predicted cancel says stagger: true, and the cancel then answers it', () => {
    const s = R.step(fight('mage', 20, [], [elite(1)], { prep: tough }), engage('binding_glyph', 0)).state; // FROZEN turns 1..2
    const tr = s.fight.enemies[0].track;
    assert.deepEqual(tr.find((x) => x.turn === C.SIGNATURE_TURN).cancel, { by: 'FROZEN', offBalance: true, stagger: true, breaks: false, done: false });
    assert.deepEqual(tr.find((x) => x.turn === 1).cancel, { by: 'FROZEN', offBalance: false, stagger: false, breaks: false, done: true });
    const r = R.step(s, { type: 'PASS' });
    assert.deepEqual(brief(r.events), [['stagger', 'ab_heavy', 'control', 'FROZEN']]);
    assert.deepEqual(r.state.fight.enemies[0].track[0].cancel, { by: 'FROZEN', offBalance: true, stagger: true, breaks: false, done: true });
  });
});

describe('combat v2.1: determinism and full runs', () => {
  /** autoAction, except that the engage round of a fight with a Disrupt target uses it (default autoplay never does: a
   * dungeon boss starts its fight alone, and rule E needs 2 enemies). */
  const disruptPolicy = (s) => {
    if (s.fight && R.isEngageRound(s)) for (const o of R.engageOptions(s) || []) if (o.disrupt.length) return engage(o.id, o.disrupt[0]);
    return R.autoAction(s);
  };

  /**
   * A full run with `policy`, checking after every step: every wind-up result belongs to an elite, rare or dungeon boss
   * of the fight, on SIGNATURE_TURN (a dungeon boss also SIGNATURE_TURN_2), at most one per wind-up; the enemies'
   * EMPOWERED and STAGGERED stacks equal their events; a fight starts without stacks. Returns counts.
   */
  function checkedRun(classId, seed, content, mapMode, policy, log = null) {
    let s = R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed, content, mapMode });
    const t = { stagger: 0, empower: 0, disrupt: 0, why: new Set(), fights: 0 };
    let kinds = [];
    let per = new Map();
    for (let n = 0; n < MAX_ACTIONS_PER_RUN && s.phase !== 'ENDED'; n++) {
      const a = policy(s);
      if (log) log.push(a);
      const r = R.step(s, a);
      let started = false;
      for (const e of r.events) {
        if (e.t === 'fight') { kinds = e.enemies.map((x) => x.kind); per = new Map(); t.fights++; started = true; }
        if (e.t === 'summon') kinds[e.u] = 'normal';
        if (e.t === 'action' && e.disrupt) t.disrupt++;
        if (e.t !== 'stagger' && e.t !== 'empower') continue;
        t[e.t]++;
        if (e.t === 'stagger') t.why.add(e.why);
        assert.ok(['elite', 'rare', 'dboss'].includes(kinds[e.u]), `${e.t} on a ${kinds[e.u]}`);
        assert.ok(e.turn === C.SIGNATURE_TURN || (kinds[e.u] === 'dboss' && e.turn === C.SIGNATURE_TURN_2), `turn ${e.turn}`);
        const key = `${e.u}:${e.turn}`;
        assert.ok(!per.has(key), `one result per wind-up (${key})`);
        per.set(key, e.t);
      }
      s = r.state;
      if (!s.fight) continue;
      for (const en of s.fight.enemies) {
        const count = (k) => [...per].filter(([key, v]) => key.startsWith(`${en.idx}:`) && v === k).length;
        assert.equal(stacks(en, 'STAGGERED'), count('stagger'), `seed ${seed} step ${n}`);
        assert.equal(stacks(en, 'EMPOWERED'), count('empower'), `seed ${seed} step ${n}`);
        if (started && per.size === 0) assert.ok(!st(en.st, 'STAGGERED') && !st(en.st, 'EMPOWERED'), 'a fight starts without stacks');
      }
    }
    assert.equal(s.phase, 'ENDED', `${classId} ${mapMode} seed ${seed}`);
    return { t, state: s };
  }

  test('same seed + same actions = same state through wind-ups, stacks and Disrupt; serialize/deserialize mid-fight with stacks; a full run replays from its action log', () => {
    let a = fight('hunter', 20, ['keen_shot', 'muzzle_shot', 'snare_trap'], [dboss(1)], { petId: 'ridgewolf' });
    let b = cloneState(a);
    let most = 0;
    for (let i = 0; i < 14 && a.fight; i++) {
      const act = i === 0 ? engage('lay_trap', 0) : R.autoAction(a);
      if (i > 0) assert.deepEqual(R.autoAction(b), act);
      a = R.step(a, act).state;
      b = R.step(R.deserialize(R.serialize(b), CONTENT), act).state;
      assert.equal(R.serialize(a), R.serialize(b), `step ${i}`);
      if (a.fight) most = Math.max(most, stacks(a.fight.enemies[0], 'STAGGERED') + stacks(a.fight.enemies[0], 'EMPOWERED'));
    }
    assert.ok(most >= 1, 'stacks were in the state');
    const content = REAL || CONTENT;
    const log = [];
    const { state } = checkedRun('mage', 31, content, 'rows', disruptPolicy, log);
    let c = R.newRun({ classId: 'mage', seed: 31, content });
    for (const x of log) c = R.step(c, x).state;
    assert.equal(R.serialize(c), R.serialize(state));
  });

  test('full autoplay runs per class in both map modes (fixture and real content) end; wind-up results are consistent with the state; a policy that Disrupts every dungeon boss ends too', () => {
    const all = { stagger: 0, empower: 0, disrupt: 0, why: new Set(), runs: 0 };
    const add = (t) => { all.stagger += t.stagger; all.empower += t.empower; all.disrupt += t.disrupt; for (const w of t.why) all.why.add(w); all.runs++; };
    for (const content of [CONTENT, REAL].filter(Boolean)) {
      for (const mapMode of ['rows', 'expedition']) {
        for (const cls of C.CLASS_IDS) {
          for (const seed of [5, 21, 44]) add(checkedRun(cls, seed, content, mapMode, R.autoAction).t);
          for (const seed of [8, 60]) add(checkedRun(cls, seed, content, mapMode, disruptPolicy).t);
        }
      }
    }
    assert.ok(all.runs >= 30);
    assert.ok(all.stagger > 0 && all.empower > 0 && all.disrupt > 0, JSON.stringify({ ...all, why: [...all.why] }));
    for (const w of ['interrupt', 'disrupt']) assert.ok(all.why.has(w), `answered by ${w} in full runs: ${[...all.why]}`);
  });
});
