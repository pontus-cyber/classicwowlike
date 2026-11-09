// QA rule tests, rules.md section 10 (end boss): damage scales with Ascendancy, and the telegraph counters
// of 10.3 (Brand, Litany, Shards, Pulse, enrage, Crush) predict what the boss really does.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, tweak, st, play, cloneState, forceDraws, ev } from './helpers.mjs';

function boss(classId = 'mage', { hours = 100, prep } = {}) {
  let s = R.step(started(classId, { seed: 52 }), { type: 'LEAVE_HUB' }).state;
  s = withSpells(atLevel(s, 60), []);
  s = tweak(s, (x) => { x.zone.z = 6; x.hours = hours; });
  s = play(s, [{ type: 'TRAVEL_ON' }, { type: 'FIGHT_BOSS' }]).state;
  return prep ? tweak(s, prep) : s;
}
const immortal = (x) => { x.player.d.maxHp = 1e9; x.player.hp = 1e9; x.fight.p.st = x.fight.p.st.filter((y) => y.id === 'BRAND'); };
const ids = (s) => s.fight.enemies[0].intent.actions.map((a) => (a.id === 'collapse_litany' ? `litany${a.step}` : a.id));

describe('rules 10 end boss (QA additions)', () => {
  test('10.1 all boss damage × (1 + asc): the same Litany hit is 1.2 × as large at Ascendancy 0.20', () => {
    const run = (hours) => {
      let s = boss('mage', { hours, prep: immortal });
      s = tweak(R.step(R.step(s, { type: 'PASS' }).state, { type: 'PASS' }).state, immortal);
      s = tweak(R.step(s, { type: 'PASS' }).state, immortal); // Litany 2/2 resolves next
      const c = cloneState(s);
      forceDraws(c, 3, (d) => d[0] > 0.9 && d[1] > 0.5 && Math.abs(d[2] - 0.5) < 0.01);
      return R.step(c, { type: 'PASS' }).events.find((e) => e.t === 'damage' && e.spell === 'collapse_litany').amount;
    };
    const a = run(100);
    const b = run(C.BOSS_TIME_PAR + 50); // 50 h over par (+ HOURS_TRAVEL): 5 steps of 0.04
    assert.ok(Math.abs(b / a - 1.2) < 0.005, `${a} -> ${b}`);
  });

  /** 44 rounds with the boss taken into phase 2 at round 12 and phase 3 at round 30; per round: intent, telegraph, what happened. */
  function schedule() {
    let s = boss('mage', { prep: immortal });
    const rows = [];
    for (let r = 0; r < 44; r++) {
      const it = s.fight.enemies[0].intent;
      const brand0 = (st(s.fight.p.st, 'BRAND') || { stacks: 0 }).stacks;
      let action = { type: 'PASS' };
      if (r === 11 || r === 29) {
        s = tweak(s, (x) => { const b = x.fight.enemies[0]; b.hp = Math.floor(b.maxHp * (r === 11 ? C.P2_AT : C.P3_AT)) + 1; });
        forceDraws(s, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
        action = { type: 'ATTACK', target: 0 };
      }
      const step = R.step(s, action);
      rows.push({ round: s.fight.round, ids: ids(s), tg: it.telegraph, brandUp: (st(step.state.fight.p.st, 'BRAND') || { stacks: 0 }).stacks > brand0, summons: ev(step.events, 'summon').length });
      s = tweak(step.state, (x) => { immortal(x); for (const e of x.fight.enemies) if (e.kind === 'shard') e.st = [{ id: 'STUN', dur: 2 }]; });
    }
    const at = (round) => rows.find((x) => x.round === round);
    const firstFrom = (round, pred) => { for (const x of rows) if (x.round >= round && pred(x)) return x.round; return null; };
    return { rows, at, firstFrom };
  }

  test('10.3 telegraph counters predict the boss schedule: Brand, Litany, Crush, enrage, first Shards wave, Pulse', () => {
    const { rows, at, firstFrom } = schedule();
    let checked = 0;
    for (const x of rows) {
      const tg = x.tg;
      if (tg.brandInRounds != null) { const w = firstFrom(x.round, (y) => y.brandUp); if (w !== null) { assert.equal(w, x.round + tg.brandInRounds, `Brand counter at round ${x.round}`); checked++; } }
      if (tg.litanyInRounds != null) { const w = firstFrom(x.round, (y) => y.ids.includes('litany1')); if (w !== null) { assert.equal(w, x.round + tg.litanyInRounds, `Litany counter at round ${x.round}`); checked++; } }
      if (at(x.round + 1)) assert.equal(at(x.round + 1).ids.includes('gravity_crush'), !!tg.crushNextRound, `Crush in round ${x.round + 1} telegraphed in round ${x.round}`);
      // Shards summoned at the end of round w take part from round w + 1; first wave interval only (SHARD_MAX caps later waves).
      if (tg.shardsInRounds != null && x.round <= 19) { const w = firstFrom(x.round, (y) => y.summons > 0); assert.equal(w + 1, x.round + tg.shardsInRounds, `Shards counter at round ${x.round}`); checked++; }
      // A Pulse round reads 0 ("this round", BUG-QA-07); otherwise the gap to the next Pulse.
      if (tg.pulseInRounds != null) { const w = firstFrom(x.round, (y) => y.ids.includes('starless_pulse')); if (w !== null) { assert.equal(w, x.round + tg.pulseInRounds, `Pulse counter at round ${x.round}`); checked++; } }
      assert.equal(tg.enrageInRounds, C.BOSS_ENRAGE_ROUND - x.round, `enrage counter at round ${x.round}`);
    }
    assert.ok(rows.some((x) => x.tg.phase === 2) && rows.some((x) => x.tg.phase === 3), 'all three phases seen');
    assert.ok(checked > 60, `${checked} predictions checked`);
  });

  test('10.3 on a round with Starless Pulse in the intent, the Pulse counter reads "this round" (as Litany and Brand do) (BUG-QA-07)', () => {
    const { rows } = schedule();
    const pulses = rows.filter((x) => x.ids.includes('starless_pulse'));
    assert.ok(pulses.length >= 3, `${pulses.length} Pulse rounds seen`);
    for (const x of pulses) assert.equal(x.tg.pulseInRounds, 0, `round ${x.round}`);
  });

  test('10.3 the Shards counter only counts down to a wave that will come (SHARD_MAX alive stops a wave) (BUG-QA-07)', () => {
    const { rows, firstFrom } = schedule();
    const ones = rows.filter((x) => x.tg.shardsInRounds === 1);
    assert.ok(ones.length >= 1, 'a "next round" Shards counter was seen');
    for (const x of ones) assert.equal(firstFrom(x.round, (y) => y.summons > 0), x.round, `round ${x.round}`);
    // Rounds 20-29 of the schedule: SHARD_MAX Shards alive (stunned, never killed), so no countdown is shown.
    const full = rows.filter((x) => x.tg.phase === 2 && x.round >= 20);
    assert.ok(full.length >= 5);
    for (const x of full) assert.equal(x.tg.shardsInRounds, null, `round ${x.round}: ${C.SHARD_MAX} Shards alive`);
  });

  test('10.2 Gravity Crush is heavy and cannot be interrupted; the Litany is a cast', () => {
    let s = boss('mage', { prep: immortal });
    const seen = {};
    for (let r = 0; r < 14; r++) {
      for (const a of s.fight.enemies[0].intent.actions) seen[a.id] = a;
      s = tweak(R.step(s, { type: 'PASS' }).state, immortal);
    }
    assert.ok(seen.gravity_crush.heavy && !seen.gravity_crush.cast);
    assert.ok(seen.collapse_litany.cast);
  });
});
