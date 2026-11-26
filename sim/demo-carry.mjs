#!/usr/bin/env node
// Demo carry-over (docs/reports/demo-carryover-2026-11-26.md, draft; BACKLOG 'Demo blind round 2' R2-1, R2-2): demo
// campaigns from a fresh profile with C.DEMO_GATES, per class: the guided first run, then runs at the kept hero level,
// buying the demo hall (C.DEMO_HALL, rank I) in its order whenever affordable. The sim's planner (or greedy) plays every
// run; the first run is guided (the D152 harness rule). Measures per run: outcome, fights won in zone 2, damage taken per
// fight, hero level, pace minutes (summary minutes.manual) and the pace minute at which the hero reaches HERO_MAX_DEMO.
// Variants are sim-only overrides of the engine's tables, restored after each campaign; nothing in src/ changes:
//   base    the demo as built
//   lag     zones 1-2 trail the hero: ZONE_LAG + 0.5 for zones 1 and 2, so a zone's band rises about one hero level per
//           two (band = P + tier - round((ZONE_LAG + 0.5) × (P - 1)); powerOf is about 1 + 2.5 × (H - 1))
//   hall    today's scaling with a stronger demo hall: Vigor I +8 % max HP, Edge I +5 % Power, Cartographer reworked
//           (Region Charts and Pathfinder: node types within PATHFINDER_RADIUS hops, played as newRun vision)
// --single carto4: Cartographer with Tracker's Notes (contract site marks within TRACKER_RADIUS hops; Old Hand's perk).
// --single carto3: Cartographer typing every node of the zone on arrival (Pathfinder radius 99).
//   lag33   a middle step (not asked; for the owner note): ZONE_LAG + 0.33, about two zone levels per three hero levels
//   carto   base with only the Cartographer rework (its own value next to Quartermaster)
// --single <entry|none|carto2> --hero H: no campaign; every run from a later profile with the class's hero at H owning only
//   that entry (carto2: Cartographer with the rework), seeds --seed..+campaigns; the entry's own value per run.
//
//   node sim/demo-carry.mjs --variant base|lag|hall|carto [--campaigns 20] [--runs 7] [--bot planner] [--seed 7000]
//        [--classes rogue,mage,hunter] [--out file.json]
// Prints one JSON line per campaign when --out is not given; tables: node sim/demo-carry.mjs --report a.json b.json ...
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

if (args.report) { report(process.argv.slice(process.argv.indexOf('--report') + 1)); process.exit(0); }

const { C, R, newRunFor } = await import('./lib/engine.mjs');
const { createBot } = await import('./bots/index.mjs');
const { setGates, followsGuide, cellPet } = await import('./lib/runner.mjs');
const { buildTable } = await import('./lib/risk.mjs');

const VARIANT = args.variant || 'base';
const CAMPAIGNS = Number(args.campaigns || 20);
const RUNS = Number(args.runs || 7);
const BOT = args.bot || 'planner';
const SEED0 = Number(args.seed || 7000);
const CLASSES = (args.classes || 'rogue,mage,hunter').split(',');
const TREES = { rogue: 2, mage: 1, hunter: 2 };
const NEED = Number(args.need || 0); // R2-1 reading only: fights won in zone 2 that a demo end needs (0: not read)

// risk tables of the Legacy hero bands (sim/tables/legacy-hx), per class
const riskFor = (cls, H) => {
  const f = join(HERE, 'tables', 'legacy-hx', H <= 5 ? 'risk-H01-05.json' : 'risk-H06-10.json');
  const obs = JSON.parse(readFileSync(f, 'utf8'));
  return buildTable(obs[cls] || { full: {}, td: {}, t: {}, runs: 0 });
};
const RISK = {};
const risk = (cls, H) => { const k = `${cls}${H <= 5 ? 'a' : 'b'}`; return (RISK[k] ||= riskFor(cls, H)); };

// ---- variants (sim-only overrides; restored after each campaign)
const saved = { lag: [...C.ZONE_LAG], vigor: [...C.HALL_VIGOR_PCT], edge: [...C.HALL_EDGE_PCT] };
function applyVariant(v) {
  C.ZONE_LAG.splice(0, C.ZONE_LAG.length, ...saved.lag);
  C.HALL_VIGOR_PCT.splice(0, 2, ...saved.vigor);
  C.HALL_EDGE_PCT.splice(0, 2, ...saved.edge);
  C.META_HERO.vigor.hpPct = C.HALL_VIGOR_PCT;
  C.META_HERO.edge.powerPct = C.HALL_EDGE_PCT;
  if (v === 'lag') { C.ZONE_LAG[0] += 0.5; C.ZONE_LAG[1] += 0.5; }
  if (v === 'lag33') { C.ZONE_LAG[0] += 0.33; C.ZONE_LAG[1] += 0.33; }
  if (v === 'hall') { C.HALL_VIGOR_PCT[0] = 0.08; C.HALL_EDGE_PCT[0] = 0.05; }
}
const cartoRework = VARIANT === 'hall' || VARIANT === 'carto';

/** One run with the bot; returns { rec, profile }. */
function playRun(cls, seed, profile, guided) { return playRunWith(cls, seed, profile, cartoRework ? 2 : 0, guided); }
function playRunWith(cls, seed, profile, rework, guided = false) {
  const H = profile.heroes && profile.heroes[cls] ? profile.heroes[cls].level : 1;
  const cell = { bot: BOT, cls, tree: TREES[cls], guided };
  const bot = createBot(BOT, { classId: cls, seed, risk: risk(cls, H), tree: TREES[cls] });
  const vision = rework && (profile.unlocks.cartographer || 0) > 0 ? { charts: true, pathfinder: true } : null;
  const s = newRunFor({ classId: cls, petId: cellPet(cell), seed, profile, mapMode: 'expedition', vision, prep: true, tutorial: guided });
  // carto3 (whole-zone types): Pathfinder's radius past the zone's size; the engine reads s.exp.vision.typeRadius
  const widen = () => { if (vision && rework > 2 && s.exp && s.exp.vision.typeRadius < rework) s.exp.vision.typeRadius = rework; };
  let n = 0; let z2wins = 0; let wins = 0; let capAt = null; let err = null; let exitZ2 = null;
  while (s.phase !== 'ENDED' && n < 20000) {
    widen();
    let a;
    try { a = bot.choose(s); } catch (e) { err = `bot: ${e.message}`; break; }
    if (guided && s.tutorial && s.phase === 'MAP' && followsGuide(s)) a = R.autoAction(s);
    else if (guided && s.tutorial && !R.isLegal(s, a)) a = R.autoAction(s);
    const z = s.zone && Number.isInteger(s.zone.z) ? s.zone.z : null;
    let events;
    try { events = R.stepInPlace(s, a); } catch (e) { err = `engine: ${e.message}`; break; }
    for (const e of events) {
      if (e.t === 'victory') { wins++; if (z === 2) z2wins++; }
      if (e.t === 'levelUp' && e.cap === 'demo' && capAt === null) capAt = R.summary(s).minutes.manual;
      if (e.t === 'travel' && e.from === 2) exitZ2 = { by: e.by, z2wins };
    }
    n++;
  }
  if (n >= 20000) err = 'stuck';
  const sum = s.result ? s.result.summary : R.summary(s);
  const hero = sum.hero || {};
  const rec = {
    out: sum.outcome, fights: sum.fights, hp: s.player.d.maxHp, wins, z2wins, exitZ2, taken: sum.damage.taken, min: sum.minutes.manual,
    h0: hero.start ? hero.start.level : null, h1: hero.level, legacy: sum.echoes.total, welcome: sum.echoes.lines.some((l) => l.id === 'welcome'),
    xpg: s.stats.xpGained, ct: sum.expedition && sum.expedition.contracts ? [sum.expedition.contracts.completed, sum.expedition.contracts.taken] : null, lines: Object.fromEntries(sum.echoes.lines.map((l) => [l.id, l.echoes])), capAt, err,
    death: sum.death ? { z: sum.reached.zone, node: sum.death.nodeType || null } : null, zone: sum.reached.zone,
  };
  return { rec, profile: s.result ? s.result.profile : profile };
}

function buyAll(profile) {
  const bought = [];
  let p = profile;
  for (const id of C.DEMO_HALL) {
    const o = R.metaOffers(p).find((x) => x.id === id);
    if (!o || o.rank >= 1) continue;
    if (!o.available || (p.legacy ?? p.echoes) < o.nextCost) break; // the spec's planner (demo.md 6): strictly in order
    p = R.buyMeta(p, id);
    bought.push(id);
  }
  return { p, bought };
}

const out = [];
if (args.single) {
  setGates({ ...C.DEMO_GATES });
  applyVariant('base');
  const H = Number(args.hero || 4);
  const entry = ['carto2', 'carto3', 'carto4'].includes(args.single) ? 'cartographer' : args.single;
  for (const cls of CLASSES) for (let c = 0; c < CAMPAIGNS; c++) {
    const base = { ...R.migrateProfile({ ...R.newProfile(), runs: 3, welcome: true, guide: 'done' }) };
    const p0 = R.debug.setHero(base, cls, { level: H, xp: 0 });
    const prof = entry === 'none' ? p0 : { ...p0, unlocks: { ...p0.unlocks, [entry]: 1, ...(args.single === 'carto4' ? { old_hand: 1 } : {}) } };
    const { rec } = playRunWith(cls, SEED0 + c, prof, args.single === 'carto2' ? 2 : args.single === 'carto3' ? 99 : 0);
    out.push({ variant: `single-${args.single}-H${H}`, bot: BOT, cls, c, runs: [rec] });
  }
  writeFileSync(args.out, JSON.stringify(out));
  process.exit(0);
}
for (const cls of CLASSES) for (let c = 0; c < CAMPAIGNS; c++) {
  setGates({ ...C.DEMO_GATES });
  applyVariant(VARIANT);
  let profile = R.migrateProfile(R.newProfile());
  const runs = [];
  for (let k = 0; k < RUNS; k++) {
    const seed = SEED0 + c * 100 + k;
    const { rec, profile: p2 } = playRun(cls, seed, profile, k === 0);
    const { p, bought } = buyAll(p2);
    profile = p;
    rec.bought = bought;
    rec.owned = C.DEMO_HALL.filter((id) => (profile.unlocks[id] || 0) > 0).length;
    rec.bank = profile.legacy ?? profile.echoes;
    runs.push(rec);
  }
  const line = { variant: VARIANT, bot: BOT, cls, c, runs };
  out.push(line);
  if (!args.out) console.log(JSON.stringify(line));
}
applyVariant('base');
if (args.out) writeFileSync(args.out, JSON.stringify(out));

// ---------------------------------------------------------------- tables
function report(files) {
  const med = (xs) => { const a = xs.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const f1 = (x) => (x === null ? '-' : x.toFixed(1));
  const need = Number(args.need || 4);
  for (const f of files.filter((x) => !x.startsWith('--'))) {
    const camps = JSON.parse(readFileSync(f, 'utf8'));
    const v = camps[0].variant;
    if (v.startsWith('single')) {
      const rr = camps.map((cp) => cp.runs[0]);
      console.log(`${v} (${camps[0].bot}, ${rr.length} runs): deaths ${mean(rr.map((r) => (r.out === 'death' ? 1 : 0))).toFixed(3)} · legacy ${f1(mean(rr.map((r) => r.legacy)))} · hero XP ${f1(mean(rr.map((r) => r.xpg)))} · XP/min ${f1(mean(rr.map((r) => r.xpg / r.min)))} · min ${f1(mean(rr.map((r) => r.min)))} · fights ${f1(mean(rr.map((r) => r.fights)))} · % HP/fight ${f1(mean(rr.filter((r) => r.fights).map((r) => (100 * r.taken) / r.fights / r.hp)))} · zone 2 wins ${f1(mean(rr.map((r) => r.z2wins)))} · contracts done/taken ${f1(mean(rr.map((r) => (r.ct ? r.ct[0] : 0))))}/${f1(mean(rr.map((r) => (r.ct ? r.ct[1] : 0))))}`);
      continue;
    }
    const rows = camps.flatMap((cp) => cp.runs.map((r, i) => ({ ...r, k: i + 1, cls: cp.cls })));
    const deaths = mean(rows.map((r) => (r.out === 'death' ? 1 : 0)));
    const ends = mean(rows.map((r) => (r.out === 'demo' ? 1 : 0)));
    const full = mean(rows.map((r) => (r.out === 'demo' && r.z2wins >= need ? 1 : 0)));
    // minutes to hero 7: cumulative pace minutes of the runs before + the run's minute at the level-up to 7
    const capMin = camps.map((cp) => { let t = 0; for (const r of cp.runs) { if (r.capAt !== null) return t + r.capAt; t += r.min; } return null; });
    const capRun = camps.map((cp) => { const i = cp.runs.findIndex((r) => r.capAt !== null); return i < 0 ? null : i + 1; });
    const perFight = (k) => mean(rows.filter((r) => r.k === k && r.fights > 0).map((r) => r.taken / r.fights));
    const pctFight = (k) => mean(rows.filter((r) => r.k === k && r.fights > 0).map((r) => (100 * r.taken) / r.fights / r.hp));
    const z2 = rows.filter((r) => r.out === 'demo').map((r) => r.z2wins);
    console.log(`\n## ${v} (${camps[0].bot}, ${camps.length} campaigns, ${rows.length} runs; ${f})`);
    console.log(`deaths/run ${deaths.toFixed(3)} · demo end ${(ends * 100).toFixed(1)} % · demo end with >= ${need} zone 2 wins ${(full * 100).toFixed(1)} % · not capped ${capMin.filter((x) => x === null).length}`);
    console.log(`minutes to hero 7: median ${f1(med(capMin))} (run ${med(capRun)}) · damage taken per fight run 1 ${f1(perFight(1))}, run 4 ${f1(perFight(4))}, ratio ${(perFight(4) / perFight(1)).toFixed(2)} · as % of max HP run 1 ${f1(pctFight(1))}, run 4 ${f1(pctFight(4))}, ratio ${(pctFight(4) / pctFight(1)).toFixed(2)}`);
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const rr = rows.filter((r) => r.cls === cls); if (!rr.length) continue;
      const cm = camps.filter((cp) => cp.cls === cls).map((cp) => { let t = 0; for (const r of cp.runs) { if (r.capAt !== null) return t + r.capAt; t += r.min; } return null; });
      console.log(`  ${cls}: deaths/run ${mean(rr.map((r) => (r.out === 'death' ? 1 : 0))).toFixed(3)}, min to 7 ${f1(med(cm))}, dmg/fight r1 ${f1(mean(rr.filter((r) => r.k === 1 && r.fights).map((r) => r.taken / r.fights)))} r4 ${f1(mean(rr.filter((r) => r.k === 4 && r.fights).map((r) => r.taken / r.fights)))}`);
    }
    console.log('  per run k: hero start, deaths, dmg/fight, fights, zone-2 wins (median, p10 of demo ends), legacy, minutes');
    for (let k = 1; k <= Math.max(...camps.map((cp) => cp.runs.length)); k++) {
      const rk = rows.filter((r) => r.k === k);
      const zz = rk.filter((r) => r.out === 'demo').map((r) => r.z2wins).sort((a, b) => a - b);
      console.log(`  ${k}: H ${f1(mean(rk.map((r) => r.h0 || 1)))}, deaths ${mean(rk.map((r) => (r.out === 'death' ? 1 : 0))).toFixed(2)}, dmg/fight ${f1(perFight(k))} (${f1(pctFight(k))} % HP), fights ${f1(mean(rk.map((r) => r.fights)))}, z2 wins ${med(zz)} / p10 ${zz.length ? zz[Math.floor(zz.length * 0.1)] : '-'}, legacy ${f1(mean(rk.map((r) => r.legacy)))}, min ${f1(mean(rk.map((r) => r.min)))}`);
    }
    const hist = {}; for (const x of z2) hist[x] = (hist[x] || 0) + 1;
    console.log(`  zone 2 wins at a demo end: ${JSON.stringify(hist)}`);
  }
}
