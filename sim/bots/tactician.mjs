// tactician bot (balance.md 1): map, talents, bar and economy as the planner; in combat it replaces the autoplay
// policy with a search: for each candidate action, simulate TACTICIAN_DEPTH rounds on a cloned state (the
// action, then autoplay) over TACTICIAN_SAMPLES sampled fight streams drawn from the bot stream (the same
// samples for every candidate), and pick the best mean of
//   (enemy HP removed) - TACTICIAN_HP_WEIGHT × (own HP lost) - TACTICIAN_DEATH_PENALTY × deaths.
// Enemy HP removed is damage dealt (capped at the HP left) minus enemy healing; own HP lost is damage taken minus
// healing from spells and effects (potion heals are not counted: a potion is a finite resource).
// Candidates are the legal actions minus clearly wasteful ones (SIM.TACT_* in params.mjs): the autoplay action;
// ATTACK and single-target spells on the autoplay target, the lowest-HP enemy and (control spells) enemies with
// a cast or heavy intent, or every enemy when at most SIM.TACT_ALL_TARGETS live (interrupts only while an enemy
// casts: their damage is trivial and the next boss channel is beyond the horizon); every self/AoE spell; healing
// potions below TACT_POTION_HP, mana draughts below TACT_MANA, tonics with a debuff on; potions above that HP and
// FLEE only when the best candidate dies in some sample. To fit the compute budget (SIM.TACT_*): the search runs only in rounds with a
// real decision (needsSearch), and samples are raced (successive halving). Manual time profile.
import { C, R, makeRng, hpFrac, manaFrac } from '../lib/engine.mjs';
import { BAL, SIM } from '../lib/params.mjs';
import { fightClone } from '../lib/clone.mjs';
import { createPlannerBot } from './planner.mjs';

const CONTROL = new Set(['interrupt', 'stun', 'control']);
const same = (a, b) => a.type === b.type && a.spellId === b.spellId && a.target === b.target && a.slot === b.slot;

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

/** Mean score of `action` over the sampled fight streams, and the number of samples with a death. */
export function evaluateAction(s, action, seeds) {
  let sum = 0;
  let deaths = 0;
  for (const seed of seeds) {
    const c = fightClone(s);
    c.fight.rng = makeRng(seed);
    const ehp = c.fight.enemies.map((e) => (e.alive ? e.hp : 0));
    let removed = 0;
    let lost = 0;
    let died = 0;
    const apply = (events) => {
      for (const e of events) {
        if (e.t === 'damage') {
          if (e.dst === 'player') lost += e.amount;
          else if (typeof e.dst === 'number') { const h = ehp[e.dst] || 0; const d = Math.min(e.amount, h); removed += d; ehp[e.dst] = h - d; }
        } else if (e.t === 'heal') {
          // Potion heals do not offset HP lost (a potion spent here is missing later; deaths still count).
          if (e.dst === 'player') { if (!C.CONSUMABLE[e.spell]) lost -= e.amount; }
          else if (typeof e.dst === 'number') { ehp[e.dst] = (ehp[e.dst] || 0) + e.amount; removed -= e.amount; }
        } else if (e.t === 'summon') { ehp[e.u] = e.hp; }
        else if (e.t === 'despawn') { removed += ehp[e.u] || 0; ehp[e.u] = 0; }
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
 * A round needs the search when something can go wrong: an elite, rare, dungeon or boss fight, a cast or heavy
 * intent, HP under SIM.TACT_GATE_HP, or at least SIM.TACT_GATE_ENEMIES live enemies. Otherwise the autoplay
 * action stands (a skilled player plays a routine round like autoplay). [assumption: compute budget]
 */
export function needsSearch(s, opts = {}) {
  const f = s.fight;
  if (opts.bossAuto && f.kind === 'boss') return false;
  if (f.kind === 'elite' || f.kind === 'trash' || f.kind === 'dboss' || f.kind === 'boss') return true;
  if (hpFrac(s) < SIM.TACT_GATE_HP) return true;
  let n = 0;
  for (const e of f.enemies) {
    if (!e.alive) continue;
    n++;
    if (e.intent && !e.intent.interrupted && (e.intent.cast || e.intent.heavy)) return true;
  }
  return n >= SIM.TACT_GATE_ENEMIES;
}

/**
 * Successive halving over the TACTICIAN_SAMPLES streams: every candidate on the first SIM.TACT_RACE_SAMPLES,
 * the best SIM.TACT_RACE_KEEP on all of them; the pick is the best mean over all TACTICIAN_SAMPLES.
 */
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

export function tacticianChoice(s, rng, opts = {}) {
  const cands = candidateActions(s);
  if (cands.length === 1 || !needsSearch(s, opts) || safetyRule(s, cands[0])) return cands[0];
  const seeds = [];
  for (let i = 0; i < BAL.TACTICIAN_SAMPLES; i++) seeds.push(rng.u32());
  const head = seeds.slice(0, SIM.TACT_RACE_SAMPLES);
  const tail = seeds.slice(SIM.TACT_RACE_SAMPLES);
  let scored = cands.map((a) => ({ a, ...evaluateAction(s, a, head) }));
  scored.sort((x, y) => y.mean - x.mean);
  scored = scored.slice(0, SIM.TACT_RACE_KEEP);
  let best = null;
  for (const c of scored) {
    const r = tail.length ? evaluateAction(s, c.a, tail) : { mean: 0, deaths: 0 };
    const mean = (c.mean * head.length + r.mean * tail.length) / seeds.length;
    const deaths = c.deaths + r.deaths;
    if (!best || mean > best.mean) best = { a: c.a, mean, deaths };
  }
  if (best.deaths > 0) {
    // Only when the best plan dies in some sample: healing potions (if not already candidates), then FLEE.
    const extra = potionActions(s).filter((a) => !cands.some((c) => same(c, a)));
    if (s.fight.canFlee) extra.push({ type: 'FLEE' });
    for (const a of extra) {
      const r = evaluateAction(s, a, seeds);
      if (r.mean > best.mean) best = { a, ...r };
    }
  }
  return best.a;
}

/**
 * opts.variant 'bossAuto' (diagnostic, not a balance.md bot): no search in the end-boss fight, where the
 * 3-round score (Shard HP counts like boss HP; Brand and the enrage lie beyond the horizon) plays worse than
 * autoplay. The planner variants (noInterrupt, ...) are not used with the tactician.
 */
export function createTacticianBot(opts) {
  const { rng } = opts;
  const bossAuto = opts.variant === 'bossAuto';
  return createPlannerBot({ ...opts, variant: bossAuto ? null : opts.variant, name: 'tactician', combat: (s) => tacticianChoice(s, rng, { bossAuto }) });
}
