#!/usr/bin/env node
// LE3 attribution report (docs/reports/legacy-le3-2026-11-20.md, draft). Reads the cells of sim/legacy-le3.mjs (<out>/c/H<NN>-<stage>/,
// records with `ln`, the Legacy lines) and prints Markdown:
//   chain <out>          the v3d chain's runs against the same hero level with nothing bought, by Legacy line (LE3 attribution by run)
//   ladder <out> <H>     the buy order's entries added one at a time at hero level H: Legacy a run and win rate gained per entry, by line group
//   lines <out>          the chain's Legacy lines against nothing bought, summed over runs 1-7;  slope <out>: Legacy a run on win rate
//   lenses <out>         LE3 read at the end of the crossing run and inside it, first kill at every win or once a class, buyer and nothing bought
//   variant <out> [--mult line=f,...] [--late H] [--fk once]   the chain re-read with payouts scaled (lines recomputed from `ln`, play unchanged),
//                        LE3, LE4, hours to hero 25; --fk once pays the first-kill line once per class (expected value) instead of at every win
//   cuts <out>           the payout cuts of the report's option B;  none <out>: the nothing-bought chain
//   env LE3_SET=a|b|ab   seeds 9000-9059 (<out>/c), 9060-9119 (<out>/c2) or both (default)
//   need <out> [same options as variant]   the cells the variant's chain needs and does not have: "<hero> <hall spec> <cell dir>" lines
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load, chain } from './lh1report.mjs';
import { BUY_ORDER } from './lib/hall.mjs';
import { C } from './lib/engine.mjs';

const CLASSES = ['rogue', 'mage', 'hunter'];
const ARM = 'v3d';
const pad = (n) => String(n).padStart(2, '0');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f0 = (x) => (Number.isFinite(x) ? x.toFixed(0) : '-');
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const sgn = (x, d = 0) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(d) : '-');
export const LINES = ['levels', 'zones', 'dungeons', 'elites', 'rares', 'quests', 'heat', 'contracts', 'bossReached', 'bossPhases', 'bossKill', 'speed', 'firstKill'];
const GROUPS = [['levels', ['levels']], ['zones', ['zones']], ['map (dungeons, elites, rares, quests, contracts, heat)', ['dungeons', 'elites', 'rares', 'quests', 'contracts', 'heat']],
  ['boss (reached, phases, kill, par)', ['bossReached', 'bossPhases', 'bossKill', 'speed']], ['first kill (100 a win)', ['firstKill']]];

/** Owned entries after the first n of BUY_ORDER, as { id: rank }. */
export const ownedAt = (n) => { const o = {}; for (const [id, r] of BUY_ORDER.slice(0, n)) o[id] = r; return o; };
const key = (o) => Object.entries(o).map(([id, r]) => `${id}${r}`).sort().join(',');
/** The prefix length whose owned set equals the stage string, or -1. */
export function prefixOf(stage) {
  const k = stage === 'none' || !stage ? '' : stage.split(',').sort().join(',');
  for (let n = 0; n <= BUY_ORDER.length; n++) if (key(ownedAt(n)) === k) return n;
  return -1;
}
export const specOf = (stage) => (!stage || stage === 'none' ? 'none' : `${ARM}:${stage}`);
const stageName = (stage) => { const n = prefixOf(stage); return n >= 0 ? `p${pad(n)}` : `x-${stage.split(',').sort().join('+')}`; };
export const cellDir = (out, H, stage) => join(out, 'c', `H${pad(H)}-${stageName(stage)}`);
export const stageOfPrefix = (n) => (n === 0 ? 'none' : Object.entries(ownedAt(n)).map(([id, r]) => `${id}${r}`).join(','));

/** A cell ({ cls: records }) or null. */
export function cell(out, H, stage) {
  const d = cellDir(out, H, stage);
  const d2 = d.replace(`${join(out, 'c')}`, join(out, 'c2'));
  const set = process.env.LE3_SET || 'ab'; // a: seeds 9000-9059 (LH1's), b: seeds 9060-9119 (<out>/c2), ab: both where played
  const a = existsSync(d) ? load(d)[H] || null : null;
  const b = existsSync(d2) ? load(d2)[H] || null : null;
  if (set === 'a') return a;
  if (set === 'b') return b;
  if (a && b) return Object.fromEntries(CLASSES.map((k) => [k, [...a[k], ...b[k]]]));
  return a || b;
}
const recs = (c) => CLASSES.flatMap((k) => c[k]);
const lineOf = (r, id) => (r.ln && r.ln[id] ? r.ln[id][1] : 0);
const totalOf = (r) => r.ech;
const win = (r) => (r.out === 'v' ? 1 : 0);
/** Mean (and paired standard error against b, runs matched on class and seed) of f over the cell. */
export function stat(a, f, b) {
  if (!b) { const v = recs(a).map(f); return { m: mean(v), se: Math.sqrt(v.reduce((s, x) => s + (x - mean(v)) ** 2, 0) / (v.length - 1) / v.length) }; }
  const d = [];
  for (const k of CLASSES) { const mb = new Map(b[k].map((r) => [r.seed, f(r)])); for (const r of a[k]) if (mb.has(r.seed)) d.push(f(r) - mb.get(r.seed)); }
  const m = mean(d);
  return { m, se: Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / (d.length - 1) / d.length) };
}
const grp = (ids) => (r) => ids.reduce((s, id) => s + lineOf(r, id), 0);

// ------------------------------------------------------------------ chain by run
// the chain of LH1 section 10 (v3d): hero level at the start of runs 1-7 and the stage of each
export const CHAIN = [[1, 0], [4, 3], [7, 5], [11, 8], [14, 11], [17, 14], [19, 16]];
function chainTable(out) {
  console.log('Chain run against the same hero level with nothing bought (v3d chain cells, 180 runs, paired on seed). Legacy points a run by line group; wins in pp.');
  console.log('');
  console.log(`| Run | Hero | Entries | Legacy chain | Legacy none | Gain | ${GROUPS.map(([n]) => n.split(' (')[0]).join(' | ')} | Win chain / none |`);
  console.log(`|---|---|---|---|---|---|${GROUPS.map(() => '---').join('|')}|---|`);
  let cumGain = 0;
  CHAIN.forEach(([H, n], i) => {
    const a = cell(out, H, stageOfPrefix(n));
    const b = cell(out, H, 'none');
    if (!a || !b) { console.log(`| ${i + 1} | ${H} | missing |`); return; }
    const t = stat(a, totalOf, b);
    cumGain += t.m;
    const g = GROUPS.map(([, ids]) => stat(a, grp(ids), b));
    console.log(`| ${i + 1} | ${H} | ${n} | ${f0(stat(a, totalOf).m)} | ${f0(stat(b, totalOf).m)} | ${sgn(t.m)} ± ${f0(t.se)} | ${g.map((x) => `${sgn(x.m)}`).join(' | ')} | ${f0(stat(a, win).m * 100)} / ${f0(stat(b, win).m * 100)} % |`);
  });
  console.log('');
  console.log(`Sum of the gains, runs 1-7: ${sgn(cumGain)}.`);
}

/** Legacy lines of the chain with purchases against nothing bought at the same hero level, summed over the runs up to hero 20 (runs 1-7). */
function linesTable(out) {
  console.log('| Line | Chain, runs 1-7 | Nothing bought at the same hero levels | Gain | Share of the gain |');
  console.log('|---|---|---|---|---|');
  const rows = [];
  let tot = 0;
  for (const id of [...LINES, 'welcome']) {
    let a = 0;
    let b = 0;
    for (const [H, n] of CHAIN) {
      const x = cell(out, H, stageOfPrefix(n));
      const y = cell(out, H, 'none');
      a += stat(x, (r) => lineOf(r, id)).m;
      b += stat(y, (r) => lineOf(r, id)).m;
    }
    rows.push([id, a, b]);
    tot += a - b;
  }
  for (const [id, a, b] of rows) console.log(`| ${id} | ${f0(a)} | ${f0(b)} | ${sgn(a - b)} | ${f0(((a - b) / tot) * 100)} % |`);
  console.log(`| total | ${f0(rows.reduce((x, r) => x + r[1], 0))} | ${f0(rows.reduce((x, r) => x + r[2], 0))} | ${sgn(tot)} | 100 % |`);
}
/** Least squares of Legacy a run on win rate over the cells of a hero level (every cell played at that level). */
function slope(out, H) {
  const pts = [];
  for (const d of readdirSync(join(out, 'c'))) {
    const m = d.match(/^H(\d\d)-(.*)$/);
    if (!m || Number(m[1]) !== H) continue;
    const c = cell(out, H, m[2] === 'p00' ? 'none' : stageOfPrefix(Number(m[2].slice(1))));
    if (c) pts.push([stat(c, win).m * 100, stat(c, totalOf).m, stat(c, (r) => lineOf(r, 'firstKill')).m, stat(c, grp(['bossReached', 'bossPhases', 'bossKill', 'speed'])).m]);
  }
  const fit = (i) => { const n = pts.length; const mx = mean(pts.map((p) => p[0])); const my = mean(pts.map((p) => p[i])); let sxy = 0; let sxx = 0; for (const p of pts) { sxy += (p[0] - mx) * (p[i] - my); sxx += (p[0] - mx) ** 2; } return { b: sxy / sxx, n, a: my - (sxy / sxx) * mx }; };
  return { total: fit(1), firstKill: fit(2), boss: fit(3) };
}

// ------------------------------------------------------------------ ladder
function ladder(out, H) {
  const top = CHAIN.find(([h]) => h === H)[1];
  console.log(`Ladder at hero ${H}: BUY_ORDER entries added one at a time (v3d effects and prices), 180 runs a cell, paired on seed against the cell before. Gain = Legacy a run; groups in points.`);
  console.log('');
  console.log(`| # | Entry added | Price | Legacy a run | Gain ± se | Win % | Win gain (pp) | ${GROUPS.map(([n]) => n.split(' (')[0]).join(' | ')} |`);
  console.log(`|---|---|---|---|---|---|---|${GROUPS.map(() => '---').join('|')}|`);
  let prev = cell(out, H, 'none');
  let sum = 0;
  for (let n = 0; n <= top; n++) {
    const cur = cell(out, H, stageOfPrefix(n));
    if (!cur) { console.log(`| ${n} | ${n ? BUY_ORDER[n - 1].join('') : 'nothing'} | missing |`); continue; }
    if (n === 0) { console.log(`| 0 | nothing bought | - | ${f0(stat(cur, totalOf).m)} | - | ${f0(stat(cur, win).m * 100)} | - | ${GROUPS.map(([, ids]) => f0(stat(cur, grp(ids)).m)).join(' | ')} |`); prev = cur; continue; }
    const [id, rank] = BUY_ORDER[n - 1];
    const price = priceOfEntry(id, rank);
    const t = stat(cur, totalOf, prev);
    const w = stat(cur, win, prev);
    sum += t.m;
    console.log(`| ${n} | ${id}${rank} | ${price} | ${f0(stat(cur, totalOf).m)} | ${sgn(t.m, 1)} ± ${f1(t.se)} | ${f0(stat(cur, win).m * 100)} | ${sgn(w.m * 100, 1)} | ${GROUPS.map(([, ids]) => sgn(stat(cur, grp(ids), prev).m, 1)).join(' | ')} |`);
    prev = cur;
  }
  console.log('');
  console.log(`Sum of the gains: ${sgn(sum, 1)} against nothing bought.`);
}
import { priceOf } from './lib/hall.mjs';
const priceOfEntry = (id, rank) => priceOf(ARM, id, rank);

// ------------------------------------------------------------------ variant chains
/** Legacy points of a record with the lines scaled: mult { line: factor } (each factor on that line's points, rounded per line). */
function legacyOf(r, mult, H, late) {
  let s = 0;
  for (const [id, [count, pts]] of Object.entries(r.ln)) {
    const m = mult[id] !== undefined && (!late || H >= late) ? mult[id] : 1;
    s += Math.round(pts * m);
    void count;
  }
  return s;
}
/** The chain under a variant: { rows, res, missing: [{H, stage}] }. */
export function variantChain(out, opt = {}) {
  const mult = opt.mult || {};
  const missing = [];
  const surv = Object.fromEntries(CLASSES.map((k) => [k, 1])); // first-kill: probability a class has not won yet
  const have = [];
  for (const [H, n] of CHAIN) { void H; void n; }
  const value = (k, H, stage) => {
    let c = cell(out, H, stage || 'none');
    if (!c) {
      missing.push({ H, stage: stage || 'none' });
      // fallback: the nearest played cell with the same stage, else the chain cell nearest in hero level
      const cand = [];
      const dir = join(out, 'c');
      if (existsSync(dir)) for (const d of readdirSync(dir)) { const m = d.match(/^H(\d\d)-(.*)$/); if (m && m[2] === stageName(stage || 'none')) cand.push(Number(m[1])); }
      if (!cand.length) for (const [h, n] of CHAIN) cand.push(h * 100 + n);
      const near = cand.filter((x) => x < 100).sort((a, b) => Math.abs(a - H) - Math.abs(b - H))[0];
      c = near !== undefined ? cell(out, near, stage || 'none') : null;
      if (!c) { const [h, n] = CHAIN.sort((a, b) => Math.abs(a[0] - H) - Math.abs(b[0] - H))[0]; c = cell(out, h, stageOfPrefix(n)); }
    }
    let leg = 0;
    for (const cls of CLASSES) {
      let sum = 0;
      for (const r of c[cls]) sum += legacyOf(r, mult, H, opt.late) - (opt.fk === 'once' ? lineOf(r, 'firstKill') : 0);
      leg += sum / c[cls].length / CLASSES.length;
      if (opt.fk === 'once') {
        const w = mean(c[cls].map(win));
        const before = 1 - surv[cls];
        surv[cls] *= 1 - w;
        leg += (100 * (1 - surv[cls] - before)) / CLASSES.length;
      }
    }
    return { leg, xp: stat(c, (r) => (r.ct ? r.ct.xp : NaN)).m, min: stat(c, (r) => r.min[0]).m };
  };
  const res = chain(ARM, value);
  return { res, missing };
}
function readVariant(argv) {
  const opt = { mult: {} };
  const val = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const m = val('--mult');
  if (m) for (const x of m.split(',')) { const [id, f] = x.split('='); opt.mult[id] = Number(f); }
  if (val('--late')) opt.late = Number(val('--late'));
  if (val('--fk')) opt.fk = val('--fk');
  return opt;
}
/** Cumulative Legacy at hero level L read inside the run that crosses it (linear in the hero level over the run), instead of at that run's end. */
export function cumAt(res, L) {
  let prevEnd = 1;
  let prevCum = 0;
  for (const r of res.rows) {
    if (r.end >= L) return prevCum + ((L - prevEnd) / (r.end - prevEnd)) * (r.cum - prevCum);
    prevEnd = r.end;
    prevCum = r.cum;
  }
  return NaN;
}
export function summarize(res) {
  const at20 = res.rows.find((r) => r.end >= 20);
  const at25 = res.rows.find((r) => r.end >= 25);
  const done = res.rows.find((r) => r.cum >= res.hall && r.end >= 20);
  return {
    at20, at25, done, le3a: at20 ? at20.cum / res.account - 1 : NaN, le3b: at25 ? at25.cum / res.hall - 1 : NaN,
    le4: res.rows.slice(0, 4).map((r) => r.bought.length), hours: at25 ? at25.hours : NaN,
    // D168 reading (lh1report chain().at): cumulative Legacy and hours at the hero level, inside the run that crosses it
    h20: res.at ? res.at(20) : null, h25: res.at ? res.at(25) : null,
  };
}
function variantPrint(out, opt, label) {
  const { res, missing } = variantChain(out, opt);
  const s = summarize(res);
  console.log(`| ${label} | ${s.at20 ? `run ${s.at20.run}, ${f0(s.at20.cum)}` : '-'} | ${sgn(s.le3a * 100, 1)} % | ${s.at25 ? `run ${s.at25.run}, ${f0(s.at25.cum)}` : '-'} | ${sgn(s.le3b * 100, 1)} % | ${s.le4.join(', ')} | ${f1(s.hours).length ? s.hours.toFixed(2) : '-'} | ${s.done ? s.done.run : '-'} |${missing.length ? ` MISSING ${[...new Set(missing.map((x) => `H${x.H}`))].join(' ')}` : ''}`);
  return { res, s, missing };
}

// ------------------------------------------------------------------ option B: payout cuts
/** Linear interpolation of the nothing-bought cells (hero levels played), flat above the highest; per class, for the first-kill option. */
function noneValue(out, opt) {
  const pts = [];
  for (const H of [1, 4, 7, 11, 14, 17, 19]) {
    const c = cell(out, H, 'none');
    if (!c) continue;
    pts.push({
      H, xp: stat(c, (r) => (r.ct ? r.ct.xp : NaN)).m, min: stat(c, (r) => r.min[0]).m,
      leg: Object.fromEntries(CLASSES.map((k) => [k, mean(c[k].map((r) => legacyOf(r, opt.mult || {}, H, opt.late) - (opt.fk === 'once' ? lineOf(r, 'firstKill') : 0)))])),
      w: Object.fromEntries(CLASSES.map((k) => [k, mean(c[k].map(win))])),
    });
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  return (H) => {
    if (H <= pts[0].H) return pts[0];
    if (H >= pts[pts.length - 1].H) return pts[pts.length - 1];
    const i = pts.findIndex((q) => q.H >= H);
    const a = pts[i - 1];
    const b = pts[i];
    const t = (H - a.H) / (b.H - a.H);
    return { xp: lerp(a.xp, b.xp, t), min: lerp(a.min, b.min, t), leg: Object.fromEntries(CLASSES.map((k) => [k, lerp(a.leg[k], b.leg[k], t)])), w: Object.fromEntries(CLASSES.map((k) => [k, lerp(a.w[k], b.w[k], t)])) };
  };
}
/** The chain of a player who buys nothing (prices still paid by the chain's buyer but not played): the spec's reference. */
export function noneChain(out, opt = {}) {
  const f = noneValue(out, opt);
  const surv = Object.fromEntries(CLASSES.map((k) => [k, 1]));
  return chain(ARM, (k, H) => {
    const v = f(H);
    let leg = 0;
    for (const c of CLASSES) {
      leg += v.leg[c] / CLASSES.length;
      if (opt.fk === 'once') { const before = 1 - surv[c]; surv[c] *= 1 - v.w[c]; leg += (100 * (1 - surv[c] - before)) / CLASSES.length; }
    }
    return { leg, xp: v.xp, min: v.min };
  });
}
const CUTS = [
  ['LEGACY_BOSS_KILL 120 -> 90', ['bossKill'], 0, 0.75], ['LEGACY_BOSS_KILL 120 -> 60', ['bossKill'], 0, 0.5],
  ['LEGACY_PER_LEVEL 20 -> 15', ['levels'], 0, 0.75], ['LEGACY_PER_LEVEL 20 -> 10', ['levels'], 0, 0.5],
  ['LEGACY_PER_ZONE_HERO 10 -> 7.5', ['zones'], 0, 0.75], ['LEGACY_BOSS_KILL 120 -> 72', ['bossKill'], 0, 0.6], ['LEGACY_BOSS_KILL 120 -> 60 from hero 13', ['bossKill'], 13, 0.5],
  ['every line x 0.90', null, 0, 0.9], ['every line x 0.85', null, 0, 0.85], ['every line x 0.80', null, 0, 0.8],
  ['every line x 0.85 from hero 13 (runs 5-7)', null, 13, 0.85], ['every line x 0.75 from hero 13 (runs 5-7)', null, 13, 0.75],
];
function cuts(out) {
  console.log('| Payout cut | Hero 20, end of its run | Hero 20, inside the run | Hero 25 | LE4 | Hours to 25 | Hall done after run | Nothing bought: hero 20 / 25 (end of run) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const [name, lines, late, f] of [['as built', [], 0, 1], ...CUTS]) {
    const opt = { mult: Object.fromEntries((lines || LINES).map((id) => [id, f])), late };
    const { res, missing } = variantChain(out, opt);
    const s = summarize(res);
    const nn = summarize(noneChain(out, opt));
    console.log(`| ${name} | run ${s.at20 ? s.at20.run : '-'}, ${s.at20 ? f0(s.at20.cum) : '-'} (${sgn(s.le3a * 100, 1)} %) | ${sgn((cumAt(res, 20) / res.account - 1) * 100, 1)} % | ${sgn(s.le3b * 100, 1)} % | ${s.le4.join(', ')} | ${s.hours.toFixed(2)} | ${s.done ? s.done.run : '-'} | ${sgn(nn.le3a * 100, 1)} / ${sgn(nn.le3b * 100, 1)} % |${missing.length ? ` MISSING ${[...new Set(missing.map((x) => `H${x.H}`))].join(' ')}` : ''}`);
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('legacy-le3report.mjs');
if (isMain) {
  const [cmd, outArg, ...rest] = process.argv.slice(2);
  const out = resolve(outArg || '.');
  if (cmd === 'chain') chainTable(out);
  else if (cmd === 'lenses') {
    console.log('| Chain | Payout of the first kill | Hero 20 read at the end of its run | Hero 20 read inside the run | Hero 25 | Hours to 25 | Hall done after run |');
    console.log('|---|---|---|---|---|---|---|');
    for (const [label, fn] of [['buying (v3d)', (o) => variantChain(out, o).res], ['nothing bought', (o) => noneChain(out, o)]]) {
      for (const fk of [null, 'once']) {
        const res = fn({ fk });
        const sm = summarize(res);
        const a = (x, base) => `${f0(x)} (${sgn((x / base - 1) * 100, 1)} %)`;
        console.log(`| ${label} | ${fk ? 'once a class' : 'every win (as built)'} | run ${sm.at20.run}, ${a(sm.at20.cum, res.account)} | ${a(cumAt(res, 20), res.account)} | ${a(sm.at25.cum, res.hall)} | ${sm.hours.toFixed(2)} | ${sm.done ? sm.done.run : '-'} |`);
      }
    }
  } else if (cmd === 'lines') linesTable(out);
  else if (cmd === 'slope') { for (const H of [14, 19]) { const f = slope(out, H); console.log(`H${H}: cells ${f.total.n}; Legacy a run = ${f.total.a.toFixed(0)} + ${f.total.b.toFixed(2)} x win %; first kill ${f.firstKill.b.toFixed(2)}, boss lines ${f.boss.b.toFixed(2)} per pp`); } }
  else if (cmd === 'cuts') cuts(out);
  else if (cmd === 'none') {
    const res = noneChain(out, readVariant(rest));
    const sm = summarize(res);
    for (const r of res.rows) console.log(`| ${r.run} | ${r.start} -> ${r.end.toFixed(1)} | ${r.hours.toFixed(2)} | ${f0(r.leg)} | ${f0(r.cum)} |`);
    console.log(`LE3 at 20: run ${sm.at20.run}, ${f0(sm.at20.cum)} (${sgn(sm.le3a * 100, 1)} %); at 25: run ${sm.at25.run}, ${f0(sm.at25.cum)} (${sgn(sm.le3b * 100, 1)} %); hours ${sm.hours.toFixed(2)}`);
  } else if (cmd === 'ladder') ladder(out, Number(rest[0]));
  else if (cmd === 'variant') {
    const opt = readVariant(rest);
    const { res } = variantChain(out, opt);
    console.log('| Run | Hero start -> end | Hours | Legacy | Cumulative | Bought after the run |');
    console.log('|---|---|---|---|---|---|');
    for (const r of res.rows) console.log(`| ${r.run} | ${r.start} -> ${r.end.toFixed(1)} | ${r.hours.toFixed(2)} | ${f0(r.leg)} | ${f0(r.cum)} | ${r.bought.join(', ') || '-'} |`);
    console.log('');
    console.log('| Variant | Hero 20 | LE3 at 20 | Hero 25 | LE3 at 25 | LE4 | Hours to 25 | Hall done after run |');
    console.log('|---|---|---|---|---|---|---|---|');
    variantPrint(out, opt, rest.join(' ') || 'as measured');
  } else if (cmd === 'need') {
    const opt = readVariant(rest);
    const { res, missing } = variantChain(out, opt);
    void res;
    const seen = new Set();
    for (const { H, stage } of missing) {
      const d = cellDir(out, H, stage);
      if (seen.has(d)) continue;
      seen.add(d);
      console.log(`${H} ${specOf(stage)} ${d}`);
    }
  } else console.log('usage: node sim/legacy-le3report.mjs chain|ladder|variant|need <out> ...');
}
void C;
