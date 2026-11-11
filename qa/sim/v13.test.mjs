// M2b v13 sim rows (docs/specs/changes-m2b-v13.md "What the sim must run"; report docs/reports/balance-2026-11-12.md):
// the recorder's Deathblow and MAIMED fields (f2 14-18), deathblowMetrics, the C.GATES switches of a cell (rows 5-6), the
// speedrunner's level price (SIM.SPEED_LEVEL_TOLLS) and the planner's Dimmed clock (SIM.PLANNER_DIM_CLOCK).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, newRunFor } from '../../sim/lib/engine.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { Recorder, FIGHT_KINDS } from '../../sim/lib/recorder.mjs';
import { deathblowMetrics, specialGroup } from '../../sim/lib/metrics.mjs';
import { setGates, playRun } from '../../sim/lib/runner.mjs';
import { SIM } from '../../sim/lib/params.mjs';
import { cellName } from '../../sim/lib/output.mjs';

const FK = Object.fromEntries(FIGHT_KINDS.map((k, i) => [k, i]));

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

describe('recorder: Deathblow and MAIMED fields (f2 14-18)', () => {
  test('answered and landed Deathblows, MAIMED and heals while MAIMED of a won fight', () => {
    const s = fightState('rogue', 51);
    const rec = new Recorder({ trainCheck: false });
    rec.after(s, null, [fightEv(s, 'elite')], bOf(s));
    rec.after(s, null, [{ t: 'stagger', u: 0, id: 'w', turn: 2, why: 'interrupt', by: 'x', stacks: 1, value: 0.3, deathblow: true }], bOf(s));
    rec.after(s, null, [{ t: 'empower', u: 0, id: 'w', turn: 2, stacks: 1, value: 1, deathblow: true, maimed: true }, { t: 'heal', dst: 'player', amount: 10, spell: 'x', maimed: true }], bOf(s));
    rec.after(s, null, [{ t: 'empower', u: 0, id: 'w2', turn: 4, stacks: 2, value: 1.15 }, { t: 'heal', dst: 'player', amount: 5, spell: 'y', maimed: true }, { t: 'heal', dst: 'player', amount: 5, spell: 'z' }], bOf(s));
    rec.after(s, null, [{ t: 'victory', kind: 'elite', rounds: 6 }], bOf(s));
    assert.deepEqual(rec.f2[0].slice(10, 14), [1, 2, 0, 0]);
    assert.deepEqual(rec.f2[0].slice(14), [1, 1, 0, 1, 2]);
  });

  test('a Deathblow whose hit kills the player counts as a killing Deathblow; an ordinary wind-up does not', () => {
    for (const [db, want] of [[true, 1], [false, 0]]) {
      const s = fightState('mage', 52);
      const rec = new Recorder({ trainCheck: false });
      rec.after(s, null, [fightEv(s, 'elite')], bOf(s));
      const e0 = s.fight.enemies[0];
      e0.intent = { ...(e0.intent || {}), id: 'sig_windup', name: 'Wind-up', kind: 'hit', windup: true, cast: false, ...(db ? { deathblow: true } : {}) };
      rec.before(s, null);
      s.death = { killer: { idx: 0, name: e0.name, ability: 'sig_windup' } };
      rec.after(s, null, [{ t: 'enemyAction', u: 0, id: 'sig_windup', name: 'x' }, { t: 'damage', src: 0, dst: 'player', amount: 999, hpLost: 999 }, { t: 'death', u: 'player' }, { t: 'runEnd', outcome: 'death' }], bOf(s));
      assert.equal(rec.f2[0][12], 1, 'a killing wind-up');
      assert.equal(rec.f2[0][16], want, `deathblow ${db}`);
    }
  });
});

describe('deathblowMetrics', () => {
  const v = (a, l, k, m, h) => [1, '', '', 0, 0, 0, 0, 900, -1, '', a + 0, l, k, 0, a, l, k, m, h];
  test('groups (rare from fc), zone 1, rates and heals per MAIMED fight; old records count fights only', () => {
    const r = {
      fx: [[FK.elite, 7, 1, 50, 1, 300, 1], [FK.elite, 9, 0, 0, 2, 0, 2], [FK.dboss, 9, 1, 40, 2, 200, 0], [FK.quest, 5, 1, 80, 1, 700, 0]],
      fc: [[100, 3, 'a:e'], [90, 9, 'b:r'], [80, 12, 'c:d'], [100, 1, 'x:n']],
      f2: [v(1, 0, 0, 0, 0), v(0, 1, 0, 1, 3), v(0, 1, 0, 1, 1), v(0, 0, 0, 0, 0)],
    };
    assert.deepEqual([0, 1, 2, 3].map((i) => specialGroup(r, i)), ['elite', 'rare', 'dboss', null]);
    const m = deathblowMetrics([r]);
    assert.equal(m.elite.n, 1); assert.equal(m.elite.dbAnswered, 1); assert.equal(m.elite.maimed.p, 0); assert.equal(m.elite.healsMaimed, null);
    assert.equal(m.rare.deaths.p, 1); assert.equal(m.rare.dbLanded, 1); assert.equal(m.rare.healsMaimed, 3); assert.equal(m.rare.potions, 2);
    assert.equal(m.dboss.maimed.p, 1);
    assert.equal(m.z1.n, 1);
    const old = deathblowMetrics([{ ...r, f2: r.f2.map((x) => x.slice(0, 14)) }]);
    assert.equal(old.rare.n, 1); assert.equal(old.rare.dbLanded, 0);
  });
});

describe('C.GATES of a cell (rows 5-6) and the cell name', () => {
  test('setGates arms the named switches and turns every other off; unknown gates throw', () => {
    setGates({ rareHpMultZ1: true });
    assert.deepEqual(C.GATES, { rareHpMultZ1: true, firstMeetWindup: false });
    setGates({ firstMeetWindup: true });
    assert.deepEqual(C.GATES, { rareHpMultZ1: false, firstMeetWindup: true });
    setGates(null);
    assert.deepEqual(C.GATES, { rareHpMultZ1: false, firstMeetWindup: false });
    assert.throws(() => setGates({ nope: true }));
    setGates(null);
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', gates: { rareHpMultZ1: true, firstMeetWindup: true } }), 'planner-P0-g5-g6');
  });

  test('a run of a gated cell leaves the gates as its cell set them; the next cell resets them', () => {
    const cell = { bot: 'planner', cls: 'rogue', prof: 'fresh', tree: 2, gates: { firstMeetWindup: true } };
    const a = playRun(cell, 1001, null);
    assert.equal(C.GATES.firstMeetWindup, true);
    playRun({ ...cell, gates: null }, 1001, null);
    assert.equal(C.GATES.firstMeetWindup, false);
    assert.ok(a.fx.length > 0);
  });
});

describe('speedrunner level price and planner Dimmed clock (params)', () => {
  test('defaults: SPEED_LEVEL_TOLLS null (balance.md 1 rate; the calibration found no price that reaches the v11 policy, balance-2026-11-12); PLANNER_DIM_CLOCK is 1', () => {
    assert.equal(SIM.SPEED_LEVEL_TOLLS, null);
    assert.equal(SIM.PLANNER_DIM_CLOCK, 1);
  });
});
