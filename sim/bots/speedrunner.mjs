// speedrunner bot (balance.md 1): path search minimising hours to reach the zone exit level; TRAVEL_ON as soon
// as legal; Camp grind only to reach 60; build and bar as the planner (boss bar at the Camp); trains at hubs only;
// buys Healing Draughts to HEAL_STOCK_TARGET; no vendor nodes; autoplay combat; autoplay time profile.
// The search cost is in hours: node hours + P(death) × VAL_DEATH / VAL_TIME, and a zone left under the travel level
// (exitLevelOf: exit level - TRAVEL_EARLY_LEVELS) after the last row adds the missing levels × VAL_XP / VAL_TIME (the
// value function's own exchange rates). Its value calls carry hourMult = PLANNER_TIME_MULT (balance.md 1.1, M2 v3);
// the search uses only their hours and P(death), so the weight does not change its choices (spec reading, see the
// sim hand-off of 2026-11-10).
// Expedition map (expedition.md 10.2; MILESTONES 2b.4; M2b v12 row 4, D103): speedFog, balance.md 1's speedrunner on the
// fog view: a belief search of depth PLANNER_FOG_DEPTH minimising tolls + P(death) × VAL_DEATH / VAL_TIME + the levels
// still missing to 10z - 1 at the search's end × VAL_XP / VAL_TIME (speedMap's cost; no gear, gold, heat or boon
// terms), the fog model of planFog and the Dimming exactly (Dimmed encounters at the engine's tolls, M2b v12); the
// contract sites of its Delves count as their reward's XP only. When the level reaches 10z - 1: the cheapest Road, or the
// Bell when that way crosses the Dimming or takes longer than the Bell's channel (unchanged). Variant 'v11' (arm 9 of
// changes-m2b-v12.md, diagnostic): the v11 policy, the planner's belief search with the full value function at the speed
// style's time weight (PLANNER_TIME_MULT × STYLE_SPEED_TIME_MULT).
// Contracts (2b.5, prep): start camp speedPrep (Delves, Second Clapper, Field Draughts), a Delve hub contract from
// Reserve (shared.mjs).
import { C, R, legal, hpFrac, dimFightTime } from '../lib/engine.mjs';
import { BAL, SIM, EXP } from '../lib/params.mjs';
import { makeCtx, evalNode, copyM, levelPos, eatModel, contractValue, siteTerm } from '../lib/model.mjs';
import { dimRisk } from '../lib/risk.mjs';
import { createValueBot, FULL_KIT, speedPrep, speedHubContract } from './shared.mjs';
import { exitLevelOf, planFog, exitStep, expExitLevel, contractSites, siteType } from './planner.mjs';
import { fogInput, escapeV, viewHops, dimmedAtV, dimDepthV, enterableV, typeBelief, protoCell, siteKnowledge, shardZoneV, dimTollsV } from '../lib/view.mjs';
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

// ---------------- Expedition map (expedition.md 10.2; M2b v12 row 4, D103) ----------------
/**
 * The speedrunner's search on the fog view (balance.md 1; changes-m2b-v12.md row 4): the move that minimises, in tolls,
 * node tolls + P(death) × VAL_DEATH / VAL_TIME (+ AVOID_H on vendor and trainer nodes, as speedMap) + walks + Dimmed
 * encounters (the engine's tolls: TIME_DIM_ESCAPE after an outward walk, else TIME_DIM_FIGHT; death and HP from the risk
 * table's `dim` rows) + leaving (the cheaper of the Road: walk, Dimmed steps and TIME_TRAVEL; and the Bell: its channel and
 * an encounter if the node dims during it) + the levels still missing to `exit` at the search's end × VAL_XP / VAL_TIME.
 * The level term is booked per step (a node's cost less the levels it brings, capped at `exit`, × VAL_XP / VAL_TIME), which
 * is the same sum up to a constant. No gear, gold, heat or boon terms. Fog model as planFog: an unseen node is valued over
 * its region kind's weights (a type that costs more than walking through is passed on arrival), the Dimming exactly; a
 * search step deeper than the first that costs more than walking through is passed. sites: siteKnowledge with each held
 * contract valued at its XP only (contractValue xpOnly). Returns { action, cost, options }.
 */
export function speedFog(view, ctx, { exit, sites = null, depth = EXP.PLANNER_FOG_DEPTH }) {
  const sz = shardZoneV(view);
  const W = view.walkTime;
  // Tolls in the model: each one advances its hours and lets it eat (evalNode's one-toll default cell).
  const walk = (m, n) => { for (let i = 0; i < n; i++) evalNode(ctx, m, { type: 'walk' }); return n; };
  const dim = (m, d, tolls) => {
    const r = dimRisk(ctx.risk, d);
    walk(m, tolls);
    m.hp = Math.max(0.02, m.hp - r.hp);
    eatModel(m);
    return tolls + Math.min(0.9, r.p) * DEATH_H;
  };
  const capPos = (m) => Math.min(exit, levelPos(m));
  const node = (m, cell) => {
    const p0 = capPos(m);
    const ev = evalNode(ctx, m, cell);
    const avoid = cell.type === 'vendor' || cell.type === 'trainer' ? AVOID_H : 0;
    return { cost: ev.hours + ev.pDeath * DEATH_H + avoid - (capPos(m) - p0) * LEVEL_H, hours: ev.hours };
  };
  // A contract site (siteTerm with XP-only values, value units / VAL_TIME), capped at the levels still missing.
  const site = (m, id) => (sites ? -Math.min(siteTerm(sites, m, id) / BAL.VAL_TIME, Math.max(0, exit - levelPos(m)) * LEVEL_H) : 0);
  const enter = (m, id) => {
    const n = view.nodes[id];
    if (n.know === 'full') { const r = node(m, n); return { cost: r.cost + site(m, id), hours: r.hours }; }
    const st = n.know === 'none' ? siteType(sites, id) : null;
    const bel = n.know === 'type' ? [[n.type, 1]] : st ? [[st, 1]] : typeBelief(view, n);
    let cost = 0;
    let hours = 0;
    let mFirst;
    for (const [t, p] of bel) {
      const m2 = copyM(m);
      const r = node(m2, protoCell(view, n, t));
      const pass = r.cost > W;
      cost += p * (pass ? W : r.cost);
      hours += p * (pass ? W : r.hours);
      if (mFirst === undefined) mFirst = pass ? null : m2;
    }
    if (mFirst) Object.assign(m, mFirst);
    else walk(m, W);
    return { cost: cost + site(m, id), hours: Math.max(W, Math.round(hours)) };
  };
  const escMemo = new Map();
  const esc = (id, zt) => {
    const k = id * 4096 + zt;
    let e = escMemo.get(k);
    if (!e) { e = escapeV(view, id, zt); escMemo.set(k, e); }
    return e;
  };
  const leaveRoad = (pos, zt, m) => {
    const e = esc(pos, zt);
    if (e.road === null) return Infinity;
    const m2 = copyM(m);
    let c = walk(m2, e.time - e.dimTime);
    for (let i = 0; i < e.dims; i++) c += dim(m2, e.dims ? e.depth / e.dims : 0, dimFightTime(i < e.esc));
    return c + view.travelTime;
  };
  const leaveBell = (pos, zt, m, bell) => {
    if (bell <= 0) return Infinity;
    const m2 = copyM(m);
    let c = walk(m2, view.bell.channelTime);
    const dd = dimDepthV(view, pos, zt + view.bell.channelTime);
    if (dd >= 0) c += dim(m2, dd, C.TIME_DIM_FIGHT);
    return c;
  };
  const resolved = new Set();
  const siteLeaf = (pos, zt, m, bell) => {
    let best = Infinity;
    for (const t of sites.known) {
      if (t === pos || resolved.has(t)) continue;
      const h = viewHops(view, t)[pos];
      if (!(h >= 1) || h === Infinity) continue;
      const arrive = zt + (h - 1) * W;
      if (dimmedAtV(view, t, arrive)) continue;
      const n = view.nodes[t];
      const m2 = copyM(m);
      let c = walk(m2, (h - 1) * W);
      const r = node(m2, n.know === 'full' ? n : protoCell(view, n, n.know === 'type' ? n.type : siteType(sites, t)));
      c += r.cost + site(m2, t);
      let zt2 = arrive + r.hours;
      const dd = dimDepthV(view, t, zt2);
      if (dd >= 0) { c += dim(m2, dd, C.TIME_DIM_FIGHT); zt2 += C.TIME_DIM_FIGHT; }
      c += Math.min(leaveRoad(t, zt2, m2), leaveBell(t, zt2, m2, bell));
      if (c < best) best = c;
    }
    return best;
  };
  const leaf = (pos, zt, m, bell) => {
    const c = Math.min(leaveRoad(pos, zt, m), leaveBell(pos, zt, m, bell));
    return sites && sites.known.length ? Math.min(c, siteLeaf(pos, zt, m, bell)) : c;
  };
  const rec = (pos, zt, m, d, bell) => {
    let best = leaf(pos, zt, m, bell);
    if (d >= depth || levelPos(m) >= exit) return best;
    for (const id of view.nodes[pos].nb) {
      const m2 = copyM(m);
      const nv = view.nodes[id];
      let c;
      let zt2;
      if (enterableV(view, id, zt, resolved) || (nv.know !== 'full' && !nv.hub && !resolved.has(id) && !dimmedAtV(view, id, zt))) {
        const r = enter(m2, id);
        zt2 = zt + r.hours;
        c = r.cost;
        if (c > W) {
          // Deeper in the search a node that costs more than walking through is passed (PASS_THROUGH: TIME_DIM_FIGHT).
          Object.assign(m2, copyM(m));
          c = walk(m2, W);
          zt2 = zt + W;
          const dd = dimDepthV(view, id, zt2);
          if (dd >= 0) { c += dim(m2, dd, C.TIME_DIM_FIGHT); zt2 += C.TIME_DIM_FIGHT; }
          c += rec(id, zt2, m2, d + 1, bell);
        } else {
          const dd = dimDepthV(view, id, zt2);
          if (dd >= 0) { c += dim(m2, dd, C.TIME_DIM_FIGHT); zt2 += C.TIME_DIM_FIGHT; }
          resolved.add(id);
          c += rec(id, zt2, m2, d + 1, bell);
          resolved.delete(id);
        }
      } else {
        // A walk (MOVE onto the hub, a resolved node or a node Dimmed now): outward, its encounter costs TIME_DIM_ESCAPE.
        zt2 = zt + W;
        c = walk(m2, W);
        const dd = dimDepthV(view, id, zt2);
        if (dd >= 0) { const t = dimTollsV(sz, pos, id, true); c += dim(m2, dd, t); zt2 += t; }
        c += rec(id, zt2, m2, d + 1, bell);
      }
      if (c < best) best = c;
    }
    return best;
  };
  const zt = view.zt;
  const pos = view.pos;
  const m0 = ctx.m;
  const bell = view.bell.charges;
  const options = [];
  if (view.onRoad) options.push({ action: { type: 'TAKE_ROAD' }, cost: view.travelTime });
  if (bell > 0) options.push({ action: { type: 'RING_BELL' }, cost: leaveBell(pos, zt, m0, bell) });
  for (const mv of view.moves) {
    const id = mv.nodeId;
    if (mv.via === 'enter') {
      const m2 = copyM(m0);
      const r = enter(m2, id);
      let c = r.cost;
      let zt2 = zt + mv.time;
      const dd = dimDepthV(view, id, zt2);
      if (dd >= 0) { c += dim(m2, dd, C.TIME_DIM_FIGHT); zt2 += C.TIME_DIM_FIGHT; }
      resolved.add(id);
      c += rec(id, zt2, m2, 1, bell);
      resolved.delete(id);
      options.push({ action: { type: 'MOVE', nodeId: id }, cost: c });
    }
    const m3 = copyM(m0);
    let w = walk(m3, W);
    let zt3 = zt + W;
    const dd = dimDepthV(view, id, zt3);
    if (dd >= 0) { const t = dimTollsV(sz, pos, id, mv.via !== 'enter'); w += dim(m3, dd, t); zt3 += t; }
    w += rec(id, zt3, m3, 1, bell);
    options.push({ action: mv.via === 'enter' ? { type: 'PASS_THROUGH', nodeId: id } : { type: 'MOVE', nodeId: id }, cost: w });
  }
  if (!options.length) options.push({ action: exitStep(view).action, cost: Infinity });
  let best = options[0];
  for (const o of options) if (o.cost < best.cost) best = o;
  return { action: best.action, cost: best.cost, options };
}

/** The held contracts' sites on the fog view, each valued at its reward's XP only (row 4: "count as their XP only"). */
export function speedSites(s, view, ctx) {
  const sk = siteKnowledge(s, view);
  if (sk) for (const k of sk.act) k.value = contractValue(ctx, k.reward, { xpOnly: true });
  return sk;
}

/**
 * The speedrunner's expedition map decision from the fog view: at 10z - 1 the exit rule (the cheapest Road, or the Bell
 * when that way crosses the Dimming or takes longer than the channel); before it speedFog (M2b v12 row 4), or with
 * variant 'v11' the v11 policy (planFog with the full value function at the speed style's time weight; arm 9).
 */
export function speedExpMap(s, risk, variant = null) {
  const view = fogInput(s);
  const v11 = variant === 'v11';
  const ctx = v11 ? makeCtx(s, risk, { style: 'speed', hourMult: BAL.PLANNER_TIME_MULT }) : speedCtx(s, risk);
  const exit = expExitLevel(view.z) - 1;
  if (levelPos(ctx.m) >= exit) {
    if (view.onRoad) return { type: 'TAKE_ROAD' };
    const e = escapeV(view, view.pos, view.zt);
    if (view.bell.charges > 0 && (e.dims > 0 || e.time > view.bell.channelTime)) return { type: 'RING_BELL' };
    return exitStep(view).action;
  }
  if (v11) return planFog(view, ctx, { exit, leaveNow: true, bellKeep: 0, sites: contractSites(s, view, ctx) }).action;
  return speedFog(view, ctx, { exit, sites: speedSites(s, view, ctx) }).action;
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
    map: (s) => (s.mapMode === 'expedition' ? speedExpMap(s, risk, variant) : speedMap(s, risk)),
    grindWaves: (s) => speedGrindWaves(s, risk),
    prep: speedPrep,
    hubContract: speedHubContract,
  });
}
