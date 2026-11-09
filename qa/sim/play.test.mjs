// sim/play.mjs: scripted play gives a readable transcript; the same script gives the same transcript.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PLAY = new URL('../../sim/play.mjs', import.meta.url).pathname;

test('scripted run: numbered actions, raw JSON, auto and bot commands, transcript with the result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'simplay-'));
  const script = join(dir, 'run.txt');
  writeFileSync(script, ['# start', '{"type":"START_RUN"}', 'auto 3', '4', 'bot planner 40', ''].join('\n'));
  const args = [PLAY, '--class', 'mage', '--seed', '42', '--script', script, '--finish', 'bot:planner'];
  const a = execFileSync(process.execPath, args, { encoding: 'utf8' });
  const b = execFileSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(a, b, 'same script, same transcript');
  assert.match(a, /# Run: mage, seed 42/);
  assert.match(a, /Actions:\n {2}1\. /);
  assert.match(a, /== Zone 1 /);
  assert.match(a, /> \(planner\) /);
  assert.match(a, /Result: (victory|death) at level \d+/);
});

test('interactive mode reads numbered choices from stdin', () => {
  const out = execFileSync(process.execPath, [PLAY, '--class', 'rogue', '--seed', '1'], { input: '4\nquit\n', encoding: 'utf8' });
  assert.match(out, /Create a character: class rogue/);
  assert.match(out, /> START_RUN/);
  assert.match(out, /Rogue L1/);
});
