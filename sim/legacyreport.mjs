#!/usr/bin/env node
// Legacy calibration tables (report legacy-calibration-2026-11-17; legacy.md 5.7-5.8, 7.2; balance.md B6): reads grid
// cells written by `node sim/legacy-run.mjs grid` (<dir>/H01 .. H25, one planner cell per hero level) and prints, per
// hero-level band and per level: win rate per class, reach Oruvath, wins / boss fights, dungeon and elite entries a run,
// deaths in dungeons and elites, zone deaths, minutes (manual pace), power level at Oruvath; then B6 per band (every class
// within CLASS_BAND_PP of the 3-class mean, max - min <= CLASS_SPREAD_MAX_PP; point estimates, balance.md 2).
//
//   node sim/legacyreport.mjs <grid dir> [--compare <grid dir>] [--levels]   (--levels: the per-level table too)
//   node sim/legacyreport.mjs --tables <dir of risk-H*.json>                  (observed entries and deaths per band)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BAL } from './lib/params.mjs';

const BANDS = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25]];
const CLASSES = ['rogue', 'mage', 'hunter'];
const pct = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) : '-');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

function load(dir) {
  const out = {};
  for (const h of readdirSync(dir).filter((d) => /^H\d\d$/.test(d))) {
    const H = Number(h.slice(1));
    const sub = readdirSync(join(dir, h)).find((d) => d.startsWith('planner-'));
    if (!sub) continue;
    out[H] = {};
    for (const c of CLASSES) {
      const f = join(dir, h, sub, `runs-${c}.jsonl`);
      if (existsSync(f)) out[H][c] = readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    }
  }
  return out;
}

function stats(rs) {
  const n = rs.length;
  const win = rs.filter((r) => r.out === 'v').length;
  const reach = rs.filter((r) => r.rb).length;
  const zoneDead = rs.filter((r) => r.out === 'd' && !r.rb).length;
  const dun = mean(rs.map((r) => (r.nt ? r.nt.dungeon : 0)));
  const eli = mean(rs.map((r) => (r.nt ? r.nt.elite : 0)));
  const dunDead = rs.filter((r) => r.death && !r.rb && r.death.type === 'dungeon').length;
  const eliDead = rs.filter((r) => r.death && !r.rb && r.death.type === 'elite').length;
  const minutes = mean(rs.map((r) => r.min[0]));
  const pb = mean(rs.filter((r) => r.rb && r.boss).map((r) => r.boss.lvl));
  return { n, win, reach, zoneDead, dun, eli, dunDead, eliDead, minutes, pb };
}

function b6(rates) {
  const m = mean(rates);
  const within = rates.every((r) => Math.abs(r - m) <= BAL.CLASS_BAND_PP + 1e-9);
  const spread = Math.max(...rates) - Math.min(...rates);
  return { m, spread, pass: within && spread <= BAL.CLASS_SPREAD_MAX_PP + 1e-9 };
}

function bandTable(g, label) {
  const lines = [];
  lines.push(`**${label}**`, '');
  lines.push('| Hero levels | Runs a class | Win: Rogue / Mage / Hunter (pooled) | Reach Oruvath | Wins / boss fights: R / M / H | Died in zones | Dungeons / elites entered a run | Deaths in dungeons / elites (% of runs) | Minutes | Power level at Oruvath | B6: spread (pass) |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  const res = {};
  for (const [lo, hi] of BANDS) {
    const per = {};
    for (const c of CLASSES) per[c] = stats(Object.keys(g).map(Number).filter((h) => h >= lo && h <= hi).flatMap((h) => g[h][c] || []));
    const all = stats(Object.keys(g).map(Number).filter((h) => h >= lo && h <= hi).flatMap((h) => CLASSES.flatMap((c) => g[h][c] || [])));
    if (!all.n) continue;
    const rates = CLASSES.map((c) => per[c].win / per[c].n);
    const b = b6(rates);
    res[`${lo}-${hi}`] = { rates, pooled: all.win / all.n, b6: b, per, all };
    lines.push(`| ${lo}-${hi} | ${per.rogue.n} | ${rates.map(pct).join(' / ')} (${pct(all.win / all.n)}) | ${pct(all.reach / all.n)} | ${CLASSES.map((c) => pct(per[c].win / per[c].reach)).join(' / ')} | ${pct(all.zoneDead / all.n)} | ${all.dun.toFixed(2)} / ${all.eli.toFixed(2)} | ${pct(all.dunDead / all.n)} / ${pct(all.eliDead / all.n)} | ${all.minutes.toFixed(1)} | ${all.pb.toFixed(1)} | ${(100 * b.spread).toFixed(1)} pp (${b.pass ? 'pass' : 'fail'}) |`);
  }
  return { lines, res };
}

function levelTable(g) {
  const lines = ['| Hero level | Win: Rogue / Mage / Hunter | Reach | Dungeons / elites a run | Died in zones | Power level at Oruvath |', '|---|---|---|---|---|---|'];
  for (const H of Object.keys(g).map(Number).sort((a, b) => a - b)) {
    const per = Object.fromEntries(CLASSES.map((c) => [c, stats(g[H][c] || [])]));
    const all = stats(CLASSES.flatMap((c) => g[H][c] || []));
    lines.push(`| ${H} | ${CLASSES.map((c) => pct(per[c].win / per[c].n)).join(' / ')} | ${pct(all.reach / all.n)} | ${all.dun.toFixed(2)} / ${all.eli.toFixed(2)} | ${pct(all.zoneDead / all.n)} | ${all.pb.toFixed(1)} |`);
  }
  return lines;
}

function tablesSummary(dir) {
  const lines = ['| Band | Warm-up runs a class | ' + ['dungeon', 'elite', 'elite2', 'quest3'].map((t) => `${t}: entries / deaths`).join(' | ') + ' |', '|---|---|---|---|---|---|'];
  for (const f of readdirSync(dir).filter((x) => /^risk-H\d\d-\d\d\.json$/.test(x)).sort()) {
    const t = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const runs = mean(CLASSES.map((c) => t[c].runs));
    const cells = ['dungeon', 'elite', 'elite2', 'quest3'].map((ty) => {
      const e = CLASSES.reduce((s, c) => s + ((t[c].t[ty] || [0])[0]), 0);
      const d = CLASSES.reduce((s, c) => s + ((t[c].t[ty] || [0, 0])[1]), 0);
      return `${e} / ${d} (${e ? pct(d / e) : '-'} %)`;
    });
    lines.push(`| ${f.replace(/^risk-H|\.json$/g, '').replace(/^0/, '').replace('-0', '-')} | ${runs} | ${cells.join(' | ')} |`);
  }
  return lines;
}

const args = process.argv.slice(2);
if (args[0] === '--tables') {
  console.log(tablesSummary(args[1]).join('\n'));
} else {
  const g = load(args[0]);
  const { lines, res } = bandTable(g, args[0]);
  console.log(lines.join('\n'));
  const ci = args.indexOf('--compare');
  if (ci >= 0) {
    const g2 = load(args[ci + 1]);
    const t2 = bandTable(g2, args[ci + 1]);
    console.log('\n' + t2.lines.join('\n'));
  }
  if (args.includes('--levels')) console.log('\n' + levelTable(g).join('\n'));
  if (args.includes('--json')) console.log(JSON.stringify(res));
}
