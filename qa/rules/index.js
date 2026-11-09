// Lets `node --test qa/rules/` run every QA rule test file: Node 22 resolves a directory argument to its
// index.js. Equivalent: node --test qa/rules/*.test.mjs
import { readdirSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.mjs')).sort()) await import(new URL(f, dir));
