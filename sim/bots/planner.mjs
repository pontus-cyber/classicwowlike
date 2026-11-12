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
// Expedition map (expedition.md 10.1-10.2; MILESTONES 2b.4): planFog, a belief search of depth PLANNER_FOG_DEPTH over
// moves on the fog view only (sim/lib/view.mjs fogInput): seen nodes valued exactly, unseen nodes as the expectation
// over the region kind's weights (zone mean when the region is unknown), the Dimming exactly, Dimmed encounters priced
// from the risk table's `dim` rows by depth (M2b v10 row C2: learned, prior SIM.EXP_DIM_DEATH × (1 + depth)) at the tolls
// the engine spends (M2b v12, D101: TIME_DIM_ESCAPE after a walk farther from the Shardfall, view.mjs dimTollsV; else
// TIME_DIM_FIGHT; the search's zone time advances by them, SIM.PLANNER_DIM_CLOCK, M2b v13 measure), leaf = leaving by the
// cheapest Road (Dimmed steps on the way) or the Bell, leaving
// valued with an under-level penalty (SIM.EXP_UNDER_LEVEL_VALUE per level under 10z). Contract sites (2b.5, prep;
// expedition.md 10.3): the site term on every node entered and a leaf that walks to a known site (contractSites). The
// start camp and the hub contract: plannerPrep, plannerHubContract (shared.mjs). oracleMap: the same search on the
// oracle's full-information view (diagnostic only: C_step, B41; never acts in a measured run). Swift passage (M2b v15
// row 2, D124): a Road reached at zone time <= the view's swift.tolls pays the passage XP (model.mjs swiftModel), valued
// as any XP; a Road taken now uses the view's own swift.xp. No view block (GATES.swiftRoad off): the search as before.
import { C, R, legal, hpFrac, dimFightTime } from '../lib/engine.mjs';
import { BAL, HEAT, SIM, EXP } from '../lib/params.mjs';
import { makeCtx, evalNode, copyM, levelPos, eatModel, contractValue, siteTerm, swiftModel, bankedPos } from '../lib/model.mjs';
import { dimRisk } from '../lib/risk.mjs';
import { createValueBot, hubFull, FULL_KIT, plannerPrep, plannerHubContract } from './shared.mjs';
import { fogInput, oracleInput, dimmedAtV, dimDepthV, enterableV, escapeV, typeBelief, protoCell, siteKnowledge, viewHops, shardZoneV, dimTollsV } from '../lib/view.mjs';

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

// ---------------- Expedition map: belief search on the fog view (expedition.md 10.2) ----------------
/** Zone exit level of zone z (rules 1.9.7 has no gate; the bots aim at ZONE_LEVELS × z, B20). */
export const expExitLevel = (z) => C.ZONE_LEVELS * z;

/** One toll of walking (or a Dimmed encounter's toll) in the model: evalNode's default cell costs 1 toll. */
function tollCost(ctx, m, n) {
  let v = 0;
  for (let i = 0; i < n; i++) v += evalNode(ctx, m, { type: 'walk' }).value;
  return v;
}

/** Value of a Dimmed encounter at depth d in the model (death chance and HP lost from the risk table's `dim` rows, its
 *  tolls: TIME_DIM_FIGHT, or TIME_DIM_ESCAPE after an outward walk, M2b v12); mutates m. */
function dimCost(ctx, m, d, tolls = C.TIME_DIM_FIGHT) {
  const r = dimRisk(ctx.risk, d);
  const p = Math.min(0.9, r.p);
  const v = tollCost(ctx, m, tolls) - p * BAL.VAL_DEATH;
  m.hp = Math.max(0.02, m.hp - r.hp);
  eatModel(m);
  return v;
}

/** Type of a hidden node that is a sure site (a Tracker's mark): Cull 'quest', Bounty 'elite', Delve 'dungeon'; else null. */
export function siteType(sk, id) {
  const l = sk && sk.perNode.get(id);
  if (!l) return null;
  for (const [i, p] of l) if (p >= 1) return { cull: 'quest', bounty: 'elite', delve: 'dungeon' }[sk.act[i].kind];
  return null;
}

/**
 * Value of entering view node id at zone toll zt (exact when seen, belief otherwise), plus its contract site term (sk:
 * siteKnowledge with values, expedition.md 10.3); mutates m; returns { value, hours }.
 */
function enterValue(view, ctx, m, id, zt, pays, sk = null) {
  const n = view.nodes[id];
  if (n.know === 'full') {
    const ev = evalNode(ctx, m, n, { pays: pays || null });
    return { value: ev.value + siteTerm(sk, m, id), hours: ev.hours };
  }
  const st = n.know === 'none' ? siteType(sk, id) : null;
  const bel = n.know === 'type' ? [[n.type, 1]] : st ? [[st, 1]] : typeBelief(view, n);
  let value = 0;
  let hours = 0;
  let mBest = null;
  for (const [t, p] of bel) {
    const m2 = copyM(m);
    const ev = evalNode(ctx, m2, protoCell(view, n, t));
    // Seen on arrival: a node worth less than walking through is passed (option value of the information).
    const walk = -view.walkTime * BAL.VAL_TIME * ctx.hourMult;
    value += p * Math.max(ev.value, walk);
    hours += p * (ev.value >= walk ? ev.hours : view.walkTime);
    if (!mBest) mBest = ev.value >= walk ? m2 : null;
  }
  if (mBest) Object.assign(m, mBest);
  else tollCost(ctx, m, view.walkTime);
  value += siteTerm(sk, m, id);
  return { value, hours: Math.max(view.walkTime, Math.round(hours)) };
}

/**
 * The belief search (expedition.md 10.2 planner). view: the fog view (or the oracle's); ctx: makeCtx of the decision;
 * opts: { depth, exit (level), pays ({nodeId: heat state} of the first step, R.heatPreview), bellKeep (value of holding a
 * Bell charge), leaveNow (speedrunner: leave as soon as the level is reached), sites (contractSites: the site term of
 * expedition.md 10.3 on every node entered, and a leaf that walks to a known site beyond the search depth, enters it and
 * leaves from there) }. Returns { action, value, options }.
 */
export function planFog(view, ctx, opts = {}) {
  const depthMax = opts.depth ?? EXP.PLANNER_FOG_DEPTH;
  const sk = opts.sites || null;
  const exit = opts.exit ?? expExitLevel(view.z);
  const keep = opts.bellKeep ?? (view.z < C.ZONE_COUNT ? EXP.BELL_KEEP_VALUE : 0);
  const under = (m) => -Math.max(0, exit - levelPos(m)) * SIM.EXP_UNDER_LEVEL_VALUE;
  // M2b v13 measure: a Dimmed encounter in the search advances its zone time by the encounter's tolls (SIM.PLANNER_DIM_CLOCK
  // 1, as speedFog and the engine); 0 is the v12 search, which saw the front 1-2 tolls late (balance-2026-11-11h).
  const clk = SIM.PLANNER_DIM_CLOCK ? 1 : 0;
  const sz = shardZoneV(view);
  const escMemo = new Map();
  const esc = (id, zt) => {
    const k = id * 4096 + zt;
    let e = escMemo.get(k);
    if (!e) { e = escapeV(view, id, zt); escMemo.set(k, e); }
    return e;
  };
  // M2b v15 row 2 (D124): the Swift passage (view.swift, player-visible; null while GATES.swiftRoad is off). A Road taken
  // at zone time <= swift.tolls pays its XP before TIME_TRAVEL; valued as any XP (VAL_XP on the banked level position).
  const sw = view.swift || null;
  const swiftValue = (m, ztTake) => {
    const p0 = bankedPos(m);
    return swiftModel(m, sw, ztTake) ? (bankedPos(m) - p0) * BAL.VAL_XP : 0;
  };
  // Leaving from (pos, zt): by the Road (walk there, Dimmed steps, the Swift passage XP when the Road is reached in its
  // window, TIME_TRAVEL) or by the Bell (channel, a Dimmed encounter if the node dims during it, the charge's keep value).
  const leaveRoad = (pos, zt, m) => {
    const e = esc(pos, zt);
    if (e.road === null) return -Infinity;
    const m2 = copyM(m);
    let v = tollCost(ctx, m2, e.time - e.dimTime);
    for (let i = 0; i < e.dims; i++) v += dimCost(ctx, m2, e.dims ? e.depth / e.dims : 0, dimFightTime(i < e.esc));
    if (sw) v += swiftValue(m2, zt + e.time);
    v += tollCost(ctx, m2, view.travelTime);
    return v + under(m2);
  };
  const leaveBell = (pos, zt, m, bell) => {
    if (bell <= 0) return -Infinity;
    const m2 = copyM(m);
    let v = tollCost(ctx, m2, view.bell.channelTime) - keep;
    const dd = dimDepthV(view, pos, zt + view.bell.channelTime);
    if (dd >= 0) v += dimCost(ctx, m2, dd);
    return v + under(m2);
  };
  const resolved = new Set();
  // Known sites (a mark, or a Delve's dungeon) beyond the search: walk there, enter it, then leave by the cheaper way
  // (expedition.md 10.2-10.3: the fog bots walk to the sites they know of).
  const siteLeaf = (pos, zt, m, bell) => {
    let best = -Infinity;
    for (const t of sk.known) {
      if (t === pos || resolved.has(t)) continue;
      const h = viewHops(view, t)[pos];
      if (!(h >= 1) || h === Infinity) continue;
      const arrive = zt + (h - 1) * view.walkTime;
      if (dimmedAtV(view, t, arrive)) continue;
      const n = view.nodes[t];
      const m2 = copyM(m);
      let v = tollCost(ctx, m2, (h - 1) * view.walkTime);
      const ev = evalNode(ctx, m2, n.know === 'full' ? n : protoCell(view, n, n.know === 'type' ? n.type : siteType(sk, t)));
      v += ev.value + siteTerm(sk, m2, t);
      let zt2 = arrive + ev.hours;
      const dd = dimDepthV(view, t, zt2);
      if (dd >= 0) { v += dimCost(ctx, m2, dd); zt2 += clk * C.TIME_DIM_FIGHT; }
      v += Math.max(leaveRoad(t, zt2, m2), leaveBell(t, zt2, m2, bell));
      if (v > best) best = v;
    }
    return best;
  };
  const leaf = (pos, zt, m, bell) => {
    const v = Math.max(leaveRoad(pos, zt, m), leaveBell(pos, zt, m, bell));
    return sk && sk.known.length ? Math.max(v, siteLeaf(pos, zt, m, bell)) : v;
  };
  const rec = (pos, zt, m, d, bell) => {
    let best = leaf(pos, zt, m, bell);
    if (d >= depthMax) return best;
    if (opts.leaveNow && levelPos(m) >= exit) return best;
    for (const id of view.nodes[pos].nb) {
      const m2 = copyM(m);
      let v;
      let zt2;
      if (enterableV(view, id, zt, resolved) || (view.nodes[id].know !== 'full' && !view.nodes[id].hub && !resolved.has(id) && !dimmedAtV(view, id, zt))) {
        const ev = enterValue(view, ctx, m2, id, zt, null, sk);
        zt2 = zt + ev.hours;
        v = ev.value;
        if (v < -view.walkTime * BAL.VAL_TIME * ctx.hourMult) {
          // Deeper in the search a bad node is walked through, not entered.
          Object.assign(m2, copyM(m));
          v = tollCost(ctx, m2, view.walkTime);
          zt2 = zt + view.walkTime;
          const dd = dimDepthV(view, id, zt2);
          if (dd >= 0) { v += dimCost(ctx, m2, dd); zt2 += clk * C.TIME_DIM_FIGHT; }
          v += rec(id, zt2, m2, d + 1, bell);
        } else {
          const dd = dimDepthV(view, id, zt2);
          if (dd >= 0) { v += dimCost(ctx, m2, dd); zt2 += clk * C.TIME_DIM_FIGHT; }
          resolved.add(id);
          v += rec(id, zt2, m2, d + 1, bell);
          resolved.delete(id);
        }
      } else {
        // A walk (MOVE onto the hub, a resolved node or a node Dimmed now): outward, its encounter costs TIME_DIM_ESCAPE.
        zt2 = zt + view.walkTime;
        v = tollCost(ctx, m2, view.walkTime);
        const dd = dimDepthV(view, id, zt2);
        if (dd >= 0) { const t = dimTollsV(sz, pos, id, true); v += dimCost(ctx, m2, dd, t); zt2 += clk * t; }
        v += rec(id, zt2, m2, d + 1, bell);
      }
      if (v > best) best = v;
    }
    return best;
  };
  const zt = view.zt;
  const pos = view.pos;
  const m0 = ctx.m;
  const bell = view.bell.charges;
  const options = [];
  if (view.onRoad) {
    const m2 = copyM(m0);
    // The Swift passage of a Road taken now: the view's own figure (mapView swift.xp = heatPreview(TAKE_ROAD).swift).
    const sv = sw && sw.xp > 0 ? swiftValue(m2, zt) : 0;
    options.push({ action: { type: 'TAKE_ROAD' }, value: sv + tollCost(ctx, m2, view.travelTime) + under(m2) });
  }
  if (bell > 0) options.push({ action: { type: 'RING_BELL' }, value: leaveBell(pos, zt, m0, bell) });
  if (!(opts.leaveNow && levelPos(m0) >= exit)) {
    for (const mv of view.moves) {
      const id = mv.nodeId;
      if (mv.via === 'enter') {
        const m2 = copyM(m0);
        const ev = enterValue(view, ctx, m2, id, zt, opts.pays && opts.pays[id], sk);
        let v = ev.value;
        let zt2 = zt + mv.time;
        const dd = dimDepthV(view, id, zt2);
        if (dd >= 0) { v += dimCost(ctx, m2, dd); zt2 += clk * C.TIME_DIM_FIGHT; }
        resolved.add(id);
        v += rec(id, zt2, m2, 1, bell);
        resolved.delete(id);
        options.push({ action: { type: 'MOVE', nodeId: id }, value: v });
      }
      const m3 = copyM(m0);
      let zt3 = zt + view.walkTime;
      let w = tollCost(ctx, m3, view.walkTime);
      const dd = dimDepthV(view, id, zt3);
      // PASS_THROUGH of an enterable node: TIME_DIM_FIGHT; a MOVE that walks: TIME_DIM_ESCAPE when outward (M2b v12).
      if (dd >= 0) { const t = dimTollsV(sz, pos, id, mv.via !== 'enter'); w += dimCost(ctx, m3, dd, t); zt3 += clk * t; }
      w += rec(id, zt3, m3, 1, bell);
      options.push({ action: mv.via === 'enter' ? { type: 'PASS_THROUGH', nodeId: id } : { type: 'MOVE', nodeId: id }, value: w });
    }
  }
  if (!options.length) options.push(exitStep(view));
  let best = options[0];
  for (const o of options) if (o.value > best.value) best = o;
  return { action: best.action, value: best.value, options };
}

/** The next step of leaving: TAKE_ROAD on a Road, else towards the cheapest Road (walk; pass an unresolved node). */
export function exitStep(view, roads = view.roads) {
  if (view.onRoad) return { action: { type: 'TAKE_ROAD' }, value: 0 };
  const e = escapeV(view, view.pos, view.zt, roads);
  const id = e.path.length > 1 ? e.path[1] : view.nodes[view.pos].nb[0];
  const mv = view.moves.find((x) => x.nodeId === id);
  return { action: mv && mv.via === 'enter' ? { type: 'PASS_THROUGH', nodeId: id } : { type: 'MOVE', nodeId: id }, value: -Infinity };
}

/** Heat states the first step's nodes would pay (R.heatPreview `pays`, a player-visible preview) for the seen neighbours. */
export function firstPays(s, view, heat) {
  if (!heat) return null;
  const out = {};
  for (const mv of view.moves) if (mv.via === 'enter') { const pv = R.heatPreview(s, { type: 'MOVE', nodeId: mv.nodeId }); out[mv.nodeId] = pv ? pv.pays : null; }
  return out;
}

/** The planner's expedition map decision from the fog view (plus its trail-ration top-up through `food`). */
export function planExpMap(s, risk, style, hourMult = 1, heat = null, input = fogInput) {
  const view = input(s);
  const ctx = makeCtx(s, risk, { style, hourMult, heat });
  return planFog(view, ctx, { pays: firstPays(s, view, heat), sites: contractSites(s, view, ctx) });
}

/**
 * Contract sites of the decision (prep; expedition.md 10.3): view.mjs siteKnowledge with each active contract's reward
 * valued at the decision's model state (contractValue: XP levels, the best item choice against what is equipped, gold);
 * null without active contracts.
 */
export function contractSites(s, view, ctx) {
  const sk = siteKnowledge(s, view);
  if (sk) for (const k of sk.act) k.value = contractValue(ctx, k.reward);
  return sk;
}

/**
 * Oracle (diagnostic only; expedition.md 10.2, B41): the planner's search with full information of the current zone
 * (sim/lib/view.mjs oracleInput). The runner calls it next to a planner decision to measure C_step; it never acts in a
 * measured run.
 */
export function oracleMap(s, risk, style, hourMult = 1, heat = null) {
  return planExpMap(s, risk, style, hourMult, heat, oracleInput);
}

/** Hub of the planner family in an expedition run: hubFull while the services are legal (a Dimmed hub has none). */
export function expHub(s, inn) {
  const a = hubFull(s, inn);
  return a.type === 'SERVICE' && !legal(s, a) ? { type: 'LEAVE_HUB' } : a;
}

/**
 * oracle: true builds the oracle as an acting bot (diagnostic only, B41 C_route): the runner plays it on a copy of the
 * zone-entry state to get the oracle's route; it never plays a measured run. combat / talent: the masher's, opener's and
 * onebutton bot's own combat and talent policies (null: autoplay, the standard build of `tree`).
 */
export function createPlannerBot({ classId, risk, tree, style = 'balanced', variant = null, combat = null, talent = null, name = 'planner', oracle = false, rng = null, prepPolicy = null, prepForce = null, prepBan = null }) {
  const hm = plannerHourMult(variant);
  const heat = plannerHeat(variant);
  const inn = (x) => innByValue(x, risk, style, hm, heat);
  const expMap = oracle ? (s) => oracleMap(s, risk, style, hm, heat).action : (s) => planExpMap(s, risk, style, hm, heat).action;
  return createValueBot(oracle ? 'oracle' : name, {
    classId, tree, talent, variant, style, campBar: true,
    kit: { ...FULL_KIT, ember: true },
    combat,
    hub: (s) => (s.mapMode === 'expedition' ? expHub(s, inn) : hubFull(s, inn)),
    map: (s) => (s.mapMode === 'expedition' ? expMap(s) : planMap(s, risk, style, hm, heat).action),
    grindWaves: (s) => valueGrindWaves(s, risk, style, hm, heat),
    // Start camp and hub contract (expedition.md 10.2 planner; prep): plannerPrep, plannerHubContract (shared.mjs);
    // prepForce / prepBan: options bought first / never (M2b v10 cell 9 calibration arms).
    prep: (s) => plannerPrep(s, risk, prepForce, prepBan),
    hubContract: (s) => plannerHubContract(s, risk),
    prepPolicy, rng,
  });
}
