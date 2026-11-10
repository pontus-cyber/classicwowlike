#!/usr/bin/env node
// Combat v2 balance report (M2b 2b.2; combat-v2.md 12): the combat checks B48-B54, the changed B5, B15, B16, B53 at
// v2 pacing, and the M2 P1 checks combat touches (B1, B3 planner, B4, B6, B21), now (a sim/combatpass.mjs directory)
// against before (the 11-10c pass directory, re-measured with today's definitions, plus optional masher and opener
// cells on the same engine). Writes the generated part between <!-- generated:start --> and <!-- generated:end -->
// of the report file, so hand-written analysis outside the markers survives a regeneration.
//
//   node sim/combatreport.mjs --in sim/out/m2b-2026-11-10d --before-pass sim/out/pass-2026-11-10c
//                             [--before-cells sim/out/m2b/pre-v1] --out docs/reports/balance-2026-11-10d.md
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BAL, C2 } from './lib/params.mjs';
import { C } from './lib/engine.mjs';
import { cellMetrics } from './lib/metrics.mjs';
import { FIGHT_KINDS } from './lib/recorder.mjs';
import { combatChecks, deathRate, replayStats, windowStats, firstTargetStats, engageTable, reachRate, winRate } from './lib/combatchecks.mjs';
import { rate, diffRate, median } from './lib/stats.mjs';
import { readJson, readJsonl, pct, num, ci, table } from './lib/output.mjs';
import { TIME_PROFILE } from './bots/index.mjs';
import { CLASSES } from './lib/session.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) o[argv[i].replace(/^--/, '')] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return o;
}
const args = parse(process.argv.slice(2));
const IN = args.in;
const BP = args['before-pass'] || null;
const BC = args['before-cells'] || null;

/** Records per class of cell `name` in `dir` (null if missing). */
function cellRecs(dir, name) {
  if (!dir || !existsSync(join(dir, name, 'summary.json'))) return null;
  const sum = readJson(join(dir, name, 'summary.json'));
  const out = {};
  for (const cls of Object.keys(sum.classes)) out[cls] = readJsonl(join(dir, name, `runs-${cls}.jsonl`));
  return out;
}
/** The 11-10c-style default-tree planner cells (planner-P0-tree<t> per class), else planner-P0. */
function passPlanner(dir, prof) {
  const p = readJson(join(dir, 'pass.json'));
  const tr = prof === 'P0' ? p.trees : p.treesPALL;
  if (!tr) return cellRecs(dir, `planner-${prof}`);
  const out = {};
  for (const cls of CLASSES) { const r = cellRecs(dir, `planner-${prof}-tree${tr[cls]}`); if (r && r[cls]) out[cls] = r[cls]; }
  return out;
}
const flat = (byCls) => (byCls ? Object.values(byCls).flat() : null);

const NOW = {
  planner: cellRecs(IN, 'planner-P0'), masher: cellRecs(IN, 'masher-P0'), opener: cellRecs(IN, 'opener-P0'), tactician: cellRecs(IN, 'tactician-P0'),
  random: cellRecs(IN, 'random-P0'), greedy: cellRecs(IN, 'greedy-P0'), speedrunner: cellRecs(IN, 'speedrunner-P0'), plannerPALL: cellRecs(IN, 'planner-PALL'),
};
const BEFORE = BP ? {
  planner: passPlanner(BP, 'P0'), tactician: cellRecs(BP, 'tactician-P0'), random: cellRecs(BP, 'random-P0'), greedy: cellRecs(BP, 'greedy-P0'),
  speedrunner: cellRecs(BP, 'speedrunner-P0'), plannerPALL: passPlanner(BP, 'PALL'),
  masher: cellRecs(BC, 'masher-P0'), opener: cellRecs(BC, 'opener-P0'),
} : null;
const meta = readJson(join(IN, 'combat.json')).meta;
const bmeta = BP ? readJson(join(BP, 'pass.json')).meta : null;

// ---------------- Checks ----------------
const res = (ok) => (ok === null || ok === undefined ? 'n/a' : ok ? 'pass' : '**FAIL**');
const rc = (r) => (r && r.n ? `${pct(r.p)} (${ci(r.ci)})` : 'n/a');
const inBand = (v, [lo, hi]) => v !== null && v !== undefined && v >= lo && v <= hi;

/** M2 P1 checks combat touches, for one set of cells: rows { id, pri, metric, value, target, ok }. */
function m2Checks(S) {
  const rows = [];
  const add = (id, pri, metric, value, target, ok) => rows.push({ id, pri, metric, value, target, ok });
  const m = (byCls, bot, cls = null) => (byCls ? cellMetrics(cls ? byCls[cls] || [] : flat(byCls), { timeProfile: TIME_PROFILE[bot] }) : null);
  const B1 = { random: [null, BAL.WR_P0_RANDOM_MAX], greedy: BAL.WR_P0_GREEDY, planner: BAL.WR_P0_PLANNER, speedrunner: BAL.WR_P0_SPEED, tactician: BAL.WR_P0_TACTICIAN };
  for (const [bot, [lo, hi]] of Object.entries(B1)) {
    const x = m(S[bot], bot);
    if (!x) { add('B1', 'P1', `Win rate P0, ${bot}`, 'n/a (not run)', lo === null ? `<= ${pct(hi)}` : `${pct(lo)} - ${pct(hi)}`, null); continue; }
    add('B1', 'P1', `Win rate P0, ${bot}`, rc(x.win), lo === null ? `<= ${pct(hi)}` : `${pct(lo)} - ${pct(hi)}`, (lo === null || x.win.p >= lo) && x.win.p <= hi);
  }
  for (const bot of ['masher', 'opener']) {
    const x = m(S[bot], bot);
    if (x) add('B1', 'diag', `Win rate P0, ${bot} (no B1 band)`, rc(x.win), '', null);
  }
  const pa = m(S.plannerPALL, 'planner');
  add('B3', 'P1', 'Win rate PALL, planner', pa ? rc(pa.win) : 'n/a (not run)', `${pct(BAL.WR_PALL_PLANNER[0])} - ${pct(BAL.WR_PALL_PLANNER[1])}`, pa ? inBand(pa.win.p, BAL.WR_PALL_PLANNER) : null);
  const pl = m(S.planner, 'planner');
  const rd = m(S.random, 'random');
  if (pl && rd) {
    const d = diffRate(pl.win, rd.win);
    add('B4', 'P1', 'Planner - random, P0', `${pct(d.v)} (${ci(d.ci)})`, `>= ${pct(BAL.CHOICE_GAP_MIN)}`, d.v >= BAL.CHOICE_GAP_MIN);
  }
  for (const [prof, byCls] of [['P0', S.planner], ['PALL', S.plannerPALL]]) {
    if (!byCls) { add('B6', 'P1', `Class band, planner ${prof}`, 'n/a (not run)', '', null); continue; }
    const w = CLASSES.map((c) => m(byCls, 'planner', c).win.p);
    const mean = w.reduce((a, b) => a + b, 0) / 3;
    const dev = Math.max(...w.map((x) => Math.abs(x - mean)));
    const spread = Math.max(...w) - Math.min(...w);
    add('B6', 'P1', `Class band, planner ${prof} (${CLASSES.map((c, i) => `${c} ${pct(w[i])}`).join(', ')})`, `max deviation ${pct(dev)}, spread ${pct(spread)}`, `deviation <= ${pct(BAL.CLASS_BAND_PP)}, spread <= ${pct(BAL.CLASS_SPREAD_MAX_PP)}`, dev <= BAL.CLASS_BAND_PP && spread <= BAL.CLASS_SPREAD_MAX_PP);
  }
  if (pl) {
    const d = pl.deathStageRuns;
    add('B21', 'P1', 'Runs dying in Z1-Z2 (planner P0, share of all runs)', rc(d.early), `<= ${pct(BAL.DEATH_EARLY_MAX)}`, d.early.p <= BAL.DEATH_EARLY_MAX);
    add('B21', 'P1', 'Runs dying in Z3-Z4 (share of all runs)', rc(d.mid), `${pct(BAL.DEATH_MID[0])} - ${pct(BAL.DEATH_MID[1])}`, inBand(d.mid.p, BAL.DEATH_MID));
    add('B21', 'P1', 'Runs dying in Z5-Z6 or Camp waves (share of all runs)', rc(d.late), `${pct(BAL.DEATH_LATE[0])} - ${pct(BAL.DEATH_LATE[1])}`, inBand(d.late.p, BAL.DEATH_LATE));
    add('B21', 'P1', 'Deaths at the end boss (share of deaths)', rc(pl.deathStage.boss), `${pct(BAL.DEATH_BOSS[0])} - ${pct(BAL.DEATH_BOSS[1])}`, inBand(pl.deathStage.boss.p, BAL.DEATH_BOSS));
  }
  return rows;
}

const pooled = (S) => Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v ? flat(v) : null]));
const nowRows = [...combatChecks(pooled(NOW)), ...m2Checks(NOW)];
const beforeRows = BEFORE ? [...combatChecks(pooled(BEFORE)), ...m2Checks(BEFORE)] : [];
// Before rows matched by ID and order within the ID.
const bmap = new Map();
const bcount = {};
for (const r of beforeRows) { bcount[r.id] = (bcount[r.id] || 0) + 1; bmap.set(`${r.id}#${bcount[r.id]}#${r.pri}`, r); }
const ncount = {};
const rows = nowRows.map((r) => { ncount[r.id] = (ncount[r.id] || 0) + 1; return { ...r, before: bmap.get(`${r.id}#${ncount[r.id]}#${r.pri}`) || null }; });
const order = ['B48', 'B49', 'B50', 'B51', 'B52', 'B53', 'B54', 'B5', 'B15', 'B16', 'B1', 'B3', 'B4', 'B6', 'B21'];
rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

// ---------------- Rendering ----------------
const L = [];
const scored = rows.filter((r) => r.pri !== 'diag' && r.ok !== null);
const p1 = scored.filter((r) => r.pri === 'P1');
L.push(`Setup: now = ${IN} (commit ${meta.commit}; P0 ${meta.runs} runs per class per bot, opener ${meta.openerRuns}, tactician ${meta.tactRuns}; seeds ${meta.seedBase}-${meta.seedBase + meta.runs - 1}; P0-group trees ${CLASSES.map((c) => `${c} ${meta.trees[c]}`).join(', ')}; planner warm-up ${SIM_WARM(meta)}; every P0 cell starts from the planner's final observations${meta.simOverride ? `; SIM_OVERRIDE ${meta.simOverride}` : ''}). Before = ${BP || 'n/a'} (commit ${bmeta ? bmeta.commit : 'n/a'}, ${bmeta ? bmeta.runs : 'n/a'} runs per class)${BC ? ` plus masher and opener cells on the same engine in ${BC}` : ''}, re-measured with today's definitions and judged against today's targets.`, '');
L.push(`Pass/fail (now): ${scored.filter((r) => r.ok).length} checks pass, ${scored.filter((r) => !r.ok).length} fail, ${rows.filter((r) => r.ok === null).length} diagnostic or not measurable. P1: ${p1.filter((r) => r.ok).length} pass, ${p1.filter((r) => !r.ok).length} fail.`, '');
L.push(table(['ID', 'Pri', 'Metric', 'Before: value', 'Before', 'Now: value (95 % interval)', 'Target', 'Now'],
  rows.map((r) => [r.id, r.pri, r.metric + (r.note ? ` (${r.note})` : ''), r.before ? r.before.value : 'n/a', r.before ? res(r.before.ok) : 'n/a', r.value, r.target, res(r.ok)])));
L.push('');

// Bots by class.
L.push('### Win rate and reach-the-boss rate by bot and class (P0)', '');
const botRows = [];
for (const [label, S] of [['now', NOW], ['before', BEFORE]]) {
  if (!S) continue;
  for (const bot of ['planner', 'masher', 'opener', 'tactician', 'greedy', 'speedrunner', 'random']) {
    const byCls = S[bot];
    if (!byCls) continue;
    const all = flat(byCls);
    botRows.push([label, bot, all.length, ...CLASSES.map((c) => (byCls[c] ? `${pct(winRate(byCls[c]).p)} / ${pct(reachRate(byCls[c]).p)}` : 'n/a')), `${pct(winRate(all).p)} / ${pct(reachRate(all).p)}`, num(all.reduce((a, r) => a + r.ms, 0) / all.length, 0)]);
  }
}
L.push(table(['Engine', 'Bot', 'Runs', ...CLASSES.map((c) => `${c}: win / boss`), 'All: win / boss', 'ms/run'], botRows));
L.push('');

// Deaths and fights by kind.
const KINDS = ['quest', 'grind', 'elite', 'trash', 'dboss', 'treasure', 'camp'];
L.push('### Non-boss deaths per 1 000 fights, fights per run and median rounds of won fights, by fight kind (P0, now)', '');
const kindRows = [];
for (const bot of ['planner', 'masher', 'opener', 'tactician']) {
  if (!NOW[bot]) continue;
  const all = flat(NOW[bot]);
  const cells = KINDS.map((k) => {
    const code = FIGHT_KINDS.indexOf(k);
    const d = deathRate(all, new Set([code]));
    const rounds = [];
    for (const r of all) for (const f of r.fx) if (f[0] === code && f[2] === 1) rounds.push(f[1]);
    return `${num(d.per1000, 1)} / ${num(d.fights / all.length, 1)} / ${rounds.length ? num(median(rounds), 0) : 'n/a'}`;
  });
  const t = deathRate(all);
  kindRows.push([bot, ...cells, `${num(t.per1000, 2)} (${t.deaths}/${t.fights})`]);
}
L.push(table(['Bot', ...KINDS.map((k) => `${k}: deaths / fights / rounds`), 'All non-boss: deaths per 1 000'], kindRows));
L.push('');

// Resources and HP.
L.push('### Potions, lowest HP, fights and rounds (P0, now)', '');
const resRows = [];
for (const bot of ['planner', 'masher', 'opener', 'tactician']) {
  if (!NOW[bot]) continue;
  const all = flat(NOW[bot]).filter((r) => r.out !== 'x');
  const lows = [];
  for (const r of all) for (const f of r.fx) if (f[2] === 1 && f[0] !== 7 && f.length >= 6) lows.push(f[5] / 1000);
  const boss = all.filter((r) => r.rb);
  resRows.push([bot, num(all.reduce((a, r) => a + r.potions, 0) / all.length, 2), num(boss.length ? boss.reduce((a, r) => a + r.potions, 0) / boss.length : null, 2), pct(lows.reduce((a, b) => a + b, 0) / Math.max(1, lows.length)), num(median(all.map((r) => r.fights)), 0), num(median(all.map((r) => r.rounds)), 0)]);
}
L.push(table(['Bot', 'Potions per run', 'Potions per run (runs at boss)', 'Mean lowest HP in won non-boss fights', 'Median fights per run', 'Median rounds per run'], resRows));
L.push('');

// B50 detail.
if (NOW.masher) {
  L.push('### B50 replays: masher non-boss deaths replayed from the fight start (P0, now)', '');
  const all = flat(NOW.masher);
  const reps = [];
  for (const r of all) if (r.rep) for (const x of r.rep) reps.push({ ...x, cls: r.cls });
  const byKind = {};
  for (const x of reps) { const k = FIGHT_KINDS[x[1]]; (byKind[k] = byKind[k] || []).push(x); }
  const repRows = Object.entries(byKind).map(([k, xs]) => [k, xs.length, pct(xs.filter((x) => x[2] !== 0).length / xs.length), pct(xs.filter((x) => x[3] !== 0).length / xs.length), pct(xs.filter((x) => x[4] !== 0).length / xs.length)]);
  for (const cls of CLASSES) {
    const xs = reps.filter((x) => x.cls === cls);
    if (xs.length) repRows.push([`all ${cls}`, xs.length, pct(xs.filter((x) => x[2] !== 0).length / xs.length), pct(xs.filter((x) => x[3] !== 0).length / xs.length), pct(xs.filter((x) => x[4] !== 0).length / xs.length)]);
  }
  const s = replayStats(all);
  repRows.push(['all', s.n, pct(s.opener.p), pct(s.auto.p), pct(s.control.p)]);
  L.push(table(['Fight kind', 'Deaths replayed', `Survive: opener rounds 1-${C2.OPEN_ROUNDS}, masher after (B50)`, `Survive: autoplay rounds 1-${C2.OPEN_ROUNDS}, masher after`, 'Survive: masher replayed (control, must be 0 %)'], repRows));
  L.push('');
}

// B51, B52, B54 by class.
if (NOW.opener) {
  L.push('### Engage-round choices of the opener in multi-enemy fights (B51), by class', '');
  L.push(table(['Class', 'Fights', 'Strike', 'Control', 'Setup', 'Bar spell or other'], engageTable(flat(NOW.opener))));
  L.push('');
}
L.push('### OFF_BALANCE windows (B52) and first targets (B54) by bot and class (non-boss fights, now)', '');
const wRows = [];
for (const bot of ['planner', 'masher', 'opener', 'tactician']) {
  if (!NOW[bot]) continue;
  for (const cls of [...CLASSES, null]) {
    const recs = cls ? NOW[bot][cls] || [] : flat(NOW[bot]);
    const w = windowStats(recs);
    const ft = firstTargetStats(recs);
    wRows.push([bot, cls || 'all', `${w.used}/${w.opened} (${pct(w.share.p)})`, num(w.opened / Math.max(1, recs.length), 1), `${pct(ft.p)} (n=${ft.n})`]);
  }
}
L.push(table(['Bot', 'Class', 'Windows used / opened', 'Windows opened per run', 'First target differs from default target'], wRows));
L.push('');

// Opener compute.
for (const bot of ['opener', 'tactician']) {
  if (!NOW[bot]) continue;
  const all = flat(NOW[bot]).filter((r) => r.bm);
  if (!all.length) continue;
  const mean = (f) => all.reduce((a, r) => a + f(r), 0) / all.length;
  L.push(`${bot} compute: ${num(mean((r) => r.ms), 0)} ms per run; ${num(mean((r) => r.bm.plans), 1)} plans per run (${num(mean((r) => r.bm.replans), 1)} re-plans; ${num(mean((r) => r.bm.auto || 0), 1)} plans that kept autoplay); ${num(mean((r) => r.bm.evals) / Math.max(1, mean((r) => r.bm.plans)), 0)} simulated rounds per plan.`, '');
}

function SIM_WARM(m) {
  const w = readJson(join(IN, 'combat.json')).warmups.P0;
  return w ? `${w.runs} runs per class, seeds ${w.seeds}` : 'n/a';
}

const block = `<!-- generated:start (sim/combatreport.mjs; do not edit by hand) -->\n${L.join('\n')}\n<!-- generated:end -->`;
const OUT = args.out;
if (OUT) {
  let body = existsSync(OUT) ? readFileSync(OUT, 'utf8') : `# Balance report ${new Date().toISOString().slice(0, 10)}: combat v2\n\n<!-- generated:start -->\n<!-- generated:end -->\n`;
  const a = body.indexOf('<!-- generated:start');
  const b = body.indexOf('<!-- generated:end -->');
  body = a >= 0 && b > a ? body.slice(0, a) + block + body.slice(b + '<!-- generated:end -->'.length) : `${body}\n${block}\n`;
  writeFileSync(OUT, body);
  console.log(`wrote ${OUT}`);
} else console.log(block);
