// Batch results are reproducible for the same seeds: in one thread or across worker threads, and with the
// death-risk table refreshed in fixed seed blocks (sim/lib/batch.mjs). Also B35 replay and the risk table.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from '../../sim/lib/pool.mjs';
import { runCell } from '../../sim/lib/batch.mjs';
import { playRun, replayHash } from '../../sim/lib/runner.mjs';
import { newObs, addEntry, buildTable, riskP, priorTable } from '../../sim/lib/risk.mjs';
import { SIM } from '../../sim/lib/params.mjs';

const strip = (recs) => recs.map((r) => { const { ms, ...rest } = r; return JSON.stringify(rest); });

describe('batch reproducibility', () => {
  const pool = new Pool(2);
  after(() => pool.close());
  const cell = { bot: 'planner', cls: 'rogue', prof: 'fresh', tree: 0, style: null, variant: null, pet: null };

  test('same seeds give identical records in one thread and on 2 workers, with risk refreshes every 6 runs', async () => {
    const a = await runCell(null, cell, { runs: 18, seedStart: 500, refresh: 6, taskRuns: 4 });
    const b = await runCell(pool, cell, { runs: 18, seedStart: 500, refresh: 6, taskRuns: 4 });
    const c = await runCell(pool, cell, { runs: 18, seedStart: 500, refresh: 6, taskRuns: 3 });
    assert.deepEqual(strip(a.records), strip(b.records));
    assert.deepEqual(strip(a.records), strip(c.records));
    assert.deepEqual(a.obs, b.obs);
    assert.deepEqual(a.records.map((r) => r.seed), Array.from({ length: 18 }, (_, i) => 500 + i));
  });

  test('a run is a pure function of (cell, seed, risk table)', () => {
    const t = priorTable();
    for (const bot of ['random', 'greedy', 'speedrunner']) {
      const x = playRun({ ...cell, bot, cls: 'hunter' }, 77, t);
      const y = playRun({ ...cell, bot, cls: 'hunter' }, 77, t);
      assert.deepEqual(strip([x]), strip([y]));
    }
  });

  test('B35: replaying the action log with the pure step gives the same final state hash', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const c = { ...cell, bot: 'random', cls };
      const r = playRun(c, 123, null, { log: true, hash: true });
      assert.equal(replayHash(c, 123, r.log), r.hash);
    }
  });
});

describe('risk table (balance.md 1.1)', () => {
  test('starts at RISK_PRIOR and learns from entries; P(death) is monotone in CL - L and HP', () => {
    const t0 = priorTable();
    assert.equal(riskP(t0, 'quest2', 0, 1), SIM.RISK_PRIOR.quest);
    assert.equal(riskP(t0, 'dungeon', 3, 1), SIM.RISK_PRIOR.dungeon);
    const obs = newObs();
    // 20 deaths in 20 dungeon entries at dl +4, full HP
    for (let i = 0; i < 20; i++) addEntry(obs, [6, 4, 100, 1, 0]);
    const t = buildTable(obs);
    assert.ok(riskP(t, 'dungeon', 4, 1) > 0.5);
    assert.ok(riskP(t, 'dungeon', 6, 1) >= riskP(t, 'dungeon', 4, 1), 'harder content is never safer');
    assert.equal(riskP(t, 'dungeon', 0, 1), SIM.RISK_PRIOR.dungeon, 'unseen easier cells keep the prior');
    assert.ok(riskP(t, 'dungeon', 4, 0.1) >= riskP(t, 'dungeon', 4, 1), 'lower HP is never safer');
  });
});
