// rules.md section 7: combat.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, inFight, tweak, forceDraws, HIT, MISS, pipeline, ev, st, cloneState, nextFloat } from './helpers.mjs';

const mob = (tid = 'z1_brute', level = 20, variant = 'normal') => ({ tid, level, variant });
function setup(classId, L, spells, enemies, prep, opts = {}) {
  let s = withSpells(atLevel(started(classId, { seed: opts.seed ?? 41 }), L), spells);
  s = inFight(s, enemies, { noStealth: !opts.stealth, kind: opts.kind || 'quest' }).state;
  return prep ? tweak(s, prep) : s;
}
function act(s, a, pred = HIT, n = 3) {
  const c = cloneState(s);
  const draws = forceDraws(c, n, pred);
  return { ...R.step(c, a), draws };
}
const HITI = (kind = 'hit', extra = {}) => ({ id: 'strike', name: 'Strike', kind, cast: false, heavy: false, school: 'phys', cd: 0, pct: 1, hits: 1, target: 'player', est: 1, ...extra });
const stun = (x, i = 0, dur = 3) => x.fight.enemies[i].st.push({ id: 'STUN', dur });
const bigHp = (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e7; };

describe('rules 7.1 fight flow', () => {
  test('one action resolves a round: player, pet, enemies in index order, end of round, next intents', () => {
    const s = setup('hunter', 20, ['keen_shot'], [mob('z1_brute'), mob('z1_beast')], bigHp);
    const r = R.step(s, { type: 'CAST', spellId: 'keen_shot', target: 0 });
    const order = r.events.map((e) => e.t).filter((t) => ['action', 'petAction', 'enemyAction', 'round', 'intent'].includes(t));
    assert.equal(order[0], 'action');
    assert.equal(order[1], 'petAction');
    const ea = r.events.filter((e) => e.t === 'enemyAction').map((e) => e.u);
    assert.deepEqual(ea, [...ea].sort());
    const ri = order.indexOf('round');
    assert.ok(ri > order.lastIndexOf('enemyAction'));
    assert.deepEqual(order.slice(ri + 1), ['intent', 'intent']);
    assert.equal(r.state.fight.round, 2);
    for (const e of r.state.fight.enemies) assert.ok(e.intent && typeof e.intent.est === 'number');
  });

  test('SET_AUTOPLAY is legal mid-fight and changes nothing else', () => {
    const s = setup('mage', 20, ['ember_bolt'], [mob()]);
    const r = R.step(s, { type: 'SET_AUTOPLAY', on: true });
    assert.equal(r.state.autoplay, true);
    assert.equal(r.state.fight.round, s.fight.round);
    assert.equal(R.serialize(tweak(r.state, (x) => { x.autoplay = false; })), R.serialize(s));
  });

  test('fight start: energy/focus full, CP 0, cooldowns clear; fight end: statuses and WARD removed, post-fight regen', () => {
    let s = setup('rogue', 20, ['gutting_jab'], [mob('z1_brute', 1)], (x) => { x.player.hp = 100; x.fight.enemies[0].hp = 1; x.fight.enemies[0].dodge = 0; });
    assert.equal(s.fight.p.energy, C.ENERGY_MAX);
    assert.equal(s.fight.p.cp, 0);
    assert.deepEqual(s.fight.p.cds, {});
    const r = act(s, { type: 'ATTACK', target: 0 });
    assert.equal(r.state.fight, null);
    assert.equal(r.state.player.hp, Math.min(s.player.d.maxHp, 100 + Math.round(s.player.d.regenPct * s.player.d.maxHp)));
  });

  test('round 1: a stealthed Rogue faces Unaware enemies that do not act', () => {
    const s = setup('rogue', 20, ['gutting_jab'], [mob(), mob('z1_beast')], bigHp, { stealth: true });
    assert.ok(s.fight.enemies.every((e) => e.intent.id === 'unaware'));
    const r = R.step(s, { type: 'PASS' });
    assert.equal(ev(r.events, 'enemyAction').length, 0);
  });
});

describe('rules 7.2 damage pipeline', () => {
  test('player physical hit: base × mods × level mod, miss/dodge, crit, variance, target mods, armor, round', () => {
    for (const lvl of [12, 20, 30]) {
      const s = setup('rogue', 20, [], [mob('z1_brute', lvl)], (x) => { bigHp(x); stun(x); x.fight.enemies[0].st.push({ id: 'EXPOSED', dur: 3, value: 0.12 }, { id: 'MARKED', dur: 3, value: 0.08 }); });
      const d = s.player.d;
      const e = s.fight.enemies[0];
      for (const pred of [HIT, (x) => x[0] > 0.9 && x[1] < 0.01, MISS]) {
        const r = act(s, { type: 'ATTACK', target: 0 }, pred);
        const want = pipeline({ base: 0.3 * d.power + d.wd, attL: 20, tgtL: lvl, phys: true, dodge: e.dodge, crit: d.crit, critMult: d.critMult, tgtPct: 0.2, armor: e.armor, draws: r.draws });
        const got = r.events.find((x) => (x.t === 'damage' || x.t === 'miss') && x.src === 'player');
        if (want.miss) assert.equal(got.t, 'miss');
        else { assert.equal(got.amount, want.amount, `level ${lvl}`); assert.equal(got.crit, want.crit); }
      }
    }
  });

  test('enemy hits on the player: physical uses player armor and dodge; magic ignores both; STEALTH adds +0.5 miss', () => {
    const s = setup('mage', 20, [], [mob('z1_caster', 22)], (x) => { x.fight.enemies[0].intent = HITI('hit', { id: 'bolt', school: 'magic', pct: 1.1 }); });
    const e = s.fight.enemies[0];
    const r = act(s, { type: 'PASS' });
    const want = pipeline({ base: 1.1 * e.dmg, attL: 22, tgtL: 20, phys: false, crit: C.ENEMY_CRIT, critMult: C.CRIT_MULT, draws: r.draws });
    assert.equal(r.events.find((x) => x.t === 'damage' && x.dst === 'player').amount, want.amount);
    const p = setup('rogue', 20, [], [mob('z1_brute', 22)], (x) => { x.fight.enemies[0].intent = HITI(); });
    const rp = act(p, { type: 'PASS' });
    const wp = pipeline({ base: p.fight.enemies[0].dmg, attL: 22, tgtL: 20, phys: true, dodge: p.player.d.dodge, crit: C.ENEMY_CRIT, armor: p.player.d.armor, draws: rp.draws });
    assert.equal(rp.events.find((x) => x.t === 'damage' && x.dst === 'player').amount, wp.amount);
    // STEALTH miss bonus: PASS is a non-opener action and removes STEALTH first; an opener keeps it, so the
    // enemy's attack in that round misses on a draw between miss+dodge and +0.5.
    const sp = withSpells(tweak(p, (x) => { x.fight.p.st.push({ id: 'STEALTH', dur: null }); x.fight.enemies[0].maxHp = x.fight.enemies[0].hp = 1e6; }), ['shadowstep_strike']);
    const lo = 0.05 + p.player.d.dodge;
    const r2 = act(sp, { type: 'CAST', spellId: 'shadowstep_strike', target: 0 }, (d) => d[0] > 0.9 && d[3] > lo + 0.01 && d[3] < lo + 0.45, 6);
    assert.ok(r2.events.some((x) => x.t === 'miss' && x.src === 0));
    const r3 = act(tweak(p, (x) => { x.fight.p.st.push({ id: 'STEALTH', dur: null }); }), { type: 'PASS' }, (d) => d[0] > lo + 0.01 && d[0] < lo + 0.45);
    assert.ok(r3.events.some((x) => x.t === 'damage' && x.src === 0), 'PASS removed STEALTH before the enemy acted');
  });

  test('each damage event draws exactly 3 numbers, also on a miss', async () => {
    const { nextU32 } = await import('../../src/rng.js');
    for (const pred of [HIT, MISS]) {
      // Stunned enemy, no pet, no DOTs: the attack is the only draw consumer this round and for the next intents.
      const c = cloneState(setup('rogue', 20, [], [mob()], (x) => { bigHp(x); stun(x); }));
      forceDraws(c, 3, pred);
      const ref = c.fight.rng.slice();
      for (let i = 0; i < 3; i++) nextU32(ref);
      R.stepInPlace(c, { type: 'ATTACK', target: 0 });
      assert.deepEqual(c.fight.rng, ref);
    }
  });

  test('a hit deals at least MIN_HIT_DAMAGE; WARD absorbs first; IMMUNE takes 0 but still draws', () => {
    const s = setup('rogue', 20, [], [mob('z1_guardian', 20)], (x) => { bigHp(x); stun(x); x.player.d.power = 0; x.player.d.wd = 0; });
    const r = act(s, { type: 'ATTACK', target: 0 });
    assert.equal(r.events.find((e) => e.t === 'damage').amount, C.MIN_HIT_DAMAGE);
    const w = setup('mage', 20, [], [mob('z1_brute', 20)], (x) => { x.fight.enemies[0].intent = HITI(); x.fight.p.st.push({ id: 'WARD', dur: 4, amount: 5 }); });
    const rw = act(w, { type: 'PASS' });
    const h = rw.events.find((e) => e.t === 'damage' && e.dst === 'player');
    assert.equal(h.absorbed, 5);
    assert.ok(!st(rw.state.fight.p.st, 'WARD'), 'broken WARD is removed');
    const im = setup('mage', 20, [], [mob('z1_brute', 20)], (x) => { x.fight.enemies[0].intent = HITI(); x.fight.p.st.push({ id: 'IMMUNE', dur: 2 }); });
    const ri = act(im, { type: 'PASS' });
    const z = ri.events.find((e) => e.t === 'damage' && e.dst === 'player');
    assert.equal(z.amount, 0);
    assert.ok(z.immune);
    assert.equal(ri.state.player.hp, im.player.hp);
  });

  test('level modifier is clamped to 0.70-1.30; CHILLED and CURSED reduce the attacker; DOT ticks are fixed at application', () => {
    const big = setup('mage', 60, [], [mob('z1_brute', 1)], (x) => { bigHp(x); stun(x); });
    const r = act(big, { type: 'ATTACK', target: 0 });
    const d = big.player.d;
    const want = pipeline({ base: 2 + 0.6 * 60 + 0.35 * d.power, attL: 60, tgtL: 1, phys: false, crit: d.crit, draws: r.draws });
    assert.equal(r.events.find((e) => e.t === 'damage').amount, want.amount);
    const cursed = tweak(big, (x) => { x.fight.p.st.push({ id: 'CURSED', dur: 3 }); });
    const rc = act(cursed, { type: 'ATTACK', target: 0 });
    assert.equal(rc.events.find((e) => e.t === 'damage').amount, pipeline({ base: 2 + 0.6 * 60 + 0.35 * d.power, attMult: 1 - C.CURSE_PCT, attL: 60, tgtL: 1, phys: false, crit: d.crit, draws: rc.draws }).amount);
    const chilled = setup('rogue', 20, [], [mob('z1_brute', 20)], (x) => { x.fight.enemies[0].intent = HITI(); x.fight.enemies[0].st.push({ id: 'CHILLED', dur: 2, value: C.CHILL_PCT }); });
    const rch = act(chilled, { type: 'PASS' });
    const e = chilled.fight.enemies[0];
    assert.equal(rch.events.find((x) => x.t === 'damage' && x.dst === 'player').amount,
      pipeline({ base: e.dmg, attMult: 1 - C.CHILL_PCT, attL: 20, tgtL: 20, phys: true, dodge: chilled.player.d.dodge, crit: C.ENEMY_CRIT, armor: chilled.player.d.armor, draws: rch.draws }).amount);
    // DOT: tick snapshot at application, unchanged when the target's EXPOSED expires later
    const dot = setup('mage', 20, ['living_flame'], [mob('z1_guardian', 20)], (x) => { bigHp(x); stun(x, 0, 9); x.fight.enemies[0].st.push({ id: 'EXPOSED', dur: 1, value: 0.5 }); });
    let t = act(dot, { type: 'CAST', spellId: 'living_flame', target: 0 }, () => true, 1).state;
    const tick = st(t.fight.enemies[0].st, 'BURN').tick;
    const r2 = R.step(t, { type: 'PASS' });
    assert.equal(r2.events.find((x) => x.t === 'damage' && x.tick).amount, tick);
  });
});

describe('rules 7.3 resources', () => {
  test('costs are paid on use; mana costs round(% × base mana); not enough resource = not castable; regen per round', () => {
    const s = setup('mage', 20, ['ember_bolt'], [mob()], (x) => { bigHp(x); stun(x); });
    const cost = Math.round(0.09 * s.player.d.baseMana);
    const r = act(s, { type: 'CAST', spellId: 'ember_bolt', target: 0 }, MISS);
    assert.equal(r.state.player.mana, Math.min(s.player.d.maxMana, s.player.mana - cost + Math.round(C.MANA_REGEN_ROUND_PCT * s.player.d.maxMana)));
    assert.ok(!R.isLegal(tweak(s, (x) => { x.player.mana = cost - 1; }), { type: 'CAST', spellId: 'ember_bolt', target: 0 }));
    const h = setup('hunter', 20, ['keen_shot'], [mob()], (x) => { bigHp(x); stun(x); x.fight.p.focus = 30; x.player.pet = null; });
    const rh = act(h, { type: 'CAST', spellId: 'keen_shot', target: 0 });
    assert.equal(rh.state.fight.p.focus, C.FOCUS_REGEN);
    assert.ok(!R.isLegal(rh.state, { type: 'CAST', spellId: 'keen_shot', target: 0 }));
  });
});

describe('rules 7.4 status effects', () => {
  test('durations count the round of application; refresh on re-apply; BLEED one per source; dispersal removes debuffs', () => {
    const s = setup('rogue', 20, ['temple_blow'], [mob()], (x) => { bigHp(x); x.fight.p.cp = 1; });
    const r = act(s, { type: 'CAST', spellId: 'temple_blow', target: 0 }, () => true, 1);
    assert.equal(ev(r.events, 'enemyAction').length, 0, '1-round STUN cancels the action this round');
    assert.ok(!st(r.state.fight.enemies[0].st, 'STUN'), 'and ends at the end of that round');
    const b = setup('hunter', 20, ['barbed_arrow'], [mob()], (x) => { bigHp(x); stun(x, 0, 9); x.player.pet = null; x.fight.enemies[0].st.push({ id: 'BLEED', src: 'open_vein', dur: 3, tick: 5 }); });
    let t = act(b, { type: 'CAST', spellId: 'barbed_arrow', target: 0 }, () => true, 1).state;
    assert.equal(t.fight.enemies[0].st.filter((x) => x.id === 'BLEED').length, 2, 'one BLEED per source');
    t = tweak(t, (x) => { x.fight.p.focus = 100; });
    t = act(t, { type: 'CAST', spellId: 'barbed_arrow', target: 0 }, () => true, 1).state;
    assert.equal(t.fight.enemies[0].st.filter((x) => x.id === 'BLEED' && x.src === 'barbed_arrow')[0].dur, 3, 're-applying refreshes');
  });

  test('BRAND stacks +1 up to BRAND_MAX, no expiry, ticks BRAND_DMG per stack; POISON stacks to its cap', async () => {
    const { addStatus } = await import('../../src/engine/damage.js');
    const s = cloneState(setup('mage', 60, [], [mob()]));
    for (let i = 0; i < 12; i++) addStatus(s, [], 'player', { id: 'BRAND', dur: null });
    assert.equal(st(s.fight.p.st, 'BRAND').stacks, C.BRAND_MAX);
    for (let i = 0; i < 4; i++) addStatus(s, [], 0, { id: 'POISON', dur: 4, tick: 2, max: 5 });
    assert.equal(st(s.fight.enemies[0].st, 'POISON').stacks, 4);
    for (let i = 0; i < 4; i++) addStatus(s, [], 0, { id: 'POISON', dur: 4, tick: 2, max: 5 });
    assert.equal(st(s.fight.enemies[0].st, 'POISON').stacks, 5);
    addStatus(s, [], 'player', { id: 'WARD', dur: 4, amount: 50 });
    addStatus(s, [], 'player', { id: 'WARD', dur: 4, amount: 20 });
    assert.equal(st(s.fight.p.st, 'WARD').amount, 50, 'a smaller WARD does not replace a larger one');
    addStatus(s, [], 'player', { id: 'WARD', dur: 4, amount: 80 });
    assert.equal(st(s.fight.p.st, 'WARD').amount, 80);
  });

  test('EXPOSED and MARKED add and apply once; EVASION adds dodge within DODGE_CAP; TAUNT pulls single-target attacks', () => {
    const s = setup('rogue', 20, [], [mob('z1_brute')], (x) => { bigHp(x); stun(x); x.fight.enemies[0].st.push({ id: 'EXPOSED', dur: 3, value: 0.2 }, { id: 'MARKED', dur: 3, value: 0.08 }); });
    const r = act(s, { type: 'ATTACK', target: 0 });
    const plain = act(tweak(s, (x) => { x.fight.enemies[0].st = x.fight.enemies[0].st.filter((y) => y.id === 'STUN'); }), { type: 'ATTACK', target: 0 }, (d) => d.join() === r.draws.join());
    assert.ok(Math.abs(r.events.find((e) => e.t === 'damage').amount / plain.events.find((e) => e.t === 'damage').amount - 1.28) < 0.03);
    const ev2 = setup('rogue', 20, [], [mob()], (x) => { x.fight.p.st.push({ id: 'EVASION', dur: 3, value: 0.95 }); x.fight.enemies[0].intent = HITI(); });
    const r2 = act(ev2, { type: 'PASS' }, (d) => d[0] > 0.05 + C.DODGE_CAP + 0.01);
    assert.ok(r2.events.some((e) => e.t === 'damage' && e.dst === 'player'), 'dodge capped at DODGE_CAP');
  });
});

describe('rules 7.5 usable items in combat', () => {
  test('only item-bar items; Healing and Mana Draughts share POTION_CD; Purifying Tonic dispersal; Spark Flask hits all', () => {
    let s = started('mage');
    s = tweak(s, (x) => { x.player.bag.push({ uid: 'h', kind: 'cons', id: 'healing_draught', qty: 3 }, { uid: 'm', kind: 'cons', id: 'mana_draught', qty: 3 }, { uid: 't', kind: 'cons', id: 'purifying_tonic', qty: 2 }, { uid: 'f', kind: 'cons', id: 'spark_flask', qty: 2 }); x.player.itemBar = ['healing_draught', 'mana_draught', 'spark_flask']; });
    s = setup('mage', 20, [], [mob(), mob('z1_beast')], (x) => { Object.assign(x.player, { bag: s.player.bag, itemBar: s.player.itemBar, hp: 10, mana: 0 }); bigHp(x); stun(x, 0); stun(x, 1); });
    let r = act(s, { type: 'USE_ITEM', slot: 0, target: null }, () => true, 1);
    assert.equal(ev(r.events, 'heal')[0].amount, Math.round(C.HEAL_DRAUGHT_PCT * s.player.d.maxHp));
    assert.ok(!R.isLegal(r.state, { type: 'USE_ITEM', slot: 1, target: null }), 'mana draught shares the potion cooldown');
    let t = r.state;
    for (let i = 0; i < C.POTION_CD - 1; i++) t = R.step(t, { type: 'PASS' }).state;
    assert.ok(R.isLegal(t, { type: 'USE_ITEM', slot: 1, target: null }));
    r = act(s, { type: 'USE_ITEM', slot: 2, target: null }, (d) => d[0] > 0.9 && d[3] > 0.9, 6);
    assert.equal(r.events.filter((e) => e.t === 'damage' && e.spell === 'spark_flask').length, 2);
    assert.ok(!R.isLegal(s, { type: 'USE_ITEM', itemId: 'purifying_tonic' }), 'USE_ITEM by id is the out-of-combat form');
    const tonic = tweak(s, (x) => { x.player.itemBar[2] = 'purifying_tonic'; x.fight.p.st.push({ id: 'CURSED', dur: 3 }, { id: 'BRAND', stacks: 4, dur: null }); });
    r = act(tonic, { type: 'USE_ITEM', slot: 2, target: null }, () => true, 1);
    assert.ok(!st(r.state.fight.p.st, 'CURSED') && !st(r.state.fight.p.st, 'BRAND'));
  });
});

describe('rules 7.6 enemy AI and intents', () => {
  test('enemy stats: HP, damage and armor by level × archetype × variant × template', () => {
    for (const [tid, variant] of [['z1_brute', 'normal'], ['z1_caster', 'trash'], ['z1_elite', 'elite'], ['z1_rare', 'rare'], ['z1_dboss', 'dboss']]) {
      const s = setup('mage', 20, [], [mob(tid, 15, variant)]);
      const e = s.fight.enemies[0];
      const A = C.ARCHETYPE[e.arch];
      const V = C.VARIANT[variant];
      assert.equal(e.maxHp, Math.round((C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * 15) * A.hp * V.hp));
      assert.ok(Math.abs(e.dmg - (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * 15) * A.dmg * V.dmg) < 1e-9);
      assert.equal(e.armor, C.ENEMY_ARMOR_PER_LEVEL * 15 * A.armor);
      assert.equal(e.dodge, C.ENEMY_DODGE + A.dodge);
    }
  });

  test('zone danger (M2 v3): enemy damage × (1 + ZONE_DANGER_STEP × max(0, M - ZONE_DANGER_FROM) / 10) for every variant; HP, armor, XP unchanged', () => {
    // M -> multiplier (rules 7.6: level 30 ×1.25, 40 ×1.5, 50 ×1.75, 60 ×2.0; nothing at or below 20)
    const want = [[1, 1], [10, 1], [20, 1], [21, 1.025], [25, 1.125], [30, 1.25], [40, 1.5], [50, 1.75], [58, 1.95], [60, 2.0]];
    assert.equal(C.ZONE_DANGER_FROM, 20);
    assert.equal(C.ZONE_DANGER_STEP, 0.25);
    for (const [M, mult] of want) {
      for (const [tid, variant] of [['z1_brute', 'normal'], ['z1_caster', 'trash'], ['z1_elite', 'elite'], ['z1_rare', 'rare'], ['z1_dboss', 'dboss']]) {
        const s = setup('mage', 20, [], [mob(tid, M, variant)]);
        const e = s.fight.enemies[0];
        const A = C.ARCHETYPE[e.arch];
        const V = C.VARIANT[variant];
        const old = (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * M) * A.dmg * V.dmg; // fixture templates: dmgMult 1
        assert.ok(Math.abs(e.dmg - old * mult) < 1e-9, `${tid} ${variant} level ${M}: ${e.dmg} vs ${old} × ${mult}`);
        assert.equal(e.maxHp, Math.round((C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * M) * A.hp * V.hp));
        assert.equal(e.armor, C.ENEMY_ARMOR_PER_LEVEL * M * A.armor);
        if (M === 60) assert.equal(e.dmg / old, 2, 'level 60: exactly 2.0 × the old formula');
      }
    }
    // Hits use the scaled damage: same draws, level 50 (×1.75) vs a copy holding the old value.
    const s = setup('mage', 50, [], [mob('z1_brute', 50)], (x) => { x.player.d.maxHp = x.player.hp = 1e6; x.fight.enemies[0].intent = HITI('hit', { pct: 1 }); });
    const scaled = s.fight.enemies[0].dmg;
    const oldCopy = tweak(s, (x) => { x.fight.enemies[0].dmg = scaled / 1.75; });
    const draws = (d) => d[0] > 0.9 && d[1] > 0.1;
    const hit = (t) => { const c = cloneState(t); forceDraws(c, 3, draws); return R.step(c, { type: 'PASS' }).events.find((e) => e.t === 'damage' && e.dst === 'player').amount; };
    assert.ok(Math.abs(hit(s) / hit(oldCopy) - 1.75) < 0.01, `${hit(s)} vs ${hit(oldCopy)}`);
    // Kill rewards do not depend on damage: same XP and coin with the old value.
    const kill = (t) => {
      const c = tweak(t, (x) => { x.fight.enemies[0].hp = 1; x.fight.enemies[0].dodge = 0; });
      forceDraws(c, 3, (d) => d[0] > 0.9);
      const e = R.step(c, { type: 'ATTACK', target: 0 }).events;
      return [ev(e, 'xp').filter((x) => x.why === 'kill').map((x) => x.amount), ev(e, 'gold').filter((x) => x.why === 'kill').map((x) => x.amount)];
    };
    assert.ok(kill(s)[0].length === 1 && kill(s)[1].length === 1);
    assert.deepEqual(kill(s), kill(oldCopy));
  });

  test('zone danger (M2 v3): summoned adds are scaled at their own level', () => {
    // z2_rare has the summon template; the add is a zone normal at the fight's add level.
    const s = setup('mage', 40, [], [mob('z2_rare', 40, 'rare')], (x) => {
      x.player.d.maxHp = x.player.hp = 1e6;
      x.fight.enemies[0].intent = { id: 'ab_summon', name: 'Fixture Summon', kind: 'summon', count: 1, target: 'self', est: 0 };
    });
    const r = R.step(s, { type: 'PASS' });
    assert.equal(ev(r.events, 'summon').length, 1);
    const add = r.state.fight.enemies[1];
    assert.equal(add.level, 40);
    const old = (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * 40) * C.ARCHETYPE[add.arch].dmg;
    assert.ok(Math.abs(add.dmg - old * 1.5) < 1e-9, `${add.dmg} vs ${old} × 1.5`);
  });

  test('intents: eligible actions by cooldown, SILENCED removes casts, Mend only when an ally < 70 %; picks follow weights', () => {
    const counts = {};
    for (let seed = 0; seed < 400; seed++) {
      const s = setup('mage', 20, [], [mob('z1_brute')], null, { seed });
      const id = s.fight.enemies[0].intent.id;
      counts[id] = (counts[id] || 0) + 1;
    }
    assert.ok(Math.abs(counts.heavy_smash / 400 - 0.3) < 0.07, JSON.stringify(counts));
    const sil = setup('mage', 20, [], [mob('z1_caster')], (x) => { x.fight.enemies[0].st.push({ id: 'SILENCED', dur: 30 }); });
    let t = R.step(sil, { type: 'PASS' }).state; // this round's intent was rolled before the SILENCE
    for (let i = 0; i < 15; i++) { assert.ok(!t.fight.enemies[0].intent.cast); t = R.step(tweak(t, (x) => { x.player.hp = x.player.d.maxHp; }), { type: 'PASS' }).state; if (!t.fight) break; }
    const mend = setup('mage', 20, [], [mob('z1_mender'), mob('z1_brute')], (x) => { bigHp(x); });
    let mends = 0;
    let u = mend;
    for (let i = 0; i < 20; i++) { if (u.fight.enemies[0].intent.id === 'mend') mends++; u = R.step(tweak(u, (x) => { x.player.hp = x.player.d.maxHp; }), { type: 'PASS' }).state; }
    assert.equal(mends, 0, 'no Mend while every ally is above 70 %');
    const cd = setup('mage', 20, [], [mob('z1_brute')], (x) => { x.fight.enemies[0].cds.heavy_smash = 99; });
    let v = cd;
    for (let i = 0; i < 10; i++) { assert.notEqual(v.fight.enemies[0].intent.id, 'heavy_smash'); v = R.step(tweak(v, (x) => { x.player.hp = x.player.d.maxHp; }), { type: 'PASS' }).state; }
  });

  test('intent shows target, estimated damage and the cast/heavy flags; soft enrage from round 20', () => {
    const s = setup('mage', 20, [], [mob('z1_caster')], (x) => { x.fight.enemies[0].intent = HITI(); });
    const est = R.step(s, { type: 'PASS' }).state.fight.enemies[0].intent;
    assert.ok(['player', 'pet', 'all', 'self'].includes(est.target) || typeof est.target === 'number');
    assert.equal(typeof est.cast, 'boolean');
    assert.equal(typeof est.heavy, 'boolean');
    const late = setup('rogue', 20, [], [mob('z1_brute')], (x) => { x.fight.round = 22; x.fight.enemies[0].intent = HITI(); });
    const r = act(late, { type: 'PASS' });
    const e = late.fight.enemies[0];
    assert.equal(r.events.find((x) => x.t === 'damage' && x.dst === 'player').amount,
      pipeline({ base: e.dmg, attPct: 3 * C.FIGHT_SOFT_ENRAGE_STEP, attL: 20, tgtL: 20, phys: true, dodge: late.player.d.dodge, crit: C.ENEMY_CRIT, armor: late.player.d.armor, draws: r.draws }).amount);
  });

  test('template abilities: summon at 50 % HP (once, telegraphed), enrage below 30 %, self_shield absorbs', () => {
    const s = setup('mage', 20, [], [mob('z2_rare', 20, 'rare')], (x) => { const e = x.fight.enemies[0]; e.hp = Math.floor(e.maxHp * 0.4); });
    const r = R.step(s, { type: 'PASS' });
    const it = r.state.fight.enemies[0].intent;
    assert.equal(it.kind, 'summon');
    const r2 = R.step(tweak(r.state, (x) => { x.player.hp = x.player.d.maxHp; }), { type: 'PASS' });
    assert.equal(ev(r2.events, 'summon').length, 1);
    assert.equal(r2.state.fight.enemies.length, 2);
    const en = setup('mage', 20, ['ember_bolt'], [mob('z1_rare', 20, 'rare')], (x) => { stun(x); const e = x.fight.enemies[0]; e.hp = Math.ceil(e.maxHp * 0.31); });
    const r3 = act(en, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
    assert.ok(ev(r3.events, 'enrage').length === 1 && r3.state.fight.enemies[0].enraged === 0.4);
  });
});

describe('rules 7.7 interrupts', () => {
  test('a cast is lost if the enemy is STUNNED, FROZEN or HEXED before it acts; bosses: stun-tagged spells interrupt', () => {
    const s = setup('mage', 20, ['hexbind'], [mob('z1_caster')], (x) => { x.fight.enemies[0].intent = HITI('hit', { id: 'hex_bolt', cast: true, school: 'magic', cd: 3, pct: 2 }); });
    const r = act(s, { type: 'CAST', spellId: 'hexbind', target: 0 }, () => true, 1);
    assert.equal(ev(r.events, 'interrupt').length, 1);
    assert.equal(r.state.fight.enemies[0].cds.hex_bolt, s.fight.round + 3, 'cooldown of the cast still starts');
    const d = setup('rogue', 20, ['temple_blow'], [mob('z1_dboss', 9, 'dboss')], (x) => { x.fight.p.cp = 2; x.fight.enemies[0].intent = HITI('hit', { id: 'ab_dark', cast: true, school: 'magic', cd: 4, pct: 2.1 }); }, { kind: 'dboss' });
    const rd = act(d, { type: 'CAST', spellId: 'temple_blow', target: 0 }, () => true, 1);
    assert.equal(ev(rd.events, 'interrupt').length, 1);
    assert.ok(!st(rd.state.fight.enemies[0].st, 'STUN'), 'bosses are immune to STUN');
  });

  test('7.2 step 3 / 7.7 interrupt-tagged spells never miss and cannot be dodged; r1-r3 are still drawn (M2 v2)', () => {
    const casting = (x) => { x.player.pet = null; x.fight.enemies[0].intent = HITI('hit', { id: 'hex_bolt', cast: true, school: 'magic', cd: 3, pct: 2 }); };
    // vs a skulker at the same level: r1 < MISS_BASE misses, MISS_BASE <= r1 < MISS_BASE + dodge (0.15) is a dodge for phys hits.
    const draws = { miss: (d) => d[0] < 0.01, dodge: (d) => d[0] > 0.08 && d[0] < 0.15, hit: (d) => d[0] > 0.9 };
    const advanced = (g, n) => { const x = g.slice(); for (let i = 0; i < n; i++) nextFloat(x); return x; };
    for (const [cls, id] of [['rogue', 'throat_jab'], ['mage', 'spellsnap'], ['hunter', 'muzzle_shot']]) {
      assert.ok(C.SPELL[id].tags.includes('interrupt'));
      const s = setup(cls, 20, [id], [mob('z1_skulker', 20)], casting);
      for (const [name, pred] of Object.entries(draws)) {
        const c = cloneState(s);
        forceDraws(c, 3, pred);
        const g = c.fight.rng.slice();
        const r = R.step(c, { type: 'CAST', spellId: id, target: 0 });
        assert.equal(ev(r.events, 'miss').length, 0, `${id}: ${name} draw`);
        assert.ok(r.events.some((e) => e.t === 'damage' && e.dst === 0 && e.spell === id), `${id}: ${name} draw hits`);
        assert.equal(ev(r.events, 'interrupt').length, 1, `${id}: ${name} draw interrupts`);
        assert.ok(r.events.some((e) => e.t === 'status' && e.u === 0 && e.id === 'SILENCED' && e.on), `${id}: SILENCED applied`);
        // 3 draws for the hit, then 1 intent draw for the (silenced, petless) skulker's next round.
        assert.deepEqual(r.state.fight.rng, advanced(g, 4), `${id}: ${name} draw uses the same stream positions`);
      }
      const ctl = cloneState(s);
      forceDraws(ctl, 3, draws.miss);
      assert.equal(ev(R.step(ctl, { type: 'ATTACK', target: 0 }).events, 'miss').filter((e) => e.src === 'player').length, 1, 'the same draw makes a basic attack miss');
    }
  });
});

describe('rules 7.8 flee', () => {
  test('FLEE succeeds at FLEE_BASE - 0.05 × (enemies - 1); always in STEALTH; never vs dungeon or end boss', () => {
    let ok = 0;
    const N = 400;
    for (let seed = 0; seed < N; seed++) {
      const s = setup('mage', 20, [], [mob(), mob('z1_beast'), mob('z1_skulker')], null, { seed });
      if (R.step(s, { type: 'FLEE' }).events.some((e) => e.t === 'action' && e.success)) ok++;
    }
    assert.ok(Math.abs(ok / N - (C.FLEE_BASE - 2 * C.FLEE_PER_EXTRA_ENEMY)) < 0.07, `rate ${ok / N}`);
    assert.equal(R.fleeChance(setup('mage', 20, [], [mob(), mob('z1_beast'), mob('z1_skulker')])), C.FLEE_BASE - 2 * C.FLEE_PER_EXTRA_ENEMY);
    const stealth = setup('rogue', 20, [], [mob(), mob()], null, { stealth: true });
    assert.equal(R.fleeChance(stealth), 1);
    const r = R.step(stealth, { type: 'FLEE' });
    assert.equal(r.state.phase, 'MAP');
    const boss = setup('mage', 20, [], [mob('z1_dboss', 9, 'dboss')], null, { kind: 'dboss' });
    assert.ok(!R.isLegal(boss, { type: 'FLEE' }));
  });
});

describe('rules 7.9 autoplay policy', () => {
  test('rule 1: HP < 35 % and a healing item on the item bar -> use it', () => {
    const s = setup('rogue', 20, ['gutting_jab'], [mob()], (x) => { x.player.hp = Math.floor(x.player.d.maxHp * 0.3); x.player.bag.push({ uid: 'h', kind: 'cons', id: 'healing_draught', qty: 1 }); x.player.itemBar = [null, 'healing_draught', null]; });
    assert.deepEqual(R.autoAction(s), { type: 'USE_ITEM', slot: 1, target: null });
  });

  test('rule 2: own debuff stacks >= 3 -> cleanse spell first, else Purifying Tonic', () => {
    const s = setup('rogue', 40, ['gutting_jab', 'vanishing_step'], [mob()], (x) => { x.fight.p.st.push({ id: 'BRAND', stacks: 3, dur: null }); x.player.bag.push({ uid: 't', kind: 'cons', id: 'purifying_tonic', qty: 1 }); x.player.itemBar = ['purifying_tonic', null, null]; });
    assert.deepEqual(R.autoAction(s), { type: 'CAST', spellId: 'vanishing_step', target: null });
    const t = tweak(s, (x) => { x.fight.p.cds.vanishing_step = 99; });
    assert.deepEqual(R.autoAction(t), { type: 'USE_ITEM', slot: 0, target: null });
  });

  test('rule 3: interrupt the cast with the highest estimated damage (ties: lowest index)', () => {
    const s = setup('mage', 20, ['ember_bolt', 'spellsnap'], [mob('z1_caster'), mob('z1_caster'), mob('z1_caster')], (x) => {
      x.fight.enemies[0].intent = HITI('hit', { cast: true, est: 30 });
      x.fight.enemies[1].intent = HITI('hit', { cast: true, est: 50 });
      x.fight.enemies[2].intent = HITI('hit', { cast: true, est: 50 });
    });
    assert.deepEqual(R.autoAction(s), { type: 'CAST', spellId: 'spellsnap', target: 1 });
  });

  test('rule 4: mana < 20 % and a Mana Draught -> drink; rule 5: first bar spell whose condition holds; rule 6: basic attack', () => {
    const s = setup('mage', 20, ['frost_lance', 'ember_bolt'], [mob()], (x) => { x.player.mana = Math.floor(x.player.d.maxMana * 0.15); x.player.bag.push({ uid: 'm', kind: 'cons', id: 'mana_draught', qty: 1 }); x.player.itemBar = [null, null, 'mana_draught']; });
    assert.deepEqual(R.autoAction(s), { type: 'USE_ITEM', slot: 2, target: null });
    const r5 = setup('mage', 20, ['frost_lance', 'ember_bolt'], [mob()]);
    assert.equal(R.autoAction(r5).spellId, 'frost_lance');
    const chilled = tweak(r5, (x) => { x.fight.enemies[0].st.push({ id: 'CHILLED', dur: 2, value: 0.2 }); });
    assert.equal(R.autoAction(chilled).spellId, 'ember_bolt', 'Frost Lance only when the target is not CHILLED');
    const rogue = setup('rogue', 20, ['severing_flourish'], [mob()]);
    assert.deepEqual(R.autoAction(rogue), { type: 'ATTACK', target: 0 }, 'finisher condition fails at 0 CP -> basic attack');
  });

  test('default target: living non-HEXED, mender > caster > others, then lowest HP, then lowest index', () => {
    const s = setup('rogue', 20, [], [mob('z1_brute'), mob('z1_caster'), mob('z1_mender'), mob('z1_caster')], (x) => { x.fight.enemies[1].hp = 5; x.fight.enemies[3].hp = 5; });
    assert.equal(R.autoAction(s).target, 2);
    const hexed = tweak(s, (x) => { x.fight.enemies[2].st.push({ id: 'HEXED', dur: 3 }); });
    assert.equal(R.autoAction(hexed).target, 1);
  });
});
