#!/usr/bin/env node
// M2b v15 report tables (docs/specs/changes-m2b-v15.md "What the sim must run" and its decision rules; report
// docs/reports/balance-2026-11-12c.md). Reads the cells of sim/measure-v15.sh (IN), the v14 pass (V14: Warden Belk at 1.05,
// no Swift passage; same tables and seeds) and the v13 pass (V13: the speedrunner and planner PALL flip cells; the
// specified speedrunner at balance.md 1's rate in exp-v12price). Every comparison is paired by class and seed. Prints
// Markdown.
//
//   node sim/v15report.mjs [--in sim/out/pass-v15] [--v14 sim/out/pass-v14] [--v13 sim/out/pass-v13]
//
// "Deaths" = the fight ended the run or needed a resurrect (fx outcome 0, or lowest HP 0 per mille); in the think replays,
// outcome 0 or a resurrect used (as sim/v13report.mjs, sim/v14report.mjs). B11 = median manual minutes of planner P0 runs
// that reach the boss; B12 = median autoplay minutes of speedrunner PALL wins, from SET_OUT (start camp left out) and from
// run start (metrics.mjs runLength). Swift passage: records' ex.swift (Roads that paid) and each zone's eighth element.
// Cell names are those of the measured engine (391469b: swiftRoad on by default, so '-noswift' is the off arm; '-maw' the
// mawgrimHp arm). Since D126 (f5682c3) the passage is off by default and mawgrimHp is gone, so the script reads the v15
// pass as measured; sim/measure-v15.sh is retired on that engine.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIGHT_KINDS } from './lib/recorder.mjs';
import { readJsonl } from './lib/output.mjs';
import { wilson } from './lib/stats.mjs';
import { specialGroup, runLength } from './lib/metrics.mjs';
import { pairedDiff, combatMinutes } from './lib/combatchecks.mjs';
import { CONTENT, C } from './lib/engine.mjs';
import { thinkRows } from './mashreport.mjs';

const CL = ['rogue', 'mage', 'hunter'];
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const IN = args.in || 'sim/out/pass-v15';
const V14 = args.v14 || 'sim/out/pass-v14';
const V13 = args.v13 || 'sim/out/pass-v13';
const T59 = { elite: 0.40, rare: 0.60, dboss: 0.70, z1: 0.25 };      // B59 ONEBTN_*_MIN
const OPEN = { elite: 0.03, rare: 0.25, dboss: 0.05 };              // B60 OPEN_*_MAX
const B11_BAND = [40, 50]; const B12_MAX = 30.0; const B12_RATIO = 0.70; const WR_P0 = 0.20; const WR_PALL = 0.50;
const KEEP_PP = 0.02; const MAW_PP = 0.10; const MAW_KEEP = 0.01; const B12_FALLBACK = 1.0; const SPEED_BAND = [0.30, 0.50];
const SPECIAL = ['elite', 'rare', 'dboss'];
const BELK = 'z1_belk'; const MAW = 'z2_mawgrim';
const out = [];
const say = (x = '') => out.push(x);

function load(dir, cls = CL) {
  if (!dir) return null;
  const o = {};
  for (const c of cls) { const f = join(dir, `runs-${c}.jsonl`); if (existsSync(f)) o[c] = readJsonl(f).filter((r) => !r.err); }
  return Object.keys(o).length ? o : null;
}
const flat = (b) => (b ? Object.values(b).flat() : []);
const only = (b, c) => (b && b[c] ? { [c]: b[c] } : null);
const sub = (b, c) => (c === 'all' ? b : only(b, c));
const onSeeds = (b, ref) => { if (!b || !ref) return null; const k = new Set(flat(ref).map((r) => `${r.cls}|${r.seed}`)); return Object.fromEntries(Object.entries(b).map(([c, rs]) => [c, rs.filter((r) => k.has(`${c}|${r.seed}`))])); };
const pc = (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : `${(x * 100).toFixed(d)} %`);
const n1 = (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : Number(x).toFixed(d));
const ci = (k, n) => { if (!n) return 'n/a'; const [lo, hi] = wilson(k, n); return `${(100 * k / n).toFixed(1)} % (${(lo * 100).toFixed(1)}-${(hi * 100).toFixed(1)}; n ${n})`; };
const deadF = (f) => f[2] === 0 || (f.length > 5 && f[5] === 0);
const reach = (rs) => (rs.length ? rs.filter((r) => r.rb).length / rs.length : null);
const win = (rs) => (rs.length ? rs.filter((r) => r.out === 'v').length / rs.length : null);
const winK = (rs) => `${pc(win(rs))} (${rs.filter((r) => r.out === 'v').length} / ${rs.length})`;
const paired = (a, b, f) => { const d = pairedDiff(flat(a), flat(b), f); return d.n ? { v: d.v, lo: d.ci[0], hi: d.ci[1], txt: `${d.v >= 0 ? '+' : ''}${(d.v * 100).toFixed(1)} pp (${(d.ci[0] * 100).toFixed(1)} - ${(d.ci[1] * 100).toFixed(1)}; n ${d.n})` } : { v: null, txt: 'n/a' }; };
const fReach = (r) => (r.rb ? 1 : 0);
const fWin = (r) => (r.out === 'v' ? 1 : 0);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const medianOf = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Per fight group of full runs (elite (not rare), rare, dboss, z1 = specials of zone 1). */
function groups(rs) {
  const g = {};
  const add = (k, f) => { const x = g[k] || (g[k] = { n: 0, d: 0 }); x.n++; if (deadF(f)) x.d++; };
  for (const r of rs) for (let i = 0; i < r.fx.length; i++) { const sg = specialGroup(r, i); if (!sg) continue; add(sg, r.fx[i]); if (r.fx[i][4] === 1) add('z1', r.fx[i]); }
  return g;
}
const gRate = (g, k) => (g[k] && g[k].n ? g[k].d / g[k].n : null);
const think = (b) => (b ? thinkRows(b, Object.values(b).some((rs) => rs.some((r) => r.tm)) ? b : null) : []);
function tkGroups(rows) {
  const g = {};
  const add = (k, x) => { const e = g[k] || (g[k] = { n: 0, own: 0, op: 0, au: 0 }); e.n++; if (x.own.died) e.own++; if (x.op.died) e.op++; if (x.au.died) e.au++; };
  for (const x of rows) { if (!SPECIAL.includes(x.g)) continue; add(x.g, x); if (x.z === 1) add('z1', x); }
  return g;
}
const tkSeeds = (rows, ref) => { const k = new Set(ref.map((x) => `${x.cls}|${x.seed}`)); return rows.filter((x) => k.has(`${x.cls}|${x.seed}`)); };
/** Fights of a dungeon boss template in full runs: { cls, seed, rounds, dead, pot, hpEnd }. */
function bossFights(rs, tid) {
  const xs = [];
  for (const r of rs) for (let i = 0; i < r.fx.length; i++) if (r.fc && r.fc[i] && r.fc[i][2].split(',').some((x) => x === `${tid}:d`)) xs.push({ cls: r.cls, seed: r.seed, rounds: r.fx[i][1], dead: deadF(r.fx[i]), pot: r.fx[i][6] || 0 });
  return xs;
}
const fightCell = (xs) => (xs.length ? `${xs.length} / ${ci(xs.filter((x) => x.dead).length, xs.length)} / ${n1(mean(xs.map((x) => x.rounds)))} (${n1(medianOf(xs.map((x) => x.rounds)), 0)}) / ${pc(xs.filter((x) => x.rounds > 20).length / xs.length)} / ${n1(mean(xs.map((x) => x.pot)), 2)}` : 'n/a');
/** Opener-line deaths of a group, by template (as sim/v14report.mjs deathList). */
function deathList(rows, grp) {
  const xs = rows.filter((x) => x.g === grp && x.op.died);
  if (!xs.length) return 'none';
  const m = new Map();
  for (const x of xs) {
    const t = x.tids.find((id) => CONTENT.enemies[id] && (grp !== 'dboss' || CONTENT.enemies[id].kind !== 'normal')) || x.tids[0];
    const e = CONTENT.enemies[t];
    const k = `${e ? e.name : t} (${e ? e.archetype : '?'})`;
    const v = m.get(k) || { n: 0, cls: new Map(), z: new Set(), seeds: [] };
    v.n++; v.cls.set(x.cls, (v.cls.get(x.cls) || 0) + 1); v.z.add(x.z); v.seeds.push(`${x.cls} ${x.seed}`);
    m.set(k, v);
  }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${k} ${v.n} (${[...v.cls.entries()].map(([c, n]) => `${c} ${n}`).join(', ')}; zone ${[...v.z].join(', ')}; seeds ${v.seeds.join(', ')})`).join('; ');
}

// ---------------------------------------------------------------- cells
const firstDir = (dir, re) => { if (!existsSync(dir)) return null; const n = readdirSync(dir).find((x) => re.test(x)); return n ? `${dir}/${n}` : null; };
const N = {
  tkX: load(join(IN, 'think/onebutton-P0-exp-prep')), obX: load(join(IN, 'exp/onebutton-P0-exp-prep')), plX: load(join(IN, 'exp/planner-P0-exp-prep')),
  plA: load(join(IN, 'exp/planner-PALL-exp-prep')), plXoff: load(join(IN, 'exp/planner-P0-exp-prep-noswift')), plAoff: load(join(IN, 'exp/planner-PALL-exp-prep-noswift')),
  v11: load(join(IN, 'exp/speedrunner-PALL-v11-exp-prep')), v11off: load(join(IN, 'exp/speedrunner-PALL-v11-exp-prep-noswift')), v12: load(join(IN, 'exp/speedrunner-PALL-exp-prep')),
  plC: load(join(IN, 'classic/planner-P0')), maw: load(join(IN, 'classic/planner-P0-maw'), ['mage']),
};
const ARMS = {};
if (existsSync(IN)) for (const d of readdirSync(IN).filter((x) => /^(frac|tolls)/.test(x))) ARMS[d] = { v11: load(join(IN, d, 'speedrunner-PALL-v11-exp-prep')), p0: load(join(IN, d, 'planner-P0-exp-prep')), pall: load(join(IN, d, 'planner-PALL-exp-prep')) };
const P14 = { tkX: load(join(V14, 'think/onebutton-P0-exp-prep')), plX: load(join(V14, 'exp/planner-P0-exp-prep')), plC: load(join(V14, 'classic/planner-P0')) };
const P13 = {
  obX: load(join(V13, 'exp/onebutton-P0-exp-prep')), plX: load(join(V13, 'exp/planner-P0-exp-prep')), plA: load(join(V13, 'exp/planner-PALL-exp-prep')),
  v11: load(join(V13, 'exp/speedrunner-PALL-v11-exp-prep')), v12: load(firstDir(join(V13, 'exp-v12price'), /^speedrunner-PALL-exp-prep$/)),
};
const decisions = [];
say(`<!-- generated by node sim/v15report.mjs --in ${IN} --v14 ${V14} --v13 ${V13} -->`);
say();

// ---------------------------------------------------------------- Row 1: B60 expedition, B59, B61, Belk
const RX = think(N.tkX); const RX14 = tkSeeds(think(P14.tkX), RX);
say('### Row 1: B60 expedition (opener line on the one-button runs\' fights, cell 1)');
say();
say('| Class | Elite (not rare) | Rare | Dungeon boss | Z1 specials | Autoplay replay: elite / rare / dungeon boss | One button (own) replay: elite / rare / dungeon boss | v14 (same seeds): elite / rare / dungeon boss |');
say('|---|---|---|---|---|---|---|---|');
for (const c of [...CL, 'all']) {
  const xs = c === 'all' ? RX : RX.filter((x) => x.cls === c);
  const g = tkGroups(xs);
  const cell = (k) => (g[k] ? `${ci(g[k].op, g[k].n)}${c === 'all' ? (g[k].op / g[k].n <= OPEN[k] + 1e-9 ? ' pass' : ' **fail**') : ''}` : 'n/a');
  const pg = tkGroups(c === 'all' ? RX14 : RX14.filter((x) => x.cls === c));
  say(`| ${c === 'all' ? '**all**' : c} | ${cell('elite')} | ${cell('rare')} | ${cell('dboss')} | ${g.z1 ? pc(g.z1.op / g.z1.n) : 'n/a'} | ${SPECIAL.map((k) => (g[k] ? pc(g[k].au / g[k].n) : 'n/a')).join(' / ')} | ${SPECIAL.map((k) => (g[k] ? pc(g[k].own / g[k].n) : 'n/a')).join(' / ')} | ${SPECIAL.map((k) => (pg[k] ? `${pc(pg[k].op / pg[k].n)} (n ${pg[k].n})` : 'n/a')).join(' / ')} |`);
}
say();
say(`Caps: elite <= ${pc(OPEN.elite, 0)}, rare <= ${pc(OPEN.rare, 0)}, dungeon boss <= ${pc(OPEN.dboss, 0)}.`);
say();
if (RX.length) {
  say(`- Opener-line deaths, dungeon bosses: ${deathList(RX, 'dboss')}. Elites: ${deathList(RX, 'elite')}. Rares: ${deathList(RX, 'rare')}.`);
  say(`- v14 (same seeds), dungeon bosses: ${deathList(RX14, 'dboss')}.`);
  const bx = RX.filter((x) => x.g === 'dboss' && x.tids.includes(BELK)); const bx14 = RX14.filter((x) => x.g === 'dboss' && x.tids.includes(BELK));
  const lines = (xs) => ['op', 'au', 'own'].map((k) => `${xs.filter((x) => x[k].died).length}`).join(' / ');
  say(`- Warden Belk of Harrow in the replays: ${bx.length} fights; deaths opener line / autoplay / one button ${lines(bx)} (v14 same seeds: ${bx14.length} fights, ${lines(bx14)}).`);
  say();
}

say('### Row 1: B59 one-button deaths per special fight, expedition P0 (cell 1 full runs, 300 per class)');
say();
say('| Class | Elite (not rare) | Rare | Dungeon boss | Zone 1 specials | Replays (own, 50 per class): elite / rare / dungeon boss / Z1 | v13 cell (v13 engine, same seeds): elite / rare / dungeon boss / Z1 |');
say('|---|---|---|---|---|---|---|');
for (const c of [...CL, 'all']) {
  if (!N.obX) break;
  const g = groups(c === 'all' ? flat(N.obX) : N.obX[c] || []);
  const rg = tkGroups(c === 'all' ? RX : RX.filter((x) => x.cls === c));
  const pg = P13.obX ? groups(c === 'all' ? flat(P13.obX) : P13.obX[c] || []) : null;
  const cell = (k) => (g[k] ? `${ci(g[k].d, g[k].n)}${c === 'all' ? (g[k].d / g[k].n >= T59[k] - 1e-9 ? ' pass' : ' **fail**') : ''}` : 'n/a');
  say(`| ${c === 'all' ? '**all**' : c} | ${cell('elite')} | ${cell('rare')} | ${cell('dboss')} | ${cell('z1')} | ${['elite', 'rare', 'dboss', 'z1'].map((k) => (rg[k] ? pc(rg[k].own / rg[k].n) : 'n/a')).join(' / ')} | ${pg ? ['elite', 'rare', 'dboss', 'z1'].map((k) => pc(gRate(pg, k))).join(' / ') : 'n/a'} |`);
}
say();
say(`Targets: elite >= ${pc(T59.elite, 0)}, rare >= ${pc(T59.rare, 0)}, dungeon boss >= ${pc(T59.dboss, 0)}, zone 1 specials >= ${pc(T59.z1, 0)}.`);
say();

function b61Block(title, now, pre, preLabel) {
  if (!now || !pre) return;
  say(`#### B61 autoplay (planner) ${title}, against ${preLabel}`);
  say();
  say('| Class | Reach the boss: now / before / paired | Win: now / before / paired | Deaths, now / before: elite | rare | dungeon boss | Z1 specials |');
  say('|---|---|---|---|---|---|');
  for (const c of [...CL, 'all']) {
    const a = sub(now, c); const b = sub(pre, c);
    if (!a || !b) continue;
    const ga = groups(flat(a)); const gb = groups(flat(b));
    const sp = (k) => `${pc(gRate(ga, k))} / ${pc(gRate(gb, k))}`;
    say(`| ${c === 'all' ? '**all**' : c} | ${pc(reach(flat(a)))} / ${pc(reach(flat(b)))} / ${paired(a, b, fReach).txt} | ${pc(win(flat(a)))} / ${pc(win(flat(b)))} / ${paired(a, b, fWin).txt} | ${sp('elite')} | ${sp('rare')} | ${sp('dboss')} | ${sp('z1')} |`);
  }
  say();
}
say('### Row 1: B61 per class');
say();
b61Block('expedition P0, Swift passage off (cell 3B: row 1 alone)', N.plXoff, P14.plX, 'the v14 cell (Belk 1.05; same tables and seeds)');
b61Block('expedition P0, as built (cell 1: rows 1 and 2)', N.plX, P14.plX, 'the v14 cell');
b61Block('classic P0, as built (cell 4)', N.plC, P14.plC, 'the v14 cell');

say('### Row 1: Warden Belk of Harrow fights per class (full runs)');
say();
say('| Cell | Class | Fights / deaths / rounds mean (median) / share past round 20 / potions per fight: now | v14 or v13 (same seeds) |');
say('|---|---|---|---|');
for (const [label, a, b] of [['expedition planner P0 (v14)', N.plX, P14.plX], ['expedition planner P0, Swift off (v14)', N.plXoff, P14.plX], ['expedition one button P0 (v13 cell)', N.obX, P13.obX], ['classic planner P0 (v14)', N.plC, P14.plC]]) {
  if (!a) continue;
  for (const c of [...CL, 'all']) {
    const x = bossFights(c === 'all' ? flat(a) : a[c] || [], BELK); const y = b ? bossFights(c === 'all' ? flat(b) : b[c] || [], BELK) : [];
    say(`| ${label} | ${c === 'all' ? '**all**' : c} | ${fightCell(x)} | ${fightCell(y)} |`);
  }
}
say();

// Decision rule of row 1.
{
  const g = tkGroups(RX); const ob = N.obX ? groups(flat(N.obX)) : {};
  const op = g.dboss ? g.dboss.op / g.dboss.n : null; const one = gRate(ob, 'dboss');
  const okOp = op !== null && op <= OPEN.dboss + 1e-9; const okOne = one !== null && one >= T59.dboss - 1e-9;
  decisions.push(['Row 1: opener-line dungeon-boss deaths <= 5 % (cell 1 replays)', g.dboss ? ci(g.dboss.op, g.dboss.n) : 'n/a', okOp]);
  decisions.push(['Row 1: one-button dungeon-boss deaths >= 70 % (cell 1 full runs, 300 per class)', ob.dboss ? ci(ob.dboss.d, ob.dboss.n) : 'n/a', okOne]);
  decisions.push(['**Row 1 (Belk hpMult 0.90)**', okOp && okOne ? 'both hold' : 'a condition fails', okOp && okOne ? 'stays' : 'report the fights; no further cut without a replay']);
}

// ---------------------------------------------------------------- Rows 2-3: B12, B11, criterion 2
const swiftStats = (rs) => {
  const ok = rs.filter((r) => r.ex);
  const sw = ok.map((r) => r.ex.swift || 0); const bells = ok.map((r) => (r.ex.zones || []).filter((z) => z[6] === 'b').length);
  const zs = ok.flatMap((r) => r.ex.zones.filter((z) => z[6] !== ''));
  const inWin = zs.filter((z) => z[1] <= C.ROAD_SWIFT_TOLLS);
  return { perRun: mean(sw), bellsPerRun: mean(bells), zones: zs.length, roadPaid: zs.filter((z) => z[7] > 0).length, bellInWin: inWin.filter((z) => z[6] === 'b').length, ztMed: medianOf(zs.map((z) => z[1])) };
};
function speedRow(label, b, b11) {
  if (!b) return null;
  const rs = flat(b);
  const l = runLength(rs, combatMinutes);
  const wins = rs.filter((r) => r.out === 'v');
  const s = swiftStats(rs); const sw = swiftStats(wins);
  const so = l.autoWinsSetOut; const st = l.autoWins;
  const reachRs = rs.filter((r) => r.rb && r.boss);
  const ilvl = reachRs.length ? mean(reachRs.map((r) => r.boss.ilvl)) : null;
  return {
    label, n: rs.length, wins: wins.length, win: win(rs), so: so.v, soCi: so.n ? so.ci : null, st: st.v, ratio: b11 && st.v ? st.v / b11 : null,
    swift: s.perRun, swiftWin: sw.perRun, lv: s.perRun === null ? null : s.perRun * C.ROAD_SWIFT_XP_FRAC, bells: s.bellsPerRun, bellInWin: s.bellInWin, zones: s.zones, ztMed: s.ztMed,
    fights: mean(wins.map((r) => r.fights)), rounds: mean(wins.map((r) => r.rounds)), ilvl, dung: mean(rs.map((r) => r.dungeons || 0)), reach: reach(rs),
  };
}
const b11Of = (b) => (b ? runLength(flat(b), combatMinutes).manualReach.v : null);
const B11 = b11Of(N.plX); const B11off = b11Of(N.plXoff); const B11v14 = b11Of(P14.plX); const B11v13 = b11Of(P13.plX);
say('### Rows 2-3: B12 (speedrunner PALL wins, expedition with the start camp; cell 2)');
say();
say(`B11 of this engine (planner P0, cell 1): **${n1(B11)} min**; 0.70 × B11 = ${n1(B11 === null ? null : B11 * B12_RATIO)} min (from run start).`);
say();
say('| Cell | Runs | Wins (win %) | B12 from SET_OUT, median (95 % CI) | From run start | / B11 | Swift exits per run (wins) | Levels from swift per run | Bell exits per run; Bell exits in the window | Zone tolls at exit, median | Fights / rounds per win | Boss ilvl (reach) | Dungeons per run | Reach |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const SROWS = [
  speedRow('v11 policy, row 2 on (as built)', N.v11, B11), speedRow('v11 policy, row 2 off (-noswift)', N.v11off, B11), speedRow('v12 policy (specified bot), row 2 on', N.v12, B11),
  speedRow('v13 pass: v11 policy (v13 engine)', P13.v11, B11v13), speedRow('v13 pass: v12 policy at balance.md 1\'s rate', P13.v12, B11v13),
  ...Object.entries(ARMS).map(([k, a]) => speedRow(`arm ${k}: v11 policy`, a.v11, b11Of(a.p0))),
].filter(Boolean);
for (const x of SROWS) say(`| ${x.label} | ${x.n} | ${x.wins} (${pc(x.win)}) | **${n1(x.so)}** (${x.soCi ? `${n1(x.soCi[0])} - ${n1(x.soCi[1])}` : 'n/a'}) | ${n1(x.st)} | ${n1(x.ratio, 3)} | ${n1(x.swift, 2)} (${n1(x.swiftWin, 2)}) | ${n1(x.lv, 2)} | ${n1(x.bells, 2)}; ${x.bellInWin} of ${x.zones} zone exits | ${n1(x.ztMed, 0)} | ${n1(x.fights)} / ${n1(x.rounds, 0)} | ${n1(x.ilvl)} | ${n1(x.dung, 2)} | ${pc(x.reach)} |`);
say();
if (N.v11 && N.v11off) {
  say(`- Row 2 on against off, v11 policy (paired, ${flat(N.v11).length} runs): win ${paired(N.v11, N.v11off, fWin).txt}, reach ${paired(N.v11, N.v11off, fReach).txt}.`);
  for (const c of CL) say(`  - ${c}: win ${winK(N.v11[c] || [])} against ${winK(N.v11off[c] || [])}; ${paired(only(N.v11, c), only(N.v11off, c), fWin).txt}.`);
}
if (N.v11 && P13.v11) say(`- v11 policy against the v13 pass (v13 engine; rows 1-2 of v14 and v15 between): win ${paired(N.v11, P13.v11, fWin).txt}.`);
say(`- B3 speedrunner PALL band ${pc(SPEED_BAND[0], 0)}-${pc(SPEED_BAND[1], 0)}: v11 policy ${N.v11 ? pc(win(flat(N.v11))) : 'n/a'}, v12 policy ${N.v12 ? pc(win(flat(N.v12))) : 'n/a'}.`);
say();

function plannerRow(label, b, ref, refLabel) {
  if (!b) return;
  const rs = flat(b);
  const l = runLength(rs, combatMinutes);
  const s = swiftStats(rs);
  say(`| ${label} | ${rs.length} | **${winK(rs)}** | ${pc(reach(rs))} | ${n1(l.manualReach.v)} | ${n1(s.perRun, 2)} | ${n1(s.bellsPerRun, 2)} | ${n1(s.ztMed, 0)} | ${ref ? `${refLabel}: win ${paired(b, ref, fWin).txt}; reach ${paired(b, ref, fReach).txt}` : ''} |`);
}
say('### Row 2: B11 and flip criterion 2 (expedition planner with the start camp; cells 1, 3 and 3B)');
say();
say('| Cell | Runs | Win | Reach | B11 (min, reach) | Swift exits per run | Bell exits per run | Zone tolls at exit, median | Paired |');
say('|---|---|---|---|---|---|---|---|---|');
plannerRow('P0, as built (row 2 on)', N.plX, N.plXoff, 'against row 2 off');
plannerRow('P0, row 2 off (-noswift)', N.plXoff, P14.plX, 'against v14 (Belk 1.05)');
plannerRow('P0, v14 pass', P14.plX, null, '');
plannerRow('PALL, as built (row 2 on)', N.plA, N.plAoff, 'against row 2 off');
plannerRow('PALL, row 2 off (-noswift)', N.plAoff, P13.plA, 'against v13 pass');
plannerRow('PALL, v13 pass', P13.plA, null, '');
plannerRow('P0, as built, against v14', N.plX, P14.plX, 'against v14');
plannerRow('PALL, as built, against v13', N.plA, P13.plA, 'against v13');
for (const [k, a] of Object.entries(ARMS)) { plannerRow(`arm ${k}: P0`, a.p0, N.plX, 'against as built'); plannerRow(`arm ${k}: PALL`, a.pall, N.plA, 'against as built'); }
say();
if (N.plX) for (const c of CL) say(`- P0 ${c}: ${winK(N.plX[c] || [])}${N.plXoff ? ` (row 2 off ${winK(N.plXoff[c] || [])})` : ''}; PALL ${c}: ${N.plA ? winK(N.plA[c] || []) : 'n/a'}${N.plAoff ? ` (row 2 off ${winK(N.plAoff[c] || [])})` : ''}.`);
say();

// Decision rules of rows 2-3.
{
  const v = SROWS[0];
  const pP0 = N.plX ? win(flat(N.plX)) : null; const pPA = N.plA ? win(flat(N.plA)) : null;
  const d0 = N.plX && N.plXoff ? paired(N.plX, N.plXoff, fWin) : { v: null, txt: 'n/a' };
  const dA = N.plA && N.plAoff ? paired(N.plA, N.plAoff, fWin) : { v: null, txt: 'n/a' };
  const okWins = v && v.wins >= 200;
  const okB12 = v && v.so !== null && v.so <= B12_MAX + 1e-9; const okRatio = v && v.ratio !== null && v.ratio <= B12_RATIO + 1e-9;
  const okB11 = B11 !== null && B11 >= B11_BAND[0] && B11 <= B11_BAND[1];
  const okP0 = pP0 !== null && pP0 >= WR_P0 - 1e-9; const okPA = pPA !== null && pPA >= WR_PALL - 1e-9;
  const okFall = d0.v !== null && dA.v !== null && d0.v >= -KEEP_PP - 1e-9 && dA.v >= -KEEP_PP - 1e-9;
  const miss = v && v.so !== null ? Math.max(v.so - B12_MAX, v.st - B12_RATIO * B11) : null;
  decisions.push(['Row 3: the v11 policy reads B12 (>= 200 wins)', v ? `${v.wins} wins` : 'n/a', okWins]);
  decisions.push(['Row 2: B12 (v11 policy) <= 30.0 min from SET_OUT', v ? `${n1(v.so)} min` : 'n/a', okB12]);
  decisions.push(['Row 2: B12 <= 0.70 × B11 (from run start)', v ? `${n1(v.st)} min = ${n1(v.ratio, 3)} × B11 (${n1(B11)}; line ${n1(B12_RATIO * B11)} min)` : 'n/a', okRatio]);
  decisions.push(['Row 2: B11 40-50 min', `${n1(B11)} min (row 2 off ${n1(B11off)}; v14 ${n1(B11v14)})`, okB11]);
  decisions.push(['Row 2 / criterion 2: planner P0 >= 20 % and PALL >= 50 % (900 runs each)', `P0 ${N.plX ? winK(flat(N.plX)) : 'n/a'}; PALL ${N.plA ? winK(flat(N.plA)) : 'n/a'}`, okP0 && okPA]);
  decisions.push(['Row 2: planner win falls by no more than 2 pp (paired with row 2 off, same engine)', `P0 ${d0.txt}; PALL ${dA.txt}`, okFall]);
  let res;
  if (!okFall) res = 'report; keep row 2 off (planner win falls > 2 pp)';
  else if (okB12 && okRatio && okB11 && okP0 && okPA) res = 'stays';
  else if (!okB11 && B11 !== null && B11 < B11_BAND[0]) res = 'arm ROAD_SWIFT_TOLLS 13 (B11 < 40)';
  else if (miss !== null && miss > 0 && miss <= B12_FALLBACK + 1e-9) res = `B12 misses by ${n1(miss, 2)} min (<= 1): arm ROAD_SWIFT_XP_FRAC 1.0 (scratch)`;
  else res = 'misses beyond the fallback: report';
  decisions.push(['**Row 2 (Swift passage)**', miss !== null ? `largest B12 miss ${n1(miss, 2)} min` : 'n/a', res]);
  for (const [k, a] of Object.entries(ARMS)) {
    const x = speedRow(k, a.v11, b11Of(a.p0));
    if (!x) continue;
    const ap0 = a.p0 ? win(flat(a.p0)) : null; const apa = a.pall ? win(flat(a.pall)) : null;
    const f0 = a.p0 && N.plXoff ? paired(onSeeds(a.p0, N.plXoff), N.plXoff, fWin) : { v: null, txt: 'n/a' }; const fa = a.pall && N.plAoff ? paired(onSeeds(a.pall, N.plAoff), N.plAoff, fWin) : { v: null, txt: 'n/a' };
    const okA = x.so !== null && x.so <= B12_MAX + 1e-9 && x.ratio !== null && x.ratio <= B12_RATIO + 1e-9 && x.wins >= 200 && b11Of(a.p0) >= B11_BAND[0] && b11Of(a.p0) <= B11_BAND[1] && ap0 >= WR_P0 - 1e-9 && apa >= WR_PALL - 1e-9 && f0.v !== null && f0.v >= -KEEP_PP - 1e-9 && fa.v !== null && fa.v >= -KEEP_PP - 1e-9;
    decisions.push([`Arm ${k}: B12, B11, criterion 2, planner fall against row 2 off`, `B12 ${n1(x.so)} min from SET_OUT, ${n1(x.st)} = ${n1(x.ratio, 3)} × B11 ${n1(b11Of(a.p0))}; ${x.wins} wins; P0 ${pc(ap0)}, PALL ${pc(apa)}; fall P0 ${f0.txt}, PALL ${fa.txt}`, okA ? 'passes every row 2 condition' : 'a condition fails']);
  }
  const v12 = SROWS.find((x) => x.label.startsWith('v12 policy'));
  decisions.push(['Row 3: B12 on both policies (report)', `v11 ${v ? `${n1(v.so)} min (${v.wins} wins)` : 'n/a'}; v12 ${v12 ? `${n1(v12.so)} min (${v12.wins} wins)` : 'n/a'}`, 'reported']);
}

// ---------------------------------------------------------------- Row 4: Mawgrim (classic P0, Mage)
say('### Row 4: Mawgrim of the Locks, classic P0 planner (cell 4)');
say();
say('| Cell | Class | Mawgrim fights / deaths / rounds mean (median) / share past round 20 / potions per fight | Reach the boss | Win |');
say('|---|---|---|---|---|');
const mage = (b) => (b && b.mage ? b.mage : []);
for (const [label, b] of [['as built (mawgrimHp off)', N.plC], ['row 4 arm (mawgrimHp on, -maw)', N.maw], ['v14 cell (same engine values for Mawgrim)', P14.plC]]) {
  if (!b) continue;
  say(`| ${label} | mage | ${fightCell(bossFights(mage(b), MAW))} | ${pc(reach(mage(b)))} | ${pc(win(mage(b)))} |`);
}
for (const c of ['rogue', 'hunter']) if (N.plC && N.plC[c]) say(`| as built | ${c} | ${fightCell(bossFights(N.plC[c], MAW))} | ${pc(reach(N.plC[c]))} | ${pc(win(N.plC[c]))} |`);
say();
if (N.plC && N.maw) {
  const a = bossFights(mage(N.maw), MAW); const b = bossFights(mage(N.plC), MAW);
  const da = a.length ? a.filter((x) => x.dead).length / a.length : null; const db = b.length ? b.filter((x) => x.dead).length / b.length : null;
  const pr = paired(only(N.maw, 'mage'), only(N.plC, 'mage'), fReach); const pw = paired(only(N.maw, 'mage'), only(N.plC, 'mage'), fWin);
  say(`- Mage, arm against as built (paired, 1 000 runs): reach ${pr.txt}, win ${pw.txt}; Mawgrim deaths ${pc(da)} against ${pc(db)}.`);
  say();
  const fall = da !== null && db !== null ? db - da : null;
  const okFall = fall !== null && fall >= MAW_PP - 1e-9; const okKeep = pr.v !== null && pw.v !== null && pr.v >= -MAW_KEEP - 1e-9 && pw.v >= -MAW_KEEP - 1e-9;
  decisions.push(['Row 4: Mage Mawgrim deaths fall >= 10 pp (arm against as built)', `${pc(da)} against ${pc(db)} (${fall === null ? 'n/a' : `${(fall * 100).toFixed(1)} pp`}); n ${a.length} / ${b.length}`, okFall]);
  decisions.push(['Row 4: Mage reach and win not lower than as built by > 1 pp (paired)', `reach ${pr.txt}; win ${pw.txt}`, okKeep]);
  decisions.push(['**Row 4 (mawgrimHp)**', okFall && okKeep ? 'both hold' : 'a condition fails', okFall && okKeep ? 'applies (on by default)' : 'stays off']);
}
say('### Row 1 continuity: Warden Belk of Harrow, classic P0 planner Rogue (cell 4)');
say();
if (N.plC && P14.plC) {
  const a = bossFights(N.plC.rogue || [], BELK); const b = bossFights(P14.plC.rogue || [], BELK);
  say(`- Rogue against Belk: now ${fightCell(a)}; v14 (734 HP) ${fightCell(b)} (fights / deaths / rounds mean (median) / past round 20 / potions).`);
  say(`- Rogue reach / win: ${pc(reach(N.plC.rogue))} / ${pc(win(N.plC.rogue))} against ${pc(reach(P14.plC.rogue))} / ${pc(win(P14.plC.rogue))}; paired reach ${paired(only(N.plC, 'rogue'), only(P14.plC, 'rogue'), fReach).txt}, win ${paired(only(N.plC, 'rogue'), only(P14.plC, 'rogue'), fWin).txt}.`);
  say();
}

// ---------------------------------------------------------------- decisions
say('### Decision rules (changes-m2b-v15.md)');
say();
say('| Rule | Measured | Result |');
say('|---|---|---|');
for (const [rule, m, ok] of decisions) say(`| ${rule} | ${m} | ${typeof ok === 'string' ? ok : ok ? 'pass' : '**fail**'} |`);
say();
process.stdout.write(out.join('\n') + '\n');
