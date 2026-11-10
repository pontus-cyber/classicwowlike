// M2 v3 bot changes (balance.md 1, 1.1; docs/specs/changes-m2-v3.md rows 15-16): hour weight per bot, resurrects
// usable at the end boss.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, newRunFor } from '../../sim/lib/engine.mjs';
import { BAL, SIM } from '../../sim/lib/params.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { planMap, valueGrindWaves } from '../../sim/bots/planner.mjs';
import { greedyMap } from '../../sim/bots/greedy.mjs';
import { makeCtx, evalNode, copyM } from '../../sim/lib/model.mjs';
import { bestBoonIndex, bossResurrects } from '../../sim/lib/policy.mjs';
import { priorTable } from '../../sim/lib/risk.mjs';

const key = (a) => JSON.stringify(a, Object.keys(a).sort());

/** MAP states of engine-autopilot runs (hunter, PALL: long runs), copied. */
function mapStates(seeds) {
  const out = [];
  for (const seed of seeds) {
    const s = newRunFor({ classId: 'hunter', petId: 'ridgewolf', seed, profile: buildProfile('all', 'hunter') });
    for (let k = 0; k < 30000 && s.phase !== 'ENDED'; k++) {
      if (s.phase === 'MAP') out.push(R.deserialize(R.serialize(s), s.content));
      R.stepInPlace(s, R.autoAction(s));
    }
  }
  return out;
}

describe('hour weight (balance.md 1.1, M2 v3)', () => {
  test('makeCtx: hourMult option, times STYLE_SPEED_HOUR_MULT for the speed style; the hour term scales with it', () => {
    const s = mapStates([43])[0];
    const risk = priorTable();
    assert.equal(makeCtx(s, risk).hourMult, 1);
    assert.equal(makeCtx(s, risk, { hourMult: BAL.PLANNER_HOUR_MULT }).hourMult, BAL.PLANNER_HOUR_MULT);
    assert.equal(makeCtx(s, risk, { hourMult: BAL.PLANNER_HOUR_MULT, style: 'speed' }).hourMult, BAL.PLANNER_HOUR_MULT * SIM.STYLE_SPEED_HOUR_MULT);
    const rest = { type: 'rest' };
    const c1 = makeCtx(s, risk);
    const v1 = evalNode(c1, copyM(c1.m), rest);
    const c2 = makeCtx(s, risk, { hourMult: 2 });
    const v2 = evalNode(c2, copyM(c2.m), rest);
    assert.ok(Math.abs(v1.value - v2.value - v1.hours * BAL.VAL_HOUR) < 1e-9, `${v1.value} vs ${v2.value}`);
  });

  test('planner and tactician map choices use PLANNER_HOUR_MULT; the greedy uses 1', () => {
    const risk = priorTable();
    const mk = (name) => createBot(name, { classId: 'hunter', seed: 43, risk, tree: 1 });
    const [pl, ta, gr] = [mk('planner'), mk('tactician'), mk('greedy')];
    let differ = 0;
    let n = 0;
    for (const s of mapStates([42, 43, 44])) {
      n++;
      const want = planMap(s, risk, 'balanced', BAL.PLANNER_HOUR_MULT).action;
      assert.equal(key(pl.spec.map(s)), key(want));
      assert.equal(key(ta.spec.map(s)), key(want));
      assert.equal(key(gr.spec.map(s)), key(greedyMap(s, risk)));
      if (key(planMap(s, risk, 'balanced', 1).action) !== key(want)) differ++;
    }
    assert.ok(n > 100 && differ > 0, `${differ} of ${n} map choices change with the weight`);
    void valueGrindWaves;
  });
});

describe('resurrects usable at the end boss (balance.md 1.1, M2 v3)', () => {
  test('Second Breath does not count when ranking Shrine boons; a Boon of Return or an Ember does', () => {
    const s = newRunFor({ classId: 'mage', seed: 7, profile: buildProfile('all', 'mage') });
    R.stepInPlace(s, { type: 'START_RUN' });
    assert.equal(s.player.res.meta, C.RES_META_CHARGES, 'PALL: Second Breath charge');
    s.player.hp = s.player.d.maxHp;
    const boons = ['fury', 'return', 'insight'];
    assert.equal(bossResurrects(s), 0);
    assert.equal(boons[bestBoonIndex(s, boons)], 'return', 'only Second Breath held: take Boon of Return');
    s.player.res.boon = 1;
    assert.equal(boons[bestBoonIndex(s, boons)], 'fury', 'a Boon of Return held: Return goes last');
  });
});
