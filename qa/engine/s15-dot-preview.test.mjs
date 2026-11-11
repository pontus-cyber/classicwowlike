// DoT preview and talent totals (owner feedback 2026-11-11 08:11 and 08:14; engine-api.md 1, 6.1): R.pendingTicks
// against the ticks the engine plays at the end of the round (rules 7.1 step 5, 7.2, 7.4, 9), over many fights and in
// set-up cases (absorbs, deaths, Plague Heart, crits); R.talentInfo against C.TALENT and C.TALENT_PER_RANK (rules 6).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT as FIX, started, inFight, tweak, cloneState, refreshDerived } from './helpers.mjs';
import { CONTENT } from '../../src/content/index.js';
import { roundActions, tickPhase } from '../../src/engine/combat.js';

const hpOf = (s, u) => (u === 'player' ? s.player.hp : u === 'pet' ? (s.player.pet && s.player.pet.alive ? s.player.pet.hp : 0) : s.fight.enemies[u].alive ? s.fight.enemies[u].hp : 0);
/** What the tick events of a round did, per unit (an independent reading of the events of engine-api.md 5). */
function readTicks(events, after) {
  const m = new Map();
  const rec = (u) => { if (!m.has(u)) m.set(u, { amount: 0, hpLost: 0, absorbed: 0, heal: 0, lethal: false, resurrect: null, crits: 0 }); return m.get(u); };
  for (const e of events) {
    if (e.t === 'damage') { const r = rec(e.dst); r.amount += e.amount; r.hpLost += e.hpLost; r.absorbed += e.absorbed || 0; if (e.crit) r.crits += 1; }
    else if (e.t === 'heal') rec(e.dst).heal += e.amount;
    else if (e.t === 'death') rec(e.u).lethal = true;
    else if (e.t === 'resurrect') Object.assign(rec('player'), { lethal: true, resurrect: e.source });
  }
  for (const [u, r] of m) r.hpAfter = hpOf(after, u);
  return m;
}
const FIELDS = ['amount', 'hpLost', 'absorbed', 'heal', 'lethal', 'resurrect', 'hpAfter'];
const pick = (x) => Object.fromEntries(FIELDS.map((k) => [k, x[k]]));
/**
 * What a unit's ticks read (rules 7.4, 9): an enemy its HP, statuses and shield; the player (and the pet, which takes the
 * Shared Wounds share) HP, mana (Mindguard), statuses, Death's Sidestep, the resurrect charges and the pet.
 */
const projU = (s, u) => (typeof u === 'number'
  ? JSON.stringify([s.fight.enemies[u].alive, s.fight.enemies[u].hp, s.fight.enemies[u].st, s.fight.enemies[u].shield])
  : JSON.stringify([s.player.hp, s.player.mana, s.player.level, s.fight.p.st, s.fight.p.sidestepUsed, s.player.res, s.player.pet && [s.player.pet.alive, s.player.pet.hp], s.fight.pet.st]));
const ORDER = (u) => (u === 'player' ? -2 : u === 'pet' ? -1 : u);

/**
 * One combat step checked: the round is replayed up to its ticks (roundActions; its events must be the real step's
 * first ones), R.pendingTicks of that moment must equal what the ticks then do (the real step's next events), and
 * R.pendingTicks at the start of the round must equal it too when the round changed nothing the ticks read.
 */
function checkStep(S0, action, tally) {
  const real = R.step(S0, action);
  const S = cloneState(S0); const pre = [];
  roundActions(S, pre, action);
  assert.equal(JSON.stringify(real.events.slice(0, pre.length)), JSON.stringify(pre), 'the replay of the round matches the real step');
  if (S.fight.over) return real.state;
  const P = R.pendingTicks(S);
  const P0 = R.pendingTicks(S0);
  const T = cloneState(S); const ticks = [];
  tickPhase(T, ticks);
  assert.equal(JSON.stringify(real.events.slice(pre.length, pre.length + ticks.length)), JSON.stringify(ticks), 'the tick phase replayed is the real one');
  const act = readTicks(ticks, T);
  const crits = ticks.some((e) => e.t === 'damage' && e.crit);
  const byU = new Map(P.map((x) => [x.u, x]));
  const units = new Set([...act.keys(), ...byU.keys()]);
  for (const u of units) {
    const p = byU.get(u) || { amount: 0, hpLost: 0, absorbed: 0, heal: 0, lethal: false, resurrect: null, hpAfter: hpOf(S, u), crit: null };
    const a = act.get(u) || { amount: 0, hpLost: 0, absorbed: 0, heal: 0, lethal: false, resurrect: null, hpAfter: hpOf(T, u), crits: 0 };
    assert.equal(p.hp ?? hpOf(S, u), hpOf(S, u), `hp now of ${u}`);
    if (!crits) {
      assert.deepEqual(pick(p), pick(a), `unit ${u}: preview ${JSON.stringify(pick(p))}, ticks ${JSON.stringify(pick(a))} (${JSON.stringify(ticks.filter((e) => e.dst === u || e.u === u))})`);
    } else {
      const hi = p.crit || p;
      assert.ok(p.amount <= a.amount && a.amount <= hi.amount, `unit ${u} with crits: ${p.amount} <= ${a.amount} <= ${hi.amount}`);
      assert.ok((!p.lethal || a.lethal) && (!a.lethal || hi.lethal), `unit ${u} with crits: lethal ${p.lethal} / ${a.lethal} / ${hi.lethal}`);
      tally.crit += 1;
    }
    if (a.amount > 0) tally.units += 1;
    if (a.lethal) tally.lethal += 1;
  }
  tally.steps += 1;
  // the preview shown at the start of the round, per unit: exact when the round changed nothing that unit's ticks read and
  // no unit before it in the tick order dies (a death ends the fight; Plague Heart spreads to later enemies)
  const plague = !!S.player.talents.r_c9;
  const byU0 = new Map((P0 || []).map((x) => [x.u, x]));
  const dies = (m, u) => [...m.entries()].some(([k, x]) => ORDER(k) < ORDER(u) && x.lethal);
  for (const u of units) {
    if (projU(S0, u) !== projU(S, u) || (plague && typeof u === 'number') || dies(byU0, u) || dies(act, u)) continue;
    const p0 = byU0.get(u); const a = act.get(u);
    if (!p0 || !a || a.crits) continue;
    assert.deepEqual(pick(p0), pick(a), `start of round, unit ${u}: preview ${JSON.stringify(pick(p0))}, ticks ${JSON.stringify(pick(a))}`);
    tally.start += 1;
  }
  return real.state;
}

/** A run built at a zone (R.debug.build), with a talent build set directly (the tier gates do not matter here). */
function built(classId, seed, zone, talents = null) {
  let s = R.debug.build({ content: CONTENT, classId, seed, zone, talents: talents ? 'unspent' : 'auto', potions: 0 }).state;
  if (talents) {
    s = cloneState(s);
    s.player.talents = { ...talents };
    s.player.talentSpent = Object.values(talents).reduce((a, b) => a + b, 0);
    refreshDerived(s);
    s.player.hp = s.player.d.maxHp; s.player.mana = s.player.d.maxMana;
  }
  return s;
}
const BUILDS = {
  rogue: { r_c1: 3, r_c2: 3, r_c3: 2, r_c5: 2, r_c4: 2, r_c8: 3, r_b9: 1, r_b2: 3 },
  rogue_plague: { r_c1: 3, r_c3: 2, r_c5: 1, r_c9: 1 },
  mage: { m_c7: 1, m_c1: 3, m_a5: 2, m_a3: 2, m_a8: 3, m_a7: 2, m_a1: 3 },
  hunter: { h_a8: 1, h_a1: 3, h_a5: 2, h_c6: 2, h_c7: 1, h_c3: 2, h_c2: 3 },
};

describe('R.pendingTicks equals the ticks of the end of the round (rules 7.1 step 5)', () => {
  test('over many fights: autoplay runs from the start, built runs with DoT, absorb and death talents, a passive player', () => {
    const tally = { steps: 0, units: 0, lethal: 0, crit: 0, start: 0 };
    const play = (s, maxSteps, policy) => {
      for (let i = 0; i < maxSteps && s.phase !== 'ENDED'; i++) {
        const a = policy(s, i);
        s = s.fight && !s.fight.over ? checkStep(s, a, tally) : R.step(s, a).state;
      }
      return s;
    };
    const auto = (s) => R.autoAction(s);
    // a player who passes every third round: enemies keep their DoTs ticking on the player longer
    const lazy = (s, i) => (s.fight && i % 3 === 0 && R.isLegal(s, { type: 'PASS' }) ? { type: 'PASS' } : R.autoAction(s));
    for (const cls of ['rogue', 'mage', 'hunter']) {
      for (const seed of [3, 11, 17]) {
        let s = R.newRun({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, content: CONTENT });
        s = R.step(s, { type: 'START_RUN' }).state;
        play(s, 1500, seed === 11 ? lazy : auto);
      }
      // built runs: each fights the zone's normal and elite templates
      for (const [seed, zone] of [[5, 2], [9, 4], [21, 5], [33, 3], [40, 6], [47, 2]]) {
        let s = built(cls, seed, zone, cls === 'rogue' && (seed === 33 || seed === 47) ? BUILDS.rogue_plague : BUILDS[cls]);
        const foes = R.debug.enemies(CONTENT).filter((x) => x.zone === zone && (x.kind === 'normal' || x.kind === 'elite'));
        const ids = [foes.filter((x) => x.kind === 'normal').slice(0, 3).map((x) => x.id), [foes.find((x) => x.kind === 'elite').id]];
        for (const set of ids) {
          if (s.phase === 'ENDED' || s.phase === 'SUMMARY') break;
          s = R.debug.refill(s).state;
          s = R.debug.encounter(s, { ids: set }).state;
          for (let i = 0; i < 80 && s.fight && !s.fight.over; i++) s = checkStep(s, lazy(s, i), tally);
          for (let i = 0; i < 20 && !s.fight && (s.loot || []).length && s.phase !== 'ENDED'; i++) s = R.step(s, R.autoAction(s)).state;
        }
      }
    }
    assert.ok(tally.steps > 800, `combat steps checked: ${tally.steps}`);
    assert.ok(tally.units > 150, `units with tick damage: ${tally.units}`);
    assert.ok(tally.start > 60, `start-of-round unit previews checked against the ticks: ${tally.start}`);
    assert.ok(tally.crit > 0, `rounds with tick crits (bounds checked): ${tally.crit}`);
    console.log(`# pendingTicks: ${tally.steps} combat steps, ${tally.units} units hit by ticks, ${tally.lethal} tick deaths, ${tally.crit} with crits, ${tally.start} start-of-round unit previews equal to the ticks`);
  });
});

describe('R.pendingTicks in set-up cases', () => {
  /** A fixture fight in its engage round (enemies Unaware: PASS leads straight to the ticks). */
  const fight = (cls = 'rogue', enemies = [{ tid: 'z1_brute', level: 5 }], talents = {}) => {
    let s = started(cls, { seed: 4 });
    s = tweak(s, (c) => { c.player.level = 12; c.player.talents = { ...talents }; refreshDerived(c); c.player.hp = c.player.d.maxHp; c.player.mana = c.player.d.maxMana; if (c.player.pet) { c.player.pet.alive = true; c.player.pet.hp = c.player.d.petMaxHp; } });
    return inFight(s, enemies, { noStealth: true }).state;
  };
  const bleed = (tick, by = 0) => ({ id: 'BLEED', src: `rend@${by}`, by, dur: 2, full: 2, tick, canCrit: false });
  const pass = (s) => R.step(s, { type: 'PASS' });

  test('an enemy DoT that kills: lethal at the start of the round, and the enemy dies in the ticks', () => {
    const s = tweak(fight(), (c) => { const e = c.fight.enemies[0]; e.st.push({ id: 'BLEED', src: 'open_vein', dur: 3, full: 3, tick: e.hp, canCrit: false }); });
    const p = R.pendingTicks(s, 0);
    assert.equal(R.isEngageRound(s), true);
    assert.deepEqual([p.amount, p.hpLost, p.hpAfter, p.lethal], [s.fight.enemies[0].hp, s.fight.enemies[0].hp, 0, true]);
    const r = pass(s);
    assert.ok(r.events.some((e) => e.t === 'death' && e.u === 0), 'the enemy died at the end of the round');
    assert.equal(R.pendingTicks(s, 'player'), null, 'no tick touches the player');
  });

  test('the player: lethal with no resurrect; a Boon of Return names the resurrect; WARD, IMMUNE and god mode absorb', () => {
    const base = tweak(fight(), (c) => { c.player.hp = 5; c.fight.p.st.push(bleed(9)); });
    let p = R.pendingTicks(base, 'player');
    assert.deepEqual(pick(p), { amount: 9, hpLost: 5, absorbed: 0, heal: 0, lethal: true, resurrect: null, hpAfter: 0 });
    assert.equal(pass(base).state.phase, 'SUMMARY', 'the player died in the ticks');
    const boon = tweak(base, (c) => { c.player.res.boon = 1; });
    p = R.pendingTicks(boon, 'player');
    assert.equal(p.lethal, true); assert.equal(p.resurrect, 'boon'); assert.equal(p.hpAfter, Math.max(1, Math.round(C.RES_HP_PCT * boon.player.d.maxHp)));
    const ward = tweak(base, (c) => { c.fight.p.st.unshift({ id: 'WARD', dur: null, amount: 6 }); });
    p = R.pendingTicks(ward, 'player');
    assert.deepEqual([p.amount, p.absorbed, p.hpAfter, p.lethal], [3, 6, 2, false]);
    const imm = tweak(base, (c) => { c.fight.p.st.unshift({ id: 'IMMUNE', dur: 1 }); });
    p = R.pendingTicks(imm, 'player');
    assert.deepEqual([p.amount, p.lethal, p.ticks[0].immune], [0, false, true]);
    const god = R.debug.setGod(base, true).state;
    assert.equal(R.pendingTicks(god, 'player').amount, 0);
  });

  test('an enemy shield absorbs a tick', () => {
    const s = tweak(fight(), (c) => { const e = c.fight.enemies[0]; e.shield = 7; e.st.push({ id: 'BURN', src: 'living_flame', dur: 3, full: 3, tick: 10, canCrit: false }); });
    const p = R.pendingTicks(s, 0);
    assert.deepEqual([p.amount, p.absorbed, p.hpAfter], [3, 7, s.fight.enemies[0].hp - 3]);
    const r = pass(s);
    assert.ok(r.events.some((e) => e.t === 'damage' && e.dst === 0 && e.tick && e.amount === 3 && e.absorbed === 7));
  });

  test('Mindguard pays part from mana; Shared Wounds moves part to the pet (the pet entry); Death\'s Sidestep takes none', () => {
    const mg = tweak(fight('mage', undefined, { m_c7: 1 }), (c) => { c.fight.p.st.push(bleed(10)); });
    let p = R.pendingTicks(mg, 'player');
    assert.deepEqual([p.amount, p.absorbed], [8, 2]);
    const sw = tweak(fight('hunter', undefined, { h_a8: 1 }), (c) => { c.fight.p.st.push(bleed(10)); });
    p = R.pendingTicks(sw, 'player');
    const pet = R.pendingTicks(sw, 'pet');
    assert.deepEqual([p.amount, pet.amount, pet.ticks[0].spell], [8, 2, 'shared_wounds']);
    const ds = tweak(fight('rogue', undefined, { r_b9: 1 }), (c) => { c.player.hp = Math.round(c.player.d.maxHp * 0.25); c.fight.p.st.push(bleed(Math.round(c.player.d.maxHp * 0.1))); });
    p = R.pendingTicks(ds, 'player');
    assert.equal(p.amount, 0); assert.equal(p.ticks[0].sidestep, true); assert.equal(p.lethal, false);
    assert.equal(p.heal, Math.round(C.TALENT.r_b9.healPct * ds.player.d.maxHp));
  });

  test('a HOT and a BLEED on the player tick in the order of the statuses (the preview keeps it)', () => {
    const s = tweak(fight(), (c) => { c.player.hp = c.player.d.maxHp - 5; c.fight.p.st.push({ id: 'HOT', dur: 2, amount: 10, src: 'field_dressing' }, bleed(15)); });
    const p = R.pendingTicks(s, 'player');
    assert.deepEqual([p.heal, p.amount, p.hpAfter], [5, 15, s.player.d.maxHp - 15]);
  });

  test('Plague Heart: an enemy killed by its POISON spreads it, and a later enemy ticks it in the same round', () => {
    const s = tweak(fight('rogue', [{ tid: 'z1_brute', level: 5 }, { tid: 'z1_brute', level: 5 }], { r_c9: 1, r_c1: 1 }), (c) => {
      const e = c.fight.enemies[0]; e.st.push({ id: 'POISON', dur: 4, full: 4, tick: e.hp, stacks: 1, max: 5, canCrit: false });
    });
    const all = R.pendingTicks(s);
    const e1 = all.find((x) => x.u === 1);
    assert.equal(all.find((x) => x.u === 0).lethal, true);
    assert.ok(e1 && e1.amount === Math.min(s.fight.enemies[0].hp, Infinity) && e1.ticks[0].spell === 'poison', JSON.stringify(e1));
    const r = pass(s);
    assert.ok(r.events.some((e) => e.t === 'damage' && e.dst === 1 && e.tick), 'enemy 1 ticked the spread POISON in the same round');
  });

  test('a tick that can crit: counted without the crit; `crit` has every such tick a crit (draws nothing)', () => {
    const s = tweak(fight('rogue', undefined, { r_c5: 1, r_c1: 1 }), (c) => { c.fight.enemies[0].st.push({ id: 'POISON', dur: 4, full: 4, tick: 7, stacks: 3, max: 5, canCrit: true }); });
    const rng = JSON.stringify(s.fight.rng); const before = R.serialize(s);
    const p = R.pendingTicks(s, 0);
    assert.equal(p.amount, 21);
    assert.equal(p.crit.amount, Math.round(21 * s.player.d.critMult));
    assert.equal(JSON.stringify(s.fight.rng), rng, 'no draw');
    assert.equal(R.serialize(s), before, 'the state is unchanged');
  });

  test('BRAND ticks on the player (rules 10.2) are previewed; null outside a fight', () => {
    const s = tweak(fight(), (c) => { c.fight.p.st.push({ id: 'BRAND', stacks: 2, dur: null }); });
    const p = R.pendingTicks(s, 'player');
    assert.ok(p.amount > 0 && p.ticks[0].spell === 'brand');
    assert.equal(R.pendingTicks(started('mage')), null);
  });
});

describe('R.talentInfo (rules 6: "/rank" values multiply by the ranks taken)', () => {
  test('every talent has a TALENT_PER_RANK entry whose fields are numbers of TALENT (base: b, l, p)', () => {
    assert.deepEqual(Object.keys(C.TALENT_PER_RANK).sort(), Object.keys(C.TALENT).sort());
    for (const [id, keys] of Object.entries(C.TALENT_PER_RANK)) {
      for (const k of keys) {
        if (k === 'base') for (const f of ['b', 'l', 'p']) assert.equal(typeof C.TALENT[id][f], 'number', `${id}.${f}`);
        else assert.equal(typeof C.TALENT[id][k], 'number', `${id}.${k}`);
      }
    }
  });
  test('Silent Footing 3/3: now +30 %, no next rank; 1/3: now 10 %, next 20 %; 0/3: next 10 %', () => {
    const s = started('rogue');
    const at = (n) => R.talentInfo(tweak(s, (c) => { c.player.talents.r_b1 = n; }), 'r_b1');
    assert.deepEqual([at(3).now, at(3).next], [{ pct: 0.3 }, null]);
    assert.deepEqual([at(1).now, at(1).next], [{ pct: 0.1 }, { pct: 0.2 }]);
    assert.deepEqual([at(0).now, at(0).next, at(0).per], [null, { pct: 0.1 }, { pct: 0.1 }]);
    assert.equal(R.talentInfo(s, 'nope'), null);
  });
  test('two fields per rank (Cheap Trick), rank effects (Hemorrhage Mastery), formulas with the character (Toxic Coating, Trapper)', () => {
    const s = started('rogue');
    const r = (id, n) => R.talentInfo(tweak(s, (c) => { c.player.talents[id] = n; }), id);
    assert.deepEqual(r('r_b5', 2).now, { cost: 20, cd: 2 });
    assert.deepEqual([r('r_c5', 1).now, r('r_c5', 2).now], [{ dotCrit: true, dotPct: 0 }, { dotCrit: true, dotPct: C.TALENT.r_c5.rank2DotPct }]);
    const T = C.TALENT.r_c1;
    assert.equal(r('r_c1', 2).now.base, Math.round((T.b + T.l * s.player.level + T.p * s.player.d.power) * 2 * 10) / 10);
    const h = started('hunter', { seed: 2 });
    const H = C.TALENT.h_c3;
    const hi = R.talentInfo(tweak(h, (c) => { c.player.talents.h_c3 = 1; c.player.spells.snare_trap = { tl: 4, rank: 1 }; }), 'h_c3');
    assert.equal(hi.now.base, Math.round((H.b + H.l * 4 + H.p * h.player.d.power) * 10) / 10);
    assert.equal(hi.now.cd, 1);
    assert.equal(R.talentInfo(null, 'r_c1').per.base, null, 'no character: no formula value');
  });
});
