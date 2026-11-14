// Intent track (rules 7.11, combat v2) and opening scripts (rules 7.12): every living enemy shows its next
// INTENT_TRACK_LEN actions. An entry is drawn from the fight stream when it enters the track and never later (the
// action pick, then the pet-aggro target); the head entry becomes the enemy's intent ("now") at the start of its turn,
// where control, Lay Trap, the summon HP trigger and the play conditions are applied. Enemies present at fight start
// play their archetype's opening script on turns 1..OPENING_TURNS and (elite, rare, dungeon boss) their signature
// ability on SIGNATURE_TURN (and SIGNATURE_TURN_2); combat v2.1: those signature entries are wind-ups (`windup` and
// `cast`), and a wind-up cancelled at its turn's start (control, a trap, Disrupt's trap) or replaced because SILENCED
// is answered (STAGGERED, damage.js).
// M2b v13 (rules 7.12, D105, D109): the SIGNATURE_TURN wind-up of an elite, rare or dungeon boss is its Deathblow
// (`deathblow`; a damaging one × DEATHBLOW_MULT); with GATES.firstMeetWindup a normal enemy met for the first time in a
// quest fight (`firstMeet`, combat.js) plays its turn-2 scripted action as a wind-up (no Deathblow); D149 (M3, draft): an
// enemy the guided zone's overlay marks does so on its turn `windupTurn` (ONB_WINDUP_TURN). M2b v14 (D112):
// deathblowType, the type alone for a map elite whose name is hidden.
// The end boss's entries are made by boss.js (rules 10.3). Every entry shows its target, estimate and (D52) the
// predicted `cancel`, recomputed each round (refreshTrack).
import {
  ARCHETYPE, ABILITY_TEMPLATE, PET, INTENT_TRACK_LEN, OPENING_TURNS, SIGNATURE_TURN, SIGNATURE_TURN_2,
  HEAVY_SCRIPT_MULT, CAST_SCRIPT_MULT, OPENING_SCRIPT, SCRIPT_ACTION, OFFBAL_DURATION, DEATHBLOW_MULT,
} from '../constants.js';
import { nextFloat, weightedIndex } from '../rng.js';
import { rnd } from './util.js';
import {
  snapshot, mitigation, addStatus, removeStatus, findSt, hasSt, petAlive, gainOffBalance, answerWindup,
} from './damage.js';
import { SHARD_ACTION, bossEntry } from './boss.js';

const SINGLE = ['hit', 'rend'];
/** Kinds that deal damage (rules 7.12, D60: only their pct takes the script multipliers; heals and shields keep theirs). */
const DAMAGING = ['hit', 'rend', 'cleave'];

/** The engage round (rules 7.10): round 1 of a fight that has one (every fight but the end boss). */
export const isEngageRound = (f) => !!(f && f.engage && f.round === 1);

/** An enemy's turn in the current round (rules 7.11): turn t is round turn0 + t - 1; below 1 before its turn 1. */
export const turnOf = (f, e) => f.round - e.turn0 + 1;
const roundOf = (e, t) => e.turn0 + t - 1;

/** Control statuses that cancel a now-entry (rules 7.11), in the order they are named on the intent. */
const CONTROL = ['STUN', 'FROZEN', 'HEXED', 'SAPPED'];
const CONTROL_INTENT = {
  STUN: { id: 'stunned', name: 'Stunned' }, FROZEN: { id: 'stunned', name: 'Stunned' },
  HEXED: { id: 'hexed', name: 'Hexed' }, SAPPED: { id: 'sapped', name: 'Sapped' },
};
/** The control status that cancels the enemy's action now, or null. */
export function controlOf(st) {
  for (const id of CONTROL) if (hasSt(st, id)) return id;
  return null;
}

/** Weighted pool of an enemy (rules 7.6): archetype actions, then its non-once template abilities (12.4). */
export function enemyActions(s, e) {
  if (e.kind === 'shard') return [SHARD_ACTION];
  const list = ARCHETYPE[e.arch].actions.slice();
  for (const id of e.abilities) {
    const ab = s.content.abilities[id];
    const T = ABILITY_TEMPLATE[ab.template];
    if (T.once) continue;
    list.push({
      id, name: ab.name, kind: T.kind, pct: ab.pct, tickPct: ab.tickPct, rounds: T.rounds, school: T.school,
      heavy: !!T.heavy, cast: !!T.cast, cd: ab.cd, w: T.weight, below: T.below, template: ab.template,
    });
  }
  return list;
}

/** The archetype's basic attack (the first action; Shards: their strike). */
export const basicAction = (e) => (e.kind === 'shard' ? SHARD_ACTION : ARCHETYPE[e.arch].actions[0]);

/** Living ally with the lowest HP fraction (rules 7.6 Mend, 7.12 Bolster). */
export function lowestHpAlly(s, e, includeSelf) {
  let best = null;
  for (const o of s.fight.enemies) {
    if (!o.alive || (!includeSelf && o.idx === e.idx)) continue;
    if (!best || o.hp / o.maxHp < best.hp / best.maxHp) best = o;
  }
  return best;
}

/** A guardian's ward (rules 7.12) while it lives, else null. */
export function wardOf(s, e) {
  const w = e.ward === null || e.ward === undefined ? null : s.fight.enemies[e.ward];
  return w && w.alive ? w.idx : null;
}

/**
 * Ward of a guardian (rules 7.12): the living ally with the lowest index that is not a guardian. Fixed when the
 * guardian enters the fight (at fight start, or when it is summoned).
 */
export function assignWard(f, g) {
  const w = f.enemies.find((o) => o.alive && o.idx !== g.idx && o.arch !== 'guardian');
  g.ward = w ? w.idx : null;
}

/**
 * Signature abilities (rules 7.12) of an elite, rare or dungeon boss: [the template ability with the highest pct
 * (ties: first listed), the dungeon boss's other template ability]. Abilities with `once` keep their HP triggers.
 */
export function signatures(s, e) {
  return signatureIds(s.content, e.kind, e.abilities);
}

/** signatures() of an enemy of variant `kind` with template abilities `abilities` (also for a template on the map). */
function signatureIds(content, kind, abilities) {
  if (kind !== 'elite' && kind !== 'rare' && kind !== 'dboss') return [null, null];
  const abs = abilities.filter((id) => !ABILITY_TEMPLATE[content.abilities[id].template].once);
  if (!abs.length) return [null, null];
  let best = abs[0];
  for (const id of abs) if ((content.abilities[id].pct || 0) > (content.abilities[best].pct || 0)) best = id;
  const other = kind === 'dboss' ? abs.find((id) => id !== best) || null : null;
  return [best, other];
}

/**
 * The Deathblow of enemy template tid as variant `variant` (rules 7.12, M2b v13; map tooltips, engine-api.md 6.2): its
 * signature ability played on SIGNATURE_TURN as a wind-up: { id, name, kind (the ability's kind), heavy, cast (the
 * ability's own flags), type ('heavy': also answered by a full dodge, WARD, an image or the pet; else 'cast': interrupt
 * or control it), damaging (hit, rend or cleave: its pct × DEATHBLOW_MULT) }, or null (not an elite, rare or dungeon
 * boss, or no ability that can be scripted).
 */
export function deathblowOf(content, tid, variant) {
  const t = content.enemies[tid];
  const [sig] = t ? signatureIds(content, variant, t.abilities) : [null];
  if (!sig) return null;
  const ab = content.abilities[sig];
  const T = ABILITY_TEMPLATE[ab.template];
  return { id: sig, name: ab.name, kind: T.kind, heavy: !!T.heavy, cast: !!T.cast, type: T.heavy ? 'heavy' : 'cast', damaging: DAMAGING.includes(T.kind) };
}

/**
 * The Deathblow of a map elite whose name is hidden (rules 1.9.5, M2b v14 row 2, D112): `{ type }` only ('heavy' or
 * 'cast'), or null. No id, name, kind or damaging: a kind can tell a rare (D50), a type cannot (every zone's elite pool
 * has a heavy and a cast Deathblow, content.js).
 */
export function deathblowType(content, tid, rare) {
  const d = deathblowOf(content, tid, rare ? 'rare' : 'elite');
  return d ? { type: d.type } : null;
}

/** Id of the scripted action of enemy e on its turn t (rules 7.12), or null for a weighted pick. */
export function scriptedId(s, e, t) {
  if (e.unscripted || e.kind === 'shard' || e.kind === 'boss') return null;
  const [sig, sig2] = signatures(s, e);
  if (sig && t === SIGNATURE_TURN) return sig;
  if (sig2 && t === SIGNATURE_TURN_2) return sig2;
  if (t < 1 || t > OPENING_TURNS) return null;
  const script = OPENING_SCRIPT[e.arch];
  if (!script || t > script.length) return null;
  const id = script[t - 1];
  // A skulker calls for help only when the fight started with at least 2 enemies; else it strikes.
  if (id === 'signal' && s.fight.startCount < 2) return basicAction(e).id;
  return id;
}

/**
 * Is the scripted action sid on enemy e's turn t one of its signatures, i.e. a wind-up (rules 7.12, combat v2.1)? The
 * signature on SIGNATURE_TURN (elite, rare, dungeon boss) and a dungeon boss's other ability on SIGNATURE_TURN_2.
 */
function isWindup(s, e, sid, t) {
  const [sig, sig2] = signatures(s, e);
  return (!!sig && sid === sig && t === SIGNATURE_TURN) || (!!sig2 && sid === sig2 && t === SIGNATURE_TURN_2);
}

function actionById(s, e, id) {
  return SCRIPT_ACTION[id] || enemyActions(s, e).find((a) => a.id === id) || basicAction(e);
}

/**
 * A track entry (or an intent) for action a on turn t. A scripted damaging action (hit, rend, cleave) takes the script
 * multiplier of its flag: heavy × HEAVY_SCRIPT_MULT, cast × CAST_SCRIPT_MULT; a scripted heal or shield (Mend, Bolster,
 * Self Heal, Self Shield) keeps its pct (rules 7.12, D60).
 */
function entryOf(a, t, scripted) {
  const x = {
    turn: t, id: a.id, name: a.name, kind: a.kind, cast: !!a.cast, heavy: !!a.heavy, school: a.school || null,
    cd: a.cd || 0, pct: a.pct, hits: a.hits || 1, tickPct: a.tickPct, rounds: a.rounds, reduce: a.reduce, below: a.below,
    scripted: !!scripted, aggro: 'player', target: 'player', est: 0,
  };
  if (scripted && typeof x.pct === 'number' && DAMAGING.includes(x.kind)) x.pct *= x.heavy ? HEAVY_SCRIPT_MULT : x.cast ? CAST_SCRIPT_MULT : 1;
  if (a.adds) x.adds = a.adds;
  return x;
}

/**
 * Can action a be picked by weight for enemy e's turn t (rules 7.11)? Off cooldown at that turn: by the cooldowns
 * the enemy has (e.cds), by earlier entries of the track that use it within its cooldown, and by a later scripted
 * entry that uses it within its cooldown (a dungeon boss's SIGNATURE_TURN_2). Conditions are read now (7.6).
 */
function eligibleAt(s, e, a, t) {
  const f = s.fight;
  if ((e.cds[a.id] || 0) > roundOf(e, t)) return false;
  if (a.cd) {
    for (const x of e.track) if (x.id === a.id && x.turn < t && x.turn + a.cd > t) return false;
    for (let u = t + 1; u < t + a.cd; u++) if (scriptedId(s, e, u) === a.id) return false;
  }
  switch (a.kind) {
    case 'heal': return f.enemies.some((o) => o.alive && o.hp < a.below * o.maxHp);
    case 'shieldAlly': return wardOf(s, e) !== null;
    case 'selfHeal': return e.hp < a.below * e.maxHp;
    case 'selfShield': return e.shield <= 0;
    default: return true;
  }
}

/**
 * Make the entry for enemy e's turn t (rules 7.11): the scripted action, or a weighted pick (1 draw); then the
 * pet-aggro target (1 draw) whenever a live pet exists. TAUNT and feign are applied when the entry becomes now.
 */
function makeEntry(s, e, t) {
  if (e.kind === 'boss') return bossEntry(s, e, t);
  const f = s.fight;
  const sid = scriptedId(s, e, t);
  let a;
  if (sid) a = actionById(s, e, sid);
  else {
    const opts = enemyActions(s, e).filter((x) => eligibleAt(s, e, x, t));
    a = opts[weightedIndex(f.rng, opts.map((o) => o.w))];
  }
  const x = entryOf(a, t, !!sid);
  // A wind-up (rules 7.12, combat v2.1) is also a cast, whatever its kind: every interrupt, stun or control stops it,
  // on CC-immune enemies too. Its pct already took the multiplier of its own flag only (entryOf, before `cast`).
  if (sid && isWindup(s, e, sid, t)) {
    x.windup = true;
    x.cast = true;
    // M2b v13 (D105): the SIGNATURE_TURN wind-up is the Deathblow (the dungeon boss's SIGNATURE_TURN_2 one is not); a
    // damaging one (hit, rend, cleave) × DEATHBLOW_MULT on top of the script multiplier; heals, shields and curses keep
    // their pct (D60) and are Deathblows all the same (DEATHBLOW_EMPOWER and MAIMED when they land, damage.js).
    if (t === SIGNATURE_TURN) {
      x.deathblow = true;
      if (typeof x.pct === 'number' && DAMAGING.includes(x.kind)) x.pct *= DEATHBLOW_MULT;
    }
  } else if (sid && e.firstMeet && t === (e.windupTurn || SIGNATURE_TURN)) {
    // M2b v13 row 6 (gated, D109): a first meeting's turn-2 scripted action is a wind-up, pct unchanged, no Deathblow.
    // D149 (m3-onboarding.md 2.8 item 6, draft): an enemy the guided zone's overlay marks winds up on its turn
    // e.windupTurn (ONB_WINDUP_TURN, combat.js startFight); every other first meeting keeps SIGNATURE_TURN.
    x.windup = true;
    x.cast = true;
    x.firstMeet = true;
  }
  if (petAlive(s)) x.aggro = nextFloat(f.rng) < PET[s.player.pet.id].aggro ? 'pet' : 'player';
  return x;
}

/** First turn the track must show: the current turn, or turn 1 before it (engage round, a fresh add). */
const firstTurn = (f, e) => Math.max(1, turnOf(f, e));

function dropUsed(f, e) {
  const t0 = firstTurn(f, e);
  while (e.track.length && e.track[0].turn < t0) e.track.shift();
}

function append(s, e) {
  const t = e.track.length ? e.track[e.track.length - 1].turn + 1 : firstTurn(s.fight, e);
  e.track.push(makeEntry(s, e, t));
}

/**
 * Start of a round (rules 7.11): drop the used head entries, then fill every living enemy's track to
 * INTENT_TRACK_LEN entries, turn by turn, enemies in index order (at fight start: turns 1..INTENT_TRACK_LEN; later
 * one entry per enemy). Enemies that already have a full track (adds that appeared last round) draw nothing.
 */
export function updateTracks(s) {
  const f = s.fight;
  const list = f.enemies.filter((e) => e.alive);
  for (const e of list) dropUsed(f, e);
  for (let k = 0; k < INTENT_TRACK_LEN; k++) for (const e of list) if (e.track.length <= k) append(s, e);
}

/** Give an enemy that appears mid-fight its whole track at once (rules 7.11: summons, Signal, Shards). */
export function fillTrack(s, e) {
  dropUsed(s.fight, e);
  while (e.track.length < INTENT_TRACK_LEN) append(s, e);
}

/** Why the now-entry cannot be played (rules 7.11), or null. */
function invalidReason(s, e, x) {
  const f = s.fight;
  if ((e.cds[x.id] || 0) > f.round) return 'on cooldown';
  if (x.cast && hasSt(e.st, 'SILENCED')) return 'silenced';
  switch (x.kind) {
    case 'heal': return f.enemies.some((o) => o.alive && o.hp < x.below * o.maxHp) ? null : 'no wounded ally';
    case 'shieldAlly': return wardOf(s, e) === null ? 'no ally to shield' : null;
    case 'selfHeal': return e.hp < x.below * e.maxHp ? null : 'not wounded';
    case 'selfShield': return e.shield > 0 ? 'already shielded' : null;
    case 'signal': {
      // Once per fight: given before, or by an enemy whose turn starts first this round (lower index).
      const calling = f.enemies.some((o) => o.idx < e.idx && o.alive && o.intent && o.intent.kind === 'signal' && o.intent.turn === turnOf(f, o));
      return f.signalled || calling ? 'help already called' : f.addPool.length ? null : 'no help nearby';
    }
    default: return null;
  }
}

/** Is a status still on k rounds from now (k = 0: now)? Statuses without a duration last. */
function activeIn(st, id, k) {
  const x = findSt(st, id);
  return !!x && (x.dur === null || x.dur === undefined || x.dur > k);
}

/**
 * Target of an entry played in round `round` (rules 7.11): single-target hits go to the pet while TAUNT or feign is
 * on (predicted from their durations), else to the drawn aggro target; Mend and Bolster to the lowest-HP ally
 * (self included) as it stands now; Shield Ally to the ward.
 */
function targetOf(s, e, x, round) {
  const f = s.fight;
  switch (x.kind) {
    case 'hit': case 'rend': {
      const k = round - f.round;
      if (petAlive(s) && (activeIn(f.pet.st, 'TAUNT', k) || activeIn(f.p.st, 'FEIGN', k))) return 'pet';
      return x.aggro === 'pet' && petAlive(s) ? 'pet' : 'player';
    }
    case 'cleave': return 'all';
    case 'curse': return 'player';
    case 'heal': case 'bolster': { const o = lowestHpAlly(s, e, true); return o ? o.idx : e.idx; }
    case 'shieldAlly': { const w = wardOf(s, e); return w === null ? 'self' : w; }
    default: return 'self';
  }
}

/** Estimated damage of a hit on tgt from the current state (rules 7.6: shown with the intent). */
export function hitEst(s, e, a, tgt) {
  let x = snapshot(s, e.idx, tgt, a.pct * e.dmg, {});
  if (a.school === 'phys') x *= 1 - mitigation(tgt === 'pet' ? s.player.d.petArmor : s.player.d.armor, e.level);
  return rnd(x) * (a.hits || 1);
}

function estOf(s, e, x) {
  switch (x.kind) {
    case 'hit': case 'rend': return hitEst(s, e, x, x.target);
    case 'cleave': return hitEst(s, e, x, 'player');
    case 'heal': case 'bolster': { const o = s.fight.enemies[x.target] || e; return rnd(x.pct * o.maxHp); }
    case 'selfHeal': return rnd(x.pct * e.maxHp);
    default: return 0;
  }
}

/** Intent object from an entry (a copy: the state never shares objects). */
function intentOf(x) {
  const it = {
    id: x.id, name: x.name, kind: x.kind, cast: x.cast, heavy: x.heavy, school: x.school, cd: x.cd, pct: x.pct,
    hits: x.hits, tickPct: x.tickPct, rounds: x.rounds, reduce: x.reduce, below: x.below, turn: x.turn,
    scripted: x.scripted, aggro: x.aggro, target: x.target, est: 0,
  };
  if (x.windup) it.windup = true;
  if (x.deathblow) it.deathblow = true;
  if (x.firstMeet) it.firstMeet = true;
  if (x.adds) it.adds = x.adds;
  return it;
}

/**
 * The enemy's intent for this round from its track (rules 7.11). Before its turn 1: Unaware. Then, in order: a laid
 * trap that is due springs (STUN TRAP_STUN); control (STUN, FROZEN, HEXED, SAPPED) cancels the now-entry, and a
 * cancelled cast or heavy leaves the enemy OFF_BALANCE (7.13) for the player's next action; a template summon at its
 * HP trigger takes the turn; an entry whose condition fails is replaced by the basic attack (with `replaced`).
 * Combat v2.1 (rules 7.12): a cancelled wind-up, or one replaced because SILENCED, is answered (STAGGERED); one
 * replaced for any other reason is neither.
 */
export function nowIntent(s, ev, e) {
  const f = s.fight;
  const T = turnOf(f, e);
  e.turn = Math.max(0, T);
  if (T < 1) { e.intent = { id: 'unaware', name: 'Unaware', kind: 'none', est: 0, turn: 0 }; return; }
  const head = e.track[0];
  const trap = findSt(e.st, 'TRAP');
  const sprung = trap && trap.turn <= T ? trap : null;
  if (sprung) {
    removeStatus(s, ev, e.idx, 'TRAP');
    ev.push(sprung.disrupt ? { t: 'trapSprung', u: e.idx, turn: T, disrupt: true } : { t: 'trapSprung', u: e.idx, turn: T });
    addStatus(s, ev, e.idx, { id: 'STUN', dur: sprung.stun });
  }
  const ctl = controlOf(e.st);
  if (ctl) {
    const big = !!(head.cast || head.heavy);
    const cancelled = { by: ctl, id: head.id, name: head.name, cast: head.cast, heavy: head.heavy };
    if (head.windup) cancelled.windup = true;
    if (head.deathblow) cancelled.deathblow = true;
    e.intent = { ...CONTROL_INTENT[ctl], kind: 'none', est: 0, turn: T, cancelled };
    ev.push({ t: 'cancel', u: e.idx, id: head.id, name: head.name, by: ctl, turn: T, offBalance: big });
    if (big) gainOffBalance(s, ev, e.idx, OFFBAL_DURATION - 1, 'control', head);
    answerWindup(s, ev, e.idx, head, sprung ? (sprung.disrupt ? 'disrupt' : 'trap') : 'control', ctl);
    return;
  }
  for (const id of e.abilities) {
    const ab = s.content.abilities[id];
    if (ab.template === 'summon' && !e.summoned && e.hp <= ABILITY_TEMPLATE.summon.at * e.maxHp) {
      e.intent = { id, name: ab.name, kind: 'summon', count: ab.count, target: 'self', est: 0, turn: T, replaced: { id: head.id, name: head.name, reason: 'calls for help' } };
      return;
    }
  }
  const why = invalidReason(s, e, head);
  let it;
  if (why) {
    const b = basicAction(e);
    const x = entryOf(b, T, false);
    x.aggro = head.aggro;
    it = intentOf(x);
    it.replaced = { id: head.id, name: head.name, reason: why };
    if (head.windup) it.replaced.windup = true;
    if (head.deathblow) it.replaced.deathblow = true;
    ev.push({ t: 'replace', u: e.idx, turn: T, from: head.id, fromName: head.name, to: b.id, toName: b.name, reason: why });
    if (why === 'silenced') answerWindup(s, ev, e.idx, head, 'silenced', 'SILENCED');
  } else it = intentOf(head);
  it.target = targetOf(s, e, it, f.round);
  it.est = estOf(s, e, it);
  e.intent = it;
}

/**
 * What will cancel an entry when it becomes now (rules 7.11, D52), predicted from the current state: { by, offBalance,
 * stagger, breaks, done } or null. The now-entry: its own cancellation (intent.cancelled; done). Later entries: a laid
 * trap whose STUN covers its turn (by 'TRAP'), else the first control status (STUN, FROZEN, HEXED, SAPPED) still on at
 * the start of its round (rounds left > rounds from now, rules 7.4). breaks: HEXED and SAPPED end on any damage, so
 * the prediction holds only if the enemy takes none. offBalance: a cancelled heavy or cast leaves it OFF_BALANCE (7.13).
 * stagger (combat v2.1): the entry is a wind-up, so the cancel answers it (STAGGERED, 7.12). Actions still to come (an
 * interrupt, new control) are not predicted.
 */
function cancelOf(s, e, x) {
  const k = roundOf(e, x.turn) - s.fight.round;
  const big = !!(x.cast || x.heavy);
  const stagger = !!x.windup;
  if (k <= 0) {
    const c = e.intent && e.intent.cancelled && e.intent.turn === x.turn ? e.intent.cancelled : null;
    return c ? { by: c.by, offBalance: big, stagger, breaks: false, done: true } : null;
  }
  const trap = findSt(e.st, 'TRAP');
  if (trap && x.turn >= trap.turn && x.turn < trap.turn + (trap.stun || 1)) return { by: 'TRAP', offBalance: big, stagger, breaks: false, done: false };
  for (const id of CONTROL) if (activeIn(e.st, id, k)) return { by: id, offBalance: big, stagger, breaks: id === 'HEXED' || id === 'SAPPED', done: false };
  return null;
}

/**
 * Refresh what the track shows (rules 7.11): each entry's target and estimated damage from the current state, and
 * (D52) `cancel`, what will cancel it when it becomes now (cancelOf).
 */
export function refreshTrack(s, e) {
  for (const x of e.track) {
    x.target = targetOf(s, e, x, roundOf(e, x.turn));
    x.est = estOf(s, e, x);
    x.cancel = cancelOf(s, e, x);
  }
}

/** Is a single-target kind (hit, rend)? TAUNT and feign retarget only these (rules 7.1 step 4). */
export const isSingle = (kind) => SINGLE.includes(kind);
