// rules.md 1.9.5, 7.4, 7.9, 12.4 and 13, the lines marked "(M2b v14)" (docs/specs/changes-m2b-v14.md rows 1, 2 and 4,
// D111-D113): autoplay rule H and the PASS that keeps STEALTH while every living enemy is SAPPED, a hidden elite's
// Deathblow type on the map and the content invariant behind it, the v13 switches on by default, and the views for the UI
// (autoplayEngage `wait`, Sap "sure if you wait", the PASS answer). Each test fails when its rule is reverted. The switch
// defaults are checked against the v14 table by s13.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, inFight, tweak, ev, st } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { CONTENT as MIN } from '../fixtures/content-min.js';
import { deathblowOf } from '../../src/engine/track.js';
import { makeConsumable, addToBag } from '../../src/engine/items.js';

const mob = (tid, level = 20, variant = 'normal') => ({ tid, level, variant });
// Fixture content: the zone-1 elite's Deathblow is Heavy Blow (heavy), the zone-2 elite's Dark Cast (cast).
const elite = (z, level = 20) => mob(`z${z}_elite`, level, 'elite');

function fight(cls, L, spells, enemies, opts = {}) {
  let s = withSpells(atLevel(started(cls, { seed: opts.seed ?? 77, petId: opts.petId }), L), spells);
  const v = enemies[0].variant;
  const kind = opts.kind || (v === 'elite' || v === 'rare' || enemies.some((e) => e.variant === 'elite') ? 'elite' : 'quest');
  s = inFight(s, enemies, { noStealth: !opts.stealth, kind }).state;
  return opts.prep ? tweak(s, opts.prep) : s;
}
const tough = (x) => { x.player.d.maxHp = x.player.hp = 1e6; for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; };
/** A level-5 Rogue in STEALTH (Shadowstep Strike, no Throat Jab) against a lone zone-1 elite, plus `extra` enemies first. */
const BAR = ['shadowstep_strike', 'gutting_jab'];
const rogue = (extra = [], opts = {}) => fight('rogue', 5, BAR, [...extra, elite(1, 5)], { stealth: true, prep: tough, ...opts });
const auto = (s) => R.step(s, R.autoAction(s));
const sap = (target) => ({ type: 'ENGAGE', option: 'sap', target });
const PASS = { type: 'PASS' };
function withGate(key, value, fn) {
  const old = C.GATES[key];
  C.GATES[key] = value;
  try { return fn(); } finally { C.GATES[key] = old; }
}
const stealthed = (s) => !!st(s.fight.p.st, 'STEALTH');

describe('rules 7.9 autoplay rule H and rules 7.4 the PASS that keeps STEALTH (M2b v14 row 1, D111)', () => {
  test('a Rogue below Throat Jab Saps a lone elite (E2), waits in round 2 (PASS, still in STEALTH); Sap cancels the Deathblow in round 3 (STAGGERED, OFF_BALANCE, no MAIMED); it then opens from STEALTH', () => {
    let s = rogue();
    assert.deepEqual(R.autoAction(s), sap(0), 'E2');
    s = auto(s).state;
    assert.equal(s.fight.round, 2);
    assert.ok(st(s.fight.enemies[0].st, 'SAPPED'));
    assert.deepEqual(R.autoAction(s), PASS, 'rule H');
    const r = auto(s);
    s = r.state;
    assert.ok(stealthed(s), 'the PASS kept STEALTH');
    const e = s.fight.enemies[0];
    assert.equal(s.fight.round, 3);
    assert.deepEqual([e.intent.cancelled.by, e.intent.cancelled.deathblow], ['SAPPED', true]);
    assert.deepEqual(ev(r.events, 'stagger').map((x) => [x.why, x.by, !!x.deathblow]), [['control', 'SAPPED', true]]);
    assert.equal(st(e.st, 'STAGGERED').deathblows, 1);
    assert.ok(st(e.st, 'OFF_BALANCE'), 'a cancelled heavy leaves it OFF_BALANCE');
    assert.equal(st(s.fight.p.st, 'MAIMED'), null);
    // Nothing left for Sap to cancel: no wait; the opener from STEALTH into the window.
    assert.deepEqual(R.autoAction(s), { type: 'CAST', spellId: 'shadowstep_strike', target: 0 });
  });

  test('rule H only while every living enemy is SAPPED, after rules 1-2, and only for a wind-up Sap will cancel; off with GATES.sapHold (the Rogue strikes and Sap breaks)', () => {
    // An add lives: no wait; autoplay fights the add (the sapped elite is not the default target).
    let s = auto(rogue([mob('z1_caster', 5)])).state;
    assert.deepEqual([st(s.fight.enemies[1].st, 'SAPPED') !== null, R.autoAction(s).type], [true, 'CAST']);
    assert.equal(R.autoAction(s).target, 0);
    // Rules 1-2 come first: a hurt Rogue drinks.
    s = auto(rogue()).state;
    const hurt = tweak(s, (x) => {
      addToBag(x, makeConsumable(x, 'healing_draught', 2));
      x.player.itemBar = ['healing_draught', null, null];
      x.player.hp = Math.round(x.player.d.maxHp * (C.AUTO_POTION_HP / 2));
    });
    assert.equal(R.autoAction(hurt).type, 'USE_ITEM');
    // No wind-up for Sap to cancel (a lone normal enemy in a grind fight): no wait.
    let g = fight('rogue', 5, BAR, [mob('z1_brute', 5)], { stealth: true, prep: tough, kind: 'grind' });
    g = R.step(g, sap(0)).state;
    assert.equal(g.fight.enemies[0].track.some((x) => x.windup), false);
    assert.notEqual(R.autoAction(g).type, 'PASS');
    // The switch off: the v13 behaviour (strike the only target in round 2, which breaks Sap).
    withGate('sapHold', false, () => {
      const a = R.autoAction(s);
      assert.deepEqual(a, { type: 'CAST', spellId: 'shadowstep_strike', target: 0 });
      const t = R.step(s, a).state;
      assert.equal(st(t.fight.enemies[0].st, 'SAPPED'), null, 'Sap broke');
    });
  });

  test('a PASS keeps STEALTH only while every living enemy is SAPPED (else, and with GATES.passStealth off, it removes STEALTH as before)', () => {
    const lone = R.step(rogue(), sap(0)).state;
    assert.ok(stealthed(R.step(lone, PASS).state));
    withGate('passStealth', false, () => assert.equal(stealthed(R.step(lone, PASS).state), false));
    // The add is awake: the PASS removes STEALTH.
    const pair = R.step(rogue([mob('z1_caster', 5)]), sap(1)).state;
    assert.equal(stealthed(R.step(pair, PASS).state), false);
    // A PASS in the engage round (nothing sapped) removes it too.
    assert.equal(stealthed(R.step(rogue(), PASS).state), false);
  });
});

describe('views for the UI (M2b v14 "UI needs" 1-2; engine-api.md 6.2)', () => {
  test('autoplayEngage: `wait` when rule H will apply after the Sap (a lone special enemy); not with an add, for a Disrupt or Binding Glyph, or with GATES.sapHold off', () => {
    const h = R.autoplayEngage(rogue());
    assert.deepEqual([h.option, h.name, h.wait, h.windup.deathblow], ['sap', 'Sap', true, true]);
    assert.equal('wait' in R.autoplayEngage(rogue([mob('z1_caster', 5)])), false);
    assert.equal('wait' in R.autoplayEngage(fight('mage', 20, [], [elite(1)], { prep: tough })), false);
    assert.equal('wait' in R.autoplayEngage(fight('rogue', 20, [], [mob('z1_dboss', 20, 'dboss')], { kind: 'dboss', prep: tough })), false, 'Disrupt');
    withGate('sapHold', false, () => assert.equal('wait' in R.autoplayEngage(rogue()), false));
  });

  test('windupView: Sap on a lone special enemy is sure if you wait (`wait`, `stealth`); in round 2 the PASS is an answer (via pass, how wait, sure, now) and the Deathblow is ready; not with an add awake', () => {
    const s = rogue();
    const a = R.windupView(s)[0].answers.find((x) => x.id === 'sap');
    assert.deepEqual([a.via, a.sure, a.breaks, a.wait, a.stealth], ['engage', false, true, true, true]);
    const a2 = R.windupView(rogue([mob('z1_caster', 5)])).find((x) => x.u === 1).answers.find((x) => x.id === 'sap');
    assert.equal('wait' in a2, false, 'the add is awake');
    const t = R.step(s, sap(0)).state;
    const w = R.windupView(t)[0];
    assert.deepEqual(w.answers.map((x) => [x.via, x.id, x.how, x.sure, x.now, x.stealth]), [['pass', 'pass', 'wait', true, true, true]]);
    assert.equal(w.ready, true);
    withGate('passStealth', false, () => assert.equal(R.windupView(t)[0].answers[0].stealth, false));
    // Round 3: the Deathblow is cancelled; no PASS answer.
    const u = R.step(t, PASS).state;
    assert.equal(R.windupView(u).some((x) => x.answers.some((y) => y.via === 'pass')), false);
    // An add awake in round 2: no PASS answer for the sapped elite.
    const p = R.step(rogue([mob('z1_caster', 5)]), sap(1)).state;
    assert.equal(R.windupView(p).some((x) => x.answers.some((y) => y.via === 'pass')), false);
  });
});

describe('rules 1.9.5 a hidden elite\'s Deathblow type on the map, rules 12.4 the content invariant (M2b v14 row 2, D112)', () => {
  test('expedition: every elite node shows `deathblow: { type }` only, the type of its own Deathblow (rare or not); no name', () => {
    let seen = 0;
    for (let seed = 1; seed <= 8; seed++) {
      // Every node seen (a test tweak), so each elite node is fully visible.
      const s = tweak(R.step(R.newRun({ classId: 'mage', seed, content: REAL, mapMode: 'expedition' }), { type: 'START_RUN' }).state, (x) => { x.zone.seen = x.zone.seen.map(() => true); });
      for (const n of R.mapView(s).nodes) {
        if (n.know !== 'full' || n.type !== 'elite') continue;
        const z = s.zone.nodes[n.id];
        assert.deepEqual(n.deathblow, { type: deathblowOf(REAL, z.elite, z.rare ? 'rare' : 'elite').type }, JSON.stringify(n));
        assert.equal(n.name, null);
        seen++;
      }
    }
    assert.ok(seen >= 8, `checked ${seen}`);
  });

  test('classic map: a rare without Scout\'s Eye shows its Deathblow type only; a named elite keeps the full object', () => {
    let hidden = 0;
    let named = 0;
    for (let seed = 1; seed <= 40 && (hidden < 1 || named < 1); seed++) {
      let s = R.step(R.newRun({ classId: 'mage', seed, content: REAL }), { type: 'START_RUN' }).state;
      for (let z = 0; z < 3 && s.zone; z++) {
        const v = R.mapView(s);
        if (!v) break;
        v.rows.flat().forEach((n, i) => {
          if (n.type !== 'elite') return;
          const node = s.zone.rows.flat()[i];
          const d = deathblowOf(REAL, node.elite, node.rare ? 'rare' : 'elite');
          if (n.name === null) { assert.deepEqual(n.deathblow, { type: d.type }); hidden++; } else { assert.deepEqual(n.deathblow, d); named++; }
        });
        break;
      }
    }
    assert.ok(hidden >= 1 && named >= 1, `hidden ${hidden}, named ${named}`);
  });

  test('the strict validator fails a zone whose elite pool lacks a heavy or a cast Deathblow; real content keeps both in every zone', () => {
    assert.deepEqual(R.validateContent(REAL, { strict: true }), []);
    for (const z of REAL.zones) {
      const types = new Set(z.elites.map((id) => deathblowOf(REAL, id, 'elite').type));
      assert.deepEqual([...types].sort(), ['cast', 'heavy'], z.id);
    }
    const bad = JSON.parse(JSON.stringify(REAL));
    bad.zones[0].elites = bad.zones[0].elites.filter((id) => deathblowOf(REAL, id, 'elite').type === 'heavy');
    bad.zones[1].elites = bad.zones[1].elites.filter((id) => deathblowOf(REAL, id, 'elite').type === 'cast');
    const errs = R.validateContent(bad, { strict: true }).join('\n');
    assert.match(errs, /zones\[0\]\.elites: Deathblow types heavy, expected at least one heavy and one cast/);
    assert.match(errs, /zones\[1\]\.elites: Deathblow types cast, expected at least one heavy and one cast/);
    assert.equal(R.validateContent(bad).some((x) => /Deathblow/.test(x)), false, 'structural mode: not checked');
    assert.ok(R.validateContent(MIN, { strict: true }).some((x) => /zones\[1\]\.elites: Deathblow types cast/.test(x)), 'the one-elite fixture fails it in strict mode only');
  });
});

describe('rules 2.3, 7.12 the v13 switches on by default (M2b v14 row 4, D113)', () => {
  test('a zone-1 rare has RARE_HP_MULT_Z1 and a first meeting in a quest fight plays its turn-2 wind-up without arming anything', () => {
    assert.deepEqual([C.GATES.rareHpMultZ1, C.GATES.firstMeetWindup], [true, true]);
    const s = fight('mage', 20, [], [mob('z1_rare', 20, 'rare')], { kind: 'elite' });
    const off = withGate('rareHpMultZ1', false, () => fight('mage', 20, [], [mob('z1_rare', 20, 'rare')], { kind: 'elite' }));
    assert.ok(Math.abs(s.fight.enemies[0].maxHp / off.fight.enemies[0].maxHp - C.RARE_HP_MULT_Z1 / C.RARE_HP_MULT) < 0.01);
    const q = fight('mage', 20, [], [mob('z1_brute')], { kind: 'quest' });
    assert.deepEqual([q.fight.enemies[0].firstMeet, q.fight.enemies[0].track.find((x) => x.turn === 2).windup], [true, true]);
  });
});

describe('full autoplay Rogue runs (M2b v14)', () => {
  test('every rule-H wait is followed by Sap cancelling the Deathblow at its turn (STAGGERED), STEALTH kept; the runs end (classic, real content)', () => {
    const tally = { waits: 0, sapAnswered: 0, landedAfterWait: 0 };
    for (const seed of [11, 23, 35, 47]) {
      let s = R.step(R.newRun({ classId: 'rogue', seed, content: REAL }), { type: 'START_RUN' }).state;
      for (let n = 0; s.phase !== 'ENDED' && n < 20000; n++) {
        const a = R.autoAction(s);
        const wait = a.type === 'PASS' && !!s.fight && !s.fight.p.skip && s.fight.enemies.filter((e) => e.alive).every((e) => st(e.st, 'SAPPED'));
        const hidden = !!s.fight && stealthed(s);
        const r = R.step(s, a);
        if (wait) {
          tally.waits++;
          assert.ok(r.events.some((x) => x.t === 'stagger' && x.by === 'SAPPED' && x.deathblow), `seed ${seed} step ${n}: Sap answered the Deathblow`);
          if (hidden && r.state.fight) assert.ok(stealthed(r.state), 'the wait kept STEALTH');
          if (r.events.some((x) => x.t === 'empower' && x.deathblow)) tally.landedAfterWait++;
        }
        for (const x of r.events) if (x.t === 'stagger' && x.by === 'SAPPED' && x.deathblow) tally.sapAnswered++;
        s = r.state;
      }
      assert.equal(s.phase, 'ENDED', `seed ${seed}`);
    }
    assert.ok(tally.waits > 0 && tally.sapAnswered >= tally.waits && tally.landedAfterWait === 0, JSON.stringify(tally));
  });
});
