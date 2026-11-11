// One run from CREATE to ENDED with a bot, and the replay check (B35). The bot only chooses; the engine
// (stepInPlace on a state the runner owns) applies. Errors and stuck runs are recorded (B36), never thrown.
// Expedition cells (cell.map 'expedition', cell.vision, cell.dimming; expedition.md 10-11, MILESTONES 2b.4): the
// record's `xs` holds C_step (cell.oracle: the planner's fog choice against the oracle's at every map decision; the
// acting bot's action is what is played) and the close-call zones (B43).
import { R, newRunFor, hash32 } from './engine.mjs';
import { BAL, SIM } from './params.mjs';
import { createBot } from '../bots/index.mjs';
import { Recorder } from './recorder.mjs';
import { buildProfile } from './profiles.mjs';
import { snapshot, replayDeath, replayOpenings } from './replay.mjs';
import { oracleMap, planExpMap, plannerHourMult, plannerHeat } from '../bots/planner.mjs';
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
 * opts: { log: keep the action log, hash: store the final state hash, profile: profile object instead of
 * cell.prof, maxActions }. Returns { record, state }.
 */
export function runWithBot(cell, seed, risk, opts = {}) {
  const profile = opts.profile || buildProfile(cell.prof, cell.cls);
  const bot = createBot(cell.bot, { classId: cell.cls, seed, risk, tree: cell.tree, style: cell.style, variant: cell.variant });
  const s = newRunFor({ classId: cell.cls, petId: cellPet(cell), seed, profile, mapMode: cell.map || null, vision: cell.vision || null, dimming: cell.dimming === false ? false : null });
  // Expedition measures (expedition.md 11.1; MILESTONES 2b.4). cell.oracle: at every map decision of the acting bot,
  // the planner's fog choice and the oracle's full-information choice from the same state (C_step = agree / n, B41);
  // neither changes the run. Close calls (B43): zones in which the front came within one hop of the player.
  const xs = s.mapMode === 'expedition' || cell.map === 'expedition' ? { cs: [0, 0], cz: [] } : null;
  const oHm = plannerHourMult(cell.variant);
  const oHeat = plannerHeat(cell.variant);
  const oRisk = risk || priorTable();
  const rec = new Recorder({ trainCheck: opts.trainCheck !== false });
  const log = opts.log ? [] : null;
  const max = opts.maxActions || BAL.MAX_ACTIONS_PER_RUN;
  const t0 = performance.now();
  let n = 0;
  let err = null;
  let snap = null;
  let snapFight = -1;
  const rep = cell.replay ? [] : null;
  const pr = cell.pairs ? [] : null;
  while (s.phase !== 'ENDED') {
    if (n >= max) { err = `stuck: ${max} actions without END_RUN (phase ${s.phase})`; break; }
    if ((rep || pr) && s.fight && s.fight.kind !== 'boss' && s.stats.fights !== snapFight) {
      snap = snapshot(s);
      snapFight = s.stats.fights;
      if (pr) { try { pr.push(replayOpenings(snap, seed, rec.fx.length)); } catch (e) { err = `pairs: ${e.message}`; break; } }
    }
    let a;
    try { a = bot.choose(s); } catch (e) { err = `bot ${cell.bot}: ${e.message}`; break; }
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
    if (rep && snap && events.some((e) => e.t === 'runEnd' && e.outcome === 'death') && snap.stats.fights === snapFight && s.death && s.death.nodeType !== 'boss') {
      try { rep.push(replayDeath(snap, seed, rec.fx.length - 1)); } catch (e) { err = `replay: ${e.message}`; break; }
    }
    n++;
  }
  const ms = performance.now() - t0;
  const bm = bot.memory ? { plans: bot.memory.plans || 0, replans: bot.memory.replans || 0, auto: bot.memory.autoPlans || 0, evals: bot.memory.evals || 0 } : null;
  const record = rec.finish(s, {
    ...cell, seed, steps: n, err, ms: Math.round(ms * 10) / 10, log, rep, pr, bm, xs,
    hash: opts.hash ? hash32(R.serialize(s)) : undefined,
  });
  return { record, state: s };
}

export function playRun(cell, seed, risk, opts = {}) {
  return runWithBot(cell, seed, risk, opts).record;
}

/** Replay a run from its seed and action log with the pure step; returns the final state hash. */
export function replayHash(cell, seed, log, profile = null) {
  const prof = profile || buildProfile(cell.prof, cell.cls);
  let s = newRunFor({ classId: cell.cls, petId: cellPet(cell), seed, profile: prof, mapMode: cell.map || null, vision: cell.vision || null, dimming: cell.dimming === false ? false : null });
  for (const a of log) s = R.step(s, a).state;
  return hash32(R.serialize(s));
}
