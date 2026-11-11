// Fight lifecycle and enemy actions (rules 7.1, 7.4, 7.6, 7.10, 7.12, 7.13). The intent track is in track.js, player
// actions in spells.js and engage.js, the end boss in boss.js. Combat v2.1 (rules 7.12): a played wind-up lands
// (EMPOWERED) or, a heavy one that cost the player 0 HP, is answered (STAGGERED).
// DoT preview (owner feedback 2026-11-11 08:11; engine-api.md 6.1): pendingTicks plays the end-of-round tick phase
// (tickPhase) on a copy of the state, without draws, so the UI can mark the HP that the ticks will take.
import {
  ARCHETYPE, VARIANT, ENEMY_HP_BASE, ENEMY_HP_PER_LEVEL, ENEMY_DMG_BASE, ENEMY_DMG_PER_LEVEL,
  ENEMY_ARMOR_PER_LEVEL, ENEMY_DODGE, PET, ENERGY_MAX, ENERGY_REGEN, FOCUS_MAX, FOCUS_REGEN,
  MANA_REGEN_ROUND_PCT, PET_REVIVE_PCT, TALENT, UNIQUE_WARD_PCT, BRAND_DMG, BOSS_LEVEL, MIN_HIT_DAMAGE,
  ZONE_DANGER_FROM, ZONE_DANGER_STEP, DUNGEON_DANGER_FRAC, ENGAGE_DMG_COMP, OFFBAL_DURATION,
} from '../constants.js';
import { nextFloat, nextInt } from '../rng.js';
import { rnd, deepClone, cloneState } from './util.js';
import { tr, hasEffect } from './stats.js';
import {
  damage, snapshot, addStatus, findSt, hasSt, petAlive, healUnit, applyDamage, levelMod, gainStealth, gainOffBalance,
  answerWindup, landWindup, bossDmgFactor,
} from './damage.js';
import { bossIntent, bossAct, bossStartRound, bossEndOfRound, mirrorImage, bossTrackView } from './boss.js';
import { playerAction, petAction } from './spells.js';
import {
  isEngageRound, updateTracks, fillTrack, nowIntent, refreshTrack, controlOf, lowestHpAlly, wardOf, assignWard,
  isSingle,
} from './track.js';

// ---------------- Enemies ----------------
/**
 * Zone danger (rules 7.6): damage multiplier of an enemy made from an enemy template, by its level M and variant.
 * zd(M) = 1 + ZONE_DANGER_STEP × max(0, M - ZONE_DANGER_FROM) / 10 (M2 v3: level 30 ×1.25, 60 ×2.0). Dungeon trash
 * and dungeon bosses ('trash', 'dboss') take DUNGEON_DANGER_FRAC of the bonus, 1 + DUNGEON_DANGER_FRAC × (zd(M) - 1)
 * (M2 v4: level 60 ×1.5). Every other variant (normal, elite, rare; Camp waves and summoned adds are built as
 * normal) takes zd(M). The end boss and the Dimming Shards (boss.js) are not made here and keep their own constants.
 */
export function zoneDanger(level, variant = 'normal') {
  const bonus = (ZONE_DANGER_STEP * Math.max(0, level - ZONE_DANGER_FROM)) / 10;
  return 1 + (variant === 'trash' || variant === 'dboss' ? DUNGEON_DANGER_FRAC * bonus : bonus);
}

/**
 * The price of the engage round on template enemies (rules 7.10, combat v2): ENGAGE_DMG_COMP, except in the Rogue's
 * fights, whose enemies were already Unaware in round 1 before combat v2 (D48); its dungeon-boss fights pay it,
 * because it starts those without STEALTH (rules 5.3; D49). The fight kind is that of s.fight (set before enemies are
 * made).
 */
const engageComp = (s) => (s.player.classId === 'rogue' && !(s.fight && s.fight.kind === 'dboss') ? 1 : ENGAGE_DMG_COMP);

/**
 * Enemy from a template (rules 7.6): every quest, grind, elite, rare, dungeon, Camp, summoned and Signal enemy. No
 * draws. Damage includes zone danger and the engage-round price (engageComp; combat v2, D48). Combat v2
 * fields: turn0 (round of its turn 1; set by the caller), turn (current turn), track, acted (turns it has acted;
 * Bloodlust), ward (guardian), unscripted (summons and Signal adds play no opening script), noReward (Signal adds),
 * wasSapped (Sap landed on it this fight; autoplay's default target, D48).
 */
export function makeEnemy(s, idx, tid, level, variant) {
  const t = s.content.enemies[tid];
  const a = ARCHETYPE[t.archetype];
  const v = VARIANT[variant] || VARIANT.normal;
  const hp = Math.max(1, rnd((ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL * level) * a.hp * v.hp * t.hpMult));
  return {
    idx, tid, name: t.name, kind: variant, arch: t.archetype, level, hp, maxHp: hp,
    dmg: (ENEMY_DMG_BASE + ENEMY_DMG_PER_LEVEL * level) * a.dmg * v.dmg * t.dmgMult * zoneDanger(level, variant) * engageComp(s),
    armor: ENEMY_ARMOR_PER_LEVEL * level * a.armor, dodge: ENEMY_DODGE + a.dodge,
    abilities: t.abilities.slice(), cds: {}, st: [], intent: null, alive: true,
    elite: variant === 'elite' || variant === 'rare', boss: variant === 'dboss', ccImmune: variant === 'dboss',
    enraged: 0, summoned: false, shield: 0, asc: 0,
    turn0: 1, turn: 0, track: [], acted: 0, ward: null, unscripted: false, noReward: false, wasSapped: false,
  };
}

/**
 * An enemy joins mid-fight (template summon, Signal; rules 7.11): no opening script, its turn 1 is the next round,
 * its whole track is drawn at once; a guardian takes its ward now.
 */
function addEnemy(s, ev, tid, level, by, extra = {}) {
  const f = s.fight;
  const add = makeEnemy(s, f.enemies.length, tid, level, 'normal');
  Object.assign(add, { unscripted: true, turn0: f.round + 1 }, extra);
  f.enemies.push(add);
  if (add.arch === 'guardian') assignWard(f, add);
  ev.push({ t: 'summon', u: add.idx, name: add.name, hp: add.hp, by, ...(extra.noReward ? { signal: true } : {}) });
  fillTrack(s, add);
  return add;
}

function summonAdds(s, ev, e, count) {
  const f = s.fight;
  const pool = f.addPool;
  for (let i = 0; i < count; i++) addEnemy(s, ev, pool[nextInt(f.rng, pool.length)], f.addLevel, e.idx);
}

/**
 * Signal (rules 7.12, combat v2): at the end of the round SIGNAL_ADDS normal enemies join, each drawn from the
 * encounter's add pool (1 draw), at the skulker's level, with no XP or loot.
 */
function resolveSignal(s, ev) {
  const f = s.fight;
  const sig = f.signalPending;
  f.signalPending = null;
  if (!sig || f.over || !f.addPool.length) return;
  for (let i = 0; i < sig.adds; i++) addEnemy(s, ev, f.addPool[nextInt(f.rng, f.addPool.length)], sig.level, sig.by, { noReward: true });
}

function retarget(s, tgt, single) {
  const f = s.fight;
  if (single && petAlive(s) && (hasSt(f.pet.st, 'TAUNT') || hasSt(f.p.st, 'FEIGN'))) return 'pet';
  if (tgt === 'pet' && !petAlive(s)) return 'player';
  return tgt;
}

/**
 * Perform a normal enemy's intent (rules 7.1 step 4). Returns true if it acted. A wind-up (rules 7.12, combat v2.1)
 * lands when the player or the pet lost HP to its hit or rend, and whenever a cleave, curse, self_heal or self_shield
 * is played; a heavy one that cost the player 0 HP (7.13 (3)) is answered instead; any other outcome is neither.
 */
function enemyAct(s, ev, e) {
  const f = s.fight;
  const it = e.intent;
  if (!it || it.kind === 'none') return false;
  if (controlOf(e.st)) return false;
  if (it.interrupted || it.skipped || it.cancelled) return false;
  if (it.cd) e.cds[it.id] = f.round + it.cd;
  const single = isSingle(it.kind);
  ev.push({ t: 'enemyAction', u: e.idx, id: it.id, name: it.name });
  if (it.kind === 'hit' || it.kind === 'rend') {
    // A heavy action that costs the player 0 HP leaves the enemy OFF_BALANCE (rules 7.13): every hit missed, was
    // dodged or absorbed (WARD, IMMUNE, image, Death's Sidestep), or went to the pet because of TAUNT or feign.
    let avoided = true;
    let lost = false; // the player or the pet lost HP to it (a wind-up lands, rules 7.12)
    for (let h = 0; h < it.hits; h++) {
      if (f.over || !e.alive) return true;
      const redirect = single && petAlive(s) && (hasSt(f.pet.st, 'TAUNT') || hasSt(f.p.st, 'FEIGN'));
      const tgt = retarget(s, it.target, single);
      if (tgt === 'player' && mirrorImage(s, ev)) continue;
      const res = damage(s, ev, e.idx, tgt, { base: it.pct * e.dmg, school: it.school, spell: it.id });
      if (tgt === 'player' ? res.hpLost > 0 : !redirect) avoided = false;
      if (res.hpLost > 0) lost = true;
      if (it.kind === 'rend' && res.hit && !f.over && (tgt === 'player' || petAlive(s))) {
        const tick = Math.max(MIN_HIT_DAMAGE, rnd(snapshot(s, e.idx, tgt, it.tickPct * e.dmg, {})));
        addStatus(s, ev, tgt, { id: 'BLEED', src: `${it.id}@${e.idx}`, by: e.idx, dur: it.rounds, full: it.rounds, tick, canCrit: false });
      }
    }
    if (it.heavy && avoided && e.alive && !f.over) gainOffBalance(s, ev, e.idx, OFFBAL_DURATION, 'avoided', it);
    if (it.heavy && avoided) answerWindup(s, ev, e.idx, it, 'avoided', null);
    else if (lost) landWindup(s, ev, e.idx, it);
  } else if (it.kind === 'cleave') {
    if (!mirrorImage(s, ev)) damage(s, ev, e.idx, 'player', { base: it.pct * e.dmg, school: it.school, spell: it.id });
    if (!f.over && petAlive(s)) damage(s, ev, e.idx, 'pet', { base: it.pct * e.dmg, school: it.school, spell: it.id });
    landWindup(s, ev, e.idx, it);
  } else if (it.kind === 'curse') {
    addStatus(s, ev, 'player', { id: 'CURSED', dur: it.rounds, by: e.idx });
    landWindup(s, ev, e.idx, it);
  } else if (it.kind === 'brace') {
    addStatus(s, ev, e.idx, { id: 'BRACE', dur: it.rounds, value: it.reduce });
  } else if (it.kind === 'shieldAlly') {
    // The guardian's ward (rules 7.12, combat v2).
    const w = wardOf(s, e);
    if (w !== null) addStatus(s, ev, w, { id: 'SHIELDED', dur: it.rounds, value: it.reduce });
  } else if (it.kind === 'heal') {
    const o = f.enemies[it.target] && f.enemies[it.target].alive ? f.enemies[it.target] : lowestHpAlly(s, e, true);
    if (o) healUnit(s, ev, o.idx, rnd(it.pct * o.maxHp), it.id);
  } else if (it.kind === 'bolster') {
    // Bolster (rules 7.12, combat v2): the lowest-HP ally (self included) gains an enemy shield.
    const o = f.enemies[it.target] && f.enemies[it.target].alive ? f.enemies[it.target] : lowestHpAlly(s, e, true);
    if (o) {
      o.shield = Math.max(o.shield, rnd(it.pct * o.maxHp));
      ev.push({ t: 'shield', u: o.idx, amount: o.shield, by: e.idx, spell: it.id });
    }
  } else if (it.kind === 'signal') {
    // Signal (rules 7.12, combat v2): the reinforcement joins at the end of the round; once per fight.
    if (!f.signalled) {
      f.signalled = true;
      f.signalPending = { by: e.idx, level: e.level, adds: it.adds };
      ev.push({ t: 'signal', u: e.idx, adds: it.adds });
    }
  } else if (it.kind === 'selfHeal') {
    healUnit(s, ev, e.idx, rnd(it.pct * e.maxHp), it.id);
    landWindup(s, ev, e.idx, it);
  } else if (it.kind === 'selfShield') {
    e.shield = Math.max(e.shield, rnd(it.pct * e.maxHp));
    ev.push({ t: 'shield', u: e.idx, amount: e.shield });
    landWindup(s, ev, e.idx, it);
  } else if (it.kind === 'summon') {
    e.summoned = true;
    summonAdds(s, ev, e, it.count);
  }
  return true;
}

function enemiesAct(s, ev) {
  const f = s.fight;
  for (let i = 0; i < f.enemies.length; i++) {
    if (f.over) return;
    const e = f.enemies[i];
    if (!e.alive || !e.intent) continue;
    // `acted` counts the turns an enemy acted (Bloodlust, rules 7.12).
    if (e.kind === 'boss') bossAct(s, ev, e);
    else if (enemyAct(s, ev, e)) e.acted += 1;
  }
}

// ---------------- Targets ----------------
const PRIORITY = { mender: 0, caster: 1 };
/** HEXED or SAPPED: damage would break the control (rules 7.9 skips them as default targets, combat v2). */
export const breaksOnHit = (e) => hasSt(e.st, 'HEXED') || hasSt(e.st, 'SAPPED');
/**
 * Default target (rules 7.9): living, non-HEXED, non-SAPPED, mender > caster > others, lowest HP, lowest index. An
 * enemy that was sapped this fight only when no other such enemy lives (D48: autoplay never switches back to it while
 * it fights another); HEXED or SAPPED enemies only when no other is left.
 */
const TARGET_TIERS = [(e) => !breaksOnHit(e) && !e.wasSapped, (e) => !breaksOnHit(e), () => true];
export function defaultTarget(s) {
  const f = s.fight;
  const rank = (e) => (e.arch in PRIORITY ? PRIORITY[e.arch] : 2);
  for (const ok of TARGET_TIERS) {
    let best = null;
    for (const e of f.enemies) {
      if (!e.alive || !ok(e)) continue;
      if (!best || rank(e) < rank(best) || (rank(e) === rank(best) && e.hp < best.hp)) best = e;
    }
    if (best) return best.idx;
  }
  return null;
}

// ---------------- Rounds ----------------
/**
 * Start of a round (rules 7.1 step 1, 7.11): pet TAUNT schedule, boss round start (Shards), then the intent tracks
 * (one entry per enemy, enemies in index order), then each living enemy's now-intent and what its track shows.
 */
export function beginRound(s, ev) {
  const f = s.fight;
  ev.push(isEngageRound(f) ? { t: 'round', n: f.round, engage: true } : { t: 'round', n: f.round });
  const pet = s.player.pet;
  if (pet && pet.alive && PET[pet.id].tauntEvery && (f.round - 1) % PET[pet.id].tauntEvery === 0) {
    addStatus(s, ev, 'pet', { id: 'TAUNT', dur: PET[pet.id].tauntRounds });
  }
  if (f.boss) bossStartRound(s, ev);
  updateTracks(s);
  for (const e of f.enemies) {
    if (!e.alive) { e.intent = null; continue; }
    if (e.kind === 'boss') {
      e.intent = bossIntent(s, e);
      bossTrackView(s, e);
    } else {
      nowIntent(s, ev, e);
      refreshTrack(s, e);
    }
    ev.push({ t: 'intent', u: e.idx, intent: deepClone(e.intent) });
  }
}

/**
 * One unit's DOT/HOT ticks (rules 7.1 step 5, 7.4). crits: undefined in play (a tick that can crit draws 1 number, rules
 * 7.2); 'never' or 'always' only for pendingTicks, which draws nothing and plays the ticks on a copy of the state.
 */
function tickUnit(s, ev, u, crits) {
  const f = s.fight;
  const st = u === 'player' ? f.p.st : u === 'pet' ? f.pet.st : f.enemies[u].st;
  for (const x of st.slice()) {
    if (f.over) return;
    if (u !== 'player' && u !== 'pet' && !f.enemies[u].alive) return;
    if (u === 'pet' && !petAlive(s)) return;
    if (x.id === 'BLEED' || x.id === 'BURN' || x.id === 'POISON') {
      let amt = x.tick * (x.stacks || 1);
      let crit = false;
      if (x.canCrit) {
        crit = crits === undefined ? nextFloat(f.rng) < s.player.d.crit : crits === 'always';
        if (crit) amt *= s.player.d.critMult;
      }
      const src = x.by !== undefined ? x.by : 'player';
      applyDamage(s, ev, src, u, Math.max(MIN_HIT_DAMAGE, rnd(amt)), { tick: true, crit, spell: x.src || x.id.toLowerCase(), school: x.id === 'BURN' ? 'fire' : 'phys' });
    } else if (x.id === 'BRAND' && u === 'player') {
      // rules 10.2: BRAND_DMG × stacks × BOSS_DMG_MULT × (1 + asc) × levelMod in the end-boss fight (M2b v6, D64)
      const asc = f.boss ? f.boss.asc : 0;
      const amt = rnd(BRAND_DMG * x.stacks * bossDmgFactor(s, asc) * levelMod(BOSS_LEVEL, s.player.level));
      applyDamage(s, ev, 0, 'player', Math.max(MIN_HIT_DAMAGE, amt), { tick: true, spell: 'brand', school: 'magic' });
    } else if (x.id === 'HOT') {
      healUnit(s, ev, u, x.amount, x.src);
    } else if (x.id === 'EVASION' && u === 'player' && tr(s, 'r_b4')) {
      healUnit(s, ev, 'player', rnd(tr(s, 'r_b4') * TALENT.r_b4.healPct * s.player.d.maxHp), 'r_b4');
    }
  }
}

function decay(s, ev, u) {
  const st = u === 'player' ? s.fight.p.st : u === 'pet' ? s.fight.pet.st : s.fight.enemies[u].st;
  for (let i = st.length - 1; i >= 0; i--) {
    const x = st[i];
    if (x.dur === null || x.dur === undefined) continue;
    x.dur -= 1;
    if (x.dur <= 0) {
      st.splice(i, 1);
      ev.push({ t: 'status', u, id: x.id, on: false, src: x.src });
    }
  }
}

/**
 * The ticks of the end of a round (rules 7.1 step 5): the player first, then the pet, then the enemies in index order.
 * A death ends the fight at once (no later tick), and an enemy killed by a tick spreads Plague Heart before the later
 * enemies tick. crits: see tickUnit (undefined in play).
 */
export function tickPhase(s, ev, crits) {
  const f = s.fight;
  tickUnit(s, ev, 'player', crits);
  if (!f.over && s.player.pet) tickUnit(s, ev, 'pet', crits);
  for (let i = 0; i < f.enemies.length && !f.over; i++) if (f.enemies[i].alive) tickUnit(s, ev, i, crits);
}

/** End of round (rules 7.1 step 5): ticks (player side first, then enemies), durations, regen, boss, Signal. */
function endOfRound(s, ev) {
  const f = s.fight;
  const adrenal = findSt(f.p.st, 'ADRENAL');
  const rapid = findSt(f.p.st, 'RAPID');
  tickPhase(s, ev);
  if (f.over) return;
  decay(s, ev, 'player');
  if (s.player.pet) decay(s, ev, 'pet');
  for (let i = 0; i < f.enemies.length; i++) if (f.enemies[i].alive) decay(s, ev, i);
  const p = s.player;
  if (p.classId === 'rogue') f.p.energy = Math.min(ENERGY_MAX, f.p.energy + ENERGY_REGEN * (adrenal ? adrenal.value : 1));
  else if (p.classId === 'hunter') f.p.focus = Math.min(FOCUS_MAX, f.p.focus + rnd(FOCUS_REGEN * (1 + (rapid ? rapid.focus : 0))));
  else p.mana = Math.min(p.d.maxMana, p.mana + rnd(MANA_REGEN_ROUND_PCT * p.d.maxMana));
  if (f.boss) bossEndOfRound(s, ev);
  resolveSignal(s, ev);
}

/**
 * A round up to its end (rules 7.1 steps 2-4): the player's action, the pet, the enemies. resolveRound plays the rest;
 * the tests use it to stop a round right before its ticks (qa/engine/s15-dot-preview.test.mjs).
 */
export function roundActions(s, ev, action) {
  const f = s.fight;
  s.stats.rounds += 1;
  if (f.kind === 'boss') s.stats.bossRounds += 1;
  playerAction(s, ev, action);
  if (!f.over) petAction(s, ev);
  if (!f.over) enemiesAct(s, ev);
}

/** Resolve one full round from the player's action (rules 7.1). */
export function resolveRound(s, ev, action) {
  const f = s.fight;
  roundActions(s, ev, action);
  if (!f.over) endOfRound(s, ev);
  if (!f.over) {
    f.round += 1;
    beginRound(s, ev);
  }
}

// ---------------- DoT preview (owner feedback 2026-11-11 08:11; engine-api.md 6.1) ----------------
/** The tick phase played on a copy: per unit what it took, healed and whether it died. Draws nothing. */
function simulateTicks(s, crits) {
  const c = cloneState(s);
  const ev = [];
  tickPhase(c, ev, crits);
  const out = new Map();
  const rec = (u) => {
    if (!out.has(u)) out.set(u, { u, amount: 0, hpLost: 0, absorbed: 0, heal: 0, lethal: false, resurrect: null, ticks: [] });
    return out.get(u);
  };
  for (const e of ev) {
    if (e.t === 'damage') {
      const r = rec(e.dst);
      r.amount += e.amount; r.hpLost += e.hpLost; r.absorbed += e.absorbed || 0;
      r.ticks.push({ spell: e.spell, amount: e.amount, absorbed: e.absorbed || 0, crit: !!e.crit, ...(e.immune ? { immune: true } : {}), ...(e.sidestep ? { sidestep: true } : {}) });
    } else if (e.t === 'heal') rec(e.dst).heal += e.amount;
    else if (e.t === 'death') rec(e.u).lethal = true;
    else if (e.t === 'resurrect') Object.assign(rec('player'), { lethal: true, resurrect: e.source });
  }
  const hpOf = (u) => (u === 'player' ? c.player.hp : u === 'pet' ? (c.player.pet && c.player.pet.alive ? c.player.pet.hp : 0) : c.fight.enemies[u].alive ? c.fight.enemies[u].hp : 0);
  for (const r of out.values()) r.hpAfter = hpOf(r.u);
  return out;
}

/** Does a DOT on a living unit tick with a possible crit (Hemorrhage Mastery, rules 6.1 r_c5)? */
function critTicks(s) {
  const f = s.fight;
  const lists = [f.p.st, f.pet.st, ...f.enemies.filter((e) => e.alive).map((e) => e.st)];
  return lists.some((st) => st.some((x) => x.canCrit && (x.id === 'BLEED' || x.id === 'BURN' || x.id === 'POISON')));
}

/**
 * What the ticks at the end of the current round (rules 7.1 step 5) will do if nothing else happens before them: the
 * damage each unit's active DOTs deal it (BLEED, BURN, POISON with their stacks, BRAND; no armor, rules 7.2), after
 * IMMUNE, WARD or a shield, Mindguard, the Shared Wounds share and Death's Sidestep, the HOT heals among them, and whether
 * the unit dies. Exact: the engine's own tick phase played on a copy of the state, in its order (a death ends the fight,
 * Plague Heart spreads before the later enemies tick). A tick that can crit is counted without the crit; `crit` gives the
 * same numbers with every such tick a crit. Draws nothing and reveals no draw. Not counted: what happens earlier in the
 * round (the player's action, the pet, the enemies' actions). null outside a fight.
 * Returns [{ u, hp, amount, hpLost, absorbed, heal, hpAfter, lethal, resurrect, ticks: [{ spell, amount, absorbed, crit }],
 * crit: null | { amount, hpLost, hpAfter, lethal, resurrect } }]: one entry per unit the phase touches, in tick order.
 */
export function pendingTicks(s) {
  const f = s.fight;
  if (!f || f.over) return null;
  const base = simulateTicks(s, 'never');
  const hi = critTicks(s) ? simulateTicks(s, 'always') : null;
  const hpNow = (u) => (u === 'player' ? s.player.hp : u === 'pet' ? s.player.pet.hp : f.enemies[u].hp);
  const order = (u) => (u === 'player' ? -2 : u === 'pet' ? -1 : u);
  const keys = [...new Set([...base.keys(), ...(hi ? hi.keys() : [])])].sort((a, b) => order(a) - order(b));
  const none = (u) => ({ u, amount: 0, hpLost: 0, absorbed: 0, heal: 0, lethal: false, resurrect: null, ticks: [], hpAfter: hpNow(u) });
  return keys.map((u) => {
    const b = base.get(u) || none(u);
    const x = hi ? hi.get(u) || none(u) : null;
    const differs = x && (x.amount !== b.amount || x.lethal !== b.lethal || x.hpAfter !== b.hpAfter);
    return { ...b, hp: hpNow(u), crit: differs ? { amount: x.amount, hpLost: x.hpLost, hpAfter: x.hpAfter, lethal: x.lethal, resurrect: x.resurrect } : null };
  });
}

// ---------------- Fight start and end ----------------
/**
 * Start a fight. spec: { kind, k, enemies: [{tid, level, variant}], addLevel, addPool, dropMult, noStealth?, canFlee,
 * rng (fight stream state), boss?, bossEnemy?, engage?, heat? (the node's entry heat state, rules 1.7.3; null for the
 * Camp, the boss and Dimmed encounters) }. Every fight but the end boss ('boss') has an engage round
 * (rules 7.10): enemies are Unaware in round 1 and their turn 1 is round 2 (`engage` overrides this; tests use it).
 * Guardians take their wards (7.12); the tracks are filled for turns 1..INTENT_TRACK_LEN (7.11).
 */
export function startFight(s, ev, spec) {
  const p = s.player;
  const f = {
    kind: spec.kind, k: spec.k, z: spec.z, round: 1, rng: spec.rng, enemies: [], over: null,
    canFlee: spec.canFlee, addLevel: spec.addLevel, addPool: spec.addPool || [], dropMult: spec.dropMult || 1,
    drops: [], boss: spec.boss || null, engage: spec.engage !== undefined ? !!spec.engage : spec.kind !== 'boss',
    heat: spec.heat || null, startCount: 0, signalled: false,
    signalPending: null,
    p: {
      st: [], cds: {}, cp: 0, energy: ENERGY_MAX, energyMax: ENERGY_MAX, focus: FOCUS_MAX, focusMax: FOCUS_MAX,
      potionReady: 0, skip: false, target: null, stealthPrev: false, niBonus: 0, momentum: 0, momBonus: 0,
      lucid: false, sidestepUsed: false, riposte: false, firstFinisher: false, gatherCrit: 0,
    },
    pet: { st: [], actions: 0 },
  };
  s.fight = f;
  if (spec.bossEnemy) f.enemies.push(spec.bossEnemy);
  for (const en of spec.enemies || []) f.enemies.push(makeEnemy(s, f.enemies.length, en.tid, en.level, en.variant));
  f.startCount = f.enemies.length;
  for (const e of f.enemies) e.turn0 = f.engage ? 2 : 1;
  for (const e of f.enemies) if (e.arch === 'guardian') assignWard(f, e);
  s.stats.fights += 1;
  if (f.engage) s.stats.engages = (s.stats.engages || 0) + 1;
  ev.push({ t: 'fight', kind: f.kind, k: f.k, engage: f.engage, heat: f.heat, enemies: f.enemies.map((e) => ({ u: e.idx, name: e.name, level: e.level, hp: e.hp, kind: e.kind, arch: e.arch })) });
  if (p.classId === 'rogue' && !spec.noStealth) gainStealth(s, ev, false);
  const wards = hasEffect(s, 'ward');
  if (wards) addStatus(s, ev, 'player', { id: 'WARD', dur: null, amount: rnd(UNIQUE_WARD_PCT * wards * p.d.maxHp), src: 'unique' });
  beginRound(s, ev);
}

/** Clean up after a fight (rules 7.1 "Fight end", 4.2 post-fight regen, 5.5 pet revive). Returns the outcome. */
export function endFight(s, ev) {
  const f = s.fight;
  const p = s.player;
  const outcome = f.over;
  s.fight = null;
  if (outcome === 'death') return { outcome, drops: f.drops };
  if (p.pet && !p.pet.alive) {
    p.pet.alive = true;
    p.pet.hp = Math.max(1, rnd((PET_REVIVE_PCT + tr(s, 'h_a5') * TALENT.h_a5.revive) * p.d.petMaxHp));
    ev.push({ t: 'petRevive', hp: p.pet.hp });
  }
  if (outcome === 'victory') {
    const pct = p.d.regenPct;
    const hp0 = p.hp;
    const mana0 = p.mana;
    const pet0 = p.pet ? p.pet.hp : 0;
    p.hp = Math.min(p.d.maxHp, p.hp + rnd(pct * p.d.maxHp));
    if (p.d.maxMana) p.mana = Math.min(p.d.maxMana, p.mana + rnd(pct * p.d.maxMana));
    if (p.pet) p.pet.hp = Math.min(p.d.petMaxHp, p.pet.hp + rnd(pct * p.d.petMaxHp));
    ev.push({ t: 'victory', kind: f.kind, rounds: f.round });
    // Post-fight regen (rules 4.2), after the victory event; sent only when something was restored.
    const gain = { hpGain: p.hp - hp0, manaGain: p.mana - mana0, petHpGain: p.pet ? p.pet.hp - pet0 : 0 };
    if (gain.hpGain > 0 || gain.manaGain > 0 || gain.petHpGain > 0) ev.push({ t: 'regen', pct, ...gain });
  } else {
    ev.push({ t: 'fled', kind: f.kind });
  }
  return { outcome, drops: f.drops };
}
