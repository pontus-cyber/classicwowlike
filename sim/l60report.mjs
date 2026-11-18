#!/usr/bin/env node
// Tables of the level-60 oruvathLegacy measure (sim/measure-l60.sh; report docs/reports/legacy-l60-2026-11-18.md):
// B1 (planner P0), B6 (planner P0 and PALL), B21 (planner P0), B26-B28 (PALL variants against the PALL planner on the
// same seeds), B29 (planner P0; PALL reported), one-button P0 win and reach, for the off/ and on/ arms, with the paired
// on - off difference (same classes and seeds).
//
//   node sim/l60report.mjs <OUT>        (OUT: the measure's directory, holding off/ and on/)
import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { BAL } from './lib/params.mjs';
import { cellMetrics } from './lib/metrics.mjs';
import { pairedDiff } from './lib/combatchecks.mjs';
import { pct, num, ci, table } from './lib/output.mjs';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node sim/l60report.mjs <OUT>');
const CLASSES = ['rogue', 'mage', 'hunter'];
const ARM = { off: '', on: '-or2' };

function load(arm, base, cls = null) {
  const dir = join(OUT, arm, `${base}${ARM[arm]}`);
  if (!existsSync(dir)) return null;
  const recs = [];
  for (const c of cls ? [cls] : CLASSES) {
    const f = join(dir, `runs-${c}.jsonl`);
    if (!existsSync(f)) return null;
    for (const l of readFileSync(f, 'utf8').split('\n')) if (l) recs.push({ cls: c, ...JSON.parse(l) });
  }
  return recs;
}
const M = (arm, base, cls) => { const r = load(arm, base, cls); return r ? cellMetrics(r) : null; };
const inBand = (x, [a, b]) => x !== null && x >= a && x <= b;
const PF = (ok) => (ok === null ? '' : ok ? 'pass' : '**FAIL**');
const rc = (r) => (r && r.n ? `${pct(r.p)} (${r.k}/${r.n})` : 'n/a');
const win = (r) => (r.out === 'v' ? 1 : 0);
const reach = (r) => (r.rb ? 1 : 0);
const diff = (base, f = win) => {
  const a = load('on', base); const b = load('off', base);
  if (!a || !b) return 'n/a';
  const d = pairedDiff(a, b, f);
  return d.v === null ? 'n/a' : `${d.v >= 0 ? '+' : ''}${num(d.v * 100, 1)} pp (${num(d.ci[0] * 100, 1)} - ${num(d.ci[1] * 100, 1)})`;
};

const rows = [];
const add = (id, metric, target, f, d = '') => {
  const v = {};
  for (const arm of ['off', 'on']) v[arm] = f(arm);
  rows.push([id, metric, v.off ? `${v.off.text} ${PF(v.off.ok)}` : 'n/a', v.on ? `${v.on.text} ${PF(v.on.ok)}` : 'n/a', d, target]);
};
const P0 = 'planner-P0-exp-prep';
const PALL = 'planner-PALL-exp-prep';
add('B1', 'Planner P0 win (pooled)', `${pct(BAL.WR_P0_PLANNER[0], 0)} - ${pct(BAL.WR_P0_PLANNER[1], 0)}`, (arm) => {
  const m = M(arm, P0); return m && { text: `${rc(m.win)}; ${ci(m.win.ci)}`, ok: inBand(m.win.p, BAL.WR_P0_PLANNER) };
}, diff(P0));
for (const [prof, base] of [['P0', P0], ['PALL', PALL]]) {
  add('B6', `Class band, planner ${prof}: R / M / H win, spread (max deviation)`, `each within ${pct(BAL.CLASS_BAND_PP, 0)}, spread <= ${pct(BAL.CLASS_SPREAD_MAX_PP, 0)}`, (arm) => {
    const ms = CLASSES.map((c) => M(arm, base, c));
    if (ms.some((m) => !m)) return null;
    const w = ms.map((m) => m.win.p);
    const mean = w.reduce((a, b) => a + b, 0) / 3;
    const dev = Math.max(...w.map((x) => Math.abs(x - mean)));
    const spread = Math.max(...w) - Math.min(...w);
    return { text: `${w.map((x) => num(x * 100, 1)).join(' / ')}; ${num(spread * 100, 1)} pp (${num(dev * 100, 1)})`, ok: dev <= BAL.CLASS_BAND_PP && spread <= BAL.CLASS_SPREAD_MAX_PP };
  }, CLASSES.map((c) => { const a = load('on', base, c); const b = load('off', base, c); const d = a && b ? pairedDiff(a, b, win) : null; return d && d.v !== null ? `${d.v >= 0 ? '+' : ''}${num(d.v * 100, 1)}` : 'n/a'; }).join(' / ') + ' pp');
}
add('B3 (ref)', 'Planner PALL win (pooled)', 'reported', (arm) => { const m = M(arm, PALL); return m && { text: `${rc(m.win)}; ${ci(m.win.ci)}`, ok: null }; }, diff(PALL));
const st = [['early', 'Z1-Z2 (share of runs)', (p) => p <= BAL.DEATH_EARLY_MAX, `<= ${pct(BAL.DEATH_EARLY_MAX, 0)}`], ['mid', 'Z3-Z4 (share of runs)', (p) => inBand(p, BAL.DEATH_MID), `${pct(BAL.DEATH_MID[0], 0)} - ${pct(BAL.DEATH_MID[1], 0)}`], ['late', 'Z5-Z6 and Camp (share of runs)', (p) => inBand(p, BAL.DEATH_LATE), `${pct(BAL.DEATH_LATE[0], 0)} - ${pct(BAL.DEATH_LATE[1], 0)}`]];
for (const [k, label, okf, target] of st) add('B21', `Planner P0 deaths ${label}`, target, (arm) => { const m = M(arm, P0); return m && { text: rc(m.deathStageRuns[k]), ok: okf(m.deathStageRuns[k].p) }; });
add('B21', 'Planner P0 deaths at the end boss (share of deaths)', `${pct(BAL.DEATH_BOSS[0], 0)} - ${pct(BAL.DEATH_BOSS[1], 0)}`, (arm) => { const m = M(arm, P0); return m && { text: rc(m.deathStage.boss), ok: inBand(m.deathStage.boss.p, BAL.DEATH_BOSS) }; });
for (const [id, v, label] of [['B26', 'noInterrupt', 'interrupt off the bar'], ['B27', 'noCleanse', 'cleanse off the bar, no Tonic'], ['B28', 'noAoe', 'AoE off the bar']]) {
  const vb = `planner-PALL-${v}-exp-prep`;
  add(id, `Planner PALL, ${label}: win vs PALL (same seeds), ratio`, `<= ${BAL.MECH_RATIO_MAX}`, (arm) => {
    const x = M(arm, vb); const b = M(arm, PALL);
    if (!x || !b) return null;
    const ratio = b.win.p > 0 ? x.win.p / b.win.p : null;
    return { text: `${pct(x.win.p)} vs ${pct(b.win.p)}; ${num(ratio, 2)}`, ok: ratio === null ? null : ratio <= BAL.MECH_RATIO_MAX };
  }, diff(vb));
}
for (const [prof, base] of [['P0', P0], ['PALL (ref)', PALL]]) {
  add('B29', `Boss losses to Final Dark, planner ${prof}`, `${pct(BAL.ENRAGE_LOSS[0], 0)} - ${pct(BAL.ENRAGE_LOSS[1], 0)}`, (arm) => { const m = M(arm, base); return m && { text: rc(m.finalDarkLoss), ok: inBand(m.finalDarkLoss.p, BAL.ENRAGE_LOSS) }; });
}
const OB = 'onebutton-P0-exp-prep';
add('one-button', 'Onebutton P0 win (pooled); reach the boss', 'reported (owner O13: a one-button run almost never wins)', (arm) => { const m = M(arm, OB); return m && { text: `${rc(m.win)}; reach ${pct(m.boss.p)}`, ok: null }; }, diff(OB));

console.log(table(['ID', 'Metric', 'oruvathLegacy off', 'oruvathLegacy on', 'on - off (paired, 95 %)', 'Target'], rows));

// Supporting: per class win, reach, boss fights won, for each cell.
const sup = [];
for (const base of [P0, PALL, 'planner-PALL-noInterrupt-exp-prep', 'planner-PALL-noCleanse-exp-prep', 'planner-PALL-noAoe-exp-prep', OB]) {
  for (const arm of ['off', 'on']) {
    const ms = CLASSES.map((c) => M(arm, base, c));
    if (ms.some((m) => !m)) continue;
    sup.push([base, arm, ms.map((m) => num(m.win.p * 100, 1)).join(' / '), ms.map((m) => num(m.boss.p * 100, 1)).join(' / '), ms.map((m) => num(m.bossWin.p * 100, 1)).join(' / '), ms.map((m) => num(m.finalDarkLoss.p * 100, 1)).join(' / ')]);
  }
}
console.log('');
console.log(table(['Cell', 'Arm', 'Win R / M / H %', 'Reach R / M / H %', 'Boss fights won R / M / H %', 'Final Dark share of boss losses R / M / H %'], sup));

// Attribution arms (sim/l60-arms.sh): OUT/arm-<name>/<cell>-or2, the on arm with one piece taken back. Per class win
// against on/ and off/ on the same seeds (the classes the arm ran).
const arms = existsSync(OUT) ? readdirSync(OUT).filter((d) => d.startsWith('arm-')).sort() : [];
if (arms.length) {
  const ar = [];
  for (const a of arms) {
    for (const base of [P0, PALL, 'planner-PALL-noInterrupt-exp-prep', 'planner-PALL-noCleanse-exp-prep', 'planner-PALL-noAoe-exp-prep', OB]) {
      const dir = join(OUT, a, `${base}-or2`);
      if (!existsSync(dir)) continue;
      for (const c of CLASSES) {
        const f = join(dir, `runs-${c}.jsonl`);
        if (!existsSync(f)) continue;
        const x = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => ({ cls: c, ...JSON.parse(l) }));
        const m = cellMetrics(x);
        const on = load('on', base, c); const off = load('off', base, c);
        const dOn = on ? pairedDiff(x, on, win) : null; const dOff = off ? pairedDiff(x, off, win) : null;
        const f1 = (d) => (d && d.v !== null ? `${d.v >= 0 ? '+' : ''}${num(d.v * 100, 1)} (${num(d.ci[0] * 100, 1)} - ${num(d.ci[1] * 100, 1)}; n ${d.n})` : 'n/a');
        ar.push([a.slice(4), base, c, `${pct(m.win.p)} (${m.win.k}/${m.win.n})`, pct(m.bossWin.p), pct(m.finalDarkLoss.p), f1(dOn), f1(dOff)]);
      }
    }
  }
  console.log('');
  console.log(table(['Arm (taken back)', 'Cell', 'Class', 'Win', 'Boss fights won', 'Final Dark share of boss losses', 'Win - on (pp, paired)', 'Win - off (pp, paired)'], ar));
}
