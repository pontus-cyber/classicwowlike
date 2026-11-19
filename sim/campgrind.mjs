#!/usr/bin/env node
// Camp-grind bench (legacy.md 4.7 E7, D161; qa-2026-11-19b section 2): hero XP a Camp wave pays per pace minute in a Legacy
// run, by hero level. A hero of the class at hero level H (debug.setHero on a later profile) is built at the Camp
// (debug.build zone 7 at the hero's power level: every spell trained, gear of --rarity, default rare, the default talents,
// DEV potions; the Camp's level is fixed there, power level + CAMP_TIER, legacy.md 2.4). It then grinds Camp waves as the
// QA bot did before its fix (qa/browser/policy.mjs: the Inn once when under half HP, the engine's autoplay in fights and
// loot windows) until --waves waves, --minutes pace minutes or death.
// Pace minutes are the engine's own estimate (summary.minutes.manual, rules 3).
//
//   node sim/campgrind.mjs [--hero 5,10,15,20] [--waves 20] [--minutes 0] [--seeds 1-10] [--classes rogue,mage,hunter]
//        [--at 5,10,15,20] [--rarity rare] [--gates legacy,oruvathLegacy,economyV2] [--json <file>]
// --hero: the hero levels the hero arrives at the Camp with (one block of rows each).
// --at: hero levels to read the XP a pace minute at during the grind (waves started at that hero level; a long grind from
//       an early arrival, the QA bot's case: e.g. --hero 5 --waves 700 --at 5,6,7,8,10,15,20).
// --gates: the switches on (every other off); default the three of Economy v2's Legacy runs.
// Prints, per class and pooled: waves, pace minutes, hero XP, XP a pace minute (all waves and the first 20), the hero level
// at arrival and at the end, deaths, and XP a pace minute at each --at level (waves, minutes); --json writes the rows.
import { writeFileSync } from 'node:fs';
import { R, C, CONTENT } from './lib/engine.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  return o;
}
const list = (x) => {
  if (x.includes(',')) return x.split(',').map(Number);
  const [lo, hi] = x.split('-').map(Number);
  const out = [];
  for (let v = lo; v <= (hi ?? lo); v++) out.push(v);
  return out;
};
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
const FIRST = 20;

/** A fight or a loot window is open (the engine's autoplay closes it); else the hero stands at the Camp. */
const busy = (s) => s.phase !== 'ENDED' && (s.phase !== 'CAMP' || !!s.fight || !!(s.loot && s.loot.length));

/** One grind: { waves, min, xp, xpFirst, minFirst, h0, h1, death, at: { H: { waves, min, xp } } }. */
export function grind(classId, H, seed, { waves = FIRST, minutes = 0, rarity = 'rare' } = {}) {
  let prof = { ...R.newProfile(), runs: 2, welcome: true, guide: 'done' };
  prof = R.debug.setHero(prof, classId, { level: H, xp: 0 });
  let s = R.debug.build({ content: CONTENT, classId, petId: PET(classId), seed, profile: prof, zone: C.ZONE_COUNT + 1, level: R.powerOfLevel(H), rarity }).state;
  const mins = (st) => R.summary(st).minutes.manual;
  const out = { waves: 0, min: 0, xp: 0, xpFirst: 0, minFirst: 0, h0: s.player.heroLevel, h1: s.player.heroLevel, death: 0, camp: s.hero && s.hero.camp, at: {} };
  const m0 = mins(s);
  let guard = 0;
  while (out.waves < waves && (!minutes || out.min < minutes) && guard++ < 1e6) {
    if (s.phase === 'ENDED') { out.death = 1; break; }
    if (busy(s)) { s = R.step(s, R.autoAction(s)).state; continue; }
    const p = s.player;
    if (p.hp < 0.5 * p.d.maxHp && !s.hub.used.inn) { s = R.step(s, { type: 'SERVICE', service: 'inn' }).state; continue; }
    const h = p.heroLevel;
    const x0 = s.stats.xpGained;
    const t0 = mins(s);
    s = R.step(s, { type: 'CAMP_GRIND' }).state;
    while (busy(s)) s = R.step(s, R.autoAction(s)).state;
    const dx = s.stats.xpGained - x0;
    const dt = mins(s) - t0;
    out.waves += 1;
    out.xp += dx;
    out.min = mins(s) - m0;
    if (out.waves <= FIRST) { out.xpFirst += dx; out.minFirst += dt; }
    const b = (out.at[h] = out.at[h] || { waves: 0, min: 0, xp: 0 });
    b.waves += 1; b.min += dt; b.xp += dx;
    if (s.phase === 'ENDED') { out.death = 1; break; }
  }
  out.h1 = s.player.heroLevel + (s.player.heroLevel < C.HERO_MAX_LEVEL ? s.player.xp / R.heroXpToNext(s.player.heroLevel) : 0);
  return out;
}

const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : NaN);
function pool(rows, at) {
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  const n = rows.length;
  const atRow = Object.fromEntries(at.map((h) => {
    const w = rows.reduce((a, r) => (r.at[h] ? { waves: a.waves + r.at[h].waves, min: a.min + r.at[h].min, xp: a.xp + r.at[h].xp } : a), { waves: 0, min: 0, xp: 0 });
    return [h, { ...w, xpPerMin: w.min > 0 ? r1(w.xp / w.min) : null }];
  }));
  return {
    runs: n, waves: r1(sum('waves') / n), min: r1(sum('min') / n), xp: Math.round(sum('xp') / n),
    xpPerMin: r1(sum('xp') / sum('min')), xpPerMinFirst: r1(sum('xpFirst') / sum('minFirst')),
    xpPerWave: r1(sum('xp') / sum('waves')), h0: r1(sum('h0') / n), h1: r1(sum('h1') / n), deaths: sum('death'), at: atRow,
  };
}

function main() {
  const a = parse(process.argv.slice(2));
  const heroes = list(a.hero || '5,10,15,20');
  const seeds = list(a.seeds || '1-10');
  const classes = (a.classes || 'rogue,mage,hunter').split(',');
  const at = a.at ? list(a.at) : [];
  const gates = (a.gates || 'legacy,oruvathLegacy,economyV2').split(',').filter(Boolean);
  for (const k of Object.keys(C.GATES)) C.GATES[k] = gates.includes(k);
  const opts = { waves: Number(a.waves || FIRST), minutes: Number(a.minutes || 0), rarity: a.rarity || 'rare' };
  const res = [];
  console.log(`gates on: ${gates.join(', ') || 'none'}; waves ${opts.waves}${opts.minutes ? `, minutes ${opts.minutes}` : ''}; seeds ${seeds[0]}-${seeds[seeds.length - 1]}`);
  const head = ['hero', 'class', 'runs', 'waves', 'pace min', 'hero XP', 'XP/min', `XP/min first ${FIRST}`, 'XP/wave', 'hero at arrival', 'hero at end', 'deaths', ...at.map((h) => `XP/min at hero ${h} (min)`)];
  console.log(`| ${head.join(' | ')} |`);
  console.log(`|${head.map(() => '---').join('|')}|`);
  for (const H of heroes) {
    const all = [];
    for (const c of classes) {
      const rows = seeds.map((sd) => grind(c, H, sd, opts));
      all.push(...rows);
      res.push({ hero: H, classId: c, ...pool(rows, at) });
    }
    res.push({ hero: H, classId: 'pooled', ...pool(all, at) });
    for (const r of res.filter((x) => x.hero === H)) {
      const cells = [H, r.classId, r.runs, r.waves, r.min, r.xp, r.xpPerMin, r.xpPerMinFirst, r.xpPerWave, r.h0, r.h1, r.deaths,
        ...at.map((h) => (r.at[h].xpPerMin === null ? '-' : `${r.at[h].xpPerMin} (${r1(r.at[h].min / r.runs)})`))];
      console.log(`| ${cells.join(' | ')} |`);
    }
  }
  if (a.json) writeFileSync(a.json, JSON.stringify({ gates, opts, seeds, rows: res }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
