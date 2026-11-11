#!/usr/bin/env node
// M2b v13 report tables (docs/specs/changes-m2b-v13.md "What the sim must run" and targets B59-B62; the flip criteria of
// changes-m2b-v10.md; report docs/reports/balance-2026-11-12.md). Reads the cells of sim/measure-v13.sh (IN), the mash
// cells (MASH: the pre-package classic cells and expedition onebutton / masher cells) and the v12 pass (V12: the
// pre-package expedition planner, speedrunner and flip cells, same tables and seeds). Prints Markdown.
//
//   node sim/v13report.mjs [--in sim/out/pass-v13] [--mash sim/out/mash] [--v12 sim/out/pass-v12] > tables.md
//
// "Deaths" (B59-B62) = the fight ended the run or needed a resurrect: fx outcome 0, or lowest HP 0 per mille (the
// recorder's mark of a death or resurrect); in the think replays, outcome 0 or a resurrect used.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIGHT_KINDS } from './lib/recorder.mjs';
import { readJsonl } from './lib/output.mjs';
import { rate, median, wilson } from './lib/stats.mjs';
import { specialGroup, expMetrics, runLength, contractMetrics } from './lib/metrics.mjs';
import { combatMinutes, pairedDiff } from './lib/combatchecks.mjs';
import { CONTENT } from './lib/engine.mjs';
import { thinkRows, spacing, templateTable, zoneTable, groupOf, tidsOf, GROUP_LABEL } from './mashreport.mjs';

const CL = ['rogue', 'mage', 'hunter'];
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const IN = args.in || 'sim/out/pass-v13';
const MASH = args.mash || 'sim/out/mash';
const V12 = args.v12 || 'sim/out/pass-v12';
const T = { elite: 0.40, rare: 0.60, dboss: 0.70, z1: 0.25 };          // B59 ONEBTN_*_MIN
const OPEN = { elite: 0.03, rare: 0.25, dboss: 0.05 };                  // B60 OPEN_*_MAX
const AUTO_KEEP_PP = 2; const AUTO_SPECIAL_PP = 3; const GRIND_KEEP_PP = 1; const SPACING = [4, 7];
const out = [];
const say = (x = '') => out.push(x);

/** byCls of records of a cell directory, or null. */
function load(dir, cls = CL) {
  const o = {};
  for (const c of cls) { const f = join(dir, `runs-${c}.jsonl`); if (existsSync(f)) o[c] = readJsonl(f).filter((r) => !r.err); }
  return Object.keys(o).length ? o : null;
}
const flat = (b) => (b ? Object.values(b).flat() : []);
const pc = (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : `${(x * 100).toFixed(d)} %`);
const ci = (k, n) => { if (!n) return 'n/a'; const [lo, hi] = wilson(k, n); return `${(100 * k / n).toFixed(1)} % (${(lo * 100).toFixed(1)}-${(hi * 100).toFixed(1)}; n ${n})`; };
const deadF = (f) => f[2] === 0 || (f.length > 5 && f[5] === 0);
const SPECIAL = ['elite', 'rare', 'dboss'];
const NORMAL = ['quest', 'grind', 'trash'];

/** Per fight group of full runs: { n, d, pot, dbA, dbL, dbK, mm, hm } (groups: elite (no rare), rare, dboss, z1, quest, grind, trash). */
function groups(rs) {
  const g = {};
  const add = (k, f, v) => {
    const x = g[k] || (g[k] = { n: 0, d: 0, pot: 0, dbA: 0, dbL: 0, dbK: 0, mm: 0, hm: 0 });
    x.n++; if (deadF(f)) x.d++; x.pot += f[6] || 0;
    if (v && v.length > 14) { x.dbA += v[14]; x.dbL += v[15]; x.dbK += v[16]; x.mm += v[17]; x.hm += v[18]; }
  };
  for (const r of rs) {
    for (let i = 0; i < r.fx.length; i++) {
      const f = r.fx[i];
      const v = r.f2 && r.f2[i];
      const sg = specialGroup(r, i);
      if (sg) { add(sg, f, v); if (f[4] === 1) add('z1', f, v); continue; }
      const k = FIGHT_KINDS[f[0]];
      if (NORMAL.includes(k)) add(k, f, v);
    }
  }
  return g;
}
const gRate = (g, k) => (g[k] && g[k].n ? g[k].d / g[k].n : null);
/** Think replay rows of a think cell (tk; tm when present): the mash report's thinkRows on the same records. */
function think(byCls) { return byCls ? thinkRows(byCls, Object.values(byCls).some((rs) => rs.some((r) => r.tm)) ? byCls : null) : []; }
/** Replays: per group of a think row set, deaths of own / opener line / autoplay. */
function tkGroups(rows) {
  const g = {};
  const add = (k, x) => { const e = g[k] || (g[k] = { n: 0, own: 0, op: 0, au: 0, ma: 0, nma: 0 }); e.n++; if (x.own.died) e.own++; if (x.op.died) e.op++; if (x.au.died) e.au++; if (x.ma) { e.nma++; if (x.ma.died) e.ma++; } };
  for (const x of rows) {
    const k = x.g === 'elite' || x.g === 'rare' || x.g === 'dboss' ? x.g : NORMAL.includes(x.g) ? x.g : null;
    if (!k) continue;
    add(k, x);
    if (SPECIAL.includes(k) && x.z === 1) add('z1', x);
  }
  return g;
}
const byClsRows = (rows, c) => rows.filter((x) => x.cls === c);
const pairedRate = (a, b, f) => { const d = pairedDiff(flat(a), flat(b), f); return d.n ? `${d.v >= 0 ? '+' : ''}${(d.v * 100).toFixed(1)} pp (${(d.ci[0] * 100).toFixed(1)} - ${(d.ci[1] * 100).toFixed(1)}; n ${d.n})` : 'n/a'; };
const pp = (a, b) => (a === null || b === null ? 'n/a' : `${a - b >= 0 ? '+' : ''}${((a - b) * 100).toFixed(1)} pp`);

// ---------------------------------------------------------------- cells
const C = {
  ob0: load(join(IN, 'classic/onebutton-P0')), ma0: load(join(IN, 'classic/masher-P0')), pl0: load(join(IN, 'classic/planner-P0')),
  obA: load(join(IN, 'classic/onebutton-PALL')), plA: load(join(IN, 'classic/planner-PALL')), op0: load(join(IN, 'classic/opener-P0')),
  tk0: load(join(IN, 'think/onebutton-P0')), tkA: load(join(IN, 'think/onebutton-PALL')), tkX: load(join(IN, 'think/onebutton-P0-exp-prep')),
  g5tk: load(join(IN, 'g5think/onebutton-P0-g5')), g5pl: load(join(IN, 'g5/planner-P0-g5')),
  g6ob: load(join(IN, 'g6/onebutton-P0-g6')), g6pl: load(join(IN, 'g6/planner-P0-g6')), g6tk: load(join(IN, 'g6think/onebutton-P0-g6')),
  xob0: load(join(IN, 'exp/onebutton-P0-exp-prep')), xma0: load(join(IN, 'exp/masher-P0-exp-prep')), xpl0: load(join(IN, 'exp/planner-P0-exp-prep')),
  xobA: load(join(IN, 'exp/onebutton-PALL-exp-prep')), xplA: load(join(IN, 'exp/planner-PALL-exp-prep')),
};
const M = {
  ob0: load(join(MASH, 'classic/onebutton-P0')), ma0: load(join(MASH, 'classic/masher-P0')), pl0: load(join(MASH, 'classic/planner-P0')),
  obA: load(join(MASH, 'classic/onebutton-PALL')), plA: load(join(MASH, 'classic/planner-PALL')), op0: load(join(MASH, 'classic/opener-P0')),
  tk0: load(join(MASH, 'think/onebutton-P0')), rot0: load(join(MASH, 'rot/onebutton-P0')), tkA: load(join(MASH, 'think/onebutton-PALL')),
  tkX: load(join(MASH, 'think/onebutton-P0-exp-prep')), rotX: load(join(MASH, 'rot/onebutton-P0-exp-prep')),
  xob0: load(join(MASH, 'exp/onebutton-P0-exp-prep')), xma0: load(join(MASH, 'exp/masher-P0-exp-prep')), xobA: load(join(MASH, 'exp/onebutton-PALL-exp-prep')),
};
const V = { xpl0: load(join(V12, 'exp/planner-P0-exp-prep')), xplA: load(join(V12, 'exp/planner-PALL-exp-prep-rcg')) };

say(`<!-- generated by node sim/v13report.mjs --in ${IN} --mash ${MASH} --v12 ${V12} -->`);
say();
// ---------------------------------------------------------------- B59
function b59Block(title, full, rows, pre, preRows) {
  if (!full) return;
  say(`#### B59 one-button deaths per special fight, ${title}`);
  say();
  say('| Class | Elite (not rare) | Rare | Dungeon boss | Zone 1 specials | Replays: elite / rare / dungeon boss / Z1 | Before the package (full runs): elite / rare / dungeon boss / Z1 |');
  say('|---|---|---|---|---|---|---|');
  for (const c of [...CL, 'all']) {
    const rs = c === 'all' ? flat(full) : full[c] || [];
    const g = groups(rs);
    const rg = rows ? tkGroups(c === 'all' ? rows : byClsRows(rows, c)) : null;
    const pg = pre ? groups(c === 'all' ? flat(pre) : pre[c] || []) : null;
    const cell = (k) => (g[k] ? `${ci(g[k].d, g[k].n)}${c === 'all' ? (g[k].d / g[k].n >= T[k] ? ' pass' : ' **fail**') : ''}` : 'n/a');
    const rr = rg ? ['elite', 'rare', 'dboss', 'z1'].map((k) => (rg[k] ? pc(rg[k].own / rg[k].n) : 'n/a')).join(' / ') : 'not run';
    const pr = pg ? ['elite', 'rare', 'dboss', 'z1'].map((k) => pc(gRate(pg, k))).join(' / ') : 'n/a';
    say(`| ${c === 'all' ? '**all**' : c} | ${cell('elite')} | ${cell('rare')} | ${cell('dboss')} | ${cell('z1')} | ${rr} | ${pr} |`);
  }
  say();
  say(`Targets: elite >= ${pc(T.elite, 0)}, rare >= ${pc(T.rare, 0)}, dungeon boss >= ${pc(T.dboss, 0)}, zone 1 specials >= ${pc(T.z1, 0)} (full runs decide; P0 binding, PALL reported, O11).`);
  say();
}
const R0 = think(C.tk0); const RA = think(C.tkA); const RX = think(C.tkX);
const MR0 = M.tk0 ? thinkRows(M.tk0, M.rot0) : []; const MRX = M.tkX ? thinkRows(M.tkX, M.rotX) : [];
say('### B59-B62 (M2b v13 targets)');
say();
b59Block('classic P0', C.ob0, R0, M.ob0, MR0);
b59Block('classic PALL', C.obA, RA, M.obA, null);
b59Block('expedition P0 (start camp)', C.xob0, RX, M.xob0, MRX);
b59Block('expedition PALL (start camp)', C.xobA, null, M.xobA, null);

// Deathblows and MAIMED per bot.
function dbBlock(title, cells) {
  say(`#### Deathblows, MAIMED and potions per special fight, ${title} (full runs)`);
  say();
  say('| Cell | Kind | Fights | Deaths | Deathblows answered / landed / killing per fight | MAIMED fights | Heals while MAIMED per MAIMED fight | Potions per fight |');
  say('|---|---|---|---|---|---|---|---|');
  for (const [label, d] of cells) {
    if (!d) continue;
    const g = groups(flat(d));
    for (const k of ['elite', 'rare', 'dboss', 'z1']) {
      const x = g[k]; if (!x) continue;
      say(`| ${label} | ${k === 'z1' ? 'zone 1 specials' : GROUP_LABEL[k]} | ${x.n} | ${pc(x.d / x.n)} | ${(x.dbA / x.n).toFixed(2)} / ${(x.dbL / x.n).toFixed(2)} / ${(x.dbK / x.n).toFixed(3)} | ${pc(x.mm / x.n)} | ${x.mm ? (x.hm / x.mm).toFixed(2) : 'n/a'} | ${(x.pot / x.n).toFixed(2)} |`);
    }
  }
  say();
}
dbBlock('classic P0', [['onebutton', C.ob0], ['masher', C.ma0], ['planner (autoplay)', C.pl0], ['opener', C.op0]]);
dbBlock('expedition P0', [['onebutton', C.xob0], ['masher', C.xma0], ['planner (autoplay)', C.xpl0]]);
{
  // Pre-package potions per special fight (mash cells) for the potion-carry reading.
  const lines = [];
  for (const [label, a, b] of [['onebutton', C.ob0, M.ob0], ['planner', C.pl0, M.pl0]]) {
    if (!a || !b) continue;
    const ga = groups(flat(a)); const gb = groups(flat(b));
    lines.push(`- ${label}, classic P0, potions per fight before / after the package: ${SPECIAL.map((k) => `${GROUP_LABEL[k]} ${gb[k] ? (gb[k].pot / gb[k].n).toFixed(2) : 'n/a'} / ${ga[k] ? (ga[k].pot / ga[k].n).toFixed(2) : 'n/a'}`).join('; ')}.`);
  }
  say(lines.join('\n'));
  say();
}

// ---------------------------------------------------------------- B60
function b60Block(title, rows, opener, preRows) {
  if (!rows.length) return;
  say(`#### B60 opener line deaths on the same fights (paired think replays of the onebutton runs), ${title}`);
  say();
  say('| Class | Elite (not rare) | Rare | Dungeon boss | Z1 specials | Autoplay replay: elite / rare / dungeon boss | Before the package (opener line): elite / rare / dungeon boss |');
  say('|---|---|---|---|---|---|---|');
  for (const c of [...CL, 'all']) {
    const xs = c === 'all' ? rows : byClsRows(rows, c);
    const g = tkGroups(xs);
    const pg = preRows.length ? tkGroups(c === 'all' ? preRows : byClsRows(preRows, c)) : null;
    const cell = (k) => (g[k] ? `${ci(g[k].op, g[k].n)}${c === 'all' && OPEN[k] !== undefined ? (g[k].op / g[k].n <= OPEN[k] ? ' pass' : ' **fail**') : ''}` : 'n/a');
    say(`| ${c === 'all' ? '**all**' : c} | ${cell('elite')} | ${cell('rare')} | ${cell('dboss')} | ${g.z1 ? pc(g.z1.op / g.z1.n) : 'n/a'} | ${SPECIAL.map((k) => (g[k] ? pc(g[k].au / g[k].n) : 'n/a')).join(' / ')} | ${pg ? SPECIAL.map((k) => (pg[k] ? pc(pg[k].op / pg[k].n) : 'n/a')).join(' / ') : 'n/a'} |`);
  }
  say();
  if (opener) {
    const g = groups(flat(opener));
    say(`Opener full runs (check): ${SPECIAL.map((k) => `${GROUP_LABEL[k]} ${g[k] ? ci(g[k].d, g[k].n) : 'n/a'}`).join('; ')}. Caps: elite <= ${pc(OPEN.elite, 0)}, rare <= ${pc(OPEN.rare, 0)}, dungeon boss <= ${pc(OPEN.dboss, 0)} (replays decide).`);
    say();
  }
}
b60Block('classic P0', R0, C.op0, MR0);
b60Block('classic PALL', RA, null, M.tkA ? thinkRows(M.tkA, null) : []);
b60Block('expedition P0', RX, null, MRX);

/** Templates with the most deaths of a policy (>= min fights) in a row set. */
function topDeaths(rows, key, min = 25, n = 8) {
  const m = new Map();
  for (const x of rows) for (const t of new Set(x.tids)) { const e = m.get(t) || { n: 0, d: 0, g: new Map() }; e.n++; if (x[key].died) e.d++; e.g.set(x.g, (e.g.get(x.g) || 0) + 1); m.set(t, e); }
  const list = [...m.entries()].filter(([, e]) => e.n >= min).map(([t, e]) => ({ t, ...e, p: e.d / e.n })).sort((a, b) => b.p - a.p).slice(0, n);
  const lines = ['| Enemy (archetype) | Mostly met in | Fights | Deaths |', '|---|---|---|---|'];
  for (const e of list) lines.push(`| ${CONTENT.enemies[e.t] ? CONTENT.enemies[e.t].name : e.t} (${CONTENT.enemies[e.t] ? CONTENT.enemies[e.t].archetype : '?'}) | ${[...e.g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => GROUP_LABEL[g]).join(', ')} | ${e.n} | ${pc(e.p)} |`);
  return lines.join('\n');
}
if (R0.length) {
  say('#### Enemies with the most deaths on the paired replays (classic P0; templates in >= 25 replayed fights)');
  say();
  say('One button:');
  say();
  say(topDeaths(R0, 'own'));
  say();
  say('Opener line:');
  say();
  say(topDeaths(R0, 'op', 10));
  say();
}

// ---------------------------------------------------------------- B61
function b61Block(title, now, pre, preLabel) {
  if (!now || !pre) return;
  say(`#### B61 autoplay (planner) ${title}, against ${preLabel}`);
  say();
  say('| Class | Reach the boss: now / before / paired | Win: now / before / paired | Deaths: elite | rare | dungeon boss | Z1 specials (now / before) |');
  say('|---|---|---|---|---|---|');
  for (const c of [...CL, 'all']) {
    const a = c === 'all' ? now : { [c]: now[c] }; const b = c === 'all' ? pre : { [c]: pre[c] };
    if (!a[c] && c !== 'all') continue;
    const fa = flat(a); const fb = flat(b);
    const ga = groups(fa); const gb = groups(fb);
    const reachA = fa.filter((r) => r.rb).length / fa.length; const reachB = fb.filter((r) => r.rb).length / fb.length;
    const winA = fa.filter((r) => r.out === 'v').length / fa.length; const winB = fb.filter((r) => r.out === 'v').length / fb.length;
    const sp = (k) => { const x = gRate(ga, k); const y = gRate(gb, k); const ok = x !== null && y !== null && x - y <= AUTO_SPECIAL_PP / 100 + 1e-9; return `${pc(x)} / ${pc(y)}${c === 'all' ? (ok ? ' pass' : ' **fail**') : ''}`; };
    const keep = (x, y) => (c === 'all' ? (x - y >= -AUTO_KEEP_PP / 100 - 1e-9 ? ' pass' : ' **fail**') : '');
    say(`| ${c === 'all' ? '**all**' : c} | ${pc(reachA)} / ${pc(reachB)} / ${pairedRate(a, b, (r) => r.rb)}${keep(reachA, reachB)} | ${pc(winA)} / ${pc(winB)} / ${pairedRate(a, b, (r) => (r.out === 'v' ? 1 : 0))}${keep(winA, winB)} | ${sp('elite')} | ${sp('rare')} | ${sp('dboss')} | ${sp('z1')} |`);
  }
  say();
  say(`Targets: reach and win within ${AUTO_KEEP_PP} pp of the pre-package cell (a fall of at most ${AUTO_KEEP_PP} pp); deaths per special fight kind within +${AUTO_SPECIAL_PP} pp.`);
  say();
}
b61Block('classic P0', C.pl0, M.pl0, 'the mash cell (3e16499, pre-package; same tables and seeds)');
b61Block('classic PALL', C.plA, M.plA, 'the mash cell (3e16499; Ricochet Bolt 0.40 there, 0.30 now: the hunter moves by both)');
b61Block('expedition P0', C.xpl0, V.xpl0, 'the v12 flip cell (199168c; same tables and seeds; Ricochet not cast at P0)');
b61Block('expedition PALL', C.xplA, V.xplA, 'the v12 flip cell (199168c, Ricochet 0.30 arm; same tables and seeds)');

// ---------------------------------------------------------------- B62
function b62aBlock(title, pairs) {
  say(`#### B62 (a) deaths in normal quest fights, grind waves and dungeon trash, ${title}`);
  say();
  say('| Cell | Class | Quest: now / before | Grind: now / before | Trash: now / before | Result |');
  say('|---|---|---|---|---|---|');
  for (const [label, a, b] of pairs) {
    if (!a || !b) continue;
    for (const c of [...CL, 'all']) {
      const ga = groups(c === 'all' ? flat(a) : a[c] || []); const gb = groups(c === 'all' ? flat(b) : b[c] || []);
      const moved = NORMAL.map((k) => Math.abs((gRate(ga, k) ?? 0) - (gRate(gb, k) ?? 0)));
      say(`| ${label} | ${c === 'all' ? '**all**' : c} | ${NORMAL.map((k) => `${pc(gRate(ga, k), 2)} / ${pc(gRate(gb, k), 2)}`).join(' | ')} | ${c === 'all' ? (Math.max(...moved) <= GRIND_KEEP_PP / 100 + 1e-9 ? 'pass' : '**fail**') : ''} |`);
    }
  }
  say();
}
b62aBlock('classic P0 (full runs)', [['onebutton', C.ob0, M.ob0], ['planner', C.pl0, M.pl0]]);
b62aBlock('classic PALL (full runs)', [['onebutton', C.obA, M.obA], ['planner', C.plA, M.plA]]);
b62aBlock('expedition P0 (full runs)', [['onebutton (mash cell: other tables)', C.xob0, M.xob0], ['planner (v12 cell)', C.xpl0, V.xpl0]]);

function spacingBlock(title, rows, byCls, preRows, preByCls) {
  if (!rows.length) return;
  const one = (rs, b) => {
    const r = rs.filter((x) => x.ma);
    const sp = spacing(r.map((x) => ({ ...x, think: !!x.thinkRot })), b);
    const spO = spacing(rs, b);
    return { rot: sp, own: spO, n: r.length };
  };
  const a = one(rows, byCls); const b = preRows.length ? one(preRows, preByCls) : null;
  const med = (xs) => (xs.length ? median(xs) : NaN);
  say(`#### B62 (b) think-fight spacing, ${title}`);
  say();
  say('| Measure | Now | Before the package |');
  say('|---|---|---|');
  const f = (s) => (s ? `${(s.nodes / Math.max(1, s.nThink)).toFixed(1)} nodes (${(s.nThink / s.runs).toFixed(2)} per run; gaps median ${med(s.gaps)}, n ${s.gaps.length})` : 'n/a');
  say(`| Rotation (masher on the onebutton runs' fights): nodes per think fight | ${f(a.rot)} | ${b ? f(b.rot) : 'n/a'} |`);
  say(`| One button: nodes per think fight | ${f(a.own)} | ${b ? f(b.own) : 'n/a'} |`);
  for (const c of CL) {
    const rc = rows.filter((x) => x.cls === c && x.ma);
    if (!rc.length) continue;
    const s = spacing(rc.map((x) => ({ ...x, think: !!x.thinkRot })), { [c]: byCls[c] });
    say(`| Rotation, ${c} | ${f(s)} | |`);
  }
  const v = a.rot.nodes / Math.max(1, a.rot.nThink);
  say();
  say(`B62 (b) band ${SPACING[0]}-${SPACING[1]} nodes between rotation think fights: ${v.toFixed(1)} -> ${v >= SPACING[0] && v <= SPACING[1] ? 'pass' : '**fail**'}.`);
  say();
}
spacingBlock('classic P0', R0, C.tk0, MR0, M.tk0);
spacingBlock('expedition P0', RX, C.tkX, MRX, M.tkX);

// Think share by zone and the first-met split (cell 2).
if (R0.length) {
  say('#### Think fights by zone, classic P0 (one button against the opener line; cell 2)');
  say();
  say(zoneTable(R0));
  say();
  const ng = R0.filter((x) => x.g === 'quest' || x.g === 'grind');
  const nw = ng.filter((x) => x.newT); const old = ng.filter((x) => !x.newT);
  say(`- First-met split (normal and grind fights): think share with an enemy met for the first time ${pc(nw.filter((x) => x.think).length / Math.max(1, nw.length))} (n ${nw.length}), familiar ${pc(old.filter((x) => x.think).length / Math.max(1, old.length))} (n ${old.length}).`);
  say();
}

// ---------------------------------------------------------------- Rows 5 and 6
say('### Gated rows');
say();
{
  const z1r = (rows) => { const xs = rows.filter((x) => x.z === 1 && x.g === 'rare'); return { n: xs.length, own: xs.filter((x) => x.own.died).length, op: xs.filter((x) => x.op.died).length, au: xs.filter((x) => x.au.died).length }; };
  const a = z1r(R0);
  say(`- Row 5 gate (cell 2, zone 1 rare fights on the replays): opener line ${ci(a.op, a.n)}, one button ${pc(a.own / Math.max(1, a.n))}, autoplay ${pc(a.au / Math.max(1, a.n))}; gate (> 25 %): ${a.n && a.op / a.n > 0.25 ? 'open, cell 6 ran' : 'closed'}.`);
  if (C.g5tk) {
    const R5 = think(C.g5tk); const b = z1r(R5);
    const base = z1r(R0.filter((x) => C.g5tk[x.cls] && C.g5tk[x.cls].some((r) => r.seed === x.seed)));
    say(`- Cell 6 (RARE_HP_MULT_Z1 3.0), zone 1 rares on the replays: opener line ${ci(b.op, b.n)} (package ${pc(base.op / Math.max(1, base.n))}), one button ${pc(b.own / Math.max(1, b.n))} (${pc(base.own / Math.max(1, base.n))}), autoplay ${pc(b.au / Math.max(1, b.n))} (${pc(base.au / Math.max(1, base.n))}).`);
    const g5 = groups(flat(C.g5pl || {})); const g0 = groups(flat(C.pl0));
    const z1rare = (d) => { let n = 0; let k = 0; for (const r of flat(d)) for (let i = 0; i < r.fx.length; i++) if (r.fx[i][4] === 1 && specialGroup(r, i) === 'rare') { n++; if (deadF(r.fx[i])) k++; } return { n, k }; };
    if (C.g5pl) {
      const p5 = z1rare(C.g5pl); const p0 = z1rare(C.pl0);
      say(`- Cell 6 planner (full runs): Z1 rare deaths ${ci(p5.k, p5.n)} against ${ci(p0.k, p0.n)}; reach the boss ${pairedRate(C.g5pl, C.pl0, (r) => r.rb)}, win ${pairedRate(C.g5pl, C.pl0, (r) => (r.out === 'v' ? 1 : 0))}; special deaths elite / rare / dungeon boss ${SPECIAL.map((k) => pc(gRate(g5, k))).join(' / ')} against ${SPECIAL.map((k) => pc(gRate(g0, k))).join(' / ')}.`);
    }
  }
  if (C.g6ob || C.g6pl) {
    say('- Row 6 arm (cell 7, first meeting), quest / grind deaths against cell 1 (full runs, same seeds):');
    for (const [label, a6, a0] of [['onebutton', C.g6ob, C.ob0], ['planner', C.g6pl, C.pl0]]) {
      if (!a6 || !a0) continue;
      const g6 = groups(flat(a6)); const g0 = groups(flat(a0));
      const mv = ['quest', 'grind'].map((k) => Math.abs((gRate(g6, k) ?? 0) - (gRate(g0, k) ?? 0)));
      say(`  - ${label}: quest ${pc(gRate(g6, 'quest'), 2)} against ${pc(gRate(g0, 'quest'), 2)} (${pp(gRate(g6, 'quest'), gRate(g0, 'quest'))}); grind ${pc(gRate(g6, 'grind'), 2)} against ${pc(gRate(g0, 'grind'), 2)} (${pp(gRate(g6, 'grind'), gRate(g0, 'grind'))}); reach the boss ${pairedRate(a6, a0, (r) => r.rb)}; gate (<= 1 pp): ${Math.max(...mv) <= 0.01 + 1e-9 ? 'pass' : '**fail**'}.`);
    }
    if (C.g6tk) {
      const R6 = think(C.g6tk);
      const seeds = new Set(R6.map((x) => `${x.cls}|${x.seed}`));
      const R0s = R0.filter((x) => seeds.has(`${x.cls}|${x.seed}`));
      const fm = (rows) => { const q = rows.filter((x) => x.g === 'quest'); const nw = q.filter((x) => x.newT); const old = q.filter((x) => !x.newT); return `first met ${pc(nw.filter((x) => x.think).length / Math.max(1, nw.length))} (n ${nw.length}), familiar ${pc(old.filter((x) => x.think).length / Math.max(1, old.length))} (n ${old.length})`; };
      say(`  - Think share of quest fights (replays, same seeds): with row 6 ${fm(R6)}; package ${fm(R0s)}.`);
    }
  }
  say();
}
process.stdout.write(out.join('\n') + '\n');
