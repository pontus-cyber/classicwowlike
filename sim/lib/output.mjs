// Output helpers: commit hash, cell names (M2b v12: 'rcg' for the gated Ricochet Bolt arm; C.GATES tags, GATE_TAG; D128:
// the start camp's options, campMark),
// JSON/JSONL/Markdown writers, number formatting.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileLabel } from './profiles.mjs';
import { C, GATE_DEFAULTS, gatesFor, CAMP_DEFAULTS, campOptionsFor } from './engine.mjs';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Cell-name tags of the C.GATES switches: 'g5' RARE_HP_MULT_Z1 (M2b v13 row 5), 'g6' first meeting (v13 row 6), 'sap'
 * rule H, the wait after Sap (M2b v14 row 1 (a), sapHold), 'pst' a PASS keeps STEALTH (v14 row 1 (b), passStealth),
 * 'swift' the Swift passage (M2b v15 row 2, swiftRoad; off by default since D126, so the passage-on arm is '-swift'), 'rr'
 * the start camp's reroll (D128, campReroll; off by default, so the reroll-on arm is '-rr'); a switch without a tag is
 * marked by its key. (M2b v15's mawgrimHp switch and its 'maw' tag are gone: D126 put Mawgrim's 0.95 in content.)
 */
export const GATE_TAG = { rareHpMultZ1: 'g5', firstMeetWindup: 'g6', sapHold: 'sap', passStealth: 'pst', swiftRoad: 'swift', campReroll: 'rr' };

/**
 * Cell-name mark of the start camp's options (D128, cell.campOptions): none when the cell plays the engine's list
 * (CAMP_DEFAULTS), 'campall' when it offers every option (the camp before D128), else 'camp' and the ids' short names.
 */
export function campMark(campOptions = null) {
  if (!campOptions) return null;
  const ids = campOptionsFor(campOptions);
  if (ids.join() === CAMP_DEFAULTS.join()) return null;
  if (ids.length === Object.keys(C.PREP_OPTION).length) return 'campall';
  return `camp${ids.map((id) => id.replace(/^prep_/, '')).join('')}`;
}

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
  const camp = campMark(cell.campOptions);
  if (camp) parts.push(camp);
  if (cell.metaDrop) parts.push(`drop${cell.metaDrop.map((id) => id.replace(/_/g, '').slice(0, 4)).join('')}`);
  if (cell.beastcallGated) parts.push('bcg');
  if (cell.ricochetGated) parts.push('rcg');
  // C.GATES switches (M2b v13-v14): every switch the cell plays at another value than the engine's default, `<tag>` when
  // on and `no<tag>` when off (GATE_TAG); a cell that names no gates plays the defaults and has no mark.
  for (const [k, on] of Object.entries(gatesFor(cell.gates) || {})) if (on !== GATE_DEFAULTS[k]) parts.push(`${on ? '' : 'no'}${GATE_TAG[k] || k}`);
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
