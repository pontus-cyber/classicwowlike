// greedy bot (balance.md 1): the reachable node with the highest immediate value per hour (value function 1.1),
// no lookahead; travels on at exit level only if no remaining reachable node beats GREEDY_STAY_THRESHOLD; fixed
// default build per class (1.3); bar template 1.2 (no boss bar swap); trains everything at each hub; keeps
// HEAL_STOCK_TARGET Healing Draughts; autoplay combat; manual time profile. Hour weight 1 (balance.md 1.1, M2 v3: no
// lookahead, so no PLANNER_TIME_MULT).
import { C, R, legal } from '../lib/engine.mjs';
import { BAL } from '../lib/params.mjs';
import { makeCtx, evalNode, copyM } from '../lib/model.mjs';
import { createValueBot, hubFull, FULL_KIT } from './shared.mjs';
import { valueGrindWaves, innByValue } from './planner.mjs';

const perHour = (ev) => ev.value / Math.max(1, ev.hours);

export function greedyMap(s, risk) {
  const view = R.mapView(s);
  const ctx = makeCtx(s, risk, { hourMult: 1 });
  const r = view.pos.r + 1;
  let best = null;
  for (const lane of view.next) {
    const v = perHour(evalNode(ctx, copyM(ctx.m), view.rows[r - 1][lane]));
    if (!best || v > best.v) best = { lane, v };
  }
  if (legal(s, { type: 'TRAVEL_ON' })) {
    if (!best) return { type: 'TRAVEL_ON' };
    // Every node still reachable from here (rows r..ZONE_CHOICE_ROWS, lanes widening by one per row), valued from now.
    let lo = view.pos.r === 0 ? 0 : Math.max(0, view.pos.l - 1);
    let hi = view.pos.r === 0 ? C.LANES - 1 : Math.min(C.LANES - 1, view.pos.l + 1);
    let stay = false;
    for (let row = r; row <= C.ZONE_CHOICE_ROWS && !stay; row++) {
      for (let l = lo; l <= hi && !stay; l++) {
        if (perHour(evalNode(ctx, copyM(ctx.m), view.rows[row - 1][l])) > BAL.GREEDY_STAY_THRESHOLD) stay = true;
      }
      lo = Math.max(0, lo - 1);
      hi = Math.min(C.LANES - 1, hi + 1);
    }
    if (!stay) return { type: 'TRAVEL_ON' };
  }
  return { type: 'CHOOSE_NODE', lane: best.lane };
}

export function createGreedyBot({ classId, risk, tree }) {
  return createValueBot('greedy', {
    classId, tree, campBar: false,
    kit: { ...FULL_KIT },
    hub: (s) => hubFull(s, (x) => innByValue(x, risk, 'balanced', 1)),
    map: (s) => greedyMap(s, risk),
    grindWaves: (s) => valueGrindWaves(s, risk, 'balanced', 1),
  });
}
