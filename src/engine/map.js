// Zone map generation and node setup (rules 1.3, 1.4, 2). Streams map(z) and node(z,r,l).
import {
  ZONE_LEVELS, ZONE_CHOICE_ROWS, LANES, DUNGEON_ROW_MIN, DUNGEON_ROW_MAX, REST_ROW_MIN, REST_ROW_MAX, TRAINER_ROW_MIN, TRAINER_ROW_MAX,
  MAX_SAME_TYPE_PER_ROW, NODE_TYPE, NODE_DRAW_ORDER, ROW1_FORBIDDEN, MAP_REDRAW_TRIES, QUEST_LEVEL_OFFSETS,
  ELITE_LEVEL_OFFSET, DUNGEON_LEVEL_OFFSET, DUNGEON_BOSS_LEVEL_OFFSET, RARE_CHANCE, QUEST_SIZE_W1, QUEST_SIZE_W2,
  QUEST_SIZE_W3, QUEST_MAX_SIZE_Z1, GRIND_MAX_WAVES, GRIND_WAVE_SIZE, ELITE_ADD_CHANCE, DUNGEON_TRASH_FIGHTS, DUNGEON_SIZE_W2,
  DUNGEON_SIZE_W3, TREASURE_GUARD_CHANCE, TREASURE_TRAP_CHANCE, VENDOR_GEAR_STOCK, EMBER_STOCK_CHANCE,
  BOON, BOON_IDS, SHRINE_BOON_COUNT, MAX_LEVEL, VENDOR_STOCK_CONSUMABLES, EMBER_V,
} from '../constants.js';
import { STREAM, nextFloat, nextInt, weightedIndex } from '../rng.js';
import { zoneContent } from './content.js';
import { rollGear, consumablePrice, gearPrice, V, priceMult } from './items.js';
import { rnd } from './util.js';

/** Content level of row r in zone z (rules 1.4). Row 0 (hub) = band minimum. */
export function contentLevel(z, r) {
  if (r <= 0) return ZONE_LEVELS * (z - 1) + 1;
  return ZONE_LEVELS * (z - 1) + 1 + Math.floor(((r - 1) * (ZONE_LEVELS - 1)) / (ZONE_CHOICE_ROWS - 1));
}

export const clampCl = (x) => Math.max(1, Math.min(MAX_LEVEL, x));

/** Dungeon trash and boss levels of zone z (rules 1.4). */
export function dungeonLevels(z) {
  const trash = clampCl(ZONE_LEVELS * (z - 1) + 1 + DUNGEON_LEVEL_OFFSET);
  return { trash, boss: clampCl(trash + DUNGEON_BOSS_LEVEL_OFFSET) };
}

/** Map steps 1-3: node types of the ZONE_CHOICE_ROWS × LANES grid (stream map(z)). Returns rows[r-1][l] = type. */
export function generateLayout(seed, z) {
  const rng = STREAM.map(seed, z);
  const grid = [];
  for (let r = 0; r < ZONE_CHOICE_ROWS; r++) grid.push(new Array(LANES).fill(null));
  // 1. Dungeon
  const dRow = DUNGEON_ROW_MIN + nextInt(rng, DUNGEON_ROW_MAX - DUNGEON_ROW_MIN + 1);
  const dLane = nextInt(rng, LANES);
  grid[dRow - 1][dLane] = 'dungeon';
  // 2. Rest guarantee and 2b. Trainer guarantee (M2 v2): row uniform, then lane uniform over the free cells of
  // that row (a row of rows 3-5 always has one: at most the dungeon and the rest are placed before).
  const guarantee = (type, rowMin, rowMax) => {
    const row = rowMin + nextInt(rng, rowMax - rowMin + 1);
    const free = [];
    for (let l = 0; l < LANES; l++) if (!grid[row - 1][l]) free.push(l);
    grid[row - 1][free[nextInt(rng, free.length)]] = type;
  };
  guarantee('rest', REST_ROW_MIN, REST_ROW_MAX);
  guarantee('trainer', TRAINER_ROW_MIN, TRAINER_ROW_MAX);
  // 3. Every other cell, row by row, lane 0..2
  const weights = NODE_DRAW_ORDER.map((t) => NODE_TYPE[t].weight);
  for (let r = 1; r <= ZONE_CHOICE_ROWS; r++) {
    const row = grid[r - 1];
    for (let l = 0; l < LANES; l++) {
      if (row[l]) continue;
      let placed = null;
      for (let tries = 0; tries < MAP_REDRAW_TRIES && !placed; tries++) {
        const t = NODE_DRAW_ORDER[weightedIndex(rng, weights)];
        const same = row.filter((x) => x === t).length;
        if (same >= MAX_SAME_TYPE_PER_ROW) continue;
        if (r === 1 && ROW1_FORBIDDEN.includes(t)) continue;
        placed = t;
      }
      row[l] = placed || 'quest';
    }
  }
  return grid;
}

function pickFrom(rng, list) {
  return list[nextInt(rng, list.length)];
}

/**
 * Map step 4: setup of one node from stream node(z,r,l). Everything a node needs is drawn here, so the map and
 * the node's loot never depend on how fights are played (rules 0, "Consequence").
 */
export function setupNode(s, z, r, l, type) {
  const c = s.content;
  const zn = zoneContent(c, z);
  const rng = STREAM.node(s.seed, z, r, l);
  const cl = contentLevel(z, r);
  const node = { type, r, l, cl, done: false };
  if (type === 'quest') {
    const qid = pickFrom(rng, zn.quests);
    const q = c.quests[qid];
    const w = q.sizeWeights || [QUEST_SIZE_W1, QUEST_SIZE_W2, QUEST_SIZE_W3];
    // Zone 1 cap (rules 2.1, M2 v2): the size draw is unchanged, its result is capped; mobs follow for that size.
    const drawn = 1 + weightedIndex(rng, w);
    const size = z === 1 ? Math.min(QUEST_MAX_SIZE_Z1, drawn) : drawn;
    const pool = q.enemies && q.enemies.length ? q.enemies : zn.normals;
    const mobs = [];
    for (let i = 0; i < size; i++) mobs.push(pickFrom(rng, pool));
    const off = QUEST_LEVEL_OFFSETS[nextInt(rng, QUEST_LEVEL_OFFSETS.length)];
    node.cl = clampCl(cl + off);
    node.quest = qid;
    node.mobs = mobs;
  } else if (type === 'grind') {
    node.waves = [];
    for (let w = 0; w < GRIND_MAX_WAVES; w++) {
      const wave = [];
      for (let i = 0; i < GRIND_WAVE_SIZE; i++) wave.push(pickFrom(rng, zn.normals));
      node.waves.push(wave);
    }
  } else if (type === 'elite') {
    const rare = nextFloat(rng) < RARE_CHANCE;
    node.rare = rare;
    node.elite = pickFrom(rng, rare ? zn.rares : zn.elites);
    node.add = nextFloat(rng) < ELITE_ADD_CHANCE ? pickFrom(rng, zn.normals) : null;
    node.eliteLevel = clampCl(cl + ELITE_LEVEL_OFFSET);
  } else if (type === 'dungeon') {
    const lv = dungeonLevels(z);
    node.trashLevel = lv.trash;
    node.bossLevel = lv.boss;
    node.cl = lv.trash;
    node.trash = [];
    for (let k = 0; k < DUNGEON_TRASH_FIGHTS; k++) {
      const size = 2 + weightedIndex(rng, [DUNGEON_SIZE_W2, DUNGEON_SIZE_W3]);
      const f = [];
      for (let i = 0; i < size; i++) f.push(pickFrom(rng, zn.dungeon.trash));
      node.trash.push(f);
    }
    node.boss = zn.dungeon.boss;
  } else if (type === 'vendor') {
    node.stock = vendorStock(s, rng, cl);
  } else if (type === 'shrine') {
    const ids = BOON_IDS.slice();
    const boons = [];
    for (let i = 0; i < SHRINE_BOON_COUNT; i++) {
      const k = weightedIndex(rng, ids.map((b) => BOON[b].weight));
      boons.push(ids[k]);
      ids.splice(k, 1);
    }
    node.boons = boons;
  } else if (type === 'treasure') {
    node.guard = nextFloat(rng) < TREASURE_GUARD_CHANCE ? pickFrom(rng, zn.normals) : null;
    // The trap is the first draw of loot(z,r,l) (rules 2.8); computed here only so Scout's Eye can show it.
    node.trap = nextFloat(STREAM.loot(s.seed, z, r, l)) < TREASURE_TRAP_CHANCE;
  }
  return node;
}

/**
 * Vendor stock (rules 2.6): consumables (unlimited), VENDOR_GEAR_STOCK gear items, Ember at EMBER_STOCK_CHANCE.
 * Hub, map and Camp vendors use the same rule (M2 v5: the Camp no longer sells the Starforged weapon, D45).
 */
export function vendorStock(s, rng, cl) {
  const stock = [];
  const cons = VENDOR_STOCK_CONSUMABLES.slice();
  if (s.meta.alchemist) cons.push('greater_healing_draught');
  for (const id of cons) stock.push({ kind: 'cons', id, price: consumablePrice(s, id, cl), unlimited: true });
  for (let i = 0; i < VENDOR_GEAR_STOCK; i++) {
    const item = rollGear(s, rng, 'vendor', cl);
    stock.push({ kind: 'gear', item, price: gearPrice(s, item), sold: false });
  }
  if (nextFloat(rng) < EMBER_STOCK_CHANCE) {
    stock.push({ kind: 'cons', id: 'ember_of_return', price: rnd(EMBER_V * V(cl) * priceMult(s)), sold: false });
  }
  return stock;
}

/** Whole zone: types from map(z), then each node's setup from node(z,r,l), row by row, lane 0..2. */
export function generateZone(s, z) {
  const layout = generateLayout(s.seed, z);
  const rows = layout.map((row, ri) => row.map((type, l) => setupNode(s, z, ri + 1, l, type)));
  return { z, rows, pos: { r: 0, l: null }, questsDone: 0, storyDone: false, path: [] };
}

/** Legal lanes for the next node (rules 1.4 movement). Empty after the last row (ZONE_CHOICE_ROWS). */
export function nextLanes(zone) {
  const { r, l } = zone.pos;
  if (r >= ZONE_CHOICE_ROWS) return [];
  if (r === 0) return [0, 1, 2].filter((x) => x < LANES);
  const out = [];
  for (let d = -1; d <= 1; d++) if (l + d >= 0 && l + d < LANES) out.push(l + d);
  return out;
}
