// speedrunner bot (balance.md 1): path search minimising hours to reach the zone exit level; TRAVEL_ON as soon
// as legal; Camp grind only to reach 60; build and bar as the planner (boss bar at the Camp); trains at hubs only;
// buys Healing Draughts to HEAL_STOCK_TARGET; no vendor nodes; autoplay combat; autoplay time profile.
// The search cost is in hours: node hours + P(death) × VAL_DEATH / VAL_TIME, and a zone left under the travel level
// (exitLevelOf: exit level - TRAVEL_EARLY_LEVELS) after the last row adds the missing levels × VAL_XP / VAL_TIME (the
// value function's own exchange rates). Its value calls carry hourMult = PLANNER_TIME_MULT (balance.md 1.1, M2 v3);
// the search uses only their hours and P(death), so the weight does not change its choices (spec reading, see the
// sim hand-off of 2026-11-10).
// Expedition map (expedition.md 10.2; MILESTONES 2b.4): speedExpMap, the planner's belief search on the fog view with
// the speed style's time weight (PLANNER_TIME_MULT × STYLE_SPEED_TIME_MULT) until the level reaches 10z - 1, then
// the cheapest Road, or the Bell when that way crosses the Dimming or takes longer than the Bell's channel.
import { C, R, legal, hpFrac } from '../lib/engine.mjs';
import { BAL, SIM } from '../lib/params.mjs';
import { makeCtx, evalNode, copyM, levelPos } from '../lib/model.mjs';
import { createValueBot, FULL_KIT } from './shared.mjs';
import { exitLevelOf, planFog, exitStep, expExitLevel } from './planner.mjs';
import { fogInput, escapeV } from '../lib/view.mjs';
import { trainerUseful } from '../lib/policy.mjs';

const ROWS = C.ZONE_CHOICE_ROWS;
const DEATH_H = BAL.VAL_DEATH / BAL.VAL_TIME;
const LEVEL_H = BAL.VAL_XP / BAL.VAL_TIME;
const AVOID_H = 1000; // vendor and trainer nodes: only when no other lane exists

function nodeOptions(node) {
  return node.type === 'grind' ? [1, 2, 3].slice(0, C.GRIND_MAX_WAVES) : [0];
}

function nodeCost(ctx, m, node, waves) {
  const ev = evalNode(ctx, m, node, waves ? { grindWaves: waves } : {});
  return ev.hours + ev.pDeath * DEATH_H + (node.type === 'vendor' || node.type === 'trainer' ? AVOID_H : 0);
}

/** Least cost to reach the exit level after node (r, l) from model state m. */
function costFrom(ctx, rows, r, l, m, exit) {
  if (m.L >= exit) return 0;
  if (r >= ROWS) return Math.max(0, exit - levelPos(m)) * LEVEL_H;
  let best = Infinity;
  for (let nl = l - 1; nl <= l + 1; nl++) {
    if (nl < 0 || nl >= C.LANES) continue;
    const node = rows[r][nl];
    for (const w of nodeOptions(node)) {
      const m2 = copyM(m);
      const c = nodeCost(ctx, m2, node, w) + costFrom(ctx, rows, r + 1, nl, m2, exit);
      if (c < best) best = c;
    }
  }
  return best;
}

const speedCtx = (s, risk) => makeCtx(s, risk, { hourMult: BAL.PLANNER_TIME_MULT });

export function speedMap(s, risk) {
  if (legal(s, { type: 'TRAVEL_ON' })) return { type: 'TRAVEL_ON' };
  const view = R.mapView(s);
  const ctx = speedCtx(s, risk);
  const exit = exitLevelOf(s);
  const r = view.pos.r + 1;
  let best = null;
  for (const lane of view.next) {
    const node = view.rows[r - 1][lane];
    for (const w of nodeOptions(node)) {
      const m = copyM(ctx.m);
      const c = nodeCost(ctx, m, node, w) + costFrom(ctx, view.rows, r, lane, m, exit);
      if (!best || c < best.c) best = { lane, c };
    }
  }
  return { type: 'CHOOSE_NODE', lane: best.lane };
}

export function speedGrindWaves(s, risk) {
  const view = R.mapView(s);
  const ctx = speedCtx(s, risk);
  const exit = exitLevelOf(s);
  const node = view.rows[s.node.r - 1][s.node.l];
  let best = null;
  for (const w of nodeOptions(node)) {
    const m = copyM(ctx.m);
    const c = nodeCost(ctx, m, node, w) + costFrom(ctx, view.rows, s.node.r, s.node.l, m, exit);
    if (!best || c < best.c) best = { w, c };
  }
  return best.w;
}

/** The speedrunner's expedition map decision from the fog view. */
export function speedExpMap(s, risk) {
  const view = fogInput(s);
  const ctx = makeCtx(s, risk, { style: 'speed', hourMult: BAL.PLANNER_TIME_MULT });
  const exit = expExitLevel(view.z) - 1;
  if (levelPos(ctx.m) >= exit) {
    if (view.onRoad) return { type: 'TAKE_ROAD' };
    const e = escapeV(view, view.pos, view.zt);
    if (view.bell.charges > 0 && (e.dims > 0 || e.time > view.bell.channelTime)) return { type: 'RING_BELL' };
    return exitStep(view).action;
  }
  return planFog(view, ctx, { exit, leaveNow: true, bellKeep: 0 }).action;
}

export function createSpeedrunnerBot({ classId, risk, tree, variant = null }) {
  return createValueBot('speedrunner', {
    classId, tree, variant, campBar: true,
    kit: { ...FULL_KIT, gear: true },
    hub: (s) => {
      const u = s.hub.used;
      if (s.mapMode === 'expedition' && !legal(s, { type: 'SERVICE', service: 'vendor' }) && !legal(s, { type: 'SERVICE', service: 'trainer' }) && !legal(s, { type: 'SERVICE', service: 'inn' })) return { type: 'LEAVE_HUB' };
      if (!u.trainer && trainerUseful(s)) return { type: 'SERVICE', service: 'trainer' };
      if (!u.vendor) return { type: 'SERVICE', service: 'vendor' };
      if (!u.inn && hpFrac(s) < SIM.SPEED_INN_HP) return { type: 'SERVICE', service: 'inn' };
      return { type: 'LEAVE_HUB' };
    },
    map: (s) => (s.mapMode === 'expedition' ? speedExpMap(s, risk) : speedMap(s, risk)),
    grindWaves: (s) => speedGrindWaves(s, risk),
  });
}
