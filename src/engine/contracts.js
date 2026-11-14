// Start camp and contracts of an expedition run (docs/specs/expedition.md 2 and 3, task M2b 2b.5; marked "(prep)" in
// engine-api.md). PREP: preparation points (PREP_POINTS + Quartermaster ranks, meta), the contract board (stream prep(k),
// k = rerolls), supplies and vision perks (each bought once), Reserve, SET_OUT, and prepView for the prep screen.
// Contracts: sites placed when the zone is generated (stream map(z), continued after the node types, 3.3) and when the
// hub contract is taken, progress when a site's node is won, the reward paid at once (XP without the level-difference
// modifier since M2b v10, gold, an item choice on the tables "contract" / "bounty", heat of the node included), expiry
// when the zone is left, the hub contract (stream hubc(z), 3.6: from Reserve or by a swap), and contractView for the
// tracker. D128 (owner playtest 2026-11-12 20:19, a lean start camp): the board holds CONTRACT_BOARD_SIZE 3 offers,
// REROLL_BOARD only with GATES.campReroll (off), and the camp offers only PREP_CAMP_OPTIONS (the other options keep their
// rules but cannot be bought). D132: the offers are drawn across the run, one from each band of CONTRACT_BOARD_BANDS
// (zones 1-2, 3-4, 5-6) while GATES.boardAcrossRun is on (the default); off, zones 1-3 (D128). Pure helpers of the state; nodes.js calls
// them from the run flow, actions.js checks legality. M3 guided run (tutorial.js fixBoard): board slot 1 is fixed. Only a run created with newRun({ mapMode: 'expedition', prep: true })
// uses it; a rows run, or an expedition run without the option, never does.
import {
  ZONE_COUNT, ZONE_LEVELS, PREP_POINTS, PREP_POINTS_PER_QM, PREP_ECHO_PER_POINT, CONTRACT_BOARD_SIZE, CONTRACT_BOARD_BANDS, CONTRACT_BOARD_FIRST_BANDS,
  CONTRACT_SLOTS,  REROLL_PRICE, REROLL_MAX, CULL_SITES, CULL_SITE_SPARE, CULL_SITE_IN, CULL_SITE_OUT, BOUNTY_PLACED,
  CONTRACT_CL_OFFSET, PREP_OPTION, PREP_OPTION_IDS, PREP_CAMP_OPTIONS, CONTRACT, CONTRACT_KINDS, META, BELL_MAX_CHARGES,
  GUIDE_RADIUS_BONUS, TRACKER_RADIUS, EMBER_MAX_CARRIED, XP_WEIGHT_MULT, DROP_TABLE, RARITY_ORDER, GATES,
} from '../constants.js';
import { STREAM, nextFloat, nextInt, weightedIndex } from '../rng.js';
import { zoneContent } from './content.js';
import { validEncounter, clampCl } from './map.js';
import { flatXp, gainXp, gainGold } from './progress.js';
import { V, rollDrop, makeConsumable, addToBag, countConsumable } from './items.js';
import { zoneRegions, setupExpNode, xpWeight } from './expedition.js';
import { fixBoard } from './tutorial.js';

// ---------------- Preparation points and the board (expedition.md 2.1, 2.2) ----------------
/** Ranks of an expedition catalogue entry the profile owns (META, mapMode 'expedition'; capped at its ranks). */
const metaRank = (profile, id) => Math.min(((profile && profile.unlocks) || {})[id] || 0, META[id].ranks);
/** prepPoints = PREP_POINTS + PREP_POINTS_PER_QM × Quartermaster ranks (expedition.md 2.1). */
export const prepPoints = (profile) => PREP_POINTS + PREP_POINTS_PER_QM * metaRank(profile, 'quartermaster');
/** The contract level CL_c = ZONE_LEVELS × (z - 1) + CONTRACT_CL_OFFSET (the zone's rim level 10z - 2, expedition.md 3.1, M2b v10). */
export const contractLevel = (z) => ZONE_LEVELS * (z - 1) + CONTRACT_CL_OFFSET;

/**
 * One contract offer of zone z (expedition.md 2.2), draws on `rng` in this order: the kind by weight; Cull and Bounty
 * then the target region (uniform over the zone's regions, content order) and its family (uniform over the region's
 * families; always one draw); a Bounty then its elite: a rare template of the zone of that family, else of any family
 * (engine default, content to confirm). Delve targets the zone's dungeon (no region, no family).
 */
export function drawOffer(c, rng, z) {
  const kind = CONTRACT_KINDS[weightedIndex(rng, CONTRACT_KINDS.map((k) => CONTRACT[k].weight))];
  const o = { z, kind, region: null, family: null, template: null, need: CONTRACT[kind].sites, price: CONTRACT[kind].price };
  if (kind === 'delve') return o;
  const regs = zoneRegions(c, z);
  o.region = nextInt(rng, regs.length);
  const fams = regs[o.region].families;
  const f = nextInt(rng, Math.max(1, fams.length));
  o.family = fams.length ? fams[f] : null;
  if (kind === 'bounty') {
    const rares = zoneContent(c, z).rares;
    const own = rares.filter((t) => c.enemies[t].family === o.family);
    const list = own.length ? own : rares;
    o.template = list[nextInt(rng, list.length)];
  }
  return o;
}

/** Two offers are the same contract: zone, kind, target region and family, and a Bounty's elite (expedition.md 2.2). */
export const sameOffer = (a, b) => a.z === b.z && a.kind === b.kind && a.region === b.region && a.family === b.family && a.template === b.template;

/**
 * Every offer a board slot can draw over zones `zs` (each 1 / zs.length), with its chance in drawOffer: kind by weight,
 * region uniform, family uniform (null without), a Bounty's elite uniform over its list. Order: zone, kind
 * (CONTRACT_KINDS), region (content order), family (region order), elite (list order). Used only to replace a repeat.
 */
function offerOdds(c, zs) {
  const kw = CONTRACT_KINDS.map((k) => CONTRACT[k].weight);
  const sum = kw.reduce((a, b) => a + b, 0);
  const out = [];
  for (const z of zs) {
    CONTRACT_KINDS.forEach((kind, ki) => {
      const pk = kw[ki] / sum / zs.length;
      if (kind === 'delve') { out.push({ o: { z, kind, region: null, family: null, template: null }, p: pk }); return; }
      const regs = zoneRegions(c, z);
      regs.forEach((reg, region) => {
        const fams = reg.families.length ? reg.families : [null];
        for (const family of fams) {
          const p = pk / regs.length / fams.length;
          if (kind !== 'bounty') { out.push({ o: { z, kind, region, family, template: null }, p }); continue; }
          const rares = zoneContent(c, z).rares;
          const own = rares.filter((t) => c.enemies[t].family === family);
          const list = own.length ? own : rares;
          for (const template of list) out.push({ o: { z, kind, region, family, template }, p: p / list.length });
        }
      });
    });
  }
  return out;
}

/**
 * The zone band [lo, hi] of board slot i (expedition.md 2.2): with GATES.boardAcrossRun (D132, on) CONTRACT_BOARD_BANDS[i];
 * off (the D128 board) the zone i + 1 alone while i < ZONE_COUNT; a slot past those draws from 1..ZONE_COUNT. first
 * (D150): a profile's first run, CONTRACT_BOARD_FIRST_BANDS[i] (zone 1) whatever the switch.
 */
export function boardBand(i, first = false) {
  if (first) return CONTRACT_BOARD_FIRST_BANDS[i] || [1, 1];
  if (GATES.boardAcrossRun) return CONTRACT_BOARD_BANDS[i] || [1, ZONE_COUNT];
  return i < ZONE_COUNT ? [i + 1, i + 1] : [1, ZONE_COUNT];
}

/**
 * A profile's first run (D150, cut list item 15): no run completed on the profile (`runs` 0; a dev run does not count,
 * meta.js applyRunToProfile). Its start camp offers only CONTRACT_BOARD_FIRST_BANDS (one zone 1 contract).
 */
export const firstRun = (s) => !(s.profile && s.profile.runs > 0);
/** Offers on the board of this run (D150): CONTRACT_BOARD_FIRST_BANDS.length on a first run, else CONTRACT_BOARD_SIZE. */
export const boardSize = (s) => (firstRun(s) ? CONTRACT_BOARD_FIRST_BANDS.length : CONTRACT_BOARD_SIZE);

/**
 * The board after k rerolls (stream prep(k), 2.2): `size` slots (boardSize: CONTRACT_BOARD_SIZE, 3 since D128; D150: one,
 * zone 1, on a profile's first run, with the bands of CONTRACT_BOARD_FIRST_BANDS). Slot i first takes
 * its zone from its band (boardBand: one uniform draw when the band holds more than one zone, none for a single zone),
 * then draws its offer. D132 (GATES.boardAcrossRun on): one offer each from zones 1-2, 3-4 and 5-6; off: zones 1, 2, 3 as
 * D128 drew them (no zone draw). `kept` (REROLL_BOARD): the taken offers by slot; such a slot still makes its draws and
 * keeps its offer. No two offers on a board are the same contract: a slot whose offer equals one already on the board (an
 * earlier slot or a kept offer) takes instead one weighted draw over the offers it can draw (its band's zones, each
 * 1 / band size) that are not on the board, each with its chance in the normal draw (offerOdds); with none left the offer
 * stays. A board without a repeat is drawn as before this rule (2026-11-11). `size` is a parameter for the tests.
 */
export function drawBoard(s, k, kept = [], size = boardSize(s)) {
  const rng = STREAM.prep(s.seed, k);
  const first = firstRun(s);
  const out = [];
  for (let i = 0; i < size; i++) {
    const [lo, hi] = boardBand(i, first);
    const z = lo === hi ? lo : lo + nextInt(rng, hi - lo + 1);
    let o = drawOffer(s.content, rng, z);
    if (kept[i]) { out.push(kept[i]); continue; }
    const board = [...out, ...kept.slice(i + 1).filter(Boolean)];
    if (board.some((b) => sameOffer(b, o))) {
      const zs = Array.from({ length: hi - lo + 1 }, (_, j) => lo + j);
      const free = offerOdds(s.content, zs).filter((x) => !board.some((b) => sameOffer(b, x.o)));
      if (free.length) {
        const pick = free[weightedIndex(rng, free.map((x) => x.p))].o;
        o = { ...pick, need: CONTRACT[pick.kind].sites, price: CONTRACT[pick.kind].price };
      }
    }
    out.push({ index: i, ...o, taken: false });
  }
  return out;
}

/**
 * Vision perks the run owns without buying them (expedition.md 2.4): from meta (Cartographer: Region Charts, Old Hand:
 * Tracker's Notes; catalogue entries since the M2b v11 build) or from newRun's `vision` option (charts, guide; a test and
 * measurement option).
 */
export function ownedPerks(s) {
  const out = [];
  const v = (s.create && s.create.vision) || {};
  if (metaRank(s.profile, 'cartographer') > 0 || v.charts) out.push('prep_charts');
  if (metaRank(s.profile, 'old_hand') > 0) out.push('prep_tracker');
  if (v.guide) out.push('prep_guide');
  return out;
}

/** PREP at START_RUN of an expedition run: the budget, the board of prep(0), nothing bought. */
export function newPrep(s) {
  s.prep = { points: prepPoints(s.profile), board: drawBoard(s, 0), rerolls: 0, bought: [], done: false };
  fixBoard(s); // M3 guided run (m3-onboarding.md 2.3 "Board"): slot 1 is the content's Cull; the board's draws stay
}

/** Held contracts (taken, not complete, expired or abandoned), PREP and hubs together (expedition.md 3.5). */
export const heldCount = (s) => (s.exp && s.exp.contracts ? s.exp.contracts.filter((c) => c.state === 'held').length : 0);

/** Points spent at PREP: bought options, contracts taken from the board, rerolls. */
export function prepSpent(s) {
  const p = s.prep;
  return p.bought.reduce((n, id) => n + PREP_OPTION[id].price, 0) + p.board.filter((o) => o.taken).reduce((n, o) => n + o.price, 0) + p.rerolls * REROLL_PRICE;
}
export const prepLeft = (s) => s.prep.points - prepSpent(s);

// ---------------- PREP actions: legality (actions.js) and effects ----------------
const inPrep = (s) => (s.phase !== 'PREP' || !s.prep || s.prep.done ? 'only at the start camp (PREP)' : null);

export function takeContractError(s, i) {
  const e = inPrep(s);
  if (e) return e;
  const o = Number.isInteger(i) ? s.prep.board[i] : null;
  if (!o) return `no contract ${i} on the board`;
  if (o.taken) return 'already taken';
  if (heldCount(s) >= CONTRACT_SLOTS) return `at most ${CONTRACT_SLOTS} contracts at once`;
  return o.price > prepLeft(s) ? 'not enough preparation points' : null;
}
export function dropContractError(s, i) {
  const e = inPrep(s);
  if (e) return e;
  const o = Number.isInteger(i) ? s.prep.board[i] : null;
  return !o ? `no contract ${i} on the board` : !o.taken ? 'not taken' : null;
}
export function buyPrepError(s, id) {
  const e = inPrep(s);
  if (e) return e;
  const o = PREP_OPTION[id];
  if (!o) return `unknown option ${id}`;
  if (!PREP_CAMP_OPTIONS.includes(id)) return 'not offered at the start camp'; // D128
  if (ownedPerks(s).includes(id)) return 'already owned';
  if (s.prep.bought.includes(id)) return 'already bought';
  if (id === 'prep_bell' && s.exp.bell >= BELL_MAX_CHARGES) return `the Homeward Bell holds at most ${BELL_MAX_CHARGES} charges`;
  if (o.item === 'ember_of_return' && countConsumable(s, 'ember_of_return') >= EMBER_MAX_CARRIED) return `you can carry at most ${EMBER_MAX_CARRIED}`;
  return o.price > prepLeft(s) ? 'not enough preparation points' : null;
}
export function sellPrepError(s, id) {
  return inPrep(s) || (!s.prep.bought.includes(id) ? `${id} is not bought` : null);
}
export function rerollError(s) {
  const e = inPrep(s);
  if (e) return e;
  if (!GATES.campReroll) return 'no reroll at the start camp'; // D128
  if (s.prep.rerolls >= REROLL_MAX) return `at most ${REROLL_MAX} rerolls`;
  if (s.prep.board.every((o) => o.taken)) return 'every contract is taken';
  return REROLL_PRICE > prepLeft(s) ? 'not enough preparation points' : null;
}

/** A contract held from an offer (board or hub). */
function holdContract(s, ev, o, from) {
  const c = {
    id: `k${s.exp.nextContract++}`, z: o.z, kind: o.kind, region: o.region, family: o.family, template: o.template,
    need: o.need, price: o.price, from, board: from === 'board' ? o.index : null, state: 'held', progress: 0, sites: [],
  };
  s.exp.contracts.push(c);
  ev.push({ t: 'contract', what: 'take', id: c.id, z: c.z, kind: c.kind, from });
  return c;
}

/** TAKE_CONTRACT(i) at PREP: costs the price; the contract is held. */
export function takeContract(s, ev, i) {
  const o = s.prep.board[i];
  o.taken = true;
  holdContract(s, ev, o, 'board');
}
/** DROP_CONTRACT(i) at PREP: refunds the price; the offer is back on the board. */
export function dropContract(s, ev, i) {
  const o = s.prep.board[i];
  o.taken = false;
  const k = s.exp.contracts.findIndex((c) => c.state === 'held' && c.from === 'board' && c.board === i);
  const [c] = s.exp.contracts.splice(k, 1);
  ev.push({ t: 'contract', what: 'drop', id: c.id, z: c.z, kind: c.kind });
}
export function buyPrep(s, ev, id) {
  s.prep.bought.push(id);
  ev.push({ t: 'prep', what: 'buy', id, left: prepLeft(s) });
}
export function sellPrep(s, ev, id) {
  s.prep.bought = s.prep.bought.filter((x) => x !== id);
  ev.push({ t: 'prep', what: 'sell', id, left: prepLeft(s) });
}
/** REROLL_BOARD: every offer not taken is replaced by the same slot of the board of prep(k + 1), drawn around the taken ones. */
export function rerollBoard(s, ev) {
  s.prep.rerolls += 1;
  s.prep.board = drawBoard(s, s.prep.rerolls, s.prep.board.map((o) => (o.taken ? o : null)));
  fixBoard(s);
  ev.push({ t: 'prep', what: 'reroll', k: s.prep.rerolls, left: prepLeft(s) });
}

/**
 * SET_OUT (expedition.md 2.1-2.6): the supplies go into the bag (what does not fit into the loot window), the Second
 * Clapper adds a Bell charge, the Pack Mule bag slots, the vision perks last the run (Region Charts, Tracker's Notes,
 * Local Guide's radius, the Spyglass's charges); unspent points become Reserve. nodes.js then enters zone 1.
 */
export function applySetOut(s, ev) {
  const p = s.prep;
  const x = s.exp;
  for (const id of p.bought) {
    const o = PREP_OPTION[id];
    if (o.slots) x.mule = true;
    if (o.bell) x.bell = Math.min(BELL_MAX_CHARGES, x.bell + o.bell);
    if (id === 'prep_charts') x.vision.regions = true;
    if (id === 'prep_tracker') x.vision.tracker = TRACKER_RADIUS;
    if (id === 'prep_guide') x.vision.radius += GUIDE_RADIUS_BONUS;
    if (id === 'prep_spyglass') x.spyglass = o.charges;
  }
  for (const id of p.bought) {
    const o = PREP_OPTION[id];
    if (!o.item) continue;
    const it = makeConsumable(s, o.item, o.qty);
    if (addToBag(s, it)) ev.push({ t: 'loot', item: { ...it }, to: 'bag' });
    else { s.loot.push(it); ev.push({ t: 'loot', item: { ...it }, to: 'window' }); }
  }
  x.reserve = prepLeft(s);
  p.done = true;
  s.stats.exp.preps = 1;
  ev.push({ t: 'prep', what: 'setOut', reserve: x.reserve, bought: p.bought.slice(), contracts: heldCount(s) });
}

// ---------------- Views ----------------
const regionName = (c, z, r) => (r === null ? null : zoneRegions(c, z)[r].name);
const enemyName = (c, t) => (t ? c.enemies[t].name : null);

/**
 * What a contract pays (expedition.md 3.1), before Quick Study, Insight, Prospector and heat: XP levels-worth at CL_c (no
 * level-difference modifier since M2b v10, so xpFrac × xpToNext(cl) is the XP paid), gold, item choice.
 */
export function rewardInfo(kind, z) {
  const k = CONTRACT[kind];
  const cl = contractLevel(z);
  const w = DROP_TABLE[k.table].weights;
  return {
    cl, xpFrac: k.xpFrac * XP_WEIGHT_MULT, gold: k.goldV * V(cl), choices: k.choices, table: k.table,
    rarity: Object.fromEntries(RARITY_ORDER.map((r, i) => [r, w[i]]).filter(([, x]) => x > 0)),
  };
}

/**
 * Offer as the prep screen and the hub show it (expedition.md 2.2, 9.1). reward.xp (M2b v10): the XP the contract pays
 * when completed now, before heat (Quick Study and an active Insight included; 0 at MAX_LEVEL).
 */
function offerView(s, o) {
  const c = s.content;
  const band = [ZONE_LEVELS * (o.z - 1) + 1, ZONE_LEVELS * o.z];
  const rw = rewardInfo(o.kind, o.z);
  return {
    z: o.z, zoneName: zoneContent(c, o.z).name, band, kind: o.kind, region: o.region, regionName: regionName(c, o.z, o.region),
    family: o.family, template: o.template, name: enemyName(c, o.template),
    dungeon: o.kind === 'delve' ? zoneContent(c, o.z).dungeon.name : null, need: o.need, price: o.price,
    reward: { ...rw, xp: flatXp(s, CONTRACT[o.kind].xpFrac * xpWeight(s), rw.cl) },
  };
}

/**
 * The prep screen (expedition.md 2, 9.1), null outside PREP: points (budget, spent, left), slots, the board (each offer
 * with take / drop legality), the options the camp offers (PREP_CAMP_OPTIONS since D128: supplies and vision perks with
 * price, owned, bought, buy / sell legality), rerolls (`open`: GATES.campReroll, off since D128), and Reserve (points left
 * and their Echo value at SUMMARY).
 */
export function prepView(s) {
  if (s.phase !== 'PREP' || !s.prep || s.prep.done) return null;
  const p = s.prep;
  const owned = ownedPerks(s);
  const left = prepLeft(s);
  return {
    points: p.points, spent: prepSpent(s), left, slots: CONTRACT_SLOTS, held: heldCount(s),
    board: p.board.map((o, i) => ({ index: i, ...offerView(s, o), taken: o.taken, canTake: !takeContractError(s, i), canDrop: !dropContractError(s, i) })),
    options: PREP_OPTION_IDS.filter((id) => PREP_CAMP_OPTIONS.includes(id)).map((id) => {
      const o = PREP_OPTION[id];
      return {
        id, name: o.name, kind: o.kind, price: o.price, owned: owned.includes(id), bought: p.bought.includes(id),
        canBuy: !buyPrepError(s, id), canSell: !sellPrepError(s, id), why: buyPrepError(s, id),
        ...(o.item ? { item: o.item, qty: o.qty } : {}), ...(o.bell ? { bell: o.bell } : {}), ...(o.slots ? { slots: o.slots } : {}),
        ...(o.charges ? { charges: o.charges } : {}),
      };
    }),
    reroll: { open: !!GATES.campReroll, used: p.rerolls, max: REROLL_MAX, price: REROLL_PRICE, can: !rerollError(s) },
    reserve: { points: left, echoes: left * PREP_ECHO_PER_POINT },
  };
}

/**
 * The contract tracker (expedition.md 9.3): every contract taken this run in the order taken, with zone, kind, target,
 * progress and status ('active': held, this zone; 'later': held, a later zone; 'complete', 'expired', 'abandoned'), and
 * the hub contract on offer (with the modes legal now). No site locations: those are on the map (mapView). null in a
 * rows run or before START_RUN.
 */
export function contractView(s, legal = () => false) {
  if (!s.exp || !s.exp.prep) return null;
  const z = s.zone && !s.zone.camp ? s.zone.z : null;
  const list = s.exp.contracts.map((k) => ({
    id: k.id, ...offerView(s, k), from: k.from, progress: k.progress,
    status: k.state !== 'held' ? k.state : k.z === z ? 'active' : 'later',
  }));
  const offer = z && s.zone.hubOffer && !s.zone.hubOffer.taken ? s.zone.hubOffer : null;
  return {
    slots: CONTRACT_SLOTS, held: heldCount(s), reserve: s.exp.reserve, contracts: list,
    hub: offer ? {
      ...offerView(s, offer),
      reserve: legal({ type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }),
      swap: s.exp.contracts.filter((k) => legal({ type: 'TAKE_HUB_CONTRACT', mode: 'swap', contractId: k.id })).map((k) => k.id),
    } : null,
  };
}

// ---------------- Sites (expedition.md 3.3) ----------------
const isSiteType = (kind, n) => (kind === 'cull' ? n.type === 'quest' || n.type === 'grind' : false);
const markSite = (zone, c, id) => {
  const n = zone.nodes[id];
  n.sites = [...(n.sites || []), c.id];
  c.sites.push(id);
};

/**
 * Make sure a Cull site's encounter has a mob of the target family (expedition.md 3.3): when none has, one draw picks
 * a zone normal of the family and it replaces the last mob, else the one before, the first replacement that keeps the
 * composition rules (rules 7.14); none: the encounter stays.
 */
function familyRepair(s, rng, n, family) {
  const c = s.content;
  if (!family) return;
  const mobs = n.type === 'quest' ? n.mobs : n.waves[0];
  if (mobs.some((t) => c.enemies[t].family === family)) return;
  const pool = zoneContent(c, s.zone.z).normals.filter((t) => c.enemies[t].family === family);
  if (!pool.length) return;
  const t = pool[nextInt(rng, pool.length)];
  for (let i = mobs.length - 1; i >= 0; i--) {
    const next = mobs.slice();
    next[i] = t;
    if (validEncounter(c, next)) {
      if (n.type === 'quest') n.mobs = next; else n.waves[0] = next;
      return;
    }
  }
}

/**
 * Place the sites of contract c in the current zone (expedition.md 3.3) on the zone's site stream (map(z) continued
 * after the node types). Cull: one draw per Quest or Grind node (id order) < CULL_SITE_IN in the target region, else
 * CULL_SITE_OUT; then, while fewer than CULL_SITES + CULL_SITE_SPARE, one draw adds a Quest or Grind node of the target
 * region; then the family repair of each site (id order). Bounty: BOUNTY_PLACED nodes of ring 2 or 3 in the target region
 * that are not the Dungeon, a Rest, a Road, the Shardfall or the Trainer (engine default: the Trainer guarantee stays)
 * and not a site yet, one draw each, become Elite nodes (set up again on node(z, id)) with the bounty's rare template; the
 * drawn elite is kept to come back when the bounty is done. Delve: the Dungeon (no draw).
 */
export function placeSites(s, c) {
  const zone = s.zone;
  const rng = zone.siteRng;
  const regs = zoneRegions(s.content, zone.z);
  const nodes = zone.nodes;
  if (c.kind === 'delve') {
    const d = nodes.find((n) => n.type === 'dungeon');
    if (d) markSite(zone, c, d.id);
    return;
  }
  if (c.kind === 'cull') {
    const picked = new Set();
    for (const n of nodes) {
      if (n.ring === 0 || !isSiteType('cull', n)) continue;
      if (nextFloat(rng) < (n.region === c.region ? CULL_SITE_IN : CULL_SITE_OUT)) picked.add(n.id);
    }
    for (;;) {
      if (picked.size >= CULL_SITES + CULL_SITE_SPARE) break;
      const cand = nodes.filter((n) => n.ring > 0 && n.region === c.region && isSiteType('cull', n) && !picked.has(n.id));
      if (!cand.length) break;
      picked.add(cand[nextInt(rng, cand.length)].id);
    }
    for (const id of [...picked].sort((a, b) => a - b)) {
      markSite(zone, c, id);
      familyRepair(s, rng, nodes[id], c.family);
    }
    return;
  }
  // Bounty
  for (let k = 0; k < BOUNTY_PLACED; k++) {
    const cand = nodes.filter((n) => (n.ring === 2 || n.ring === 3) && n.region === c.region && !n.road && !n.shardfall
      && !['dungeon', 'rest', 'trainer'].includes(n.type) && !(n.sites && n.sites.length));
    if (!cand.length) break;
    const n = cand[nextInt(rng, cand.length)];
    if (n.type !== 'elite') {
      for (const key of ['quest', 'mobs', 'waves', 'stock', 'boons', 'guard', 'trap']) delete n[key];
      n.type = 'elite';
      setupExpNode(s, zone.z, n, regs);
    }
    n.bounty = { normal: { elite: n.elite, rare: n.rare } };
    n.elite = c.template;
    n.rare = true;
    markSite(zone, c, n.id);
  }
}

/** A bounty site that was not won: back to the elite it was set up with (expedition.md 3.3: "a normal Elite"). */
function releaseBounty(zone, id) {
  const n = zone.nodes[id];
  if (!n.bounty) return;
  n.elite = n.bounty.normal.elite;
  n.rare = n.bounty.normal.rare;
  delete n.bounty;
}

/** Remove contract c's site marks (complete, expired, abandoned); unwon bounty sites become their normal elite. */
function clearSites(s, c) {
  const zone = s.zone;
  if (zone && !zone.camp && zone.z === c.z && zone.nodes) {
    for (const id of c.sites) {
      const n = zone.nodes[id];
      if (n.sites) n.sites = n.sites.filter((x) => x !== c.id);
      if (n.sites && !n.sites.length) delete n.sites;
      if (c.kind === 'bounty' && !n.done) releaseBounty(zone, id);
    }
  }
}

/** At zone generation (nodes.js enterZone): the hub contract offer (zones 2..ZONE_COUNT) and the sites of held contracts. */
export function contractsAtZone(s) {
  const zone = s.zone;
  zone.hubOffer = zone.z >= 2 ? { ...drawOffer(s.content, STREAM.hubc(s.seed, zone.z), zone.z), taken: false } : null;
  if (zone.hubOffer) s.stats.exp.hubOffers = (s.stats.exp.hubOffers || 0) + 1;
  for (const c of s.exp.contracts) if (c.state === 'held' && c.z === zone.z) placeSites(s, c);
}

// ---------------- The hub contract (expedition.md 3.6) ----------------
export function hubContractError(s, a) {
  const zone = s.zone;
  if (!s.exp.prep) return 'a run with the start camp (newRun option prep)';
  if (s.phase !== 'ZONE_HUB' || !zone || zone.camp || s.service) return 'only in a zone hub, no service open';
  if (!zone.hubOffer || zone.hubOffer.taken) return 'no hub contract on offer';
  if (zone.leftHub) return 'the hub contract is taken before leaving the hub';
  if (a.mode === 'reserve') {
    if (heldCount(s) >= CONTRACT_SLOTS) return `at most ${CONTRACT_SLOTS} contracts at once (swap one)`;
    return s.exp.reserve < zone.hubOffer.price ? 'not enough Reserve' : null;
  }
  if (a.mode === 'swap') {
    const c = s.exp.contracts.find((k) => k.id === a.contractId);
    return !c || c.state !== 'held' ? 'swap needs a held contract (contractId)' : null;
  }
  return "mode must be 'reserve' or 'swap'";
}

/** TAKE_HUB_CONTRACT: from Reserve, or for free by abandoning a held contract (no refund, progress lost); sites now. */
export function takeHubContract(s, ev, a) {
  const zone = s.zone;
  const o = zone.hubOffer;
  if (a.mode === 'reserve') s.exp.reserve -= o.price;
  else {
    const old = s.exp.contracts.find((k) => k.id === a.contractId);
    old.state = 'abandoned';
    clearSites(s, old);
    ev.push({ t: 'contract', what: 'abandon', id: old.id, z: old.z, kind: old.kind });
  }
  o.taken = true;
  const c = holdContract(s, ev, o, 'hub');
  placeSites(s, c);
}

// ---------------- Progress, rewards, expiry (expedition.md 3.1, 3.3) ----------------
/**
 * The node the player is in was won (a Quest's encounter, a Grind's first wave, an Elite's fight, a Dungeon's boss):
 * every held contract of this zone with a site there counts it; a contract that reaches its need is complete and pays
 * at once (XP, gold; the item choice is returned as a reward set for the node's reward stage). Heat: the node's entry
 * state applies (progress.js, items.js). Returns the reward sets.
 */
export function siteWon(s, ev) {
  const n = s.node;
  const def = s.zone.nodes[n.id];
  const sets = [];
  if (!def.sites) return sets;
  const marks = def.sites.slice(); // completing one contract clears its marks (clearSites)
  for (const c of s.exp.contracts) {
    if (c.state !== 'held' || c.z !== s.zone.z || !marks.includes(c.id)) continue;
    c.progress += 1;
    ev.push({ t: 'contract', what: 'site', id: c.id, node: n.id, progress: c.progress, need: c.need });
    if (c.progress >= c.need) sets.push(completeContract(s, ev, c));
  }
  return sets;
}

function completeContract(s, ev, c) {
  const k = CONTRACT[c.kind];
  const cl = contractLevel(c.z);
  c.state = 'complete';
  clearSites(s, c);
  ev.push({ t: 'contract', what: 'complete', id: c.id, z: c.z, kind: c.kind });
  // M2b v10 (D82): no level-difference modifier (as the retired story chain); not a kill, so no rested; heat in gainXp.
  gainXp(s, ev, flatXp(s, k.xpFrac * xpWeight(s), cl), 'contract');
  gainGold(s, ev, k.goldV * V(cl), 'contract');
  const items = [];
  for (let i = 0; i < k.choices; i++) items.push(...rollDrop(s, s.lootRng, k.table, clampCl(cl), s.zone.z));
  return { kind: 'items', items, contract: c.id };
}

/** Leaving zone z (Road or Bell): its held contracts expire (no reward, no penalty; the slot frees). */
export function expireContracts(s, ev, z) {
  for (const c of s.exp.contracts) {
    if (c.state !== 'held' || c.z !== z) continue;
    c.state = 'expired';
    clearSites(s, c);
    ev.push({ t: 'contract', what: 'expire', id: c.id, z: c.z, kind: c.kind });
  }
}

// ---------------- Map view parts (expedition.md 5.1, 5.2) ----------------
/** Held contracts' site marks on node id (contract ids), or null when none. */
export function siteMarks(s, id) {
  const n = s.zone.nodes[id];
  if (!n.sites) return null;
  const held = n.sites.filter((cid) => s.exp.contracts.some((c) => c.id === cid && c.state === 'held'));
  return held.length ? held : null;
}
/** Tracker's Notes (expedition.md 2.4): site marks within the Tracker's radius of the player, hidden nodes too. */
export function trackerShows(s, id, d) {
  const r = s.exp.vision.tracker || 0;
  return r > 0 && d <= r;
}
/** A held or completed Delve contract of this zone reveals its dungeon's location (expedition.md 3.3, 5.2). */
export const delveKnown = (s) => !!(s.exp && s.exp.contracts && s.exp.contracts.some((c) => c.kind === 'delve' && c.z === s.zone.z && (c.state === 'held' || c.state === 'complete')));

// ---------------- The Spyglass (expedition.md 2.4) ----------------
export function spyglassError(s, id) {
  if (!s.exp.prep || !s.exp.spyglass) return 'no Spyglass charge left';
  return !Number.isInteger(id) || !s.zone.nodes[id] ? `no node ${id}` : null;
}
/** USE_SPYGLASS(nodeId): 0 tolls; that node and its neighbours are seen (fully, for the rest of the zone). */
export function useSpyglass(s, ev, id) {
  const zone = s.zone;
  s.exp.spyglass -= 1;
  const seen = [];
  for (const x of [id, ...zone.nodes[id].nb]) if (!zone.seen[x]) { zone.seen[x] = true; seen.push(x); }
  ev.push({ t: 'spyglass', node: id, seen, charges: s.exp.spyglass });
}

/** Summary lines (expedition.md 8.1, rules 9): contracts taken / completed / expired / abandoned, purchases, Reserve. */
export function contractSummary(s) {
  const list = (s.exp && s.exp.contracts) || [];
  const n = (st) => list.filter((c) => c.state === st).length;
  return {
    taken: list.length, completed: n('complete'), expired: n('expired'), abandoned: n('abandoned'), held: n('held'),
    bought: s.prep ? s.prep.bought.slice() : [], reserve: s.exp ? s.exp.reserve || 0 : 0,
  };
}
