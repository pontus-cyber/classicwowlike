// QA rule tests, rules.md sections 9 (death, resurrection, run summary) and 11 (Echoes): the summary must
// carry every field rules 9 lists, a resurrection keeps the fight as it was, and the speed bonus needs a kill
// at or under the par.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, play, atLevel, withSpells, inFight, tweak, ev, st, cloneState, forceDraws } from './helpers.mjs';
import { echoes } from '../../src/engine/meta.js';

const mob = (tid = 'z1_brute', level = 20, variant = 'normal') => ({ tid, level, variant });
const lethalIntent = { id: 'strike', name: 'Strike', kind: 'hit', cast: false, heavy: false, school: 'magic', cd: 0, pct: 50, hits: 1, target: 'player', est: 1 };

/** A fight the player loses this round: 1 HP, a huge magic hit coming. */
function doomed(prep) {
  let s = withSpells(atLevel(started('hunter', { seed: 9 }), 20), []);
  s = inFight(s, [mob('z1_brute', 20), mob('z1_beast', 20)]).state;
  return tweak(s, (x) => {
    x.player.pet = null; x.player.hp = 1;
    x.fight.enemies[0].intent = { ...lethalIntent };
    x.fight.enemies[1].st.push({ id: 'STUN', dur: 3 });
    x.fight.enemies[0].st.push({ id: 'BURN', src: 'living_flame', dur: 3, tick: 3 });
    if (prep) prep(x);
  });
}
const die = (s) => { const c = cloneState(s); forceDraws(c, 3, (d) => d[0] > 0.3 && d[1] > 0.1); return R.step(c, { type: 'PASS' }); };

describe('rules 9 death and the run summary', () => {
  test('9 the run summary carries every field rules 9 lists', () => {
    let s = R.newRun({ classId: 'hunter', petId: 'duskcat', seed: 12, content: CONTENT, mapMode: 'rows' });
    s = R.step(s, { type: 'START_RUN' }).state;
    for (let n = 0; s.phase !== 'SUMMARY' && n < 20000; n++) s = R.step(s, R.autoAction(s)).state;
    assert.equal(s.phase, 'SUMMARY');
    const m = R.summary(s);
    const want = {
      classId: 'class', petId: 'pet', talents: 'talents (per tree)', seed: 'seed', outcome: 'outcome', death: 'death location', level: 'level', xp: 'XP',
      reached: 'zone/row reached', time: 'time (tolls)', ascendancy: 'Ascendancy', minutes: 'estimated minutes', nodes: 'nodes by type', fights: 'fights',
      rounds: 'rounds', kills: 'kills', quests: 'quests', stories: 'story rewards', dungeons: 'dungeons cleared', gold: 'gold earned and spent',
      potionsUsed: 'potions used', resurrectsUsed: 'resurrects used', damage: 'damage dealt/taken', topSpells: 'top 3 spells', equipped: 'equipped items',
      bossPhase: 'boss phase reached', bossHpPct: 'boss HP % left', echoes: 'Echoes',
    };
    for (const [k, what] of Object.entries(want)) assert.ok(k in m, `summary lacks ${what} (${k})`);
    assert.equal(m.petId, 'duskcat');
    assert.equal(m.talents.perTree.length, 3);
    for (const k of ['normal', 'elite', 'rare', 'boss']) assert.equal(typeof m.kills[k], 'number', `kills.${k}`);
    assert.ok(typeof m.minutes.manual === 'number' && typeof m.minutes.autoplay === 'number' && m.minutes.autoplay < m.minutes.manual);
    assert.ok('earned' in m.gold && 'spent' in m.gold);
    assert.ok('dealt' in m.damage && 'taken' in m.damage);
    assert.ok(m.topSpells.length <= 3);
    for (const e of m.equipped) for (const k of ['slot', 'name', 'ilvl', 'rarity']) assert.ok(k in e, `equipped ${k}`);
    assert.ok(Array.isArray(m.echoes.lines) && m.echoes.lines.every((l) => 'id' in l && 'echoes' in l), 'Echoes line by line');
    if (m.outcome === 'death') for (const k of ['zone', 'row', 'lane', 'nodeType', 'fightIdx', 'enemies', 'round', 'killer']) assert.ok(k in m.death, `death.${k}`);
  });

  test('9 a resurrection happens in the same fight and round; enemies keep their HP and statuses', () => {
    const s = doomed((x) => { x.player.res.boon = 1; });
    const r = die(s);
    assert.equal(ev(r.events, 'resurrect').length, 1);
    assert.ok(r.state.fight, 'the fight goes on');
    assert.equal(r.state.fight.round, s.fight.round + 1, 'the round ends normally');
    const e0 = r.state.fight.enemies[0];
    const burn = ev(r.events, 'damage').filter((e) => e.dst === 0 && e.tick).reduce((n, e) => n + e.amount, 0);
    assert.equal(e0.hp, s.fight.enemies[0].hp - burn, 'enemy HP only changed by its own DOT');
    assert.ok(st(r.state.fight.enemies[1].st, 'STUN'), 'enemy statuses kept');
    assert.equal(r.state.player.res.boon, 0);
  });

  test('9 the death location names the killer and its ability; the summary is final after END_RUN', () => {
    const r = die(doomed());
    assert.equal(r.state.phase, 'SUMMARY');
    const d = r.state.death;
    assert.equal(d.killer.ability, 'strike');
    assert.equal(d.killer.idx, 0);
    assert.deepEqual(d.enemies, ['z1_brute', 'z1_beast']);
    const end = R.step(r.state, { type: 'END_RUN' }).state;
    assert.deepEqual(end.result.summary.death, d);
  });
});

describe('rules 11 Echoes', () => {
  const facts = (o) => ({ classId: 'rogue', level: 60, zonesLeft: 6, dungeons: 0, kills: { elite: 0, rare: 0 }, quests: 0, reachedBoss: true, bossPhase: 3, outcome: 'victory', timeAtBoss: C.BOSS_TIME_PAR, oaths: [], ...o });
  test('11.1 the speed bonus needs a kill at or under BOSS_TIME_PAR; a loss earns none', () => {
    const has = (f) => echoes(facts(f), R.newProfile()).lines.some((l) => l.id === 'speed');
    assert.ok(has({}), 'kill at the par');
    assert.ok(!has({ timeAtBoss: C.BOSS_TIME_PAR + 1 }), 'kill over the par');
    assert.ok(!has({ outcome: 'death' }), 'loss at the par');
  });

  test('11.1 Echoes scale with progress: a deeper death earns more', () => {
    const a = echoes(facts({ level: 12, zonesLeft: 1, reachedBoss: false, bossPhase: 0, outcome: 'death', timeAtBoss: null }), R.newProfile()).total;
    const b = echoes(facts({ level: 35, zonesLeft: 3, reachedBoss: false, bossPhase: 0, outcome: 'death', timeAtBoss: null }), R.newProfile()).total;
    const c = echoes(facts({ outcome: 'death', bossPhase: 2 }), R.newProfile()).total;
    const d = echoes(facts({}), R.newProfile()).total;
    assert.ok(a < b && b < c && c < d, `${a} < ${b} < ${c} < ${d}`);
  });

  test('11.4 END_RUN adds the run\'s Echoes to the profile, and the next run starts with that profile', () => {
    let s = R.newRun({ classId: 'rogue', seed: 4, content: CONTENT, mapMode: 'rows' });
    s = R.step(s, { type: 'START_RUN' }).state;
    for (let n = 0; s.phase !== 'SUMMARY' && n < 20000; n++) s = R.step(s, R.autoAction(s)).state;
    const total = R.summary(s).echoes.total;
    const end = R.step(s, { type: 'END_RUN' }).state;
    assert.equal(end.result.profile.echoes, total);
    assert.equal(end.result.profile.runs, 1);
    const next = R.newRun({ classId: 'mage', seed: 5, content: CONTENT, profile: end.result.profile });
    assert.equal(next.profile.echoes, total);
  });
});
