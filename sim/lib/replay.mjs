// Fight replay harness (combat-v2.md 11 "Fight replay harness", B50). A snapshot is the state at the first player
// decision of a fight (round 1, before the action), fight stream included; a replay plays the same fight from a
// copy of it with policy X in rounds 1..OPEN_ROUNDS and policy Y after, until the fight ends. Same snapshot and
// same policies give the same result (the masher replayed with the masher reproduces its own fight exactly; tested
// in qa/sim/combat2.test.mjs).
// B50: for every non-boss fight that ends a masher run in death, the runner (sim/lib/runner.mjs, cell.replay)
// replays it three times: X = opener (its first OPEN_ROUNDS actions), Y = masher (the B50 measure); X = autoplay,
// Y = masher (diagnostic: any sensible opening); X = Y = masher (control: must die again).
// Opening pairs (diagnostic for B48, cell.pairs): every non-boss fight of an autoplay run replayed with autoplay's,
// the opener's and the masher's first OPEN_ROUNDS rounds, autoplay after: the opening's value on the same fights,
// without the run-level path effects (the autoplay replay is the live fight).
// Think fights (mash report docs/reports/mash-2026-11-11.md, cell.think): every non-boss fight of a run replayed with
// the acting bot's own combat policy (the live fight again), the opener's first OPEN_ROUNDS rounds then autoplay, and
// autoplay; the same character, fight and fight stream for all three.
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
 * { outcome (OUTCOME code), rounds, res (resurrects used), hp (HP fraction at the fight's end before post-fight regen,
 * as the recorder's fx; 0 on a death), pot (potions used) }.
 */
export function replayFight(snap, x, y, openRounds = C2.OPEN_ROUNDS, maxSteps = 400) {
  const c = fightClone(snap);
  const pot0 = c.stats.potionsUsed;
  let res = 0;
  let outcome = null;
  let rounds = 0;
  let hpEnd = 0;
  for (let n = 0; n < maxSteps && c.fight; n++) {
    const a = c.fight.round <= openRounds ? x(c) : y(c);
    rounds = c.fight.round;
    let hp = c.player.hp;
    const maxHp0 = c.player.d.maxHp;
    let lvl = false;
    for (const e of R.stepInPlace(c, a)) {
      if (e.t === 'levelUp' && !lvl) { hp += c.player.d.maxHp - maxHp0; lvl = true; } // as the recorder (fx)
      else if (e.t === 'damage' && e.dst === 'player') hp -= e.amount;
      else if (e.t === 'heal' && e.dst === 'player') hp += e.amount;
      else if (e.t === 'resurrect') { res++; hp = e.hp; }
      else if (e.t === 'victory' || e.t === 'fled') {
        outcome = e.t === 'victory' ? OUTCOME.victory : OUTCOME.fled;
        if (e.t === 'victory') rounds = e.rounds;
        hpEnd = Math.max(0, hp) / c.player.d.maxHp;
      } else if (e.t === 'runEnd' && e.outcome === 'death') outcome = OUTCOME.death;
    }
  }
  if (outcome === null) throw new Error(`replay: fight did not end in ${maxSteps} steps`);
  return { outcome, rounds, res, hp: outcome === OUTCOME.death ? 0 : hpEnd, pot: c.stats.potionsUsed - pot0 };
}

/** The opener as a fresh combat policy for one replayed fight; its bot stream is hash(seed, 'replay', fight). */
export function openerPolicy(seed, fightNo) {
  const rng = new BotRng(hash32(`${seed}|replay|${fightNo}`));
  const st = { fights: -1, n0: 0, plan: null };
  return (s) => openerChoice(s, rng, st);
}

/**
 * Opening pairs of one fight: [fx index, fight kind code, then per opening (autoplay, opener, masher; autoplay after
 * round OPEN_ROUNDS): outcome code, HP at the end in per mille, potions used].
 */
export function replayOpenings(snap, seed, fxIndex) {
  const fightNo = snap.stats.fights;
  const auto = (s) => R.autoAction(s);
  const out = [fxIndex, FK[snap.fight.kind]];
  for (const x of [auto, openerPolicy(seed, fightNo), mashChoice]) {
    const r = replayFight(snap, x, auto);
    out.push(r.outcome, Math.round(r.hp * 1000), r.pot);
  }
  return out;
}

/**
 * Think-fight replays of one fight (cell.think): [fx index, fight kind code, HP at the start in per mille, then per
 * policy (own: the acting bot's combat policy throughout; opener: its first OPEN_ROUNDS rounds, autoplay after;
 * autoplay throughout): outcome code, HP at the end in per mille (0 on a death), potions used, resurrects used].
 * own must be a stateless combat policy (onebutton, masher, autoplay).
 */
export function replayThink(snap, seed, fxIndex, own) {
  const fightNo = snap.stats.fights;
  const auto = (s) => R.autoAction(s);
  const out = [fxIndex, FK[snap.fight.kind], Math.round((snap.player.hp / snap.player.d.maxHp) * 1000)];
  for (const [x, y] of [[own, own], [openerPolicy(seed, fightNo), auto], [auto, auto]]) {
    const r = replayFight(snap, x, y);
    out.push(r.outcome, Math.round(r.hp * 1000), r.pot, r.res);
  }
  return out;
}

/**
 * Rotation replays of one fight (cell.thinkMash, the mash report's rotation column): [fx index, fight kind code, HP at the
 * start in per mille, then for own (the acting bot's policy throughout) and the masher (throughout): outcome code, HP at
 * the end in per mille, potions used, resurrects used]. Cheap (no search), so it runs on more seeds than replayThink.
 */
export function replayMash(snap, fxIndex, own) {
  const out = [fxIndex, FK[snap.fight.kind], Math.round((snap.player.hp / snap.player.d.maxHp) * 1000)];
  for (const x of [own, mashChoice]) {
    const r = replayFight(snap, x, x);
    out.push(r.outcome, Math.round(r.hp * 1000), r.pot, r.res);
  }
  return out;
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
