#!/usr/bin/env node
// Legacy phase 1 sim driver (legacy.md 5.8 items 1-2, 6.1; report legacy-calibration-2026-11-17): plays cells at a
// fixed hero level on a scratch engine built by sim/legacy-patch.py (zones at the hero's level, arm T2 of legacy.md
// 6.3 by default). Each hero level is one child process, since the scratch engine reads LEG at module load.
//
//   node sim/legacy-run.mjs build --scratch <dir>
//        copies src/ and sim/ (without sim/out) to <dir> and applies sim/legacy-patch.py (refuses a path without /scratch)
//   node sim/legacy-run.mjs warm --scratch <dir> --band 1-5 --out <dir> [--runs 30] [--rounds 2] [--table <file>]
//        warms the planner's risk table for one hero-level band: a chain of cells, round by round over every hero
//        level of the band, each cell starting from the previous cell's observations (the first from RISK_PRIOR);
//        seeds SIM.WARMUP_SEED_BASE + 100 000 × round + 1 000 × H. The last cell's risk.json is the band table.
//   node sim/legacy-run.mjs grid --scratch <dir> --levels 1-25 --tables <dir> --out <dir> [--runs 40] [--seed 1000]
//        one planner cell per hero level, each read with the table of its band (<tables>/risk-H<lo>-<hi>.json)
//   common: --leg '<json>' (fields over the T2 defaults, sim/legacy-patch.py), --classes rogue,mage,hunter,
//           --workers N (default 2), --profile later (a profile that has played two runs, nothing bought),
//           --tree N (talent tree index for every class, B7 cells; default the recorded default trees),
//           --bot <id> (default planner; e.g. onebutton) (designer, report legacy-oruvath-2026-11-18)
//   --native (Legacy phase 1 engine, D154; in place of --scratch): each cell plays the repository's engine with
//           C.GATES.legacy on (sim/run.mjs --hero H): the hero's level, XP curve, zones, Oruvath and kit as built (no --leg
//           arms). The scratch patch targets the engine before the switch (5d3571a) and does not apply to it.
//           --oruvath (with --native; D156, legacy.md 2.4.1): C.GATES.oruvathLegacy on as well.
//           --econ (with --native; D159, legacy.md 4.7 Economy v2): C.GATES.economyV2 on as well.
//   --levels takes a range (1-25) or a list (1,10,20).
//   --resume (warm, grid): a cell whose output already holds summary.md (written last) is kept and not played again, so a stopped
//           batch picks up at its first missing cell (same seeds, same results).
// Every cell: expedition map with the start camp (D118: --map expedition --prep), planner, --warmup 0.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const HERO_MAX_LEVEL = 25;
export const MAX_LEVEL = 60;
/** legacy.md 1.2: POWER_OF_LEVEL[H]. */
export const powerOf = (h) => Math.round(1 + ((h - 1) * (MAX_LEVEL - 1)) / (HERO_MAX_LEVEL - 1));
/** Hero-level bands of the report. */
export const BANDS = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25]];
export const bandOf = (h) => BANDS.find(([lo, hi]) => h >= lo && h <= hi);
/** Arm T2 (legacy.md 2.2, 2.4, 10): ZONE_TIER, BOSS_TIER, ZONE_TIER_DMG, the Oruvath HP factor by hero level. */
export const T2 = {
  tier: [-2, -1, 0, 1, 2, 3],
  boss: 5,
  tdmg: [1.25, 1.3, 1.35, 1.4, 1.45, 1.5],
  bhp: Array.from({ length: HERO_MAX_LEVEL }, (_, i) => Math.round(Math.min(1, 0.4 + 0.024 * (i + 1)) * 1000) / 1000),
};
const WARMUP_SEED_BASE = 9000000;

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--native' || argv[i] === '--oruvath' || argv[i] === '--econ' || argv[i] === '--resume') o[argv[i].slice(2)] = true; // the flags without a value
    else if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
    else o._.push(argv[i]);
  }
  return o;
}
const range = (s) => {
  if (s.includes(',')) return s.split(',').map(Number);
  const [a, b] = s.split('-').map(Number);
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
};

/** --resume: the finished cell directory under out (one with summary.md), or null. */
function done(out, bot) {
  if (!existsSync(out)) return null;
  const sub = readdirSync(out).find((d) => d.startsWith(`${bot || 'planner'}-`));
  return sub && existsSync(join(out, sub, 'summary.md')) ? join(out, sub) : null; // written last
}

function cell({ scratch, native, oruvath, econ, h, leg, out, runs, seed, riskIn, classes, workers, profile, tree, bot }) {
  const LEG = JSON.stringify({ ...T2, ...leg, P: powerOf(h) });
  const args = ['sim/run.mjs', '--bot', bot || 'planner', '--class', classes, '--runs', String(runs), '--seed-start', String(seed),
    '--warmup', '0', '--workers', String(workers), '--profile', profile, '--map', 'expedition', '--prep', '--out', resolve(out)];
  if (riskIn) args.push('--risk-in', resolve(riskIn));
  if (tree !== undefined) args.push('--tree', String(tree));
  if (native) args.push('--hero', String(h));
  if (native && oruvath) args.push('--oruvath');
  if (native && econ) args.push('--econ');
  const env = { ...process.env };
  if (native) delete env.LEG; else env.LEG = LEG;
  const r = spawnSync('node', args, { cwd: native ? ROOT : scratch, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`cell H${h} failed:\n${r.stderr.slice(-3000)}`);
  const sub = readdirSync(out).find((d) => d.startsWith(`${bot || 'planner'}-`));
  const lines = r.stdout.split('\n').filter((l) => / win /.test(l));
  process.stdout.write(lines.map((l) => `H${h} ${l}`).join('\n') + '\n');
  return join(out, sub);
}

const a = parse(process.argv.slice(2));
const cmd = a._[0];
const scratch = a.scratch ? resolve(a.scratch) : null;
const leg = a.leg ? JSON.parse(a.leg) : {};
const native = a.native === true;
if (a.oruvath && !native) throw new Error('--oruvath needs --native');
if (a.econ && !native) throw new Error('--econ needs --native');
if (native && a.leg) throw new Error('--native plays the engine as built: no --leg arms');
const common = { classes: a.classes || 'all', workers: Number(a.workers || 2), profile: a.profile || 'later', leg, scratch, native, oruvath: a.oruvath === true, econ: a.econ === true, tree: a.tree, bot: a.bot };

if (cmd === 'build') {
  if (!scratch || !scratch.includes('/scratch')) throw new Error('--scratch must name a path with /scratch');
  const K = await import(join(ROOT, 'src', 'constants.js'));
  if (K.GATES && 'legacy' in K.GATES) throw new Error('this engine plays Legacy itself (C.GATES.legacy, D154 phase 1): use grid / warm --native; the scratch patch applies to the engine before it (5d3571a)');
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(join(scratch, 'sim', 'out'), { recursive: true });
  cpSync(join(ROOT, 'src'), join(scratch, 'src'), { recursive: true });
  for (const f of readdirSync(join(ROOT, 'sim'))) if (f !== 'out') cpSync(join(ROOT, 'sim', f), join(scratch, 'sim', f), { recursive: true });
  const r = spawnSync('python3', [join(ROOT, 'sim', 'legacy-patch.py'), scratch], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  console.log(r.stdout.trim());
} else if (cmd === 'warm') {
  const [lo, hi] = a.band.split('-').map(Number);
  const runs = Number(a.runs || 30);
  const rounds = Number(a.rounds || 2);
  let riskIn = null;
  for (let k = 0; k < rounds; k++) {
    for (let h = lo; h <= hi; h++) {
      const out = join(a.out, `r${k + 1}-H${h}`);
      const kept = a.resume ? done(out, a.bot) : null;
      if (kept) { console.log(`H${h} round ${k + 1}: kept ${kept}`); riskIn = join(kept, 'risk.json'); continue; }
      rmSync(out, { recursive: true, force: true });
      const dir = cell({ ...common, h, out, runs, seed: WARMUP_SEED_BASE + 100000 * k + 1000 * h, riskIn });
      riskIn = join(dir, 'risk.json');
    }
  }
  if (a.table) { mkdirSync(dirname(a.table), { recursive: true }); copyFileSync(riskIn, a.table); console.log(`table ${a.table}`); }
} else if (cmd === 'grid') {
  for (const h of range(a.levels || '1-25')) {
    const [lo, hi] = bandOf(h);
    const table = join(a.tables, `risk-H${String(lo).padStart(2, '0')}-${String(hi).padStart(2, '0')}.json`);
    if (!existsSync(table)) throw new Error(`no table ${table}`);
    const out = join(a.out, `H${String(h).padStart(2, '0')}`);
    if (a.resume && done(out, a.bot)) { console.log(`H${h}: kept`); continue; }
    rmSync(out, { recursive: true, force: true });
    cell({ ...common, h, out, runs: Number(a.runs || 40), seed: Number(a.seed || 1000), riskIn: table });
  }
} else {
  console.log('usage: node sim/legacy-run.mjs build|warm|grid ... (see the header)');
}
