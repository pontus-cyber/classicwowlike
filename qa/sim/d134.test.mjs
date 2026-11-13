// D134 (autoplay's start camp buys the Ember of Return first, GATES.autoEmberFirst) in the sim (report
// docs/reports/balance-2026-11-13b.md): the 'ae' tag marks the old-order arm, the record's `emb` field counts Ember use,
// the planner's own camp does not read the switch, and sim/samerecords.mjs --ignore leaves a field out.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { C, GATE_DEFAULTS } from '../../sim/lib/engine.mjs';
import { setGates, runWithBot } from '../../sim/lib/runner.mjs';
import { cellName, GATE_TAG, REPO } from '../../sim/lib/output.mjs';

const on = Object.fromEntries(Object.keys(GATE_DEFAULTS).filter((k) => GATE_DEFAULTS[k]).map((k) => [k, true]));
const noae = Object.fromEntries(Object.keys(on).filter((k) => k !== 'autoEmberFirst').map((k) => [k, true]));
const play = (cell, seed, max = 4000) => runWithBot({ map: 'expedition', prep: true, prof: 'fresh', ...cell }, seed, null, { maxActions: max, hash: true }).record;
const strip = (r) => { const x = { ...r }; delete x.ms; delete x.emb; return JSON.stringify(x); };

describe('D134 autoplay camp Ember first in the sim', () => {
  test("the 'ae' tag: on by default (no mark); a cell naming its gates without it is '-noae'", () => {
    assert.equal(GATE_DEFAULTS.autoEmberFirst, true);
    assert.equal(GATE_TAG.autoEmberFirst, 'ae');
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', map: 'expedition', prep: true, prepPolicy: 'auto', gates: noae }), 'planner-P0-exp-prepauto-noae');
  });

  test('the record counts Ember use: emb = [Ember resurrects, of them in the boss fight, Embers carried at the boss]', () => {
    let seen = 0;
    for (const seed of [1000, 1001, 1002]) {
      const r = play({ bot: 'planner', cls: 'mage', tree: 1, prepPolicy: 'auto' }, seed);
      assert.equal(r.ct.bought[0], 'prep_ember');
      if (!r.emb) continue;
      seen++;
      assert.equal(r.emb.length, 3);
      assert.ok(r.emb[1] <= r.emb[0], `seed ${seed}: ${r.emb}`);
      assert.ok(r.emb[0] <= r.res, `seed ${seed}: Ember resurrects ${r.emb[0]} over all ${r.res}`);
      if (!r.rb) assert.equal(r.emb[1] + r.emb[2], 0);
    }
    assert.ok(seen > 0, 'an Ember-first camp uses its Ember in at least one of three runs');
  });

  test("the planner's own camp does not read the switch (same record on and off)", () => {
    for (const seed of [1000, 1001]) {
      const a = play({ bot: 'planner', cls: 'rogue', tree: 2, gates: on }, seed, 600);
      const b = play({ bot: 'planner', cls: 'rogue', tree: 2, gates: noae }, seed, 600);
      assert.equal(strip(a), strip(b), `seed ${seed}`);
    }
    setGates(null);
    assert.equal(C.GATES.autoEmberFirst, true);
  });

  test('sim/samerecords.mjs --ignore leaves the named fields out of the comparison', () => {
    const d = mkdtempSync(join(tmpdir(), 'samerec-ig-'));
    for (const [dir, lines] of [['a', [{ seed: 1, out: 'v', emb: [1, 0, 0] }]], ['b', [{ seed: 1, out: 'v' }]]]) {
      mkdirSync(join(d, dir, 'x'), { recursive: true });
      writeFileSync(join(d, dir, 'x', 'runs-rogue.jsonl'), `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
    }
    const run = (...extra) => spawnSync(process.execPath, [join(REPO, 'sim/samerecords.mjs'), join(d, 'a'), join(d, 'b'), ...extra], { encoding: 'utf8' });
    assert.equal(run().status, 1);
    const pass = run('--ignore', 'emb');
    assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  });
});
