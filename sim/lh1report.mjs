#!/usr/bin/env node
// LH1 report (docs/specs/legacy-hall-v3-draft.md 5, D164): reads the hero cells of sim/lh1-arms.sh (<out>/<arm>/H<NN>, arms
// none | v2 | v3 | v3fb, planner, Legacy + Oruvath + Economy v2, the whole hall bought) and prints Markdown tables:
//   win     win rate per hero level, class and arm; the v3 - v2 difference pooled with its paired standard error (same seeds)
//   b6      B6 per cell and arm (every class within CLASS_BAND_PP of the mean, spread <= CLASS_SPREAD_MAX_PP)
//   l5      L5: the whole hall against nothing bought at hero 25 (arm none), 10-30 pp
//   le5     LE5: zone 1 mean lowest HP of won quest and grind fights at hero 10 and 20 (>= 85 %, within 3 points of hero 5's)
//   pace    Legacy a run, hero XP a run and minutes by hero level and arm
// and the campaign chain of sim/lh1-chain.sh (LE3, LE4, hours to hero 25, the run that completes the hall):
//   node sim/lh1report.mjs <out> [--arms v2,v3] [--base none]    the cell tables
//   node sim/lh1report.mjs plan <out> <arm>                       the (hero level, stage) cells the chain needs, from the arm's cells
//   node sim/lh1report.mjs chain <out> <arm>                      the chain read from <out>/chain-<arm>/run<k> cells (LE3, LE4, hours)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BAL } from './lib/params.mjs';
import { C } from './lib/engine.mjs';
import { BUY_ORDER, TECH2_LEVEL, priceOf } from './lib/hall.mjs';

const CLASSES = ['rogue', 'mage', 'hunter'];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pp = (x, d = 1) => (Number.isFinite(x) ? (100 * x).toFixed(d) : '-');
const f0 = (x) => (Number.isFinite(x) ? x.toFixed(0) : '-');

/** { H: { cls: [records] } } of a grid directory (<dir>/H<NN>/planner-*). */
export function load(dir) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const h of readdirSync(dir).filter((d) => /^H\d\d$/.test(d))) {
    const sub = readdirSync(join(dir, h)).find((d) => d.startsWith('planner-'));
    if (!sub || !existsSync(join(dir, h, sub, 'summary.md'))) continue;
    out[Number(h.slice(1))] = Object.fromEntries(CLASSES.map((c) => [c, readFileSync(join(dir, h, sub, `runs-${c}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l))]));
  }
  return out;
}

const win = (r) => (r.out === 'v' ? 1 : 0);
/** Per-class win rate and pooled (equal weight per class). */
function rates(cell) {
  const per = Object.fromEntries(CLASSES.map((c) => [c, mean(cell[c].map(win))]));
  return { per, pooled: mean(CLASSES.map((c) => per[c])), n: cell.rogue.length };
}
/** Paired difference of win rate (a - b), pooled over classes: { d, se } (runs matched on class and seed). */
function paired(a, b) {
  const diffs = [];
  for (const c of CLASSES) {
    const m = new Map(b[c].map((r) => [r.seed, win(r)]));
    for (const r of a[c]) if (m.has(r.seed)) diffs.push(win(r) - m.get(r.seed));
  }
  const d = mean(diffs);
  const v = diffs.reduce((s, x) => s + (x - d) ** 2, 0) / (diffs.length - 1);
  return { d, se: Math.sqrt(v / diffs.length), n: diffs.length };
}
function b6(per) {
  const r = CLASSES.map((c) => per[c]);
  const m = mean(r);
  const within = r.every((x) => Math.abs(x - m) <= BAL.CLASS_BAND_PP + 1e-9);
  const spread = Math.max(...r) - Math.min(...r);
  return { spread, pass: within && spread <= BAL.CLASS_SPREAD_MAX_PP + 1e-9 };
}
/** Zone 1 mean lowest HP (fraction) of won quest and grind fights. */
function z1hp(cell) {
  const v = [];
  for (const c of CLASSES) for (const r of cell[c]) for (const f of r.fx || []) if ((f[0] === 0 || f[0] === 1) && f[2] === 1 && f[4] === 1) v.push(f[5] / 1000);
  return mean(v);
}
const legacyOf = (cell) => mean(CLASSES.flatMap((c) => cell[c].map((r) => r.ech)));
const xpOf = (cell) => mean(CLASSES.flatMap((c) => cell[c].map((r) => (r.ct ? r.ct.xp : NaN))));
const minOf = (cell) => mean(CLASSES.flatMap((c) => cell[c].map((r) => r.min[0])));

// ---------------------------------------------------------------- the chain
/** Linear between measured levels, flat outside. */
function interp(pts, H) {
  const hs = Object.keys(pts).map(Number).sort((a, b) => a - b);
  if (H <= hs[0]) return pts[hs[0]];
  if (H >= hs[hs.length - 1]) return pts[hs[hs.length - 1]];
  const i = hs.findIndex((h) => h >= H);
  const a = hs[i - 1];
  const b = hs[i];
  return pts[a] + ((pts[b] - pts[a]) * (H - a)) / (b - a);
}
const WING = [250, 150, 300]; // level-20 wing in the draft's order: second tree, Armoury, third tree (hero level 20+)
/**
 * The chain of legacy-hall-v3-draft.md 3 / legacy-economy 4: runs until hero 25, each at its start level (integer, XP carried),
 * paying value(k, H) = { leg, xp, min }; after each run the hall is bought in BUY_ORDER at the arm's prices (strict order,
 * a gated entry skipped), then the wing from hero 20. Returns rows with the stage (owned entries) each run started with.
 */
export function chain(arm, value, maxRuns = 14) {
  const T = C.HERO_XP_ECON2;
  let H = 1;
  let xp = 0;
  let cum = 0;
  let hours = 0;
  let bal = 0;
  const owned = {};
  let wing = 0;
  const rows = [];
  for (let k = 1; k <= maxRuns && H < C.HERO_MAX_LEVEL; k++) {
    const start = H;
    const stage = Object.entries(owned).map(([id, r]) => `${id}${r}`).join(',');
    const v = value(k, start, stage);
    const leg = v.leg + (k === 1 ? C.LEGACY_WELCOME : 0);
    xp += v.xp;
    while (H < C.HERO_MAX_LEVEL && xp >= T[H - 1]) { xp -= T[H - 1]; H += 1; }
    if (H >= C.HERO_MAX_LEVEL) xp = 0;
    cum += leg;
    bal += leg;
    hours += v.min / 60;
    const bought = [];
    for (const [id, rank] of BUY_ORDER) {
      if ((owned[id] || 0) >= rank) continue;
      if (id === 'tech' && rank === 2 && H < TECH2_LEVEL) continue;
      if (id === 'second_breath' && k < 2) continue; // Oruvath reached once [assumption: by run 2]
      const price = priceOf(arm, id, rank);
      if (bal < price) break;
      bal -= price;
      owned[id] = rank;
      bought.push(`${id}${rank}`);
    }
    if (BUY_ORDER.every(([id, rank]) => (owned[id] || 0) >= rank) && H >= 20) {
      while (wing < WING.length && bal >= WING[wing]) { bal -= WING[wing]; wing += 1; bought.push(`wing${wing}`); }
    }
    rows.push({ run: k, start, stage, end: H + (H < C.HERO_MAX_LEVEL ? xp / T[H - 1] : 0), hours, leg, cum, bought, owned: { ...owned }, wing });
  }
  const spent = (arm0) => BUY_ORDER.reduce((s, [id, r]) => s + priceOf(arm0, id, r), 0);
  return { rows, account: spent(arm), wing: WING.reduce((a, b) => a + b, 0), hall: spent(arm) + WING.reduce((a, b) => a + b, 0) };
}

const isMain = process.argv[1] && process.argv[1].endsWith('lh1report.mjs');
if (isMain) {
  const argv = process.argv.slice(2);
  const cmd = ['plan', 'chain'].includes(argv[0]) ? argv.shift() : 'cells';
  const dir = argv[0];
  if (!dir) { console.log('usage: node sim/lh1report.mjs [plan|chain] <out> [<arm>] [--arms v2,v3] [--base none]'); process.exit(2); }
  const opt = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
  if (cmd === 'plan' || cmd === 'chain') {
    const arm = argv[1];
    const full = load(join(dir, arm));
    const pts = { leg: {}, xp: {}, min: {} };
    for (const [H, cell] of Object.entries(full)) { pts.leg[H] = legacyOf(cell); pts.xp[H] = xpOf(cell); pts.min[H] = minOf(cell); }
    const cdir = join(dir, `chain-${arm}`);
    const cells = {};
    if (existsSync(cdir)) for (const d of readdirSync(cdir).filter((x) => /^run\d+$/.test(x))) cells[Number(d.slice(3))] = load(join(cdir, d));
    let miss = null;
    // a chain cell of the run (start level and stage as planned) when played, else the arm's whole-hall cells interpolated
    const value = (k, H, stage) => {
      const cell = cells[k] && cells[k][H];
      if (cell) return { leg: legacyOf(cell), xp: xpOf(cell), min: minOf(cell) };
      miss = miss || `run ${k} at hero ${H} stage [${stage}]`;
      return { leg: interp(pts.leg, H), xp: interp(pts.xp, H), min: interp(pts.min, H) };
    };
    const res = chain(arm, value);
    if (cmd === 'plan') {
      for (const r of res.rows) console.log(`${r.run} ${r.start} ${r.stage || 'none'}`);
    } else {
      console.log('| Run | Hero start -> end | Hours | Legacy this run | Cumulative | Bought after the run |');
      console.log('|---|---|---|---|---|---|');
      for (const r of res.rows) console.log(`| ${r.run} | ${r.start} -> ${r.end.toFixed(1)} | ${r.hours.toFixed(2)} | ${f0(r.leg)} | ${f0(r.cum)} | ${r.bought.join(', ') || '-'} |`);
      const at20 = res.rows.find((r) => r.end >= 20);
      const at25 = res.rows.find((r) => r.end >= 25);
      const done = res.rows.find((r) => r.cum >= res.hall && r.end >= 20);
      console.log('');
      console.log(`Account wing + one class's techniques ${res.account}, wing ${res.wing}, hall (non-Hunter) ${res.hall}.`);
      console.log(`LE3: hero 20 reached in run ${at20 ? at20.run : '-'}, cumulative ${at20 ? f0(at20.cum) : '-'} against ${res.account} (${at20 ? ((at20.cum / res.account - 1) * 100).toFixed(1) : '-'} %); hero 25 in run ${at25 ? at25.run : '-'}, ${at25 ? f0(at25.cum) : '-'} against ${res.hall} (${at25 ? ((at25.cum / res.hall - 1) * 100).toFixed(1) : '-'} %); tolerance ±15 %.`);
      const le4 = res.rows.slice(0, 4).map((r) => r.bought.length);
      console.log(`LE4: entries bought after runs 1-4: ${le4.join(', ')} (at least 1 each: ${le4.every((n) => n >= 1) ? 'pass' : 'fail'}).`);
      console.log(`Hours to hero 25: ${at25 ? at25.hours.toFixed(2) : '-'}. Hall complete (cumulative >= hall and hero >= 20) after run ${done ? done.run : '-'}.`);
      if (miss) console.log(`MISSING chain cell: ${miss}`);
    }
    process.exit(0);
  }
  const arms = opt('--arms', 'v2,v3').split(',');
  const base = opt('--base', 'none');
  const data = Object.fromEntries([...arms, base].map((a) => [a, load(join(dir, a))]));
  const levels = Object.keys(data[arms[0]]).map(Number).sort((a, b) => a - b);
  const label = new Proxy({ none: 'nothing bought', v2: 'v2 hall', v3: 'v3 hall', v3fb: 'v3 fallback (Vigor II +2, Edge II +1)', v3c: 'v3c (Vigor +3/+1, Edge +2/+1)', v3d: 'v3d (v3c, v2 prices of Vigor II, Edge II, Second Breath)', v3e: 'v3e (v3d, Stormhawk 150, Pockets 40)', v3s: 'v3 stats, 4 slots', v3p: 'v2 stats, 8 slots', 'v2-nt': 'v2 hall without techniques', 'v3-nt': 'v3 hall without techniques' }, { get: (t, k) => t[k] || k });
  console.log('Win rate (planner, hall bought), runs per class in brackets; pooled = mean of the three classes.');
  console.log('');
  console.log(`| Hero | Arm | Runs a class | ${CLASSES.map((c) => c[0].toUpperCase() + c.slice(1)).join(' | ')} | Pooled | B6 spread | B6 |`);
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const H of levels) for (const a of [...arms, base]) {
    const cell = data[a][H];
    if (!cell) continue;
    const r = rates(cell);
    const b = b6(r.per);
    console.log(`| ${H} | ${label[a] || a} | ${r.n} | ${CLASSES.map((c) => pp(r.per[c])).join(' | ')} | ${pp(r.pooled)} | ${pp(b.spread)} | ${b.pass ? 'pass' : 'fail'} |`);
  }
  console.log('');
  console.log('Difference in win rate against the first arm, pooled, paired on seed (pp, ± one standard error; 95 % interval = ±1.96):');
  console.log('');
  console.log(`| Hero | Arm | Pooled | ${CLASSES.map((c) => c[0].toUpperCase() + c.slice(1)).join(' | ')} |`);
  console.log('|---|---|---|---|---|---|');
  for (const H of levels) for (const a of arms.slice(1)) {
    const x = data[a][H];
    const y = data[arms[0]][H];
    if (!x || !y) continue;
    const t = paired(x, y);
    const per = CLASSES.map((c) => { const q = paired({ rogue: [], mage: [], hunter: [], [c]: x[c] }, { rogue: [], mage: [], hunter: [], [c]: y[c] }); return `${(q.d * 100).toFixed(1)} ± ${(q.se * 100).toFixed(1)}`; });
    console.log(`| ${H} | ${label[a]} - ${label[arms[0]]} | ${(t.d * 100).toFixed(1)} ± ${(t.se * 100).toFixed(1)} | ${per.join(' | ')} |`);
  }
  console.log('');
  console.log('L5 (the whole hall against nothing bought, hero 25; 10-30 pp) and LE5 (zone 1 mean lowest HP, won quest and grind fights; >= 85 %):');
  console.log('');
  console.log('| Hero | Arm | Win pooled | Win minus nothing bought (pp) | Zone 1 lowest HP (%) | Legacy a run | Hero XP a run | Minutes (manual) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const H of levels) for (const a of [...arms, base]) {
    const cell = data[a][H];
    if (!cell) continue;
    const r = rates(cell);
    const b = data[base][H] ? rates(data[base][H]).pooled : NaN;
    console.log(`| ${H} | ${label[a] || a} | ${pp(r.pooled)} | ${a === base ? '-' : pp(r.pooled - b)} | ${pp(z1hp(cell), 0)} | ${f0(legacyOf(cell))} | ${f0(xpOf(cell))} | ${minOf(cell).toFixed(1)} |`);
  }
}
