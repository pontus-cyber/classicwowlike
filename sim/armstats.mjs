#!/usr/bin/env node
// Arm statistics of the Hunter dungeon report (docs/reports/legacy-hunter-dungeon-2026-11-20.md): reads the cells that
// `legacy-run.mjs grid` wrote (runs-<class>.jsonl under <dir>/H<level>/planner-*), joins directories and seed ranges, and
// prints win rate per class, B6 (spread, largest distance from the mean), dungeons a run, boss-fight win rate, and the paired
// difference to the first arm (same seeds, ± one standard error).
//
//   node sim/armstats.mjs --level 25 base=/tmp/a/v3d+/tmp/b/v3d-ext@9000-10199 nomark=/tmp/c/nomark@9000-9299 ...
//     <label>=<dir>[+<dir>...][@<seed lo>-<seed hi>]   the first label is the reference of the paired differences
//   --level N   hero level (default 25)    --classes rogue,mage,hunter (default all three)
//   --others <dir>[+<dir>...][@lo-hi]   with --classes hunter: the Rogue and Mage of that cell (a Hunter-only change leaves them as
//     they were), so the table also gives B6; the seeds are those of the Hunter's arm
import { readdirSync, readFileSync, existsSync } from 'node:fs';

/** Runs of one class at one hero level from the directories, by seed (a later directory does not overwrite an earlier seed). */
export function loadRuns(dirs, level, cls, lo = 0, hi = Infinity) {
  const out = new Map();
  for (const dir of dirs) {
    const base = `${dir}/H${String(level).padStart(2, '0')}`;
    const alt = `${dir}/H${level}`;
    const root = existsSync(base) ? base : alt;
    if (!existsSync(root)) continue;
    const sub = readdirSync(root).find((d) => d.startsWith('planner'));
    const f = sub && `${root}/${sub}/runs-${cls}.jsonl`;
    if (!f || !existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').trim().split('\n')) {
      const r = JSON.parse(line);
      if (r.seed >= lo && r.seed <= hi && !out.has(r.seed)) out.set(r.seed, r);
    }
  }
  return out;
}

const won = (r) => (r.out === 'v' ? 1 : 0);

/** Win rate (%), its standard error, runs, mean dungeons a run, win rate of the runs that reached the boss. */
export function stat(m) {
  const a = [...m.values()];
  const n = a.length;
  const w = a.reduce((x, r) => x + won(r), 0) / n;
  const atBoss = a.filter((r) => r.boss);
  return { n, win: 100 * w, se: 100 * Math.sqrt((w * (1 - w)) / n), dungeons: a.reduce((x, r) => x + (r.dungeons || 0), 0) / n, bossWin: atBoss.length ? (100 * atBoss.filter((r) => won(r)).length) / atBoss.length : NaN };
}

/** Paired difference b - a in win rate (pp) over the seeds both hold, with its standard error. */
export function pairDiff(a, b) {
  const xs = [];
  for (const [seed, r] of a) if (b.has(seed)) xs.push(won(b.get(seed)) - won(r));
  const n = xs.length;
  const mu = xs.reduce((x, y) => x + y, 0) / n;
  const v = xs.reduce((x, y) => x + (y - mu) ** 2, 0) / Math.max(1, n - 1);
  return { n, diff: 100 * mu, se: 100 * Math.sqrt(v / n) };
}

/** B6 (balance.md): max - min of the class win rates, and the largest distance of a class from their mean. */
export function b6(wins) {
  const mean = wins.reduce((a, b) => a + b, 0) / wins.length;
  return { spread: Math.max(...wins) - Math.min(...wins), maxDev: Math.max(...wins.map((x) => Math.abs(x - mean))) };
}

function parseArg(arg) {
  const [label, rest] = arg.split('=');
  const [dirs, range] = rest.split('@');
  const [lo, hi] = range ? range.split('-').map(Number) : [0, Infinity];
  return { label, dirs: dirs.split('+'), lo, hi };
}

if (process.argv[1] && process.argv[1].endsWith('armstats.mjs')) {
  const argv = process.argv.slice(2);
  let level = 25;
  let classes = ['rogue', 'mage', 'hunter'];
  const arms = [];
  let others = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--others') others = parseArg(`o=${argv[++i]}`);
    else if (argv[i] === '--level') level = Number(argv[++i]);
    else if (argv[i] === '--classes') classes = argv[++i].split(',');
    else arms.push(parseArg(argv[i]));
  }
  console.log(`| Arm | Runs | ${classes.join(' | ')} | Spread | Max dev | Dungeons a run | Boss-fight win | Paired vs ${arms[0].label} |`);
  console.log(`|---|---|${classes.map(() => '---').join('|')}|---|---|---|---|---|`);
  let ref = null;
  for (const a of arms) {
    const runs = Object.fromEntries(classes.map((c) => [c, loadRuns(a.dirs, level, c, a.lo, a.hi)]));
    if (classes.some((c) => !runs[c].size)) { console.log(`| ${a.label} | no runs |`); continue; }
    if (!ref) ref = runs;
    const st = Object.fromEntries(classes.map((c) => [c, stat(runs[c])]));
    const wins = classes.map((c) => st[c].win);
    let bb = classes.length > 1 ? b6(wins) : { spread: NaN, maxDev: NaN };
    if (others && classes.length === 1) {
      const ow = ['rogue', 'mage'].map((c) => stat(loadRuns(others.dirs, level, c, Math.max(a.lo, others.lo), Math.min(a.hi, others.hi))).win);
      bb = b6([...ow, wins[0]]);
    }
    const pd = classes.map((c) => { const p = pairDiff(ref[c], runs[c]); return a === arms[0] ? '-' : `${p.diff >= 0 ? '+' : ''}${p.diff.toFixed(1)} ± ${p.se.toFixed(1)}`; });
    console.log(`| ${a.label} | ${classes.map((c) => st[c].n).join('/')} | ${classes.map((c) => `${st[c].win.toFixed(1)} (± ${st[c].se.toFixed(1)})`).join(' | ')} | ${bb.spread.toFixed(1)} | ${bb.maxDev.toFixed(1)} | ${classes.map((c) => st[c].dungeons.toFixed(2)).join(' / ')} | ${classes.map((c) => st[c].bossWin.toFixed(1)).join(' / ')} | ${pd.join(' / ')} |`);
  }
}
