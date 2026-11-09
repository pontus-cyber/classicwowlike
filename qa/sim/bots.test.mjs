// Bots only choose legal actions (balance.md 1: a bot is a policy that only chooses actions).
// Every action a bot picks must be in legalActions(state) (SET_NAME and SET_SEED are never picked), and a full
// run must end in ENDED without an engine error.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, newRunFor } from '../../sim/lib/engine.mjs';
import { createBot, BOT_NAMES } from '../../sim/bots/index.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { fightClone } from '../../sim/lib/clone.mjs';
import { candidateActions, evaluateAction } from '../../sim/bots/tactician.mjs';
import { templateBar, ALWAYS_CAST } from '../../sim/lib/policy.mjs';
import { BotRng } from '../../sim/lib/engine.mjs';

const key = (a) => JSON.stringify(a, Object.keys(a).sort());

/** Play a run; check each chosen action against legalActions. Returns { state, steps }. */
function checkedRun(bot, classId, seed, prof = 'fresh', maxSteps = 6000) {
  const b = createBot(bot, { classId, seed, tree: 0 });
  const s = newRunFor({ classId, petId: null, seed, profile: buildProfile(prof, classId) });
  let n = 0;
  while (s.phase !== 'ENDED' && n < maxSteps) {
    const a = b.choose(s);
    const legal = new Set(R.legalActions(s).map(key));
    assert.ok(legal.has(key(a)), `${bot} ${classId} seed ${seed} step ${n}: ${JSON.stringify(a)} is not in legalActions (phase ${s.phase})`);
    R.stepInPlace(s, a);
    n++;
  }
  return { state: s, steps: n };
}

describe('bots choose only legal actions', () => {
  for (const bot of BOT_NAMES.filter((x) => x !== 'tactician')) {
    test(`${bot}: full runs for every class end in ENDED, every action legal`, () => {
      for (const cls of ['rogue', 'mage', 'hunter']) {
        for (const seed of [11, 12]) {
          const r = checkedRun(bot, cls, seed);
          assert.equal(r.state.phase, 'ENDED', `${bot} ${cls} seed ${seed} stopped in ${r.state.phase}`);
        }
      }
    });
  }

  test('planner with the full catalogue (PALL) and a hunter pet choice by the random bot', () => {
    assert.equal(checkedRun('planner', 'hunter', 21, 'all').state.phase, 'ENDED');
    assert.equal(checkedRun('random', 'hunter', 22, 'all').state.phase, 'ENDED');
  });

  test('tactician: every action legal for 400 steps per class (it reaches fights, hubs and the map)', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) checkedRun('tactician', cls, 31, 'fresh', 400);
  });
});

describe('tactician look-ahead', () => {
  test('simulating candidates never changes the live state', () => {
    const b = createBot('planner', { classId: 'rogue', seed: 5, tree: 0 });
    const s = newRunFor({ classId: 'rogue', seed: 5 });
    let checked = 0;
    for (let n = 0; n < 2000 && s.phase !== 'ENDED' && checked < 25; n++) {
      if (s.fight) {
        const before = R.serialize(s);
        const rng = new BotRng(1);
        const seeds = [rng.u32(), rng.u32()];
        for (const a of candidateActions(s)) evaluateAction(s, a, seeds);
        assert.equal(R.serialize(s), before, 'look-ahead changed the live state');
        checked++;
      }
      R.stepInPlace(s, b.choose(s));
    }
    assert.ok(checked > 5);
  });

  test('fightClone copies everything a step can change', () => {
    const s = newRunFor({ classId: 'mage', seed: 9 });
    R.stepInPlace(s, { type: 'START_RUN' });
    const c = fightClone(s);
    for (const k of ['player', 'stats', 'zone', 'hub']) assert.notEqual(c[k], s[k]);
    assert.equal(R.serialize(c), R.serialize(s));
  });
});

describe('bar template (balance.md 1.2 with the hand-off fix)', () => {
  test('conditional spells come before always-castable ones; at most 7; no duplicates', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed: 3 });
      R.stepInPlace(s, { type: 'START_RUN' });
      // every class spell known at level 60
      s.player.level = 60;
      for (const sp of Object.values(R.C.SPELL)) if (sp.cls === cls && sp.source === 'class') { s.player.spells[sp.id] = { tl: 60, rank: 1 }; if (!s.player.spellOrder.includes(sp.id)) s.player.spellOrder.push(sp.id); }
      for (const camp of [false, true]) {
        const bar = templateBar(s, { camp }).filter(Boolean);
        assert.equal(bar.length, 7);
        assert.equal(new Set(bar).size, 7);
        const firstAlways = bar.findIndex((id) => ALWAYS_CAST.has(id));
        assert.ok(firstAlways > 0 && bar.slice(firstAlways).every((id) => ALWAYS_CAST.has(id)), `${cls} camp=${camp}: ${bar.join(',')}`);
        assert.ok(bar.some((id) => R.C.SPELL[id].tags.includes('interrupt')), `${cls}: interrupt on the bar`);
        if (camp) assert.ok(bar.some((id) => R.C.SPELL[id].tags.includes('cleanse')), `${cls}: cleanse on the boss bar`);
      }
    }
  });
});
