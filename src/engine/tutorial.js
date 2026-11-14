// The guided first run (docs/specs/m3-onboarding.md 2, 4.2, 5 E1-E8; D135, D137, D138; M3 3.4). A run created with
// newRun({ tutorial: true }) (expedition map with the start camp) plays zone 1 on TUTORIAL_SEED (expedition.js
// zoneSeed) with the authored overlay of CONTENT.tutorial (src/content/tutorial.js): board slot 1 fixed (a Cull), the
// Cull site fights, scripts S1-S4 on the first non-site Quest or Grind fights, S1's fixed loot, only marked enemies wind
// up (D138; D149: on their turn ONB_WINDUP_TURN, combat.js), Gorrak on the Elite node nearest the hub with a level clamp,
// his node barred until the gate's script has ended (D138), and the zone's Roads closed until his fight has ended (D142).
// While the guide is on (not skipped) zone 1 is the guided zone: a death there is a rescue (back to the last node, full
// health, ONB_RESCUE_TOLLS; D147: it lands on the map with no fight started, and the ONB_RESCUE_MAX-th rescue ends the
// guide), and the 17 beats G1-G17 are tracked from the actions, events and state (`beat` events, tutorialView; D147: G7
// and G8 opening in one engage round share G8's joint line, which gives way after the engage round, draft; spec 2.8
// item 8, draft: from round 2 G8's own line only while windupView lists an answer; D150, the owner's text pass, draft
// where new: G7 at fight 1, G3 and G9 without a line, G1, G4, G5, G10 and G12 at one moment each, G12.road). Leaving zone 1
// ends the guide.
// Pure helpers of the state; nodes.js, combat.js, damage.js, contracts.js, actions.js and autoplay.js call them. A run
// without the option never reaches any of it.
import {
  ONB_SCRIPTED_FIGHTS, ONB_SCRIPT_LEVEL_MAX, ONB_LOOT_POTIONS, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX,
  ONB_RESCUE_TOLLS, ONB_RESCUE_MAX, ONB_BEAT_RETRIES, ONB_POTION_HP, ONB_BELL_HOPS, ONB_BELL_DIM, ONB_DIM_NEAR_HOPS,
  ONB_ENGAGE_SHOWS, ONB_BEATS, ONB_BEAT_PRIORITY, ONB_LINE_STEPS, ONB_LINE_RETURNS, ONB_LINES_PER_FIGHT, CONTRACT, SLOT_IDS, RARITY, ILVL_MAX, CONSUMABLE,
  SPELL,
} from '../constants.js';
import { zoneRegions, hops, frontAt, zoneTime, dimAt, dimmedNow, knowledge } from './expedition.js';
import { itemScore, makeFixedGear, makeConsumable } from './items.js';
import { windupView } from './answers.js';
import { castError } from './spells.js';

// ---------------- Run and zone state ----------------
/**
 * state.tutorial at START_RUN of a guided run (E1): script = scripted fights ended, sites = Cull site fights started,
 * elite = how the elite's fight ended in the guided zone (null, 'victory', 'fled' or 'rescue'; D142).
 */
export function newTutorial() {
  return { on: true, skipped: false, ended: false, rescues: 0, script: 0, sites: 0, elite: null, beats: {} };
}
/** The guide runs: a guided run, not skipped, zone 1 not left. */
export const guideOn = (s) => !!(s.tutorial && s.tutorial.on && !s.tutorial.skipped && !s.tutorial.ended);
/** Zone 1 of a guided run (the overlay's zone, skipped or not). */
export const inZone1 = (s) => !!(s.tutorial && s.zone && !s.zone.camp && s.zone.z === 1 && s.zone.mode === 'expedition');
/** The guided zone (spec 2.3, E5): zone 1 while the guide is on. */
export const guidedZone = (s) => guideOn(s) && inZone1(s);
const table = (s) => s.content.tutorial;
const scriptIndex = (T, id) => T.scripts.findIndex((x) => x.id === id);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** Board slot `board.slot` of the guided run (spec 2.3 "Board"): the content's contract, as drawOffer would make it. */
export function boardOffer(s) {
  const b = table(s).board;
  const region = zoneRegions(s.content, b.z).findIndex((r) => r.id === b.region);
  return { index: b.slot - 1, z: b.z, kind: b.kind, region, family: b.family, template: null, need: CONTRACT[b.kind].sites, price: CONTRACT[b.kind].price, taken: false };
}
/** The start camp's board in a guided run: the fixed slot replaces its drawn offer unless taken (contracts.js). */
export function fixBoard(s) {
  if (!s.tutorial) return;
  const i = table(s).board.slot - 1;
  if (s.prep.board[i] && !s.prep.board[i].taken) s.prep.board[i] = boardOffer(s);
}

/**
 * Zone 1 of a guided run was generated (nodes.js enterZone, after the contract sites): Gorrak on the Elite node nearest
 * the hub (hops, ties lowest id; alone and never the rare unless the table says so), each Quest and Grind node's own
 * encounter kept (`gen`) so the overlay can be laid on and lifted, then the overlay (refreshOverlay).
 */
export function setupGuidedZone(s) {
  const zone = s.zone;
  const T = table(s);
  const d = hops(zone.nodes, 0);
  let el = null;
  for (const n of zone.nodes) if (n.type === 'elite' && (!el || d[n.id] < d[el.id] || (d[n.id] === d[el.id] && n.id < el.id))) el = n;
  zone.tut = { elite: el ? el.id : null };
  if (el) {
    el.elite = T.elite.enemy;
    el.rare = !!T.elite.rare;
    if (!T.elite.add) el.add = null;
  }
  for (const n of zone.nodes) {
    if (n.type === 'quest') n.gen = { cl: n.cl, mobs: n.mobs.slice(), quest: n.quest };
    else if (n.type === 'grind') n.gen = { cl: n.cl, mobs: n.waves[0].slice() };
  }
  refreshOverlay(s);
}

/** A node with a site mark of a held contract (the Cull of board slot 1 in zone 1). */
const heldSite = (s, n) => !!(n.sites && n.sites.some((id) => s.exp.contracts.some((c) => c.id === id && c.state === 'held')));

/** The overlay role of a Quest or Grind node now: a Cull site's fight, the next script, or none. */
function roleOf(s, n) {
  const t = s.tutorial;
  const T = table(s);
  if (heldSite(s, n)) {
    const i = Math.min(t.sites, T.siteFights.length - 1);
    return { kind: 'site', i, id: T.siteFights[i].id };
  }
  if (t.script < Math.min(ONB_SCRIPTED_FIGHTS, T.scripts.length)) return { kind: 'script', i: t.script, id: T.scripts[t.script].id };
  return null;
}

/** Gorrak's node is barred (D138): in the guided zone until the gate's script has ended (won, fled or rescued). */
export function eliteBarred(s) {
  if (!guidedZone(s)) return false;
  const T = table(s);
  return s.tutorial.script < scriptIndex(T, T.elite.gate.afterScript) + 1;
}

/** The Quest and Grind nodes of zone 1 that can play the next script now: unresolved, no held contract's site, not Dimmed. */
export function scriptNodes(s) {
  return s.zone.nodes.filter((n) => (n.type === 'quest' || n.type === 'grind') && !n.done && !heldSite(s, n) && !dimmedNow(s, n.id)).map((n) => n.id);
}

/**
 * The guided zone's Roads are closed (D142): TAKE_ROAD is refused until Gorrak's fight has ended (won, fled or rescued:
 * state.tutorial.elite). They open too when he can no longer be fought: his node resolved or Dimmed, or still barred with
 * no Quest or Grind node left to play the scripts that open it (so the zone never locks); not while his fight is on (his
 * node may dim during it). Open outside the guided zone (SKIP_GUIDE, zone 2 on). refreshOverlay writes it on the Road
 * nodes (`closed`), which TAKE_ROAD and mapView read.
 */
export function roadsClosed(s) {
  if (!guidedZone(s) || !s.zone.tut || s.zone.tut.elite === null || s.tutorial.elite) return false;
  if (s.fight && s.fight.tut && s.fight.tut.kind === 'elite') return true;
  const id = s.zone.tut.elite;
  if (s.zone.nodes[id].done || dimmedNow(s, id)) return false;
  return !eliteBarred(s) || scriptNodes(s).length > 0;
}
/** The Roads of zone 1 are closed now, as TAKE_ROAD and mapView see it (the Road nodes' `closed`, D142). */
export const roadsShut = (s) => !!(inZone1(s) && s.zone.roads.some((r) => s.zone.nodes[r].closed));

/**
 * The autoplay's way out of the guided zone while its Roads are closed (D142; autoplay.js): `{ elite: true, nodes:
 * [Gorrak's node] }` once his node is open (the map and the coach line show it), else `{ elite: false, nodes }`: the
 * scriptNodes whose type the player knows (all of them when none is known yet). null while the Roads are open.
 */
export function closedRoadsGoal(s) {
  if (!roadsShut(s)) return null;
  const el = s.zone.tut.elite;
  if (!s.zone.nodes[el].barred) return { elite: true, nodes: [el] };
  const all = scriptNodes(s);
  const known = all.filter((id) => knowledge(s, s.zone.nodes[id]) !== 'none');
  return { elite: false, nodes: known.length ? known : all };
}

/**
 * The overlay laid on zone 1 (after every action of a guided run in zone 1, so the map always shows what a node will
 * play): Gorrak's level clamp(L, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX) and his node's bar; every unresolved Quest
 * and Grind node plays its role's enemies (a site: the site fight of the site fights started so far; else the next
 * script at min(its level, ONB_SCRIPT_LEVEL_MAX)), or its own encounter again once the scripts are used up; a Quest node
 * shows its role's quest (content `quest` of the script or site fight; D144: the text names the enemies it plays), else
 * its own; the Roads' `closed` mark while roadsClosed (D142).
 */
export function refreshOverlay(s) {
  if (!inZone1(s) || !s.zone.tut) return;
  const zone = s.zone;
  const T = table(s);
  const el = zone.tut.elite;
  if (el !== null) {
    const n = zone.nodes[el];
    if (!n.done) n.eliteLevel = clamp(s.player.level, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX);
    if (eliteBarred(s)) n.barred = true;
    else delete n.barred;
  }
  for (const n of zone.nodes) {
    if (!n.gen || n.done) continue;
    const role = roleOf(s, n);
    let mobs = n.gen.mobs;
    let cl = n.gen.cl;
    if (role && role.kind === 'site') mobs = T.siteFights[role.i].enemies.map((e) => e.enemy);
    else if (role) { mobs = T.scripts[role.i].enemies.map((e) => e.enemy); cl = Math.min(n.gen.cl, ONB_SCRIPT_LEVEL_MAX); }
    if (n.type === 'quest') {
      n.mobs = mobs.slice();
      const def = role ? (role.kind === 'site' ? T.siteFights[role.i] : T.scripts[role.i]) : null;
      n.quest = (def && def.quest) || n.gen.quest;
    } else n.waves[0] = mobs.slice();
    n.cl = cl;
    if (role) n.tutRole = role;
    else delete n.tutRole;
  }
  const shut = roadsClosed(s);
  for (const r of zone.roads) {
    if (shut) zone.nodes[r].closed = true;
    else delete zone.nodes[r].closed;
  }
}

// ---------------- Fights ----------------
/**
 * startFight's overlay for a node fight (nodes.js nodeFight): `tut` (the role: script or site) and `windups` (D138: in
 * zone 1 of a guided run only enemies marked `windup` get the first-meeting wind-up, D149: on turn ONB_WINDUP_TURN; every
 * other quest fight of the guided zone has none). A site fight counts as started. Gorrak's fight in the guided zone
 * carries `tut` kind 'elite' (D142: its end opens the Roads) and plays by the normal rules. null: the fight plays by the
 * normal rules.
 */
export function fightOverlay(s, kind) {
  if (!inZone1(s) || !s.node || s.node.id === undefined || s.node.type === 'dim' || s.node.type === 'dev') return null;
  const def = s.zone.nodes[s.node.id];
  const T = table(s);
  if (def.tutRole && (kind === 'quest' || kind === 'grind')) {
    const r = def.tutRole;
    const list = r.kind === 'site' ? T.siteFights[r.i].enemies : T.scripts[r.i].enemies;
    if (r.kind === 'site') s.tutorial.sites += 1;
    return { tut: { kind: r.kind, i: r.i, id: r.id }, windups: list.map((e) => !!e.windup) };
  }
  if (kind === 'elite' && guidedZone(s) && s.zone.tut && def.id === s.zone.tut.elite) return { tut: { kind: 'elite', i: 0, id: T.elite.id } };
  return kind === 'quest' && guidedZone(s) ? { windups: [] } : null;
}

/**
 * A fight with an overlay role ended (nodes.js finishFight, rescueEnd): Gorrak's fight records its outcome ('victory',
 * 'fled' or 'rescue'; D142: the Roads open); a script has ended (D138: won, fled or rescued), so the next fight plays the
 * next one; S1's fixed loot (on a win) replaces its drops: one item of the table's rarity for the class's weakest slot by
 * itemScore (an upgrade; fixed stats, no draw) at the node's level, and ONB_LOOT_POTIONS of its consumable. Returns the
 * drops.
 */
export function overlayFightEnd(s, f, outcome, drops) {
  if (f.tut && f.tut.kind === 'elite') {
    if (!s.tutorial.elite) s.tutorial.elite = outcome;
    return drops;
  }
  if (!f.tut || f.tut.kind !== 'script') return drops;
  s.tutorial.script += 1;
  const loot = table(s).scripts[f.tut.i].loot;
  if (outcome !== 'victory' || !loot) return drops;
  const p = s.player;
  let slot = SLOT_IDS[0];
  let low = Infinity;
  for (const k of SLOT_IDS) {
    const sc = itemScore(p.equipped[k], p.classId);
    if (sc < low) { low = sc; slot = k; }
  }
  const level = s.node ? s.node.cl : p.level;
  const out = [makeFixedGear(s, slot, loot.upgrade, Math.min(ILVL_MAX, Math.max(1, level) + RARITY[loot.upgrade].ilvlBonus), null)];
  if (loot.consumable) out.push(makeConsumable(s, loot.consumable, ONB_LOOT_POTIONS));
  return out;
}

// ---------------- Rescue (spec 2.6, E3; D147) ----------------
/**
 * A death now is a rescue: in the guided zone, outside the Camp and the end boss. Resurrect charges are not used. After
 * ONB_RESCUE_MAX rescues the guide has ended (rescueCap), so a death is a normal one.
 */
export const rescueCovers = (s) => guidedZone(s) && !!s.fight && s.fight.kind !== 'boss' && s.fight.kind !== 'camp';
/**
 * Where a rescue takes the player: from a node's fight, back to the node the player came from (zone.path); from a
 * Dimmed encounter or a dev tool's fight, the node it was fought on (a flight from those stays there).
 */
export function rescueTarget(s) {
  const zone = s.zone;
  const node = s.node;
  if (!node || node.type === 'dim' || node.type === 'dev') return { node: zone.pos, to: zone.pos };
  const path = zone.path;
  return { node: node.id, to: path.length >= 2 ? path[path.length - 2] : zone.pos };
}

/**
 * After a rescue (nodes.js rescueEnd, D147): the ONB_RESCUE_MAX-th rescue ends the guide as SKIP_GUIDE does (no more
 * rescues, the beats close, Gorrak's node and the Roads open, the zone and its overlay stay), with event `guideSkipped`
 * why 'rescues'. Rescues are counted only in the guided zone, so the guide is on here.
 */
export function rescueCap(s, ev) {
  if (s.tutorial.rescues >= ONB_RESCUE_MAX && guideOn(s)) skipGuide(s, ev, 'rescues');
}

// ---------------- SKIP_GUIDE (E4) ----------------
export function skipGuideError(s) {
  if (!s.tutorial) return 'not a guided run (newRun option tutorial)';
  if (s.tutorial.skipped) return 'the guide is already skipped';
  return s.tutorial.ended ? 'the guide has ended' : null;
}
/**
 * SKIP_GUIDE: the guide stops (beats closed, no rescue, Gorrak's node open); the zone and its overlay stay. why: null for
 * the action (event `guideSkipped`), 'rescues' when ONB_RESCUE_MAX rescues end it (rescueCap; event `guideSkipped` with
 * `why` and `rescues`).
 */
export function skipGuide(s, ev, why = null) {
  const t = s.tutorial;
  t.skipped = true;
  for (const id of ONB_BEATS) if (isOpen(t, id)) close(t, ev, id, false);
  ev.push(why ? { t: 'guideSkipped', why, rescues: t.rescues } : { t: 'guideSkipped' });
}

// ---------------- Beats (spec 2.4) ----------------
const isOpen = (t, id) => !!t.beats[id] && t.beats[id].st === 'open';
const fired = (t, id) => !!t.beats[id];
function open(t, ev, id, line, n = 0) {
  t.beats[id] = { st: 'open', line, n, shown: 0, rest: false, back: 0 };
  ev.push({ t: 'beat', id, what: 'open', line });
}
function setLine(t, ev, id, line) {
  const b = t.beats[id];
  if (b.line === line) return;
  b.line = line;
  b.shown = 0;
  b.rest = false;
  ev.push({ t: 'beat', id, what: 'line', line });
}
/**
 * A beat's trigger fired again (D141): a resting line comes back as a new moment (event `beat` what 'line'), at most
 * ONB_LINE_RETURNS times per zone (D142, `back` counts them); once they are used the trigger does nothing.
 */
function again(t, ev, id) {
  const b = t.beats[id];
  if ((b.back || 0) >= ONB_LINE_RETURNS) return;
  b.shown = 0;
  if (!b.rest) return;
  b.rest = false;
  b.back = (b.back || 0) + 1;
  if (b.line) ev.push({ t: 'beat', id, what: 'line', line: b.line });
}
/**
 * Lines shown once (D150, the Dimming line once, draft): after ONB_LINE_STEPS steps as the top line such a line rests
 * even when no other open beat has a line; it comes back only when the engine changes its line (G12.road).
 */
const ONCE_LINES = new Set(['G12', 'G14', 'G15', 'G16', 'G17']);
/** Map lines (D150, draft): their steps as the top line count only on a map step, the screen the UI shows them on. */
const MAP_COUNTED = new Set(['G12']);
/** A map step: on an expedition map with no node, fight or loot window open (the UI shows map lines then). */
const mapStep = (s) => s.phase === 'MAP' && !s.node && !s.fight && !(s.loot && s.loot.length);
/**
 * Beats outside the fight's cap (ONB_LINES_PER_FIGHT; Lead 2026-11-14, draft): G7 and G9, exempt; G2, G12 and G13, map
 * lines a fight never shows (the UI shows them on the map only), which neither count nor wait.
 */
const CAP_FREE = new Set(['G7', 'G9', 'G2', 'G12', 'G13']);
/**
 * The fight's cap holds this beat's line back now: in a fight, ONB_LINES_PER_FIGHT other beats have already been its top
 * lines (state.tutorial.fl, reset when a fight starts). The beat stays open and waits for its moment in a later fight.
 */
const capped = (s, t, id) => !!(s.fight && !CAP_FREE.has(id) && t.fl && t.fl.length >= ONB_LINES_PER_FIGHT && !t.fl.includes(id));
/**
 * The coach line yields (spec 2.5, D141), after every action while the guide runs: the top line (the open beat with a line,
 * not resting, by ONB_BEAT_PRIORITY) that has already been the top line for ONB_LINE_STEPS steps rests when another open
 * beat has a line (D150: a ONCE_LINES line also alone), and the next one is the top line; the top line counts this step
 * (D150: a MAP_COUNTED line only on a map step). In a fight a beat the cap holds (capped) is no candidate, a new top
 * line counts towards the cap, and a top line a higher one displaces after showing rests (`top`: the last top line). A resting beat stays open (it can still be learned) and its line comes
 * back when the engine opens it anew, changes its line or its trigger fires again (at most ONB_LINE_RETURNS times, 0 since
 * D150).
 */
function yieldLines(s, t) {
  const cands = ONB_BEAT_PRIORITY.filter((id) => isOpen(t, id) && t.beats[id].line && !t.beats[id].rest && !capped(s, t, id));
  // in a fight, a line a higher one displaces after it has shown rests: its showing is over and it does not come back in
  // the same fight (Lead 2026-11-14, draft: the Hunter's G10 came back after G16). Map lines are not shown in fights.
  const p = t.top;
  if (s.fight && p && p !== cands[0] && cands.includes(p) && !CAP_FREE.has(p) && t.beats[p].shown > 0) {
    t.beats[p].rest = true;
    cands.splice(cands.indexOf(p), 1);
  }
  while (cands.length && t.beats[cands[0]].shown >= ONB_LINE_STEPS && (cands.length > 1 || ONCE_LINES.has(cands[0]))) t.beats[cands.shift()].rest = true;
  if (cands.length && (!MAP_COUNTED.has(cands[0]) || mapStep(s))) {
    t.beats[cands[0]].shown += 1;
    // the fight's cap counts it (Lead 2026-11-14, draft)
    if (s.fight && t.fl && !CAP_FREE.has(cands[0]) && !t.fl.includes(cands[0])) t.fl.push(cands[0]);
  }
  t.top = cands.length ? cands[0] : null;
}
function close(t, ev, id, learned) {
  const b = t.beats[id];
  b.st = learned ? 'done' : 'missed';
  b.line = null;
  ev.push({ t: 'beat', id, what: b.st, line: null });
}
const MAP_ACTIONS = new Set(['MOVE', 'PASS_THROUGH', 'TAKE_ROAD', 'RING_BELL', 'USE_SPYGLASS']);
const healPotion = (id) => !!(id && CONSUMABLE[id] && CONSUMABLE[id].potion && CONSUMABLE[id].heal);
/**
 * A wind-up G8 teaches can still come in fight f (ui-2026-11-14 finding 1, draft): a non-Deathblow wind-up on a living
 * enemy's track after its current turn, or on its current turn while its intent is still that wind-up (not cancelled by
 * control or a trap, not replaced). False once the winding-up enemy is dead or its wind-up's turn has been played.
 */
const windupComes = (e, x) => e.alive && e.kind !== 'boss' && x.windup && !x.deathblow
  && (x.turn > e.turn || (x.turn === e.turn && !!e.intent && !!e.intent.windup));
/**
 * G8's own line from round 2 (Lead decision 2026-11-14, spec 2.8 item 8, draft; engine-2026-11-14b finding 1): a wind-up
 * that can still come (windupComes) for which windupView lists at least one answer with the player's current bar (an
 * interrupt, a stun, Hexbind or a defensive off cooldown by its round, or the PASS answer). Without one the line would
 * name W, which is legal only in the engage round, while nothing can answer it.
 */
function windupAnswerable(s) {
  const f = s.fight;
  return (windupView(s) || []).some((w) => w.answers.length > 0
    && (f.enemies[w.u].track || []).some((x) => x.turn === w.turn && windupComes(f.enemies[w.u], x)));
}

/**
 * After every action of a guided run (actions.js applyAction, after the settle step): the overlay of zone 1, the beats
 * while the guide is on, and the end of the guide when zone 1 is left (event `guideEnd`; beats still open close:
 * G12 learned when zone 1 had no Dimmed encounter, G13 when it was left by a Road or the Bell, the rest missed).
 */
export function tutorialAfter(s, ev, a) {
  const t = s.tutorial;
  if (!t) return;
  refreshOverlay(s);
  if (!t.skipped && !t.ended) { trackBeats(s, ev, a); yieldLines(s, t); }
  if (!t.ended && s.zone && (s.zone.camp || s.zone.z > 1)) {
    t.ended = true;
    const rec = s.stats.exp ? s.stats.exp.zones.find((r) => r.z === 1) : null;
    for (const id of ONB_BEATS) {
      if (!isOpen(t, id)) continue;
      if (id === 'G12') close(t, ev, id, !!rec && rec.dimFights === 0);
      else if (id === 'G13') close(t, ev, id, !!rec && (rec.exit === 'road' || rec.exit === 'bell'));
      else close(t, ev, id, false);
    }
    ev.push({ t: 'guideEnd' });
  }
}

// D150 follow-up (Lead 2026-11-14, draft): the fight moments of G14-G17, from round 2 of a fight (after the engage round,
// so a line never stands on the quest's intro dialog, which the UI shows while the engine is in round 1)
const fightOn = (f, ended) => !!(f && !f.over && !ended && f.round >= 2);
const foes = (f) => f.enemies.filter((e) => e.alive && !e.hidden);
/** G14: a finisher on the bar can be cast now on a living enemy (combo points held; only the Rogue has finishers). */
const finisherReady = (s) => s.player.bar.some((id) => id && SPELL[id] && SPELL[id].tags.includes('finisher')
  && foes(s.fight).some((e) => !castError(s, id, e.idx)));
/** G15: a bar spell refused now only for lack of resource (energy, mana or focus): with enough it could be cast. */
function resourceShort(s) {
  return s.player.bar.some((id) => {
    const sp = id && SPELL[id];
    if (!sp) return false;
    const on = sp.target === 'enemy' ? foes(s.fight).map((e) => e.idx) : [null];
    return on.some((u) => castError(s, id, u) === `not enough resource for ${id}` && !castError(s, id, u, { free: true }));
  });
}
/** G16: a living beast has acted, so its Bloodlust badge shows (damage.js bloodlust, the UI's red "+N %"). */
const bloodlustUp = (f) => foes(f).some((e) => e.arch === 'beast' && (e.acted || 0) > 0);
/** G17: two or more living enemies to choose between. */
const twoFoes = (f) => foes(f).length >= 2;
/** Actions on one enemy (G17 reads their `target`). */
const TARGETED = new Set(['CAST', 'ATTACK']);
/**
 * A D150 moment line (draft): the beat's line while its moment lasts (`up`), null between moments; once it has been the
 * top line, the end of its moment or its rest (ONCE_LINES, ONB_LINE_STEPS steps) closes it learned, so it shows once. A
 * moment that passed before the line was ever the top line leaves it for the next one.
 */
function moment(t, ev, id, up, line) {
  const b = t.beats[id];
  if (b.rest || (!up && b.line && b.shown > 0)) { close(t, ev, id, true); return; }
  setLine(t, ev, id, up ? line : null);
}

/** A gear item the UI marks with the upgrade arrow (its itemScore above the equipped item's in its slot; screens.js). */
const isUpgrade = (s, it) => !!(it && it.kind === 'gear' && itemScore(it, s.player.classId) > itemScore(s.player.equipped[it.slot], s.player.classId));
/** Steps whose loot is not a fight's or a chest's spoils (D150, G4: never a reward screen; not the loot window's own moves). */
const NOT_SPOILS = new Set(['CHOOSE_REWARD', 'LOOT_TAKE', 'LOOT_TAKE_ALL', 'LOOT_EQUIP', 'BUY', 'SET_OUT']);
/** A held contract's site fight of the guided zone (the overlay's role 'site', tutorial.js fightOverlay). */
const siteFight = (f) => !!(f && f.tut && f.tut.kind === 'site');
/** The reward set up now is a contract's (its item choice; m3-onboarding.md 2.4 G10, D150: the line waits for it). */
const contractRewardUp = (s) => !!(s.node && s.node.stage === 'reward' && s.node.rewards && s.node.rewards[0] && s.node.rewards[0].contract);

/**
 * The beats of spec 2.4 as the engine sees them: a beat opens (`beat` event what 'open', with its coach line id) on its
 * trigger, can change its line ('line'), and closes learned ('done') or not ('missed'). Line ids: the beat id for its
 * line, `<id>.<key>` for content's `alt` lines (G8.landed, G8.withEngage, G9.landed, G10.done, G12.road, G13.onRoad,
 * G13.closed); a line of null: open, waiting for its moment. A beat's hover-only learning (G6) is the UI's. D150 (owner
 * text pass, draft where the rule is new): G3 has no line (fight 1 shows G7's), G9 none (the UI's prompt bar gives the
 * Deathblow's answer), G1's line goes once a contract is held, G4 opens on an upgrade in a fight's or a chest's spoils, G5
 * at the first hub, G7 at the first engage fight, G10 from round 2 of a site fight, G12 once and then G12.road.
 */
function trackBeats(s, ev, a) {
  const t = s.tutorial;
  const has = (type, fn) => ev.some((e) => e.t === type && (!fn || fn(e)));
  const now = new Set();
  const op = (id, line, n) => { open(t, ev, id, line, n); now.add(id); };
  // G1: the start camp; D150 (verdict "stays after the action"): its line waits (null) while a contract is held
  if (a.type === 'START_RUN' && s.phase === 'PREP') op('G1', 'G1');
  if (s.phase === 'PREP' && isOpen(t, 'G1') && !now.has('G1')) setLine(t, ev, 'G1', s.exp.contracts.some((c) => c.state === 'held') ? null : 'G1');
  if (a.type === 'SET_OUT' && isOpen(t, 'G1')) {
    const held = s.exp.contracts.filter((c) => c.state === 'held').length;
    close(t, ev, 'G1', held > 0);
    if (!held) { t.beats.G10 = { st: 'skip', line: null, n: 0 }; ev.push({ t: 'beat', id: 'G10', what: 'skip', line: null }); }
  }
  // Learned by the action (before the zone test: TAKE_ROAD leaves zone 1)
  if (isOpen(t, 'G2') && (a.type === 'MOVE' || a.type === 'PASS_THROUGH')) close(t, ev, 'G2', true);
  if (isOpen(t, 'G4') && a.type === 'EQUIP') close(t, ev, 'G4', true);
  if (isOpen(t, 'G5') && MAP_ACTIONS.has(a.type)) close(t, ev, 'G5', true);
  if (isOpen(t, 'G7') && a.type === 'ENGAGE') close(t, ev, 'G7', true);
  if (isOpen(t, 'G11') && a.type === 'USE_ITEM' && Number.isInteger(a.slot) && healPotion(s.player.itemBar[a.slot])) close(t, ev, 'G11', true);
  if (isOpen(t, 'G13') && (a.type === 'TAKE_ROAD' || a.type === 'RING_BELL')) close(t, ev, 'G13', true);
  // D150 follow-up: a finisher cast learns G14; acting on another enemy than the last one acted on (still alive) learns G17
  if (isOpen(t, 'G14') && a.type === 'CAST' && SPELL[a.spellId] && SPELL[a.spellId].tags.includes('finisher')) close(t, ev, 'G14', true);
  if (isOpen(t, 'G17') && TARGETED.has(a.type) && Number.isInteger(a.target)) {
    const b = t.beats.G17;
    if (Number.isInteger(b.last) && a.target !== b.last && s.fight && s.fight.enemies[b.last] && s.fight.enemies[b.last].alive) close(t, ev, 'G17', true);
    else b.last = a.target;
  }
  if (!inZone1(s)) return;
  const f = s.fight;
  const ended = has('victory') || has('fled') || has('rescue');
  // G5 (D150 item 12, draft): at the first hub of zone 1 (the hub screen after SET_OUT), before any map step
  if (!fired(t, 'G5') && s.phase === 'ZONE_HUB') op('G5', 'G5');
  // In a fight: what the step showed
  if (isOpen(t, 'G6') && has('offBalance', (e) => e.why === 'avoided')) t.beats.G6.n = 1;
  if (isOpen(t, 'G8')) {
    if (has('stagger', (e) => !e.deathblow)) close(t, ev, 'G8', true);
    else if (has('empower', (e) => !e.deathblow)) {
      t.beats.G8.n += 1;
      if (t.beats.G8.n > ONB_BEAT_RETRIES) close(t, ev, 'G8', false);
      else setLine(t, ev, 'G8', 'G8.landed');
    }
  }
  if (isOpen(t, 'G9')) {
    if (has('stagger', (e) => e.deathblow)) close(t, ev, 'G9', true);
    else if (has('empower', (e) => e.deathblow)) setLine(t, ev, 'G9', 'G9.landed');
  }
  if (isOpen(t, 'G7') && t.beats.G7.line && (ended || (f && f.round >= 2))) {
    if (t.beats.G7.n >= ONB_ENGAGE_SHOWS) close(t, ev, 'G7', false);
    else setLine(t, ev, 'G7', null);
  }
  // ui-2026-11-14 finding 1 (draft): the joint line belongs to the engage round, as G7's line does. After it, G8
  // shows its own line while its wind-up can still come and (spec 2.8 item 8, draft) windupView lists an answer to it
  // with the current bar, and waits (null) otherwise (the enemy dead, its turn played, or nothing on the bar answers it);
  // its own line follows the same rule, and comes back when an answer does (for example a cooldown over). 'G8.landed'
  // stays until the fight ends
  if (f && !ended && f.round >= 2 && isOpen(t, 'G8') && t.beats.G8.line !== 'G8.landed') setLine(t, ev, 'G8', windupAnswerable(s) ? 'G8' : null);
  // G10 (D150, "Contract site" once, draft): opens (line null) when the first held site's fight starts; its line from round 2
  // of a site fight to the end of that fight (the engage round's line is G7's in fight 1), once: a site fight in which it
  // was the top line ends it (null); one it never topped (won in the engage round) leaves the next site fight its turn.
  // Then 'G10.done' once the contract's reward choice is up (not at the contract's completion, three screens earlier)
  if (isOpen(t, 'G10')) {
    const b = t.beats.G10;
    if (has('contract', (e) => e.what === 'complete' && e.z === 1)) b.n = 1;
    if (b.n === 1) {
      if (a.type === 'CHOOSE_REWARD' && b.line === 'G10.done' && !(s.node && s.node.rewards && s.node.rewards.some((r) => r.contract))) close(t, ev, 'G10', true);
      else if (b.line !== 'G10.done' && contractRewardUp(s)) setLine(t, ev, 'G10', 'G10.done');
      else if (b.line === 'G10') setLine(t, ev, 'G10', null);
    } else if (!b.had) {
      const up = siteFight(f) && !ended && f.round >= 2;
      if (!up && b.line === 'G10' && b.shown > 0) b.had = true;
      setLine(t, ev, 'G10', up ? 'G10' : null);
    }
  }
  // A fight ended
  if (ended) {
    if (isOpen(t, 'G3') && has('victory')) close(t, ev, 'G3', true);
    if (isOpen(t, 'G6')) close(t, ev, 'G6', t.beats.G6.n > 0);
    if (isOpen(t, 'G8')) setLine(t, ev, 'G8', null);
    if (isOpen(t, 'G9')) setLine(t, ev, 'G9', null);
    if (isOpen(t, 'G11')) close(t, ev, 'G11', false);
    if (isOpen(t, 'G4') && s.stats.fights > t.beats.G4.n) close(t, ev, 'G4', false);
  }
  // G4 (D150 item 18, draft): the first upgrade (the UI's green arrow) in a fight's or a chest's spoils in the guided zone,
  // never from a reward choice; missed when the next fight ends
  if (!fired(t, 'G4') && !NOT_SPOILS.has(a.type) && has('loot', (e) => isUpgrade(s, e.item))) op('G4', 'G4', s.stats.fights);
  // A fight started (its round 1); the fight's cap starts again (ONB_LINES_PER_FIGHT, Lead 2026-11-14, draft)
  if (f && has('fight')) {
    t.fl = [];
    const entries = f.enemies.flatMap((e) => e.track || []);
    // G3 (D150 item 11): no line; learned when the first fight is won
    if (!fired(t, 'G3')) op('G3', null);
    if (!fired(t, 'G6') && entries.some((x) => x.heavy || x.cast)) op('G6', 'G6');
    if (!fired(t, 'G10') && siteFight(f)) op('G10', null);
    const windup = entries.some((x) => x.windup && !x.deathblow);
    // D150 item 11 (draft): G7's line is fight 1's (the first fight with an engage round, any number of enemies); it was the
    // first engage fight with 2 or more enemies, two fights late
    const g7 = !!f.engage && !fired(t, 'G7');
    // D147 (spec 2.8, the D145 fix): G7 and G8 opening in one engage round share G8's joint line 'G8.withEngage';
    // G7 opens with its line waiting (null): the joint line is its first showing, its own line comes at the next engage
    // fight (ONB_ENGAGE_SHOWS). Each is learned as before (any ENGAGE; the wind-up answered). Since D150 G7 opens at the
    // first fight, which has no wind-up on the guided route, so S3 opens G8 on its own line
    const joint = g7 && windup && !fired(t, 'G8');
    if (f.engage) {
      if (g7) op('G7', joint ? null : 'G7', 1);
      else if (isOpen(t, 'G7') && !t.beats.G7.line && !now.has('G7')) { t.beats.G7.n += 1; setLine(t, ev, 'G7', 'G7'); }
    }
    if (windup) {
      if (!fired(t, 'G8')) op('G8', joint ? 'G8.withEngage' : 'G8');
      else if (isOpen(t, 'G8')) setLine(t, ev, 'G8', 'G8');
    }
    // G9 (D150, the Deathblow's answer in one line only: the UI's prompt bar): no coach line until it lands
    if (entries.some((x) => x.deathblow) && !fired(t, 'G9')) op('G9', null);
  }
  // G11: low health with a healing potion on the item bar, in a fight
  if (f && !fired(t, 'G11') && s.player.hp < ONB_POTION_HP * s.player.d.maxHp && s.player.itemBar.some((id) => healPotion(id) && s.player.bag.some((x) => x.kind === 'cons' && x.id === id))) op('G11', 'G11');
  // G14-G17 (D150 follow-up, Lead 2026-11-14, draft): each opens at its first moment, from round 2 of a fight, with its line:
  // G14 a finisher castable (combo points), G15 a bar spell refused only for lack of resource (its class line: the engine
  // cannot see a refused press, step throws, so this is the first moment a press would be refused), G16 a beast's
  // Bloodlust badge, G17 two or more living enemies; then each follows its moment (moment) and shows once
  const on = fightOn(f, ended);
  const want = {
    G14: on && finisherReady(s), G15: on && resourceShort(s), G16: on && bloodlustUp(f), G17: on && twoFoes(f),
  };
  const lineOf = { G14: 'G14', G15: `G15.${s.player.classId}`, G16: 'G16', G17: 'G17' };
  for (const id of ['G14', 'G15', 'G16', 'G17']) {
    if (!fired(t, id)) { if (want[id]) op(id, lineOf[id]); } else if (isOpen(t, id) && !now.has(id)) moment(t, ev, id, want[id], lineOf[id]);
  }
  const zone = s.zone;
  // G12: the first node dims, or the front is within ONB_DIM_NEAR_HOPS of the player. While open, the front coming within
  // ONB_DIM_NEAR_HOPS again (it was not on the last step) is its trigger again (D141), which brings a resting line back at
  // most ONB_LINE_RETURNS times (D142, `again`; 0 since D150: the Dimming line once). D150 (draft): no line for a Dimmed
  // encounter (G12.caught is gone: there was nowhere to walk); once its line has rested and the Roads are open, its line is
  // G12.road (shown once too)
  if (!zone.dimOff && (!fired(t, 'G12') || isOpen(t, 'G12'))) {
    const front = frontAt(zoneTime(s));
    const near = front >= 0 && front >= zone.shardDist[zone.pos] - ONB_DIM_NEAR_HOPS;
    if (!fired(t, 'G12')) {
      if (has('dimming', (e) => e.dimmed.length > 0) || near) { op('G12', 'G12'); t.beats.G12.near = near; }
    } else {
      if (near && !t.beats.G12.near) again(t, ev, 'G12');
      t.beats.G12.near = near;
    }
  }
  const shut = roadsShut(s);
  if (isOpen(t, 'G12') && t.beats.G12.line === 'G12' && t.beats.G12.rest && !shut) setLine(t, ev, 'G12', 'G12.road');
  // G13 while the Roads are closed (D142) shows G13.closed; from the start of Gorrak's fight and once they open (at any
  // step) its line waits (null) for its own moment on the map
  const facing = !!(f && f.tut && f.tut.kind === 'elite');
  if (isOpen(t, 'G13') && t.beats.G13.line === 'G13.closed' && (!shut || facing)) setLine(t, ev, 'G13', null);
  if (s.phase !== 'MAP' || s.node || s.fight) return;
  // On the map: G2 (first map view at the hub), G13 (far from a Road, or on one; while the Roads are closed, also once
  // Gorrak's node is open)
  if (!fired(t, 'G2') && zone.pos === 0) op('G2', 'G2');
  const d = hops(zone.nodes, zone.pos);
  const onRoad = zone.nodes[zone.pos].road;
  const far = !onRoad && Math.min(...zone.roads.map((r) => d[r])) >= ONB_BELL_HOPS && dimAt(zone, zone.pos) - zoneTime(s) <= ONB_BELL_DIM;
  const line = shut ? (onRoad || far || !zone.nodes[zone.tut.elite].barred ? 'G13.closed' : null) : onRoad ? 'G13.onRoad' : far ? 'G13' : null;
  if (!fired(t, 'G13')) { if (line) op('G13', line); }
  else if (isOpen(t, 'G13') && line && (shut || onRoad || !t.beats.G13.line)) setLine(t, ev, 'G13', line);
}

// ---------------- View (E5) ----------------
/**
 * The guided run for the UI, or null in any other run: { on, skipped, ended, guidedZone, script (scripted fights ended),
 * scripts (ONB_SCRIPTED_FIGHTS), next (the next script's id or null), sites (Cull site fights started), eliteNodeId,
 * elite ({ node, enemy, level, barred, afterScript, left (scripted fights until the node opens), outcome (how his fight in
 * the guided zone ended: null, 'victory', 'fled' or 'rescue'; D142) } or null), roads ({ closed (TAKE_ROAD refused on
 * every Road of zone 1), why ('elite' while closed, else null), node (the node whose fight opens them, else null), line
 * (the content line that says so, 'G13.closed', else null) }; D142), rescues, rescueTolls, rescueMax (ONB_RESCUE_MAX: the
 * rescue that ends the guide, D147; skipped is then true), beat and line (the open beat
 * with a line that is not resting, highest priority first; spec 2.5, D141), open ([{ id, line, rest }] by priority; rest:
 * it has yielded its line, yieldLines), done (beats closed, spec order), learned (closed by the player doing it),
 * skippedBeats }. Pure and cheap.
 */
export function tutorialView(s) {
  const t = s.tutorial;
  if (!t) return null;
  const T = table(s);
  const zone = inZone1(s) && s.zone.tut ? s.zone : null;
  const eid = zone ? zone.tut.elite : null;
  const gate = scriptIndex(T, T.elite.gate.afterScript) + 1;
  // a beat the fight's cap holds back shows no line now (held: true), so the UI's fallback cannot show it either
  const openList = ONB_BEAT_PRIORITY.filter((id) => isOpen(t, id)).map((id) => (t.beats[id].line && capped(s, t, id)
    ? { id, line: null, rest: !!t.beats[id].rest, held: true } : { id, line: t.beats[id].line, rest: !!t.beats[id].rest }));
  const cur = guideOn(s) ? openList.find((o) => o.line && !o.rest) || null : null;
  const st = (id) => (t.beats[id] ? t.beats[id].st : null);
  const shut = roadsShut(s);
  return {
    on: t.on, skipped: t.skipped, ended: t.ended, guidedZone: guidedZone(s),
    script: t.script, scripts: ONB_SCRIPTED_FIGHTS, next: t.script < T.scripts.length ? T.scripts[t.script].id : null, sites: t.sites,
    eliteNodeId: eid,
    elite: eid === null ? null : {
      node: eid, enemy: T.elite.enemy, level: zone.nodes[eid].eliteLevel, barred: !!zone.nodes[eid].barred,
      afterScript: T.elite.gate.afterScript, left: Math.max(0, gate - t.script), outcome: t.elite || null,
    },
    roads: { closed: shut, why: shut ? 'elite' : null, node: shut ? eid : null, line: shut ? 'G13.closed' : null },
    rescues: t.rescues, rescueTolls: ONB_RESCUE_TOLLS, rescueMax: ONB_RESCUE_MAX,
    beat: cur ? cur.id : null, line: cur ? cur.line : null, open: openList,
    done: ONB_BEATS.filter((id) => st(id) === 'done' || st(id) === 'missed'),
    learned: ONB_BEATS.filter((id) => st(id) === 'done'),
    skippedBeats: ONB_BEATS.filter((id) => st(id) === 'skip'),
  };
}
