// M3 v3 (D153, docs/specs/changes-m3-v3.md): (2) Gorrak one level above the player (GATES.gorrakLevel, ONB_ELITE_LEVEL_MAX
// 8); (3) his bounty's XP on arrival at zone 2's hub, once, on a guided lean first run, whatever his fight's outcome; gold
// and the item choice on his victory (GATES.bountyRoad); (4) the class's first Deathblow fight on the profile (profile
// `deathblowMet`, windupView `firstDeathblow`), for the UI's prompt. Golden arms per switch: qa/engine/s18.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
const guided = (classId, seed, profile = null) => R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, tutorial: true, ...(profile ? { profile } : {}) });
const copy = (s) => { const o = JSON.parse(R.serialize(s)); o.content = CONTENT; return o; };
const ROAD_XP = Math.round(C.CULL_XP_FRAC * C.XP_WEIGHT_MULT * R.xpToNext(C.CONTRACT_CL_OFFSET));
function withGates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
/** Autoplay to zone 2's map (or the run's end), collecting events by zone. */
function toZone2(s, events = []) {
  for (let i = 0; i < 8000 && s.phase !== 'ENDED' && !(s.zone && s.zone.z === 2 && s.phase === 'MAP'); i++) {
    const r = R.step(s, R.autoAction(s));
    for (const e of r.events) events.push({ ...e, z: r.state.zone ? r.state.zone.z : null, lvl: r.state.player ? r.state.player.level : null });
    s = r.state;
  }
  return s;
}

describe('M3 v3 change 1: Gorrak one level above the player (GATES.gorrakLevel)', () => {
  test('clamp(L + ELITE_LEVEL_OFFSET, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX) as L grows; off: clamp(L, MIN, ONB_ELITE_LEVEL_MAX_V2)', () => {
    assert.deepEqual([C.ONB_ELITE_LEVEL_MIN, C.ONB_ELITE_LEVEL_MAX, C.ONB_ELITE_LEVEL_MAX_V2, C.ELITE_LEVEL_OFFSET], [4, 8, 6, 1]);
    let s = guided('mage', 5);
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) s = R.step(s, a).state;
    const id = R.tutorialView(s).eliteNodeId;
    const at = (L, gates = {}) => withGates(gates, () => {
      const x = copy(s);
      x.player.level = L;
      const y = R.step(R.step(x, { type: 'SET_AUTOPLAY', on: true }).state, { type: 'SET_AUTOPLAY', on: false }).state;
      return [y.zone.nodes[id].eliteLevel, R.mapView(y).nodes[id].know === 'full' ? R.mapView(y).nodes[id].level : null];
    });
    assert.deepEqual([1, 3, 5, 7, 9, 12].map((L) => at(L)[0]), [4, 4, 6, 8, 8, 8]);
    assert.deepEqual([1, 5, 7, 9].map((L) => at(L, { gorrakLevel: false })[0]), [4, 5, 6, 6]);
  });

  test('the route, every class, 20 run seeds: Gorrak at player 7 + 1 = 8, won with the Deathblow answered (G9 learned), no rescue, zone 1 left by a Road', () => {
    for (const classId of C.CLASS_IDS) {
      for (let seed = 1000; seed < 1020; seed++) {
        const events = [];
        let s = guided(classId, seed);
        let met = null;
        for (let i = 0; i < 8000 && !(s.zone && s.zone.z === 2); i++) {
          const before = s;
          const r = R.step(s, R.autoAction(s));
          events.push(...r.events);
          s = r.state;
          if (!before.fight && s.fight && s.fight.tut && s.fight.tut.kind === 'elite') met = [s.player.level, s.fight.enemies[0].level];
        }
        assert.deepEqual(met, [7, 8], `${classId} ${seed}`);
        assert.equal(s.tutorial.elite, 'victory');
        assert.equal(s.tutorial.rescues, 0);
        assert.ok(R.tutorialView(s).learned.includes('G9'), `${classId} ${seed}: G9`);
        assert.equal(s.stats.exp.zones.find((x) => x.z === 1).exit, 'road');
      }
    }
  });
});

describe('M3 v3 change 2: the bounty\'s XP on the road (GATES.bountyRoad)', () => {
  test('route: his victory pays gold and the item choice (bounty { xp: 0, gold }); zone 2\'s hub pays the guided Cull\'s XP once, after the zone event (bounty { xp, gold: 0, road: true }), never in zone 1', () => {
    for (const classId of C.CLASS_IDS) {
      const events = [];
      const s = toZone2(guided(classId, 1000), events);
      const bounties = events.filter((e) => e.t === 'bounty');
      assert.equal(bounties.length, 2, JSON.stringify(bounties));
      const [win, road] = bounties;
      assert.deepEqual([win.z, win.xp, win.gold > 0, win.road], [1, 0, true, undefined]);
      assert.deepEqual([road.z, road.xp, road.gold, road.road], [2, ROAD_XP, 0, true]);
      const xp = events.filter((e) => e.t === 'xp' && e.why === 'bounty');
      assert.deepEqual(xp.map((e) => [e.z, e.amount, e.heat]), [[2, ROAD_XP, undefined]], 'no heat at the hub; no level-difference modifier');
      const zi = events.findIndex((e) => e.t === 'zone' && e.z === 2);
      assert.ok(zi >= 0 && events.indexOf(xp[0]) > zi, 'after the zone event');
      assert.equal(s.tutorial.roadPaid, true);
      // levels: the route leaves zone 1 at 10 and reaches zone 2's hub at 12 (changes-m3-v3.md 5.3, the follower)
      assert.equal(events.filter((e) => e.t === 'travel').pop().lvl, 12);
    }
  });

  test('paid whatever happened at Gorrak: rescued at him (no gold or item), then the guide skipped; once only', () => {
    let s = guided('rogue', 1000);
    for (let i = 0; i < 4000 && !(s.fight && s.fight.tut && s.fight.tut.kind === 'elite'); i++) s = R.step(s, R.autoAction(s)).state;
    s = copy(s);
    s.player.hp = 1;
    for (const e of s.fight.enemies) e.dmg = 1e6;
    const events = [];
    for (let n = 0; s.fight && n < 10; n++) { const r = R.step(s, { type: 'PASS' }); s = r.state; events.push(...r.events); }
    assert.equal(s.tutorial.elite, 'rescue');
    s = R.step(s, { type: 'SKIP_GUIDE' }).state;
    s = toZone2(s, events);
    assert.equal(s.zone.z, 2);
    const b = events.filter((e) => e.t === 'bounty');
    assert.deepEqual(b.map((e) => [e.xp, e.gold, !!e.road]), [[ROAD_XP, 0, true]], 'no victory bounty; the road XP');
    assert.equal(events.filter((e) => e.t === 'gold' && e.why === 'bounty').length, 0);
  });

  test('not on a normal first run, not on "Play the guide again" (no bounty there), and with the switch off the XP comes with the victory as in D152', () => {
    const plain = [];
    toZone2(R.newRun({ classId: 'mage', seed: 1000, content: CONTENT }), plain);
    assert.ok(!plain.some((e) => e.t === 'bounty' || e.why === 'bounty'));
    const replay = [];
    let r = guided('mage', 1000, { ...R.newProfile(), runs: 1 });
    r = R.step(R.step(r, { type: 'START_RUN' }).state, { type: 'TAKE_CONTRACT', index: 0 }).state;
    toZone2(r, replay);
    assert.ok(!replay.some((e) => e.t === 'bounty' || e.why === 'bounty'));
    withGates({ bountyRoad: false }, () => {
      const ev = [];
      toZone2(guided('mage', 1000), ev);
      const b = ev.filter((e) => e.t === 'bounty');
      assert.deepEqual(b.map((e) => [e.z, e.xp > 0, e.gold > 0, !!e.road]), [[1, true, true, false]]);
    });
  });

  test('content line guide.bountyRoadLine (draft): {xp}, one sentence', () => {
    const line = CONTENT.tutorial.guide.bountyRoadLine;
    assert.ok(/\{xp\}/.test(line) && /\.$/.test(line) && line.length <= C.ONB_HINT_MAX_CHARS + 6, line);
  });
});

describe('M3 v3 section 4: the class\'s first Deathblow fight on the profile (profile deathblowMet, windupView firstDeathblow)', () => {
  /** windupView's Deathblow items each time a fight with one starts, until zone 3 or the end: [[classId flag per fight]]. */
  const firsts = (s, until = 3) => {
    const out = [];
    let rec = null;
    for (let i = 0; i < 12000 && s.phase !== 'ENDED' && !(s.zone && s.zone.z >= until); i++) {
      if (!s.fight) rec = null;
      else if (rec === null) {
        const db = (R.windupView(s) || []).filter((w) => w.deathblow);
        if (db.length) { rec = db[0].firstDeathblow; assert.ok(db.every((w) => w.firstDeathblow === rec)); out.push(rec); }
      }
      s = R.step(s, R.autoAction(s)).state;
    }
    return { s, out };
  };

  test('guided Mage: Gorrak\'s fight is the first (true), every later one not; the profile marks the Mage only; result.profile keeps it', () => {
    const { s, out } = firsts(guided('mage', 1011), 8); // seed 1011: Gorrak and three later fights with a Deathblow
    const seen = out;
    assert.equal(seen[0], true);
    assert.ok(seen.length >= 2 && seen.slice(1).every((x) => x === false), JSON.stringify(out));
    assert.deepEqual(s.profile.deathblowMet, { rogue: false, mage: true, hunter: false });
    let e = s;
    for (let i = 0; i < 20000 && e.phase !== 'ENDED'; i++) e = R.step(e, R.autoAction(e)).state;
    assert.deepEqual(e.result.profile.deathblowMet, { rogue: false, mage: true, hunter: false });
  });

  test('per class: a Rogue on that profile meets its first again; a guided run ("Play the guide again") clears every class; migrateProfile fills the key; a dev run marks nothing', () => {
    const prof = { ...R.newProfile(), runs: 3, deathblowMet: { rogue: false, mage: true, hunter: false } };
    const rogue = firsts(R.newRun({ classId: 'rogue', seed: 1006, content: CONTENT, profile: prof }), 8); // two Deathblow fights
    assert.equal(rogue.out[0], true);
    assert.deepEqual(rogue.s.profile.deathblowMet, { rogue: true, mage: true, hunter: false });
    const mage = R.newRun({ classId: 'mage', seed: 1001, content: CONTENT, profile: prof });
    assert.equal(mage.profile.deathblowMet.mage, true);
    assert.deepEqual(guided('mage', 1001, prof).profile.deathblowMet, { rogue: false, mage: false, hunter: false });
    const old = { ...R.newProfile(), runs: 4 };
    delete old.deathblowMet;
    assert.deepEqual(R.migrateProfile(old).deathblowMet, { rogue: false, mage: false, hunter: false });
    assert.deepEqual(R.migrateProfile({ ...old, deathblowMet: { hunter: true, x: true } }).deathblowMet, { rogue: false, mage: false, hunter: true });
    assert.deepEqual(R.debug.resetOnboarding(prof).deathblowMet, { rogue: false, mage: false, hunter: false });
    // a dev run's profile stays as it was
    let d = R.newRun({ classId: 'mage', seed: 1002, content: CONTENT, profile: { ...R.newProfile(), runs: 3 } });
    d = R.step(d, { type: 'START_RUN' }).state;
    d = copy(d);
    d.dev = { tools: ['test'], god: false, godUsed: false, n: 0, talentPoints: 0 };
    const dv = firsts(d, 8); // seed 1002: a dungeon boss
    assert.ok(dv.out.length > 0 && dv.out.every((x) => x === true));
    assert.deepEqual(dv.s.profile.deathblowMet, { rogue: false, mage: false, hunter: false });
  });

  test('only Deathblow items carry it; a normal fight\'s wind-ups have no firstDeathblow', () => {
    let s = guided('hunter', 1000);
    let seen = 0;
    for (let i = 0; i < 3000 && !(s.zone && s.zone.z === 2); i++) {
      s = R.step(s, R.autoAction(s)).state;
      for (const w of R.windupView(s) || []) {
        if (w.deathblow) assert.equal(typeof w.firstDeathblow, 'boolean');
        else { assert.equal(w.firstDeathblow, undefined); seen++; }
      }
    }
    assert.ok(seen > 0, 'a normal wind-up (S3\'s Hexer)');
  });
});
