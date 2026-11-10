// QA rule tests, rules.md section 6: the talents qa/engine/s06 does not assert (about 45 of 81), including
// Glacier Spike ×1.5 and Crippling Toxin, which an engine test names but does not check.
// Method: the same fight with and without the talent, the same forced random draws, compare the result.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, withTalents, inFight, tweak, forceDraws, ev, st, cloneState } from './helpers.mjs';

const mob = (tid = 'z1_guardian', level = 30) => ({ tid, level, variant: 'normal' });
function fightWith(classId, L, spells, talents, { enemies, prep, stealth = false } = {}) {
  let s = withTalents(withSpells(atLevel(started(classId, { seed: 61 }), L), spells), talents);
  s = inFight(s, enemies || [mob('z1_guardian', L)], { noStealth: !stealth }).state;
  return tweak(s, (x) => {
    for (const e of x.fight.enemies) { e.maxHp = e.hp = 1e7; e.st.push({ id: 'STUN', dur: 20 }); }
    if (x.player.pet && classId === 'hunter') x.fight.pet.st = [];
    if (prep) prep(x);
  });
}
/** Step with the next n draws forced (default: a plain hit, no crit, mid variance). */
function act(s, a, pred = (d) => d[0] > 0.9 && d[1] > 0.97 && d[2] > 0.45 && d[2] < 0.55, n = 3) {
  const c = cloneState(s);
  const draws = forceDraws(c, n, pred);
  return { ...R.step(c, a), draws };
}
/** Same action, same draws, with and without the talents: the ratio of the picked value. */
function ratio(classId, L, spells, talents, a, { pick, prep, enemies, stealth, n = 3, pred } = {}) {
  const get = pick || ((r) => r.events.find((e) => e.t === 'damage' && e.src === 'player').amount);
  const r1 = act(fightWith(classId, L, spells, {}, { prep, enemies, stealth }), a, pred, n);
  const c2 = cloneState(fightWith(classId, L, spells, talents, { prep, enemies, stealth }));
  forceDraws(c2, n, (d) => d.join() === r1.draws.join());
  const r2 = R.step(c2, a);
  return get(r2) / get(r1);
}
const near = (x, want, what, tol = 0.02) => assert.ok(Math.abs(x - want) <= tol, `${what}: ${x.toFixed(3)} vs ${want}`);
const dotOn = (r, id, src) => st(r.state.fight.enemies[0].st.filter((x) => !src || x.src === src), id);

describe('rules 6 talents: damage modifiers (same draws, with / without)', () => {
  const cast = (spellId, target = 0) => ({ type: 'CAST', spellId, target });
  test('Rogue: Silent Footing, Night Instinct, Whetted Whirl, Ambusher\'s Patience, Septic Edge, Fester', () => {
    const stealthy = (x) => x.fight.p.st.push({ id: 'STEALTH', dur: null });
    near(ratio('rogue', 30, ['shadowstep_strike'], { r_b1: 3 }, cast('shadowstep_strike'), { prep: stealthy }), 1.3, 'Silent Footing 3 (openers +10 %/rank)');
    near(ratio('rogue', 30, ['shadowstep_strike'], { r_b8: 3 }, cast('shadowstep_strike'), { prep: stealthy }), 1.15, 'Night Instinct 3 (+5 %/rank in STEALTH)');
    near(ratio('rogue', 30, ['whirling_edges'], { r_a8: 2 }, cast('whirling_edges', null)), 1.3, 'Whetted Whirl 2 (+15 %/rank)');
    const ww = act(fightWith('rogue', 30, ['whirling_edges'], { r_a8: 2 }), cast('whirling_edges', null));
    assert.equal(ww.state.fight.p.cp, 1 + 2, 'Whetted Whirl: +1 CP per rank');
    const five = (x) => { x.fight.p.cp = 5; };
    near(ratio('rogue', 30, ['severing_flourish'], { r_b6: 2 }, cast('severing_flourish'), { prep: five }), 1.4, 'Ambusher\'s Patience 2 (first finisher +20 %/rank)');
    const r2 = act(fightWith('rogue', 30, ['severing_flourish'], { r_b6: 2 }, { prep: five }), cast('severing_flourish'));
    const r3 = act(tweak(r2.state, (x) => { x.fight.p.cp = 5; x.fight.p.energy = 100; }), cast('severing_flourish'));
    const plain = act(tweak(r2.state, (x) => { x.fight.p.cp = 5; x.fight.p.energy = 100; x.player.talents = {}; }), cast('severing_flourish'), (d) => d.join() === r3.draws.join());
    near(r3.events.find((e) => e.t === 'damage' && e.src === 'player').amount / plain.events.find((e) => e.t === 'damage' && e.src === 'player').amount, 1, 'Ambusher\'s Patience: second finisher unchanged');
    const poisoned = (x) => x.fight.enemies[0].st.push({ id: 'POISON', dur: 4, tick: 1, stacks: 5, max: 5, src: 'toxic' });
    near(ratio('rogue', 30, ['gutting_jab'], { r_c6: 2 }, cast('gutting_jab'), { prep: poisoned }), 1.4, 'Septic Edge 2 (+4 % per POISON stack per rank, 5 stacks)');
    const veined = (x) => x.fight.enemies[0].st.push({ id: 'BLEED', src: 'open_vein', dur: 4, tick: 1 });
    near(ratio('rogue', 30, ['gutting_jab'], { r_c8: 3 }, cast('gutting_jab'), { prep: veined }), 1.09, 'Fester 3 (+3 %/rank vs Open Vein)');
  });

  test('Mage: Brittle (CHILLED and FROZEN targets), Glacier Spike ×1.5 vs CHILLED', () => {
    const chilled = (x) => x.fight.enemies[0].st.push({ id: 'CHILLED', dur: 3, value: C.CHILL_PCT });
    near(ratio('mage', 30, ['ember_bolt'], { m_b4: 2 }, cast('ember_bolt'), { prep: chilled }), 1.12, 'Brittle 2 vs CHILLED');
    const frozen = (x) => x.fight.enemies[0].st.push({ id: 'FROZEN', dur: 3 });
    near(ratio('mage', 30, ['ember_bolt'], { m_b4: 2 }, cast('ember_bolt'), { prep: frozen }), 1.12, 'Brittle 2 vs FROZEN');
    const spike = (prep) => { const s = fightWith('mage', 50, ['glacier_spike'], {}, { prep: (x) => { x.player.spells.glacier_spike = { tl: 50, rank: 1 }; if (prep) prep(x); } }); return s; };
    const a = act(spike(), cast('glacier_spike'));
    const b = cloneState(spike(chilled));
    forceDraws(b, 3, (d) => d.join() === a.draws.join());
    const hit = (r) => r.events.find((e) => e.t === 'damage' && e.spell === 'glacier_spike').amount;
    near(hit(R.step(b, cast('glacier_spike'))) / hit(a), 1.5, 'Glacier Spike vs CHILLED');
  });

  test('Mage: Barrage Mastery (Starlance Barrage +15 %/rank); Conflagrant Core (3 rounds: fire spells free, +0.50 crit)', () => {
    near(ratio('mage', 50, ['starlance_barrage'], { m_c6: 2 }, cast('starlance_barrage'), { n: 9, pred: (d) => d[0] > 0.9 && d[1] > 0.97 }), 1.3, 'Barrage Mastery 2');
    let s = fightWith('mage', 60, ['conflagrant_core', 'ember_bolt'], {}, { prep: (x) => { x.player.spells.conflagrant_core = { tl: 60, rank: 1 }; } });
    const base = s.player.d.crit;
    s = act(s, cast('conflagrant_core', null), () => true, 1).state;
    assert.equal(R.spellCost(s, 'ember_bolt'), 0, 'fire spells cost 0');
    const r = act(s, cast('ember_bolt'), (d) => d[0] > 0.9 && d[1] > base + 0.1 && d[1] < base + 0.45);
    assert.ok(r.events.find((e) => e.t === 'damage' && e.spell === 'ember_bolt').crit, '+0.50 crit');
    assert.equal(R.spellCooldown(s, 'conflagrant_core'), 12);
  });

  test('Hunter: Piercing Volley, Pack Leader, Cornered Beast, Savage Mastery', () => {
    const noPet = (x) => { x.player.pet = null; };
    near(ratio('hunter', 30, ['volley_rain'], { h_b6: 2 }, cast('volley_rain', null), { prep: noPet }), 1.4, 'Piercing Volley 2 (+20 %/rank)');
    near(ratio('hunter', 30, ['keen_shot'], { h_a6: 2 }, cast('keen_shot'), { n: 6, pred: (d) => d[0] > 0.9 && d[1] > 0.97 && Math.abs(d[2] - 0.5) < 0.05 && d[3] > 0.9 }), 1.125, 'Pack Leader 2 (+6.25 %/rank, pet alive; M2 v5)');
    const low = (x) => { x.player.pet = null; x.player.hp = Math.floor(x.player.d.maxHp * 0.4); };
    near(ratio('hunter', 30, ['keen_shot'], { h_c8: 3 }, cast('keen_shot'), { prep: low }), 1.24, 'Cornered Beast 3 (+8 %/rank below 50 % HP; M2 v2)');
    const pick = (r) => r.events.find((e) => e.t === 'damage' && e.spell === 'savage_order').amount;
    near(ratio('hunter', 40, ['savage_order'], { h_a7: 2 }, cast('savage_order'), { pick }), 1.25, 'Savage Mastery 2 (+12.5 %/rank; M2 v5)');
    assert.equal(R.spellCooldown(withTalents(atLevel(started('hunter'), 40), { h_a7: 2 }), 'savage_order'), 4 - 2, 'Savage Mastery: CD -1/rank');
  });
});

describe('rules 6 talents: DOTs, heals, wards and statuses', () => {
  const cast = (spellId, target = 0) => ({ type: 'CAST', spellId, target });
  const tickOf = (classId, L, spell, talents, id, prep) => {
    const r = act(fightWith(classId, L, [spell], talents, { prep }), cast(spell), () => true, 1);
    return dotOn(r, id, spell);
  };
  test('Deep Wounds, Hemorrhage Mastery (Open Vein); Smoldering (Living Flame); Barbed Mastery, Venom Barbs (Barbed Arrow)', () => {
    const cp5 = (x) => { x.fight.p.cp = 5; };
    const ov = tickOf('rogue', 30, 'open_vein', {}, 'BLEED', cp5).tick;
    near(tickOf('rogue', 30, 'open_vein', { r_c2: 3 }, 'BLEED', cp5).tick / ov, 1.27, 'Deep Wounds 3 (+9 %/rank; M2 v2)');
    near(tickOf('rogue', 30, 'open_vein', { r_c5: 2 }, 'BLEED', cp5).tick / ov, 1.1, 'Hemorrhage Mastery 2 (DOT +10 %)');
    const lf = tickOf('mage', 30, 'living_flame', {}, 'BURN');
    const lf2 = tickOf('mage', 30, 'living_flame', { m_a3: 2 }, 'BURN');
    near(lf2.tick / lf.tick, 1.2, 'Smoldering 2 (+10 %/rank)');
    assert.equal(lf2.dur, lf.dur + 2, 'Smoldering: +1 round per rank');
    const noPet = (x) => { x.player.pet = null; };
    const ba = tickOf('hunter', 30, 'barbed_arrow', {}, 'BLEED', noPet).tick;
    near(tickOf('hunter', 30, 'barbed_arrow', { h_c2: 3 }, 'BLEED', noPet).tick / ba, 1.6, 'Barbed Mastery 3 (+20 %/rank; M2 v2)', 0.035);
    let s = fightWith('hunter', 30, ['barbed_arrow'], { h_c6: 2 }, { prep: noPet });
    for (let i = 0; i < 5; i++) s = act(tweak(s, (x) => { x.fight.p.focus = 100; }), cast('barbed_arrow'), () => true, 1).state;
    const stacks = s.fight.enemies[0].st.filter((x) => x.id === 'BLEED' && x.src === 'barbed_arrow');
    const n = stacks.length === 1 ? stacks[0].stacks || 1 : stacks.length;
    assert.equal(n, 1 + 2, 'Venom Barbs 2: Barbed Arrow stacks to 1 + rank');
  });

  test('Field Medic (Field Dressing heal), Lattice Ward and Ward Weaving (Arcane Ward), Deep Mark (MARKED), Deep Chill (CHILLED)', () => {
    const fd = (talents) => {
      const r = act(fightWith('hunter', 30, ['field_dressing'], talents, { prep: (x) => { x.player.pet = null; x.player.hp = 1; } }), cast('field_dressing', null), () => true, 1);
      return ev(r.events, 'heal')[0].amount;
    };
    near(fd({ h_c4: 2 }) / fd({}), 1.4, 'Field Medic 2 (+20 %/rank)');
    const ward = (talents) => st(act(fightWith('mage', 30, ['arcane_ward'], talents), cast('arcane_ward', null), () => true, 1).state.fight.p.st, 'WARD').amount;
    const w0 = ward({});
    near(ward({ m_b7: 2 }) / w0, 1.3, 'Lattice Ward 2 (+15 %/rank)', 0.03);
    near(ward({ m_c4: 2 }) / w0, 1.2, 'Ward Weaving 2 (+10 %/rank; M2 v2)', 0.03);
    const mk = act(fightWith('hunter', 30, ['mark_prey'], { h_b5: 2 }, { prep: (x) => { x.player.pet = null; } }), cast('mark_prey'), () => true, 1);
    near(dotOn(mk, 'MARKED').value, 0.08 + 0.08, 'Deep Mark 2 (MARKED +0.04/rank)', 1e-9);
    const fl = act(fightWith('mage', 30, ['frost_lance'], { m_b3: 2 }), cast('frost_lance'));
    near(dotOn(fl, 'CHILLED').value, C.CHILL_PCT + 0.1, 'Deep Chill 2 (CHILLED -0.05/rank more)', 1e-9);
  });

  test('Lattice Ward: an Arcane Ward cast with the talent is marked; when it breaks, the attacker becomes CHILLED', () => {
    const cast1 = act(fightWith('mage', 30, ['arcane_ward'], { m_b7: 1 }), cast('arcane_ward', null), () => true, 1);
    assert.equal(st(cast1.state.fight.p.st, 'WARD').lattice, true);
    let s = fightWith('mage', 30, [], { m_b7: 1 }, { enemies: [mob('z1_brute', 30)] });
    s = tweak(s, (x) => {
      x.fight.enemies[0].st = [];
      x.fight.enemies[0].intent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, heavy: false, school: 'phys', cd: 0, pct: 3, hits: 1, target: 'player', est: 1 };
      x.fight.p.st.push({ id: 'WARD', dur: 4, amount: 5, src: 'arcane_ward', lattice: true });
    });
    const r = act(s, { type: 'PASS' });
    assert.ok(ev(r.events, 'damage').some((e) => e.dst === 'player' && e.absorbed === 5), 'the ward broke');
    const ch = st(r.state.fight.enemies[0].st, 'CHILLED');
    assert.ok(ch, 'attacker CHILLED');
  });
});

describe('rules 6 talents: stats, resources and mechanics', () => {
  const cast = (spellId, target = 0) => ({ type: 'CAST', spellId, target });
  test('Lethal Shots crit, Survivalist dodge, Frenzy Link pet crit, Ferocity pet damage, Unbreakable Bond pet revive', () => {
    const base = (c) => atLevel(started(c), 40);
    const d = (talents) => withTalents(base('hunter'), talents).player.d;
    near(d({ h_b2: 3 }).crit - d({}).crit, 0.06, 'Lethal Shots 3', 1e-9);
    near(d({ h_c5: 2 }).dodge - d({}).dodge, 0.06, 'Survivalist 2', 1e-9);
    const petHit = (talents) => {
      const r = act(fightWith('hunter', 40, [], talents), { type: 'PASS' }, (x) => x[0] > 0.9 && x[1] > 0.97 && Math.abs(x[2] - 0.5) < 0.05);
      return r.events.find((e) => e.t === 'damage' && e.src === 'pet').amount;
    };
    near(petHit({ h_a2: 3 }) / petHit({}), 1.375, 'Ferocity 3 (pet damage +12.5 %/rank; M2 v5)');
    // Frenzy Link: a pet crit on a draw between the base pet crit and +0.10 (2 ranks)
    const s = fightWith('hunter', 40, [], { h_a4: 2 });
    const petCrit = s.player.d.crit + C.PET[s.player.pet.id].critBonus;
    const r = act(s, { type: 'PASS' }, (x) => x[0] > 0.9 && x[1] > petCrit + 0.01 && x[1] < petCrit + 0.09);
    const hit = r.events.find((e) => e.t === 'damage' && e.src === 'pet');
    assert.ok(hit.crit, 'Frenzy Link 2: pet crit +0.05/rank');
    assert.equal(r.state.fight.p.focus, Math.min(C.FOCUS_MAX, s.fight.p.focus + 10 + C.FOCUS_REGEN), 'Frenzy Link: 5 focus/rank per pet crit');
    // Unbreakable Bond: the pet revives after the fight at PET_REVIVE_PCT + 0.25/rank
    const revive = (talents) => {
      let k = fightWith('hunter', 40, [], talents, { enemies: [mob('z1_brute', 1)] });
      k = tweak(k, (x) => { x.player.pet.alive = false; x.player.pet.hp = 0; x.fight.enemies[0].hp = 1; x.fight.enemies[0].dodge = 0; });
      const done = act(k, { type: 'ATTACK', target: 0 }, (x) => x[0] > 0.9);
      assert.equal(done.state.fight, null);
      return done.state.player.pet.hp;
    };
    const max = withTalents(base('hunter'), {}).player.d.petMaxHp;
    assert.ok(Math.abs(revive({ h_a5: 2 }) - revive({}) - 0.5 * max) <= 1, 'Unbreakable Bond 2: the pet revives at +0.25/rank (then post-fight regen)');
  });

  test('Ruthless Momentum refunds energy per CP; Riposte Stance after a dodge; Veiled Recovery heals under EVASION', () => {
    const fin = act(fightWith('rogue', 30, ['severing_flourish'], { r_a6: 2 }, { prep: (x) => { x.fight.p.cp = 5; x.fight.p.energy = 50; } }), cast('severing_flourish'));
    assert.equal(fin.state.fight.p.energy, Math.min(C.ENERGY_MAX, 50 - 35 + 5 * 5 * 2 + C.ENERGY_REGEN), 'Ruthless Momentum 2: 5 energy per CP per rank');
    // Riposte Stance: the enemy attack is dodged this round, the next Gutting Jab hits 1 + 0.25 × 2 harder.
    const hitIntent = (x) => { x.fight.enemies[0].st = []; x.fight.enemies[0].intent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, heavy: false, school: 'phys', cd: 0, pct: 1, hits: 1, target: 'player', est: 1 }; };
    const s = fightWith('rogue', 30, ['gutting_jab'], { r_a4: 2 }, { enemies: [mob('z1_brute', 30)], prep: hitIntent });
    const dodged = act(s, { type: 'PASS' }, (d) => d[0] < 0.06 + 0.001 + 0 && d[0] > 0.05 + 0.001);
    assert.ok(ev(dodged.events, 'miss').some((e) => e.dst === 'player' && e.dodge), 'the strike was dodged');
    const next = tweak(dodged.state, (x) => { for (const e of x.fight.enemies) e.st.push({ id: 'STUN', dur: 9 }); });
    const a = act(next, cast('gutting_jab'));
    const b = cloneState(tweak(next, (x) => { x.fight.p.riposte = 0; x.player.talents = {}; }));
    forceDraws(b, 3, (d) => d.join() === a.draws.join());
    const g = (r) => r.events.find((e) => e.t === 'damage' && e.spell === 'gutting_jab').amount;
    near(g(a) / g(R.step(b, cast('gutting_jab'))), 1.5, 'Riposte Stance 2 (+25 %/rank)', 0.03);
    // Veiled Recovery: 3 % max HP per round per rank while EVASION is active
    const v = act(fightWith('rogue', 30, [], { r_b4: 2 }, { prep: (x) => { x.player.hp = 100; x.fight.p.st.push({ id: 'EVASION', dur: 3, value: 0.45 }); } }), { type: 'PASS' }, () => true, 1);
    assert.ok(ev(v.events, 'heal').some((e) => e.dst === 'player' && e.amount === Math.round(0.06 * v.state.player.d.maxHp)), 'Veiled Recovery 2');
  });

  test('Twin Fangs strikes again for 50 %; Crippling Toxin lowers the poisoned enemy\'s damage; Rupture Venom +15 % per POISON stack', () => {
    const tf = act(fightWith('rogue', 30, [], { r_a7: 3 }), { type: 'ATTACK', target: 0 }, (d) => d[0] > 0.6 && d[1] > 0.5 && d[3] < 0.29 && d[4] > 0.6 && d[5] > 0.5, 9);
    const hits = tf.events.filter((e) => e.t === 'damage' && e.src === 'player' && e.dst === 0 && !e.tick);
    assert.equal(hits.length, 2, 'Twin Fangs 3: a second hit on a draw below 0.30');
    near(hits[1].amount / hits[0].amount, 0.5, 'second hit at 50 %', 0.12);
    const strike = (talents) => {
      const s = fightWith('rogue', 30, [], talents, { enemies: [mob('z1_brute', 30)], prep: (x) => {
        x.fight.enemies[0].st = [{ id: 'POISON', dur: 4, tick: 1, stacks: 1, max: 5, src: 'toxic' }];
        x.fight.enemies[0].intent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, heavy: false, school: 'magic', cd: 0, pct: 1, hits: 1, target: 'player', est: 1 };
      } });
      return act(s, { type: 'PASS' }, (d) => d[0] > 0.9 && d[1] > 0.97 && Math.abs(d[2] - 0.5) < 0.05).events.find((e) => e.t === 'damage' && e.dst === 'player' && !e.tick).amount;
    };
    near(strike({ r_c4: 2 }) / strike({}), 0.9, 'Crippling Toxin 2 (-5 %/rank)');
    const rv = (stacks) => {
      const s = fightWith('rogue', 40, ['rupture_venom'], {}, { prep: (x) => { x.player.spells.rupture_venom = { tl: 40, rank: 1 }; x.fight.p.cp = 4; if (stacks) x.fight.enemies[0].st.push({ id: 'POISON', dur: 4, tick: 1, stacks, max: 5, src: 'toxic' }); } });
      return act(s, cast('rupture_venom')).events.find((e) => e.t === 'damage' && e.spell === 'rupture_venom').amount;
    };
    near(rv(4) / rv(0), 1.6, 'Rupture Venom: +15 % per POISON stack (4 stacks)', 0.03);
  });

  test('Plague Heart: when a poisoned enemy dies, its POISON and Open Vein copy to every other enemy', () => {
    let s = fightWith('rogue', 50, [], { r_c9: 1 }, { enemies: [mob('z1_brute', 50), mob('z1_brute', 50), mob('z1_beast', 50)] });
    s = tweak(s, (x) => {
      x.fight.enemies[0].hp = 1; x.fight.enemies[0].dodge = 0;
      x.fight.enemies[0].st.push({ id: 'POISON', dur: 4, tick: 3, stacks: 4, max: 5, src: 'toxic' }, { id: 'BLEED', src: 'open_vein', dur: 3, tick: 9 });
    });
    const r = act(s, { type: 'ATTACK', target: 0 }, (d) => d[0] > 0.9);
    assert.ok(!r.state.fight.enemies[0].alive);
    for (const i of [1, 2]) {
      const e = r.state.fight.enemies[i];
      assert.equal((st(e.st, 'POISON') || {}).stacks, 4, `enemy ${i} POISON`);
      assert.ok(e.st.some((x) => x.id === 'BLEED' && x.src === 'open_vein'), `enemy ${i} Open Vein`);
    }
  });

  test('Mage: Searing Focus and Shatter add crit; Heat Haze wards on a crit; Lucid Flow frees the next spell; Spell Rebound; Hourglass Reversal', () => {
    const cast2 = (talents, spell, prep, pred) => act(fightWith('mage', 40, [spell], talents, { prep }), cast(spell), pred);
    const base = fightWith('mage', 40, ['ember_bolt'], {}).player.d.crit;
    const mid = (d) => d[0] > 0.9 && d[1] > base + 0.01 && d[1] < base + 0.05;
    assert.ok(!cast2({}, 'ember_bolt', null, mid).events.find((e) => e.t === 'damage').crit);
    assert.ok(cast2({ m_a2: 3 }, 'ember_bolt', null, mid).events.find((e) => e.t === 'damage').crit, 'Searing Focus 3: fire +0.06 crit');
    const frozen = (x) => x.fight.enemies[0].st.push({ id: 'FROZEN', dur: 3 });
    const shatter = (d) => d[0] > 0.9 && d[1] > base + 0.3 && d[1] < base + 0.45;
    assert.ok(cast2({ m_b6: 2 }, 'ember_bolt', frozen, shatter).events.find((e) => e.t === 'damage').crit, 'Shatter 2: +0.25 crit/rank vs FROZEN');
    const hz = cast2({ m_a8: 3 }, 'ember_bolt', null, (d) => d[0] > 0.9 && d[1] < 0.01);
    assert.equal(st(hz.state.fight.p.st, 'WARD').amount, Math.round(0.09 * hz.state.player.d.maxHp), 'Heat Haze 3: WARD 3 % max HP per rank on a crit');
    const lucid = act(fightWith('mage', 40, ['ember_bolt'], { m_c3: 2 }), cast('ember_bolt'), (d) => d[0] > 0.9 && d[3] < 0.09, 4);
    assert.equal(R.spellCost(lucid.state, 'ember_bolt'), 0, 'Lucid Flow 2: a draw below 0.10 makes the next spell free');
    assert.equal(R.spellCooldown(withTalents(atLevel(started('mage'), 40), { m_c5: 2 }), 'spellsnap'), 5 - 2, 'Spell Rebound: Spellsnap CD -1/rank');
    const snap = fightWith('mage', 40, ['spellsnap'], { m_c5: 2 }, { enemies: [mob('z1_caster', 40)], prep: (x) => {
      x.fight.enemies[0].st = [];
      x.fight.enemies[0].intent = { id: 'hex_bolt', name: 'Hex Bolt', kind: 'hit', cast: true, heavy: false, school: 'magic', cd: 3, pct: 2, hits: 1, target: 'player', est: 1 };
      x.player.mana = 100;
    } });
    const rs = act(snap, cast('spellsnap'));
    assert.equal(ev(rs.events, 'interrupt').length, 1);
    const gain = Math.round(0.06 * snap.player.d.maxMana);
    assert.equal(rs.state.player.mana, Math.min(snap.player.d.maxMana, 100 - R.spellCost(snap, 'spellsnap') + gain + Math.round(C.MANA_REGEN_ROUND_PCT * snap.player.d.maxMana)), 'Spell Rebound 2: +3 % max mana per rank on an interrupt');
    const hg = fightWith('mage', 60, ['hourglass_reversal', 'pyre_comet'], {}, { prep: (x) => { x.player.spells.hourglass_reversal = { tl: 60, rank: 1 }; x.fight.p.cds = { pyre_comet: x.fight.round + 3 }; x.player.mana = 0; } });
    const h = act(hg, cast('hourglass_reversal', null), () => true, 1);
    assert.ok(R.isLegal(h.state, cast('pyre_comet')) || h.state.player.mana < R.spellCost(h.state, 'pyre_comet'), 'Hourglass: other cooldowns reset');
    assert.ok(!h.state.fight.p.cds.pyre_comet || h.state.fight.p.cds.pyre_comet <= h.state.fight.round, 'pyre_comet ready');
    assert.equal(h.state.player.mana, Math.round(0.2 * hg.player.d.maxMana) + Math.round(C.MANA_REGEN_ROUND_PCT * hg.player.d.maxMana), 'Hourglass: +20 % max mana');
  });

  test('Hunter: Bonded Spirit, Concussive Precision, Trapper, Fire Snare, Primal Unity', () => {
    const mend = act(fightWith('hunter', 40, ['mend_companion'], { h_a3: 2 }, { prep: (x) => { x.player.pet.hp = 1; x.player.hp = 1; } }), cast('mend_companion', null), () => true, 1);
    const toPet = ev(mend.events, 'heal').find((e) => e.dst === 'pet').amount;
    const toMe = ev(mend.events, 'heal').find((e) => e.dst === 'player');
    assert.ok(toMe && Math.abs(toMe.amount - 0.6 * toPet) <= 1, `Bonded Spirit 2: you heal 30 %/rank of the pet heal (${toMe && toMe.amount} vs ${toPet})`);
    const caster = (x) => { x.fight.enemies[0].st = []; x.fight.enemies[0].intent = { id: 'hex_bolt', name: 'Hex Bolt', kind: 'hit', cast: true, heavy: false, school: 'magic', cd: 3, pct: 2, hits: 1, target: 'player', est: 1 }; x.player.pet = null; };
    const mz = act(fightWith('hunter', 40, ['muzzle_shot'], { h_b8: 1 }, { enemies: [mob('z1_caster', 40)], prep: caster }), cast('muzzle_shot'));
    assert.ok(mz.events.some((e) => e.t === 'status' && e.id === 'STUN' && e.on), 'Concussive Precision: Muzzle Shot also STUNs');
    assert.equal(R.spellCooldown(withTalents(atLevel(started('hunter'), 40), { h_c3: 2 }), 'snare_trap'), 6 - 2, 'Trapper: Snare Trap CD -1/rank');
    const free = (x) => { x.player.pet = null; for (const e of x.fight.enemies) e.st = []; };
    const tr = act(fightWith('hunter', 40, ['snare_trap'], { h_c3: 2 }, { prep: free }), cast('snare_trap'), (d) => d[0] > 0.9 && d[1] > 0.97);
    assert.ok(tr.events.some((e) => e.t === 'damage' && e.src === 'player' && e.dst === 0 && !e.tick), 'Trapper: Snare Trap deals damage');
    const fs = act(fightWith('hunter', 40, ['snare_trap'], { h_c7: 1 }, { enemies: [mob('z1_brute', 40), mob('z1_beast', 40)], prep: free }), cast('snare_trap'), () => true, 1);
    assert.ok(fs.state.fight.enemies.every((e) => st(e.st, 'BURN')), 'Fire Snare: BURN on all enemies');
    const wc = act(fightWith('hunter', 50, ['wild_communion'], {}, { prep: (x) => { x.player.spells.wild_communion = { tl: 50, rank: 1 }; } }), cast('wild_communion', null), () => true, 1);
    assert.ok(st(wc.state.fight.pet.st, 'TAUNT'), 'Primal Unity: pet TAUNT');
  });

  test('Lingering Shade (+CP on openers), Combustive Crits (IGNITE), Wildfire (Living Flame from Cinder Storm), Arcane Momentum, Primal Unity, Unbreakable Bond (pet damage taken)', () => {
    const stealthy = (x) => x.fight.p.st.push({ id: 'STEALTH', dur: null });
    const ls = act(fightWith('rogue', 30, ['shadowstep_strike'], { r_b3: 2 }, { prep: stealthy }), cast('shadowstep_strike'));
    assert.equal(ls.state.fight.p.cp, 2 + 2, 'Lingering Shade 2: openers +1 CP/rank');
    const ig = act(fightWith('mage', 40, ['ember_bolt'], { m_a5: 2 }), cast('ember_bolt'), (d) => d[0] > 0.9 && d[1] < 0.01);
    const crit = ig.events.find((e) => e.t === 'damage' && e.spell === 'ember_bolt');
    const burn = ig.state.fight.enemies[0].st.find((x) => x.id === 'BURN' && x.src === 'ignite');
    assert.ok(crit.crit && burn, 'Combustive Crits: a fire crit applies IGNITE');
    assert.ok(Math.abs(burn.tick * C.TALENT.m_a5.rounds - 0.4 * crit.amount) <= C.TALENT.m_a5.rounds + 1, `IGNITE total ${burn.tick} × ${C.TALENT.m_a5.rounds} vs 40 % of ${crit.amount}`);
    const wf = act(fightWith('mage', 40, ['cinder_storm'], { m_a7: 2 }, { enemies: [mob('z1_brute', 40), mob('z1_beast', 40)] }), cast('cinder_storm', null), (d) => d[0] > 0.9 && d[3] > 0.9, 6);
    assert.ok(wf.state.fight.enemies.every((e) => e.st.some((x) => x.id === 'BURN' && x.src === 'living_flame')), 'Wildfire: Living Flame on every enemy hit');
    const lf = act(fightWith('mage', 40, ['living_flame'], {}), cast('living_flame'), () => true, 1).state.fight.enemies[0].st.find((x) => x.id === 'BURN').tick;
    near(wf.state.fight.enemies[0].st.find((x) => x.id === 'BURN' && x.src === 'living_flame').tick / lf, 1.0, 'Wildfire 2: 50 %/rank strength', 0.06);
    // Arcane Momentum 3: the second damaging spell in a row +1 %/rank (M2 v2)
    const am = (talents) => {
      const s1 = act(fightWith('mage', 40, ['ember_bolt'], talents), cast('ember_bolt')).state;
      return act(s1, cast('ember_bolt'));
    };
    const m0 = am({});
    const m3 = cloneState(act(fightWith('mage', 40, ['ember_bolt'], { m_c8: 3 }), cast('ember_bolt')).state);
    forceDraws(m3, 3, (d) => d.join() === m0.draws.join());
    const eb = (r) => r.events.find((e) => e.t === 'damage' && e.spell === 'ember_bolt').amount;
    near(eb(R.step(m3, cast('ember_bolt'))) / eb(m0), 1.03, 'Arcane Momentum 3 (1 stack)', 0.025);
    // Primal Unity: Wild Communion gives the pet +50 % damage
    const pet = (spells, prep) => {
      const s = fightWith('hunter', 50, spells, {}, { prep: (x) => { x.player.spells.wild_communion = { tl: 50, rank: 1 }; if (prep) prep(x); } });
      return s;
    };
    const plain = act(pet([]), { type: 'PASS' }, (d) => d[0] > 0.9 && d[1] > 0.97 && Math.abs(d[2] - 0.5) < 0.05);
    const wc = cloneState(pet(['wild_communion']));
    forceDraws(wc, 3, (d) => d.join() === plain.draws.join());
    const ph = (r) => r.events.find((e) => e.t === 'damage' && e.src === 'pet').amount;
    near(ph(R.step(wc, cast('wild_communion', null))) / ph(plain), 1.5, 'Primal Unity: pet damage +50 %', 0.03);
    // Unbreakable Bond 2: the pet takes 10 % less damage
    const petTaken = (talents) => {
      const s = fightWith('hunter', 40, [], talents, { enemies: [mob('z1_brute', 40)], prep: (x) => {
        x.fight.enemies[0].st = [];
        x.fight.enemies[0].intent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, heavy: false, school: 'magic', cd: 0, pct: 1, hits: 1, target: 'pet', est: 1 };
      } });
      return act(s, { type: 'PASS' }, (d) => d[3] > 0.9 && d[4] > 0.06 && Math.abs(d[5] - 0.5) < 0.02, 6).events.find((e) => e.t === 'damage' && e.dst === 'pet').amount;
    };
    near(petTaken({ h_a5: 2 }) / petTaken({}), 0.9, 'Unbreakable Bond 2 (pet takes -5 %/rank)', 0.02);
  });
});

