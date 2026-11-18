// D158: the D156 / D157 numbers and boss rules (docs/specs/legacy.md 2.4.1-2.4.2, draft) apply only in Legacy runs, i.e.
// with C.GATES.legacy and C.GATES.oruvathLegacy both on; a level-60 run never sees them. Then the Legacy helpers for the UI
// (engine-api.md 15.4): learnLevel (a spell's learn level on the hero scale), zoneTierDmg and mapView.tierDmg
// (ZONE_TIER_DMG), and the content's Legacy wording of the lines that name Echoes (SCHEMA.md 2.11 `legacy`, draft).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { oruvathScale, oruvathRules, legacyNumbersOn, learnHeroLevel, finalDarkRound } from '../../src/engine/legacy.js';
import { zoneDanger } from '../../src/engine/combat.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
function gates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
const BOTH = { legacy: true, oruvathLegacy: true };
const steps = (s, list) => { for (const a of list) s = R.step(s, a).state; return s; };
function heroRun(classId, H, seed = 7) {
  const prof = R.debug.setHero(R.newProfile(), classId, { level: H, xp: 0 });
  return steps(R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile: prof }), [{ type: 'START_RUN' }, { type: 'SET_OUT' }]);
}
/** Every field ORUVATH_SPELL / ORUVATH_TALENT name, as the SPELL / TALENT tables read now. */
function numbers() {
  const out = {};
  const walk = (obj, now, key) => {
    for (const [k, v] of Object.entries(now)) {
      if (v && typeof v === 'object') walk(obj[k], v, `${key}.${k}`);
      else out[`${key}.${k}`] = obj[k];
    }
  };
  for (const [id, now] of Object.entries(C.ORUVATH_SPELL)) walk(C.SPELL[id], now, id);
  for (const [id, now] of Object.entries(C.ORUVATH_TALENT)) walk(C.TALENT[id], now, id);
  return out;
}
const flat = (obj, key = '') => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${key}${k}.`) : [[`${key}${k}`, v]]));

describe('D158: the D156 / D157 numbers in Legacy runs only (both switches)', () => {
  test('ORUVATH_SPELL and ORUVATH_TALENT: rules.md values unless both switches are on', () => {
    const off = numbers();
    const want = Object.fromEntries([...flat(C.ORUVATH_SPELL), ...flat(C.ORUVATH_TALENT)]);
    assert.notDeepEqual(off, want);
    assert.deepEqual(gates({ oruvathLegacy: true }, numbers), off);
    assert.deepEqual(gates({ legacy: true }, numbers), off);
    assert.deepEqual(gates(BOTH, numbers), want);
    assert.deepEqual(numbers(), off);
    assert.deepEqual([legacyNumbersOn(), gates({ oruvathLegacy: true }, legacyNumbersOn), gates(BOTH, legacyNumbersOn)], [false, false, true]);
  });

  test('oruvathRules: a Legacy run with both switches on; never a level-60 run', () => {
    const lv60 = R.debug.build({ content: CONTENT, classId: 'mage', zone: 7 }).state;
    const leg = gates({ legacy: true }, () => heroRun('mage', 12));
    assert.deepEqual([lv60.legacy, leg.legacy], [undefined, true]);
    for (const [set, a, b] of [[{}, false, false], [{ oruvathLegacy: true }, false, false], [{ legacy: true }, false, false], [BOTH, false, true]]) {
      assert.deepEqual(gates(set, () => [oruvathRules(lv60), oruvathRules(leg)]), [a, b], JSON.stringify(set));
    }
  });

  test('Oruvath: a Legacy run under oruvathLegacy with legacy off plays the 2.4 numbers (no shardHp, no finalDark)', () => {
    const s = gates({ legacy: true }, () => heroRun('rogue', 16, 51));
    const danger = (M, v) => zoneDanger(M, v);
    const old = oruvathScale(s, danger);
    assert.ok(!('finalDark' in old));
    assert.deepEqual(gates({ oruvathLegacy: true }, () => oruvathScale(s, danger)), old);
    const now = gates(BOTH, () => oruvathScale(s, danger));
    assert.deepEqual(['shardHp' in now, now.finalDark], [true, finalDarkRound(16)]);
    assert.equal(oruvathScale(R.debug.build({ content: CONTENT, classId: 'rogue', zone: 7 }).state, danger), null);
  });

  test('a level-60 run with oruvathLegacy on plays as with it off, action for action (autoplay, 3 classes)', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const play = () => {
        let s = R.newRun({ classId, petId: PET(classId), seed: 4242, content: CONTENT, mapMode: 'expedition', prep: true });
        s = R.step(s, { type: 'START_RUN' }).state;
        const out = [];
        for (let i = 0; i < 400 && s.phase !== 'ENDED'; i++) {
          const a = R.autoAction(s);
          if (!a) break;
          out.push(JSON.stringify(a));
          s = R.step(s, a).state;
        }
        return { acts: out, hp: s.player.hp, level: s.player.level, time: s.time };
      };
      const off = play();
      assert.ok(off.acts.length > 50, classId);
      assert.deepEqual(gates({ oruvathLegacy: true }, play), off, classId);
    }
  });
});

describe('learnLevel: a spell\'s learn level on the hero scale (legacy.md 1.7; UI open item 1)', () => {
  test('learnHeroLevel: the first hero level whose power level reaches M', () => {
    for (let M = 1; M <= C.MAX_LEVEL; M++) {
      const H = learnHeroLevel(M);
      assert.ok(C.POWER_OF_LEVEL[H - 1] >= M, `M ${M}`);
      if (H > 1) assert.ok(C.POWER_OF_LEVEL[H - 2] < M, `M ${M}`);
    }
    assert.deepEqual([1, 3, 4, 21, 22, 46, 60].map(learnHeroLevel), [1, 2, 3, 9, 10, 20, 25]);
  });

  test('in a Legacy run: the hero level that has the spell trained at the run start; the 14 spells shownLevel shows one too low', () => {
    const low = [];
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const runs = gates({ legacy: true }, () => Array.from({ length: 25 }, (_, i) => heroRun(classId, i + 1)));
      for (const sp of Object.values(C.SPELL).filter((x) => x.cls === classId && x.source === 'class')) {
        const first = runs.findIndex((s) => s.player.spells[sp.id]) + 1;
        assert.equal(R.learnLevel(runs[0], sp.id), first, sp.id);
        if (R.shownLevel(runs[0], sp.lvl) !== first) low.push(sp.id);
      }
    }
    assert.equal(low.length, 14, low.join(','));
    const s = gates({ legacy: true }, () => heroRun('rogue', 5));
    assert.deepEqual([R.learnLevel(s, 'shadowstep_strike'), R.shownLevel(s, 4), R.learnLevel(s, 46), R.learnLevel(s, 'no_such_spell')], [3, 2, 20, null]);
  });

  test('the D157 learn levels with both switches on (hero 9, 18, 10, 18); outside a Legacy run the engine level', () => {
    const s = gates(BOTH, () => heroRun('mage', 5));
    gates(BOTH, () => assert.deepEqual(['pyre_comet', 'cinder_storm', 'glacial_tomb', 'feign_stillness', 'heartseeker_shot'].map((id) => R.learnLevel(s, id)), [9, 9, 18, 10, 18]));
    const plain = R.step(R.newRun({ classId: 'rogue', seed: 3, content: CONTENT }), { type: 'START_RUN' }).state;
    assert.deepEqual([R.learnLevel(plain, 'shadowstep_strike'), R.learnLevel(plain, 'final_reckoning'), R.learnLevel(plain, 12)], [4, 44, 12]);
  });
});

describe('zoneTierDmg and mapView.tierDmg (legacy.md 2.2; UI open item 2)', () => {
  test('a Legacy run: mapView.tierDmg is ZONE_TIER_DMG of the zone; zoneTierDmg for any zone and the Camp (zone 6\'s)', () => {
    const s = gates({ legacy: true }, () => heroRun('hunter', 8));
    assert.equal(s.zone.z, 1);
    assert.equal(R.mapView(s).tierDmg, C.ZONE_TIER_DMG[0]);
    assert.equal(R.zoneTierDmg(s), C.ZONE_TIER_DMG[0]);
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((z) => R.zoneTierDmg(s, z)), [...C.ZONE_TIER_DMG, C.ZONE_TIER_DMG[5]]);
    const camp = gates({ legacy: true }, () => R.debug.toCamp(s).state);
    assert.equal(camp.zone.camp, true);
    assert.equal(R.mapView(camp), null);
    assert.equal(R.zoneTierDmg(camp), C.ZONE_TIER_DMG[5]);
  });

  test('the factor is what a template enemy deals on top of zone danger (zone 1-6 enemies in a Legacy run)', () => {
    const s = gates({ legacy: true }, () => heroRun('rogue', 14, 11));
    const home = (id) => R.debug.enemies(CONTENT).find((x) => x.id === id).zone;
    const byZone = {};
    for (const x of R.debug.enemies(CONTENT)) if (x.kind === 'normal' && x.zone >= 1 && x.zone <= 6 && !byZone[x.zone]) byZone[x.zone] = x.id;
    for (const [z, id] of Object.entries(byZone)) {
      const dmg = (legacy) => {
        const o = JSON.parse(R.serialize(s)); o.content = CONTENT; o.legacy = legacy;
        return R.debug.encounter(o, { ids: [id], level: 30 }).state.fight.enemies[0].dmg;
      };
      assert.equal(home(id), Number(z));
      assert.ok(Math.abs(dmg(true) / dmg(false) - R.zoneTierDmg(s, Number(z))) < 1e-9, `zone ${z} ${id}`);
    }
    assert.equal(Object.keys(byZone).length, 6);
  });

  test('outside a Legacy run: no tierDmg on mapView (both map modes) and zoneTierDmg 1', () => {
    const rows = R.step(R.newRun({ classId: 'mage', seed: 5, content: CONTENT, mapMode: 'rows' }), { type: 'START_RUN' }).state;
    const exp = steps(R.newRun({ classId: 'mage', seed: 5, content: CONTENT, mapMode: 'expedition', prep: true }), [{ type: 'START_RUN' }, { type: 'SET_OUT' }]);
    for (const s of [rows, exp]) {
      assert.ok(R.mapView(s), s.mapMode);
      assert.ok(!('tierDmg' in R.mapView(s)), s.mapMode);
      assert.equal(R.zoneTierDmg(s), 1);
    }
  });
});

describe('content: the lines that name Echoes read Legacy wording under GATES.legacy (draft; UI open item 5)', () => {
  const T = CONTENT.tutorial;
  const h37 = () => T.hints.find((x) => x.id === 'H37');
  test('off: as written; on: Legacy points and the Legacy hall; the placeholders kept', () => {
    assert.equal(T.prep.unspentFirst, 'Points you do not spend: +{echoes} Echoes at the end of the run.');
    assert.deepEqual([h37().system, h37().line], ['Hall of Echoes', 'Echoes buy lasting unlocks. They stay when a run ends.']);
    gates({ legacy: true }, () => {
      assert.equal(T.prep.unspentFirst, 'Points you do not spend: +{echoes} Legacy points at the end of the run.');
      assert.deepEqual([h37().system, h37().line], ['Legacy hall', 'Legacy points buy lasting unlocks. They stay when a run ends.']);
      assert.deepEqual(JSON.parse(JSON.stringify(T.prep)).unspentFirst, T.prep.unspentFirst);
    });
    assert.equal(T.prep.unspentFirst, 'Points you do not spend: +{echoes} Echoes at the end of the run.');
  });

  test('with GATES.legacy on, no tutorial line names Echoes; every Legacy entry names a field that exists', () => {
    const lines = (o) => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? lines(v) : []));
    const shown = { ...T };
    delete shown.legacy;
    gates({ legacy: true }, () => {
      const bad = lines(JSON.parse(JSON.stringify(shown))).filter((x) => /\bEcho(es)?\b/.test(x));
      assert.deepEqual(bad, []);
    });
    for (const k of Object.keys(T.legacy.prep)) assert.ok(k in T.prep, k);
    for (const [id, f] of Object.entries(T.legacy.hints)) for (const k of Object.keys(f)) assert.ok(k in T.hints.find((x) => x.id === id), `${id}.${k}`);
    gates({ legacy: true }, () => assert.doesNotThrow(() => R.newRun({ classId: 'rogue', seed: 1, content: CONTENT, validate: true })));
  });
});
