// tactician bot (balance.md 1, M2 v2): map, talents, bar and economy as the planner; manual time profile. It stands
// in for a skilled manual player who reads the intents. Each combat turn, in order:
//  1. Telegraph rules (first match wins; every fight, the end boss included):
//     T1 Big hit: when the damage this round's intents announce on the player from heavy abilities, casts it cannot
//        interrupt this turn, Collapse Litany 2/2, Gravity Crush and Starless Pulse would leave the player below
//        TACTICIAN_SAFE_HP of max HP: the first usable of (a) an interrupt or stun-tagged spell on the source when
//        the source's hit can be stopped (a cast: interrupt or stun; a non-cast hit: stun on an enemy that is not
//        CC-immune), (b) a defensive-tagged spell that is not active and covers the hit (DEFENSIVE below),
//        (c) a healing item on the item bar.
//     T2 Shards: in end-boss phase 2 with >= 2 living Shards, the usable aoe-tagged spell with the highest base
//        damage (not for the Rogue, M2 v3: the clause is skipped); with 1 living Shard whose HP is below the player's
//        expected damage of one action, the action with the highest expected damage on that Shard (mean over
//        TACTICIAN_SAMPLES cloned fight streams).
//  2. Otherwise: in the end-boss fight the autoplay policy (rules 7.9); in other fights the search: for each
//     candidate action, simulate TACTICIAN_DEPTH rounds on a cloned state (the action, then autoplay) over
//     TACTICIAN_SAMPLES sampled fight streams drawn from the bot stream (the same samples for every candidate) and
//     pick the best mean of
//       (enemy HP removed, summoned adds' HP × TACTICIAN_ADD_WEIGHT) - TACTICIAN_HP_WEIGHT × (own HP lost)
//       - TACTICIAN_DEATH_PENALTY × deaths.
//     HP removed and lost are the damage events' hpLost (WARD absorption is not HP lost); enemy healing counts
//     against HP removed; potion heals do not offset own HP lost (a potion is a finite resource).
// Search budget [assumption, SIM.TACT_*]: candidates are the legal actions minus clearly wasteful ones (see
// candidateActions); the search runs only in rounds with a real decision (needsSearch), autoplay rules 1-2 stand
// unless an enemy cast is pending (safetyRule), and samples are raced (successive halving).
// Combat v2 (combat-v2.md 11, "unchanged definition plus the engage search"): in an engage round that offers engage
// options, the opener's plan of the opening (sim/bots/opener.mjs planOpening, on a player-visible view) chooses the
// round's action, its first action; autoplay's (rule E) when the plan does not beat autoplay. From round 2 on: as
// above.
import { C, R, makeRng, hpFrac, manaFrac } from '../lib/engine.mjs';
import { BAL, SIM } from '../lib/params.mjs';
import { fightClone } from '../lib/clone.mjs';
import { engageActions } from '../lib/view.mjs';
import { createPlannerBot } from './planner.mjs';
import { planOpening } from './opener.mjs';

const CONTROL = new Set(['interrupt', 'stun', 'control']);
const same = (a, b) => a.type === b.type && a.spellId === b.spellId && a.target === b.target && a.slot === b.slot;
const hasTag = (id, t) => C.SPELL[id].tags.includes(t);
const hasSt = (list, id) => list.some((x) => x.id === id);

/**
 * Defensive-tagged spells (T1 b): the status that shows the spell is active (on the player, or on the pet) and the
 * hits it covers: 'any' hit on the player, 'phys' hits only (dodge), 'single' single-target hits only (redirected to
 * the pet). Spells not listed count as active never and covering any hit. [reading of balance.md 1 T1: "stops or
 * absorbs it"; effects from src/engine/spells.js]
 */
export const DEFENSIVE = {
  smoke_veil: { st: 'EVASION', covers: 'phys' },
  vanishing_step: { st: 'STEALTH', covers: 'any' },
  arcane_ward: { st: 'WARD', covers: 'any' },
  glacial_tomb: { st: 'IMMUNE', covers: 'any' },
  mirrorshade: { st: 'MIRROR', covers: 'any' },
  feign_stillness: { st: 'FEIGN', covers: 'single', noPet: { st: 'STEALTH', covers: 'any' } },
  beastcall_horn: { st: 'TAUNT', on: 'pet', covers: 'single' },
};

// ---------------- T1: big hits ----------------
/** An interrupt or stun-tagged spell on the bar that is usable on enemy `idx` now (enemy-target spells on it). */
function stopSpells(s, idx, tag) {
  const out = [];
  for (const id of s.player.bar) {
    if (!id || !hasTag(id, tag)) continue;
    const a = { type: 'CAST', spellId: id, target: C.SPELL[id].target === 'enemy' ? idx : null };
    if (R.isLegal(s, a)) out.push(a);
  }
  return out;
}

/** Can the player stop this cast this turn (an interrupt or a stun-tagged spell usable on its source)? */
function canInterrupt(s, e) {
  return stopSpells(s, e.idx, 'interrupt').length > 0 || stopSpells(s, e.idx, 'stun').length > 0;
}

/**
 * The big hits on the player this round (T1): [{ src, est, cast, single, phys, ccImmune }]. Boss: Collapse Litany
 * 2/2, Gravity Crush and every other heavy action, Starless Pulse. Other enemies: heavy hits and casts the player
 * cannot interrupt this turn. Only hits on the player count ('player' or 'all' targets) and only with est > 0.
 */
export function bigHits(s) {
  const f = s.fight;
  const out = [];
  for (const e of f.enemies) {
    const it = e.alive ? e.intent : null;
    if (!it || it.interrupted || it.skipped) continue;
    if (e.kind === 'boss') {
      for (const a of it.actions || []) {
        const big = a.heavy || a.id === 'gravity_crush' || a.kind === 'pulse' || (a.kind === 'litany' && a.step === 2);
        if (!big || !(a.est > 0) || (a.target !== 'player' && a.target !== 'all')) continue;
        out.push({ src: e.idx, est: a.est, cast: !!a.cast, single: a.target === 'player', phys: a.school === 'phys', ccImmune: true });
      }
      continue;
    }
    if (!(it.est > 0) || (it.target !== 'player' && it.target !== 'all')) continue;
    if (it.kind !== 'hit' && it.kind !== 'rend' && it.kind !== 'cleave') continue;
    if (!(it.heavy || (it.cast && !canInterrupt(s, e)))) continue;
    out.push({ src: e.idx, est: it.est, cast: !!it.cast, single: it.target === 'player', phys: it.school === 'phys', ccImmune: !!e.ccImmune });
  }
  return out;
}

function defensiveInfo(s, id) {
  const d = DEFENSIVE[id];
  if (!d) return { st: null, on: 'player', covers: 'any' };
  if (d.noPet && !(s.player.pet && s.player.pet.alive)) return { on: 'player', ...d.noPet };
  return { on: d.on || 'player', st: d.st, covers: d.covers };
}

const covers = (c, h) => c === 'any' || (c === 'phys' && h.phys) || (c === 'single' && h.single);

/** T1: { action, rule } or null. */
export function bigHitAction(s) {
  const f = s.fight;
  const p = s.player;
  const hits = bigHits(s);
  if (!hits.length) return null;
  const ward = (f.p.st.find((x) => x.id === 'WARD') || {}).amount || 0;
  const dmg = Math.max(0, hits.reduce((n, h) => n + h.est, 0) - ward);
  if (p.hp - dmg >= BAL.TACTICIAN_SAFE_HP * p.d.maxHp) return null;
  // (a) stop the source: biggest stoppable hit first; interrupts before stuns, bar order within a tag.
  for (const h of hits.slice().sort((a, b) => b.est - a.est || a.src - b.src)) {
    const tags = h.cast ? ['interrupt', 'stun'] : (h.ccImmune ? [] : ['stun']);
    for (const tag of tags) {
      const a = stopSpells(s, h.src, tag)[0];
      if (a) return { action: a, rule: 'T1-stop' };
    }
  }
  // (b) a defensive-tagged spell that is not active and covers one of the hits.
  for (const id of p.bar) {
    if (!id || !hasTag(id, 'defensive')) continue;
    const d = defensiveInfo(s, id);
    if (d.st && hasSt(d.on === 'pet' ? f.pet.st : f.p.st, d.st)) continue;
    if (!hits.some((h) => covers(d.covers, h))) continue;
    const a = { type: 'CAST', spellId: id, target: null };
    if (R.isLegal(s, a)) return { action: a, rule: 'T1-defensive' };
  }
  // (c) a healing item on the item bar.
  for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) {
    const id = p.itemBar[i];
    if (!id || !C.CONSUMABLE[id].heal) continue;
    const a = { type: 'USE_ITEM', slot: i, target: null };
    if (R.isLegal(s, a)) return { action: a, rule: 'T1-heal' };
  }
  return null;
}

// ---------------- T2: Shards ----------------
/** Mean damage to enemy `idx` from the player's own action `a` (its hits, not DOT ticks, pet or enemy actions). */
export function expectedHit(s, a, idx, seeds) {
  let sum = 0;
  for (const seed of seeds) {
    const c = fightClone(s);
    c.fight.rng = makeRng(seed);
    for (const e of R.stepInPlace(c, a)) {
      if (e.t === 'petAction' || e.t === 'enemyAction' || e.t === 'round') break;
      if (e.t === 'damage' && e.src === 'player' && e.dst === idx && !e.tick) sum += e.amount;
    }
  }
  return sum / seeds.length;
}

function baseDamage(s, id) {
  const info = R.spellInfo(s, id);
  const a = info && info.amount;
  return a && a.kind === 'damage' ? a.amount * (a.hits || 1) : 0;
}

/** T2: { action, rule } or null. Draws TACTICIAN_SAMPLES seeds from the bot stream only for the 1-Shard check. */
export function shardAction(s, rng) {
  const f = s.fight;
  if (f.kind !== 'boss' || !f.boss || f.boss.phase !== 2) return null;
  const shards = f.enemies.filter((e) => e.alive && e.kind === 'shard').sort((a, b) => a.hp - b.hp || a.idx - b.idx);
  if (shards.length >= 2) {
    // M2 v3 (balance.md 1, D23 update): the Rogue skips the AoE clause (Whirling Edges breaks its builder/finisher cycle).
    if (s.player.classId === 'rogue') return null;
    let best = null;
    for (const id of s.player.bar) {
      if (!id || !hasTag(id, 'aoe')) continue;
      const a = { type: 'CAST', spellId: id, target: C.SPELL[id].target === 'enemy' ? shards[0].idx : null };
      if (!R.isLegal(s, a)) continue;
      const v = baseDamage(s, id);
      if (!best || v > best.v) best = { a, v };
    }
    return best ? { action: best.a, rule: 'T2-aoe' } : null;
  }
  if (shards.length !== 1) return null;
  const sh = shards[0];
  const cands = [];
  const atk = { type: 'ATTACK', target: sh.idx };
  if (R.isLegal(s, atk)) cands.push(atk);
  for (const id of s.player.bar) {
    if (!id || !baseDamage(s, id)) continue;
    const a = { type: 'CAST', spellId: id, target: C.SPELL[id].target === 'enemy' ? sh.idx : null };
    if (C.SPELL[id].target !== 'enemy' && C.SPELL[id].target !== 'all') continue;
    if (R.isLegal(s, a)) cands.push(a);
  }
  if (!cands.length) return null;
  const seeds = [];
  for (let i = 0; i < BAL.TACTICIAN_SAMPLES; i++) seeds.push(rng.u32());
  let best = null;
  for (const a of cands) {
    const v = expectedHit(s, a, sh.idx, seeds);
    if (!best || v > best.v) best = { a, v };
  }
  return sh.hp < best.v ? { action: best.a, rule: 'T2-shard' } : null;
}

/** Telegraph rules T1 then T2 (first match wins): { action, rule } or null. */
export function telegraphAction(s, rng) {
  return bigHitAction(s) || shardAction(s, rng);
}

// ---------------- Search (non-boss fights) ----------------
/** Item-bar actions held back until needed: healing potions (see tacticianChoice). */
export function potionActions(s) {
  const out = [];
  for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) {
    const id = s.player.itemBar[i];
    if (id && C.CONSUMABLE[id].heal) {
      const a = { type: 'USE_ITEM', slot: i, target: null };
      if (R.isLegal(s, a)) out.push(a);
    }
  }
  return out;
}

/**
 * Search candidates: the autoplay action; ATTACK and single-target spells on the autoplay target, the lowest-HP
 * enemy and (control spells) enemies with a cast or heavy intent, or every enemy when at most SIM.TACT_ALL_TARGETS
 * live (interrupts only while an enemy casts: their damage is trivial); every self/AoE spell; healing potions below
 * TACT_POTION_HP, mana draughts below TACT_MANA, tonics with a debuff on. Potions above that HP and FLEE are added
 * only when the best candidate dies in some sample (tacticianChoice).
 */
export function candidateActions(s) {
  const f = s.fight;
  const p = s.player;
  if (f.p.skip) return [{ type: 'PASS' }];
  const auto = R.autoAction(s);
  const list = [auto];
  const add = (a) => { if (!list.some((x) => same(x, a)) && R.isLegal(s, a)) list.push(a); };
  const alive = f.enemies.filter((e) => e.alive);
  const tg = [];
  const addT = (t) => { if (t !== null && t !== undefined && !tg.includes(t)) tg.push(t); };
  if (alive.length <= SIM.TACT_ALL_TARGETS) for (const e of alive) addT(e.idx);
  if (typeof auto.target === 'number') addT(auto.target);
  let low = null;
  for (const e of alive) if (!low || e.hp < low.hp) low = e;
  if (low) addT(low.idx);
  const threat = alive.filter((e) => e.intent && !e.intent.interrupted && (e.intent.cast || e.intent.heavy)).map((e) => e.idx);
  for (const t of tg) add({ type: 'ATTACK', target: t });
  const casting = alive.some((e) => e.intent && e.intent.cast && !e.intent.interrupted);
  for (const id of p.bar) {
    if (!id) continue;
    const sp = C.SPELL[id];
    if (sp.tags.includes('interrupt') && !casting) continue; // interrupts are kept for casts
    if (sp.target === 'enemy') {
      const ts = tg.slice();
      if (sp.tags.some((x) => CONTROL.has(x))) for (const t of threat) if (!ts.includes(t)) ts.push(t);
      for (const t of ts) add({ type: 'CAST', spellId: id, target: t });
    } else add({ type: 'CAST', spellId: id, target: null });
  }
  const debuffed = f.p.st.some((x) => C.DEBUFFS.includes(x.id));
  for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) {
    const id = p.itemBar[i];
    if (!id) continue;
    const c = C.CONSUMABLE[id];
    if (c.heal && hpFrac(s) >= SIM.TACT_POTION_HP) continue;
    if (c.mana && manaFrac(s) >= SIM.TACT_MANA) continue;
    if (c.dispersal && !debuffed) continue;
    add({ type: 'USE_ITEM', slot: i, target: null });
  }
  return list;
}

/** Summoned adds of the live fight: enemies with index >= n0 (the fight's starting count) and Shards. */
const isAdd = (e, n0) => e.idx >= n0 || e.kind === 'shard';

/**
 * Mean search score of `action` over the sampled fight streams, and the number of samples with a death.
 * n0: the number of enemies the fight started with (enemies from n0 on, and every enemy summoned in the
 * look-ahead, are summoned adds weighted TACTICIAN_ADD_WEIGHT); default: every live enemy counts in full.
 */
export function evaluateAction(s, action, seeds, n0 = s.fight.enemies.length) {
  let sum = 0;
  let deaths = 0;
  const w0 = s.fight.enemies.map((e) => (isAdd(e, n0) ? BAL.TACTICIAN_ADD_WEIGHT : 1));
  for (const seed of seeds) {
    const c = fightClone(s);
    c.fight.rng = makeRng(seed);
    const w = w0.slice();
    const ehp = c.fight.enemies.map((e) => (e.alive ? e.hp : 0));
    let removed = 0;
    let lost = 0;
    let died = 0;
    const apply = (events) => {
      for (const e of events) {
        if (e.t === 'damage') {
          if (e.dst === 'player') lost += e.hpLost;
          else if (typeof e.dst === 'number') { const d = Math.min(e.hpLost, ehp[e.dst] || 0); removed += d * w[e.dst]; ehp[e.dst] -= d; }
        } else if (e.t === 'heal') {
          // Potion heals do not offset HP lost (a potion spent here is missing later; deaths still count).
          if (e.dst === 'player') { if (!C.CONSUMABLE[e.spell]) lost -= e.amount; }
          else if (typeof e.dst === 'number') { ehp[e.dst] = (ehp[e.dst] || 0) + e.amount; removed -= e.amount * w[e.dst]; }
        } else if (e.t === 'summon') { ehp[e.u] = e.hp; w[e.u] = BAL.TACTICIAN_ADD_WEIGHT; }
        else if (e.t === 'despawn') { removed += (ehp[e.u] || 0) * (w[e.u] ?? 1); ehp[e.u] = 0; }
        else if (e.t === 'resurrect' || (e.t === 'death' && e.u === 'player')) died = 1;
      }
    };
    apply(R.stepInPlace(c, action));
    for (let k = 1; k < BAL.TACTICIAN_DEPTH && c.fight && !died; k++) apply(R.stepInPlace(c, R.autoAction(c)));
    sum += removed - BAL.TACTICIAN_HP_WEIGHT * lost - BAL.TACTICIAN_DEATH_PENALTY * died;
    deaths += died;
  }
  return { mean: sum / seeds.length, deaths };
}

/**
 * A round needs the search when something can go wrong: an elite, rare, dungeon fight, a cast or heavy intent, HP
 * under SIM.TACT_GATE_HP, or at least SIM.TACT_GATE_ENEMIES live enemies. Otherwise the autoplay action stands (a
 * skilled player plays a routine round like autoplay). [assumption: compute budget]
 */
export function needsSearch(s) {
  const f = s.fight;
  if (f.kind === 'elite' || f.kind === 'trash' || f.kind === 'dboss') return true;
  if (hpFrac(s) < SIM.TACT_GATE_HP) return true;
  let n = 0;
  for (const e of f.enemies) {
    if (!e.alive) continue;
    n++;
    if (e.intent && !e.intent.interrupted && (e.intent.cast || e.intent.heavy)) return true;
  }
  return n >= SIM.TACT_GATE_ENEMIES;
}

/** Autoplay rules 1-2 (rules 7.9: healing item below AUTO_POTION_HP, cleanse at AUTO_TONIC_STACKS) stand. */
function safetyRule(s, auto) {
  // With an enemy cast pending the search weighs interrupting against healing (rule 3 vs rule 1).
  if (s.fight.enemies.some((e) => e.alive && e.intent && e.intent.cast && !e.intent.interrupted)) return false;
  if (auto.type === 'USE_ITEM') {
    const c = C.CONSUMABLE[s.player.itemBar[auto.slot]];
    return !!(c && (c.heal || c.dispersal));
  }
  return auto.type === 'CAST' && C.SPELL[auto.spellId].tags.includes('cleanse') && hpFrac(s) >= C.AUTO_POTION_HP;
}

/**
 * The search (non-boss fights). Successive halving over the TACTICIAN_SAMPLES streams: every candidate on the
 * first SIM.TACT_RACE_SAMPLES, the best SIM.TACT_RACE_KEEP on all of them; the pick is the best mean over all.
 */
export function searchChoice(s, rng, n0) {
  const cands = candidateActions(s);
  if (cands.length === 1 || !needsSearch(s) || safetyRule(s, cands[0])) return cands[0];
  const seeds = [];
  for (let i = 0; i < BAL.TACTICIAN_SAMPLES; i++) seeds.push(rng.u32());
  const head = seeds.slice(0, SIM.TACT_RACE_SAMPLES);
  const tail = seeds.slice(SIM.TACT_RACE_SAMPLES);
  let scored = cands.map((a) => ({ a, ...evaluateAction(s, a, head, n0) }));
  scored.sort((x, y) => y.mean - x.mean);
  scored = scored.slice(0, SIM.TACT_RACE_KEEP);
  let best = null;
  for (const c of scored) {
    const r = tail.length ? evaluateAction(s, c.a, tail, n0) : { mean: 0, deaths: 0 };
    const mean = (c.mean * head.length + r.mean * tail.length) / seeds.length;
    const deaths = c.deaths + r.deaths;
    if (!best || mean > best.mean) best = { a: c.a, mean, deaths };
  }
  if (best.deaths > 0) {
    // Only when the best plan dies in some sample: healing potions (if not already candidates), then FLEE.
    const extra = potionActions(s).filter((a) => !cands.some((c) => same(c, a)));
    if (s.fight.canFlee) extra.push({ type: 'FLEE' });
    for (const a of extra) {
      const r = evaluateAction(s, a, seeds, n0);
      if (r.mean > best.mean) best = { a, ...r };
    }
  }
  return best.a;
}

/**
 * One combat turn (balance.md 1, M2 v2). st: per-run bot memory { fights, n0 } (the fight's starting enemy count,
 * keyed by s.stats.fights). opts.rulesOnly: telegraph rules, then autoplay in every fight (diagnostic variant).
 */
export function tacticianChoice(s, rng, st = { fights: -1, n0: 0 }, opts = {}) {
  const f = s.fight;
  if (f.p.skip) return { type: 'PASS' };
  if (st.fights !== s.stats.fights) { st.fights = s.stats.fights; st.n0 = f.enemies.length; }
  if (!opts.rulesOnly && f.kind !== 'boss' && engageActions(s).length) {
    const r = planOpening(s, rng, { n0: st.n0 });
    return !r.auto && r.seq.length ? r.seq[0] : R.autoAction(s);
  }
  const t = telegraphAction(s, rng);
  if (t) return t.action;
  if (f.kind === 'boss' || opts.rulesOnly) return R.autoAction(s);
  return searchChoice(s, rng, st.n0);
}

/**
 * opts.variant 'rulesOnly' (diagnostic, not a balance.md bot): the telegraph rules, then autoplay in every fight
 * (no search). It splits the tactician's gap over the planner into the rules' share and the search's share. The
 * planner variants (noInterrupt, ...) are not used with the tactician.
 */
export function createTacticianBot(opts) {
  const { rng } = opts;
  const rulesOnly = opts.variant === 'rulesOnly';
  const st = { fights: -1, n0: 0 };
  return createPlannerBot({ ...opts, variant: rulesOnly ? null : opts.variant, name: 'tactician', combat: (s) => tacticianChoice(s, rng, st, { rulesOnly }) });
}
