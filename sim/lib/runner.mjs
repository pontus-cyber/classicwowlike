// One run from CREATE to ENDED with a bot, and the replay check (B35). The bot only chooses; the engine
// (stepInPlace on a state the runner owns) applies. Errors and stuck runs are recorded (B36), never thrown.
import { R, newRunFor, hash32 } from './engine.mjs';
import { BAL, SIM } from './params.mjs';
import { createBot } from '../bots/index.mjs';
import { Recorder } from './recorder.mjs';
import { buildProfile } from './profiles.mjs';

/** Hunter pet a cell starts with: preset for every bot but random (random picks with SELECT_PET). */
export function cellPet(cell) {
  if (cell.cls !== 'hunter' || cell.bot === 'random') return null;
  return cell.pet || SIM.DEFAULT_PET;
}

/**
 * cell: { bot, cls, prof, tree, style, variant, pet } ; seed: run seed ; risk: lookup table (risk.mjs).
 * opts: { log: keep the action log, hash: store the final state hash, profile: profile object instead of
 * cell.prof, maxActions }. Returns { record, state }.
 */
export function runWithBot(cell, seed, risk, opts = {}) {
  const profile = opts.profile || buildProfile(cell.prof, cell.cls);
  const bot = createBot(cell.bot, { classId: cell.cls, seed, risk, tree: cell.tree, style: cell.style, variant: cell.variant });
  const s = newRunFor({ classId: cell.cls, petId: cellPet(cell), seed, profile });
  const rec = new Recorder({ trainCheck: opts.trainCheck !== false });
  const log = opts.log ? [] : null;
  const max = opts.maxActions || BAL.MAX_ACTIONS_PER_RUN;
  const t0 = performance.now();
  let n = 0;
  let err = null;
  while (s.phase !== 'ENDED') {
    if (n >= max) { err = `stuck: ${max} actions without END_RUN (phase ${s.phase})`; break; }
    let a;
    try { a = bot.choose(s); } catch (e) { err = `bot ${cell.bot}: ${e.message}`; break; }
    const b = rec.before(s);
    let events;
    try { events = R.stepInPlace(s, a); } catch (e) { err = `engine rejected ${JSON.stringify(a)} in ${s.phase}: ${e.message}`; break; }
    if (log) log.push(a);
    rec.after(s, a, events, b);
    n++;
  }
  const ms = performance.now() - t0;
  const record = rec.finish(s, {
    ...cell, seed, steps: n, err, ms: Math.round(ms * 10) / 10, log,
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
  let s = newRunFor({ classId: cell.cls, petId: cellPet(cell), seed, profile: prof });
  for (const a of log) s = R.step(s, a).state;
  return hash32(R.serialize(s));
}
