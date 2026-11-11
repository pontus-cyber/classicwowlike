// Shared parts of the greedy, planner, speedrunner and tactician bots (balance.md 1): standard build (1.3),
// bar template (1.2), consumable kit, trainer and vendor, rewards, node stages, camp. Each bot file adds its map
// decision, grind waves, hub rule and (tactician) combat search. Start camp and hub contract (expedition.md 10.2;
// MILESTONES 2b.5; runs with newRun prep): each bot's prep policy and its hub contract rule, and the B40 overrides;
// the planner's start camp buys every option by value per point (M2b v10 rows D1, D2: supplyValue, plannerPrep).
import { C, R, SPELL, countCons, hpFrac, manaFrac, legal } from '../lib/engine.mjs';
import { BAL, SIM, EXP } from '../lib/params.mjs';
import { vAt, makeCtx, contractValue } from '../lib/model.mjs';
import { trackerRadius } from '../lib/view.mjs';
import {
  makeBot, standardTalent, templateBar, desiredItemBar, foodAction, trainAllAction, vendorAction, rewardAction,
  betweenAction, campAction, trainerUseful,
} from '../lib/policy.mjs';

/** Spells kept off the bar by the B26-B28 variants. */
export function excludedSpells(classId, variant) {
  const ex = new Set();
  if (!variant) return ex;
  for (const sp of Object.values(SPELL)) {
    if (sp.cls !== classId) continue;
    if (variant === 'noInterrupt' && sp.tags.includes('interrupt')) ex.add(sp.id);
    if (variant === 'noCleanse' && sp.tags.includes('cleanse')) ex.add(sp.id);
    if (variant === 'noAoe' && sp.tags.includes('aoe')) ex.add(sp.id);
  }
  return ex;
}

/**
 * cfg: { tree, variant, style, campBar (bool), kit: {potions, rations, mana, tonics, elixir, ember, gear},
 *        hub(s, base) -> action, map(s) -> action, grindWaves(s) -> n, combat(s) -> action, trainerNodes (bool),
 *        prep(s) -> action (phase PREP), hubContract(s) -> action | null (prep runs), prepPolicy ('none' | 'random' | null:
 *        B40 overrides of the start camp and the hub contract), rng (bot stream, for prepPolicy 'random') }
 */
export function createValueBot(name, cfg) {
  const exclude = excludedSpells(cfg.classId, cfg.variant);
  const noTonic = cfg.variant === 'noCleanse';
  const kitAt = (s) => ({
    potions: cfg.kit.potions, rations: cfg.kit.rations, mana: cfg.kit.mana,
    tonics: s.phase === 'CAMP' && !noTonic ? cfg.kit.tonics : 0,
    elixir: s.phase === 'CAMP' ? cfg.kit.elixir : 0,
    ember: cfg.kit.ember, gear: cfg.kit.gear,
  });
  return makeBot({
    name,
    combat: cfg.combat || ((s) => R.autoAction(s)),
    talent: (s) => standardTalent(s, cfg.tree),
    bar: (s) => templateBar(s, { camp: cfg.campBar && s.phase === 'CAMP', exclude }),
    itemBar: (s) => desiredItemBar(s, { noTonic }),
    food: (s) => foodAction(s, SIM.FOOD_HP),
    trainer: (s) => trainAllAction(s),
    vendor: (s) => vendorAction(s, kitAt(s), vAt),
    hub: (s) => cfg.hub(s),
    map: (s) => cfg.map(s),
    grindWaves: (s) => cfg.grindWaves(s),
    reward: rewardAction,
    between: betweenAction,
    camp: (s) => campAction(s),
    prep: prepWith(cfg),
    hubContract: cfg.prepPolicy === 'none' ? () => null : cfg.prepPolicy === 'random' ? randomHubContract(cfg.rng) : cfg.hubContract || null,
  });
}

/**
 * The start camp of a value bot: its own policy (cfg.prep), or a measurement override (cfg.prepPolicy, B40): 'none'
 * sets out at once (every point to Reserve), 'random' buys at random (randomPrep with the bot stream).
 */
function prepWith(cfg) {
  if (cfg.prepPolicy === 'none') return () => ({ type: 'SET_OUT' });
  if (cfg.prepPolicy === 'random') return (s) => randomPrep(s, cfg.rng);
  return cfg.prep || null;
}

// ---------------- Start camp and hub contract (expedition.md 2, 3.6, 10.2; MILESTONES 2b.5; prep) ----------------
const TRACKED = new Set(['cull', 'bounty']);

/**
 * Estimated completion of a contract (expedition.md 10.2 planner): the completion table of (kind, Tracker's Notes held,
 * zone) carried by the risk table (`ct`: [taken, completed] of earlier runs, sim/lib/risk.mjs), shrunk to the prior by
 * SIM.COMPLETION_SHRINK pseudo-contracts; the prior is EST_COMPLETE, + SIM.EST_TRACKER_GAIN for a Cull or Bounty with
 * the Tracker [assumption].
 */
export function estComplete(risk, kind, tracker, z) {
  const prior = Math.min(0.98, EXP.EST_COMPLETE[kind] + (tracker && TRACKED.has(kind) ? SIM.EST_TRACKER_GAIN : 0));
  const c = risk && risk.ct ? risk.ct[`${kind}|${tracker ? 1 : 0}|${z}`] : null;
  return c ? (c[1] + SIM.COMPLETION_SHRINK * prior) / (c[0] + SIM.COMPLETION_SHRINK) : prior;
}

/** Reward value of an offer (prepView board entry or contractView contract / hub offer) at its contract level, items
 *  against an uncommon of that level (model.mjs contractValue, ref). */
export const offerValue = (ctx, o) => contractValue(ctx, o.reward, { L: o.reward.cl, ref: true });

/** Tracker's Notes owned or bought at the start camp (prepView option). */
const trackerHeld = (pv) => { const t = pv.options.find((o) => o.id === 'prep_tracker'); return !!(t && (t.owned || t.bought)); };
const buy = (id) => ({ type: 'BUY_PREP', id });

/** Vision perks valued by their completion gain on the held contracts' value (M2b v10 D2; the Spyglass only when a bot
 *  policy uses it, SIM.SPYGLASS_USED). */
const VISION_GAIN = () => ({ prep_charts: EXP.EST_CHARTS_GAIN, prep_guide: EXP.EST_GUIDE_GAIN, ...(SIM.SPYGLASS_USED ? { prep_spyglass: EXP.EST_SPYGLASS_GAIN } : {}) });

/** Bot value of a supply option (M2b v10 D2): Field Draughts qty × SIM.POTION_VALUE, the Ember SIM.EMBER_VALUE, the Trail
 *  Pack and the Pack Mule SIM.PREP_VALUE; null for an option that is not a valued supply. */
export function supplyValue(id) {
  if (id === 'prep_draughts') return (C.PREP_OPTION[id].qty || 1) * SIM.POTION_VALUE;
  if (id === 'prep_ember') return (C.PREP_OPTION[id].qty || 1) * SIM.EMBER_VALUE;
  if (id === 'prep_rations') return SIM.PREP_VALUE.rations;
  if (id === 'prep_mule') return SIM.PREP_VALUE.mule;
  return null;
}

/**
 * Planner start camp (expedition.md 10.2; M2b v10 rows D1, D2): one list of every option by value per point, the best
 * bought first while it is worth more than SIM.PREP_POINT_VALUE per point (a point kept as Reserve pays hub contracts):
 * a board contract (estimated completion × reward value / price, a free slot needed; × SIM.PREP_SAME_ZONE_MULT when its
 * zone already has a held contract), Tracker's Notes (its completion gain on the held Culls and Bounties × their value),
 * the Second Clapper (BELL_KEEP_VALUE: the planner keeps Bell charges), the supplies at their bot values (supplyValue)
 * and Region Charts and the Local Guide at EST_CHARTS_GAIN / EST_GUIDE_GAIN × the held contracts' value (the Spyglass
 * only with SIM.SPYGLASS_USED). Ties: lower zone, board order, then the order above. No rerolls. Then SET_OUT.
 * force / ban (cell 9 calibration, --prep-force / --prep-ban): option ids bought first, each as soon as it can be bought /
 * never bought.
 */
export function plannerPrep(s, risk, force = null, ban = null) {
  const pv = R.prepView(s);
  if (!pv) return { type: 'SET_OUT' };
  const opt = (id) => pv.options.find((o) => o.id === id);
  if (force) for (const id of force) { const o = opt(id); if (o && o.canBuy) return buy(id); }
  const ctx = makeCtx(s, risk);
  const tracker = trackerHeld(pv);
  let best = null;
  const consider = (a, perPoint, z) => { if (!best || perPoint > best.v + 1e-9 || (Math.abs(perPoint - best.v) <= 1e-9 && z < best.z)) best = { a, v: perPoint, z }; };
  const heldZones = new Set();
  let heldValue = 0;
  for (const o of pv.board) if (o.taken) { heldZones.add(o.z); heldValue += offerValue(ctx, o); }
  for (const o of pv.board) {
    if (!o.canTake) continue;
    const same = heldZones.has(o.z) ? SIM.PREP_SAME_ZONE_MULT : 1;
    consider({ type: 'TAKE_CONTRACT', index: o.index }, (estComplete(risk, o.kind, tracker, o.z) * offerValue(ctx, o) * same) / o.price, o.z);
  }
  const ok = (o) => o && o.canBuy && !(ban && ban.includes(o.id));
  const tr = opt('prep_tracker');
  if (ok(tr)) {
    let g = 0;
    for (const o of pv.board) if (o.taken && TRACKED.has(o.kind)) g += (estComplete(risk, o.kind, true, o.z) - estComplete(risk, o.kind, false, o.z)) * offerValue(ctx, o);
    consider(buy('prep_tracker'), g / tr.price, 99);
  }
  const bell = opt('prep_bell');
  if (ok(bell)) consider(buy('prep_bell'), EXP.BELL_KEEP_VALUE / bell.price, 99);
  for (const o of pv.options) {
    if (!o.canBuy || (ban && ban.includes(o.id))) continue;
    const v = supplyValue(o.id);
    if (v !== null) consider(buy(o.id), v / o.price, 99);
  }
  for (const [id, gain] of Object.entries(VISION_GAIN())) {
    const o = opt(id);
    if (ok(o)) consider(buy(id), (gain * heldValue) / o.price, 99);
  }
  return best && best.v > SIM.PREP_POINT_VALUE ? best.a : { type: 'SET_OUT' };
}

/**
 * Planner hub contract (expedition.md 3.6): from Reserve when its estimated completion × value per point beats
 * SIM.PREP_POINT_VALUE; else by a swap when it beats the held contract worth least (estimated) by SIM.HUB_SWAP_MARGIN.
 */
export function plannerHubContract(s, risk) {
  if (!s.exp || !s.exp.prep) return null;
  const cv = R.contractView(s);
  const o = cv && cv.hub;
  if (!o) return null;
  const ctx = makeCtx(s, risk);
  const tracker = trackerRadius(s) > 0;
  const est = (k) => estComplete(risk, k.kind, tracker, k.z) * offerValue(ctx, k);
  const v = est(o);
  if (o.reserve && v / o.price > SIM.PREP_POINT_VALUE) return { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' };
  let worst = null;
  for (const id of o.swap) {
    const k = cv.contracts.find((x) => x.id === id);
    const kv = est(k) * (k.progress > 0 ? 1 + k.progress / k.need : 1);
    if (!worst || kv < worst.v) worst = { id, v: kv };
  }
  if (worst && v - worst.v > SIM.HUB_SWAP_MARGIN) return { type: 'TAKE_HUB_CONTRACT', mode: 'swap', contractId: worst.id };
  return null;
}

/**
 * Greedy start camp (expedition.md 10.2): contracts by reward value / price (no completion estimate) while a slot and
 * the points allow, then Field Draughts. Then SET_OUT.
 */
export function greedyPrep(s, risk) {
  const pv = R.prepView(s);
  if (!pv) return { type: 'SET_OUT' };
  const ctx = makeCtx(s, risk);
  let best = null;
  for (const o of pv.board) {
    if (!o.canTake) continue;
    const v = offerValue(ctx, o) / o.price;
    if (!best || v > best.v + 1e-9) best = { a: { type: 'TAKE_CONTRACT', index: o.index }, v };
  }
  if (best) return best.a;
  const d = pv.options.find((o) => o.id === 'prep_draughts');
  if (d && d.canBuy) return buy('prep_draughts');
  return { type: 'SET_OUT' };
}

/** Greedy hub contract: from Reserve whenever it can (no estimate, no swap). */
export function greedyHubContract(s) {
  const cv = s.exp && s.exp.prep ? R.contractView(s) : null;
  return cv && cv.hub && cv.hub.reserve ? { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' } : null;
}

/** Speedrunner start camp (expedition.md 10.2): Delve contracts (board order), the Second Clapper, Field Draughts. */
export function speedPrep(s) {
  const pv = R.prepView(s);
  if (!pv) return { type: 'SET_OUT' };
  const d = pv.board.find((o) => o.kind === 'delve' && o.canTake);
  if (d) return { type: 'TAKE_CONTRACT', index: d.index };
  for (const id of ['prep_bell', 'prep_draughts']) { const o = pv.options.find((x) => x.id === id); if (o && o.canBuy) return buy(id); }
  return { type: 'SET_OUT' };
}

/** Speedrunner hub contract: a Delve from Reserve. */
export function speedHubContract(s) {
  const cv = s.exp && s.exp.prep ? R.contractView(s) : null;
  return cv && cv.hub && cv.hub.kind === 'delve' && cv.hub.reserve ? { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' } : null;
}

/** Random start camp (expedition.md 10.2): uniform over the affordable purchases (contracts, options) until none is left. */
export function randomPrep(s, rng) {
  const opts = R.legalActions(s).filter((a) => a.type === 'TAKE_CONTRACT' || a.type === 'BUY_PREP');
  return opts.length ? rng.pick(opts) : { type: 'SET_OUT' };
}

/** Random hub contract: once per zone, at 50 % one of the legal TAKE_HUB_CONTRACT actions (uniform), else none. */
export function randomHubContract(rng) {
  let decided = null;
  return (s) => {
    if (!s.exp || !s.exp.prep || decided === s.zone.z) return null;
    const cv = R.contractView(s);
    if (!cv || !cv.hub) return null;
    const opts = R.legalActions(s).filter((a) => a.type === 'TAKE_HUB_CONTRACT');
    if (!opts.length) return null;
    decided = s.zone.z;
    return rng.chance(0.5) ? rng.pick(opts) : null;
  };
}

/** Hub for greedy, planner and tactician: trainer when useful, vendor, then the Inn when `inn(s)` says so. */
export function hubFull(s, inn) {
  const u = s.hub.used;
  if (!u.trainer && trainerUseful(s)) return { type: 'SERVICE', service: 'trainer' };
  if (!u.vendor) return { type: 'SERVICE', service: 'vendor' };
  if (!u.inn && inn(s)) return { type: 'SERVICE', service: 'inn' };
  return { type: 'LEAVE_HUB' };
}

export const FULL_KIT = { potions: BAL.HEAL_STOCK_TARGET, rations: SIM.RATION_STOCK, mana: SIM.MANA_STOCK, tonics: SIM.TONIC_STOCK_CAMP, elixir: SIM.ELIXIR_STOCK_CAMP, ember: false, gear: true };

export { countCons, hpFrac, manaFrac, legal };
