// End boss: Oruvath, the Unlit Star (rules 10). Stream: boss.
import {
  BOSS_LEVEL, BOSS_HP, BOSS_ARMOR, BOSS_MELEE, BOSS_CRUSH, BOSS_CRUSH_EVERY, BOSS_LITANY_DMG, LITANY_FIRST,
  LITANY_EVERY, BRAND_EVERY, P2_AT, P3_AT, SHARD_HP, SHARD_DMG, SHARD_COUNT, SHARD_EVERY, SHARD_MAX, PULSE_DMG,
  PULSE_EVERY, BOSS_ENRAGE_ROUND, FINAL_DARK_DMG, ENEMY_DODGE, ENEMY_ARMOR_PER_LEVEL, BOSS_TEXT, PET,
  ENGINE_ASSUMPTION as EA,
} from '../constants.js';
import { nextFloat } from '../rng.js';
import { rnd } from './util.js';
import {
  damage, snapshot, mitigation, addStatus, findSt, hasSt, petAlive, unitAlive,
} from './damage.js';


export const SHARD_ACTION = { id: 'shard_hit', name: `${BOSS_TEXT.shard} Strike`, kind: 'hit', pct: 1.0, school: 'phys', w: 1 };

export function makeBoss(asc) {
  const hp = rnd(BOSS_HP * (1 + asc));
  return {
    idx: 0, tid: 'boss', name: BOSS_TEXT.name, kind: 'boss', arch: null, level: BOSS_LEVEL, hp, maxHp: hp,
    dmg: BOSS_MELEE, armor: BOSS_ARMOR, dodge: ENEMY_DODGE, abilities: [], cds: {}, st: [], intent: null,
    alive: true, elite: false, boss: true, ccImmune: true, enraged: 0, summoned: false, shield: 0, asc,
  };
}

function makeShard(idx, asc) {
  const hp = rnd(SHARD_HP * (1 + asc));
  return {
    idx, tid: 'shard', name: BOSS_TEXT.shard, kind: 'shard', arch: null, level: EA.SHARD_LEVEL, hp, maxHp: hp,
    dmg: SHARD_DMG, armor: ENEMY_ARMOR_PER_LEVEL * EA.SHARD_LEVEL, dodge: ENEMY_DODGE, abilities: [], cds: {},
    st: [], intent: null, alive: true, elite: false, boss: false, ccImmune: false, enraged: 0, summoned: false,
    shield: 0, asc,
  };
}

const isLitanyRound = (r) => r >= LITANY_FIRST && (r - LITANY_FIRST) % LITANY_EVERY === 0;

function summonShards(s, ev) {
  const f = s.fight;
  const alive = f.enemies.filter((e) => e.alive && e.kind === 'shard').length;
  const n = Math.min(SHARD_COUNT, SHARD_MAX - alive);
  for (let i = 0; i < n; i++) {
    const sh = makeShard(f.enemies.length, f.boss.asc);
    f.enemies.push(sh);
    ev.push({ t: 'summon', u: sh.idx, name: sh.name, hp: sh.hp, by: 0 });
  }
  if (n > 0) ev.push({ t: 'linked', on: true });
}

/** Phase changes at once when HP crosses a threshold; both in order if one hit crosses two (rules 10.2). */
export function onBossDamaged(s, ev) {
  const f = s.fight;
  const b = f.enemies[0];
  const fr = b.hp / b.maxHp;
  if (f.boss.phase === 1 && fr <= P2_AT) {
    f.boss.phase = 2;
    s.stats.bossPhase = Math.max(s.stats.bossPhase, 2);
    ev.push({ t: 'phaseChange', phase: 2 });
    f.boss.nextShard = f.round + SHARD_EVERY;
    if (b.hp > 0) summonShards(s, ev);
  }
  if (f.boss.phase === 2 && fr < P3_AT) {
    f.boss.phase = 3;
    s.stats.bossPhase = Math.max(s.stats.bossPhase, 3);
    ev.push({ t: 'phaseChange', phase: 3 });
    for (const e of f.enemies) {
      if (e.kind === 'shard' && e.alive) {
        e.alive = false;
        e.intent = null;
        e.despawned = true;
        ev.push({ t: 'despawn', u: e.idx });
      }
    }
    ev.push({ t: 'linked', on: false });
    f.boss.nextPulse = f.round + PULSE_EVERY;
    f.boss.eclipse = 0;
  }
}

/** Start of round: Shards on schedule in phase 2 (before intents). */
export function bossStartRound(s, ev) {
  const f = s.fight;
  if (f.boss.phase === 2 && f.round === f.boss.nextShard) {
    summonShards(s, ev);
    f.boss.nextShard += SHARD_EVERY;
  }
}

function est(s, base, school, tgt) {
  let x = snapshot(s, 0, tgt, base, {});
  if (school === 'phys') x *= 1 - mitigation(tgt === 'pet' ? s.player.d.petArmor : s.player.d.armor, BOSS_LEVEL);
  return rnd(x);
}

/** Boss intent for this round: the list of scheduled actions plus telegraphs (rules 10.2, 10.3). */
export function bossIntent(s, e) {
  const f = s.fight;
  const b = f.boss;
  const r = f.round;
  // One target draw when a live pet exists and no TAUNT/feign is active (rules 7.6).
  let tgt = 'player';
  const taunt = petAlive(s) && (hasSt(f.pet.st, 'TAUNT') || hasSt(f.p.st, 'FEIGN'));
  if (petAlive(s) && !taunt) {
    if (nextFloat(f.rng) < PET[s.player.pet.id].aggro) tgt = 'pet';
  } else if (taunt) tgt = 'pet';
  const actions = [];
  let step = null;
  if (b.resume) step = b.resume;
  else if (isLitanyRound(r)) step = 1;
  if (step === null) actions.push({ id: 'umbral_strike', name: BOSS_TEXT.strike, kind: 'hit', school: 'phys', base: BOSS_MELEE, target: tgt, est: est(s, BOSS_MELEE, 'phys', tgt) });
  if (b.phase <= 2 && r % BOSS_CRUSH_EVERY === 0) actions.push({ id: 'gravity_crush', name: BOSS_TEXT.crush, kind: 'hit', school: 'phys', base: BOSS_CRUSH, heavy: true, target: tgt, est: est(s, BOSS_CRUSH, 'phys', tgt) });
  if (step !== null) actions.push({ id: 'collapse_litany', name: `${BOSS_TEXT.litany} ${step}/2${step === 2 ? ' - resolves' : ''}`, kind: 'litany', step, cast: true, school: 'magic', base: BOSS_LITANY_DMG, target: 'all', est: step === 2 ? est(s, BOSS_LITANY_DMG, 'magic', 'player') : 0 });
  const pulseNow = b.phase === 3 && r === b.nextPulse;
  if (pulseNow) {
    actions.push({ id: 'starless_pulse', name: BOSS_TEXT.pulse, kind: 'pulse', school: 'magic', base: PULSE_DMG, target: 'all', est: est(s, PULSE_DMG, 'magic', 'player') });
    b.nextPulse += PULSE_EVERY;
  }
  if (r >= BOSS_ENRAGE_ROUND) actions.push({ id: 'final_dark', name: BOSS_TEXT.finalDark, kind: 'final', school: 'magic', base: FINAL_DARK_DMG, target: 'player', est: FINAL_DARK_DMG });
  const brandIn = (BRAND_EVERY - (r % BRAND_EVERY)) % BRAND_EVERY;
  // A Shards wave comes at the start of round nextShard only if fewer than SHARD_MAX are alive (summonShards);
  // with SHARD_MAX alive there is no countdown (BUG-QA-07). Killing a Shard brings the countdown back.
  const shardsAlive = f.enemies.filter((x) => x.alive && x.kind === 'shard').length;
  return {
    id: 'boss', name: BOSS_TEXT.name, kind: 'boss', actions,
    cast: actions.some((a) => a.cast), heavy: actions.some((a) => a.heavy),
    est: actions.reduce((n, a) => n + a.est, 0), target: tgt,
    telegraph: {
      crushNextRound: b.phase <= 2 && (r + 1) % BOSS_CRUSH_EVERY === 0,
      brandInRounds: brandIn,
      litanyInRounds: nextLitanyIn(r),
      shardsInRounds: b.phase === 2 && shardsAlive < SHARD_MAX ? b.nextShard - r : null,
      // 0 on the Pulse round itself ("this round", like Litany and Brand), else rounds to the next Pulse.
      pulseInRounds: b.phase === 3 ? (pulseNow ? 0 : b.nextPulse - r) : null,
      enrageInRounds: Math.max(0, BOSS_ENRAGE_ROUND - r),
      phase: b.phase,
    },
  };
}

function nextLitanyIn(r) {
  if (r < LITANY_FIRST) return LITANY_FIRST - r;
  const m = (r - LITANY_FIRST) % LITANY_EVERY;
  return m === 0 ? 0 : LITANY_EVERY - m;
}

/** Interrupt of the boss: cancels this round's Litany channel (rules 7.7, 10.3). Returns true if it hit a cast. */
export function interruptBoss(s, ev, by) {
  const f = s.fight;
  const e = f.enemies[0];
  const it = e.intent;
  if (!it) return false;
  const i = it.actions.findIndex((a) => a.cast);
  if (i < 0) return false;
  it.actions.splice(i, 1);
  it.cast = false;
  f.boss.resume = null;
  ev.push({ t: 'interrupt', u: 0, by });
  return true;
}

function attack(s, ev, e, a, tgt) {
  const f = s.fight;
  const target = tgt === 'pet' && !petAlive(s) ? 'player' : tgt;
  if (target === 'player' && mirrorImage(s, ev)) return;
  damage(s, ev, e.idx, target, { base: a.base, school: a.school, spell: a.id });
  return f;
}

/** Mirrorshade (meta Mage): each enemy attack on the player may hit an image instead (one draw). */
export function mirrorImage(s, ev) {
  const f = s.fight;
  const m = findSt(f.p.st, 'MIRROR');
  if (!m) return false;
  if (nextFloat(f.rng) < m.value) {
    ev.push({ t: 'image', dst: 'player' });
    return true;
  }
  return false;
}

/** Perform the boss's actions for this round. */
export function bossAct(s, ev, e) {
  const f = s.fight;
  const it = e.intent;
  if (!it || !e.alive) return;
  if (it.skipped) {
    const ch = it.actions.find((a) => a.kind === 'litany');
    f.boss.resume = ch ? ch.step : f.boss.resume;
    ev.push({ t: 'skip', u: 0 });
    return;
  }
  const tgtNow = retargetBoss(s, it.target);
  for (const a of it.actions) {
    if (f.over || !e.alive) return;
    if (a.kind === 'hit') attack(s, ev, e, a, tgtNow);
    else if (a.kind === 'litany') {
      if (a.step === 1) {
        f.boss.resume = 2;
        ev.push({ t: 'channel', u: 0, name: BOSS_TEXT.litany, step: 1 });
      } else {
        f.boss.resume = null;
        ev.push({ t: 'channel', u: 0, name: BOSS_TEXT.litany, step: 2 });
        if (!mirrorImage(s, ev)) damage(s, ev, 0, 'player', { base: a.base, school: 'magic', spell: a.id });
        if (!f.over && petAlive(s)) damage(s, ev, 0, 'pet', { base: a.base, school: 'magic', spell: a.id });
      }
    } else if (a.kind === 'pulse') {
      if (!mirrorImage(s, ev)) damage(s, ev, 0, 'player', { base: a.base, school: 'magic', spell: a.id });
      if (!f.over && petAlive(s)) damage(s, ev, 0, 'pet', { base: a.base, school: 'magic', spell: a.id });
    } else if (a.kind === 'final') {
      damage(s, ev, 0, 'player', { base: a.base, school: 'magic', spell: a.id, noMiss: true, ignoreWard: true, ignoreImmune: true });
    }
  }
}

function retargetBoss(s, tgt) {
  const f = s.fight;
  if (petAlive(s) && (hasSt(f.pet.st, 'TAUNT') || hasSt(f.p.st, 'FEIGN'))) return 'pet';
  if (tgt === 'pet' && !unitAlive(s, 'pet')) return 'player';
  return tgt;
}

/** End of round: Brand stack every BRAND_EVERY-th round; Eclipse grows in phase 3 (rules 10.2). */
export function bossEndOfRound(s, ev) {
  const f = s.fight;
  if (!f.enemies[0].alive) return;
  if (f.round % BRAND_EVERY === 0) addStatus(s, ev, 'player', { id: 'BRAND', dur: null });
  if (f.boss.phase === 3) f.boss.eclipse += 1;
}
