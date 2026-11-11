#!/usr/bin/env node
// Mash report tables (owner feedback docs/feedback/2026-11-11-1841-owner.md and follow-up 18:46; report
// docs/reports/mash-2026-11-11.md): one-button play against autoplay (planner), the planned opening (opener) and the
// masher, by run, zone, fight kind and enemy archetype, and the think fights of the paired replays (sim/lib/replay.mjs
// replayThink: the same fight, character and fight stream played by onebutton, the opener's opening then autoplay, and
// autoplay). Reads the cells of sim/measure-mash.sh; prints Markdown.
//
//   node sim/mashreport.mjs --in sim/out/mash [--gap 0.20] [--blocks classic-P0,classic-PALL,exp-P0,exp-PALL] > tables.md
//
// Think fight [assumption, report "Readings"]: onebutton dies (or needs a resurrect) where the opener's line survives
// without one, or both survive and onebutton ends the fight at least --gap (share of max HP, SIM.THINK_HP_GAP) lower.
// Fight kind groups: a fight with a rare enemy is 'rare' whatever its node; else the recorder's fight kind.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { C, CONTENT } from './lib/engine.mjs';
import { SIM } from './lib/params.mjs';
import { readJsonl } from './lib/output.mjs';
import { FIGHT_KINDS } from './lib/recorder.mjs';
import { wilson } from './lib/stats.mjs';

const CLASSES = ['rogue', 'mage', 'hunter'];
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const IN = args.in || 'sim/out/mash';
const GAP = Number(args.gap || SIM.THINK_HP_GAP);

export const GROUPS = ['quest', 'grind', 'elite', 'rare', 'trash', 'dboss', 'dim', 'treasure', 'camp', 'boss'];
export const GROUP_LABEL = { quest: 'normal (quest)', grind: 'grind wave', elite: 'elite', rare: 'rare', trash: 'dungeon trash', dboss: 'dungeon boss', dim: 'Dimmed', treasure: 'treasure guard', camp: 'Camp wave', boss: 'end boss' };
const SPECIAL = new Set(['elite', 'rare', 'dboss', 'dim']);
const ARCH = ['brute', 'caster', 'skulker', 'beast', 'guardian', 'mender'];

/** Fight kind group of fight i of a record (fc composition: any rare enemy makes it 'rare'). */
export function groupOf(r, i) {
  const k = FIGHT_KINDS[r.fx[i][0]];
  const comp = r.fc && r.fc[i] ? r.fc[i][2] : '';
  return comp && /:r(,|$)/.test(comp) ? 'rare' : k;
}
/** Template ids of fight i (fc composition). */
export const tidsOf = (r, i) => (r.fc && r.fc[i] && r.fc[i][2] ? r.fc[i][2].split(',').map((x) => x.split(':')[0]) : []);
const archOf = (tid) => (CONTENT.enemies[tid] ? CONTENT.enemies[tid].archetype : null);

function load(dir) {
  const out = {};
  for (const c of CLASSES) { const f = join(dir, `runs-${c}.jsonl`); if (existsSync(f)) out[c] = readJsonl(f).filter((r) => !r.err); }
  return Object.keys(out).length ? out : null;
}
const flat = (byCls) => Object.values(byCls).flat();
const pc = (x, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)} %` : 'n/a');
const ci = (k, n) => { if (!n) return 'n/a'; const [lo, hi] = wilson(k, n); return `${(100 * k / n).toFixed(1)} % (${(lo * 100).toFixed(1)}-${(hi * 100).toFixed(1)})`; };
const f1 = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs) => { if (!xs.length) return NaN; const s = xs.slice().sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };
const q = (xs, p) => { if (!xs.length) return NaN; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

// ---------------- Run level ----------------
function runRow(name, byCls) {
  const all = flat(byCls);
  const reach = (rs) => rs.filter((r) => r.rb).length;
  const win = (rs) => rs.filter((r) => r.out === 'v').length;
  let nb = 0; let nbd = 0; const rounds = [];
  for (const r of all) for (const f of r.fx) if (FIGHT_KINDS[f[0]] !== 'boss') { nb++; if (f[2] === 0) nbd++; rounds.push(f[1]); }
  const per = CLASSES.map((c) => (byCls[c] ? `${pc(reach(byCls[c]) / byCls[c].length, 0)} / ${pc(win(byCls[c]) / byCls[c].length, 0)}` : 'n/a')).join(' | ');
  const wgr = reach(all) ? win(all) / reach(all) : NaN;
  return `| ${name} | ${all.length / Object.keys(byCls).length} | ${per} | ${ci(reach(all), all.length)} | ${ci(win(all), all.length)} | ${pc(wgr)} | ${f1((1000 * nbd) / nb, 2)} | ${f1(mean(rounds))} |`;
}

/** Paired difference a - b of a per-run 0/1 metric on the seeds both cells ran (per class), with a normal 95 % interval. */
function paired(a, b, f) {
  const d = [];
  for (const c of CLASSES) {
    if (!a[c] || !b[c]) continue;
    const m = new Map(b[c].map((r) => [r.seed, r]));
    for (const r of a[c]) if (m.has(r.seed)) d.push(f(r) - f(m.get(r.seed)));
  }
  const n = d.length; const mu = mean(d); const sd = Math.sqrt(d.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, n - 1));
  return n ? `${mu >= 0 ? '+' : ''}${(mu * 100).toFixed(1)} pp (${((mu - 1.96 * sd / Math.sqrt(n)) * 100).toFixed(1)} - ${((mu + 1.96 * sd / Math.sqrt(n)) * 100).toFixed(1)}; n=${n})` : 'n/a';
}

function deathZones(byCls) {
  const all = flat(byCls);
  const z = {};
  for (const r of all) {
    let k = 'won';
    if (r.out !== 'v') {
      const last = r.fx.length ? r.fx[r.fx.length - 1] : null;
      if (!last || last[2] !== 0) k = 'other';
      else if (FIGHT_KINDS[last[0]] === 'boss') k = 'end boss';
      else if (last[4] > C.ZONE_COUNT) k = 'Camp';
      else k = `Z${last[4]}`;
    }
    z[k] = (z[k] || 0) + 1;
  }
  return { z, n: all.length };
}

// ---------------- Fight kinds (full runs) ----------------
function kindStats(byCls) {
  const s = {};
  for (const r of flat(byCls)) {
    for (let i = 0; i < r.fx.length; i++) {
      const f = r.fx[i];
      const g = groupOf(r, i);
      const x = s[g] || (s[g] = { n: 0, d: 0, lost: [], rounds: [], pot: 0, wuA: 0, wuL: 0, wuK: 0 });
      x.n++;
      if (f[2] === 0) x.d++;
      if (f[2] === 1 && r.fc && r.fc[i]) x.lost.push(r.fc[i][0] - f[3]);
      x.rounds.push(f[1]);
      x.pot += f[6] || 0;
      const v2 = r.f2 && r.f2[i];
      if (v2) { x.wuA += v2[10] || 0; x.wuL += v2[11] || 0; x.wuK += v2[12] || 0; }
    }
  }
  return s;
}

function archStats(byCls) {
  const s = {};
  for (const r of flat(byCls)) {
    for (let i = 0; i < r.fx.length; i++) {
      const f = r.fx[i];
      if (FIGHT_KINDS[f[0]] === 'boss') continue;
      for (const a of new Set(tidsOf(r, i).map(archOf).filter(Boolean))) {
        const x = s[a] || (s[a] = { n: 0, d: 0, lost: [] });
        x.n++;
        if (f[2] === 0) x.d++;
        if (f[2] === 1 && r.fc && r.fc[i]) x.lost.push(r.fc[i][0] - f[3]);
      }
    }
  }
  return s;
}

// ---------------- Think fights (paired replays) ----------------
/**
 * One think entry -> { g, z, node, hp0, own, op, au, ma } with { died, hp (end, share), lost (share of max HP), pot };
 * ma (the masher's rotation replay of the same fight) from the rotation cell's `tm` of the same run (rot: byCls of
 * records with tm; same seeds, table and code, so the fights are the same; checked on the start HP and own outcome).
 */
function thinkRows(byCls, rot = null) {
  const rows = [];
  let mismatch = 0;
  for (const [cls, rs] of Object.entries(byCls)) {
    const rotBySeed = rot && rot[cls] ? new Map(rot[cls].map((r) => [r.seed, r])) : null;
    for (const r of rs) {
      if (!r.tk) continue;
      const rr = rotBySeed ? rotBySeed.get(r.seed) : null;
      const tmBy = rr && rr.tm ? new Map(rr.tm.map((t) => [t[0], t])) : null;
      const seen = new Set();
      const firstMet = new Map();
      for (let i = 0; i < r.fx.length; i++) { let nw = false; for (const t of tidsOf(r, i)) if (!seen.has(t)) { seen.add(t); nw = true; } firstMet.set(i, nw); }
      for (const t of r.tk) {
        const i = t[0];
        const hp0 = t[2] / 1000;
        const pol = (o) => { const died = t[o] === 0 || t[o + 3] > 0; const hp = died ? 0 : t[o + 1] / 1000; return { died, hp, lost: hp0 - hp, pot: t[o + 2] }; };
        const own = pol(3); const op = pol(7); const au = pol(11);
        const worse = (a, b) => (a.died && !b.died) || (!a.died && !b.died && b.hp - a.hp >= GAP - 1e-9);
        const think = worse(own, op);
        const thinkAu = worse(own, au);
        const reverse = worse(op, own);
        let ma = null;
        const tm = tmBy ? tmBy.get(i) : null;
        if (tm) {
          if (tm[2] !== t[2] || tm[3] !== t[3] || tm[4] !== t[4]) mismatch++;
          else { const died = tm[7] === 0 || tm[10] > 0; const hp = died ? 0 : tm[8] / 1000; ma = { died, hp, lost: hp0 - hp, pot: tm[9] }; }
        }
        rows.push({ cls, seed: r.seed, i, g: groupOf(r, i), z: r.fx[i][4], node: r.fc[i][1], hp0, own, op, au, ma, think, thinkAu, reverse, thinkRot: ma ? worse(ma, op) : null, tids: tidsOf(r, i), newT: firstMet.get(i), nodes: r.nodes });
      }
    }
  }
  if (mismatch) process.stderr.write(`thinkRows: ${mismatch} rotation replays did not match their think entry (left out)\n`);
  return rows;
}

/** Rotation table (think rows with the masher's replay): per key, the masher's deaths and HP lost, and the think fights
 *  of a rotation player (the masher dies or ends >= GAP lower than the opener's line) next to onebutton's. */
function rotTable(rows, keyOf, keys, label) {
  const lines = [`| ${label} | Fights | Deaths: onebutton / masher / opener line | HP lost: onebutton / masher / opener (pp) | Think fights: onebutton | Think fights: masher (rotation) | Onebutton think fights a rotation fixes |`, '|---|---|---|---|---|---|---|'];
  for (const k of keys) {
    const xs = rows.filter((x) => x.ma && keyOf(x) === k);
    if (!xs.length) continue;
    const n = xs.length;
    const cnt = (f) => xs.filter(f).length;
    const th = xs.filter((x) => x.think);
    lines.push(`| ${GROUP_LABEL[k] || k} | ${n} | ${pc(cnt((x) => x.own.died) / n)} / ${pc(cnt((x) => x.ma.died) / n)} / ${pc(cnt((x) => x.op.died) / n)} | ${f1(100 * mean(xs.map((x) => x.own.lost)))} / ${f1(100 * mean(xs.map((x) => x.ma.lost)))} / ${f1(100 * mean(xs.map((x) => x.op.lost)))} | ${ci(th.length, n)} | ${ci(cnt((x) => x.thinkRot), n)} | ${th.length ? pc(th.filter((x) => !x.thinkRot).length / th.length) : 'n/a'} |`);
  }
  return lines.join('\n');
}

/** onebutton against the masher on the same fights of the rotation cell (tm only; more seeds than the opener's). */
function rotOnly(rot) {
  const s = {};
  for (const r of flat(rot)) {
    if (!r.tm) continue;
    for (const t of r.tm) {
      const g = groupOf(r, t[0]);
      const x = s[g] || (s[g] = { n: 0, od: 0, md: 0, ol: [], ml: [], worse: 0, better: 0 });
      const hp0 = t[2] / 1000;
      const od = t[3] === 0 || t[6] > 0; const md = t[7] === 0 || t[10] > 0;
      const oh = od ? 0 : t[4] / 1000; const mh = md ? 0 : t[8] / 1000;
      x.n++; if (od) x.od++; if (md) x.md++;
      x.ol.push(hp0 - oh); x.ml.push(hp0 - mh);
      if ((od && !md) || (!od && !md && mh - oh >= GAP - 1e-9)) x.worse++;
      if ((md && !od) || (!od && !md && oh - mh >= GAP - 1e-9)) x.better++;
    }
  }
  const lines = ['| Fight kind | Fights | onebutton dies | masher dies | HP lost: onebutton / masher (pp) | onebutton clearly worse than the masher | onebutton clearly better |', '|---|---|---|---|---|---|---|'];
  for (const g of GROUPS) {
    const x = s[g];
    if (!x) continue;
    lines.push(`| ${GROUP_LABEL[g]} | ${x.n} | ${pc(x.od / x.n)} | ${pc(x.md / x.n)} | ${f1(100 * mean(x.ol))} / ${f1(100 * mean(x.ml))} | ${pc(x.worse / x.n)} | ${pc(x.better / x.n)} |`);
  }
  return lines.join('\n');
}

function thinkTable(rows, keyOf, keys, label) {
  const lines = [`| ${label} | Fights | onebutton dies | opener line dies | autoplay dies | HP lost: onebutton / opener / autoplay (pp) | Think fights (vs opener) | Think (vs autoplay) | Opener clearly worse |`, '|---|---|---|---|---|---|---|---|---|'];
  for (const k of keys) {
    const xs = rows.filter((x) => keyOf(x) === k);
    if (!xs.length) continue;
    const n = xs.length;
    const cnt = (f) => xs.filter(f).length;
    lines.push(`| ${GROUP_LABEL[k] || k} | ${n} | ${pc(cnt((x) => x.own.died) / n)} | ${pc(cnt((x) => x.op.died) / n)} | ${pc(cnt((x) => x.au.died) / n)} | ${f1(100 * mean(xs.map((x) => x.own.lost)))} / ${f1(100 * mean(xs.map((x) => x.op.lost)))} / ${f1(100 * mean(xs.map((x) => x.au.lost)))} | ${ci(cnt((x) => x.think), n)} | ${pc(cnt((x) => x.thinkAu) / n)} | ${pc(cnt((x) => x.reverse) / n)} |`);
  }
  return lines.join('\n');
}

/** Think fights per run, per zone and the spacing in nodes (consecutive think fights of a run). */
function spacing(rows, byCls) {
  const runs = flat(byCls).filter((r) => r.tk);
  const byRun = new Map();
  for (const x of rows) { const k = `${x.cls}|${x.seed}`; if (!byRun.has(k)) byRun.set(k, []); byRun.get(k).push(x); }
  const gaps = []; const first = []; let nThink = 0; let nodes = 0; let fights = 0;
  for (const r of runs) {
    const xs = (byRun.get(`${r.cls}|${r.seed}`) || []).sort((a, b) => a.i - b.i);
    const th = xs.filter((x) => x.think);
    nThink += th.length; fights += xs.length;
    nodes += r.nodes || 0;
    if (th.length) first.push(th[0].node + 1);
    for (let j = 1; j < th.length; j++) gaps.push(th[j].node - th[j - 1].node);
  }
  return { runs: runs.length, nThink, nodes, fights, gaps, first };
}

function zoneTable(rows) {
  const zs = [...new Set(rows.map((x) => x.z))].sort((a, b) => a - b);
  const lines = ['| Zone | Non-boss fights | Think fights | Share | Fights per think fight | Special fights (elite, rare, dungeon boss, Dimmed) | Think share in special fights | Think share in normal and grind fights |', '|---|---|---|---|---|---|---|---|'];
  for (const z of zs) {
    const xs = rows.filter((x) => x.z === z);
    const th = xs.filter((x) => x.think).length;
    const sp = xs.filter((x) => SPECIAL.has(x.g));
    const ng = xs.filter((x) => x.g === 'quest' || x.g === 'grind');
    lines.push(`| ${z > C.ZONE_COUNT ? 'Camp' : `Z${z}`} | ${xs.length} | ${th} | ${pc(th / xs.length)} | ${th ? f1(xs.length / th) : 'none'} | ${sp.length} | ${sp.length ? pc(sp.filter((x) => x.think).length / sp.length) : 'n/a'} | ${ng.length ? pc(ng.filter((x) => x.think).length / ng.length) : 'n/a'} |`);
  }
  return lines.join('\n');
}

function templateTable(rows, min = 25) {
  const m = new Map();
  for (const x of rows) for (const t of new Set(x.tids)) { const e = m.get(t) || { n: 0, th: 0, d: 0, g: new Map() }; e.n++; if (x.think) e.th++; if (x.own.died) e.d++; e.g.set(x.g, (e.g.get(x.g) || 0) + 1); m.set(t, e); }
  const list = [...m.entries()].filter(([, e]) => e.n >= min).map(([t, e]) => ({ t, ...e, p: e.th / e.n }));
  list.sort((a, b) => b.p - a.p);
  const row = (e) => `| ${CONTENT.enemies[e.t] ? CONTENT.enemies[e.t].name : e.t} (${archOf(e.t)}) | ${[...e.g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => GROUP_LABEL[g]).join(', ')} | ${e.n} | ${pc(e.p)} | ${pc(e.d / e.n)} |`;
  const head = '| Enemy (archetype) | Mostly met in | Fights | Think fights | onebutton dies |\n|---|---|---|---|---|';
  return { top: [head, ...list.slice(0, 10).map(row)].join('\n'), bottom: [head, ...list.slice(-8).reverse().map(row)].join('\n'), count: list.length };
}

// ---------------- Main ----------------
const BLOCKS = [
  { id: 'classic-P0', title: 'Classic map, P0', dir: 'classic', suffix: 'P0', think: 'think/onebutton-P0', rot: 'rot/onebutton-P0' },
  { id: 'classic-PALL', title: 'Classic map, PALL', dir: 'classic', suffix: 'PALL', think: 'think/onebutton-PALL', rot: 'rot/onebutton-PALL' },
  { id: 'exp-P0', title: 'Expedition with the start camp, P0', dir: 'exp', suffix: 'P0-exp-prep', think: 'think/onebutton-P0-exp-prep', rot: 'rot/onebutton-P0-exp-prep' },
  { id: 'exp-PALL', title: 'Expedition with the start camp, PALL', dir: 'exp', suffix: 'PALL-exp-prep', think: null, rot: null },
];
const BOTS = [['onebutton', 'onebutton'], ['onebutton-nopot', 'onebutton', 'nopot'], ['masher', 'masher'], ['planner (autoplay)', 'planner'], ['opener', 'opener']];

function main() {
  const out = [];
  const say = (x = '') => out.push(x);
  say(`<!-- generated by node sim/mashreport.mjs --in ${IN} --gap ${GAP} -->`);
  const only = args.blocks ? new Set(args.blocks.split(',')) : null;
  for (const b of BLOCKS) {
    if (only && !only.has(b.id)) continue;
    const cells = {};
    for (const [label, bot, variant] of BOTS) {
      const name = variant ? `${bot}-${b.suffix.replace(/^(P0|PALL)/, `$1-${variant}`)}` : `${bot}-${b.suffix}`;
      const d = load(join(IN, b.dir, variant ? `${bot}-${b.suffix.split('-')[0]}-${variant}${b.suffix.includes('exp') ? '-exp-prep' : ''}` : name));
      if (d) cells[label] = d;
    }
    if (b.id === 'classic-P0') { const d = load(join(IN, 'slot1tree', 'planner-P0')); if (d) cells['planner on the slot-1 trees'] = d; }
    if (!Object.keys(cells).length) continue;
    say(`### ${b.title}`);
    say();
    say('| Cell | Runs per class | rogue | mage | hunter (reach / win) | Reach the boss | Win | Win given reach | Non-boss deaths per 1 000 fights | Rounds per non-boss fight |');
    say('|---|---|---|---|---|---|---|---|---|---|');
    for (const [label, d] of Object.entries(cells)) say(runRow(label, d));
    say();
    const ob = cells.onebutton;
    if (ob) {
      const lines = [];
      for (const ref of ['planner (autoplay)', 'opener', 'masher', 'planner on the slot-1 trees']) {
        if (!cells[ref]) continue;
        lines.push(`- onebutton minus ${ref}, paired by class and seed: reach the boss ${paired(ob, cells[ref], (r) => r.rb)}; win ${paired(ob, cells[ref], (r) => (r.out === 'v' ? 1 : 0))}.`);
      }
      for (const c of CLASSES) {
        if (!ob[c] || !cells['planner (autoplay)'] || !cells['planner (autoplay)'][c]) continue;
        const one = { [c]: ob[c] };
        const pl = { [c]: cells['planner (autoplay)'][c] };
        const op = cells.opener && cells.opener[c] ? { [c]: cells.opener[c] } : null;
        lines.push(`- ${c}: reach the boss, onebutton minus planner ${paired(one, pl, (r) => r.rb)}${op ? `; minus opener ${paired(one, op, (r) => r.rb)}` : ''}.`);
      }
      say(lines.join('\n'));
      say();
    }
    say('Where runs end (share of runs):');
    say();
    const zkeys = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Camp', 'end boss', 'won', 'other'];
    say(`| Cell | ${zkeys.join(' | ')} |`);
    say(`|---|${zkeys.map(() => '---').join('|')}|`);
    for (const [label, d] of Object.entries(cells)) { const { z, n } = deathZones(d); say(`| ${label} | ${zkeys.map((k) => (z[k] ? pc(z[k] / n) : '-')).join(' | ')} |`); }
    say();
    const ks = Object.fromEntries(Object.entries(cells).map(([l, d]) => [l, kindStats(d)]));
    const labels = Object.keys(cells).filter((l) => l !== 'planner on the slot-1 trees');
    say('By fight kind, full runs: deaths per 1 000 fights / HP lost per won fight (pp of max HP) / rounds per fight (fights of onebutton):');
    say();
    say(`| Fight kind | ${labels.join(' | ')} | Fights (onebutton) |`);
    say(`|---|${labels.map(() => '---').join('|')}|---|`);
    for (const g of GROUPS) {
      if (!labels.some((l) => ks[l][g])) continue;
      const cell = (l) => { const x = ks[l][g]; return x ? `${f1((1000 * x.d) / x.n, 0)} / ${f1(mean(x.lost))} / ${f1(mean(x.rounds))}` : '-'; };
      say(`| ${GROUP_LABEL[g]} | ${labels.map(cell).join(' | ')} | ${ks.onebutton && ks.onebutton[g] ? ks.onebutton[g].n : 0} |`);
    }
    say();
    say(`Wind-ups answered in elite, rare and dungeon-boss fights: ${labels.map((l) => { let a = 0; let n = 0; for (const g of ['elite', 'rare', 'dboss']) { const x = ks[l][g]; if (x) { a += x.wuA; n += x.wuA + x.wuL + x.wuK; } } return `${l} ${n ? pc(a / n) : 'n/a'} (n=${n})`; }).join('; ')}.`);
    say();
    const as = Object.fromEntries(labels.map((l) => [l, archStats(cells[l])]));
    say('By enemy archetype in the fight (non-boss fights containing it), full runs: deaths per 1 000 fights / HP lost per won fight (pp):');
    say();
    say(`| Archetype | ${labels.join(' | ')} |`);
    say(`|---|${labels.map(() => '---').join('|')}|`);
    for (const a of ARCH) say(`| ${a} | ${labels.map((l) => { const x = as[l][a]; return x ? `${f1((1000 * x.d) / x.n, 1)} / ${f1(mean(x.lost))}` : '-'; }).join(' | ')} |`);
    say();
    const tk = b.think ? load(join(IN, b.think)) : null;
    const rot = b.rot ? load(join(IN, b.rot)) : null;
    if (rot) {
      say(`#### onebutton against a rotation (the masher) on the same fights, ${b.title} (${flat(rot).length} onebutton runs, every non-boss fight replayed with the masher)`);
      say();
      say(rotOnly(rot));
      say();
    }
    if (tk) {
      const rows = thinkRows(tk, rot);
      say(`#### Think fights, ${b.title} (paired replays of ${flat(tk).length} onebutton runs, ${rows.length} non-boss fights; gap ${Math.round(GAP * 100)} pp)`);
      say();
      say(thinkTable(rows, (x) => x.g, GROUPS, 'Fight kind'));
      say();
      say(thinkTable(rows, (x) => x.cls, CLASSES, 'Class'));
      say();
      const sp = spacing(rows, tk);
      const spec = rows.filter((x) => SPECIAL.has(x.g));
      const ng = rows.filter((x) => x.g === 'quest' || x.g === 'grind');
      say(`- Think fights per run: ${f1(sp.nThink / sp.runs, 2)} (${sp.nThink} in ${sp.runs} runs); one every ${f1(sp.fights / Math.max(1, sp.nThink))} non-boss fights and every ${f1(sp.nodes / Math.max(1, sp.nThink))} nodes entered.`);
      say(`- By class, think fights per run / nodes per think fight: ${CLASSES.filter((c) => tk[c]).map((c) => { const s2 = spacing(rows.filter((x) => x.cls === c), { [c]: tk[c] }); return `${c} ${f1(s2.nThink / s2.runs, 2)} / ${f1(s2.nodes / Math.max(1, s2.nThink))}`; }).join('; ')}.`);
      const deadly = rows.filter((x) => x.own.died && !x.op.died);
      const ownDied = rows.filter((x) => x.own.died).length;
      say(`- Deadly think fights: of the ${ownDied} fights in which onebutton dies (or needs a resurrect), the opener line survives ${deadly.length} (${pc(deadly.length / Math.max(1, ownDied))}); ${pc(deadly.filter((x) => SPECIAL.has(x.g)).length / Math.max(1, deadly.length))} of those are special fights.`);
      say(`- Nodes between consecutive think fights of a run: median ${median(sp.gaps)}, quartiles ${q(sp.gaps, 0.25)}-${q(sp.gaps, 0.75)} (n=${sp.gaps.length}); first think fight at node ${median(sp.first)} (median; ${sp.first.length} of ${sp.runs} runs have one).`);
      say(`- Share of think fights that are special fights (elite, rare, dungeon boss, Dimmed): ${pc(rows.filter((x) => x.think && SPECIAL.has(x.g)).length / Math.max(1, sp.nThink))}; think share in special fights ${pc(spec.filter((x) => x.think).length / Math.max(1, spec.length))} (n=${spec.length}), in normal and grind fights ${pc(ng.filter((x) => x.think).length / Math.max(1, ng.length))} (n=${ng.length}).`);
      const nw = ng.filter((x) => x.newT); const old = ng.filter((x) => !x.newT);
      say(`- Normal and grind fights with an enemy met for the first time in the run: think share ${pc(nw.filter((x) => x.think).length / Math.max(1, nw.length))} (n=${nw.length}); with familiar enemies only ${pc(old.filter((x) => x.think).length / Math.max(1, old.length))} (n=${old.length}).`);
      for (const g of [0.10, 0.30]) {
        const th = rows.filter((x) => (x.own.died && !x.op.died) || (!x.own.died && !x.op.died && x.op.hp - x.own.hp >= g - 1e-9)).length;
        say(`- Sensitivity, gap ${Math.round(g * 100)} pp: think share ${pc(th / rows.length)} of non-boss fights, ${f1(th / sp.runs, 2)} per run.`);
      }
      say();
      if (rows.some((x) => x.ma)) {
        say('Think fights of a rotation player (the masher replayed on the same fights; a think fight for it: it dies or ends >= the gap lower than the opener line):');
        say();
        say(rotTable(rows, (x) => x.g, GROUPS, 'Fight kind'));
        say();
        say(rotTable(rows, (x) => x.cls, CLASSES, 'Class'));
        say();
        const sp2 = spacing(rows.map((x) => ({ ...x, think: !!x.thinkRot })), tk);
        say(`- Rotation think fights per run (the onebutton runs' fights): ${f1(sp2.nThink / sp2.runs, 2)}; one every ${f1(sp2.fights / Math.max(1, sp2.nThink))} non-boss fights and every ${f1(sp2.nodes / Math.max(1, sp2.nThink))} nodes; nodes between consecutive ones: median ${median(sp2.gaps)}, quartiles ${q(sp2.gaps, 0.25)}-${q(sp2.gaps, 0.75)} (n=${sp2.gaps.length}).`);
        const rs = rows.filter((x) => x.ma);
        const spR = rs.filter((x) => SPECIAL.has(x.g)); const ngR = rs.filter((x) => x.g === 'quest' || x.g === 'grind');
        say(`- Rotation think share: special fights ${pc(spR.filter((x) => x.thinkRot).length / Math.max(1, spR.length))} (n=${spR.length}), normal and grind fights ${pc(ngR.filter((x) => x.thinkRot).length / Math.max(1, ngR.length))} (n=${ngR.length}); share of rotation think fights that are special: ${pc(rs.filter((x) => x.thinkRot && SPECIAL.has(x.g)).length / Math.max(1, rs.filter((x) => x.thinkRot).length))}.`);
        say();
      }
      say(zoneTable(rows));
      say();
      say(thinkTable(rows, (x) => { const a = new Set(x.tids.map(archOf)); return a.size === 1 ? [...a][0] : 'mixed'; }, [...ARCH, 'mixed'], 'Archetypes in the fight (one kind / mixed)'));
      say();
      const tt = templateTable(rows);
      say(`Enemies with the highest think share (templates in >= 25 replayed fights; ${tt.count} templates):`);
      say();
      say(tt.top);
      say();
      say('Enemies with the lowest think share:');
      say();
      say(tt.bottom);
      say();
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}

// Run as a script only (sim/v13report.mjs imports the helpers).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
export { thinkRows, spacing, kindStats, load, flat, paired, templateTable, zoneTable, thinkTable, rotTable, CLASSES as MASH_CLASSES };
