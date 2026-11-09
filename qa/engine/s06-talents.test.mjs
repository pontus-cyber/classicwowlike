// rules.md section 6: talents.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, withTalents, inFight, tweak, forceDraws, HIT, ev, st, cloneState } from './helpers.mjs';

const mob = (tid = 'z1_guardian', level = 30) => ({ tid, level, variant: 'normal' });
function fightWith(classId, L, spells, talents, enemies = [mob('z1_guardian', L)], prep) {
  let s = withTalents(withSpells(atLevel(started(classId, { seed: 31 }), L), spells), talents);
  s = inFight(s, enemies, { noStealth: true }).state;
  return tweak(s, (x) => { for (const e of x.fight.enemies) { e.maxHp = e.hp = 1e7; } if (prep) prep(x); });
}
function act(s, a, pred = HIT, n = 3) {
  const c = cloneState(s);
  const draws = forceDraws(c, n, pred);
  return { ...R.step(c, a), draws };
}
const firstDmg = (r, spell) => r.events.find((e) => e.t === 'damage' && e.src === 'player' && (!spell || e.spell === spell));

describe('rules 6 talents', () => {
  test('6 points: SPEND_TALENT needs a free point; tier t needs 4 × (t-1) points in the tree; max ranks', () => {
    let s = atLevel(started('rogue'), 9);
    assert.match(R.whyIllegal(s, { type: 'SPEND_TALENT', talentId: 'r_a1' }), /no free talent points/);
    s = atLevel(started('rogue'), 20); // 6 points
    assert.equal(R.talentPointsFree(s), 6);
    assert.match(R.whyIllegal(s, { type: 'SPEND_TALENT', talentId: 'r_a3' }), /tier 2 needs 4 points/);
    for (let i = 0; i < 3; i++) s = R.step(s, { type: 'SPEND_TALENT', talentId: 'r_a1' }).state;
    assert.match(R.whyIllegal(s, { type: 'SPEND_TALENT', talentId: 'r_a1' }), /max rank/);
    s = R.step(s, { type: 'SPEND_TALENT', talentId: 'r_a2' }).state;
    assert.ok(R.isLegal(s, { type: 'SPEND_TALENT', talentId: 'r_a3' }));
    assert.ok(!R.isLegal(s, { type: 'SPEND_TALENT', talentId: 'r_b3' }), 'points in another tree do not count');
    assert.ok(!R.isLegal(s, { type: 'SPEND_TALENT', talentId: 'x_none' }));
    assert.ok(!R.isLegal(s, { type: 'SPEND_TALENT', talentId: 'm_a1' }), 'other class');
  });

  test('6 one capstone per run: tier 5 needs 16 points in the tree; 26 points cannot reach two', () => {
    for (const c of C.CLASS_IDS) {
      let s = atLevel(started(c), 60);
      const trees = [0, 1, 2];
      const order = (tree) => Object.values(C.TALENT).filter((t) => t.cls === c && t.tree === tree).sort((a, b) => a.tier - b.tier || b.ranks - a.ranks);
      let caps = 0;
      for (const tree of trees) {
        for (const t of order(tree)) {
          while (R.isLegal(s, { type: 'SPEND_TALENT', talentId: t.id })) {
            s = R.step(s, { type: 'SPEND_TALENT', talentId: t.id }).state;
            if (t.tier === 5) caps++;
          }
        }
      }
      assert.equal(s.player.talentSpent, 26, c);
      assert.equal(caps, 1, `${c}: exactly one capstone`);
    }
  });

  test('6 new-spell talents add the spell (tl = L, on a free bar slot); RESPEC removes it', () => {
    let s = withTalents(atLevel(started('mage'), 60, { learnAll: false }), { m_a1: 3, m_a2: 3, m_a3: 2, m_a4: 2, m_a5: 2, m_a6: 2, m_a7: 2 });
    s = R.step(s, { type: 'SPEND_TALENT', talentId: 'm_a9' }).state;
    assert.deepEqual(s.player.spells.conflagrant_core, { tl: 60, rank: 1 });
    assert.ok(s.player.bar.includes('conflagrant_core'));
    s = tweak(s, (x) => { x.phase = 'NODE'; x.node = { type: 'trainer', r: 1, l: 0, cl: 1, stage: 'service' }; x.service = { kind: 'trainer', where: 'node' }; x.player.gold = 1e6; });
    s = R.step(s, { type: 'RESPEC' }).state;
    assert.equal(s.player.spells.conflagrant_core, undefined);
    assert.ok(!s.player.bar.includes('conflagrant_core'));
    assert.equal(R.talentPointsFree(s), 26);
  });

  test('6 stat talents: Honed Edges crit, Slippery dodge, Hoarfrost Skin and Hardy max HP, Deep Reserves mana, Arcane Acuity Power, Thick Hide pet HP', () => {
    const base = (c) => atLevel(started(c), 40);
    const delta = (c, t, r, f) => f(withTalents(base(c), { [t]: r }).player.d) - f(base(c).player.d);
    assert.ok(Math.abs(delta('rogue', 'r_a1', 3, (d) => d.crit) - 0.09) < 1e-9);
    assert.ok(Math.abs(delta('rogue', 'r_b2', 3, (d) => d.dodge) - 0.06) < 1e-9);
    const m = base('mage').player.d;
    assert.equal(withTalents(base('mage'), { m_b2: 3 }).player.d.maxHp, Math.round(m.maxHp * 1.09));
    assert.equal(withTalents(base('mage'), { m_c1: 3 }).player.d.maxMana, Math.round(m.maxMana * 1.15));
    assert.ok(Math.abs(withTalents(base('mage'), { m_c2: 3 }).player.d.power - m.power * 1.09) < 1e-9);
    const h = base('hunter').player.d;
    assert.equal(withTalents(base('hunter'), { h_c1: 3 }).player.d.maxHp, Math.round(h.maxHp * 1.12));
    assert.equal(withTalents(base('hunter'), { h_a1: 3 }).player.d.petMaxHp, Math.round(C.PET.ridgewolf.hpPct * h.maxHp * 1.24));
    assert.ok(Math.abs(delta('rogue', 'r_a5', 2, (d) => d.critMult) - 0.4) < 1e-9);
    assert.ok(Math.abs(delta('hunter', 'h_b4', 2, (d) => d.critMult) - 0.4) < 1e-9);
  });

  test('6 cost and cooldown talents: Swift Hands, Cheap Trick, Fire Economy, Efficiency, Permafrost, Flashpoint, Shroudwalk', () => {
    const cost = (c, talents, id) => R.spellCost(withTalents(atLevel(started(c), 50), talents), id);
    const cd = (c, talents, id) => R.spellCooldown(withTalents(atLevel(started(c), 50), talents), id);
    assert.equal(cost('rogue', { r_a2: 3 }, 'gutting_jab'), 40 - 9);
    assert.equal(cost('rogue', { r_b5: 2 }, 'temple_blow'), 25 - 20);
    assert.equal(cd('rogue', { r_b5: 2 }, 'temple_blow'), 5 - 2);
    const mage = atLevel(started('mage'), 50);
    assert.equal(cost('mage', { m_a4: 2 }, 'ember_bolt'), Math.round(0.07 * mage.player.d.baseMana));
    assert.equal(cost('hunter', { h_b3: 2 }, 'keen_shot'), 20);
    assert.equal(cd('mage', { m_b5: 2 }, 'rime_burst'), 4);
    assert.equal(cd('mage', { m_a6: 2 }, 'pyre_comet'), 1);
    assert.equal(cd('rogue', { r_b7: 2 }, 'vanishing_step'), 6);
    assert.equal(cd('mage', { m_b8: 1 }, 'glacial_tomb'), 10);
    assert.equal(cd('hunter', { h_b7: 2 }, 'rapid_volley'), 6);
  });

  test('6 damage talents: Serrated Finish, Kindling, Biting Cold, Steady Aim and Barrage Mastery scale the hit', () => {
    const ratio = (c, L, spells, talents, a, prep) => {
      const plain = fightWith(c, L, spells, {}, undefined, prep);
      const tal = fightWith(c, L, spells, talents, undefined, prep);
      const r1 = act(plain, a);
      const c2 = cloneState(tal);
      c2.fight.rng = cloneState(plain).fight.rng;
      const d1 = firstDmg(r1).amount;
      forceDraws(c2, 3, (d) => d.join() === r1.draws.join());
      const d2 = firstDmg(R.step(c2, a)).amount;
      return d2 / d1;
    };
    const near = (x, want) => assert.ok(Math.abs(x - want) < 0.03, `${x} vs ${want}`);
    near(ratio('rogue', 30, ['severing_flourish'], { r_a3: 3 }, { type: 'CAST', spellId: 'severing_flourish', target: 0 }, (x) => { x.fight.p.cp = 5; }), 1.18);
    near(ratio('mage', 30, ['ember_bolt'], { m_a1: 3 }, { type: 'CAST', spellId: 'ember_bolt', target: 0 }), 1.12);
    near(ratio('mage', 30, ['frost_lance'], { m_b1: 3 }, { type: 'CAST', spellId: 'frost_lance', target: 0 }), 1.24);
    near(ratio('hunter', 30, ['keen_shot'], { h_b1: 3 }, { type: 'CAST', spellId: 'keen_shot', target: 0 }, (x) => { x.player.pet = null; }), 1.18);
  });

  test('6 Toxic Coating applies POISON stacks up to 5 (+2 per Lethal Mixture rank); Crippling Toxin lowers enemy damage', () => {
    let s = fightWith('rogue', 30, ['gutting_jab'], { r_c1: 3, r_c3: 1 });
    let t = s;
    for (let i = 0; i < 9; i++) {
      t = tweak(t, (x) => { x.fight.p.energy = 100; });
      t = act(t, { type: 'CAST', spellId: 'gutting_jab', target: 0 }).state;
    }
    const p = st(t.fight.enemies[0].st, 'POISON');
    assert.equal(p.stacks, 7);
    assert.equal(p.dur, 3);
  });

  test("6 Mindguard pays 30 % of damage from mana at 2:1; Shared Wounds moves 20 % to the pet; Death's Sidestep negates a lethal hit once", () => {
    let s = fightWith('mage', 40, [], { m_c7: 1 }, [mob('z1_brute', 40)]);
    s = tweak(s, (x) => { x.fight.enemies[0].intent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, school: 'phys', cd: 0, pct: 1, hits: 1, target: 'player', est: 1 }; });
    let r = act(s, { type: 'PASS' }, (d) => d[0] > 0.9 && d[1] > 0.95, 3);
    const hit = r.events.find((e) => e.t === 'damage' && e.dst === 'player');
    assert.ok(hit.absorbed > 0);
    assert.ok(Math.abs(s.player.mana - r.state.player.mana - 2 * hit.absorbed) <= 2 * 1 + Math.round(0.02 * s.player.d.maxMana));
    let h = fightWith('hunter', 40, [], { h_a8: 1 }, [mob('z1_brute', 40)]);
    h = tweak(h, (x) => { x.fight.enemies[0].intent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, school: 'phys', cd: 0, pct: 1, hits: 1, target: 'player', est: 1 }; x.fight.pet.st = []; });
    r = act(h, { type: 'PASS' }, (d) => d[0] > 0.9 && d[1] > 0.95 && d[3] > 0.9, 6);
    const shared = r.events.find((e) => e.t === 'damage' && e.dst === 'pet' && e.spell === 'shared_wounds');
    const toPlayer = r.events.find((e) => e.t === 'damage' && e.dst === 'player');
    assert.ok(shared && Math.abs(shared.amount - 0.2 * (shared.amount + toPlayer.amount)) <= 1);
    let g = fightWith('rogue', 40, [], { r_b9: 1 }, [mob('z1_brute', 40)]);
    g = tweak(g, (x) => { x.player.hp = 5; x.fight.enemies[0].intent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, school: 'phys', cd: 0, pct: 1, hits: 1, target: 'player', est: 1 }; });
    r = act(g, { type: 'PASS' }, (d) => d[0] > 0.9, 3);
    assert.ok(r.events.some((e) => e.t === 'damage' && e.sidestep));
    assert.ok(st(r.state.fight.p.st, 'STEALTH'));
    assert.equal(r.state.player.hp, 5 + Math.round(0.2 * g.player.d.maxHp));
    assert.ok(r.state.fight.p.sidestepUsed);
  });

  test('6 capstone spells: Thousand Cuts 4 strikes, Glacier Spike ×1.5 vs CHILLED, Starfall refunds focus on a kill, Deadfall stuns all', () => {
    let s = fightWith('rogue', 50, ['thousand_cuts'], { r_a9: 1 });
    s = tweak(s, (x) => { x.player.spells.thousand_cuts = { tl: 50, rank: 1 }; });
    let r = act(s, { type: 'CAST', spellId: 'thousand_cuts', target: 0 }, (d) => [0, 3, 6, 9].every((i) => d[i] > 0.9), 12);
    assert.equal(r.events.filter((e) => e.t === 'damage' && e.spell === 'thousand_cuts').length, 4);
    assert.equal(r.state.fight.p.cp, 2);
    let h = fightWith('hunter', 50, ['starfall_arrow', 'deadfall_trap'], {}, [mob('z1_brute', 50), mob('z1_beast', 50)]);
    h = tweak(h, (x) => { x.player.spells.starfall_arrow = { tl: 50, rank: 1 }; x.player.spells.deadfall_trap = { tl: 50, rank: 1 }; x.fight.enemies[0].hp = 1; x.fight.p.focus = 60; x.player.pet = null; });
    r = act(h, { type: 'CAST', spellId: 'starfall_arrow', target: 0 });
    assert.equal(r.state.fight.p.focus, Math.min(C.FOCUS_MAX, 60 - 50 + 50 + C.FOCUS_REGEN));
    const full = tweak(h, (x) => { x.fight.enemies[0].hp = x.fight.enemies[0].maxHp; });
    r = act(full, { type: 'CAST', spellId: 'deadfall_trap', target: null }, (d) => d[0] > 0.9 && d[3] > 0.9, 6);
    assert.equal(ev(r.events, 'status').filter((x) => x.id === 'STUN' && x.on).length, 2);
  });
});
