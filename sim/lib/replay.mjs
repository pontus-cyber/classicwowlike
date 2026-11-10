// Fight replay harness (combat-v2.md 11 "Fight replay harness", B50). A snapshot is the state at the first player
// decision of a fight (round 1, before the action), fight stream included; a replay plays the same fight from a
// copy of it with policy X in rounds 1..OPEN_ROUNDS and policy Y after, until the fight ends. Same snapshot and
// same policies give the same result (the masher replayed with the masher reproduces its own fight exactly; tested
// in qa/sim/combat2.test.mjs).
// B50: for every non-boss fight that ends a masher run in death, the runner (sim/lib/runner.mjs, cell.replay)
// replays it three times: X = opener (its first OPEN_ROUNDS actions), Y = masher (the B50 measure); X = autoplay,
// Y = masher (diagnostic: any sensible opening); X = Y = masher (control: must die again).
import { R, hash32, BotRng } from './engine.mjs';
import { C2 } from './params.mjs';
import { fightClone } from './clone.mjs';
import { FIGHT_KINDS } from './recorder.mjs';
import { mashChoice } from '../bots/masher.mjs';
import { openerChoice } from '../bots/opener.mjs';

const FK = Object.fromEntries(FIGHT_KINDS.map((k, i) => [k, i]));
/** Outcome codes of a replayed fight, as in the recorder's fx: 1 won, 2 fled, 0 the run ended in death. */
export const OUTCOME = { victory: 1, fled: 2, death: 0 };

/** Snapshot of the live state at a fight's first decision (a look-ahead copy; the live state is not changed). */
export function snapshot(s) {
  return fightClone(s);
}

/**
 * Replay a fight: x, y are combat policies (state) -> action; x plays rounds 1..openRounds, y the rest. Returns
 * { outcome (OUTCOME code), rounds, res (resurrects used), hp (HP fraction at the end, 0 on a death), pot (potions
 * used) }.
 */
export function replayFight(snap, x, y, openRounds = C2.OPEN_ROUNDS, maxSteps = 400) {
  const c = fightClone(snap);
  const pot0 = c.stats.potionsUsed;
  let res = 0;
  let outcome = null;
  let rounds = 0;
  for (let n = 0; n < maxSteps && c.fight; n++) {
    const a = c.fight.round <= openRounds ? x(c) : y(c);
    rounds = c.fight.round;
    for (const e of R.stepInPlace(c, a)) {
      if (e.t === 'resurrect') res++;
      else if (e.t === 'victory') { outcome = OUTCOME.victory; rounds = e.rounds; }
      else if (e.t === 'fled') outcome = OUTCOME.fled;
      else if (e.t === 'runEnd' && e.outcome === 'death') outcome = OUTCOME.death;
    }
  }
  if (outcome === null) throw new Error(`replay: fight did not end in ${maxSteps} steps`);
  return { outcome, rounds, res, hp: outcome === OUTCOME.death ? 0 : c.player.hp / c.player.d.maxHp, pot: c.stats.potionsUsed - pot0 };
}

/** The opener as a fresh combat policy for one replayed fight; its bot stream is hash(seed, 'replay', fight). */
export function openerPolicy(seed, fightNo) {
  const rng = new BotRng(hash32(`${seed}|replay|${fightNo}`));
  const st = { fights: -1, n0: 0, plan: null };
  return (s) => openerChoice(s, rng, st);
}

/**
 * B50 replays of one masher death: [fx index, fight kind code, opener-then-masher, autoplay-then-masher,
 * masher-then-masher] (outcome codes).
 */
export function replayDeath(snap, seed, fxIndex) {
  const fightNo = snap.stats.fights;
  const kind = FK[snap.fight.kind];
  const op = replayFight(snap, openerPolicy(seed, fightNo), mashChoice);
  const au = replayFight(snap, (s) => R.autoAction(s), mashChoice);
  const ma = replayFight(snap, mashChoice, mashChoice);
  return [fxIndex, kind, op.outcome, au.outcome, ma.outcome];
}
