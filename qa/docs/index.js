// Lets `node --test qa/docs/` run every documentation test file (Node 22 resolves a directory argument to its
// index.js). Equivalent: node --test qa/docs/*.test.mjs
import { readdirSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.mjs')).sort()) await import(new URL(f, dir));
