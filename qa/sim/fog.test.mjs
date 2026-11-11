// Fog-only expedition bots (expedition.md 10.1 leak test; MILESTONES 2b.4). The bots' expedition map decisions read
// only the fog view (sim/lib/view.mjs fogInput = R.mapView). At every map decision of real runs the hidden nodes'
// contents (type, level, enemies, region, everything but the skeleton) are permuted among the hidden nodes on a copy
// of the state: the player's view must be the same and every fog bot's decision identical. The oracle (full
// information, diagnostic only) reads the hidden contents, so its decision must change on some of the same states:
// that shows the test can see a leak.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { R, CONTENT } from '../../sim/lib/engine.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { oracleMap, plannerHourMult, plannerHeat } from '../../sim/bots/planner.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { priorTable } from '../../sim/lib/risk.mjs';
import { newRunFor } from '../../sim/lib/engine.mjs';
import { SIM } from '../../sim/lib/params.mjs';

const SKELETON = new Set(['id', 'ring', 'angle', 'nb', 'road', 'shardfall']);
const copy = (s) => R.deserialize(R.serialize(s), CONTENT);

/** A copy of s whose hidden nodes (know 'none') carry each other's contents (rotated by `shift`). */
function scrambleHidden(s, shift = 1) {
  const c = copy(s);
  const view = R.mapView(s);
  const hidden = view.nodes.filter((n) => n.know === 'none').map((n) => n.id);
  if (hidden.length < 2) return { c, n: 0 };
  const contents = hidden.map((id) => {
    const o = {};
    for (const [k, v] of Object.entries(c.zone.nodes[id])) if (!SKELETON.has(k)) o[k] = v;
    return o;
  });
  for (let i = 0; i < hidden.length; i++) {
    const n = c.zone.nodes[hidden[i]];
    for (const k of Object.keys(n)) if (!SKELETON.has(k)) delete n[k];
    Object.assign(n, contents[(i + shift) % hidden.length]);
  }
  return { c, n: hidden.length };
}

const risk = priorTable();

/**
 * Plays one expedition run with `bot` and, at every map decision, compares the bot's choice on the state and on
 * scrambled copies. Returns { decisions, oracleChanged }.
 */
function leakCheck(botName, cls, seed, prof = 'fresh', maxDecisions = 400) {
  const mk = () => createBot(botName, { classId: cls, seed, risk, tree: 0 });
  const bot = mk();
  const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, mapMode: 'expedition' });
  let decisions = 0;
  let oracleChanged = 0;
  let steps = 0;
  while (s.phase !== 'ENDED' && steps < 20000 && decisions < maxDecisions) {
    const isMap = s.phase === 'MAP' && !s.fight && !s.loot.length;
    if (isMap) {
      const a = bot.choose(s);
      for (const shift of [1, 2]) {
        const { c, n } = scrambleHidden(s, shift);
        if (!n) continue;
        assert.deepEqual(R.mapView(c), R.mapView(s), 'the scramble touched only hidden contents');
        // Fresh bots on both states (same bot-stream position, so the random bot is compared fairly too).
        const ref = botName === 'random' ? mk().choose(s) : a;
        assert.deepEqual(mk().choose(c), ref, `${botName} ${cls} seed ${seed}: decision changed when hidden nodes were scrambled (zone ${s.zone.z}, zt ${R.mapView(s).zt})`);
        if (shift === 1 && botName === 'planner') {
          const o0 = oracleMap(s, risk, 'balanced', plannerHourMult(null), plannerHeat(null)).action;
          const o1 = oracleMap(c, risk, 'balanced', plannerHourMult(null), plannerHeat(null)).action;
          if (JSON.stringify(o0) !== JSON.stringify(o1)) oracleChanged++;
        }
      }
      decisions++;
      R.stepInPlace(s, a);
    } else {
      R.stepInPlace(s, bot.choose(s));
    }
    steps++;
  }
  return { decisions, oracleChanged };
}

test('leak test: the fog planner decides the same when hidden nodes are scrambled; the oracle does not', () => {
  let oracle = 0;
  let dec = 0;
  for (const [cls, seed] of [['rogue', 1000], ['mage', 1001], ['hunter', 1002], ['mage', 1015]]) {
    const r = leakCheck('planner', cls, seed);
    dec += r.decisions;
    oracle += r.oracleChanged;
  }
  assert.ok(dec >= 40, `enough map decisions checked (${dec})`);
  assert.ok(oracle > 0, `the oracle reads hidden contents, so scrambling changes some of its decisions (${oracle} of ${dec})`);
});

test('leak test: greedy, speedrunner and random decide the same when hidden nodes are scrambled', () => {
  const n = { greedy: 0, speedrunner: 0, random: 0 };
  for (const [bot, cls, seed] of [['greedy', 'mage', 1003], ['greedy', 'hunter', 1006], ['speedrunner', 'hunter', 1004], ['speedrunner', 'mage', 1007], ['random', 'rogue', 1005], ['random', 'mage', 1008], ['random', 'hunter', 1009], ['random', 'mage', 1014]]) {
    n[bot] += leakCheck(bot, cls, seed, 'fresh', bot === 'random' ? 60 : 400).decisions;
  }
  for (const [bot, k] of Object.entries(n)) assert.ok(k >= 10, `${bot}: ${k} map decisions checked`);
});

test('expedition runs end without errors for every fog bot; rows runs are not marked as expedition', () => {
  for (const bot of ['random', 'greedy', 'planner', 'speedrunner']) {
    const { record } = runWithBot({ bot, cls: 'mage', prof: 'fresh', tree: 0, map: 'expedition' }, 1010, null, {});
    assert.equal(record.err, null, `${bot}: ${record.err}`);
    assert.ok(record.ex && record.ex.zones.length >= 1, `${bot}: expedition block recorded`);
    assert.ok(record.xs && Array.isArray(record.xs.cz), `${bot}: close-call zones recorded`);
  }
  const { record } = runWithBot({ bot: 'planner', cls: 'mage', prof: 'fresh', tree: 0 }, 1010, null, {});
  assert.equal(record.ex, undefined);
  assert.equal(record.xs, undefined);
});

test('C_step: with cell.oracle the runner counts the planner\'s map decisions and its agreements with the oracle', () => {
  let agree = 0;
  let n = 0;
  for (const [cls, seed] of [['rogue', 1011], ['mage', 1012], ['hunter', 1013]]) {
    const { record } = runWithBot({ bot: 'planner', cls, prof: 'fresh', tree: 0, map: 'expedition', oracle: true }, seed, null, {});
    assert.equal(record.err, null);
    agree += record.xs.cs[0];
    n += record.xs.cs[1];
  }
  assert.ok(n >= 10 && agree <= n && agree >= 0, `C_step counts ${agree}/${n}`);
});
