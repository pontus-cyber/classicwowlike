// planner bot (balance.md 1): full path search over the visible zone map (at most 3^ZONE_CHOICE_ROWS paths) maximising the
// value function 1.1 over the remaining zone, including rest timing and the travel-on point; standard build of
// its tree (1.3); bar template 1.2 with the boss bar at the Camp; trains everything at each hub, keeps
// HEAL_STOCK_TARGET Healing Draughts, buys an Ember of Return when affordable and gold after it >=
// EMBER_RESERVE_V × V; autoplay combat; manual time profile. Hours weigh VAL_TIME × PLANNER_TIME_MULT (M2 v3).
// Heat (expedition.md H.6; sim/lib/model.mjs): the value function prices the rewards of the state a node is entered in
// (HEAT_GAIN on XP and gold, the HEAT_RARITY_UP step on drop-table items; the first node of a choice from
// R.heatPreview's `pays`) and the boss term (projected Ascendancy × SIM.VAL_ASC). Policies for B58 (plannerHeat,
// plannerHourMult): heat-seek (variant 'heatSeek') values the rewards and weighs hours × HEAT_SEEK_TIME_MULT; heat-avoid
// ('heatAvoid') values no heat reward (a Hot node is never a reason to go) and weighs hours × HEAT_AVOID_TIME_MULT; both
// pay the boss term. Diagnostics: 'noHeat' (balance.md 1.1 without heat terms, the planner before 2026-11-11) and
// 'hm<x>' (hour weight x instead of PLANNER_TIME_MULT, for the hour-weight check).
import { C, R, legal, hpFrac } from '../lib/engine.mjs';
import { BAL, HEAT, SIM } from '../lib/params.mjs';
import { makeCtx, evalNode, copyM } from '../lib/model.mjs';
import { createValueBot, hubFull, FULL_KIT } from './shared.mjs';

const ROWS = C.ZONE_CHOICE_ROWS;

/** Best value obtainable after node (r, l) (1-based row r) from model state m: travel when allowed, else go on. Nodes
 *  beyond the first are valued in the model's heat state (model hours since the decision). */
function bestFrom(ctx, rows, r, l, m, exit) {
  let best = m.L >= exit ? 0 : -Infinity;
  if (r >= ROWS) return 0;
  const row = rows[r];
  for (let nl = l - 1; nl <= l + 1; nl++) {
    if (nl < 0 || nl >= C.LANES) continue;
    const m2 = copyM(m);
    const ev = evalNode(ctx, m2, row[nl]);
    const v = ev.value + bestFrom(ctx, rows, r + 1, nl, m2, exit);
    if (v > best) best = v;
  }
  return best;
}

/**
 * Level from which TRAVEL_ON is legal in the current zone (rules 1.5, M2 v2 M6): the engine's travelLevel, i.e. exit
 * level ZONE_LEVELS × z - TRAVEL_EARLY_LEVELS, one lower with Swift Boots. The planners' "exit" is this level.
 */
export function exitLevelOf(s) {
  return R.travelLevel(s);
}

/**
 * Path search from the current map position (hourMult: balance.md 1.1; heat: makeCtx opts.heat, null = no heat terms).
 * The first node of each option is valued in the state it would be entered in (R.heatPreview `pays`). Returns
 * { action, value, options }.
 */
export function planMap(s, risk, style, hourMult = 1, heat = null) {
  const view = R.mapView(s);
  const ctx = makeCtx(s, risk, { style, hourMult, heat });
  const exit = exitLevelOf(s);
  const options = [];
  if (legal(s, { type: 'TRAVEL_ON' })) options.push({ action: { type: 'TRAVEL_ON' }, value: 0 });
  const r = view.pos.r + 1;
  for (const lane of view.next) {
    const m = copyM(ctx.m);
    const action = { type: 'CHOOSE_NODE', lane };
    const pv = heat ? R.heatPreview(s, action) : null;
    const ev = evalNode(ctx, m, view.rows[r - 1][lane], { pays: pv ? pv.pays : null });
    options.push({ action, value: ev.value + bestFrom(ctx, view.rows, r, lane, m, exit) });
  }
  let best = options[0];
  for (const o of options) if (o.value > best.value) best = o;
  return { action: best.action, value: best.value, options };
}

/** Grind waves for the current grind node: as many as have positive marginal value (at least 1). The node pays the
 *  state it was entered in (state.node.heat). */
export function valueGrindWaves(s, risk, style, hourMult = 1, heat = null) {
  const ctx = makeCtx(s, risk, { style, hourMult, heat });
  const view = R.mapView(s);
  const v = view.rows[s.node.r - 1][s.node.l];
  const ev = evalNode(ctx, copyM(ctx.m), v, { pays: heat ? s.node.heat || null : null });
  return Math.max(1, Math.min(C.GRIND_MAX_WAVES, ev.waves || 1));
}

/** Inn when its value (banked rested XP, minus hours and, with heat, the boss term) is positive or HP is low. */
export function innByValue(s, risk, style, hourMult = 1, heat = null) {
  if (hpFrac(s) < 0.7 || (s.player.d.maxMana && s.player.mana < 0.5 * s.player.d.maxMana)) return true;
  const ctx = makeCtx(s, risk, { style, hourMult, heat });
  return evalNode(ctx, copyM(ctx.m), { type: 'rest' }).value > 0;
}

/**
 * Hour weight of a planner variant (× VAL_TIME): heat-seek, heat-avoid (expedition.md H.6), 'hm<x>' (diagnostic: x),
 * else PLANNER_TIME_MULT.
 */
export function plannerHourMult(variant) {
  if (variant === 'heatSeek') return HEAT.HEAT_SEEK_TIME_MULT;
  if (variant === 'heatAvoid') return HEAT.HEAT_AVOID_TIME_MULT;
  const m = /^hm(\d+(?:\.\d+)?)$/.exec(variant || '');
  if (m) return Number(m[1]);
  return BAL.PLANNER_TIME_MULT;
}

/**
 * Heat terms of a planner variant (makeCtx opts.heat; expedition.md H.6): heat-avoid values no reward and pays the boss
 * term; 'noHeat' (diagnostic) has no heat terms; every other variant values the rewards and pays the boss term.
 */
export function plannerHeat(variant) {
  if (variant === 'noHeat') return null;
  return { rewards: variant !== 'heatAvoid', ascW: SIM.VAL_ASC };
}

export function createPlannerBot({ classId, risk, tree, style = 'balanced', variant = null, combat = null, name = 'planner' }) {
  const hm = plannerHourMult(variant);
  const heat = plannerHeat(variant);
  return createValueBot(name, {
    classId, tree, variant, style, campBar: true,
    kit: { ...FULL_KIT, ember: true },
    combat,
    hub: (s) => hubFull(s, (x) => innByValue(x, risk, style, hm, heat)),
    map: (s) => planMap(s, risk, style, hm, heat).action,
    grindWaves: (s) => valueGrindWaves(s, risk, style, hm, heat),
  });
}
