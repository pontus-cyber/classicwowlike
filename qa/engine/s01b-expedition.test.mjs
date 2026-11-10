// rules.md 1.9 (expedition): the roamable zone map behind newRun({ mapMode: 'expedition' }): graph generation and node
// setup by region (this commit); moves, vision, the Dimming, Roads and the Homeward Bell follow with the run flow. The
// rows map (rules 1.4) is tested in s00-s01.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, STREAM, nextFloat } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { nextInt, weightedIndex } from '../../src/rng.js';
import { dungeonLevels, validEncounter } from '../../src/engine/map.js';
import { generateExpZone, zoneRegions, hops, RING_START, NODE_COUNT } from '../../src/engine/expedition.js';

const [, N1, N2, N3] = C.RING_NODES;
const band = (z) => C.ZONE_LEVELS * (z - 1) + 1;
const norm = (a) => ((a % 360) + 360) % 360;
const angDist = (a, b) => Math.min(norm(a - b), 360 - norm(a - b));
const ringOf = (id) => (id === 0 ? 0 : id < RING_START[2] ? 1 : id < RING_START[3] ? 2 : 3);
/** Zone z of a seed as the engine generates it (from a started run's seed, content and profile). */
const zoneOf = (seed, z, content = CONTENT) => generateExpZone(R.step(R.newRun({ classId: 'mage', seed, content }), { type: 'START_RUN' }).state, z);

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

  test('1.9.2 determinism: the same seed gives the same zone; different seeds give different zones', () => {
    const strip = (zone) => JSON.stringify(zone.nodes.map((n) => ({ ...n, done: false, stock: n.stock ? n.stock.map((x) => x.kind + (x.id || x.item.slot + x.item.rarity + x.item.ilvl)) : null })));
    for (let seed = 1; seed <= 10; seed++) assert.equal(strip(zoneOf(seed, 3)), strip(zoneOf(seed, 3)));
    assert.notEqual(strip(zoneOf(1, 3)), strip(zoneOf(2, 3)));
  });
});
