// Dev tools (docs/specs/engine-api.md section 12; owner feedback 2026-11-11): R.debug.*. Every helper returns a new state
// that passes R.debug.validate (the engine's state checks) and leaves its input unchanged; the result plays on with the
// engine's own actions; a run a dev tool changed is a dev run (no Echoes, the profile as it was); god mode stops all
// damage to the player. The validator itself passes every state of autoplay runs and catches broken states.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { R, C, CONTENT, started, tweak, cloneState, MAX_ACTIONS_PER_RUN } from './helpers.mjs';

const D = R.debug;
const REAL = fileURLToPath(new URL('../../src/content/index.js', import.meta.url));
const realContent = existsSync(REAL) ? (await import(REAL)).CONTENT : null;
const CAMP = C.ZONE_COUNT + 1;

/** Assert the state passes the engine's validator (every legal action stepped). */
function valid(s, what) {
  const errs = D.validate(s);
  assert.deepEqual(errs, [], `${what}: ${errs.join('; ')}`);
  return s;
}
/** Run a helper on a copy and check purity: the input's serialization is unchanged. Returns the result's state. */
function run(fn, s, ...args) {
  const before = R.serialize(s);
  const r = fn(s, ...args);
  assert.equal(R.serialize(s), before, 'the input state is unchanged');
  return r.state;
}
/** Autoplay until pred(state) or the run ends; every 25th state validated without steps. */
function autoUntil(s, pred = () => false, max = MAX_ACTIONS_PER_RUN) {
  for (let i = 0; i < max && s.phase !== 'ENDED' && !pred(s); i++) {
    if (i % 25 === 0) assert.deepEqual(D.validate(s, { steps: false }), [], `autoplay step ${i} in ${s.phase}`);
    s = R.step(s, R.autoAction(s)).state;
  }
  return s;
}
const build = (o = {}) => D.build({ content: CONTENT, seed: 11, ...o }).state;
const enemyOf = (kind, zone = 1, content = CONTENT) => D.enemies(content).find((x) => x.kind === kind && x.zone === zone).id;

describe('engine-api 12 dev tools', () => {
  test('build: a run at a zone and level, gear, spells trained, talents spent by the default build, gold, potions, bars', () => {
    const s = valid(build({ classId: 'mage', zone: 4, level: 35, ilvl: 40, rarity: 'rare' }), 'build');
    assert.deepEqual([s.phase, s.zone.z, s.player.level, s.player.xp], ['ZONE_HUB', 4, 35, 0]);
    for (const slot of C.SLOT_IDS) assert.deepEqual([s.player.equipped[slot].ilvl, s.player.equipped[slot].rarity, s.player.equipped[slot].slot], [40, 'rare', slot], slot);
    const want = Object.values(C.SPELL).filter((sp) => sp.cls === 'mage' && sp.source === 'class' && sp.lvl <= 35).map((sp) => sp.id).sort();
    assert.deepEqual(Object.keys(s.player.spells).filter((id) => C.SPELL[id].source === 'class').sort(), want, 'every class spell up to the level');
    for (const [id, k] of Object.entries(s.player.spells)) if (C.SPELL[id].source !== 'talent') assert.equal(k.tl, 35, `${id} trained to the level`);
    assert.equal(R.talentPointsFree(s), 0, 'talents auto-spent');
    assert.ok(s.player.talentSpent > 0);
    assert.equal(s.player.gold, Math.round(C.DEV.GOLD_V * R.V(35)));
    const count = (id) => s.player.bag.filter((x) => x.kind === 'cons' && x.id === id).reduce((a, x) => a + x.qty, 0);
    assert.deepEqual([count('healing_draught'), count('mana_draught')], [C.DEV.POTIONS, C.DEV.POTIONS]);
    assert.deepEqual([s.player.hp, s.player.mana], [s.player.d.maxHp, s.player.d.maxMana]);
    assert.equal(s.player.bar.filter(Boolean).length, C.SPELL_BAR_SLOTS, 'the bar is full');
    assert.equal(s.time, Math.ceil(C.BOSS_TIME_PAR * 3 / C.ZONE_COUNT), 'on schedule: the line of zone 3');
    assert.deepEqual(R.summary(s).heat.trackPerZone.map((x) => x.z), [4], 'the heat record starts at the zone built');
    assert.deepEqual(s.dev.tools, ['build']);
  });

  test('build: talents kept unspent, a Hunter with its default pet, zone 1 defaults, the Camp, and bad options', () => {
    const u = valid(build({ classId: 'rogue', zone: 3, level: 24, talents: 'unspent' }), 'unspent');
    assert.equal(u.player.talentSpent, 0);
    assert.equal(R.talentPointsFree(u), Math.floor((24 - C.TALENT_FIRST_LEVEL) / C.TALENT_LEVEL_STEP) + 1);
    const h = valid(build({ classId: 'hunter' }), 'hunter');
    const firstPet = Object.values(C.PET).find((p) => !p.meta).id;
    assert.deepEqual([h.player.pet.id, h.player.level, h.zone.z, h.time], [firstPet, 1, 1, 0]);
    assert.equal(h.player.pet.hp, h.player.d.petMaxHp);
    const camp = valid(build({ classId: 'hunter', petId: 'duskcat', zone: CAMP }), 'camp');
    assert.deepEqual([camp.phase, camp.player.level, camp.player.pet.id, camp.time], ['CAMP', C.MAX_LEVEL, 'duskcat', C.BOSS_TIME_PAR]);
    for (const o of [{ zone: 0 }, { zone: CAMP + 1 }, { level: 61 }, { rarity: 'junk' }, { ilvl: C.ILVL_MAX + 1 }, { talents: 'some' }, { classId: 'paladin' }, { gold: -1 },
      { classId: 'hunter', petId: 'stormhawk' }, { mapMode: 'hex' }, { hours: 10 }, { time: 1.5 }]) {
      assert.throws(() => build(o), (e) => e.code === 'ILLEGAL_ACTION', JSON.stringify(o));
    }
    assert.throws(() => D.build({ zone: 2 }), /content is required/);
  });

  test('build: deterministic, plays on to the end of the run in both map modes; the expedition zone starts at the time given', () => {
    const a = build({ classId: 'hunter', zone: 2, level: 15 });
    assert.equal(R.serialize(build({ classId: 'hunter', zone: 2, level: 15 })), R.serialize(a), 'same options, same state');
    assert.notEqual(R.serialize(build({ classId: 'hunter', zone: 2, level: 15, seed: 12 })), R.serialize(a), 'the seed matters');
    for (const mapMode of ['rows', 'expedition']) {
      const s = valid(build({ classId: 'mage', zone: 5, mapMode, time: 70 }), mapMode);
      assert.equal(s.mapMode, mapMode);
      if (mapMode === 'expedition') { assert.equal(s.zone.start, 70); assert.equal(R.mapView(s).mode, 'expedition'); }
      const end = autoUntil(s);
      assert.equal(end.phase, 'ENDED', `${mapMode}: the run ends`);
    }
  });

  test('toCamp and nextZone: from anywhere, leaving what is open; Travel on tolls; zone 6 leads to the Camp', () => {
    const s = build({ classId: 'rogue', zone: 2, level: 12 });
    const inFight = D.encounter(s, { ids: enemyOf('normal', 2) }).state;
    const c = valid(run(D.toCamp, inFight), 'toCamp from a fight');
    assert.deepEqual([c.phase, c.fight, c.node, c.zone.camp, c.time], ['CAMP', null, null, true, s.time]);
    const n = valid(run(D.nextZone, s), 'nextZone');
    assert.deepEqual([n.phase, n.zone.z, n.time], ['ZONE_HUB', 3, s.time + C.TIME_TRAVEL]);
    const z6 = valid(run(D.nextZone, build({ zone: 6 })), 'nextZone from zone 6');
    assert.equal(z6.phase, 'CAMP');
    assert.throws(() => D.nextZone(z6), /the Camp is the last stop/);
    const e = valid(run(D.nextZone, build({ zone: 3, mapMode: 'expedition' })), 'expedition nextZone');
    assert.deepEqual([e.zone.z, e.stats.exp.roads, e.stats.exp.zones[0].exit], [4, 1, 'road']);
    assert.throws(() => D.toCamp(R.newRun({ content: CONTENT, classId: 'mage' })), /only during a run/);
  });

  test('toBoss: the end-boss fight in phase 1, 2 or 3 by the engine\'s own phase change; it plays on', () => {
    const s = build({ classId: 'hunter', zone: CAMP });
    for (const phase of [1, 2, 3]) {
      const b = valid(run(D.toBoss, s, { phase }), `phase ${phase}`);
      const f = b.fight;
      const boss = f.enemies[0];
      assert.deepEqual([b.phase, f.kind, f.round, f.boss.phase, boss.intent.telegraph.phase, b.stats.bossPhase], ['BOSS', 'boss', 1, phase, phase, phase]);
      const frac = boss.hp / boss.maxHp;
      if (phase === 1) assert.equal(frac, 1);
      if (phase === 2) { assert.ok(frac <= C.P2_AT && frac > C.P3_AT); assert.equal(f.enemies.filter((x) => x.kind === 'shard' && x.alive).length, C.SHARD_COUNT); }
      if (phase === 3) { assert.ok(frac < C.P3_AT); assert.equal(f.enemies.filter((x) => x.kind === 'shard' && x.alive).length, 0); assert.equal(f.boss.nextPulse, 1 + C.PULSE_EVERY); }
      const end = autoUntil(b);
      assert.equal(end.phase, 'ENDED');
      assert.equal(end.result.summary.reachedBoss, true);
    }
    const fromZone = valid(run(D.toBoss, build({ zone: 2 }), { phase: 2 }), 'from zone 2');
    assert.equal(fromZone.fight.boss.phase, 2);
    assert.throws(() => D.toBoss(s, { phase: 4 }), /phase must be 1, 2 or 3/);
  });

  test('encounter: any template by id at the player\'s level, as its own kind; won, fled or killed it ends where it started', () => {
    const s = build({ classId: 'mage', zone: 3, level: 25 });
    const map = R.step(s, { type: 'LEAVE_HUB' }).state;
    const cases = [['normal', 'grind'], ['elite', 'elite'], ['rare', 'elite'], ['trash', 'trash'], ['dboss', 'dboss']];
    for (const [kind, fightKind] of cases) {
      const id = enemyOf(kind, 3);
      const f = valid(run(D.encounter, map, { ids: id }), kind);
      assert.deepEqual([f.phase, f.node.type, f.node.from, f.fight.kind, f.fight.enemies[0].tid, f.fight.enemies[0].kind, f.fight.enemies[0].level, f.fight.engage],
        ['NODE', 'dev', 'MAP', fightKind, id, kind, 25, true], kind);
      assert.equal(f.fight.canFlee, kind !== 'dboss');
    }
    const pack = valid(run(D.encounter, s, { ids: [enemyOf('normal', 1), enemyOf('elite', 1)], level: 3 }), 'pack from the hub');
    assert.deepEqual([pack.fight.enemies.length, pack.fight.enemies.map((x) => x.level), pack.node.from], [2, [3, 3], 'ZONE_HUB']);
    // won (killed) -> back at the hub; the reward of a kill is paid
    let w = pack;
    while (w.fight) w = run(D.killTarget, w);
    valid(w, 'after the kills');
    assert.deepEqual([w.phase, w.node, w.stats.kills.elite, w.stats.kills.normal], ['ZONE_HUB', null, 1, 1]);
    assert.ok(w.player.xp > 0 || w.player.level > 25, 'kill XP');
    // fled -> back on the map
    let fl = run(D.encounter, map, { ids: enemyOf('normal', 3) });
    for (let i = 0; i < 40 && fl.fight; i++) fl = R.step(fl, { type: 'FLEE' }).state;
    assert.deepEqual([fl.phase, fl.node], ['MAP', null]);
    valid(fl, 'after a flight');
    // at the Camp, and the same encounter twice draws from the next dev stream
    const camp = build({ zone: CAMP });
    const c1 = valid(run(D.encounter, camp, { ids: enemyOf('elite', 6) }), 'camp');
    assert.deepEqual([c1.node.from, c1.dev.n], ['CAMP', 1]);
    const c2 = run(D.encounter, c1, { ids: enemyOf('elite', 6) });
    assert.equal(c2.dev.n, 2);
    assert.notDeepEqual(c2.fight.rng, c1.fight.rng, 'the next encounter draws from the next dev stream');
    assert.ok(['CAMP', 'SUMMARY'].includes(autoUntil(c1, (x) => !x.fight).phase), 'back at the Camp (or the run is over)');
    assert.throws(() => D.encounter(s, { ids: 'nobody' }), /unknown enemy nobody/);
    assert.throws(() => D.encounter(s, { ids: [] }), /one or more enemy ids/);
  });

  test('encounter on the expedition map: a death there is recorded at the player\'s node', () => {
    const s = build({ classId: 'rogue', zone: 2, level: 2, mapMode: 'expedition' });
    const f = valid(run(D.encounter, R.step(s, { type: 'LEAVE_HUB' }).state, { ids: enemyOf('dboss', 6), level: 60 }), 'expedition encounter');
    assert.equal(f.node.id, f.zone.pos);
    const end = autoUntil(f, (x) => x.phase === 'SUMMARY');
    assert.equal(end.phase, 'SUMMARY');
    assert.deepEqual([end.death.nodeType, end.death.node, end.death.ring], ['dev', 0, 0]);
    valid(end, 'summary');
  });

  test('killTarget: the default target, through the pipeline; the last kill ends the fight; a boss kill ends the run as a dev run', () => {
    const s = build({ classId: 'rogue', zone: 2, level: 14 });
    const f = run(D.encounter, s, { ids: [enemyOf('normal', 2), enemyOf('normal', 2)] });
    const t = R.defaultTarget(f);
    const k1 = valid(run(D.killTarget, f), 'one kill');
    assert.deepEqual([k1.fight.enemies[t].alive, k1.fight.enemies.filter((x) => x.alive).length], [false, 1]);
    assert.throws(() => D.killTarget(k1, t), /living enemy/);
    assert.throws(() => D.killTarget(s), /not in a fight/);
    const b = run(D.toBoss, build({ zone: CAMP }), { phase: 2 });
    const won = valid(run(D.killTarget, b, 0), 'the boss killed');
    assert.deepEqual([won.phase, won.outcome, won.stats.bossPhase], ['SUMMARY', 'victory', 3]);
    const sum = R.summary(won);
    assert.deepEqual([sum.dev.tools, sum.echoes.total, sum.echoes.lines], [['build', 'boss', 'kill'], 0, []]);
    assert.ok(sum.echoes.withheld > 0, 'what the run would have earned');
    const ended = R.step(won, { type: 'END_RUN' }).state;
    assert.equal(ended.result.echoes, 0);
    assert.deepEqual(ended.result.profile, won.profile, 'a dev run leaves the profile as it was');
  });

  test('refill and give: health, resources, cooldowns; gold, potions while the bag takes them, unspent talent points', () => {
    const s = build({ classId: 'hunter', zone: 2, level: 16 });
    const f = tweak(run(D.encounter, s, { ids: enemyOf('elite', 2) }), (x) => {
      Object.assign(x.player, { hp: 1 });
      Object.assign(x.player.pet, { alive: false, hp: 0 });
      Object.assign(x.fight.p, { focus: 0, cds: { keen_shot: x.fight.round + 5 }, potionReady: x.fight.round + 3 });
    });
    valid(f, 'a hurt Hunter with a dead pet');
    const r = valid(run(D.refill, f), 'refill in a fight');
    assert.deepEqual([r.player.hp, r.fight.p.focus, r.fight.p.cds, r.fight.p.potionReady, r.player.pet.alive, r.player.pet.hp],
      [r.player.d.maxHp, r.fight.p.focusMax, {}, 0, true, r.player.d.petMaxHp]);
    const g = D.give(s, { gold: 1234, potions: 3, talentPoints: 4 });
    valid(g.state, 'give');
    assert.deepEqual(g.given, { gold: 1234, potions: 3, talentPoints: 4 });
    assert.equal(g.state.player.gold, s.player.gold + 1234);
    assert.equal(R.talentPointsFree(g.state), R.talentPointsFree(s) + 4);
    const spent = R.step(g.state, { type: 'SPEND_TALENT', talentId: R.legalActions(g.state).find((a) => a.type === 'SPEND_TALENT').talentId }).state;
    assert.equal(R.talentPointsFree(spent), R.talentPointsFree(s) + 3, 'the given points spend like earned ones');
    // a full bag takes no more potions
    const full = tweak(s, (x) => {
      x.player.bag = x.player.bag.filter((it) => !(it.kind === 'cons' && it.id === 'healing_draught'));
      while (x.player.bag.length < R.bagCapacity(x)) x.player.bag.push({ uid: `i${x.nextUid++}`, kind: 'junk', name: 'Junk', level: 1, qty: 1 });
    });
    const gf = D.give(full, { potions: 2 });
    valid(gf.state, 'give into a full bag');
    assert.equal(gf.given.potions, 0);
    assert.throws(() => D.give(s, { gold: -5 }), /whole number/);
  });

  test('setGod: the player takes no damage (a lasting IMMUNE, Final Dark included); the run is a dev run marked god', () => {
    const b = run(D.toBoss, build({ classId: 'mage', zone: CAMP, level: 20 }), { phase: 3 });
    const g = valid(run(D.setGod, b, true), 'god on');
    let s = g;
    let hits = 0;
    for (let i = 0; i < 80 && s.fight; i++) {
      const hp = s.player.hp;
      const r = R.step(s, R.autoAction(s));
      for (const e of r.events.filter((x) => x.t === 'damage' && x.dst === 'player')) { hits++; assert.deepEqual([e.amount, e.hpLost, e.immune, e.god], [0, 0, true, true]); }
      if (r.state.player && r.state.fight) assert.ok(r.state.player.hp >= hp || r.events.some((x) => x.t === 'damage' && x.src === 'player' && x.dst === 'player'), 'HP never drops to an enemy');
      s = r.state;
    }
    assert.ok(hits > 10, `${hits} hits on the player`);
    const late = autoUntil(s, (x) => !x.fight || x.fight.round > C.BOSS_ENRAGE_ROUND + 1);
    assert.ok(late.fight && late.fight.round > C.BOSS_ENRAGE_ROUND && late.player.hp === late.player.d.maxHp, 'Final Dark does not pierce god mode');
    const off = valid(run(D.setGod, g, false), 'god off');
    assert.deepEqual([off.dev.god, off.dev.godUsed], [false, true]);
    assert.equal(R.summary(off).dev.god, true, 'the summary names god mode');
    const plain = build({ zone: 2 });
    assert.equal(R.serialize(run(D.setGod, plain, false)), R.serialize(plain), 'turning it off when it is off changes nothing');
  });

  test('setTime and setHeat: each heat state by the run\'s own clock; the expedition zone\'s Dimming stays; Ascendancy at the Camp', () => {
    for (const mapMode of ['rows', 'expedition']) {
      const s = build({ classId: 'rogue', zone: 3, mapMode });
      for (const state of C.HEAT_STATES) {
        const h = valid(run(D.setHeat, s, state), `${mapMode} ${state}`);
        const hv = R.heatView(h);
        assert.equal(hv.stateRun, state, `${mapMode} ${state}`);
        if (mapMode === 'expedition') assert.equal(h.time - h.zone.start, s.time - s.zone.start, 'zone time unchanged');
      }
    }
    const camp = build({ zone: CAMP });
    const late = valid(run(D.setTime, camp, C.BOSS_TIME_PAR + 3 * C.ASC_STEP_TIME), 'late at the Camp');
    const b = R.step(late, { type: 'FIGHT_BOSS' }).state;
    assert.equal(b.fight.boss.asc, Math.round(3 * C.ASC_PER_STEP * 1e6) / 1e6);
    assert.throws(() => D.setTime(camp, -1), /whole number/);
    assert.throws(() => D.setHeat(camp, 'boiling'), /state must be one of/);
  });

  test('revealMap: every expedition node seen; today\'s map shows rares, traps and Embers (Scout\'s Eye)', () => {
    const e = valid(run(D.revealMap, R.step(build({ zone: 2, mapMode: 'expedition' }), { type: 'LEAVE_HUB' }).state), 'expedition');
    assert.ok(R.mapView(e).nodes.every((n) => n.know === 'full'));
    const r = valid(run(D.revealMap, build({ zone: 2 })), 'rows');
    const nodes = R.mapView(r).rows.flat();
    for (const n of nodes) {
      if (n.type === 'elite') assert.notEqual(n.rare, null);
      if (n.type === 'treasure') assert.notEqual(n.trap, null);
      if (n.type === 'vendor') assert.notEqual(n.ember, null);
    }
    assert.throws(() => D.revealMap(build({ zone: CAMP })), /the Camp has no map/);
  });

  test('setMapMode: the current zone drawn again in the other mode, at its hub; plays on; heat record kept', () => {
    const s = build({ classId: 'hunter', zone: 3, level: 22 });
    const e = valid(run(D.setMapMode, s, 'expedition'), 'to expedition');
    assert.deepEqual([e.mapMode, e.phase, e.zone.z, e.zone.mode, e.stats.exp.zones.length, R.summary(e).heat.trackPerZone.length], ['expedition', 'ZONE_HUB', 3, 'expedition', 1, 1]);
    const back = valid(run(D.setMapMode, e, 'rows'), 'back to rows');
    assert.deepEqual([back.mapMode, back.exp, back.stats.exp, back.zone.mode, R.mapView(back).rows.length], ['rows', undefined, undefined, undefined, C.ZONE_CHOICE_ROWS]);
    assert.equal(autoUntil(e).phase, 'ENDED');
    assert.equal(R.serialize(run(D.setMapMode, s, 'rows')), R.serialize(s), 'the same mode changes nothing');
    const camp = valid(run(D.setMapMode, build({ zone: CAMP }), 'expedition'), 'at the Camp');
    assert.deepEqual([camp.phase, camp.mapMode], ['CAMP', 'expedition']);
    assert.throws(() => D.setMapMode(s, 'hex'), /mode must be one of/);
  });

  test('profile: grant Echoes, the full catalogue; setProfile in CREATE feeds START_RUN, mid-run it is kept by END_RUN', () => {
    const p0 = R.newProfile();
    const p1 = D.grantEchoes(p0, 500);
    assert.deepEqual([p0.echoes, p1.echoes, p1.earned], [0, 500, 0]);
    const full = D.fullCatalogue(p1);
    assert.ok(R.metaOffers(full).every((o) => o.rank === o.ranks && !o.available));
    assert.equal(full.echoes, 500);
    assert.throws(() => D.grantEchoes(p0, 0), /whole number/);
    const create = R.newRun({ content: CONTENT, classId: 'hunter', petId: 'ridgewolf', seed: 3 });
    const c2 = valid(run(D.setProfile, create, full), 'CREATE');
    assert.ok(R.legalActions(c2).some((a) => a.type === 'SELECT_PET' && a.petId === 'stormhawk'), 'the unlocked pet');
    const st = R.step(c2, { type: 'START_RUN' }).state;
    assert.deepEqual([st.meta.scout, st.meta.satchel, st.dev], [true, true, undefined], 'START_RUN reads the profile; not a dev run');
    // a normal run whose profile was replaced mid-run: END_RUN adds the run's Echoes to it
    let s = started('rogue', { seed: 5 });
    s = run(D.setProfile, s, D.grantEchoes(s.profile, 1000));
    assert.equal(s.dev, undefined, 'a profile change does not make a dev run');
    s = autoUntil(s);
    assert.equal(s.result.profile.echoes, 1000 + s.result.echoes);
    assert.ok(s.result.echoes > 0);
  });

  test('enemies: every template once, with its home zone and kind', () => {
    for (const content of [CONTENT, realContent].filter(Boolean)) {
      const list = D.enemies(content);
      assert.deepEqual(list.map((x) => x.id).sort(), Object.keys(content.enemies).sort());
      for (const x of list) assert.equal(x.kind, content.enemies[x.id].kind);
      content.zones.forEach((zn, i) => { for (const id of [...zn.elites, zn.dungeon.boss]) assert.equal(list.find((x) => x.id === id).zone, i + 1, id); });
    }
  });

  test('a normal run has no dev block; a dev run counts nothing in the profile even when it wins', () => {
    const s = autoUntil(started('mage', { seed: 21 }), (x) => x.phase === 'SUMMARY');
    assert.equal('dev' in R.summary(s), false);
    const won = autoUntil(run(D.setGod, run(D.toBoss, build({ classId: 'mage', zone: CAMP }), { phase: 1 }), true));
    assert.deepEqual([won.result.summary.outcome, won.result.echoes, won.result.profile.runs, won.result.profile.bossKills, won.result.profile.firstKill.mage],
      ['victory', 0, 0, 0, false]);
  });

  test('validate: passes every state of autoplay runs, catches broken states', () => {
    for (const c of C.CLASS_IDS) {
      let s = R.newRun({ classId: c, petId: c === 'hunter' ? 'ridgewolf' : null, seed: 77, content: CONTENT });
      for (let i = 0; s.phase !== 'ENDED' && i < MAX_ACTIONS_PER_RUN; i++) {
        assert.deepEqual(D.validate(s, { steps: i % 40 === 0 }), [], `${c} step ${i} ${s.phase}`);
        s = R.step(s, R.autoAction(s)).state;
      }
      assert.deepEqual(D.validate(s), []);
    }
    const s = build({ classId: 'hunter', zone: 2 });
    const broken = [
      ['hp', (x) => { x.player.hp = x.player.d.maxHp + 1; }, /hp /],
      ['derived', (x) => { x.player.level += 1; }, /derived values/],
      ['shared', (x) => { x.player.equipped.ring = x.player.equipped.neck; }, /shared at|uid is used twice/],
      ['talents', (x) => { x.player.talentSpent += 1; }, /talentSpent/],
      ['bar', (x) => { x.player.bar[0] = 'pyre_comet'; }, /bar /],
      ['fight', (x) => { x.fight = { enemies: [], over: null }; }, /fight/],
      ['phase', (x) => { x.phase = 'BOSS'; }, /phase BOSS/],
      ['version', (x) => { x.v = 1; }, /state version/],
    ];
    for (const [what, fn, re] of broken) {
      const errs = D.validate(tweak(s, fn), { steps: false });
      assert.ok(errs.some((m) => re.test(m)), `${what}: ${errs.join('; ')}`);
    }
  });

  test('real content: zone 4 level 35 Mage, boss phase 2, an elite by id (the Dev menu check, qa/browser part K)', { skip: !realContent && 'no src/content/index.js' }, () => {
    const s = valid(D.build({ content: realContent, classId: 'mage', zone: 4, level: 35, seed: 4 }).state, 'build');
    const b = valid(run(D.toBoss, s, { phase: 2 }), 'boss');
    const id = enemyOf('elite', 4, realContent);
    const f = valid(run(D.encounter, b, { ids: id }), 'elite');
    assert.deepEqual([f.phase, f.node.from, f.fight.enemies[0].tid, f.fight.enemies[0].level], ['NODE', 'CAMP', id, 35]);
    assert.equal(autoUntil(f).phase, 'ENDED');
  });
});

test('dev tools never touch the fixture states of other tests (cloneState sanity)', () => {
  const s = started('rogue');
  const c = cloneState(s);
  D.build({ content: CONTENT, zone: 2 });
  assert.equal(R.serialize(s), R.serialize(c));
});
