// rules.md sections 3 (pacing model) and 4 (character).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, tweak, refreshDerived, cloneState } from './helpers.mjs';
import { estSeconds } from '../../src/engine/summary.js';
import { newStats } from '../../src/engine/nodes.js';
import { xpToNext, diffMod, talentPointsEarned, eventXp, gainXp } from '../../src/engine/progress.js';
import { mitigation } from '../../src/engine/damage.js';
import { baseMana } from '../../src/engine/stats.js';

describe('rules 3 pacing model', () => {
  test('3 estSeconds: sum of the pace terms, rounds at the manual or autoplay rate', () => {
    const st = { ...newStats(), nodesTotal: 10, zonesLeft: 2, quests: 4, fights: 12, rounds: 60, equipDrops: 5, levelUps: 9, talentPoints: 3, rests: 2, shrines: 1, treasures: 1, vendorVisits: 2, vendorTx: 6, trainerVisits: 1, trainerTx: 3, reachedBoss: true };
    const common = C.PACE_CREATE_S + 10 * (C.PACE_DECIDE_S + C.PACE_TRAVEL_NODE_S) + 2 * C.PACE_ZONE_TRAVEL_S + 4 * C.PACE_QUEST_TEXT_S
      + 12 * C.PACE_FIGHT_OVERHEAD_S + 5 * C.PACE_LOOT_S + 9 * C.PACE_LEVELUP_S + 3 * C.PACE_TALENT_S + 2 * C.PACE_REST_S + C.PACE_SHRINE_S
      + C.PACE_TREASURE_S + 2 * C.PACE_VENDOR_S + 6 * C.PACE_VENDOR_TX_S + C.PACE_TRAINER_S + 3 * C.PACE_TRAINER_TX_S + C.PACE_BOSS_INTRO_S;
    assert.equal(estSeconds(st, 'manual'), common + 60 * C.PACE_MANUAL_ROUND_S);
    assert.equal(estSeconds(st, 'auto'), common + 60 * C.PACE_AUTO_ROUND_S);
    const s = started('rogue');
    const sum = R.summary(s);
    assert.equal(sum.minutes.manual, estSeconds(s.stats, 'manual') / 60);
  });
});

describe('rules 4 character', () => {
  test('4.1 / 4.2 derived values: max HP, Power, crit, dodge, armor, mana, base mana, post-fight regen', () => {
    for (const c of C.CLASS_IDS) {
      const s = atLevel(started(c), 10, { learnAll: false });
      const p = s.player;
      const cls = C.CLASS[c];
      const stat = (k) => cls.stats[k][0] + cls.stats[k][1] * 9 + p.equipped.weapon.stats[k] + p.equipped.chest.stats[k];
      const STA = stat('STA');
      const prim = stat(cls.primary);
      assert.equal(p.d.maxHp, Math.round(cls.hpBase + cls.hpPerLevel * 9 + C.HP_PER_STA * STA));
      assert.ok(Math.abs(p.d.power - C.POWER_PER_PRIMARY * prim) < 1e-9);
      const Rt = C.RATING_K * 10 + C.RATING_C;
      assert.ok(Math.abs(p.d.crit - Math.min(C.CRIT_CAP, C.CRIT_BASE + C.CRIT_FROM_PRIMARY * prim / Rt)) < 1e-12);
      assert.ok(Math.abs(p.d.dodge - Math.min(C.DODGE_CAP, cls.dodgeBase + cls.dodgeFromAgi * stat('AGI') / Rt)) < 1e-12);
      assert.equal(p.d.armor, cls.armorBase + cls.armorPerLevel * 9 + cls.armorMult * (p.equipped.weapon.armor + p.equipped.chest.armor));
      if (c === 'mage') {
        assert.equal(p.d.maxMana, Math.round(C.MANA_BASE + C.MANA_PER_LEVEL * 9 + C.MANA_PER_INT * stat('INT')));
        assert.equal(p.d.baseMana, Math.round(C.MANA_BASE + C.MANA_PER_LEVEL * 9 + C.MANA_PER_INT * (cls.stats.INT[0] + cls.stats.INT[1] * 9)));
      } else assert.equal(p.d.maxMana, 0);
      const SPI = stat('SPI');
      assert.ok(Math.abs(p.d.regenPct - (C.POST_FIGHT_REGEN_BASE + C.POST_FIGHT_REGEN_SPI * SPI / (SPI + C.REGEN_SPI_K * 10 + C.REGEN_SPI_C))) < 1e-12);
    }
  });

  test('4.2 caps: crit at CRIT_CAP, dodge at DODGE_CAP, mitigation at ARMOR_MIT_CAP; affix armor is not × armorMult', () => {
    const s = tweak(started('mage'), (x) => {
      x.player.equipped.ring = { uid: 'r', kind: 'gear', slot: 'ring', rarity: 'epic', ilvl: 60, name: 'R', stats: { AGI: 9999, INT: 0, STA: 0, SPI: 0 }, power: 0, crit: 0.9, armor: 0, bonusArmor: 100, wd: 0, affix: 'crit', unique: null, effect: null };
      refreshDerived(x);
    });
    assert.equal(s.player.d.crit, C.CRIT_CAP);
    const cls = C.CLASS.mage;
    assert.equal(s.player.d.armor, cls.armorBase + cls.armorMult * s.player.equipped.chest.armor + 100);
    const r = tweak(started('rogue'), (x) => { x.player.equipped.ring = { ...s.player.equipped.ring }; refreshDerived(x); });
    assert.equal(r.player.d.dodge, C.DODGE_CAP);
    assert.equal(mitigation(1e9, 1), C.ARMOR_MIT_CAP);
    assert.equal(mitigation(500, 10), 500 / (500 + C.ARMOR_K * 10 + C.ARMOR_C));
  });

  test('4.3 levelling curve: xpToNext(1) = 400, (30) = 23 600, (59) = 80 440; 0 at 60', () => {
    assert.equal(xpToNext(1), 400);
    assert.equal(xpToNext(30), 23600);
    assert.equal(xpToNext(59), 80440);
    assert.equal(xpToNext(60), 0);
  });

  test('4.3 level-up carries XP over and raises current HP by the max HP gain (no full heal); no XP at 60', () => {
    const s = cloneState(started('rogue'));
    s.player.hp = 50;
    const before = s.player.d.maxHp;
    const evs = [];
    gainXp(s, evs, xpToNext(1) + xpToNext(2) + 25, "test");
    assert.equal(s.player.level, 3);
    assert.equal(s.player.xp, 25);
    assert.equal(s.player.hp, 50 + (s.player.d.maxHp - before));
    assert.equal(evs.filter((e) => e.t === 'levelUp').length, 2);
    const m = cloneState(atLevel(started('rogue'), 60));
    gainXp(m, [], 5000, 'test');
    assert.equal(m.player.xp, 0);
    assert.equal(m.player.level, 60);
  });

  test('4.3 / 6 talent points at 10 and every 2 levels: 26 at level 60 (+1 with Ancestral Insight, 1 rank since M2 v3)', () => {
    const s = started('mage');
    assert.equal(talentPointsEarned(s, 9), 0);
    assert.equal(talentPointsEarned(s, 10), 1);
    assert.equal(talentPointsEarned(s, 11), 1);
    assert.equal(talentPointsEarned(s, 12), 2);
    assert.equal(talentPointsEarned(s, 60), 26);
    const m = started('mage', { profile: { ...R.newProfile(), unlocks: { talent_pt: 1 } } });
    assert.equal(talentPointsEarned(m, 60), 27);
    assert.equal(talentPointsEarned(m, 59), 25);
  });

  test('4.4 XP level-difference modifier table', () => {
    const want = { 6: 1.25, 5: 1.25, 2: 1.10, 0: 1, '-1': 0.95, '-2': 0.9, '-3': 0.7, '-4': 0.5, '-5': 0.3, '-6': 0.1, '-12': 0.1 };
    for (const [d, m] of Object.entries(want)) assert.ok(Math.abs(diffMod(Number(d)) - m) < 1e-9, `d=${d}`);
  });

  test('4.4 XP per event: round(frac × xpToNext(CL) × diffMod × (1 + Insight + Quick Study))', () => {
    const s = cloneState(atLevel(started('rogue', { profile: { ...R.newProfile(), unlocks: { quick_study: 2 } } }), 10));
    const qs = 2 * C.META.quick_study.xpPct; // M2 v4: 0.0375 per rank
    assert.ok(Math.abs(qs - 0.075) < 1e-12);
    assert.equal(eventXp(s, 0.8, 10), Math.round(0.8 * xpToNext(10) * (1 + qs)));
    s.player.buffs.insight = { left: 2, active: true };
    assert.equal(eventXp(s, 0.8, 12), Math.round(0.8 * xpToNext(12) * diffMod(2) * (1 + qs + C.BOON_XP_PCT)));
  });
});


