// D147 regression (docs/specs/changes-m3-v1.md engine finding 1; m3-onboarding.md 2.6): the Designer's failing case, the
// guided first run of the onebutton bot, Hunter, run seed 1000, with the zone 1 lever (C.GATES.z1Dmg, on) and the X0
// tables of the measure (fixture qa/fixtures/x0-hunter.json: the Hunter's observations of sim/out/pass-v9v10/obs-P0.json
// with the contract and Dimmed-encounter tables of sim/out/pass-v12/exp/table/planner-P0-exp-prep/risk.json, merged as
// sim/run.mjs --risk-in --tables-in does). Before D147 the run stayed in phase NODE until the action cap: a rescue landed
// on a Dimmed node, the settle step started a Dimmed encounter at once, and a death there was a rescue to the same node.
// Now the run ends, and every rescue lands with no fight started, one of them on a Dimmed node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { R, C, newRunFor } from '../../sim/lib/engine.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { runWithBot, cellPet } from '../../sim/lib/runner.mjs';
import { buildTable } from '../../sim/lib/risk.mjs';
import { slot1Tree } from '../../sim/bots/onebutton.mjs';

const OBS = JSON.parse(readFileSync(new URL('../fixtures/x0-hunter.json', import.meta.url), 'utf8'));

test('D147: guided onebutton Hunter, seed 1000, zone 1 lever, X0 tables: the run ends; each rescue starts no fight, one lands on a Dimmed node', () => {
  const cell = { bot: 'onebutton', prof: 'fresh', cls: 'hunter', tree: slot1Tree('hunter'), map: 'expedition', prep: true, guided: true };
  const { record, state } = runWithBot(cell, 1000, buildTable(structuredClone(OBS)), { log: true });
  assert.equal(C.GATES.z1Dmg, true, 'the lever is on (the cell plays the engine defaults)');
  assert.equal(record.err, null);
  assert.equal(state.phase, 'ENDED');
  assert.ok(record.steps < 2000, `${record.steps} actions`);
  assert.ok(state.tutorial.rescues >= 1 && state.tutorial.rescues <= C.ONB_RESCUE_MAX, `${state.tutorial.rescues} rescues`);
  // the same run, replayed from its log: what each rescue left
  const s = newRunFor({ classId: 'hunter', petId: cellPet(cell), seed: 1000, profile: buildProfile('fresh', 'hunter'), mapMode: 'expedition', prep: true, tutorial: true });
  let rescues = 0;
  let dark = 0;
  for (const a of record.log) {
    const ev = R.stepInPlace(s, a);
    const i = ev.findIndex((e) => e.t === 'rescue');
    if (i < 0) continue;
    rescues++;
    assert.ok(!ev.slice(i).some((e) => e.t === 'dim' || e.t === 'fight'), 'no fight after the rescue');
    assert.deepEqual([s.fight, s.node], [null, null]);
    assert.ok(['MAP', 'ZONE_HUB'].includes(s.phase) || s.zone.z === 2, s.phase);
    if (s.zone.z === 1 && R.mapView(s).nodes[s.zone.pos].dimmed) dark++;
  }
  assert.equal(rescues, state.tutorial.rescues);
  assert.ok(dark >= 1, 'the failing case: a rescue that lands on a Dimmed node');
  assert.equal(s.phase, 'ENDED');
});
