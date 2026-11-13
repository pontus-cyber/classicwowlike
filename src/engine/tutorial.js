// The guided first run (docs/specs/m3-onboarding.md 2, 4.2, 5 E1-E8; D135, D137, D138; M3 3.4). A run created with
// newRun({ tutorial: true }) (expedition map with the start camp) plays zone 1 on TUTORIAL_SEED (expedition.js
// zoneSeed) with the authored overlay of CONTENT.tutorial (src/content/tutorial.js): board slot 1 fixed (a Cull), the
// Cull site fights, scripts S1-S4 on the first non-site Quest or Grind fights, S1's fixed loot, only marked enemies wind
// up (D138), Gorrak on the Elite node nearest the hub with a level clamp, his node barred until the gate's script has
// ended (D138). While the guide is on (not skipped) zone 1 is the guided zone: a death there is a rescue (back to the
// last node, full health, ONB_RESCUE_TOLLS), and the 13 beats G1-G13 are tracked from the actions, events and state
// (`beat` events, tutorialView). Leaving zone 1 ends the guide. Pure helpers of the state; nodes.js, combat.js,
// damage.js, contracts.js and actions.js call them. A run without the option never reaches any of it.
import {
  ONB_SCRIPTED_FIGHTS, ONB_SCRIPT_LEVEL_MAX, ONB_LOOT_POTIONS, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX,
  ONB_RESCUE_TOLLS, ONB_BEAT_RETRIES, ONB_POTION_HP, ONB_BELL_HOPS, ONB_BELL_DIM, ONB_DIM_NEAR_HOPS, ONB_ENGAGE_SHOWS,
  ONB_BEATS, ONB_BEAT_PRIORITY, ONB_LINE_STEPS, CONTRACT, SLOT_IDS, RARITY, ILVL_MAX, CONSUMABLE,
} from '../constants.js';
import { zoneRegions, hops, frontAt, zoneTime, dimAt } from './expedition.js';
import { itemScore, makeFixedGear, makeConsumable } from './items.js';

// ---------------- Run and zone state ----------------
/** state.tutorial at START_RUN of a guided run (E1): script = scripted fights ended, sites = Cull site fights started. */
export function newTutorial() {
  return { on: true, skipped: false, ended: false, rescues: 0, script: 0, sites: 0, beats: {} };
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
    if (n.type === 'quest') n.gen = { cl: n.cl, mobs: n.mobs.slice() };
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

/**
 * The overlay laid on zone 1 (after every action of a guided run in zone 1, so the map always shows what a node will
 * play): Gorrak's level clamp(L, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX) and his node's bar; every unresolved Quest
 * and Grind node plays its role's enemies (a site: the site fight of the site fights started so far; else the next
 * script at min(its level, ONB_SCRIPT_LEVEL_MAX)), or its own encounter again once the scripts are used up.
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
    if (n.type === 'quest') n.mobs = mobs.slice();
    else n.waves[0] = mobs.slice();
    n.cl = cl;
    if (role) n.tutRole = role;
    else delete n.tutRole;
  }
}

// ---------------- Fights ----------------
/**
 * startFight's overlay for a node fight (nodes.js nodeFight): `tut` (the role: script or site) and `windups` (D138: in
 * zone 1 of a guided run only enemies marked `windup` get the first-meeting wind-up on turn 2; every other quest fight
 * of the guided zone has none). A site fight counts as started. null: the fight plays by the normal rules.
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
  return kind === 'quest' && guidedZone(s) ? { windups: [] } : null;
}

/**
 * A fight with an overlay role ended (nodes.js finishFight): a script has ended (D138: won, fled or rescued), so the next
 * fight plays the next one; S1's fixed loot (on a win) replaces its drops: one item of the table's rarity for the
 * class's weakest slot by itemScore (an upgrade; fixed stats, no draw) at the node's level, and ONB_LOOT_POTIONS of its
 * consumable. Returns the drops.
 */
export function overlayFightEnd(s, f, outcome, drops) {
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

// ---------------- Rescue (spec 2.6, E3) ----------------
/** A death now is a rescue: in the guided zone, outside the Camp and the end boss. Resurrect charges are not used. */
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

// ---------------- SKIP_GUIDE (E4) ----------------
export function skipGuideError(s) {
  if (!s.tutorial) return 'not a guided run (newRun option tutorial)';
  if (s.tutorial.skipped) return 'the guide is already skipped';
  return s.tutorial.ended ? 'the guide has ended' : null;
}
/** SKIP_GUIDE: the guide stops (beats closed, no rescue, Gorrak's node open); the zone and its overlay stay. */
export function skipGuide(s, ev) {
  const t = s.tutorial;
  t.skipped = true;
  for (const id of ONB_BEATS) if (isOpen(t, id)) close(t, ev, id, false);
  ev.push({ t: 'guideSkipped' });
}

// ---------------- Beats (spec 2.4) ----------------
const isOpen = (t, id) => !!t.beats[id] && t.beats[id].st === 'open';
const fired = (t, id) => !!t.beats[id];
function open(t, ev, id, line, n = 0) {
  t.beats[id] = { st: 'open', line, n, shown: 0, rest: false };
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
/** A resting beat's trigger fired again (D141): its line comes back as a new moment (event `beat` what 'line'). */
function again(t, ev, id) {
  const b = t.beats[id];
  b.shown = 0;
  if (!b.rest) return;
  b.rest = false;
  if (b.line) ev.push({ t: 'beat', id, what: 'line', line: b.line });
}
/**
 * The coach line yields (spec 2.5, D141), after every action while the guide runs: the top line (the open beat with a line,
 * not resting, by ONB_BEAT_PRIORITY) that has already been the top line for ONB_LINE_STEPS steps rests when another open
 * beat has a line, and the next one is the top line; the top line counts this step. A resting beat stays open (it can
 * still be learned) and its line comes back when the engine opens it anew, changes its line or its trigger fires again.
 */
function yieldLines(t) {
  const cands = ONB_BEAT_PRIORITY.filter((id) => isOpen(t, id) && t.beats[id].line && !t.beats[id].rest);
  while (cands.length > 1 && t.beats[cands[0]].shown >= ONB_LINE_STEPS) t.beats[cands.shift()].rest = true;
  if (cands.length) t.beats[cands[0]].shown += 1;
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
 * After every action of a guided run (actions.js applyAction, after the settle step): the overlay of zone 1, the beats
 * while the guide is on, and the end of the guide when zone 1 is left (event `guideEnd`; beats still open close:
 * G12 learned when zone 1 had no Dimmed encounter, G13 when it was left by a Road or the Bell, the rest missed).
 */
export function tutorialAfter(s, ev, a) {
  const t = s.tutorial;
  if (!t) return;
  refreshOverlay(s);
  if (!t.skipped && !t.ended) { trackBeats(s, ev, a); yieldLines(t); }
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

/**
 * The beats of spec 2.4 as the engine sees them: a beat opens (`beat` event what 'open', with its coach line id) on its
 * trigger, can change its line ('line'), and closes learned ('done') or not ('missed'). Line ids: the beat id for its
 * line, `<id>.<key>` for content's `alt` / `byClass` lines (G8.landed, G9.<class>, G9.landed, G10.done, G12.caught,
 * G13.onRoad); a line of null: open, waiting for its moment. A beat's hover-only learning (G6) is the UI's.
 */
function trackBeats(s, ev, a) {
  const t = s.tutorial;
  const has = (type, fn) => ev.some((e) => e.t === type && (!fn || fn(e)));
  const now = new Set();
  const op = (id, line, n) => { open(t, ev, id, line, n); now.add(id); };
  // G1: the start camp
  if (a.type === 'START_RUN' && s.phase === 'PREP') op('G1', 'G1');
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
  if (!inZone1(s)) return;
  const f = s.fight;
  const ended = has('victory') || has('fled') || has('rescue');
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
  if (isOpen(t, 'G10')) {
    const b = t.beats.G10;
    if (has('contract', (e) => e.what === 'complete' && e.z === 1)) { b.n = 1; setLine(t, ev, 'G10', 'G10.done'); }
    else if (b.n === 1 && a.type === 'CHOOSE_REWARD' && !(s.node && s.node.rewards && s.node.rewards.some((r) => r.contract))) close(t, ev, 'G10', true);
    else if (b.n === 0 && has('contract', (e) => e.what === 'site')) setLine(t, ev, 'G10', null);
  }
  // A fight ended
  if (ended) {
    if (isOpen(t, 'G3')) { if (has('victory')) close(t, ev, 'G3', true); else setLine(t, ev, 'G3', null); }
    if (isOpen(t, 'G6')) close(t, ev, 'G6', t.beats.G6.n > 0);
    if (isOpen(t, 'G8')) setLine(t, ev, 'G8', null);
    if (isOpen(t, 'G9')) setLine(t, ev, 'G9', null);
    if (isOpen(t, 'G11')) close(t, ev, 'G11', false);
    if (isOpen(t, 'G4') && s.stats.fights > t.beats.G4.n) close(t, ev, 'G4', false);
  }
  // G4: the first item of gear looted in the guided zone (S1's or a site's); missed when the next fight ends
  if (!fired(t, 'G4') && has('loot', (e) => e.item && e.item.kind === 'gear')) op('G4', 'G4', s.stats.fights);
  // A fight started (its round 1)
  if (f && has('fight')) {
    const entries = f.enemies.flatMap((e) => e.track || []);
    if (!fired(t, 'G3')) op('G3', 'G3');
    else if (isOpen(t, 'G3')) setLine(t, ev, 'G3', 'G3');
    if (!fired(t, 'G6') && entries.some((x) => x.heavy || x.cast)) op('G6', 'G6');
    if (f.engage) {
      if (!fired(t, 'G7') && f.enemies.length >= 2) op('G7', 'G7', 1);
      else if (isOpen(t, 'G7') && !t.beats.G7.line && !now.has('G7')) { t.beats.G7.n += 1; setLine(t, ev, 'G7', 'G7'); }
    }
    if (entries.some((x) => x.windup && !x.deathblow)) {
      if (!fired(t, 'G8')) op('G8', 'G8');
      else if (isOpen(t, 'G8')) setLine(t, ev, 'G8', 'G8');
    }
    if (entries.some((x) => x.deathblow)) {
      const line = `G9.${s.player.classId}`;
      if (!fired(t, 'G9')) op('G9', line);
      else if (isOpen(t, 'G9')) setLine(t, ev, 'G9', line);
    }
  }
  // G11: low health with a healing potion on the item bar, in a fight
  if (f && !fired(t, 'G11') && s.player.hp < ONB_POTION_HP * s.player.d.maxHp && s.player.itemBar.some((id) => healPotion(id) && s.player.bag.some((x) => x.kind === 'cons' && x.id === id))) op('G11', 'G11');
  const zone = s.zone;
  // G10: a held contract's site comes into view
  if (!fired(t, 'G10') && zone.nodes.some((n) => zone.seen[n.id] && heldSite(s, n))) op('G10', 'G10');
  // G12: the first node dims, or the front is within ONB_DIM_NEAR_HOPS of the player; caught by a Dimmed encounter. While
  // open, the front coming within ONB_DIM_NEAR_HOPS again (it was not on the last step) is its trigger again (D141)
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
  if (isOpen(t, 'G12') && has('dim')) setLine(t, ev, 'G12', 'G12.caught');
  if (s.phase !== 'MAP' || s.node || s.fight) return;
  // On the map: G2 (first map view at the hub), G5 (first return to the map after G4), G13 (far from a Road, or on one)
  if (!fired(t, 'G2') && zone.pos === 0) op('G2', 'G2');
  if (!fired(t, 'G5') && fired(t, 'G4') && !now.has('G4') && !(s.loot && s.loot.length)) op('G5', 'G5');
  if (!fired(t, 'G13')) {
    if (zone.nodes[zone.pos].road) op('G13', 'G13.onRoad');
    else {
      const d = hops(zone.nodes, zone.pos);
      if (Math.min(...zone.roads.map((r) => d[r])) >= ONB_BELL_HOPS && dimAt(zone, zone.pos) - zoneTime(s) <= ONB_BELL_DIM) op('G13', 'G13');
    }
  } else if (isOpen(t, 'G13') && zone.nodes[zone.pos].road) setLine(t, ev, 'G13', 'G13.onRoad');
}

// ---------------- View (E5) ----------------
/**
 * The guided run for the UI, or null in any other run: { on, skipped, ended, guidedZone, script (scripted fights ended),
 * scripts (ONB_SCRIPTED_FIGHTS), next (the next script's id or null), sites (Cull site fights started), eliteNodeId,
 * elite ({ node, enemy, level, barred, afterScript, left (scripted fights until the node opens) } or null), rescues,
 * rescueTolls, beat and line (the open beat with a line that is not resting, highest priority first; spec 2.5, D141), open
 * ([{ id, line, rest }] by priority; rest: it has yielded its line, yieldLines), done (beats closed, spec order), learned (closed by the player doing it), skippedBeats }. Pure and cheap.
 */
export function tutorialView(s) {
  const t = s.tutorial;
  if (!t) return null;
  const T = table(s);
  const zone = inZone1(s) && s.zone.tut ? s.zone : null;
  const eid = zone ? zone.tut.elite : null;
  const gate = scriptIndex(T, T.elite.gate.afterScript) + 1;
  const openList = ONB_BEAT_PRIORITY.filter((id) => isOpen(t, id)).map((id) => ({ id, line: t.beats[id].line, rest: !!t.beats[id].rest }));
  const cur = guideOn(s) ? openList.find((o) => o.line && !o.rest) || null : null;
  const st = (id) => (t.beats[id] ? t.beats[id].st : null);
  return {
    on: t.on, skipped: t.skipped, ended: t.ended, guidedZone: guidedZone(s),
    script: t.script, scripts: ONB_SCRIPTED_FIGHTS, next: t.script < T.scripts.length ? T.scripts[t.script].id : null, sites: t.sites,
    eliteNodeId: eid,
    elite: eid === null ? null : {
      node: eid, enemy: T.elite.enemy, level: zone.nodes[eid].eliteLevel, barred: !!zone.nodes[eid].barred,
      afterScript: T.elite.gate.afterScript, left: Math.max(0, gate - t.script),
    },
    rescues: t.rescues, rescueTolls: ONB_RESCUE_TOLLS,
    beat: cur ? cur.id : null, line: cur ? cur.line : null, open: openList,
    done: ONB_BEATS.filter((id) => st(id) === 'done' || st(id) === 'missed'),
    learned: ONB_BEATS.filter((id) => st(id) === 'done'),
    skippedBeats: ONB_BEATS.filter((id) => st(id) === 'skip'),
  };
}
