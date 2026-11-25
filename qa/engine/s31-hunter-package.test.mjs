// D169 Hunter package (docs/specs/legacy.md 2.4.3, draft; report legacy-hunter-dungeon-2026-11-20 sections 4-6), behind the
// D157 gates (C.GATES.legacy and oruvathLegacy, D158): item 1 Ferocity 0.045 a rank (pinned in s25 item 7), item 2 Lost
// Technique I (Hunter) as a Keen Shot passive in Legacy runs: no Ricochet Bolt is taught; while owned, from power
// KEEN_RICOCHET.lvl (hero 9), Keen Shot also hits up to two other living enemies for 30 % of its hit. Level-60 runs, and
// Legacy runs with oruvathLegacy off, keep Ricochet Bolt and a one-target Keen Shot.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { trainerSpells } from '../../src/engine/nodes.js';

const C = R.C;
const K = C.KEEN_RICOCHET;
function gates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
const BOTH = { legacy: true, oruvathLegacy: true };
const LEG = { legacy: true, oruvathLegacy: false };
const OFF = { legacy: false, oruvathLegacy: false };
const steps = (s, list) => { for (const a of list) s = R.step(s, a).state; return s; };
const owning = (prof, ids) => { prof.unlocks = { ...(prof.unlocks || {}), ...Object.fromEntries(ids.map((id) => [id, 1])) }; return prof; };
/** A hero of classId at hero level H (Legacy) after SET_OUT; tech: owns Lost Technique I (Hunter). */
function heroRun(classId, H, { tech = true, seed = 7 } = {}) {
  const prof = owning(R.debug.setHero(R.newProfile(), classId, { level: H, xp: 0 }), tech ? ['sp_h1'] : []);
  return steps(R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed, content: CONTENT, profile: prof }), [{ type: 'START_RUN' }, { type: 'SET_OUT' }]);
}
/** A level-60 run (GATES.legacy off) at engine level L owning Lost Technique I (Hunter). */
function level60(L, { tech = true } = {}) {
  const prof = owning(R.newProfile(), tech ? ['sp_h1'] : []);
  return R.debug.build({ content: CONTENT, classId: 'hunter', zone: 4, level: L, profile: prof, seed: 5 }).state;
}
/** One Keen Shot at enemy 0 of a three-enemy fight: the enemies it reached (damage or miss events of keen_shot). */
function keenTargets(s) {
  let f = R.debug.encounter(s, { ids: ['z1_hedge_ogre', 'z1_furrow_boar', 'z1_barn_wolf'] }).state;
  f = R.debug.setGod(f).state;
  f.player.mana = 9999;
  const r = R.step(f, { type: 'CAST', spellId: 'keen_shot', target: 0 });
  assert.equal(r.error || null, null, r.error);
  const hits = r.events.filter((e) => (e.t === 'damage' || e.t === 'miss') && e.spell === 'keen_shot' && e.src === 'player');
  return { dst: hits.map((e) => e.dst), events: r.events, state: r.state };
}

describe('D169 item 2: Lost Technique I (Hunter) in Legacy runs', () => {
  test('KEEN_RICOCHET: two other enemies, 30 %, from power 20 (Ricochet Bolt\'s learn level, hero 9), sp_h1, Keen Shot', () => {
    assert.deepEqual({ ...K }, { id: 'keen_ricochet', meta: 'sp_h1', spell: 'keen_shot', replaces: 'ricochet_bolt', targets: 2, frac: 0.3, lvl: 20 });
    assert.equal(K.lvl, C.SPELL.ricochet_bolt.lvl);
    assert.equal(C.META.sp_h1.spell, K.replaces);
    assert.equal(R.learnLevel({ legacy: true }, K.lvl), 9);
  });

  test('both gates on: a Legacy Hunter that owns it is taught no Ricochet Bolt and holds the passive (hero 20 and 25)', () => {
    gates(BOTH, () => {
      for (const H of [20, 25]) {
        const s = heroRun('hunter', H);
        assert.equal(s.meta.keenRicochet, true, `H${H}`);
        assert.ok(!s.meta.spells.includes('ricochet_bolt'));
        assert.ok(!trainerSpells(s).includes('ricochet_bolt'));
        assert.ok(!s.player.spells.ricochet_bolt && !s.player.bar.includes('ricochet_bolt'));
        assert.ok(s.player.spells.keen_shot);
        assert.ok(!R.legalActions(s).some((a) => a.spellId === 'ricochet_bolt'));
      }
      // without the technique: no passive, no field
      assert.ok(!('keenRicochet' in heroRun('hunter', 20, { tech: false }).meta));
      // Lost Technique II still needs I and still teaches Beastcall Horn
      assert.deepEqual(C.META.sp_h2.req, ['sp_h1']);
    });
  });

  test('the gates as before: legacy alone (oruvathLegacy off) and a level-60 run teach Ricochet Bolt, no passive', () => {
    gates(LEG, () => {
      const s = heroRun('hunter', 20);
      assert.ok(!('keenRicochet' in s.meta));
      assert.ok(s.meta.spells.includes('ricochet_bolt') && s.player.spells.ricochet_bolt);
    });
    gates(OFF, () => {
      const s = level60(30);
      assert.ok(!('keenRicochet' in s.meta));
      assert.ok(s.meta.spells.includes('ricochet_bolt') && trainerSpells(s).includes('ricochet_bolt') && s.player.spells.ricochet_bolt);
    });
  });

  test('a Rogue or Mage that owns the Hunter technique: no passive (the entry is the Hunter\'s)', () => {
    gates(BOTH, () => {
      for (const c of ['rogue', 'mage']) assert.ok(!('keenRicochet' in heroRun(c, 20).meta), c);
    });
  });

  test('Keen Shot hits the target and two other enemies for 30 % (Legacy, both gates, hero 20)', () => {
    gates(BOTH, () => {
      const s = heroRun('hunter', 20);
      const { dst, events, state } = keenTargets(s);
      assert.deepEqual(dst, [0, 1, 2]);
      // the bounce is the main hit's base × 0.3: its amount is about 30 % of the main hit's (variance and crits aside)
      const dmg = events.filter((e) => e.t === 'damage' && e.spell === 'keen_shot' && !e.crit);
      if (dmg.length >= 2 && dmg[0].dst === 0) assert.ok(dmg[1].amount < dmg[0].amount * 0.5, JSON.stringify(dmg));
      // spellInfo carries the bounce fields, as Ricochet Bolt's
      const a = R.spellInfo(state, 'keen_shot').amount;
      assert.deepEqual([a.bounces, a.bounceFrac], [2, 0.3]);
      assert.ok(a.bounceAmount > 0 && a.bounceAmount < a.amount);
    });
  });

  test('one target: without the technique, below hero 9, with oruvathLegacy off, and in a level-60 run', () => {
    gates(BOTH, () => {
      assert.deepEqual(keenTargets(heroRun('hunter', 20, { tech: false })).dst, [0]);
      assert.deepEqual(keenTargets(heroRun('hunter', 8)).dst, [0]);
      assert.deepEqual(keenTargets(heroRun('hunter', 9)).dst, [0, 1, 2]);
      assert.equal(R.spellInfo(heroRun('hunter', 8), 'keen_shot').amount.bounces, undefined);
    });
    gates(LEG, () => assert.deepEqual(keenTargets(heroRun('hunter', 20)).dst, [0]));
    gates(OFF, () => {
      const s = level60(30);
      assert.deepEqual(keenTargets(s).dst, [0]);
      assert.equal(R.spellInfo(s, 'keen_shot').amount.bounces, undefined);
    });
  });

  test('with one enemy left it hits only the target; dead enemies are skipped', () => {
    gates(BOTH, () => {
      let f = R.debug.encounter(heroRun('hunter', 20), { ids: ['z1_hedge_ogre', 'z1_furrow_boar'] }).state;
      f = R.debug.setGod(f).state;
      f = R.debug.killTarget(f, 1).state;
      f.player.mana = 9999;
      const r = R.step(f, { type: 'CAST', spellId: 'keen_shot', target: 0 });
      assert.deepEqual(r.events.filter((e) => (e.t === 'damage' || e.t === 'miss') && e.spell === 'keen_shot').map((e) => e.dst), [0]);
    });
  });
});
