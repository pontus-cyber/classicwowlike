#!/usr/bin/env node
// M2b v14 report tables (docs/specs/changes-m2b-v14.md "What the sim must run" and its decision rules; report
// docs/reports/balance-2026-11-12b.md). Reads the cells of sim/measure-v14.sh (IN), the v13 pass (V13: the v13 engine,
// rows 5-6 and row 1 off, same tables and seeds), the mash cells (MASH: classic before the Deathblow package) and the v12
// pass (V12: the expedition planner before the package). Every comparison is paired by class and seed. Prints Markdown.
//
//   node sim/v14report.mjs [--in sim/out/pass-v14] [--v13 sim/out/pass-v13] [--mash sim/out/mash] [--v12 sim/out/pass-v12]
//
// "Deaths" = the fight ended the run or needed a resurrect (fx outcome 0, or lowest HP 0 per mille); in the think replays,
// outcome 0 or a resurrect used (as sim/v13report.mjs). "Answered share" = Deathblows answered / (answered + landed).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FIGHT_KINDS } from './lib/recorder.mjs';
import { readJsonl } from './lib/output.mjs';
import { wilson } from './lib/stats.mjs';
import { specialGroup } from './lib/metrics.mjs';
import { pairedDiff } from './lib/combatchecks.mjs';
import { CONTENT } from './lib/engine.mjs';
import { thinkRows, spacing, GROUP_LABEL } from './mashreport.mjs';

const CL = ['rogue', 'mage', 'hunter'];
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const IN = args.in || 'sim/out/pass-v14';
const V13 = args.v13 || 'sim/out/pass-v13';
const MASH = args.mash || 'sim/out/mash';
const V12 = args.v12 || 'sim/out/pass-v12';
const T59 = { elite: 0.40, rare: 0.60, dboss: 0.70, z1: 0.25 };      // B59 ONEBTN_*_MIN
const OPEN = { elite: 0.03, rare: 0.25, dboss: 0.05 };              // B60 OPEN_*_MAX
const ANSWER_MIN = 0.95; const Z1_PP = 0.03; const KEEP_PP = 0.02; const SPECIAL_PP = 0.03; const SPACING = [4, 7];
const SPECIAL = ['elite', 'rare', 'dboss'];
const NORMAL = ['quest', 'grind', 'trash'];
const out = [];
const say = (x = '') => out.push(x);

function load(dir, cls = CL) {
  const o = {};
  for (const c of cls) { const f = join(dir, `runs-${c}.jsonl`); if (existsSync(f)) o[c] = readJsonl(f).filter((r) => !r.err); }
  return Object.keys(o).length ? o : null;
}
const flat = (b) => (b ? Object.values(b).flat() : []);
const only = (b, c) => (b && b[c] ? { [c]: b[c] } : null);
/** byCls restricted to the class|seed keys of another cell (pairing a larger cell with a smaller one). */
const onSeeds = (b, ref) => { if (!b || !ref) return null; const k = new Set(flat(ref).map((r) => `${r.cls}|${r.seed}`)); return Object.fromEntries(Object.entries(b).map(([c, rs]) => [c, rs.filter((r) => k.has(`${c}|${r.seed}`))])); };
const pc = (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : `${(x * 100).toFixed(d)} %`);
const ci = (k, n) => { if (!n) return 'n/a'; const [lo, hi] = wilson(k, n); return `${(100 * k / n).toFixed(1)} % (${(lo * 100).toFixed(1)}-${(hi * 100).toFixed(1)}; n ${n})`; };
const deadF = (f) => f[2] === 0 || (f.length > 5 && f[5] === 0);
const reach = (rs) => (rs.length ? rs.filter((r) => r.rb).length / rs.length : null);
const win = (rs) => (rs.length ? rs.filter((r) => r.out === 'v').length / rs.length : null);
const paired = (a, b, f) => { const d = pairedDiff(flat(a), flat(b), f); return d.n ? { v: d.v, txt: `${d.v >= 0 ? '+' : ''}${(d.v * 100).toFixed(1)} pp (${(d.ci[0] * 100).toFixed(1)} - ${(d.ci[1] * 100).toFixed(1)}; n ${d.n})` } : { v: null, txt: 'n/a' }; };
const fReach = (r) => (r.rb ? 1 : 0);
const fWin = (r) => (r.out === 'v' ? 1 : 0);

/** Per fight group of full runs (elite (not rare), rare, dboss, z1 = specials of zone 1, quest, grind, trash). */
function groups(rs) {
  const g = {};
  const add = (k, f, v) => {
    const x = g[k] || (g[k] = { n: 0, d: 0, dbA: 0, dbL: 0, mm: 0 });
    x.n++; if (deadF(f)) x.d++;
    if (v && v.length > 14) { x.dbA += v[14]; x.dbL += v[15]; x.mm += v[17]; }
  };
  for (const r of rs) {
    for (let i = 0; i < r.fx.length; i++) {
      const f = r.fx[i]; const v = r.f2 && r.f2[i]; const sg = specialGroup(r, i);
      if (sg) { add(sg, f, v); if (f[4] === 1) add('z1', f, v); continue; }
      const k = FIGHT_KINDS[f[0]];
      if (NORMAL.includes(k)) add(k, f, v);
    }
  }
  return g;
}
const gRate = (g, k) => (g[k] && g[k].n ? g[k].d / g[k].n : null);
const answered = (g, k = 'z1') => (g[k] && g[k].dbA + g[k].dbL ? g[k].dbA / (g[k].dbA + g[k].dbL) : null);
const think = (b) => (b ? thinkRows(b, Object.values(b).some((rs) => rs.some((r) => r.tm)) ? b : null) : []);
function tkGroups(rows) {
  const g = {};
  const add = (k, x) => { const e = g[k] || (g[k] = { n: 0, own: 0, op: 0, au: 0 }); e.n++; if (x.own.died) e.own++; if (x.op.died) e.op++; if (x.au.died) e.au++; };
  for (const x of rows) { if (!SPECIAL.includes(x.g)) continue; add(x.g, x); if (x.z === 1) add('z1', x); }
  return g;
}
const tkSeeds = (rows, ref) => { const k = new Set(ref.map((x) => `${x.cls}|${x.seed}`)); return rows.filter((x) => k.has(`${x.cls}|${x.seed}`)); };

// ---------------------------------------------------------------- cells
const N = {
  pl: load(join(IN, 'classic/planner-P0')), off: load(join(IN, 'classic/planner-P0-nosap-nopst')), a: load(join(IN, 'classic/planner-P0-nopst')),
  ob: load(join(IN, 'classic/onebutton-P0')), ma: load(join(IN, 'classic/masher-P0')),
  xpl: load(join(IN, 'exp/planner-P0-exp-prep')), tkX: load(join(IN, 'think/onebutton-P0-exp-prep')), tk0: load(join(IN, 'think/onebutton-P0')),
};
const P13 = {
  pl: load(join(V13, 'classic/planner-P0')), g5: load(join(V13, 'g5/planner-P0-g5')), ob: load(join(V13, 'classic/onebutton-P0')), ma: load(join(V13, 'classic/masher-P0')),
  xpl: load(join(V13, 'exp/planner-P0-exp-prep')), tkX: load(join(V13, 'think/onebutton-P0-exp-prep')), tk0: load(join(V13, 'think/onebutton-P0')), g5tk: load(join(V13, 'g5think/onebutton-P0-g5')),
};
const PRE = { pl: load(join(MASH, 'classic/planner-P0')), xpl: load(join(V12, 'exp/planner-P0-exp-prep')) };
const decisions = [];
say(`<!-- generated by node sim/v14report.mjs --in ${IN} --v13 ${V13} --mash ${MASH} --v12 ${V12} -->`);
say();

// ---------------------------------------------------------------- Row 1 (cells 1 and 4)
function row1Block(title, arms, pre) {
  say(`#### Row 1: autoplay (planner) in zone 1 special fights, ${title}`);
  say();
  say('| Class | Arm | Z1 special fights | Deathblows answered / landed (answered share) | Z1 special deaths | Z1 MAIMED fights | Reach the boss | Win | Reach / win against row 1 off, paired |');
  say('|---|---|---|---|---|---|---|---|---|');
  const offArm = arms.find(([, , role]) => role === 'off');
  for (const c of [...CL, 'all']) {
    for (const [label, d, role] of [...arms, ...(pre ? [[pre[0], pre[1], 'pre']] : [])]) {
      if (!d) continue;
      const rs = c === 'all' ? flat(d) : d[c] || [];
      if (!rs.length) continue;
      const g = groups(rs);
      const z = g.z1 || { n: 0, d: 0, dbA: 0, dbL: 0, mm: 0 };
      const db = z.dbA + z.dbL ? `${z.dbA} / ${z.dbL} (${pc(answered(g))})` : 'n/a';
      const vsOff = offArm && role !== 'off' && role !== 'pre' && role !== 'v13' ? `${paired(c === 'all' ? d : only(d, c), c === 'all' ? offArm[1] : only(offArm[1], c), fReach).txt}; ${paired(c === 'all' ? d : only(d, c), c === 'all' ? offArm[1] : only(offArm[1], c), fWin).txt}` : '';
      say(`| ${c === 'all' ? '**all**' : c} | ${label} | ${z.n} | ${db} | ${ci(z.d, z.n)} | ${z.n ? pc(z.mm / z.n) : 'n/a'} | ${pc(reach(rs))} | ${pc(win(rs))} | ${vsOff} |`);
    }
  }
  say();
}
row1Block('classic P0 (cells 1 and 4; 1 000 per class, seeds 1000 on)', [
  ['row 1 on (as built)', N.pl, 'on'], ['row 1 off (sapHold, passStealth off)', N.off, 'off'], ['row 1 (a) only (cell 4: passStealth off)', N.a, 'a'], ['v13 cell (v13 engine: rows 5-6 off too)', P13.pl, 'v13'],
], ['before the package (mash cell)', PRE.pl]);
row1Block('expedition P0 with the start camp (cell 2; 300 per class)', [['row 1 on (as built)', N.xpl, 'on'], ['v13 cell (v13 engine)', P13.xpl, 'v13']], ['before the package (v12 cell)', PRE.xpl]);

// Decision rules of row 1 (changes-m2b-v14.md).
{
  const r = (d) => (d && d.rogue ? d.rogue : []);
  const gOn = groups(r(N.pl)); const gPre = groups(r(PRE.pl)); const gXOn = groups(r(N.xpl)); const gXPre = groups(r(PRE.xpl));
  const ans = answered(gOn);
  const z1 = gRate(gOn, 'z1'); const z1pre = gRate(gPre, 'z1');
  const xz1 = gRate(gXOn, 'z1'); const xz1pre = gRate(gXPre, 'z1');
  const dR = paired(only(N.pl, 'rogue'), only(N.off, 'rogue'), fReach); const dW = paired(only(N.pl, 'rogue'), only(N.off, 'rogue'), fWin);
  const okAns = ans !== null && ans >= ANSWER_MIN;
  const okZ1 = z1 !== null && z1pre !== null && z1 - z1pre <= Z1_PP + 1e-9;
  const okXZ1 = xz1 !== null && xz1pre !== null && xz1 - xz1pre <= Z1_PP + 1e-9;
  const okKeep = dR.v !== null && dW.v !== null && dR.v >= -KEEP_PP - 1e-9 && dW.v >= -KEEP_PP - 1e-9;
  const stays = okAns && okZ1 && okXZ1 && okKeep;
  decisions.push(['Row 1 stays: Rogue Z1 Deathblows answered by autoplay >= 95 % (cell 1)', pc(ans), okAns]);
  decisions.push(['Rogue Z1 special deaths within +3 pp of before the package, classic (cell 1)', `${pc(z1)} against ${pc(z1pre)} (${z1 !== null && z1pre !== null ? `${((z1 - z1pre) * 100).toFixed(1)} pp` : 'n/a'})`, okZ1]);
  decisions.push(['Rogue Z1 special deaths within +3 pp of before the package, expedition (cell 2)', `${pc(xz1)} against ${pc(xz1pre)} (${xz1 !== null && xz1pre !== null ? `${((xz1 - xz1pre) * 100).toFixed(1)} pp` : 'n/a'})`, okXZ1]);
  decisions.push(['Rogue reach and win not below the row-1-off arm by more than 2 pp (cell 1, paired)', `reach ${dR.txt}; win ${dW.txt}`, okKeep]);
  decisions.push(['**Row 1**', stays ? 'every condition holds' : 'a condition fails', stays ? 'stays' : 'report; keep row 1 off']);
  if (N.a && N.a.rogue) {
    const ra = reach(N.a.rogue); const ron = reach(N.pl.rogue);
    const d = paired(only(N.a, 'rogue'), only(N.pl, 'rogue'), fReach); const dw = paired(only(N.a, 'rogue'), only(N.pl, 'rogue'), fWin);
    const keepB = ra <= ron + 1e-9;
    decisions.push(['**Row 1 (b)** stays if cell 4\'s Rogue reach is not above cell 1\'s row-1-on Rogue reach', `cell 4 ${pc(ra)} against ${pc(ron)}: ${d.txt} (win ${dw.txt})`, keepB ? 'stays' : 'drop (b), keep (a)']);
  }
}

// ---------------------------------------------------------------- B61 per class
function b61Block(title, now, pre, preLabel) {
  if (!now || !pre) return;
  say(`#### B61 autoplay (planner) ${title}, against ${preLabel}`);
  say();
  say('| Class | Reach the boss: now / before / paired | Win: now / before / paired | Deaths, now / before: elite | rare | dungeon boss | Z1 specials |');
  say('|---|---|---|---|---|---|');
  for (const c of [...CL, 'all']) {
    const a = c === 'all' ? now : only(now, c); const b = c === 'all' ? pre : only(pre, c);
    if (!a || !b) continue;
    const fa = flat(a); const fb = flat(b);
    const ga = groups(fa); const gb = groups(fb);
    const sp = (k) => { const x = gRate(ga, k); const y = gRate(gb, k); const ok = x !== null && y !== null && x - y <= SPECIAL_PP + 1e-9; return `${pc(x)} / ${pc(y)}${ok ? '' : ' (over +3 pp)'}`; };
    const pr = paired(a, b, fReach); const pw = paired(a, b, fWin);
    const keep = (d) => (c === 'all' && d.v !== null ? (d.v >= -KEEP_PP - 1e-9 ? ' pass' : ' **fail**') : '');
    say(`| ${c === 'all' ? '**all**' : c} | ${pc(reach(fa))} / ${pc(reach(fb))} / ${pr.txt}${keep(pr)} | ${pc(win(fa))} / ${pc(win(fb))} / ${pw.txt}${keep(pw)} | ${sp('elite')} | ${sp('rare')} | ${sp('dboss')} | ${sp('z1')} |`);
  }
  say();
}
say('### B61 per class');
say();
b61Block('classic P0 (cell 1, row 1 on)', N.pl, PRE.pl, 'the mash cell (pre-package; same tables and seeds)');
b61Block('classic P0 (cell 1, row 1 on)', N.pl, P13.pl, 'the v13 cell (rows 5-6 and row 1 off)');
b61Block('expedition P0 (cell 2, row 1 on)', N.xpl, PRE.xpl, 'the v12 flip cell (pre-package; same tables and seeds)');
b61Block('expedition P0 (cell 2, row 1 on)', N.xpl, P13.xpl, 'the v13 cell');

// ---------------------------------------------------------------- B60
function b60Block(title, rows, refs) {
  if (!rows.length) return;
  say(`#### B60 opener line deaths on the same fights (paired think replays of the onebutton runs), ${title}`);
  say();
  say(`| Class | Elite (not rare) | Rare | Dungeon boss | Z1 specials | Autoplay replay: elite / rare / dungeon boss | ${refs.map(([l]) => `${l}: elite / rare / dungeon boss`).join(' | ')} |`);
  say(`|---|---|---|---|---|---|${refs.map(() => '---|').join('')}`);
  for (const c of [...CL, 'all']) {
    const xs = c === 'all' ? rows : rows.filter((x) => x.cls === c);
    const g = tkGroups(xs);
    const cell = (k) => (g[k] ? `${ci(g[k].op, g[k].n)}${c === 'all' ? (g[k].op / g[k].n <= OPEN[k] + 1e-9 ? ' pass' : ' **fail**') : ''}` : 'n/a');
    const rc = refs.map(([, rr]) => { const pg = tkGroups(c === 'all' ? rr : rr.filter((x) => x.cls === c)); return SPECIAL.map((k) => (pg[k] ? `${pc(pg[k].op / pg[k].n)} (n ${pg[k].n})` : 'n/a')).join(' / '); });
    say(`| ${c === 'all' ? '**all**' : c} | ${cell('elite')} | ${cell('rare')} | ${cell('dboss')} | ${g.z1 ? pc(g.z1.op / g.z1.n) : 'n/a'} | ${SPECIAL.map((k) => (g[k] ? pc(g[k].au / g[k].n) : 'n/a')).join(' / ')} | ${rc.join(' | ')} |`);
  }
  say();
  say(`Caps: elite <= ${pc(OPEN.elite, 0)}, rare <= ${pc(OPEN.rare, 0)}, dungeon boss <= ${pc(OPEN.dboss, 0)}.`);
  say();
}
/** Opener-line deaths of a group, by template (enemy, archetype, Deathblow type, class, zone). */
function deathList(rows, grp) {
  const xs = rows.filter((x) => x.g === grp && x.op.died);
  if (!xs.length) return 'none';
  const m = new Map();
  for (const x of xs) {
    const t = x.tids.find((id) => CONTENT.enemies[id] && (grp !== 'dboss' || CONTENT.enemies[id].kind !== 'normal')) || x.tids[0];
    const e = CONTENT.enemies[t];
    const k = `${e ? e.name : t} (${e ? e.archetype : '?'})`;
    const v = m.get(k) || { n: 0, cls: new Map(), z: new Set() };
    v.n++; v.cls.set(x.cls, (v.cls.get(x.cls) || 0) + 1); v.z.add(x.z);
    m.set(k, v);
  }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${k} ${v.n} (${[...v.cls.entries()].map(([c, n]) => `${c} ${n}`).join(', ')}; zone ${[...v.z].join(', ')})`).join('; ');
}
const RX = think(N.tkX); const RX13 = tkSeeds(think(P13.tkX), RX);
const R0 = think(N.tk0); const R013 = tkSeeds(think(P13.tk0), R0); const R0g5 = tkSeeds(think(P13.g5tk), R0);
say('### B60');
say();
b60Block('expedition P0 (cell 2, 50 per class)', RX, [['v13 (same seeds)', RX13]]);
if (RX.length) {
  say(`- Expedition opener-line deaths, dungeon bosses: ${deathList(RX, 'dboss')}. Elites: ${deathList(RX, 'elite')}. Rares: ${deathList(RX, 'rare')}.`);
  say(`- v13 (same seeds), dungeon bosses: ${deathList(RX13, 'dboss')}. Elites: ${deathList(RX13, 'elite')}.`);
  say();
}
b60Block('classic P0 (cell 3, 50 per class)', R0, [['v13 (same seeds)', R013], ['v13 row 5 arm (same seeds)', R0g5]]);
if (R0.length) { say(`- Classic opener-line deaths, rares: ${deathList(R0, 'rare')}; elites: ${deathList(R0, 'elite')}; dungeon bosses: ${deathList(R0, 'dboss')}.`); say(); }

// ---------------------------------------------------------------- B59
function b59Block(title, full, rows, pre, preLabel) {
  if (!full) return;
  say(`#### B59 one-button deaths per special fight, ${title}`);
  say();
  say(`| Class | Elite (not rare) | Rare | Dungeon boss | Zone 1 specials | Replays (own): elite / rare / dungeon boss / Z1 | ${preLabel}: elite / rare / dungeon boss / Z1 |`);
  say('|---|---|---|---|---|---|---|');
  for (const c of [...CL, 'all']) {
    const g = groups(c === 'all' ? flat(full) : full[c] || []);
    const rg = rows && rows.length ? tkGroups(c === 'all' ? rows : rows.filter((x) => x.cls === c)) : null;
    const pg = pre ? groups(c === 'all' ? flat(pre) : pre[c] || []) : null;
    const cell = (k) => (g[k] ? `${ci(g[k].d, g[k].n)}${c === 'all' ? (g[k].d / g[k].n >= T59[k] - 1e-9 ? ' pass' : ' **fail**') : ''}` : 'n/a');
    const rr = rg ? ['elite', 'rare', 'dboss', 'z1'].map((k) => (rg[k] ? pc(rg[k].own / rg[k].n) : 'n/a')).join(' / ') : 'not run';
    const pr = pg ? ['elite', 'rare', 'dboss', 'z1'].map((k) => pc(gRate(pg, k))).join(' / ') : 'n/a';
    say(`| ${c === 'all' ? '**all**' : c} | ${cell('elite')} | ${cell('rare')} | ${cell('dboss')} | ${cell('z1')} | ${rr} | ${pr} |`);
  }
  say();
  say(`Targets: elite >= ${pc(T59.elite, 0)}, rare >= ${pc(T59.rare, 0)}, dungeon boss >= ${pc(T59.dboss, 0)}, zone 1 specials >= ${pc(T59.z1, 0)} (full runs decide).`);
  say();
}
say('### B59');
say();
b59Block('classic P0 (cell 1 full runs, 1 000 per class; cell 3 replays, 50 per class)', N.ob, R0, P13.ob, 'v13 cell 1 (same seeds)');
b59Block('expedition P0 (cell 2 full runs, 50 per class, and their replays)', N.tkX, RX, onSeeds(P13.tkX, N.tkX), 'v13 (same seeds)');

// ---------------------------------------------------------------- B62 (b)
function spacingBlock(title, rows, byCls, preRows, preByCls) {
  if (!rows.length) return;
  const one = (rs, b) => spacing(rs.filter((x) => x.ma).map((x) => ({ ...x, think: !!x.thinkRot })), b);
  const a = one(rows, byCls); const b = preRows.length ? one(preRows, preByCls) : null;
  const f = (s) => (s ? `${(s.nodes / Math.max(1, s.nThink)).toFixed(1)} nodes (${(s.nThink / s.runs).toFixed(2)} per run; n ${s.nThink})` : 'n/a');
  say(`#### B62 (b) think-fight spacing, ${title}`);
  say();
  say('| Measure | Now | v13 (same seeds) |');
  say('|---|---|---|');
  say(`| Rotation (masher on the onebutton runs' fights): nodes per think fight | ${f(a)} | ${b ? f(b) : 'n/a'} |`);
  for (const c of CL) {
    const rc = rows.filter((x) => x.cls === c); const pc0 = preRows.filter((x) => x.cls === c);
    if (!rc.length) continue;
    say(`| Rotation, ${c} | ${f(one(rc, { [c]: byCls[c] }))} | ${pc0.length ? f(one(pc0, { [c]: preByCls[c] })) : 'n/a'} |`);
  }
  const v = a.nodes / Math.max(1, a.nThink);
  say();
  say(`B62 (b) band ${SPACING[0]}-${SPACING[1]} nodes between rotation think fights: ${v.toFixed(1)} -> ${v >= SPACING[0] && v <= SPACING[1] ? 'pass' : '**fail**'}.`);
  say();
}
say('### B62 (b)');
say();
spacingBlock('expedition P0 (cell 2)', RX, N.tkX, RX13, onSeeds(P13.tkX, N.tkX));

// ---------------------------------------------------------------- O14
say('### O14: one-button and masher reach and win, classic P0 (cell 1)');
say();
say('| Bot | Class | Reach the boss: now / v13 / paired | Win: now / v13 / paired |');
say('|---|---|---|---|');
for (const [label, a, b] of [['onebutton', N.ob, P13.ob], ['masher', N.ma, P13.ma]]) {
  if (!a || !b) continue;
  for (const c of [...CL, 'all']) {
    const x = c === 'all' ? a : only(a, c); const y = c === 'all' ? b : only(b, c);
    say(`| ${label} | ${c === 'all' ? '**all**' : c} | ${pc(reach(flat(x)))} / ${pc(reach(flat(y)))} / ${paired(x, y, fReach).txt} | ${pc(win(flat(x)))} / ${pc(win(flat(y)))} / ${paired(x, y, fWin).txt} |`);
  }
}
say();

// ---------------------------------------------------------------- decisions
say('### Decision rules (changes-m2b-v14.md)');
say();
say('| Rule | Measured | Result |');
say('|---|---|---|');
for (const [rule, m, ok] of decisions) say(`| ${rule} | ${m} | ${typeof ok === 'string' ? ok : ok ? 'pass' : '**fail**'} |`);
say();
process.stdout.write(out.join('\n') + '\n');
