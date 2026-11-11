// Expedition map (rules 1.9, marked "(expedition)"; docs/specs/expedition.md 4-7 and 9.5): the roamable zone graph and
// its generation (stream map(z)), node setup by region (stream nodeId(z,id)), hop distances, the Dimming's front (off
// in a run created with dimming: false, D50), vision and the player-visible map view (Road names, expedition texts and
// region families from content, D51; elites without their name or own archetype, D50). Pure helpers of the state; the
// run flow (moves, Dimmed encounters, Roads, the Homeward Bell) is in nodes.js. Only a run created with mapMode
// 'expedition' uses the map; the mode helpers (node time, grind waves, XP weight) answer for both maps. Time is counted in
// whole tolls (M2b v7, docs/specs/changes-m2b-v7.md A-C); the Dimming's front is computed in integers (D70). Start camp
// and contracts (prep, expedition.md 2-3; contracts.js): the zone keeps the map(z) stream after the node types for the
// contract sites (siteRng), a Delve contract shows its dungeon, and the view shows the site marks the player sees.
import {
  ZONE_LEVELS, NODE_DRAW_ORDER, QUEST_LEVEL_OFFSETS, ELITE_LEVEL_OFFSET, RARE_CHANCE, QUEST_SIZE_W1, QUEST_SIZE_W2,
  QUEST_SIZE_W3, QUEST_MAX_SIZE_Z1, GRIND_WAVE_SIZE, ELITE_ADD_CHANCE, DUNGEON_SIZE_W2, DUNGEON_SIZE_W3,
  TREASURE_GUARD_CHANCE, TREASURE_TRAP_CHANCE, BOON, BOON_IDS, SHRINE_BOON_COUNT, GRIND_MAX_WAVES, TIME_QUEST,
  TIME_GRIND_WAVE, TIME_ELITE, TIME_DUNGEON, TIME_REST, TIME_VENDOR, TIME_TRAINER, TIME_TREASURE, TIME_SHRINE,
  TIME_WALK, TIME_TRAVEL, RING_NODES, RING_CL_BASE, RING_CL_SPREAD, EDGE_KEEP_R1, EDGE_KEEP_R2, EDGE_KEEP_R3,
  EDGE_DIAG_R23, REGION_COUNT, REGION_FAMILY_SHARE, REGION_W, REGION_KINDS, RING1_FORBIDDEN, ROAD_COUNT, VISION_RADIUS,
  VISION_RADIUS_MAX, GUIDE_RADIUS_BONUS, PATHFINDER_RADIUS, DIM_GRACE, DIM_FRONT_HOPS, DIM_FRONT_TIME, DUNGEON_DIM_HOLD, BELL_CHANNEL_TIME,
  XP_WEIGHT_MULT, EXPED_GRIND_MAX_WAVES, EXPED_DUNGEON_TRASH_FIGHTS, EXPED_TIME_QUEST, EXPED_TIME_ELITE,
  EXPED_TIME_GRIND_WAVE, EXPED_TIME_DUNGEON, EXPEDITION_TEXT_IDS,
} from '../constants.js';
import { STREAM, nextFloat, nextInt, weightedIndex } from '../rng.js';
import { zoneContent } from './content.js';
import { composeEncounter, vendorStock, dungeonLevels, clampCl, pickFrom } from './map.js';

// ---------------- Map modes (rules 1.9) ----------------
/** Map modes of newRun: 'rows' (rules 1.4, the default until the switch-over) and 'expedition' (rules 1.9). */
export const MAP_MODES = ['rows', 'expedition'];
export const isExpedition = (s) => s.mapMode === 'expedition';
/** Grind waves a Grind node allows (rules 2.2; 1.9.8). */
export const grindMaxWaves = (s) => (isExpedition(s) ? EXPED_GRIND_MAX_WAVES : GRIND_MAX_WAVES);
/** × the XP of kills, quest turn-ins, grind waves and dungeon clears (rules 1.9.8: XP_WEIGHT_MULT; rows: 1). */
export const xpWeight = (s) => (isExpedition(s) ? XP_WEIGHT_MULT : 1);
const ROWS_TIME = {
  quest: TIME_QUEST, grind: TIME_GRIND_WAVE, elite: TIME_ELITE, dungeon: TIME_DUNGEON, rest: TIME_REST,
  vendor: TIME_VENDOR, trainer: TIME_TRAINER, treasure: TIME_TREASURE, shrine: TIME_SHRINE,
};
const EXP_TIME = { ...ROWS_TIME, quest: EXPED_TIME_QUEST, grind: EXPED_TIME_GRIND_WAVE, elite: EXPED_TIME_ELITE, dungeon: EXPED_TIME_DUNGEON };
/** Tolls of a node type on entry (rules 2.0; a Grind per wave); in an expedition run the 1.9.8 values. */
export const nodeTime = (s, type) => (isExpedition(s) ? EXP_TIME : ROWS_TIME)[type];

// ---------------- Graph (rules 1.9.2) ----------------
/** First node id of each ring: the hub is id 0, then ring 1, ring 2, ring 3; ids follow angle order within a ring. */
export const RING_START = RING_NODES.map((_, r) => RING_NODES.slice(0, r).reduce((a, b) => a + b, 0));
export const NODE_COUNT = RING_NODES.reduce((a, b) => a + b, 0);
const norm = (a) => ((a % 360) + 360) % 360;
/** Angle in degrees, in [0, 360), kept at 6 decimals. */
function angleOf(a) {
  const x = Math.round(norm(a) * 1e6) / 1e6;
  return x >= 360 ? x - 360 : x;
}
/** Smallest angle between two directions (degrees). */
export function angDist(a, b) {
  const d = norm(a - b);
  return Math.min(d, 360 - d);
}

/** Hops from node `from` to every node (BFS over the zone's edges). */
export function hops(nodes, from) {
  const d = nodes.map(() => Infinity);
  d[from] = 0;
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    for (const v of nodes[u].nb) if (d[v] === Infinity) { d[v] = d[u] + 1; q.push(v); }
  }
  return d;
}

/**
 * The zone's regions in content order (rules 1.9.2): content `zones[i].regions` ({ id, name, kind, families }) when it
 * has REGION_COUNT of them, else one region of each kind (REGION_KINDS order) without a name or families.
 */
export function zoneRegions(content, z) {
  const list = zoneContent(content, z).regions;
  if (Array.isArray(list) && list.length === REGION_COUNT) {
    return list.map((r) => ({ id: r.id || null, name: r.name || null, kind: r.kind, families: Array.isArray(r.families) ? r.families : [] }));
  }
  const out = [];
  for (let i = 0; i < REGION_COUNT; i++) out.push({ id: null, name: null, kind: REGION_KINDS[i % REGION_KINDS.length], families: [] });
  return out;
}

/**
 * Zone graph of an expedition run (rules 1.9.2), stream map(z), draws in this order: 1. angles a1, a2; 2. edges: one
 * draw per ring 1 pair, per ring 2 pair, per ring 3 node's diagonal, per ring 3 pair; 3. regions: offset, then the
 * Fisher-Yates shuffle of the zone's regions onto the wedges; 4. Roads: start, then the pair the Shardfall lies
 * between; 5. node types: Dungeon, Rest, Trainer, then the weighted fill in id order. 6. Node setup per node on
 * nodeId(z, id). The player starts on the hub.
 */
export function generateExpZone(s, z) {
  const c = s.content;
  const regs = zoneRegions(c, z);
  const rng = STREAM.map(s.seed, z);
  const [, n1, n2, n3] = RING_NODES;
  const id = (ring, i) => RING_START[ring] + (((i % RING_NODES[ring]) + RING_NODES[ring]) % RING_NODES[ring]);
  // 1. Angles
  const a1 = nextFloat(rng) * (360 / n1);
  const a2 = nextFloat(rng) * (360 / n2);
  const nodes = [];
  const add = (ring, a) => nodes.push({ id: nodes.length, ring, angle: angleOf(a), nb: [], region: null, road: false, shardfall: false, type: null });
  add(0, 0);
  for (let i = 0; i < n1; i++) add(1, a1 + (360 / n1) * i);
  for (let j = 0; j < n2; j++) add(2, a2 + (360 / n2) * j);
  for (let j = 0; j < n3; j++) add(3, a2 + (360 / n3) * (j + 0.5));
  // 2. Edges. The spokes (hub - ring 1, ring 2 - nearest ring 1, ring 3 - its ring 2 parent) connect every node.
  const link = (a, b) => {
    if (a !== b && !nodes[a].nb.includes(b)) { nodes[a].nb.push(b); nodes[b].nb.push(a); }
  };
  for (let i = 0; i < n1; i++) link(0, id(1, i));
  for (let i = 0; i < n1; i++) if (nextFloat(rng) < EDGE_KEEP_R1) link(id(1, i), id(1, i + 1));
  for (let j = 0; j < n2; j++) {
    const a = nodes[id(2, j)].angle;
    let best = 0;
    for (let i = 1; i < n1; i++) if (angDist(a, nodes[id(1, i)].angle) < angDist(a, nodes[id(1, best)].angle)) best = i;
    link(id(2, j), id(1, best));
  }
  for (let j = 0; j < n2; j++) if (nextFloat(rng) < EDGE_KEEP_R2) link(id(2, j), id(2, j + 1));
  for (let j = 0; j < n3; j++) {
    // Ring 3 node j lies between two ring 2 nodes: its parent is the nearer one (ties: the earlier, ring 2 node j when
    // the rings have equal counts), the diagonal goes to the other one.
    const pos = ((j + 0.5) * n2) / n3;
    const lo = Math.floor(pos);
    const near = pos - lo <= 0.5 + 1e-9 ? lo : lo + 1;
    link(id(3, j), id(2, near));
    if (nextFloat(rng) < EDGE_DIAG_R23) link(id(3, j), id(2, near === lo ? lo + 1 : lo));
  }
  for (let j = 0; j < n3; j++) if (nextFloat(rng) < EDGE_KEEP_R3) link(id(3, j), id(3, j + 1));
  for (const n of nodes) n.nb.sort((a, b) => a - b);
  // 3. Regions: REGION_COUNT wedges from a uniform offset; the zone's regions shuffled onto them.
  const wedge = 360 / REGION_COUNT;
  const offset = nextFloat(rng) * wedge;
  const order = regs.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  for (const n of nodes) if (n.ring > 0) n.region = order[Math.min(REGION_COUNT - 1, Math.floor(norm(n.angle - offset) / wedge))];
  // 4. Landmarks: ROAD_COUNT Roads evenly spaced on ring 3; the Shardfall halfway between a uniform pair of them.
  const start = nextInt(rng, n3);
  const roadIdx = [];
  for (let k = 0; k < ROAD_COUNT; k++) roadIdx.push((start + Math.round((k * n3) / ROAD_COUNT)) % n3);
  const p = nextInt(rng, ROAD_COUNT);
  const gap = ROAD_COUNT > 1 ? (roadIdx[(p + 1) % ROAD_COUNT] - roadIdx[p] + n3) % n3 : n3;
  const roads = roadIdx.map((j) => id(3, j));
  const shardfall = id(3, roadIdx[p] + Math.round(gap / 2));
  for (const r of roads) nodes[r].road = true;
  nodes[shardfall].shardfall = true;
  // 5. Node types
  nodes[0].type = 'hub';
  const free = (n) => n.type === null;
  const dungeonAt = nodes.filter((n) => (n.ring === 2 || n.ring === 3) && !n.road && !n.shardfall);
  dungeonAt[nextInt(rng, dungeonAt.length)].type = 'dungeon';
  const restAt = nodes.filter((n) => (n.ring === 1 || n.ring === 2) && free(n));
  restAt[nextInt(rng, restAt.length)].type = 'rest';
  const trainerAt = nodes.filter((n) => n.ring === 2 && free(n));
  trainerAt[nextInt(rng, trainerAt.length)].type = 'trainer';
  nodes[shardfall].type = 'treasure';
  for (const n of nodes) {
    if (!free(n)) continue;
    const w = REGION_W[regs[n.region].kind];
    n.type = NODE_DRAW_ORDER[weightedIndex(rng, NODE_DRAW_ORDER.map((t) => (n.ring === 1 && RING1_FORBIDDEN.includes(t) ? 0 : w[t])))];
  }
  // 6. Node setup; the contract sites (expedition.md 3.3, contracts.js) continue the map(z) stream from here (siteRng).
  for (const n of nodes) setupExpNode(s, z, n, regs);
  return {
    z, mode: 'expedition', nodes, hub: 0, roads, shardfall, shardDist: hops(nodes, shardfall), siteRng: rng,
    pos: 0, start: s.time, seen: nodes.map(() => false), typed: nodes.map(() => false), dimN: nodes.map(() => 0),
    hubStock: null, path: [0], questsDone: 0, storyDone: false,
    // D50: newRun({ dimming: false }) plays the zone without the Dimming (every node dims at zone time Infinity).
    ...(s.exp && s.exp.dimming === false ? { dimOff: true } : {}),
  };
}

/**
 * Node setup (rules 1.9.3), stream nodeId(z, id). The first draw is the content level's spread u; then as rules 1.4
 * step 4 with EXPED_GRIND_MAX_WAVES waves and EXPED_DUNGEON_TRASH_FIGHTS trash fights. Every enemy template pick of a
 * quest, grind wave, elite (template and add) and treasure guard takes 2 draws: the family share (below
 * REGION_FAMILY_SHARE: from the list's templates whose `family` is one of the region's families, when there is one),
 * then the pick. Dungeons keep their own lists. The hub has no setup (band minimum, resolved).
 */
export function setupExpNode(s, z, n, regs) {
  const c = s.content;
  const zn = zoneContent(c, z);
  const band = ZONE_LEVELS * (z - 1) + 1;
  if (n.ring === 0) {
    n.cl = band;
    n.done = true;
    return n;
  }
  const rng = STREAM.nodeId(s.seed, z, n.id);
  const cl = clampCl(band + RING_CL_BASE[n.ring] + nextInt(rng, RING_CL_SPREAD));
  n.cl = cl;
  n.done = false;
  const fam = regs[n.region].families;
  const pick = (list) => {
    const inFamily = nextFloat(rng) < REGION_FAMILY_SHARE;
    const sub = inFamily && fam.length ? list.filter((t) => fam.includes(c.enemies[t].family)) : [];
    return pickFrom(rng, sub.length ? sub : list);
  };
  if (n.type === 'quest') {
    const qid = pickFrom(rng, zn.quests);
    const q = c.quests[qid];
    const drawn = 1 + weightedIndex(rng, q.sizeWeights || [QUEST_SIZE_W1, QUEST_SIZE_W2, QUEST_SIZE_W3]);
    const size = z === 1 ? Math.min(QUEST_MAX_SIZE_Z1, drawn) : drawn;
    const pool = q.enemies && q.enemies.length ? q.enemies : zn.normals;
    let mobs = [];
    for (let i = 0; i < size; i++) mobs.push(pick(pool));
    mobs = composeEncounter(c, rng, mobs, pool, zn.normals);
    n.cl = clampCl(cl + QUEST_LEVEL_OFFSETS[nextInt(rng, QUEST_LEVEL_OFFSETS.length)]);
    n.quest = qid;
    n.mobs = mobs;
  } else if (n.type === 'grind') {
    n.waves = [];
    for (let w = 0; w < EXPED_GRIND_MAX_WAVES; w++) {
      const wave = [];
      for (let i = 0; i < GRIND_WAVE_SIZE; i++) wave.push(pick(zn.normals));
      n.waves.push(composeEncounter(c, rng, wave, zn.normals));
    }
  } else if (n.type === 'elite') {
    n.rare = nextFloat(rng) < RARE_CHANCE;
    n.elite = pick(n.rare ? zn.rares : zn.elites);
    n.add = nextFloat(rng) < ELITE_ADD_CHANCE ? pick(zn.normals) : null;
    if (n.add) n.add = composeEncounter(c, rng, [n.elite, n.add], zn.normals)[1];
    n.eliteLevel = clampCl(cl + ELITE_LEVEL_OFFSET);
  } else if (n.type === 'dungeon') {
    const lv = dungeonLevels(z);
    n.trashLevel = lv.trash;
    n.bossLevel = lv.boss;
    n.cl = lv.trash;
    n.trash = [];
    for (let k = 0; k < EXPED_DUNGEON_TRASH_FIGHTS; k++) {
      const size = 2 + weightedIndex(rng, [DUNGEON_SIZE_W2, DUNGEON_SIZE_W3]);
      const f = [];
      for (let i = 0; i < size; i++) f.push(pickFrom(rng, zn.dungeon.trash));
      n.trash.push(composeEncounter(c, rng, f, zn.dungeon.trash));
    }
    n.boss = zn.dungeon.boss;
  } else if (n.type === 'vendor') {
    n.stock = vendorStock(s, rng, cl);
  } else if (n.type === 'shrine') {
    const ids = BOON_IDS.slice();
    n.boons = [];
    for (let i = 0; i < SHRINE_BOON_COUNT; i++) {
      const k = weightedIndex(rng, ids.map((b) => BOON[b].weight));
      n.boons.push(ids[k]);
      ids.splice(k, 1);
    }
  } else if (n.type === 'treasure') {
    n.guard = nextFloat(rng) < TREASURE_GUARD_CHANCE ? pick(zn.normals) : null;
    // The trap is the first draw of loot(z, id) (rules 2.8), computed here as on today's map.
    n.trap = nextFloat(STREAM.lootId(s.seed, z, n.id)) < TREASURE_TRAP_CHANCE;
  }
  return n;
}

// ---------------- The Dimming (rules 1.9.6) ----------------
/** Zone time zt: run tolls since arrival at the zone's hub, hub services included. */
export const zoneTime = (s) => s.time - s.zone.start;
/**
 * The front at zone time zt (rules 1.9.6, M2b v7 / D70): -1 before DIM_GRACE, then
 * floor(DIM_FRONT_HOPS × (zt - DIM_GRACE) / DIM_FRONT_TIME), in integers.
 */
export function frontAt(zt) {
  return zt < DIM_GRACE ? -1 : Math.floor((DIM_FRONT_HOPS * (zt - DIM_GRACE)) / DIM_FRONT_TIME);
}
/** First zone toll at which a node `hops` from the Shardfall is Dimmed: DIM_GRACE + ceil(hops × DIM_FRONT_TIME / DIM_FRONT_HOPS), in integers. */
export function dimAtHops(hops) {
  return DIM_GRACE + Math.floor((hops * DIM_FRONT_TIME + DIM_FRONT_HOPS - 1) / DIM_FRONT_HOPS);
}
/**
 * First zone toll at which node id is Dimmed: dimAtHops(hops from the Shardfall), and for the zone's Dungeon node
 * DUNGEON_DIM_HOLD tolls later (M2b v10, D85: the dungeon holds out; the front and every other node are unchanged).
 * Infinity in a zone played without the Dimming (dimOff, newRun option dimming: false, D50).
 */
export function dimAt(zone, id) {
  if (zone.dimOff) return Infinity;
  return dimAtHops(zone.shardDist[id]) + (zone.nodes[id].type === 'dungeon' ? DUNGEON_DIM_HOLD : 0);
}
export const dimmedAt = (zone, id, zt) => zt >= dimAt(zone, id);
/**
 * The zone toll node id dims at as the player sees it (rules 1.9.5, 1.9.6; mapView and the autoplay map policy): dimAt,
 * but the Dungeon's hold only once the player knows the node is the Dungeon (seen, or its type known: Region Charts, a
 * Delve, Pathfinder). On a hidden node the hold would tell where the Dungeon is. The player can only enter a node next
 * to his own, which is always seen, so what he can do never differs from dimAt.
 */
export function dimAtSeen(s, id) {
  const zone = s.zone;
  if (zone.dimOff) return Infinity;
  const n = zone.nodes[id];
  return dimAtHops(zone.shardDist[id]) + (n.type === 'dungeon' && knowledge(s, n) !== 'none' ? DUNGEON_DIM_HOLD : 0);
}
export const dimmedSeen = (s, id, zt) => zt >= dimAtSeen(s, id);
/** Is node id (default: the player's) Dimmed now? */
export const dimmedNow = (s, id = s.zone.pos) => dimmedAt(s.zone, id, zoneTime(s));
/** Tolls until the front advances again: dimAtHops(front + 1) - zt, at least 1. */
export function frontNextIn(zt) {
  return Math.max(1, dimAtHops(frontAt(zt) + 1) - zt);
}
/** Nodes the front covers at zone time zt. */
export function dimmedIds(zone, zt) {
  return zone.nodes.filter((n) => dimmedAt(zone, n.id, zt)).map((n) => n.id);
}
/** Can MOVE enter node id's content (rules 1.9.4): unresolved, not the hub, not Dimmed now? */
export const canEnter = (s, id) => {
  const n = s.zone.nodes[id];
  return !n.done && n.ring > 0 && !dimmedNow(s, id);
};

// ---------------- Vision (rules 1.9.5) ----------------
/**
 * Vision kit of a run from the newRun option `vision` ({ guide, charts, pathfinder }; a test and measurement option):
 * radius VISION_RADIUS (+GUIDE_RADIUS_BONUS), regions (Region Charts), typeRadius (Pathfinder), tracker (Tracker's Notes'
 * radius, 0 without). The start camp and meta add to it (contracts.js applySetOut, nodes.js startExpedition; prep).
 */
export function visionKit(opt) {
  const o = opt || {};
  return { radius: VISION_RADIUS + (o.guide ? GUIDE_RADIUS_BONUS : 0), regions: !!o.charts, typeRadius: o.pathfinder ? PATHFINDER_RADIUS : 0, tracker: 0 };
}
/** Full vision radius of the run, capped at VISION_RADIUS_MAX. */
export const visionRadius = (s) => Math.min(VISION_RADIUS_MAX, s.exp.vision.radius);

/** Mark the nodes in view of the player's node as seen (remembered for the rest of the zone). Returns the new ids. */
export function refreshVision(s) {
  const zone = s.zone;
  const d = hops(zone.nodes, zone.pos);
  const r = visionRadius(s);
  const tr = s.exp.vision.typeRadius;
  const fresh = [];
  for (const n of zone.nodes) {
    if (d[n.id] <= r && !zone.seen[n.id]) { zone.seen[n.id] = true; fresh.push(n.id); }
    if (d[n.id] <= tr) zone.typed[n.id] = true;
  }
  return fresh;
}

/** A held or completed Delve contract of this zone shows its dungeon's location (expedition.md 3.3, 5.2; prep). */
const delveHeld = (s) => !!(s.exp.contracts && s.exp.contracts.some((c) => c.kind === 'delve' && c.z === s.zone.z && (c.state === 'held' || c.state === 'complete')));

/** Contract site marks the player sees on node id (expedition.md 5.1, 5.2; prep): held contracts' ids, or null. */
function siteView(s, n, know, d) {
  if (!n.sites || !s.exp.contracts) return null;
  const tr = s.exp.vision.tracker || 0;
  if (know !== 'full' && !(tr > 0 && d <= tr)) return null;
  const held = n.sites.filter((id) => s.exp.contracts.some((c) => c.id === id && c.state === 'held'));
  return held.length ? held : null;
}

/** What the player knows of a node: 'full' (the hub, or seen), 'type' (Pathfinder; the dungeon with Region Charts or a Delve contract), 'none'. */
export function knowledge(s, n) {
  const zone = s.zone;
  if (n.ring === 0 || zone.seen[n.id]) return 'full';
  if (zone.typed[n.id] || ((s.exp.vision.regions || delveHeld(s)) && n.type === 'dungeon')) return 'type';
  return 'none';
}

/**
 * Node details the player sees on a fully visible node (as rules 1.4's map view; rare flags, traps and Embers hidden).
 * An elite shows its level and one archetype entry per enemy, the elite's own as null, and no name (D50, rules 1.9.5):
 * content gives a zone's rares other archetypes than its elites, so the elite's name or archetype would tell a rare.
 */
function details(c, z, n) {
  const arch = (tid) => c.enemies[tid].archetype;
  if (n.type === 'quest') return { title: c.quests[n.quest].title, archetypes: n.mobs.map(arch) };
  if (n.type === 'grind') return { archetypes: n.waves[0].map(arch) };
  if (n.type === 'elite') return { level: n.eliteLevel, archetypes: [null, ...(n.add ? [arch(n.add)] : [])], rare: null, name: null };
  if (n.type === 'dungeon') {
    return { name: zoneContent(c, z).dungeon.name, level: n.trashLevel, bossLevel: n.bossLevel, fights: n.trash.map((f) => f.map(arch)), bossArchetype: arch(n.boss) };
  }
  if (n.type === 'treasure') return { guarded: !!n.guard, trap: null, archetypes: n.guard ? [arch(n.guard)] : [] };
  if (n.type === 'vendor') return { ember: null };
  return {};
}

/** Content name of the Road on node id (rules 1.9.7, D51): zones[i].roads[k] for the zone's Road k, else null. */
export function roadNameOf(s, id) {
  const names = zoneContent(s.content, s.zone.z).roads;
  const k = s.zone.roads ? s.zone.roads.indexOf(id) : -1;
  return k >= 0 && Array.isArray(names) && typeof names[k] === 'string' ? names[k] : null;
}

/** The expedition texts of the content (D51: texts.expedition), each null when missing. */
export function expeditionTexts(c) {
  const g = (c.texts && c.texts.expedition) || {};
  return Object.fromEntries(EXPEDITION_TEXT_IDS.map((id) => [id, typeof g[id] === 'string' ? g[id] : null]));
}

/**
 * The player-visible map of an expedition zone (rules 1.9.5; docs/specs/engine-api.md 10). Every node shows its
 * skeleton (id, ring, angle, neighbours, hops from the player, hub / Road / Shardfall) and the Dimming (dimmed,
 * dimsIn, dimAt); a fully known node adds type, content level, done, lost, region and details; a type-known node its
 * type. Nothing else of a hidden node is read.
 */
export function expMapView(s) {
  const zone = s.zone;
  const c = s.content;
  const z = zone.z;
  const zt = zoneTime(s);
  const regs = zoneRegions(c, z);
  const showRegions = !!s.exp.vision.regions;
  const d = hops(zone.nodes, zone.pos);
  const band = ZONE_LEVELS * (z - 1) + 1;
  const nodes = zone.nodes.map((n) => {
    const know = knowledge(s, n);
    const at = dimAtSeen(s, n.id); // M2b v10: the Dungeon's hold once the player knows it is the Dungeon
    const dimmed = zt >= at;
    const v = {
      id: n.id, ring: n.ring, angle: n.angle, nb: n.nb.slice(), hops: d[n.id], hub: n.ring === 0, road: n.road,
      shardfall: n.shardfall, dimmed, dimsIn: Math.max(0, at - zt), dimAt: at, know,
      region: n.ring > 0 && (know === 'full' || showRegions) ? n.region : null,
    };
    if (know === 'type') v.type = n.type;
    if (know === 'full') Object.assign(v, { type: n.type, cl: n.cl, done: n.done, lost: dimmed && !n.done && n.ring > 0 }, details(c, z, n));
    const sites = siteView(s, n, know, d[n.id]);
    if (sites) v.sites = sites;
    return v;
  });
  const edges = [];
  for (const n of zone.nodes) for (const b of n.nb) if (n.id < b) edges.push([n.id, b]);
  const moves = zone.nodes[zone.pos].nb.map((id) => {
    const v = nodes[id];
    const enter = v.know === 'full' && !v.dimmed && !v.done && !v.hub;
    return { nodeId: id, via: enter ? 'enter' : 'walk', time: enter ? nodeTime(s, v.type) : TIME_WALK, passTime: enter ? TIME_WALK : null, dimmed: v.dimmed };
  });
  const front = zone.dimOff ? -1 : frontAt(zt);
  return {
    mode: 'expedition', z, name: zoneContent(c, z).name, zt, pos: zone.pos, hub: 0, roads: zone.roads.slice(),
    roadNames: zone.roads.map((id) => roadNameOf(s, id)), texts: expeditionTexts(c),
    shardfall: zone.shardfall, onRoad: zone.nodes[zone.pos].road, walkTime: TIME_WALK, travelTime: TIME_TRAVEL,
    bell: { charges: s.exp.bell, channelTime: BELL_CHANNEL_TIME }, ...(s.exp.prep ? { spyglass: s.exp.spyglass } : {}),
    vision: { radius: visionRadius(s), regions: showRegions, typeRadius: s.exp.vision.typeRadius },
    dim: { grace: DIM_GRACE, frontHops: DIM_FRONT_HOPS, frontTime: DIM_FRONT_TIME, front, nextIn: zone.dimOff ? Infinity : frontNextIn(zt), off: !!zone.dimOff },
    regions: regs.map((r, i) => ({ id: i, name: r.name, kind: r.kind, families: r.families.slice() })),
    bands: RING_NODES.map((_, r) => (r === 0 ? [band, band] : [clampCl(band + RING_CL_BASE[r]), clampCl(band + RING_CL_BASE[r] + RING_CL_SPREAD - 1)])),
    edges, moves, nodes,
  };
}
