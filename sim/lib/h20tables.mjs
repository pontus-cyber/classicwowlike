// Tables of sim/legacy-h20deaths.mjs (markdown). Input: directories with <bot>-<class>.jsonl; every table is per directory.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const CLASSES = ['rogue', 'mage', 'hunter'];
const pc = (a, b) => (b ? `${(100 * a / b).toFixed(1)} %` : 'n/a');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : 'n/a');
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

export function load(dir) {
  const out = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
    const [bot, cls] = f.replace('.jsonl', '').split('-');
    out[cls] = readFileSync(join(dir, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    out.bot = bot;
  }
  return out;
}

const zoneBand = (z) => (z <= 1 ? 'Z1' : z <= 4 ? 'Z2-4' : z <= 6 ? 'Z5-6' : 'Camp/boss');
const gapBin = (g) => (g <= 0 ? '<= 0' : g <= 2 ? '1-2' : g <= 4 ? '3-4' : '5+');
const drBin = (d) => (d === 0 ? '0' : d <= 2 ? '1-2' : d <= 4 ? '3-4' : '5+');
const ilBin = (x, base) => { const d = x - base; return d < -6 ? '< -6' : d < -3 ? '-6..-3' : d < 0 ? '-3..0' : '>= 0'; };

/** Tables for one directory. */
export function dirTables(dir) {
  const D = load(dir);
  const bot = D.bot;
  const lines = [`### ${bot} (${basename(dir)})`, ''];
  // 1 headline
  const head = [];
  for (const c of CLASSES) {
    const R = D[c]; if (!R) continue;
    const n = R.length;
    const dz = (lo, hi) => R.filter((r) => r.death && r.death.nodeType !== 'boss' && r.death.nodeType !== 'camp' && r.death.zone >= lo && r.death.zone <= hi).length;
    const boss = R.filter((r) => r.death && (r.death.nodeType === 'boss' || r.death.nodeType === 'camp')).length;
    const win = R.filter((r) => !r.death).length;
    head.push([c, n, pc(win, n), pc(dz(1, 1), n), pc(dz(2, 4), n), pc(dz(5, 6), n), pc(boss, n), f1(mean(R.map((r) => r.endPower - r.startPower))), f1(mean(R.map((r) => r.startGear)))]);
  }
  lines.push('Outcome per run (deaths by where they happen):', '', table(['class', 'runs', 'win', 'die Z1', 'die Z2-4', 'die Z5-6', 'die Camp/boss', 'power levels gained', 'kit ilvl at start'], head), '');
  // 2 zone 2-4 deaths: zone, node type, ring
  const all = CLASSES.flatMap((c) => (D[c] || []).map((r) => ({ ...r, c })));
  const dz = all.filter((r) => r.death && r.death.zone >= 2 && r.death.zone <= 4 && r.death.nodeType !== 'boss');
  lines.push(`Deaths in zones 2-4: ${dz.length} of ${all.length} runs.`, '');
  const zrows = [];
  for (const c of CLASSES) { const x = dz.filter((r) => r.c === c); zrows.push([c, ...[2, 3, 4].map((z) => x.filter((r) => r.death.zone === z).length), x.length]); }
  lines.push(table(['class', 'zone 2', 'zone 3', 'zone 4', 'total'], zrows), '');
  const types = [...new Set(dz.map((r) => r.death.nodeType))].sort();
  lines.push(table(['node type', ...CLASSES, 'total', 'ring 1 / 2 / 3'], types.map((t) => [t, ...CLASSES.map((c) => dz.filter((r) => r.c === c && r.death.nodeType === t).length), dz.filter((r) => r.death.nodeType === t).length, [1, 2, 3].map((k) => dz.filter((r) => r.death.nodeType === t && r.death.ring === k).length).join(' / ')])), '');
  // 3 hazard by node type in zones 2-4: fights and deaths
  const F = all.flatMap((r) => r.fights.map((f) => ({ ...f, c: r.c })));
  const F24 = F.filter((f) => f.z >= 2 && f.z <= 4 && f.nt !== 'boss' && f.nt !== 'camp');
  const nts = [...new Set(F24.map((f) => f.nt))].sort();
  lines.push('Fights in zones 2-4 by node type (fights, deaths, death rate per fight; mean lowest HP % of won fights):', '',
    table(['node type', 'fights', 'deaths', 'rate', 'min HP won', 'mean enemy-over-hero gap', 'draughts at start'], nts.map((t) => {
      const x = F24.filter((f) => f.nt === t); const d = x.filter((f) => f.out === 'death'); const w = x.filter((f) => f.out === 'win');
      return [t, x.length, d.length, pc(d.length, x.length), f1(mean(w.map((f) => f.minHp))), f1(mean(x.map((f) => f.maxL - f.P))), f1(mean(x.map((f) => f.dr0)))];
    })), '');
  // 4 power gap
  const gaps = ['<= 0', '1-2', '3-4', '5+'];
  lines.push('Power gap (highest enemy level minus hero power level) in zones 2-4 non-boss fights:', '',
    table(['gap', 'fights', 'deaths', 'rate', 'share of deaths'], gaps.map((g) => { const x = F24.filter((f) => gapBin(f.maxL - f.P) === g); const d = x.filter((f) => f.out === 'death'); return [g, x.length, d.length, pc(d.length, x.length), pc(d.length, F24.filter((f) => f.out === 'death').length)]; })), '');
  // 5 draughts at fight start
  const drs = ['0', '1-2', '3-4', '5+'];
  lines.push('Healing draughts in the bag at the start of the fight (zones 2-4, non-boss):', '',
    table(['draughts', 'fights', 'deaths', 'rate'], drs.map((g) => { const x = F24.filter((f) => drBin(f.dr0) === g); const d = x.filter((f) => f.out === 'death'); return [g, x.length, d.length, pc(d.length, x.length)]; })), '');
  const dd = F24.filter((f) => f.out === 'death');
  lines.push(`Fatal fights: mean draughts at start ${f1(mean(dd.map((f) => f.dr0)))} (all fights ${f1(mean(F24.map((f) => f.dr0)))}), mean HP at start ${f1(mean(dd.map((f) => f.hp0)))} % (all ${f1(mean(F24.map((f) => f.hp0)))} %), mean gear ilvl ${f1(mean(dd.map((f) => f.il)))} (all ${f1(mean(F24.map((f) => f.il)))}), mean gap ${f1(mean(dd.map((f) => f.maxL - f.P)))} (all ${f1(mean(F24.map((f) => f.maxL - f.P)))}), mean enemies ${f1(mean(dd.map((f) => f.en.length)))} (all ${f1(mean(F24.map((f) => f.en.length)))}).`, '');
  // 6 gear item level vs hero power (ilvl - P)
  const ilb = ['< -6', '-6..-3', '-3..0', '>= 0'];
  lines.push('Mean equipped item level minus hero power level at the fight start (zones 2-4, non-boss):', '',
    table(['ilvl - power', 'fights', 'deaths', 'rate'], ilb.map((g) => { const x = F24.filter((f) => ilBin(f.il, f.P) === g); const d = x.filter((f) => f.out === 'death'); return [g, x.length, d.length, pc(d.length, x.length)]; })), '');
  // 7 enemies
  const cnt = {};
  for (const f of dd) for (const e of f.en) { const k = `${e.n} (z${f.z}, ${e.a}, ${e.k})`; cnt[k] = (cnt[k] || 0) + 1; }
  const killers = {};
  for (const r of dz) { const k = `${r.death.killer.name}${r.death.killer.ability ? ' / ' + r.death.killer.ability : ''}`; killers[k] = (killers[k] || 0) + 1; }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  lines.push('Killer (name / ability) of the zone 2-4 deaths:', '', table(['killer', 'deaths'], top(killers, 8)), '');
  // archetype mix of fatal fights vs all
  const arch = (fs) => { const o = {}; let n = 0; for (const f of fs) for (const e of f.en) { o[e.a] = (o[e.a] || 0) + 1; n++; } return [o, n]; };
  const [ad, nd] = arch(dd); const [aa, na] = arch(F24);
  lines.push('Enemy archetype share, fatal fights against all zone 2-4 fights:', '', table(['archetype', 'fatal fights', 'all fights'], Object.keys(aa).sort().map((k) => [k, pc(ad[k] || 0, nd), pc(aa[k], na)])), '');
  // 8 hp and level at zone arrival
  const zr = all.flatMap((r) => r.zones.map((z) => ({ ...z, c: r.c })));
  lines.push('Zone arrival (mean over runs that arrive): hero power, gear ilvl, draughts, HP %:', '', table(['zone', 'arrivals', 'power', 'gear ilvl', 'draughts', 'HP %'], [1, 2, 3, 4, 5, 6].map((z) => { const x = zr.filter((q) => q.z === z); return [z, x.length, f1(mean(x.map((q) => q.p))), f1(mean(x.map((q) => q.ilvl))), f1(mean(x.map((q) => q.dr))), f1(mean(x.map((q) => q.hp)))]; })), '');
  return lines.join('\n');
}

export function tables(dirs) { return dirs.map(dirTables).join('\n\n'); }

/** One row a directory: deaths in zones 1-6, zones 2-4, and wins by class (labels from the directory names). */
export function armsTable(dirs) {
  const rows = dirs.map((d) => {
    const D = load(d);
    const cells = [basename(d)];
    let z24 = 0; let z16 = 0; let n = 0;
    for (const c of CLASSES) {
      const R = D[c] || [];
      const zn = (lo, hi) => R.filter((r) => r.death && r.death.nodeType !== 'boss' && r.death.nodeType !== 'camp' && r.death.zone >= lo && r.death.zone <= hi).length;
      const w = R.filter((r) => !r.death).length;
      z24 += zn(2, 4); z16 += zn(1, 6); n += R.length;
      cells.push(`${pc(zn(2, 4), R.length)} / ${pc(zn(1, 6), R.length)} / ${pc(w, R.length)}`);
    }
    cells.push(`${pc(z24, n)} / ${pc(z16, n)}`);
    return cells;
  });
  return table(['arm', 'rogue Z2-4 / Z1-6 / win', 'mage', 'hunter', 'all classes Z2-4 / Z1-6'], rows);
}
