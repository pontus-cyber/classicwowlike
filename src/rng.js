// Seeded random numbers for the rules engine (rules.md section 0, "RNG" and "Streams").
//
// - hash32(str): 32-bit string hash (FNV-1a over UTF-16 code units, then the murmur3 fmix32 finalizer).
// - Stream seed = hash32 of the listed keys joined with '|', e.g. map(z) = hash32(`${runSeed}|map|${z}`).
// - Generator: sfc32 (Small Fast Counter, 128-bit state). Its state is a plain array of four uint32
//   numbers, so it lives inside the JSON game state and serialises with it.
// - All functions that draw advance the given state array in place. The engine only ever passes arrays
//   that belong to its own private clone of the game state, so step() stays pure.
//
// Streams (rules.md section 0):
//   map(z)           zone map (types)                 node(z,r,l)  node setup (make-up, quest, stock)
//   fight(z,r,l,k)   combat of fight k in a node      loot(z,r,l)  all drops and rewards of a node
//   boss             end boss fight                   bot          reserved for simulator bots (balance.md 1)
// Hub and camp use row 0; the camp is zone ZONE_COUNT + 1 (see docs/specs/engine-api.md).
// Expedition map (rules 1.9): node ids replace (row, lane): nodeId(z,id), fightId(z,id,k), lootId(z,id) hash the keys
// "node", "fight", "loot" with the node id, and dim(z,id,n) is the n-th Dimmed encounter at node id (make-up, then
// its fight). The hub is id 0.
// Dev tools (engine-api.md 12, dev only): dev(n,k) is the n-th encounter a dev tool starts (k 0: its fight, 1: its loot).

/** 32-bit hash of a string. Returns an unsigned 32-bit integer. */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Seed of a stream from its keys: hash32(keys.join('|')). */
export function streamSeed(...keys) {
  return hash32(keys.join('|'));
}

function splitmix32(x) {
  let z = (x + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

/** New generator state (array of 4 uint32) from a 32-bit seed. */
export function makeRng(seed32) {
  const a = splitmix32(seed32 >>> 0);
  const b = splitmix32(a);
  const c = splitmix32(b);
  const s = [a, b, c, 1];
  for (let i = 0; i < 12; i++) nextU32(s);
  return s;
}

/** Next unsigned 32-bit integer; advances s in place (sfc32). */
export function nextU32(s) {
  const a = s[0] | 0, b = s[1] | 0, c = s[2] | 0, d = s[3] | 0;
  const t = (((a + b) | 0) + d) | 0;
  s[3] = (d + 1) >>> 0;
  s[0] = (b ^ (b >>> 9)) >>> 0;
  s[1] = (c + (c << 3)) >>> 0;
  const c2 = (c << 21) | (c >>> 11);
  s[2] = (c2 + t) >>> 0;
  return t >>> 0;
}

/** Uniform float in [0, 1). */
export function nextFloat(s) {
  return nextU32(s) / 4294967296;
}

/** Uniform integer in 0..n-1 (n >= 1): floor(draw × n). */
export function nextInt(s, n) {
  return Math.floor(nextFloat(s) * n);
}

/** Index drawn by weight (one draw). Zero weights are never picked. Returns -1 if all weights are 0. */
export function weightedIndex(s, weights) {
  let total = 0;
  for (const w of weights) total += w;
  const x = nextFloat(s) * total;
  if (total <= 0) return -1;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (x < acc && weights[i] > 0) return i;
  }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return -1;
}

/** Named streams. Each returns a fresh generator state for its keys. */
export const STREAM = {
  map: (seed, z) => makeRng(streamSeed(seed, 'map', z)),
  node: (seed, z, r, l) => makeRng(streamSeed(seed, 'node', z, r, l)),
  fight: (seed, z, r, l, k) => makeRng(streamSeed(seed, 'fight', z, r, l, k)),
  loot: (seed, z, r, l) => makeRng(streamSeed(seed, 'loot', z, r, l)),
  boss: (seed) => makeRng(streamSeed(seed, 'boss')),
  bot: (seed) => makeRng(streamSeed(seed, 'bot')),
  // Expedition map (rules 1.9): keyed by node id.
  nodeId: (seed, z, id) => makeRng(streamSeed(seed, 'node', z, id)),
  fightId: (seed, z, id, k) => makeRng(streamSeed(seed, 'fight', z, id, k)),
  lootId: (seed, z, id) => makeRng(streamSeed(seed, 'loot', z, id)),
  dim: (seed, z, id, n) => makeRng(streamSeed(seed, 'dim', z, id, n)),
  // Start camp and contracts (expedition.md 2.2, 3.6): the board after k rerolls, the hub contract of zone z.
  prep: (seed, k) => makeRng(streamSeed(seed, 'prep', k)),
  hubc: (seed, z) => makeRng(streamSeed(seed, 'hubc', z)),
  // Dev tools (engine-api.md 12): the n-th dev encounter of a run, k 0 = its fight, 1 = its loot.
  dev: (seed, n, k) => makeRng(streamSeed(seed, 'dev', n, k)),
};

/** Normalise a run seed to an unsigned 32-bit integer. Throws on non-integers. */
export function normaliseSeed(seed) {
  if (typeof seed !== 'number' || !Number.isInteger(seed)) {
    throw new Error(`seed must be an integer, got ${JSON.stringify(seed)}`);
  }
  return seed >>> 0;
}
