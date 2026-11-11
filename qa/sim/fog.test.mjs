// Fog-only expedition bots (expedition.md 10.1 leak test; MILESTONES 2b.4). The bots' expedition map decisions read
// only the fog view (sim/lib/view.mjs fogInput = R.mapView). At every map decision of real runs the hidden nodes'
// contents (type, level, enemies, region, everything but the skeleton) are permuted among the hidden nodes on a copy
// of the state: the player's view must be the same and every fog bot's decision identical. The oracle (full
// information, diagnostic only) reads the hidden contents, so its decision must change on some of the same states:
// that shows the test can see a leak. Start camp and contracts (MILESTONES 2b.5, runs with newRun prep): the hidden
// contract sites move with the contents (marks the player sees stay), start-camp decisions are compared with a copy of
// another run seed (every zone, hub offer and drop to come differs), and hub decisions with a hub contract on offer
// are scrambled like map decisions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { R, CONTENT } from '../../sim/lib/engine.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { oracleMap, plannerHourMult, plannerHeat } from '../../sim/bots/planner.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { priorTable } from '../../sim/lib/risk.mjs';
import { newRunFor, withExpMeta } from '../../sim/lib/engine.mjs';
import { SIM } from '../../sim/lib/params.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { planFog, contractSites } from '../../sim/bots/planner.mjs';
import { makeCtx } from '../../sim/lib/model.mjs';
import { fogInput } from '../../sim/lib/view.mjs';

const SKELETON = new Set(['id', 'ring', 'angle', 'nb', 'road', 'shardfall']);
const copy = (s) => R.deserialize(R.serialize(s), CONTENT);

/**
 * A copy of s whose hidden nodes (know 'none') carry each other's contents (rotated by `shift`). What the player sees of
 * a hidden node stays with it: its region with Region Charts, and its contract site marks inside the Tracker's radius
 * (prep, expedition.md 2.4, 5.2); those hidden nodes are rotated among themselves without their marks. Elsewhere the
 * site marks (zone node `sites`) move with the contents, so a bot that read a hidden site would decide differently.
 * Returns { c, n (nodes rotated), sites (hidden nodes carrying a site mark the player does not see) }.
 */
function scrambleHidden(s, shift = 1) {
  const c = copy(s);
  const view = R.mapView(s);
  const tr = (s.exp && s.exp.vision.tracker) || 0;
  const keep = new Set(SKELETON);
  if (view.vision.regions) keep.add('region');
  const hidden = view.nodes.filter((n) => n.know === 'none');
  const groups = [
    { ids: hidden.filter((n) => !(tr > 0 && n.hops <= tr)).map((n) => n.id), keep },
    { ids: hidden.filter((n) => tr > 0 && n.hops <= tr).map((n) => n.id), keep: new Set([...keep, 'sites']) },
  ];
  let moved = 0;
  let sites = 0;
  for (const g of groups) {
    if (g.ids.length < 2) continue;
    const contents = g.ids.map((id) => {
      const o = {};
      for (const [k, v] of Object.entries(c.zone.nodes[id])) if (!g.keep.has(k)) o[k] = v;
      return o;
    });
    for (let i = 0; i < g.ids.length; i++) {
      const n = c.zone.nodes[g.ids[i]];
      for (const k of Object.keys(n)) if (!g.keep.has(k)) delete n[k];
      Object.assign(n, contents[(i + shift) % g.ids.length]);
      if (!g.keep.has('sites') && n.sites && n.sites.length) sites++;
    }
    moved += g.ids.length;
  }
  return { c, n: moved, sites };
}

/** A copy of a PREP state with another run seed: every zone, hub offer and loot still to come differs; prepView does not. */
function scramblePrep(s, shift = 1) {
  const c = copy(s);
  c.seed = (s.seed + 0x9e3779b9 * shift) >>> 0;
  return { c, n: 1, sites: 0 };
}

const risk = priorTable();
const EXP_META = { quartermaster: 2, cartographer: 1, old_hand: 1 };

/**
 * Plays one expedition run with `bot` and, at every map decision (and, in a prep run, every start-camp decision and
 * every hub decision while a hub contract is on offer), compares the bot's choice on the state and on scrambled
 * copies. opts: { prep, expMeta (profile unlocks of expedition.md 8.2), vision, profile }. Returns { decisions,
 * oracleChanged, prepDecisions, hubDecisions, hiddenSites (scrambles that moved an unseen site mark), siteStates }.
 */
function leakCheck(botName, cls, seed, prof = 'fresh', maxDecisions = 400, opts = {}) {
  const mk = () => createBot(botName, { classId: cls, seed, risk, tree: 0 });
  const bot = mk();
  const profile = withExpMeta(buildProfile(prof, cls), opts.expMeta || null);
  const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, mapMode: 'expedition', profile, prep: !!opts.prep, vision: opts.vision || null });
  const r = { decisions: 0, oracleChanged: 0, prepDecisions: 0, hubDecisions: 0, hiddenSites: 0, siteStates: 0 };
  let steps = 0;
  while (s.phase !== 'ENDED' && steps < 20000 && r.decisions < maxDecisions) {
    const isMap = s.phase === 'MAP' && !s.fight && !s.loot.length;
    const isPrep = s.phase === 'PREP';
    const cv = opts.prep && s.phase === 'ZONE_HUB' && !s.service && !s.loot.length ? R.contractView(s) : null;
    const isHub = !!(cv && cv.hub);
    if (isMap || isPrep || isHub) {
      // The random bot draws from its stream: compare fresh bots at the same stream position, then play the live bot.
      const ref = botName === 'random' ? mk().choose(s) : bot.choose(s);
      if (isMap && R.mapView(s).nodes.some((n) => n.sites)) r.siteStates++;
      for (const shift of [1, 2]) {
        const { c, n, sites } = isPrep ? scramblePrep(s, shift) : scrambleHidden(s, shift);
        if (!n) continue;
        r.hiddenSites += sites ? 1 : 0;
        if (isPrep) assert.deepEqual(R.prepView(c), R.prepView(s), 'the start camp shows the same');
        else {
          assert.deepEqual(R.mapView(c), R.mapView(s), 'the scramble touched only hidden contents');
          if (opts.prep) assert.deepEqual(R.contractView(c), R.contractView(s), 'the contract tracker shows the same');
        }
        const where = isPrep ? 'start camp' : isHub ? `hub of zone ${s.zone.z}` : `zone ${s.zone.z}, zt ${R.mapView(s).zt}`;
        assert.deepEqual(mk().choose(c), ref, `${botName} ${cls} seed ${seed}: decision changed when hidden contents were scrambled (${where})`);
        if (isMap && shift === 1 && botName === 'planner') {
          const o0 = oracleMap(s, risk, 'balanced', plannerHourMult(null), plannerHeat(null)).action;
          const o1 = oracleMap(c, risk, 'balanced', plannerHourMult(null), plannerHeat(null)).action;
          if (JSON.stringify(o0) !== JSON.stringify(o1)) r.oracleChanged++;
        }
      }
      if (isMap) r.decisions++;
      else if (isPrep) r.prepDecisions++;
      else r.hubDecisions++;
      R.stepInPlace(s, botName === 'random' ? bot.choose(s) : ref);
    } else {
      R.stepInPlace(s, bot.choose(s));
    }
    steps++;
  }
  return r;
}

test('leak test: the fog planner decides the same when hidden nodes are scrambled; the oracle does not', (t) => {
  let oracle = 0;
  let dec = 0;
  for (const [cls, seed] of [['rogue', 1000], ['mage', 1001], ['hunter', 1002], ['mage', 1015]]) {
    const r = leakCheck('planner', cls, seed);
    dec += r.decisions;
    oracle += r.oracleChanged;
  }
  t.diagnostic(`planner: ${dec} map decisions checked against two scrambles each; the oracle changed its choice on ${oracle}`);
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

test('C_step and C_route: with cell.oracle (and cell.route) the runner counts agreements with the oracle', () => {
  let agree = 0;
  let n = 0;
  let zones = 0;
  for (const [cls, seed] of [['rogue', 1011], ['mage', 1012], ['hunter', 1013]]) {
    const { record } = runWithBot({ bot: 'planner', cls, prof: 'fresh', tree: 0, map: 'expedition', oracle: true, route: true }, seed, null, {});
    assert.equal(record.err, null);
    agree += record.xs.cs[0];
    n += record.xs.cs[1];
    assert.ok(record.xs.cr[0] <= record.xs.cr[1]);
    zones += record.xs.cr[1];
  }
  assert.ok(n >= 10 && agree <= n && agree >= 0, `C_step counts ${agree}/${n}`);
  assert.ok(zones >= 3, `C_route compares every zone played (${zones})`);
});

test('leak test with the start camp and contracts: prep, hub and map decisions of every fog bot ignore hidden contents and unseen sites', (t) => {
  const tot = { decisions: 0, oracleChanged: 0, prepDecisions: 0, hubDecisions: 0, hiddenSites: 0, siteStates: 0 };
  const cases = [
    ['planner', 'rogue', 1000, 'fresh', 300, {}], ['planner', 'mage', 1001, 'fresh', 300, {}],
    ['planner', 'hunter', 1002, 'all', 300, { expMeta: EXP_META, vision: { pathfinder: true } }],
    ['greedy', 'mage', 1003, 'fresh', 300, {}], ['speedrunner', 'hunter', 1004, 'fresh', 300, {}],
    ['random', 'rogue', 1005, 'fresh', 60, {}], ['random', 'mage', 1008, 'fresh', 60, {}],
  ];
  const per = {};
  for (const [bot, cls, seed, prof, max, o] of cases) {
    const r = leakCheck(bot, cls, seed, prof, max, { ...o, prep: true });
    per[bot] = (per[bot] || 0) + r.decisions + r.prepDecisions + r.hubDecisions;
    for (const k of Object.keys(tot)) tot[k] += r[k];
  }
  t.diagnostic(`prep runs: ${tot.prepDecisions} start-camp, ${tot.hubDecisions} hub and ${tot.decisions} map decisions checked; ${tot.siteStates} map states showed site marks, ${tot.hiddenSites} scrambles moved an unseen site mark; the oracle changed its choice on ${tot.oracleChanged}`);
  assert.ok(tot.prepDecisions >= 10, `start-camp decisions checked (${tot.prepDecisions})`);
  assert.ok(tot.hubDecisions >= 1, `hub decisions with an offer checked (${tot.hubDecisions})`);
  assert.ok(tot.siteStates >= 5, `map states with site marks checked (${tot.siteStates})`);
  assert.ok(tot.hiddenSites >= 5, `scrambles moved unseen site marks (${tot.hiddenSites})`);
  assert.ok(tot.oracleChanged > 0, 'the oracle still sees hidden contents');
  for (const [bot, k] of Object.entries(per)) assert.ok(k >= 10, `${bot}: ${k} decisions checked`);
});

test('site value: the planner steers by the site marks it sees (power check of the site term)', () => {
  // Same states, same view: the planner's map decision with its contract knowledge against the same search without it.
  // The site term must change some decisions; otherwise the leak test above could not see a site leak either.
  let n = 0;
  let changed = 0;
  for (const [cls, seed] of [['rogue', 1000], ['mage', 1001], ['hunter', 1006]]) {
    const bot = createBot('planner', { classId: cls, seed, risk, tree: 0 });
    const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, mapMode: 'expedition', prep: true });
    if (cls === 'hunter') R.stepInPlace(s, { type: 'SELECT_PET', petId: SIM.DEFAULT_PET });
    R.stepInPlace(s, { type: 'START_RUN' });
    // A start camp with contracts in zones 1-2 (the planner's own prep may hold later zones), so zone 1 has sites.
    for (const o of R.prepView(s).board) if (o.z <= 2 && R.isLegal(s, { type: 'TAKE_CONTRACT', index: o.index })) R.stepInPlace(s, { type: 'TAKE_CONTRACT', index: o.index });
    R.stepInPlace(s, { type: 'SET_OUT' });
    for (let i = 0; i < 20000 && s.phase !== 'ENDED' && n < 200; i++) {
      if (s.phase === 'MAP' && !s.fight && !s.loot.length) {
        const view = fogInput(s);
        const ctx = makeCtx(s, risk, { hourMult: plannerHourMult(null) });
        const sk = contractSites(s, view, ctx);
        if (sk) {
          n++;
          const a = planFog(view, ctx, { sites: sk }).action;
          const b = planFog(view, makeCtx(s, risk, { hourMult: plannerHourMult(null) }), {}).action;
          if (JSON.stringify(a) !== JSON.stringify(b)) changed++;
        }
      }
      R.stepInPlace(s, bot.choose(s));
    }
  }
  assert.ok(n >= 20, `map decisions with active contracts (${n})`);
  assert.ok(changed > 0, `the site term changes decisions (${changed} of ${n})`);
});

test('prep runs end without errors for every bot and record the contracts; --prep-policy none keeps every point', () => {
  for (const bot of ['random', 'greedy', 'planner', 'speedrunner']) {
    const { record } = runWithBot({ bot, cls: 'hunter', prof: 'fresh', tree: 0, map: 'expedition', prep: true }, 1010, null, {});
    assert.equal(record.err, null, `${bot}: ${record.err}`);
    assert.ok(record.ct && Array.isArray(record.ct.c), `${bot}: contract block recorded`);
    assert.ok(record.ct.xp >= record.ct.xpC, `${bot}: contract XP within all XP`);
  }
  const none = runWithBot({ bot: 'planner', cls: 'mage', prof: 'fresh', tree: 0, map: 'expedition', prep: true, prepPolicy: 'none' }, 1010, null, {}).record;
  assert.equal(none.err, null);
  assert.equal(none.ct.c.filter((k) => k[2] === 'b').length, 0, 'no board contract with prep none');
  assert.deepEqual(none.ct.bought, []);
  assert.equal(none.ct.res, 10, 'every point is Reserve');
  const plain = runWithBot({ bot: 'planner', cls: 'mage', prof: 'fresh', tree: 0, map: 'expedition' }, 1010, null, {}).record;
  assert.equal(plain.ct, undefined, 'no contract block without prep');
});
