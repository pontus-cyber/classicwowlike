#!/usr/bin/env node
// Legacy hero-20 zone deaths (task 2026-11-20; report docs/reports/legacy-h20-deaths-2026-11-20.md). Plays one Legacy cell
// (C.GATES.legacy, oruvathLegacy, economyV2 on; expedition map with the start camp; profile `later`; the class's hero at hero
// level H by R.debug.setHero) with one of two drivers and records every fight, so the deaths can be broken down by class,
// zone, node type, enemy, power gap, draughts left and gear item level:
//   --bot autoplay   the QA player of qa/browser/policy.mjs with the game's autoplay in every fight (R.autoAction in combat,
//                    the engine's expedition policy on the map; the policy qa-2026-11-19c measured: standard talents of
//                    EA.AUTO_TREE, loot and vendor rules of the QA policy)
//   --bot planner    the sim planner (sim/bots/planner.mjs) with the band risk table sim/tables/legacy-hx
//   --abl a,b   (planner) swap parts of the planner for the engine's autoplay choice: talent, bar, node, hub, prep, map (= node,
//                hub, prep), vendor; (autoplay) talent = the sim's standard build of the planner's tree
// Writes <out>/<bot>-<class>.jsonl (one run a line, its fights inside) and prints the tables with `tables`.
//
//   node sim/legacy-h20deaths.mjs run --bot autoplay|planner --hero 20 --runs 40 --seed-start 1 --out <dir>
//        [--classes rogue,mage,hunter] [--tree N | rogue:0,mage:0,hunter:1] [--risk <risk.json>] [--profile later|bought]
//        [--abl talent,bar,...] [--workers N]
//   node sim/legacy-h20deaths.mjs tables <dir> [<dir> ...]     tables of one or more run directories
//   node sim/legacy-h20deaths.mjs arms <dir> [<dir> ...]       one row a directory: deaths in zones 2-4 and 1-6, wins
//   --profile bought: the hero also holds the Legacy hall's account entries a real hero 20 has bought (the standard order
//        of sim/lib/profiles.mjs under the Economy v2 hall), to check that the bare `later` profile is not the cause
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, R, newRunFor, gatesFor } from './lib/engine.mjs';
import { createBot } from './bots/index.mjs';
import { buildProfile, standardOrder } from './lib/profiles.mjs';
import { SIM } from './lib/params.mjs';
import { defaultTrees } from './lib/trees.mjs';
import { standardTalent } from './lib/policy.mjs';
import { playerAction, createActions } from '../qa/browser/policy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLASSES = ['rogue', 'mage', 'hunter'];
const MAX_ACTIONS = 40000;
const HEAL = ['healing_draught', 'greater_healing_draught'];

const count = (s, ids) => s.player.bag.reduce((n, it) => n + (it.kind === 'cons' && ids.includes(it.id) ? it.qty : 0), 0);
const gearIlvl = (s) => {
  const it = Object.values(s.player.equipped).filter(Boolean);
  return it.length ? it.reduce((n, x) => n + x.ilvl, 0) / it.length : 0;
};
const r1 = (x) => Math.round(x * 10) / 10;

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
    else o._.push(argv[i]);
  }
  return o;
}

/** The cell's profile: the `later` profile with the class's hero at level H (as sim/lib/runner.mjs cellProfile). */
function makeProfile(cls, hero, kind) {
  const p = buildProfile('later', cls);
  let h = R.debug.setHero(R.migrateProfile(p), cls, { level: hero });
  if (kind === 'bought') {
    // A hero 20 has earned about 1 700 Legacy points (legacy-economy-2026-11-19 section 4); spend them in the standard order
    // of sim/lib/profiles.mjs, then the cheapest available entry, as a player would
    h = { ...h, legacy: 1700 };
    const order = standardOrder(cls).map(([id]) => id);
    for (;;) {
      const offers = R.metaOffers(h).filter((o) => o.affordable);
      if (!offers.length) break;
      offers.sort((a, b) => { const ia = order.indexOf(a.id); const ib = order.indexOf(b.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.nextCost - b.nextCost; });
      h = R.buyMeta(h, offers[0].id);
    }
  }
  return h;
}

/**
 * The engine's next action after its bar edits (as qa/browser/policy.mjs expAction): the bar edits are applied to a scratch
 * copy only, so the action is the one the game's autoplay would take next.
 */
function engineNext(s) {
  let c = s;
  for (let k = 0; k < 2 * (C.SPELL_BAR_SLOTS + C.ITEM_BAR_SLOTS); k++) {
    const a = R.autoAction(c);
    if (!a || (a.type !== 'SET_BAR' && a.type !== 'SET_ITEM_BAR')) return a;
    c = R.step(c, a).state;
  }
  return null;
}
/** The player after the engine's bar edits (its spell bar and item bar). */
function engineBars(s) {
  let c = s;
  for (let k = 0; k < 2 * (C.SPELL_BAR_SLOTS + C.ITEM_BAR_SLOTS); k++) {
    const a = R.autoAction(c);
    if (!a || (a.type !== 'SET_BAR' && a.type !== 'SET_ITEM_BAR')) break;
    c = R.step(c, a).state;
  }
  return c.player;
}
/**
 * Ablation arms (planner base, parts swapped for the game's autoplay): talent = the engine's talent pick (EA.AUTO_TREE);
 * bar = the engine's spell bar and item bar; map = the engine's expedition map, hub and start camp policy (no hub contract
 * of the planner); node, hub, prep = the three parts of map alone; vendor = the engine's vendor and trainer stages.
 */
function ablate(spec, abl) {
  if (abl.includes('talent')) spec.talent = (s) => { const a = R.autoAction(s); return a && a.type === 'SPEND_TALENT' ? a.talentId : null; };
  if (abl.includes('bar')) { spec.bar = (s) => engineBars(s).bar.slice(); spec.itemBar = (s) => engineBars(s).itemBar.slice(); }
  if (abl.includes('node')) spec.map = (s) => engineNext(s);
  if (abl.includes('hub')) { spec.hub = (s) => engineNext(s); spec.hubContract = null; }
  if (abl.includes('prep')) spec.prep = (s) => engineNext(s);
  if (abl.includes('map')) { spec.map = (s) => engineNext(s); spec.hub = (s) => engineNext(s); spec.prep = (s) => engineNext(s); spec.hubContract = null; }
  if (abl.includes('vendor')) { spec.vendor = (s) => R.autoAction(s); spec.trainer = (s) => R.autoAction(s); }
}

/** One run with the named driver; returns the record. */
function playOne({ bot: botName, cls, seed, hero, risk, tree, profile, abl = [] }) {
  Object.assign(C.GATES, gatesFor({ legacy: true, oruvathLegacy: true, economyV2: true }));
  const prof = makeProfile(cls, hero, profile);
  const pet = cls === 'hunter' ? SIM.DEFAULT_PET : null;
  const s = newRunFor({ classId: cls, petId: pet, seed, profile: prof, mapMode: 'expedition', prep: true });
  let choose;
  if (botName === 'planner') {
    const b = createBot('planner', { classId: cls, seed, risk, tree });
    ablate(b.spec, abl);
    choose = (st) => b.choose(st);
  } else {
    const pre = createActions({ classId: cls, petId: pet, seed });
    // --abl talent (autoplay base): the sim's standard build of the planner's tree (sim/lib/policy.mjs standardTalent) in place of
    // the engine's EA.AUTO_TREE pick; spent before the QA policy's own housekeeping sees the free points
    choose = (st) => {
      if (st.phase === 'CREATE' && pre.length) return pre.shift();
      if (abl.includes('talent') && st.player && !st.fight && !(st.loot && st.loot.length) && ['ZONE_HUB', 'MAP', 'NODE', 'CAMP'].includes(st.phase) && R.talentPointsFree(st) > 0) {
        const id = standardTalent(st, tree);
        if (id) return { type: 'SPEND_TALENT', talentId: id };
      }
      return playerAction(st, { manual: false });
    };
  }
  const rec = {
    cls, seed, bot: botName, hero, startPower: null, startGear: null, fights: [], zones: [], out: null, death: null, err: null,
    endPower: null, heroEnd: null,
  };
  let cur = null;
  let n = 0;
  let lastZone = -1;
  while (s.phase !== 'ENDED') {
    if (n++ >= MAX_ACTIONS) { rec.err = 'stuck'; break; }
    if (s.phase === 'ZONE_HUB' && s.zone && s.zone.z !== lastZone && !s.zone.camp) {
      lastZone = s.zone.z;
      rec.zones.push({ z: s.zone.z, p: s.player.level, ilvl: r1(gearIlvl(s)), dr: count(s, HEAL), hp: r1(100 * s.player.hp / s.player.d.maxHp), band: s.zone.band ?? null });
    }
    if (rec.startPower === null && s.player && s.player.level) { rec.startPower = s.player.level; rec.startGear = r1(gearIlvl(s)); }
    let a;
    try { a = choose(s); } catch (e) { rec.err = `bot: ${e.message}`; break; }
    if (!a) { rec.err = 'no action'; break; }
    let events;
    try { events = R.stepInPlace(s, a); } catch (e) { rec.err = `engine: ${e.message} on ${JSON.stringify(a)} in ${s.phase}`; break; }
    for (const e of events) {
      if (e.t === 'fight' && s.fight) {
        const f = s.fight;
        const en = f.enemies.map((x) => ({ n: x.name, t: x.tid, l: x.level, k: x.kind, a: x.arch }));
        const nodeType = f.kind === 'boss' ? 'boss' : f.kind === 'camp' ? 'camp' : s.node ? s.node.type : null;
        cur = {
          z: s.zone ? s.zone.z : null, nt: nodeType, fk: f.kind, ring: s.node && s.zone && s.zone.nodes && s.node.id !== undefined && s.zone.nodes[s.node.id] ? s.zone.nodes[s.node.id].ring : null,
          en, maxL: Math.max(...en.map((x) => x.l)), P: s.player.level, hp0: r1(100 * s.player.hp / s.player.d.maxHp),
          dr0: count(s, HEAL), il: r1(gearIlvl(s)), minHp: 100, res: 0, out: null, rounds: 0, dr1: null, engage: !!f.engage, seq: rec.fights.length,
        };
        rec.fights.push(cur);
      }
      if (e.t === 'resurrect' && cur) cur.res += 1;
    }
    if (cur && s.fight) { cur.minHp = Math.min(cur.minHp, r1(100 * s.player.hp / s.player.d.maxHp)); cur.rounds = s.fight.round; }
    if (cur) {
      const end = events.find((e) => e.t === 'victory' || e.t === 'fled' || (e.t === 'death' && e.u === 'player') || e.t === 'rescue');
      if (end || (!s.fight && cur.out === null)) {
        cur.out = end ? (end.t === 'victory' ? 'win' : end.t) : 'gone';
        cur.minHp = Math.min(cur.minHp, r1(100 * s.player.hp / s.player.d.maxHp));
        cur.dr1 = count(s, HEAL);
        cur = null;
      }
    }
  }
  rec.endPower = s.player.level;
  rec.heroEnd = s.player.heroLevel;
  rec.out = s.death ? 'death' : s.phase === 'ENDED' && s.summary ? 'end' : 'end';
  if (s.death) {
    rec.death = { ...s.death, P: s.player.level, dr: count(s, HEAL), il: r1(gearIlvl(s)), hp: r1(100 * s.player.hp / s.player.d.maxHp), gold: s.player.gold };
  }
  // outcome from the summary when there is one
  try { const sm = R.summary(s); rec.out = sm && sm.outcome ? sm.outcome : rec.out; rec.xp = sm && sm.xpGained; } catch { /* no summary */ }
  rec.talents = Object.values(s.player.talents || {}).reduce((x, y) => x + y, 0);
  return rec;
}

function runCell(opts, cls) {
  const trees = defaultTrees('P0');
  const tree = opts.tree !== undefined ? (String(opts.tree).includes(':') ? Number(Object.fromEntries(String(opts.tree).split(',').map((x) => x.split(':')))[cls]) : Number(opts.tree)) : trees[cls];
  const risk = opts.riskTable ? opts.riskTable[cls] : undefined;
  const out = [];
  for (const seed of opts.seeds) out.push(playOne({ bot: opts.bot, cls, seed, hero: opts.hero, risk, tree, profile: opts.profile, abl: opts.abl }));
  return out;
}

async function cmdRun(args) {
  const bot = args.bot || 'autoplay';
  const hero = Number(args.hero || 20);
  const runs = Number(args.runs || 40);
  const s0 = Number(args['seed-start'] || 1);
  const classes = args.classes ? args.classes.split(',') : CLASSES;
  const out = resolve(args.out || join(HERE, 'out', 'h20deaths'));
  mkdirSync(out, { recursive: true });
  const workers = Number(args.workers || Math.min(cpus().length, classes.length));
  const jobs = classes.map((cls) => ({ cls }));
  let next = 0;
  const results = {};
  await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const res = await new Promise((resolveP, reject) => {
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { bot, hero, seeds: Array.from({ length: runs }, (_, i) => s0 + i), cls: job.cls, tree: args.tree, profile: args.profile || 'later', abl: args.abl ? args.abl.split(',') : [], riskFile: args.risk || null } });
        w.on('message', resolveP); w.on('error', reject);
      });
      results[job.cls] = res;
      writeFileSync(join(out, `${bot}-${job.cls}.jsonl`), res.map((r) => JSON.stringify(r)).join('\n') + '\n');
    }
  }));
  console.log(`wrote ${out} (${classes.join(', ')}; ${runs} runs each)`);
}

if (!isMainThread) {
  // worker: one class
  const { bot, hero, seeds, cls, tree, profile, riskFile, abl } = workerData;
  let riskTable = null;
  if (bot === 'planner') {
    const lo = Math.floor((hero - 1) / 5) * 5 + 1;
    const f = riskFile ? resolve(riskFile) : join(HERE, 'tables', 'legacy-hx', `risk-H${String(lo).padStart(2, '0')}-${String(lo + 4).padStart(2, '0')}.json`);
    const obs = JSON.parse(readFileSync(f, 'utf8'));
    const { buildTable } = await import('./lib/risk.mjs');
    riskTable = { [cls]: buildTable(obs[cls]) }; // frozen table: the batch's own refresh (BAL.SIM_RISK_REFRESH) is not repeated
  }
  const res = runCell({ bot, hero, seeds, tree, profile, riskTable, abl }, cls);
  parentPort.postMessage(res);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parse(rest);
  if (cmd === 'run') await cmdRun(args);
  else if (cmd === 'tables') { const { tables } = await import('./lib/h20tables.mjs'); console.log(tables(args._)); }
  else if (cmd === 'arms') { const { armsTable } = await import('./lib/h20tables.mjs'); console.log(armsTable(args._)); }
  else { console.error('usage: legacy-h20deaths.mjs run|tables'); process.exit(2); }
}
