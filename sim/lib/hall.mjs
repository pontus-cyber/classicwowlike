// Hall arms for the Legacy cells (D164, docs/specs/legacy-hall-v3-draft.md sections 2, 5, 7; arm LH1): the v2 hall (the
// engine's C.META_HERO as built), the v3 hall and its fallback, played by sim-side overrides only. The engine's hall is
// read per run from C.META_HERO (metaFromProfile: rank x hpPct / powerPct / slots), so an arm sets those three fields on
// that table before each run and the profile's unlocks say what is owned. No engine file changes; a cell without
// `cell.hall` resets the fields to the engine's values (a worker plays runs of several cells).
//
// What an arm changes (nothing else does): Vigor and Edge per-rank values, Deeper Pockets slots, and the prices the
// chain (hallChain) uses. Second Breath, Stormhawk and the Cartographer have no effect to override: Second Breath and
// Stormhawk change price only; the Cartographer's C1 (Region Charts free, dungeon marked on arrival) is what the engine
// already plays with the entry (contracts.js ownedPerks: Charts owned, no camp point; expedition.js knowledge: the dungeon
// is known with Charts), and the Roads are always on the planner's map view (mapView `roads`), so the exit marks of C1
// add nothing the planner lacks.
//
//   cell.hall = '<arm>' (every hall entry at its top rank for the class) or '<arm>:<id><rank>,<id><rank>...' (a stage of
//   the campaign: only those entries; tech1 / tech2 = the class's two Lost Techniques). arm: none | v2 | v3 | v3fb. 'none' is the profile with nothing bought.
import { C } from './engine.mjs';

/** Engine values as built (read once at load, before any cell sets an arm). */
const ORIG = Object.freeze({
  vigor: [...Array(C.META_HERO.vigor.ranks)].map(() => C.META_HERO.vigor.hpPct),
  edge: [...Array(C.META_HERO.edge.ranks)].map(() => C.META_HERO.edge.powerPct),
  slots: C.META_HERO.pockets.slots,
});

/**
 * Arms. vigor / edge: the value of rank 1, rank 2 (v2: the engine's +0.01 each). slots: Deeper Pockets. price: per-id
 * overrides of the engine's prices (rank list). legacy-hall-v3-draft.md 2 (S2, P1, B, H) and its fallback line in 5
 * (Vigor II +2 %, Edge II +1 %, prices unchanged).
 */
export const HALL_ARMS = {
  none: null,
  v2: { vigor: ORIG.vigor, edge: ORIG.edge, slots: ORIG.slots, price: {} },
  v3: { vigor: [0.05, 0.03], edge: [0.04, 0.02], slots: 8, price: { vigor: [70, 100], edge: [70, 100], pockets: [50], second_breath: [150], stormhawk: [90] } },
  v3fb: { vigor: [0.05, 0.02], edge: [0.04, 0.01], slots: 8, price: { vigor: [70, 100], edge: [70, 100], pockets: [50], second_breath: [150], stormhawk: [90] } },
  // v3c: a calibration arm for the +4 pp gate (about 1.35 pp a point of HP % plus Power % over v2, from v3 and v3fb): Vigor +3 / +1, Edge +2 / +1.
  v3c: { vigor: [0.03, 0.01], edge: [0.02, 0.01], slots: 8, price: { vigor: [70, 100], edge: [70, 100], pockets: [50], second_breath: [150], stormhawk: [90] } },
  // v3d (Lead): v3c effects with the v2 prices of Vigor II, Edge II (130) and Second Breath (200); Pockets 50, Stormhawk 90. v3e: v3d with Stormhawk 150, Pockets 40 (the v2 price list with v3c effects and 8 slots).
  v3d: { vigor: [0.03, 0.01], edge: [0.02, 0.01], slots: 8, price: { vigor: [70, 130], edge: [70, 130], pockets: [50], second_breath: [200], stormhawk: [90] } },
  v3e: { vigor: [0.03, 0.01], edge: [0.02, 0.01], slots: 8, price: { vigor: [70, 130], edge: [70, 130], pockets: [40], second_breath: [200], stormhawk: [150] } },
  // Attribution arms (what moved the win rate): v3's stat ranks with today's four slots, and today's stat ranks with eight slots.
  v3s: { vigor: [0.05, 0.03], edge: [0.04, 0.02], slots: ORIG.slots, price: { vigor: [70, 100], edge: [70, 100], pockets: [50], second_breath: [150], stormhawk: [90] } },
  v3p: { vigor: ORIG.vigor, edge: ORIG.edge, slots: 8, price: { vigor: [70, 100], edge: [70, 100], pockets: [50], second_breath: [150], stormhawk: [90] } },
};

/** The hall's ids a class can own: the 13 account entries and the class's two techniques (and its hawk for the Hunter). */
const CLASS_TECH = { rogue: ['sp_r1', 'sp_r2'], mage: ['sp_m1', 'sp_m2'], hunter: ['sp_h1', 'sp_h2'] };
export const ALL_TECH = ['sp_r1', 'sp_r2', 'sp_m1', 'sp_m2', 'sp_h1', 'sp_h2'];
/** Entries a class can buy, ranks at the top; Oaths (a challenge, needs a kill) and other classes' techniques are left out. */
export function hallIds(cls) {
  return Object.values(C.META_HERO).filter((m) => m.id !== 'oaths' && !(ALL_TECH.includes(m.id) && !CLASS_TECH[cls].includes(m.id)) && (m.id !== 'stormhawk' || cls === 'hunter'));
}

/** Parses '<arm>' or '<arm>:vigor1,edge1,...' into { arm, owned: null | { id: rank } }. */
export function parseHall(spec) {
  if (!spec || spec === 'none') return { arm: 'none', owned: null };
  let [arm, list] = String(spec).split(':');
  // '<arm>-nt': the whole hall without the Lost Techniques (the Hunter's lose win rate with them at hero 20, report LH1 section 4)
  const nt = arm.endsWith('-nt');
  if (nt) arm = arm.slice(0, -3);
  if (!(arm in HALL_ARMS)) throw new Error(`--hall: unknown arm ${arm} (${Object.keys(HALL_ARMS).join(', ')})`);
  if (!list) return { arm, owned: null, noTech: nt };
  const owned = {};
  for (const t of list.split(',').filter(Boolean)) {
    const m = t.match(/^([a-z_0-9]+?)(\d)$/);
    // 'tech1' / 'tech2': the class's first / second Lost Technique (resolved per class by hallUnlocks)
    if (!m || (m[1] !== 'tech' && !C.META_HERO[m[1]])) throw new Error(`--hall: unknown entry ${t}`);
    owned[m[1]] = Math.max(owned[m[1]] || 0, Number(m[2]));
  }
  return { arm, owned };
}

/** The unlocks of a hall spec for a class: the whole hall at top ranks, or the named stage; Oaths never. */
export function hallUnlocks(spec, cls) {
  const { arm, owned, noTech } = parseHall(spec);
  if (arm === 'none') return {};
  if (noTech) return Object.fromEntries(hallIds(cls).filter((m) => !ALL_TECH.includes(m.id)).map((m) => [m.id, m.ranks]));
  if (owned) {
    const { tech, ...rest } = owned;
    const [t1, t2] = CLASS_TECH[cls];
    return { ...rest, ...(tech >= 1 ? { [t1]: 1 } : {}), ...(tech >= 2 ? { [t2]: 1 } : {}) };
  }
  return Object.fromEntries(hallIds(cls).map((m) => [m.id, m.ranks]));
}

/** Sets C.META_HERO's three effect fields for the arm and the ranks the profile owns (vigor rank r: mean of its first r values). */
export function applyHall(spec, unlocks = {}) {
  const { arm } = parseHall(spec);
  const a = HALL_ARMS[arm] || HALL_ARMS.v2; // 'none' and no cell.hall: the engine's values
  const mean = (v, r) => (r > 0 ? v.slice(0, r).reduce((x, y) => x + y, 0) / r : v[0]);
  C.META_HERO.vigor.hpPct = mean(a.vigor, Math.min(unlocks.vigor || 0, a.vigor.length));
  C.META_HERO.edge.powerPct = mean(a.edge, Math.min(unlocks.edge || 0, a.edge.length));
  C.META_HERO.pockets.slots = a.slots;
}

/** A profile with the hall of the spec bought for the class (nothing spent: the cell plays the effects). */
export function withHall(profile, spec, cls) {
  const { arm } = parseHall(spec);
  if (arm === 'none') return profile;
  const p = { ...profile, unlocks: { ...profile.unlocks, ...hallUnlocks(spec, cls) } };
  if (p.unlocks.second_breath) p.reachedBoss = true; // Second Breath needs Oruvath reached once (4.2)
  return p;
}

/** Prices of an arm: the engine's costs with the arm's overrides, by id (rank list). */
export function pricesOf(arm) {
  const a = HALL_ARMS[arm];
  return Object.fromEntries(Object.values(C.META_HERO).map((m) => [m.id, (a && a.price[m.id]) || m.costs]));
}

/**
 * The campaign buying order (docs/specs/legacy-hall-v3-draft.md 3, legacy.md 5.8 item 7), entries [id, rank]: Satchel, Vigor
 * I, Edge I, Quick Study I, the class's first technique, Pockets, Cartographer, Vigor II, Edge II, Old Hand, Quartermaster I,
 * Quick Study II, Swift Boots, Quartermaster II, the second technique (from hero level TECH2_LEVEL), Second Breath (once
 * Oruvath is reached). 'tech' is the class's Lost Technique of that rank (parseHall). The Hunter's hawk is left out (priced
 * in the hall total only). Bought in order; an entry that is not yet available is skipped, the rest follow.
 */
export const TECH2_LEVEL = 17;
export const BUY_ORDER = [['satchel', 1], ['vigor', 1], ['edge', 1], ['quick_study', 1], ['tech', 1], ['pockets', 1], ['cartographer', 1],
  ['vigor', 2], ['edge', 2], ['old_hand', 1], ['quartermaster', 1], ['quick_study', 2], ['swift_boots', 1], ['quartermaster', 2],
  ['tech', 2], ['second_breath', 1]];
/** Price of an order entry under an arm (a technique: the engine's sp_r1 / sp_r2 price, the same for the three classes). */
export function priceOf(arm, id, rank) {
  const P = pricesOf(arm);
  return (id === 'tech' ? P[rank === 1 ? 'sp_r1' : 'sp_r2'] : P[id])[rank === 1 || id !== 'tech' ? rank - 1 : 0];
}
