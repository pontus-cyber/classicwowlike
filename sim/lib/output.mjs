// Output helpers: commit hash, cell names (M2b v12: 'rcg' for the gated Ricochet Bolt arm), JSON/JSONL/Markdown writers,
// number formatting.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileLabel } from './profiles.mjs';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Short commit hash of the repository, with "+dirty" when tracked files under src/ or sim/ have changes. */
export function commitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain -- src sim', { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return dirty ? `${hash}+dirty` : hash;
  } catch {
    return 'unknown';
  }
}

export function cellName(cell) {
  const parts = [cell.bot, profileLabel(cell.prof)];
  if (cell.tree !== undefined && cell.tree !== null && cell.treeTag) parts.push(`tree${cell.tree}`);
  if (cell.style && cell.style !== 'balanced') parts.push(cell.style);
  if (cell.variant) parts.push(cell.variant);
  if (cell.pet) parts.push(cell.pet);
  if (cell.map === 'expedition') parts.push('exp');
  if (cell.prep) parts.push(cell.prepPolicy ? `prep${cell.prepPolicy}` : 'prep');
  if (cell.prepForce) parts.push(`force${cell.prepForce.map((id) => id.replace(/^prep_/, '')).join('')}`);
  if (cell.prepBan) parts.push(`ban${cell.prepBan.map((id) => id.replace(/^prep_/, '')).join('')}`);
  if (cell.metaDrop) parts.push(`drop${cell.metaDrop.map((id) => id.replace(/_/g, '').slice(0, 4)).join('')}`);
  if (cell.beastcallGated) parts.push('bcg');
  if (cell.ricochetGated) parts.push('rcg');
  // M2b v13 gated rows: 'g5' RARE_HP_MULT_Z1 (C.GATES.rareHpMultZ1), 'g6' first meeting (C.GATES.firstMeetWindup).
  if (cell.gates && cell.gates.rareHpMultZ1) parts.push('g5');
  if (cell.gates && cell.gates.firstMeetWindup) parts.push('g6');
  if (cell.expMeta) parts.push(`meta${Object.keys(cell.expMeta).map((k) => k.slice(0, 2)).join('')}`);
  if (cell.vision) parts.push(`vis${Object.keys(cell.vision).map((k) => k[0]).join('')}`);
  if (cell.dimming === false) parts.push('nodim');
  if (cell.oracle) parts.push('oracle');
  if (cell.route) parts.push('route');
  return parts.join('-');
}

export function ensureDir(d) {
  mkdirSync(d, { recursive: true });
  return d;
}

export function writeJson(file, obj) {
  ensureDir(dirname(file));
  writeFileSync(file, `${JSON.stringify(obj, null, 1)}\n`);
}

export function writeJsonl(file, rows) {
  ensureDir(dirname(file));
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

export function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// ---------------- Formatting ----------------
export const pct = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : `${(x * 100).toFixed(d)} %`);
export const num = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : Number(x).toFixed(d));
export const ci = (c, f = pct) => (!c || c[0] === null || c[0] === undefined ? '' : `${f(c[0])} - ${f(c[1])}`);
export const rateCell = (r) => (r && r.n ? `${pct(r.p)} (${r.k}/${r.n}; ${ci(r.ci)})` : 'n/a (0 runs)');
export const medCell = (m, d = 1) => (m && m.n ? `${num(m.v, d)} (${ci(m.ci, (x) => num(x, d))}; n=${m.n})` : 'n/a');

export function table(head, rows) {
  const out = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  return out.join('\n');
}
