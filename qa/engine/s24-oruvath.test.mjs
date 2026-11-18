// Oruvath on the 1-25 scale (D156; docs/specs/legacy.md 2.4.1 and 10, draft): behind C.GATES.oruvathLegacy (off by
// default). The constants against legacy.md 10; the boss HP table by hero level, dmgScale0 × bossDmgLevel, the Shards' HP
// ramp, the Final Dark round by hero level (schedule and enrage counter); the autoplay DoT rule (Living Flame, Barbed
// Arrow); the four class numbers; the switch off (and outside a Legacy run) plays Oruvath as before.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { oruvathScale, bossDmgLevel, shardHpLevel, finalDarkRound } from '../../src/engine/legacy.js';
import { enrageRound } from '../../src/engine/boss.js';
import { autoTarget } from '../../src/engine/autoplay.js';
import { bossDmgFactor } from '../../src/engine/damage.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
/** fn with the named switches on, every switch restored after. */
function gates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
const both = (fn) => gates({ legacy: true, oruvathLegacy: true }, fn);
const steps = (s, list) => { for (const a of list) s = R.step(s, a).state; return s; };
function heroRun(classId, H, seed = 7) {
  const prof = R.debug.setHero(R.newProfile(), classId, { level: H, xp: 0 });
  return steps(R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile: prof }), [{ type: 'START_RUN' }, { type: 'SET_OUT' }]);
}
const tweak = (s, fn) => { const o = JSON.parse(R.serialize(s)); o.content = CONTENT; fn(o); return o; };
const hpScale = (LB) => (C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * LB) / (C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * 62);
const dmg0 = (M) => (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * M) * (1 + (C.ZONE_DANGER_STEP * Math.max(0, M - C.ZONE_DANGER_FROM)) / 10);

describe('legacy.md 2.4.1 and 10: the constants (draft); GATES.oruvathLegacy off', () => {
  test('the switch is off by default; the table rows of section 10', () => {
    assert.equal(C.GATES.oruvathLegacy, false);
    assert.deepEqual(C.BOSS_HP_LEVEL, [0.50, 0.53, 0.57, 0.61, 0.71, 0.84, 0.87, 0.90, 1.00, 1.12, 1.10, 1.07, 1.07, 1.07, 1.05, 1.03, 1.02, 1.01, 0.99, 0.96, 0.94, 0.94, 0.92, 0.89, 0.89]);
    assert.deepEqual([C.BOSS_DMG_LEVEL_BASE, C.BOSS_DMG_LEVEL_STEP, C.BOSS_DMG_LEVEL_MIN, C.BOSS_DMG_LEVEL_MAX], [1.40, 0.021, 0.90, 1.20]);
    assert.deepEqual([C.SHARD_HP_LEVEL_LOW, C.SHARD_HP_RAMP_FROM, C.SHARD_HP_RAMP_TO], [0.5, 17, 23]);
    assert.deepEqual([C.FINAL_DARK_LEVEL_STEP, C.FINAL_DARK_ROUND_MAX], [1.4, 76]);
  });

  test('the curves at the levels 2.4.1 names: bossDmgLevel, shardHpLevel, the Final Dark round', () => {
    const r2 = (x) => Math.round(x * 100) / 100;
    const r3 = (x) => Math.round(x * 1000) / 1000;
    // 2.4.1 rounds 1.085 at H15 down to 1.08 in its text
    assert.deepEqual([1, 9, 10, 15, 20, 24, 25].map((H) => r3(bossDmgLevel(H))), [1.20, 1.20, 1.19, 1.085, 0.98, 0.90, 0.90]);
    assert.deepEqual([1, 17, 18, 20, 23, 25].map((H) => r2(shardHpLevel(H))), [0.5, 0.5, 0.58, 0.75, 1, 1]);
    assert.deepEqual([1, 11, 13, 15, 20, 25].map(finalDarkRound), [76, 76, 74, 71, 64, 57]);
  });

  test('the class numbers: off as rules.md, on as 2.4.1 item 7 (the Rogue unchanged)', () => {
    const read = () => [C.SPELL.frost_lance.l, C.SPELL.frost_lance.p, C.SPELL.pyre_comet.lvl, C.SPELL.barbed_arrow.dot.l, C.SPELL.barbed_arrow.dot.p, C.SPELL.field_dressing.healPct];
    assert.deepEqual(read(), [1.54, 0.84, 38, 0.45, 0.18, 0.12]);
    assert.deepEqual(gates({ oruvathLegacy: true }, read), [1.77, 0.97, 21, 0.495, 0.20, 0.18]);
    assert.deepEqual(read(), [1.54, 0.84, 38, 0.45, 0.18, 0.12]);
    // the other fields of these spells and JSON copies keep their shape
    assert.equal(C.SPELL.barbed_arrow.dot.rounds, 4);
    assert.equal(JSON.parse(JSON.stringify(C.SPELL.frost_lance)).l, 1.54);
  });
});

describe('legacy.md 2.4.1: Oruvath and the Shards by hero level (GATES.legacy and oruvathLegacy on)', () => {
  test('HP × hpScale(LB) × BOSS_HP_LEVEL[H - 1]; damage × dmgScale0(LB) × bossDmgLevel(H); Shards × shardHpLevel(H); level, armour as 2.4', () => both(() => {
    for (const H of [1, 5, 9, 10, 17, 20, 24, 25]) {
      const s = R.debug.toBoss(heroRun('rogue', H, 51)).state;
      const LB = R.powerOfLevel(H) + C.BOSS_TIER;
      const b = s.fight.enemies[0];
      const sc = s.fight.boss.scale;
      assert.equal(b.level, LB);
      assert.equal(b.maxHp, Math.round(C.BOSS_HP * (1 + b.asc) * hpScale(LB) * C.BOSS_HP_LEVEL[H - 1]));
      assert.equal(b.armor, Math.round(C.BOSS_ARMOR * LB / 62));
      assert.ok(Math.abs(sc.dmg - (dmg0(LB) / dmg0(62)) * bossDmgLevel(H)) < 1e-12);
      assert.deepEqual([sc.shardHp, sc.finalDark], [shardHpLevel(H), finalDarkRound(H)]);
      assert.deepEqual(sc, oruvathScale(s, R.zoneDanger));
      assert.equal(bossDmgFactor(s, 0), C.BOSS_DMG_MULT * sc.dmg);
      const p2 = R.debug.toBoss(heroRun('rogue', H, 51), { phase: 2 }).state;
      const sh = p2.fight.enemies.filter((e) => e.kind === 'shard');
      assert.ok(sh.length > 0);
      for (const x of sh) {
        assert.deepEqual([x.level, x.maxHp], [LB - 2, Math.round(C.SHARD_HP * (1 + x.asc) * hpScale(LB) * C.BOSS_HP_LEVEL[H - 1] * shardHpLevel(H))]);
      }
    }
  }));

  test('no early factors: the damage scale is smooth in level (no step at boss level 11 or 21)', () => both(() => {
    const at = (H) => R.debug.toBoss(heroRun('mage', H, 53)).state.fight.boss.scale.dmg / bossDmgLevel(H);
    const xs = [3, 4, 5, 6, 7, 8].map(at);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1] && xs[i] / xs[i - 1] < 1.25, `H${i + 3}: ${xs[i - 1]} -> ${xs[i]}`);
  }));

  test('Final Dark at the fight\'s round by hero level: schedule and enrage counter; not one round before', () => both(() => {
    for (const H of [5, 15, 25]) {
      const fd = finalDarkRound(H);
      const base = R.debug.toBoss(heroRun('mage', H, 54)).state;
      assert.equal(enrageRound(base.fight), fd);
      const imm = (x) => { x.player.d.maxHp = 1e9; x.player.hp = 1e9; x.fight.enemies[0].hp = x.fight.enemies[0].maxHp; };
      const before = R.step(tweak(base, (x) => { imm(x); x.fight.round = fd - 2; }), { type: 'PASS' }).state;
      const ids = (s) => s.fight.enemies[0].intent.actions.map((a) => a.id);
      assert.equal(before.fight.round, fd - 1);
      assert.ok(!ids(before).includes('final_dark'));
      assert.equal(before.fight.enemies[0].intent.telegraph.enrageInRounds, 1);
      const at = R.step(tweak(before, imm), { type: 'PASS' }).state;
      assert.equal(at.fight.round, fd);
      assert.ok(ids(at).includes('final_dark'));
      assert.equal(at.fight.enemies[0].intent.telegraph.enrageInRounds, 0);
    }
  }));

  test('outside a Legacy run, or with the switch off, Oruvath is as before (no shardHp, Final Dark at BOSS_ENRAGE_ROUND)', () => {
    gates({ oruvathLegacy: true }, () => {
      const s = R.debug.toBoss(R.debug.build({ content: CONTENT, classId: 'mage', zone: 7 }).state).state;
      const b = s.fight.enemies[0];
      assert.deepEqual([b.level, b.maxHp, 'scale' in s.fight.boss, enrageRound(s.fight)], [C.BOSS_LEVEL, Math.round(C.BOSS_HP * (1 + b.asc)), false, C.BOSS_ENRAGE_ROUND]);
    });
    gates({ legacy: true }, () => {
      const s = R.debug.toBoss(heroRun('rogue', 10, 51)).state;
      const sc = s.fight.boss.scale;
      assert.deepEqual(['shardHp' in sc, 'finalDark' in sc, enrageRound(s.fight)], [false, false, C.BOSS_ENRAGE_ROUND]);
      assert.equal(s.fight.enemies[0].maxHp, Math.round(C.BOSS_HP * (1 + s.fight.enemies[0].asc) * hpScale(R.powerOfLevel(10) + C.BOSS_TIER) * Math.min(1, 0.4 + 0.024 * 10)));
    });
  });
});

describe('legacy.md 2.4.1 item 5: the autoplay DoT rule (rules 7.9)', () => {
  /** A boss fight in phase 2 with a Shard at full HP; Oruvath at `bossHp` of his HP. */
  function fight(classId, bossHp) {
    const s = R.debug.toBoss(R.debug.build({ content: CONTENT, classId, zone: 7 }).state, { phase: 2 }).state;
    return tweak(s, (x) => { const b = x.fight.enemies[0]; b.hp = Math.floor(b.maxHp * bossHp); });
  }
  const shardIdx = (s) => s.fight.enemies.findIndex((e) => e.kind === 'shard' && e.alive);

  for (const [cls, id] of [['mage', 'living_flame'], ['hunter', 'barbed_arrow']]) {
    test(`${id}: off, a boss under autoTargetHp is skipped and a fresh Shard taken; on, the boss at any HP, never a Shard`, () => {
      const s = fight(cls, 0.3);
      const sh = shardIdx(s);
      assert.ok(sh > 0);
      assert.equal(autoTarget(s, id, 0), undefined);
      assert.equal(autoTarget(s, id, sh), sh);
      gates({ oruvathLegacy: true }, () => {
        assert.equal(autoTarget(s, id, 0), 0);
        assert.equal(autoTarget(s, id, sh), undefined);
        // an ordinary enemy keeps today's condition
        const t = tweak(s, (x) => { const e = x.fight.enemies[sh]; e.kind = 'normal'; e.hp = Math.floor(e.maxHp * 0.3); });
        assert.equal(autoTarget(t, id, sh), undefined);
        const u = tweak(s, (x) => { x.fight.enemies[sh].kind = 'normal'; });
        assert.equal(autoTarget(u, id, sh), sh);
      });
    });
  }
});
