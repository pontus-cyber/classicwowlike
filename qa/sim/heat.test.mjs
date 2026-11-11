// Heat in the simulator (docs/specs/expedition.md H.6; B58, B56, B57): HEAT equals the bot and target constants of
// section 13 block "Heat"; the planner's heat-seek and heat-avoid variants (hour weights and heat terms); the value
// function's heat terms (entry state as R.heatPreview says, rarity step, XP and gold multiplier, boss term from
// projected Ascendancy); the recorder keeps the summary's nodes per heat state; the heat checks on synthetic records
// (B56 as redefined in M2b v6: heat-seek - planner and heat-seek's winning runs with a Hot node).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { C, R, CONTENT, newRunFor } from '../../sim/lib/engine.mjs';
import { BAL, HEAT, SIM } from '../../sim/lib/params.mjs';
import { plannerHourMult, plannerHeat } from '../../sim/bots/planner.mjs';
import { makeCtx, evalNode, copyM, expGain, heatStateOf, ascProjected, bankedPos } from '../../sim/lib/model.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { heatChecks, hotRun, b56Parts } from '../../sim/lib/heatchecks.mjs';
import { priorTable } from '../../sim/lib/risk.mjs';

describe('HEAT equals expedition.md section 13, block "Heat"', () => {
  test('every HEAT key has the spec value', () => {
    const md = readFileSync(new URL('../../docs/specs/expedition.md', import.meta.url), 'utf8');
    const sec = md.slice(md.indexOf('## 13. Constant table'));
    const spec = {};
    for (const line of sec.split('\n')) {
      const m = line.match(/^\| ([A-Z0-9_ /]+) \| ([^|]+) \|/);
      if (!m) continue;
      const names = m[1].split('/').map((x) => x.trim());
      const vals = m[2].trim().split('/').map((x) => x.trim());
      names.forEach((n, i) => { spec[n] = vals[i] ?? vals[0]; });
    }
    for (const [k, v] of Object.entries(HEAT)) {
      assert.ok(k in spec, `${k} not in the spec table`);
      const range = spec[k].match(/^([\d.]+)-([\d.]+)$/);
      assert.deepEqual(v, range ? [Number(range[1]), Number(range[2])] : Number(spec[k]), k);
    }
  });
});

describe('heat-seek and heat-avoid (planner variants)', () => {
  test('hour weights: seek HEAT_SEEK_HOUR_MULT, avoid HEAT_AVOID_HOUR_MULT, else PLANNER_HOUR_MULT', () => {
    assert.equal(plannerHourMult('heatSeek'), HEAT.HEAT_SEEK_HOUR_MULT);
    assert.equal(plannerHourMult('heatAvoid'), HEAT.HEAT_AVOID_HOUR_MULT);
    assert.equal(plannerHourMult(null), BAL.PLANNER_HOUR_MULT);
    assert.equal(plannerHourMult('noAoe'), BAL.PLANNER_HOUR_MULT);
    assert.equal(plannerHourMult('hm3'), 3);
    assert.equal(plannerHourMult('hm0.5'), 0.5);
  });

  test('heat terms: seek and the default value the rewards, avoid does not, all pay the boss term; noHeat has none', () => {
    assert.deepEqual(plannerHeat(null), { rewards: true, ascW: SIM.VAL_ASC });
    assert.deepEqual(plannerHeat('heatSeek'), { rewards: true, ascW: SIM.VAL_ASC });
    assert.deepEqual(plannerHeat('heatAvoid'), { rewards: false, ascW: SIM.VAL_ASC });
    assert.equal(plannerHeat('noHeat'), null);
  });

  test('a short run per variant is legal; the record has the nodes per heat state of the summary', () => {
    for (const variant of [null, 'heatSeek', 'heatAvoid']) {
      const { record, state } = runWithBot({ bot: 'planner', cls: 'mage', prof: 'fresh', tree: 2, style: null, variant, pet: null }, 1003, null, { maxActions: 1500 });
      assert.ok(!record.err || record.err.startsWith('stuck'), record.err);
      const sum = state.result ? state.result.summary : R.summary(state);
      assert.deepEqual(record.ht, sum.heat.nodesByState, String(variant));
      assert.equal(record.ht.length, 4);
    }
  });
});

/** States at the planner's map decisions of runs from `seed` on (prior risk table), at least n of them. */
function mapStates(seed, n) {
  const out = [];
  for (let sd = seed; out.length < n && sd < seed + 50; sd++) {
    const bot = createBot('planner', { classId: 'hunter', seed: sd, tree: 1, variant: null });
    const s = newRunFor({ classId: 'hunter', petId: SIM.DEFAULT_PET, seed: sd });
    for (let i = 0; i < 20000 && s.phase !== 'ENDED' && out.length < n; i++) {
      if (s.phase === 'MAP' && !s.zone.camp) out.push(R.deserialize(R.serialize(s), CONTENT));
      R.stepInPlace(s, bot.choose(s));
    }
  }
  return out;
}

describe('value function heat terms (sim/lib/model.mjs)', () => {
  test('the model\'s entry state and projected Ascendancy equal the engine\'s (heatPreview pays, heatView ascIfPar)', () => {
    const states = mapStates(1001, 40);
    assert.ok(states.length >= 20);
    const floor = SIM.HEAT_ASC_FLOOR;
    try {
      SIM.HEAT_ASC_FLOOR = 1;
      // The runs (prior risk table) end early and in hand, so each state is also checked moved 15, 35 and 60 h past
      // (the weight-3 planner of M2b v6 stays further in hand than the weight-2 one, so 35 h no longer reaches Scorched).
      const moved = states.flatMap((x) => [0, 15, 35, 60].map((dh) => { const y = R.deserialize(R.serialize(x), CONTENT); y.hours += dh; return y; }));
      const seen = new Set();
      for (const s of moved) {
        const v = R.heatView(s);
        seen.add(v.state);
        assert.equal(ascProjected(v.heat), v.ascIfPar);
        for (const lane of R.mapView(s).next) {
          const pv = R.heatPreview(s, { type: 'CHOOSE_NODE', lane });
          assert.equal(heatStateOf(v.heat), pv.pays);
          assert.equal(ascProjected(pv.heat), pv.ascIfPar);
        }
      }
      assert.deepEqual([...seen].sort(), ['clear', 'hot', 'scorched', 'warm']);
    } finally { SIM.HEAT_ASC_FLOOR = floor; }
    // Without the floor: linear in the hours past the line, 0 in hand, capped.
    assert.equal(ascProjected(-5), 0);
    assert.ok(Math.abs(ascProjected(5) - C.ASC_PER_STEP / 2) < 1e-12);
    assert.equal(ascProjected(1e6), C.ASC_CAP);
  });

  test('rarity step: up 0 is the plain gain, up 1 the gain one rarity higher (epic stays), monotone between', () => {
    const s = mapStates(1002, 3)[2];
    const ctx = makeCtx(s, priorTable(), {});
    const L = s.player.level;
    for (const table of ['mob', 'quest', 'elite', 'dboss', 'treasure']) {
      const g0 = expGain(ctx, table, L);
      const gHalf = expGain(ctx, table, L, 0.5);
      const g1 = expGain(ctx, table, L, 1);
      assert.ok(gHalf >= g0 - 1e-9 && g1 >= gHalf - 1e-9, table);
      assert.ok(Math.abs(gHalf - (g0 + g1) / 2) < 1e-9, `${table}: linear in up`);
    }
  });

  test('a node entered Hot pays × (1 + HEAT_GAIN.hot) XP and the boss term charges hours past the line only', () => {
    const s = mapStates(1003, 2)[1];
    const v = R.mapView(s);
    const node = v.rows[v.pos.r][v.next[0]];
    const val = (heat, pays) => {
      const ctx = makeCtx(s, priorTable(), { hourMult: 2, heat });
      const m = copyM(ctx.m);
      const p0 = bankedPos(m);
      const ev = evalNode(ctx, m, node, { pays });
      return { ev, dl: bankedPos(m) - p0, dh: m.dh, ctx };
    };
    const clear = val({ rewards: true, ascW: 0 }, 'clear');
    const hot = val({ rewards: true, ascW: 0 }, 'hot');
    const off = val(null, null);
    assert.equal(clear.ev.state, 'clear');
    assert.equal(hot.ev.state, 'hot');
    assert.equal(off.ev.state, null);
    assert.ok(Math.abs(clear.ev.value - off.ev.value) < 1e-9, 'Clear pays nothing extra');
    assert.ok(hot.ev.value > clear.ev.value, 'Hot pays more');
    assert.equal(clear.dh, clear.ev.hours);
    if (node.type === 'quest' && s.player.level + 1 < C.MAX_LEVEL) assert.ok(hot.dl > clear.dl * 1.2, 'XP × 1.35');
    // Boss term: in hand (h0 < 0 by more than the node's hours) costs nothing; past the line ascW × hours × step rate.
    const ascW = 8000;
    const withBoss = val({ rewards: false, ascW }, 'clear');
    const h0 = withBoss.ctx.heat.h0;
    const expect = (ascProjected(h0 + withBoss.ev.hours) - ascProjected(h0)) * ascW;
    assert.ok(Math.abs(off.ev.value - withBoss.ev.value - expect) < 1e-6);
    if (h0 + withBoss.ev.hours <= 0) assert.equal(expect, 0);
  });
});

describe('heat checks (synthetic records)', () => {
  const rec = (seed, out, ht) => ({ seed, cls: 'rogue', out, rb: out === 'v' ? 1 : 0, ht, hb: 130, asc: 0.04 });
  test('B58 paired win gap within the band, B56 (M2b v6: seek - planner and seek\'s wins with a Hot node), old B56 diagnostic, B57 power gap', () => {
    const seek = [rec(1, 'v', [5, 3, 2, 0]), rec(2, 'v', [5, 3, 1, 0]), rec(3, 'd', [5, 3, 0, 0]), rec(4, 'v', [9, 0, 0, 0])];
    const avoid = [rec(1, 'v', [9, 0, 0, 0]), rec(2, 'd', [9, 0, 0, 0]), rec(3, 'd', [9, 0, 0, 0]), rec(4, 'v', [9, 0, 0, 0])];
    const planner = [rec(1, 'v', [6, 2, 1, 0]), rec(2, 'v', [8, 1, 0, 0]), rec(3, 'd', [6, 2, 1, 0]), rec(4, 'v', [5, 3, 0, 1])];
    const noHeat = [rec(1, 'v', [6, 2, 1, 0]), rec(2, 'd', [8, 1, 0, 0]), rec(3, 'd', [6, 2, 1, 0]), rec(4, 'v', [5, 3, 0, 1])];
    assert.equal(hotRun(planner[0]), true);
    assert.equal(hotRun(planner[1]), false);
    const rows = heatChecks({ planner, seek, avoid, noHeat });
    const b58 = rows.find((r) => r.id === 'B58');
    assert.match(b58.value, /^\+25\.0 pp/);
    assert.equal(b58.ok, false, '+25 pp is outside +-5 pp');
    // B56 (a): seek 3/4, planner 3/4 on the same seeds -> +0.0 pp (>= -5 pp); (b): seek's wins 1, 2, 4, two with Hot -> 66.7 %.
    const b56 = rows.find((r) => r.id === 'B56' && r.pri === 'P2');
    assert.match(b56.value, /^\(a\) \+0\.0 pp .*; \(b\) 66\.7 %/);
    assert.equal(b56.ok, true);
    // Old B56 (diagnostic): the default planner's wins 1, 2, 4, two with a Hot or Scorched node.
    const old = rows.find((r) => r.id === 'B56' && r.pri === 'diag');
    assert.match(old.value, /^66\.7 %/);
    assert.equal(old.ok, null);
    const b57 = rows.find((r) => r.id === 'B57');
    assert.match(b57.value, /^\+25\.0 pp/);
    assert.equal(b57.ok, false);
    const same = heatChecks({ seek: avoid, avoid });
    assert.equal(same.find((r) => r.id === 'B58').ok, true);
  });

  test('B56 fails on either part: seek more than HEAT_POLICY_GAP_MAX behind the planner (a), or its wins outside HEAT_WIN_SHARE (b)', () => {
    const n = 40;
    const mk = (f) => Array.from({ length: n }, (_, i) => f(i));
    const planner = mk((i) => rec(i, i < 20 ? 'v' : 'd', [9, 0, 0, 0]));
    // (a) fails: seek wins 10 of the planner's 20 seeds (-25 pp); half of its wins Hot (b passes).
    const seekBehind = mk((i) => rec(i, i < 10 ? 'v' : 'd', i < 5 ? [5, 2, 2, 0] : [9, 0, 0, 0]));
    const xa = b56Parts(seekBehind, planner);
    assert.equal(xa.okA, false);
    assert.equal(xa.okB, true);
    assert.equal(heatChecks({ planner, seek: seekBehind }).find((r) => r.id === 'B56' && r.pri === 'P2').ok, false);
    // (b) fails: seek wins as often as the planner, every win Hot (100 % > 85 %).
    const seekAllHot = mk((i) => rec(i, i < 20 ? 'v' : 'd', [5, 2, 2, 0]));
    const xb = b56Parts(seekAllHot, planner);
    assert.equal(xb.okA, true);
    assert.equal(xb.okB, false);
    assert.equal(xb.b.p, 1);
    // (b) fails low: no win Hot.
    assert.equal(b56Parts(planner, planner).okB, false);
    // Both pass: same win rate, 40 % of the wins Hot.
    const seekOk = mk((i) => rec(i, i < 20 ? 'v' : 'd', i < 8 ? [5, 2, 1, 1] : [9, 0, 0, 0]));
    const xo = b56Parts(seekOk, planner);
    assert.equal(xo.ok, true);
    assert.ok(Math.abs(xo.b.p - 0.4) < 1e-12);
    assert.ok(Math.abs(-HEAT.HEAT_POLICY_GAP_MAX / 100 + 0.05) < 1e-12, 'the (a) floor is HEAT_POLICY_GAP_MAX');
  });
});
