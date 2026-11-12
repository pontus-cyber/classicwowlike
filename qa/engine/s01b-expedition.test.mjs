// rules.md 1.9 (expedition): the roamable zone map behind newRun({ mapMode: 'expedition' }): graph generation and node
// setup by region, moves, vision and the player-visible map view (with leak tests), the Dimming, Roads and the Homeward
// Bell, the expedition pacing values, determinism and full autoplay runs. The rows map (rules 1.4) is tested in s00-s01.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, tweak, atLevel, autoUntil, ev, STREAM, nextFloat, forceDraws } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { nextInt, weightedIndex } from '../../src/rng.js';
import { dungeonLevels, validEncounter, composeEncounter } from '../../src/engine/map.js';
import {
  generateExpZone, setupExpNode, zoneRegions, hops, frontAt, dimAt, dimAtHops, zoneTime, RING_START, NODE_COUNT, xpWeight,
  nodeTime, grindMaxWaves,
} from '../../src/engine/expedition.js';

const [, N1, N2, N3] = C.RING_NODES;
const band = (z) => C.ZONE_LEVELS * (z - 1) + 1;
const norm = (a) => ((a % 360) + 360) % 360;
const angDist = (a, b) => Math.min(norm(a - b), 360 - norm(a - b));

/**
 * A started expedition run (phase ZONE_HUB of zone 1). The start camp is newRun's default on the expedition map (D116):
 * START_RUN opens it and SET_OUT, with nothing bought, enters zone 1 (expedition.md 2; the camp is tested in s01d).
 */
function expRun(classId = 'mage', opts = {}) {
  const s = R.newRun({
    classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed: opts.seed ?? 1, content: opts.content || CONTENT,
    profile: opts.profile || null, mapMode: 'expedition', vision: opts.vision || null,
  });
  return R.step(R.step(s, { type: 'START_RUN' }).state, { type: 'SET_OUT' }).state;
}
const onMap = (s) => R.step(s, { type: 'LEAVE_HUB' }).state;
const timeOf = (events) => ev(events, 'time').reduce((n, e) => n + e.add, 0);
const ringOf = (id) => (id === 0 ? 0 : id < RING_START[2] ? 1 : id < RING_START[3] ? 2 : 3);
/** Zone z of a seed as the engine generates it on entry. */
const zoneOf = (seed, z, content = CONTENT) => generateExpZone(expRun('mage', { seed, content }), z);

/** Shortest path (node ids, both ends included) on the zone graph. */
function pathTo(zone, from, to) {
  const prev = new Array(zone.nodes.length).fill(-2);
  prev[from] = -1;
  const q = [from];
  for (let i = 0; i < q.length; i++) for (const v of zone.nodes[q[i]].nb) if (prev[v] === -2) { prev[v] = q[i]; q.push(v); }
  const p = [];
  for (let x = to; x !== -1; x = prev[x]) p.unshift(x);
  return p;
}
/** Step along a path: through unresolved nodes with PASS_THROUGH, else MOVE. Returns { state, events }. */
function walk(s, path) {
  const events = [];
  for (const id of path.slice(1)) {
    const a = R.isLegal(s, { type: 'PASS_THROUGH', nodeId: id }) ? { type: 'PASS_THROUGH', nodeId: id } : { type: 'MOVE', nodeId: id };
    const r = R.step(s, a);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
/** Put node id's content to `type` (fresh setup on its own stream), adjacent to where the player stands. */
function makeType(x, id, type, patch = null) {
  const n = x.zone.nodes[id];
  for (const k of ['quest', 'mobs', 'waves', 'rare', 'elite', 'add', 'eliteLevel', 'trashLevel', 'bossLevel', 'trash', 'boss', 'stock', 'boons', 'guard', 'trap']) delete n[k];
  n.type = type;
  setupExpNode(x, x.zone.z, n, zoneRegions(x.content, x.zone.z));
  if (patch) patch(n);
}
/** Zone time set to zt (the front follows), without spending an action. */
const atZoneTime = (x, zt) => { x.time = x.zone.start + zt; };

// Independent replay of rules 1.9.2's draw order on stream map(z) (fixture content: default regions).
function replay(seed, z) {
  const g = STREAM.map(seed, z);
  const a1 = nextFloat(g) * (360 / N1);
  const a2 = nextFloat(g) * (360 / N2);
  const k1 = Array.from({ length: N1 }, () => nextFloat(g) < C.EDGE_KEEP_R1);
  const k2 = Array.from({ length: N2 }, () => nextFloat(g) < C.EDGE_KEEP_R2);
  const dg = Array.from({ length: N3 }, () => nextFloat(g) < C.EDGE_DIAG_R23);
  const k3 = Array.from({ length: N3 }, () => nextFloat(g) < C.EDGE_KEEP_R3);
  const offset = nextFloat(g) * (360 / C.REGION_COUNT);
  const order = Array.from({ length: C.REGION_COUNT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = nextInt(g, i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const start = nextInt(g, N3);
  const pair = nextInt(g, C.ROAD_COUNT);
  const roads = Array.from({ length: C.ROAD_COUNT }, (_, k) => RING_START[3] + ((start + Math.round((k * N3) / C.ROAD_COUNT)) % N3));
  const shardfall = RING_START[3] + ((start + Math.round((pair * N3) / C.ROAD_COUNT) + Math.round(N3 / C.ROAD_COUNT / 2)) % N3);
  const angle = (id) => {
    const r = ringOf(id);
    const i = id - RING_START[r];
    return r === 0 ? 0 : r === 1 ? norm(a1 + (360 / N1) * i) : r === 2 ? norm(a2 + (360 / N2) * i) : norm(a2 + (360 / N3) * (i + 0.5));
  };
  const region = (id) => (id === 0 ? null : order[Math.floor(norm(angle(id) - offset) / (360 / C.REGION_COUNT))]);
  const type = new Array(NODE_COUNT).fill(null);
  type[0] = 'hub';
  const ids = [...Array(NODE_COUNT).keys()];
  const pickOf = (list) => list[nextInt(g, list.length)];
  type[pickOf(ids.filter((i) => ringOf(i) >= 2 && !roads.includes(i) && i !== shardfall))] = 'dungeon';
  type[pickOf(ids.filter((i) => (ringOf(i) === 1 || ringOf(i) === 2) && !type[i]))] = 'rest';
  type[pickOf(ids.filter((i) => ringOf(i) === 2 && !type[i]))] = 'trainer';
  type[shardfall] = 'treasure';
  for (const i of ids) {
    if (type[i]) continue;
    const w = C.REGION_W[C.REGION_KINDS[region(i)]];
    type[i] = C.NODE_DRAW_ORDER[weightedIndex(g, C.NODE_DRAW_ORDER.map((t) => (ringOf(i) === 1 && C.RING1_FORBIDDEN.includes(t) ? 0 : w[t])))];
  }
  // Expected edges.
  const E = new Set();
  const add = (a, b) => E.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  for (let i = 0; i < N1; i++) add(0, RING_START[1] + i);
  for (let i = 0; i < N1; i++) if (k1[i]) add(RING_START[1] + i, RING_START[1] + ((i + 1) % N1));
  for (let j = 0; j < N2; j++) {
    let best = 0;
    for (let i = 1; i < N1; i++) if (angDist(angle(RING_START[2] + j), angle(RING_START[1] + i)) < angDist(angle(RING_START[2] + j), angle(RING_START[1] + best))) best = i;
    add(RING_START[2] + j, RING_START[1] + best);
  }
  for (let j = 0; j < N2; j++) if (k2[j]) add(RING_START[2] + j, RING_START[2] + ((j + 1) % N2));
  for (let j = 0; j < N3; j++) {
    add(RING_START[3] + j, RING_START[2] + j);
    if (dg[j]) add(RING_START[3] + j, RING_START[2] + ((j + 1) % N2));
  }
  for (let j = 0; j < N3; j++) if (k3[j]) add(RING_START[3] + j, RING_START[3] + ((j + 1) % N3));
  return { a1, a2, angle, region, roads, shardfall, type, edges: E };
}

describe('rules 1.9 expedition map: generation (1.9.2, 1.9.3)', () => {
  test('1.9.2 graph: the hub and rings of RING_NODES nodes, ids ring by ring in angle order, angles from a1 and a2', () => {
    assert.equal(C.RING_NODES[3], C.RING_NODES[2], 'ring 3 sits half a step after ring 2 (equal counts)');
    for (let seed = 1; seed <= 30; seed++) for (let z = 1; z <= C.ZONE_COUNT; z++) {
      const zone = zoneOf(seed, z);
      assert.equal(zone.nodes.length, C.RING_NODES.reduce((a, b) => a + b, 0));
      zone.nodes.forEach((n, i) => { assert.equal(n.id, i); assert.equal(n.ring, ringOf(i)); });
      assert.equal(zone.nodes[0].type, 'hub');
      const ang = (r, i) => zone.nodes[RING_START[r] + i].angle;
      assert.ok(ang(1, 0) < 360 / N1 + 1e-6 && ang(2, 0) < 360 / N2 + 1e-6, 'a1 and a2 within one step');
      for (let i = 1; i < N1; i++) assert.ok(Math.abs(norm(ang(1, i) - ang(1, i - 1)) - 360 / N1) < 1e-5);
      for (let j = 1; j < N2; j++) assert.ok(Math.abs(norm(ang(2, j) - ang(2, j - 1)) - 360 / N2) < 1e-5);
      for (let j = 0; j < N3; j++) assert.ok(Math.abs(norm(ang(3, j) - ang(2, j)) - 180 / N2) < 1e-5, 'ring 3 node j: ring 2 node j + half a step');
    }
  });

  test('1.9.2 draw order on map(z): angles, edges, regions, Roads and the Shardfall, node types replay exactly', () => {
    for (let seed = 1; seed <= 40; seed++) for (const z of [1, 4, 6]) {
      const zone = zoneOf(seed, z);
      const want = replay(seed, z);
      for (const n of zone.nodes) {
        assert.ok(Math.abs(angDist(n.angle, want.angle(n.id))) < 1e-5, `angle ${n.id}`);
        assert.equal(n.region, want.region(n.id), `region of ${n.id} (seed ${seed}, z ${z})`);
        assert.equal(n.type, want.type[n.id], `type of ${n.id} (seed ${seed}, z ${z})`);
      }
      const got = new Set();
      for (const n of zone.nodes) for (const b of n.nb) got.add(n.id < b ? `${n.id}-${b}` : `${b}-${n.id}`);
      assert.deepEqual([...got].sort(), [...want.edges].sort(), `edges (seed ${seed}, z ${z})`);
      assert.deepEqual(zone.roads, want.roads);
      assert.equal(zone.shardfall, want.shardfall);
    }
  });

  test('1.9.2 edges: the spokes connect every node; neighbour links at EDGE_KEEP_R1/R2/R3, diagonals at EDGE_DIAG_R23', () => {
    const cnt = { r1: 0, r2: 0, r3: 0, dg: 0, zones: 0 };
    for (let seed = 1; seed <= 300; seed++) {
      const zone = zoneOf(seed, 1 + (seed % C.ZONE_COUNT));
      cnt.zones += 1;
      assert.ok(hops(zone.nodes, 0).every((d) => Number.isFinite(d)), 'every node reachable from the hub');
      for (const n of zone.nodes) {
        for (const b of n.nb) {
          assert.ok(zone.nodes[b].nb.includes(n.id), 'edges are undirected');
          assert.ok(Math.abs(ringOf(b) - n.ring) <= 1, 'edges join the same or neighbouring rings');
          if (n.ring === 0) continue;
          if (ringOf(b) === n.ring && n.id < b) cnt[`r${n.ring}`] += 1;
          if (n.ring === 3 && ringOf(b) === 2 && b !== RING_START[2] + (n.id - RING_START[3])) cnt.dg += 1;
        }
      }
      for (let i = 0; i < N1; i++) assert.ok(zone.nodes[0].nb.includes(RING_START[1] + i), 'hub spoke');
      for (let j = 0; j < N3; j++) assert.ok(zone.nodes[RING_START[3] + j].nb.includes(RING_START[2] + j), 'ring 3 spoke');
      for (let j = 0; j < N2; j++) assert.ok(zone.nodes[RING_START[2] + j].nb.some((b) => ringOf(b) === 1), 'ring 2 spoke');
    }
    const near = (got, p, n) => Math.abs(got / n - p) < 0.035;
    assert.ok(near(cnt.r1, C.EDGE_KEEP_R1, cnt.zones * N1), `ring 1 ${cnt.r1 / (cnt.zones * N1)}`);
    assert.ok(near(cnt.r2, C.EDGE_KEEP_R2, cnt.zones * N2), `ring 2 ${cnt.r2 / (cnt.zones * N2)}`);
    assert.ok(near(cnt.r3, C.EDGE_KEEP_R3, cnt.zones * N3), `ring 3 ${cnt.r3 / (cnt.zones * N3)}`);
    assert.ok(near(cnt.dg, C.EDGE_DIAG_R23, cnt.zones * N3), `diagonal ${cnt.dg / (cnt.zones * N3)}`);
  });

  test('1.9.2 regions: REGION_COUNT wedges of equal angle, each region on one wedge; default regions without content regions', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const zone = zoneOf(seed, 1 + (seed % C.ZONE_COUNT));
      assert.equal(zone.nodes[0].region, null, 'the hub has no region');
      const outer = zone.nodes.filter((n) => n.ring > 0).sort((a, b) => a.angle - b.angle);
      // Around the circle the region changes exactly REGION_COUNT times: each region is one arc of < 360 / REGION_COUNT.
      let changes = 0;
      for (let i = 0; i < outer.length; i++) if (outer[i].region !== outer[(i + 1) % outer.length].region) changes += 1;
      assert.equal(changes, C.REGION_COUNT, `seed ${seed}`);
      for (let r = 0; r < C.REGION_COUNT; r++) {
        const a = outer.filter((n) => n.region === r).map((n) => n.angle);
        assert.ok(a.length > 0);
        const spread = Math.max(...a.map((x) => Math.max(...a.map((y) => angDist(x, y)))));
        assert.ok(spread < 360 / C.REGION_COUNT, `region ${r} spans ${spread}`);
      }
    }
    assert.deepEqual(zoneRegions(CONTENT, 1).map((r) => r.kind), C.REGION_KINDS.slice(0, C.REGION_COUNT));
    assert.ok(zoneRegions(CONTENT, 1).every((r) => r.name === null && r.families.length === 0));
  });

  test('1.9.2 landmarks: ROAD_COUNT Roads evenly spaced on ring 3, the Shardfall halfway between a uniform pair, a Treasure', () => {
    const pairs = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const zone = zoneOf(seed, 2);
      assert.equal(zone.roads.length, C.ROAD_COUNT);
      const idx = zone.roads.map((r) => r - RING_START[3]).sort((a, b) => a - b);
      for (let k = 0; k < idx.length; k++) assert.equal((idx[(k + 1) % idx.length] - idx[k] + N3) % N3, N3 / C.ROAD_COUNT);
      assert.ok(zone.roads.every((r) => zone.nodes[r].road && zone.nodes[r].ring === 3));
      assert.equal(zone.nodes.filter((n) => n.road).length, C.ROAD_COUNT);
      const sf = zone.shardfall;
      assert.ok(zone.nodes[sf].shardfall && zone.nodes[sf].ring === 3 && !zone.nodes[sf].road);
      assert.equal(zone.nodes[sf].type, 'treasure');
      const k = zone.roads.findIndex((r) => (sf - RING_START[3] - (r - RING_START[3]) + N3) % N3 === N3 / C.ROAD_COUNT / 2);
      assert.ok(k >= 0, 'halfway after one Road');
      pairs.add(k);
      assert.equal(zone.shardDist[sf], 0);
      assert.deepEqual(zone.shardDist, hops(zone.nodes, sf));
    }
    assert.equal(pairs.size, C.ROAD_COUNT, 'every pair is drawn');
  });

  test('1.9.2 node types: one Dungeon on ring 2 or 3 (no Road or Shardfall), a Rest on ring 1-2, a Trainer on ring 2, no Elite, Vendor or Trainer in ring 1', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const zone = zoneOf(seed, 1 + (seed % C.ZONE_COUNT));
      const of = (t) => zone.nodes.filter((n) => n.type === t);
      assert.equal(of('dungeon').length, 1);
      const d = of('dungeon')[0];
      assert.ok(d.ring >= 2 && !d.road && !d.shardfall);
      assert.ok(of('rest').some((n) => n.ring === 1 || n.ring === 2));
      assert.ok(of('trainer').some((n) => n.ring === 2));
      assert.ok(zone.nodes.filter((n) => n.ring === 1).every((n) => !C.RING1_FORBIDDEN.includes(n.type)));
      assert.equal(of('hub').length, 1);
    }
  });

  test('1.9.3 content level: band minimum + RING_CL_BASE[ring] + u (first draw of nodeId(z, id)); quest offsets, elite + ELITE_LEVEL_OFFSET, dungeon as 1.4', () => {
    for (let seed = 1; seed <= 25; seed++) for (let z = 1; z <= C.ZONE_COUNT; z++) {
      const zone = zoneOf(seed, z);
      assert.equal(zone.nodes[0].cl, band(z));
      for (const n of zone.nodes.filter((x) => x.ring > 0)) {
        const u = nextInt(STREAM.nodeId(seed, z, n.id), C.RING_CL_SPREAD);
        const cl = Math.min(C.MAX_LEVEL, band(z) + C.RING_CL_BASE[n.ring] + u);
        if (n.type === 'dungeon') { assert.equal(n.cl, dungeonLevels(z).trash); assert.equal(n.bossLevel, dungeonLevels(z).boss); continue; }
        if (n.type === 'quest') { assert.ok(C.QUEST_LEVEL_OFFSETS.includes(n.cl - cl) || n.cl === C.MAX_LEVEL || n.cl === 1, `quest ${n.cl} vs ${cl}`); continue; }
        assert.equal(n.cl, cl, `${n.type} ${n.id}`);
        if (n.type === 'elite') assert.equal(n.eliteLevel, Math.min(C.MAX_LEVEL, cl + C.ELITE_LEVEL_OFFSET));
      }
    }
    // Zone 1: ring 1 levels 2-4, ring 2 5-7, ring 3 8-10 (expedition.md 4.2).
    const z1 = zoneOf(3, 1).nodes.filter((n) => n.type !== 'quest' && n.type !== 'dungeon' && n.ring > 0);
    for (const n of z1) assert.ok(n.cl >= [0, 2, 5, 8][n.ring] && n.cl <= [0, 4, 7, 10][n.ring], `ring ${n.ring}: ${n.cl}`);
  });

  test('1.9.3 node setup: EXPED_GRIND_MAX_WAVES wave, EXPED_DUNGEON_TRASH_FIGHTS trash fights, valid encounters (7.14), trap = first draw of loot(z, id)', () => {
    let seen = { grind: 0, dungeon: 0, treasure: 0, elite: 0, vendor: 0, shrine: 0 };
    for (let seed = 1; seed <= 40; seed++) for (const content of [CONTENT, REAL]) {
      const z = 1 + (seed % C.ZONE_COUNT);
      const zone = zoneOf(seed, z, content);
      for (const n of zone.nodes) {
        if (n.type === 'grind') { seen.grind++; assert.equal(n.waves.length, C.EXPED_GRIND_MAX_WAVES); for (const w of n.waves) { assert.equal(w.length, C.GRIND_WAVE_SIZE); assert.ok(validEncounter(content, w)); } }
        if (n.type === 'dungeon') { seen.dungeon++; assert.equal(n.trash.length, C.EXPED_DUNGEON_TRASH_FIGHTS); for (const f of n.trash) assert.ok(validEncounter(content, f)); }
        if (n.type === 'quest') assert.ok(validEncounter(content, n.mobs) && n.mobs.length >= 1 && n.mobs.length <= (z === 1 ? C.QUEST_MAX_SIZE_Z1 : 3));
        if (n.type === 'treasure') { seen.treasure++; assert.equal(n.trap, nextFloat(STREAM.lootId(seed, z, n.id)) < C.TREASURE_TRAP_CHANCE); }
        if (n.type === 'elite') { seen.elite++; assert.ok((n.rare ? content.zones[z - 1].rares : content.zones[z - 1].elites).includes(n.elite)); }
        if (n.type === 'vendor') { seen.vendor++; assert.ok(n.stock.length >= C.VENDOR_STOCK_CONSUMABLES.length + C.VENDOR_GEAR_STOCK); }
        if (n.type === 'shrine') { seen.shrine++; assert.equal(new Set(n.boons).size, C.SHRINE_BOON_COUNT); }
      }
    }
    assert.ok(Object.values(seen).every((x) => x > 0), JSON.stringify(seen));
  });

  test('1.9.3 regions from content: names and kinds on the wedges; REGION_FAMILY_SHARE of template picks from the region\'s families', () => {
    // Fixture variant: zone 1 has four regions, each with one family; two of its six normals carry each region's family.
    const content = JSON.parse(JSON.stringify(CONTENT));
    const z1 = content.zones[0];
    const fams = ['fa', 'fb', 'fc', 'fd'];
    z1.regions = fams.map((f, i) => ({ id: `r${i}`, name: `Region ${i}`, kind: C.REGION_KINDS[i], families: [f] }));
    z1.normals.forEach((t, i) => { content.enemies[t].family = fams[i % 4]; });
    assert.deepEqual(R.validateContent(content), []);
    assert.deepEqual(zoneRegions(content, 1).map((r) => [r.name, r.kind]), fams.map((_, i) => [`Region ${i}`, C.REGION_KINDS[i]]));
    let inFam = 0;
    let picks = 0;
    let listShare = 0;
    for (let seed = 1; seed <= 250; seed++) {
      const zone = zoneOf(seed, 1, content);
      for (const n of zone.nodes) {
        if (n.type !== 'grind' && !(n.type === 'treasure' && n.guard)) continue;
        // The first pick of a wave (the composition repair, 7.14, only redraws the last enemy) and a treasure guard.
        const t = n.type === 'grind' ? n.waves[0][0] : n.guard;
        const fam = fams[n.region];
        picks++;
        listShare += z1.normals.filter((x) => content.enemies[x].family === fam).length / z1.normals.length;
        if (content.enemies[t].family === fam) inFam++;
      }
    }
    // In-family with REGION_FAMILY_SHARE, else from the whole list (which holds some of the family too).
    const want = C.REGION_FAMILY_SHARE + (1 - C.REGION_FAMILY_SHARE) * (listShare / picks);
    assert.ok(picks > 300 && Math.abs(inFam / picks - want) < 0.06, `in-family ${inFam / picks} of ${picks}, expected about ${want}`);
    // Without families (fixture and real content today) the picks come from the whole list.
    const bad = JSON.parse(JSON.stringify(content));
    bad.zones[0].regions[0].kind = 'swamp';
    assert.ok(R.validateContent(bad).some((e) => /regions\[0\]\.kind/.test(e)));
  });

  test('1.9.2 determinism: the same seed gives the same zone; a zone does not depend on how earlier zones were played', () => {
    const strip = (zone) => JSON.stringify(zone.nodes.map((n) => ({ ...n, done: false, stock: n.stock ? n.stock.map((x) => x.kind + (x.id || x.item.slot + x.item.rarity + x.item.ilvl)) : null })));
    for (let seed = 1; seed <= 10; seed++) assert.equal(strip(zoneOf(seed, 3)), strip(zoneOf(seed, 3)));
    assert.notEqual(strip(zoneOf(1, 3)), strip(zoneOf(2, 3)));
    // Two different ways through zone 1 (pass straight to a Road; resolve nodes on autoplay) give the same zone 2.
    const base = expRun('hunter', { seed: 11 });
    const quick = (() => {
      let s = onMap(base);
      s = walk(s, pathTo(s.zone, 0, s.zone.roads[0])).state;
      return R.step(s, { type: 'TAKE_ROAD' }).state;
    })();
    const slow = autoUntil(base, (s) => s.zone && s.zone.z === 2);
    assert.equal(quick.zone.z, 2);
    assert.equal(slow.zone.z, 2);
    assert.ok(slow.stats.nodesTotal > quick.stats.nodesTotal, 'a different way through zone 1');
    assert.equal(strip(quick.zone), strip(slow.zone));
  });
});

describe('rules 1.9 expedition map: moving, the hub and the actions (1.9.1, 1.9.4)', () => {
  test('1.9.1 a run is created on the expedition map with the start camp unless mapMode is rows (D116); bad options throw', () => {
    const rows = R.step(R.newRun({ classId: 'mage', seed: 1, content: CONTENT, mapMode: 'rows' }), { type: 'START_RUN' }).state;
    assert.equal(rows.mapMode, 'rows');
    assert.ok(rows.zone.rows && !rows.exp);
    const d = R.newRun({ classId: 'mage', seed: 1, content: CONTENT });
    assert.deepEqual([d.mapMode, d.create.prep], ['expedition', true], 'the default: the expedition map with the start camp');
    assert.equal(R.step(d, { type: 'START_RUN' }).state.phase, 'PREP');
    const s = expRun();
    assert.equal(s.mapMode, 'expedition');
    assert.equal(s.zone.mode, 'expedition');
    assert.equal(s.phase, 'ZONE_HUB');
    assert.equal(s.zone.pos, 0);
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, mapMode: 'hex' }), /mapMode/);
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, mapMode: 'rows', vision: { guide: true } }), /expedition option/);
    assert.throws(() => R.newRun({ classId: 'mage', content: CONTENT, mapMode: 'expedition', vision: { eagle: true } }), /expedition option/);
  });

  test('1.9.1 CHOOSE_NODE and TRAVEL_ON are not legal; legalActions lists MOVE and PASS_THROUGH per neighbour, RING_BELL, TAKE_ROAD on a Road; every listed action is legal', () => {
    const s = onMap(expRun('rogue', { seed: 5 }));
    assert.match(R.whyIllegal(s, { type: 'CHOOSE_NODE', lane: 0 }), /expedition map/);
    assert.match(R.whyIllegal(s, { type: 'TRAVEL_ON' }), /TAKE_ROAD/);
    assert.equal(R.travelLevel(s), null, 'no level gate');
    const legal = R.legalActions(s);
    for (const a of legal) assert.ok(R.isLegal(s, a), JSON.stringify(a));
    const nb = s.zone.nodes[0].nb;
    assert.deepEqual(legal.filter((a) => a.type === 'MOVE').map((a) => a.nodeId), nb);
    assert.deepEqual(legal.filter((a) => a.type === 'PASS_THROUGH').map((a) => a.nodeId), nb);
    assert.ok(legal.some((a) => a.type === 'RING_BELL'));
    assert.ok(!legal.some((a) => a.type === 'TAKE_ROAD'), 'the hub is not a Road');
    const far = s.zone.nodes.find((n) => n.ring === 3).id;
    assert.match(R.whyIllegal(s, { type: 'MOVE', nodeId: far }), /not next to/);
    assert.match(R.whyIllegal(s, { type: 'MOVE', nodeId: 99 }), /no node/);
    assert.match(R.whyIllegal(s, { type: 'TAKE_ROAD' }), /Road/);
    // Rows-map actions of an expedition run, and expedition actions of a rows run.
    const rows = R.step(R.step(R.newRun({ classId: 'mage', seed: 1, content: CONTENT, mapMode: 'rows' }), { type: 'START_RUN' }).state, { type: 'LEAVE_HUB' }).state;
    assert.match(R.whyIllegal(rows, { type: 'MOVE', nodeId: 1 }), /expedition-map action/);
    assert.ok(!R.legalActions(rows).some((a) => ['MOVE', 'PASS_THROUGH', 'TAKE_ROAD', 'RING_BELL'].includes(a.type)));
  });

  test('1.9.4 MOVE enters an unresolved node (its content and tolls); a resolved node or the hub is a walk of TIME_WALK; the way back is legal', () => {
    let s = onMap(expRun('mage', { seed: 3 }));
    const id = s.zone.nodes[0].nb[0];
    s = tweak(s, (x) => makeType(x, id, 'rest'));
    s = tweak(s, (x) => { x.player.hp = 5; });
    let r = R.step(s, { type: 'MOVE', nodeId: id });
    assert.deepEqual(ev(r.events, 'move')[0], { t: 'move', from: 0, to: id, via: 'enter', seen: ev(r.events, 'move')[0].seen });
    assert.equal(timeOf(r.events), C.TIME_REST);
    assert.equal(ev(r.events, 'node')[0].id, id);
    assert.equal(r.state.player.hp, r.state.player.d.maxHp);
    assert.equal(r.state.zone.nodes[id].done, true);
    assert.equal(r.state.zone.pos, id);
    assert.equal(r.state.phase, 'MAP');
    // Back to the hub (a walk, and a new hub visit), then into the resolved node again (a walk, no rest).
    r = R.step(r.state, { type: 'MOVE', nodeId: 0 });
    assert.equal(timeOf(r.events), C.TIME_WALK);
    assert.equal(ev(r.events, 'move')[0].via, 'walk');
    assert.equal(r.state.phase, 'ZONE_HUB');
    r = R.step(R.step(r.state, { type: 'LEAVE_HUB' }).state, { type: 'MOVE', nodeId: id });
    assert.equal(timeOf(r.events), C.TIME_WALK);
    assert.equal(ev(r.events, 'rest').length, 0, 'a node is resolved at most once');
    assert.equal(r.state.stats.exp.walks, 2);
    assert.equal(r.state.stats.nodesTotal, 1);
  });

  test('1.9.4 PASS_THROUGH: TIME_WALK, the node stays unresolved and can be entered later; not for a resolved node or the hub', () => {
    let s = onMap(expRun('hunter', { seed: 4 }));
    const id = s.zone.nodes[0].nb[1];
    s = tweak(s, (x) => makeType(x, id, 'shrine'));
    let r = R.step(s, { type: 'PASS_THROUGH', nodeId: id });
    assert.equal(timeOf(r.events), C.TIME_WALK);
    assert.equal(ev(r.events, 'move')[0].via, 'pass');
    assert.equal(r.state.zone.nodes[id].done, false);
    assert.equal(r.state.phase, 'MAP');
    assert.equal(r.state.stats.exp.passes, 1);
    assert.equal(r.state.stats.nodesTotal, 0);
    assert.match(R.whyIllegal(r.state, { type: 'PASS_THROUGH', nodeId: 0 }), /MOVE walks there/);
    // Come back later: hub, then enter it.
    r = R.step(R.step(R.step(r.state, { type: 'MOVE', nodeId: 0 }).state, { type: 'LEAVE_HUB' }).state, { type: 'MOVE', nodeId: id });
    assert.equal(r.state.phase, 'NODE');
    assert.equal(r.state.node.type, 'shrine');
    r = R.step(r.state, { type: 'CHOOSE_REWARD', index: 0 });
    assert.equal(r.state.zone.nodes[id].done, true);
    assert.match(R.whyIllegal(r.state, { type: 'PASS_THROUGH', nodeId: id === 0 ? 1 : 0 }), /MOVE walks there|not next to/);
  });

  test('1.9.4 a fled fight resolves its node; fights use fight(z, id, k) and loot(z, id)', () => {
    let s = onMap(atLevel(expRun('mage', { seed: 6 }), 20));
    const id = s.zone.nodes[0].nb[0];
    s = tweak(s, (x) => makeType(x, id, 'quest'));
    s = R.step(s, { type: 'MOVE', nodeId: id }).state;
    assert.ok(s.fight);
    // The fight's generator is fight(z, id, 0) advanced by the draws of the fight start; loot(z, id) is untouched yet.
    const g = STREAM.fightId(s.seed, 1, id, 0);
    let same = false;
    for (let i = 0; i < 200 && !same; i++) { same = JSON.stringify(g) === JSON.stringify(s.fight.rng); nextFloat(g); }
    assert.ok(same, 'fight(z, id, 0) drives the first fight');
    assert.deepEqual(s.lootRng, STREAM.lootId(s.seed, 1, id));
    // FLEE succeeds on a forced low draw (rules 7.8): the node is resolved, the player back on the map on it.
    s = tweak(s, (x) => forceDraws(x, 1, (d) => d[0] < 0.01));
    const r = R.step(s, { type: 'FLEE' });
    assert.equal(ev(r.events, 'fled').length, 1);
    assert.equal(r.state.phase, 'MAP');
    assert.equal(r.state.zone.nodes[id].done, true);
    assert.equal(r.state.zone.pos, id);
    assert.equal(ev(R.step(r.state, { type: 'MOVE', nodeId: 0 }).events, 'move')[0].via, 'walk');
  });

  test('1.9.4 the hub: services on every visit, once per visit; the hub vendor keeps what was sold', () => {
    let s = tweak(expRun('rogue', { seed: 8 }), (x) => { x.player.gold = 1e7; });
    s = R.step(s, { type: 'SERVICE', service: 'vendor' }).state;
    const gear = s.service.stock.findIndex((e) => e.kind === 'gear');
    const uid = s.service.stock[gear].item.uid;
    s = R.step(s, { type: 'BUY', index: gear }).state;
    s = R.step(s, { type: 'LEAVE' }).state;
    assert.ok(!R.isLegal(s, { type: 'SERVICE', service: 'vendor' }), 'once per visit');
    const out = s.zone.nodes[0].nb[0];
    s = R.step(R.step(onMap(s), { type: 'PASS_THROUGH', nodeId: out }).state, { type: 'MOVE', nodeId: 0 }).state;
    assert.equal(s.phase, 'ZONE_HUB');
    assert.deepEqual(s.hub.used, { trainer: false, vendor: false, inn: false });
    s = R.step(s, { type: 'SERVICE', service: 'vendor' }).state;
    assert.equal(s.service.stock[gear].item.uid, uid, 'same stock');
    assert.equal(s.service.stock[gear].sold, true, 'what was sold stays sold');
    assert.equal(s.stats.vendorVisits, 2);
  });
});

describe('rules 1.9 expedition map: vision and the map view (1.9.5)', () => {
  test('1.9.5 vision: the hub and its neighbours at entry; new neighbours after a step; seen nodes stay seen', () => {
    let s = onMap(expRun('mage', { seed: 12 }));
    const z = s.zone;
    const seen = (x) => x.zone.seen.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(seen(s), [0, ...z.nodes[0].nb].sort((a, b) => a - b));
    const a = z.nodes[0].nb[0];
    const r = R.step(s, { type: 'PASS_THROUGH', nodeId: a });
    const now = seen(r.state);
    for (const id of [0, ...z.nodes[0].nb, ...z.nodes[a].nb]) assert.ok(now.includes(id), `node ${id}`);
    assert.equal(now.length, new Set([0, ...z.nodes[0].nb, ...z.nodes[a].nb]).size);
    assert.deepEqual(ev(r.events, 'move')[0].seen, z.nodes[a].nb.filter((id) => !s.zone.seen[id]));
    // Walk further out: the hub's ring stays seen.
    const b = r.state.zone.nodes[a].nb.find((x) => ringOf(x) === 2);
    const r2 = R.step(r.state, { type: 'PASS_THROUGH', nodeId: b });
    for (const id of now) assert.ok(r2.state.zone.seen[id], 'remembered');
    assert.equal(R.mapView(r2.state).vision.radius, C.VISION_RADIUS);
  });

  test('1.9.5 radius: Local Guide adds GUIDE_RADIUS_BONUS; the radius is capped at VISION_RADIUS_MAX', () => {
    const g = expRun('mage', { seed: 12, vision: { guide: true } });
    assert.equal(g.exp.vision.radius, C.VISION_RADIUS + C.GUIDE_RADIUS_BONUS);
    const d = hops(g.zone.nodes, 0);
    assert.deepEqual(g.zone.seen.map((b, i) => b), d.map((x) => x <= Math.min(C.VISION_RADIUS_MAX, C.VISION_RADIUS + C.GUIDE_RADIUS_BONUS)));
    // A kit wider than the cap sees VISION_RADIUS_MAX hops.
    let w = tweak(onMap(expRun('mage', { seed: 12 })), (x) => { x.exp.vision.radius = 5; });
    const a = w.zone.nodes[0].nb[0];
    w = R.step(w, { type: 'PASS_THROUGH', nodeId: a }).state;
    const da = hops(w.zone.nodes, a);
    for (const n of w.zone.nodes) if (da[n.id] <= C.VISION_RADIUS_MAX) assert.ok(w.zone.seen[n.id]);
    assert.ok(w.zone.nodes.some((n) => da[n.id] === C.VISION_RADIUS_MAX + 1 && !w.zone.seen[n.id] && hops(w.zone.nodes, 0)[n.id] > 1), 'nothing past the cap');
    assert.equal(R.mapView(w).vision.radius, C.VISION_RADIUS_MAX);
  });

  test('1.9.5 the map view: skeleton, landmarks, regions list and the Dimming for every node; contents only of seen nodes; charts and Pathfinder', () => {
    const s = onMap(expRun('hunter', { seed: 21 }));
    const v = R.mapView(s);
    assert.equal(v.mode, 'expedition');
    assert.equal(v.nodes.length, NODE_COUNT);
    assert.deepEqual(v.roads, s.zone.roads);
    assert.equal(v.shardfall, s.zone.shardfall);
    assert.equal(v.edges.length, s.zone.nodes.reduce((n, x) => n + x.nb.length, 0) / 2);
    assert.deepEqual(v.regions.map((r) => r.kind), C.REGION_KINDS);
    assert.equal(v.bell.charges, C.BELL_START_CHARGES);
    for (const n of v.nodes) {
      assert.ok('dimmed' in n && 'dimsIn' in n && 'road' in n && 'shardfall' in n && 'nb' in n && 'angle' in n && 'hops' in n);
      if (s.zone.seen[n.id]) {
        assert.equal(n.know, 'full');
        assert.equal(n.type, s.zone.nodes[n.id].type);
        assert.equal(n.cl, s.zone.nodes[n.id].cl);
        if (n.id > 0) assert.equal(n.region, s.zone.nodes[n.id].region);
      } else {
        assert.equal(n.know, 'none');
        assert.equal(n.type, undefined);
        assert.equal(n.region, null);
      }
    }
    assert.deepEqual(v.moves.map((m) => m.nodeId), s.zone.nodes[0].nb);
    const H = { quest: C.EXPED_TIME_QUEST, elite: C.EXPED_TIME_ELITE, grind: C.EXPED_TIME_GRIND_WAVE, dungeon: C.EXPED_TIME_DUNGEON, rest: C.TIME_REST, vendor: C.TIME_VENDOR, trainer: C.TIME_TRAINER, treasure: C.TIME_TREASURE, shrine: C.TIME_SHRINE };
    for (const m of v.moves) {
      assert.equal(m.via, 'enter');
      assert.equal(m.time, H[s.zone.nodes[m.nodeId].type]);
      assert.equal(m.passTime, C.TIME_WALK);
    }
    // Region Charts: every node's region and the dungeon's type (no other content).
    const ch = R.mapView(onMap(expRun('hunter', { seed: 21, vision: { charts: true } })));
    const dId = s.zone.nodes.find((n) => n.type === 'dungeon').id;
    for (const n of ch.nodes) if (n.id > 0) assert.equal(n.region, s.zone.nodes[n.id].region);
    if (!s.zone.seen[dId]) { assert.equal(ch.nodes[dId].know, 'type'); assert.equal(ch.nodes[dId].type, 'dungeon'); assert.equal(ch.nodes[dId].cl, undefined); }
    // Pathfinder: types (only) within PATHFINDER_RADIUS.
    const pf = R.mapView(onMap(expRun('hunter', { seed: 21, vision: { pathfinder: true } })));
    const d0 = hops(s.zone.nodes, 0);
    for (const n of pf.nodes) {
      if (d0[n.id] <= C.VISION_RADIUS) assert.equal(n.know, 'full');
      else if (d0[n.id] <= C.PATHFINDER_RADIUS) { assert.equal(n.know, 'type'); assert.equal(n.type, s.zone.nodes[n.id].type); assert.equal(n.cl, undefined); assert.equal(n.archetypes, undefined); }
      else assert.equal(n.know, 'none');
    }
  });

  test('1.9.5 leak test: hidden node contents are absent from mapView, and mapView is the same when they are replaced', () => {
    const SKELETON = ['id', 'ring', 'angle', 'nb', 'hops', 'hub', 'road', 'shardfall', 'dimmed', 'dimsIn', 'dimAt', 'know', 'region'];
    const CONTENT_KEYS = ['type', 'cl', 'done', 'lost', 'quest', 'mobs', 'title', 'archetypes', 'level', 'name', 'rare', 'fights', 'bossArchetype', 'bossLevel', 'guarded', 'trap', 'ember', 'stock', 'waves', 'boons', 'elite', 'add', 'trash', 'boss', 'guard'];
    const strangers = [];
    for (let seed = 1; seed <= 12; seed++) {
      let s = onMap(expRun(['rogue', 'mage', 'hunter'][seed % 3], { seed, content: seed % 2 ? CONTENT : REAL }));
      // A few steps out, so some nodes are seen and some are not.
      s = walk(s, pathTo(s.zone, 0, s.zone.roads[seed % C.ROAD_COUNT]).slice(0, 3)).state;
      const v = R.mapView(s);
      for (const n of v.nodes) {
        if (n.know !== 'none') continue;
        assert.deepEqual(Object.keys(n).sort(), [...SKELETON].sort(), `node ${n.id} has only skeleton keys`);
        for (const k of CONTENT_KEYS) assert.ok(!(k in n), k);
        assert.equal(n.region, null);
        strangers.push(n.id);
      }
      assert.ok(!JSON.stringify(v.moves).includes('quest'));
      // Replace every hidden node's content with another seed's zone (same zone number): the view does not change.
      const other = zoneOf(seed + 1000, s.zone.z, s.content);
      const swapped = tweak(s, (x) => {
        for (const n of x.zone.nodes) {
          if (x.zone.seen[n.id] || n.ring === 0) continue;
          const o = other.nodes[n.id];
          for (const k of [...CONTENT_KEYS, 'region']) delete n[k];
          for (const k of [...CONTENT_KEYS, 'region']) if (k in o) n[k] = JSON.parse(JSON.stringify(o[k]));
          n.done = false;
        }
      });
      assert.deepEqual(R.mapView(swapped), v, `seed ${seed}`);
      assert.deepEqual(R.autoAction(swapped), R.autoAction(s), 'the default policy reads what the player sees');
    }
    assert.ok(strangers.length > 100);
  });
});

describe('rules 1.9 expedition map: the Dimming (1.9.6)', () => {
  test('1.9.6 front (M2b v7): -1 before DIM_GRACE, then DIM_FRONT_HOPS hops per DIM_FRONT_TIME tolls; Dimmed = hops from the Shardfall <= front', () => {
    assert.equal(frontAt(0), -1);
    assert.equal(frontAt(C.DIM_GRACE - 1), -1);
    assert.equal(frontAt(C.DIM_GRACE), 0);
    for (let zt = C.DIM_GRACE; zt < 40; zt++) assert.equal(frontAt(zt), Math.floor((C.DIM_FRONT_HOPS * (zt - C.DIM_GRACE)) / C.DIM_FRONT_TIME));
    const s0 = onMap(expRun('mage', { seed: 2 }));
    for (const zt of [0, 5, 6, 8, 9, 13, 14, 20, 30]) {
      const s = tweak(s0, (x) => atZoneTime(x, zt));
      const v = R.mapView(s);
      const f = frontAt(zt);
      assert.equal(v.dim.front, f);
      for (const n of v.nodes) {
        const d = s.zone.shardDist[n.id];
        // M2b v12 (D100): every node, the Dungeon too, dims by its hops (the M2b v10 hold is removed).
        assert.equal(n.dimmed, f >= 0 && d <= f, `zt ${zt} node ${n.id}`);
        assert.equal(n.dimAt, dimAtHops(d));
        assert.equal(n.dimAt, dimAt(s.zone, n.id));
        assert.equal(n.dimsIn, Math.max(0, n.dimAt - zt));
        assert.equal(frontAt(n.dimAt) >= d && frontAt(n.dimAt - 1) < d, true, 'dimAt is the first toll it is Dimmed');
      }
    }
    // With the starting values: the Shardfall at 6 h, the hub (3 hops) at 14 h (expedition.md 6.2).
    const hub = s0.zone.shardDist[0];
    assert.equal(dimAt(s0.zone, s0.zone.shardfall), C.DIM_GRACE);
    assert.equal(dimAt(s0.zone, 0), C.DIM_GRACE + Math.ceil((hub * C.DIM_FRONT_TIME) / C.DIM_FRONT_HOPS));
  });

  test('1.9.6 the front moves with tolls: a dimming event lists the nodes it newly covers', () => {
    let s = onMap(expRun('mage', { seed: 2 }));
    s = tweak(s, (x) => atZoneTime(x, C.DIM_GRACE - 1));
    const id = s.zone.nodes[0].nb.find((x) => R.isLegal(s, { type: 'PASS_THROUGH', nodeId: x }));
    const r = R.step(s, { type: 'PASS_THROUGH', nodeId: id });
    const d = ev(r.events, 'dimming');
    assert.equal(d.length, 1);
    assert.equal(d[0].front, 0);
    assert.deepEqual(d[0].dimmed, [s.zone.shardfall]);
  });

  test('1.9.6 the Dungeon dims by its hops (M2b v12, D100: DUNGEON_DIM_HOLD removed): dimAt, the map, the Dimming clock and entry follow the front', () => {
    assert.equal('DUNGEON_DIM_HOLD' in C, false);
    for (const seed of [2, 5, 9]) {
      const s0 = onMap(expRun('mage', { seed, content: REAL }));
      const zone = s0.zone;
      const dg = zone.nodes.find((n) => n.type === 'dungeon').id;
      const h = zone.shardDist[dg];
      assert.notEqual(dg, zone.shardfall, 'the Shardfall is never the Dungeon');
      for (const n of zone.nodes) assert.equal(dimAt(zone, n.id), dimAtHops(zone.shardDist[n.id]), `seed ${seed} node ${n.id}`);
      const nb = zone.nodes[dg].nb[0];
      // Standing next to it (so it is seen), the toll before the front reaches it and the toll it does.
      const at = (zt) => tweak(s0, (x) => { x.zone.pos = nb; x.zone.seen[dg] = true; x.zone.seen[nb] = true; atZoneTime(x, zt); });
      const before = at(dimAtHops(h) - 1);
      assert.deepEqual([R.mapView(before).nodes[dg].dimmed, R.mapView(before).nodes[dg].dimsIn], [false, 1]);
      assert.equal(R.mapView(before).moves.find((m) => m.nodeId === dg).via, 'enter');
      assert.equal(R.heatView(tweak(before, (x) => { x.zone.pos = dg; })).dimIn, 1, 'the Dimming clock on the Dungeon: its hops');
      const reached = at(dimAtHops(h));
      const w = R.mapView(reached).nodes[dg];
      assert.deepEqual([w.dimmed, w.dimsIn, w.dimAt, w.lost], [true, 0, dimAtHops(h), true]);
      assert.equal(R.mapView(reached).moves.find((m) => m.nodeId === dg).via, 'walk', 'Dimmed when the front reaches it: a walk, not an entry');
      // Hidden or charted: the same value (nothing to hide any more).
      const hid = tweak(s0, (x) => { x.zone.seen[dg] = false; x.zone.typed[dg] = false; });
      assert.equal(R.mapView(hid).nodes[dg].dimAt, dimAtHops(h));
      assert.equal(R.mapView(tweak(hid, (x) => { x.exp.vision.regions = true; })).nodes[dg].dimAt, dimAtHops(h));
    }
  });

  /** A mage at level L standing next to node `target` (Dimmed at zone toll zt) on zone 1's map. */
  function nextToDimmed(seed, L, depth) {
    let s = onMap(atLevel(expRun('mage', { seed }), L));
    const zone = s.zone;
    const target = zone.nodes[0].nb[0];
    // Dimmed before the step (so MOVE walks in) and `depth` hops deep or more on arrival.
    const zt = dimAt(zone, target) + Math.ceil((depth * C.DIM_FRONT_TIME) / C.DIM_FRONT_HOPS);
    s = tweak(s, (x) => atZoneTime(x, zt));
    return { s, target };
  }

  test('1.9.6 Dimmed encounter: entering a Dimmed node, DIM_PACK_SIZE Shardspawn of the zone\'s normals, level max(CL, L) + DIM_LEVEL_PER_DEPTH × depth, HP × DIM_HP_MULT, damage × DIM_DMG_MULT, TIME_DIM_FIGHT', () => {
    for (const [L, depth] of [[3, 0], [5, 2], [59, 2]]) {
      const { s, target } = nextToDimmed(9, L, depth);
      const node = s.zone.nodes[target];
      const r = R.step(s, { type: 'MOVE', nodeId: target });
      const st = r.state;
      assert.equal(ev(r.events, 'move')[0].via, 'walk', 'a Dimmed node is not entered');
      // M2b v12 (D101): TIME_DIM_ESCAPE when the walk went farther from the Shardfall, else TIME_DIM_FIGHT
      const dimT = s.zone.shardDist[target] > s.zone.shardDist[s.zone.pos] ? C.TIME_DIM_ESCAPE : C.TIME_DIM_FIGHT;
      assert.deepEqual(ev(r.events, 'time').map((e) => [e.add, e.why]), [[C.TIME_WALK, 'walk'], [dimT, 'dim']]);
      assert.equal(st.phase, 'NODE');
      assert.equal(st.node.type, 'dim');
      assert.equal(st.fight.kind, 'dim');
      assert.ok(st.fight.engage, 'an engage round, as every fight but the end boss');
      const zt = zoneTime(s) + C.TIME_WALK;
      const dep = frontAt(zt) - s.zone.shardDist[target];
      assert.equal(st.node.depth, dep);
      const level = Math.min(C.MAX_LEVEL, Math.max(node.cl, L) + C.DIM_LEVEL_PER_DEPTH * dep);
      assert.equal(ev(r.events, 'dim')[0].level, level);
      assert.equal(st.fight.enemies.length, C.DIM_PACK_SIZE);
      // Make-up: stream dim(z, id, 0), DIM_PACK_SIZE picks from the zone's normals, then the composition repair.
      const g = STREAM.dim(s.seed, 1, target, 0);
      const zn = s.content.zones[0];
      const tids = Array.from({ length: C.DIM_PACK_SIZE }, () => zn.normals[nextInt(g, zn.normals.length)]);
      assert.deepEqual(st.fight.enemies.map((e) => e.tid), composeEncounter(s.content, g, tids, zn.normals));
      assert.ok(validEncounter(s.content, st.fight.enemies.map((e) => e.tid)));
      for (const e of st.fight.enemies) {
        const t = s.content.enemies[e.tid];
        const A = C.ARCHETYPE[t.archetype];
        assert.equal(e.kind, 'shardspawn');
        assert.equal(e.level, level);
        assert.equal(e.maxHp, Math.max(1, Math.round((C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * level) * A.hp * C.DIM_HP_MULT * t.hpMult + 1e-9)));
        const dmg = (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * level) * A.dmg * C.DIM_DMG_MULT * t.dmgMult * R.zoneDanger(level, 'normal') * C.ENGAGE_DMG_COMP;
        assert.ok(Math.abs(e.dmg - dmg) < 1e-9, 'zone danger as a normal enemy, ENGAGE_DMG_COMP');
      }
      assert.equal(st.stats.exp.dimFights, 1);
      assert.equal(st.zone.dimN[target], 1, 'the next encounter here uses dim(z, id, 1)');
    }
  });

  test('1.9.6 Dimmed encounter rewards: kill XP × DIM_XP_MULT (× XP_WEIGHT_MULT), no coin, no loot; the node stays unresolved; flee is passing through', () => {
    const { s, target } = nextToDimmed(9, 12, 1);
    let st = R.step(s, { type: 'MOVE', nodeId: target }).state;
    st = tweak(st, (x) => { for (const e of x.fight.enemies) e.hp = 1; x.player.rested = 0; });
    const L = st.player.level;
    const lvl = st.fight.enemies[0].level;
    const all = [];
    let guard = 0;
    while (st.fight && guard++ < 60) { const r = R.step(st, R.autoAction(st)); all.push(...r.events); st = r.state; }
    assert.equal(st.phase, 'MAP');
    const kill = ev(all, 'xp').find((e) => e.why === 'kill');
    assert.equal(kill.amount, Math.round(C.MOB_XP_FRAC * C.DIM_XP_MULT * C.XP_WEIGHT_MULT * R.xpCurve(lvl) * R.diffMod(lvl - L) + 1e-9));
    assert.equal(ev(all, 'gold').filter((e) => e.why === 'kill').length, 0, 'no coin');
    assert.equal(ev(all, 'loot').length, 0, 'no loot');
    assert.equal(st.zone.nodes[target].done, false, 'the node is not resolved');
    assert.equal(st.zone.pos, target);
    assert.equal(st.stats.kills.normal, C.DIM_PACK_SIZE);
    // Flee: allowed and counts as passing through: back on the map on the node, which stays unresolved.
    const f = R.step(s, { type: 'MOVE', nodeId: target }).state;
    assert.ok(f.fight.canFlee);
    const fled = R.step(tweak(f, (x) => forceDraws(x, 1, (d) => d[0] < 0.01)), { type: 'FLEE' });
    assert.equal(ev(fled.events, 'fled').length, 1);
    assert.equal(fled.state.phase, 'MAP');
    assert.equal(fled.state.zone.pos, target);
    assert.equal(fled.state.zone.nodes[target].done, false);
  });

  test('1.9.6 ending an action in a Dimmed node: the front reaching the player during a node starts the encounter after it, once', () => {
    let s = onMap(atLevel(expRun('mage', { seed: 14 }), 15));
    const id = s.zone.nodes[0].nb[0];
    s = tweak(s, (x) => { makeType(x, id, 'rest'); atZoneTime(x, dimAt(x.zone, id) - 1); });
    assert.ok(!R.mapView(s).nodes[id].dimmed && R.mapView(s).nodes[id].dimsIn === 1);
    const r = R.step(s, { type: 'MOVE', nodeId: id });
    assert.equal(ev(r.events, 'rest').length, 1, 'the rest happens: the node was entered before the dark came');
    assert.equal(r.state.zone.nodes[id].done, true);
    assert.equal(r.state.phase, 'NODE');
    assert.equal(r.state.node.type, 'dim', 'then the Dimmed encounter');
    assert.equal(ev(r.events, 'dim').length, 1);
    // After it the player stands in the dark: actions without tolls start nothing; the next step out is fine.
    let t = autoUntil(tweak(r.state, (x) => { for (const e of x.fight.enemies) e.hp = 1; }), (x) => !x.fight);
    assert.equal(t.phase, 'MAP');
    const t2 = R.step(t, { type: 'SET_AUTOPLAY', on: true });
    assert.equal(ev(t2.events, 'dim').length, 0);
  });

  test('1.9.6 content lost: an unresolved Dimmed node is walked into; PASS_THROUGH refuses it; the hub\'s services stop when it is Dimmed', () => {
    let s = onMap(atLevel(expRun('rogue', { seed: 15 }), 20));
    const id = s.zone.nodes[0].nb[2];
    s = tweak(s, (x) => { makeType(x, id, 'shrine'); atZoneTime(x, dimAt(x.zone, id)); });
    assert.match(R.whyIllegal(s, { type: 'PASS_THROUGH', nodeId: id }), /Dimmed/);
    const v = R.mapView(s);
    assert.equal(v.nodes[id].lost, true);
    assert.deepEqual(v.moves.find((m) => m.nodeId === id), { nodeId: id, via: 'walk', time: C.TIME_WALK, passTime: null, dimmed: true });
    const r = R.step(s, { type: 'MOVE', nodeId: id });
    assert.equal(ev(r.events, 'node').length, 0, 'no shrine');
    assert.equal(r.state.node.type, 'dim');
    // The hub: SERVICE is refused while it is Dimmed; walking onto a Dimmed hub is no new visit.
    const h = tweak(expRun('rogue', { seed: 15 }), (x) => atZoneTime(x, dimAt(x.zone, 0)));
    assert.match(R.whyIllegal(h, { type: 'SERVICE', service: 'inn' }), /Dimming covers the hub/);
    let w = onMap(atLevel(expRun('rogue', { seed: 15 }), 20));
    w = R.step(w, { type: 'PASS_THROUGH', nodeId: id }).state;
    w = tweak(w, (x) => atZoneTime(x, dimAt(x.zone, 0) - C.TIME_WALK));
    const back = R.step(w, { type: 'MOVE', nodeId: 0 });
    assert.ok(!ev(back.events, 'phase').some((e) => e.phase === 'ZONE_HUB'), 'no hub visit in the dark');
    assert.equal(back.state.node && back.state.node.type, 'dim');
  });

  test('1.9.6 death in the Dimming ends the run: the death location has the node, its ring, type dim and the depth', () => {
    const { s, target } = nextToDimmed(9, 1, 3);
    let st = tweak(R.step(s, { type: 'MOVE', nodeId: target }).state, (x) => { x.player.hp = 1; });
    st = autoUntil(st, (x) => x.phase === 'SUMMARY' || !x.fight);
    assert.equal(st.phase, 'SUMMARY');
    assert.equal(st.outcome, 'death');
    assert.equal(st.death.nodeType, 'dim');
    assert.equal(st.death.node, target);
    assert.equal(st.death.ring, s.zone.nodes[target].ring);
    assert.equal(st.death.depth, frontAt(zoneTime(s) + C.TIME_WALK) - s.zone.shardDist[target]);
    assert.equal(st.death.row, null);
    const sum = R.summary(st);
    assert.equal(sum.expedition.dimFights, 1);
    assert.equal(sum.expedition.dimZones, 1);
  });
});

describe('rules 1.9 expedition map: leaving a zone (1.9.7)', () => {
  test('1.9.7 TAKE_ROAD: only on a Road, TIME_TRAVEL, the next zone\'s hub; no level gate; zone 6 leads to the Camp and the boss; (M2b v15, D126) the Swift passage is off by default: a Road taken within ROAD_SWIFT_TOLLS pays nothing (its rule: s01g-v15)', () => {
    assert.equal(C.GATES.swiftRoad, false, 'D126');
    let s = onMap(expRun('hunter', { seed: 17 }));
    for (let z = 1; z <= C.ZONE_COUNT; z++) {
      if (z > 1) s = onMap(s);
      const road = s.zone.roads[0];
      s = walk(s, pathTo(s.zone, s.zone.pos, road)).state;
      assert.equal(R.mapView(s).onRoad, true);
      assert.ok(s.player.level <= z, 'no level gate');
      assert.ok(zoneTime(s) <= C.ROAD_SWIFT_TOLLS, 'a quick walk to the rim');
      const h = s.time;
      const xp0 = s.player.xp;
      const r = R.step(s, { type: 'TAKE_ROAD' });
      assert.deepEqual([ev(r.events, 'swift').length, ev(r.events, 'xp').length, r.state.player.xp], [0, 0, xp0], 'D126: no Swift passage by default');
      assert.deepEqual(ev(r.events, 'time').map((e) => [e.add, e.why]), [[C.TIME_TRAVEL, 'travel']]);
      assert.deepEqual(ev(r.events, 'travel')[0], { t: 'travel', from: z, by: 'road', node: road, road: null }, 'fixture content: no Road names (D51)');
      s = r.state;
      assert.equal(s.time, h + C.TIME_TRAVEL);
      assert.equal(s.stats.zonesLeft, z);
      if (z < C.ZONE_COUNT) {
        assert.equal(s.phase, 'ZONE_HUB');
        assert.equal(s.zone.z, z + 1);
        assert.equal(s.zone.pos, 0);
        assert.equal(zoneTime(s), 0, 'zone time starts at the hub');
      }
    }
    assert.equal(s.phase, 'CAMP');
    assert.equal(R.mapView(s), null);
    assert.ok(R.isLegal(s, { type: 'FIGHT_BOSS' }));
    assert.ok(!R.isLegal(s, { type: 'RING_BELL' }), 'not in the Camp');
    s = R.step(s, { type: 'FIGHT_BOSS' }).state;
    assert.equal(s.phase, 'BOSS');
    assert.ok(!R.isLegal(s, { type: 'RING_BELL' }) && !R.isLegal(s, { type: 'TAKE_ROAD' }), 'not at the boss');
    const sum = R.summary(s);
    assert.equal(sum.expedition.roads, C.ZONE_COUNT);
    assert.equal(sum.expedition.zones.length, C.ZONE_COUNT);
    assert.ok(sum.expedition.zones.every((x) => x.exit === 'road' && x.time > 0));
  });

  test('1.9.7 a Dimmed Road is taken after its Dimmed encounter', () => {
    let s = onMap(atLevel(expRun('mage', { seed: 19 }), 30));
    const road = s.zone.roads[0];
    const path = pathTo(s.zone, 0, road);
    s = walk(s, path.slice(0, -1)).state;
    s = tweak(s, (x) => atZoneTime(x, dimAt(x.zone, road)));
    const r = R.step(s, { type: 'MOVE', nodeId: road });
    assert.equal(r.state.node.type, 'dim');
    assert.ok(!R.isLegal(r.state, { type: 'TAKE_ROAD' }), 'not during the fight');
    let t = autoUntil(tweak(r.state, (x) => { for (const e of x.fight.enemies) e.hp = 1; }), (x) => !x.fight);
    assert.equal(t.phase, 'MAP');
    assert.ok(R.isLegal(t, { type: 'TAKE_ROAD' }));
    assert.equal(R.step(t, { type: 'TAKE_ROAD' }).state.zone.z, 2);
  });

  test('1.9.7 Homeward Bell: BELL_START_CHARGES; RING_BELL costs BELL_CHANNEL_TIME, no TIME_TRAVEL, the next zone; not with no charge or in a node', () => {
    let s = onMap(expRun('rogue', { seed: 23 }));
    assert.equal(s.exp.bell, C.BELL_START_CHARGES);
    assert.ok(C.BELL_START_CHARGES <= C.BELL_MAX_CHARGES);
    const r = R.step(s, { type: 'RING_BELL' });
    assert.deepEqual(ev(r.events, 'time').map((e) => [e.add, e.why]), [[C.BELL_CHANNEL_TIME, 'bell']]);
    assert.deepEqual(ev(r.events, 'bell')[0], { t: 'bell', charges: C.BELL_START_CHARGES - 1, node: 0 });
    assert.deepEqual(ev(r.events, 'travel')[0], { t: 'travel', from: 1, by: 'bell', node: 0, road: null });
    assert.equal(r.state.zone.z, 2);
    assert.equal(r.state.phase, 'ZONE_HUB');
    assert.equal(r.state.stats.zonesLeft, 1);
    assert.equal(r.state.exp.bell, 0);
    assert.match(R.whyIllegal(onMap(r.state), { type: 'RING_BELL' }), /no Homeward Bell charge/);
    const sum = R.summary(r.state);
    assert.equal(sum.expedition.bellsRung, 1);
    assert.equal(sum.expedition.bellCharges, 0);
    assert.equal(sum.expedition.zones[0].exit, 'bell');
    // Not in a node, not in the hub screen.
    const n = R.step(atLevel(onMap(expRun('rogue', { seed: 23 })), 20), { type: 'MOVE', nodeId: s.zone.nodes[0].nb[0] }).state;
    assert.equal(n.phase, 'NODE');
    assert.ok(!R.isLegal(n, { type: 'RING_BELL' }));
    assert.ok(!R.isLegal(expRun('rogue', { seed: 23 }), { type: 'RING_BELL' }), 'LEAVE_HUB first');
  });

  test('1.9.7 the Bell when the player\'s node dims during the channel: the Dimmed encounter first, then the Bell', () => {
    let s = onMap(atLevel(expRun('hunter', { seed: 24 }), 30));
    const id = s.zone.nodes[0].nb[0];
    s = R.step(s, { type: 'PASS_THROUGH', nodeId: id }).state;
    s = tweak(s, (x) => atZoneTime(x, dimAt(x.zone, id) - 1));
    const r = R.step(s, { type: 'RING_BELL' });
    assert.equal(r.state.phase, 'NODE');
    assert.equal(r.state.node.type, 'dim');
    assert.equal(r.state.zone.z, 1, 'not yet');
    assert.ok(!ev(r.events, 'travel').length);
    const t = autoUntil(tweak(r.state, (x) => { for (const e of x.fight.enemies) e.hp = 1; }), (x) => !x.fight || x.zone.z === 2);
    assert.equal(t.zone.z, 2, 'the Bell completes after the encounter');
    assert.equal(t.phase, 'ZONE_HUB');
    assert.equal(t.stats.exp.bellExits, 1);
  });
});

describe('rules 1.9 expedition map: pacing, determinism and full runs (1.9.8, 1.9.9)', () => {
  test('1.9.8 node tolls 3 / 3 / 2 per wave / 5 (quest, elite, grind, dungeon; M2b v10: dungeon 6 -> 5); a Grind of one wave starts on entry; two dungeon trash fights', () => {
    const base = onMap(atLevel(expRun('mage', { seed: 31 }), 30));
    const id = base.zone.nodes[0].nb[0];
    const want = { quest: C.EXPED_TIME_QUEST, elite: C.EXPED_TIME_ELITE, grind: C.EXPED_TIME_GRIND_WAVE, dungeon: C.EXPED_TIME_DUNGEON, rest: C.TIME_REST, vendor: C.TIME_VENDOR, trainer: C.TIME_TRAINER, treasure: C.TIME_TREASURE, shrine: C.TIME_SHRINE };
    for (const [type, h] of Object.entries(want)) {
      const s = tweak(base, (x) => makeType(x, id, type));
      const r = R.step(s, { type: 'MOVE', nodeId: id });
      assert.equal(timeOf(r.events), h, type);
      assert.equal(R.mapView(s).moves.find((m) => m.nodeId === id).time, h, `${type}: tolls in the map view`);
      if (type === 'grind') { assert.equal(r.state.node.planned, 1); assert.ok(r.state.fight, 'the wave starts on entry'); }
    }
    assert.deepEqual([C.EXPED_TIME_QUEST, C.EXPED_TIME_ELITE, C.EXPED_TIME_GRIND_WAVE, C.EXPED_TIME_DUNGEON], [3, 3, 2, 5]);
    // Dungeon: trash, trash, boss.
    let d = R.step(tweak(base, (x) => makeType(x, id, 'dungeon')), { type: 'MOVE', nodeId: id }).state;
    const kinds = [];
    for (let guard = 0; guard < 2000 && d.phase === 'NODE'; guard++) {
      if (d.fight && d.fight.round === 1 && kinds.length < 3 && kinds[kinds.length - 1] !== `${d.fight.kind}${d.node.k}`) kinds.push(`${d.fight.kind}${d.node.k}`);
      if (d.fight) d = tweak(d, (x) => { for (const e of x.fight.enemies) e.hp = Math.min(e.hp, 1); });
      d = R.step(d, R.autoAction(d)).state;
    }
    assert.deepEqual(kinds, ['trash0', 'trash1', `dboss${C.EXPED_DUNGEON_TRASH_FIGHTS}`]);
    assert.ok(!R.isLegal(tweak(base, (x) => makeType(x, id, 'grind')), { type: 'GRIND_SET_WAVES', n: 2 }));
  });

  test('1.9.8 XP × XP_WEIGHT_MULT: kills, quest turn-in, grind wave, dungeon clear; the rows map keeps rules 2.0', () => {
    const base = onMap(atLevel(expRun('mage', { seed: 33 }), 3));
    const id = base.zone.nodes[0].nb[0];
    /** Enter node `id` as `type` with every enemy at 1 HP and autoplay to the end of its fights; all events. */
    const clear = (type, L0) => {
      const first = R.step(tweak(atLevel(base, L0), (x) => { makeType(x, id, type); x.player.rested = 0; }), { type: 'MOVE', nodeId: id });
      let s = first.state;
      const all = [...first.events];
      for (let i = 0; i < 400 && s.phase === 'NODE'; i++) {
        if (s.fight) s = tweak(s, (x) => { for (const e of x.fight.enemies) e.hp = Math.min(e.hp, 1); });
        const r = R.step(s, R.autoAction(s));
        all.push(...r.events);
        s = r.state;
      }
      return { s, all, node: base.zone.nodes[id] };
    };
    /** Character level when event e happened. */
    const levelAt = (all, e, L0) => L0 + all.slice(0, all.indexOf(e)).filter((x) => x.t === 'levelUp').length;
    const want = (frac, cl, L) => Math.round(frac * C.XP_WEIGHT_MULT * R.xpCurve(cl) * R.diffMod(cl - L) + 1e-9);
    const q = clear('quest', 3);
    const qcl = tweak(base, (x) => makeType(x, id, 'quest')).zone.nodes[id].cl;
    const turnIn = ev(q.all, 'xp').find((e) => e.why === 'quest');
    assert.equal(turnIn.amount, want(C.QUEST_TURNIN_XP_FRAC, qcl, levelAt(q.all, turnIn, 3)), 'quest turn-in');
    const kill = ev(q.all, 'xp').find((e) => e.why === 'kill');
    const lvl = ev(q.all, 'fight')[0].enemies[0].level;
    assert.equal(kill.amount, want(C.MOB_XP_FRAC, lvl, levelAt(q.all, kill, 3)), 'kill');
    const g = clear('grind', 3);
    const gcl = tweak(base, (x) => makeType(x, id, 'grind')).zone.nodes[id].cl;
    const wave = ev(g.all, 'xp').find((e) => e.why === 'wave');
    assert.equal(wave.amount, want(C.GRIND_WAVE_XP_FRAC, gcl, levelAt(g.all, wave, 3)), 'grind wave');
    const d = clear('dungeon', 20);
    const clearXp = ev(d.all, 'xp').find((e) => e.why === 'dungeon');
    assert.equal(clearXp.amount, want(C.DUNGEON_CLEAR_XP_FRAC, dungeonLevels(1).boss, levelAt(d.all, clearXp, 20)), 'dungeon clear');
    // The rows map keeps rules 2.0 (weight 1; its XP values are tested in s02).
    const rows = R.step(R.newRun({ classId: 'mage', seed: 33, content: CONTENT, mapMode: 'rows' }), { type: 'START_RUN' }).state;
    assert.equal(xpWeight(rows), 1);
    assert.equal(xpWeight(base), C.XP_WEIGHT_MULT);
    assert.equal(nodeTime(rows, 'quest'), C.TIME_QUEST);
    assert.equal(grindMaxWaves(rows), C.GRIND_MAX_WAVES);
  });

  test('1.9.8 the summary and estSeconds: walks and passes cost PACE_DECIDE_S + PACE_TRAVEL_NODE_S, a Bell PACE_BELL_S', () => {
    let s = onMap(expRun('rogue', { seed: 41 }));
    const before = R.summary(s).minutes.manual;
    const a = s.zone.nodes[0].nb[0];
    s = R.step(R.step(s, { type: 'PASS_THROUGH', nodeId: a }).state, { type: 'MOVE', nodeId: 0 }).state;
    const after = R.summary(s);
    assert.ok(Math.abs((after.minutes.manual - before) * 60 - 2 * (C.PACE_DECIDE_S + C.PACE_TRAVEL_NODE_S)) < 1e-6);
    assert.equal(after.mapMode, 'expedition');
    assert.equal(after.expedition.walks, 1);
    assert.equal(after.expedition.passes, 1);
    const rung = R.step(onMap(s), { type: 'RING_BELL' }).state;
    // With the start camp (the default since D116) the next zone's hub may offer a contract: PACE_HUB_CONTRACT_S (expedition.md 9.4).
    const offers = rung.stats.exp.hubOffers - s.stats.exp.hubOffers;
    assert.ok(Math.abs((R.summary(rung).minutes.manual - after.minutes.manual) * 60 - C.PACE_BELL_S - offers * C.PACE_HUB_CONTRACT_S) < 1e-6, 'a Bell: PACE_BELL_S, no PACE_ZONE_TRAVEL_S');
  });

  test('1.9.2 / 0 determinism: the same seed and actions give the same state; a save mid-zone resumes exactly', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) {
      let a = expRun(cls, { seed: 51 });
      let b = expRun(cls, { seed: 51 });
      let n = 0;
      let saved = null;
      while (a.phase !== 'ENDED' && n < 4000) {
        const act = R.autoAction(a);
        a = R.step(a, act).state;
        b = R.step(b, act).state;
        if (n === 150) saved = R.serialize(a);
        n++;
      }
      assert.equal(R.serialize(a), R.serialize(b), cls);
      if (saved) {
        let c = R.deserialize(saved, CONTENT);
        for (let i = 0; i < 300 && c.phase !== 'ENDED'; i++) c = R.step(c, R.autoAction(c)).state;
        let d = R.deserialize(saved, CONTENT);
        for (let i = 0; i < 300 && d.phase !== 'ENDED'; i++) d = R.step(d, R.autoAction(d)).state;
        assert.equal(R.serialize(c), R.serialize(d));
      }
    }
  });

  test('1.9.9 full autoplay runs per class complete in an expedition run (fixture and real content); every action taken is listed', () => {
    let toCamp = 0;
    for (const content of [CONTENT, REAL]) for (const cls of ['rogue', 'mage', 'hunter']) for (let seed = 1; seed <= 4; seed++) {
      let s = expRun(cls, { seed, content });
      let n = 0;
      while (s.phase !== 'ENDED' && n < 20000) {
        const a = R.autoAction(s);
        if (s.phase === 'MAP' || s.phase === 'ZONE_HUB') {
          const canon = JSON.stringify(a);
          assert.ok(R.legalActions(s).some((x) => JSON.stringify(x) === canon), `${cls} seed ${seed}: ${canon} not listed`);
        }
        s = R.step(s, a).state;
        n++;
      }
      assert.equal(s.phase, 'ENDED', `${cls} seed ${seed} ended in ${n} actions`);
      const sum = s.result.summary;
      assert.equal(sum.mapMode, 'expedition');
      assert.ok(sum.expedition.zones.length >= 1);
      if (sum.reached.camp) toCamp += 1;
    }
    assert.ok(toCamp > 0, 'some runs reach the Camp');
  });
});

describe('expedition content and options (D50, D51)', () => {
  test('D51 the map view names the Roads (zones[i].roads, Road k = name k), carries the expedition texts and the regions\' families; the travel event names the Road taken', () => {
    let s = onMap(expRun('rogue', { seed: 5, content: REAL }));
    const v = R.mapView(s);
    const zc = REAL.zones[0];
    assert.deepEqual(v.roadNames, zc.roads, 'in the order of v.roads');
    assert.deepEqual(v.texts, REAL.texts.expedition);
    assert.deepEqual(v.regions.map((r) => [r.name, r.kind, r.families]), zc.regions.map((r) => [r.name, r.kind, r.families]));
    // Fixture content has none: nulls, and regions without families.
    const f = R.mapView(onMap(expRun('rogue', { seed: 5 })));
    assert.deepEqual(f.roadNames, [null, null, null]);
    assert.deepEqual(Object.values(f.texts), [null, null, null, null]);
    assert.ok(f.regions.every((r) => Array.isArray(r.families) && r.families.length === 0));
    // TAKE_ROAD on Road k: the travel event's road is name k.
    for (let k = 0; k < C.ROAD_COUNT; k++) {
      const road = s.zone.roads[k];
      const at = tweak(s, (x) => { x.zone.pos = road; x.time = x.zone.start; });
      const r = R.step(at, { type: 'TAKE_ROAD' });
      assert.equal(ev(r.events, 'travel')[0].road, zc.roads[k]);
    }
    const bell = R.step(s, { type: 'RING_BELL' });
    assert.equal(ev(bell.events, 'travel')[0].road, null, 'the Bell takes no Road');
  });

  test('D50 a seen elite shows its level and enemy count but not its name or its own archetype, rare or not; the leak is closed for real content', () => {
    let rares = 0;
    let elites = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const zone = zoneOf(seed, 1 + (seed % 6), REAL);
      for (const n of zone.nodes) {
        if (n.type !== 'elite') continue;
        const s = tweak(onMap(expRun('mage', { seed, content: REAL })), (x) => { x.zone = zone; x.zone.seen[n.id] = true; });
        const v = R.mapView(s).nodes[n.id];
        assert.equal(v.know, 'full');
        assert.deepEqual([v.name, v.rare, v.archetypes[0]], [null, null, null]);
        assert.equal(v.archetypes.length, n.add ? 2 : 1, 'one entry per enemy');
        if (n.add) assert.equal(v.archetypes[1], REAL.enemies[n.add].archetype);
        assert.equal(v.level, n.eliteLevel);
        if (n.rare) rares++; else elites++;
      }
    }
    assert.ok(rares > 5 && elites > 20, `rares ${rares}, elites ${elites}`);
    // Why the archetype is hidden too: in every zone of the real content the rares' archetypes differ from the elites'.
    for (const z of REAL.zones) {
      const ea = new Set(z.elites.map((id) => REAL.enemies[id].archetype));
      assert.ok(z.rares.every((id) => !ea.has(REAL.enemies[id].archetype)), z.id);
    }
  });

  test('D50 dimming: false plays an expedition run without the Dimming: no front, no Dimmed nodes or encounters, hub services at any hour; rows runs refuse it', () => {
    let s = onMap(expRun('hunter', { seed: 6 }));
    const off = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 6, content: CONTENT, mapMode: 'expedition', dimming: false });
    let o = R.step(R.step(R.step(off, { type: 'START_RUN' }).state, { type: 'SET_OUT' }).state, { type: 'LEAVE_HUB' }).state;
    assert.deepEqual(o.zone.nodes, s.zone.nodes, 'the same zone graph');
    o = tweak(o, (x) => { x.time = x.zone.start + 60; });
    const v = R.mapView(o);
    assert.deepEqual([v.dim.front, v.dim.nextIn, v.dim.off], [-1, Infinity, true]);
    assert.ok(v.nodes.every((n) => !n.dimmed && n.dimsIn === Infinity && n.dimAt === Infinity && !n.lost));
    assert.equal(R.mapView(s).dim.off, false);
    const r = R.step(o, { type: 'MOVE', nodeId: o.zone.nodes[0].nb[0] });
    assert.equal(ev(r.events, 'dimming').length + ev(r.events, 'dim').length, 0);
    assert.notEqual(r.state.node && r.state.node.type, 'dim');
    assert.equal(R.heatView(o).dimIn, null, 'no Dimming clock on the meter');
    const hub = R.step(tweak(o, (x) => { x.phase = 'ZONE_HUB'; }), { type: 'SERVICE', service: 'inn' }).state;
    assert.equal(hub.phase, 'ZONE_HUB');
    // A full autoplay run without the Dimming ends and meets no Dimmed encounter.
    let full = R.step(R.newRun({ classId: 'mage', seed: 6, content: REAL, mapMode: 'expedition', dimming: false }), { type: 'START_RUN' }).state;
    for (let n = 0; full.phase !== 'ENDED' && n < 20000; n++) full = R.step(full, R.autoAction(full)).state;
    assert.equal(full.phase, 'ENDED');
    assert.equal(full.result.summary.expedition.dimFights, 0);
    assert.equal(full.result.summary.expedition.dimming, false);
    assert.throws(() => R.newRun({ content: CONTENT, mapMode: 'rows', dimming: false }), /expedition option/);
    assert.throws(() => R.newRun({ content: CONTENT, mapMode: 'expedition', dimming: 'no' }), /expedition option/);
  });
});
