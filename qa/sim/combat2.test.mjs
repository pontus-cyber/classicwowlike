// Combat v2 simulator parts (combat-v2.md 11-12): C2 equals the spec's constant table; the masher never reads
// intents; the opener plans only on a player-visible view (leak test: its choice does not change when the hidden
// streams change, and it never reads them); look-aheads and replays never change the live state; the fight replay
// harness reproduces a fight; the recorder's combat v2 fields.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { R, C, newRunFor, BotRng, makeRng } from '../../sim/lib/engine.mjs';
import { C2 } from '../../sim/lib/params.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { mashChoice } from '../../sim/bots/masher.mjs';
import { openerChoice, planOpening, openerCandidates } from '../../sim/bots/opener.mjs';
import { playerView, HIDDEN, trackOf } from '../../sim/lib/view.mjs';
import { replayFight, snapshot, OUTCOME } from '../../sim/lib/replay.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { Recorder } from '../../sim/lib/recorder.mjs';

const key = (a) => JSON.stringify(a, Object.keys(a).sort());

/** States at player decisions in fights of a planner run (cls, seed): every decision of fights with >= minEnemies. */
function fightStates(cls, seed, { minEnemies = 2, max = 6, rounds = [1, 2, 3] } = {}) {
  const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, profile: buildProfile('fresh', cls) });
  const bot = createBot('planner', { classId: cls, seed, tree: 0 });
  const out = [];
  for (let n = 0; n < 4000 && s.phase !== 'ENDED' && out.length < max; n++) {
    if (s.fight && s.fight.kind !== 'boss' && !s.fight.p.skip && rounds.includes(s.fight.round) && s.fight.enemies.filter((e) => e.alive).length >= minEnemies) {
      out.push(R.deserialize(R.serialize(s), s.content));
    }
    R.stepInPlace(s, bot.choose(s));
  }
  return out;
}

/** The state with other hidden streams (fight and loot), everything visible unchanged. */
function otherHidden(s, k) {
  const c = R.deserialize(R.serialize(s), s.content);
  c.fight.rng = makeRng(0x9e3779b9 ^ k);
  if (c.lootRng) c.lootRng = makeRng(0x7f4a7c15 ^ k);
  return c;
}

/** The state behind a proxy that throws when a hidden field is read. */
function guarded(s) {
  const fight = new Proxy(s.fight, { get(t, p) { if (HIDDEN.fight.includes(p)) throw new Error(`read hidden fight.${String(p)}`); return t[p]; } });
  return new Proxy(s, { get(t, p) { if (HIDDEN.state.includes(p)) throw new Error(`read hidden ${String(p)}`); return p === 'fight' ? fight : t[p]; } });
}

describe('C2 equals combat-v2.md section 15', () => {
  test('every C2 key in the spec table has the spec value', () => {
    const md = readFileSync(new URL('../../docs/specs/combat-v2.md', import.meta.url), 'utf8');
    const sec = md.slice(md.indexOf('## 15. Constant table'));
    const spec = {};
    for (const line of sec.split('\n')) {
      const m = line.match(/^\| ([A-Z0-9_ /]+) \| ([^|]+) \|/);
      if (!m) continue;
      const names = m[1].split('/').map((x) => x.trim());
      const vals = m[2].trim().split('/').map((x) => x.trim());
      names.forEach((n, i) => { spec[n] = vals[i] ?? vals[0]; });
    }
    let n = 0;
    for (const [k, v] of Object.entries(C2)) {
      if (!(k in spec)) continue;
      const range = spec[k].match(/^([\d.]+)-([\d.]+)$/);
      assert.deepEqual(v, range ? [Number(range[1]), Number(range[2])] : Number(spec[k]), k);
      n++;
    }
    assert.ok(n >= 20, `only ${n} C2 keys found in the spec table`);
  });
});

describe('masher (combat-v2.md 11)', () => {
  test('never reads intents: the same choice with the intents and tracks scrambled', () => {
    let checked = 0;
    for (const cls of ['rogue', 'mage', 'hunter']) {
      for (const s of fightStates(cls, 5, { minEnemies: 1, max: 8 })) {
        const a = mashChoice(s);
        assert.ok(R.isLegal(s, a), `${cls}: ${JSON.stringify(a)}`);
        const c = R.deserialize(R.serialize(s), s.content);
        for (const e of c.fight.enemies) {
          e.intent = { id: 'heavy_smash', name: 'Heavy Smash', kind: 'hit', cast: true, heavy: true, school: 'phys', cd: 3, pct: 3, hits: 1, target: 'player', est: 9999 };
          if (Array.isArray(e.track)) e.track = e.track.map((x) => ({ ...x, id: 'heavy_smash', heavy: true, cast: true, est: 9999 }));
        }
        assert.equal(key(mashChoice(c)), key(a), `${cls}: masher read an intent`);
        checked++;
      }
    }
    assert.ok(checked >= 12, `checked ${checked}`);
  });
});

describe('opener (combat-v2.md 11): plans only on a player-visible view', () => {
  test('the view replaces the hidden streams and copies everything else', () => {
    const [s] = fightStates('mage', 7, { max: 1 });
    const v = playerView(s, new BotRng(1));
    assert.notDeepEqual(v.fight.rng, s.fight.rng);
    assert.notDeepEqual(v.lootRng, s.lootRng);
    assert.deepEqual(v.fight.enemies, s.fight.enemies);
    assert.deepEqual(v.player, s.player);
    assert.equal(v.fight.round, s.fight.round);
  });

  test('leak test: the choice and the plan do not change with the hidden streams, and the bot never reads them', () => {
    let checked = 0;
    for (const [cls, seed] of [['rogue', 11], ['mage', 12], ['hunter', 13]]) {
      for (const s of fightStates(cls, seed, { max: 3 })) {
        const before = R.serialize(s);
        const run = (x) => { const st = { fights: -1, n0: 0, plan: null }; const a = openerChoice(x, new BotRng(99), st); return { a, seq: st.plan ? st.plan.seq : null }; };
        const base = run(s);
        assert.equal(R.serialize(s), before, 'the look-ahead changed the live state');
        assert.ok(R.isLegal(s, base.a), `${cls}: illegal ${JSON.stringify(base.a)}`);
        for (let k = 1; k <= 2; k++) {
          const o = run(otherHidden(s, k));
          assert.equal(key(o.a), key(base.a), `${cls}: the choice depends on the hidden streams`);
          assert.deepEqual(o.seq, base.seq, `${cls}: the plan depends on the hidden streams`);
        }
        const g = run(guarded(s));
        assert.equal(key(g.a), key(base.a));
        checked++;
      }
    }
    assert.ok(checked >= 6, `checked ${checked}`);
  });

  test('a plan has one action per round to OPEN_ROUNDS, legal now; candidates are legal and include the autoplay action', () => {
    for (const s of fightStates('rogue', 21, { max: 2, rounds: [1] })) {
      const cands = openerCandidates(s);
      assert.ok(cands.length >= 1 && cands.every((a) => R.isLegal(s, a)));
      assert.ok(cands.some((a) => key(a) === key(R.autoAction(s))) || cands.length === 1);
      const r = planOpening(s, new BotRng(3));
      assert.ok(r.seq.length >= 1 && r.seq.length <= C2.OPEN_ROUNDS);
      assert.ok(R.isLegal(s, r.seq[0]));
      for (const e of s.fight.enemies) assert.ok(trackOf(e).length <= Math.max(1, C2.OPEN_ROUNDS));
    }
  });

  test('a short opener run: every action legal, no errors', () => {
    const { record } = runWithBot({ bot: 'opener', cls: 'hunter', prof: 'fresh', tree: 1, style: null, variant: null, pet: null }, 31, null, { maxActions: 3000 });
    assert.ok(!record.err || record.err.startsWith('stuck'), record.err);
    assert.ok(record.bm && record.bm.plans > 0);
    assert.equal(record.f2.length, record.fx.length);
  });
});

describe('fight replay harness (B50)', () => {
  test('the masher replayed with the masher reproduces its fight; a replay never changes the snapshot', () => {
    let done = 0;
    for (const cls of ['rogue', 'hunter']) {
      for (const s of fightStates(cls, 41, { minEnemies: 1, max: 3, rounds: [1] })) {
        const snap = snapshot(s);
        const before = R.serialize(snap);
        // The live fight played by the masher to its end.
        const live = R.deserialize(R.serialize(s), s.content);
        let outcome = null;
        for (let n = 0; n < 400 && live.fight; n++) {
          for (const e of R.stepInPlace(live, mashChoice(live))) {
            if (e.t === 'victory') outcome = OUTCOME.victory;
            else if (e.t === 'fled') outcome = OUTCOME.fled;
            else if (e.t === 'runEnd' && e.outcome === 'death') outcome = OUTCOME.death;
          }
        }
        const r1 = replayFight(snap, mashChoice, mashChoice);
        const r2 = replayFight(snap, mashChoice, mashChoice);
        assert.equal(r1.outcome, outcome);
        assert.deepEqual(r1, r2);
        assert.equal(R.serialize(snap), before);
        assert.equal(live.player.hp / live.player.d.maxHp, r1.hp);
        done++;
      }
    }
    assert.ok(done >= 4);
  });

  test('masher cells with replay: every replayed death has the masher control dying again', () => {
    let reps = 0;
    for (const cls of ['rogue', 'hunter']) {
      for (let seed = 1000; seed < 1012 && reps < 3; seed++) {
        const { record } = runWithBot({ bot: 'masher', cls, prof: 'fresh', tree: 0, style: null, variant: null, pet: null, replay: true }, seed, null);
        assert.ok(!record.err, record.err);
        for (const r of record.rep || []) {
          assert.equal(r[4], OUTCOME.death, 'masher-then-masher must die again');
          assert.equal(record.fx[r[0]][2], 0, 'the replayed fight is a death in fx');
          reps++;
        }
      }
    }
    assert.ok(reps >= 1, 'no masher death in the seeds tried');
  });
});

describe('recorder combat v2 fields (synthetic events)', () => {
  test('windows opened and used, first OFF_BALANCE round, Signal, HP at the end of round OPEN_ROUNDS', () => {
    const s = fightStates('rogue', 51, { max: 1, rounds: [1] })[0];
    const rec = new Recorder({ trainCheck: false });
    const p = s.player;
    const b = { hp: p.hp, maxHp: p.d.maxHp, level: p.level, rounds: 0 };
    const fightEv = { t: 'fight', kind: 'quest', k: 0, enemies: s.fight.enemies.map((e) => ({ u: e.idx, name: e.name, level: e.level, hp: e.hp, kind: e.kind })) };
    rec.after(s, null, [fightEv], b);
    const atk = { type: 'CAST', spellId: 'gutting_jab', target: 0 };
    rec.before(s, atk);
    rec.after(s, atk, [{ t: 'round', n: 2 }, { t: 'status', u: 0, id: 'OFF_BALANCE', on: true, dur: 2 }], b);
    rec.before(s, atk);
    rec.after(s, atk, [{ t: 'damage', src: 'player', dst: 0, amount: 10, hpLost: 10 }, { t: 'status', u: 0, id: 'OFF_BALANCE', on: false }, { t: 'round', n: 3 }], b);
    rec.before(s, { type: 'ATTACK', target: 0 });
    rec.after(s, { type: 'ATTACK', target: 0 }, [{ t: 'status', u: 0, id: 'OFF_BALANCE', on: true, dur: 2 }, { t: 'damage', src: 'player', dst: 0, amount: 5, hpLost: 5 }, { t: 'summon', u: 2, name: 'Add', hp: 50, by: 1, signal: true }, { t: 'round', n: 4 }, { t: 'round', n: 5 }, { t: 'round', n: C2.OPEN_ROUNDS + 1 }], b);
    rec.after(s, null, [{ t: 'victory', kind: 'quest', rounds: 6 }], b);
    const [n0, engage, , firstOb, opened, used, signal, hpOpen, diff] = rec.f2[0];
    assert.equal(n0, s.fight.enemies.length);
    assert.equal(firstOb, 2);
    assert.equal(opened, 2);
    assert.equal(used, 1, 'a basic attack in a window is not a spell');
    assert.equal(signal, 1);
    assert.equal(hpOpen, Math.floor((p.hp / p.d.maxHp) * 1000 + 1e-9));
    assert.ok([0, 1, -1].includes(diff));
    assert.equal(typeof engage, 'string');
  });
});
