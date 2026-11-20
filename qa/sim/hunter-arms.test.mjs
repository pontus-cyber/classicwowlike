// Draft (report legacy-hunter-dungeon-2026-11-20): the arm statistics (B6, paired difference) and the guards of
// sim/hunter-arms.sh (a scratch copy only; unknown arms refused; every arm's edit matches exactly once on the current tree).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { b6, pairDiff, stat } from '../../sim/armstats.mjs';

const SH = new URL('../../sim/hunter-arms.sh', import.meta.url).pathname;
const run = (arm, dir) => spawnSync('bash', [SH, arm, dir], { encoding: 'utf8' });

describe('armstats', () => {
  test('B6 is the spread and the largest distance from the mean', () => {
    const r = b6([73.8, 70.2, 81.8]);
    assert.ok(Math.abs(r.spread - 11.6) < 1e-9);
    assert.ok(Math.abs(r.maxDev - (81.8 - (73.8 + 70.2 + 81.8) / 3)) < 1e-9);
  });
  test('paired difference counts only the seeds both arms hold', () => {
    const a = new Map([[1, { out: 'v' }], [2, { out: 'd' }], [3, { out: 'd' }]]);
    const b = new Map([[2, { out: 'v' }], [3, { out: 'd' }], [4, { out: 'v' }]]);
    const p = pairDiff(a, b);
    assert.equal(p.n, 2);
    assert.ok(Math.abs(p.diff - 50) < 1e-9);
  });
  test('stat reports the win rate and the boss-fight win rate', () => {
    const m = new Map([[1, { out: 'v', boss: {}, dungeons: 2 }], [2, { out: 'd', boss: {}, dungeons: 0 }], [3, { out: 'd', dungeons: 1 }], [4, { out: 'v', boss: {}, dungeons: 1 }]]);
    const s = stat(m);
    assert.equal(s.win, 50);
    assert.ok(Math.abs(s.bossWin - 200 / 3) < 1e-9);
    assert.equal(s.dungeons, 1);
  });
});

describe('sim/hunter-arms.sh', () => {
  test('refuses a path outside a scratch directory and an unknown arm', () => {
    assert.notEqual(run('base', tmpdir()).status, 0);
    const d = mkdtempSync(join(tmpdir(), 'scratch-arm-'));
    try {
      const r = run('nosucharm', d);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /unknown arm/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test('the Ferocity and Keen Shot arms edit the scratch copy and leave src/ alone', () => {
    const d = mkdtempSync(join(tmpdir(), 'scratch-arm-'));
    try {
      const r = run('ksb+fer60', d);
      assert.equal(r.status, 0, r.stderr);
      assert.match(readFileSync(join(d, 'src/constants.js'), 'utf8'), /h_a2: \{ petDmgPct: 0\.06 \}/);
      assert.match(readFileSync(join(d, 'src/engine/spells.js'), 'utf8'), /multi: 0\.3/);
      assert.doesNotMatch(readFileSync(new URL('../../src/constants.js', import.meta.url), 'utf8'), /petDmgPct: 0\.06 \}/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
