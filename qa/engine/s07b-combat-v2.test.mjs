// rules.md 7.10-7.13 (combat v2, docs/specs/combat-v2.md): intent track, opening scripts and pack roles, engage
// round and options, off-balance windows, autoplay rule E, pacing, determinism. One test (at least) per rule.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  R, C, CONTENT, started, atLevel, withSpells, inFight, tweak, forceDraws, ev, st, cloneState, peek, STREAM, play,
} from './helpers.mjs';
import { makeRng, nextFloat } from '../../src/rng.js';
import { estSeconds } from '../../src/engine/summary.js';

const mob = (tid = 'z1_brute', level = 20, variant = 'normal') => ({ tid, level, variant });
/** A class at level L with these bar spells, in a fight (engage round on unless opts.engage === false). */
function fight(cls, L, spells, enemies, opts = {}) {
  let s = withSpells(atLevel(started(cls, { seed: opts.seed ?? 77, petId: opts.petId }), L), spells);
  if (opts.prep0) s = tweak(s, opts.prep0);
  s = inFight(s, enemies, { noStealth: !opts.stealth, kind: opts.kind || 'quest', engage: opts.engage }).state;
  return opts.prep ? tweak(s, opts.prep) : s;
}
const tough = (x) => { x.player.d.maxHp = x.player.hp = 1e6; for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; };
const stunAll = (x, dur = 9) => { for (const e of x.fight.enemies) if (e.alive) e.st.push({ id: 'STUN', dur }); };
const pass = (s, n = 1, prep = null) => { for (let i = 0; i < n; i++) s = R.step(prep ? tweak(s, prep) : s, { type: 'PASS' }).state; return s; };
const ids = (e) => e.track.map((x) => x.id);
const hit = (events, dst, src = 'player') => events.find((e) => e.t === 'damage' && e.dst === dst && e.src === src);
const engage = (option, target = null, spellId) => (C.ENGAGE_OPTION[option].target === 'spell' ? { type: 'ENGAGE', option, spellId, target } : { type: 'ENGAGE', option, target });
const advanced = (g, n) => { const x = g.slice(); for (let i = 0; i < n; i++) nextFloat(x); return x; };

describe('rules 7.11 intent track (combat v2)', () => {
  test('fight start: every enemy shows turns 1..INTENT_TRACK_LEN, is Unaware in the engage round, and its turn 1 is round 2', () => {
    let s = fight('mage', 20, [], [mob('z1_brute'), mob('z1_caster'), mob('z1_mender')], { prep: tough });
    for (const e of s.fight.enemies) {
      assert.deepEqual(e.track.map((x) => x.turn), [1, 2, 3]);
      assert.equal(e.intent.id, 'unaware');
      assert.equal(e.turn, 0);
      assert.equal(e.turn0, 2);
    }
    s = pass(s);
    for (const e of s.fight.enemies) {
      assert.equal(e.turn, 1);
      assert.deepEqual(e.track.map((x) => x.turn), [1, 2, 3], 'turn 1 is now: the track still shows 1..3');
      assert.equal(e.intent.turn, 1);
    }
    s = pass(s, 1, stunAll);
    for (const e of s.fight.enemies) assert.deepEqual(e.track.map((x) => x.turn), [2, 3, 4], 'the used head is dropped, one entry appended');
    assert.equal(C.INTENT_TRACK_LEN, 3);
    // The end boss has no engage round: its turn t is round t.
    let b = R.step(started('mage', { seed: 51 }), { type: 'LEAVE_HUB' }).state;
    b = play(tweak(atLevel(b, 60), (x) => { x.zone.z = 6; x.hours = 100; }), [{ type: 'TRAVEL_ON' }, { type: 'FIGHT_BOSS' }]).state;
    assert.equal(b.fight.engage, false);
    assert.deepEqual(b.fight.enemies[0].track.map((x) => x.turn), [1, 2, 3]);
    assert.equal(b.fight.enemies[0].intent.kind, 'boss');
  });

  test('draws happen only when an entry enters the track: scripted entries draw nothing, 1 pet-aggro draw per entry with a live pet (turn by turn, enemies in index order), round 1 -> 2 draws nothing, then 1 entry per enemy', () => {
    // Mage (no pet) vs 2 scripted enemies: no draw at fight start.
    const m = fight('mage', 20, [], [mob('z1_brute'), mob('z1_caster')]);
    assert.deepEqual(m.fight.rng, STREAM.fight(m.seed, 1, 1, 0, 0));
    // Hunter with a live pet: 6 aggro draws, turn-major: (e0 t1, e1 t1, e0 t2, e1 t2, e0 t3, e1 t3).
    const h = fight('hunter', 20, [], [mob('z1_brute'), mob('z1_caster')], { petId: 'ridgewolf' });
    const g = STREAM.fight(h.seed, 1, 1, 0, 0);
    const d = peek(g, 6);
    assert.deepEqual(h.fight.rng, advanced(g, 6));
    const aggro = (x) => (x < C.PET.ridgewolf.aggro ? 'pet' : 'player');
    for (let t = 0; t < 3; t++) for (let i = 0; i < 2; i++) assert.equal(h.fight.enemies[i].track[t].aggro, aggro(d[2 * t + i]), `enemy ${i} turn ${t + 1}`);
    // Round 1 -> 2: no entry is drawn (the tracks already hold turns 1..3).
    const r1 = cloneState(tweak(m, stunAll));
    const g1 = r1.fight.rng.slice();
    R.stepInPlace(r1, { type: 'PASS' });
    assert.deepEqual(r1.fight.rng, g1);
    // Round 2 -> 3 (enemies stunned, no pet): exactly 1 weighted-pick draw per living enemy.
    const g2 = r1.fight.rng.slice();
    R.stepInPlace(r1, { type: 'PASS' });
    assert.deepEqual(r1.fight.rng, advanced(g2, 2));
    assert.ok(r1.fight.enemies.every((e) => e.track.at(-1).turn === 4 && !e.track.at(-1).scripted));
  });

  test('entries are fixed facts once shown; a look-ahead with a re-seeded fight stream keeps them and re-draws only new entries', () => {
    const s0 = pass(fight('mage', 20, [], [mob('z1_brute'), mob('z1_caster'), mob('z1_beast')], { prep: tough }), 1, stunAll);
    const shown = s0.fight.enemies.map((e) => e.track.map((x) => `${x.turn}:${x.id}:${x.aggro}`));
    let a = s0;
    for (let i = 0; i < 4; i++) a = pass(a, 1, stunAll);
    for (const e of a.fight.enemies) {
      for (const x of e.track) {
        const before = shown[e.idx].find((y) => y.startsWith(`${x.turn}:`));
        if (before) assert.equal(`${x.turn}:${x.id}:${x.aggro}`, before, 'an entry never changes once shown');
      }
    }
    const differs = [];
    for (let seed = 1; seed <= 30; seed++) {
      let b = tweak(s0, (x) => { x.fight.rng = makeRng(seed); });
      b = pass(b, 2, stunAll);
      for (const e of b.fight.enemies) {
        for (const x of e.track) {
          const before = shown[e.idx].find((y) => y.startsWith(`${x.turn}:`));
          if (before) assert.equal(`${x.turn}:${x.id}:${x.aggro}`, before, 'shown entries do not depend on the stream');
          else differs.push(`${e.idx}:${x.turn}:${x.id}`);
        }
      }
    }
    assert.ok(new Set(differs).size > 3, 'new entries are re-drawn from the new stream');
  });

  test('weighted picks: off cooldown at that turn by the track (earlier entries within their cooldown), by e.cds, and by a later scripted entry', () => {
    const seen = { 4: new Set(), 5: new Set() };
    const boss4 = new Set();
    for (let seed = 0; seed < 120; seed++) {
      let s = fight('mage', 20, [], [mob('z1_caster')], { seed, prep: tough });
      s = pass(s, 3, stunAll); // round 4: turns 3..5 shown
      const e = s.fight.enemies[0];
      seen[4].add(e.track.find((x) => x.turn === 4).id);
      seen[5].add(e.track.find((x) => x.turn === 5).id);
      // Dungeon boss: ab_dark (cd 4) on turn 2, ab_heavy forced on turn 5 (cd 3): turn 4 can hold neither.
      let b = fight('mage', 20, [], [mob('z1_dboss', 20, 'dboss')], { seed, kind: 'dboss', prep: tough });
      b = pass(b, 3, stunAll);
      const be = b.fight.enemies[0];
      boss4.add(be.track.find((x) => x.turn === 4).id);
      assert.equal(be.track.find((x) => x.turn === 5).id, 'ab_heavy');
    }
    // Caster: hex_bolt on turn 2 (cd 3) and wither on turn 3 (cd 5): turn 4 only bolt; turn 5 bolt or hex_bolt.
    assert.deepEqual([...seen[4]], ['bolt']);
    assert.deepEqual([...seen[5]].sort(), ['bolt', 'hex_bolt']);
    assert.ok(!boss4.has('ab_heavy') && !boss4.has('ab_dark'), [...boss4].join());
    // e.cds: an ability on cooldown at that turn's round is never picked.
    let c = tweak(fight('mage', 20, [], [mob('z1_brute')], { prep: tough }), (x) => { x.fight.enemies[0].cds.heavy_smash = 99; });
    for (let i = 0; i < 8; i++) c = pass(c, 1, stunAll);
    assert.ok(c.fight.enemies[0].track.filter((x) => !x.scripted).every((x) => x.id === 'strike'));
  });

  test('control cancels the now-entry and leaves the later turns in place (a stun cancels, it does not delay)', () => {
    let s = fight('rogue', 20, ['temple_blow'], [mob('z1_brute')], { prep: tough });
    s = pass(s, 2); // round 3: turn 2 Heavy Smash is now
    const e = s.fight.enemies[0];
    assert.equal(e.intent.id, 'heavy_smash');
    const turn3 = e.track.find((x) => x.turn === 3).id;
    const r = R.step(tweak(s, (x) => { x.fight.p.cp = 1; }), { type: 'CAST', spellId: 'temple_blow', target: 0 });
    assert.equal(ev(r.events, 'enemyAction').length, 0);
    const c = ev(r.events, 'cancel')[0];
    assert.deepEqual([c.u, c.id, c.by, c.offBalance], [0, 'heavy_smash', 'STUN', true]);
    assert.ok(r.state.fight.enemies[0].intent.turn === 3 && r.state.fight.enemies[0].intent.id === turn3, 'turn 3 plays its own entry next round');
    // Control that is on when a turn starts cancels that turn's entry (intent Stunned, cancelled info).
    let f = fight('mage', 20, [], [mob('z1_brute')], { prep: tough });
    f = R.step(f, engage('binding_glyph', 0)).state;
    assert.equal(f.fight.enemies[0].intent.id, 'stunned');
    assert.equal(f.fight.enemies[0].intent.cancelled.id, 'strike');
    const r3 = R.step(f, { type: 'PASS' });
    assert.ok(ev(r3.events, 'cancel').some((x) => x.id === 'heavy_smash' && x.by === 'FROZEN' && x.offBalance));
    assert.ok(st(r3.state.fight.enemies[0].st, 'OFF_BALANCE'));
  });

  test('when an entry becomes now, conditions are checked: an entry that cannot be played becomes the basic attack (replaced, with the reason)', () => {
    // Mender alone at full HP: turn 3 Mend has no wounded ally.
    let s = fight('mage', 20, [], [mob('z1_mender')], { prep: tough });
    s = pass(s, 3);
    const e = s.fight.enemies[0];
    assert.equal(e.track[0].id, 'mend');
    assert.equal(e.intent.id, 'strike');
    assert.deepEqual(e.intent.replaced, { id: 'mend', name: 'Mend', reason: 'no wounded ally' });
    // SILENCED caster: turn 2 Hex Bolt (cast) becomes Bolt.
    let c = pass(fight('mage', 20, [], [mob('z1_caster')], { prep: tough }));
    c = tweak(c, (x) => { x.fight.enemies[0].st.push({ id: 'SILENCED', dur: 5 }); });
    const r = R.step(c, { type: 'PASS' });
    assert.ok(ev(r.events, 'replace').some((x) => x.from === 'hex_bolt' && x.to === 'bolt' && x.reason === 'silenced'));
    assert.equal(r.state.fight.enemies[0].intent.id, 'bolt');
    // A guardian with no ward: turn 1 Shield Ally becomes Strike.
    const g = pass(fight('mage', 20, [], [mob('z1_guardian')], { prep: tough }));
    assert.equal(g.fight.enemies[0].intent.replaced.reason, 'no ally to shield');
  });

  test('TAUNT and feign apply when an entry becomes now (and the track shows the pet for the turns they cover)', () => {
    let s = fight('hunter', 20, [], [mob('z1_brute'), mob('z1_beast')], { petId: 'ridgewolf', prep: tough });
    s = tweak(s, (x) => { x.player.d.petMaxHp = x.player.pet.hp = 1e6; for (const e of x.fight.enemies) for (const y of e.track) y.aggro = 'player'; });
    s = R.step(s, engage('send_pet', 0)).state; // TAUNT for PET_LEAD_TURNS turns
    for (const e of s.fight.enemies) {
      assert.deepEqual(e.track.map((x) => x.target), ['pet', 'pet', 'player'], 'turns 1-2 under TAUNT, turn 3 its own target');
      assert.equal(e.intent.target, 'pet');
    }
    const r = R.step(s, { type: 'PASS' });
    assert.ok(r.events.filter((x) => x.t === 'damage' && x.src !== 'player' && x.src !== 'pet' && !x.tick).every((x) => x.dst === 'pet'));
  });

  test('summoned adds draw their whole track at once, play no script and act from the next round', () => {
    let s = fight('mage', 20, [], [mob('z2_rare', 20, 'rare')], { prep: (x) => { x.player.d.maxHp = x.player.hp = 1e6; } });
    s = tweak(pass(s), (x) => { const e = x.fight.enemies[0]; e.hp = Math.floor(e.maxHp * 0.4); });
    s = R.step(s, { type: 'PASS' }).state; // round 3: the summon takes the turn
    assert.equal(s.fight.enemies[0].intent.kind, 'summon');
    assert.equal(s.fight.enemies[0].intent.replaced.reason, 'calls for help');
    const r = R.step(s, { type: 'PASS' });
    const add = r.state.fight.enemies[1];
    assert.ok(add && add.unscripted && add.turn0 === r.state.fight.round);
    assert.deepEqual(add.track.map((x) => x.turn), [1, 2, 3]);
    assert.ok(add.track.every((x) => !x.scripted));
    assert.equal(add.turn, 1);
    const sm = ev(r.events, 'summon')[0];
    assert.ok(r.events.indexOf(sm) < r.events.findIndex((x) => x.t === 'round'), 'appears during the enemy actions, turn 1 next round');
  });
});

describe('rules 7.12 opening scripts and pack roles (combat v2)', () => {
  test('every archetype plays its opening script on turns 1..OPENING_TURNS; a lone skulker strikes instead of Signal', () => {
    for (const arch of Object.keys(C.OPENING_SCRIPT)) {
      const s = fight('mage', 20, [], [mob(`z1_${arch}`), mob(arch === 'brute' ? 'z1_beast' : 'z1_brute')], { prep: tough });
      const e = s.fight.enemies[0];
      assert.deepEqual(ids(e), C.OPENING_SCRIPT[arch], arch);
      assert.ok(e.track.every((x) => x.scripted));
    }
    const lone = fight('mage', 20, [], [mob('z1_skulker')]);
    assert.deepEqual(ids(lone.fight.enemies[0]), ['rend', 'strike', 'strike']);
    assert.equal(C.OPENING_TURNS, 3);
  });

  test('elite, rare and dungeon boss: the highest-pct template ability on SIGNATURE_TURN (once abilities excluded); a dungeon boss its other ability on SIGNATURE_TURN_2', () => {
    const el = fight('mage', 20, [], [mob('z1_elite', 20, 'elite')]).fight.enemies[0];
    assert.deepEqual(ids(el), ['strike', 'ab_heavy', 'strike']);
    const rare = fight('mage', 20, [], [mob('z1_rare', 20, 'rare')]).fight.enemies[0]; // enrage (once) + heavy
    assert.equal(rare.track[1].id, 'ab_heavy');
    let b = fight('mage', 20, [], [mob('z1_dboss', 20, 'dboss')], { kind: 'dboss', prep: tough });
    assert.equal(b.fight.enemies[0].track[1].id, 'ab_dark', 'dark_cast 2.1 > heavy_blow 1.9');
    b = pass(b, 3, stunAll);
    assert.ok(b.fight.enemies[0].track.find((x) => x.turn === 5 && x.id === 'ab_heavy' && x.scripted));
    assert.deepEqual([C.SIGNATURE_TURN, C.SIGNATURE_TURN_2], [2, 5]);
  });

  test('scripted heavy and cast actions take HEAVY_SCRIPT_MULT and CAST_SCRIPT_MULT on their pct', () => {
    const brute = fight('mage', 20, [], [mob('z1_brute')]).fight.enemies[0];
    assert.equal(brute.track[1].pct, C.ARCHETYPE.brute.actions[1].pct * C.HEAVY_SCRIPT_MULT);
    const caster = fight('mage', 20, [], [mob('z1_caster')]).fight.enemies[0];
    assert.equal(caster.track[1].pct, C.ARCHETYPE.caster.actions[1].pct * C.CAST_SCRIPT_MULT);
    assert.equal(caster.track[0].pct, C.ARCHETYPE.caster.actions[0].pct, 'not heavy or cast: unchanged');
  });

  test('Signal: at the end of the round SIGNAL_ADDS normal enemy joins from the add pool at the skulker\'s level, without XP, coin or loot; once per fight; an interrupted Signal brings nobody', () => {
    let s = fight('mage', 24, ['spellsnap'], [mob('z1_skulker', 18), mob('z1_skulker', 18), mob('z1_brute', 18)], { prep: (x) => { tough(x); x.fight.enemies[2].st.push({ id: 'STUN', dur: 9 }); } });
    s = pass(s, 3); // round 4: both skulkers' turn 3 is Signal; the first calls, the second's is replaced
    assert.deepEqual(s.fight.enemies.slice(0, 2).map((e) => e.track[0].id), ['signal', 'signal']);
    assert.deepEqual(s.fight.enemies.slice(0, 2).map((e) => e.intent.id), ['signal', 'strike']);
    assert.equal(s.fight.enemies[1].intent.replaced.reason, 'help already called');
    const r = R.step(s, { type: 'PASS' });
    assert.equal(ev(r.events, 'signal').length, 1, 'once per fight');
    const sm = ev(r.events, 'summon');
    assert.equal(sm.length, C.SIGNAL_ADDS);
    assert.ok(sm[0].signal);
    const add = r.state.fight.enemies[sm[0].u];
    assert.ok(CONTENT.zones[0].normals.includes(add.tid) && add.level === 18 && add.noReward && add.kind === 'normal');
    assert.ok(r.events.findIndex((x) => x.t === 'summon') > r.events.findIndex((x) => x.t === 'signal'));
    assert.ok(r.state.fight.signalled);
    // Killing the reinforcement: no XP, coin or loot.
    const k = tweak(r.state, (x) => { const e = x.fight.enemies[sm[0].u]; e.hp = 1; e.dodge = 0; });
    forceDraws(k, 3, (d) => d[0] > 0.9);
    const kr = R.step(k, { type: 'ATTACK', target: sm[0].u });
    assert.ok(kr.events.some((x) => x.t === 'death' && x.u === sm[0].u));
    assert.equal(ev(kr.events, 'xp').length + ev(kr.events, 'gold').length, 0);
    assert.equal(kr.state.fight.drops.length, 0);
    // Interrupted: no add, the skulker is OFF_BALANCE.
    const it = R.step(s, { type: 'CAST', spellId: 'spellsnap', target: 0 });
    assert.ok(ev(it.events, 'interrupt').length === 1 && st(it.state.fight.enemies[0].st, 'OFF_BALANCE'));
    assert.equal(ev(it.events, 'summon').length, 0, 'Signal interrupted: nobody comes');
  });

  test('Bolster: the lowest-HP ally (self included) gains an enemy shield of BOLSTER_PCT × its max HP', () => {
    let s = fight('mage', 20, [], [mob('z1_mender'), mob('z1_brute')], { prep: (x) => { x.player.d.maxHp = x.player.hp = 1e6; x.fight.enemies[1].hp = Math.floor(x.fight.enemies[1].maxHp / 2); } });
    s = pass(s);
    assert.equal(s.fight.enemies[0].intent.id, 'bolster');
    assert.equal(s.fight.enemies[0].intent.target, 1);
    const r = R.step(s, { type: 'PASS' });
    const sh = ev(r.events, 'shield')[0];
    const b = r.state.fight.enemies[1];
    assert.deepEqual([sh.u, sh.by, sh.spell], [1, 0, 'bolster']);
    assert.equal(b.shield, Math.round(C.BOLSTER_PCT * b.maxHp));
    assert.equal(C.SCRIPT_ACTION.bolster.cd, C.BOLSTER_CD);
  });

  test('Bloodlust: a beast deals +BLOODLUST_STEP per turn it has acted, at most BLOODLUST_MAX', () => {
    const s = pass(fight('mage', 20, [], [mob('z1_beast')], { prep: tough }));
    const hitWith = (acted) => {
      const c = tweak(s, (x) => { const e = x.fight.enemies[0]; e.acted = acted; e.intent = { ...e.intent, id: 'bite', kind: 'hit', pct: 1, hits: 1, target: 'player', school: 'phys', heavy: false, cast: false, cd: 0 }; });
      forceDraws(c, 3, (d) => d[0] > 0.9 && d[1] > 0.1 && Math.abs(d[2] - 0.5) < 0.01);
      return hit(R.step(c, { type: 'PASS' }).events, 'player', 0).amount;
    };
    const base = hitWith(0);
    assert.ok(Math.abs(hitWith(3) / base - (1 + 3 * C.BLOODLUST_STEP)) < 0.02);
    assert.ok(Math.abs(hitWith(9) / base - (1 + C.BLOODLUST_MAX)) < 0.02, 'capped');
    const after = R.step(s, { type: 'PASS' }).state.fight.enemies[0];
    assert.equal(after.acted, 1, 'acting counts a turn');
    assert.ok(after.track.at(-1).est > s.fight.enemies[0].track.at(-1).est || after.track.at(-1).id !== s.fight.enemies[0].track.at(-1).id);
  });

  test('guardian ward: the lowest-index ally that is not a guardian, fixed at fight start; Shield Ally shields the ward', () => {
    let s = fight('mage', 20, [], [mob('z1_guardian'), mob('z1_caster'), mob('z1_brute')], { prep: tough });
    assert.equal(s.fight.enemies[0].ward, 1);
    s = pass(s);
    assert.equal(s.fight.enemies[0].intent.target, 1);
    const r = R.step(s, { type: 'PASS' });
    assert.ok(r.state.fight.enemies[1].st.some((x) => x.id === 'SHIELDED'));
    assert.ok(!r.state.fight.enemies[2].st.some((x) => x.id === 'SHIELDED'));
    assert.equal(fight('mage', 20, [], [mob('z1_guardian'), mob('z1_guardian')]).fight.enemies[0].ward, null);
  });

  test('ENGAGE_DMG_COMP: every template enemy deals × ENGAGE_DMG_COMP, except in the Rogue\'s fights (D48) other than its dungeon-boss fights (D49); the end boss and the Shards do not', () => {
    const free = (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * 15) * C.ARCHETYPE.brute.dmg;
    for (const [cls, petId] of [['mage'], ['hunter', 'ridgewolf']]) {
      const e = fight(cls, 20, [], [mob('z1_brute', 15)], { petId }).fight.enemies[0];
      assert.ok(Math.abs(e.dmg - free * C.ENGAGE_DMG_COMP) < 1e-9, cls);
    }
    // The Rogue: none, for the fight's enemies and for adds that join later (summon, Signal).
    const r = fight('rogue', 20, [], [mob('z1_brute', 15), mob('z1_skulker', 15)], { stealth: true });
    assert.ok(Math.abs(r.fight.enemies[0].dmg - free) < 1e-9, 'rogue');
    const sig = tweak(r, (x) => { x.fight.signalPending = { by: 1, level: 15, adds: 1 }; x.fight.signalled = true; });
    const add = R.step(sig, { type: 'PASS' }).state.fight.enemies[2];
    assert.ok(Math.abs(add.dmg - (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * 15) * C.ARCHETYPE[add.arch].dmg * sig.content.enemies[add.tid].dmgMult) < 1e-9, 'rogue: Signal add');
    // The Rogue's dungeon-boss fight pays it (no STEALTH start there, rules 5.3; D49): the boss and an add it summons.
    const db = fight('rogue', 20, [], [mob('z1_dboss', 15, 'dboss')], { kind: 'dboss', prep: (x) => { x.player.d.maxHp = x.player.hp = 1e6; } });
    const boss = db.fight.enemies[0];
    const bfree = (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * 15) * C.ARCHETYPE[boss.arch].dmg * C.VARIANT.dboss.dmg * db.content.enemies[boss.tid].dmgMult * R.zoneDanger(15, 'dboss');
    assert.ok(Math.abs(boss.dmg - bfree * C.ENGAGE_DMG_COMP) < 1e-9, 'rogue: dungeon boss');
    const sm = tweak(pass(db), (x) => { x.fight.enemies[0].intent = { id: 'ab_summon', name: 'Summon', kind: 'summon', count: 1, target: 'self', est: 0, turn: 1 }; });
    const dadd = R.step(sm, { type: 'PASS' }).state.fight.enemies[1];
    assert.ok(Math.abs(dadd.dmg - (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * dadd.level) * C.ARCHETYPE[dadd.arch].dmg * sm.content.enemies[dadd.tid].dmgMult * R.zoneDanger(dadd.level) * C.ENGAGE_DMG_COMP) < 1e-9, 'rogue: dungeon-boss add');
    // Its trash fights in the same dungeon stay exempt.
    const tr = fight('rogue', 20, [], [mob('z1_brute', 15, 'trash')], { kind: 'trash', stealth: true }).fight.enemies[0];
    assert.ok(Math.abs(tr.dmg - (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * 15) * C.ARCHETYPE.brute.dmg * C.VARIANT.trash.dmg * R.zoneDanger(15, 'trash')) < 1e-9, 'rogue: dungeon trash');
    let b = R.step(started('mage', { seed: 51 }), { type: 'LEAVE_HUB' }).state;
    b = play(tweak(atLevel(b, 60), (x) => { x.zone.z = 6; x.hours = 100; }), [{ type: 'TRAVEL_ON' }, { type: 'FIGHT_BOSS' }]).state;
    assert.equal(b.fight.enemies[0].dmg, C.BOSS_MELEE);
  });
});

describe('rules 7.13 off-balance (combat v2)', () => {
  /** Damage of the same forced draws on enemy 0 with and without a prep. */
  function pairHit(s, action, prep, pred = (d) => d[0] > 0.9 && d[1] > 0.6) {
    const a = cloneState(s);
    const draws = forceDraws(a, 3, pred);
    const b = tweak(s, prep);
    forceDraws(b, 3, (d) => d.join() === draws.join());
    return [hit(R.step(a, action).events, 0).amount, hit(R.step(b, action).events, 0).amount];
  }

  test('an interrupted cast leaves the enemy OFF_BALANCE (OFFBAL_DURATION): it takes +OFFBAL_TAKEN from the player and pet', () => {
    let s = pass(fight('mage', 20, ['spellsnap', 'ember_bolt'], [mob('z1_caster')], { prep: tough }));
    s = pass(s); // turn 2: Hex Bolt
    const r = R.step(s, { type: 'CAST', spellId: 'spellsnap', target: 0 });
    const ob = st(r.state.fight.enemies[0].st, 'OFF_BALANCE');
    assert.ok(ob && ob.value === C.OFFBAL_TAKEN && ob.dur === C.OFFBAL_DURATION - 1, 'one round already counted');
    assert.ok(ev(r.events, 'offBalance').some((x) => x.why === 'interrupt' && x.id === 'hex_bolt'));
    const [plain, open] = pairHit(tweak(r.state, (x) => { x.fight.enemies[0].st = []; }), { type: 'CAST', spellId: 'ember_bolt', target: 0 }, (x) => { x.fight.enemies[0].st.push({ id: 'OFF_BALANCE', dur: 1, value: C.OFFBAL_TAKEN }); });
    assert.ok(Math.abs(open / plain - (1 + C.OFFBAL_TAKEN)) < 0.02, `${open}/${plain}`);
  });

  test('OFF_BALANCE: the player\'s crit chance +OFFBAL_CRIT and its dodge 0; a FROZEN enemy counts as OFF_BALANCE (not both)', () => {
    const s = pass(fight('rogue', 20, [], [mob('z1_skulker')], { prep: (x) => { tough(x); stunAll(x); } }));
    const crit = s.player.d.crit;
    const critDraw = (d) => d[0] > 0.9 && d[1] > crit + 0.02 && d[1] < crit + C.OFFBAL_CRIT - 0.02;
    const c0 = cloneState(s);
    forceDraws(c0, 3, critDraw);
    assert.ok(!hit(R.step(c0, { type: 'ATTACK', target: 0 }).events, 0).crit);
    const c1 = tweak(s, (x) => { x.fight.enemies[0].st.push({ id: 'OFF_BALANCE', dur: 1, value: C.OFFBAL_TAKEN }); });
    forceDraws(c1, 3, critDraw);
    assert.ok(hit(R.step(c1, { type: 'ATTACK', target: 0 }).events, 0).crit, '+OFFBAL_CRIT');
    // Dodge 0: a draw in the skulker's dodge band hits an OFF_BALANCE skulker.
    const e = s.fight.enemies[0];
    const dodgeDraw = (d) => d[0] > C.MISS_BASE + 0.01 && d[0] < C.MISS_BASE + e.dodge - 0.01;
    const d0 = cloneState(s);
    forceDraws(d0, 3, dodgeDraw);
    assert.ok(R.step(d0, { type: 'ATTACK', target: 0 }).events.some((x) => x.t === 'miss' && x.dodge));
    const d1 = tweak(s, (x) => { x.fight.enemies[0].st.push({ id: 'OFF_BALANCE', dur: 1, value: C.OFFBAL_TAKEN }); });
    forceDraws(d1, 3, dodgeDraw);
    assert.ok(hit(R.step(d1, { type: 'ATTACK', target: 0 }).events, 0), 'dodge 0');
    // FROZEN counts, once.
    const m = pass(fight('mage', 20, ['ember_bolt'], [mob('z1_brute')], { prep: (x) => { tough(x); stunAll(x); } }));
    const cast = { type: 'CAST', spellId: 'ember_bolt', target: 0 };
    const [p, fr] = pairHit(m, cast, (x) => { x.fight.enemies[0].st.push({ id: 'FROZEN', dur: 2 }); });
    assert.ok(Math.abs(fr / p - (1 + C.OFFBAL_TAKEN)) < 0.02);
    const [p2, both] = pairHit(m, cast, (x) => { x.fight.enemies[0].st.push({ id: 'FROZEN', dur: 2 }, { id: 'OFF_BALANCE', dur: 1, value: C.OFFBAL_TAKEN }); });
    assert.ok(Math.abs(both / p2 - (1 + C.OFFBAL_TAKEN)) < 0.02, 'never both');
    assert.ok(R.offBalance(tweak(m, (x) => { x.fight.enemies[0].st.push({ id: 'FROZEN', dur: 2 }); }), 0).status === 'FROZEN');
    assert.equal(R.offBalance(m, 0), null);
  });

  test('a heavy action that costs the player 0 HP (miss, WARD, IMMUNE, sent to the pet by TAUNT) leaves the enemy OFF_BALANCE; one that hits, or hits the pet by its own aggro, does not', () => {
    const at = (cls, prep, petId) => {
      let s = fight(cls, 20, [], [mob('z1_brute')], { petId, prep: (x) => { tough(x); if (x.player.pet) { x.player.d.petMaxHp = x.player.pet.hp = 1e6; } } });
      s = pass(s, 2);
      assert.equal(s.fight.enemies[0].intent.id, 'heavy_smash');
      return tweak(s, prep || (() => {}));
    };
    const ob = (s, pred) => { const c = cloneState(s); forceDraws(c, 3, pred); const r = R.step(c, { type: 'PASS' }); return { on: !!st(r.state.fight.enemies[0].st, 'OFF_BALANCE'), r }; };
    const land = (d) => d[0] > 0.9;
    assert.equal(ob(at('mage'), land).on, false, 'the hit lands');
    assert.equal(ob(at('mage'), (d) => d[0] < 0.01).on, true, 'miss');
    const w = ob(at('mage', (x) => { x.fight.p.st.push({ id: 'WARD', dur: 4, amount: 1e7 }); }), land);
    assert.equal(w.on, true, 'absorbed by WARD');
    assert.ok(ev(w.r.events, 'offBalance').some((x) => x.why === 'avoided'));
    assert.equal(ob(at('mage', (x) => { x.fight.p.st.push({ id: 'IMMUNE', dur: 2 }); }), land).on, true, 'IMMUNE');
    assert.equal(ob(at('hunter', (x) => { x.fight.pet.st.push({ id: 'TAUNT', dur: 2 }); }, 'ridgewolf'), land).on, true, 'sent to the pet by TAUNT');
    assert.equal(ob(at('hunter', (x) => { x.fight.enemies[0].intent.target = 'pet'; }, 'ridgewolf'), land).on, false, 'the pet by its own aggro draw');
  });

  test('duration: through the next round when gained by the player\'s action or an enemy action; this round only when gained at the start of a round', () => {
    // Player action (interrupt): on in this round and the next, gone after.
    let s = pass(fight('mage', 20, ['spellsnap'], [mob('z1_caster')], { prep: tough }), 2);
    s = R.step(s, { type: 'CAST', spellId: 'spellsnap', target: 0 }).state;
    assert.ok(st(s.fight.enemies[0].st, 'OFF_BALANCE'), 'on for the next round');
    s = pass(s);
    assert.ok(!st(s.fight.enemies[0].st, 'OFF_BALANCE'));
    // Start of a round (control already on cancels a heavy): on this round only.
    let g = R.step(fight('mage', 20, [], [mob('z1_brute')], { prep: tough }), engage('binding_glyph', 0)).state;
    g = pass(g); // round 3: turn 2 Heavy Smash cancelled at its start
    const o = st(g.fight.enemies[0].st, 'OFF_BALANCE');
    assert.ok(o && o.dur === C.OFFBAL_DURATION - 1);
    g = pass(g, 1, (x) => { x.fight.enemies[0].st = x.fight.enemies[0].st.filter((y) => y.id !== 'FROZEN'); });
    assert.ok(!st(g.fight.enemies[0].st, 'OFF_BALANCE'), 'gone after that round');
  });

  test('end boss: an interrupted Collapse Litany and a Gravity Crush that costs the player 0 HP leave it OFF_BALANCE (+OFFBAL_BOSS_TAKEN)', () => {
    const immortal = (x) => { x.player.d.maxHp = 1e9; x.player.hp = 1e9; };
    let b = R.step(started('mage', { seed: 51 }), { type: 'LEAVE_HUB' }).state;
    b = withSpells(atLevel(b, 60), ['spellsnap']);
    b = play(tweak(b, (x) => { x.zone.z = 6; x.hours = 100; }), [{ type: 'TRAVEL_ON' }, { type: 'FIGHT_BOSS' }]).state;
    b = pass(b, 2, immortal); // round 3: Litany 1/2
    const c = cloneState(tweak(b, immortal));
    forceDraws(c, 3, (d) => d[0] > 0.9);
    const r = R.step(c, { type: 'CAST', spellId: 'spellsnap', target: 0 });
    const ob = st(r.state.fight.enemies[0].st, 'OFF_BALANCE');
    assert.ok(ob && ob.value === C.OFFBAL_BOSS_TAKEN);
    let k = tweak(b, immortal);
    while (!k.fight.enemies[0].intent.actions.some((a) => a.id === 'gravity_crush')) k = pass(k, 1, immortal);
    const w = tweak(k, (x) => { immortal(x); x.fight.p.st.push({ id: 'WARD', dur: 9, amount: 1e7 }); });
    const rw = R.step(w, { type: 'PASS' });
    assert.ok(ev(rw.events, 'offBalance').some((x) => x.u === 0 && x.id === 'gravity_crush' && x.why === 'avoided'));
  });
});

describe('rules 7.10 engage round (combat v2)', () => {
  test('legalActions offers ENGAGE only in the engage round (never in round 2 or in the end-boss fight); each listed ENGAGE steps', () => {
    for (const [cls, petId] of [['rogue'], ['mage'], ['hunter', 'ridgewolf']]) {
      const s = fight(cls, 30, cls === 'mage' ? ['ember_bolt', 'arcane_ward'] : [], [mob('z1_brute', 30), mob('z1_caster', 30)], { petId, stealth: cls === 'rogue', prep: tough });
      const list = R.legalActions(s).filter((a) => a.type === 'ENGAGE');
      assert.deepEqual([...new Set(list.map((a) => a.option))], C.ENGAGE_OPTIONS[cls], cls);
      assert.ok(R.isEngageRound(s));
      for (const a of list) assert.doesNotThrow(() => R.step(s, a), JSON.stringify(a));
      const t = pass(s);
      assert.equal(R.legalActions(t).filter((a) => a.type === 'ENGAGE').length, 0, `${cls}: not in round 2`);
      assert.match(R.whyIllegal(t, list[0]), /only in the engage round/);
      assert.equal(R.engageOptions(t), null);
    }
    let b = R.step(started('rogue', { seed: 51 }), { type: 'LEAVE_HUB' }).state;
    b = play(tweak(atLevel(b, 60), (x) => { x.zone.z = 6; x.hours = 100; }), [{ type: 'TRAVEL_ON' }, { type: 'FIGHT_BOSS' }]).state;
    assert.equal(b.fight.round, 1);
    assert.equal(R.legalActions(b).filter((a) => a.type === 'ENGAGE').length, 0, 'end boss: no engage round');
    assert.ok(!R.isEngageRound(b));
    assert.ok(R.isLegal(fight('mage', 20, [], [mob()]), { type: 'FLEE' }), 'FLEE stays legal in the engage round');
  });

  test('control options cannot target an enemy immune to control (dungeon boss): engageOptions greys them with a reason', () => {
    const s = fight('hunter', 30, [], [mob('z1_dboss', 30, 'dboss')], { kind: 'dboss', petId: 'ridgewolf' });
    assert.match(R.whyIllegal(s, engage('lay_trap', 0)), /cannot be controlled/);
    const opts = R.engageOptions(s);
    assert.deepEqual(opts.map((o) => o.id), C.ENGAGE_OPTIONS.hunter);
    const trap = opts.find((o) => o.id === 'lay_trap');
    assert.deepEqual(trap.targets, []);
    assert.match(trap.reason, /cannot be controlled/);
    assert.deepEqual(opts.find((o) => o.id === 'opening_shot').targets, [0]);
    assert.equal(opts.find((o) => o.id === 'lay_trap').kind, 'control');
  });

  test('Ambush: Gutting Jab × AMBUSH_MULT (+2 CP) before Shadowstep Strike is learned, then Shadowstep Strike; the Rogue stays in STEALTH like after an opener (D48)', () => {
    const s = fight('rogue', 3, [], [mob('z1_brute', 3)], { stealth: true, prep: tough });
    const d = s.player.d;
    const c = cloneState(s);
    const draws = forceDraws(c, 3, (x) => x[0] > 0.9 && x[1] > 0.6);
    const r = R.step(c, engage('ambush', 0));
    const want = Math.round(((6 + 1.3 * 3 + 0.55 * d.power + d.wd) * C.AMBUSH_MULT * (0.9 + 0.2 * draws[2])) * (1 - Math.min(0.75, s.fight.enemies[0].armor / (s.fight.enemies[0].armor + 40 * 3 + 100))) + 1e-9);
    assert.equal(hit(r.events, 0).amount, want);
    assert.equal(hit(r.events, 0).spell, 'gutting_jab');
    assert.equal(r.state.fight.p.cp, 2);
    assert.ok(st(r.state.fight.p.st, 'STEALTH'), 'D48: Ambush keeps STEALTH');
    assert.ok(!ev(r.events, 'status').some((x) => x.id === 'STEALTH' && !x.on));
    assert.ok(ev(r.events, 'action').some((x) => x.kind === 'engage' && x.option === 'ambush'));
    const l = fight('rogue', 10, ['shadowstep_strike'], [mob('z1_brute', 10)], { stealth: true, prep: tough });
    const rl = R.step(l, engage('ambush', 0));
    assert.ok(rl.events.some((x) => (x.t === 'damage' || x.t === 'miss') && x.spell === 'shadowstep_strike'));
    // As after a CAST of the opener: round 2 can open again from STEALTH; a non-opener action then removes it.
    const viaCast = R.step(l, { type: 'CAST', spellId: 'shadowstep_strike', target: 0 }).state;
    assert.equal(!!st(rl.state.fight.p.st, 'STEALTH'), !!st(viaCast.fight.p.st, 'STEALTH'));
    const t2 = tweak(rl.state, (x) => { x.fight.p.energy = 100; });
    assert.ok(R.isLegal(t2, { type: 'CAST', spellId: 'shadowstep_strike', target: 0 }));
    assert.ok(!st(R.step(t2, { type: 'ATTACK', target: 0 }).state.fight.p.st, 'STEALTH'));
  });

  test('Sap: SAPPED for SAP_TURNS turns (cancels them), broken by any damage; Sap and Premeditate keep the Rogue in STEALTH; Premeditate +PREMED_CP CP', () => {
    const s = fight('rogue', 20, ['shadowstep_strike'], [mob('z1_brute'), mob('z1_caster')], { stealth: true, prep: tough });
    let t = R.step(s, engage('sap', 0)).state;
    assert.ok(st(t.fight.p.st, 'STEALTH'));
    assert.equal(t.fight.enemies[0].intent.id, 'sapped');
    let cancelled = 0;
    for (let i = 0; i < 3; i++) {
      const r = R.step(tweak(t, (x) => { x.fight.enemies[1].st.push({ id: 'STUN', dur: 1 }); }), { type: 'PASS' });
      cancelled += ev(r.events, 'enemyAction').filter((x) => x.u === 0).length === 0 ? 1 : 0;
      t = r.state;
    }
    assert.equal(cancelled, C.SAP_TURNS);
    assert.ok(!st(t.fight.enemies[0].st, 'SAPPED'), 'gone after SAP_TURNS turns');
    // Broken by damage (a DOT tick counts).
    const b = R.step(s, engage('sap', 0)).state;
    const dot = tweak(b, (x) => { x.fight.enemies[0].st.push({ id: 'BLEED', src: 'test', dur: 3, tick: 5 }); });
    assert.ok(!st(R.step(dot, { type: 'PASS' }).state.fight.enemies[0].st, 'SAPPED'));
    assert.equal(R.defaultTarget(b), 1, 'autoplay does not hit the sapped enemy');
    const pm = R.step(s, engage('premeditate')).state;
    assert.equal(pm.fight.p.cp, C.PREMED_CP);
    assert.ok(st(pm.fight.p.st, 'STEALTH'));
    assert.ok(R.isLegal(pm, { type: 'CAST', spellId: 'shadowstep_strike', target: 1 }), 'round 2 can still open from STEALTH');
  });

  test('Pre-cast: one bar spell at 0 mana, its cooldown starts; Binding Glyph: FROZEN for GLYPH_TURNS turns, not broken by damage', () => {
    const s = fight('mage', 20, ['arcane_ward', 'ember_bolt'], [mob('z1_brute'), mob('z1_caster')], { prep: tough });
    const r = R.step(s, engage('precast', null, 'arcane_ward'));
    assert.equal(r.state.player.mana, Math.min(s.player.d.maxMana, s.player.mana + Math.round(C.MANA_REGEN_ROUND_PCT * s.player.d.maxMana)));
    assert.ok(st(r.state.fight.p.st, 'WARD'));
    assert.equal(r.state.fight.p.cds.arcane_ward, 1 + C.SPELL.arcane_ward.cd);
    assert.ok(ev(r.events, 'action').some((x) => x.kind === 'cast' && x.engage === 'precast' && x.cost === 0));
    assert.match(R.whyIllegal(s, engage('precast', 0, 'frost_lance')), /action bar/);
    let g = R.step(s, engage('binding_glyph', 1)).state;
    assert.equal(st(g.fight.enemies[1].st, 'FROZEN').dur, C.GLYPH_TURNS);
    g = R.step(tweak(g, (x) => { x.player.mana = x.player.d.maxMana; }), { type: 'CAST', spellId: 'ember_bolt', target: 1 }).state;
    assert.ok(st(g.fight.enemies[1].st, 'FROZEN'), 'not broken by damage');
    g = pass(g);
    assert.ok(!st(g.fight.enemies[1].st, 'FROZEN'));
  });

  test('Gathered Power: the next GATHER_SPELLS damaging spells cost 0 mana and have +GATHER_CRIT crit chance; then normal', () => {
    let s = fight('mage', 20, ['ember_bolt', 'arcane_ward'], [mob('z1_brute')], { prep: tough });
    s = R.step(s, engage('gather_power')).state;
    assert.equal(st(s.fight.p.st, 'GATHER').stacks, C.GATHER_SPELLS);
    assert.equal(R.spellCost(s, 'ember_bolt'), 0);
    assert.ok(R.spellCost(s, 'arcane_ward') > 0, 'not a damaging spell');
    const crit = s.player.d.crit;
    const c = cloneState(s);
    forceDraws(c, 3, (d) => d[0] > 0.9 && d[1] > crit + 0.05 && d[1] < crit + C.GATHER_CRIT - 0.05);
    const r = R.step(c, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
    assert.ok(hit(r.events, 0).crit, '+GATHER_CRIT');
    assert.equal(r.state.player.mana, Math.min(s.player.d.maxMana, s.player.mana + Math.round(C.MANA_REGEN_ROUND_PCT * s.player.d.maxMana)), 'free');
    const t = R.step(r.state, { type: 'CAST', spellId: 'ember_bolt', target: 0 }).state;
    assert.ok(!st(t.fight.p.st, 'GATHER'), 'used up');
    assert.ok(R.spellCost(t, 'ember_bolt') > 0);
  });

  test('Opening Shot: Keen Shot × OPENING_SHOT_MULT, then MARKED (Mark Prey\'s value) for OPENING_MARK_ROUNDS rounds', () => {
    const s = fight('hunter', 20, [], [mob('z1_brute')], { petId: 'ridgewolf', prep: (x) => { tough(x); x.player.pet.alive = false; } });
    const d = s.player.d;
    const c = cloneState(s);
    const draws = forceDraws(c, 3, (x) => x[0] > 0.9 && x[1] > 0.6);
    const r = R.step(c, engage('opening_shot', 0));
    const e = s.fight.enemies[0];
    const want = Math.round((5 + 1.1 * 20 + 0.5 * d.power + 0.9 * d.wd) * C.OPENING_SHOT_MULT * (0.9 + 0.2 * draws[2]) * (1 - Math.min(0.75, e.armor / (e.armor + 40 * 20 + 100))) + 1e-9);
    assert.equal(hit(r.events, 0).amount, want);
    const m = st(r.state.fight.enemies[0].st, 'MARKED');
    assert.ok(m && m.value === C.SPELL.mark_prey.marked && m.dur === C.OPENING_MARK_ROUNDS - 1);
  });

  test('Lay Trap: springs on the first heavy or cast turn of 1..INTENT_TRACK_LEN (STUN, cancelled, OFF_BALANCE), else on turn 1 (no OFF_BALANCE)', () => {
    let s = fight('hunter', 20, [], [mob('z1_brute'), mob('z1_mender')], { petId: 'ridgewolf', prep: (x) => { tough(x); x.player.pet.alive = false; } });
    s = R.step(s, engage('lay_trap', 0)).state; // round 2 starts: turn 1
    assert.equal(st(s.fight.enemies[0].st, 'TRAP').turn, 2, 'Heavy Smash on turn 2');
    assert.equal(s.fight.enemies[0].intent.id, 'strike', 'not yet on turn 1');
    const r = R.step(s, { type: 'PASS' });
    assert.ok(ev(r.events, 'trapSprung').some((x) => x.u === 0 && x.turn === 2));
    assert.ok(ev(r.events, 'cancel').some((x) => x.u === 0 && x.id === 'heavy_smash' && x.by === 'STUN'));
    assert.ok(st(r.state.fight.enemies[0].st, 'OFF_BALANCE'));
    assert.equal(st(r.state.fight.enemies[0].st, 'STUN').dur, C.TRAP_STUN);
    // A beast has no heavy or cast in turns 1-3: the trap springs on turn 1 without OFF_BALANCE.
    let b = fight('hunter', 20, [], [mob('z1_beast'), mob('z1_brute')], { petId: 'ridgewolf', prep: (x) => { tough(x); x.player.pet.alive = false; } });
    b = R.step(b, engage('lay_trap', 0));
    assert.ok(ev(b.events, 'trapSprung').some((x) => x.u === 0 && x.turn === 1));
    assert.ok(!st(b.state.fight.enemies[0].st, 'OFF_BALANCE'));
  });

  test('Send the Pet: needs a live pet; pet TAUNT and PET_LEAD (-PET_LEAD_DR damage taken) for PET_LEAD_TURNS turns', () => {
    const s = fight('hunter', 20, [], [mob('z1_brute')], { petId: 'ridgewolf', prep: tough });
    const r = R.step(s, engage('send_pet', 0)).state;
    assert.equal(st(r.fight.pet.st, 'TAUNT').dur, C.PET_LEAD_TURNS);
    assert.equal(st(r.fight.pet.st, 'PET_LEAD').value, C.PET_LEAD_DR);
    assert.match(R.whyIllegal(tweak(s, (x) => { x.player.pet.alive = false; }), engage('send_pet', 0)), /live pet/);
    // -PET_LEAD_DR on hits the pet takes (same draws).
    const t = pass(tweak(r, (x) => { x.player.d.petMaxHp = x.player.pet.hp = 1e6; }));
    const hitPet = (prep) => {
      const c = tweak(t, (x) => { prep(x); x.fight.enemies[0].intent = { ...x.fight.enemies[0].intent, kind: 'hit', pct: 1, hits: 1, target: 'pet', heavy: false, cast: false, school: 'magic' }; x.fight.p.target = null; x.player.pet.alive = true; });
      forceDraws(c, 6, (d) => d[3] > 0.9 && d[4] > 0.6);
      return R.step(c, { type: 'PASS' }).events.find((e) => e.t === 'damage' && e.dst === 'pet' && e.src === 0).amount;
    };
    const ratio = hitPet(() => {}) / hitPet((x) => { x.fight.pet.st = x.fight.pet.st.filter((y) => y.id !== 'PET_LEAD'); });
    assert.ok(Math.abs(ratio - (1 - C.PET_LEAD_DR)) < 0.03, `${ratio}`);
  });

  test('engagePreview (engage panel hover): the turns it shows cancelled, OFF_BALANCE, FROZEN and sent to the pet are the ones play shows; no draw; null when not legal; damage options change no entry', () => {
    const noPet = (x) => { tough(x); x.player.pet.alive = false; };
    const petUp = (x) => { tough(x); x.player.d.petMaxHp = x.player.pet.hp = 1e6; };
    const cases = [
      ['mage', ['hexbind'], [mob('z1_brute', 30), mob('z1_caster', 30)], engage('precast', 0, 'hexbind'), {}],
      ['mage', ['rime_burst'], [mob('z1_brute', 30), mob('z1_caster', 30)], engage('precast', null, 'rime_burst'), {}],
      ['mage', [], [mob('z1_brute', 30), mob('z1_caster', 30)], engage('binding_glyph', 1), {}],
      ['rogue', [], [mob('z1_caster', 30), mob('z1_brute', 30)], engage('sap', 0), { stealth: true }],
      ['hunter', [], [mob('z1_brute', 30), mob('z1_mender', 30)], engage('lay_trap', 0), { petId: 'ridgewolf', prep: noPet }],
      ['hunter', [], [mob('z1_beast', 30), mob('z1_brute', 30)], engage('lay_trap', 0), { petId: 'ridgewolf', prep: noPet }],
      ['hunter', [], [mob('z1_brute', 30), mob('z1_skulker', 30)], engage('send_pet', 0), { petId: 'ridgewolf', prep: petUp }],
    ];
    for (const [cls, spells, mobs, a, o] of cases) {
      const s = fight(cls, 30, spells, mobs, { prep: tough, ...o });
      const before = R.serialize(s);
      const p = R.engagePreview(s, a);
      assert.equal(R.serialize(s), before, 'no draw, no change');
      // Play it out with PASS (no damage on the enemies) and read what the tracks did on turns 1..INTENT_TRACK_LEN.
      const seen = new Map();
      const at = (u) => { if (!seen.has(u)) seen.set(u, { u, cancelled: [], offBalance: [], window: [], pet: [] }); return seen.get(u); };
      let r = R.step(s, a);
      for (let k = 0; k < C.INTENT_TRACK_LEN; k++) {
        for (const x of ev(r.events, 'cancel')) {
          at(x.u).cancelled.push(x.turn);
          if (x.offBalance) at(x.u).offBalance.push(x.turn);
          if (x.by === 'FROZEN') at(x.u).window.push(x.turn);
        }
        for (const e of r.state.fight.enemies) if (e.alive && e.intent.target === 'pet' && e.turn <= C.PET_LEAD_TURNS) at(e.idx).pet.push(e.turn);
        r = R.step(r.state, { type: 'PASS' });
      }
      const want = [...seen.values()].filter((x) => x.cancelled.length || x.pet.length).sort((x, y) => x.u - y.u);
      assert.deepEqual(p.enemies.slice().sort((x, y) => x.u - y.u), want, `${a.option} ${a.spellId || ''}`);
    }
    const m = fight('mage', 30, ['ember_bolt'], [mob('z1_brute', 30), mob('z1_caster', 30)], { prep: tough });
    assert.deepEqual(R.engagePreview(m, engage('precast', 0, 'ember_bolt')), { enemies: [] });
    assert.deepEqual(R.engagePreview(m, engage('gather_power')), { enemies: [] });
    assert.equal(R.engagePreview(m, engage('sap', 0)), null, 'not a Mage option');
    assert.equal(R.engagePreview(pass(m), engage('binding_glyph', 1)), null, 'not in round 2');
    assert.equal(R.engagePreview(m, { type: 'PASS' }), null);
  });
});

describe('rules 7.9 rule E and pacing (combat v2)', () => {
  test('rule E: control on the enemy with the most track damage on the player over turns 1..ENGAGE_AUTO_LOOK; else the strike option on the default target', () => {
    const s = fight('mage', 20, [], [mob('z1_mender'), mob('z1_brute'), mob('z1_caster')], { prep: tough });
    const dmg = (e) => e.track.filter((x) => x.turn <= C.ENGAGE_AUTO_LOOK && (x.target === 'player' || x.target === 'all')).reduce((n, x) => n + x.est, 0);
    const most = [...s.fight.enemies].sort((a, b) => dmg(b) - dmg(a) || a.idx - b.idx)[0].idx;
    assert.deepEqual(R.autoAction(s), engage('binding_glyph', most));
    const h = fight('hunter', 20, [], [mob('z1_mender'), mob('z1_brute'), mob('z1_caster')], { petId: 'ridgewolf', prep: tough });
    const hmost = [...h.fight.enemies].sort((a, b) => dmg(b) - dmg(a) || a.idx - b.idx)[0].idx;
    assert.deepEqual(R.autoAction(h), engage('lay_trap', hmost));
    const one = fight('rogue', 20, [], [mob('z1_brute')], { stealth: true });
    assert.deepEqual(R.autoAction(one), engage('ambush', 0));
    const h1 = fight('hunter', 20, [], [mob('z1_beast')], { petId: 'ridgewolf' });
    assert.deepEqual(R.autoAction(h1), engage('opening_shot', 0));
    const m = fight('mage', 20, ['arcane_ward', 'ember_bolt'], [mob('z1_brute')]);
    assert.deepEqual(R.autoAction(m), engage('precast', null, 'arcane_ward'), 'Mage: Pre-cast of the first bar spell whose condition holds');
    // Ties: the default-target order.
    const tie = fight('mage', 20, [], [mob('z1_brute'), mob('z1_brute')], { prep: (x) => { x.fight.enemies[1].hp -= 5; } });
    assert.deepEqual(R.autoAction(tie), engage('binding_glyph', 1));
    // After the engage round: rules 1-6 (no ENGAGE).
    assert.notEqual(R.autoAction(pass(s)).type, 'ENGAGE');
  });

  test('D49 / D48 (rules 7.9): the Rogue\'s rule E never uses Sap (Ambush on the default target); after a manual Sap the default target never switches back to the sapped enemy while another enemy lives', () => {
    // Whatever the tracks show, the Rogue's rule E is Ambush on the default target; Sap stays legal (manual).
    const big = (i) => (x) => { tough(x); for (const y of x.fight.enemies[i].track) y.est = 999; };
    for (const [mobs, i] of [[[mob('z1_beast'), mob('z1_brute')], 0], [[mob('z1_mender'), mob('z1_brute'), mob('z1_caster')], 1], [[mob('z1_caster'), mob('z1_skulker')], 1]]) {
      const r = fight('rogue', 20, [], mobs, { stealth: true, prep: big(i) });
      assert.deepEqual(R.autoAction(r), engage('ambush', R.defaultTarget(r)), mobs.map((m) => m.tid).join('+'));
      assert.ok(R.isLegal(r, engage('sap', i)), 'Sap stays a manual option');
    }
    assert.deepEqual(R.autoAction(fight('mage', 20, [], [mob('z1_beast'), mob('z1_brute')], { prep: big(0) })), engage('binding_glyph', 0), 'other classes keep their control option');
    // Manual Sap on the caster: the Rogue fights the brute and stays on it after the caster wakes, although casters rank first.
    let s = fight('rogue', 20, [], [mob('z1_caster'), mob('z1_brute')], { stealth: true, prep: tough });
    assert.equal(R.defaultTarget(s), 0, 'caster first without a Sap');
    s = R.step(s, engage('sap', 0)).state;
    assert.equal(s.fight.enemies[0].wasSapped, true);
    assert.equal(R.defaultTarget(s), 1);
    s = pass(s, C.SAP_TURNS);
    assert.ok(!st(s.fight.enemies[0].st, 'SAPPED'), 'awake');
    assert.equal(R.defaultTarget(s), 1, 'no switch back while the brute lives');
    assert.equal(R.autoAction(s).target, 1);
    const last = tweak(s, (x) => { x.fight.enemies[1].alive = false; x.fight.enemies[1].hp = 0; });
    assert.equal(R.defaultTarget(last), 0, 'the sapped enemy once no other is left');
  });

  test('pacing (rules 3): PACE_ENGAGE_S per fight with an engage round in the manual profile only; round terms 3.1 s and 1.1 s', () => {
    const st0 = { nodesTotal: 0, zonesLeft: 0, quests: 0, fights: 0, rounds: 0, equipDrops: 0, levelUps: 0, talentPoints: 0, rests: 0, shrines: 0, treasures: 0, vendorVisits: 0, vendorTx: 0, trainerVisits: 0, trainerTx: 0, reachedBoss: false, engages: 0 };
    const add = (o) => ({ ...st0, ...o });
    assert.equal(estSeconds(add({ engages: 5 }), 'manual') - estSeconds(st0, 'manual'), 5 * C.PACE_ENGAGE_S);
    assert.equal(estSeconds(add({ engages: 5 }), 'auto'), estSeconds(st0, 'auto'));
    assert.ok(Math.abs(estSeconds(add({ rounds: 10 }), 'manual') - estSeconds(st0, 'manual') - 31) < 1e-9);
    assert.ok(Math.abs(estSeconds(add({ rounds: 10 }), 'auto') - estSeconds(st0, 'auto') - 11) < 1e-9);
    const s = fight('mage', 20, [], [mob()]);
    assert.equal(s.stats.engages, started('mage').stats.engages + 1);
  });
});

describe('combat v2: determinism, state version, full runs', () => {
  test('same seed + same actions = same state through engage rounds; serialize/deserialize mid-track; STATE_VERSION 2 refuses older states', () => {
    let a = fight('hunter', 20, [], [mob('z1_skulker'), mob('z1_mender'), mob('z1_beast')], { petId: 'ridgewolf' });
    let b = cloneState(a);
    for (let i = 0; i < 6 && a.fight; i++) {
      const act = R.autoAction(a);
      assert.deepEqual(R.autoAction(b), act);
      a = R.step(a, act).state;
      const copy = R.deserialize(R.serialize(b), CONTENT);
      b = R.step(copy, act).state;
      assert.equal(R.serialize(a), R.serialize(b), `step ${i}`);
    }
    assert.equal(R.STATE_VERSION, 2);
    const old = JSON.parse(R.serialize(a));
    old.v = 1;
    assert.throws(() => R.deserialize(JSON.stringify(old), CONTENT), /state version 1/);
  });

  test('full autoplay runs per class complete; every fight but the end boss opens with an engage round and an ENGAGE or a bar action', () => {
    for (const cls of C.CLASS_IDS) {
      for (const seed of [3, 4]) {
        let s = R.newRun({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, content: CONTENT });
        let fights = 0;
        let engageRounds = 0;
        let engages = 0;
        for (let n = 0; n < 20000 && s.phase !== 'ENDED'; n++) {
          const a = R.autoAction(s);
          if (a.type === 'ENGAGE') engages++;
          const r = R.step(s, a);
          for (const e of r.events) {
            if (e.t === 'fight') { fights++; assert.equal(e.engage, e.kind !== 'boss'); }
            if (e.t === 'round' && e.engage) engageRounds++;
          }
          s = r.state;
        }
        assert.equal(s.phase, 'ENDED', `${cls} ${seed}`);
        assert.ok(engageRounds >= fights - 1 && engages > 0, `${cls} ${seed}: ${fights} fights, ${engageRounds} engage rounds, ${engages} ENGAGE`);
      }
    }
  });
});

describe('rules 7.14 encounter composition and the add pool (combat v2)', () => {
  test('validEncounter: 2+ enemies hold 2+ archetypes; 3+ hold a caster, mender, skulker or beast; a guardian is never alone with menders', async () => {
    const { validEncounter } = await import('../../src/engine/map.js');
    const v = (...a) => validEncounter(CONTENT, a.map((x) => `z1_${x}`));
    assert.ok(v('brute') && v('brute', 'caster') && v('brute', 'guardian', 'beast') && v('guardian', 'mender', 'caster'));
    assert.ok(!v('brute', 'brute'), 'one archetype');
    assert.ok(!v('brute', 'guardian', 'brute'), '3 without caster, mender, skulker or beast');
    assert.ok(!v('guardian', 'mender') && !v('guardian', 'mender', 'mender'), 'guardian alone with menders');
  });

  test('every generated encounter is valid (quests, grind waves, elite + add, dungeon trash, Camp waves); a valid draw costs no extra draw', async () => {
    const { setupNode, validEncounter, composeEncounter } = await import('../../src/engine/map.js');
    const s = cloneState(started('rogue', { seed: 1 }));
    let n = 0;
    for (let seed = 0; seed < 150; seed++) {
      s.seed = seed;
      for (let z = 1; z <= 6; z++) {
        const q = setupNode(s, z, 3, 1, 'quest');
        const g = setupNode(s, z, 2, 0, 'grind');
        const el = setupNode(s, z, 4, 2, 'elite');
        const d = setupNode(s, z, 5, 0, 'dungeon');
        for (const enc of [q.mobs, ...g.waves, el.add ? [el.elite, el.add] : [], ...d.trash]) { assert.ok(validEncounter(CONTENT, enc), `seed ${seed} zone ${z}: ${enc.join(',')}`); n++; }
      }
    }
    assert.ok(n > 3000);
    let c = R.step(started('mage', { seed: 51 }), { type: 'LEAVE_HUB' }).state;
    c = tweak(atLevel(c, 60), (x) => { x.zone.z = 6; });
    c = play(c, [{ type: 'TRAVEL_ON' }]).state;
    for (let w = 0; w < 30; w++) {
      const f = R.step(tweak(c, (x) => { x.camp.waves = w; }), { type: 'CAMP_GRIND' }).state.fight;
      assert.ok(validEncounter(CONTENT, f.enemies.map((e) => e.tid)));
    }
    const g = makeRng(9);
    const before = g.slice();
    assert.deepEqual(composeEncounter(CONTENT, g, ['z1_brute', 'z1_caster'], CONTENT.zones[0].normals), ['z1_brute', 'z1_caster']);
    assert.deepEqual(g, before, 'a valid encounter draws nothing');
    const fixed = composeEncounter(CONTENT, g, ['z1_brute', 'z1_brute'], ['z1_brute'], CONTENT.zones[0].normals);
    assert.ok(fixed[0] === 'z1_brute' && fixed[1] !== 'z1_brute' && validEncounter(CONTENT, fixed), 'the last enemy is redrawn, from the fallback when the pool cannot fix it');
    assert.deepEqual(g, advanced(before, 1), 'one draw');
  });

  test('add pool: zone `addPool` for summons and Signal in node fights, else the zone normals; validated against the zone normals', () => {
    let s = R.step(started('mage', { seed: 4 }), { type: 'LEAVE_HUB' }).state;
    s = R.step(s, { type: 'CHOOSE_NODE', lane: R.mapView(s).rows[0].findIndex((n) => n.type === 'quest') }).state;
    assert.deepEqual(s.fight.addPool, CONTENT.zones[0].addPool);
    const bad = { ...CONTENT, zones: CONTENT.zones.map((z, i) => (i === 1 ? { ...z, addPool: ['z1_brute'] } : z)) };
    assert.ok(R.validateContent(bad).some((e) => /zones\[1\]\.addPool: "z1_brute" is not a normal of z2/.test(e)));
    assert.deepEqual(R.validateContent(CONTENT), []);
  });

  test('mapView shows one archetype per enemy for treasure guards and each dungeon fight (a pull can be planned from the map)', () => {
    for (let seed = 1; seed < 40; seed++) {
      const v = R.mapView(R.step(started('rogue', { seed }), { type: 'LEAVE_HUB' }).state);
      const s = R.step(started('rogue', { seed }), { type: 'LEAVE_HUB' }).state;
      v.rows.forEach((row, r) => row.forEach((n, l) => {
        const def = s.zone.rows[r][l];
        if (n.type === 'treasure') assert.deepEqual(n.archetypes, def.guard ? [CONTENT.enemies[def.guard].archetype] : []);
        if (n.type === 'dungeon') {
          assert.deepEqual(n.fights, def.trash.map((f) => f.map((t) => CONTENT.enemies[t].archetype)));
          assert.equal(n.bossArchetype, CONTENT.enemies[def.boss].archetype);
        }
      }));
    }
  });
});
