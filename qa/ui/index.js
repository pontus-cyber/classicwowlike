// Lets `node --test qa/ui/` run every UI unit test file (Node 22 resolves a directory argument to its index.js).
// Equivalent: node --test qa/ui/*.test.mjs
import { readdirSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.mjs')).sort()) await import(new URL(f, dir));
