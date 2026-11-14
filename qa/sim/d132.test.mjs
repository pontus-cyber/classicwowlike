// D132 (the camp board across the run) in the sim (docs/handoffs/engineer-2026-11-12e.md section 4; report
// docs/reports/balance-2026-11-13.md): the 'ba' tag marks the board-off arm, a cell naming its gates without
// boardAcrossRun plays the D128 board, --prep-policy auto plays autoplay's start camp (the engine's R.autoAction), and
// sim/samerecords.mjs (stage H of sim/measure-d132.sh) finds identical and differing records.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { C, GATE_DEFAULTS } from '../../sim/lib/engine.mjs';
import { setGates, runWithBot } from '../../sim/lib/runner.mjs';
import { cellName, GATE_TAG, REPO } from '../../sim/lib/output.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';

const on = Object.fromEntries(Object.keys(GATE_DEFAULTS).filter((k) => GATE_DEFAULTS[k]).map((k) => [k, true]));
const noba = Object.fromEntries(Object.keys(on).filter((k) => k !== 'boardAcrossRun').map((k) => [k, true]));
// D150 (cut list item 15): a profile's first run offers one camp contract (zone 1); the board across the run is a later run's
const later = (cls) => ({ ...buildProfile('fresh', cls), runs: 1 });
const camp = (cell, seed, max = 400) => runWithBot({ map: 'expedition', prep: true, prof: 'fresh', ...cell }, seed, null, { maxActions: max, hash: true, profile: later(cell.cls) }).record;
const boardZones = (r) => r.ct.c.filter((k) => k[2] !== 'h').map((k) => k[0]);

describe('D132 board across the run in the sim', () => {
  test("the 'ba' tag: on by default (no mark); a cell naming its gates without it is '-noba' and plays the D128 board", () => {
    assert.equal(GATE_DEFAULTS.boardAcrossRun, true);
    assert.equal(GATE_TAG.boardAcrossRun, 'ba');
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', map: 'expedition', prep: true, gates: on }), 'planner-P0-exp-prep');
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', map: 'expedition', prep: true, gates: noba }), 'planner-P0-exp-prep-noba');
    setGates(noba);
    assert.equal(C.GATES.boardAcrossRun, false);
    setGates(null);
    assert.equal(C.GATES.boardAcrossRun, true);
  });

  test('the board-off arm takes camp contracts of zones 1-3 only; the board across the run reaches zones 4-6', () => {
    const cell = { bot: 'planner', cls: 'hunter', tree: 2 };
    let late = 0;
    for (const seed of [1000, 1001, 1002, 1003, 1004, 1005]) {
      const off = camp({ ...cell, gates: noba }, seed);
      for (const z of boardZones(off)) assert.ok(z <= 3, `off ${seed}: a camp contract of zone ${z}`);
      const now = camp(cell, seed);
      late += boardZones(now).filter((z) => z >= 4).length;
    }
    assert.ok(late > 0, 'the planner takes a zone 4-6 camp contract on the board across the run');
  });

  test("--prep-policy auto plays autoplay's camp: the Ember of Return first (D133), camp contracts of zones 1..AUTO_PREP_ZONES only", () => {
    const EA = C.ENGINE_ASSUMPTION;
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', map: 'expedition', prep: true, prepPolicy: 'auto' }), 'planner-P0-exp-prepauto');
    for (const seed of [1000, 1001, 1002, 1003]) {
      const r = camp({ bot: 'planner', cls: 'mage', tree: 1, prepPolicy: 'auto' }, seed);
      assert.equal(r.ct.bought[0], C.GATES.autoEmberFirst ? 'prep_ember' : 'prep_draughts', `auto ${seed}: ${r.ct.bought}`);
      for (const z of boardZones(r)) assert.ok(z <= EA.AUTO_PREP_ZONES, `auto ${seed}: a camp contract of zone ${z}`);
    }
  });

  test('sim/samerecords.mjs: identical records pass (wall time ignored), a differing record fails', () => {
    const d = mkdtempSync(join(tmpdir(), 'samerec-'));
    const rec = (seed, out, ms) => JSON.stringify({ seed, out, ms });
    for (const [dir, cell, lines] of [['a', 'x-noba', [rec(1, 'v', 5), rec(2, 'd', 6)]], ['b', 'x', [rec(1, 'v', 9), rec(2, 'd', 1), rec(3, 'v', 2)]], ['c', 'x-noba', [rec(1, 'd', 5)]]]) {
      mkdirSync(join(d, dir, cell), { recursive: true });
      writeFileSync(join(d, dir, cell, 'runs-rogue.jsonl'), `${lines.join('\n')}\n`);
    }
    const run = (a) => spawnSync(process.execPath, [join(REPO, 'sim/samerecords.mjs'), join(d, a), join(d, 'b'), '--strip', '-noba'], { encoding: 'utf8' });
    const pass = run('a');
    assert.equal(pass.status, 0, pass.stdout + pass.stderr);
    assert.match(pass.stdout, /2 \/ 2 identical with x/);
    const fail = run('c');
    assert.equal(fail.status, 1);
    assert.match(fail.stdout, /identity: FAIL/);
  });
});
