// Bar guard (sim/lib/policy.mjs barGuard; design-2026-11-13e finding 2, hand-off sim-2026-11-14): in a guided run the
// runner replaces an action the guide refuses with autoplay's action (sim/lib/runner.mjs). Autoplay's bar differs from
// the template bar (a Hunter: Mend Companion before Barbed Arrow), so before the guard the bot and autoplay swapped bar
// slot 0 for ever while the guide kept refusing the bot's map action. A bar edit may now never repeat without a state
// change.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, newRunFor } from '../../sim/lib/engine.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { barGuard, barFingerprint } from '../../sim/lib/policy.mjs';

// D150 (cut list item 15): a profile's first run offers one camp contract; the scenario below was found with the three-offer
// board, so the run's profile has one run behind it (the board only; the guide is the newRun option)
const guidedHunter = (seed) => newRunFor({ classId: 'hunter', petId: 'ridgewolf', seed, profile: { ...buildProfile('fresh', 'hunter'), runs: 1 }, mapMode: 'expedition', prep: true, tutorial: true });
/** A guided Hunter on the zone 1 map (the planner played up to there). */
function onMap(seed) {
  const s = guidedHunter(seed);
  const b = createBot('planner', { classId: 'hunter', seed });
  while (s.phase !== 'MAP') R.stepInPlace(s, b.choose(s));
  return s;
}
const isBarEdit = (a) => a && (a.type === 'SET_BAR' || a.type === 'SET_ITEM_BAR');

/** Play with the runner's guided fallback; the bot's map action is refused in zone 1 once the Hunter knows Mend Companion. */
function playRefused(bot, s, maxSteps) {
  const map0 = bot.spec.map;
  bot.spec.map = (st) => (st.player.spells.mend_companion && st.tutorial && st.zone.z === 1 ? { type: 'MOVE', nodeId: -1 } : map0(st));
  let longest = 0;
  let run = 0;
  let n = 0;
  for (; n < maxSteps && s.phase !== 'ENDED'; n++) {
    let a = bot.choose(s);
    if (s.tutorial && !R.isLegal(s, a)) a = R.autoAction(s);
    run = isBarEdit(a) ? run + 1 : 0;
    longest = Math.max(longest, run);
    R.stepInPlace(s, a);
  }
  return { n, longest };
}

describe('bar guard: a bar swap never repeats without a state change', () => {
  for (const bot of ['planner', 'onebutton']) {
    test(`guided Hunter seed 1003, ${bot}: the guide refuses every zone 1 map action, the run still ends`, () => {
      const s = guidedHunter(1003);
      const b = createBot(bot, { classId: 'hunter', seed: 1003 });
      const { n, longest } = playRefused(b, s, 5000);
      assert.equal(s.phase, 'ENDED', `stuck after ${n} actions in phase ${s.phase}`);
      assert.ok(longest <= 2 * 7 + 2 * 3, `bar edits in a row: ${longest}`);
      assert.ok(b.spec && b.barLog.held >= 1, 'the guard held the bar at least once');
    });
  }

  test('a repeated edit with no state change is held; any state change lets it through again', () => {
    const s = onMap(1003);
    const log = { fp: null, edits: new Set() };
    const e = { type: 'SET_BAR', slot: 0, spellId: 'barbed_arrow' };
    assert.deepEqual(barGuard(log, s, e), e);
    assert.deepEqual(barGuard(log, s, { type: 'SET_BAR', slot: 1, spellId: null }), { type: 'SET_BAR', slot: 1, spellId: null });
    s.player.bar[3] = s.player.bar[3] === null ? 'keen_shot' : null; // the bar alone is no state change
    assert.equal(barGuard(log, s, e), null);
    s.player.gold += 1;
    assert.deepEqual(barGuard(log, s, e), e);
    assert.equal(barGuard(log, s, null), null);
  });

  test('the fingerprint ignores the bars and the guide hint counters, nothing else', () => {
    const s = onMap(1003);
    const f0 = barFingerprint(s);
    s.player.bar = s.player.bar.slice().reverse();
    s.player.itemBar = s.player.itemBar.slice().reverse();
    assert.ok(s.tutorial && s.tutorial.beats);
    s.tutorial.beats = { X: { shown: 99 } };
    assert.equal(barFingerprint(s), f0);
    s.player.hp -= 1;
    assert.notEqual(barFingerprint(s), f0);
  });

  test('normal play: the planner never needs the guard (classic and expedition, Hunter and Mage)', () => {
    for (const [cls, map, guided] of [['hunter', null, false], ['hunter', 'expedition', true], ['mage', 'expedition', false]]) {
      const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed: 1003, profile: buildProfile('fresh', cls), mapMode: map, prep: map === 'expedition', tutorial: guided });
      const b = createBot('planner', { classId: cls, seed: 1003 });
      for (let n = 0; n < 20000 && s.phase !== 'ENDED'; n++) {
        let a = b.choose(s);
        if (guided && s.tutorial && !R.isLegal(s, a)) a = R.autoAction(s);
        R.stepInPlace(s, a);
      }
      assert.equal(s.phase, 'ENDED');
      assert.ok(!b.barLog.held, `${cls} ${map || 'classic'}: held ${b.barLog.held}`);
    }
  });
});
