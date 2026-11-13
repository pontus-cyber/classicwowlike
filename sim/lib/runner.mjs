// One run from CREATE to ENDED with a bot, and the replay check (B35). The bot only chooses; the engine
// (stepInPlace on a state the runner owns) applies. Errors and stuck runs are recorded (B36), never thrown.
// Expedition cells (cell.map 'expedition', cell.vision, cell.dimming; expedition.md 10-11, MILESTONES 2b.4): the
// record's `xs` holds C_step (cell.oracle: the planner's fog choice against the oracle's at every map decision; the
// acting bot's action is what is played), C_route (cell.route: `cr` = zones whose realised route equals the oracle's
// route from the same zone-entry state, played on a copy by oracleRoute) and the close-call zones (B43).
// Start camp and contracts (cell.prep: newRun prep, expedition.md 2-3; cell.prepPolicy: the B40 overrides 'none' and
// 'random'; cell.expMeta: the expedition meta entries of 8.2 as profile unlocks; cell.prepForce / prepBan: start-camp
// options the planner family buys first / never, M2b v10 cell 9): the record's `ct` (recorder.mjs). M2b v11: cell.metaDrop
// (catalogue entries removed from the profile: B42's no-vision cell, the row 8 attribution arm), cell.beastcallGated
// (row 8 arm: Beastcall Horn cooldown BEASTCALL_HORN_CD_GATED). M2b v12: cell.ricochetGated (row 5 arm, D104: Ricochet
// Bolt's bounce RICOCHET_BOUNCE_FRAC_GATED). D128: cell.campOptions (the start camp's options: null = the engine's
// C.PREP_CAMP_OPTIONS as built, 'all' = every option as before D128, or a list of ids; setCampOptions).
import { C, R, newRunFor, withExpMeta, hash32, gatesFor, campOptionsFor, CAMP_LIST } from './engine.mjs';
import { BAL, SIM } from './params.mjs';
import { createBot } from '../bots/index.mjs';
import { Recorder } from './recorder.mjs';
import { buildProfile, withoutMeta } from './profiles.mjs';
import { snapshot, replayDeath, replayOpenings, replayThink, replayMash } from './replay.mjs';
import { oracleMap, planExpMap, plannerHourMult, plannerHeat, createPlannerBot } from '../bots/planner.mjs';
import { CONTENT } from './engine.mjs';
import { priorTable } from './risk.mjs';

/** Hunter pet a cell starts with: preset for every bot but random (random picks with SELECT_PET). */
export function cellPet(cell) {
  if (cell.cls !== 'hunter' || cell.bot === 'random') return null;
  return cell.pet || SIM.DEFAULT_PET;
}

/**
 * cell: { bot, cls, prof, tree, style, variant, pet, replay } ; seed: run seed ; risk: lookup table (risk.mjs).
 * cell.replay (combat-v2.md 11, B50): keep a snapshot at the first decision of every non-boss fight and, when such a
 * fight ends the run in death, replay it (sim/lib/replay.mjs); the record gets `rep`. cell.pairs (diagnostic): replay
 * every non-boss fight with autoplay's, the opener's and the masher's opening (replayOpenings); the record gets `pr`.
 * cell.think (mash report): replay every non-boss fight with the bot's own combat policy, the opener's opening then
 * autoplay, and autoplay (replayThink); the record gets `tk`. cell.thinkMash: the same fights with the bot's own policy
 * and the masher (replayMash); the record gets `tm`.
 * opts: { log: keep the action log, hash: store the final state hash, profile: profile object instead of
 * cell.prof, maxActions }. Returns { record, state }.
 */
export function runWithBot(cell, seed, risk, opts = {}) {
  const profile = opts.profile || withoutMeta(withExpMeta(buildProfile(cell.prof, cell.cls), cell.expMeta || null), cell.metaDrop || null);
  // M2b v11 row 8 (gated): the Beastcall Horn cooldown of the arm; the engine reads the field at each cast, so it is set
  // for every run (a worker plays runs of several cells).
  if (C.SPELL.beastcall_horn && C.BEASTCALL_HORN_CD_GATED !== undefined) C.SPELL.beastcall_horn.cd = cell.beastcallGated ? C.BEASTCALL_HORN_CD_GATED : C.BEASTCALL_HORN_CD;
  // M2b v12 row 5 (gated, D104): Ricochet Bolt's bounce of the arm, else the engine's value; set for every run for the same
  // reason (the engine and sim/lib/policy.mjs read SPELL.ricochet_bolt.bounceFrac at each use).
  if (C.SPELL.ricochet_bolt && C.RICOCHET_BOUNCE_FRAC_GATED !== undefined) C.SPELL.ricochet_bolt.bounceFrac = cell.ricochetGated ? C.RICOCHET_BOUNCE_FRAC_GATED : C.RICOCHET_BOUNCE_FRAC;
  setGates(cell.gates);
  setCampOptions(cell.campOptions);
  const bot = createBot(cell.bot, { classId: cell.cls, seed, risk, tree: cell.tree, style: cell.style, variant: cell.variant, ...(cell.prepPolicy ? { prepPolicy: cell.prepPolicy } : {}), ...(cell.prepForce ? { prepForce: cell.prepForce } : {}), ...(cell.prepBan ? { prepBan: cell.prepBan } : {}) });
  const s = newRunFor({ classId: cell.cls, petId: cellPet(cell), seed, profile, mapMode: cell.map || null, vision: cell.vision || null, dimming: cell.dimming === false ? false : null, prep: !!cell.prep, tutorial: !!cell.guided });
  // Expedition measures (expedition.md 11.1; MILESTONES 2b.4). cell.oracle: at every map decision of the acting bot,
  // the planner's fog choice and the oracle's full-information choice from the same state (C_step = agree / n, B41);
  // neither changes the run. Close calls (B43): zones in which the front came within one hop of the player.
  const xs = s.mapMode === 'expedition' || cell.map === 'expedition' ? { cs: [0, 0], cz: [] } : null;
  const oHm = plannerHourMult(cell.variant);
  const oHeat = plannerHeat(cell.variant);
  const oRisk = risk || priorTable();
  // C_route (B41, cell.route): at each zone's arrival the oracle plays the zone on a copy (oracleRoute); the planner's
  // realised route in the zone (nodes entered, exit) is compared with it when the zone ends.
  let zr = null;
  if (xs && cell.route) xs.cr = [0, 0];
  const endZone = () => {
    if (!zr) return;
    xs.cr[1] += 1;
    if (zr.exit === zr.o.exit && zr.nodes.join(',') === zr.o.nodes.join(',')) xs.cr[0] += 1;
    zr = null;
  };
  const rec = new Recorder({ trainCheck: opts.trainCheck !== false });
  const log = opts.log ? [] : null;
  const max = opts.maxActions || BAL.MAX_ACTIONS_PER_RUN;
  const t0 = performance.now();
  let n = 0;
  let err = null;
  let snap = null;
  let snapFight = -1;
  let gfb = 0;
  const rep = cell.replay ? [] : null;
  const pr = cell.pairs ? [] : null;
  const tk = cell.think ? [] : null;
  const tm = cell.thinkMash ? [] : null;
  const own = tk || tm ? bot.spec.combat : null;
  while (s.phase !== 'ENDED') {
    if (n >= max) { err = `stuck: ${max} actions without END_RUN (phase ${s.phase})`; break; }
    if ((rep || pr || tk || tm) && s.fight && s.fight.kind !== 'boss' && s.stats.fights !== snapFight) {
      snap = snapshot(s);
      snapFight = s.stats.fights;
      if (pr) { try { pr.push(replayOpenings(snap, seed, rec.fx.length)); } catch (e) { err = `pairs: ${e.message}`; break; } }
      if (tk) { try { tk.push(replayThink(snap, seed, rec.fx.length, own)); } catch (e) { err = `think: ${e.message}`; break; } }
      if (tm) { try { tm.push(replayMash(snap, rec.fx.length, own)); } catch (e) { err = `think mash: ${e.message}`; break; } }
    }
    let a;
    try { a = bot.choose(s); } catch (e) { err = `bot ${cell.bot}: ${e.message}`; break; }
    // Guided run (report balance-2026-11-13c): the sim bots do not read the guide's barred node and closed Roads; an
    // action the guide refuses is replaced by the engine's autoplay action (which honours them), counted in gfb.
    if (cell.guided && s.tutorial && !R.isLegal(s, a)) { a = R.autoAction(s); gfb++; }
    if (xs && s.phase === 'MAP' && !s.fight && !s.loot.length && s.mapMode === 'expedition') {
      const v = R.mapView(s);
      if (v && (v.nodes[v.pos].dimmed || v.nodes[v.pos].nb.some((id) => v.nodes[id].dimmed)) && !xs.cz.includes(v.z)) xs.cz.push(v.z);
      if (cell.oracle && (a.type === 'MOVE' || a.type === 'PASS_THROUGH' || a.type === 'TAKE_ROAD' || a.type === 'RING_BELL')) {
        try {
          const f = cell.bot === 'planner' ? a : planExpMap(s, oRisk, cell.style || 'balanced', oHm, oHeat).action;
          const o = oracleMap(s, oRisk, cell.style || 'balanced', oHm, oHeat).action;
          xs.cs[1] += 1;
          if (f.type === o.type && f.nodeId === o.nodeId) xs.cs[0] += 1;
        } catch (e) { err = `oracle: ${e.message}`; break; }
      }
    }
    const b = rec.before(s, a);
    let events;
    try { events = R.stepInPlace(s, a); } catch (e) { err = `engine rejected ${JSON.stringify(a)} in ${s.phase}: ${e.message}`; break; }
    if (log) log.push(a);
    rec.after(s, a, events, b);
    if (xs && cell.route) {
      for (const e of events) {
        if (e.t === 'node' && zr && typeof e.id === 'number') zr.nodes.push(e.id);
        if (e.t === 'travel' && zr) zr.exit = e.by === 'bell' ? 'bell' : `road${e.node}`;
      }
      if (events.some((e) => e.t === 'zone' || e.t === 'camp') || s.phase === 'ENDED' || s.phase === 'SUMMARY') endZone();
      if (events.some((e) => e.t === 'zone') && s.mapMode === 'expedition') {
        try { zr = { nodes: [], exit: null, o: oracleRoute(s, cell, oRisk) }; } catch (e) { err = `oracle route: ${e.message}`; break; }
      }
    }
    if (rep && snap && events.some((e) => e.t === 'runEnd' && e.outcome === 'death') && snap.stats.fights === snapFight && s.death && s.death.nodeType !== 'boss') {
      try { rep.push(replayDeath(snap, seed, rec.fx.length - 1)); } catch (e) { err = `replay: ${e.message}`; break; }
    }
    n++;
  }
  const ms = performance.now() - t0;
  const bm = bot.memory ? { plans: bot.memory.plans || 0, replans: bot.memory.replans || 0, auto: bot.memory.autoPlans || 0, evals: bot.memory.evals || 0 } : null;
  const record = rec.finish(s, {
    ...cell, seed, steps: n, err, ms: Math.round(ms * 10) / 10, log, rep, pr, tk, tm, bm, xs, gfb,
    hash: opts.hash ? hash32(R.serialize(s)) : undefined,
  });
  return { record, state: s };
}

/**
 * The oracle's route through the current zone from state s (just arrived at the hub), played on a copy with the
 * oracle as the acting bot (diagnostic only, B41 C_route): nodes entered in order and the exit ('road<id>' or 'bell';
 * null when the run ends in the zone).
 */
export function oracleRoute(s0, cell, risk) {
  const s = R.deserialize(R.serialize(s0), CONTENT);
  const bot = createPlannerBot({ classId: cell.cls, risk, tree: cell.tree, style: cell.style || 'balanced', variant: cell.variant || null, oracle: true });
  const nodes = [];
  let exit = null;
  for (let i = 0; i < BAL.MAX_ACTIONS_PER_RUN && s.phase !== 'ENDED' && s.phase !== 'SUMMARY'; i++) {
    const events = R.stepInPlace(s, bot.choose(s));
    let left = false;
    for (const e of events) {
      if (e.t === 'node' && typeof e.id === 'number') nodes.push(e.id);
      if (e.t === 'travel') exit = e.by === 'bell' ? 'bell' : `road${e.node}`;
      if (e.t === 'zone' || e.t === 'camp') left = true;
    }
    if (left) break;
  }
  return { nodes, exit };
}

/**
 * The engine's switches (C.GATES: M2b v13 rows 5-6 rareHpMultZ1, firstMeetWindup; M2b v14 row 1 sapHold, passStealth)
 * as the cell asks (engine.mjs gatesFor): a cell without gates plays the engine's defaults (the game as built, M2b v14);
 * a cell with gates ({ key: true }) plays the named switches on and every other off. Set for every run, since a worker
 * plays runs of several cells. Engines without C.GATES are left alone.
 */
export function setGates(gates = null) {
  if (!C.GATES) {
    if (gates && Object.values(gates).some(Boolean)) throw new Error('cell.gates needs an engine with C.GATES (M2b v13)');
    return;
  }
  if (gates) for (const k of Object.keys(gates)) if (!(k in C.GATES)) throw new Error(`cell.gates: unknown gate ${k}`);
  Object.assign(C.GATES, gatesFor(gates));
}

/**
 * The start camp's options (D128: C.PREP_CAMP_OPTIONS) as the cell asks (engine.mjs campOptionsFor): null = the engine's
 * list as built, 'all' = every C.PREP_OPTION (the camp before D128), or the named ids. Set in place for every run (the
 * engine's BUY_PREP and R.prepView read the array at each call; a worker plays runs of several cells). An engine without
 * the list (before D128) offers every option: only null or 'all' are accepted there.
 */
export function setCampOptions(campOptions = null) {
  if (!CAMP_LIST) {
    if (campOptions && campOptions !== 'all') throw new Error('cell.campOptions needs an engine with C.PREP_CAMP_OPTIONS (D128)');
    return;
  }
  C.PREP_CAMP_OPTIONS.splice(0, C.PREP_CAMP_OPTIONS.length, ...campOptionsFor(campOptions));
}

export function playRun(cell, seed, risk, opts = {}) {
  return runWithBot(cell, seed, risk, opts).record;
}

/** Replay a run from its seed and action log with the pure step; returns the final state hash. */
export function replayHash(cell, seed, log, profile = null) {
  const prof = profile || withoutMeta(withExpMeta(buildProfile(cell.prof, cell.cls), cell.expMeta || null), cell.metaDrop || null);
  setGates(cell.gates);
  setCampOptions(cell.campOptions);
  let s = newRunFor({ classId: cell.cls, petId: cellPet(cell), seed, profile: prof, mapMode: cell.map || null, vision: cell.vision || null, dimming: cell.dimming === false ? false : null, prep: !!cell.prep, tutorial: !!cell.guided });
  for (const a of log) s = R.step(s, a).state;
  return hash32(R.serialize(s));
}
