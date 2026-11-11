// Player-visible view of a fight and the combat v2 adapters the bots and the recorder share (combat-v2.md 3, 5,
// 6, 11). The look-ahead bots (opener, tactician engage search) plan only on playerView(): a copy of the state in
// which every part a player cannot see is replaced by a stream drawn from the bot stream, so a plan can only use
// what the player sees (combat-v2.md 11 "Look-ahead fairness": entries already in the track are facts; entries not
// yet shown are re-drawn). The hidden parts are listed in HIDDEN and are never read here; qa/sim/combat2.test.mjs
// checks that the opener's choice does not change when they change and that it never reads them.
// Adapters: one place that knows how the engine shows the engage round, the engage options, the intent track and
// OFF_BALANCE, so the bots work on the M2 v5 engine (no track, Rogue stealth round only) and on combat v2.
// Expedition fog map (expedition.md 5, 10; MILESTONES 2b.4): fogInput (the bots' only zone input: R.mapView), skeleton
// helpers on that view (hops, Dimming depth, escape route), the belief over unknown nodes, and, separated, the oracle's
// full-information input (diagnostic only, B41).
import { R, C, makeRng } from './engine.mjs';
import { treeClone } from './clone.mjs';

/** Hidden parts of the state: the random streams. state.lootRng and state.fight.rng. */
export const HIDDEN = Object.freeze({ state: ['lootRng'], fight: ['rng'] });

/**
 * Look-ahead copy of a fight state built only from visible parts: as fightClone (sim/lib/clone.mjs), but the fight
 * stream and the loot stream are fresh streams seeded from `rng` (a BotRng). The hidden fields are skipped, never
 * read. Re-seed `view.fight.rng` per sample (resample) to draw other unseen futures.
 */
export function playerView(s, rng) {
  const o = {};
  for (const k in s) {
    if (HIDDEN.state.includes(k) || k === 'fight') continue;
    o[k] = s[k];
  }
  const f = s.fight;
  const vf = {};
  for (const k in f) {
    if (HIDDEN.fight.includes(k)) continue;
    vf[k] = treeClone(f[k]);
  }
  vf.rng = makeRng(rng.u32());
  o.fight = vf;
  o.lootRng = f.kind === 'boss' ? null : makeRng(rng.u32());
  o.player = treeClone(s.player);
  o.stats = treeClone(s.stats);
  o.node = treeClone(s.node);
  o.loot = treeClone(s.loot);
  o.death = treeClone(s.death);
  o.service = treeClone(s.service);
  o.hub = treeClone(s.hub);
  o.camp = treeClone(s.camp);
  if (s.zone) {
    o.zone = { ...s.zone, pos: { ...s.zone.pos } };
    if (s.zone.rows) o.zone.rows = s.zone.rows.map((row) => row.map((n) => ({ ...n })));
    if (s.zone.path) o.zone.path = s.zone.path.slice();
  }
  return o;
}

/** A copy of a view for one look-ahead sample: as fightClone, with its own fight stream from `seed`. */
export function resample(view, seed, clone) {
  const c = clone(view);
  c.fight.rng = makeRng(seed >>> 0);
  return c;
}

// ---------------- Combat v2 adapters ----------------
/** Status id of OFF_BALANCE (combat-v2.md 5): the engine's id, else the spec's name. */
export const OFFBAL_ID = typeof C.OFFBAL_STATUS === 'string' ? C.OFFBAL_STATUS : 'OFF_BALANCE';
const OFFBAL_IDS = new Set([OFFBAL_ID, 'OFF_BALANCE', 'OFFBAL']);
export const isOffBalanceId = (id) => OFFBAL_IDS.has(id);
export const offBalance = (e) => !!(e && e.alive && e.st.some((x) => OFFBAL_IDS.has(x.id)));
/** The enemy is in a window the engine counts (combat v2 R.offBalance: OFF_BALANCE, or FROZEN while it lasts). */
export function inWindow(s, e) {
  if (!e || !e.alive) return false;
  if (typeof R.offBalance === 'function') return !!R.offBalance(s, e.idx);
  return offBalance(e);
}

/** True in the engage round (combat-v2.md 6): round 1 of a fight with one (every non-boss fight in v2, the Rogue's
 *  stealth round before). */
export function isEngageRound(s) {
  const f = s.fight;
  if (!f) return false;
  if (typeof R.isEngageRound === 'function') return !!R.isEngageRound(s);
  if (f.round !== 1 || f.kind === 'boss') return false;
  if (f.engage !== undefined) return !!f.engage;
  return !!f.unaware;
}

/** ENGAGE actions legal now (combat-v2.md 6.1), from the engine's legal actions. */
export function engageActions(s) {
  if (!isEngageRound(s)) return [];
  return R.legalActions(s).filter((a) => a.type === 'ENGAGE');
}

/** Option id of an ENGAGE action (field name of the engine's action). */
export const engageId = (a) => (a ? a.option ?? a.optionId ?? a.id ?? null : null);

/** Engage option kinds of combat-v2.md 6.2 (strike, control, setup); the engine's table when it has one. */
const ENGAGE_KIND = {
  ambush: 'strike', sap: 'control', premeditate: 'setup',
  precast: 'strike', binding_glyph: 'control', gather_power: 'setup',
  opening_shot: 'strike', lay_trap: 'control', send_pet: 'setup',
};
export function engageKind(id) {
  const t = C.ENGAGE_OPTION || null;
  if (t && t[id] && t[id].kind) return t[id].kind;
  return ENGAGE_KIND[id] || 'other';
}
/** Engage options per class (combat-v2.md 6.2) in the order strike, control, setup: the engine's table when it has one. */
export const CLASS_ENGAGE = C.ENGAGE_OPTIONS || { rogue: ['ambush', 'sap', 'premeditate'], mage: ['precast', 'binding_glyph', 'gather_power'], hunter: ['opening_shot', 'lay_trap', 'send_pet'] };

/**
 * Visible track of an enemy (combat-v2.md 3.1): [{ turn, id, heavy, cast, est, target, ... }], "now" first. The
 * M2 v5 engine has no track: its current intent is the only entry.
 */
export function trackOf(e) {
  if (!e || !e.alive) return [];
  if (Array.isArray(e.track)) return e.track;
  return e.intent ? [e.intent] : [];
}

/** An entry announces a big move (heavy hit or cast) that is not already stopped. */
export const isThreat = (it) => !!(it && (it.heavy || it.cast) && !it.interrupted && !it.skipped && !it.cancelled);

/**
 * The enemy's next `n` actions as the player sees them: in the engage round the track's first entries (turns 1..n;
 * nobody acts this round); later the now-entry as it will be played (enemy.intent: cancelled, replaced, interrupted
 * show there) and the track entries after it. M2 v5 engine: the current intent only.
 */
export function nextEntries(s, e, n = 2) {
  if (!e || !e.alive) return [];
  const tr = trackOf(e);
  if (!Array.isArray(e.track)) return tr.slice(0, n);
  if (isEngageRound(s)) return tr.slice(0, n);
  return [e.intent, ...tr.slice(1, n)].filter(Boolean);
}

/** Estimated damage on the player of an enemy's next `n` actions (nextEntries; the est values the UI shows). */
export function trackDamage(s, e, n = 2) {
  let d = 0;
  for (const it of nextEntries(s, e, n)) if (it && (it.target === 'player' || it.target === 'all') && !it.interrupted && !it.cancelled) d += it.est || 0;
  return d;
}

/**
 * Default target (rules 7.9): the engine's when it exports one; else rules 7.9 as written there (living, not HEXED,
 * mender > caster > others, lowest HP, lowest index; HEXED enemies only when no other is left).
 */
const PRIORITY = { mender: 0, caster: 1 };
export function defaultTarget(s) {
  if (typeof R.defaultTarget === 'function') return R.defaultTarget(s);
  const f = s.fight;
  const rank = (e) => (e.arch in PRIORITY ? PRIORITY[e.arch] : 2);
  for (const pass of [false, true]) {
    let best = null;
    for (const e of f.enemies) {
      if (!e.alive || (!pass && e.st.some((x) => x.id === 'HEXED'))) continue;
      if (!best || rank(e) < rank(best) || (rank(e) === rank(best) && e.hp < best.hp)) best = e;
    }
    if (best) return best.idx;
  }
  return null;
}

/** Enemy index an action aims at (ENGAGE, CAST on an enemy, ATTACK), else null. */
export function actionTarget(a) {
  if (!a) return null;
  if (a.type === 'ATTACK' || a.type === 'ENGAGE') return typeof a.target === 'number' ? a.target : null;
  if (a.type === 'CAST' && C.SPELL[a.spellId] && C.SPELL[a.spellId].target === 'enemy') return typeof a.target === 'number' ? a.target : null;
  return null;
}

/** Short label of a combat action for the recorder and logs. */
export function actionLabel(a) {
  if (!a) return '';
  if (a.type === 'ENGAGE') return `${engageKind(engageId(a))}:${engageId(a)}`;
  if (a.type === 'CAST') return `spell:${a.spellId}`;
  if (a.type === 'ATTACK') return 'attack';
  if (a.type === 'USE_ITEM') return 'item';
  return a.type.toLowerCase();
}

// ---------------- Expedition fog map (expedition.md 5, 10.1-10.2; engine-api.md 10.3) ----------------
// The bots' expedition map policies decide from fogInput(s) only: R.mapView(s), the fog view (skeleton, every
// node's Dimming clock, Roads, Shardfall, the zone's region list, and the nodes the player has seen), plus the
// character model of sim/lib/model.mjs (makeCtx: level, XP, HP, bag, meta; nothing of the zone's hidden contents).
// The helpers below read only that view. qa/sim/fog.test.mjs replaces the hidden nodes' contents and checks that every
// bot decision stays the same (the leak test of expedition.md 10.1), and that the oracle's decisions do change.

/** The fog view: the only zone input of a bot's expedition map decision. */
export function fogInput(s) {
  return R.mapView(s);
}

const hopCache = new WeakMap();
/** Hops of every node from node `from` over the skeleton (visible edges). */
export function viewHops(view, from) {
  let byFrom = hopCache.get(view);
  if (!byFrom) { byFrom = new Map(); hopCache.set(view, byFrom); }
  if (byFrom.has(from)) return byFrom.get(from);
  const d = new Array(view.nodes.length).fill(Infinity);
  d[from] = 0;
  const q = [from];
  for (let i = 0; i < q.length; i++) for (const v of view.nodes[q[i]].nb) if (d[v] === Infinity) { d[v] = d[q[i]] + 1; q.push(v); }
  byFrom.set(from, d);
  return d;
}

/** Is view node id Dimmed at zone toll zt? (dimAt is on every node of the view; Infinity without the Dimming.) */
export const dimmedAtV = (view, id, zt) => zt >= view.nodes[id].dimAt;

/** Front at zone toll zt (rules 1.9.6, from the view's dim block). */
export function frontAtV(view, zt) {
  const d = view.dim;
  if (d.off || zt < d.grace) return -1;
  return Math.floor((d.frontHops * (zt - d.grace)) / d.frontTime);
}

/** Depth of a Dimmed encounter at node id at zone toll zt (front - hops from the Shardfall), -1 when not Dimmed. */
export function dimDepthV(view, id, zt) {
  if (!dimmedAtV(view, id, zt)) return -1;
  return Math.max(0, frontAtV(view, zt) - viewHops(view, view.shardfall)[id]);
}

/** Can MOVE enter view node id's content at zone toll zt: known, unresolved, not the hub, not Dimmed. */
export function enterableV(view, id, zt, resolved = null) {
  const n = view.nodes[id];
  return n.know === 'full' && !n.hub && !n.done && !(resolved && resolved.has(id)) && !dimmedAtV(view, id, zt);
}

/**
 * Cheapest way from node `from` at zone toll zt to a Road over the skeleton (as the engine's default policy, rules
 * 1.9.9): Dijkstra over steps of walkTime; a step onto a node Dimmed on arrival also costs TIME_DIM_FIGHT and counts as
 * a Dimmed step (its depth is summed). Order: Dimmed steps, tolls, lower id. `roads` (default: the view's) restricts the
 * targets. Returns { road, path (from `from` to the Road), dims, depth, time }.
 */
export function escapeV(view, from, zt, roads = view.roads) {
  const N = view.nodes.length;
  const lab = new Array(N).fill(null);
  const prev = new Array(N).fill(-1);
  const done = new Array(N).fill(false);
  const better = (a, b) => !b || a.dims < b.dims || (a.dims === b.dims && a.h < b.h);
  lab[from] = { dims: 0, depth: 0, h: 0 };
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && lab[i] && (u < 0 || better(lab[i], lab[u]))) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const v of view.nodes[u].nb) {
      if (done[v]) continue;
      let h = lab[u].h + view.walkTime;
      const dd = dimDepthV(view, v, zt + h);
      if (dd >= 0) h += C.TIME_DIM_FIGHT;
      const c = { dims: lab[u].dims + (dd >= 0 ? 1 : 0), depth: lab[u].depth + Math.max(0, dd), h };
      if (better(c, lab[v])) { lab[v] = c; prev[v] = u; }
    }
  }
  let road = null;
  for (const r of roads) if (lab[r] && (road === null || better(lab[r], lab[road]))) road = r;
  if (road === null) return { road: null, path: [from], dims: 0, depth: 0, time: Infinity };
  const path = [];
  for (let x = road; x !== -1; x = prev[x]) path.unshift(x);
  return { road, path, dims: lab[road].dims, depth: lab[road].depth, time: lab[road].h };
}

const FILL_TYPES = ['quest', 'grind', 'elite', 'rest', 'vendor', 'trainer', 'treasure', 'shrine'];
const NO_RING1 = new Set(['elite', 'vendor', 'trainer']);

/**
 * Belief over an unknown node's type (expedition.md 10.2): the region kind's weights (REGION_W) when the node's
 * region is known, else the mean over the zone's region kinds (the view lists them); no Elite, Vendor or Trainer in
 * ring 1 (rules 1.9.3). Returns [[type, probability]].
 */
export function typeBelief(view, node) {
  const kinds = node.region !== null && node.region !== undefined && view.regions[node.region]
    ? [view.regions[node.region].kind]
    : (view.regions.length ? view.regions.map((r) => r.kind) : Object.keys(C.REGION_W));
  const w = {};
  let tot = 0;
  for (const t of FILL_TYPES) {
    if (node.ring === 1 && NO_RING1.has(t)) continue;
    let x = 0;
    for (const k of kinds) x += (C.REGION_W[k] && C.REGION_W[k][t]) || 0;
    if (x > 0) { w[t] = x; tot += x; }
  }
  return Object.entries(w).map(([t, x]) => [t, x / tot]).sort((a, b) => b[1] - a[1]);
}

/**
 * A stand-in map cell of type `type` for a node whose details are not seen: content level the middle of its ring's
 * band (the view's bands), two quest mobs, one Grind wave of GRIND_WAVE_SIZE, an elite at CL + ELITE_LEVEL_OFFSET
 * without an add, a treasure guarded with TREASURE_GUARD_CHANCE (valued as guarded when >= 0.5).
 */
export function protoCell(view, node, type) {
  const [lo, hi] = view.bands[node.ring];
  const cl = Math.round((lo + hi) / 2);
  switch (type) {
    case 'quest': return { type, cl, archetypes: [null, null] };
    case 'grind': return { type, cl, archetypes: new Array(C.GRIND_WAVE_SIZE).fill(null) };
    case 'elite': return { type, cl, level: cl + C.ELITE_LEVEL_OFFSET, archetypes: [null], rare: null };
    case 'treasure': return { type, cl, guarded: C.TREASURE_GUARD_CHANCE >= 0.5, trap: null };
    case 'dungeon': return { type, cl, level: cl, bossLevel: cl + 1 };
    default: return { type, cl };
  }
}

// ---------------- Oracle input (diagnostic only; expedition.md 10.2, 11.1 B41) ----------------
// The oracle is the planner's search with full information of the current zone. It reads the hidden contents through
// the engine's own reveal (R.debug.revealMap on a copy: every node seen) and is used only to measure C_step: the
// runner asks it at every planner map decision and records whether the two agree; its choice never acts in a
// measured run. No other bot code calls this.
export function oracleInput(s) {
  return R.mapView(R.debug.revealMap(s).state);
}
