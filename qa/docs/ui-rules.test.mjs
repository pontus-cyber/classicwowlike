// UI layer rules of docs/reviews/ui-architecture-2026-11-12.md, section 4 (draft), that a script can check.
// U6 (Track R5): art modules stay leaves. Every src/ui/art-*.js imports only ./util.js and ./theme.js (static imports,
// re-exports, dynamic import() and require()), so the art work and the feature work never share a file through an import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI = fileURLToPath(new URL('../../src/ui/', import.meta.url));
const ART_ALLOWED = new Set(['./util.js', './theme.js']);
const ART = readdirSync(UI).filter((f) => /^art-[\w-]+\.js$/.test(f)).sort();

/** The module specifiers a file names (comments removed first): import/export ... from 'x', import 'x', import(x), require(x). */
function specifiers(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const out = [];
  for (const m of code.matchAll(/\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of code.matchAll(/\b(?:import|require)\s*\(\s*([^)]*)\)/g)) out.push(m[1].trim().replace(/^['"`]|['"`]$/g, ''));
  return out;
}

test('U6: the art modules are there (actors, fx, icons, props, world)', () => {
  for (const f of ['art-actors.js', 'art-fx.js', 'art-icons.js', 'art-props.js', 'art-world.js']) assert.ok(ART.includes(f), `src/ui/${f} missing`);
});

test('U6: every src/ui/art-*.js imports only ./util.js and ./theme.js', () => {
  const bad = [];
  for (const f of ART) {
    const specs = specifiers(readFileSync(join(UI, f), 'utf8'));
    assert.ok(specs.length > 0, `${f}: no import found (it draws with util.js; is the parser broken?)`);
    for (const s of specs) if (!ART_ALLOWED.has(s)) bad.push(`${f} imports ${s}`);
  }
  assert.deepEqual(bad, [], `art modules may import only ./util.js and ./theme.js (rule U6):\n  ${bad.join('\n  ')}`);
});

test('U6: the import scan sees the forms it must catch', () => {
  const s = specifiers(`import a from './a.js';\nimport { b,\n c } from "./b.js";\nimport './c.js';\nexport { d } from './d.js';\nexport * from './e.js';
const f = await import('./f.js'); // import x from './commented.js'\n/* import y from './block.js' */ export const g = 1;`);
  assert.deepEqual(s, ['./a.js', './b.js', './c.js', './d.js', './e.js', './f.js']);
});
