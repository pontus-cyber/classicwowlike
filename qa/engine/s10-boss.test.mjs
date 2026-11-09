// rules.md section 10: end boss Oruvath, the Unlit Star.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, tweak, forceDraws, ev, st, cloneState, play } from './helpers.mjs';

/** A level-60 character at FIGHT_BOSS with given hours. */
function boss(classId = 'mage', { hours = 100, spells = [], petId, prep } = {}) {
  let s = R.step(started(classId, { seed: 51, petId }), { type: 'LEAVE_HUB' }).state;
  s = withSpells(atLevel(s, 60), spells);
  s = tweak(s, (x) => { x.zone.z = 6; x.hours = hours; });
  s = play(s, [{ type: 'TRAVEL_ON' }, { type: 'FIGHT_BOSS' }]).state;
  return prep ? tweak(s, prep) : s;
}
/** Keep the player alive and debuff-free between rounds so the schedule can be observed. */
const immortal = (x) => { x.player.d.maxHp = 1e9; x.player.hp = 1e9; x.fight.p.st = x.fight.p.st.filter((y) => y.id === 'BRAND'); if (x.player.pet) { x.player.d.petMaxHp = 1e9; x.player.pet.hp = 1e9; x.player.pet.alive = true; } };
const names = (s) => s.fight.enemies[0].intent.actions.map((a) => (a.id === 'collapse_litany' ? `litany${a.step}` : a.id));

describe('rules 10 end boss', () => {
  test('10.1 setup: level 62, HP BOSS_HP × (1 + asc), armor BOSS_ARMOR, no flee, no Rogue stealth', () => {
    const s = boss('rogue', { hours: 175 });
    const b = s.fight.enemies[0];
    assert.equal(s.phase, 'BOSS');
    assert.equal(b.level, C.BOSS_LEVEL);
    assert.equal(b.maxHp, Math.round(C.BOSS_HP * (1 + 0.16)));
    assert.equal(b.armor, C.BOSS_ARMOR);
    assert.ok(!R.isLegal(s, { type: 'FLEE' }));
    assert.ok(!st(s.fight.p.st, 'STEALTH'));
    assert.equal(b.name, C.BOSS_TEXT.name);
  });

  test('10.2 phase 1 schedule: Umbral Strike unless channelling, Gravity Crush every 6 rounds, Litany at 3 then every 5, Brand every 4th round', () => {
    let s = boss('mage', { prep: immortal });
    const seen = [];
    const brand = [];
    const tele = [];
    for (let r = 1; r <= 13; r++) {
      seen.push(names(s).join('+'));
      tele.push(s.fight.enemies[0].intent.telegraph.crushNextRound);
      s = tweak(R.step(s, { type: 'PASS' }).state, immortal);
      brand.push(st(s.fight.p.st, 'BRAND') ? st(s.fight.p.st, 'BRAND').stacks : 0);
    }
    assert.deepEqual(seen, [
      'umbral_strike', 'umbral_strike', 'litany1', 'litany2', 'umbral_strike', 'umbral_strike+gravity_crush',
      'umbral_strike', 'litany1', 'litany2', 'umbral_strike', 'umbral_strike', 'umbral_strike+gravity_crush', 'litany1',
    ]);
    assert.deepEqual(tele.map((x, i) => (x ? i + 1 : 0)).filter(Boolean), [5, 11], 'Crush telegraphed one round ahead');
    assert.deepEqual(brand, [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
  });

  test('10.2 Collapse Litany resolves BOSS_LITANY_DMG magic on player and pet; an interrupt in either round cancels it', () => {
    let s = boss('hunter', { prep: immortal });
    s = tweak(R.step(R.step(s, { type: 'PASS' }).state, { type: 'PASS' }).state, immortal);
    assert.deepEqual(names(s), ['litany1']);
    const a = tweak(R.step(s, { type: 'PASS' }).state, immortal);
    assert.deepEqual(names(a), ['litany2']);
    const c = cloneState(a);
    forceDraws(c, 6, (d) => d[0] > 0.9 && d[3] > 0.9 && d[1] > 0.1 && d[4] > 0.1);
    const r = R.step(c, { type: 'PASS' });
    const hits = r.events.filter((e) => e.t === 'damage' && e.spell === 'collapse_litany');
    assert.deepEqual(hits.map((e) => e.dst), ['player', 'pet']);
    const want = C.BOSS_LITANY_DMG * (1 + 0.04 * (62 - 60));
    assert.ok(hits.every((e) => e.amount >= Math.floor(want * 0.9) && e.amount <= Math.ceil(want * 1.1)));
    // Interrupt in round 1/2 and in round 2/2
    const m = boss('mage', { spells: ['spellsnap'], prep: immortal });
    let t = tweak(R.step(R.step(m, { type: 'PASS' }).state, { type: 'PASS' }).state, immortal);
    const c1 = cloneState(t);
    forceDraws(c1, 3, (d) => d[0] > 0.9);
    const r1 = R.step(c1, { type: 'CAST', spellId: 'spellsnap', target: 0 });
    assert.equal(ev(r1.events, 'interrupt').length, 1);
    assert.deepEqual(names(r1.state), ['umbral_strike'], 'the channel is gone next round');
    t = tweak(R.step(t, { type: 'PASS' }).state, immortal);
    const c2 = cloneState(t);
    forceDraws(c2, 3, (d) => d[0] > 0.9);
    const r2 = R.step(c2, { type: 'CAST', spellId: 'spellsnap', target: 0 });
    assert.equal(r2.events.filter((e) => e.spell === 'collapse_litany').length, 0, 'interrupted at 2/2: no damage');
  });

  test('10.2 stun-tagged spells interrupt the boss; Chrono Sigil pauses the channel instead of cancelling it', () => {
    let s = boss('mage', { spells: ['rime_burst', 'chrono_sigil'], prep: immortal });
    s = tweak(R.step(R.step(s, { type: 'PASS' }).state, { type: 'PASS' }).state, immortal);
    const c = cloneState(s);
    forceDraws(c, 3, (d) => d[0] > 0.9);
    const r = R.step(c, { type: 'CAST', spellId: 'rime_burst', target: null });
    assert.equal(ev(r.events, 'interrupt').length, 1);
    assert.ok(!st(r.state.fight.enemies[0].st, 'FROZEN'), 'boss is immune to FROZEN');
    const p = R.step(s, { type: 'CAST', spellId: 'chrono_sigil', target: 0 });
    assert.equal(ev(p.events, 'skip').length >= 1, true);
    assert.deepEqual(names(tweak(p.state, immortal)), ['litany1'], 'paused: still 1/2');
  });

  test('10.2 phase 2 at P2_AT: Shards on entry and every SHARD_EVERY rounds, max SHARD_MAX alive, Linked -60 %', () => {
    let s = boss('mage', { spells: ['ember_bolt'], prep: (x) => { immortal(x); x.fight.enemies[0].hp = Math.floor(x.fight.enemies[0].maxHp * 0.705); } });
    const c = cloneState(s);
    forceDraws(c, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
    const r = R.step(c, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
    assert.equal(ev(r.events, 'phaseChange')[0].phase, 2);
    const shards = r.state.fight.enemies.filter((e) => e.kind === 'shard');
    assert.equal(shards.length, C.SHARD_COUNT);
    for (const sh of shards) { assert.equal(sh.level, 60); assert.equal(sh.maxHp, C.SHARD_HP); assert.equal(sh.armor, C.ENEMY_ARMOR_PER_LEVEL * 60); }
    // Linked: boss takes LINK_DR less while a Shard lives
    let t = tweak(r.state, immortal);
    const a = cloneState(t);
    const d = forceDraws(a, 3, (x) => x[0] > 0.9 && x[1] > 0.6);
    const hitLinked = R.step(a, { type: 'CAST', spellId: 'ember_bolt', target: 0 }).events.find((e) => e.t === 'damage' && e.dst === 0).amount;
    const b = tweak(t, (x) => { for (const e of x.fight.enemies) if (e.kind === 'shard') e.alive = false; });
    forceDraws(b, 3, (x) => x.join() === d.join());
    const hitFree = R.step(b, { type: 'CAST', spellId: 'ember_bolt', target: 0 }).events.find((e) => e.t === 'damage' && e.dst === 0).amount;
    assert.ok(Math.abs(hitLinked / hitFree - (1 - C.LINK_DR)) < 0.02, `${hitLinked}/${hitFree}`);
    // More Shards every SHARD_EVERY rounds, capped at SHARD_MAX alive
    for (let i = 0; i < 2 * C.SHARD_EVERY + 1; i++) t = tweak(R.step(t, { type: 'PASS' }).state, (x) => { immortal(x); for (const e of x.fight.enemies) if (e.kind === 'shard') e.hp = e.maxHp; });
    assert.equal(t.fight.enemies.filter((e) => e.kind === 'shard' && e.alive).length, C.SHARD_MAX);
  });

  test('10.3 Shards counter: null while SHARD_MAX Shards live, back to the next scheduled wave after a Shard dies (BUG-QA-07)', () => {
    let s = boss('mage', { spells: ['ember_bolt'], prep: (x) => { immortal(x); x.fight.enemies[0].hp = Math.floor(x.fight.enemies[0].maxHp * 0.705); } });
    forceDraws(s, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
    s = R.step(s, { type: 'CAST', spellId: 'ember_bolt', target: 0 }).state; // phase 2, first wave
    const tg = (x) => x.fight.enemies[0].intent.telegraph;
    const keep = (x) => { immortal(x); for (const e of x.fight.enemies) if (e.kind === 'shard') { e.hp = e.maxHp; e.st = [{ id: 'STUN', dur: 2 }]; } };
    s = tweak(s, keep);
    assert.equal(tg(s).shardsInRounds, s.fight.boss.nextShard - s.fight.round);
    while (s.fight.enemies.filter((e) => e.kind === 'shard' && e.alive).length < C.SHARD_MAX) s = tweak(R.step(s, { type: 'PASS' }).state, keep);
    assert.equal(tg(s).shardsInRounds, null, 'SHARD_MAX alive: no wave will come');
    s = tweak(R.step(s, { type: 'PASS' }).state, keep);
    assert.equal(tg(s).shardsInRounds, null);
    const shard = s.fight.enemies.find((e) => e.kind === 'shard' && e.alive).idx;
    const c = tweak(s, (x) => { x.fight.enemies[shard].hp = 1; x.fight.enemies[shard].dodge = 0; });
    forceDraws(c, 3, (d) => d[0] > 0.9);
    const r = R.step(c, { type: 'CAST', spellId: 'ember_bolt', target: shard });
    assert.ok(r.events.some((e) => e.t === 'death' && e.u === shard));
    assert.equal(tg(r.state).shardsInRounds, r.state.fight.boss.nextShard - r.state.fight.round, 'countdown back');
    assert.ok(tg(r.state).shardsInRounds > 0);
  });

  test('10.2 phase 3 below P3_AT: Shards despawn, Eclipse grows, Starless Pulse every PULSE_EVERY rounds; two thresholds in one hit fire in order', async () => {
    const { applyDamage } = await import('../../src/engine/damage.js');
    const s = boss('hunter', { prep: (x) => { immortal(x); x.fight.enemies[0].hp = Math.floor(x.fight.enemies[0].maxHp * 0.75); } });
    const c = cloneState(s);
    const events = [];
    applyDamage(c, events, 'player', 0, Math.floor(c.fight.enemies[0].maxHp * 0.5));
    assert.deepEqual(ev(events, 'phaseChange').map((e) => e.phase), [2, 3]);
    assert.ok(ev(events, 'summon').length === C.SHARD_COUNT && ev(events, 'despawn').length === C.SHARD_COUNT, 'Shards summoned, then despawned');
    assert.equal(c.fight.enemies.filter((e) => e.kind === 'shard' && e.alive).length, 0);
    let t = tweak(c, immortal);
    const pulses = [];
    const eclipse = [];
    for (let i = 0; i < 7; i++) {
      pulses.push(names(t).includes('starless_pulse'));
      t = tweak(R.step(t, { type: 'PASS' }).state, immortal);
      eclipse.push(t.fight.boss.eclipse);
    }
    assert.deepEqual(pulses.map((x, i) => (x ? i + 1 : 0)).filter(Boolean), [1 + C.PULSE_EVERY, 1 + 2 * C.PULSE_EVERY], 'phase 3 entered in round 1: pulses every 3 rounds after');
    assert.deepEqual(eclipse, [1, 2, 3, 4, 5, 6, 7]);
    assert.ok(!names(t).includes('gravity_crush') || t.fight.boss.phase < 3);
  });

  test('10.2 enrage: from BOSS_ENRAGE_ROUND, Final Dark each round ignores WARD and IMMUNE', () => {
    const s = boss('mage', { prep: (x) => { x.fight.round = C.BOSS_ENRAGE_ROUND - 1; } });
    let t = tweak(R.step(tweak(s, immortal), { type: 'PASS' }).state, (x) => { x.player.hp = 5000; x.player.d.maxHp = 5000; x.fight.p.st.push({ id: 'WARD', dur: 9, amount: 1e6 }, { id: 'IMMUNE', dur: 9 }); });
    assert.ok(names(t).includes('final_dark'));
    const r = R.step(t, { type: 'PASS' });
    assert.equal(r.state.phase, 'SUMMARY');
    assert.equal(r.state.death.killer.ability, 'final_dark');
  });

  test('10 boss kill ends the run with victory; summary records boss phase and Echoes', () => {
    const s = boss('rogue', { spells: [], prep: (x) => { x.fight.enemies[0].hp = 1; x.fight.boss.phase = 3; x.stats.bossPhase = 3; x.fight.enemies[0].dodge = 0; } });
    const c = cloneState(s);
    forceDraws(c, 3, (d) => d[0] > 0.9);
    const r = R.step(c, { type: 'ATTACK', target: 0 });
    assert.equal(r.state.phase, 'SUMMARY');
    assert.equal(r.state.outcome, 'victory');
    const sum = R.summary(r.state);
    const lines = Object.fromEntries(sum.echoes.lines.map((l) => [l.id, l.echoes]));
    assert.equal(lines.bossKill, C.ECHO_BOSS_KILL);
    assert.equal(lines.bossReached, C.ECHO_BOSS_REACHED);
    assert.equal(lines.bossPhases, 2 * C.ECHO_BOSS_PHASE);
    assert.equal(lines.speed, C.ECHO_SPEED_BONUS, 'hours 100 <= par');
    assert.equal(lines.firstKill, C.ECHO_FIRST_KILL_CLASS);
    assert.equal(sum.bossHpPct, 0);
  });
});
