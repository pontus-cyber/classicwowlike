// Legacy Economy v2 (D159; docs/specs/legacy.md 4.7 and its section 10 rows marked 4.7, draft), behind C.GATES.economyV2
// (off by default), in Legacy runs only (D158). One test or more per rule: the switch and its scope; E1 (camp points kept pay
// nothing, a zone left pays 10; LE1); E2 (XP against the level of the place: zone band, the Camp, contracts; LE2); E7 (D161:
// Camp waves take the level-gap falloff past the Camp's level); E3 (zone 1's lag); E4 (HERO_XP 1-3); E5 (the hall a version 3 profile is sold and the effects a Legacy run reads); E6 (content
// lines, draft); D160 (the old catalogue refunded once); D167 (hall v3d: the catalogue pinned, ranks bought at v2 prices kept); the golden runs with the switch off (Legacy runs as on 708841f; level-60 runs as on 9a79dee with it on).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { tollsMasked } from './helpers.mjs';
import { eventXp, flatXp, gainXp, campFalloff } from '../../src/engine/progress.js';
import { echoes } from '../../src/engine/meta.js';
import { econV2, xpRef, bandNow, heroXpToNext, hallOf, legacyPerZone, legacyPerPrepPoint, campWaveXp } from '../../src/engine/legacy.js';
import { metaFromProfile } from '../../src/engine/nodes.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
const V2 = { legacy: true, economyV2: true };
function gates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
const steps = (s, list) => { for (const a of list) s = R.step(s, a).state; return s; };
const later = () => ({ ...R.newProfile(), runs: 2, welcome: true, guide: 'done' });
/** A Legacy run of the class's hero at hero level H on a later profile, in PREP (or after SET_OUT with `out`). */
function heroRun(classId, H, seed = 7, out = true, base = later()) {
  const prof = R.debug.setHero(base, classId, { level: H, xp: 0 });
  const s = steps(R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile: prof }), [{ type: 'START_RUN' }]);
  return out ? steps(s, [{ type: 'SET_OUT' }]) : s;
}
const SPEC = readFileSync(fileURLToPath(new URL('../../docs/specs/legacy.md', import.meta.url)), 'utf8');
const row = (name) => {
  const l = SPEC.slice(SPEC.indexOf('## 10. Constant table')).split('\n').find((x) => x.startsWith(`| ${name} |`));
  assert.ok(l, name);
  return l.split('|')[2].trim();
};

describe('legacy.md 4.7, 10: the constants (draft) and the switch', () => {
  test('section 10 rows marked 4.7 equal the engine constants', () => {
    assert.equal(C.GATES.economyV2, false);
    assert.equal(Number(row('LEGACY_PER_PREP_POINT_HERO (4.7, draft)')), C.LEGACY_PER_PREP_POINT_HERO);
    assert.equal(Number(row('LEGACY_PER_ZONE_HERO (4.7, draft)')), C.LEGACY_PER_ZONE_HERO);
    assert.equal(Number(row('XP_ZONE_STEP (4.7, draft)')), C.XP_ZONE_STEP);
    assert.deepEqual(row('ZONE_LAG (4.7, draft)').split(',').map(Number), C.ZONE_LAG);
    assert.deepEqual(row('HERO_XP (4.7, draft)').match(/levels 1-3: ([\d, ]+) \(/)[1].split(',').map(Number), C.HERO_XP_ECON2.slice(0, 3));
    assert.deepEqual(C.HERO_XP_ECON2.slice(3), C.HERO_XP.slice(3));
    assert.equal(C.HERO_XP_ECON2.reduce((a, b) => a + b, 0), 69300);
    assert.deepEqual(row('TREE_OPEN_COST (4.7, draft)').split('/').map(Number), C.TREE_OPEN_COST);
    assert.equal(Number(row('ARMOURY_COST (4.7, draft)')), C.ARMOURY_COST);
    assert.equal(C.CONTRACT_CL_OFFSET_HERO, 2);
    // LEGACY_COST (4.7): "id price[ / price]" per entry; sp_(class)1 / 2 for the six technique ids
    const costs = {};
    for (const part of row('LEGACY_COST (4.7, draft)').split(/[;,]/)) {
      const m = part.trim().match(/^([a-z_()]+?)(\d?) ([\d /]+)$/);
      if (!m) continue;
      const v = m[3].split('/').map(Number);
      if (m[1] === 'sp_(class)') for (const c of ['r', 'm', 'h']) costs[`sp_${c}${m[2]}`] = v;
      else costs[m[1] + m[2]] = v;
    }
    assert.deepEqual(Object.keys(costs).sort(), Object.keys(C.META_HERO).sort());
    for (const [id, m] of Object.entries(C.META_HERO)) assert.deepEqual(m.costs, costs[id], id);
  });

  test('econV2: a Legacy run with the switch on; never a level-60 run; read at each use', () => {
    const lv60 = R.debug.build({ content: CONTENT, classId: 'mage', zone: 3 }).state;
    const leg = gates({ legacy: true }, () => heroRun('mage', 5));
    for (const [set, a, b] of [[{}, false, false], [{ economyV2: true }, false, true], [{ legacy: true }, false, false], [V2, false, true]]) {
      assert.deepEqual(gates(set, () => [econV2(lv60), econV2(leg)]), [a, b], JSON.stringify(set));
    }
    assert.deepEqual(gates({ economyV2: true }, () => [legacyPerZone(lv60), legacyPerPrepPoint(lv60), legacyPerZone(leg), legacyPerPrepPoint(leg)]), [7.5, 2, 10, 0]);
  });
});

describe('legacy.md 4.7 E1: camp points pay no Legacy; a zone left pays 10', () => {
  test('LE1: a Legacy run that sets out with nothing bought and abandons at once pays 0 (not a first run); off it pays the reserve line', () => {
    const play = (set) => gates(set, () => {
      let s = heroRun('rogue', 3, 21);
      s = steps(s, [{ type: 'ABANDON_RUN' }]);
      const sum = R.summary(s);
      const end = steps(s, [{ type: 'END_RUN' }]);
      return { sum, legacy: end.result.legacy };
    });
    const off = play({ legacy: true });
    assert.deepEqual(off.sum.echoes.lines.map((l) => [l.id, l.count, l.echoes]), [['reserve', 10, 20]]);
    assert.equal(off.legacy, 20);
    const on = play(V2);
    assert.deepEqual([on.sum.echoes.lines, on.sum.echoes.total, on.legacy], [[], 0, 0]);
  });

  test('a lean first run: no reserve line either; the welcome still pays once; prepView worth 0', () => gates(V2, () => {
    const prof = R.debug.setHero(R.newProfile(), 'mage', { level: 1 });
    let s = steps(R.newRun({ classId: 'mage', seed: 9, content: CONTENT, profile: prof }), [{ type: 'START_RUN' }]);
    const pv = R.prepView(s);
    assert.equal(pv.first, true);
    assert.deepEqual(pv.unspent, { points: pv.left, echoes: 0 });
    s = steps(s, [{ type: 'SET_OUT' }, { type: 'ABANDON_RUN' }]);
    assert.deepEqual(R.summary(s).echoes.lines.map((l) => [l.id, l.echoes]), [['welcome', 60]]);
    // a later run's prep screen: reserve worth 0
    assert.deepEqual(R.prepView(heroRun('mage', 4, 9, false)).reserve, { points: 10, echoes: 0 });
  }));

  test('the zone line: LEGACY_PER_ZONE_HERO under econV2 (facts.econV2), LEGACY_PER_ZONE otherwise; level-60 runs keep both old lines', () => {
    const facts = { classId: 'rogue', level: 1, zonesLeft: 5, dungeons: 0, kills: { elite: 0, rare: 0 }, quests: 0, reachedBoss: false, outcome: 'death', timeAtBoss: null, oaths: [], reserve: 4, heroLevels: 0 };
    const id = (f) => echoes(f, null).lines.map((l) => [l.id, l.each, l.echoes]);
    assert.deepEqual(id(facts), [['zones', 7.5, 38], ['reserve', 2, 8]]);
    assert.deepEqual(id({ ...facts, econV2: true }), [['zones', 10, 50]]);
    // a level-60 run with the switch on: summary facts carry no econV2, so the prep screen keeps its worth
    gates({ economyV2: true }, () => {
      const s = steps(R.newRun({ classId: 'rogue', seed: 4, content: CONTENT, profile: later() }), [{ type: 'START_RUN' }]);
      assert.deepEqual(R.prepView(s).reserve, { points: 10, echoes: 20 });
    });
  });

  test('a played run: the zones line pays 10 a zone left and no line is reserve', () => gates({ ...V2, oruvathLegacy: true }, () => {
    let s = heroRun('hunter', 12, 31);
    for (let n = 0; n < 30000 && s.phase !== 'SUMMARY'; n++) s = R.step(s, R.autoAction(s)).state;
    const sum = R.summary(s);
    const z = sum.echoes.lines.find((l) => l.id === 'zones');
    assert.ok(z && z.count >= 1);
    assert.deepEqual([z.each, z.echoes], [10, Math.round(10 * z.count)]);
    assert.ok(!sum.echoes.lines.some((l) => l.id === 'reserve'));
  }));
});

describe('legacy.md 4.7 E2: XP is counted against the level of the place', () => {
  test('LE2: the same node offset pays the same hero XP at hero 1, 2, 10 and 25 (kills, quests, waves, dungeon trash and boss)', () => gates(V2, () => {
    const frac = { kill: C.MOB_XP_FRAC * C.XP_WEIGHT_MULT, quest: C.QUEST_TURNIN_XP_FRAC * C.XP_WEIGHT_MULT, wave: C.GRIND_WAVE_XP_FRAC * C.XP_WEIGHT_MULT, dungeon: C.DUNGEON_CLEAR_XP_FRAC * C.XP_WEIGHT_MULT };
    const at = (H) => {
      const s = heroRun('rogue', H, 41);
      const Z = s.hero.bands[1];
      assert.equal(xpRef(s), Z);
      return Object.fromEntries(Object.entries(frac).flatMap(([k, f]) => [0, 1, 2, 4].map((d) => [`${k}+${d}`, eventXp(s, f, Z + d)])));
    };
    const h1 = at(1);
    for (const H of [2, 10, 25]) assert.deepEqual(at(H), h1, `hero ${H}`);
    // the formula: round(100 × frac × (1 + 0.10 × max(0, CL - Z)) × (1 + mods)); below the band no bonus, no malus
    assert.equal(h1['quest+0'], Math.round(100 * frac.quest));
    assert.equal(h1['kill+2'], Math.round(100 * frac.kill * 1.2));
    assert.equal(h1['dungeon+4'], Math.round(100 * frac.dungeon * 1.4));
    const s = heroRun('rogue', 10, 41);
    assert.equal(eventXp(s, frac.kill, s.hero.bands[1] - 5), Math.round(100 * frac.kill));
  }));

  test('a level-up inside the zone does not change its XP (the band is fixed at arrival); off, the old curve pays less after it', () => {
    const before = (set) => gates(set, () => {
      const s = heroRun('mage', 2, 51);
      const cl = s.zone.nodes.find((n) => n.type === 'quest').cl;
      const a = eventXp(s, C.QUEST_TURNIN_XP_FRAC, cl);
      const t = JSON.parse(R.serialize(s));
      t.content = CONTENT;
      t.player.heroLevel = 3;
      t.player.level = R.powerOfLevel(3);
      return [a, eventXp(t, C.QUEST_TURNIN_XP_FRAC, cl)];
    });
    const [a, b] = before(V2);
    assert.equal(a, b);
    const [c, d] = before({ legacy: true });
    assert.ok(d < c);
  });

  test('at the Camp and in Oruvath\'s fight Z is the Camp\'s level; with no zone the power level', () => gates(V2, () => {
    const s = heroRun('hunter', 9, 61);
    const t = JSON.parse(R.serialize(s));
    t.content = CONTENT;
    t.zone = { z: 7, camp: true };
    t.hero.camp = 30;
    assert.equal(xpRef(t), 30);
    assert.equal(eventXp(t, 1, 30), 100);
    assert.equal(eventXp(t, 1, 33), 130);
    t.zone = null;
    assert.equal(xpRef(t), t.player.level);
  }));

  test('contracts and Gorrak\'s bounty: CL - Z = CONTRACT_CL_OFFSET_HERO at every level; the board pays what it shows', () => gates(V2, () => {
    for (const H of [1, 10, 25]) {
      const s = heroRun('rogue', H, 71, false);
      const want = (kind) => Math.round(100 * C.CONTRACT[kind].xpFrac * C.XP_WEIGHT_MULT * 1.2);
      for (const o of R.prepView(s).board) assert.equal(o.reward.xp, want(o.kind), `hero ${H} ${o.kind}`);
      assert.equal(flatXp(s, 1, 1), flatXp(s, 1, 66));
      assert.equal(flatXp(s, 1, 1), 120);
    }
  }));

  test('the % mods apply as before: Quick Study (META_HERO 0.05 a rank)', () => gates(V2, () => {
    const base = { ...later(), unlocks: { quick_study: 2 } };
    const s = heroRun('rogue', 5, 81, true, base);
    assert.equal(s.meta.xpPct, 0.1);
    assert.equal(eventXp(s, 1, xpRef(s)), 110);
  }));
});

describe('legacy.md 4.7 E7 (D161): Camp waves take the level-gap falloff past the Camp\'s level', () => {
  /** A hero built at the Camp (debug.build, Legacy): hero H arrives, the Camp's level is P(H) + CAMP_TIER; then `past` power levels over it. */
  const atCamp = (classId, H, past = null, seed = 91) => {
    const prof = R.debug.setHero(later(), classId, { level: H, xp: 0 });
    const s = R.debug.build({ content: CONTENT, classId, petId: PET(classId), seed, profile: prof, zone: C.ZONE_COUNT + 1, level: R.powerOfLevel(H) }).state;
    assert.equal(s.hero.camp, R.powerOfLevel(H) + C.CAMP_TIER);
    if (past !== null) s.player.level = s.hero.camp + past;
    return s;
  };
  const wave = C.GRIND_WAVE_XP_FRAC * C.XP_WEIGHT_MULT;
  const kill = C.MOB_XP_FRAC * C.XP_WEIGHT_MULT;

  test('× min(1, diffMod(Z - L)): 1 up to the Camp\'s level, then 0.95, 0.90, 0.70, 0.50, 0.30, 0.10 (grey) at 1-7 power levels past it', () => gates(V2, () => {
    const want = [1, 1, 1, 1, 0.95, 0.9, 0.7, 0.5, 0.3, 0.1, 0.1, 0.1];
    [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 20].forEach((past, i) => {
      const s = atCamp('rogue', 5, past);
      assert.ok(campWaveXp(s));
      assert.ok(Math.abs(campFalloff(s) - want[i]) < 1e-9, `past ${past}`);
      assert.equal(eventXp(s, wave, s.hero.camp), Math.round(100 * wave * want[i]), `wave, past ${past}`);
      assert.equal(eventXp(s, kill, s.hero.camp), Math.round(100 * kill * want[i]), `kill, past ${past}`);
    });
    // at every hero level the same gap pays the same
    for (const H of [1, 10, 20, 25]) assert.equal(eventXp(atCamp('mage', H, 4), wave, atCamp('mage', H).hero.camp), Math.round(100 * wave * 0.5), `hero ${H}`);
  }));

  test('a played Camp wave: its kills and its wave bonus pay 0.10 × once the hero is 6 power levels past the Camp; at its level the full E2 award', () => gates(V2, () => {
    const play = (past) => {
      let s = atCamp('hunter', 5, past, 93);
      s.player.rested = 0;
      const ev = [];
      for (let r = R.step(s, { type: 'CAMP_GRIND' }); ; r = R.step(s, R.autoAction(s))) {
        s = r.state;
        ev.push(...r.events);
        if (!s.fight && !(s.loot && s.loot.length)) break;
      }
      return ev.filter((e) => e.t === 'xp');
    };
    const full = play(null);
    const grey = play(6);
    assert.ok(full.some((e) => e.why === 'wave') && full.some((e) => e.why === 'kill'));
    for (const [list, f] of [[full, 1], [grey, 0.1]]) {
      for (const e of list) {
        assert.equal(e.rested, 0);
        assert.equal(e.amount, Math.round(100 * (e.why === 'wave' ? wave : kill) * f), `${e.why} × ${f}`);
      }
    }
  }));

  test('only Camp waves: Oruvath\'s fight, zones, contracts and the switch off are as before', () => {
    gates({ ...V2, oruvathLegacy: true }, () => {
      const s = atCamp('rogue', 10, 8);
      const b = R.debug.toBoss(s).state;
      assert.equal(campWaveXp(b), false);
      assert.equal(campFalloff(b), 1);
      assert.equal(eventXp(b, kill, b.hero.camp), Math.round(100 * kill));
      // a zone: a hero far past the zone's band pays the E2 award (no malus below the band)
      const z = heroRun('rogue', 10, 41);
      z.player.level = z.hero.bands[1] + 12;
      assert.equal(campWaveXp(z), false);
      assert.equal(eventXp(z, kill, z.hero.bands[1]), Math.round(100 * kill));
      assert.equal(flatXp(s, 1, 1), 120);
    });
    // switch off (Legacy alone): the Legacy formula of 1.3, no falloff term
    gates({ legacy: true }, () => {
      const s = atCamp('rogue', 5, 6);
      assert.equal(campFalloff(s), 1);
      const L = s.player.level;
      const cl = s.hero.camp;
      assert.equal(eventXp(s, wave, cl), Math.round((100 * wave * R.xpCurve(cl) * R.diffMod(cl - L)) / R.xpCurve(L)));
    });
  });
});

describe('legacy.md 4.7 E3: zone 1 trails the hero', () => {
  test('zone 1 lag round(0.15 × (P - 1)) as 4.7 E3\'s table; zones 2-6 unchanged; off, no lag', () => {
    const H = [1, 3, 5, 8, 10, 13, 15, 18, 20, 23, 25];
    const lag = [0, 1, 2, 3, 3, 5, 5, 6, 7, 8, 9];
    const at = (set) => gates(set, () => H.map((h) => {
      const s = heroRun('rogue', h, 5);
      return [1, 2, 3, 4, 5, 6].map((z) => bandNow(s, z));
    }));
    const off = at({ legacy: true });
    const on = at(V2);
    H.forEach((h, i) => {
      const P = R.powerOfLevel(h);
      assert.equal(off[i][0], Math.max(1, P - 2));
      assert.equal(on[i][0], Math.max(1, P - 2 - lag[i]), `hero ${h}`);
      assert.deepEqual(on[i].slice(1), off[i].slice(1));
    });
  });

  test('the band is fixed at arrival (state.hero.bands[1]) with the lag; the zone 1 contract level follows it', () => gates(V2, () => {
    const s = heroRun('mage', 20, 5);
    assert.equal(s.hero.bands[1], R.powerOfLevel(20) - 2 - 7);
  }));
});

describe('legacy.md 4.7 E4: hero XP for levels 1-3', () => {
  test('heroXpToNext 1800 / 1850 / 1900 under the switch, 2000 / 2000 / 2050 off; 4-25 unchanged; heroView follows', () => {
    assert.deepEqual([1, 2, 3, 4, 24, 25].map(heroXpToNext), [2000, 2000, 2050, 2100, 4100, 4100]);
    gates(V2, () => {
      assert.deepEqual([1, 2, 3, 4, 24, 25].map(heroXpToNext), [1800, 1850, 1900, 2100, 4100, 4100]);
      assert.equal(R.heroView(heroRun('rogue', 2, 3)).xpToNext, 1850);
    });
  });

  test('a hero at level 1 levels at 1800 hero XP', () => gates(V2, () => {
    const t = JSON.parse(R.serialize(heroRun('rogue', 1, 3)));
    t.content = CONTENT;
    t.player.xp = 1799;
    const ev = [];
    gainXp(t, ev, 1, 'test');
    assert.deepEqual([t.player.heroLevel, t.player.xp], [2, 0]);
    assert.ok(ev.some((e) => e.t === 'levelUp' && e.heroLevel === 2));
  }));
});

describe('legacy.md 4.2, 4.7 E5: the hall, re-priced', () => {
  const ACCOUNT = ['satchel', 'pockets', 'quartermaster', 'cartographer', 'old_hand', 'swift_boots', 'vigor', 'edge', 'quick_study', 'second_breath', 'oaths'];
  const sum = (ids) => ids.reduce((n, id) => n + C.META_HERO[id].costs.reduce((a, b) => a + b, 0), 0);

  test('a version 3 profile is offered exactly the 13 entries (18 ids) at the E5 prices; the sums of the E5 table', () => gates(V2, () => {
    const offers = R.metaOffers(R.newProfile());
    assert.deepEqual(offers.map((o) => o.id), Object.keys(C.META_HERO));
    assert.equal(offers.length, 18);
    // hall v3d (D167): 1 650 (Hunter 1 740), 2 350 with the level-20 wing (v2: 1 640, 1 790, 2 340)
    assert.equal(sum(ACCOUNT) + sum(['sp_r1', 'sp_r2']), 1650);
    assert.equal(sum(ACCOUNT) + sum(['sp_h1', 'sp_h2', 'stormhawk']), 1740);
    assert.equal(C.TREE_OPEN_COST[0] + C.TREE_OPEN_COST[1] + C.ARMOURY_COST, 700);
    assert.equal(sum(ACCOUNT) + sum(['sp_r1', 'sp_r2']) + 700, 2350);
    assert.deepEqual(offers.find((o) => o.id === 'vigor'), { id: 'vigor', name: 'Vigor of the Line', kind: 'stat', rank: 0, ranks: 2, nextCost: 70, req: [], available: true, affordable: false });
  }));

  test('needs as 4.2: Second Breath after Oruvath reached, technique II after I, Oaths after a kill; buyMeta sells only the hall', () => gates(V2, () => {
    let p = { ...R.newProfile(), legacy: 5000 };
    const av = (q, id) => R.metaOffers(q).find((o) => o.id === id).available;
    assert.deepEqual(['second_breath', 'sp_m2', 'oaths'].map((id) => av(p, id)), [false, false, false]);
    p = R.buyMeta(p, 'sp_m1');
    assert.deepEqual([av(p, 'sp_m2'), av({ ...p, reachedBoss: true }, 'second_breath'), av({ ...p, bossKills: 1 }, 'oaths')], [true, true, true]);
    assert.throws(() => R.buyMeta(p, 'keen'), /unknown meta unlock keen/);
    p = R.buyMeta(R.buyMeta(p, 'pockets'), 'quick_study');
    assert.deepEqual([p.legacy, p.unlocks.pockets, p.unlocks.quick_study], [5000 - 120 - 50 - 80, 1, 1]);
    assert.throws(() => R.buyMeta(p, 'pockets'), /not available/);
    // a version 1 profile (level-60 game) keeps the whole catalogue, switch or not
    const v1 = gates({ legacy: false }, () => R.newProfile());
    assert.equal(R.metaOffers(v1).length, Object.keys(C.META).length);
    assert.equal(hallOf(v1, C.META), C.META);
  }));

  test('a Legacy run reads the 4.2 effects (META_HERO); a retired entry\'s rank has no effect; ranks above the hall\'s count as its top', () => gates(V2, () => {
    const u = { vigor: 4, edge: 1, quick_study: 2, pockets: 2, keen: 2, prospector: 3, talent_pt: 1, satchel: 1, sp_r1: 1, sp_r2: 1, second_breath: 1 };
    const m = metaFromProfile({ unlocks: u }, 'rogue', C.META_HERO);
    // hall v3d (D167): Vigor rank II (stored 4) +3 then +1 %, Edge rank I +2 %, Pockets +8
    assert.deepEqual([m.hpPct, m.powerPct, m.xpPct, m.bagSlots, m.crit, m.goldPct, m.talentPoints, m.satchel, m.resCharges], [0.04, 0.02, 0.1, 8, 0, 0, 0, true, 1]);
    assert.deepEqual(m.spells, ['ghostblade_rush', 'bloodprice_gambit']);
    const s = heroRun('rogue', 6, 3, true, { ...later(), unlocks: u });
    assert.deepEqual([s.meta.hpPct, s.meta.crit, s.meta.bagSlots], [0.04, 0, 8]);
    // the same profile in a Legacy run without the switch, and a level-60 run with it, read META
    const old = gates({ legacy: true, economyV2: false }, () => heroRun('rogue', 6, 3, true, { ...later(), unlocks: u }));
    assert.deepEqual([old.meta.hpPct, old.meta.crit], [4 * C.META.vigor.hpPct, 2 * C.META.keen.crit]);
  }));
});

describe('D167: hall v3d (legacy.md 4.7 E5, draft; LH1 report section 10, sim arm v3d)', () => {
  test('the catalogue: Vigor +3 / +1 %, Edge +2 / +1 % at 70 / 130, Deeper Pockets 50 for +8, Second Breath 200, Stormhawk 90; the rest as v2', () => {
    assert.deepEqual([C.HALL_VIGOR_PCT, C.HALL_EDGE_PCT, C.HALL_POCKETS_SLOTS], [[0.03, 0.01], [0.02, 0.01], 8]);
    assert.deepEqual(row('HALL_VIGOR_PCT (4.7, draft)').split(',').map(Number), C.HALL_VIGOR_PCT);
    assert.deepEqual(row('HALL_EDGE_PCT (4.7, draft)').split(',').map(Number), C.HALL_EDGE_PCT);
    assert.equal(Number(row('HALL_POCKETS_SLOTS (4.7, draft)')), C.HALL_POCKETS_SLOTS);
    const H = C.META_HERO;
    assert.deepEqual([H.vigor.hpPct, H.vigor.costs, H.edge.powerPct, H.edge.costs], [C.HALL_VIGOR_PCT, [70, 130], C.HALL_EDGE_PCT, [70, 130]]);
    assert.deepEqual([H.pockets.slots, H.pockets.costs, H.pockets.ranks], [8, [50], 1]);
    assert.deepEqual([H.second_breath.costs, H.stormhawk.costs], [[200], [90]]);
    const V2_PRICES = { satchel: [50], quartermaster: [70, 110], cartographer: [60], old_hand: [70], swift_boots: [100], quick_study: [80, 140], oaths: [0],
      sp_r1: [120], sp_m1: [120], sp_h1: [120], sp_r2: [200], sp_m2: [200], sp_h2: [200] };
    for (const [id, c] of Object.entries(V2_PRICES)) assert.deepEqual(H[id].costs, c, id);
    assert.equal(H.quick_study.xpPct, 0.05);
    // effects at each rank (nodes.js metaFromProfile sums a list field over the ranks owned)
    const fx = (u) => { const m = metaFromProfile({ unlocks: u }, 'hunter', H); return [m.hpPct, m.powerPct, m.bagSlots, m.stormhawk]; };
    assert.deepEqual(fx({}), [0, 0, 0, false]);
    assert.deepEqual(fx({ vigor: 1, edge: 1, pockets: 1, stormhawk: 1 }), [0.03, 0.02, 8, true]);
    assert.deepEqual(fx({ vigor: 2, edge: 2 }), [0.04, 0.03, 0, false]);
    // a level-60 catalogue (META, number fields) still reads rank x value
    assert.equal(metaFromProfile({ unlocks: { vigor: 3 } }, 'rogue', C.META).hpPct, 3 * C.META.vigor.hpPct);
  });

  test('a Legacy run with the hall bought plays +4 % health and +3 % Power over nothing bought; switch off: META as before', () => {
    const u = { vigor: 2, edge: 2, pockets: 1 };
    const on = gates(V2, () => heroRun('mage', 10, 3, true, { ...later(), unlocks: u }));
    const bare = gates(V2, () => heroRun('mage', 10, 3, true, later()));
    assert.deepEqual([on.meta.hpPct, on.meta.powerPct, on.meta.bagSlots], [0.04, 0.03, 8]);
    assert.equal(R.bagCapacity(on), R.bagCapacity(bare) + 8);
    // before START_RUN (CREATE) the bag count reads the same hall
    assert.equal(gates(V2, () => R.bagCapacity(R.newRun({ classId: 'mage', seed: 3, content: CONTENT, profile: { ...later(), unlocks: u } }))), C.BAG_SLOTS + 8);
    assert.ok(on.player.d.maxHp > bare.player.d.maxHp);
    const off = gates({ legacy: true, economyV2: false }, () => heroRun('mage', 10, 3, true, { ...later(), unlocks: u }));
    assert.deepEqual([off.meta.hpPct, off.meta.powerPct, off.meta.bagSlots], [2 * C.META.vigor.hpPct, 2 * C.META.edge.powerPct, C.META.pockets.slots]);
  });

  test('refund rule: a profile that bought under the v2 prices keeps its ranks and balance (no refund, no note); the next rank sells at v3d prices', () => gates(V2, () => {
    // bought under the v2 hall: Pockets at 40, Stormhawk at 150, Vigor I at 70 (spent 260)
    const p0 = { ...R.newProfile(), legacy: 140, spent: 260, unlocks: { pockets: 1, stormhawk: 1, vigor: 1 }, runs: 5, welcome: true, guide: 'done' };
    assert.equal(p0.hallV2, true);
    const p1 = R.migrateProfile(p0);
    assert.deepEqual([p1.legacy, p1.spent, p1.unlocks, p1.hallV2], [140, 260, { pockets: 1, stormhawk: 1, vigor: 1 }, true]);
    const off = (id) => R.metaOffers(p1).find((o) => o.id === id);
    assert.deepEqual([off('pockets').rank, off('pockets').available, off('stormhawk').rank, off('vigor').rank, off('vigor').nextCost], [1, false, 1, 1, 130]);
    const s = steps(R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 5, content: CONTENT, profile: p1 }), [{ type: 'START_RUN' }]);
    assert.deepEqual([s.profile.legacy, s.profile.unlocks.pockets, s.meta.hpPct, s.meta.bagSlots, s.meta.stormhawk], [140, 1, 0.03, 8, true]);
  }));
});

describe('D160: the refund of the old catalogue (legacy.md 4.7 E5)', () => {
  // a version 3 profile that bought entries under the old catalogue (GATES.legacy on, economyV2 off)
  const oldBuyer = () => gates({ legacy: true, economyV2: false }, () => {
    let p = { ...R.newProfile(), legacy: 900, runs: 3, welcome: true, guide: 'done' };
    for (const id of ['satchel', 'vigor', 'vigor', 'keen', 'quick_study']) p = R.buyMeta(p, id);
    return p;
  });
  test('the first load with economyV2 on gives back every Legacy point spent and clears the purchases, once', () => {
    const p0 = oldBuyer();
    assert.ok(p0.spent > 0 && p0.hallV2 === undefined);
    const p1 = gates(V2, () => R.migrateProfile(p0));
    assert.deepEqual([p1.legacy, p1.spent, p1.unlocks, p1.hallV2], [p0.legacy + p0.spent, 0, {}, true]);
    assert.deepEqual([p1.earned, p1.runs, p1.heroes], [p0.earned, p0.runs, p0.heroes]);
    // once: a purchase under the v2 hall is kept on every later load
    const p2 = gates(V2, () => R.migrateProfile(R.buyMeta(p1, 'vigor')));
    assert.deepEqual([p2.legacy, p2.spent, p2.unlocks], [p1.legacy - 70, 70, { vigor: 1 }]);
    assert.deepEqual(gates(V2, () => R.migrateProfile(p2)), p2);
  });
  test('switch off: the profile is as it was; a profile made or migrated with it on is marked at once', () => {
    const p0 = oldBuyer();
    assert.deepEqual(gates({ legacy: true, economyV2: false }, () => R.migrateProfile(p0)), p0);
    const fresh = gates(V2, () => R.newProfile());
    assert.deepEqual([fresh.v, fresh.hallV2, fresh.spent, fresh.legacy], [3, true, 0, 0]);
    // a version 1 profile (Echoes, Packed Satchel bought): every Echo spent comes back, the Satchel too
    const v1 = { ...gates({ legacy: false }, () => R.newProfile()), echoes: 40, spent: 260, unlocks: { satchel: 1, keen: 2 }, runs: 4 };
    const p3 = gates(V2, () => R.migrateProfile(v1));
    assert.deepEqual([p3.v, p3.legacy, p3.spent, p3.unlocks, p3.hallV2], [3, 300, 0, {}, true]);
    assert.equal(gates({ legacy: true }, () => R.migrateProfile(v1)).unlocks.satchel, 1); // 4.6 alone keeps it
  });
  test('a run started on an old profile plays the refunded hall; its end keeps the mark and pays on top', () => gates({ ...V2, oruvathLegacy: true }, () => {
    const p0 = oldBuyer();
    let s = R.newRun({ classId: 'rogue', seed: 4, content: CONTENT, profile: p0 });
    assert.deepEqual([s.profile.unlocks, s.profile.hallV2], [{}, true]);
    s = steps(s, [{ type: 'START_RUN' }]);
    assert.deepEqual([s.meta.hpPct || 0, s.meta.crit || 0], [0, 0]);
    s = steps(s, [{ type: 'SET_OUT' }, { type: 'ABANDON_RUN' }, { type: 'END_RUN' }]);
    const p = s.result.profile;
    assert.equal(p.hallV2, true);
    assert.equal(p.legacy, p0.legacy + p0.spent + s.result.echoes);
  }));
});

describe('legacy.md 4.7 E6: the clarity lines (content, draft)', () => {
  test('texts.economy holds exactly ECONOMY_TEXT_IDS with their placeholders; the validator reports a missing one', () => {
    const T = CONTENT.texts.economy;
    assert.deepEqual(Object.keys(T).sort(), [...C.ECONOMY_TEXT_IDS].sort());
    for (const [id, ph] of Object.entries(C.ECONOMY_TEXT_NEEDS)) for (const p of ph) assert.ok(T[id].includes(p), `${id} ${p}`);
    assert.equal(T.first_run_lost, 'Camp points you do not spend are lost.');
    const bad = { ...CONTENT, texts: { ...CONTENT.texts, economy: { ...T, set_out: 'You set out.', other: 'x' } } };
    const errs = R.validateContent(bad);
    for (const w of ['texts.economy.set_out: needs {contracts}', 'texts.economy.set_out: needs {points}', 'texts.economy.other: unknown id']) assert.ok(errs.includes(w), w);
  });

  test('tutorial.prep.unspentFirst: Echoes line off, Legacy line with legacy, the lost line with economyV2 as well', () => {
    const P = CONTENT.tutorial.prep;
    assert.match(P.unspentFirst, /Echoes/);
    assert.match(gates({ legacy: true }, () => P.unspentFirst), /Legacy points/);
    assert.equal(gates(V2, () => P.unspentFirst), 'Camp points you do not spend are lost.');
    assert.match(gates({ economyV2: true }, () => P.unspentFirst), /Echoes/);
  });
});

describe('golden: the switch off plays every Legacy run as on 708841f; level-60 runs ignore it', () => {
  // Recorded on 708841f (main before Economy v2) with the same script: every action, every event, the final state, the
  // result and the hall offers of the result's profile; a first run and later runs at hero 3-25, three classes.
  const playLegacy = (classId, H, seed, mode) => {
    let prof = R.newProfile();
    if (mode === 'later') prof = { ...prof, runs: 2, welcome: true, guide: 'done', legacy: 300 };
    prof = R.debug.setHero(prof, classId, { level: H, xp: 0 });
    let s = R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile: prof, mapMode: 'expedition', prep: true });
    const h = createHash('sha256');
    let n = 0;
    while (s.phase !== 'ENDED' && n < 30000) { const a = R.autoAction(s); const r = R.step(s, a); s = r.state; h.update(JSON.stringify(a)); h.update(JSON.stringify(r.events)); n++; }
    h.update(tollsMasked(R.serialize(s))); h.update(tollsMasked(s.result)); h.update(JSON.stringify(R.metaOffers(s.result.profile))); // tolls by state masked (heat state 2026-11-20)
    return `${h.digest('hex').slice(0, 16)}:${n}`;
  };
  // Heat state 2026-11-20 (engine-2026-11-20b): every hash here is of the text with the tolls by heat state masked to their total
  // (helpers.mjs tollsMasked), re-recorded on 57923eb with the engine before the change; the change hashes the same.
  // content-2026-11-20: re-recorded for the content-2026-11-20 item names (draft words); with every name masked, 108 runs over three gate arms hash as before (scratch check, docs/handoffs/content-2026-11-20.md section 4); WANT60 too.
  const RUNS = [['rogue', 1, 41, 'first'], ['mage', 3, 42, 'later'], ['hunter', 9, 43, 'later'], ['rogue', 20, 44, 'later'], ['mage', 25, 45, 'later']];
  const WANT = {
    legacy: ['336f40b6e0671f69:657', '1c8a8f1861fa0de7:643', 'f7293b7fc6c31703:546', '3824fc0c4ee820bb:280', '1bf64ca79cb58599:335'],
    'legacy+oruvathLegacy': ['ffd21f2bba28150e:644', 'f66ca1ed8b4526ca:624', '5b18da9a3d83df61:560', '3824fc0c4ee820bb:280', '71c3adb24a66ef9e:335'],
  };

  // D162 (autoplay's Legacy quest gate, AUTO_QUEST_LEVEL_SLACK) changes Legacy autoplay on purpose, so these hashes are
  // checked with the gate held open (slack Infinity: every quest scores S.quest, as on 708841f)
  const noQuestGate = (fn) => {
    const EA = C.ENGINE_ASSUMPTION;
    const old = EA.AUTO_QUEST_LEVEL_SLACK;
    EA.AUTO_QUEST_LEVEL_SLACK = Infinity;
    try { return fn(); } finally { EA.AUTO_QUEST_LEVEL_SLACK = old; }
  };

  test('ten Legacy runs (with and without oruvathLegacy) hash as recorded on 708841f with economyV2 off (D162 quest gate held open)', () => noQuestGate(() => {
    for (const [key, want] of Object.entries(WANT)) {
      const set = Object.fromEntries(key.split('+').map((k) => [k, true]));
      gates({ ...set, economyV2: false }, () => RUNS.forEach((r, i) => assert.equal(playLegacy(...r), want[i], `${key} ${r.join(':')}`)));
    }
  }));

  test('with economyV2 on the same Legacy runs change (the switch is live) and stay deterministic', () => gates({ legacy: true, oruvathLegacy: true, economyV2: true }, () => {
    const got = RUNS.map((r) => playLegacy(...r));
    assert.notDeepEqual(got, WANT['legacy+oruvathLegacy']);
    assert.deepEqual(RUNS.map((r) => playLegacy(...r)), got);
  }));

  test('level-60 runs with economyV2 on hash as recorded on 9a79dee (s23 golden: rows, start camp, first, guided, second)', () => gates({ economyV2: true, oruvathLegacy: true }, () => {
    const WANT60 = {
      'rows:mage:21': '4c1709081fa9aff7:99', 'expPrep:rogue:21': 'c6c11d0e1f3da61f:217', 'expPrep:hunter:22': '7c093ef57e92cd0f:575',
      'first:mage:23': 'ab595ce5d0268f3f:107', 'guided:rogue:24': 'f73a594d9e653247:386', 'second:hunter:25': '0e0821fa208f1abf:625',
    };
    const N = { rows: 2, expPrep: 2, first: 0, guided: 0, second: 1 };
    for (const [key, want] of Object.entries(WANT60)) {
      const [mode, classId, seed] = key.split(':');
      const profile = { ...R.newProfile(), runs: N[mode], ...(mode === 'second' ? { echoes: 140, spent: 140, unlocks: { satchel: 1, vigor: 1 } } : {}) };
      const o = { classId, petId: PET(classId), seed: Number(seed), content: CONTENT, profile };
      if (mode === 'rows') Object.assign(o, { mapMode: 'rows' });
      else if (mode === 'guided') Object.assign(o, { mapMode: 'expedition', prep: true, tutorial: true });
      else Object.assign(o, { mapMode: 'expedition', prep: true });
      let s = R.newRun(o);
      const h = createHash('sha256');
      let n = 0;
      while (s.phase !== 'ENDED' && n < 20000) { const a = R.autoAction(s); const r = R.step(s, a); s = r.state; h.update(JSON.stringify(a)); h.update(JSON.stringify(r.events)); n++; }
      h.update(tollsMasked(R.serialize(s))); h.update(tollsMasked(s.result)); h.update(JSON.stringify(R.metaOffers(s.result.profile))); // tolls by state masked (heat state 2026-11-20)
      assert.equal(`${h.digest('hex').slice(0, 16)}:${n}`, want, key);
    }
  }));
});
