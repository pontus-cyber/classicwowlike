// opener bot (combat-v2.md 11): the planner outside combat; in combat it plans the opening as a sequence and
// isolates the value of planning the first OPEN_ROUNDS rounds. Section 13 of the spec shows that a per-round
// 3-round search is not a substitute; this bot plans the whole opening at once.
//  - Engage round (and any round <= OPEN_ROUNDS without a plan): beam search over action sequences to the end of
//    round OPEN_ROUNDS, width OPENER_BEAM, over the engage options, the bar spells, the basic attack and items, with
//    their targets. Each sequence is scored on OPENER_SAMPLES re-seeded fight streams to the end of round OPEN_ROUNDS
//    plus OPENER_TAIL autoplay rounds, with the tactician's score (enemy HP removed, summoned adds ×
//    TACTICIAN_ADD_WEIGHT, minus TACTICIAN_HP_WEIGHT × own HP lost, minus TACTICIAN_DEATH_PENALTY per death) in which
//    every heal on the player, potions included, credits its amount. Holding a burst for a predicted OFF_BALANCE
//    window is a sequence like any other.
//  - It follows the best sequence and re-plans when the plan meets something it did not expect: an action that is
//    no longer legal or a dead target, a new enemy (reinforcement, summon), a visible entry that changed, or a new
//    track entry with a heavy or cast move. Anchor [assumption, SIM.OPENER_ANCHOR]: autoplay is scored on the same
//    samples to the same horizon; when the best sequence does not beat it by OPENER_MARGIN × max HP, autoplay plays
//    until the next surprise (a deviation from autoplay must pay for itself inside the horizon).
//  - Potion heals credit their amount (combat-v2.md 11) when SIM.OPENER_POTION_CREDIT is 1.
//  - Autoplay's potion and cleanse rules (rules 7.9, 1-2) always stand. Later rounds and the end boss: autoplay.
//  - It plans only on a player-visible view (sim/lib/view.mjs): the fight and loot streams of the live state are
//    never read; every sample re-draws what the track does not show yet.
// Search budget [assumption, SIM.OPENER_*]: sequences are expanded on OPENER_RACE_SAMPLES of the samples, the best
// OPENER_FINAL_KEEP complete sequences are scored on the other (held-out) samples, which also decide the choice and
// the anchor; candidates are pruned (openerCandidates);
// a routine fight (one enemy, no heavy or cast move in sight, normal kind, HP >= OPENER_GATE_HP) is played by
// autoplay. Manual time profile.
// Combat v2.1 (combat-v2.md 11 "opener, combat v2.1"; D59): the beam is root-diverse. At every depth it keeps the
// best sequence of every first action besides the OPENER_BEAM best (a setup or a Disrupt earns nothing in round 1
// and fell out of a beam expanded on one sample), and the held-out scoring takes the best sequence of up to
// C2.OPENER_ROOT_KEEP first actions. Stun and control spells are candidates on a CC-immune enemy whose now-entry is a
// cast (a wind-up: a stun-tagged spell interrupts it, rules 7.7). SIM.OPENER_ROOT_DIVERSE 0 restores the combat v2
// opener (beam and candidates), a diagnostic switch.
import { C, R } from '../lib/engine.mjs';
import { BAL, SIM, C2 } from '../lib/params.mjs';
import { fightClone } from '../lib/clone.mjs';
import {
  playerView, resample, engageActions, trackOf, nextEntries, isThreat, trackDamage, defaultTarget, inWindow,
  actionTarget,
} from '../lib/view.mjs';
import { directDamage } from './masher.mjs';
import { createPlannerBot } from './planner.mjs';

const key = (a) => `${a.type}|${a.spellId ?? ''}|${a.target ?? ''}|${a.slot ?? ''}|${a.option ?? a.optionId ?? ''}`;
/** First action of a beam node's sequence (D59 root-diverse beam); '' for the empty sequence. */
const rootKey = (x) => (x.seq.length ? key(x.seq[0]) : '');
const inFight = (c) => !!(c && c.fight);

/** Autoplay rules 1-2 (rules 7.9): the healing item below AUTO_POTION_HP, the cleanse at AUTO_TONIC_STACKS. */
export function forcedAction(s) {
  const f = s.fight;
  if (!f || f.p.skip) return null;
  const a = R.autoAction(s);
  if (!a) return null;
  if (a.type === 'USE_ITEM') {
    const c = C.CONSUMABLE[s.player.itemBar[a.slot]];
    if (c && (c.heal || c.dispersal)) return a;
    return null;
  }
  if (a.type === 'CAST' && C.SPELL[a.spellId].tags.includes('cleanse')) {
    let n = 0;
    for (const x of f.p.st) if (C.DEBUFFS.includes(x.id)) n += x.id === 'BRAND' || x.id === 'POISON' ? x.stacks : 1;
    if (n >= C.AUTO_TONIC_STACKS) return a;
  }
  return null;
}

// ---------------- Score ----------------
/** Score accumulator of one look-ahead sample: the tactician's score, heals on the player credited (potions too). */
export class Acc {
  constructor(s, n0) {
    this.removed = 0;
    this.lost = 0;
    this.died = 0;
    if (s) {
      this.ehp = s.fight.enemies.map((e) => (e.alive ? e.hp : 0));
      this.w = s.fight.enemies.map((e) => (e.idx >= n0 || e.kind === 'shard' ? BAL.TACTICIAN_ADD_WEIGHT : 1));
    }
  }

  copy() {
    const o = new Acc(null, 0);
    o.removed = this.removed;
    o.lost = this.lost;
    o.died = this.died;
    o.ehp = this.ehp.slice();
    o.w = this.w.slice();
    return o;
  }

  apply(events) {
    for (const e of events) {
      if (e.t === 'damage') {
        if (e.dst === 'player') this.lost += e.hpLost;
        else if (typeof e.dst === 'number') {
          const d = Math.min(e.hpLost, this.ehp[e.dst] || 0);
          this.removed += d * (this.w[e.dst] ?? 1);
          this.ehp[e.dst] -= d;
        }
      } else if (e.t === 'heal') {
        if (e.dst === 'player') { if (SIM.OPENER_POTION_CREDIT || !C.CONSUMABLE[e.spell]) this.lost -= e.amount; }
        else if (typeof e.dst === 'number') { this.ehp[e.dst] = (this.ehp[e.dst] || 0) + e.amount; this.removed -= e.amount * (this.w[e.dst] ?? 1); }
      } else if (e.t === 'summon') { this.ehp[e.u] = e.hp; this.w[e.u] = BAL.TACTICIAN_ADD_WEIGHT; }
      else if (e.t === 'despawn') { this.removed += (this.ehp[e.u] || 0) * (this.w[e.u] ?? 1); this.ehp[e.u] = 0; }
      else if (e.t === 'resurrect' || (e.t === 'death' && e.u === 'player')) this.died = 1;
    }
  }

  value() {
    return this.removed - BAL.TACTICIAN_HP_WEIGHT * this.lost - BAL.TACTICIAN_DEATH_PENALTY * this.died;
  }
}

// ---------------- Candidates ----------------
const uniq = (xs) => [...new Set(xs.filter((x) => x !== null && x !== undefined))];

/**
 * Candidate actions of one round [assumption: SIM pruning]. The forced autoplay rules 1-2 when they apply (the only
 * candidate). Else: every legal ENGAGE action (engage round), the autoplay action, ATTACK on the default target;
 * damage spells on the default target, the most dangerous enemy (largest estimated damage on the player over its
 * next 2 visible entries), the lowest-HP enemy when no enemy is dangerous, and every enemy in a window (OFF_BALANCE, or
 * FROZEN in combat v2); interrupts
 * on enemies whose current entry is a cast; stun and control spells on enemies with a heavy or cast move in their
 * next 2 entries, on a CC-immune enemy whose current entry is a cast (combat v2.1, D59: a wind-up, which a
 * stun-tagged spell interrupts), and on the most dangerous enemy when 2 or more live; self and AoE spells; healing
 * items below OPENER_POTION_HP, Mana Draughts below TACT_MANA, Purifying Tonic with a debuff on.
 */
export function openerCandidates(s) {
  const f = s.fight;
  const p = s.player;
  if (f.p.skip) return [{ type: 'PASS' }];
  const forced = forcedAction(s);
  if (forced) return [forced];
  const out = [];
  const seen = new Set();
  const add = (a) => {
    const k = key(a);
    if (seen.has(k)) return;
    seen.add(k);
    if (R.isLegal(s, a)) out.push(a);
  };
  for (const a of engageActions(s)) add(a);
  add(R.autoAction(s));
  const alive = f.enemies.filter((e) => e.alive);
  const dt = defaultTarget(s);
  if (dt !== null) add({ type: 'ATTACK', target: dt });
  let danger = null;
  let dmax = 0;
  for (const e of alive) {
    const d = trackDamage(s, e, 2);
    if (d > dmax) { dmax = d; danger = e.idx; }
  }
  let low = null;
  for (const e of alive) if (!low || e.hp < low.hp) low = e;
  const dmgT = uniq([dt, danger !== null ? danger : (low ? low.idx : null), ...alive.filter((e) => inWindow(s, e)).map((e) => e.idx)]);
  const nowCast = alive.filter((e) => { const t = e.intent; return t && t.cast && !t.interrupted && !t.cancelled; }).map((e) => e.idx);
  const threatT = alive.filter((e) => (!e.ccImmune && nextEntries(s, e, 2).some(isThreat)) || (SIM.OPENER_ROOT_DIVERSE && e.ccImmune && nowCast.includes(e.idx))).map((e) => e.idx);
  const ctlT = uniq([...threatT, ...(alive.length >= 2 ? [danger] : [])]);
  for (const id of p.bar) {
    if (!id) continue;
    const sp = C.SPELL[id];
    if (sp.target !== 'enemy') { add({ type: 'CAST', spellId: id, target: null }); continue; }
    const tags = sp.tags;
    let ts = [];
    if (tags.includes('interrupt')) ts = nowCast;
    else {
      const ctl = tags.includes('stun') || tags.includes('control');
      const dmg = directDamage(s, id) > 0 || tags.includes('dot') || tags.includes('debuff');
      if (dmg) ts = ts.concat(dmgT);
      if (ctl) ts = ts.concat(ctlT);
    }
    for (const t of uniq(ts)) add({ type: 'CAST', spellId: id, target: t });
  }
  const debuffed = f.p.st.some((x) => C.DEBUFFS.includes(x.id));
  const hpF = p.hp / p.d.maxHp;
  for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) {
    const id = p.itemBar[i];
    if (!id) continue;
    const c = C.CONSUMABLE[id];
    if (c.heal && hpF >= SIM.OPENER_POTION_HP) continue;
    if (c.mana && (!p.d.maxMana || p.mana >= SIM.TACT_MANA * p.d.maxMana)) continue;
    if (c.dispersal && !debuffed) continue;
    if (!c.heal && !c.mana && !c.dispersal) continue;
    add({ type: 'USE_ITEM', slot: i, target: null });
  }
  return out;
}

// ---------------- Planning ----------------
/** The action a sample plays for planned action `a`: rules 1-2 when forced, `a` when legal, else autoplay. */
function sampleAction(c, a) {
  const forced = forcedAction(c);
  if (forced) return forced;
  if (a && R.isLegal(c, a)) return a;
  return R.autoAction(c);
}

function tail(c, acc, rounds) {
  for (let r = 0; r < rounds && inFight(c); r++) acc.apply(R.stepInPlace(c, R.autoAction(c)));
}

/**
 * The beam after one depth (nodes { seq, score }): the `width` best by score; with `diverse` (D59) also the best
 * node of every other first action, so a sequence whose payoff comes later (a setup, a Disrupt) stays in the search.
 * Sorts `next` in place (stable). Returns the new beam, best first, then one node per further first action.
 */
export function beamSelect(next, width, diverse) {
  next.sort((x, y) => y.score - x.score);
  const beam = next.slice(0, width);
  if (!diverse) return beam;
  const roots = new Set(beam.map(rootKey));
  for (const x of next) {
    const k = rootKey(x);
    if (!roots.has(k)) { roots.add(k); beam.push(x); }
  }
  return beam;
}

/**
 * The complete sequences scored on the held-out samples (nodes { seq, race }): the `finalKeep` best by race; with
 * `diverse` (D59) then the best of each other first action until `rootKeep` sequences are kept. Sorts `beam` in place.
 */
export function finalSelect(beam, finalKeep, rootKeep, diverse) {
  beam.sort((x, y) => y.race - x.race);
  const keep = beam.slice(0, Math.max(1, finalKeep));
  if (!diverse) return keep;
  const seen = new Set(keep.map(rootKey));
  for (const x of beam) {
    const k = rootKey(x);
    if (!seen.has(k) && keep.length < rootKeep) { seen.add(k); keep.push(x); }
  }
  return keep;
}

/**
 * Plan the opening from a live fight state: { seq (actions, one per round from now to OPEN_ROUNDS), score, evals }.
 * Reads only playerView(s): rng is the bot stream (BotRng); n0 the fight's starting enemy count.
 */
export function planOpening(s, rng, { n0 = s.fight.enemies.length, depth = Math.max(1, C2.OPEN_ROUNDS - s.fight.round + 1) } = {}) {
  const view = playerView(s, rng);
  const S = C2.OPENER_SAMPLES;
  const RS = Math.max(1, Math.min(S, SIM.OPENER_RACE_SAMPLES));
  const seeds = [];
  for (let i = 0; i < S; i++) seeds.push(rng.u32());
  let evals = 0;
  const root = { seq: [], st: [], acc: [], score: 0 };
  for (let i = 0; i < RS; i++) {
    const c = resample(view, seeds[i], fightClone);
    root.st.push(c);
    root.acc.push(new Acc(c, n0));
  }
  let beam = [root];
  for (let k = 0; k < depth; k++) {
    const next = [];
    let grew = false;
    for (const node of beam) {
      const live = node.st.find(inFight);
      if (!live) { next.push(node); continue; }
      grew = true;
      for (const a of openerCandidates(live)) {
        const child = { seq: node.seq.concat([a]), st: [], acc: [], score: 0 };
        for (let i = 0; i < RS; i++) {
          const src = node.st[i];
          if (!inFight(src)) { child.st.push(src); child.acc.push(node.acc[i]); continue; }
          const c = fightClone(src);
          const acc = node.acc[i].copy();
          acc.apply(R.stepInPlace(c, sampleAction(c, a)));
          evals++;
          child.st.push(c);
          child.acc.push(acc);
        }
        let sum = 0;
        for (const x of child.acc) sum += x.value();
        child.score = sum / RS;
        next.push(child);
      }
    }
    if (!grew) break;
    beam = beamSelect(next, C2.OPENER_BEAM, SIM.OPENER_ROOT_DIVERSE);
  }
  // Final score: OPENER_TAIL autoplay rounds on the expansion samples; the best OPENER_FINAL_KEEP (D59: and the best
  // sequence of other first actions, up to OPENER_ROOT_KEEP in all) are then scored on the held-out samples (those the
  // beam did not select on), and the choice and the anchor use only those.
  for (const node of beam) {
    let sum = 0;
    for (let i = 0; i < RS; i++) {
      const acc = node.acc[i].copy();
      if (inFight(node.st[i])) { const c = fightClone(node.st[i]); tail(c, acc, C2.OPENER_TAIL); evals += C2.OPENER_TAIL; }
      sum += acc.value();
    }
    node.race = sum / RS;
  }
  const keep = finalSelect(beam, SIM.OPENER_FINAL_KEEP, C2.OPENER_ROOT_KEEP, SIM.OPENER_ROOT_DIVERSE);
  const held = [];
  for (let i = RS; i < S; i++) held.push(i);
  if (!held.length) held.push(...Array.from({ length: RS }, (_, i) => i));
  const playSeq = (seq, i) => {
    const c = resample(view, seeds[i], fightClone);
    const acc = new Acc(c, n0);
    for (const a of seq) {
      if (!inFight(c)) break;
      acc.apply(R.stepInPlace(c, sampleAction(c, a)));
      evals++;
    }
    if (inFight(c)) { tail(c, acc, C2.OPENER_TAIL); evals += C2.OPENER_TAIL; }
    return acc.value();
  };
  for (const node of keep) {
    let sum = 0;
    for (const i of held) sum += playSeq(node.seq, i);
    node.final = sum / held.length;
  }
  let best = keep[0];
  for (const node of keep) if (node.final > best.final) best = node;
  const score = best.final;
  if (!SIM.OPENER_ANCHOR) return { seq: best.seq, score, anchor: null, auto: false, evals };
  // Anchor: autoplay on the same held-out samples to the same horizon; the plan must beat it by OPENER_MARGIN × max HP.
  let asum = 0;
  for (const i of held) {
    const c = resample(view, seeds[i], fightClone);
    const acc = new Acc(c, n0);
    tail(c, acc, best.seq.length + C2.OPENER_TAIL);
    evals += best.seq.length + C2.OPENER_TAIL;
    asum += acc.value();
  }
  const anchor = asum / held.length;
  const auto = !(score > anchor + SIM.OPENER_MARGIN * s.player.d.maxHp);
  return { seq: best.seq, score, anchor, auto, evals };
}

// ---------------- Following the plan ----------------
/** What the plan saw: enemies alive and each enemy's visible entries by turn (ids). */
function visibleSig(s) {
  const f = s.fight;
  return {
    n: f.enemies.length,
    entries: f.enemies.map((e) => {
      const m = new Map();
      if (!e.alive) return m;
      const tr = trackOf(e);
      tr.forEach((it, j) => m.set(it.turn !== undefined ? it.turn : f.round + j, it.id));
      return m;
    }),
  };
}

/**
 * Something the plan did not expect: a new enemy, a visible entry that changed or was replaced by the basic attack
 * (combat v2 `intent.replaced`), or a new heavy or cast entry.
 */
export function surprised(s, sig) {
  const f = s.fight;
  if (f.enemies.length !== sig.n) return true;
  for (const e of f.enemies) {
    if (!e.alive) continue;
    if (e.intent && e.intent.replaced) return true;
    const old = sig.entries[e.idx];
    const tr = trackOf(e);
    for (let j = 0; j < tr.length; j++) {
      const it = tr[j];
      if (it.cancelled || it.interrupted || it.skipped || it.kind === 'none') continue;
      const turn = it.turn !== undefined ? it.turn : f.round + j;
      if (old && old.has(turn)) { if (old.get(turn) !== it.id) return true; } else if (isThreat(it)) return true;
    }
  }
  return false;
}

/**
 * A fight is routine (autoplay, no plan) when it is a normal fight against one enemy with no heavy or cast move in
 * sight and HP >= OPENER_GATE_HP [assumption: compute budget].
 */
export function routine(s) {
  const f = s.fight;
  if (f.kind === 'elite' || f.kind === 'trash' || f.kind === 'dboss') return false;
  if (s.player.hp < SIM.OPENER_GATE_HP * s.player.d.maxHp) return false;
  const alive = f.enemies.filter((e) => e.alive);
  if (alive.length !== 1) return false;
  return !trackOf(alive[0]).some(isThreat);
}

/**
 * One combat turn of the opener. st: per-run memory { fights, n0, plan: { seq, i, sig } | null, plans, replans }.
 */
export function openerChoice(s, rng, st) {
  const f = s.fight;
  if (f.p.skip) return { type: 'PASS' };
  if (st.fights !== s.stats.fights) { st.fights = s.stats.fights; st.n0 = f.enemies.length; st.plan = null; }
  if (f.kind === 'boss' || f.round > C2.OPEN_ROUNDS) { st.plan = null; return R.autoAction(s); }
  const forced = forcedAction(s);
  if (forced) { st.plan = null; return forced; }
  let pl = st.plan;
  let stale = !pl || surprised(s, pl.sig) || (SIM.OPENER_REPLAN_EVERY > 0 && !pl.auto);
  if (!stale && !pl.auto) {
    const next = pl.seq[pl.i];
    const tgt = actionTarget(next);
    stale = !next || !R.isLegal(s, next) || (tgt !== null && !f.enemies[tgt].alive);
  }
  if (stale) {
    if (!pl && routine(s)) return R.autoAction(s);
    const r = planOpening(s, rng, { n0: st.n0 });
    st.plans = (st.plans || 0) + 1;
    if (pl) st.replans = (st.replans || 0) + 1;
    if (r.auto) st.autoPlans = (st.autoPlans || 0) + 1;
    st.evals = (st.evals || 0) + r.evals;
    pl = { seq: r.seq, auto: r.auto, i: 0, sig: visibleSig(s) };
    st.plan = pl;
  }
  if (pl.auto) { pl.sig = visibleSig(s); return R.autoAction(s); }
  const a = pl.seq[pl.i] || R.autoAction(s);
  pl.i += 1;
  pl.sig = visibleSig(s);
  if (!R.isLegal(s, a)) { st.plan = null; return R.autoAction(s); }
  return a;
}

export function createOpenerBot(opts) {
  const st = { fights: -1, n0: 0, plan: null };
  const bot = createPlannerBot({ ...opts, name: 'opener', combat: (s) => openerChoice(s, opts.rng, st) });
  bot.memory = st;
  return bot;
}
