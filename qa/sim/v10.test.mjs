// M2b v10 simulator rows (docs/specs/changes-m2b-v10.md): C2 the learned Dimmed encounter table (`dim` by depth 0, 1, 2+,
// prior SIM.EXP_DIM_DEATH × (1 + depth), recorder block `dm`); D1/D2 the planner's start camp by value per point (supplies
// and perks at their bot values, a second contract of a zone at SIM.PREP_SAME_ZONE_MULT, the cell-9 force / ban
// overrides); the greedy's clean-escape test (rules 1.9.9 step 3); the EST_COMPLETE prior; the bots' contract XP against
// the engine (row A1: a todo until the engine pays contract XP without the level-difference modifier).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { C, R, newRunFor } from '../../sim/lib/engine.mjs';
import { SIM, EXP } from '../../sim/lib/params.mjs';
import { newObs, addRecord, buildTable, priorTable, dimRisk, mergeObs } from '../../sim/lib/risk.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { Recorder } from '../../sim/lib/recorder.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { plannerPrep, supplyValue, estComplete, offerValue } from '../../sim/bots/shared.mjs';
import { greedyExpMap } from '../../sim/bots/greedy.mjs';
import { makeCtx, evalNode, copyM } from '../../sim/lib/model.mjs';
import { fogInput, escapeV, enterableV } from '../../sim/lib/view.mjs';

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);
const TREES = { rogue: 2, mage: 1, hunter: 2 };

/** A run at the start camp (phase PREP) for class cls and seed. */
function atCamp(cls, seed) {
  const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, mapMode: 'expedition', prep: true });
  if (cls === 'hunter') R.stepInPlace(s, { type: 'SELECT_PET', petId: SIM.DEFAULT_PET });
  R.stepInPlace(s, { type: 'START_RUN' });
  return s;
}

describe('C2: Dimmed encounter table by depth', () => {
  test('prior: SIM.EXP_DIM_DEATH × (1 + depth) for 0, 1, 2+, HP lost SIM.EXP_DIM_HP; depths interpolate and clamp', () => {
    assert.equal(SIM.EXP_DIM_DEATH, 0.02);
    const t = priorTable();
    assert.deepEqual(t.dim.n, [0, 0, 0]);
    for (let b = 0; b <= 2; b++) close(t.dim.p[b], 0.02 * (1 + b), `p[${b}]`);
    close(dimRisk(t, 0).p, 0.02, 'depth 0');
    close(dimRisk(t, 0.5).p, 0.03, 'depth 0.5');
    close(dimRisk(t, 5).p, 0.06, 'depth 5 uses the 2+ bucket');
    close(dimRisk(t, 1).hp, SIM.EXP_DIM_HP, 'HP prior');
    close(dimRisk({ p: {}, dh: {} }, 1).p, 0.04, 'a table without dim rows uses the prior');
  });

  test('learning: deaths per encounter shrunk with RISK_SHRINK, monotone in depth; survivors\' HP change learned', () => {
    const obs = newObs();
    // Depth 0: 30 encounters, 0 deaths, survivors lose 10 HP %; depth 1: 10 encounters, 5 deaths; depth 3 counts as 2+.
    const dm = [];
    for (let i = 0; i < 30; i++) dm.push([0, 0, 80, 70]);
    for (let i = 0; i < 10; i++) dm.push([1, i < 5 ? 1 : 0, 80, i < 5 ? 0 : 60]);
    dm.push([3, 0, 50, 40]);
    addRecord(obs, { dm });
    addRecord(obs, {});
    assert.deepEqual(obs.dim[0].slice(0, 2), [30, 0]);
    assert.deepEqual(obs.dim[2].slice(0, 2), [1, 0]);
    const k = SIM.RISK_SHRINK;
    const t = buildTable(obs);
    close(t.dim.p[0], (0 + k * 0.02) / (30 + k), 'depth 0');
    close(t.dim.p[1], (5 + k * 0.04) / (10 + k), 'depth 1');
    close(t.dim.p[2], Math.max(t.dim.p[1], (0 + k * 0.06) / (1 + k)), 'depth 2+ is monotone');
    close(t.dim.dh[0], (30 * -0.1 - k * SIM.EXP_DIM_HP) / (30 + k), 'HP change depth 0');
    // Merged observations (batch refresh, --tables-in) keep the dim rows.
    const m = mergeObs(obs, obs);
    assert.deepEqual(m.dim[0].slice(0, 2), [60, 0]);
  });

  test('recorder: every Dimmed encounter is recorded with the engine\'s depth and outcome, and only those', () => {
    // A scripted walker into the dark (autoplay, except on the map: the neighbour that dims first), recorded as the runner does.
    let n = 0;
    for (const seed of [1000, 1001, 1002, 1003, 1004, 1005]) {
      const s = newRunFor({ classId: 'rogue', seed, mapMode: 'expedition' });
      const rec = new Recorder({ trainCheck: false });
      const dims = [];
      for (let i = 0; i < 3000 && s.phase !== 'ENDED'; i++) {
        let a = R.autoAction(s);
        if (s.phase === 'MAP' && !s.fight && !s.loot.length && s.zone && !s.zone.camp) {
          const v = R.mapView(s);
          let b = v.moves[0];
          for (const m of v.moves) if (v.nodes[m.nodeId].dimAt < v.nodes[b.nodeId].dimAt) b = m;
          if (b) a = { type: 'MOVE', nodeId: b.nodeId };
        }
        const before = rec.before(s, a);
        const ev = R.stepInPlace(s, a);
        rec.after(s, a, ev, before);
        for (const e of ev) {
          if (e.t === 'dim') dims.push({ d: e.depth, died: 0, open: true });
          const last = dims[dims.length - 1];
          if ((e.t === 'victory' || e.t === 'fled') && last) last.open = false;
          if (e.t === 'runEnd' && e.outcome === 'death' && last && last.open) last.died = 1;
        }
      }
      const r = rec.finish(s, { seed, bot: 'walker', cls: 'rogue', prof: 'fresh', steps: 0, ms: 0 });
      const dm = r.dm || [];
      assert.deepEqual(dm.map((x) => [x[0], x[1]]), dims.map((x) => [x.d, x.died]), `seed ${seed}: depth and outcome per encounter`);
      for (const [, died, h0, h1] of dm) assert.ok(h0 > 0 && h0 <= 100 && h1 >= 0 && h1 <= 100 && (died === 0 || h1 === 0));
      n += dm.length;
    }
    assert.ok(n >= 3, `Dimmed encounters seen (${n})`);
    const rows = runWithBot({ bot: 'planner', cls: 'rogue', prof: 'fresh', tree: 2 }, 1000, null, { maxActions: 3000 }).record;
    assert.equal(rows.dm, undefined, 'no dm block on the classic map');
  });
});

describe('D1/D2: planner start camp by value per point', () => {
  test('bot values: draughts 2 × 45, ember 320, rations 45, mule 20; per point 90 / 80 / 45 / 20 at today\'s prices', () => {
    assert.equal(supplyValue('prep_draughts'), C.PREP_OPTION.prep_draughts.qty * SIM.POTION_VALUE);
    assert.equal(supplyValue('prep_draughts'), 90);
    assert.equal(supplyValue('prep_ember'), 320);
    assert.equal(supplyValue('prep_rations'), 45);
    assert.equal(supplyValue('prep_mule'), 20);
    assert.equal(supplyValue('prep_bell'), null);
    const per = (id) => supplyValue(id) / C.PREP_OPTION[id].price;
    assert.deepEqual([per('prep_draughts'), per('prep_ember'), per('prep_rations'), per('prep_mule')], [90, 80, 45, 20]);
    assert.deepEqual(EXP.EST_COMPLETE, { cull: 0.55, bounty: 0.45, delve: 0.35 });
    assert.equal(SIM.PREP_SAME_ZONE_MULT, 0.6);
  });

  test('the camp is legal, ends in SET_OUT, buys what is worth more than PREP_POINT_VALUE; a second contract of a zone counts at 0.6', () => {
    const risk = priorTable();
    let draughts = 0;
    let seconds = 0;
    for (const [cls, seed] of [['rogue', 1000], ['mage', 1001], ['hunter', 1002], ['rogue', 1003], ['mage', 1004], ['hunter', 1005]]) {
      const s = atCamp(cls, seed);
      for (let i = 0; i < 40 && s.phase === 'PREP'; i++) {
        const a = plannerPrep(s, risk);
        assert.ok(R.isLegal(s, a), `${cls} ${seed}: ${JSON.stringify(a)}`);
        if (a.type === 'TAKE_CONTRACT') {
          const pv = R.prepView(s);
          const o = pv.board.find((x) => x.index === a.index);
          if (pv.board.some((x) => x.taken && x.z === o.z)) {
            seconds++;
            const v = (estComplete(risk, o.kind, false, o.z) * offerValue(makeCtx(s, risk), o) * SIM.PREP_SAME_ZONE_MULT) / o.price;
            assert.ok(v > SIM.PREP_POINT_VALUE, `second contract of zone ${o.z} at ${v.toFixed(1)} per point`);
          }
        }
        if (a.type === 'BUY_PREP' && a.id === 'prep_draughts') draughts++;
        if (a.type === 'SET_OUT') {
          // Nothing worth more than PREP_POINT_VALUE per point is left to buy: draughts (90) and the Ember (80).
          for (const o of R.prepView(s).options) {
            const v = supplyValue(o.id);
            if (v !== null && v / o.price > SIM.PREP_POINT_VALUE) assert.ok(!o.canBuy, `${cls} ${seed}: set out with ${o.id} affordable`);
          }
        }
        R.stepInPlace(s, a);
      }
      assert.notEqual(s.phase, 'PREP', `${cls} ${seed}: the camp ends`);
    }
    assert.ok(draughts >= 4, `Field Draughts (90 per point) bought in most runs (${draughts} of 6)`);
    assert.ok(seconds >= 0);
  });

  test('cell 9 overrides: --prep-force buys the option first, --prep-ban never buys it', () => {
    const risk = priorTable();
    const s = atCamp('mage', 1001);
    assert.deepEqual(plannerPrep(s, risk, ['prep_ember']), { type: 'BUY_PREP', id: 'prep_ember' });
    for (let i = 0; i < 40 && s.phase === 'PREP'; i++) {
      const a = plannerPrep(s, risk, null, ['prep_draughts']);
      assert.ok(!(a.type === 'BUY_PREP' && a.id === 'prep_draughts'), 'banned option bought');
      R.stepInPlace(s, a);
    }
    const f = runWithBot({ bot: 'planner', cls: 'hunter', prof: 'fresh', tree: 2, map: 'expedition', prep: true, prepForce: ['prep_ember'] }, 1006, null, {}).record;
    assert.equal(f.err, null);
    assert.ok(f.ct.bought.includes('prep_ember'), 'forced Ember bought');
    const b = runWithBot({ bot: 'planner', cls: 'hunter', prof: 'fresh', tree: 2, map: 'expedition', prep: true, prepBan: ['prep_draughts'] }, 1006, null, {}).record;
    assert.equal(b.err, null);
    assert.ok(!b.ct.bought.includes('prep_draughts'), 'banned Draughts not bought');
  });
});

describe('greedy: clean-escape test (rules 1.9.9 step 3)', () => {
  test('every node the greedy enters is out of the Dimming when its content ends and leaves a Road without a Dimmed step', () => {
    let entered = 0;
    for (const [cls, seed, prep] of [['rogue', 1000, false], ['mage', 1001, true], ['hunter', 1002, false], ['rogue', 1003, true]]) {
      const risk = priorTable();
      const bot = createBot('greedy', { classId: cls, seed, risk, tree: TREES[cls] });
      const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, mapMode: 'expedition', prep });
      for (let i = 0; i < 20000 && s.phase !== 'ENDED'; i++) {
        const a = bot.choose(s);
        if (s.phase === 'MAP' && !s.fight && !s.loot.length && a.type === 'MOVE') {
          const view = fogInput(s);
          if (enterableV(view, a.nodeId, view.zt)) {
            entered++;
            const ctx = makeCtx(s, risk, { hourMult: 1 });
            const at = view.zt + evalNode(ctx, copyM(ctx.m), view.nodes[a.nodeId]).hours;
            assert.ok(at < view.nodes[a.nodeId].dimAt, `${cls} ${seed}: entered a node that dims before its content ends`);
            assert.equal(escapeV(view, a.nodeId, at).dims, 0, `${cls} ${seed}: no clean way to a Road after node ${a.nodeId}`);
          }
        }
        R.stepInPlace(s, a);
      }
    }
    assert.ok(entered >= 20, `nodes entered (${entered})`);
  });
});

describe('A1: contract XP in the bots\' model follows the engine', () => {
  // Contract completions of autoplay prep runs (the engine's own policy): the XP the engine paid (heat extra removed)
  // against the formula with and without the level-difference modifier.
  const seen = [];
  for (const cls of ['rogue', 'mage', 'hunter']) {
    for (let seed = 1000; seed < 1060 && seen.length < 12; seed++) {
      const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, mapMode: 'expedition', prep: true });
      for (let i = 0; i < 30000 && s.phase !== 'ENDED'; i++) {
        const L0 = s.player ? s.player.level : 1;
        const p = s.player;
        const xpPct = s.meta ? s.meta.xpPct + (p && p.buffs.insight && p.buffs.insight.active ? C.BOON_XP_PCT : 0) : 0;
        const ev = R.stepInPlace(s, R.autoAction(s));
        const done = ev.find((e) => e.t === 'contract' && e.what === 'complete');
        const xi = ev.findIndex((e) => e.t === 'xp' && e.why === 'contract');
        const xp = xi >= 0 ? ev[xi] : null;
        // The player's level when the contract pays: kill XP earlier in the same step may have levelled up.
        const L = L0 + ev.slice(0, Math.max(0, xi)).filter((e) => e.t === 'levelUp').length;
        if (done && xp && L < C.MAX_LEVEL) {
          const cl = C.ZONE_LEVELS * (done.z - 1) + C.CONTRACT_CL_OFFSET;
          const base = C.CONTRACT[done.kind].xpFrac * C.XP_WEIGHT_MULT * R.xpCurve(cl) * (1 + xpPct);
          seen.push({ paid: xp.amount - (xp.heat || 0), flat: Math.round(base), mod: Math.round(base * R.diffMod(cl - L)), dm: R.diffMod(cl - L) });
        }
      }
    }
  }
  const flat = seen.every((x) => x.paid === x.flat);
  const mod = seen.every((x) => x.paid === x.mod);

  test('the engine pays contract XP by one formula (with or without the level-difference modifier)', () => {
    assert.ok(seen.length >= 3, `contract completions seen (${seen.length})`);
    assert.ok(seen.some((x) => x.dm !== 1), 'some completion with a level difference (the two formulas differ)');
    assert.ok(flat || mod, `paid ${JSON.stringify(seen.slice(0, 4))}`);
  });

  test('SIM.CONTRACT_XP_DIFFMOD matches the engine', { todo: flat ? false : 'engine without M2b v10 A1: the model already drops diffMod (SIM.CONTRACT_XP_DIFFMOD 0); set it to 1 to reproduce a pre-v10 measure' }, () => {
    assert.equal(SIM.CONTRACT_XP_DIFFMOD, flat ? 0 : 1);
  });
});
