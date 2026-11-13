// M3 3.2 (docs/specs/m3-onboarding.md 2.3, D135): pick TUTORIAL_SEED, the seed of zone 1's streams in the guided first
// run. For each candidate seed it builds zone 1 with the engine's own generation (a run whose seed is the candidate,
// so map(1), node(1, id), fight(1, id, k) and loot(1, id) are exactly the streams TUTORIAL_SEED will feed), with the
// guided run's fixed board slot 1 held (a Cull of the wild family in the Barleyreach Verge, zone 1) so the Cull sites
// are the ones the guided run will place. It keeps the seeds that meet the spec's criteria (a)-(e), ranks them by
// compactness and prints the best with a short text map. Offline design: it reads the zone state directly.
//
//   node sim/pick-tutorial-seed.mjs [--from 1] [--count 5000] [--top 5] [--seed N] [--json]
//
// --seed N prints one seed's map and criteria (pass or fail). Exit 0; exit 1 when no candidate passes.
import { newRunFor, R, angDist, hops } from './lib/engine.mjs';

export const VERGE_NAME = 'Barleyreach Verge';
/** Spec 2.3 (c): the Shardfall at least this many degrees from the Verge's direction. */
export const SHARD_MIN_DEG = 150;
const QG = (n) => n.type === 'quest' || n.type === 'grind';
const inner = (n) => n.ring === 1 || n.ring === 2;

/**
 * Zone 1 of a guided run on `seed`, as the engine generates it: START_RUN, board slot 1 set to the guided run's Cull
 * (spec 2.3 "Board"; the engine's tutorial overlay will hold it), TAKE_CONTRACT 0, SET_OUT. Returns the run state.
 */
export function tutorialZone(seed) {
  const s = newRunFor({ classId: 'rogue', seed, mapMode: 'expedition', prep: true });
  R.stepInPlace(s, { type: 'START_RUN' });
  const verge = vergeIndex(s);
  s.prep.board[0] = { ...s.prep.board[0], z: 1, kind: 'cull', region: verge, family: 'wild', template: null };
  R.stepInPlace(s, { type: 'TAKE_CONTRACT', index: 0 });
  R.stepInPlace(s, { type: 'SET_OUT' });
  if (s.phase !== 'ZONE_HUB' || !s.zone || s.zone.z !== 1) throw new Error(`seed ${seed}: zone 1 hub not reached (${s.phase})`);
  return s;
}

/** Index of the Barleyreach Verge in zone 1's regions (content order, as node.region). */
export function vergeIndex(s) {
  const z1 = s.content.zones[0];
  const i = z1.regions.findIndex((r) => r.name === VERGE_NAME);
  if (i < 0) throw new Error(`zone 1 has no region named ${VERGE_NAME}`);
  return i;
}

/** Circular mean of a list of angles (degrees, [0, 360)). */
function meanAngle(list) {
  let x = 0;
  let y = 0;
  for (const a of list) { x += Math.cos((a * Math.PI) / 180); y += Math.sin((a * Math.PI) / 180); }
  const m = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((((m % 360) + 360) % 360) * 10) / 10;
}

/** Screen direction of an angle on the map (src/ui/screens.js polar: 0 degrees right, 90 down). */
export function screenDir(a) {
  const names = ['right (east)', 'lower right (south-east)', 'bottom (south)', 'lower left (south-west)', 'left (west)', 'upper left (north-west)', 'top (north)', 'upper right (north-east)'];
  return names[Math.round((((a % 360) + 360) % 360) / 45) % 8];
}

/**
 * The criteria (a)-(e) of spec 2.3 and the map facts of zone 1 in state s. The Elite is the overlay's Elite: the Elite
 * node nearest the hub, ties lowest id (spec 2.3 "Elite"); (b) and (d) are checked on that node, so the node Gorrak
 * stands on is the one that meets them.
 */
export function evaluate(s) {
  const zone = s.zone;
  const nodes = zone.nodes;
  const verge = vergeIndex(s);
  const dist = nodes.map((n) => hops(nodes, n.id));
  const fromHub = dist[0];
  const vergeNodes = nodes.filter((n) => n.ring > 0 && n.region === verge);
  const vergeQG = vergeNodes.filter((n) => inner(n) && QG(n)).map((n) => n.id);
  const vergeR1 = vergeNodes.filter((n) => n.ring === 1).map((n) => n.id);
  const elites = nodes.filter((n) => n.type === 'elite').sort((a, b) => fromHub[a.id] - fromHub[b.id] || a.id - b.id);
  const elite = elites.length ? elites[0].id : null;
  const eliteToR1 = elite === null || !vergeR1.length ? Infinity : Math.min(...vergeR1.map((id) => dist[elite][id]));
  const vergeDir = meanAngle(vergeNodes.map((n) => n.angle));
  const shardDeg = Math.round(angDist(nodes[zone.shardfall].angle, vergeDir) * 10) / 10;
  const roadsByElite = elite === null ? [] : [...zone.roads].sort((a, b) => dist[elite][a] - dist[elite][b] || a - b);
  const road = roadsByElite.length ? roadsByElite[0] : null;
  const rests = nodes.filter((n) => n.type === 'rest').map((n) => n.id);
  const innerRests = rests.filter((id) => inner(nodes[id]));
  const crit = {
    a: vergeQG.length >= 3,
    b: elite !== null && nodes[elite].ring === 2 && eliteToR1 <= 2,
    c: shardDeg >= SHARD_MIN_DEG,
    d: road !== null && dist[elite][road] <= 3,
    // The engine places its Rest guarantee on a ring 1 or 2 node (expedition.md 4.3 step 5), so this holds on every
    // seed; it is checked as a guard against a change of the generation.
    e: innerRests.length >= 1,
  };
  const pass = Object.values(crit).every(Boolean);
  const sites = nodes.filter((n) => n.sites && n.sites.length).map((n) => n.id);
  const scriptSlots = nodes.filter((n) => inner(n) && QG(n) && !sites.includes(n.id)).map((n) => n.id).sort((a, b) => fromHub[a] - fromHub[b] || a - b);
  const facts = {
    verge, vergeDir, vergeQG, vergeR1, elite, eliteToR1, road, roadFromElite: road === null ? null : dist[elite][road],
    shardfall: zone.shardfall, shardAngle: nodes[zone.shardfall].angle, shardDeg, roads: [...zone.roads], rests, innerRests, sites, scriptSlots,
    dungeon: (nodes.find((n) => n.type === 'dungeon') || {}).id ?? null,
    trainer: nodes.filter((n) => n.type === 'trainer').map((n) => n.id),
  };
  return { crit, pass, facts, rank: pass ? rankOf(s, facts, dist) : null };
}

/** All k-subsets of a list. */
function subsets(list, k) {
  if (k === 0) return [[]];
  if (list.length < k) return [];
  const [h, ...t] = list;
  return [...subsets(t, k - 1).map((x) => [h, ...x]), ...subsets(t, k)];
}
function perms(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => perms([...list.slice(0, i), ...list.slice(i + 1)]).map((p) => [x, ...p]));
}

/**
 * Compactness: the shortest walk (hops) from the hub through 3 of the Verge's ring 1-2 Quest or Grind nodes and the
 * Elite, in any order, ending on a Road. Lower is better (5 is the least possible). Ties, in order: more non-site Quest
 * or Grind nodes in ring 1, up to ONB_SCRIPTED_FIGHTS 4 (S1-S4 can all play at levels 2-4 next to the hub); more Cull
 * sites in the Verge's rings 1-2, up to CULL_SITES 2 (the board-slot-1 Cull can be finished early); more Verge Quest or
 * Grind nodes in ring 1; then the end Road farther from the Shardfall (it dims later), then the larger
 * Verge-Shardfall angle, then the lower seed.
 */
function rankOf(s, f, dist) {
  const nodes = s.zone.nodes;
  let best = null;
  for (const set of subsets(f.vergeQG, 3)) {
    for (const p of perms([...set, f.elite])) {
      let len = dist[0][p[0]];
      for (let i = 1; i < p.length; i++) len += dist[p[i - 1]][p[i]];
      for (const r of f.roads) {
        const t = len + dist[p[p.length - 1]][r];
        const key = [t, -s.zone.shardDist[r]];
        if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) best = { key, route: [0, ...p, r] };
      }
    }
  }
  const r1 = f.vergeQG.filter((id) => nodes[id].ring === 1).length;
  const scriptR1 = Math.min(4, f.scriptSlots.filter((id) => nodes[id].ring === 1).length);
  const cullNear = Math.min(2, f.sites.filter((id) => inner(nodes[id]) && nodes[id].region === f.verge).length);
  return { tour: best.key[0], route: best.route, scriptR1, cullNear, vergeR1QG: r1, endRoadShardDist: -best.key[1] };
}

export function compareRank(x, y) {
  return x.rank.tour - y.rank.tour || y.rank.scriptR1 - x.rank.scriptR1 || y.rank.cullNear - x.rank.cullNear || y.rank.vergeR1QG - x.rank.vergeR1QG || y.rank.endRoadShardDist - x.rank.endRoadShardDist
    || y.facts.shardDeg - x.facts.shardDeg || x.seed - y.seed;
}

/** Scan seeds from..from+count-1; returns the passing ones, ranked. */
export function scan(from, count) {
  const out = [];
  for (let seed = from; seed < from + count; seed++) {
    const e = evaluate(tutorialZone(seed));
    if (e.pass) out.push({ seed, ...e });
  }
  return out.sort(compareRank);
}

const regionName = (s, i) => (i === null || i === undefined ? '-' : s.content.zones[0].regions[i].name);
function label(s, id) {
  const n = s.zone.nodes[id];
  const tags = [];
  if (n.road) tags.push('Road');
  if (n.shardfall) tags.push('Shardfall');
  if (n.sites && n.sites.length) tags.push('Cull site');
  return `${id} ${n.type}${n.cl ? ` L${n.cl}` : ''}${tags.length ? ` [${tags.join(', ')}]` : ''}`;
}

/** A short text map of zone 1 for seed `seed` (its state s and evaluation e). */
export function describe(seed, s, e) {
  const { nodes } = s.zone;
  const f = e.facts;
  const L = [];
  const ok = Object.entries(e.crit).map(([k, v]) => `${k} ${v ? 'yes' : 'NO'}`).join(', ');
  L.push(`seed ${seed}: criteria ${ok}${e.rank ? `; tour ${e.rank.tour} hops (${e.rank.route.join(' > ')}); ring 1 script slots ${e.rank.scriptR1}, near Cull sites ${e.rank.cullNear}` : ''}`);
  L.push(`  Verge direction ${f.vergeDir} deg (${screenDir(f.vergeDir)}); Shardfall node ${f.shardfall} at ${f.shardAngle} deg (${screenDir(f.shardAngle)}), ${f.shardDeg} deg from the Verge`);
  for (const ring of [1, 2]) {
    const list = nodes.filter((n) => n.ring === ring);
    L.push(`  ring ${ring}: ${list.map((n) => `${label(s, n.id)} (${regionName(s, n.region).split(' ')[0]}; nb ${n.nb.join(',')})`).join('; ')}`);
  }
  L.push(`  Verge Quest/Grind in rings 1-2: ${f.vergeQG.map((id) => label(s, id)).join('; ')}`);
  L.push(`  Elite (overlay, Gorrak): ${f.elite === null ? 'none' : `${label(s, f.elite)}, region ${regionName(s, nodes[f.elite].region)}, ${f.eliteToR1} hop(s) from a Verge ring 1 node`}`);
  L.push(`  Roads: ${f.roads.map((id) => `${label(s, id)} (${s.zone.shardDist[id]} hops from the Shardfall${id === f.road ? `; ${f.roadFromElite} from the Elite` : ''})`).join('; ')}`);
  L.push(`  Rest: ${f.rests.map((id) => label(s, id)).join('; ')}; Trainer ${f.trainer.join(',')}; Dungeon ${f.dungeon}`);
  L.push(`  Cull sites (board slot 1): ${f.sites.join(', ') || 'none'}; non-site Quest/Grind in rings 1-2 by hops (S1-S4 slots): ${f.scriptSlots.join(', ')}`);
  return L.join('\n');
}

function main(argv) {
  const opt = { from: 1, count: 5000, top: 5, seed: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--json') opt.json = true;
    else if (['--from', '--count', '--top', '--seed'].includes(k)) opt[k.slice(2)] = Number(argv[++i]);
    else throw new Error(`unknown option ${k}`);
  }
  if (opt.seed !== null) {
    const s = tutorialZone(opt.seed);
    const e = evaluate(s);
    console.log(opt.json ? JSON.stringify({ seed: opt.seed, ...e }, null, 1) : describe(opt.seed, s, e));
    return e.pass ? 0 : 1;
  }
  const ranked = scan(opt.from, opt.count);
  if (opt.json) {
    console.log(JSON.stringify({ from: opt.from, count: opt.count, passing: ranked.length, top: ranked.slice(0, opt.top) }, null, 1));
  } else {
    console.log(`Seeds ${opt.from}..${opt.from + opt.count - 1}: ${ranked.length} meet (a)-(e) (${((100 * ranked.length) / opt.count).toFixed(1)} %). Top ${Math.min(opt.top, ranked.length)}:`);
    for (const r of ranked.slice(0, opt.top)) console.log(describe(r.seed, tutorialZone(r.seed), r));
  }
  return ranked.length ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
