// Heat (rules 1.7.1-1.7.4, 1.9.10, marked "(heat)"; docs/specs/expedition.md section H): time pressure on one meter.
// The line is the par schedule (each zone's share of the boss par), heat = run hours - line, and four states (Clear,
// Warm, Hot, Scorched); in an expedition zone the Dimming's clock on the player's node is a second component and the
// hotter of the two states counts. heatView is the meter's data (any phase after START_RUN), heatPreview the hours an
// hour-costing action costs and the state after it ("2 h, ends Warm"), and, for an action that enters a node, the state
// the node pays at. Both are pure reads: no draws, no changes. The bookkeeping functions (heatHours, heatZoneEntered,
// heatNodeEntered, heatFightWon; called by nodes.js) keep state.stats.heat for the summary block (heatSummary, rules
// 1.7.4); the rewards themselves are paid in progress.js (XP, gold) and items.js (the rarity step) from state.node.heat.
import {
  ZONE_COUNT, HEAT_STATES, HEAT_WARM_AT, HEAT_HOT_AT, HEAT_SCORCH_AT, HEAT_DIM_WARM_H, HEAT_DIM_HOT_H, HEAT_GAIN,
  HEAT_RARITY_UP, HEAT_BAR_MIN, HEAT_BAR_MAX, ASC_CAP, ASC_PER_STEP, ASC_STEP_HOURS, HOURS_TRAVEL, HOURS_WALK,
  HOURS_TRAINER, HOURS_VENDOR, HOURS_REST, HOURS_DIM_FIGHT, BELL_CHANNEL_H,
} from '../constants.js';
import { frac6 } from './util.js';
import { parHours } from './meta.js';
import { nextLanes } from './map.js';
import { isExpedition, zoneHours, dimAt, dimmedAt, nodeHours, grindMaxWaves, canEnter } from './expedition.js';

const IDX = Object.fromEntries(HEAT_STATES.map((k, i) => [k, i]));
/** Index of a heat state in HEAT_STATES (0 = Clear ... 3 = Scorched). */
export const heatIndex = (state) => IDX[state];
/** The hotter of two states; null or undefined counts as no state. */
export function hotter(a, b) {
  if (b === null || b === undefined) return a;
  if (a === null || a === undefined) return b;
  return IDX[b] > IDX[a] ? b : a;
}

/** The line at zone z (rules 1.7.1): parHours × min(z, ZONE_COUNT) / ZONE_COUNT, at 6 decimals; the Camp is z > ZONE_COUNT. */
export function lineAt(oaths, z) {
  return frac6((parHours(oaths) * Math.min(z, ZONE_COUNT)) / ZONE_COUNT);
}

/** Run state of a heat value (rules 1.7.2). */
export function runState(heat) {
  if (heat < HEAT_WARM_AT) return 'clear';
  if (heat < HEAT_HOT_AT) return 'warm';
  if (heat < HEAT_SCORCH_AT) return 'hot';
  return 'scorched';
}

/** Dimming state of the hours until the player's node dims (rules 1.9.10); null when there is no Dimming clock. */
export function dimState(dimIn) {
  if (dimIn === null || dimIn === undefined) return null;
  if (dimIn <= 0) return 'scorched';
  if (dimIn <= HEAT_DIM_HOT_H) return 'hot';
  if (dimIn <= HEAT_DIM_WARM_H) return 'warm';
  return 'clear';
}

/** Boss Ascendancy for `over` hours past the par (rules 1.7): the FIGHT_BOSS formula. Also projects heat (ascIfPar). */
export function ascOver(over) {
  return frac6(Math.min(ASC_CAP, ASC_PER_STEP * Math.floor(Math.max(0, over) / ASC_STEP_HOURS)));
}

/** Zone number the line uses: the current zone; the Camp (z = ZONE_COUNT + 1) counts as ZONE_COUNT. */
const lineZone = (s) => (s.zone.camp ? ZONE_COUNT + 1 : s.zone.z);

/**
 * Hours until node id dims at zone hour hz (rules 1.9.10): dimAt(id) - hz, 0 or less when it is Dimmed. null outside an
 * expedition zone (rows runs, the Camp) and when the run plays without the Dimming (newRun option `dimming: false`).
 */
export function dimInOf(s, id = s.zone.pos, hz = zoneHours(s)) {
  if (!isExpedition(s) || !s.zone || s.zone.camp || s.zone.dimOff) return null;
  return dimAt(s.zone, id) - hz;
}

/** Heat at run hours `hours` with line zone z and Dimming clock dimIn: the parts every view and preview shares. */
function facts(oaths, hours, z, dimIn) {
  const line = lineAt(oaths, z);
  const heat = frac6(hours - line);
  const stateRun = runState(heat);
  const stateDim = dimState(dimIn);
  const state = hotter(stateRun, stateDim);
  return {
    hours, line, heat, stateRun, dimIn, stateDim, state, by: stateDim !== null && IDX[stateDim] > IDX[stateRun] ? 'dim' : 'run',
    ascIfPar: ascOver(heat),
  };
}

/** The combined heat state now (rules 1.7.2, 1.9.10): the state a node entered now pays at (rules 1.7.3). */
export function heatState(s) {
  return facts(s.oaths, s.hours, lineZone(s), dimInOf(s)).state;
}

/**
 * Hours and the place after an hour-costing action, as the engine would spend them (rules 1.4-1.9, 2.0): { hours, z
 * (line zone afterwards), node (expedition: the node the player stands on afterwards, for the Dimming; null when the
 * zone is left or on today's map), enters (node id or lane the action enters), dimFight (a Dimmed encounter follows:
 * HOURS_DIM_FIGHT included), perWave (a Grind whose waves are chosen inside: the hours of one wave) }, or null when
 * the action costs no hours. Legality is not checked here.
 */
function costOf(s, a) {
  const zone = s.zone;
  if (!zone || !a || typeof a !== 'object') return null;
  const exp = isExpedition(s) && !zone.camp;
  const here = exp ? zone.pos : null;
  const nextZ = zone.camp ? null : zone.z + 1;
  const out = (hours, z, node, extra = {}) => {
    if (!(hours > 0)) return null;
    let h = hours;
    let dimFight = false;
    // A step, a node's content, a service or the Bell's channel that ends on a Dimmed node: a Dimmed encounter follows.
    if (exp && node !== null && !zone.dimOff && dimmedAt(zone, node, zoneHours(s) + h)) { h += HOURS_DIM_FIGHT; dimFight = true; }
    return { hours: h, z, node, enters: null, dimFight, perWave: false, ...extra };
  };
  switch (a.type) {
    case 'CHOOSE_NODE': {
      if (exp || zone.camp || !zone.rows) return null;
      const row = zone.rows[zone.pos.r];
      const def = row && row[a.lane];
      if (!def) return null;
      return out(nodeHours(s, def.type), zone.z, null, { enters: a.lane, perWave: def.type === 'grind' && grindMaxWaves(s) > 1 });
    }
    case 'TRAVEL_ON': return exp || zone.camp ? null : out(HOURS_TRAVEL, nextZ, null);
    case 'MOVE': {
      const n = exp && zone.nodes[a.nodeId];
      if (!n) return null;
      if (canEnter(s, n.id)) return out(nodeHours(s, n.type), zone.z, n.id, { enters: n.id, perWave: n.type === 'grind' && grindMaxWaves(s) > 1 });
      return out(HOURS_WALK, zone.z, n.id);
    }
    case 'PASS_THROUGH': return exp && zone.nodes[a.nodeId] ? out(HOURS_WALK, zone.z, a.nodeId) : null;
    case 'TAKE_ROAD': return exp ? out(HOURS_TRAVEL, nextZ, null) : null;
    case 'RING_BELL': {
      if (!exp) return null;
      // The channel's hours, a Dimmed encounter when the node is Dimmed at its end, then the next zone (no HOURS_TRAVEL).
      const c = out(BELL_CHANNEL_H, zone.z, here);
      return { ...c, z: nextZ, node: null };
    }
    case 'SERVICE': {
      const h = { trainer: HOURS_TRAINER, vendor: HOURS_VENDOR, inn: HOURS_REST }[a.service];
      return h ? out(h, lineZone(s), here) : null;
    }
    case 'CAMP_GRIND': return zone.camp ? out(nodeHours(s, 'grind'), lineZone(s), null) : null;
    case 'GRIND_SET_WAVES': return Number.isInteger(a.n) && a.n > 0 ? out(a.n * nodeHours(s, 'grind'), zone.z, here) : null;
    case 'NEXT_FIGHT': return s.node && s.node.type === 'grind' ? out(nodeHours(s, 'grind'), zone.z, here) : null;
    default: return null;
  }
}

/**
 * Preview of an hour-costing action (rules 1.7.1, 1.9.10; expedition.md H.4 "2 h, ends Warm"), or null when it costs
 * no hours (legality is not checked; heatView lists only legal ones): `hours` (what it costs), `hoursAfter` (run hours
 * then) and { line, heat, stateRun, dimIn, stateDim, state, by, ascIfPar } after the action, plus `change` (state
 * differs from now), `dimFight` (a Dimmed encounter
 * follows; its hour is included), `perWave` (a Grind whose waves are chosen inside: one wave's hours) and, for an action
 * that enters a node (CHOOSE_NODE, MOVE into an unresolved node), `pays`: the state the node is entered in (now, with
 * the Dimming clock of the node entered), which fixes its rewards (rules 1.7.3); null for other actions.
 */
export function heatPreview(s, a) {
  if (!s.player || !s.zone) return null;
  const c = costOf(s, a);
  if (!c) return null;
  const now = facts(s.oaths, s.hours, lineZone(s), dimInOf(s));
  const dimIn = c.node === null || c.z !== s.zone.z ? null : dimInOf(s, c.node, zoneHours(s) + c.hours);
  const f = facts(s.oaths, s.hours + c.hours, c.z, dimIn);
  const pays = c.enters === null ? null
    : facts(s.oaths, s.hours, lineZone(s), typeof c.enters === 'number' && isExpedition(s) ? dimInOf(s, c.enters) : null).state;
  return {
    hours: c.hours, hoursAfter: f.hours, line: f.line, heat: f.heat, stateRun: f.stateRun, dimIn: f.dimIn, stateDim: f.stateDim,
    state: f.state, by: f.by, ascIfPar: f.ascIfPar, change: f.state !== now.state, dimFight: c.dimFight, perWave: c.perWave, pays,
  };
}

// ---------------- Bookkeeping for the rewards and the summary (rules 1.7.3, 9) ----------------
/** The run's heat counters (state.stats.heat): zone records, and hours, nodes entered and fights won per state. */
export function newHeatStats() {
  return { zones: [], hoursByState: [0, 0, 0, 0], nodesByState: [0, 0, 0, 0], fightsByState: [0, 0, 0, 0] };
}
/** The counters, created when missing (a state saved before heat); only the engine's step functions call this. */
const statsOf = (s) => s.stats.heat || (s.stats.heat = newHeatStats());

/**
 * Hours about to be spent (rules 9 hoursByState): each hour counts in the state it starts in, with the line of the
 * current zone and, in an expedition zone, the Dimming's clock of the player's node (not for travel hours: the player
 * is on the Road). Call before the hours are added to state.hours.
 */
export function heatHours(s, h, why) {
  if (!s.player || !s.zone || !s.stats) return;
  const x = statsOf(s);
  const z = lineZone(s);
  const dim = why !== 'travel' && dimInOf(s) !== null;
  const hz = dim ? zoneHours(s) : 0;
  for (let i = 0; i < h; i++) x.hoursByState[IDX[facts(s.oaths, s.hours + i, z, dim ? dimInOf(s, s.zone.pos, hz + i) : null).state]] += 1;
}

/** A zone or the Camp was entered (s.zone is the new one): the last record gets its exit hours, a new record opens. */
export function heatZoneEntered(s) {
  const x = statsOf(s);
  const last = x.zones[x.zones.length - 1];
  if (last && last.exit === null) last.exit = s.hours;
  x.zones.push({ z: s.zone.z, line: lineAt(s.oaths, lineZone(s)), entry: s.hours, exit: null });
}

/** A node is entered (rules 1.7.3): its heat state is the state now, fixed before its hours; counted per state. */
export function heatNodeEntered(s) {
  const state = heatState(s);
  statsOf(s).nodesByState[IDX[state]] += 1;
  return state;
}

/** A fight was won in a node entered in `state` (rules 1.7.3, 11.1); no state (Camp, boss, Dimmed encounter): not counted. */
export function heatFightWon(s, state) {
  if (state) statsOf(s).fightsByState[IDX[state]] += 1;
}

/**
 * The summary's heat block (rules 9; expedition.md H.6): trackPerZone [{ z, line, entry, exit }] (run hours at arrival
 * and when left; the zone the run ends in: its hours so far), hoursByState, nodesByState, fightsByState (fights won in
 * map nodes by the node's entry state), heatFights (won in Hot or Scorched nodes: the Echo line, rules 11.1). Reads
 * only.
 */
export function heatSummary(s) {
  const x = s.stats.heat || newHeatStats();
  const n = x.zones.length;
  return {
    trackPerZone: x.zones.map((r, i) => ({ ...r, exit: r.exit === null && i === n - 1 ? s.hours : r.exit })),
    hoursByState: x.hoursByState.slice(), nodesByState: x.nodesByState.slice(), fightsByState: x.fightsByState.slice(),
    heatFights: x.fightsByState[IDX.hot] + x.fightsByState[IDX.scorched],
  };
}

/** Hour-costing choices of the current phase, for the meter's previews (rules 1.4, 1.6, 1.9.1, 2.2). */
function choices(s) {
  const out = [];
  const zone = s.zone;
  if (s.phase === 'MAP' && !zone.camp) {
    if (isExpedition(s)) {
      for (const id of zone.nodes[zone.pos].nb) out.push({ type: 'MOVE', nodeId: id }, { type: 'PASS_THROUGH', nodeId: id });
      out.push({ type: 'TAKE_ROAD' }, { type: 'RING_BELL' });
    } else {
      for (const l of nextLanes(zone)) out.push({ type: 'CHOOSE_NODE', lane: l });
      out.push({ type: 'TRAVEL_ON' });
    }
  }
  if (s.phase === 'ZONE_HUB' || s.phase === 'CAMP') {
    for (const sv of ['trainer', 'vendor', 'inn']) out.push({ type: 'SERVICE', service: sv });
    if (s.phase === 'CAMP') out.push({ type: 'CAMP_GRIND' });
  }
  if (s.phase === 'NODE' && s.node && s.node.type === 'grind') {
    for (let n = 1; n <= grindMaxWaves(s); n++) out.push({ type: 'GRIND_SET_WAVES', n });
    out.push({ type: 'NEXT_FIGHT' });
  }
  return out;
}

/**
 * The meter (rules 1.7.1-1.7.2, 1.9.10; expedition.md H.4, H.6), or null before START_RUN: { hours, par, z (the
 * state's zone number, the Camp ZONE_COUNT + 1), line, heat, inHand, past, stateRun, dimIn, stateDim, state, by ('run'
 * or 'dim': the clock that sets the state), ascIfPar, gain, rarityUp (the rewards of the state, rules 1.7.3), bar: {
 * min, max, marker (heat clamped to the bar), beyond (-1, 0, 1) }, node (inside a node: { state, gain, rarityUp } of
 * the state it was entered in, which is what it pays; else null), next: [{ action, ...heatPreview }] for the legal
 * hour-costing choices of the current phase }. `legal(action)` filters the choices (rules.js passes the engine's check).
 */
export function heatView(s, legal = () => true) {
  if (!s.player || !s.zone) return null;
  const f = facts(s.oaths, s.hours, lineZone(s), dimInOf(s));
  const marker = Math.min(HEAT_BAR_MAX, Math.max(HEAT_BAR_MIN, f.heat));
  const next = [];
  if (!s.fight) {
    for (const a of choices(s)) {
      if (!legal(a)) continue;
      const p = heatPreview(s, a);
      if (p) next.push({ action: a, ...p });
    }
  }
  const ns = s.node && s.node.heat ? s.node.heat : null;
  return {
    hours: f.hours, par: parHours(s.oaths), z: s.zone.z, line: f.line, heat: f.heat, inHand: Math.max(0, -f.heat),
    past: Math.max(0, f.heat), stateRun: f.stateRun, dimIn: f.dimIn, stateDim: f.stateDim, state: f.state, by: f.by,
    ascIfPar: f.ascIfPar, gain: HEAT_GAIN[f.state], rarityUp: HEAT_RARITY_UP[f.state],
    bar: { min: HEAT_BAR_MIN, max: HEAT_BAR_MAX, marker, beyond: f.heat < HEAT_BAR_MIN ? -1 : f.heat > HEAT_BAR_MAX ? 1 : 0 },
    node: ns ? { state: ns, gain: HEAT_GAIN[ns], rarityUp: HEAT_RARITY_UP[ns] } : null,
    next,
  };
}
