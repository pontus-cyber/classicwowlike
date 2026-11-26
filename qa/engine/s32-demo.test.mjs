// The demo (docs/specs/demo.md 1-4 and 10, D170-D171, draft for the owner; engine-api.md 16): R.applyDemo() and the
// switch C.GATES.demo. Spec checks of 5.1 that run headless: A1 (a demo campaign per class from a fresh profile reaches the
// cut every run that does not die, hero and Legacy carried), A2 (cut fuzz: no zone 3, no Camp, no boss fight), A3 (the
// cap), A4 (the hall), A5 (the board), A6 (applyDemo sets exactly DEMO_GATES). Also: the cut by the Bell, a death in the
// Bell's Dimmed fight, the outcome's bookkeeping, and the switch off leaving every rule as before.
// DEMO_FULL=1 runs A2 at DEMO_FUZZ_RUNS per class and A5 at DEMO_BOARD_SEEDS seeds (the spec's counts; slow); the default
// runs a sample of each.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';

const C = R.C;
const FULL = !!process.env.DEMO_FULL;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
const steps = (s, list) => { for (const a of list) s = R.step(s, a).state; return s; };
const ended = (s) => s.phase === 'SUMMARY' || s.phase === 'ENDED';
/** Demo switches for the enclosing describe, every switch restored after it. */
function demoGates() {
  let saved = null;
  before(() => { saved = { ...C.GATES }; R.applyDemo(); });
  after(() => { R.setGates(saved); });
}
/** A later profile (no lean first run, no welcome) with the class's hero at level H. */
const later = (classId, H = 1, base = { ...R.newProfile(), runs: 2, welcome: true, guide: 'done' }) => R.debug.setHero(base, classId, { level: H, xp: 0 });
/** Play with the engine's autoplay policy until the run ends (or `stop(s)`); returns { s, events }. */
function autoRun(s, stop = null, max = 20000) {
  const events = [];
  for (let n = 0; n < max && !ended(s) && !(stop && stop(s)); n++) {
    const a = R.autoAction(s);
    if (!a) break;
    const r = R.step(s, a);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
/** A demo run of the class in zone 2's hub (autoplay through zone 1), hero at H. */
function inZone2(classId, seed, H = 3) {
  const s0 = steps(R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile: later(classId, H) }), [{ type: 'START_RUN' }]);
  return autoRun(s0, (s) => !!(s.zone && s.zone.z === 2)).s;
}

describe('demo.md 2.1-2.2, 10 (A6): applyDemo and the constants', () => {
  test('the switch is off by default; DEMO_GATES is every main default plus legacy, oruvathLegacy, economyV2, eliteSpread and demo', () => {
    assert.equal(C.GATES.demo, false);
    const main = { ...C.GATES };
    const want = { ...main, legacy: true, oruvathLegacy: true, economyV2: true, eliteSpread: true, demo: true };
    assert.deepEqual({ ...C.DEMO_GATES }, want);
    assert.ok(Object.isFrozen(C.DEMO_GATES));
    for (const k of ['swiftRoad', 'campReroll']) assert.equal(C.DEMO_GATES[k], false, k);
    for (const k of ['firstRunLean', 'gorrakBounty', 'guidedHold', 'steadyDim', 'rescueDim', 'gorrakLevel', 'bountyRoad', 'zone2InnerCap', 'z1Dmg', 'rewardPrimary', 'autoEmberFirst', 'boardAcrossRun', 'passStealth', 'sapHold', 'firstMeetWindup', 'rareHpMultZ1']) assert.equal(C.DEMO_GATES[k], true, k);
  });
  test('applyDemo() sets exactly DEMO_GATES (same object, no other key); setGates restores; a locked copy refuses changes', () => {
    const saved = { ...C.GATES };
    const g = C.GATES;
    try {
      C.GATES.stray = true;
      assert.equal(R.applyDemo(), g);
      assert.deepEqual({ ...C.GATES }, { ...C.DEMO_GATES });
    } finally { R.setGates(saved); }
    assert.deepEqual({ ...C.GATES }, saved);
    assert.equal(C.GATES, g);
    assert.equal(Object.isFrozen(C.GATES), false);
  });
  test('the section 10 constants', () => {
    assert.equal(C.DEMO_LAST_ZONE, 2);
    assert.equal(C.HERO_MAX_DEMO, 7);
    assert.deepEqual([...C.DEMO_HALL], ['satchel', 'vigor', 'edge', 'quick_study', 'pockets', 'cartographer', 'quartermaster']);
    assert.equal(C.DEMO_HALL_MAX_RANK, 1);
    assert.deepEqual(C.CONTRACT_BOARD_BANDS_DEMO, [[1, 1], [1, 2], [2, 2]]);
    assert.equal(C.DEMO_STORAGE_PREFIX, 'tbwcr.demo.');
    assert.equal(C.DEMO_END_MAX_WORDS, 80);
    assert.equal(C.DEMO_FUZZ_RUNS, 200);
    assert.equal(C.DEMO_BOARD_SEEDS, 200);
    // the hall's total (demo.md 3.2: 450) at the v3d prices
    assert.equal(C.DEMO_HALL.reduce((n, id) => n + C.META_HERO[id].costs[0], 0), 450);
  });
});

describe('demo.md 1.2: the cut at the zone 2 exit', () => {
  demoGates();
  test('a run made with the switch on is a demo run (state.demo, kept by serialize)', () => {
    const s = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT });
    assert.equal(s.demo, true);
    assert.equal(s.legacy, true);
    assert.equal(R.deserialize(R.serialize(s), CONTENT).demo, true);
  });
  test('the Road out of zone 2: travel, demoEnd, runEnd; outcome demo; zone 2 counted as left; never zone 3', () => {
    let s = inZone2('mage', 41);
    assert.equal(s.zone.z, 2);
    const r = autoRun(s);
    s = r.s;
    assert.equal(s.phase, 'SUMMARY');
    if (s.outcome === 'death') return; // the policy died in zone 2: A1 below covers the cut over many runs
    assert.equal(s.outcome, 'demo');
    const t = r.events.map((e) => e.t);
    const i = t.lastIndexOf('travel');
    assert.deepEqual(t.slice(i, i + 3), ['travel', 'demoEnd', 'runEnd']);
    const de = r.events.find((e) => e.t === 'demoEnd');
    assert.equal(de.zone, 2);
    assert.ok(['road', 'bell'].includes(de.by));
    assert.equal(r.events.find((e) => e.t === 'runEnd').outcome, 'demo');
    assert.ok(!r.events.some((e) => e.t === 'zone' && e.z > 2), 'no zone 3 entered');
    assert.equal(s.zone.z, 2);
    const sm = R.summary(s);
    assert.deepEqual(sm.demo, { lastZone: 2 });
    assert.equal(sm.demoRun, true);
    assert.equal(sm.outcome, 'demo');
    assert.equal(s.stats.zonesLeft, 2);
    assert.ok(sm.legacy.lines.some((l) => l.id === 'zones' && l.count === 2 && l.each === C.LEGACY_PER_ZONE_HERO));
    assert.equal(sm.reachedBoss, false);
  });
  test('the Bell out of zone 2 ends the run the same way (by: bell); the hub is never Dimmed, so no fight comes first', () => {
    let s = inZone2('rogue', 43);
    assert.equal(s.phase, 'ZONE_HUB');
    if (s.exp.bell < 1) s.exp.bell = 1;
    // out of the hub onto the map, then ring the Bell where the hero stands
    if (R.isLegal(s, { type: 'LEAVE_HUB' })) s = R.step(s, { type: 'LEAVE_HUB' }).state;
    assert.ok(R.isLegal(s, { type: 'RING_BELL' }), R.whyIllegal(s, { type: 'RING_BELL' }));
    const r = R.step(s, { type: 'RING_BELL' });
    const t = r.events.map((e) => e.t);
    assert.equal(r.state.outcome, 'demo');
    assert.ok(t.includes('demoEnd'));
    assert.equal(r.events.find((e) => e.t === 'demoEnd').by, 'bell');
    assert.equal(r.state.phase, 'SUMMARY');
  });
  test('zone 1 is left as before: the Road out of zone 1 enters zone 2 (no demoEnd)', () => {
    const s0 = steps(R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 45, content: CONTENT, profile: later('hunter', 2) }), [{ type: 'START_RUN' }]);
    const r = (() => { let s = s0; const ev = []; for (let n = 0; n < 20000 && !(s.zone && s.zone.z === 2) && !ended(s); n++) { const x = R.step(s, R.autoAction(s)); s = x.state; ev.push(...x.events); } return { s, ev }; })();
    if (r.s.outcome === 'death') return;
    assert.equal(r.s.zone.z, 2);
    assert.ok(!r.ev.some((e) => e.t === 'demoEnd'));
  });
  test('END_RUN after outcome demo: Legacy paid, hero written (runs + 1, wins unchanged), profile runs + 1, welcome set', () => {
    let s = inZone2('mage', 47);
    s = autoRun(s).s;
    if (s.outcome !== 'demo') return;
    const before = s.profile;
    const sm = R.summary(s);
    const r = R.step(s, { type: 'END_RUN' });
    const p = r.state.result.profile;
    assert.equal(p.runs, before.runs + 1);
    assert.equal(p.legacy, before.legacy + sm.legacy.total);
    assert.equal(p.heroes.mage.runs, (before.heroes.mage.runs || 0) + 1);
    assert.equal(p.heroes.mage.wins, before.heroes.mage.wins || 0);
    assert.equal(p.heroes.mage.level, sm.hero.level);
    assert.equal(p.welcome, true);
  });
  test('a run left on a rows map (TRAVEL_ON out of zone 2) ends at the cut too', () => {
    let cut = 0;
    for (const seed of [5, 6, 7, 8]) {
      let s = steps(R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows', profile: later('rogue', 6) }), [{ type: 'START_RUN' }]);
      const r = autoRun(s);
      s = r.s;
      assert.ok(!r.events.some((e) => e.t === 'zone' && e.z > 2) && s.zone.z <= 2);
      if (s.outcome === 'death') continue;
      assert.equal(s.outcome, 'demo');
      assert.equal(r.events.find((e) => e.t === 'demoEnd').by, 'travel');
      cut += 1;
    }
    assert.ok(cut >= 1);
  });
});

describe('demo.md 1.2: a death in the Bell\'s Dimmed fight is a death', () => {
  demoGates();
  test('the Bell rung on a Dimmed node fights first; a death there is outcome death (no demoEnd); a win ends at the cut', async () => {
    const { dimmedNow } = await import('../../src/engine/expedition.js');
    const outcomes = new Set();
    for (const [seed, hp] of [[49, 1], [49, null]]) {
      let s = inZone2('mage', seed, 5);
      if (R.isLegal(s, { type: 'LEAVE_HUB' })) s = R.step(s, { type: 'LEAVE_HUB' }).state;
      s.exp.bell = Math.max(1, s.exp.bell);
      // the hero on a ring 1 node deep in the dark (the zone's clock moved back): that node is Dimmed now
      const n = s.zone.nodes.find((x) => x.ring === 1);
      s.zone.pos = n.id;
      s.zone.start -= 500;
      assert.ok(dimmedNow(s), 'the hero\'s node is Dimmed');
      if (hp) s.player.hp = hp;
      const r = R.step(s, { type: 'RING_BELL' });
      assert.ok(r.state.fight, 'the Dimmed encounter starts before the Bell completes');
      assert.ok(!r.events.some((e) => e.t === 'demoEnd'));
      const out = autoRun(r.state);
      outcomes.add(out.s.outcome);
      if (out.s.outcome === 'death') assert.ok(!out.events.some((e) => e.t === 'demoEnd'));
      else { assert.equal(out.s.outcome, 'demo'); assert.equal(out.events.find((e) => e.t === 'demoEnd').by, 'bell'); }
    }
    assert.ok(outcomes.has('death'), 'the 1-HP hero died in the Dimmed fight');
  });
});

describe('demo.md 3.1 (A3): the hero cap HERO_MAX_DEMO', () => {
  demoGates();
  test('a hero at 6 gains to 7 and stops: XP 0, further XP not counted (capped events), atMax and cap demo; no heroMax', () => {
    const s0 = steps(R.newRun({ classId: 'rogue', seed: 51, content: CONTENT, profile: later('rogue', 6) }), [{ type: 'START_RUN' }]);
    assert.equal(s0.player.heroLevel, 6);
    const r = autoRun(s0);
    const s = r.s;
    const ups = r.events.filter((e) => e.t === 'levelUp');
    assert.ok(ups.every((e) => e.heroLevel <= 7), 'no level past 7');
    assert.ok(!r.events.some((e) => e.t === 'heroMax'));
    if (s.player.heroLevel === 7) {
      assert.equal(ups.at(-1).heroLevel, 7);
      assert.equal(ups.at(-1).cap, 'demo');
      assert.equal(s.player.xp, 0);
      const i = r.events.indexOf(ups.at(-1));
      const after = r.events.slice(i + 1).filter((e) => e.t === 'xp');
      assert.ok(after.length > 0, 'XP events after the cap');
      for (const e of after) assert.deepEqual([e.amount, e.capped], [0, true]);
      const hv = R.heroView(s);
      assert.equal(hv.atMax, true);
      assert.equal(hv.cap, 'demo');
      const sm = R.summary(s);
      const lv = sm.legacy.lines.find((l) => l.id === 'levels');
      assert.equal(lv.count, 1); // one level gained, no XP-past-max line
    }
  });
  test('at the cap: gainXp counts nothing and spends no rested XP; heroesView marks the hero', async () => {
    const { gainXp } = await import('../../src/engine/progress.js');
    const s = steps(R.newRun({ classId: 'mage', seed: 53, content: CONTENT, profile: later('mage', 7) }), [{ type: 'START_RUN' }]);
    s.player.rested = 100;
    const ev = [];
    assert.equal(gainXp(s, ev, 500, 'kill', true), 0);
    assert.deepEqual(ev, [{ t: 'xp', amount: 0, rested: 0, why: 'kill', capped: true }]);
    assert.equal(s.player.xp, 0);
    assert.equal(s.player.rested, 100);
    const hv = R.heroesView(later('mage', 7));
    assert.equal(hv[1].atMax, true);
    assert.equal(hv[1].cap, 'demo');
    assert.equal(R.heroesView(later('mage', 6))[1].atMax, false);
  });
  test('below the cap XP counts as in the full game', async () => {
    const { gainXp } = await import('../../src/engine/progress.js');
    const s = steps(R.newRun({ classId: 'mage', seed: 53, content: CONTENT, profile: later('mage', 3) }), [{ type: 'START_RUN' }]);
    const ev = [];
    assert.equal(gainXp(s, ev, 100, 'kill'), 100);
    assert.equal(ev[0].capped, undefined);
  });
});

describe('demo.md 3.2 (A4): the demo hall', () => {
  demoGates();
  test('metaOffers lists exactly DEMO_HALL, rank I only (ranks 1), at the v3d prices', () => {
    const p = R.newProfile();
    const o = R.metaOffers(p);
    assert.deepEqual(o.map((x) => x.id), [...C.DEMO_HALL]);
    for (const x of o) { assert.equal(x.ranks, 1, x.id); assert.equal(x.nextCost, C.META_HERO[x.id].costs[0], x.id); }
  });
  test('BUY of an entry outside the demo, or of a second rank, is refused ("not in the demo" / not available)', () => {
    let p = { ...R.newProfile(), legacy: 5000 };
    for (const id of ['second_breath', 'old_hand', 'swift_boots', 'stormhawk', 'sp_r1', 'oaths']) assert.throws(() => R.buyMeta(p, id), /not in the demo/, id);
    p = R.buyMeta(p, 'vigor');
    assert.equal(p.unlocks.vigor, 1);
    assert.throws(() => R.buyMeta(p, 'vigor'), /not available/);
    const o = R.metaOffers(p).find((x) => x.id === 'vigor');
    assert.deepEqual([o.rank, o.ranks, o.nextCost, o.available], [1, 1, null, false]);
    for (const id of C.DEMO_HALL) if (id !== 'vigor') p = R.buyMeta(p, id);
    assert.ok(R.metaOffers(p).every((x) => !x.available));
    assert.equal(p.spent, 450);
  });
  test('the welcome is paid once per demo profile', () => {
    let s = R.newRun({ classId: 'rogue', seed: 9, content: CONTENT, tutorial: true });
    s = steps(s, [{ type: 'START_RUN' }]);
    s = autoRun(s).s;
    const sm = R.summary(s);
    assert.ok(sm.legacy.lines.some((l) => l.id === 'welcome'));
    const p = R.step(s, { type: 'END_RUN' }).state.result.profile;
    let s2 = steps(R.newRun({ classId: 'mage', seed: 10, content: CONTENT, profile: p }), [{ type: 'START_RUN' }]);
    s2 = autoRun(s2).s;
    assert.ok(!R.summary(s2).legacy.lines.some((l) => l.id === 'welcome'));
  });
});

describe('demo.md 4.3 (A5): the contract board, zones 1-2 only', () => {
  demoGates();
  const N = FULL ? C.DEMO_BOARD_SEEDS : 40;
  test(`${N} seeds × runs 1-5: no offer outside zones 1-2; the first run none, the second one zone 1 offer, then CONTRACT_BOARD_BANDS_DEMO`, () => {
    for (let seed = 1; seed <= N; seed++) {
      for (let runs = 0; runs <= 4; runs++) {
        const prof = { ...R.newProfile(), runs, welcome: runs > 0, guide: runs > 0 ? 'done' : 'todo' };
        const s = steps(R.newRun({ classId: 'rogue', seed, content: CONTENT, profile: prof }), [{ type: 'START_RUN' }]);
        const b = R.prepView(s).board;
        if (runs === 0) assert.equal(b.length, 0);
        else if (runs === 1) { assert.equal(b.length, 1); assert.equal(b[0].z, 1); } else {
          assert.equal(b.length, 3);
          b.forEach((o, i) => { const [lo, hi] = C.CONTRACT_BOARD_BANDS_DEMO[i]; assert.ok(o.z >= lo && o.z <= hi, `seed ${seed} run ${runs + 1} slot ${i}: zone ${o.z}`); });
        }
      }
    }
  });
});

describe('demo.md 5.1 A1: a demo campaign per class from a fresh profile (autoplay policy)', () => {
  demoGates();
  for (const cls of ['rogue', 'mage', 'hunter']) {
    test(`${cls}: guided run, then runs to the cap (at most 14): every run ends at the cut or by death; hero and Legacy carried; never past zone 2`, () => {
      let prof = R.newProfile();
      let heroLevel = 1; let cut = 0;
      for (let run = 0; run < 14; run++) {
        let s = R.newRun({ classId: cls, petId: PET(cls), seed: 7000 + run * 13 + cls.length, content: CONTENT, profile: prof, tutorial: prof.guide === 'todo' });
        s = steps(s, [{ type: 'START_RUN' }]);
        assert.equal(s.player.heroLevel, heroLevel, `run ${run + 1} starts at the kept level`);
        let n = 0;
        while (!ended(s) && n < 20000) {
          s = R.step(s, R.autoAction(s)).state; n++;
          if (s.zone) assert.ok(!s.zone.camp && s.zone.z <= 2, `run ${run + 1}: zone ${s.zone.z}`);
          if (s.fight) assert.notEqual(s.fight.kind, 'boss');
        }
        assert.ok(['demo', 'death'].includes(s.outcome), `run ${run + 1}: ${s.outcome}`);
        const sm = R.summary(s);
        if (s.outcome === 'demo') { cut += 1; assert.deepEqual(sm.demo, { lastZone: 2 }); } else assert.equal(sm.demo, undefined);
        const before = prof.legacy;
        prof = R.step(s, { type: 'END_RUN' }).state.result.profile;
        assert.equal(prof.legacy, before + sm.legacy.total);
        heroLevel = prof.heroes[cls].level;
        assert.ok(heroLevel <= C.HERO_MAX_DEMO);
        // buy in the planner's order (demo.md 6) what the balance covers
        for (const id of C.DEMO_HALL) { const o = R.metaOffers(prof).find((x) => x.id === id); if (o.affordable) prof = R.buyMeta(prof, id); }
        if (heroLevel >= C.HERO_MAX_DEMO) break;
      }
      assert.ok(cut >= 1, 'at least one run reached the cut');
    });
  }
});

describe('demo.md 5.1 A2: cut fuzz (random legal actions, autoplay mixed in)', () => {
  demoGates();
  const N = FULL ? C.DEMO_FUZZ_RUNS : 10;
  for (const cls of ['rogue', 'mage', 'hunter']) {
    test(`${cls}: ${N} runs: no state with zone > 2, a Camp or a boss fight`, () => {
      let rs = 977 + cls.length; const rnd = (n) => { rs = (Math.imul(rs, 1103515245) + 12345) >>> 0; return rs % n; };
      for (let i = 0; i < N; i++) {
        const prof = later(cls, 1 + (i % 7), { ...R.newProfile(), runs: 1 + (i % 4), welcome: true, guide: 'done' });
        let s = R.newRun({ classId: cls, petId: PET(cls), seed: 900 + i, content: CONTENT, profile: prof });
        for (let n = 0; n < 20000 && !ended(s); n++) {
          const L = R.legalActions(s);
          if (!L.length) break;
          const a = (s.fight && rnd(10) < 9) || rnd(10) < 3 ? R.autoAction(s) || L[rnd(L.length)] : L[rnd(L.length)];
          s = R.step(s, a).state;
          if (s.zone) assert.ok(!s.zone.camp && s.zone.z <= 2, `run ${i}: zone ${s.zone.z}`);
          if (s.fight) assert.notEqual(s.fight.kind, 'boss');
        }
        assert.ok(ended(s));
        assert.ok(['demo', 'death'].includes(s.outcome), s.outcome);
      }
    });
  }
});

describe('the switch off: nothing of the demo is read', () => {
  test('a run is no demo run, the hall is META_HERO / META in full, the hero cap is HERO_MAX_LEVEL, the board as before', () => {
    assert.equal(C.GATES.demo, false);
    const s = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT });
    assert.equal(s.demo, undefined);
    assert.equal(R.metaOffers(R.newProfile()).length, Object.keys(C.META).length);
    const saved = { ...C.GATES };
    try {
      Object.assign(C.GATES, { legacy: true, oruvathLegacy: true, economyV2: true });
      assert.equal(R.metaOffers(R.newProfile()).length, Object.keys(C.META_HERO).length);
      const s3 = steps(R.newRun({ classId: 'mage', seed: 3, content: CONTENT, profile: later('mage', 7) }), [{ type: 'START_RUN' }]);
      assert.equal(R.heroView(s3).atMax, false);
      assert.equal(R.heroView(s3).cap, undefined);
      assert.equal(R.heroesView(later('mage', 7))[1].atMax, undefined);
    } finally { R.setGates(saved); }
  });
});
