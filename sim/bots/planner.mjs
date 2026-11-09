// planner bot (balance.md 1): full path search over the visible zone map (at most 3^ZONE_CHOICE_ROWS paths) maximising the
// value function 1.1 over the remaining zone, including rest timing and the travel-on point; standard build of
// its tree (1.3); bar template 1.2 with the boss bar at the Camp; trains everything at each hub, keeps
// HEAL_STOCK_TARGET Healing Draughts, buys an Ember of Return when affordable and gold after it >=
// EMBER_RESERVE_V × V; autoplay combat; manual time profile.
import { C, R, legal, hpFrac } from '../lib/engine.mjs';
import { makeCtx, evalNode, copyM } from '../lib/model.mjs';
import { createValueBot, hubFull, FULL_KIT } from './shared.mjs';

const ROWS = C.ZONE_CHOICE_ROWS;

/** Best value obtainable after node (r, l) (1-based row r) from model state m: travel when allowed, else go on. */
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

/** Path search from the current map position. Returns { action, value, options }. */
export function planMap(s, risk, style) {
  const view = R.mapView(s);
  const ctx = makeCtx(s, risk, { style });
  const exit = exitLevelOf(s);
  const options = [];
  if (legal(s, { type: 'TRAVEL_ON' })) options.push({ action: { type: 'TRAVEL_ON' }, value: 0 });
  const r = view.pos.r + 1;
  for (const lane of view.next) {
    const m = copyM(ctx.m);
    const ev = evalNode(ctx, m, view.rows[r - 1][lane]);
    options.push({ action: { type: 'CHOOSE_NODE', lane }, value: ev.value + bestFrom(ctx, view.rows, r, lane, m, exit) });
  }
  let best = options[0];
  for (const o of options) if (o.value > best.value) best = o;
  return { action: best.action, value: best.value, options };
}

/** Grind waves for the current grind node: as many as have positive marginal value (at least 1). */
export function valueGrindWaves(s, risk, style) {
  const ctx = makeCtx(s, risk, { style });
  const view = R.mapView(s);
  const v = view.rows[s.node.r - 1][s.node.l];
  const ev = evalNode(ctx, copyM(ctx.m), v);
  return Math.max(1, Math.min(C.GRIND_MAX_WAVES, ev.waves || 1));
}

/** Inn when its value (banked rested XP, minus hours) is positive or HP is low. */
export function innByValue(s, risk, style) {
  if (hpFrac(s) < 0.7 || (s.player.d.maxMana && s.player.mana < 0.5 * s.player.d.maxMana)) return true;
  const ctx = makeCtx(s, risk, { style });
  return evalNode(ctx, copyM(ctx.m), { type: 'rest' }).value > 0;
}

export function createPlannerBot({ classId, risk, tree, style = 'balanced', variant = null, combat = null, name = 'planner' }) {
  return createValueBot(name, {
    classId, tree, variant, style, campBar: true,
    kit: { ...FULL_KIT, ember: true },
    combat,
    hub: (s) => hubFull(s, (x) => innByValue(x, risk, style)),
    map: (s) => planMap(s, risk, style).action,
    grindWaves: (s) => valueGrindWaves(s, risk, style),
  });
}
