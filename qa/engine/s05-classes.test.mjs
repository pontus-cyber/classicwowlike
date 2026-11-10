// rules.md section 5: classes, spells, pets.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, inFight, tweak, forceDraws, HIT, pipeline, ev, st, cloneState, peek } from './helpers.mjs';

/** Character of class at level L with these bar spells, in a fight vs enemies (no Rogue stealth unless asked). */
function setup(classId, L, spells, enemies, opts = {}) {
  let s = withSpells(atLevel(started(classId, { seed: opts.seed ?? 21, petId: opts.petId }), L), spells);
  if (opts.prep) s = tweak(s, opts.prep);
  return inFight(s, enemies, { noStealth: !opts.stealth, kind: opts.kind || 'quest' }).state;
}
const mob = (tid = 'z1_brute', level = 10, variant = 'normal') => ({ tid, level, variant });
function act(s, a, pred = HIT, n = 3) {
  const c = cloneState(s);
  const draws = forceDraws(c, n, pred);
  const r = R.step(c, a);
  return { ...r, draws, before: c };
}
const dmgTo = (events, dst, spell) => events.filter((e) => e.t === 'damage' && e.dst === dst && (!spell || e.spell === spell));
const tlOf = (s, id) => s.player.spells[id].tl;

describe('rules 5.1-5.2 classes and bars', () => {
  test('5.1 basic attacks: Strike WD + 0.30P (phys), Spark 2 + 0.6L + 0.35P (arcane), Auto Shot WD + 0.35P (phys)', () => {
    for (const c of C.CLASS_IDS) {
      const s = setup(c, 10, [], [mob('z1_brute', 10)]);
      const d = s.player.d;
      const b = C.CLASS[c].basic;
      const e = s.fight.enemies[0];
      const r = act(s, { type: 'ATTACK', target: 0 });
      const want = pipeline({ base: b.b + b.l * 10 + b.p * d.power + b.w * d.wd, attL: 10, tgtL: 10, phys: b.school === 'phys', dodge: e.dodge, crit: d.crit, armor: e.armor, draws: r.draws });
      assert.equal(dmgTo(r.events, 0, b.id)[0].amount, want.amount, c);
    }
  });

  test('5.2 only spells on the bar can be cast; bar has 7 slots, item bar 3', () => {
    let s = setup('mage', 20, ['ember_bolt'], [mob()]);
    s = tweak(s, (x) => { x.player.spells.frost_lance = { tl: 20, rank: 1 }; });
    assert.ok(R.isLegal(s, { type: 'CAST', spellId: 'ember_bolt', target: 0 }));
    assert.match(R.whyIllegal(s, { type: 'CAST', spellId: 'frost_lance', target: 0 }), /not on the action bar/);
    assert.ok(!R.isLegal(started('mage'), { type: 'SET_BAR', slot: 7, spellId: null }));
  });

  test('5.2 spell strength uses tl: a spell trained at a lower level hits for less', () => {
    const hi = setup('mage', 30, ['ember_bolt'], [mob('z1_brute', 30)]);
    const lo = tweak(hi, (x) => { x.player.spells.ember_bolt.tl = 1; });
    const a = act(hi, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
    const b = act(lo, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
    assert.equal(b.draws.join(), a.draws.join());
    assert.ok(dmgTo(b.events, 0)[0].amount < dmgTo(a.events, 0)[0].amount);
  });
});

describe('rules 5.3 Rogue', () => {
  const R10 = (spells, enemies = [mob()], opts) => setup('rogue', 10, spells, enemies, opts);

  test('gutting_jab: phys 6 + 1.3tl + 0.55P + 1.0WD, 40 energy, +1 CP on hit; cost also paid on a miss', () => {
    const s = R10(['gutting_jab']);
    const d = s.player.d;
    const e = s.fight.enemies[0];
    const r = act(s, { type: 'CAST', spellId: 'gutting_jab', target: 0 });
    const want = pipeline({ base: 6 + 1.3 * tlOf(s, 'gutting_jab') + 0.55 * d.power + d.wd, attL: 10, tgtL: 10, phys: true, dodge: e.dodge, crit: d.crit, critMult: d.critMult, armor: e.armor, draws: r.draws });
    assert.equal(dmgTo(r.events, 0)[0].amount, want.amount);
    assert.equal(r.state.fight.p.cp, 1);
    assert.equal(r.state.fight.p.energy, C.ENERGY_MAX - 40 + C.ENERGY_REGEN);
    const info = R.spellInfo(s, 'gutting_jab', 0);
    assert.equal(info.amount.amount, Math.round(6 + 1.3 * tlOf(s, 'gutting_jab') + 0.55 * d.power + d.wd));
    assert.equal(info.cost, 40);
    assert.equal(info.usable, true);
    const m = act(s, { type: 'CAST', spellId: 'gutting_jab', target: 0 }, (x) => x[0] < 0.01);
    assert.equal(m.state.fight.p.cp, 0, 'no CP on a miss');
    assert.equal(m.state.fight.p.energy, C.ENERGY_MAX - 40 + C.ENERGY_REGEN, 'energy paid on a miss');
  });

  test('severing_flourish: needs CP >= 1, consumes all CP, phys (4 + tl + 0.30P) × CP + 0.5WD', () => {
    let s = R10(['severing_flourish']);
    assert.ok(!R.isLegal(s, { type: 'CAST', spellId: 'severing_flourish', target: 0 }));
    s = tweak(s, (x) => { x.fight.p.cp = 3; });
    const d = s.player.d;
    const e = s.fight.enemies[0];
    const r = act(s, { type: 'CAST', spellId: 'severing_flourish', target: 0 });
    const tl = tlOf(s, 'severing_flourish');
    const want = pipeline({ base: (4 + tl + 0.3 * d.power) * 3 + 0.5 * d.wd, attL: 10, tgtL: 10, phys: true, dodge: e.dodge, crit: d.crit, armor: e.armor, draws: r.draws });
    assert.equal(dmgTo(r.events, 0)[0].amount, want.amount);
    assert.equal(r.state.fight.p.cp, 0);
  });

  test('shadowstep_strike: requires STEALTH, +2 CP; openers keep STEALTH, any other action removes it', () => {
    let s = R10(['shadowstep_strike', 'gutting_jab'], [mob()], { stealth: true });
    assert.ok(st(s.fight.p.st, 'STEALTH'));
    assert.ok(s.fight.enemies.every((e) => e.intent.id === 'unaware'), 'round 1: enemies are Unaware');
    const r = act(s, { type: 'CAST', spellId: 'shadowstep_strike', target: 0 });
    assert.equal(r.state.fight.p.cp, 2);
    assert.ok(st(r.state.fight.p.st, 'STEALTH'), 'opener does not break STEALTH (rules 7.4)');
    const r2 = act(r.state, { type: 'CAST', spellId: 'gutting_jab', target: 0 });
    assert.ok(!st(r2.state.fight.p.st, 'STEALTH'));
    assert.ok(!R.isLegal(r2.state, { type: 'CAST', spellId: 'shadowstep_strike', target: 0 }));
  });

  test('throat_jab: interrupts a cast intent (its cooldown still starts) and SILENCES 1 round', () => {
    let s = R10(['throat_jab'], [mob('z1_caster', 10)]);
    s = tweak(s, (x) => { x.fight.enemies[0].intent = { id: 'hex_bolt', name: 'Hex Bolt', kind: 'hit', cast: true, heavy: false, school: 'magic', cd: 3, pct: 2.0, hits: 1, target: 'player', est: 50 }; });
    const r = act(s, { type: 'CAST', spellId: 'throat_jab', target: 0 }, HIT, 20);
    assert.equal(ev(r.events, 'interrupt').length, 1);
    assert.equal(dmgTo(r.events, 'player', 'hex_bolt').length, 0, 'the cast is lost');
    assert.equal(r.state.fight.enemies[0].cds.hex_bolt, s.fight.round + 3);
    assert.ok(ev(r.events, 'status').some((x) => x.id === 'SILENCED' && x.on));
    assert.equal(r.state.fight.p.cds.throat_jab, s.fight.round + 4);
  });

  test('open_vein: BLEED 4 rounds, tick (2 + 0.45tl + 0.10P) × CP, ticks at end of round (M2 v2: 0.10P)', () => {
    let s = R10(['open_vein'], [mob('z1_guardian', 10)]);
    s = tweak(s, (x) => { x.fight.p.cp = 4; x.fight.enemies[0].maxHp = x.fight.enemies[0].hp = 100000; });
    const d = s.player.d;
    const r = act(s, { type: 'CAST', spellId: 'open_vein', target: 0 }, () => true, 1);
    const bleed = st(r.state.fight.enemies[0].st, 'BLEED');
    assert.equal(bleed.tick, Math.round((2 + 0.45 * tlOf(s, 'open_vein') + 0.10 * d.power) * 4));
    assert.equal(bleed.dur, 3, 'one tick already happened this round');
    assert.equal(dmgTo(r.events, 0, 'open_vein').filter((e) => e.tick).length, 1);
    assert.equal(r.state.fight.p.cp, 0);
  });

  test('temple_blow: STUN 1 + floor(CP/2) rounds, max 3; a 1-round STUN cancels the action this round', () => {
    for (const [cp, dur] of [[1, 1], [2, 2], [3, 2], [5, 3]]) {
      let s = R10(['temple_blow'], [mob('z1_brute', 10)]);
      s = tweak(s, (x) => { x.fight.p.cp = cp; });
      const r = act(s, { type: 'CAST', spellId: 'temple_blow', target: 0 }, () => true, 1);
      const on = ev(r.events, 'status').find((x) => x.id === 'STUN' && x.on);
      assert.equal(on.dur, dur, `CP ${cp}`);
      assert.equal(ev(r.events, 'enemyAction').length, 0, 'stunned enemy does not act');
    }
  });

  test('smoke_veil EVASION +0.45 for 3 rounds; whirling_edges hits all, +1 CP; expose_weakness EXPOSED 0.04 × CP for 5 rounds', () => {
    let s = R10(['smoke_veil', 'whirling_edges', 'expose_weakness'], [mob('z1_brute', 10), mob('z1_beast', 10)]);
    let r = act(s, { type: 'CAST', spellId: 'smoke_veil', target: null });
    assert.equal(ev(r.events, 'status').find((x) => x.id === 'EVASION').dur, 3);
    assert.equal(st(r.state.fight.p.st, 'EVASION').value, 0.45);
    r = act(s, { type: 'CAST', spellId: 'whirling_edges', target: null }, (d) => d[0] > 0.9 && d[1] > 0.95 && d[3] > 0.9 && d[4] > 0.95, 6);
    assert.equal(dmgTo(r.events, 0).length + dmgTo(r.events, 1).length, 2);
    assert.equal(r.state.fight.p.cp, 1);
    s = tweak(s, (x) => { x.fight.p.cp = 5; });
    r = act(s, { type: 'CAST', spellId: 'expose_weakness', target: 0 }, () => true, 1);
    const ex = st(r.state.fight.enemies[0].st, 'EXPOSED');
    assert.ok(Math.abs(ex.value - 0.2) < 1e-12);
    assert.equal(ex.dur, 4);
  });

  test('adrenal_surge +60 energy and double regen for 3 rounds; vanishing_step dispersal and STEALTH; final_reckoning ×2 below 35 %', () => {
    let s = setup('rogue', 44, ['adrenal_surge', 'vanishing_step', 'final_reckoning'], [mob('z1_brute', 44)]);
    s = tweak(s, (x) => { x.fight.p.energy = 10; });
    let r = act(s, { type: 'CAST', spellId: 'adrenal_surge', target: null }, () => true, 1);
    assert.equal(r.state.fight.p.energy, Math.min(C.ENERGY_MAX, 10 + 60 + 2 * C.ENERGY_REGEN));
    s = tweak(s, (x) => { x.fight.p.st.push({ id: 'BLEED', src: 'x', dur: 3, tick: 1 }, { id: 'CURSED', dur: 3 }); });
    r = act(s, { type: 'CAST', spellId: 'vanishing_step', target: null }, () => true, 1);
    assert.ok(!st(r.state.fight.p.st, 'BLEED') && !st(r.state.fight.p.st, 'CURSED'));
    assert.ok(st(r.state.fight.p.st, 'STEALTH'));
    const full = tweak(s, (x) => { x.fight.p.cp = 3; x.fight.p.energy = 100; x.fight.enemies[0].maxHp = x.fight.enemies[0].hp = 100000; });
    const low = tweak(full, (x) => { x.fight.enemies[0].hp = 30000; });
    const a = act(full, { type: 'CAST', spellId: 'final_reckoning', target: 0 });
    const b = act(low, { type: 'CAST', spellId: 'final_reckoning', target: 0 });
    const ratio = dmgTo(b.events, 0)[0].amount / dmgTo(a.events, 0)[0].amount;
    assert.ok(Math.abs(ratio - 2) < 0.02, `ratio ${ratio}`);
  });

  test('5.3 Rogue starts fights in STEALTH, except the end boss and dungeon bosses', () => {
    const s = withSpells(atLevel(started('rogue'), 20), ['gutting_jab']);
    assert.ok(st(inFight(s, [mob()]).state.fight.p.st, 'STEALTH'));
    assert.ok(!st(inFight(s, [mob('z1_dboss', 9, 'dboss')], { kind: 'dboss' }).state.fight.p.st, 'STEALTH'));
  });
});

describe('rules 5.4 Mage', () => {
  const M = (L, spells, enemies = [mob('z1_brute', L)], opts) => setup('mage', L, spells, enemies, opts);

  test('ember_bolt: fire 6 + 2.1tl + 1.12P, cost round(9 % × base mana) (M2 v2: 2.1tl + 1.12P)', () => {
    const s = M(20, ['ember_bolt']);
    const d = s.player.d;
    const r = act(s, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
    const want = pipeline({ base: 6 + 2.1 * 20 + 1.12 * d.power, attL: 20, tgtL: 20, phys: false, crit: d.crit, draws: r.draws });
    assert.equal(dmgTo(r.events, 0)[0].amount, want.amount);
    assert.equal(ev(r.events, 'action')[0].cost, Math.round(0.09 * d.baseMana));
  });

  test('frost_lance: CHILLED 2; a CHILLED enemy deals CHILL_PCT less damage', () => {
    const s = M(20, ['frost_lance'], [mob('z1_brute', 20)]);
    const r = act(s, { type: 'CAST', spellId: 'frost_lance', target: 0 });
    const ch = st(r.state.fight.enemies[0].st, 'CHILLED');
    assert.equal(ch.value, C.CHILL_PCT);
    assert.equal(ch.dur, 1);
  });

  test('arcane_ward: WARD absorbs 10 + 3tl + 1.0P for 4 rounds, damage hits WARD first', () => {
    const s = M(20, ['arcane_ward'], [mob('z1_brute', 20)]);
    const r = act(s, { type: 'CAST', spellId: 'arcane_ward', target: null }, () => true, 1);
    const amount = Math.round(10 + 3 * 20 + s.player.d.power);
    const on = ev(r.events, 'status').find((x) => x.id === 'WARD');
    assert.equal(on.dur, 4);
    const absorbed = dmgTo(r.events, 'player').reduce((n, e) => n + e.absorbed, 0);
    const w = st(r.state.fight.p.st, 'WARD');
    assert.equal((w ? w.amount : 0) + absorbed, amount);
    assert.equal(r.state.player.hp, s.player.hp - dmgTo(r.events, 'player').reduce((n, e) => n + e.amount, 0));
  });

  test('rime_burst: frost to all, FROZEN 1 on non-bosses; spellsnap interrupts and SILENCES 2 (no casts picked)', () => {
    let s = M(20, ['rime_burst', 'spellsnap'], [mob('z1_caster', 20), mob('z1_brute', 20)]);
    let r = act(s, { type: 'CAST', spellId: 'rime_burst', target: null }, (d) => d[0] > 0.9 && d[3] > 0.9, 6);
    assert.ok(r.state.fight.enemies.every((e) => !e.alive || st(e.st, 'FROZEN') === null), 'FROZEN 1 expired at end of round');
    assert.equal(ev(r.events, 'status').filter((x) => x.id === 'FROZEN' && x.on).length, 2);
    assert.equal(ev(r.events, 'enemyAction').length, 0);
    s = tweak(s, (x) => { x.fight.enemies[0].intent = { id: 'hex_bolt', name: 'Hex Bolt', kind: 'hit', cast: true, school: 'magic', cd: 3, pct: 2, hits: 1, target: 'player', est: 1 }; });
    r = act(s, { type: 'CAST', spellId: 'spellsnap', target: 0 }, HIT, 30);
    assert.equal(ev(r.events, 'interrupt').length, 1);
    const sil = st(r.state.fight.enemies[0].st, 'SILENCED');
    assert.equal(sil.dur, 1);
    assert.ok(!r.state.fight.enemies[0].intent.cast, 'a SILENCED enemy cannot pick a cast intent');
  });

  test('living_flame BURN 5; hexbind HEXED 3 and any damage breaks it; cinder_storm hits all; mana_siphon +30 % max mana', () => {
    let s = M(26, ['living_flame', 'hexbind', 'cinder_storm', 'mana_siphon'], [mob('z1_brute', 26), mob('z1_beast', 26), mob('z1_mender', 26)]);
    let r = act(s, { type: 'CAST', spellId: 'living_flame', target: 0 }, () => true, 1);
    assert.equal(ev(r.events, 'status').find((x) => x.id === 'BURN').dur, 5);
    r = act(s, { type: 'CAST', spellId: 'hexbind', target: 1 }, () => true, 1);
    assert.ok(st(r.state.fight.enemies[1].st, 'HEXED'));
    assert.equal(r.state.fight.enemies[1].intent.id, 'hexed');
    const r2 = act(r.state, { type: 'ATTACK', target: 1 });
    assert.ok(!st(r2.state.fight.enemies[1].st, 'HEXED'), 'damage removes HEXED');
    r = act(s, { type: 'CAST', spellId: 'cinder_storm', target: null }, (d) => d[0] > 0.9 && d[3] > 0.9 && d[6] > 0.9, 9);
    assert.equal(new Set(ev(r.events, 'damage').filter((e) => e.spell === 'cinder_storm').map((e) => e.dst)).size, 3);
    s = tweak(s, (x) => { x.player.mana = 0; });
    r = act(s, { type: 'CAST', spellId: 'mana_siphon', target: null }, () => true, 1);
    assert.equal(ev(r.events, 'mana')[0].amount, Math.round(0.3 * s.player.d.maxMana));
  });

  test('glacial_tomb: IMMUNE until end of next round, next action skipped (PASS only), dispersal, heal 10 %', () => {
    let s = M(30, ['glacial_tomb', 'ember_bolt'], [mob('z1_brute', 30), mob('z1_beast', 30)]);
    s = tweak(s, (x) => { x.player.hp = 100; x.fight.p.st.push({ id: 'CURSED', dur: 3 }); });
    const r = act(s, { type: 'CAST', spellId: 'glacial_tomb', target: null }, () => true, 1);
    assert.ok(!st(r.state.fight.p.st, 'CURSED'));
    assert.equal(dmgTo(r.events, 'player').reduce((n, e) => n + e.amount, 0), 0, 'IMMUNE');
    assert.ok(ev(r.events, 'heal').some((h) => h.amount === Math.round(0.1 * s.player.d.maxHp)));
    assert.deepEqual(R.legalActions(r.state).map((a) => a.type).filter((t) => t !== 'SET_AUTOPLAY'), ['PASS']);
    const r2 = R.step(r.state, { type: 'PASS' });
    assert.equal(dmgTo(r2.events, 'player').reduce((n, e) => n + e.amount, 0), 0, 'still IMMUNE in the next round');
    assert.ok(R.isLegal(r2.state, { type: 'CAST', spellId: 'ember_bolt', target: 0 }));
  });

  test('pyre_comet +0.25 crit vs BURN; starlance_barrage = 3 separate hits', () => {
    let s = M(46, ['pyre_comet', 'starlance_barrage'], [mob('z1_guardian', 46)]);
    s = tweak(s, (x) => { x.fight.enemies[0].maxHp = x.fight.enemies[0].hp = 1e6; x.player.d.crit = 0.1; });
    const burn = tweak(s, (x) => { x.fight.enemies[0].st.push({ id: 'BURN', src: 'living_flame', dur: 3, tick: 1 }); });
    const crit = (d) => d[0] > 0.9 && d[1] > 0.1 && d[1] < 0.35;
    assert.equal(act(s, { type: 'CAST', spellId: 'pyre_comet', target: 0 }, crit).events.find((e) => e.t === 'damage').crit, false);
    assert.equal(act(burn, { type: 'CAST', spellId: 'pyre_comet', target: 0 }, crit).events.find((e) => e.t === 'damage').crit, true);
    const r = act(s, { type: 'CAST', spellId: 'starlance_barrage', target: 0 }, (d) => d[0] > 0.9 && d[3] > 0.9 && d[6] > 0.9, 9);
    assert.equal(dmgTo(r.events, 0, 'starlance_barrage').length, 3);
  });
});

describe('rules 5.5 Hunter and pets', () => {
  const H = (L, spells, enemies = [mob('z1_brute', L)], opts = {}) => setup('hunter', L, spells, enemies, opts);

  test('pet values: HP = hpPct × max HP, armor = armor × armorMult, damage formula, crit = hunter crit + bonus', () => {
    for (const pid of ['ridgewolf', 'thornback', 'duskcat']) {
      const s = atLevel(started('hunter', { petId: pid }), 20);
      const P = C.PET[pid];
      const d = s.player.d;
      assert.equal(d.petMaxHp, Math.round(P.hpPct * d.maxHp));
      assert.equal(d.petArmor, d.armor * P.armorMult);
      assert.ok(Math.abs(d.petDmg - (C.PET_DMG_BASE + C.PET_DMG_PER_LEVEL * 20 + C.PET_DMG_POWER * d.power) * P.dmgMult) < 1e-9);
      assert.equal(d.petCrit, d.crit + P.critBonus);
    }
  });

  test('pet acts after the hunter on the hunter target; Ridgewolf hits twice every 3rd action', () => {
    let s = H(20, ['keen_shot'], [mob('z1_guardian', 20), mob('z1_brute', 20)]);
    s = tweak(s, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; });
    let r = act(s, { type: 'CAST', spellId: 'keen_shot', target: 1 }, () => true, 1);
    const i = r.events.findIndex((e) => e.t === 'petAction');
    assert.ok(i > r.events.findIndex((e) => e.t === 'action'));
    assert.equal(r.events[i].target, 1);
    let t = r.state;
    t = R.step(t, { type: 'ATTACK', target: 1 }).state;
    const third = R.step(t, { type: 'ATTACK', target: 1 });
    assert.equal(third.events.filter((e) => e.t === 'damage' && e.src === 'pet').length + third.events.filter((e) => e.t === 'miss' && e.src === 'pet').length, 2);
  });

  test('Thornback taunts all enemies in round 1 and every 4 rounds after (1 round); Stormhawk hits a second enemy', () => {
    // No engage round here (combat v2), so round 1 has single-target intents to retarget.
    let s = inFight(atLevel(started('hunter', { petId: 'thornback' }), 20), [mob('z1_brute', 20), mob('z1_beast', 20)], { engage: false }).state;
    assert.ok(st(s.fight.pet.st, 'TAUNT'));
    assert.ok(s.fight.enemies.some((e) => ['hit', 'rend'].includes(e.intent.kind)));
    for (const e of s.fight.enemies) if (['hit', 'rend'].includes(e.intent.kind)) assert.equal(e.intent.target, 'pet');
    // Player and pet are kept alive so the TAUNT schedule can be observed.
    const live = (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; x.player.hp = x.player.d.maxHp; x.player.pet.hp = x.player.d.petMaxHp; };
    s = tweak(s, live);
    const rounds = [];
    for (let i = 0; i < 9; i++) { rounds.push(!!st(s.fight.pet.st, 'TAUNT')); s = tweak(R.step(s, { type: 'PASS' }).state, live); }
    assert.deepEqual(rounds, [true, false, false, false, true, false, false, false, true]);
    const prof = { ...R.newProfile(), unlocks: { stormhawk: 1 } };
    let h = inFight(atLevel(started('hunter', { petId: 'stormhawk', profile: prof }), 20), [mob('z1_brute', 20), mob('z1_beast', 20)]).state;
    h = tweak(h, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; x.fight.p.target = 0; });
    const r = R.step(h, { type: 'ATTACK', target: 0 });
    const petHits = r.events.filter((e) => (e.t === 'damage' || e.t === 'miss') && e.src === 'pet').map((e) => e.dst);
    assert.deepEqual(petHits, [0, 1]);
  });

  test('pet aggro: share of single-target track entries on the pet ≈ PET.aggro; the now-intent takes its entry\'s target', () => {
    let pet = 0;
    let all = 0;
    for (let seed = 0; seed < 120; seed++) {
      const s = inFight(atLevel(started('hunter', { petId: 'ridgewolf', seed }), 20), [mob('z1_brute', 20), mob('z1_beast', 20), mob('z1_skulker', 20)]).state;
      for (const e of s.fight.enemies) for (const x of e.track) if (['hit', 'rend'].includes(x.kind)) { all++; if (x.aggro === 'pet') pet++; }
      if (seed < 10) {
        const t = R.step(s, { type: 'PASS' }).state; // round 2: turn 1 is now
        for (const e of t.fight.enemies) if (['hit', 'rend'].includes(e.intent.kind)) assert.equal(e.intent.target, e.track[0].aggro);
      }
    }
    assert.ok(all > 600);
    assert.ok(Math.abs(pet / all - C.PET.ridgewolf.aggro) < 0.05, `share ${pet / all}`);
  });

  test('pet death never ends the fight; a dead pet revives after the fight at PET_REVIVE_PCT', () => {
    let s = H(10, ['keen_shot'], [mob('z1_brute', 10)]);
    s = tweak(s, (x) => { x.player.pet.alive = false; x.player.pet.hp = 0; x.fight.enemies[0].hp = 1; x.fight.enemies[0].dodge = 0; });
    const r = act(s, { type: 'ATTACK', target: 0 });
    assert.equal(r.state.fight, null);
    assert.ok(r.state.player.pet.alive);
    const want = Math.round(C.PET_REVIVE_PCT * s.player.d.petMaxHp);
    assert.ok(r.state.player.pet.hp >= want, 'revived (then post-fight regen)');
  });

  test('keen_shot, barbed_arrow BLEED 4, mark_prey MARKED +0.08 for 6, muzzle_shot interrupt + SILENCED 2', () => {
    let s = H(20, ['keen_shot', 'barbed_arrow', 'mark_prey', 'muzzle_shot'], [mob('z1_caster', 20)]);
    s = tweak(s, (x) => { x.fight.enemies[0].maxHp = x.fight.enemies[0].hp = 1e6; x.player.pet = null; });
    const d = s.player.d;
    const e = s.fight.enemies[0];
    let r = act(s, { type: 'CAST', spellId: 'keen_shot', target: 0 });
    const want = pipeline({ base: 5 + 1.1 * 20 + 0.5 * d.power + 0.9 * d.wd, attL: 20, tgtL: 20, phys: true, dodge: e.dodge, crit: d.crit, critMult: d.critMult, armor: e.armor, draws: r.draws });
    assert.equal(dmgTo(r.events, 0, 'keen_shot')[0].amount, want.amount);
    r = act(s, { type: 'CAST', spellId: 'barbed_arrow', target: 0 }, () => true, 1);
    assert.equal(ev(r.events, 'status').find((x) => x.id === 'BLEED').dur, 4);
    r = act(s, { type: 'CAST', spellId: 'mark_prey', target: 0 }, () => true, 1);
    assert.equal(st(r.state.fight.enemies[0].st, 'MARKED').value, 0.08);
    s = tweak(s, (x) => { x.fight.enemies[0].intent = { id: 'hex_bolt', name: 'Hex Bolt', kind: 'hit', cast: true, school: 'magic', cd: 3, pct: 2, hits: 1, target: 'player', est: 1 }; });
    r = act(s, { type: 'CAST', spellId: 'muzzle_shot', target: 0 }, HIT, 20);
    assert.equal(ev(r.events, 'interrupt').length, 1);
    assert.ok(ev(r.events, 'status').some((x) => x.id === 'SILENCED' && x.dur === 2));
  });

  test('mend_companion heals the pet or revives it at 0.30; snare_trap STUN 2; field_dressing 12 % + HOT 4 % × 3', () => {
    let s = H(20, ['mend_companion', 'snare_trap', 'field_dressing'], [mob('z1_brute', 20), mob('z1_beast', 20)]);
    s = tweak(s, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; });
    const dead = tweak(s, (x) => { x.player.pet.alive = false; x.player.pet.hp = 0; });
    let r = act(dead, { type: 'CAST', spellId: 'mend_companion', target: null }, () => true, 1);
    assert.equal(ev(r.events, 'petRevive')[0].hp, Math.round(0.3 * s.player.d.petMaxHp));
    r = act(s, { type: 'CAST', spellId: 'snare_trap', target: 1 }, () => true, 1);
    assert.equal(ev(r.events, 'status').find((x) => x.id === 'STUN').dur, 2);
    const hurt = tweak(s, (x) => { x.player.hp = 10; });
    r = act(hurt, { type: 'CAST', spellId: 'field_dressing', target: null }, () => true, 1);
    assert.equal(ev(r.events, 'heal')[0].amount, Math.round(0.12 * s.player.d.maxHp));
    assert.equal(st(r.state.fight.p.st, 'HOT').amount, Math.round(0.04 * s.player.d.maxHp));
  });

  test('feign_stillness: enemies target the pet for 2 rounds (no pet: STEALTH); savage_order: pet strike; rapid_volley +40 %', () => {
    let s = H(40, ['feign_stillness', 'savage_order', 'rapid_volley'], [mob('z1_brute', 40), mob('z1_beast', 40)]);
    s = tweak(s, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; });
    let r = act(s, { type: 'CAST', spellId: 'feign_stillness', target: null }, () => true, 1);
    assert.equal(dmgTo(r.events, 'player').filter((e) => !e.tick).length, 0, 'single-target attacks re-target to the pet');
    for (const e of r.state.fight.enemies) if (['hit', 'rend'].includes(e.intent.kind)) assert.equal(e.intent.target, 'pet');
    const nopet = tweak(s, (x) => { x.player.pet.alive = false; });
    r = act(nopet, { type: 'CAST', spellId: 'feign_stillness', target: null }, () => true, 1);
    assert.ok(st(r.state.fight.p.st, 'STEALTH'));
    r = act(s, { type: 'CAST', spellId: 'savage_order', target: 0 });
    assert.ok(r.events.some((e) => e.t === 'damage' && e.src === 'pet' && e.spell === 'savage_order'));
    r = act(s, { type: 'CAST', spellId: 'rapid_volley', target: null }, () => true, 1);
    assert.equal(st(r.state.fight.p.st, 'RAPID').value, 0.4);
  });
});

describe('rules 5.6 meta-unlock spells', () => {
  test('ghostblade_rush 2 strikes +2 CP; bloodprice_gambit -10 % HP, +5 CP, +50 energy', () => {
    let s = setup('rogue', 40, ['ghostblade_rush', 'bloodprice_gambit'], [mob('z1_guardian', 40)]);
    s = tweak(s, (x) => { x.fight.enemies[0].maxHp = x.fight.enemies[0].hp = 1e6; x.fight.p.energy = 50; });
    let r = act(s, { type: 'CAST', spellId: 'ghostblade_rush', target: 0 }, (d) => d[0] > 0.9 && d[3] > 0.9, 6);
    assert.equal(dmgTo(r.events, 0).length, 2);
    assert.equal(r.state.fight.p.cp, 2);
    r = act(s, { type: 'CAST', spellId: 'bloodprice_gambit', target: null }, () => true, 1);
    assert.equal(r.state.fight.p.cp, 5);
    assert.ok(r.events.some((e) => e.t === 'damage' && e.dst === 'player' && e.spell === 'bloodprice_gambit' && e.amount === Math.round(0.1 * s.player.hp)));
  });

  test('ricochet_bolt: full hit on the target, then SPELL.ricochet_bolt.bounces other enemies at bounceFrac (40 %, M2 v3)', () => {
    let h = setup('hunter', 40, ['ricochet_bolt'], [mob('z1_brute', 40), mob('z1_brute', 40), mob('z1_brute', 40), mob('z1_brute', 40)]);
    h = tweak(h, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; x.player.pet.alive = false; });
    const r = act(h, { type: 'CAST', spellId: 'ricochet_bolt', target: 1 }, (d) => [0, 3, 6].every((i) => d[i] > 0.9), 9);
    const sp = C.SPELL.ricochet_bolt;
    const d = r.before.player.d;
    const base = sp.b + sp.l * r.before.player.spells.ricochet_bolt.tl + sp.p * d.power + sp.w * d.wd;
    const hits = r.events.filter((e) => e.t === 'damage' && e.spell === 'ricochet_bolt');
    assert.deepEqual(hits.map((e) => e.dst), [1, 0, 2], 'target, then the other living enemies in index order, 2 bounces');
    hits.forEach((e, i) => {
      const t = r.before.fight.enemies[e.dst];
      const want = pipeline({ base: base * (i === 0 ? 1 : sp.bounceFrac), attL: 40, tgtL: 40, phys: true, dodge: t.dodge, crit: d.crit, armor: t.armor, draws: r.draws.slice(3 * i, 3 * i + 3) });
      assert.equal(e.amount, want.amount, `hit ${i}`);
    });
    assert.equal(sp.bounceFrac, 0.4);
    // Tooltip data: spellInfo gives the bounce rule, so no front end copies 40 %.
    const a = R.spellInfo(h, 'ricochet_bolt', 1).amount;
    assert.deepEqual(a, { kind: 'damage', amount: Math.round(base), hits: 1, school: 'phys', perCp: false, bounces: 2, bounceFrac: 0.4, bounceAmount: Math.round(base * 0.4) });
    assert.equal(R.spellInfo(h, 'keen_shot', 1).amount.bounces, undefined);
  });

  test('chrono_sigil: the target skips its action; mirrorshade: images; ricochet_bolt: target + 2 others; beastcall_horn', () => {
    let s = setup('mage', 40, ['chrono_sigil', 'mirrorshade'], [mob('z1_brute', 40)]);
    s = tweak(s, (x) => { x.fight.enemies[0].maxHp = x.fight.enemies[0].hp = 1e6; });
    let r = act(s, { type: 'CAST', spellId: 'chrono_sigil', target: 0 }, () => true, 1);
    assert.equal(ev(r.events, 'enemyAction').length, 0);
    r = act(s, { type: 'CAST', spellId: 'mirrorshade', target: null }, () => true, 1);
    assert.equal(st(r.state.fight.p.st, 'MIRROR').value, 0.5);
    let h = setup('hunter', 40, ['ricochet_bolt', 'beastcall_horn'], [mob('z1_brute', 40), mob('z1_beast', 40), mob('z1_skulker', 40)]);
    h = tweak(h, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; x.player.pet.alive = false; });
    r = act(h, { type: 'CAST', spellId: 'ricochet_bolt', target: 1 }, (d) => [0, 3, 6].every((i) => d[i] > 0.9), 9);
    const hits = r.events.filter((e) => e.t === 'damage' && e.spell === 'ricochet_bolt');
    assert.deepEqual(hits.map((e) => e.dst), [1, 0, 2]);
    r = act(h, { type: 'CAST', spellId: 'beastcall_horn', target: null }, () => true, 1);
    assert.ok(r.state.player.pet.alive);
    assert.ok(st(r.state.fight.pet.st, 'TAUNT'));
  });
});


