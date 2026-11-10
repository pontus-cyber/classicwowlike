// Heat in the simulator (docs/specs/expedition.md H.6; B55-B57 of section H): HEAT equals the bot and target constants
// of section 13 block "Heat"; the planner's heat-seek and heat-avoid variants use their hour weights; the recorder
// keeps the summary's nodes per heat state; the heat checks on synthetic records.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { R, newRunFor } from '../../sim/lib/engine.mjs';
import { BAL, HEAT } from '../../sim/lib/params.mjs';
import { plannerHourMult } from '../../sim/bots/planner.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { heatChecks, hotRun } from '../../sim/lib/heatchecks.mjs';

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

describe('heat checks (synthetic records)', () => {
  const rec = (seed, out, ht) => ({ seed, cls: 'rogue', out, rb: out === 'v' ? 1 : 0, ht, hb: 130, asc: 0.04 });
  test('B55h paired win gap within the band, B56 share of winning runs with a Hot node, B57 power gap', () => {
    const seek = [rec(1, 'v', [5, 3, 2, 0]), rec(2, 'v', [5, 3, 1, 0]), rec(3, 'd', [5, 3, 0, 0]), rec(4, 'v', [9, 0, 0, 0])];
    const avoid = [rec(1, 'v', [9, 0, 0, 0]), rec(2, 'd', [9, 0, 0, 0]), rec(3, 'd', [9, 0, 0, 0]), rec(4, 'v', [9, 0, 0, 0])];
    const planner = [rec(1, 'v', [6, 2, 1, 0]), rec(2, 'v', [8, 1, 0, 0]), rec(3, 'd', [6, 2, 1, 0]), rec(4, 'v', [5, 3, 0, 1])];
    const noHeat = [rec(1, 'v', [6, 2, 1, 0]), rec(2, 'd', [8, 1, 0, 0]), rec(3, 'd', [6, 2, 1, 0]), rec(4, 'v', [5, 3, 0, 1])];
    assert.equal(hotRun(planner[0]), true);
    assert.equal(hotRun(planner[1]), false);
    const rows = heatChecks({ planner, seek, avoid, noHeat });
    const b55 = rows.find((r) => r.id === 'B55h');
    assert.match(b55.value, /^\+25\.0 pp/);
    assert.equal(b55.ok, false, '+25 pp is outside +-5 pp');
    const b56 = rows.find((r) => r.id === 'B56');
    assert.match(b56.value, /^66\.7 %/);
    assert.equal(b56.ok, true);
    const b57 = rows.find((r) => r.id === 'B57');
    assert.match(b57.value, /^\+25\.0 pp/);
    assert.equal(b57.ok, false);
    const same = heatChecks({ seek: avoid, avoid });
    assert.equal(same.find((r) => r.id === 'B55h').ok, true);
  });
});
