// sim/lib/params.mjs BAL equals the constant table of docs/specs/balance.md section 6 (no drift).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BAL } from '../../sim/lib/params.mjs';

const md = readFileSync(new URL('../../docs/specs/balance.md', import.meta.url), 'utf8');

function specTable() {
  const sec = md.slice(md.indexOf('## 6. Constant table'));
  const out = {};
  for (const line of sec.split('\n')) {
    const m = line.match(/^\| ([A-Z0-9_]+) \| ([^|]+) \|/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function parseCell(name, v) {
  if (name === 'RISK_PRIOR') {
    const o = {};
    for (const part of v.split(',')) {
      const m = part.trim().match(/^(\w+) ([\d.]+)/);
      o[m[1]] = Number(m[2]);
    }
    return o;
  }
  const range = v.match(/^([\d.]+)-([\d.]+)$/);
  if (range) return [Number(range[1]), Number(range[2])];
  return Number(v);
}

test('every balance.md section 6 constant is in BAL with the same value, and nothing else', () => {
  const spec = specTable();
  assert.ok(Object.keys(spec).length > 80);
  for (const [k, v] of Object.entries(spec)) assert.deepEqual(BAL[k], parseCell(k, v), k);
  for (const k of Object.keys(BAL)) assert.ok(k in spec, `${k} is not in balance.md section 6`);
});
