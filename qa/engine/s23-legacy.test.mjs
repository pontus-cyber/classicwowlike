// Legacy phase 1, engine side (D154-D155; docs/specs/legacy.md 1, 2, 4.1, 4.6, 5.1, 10; engine-api.md 15): behind
// C.GATES.legacy (off by default). The constants against legacy.md 10; the version 3 profile and the migration of Echoes
// (4.6); the hero at the run's start (1.6-1.7: level, XP, talents, spells trained free, bar, the Wayfarer's kit, gold); hero
// XP and levels (1.3-1.4: awards, rested pool, HERO_XP, the power level, XP past 25); zones at the hero's level (2.1-2.2:
// bands at arrival, rings, dungeons, contracts, CL_MAX, ILVL_MAX_HERO, the zone tier's damage); the Camp and Oruvath (2.4,
// oruvathScale); Legacy points (4.1: the lines, LEGACY_PER_LEVEL, written back with the hero; death keeps level and XP);
// ABANDON_RUN (1.5); the guided first run at the new levels (5.1); five runs in a row with one hero and a reload; the views
// (heroView, heroesView, shownLevel); the golden check with the switch off (every run, its profile included, as on 9a79dee).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { tollsMasked } from './helpers.mjs';
import { makeEnemy } from '../../src/engine/combat.js';
import { bossDmgFactor } from '../../src/engine/damage.js';
import { oruvathScale } from '../../src/engine/legacy.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
/** fn with C.GATES.legacy on (and `set`), every switch restored after. */
function legacy(fn, set = {}) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, { legacy: true }, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
const copy = (s) => { const o = JSON.parse(R.serialize(s)); o.content = CONTENT; return o; };
const steps = (s, list, events = []) => { for (const a of list) { const r = R.step(s, a); s = r.state; events.push(...r.events); } return s; };
const run = (classId, seed, profile, opts = {}) => R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, profile, ...opts });
/** A Legacy run of `classId` with its hero at hero level H (debug.setHero), at zone 1's hub after SET_OUT. */
function heroRun(classId, H, seed = 7, xp = 0, base = null) {
  const prof = R.debug.setHero(base || R.newProfile(), classId, { level: H, xp });
  return steps(run(classId, seed, prof), [{ type: 'START_RUN' }, { type: 'SET_OUT' }]);
}
/** Autoplay until `stop(state)` or the run's end (at most n steps), events collected. */
function auto(s, stop, events = [], n = 30000) {
  for (let i = 0; i < n && s.phase !== 'ENDED' && !stop(s); i++) { const r = R.step(s, R.autoAction(s)); s = r.state; events.push(...r.events); }
  return s;
}
const SPEC = readFileSync(fileURLToPath(new URL('../../docs/specs/legacy.md', import.meta.url)), 'utf8');

describe('legacy.md 10: the constants (draft); GATES.legacy off', () => {
  test('the switch is off by default; POWER_OF_LEVEL = round(1 + (H - 1) × 59 / 24); HERO_XP sums to 69 800; HERO_XP_AT_MAX = HERO_XP[24]', () => {
    assert.equal(C.GATES.legacy, false);
    assert.deepEqual(C.POWER_OF_LEVEL, Array.from({ length: 25 }, (_, i) => Math.round(1 + (i * 59) / 24)));
    assert.equal(C.HERO_XP.length, 24);
    assert.equal(C.HERO_XP.reduce((a, b) => a + b, 0), 69800);
    assert.equal(C.HERO_XP_AT_MAX, C.HERO_XP[23]);
    assert.deepEqual([R.powerOfLevel(1), R.powerOfLevel(10), R.powerOfLevel(25), R.heroXpToNext(1), R.heroXpToNext(24), R.heroXpToNext(25)], [1, 23, 60, 2000, 4100, 4100]);
  });

  test('every numeric row of the table equals the engine constant; names that differ in rules.md 13 carry _HERO', () => {
    const i = SPEC.indexOf('## 10. Constant table');
    const rows = SPEC.slice(i).split('\n').filter((l) => l.startsWith('| ') && !/^\|[-| ]+\|$/.test(l)).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
    const HERO = { RING_CL_BASE: 'RING_CL_BASE_HERO', RING_CL_SPREAD: 'RING_CL_SPREAD_HERO', DUNGEON_LEVEL_OFFSET: 'DUNGEON_LEVEL_OFFSET_HERO', CONTRACT_CL_OFFSET: 'CONTRACT_CL_OFFSET_HERO', ILVL_MAX: 'ILVL_MAX_HERO', ONB_ELITE_LEVEL_MIN: 'ONB_ELITE_LEVEL_MIN_HERO' };
    const built = ['HEROES_PER_CLASS', 'HERO_MAX_LEVEL', 'POWER_OF_LEVEL', 'HERO_XP_UNIT', 'HERO_XP', 'HERO_XP_AT_MAX', 'START_GOLD_V', 'ZONE_TIER', 'ZONE_TIER_DMG', 'RING_CL_BASE', 'RING_CL_SPREAD', 'DUNGEON_LEVEL_OFFSET', 'CONTRACT_CL_OFFSET', 'CL_MAX', 'ILVL_MAX', 'CAMP_TIER', 'BOSS_TIER', 'BOSS_REF_LEVEL', 'ONB_ELITE_LEVEL_MIN', 'LEGACY_PER_LEVEL'];
    let n = 0;
    for (const [name, raw] of rows) {
      if (!built.includes(name)) continue;
      const want = raw.split(',').map((x) => Number(x.trim().replace(/^\+/, '')));
      const got = C[HERO[name] || name];
      assert.deepEqual(Array.isArray(got) ? got : [got], want, name);
      n += 1;
    }
    assert.equal(n, built.length);
    assert.deepEqual([C.BOSS_HP_LEVEL_BASE, C.BOSS_HP_LEVEL_STEP, C.KIT_RARITY], [0.40, 0.024, 'common']);
    // rules.md 13 keeps its values (the game with the switch off)
    assert.deepEqual([C.RING_CL_BASE, C.RING_CL_SPREAD, C.DUNGEON_LEVEL_OFFSET, C.CONTRACT_CL_OFFSET, C.ILVL_MAX, C.ONB_ELITE_LEVEL_MIN], [[0, 1, 4, 7], 3, 4, 8, 63, 4]);
  });

  test('4.1: the Echo lines renamed LEGACY_* with the same values; the ECHO_* names are aliases', () => {
    const pairs = [['LEGACY_PER_ZONE', 'ECHO_PER_ZONE', 7.5], ['LEGACY_PER_DUNGEON', 'ECHO_PER_DUNGEON', 8], ['LEGACY_PER_ELITE', 'ECHO_PER_ELITE', 3], ['LEGACY_PER_RARE', 'ECHO_PER_RARE', 6],
      ['LEGACY_PER_QUEST', 'ECHO_PER_QUEST', 1], ['LEGACY_CONTRACT_MULT', 'ECHO_CONTRACT_MULT', 3], ['LEGACY_PER_HEAT_FIGHT', 'ECHO_PER_HEAT_FIGHT', 1], ['LEGACY_BOSS_REACHED', 'ECHO_BOSS_REACHED', 20],
      ['LEGACY_BOSS_PHASE', 'ECHO_BOSS_PHASE', 12], ['LEGACY_BOSS_KILL', 'ECHO_BOSS_KILL', 120], ['LEGACY_SPEED_BONUS', 'ECHO_SPEED_BONUS', 40], ['LEGACY_FIRST_KILL_CLASS', 'ECHO_FIRST_KILL_CLASS', 100],
      ['LEGACY_PER_PREP_POINT', 'PREP_ECHO_PER_POINT', 2], ['LEGACY_WELCOME', 'ONB_WELCOME_ECHOES', 60], ['LEGACY_OATH_BONUS', 'OATH_ECHO_BONUS', 0.25]];
    for (const [now, old, v] of pairs) assert.deepEqual([C[now], C[old]], [v, v], now);
    assert.deepEqual([C.LEGACY_PER_LEVEL, C.ECHO_PER_LEVEL], [20, 1]);
  });
});

describe('legacy.md 4.6: the version 3 profile and the migration of Echoes', () => {
  test('switch off: newProfile is version 1 with Echoes, migrateProfile keeps it; switch on: version 3, Legacy points, no hero', () => {
    const v1 = R.newProfile();
    assert.equal(v1.v, 1);
    assert.equal(v1.echoes, 0);
    assert.equal('heroes' in v1 || 'legacy' in v1, false);
    assert.deepEqual(R.migrateProfile(v1), v1);
    legacy(() => {
      const p = R.newProfile();
      assert.equal(p.v, 3);
      assert.deepEqual([p.legacy, p.heroes, 'echoes' in p], [0, {}, false]);
      assert.deepEqual(R.heroesView(p), [null, null, null]);
    });
  });

  test('legacy = echoes + spent (Packed Satchel kept, its price not refunded); ranks cleared; boss flags, runs, guide, welcome kept; version 3 stays', () => {
    const v1 = { ...R.newProfile(), echoes: 75, earned: 600, spent: 525, runs: 6, guide: 'done', welcome: true, reachedBoss: true, bossKills: 2,
      firstKill: { rogue: true, mage: false, hunter: true }, unlocks: { satchel: 1, vigor: 2, edge: 1, keen: 1, wayfinder: 1 } };
    legacy(() => {
      const p = R.migrateProfile(v1);
      assert.equal(p.v, 3);
      assert.equal(p.legacy, 75 + 525 - C.META.satchel.costs[0]);
      assert.deepEqual([p.spent, p.earned, p.unlocks], [60, 600, { satchel: 1 }]);
      assert.deepEqual([p.runs, p.guide, p.welcome, p.reachedBoss, p.bossKills, p.firstKill], [6, 'done', true, true, 2, v1.firstKill]);
      assert.deepEqual([p.heroes, 'echoes' in p], [{}, false]);
      assert.deepEqual(R.migrateProfile(p), p); // once only
      // no Satchel: every Echo spent comes back
      const q = R.migrateProfile({ ...v1, unlocks: { vigor: 1 }, spent: 80 });
      assert.deepEqual([q.legacy, q.spent, q.unlocks], [75 + 80, 0, {}]);
      // the catalogue sells for Legacy points
      const offer = R.metaOffers(p).find((o) => o.id === 'vigor');
      assert.equal(offer.affordable, p.legacy >= offer.nextCost);
      const b = R.buyMeta(p, 'vigor');
      assert.deepEqual([b.legacy, b.spent, b.unlocks.vigor], [p.legacy - offer.nextCost, 60 + offer.nextCost, 1]);
      assert.equal(R.debug.grantEchoes(p, 5).legacy, p.legacy + 5);
    });
    // a version 3 profile stays version 3 with the switch off (no downgrade), and still buys with Legacy points
    const p3 = legacy(() => R.migrateProfile(v1));
    assert.deepEqual(R.migrateProfile(p3), p3);
    assert.equal(R.buyMeta(p3, 'edge').legacy, p3.legacy - C.META.edge.costs[0]);
  });
});

describe('legacy.md 1.6-1.7: the run starts with the hero', () => {
  test('a new hero: level 1, power 1, the class start spells, START_GOLD_V × V(1) gold, the Wayfarer kit in ten slots', () => legacy(() => {
    for (const classId of C.CLASS_IDS) {
      const s = steps(run(classId, 3, null, { name: 'Ana' }), [{ type: 'START_RUN' }]);
      const p = s.player;
      assert.equal(s.legacy, true);
      assert.deepEqual([p.heroLevel, p.level, p.xp, p.gold], [1, 1, 0, Math.round(C.START_GOLD_V * R.V(1))]);
      assert.deepEqual(Object.keys(p.spells).sort(), C.CLASS[classId].startSpells.slice().sort());
      assert.deepEqual(p.bar.slice(0, 2), C.CLASS[classId].startSpells);
      assert.deepEqual(C.SLOT_IDS.map((k) => [p.equipped[k].rarity, p.equipped[k].ilvl]), C.SLOT_IDS.map(() => ['common', 1]));
      const txt = CONTENT.classes[classId];
      assert.deepEqual([p.equipped.weapon.name, p.equipped.chest.name], [txt.startWeapon, txt.startChest]);
      assert.deepEqual(R.heroView(s), { classId, level: 1, xp: 0, xpToNext: 2000, atMax: false, power: 1, start: { level: 1, xp: 0 }, gained: 0 });
      assert.equal(p.name, 'Ana');
      assert.deepEqual(R.debug.validate(s, { steps: false }), []);
    }
  }));

  test('a hero at level 10: power 23, every spell up to it learned and trained free (rank 10), kit at item level 23, gold 3 V(23); nothing to train', () => legacy(() => {
    for (const classId of C.CLASS_IDS) {
      const s = heroRun(classId, 10, 4, 1234);
      const p = s.player;
      assert.deepEqual([p.heroLevel, p.level, p.xp, p.gold], [10, 23, 1234, Math.round(3 * R.V(23))]);
      const want = Object.values(C.SPELL).filter((sp) => sp.cls === classId && sp.source === 'class' && sp.lvl <= 23).map((sp) => sp.id).sort();
      assert.deepEqual(Object.keys(p.spells).sort(), want);
      for (const id of want) assert.deepEqual(p.spells[id], { tl: 23, rank: 10 }, id);
      assert.ok(C.SLOT_IDS.every((k) => p.equipped[k].ilvl === 23 && p.equipped[k].rarity === 'common'));
      assert.equal(R.trainerView(s).useful, false);
      assert.deepEqual(R.trainerView(s).learn, []);
      // a hero without a bar of its own: the start spells first, then the others while a slot is free
      assert.deepEqual(p.bar.filter(Boolean).length, Math.min(C.SPELL_BAR_SLOTS, want.length));
      assert.deepEqual(R.debug.validate(s, { steps: false }), []);
    }
  }));

  test('kept on the hero: talents (and their spells), the bar, the spells; meta spells only with the unlock', () => legacy(() => {
    let prof = R.debug.setHero(R.newProfile(), 'rogue', { level: 18 });
    prof.heroes.rogue.talents = { r_c1: 3, r_c2: 3, r_c3: 2, r_c4: 2, r_c5: 2, r_c6: 2, r_c7: 1 };
    prof.heroes.rogue.bar = ['rupture_venom', 'gutting_jab', null, 'ghostblade_rush', 'open_vein', null, null];
    prof.heroes.rogue.spellOrder = ['gutting_jab', 'ghostblade_rush'];
    let s = steps(run('rogue', 5, prof), [{ type: 'START_RUN' }]);
    let p = s.player;
    assert.equal(p.talentSpent, 15);
    assert.deepEqual(p.talents, prof.heroes.rogue.talents);
    assert.ok(p.spells.rupture_venom);
    assert.equal(p.spells.ghostblade_rush, undefined); // no Lost Technique I on the profile
    assert.deepEqual(p.bar, ['rupture_venom', 'gutting_jab', null, null, 'open_vein', null, null]);
    assert.equal(R.talentPointsFree(s), 17 - 15); // TALENT_POINTS of hero level 18 (power 43)
    prof = { ...prof, unlocks: { ...prof.unlocks, sp_r1: 1 } };
    s = steps(run('rogue', 5, prof), [{ type: 'START_RUN' }]);
    p = s.player;
    assert.deepEqual(p.spells.ghostblade_rush, { tl: 43, rank: 18 });
    assert.equal(p.bar[3], 'ghostblade_rush');
    assert.deepEqual(R.debug.validate(s, { steps: false }), []);
  }));
});

describe('legacy.md 1.3-1.4: hero XP and levels', () => {
  test('awards in hero XP: round(HERO_XP_UNIT × frac × xpCurve(CL) / xpCurve(L) × diffMod(CL - L)): a kill at the hero level 40, a quest turn-in 161, a Cull 280', () => legacy(() => {
    const s = heroRun('mage', 10);
    const L = s.player.level;
    const award = (frac, cl) => Math.round((C.HERO_XP_UNIT * frac * R.xpCurve(cl) * R.diffMod(cl - L)) / R.xpCurve(L));
    assert.deepEqual([award(C.MOB_XP_FRAC * C.XP_WEIGHT_MULT, L), award(C.QUEST_TURNIN_XP_FRAC * C.XP_WEIGHT_MULT, L)], [40, 161]);
    assert.equal(Math.round(C.HERO_XP_UNIT * C.CULL_XP_FRAC * C.XP_WEIGHT_MULT), 280);
    // the engine's award for a kill two levels over the hero (no rested: the pool is empty at Set out)
    const k = R.debug.encounter(steps(s, [{ type: 'LEAVE_HUB' }]), { ids: ['z1_furrow_boar'], level: L + 2 });
    const got = R.debug.killTarget(k.state, 0).events.find((v) => v.t === 'xp' && v.why === 'kill');
    assert.equal(got.amount, award(C.MOB_XP_FRAC * C.XP_WEIGHT_MULT, L + 2));
  }));

  test('level-ups: HERO_XP of each level with carry-over, the power level jumps to POWER_OF_LEVEL, talent points counted; at 25 every HERO_XP_AT_MAX is a heroMax', () => legacy(() => {
    // hero level 4 (power 8) with 4 299 XP: HERO_XP 2 100 to level 5, then 2 150 to level 6; one kill pays the rest
    const x = copy(heroRun('hunter', 4, 9));
    x.player.xp = 2100 + 2150 - 1;
    const before = x.player.d.maxHp;
    const k = R.debug.encounter(steps(x, [{ type: 'LEAVE_HUB' }]), { ids: ['z1_furrow_boar'], level: 8 });
    const r = R.debug.killTarget(k.state, 0);
    const gain = r.events.find((e) => e.t === 'xp').amount;
    const ups = r.events.filter((e) => e.t === 'levelUp');
    assert.deepEqual(ups.map((e) => [e.heroLevel, e.level, e.talentPoints]), [[5, 11, 1], [6, 13, 1]]); // points: power 8 -> 11 -> 13
    const p = r.state.player;
    assert.deepEqual([p.heroLevel, p.level, p.xp, r.state.hero.gained], [6, 13, 2100 + 2150 - 1 + gain - 2100 - 2150, 2]);
    assert.ok(p.d.maxHp > before);
    // hero level 25: XP keeps counting; each HERO_XP_AT_MAX is one heroMax (one more line of LEGACY_PER_LEVEL)
    const s = heroRun('rogue', 25, 3, C.HERO_XP_AT_MAX - 1);
    assert.equal(s.player.level, 60);
    const k2 = R.debug.encounter(steps(s, [{ type: 'LEAVE_HUB' }]), { ids: ['z1_furrow_boar'], level: 60 });
    const r2 = R.debug.killTarget(k2.state, 0);
    const g2 = r2.events.find((e) => e.t === 'xp').amount;
    assert.ok(g2 > 0);
    assert.deepEqual(r2.events.filter((e) => e.t === 'heroMax'), [{ t: 'heroMax', over: 1 }]);
    assert.deepEqual([r2.state.player.heroLevel, r2.state.player.level, r2.state.player.xp, r2.state.hero.over], [25, 60, C.HERO_XP_AT_MAX - 1 + g2 - C.HERO_XP_AT_MAX, 1]);
  }));

  test('the rested pool in hero XP: a rest adds REST_RESTED_FRAC × HERO_XP_UNIT, capped at RESTED_CAP_FRAC × HERO_XP_UNIT', () => legacy(() => {
    let s = heroRun('rogue', 6);
    s = steps(s, [{ type: 'SERVICE', service: 'inn' }]);
    assert.equal(s.player.rested, Math.round(C.REST_RESTED_FRAC * C.HERO_XP_UNIT));
    const x = copy(s);
    x.player.rested = 140;
    x.hub.used.inn = false;
    assert.equal(steps(x, [{ type: 'SERVICE', service: 'inn' }]).player.rested, Math.round(C.RESTED_CAP_FRAC * C.HERO_XP_UNIT));
  }));
});

describe('legacy.md 2.1-2.2: zones at the hero level', () => {
  test('each zone is set at arrival: band = clamp(P + ZONE_TIER, 1, CL_MAX); rings [0, 0, 1, 2] spread 2, quests ±1, elites +1, dungeons +2 / +4; hub vendor and contracts', () => legacy(() => {
    for (const [H, z] of [[1, 1], [10, 1], [10, 4], [20, 6], [25, 6]]) {
      let s = heroRun('mage', H, 11 + z);
      if (z > 1) { for (let k = 1; k < z; k++) s = R.debug.nextZone(s).state; }
      const P = R.powerOfLevel(H);
      const band = Math.min(66, Math.max(1, P + C.ZONE_TIER[z - 1]));
      assert.equal(s.hero.bands[z], band, `H${H} z${z}`);
      for (const n of s.zone.nodes) {
        if (n.ring === 0) { assert.equal(n.cl, band); continue; }
        const lo = band + C.RING_CL_BASE_HERO[n.ring];
        const hi = lo + C.RING_CL_SPREAD_HERO - 1;
        const cl = n.type === 'dungeon' ? null : n.cl;
        if (n.type === 'quest') assert.ok(cl >= Math.max(1, lo - 1) && cl <= Math.min(66, hi + 1), `quest ${cl} in ${lo}-${hi}`);
        else if (n.type === 'dungeon') assert.deepEqual([n.trashLevel, n.bossLevel], [Math.min(66, band + 2), Math.min(66, band + 4)]);
        else assert.ok(cl >= Math.min(66, lo) && cl <= Math.min(66, hi), `${n.type} ${cl} in ${lo}-${hi}`);
        if (n.type === 'elite') assert.equal(n.eliteLevel, Math.min(66, n.cl + 1));
        if (n.type === 'vendor') assert.ok(n.stock.filter((e) => e.kind === 'gear').every((e) => e.item.ilvl <= C.ILVL_MAX_HERO));
      }
      const v = R.mapView(s);
      assert.deepEqual(v.bands[0], [band, band]);
      assert.deepEqual(v.bands[3], [Math.min(66, band + 2), Math.min(66, band + 3)]);
    }
  }));

  test('a level-up inside the zone does not move its band; the next zone is set from the new level', () => legacy(() => {
    const s = heroRun('rogue', 5, 21, 2149);
    const b1 = s.hero.bands[1];
    const k = R.debug.encounter(steps(s, [{ type: 'LEAVE_HUB' }]), { ids: ['z1_furrow_boar'], level: 12 });
    const r = R.debug.killTarget(k.state, 0);
    assert.equal(r.state.player.heroLevel, 6);
    assert.equal(r.state.hero.bands[1], b1);
    assert.ok(r.state.zone.nodes.every((n) => n.ring > 0 || n.cl === b1));
    const z2 = R.debug.nextZone(r.state).state;
    assert.equal(z2.hero.bands[2], R.powerOfLevel(6) + C.ZONE_TIER[1]);
  }));

  test('zone tier damage: a template enemy deals × ZONE_TIER_DMG[z] in zone z (the Camp: zone 6), on top of zone danger; not outside a Legacy run', () => {
    const s = legacy(() => steps(run('rogue', 1, null), [{ type: 'START_RUN' }]));
    const dmg = (leg, z) => {
      const x = copy(s);
      if (!leg) delete x.legacy;
      x.fight = { z, kind: 'quest', enemies: [] };
      return makeEnemy(x, 0, 'z1_furrow_boar', 12, 'normal').dmg;
    };
    for (let z = 1; z <= 7; z++) assert.ok(Math.abs(dmg(true, z) / dmg(false, z) - C.ZONE_TIER_DMG[Math.min(6, z) - 1]) < 1e-12, `zone ${z}`);
  });

  test('CL_MAX 66 and ILVL_MAX_HERO 69: a level-25 hero meets zone 6 at 63-66; contracts at the band + 2', () => legacy(() => {
    let s = heroRun('hunter', 25, 31);
    for (let k = 1; k < 6; k++) s = R.debug.nextZone(s).state;
    assert.equal(s.hero.bands[6], 63);
    assert.ok(s.zone.nodes.every((n) => n.cl <= 66 && (n.eliteLevel || 0) <= 66));
    assert.ok(s.zone.nodes.some((n) => n.cl > 60));
    // contract level: the zone's band + CONTRACT_CL_OFFSET_HERO (zones not reached: the band at the level now)
    const pv = steps(run('hunter', 32, R.debug.setHero({ ...R.newProfile(), runs: 2 }, 'hunter', { level: 10 })), [{ type: 'START_RUN' }]);
    for (const o of R.prepView(pv).board) {
      const band = 23 + C.ZONE_TIER[o.z - 1];
      assert.equal(o.reward.cl, band + 2);
      assert.deepEqual(o.band, [band, band + 3]);
      assert.equal(o.reward.xp, Math.round((100 * C.CONTRACT[o.kind].xpFrac * C.XP_WEIGHT_MULT * R.xpCurve(band + 2)) / R.xpCurve(23)));
    }
  }));
});

describe('legacy.md 2.4: the Camp and Oruvath (oruvathScale, one place)', () => {
  test('the Camp at P + CAMP_TIER: its vendor and its waves; autoplay goes to Oruvath without the grind to 60', () => legacy(() => {
    const s = R.debug.toCamp(heroRun('mage', 12, 41)).state;
    const P = R.powerOfLevel(12);
    assert.equal(s.hero.camp, P + C.CAMP_TIER);
    const v = steps(s, [{ type: 'SERVICE', service: 'vendor' }]);
    assert.equal(v.service.cl, P + C.CAMP_TIER);
    const w = steps(steps(v, [{ type: 'LEAVE' }]), [{ type: 'CAMP_GRIND' }]);
    assert.ok(w.fight.enemies.every((e) => e.level === P + C.CAMP_TIER));
    const fresh = steps(R.debug.toCamp(heroRun('mage', 12, 42)).state, []);
    const a = auto(fresh, (x) => x.phase !== 'CAMP');
    assert.equal(a.phase, 'BOSS');
    assert.equal(a.stats.campWaves, 0);
  }));

  test('Oruvath at P + BOSS_TIER: HP and Shard HP × hpScale × min(1, 0.40 + 0.024 H), damage × dmgScale, armour × LB / 62, Shards at LB - 2', () => legacy(() => {
    for (const H of [1, 10, 20, 25]) {
      const s = R.debug.toBoss(heroRun('rogue', H, 51)).state;
      const P = R.powerOfLevel(H);
      const LB = P + C.BOSS_TIER;
      const b = s.fight.enemies[0];
      const hpScale = (C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * LB) / (C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * 62);
      const lvl = Math.min(1, 0.4 + 0.024 * H);
      const dmgAt = (M) => (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * M) * R.zoneDanger(M);
      assert.equal(b.level, LB);
      assert.equal(b.maxHp, Math.round(C.BOSS_HP * (1 + b.asc) * hpScale * lvl));
      assert.equal(b.armor, Math.round(C.BOSS_ARMOR * LB / 62));
      const sc = s.fight.boss.scale;
      assert.ok(Math.abs(sc.dmg - dmgAt(LB) / dmgAt(62)) < 1e-12);
      assert.deepEqual(sc, oruvathScale(s, R.zoneDanger));
      // the Shards (phase 2)
      const p2 = R.debug.toBoss(heroRun('rogue', H, 51), { phase: 2 }).state;
      const sh = p2.fight.enemies.filter((e) => e.kind === 'shard');
      assert.ok(sh.length > 0);
      for (const x of sh) assert.deepEqual([x.level, x.maxHp, x.armor], [LB - 2, Math.round(C.SHARD_HP * (1 + x.asc) * hpScale * lvl), C.ENEMY_ARMOR_PER_LEVEL * (LB - 2)]);
    }
    // every damage of the fight (his hits, the Shards, the Brand) × the scale's dmg, through bossDmgFactor
    const s = R.debug.toBoss(heroRun('rogue', 10, 52)).state;
    assert.equal(bossDmgFactor(s, 0.1), C.BOSS_DMG_MULT * 1.1 * s.fight.boss.scale.dmg);
    assert.ok(s.fight.boss.scale.dmg < 0.5); // power 28 against BOSS_REF_LEVEL 62: zone danger is quadratic in level
  }));

  test('switch off: Oruvath as tuned (BOSS_LEVEL, BOSS_HP, BOSS_ARMOR), no scale on the fight', () => {
    const s = R.debug.toBoss(R.debug.build({ content: CONTENT, classId: 'mage', zone: 7 }).state).state;
    const b = s.fight.enemies[0];
    assert.deepEqual([b.level, b.maxHp, b.armor, 'scale' in s.fight.boss], [C.BOSS_LEVEL, Math.round(C.BOSS_HP * (1 + b.asc)), C.BOSS_ARMOR, false]);
  });
});

describe('legacy.md 4.1, 1.5: Legacy points, death keeps the hero, ABANDON_RUN', () => {
  test('the level line is LEGACY_PER_LEVEL a hero level gained; the other lines as the Echo lines; summary.legacy; END_RUN writes the hero back', () => legacy(() => {
    const prof = R.debug.setHero({ ...R.newProfile(), runs: 2, welcome: true }, 'rogue', { level: 3, xp: 1900 });
    const ev = [];
    let s = auto(steps(run('rogue', 61, prof), [{ type: 'START_RUN' }]), (x) => x.phase === 'SUMMARY', ev);
    assert.equal(s.phase, 'SUMMARY');
    const sum = R.summary(s);
    const gained = ev.filter((e) => e.t === 'levelUp').length;
    assert.ok(gained >= 1);
    assert.deepEqual(sum.hero.gained, gained);
    const line = sum.echoes.lines.find((l) => l.id === 'levels');
    assert.deepEqual([line.count, line.each, line.echoes], [gained, 20, 20 * gained]);
    assert.deepEqual(sum.legacy, sum.echoes);
    s = steps(s, [{ type: 'END_RUN' }]);
    const p = s.result.profile;
    assert.equal(s.result.legacy, sum.echoes.total);
    assert.equal(p.legacy, prof.legacy + sum.echoes.total);
    const h = p.heroes.rogue;
    assert.deepEqual([h.level, h.xp, h.runs, h.wins], [sum.hero.level, sum.hero.xp, 1, sum.outcome === 'victory' ? 1 : 0]);
    assert.deepEqual(h.talents, s.player.talents);
    assert.deepEqual(h.bar, s.player.bar);
    assert.deepEqual(h.spells, s.player.spells);
  }));

  test('death keeps level, XP, talents and spells; every zone arrival writes the hero to the run profile; a dev run leaves the profile as it was', () => legacy(() => {
    let s = steps(heroRun('mage', 7, 71, 100), [{ type: 'LEAVE_HUB' }]);
    assert.deepEqual([s.profile.heroes.mage.level, s.profile.heroes.mage.xp], [7, 100]);
    const x = copy(s);
    x.player.xp = 2000;
    x.zone.pos = x.zone.roads[0];
    const t2 = steps(x, [{ type: 'TAKE_ROAD' }]);
    assert.deepEqual([t2.zone.z, t2.profile.heroes.mage.xp], [2, 2000]); // zone 2's arrival wrote the hero
    // a death in a node fight: HP 1 against huge damage
    let d = auto(steps(t2, [{ type: 'LEAVE_HUB' }]), (y) => !!y.fight);
    d = copy(d);
    d.player.hp = 1;
    for (const e of d.fight.enemies) e.dmg = 1e6;
    d.oaths = ['frailty']; // no resurrect charge
    for (let i = 0; i < 10 && d.fight; i++) d = steps(d, [{ type: 'PASS' }]);
    assert.deepEqual([d.phase, d.outcome], ['SUMMARY', 'death']);
    const end = steps(d, [{ type: 'END_RUN' }]);
    const h = end.result.profile.heroes.mage;
    assert.deepEqual([h.level, h.xp, h.runs, h.wins], [d.player.heroLevel, d.player.xp, 1, 0]);
    assert.deepEqual([h.talents, h.spells, h.bar], [d.player.talents, d.player.spells, d.player.bar]);
    assert.equal(end.result.profile.legacy, end.result.legacy);
    // a dev run (debug.encounter marks it): END_RUN leaves the profile as it was
    const f = R.debug.encounter(steps(t2, [{ type: 'LEAVE_HUB' }]), { ids: ['z2_mawgrim'], level: 40 }).state;
    const dev = auto(f, (y) => y.phase === 'ENDED');
    assert.deepEqual(dev.result.profile, f.profile);
  }));

  test('ABANDON_RUN: a Legacy run only; any phase from PREP to the boss, a fight and the loot window included; a death where the hero stands; not listed', () => {
    const off = steps(run('rogue', 3, null), [{ type: 'START_RUN' }]);
    assert.match(R.whyIllegal(off, { type: 'ABANDON_RUN' }), /Legacy/);
    legacy(() => {
      const c = run('rogue', 3, null);
      assert.ok(R.whyIllegal(c, { type: 'ABANDON_RUN' }));
      const s = heroRun('hunter', 8, 81);
      const f = R.debug.encounter(steps(s, [{ type: 'LEAVE_HUB' }]), { ids: ['z1_furrow_boar'], level: 18 }).state;
      assert.ok(f.fight);
      assert.equal(R.legalActions(f).some((a) => a.type === 'ABANDON_RUN'), false);
      const r = R.step(f, { type: 'ABANDON_RUN' });
      assert.deepEqual([r.state.phase, r.state.outcome, r.state.fight, r.state.death.killer.name, r.state.death.zone], ['SUMMARY', 'death', null, 'abandon', 1]);
      assert.ok(r.events.some((e) => e.t === 'abandon'));
      const end = steps(r.state, [{ type: 'END_RUN' }]);
      assert.equal(end.result.profile.heroes.hunter.level, 8);
      const prep = steps(run('mage', 4, null), [{ type: 'START_RUN' }]);
      assert.equal(steps(prep, [{ type: 'ABANDON_RUN' }]).phase, 'SUMMARY');
    });
  });
});

describe('legacy.md 5.1: the guided first run at the new levels', () => {
  test('zone 1 at band 1 (rings 1-4), Gorrak at clamp(P + 1, 2, 8), the hero leaves at level 2; the bounty on the road is hero XP at zone 1 band + 2', () => legacy(() => {
    for (const classId of C.CLASS_IDS) {
      let s = R.newRun({ classId, petId: PET(classId), seed: 11, content: CONTENT, tutorial: true });
      s = steps(s, [{ type: 'START_RUN' }, { type: 'SET_OUT' }]);
      assert.equal(s.hero.bands[1], 1);
      assert.ok(s.zone.nodes.every((n) => n.cl >= 1 && n.cl <= 4));
      let met = null;
      let road = null;
      for (let i = 0; i < 8000 && !(s.zone && s.zone.z === 2); i++) {
        const before = s;
        const r = R.step(s, R.autoAction(s));
        s = r.state;
        if (!before.fight && s.fight && s.fight.tut && s.fight.tut.kind === 'elite') met = [s.player.level, s.fight.enemies[0].level];
        const b = r.events.find((e) => e.t === 'bounty' && e.road);
        if (b) road = { xp: b.xp, L: before.player.level };
      }
      assert.ok(met, classId);
      assert.equal(met[1], Math.min(C.ONB_ELITE_LEVEL_MAX, Math.max(C.ONB_ELITE_LEVEL_MIN_HERO, met[0] + 1)), classId);
      // Gorrak's road XP: the Cull's hero XP at zone 1's contract level (band 1 + CONTRACT_CL_OFFSET_HERO) over the hero's level
      assert.equal(road.xp, Math.round((C.HERO_XP_UNIT * C.CULL_XP_FRAC * C.XP_WEIGHT_MULT * R.xpCurve(1 + C.CONTRACT_CL_OFFSET_HERO)) / R.xpCurve(road.L)), classId);
      assert.ok(s.player.heroLevel >= 2, `${classId} hero level ${s.player.heroLevel} at zone 2`);
      assert.equal(s.tutorial.roadPaid, true);
    }
  }));
});

describe('five runs in a row with one hero (phase 1 done-when, engine side)', () => {
  test('the level and XP survive every run and a reload (the profile as JSON); every state of a run passes debug.validate', () => legacy(() => {
    let profile = R.newProfile();
    let last = { level: 1, xp: 0 };
    for (let k = 0; k < 5; k++) {
      let s = run('hunter', 900 + k, JSON.parse(JSON.stringify(profile)));
      s = steps(s, [{ type: 'START_RUN' }]);
      assert.deepEqual([s.player.heroLevel, s.player.xp], [last.level, last.xp], `run ${k}`);
      let n = 0;
      while (s.phase !== 'ENDED' && n < 30000) {
        s = R.step(s, R.autoAction(s)).state;
        n++;
        if (n % 97 === 0) assert.deepEqual(R.debug.validate(s, { steps: false }), [], `run ${k} step ${n}`);
      }
      profile = JSON.parse(JSON.stringify(s.result.profile));
      const h = profile.heroes.hunter;
      assert.ok(h.level > last.level || (h.level === last.level && h.xp >= last.xp), `run ${k}: ${h.level}/${h.xp} after ${last.level}/${last.xp}`);
      assert.equal(h.runs, k + 1);
      last = { level: h.level, xp: h.xp };
    }
    assert.ok(last.level >= 4);
  }));
});

describe('views: heroView, heroesView, shownLevel (legacy.md 1.1-1.2)', () => {
  test('shownLevel: the switch off M; a Legacy run 1 + round((M - 1) × 24 / 59): 1 -> 1, 60 -> 25, 65 -> 27, 66 (CL_MAX) -> 27, 69 (ILVL_MAX_HERO) -> 29; every power level of a hero level shows that level', () => {
    const off = run('rogue', 1, null);
    assert.deepEqual([1, 23, 62].map((M) => R.shownLevel(off, M)), [1, 23, 62]);
    legacy(() => {
      const s = run('rogue', 1, null);
      assert.deepEqual([1, 60, 65, 66, 69].map((M) => R.shownLevel(s, M)), [1, 25, 27, 27, 29]);
      for (let H = 1; H <= 25; H++) assert.equal(R.shownLevel(s, R.powerOfLevel(H)), H);
    });
    assert.equal(R.heroView(off), null);
  });

  test('heroesView: one card per class, null without a hero; level, XP, runs, wins, points per tree and the top tree', () => legacy(() => {
    const p = R.debug.setHero(R.newProfile(), 'mage', { level: 12, xp: 30 });
    p.heroes.mage.talents = { m_b1: 3, m_b2: 2, m_a1: 1 };
    p.heroes.mage.runs = 4;
    const v = R.heroesView(p);
    assert.equal(v[0], null);
    assert.equal(v[2], null);
    assert.deepEqual(v[1], { classId: 'mage', className: 'Mage', name: '', level: 12, xp: 30, xpToNext: C.HERO_XP[11], power: 28, runs: 4, wins: 0, talents: [1, 5, 0], tree: 'Rimecraft' });
  }));
});

describe('golden: the switch off plays every run as before Legacy (profile, result and offers included)', () => {
  test('six runs (rows, the start camp, a first run, a guided run, a second run with Echoes spent) hash as recorded on 9a79dee', () => {
    // Recorded on 9a79dee (the engine before Legacy phase 1) with the same script: every action, every event, the final state
    // serialized with its profile, the result (summary, Echoes, profile) and the catalogue offers of the result's profile.
    // Heat state 2026-11-20 (engine-2026-11-20b): every hash here is of the text with the tolls by heat state masked to their total
    // (helpers.mjs tollsMasked), re-recorded on 57923eb with the engine before the change; the change hashes the same.
    const WANT = {
      'rows:mage:21': '47d8b8e186c27c1c:99', 'expPrep:rogue:21': '20b1cebf55dabdd7:217', 'expPrep:hunter:22': '1bb93204397837d9:575',
      'first:mage:23': 'b515f5f04b481baf:107', 'guided:rogue:24': 'e3255d79d02d5073:386', 'second:hunter:25': 'fdce76bcb618430b:625',
    };
    const RUNS = { rows: 2, expPrep: 2, first: 0, guided: 0, second: 1 };
    assert.equal(C.GATES.legacy, false);
    for (const [key, want] of Object.entries(WANT)) {
      const [mode, classId, seed] = key.split(':');
      const profile = { ...R.newProfile(), runs: RUNS[mode], ...(mode === 'second' ? { echoes: 140, spent: 140, unlocks: { satchel: 1, vigor: 1 } } : {}) };
      const o = { classId, petId: PET(classId), seed: Number(seed), content: CONTENT, profile };
      if (mode === 'rows') Object.assign(o, { mapMode: 'rows' });
      else if (mode === 'guided') Object.assign(o, { mapMode: 'expedition', prep: true, tutorial: true });
      else Object.assign(o, { mapMode: 'expedition', prep: true });
      let s = R.newRun(o);
      const h = createHash('sha256');
      let n = 0;
      while (s.phase !== 'ENDED' && n < 20000) { const a = R.autoAction(s); const r = R.step(s, a); s = r.state; h.update(JSON.stringify(a)); h.update(JSON.stringify(r.events)); n++; }
      h.update(tollsMasked(R.serialize(s))); // heat state 2026-11-20: tolls by state masked (helpers.mjs tollsMasked)
      h.update(tollsMasked(s.result));
      h.update(JSON.stringify(R.metaOffers(s.result.profile)));
      assert.equal(`${h.digest('hex').slice(0, 16)}:${n}`, want, key);
    }
  });

  test('a Legacy run is deterministic: the same seed and profile give the same run', () => legacy(() => {
    const play = () => {
      let s = run('rogue', 333, R.debug.setHero(R.newProfile(), 'rogue', { level: 9 }));
      const h = createHash('sha256');
      for (let n = 0; s.phase !== 'ENDED' && n < 30000; n++) { const r = R.step(s, R.autoAction(s)); s = r.state; h.update(JSON.stringify(r.events)); }
      return h.update(R.serialize(s)).digest('hex');
    };
    assert.equal(play(), play());
  }));
});
