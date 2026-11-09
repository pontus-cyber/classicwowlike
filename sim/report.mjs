#!/usr/bin/env node
// Balance report from a pass directory (sim/pass.mjs): every target B1-B37 of docs/specs/balance.md with value,
// 95 % interval, target and pass/fail, plus supporting tables. Writes the generated part between the markers
// <!-- generated:start --> and <!-- generated:end --> of the report file, so hand-written analysis outside the
// markers survives a regeneration.
//
//   node sim/report.mjs --in sim/out/pass-2026-11-09 --out docs/reports/balance-2026-11-09.md
//                       [--before docs/reports/balance-<earlier>.md]
// --before: an earlier report made by this script; its generated tables give a "Before" column (checks matched by
// ID and order within the ID, diagnostic rows excluded; cells by name). Results there are against the targets of
// that report's date.
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BAL } from './lib/params.mjs';
import { cellMetrics } from './lib/metrics.mjs';
import { campaignMetrics } from './lib/campaignreport.mjs';
import { rate, diffRate, median, quantile } from './lib/stats.mjs';
import { readJson, readJsonl, pct, num, ci, table } from './lib/output.mjs';
import { TIME_PROFILE } from './bots/index.mjs';
import { tableSummary, buildTable } from './lib/risk.mjs';
import { CLASSES } from './lib/session.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) o[argv[i].replace(/^--/, '')] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return o;
}
const args = parse(process.argv.slice(2));
const IN = args.in;
const OUT = args.out;
const BEFORE = args.before ? parseBefore(readFileSync(args.before, 'utf8')) : null;

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
      count[c[0]] = (count[c[0]] || 0) + 1;
      checks.set(`${c[0]}#${count[c[0]]}`, { value: c[3], result: c[5] });
    } else if (head[0] === 'Cell' && head[1] === 'Runs') cells.set(c[0], c);
  }
  return { checks, cells, summary, file: args.before };
}
const pass = readJson(join(IN, 'pass.json'));
const trees = pass.trees;

// ---------------- Loading ----------------
const cache = new Map();
/** Records of a cell per class (from runs-<class>.jsonl). */
function recs(name) {
  if (!cache.has(name)) {
    const dir = join(IN, name);
    if (!existsSync(join(dir, 'summary.json'))) { cache.set(name, null); return null; }
    const sum = readJson(join(dir, 'summary.json'));
    const out = {};
    for (const cls of Object.keys(sum.classes)) out[cls] = readJsonl(join(dir, `runs-${cls}.jsonl`));
    cache.set(name, out);
  }
  return cache.get(name);
}
/** The P0 planner cell of each class is its best-tree B7 cell. */
function plannerP0() {
  const out = {};
  for (const cls of CLASSES) out[cls] = recs(`planner-P0-tree${trees[cls]}`)[cls];
  return out;
}
const botOf = (name) => name.split('-')[0];
// Metrics of "<base>@<other>" cells use the base bot.
function metricsOf(byClass, bot, classes = Object.keys(byClass)) {
  const all = [];
  for (const c of classes) if (byClass[c]) all.push(...byClass[c]);
  return cellMetrics(all, { timeProfile: TIME_PROFILE[bot] });
}
function cellsFor(name) {
  if (name === 'planner-P0') return plannerP0();
  const at = name.indexOf('@');
  if (at > 0) {
    // "<base>@<other>": the base cell restricted to the seeds of the other cell (paired comparison).
    const base = cellsFor(name.slice(0, at));
    const other = cellsFor(name.slice(at + 1));
    const out = {};
    for (const c of Object.keys(other)) {
      const seeds = new Set(other[c].map((r) => r.seed));
      out[c] = base[c].filter((r) => seeds.has(r.seed));
    }
    return out;
  }
  return recs(name);
}
const M = new Map();
/** Pooled (all classes) or per-class metrics of a cell. */
function m(name, cls = null) {
  const key = `${name}|${cls}`;
  if (!M.has(key)) {
    const r = cellsFor(name);
    M.set(key, r ? metricsOf(r, botOf(name), cls ? [cls] : undefined) : null);
  }
  return M.get(key);
}

// ---------------- Target checks ----------------
const rows = [];
const inBand = (v, [lo, hi]) => v !== null && v !== undefined && v >= lo && v <= hi;
const band = ([lo, hi], f = pct) => `${f(lo)} - ${f(hi)}`;
const res = (ok) => (ok === null ? 'n/a' : ok ? 'pass' : '**FAIL**');
/** Miss size for ranking: distance outside the band in band widths (or relative to the bound). */
function miss(v, lo, hi) {
  if (v === null || v === undefined) return 1;
  const w = hi !== null && lo !== null ? Math.max(hi - lo, 1e-9) : Math.max(Math.abs(lo ?? hi), 1e-9);
  if (lo !== null && v < lo) return (lo - v) / w;
  if (hi !== null && v > hi) return (v - hi) / w;
  return 0;
}
const ordinal = {};
function add(id, pri, metric, value, target, ok, missSize = 0, note = '') {
  let before = null;
  if (pri !== 'diag') {
    ordinal[id] = (ordinal[id] || 0) + 1;
    if (BEFORE) before = BEFORE.checks.get(`${id}#${ordinal[id]}`) || null;
  }
  rows.push({ id, pri, metric, value, target, ok, miss: ok === false ? missSize : 0, note, before });
}
const rcell = (r) => (r && r.n ? `${pct(r.p)} (${ci(r.ci)})` : 'n/a');
const P = (name, cls) => m(name, cls);

// B1-B3: win rates
const B1 = { random: [null, BAL.WR_P0_RANDOM_MAX], greedy: BAL.WR_P0_GREEDY, planner: BAL.WR_P0_PLANNER, speedrunner: BAL.WR_P0_SPEED, tactician: BAL.WR_P0_TACTICIAN };
for (const [bot, b] of Object.entries(B1)) {
  const x = P(`${bot}-P0`).win;
  const lo = Array.isArray(b) && b[0] !== null ? b[0] : null;
  const hi = Array.isArray(b) ? b[1] : b;
  add('B1', 'P1', `Win rate P0, ${bot}`, rcell(x), lo === null ? `<= ${pct(hi)}` : band([lo, hi]), (lo === null || x.p >= lo) && x.p <= hi, miss(x.p, lo, hi));
}
{
  const x = P('planner-P10').win;
  add('B2', 'P1', 'Win rate P10, planner', rcell(x), band(BAL.WR_P10_PLANNER), inBand(x.p, BAL.WR_P10_PLANNER), miss(x.p, ...BAL.WR_P10_PLANNER));
  const y = P('random-P10').win;
  add('B2', 'P1', 'Win rate P10, random', rcell(y), `<= ${pct(BAL.WR_P10_RANDOM_MAX)}`, y.p <= BAL.WR_P10_RANDOM_MAX, miss(y.p, null, BAL.WR_P10_RANDOM_MAX));
}
const B3 = { random: [null, BAL.WR_PALL_RANDOM_MAX], greedy: BAL.WR_PALL_GREEDY, planner: BAL.WR_PALL_PLANNER, speedrunner: BAL.WR_PALL_SPEED, tactician: [null, BAL.WR_PALL_TACTICIAN_MAX] };
for (const [bot, b] of Object.entries(B3)) {
  const x = P(`${bot}-PALL`).win;
  const [lo, hi] = b;
  add('B3', 'P1', `Win rate PALL, ${bot}`, rcell(x), lo === null ? `<= ${pct(hi)}` : band([lo, hi]), (lo === null || x.p >= lo) && x.p <= hi, miss(x.p, lo, hi));
}
// B4, B5, B10: differences
for (const prof of ['P0', 'PALL']) {
  const d = diffRate(P(`planner-${prof}`).win, P(`random-${prof}`).win);
  add('B4', 'P1', `Planner - random, ${prof}`, `${pct(d.v)} (${ci(d.ci)})`, `>= ${pct(BAL.CHOICE_GAP_MIN)}`, d.v >= BAL.CHOICE_GAP_MIN, miss(d.v, BAL.CHOICE_GAP_MIN, null));
}
{
  const d = diffRate(P('tactician-P0').win, P('planner-P0').win);
  add('B5', 'P1', 'Tactician - planner, P0', `${pct(d.v)} (${ci(d.ci)})`, band(BAL.MANUAL_GAP), inBand(d.v, BAL.MANUAL_GAP), miss(d.v, ...BAL.MANUAL_GAP));
  const t = P('tactician-P0-rulesOnly');
  if (t) {
    // Diagnostic: half-size cell on the first seeds; compare with the planner and the tactician on the same seeds.
    const pl = P('planner-P0@tactician-P0-rulesOnly');
    const tp = P('tactician-P0@tactician-P0-rulesOnly');
    const dd = diffRate(t.win, pl.win);
    add('B5', 'diag', 'Tactician (as specified) - planner, P0, same seeds as the diagnostic', `${pct(diffRate(tp.win, pl.win).v)}`, band(BAL.MANUAL_GAP), null, 0, 'paired subset');
    add('B5', 'diag', 'Tactician telegraph rules only, autoplay otherwise (no search) - planner, P0, same seeds', `${pct(dd.v)} (${ci(dd.ci)})`, band(BAL.MANUAL_GAP), null, 0, 'diagnostic, not a balance.md bot');
  }
}
{
  const d = diffRate(P('planner-PALL').win, P('planner-P0').win);
  add('B10', 'P1', 'Planner PALL - P0', `${pct(d.v)} (${ci(d.ci)})`, band([BAL.META_GAP_MIN_PP, BAL.META_GAP_MAX_PP]), inBand(d.v, [BAL.META_GAP_MIN_PP, BAL.META_GAP_MAX_PP]), miss(d.v, BAL.META_GAP_MIN_PP, BAL.META_GAP_MAX_PP));
}
// B6: class band
for (const prof of ['P0', 'PALL']) {
  const w = CLASSES.map((c) => P(`planner-${prof}`, c).win.p);
  const mean = w.reduce((a, b) => a + b, 0) / 3;
  const dev = Math.max(...w.map((x) => Math.abs(x - mean)));
  const spread = Math.max(...w) - Math.min(...w);
  add('B6', 'P1', `Class band, planner ${prof} (${CLASSES.map((c, i) => `${c} ${pct(w[i])}`).join(', ')})`, `max deviation ${pct(dev)}, spread ${pct(spread)}`,
    `deviation <= ${pct(BAL.CLASS_BAND_PP)}, spread <= ${pct(BAL.CLASS_SPREAD_MAX_PP)}`, dev <= BAL.CLASS_BAND_PP && spread <= BAL.CLASS_SPREAD_MAX_PP, miss(spread, null, BAL.CLASS_SPREAD_MAX_PP));
}
// B7: trees
for (const cls of CLASSES) {
  const w = [0, 1, 2].map((t) => P(`planner-P0-tree${t}`, cls).win.p);
  const best = Math.max(...w);
  const worst = Math.min(...w);
  const ok = best > 0 ? worst >= BAL.TREE_FLOOR_RATIO * best : null;
  add('B7', 'P1', `Talent trees, ${cls} (${w.map((x, t) => `tree ${t} ${pct(x)}`).join(', ')})`, best > 0 ? `worst/best ${num(worst / best, 2)}` : 'no wins in any tree', `>= ${BAL.TREE_FLOOR_RATIO}`, best > 0 ? ok : false, best > 0 ? miss(worst / best, BAL.TREE_FLOOR_RATIO, null) : 1, best > 0 ? '' : 'not measurable');
}
// B8: route styles
const STYLES = ['balanced', 'quest', 'grind', 'elite', 'speed'];
for (const prof of ['P0', 'PALL']) {
  const stats = STYLES.map((st) => {
    const x = st === 'balanced' ? P(`planner-${prof}@planner-${prof}-quest`) : P(`planner-${prof}-${st}`);
    return { st, wr: x ? x.win.p : null, min: x ? x.minutesBoss.v : null };
  });
  const dom = stats.find((a) => stats.every((b) => b === a || (a.wr >= b.wr + BAL.DOM_MARGIN_PP && (a.min ?? Infinity) <= (b.min ?? Infinity))));
  add('B8', 'P2', `Route styles, planner ${prof} (${stats.map((x) => `${x.st} ${pct(x.wr)}/${num(x.min, 0)} min`).join(', ')})`, dom ? `${dom.st} dominates` : 'no dominant style', 'no dominant style', !dom, dom ? 1 : 0);
}
// B9: pets
{
  const pets = { ridgewolf: P('planner-P0', 'hunter'), thornback: P('planner-P0-thornback', 'hunter'), duskcat: P('planner-P0-duskcat', 'hunter') };
  const w = Object.values(pets).map((x) => x.win.p);
  const best = Math.max(...w);
  const worst = Math.min(...w);
  add('B9', 'P2', `Hunter pets (${Object.entries(pets).map(([k, x]) => `${k} ${pct(x.win.p)}`).join(', ')})`, best > 0 ? `worst/best ${num(worst / best, 2)}` : 'no wins with any pet', `>= ${BAL.PET_FLOOR_RATIO}`, best > 0 ? worst >= BAL.PET_FLOOR_RATIO * best : false, 1, best > 0 ? '' : 'not measurable');
}
// B11-B17: pacing
const pl = P('planner-P0');
const spA = P('speedrunner-PALL');
const b11 = pl.minutesBossManual.v;
add('B11', 'P1', 'Median run length, planner P0, runs reaching the boss (manual profile)', `${num(b11)} min (${ci(pl.minutesBossManual.ci, (x) => num(x))})`, `${BAL.MIN_NORMAL_LOW} - ${BAL.MIN_NORMAL_HIGH} min (aim ${BAL.MIN_NORMAL_TARGET})`, inBand(b11, [BAL.MIN_NORMAL_LOW, BAL.MIN_NORMAL_HIGH]), miss(b11, BAL.MIN_NORMAL_LOW, BAL.MIN_NORMAL_HIGH));
{
  const v = spA.minutesWinAuto.v;
  const p10 = spA.minutesWinAutoP10;
  const ok = v !== null && v <= BAL.SPEED_RATIO_MAX * b11 && v <= BAL.MIN_SPEED_MAX && p10 <= BAL.MIN_SPEED_P10_MAX;
  add('B12', 'P1', 'Speedrun length, speedrunner PALL wins (autoplay profile)', `median ${num(v)} min (${num(v / b11, 2)} × B11), p10 ${num(p10)} min; n=${spA.minutesWinAuto.n}`, `median <= ${BAL.SPEED_RATIO_MAX} × B11 and <= ${BAL.MIN_SPEED_MAX} min; p10 <= ${BAL.MIN_SPEED_P10_MAX} min`, ok, miss(v, null, Math.min(BAL.MIN_SPEED_MAX, BAL.SPEED_RATIO_MAX * b11)));
  const vm = spA.minutesWinManual.v;
  add('B13', 'P2', 'Speedrun played manually, speedrunner PALL wins (manual profile)', `median ${num(vm)} min (${num(vm / b11, 2)} × B11)`, `<= ${BAL.SPEED_MANUAL_RATIO_MAX} × B11`, vm !== null && vm <= BAL.SPEED_MANUAL_RATIO_MAX * b11, miss(vm, null, BAL.SPEED_MANUAL_RATIO_MAX * b11));
}
add('B14', 'P2', 'Nodes per run, planner P0 (runs reaching the boss)', `${num(pl.nodesBoss.v, 0)}`, `${BAL.NODES_NORMAL[0]} - ${BAL.NODES_NORMAL[1]}`, inBand(pl.nodesBoss.v, BAL.NODES_NORMAL), miss(pl.nodesBoss.v, ...BAL.NODES_NORMAL));
add('B14', 'P2', 'Nodes per run, speedrunner PALL (runs reaching the boss)', `${num(spA.nodesBoss.v, 0)}`, `${BAL.NODES_SPEED[0]} - ${BAL.NODES_SPEED[1]}`, inBand(spA.nodesBoss.v, BAL.NODES_SPEED), miss(spA.nodesBoss.v, ...BAL.NODES_SPEED));
add('B15', 'P2', 'Fights per run incl. boss, planner P0 (runs reaching the boss)', `${num(pl.fightsBoss.v, 0)}`, `${BAL.FIGHTS_NORMAL[0]} - ${BAL.FIGHTS_NORMAL[1]}`, inBand(pl.fightsBoss.v, BAL.FIGHTS_NORMAL), miss(pl.fightsBoss.v, ...BAL.FIGHTS_NORMAL));
for (const [k, label, b] of [['normal', 'normal encounter', BAL.ROUNDS_NORMAL], ['elite', 'elite', BAL.ROUNDS_ELITE], ['dboss', 'dungeon boss', BAL.ROUNDS_DBOSS], ['boss', 'end boss', BAL.ROUNDS_BOSS]]) {
  const x = pl.rounds[k];
  add('B16', 'P1', `Fight length, ${label} (planner P0, won fights)`, `${num(x.v, 1)} rounds (n=${x.n})`, `${b[0]} - ${b[1]}`, x.n ? inBand(x.v, b) : null, miss(x.v, ...b));
}
add('B17', 'P2', 'Hours at boss, planner P0 median', `${num(pl.hoursBoss.v, 0)} h`, `${BAL.HOURS_NORMAL[0]} - ${BAL.HOURS_NORMAL[1]} h`, inBand(pl.hoursBoss.v, BAL.HOURS_NORMAL), miss(pl.hoursBoss.v, ...BAL.HOURS_NORMAL));
add('B17', 'P2', 'Hours at boss, speedrunner PALL median', `${num(spA.hoursBoss.v, 0)} h`, `${BAL.HOURS_SPEED[0]} - ${BAL.HOURS_SPEED[1]} h`, inBand(spA.hoursBoss.v, BAL.HOURS_SPEED), miss(spA.hoursBoss.v, ...BAL.HOURS_SPEED));
add('B17', 'P2', 'Ascendancy at boss, planner P0 median', `${num(pl.ascBoss.v, 2)}`, `<= ${BAL.ASC_MEDIAN_MAX}`, pl.ascBoss.v <= BAL.ASC_MEDIAN_MAX, miss(pl.ascBoss.v, null, BAL.ASC_MEDIAN_MAX));
// B18-B20: character at the boss
add('B18', 'P1', 'Level 60 at boss, planner P0', rcell(pl.lvl60), `>= ${pct(BAL.LVL60_SHARE_MIN)}`, pl.lvl60.p >= BAL.LVL60_SHARE_MIN, miss(pl.lvl60.p, BAL.LVL60_SHARE_MIN, null));
{
  const sp0 = P('speedrunner-P0');
  add('B18', 'P1', 'Level at boss, speedrunner P0 median', `${num(sp0.lvlBoss.v, 0)}`, `>= ${BAL.LVL_SPEED_MEDIAN_MIN}`, sp0.lvlBoss.v >= BAL.LVL_SPEED_MEDIAN_MIN, miss(sp0.lvlBoss.v, BAL.LVL_SPEED_MEDIAN_MIN, null));
}
add('B19', 'P2', 'Mean equipped ilvl at boss, planner P0', `${num(pl.ilvlBoss.v)} (${ci(pl.ilvlBoss.ci, (x) => num(x))})`, `${BAL.ILVL_BOSS[0]} - ${BAL.ILVL_BOSS[1]}`, inBand(pl.ilvlBoss.v, BAL.ILVL_BOSS), miss(pl.ilvlBoss.v, ...BAL.ILVL_BOSS));
add('B19', 'P2', 'Rare-or-better share of the 10 slots at boss, planner P0', pct(pl.rareShareBoss.v), `>= ${pct(BAL.RARE_SHARE_MIN)}`, pl.rareShareBoss.v >= BAL.RARE_SHARE_MIN, miss(pl.rareShareBoss.v, BAL.RARE_SHARE_MIN, null));
{
  const lv = pl.travelLv.map((x) => x.v);
  const bad = lv.map((v, i) => (v === null || Math.abs(v - 10 * (i + 1)) > BAL.ZONE_LVL_SLACK ? `Z${i + 1}` : null)).filter(Boolean);
  add('B20', 'P2', 'Median level when leaving Z1..Z6, planner P0', lv.map((v) => num(v, 0)).join(', '), `10z ± ${BAL.ZONE_LVL_SLACK}`, bad.length === 0, bad.length / 6, bad.length ? `outside: ${bad.join(', ')}` : '');
}
// B21-B25: deaths and risk
{
  const d = pl.deathStage;
  add('B21', 'P1', 'Deaths in Z1-Z2 (planner P0, share of deaths)', rcell(d.early), `<= ${pct(BAL.DEATH_EARLY_MAX)}`, d.early.p <= BAL.DEATH_EARLY_MAX, miss(d.early.p, null, BAL.DEATH_EARLY_MAX));
  add('B21', 'P1', 'Deaths in Z3-Z4', rcell(d.mid), band(BAL.DEATH_MID), inBand(d.mid.p, BAL.DEATH_MID), miss(d.mid.p, ...BAL.DEATH_MID));
  add('B21', 'P1', 'Deaths in Z5-Z6 and Camp waves', rcell(d.late), band(BAL.DEATH_LATE), inBand(d.late.p, BAL.DEATH_LATE), miss(d.late.p, ...BAL.DEATH_LATE));
  add('B21', 'P1', 'Deaths at the end boss', rcell(d.boss), band(BAL.DEATH_BOSS), inBand(d.boss.p, BAL.DEATH_BOSS), miss(d.boss.p, ...BAL.DEATH_BOSS));
  const types = Object.entries(pl.deathType);
  const top = types[0];
  add('B22', 'P2', `Non-boss deaths by node type (${types.map(([k, v]) => `${k} ${pct(v.p, 0)}`).join(', ')})`, `largest: ${top ? `${top[0]} ${pct(top[1].p)}` : 'n/a'}`, `no type > ${pct(BAL.DEATH_TYPE_MAX)}`, top ? top[1].p <= BAL.DEATH_TYPE_MAX : null, top ? miss(top[1].p, null, BAL.DEATH_TYPE_MAX) : 0);
  const dun = pl.deathType.dungeon || rate(0, top ? top[1].n : 0);
  add('B22', 'P2', 'Dungeon share of non-boss deaths', rcell(dun), band(BAL.DEATH_DUNGEON), inBand(dun.p, BAL.DEATH_DUNGEON), miss(dun.p, ...BAL.DEATH_DUNGEON));
  const ph = pl.bossLossPhase;
  add('B23', 'P2', 'Boss losses in phase 1', rcell(ph['1']), `<= ${pct(BAL.BOSS_P1_LOSS_MAX)}`, ph['1'].p <= BAL.BOSS_P1_LOSS_MAX, miss(ph['1'].p, null, BAL.BOSS_P1_LOSS_MAX));
  const late = rate(ph['3'].k + ph.enrage.k, ph['3'].n);
  add('B23', 'P2', `Boss losses in phase 3 or enrage (phase 2: ${pct(ph['2'].p)})`, rcell(late), `>= ${pct(BAL.BOSS_LATE_LOSS_MIN)}`, late.p >= BAL.BOSS_LATE_LOSS_MIN, miss(late.p, BAL.BOSS_LATE_LOSS_MIN, null));
  add('B24', 'P2', 'Won non-boss fights ending below 20 % HP (planner P0)', rcell(pl.closeFights), band(BAL.CLOSE_FIGHT), inBand(pl.closeFights.p, BAL.CLOSE_FIGHT), miss(pl.closeFights.p, ...BAL.CLOSE_FIGHT));
  add('B25', 'P3', 'Rests per run (nodes + Inn), planner P0 runs reaching the boss', num(pl.rests.v), `${BAL.REST_COUNT[0]} - ${BAL.REST_COUNT[1]}`, inBand(pl.rests.v, BAL.REST_COUNT), miss(pl.rests.v, ...BAL.REST_COUNT));
  add('B25', 'P3', 'Potions used per run, planner P0 runs reaching the boss', num(pl.potions.v), `${BAL.POTION_COUNT[0]} - ${BAL.POTION_COUNT[1]}`, inBand(pl.potions.v, BAL.POTION_COUNT), miss(pl.potions.v, ...BAL.POTION_COUNT));
}
// B26-B29: boss mechanics
{
  for (const [id, pri, v, label] of [['B26', 'P1', 'noInterrupt', 'interrupt spells off the bar'], ['B27', 'P1', 'noCleanse', 'cleanse spells off the bar, no Tonic'], ['B28', 'P2', 'noAoe', 'AoE spells off the bar']]) {
    const x = P(`planner-PALL-${v}`);
    const base = P(`planner-PALL@planner-PALL-${v}`);
    const ratio = base.win.p > 0 ? x.win.p / base.win.p : null;
    add(id, pri, `Planner PALL with ${label}: win rate ${pct(x.win.p)} vs ${pct(base.win.p)} (same seeds)`, ratio === null ? 'n/a' : `ratio ${num(ratio, 2)}`, `<= ${BAL.MECH_RATIO_MAX}`, ratio === null ? null : ratio <= BAL.MECH_RATIO_MAX, miss(ratio, null, BAL.MECH_RATIO_MAX));
  }
  add('B29', 'P2', 'Boss losses to Final Dark, planner P0', rcell(pl.finalDarkLoss), band(BAL.ENRAGE_LOSS), inBand(pl.finalDarkLoss.p, BAL.ENRAGE_LOSS), miss(pl.finalDarkLoss.p, ...BAL.ENRAGE_LOSS));
}
// B30-B34: economy and meta
add('B30', 'P1', 'Echoes per run, planner P0 mean', `${num(pl.echoes.v, 0)} (${ci(pl.echoes.ci, (x) => num(x, 0))})`, `${BAL.ECHO_P0[0]} - ${BAL.ECHO_P0[1]}`, inBand(pl.echoes.v, BAL.ECHO_P0), miss(pl.echoes.v, ...BAL.ECHO_P0));
add('B30', 'P1', `Echoes per win, planner P0 mean (without the first-kill line: ${num(pl.echoesWinNoFirst.v, 0)})`, `${num(pl.echoesWin.v, 0)} (n=${pl.echoesWin.n})`, `${BAL.ECHO_WIN[0]} - ${BAL.ECHO_WIN[1]}`, pl.echoesWin.n ? inBand(pl.echoesWin.v, BAL.ECHO_WIN) : null, miss(pl.echoesWin.v, ...BAL.ECHO_WIN));
let camp = null;
if (existsSync(join(IN, 'campaigns', 'campaigns.json'))) {
  const cj = readJson(join(IN, 'campaigns', 'campaigns.json'));
  const all = Object.values(cj.classes).flat();
  camp = { all: campaignMetrics(all), per: Object.fromEntries(Object.entries(cj.classes).map(([c, x]) => [c, campaignMetrics(x)])), meta: cj.meta };
  const a = camp.all;
  const medNum = typeof a.medianRuns === 'number' ? a.medianRuns : null;
  add('B31', 'P1', `Runs to full catalogue, campaign median (completed ${a.completed}/${a.n})`, `${a.medianRuns}`, `${BAL.CAMPAIGN_RUNS[0]} - ${BAL.CAMPAIGN_RUNS[1]}`, medNum !== null && inBand(medNum, BAL.CAMPAIGN_RUNS), medNum === null ? 2 : miss(medNum, ...BAL.CAMPAIGN_RUNS));
  add('B31', 'P1', 'Fewest runs to full catalogue in any campaign', `${a.minRuns ?? 'none completed'}`, `>= ${BAL.CAMPAIGN_RUNS_MIN_ANY}`, a.minRuns === null ? null : a.minRuns >= BAL.CAMPAIGN_RUNS_MIN_ANY, 0);
  add('B32', 'P1', 'Campaign win rate, runs 1-5', rcell(a.wr1to5), band(BAL.WR_RUNS_1_5), inBand(a.wr1to5.p, BAL.WR_RUNS_1_5), miss(a.wr1to5.p, ...BAL.WR_RUNS_1_5));
  add('B32', 'P1', 'Campaign win rate, runs 21-30', rcell(a.wr21to30), band(BAL.WR_RUNS_21_30), inBand(a.wr21to30.p, BAL.WR_RUNS_21_30), miss(a.wr21to30.p, ...BAL.WR_RUNS_21_30));
  add('B32', 'P1', 'Largest dip between blocks of 5 runs', pct(a.maxDip), `<= ${pct(BAL.CURVE_DIP_PP)}`, a.maxDip <= BAL.CURVE_DIP_PP, miss(a.maxDip, null, BAL.CURVE_DIP_PP));
}
add('B33', 'P2', 'Hub and Camp trainer visits where gold covers TRAIN_ALL, planner P0', rcell(pl.trainAfford), `>= ${pct(BAL.TRAIN_AFFORD_MIN)}`, pl.trainAfford.p >= BAL.TRAIN_AFFORD_MIN, miss(pl.trainAfford.p, BAL.TRAIN_AFFORD_MIN, null));
add('B34', 'P3', 'Runs with an Ember bought by the boss, planner P0 runs reaching the boss', rcell(pl.emberBuy), band(BAL.EMBER_BUY), inBand(pl.emberBuy.p, BAL.EMBER_BUY), miss(pl.emberBuy.p, ...BAL.EMBER_BUY));
// B35-B37: engine health
const health = existsSync(join(IN, 'health.json')) ? readJson(join(IN, 'health.json')) : null;
if (health) add('B35', 'P1', `Replay of ${health.replay.runs} random runs from seed + action log`, `${health.replay.identical}/${health.replay.runs} identical`, '100 %', health.replay.identical === health.replay.runs, 0);
let stuck = 0;
let totalRuns = 0;
const errSamples = [];
for (const name of Object.keys(pass.cells)) {
  const r = recs(name);
  if (!r) continue;
  for (const list of Object.values(r)) for (const x of list) { totalRuns++; if (x.out === 'x') { stuck++; if (errSamples.length < 5) errSamples.push(`${name} ${x.cls} seed ${x.seed}: ${x.err}`); } }
}
add('B36', 'P1', `Runs without SUMMARY or over MAX_ACTIONS_PER_RUN, all ${totalRuns} measured runs`, `${stuck}`, '0', stuck === 0, stuck ? 1 : 0, errSamples.join('; '));
if (health) {
  const tp = Object.values(health.autoplayRunsPerMinPerCore);
  add('B37', 'P3', `Autoplay throughput per core (${Object.entries(health.autoplayRunsPerMinPerCore).map(([c, v]) => `${c} ${v}`).join(', ')})`, `min ${Math.min(...tp)} runs/min`, `>= ${BAL.SIM_RUNS_PER_MIN_MIN}`, Math.min(...tp) >= BAL.SIM_RUNS_PER_MIN_MIN, 0);
}

// ---------------- Rendering ----------------
const L = [];
const metricIds = [...new Set(rows.map((r) => r.id))];
const failed = rows.filter((r) => r.ok === false);
const p1 = rows.filter((r) => r.pri === 'P1');
L.push(`Pass/fail: ${rows.filter((r) => r.ok === true).length} checks pass, ${failed.length} fail, ${rows.filter((r) => r.ok === null).length} not measurable or diagnostic, over ${metricIds.length} targets. P1: ${p1.filter((r) => r.ok === true).length} pass, ${p1.filter((r) => r.ok === false).length} fail.`, '');
if (BEFORE) {
  const changed = rows.filter((r) => r.before && r.ok !== null && ['pass', '**FAIL**'].includes(r.before.result) && (r.before.result === 'pass') !== (r.ok === true));
  L.push(`Before (${BEFORE.file}): ${BEFORE.summary} Changed result: ${changed.filter((r) => r.ok).length} now pass, ${changed.filter((r) => !r.ok).length} now fail.`, '');
  L.push(table(['ID', 'Pri', 'Metric', 'Before: value', 'Before', 'Now: value (95 % interval)', 'Target', 'Now'], rows.map((r) => [r.id, r.pri, r.metric + (r.note ? ` (${r.note})` : ''), r.before ? r.before.value : 'n/a', r.before ? r.before.result : 'n/a', r.value, r.target, res(r.ok)])));
} else {
  L.push(table(['ID', 'Pri', 'Metric', 'Value (95 % interval)', 'Target', 'Result'], rows.map((r) => [r.id, r.pri, r.metric + (r.note ? ` (${r.note})` : ''), r.value, r.target, res(r.ok)])));
}
L.push('');
L.push('### Misses ranked by size (distance outside the band in band widths; P1 first)', '');
const ranked = failed.slice().sort((a, b) => (a.pri === b.pri ? 0 : a.pri === 'P1' ? -1 : b.pri === 'P1' ? 1 : a.pri < b.pri ? -1 : 1) || b.miss - a.miss);
L.push(table(['#', 'ID', 'Pri', 'Metric', 'Value', 'Target', 'Miss'], ranked.map((r, i) => [i + 1, r.id, r.pri, r.metric, r.value, r.target, num(r.miss, 2)])));
L.push('');

// Supporting tables
L.push('### Win rate and reach-the-boss rate by bot, profile and class', '');
const cellRows = [];
for (const name of ['random-P0', 'greedy-P0', 'planner-P0', 'speedrunner-P0', 'tactician-P0', 'tactician-P0-rulesOnly', 'random-P10', 'planner-P10', 'random-PALL', 'greedy-PALL', 'planner-PALL', 'speedrunner-PALL', 'tactician-PALL', 'planner-PALL-noInterrupt', 'planner-PALL-noCleanse', 'planner-PALL-noAoe']) {
  const pooled = m(name);
  if (!pooled) continue;
  const b = BEFORE ? BEFORE.cells.get(name) : null;
  cellRows.push([name, pooled.n, ...CLASSES.map((c) => { const x = m(name, c); return `${pct(x.win.p)} / ${pct(x.boss.p, 0)}`; }), `${pct(pooled.win.p)} / ${pct(pooled.boss.p, 0)}`, ...(BEFORE ? [b ? b.slice(2, 6).join('; ') : 'n/a'] : []), num(pooled.msPerRun.v, 0)]);
}
L.push(table(['Cell', 'Runs', ...CLASSES.map((c) => `${c}: win / boss`), 'All: win / boss', ...(BEFORE ? ['Before: rogue; mage; hunter; all (win / boss)'] : []), 'ms/run'], cellRows));
L.push('');
L.push(`Default trees (B7 best planner win rate, ties by reach-boss rate): ${Object.entries(trees).map(([c, t]) => `${c} tree ${t}`).join(', ')}. Hunter pet: ridgewolf for every bot except random (random picks one at random).`, '');

L.push('### Planner P0 by class', '');
const pc = CLASSES.map((c) => m('planner-P0', c));
const prow = (label, f) => [label, ...pc.map(f)];
L.push(table(['Metric', ...CLASSES], [
  prow('Win rate', (x) => rcell(x.win)),
  prow('Reach the boss', (x) => rcell(x.boss)),
  prow('Boss fights won', (x) => rcell(x.bossWin)),
  prow('Median minutes at boss (manual)', (x) => num(x.minutesBossManual.v)),
  prow('Median hours at boss / Ascendancy', (x) => `${num(x.hoursBoss.v, 0)} / ${num(x.ascBoss.v, 2)}`),
  prow('Mean ilvl at boss / rare share', (x) => `${num(x.ilvlBoss.v)} / ${pct(x.rareShareBoss.v, 0)}`),
  prow('Rounds: normal / elite / trash / dungeon boss / end boss', (x) => ['normal', 'elite', 'trash', 'dboss', 'boss'].map((k) => num(x.rounds[k].v, 0)).join(' / ')),
  prow('Deaths: Z1-2 / Z3-4 / Z5-6+camp / boss', (x) => ['early', 'mid', 'late', 'boss'].map((k) => pct(x.deathStage[k].p, 0)).join(' / ')),
  prow('Non-boss deaths by type', (x) => Object.entries(x.deathType).map(([k, v]) => `${k} ${pct(v.p, 0)}`).join(', ')),
  prow('Boss losses: phase 1 / 2 / 3 / enrage', (x) => ['1', '2', '3', 'enrage'].map((k) => pct(x.bossLossPhase[k].p, 0)).join(' / ')),
  prow('Boss HP left at loss (median)', (x) => pct(x.bossHpLeft.v, 0)),
  prow('Level leaving Z1..Z6', (x) => x.travelLv.map((y) => num(y.v, 0)).join(', ')),
  prow('Echoes per run / per win', (x) => `${num(x.echoes.v, 0)} / ${num(x.echoesWin.v, 0)}`),
  prow('Rests / potions (runs at boss)', (x) => `${num(x.rests.v)} / ${num(x.potions.v)}`),
]));
L.push('');
if (camp) {
  L.push('### Campaigns (B31, B32)', '');
  L.push(table(['Class', 'Completed', 'Median runs', 'Fewest', 'Win rate 1-5', 'Win rate 21-30', 'Largest dip', 'Echoes per run'],
    [...Object.entries(camp.per), ['all', camp.all]].map(([c, x]) => [c, `${x.completed}/${x.n}`, `${x.medianRuns}`, `${x.minRuns ?? 'n/a'}`, pct(x.wr1to5.p), pct(x.wr21to30.p), pct(x.maxDip), num(x.echoesPerRun, 0)])));
  L.push('');
  L.push(`Win rate by block of 5 runs (all classes): ${camp.all.blocks.map((b) => `${b.runs}: ${pct(b.p, 0)}`).join(', ')}`, '');
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
console.log(`wrote ${OUT}: ${rows.length} checks, ${failed.length} fail`);
void median; void quantile;
