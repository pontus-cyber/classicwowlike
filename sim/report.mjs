#!/usr/bin/env node
// Balance report from a pass directory (sim/pass.mjs): every target B1-B38 of docs/specs/balance.md, the combat v2
// targets of docs/specs/combat-v2.md 12 (B48-B55 from the stage G cells; the changed B5, B15 and B16 with their v2
// bands) and the heat targets of docs/specs/expedition.md H.6 (B58, B56 as redefined in M2b v6, B57; stage H cells and
// the B57 arm of --heat-off), with value, 95 % interval, target and pass/fail, plus supporting tables. Writes the
// generated part between the markers <!-- generated:start --> and <!-- generated:end --> of the report file, so
// hand-written analysis outside the markers survives a regeneration.
//
//   node sim/report.mjs --in sim/out/pass-2026-11-09 --out docs/reports/balance-2026-11-09.md
//        [--heat-off <dir with a planner-P0 cell on an engine without the H.3 rewards (B57 arm, same warm-up table)>]
//        [--before-combat <sim/combatpass.mjs dir>] [--before-heat <dir with planner-P0, planner-P0-heatSeek,
//        planner-P0-heatAvoid>] [--before-heat-off <dir with planner-P0>] [--before-label <text>]
//        [--before docs/reports/balance-<earlier>.md] [--before-pass <earlier pass dir>]
//
// Before column. With --before-combat / --before-heat the Before column is re-measured: the same check code runs on
// those cells (combat measure: planner, masher, opener, tactician, random, greedy, speedrunner P0 and planner PALL; heat
// cells for B58, B56, B57), judged against today's targets; rows are matched by ID, priority and metric text without
// its parenthesised numbers. Checks those cells cannot give show n/a. Otherwise --before reads an earlier report made by
// this script (checks matched by ID and order within the ID, diagnostic rows excluded; cells by name; results there are
// against the targets of that report's date). --before-pass: the pass directory of the --before report; the checks
// whose definition changed in M2 v4 (B12 p10 report-only, the B17 time budget, the B32 dip over blocks of at least
// CURVE_BLOCK_MIN_RUNS runs) then take their Before value from it, measured with the current definition.
//
// Default trees (balance.md 1.3, M2 v5, D43): the planner P0 cell of each class is its P0-group tree's B7 cell, the
// planner PALL cell its PALL-group tree's planner-PALL-tree<t> cell (a pass made before M2 v5 has one planner-PALL
// cell); the report prints both tree sets and, per class and group, the incumbent, the best challenger, the gap and
// the switch threshold. B5 fallback (balance.md 1.3): when pass.json records it, B1 tactician and B5 use the
// fallback tactician cell (tactician-P0-b5 for the re-run classes) and say so. B5 compares the tactician with the
// planner on the tactician's seeds (paired); a cell that was not run (e.g. the PALL tactician when compute was short)
// gives an "n/a (not run)" row.
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BAL, C2 } from './lib/params.mjs';
import { C } from './lib/engine.mjs';
import { treeSwitch } from './lib/trees.mjs';
import { cellMetrics, timeBudget } from './lib/metrics.mjs';
import { campaignMetricsByClass, blockList } from './lib/campaignreport.mjs';
import { rate, diffRate, median } from './lib/stats.mjs';
import { readJson, readJsonl, pct, num, ci, table } from './lib/output.mjs';
import { TIME_PROFILE } from './bots/index.mjs';
import { tableSummary, buildTable } from './lib/risk.mjs';
import { CLASSES } from './lib/session.mjs';
import { combatChecks, pairedDiff, winRate, reachRate, replayStats, engageTable, windupStats, deathRate } from './lib/combatchecks.mjs';
import { heatChecks, heatCell } from './lib/heatchecks.mjs';
import { FIGHT_KINDS } from './lib/recorder.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) o[argv[i].replace(/^--/, '')] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return o;
}
const args = parse(process.argv.slice(2));
const IN = args.in;
const OUT = args.out;
const HEAT_OFF = args['heat-off'] || null;
const BEFORE = args.before ? parseBefore(readFileSync(args.before, 'utf8')) : null;
const BC = args['before-combat'] || null;
const BH = args['before-heat'] || null;
const BHO = args['before-heat-off'] || null;

/** Generated tables of an earlier report: checks by `${ID}#${k}` (k-th non-diagnostic row of that ID), cells by name. */
function parseBefore(md) {
  const a = md.indexOf('<!-- generated:start');
  const b = md.indexOf('<!-- generated:end -->');
  const lines = (a >= 0 && b > a ? md.slice(a, b) : md).split('\n');
  const checks = new Map();
  const cells = new Map();
  const count = {};
  let head = null;
  let summary = null;
  for (const line of lines) {
    if (line.startsWith('Pass/fail:')) summary = line.slice('Pass/fail:'.length).trim();
    if (!line.startsWith('|')) { head = null; continue; }
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (!head) { head = c; continue; }
    if (c.every((x) => /^-+$/.test(x))) continue;
    if (head[0] === 'ID' && head[1] === 'Pri' && c[1] !== 'diag') {
      // A report made with --before has its own Before columns: read its "Now" columns.
      const vi = head.indexOf('Now: value (95 % interval)') >= 0 ? head.indexOf('Now: value (95 % interval)') : head.indexOf('Value (95 % interval)');
      const ri = head.indexOf('Now') >= 0 ? head.indexOf('Now') : head.indexOf('Result');
      count[c[0]] = (count[c[0]] || 0) + 1;
      checks.set(`${c[0]}#${count[c[0]]}`, { value: c[vi], result: c[ri] });
    } else if (head[0] === 'Cell' && head[1] === 'Runs') cells.set(c[0], c);
  }
  return { checks, cells, summary, file: args.before };
}
const pass = readJson(join(IN, 'pass.json'));
const trees = pass.trees;
const treesPALL = pass.treesPALL || null;
const b5Fallback = pass.b5 && pass.b5.applied ? pass.b5 : null;
const BEFORE_PASS = args['before-pass'] || null;
const treeName = (cls, t) => `${t} ${C.CLASS[cls].trees[t]}`;
const treeSet = (tr) => CLASSES.map((c) => `${c} ${treeName(c, tr[c])}`).join(', ');

// ---------------- Loading ----------------
/** Records per class of a cell directory (null if missing). */
function readCellDir(dir) {
  if (!dir || !existsSync(join(dir, 'summary.json'))) return null;
  const sum = readJson(join(dir, 'summary.json'));
  const out = {};
  for (const cls of Object.keys(sum.classes)) out[cls] = readJsonl(join(dir, `runs-${cls}.jsonl`));
  return out;
}
const dirCache = new Map();
/** Records of a cell per class (from runs-<class>.jsonl) in pass directory `root` (default: --in). */
function recs(name, root = IN) {
  const key = `${root}|${name}`;
  if (!dirCache.has(key)) dirCache.set(key, readCellDir(join(root, name)));
  return dirCache.get(key);
}
/** Records per class of a cell made of one cell per class: `cells` = { cls: cell name } (pass directory `root`). */
function perClassCells(cells, root = IN) {
  const out = {};
  for (const cls of CLASSES) {
    const r = recs(cells[cls], root);
    if (r && r[cls]) out[cls] = r[cls];
  }
  return Object.keys(out).length ? out : null;
}
/** The P0 planner cell of each class is its default-tree B7 cell (P0-group trees of pass directory `root`). */
function plannerP0(root = IN) {
  const tr = root === IN ? trees : readJson(join(root, 'pass.json')).trees;
  return perClassCells(Object.fromEntries(CLASSES.map((c) => [c, `planner-P0-tree${tr[c]}`])), root);
}
/** The PALL planner cell of each class (M2 v5): its PALL-group tree's planner-PALL-tree<t> cell; a pass without
 *  PALL-group trees (before M2 v5) has the single cell planner-PALL. */
function plannerPALL(root = IN) {
  const tr = root === IN ? treesPALL : readJson(join(root, 'pass.json')).treesPALL || null;
  if (!tr) return recs('planner-PALL', root);
  return perClassCells(Object.fromEntries(CLASSES.map((c) => [c, `planner-PALL-tree${tr[c]}`])), root);
}
/** The P0 tactician cell that counts for B1 and B5: the B5 fallback cell per class when it applied (pass.json). */
function tacticianP0(root = IN) {
  const p = root === IN ? pass : readJson(join(root, 'pass.json'));
  return p.b5 && p.b5.applied && p.tacticianP0 ? perClassCells(p.tacticianP0, root) : recs('tactician-P0', root);
}
/** Virtual cells: planner-P0 / planner-PALL (default-tree cells), tactician-P0 (B1 and B5 cell),
 *  tactician-P0-groupTrees (the tactician on the P0-group trees, the directory tactician-P0). */
function virtualCell(name, root = IN) {
  if (name === 'planner-P0') return plannerP0(root);
  if (name === 'planner-PALL') return plannerPALL(root);
  if (name === 'tactician-P0') return tacticianP0(root);
  if (name === 'tactician-P0-groupTrees') return recs('tactician-P0', root);
  return undefined;
}
/** Records of a cell in pass directory `root`, all classes pooled (virtual cells resolved). */
function pooledRecs(name, root = IN) {
  const v = virtualCell(name, root);
  const r = v !== undefined ? v : recs(name, root);
  return r ? Object.values(r).flat() : [];
}

/** Base bot of a cell name (time profile of the metrics); "heat:*" cells are planner cells. */
const botOf = (name) => (name.startsWith('heat:') ? 'planner' : name.split('-')[0]);
/** Records of `base` restricted to the (class, seed) pairs of `other`: paired comparison. */
function pairedSubset(base, other) {
  const out = {};
  for (const c of Object.keys(other)) {
    if (!base[c]) continue;
    const seeds = new Set(other[c].map((r) => r.seed));
    out[c] = base[c].filter((r) => seeds.has(r.seed));
  }
  return out;
}

/**
 * A source of cells: resolve(name) -> { cls: records } or null. Names "<base>@<other>" are the base cell on the
 * other's seeds. "heat:planner", "heat:seek", "heat:avoid", "heat:off" are the four cells of the heat checks.
 */
function makeSource(label, resolve, extra = {}) {
  const cells = new Map();
  const mets = new Map();
  const S = {
    label,
    ...extra,
    cells(name) {
      if (!cells.has(name)) {
        let v;
        const at = name.indexOf('@');
        if (at > 0) {
          const base = S.cells(name.slice(0, at));
          const other = S.cells(name.slice(at + 1));
          v = base && other ? pairedSubset(base, other) : null;
        } else v = resolve(name);
        cells.set(name, v || null);
      }
      return cells.get(name);
    },
    pooled(name) { const c = S.cells(name); return c ? Object.values(c).flat() : null; },
    /** Metrics of a cell, all classes pooled or one class; null if the cell (or the class) is missing. */
    P(name, cls = null) {
      const key = `${name}|${cls}`;
      if (!mets.has(key)) {
        const c = S.cells(name);
        let v = null;
        if (c && (!cls || c[cls])) v = cellMetrics(cls ? c[cls] : Object.values(c).flat(), { timeProfile: TIME_PROFILE[botOf(name)] });
        mets.set(key, v);
      }
      return mets.get(key);
    },
  };
  return S;
}

const NOW = makeSource('now', (name) => {
  if (name === 'heat:planner') return plannerP0();
  if (name === 'heat:seek') return recs('planner-P0-heatSeek');
  if (name === 'heat:avoid') return recs('planner-P0-heatAvoid');
  if (name === 'heat:off') return HEAT_OFF ? readCellDir(join(HEAT_OFF, 'planner-P0')) : null;
  const v = virtualCell(name);
  return v !== undefined ? v : recs(name);
}, { now: true });

/** Before source of --before-combat / --before-heat: cell names of this pass mapped to the earlier measure's cells. */
const BMAP = {
  'planner-P0': [BC, 'planner-P0'], 'tactician-P0': [BC, 'tactician-P0'], 'masher-P0': [BC, 'masher-P0'], 'opener-P0': [BC, 'opener-P0'],
  'random-P0': [BC, 'random-P0'], 'greedy-P0': [BC, 'greedy-P0'], 'speedrunner-P0': [BC, 'speedrunner-P0'], 'planner-PALL': [BC, 'planner-PALL'],
  'heat:planner': [BH, 'planner-P0'], 'heat:seek': [BH, 'planner-P0-heatSeek'], 'heat:avoid': [BH, 'planner-P0-heatAvoid'], 'heat:off': [BHO, 'planner-P0'],
};
const BSRC = BC || BH ? makeSource('before', (name) => {
  const m = BMAP[name];
  return m && m[0] ? readCellDir(join(m[0], m[1])) : null;
}, { now: false }) : null;
const metaOf = (dir, file) => (dir && existsSync(join(dir, file)) ? readJson(join(dir, file)).meta : null);
const BC_META = metaOf(BC, 'combat.json');
const BH_META = BH && existsSync(join(BH, 'planner-P0', 'summary.json')) ? readJson(join(BH, 'planner-P0', 'summary.json')).meta : null;

// ---------------- Target checks ----------------
const inBand = (v, [lo, hi]) => v !== null && v !== undefined && v >= lo && v <= hi;
const band = ([lo, hi], f = pct) => `${f(lo)} - ${f(hi)}`;
const res = (ok) => (ok === null || ok === undefined ? 'n/a' : ok ? 'pass' : '**FAIL**');
/** Miss size for ranking: distance outside the band in band widths (or relative to the bound). */
function miss(v, lo, hi) {
  if (v === null || v === undefined) return 1;
  const w = hi !== null && lo !== null ? Math.max(hi - lo, 1e-9) : Math.max(Math.abs(lo ?? hi), 1e-9);
  if (lo !== null && v < lo) return (lo - v) / w;
  if (hi !== null && v > hi) return (v - hi) / w;
  return 0;
}
const rcell = (r) => (r && r.n ? `${pct(r.p)} (${ci(r.ci)})` : 'n/a');
const dcell = (d) => (d && d.v !== null ? `${d.v >= 0 ? '+' : ''}${num(d.v * 100, 1)} pp (${num(d.ci[0] * 100, 1)} - ${num(d.ci[1] * 100, 1)}; n=${d.n})` : 'n/a');
const win = (r) => (r.out === 'v' ? 1 : 0);
/** The metric text without its parenthesised parts (nested ones included). */
function stripParens(t) {
  let x = t;
  for (let y = x.replace(/\s*\([^()]*\)/g, ''); y !== x; y = x.replace(/\s*\([^()]*\)/g, '')) x = y;
  return x.replace(/\s+/g, ' ').trim();
}
/** Row key for matching Before rows: ID, priority and the metric without its parenthesised parts. */
const keyOf = (r) => `${r.id}|${r.pri}|${r.key || stripParens(r.metric)}`;
class Missing extends Error {}
const req = (x, what = 'cell') => { if (x === null || x === undefined) throw new Missing(what); return x; };
const mOf = (records, bot) => cellMetrics(records, { timeProfile: TIME_PROFILE[bot] });
/** Combat cells of a source for combatChecks: arrays of records (missing cells left out). */
const combatCells = (S) => {
  const o = {};
  for (const [k, name] of [['planner', 'planner-P0'], ['masher', 'masher-P0'], ['opener', 'opener-P0'], ['tactician', 'tactician-P0']]) { const r = S.pooled(name); if (r) o[k] = r; }
  return o;
};

/**
 * Every check of the report from source S (NOW or the Before source). Rows { id, pri, metric, value, target, ok, miss,
 * note, before, key }; a check whose cells S does not have gives an "n/a (not run)" row.
 */
function buildChecks(S) {
  const rows = [];
  const add = (id, pri, metric, value, target, ok, o = {}) => rows.push({ id, pri, metric, value, target, ok, miss: ok === false ? (o.miss ?? 1) : 0, note: o.note || '', before: o.before, key: o.key || null });
  /** One check unit: fn() adds its rows; missing cells give one "n/a (not run)" row with this id, priority and metric. */
  const unit = (id, pri, metric, fn, key = null) => {
    try { fn(); } catch (e) {
      if (!(e instanceof Missing)) throw e;
      add(id, pri, metric, 'n/a (not run)', '', null, { key });
    }
  };
  const P = (name, cls = null) => req(S.P(name, cls), name);
  const pooled = (name) => req(S.pooled(name), name);
  const nowOnly = () => { if (!S.now) throw new Missing('now only'); };
  const b5Note = S.now && b5Fallback ? `B5 fallback: tactician on trees ${treeSet(b5Fallback.trees)}; on the P0-group trees B5 ${pct(b5Fallback.onGroupTrees)} (floor ${pct(b5Fallback.floor)})` : '';

  // B1-B3: win rates
  const B1 = { random: [null, BAL.WR_P0_RANDOM_MAX], greedy: BAL.WR_P0_GREEDY, planner: BAL.WR_P0_PLANNER, speedrunner: BAL.WR_P0_SPEED, tactician: BAL.WR_P0_TACTICIAN };
  for (const [bot, b] of Object.entries(B1)) {
    unit('B1', 'P1', `Win rate P0, ${bot}`, () => {
      const x = P(`${bot}-P0`).win;
      const lo = Array.isArray(b) && b[0] !== null ? b[0] : null;
      const hi = Array.isArray(b) ? b[1] : b;
      add('B1', 'P1', `Win rate P0, ${bot}${bot === 'tactician' ? ` (${x.n} runs)` : ''}`, rcell(x), lo === null ? `<= ${pct(hi)}` : band([lo, hi]), (lo === null || x.p >= lo) && x.p <= hi, { miss: miss(x.p, lo, hi), note: bot === 'tactician' ? b5Note : '' });
    });
  }
  for (const bot of ['masher', 'opener']) unit('B1', 'diag', `Win rate P0, ${bot} (no B1 band)`, () => add('B1', 'diag', `Win rate P0, ${bot} (no B1 band; ${P(`${bot}-P0`).win.n} runs)`, rcell(P(`${bot}-P0`).win), '', null));
  unit('B2', 'P1', 'Win rate P10, planner', () => {
    const x = P('planner-P10').win;
    add('B2', 'P1', 'Win rate P10, planner', rcell(x), band(BAL.WR_P10_PLANNER), inBand(x.p, BAL.WR_P10_PLANNER), { miss: miss(x.p, ...BAL.WR_P10_PLANNER) });
  });
  unit('B2', 'P1', 'Win rate P10, random', () => {
    const y = P('random-P10').win;
    add('B2', 'P1', 'Win rate P10, random', rcell(y), `<= ${pct(BAL.WR_P10_RANDOM_MAX)}`, y.p <= BAL.WR_P10_RANDOM_MAX, { miss: miss(y.p, null, BAL.WR_P10_RANDOM_MAX) });
  });
  const B3 = { random: [null, BAL.WR_PALL_RANDOM_MAX], greedy: BAL.WR_PALL_GREEDY, planner: BAL.WR_PALL_PLANNER, speedrunner: BAL.WR_PALL_SPEED, tactician: [null, BAL.WR_PALL_TACTICIAN_MAX] };
  for (const [bot, b] of Object.entries(B3)) {
    unit('B3', 'P1', `Win rate PALL, ${bot}`, () => {
      const x = P(`${bot}-PALL`).win;
      const [lo, hi] = b;
      add('B3', 'P1', `Win rate PALL, ${bot}${bot === 'tactician' ? ` (${x.n} runs)` : ''}`, rcell(x), lo === null ? `<= ${pct(hi)}` : band([lo, hi]), (lo === null || x.p >= lo) && x.p <= hi, { miss: miss(x.p, lo, hi) });
    });
  }
  // B4, B5, B10: differences
  for (const prof of ['P0', 'PALL']) {
    unit('B4', 'P1', `Planner - random, ${prof}`, () => {
      const d = diffRate(P(`planner-${prof}`).win, P(`random-${prof}`).win);
      add('B4', 'P1', `Planner - random, ${prof}`, `${pct(d.v)} (${ci(d.ci)})`, `>= ${pct(BAL.CHOICE_GAP_MIN)}`, d.v >= BAL.CHOICE_GAP_MIN, { miss: miss(d.v, BAL.CHOICE_GAP_MIN, null) });
    });
  }
  // B5 (changed, combat-v2.md 12): tactician - planner on the tactician's seeds (paired), band MANUAL_GAP_V2.
  const gapBand = C2.MANUAL_GAP_V2.map((x) => x / 100);
  let b5gap = null;
  unit('B5', 'P1', 'Tactician - planner win rate, P0', () => {
    const t = pooled('tactician-P0');
    const pl = pooled('planner-P0@tactician-P0');
    const d = pairedDiff(t, pl, win);
    b5gap = d.v;
    const full = diffRate(winRate(t), P('planner-P0').win);
    add('B5', 'P1', `Tactician - planner win rate, P0, paired on the tactician's seeds (tactician ${pct(winRate(t).p)}, planner on the same seeds ${pct(winRate(pl).p)}; against the whole planner cell ${pct(full.v)})`, dcell(d),
      `${C2.MANUAL_GAP_V2[0]} - ${C2.MANUAL_GAP_V2[1]} pp (MANUAL_GAP_V2, combat-v2.md 12)`, d.v === null ? null : inBand(d.v, gapBand), { miss: miss(d.v, ...gapBand), note: b5Note });
  });
  unit('B5', 'diag', 'Opener - planner win rate, P0, paired; share of the tactician\'s gap', () => {
    const o = pooled('opener-P0');
    const d = pairedDiff(o, pooled('planner-P0@opener-P0'), win);
    add('B5', 'diag', `Opener - planner win rate, P0, paired on the opener's seeds (opener ${pct(winRate(o).p)}); share of the tactician's gap`, `${dcell(d)}; ${b5gap > 0 ? num(d.v / b5gap, 2) : 'n/a'} × (tactician - planner)`,
      `>= ${C2.OPEN_SHARE_MIN} × (tactician - planner)`, b5gap > 0 && d.v !== null ? d.v >= C2.OPEN_SHARE_MIN * b5gap : null);
  });
  unit('B5', 'diag', 'Tactician telegraph rules only, autoplay otherwise (no search) - planner, P0, same seeds', () => {
    const t = P('tactician-P0-rulesOnly');
    const pl = P('planner-P0@tactician-P0-rulesOnly');
    const dd = diffRate(t.win, pl.win);
    add('B5', 'diag', 'Tactician telegraph rules only, autoplay otherwise (no search) - planner, P0, same seeds', `${pct(dd.v)} (${ci(dd.ci)})`, `${C2.MANUAL_GAP_V2[0]} - ${C2.MANUAL_GAP_V2[1]} pp`, null, { note: 'diagnostic, not a balance.md bot' });
  });
  // B6: class band
  for (const prof of ['P0', 'PALL']) {
    unit('B6', 'P1', `Class band, planner ${prof}`, () => {
      const w = CLASSES.map((c) => P(`planner-${prof}`, c).win.p);
      const mean = w.reduce((a, b) => a + b, 0) / 3;
      const dev = Math.max(...w.map((x) => Math.abs(x - mean)));
      const spread = Math.max(...w) - Math.min(...w);
      add('B6', 'P1', `Class band, planner ${prof} (${CLASSES.map((c, i) => `${c} ${pct(w[i])}`).join(', ')})`, `max deviation ${pct(dev)}, spread ${pct(spread)}`,
        `deviation <= ${pct(BAL.CLASS_BAND_PP)}, spread <= ${pct(BAL.CLASS_SPREAD_MAX_PP)}`, dev <= BAL.CLASS_BAND_PP && spread <= BAL.CLASS_SPREAD_MAX_PP, { miss: miss(spread, null, BAL.CLASS_SPREAD_MAX_PP) });
    });
  }
  // B7: trees
  for (const cls of CLASSES) {
    unit('B7', 'P1', `Talent trees, ${cls}`, () => {
      const w = [0, 1, 2].map((t) => P(`planner-P0-tree${t}`, cls).win.p);
      const best = Math.max(...w);
      const worst = Math.min(...w);
      const ok = best > 0 ? worst >= BAL.TREE_FLOOR_RATIO * best : false;
      add('B7', 'P1', `Talent trees, ${cls} (${w.map((x, t) => `tree ${t} ${pct(x)}`).join(', ')})`, best > 0 ? `worst/best ${num(worst / best, 2)}` : 'no wins in any tree', `>= ${BAL.TREE_FLOOR_RATIO}`, ok, { miss: best > 0 ? miss(worst / best, BAL.TREE_FLOOR_RATIO, null) : 1, note: best > 0 ? '' : 'not measurable' });
    });
  }
  // B8: route styles
  const STYLES = ['balanced', 'quest', 'grind', 'elite', 'speed'];
  for (const prof of ['P0', 'PALL']) {
    unit('B8', 'P2', `Route styles, planner ${prof}`, () => {
      const stats = STYLES.map((st) => {
        const x = st === 'balanced' ? P(`planner-${prof}@planner-${prof}-quest`) : P(`planner-${prof}-${st}`);
        return { st, wr: x.win.p, min: x.minutesBoss.v };
      });
      const dom = stats.find((a) => stats.every((b) => b === a || (a.wr >= b.wr + BAL.DOM_MARGIN_PP && (a.min ?? Infinity) <= (b.min ?? Infinity))));
      add('B8', 'P2', `Route styles, planner ${prof} (${stats.map((x) => `${x.st} ${pct(x.wr)}/${num(x.min, 0)} min`).join(', ')})`, dom ? `${dom.st} dominates` : 'no dominant style', 'no dominant style', !dom);
    });
  }
  // B9: pets
  unit('B9', 'P2', 'Hunter pets', () => {
    const pets = { ridgewolf: P('planner-P0', 'hunter'), thornback: P('planner-P0-thornback', 'hunter'), duskcat: P('planner-P0-duskcat', 'hunter') };
    const w = Object.values(pets).map((x) => x.win.p);
    const best = Math.max(...w);
    const worst = Math.min(...w);
    add('B9', 'P2', `Hunter pets (${Object.entries(pets).map(([k, x]) => `${k} ${pct(x.win.p)}`).join(', ')})`, best > 0 ? `worst/best ${num(worst / best, 2)}` : 'no wins with any pet', `>= ${BAL.PET_FLOOR_RATIO}`, best > 0 ? worst >= BAL.PET_FLOOR_RATIO * best : false, { note: best > 0 ? '' : 'not measurable' });
  });
  unit('B10', 'P1', 'Planner PALL - P0', () => {
    const d = diffRate(P('planner-PALL').win, P('planner-P0').win);
    add('B10', 'P1', 'Planner PALL - P0', `${pct(d.v)} (${ci(d.ci)})`, band([BAL.META_GAP_MIN_PP, BAL.META_GAP_MAX_PP]), inBand(d.v, [BAL.META_GAP_MIN_PP, BAL.META_GAP_MAX_PP]), { miss: miss(d.v, BAL.META_GAP_MIN_PP, BAL.META_GAP_MAX_PP) });
  });
  // B11-B17: pacing
  let b11 = null;
  unit('B11', 'P1', 'Median run length, planner P0, runs reaching the boss', () => {
    const pl = P('planner-P0');
    b11 = pl.minutesBossManual.v;
    add('B11', 'P1', 'Median run length, planner P0, runs reaching the boss (manual profile)', `${num(b11)} min (${ci(pl.minutesBossManual.ci, (x) => num(x))})`, `${BAL.MIN_NORMAL_LOW} - ${BAL.MIN_NORMAL_HIGH} min (aim ${BAL.MIN_NORMAL_TARGET})`, inBand(b11, [BAL.MIN_NORMAL_LOW, BAL.MIN_NORMAL_HIGH]), { miss: miss(b11, BAL.MIN_NORMAL_LOW, BAL.MIN_NORMAL_HIGH) });
  });
  unit('B12', 'P1', 'Speedrun length, speedrunner PALL wins', () => {
    const r = b12Check(P('speedrunner-PALL'), req(b11, 'B11'));
    add('B12', 'P1', 'Speedrun length, speedrunner PALL wins (autoplay profile)', r.value, r.target, r.ok, { miss: r.miss, note: S.now && BEFORE_PASS ? 'M2 v4 definition; Before: the earlier pass re-measured with it' : 'M2 v4 definition',
      before: S.now && BEFORE_PASS ? beforeOf(() => b12Check(mOf(pooledRecs('speedrunner-PALL', BEFORE_PASS), 'speedrunner'), mOf(pooledRecs('planner-P0', BEFORE_PASS), 'planner').minutesBossManual.v)) : undefined });
  });
  unit('B13', 'P2', 'Speedrun played manually, speedrunner PALL wins', () => {
    const vm = P('speedrunner-PALL').minutesWinManual.v;
    const b = req(b11, 'B11');
    add('B13', 'P2', 'Speedrun played manually, speedrunner PALL wins (manual profile)', `median ${num(vm)} min (${num(vm / b, 2)} × B11)`, `<= ${BAL.SPEED_MANUAL_RATIO_MAX} × B11`, vm !== null && vm <= BAL.SPEED_MANUAL_RATIO_MAX * b, { miss: miss(vm, null, BAL.SPEED_MANUAL_RATIO_MAX * b) });
  });
  unit('B14', 'P2', 'Nodes per run, planner P0', () => {
    const pl = P('planner-P0');
    add('B14', 'P2', 'Nodes per run, planner P0 (runs reaching the boss)', `${num(pl.nodesBoss.v, 0)}`, `${BAL.NODES_NORMAL[0]} - ${BAL.NODES_NORMAL[1]}`, inBand(pl.nodesBoss.v, BAL.NODES_NORMAL), { miss: miss(pl.nodesBoss.v, ...BAL.NODES_NORMAL) });
  });
  unit('B14', 'P2', 'Nodes per run, speedrunner PALL', () => {
    const sp = P('speedrunner-PALL');
    add('B14', 'P2', 'Nodes per run, speedrunner PALL (runs reaching the boss)', `${num(sp.nodesBoss.v, 0)}`, `${BAL.NODES_SPEED[0]} - ${BAL.NODES_SPEED[1]}`, inBand(sp.nodesBoss.v, BAL.NODES_SPEED), { miss: miss(sp.nodesBoss.v, ...BAL.NODES_SPEED) });
  });
  // B15, B16 (changed, combat-v2.md 12), B48-B55 and B53: combat v2 checks on the planner, masher, opener cells.
  const cc = combatChecks(combatCells(S));
  const ccRows = (ids) => { for (const r of cc.filter((x) => ids.includes(x.id) && !(x.id === 'B5'))) add(r.id, r.pri, r.metric + (r.note ? ` (${r.note})` : ''), r.value, r.target, r.ok); };
  if (S.pooled('planner-P0')) ccRows(['B15', 'B16']);
  else unit('B16', 'P1', 'Fight length incl. the engage round', () => req(null));
  unit('B17', 'P2', 'Hours at boss, planner P0 median', () => {
    const pl = P('planner-P0');
    add('B17', 'P2', 'Hours at boss, planner P0 median', `${num(pl.hoursBoss.v, 0)} h`, `${BAL.HOURS_NORMAL[0]} - ${BAL.HOURS_NORMAL[1]} h`, inBand(pl.hoursBoss.v, BAL.HOURS_NORMAL), { miss: miss(pl.hoursBoss.v, ...BAL.HOURS_NORMAL) });
  });
  unit('B17', 'P2', 'Hours at boss, speedrunner PALL median', () => {
    const sp = P('speedrunner-PALL');
    add('B17', 'P2', 'Hours at boss, speedrunner PALL median', `${num(sp.hoursBoss.v, 0)} h`, `${BAL.HOURS_SPEED[0]} - ${BAL.HOURS_SPEED[1]} h`, inBand(sp.hoursBoss.v, BAL.HOURS_SPEED), { miss: miss(sp.hoursBoss.v, ...BAL.HOURS_SPEED) });
  });
  unit('B17', 'P2', 'Ascendancy at boss, planner P0 median', () => {
    const pl = P('planner-P0');
    add('B17', 'P2', 'Ascendancy at boss, planner P0 median', `${num(pl.ascBoss.v, 2)}`, `<= ${BAL.ASC_MEDIAN_MAX}`, pl.ascBoss.v <= BAL.ASC_MEDIAN_MAX, { miss: miss(pl.ascBoss.v, null, BAL.ASC_MEDIAN_MAX) });
  });
  unit('B17', 'P2', 'Time budget: planner P0 median hours at boss - planner PALL median', () => {
    const r = timeBudgetCheck(pooled('planner-P0'), pooled('planner-PALL'));
    add('B17', 'P2', r.metric, r.value, r.target, r.ok, { miss: r.miss, note: S.now && BEFORE_PASS ? 'new in M2 v4; Before: the earlier pass measured with it' : 'new in M2 v4',
      before: S.now && BEFORE_PASS ? beforeOf(() => timeBudgetCheck(pooledRecs('planner-P0', BEFORE_PASS), pooledRecs('planner-PALL', BEFORE_PASS))) : undefined });
  });
  // B18-B20: character at the boss
  unit('B18', 'P1', 'Level 60 at boss, planner P0', () => {
    const pl = P('planner-P0');
    add('B18', 'P1', 'Level 60 at boss, planner P0', rcell(pl.lvl60), `>= ${pct(BAL.LVL60_SHARE_MIN)}`, pl.lvl60.p >= BAL.LVL60_SHARE_MIN, { miss: miss(pl.lvl60.p, BAL.LVL60_SHARE_MIN, null) });
  });
  unit('B18', 'P1', 'Level at boss, speedrunner P0 median', () => {
    const sp0 = P('speedrunner-P0');
    add('B18', 'P1', 'Level at boss, speedrunner P0 median', `${num(sp0.lvlBoss.v, 0)}`, `>= ${BAL.LVL_SPEED_MEDIAN_MIN}`, sp0.lvlBoss.v >= BAL.LVL_SPEED_MEDIAN_MIN, { miss: miss(sp0.lvlBoss.v, BAL.LVL_SPEED_MEDIAN_MIN, null) });
  });
  unit('B19', 'P2', 'Mean equipped ilvl at boss, planner P0', () => {
    const pl = P('planner-P0');
    add('B19', 'P2', 'Mean equipped ilvl at boss, planner P0', `${num(pl.ilvlBoss.v)} (${ci(pl.ilvlBoss.ci, (x) => num(x))})`, `${BAL.ILVL_BOSS[0]} - ${BAL.ILVL_BOSS[1]}`, inBand(pl.ilvlBoss.v, BAL.ILVL_BOSS), { miss: miss(pl.ilvlBoss.v, ...BAL.ILVL_BOSS) });
  });
  unit('B19', 'P2', 'Rare-or-better share of the 10 slots at boss, planner P0', () => {
    const pl = P('planner-P0');
    add('B19', 'P2', 'Rare-or-better share of the 10 slots at boss, planner P0', pct(pl.rareShareBoss.v), `>= ${pct(BAL.RARE_SHARE_MIN)}`, pl.rareShareBoss.v >= BAL.RARE_SHARE_MIN, { miss: miss(pl.rareShareBoss.v, BAL.RARE_SHARE_MIN, null) });
  });
  unit('B20', 'P2', 'Median level when leaving Z1..Z6, planner P0', () => {
    const lv = P('planner-P0').travelLv.map((x) => x.v);
    const bad = lv.map((v, i) => (v === null || Math.abs(v - 10 * (i + 1)) > BAL.ZONE_LVL_SLACK ? `Z${i + 1}` : null)).filter(Boolean);
    add('B20', 'P2', 'Median level when leaving Z1..Z6, planner P0', lv.map((v) => num(v, 0)).join(', '), `10z ± ${BAL.ZONE_LVL_SLACK}`, bad.length === 0, { miss: bad.length / 6, note: bad.length ? `outside: ${bad.join(', ')}` : '' });
  });
  // B21-B25: deaths and risk
  let riskRows = null;
  unit('B21', 'P1', 'Runs dying in Z1-Z2', () => { riskRows = riskChecks(P('planner-P0')); });
  const emit = (id) => { if (riskRows) for (const r of riskRows.filter((x) => x.id === id)) add(r.id, r.pri, r.metric, r.value, r.target, r.ok, { miss: r.miss }); };
  emit('B21');
  unit('B22', 'P2', 'Non-boss deaths by node type', () => {
    const pl = P('planner-P0');
    const types = Object.entries(pl.deathType);
    const top = types[0];
    add('B22', 'P2', `Non-boss deaths by node type (${types.map(([k, v]) => `${k} ${pct(v.p, 0)}`).join(', ')})`, `largest: ${top ? `${top[0]} ${pct(top[1].p)}` : 'n/a'}`, `no type > ${pct(BAL.DEATH_TYPE_MAX)}`, top ? top[1].p <= BAL.DEATH_TYPE_MAX : null, { miss: top ? miss(top[1].p, null, BAL.DEATH_TYPE_MAX) : 0 });
    const dun = pl.deathType.dungeon || rate(0, top ? top[1].n : 0);
    add('B22', 'P2', 'Dungeon share of non-boss deaths', rcell(dun), band(BAL.DEATH_DUNGEON), inBand(dun.p, BAL.DEATH_DUNGEON), { miss: miss(dun.p, ...BAL.DEATH_DUNGEON) });
  });
  unit('B23', 'P2', 'Boss losses in phase 1', () => {
    const ph = P('planner-P0').bossLossPhase;
    add('B23', 'P2', 'Boss losses in phase 1', rcell(ph['1']), `<= ${pct(BAL.BOSS_P1_LOSS_MAX)}`, ph['1'].p <= BAL.BOSS_P1_LOSS_MAX, { miss: miss(ph['1'].p, null, BAL.BOSS_P1_LOSS_MAX) });
    const late = rate(ph['3'].k + ph.enrage.k, ph['3'].n);
    add('B23', 'P2', `Boss losses in phase 3 or enrage (phase 2: ${pct(ph['2'].p)})`, rcell(late), `>= ${pct(BAL.BOSS_LATE_LOSS_MIN)}`, late.p >= BAL.BOSS_LATE_LOSS_MIN, { miss: miss(late.p, BAL.BOSS_LATE_LOSS_MIN, null) });
  });
  emit('B24');
  emit('B38');
  unit('B25', 'P3', 'Rests per run', () => {
    const pl = P('planner-P0');
    add('B25', 'P3', 'Rests per run (nodes + Inn), planner P0 runs reaching the boss', num(pl.rests.v), `${BAL.REST_COUNT[0]} - ${BAL.REST_COUNT[1]}`, inBand(pl.rests.v, BAL.REST_COUNT), { miss: miss(pl.rests.v, ...BAL.REST_COUNT) });
    add('B25', 'P3', 'Potions used per run, planner P0 runs reaching the boss', num(pl.potions.v), `${BAL.POTION_COUNT[0]} - ${BAL.POTION_COUNT[1]}`, inBand(pl.potions.v, BAL.POTION_COUNT), { miss: miss(pl.potions.v, ...BAL.POTION_COUNT) });
  });
  // B26-B29: boss mechanics
  for (const [id, pri, v, label] of [['B26', 'P1', 'noInterrupt', 'interrupt spells off the bar'], ['B27', 'P1', 'noCleanse', 'cleanse spells off the bar, no Tonic'], ['B28', 'P2', 'noAoe', 'AoE spells off the bar']]) {
    const key = `Planner PALL with ${label}`;
    unit(id, pri, `Planner PALL with ${label}`, () => {
      const x = P(`planner-PALL-${v}`);
      const base = P(`planner-PALL@planner-PALL-${v}`);
      const ratio = base.win.p > 0 ? x.win.p / base.win.p : null;
      add(id, pri, `Planner PALL with ${label}: win rate ${pct(x.win.p)} vs ${pct(base.win.p)} (same seeds)`, ratio === null ? 'n/a' : `ratio ${num(ratio, 2)}`, `<= ${BAL.MECH_RATIO_MAX}`, ratio === null ? null : ratio <= BAL.MECH_RATIO_MAX, { miss: miss(ratio, null, BAL.MECH_RATIO_MAX), key });
    }, key);
  }
  unit('B29', 'P2', 'Boss losses to Final Dark, planner P0', () => {
    const pl = P('planner-P0');
    add('B29', 'P2', 'Boss losses to Final Dark, planner P0', rcell(pl.finalDarkLoss), band(BAL.ENRAGE_LOSS), inBand(pl.finalDarkLoss.p, BAL.ENRAGE_LOSS), { miss: miss(pl.finalDarkLoss.p, ...BAL.ENRAGE_LOSS) });
  });
  // B30-B34: economy and meta
  unit('B30', 'P1', 'Echoes per run, planner P0 mean', () => {
    const pl = P('planner-P0');
    add('B30', 'P1', 'Echoes per run, planner P0 mean', `${num(pl.echoes.v, 0)} (${ci(pl.echoes.ci, (x) => num(x, 0))})`, `${BAL.ECHO_P0[0]} - ${BAL.ECHO_P0[1]}`, inBand(pl.echoes.v, BAL.ECHO_P0), { miss: miss(pl.echoes.v, ...BAL.ECHO_P0) });
    add('B30', 'P1', `Echoes per win, planner P0 mean (without the first-kill line: ${num(pl.echoesWinNoFirst.v, 0)})`, `${num(pl.echoesWin.v, 0)} (n=${pl.echoesWin.n})`, `${BAL.ECHO_WIN[0]} - ${BAL.ECHO_WIN[1]}`, pl.echoesWin.n ? inBand(pl.echoesWin.v, BAL.ECHO_WIN) : null, { miss: miss(pl.echoesWin.v, ...BAL.ECHO_WIN) });
  });
  unit('B31', 'P1', 'Runs to full catalogue, campaign median', () => {
    nowOnly();
    const camp = req(S.camp, 'campaigns');
    const a = camp.all;
    const medNum = typeof a.medianRuns === 'number' ? a.medianRuns : null;
    add('B31', 'P1', `Runs to full catalogue, campaign median (completed ${a.completed}/${a.n})`, `${a.medianRuns}`, `${BAL.CAMPAIGN_RUNS[0]} - ${BAL.CAMPAIGN_RUNS[1]}`, medNum !== null && inBand(medNum, BAL.CAMPAIGN_RUNS), { miss: medNum === null ? 2 : miss(medNum, ...BAL.CAMPAIGN_RUNS) });
    add('B31', 'P1', 'Fewest runs to full catalogue in any campaign', `${a.minRuns ?? 'none completed'}`, `>= ${BAL.CAMPAIGN_RUNS_MIN_ANY}`, a.minRuns === null ? null : a.minRuns >= BAL.CAMPAIGN_RUNS_MIN_ANY);
    add('B32', 'P1', 'Campaign win rate, runs 1-5', rcell(a.wr1to5), band(BAL.WR_RUNS_1_5), inBand(a.wr1to5.p, BAL.WR_RUNS_1_5), { miss: miss(a.wr1to5.p, ...BAL.WR_RUNS_1_5) });
    add('B32', 'P1', 'Campaign win rate, runs 21-30', rcell(a.wr21to30), band(BAL.WR_RUNS_21_30), inBand(a.wr21to30.p, BAL.WR_RUNS_21_30), { miss: miss(a.wr21to30.p, ...BAL.WR_RUNS_21_30) });
    const dipCheck = (x) => ({ value: `${pct(x.maxDip)} (all blocks: ${pct(x.maxDipAll)})`, ok: x.maxDip <= BAL.CURVE_DIP_PP });
    const bfile = BEFORE_PASS ? join(BEFORE_PASS, 'campaigns', 'campaigns.json') : null;
    add('B32', 'P1', `Largest dip between blocks of 5 runs with >= ${BAL.CURVE_BLOCK_MIN_RUNS} runs, pooled (counted: ${a.countedBlocks.join(', ')})`, dipCheck(a).value, `<= ${pct(BAL.CURVE_DIP_PP)}`, dipCheck(a).ok, { miss: miss(a.maxDip, null, BAL.CURVE_DIP_PP),
      note: bfile ? 'M2 v4 definition; Before: the earlier pass re-measured with it' : 'M2 v4 definition', before: bfile && existsSync(bfile) ? beforeOf(() => dipCheck(campaignMetricsByClass(readJson(bfile).classes).all)) : undefined });
  });
  unit('B33', 'P2', 'Hub and Camp trainer visits where gold covers TRAIN_ALL, planner P0', () => {
    const pl = P('planner-P0');
    add('B33', 'P2', 'Hub and Camp trainer visits where gold covers TRAIN_ALL, planner P0', rcell(pl.trainAfford), `>= ${pct(BAL.TRAIN_AFFORD_MIN)}`, pl.trainAfford.p >= BAL.TRAIN_AFFORD_MIN, { miss: miss(pl.trainAfford.p, BAL.TRAIN_AFFORD_MIN, null) });
  });
  unit('B34', 'P3', 'Runs with an Ember bought by the boss, planner P0 runs reaching the boss', () => {
    const pl = P('planner-P0');
    add('B34', 'P3', 'Runs with an Ember bought by the boss, planner P0 runs reaching the boss', rcell(pl.emberBuy), band(BAL.EMBER_BUY), inBand(pl.emberBuy.p, BAL.EMBER_BUY), { miss: miss(pl.emberBuy.p, ...BAL.EMBER_BUY) });
  });
  // B35-B37: engine health
  unit('B35', 'P1', 'Replay of random runs from seed + action log', () => {
    nowOnly();
    const health = req(S.health, 'health');
    add('B35', 'P1', `Replay of ${health.replay.runs} random runs from seed + action log`, `${health.replay.identical}/${health.replay.runs} identical`, '100 %', health.replay.identical === health.replay.runs, { key: 'Replay of random runs from seed + action log' });
  }, 'Replay of random runs from seed + action log');
  unit('B36', 'P1', 'Runs without SUMMARY or over MAX_ACTIONS_PER_RUN, all measured runs', () => {
    nowOnly();
    let stuck = 0;
    let totalRuns = 0;
    const errSamples = [];
    for (const name of Object.keys(pass.cells)) {
      const r = recs(name);
      if (!r) continue;
      for (const list of Object.values(r)) for (const x of list) { totalRuns++; if (x.out === 'x') { stuck++; if (errSamples.length < 5) errSamples.push(`${name} ${x.cls} seed ${x.seed}: ${x.err}`); } }
    }
    add('B36', 'P1', `Runs without SUMMARY or over MAX_ACTIONS_PER_RUN, all ${totalRuns} measured runs`, `${stuck}`, '0', stuck === 0, { note: errSamples.join('; '), key: 'Runs without SUMMARY or over MAX_ACTIONS_PER_RUN, all measured runs' });
  }, 'Runs without SUMMARY or over MAX_ACTIONS_PER_RUN, all measured runs');
  unit('B37', 'P3', 'Autoplay throughput per core', () => {
    nowOnly();
    const health = req(S.health, 'health');
    const tp = Object.values(health.autoplayRunsPerMinPerCore);
    add('B37', 'P3', `Autoplay throughput per core (${Object.entries(health.autoplayRunsPerMinPerCore).map(([c, v]) => `${c} ${v}`).join(', ')})`, `min ${Math.min(...tp)} runs/min`, `>= ${BAL.SIM_RUNS_PER_MIN_MIN}`, Math.min(...tp) >= BAL.SIM_RUNS_PER_MIN_MIN);
  });
  // B48-B55, B53 (combat-v2.md 12; stage G cells masher-P0 and opener-P0, B53 from the planner).
  ccRows(['B48', 'B49', 'B50', 'B51', 'B52', 'B53', 'B54', 'B55']);
  if (S.now) for (const [id, pri, metric, need] of [['B48', 'P1', 'Opening value', 'opener-P0'], ['B49', 'P1', 'Mashing works, to an extent', 'masher-P0'], ['B50', 'P1', 'The opening decides', 'masher-P0'], ['B55', 'P1', 'Wind-ups answered in elite and dungeon-boss fights', 'opener-P0']]) {
    if (!S.pooled(need) && !rows.some((r) => r.id === id)) add(id, pri, metric, 'n/a (not run)', '', null);
  }
  // B58, B56, B57 (expedition.md H.6, M2b v6): stage H cells, the planner P0 cell and the B57 arm.
  const hc = { planner: S.pooled('heat:planner'), seek: S.pooled('heat:seek'), avoid: S.pooled('heat:avoid'), noHeat: S.pooled('heat:off') };
  for (const r of heatChecks(hc)) add(r.id, r.pri, r.metric, r.value, r.target, r.ok, { note: r.note });
  if (S.now) {
    if (!hc.seek || !hc.avoid) add('B58', 'P1', 'Heat is a real option', 'n/a (not run)', '', null);
    if (!hc.seek) add('B56', 'P2', 'Heat is used, not forced', 'n/a (not run)', '', null);
    if (!hc.noHeat) add('B57', 'P2', 'Heat rewards do not inflate power', 'n/a (not run: no --heat-off arm)', '', null);
  }
  return rows;
}

/** Before value of a check re-measured on the --before-pass directory with the current definition. */
function beforeOf(f) {
  const r = f();
  return { value: r.value, result: res(r.ok) };
}
/**
 * B12 (M2 v4): median of the speedrunner's PALL wins (autoplay profile) <= SPEED_RATIO_MAX × B11 and <= MIN_SPEED_MAX;
 * p10 reported without a target (MIN_SPEED_P10_MAX is report-only; a number there would still be applied).
 */
function b12Check(sp, b11v) {
  const v = sp.minutesWinAuto.v;
  const p10 = sp.minutesWinAutoP10;
  const p10Max = typeof BAL.MIN_SPEED_P10_MAX === 'number' ? BAL.MIN_SPEED_P10_MAX : null;
  const ok = v !== null && v <= BAL.SPEED_RATIO_MAX * b11v && v <= BAL.MIN_SPEED_MAX && (p10Max === null || p10 <= p10Max);
  return {
    value: `median ${num(v)} min (${num(v / b11v, 2)} × B11), p10 ${num(p10)} min${p10Max === null ? ' (reported)' : ''}; n=${sp.minutesWinAuto.n}`,
    target: `median <= ${BAL.SPEED_RATIO_MAX} × B11 and <= ${BAL.MIN_SPEED_MAX} min; ${p10Max === null ? 'p10 reported, no target' : `p10 <= ${p10Max} min`}`,
    ok, miss: miss(v, null, Math.min(BAL.MIN_SPEED_MAX, BAL.SPEED_RATIO_MAX * b11v)),
  };
}
/**
 * B17 time budget (M2 v4, rules 11.2): planner P0 median hours at the boss - planner PALL median <= META_TIME_BUDGET_H
 * (a rules constant: read from the engine). p0 / pall: run records (all classes pooled).
 */
function timeBudgetCheck(p0, pall) {
  const d = timeBudget(p0, pall);
  const budget = C.META_TIME_BUDGET_H;
  const has = typeof budget === 'number';
  return {
    metric: `Time budget: planner P0 median hours at boss - planner PALL median (P0 ${num(d.p0, 0)} h, PALL ${num(d.pall, 0)} h)`,
    value: d.v === null ? 'n/a' : `${num(d.v, 1)} h (${ci(d.ci, (x) => num(x, 1))})`,
    target: has ? `<= ${budget} h (META_TIME_BUDGET_H)` : 'META_TIME_BUDGET_H (not in this engine)',
    ok: has && d.v !== null ? d.v <= budget : null, miss: has ? miss(d.v, null, budget) : 0,
  };
}
/**
 * B21, B24, B38 (definitions of M2 v3) for planner P0 metrics `x`: [{ id, pri, metric, value, target, ok, miss }].
 */
function riskChecks(x) {
  const out = [];
  const push = (id, pri, metric, value, target, ok, missSize) => out.push({ id, pri, metric, value, target, ok, miss: missSize });
  const d = x.deathStageRuns;
  push('B21', 'P1', 'Runs dying in Z1-Z2 (planner P0, share of all runs)', rcell(d.early), `<= ${pct(BAL.DEATH_EARLY_MAX)}`, d.early.p <= BAL.DEATH_EARLY_MAX, miss(d.early.p, null, BAL.DEATH_EARLY_MAX));
  push('B21', 'P1', 'Runs dying in Z3-Z4 (share of all runs)', rcell(d.mid), band(BAL.DEATH_MID), inBand(d.mid.p, BAL.DEATH_MID), miss(d.mid.p, ...BAL.DEATH_MID));
  push('B21', 'P1', 'Runs dying in Z5-Z6 or Camp waves (share of all runs)', rcell(d.late), band(BAL.DEATH_LATE), inBand(d.late.p, BAL.DEATH_LATE), miss(d.late.p, ...BAL.DEATH_LATE));
  const b = x.deathStage.boss;
  push('B21', 'P1', 'Deaths at the end boss (share of deaths)', rcell(b), band(BAL.DEATH_BOSS), inBand(b.p, BAL.DEATH_BOSS), miss(b.p, ...BAL.DEATH_BOSS));
  const cf = x.closeFights;
  push('B24', 'P2', `Won non-boss fights whose lowest HP fell below ${pct(BAL.CLOSE_FIGHT_HP, 0)} (planner P0; ending below 20 %: ${pct(x.closeFightsEnd.p)})`, rcell(cf), band(BAL.CLOSE_FIGHT), cf.n ? inBand(cf.p, BAL.CLOSE_FIGHT) : null, miss(cf.p, ...BAL.CLOSE_FIGHT));
  const t = x.tension;
  const zs = t.zones.map((z) => (z.v === null ? 'n/a' : num(z.v * 100, 0))).join(' / ');
  const okT = t.spread === null || t.z6 === null ? null : t.spread <= BAL.TENSION_SPREAD_MAX && t.z6 <= BAL.TENSION_Z6_MAX;
  push('B38', 'P1', `Tension: mean lowest HP % in won non-boss fights by zone, planner P0 (Z1..Z6: ${zs})`,
    t.spread === null ? 'n/a' : `Z2-Z5 spread ${num(t.spread * 100, 1)} pp, Z6 ${pct(t.z6)}`,
    `spread <= ${num(BAL.TENSION_SPREAD_MAX * 100, 0)} pp, Z6 <= ${pct(BAL.TENSION_Z6_MAX, 0)}`, okT,
    Math.max(miss(t.spread, null, BAL.TENSION_SPREAD_MAX), miss(t.z6, null, BAL.TENSION_Z6_MAX)));
  return out;
}

// ---------------- Now and before ----------------
let camp = null;
if (existsSync(join(IN, 'campaigns', 'campaigns.json'))) {
  const cj = readJson(join(IN, 'campaigns', 'campaigns.json'));
  camp = { ...campaignMetricsByClass(cj.classes), meta: cj.meta };
}
NOW.camp = camp;
NOW.health = existsSync(join(IN, 'health.json')) ? readJson(join(IN, 'health.json')) : null;
const ORDER = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B38', 'B25', 'B26', 'B27', 'B28', 'B29', 'B30', 'B31', 'B32', 'B33', 'B34', 'B35', 'B36', 'B37', 'B48', 'B49', 'B50', 'B51', 'B52', 'B53', 'B54', 'B55', 'B58', 'B56', 'B57'];
const sortRows = (rs) => rs.map((r, i) => ({ r, i })).sort((a, b) => (ORDER.indexOf(a.r.id) - ORDER.indexOf(b.r.id)) || (a.i - b.i)).map((x) => x.r);
const rows = sortRows(buildChecks(NOW));
if (BSRC) {
  const bmap = new Map();
  for (const r of buildChecks(BSRC)) if (!bmap.has(keyOf(r))) bmap.set(keyOf(r), r);
  for (const r of rows) {
    if (r.before !== undefined) continue;
    const b = bmap.get(keyOf(r));
    r.before = b && !/^n\/a/.test(b.value) ? { value: b.value, result: res(b.ok) } : null;
  }
} else if (BEFORE) {
  const ordinal = {};
  for (const r of rows) {
    if (r.pri === 'diag') continue;
    ordinal[r.id] = (ordinal[r.id] || 0) + 1;
    if (r.before === undefined) r.before = BEFORE.checks.get(`${r.id}#${ordinal[r.id]}`) || null;
  }
}
const HAS_BEFORE = !!(BSRC || BEFORE);

// ---------------- Rendering ----------------
const L = [];
const metricIds = [...new Set(rows.map((r) => r.id))];
const failed = rows.filter((r) => r.ok === false);
const p1 = rows.filter((r) => r.pri === 'P1');
const shortMetric = (r) => stripParens(r.metric);
const invocations = (pass.meta.runsBy || []).map((x) => `${x.stages} at ${x.commit}`).join('; ');
const sizeOf = (name) => (pass.cells[name] ? pass.cells[name].runs : 'not run');
L.push(`Setup: pass ${IN} (seeds ${pass.meta.seedBase} onward; runs per class: planner P0 ${sizeOf('planner-P0-tree0')}, P10 ${sizeOf('planner-P10')}, PALL ${sizeOf('planner-PALL-tree0')}, B26-B28 variants ${sizeOf('planner-PALL-noInterrupt')}, masher ${sizeOf('masher-P0')}, opener ${sizeOf('opener-P0')}, tactician P0 ${sizeOf('tactician-P0')}${pass.cells['tactician-P0-b5'] ? ` (B5 fallback cell ${sizeOf('tactician-P0-b5')})` : ''}, tactician PALL ${sizeOf('tactician-PALL')}, heat-seek / heat-avoid ${sizeOf('planner-P0-heatSeek')}; campaigns ${camp ? camp.meta.count : 'not run'} per class; ${pass.meta.workers} workers${invocations ? `; invocations: ${invocations}` : `; commit ${pass.meta.commit}`}).${HEAT_OFF ? ` B57 arm: ${HEAT_OFF}.` : ''}${BSRC ? ` Before (re-measured with today's definitions and targets): ${args['before-label'] || ''}${BC ? ` combat and M2 checks from ${BC} (commit ${BC_META ? BC_META.commit : 'n/a'}; ${BC_META ? BC_META.runs : 'n/a'} runs per class, tactician ${BC_META ? BC_META.tactRuns : 'n/a'}, opener ${BC_META ? BC_META.openerRuns : 'n/a'})` : ''}${BH ? `; heat checks from ${BH} (commit ${BH_META ? BH_META.commit : 'n/a'}; ${BH_META ? BH_META.runs : 'n/a'} runs per class)${BHO ? ` and ${BHO}` : ''}` : ''}.` : ''}`, '');
L.push(`Pass/fail: ${rows.filter((r) => r.ok === true).length} checks pass, ${failed.length} fail, ${rows.filter((r) => r.ok === null).length} not measurable or diagnostic, over ${metricIds.length} targets. P1: ${p1.filter((r) => r.ok === true).length} pass, ${p1.filter((r) => r.ok === false).length} fail.`, '');
const p1Scored = p1.filter((r) => r.ok !== null);
const p1NotRun = p1.filter((r) => r.ok === null);
L.push(`**P1: ${p1Scored.filter((r) => r.ok).length} of ${p1Scored.length} pass; failures: ${p1Scored.filter((r) => !r.ok).map((r) => `${r.id} ${shortMetric(r)} (${r.value})`).join('; ') || 'none'}.**${p1NotRun.length ? ` Not run or not measurable: ${p1NotRun.map((r) => `${r.id} ${shortMetric(r)}`).join('; ')}.` : ''}`, '');
if (HAS_BEFORE) {
  const changed = rows.filter((r) => r.before && r.ok !== null && ['pass', '**FAIL**'].includes(r.before.result) && (r.before.result === 'pass') !== (r.ok === true));
  L.push(`Before${BEFORE && !BSRC ? ` (${BEFORE.file}): ${BEFORE.summary}` : ':'} Changed result: ${changed.filter((r) => r.ok).length} now pass (${changed.filter((r) => r.ok).map((r) => `${r.id} ${shortMetric(r)}`).join('; ') || 'none'}), ${changed.filter((r) => !r.ok).length} now fail (${changed.filter((r) => !r.ok).map((r) => `${r.id} ${shortMetric(r)}`).join('; ') || 'none'}).`, '');
  L.push(table(['ID', 'Pri', 'Metric', 'Before: value', 'Before', 'Now: value (95 % interval)', 'Target', 'Now'], rows.map((r) => [r.id, r.pri, r.metric + (r.note ? ` (${r.note})` : ''), r.before ? r.before.value : 'n/a', r.before ? r.before.result : 'n/a', r.value, r.target, res(r.ok)])));
} else {
  L.push(table(['ID', 'Pri', 'Metric', 'Value (95 % interval)', 'Target', 'Result'], rows.map((r) => [r.id, r.pri, r.metric + (r.note ? ` (${r.note})` : ''), r.value, r.target, res(r.ok)])));
}
L.push('');
L.push('### Misses ranked by size (distance outside the band in band widths; P1 first; combat and heat rows count 1)', '');
const ranked = failed.slice().sort((a, b) => (a.pri === b.pri ? 0 : a.pri === 'P1' ? -1 : b.pri === 'P1' ? 1 : a.pri < b.pri ? -1 : 1) || b.miss - a.miss);
L.push(table(['#', 'ID', 'Pri', 'Metric', 'Value', 'Target', 'Miss'], ranked.map((r, i) => [i + 1, r.id, r.pri, r.metric, r.value, r.target, num(r.miss, 2)])));
L.push('');

// Supporting tables
L.push('### Win rate and reach-the-boss rate by bot, profile and class', '');
const cellRows = [];
const cellList = ['random-P0', 'greedy-P0', 'planner-P0', 'speedrunner-P0', 'tactician-P0', 'masher-P0', 'opener-P0', ...(b5Fallback ? ['tactician-P0-groupTrees'] : []), 'tactician-P0-rulesOnly', 'planner-P0-heatSeek', 'planner-P0-heatAvoid', 'random-P10', 'planner-P10', 'random-PALL', 'greedy-PALL', 'planner-PALL', 'speedrunner-PALL', 'tactician-PALL', 'planner-PALL-noInterrupt', 'planner-PALL-noCleanse', 'planner-PALL-noAoe'];
const beforeCell = (name) => {
  if (BSRC) {
    const bname = name === 'planner-P0-heatSeek' ? 'heat:seek' : name === 'planner-P0-heatAvoid' ? 'heat:avoid' : name;
    const c = BSRC.cells(bname);
    if (!c) return 'n/a';
    const all = Object.values(c).flat();
    return `${CLASSES.map((k) => (c[k] ? `${pct(winRate(c[k]).p)} / ${pct(reachRate(c[k]).p, 0)}` : 'n/a')).join('; ')}; ${pct(winRate(all).p)} / ${pct(reachRate(all).p, 0)} (n=${all.length})`;
  }
  const b = BEFORE ? BEFORE.cells.get(name) : null;
  return b ? b.slice(2, 6).join('; ') : 'n/a';
};
for (const name of cellList) {
  const pooledM = NOW.P(name);
  if (!pooledM) continue;
  cellRows.push([name, pooledM.n, ...CLASSES.map((c) => { const x = NOW.P(name, c); return x ? `${pct(x.win.p)} / ${pct(x.boss.p, 0)}` : 'n/a'; }), `${pct(pooledM.win.p)} / ${pct(pooledM.boss.p, 0)}`, ...(HAS_BEFORE ? [beforeCell(name)] : []), num(pooledM.msPerRun.v, 0)]);
}
L.push(table(['Cell', 'Runs', ...CLASSES.map((c) => `${c}: win / boss`), 'All: win / boss', ...(HAS_BEFORE ? ['Before: rogue; mage; hunter; all (win / boss)'] : []), 'ms/run'], cellRows));
L.push('');
if (treesPALL) L.push('planner-P0 and planner-PALL are the default-tree cells of each class (planner-P0-tree<t>, planner-PALL-tree<t>; table below); every other P0 and P10 cell plays the P0-group trees, every other PALL cell the PALL-group trees.', '');
if (b5Fallback) L.push(`tactician-P0 is the B5 fallback cell (counts for B1 tactician and B5): ${b5Fallback.rerun.join(', ')} from tactician-P0-b5, the other classes from the tactician on the P0-group trees (tactician-P0-groupTrees, the directory tactician-P0).`, '');
if (pass.treeChoice) {
  // Default trees per profile group (balance.md 1.3, M2 v5): recomputed from the cells with the pass's incumbents.
  L.push(`Default trees (balance.md 1.3, M2 v5; switch rule: a challenger replaces the incumbent when its planner win rate is higher by more than TREE_SWITCH_Z = ${BAL.TREE_SWITCH_Z} standard errors of the difference). P0-group trees: ${treeSet(trees)}. PALL-group trees: ${treesPALL ? treeSet(treesPALL) : 'n/a (stage C not run)'}. Hunter pet: ridgewolf for every bot except random (random picks one at random).`, '');
  const treeRows = [];
  for (const [group, prefix, chosen] of [['P0', 'planner-P0-tree', trees], ['PALL', 'planner-PALL-tree', treesPALL]]) {
    if (!chosen || !pass.incumbents || !pass.incumbents[group]) continue;
    for (const cls of CLASSES) {
      const byTree = [0, 1, 2].map((t) => NOW.P(`${prefix}${t}`, cls));
      if (byTree.some((x) => !x)) continue;
      const sw = treeSwitch(byTree, pass.incumbents[group][cls]);
      const b = sw.best;
      treeRows.push([group, cls, ...byTree.map((x) => `${pct(x.win.p)} (n=${x.win.n})`), treeName(cls, sw.incumbent), `${treeName(cls, b.tree)} (${pct(b.p)})`, `${b.gap >= 0 ? '+' : ''}${num(b.gap * 100, 1)} pp`, `${num(b.threshold * 100, 1)} pp`, `${treeName(cls, sw.tree)} (${sw.switched ? 'switch' : 'kept'})`]);
    }
  }
  L.push(table(['Group', 'Class', 'Tree 0', 'Tree 1', 'Tree 2', 'Incumbent', 'Best challenger', 'Gap', 'Threshold', 'Default'], treeRows));
  L.push('');
  if (pass.b5) {
    L.push(b5Fallback
      ? `B5 fallback (balance.md 1.3, M2 v5) applied: on the P0-group trees B5 was ${pct(pass.b5.onGroupTrees)} (floor ${pct(pass.b5.floor)}${pass.b5.floorSource ? `, ${pass.b5.floorSource}` : ''}); the P0 tactician was re-run with each class's best B7 point-estimate tree (${treeSet(pass.b5.trees)}; re-run: ${pass.b5.rerun.join(', ') || 'none'}, the other classes keep their runs on the same tree and seeds) and that cell counts for B1 tactician and B5.`
      : `B5 fallback (balance.md 1.3, M2 v5) not needed: B5 on the P0-group trees ${pct(pass.b5.onGroupTrees)} (floor ${pct(pass.b5.floor)}${pass.b5.floorSource ? `, ${pass.b5.floorSource}` : ''}).`, '');
  }
} else {
  L.push(`Default trees (B7 best planner win rate, ties by reach-boss rate): ${Object.entries(trees).map(([c, t]) => `${c} tree ${t}`).join(', ')}. Hunter pet: ridgewolf for every bot except random (random picks one at random).`, '');
}

if (NOW.P('planner-P0')) {
  L.push('### Planner P0 by class', '');
  const pc = CLASSES.map((c) => NOW.P('planner-P0', c));
  const prow = (label, f) => [label, ...pc.map(f)];
  L.push(table(['Metric', ...CLASSES], [
    prow('Win rate', (x) => rcell(x.win)),
    prow('Reach the boss', (x) => rcell(x.boss)),
    prow('Boss fights won', (x) => rcell(x.bossWin)),
    prow('Median minutes at boss (manual)', (x) => num(x.minutesBossManual.v)),
    prow('Median hours at boss / Ascendancy', (x) => `${num(x.hoursBoss.v, 0)} / ${num(x.ascBoss.v, 2)}`),
    prow('Mean ilvl at boss / rare share', (x) => `${num(x.ilvlBoss.v)} / ${pct(x.rareShareBoss.v, 0)}`),
    prow('Rounds: normal / elite / trash / dungeon boss / end boss', (x) => ['normal', 'elite', 'trash', 'dboss', 'boss'].map((k) => num(x.rounds[k].v, 0)).join(' / ')),
    prow('Runs dying in Z1-2 / Z3-4 / Z5-6+camp (share of runs)', (x) => ['early', 'mid', 'late'].map((k) => pct(x.deathStageRuns[k].p, 1)).join(' / ')),
    prow('Deaths: Z1-2 / Z3-4 / Z5-6+camp / boss (share of deaths)', (x) => ['early', 'mid', 'late', 'boss'].map((k) => pct(x.deathStage[k].p, 0)).join(' / ')),
    prow('Mean lowest HP in won non-boss fights, Z1..Z6 (%)', (x) => x.tension.zones.map((z) => num(z.v === null ? null : z.v * 100, 0)).join(' / ')),
    prow(`Won non-boss fights dipping below ${pct(BAL.CLOSE_FIGHT_HP, 0)} / ending below 20 %`, (x) => `${pct(x.closeFights.p)} / ${pct(x.closeFightsEnd.p)}`),
    prow('Non-boss deaths by type', (x) => Object.entries(x.deathType).map(([k, v]) => `${k} ${pct(v.p, 0)}`).join(', ')),
    prow('Boss losses: phase 1 / 2 / 3 / enrage', (x) => ['1', '2', '3', 'enrage'].map((k) => pct(x.bossLossPhase[k].p, 0)).join(' / ')),
    prow('Boss HP left at loss (median)', (x) => pct(x.bossHpLeft.v, 0)),
    prow('Level leaving Z1..Z6', (x) => x.travelLv.map((y) => num(y.v, 0)).join(', ')),
    prow('Echoes per run / per win', (x) => `${num(x.echoes.v, 0)} / ${num(x.echoesWin.v, 0)}`),
    prow('Rests / potions (runs at boss)', (x) => `${num(x.rests.v)} / ${num(x.potions.v)}`),
    prow('Dungeons cleared per run (all runs / runs at boss)', (x) => `${num(x.dungeons.v, 2)} / ${num(x.dungeonsBoss.v, 2)}`),
  ]));
  L.push('');
}

// Heat cells (expedition.md H.6), now and before.
const heatSets = [['now', NOW], ...(BSRC && BH ? [['before', BSRC]] : [])];
if (NOW.pooled('heat:seek') || NOW.pooled('heat:avoid')) {
  L.push('### Heat policies, planner P0 (expedition.md H.6; heat-seek / heat-avoid: sim/bots/planner.mjs plannerHeat and plannerHourMult)', '');
  const hRows = [];
  const pRows = [];
  for (const [label, S] of heatSets) {
    for (const [cname, name] of [[`planner (hour weight ${label === 'now' ? BAL.PLANNER_HOUR_MULT : 2})`, 'heat:planner'], ['heat-seek', 'heat:seek'], ['heat-avoid', 'heat:avoid'], ['planner, engine without heat rewards (B57 arm)', 'heat:off']]) {
      const byCls = S.cells(name);
      if (!byCls) continue;
      const x = heatCell(Object.values(byCls).flat());
      hRows.push([label, cname, x.n, ...CLASSES.map((c) => { const y = heatCell(byCls[c] || []); return `${pct(y.win.p)} / ${pct(y.reach.p)}`; }), `${pct(x.win.p)} / ${pct(x.reach.p)}`, num(x.hours, 0), num(x.asc, 2), pct(x.hotRuns.p)]);
    }
    const pl = S.pooled('heat:planner');
    const sk = S.pooled('heat:seek');
    const av = S.pooled('heat:avoid');
    const of = S.pooled('heat:off');
    for (const [lab, a, b] of [['heat-seek - planner', sk, pl], ['heat-avoid - planner', av, pl], ['heat-seek - heat-avoid', sk, av], ['planner - engine without heat rewards', pl, of]]) {
      if (a && b) pRows.push([label, lab, dcell(pairedDiff(a, b, win)), dcell(pairedDiff(a, b, (r) => r.rb))]);
    }
  }
  L.push(table(['Pass', 'Cell', 'Runs', ...CLASSES.map((c) => `${c}: win / boss`), 'All: win / boss', 'Median hours at the boss', 'Median Ascendancy', 'Runs with a Hot or Scorched node'], hRows));
  L.push('');
  L.push('Paired differences (all classes, same seeds and starting risk table):', '');
  L.push(table(['Pass', 'Pair', 'Win', 'Reach the boss'], pRows));
  L.push('');
}

// Combat v2 detail (stage G).
const op = NOW.pooled('opener-P0');
const ma = NOW.pooled('masher-P0');
if (op || ma) {
  L.push('### Combat v2: deaths per 1 000 non-boss fights, wind-ups answered (elite and dungeon boss), by bot (P0)', '');
  const cRows = [];
  for (const [bot, name] of [['planner', 'planner-P0'], ['masher', 'masher-P0'], ['opener', 'opener-P0'], ['tactician', 'tactician-P0']]) {
    const all = NOW.pooled(name);
    if (!all) continue;
    const d = deathRate(all);
    const el = windupStats(all, new Set([FIGHT_KINDS.indexOf('elite')]));
    const db = windupStats(all, new Set([FIGHT_KINDS.indexOf('dboss')]));
    cRows.push([bot, all.length, `${num(d.per1000, 2)} (${d.deaths}/${d.fights})`, el.share.n ? pct(el.share.p) : 'n/a', db.share.n ? pct(db.share.p) : 'n/a', num(median(all.filter((r) => r.out !== 'x').map((r) => r.fights)), 0)]);
  }
  L.push(table(['Bot', 'Runs', 'Non-boss deaths per 1 000 fights', 'Elite wind-ups answered', 'Dungeon-boss wind-ups answered', 'Median fights per run'], cRows));
  L.push('');
  if (ma) {
    const s = replayStats(ma);
    const byCls = CLASSES.map((c) => { const x = replayStats(NOW.cells('masher-P0')[c] || []); return `${c} ${x.n ? `${pct(x.opener.p)} / ${pct(x.auto.p)}` : 'n/a'}`; }).join('; ');
    L.push(`B50 replays: ${s.n} masher non-boss deaths replayed; survive with the opener's first ${C2.OPEN_ROUNDS} rounds ${pct(s.opener.p)}, with autoplay's ${pct(s.auto.p)}, masher replayed ${pct(s.control.p)} (control, must be 0 %). By class (opener / autoplay): ${byCls}.`, '');
  }
  if (op) {
    L.push('Engage-round choices of the opener in multi-enemy fights (B51), by class:', '');
    L.push(table(['Class', 'Fights', 'Strike', 'Control', 'Setup', 'Bar spell or other'], engageTable(op)));
    L.push('');
  }
}
if (camp) {
  L.push('### Campaigns (B31, B32)', '');
  L.push(table(['Class', 'Completed', 'Median runs', 'Fewest', 'Win rate 1-5', 'Win rate 21-30', 'Largest dip (counted blocks / all blocks)', 'Echoes per run'],
    [...Object.entries(camp.per), ['all', camp.all]].map(([c, x]) => [c, `${x.completed}/${x.n}`, `${x.medianRuns}`, `${x.minRuns ?? 'n/a'}`, pct(x.wr1to5.p), pct(x.wr21to30.p), `${pct(x.maxDip)} / ${pct(x.maxDipAll)}`, num(x.echoesPerRun, 0)])));
  L.push('');
  L.push(`Win rate by block of 5 runs (all classes; B32 dip counts blocks with >= ${BAL.CURVE_BLOCK_MIN_RUNS} runs): ${blockList(camp.all.blocks)}`, '');
}
L.push('### Final death-risk tables of the planner (balance.md 5: report the final values)', '');
for (const [prof, file] of [['P0', 'obs-P0.json'], ['PALL', 'obs-PALL.json']]) {
  if (!existsSync(join(IN, file))) continue;
  const obsAll = readJson(join(IN, file));
  for (const cls of CLASSES) {
    const t = buildTable(obsAll[cls]);
    L.push(`${prof}, ${cls} (${obsAll[cls].runs} runs observed): P(death) at full HP by CL - L`, '');
    L.push(table(['Type', 'Entries', 'Deaths', 'Rate', 'dl -2', '0', '+2', '+4', '+6', '+8'], tableSummary(t, obsAll[cls]).map((r) => [r.type, r.entries, r.deaths, pct(r.rate, 2), ...r.pFullHpByDl.map((x) => pct(x, 1))])));
    L.push('');
  }
}
L.push('### Cost', '');
L.push(table(['Cell', 'Wall time (s)', 'Runs'], Object.entries(pass.cells).map(([k, v]) => [k, v.wallS, `${v.runs} × ${v.classes.length}`])));
L.push('');

const generated = `<!-- generated:start (node sim/report.mjs --in ${IN} --out ${OUT}) -->\n${L.join('\n')}\n<!-- generated:end -->`;
let text;
if (existsSync(OUT)) {
  const old = readFileSync(OUT, 'utf8');
  const a = old.indexOf('<!-- generated:start');
  const b = old.indexOf('<!-- generated:end -->');
  text = a >= 0 && b > a ? old.slice(0, a) + generated + old.slice(b + '<!-- generated:end -->'.length) : `${old}\n${generated}\n`;
} else {
  text = `# Balance report (generated)\n\n${generated}\n`;
}
writeFileSync(OUT, text);
console.log(`wrote ${OUT}: ${rows.length} checks, ${failed.length} fail; P1 ${p1Scored.filter((r) => r.ok).length} of ${p1Scored.length} pass`);
