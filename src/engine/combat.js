// Fight lifecycle and enemy AI (rules 7.1, 7.4, 7.6). Player actions are in spells.js; the end boss in boss.js.
import {
  ARCHETYPE, VARIANT, ABILITY_TEMPLATE, ENEMY_HP_BASE, ENEMY_HP_PER_LEVEL, ENEMY_DMG_BASE, ENEMY_DMG_PER_LEVEL,
  ENEMY_ARMOR_PER_LEVEL, ENEMY_DODGE, PET, ENERGY_MAX, ENERGY_REGEN, FOCUS_MAX, FOCUS_REGEN,
  MANA_REGEN_ROUND_PCT, PET_REVIVE_PCT, TALENT, UNIQUE_WARD_PCT, BRAND_DMG, BOSS_LEVEL, MIN_HIT_DAMAGE,
} from '../constants.js';
import { nextFloat, weightedIndex, nextInt } from '../rng.js';
import { rnd, deepClone } from './util.js';
import { tr, hasEffect } from './stats.js';
import {
  damage, snapshot, mitigation, addStatus, findSt, hasSt, petAlive, healUnit, applyDamage, levelMod, gainStealth,
} from './damage.js';
import { bossIntent, bossAct, bossStartRound, bossEndOfRound, mirrorImage, SHARD_ACTION } from './boss.js';
import { playerAction, petAction } from './spells.js';

// ---------------- Enemies ----------------
export function makeEnemy(s, idx, tid, level, variant) {
  const t = s.content.enemies[tid];
  const a = ARCHETYPE[t.archetype];
  const v = VARIANT[variant] || VARIANT.normal;
  const hp = Math.max(1, rnd((ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL * level) * a.hp * v.hp * t.hpMult));
  return {
    idx, tid, name: t.name, kind: variant, arch: t.archetype, level, hp, maxHp: hp,
    dmg: (ENEMY_DMG_BASE + ENEMY_DMG_PER_LEVEL * level) * a.dmg * v.dmg * t.dmgMult,
    armor: ENEMY_ARMOR_PER_LEVEL * level * a.armor, dodge: ENEMY_DODGE + a.dodge,
    abilities: t.abilities.slice(), cds: {}, st: [], intent: null, alive: true,
    elite: variant === 'elite' || variant === 'rare', boss: variant === 'dboss', ccImmune: variant === 'dboss',
    enraged: 0, summoned: false, shield: 0, asc: 0,
  };
}

/** Actions an enemy can pick: archetype actions, then template abilities (rules 7.6, 12.4). */
function enemyActions(s, e) {
  if (e.kind === 'shard') return [SHARD_ACTION];
  const list = ARCHETYPE[e.arch].actions.slice();
  for (const id of e.abilities) {
    const ab = s.content.abilities[id];
    const T = ABILITY_TEMPLATE[ab.template];
    if (T.once) continue;
    list.push({
      id, name: ab.name, kind: T.kind, pct: ab.pct, tickPct: ab.tickPct, rounds: T.rounds, school: T.school,
      heavy: !!T.heavy, cast: !!T.cast, cd: ab.cd, w: T.weight, below: T.below, template: ab.template,
    });
  }
  return list;
}

const SINGLE = ['hit', 'rend'];

function lowestHpAlly(s, e, includeSelf) {
  let best = null;
  for (const o of s.fight.enemies) {
    if (!o.alive || (!includeSelf && o.idx === e.idx)) continue;
    if (!best || o.hp / o.maxHp < best.hp / best.maxHp) best = o;
  }
  return best;
}

function eligible(s, e, a) {
  const f = s.fight;
  if ((e.cds[a.id] || 0) > f.round) return false;
  if (a.cast && hasSt(e.st, 'SILENCED')) return false;
  if (a.kind === 'heal') return f.enemies.some((o) => o.alive && o.hp < a.below * o.maxHp);
  if (a.kind === 'shieldAlly') return !!lowestHpAlly(s, e, false);
  if (a.kind === 'selfHeal') return e.hp < a.below * e.maxHp;
  if (a.kind === 'selfShield') return e.shield <= 0;
  return true;
}

function hitEst(s, e, a, tgt) {
  let x = snapshot(s, e.idx, tgt, a.pct * e.dmg, {});
  if (a.school === 'phys') x *= 1 - mitigation(tgt === 'pet' ? s.player.d.petArmor : s.player.d.armor, e.level);
  return rnd(x) * (a.hits || 1);
}

/** Roll one enemy's intent (rules 7.6): 1 draw for the action, then 1 draw for the target if a live pet exists and no TAUNT/feign. */
function rollIntent(s, e) {
  const f = s.fight;
  if (hasSt(e.st, 'STUN') || hasSt(e.st, 'FROZEN')) return { id: 'stunned', name: 'Stunned', kind: 'none', est: 0 };
  if (hasSt(e.st, 'HEXED')) return { id: 'hexed', name: 'Hexed', kind: 'none', est: 0 };
  if (f.round === 1 && f.unaware) return { id: 'unaware', name: 'Unaware', kind: 'none', est: 0 };
  for (const id of e.abilities) {
    const ab = s.content.abilities[id];
    if (ab.template === 'summon' && !e.summoned && e.hp <= ABILITY_TEMPLATE.summon.at * e.maxHp) {
      return { id, name: ab.name, kind: 'summon', count: ab.count, target: 'self', est: 0 };
    }
  }
  const opts = enemyActions(s, e).filter((a) => eligible(s, e, a));
  const a = opts[weightedIndex(f.rng, opts.map((o) => o.w))];
  const pet = petAlive(s);
  const taunted = pet && (hasSt(f.pet.st, 'TAUNT') || hasSt(f.p.st, 'FEIGN'));
  let target = 'player';
  if (pet && !taunted) {
    const r = nextFloat(f.rng);
    if (SINGLE.includes(a.kind) && r < PET[s.player.pet.id].aggro) target = 'pet';
  } else if (taunted && SINGLE.includes(a.kind)) target = 'pet';
  const it = { id: a.id, name: a.name, kind: a.kind, cast: !!a.cast, heavy: !!a.heavy, school: a.school || null, cd: a.cd || 0, pct: a.pct, hits: a.hits || 1, tickPct: a.tickPct, rounds: a.rounds, reduce: a.reduce, est: 0 };
  if (a.kind === 'hit' || a.kind === 'rend') { it.target = target; it.est = hitEst(s, e, a, target); }
  else if (a.kind === 'cleave') { it.target = 'all'; it.est = hitEst(s, e, a, 'player'); }
  else if (a.kind === 'curse') it.target = 'player';
  else if (a.kind === 'heal') { const o = lowestHpAlly(s, e, true); it.target = o.idx; it.est = rnd(a.pct * o.maxHp); }
  else if (a.kind === 'shieldAlly') it.target = lowestHpAlly(s, e, false).idx;
  else if (a.kind === 'selfHeal') { it.target = 'self'; it.est = rnd(a.pct * e.maxHp); }
  else it.target = 'self';
  return it;
}

export function rollIntents(s, ev) {
  for (const e of s.fight.enemies) {
    if (!e.alive) { e.intent = null; continue; }
    e.intent = e.kind === 'boss' ? bossIntent(s, e) : rollIntent(s, e);
    ev.push({ t: 'intent', u: e.idx, intent: deepClone(e.intent) });
  }
}

function retarget(s, tgt, single) {
  const f = s.fight;
  if (single && petAlive(s) && (hasSt(f.pet.st, 'TAUNT') || hasSt(f.p.st, 'FEIGN'))) return 'pet';
  if (tgt === 'pet' && !petAlive(s)) return 'player';
  return tgt;
}

function summonAdds(s, ev, e, count) {
  const f = s.fight;
  const pool = f.addPool;
  for (let i = 0; i < count; i++) {
    const tid = pool[nextInt(f.rng, pool.length)];
    const add = makeEnemy(s, f.enemies.length, tid, f.addLevel, 'normal');
    f.enemies.push(add);
    ev.push({ t: 'summon', u: add.idx, name: add.name, hp: add.hp, by: e.idx });
  }
}

/** Perform a normal enemy's intent (rules 7.1 step 4). */
function enemyAct(s, ev, e) {
  const f = s.fight;
  const it = e.intent;
  if (!it || it.kind === 'none') return;
  if (hasSt(e.st, 'STUN') || hasSt(e.st, 'FROZEN') || hasSt(e.st, 'HEXED')) return;
  if (it.interrupted || it.skipped) return;
  if (it.cd) e.cds[it.id] = f.round + it.cd;
  const single = SINGLE.includes(it.kind);
  ev.push({ t: 'enemyAction', u: e.idx, id: it.id, name: it.name });
  if (it.kind === 'hit' || it.kind === 'rend') {
    for (let h = 0; h < it.hits; h++) {
      if (f.over || !e.alive) return;
      const tgt = retarget(s, it.target, single);
      if (tgt === 'player' && mirrorImage(s, ev)) continue;
      const res = damage(s, ev, e.idx, tgt, { base: it.pct * e.dmg, school: it.school, spell: it.id });
      if (it.kind === 'rend' && res.hit && !f.over && (tgt === 'player' || petAlive(s))) {
        const tick = Math.max(MIN_HIT_DAMAGE, rnd(snapshot(s, e.idx, tgt, it.tickPct * e.dmg, {})));
        addStatus(s, ev, tgt, { id: 'BLEED', src: `${it.id}@${e.idx}`, by: e.idx, dur: it.rounds, full: it.rounds, tick, canCrit: false });
      }
    }
  } else if (it.kind === 'cleave') {
    if (!mirrorImage(s, ev)) damage(s, ev, e.idx, 'player', { base: it.pct * e.dmg, school: it.school, spell: it.id });
    if (!f.over && petAlive(s)) damage(s, ev, e.idx, 'pet', { base: it.pct * e.dmg, school: it.school, spell: it.id });
  } else if (it.kind === 'curse') {
    addStatus(s, ev, 'player', { id: 'CURSED', dur: it.rounds, by: e.idx });
  } else if (it.kind === 'brace') {
    addStatus(s, ev, e.idx, { id: 'BRACE', dur: it.rounds, value: it.reduce });
  } else if (it.kind === 'shieldAlly') {
    const o = f.enemies[it.target] && f.enemies[it.target].alive ? f.enemies[it.target] : lowestHpAlly(s, e, false);
    if (o) addStatus(s, ev, o.idx, { id: 'SHIELDED', dur: it.rounds, value: it.reduce });
  } else if (it.kind === 'heal') {
    const o = f.enemies[it.target] && f.enemies[it.target].alive ? f.enemies[it.target] : lowestHpAlly(s, e, true);
    if (o) healUnit(s, ev, o.idx, rnd(it.pct * o.maxHp), it.id);
  } else if (it.kind === 'selfHeal') {
    healUnit(s, ev, e.idx, rnd(it.pct * e.maxHp), it.id);
  } else if (it.kind === 'selfShield') {
    e.shield = Math.max(e.shield, rnd(it.pct * e.maxHp));
    ev.push({ t: 'shield', u: e.idx, amount: e.shield });
  } else if (it.kind === 'summon') {
    e.summoned = true;
    summonAdds(s, ev, e, it.count);
  }
}

function enemiesAct(s, ev) {
  const f = s.fight;
  for (let i = 0; i < f.enemies.length; i++) {
    if (f.over) return;
    const e = f.enemies[i];
    if (!e.alive || !e.intent) continue;
    if (e.kind === 'boss') bossAct(s, ev, e);
    else enemyAct(s, ev, e);
  }
}

// ---------------- Targets ----------------
const PRIORITY = { mender: 0, caster: 1 };
/** Default target (rules 7.9): living, non-HEXED, mender > caster > others, lowest HP, lowest index. */
export function defaultTarget(s) {
  const f = s.fight;
  let best = null;
  const rank = (e) => (e.arch in PRIORITY ? PRIORITY[e.arch] : 2);
  for (const pass of [false, true]) {
    for (const e of f.enemies) {
      if (!e.alive || (!pass && hasSt(e.st, 'HEXED'))) continue;
      if (!best || rank(e) < rank(best) || (rank(e) === rank(best) && e.hp < best.hp)) best = e;
    }
    if (best) return best.idx;
  }
  return null;
}

// ---------------- Rounds ----------------
export function beginRound(s, ev) {
  const f = s.fight;
  ev.push({ t: 'round', n: f.round });
  const pet = s.player.pet;
  if (pet && pet.alive && PET[pet.id].tauntEvery && (f.round - 1) % PET[pet.id].tauntEvery === 0) {
    addStatus(s, ev, 'pet', { id: 'TAUNT', dur: PET[pet.id].tauntRounds });
  }
  if (f.boss) bossStartRound(s, ev);
  rollIntents(s, ev);
}

function tickUnit(s, ev, u) {
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
        crit = nextFloat(f.rng) < s.player.d.crit;
        if (crit) amt *= s.player.d.critMult;
      }
      const src = x.by !== undefined ? x.by : 'player';
      applyDamage(s, ev, src, u, Math.max(MIN_HIT_DAMAGE, rnd(amt)), { tick: true, crit, spell: x.src || x.id.toLowerCase(), school: x.id === 'BURN' ? 'fire' : 'phys' });
    } else if (x.id === 'BRAND' && u === 'player') {
      const asc = f.boss ? f.boss.asc : 0;
      const amt = rnd(BRAND_DMG * x.stacks * (1 + asc) * levelMod(BOSS_LEVEL, s.player.level));
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

/** End of round (rules 7.1 step 5): ticks (player side first, then enemies), durations, regen, boss. */
function endOfRound(s, ev) {
  const f = s.fight;
  const adrenal = findSt(f.p.st, 'ADRENAL');
  const rapid = findSt(f.p.st, 'RAPID');
  tickUnit(s, ev, 'player');
  if (!f.over && s.player.pet) tickUnit(s, ev, 'pet');
  for (let i = 0; i < f.enemies.length && !f.over; i++) if (f.enemies[i].alive) tickUnit(s, ev, i);
  if (f.over) return;
  decay(s, ev, 'player');
  if (s.player.pet) decay(s, ev, 'pet');
  for (let i = 0; i < f.enemies.length; i++) if (f.enemies[i].alive) decay(s, ev, i);
  const p = s.player;
  if (p.classId === 'rogue') f.p.energy = Math.min(ENERGY_MAX, f.p.energy + ENERGY_REGEN * (adrenal ? adrenal.value : 1));
  else if (p.classId === 'hunter') f.p.focus = Math.min(FOCUS_MAX, f.p.focus + rnd(FOCUS_REGEN * (1 + (rapid ? rapid.focus : 0))));
  else p.mana = Math.min(p.d.maxMana, p.mana + rnd(MANA_REGEN_ROUND_PCT * p.d.maxMana));
  if (f.boss) bossEndOfRound(s, ev);
}

/** Resolve one full round from the player's action (rules 7.1). */
export function resolveRound(s, ev, action) {
  const f = s.fight;
  s.stats.rounds += 1;
  if (f.kind === 'boss') s.stats.bossRounds += 1;
  playerAction(s, ev, action);
  if (!f.over) petAction(s, ev);
  if (!f.over) enemiesAct(s, ev);
  if (!f.over) endOfRound(s, ev);
  if (!f.over) {
    f.round += 1;
    beginRound(s, ev);
  }
}

// ---------------- Fight start and end ----------------
/**
 * Start a fight. spec: { kind, k, enemies: [{tid, level, variant}], addLevel, addPool, dropMult, unaware?,
 * noStealth?, canFlee, rng (fight stream state), boss? }
 */
export function startFight(s, ev, spec) {
  const p = s.player;
  const f = {
    kind: spec.kind, k: spec.k, z: spec.z, round: 1, rng: spec.rng, enemies: [], over: null,
    canFlee: spec.canFlee, addLevel: spec.addLevel, addPool: spec.addPool || [], dropMult: spec.dropMult || 1,
    drops: [], unaware: false, boss: spec.boss || null,
    p: {
      st: [], cds: {}, cp: 0, energy: ENERGY_MAX, energyMax: ENERGY_MAX, focus: FOCUS_MAX, focusMax: FOCUS_MAX,
      potionReady: 0, skip: false, target: null, stealthPrev: false, niBonus: 0, momentum: 0, momBonus: 0,
      lucid: false, sidestepUsed: false, riposte: false, firstFinisher: false,
    },
    pet: { st: [], actions: 0 },
  };
  s.fight = f;
  if (spec.bossEnemy) f.enemies.push(spec.bossEnemy);
  for (const en of spec.enemies || []) f.enemies.push(makeEnemy(s, f.enemies.length, en.tid, en.level, en.variant));
  s.stats.fights += 1;
  ev.push({ t: 'fight', kind: f.kind, k: f.k, enemies: f.enemies.map((e) => ({ u: e.idx, name: e.name, level: e.level, hp: e.hp, kind: e.kind })) });
  if (p.classId === 'rogue' && !spec.noStealth) {
    gainStealth(s, ev, false);
    f.unaware = true;
  }
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
    p.hp = Math.min(p.d.maxHp, p.hp + rnd(pct * p.d.maxHp));
    if (p.d.maxMana) p.mana = Math.min(p.d.maxMana, p.mana + rnd(pct * p.d.maxMana));
    if (p.pet) p.pet.hp = Math.min(p.d.petMaxHp, p.pet.hp + rnd(pct * p.d.petMaxHp));
    ev.push({ t: 'victory', kind: f.kind, rounds: f.round });
  } else {
    ev.push({ t: 'fled', kind: f.kind });
  }
  return { outcome, drops: f.drops };
}

