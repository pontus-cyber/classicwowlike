// Meta profiles (balance.md 1.4) and the campaign purchase rule. Profiles are built with the engine's
// newProfile/buyMeta where a purchase path exists; fixed profiles set unlock ranks directly.
import { C, R } from './engine.mjs';

const CLASS_SKILL = { rogue: 'sp_r1', mage: 'sp_m1', hunter: 'sp_h1' };

/**
 * Standard purchase order (balance.md 1.4): satchel, vigor 1, edge 1, quick_study 1, pockets 1, ledger, scout,
 * vigor 2, edge 2, sp_(class)1, cache, keen 1, quick_study 2, second_breath (when its requirement is met), then
 * cheapest remaining first. Entries are [id, rank]. (M2 v4: wayfinder left the catalogue and the order; P10 is
 * unchanged, Wayfinder was entry 13.)
 */
export function standardOrder(classId) {
  return [
    ['satchel', 1], ['vigor', 1], ['edge', 1], ['quick_study', 1], ['pockets', 1], ['ledger', 1], ['scout', 1],
    ['vigor', 2], ['edge', 2], [CLASS_SKILL[classId], 1], ['cache', 1], ['keen', 1],
    ['quick_study', 2], ['second_breath', 1],
  ];
}

/** Profile by name: fresh | p0 (no unlocks), metaN | pN (first N entries of the standard order), all | pall. */
export function buildProfile(name, classId) {
  const p = R.newProfile();
  const n = String(name || 'fresh').toLowerCase();
  if (n === 'fresh' || n === 'p0' || n === 'meta0') return p;
  if (n === 'all' || n === 'pall' || n === 'metaall') {
    for (const m of Object.values(C.META)) p.unlocks[m.id] = m.ranks;
    // A complete catalogue implies the boss was reached and killed (oaths, second_breath need it).
    p.reachedBoss = true;
    p.bossKills = 1;
    p.firstKill = { rogue: true, mage: true, hunter: true };
    return p;
  }
  const m = n.match(/^(?:meta|p)(\d+)$/);
  if (!m) throw new Error(`unknown profile ${name} (fresh, metaN, all)`);
  const order = standardOrder(classId).slice(0, Number(m[1]));
  for (const [id, rank] of order) {
    p.unlocks[id] = Math.max(p.unlocks[id] || 0, rank);
    if (id === 'second_breath') p.reachedBoss = true;
  }
  return p;
}

/** Profile name for reports: P0, P10, PALL. */
export function profileLabel(name) {
  const n = String(name).toLowerCase();
  if (n === 'fresh' || n === 'p0' || n === 'meta0') return 'P0';
  if (n === 'all' || n === 'pall' || n === 'metaall') return 'PALL';
  const m = n.match(/^(?:meta|p)(\d+)$/);
  return m ? `P${m[1]}` : name;
}

/** Every catalogue entry at max rank. */
export function catalogueComplete(profile) {
  return Object.values(C.META).every((m) => (profile.unlocks[m.id] || 0) >= m.ranks);
}

/** The next purchase of the campaign rule, or null (balance.md 1.4, "Campaign"). */
export function nextPurchase(profile, classId) {
  const offers = R.metaOffers(profile);
  const offer = (id) => offers.find((o) => o.id === id);
  for (const [id, rank] of standardOrder(classId)) {
    if ((profile.unlocks[id] || 0) >= rank) continue;
    // Not in this engine's catalogue: skipped. Not yet available (second_breath before the boss was reached):
    // skipped until its requirement is met.
    const o = offer(id);
    if (!o || !o.available) continue;
    return id;
  }
  const rest = offers.filter((o) => o.available).sort((a, b) => a.nextCost - b.nextCost || (a.id < b.id ? -1 : 1));
  return rest.length ? rest[0].id : null;
}

/** Buy in the standard order while affordable; the next entry in order blocks later ones. Returns { profile, bought }. */
export function campaignBuy(profile, classId) {
  let p = profile;
  const bought = [];
  for (;;) {
    const id = nextPurchase(p, classId);
    if (!id) break;
    const o = R.metaOffers(p).find((x) => x.id === id);
    if (p.echoes < o.nextCost) break;
    p = R.buyMeta(p, id);
    bought.push(id);
  }
  return { profile: p, bought };
}
