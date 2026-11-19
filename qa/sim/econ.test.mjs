// D159 (docs/specs/legacy.md 4.7 Economy v2, draft): the simulator on C.GATES.economyV2. The planner's model (sim/lib/model.mjs)
// counts a Legacy award as the engine does under the switch (E2: against R.xpRef, XP_ZONE_STEP, no curve ratio, no diffMod;
// contracts at CONTRACT_CL_OFFSET_HERO) and levels the hero by HERO_XP_ECON2 (E4); off, the model is as before. The hero cell's
// --econ flag (cell mark 'e2') and the payout curve report (sim/econreport.mjs: the campaign chained by run).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { R, C, GATE_DEFAULTS, newRunFor } from '../../sim/lib/engine.mjs';
import { cellName, GATE_TAG, REPO } from '../../sim/lib/output.mjs';
import { setGates, cellProfile } from '../../sim/lib/runner.mjs';
import { makeCtx, killXp, evXp, levelPos, contractValue, xpWorth, copyM } from '../../sim/lib/model.mjs';
import { priorTable } from '../../sim/lib/risk.mjs';
import { eventXp, flatXp } from '../../src/engine/progress.js';
import { chain, DESIGNER_V2 } from '../../sim/econreport.mjs';

after(() => setGates(null));
const ON = Object.fromEntries(Object.entries(GATE_DEFAULTS).filter(([, on]) => on));
const LEG = { ...ON, legacy: true, oruvathLegacy: true };
const V2 = { ...LEG, economyV2: true };
/** A hero cell's state at hero level H after SET_OUT (zone 1's hub), with `gates` on while it is made. */
function heroState(cls, H, gates) {
  setGates(gates);
  const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed: 7, mapMode: 'expedition', prep: true, profile: cellProfile({ bot: 'planner', cls, prof: 'later', hero: H }) });
  R.stepInPlace(s, { type: 'START_RUN' });
  if (s.phase === 'PREP') R.stepInPlace(s, { type: 'SET_OUT' });
  return s;
}

describe('Economy v2 in the simulator (legacy.md 4.7)', () => {
  test("the switch is off by default; the cell mark is 'e2'", () => {
    assert.deepEqual([GATE_DEFAULTS.economyV2, GATE_TAG.economyV2], [false, 'e2']);
    assert.equal(cellName({ bot: 'planner', prof: 'later', cls: 'rogue', map: 'expedition', prep: true, gates: V2, hero: 10 }), 'planner-PL-exp-prep-leg-or2-e2-h10');
  });

  test('makeCtx: econ and the XP reference (R.xpRef: zone 1\'s band) under the switch; off, none', () => {
    const s = heroState('mage', 10, V2);
    const ctx = makeCtx(s, priorTable());
    assert.deepEqual([ctx.econ, ctx.zref], [true, s.hero.bands[1]]);
    setGates(LEG);
    const off = makeCtx(heroState('mage', 10, LEG), priorTable());
    assert.deepEqual([off.econ, off.zref], [false, null]);
  });

  test('E2: the model\'s kill and event XP equal the engine\'s eventXp (to its rounding) at hero 1, 10 and 25; the same at every level', () => {
    const seen = [];
    for (const H of [1, 10, 25]) {
      const s = heroState('rogue', H, V2);
      const ctx = makeCtx(s, priorTable());
      const Z = ctx.zref;
      const row = [];
      for (const d of [0, 1, 2, 4]) {
        const k = killXp(ctx, Z + d, 1, ctx.m.L);
        const e = evXp(ctx, C.QUEST_TURNIN_XP_FRAC * C.XP_WEIGHT_MULT, Z + d, ctx.m.L);
        assert.ok(Math.abs(k - eventXp(s, C.MOB_XP_FRAC * C.XP_WEIGHT_MULT, Z + d)) <= 0.5, `H${H} kill +${d}`);
        assert.ok(Math.abs(e - eventXp(s, C.QUEST_TURNIN_XP_FRAC * C.XP_WEIGHT_MULT, Z + d)) <= 0.5, `H${H} quest +${d}`);
        row.push(k, e);
      }
      seen.push(row);
    }
    assert.deepEqual(seen[1], seen[0]);
    assert.deepEqual(seen[2], seen[0]);
  });

  test('E2: a contract\'s hero XP in the model is the engine\'s flatXp (CL - Z = CONTRACT_CL_OFFSET_HERO)', () => {
    const s = heroState('hunter', 12, V2);
    const ctx = makeCtx(s, priorTable());
    const rw = { xpFrac: C.CONTRACT.cull.xpFrac * C.XP_WEIGHT_MULT, cl: 50, gold: 0, choices: 1, table: 'contract' };
    const m = copyM(ctx.m);
    const w0 = xpWorth(m);
    m.xp += flatXp(s, rw.xpFrac, rw.cl);
    assert.ok(Math.abs(contractValue(ctx, rw, { xpOnly: true }) - (xpWorth(m) - w0)) < 1e-6 * Math.max(1, w0));
  });

  test('E4: the model levels the hero by HERO_XP_ECON2 under the switch, HERO_XP off', () => {
    const at = (gates) => {
      const s = heroState('mage', 1, gates);
      const ctx = makeCtx(s, priorTable());
      const m = copyM(ctx.m);
      m.xp = 900;
      return levelPos(m);
    };
    const P = C.POWER_OF_LEVEL;
    assert.equal(at(V2), P[0] + ((P[1] - P[0]) * 900) / 1800);
    assert.equal(at(LEG), P[0] + ((P[1] - P[0]) * 900) / 2000);
  });

  test('--econ is a hero cell option', () => {
    const r = spawnSync('node', ['sim/run.mjs', '--bot', 'planner', '--class', 'rogue', '--runs', '1', '--econ', '--out', '/tmp/econ-flag'], { cwd: REPO, encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--econ is a --hero cell option/);
  });

  test('econreport chain: the campaign of 4.7 E5 by run (welcome in run 1, HERO_XP_ECON2, linear between levels)', () => {
    const rows = [1, 25].map((H) => ({ H, n: 1, ech: { pooled: DESIGNER_V2[H - 1] }, xp: 6900, min: 40 }));
    const runs = chain(rows);
    assert.equal(runs[0].legacy, DESIGNER_V2[0] + C.LEGACY_WELCOME);
    assert.equal(runs[0].start, 1);
    // 6900 XP from hero 1: 1800 + 1850 + 1900 = 5550, then 1350 of 2100
    assert.ok(Math.abs(runs[0].end - (4 + 1350 / 2100)) < 1e-9);
    assert.equal(runs[1].start, 4);
    assert.equal(runs[runs.length - 1].end, 25);
    assert.ok(runs.every((r, i) => i === 0 || r.cum > runs[i - 1].cum));
  });
});
