// Tactician (balance.md 1, M2 v2): telegraph rules T1-T2 first, autoplay in the end-boss fight, search elsewhere.
// Also: the planners' travel level (exitLevelOf) equals the engine's TRAVEL_ON rule (rules 1.5, M2 v2 M6).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, newRunFor, BotRng, countCons } from '../../sim/lib/engine.mjs';
import { BAL } from '../../sim/lib/params.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { exitLevelOf } from '../../sim/bots/planner.mjs';
import { bigHits, bigHitAction, telegraphAction, tacticianChoice, evaluateAction } from '../../sim/bots/tactician.mjs';

const key = (a) => JSON.stringify(a, Object.keys(a).sort());

/** A hunter at the first player decision of its first fight (round 1), with Healing Draughts on the item bar. */
function firstFight(seed = 3) {
  const s = newRunFor({ classId: 'hunter', petId: 'ridgewolf', seed });
  const b = createBot('planner', { classId: 'hunter', seed, tree: 0 });
  for (let n = 0; n < 500 && !s.fight; n++) R.stepInPlace(s, b.choose(s));
  assert.ok(s.fight && s.fight.round === 1, 'reached a fight');
  return s;
}

/** Put a known spell on the first free bar slot. */
function teach(s, id) {
  s.player.spells[id] = { tl: s.player.level, rank: 1 };
  if (!s.player.spellOrder.includes(id)) s.player.spellOrder.push(id);
  const i = s.player.bar.indexOf(null);
  s.player.bar[i] = id;
}

/** Enemy 0 announces a hit on the player of `frac` × max HP. */
function announce(s, frac, extra = {}) {
  const e = s.fight.enemies[0];
  e.intent = { id: 'heavy_smash', name: 'Heavy Smash', kind: 'hit', cast: false, heavy: true, school: 'phys', cd: 3, pct: 1.8, hits: 1, target: 'player', est: Math.round(frac * s.player.d.maxHp), ...extra };
  return e;
}

describe('T1 big hit (synthetic first-fight states)', () => {
  test('no trigger when the announced big hit leaves at least TACTICIAN_SAFE_HP, or a WARD absorbs it', () => {
    const s = firstFight();
    s.player.hp = s.player.d.maxHp;
    announce(s, 0.5);
    assert.equal(bigHitAction(s), null);
    s.player.hp = Math.round(0.6 * s.player.d.maxHp);
    assert.ok(bigHitAction(s), 'triggers at 60 % HP against a 50 % hit');
    s.fight.p.st.push({ id: 'WARD', dur: 3, amount: s.player.d.maxHp });
    assert.equal(bigHitAction(s), null, 'a WARD that absorbs the hit');
  });

  test('order: stun on the source, then a defensive that covers the hit, then a healing item', () => {
    const s = firstFight();
    assert.ok(countCons(s, 'healing_draught') > 0 && s.player.itemBar.includes('healing_draught'));
    s.player.hp = Math.round(0.6 * s.player.d.maxHp);
    const e = announce(s, 0.5);
    // Only a potion available.
    let t = bigHitAction(s);
    assert.equal(t.rule, 'T1-heal');
    assert.deepEqual(t.action, { type: 'USE_ITEM', slot: s.player.itemBar.indexOf('healing_draught'), target: null });
    // A defensive that redirects single-target hits (Feign Stillness, live pet) comes before the potion.
    teach(s, 'feign_stillness');
    t = bigHitAction(s);
    assert.equal(t.rule, 'T1-defensive');
    assert.equal(t.action.spellId, 'feign_stillness');
    // ... but it does not cover a hit on everyone (cleave): back to the potion.
    announce(s, 0.5, { kind: 'cleave', target: 'all' });
    assert.equal(bigHitAction(s).rule, 'T1-heal');
    // A stun-tagged spell on the source stops a heavy hit and comes first.
    announce(s, 0.5);
    teach(s, 'snare_trap');
    t = bigHitAction(s);
    assert.equal(t.rule, 'T1-stop');
    assert.deepEqual(t.action, { type: 'CAST', spellId: 'snare_trap', target: e.idx });
    // A CC-immune source (dungeon boss) cannot be stunned out of a non-cast hit.
    e.ccImmune = true;
    assert.equal(bigHitAction(s).rule, 'T1-defensive');
  });

  test('a cast the player can interrupt this turn is not a big hit; one it cannot interrupt is', () => {
    const s = firstFight();
    s.player.hp = Math.round(0.6 * s.player.d.maxHp);
    announce(s, 0.5, { id: 'hex_bolt', name: 'Hex Bolt', heavy: false, cast: true, school: 'magic' });
    assert.equal(bigHits(s).length, 1, 'no interrupt on the bar: a big hit');
    teach(s, 'muzzle_shot');
    assert.equal(bigHits(s).length, 0, 'Muzzle Shot usable on it: left to the search');
  });

  test('in a non-boss fight without a telegraph match the choice is the search (a legal action)', () => {
    const s = firstFight();
    const a = tacticianChoice(s, new BotRng(1));
    assert.ok(R.isLegal(s, a));
  });
});

describe('end-boss fight (PALL autoplay runs to the boss, then the tactician)', () => {
  test('telegraph rules first, autoplay otherwise; AoE on 2+ Shards in phase 2; every action legal', () => {
    const seen = { auto: 0, t1: 0, aoe: 0, shard: 0 };
    for (const cls of ['rogue', 'mage', 'hunter']) {
      let fights = 0;
      for (let seed = 1; seed <= 60 && fights < 2; seed++) {
        const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, profile: buildProfile('all', cls) });
        while (s.phase !== 'ENDED' && !(s.fight && s.fight.kind === 'boss')) R.stepInPlace(s, R.autoAction(s));
        if (s.phase === 'ENDED') continue;
        fights++;
        const st = { fights: -1, n0: 0 };
        for (let n = 0; s.fight && n < 200; n++) {
          const t = telegraphAction(s, new BotRng(n));
          const a = tacticianChoice(s, new BotRng(n), st);
          assert.ok(R.isLegal(s, a), `${cls} seed ${seed}: ${JSON.stringify(a)} is illegal`);
          if (!t) {
            assert.equal(key(a), key(R.autoAction(s)), 'no telegraph match: autoplay');
            seen.auto++;
          } else {
            assert.equal(key(a), key(t.action));
            if (t.rule.startsWith('T1')) seen.t1++;
            if (t.rule === 'T2-shard') seen.shard++;
          }
          const f = s.fight;
          const shards = f.enemies.filter((e) => e.alive && e.kind === 'shard').length;
          const aoeReady = s.player.bar.some((id) => id && C.SPELL[id].tags.includes('aoe')
            && R.isLegal(s, { type: 'CAST', spellId: id, target: C.SPELL[id].target === 'enemy' ? f.enemies.find((e) => e.alive && e.kind === 'shard').idx : null }));
          if (f.boss.phase === 2 && shards >= 2 && aoeReady && !bigHitAction(s)) {
            assert.ok(a.type === 'CAST' && C.SPELL[a.spellId].tags.includes('aoe'), `${cls}: AoE on ${shards} Shards, got ${JSON.stringify(a)}`);
            seen.aoe++;
          }
          R.stepInPlace(s, a);
        }
      }
      assert.ok(fights > 0, `${cls}: no PALL autoplay run reached the boss in 60 seeds`);
    }
    assert.ok(seen.auto > 50 && seen.aoe > 0 && seen.t1 > 0, JSON.stringify(seen));
  });

  test('the search weights summoned adds by TACTICIAN_ADD_WEIGHT', () => {
    const s = firstFight();
    const seeds = [11, 12];
    const a = { type: 'ATTACK', target: 0 };
    const full = evaluateAction(s, a, seeds);
    const asAdds = evaluateAction(s, a, seeds, 0); // every enemy counted as a summoned add
    assert.ok(full.mean > asAdds.mean || full.mean <= 0, `${full.mean} vs ${asAdds.mean}`);
    assert.ok(BAL.TACTICIAN_ADD_WEIGHT > 0 && BAL.TACTICIAN_ADD_WEIGHT < 1);
  });
});

describe('travel level (rules 1.5, M2 v2)', () => {
  test('exitLevelOf matches the engine: TRAVEL_ON is legal from that level, not one level below', () => {
    for (const swift of [false, true]) {
      const prof = buildProfile('fresh', 'rogue');
      if (swift) { prof.unlocks.wayfinder = 1; prof.unlocks.swift_boots = 1; }
      const s = newRunFor({ classId: 'rogue', seed: 4, profile: prof });
      R.stepInPlace(s, { type: 'START_RUN' });
      R.stepInPlace(s, { type: 'LEAVE_HUB' });
      assert.equal(s.phase, 'MAP');
      const need = exitLevelOf(s);
      assert.equal(need, C.ZONE_LEVELS - C.TRAVEL_EARLY_LEVELS - (swift ? C.META.swift_boots.levels : 0));
      s.player.level = need;
      assert.ok(R.isLegal(s, { type: 'TRAVEL_ON' }), `swift=${swift}: legal at ${need}`);
      s.player.level = need - 1;
      assert.ok(!R.isLegal(s, { type: 'TRAVEL_ON' }), `swift=${swift}: illegal at ${need - 1}`);
    }
  });
});
