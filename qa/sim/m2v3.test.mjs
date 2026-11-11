// M2 v3 bot changes (balance.md 1, 1.1; docs/specs/changes-m2-v3.md rows 15-16) and the healing-stock fix
// (docs/handoffs/sim-2026-11-10.md): hour weight per bot, resurrects usable at the end boss, Healing Draught stock.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, newRunFor, countCons } from '../../sim/lib/engine.mjs';
import { BAL, SIM } from '../../sim/lib/params.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { planMap, valueGrindWaves, plannerHeat } from '../../sim/bots/planner.mjs';
import { greedyMap } from '../../sim/bots/greedy.mjs';
import { makeCtx, evalNode, copyM, vAt } from '../../sim/lib/model.mjs';
import { bestBoonIndex, bossResurrects, vendorAction, desiredItemBar } from '../../sim/lib/policy.mjs';
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
    // Seeds whose autopilot runs hold map choices the weight changes (content of a379e3c: 25 of 232; seeds 42-44
    // had 0 of 92 after it). Re-pick with a probe over seeds when content changes the sampled maps again.
    for (const s of mapStates([41, 45, 49])) {
      n++;
      const want = planMap(s, risk, 'balanced', BAL.PLANNER_HOUR_MULT, plannerHeat(null)).action;
      assert.equal(key(pl.spec.map(s)), key(want));
      assert.equal(key(ta.spec.map(s)), key(want));
      assert.equal(key(gr.spec.map(s)), key(greedyMap(s, risk)));
      if (key(planMap(s, risk, 'balanced', 1, plannerHeat(null)).action) !== key(want)) differ++;
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

describe('Healing Draught stock (sim hand-off 2026-11-10: the Packed Satchel bug)', () => {
  test('where Greater Healing Draughts are sold, the 3 Satchel Healing Draughts do not count toward HEAL_STOCK_TARGET', () => {
    const s = newRunFor({ classId: 'rogue', seed: 1022, profile: buildProfile('all', 'rogue') });
    R.stepInPlace(s, { type: 'START_RUN' });
    assert.equal(countCons(s, 'healing_draught'), C.META.satchel.potions);
    s.player.gold = 1e7; // test state: enough gold for the whole kit
    R.stepInPlace(s, { type: 'SERVICE', service: 'vendor' });
    assert.ok(s.service.stock.some((e) => e.kind === 'cons' && e.id === 'greater_healing_draught'), 'Alchemist: Greater draughts sold');
    const kit = { potions: BAL.HEAL_STOCK_TARGET, rations: SIM.RATION_STOCK, mana: 0, tonics: 0, elixir: 0, ember: false, gear: false };
    for (let k = 0; k < 60 && s.service; k++) R.stepInPlace(s, vendorAction(s, kit, vAt));
    assert.equal(countCons(s, 'greater_healing_draught'), BAL.HEAL_STOCK_TARGET);
    assert.equal(countCons(s, 'healing_draught'), C.META.satchel.potions);
    assert.equal(desiredItemBar(s)[0], 'greater_healing_draught');
  });

  test('without Greater draughts in stock, Healing Draughts count as before', () => {
    const s = newRunFor({ classId: 'rogue', seed: 1022, profile: buildProfile('meta10', 'rogue') });
    R.stepInPlace(s, { type: 'START_RUN' });
    s.player.gold = 1e7;
    R.stepInPlace(s, { type: 'SERVICE', service: 'vendor' });
    assert.ok(!s.service.stock.some((e) => e.kind === 'cons' && e.id === 'greater_healing_draught'));
    const kit = { potions: BAL.HEAL_STOCK_TARGET, rations: SIM.RATION_STOCK, mana: 0, tonics: 0, elixir: 0, ember: false, gear: false };
    for (let k = 0; k < 60 && s.service; k++) R.stepInPlace(s, vendorAction(s, kit, vAt));
    assert.equal(countCons(s, 'healing_draught'), BAL.HEAL_STOCK_TARGET);
  });
});
