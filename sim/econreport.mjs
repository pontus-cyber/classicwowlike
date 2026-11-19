#!/usr/bin/env node
// Economy v2 payout curve (D159; docs/specs/legacy.md 4.7 E5; build check of handoff engine-2026-11-19c): reads the hero
// cells of `sim/legacy-run.mjs grid --native --oruvath --econ` and prints, per hero level, Legacy points a run (per class
// and pooled), hero XP a run and manual minutes, against the designer's v2 curve (legacy.md 4.7 E5, measured on scratch
// arm V2); then the campaign chained by run as 4.7 E5 does (each run pays the cell values at its start level, linear
// between the measured levels; the welcome LEGACY_WELCOME in run 1; HERO_XP_ECON2), against the hall (account wing 1 640 at
// hero 20, the whole hall 2 340 at 25: LE3, HALL_PACE_TOL). Exit code 1 when a pooled level is off the designer's value by
// more than --tol (default 0.10) or LE3 fails.
//
//   node sim/econreport.mjs <grid out dir> [--tol 0.10]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { C } from './lib/engine.mjs';

/** legacy.md 4.7 E5: Legacy a run by start hero level 1-25 (designer, v2, planner, 180 runs a level). */
export const DESIGNER_V2 = [164, 182, 206, 189, 196, 243, 259, 243, 242, 242, 272, 273, 276, 259, 269, 257, 257, 256, 245, 246, 250, 245, 261, 274, 284];
/** legacy.md 4.7 E5 and LE3: the account wing (with one class's techniques) and the whole hall for one hero. */
export const ACCOUNT_WING = 1640;
export const HALL = 2340;
export const HALL_PACE_TOL = 0.15;

const CLASSES = ['rogue', 'mage', 'hunter'];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

/** Per hero level: { H, n, ech { cls, pooled }, xp, min } from the cell directories <dir>/H<NN>/planner-*. */
export function readGrid(dir) {
  const out = [];
  for (const d of readdirSync(dir).filter((x) => /^H\d+$/.test(x)).sort()) {
    const H = Number(d.slice(1));
    const sub = readdirSync(join(dir, d)).find((x) => x.startsWith('planner-'));
    if (!sub) continue;
    const runs = {};
    for (const c of CLASSES) {
      const f = join(dir, d, sub, `runs-${c}.jsonl`);
      if (existsSync(f)) runs[c] = readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    }
    const all = Object.values(runs).flat();
    const xpOf = (r) => (r.ct ? r.ct.xp : NaN); // the run's hero XP (state.stats.xpGained; recorder `ct.xp`)
    out.push({
      H, n: all.length,
      ech: { ...Object.fromEntries(Object.entries(runs).map(([c, rs]) => [c, mean(rs.map((r) => r.ech))])), pooled: mean(all.map((r) => r.ech)) },
      xp: mean(all.map(xpOf)), min: mean(all.map((r) => r.min[0])),
    });
  }
  return out;
}

/** Linear between the measured levels (flat outside them). */
function interp(rows, key, H) {
  const at = (r) => (key === 'ech' ? r.ech.pooled : r[key]);
  if (H <= rows[0].H) return at(rows[0]);
  if (H >= rows[rows.length - 1].H) return at(rows[rows.length - 1]);
  const i = rows.findIndex((r) => r.H >= H);
  const a = rows[i - 1];
  const b = rows[i];
  return at(a) + ((at(b) - at(a)) * (H - a.H)) / (b.H - a.H);
}

/** The campaign of legacy.md 4.7 E5 chained on the cells: runs until hero 25, each at its start level. */
export function chain(rows, maxRuns = 12) {
  const T = C.HERO_XP_ECON2;
  let H = 1;
  let xp = 0;
  let cum = 0;
  let hours = 0;
  const out = [];
  for (let k = 1; k <= maxRuns && H < C.HERO_MAX_LEVEL; k++) {
    const start = H;
    const leg = interp(rows, 'ech', start) + (k === 1 ? C.LEGACY_WELCOME : 0);
    xp += interp(rows, 'xp', start);
    while (H < C.HERO_MAX_LEVEL && xp >= T[H - 1]) { xp -= T[H - 1]; H += 1; }
    if (H >= C.HERO_MAX_LEVEL) xp = 0;
    cum += leg;
    hours += interp(rows, 'min', start) / 60;
    out.push({ run: k, start, end: H + (H < C.HERO_MAX_LEVEL ? xp / T[H - 1] : 0), hours, legacy: leg, cum });
  }
  return out;
}

const isMain = process.argv[1] && process.argv[1].endsWith('econreport.mjs');
if (isMain) {
  const dir = process.argv[2];
  const tolArg = process.argv.indexOf('--tol');
  const tol = tolArg > 0 ? Number(process.argv[tolArg + 1]) : 0.10;
  if (!dir) { console.log('usage: node sim/econreport.mjs <grid out dir> [--tol 0.10]'); process.exit(2); }
  const rows = readGrid(dir);
  let ok = true;
  console.log('| Hero level | Runs | Rogue | Mage | Hunter | Pooled | Designer v2 | Diff | Hero XP a run | Minutes |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const want = DESIGNER_V2[r.H - 1];
    const diff = r.ech.pooled / want - 1;
    if (Math.abs(diff) > tol) ok = false;
    const f = (x) => (Number.isFinite(x) ? x.toFixed(0) : '-');
    console.log(`| ${r.H} | ${r.n} | ${f(r.ech.rogue)} | ${f(r.ech.mage)} | ${f(r.ech.hunter)} | ${f(r.ech.pooled)} | ${want} | ${(diff * 100).toFixed(1)} % | ${f(r.xp)} | ${r.min.toFixed(1)} |`);
  }
  console.log('');
  console.log('| Run | Hero start -> end | Hours | Legacy this run | Cumulative |');
  console.log('|---|---|---|---|---|');
  const runs = chain(rows);
  for (const c of runs) console.log(`| ${c.run} | ${c.start} -> ${c.end.toFixed(1)} | ${c.hours.toFixed(2)} | ${c.legacy.toFixed(0)} | ${c.cum.toFixed(0)} |`);
  // LE3: cumulative at the run that reaches hero 20 against the account wing, at 25 against the hall
  const at20 = runs.find((c) => c.end >= 20);
  const at25 = runs.find((c) => c.end >= 25);
  const le3 = (c, want) => (c ? c.cum / want - 1 : NaN);
  const a = le3(at20, ACCOUNT_WING);
  const b = le3(at25, HALL);
  console.log('');
  console.log(`LE3: at hero 20 ${at20 ? at20.cum.toFixed(0) : '-'} against ${ACCOUNT_WING} (${(a * 100).toFixed(1)} %), at hero 25 ${at25 ? at25.cum.toFixed(0) : '-'} against ${HALL} (${(b * 100).toFixed(1)} %), tolerance ±${HALL_PACE_TOL * 100} %`);
  if (!(Math.abs(a) <= HALL_PACE_TOL && Math.abs(b) <= HALL_PACE_TOL)) ok = false;
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
}
