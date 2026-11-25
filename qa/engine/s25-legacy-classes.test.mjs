// Legacy class numbers on the 1-25 scale (D157; docs/specs/legacy.md 2.4.2 and 10, draft): on top of 2.4.1, behind
// C.GATES.oruvathLegacy (off by default) with C.GATES.legacy (D158: Legacy runs only). One test per change of 2.4.2's table (items 1-9): the value off and on, and where
// the change is a learn level, the hero level at which a Legacy hero (both switches on) has the spell trained.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { petPct } from '../../src/engine/damage.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
function gates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
// D158: the numbers are Legacy-run numbers, so "on" is both switches (oruvathLegacy alone: rules.md's, qa/engine/s26)
const on = (fn) => gates({ legacy: true, oruvathLegacy: true }, fn);
const steps = (s, list) => { for (const a of list) s = R.step(s, a).state; return s; };
function heroRun(classId, H, seed = 7) {
  const prof = R.debug.setHero(R.newProfile(), classId, { level: H, xp: 0 });
  return steps(R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile: prof }), [{ type: 'START_RUN' }, { type: 'SET_OUT' }]);
}
/** The first hero level (1-25) at which a Legacy hero of classId starts the run with spell id trained. */
function learnHero(classId, id, set) {
  return gates(set, () => {
    for (let H = 1; H <= 25; H++) if (heroRun(classId, H).player.spells[id]) return H;
    return null;
  });
}
const LEG = { legacy: true };
const BOTH = { legacy: true, oruvathLegacy: true };

describe('legacy.md 2.4.2 (D157, draft): the nine changes behind GATES.oruvathLegacy', () => {
  test('1. Cinder Storm (Mage): lvl 22 off, 21 on; a Legacy Mage has it from hero 9 (off: hero 10)', () => {
    assert.equal(C.SPELL.cinder_storm.lvl, 22);
    assert.equal(on(() => C.SPELL.cinder_storm.lvl), 21);
    assert.deepEqual([learnHero('mage', 'cinder_storm', LEG), learnHero('mage', 'cinder_storm', BOTH)], [10, 9]);
  });

  test('2 and 9. BOSS_HP_LEVEL: hero 9 1.08, hero 23 / 24 / 25 0.93 / 0.92 / 0.92; the other entries as 2.4.1', () => {
    assert.deepEqual(C.BOSS_HP_LEVEL, [0.50, 0.53, 0.57, 0.61, 0.71, 0.84, 0.87, 0.90, 1.08, 1.12, 1.10, 1.07, 1.07, 1.07, 1.05, 1.03, 1.02, 1.01, 0.99, 0.96, 0.94, 0.94, 0.93, 0.92, 0.92]);
    assert.deepEqual([9, 23, 24, 25].map((H) => C.BOSS_HP_LEVEL[H - 1]), [1.08, 0.93, 0.92, 0.92]);
    // read in Oruvath's fight at hero 9 and 25 (both switches on)
    const hpScale = (LB) => (C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * LB) / (C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * 62);
    gates(BOTH, () => {
      for (const H of [9, 25]) {
        const b = R.debug.toBoss(heroRun('rogue', H, 51)).state.fight.enemies[0];
        const LB = R.powerOfLevel(H) + C.BOSS_TIER;
        assert.equal(b.maxHp, Math.round(C.BOSS_HP * (1 + b.asc) * hpScale(LB) * (H === 9 ? 1.08 : 0.92)));
      }
    });
  });

  test('3. Glacial Tomb (Mage): lvl 30 off, 43 on; a Legacy Mage has it from hero 18 (off: hero 13)', () => {
    assert.equal(C.SPELL.glacial_tomb.lvl, 30);
    assert.equal(on(() => C.SPELL.glacial_tomb.lvl), 43);
    assert.deepEqual([learnHero('mage', 'glacial_tomb', LEG), learnHero('mage', 'glacial_tomb', BOTH)], [13, 18]);
  });

  test('4. Feign Stillness (Hunter): lvl 28 off, 23 on; a Legacy Hunter has it from hero 10 (off: hero 12)', () => {
    assert.equal(C.SPELL.feign_stillness.lvl, 28);
    assert.equal(on(() => C.SPELL.feign_stillness.lvl), 23);
    assert.deepEqual([learnHero('hunter', 'feign_stillness', LEG), learnHero('hunter', 'feign_stillness', BOTH)], [12, 10]);
  });

  test('5. Heartseeker Shot (Hunter): lvl 46 -> 43 (hero 20 -> 18), b / l / p / w -5 %; its other fields unchanged', () => {
    const read = () => { const h = C.SPELL.heartseeker_shot; return [h.lvl, h.b, h.l, h.p, h.w]; };
    assert.deepEqual(read(), [46, 14, 3.0, 1.3, 1.5]);
    assert.deepEqual(on(read), [43, 13.3, 2.85, 1.235, 1.425]);
    assert.deepEqual(read(), [46, 14, 3.0, 1.3, 1.5]);
    assert.deepEqual([C.SPELL.heartseeker_shot.critBelow, C.SPELL.heartseeker_shot.critBonus, C.SPELL.heartseeker_shot.cd], [0.30, 0.5, 3]);
    assert.deepEqual([learnHero('hunter', 'heartseeker_shot', LEG), learnHero('hunter', 'heartseeker_shot', BOTH)], [20, 18]);
  });

  test('6. Barbed Arrow (Hunter) DoT: off l 0.45, p 0.18 (rules.md); on l 0.52, p 0.21 (2.4.1 was 0.495, 0.20)', () => {
    const read = () => [C.SPELL.barbed_arrow.dot.l, C.SPELL.barbed_arrow.dot.p, C.SPELL.barbed_arrow.dot.b, C.SPELL.barbed_arrow.dot.rounds];
    assert.deepEqual(read(), [0.45, 0.18, 2, 4]);
    assert.deepEqual(on(read), [0.52, 0.21, 2, 4]);
  });

  // D169 (legacy.md 2.4.3 item 1, draft): 0.10 -> 0.045 on
  test('7. Ferocity (h_a2): petDmgPct 0.18 off, 0.045 on (D169; D157 0.10), per rank; read by petPct', () => {
    assert.equal(C.TALENT.h_a2.petDmgPct, 0.18);
    assert.equal(on(() => C.TALENT.h_a2.petDmgPct), 0.045);
    assert.equal(C.TALENT.h_a2.petDmgPct, 0.18);
    assert.ok(C.ORUVATH_TALENT && C.ORUVATH_TALENT.h_a2.petDmgPct === 0.045);
    assert.equal(JSON.parse(JSON.stringify(C.TALENT.h_a2)).petDmgPct, 0.18);
    const s = R.debug.toBoss(R.debug.build({ content: CONTENT, classId: 'hunter', zone: 7 }).state).state;
    const t = JSON.parse(R.serialize(s)); t.content = CONTENT;
    t.player.talents = { h_a2: 3 };
    t.player.buffs = {};
    t.fight.p.st = [];
    assert.ok(Math.abs(petPct(t) - 0.54) < 1e-12);
    assert.ok(Math.abs(on(() => petPct(t)) - 0.135) < 1e-12);
  });

  test('8. Open Vein (Rogue) DoT: l 0.45, p 0.10 off; l 0.52, p 0.115 on (+15 %); perCp kept', () => {
    const read = () => [C.SPELL.open_vein.dot.l, C.SPELL.open_vein.dot.p, C.SPELL.open_vein.dot.perCp, C.SPELL.open_vein.lvl];
    assert.deepEqual(read(), [0.45, 0.10, true, 10]);
    assert.deepEqual(on(read), [0.52, 0.115, true, 10]);
  });

  test('ORUVATH_SPELL holds the 2.4.1 and 2.4.2 values (section 10 rows); off, every SPELL field is as rules.md', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(C.ORUVATH_SPELL)), {
      frost_lance: { l: 1.77, p: 0.97 },
      pyre_comet: { lvl: 21 },
      barbed_arrow: { dot: { l: 0.52, p: 0.21 } },
      field_dressing: { healPct: 0.18 },
      cinder_storm: { lvl: 21 },
      glacial_tomb: { lvl: 43 },
      feign_stillness: { lvl: 23 },
      heartseeker_shot: { lvl: 43, b: 13.3, l: 2.85, p: 1.235, w: 1.425 },
      open_vein: { dot: { l: 0.52, p: 0.115 } },
    });
  });
});
