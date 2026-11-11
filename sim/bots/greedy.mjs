// greedy bot (balance.md 1): the reachable node with the highest immediate value per hour (value function 1.1),
// no lookahead; travels on at exit level only if no remaining reachable node beats GREEDY_STAY_THRESHOLD; fixed
// default build per class (1.3); bar template 1.2 (no boss bar swap); trains everything at each hub; keeps
// HEAL_STOCK_TARGET Healing Draughts; autoplay combat; manual time profile. Hour weight 1 (balance.md 1.1, M2 v3: no
// lookahead, so no PLANNER_TIME_MULT).
// Expedition map (expedition.md 10.2; MILESTONES 2b.4): greedyExpMap on the fog view only (sim/lib/view.mjs): the best
// adjacent node by value per toll; threat rule: never step into a node that dims within EXP_GREEDY_DIM_MARGIN tolls of
// arrival (for a node entered: of the end of its content) unless leaving; when the front is within one hop: leave if L >= 10z - 2 (Bell if held, else the Road, else
// walk to the Road farthest from the Shardfall), else retreat to the best neighbour farther from the Shardfall that does
// not dim within the margin. Leaves at 10z when no adjacent node beats GREEDY_STAY_THRESHOLD; otherwise walks to the
// nearest unresolved node it may enter. Contracts (2b.5, prep): the site term of 10.3 on adjacent nodes; walks to the
// nearest known site first (also at 10z); start camp greedyPrep, hub contract from Reserve (shared.mjs).
// Clean-escape test (M2b v10, D87; the engine's rules 1.9.9 step 3): a node is entered only if it is not Dimmed when its
// content ends and a Road can be reached from it then without a Dimmed step (escapeV on the fog view); a walk target
// must pass the same test at its arrival (an unseen target after EXPED_TIME_QUEST tolls, as the engine's policy).
import { C, R, legal } from '../lib/engine.mjs';
import { BAL, SIM } from '../lib/params.mjs';
import { makeCtx, evalNode, copyM, levelPos, siteTerm } from '../lib/model.mjs';
import { createValueBot, hubFull, FULL_KIT, greedyPrep, greedyHubContract } from './shared.mjs';
import { valueGrindWaves, innByValue, exitStep, expExitLevel, expHub, contractSites } from './planner.mjs';
import { fogInput, viewHops, enterableV, escapeV } from '../lib/view.mjs';

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

/** The greedy's expedition map decision from the fog view (threat rule of expedition.md 10.2). */
export function greedyExpMap(s, risk) {
  const view = fogInput(s);
  const ctx = makeCtx(s, risk, { hourMult: 1 });
  const zt = view.zt;
  const pos = view.pos;
  const L = levelPos(ctx.m);
  const exit = expExitLevel(view.z);
  const margin = SIM.EXP_GREEDY_DIM_MARGIN;
  const shard = viewHops(view, view.shardfall);
  const safe = (id, at) => view.nodes[id].dimAt - at > margin;
  // Clean escape at zone toll `at` (the end of the node's content): not Dimmed, and a Road without a Dimmed step.
  const clean = (id, at) => at < view.nodes[id].dimAt && escapeV(view, id, at).dims === 0;
  const step = (id) => {
    const mv = view.moves.find((x) => x.nodeId === id);
    return mv && mv.via === 'enter' ? { type: 'PASS_THROUGH', nodeId: id } : { type: 'MOVE', nodeId: id };
  };
  const leave = (bell) => {
    if (bell && view.bell.charges > 0) return { type: 'RING_BELL' };
    if (view.onRoad) return { type: 'TAKE_ROAD' };
    let far = view.roads[0];
    for (const r of view.roads) if (shard[r] > shard[far]) far = r;
    return exitStep(view, [far]).action;
  };
  const near = view.nodes[pos].dimmed || view.nodes[pos].nb.some((id) => view.nodes[id].dimmed);
  // Contract sites (prep; expedition.md 10.2-10.3): the site term on adjacent nodes; the known sites to walk to.
  const sk = contractSites(s, view, ctx);
  const scored = [];
  for (const mv of view.moves) {
    if (mv.via !== 'enter') continue;
    const m = copyM(ctx.m);
    const ev = evalNode(ctx, m, view.nodes[mv.nodeId]);
    // "Arrival" read as the end of the node's content, when the player is back on the map and the engine checks the
    // Dimming (rules 1.9.6 settle step): entering at the front's edge is a Dimmed encounter at its end.
    if (!safe(mv.nodeId, zt + ev.hours) || !clean(mv.nodeId, zt + ev.hours)) continue;
    scored.push({ id: mv.nodeId, v: (ev.value + siteTerm(sk, m, mv.nodeId)) / Math.max(1, ev.hours) });
  }
  scored.sort((a, b) => b.v - a.v);
  if (near) {
    if (L >= exit - 2) return leave(true);
    const away = view.nodes[pos].nb.filter((id) => shard[id] > shard[pos] && safe(id, zt + view.walkTime));
    const best = scored.find((x) => away.includes(x.id));
    if (best) return { type: 'MOVE', nodeId: best.id };
    if (away.length) return step(away[0]);
    return leave(true);
  }
  const best = scored[0];
  const sites = sk ? sk.known.filter((id) => id !== pos) : [];
  if (L >= exit && (!best || best.v < BAL.GREEDY_STAY_THRESHOLD) && !sites.length) return leave(false);
  if (best && best.v > 0) return { type: 'MOVE', nodeId: best.id };
  // Nothing worth it next door: walk towards the nearest known contract site, else the nearest unresolved node it may
  // enter (BFS over safe nodes); at the exit level only towards a site.
  const N = view.nodes.length;
  const prev = new Array(N).fill(-2);
  const dist = new Array(N).fill(0);
  prev[pos] = -1;
  const q = [pos];
  // Clean escape of a walk target reached after `steps` walks: content time from the model when the node is seen,
  // else EXPED_TIME_QUEST (the engine's policy for unseen targets).
  const cleanTarget = (v, steps) => {
    const n = view.nodes[v];
    const arrive = zt + steps * view.walkTime;
    const t = n.know === 'full' ? evalNode(ctx, copyM(ctx.m), n).hours : C.EXPED_TIME_QUEST;
    return clean(v, arrive + t);
  };
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    const at = zt + view.walkTime * (i === 0 ? 1 : 2);
    for (const v of view.nodes[u].nb) {
      if (prev[v] !== -2 || !safe(v, at)) continue;
      prev[v] = u;
      dist[v] = dist[u] + 1;
      q.push(v);
      const n = view.nodes[v];
      const open = (sites.length ? sites.includes(v)
        : n.know !== 'full' ? !n.hub : enterableV(view, v, zt) && !scored.some((x) => x.id === v)) && v !== pos && cleanTarget(v, dist[v]);
      if (open) {
        let x = v;
        while (prev[x] !== pos) x = prev[x];
        return step(x);
      }
    }
  }
  return leave(false);
}

export function createGreedyBot({ classId, risk, tree }) {
  const inn = (x) => innByValue(x, risk, 'balanced', 1);
  return createValueBot('greedy', {
    classId, tree, campBar: false,
    kit: { ...FULL_KIT },
    hub: (s) => (s.mapMode === 'expedition' ? expHub(s, inn) : hubFull(s, inn)),
    map: (s) => (s.mapMode === 'expedition' ? greedyExpMap(s, risk) : greedyMap(s, risk)),
    grindWaves: (s) => valueGrindWaves(s, risk, 'balanced', 1),
    prep: (s) => greedyPrep(s, risk),
    hubContract: greedyHubContract,
  });
}
