// D128 / D130 lean start camp in the sim (docs/handoffs/engineer-2026-11-12d.md "What sim/ must change" 1-4; report
// docs/reports/balance-2026-11-12d.md): the 'rr' tag of C.GATES.campReroll, B42's vision perks = the camp's two sight perks,
// --prep-force / --prep-ban refuse an option the camp does not offer (unless --camp-options opens it), and the bots' prep
// policies consider only the camp's options (cell.campOptions: null = the engine's C.PREP_CAMP_OPTIONS, 'all' = every option).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { C, GATE_DEFAULTS, CAMP_DEFAULTS, CAMP_LIST, campOptionsFor, campRefusal } from '../../sim/lib/engine.mjs';
import { EXP } from '../../sim/lib/params.mjs';
import { setGates, setCampOptions, runWithBot } from '../../sim/lib/runner.mjs';
import { cellName, GATE_TAG, REPO } from '../../sim/lib/output.mjs';

const OUTSIDE = C.PREP_OPTION_IDS.filter((id) => !C.PREP_CAMP_OPTIONS.includes(id));
const camp = (cell, seed, max = 400) => runWithBot({ map: 'expedition', prep: true, prof: 'fresh', ...cell }, seed, null, { maxActions: max, hash: true }).record;

describe('D128 start camp in the sim', () => {
  test('the engine as built: four camp options, the reroll switch off; the sim reads them at load', () => {
    assert.ok(CAMP_LIST);
    assert.deepEqual([...CAMP_DEFAULTS], ['prep_draughts', 'prep_ember', 'prep_charts', 'prep_tracker']);
    assert.deepEqual([...CAMP_DEFAULTS], [...C.PREP_CAMP_OPTIONS]);
    assert.ok(Object.isFrozen(CAMP_DEFAULTS));
    assert.equal(GATE_DEFAULTS.campReroll, false);
    assert.deepEqual(campOptionsFor(null), [...CAMP_DEFAULTS]);
    assert.deepEqual(campOptionsFor('all'), C.PREP_OPTION_IDS);
    assert.deepEqual(campOptionsFor(['prep_bell', 'prep_draughts']), ['prep_draughts', 'prep_bell'], 'PREP_OPTION order');
    assert.throws(() => campOptionsFor(['prep_nothing']), /unknown option/);
  });

  test("1. GATE_TAG 'rr' marks the reroll-on arm; a cell naming the defaults has no mark", () => {
    assert.equal(GATE_TAG.campReroll, 'rr');
    const on = Object.fromEntries(Object.keys(GATE_DEFAULTS).filter((k) => GATE_DEFAULTS[k]).map((k) => [k, true]));
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', gates: on }), 'planner-P0');
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', gates: { ...on, campReroll: true } }), 'planner-P0-rr');
    // The sim's gate rule keeps the reroll off in a cell that names its gates without it.
    setGates(on);
    assert.equal(C.GATES.campReroll, false);
    setGates(null);
  });

  test("2. B42's vision perks are the camp's sight perks (C.PREP_CAMP_OPTIONS of kind 'vision')", () => {
    assert.deepEqual(EXP.B42_VISION_PERKS, C.PREP_CAMP_OPTIONS.filter((id) => C.PREP_OPTION[id].kind === 'vision'));
    assert.deepEqual(EXP.B42_VISION_PERKS, ['prep_charts', 'prep_tracker']);
    assert.equal(campRefusal('--prep-ban', EXP.B42_VISION_PERKS), null, 'the no-vision cell runs on the camp as built');
  });

  test('3. --prep-force / --prep-ban refuse an option outside the camp, with the camp list in the message, unless the cell opens it', () => {
    assert.deepEqual(OUTSIDE, ['prep_rations', 'prep_bell', 'prep_mule', 'prep_guide', 'prep_spyglass']);
    for (const id of OUTSIDE) {
      const why = campRefusal('--prep-force', [id, 'prep_draughts']);
      assert.match(why, new RegExp(`^--prep-force: ${id} not offered at the start camp \\(it offers prep_draughts, prep_ember, prep_charts, prep_tracker; D128\\)`));
      assert.match(why, /--camp-options all/);
      assert.equal(campRefusal('--prep-ban', [id], 'all'), null);
      assert.equal(campRefusal('--prep-ban', [id], [id]), null);
    }
    assert.equal(campRefusal('--prep-force', [...CAMP_DEFAULTS]), null);
    const run = (...a) => spawnSync(process.execPath, ['sim/run.mjs', '--bot', 'planner', '--class', 'rogue', '--runs', '1', '--workers', '1', '--map', 'expedition', '--prep', '--out', '/tmp/qa-sim-camp', ...a], { cwd: REPO, encoding: 'utf8' });
    const r = run('--prep-force', 'bell');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--prep-force: prep_bell not offered at the start camp/);
    const b = run('--prep-ban', 'guide,spyglass');
    assert.notEqual(b.status, 0);
    assert.match(b.stderr, /--prep-ban: prep_guide, prep_spyglass not offered at the start camp/);
    const c = run('--camp-options', 'draughts,nothing');
    assert.notEqual(c.status, 0);
    assert.match(c.stderr, /--camp-options: unknown option prep_nothing/);
  });

  test('4. the bots buy only the camp offers; the P0 speedrunner buys Field Draughts for the Clapper; --camp-options all restores the old camp', () => {
    // The speedrunner bought the Second Clapper first at P0 before D128; at PALL Swift Boots fill the Bell (no Clapper either way).
    const bots = [['planner', null, 'fresh'], ['planner', null, 'all'], ['greedy', null, 'fresh'], ['speedrunner', 'v11', 'all'], ['speedrunner', 'v11', 'fresh'], ['speedrunner', null, 'fresh']];
    let bell = 0;
    for (const [bot, variant, prof] of bots) for (const cls of ['rogue', 'hunter']) for (const seed of [1000, 1001]) {
      const cell = { bot, cls, prof, tree: 2, ...(variant ? { variant } : {}) };
      const r = camp(cell, seed);
      assert.ok(!r.err || r.err.startsWith('stuck'), `${bot} ${cls} ${seed}: ${r.err}`);
      for (const id of r.ct.bought) assert.ok(C.PREP_CAMP_OPTIONS.includes(id), `${bot} ${cls} ${seed} bought ${id}`);
      if (bot === 'speedrunner') {
        assert.ok(!r.ct.bought.includes('prep_bell'));
        assert.ok(r.ct.bought.includes('prep_draughts'));
        const all = camp({ ...cell, campOptions: 'all' }, seed);
        if (prof === 'fresh') { assert.ok(all.ct.bought.includes('prep_bell'), `${bot} ${cls} ${seed}: the Clapper with every option`); bell++; }
        assert.deepEqual([...C.PREP_CAMP_OPTIONS], C.PREP_OPTION_IDS, 'the cell plays every option');
      }
    }
    assert.ok(bell > 0, 'with every option offered the speedrunner buys the Second Clapper again');
    // The B40 random policy picks among the legal camp purchases only.
    for (const seed of [1000, 1001, 1002, 1003]) {
      const r = camp({ bot: 'planner', cls: 'mage', prof: 'fresh', tree: 1, prepPolicy: 'random' }, seed);
      for (const id of r.ct.bought) assert.ok(C.PREP_CAMP_OPTIONS.includes(id), `random ${seed} bought ${id}`);
    }
    // A forced option outside the camp is never bought (run.mjs refuses it; the policy skips it).
    const f = camp({ bot: 'planner', cls: 'rogue', prof: 'fresh', tree: 2, prepForce: ['prep_bell'] }, 1000);
    assert.ok(!f.ct.bought.includes('prep_bell'));
  });

  test('a plain cell plays the camp as built after a cell that opened it, and equals the cell naming the default list', () => {
    const cell = { bot: 'speedrunner', variant: 'v11', cls: 'hunter', prof: 'all', tree: 2 };
    camp({ ...cell, campOptions: 'all' }, 1002);
    const plain = camp(cell, 1002, 900);
    assert.deepEqual([...C.PREP_CAMP_OPTIONS], [...CAMP_DEFAULTS]);
    const named = camp({ ...cell, campOptions: [...CAMP_DEFAULTS] }, 1002, 900);
    assert.equal(plain.hash, named.hash);
    assert.equal(cellName({ ...cell, map: 'expedition', prep: true, campOptions: [...CAMP_DEFAULTS] }), cellName({ ...cell, map: 'expedition', prep: true }));
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', map: 'expedition', prep: true, campOptions: 'all' }), 'planner-P0-exp-prep-campall');
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', map: 'expedition', prep: true, campOptions: ['prep_draughts', 'prep_bell'] }), 'planner-P0-exp-prep-campdraughtsbell');
    setCampOptions(null);
  });
});
