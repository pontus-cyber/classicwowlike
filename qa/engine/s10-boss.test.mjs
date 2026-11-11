// rules.md section 10: end boss Oruvath, the Unlit Star.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, tweak, forceDraws, ev, st, cloneState, play, inFight } from './helpers.mjs';
import { snapshot, levelMod, mitigation } from '../../src/engine/damage.js';

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
    const s = boss('rogue', { hours: C.BOSS_TIME_PAR + 43 }); // + HOURS_TRAVEL = par + 45 h: Ascendancy 0.08 (M2b v6: 4 steps of 0.02)
    const b = s.fight.enemies[0];
    assert.equal(s.phase, 'BOSS');
    assert.equal(b.level, C.BOSS_LEVEL);
    assert.equal(b.maxHp, Math.round(C.BOSS_HP * (1 + 0.08)));
    assert.equal(b.armor, C.BOSS_ARMOR);
    assert.ok(!R.isLegal(s, { type: 'FLEE' }));
    assert.ok(!st(s.fight.p.st, 'STEALTH'));
    assert.equal(b.name, C.BOSS_TEXT.name);
  });

  test('7.6 zone danger (M2 v3): Camp waves (CAMP_GRIND_LEVEL) are scaled; the end boss and Dimming Shards keep their own constants', () => {
    let c = R.step(started('mage', { seed: 51 }), { type: 'LEAVE_HUB' }).state;
    c = tweak(atLevel(c, 60), (x) => { x.zone.z = 6; });
    c = play(c, [{ type: 'TRAVEL_ON' }, { type: 'CAMP_GRIND' }]).state;
    assert.equal(c.fight.kind, 'camp');
    const mult = 1 + (C.ZONE_DANGER_STEP * (C.CAMP_GRIND_LEVEL - C.ZONE_DANGER_FROM)) / 10;
    for (const e of c.fight.enemies) {
      assert.equal(e.level, C.CAMP_GRIND_LEVEL);
      const old = (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * C.CAMP_GRIND_LEVEL) * C.ARCHETYPE[e.arch].dmg * C.ENGAGE_DMG_COMP;
      assert.ok(Math.abs(e.dmg - old * mult) < 1e-9, `camp ${e.tid}: ${e.dmg} vs ${old} × ${mult}`);
    }
    // End boss (level 62) and Shards (level 60): no zone danger.
    const s = boss('mage', { spells: ['ember_bolt'], prep: (x) => { immortal(x); x.fight.enemies[0].hp = Math.floor(x.fight.enemies[0].maxHp * 0.705); } });
    assert.equal(s.fight.enemies[0].dmg, C.BOSS_MELEE);
    const strike = s.fight.enemies[0].intent.actions.find((a) => a.id === 'umbral_strike');
    assert.equal(strike.base, C.BOSS_MELEE);
    const t = cloneState(s);
    forceDraws(t, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
    const r = R.step(t, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
    assert.equal(ev(r.events, 'phaseChange')[0].phase, 2);
    const shards = r.state.fight.enemies.filter((e) => e.kind === 'shard');
    assert.equal(shards.length, C.SHARD_COUNT);
    for (const sh of shards) assert.equal(sh.dmg, C.SHARD_DMG);
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
    const want = C.BOSS_LITANY_DMG * C.BOSS_DMG_MULT * (1 + 0.04 * (62 - 60)); // M2b v6: × BOSS_DMG_MULT
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

  test('10.2 phase 2 at P2_AT: Shards on entry and every SHARD_EVERY rounds, max SHARD_MAX alive; Linked -LINK_DR_PER_SHARD per living Shard, at most -LINK_DR (M2 v2)', () => {
    let s = boss('mage', { spells: ['ember_bolt'], prep: (x) => { immortal(x); x.fight.enemies[0].hp = Math.floor(x.fight.enemies[0].maxHp * 0.705); } });
    const c = cloneState(s);
    forceDraws(c, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
    const r = R.step(c, { type: 'CAST', spellId: 'ember_bolt', target: 0 });
    assert.equal(ev(r.events, 'phaseChange')[0].phase, 2);
    assert.deepEqual(ev(r.events, 'linked').map((e) => [e.on, e.n]), [[true, C.SHARD_COUNT]], 'linked carries the number of living Shards');
    const shards = r.state.fight.enemies.filter((e) => e.kind === 'shard');
    assert.equal(shards.length, C.SHARD_COUNT);
    for (const sh of shards) { assert.equal(sh.level, 60); assert.equal(sh.maxHp, C.SHARD_HP); assert.equal(sh.armor, C.ENEMY_ARMOR_PER_LEVEL * 60); }
    // Linked: the boss takes LINK_DR_PER_SHARD less per living Shard, at most LINK_DR (1 Shard -15 %, 2 -30 %, 4 -60 %).
    let t = tweak(r.state, immortal);
    const d = forceDraws(cloneState(t), 3, (x) => x[0] > 0.9 && x[1] > 0.6);
    const hitWith = (n) => {
      const b = tweak(t, (x) => {
        const sh = x.fight.enemies.filter((e) => e.kind === 'shard');
        while (sh.length < n) { const c2 = { ...sh[0], idx: x.fight.enemies.length, st: [] }; x.fight.enemies.push(c2); sh.push(c2); }
        sh.forEach((e, i) => { e.alive = i < n; });
      });
      forceDraws(b, 3, (x) => x.join() === d.join());
      return R.step(b, { type: 'CAST', spellId: 'ember_bolt', target: 0 }).events.find((e) => e.t === 'damage' && e.dst === 0).amount;
    };
    const free = hitWith(0);
    for (const n of [1, 2, 3, 4, 5]) {
      const want = 1 - Math.min(C.LINK_DR, C.LINK_DR_PER_SHARD * n);
      assert.ok(Math.abs(hitWith(n) / free - want) < 0.01, `${n} Shards: ${hitWith(n)}/${free} vs ${want}`);
    }
    assert.ok(Math.abs(hitWith(4) / free - (1 - C.LINK_DR)) < 0.01 && hitWith(5) === hitWith(4), 'capped at LINK_DR');
    // More Shards every SHARD_EVERY rounds, capped at SHARD_MAX alive
    for (let i = 0; i < 2 * C.SHARD_EVERY + 1; i++) t = tweak(R.step(t, { type: 'PASS' }).state, (x) => { immortal(x); for (const e of x.fight.enemies) if (e.kind === 'shard') e.hp = e.maxHp; });
    assert.equal(t.fight.enemies.filter((e) => e.kind === 'shard' && e.alive).length, C.SHARD_MAX);
    // The last Shard dying, and phase 3, send linked off with n 0.
    const k = tweak(t, (x) => { for (const e of x.fight.enemies) if (e.kind === 'shard') { e.hp = 1; e.dodge = 0; } });
    let ke = [];
    for (const e of k.fight.enemies.filter((x) => x.kind === 'shard' && x.alive)) {
      const c3 = tweak(ke.length ? ke.at(-1).state : k, immortal);
      forceDraws(c3, 3, (x) => x[0] > 0.9);
      ke.push(R.step(c3, { type: 'CAST', spellId: 'ember_bolt', target: e.idx }));
    }
    const offs = ke.flatMap((x) => ev(x.events, 'linked'));
    assert.deepEqual(offs.map((e) => [e.on, e.n]), [[false, 0]], 'linked off once, when the last Shard dies');
  });

  test('10.2 Shards take +SHARD_AOE_TAKEN from direct hits of aoe-tagged player spells; not from other spells, basic attacks, DOT ticks or the pet (M2 v2)', () => {
    /** Phase 2 with SHARD_COUNT Shards; returns the state and the index of the first Shard. */
    const phase2 = (cls, spells) => {
      let s = boss(cls, { spells: [...spells, 'ember_bolt'].filter((x) => C.SPELL[x].cls === cls), prep: (x) => { immortal(x); x.fight.enemies[0].hp = Math.floor(x.fight.enemies[0].maxHp * 0.705); } });
      forceDraws(s, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
      s = R.step(s, cls === 'mage' ? { type: 'CAST', spellId: 'ember_bolt', target: 0 } : { type: 'ATTACK', target: 0 }).state;
      s = tweak(s, (x) => { immortal(x); for (const e of x.fight.enemies) { e.st = []; e.dodge = 0; } x.fight.p.energy = x.fight.p.focus = 100; x.player.mana = x.player.d.maxMana; });
      return { s, sh: s.fight.enemies.findIndex((e) => e.kind === 'shard') };
    };
    /** Damage to the Shard from `action` (same draws), as a Shard and as the same unit with kind 'normal'. */
    const pair = (s, sh, action, pick = (e) => e.t === 'damage' && e.dst === sh && !e.tick, n = 9, prep = null) => {
      const draws = forceDraws(cloneState(s), n, (d) => d.every((x, i) => (i % 3 === 0 ? x > 0.9 : i % 3 === 1 ? x > 0.6 : true)));
      const run = (kind) => {
        // As 'normal' the unit needs an archetype for the next round's intent roll (after the hit we read).
        const c = tweak(s, (x) => { x.fight.enemies[sh].kind = kind; if (kind !== 'shard') x.fight.enemies[sh].arch = 'brute'; if (prep) prep(x); });
        forceDraws(c, n, (d) => d.join() === draws.join());
        return R.step(c, action).events.find(pick).amount;
      };
      return [run('shard'), run('normal')];
    };
    const ratio = ([a, b]) => a / b;
    const m = phase2('mage', ['cinder_storm', 'rime_burst', 'living_flame']);
    assert.ok(Math.abs(ratio(pair(m.s, m.sh, { type: 'CAST', spellId: 'cinder_storm', target: null })) - (1 + C.SHARD_AOE_TAKEN)) < 0.02, 'Cinder Storm (aoe)');
    assert.ok(Math.abs(ratio(pair(m.s, m.sh, { type: 'CAST', spellId: 'rime_burst', target: null })) - (1 + C.SHARD_AOE_TAKEN)) < 0.05, 'Rime Burst (aoe)');
    assert.deepEqual(new Set(pair(m.s, m.sh, { type: 'CAST', spellId: 'ember_bolt', target: m.sh })).size, 1, 'Ember Bolt (not aoe): no bonus');
    assert.deepEqual(new Set(pair(m.s, m.sh, { type: 'ATTACK', target: m.sh })).size, 1, 'basic attack: no bonus');
    const burn = (kind) => {
      const c = tweak(m.s, (x) => { x.fight.enemies[m.sh].kind = kind; if (kind !== 'shard') x.fight.enemies[m.sh].arch = 'brute'; });
      forceDraws(c, 3, (d) => d[0] > 0.9);
      return R.step(c, { type: 'CAST', spellId: 'living_flame', target: m.sh }).state.fight.enemies[m.sh].st.find((x) => x.id === 'BURN').tick;
    };
    assert.equal(burn('shard'), burn('normal'), 'DOT snapshot: no bonus');
    const h = phase2('hunter', ['volley_rain']);
    assert.ok(Math.abs(ratio(pair(h.s, h.sh, { type: 'CAST', spellId: 'volley_rain', target: null })) - (1 + C.SHARD_AOE_TAKEN)) < 0.05, 'Volley Rain (aoe, physical)');
    const petHit = pair(h.s, h.sh, { type: 'PASS' }, (e) => e.t === 'damage' && e.src === 'pet' && e.dst === h.sh, 3, (x) => { x.fight.p.target = h.sh; });
    assert.equal(new Set(petHit).size, 1, 'the pet: no bonus');
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
    assert.deepEqual(ev(events, 'linked').map((e) => [e.on, e.n]), [[true, C.SHARD_COUNT], [false, 0]]);
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

// ---------------- M2b v6 (D64): end boss HP × 0.94 and BOSS_DMG_MULT ----------------
describe('rules 10.1 end boss HP and BOSS_DMG_MULT (M2b v6, D64)', () => {
  const at = (asc) => (asc ? C.BOSS_TIME_PAR + 50 - C.HOURS_TRAVEL : 100); // 50 h past the par: 5 steps of ASC_PER_STEP
  test('BOSS_HP 13066 and BOSS_DMG_MULT 1.17; boss HP BOSS_HP × (1 + asc); Shard HP SHARD_HP × (1 + asc), without the damage factor', () => {
    assert.equal(C.BOSS_HP, 13066);
    assert.equal(C.BOSS_DMG_MULT, 1.17);
    for (const asc of [0, 5 * C.ASC_PER_STEP]) {
      const s = boss('mage', { hours: at(asc), spells: ['ember_bolt'], prep: (x) => { immortal(x); x.fight.enemies[0].hp = Math.floor(x.fight.enemies[0].maxHp * 0.705); } });
      assert.equal(s.fight.boss.asc, asc);
      assert.equal(s.fight.enemies[0].maxHp, Math.round(13066 * (1 + asc)));
      const t = cloneState(s);
      forceDraws(t, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
      const shards = R.step(t, { type: 'CAST', spellId: 'ember_bolt', target: 0 }).state.fight.enemies.filter((e) => e.kind === 'shard');
      assert.ok(shards.length > 0 && shards.every((e) => e.maxHp === Math.round(C.SHARD_HP * (1 + asc))), 'Shard HP');
    }
  });

  test('every damage of the end-boss fight\'s enemies × BOSS_DMG_MULT × (1 + asc), also at Ascendancy 0: Oruvath\'s hit, a Shard\'s snapshot, the intent estimate', () => {
    for (const asc of [0, 5 * C.ASC_PER_STEP]) {
      const s = boss('rogue', { hours: at(asc), prep: immortal });
      const lm = levelMod(C.BOSS_LEVEL, 60);
      const want = 1000 * lm * 1.17 * (1 + asc);
      assert.ok(Math.abs(snapshot(s, 0, 'player', 1000, {}) - want) < 1e-6, `snapshot at asc ${asc}`);
      // Umbral Strike lands: hit, no crit, variance factor 1 (r3 0.5); phys, so the player's armor mitigates it
      const c = cloneState(s);
      forceDraws(c, 3, (d) => d[0] > 0.95 && d[1] > 0.95 && Math.abs(d[2] - 0.5) < 0.0005);
      const hit = R.step(c, { type: 'PASS' }).events.find((e) => e.t === 'damage' && e.spell === 'umbral_strike');
      const mit = 1 - mitigation(c.player.d.armor, C.BOSS_LEVEL);
      const exp = C.BOSS_MELEE * lm * 1.17 * (1 + asc) * mit;
      assert.ok(Math.abs(hit.amount - exp) <= 1, `Umbral Strike ${hit.amount}, want ${exp.toFixed(1)} (without BOSS_DMG_MULT ${(exp / 1.17).toFixed(1)})`);
      // the intent estimate uses the same snapshot (rules 7.11)
      const strike = s.fight.enemies[0].intent.actions.find((a) => a.id === 'umbral_strike');
      assert.ok(Math.abs(strike.est - Math.round(exp)) <= 1, `estimate ${strike.est}, want ${exp.toFixed(1)}`);
    }
    // a Shard (level EA.SHARD_LEVEL) in phase 2
    const m = boss('mage', { spells: ['ember_bolt'], prep: (x) => { immortal(x); x.fight.enemies[0].hp = Math.floor(x.fight.enemies[0].maxHp * 0.705); } });
    const t = cloneState(m);
    forceDraws(t, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
    const p2 = R.step(t, { type: 'CAST', spellId: 'ember_bolt', target: 0 }).state;
    const sh = p2.fight.enemies.find((e) => e.kind === 'shard');
    assert.ok(Math.abs(snapshot(p2, sh.idx, 'player', 1000, {}) - 1000 * levelMod(sh.level, 60) * 1.17) < 1e-6, 'Shard snapshot × BOSS_DMG_MULT at asc 0');
  });

  test('the Brand tick is BRAND_DMG × stacks × BOSS_DMG_MULT × (1 + asc) × levelMod (rules 10.2), and the DoT preview shows it', () => {
    for (const asc of [0, 5 * C.ASC_PER_STEP]) {
      const s = boss('mage', { hours: at(asc), prep: (x) => { immortal(x); x.fight.p.st.push({ id: 'BRAND', stacks: 3, dur: null }); } });
      const want = Math.round(C.BRAND_DMG * 3 * 1.17 * (1 + asc) * levelMod(C.BOSS_LEVEL, 60));
      assert.equal(R.pendingTicks(s, 'player').amount, want, `preview at asc ${asc}`);
      const tick = R.step(s, { type: 'PASS' }).events.find((e) => e.t === 'damage' && e.spell === 'brand');
      assert.equal(tick.amount, want, `Brand tick at asc ${asc}`);
    }
  });

  test('not an end-boss fight: a dungeon boss and a Camp wave keep their damage (no BOSS_DMG_MULT)', () => {
    const d = inFight(atLevel(started('rogue', { seed: 3 }), 20), [{ tid: 'z1_brute', level: 20, variant: 'dboss' }], { kind: 'dboss' }).state;
    assert.ok(Math.abs(snapshot(d, 0, 'player', 1000, {}) - 1000) < 1e-9, 'dungeon boss');
    let c = R.step(started('mage', { seed: 51 }), { type: 'LEAVE_HUB' }).state;
    c = tweak(atLevel(c, 60), (x) => { x.zone.z = 6; });
    c = play(c, [{ type: 'TRAVEL_ON' }, { type: 'CAMP_GRIND' }]).state;
    assert.equal(c.fight.kind, 'camp');
    const e = c.fight.enemies[0];
    assert.ok(Math.abs(snapshot(c, 0, 'player', 1000, {}) - 1000 * levelMod(e.level, 60)) < 1e-6, 'Camp wave');
  });
});
