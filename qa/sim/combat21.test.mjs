// Combat v2.1 simulator parts (combat-v2.md 11 "opener, combat v2.1", 11 "Recorder", 12 B50/B52/B55; D58, D59, D60):
// the C2 keys of the v2.1 constant table; the opener's root-diverse beam and final selection (D59) on synthetic nodes;
// its stun/control candidates on a CC-immune enemy's cast; the recorder's wind-up fields (answered, landed, killing,
// Disrupts) on synthetic events; the B50 gap, B52 per 100 fights and B55 checks on synthetic records.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { R, C, newRunFor } from '../../sim/lib/engine.mjs';
import { C2, SIM } from '../../sim/lib/params.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { beamSelect, finalSelect, openerCandidates } from '../../sim/bots/opener.mjs';
import { Recorder, FIGHT_KINDS } from '../../sim/lib/recorder.mjs';
import { combatChecks, windupStats, windupWhy, replayStats, windowStats } from '../../sim/lib/combatchecks.mjs';

const FK = Object.fromEntries(FIGHT_KINDS.map((k, i) => [k, i]));

describe('C2 combat v2.1 keys (combat-v2.md 15)', () => {
  test('the v2.1 keys are in the spec table with the C2 values; the replaced B52 keys are gone', () => {
    const md = readFileSync(new URL('../../docs/specs/combat-v2.md', import.meta.url), 'utf8');
    const sec = md.slice(md.indexOf('## 15. Constant table'));
    const spec = {};
    for (const line of sec.split('\n')) {
      const m = line.match(/^\| ([A-Z0-9_ /]+) \| ([^|]+) \|/);
      if (m) for (const n of m[1].split('/').map((x) => x.trim())) spec[n] = Number(m[2].trim().split('/')[0]);
    }
    for (const k of ['OPENER_ROOT_KEEP', 'OPEN_DECIDES_GAP_MIN', 'WINDOW_PER100_MIN', 'WINDOW_GAP100_MIN', 'WINDUP_ANSWER_MIN', 'WINDUP_ANSWER_MASH_MAX']) {
      assert.ok(k in spec, `${k} not in the spec table`);
      assert.equal(C2[k], spec[k], k);
    }
    assert.ok(!('WINDOW_USE_MIN' in C2) && !('WINDOW_GAP_MIN' in C2));
    assert.equal(SIM.OPENER_ROOT_DIVERSE, 1, 'reports use the D59 opener');
  });
});

describe('opener D59: root-diverse beam and final selection (synthetic nodes)', () => {
  const act = (id) => ({ type: 'CAST', spellId: id, target: 0 });
  const node = (root, score, race = score) => ({ seq: [act(root), act('x')], score, race });

  test('beamSelect: the width best by score, then the best node of every other first action', () => {
    const next = [node('a', 9), node('a', 8), node('b', 7), node('a', 6), node('c', 1), node('d', 3), node('c', 2), node('b', 5)];
    const v2 = beamSelect(next.slice(), 3, 0);
    assert.deepEqual(v2.map((x) => [x.seq[0].spellId, x.score]), [['a', 9], ['a', 8], ['b', 7]]);
    const d = beamSelect(next.slice(), 3, 1);
    assert.deepEqual(d.map((x) => [x.seq[0].spellId, x.score]), [['a', 9], ['a', 8], ['b', 7], ['d', 3], ['c', 2]]);
    // Every first action appears with its best node.
    const best = {};
    for (const x of next) best[x.seq[0].spellId] = Math.max(best[x.seq[0].spellId] ?? -Infinity, x.score);
    for (const [r, v] of Object.entries(best)) assert.ok(d.some((x) => x.seq[0].spellId === r && x.score === v), r);
  });

  test('finalSelect: OPENER_FINAL_KEEP best by race, then other first actions up to rootKeep', () => {
    const beam = [node('a', 0, 5), node('a', 0, 9), node('b', 0, 1), node('c', 0, 7), node('d', 0, 3), node('e', 0, 2), node('f', 0, 4), node('g', 0, 0)];
    assert.deepEqual(finalSelect(beam.slice(), 1, 6, 0).map((x) => x.race), [9]);
    const k = finalSelect(beam.slice(), 1, 6, 1);
    assert.deepEqual(k.map((x) => [x.seq[0].spellId, x.race]), [['a', 9], ['c', 7], ['f', 4], ['d', 3], ['e', 2], ['b', 1]]);
    assert.equal(new Set(k.map((x) => x.seq[0].spellId)).size, k.length, 'one sequence per first action');
    assert.equal(finalSelect(beam.slice(), 1, C2.OPENER_ROOT_KEEP, 1).length, C2.OPENER_ROOT_KEEP);
  });
});

describe('opener D59: stun and control candidates on a CC-immune enemy whose now-entry is a cast', () => {
  /** First state (a run of the planner, seeds from `seed`) with a CC-immune enemy casting and a legal stun/control. */
  function immuneCastState(cls, seed) {
    for (let sd = seed; sd < seed + 30; sd++) {
      const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed: sd, profile: buildProfile('fresh', cls) });
      const bot = createBot('planner', { classId: cls, seed: sd, tree: 0 });
      for (let n = 0; n < 6000 && s.phase !== 'ENDED'; n++) {
        if (s.fight && s.fight.kind !== 'boss' && !s.fight.p.skip) {
          for (const e of s.fight.enemies) {
            const it = e.alive && e.ccImmune ? e.intent : null;
            if (!it || !it.cast || it.interrupted || it.cancelled) continue;
            const sp = s.player.bar.find((id) => id && C.SPELL[id].target === 'enemy' && !C.SPELL[id].tags.includes('finisher') && (C.SPELL[id].tags.includes('stun') || C.SPELL[id].tags.includes('control')) && R.isLegal(s, { type: 'CAST', spellId: id, target: e.idx }));
            if (sp) return { s, sp, u: e.idx };
          }
        }
        R.stepInPlace(s, bot.choose(s));
      }
    }
    return null;
  }

  test('a no-damage stun on a casting dungeon boss is a candidate with D59 and was not without it', () => {
    const x = immuneCastState('hunter', 8);
    assert.ok(x, 'no state found');
    const has = (cands) => cands.some((a) => a.type === 'CAST' && a.spellId === x.sp && a.target === x.u);
    assert.ok(has(openerCandidates(x.s)), `${x.sp} on enemy ${x.u} missing`);
    SIM.OPENER_ROOT_DIVERSE = 0;
    try { assert.ok(!has(openerCandidates(x.s)), 'the combat v2 rule never offered it'); } finally { SIM.OPENER_ROOT_DIVERSE = 1; }
    assert.ok(openerCandidates(x.s).every((a) => R.isLegal(x.s, a)));
  });
});

describe('recorder wind-up fields (synthetic events; combat v2.1)', () => {
  function fightState(cls, seed) {
    const s = newRunFor({ classId: cls, petId: null, seed, profile: buildProfile('fresh', cls) });
    const bot = createBot('planner', { classId: cls, seed, tree: 0 });
    for (let n = 0; n < 4000 && s.phase !== 'ENDED'; n++) {
      if (s.fight && s.fight.kind !== 'boss' && !s.fight.p.skip && s.fight.round === 1) return R.deserialize(R.serialize(s), s.content);
      R.stepInPlace(s, bot.choose(s));
    }
    throw new Error('no fight');
  }
  const fightEv = (s, kind) => ({ t: 'fight', kind, k: 0, enemies: s.fight.enemies.map((e) => ({ u: e.idx, name: e.name, level: e.level, hp: e.hp, kind: e.kind })) });
  const bOf = (s) => ({ hp: s.player.hp, maxHp: s.player.d.maxHp, level: s.player.level, rounds: 0 });

  test('answered, landed, Disrupts and the why table of a won fight', () => {
    const s = fightState('rogue', 51);
    const rec = new Recorder({ trainCheck: false });
    rec.after(s, null, [fightEv(s, 'elite')], bOf(s));
    rec.before(s, null);
    rec.after(s, null, [{ t: 'action', kind: 'engage', option: 'sap', target: 0, disrupt: true }, { t: 'round', n: 2 }], bOf(s));
    rec.after(s, null, [{ t: 'stagger', u: 0, id: 'w', turn: 2, why: 'disrupt', by: 'sap', stacks: 1, value: 0.3 }, { t: 'empower', u: 0, id: 'w2', turn: 4, stacks: 1, value: 0.15 }], bOf(s));
    rec.after(s, null, [{ t: 'stagger', u: 0, id: 'w3', turn: 2, why: 'interrupt', by: 'throat_jab', stacks: 2, value: 0.6 }, { t: 'victory', kind: 'elite', rounds: 6 }], bOf(s));
    assert.deepEqual(rec.f2[0].slice(10), [2, 1, 0, 1]);
    assert.deepEqual(rec.wy, { 'elite|disrupt': 1, 'elite|interrupt': 1 });
  });

  test('a wind-up whose hit kills the player counts as killing (no empower event, D60); another killer does not', () => {
    for (const [ability, want] of [['sig_windup', 1], ['basic_strike', 0]]) {
      const s = fightState('mage', 52);
      const rec = new Recorder({ trainCheck: false });
      rec.after(s, null, [fightEv(s, 'dboss')], bOf(s));
      const e0 = s.fight.enemies[0];
      e0.intent = { ...(e0.intent || {}), id: 'sig_windup', name: 'Wind-up', kind: 'hit', windup: true, cast: true };
      rec.before(s, null);
      s.death = { killer: { idx: 0, name: e0.name, ability } };
      rec.after(s, null, [{ t: 'enemyAction', u: 0, id: ability, name: 'x' }, { t: 'damage', src: 0, dst: 'player', amount: 999, hpLost: 999 }, { t: 'death', u: 'player' }, { t: 'runEnd', outcome: 'death' }], bOf(s));
      assert.equal(rec.fx[0][2], 0);
      assert.deepEqual(rec.f2[0].slice(10), [0, 0, want, 0], ability);
    }
  });
});

describe('B50 gap, B52 per 100 fights, B55 (synthetic records)', () => {
  // f2: [n0, engage, arch, firstOb, opened, used, signal, hpOpen, firstDiff, firstArch, answered, landed, kill, disrupts]
  const f2 = (used, a = 0, l = 0, k = 0, d = 0, n0 = 1, engage = '') => [n0, engage, '', 0, used, used, 0, 900, -1, '', a, l, k, d];
  const rec = (seed, fights, extra = {}) => ({ out: 'd', cls: 'hunter', seed, rb: 0, fx: fights.map((x) => x[0]), f2: fights.map((x) => x[1]), wy: {}, ...extra });

  test('windupStats counts elite and dungeon-boss fights only; killing wind-ups are landed', () => {
    const rs = [rec(1, [[[FK.elite, 7, 1], f2(0, 1, 1)], [[FK.quest, 5, 1], f2(0, 5, 0)], [[FK.dboss, 9, 0], f2(0, 1, 0, 1, 1)]])];
    const w = windupStats(rs);
    assert.deepEqual([w.fights, w.answered, w.landed, w.kill, w.disrupts], [2, 2, 1, 1, 1]);
    assert.equal(w.share.p, 0.5);
    const old = windupStats([rec(2, [[[FK.elite, 7, 1], [1, '', '', 0, 0, 0, 0, 900, -1, '']]])]);
    assert.equal(old.share.n, 0, 'records before combat v2.1 have no wind-up fields');
    assert.deepEqual(windupWhy([{ out: 'd', wy: { 'elite|interrupt': 2, 'quest|trap': 1, 'dboss|disrupt': 3 } }]), { interrupt: 2, disrupt: 3 });
  });

  test('replayStats gap is paired on the same deaths; windowStats per 100 non-boss fights', () => {
    const rep = [[0, FK.elite, 1, 0, 0], [1, FK.dboss, 1, 1, 0], [2, FK.dboss, 0, 1, 0], [3, FK.elite, 1, 0, 0]];
    const x = replayStats([{ out: 'd', rep }]);
    assert.equal(x.n, 4);
    assert.equal(x.opener.p, 0.75);
    assert.equal(x.auto.p, 0.5);
    assert.equal(x.gap.v, 0.25);
    assert.ok(x.gap.ci[0] < 0.25 && x.gap.ci[1] > 0.25);
    const w = windowStats([rec(1, [[[FK.quest, 5, 1], f2(1)], [[FK.grind, 5, 1], f2(0)], [[FK.boss, 40, 0], f2(9)], [[FK.elite, 7, 1], f2(2)]])]);
    assert.equal(w.fights, 3, 'the end boss is not a non-boss fight');
    assert.equal(w.per100.v, 100);
  });

  test('combatChecks: B50 gap, B52 and B55 rows pass and fail on their targets', () => {
    const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
    const opener = many(10, (i) => rec(i, [[[FK.elite, 7, 1], f2(1, 3, 1, 0, 0, 2, 'strike:opening_shot')], [[FK.quest, 5, 1], f2(0)]]));
    const masherRep = many(20, (i) => [0, FK.dboss, i < 14 ? 1 : 0, i < 10 ? 1 : 0, 0]);
    const masher = many(10, (i) => rec(i, [[[FK.elite, 7, 1], f2(0, 0, 4)], [[FK.quest, 5, 1], f2(0)]], i === 0 ? { rep: masherRep } : {}));
    const rows = combatChecks({ opener, masher });
    const get = (id, k = 0) => rows.filter((r) => r.id === id)[k];
    assert.equal(get('B50').ok, true, '70 % survive');
    assert.equal(get('B50', 1).ok, true, 'gap +20 pp');
    assert.equal(get('B52').ok, true, 'opener 50 per 100 fights, masher 0');
    assert.equal(get('B55').ok, true, 'opener 75 %, masher 0 %');
    const masher2 = many(10, (i) => rec(i, [[[FK.elite, 7, 1], f2(0, 1, 3)]], i === 0 ? { rep: masherRep.map((r) => [r[0], r[1], r[2], r[2], 0]) } : {}));
    const rows2 = combatChecks({ opener, masher: masher2 });
    assert.equal(rows2.filter((r) => r.id === 'B50')[1].ok, false, 'no gap');
    assert.equal(rows2.find((r) => r.id === 'B55').ok, false, 'masher answers 25 %');
  });
});
