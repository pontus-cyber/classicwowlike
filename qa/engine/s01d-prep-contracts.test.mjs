// docs/specs/expedition.md 2 and 3 (prep, task M2b 2b.5): the start camp of an expedition run (PREP: preparation points
// and their meta source, the contract board on stream prep(k), rerolls, supplies and vision perks, Reserve, SET_OUT,
// prepView) and contracts (sites on the continued map(z) stream, progress, rewards, expiry, the hub contract on stream
// hubc(z), the Spyglass, Tracker's Notes, contractView, the Echo lines, the story chain retired on the expedition map).
// Every draw order is replayed here from the spec's own description; the rows map never sees any of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { R, C, CONTENT, tweak, ev, STREAM, nextFloat } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { nextInt, weightedIndex } from '../../src/rng.js';
import { generateExpZone, zoneRegions } from '../../src/engine/expedition.js';
import { contractLevel, prepPoints } from '../../src/engine/contracts.js';
import { validEncounter } from '../../src/engine/map.js';

const SPEC = readFileSync(fileURLToPath(new URL('../../docs/specs/expedition.md', import.meta.url)), 'utf8');
const pet = (cls) => (cls === 'hunter' ? 'ridgewolf' : null);
/** An expedition run at the start camp (phase PREP). */
function atCamp(opts = {}) {
  const cls = opts.classId || 'mage';
  const s = R.newRun({ classId: cls, petId: pet(cls), seed: opts.seed ?? 1, content: opts.content || REAL, profile: opts.profile || null, mapMode: 'expedition', vision: opts.vision || null, prep: true });
  return R.step(s, { type: 'START_RUN' }).state;
}
const go = (s, a) => R.step(s, a).state;
const prof = (unlocks) => ({ ...R.newProfile(), unlocks });
/** Put a chosen offer on board slot i (test set-up), then take it. */
function holding(s, i, offer) {
  const t = tweak(s, (x) => { x.prep.board[i] = { index: i, taken: false, template: null, family: null, region: null, ...offer, need: C.CONTRACT[offer.kind].sites, price: C.CONTRACT[offer.kind].price }; });
  return go(t, { type: 'TAKE_CONTRACT', index: i });
}
/** The documented offer draws (expedition.md 2.2; contracts.js drawOffer): kind, region, family, a Bounty's template. */
function offerOf(c, rng, z) {
  const kind = C.CONTRACT_KINDS[weightedIndex(rng, C.CONTRACT_KINDS.map((k) => C.CONTRACT[k].weight))];
  const o = { z, kind, region: null, family: null, template: null };
  if (kind === 'delve') return o;
  const regs = zoneRegions(c, z);
  o.region = nextInt(rng, regs.length);
  const fams = regs[o.region].families;
  const f = nextInt(rng, Math.max(1, fams.length));
  o.family = fams.length ? fams[f] : null;
  if (kind === 'bounty') {
    const rares = c.zones[z - 1].rares;
    const own = rares.filter((t) => c.enemies[t].family === o.family);
    const list = own.length ? own : rares;
    o.template = list[nextInt(rng, list.length)];
  }
  return o;
}
const pick = (o) => ({ z: o.z, kind: o.kind, region: o.region, family: o.family, template: o.template });
const sameAs = (a, b) => a.z === b.z && a.kind === b.kind && a.region === b.region && a.family === b.family && a.template === b.template;
/** Every offer a slot can draw over zones zs with its chance (expedition.md 2.2: zone, kind, region, family, elite order). */
function oddsOf(c, zs) {
  const kw = C.CONTRACT_KINDS.map((k) => C.CONTRACT[k].weight);
  const sum = kw.reduce((a, b) => a + b, 0);
  const out = [];
  for (const z of zs) {
    C.CONTRACT_KINDS.forEach((kind, ki) => {
      const pk = kw[ki] / sum / zs.length;
      if (kind === 'delve') return void out.push({ o: { z, kind, region: null, family: null, template: null }, p: pk });
      const regs = zoneRegions(c, z);
      regs.forEach((reg, region) => {
        const fams = reg.families.length ? reg.families : [null];
        for (const family of fams) {
          const p = pk / regs.length / fams.length;
          if (kind !== 'bounty') { out.push({ o: { z, kind, region, family, template: null }, p }); continue; }
          const own = c.zones[z - 1].rares.filter((t) => c.enemies[t].family === family);
          const list = own.length ? own : c.zones[z - 1].rares;
          for (const template of list) out.push({ o: { z, kind, region, family, template }, p: p / list.length });
        }
      });
    });
  }
  return out;
}
/**
 * The documented board of prep(k) (expedition.md 2.2): slot by slot, zone then offer; a kept (taken) slot draws and keeps
 * its offer; an offer equal to one on the board is replaced by one weighted draw over the slot's offers not on the board.
 */
function boardOf(seed, k, kept = []) {
  const rng = STREAM.prep(seed, k);
  const out = [];
  for (let i = 0; i < C.CONTRACT_BOARD_SIZE; i++) {
    const z = i < C.ZONE_COUNT ? i + 1 : 1 + nextInt(rng, C.ZONE_COUNT);
    let o = offerOf(REAL, rng, z);
    if (kept[i]) { out.push(pick(kept[i])); continue; }
    const board = [...out, ...kept.slice(i + 1).filter(Boolean).map(pick)];
    if (board.some((b) => sameAs(b, o))) {
      const zs = i < C.ZONE_COUNT ? [z] : [1, 2, 3, 4, 5, 6].slice(0, C.ZONE_COUNT);
      const free = oddsOf(REAL, zs).filter((x) => !board.some((b) => sameAs(b, x.o)));
      if (free.length) o = free[weightedIndex(rng, free.map((x) => x.p))].o;
    }
    out.push(o);
  }
  return out;
}
/** The board as drawn before the no-repeat rule (2026-11-11): every slot's plain draw. */
function plainBoard(seed, k) {
  const rng = STREAM.prep(seed, k);
  const out = [];
  for (let i = 0; i < C.CONTRACT_BOARD_SIZE; i++) out.push(offerOf(REAL, rng, i < C.ZONE_COUNT ? i + 1 : 1 + nextInt(rng, C.ZONE_COUNT)));
  return out;
}
/** Play autoplay until pred; collect the events. */
function playUntil(s, pred, max = 3000) {
  const all = [];
  for (let n = 0; n < max && !pred(s) && s.phase !== 'ENDED'; n++) {
    const r = R.step(s, R.autoAction(s));
    all.push(...r.events);
    s = r.state;
  }
  return { s, all };
}
/** Path of node ids from a to b (BFS). */
function pathTo(zone, a, b) {
  const prev = new Map([[a, null]]);
  const q = [a];
  for (let i = 0; i < q.length; i++) for (const v of zone.nodes[q[i]].nb) if (!prev.has(v)) { prev.set(v, q[i]); q.push(v); }
  const out = [];
  for (let x = b; x !== null; x = prev.get(x)) out.unshift(x);
  return out;
}
/** Stand next to node id (test set-up), on the map. */
const besideNode = (s, id) => tweak(s, (x) => { x.zone.pos = pathTo(x.zone, 0, id).slice(-2)[0]; x.phase = 'MAP'; x.zone.leftHub = true; });

describe('expedition.md 13: the start camp and contract constants (prep)', () => {
  test('each implemented constant of the table equals src/constants.js', () => {
    const i = SPEC.indexOf('## 13. Constant table');
    const rows = SPEC.slice(i).split('\n').filter((l) => l.startsWith('| ')).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
    const names = ['PREP_POINTS', 'PREP_POINTS_PER_QM', 'PREP_ECHO_PER_POINT', 'CONTRACT_BOARD_SIZE', 'CONTRACT_BOARD_EXTRA', 'CONTRACT_SLOTS', 'REROLL_PRICE',
      'REROLL_MAX', 'CW_CULL', 'CW_BOUNTY', 'CW_DELVE', 'CULL_SITES', 'CULL_SITE_SPARE', 'CULL_SITE_IN', 'CULL_SITE_OUT', 'BOUNTY_PLACED', 'CONTRACT_CL_OFFSET',
      'CULL_XP_FRAC', 'BOUNTY_XP_FRAC', 'DELVE_XP_FRAC', 'CULL_GOLD_V', 'BOUNTY_GOLD_V', 'DELVE_GOLD_V', 'CONTRACT_REWARD_CHOICES', 'DELVE_REWARD_CHOICES',
      'CONTRACT_RARE_W', 'CONTRACT_EPIC_W', 'BOUNTY_RARE_W', 'BOUNTY_EPIC_W', 'ECHO_CONTRACT_MULT', 'PRICE_PREP_DRAUGHTS', 'PREP_DRAUGHT_COUNT',
      'PRICE_PREP_RATIONS', 'PREP_RATION_COUNT', 'PRICE_PREP_EMBER', 'PRICE_PREP_BELL', 'PRICE_PREP_MULE', 'PREP_MULE_SLOTS', 'PRICE_CHARTS',
      'PRICE_TRACKER', 'PRICE_GUIDE', 'PRICE_SPYGLASS', 'SPYGLASS_CHARGES', 'TRACKER_RADIUS', 'PACE_PREP_S', 'PACE_HUB_CONTRACT_S',
      // M2b v11: the Dimmed encounter's tolls, the expedition kill loot weight and boss rolls, the catalogue costs of 8.2;
      // M2b v12: the escape's tolls
      'TIME_DIM_FIGHT', 'TIME_DIM_ESCAPE', 'EXPED_DROP_MULT', 'EXPED_DUNGEON_BOSS_DROPS', 'META_COST_CARTOGRAPHER', 'META_COST_OLD_HAND', 'META_COST_QM_1', 'META_COST_QM_2'];
    const seen = new Set();
    for (const [nameCell, valueCell] of rows) {
      const ns = nameCell.split('/').map((x) => x.trim());
      const vs = valueCell.split('/').map((x) => x.trim().split(/\s/)[0]);
      if (nameCell.startsWith('CONTRACT.cull.price')) {
        assert.deepEqual(C.CONTRACT_KINDS.map((k) => C.CONTRACT[k].price), vs.map(Number), 'CONTRACT.kind.price');
        continue;
      }
      ns.forEach((n, j) => {
        if (!names.includes(n)) return;
        seen.add(n);
        assert.equal(C[n], Number(vs[ns.length === vs.length ? j : 0]), n);
      });
    }
    assert.deepEqual([...seen].sort(), names.slice().sort(), 'every name found in the table');
    assert.equal(C.CONTRACT_BOARD_SIZE, C.ZONE_COUNT + C.CONTRACT_BOARD_EXTRA);
    assert.deepEqual([C.DROP_TABLE.contract.weights, C.DROP_TABLE.bounty.weights], [[0, 0, C.CONTRACT_RARE_W, C.CONTRACT_EPIC_W], [0, 0, C.BOUNTY_RARE_W, C.BOUNTY_EPIC_W]]);
    assert.deepEqual(C.CONTRACT_KINDS.map((k) => [C.CONTRACT[k].sites, C.CONTRACT[k].weight, C.CONTRACT[k].xpFrac, C.CONTRACT[k].goldV, C.CONTRACT[k].choices]),
      [[C.CULL_SITES, C.CW_CULL, C.CULL_XP_FRAC, C.CULL_GOLD_V, C.CONTRACT_REWARD_CHOICES], [1, C.CW_BOUNTY, C.BOUNTY_XP_FRAC, C.BOUNTY_GOLD_V, C.CONTRACT_REWARD_CHOICES],
        [1, C.CW_DELVE, C.DELVE_XP_FRAC, C.DELVE_GOLD_V, C.DELVE_REWARD_CHOICES]]);
    assert.deepEqual(C.PREP_OPTION_IDS.map((id) => C.PREP_OPTION[id].price), [C.PRICE_PREP_DRAUGHTS, C.PRICE_PREP_RATIONS, C.PRICE_PREP_EMBER, C.PRICE_PREP_BELL,
      C.PRICE_PREP_MULE, C.PRICE_CHARTS, C.PRICE_TRACKER, C.PRICE_GUIDE, C.PRICE_SPYGLASS]);
  });
});

describe('the newRun option prep (the default on the expedition map since D116)', () => {
  test('on by default on the expedition map, off on the rows map; prep: false plays the expedition as before 2b.5: no PREP, no contracts or hub offers, the story chain kept; true on rows: refused', () => {
    const d = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 2, content: REAL });
    assert.deepEqual([d.mapMode, d.create.prep, go(d, { type: 'START_RUN' }).phase], ['expedition', true, 'PREP'], 'the default run starts at the start camp');
    assert.equal(R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 2, content: REAL, mapMode: 'expedition' }).create.prep, true, 'expedition: on unless turned off');
    const rows0 = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 2, content: REAL, mapMode: 'rows' });
    assert.deepEqual([rows0.mapMode, rows0.create.prep], ['rows', undefined], 'rows: no start camp');
    assert.equal(go(R.newRun({ classId: 'mage', seed: 1, content: REAL, mapMode: 'rows', prep: false }), { type: 'START_RUN' }).phase, 'ZONE_HUB', 'rows with prep: false is accepted');
    let s = R.step(R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 2, content: REAL, mapMode: 'expedition', prep: false }), { type: 'START_RUN' }).state;
    assert.deepEqual([s.phase, s.prep, s.exp.prep, R.contractView(s), R.mapView(s).spyglass], ['ZONE_HUB', undefined, false, null, undefined]);
    let stories = 0;
    for (let n = 0; n < 30000 && s.phase !== 'ENDED'; n++) {
      const r = R.step(s, R.autoAction(s));
      stories += ev(r.events, 'story').length;
      assert.equal(ev(r.events, 'contract').length, 0);
      if (s.zone && !s.zone.camp && s.zone.z > 1) assert.equal(s.zone.hubOffer, undefined);
      s = r.state;
    }
    assert.ok(stories > 0, 'the story chain stays without the start camp');
    assert.equal(s.result.summary.expedition.contracts, undefined);
    assert.throws(() => R.newRun({ content: REAL, mapMode: 'rows', prep: true }), /expedition option/);
    assert.throws(() => R.newRun({ content: REAL, mapMode: 'expedition', prep: 'yes' }), /expedition option/);
  });
});

describe('expedition.md 1, 2: the start camp (PREP)', () => {
  test('START_RUN of an expedition run opens PREP (no zone yet; heatView and mapView null); a rows run goes to its hub as before', () => {
    const s = atCamp();
    assert.equal(s.phase, 'PREP');
    assert.equal(s.zone, undefined);
    assert.deepEqual([R.heatView(s), R.mapView(s)], [null, null]);
    const types = new Set(R.legalActions(s).map((a) => a.type));
    assert.deepEqual([...types].sort(), ['BUY_PREP', 'REROLL_BOARD', 'SET_AUTOPLAY', 'SET_OUT', 'TAKE_CONTRACT']);
    for (const a of [{ type: 'LEAVE_HUB' }, { type: 'SERVICE', service: 'inn' }, { type: 'USE_ITEM', itemId: 'trail_rations' }]) assert.ok(R.whyIllegal(s, a), a.type);
    const rows = go(R.newRun({ classId: 'mage', seed: 1, content: REAL, mapMode: 'rows' }), { type: 'START_RUN' });
    assert.deepEqual([rows.phase, rows.prep, rows.exp, R.prepView(rows), R.contractView(rows)], ['ZONE_HUB', undefined, undefined, null, null]);
    assert.ok(R.whyIllegal(rows, { type: 'SET_OUT' }));
    assert.ok(R.whyIllegal(rows, { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }));
  });

  test('2.1 points: PREP_POINTS, + PREP_POINTS_PER_QM per Quartermaster rank (meta), at most its ranks', () => {
    assert.equal(R.prepView(atCamp()).points, C.PREP_POINTS);
    for (const [r, want] of [[1, 12], [2, 14], [5, 14]]) {
      assert.equal(R.prepView(atCamp({ profile: prof({ quartermaster: r }) })).points, want, `rank ${r}`);
      assert.equal(prepPoints(prof({ quartermaster: r })), C.PREP_POINTS + C.PREP_POINTS_PER_QM * Math.min(r, C.META_EXPEDITION.quartermaster.ranks));
    }
  });

  test('2.2 the board: stream prep(0), one contract per zone then CONTRACT_BOARD_EXTRA drawn zones; draws as documented; deterministic', () => {
    for (const seed of [1, 2, 3, 77]) {
      const s = atCamp({ seed });
      assert.deepEqual(s.prep.board.map(pick), boardOf(s.seed, 0), `seed ${seed}`);
      assert.deepEqual(atCamp({ seed }).prep.board, s.prep.board);
      for (const o of s.prep.board) {
        assert.equal(o.price, C.CONTRACT[o.kind].price);
        assert.equal(o.need, C.CONTRACT[o.kind].sites);
        if (o.kind !== 'delve') assert.ok(zoneRegions(REAL, o.z)[o.region].families.includes(o.family));
      }
      const v = R.prepView(s);
      assert.equal(v.board.length, C.CONTRACT_BOARD_SIZE);
      for (const b of v.board) {
        assert.deepEqual(b.band, [10 * (b.z - 1) + 1, 10 * b.z]);
        assert.equal(b.reward.cl, contractLevel(b.z));
        assert.equal(b.reward.gold, C.CONTRACT[b.kind].goldV * R.V(contractLevel(b.z)));
        if (b.kind === 'bounty') assert.equal(b.name, REAL.enemies[b.template].name);
      }
    }
    // A Bounty's elite is a rare of the target family when the zone has one.
    let bounties = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const o of atCamp({ seed }).prep.board.filter((x) => x.kind === 'bounty')) {
        bounties++;
        const own = REAL.zones[o.z - 1].rares.filter((t) => REAL.enemies[t].family === o.family);
        assert.ok(own.length ? own.includes(o.template) : REAL.zones[o.z - 1].rares.includes(o.template));
      }
    }
    assert.ok(bounties > 10);
  });

  test('2.2 TAKE_CONTRACT costs its price, at most CONTRACT_SLOTS held; DROP_CONTRACT refunds; not twice; not past the points', () => {
    let s = atCamp({ seed: 5 });
    const cheap = s.prep.board.map((o, i) => [o.price, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    let left = C.PREP_POINTS;
    for (const i of cheap) {
      if (s.prep.board[i].price > left || R.prepView(s).held >= C.CONTRACT_SLOTS) {
        assert.ok(R.whyIllegal(s, { type: 'TAKE_CONTRACT', index: i }));
        continue;
      }
      const r = R.step(s, { type: 'TAKE_CONTRACT', index: i });
      s = r.state;
      left -= s.prep.board[i].price;
      assert.equal(R.prepView(s).left, left);
      assert.equal(ev(r.events, 'contract')[0].what, 'take');
      assert.match(R.whyIllegal(s, { type: 'TAKE_CONTRACT', index: i }), /already taken/);
    }
    assert.ok(R.prepView(s).held <= C.CONTRACT_SLOTS);
    const taken = s.prep.board.findIndex((o) => o.taken);
    const d = go(s, { type: 'DROP_CONTRACT', index: taken });
    assert.equal(R.prepView(d).left, left + s.prep.board[taken].price);
    assert.equal(d.exp.contracts.length, s.exp.contracts.length - 1);
    assert.match(R.whyIllegal(d, { type: 'DROP_CONTRACT', index: taken }), /not taken/);
    // Slots: four Delves (price 1) fill them; a fifth is refused.
    let f = atCamp({ seed: 5 });
    for (let i = 0; i < 5; i++) f = tweak(f, (x) => { x.prep.board[i] = { ...x.prep.board[i], kind: 'delve', region: null, family: null, template: null, price: 1, need: 1 }; });
    for (let i = 0; i < C.CONTRACT_SLOTS; i++) f = go(f, { type: 'TAKE_CONTRACT', index: i });
    assert.match(R.whyIllegal(f, { type: 'TAKE_CONTRACT', index: 4 }), /at most 4/);
  });

  test('2.2 REROLL_BOARD: REROLL_PRICE, at most REROLL_MAX; taken offers stay, the others are the same slots of prep(k + 1)', () => {
    let s = atCamp({ seed: 9 });
    s = go(s, { type: 'TAKE_CONTRACT', index: 0 });
    const keep = s.prep.board[0];
    for (let k = 1; k <= C.REROLL_MAX; k++) {
      const before = R.prepView(s).left;
      s = go(s, { type: 'REROLL_BOARD' });
      const fresh = boardOf(s.seed, k, [keep]);
      assert.deepEqual(s.prep.board[0], keep);
      assert.deepEqual(s.prep.board.slice(1).map(pick), fresh.slice(1));
      assert.equal(R.prepView(s).left, before - C.REROLL_PRICE);
    }
    assert.match(R.whyIllegal(s, { type: 'REROLL_BOARD' }), /at most/);
  });

  test('2.2 no repeats (2026-11-11): no two offers on one board are the same contract, rerolls and taken offers included; a board without a repeat is drawn as before', () => {
    let replaced = 0;
    let plainSame = 0;
    for (let seed = 1; seed <= 150; seed++) {
      let s = atCamp({ seed });
      const plain = plainBoard(seed, 0);
      const hadRepeat = plain.some((o, i) => plain.slice(0, i).some((p) => sameAs(p, o)));
      if (hadRepeat) replaced++;
      else { plainSame++; assert.deepEqual(s.prep.board.map(pick), plain, `seed ${seed}: a board without a repeat is unchanged`); }
      // The zone slots of prep(0) never change (each its own zone; the extra slots draw after them).
      assert.deepEqual(s.prep.board.slice(0, C.ZONE_COUNT).map(pick), plain.slice(0, C.ZONE_COUNT));
      for (const i of [1, C.ZONE_COUNT]) if (!R.whyIllegal(s, { type: 'TAKE_CONTRACT', index: i })) s = go(s, { type: 'TAKE_CONTRACT', index: i });
      for (let k = 0; k <= C.REROLL_MAX; k++) {
        const b = s.prep.board;
        b.forEach((o, i) => assert.ok(!b.slice(0, i).some((p) => sameAs(p, o)), `seed ${seed}, prep(${k}): slot ${i + 1} repeats an offer`));
        b.forEach((o) => { assert.equal(o.price, C.CONTRACT[o.kind].price); assert.equal(o.need, C.CONTRACT[o.kind].sites); });
        if (k > 0) assert.deepEqual(b.map(pick), boardOf(seed, k, b.map((o) => (o.taken ? o : null))), `seed ${seed}, prep(${k}) as documented`);
        if (k < C.REROLL_MAX && !R.whyIllegal(s, { type: 'REROLL_BOARD' })) s = go(s, { type: 'REROLL_BOARD' });
      }
    }
    assert.ok(replaced > 10 && plainSame > 50, `${replaced} boards had a repeat, ${plainSame} did not`);
    // The playtest's board (seed 4, QA 2026-11-11): offers 2 and 7 were the same Cull, 6 and 8 the same; now 8 distinct.
    const b4 = atCamp({ seed: 4, classId: 'rogue' }).prep.board;
    assert.equal(new Set(b4.map((o) => [o.z, o.kind, o.region, o.family, o.template].join('|'))).size, C.CONTRACT_BOARD_SIZE);
  });

  test('2.3 / 2.4 options: each bought once and sold back; owned perks (meta Cartographer and Old Hand, the vision option) are not for sale; Bell cap', () => {
    let s = atCamp();
    for (const id of C.PREP_OPTION_IDS) assert.equal(R.whyIllegal(s, { type: 'SELL_PREP', id }), `${id} is not bought`);
    s = go(s, { type: 'BUY_PREP', id: 'prep_guide' });
    assert.equal(R.prepView(s).left, C.PREP_POINTS - C.PRICE_GUIDE);
    assert.match(R.whyIllegal(s, { type: 'BUY_PREP', id: 'prep_guide' }), /already bought/);
    s = go(s, { type: 'SELL_PREP', id: 'prep_guide' });
    assert.equal(R.prepView(s).left, C.PREP_POINTS);
    s = go(go(s, { type: 'BUY_PREP', id: 'prep_ember' }), { type: 'BUY_PREP', id: 'prep_guide' });
    assert.equal(R.whyIllegal(s, { type: 'BUY_PREP', id: 'prep_bell' }), null); // 10 - 4 - 3 = 3 points: the Bell (2) fits
    s = go(s, { type: 'BUY_PREP', id: 'prep_bell' });
    assert.match(R.whyIllegal(s, { type: 'BUY_PREP', id: 'prep_tracker' }), /not enough/);
    assert.match(R.whyIllegal(s, { type: 'TAKE_CONTRACT', index: s.prep.board.findIndex((o) => o.price > 1) }), /not enough/);
    const meta = atCamp({ profile: prof({ cartographer: 1, old_hand: 1 }) });
    const v = R.prepView(meta);
    for (const id of ['prep_charts', 'prep_tracker']) {
      assert.equal(v.options.find((o) => o.id === id).owned, true);
      assert.match(R.whyIllegal(meta, { type: 'BUY_PREP', id }), /owned/);
    }
    assert.deepEqual([meta.exp.vision.regions, meta.exp.vision.tracker], [true, C.TRACKER_RADIUS], 'meta perks hold from START_RUN');
    assert.match(R.whyIllegal(atCamp({ vision: { guide: true } }), { type: 'BUY_PREP', id: 'prep_guide' }), /owned/);
    const full = tweak(atCamp(), (x) => { x.exp.bell = C.BELL_MAX_CHARGES; });
    assert.match(R.whyIllegal(full, { type: 'BUY_PREP', id: 'prep_bell' }), /at most/);
  });

  test('2.3-2.6 SET_OUT: supplies in the bag, Bell +1, Pack Mule slots, vision perks for the run, Spyglass charges, Reserve = points left; zone 1', () => {
    let s = atCamp({ seed: 4 });
    const bag0 = { d: 0, r: 0 };
    for (const it of s.player.bag) if (it.kind === 'cons') { if (it.id === 'healing_draught') bag0.d += it.qty; if (it.id === 'trail_rations') bag0.r += it.qty; }
    for (const id of ['prep_draughts', 'prep_rations', 'prep_mule', 'prep_charts', 'prep_spyglass', 'prep_bell']) s = go(s, { type: 'BUY_PREP', id });
    const left = R.prepView(s).left;
    assert.equal(left, C.PREP_POINTS - 1 - 1 - 1 - 1 - 1 - 2);
    const cap = R.bagCapacity(s);
    const r = R.step(s, { type: 'SET_OUT' });
    const o = r.state;
    const count = (id) => o.player.bag.filter((x) => x.kind === 'cons' && x.id === id).reduce((n, x) => n + x.qty, 0);
    assert.deepEqual([count('healing_draught') - bag0.d, count('trail_rations') - bag0.r], [C.PREP_DRAUGHT_COUNT, C.PREP_RATION_COUNT]);
    assert.equal(R.bagCapacity(o), cap + C.PREP_MULE_SLOTS);
    assert.equal(o.exp.bell, Math.min(C.BELL_MAX_CHARGES, C.BELL_START_CHARGES + 1));
    assert.equal(R.mapView(o).vision.regions, true);
    assert.equal(R.mapView(o).spyglass, C.SPYGLASS_CHARGES);
    assert.equal(o.exp.reserve, left);
    assert.deepEqual([o.phase, o.zone.z, R.prepView(o)], ['ZONE_HUB', 1, null]);
    assert.ok(ev(r.events, 'prep').some((e) => e.what === 'setOut' && e.reserve === left));
    assert.ok(R.whyIllegal(o, { type: 'SET_OUT' }));
    let g = go(go(atCamp({ seed: 4 }), { type: 'BUY_PREP', id: 'prep_guide' }), { type: 'SET_OUT' });
    assert.equal(R.mapView(g).vision.radius, Math.min(C.VISION_RADIUS_MAX, C.VISION_RADIUS + C.GUIDE_RADIUS_BONUS));
    g = go(go(atCamp({ seed: 4 }), { type: 'BUY_PREP', id: 'prep_ember' }), { type: 'SET_OUT' });
    assert.equal(g.player.bag.filter((x) => x.id === 'ember_of_return').length, 1);
  });
});

describe('expedition.md 3: contracts in the zone', () => {
  test('3.3 Cull sites: map(z) continued after the node types, draws as documented; Quest or Grind nodes; the family is in each site encounter', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const camp = atCamp({ seed });
      const regs = zoneRegions(REAL, 1);
      const region = seed % regs.length;
      const family = regs[region].families[0];
      const s = go(holding(camp, 0, { z: 1, kind: 'cull', region, family }), { type: 'SET_OUT' });
      const plain = generateExpZone(go(atCamp({ seed }), { type: 'SET_OUT' }), 1);
      const rng = plain.siteRng.slice();
      const ok = (n) => n.ring > 0 && (n.type === 'quest' || n.type === 'grind');
      const picked = new Set();
      for (const n of plain.nodes) if (ok(n) && nextFloat(rng) < (n.region === region ? C.CULL_SITE_IN : C.CULL_SITE_OUT)) picked.add(n.id);
      while (picked.size < C.CULL_SITES + C.CULL_SITE_SPARE) {
        const cand = plain.nodes.filter((n) => ok(n) && n.region === region && !picked.has(n.id));
        if (!cand.length) break;
        picked.add(cand[nextInt(rng, cand.length)].id);
      }
      const k = s.exp.contracts[0];
      assert.deepEqual(k.sites, [...picked].sort((a, b) => a - b), `seed ${seed}`);
      for (const id of k.sites) {
        const n = s.zone.nodes[id];
        assert.ok(ok(n));
        assert.deepEqual(n.sites, [k.id]);
        const mobs = n.type === 'quest' ? n.mobs : n.waves[0];
        assert.ok(validEncounter(REAL, mobs));
        const famNormals = REAL.zones[0].normals.filter((t) => REAL.enemies[t].family === family);
        if (famNormals.length) assert.ok(mobs.some((t) => REAL.enemies[t].family === family) || mobs.every((_, i) => !validEncounter(REAL, mobs.map((m, j) => (j === i ? famNormals[0] : m)))), `seed ${seed} node ${id}`);
      }
    }
  });

  test('3.3 Bounty sites: BOUNTY_PLACED Elite nodes of ring 2-3 in the region (no Dungeon, Rest, Road, Shardfall, Trainer) with the rare; Delve: the Dungeon, shown on the map', () => {
    for (const seed of [1, 2, 3]) {
      const tmpl = REAL.zones[0].rares[0];
      const s = go(holding(atCamp({ seed }), 0, { z: 1, kind: 'bounty', region: 1, family: REAL.enemies[tmpl].family, template: tmpl }), { type: 'SET_OUT' });
      const k = s.exp.contracts[0];
      assert.equal(k.sites.length, C.BOUNTY_PLACED);
      for (const id of k.sites) {
        const n = s.zone.nodes[id];
        assert.ok([2, 3].includes(n.ring) && n.region === 1 && !n.road && !n.shardfall);
        assert.deepEqual([n.type, n.elite, n.rare], ['elite', tmpl, true]);
        assert.ok(n.bounty && n.bounty.normal.elite);
      }
      const d = go(holding(atCamp({ seed }), 0, { z: 1, kind: 'delve' }), { type: 'SET_OUT' });
      const dun = d.zone.nodes.find((n) => n.type === 'dungeon').id;
      assert.deepEqual(d.exp.contracts[0].sites, [dun]);
      const view = R.mapView(go(d, { type: 'LEAVE_HUB' })).nodes[dun];
      assert.equal(view.type, 'dungeon', 'a Delve contract shows the dungeon');
      const without = R.mapView(go(go(atCamp({ seed }), { type: 'SET_OUT' }), { type: 'LEAVE_HUB' })).nodes[dun];
      if (without.know === 'none') assert.equal(without.type, undefined);
    }
  });

  test('3.1 progress and reward: each won site counts; the last pays XP (× XP_WEIGHT_MULT, no diffMod since M2b v10), gold and a choice on table "contract" at once', () => {
    const regs = zoneRegions(REAL, 1);
    let s = go(holding(atCamp({ seed: 3, classId: 'rogue' }), 0, { z: 1, kind: 'cull', region: 0, family: regs[0].families[0] }), { type: 'SET_OUT' });
    s = R.debug.setGod(s, true).state;
    const k = s.exp.contracts[0];
    const cl = contractLevel(1);
    for (const [i, site] of k.sites.slice(0, C.CULL_SITES).entries()) {
      let t = besideNode(s, site);
      const r = R.step(t, { type: 'MOVE', nodeId: site });
      const p = playUntil(r.state, (x) => x.phase === 'MAP' || (x.node && x.node.stage === 'reward' && x.node.rewards.some((set) => set.contract)));
      const all = [...r.events, ...p.all];
      const sites = ev(all, 'contract').filter((e) => e.what === 'site');
      assert.deepEqual(sites.map((e) => [e.id, e.progress, e.need]), [[k.id, i + 1, C.CULL_SITES]]);
      s = p.s;
      if (i === C.CULL_SITES - 1) {
        assert.ok(ev(all, 'contract').some((e) => e.what === 'complete' && e.id === k.id));
        const xi = all.findIndex((e) => e.t === 'xp' && e.why === 'contract');
        const x = all[xi];
        // M2b v10 (D82): no level-difference modifier, whatever the level at completion (CL_c = 8 in zone 1)
        assert.equal(cl, 8);
        assert.equal(x.amount - (x.heat || 0), Math.round(C.CULL_XP_FRAC * C.XP_WEIGHT_MULT * R.xpCurve(cl)));
        assert.equal(x.rested, 0, 'not a kill: no rested XP');
        const g = all.find((e) => e.t === 'gold' && e.why === 'contract');
        assert.equal(g.amount - (g.heat || 0), C.CULL_GOLD_V * R.V(cl));
        const set = s.node.rewards.find((x0) => x0.contract === k.id);
        assert.equal(set.items.length, C.CONTRACT_REWARD_CHOICES);
        for (const it of set.items) assert.ok(['rare', 'epic'].includes(it.rarity));
        // M2b v10 (D83): item level as rules 8.3 at CL_c = 10z - 2: a rare 10z - 1, an epic 10z + 1 (heat may step a rarity)
        for (const it of set.items) assert.equal(it.ilvl, cl + C.RARITY_ILVL_BONUS[it.rarity], `${it.rarity} ilvl`);
        assert.equal(R.contractView(s).contracts[0].status, 'complete');
        assert.equal(R.mapView(s).nodes[k.sites[C.CULL_SITES]].sites, undefined, 'a complete contract shows no marks');
        const sum = R.summary(tweak(s, (x) => { delete x.dev; })); // god mode made it a dev run, which earns no Echoes
        assert.equal(sum.expedition.contracts.completed, 1);
        const line = sum.echoes.lines.find((l) => l.id === 'contracts');
        assert.deepEqual([line.count, line.each], [1, C.ECHO_PER_QUEST * C.ECHO_CONTRACT_MULT]);
      }
    }
  });

  test('M2b v10 (D82-D84): contract level 10z - 2; contract XP without diffMod at any level, 0 at MAX_LEVEL; reward.xp is the amount paid; Delve XP 1.5 (price 2 again since M2b v12, D100)', () => {
    const camp = atCamp({ seed: 4 });
    for (let z = 1; z <= C.ZONE_COUNT; z++) assert.equal(contractLevel(z), 10 * z - 2);
    assert.deepEqual([C.CONTRACT.delve.price, C.CONTRACT.delve.xpFrac, C.CONTRACT_CL_OFFSET, C.XP_WEIGHT_MULT], [2, 1.5, 8, 1.4]);
    for (const b of R.prepView(camp).board) {
      const want = Math.round(C.CONTRACT[b.kind].xpFrac * C.XP_WEIGHT_MULT * R.xpCurve(contractLevel(b.z)));
      assert.equal(b.reward.xp, want, `zone ${b.z} ${b.kind}`);
      assert.equal(b.reward.xpFrac, C.CONTRACT[b.kind].xpFrac * C.XP_WEIGHT_MULT);
      if (b.kind === 'delve') assert.equal(b.price, 2); // M2b v12 (D100)
    }
    // The pay at completion does not depend on the level: a zone-1 Cull (CL_c 8) completed at level 1, 9 and 30; 0 at MAX_LEVEL.
    const regs = zoneRegions(REAL, 1);
    const out = R.debug.setGod(go(holding(atCamp({ seed: 3, classId: 'rogue' }), 0, { z: 1, kind: 'cull', region: 0, family: regs[0].families[0] }), { type: 'SET_OUT' }), true).state;
    const site = out.exp.contracts[0].sites[0];
    const pay = (L) => {
      const t = besideNode(tweak(out, (x) => { x.player.level = L; x.player.xp = 0; x.exp.contracts[0].progress = C.CULL_SITES - 1; }), site);
      const view = R.contractView(t).contracts[0].reward.xp;
      const r = R.step(t, { type: 'MOVE', nodeId: site });
      const p = playUntil(r.state, (x) => x.phase === 'MAP' || (x.node && x.node.stage === 'reward' && x.node.rewards.some((set) => set.contract)));
      const e = [...r.events, ...p.all].find((x) => x.t === 'xp' && x.why === 'contract');
      return { xp: e ? e.amount - (e.heat || 0) : 0, view };
    };
    const base = Math.round(C.CULL_XP_FRAC * C.XP_WEIGHT_MULT * R.xpCurve(8));
    for (const L of [1, 9, 30]) assert.deepEqual(pay(L), { xp: base, view: base }, `level ${L}`);
    assert.deepEqual(pay(C.MAX_LEVEL), { xp: 0, view: 0 });
  });

  test('3.1 expiry: leaving the zone expires its held contracts (no reward), the slot frees; later zones stay held', () => {
    let s = atCamp({ seed: 8 });
    s = holding(s, 0, { z: 1, kind: 'delve' });
    s = holding(s, 1, { z: 2, kind: 'delve' });
    s = go(go(s, { type: 'SET_OUT' }), { type: 'LEAVE_HUB' });
    assert.deepEqual(R.contractView(s).contracts.map((c) => c.status), ['active', 'later']);
    const r = R.step(s, { type: 'RING_BELL' });
    const e = ev(r.events, 'contract');
    assert.deepEqual(e.map((x) => [x.what, x.z]), [['expire', 1]]);
    assert.deepEqual(R.contractView(r.state).contracts.map((c) => c.status), ['expired', 'active']);
    assert.equal(R.contractView(r.state).held, 1);
  });

  test('3.6 hub contract: stream hubc(z) in zones 2-6; from Reserve (a free slot) or a swap (no refund); before LEAVE_HUB only; its sites at once', () => {
    let s = go(go(atCamp({ seed: 12 }), { type: 'SET_OUT' }), { type: 'LEAVE_HUB' });
    assert.equal(s.zone.hubOffer, null, 'zone 1 has none');
    s = go(s, { type: 'RING_BELL' });
    assert.equal(s.zone.z, 2);
    assert.deepEqual(pick(s.zone.hubOffer), offerOf(REAL, STREAM.hubc(s.seed, 2), 2));
    const v = R.contractView(s);
    assert.equal(v.hub.reserve, s.exp.reserve >= s.zone.hubOffer.price);
    const r = R.step(s, { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' });
    const t = r.state;
    assert.equal(t.exp.reserve, s.exp.reserve - s.zone.hubOffer.price);
    const k = t.exp.contracts[t.exp.contracts.length - 1];
    assert.deepEqual([k.from, k.z, k.state], ['hub', 2, 'held']);
    assert.ok(k.sites.length >= 1 && k.sites.every((id) => t.zone.nodes[id].sites.includes(k.id)));
    assert.match(R.whyIllegal(t, { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }), /no hub contract/);
    assert.equal(R.contractView(t).hub, null);
    // Swap: abandon one, no refund.
    const w = go(holding(atCamp({ seed: 12 }), 0, { z: 6, kind: 'delve' }), { type: 'SET_OUT' });
    let w2 = go(go(w, { type: 'LEAVE_HUB' }), { type: 'RING_BELL' });
    const res = w2.exp.reserve;
    w2 = go(w2, { type: 'TAKE_HUB_CONTRACT', mode: 'swap', contractId: 'k1' });
    assert.deepEqual(w2.exp.contracts.map((c) => c.state), ['abandoned', 'held']);
    assert.equal(w2.exp.reserve, res);
    // After LEAVE_HUB: gone. With no Reserve: refused.
    const left = go(go(go(go(atCamp({ seed: 12 }), { type: 'SET_OUT' }), { type: 'LEAVE_HUB' }), { type: 'RING_BELL' }), { type: 'LEAVE_HUB' });
    assert.match(R.whyIllegal(left, { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }), /zone hub|before leaving/);
    const poor = tweak(go(go(go(atCamp({ seed: 12 }), { type: 'SET_OUT' }), { type: 'LEAVE_HUB' }), { type: 'RING_BELL' }), (x) => { x.exp.reserve = 0; });
    assert.match(R.whyIllegal(poor, { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }), /Reserve/);
  });

  test('2.4 Spyglass: 0 tolls, the node and its neighbours seen, one charge; Tracker\'s Notes: site marks within TRACKER_RADIUS on hidden nodes', () => {
    let s = go(go(go(atCamp({ seed: 21 }), { type: 'BUY_PREP', id: 'prep_spyglass' }), { type: 'SET_OUT' }), { type: 'LEAVE_HUB' });
    const far = s.zone.nodes.find((n) => n.ring === 3 && !s.zone.seen[n.id]).id;
    const r = R.step(s, { type: 'USE_SPYGLASS', nodeId: far });
    assert.equal(ev(r.events, 'time').length, 0);
    for (const id of [far, ...s.zone.nodes[far].nb]) assert.equal(R.mapView(r.state).nodes[id].know, 'full');
    assert.equal(r.state.exp.spyglass, C.SPYGLASS_CHARGES - 1);
    assert.ok(R.whyIllegal(go(go(atCamp({ seed: 21 }), { type: 'SET_OUT' }), { type: 'LEAVE_HUB' }), { type: 'USE_SPYGLASS', nodeId: far }));
    // Tracker: a Cull's hidden sites within TRACKER_RADIUS hops carry marks; without it, hidden nodes show none.
    const regs = zoneRegions(REAL, 1);
    for (const tracker of [true, false]) {
      let c = holding(atCamp({ seed: 21 }), 0, { z: 1, kind: 'cull', region: 0, family: regs[0].families[0] });
      if (tracker) c = go(c, { type: 'BUY_PREP', id: 'prep_tracker' });
      c = go(go(c, { type: 'SET_OUT' }), { type: 'LEAVE_HUB' });
      const v = R.mapView(c);
      for (const n of v.nodes) {
        const real = c.zone.nodes[n.id].sites;
        const shows = n.know === 'full' || (tracker && n.hops <= C.TRACKER_RADIUS);
        assert.deepEqual(n.sites, shows && real ? real : undefined, `tracker ${tracker} node ${n.id}`);
      }
    }
  });

  test('contractView names no site node; statuses; the summary lines; the Reserve Echo line', () => {
    let s = holding(atCamp({ seed: 30 }), 0, { z: 1, kind: 'delve' });
    s = go(go(go(s, { type: 'BUY_PREP', id: 'prep_draughts' }), { type: 'SET_OUT' }), { type: 'LEAVE_HUB' });
    const v = R.contractView(s);
    assert.ok(!JSON.stringify(v).includes('"sites"'));
    assert.deepEqual(Object.keys(v).sort(), ['contracts', 'held', 'hub', 'reserve', 'slots']);
    const sum = R.summary(s);
    // M2b v10 (D84): a Delve cost CONTRACT.delve.price 2; M2b v11 (D93): 1 again; M2b v12 (D100): 2 again
    const left = C.PREP_POINTS - C.CONTRACT.delve.price - C.PRICE_PREP_DRAUGHTS;
    assert.equal(left, 7);
    assert.deepEqual([sum.expedition.contracts.taken, sum.expedition.contracts.held, sum.expedition.contracts.bought, sum.expedition.contracts.reserve],
      [1, 1, ['prep_draughts'], left]);
    const line = sum.echoes.lines.find((l) => l.id === 'reserve');
    assert.deepEqual([line.count, line.each, line.echoes], [left, C.PREP_ECHO_PER_POINT, left * C.PREP_ECHO_PER_POINT]);
  });
});

describe('expedition.md 3.2, autoplay and the dev tools', () => {
  test('the story chain is retired on the expedition map (no story event); full autoplay runs pass PREP and some reach the boss', () => {
    let boss = 0;
    for (const [cls, seed] of [['hunter', 2], ['hunter', 6], ['hunter', 7], ['mage', 1], ['rogue', 4], ['mage', 6]]) {
      let s = R.newRun({ classId: cls, petId: pet(cls), seed, content: REAL, mapMode: 'expedition', prep: true });
      let stories = 0;
      let n = 0;
      while (s.phase !== 'ENDED' && n++ < 30000) {
        const r = R.step(s, R.autoAction(s));
        stories += ev(r.events, 'story').length;
        s = r.state;
      }
      assert.equal(s.phase, 'ENDED');
      assert.equal(stories, 0);
      const sum = s.result.summary;
      assert.equal(sum.stories, 0);
      assert.ok(sum.expedition.contracts.taken >= 1, 'autoplay takes contracts at PREP');
      if (sum.reachedBoss) boss++;
    }
    assert.ok(boss >= 1, `reached the boss in ${boss} runs`);
  });

  test('debug.build of an expedition run skips the camp (every point Reserve); validate accepts PREP; same seed, same camp', () => {
    const b = R.debug.build({ content: REAL, mapMode: 'expedition', zone: 2, prep: true }).state;
    assert.deepEqual([b.phase, b.prep.done, b.exp.reserve, b.zone.z], ['ZONE_HUB', true, C.PREP_POINTS, 2]);
    assert.deepEqual(R.debug.validate(b), []);
    const s = atCamp({ seed: 5 });
    assert.deepEqual(R.debug.validate(s), []);
    assert.equal(R.serialize(atCamp({ seed: 5 })), R.serialize(s));
    const fix = R.step(R.newRun({ classId: 'mage', seed: 5, content: CONTENT, mapMode: 'expedition', prep: true }), { type: 'START_RUN' }).state;
    assert.equal(fix.phase, 'PREP', 'fixture content (no regions) has a board too');
    assert.ok(fix.prep.board.every((o) => o.kind === 'delve' || o.family === null));
  });
});
