// docs/ARCHITECTURE.md lists every .js/.mjs file under src/, sim/ and tools/, and only files that exist.
// File rows are table rows whose first cell is a backticked path. Rows ending in "/" (qa folders) must be directories.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIRS = ['src', 'sim', 'tools'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'out' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(name)) out.push(relative(ROOT, p).split(sep).join('/'));
  }
  return out;
}

const doc = readFileSync(join(ROOT, 'docs', 'ARCHITECTURE.md'), 'utf8');
const listed = [...doc.matchAll(/^\|\s*`([^`\s|]+)`\s*\|/gm)].map((m) => m[1]);
const actual = DIRS.filter((d) => existsSync(join(ROOT, d))).flatMap((d) => walk(join(ROOT, d)));

test('every code file under src/, sim/ and tools/ is in the ARCHITECTURE.md file table', () => {
  const missing = actual.filter((f) => !listed.includes(f)).sort();
  assert.deepEqual(missing, [], `add these files to docs/ARCHITECTURE.md section 2:\n  ${missing.join('\n  ')}`);
});

test('every path in the ARCHITECTURE.md file table exists', () => {
  const gone = listed.filter((p) => /^(src|sim|tools|qa)\//.test(p)).filter((p) => !existsSync(join(ROOT, p))).sort();
  assert.deepEqual(gone, [], `these listed paths do not exist:\n  ${gone.join('\n  ')}`);
});

test('qa/ rows ending in "/" are directories and no path is listed twice', () => {
  for (const p of listed.filter((x) => x.endsWith('/'))) assert.ok(statSync(join(ROOT, p)).isDirectory(), p);
  const dup = listed.filter((p, i) => listed.indexOf(p) !== i);
  assert.deepEqual(dup, [], `listed twice: ${dup.join(', ')}`);
});
