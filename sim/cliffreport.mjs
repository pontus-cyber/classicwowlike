#!/usr/bin/env node
// Tables of report docs/reports/balance-2026-11-13c.md (the zone 1 -> zone 2 difficulty step; blind testers, D144):
// per zone 1 and 2 and bot, fights, levels per fight, XP sources, HP low point per fight, deaths per fight index; the
// "cliff" (last 3 fights of zone 1 against the first 3 of zone 2) and player level against enemy level at zone 2 entry;
// the B-rows that read zones 1-2. Reads the cells written by sim/measure-cliff.sh (record fields fx, lv, xz, travelLv).
//
//   node sim/cliffreport.mjs [OUT]        OUT default sim/out/pass-cliff (main/, guided/, arm-*/)
//   node sim/cliffreport.mjs OUT --arms   arm comparison only (arm-*/ against main/, paired by bot, class and seed)
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FK } from './lib/recorder.mjs';

const OUT = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'sim/out/pass-cliff';
const ARMS_ONLY = process.argv.includes('--arms');
const CLASSES = ['rogue', 'mage', 'hunter'];
const BOTS = ['onebutton', 'masher', 'greedy', 'planner'];
const KIND = Object.fromEntries(Object.entries(FK).map(([k, v]) => [v, k]));
const NEAR = 250; // per mille: near death = lowest HP below 25 % of max (TACTICIAN_SAFE_HP), a resurrect or rescue, or a death

function readCell(dir) {
  const recs = [];
  for (const c of CLASSES) {
    const f = join(dir, `runs-${c}.jsonl`);
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) if (line.trim()) recs.push(JSON.parse(line));
  }
  return recs;
}
function cells(sub) {
  const d = join(OUT, sub);
  if (!existsSync(d)) return {};
  const o = {};
  for (const n of readdirSync(d)) if (existsSync(join(d, n, 'summary.json'))) o[n] = readCell(join(d, n));
  return o;
}
const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(1)} %` : '-');
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function wilson(k, n) {
  if (!n) return '';
  const z = 1.96; const p = k / n; const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d; const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return ` (${(100 * Math.max(0, c - h)).toFixed(1)}-${(100 * Math.min(1, c + h)).toFixed(1)})`;
}

/** The fights of zone z of a record, with their lv entries: [{ i (index in zone, 1-based), kind, out, low, pl, el, em, lk, lp }]. */
function zoneFights(r, z) {
  const out = [];
  for (let i = 0; i < r.fx.length; i++) {
    const f = r.fx[i];
    if (f[4] !== z) continue;
    const l = r.lv ? r.lv[i] : null;
    out.push({ i: out.length + 1, kind: KIND[f[0]], out: f[2], low: f[2] === 0 ? 0 : f[5], pl: l ? l[0] : null, el: l ? l[1] : null, em: l ? l[2] / 10 : null, lk: l ? l[3] / 1000 : 0, lp: l ? l[4] / 1000 : 0 });
  }
  return out;
}
const done = (r, z) => (r.travelLv || []).length >= z; // left zone z (Road or Bell)
const entered = (r, z) => z === 1 || done(r, z - 1);
const near = (f) => f.out === 0 || f.low < NEAR;

/** Per-zone row of a cell. */
function zoneRow(recs, z) {
  const ent = recs.filter((r) => entered(r, z));
  const fin = ent.filter((r) => done(r, z));
  const fights = ent.flatMap((r) => zoneFights(r, z));
  const finF = fin.map((r) => zoneFights(r, z).length);
  const lvIn = (r) => (z === 1 ? 1 : r.travelLv[z - 2]);
  const gained = fin.map((r) => r.travelLv[z - 1] - lvIn(r));
  const died = ent.filter((r) => r.out === 'd' && r.death && r.death.z === z).length;
  const src = { fight: 0, quest: 0, contract: 0, dungeon: 0, other: 0 };
  for (const r of fin) {
    const x = (r.xz && r.xz[String(z)]) || {};
    for (const [k, v] of Object.entries(x)) {
      const key = k === 'kill' || k === 'wave' ? 'fight' : k === 'quest' || k === 'contract' || k === 'dungeon' ? k : 'other';
      src[key] += v / 1000;
    }
  }
  const tot = Object.values(src).reduce((a, b) => a + b, 0);
  return {
    n: ent.length, fin: fin.length, died,
    fightsMean: mean(finF), fightsMed: median(finF),
    lvIn: mean(ent.map(lvIn)), lvOut: median(fin.map((r) => r.travelLv[z - 1])), lvOutMean: mean(fin.map((r) => r.travelLv[z - 1])),
    gained: mean(gained), perFight: gained.reduce((a, b) => a + b, 0) / Math.max(1, finF.reduce((a, b) => a + b, 0)),
    src: Object.fromEntries(Object.entries(src).map(([k, v]) => [k, fin.length ? v / fin.length : 0])), srcTot: fin.length ? tot / fin.length : 0,
    lowMean: mean(fights.map((f) => f.low / 1000)), lowWon: mean(fights.filter((f) => f.out === 1).map((f) => f.low / 1000)),
    nearK: fights.filter(near).length, closeK: fights.filter((f) => f.out === 1 && f.low < 350).length, wonK: fights.filter((f) => f.out === 1).length,
    deathsK: fights.filter((f) => f.out === 0).length, fallK: fights.filter((f) => f.out !== 0 && f.low === 0).length, nf: fights.length,
    perKill: mean(fights.map((f) => f.lk)), perPay: mean(fights.map((f) => f.lp)),
    gap: mean(fights.filter((f) => f.pl !== null).map((f) => f.el - f.pl)),
  };
}

/**
 * Cliff row: the last 3 fights of zone 1 (every run, so a run that died in zone 1 counts its death fight) against the
 * first 3 of zone 2 (runs that entered zone 2).
 */
function cliffRow(recs) {
  const runs = recs.filter((r) => entered(r, 2));
  const last = recs.flatMap((r) => zoneFights(r, 1).slice(-3));
  const first = runs.flatMap((r) => zoneFights(r, 2).slice(0, 3));
  const runDie3 = runs.filter((r) => zoneFights(r, 2).slice(0, 3).some((f) => f.out === 0)).length;
  const runNear3 = runs.filter((r) => zoneFights(r, 2).slice(0, 3).some(near)).length;
  const runNearL3 = recs.filter((r) => zoneFights(r, 1).slice(-3).some(near)).length;
  const f1z2 = runs.map((r) => zoneFights(r, 2)[0]).filter(Boolean);
  const s = (fs) => ({ n: fs.length, d: fs.filter((f) => f.out === 0).length, near: fs.filter(near).length, low: mean(fs.map((f) => f.low / 1000)), gap: mean(fs.filter((f) => f.pl !== null).map((f) => f.el - f.pl)) });
  return {
    runs: runs.length, last: s(last), first: s(first), runDie3, runNear3, runNearL3,
    lvEntry: mean(runs.map((r) => r.travelLv[0])), lvEntryMed: median(runs.map((r) => r.travelLv[0])),
    gap1: mean(f1z2.map((f) => f.el - f.pl)), el1: mean(f1z2.map((f) => f.el)), em1: mean(f1z2.map((f) => f.em)),
    gapHist: hist(f1z2.map((f) => f.el - f.pl)),
  };
}
function hist(xs) {
  const h = {};
  for (const x of xs) { const k = x <= -1 ? '<=-1' : x >= 6 ? '>=6' : String(x); h[k] = (h[k] || 0) + 1; }
  return ['<=-1', '0', '1', '2', '3', '4', '5', '>=6'].map((k) => `${k}: ${pct(h[k] || 0, xs.length)}`).join(', ');
}

/** Deaths and near deaths per fight index in zone z (indices 1..maxI, then maxI+ pooled). */
function indexRows(recs, z, maxI = 8) {
  const ent = recs.filter((r) => entered(r, z));
  const by = {};
  for (const r of ent) for (const f of zoneFights(r, z)) {
    const k = f.i > maxI ? `${maxI + 1}+` : String(f.i);
    const b = by[k] || (by[k] = { n: 0, d: 0, near: 0, low: [] });
    b.n++; if (f.out === 0) b.d++; if (near(f)) b.near++; b.low.push(f.low / 1000);
  }
  return Object.entries(by).sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
}

function kindRows(recs, z) {
  const ent = recs.filter((r) => entered(r, z));
  const by = {};
  for (const r of ent) for (const f of zoneFights(r, z)) {
    const b = by[f.kind] || (by[f.kind] = { n: 0, d: 0, near: 0 });
    b.n++; if (f.out === 0) b.d++; if (near(f)) b.near++;
  }
  return by;
}

/** The B-rows that read zones 1-2 (balance.md 3; changes-m2b-v13.md B59): per cell, values; bands in the report text. */
function bRows(set, names) {
  L.push('#### B-rows read on zones 1-2', '');
  L.push('| Cell | B20 median level leaving Z1 / Z2 (band 9-11 / 19-21) | B21 runs dying in Z1-Z2 (<= 12 %, planner) | B24 close won fights (< 35 %) Z1 / Z2 / run (4-12 %, planner, run) | B38 mean lowest HP, won non-boss fights, Z1 / Z2 / Z3 / Z4 / Z5 / Z6 (Z2-Z5 spread <= 0.10) | B16 median rounds, won quest and grind fights, Z1 / Z2 (4-6) | B59 (d) Z1 elite, rare and dungeon-boss deaths per fight (>= 25 %, onebutton) |');
  L.push('|---|---|---|---|---|---|---|');
  for (const n of names) {
    const recs = set[n];
    const lvl = (z) => median(recs.filter((r) => done(r, z)).map((r) => r.travelLv[z - 1]));
    const d12 = recs.filter((r) => r.out === 'd' && r.death && r.death.z <= 2).length;
    const won = (z) => recs.flatMap((r) => r.fx.filter((f) => f[2] === 1 && f[0] !== FK.boss && (z === 0 || f[4] === z)));
    const close = (z) => { const w = won(z); return pct(w.filter((f) => f[5] < 350).length, w.length); };
    const tens = [1, 2, 3, 4, 5, 6].map((z) => mean(won(z).map((f) => f[5] / 1000)));
    const t25 = tens.slice(1, 5);
    const rounds = (z) => median(recs.flatMap((r) => r.fx.filter((f) => f[2] === 1 && f[4] === z && (f[0] === FK.quest || f[0] === FK.grind)).map((f) => f[1])));
    const sp = recs.flatMap((r) => r.fx.filter((f, i) => f[4] === 1 && (f[0] === FK.elite || f[0] === FK.dboss) ));
    L.push(`| ${n} | ${lvl(1)} / ${lvl(2)} | ${pct(d12, recs.length)}${wilson(d12, recs.length)} | ${close(1)} / ${close(2)} / ${close(0)} | ${tens.map(f2).join(' / ')} (spread ${f2(Math.max(...t25) - Math.min(...t25))}) | ${rounds(1)} / ${rounds(2)} | ${pct(sp.filter((f) => f[2] === 0).length, sp.length)} (${sp.length}) |`);
  }
  L.push('');
}

const L = [];
const main = cells('main');
const guided = cells('guided');
const order = (o) => Object.keys(o).sort((a, b) => BOTS.indexOf(a.split('-')[0]) - BOTS.indexOf(b.split('-')[0]));

function zoneTables(set, title) {
  const names = order(set);
  if (!names.length) return;
  L.push(`### ${title}`, '');
  for (const z of [1, 2]) {
    L.push(`#### Zone ${z}`, '');
    L.push('| Cell | runs entering / leaving | died in zone (of entering) | fights (mean / median, runs leaving) | level in / out (mean; median out) | levels per fight | levels per fight from the fight (kills) / its node payout | lowest HP per fight, mean (won fights) | near death per fight | close wins (< 35 %) of won | deaths per fight | falls survived (resurrect, rescue) | enemy level - player level, mean |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const n of names) {
      const x = zoneRow(set[n], z);
      L.push(`| ${n} | ${x.n} / ${x.fin} | ${pct(x.died, x.n)}${wilson(x.died, x.n)} | ${f1(x.fightsMean)} / ${x.fightsMed} | ${f1(x.lvIn)} / ${f1(x.lvOutMean)}; ${x.lvOut} | ${f2(x.perFight)} | ${f2(x.perKill)} / ${f2(x.perPay)} | ${pct(Math.round(x.lowMean * 1000), 1000)} (${pct(Math.round(x.lowWon * 1000), 1000)}) | ${pct(x.nearK, x.nf)} | ${pct(x.closeK, x.wonK)} | ${pct(x.deathsK, x.nf)}${wilson(x.deathsK, x.nf)} | ${pct(x.fallK, x.nf)} | ${f1(x.gap)} |`);
    }
    L.push('');
    L.push(`XP sources, zone ${z} (levels per run that left the zone; share of the zone's XP):`, '');
    L.push('| Cell | fights (kills, waves) | quest turn-ins | contract payouts | dungeon clears | other | total |');
    L.push('|---|---|---|---|---|---|---|');
    for (const n of names) {
      const x = zoneRow(set[n], z);
      const c = (k) => `${f2(x.src[k])} (${pct(Math.round((1000 * x.src[k]) / (x.srcTot || 1)), 1000)})`;
      L.push(`| ${n} | ${c('fight')} | ${c('quest')} | ${c('contract')} | ${c('dungeon')} | ${c('other')} | ${f2(x.srcTot)} |`);
    }
    L.push('');
  }
  L.push('#### The cliff: last 3 fights of zone 1 against the first 3 of zone 2 (runs that entered zone 2)', '');
  L.push('| Cell | runs entering Z2 | Z1 last 3 (all runs): deaths / near death per fight; lowest HP mean; enemy - player level | Z2 first 3: deaths / near death per fight; lowest HP mean; enemy - player level | runs dying in Z2 fights 1-3 | runs near death in Z2 fights 1-3 (in Z1 last 3, all runs) | level on entering Z2, mean (median) | first Z2 fight: highest enemy level (mean enemy level); gap to player |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const n of names) {
    const c = cliffRow(set[n]);
    const s = (x) => `${pct(x.d, x.n)} / ${pct(x.near, x.n)}; ${pct(Math.round(x.low * 1000), 1000)}; ${f1(x.gap)}`;
    L.push(`| ${n} | ${c.runs} | ${s(c.last)} | ${s(c.first)} | ${pct(c.runDie3, c.runs)}${wilson(c.runDie3, c.runs)} | ${pct(c.runNear3, c.runs)} (${pct(c.runNearL3, c.runs)}) | ${f1(c.lvEntry)} (${c.lvEntryMed}) | ${f1(c.el1)} (${f1(c.em1)}); +${f1(c.gap1)} |`);
  }
  L.push('');
  L.push('First zone 2 fight, highest enemy level minus player level (share of runs):', '');
  for (const n of names) L.push(`- ${n}: ${cliffRow(set[n]).gapHist}`);
  L.push('');
  L.push('#### The first fight of each zone (runs that entered the zone): level gap and enemy count', '');
  L.push('| Cell | zone | runs | level on entry, mean | gap (highest enemy - player), mean | deaths / near death per fight: first fight | the zone\'s later fights | first fight with 3+ enemies: share; deaths | first fight gap >= +3: share; deaths |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const n of names) for (const z of [1, 2, 3, 4, 5]) {
    const ent = set[n].filter((r) => entered(r, z));
    const fs = ent.map((r) => zoneFights(r, z)).filter((x) => x.length);
    const first = fs.map((x) => x[0]);
    const rest = fs.flatMap((x) => x.slice(1));
    const fx3 = fs.map((x, i) => [x[0], ent[i]]);
    const big = []; for (const r of ent) { const zf = zoneFights(r, z); if (!zf.length) continue; const j = r.fx.findIndex((f) => f[4] === z); if (r.fc[j][2].split(',').length >= 3) big.push(zf[0]); }
    const hi = first.filter((f) => f.el - f.pl >= 3);
    const lvIn = z === 1 ? 1 : mean(ent.map((r) => r.travelLv[z - 2]));
    void fx3;
    L.push(`| ${n} | ${z} | ${ent.length} | ${f1(lvIn)} | ${f2(mean(first.map((f) => f.el - f.pl)))} | ${pct(first.filter((f) => f.out === 0).length, first.length)} / ${pct(first.filter(near).length, first.length)} | ${pct(rest.filter((f) => f.out === 0).length, rest.length)} / ${pct(rest.filter(near).length, rest.length)} | ${pct(big.length, first.length)}; ${pct(big.filter((f) => f.out === 0).length, big.length)} | ${pct(hi.length, first.length)}; ${pct(hi.filter((f) => f.out === 0).length, hi.length)} |`);
  }
  L.push('');
  L.push('First zone 2 fight, deaths by level gap and by enemy count (deaths / fights):', '');
  for (const n of names) {
    const g = {}; const e = {};
    for (const r of set[n].filter((x) => entered(x, 2))) {
      const j = r.fx.findIndex((f) => f[4] === 2); if (j < 0) continue;
      const f = zoneFights(r, 2)[0]; const gk = Math.max(-1, Math.min(5, f.el - f.pl)); const ek = Math.min(3, r.fc[j][2].split(',').length);
      (g[gk] = g[gk] || [0, 0])[1]++; (e[ek] = e[ek] || [0, 0])[1]++; if (f.out === 0) { g[gk][0]++; e[ek][0]++; }
    }
    L.push(`- ${n}: gap ${Object.entries(g).sort((a, b) => a[0] - b[0]).map(([k, [d, m]]) => `${k <= -1 ? '<=-1' : k >= 5 ? '>=+5' : (k > 0 ? '+' : '') + k} ${pct(d, m)} (${m})`).join(', ')}; enemies ${Object.entries(e).map(([k, [d, m]]) => `${k === '3' ? '3+' : k} ${pct(d, m)} (${m})`).join(', ')}`);
  }
  L.push('');
  L.push('#### Deaths per fight index (deaths / fights at that index; near death share)', '');
  for (const z of [1, 2]) {
    L.push(`Zone ${z}:`, '');
    const rows = names.map((n) => [n, indexRows(set[n], z)]);
    const idx = [...new Set(rows.flatMap(([, r]) => r.map(([k]) => k)))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    L.push(`| Cell | ${idx.join(' | ')} |`);
    L.push(`|---|${idx.map(() => '---').join('|')}|`);
    for (const [n, r] of rows) {
      const m = Object.fromEntries(r);
      L.push(`| ${n} | ${idx.map((k) => (m[k] ? `${pct(m[k].d, m[k].n)} / ${pct(m[k].near, m[k].n)} (n ${m[k].n})` : '-')).join(' | ')} |`);
    }
    L.push('');
  }
  for (const z of [1, 2]) {
    L.push(`#### Zone ${z} by fight kind (deaths / near death per fight; fights)`, '');
    for (const n of names) {
      const k = kindRows(set[n], z);
      L.push(`- ${n}: ${Object.entries(k).sort((a, b) => b[1].n - a[1].n).map(([kind, b]) => `${kind} ${pct(b.d, b.n)} / ${pct(b.near, b.n)} (${b.n})`).join('; ')}`);
    }
    L.push('');
  }
  bRows(set, names);
}

/** Arms (scratch engine copies) against the build, paired by bot, class and seed (main/ or guided/ as the base). */
function armTables() {
  const arms = readdirSync(OUT).filter((d) => d.startsWith('arm-')).sort();
  if (!arms.length) return;
  const byCell = {};
  for (const arm of arms) for (const [n, recs] of Object.entries(cells(arm))) (byCell[n] = byCell[n] || []).push([arm.slice(4).replace(/-guided$/, ''), recs]);
  L.push('### Tuning arms against the engine as built (paired: the same bot, class and seeds)', '');
  L.push('| Cell | Arm | runs | Z1 fights (mean) | level leaving Z1 (median; mean) | Z1 lowest HP per fight, mean | Z1 near death per fight | Z1 fights with 3+ enemies | died in Z1 (of runs) | Z2 first 3: deaths / near death per fight | runs dying in Z2 fights 1-3 | first Z2 fight gap | died in Z2 (of entering) | B21 died in Z1-Z2 (of runs) | level leaving Z2 (median) | reach the boss | win |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (n, arm, recs) => {
    const z1 = zoneRow(recs, 1); const z2 = zoneRow(recs, 2); const c = cliffRow(recs);
    const d12 = recs.filter((r) => r.out === 'd' && r.death && r.death.z <= 2).length;
    const rb = recs.filter((r) => r.rb).length; const w = recs.filter((r) => r.out === 'v').length;
    let k3 = 0; let nf = 0;
    for (const r of recs) for (let i = 0; i < r.fx.length; i++) if (r.fx[i][4] === 1) { nf++; if (r.fc[i][2].split(',').length >= 3) k3++; }
    L.push(`| ${n} | ${arm} | ${recs.length} | ${f1(z1.fightsMean)} | ${z1.lvOut}; ${f1(z1.lvOutMean)} | ${pct(Math.round(z1.lowMean * 1000), 1000)} | ${pct(z1.nearK, z1.nf)} | ${pct(k3, nf)} | ${pct(z1.died, z1.n)}${wilson(z1.died, z1.n)} | ${pct(c.first.d, c.first.n)} / ${pct(c.first.near, c.first.n)} | ${pct(c.runDie3, c.runs)} | +${f1(c.gap1)} | ${pct(z2.died, z2.n)} | ${pct(d12, recs.length)}${wilson(d12, recs.length)} | ${z2.lvOut} | ${pct(rb, recs.length)} | ${pct(w, recs.length)} |`);
  };
  const names = Object.keys(byCell).sort((a, b) => (a.includes('guided') - b.includes('guided')) || BOTS.indexOf(a.split('-')[0]) - BOTS.indexOf(b.split('-')[0]));
  for (const n of names) {
    const list = byCell[n];
    const seeds = new Set(list[0][1].map((r) => `${r.cls}:${r.seed}`));
    const base = (main[n] || guided[n] || []).filter((r) => seeds.has(`${r.cls}:${r.seed}`));
    if (base.length) row(n, 'as built', base);
    for (const [arm, recs] of list) row(n, arm, recs);
  }
  L.push('');
  // Paired differences against the build (same class and seed): win, reach, death in zones 1-2.
  L.push('Paired differences, arm minus build (same class and seed; normal interval of the paired difference):', '');
  L.push('| Cell | Arm | n | win | reach the boss | died in Z1-Z2 |');
  L.push('|---|---|---|---|---|---|');
  for (const n of names) {
    const baseAll = main[n] || guided[n] || [];
    const bm = new Map(baseAll.map((r) => [`${r.cls}:${r.seed}`, r]));
    for (const [arm, recs] of byCell[n]) {
      const pairs = recs.map((r) => [r, bm.get(`${r.cls}:${r.seed}`)]).filter(([, b]) => b);
      const d = (f) => { const xs = pairs.map(([a, b]) => f(a) - f(b)); const m = mean(xs); const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); const h = (1.96 * sd) / Math.sqrt(xs.length); return `${m >= 0 ? '+' : ''}${(100 * m).toFixed(1)} pp (${(100 * (m - h)).toFixed(1)} - ${(100 * (m + h)).toFixed(1)})`; };
      L.push(`| ${n} | ${arm} | ${pairs.length} | ${d((r) => (r.out === 'v' ? 1 : 0))} | ${d((r) => r.rb)} | ${d((r) => (r.out === 'd' && r.death && r.death.z <= 2 ? 1 : 0))} |`);
    }
  }
  L.push('');
}

if (!ARMS_ONLY) {
  zoneTables(main, 'Main cells: P0, expedition map with the start camp (--map expedition --prep)');
  zoneTables(guided, 'Guided first run (--guided: zone 1 on TUTORIAL_SEED with the overlay)');
}
armTables();
console.log(L.join('\n'));
