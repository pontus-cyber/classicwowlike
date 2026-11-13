// Damage pipeline (rules 7.2), statuses (7.4), OFF_BALANCE (7.13, combat v2), the wind-up stacks EMPOWERED and STAGGERED
// (7.12, combat v2.1; M2b v13: their values are summed, a landed Deathblow adds DEATHBLOW_EMPOWER and MAIMS the player,
// whose healing healUnit then cuts by MAIM_HEAL), kills, death and resurrection (9). The end-boss fight's BOSS_DMG_MULT
// (10.1, M2b v6): bossDmgFactor.
// Expedition (rules 1.9.6, 1.9.8): Shardspawn kill rewards, the XP weight, the kill loot weight and dungeon boss rolls
// (M2b v11), the death location by node id.
// Dev tools (engine-api.md 12): god mode (state.dev.god) stops all damage to the player in a dev run.
// M3 guided run (m3-onboarding.md 2.6, E3): in the guided zone a death is a rescue (tutorial.js; nodes.js rescueEnd).
// Units: 'player', 'pet', or an enemy index (number) into s.fight.enemies.
import {
  LVL_DMG_STEP, LVL_DMG_MIN, LVL_DMG_MAX, MISS_BASE, MISS_PER_LEVEL, MISS_CAP, DMG_VARIANCE, ENEMY_CRIT,
  CRIT_MULT, ARMOR_K, ARMOR_C, ARMOR_MIT_CAP, MIN_HIT_DAMAGE, CHILL_PCT, CURSE_PCT, STEALTH_MISS_BONUS,
  TALENT, BOON_DMG_PCT, ELIXIR_DMG_PCT, UNIQUE_ELITE_DMG, LINK_DR, LINK_DR_PER_SHARD, FIGHT_SOFT_ENRAGE_ROUND,
  FIGHT_SOFT_ENRAGE_STEP, ECLIPSE_STEP, BRAND_MAX, BOSS_DMG_MULT, DEBUFFS, RES_HP_PCT, RES_MANA_PCT, MOB_XP_FRAC,
  ELITE_XP_MULT, RARE_XP_MULT, DUNGEON_BOSS_XP_MULT, DUNGEON_MOB_XP_MULT, MOB_COIN_V, ELITE_GOLD_V,
  EMBER_ELITE_DROP_CHANCE, UNIQUE_HEAL_ON_KILL, ABILITY_TEMPLATE, DODGE_CAP, SPELL,
  SHARD_AOE_TAKEN, OFFBAL_TAKEN, OFFBAL_BOSS_TAKEN, OFFBAL_CRIT, BLOODLUST_STEP, BLOODLUST_MAX, DIM_XP_MULT,
  EMPOWER_DMG, STAGGER_DMG, DEATHBLOW_EMPOWER, MAIM_HEAL, ONB_RESCUE_TOLLS,
} from '../constants.js';
import { nextFloat } from '../rng.js';
import { rnd, clamp } from './util.js';
import { tr, hasEffect } from './stats.js';
import { eventXp, gainXp, gainGold } from './progress.js';
import { rollDrop, V, makeConsumable, countConsumable, takeConsumable } from './items.js';
import { onBossDamaged } from './boss.js';
import { xpWeight, isExpedition, killDropMult, bossDropRolls } from './expedition.js';
import { rescueCovers, rescueTarget } from './tutorial.js';

// ---------------- Units ----------------
export function unitSt(s, u) {
  const f = s.fight;
  if (u === 'player') return f.p.st;
  if (u === 'pet') return f.pet.st;
  return f.enemies[u].st;
}
export function unitLevel(s, u) {
  return u === 'player' || u === 'pet' ? s.player.level : s.fight.enemies[u].level;
}
export function unitAlive(s, u) {
  if (u === 'player') return s.player.hp > 0;
  if (u === 'pet') return !!(s.player.pet && s.player.pet.alive);
  const e = s.fight.enemies[u];
  return !!(e && e.alive);
}
export function unitHpFrac(s, u) {
  if (u === 'player') return s.player.hp / s.player.d.maxHp;
  if (u === 'pet') return s.player.pet.hp / s.player.d.petMaxHp;
  const e = s.fight.enemies[u];
  return e.hp / e.maxHp;
}
export const petAlive = (s) => !!(s.player.pet && s.player.pet.alive);
export const isEliteOrBoss = (e) => !!(e && (e.elite || e.boss));
export const livingEnemies = (s) => s.fight.enemies.filter((e) => e.alive);

// ---------------- Statuses ----------------
export function findSt(st, id, src) {
  for (const x of st) if (x.id === id && (src === undefined || x.src === src)) return x;
  return null;
}
export const hasSt = (st, id) => findSt(st, id) !== null;

/**
 * Apply a status (rules 7.4 stacking). obj: { id, dur, ...fields }. Re-applying refreshes, except:
 * BLEED/BURN one per source (src) and refresh; POISON adds a stack up to obj.max; BRAND +1 stack up to BRAND_MAX,
 * no expiry; WARD replaces only if larger; stackable BLEED (Venom Barbs) uses obj.maxStacks.
 */
export function addStatus(s, ev, u, obj) {
  const st = unitSt(s, u);
  let cur = obj.id === 'BLEED' || obj.id === 'BURN' ? findSt(st, obj.id, obj.src) : findSt(st, obj.id);
  if (obj.id === 'POISON') {
    if (cur) {
      cur.stacks = Math.min(obj.max, cur.stacks + 1);
      cur.dur = obj.dur;
      cur.tick = obj.tick;
      cur.canCrit = obj.canCrit;
    } else {
      cur = { ...obj, stacks: 1 };
      st.push(cur);
    }
  } else if (obj.id === 'BRAND') {
    if (cur) cur.stacks = Math.min(BRAND_MAX, cur.stacks + 1);
    else { cur = { id: 'BRAND', stacks: 1, dur: null }; st.push(cur); }
  } else if (obj.id === 'WARD') {
    if (cur && cur.amount >= obj.amount) return cur;
    if (cur) st.splice(st.indexOf(cur), 1);
    cur = { ...obj };
    st.push(cur);
  } else if (cur && obj.maxStacks) {
    cur.stacks = Math.min(obj.maxStacks, (cur.stacks || 1) + 1);
    cur.dur = obj.dur;
    cur.tick = obj.tick;
  } else if (cur) {
    Object.assign(cur, obj);
  } else {
    cur = { ...obj };
    if (obj.maxStacks) cur.stacks = 1;
    st.push(cur);
  }
  ev.push({ t: 'status', u, id: obj.id, on: true, dur: cur.dur, stacks: cur.stacks, src: obj.src });
  return cur;
}

export function removeStatus(s, ev, u, id, src) {
  const st = unitSt(s, u);
  for (let i = st.length - 1; i >= 0; i--) {
    if (st[i].id === id && (src === undefined || st[i].src === src)) {
      st.splice(i, 1);
      ev.push({ t: 'status', u, id, on: false, src });
    }
  }
}

/** Dispersal: remove every debuff on the unit (rules 7.4). */
export function dispersal(s, ev, u) {
  const st = unitSt(s, u);
  for (let i = st.length - 1; i >= 0; i--) {
    if (DEBUFFS.includes(st[i].id)) {
      ev.push({ t: 'status', u, id: st[i].id, on: false, src: st[i].src });
      st.splice(i, 1);
    }
  }
}

/** Own debuff stacks for autoplay (rules 7.9): each debuff counts 1, BRAND and POISON count stacks. */
export function debuffStacks(st) {
  let n = 0;
  for (const x of st) if (DEBUFFS.includes(x.id)) n += x.id === 'BRAND' || x.id === 'POISON' ? x.stacks : 1;
  return n;
}

/** STEALTH on the player. gainedMidFight = expires after 1 more round (rules 7.4). */
export function gainStealth(s, ev, midFight) {
  addStatus(s, ev, 'player', { id: 'STEALTH', dur: midFight ? 2 : null });
}

// ---------------- Modifiers ----------------
export const levelMod = (att, tgt) => clamp(1 + LVL_DMG_STEP * (att - tgt), LVL_DMG_MIN, LVL_DMG_MAX);

export function mitigation(armor, attackerLevel) {
  return Math.min(ARMOR_MIT_CAP, armor / (armor + ARMOR_K * attackerLevel + ARMOR_C));
}

/** Damage-taken modifiers of a unit (rules 7.2 step 6), summed. o.isSpell for Brittle. */
function targetPct(s, u, src, o) {
  const st = unitSt(s, u);
  let pct = 0;
  if (u === 'pet') {
    pct -= tr(s, 'h_a5') * TALENT.h_a5.petDr;
    const lead = findSt(st, 'PET_LEAD'); // Send the Pet (rules 7.10, combat v2)
    if (lead) pct -= lead.value;
  }
  if (typeof u !== 'number') return pct;
  for (const x of st) {
    if (x.id === 'EXPOSED' || x.id === 'MARKED') pct += x.value;
    else if (x.id === 'BRACE' || x.id === 'SHIELDED') pct -= x.value;
  }
  const fromPlayer = src === 'player' || src === 'pet';
  if (fromPlayer) {
    if (o.isSpell && (hasSt(st, 'CHILLED') || hasSt(st, 'FROZEN'))) pct += tr(s, 'm_b4') * TALENT.m_b4.pct;
    if (findSt(st, 'BLEED', 'open_vein')) pct += tr(s, 'r_c8') * TALENT.r_c8.pct;
    pct += offBalanceTaken(st); // rules 7.13 (combat v2)
  }
  const e = s.fight.enemies[u];
  // Linked (rules 7.2 step 6, 10.2; M2 v2): -LINK_DR_PER_SHARD per living Shard, at most -LINK_DR.
  if (e.kind === 'boss') pct -= linkedDr(s);
  // Shard brittleness (M2 v2): direct hits of the player's aoe-tagged spells. DOT snapshots carry no spell id,
  // and the pet, basic attacks and items are not aoe-tagged spells, so none of them get it.
  if (e.kind === 'shard' && src === 'player' && o.spell && SPELL[o.spell] && SPELL[o.spell].tags.includes('aoe')) pct += SHARD_AOE_TAKEN;
  return pct;
}

/**
 * OFF_BALANCE damage taken (rules 7.13, combat v2): the status's value (OFFBAL_TAKEN; the end boss OFFBAL_BOSS_TAKEN);
 * a FROZEN enemy counts as OFF_BALANCE (OFFBAL_TAKEN) while FROZEN. Never both.
 */
function offBalanceTaken(st) {
  const ob = findSt(st, 'OFF_BALANCE');
  if (ob) return ob.value;
  return hasSt(st, 'FROZEN') ? OFFBAL_TAKEN : 0;
}

/** Is the enemy open to the OFF_BALANCE crit bonus (OFF_BALANCE, or FROZEN; rules 7.13)? */
export const offBalanceOpen = (e) => !!e && (hasSt(e.st, 'OFF_BALANCE') || hasSt(e.st, 'FROZEN'));

/**
 * The enemy becomes OFF_BALANCE (rules 7.13, combat v2): status duration `dur` (OFFBAL_DURATION when gained by the
 * player's action or an enemy action, one less when gained at the start of a round), refreshed, no stacks; value
 * OFFBAL_TAKEN (end boss OFFBAL_BOSS_TAKEN). why: 'interrupt', 'control' or 'avoided'; act: the action that was
 * stopped or avoided. Sends the status event and an `offBalance` event.
 */
export function gainOffBalance(s, ev, u, dur, why, act) {
  const e = s.fight.enemies[u];
  if (!e || !e.alive || s.fight.over) return;
  addStatus(s, ev, u, { id: 'OFF_BALANCE', dur, value: e.kind === 'boss' ? OFFBAL_BOSS_TAKEN : OFFBAL_TAKEN });
  ev.push({ t: 'offBalance', u, why, id: act ? act.id : null, name: act ? act.name : null, dur });
}

/**
 * One more stack of a wind-up status on enemy u (rules 7.4, 7.12, combat v2.1): EMPOWERED or STAGGERED, no cap, no
 * expiry (dur null; gone with the fight). M2b v13 (D106): value = the sum of its stacks' values (the damage it deals more
 * or less, 7.2 step 2): `per` is this stack's value (DEATHBLOW_EMPOWER for a landed Deathblow, else EMPOWER_DMG or
 * STAGGER_DMG); `deathblows` and `deathblowValue` count the stacks from Deathblows and their share of `value` (the UI's
 * "+100 %").
 */
function windupStack(s, ev, u, id, per, deathblow) {
  const st = unitSt(s, u);
  let cur = findSt(st, id);
  if (!cur) {
    cur = { id, dur: null, stacks: 0, value: 0, deathblows: 0, deathblowValue: 0 };
    st.push(cur);
  }
  cur.stacks += 1;
  cur.value += per;
  if (deathblow) {
    cur.deathblows += 1;
    cur.deathblowValue += per;
  }
  ev.push({ t: 'status', u, id, on: true, dur: null, stacks: cur.stacks });
  return cur;
}

/**
 * A wind-up of enemy u was answered (rules 7.12, combat v2.1): interrupted, cancelled by control at its turn's start
 * (STUN, FROZEN, HEXED, SAPPED; a trap; Disrupt), replaced because SILENCED, or a heavy one that cost the player 0 HP
 * (7.13 (3)). The enemy gains a STAGGERED stack (-STAGGER_DMG damage dealt for the rest of the fight). x: the entry or
 * intent (nothing unless x.windup); why: 'interrupt' | 'control' | 'trap' | 'disrupt' | 'silenced' | 'avoided'; by:
 * the spell or engage option, the control status, or null. Sends the status event and a `stagger` event.
 */
export function answerWindup(s, ev, u, x, why, by) {
  const e = s.fight.enemies[u];
  if (!x || !x.windup || !e || !e.alive || s.fight.over) return;
  const db = !!x.deathblow;
  const cur = windupStack(s, ev, u, 'STAGGERED', STAGGER_DMG, db);
  const out = { t: 'stagger', u, id: x.id, name: x.name, turn: x.turn, why, by: by === undefined ? null : by, stacks: cur.stacks, value: cur.value };
  if (db) out.deathblow = true; // M2b v13: "Deathblow answered: staggered"
  ev.push(out);
}

/**
 * A wind-up of enemy u landed (rules 7.12, combat v2.1): played, and for a hit or rend the player or the pet lost HP to
 * it (cleave, curse, self_heal and self_shield whenever played). The enemy gains an EMPOWERED stack (+EMPOWER_DMG damage
 * dealt for the rest of the fight). Nothing once the fight is over (the hit killed the player). Sends the status event
 * and an `empower` event.
 * M2b v13 (D106, D107): a Deathblow's stack is worth DEATHBLOW_EMPOWER, and it MAIMS the player for the rest of the fight
 * (status MAIMED, dur null, value MAIM_HEAL; one status, no stacks: a second Deathblow in the fight changes nothing; not
 * a debuff, so dispersal and a resurrect keep it). The `empower` event then has `deathblow: true` and `maimed` (true when
 * this Deathblow maimed the player).
 */
export function landWindup(s, ev, u, x) {
  const e = s.fight.enemies[u];
  if (!x || !x.windup || !e || !e.alive || s.fight.over) return;
  const db = !!x.deathblow;
  const cur = windupStack(s, ev, u, 'EMPOWERED', db ? DEATHBLOW_EMPOWER : EMPOWER_DMG, db);
  const out = { t: 'empower', u, id: x.id, name: x.name, turn: x.turn, stacks: cur.stacks, value: cur.value };
  if (db) {
    out.deathblow = true;
    out.maimed = !findSt(s.fight.p.st, 'MAIMED');
    if (out.maimed) addStatus(s, ev, 'player', { id: 'MAIMED', dur: null, value: MAIM_HEAL, by: u, src: x.id, name: x.name });
  }
  ev.push(out);
}

/**
 * Healing the player receives while MAIMED (rules 7.4, 7.5, M2b v13, D107): amount × (1 - MAIMED value), rounded once,
 * before the cap at max HP; the amount itself when not MAIMED or outside a fight. healUnit applies it to every heal on
 * the player (potions, the free potion, heal spells, HOTs, heal-on-kill); potionInfo shows it.
 */
export function maimedHeal(s, amount) {
  const m = s.fight ? findSt(s.fight.p.st, 'MAIMED') : null;
  return m ? rnd(amount * (1 - m.value)) : amount;
}

/** EMPOWERED minus STAGGERED (rules 7.2 step 2, 7.12, combat v2.1): the lasting result of the enemy's wind-ups. */
export function windupPct(st) {
  const em = findSt(st, 'EMPOWERED');
  const sg = findSt(st, 'STAGGERED');
  return (em ? em.value : 0) - (sg ? sg.value : 0);
}

/** Living (not despawned) Shards of the end-boss fight. */
export const livingShards = (s) => s.fight.enemies.filter((x) => x.alive && x.kind === 'shard').length;

/** Linked damage reduction of the end boss now (rules 10.2): min(LINK_DR, LINK_DR_PER_SHARD × living Shards). */
export function linkedDr(s) {
  return Math.min(LINK_DR, LINK_DR_PER_SHARD * livingShards(s));
}

/** Player outgoing % modifiers that do not depend on the spell (boons, elixir, uniques, talents, buffs). */
export function playerPct(s, tgt) {
  const p = s.player;
  const f = s.fight;
  let pct = 0;
  if (p.buffs.fury && p.buffs.fury.active) pct += BOON_DMG_PCT;
  if (p.buffs.elixir && p.buffs.elixir.active) pct += ELIXIR_DMG_PCT;
  if (typeof tgt === 'number' && isEliteOrBoss(f.enemies[tgt])) pct += UNIQUE_ELITE_DMG * hasEffect(s, 'eliteDmg');
  if (p.classId === 'hunter') {
    if (petAlive(s)) pct += tr(s, 'h_a6') * TALENT.h_a6.pct;
    if (p.hp < TALENT.h_c8.below * p.d.maxHp) pct += tr(s, 'h_c8') * TALENT.h_c8.pct;
    const rv = findSt(f.p.st, 'RAPID');
    if (rv) pct += rv.value;
  }
  return pct;
}

/** Pet outgoing % modifiers. */
export function petPct(s) {
  const p = s.player;
  let pct = tr(s, 'h_a2') * TALENT.h_a2.petDmgPct + tr(s, 'h_a6') * TALENT.h_a6.pct;
  if (p.buffs.fury && p.buffs.fury.active) pct += BOON_DMG_PCT;
  if (p.buffs.elixir && p.buffs.elixir.active) pct += ELIXIR_DMG_PCT;
  const wc = findSt(s.fight.p.st, 'COMMUNION');
  if (wc) pct += wc.value;
  return pct;
}

/** Enemy outgoing % modifiers (enrage, soft enrage, Eclipse, Crippling Toxin, Bloodlust, EMPOWERED and STAGGERED). */
function enemyPct(s, e) {
  const f = s.fight;
  let pct = e.enraged || 0;
  if (f.kind !== 'boss' && f.round >= FIGHT_SOFT_ENRAGE_ROUND) pct += FIGHT_SOFT_ENRAGE_STEP * (f.round - FIGHT_SOFT_ENRAGE_ROUND + 1);
  if (e.kind === 'boss' && f.boss && f.boss.phase === 3) pct += ECLIPSE_STEP * f.boss.eclipse;
  const poison = findSt(e.st, 'POISON');
  if (poison) pct -= tr(s, 'r_c4') * TALENT.r_c4.pct;
  pct += bloodlust(e);
  pct += windupPct(e.st); // combat v2.1: +EMPOWER_DMG per EMPOWERED stack, -STAGGER_DMG per STAGGERED stack (rules 7.12)
  return pct;
}

/** Bloodlust (rules 7.12, combat v2): a beast deals +BLOODLUST_STEP per turn it has acted, at most BLOODLUST_MAX. */
export function bloodlust(e) {
  return e.arch === 'beast' ? Math.min(BLOODLUST_MAX, BLOODLUST_STEP * (e.acted || 0)) : 0;
}

/** Multiplier from CHILLED / CURSED on the attacker (rules 7.2 step 2). */
function attackerDebuffMult(st) {
  let m = 1;
  const ch = findSt(st, 'CHILLED');
  if (ch) m *= 1 - ch.value;
  if (hasSt(st, 'CURSED')) m *= 1 - CURSE_PCT;
  return m;
}

/**
 * The end-boss fight's damage factor (rules 10.1, M2b v6, D64): BOSS_DMG_MULT × (1 + asc) on every damage an enemy of
 * the end-boss fight deals (Oruvath, the Shards; the Brand's ticks in combat.js), also at Ascendancy 0. In every other
 * fight (dungeon bosses, Camp waves, Dimmed encounters) only (1 + asc), and those enemies have asc 0.
 */
export function bossDmgFactor(s, asc) {
  return s.fight && s.fight.kind === 'boss' ? BOSS_DMG_MULT * (1 + (asc || 0)) : 1 + (asc || 0);
}

/** Steps 1-2 and 6 of the pipeline: the snapshot used for DOT ticks and intent estimates. */
export function snapshot(s, src, dst, base, o = {}) {
  let mult = 1 + (o.pct || 0);
  if (src === 'player') mult += playerPct(s, dst) + schoolPct(s, o.school);
  else if (src === 'pet') mult += petPct(s);
  else mult += enemyPct(s, s.fight.enemies[src]);
  let x = base * mult * levelMod(unitLevel(s, src), unitLevel(s, dst));
  x *= attackerDebuffMult(unitSt(s, src === 'pet' ? 'pet' : src));
  // Ascendancy (rules 1.7) and, in the end-boss fight, BOSS_DMG_MULT (rules 10.1, M2b v6): at asc 0 too.
  if (typeof src === 'number' && (s.fight.kind === 'boss' || s.fight.enemies[src].asc)) x *= bossDmgFactor(s, s.fight.enemies[src].asc);
  x *= Math.max(0, 1 + targetPct(s, dst, src, o));
  return x;
}

function schoolPct(s, school) {
  if (school === 'fire') return tr(s, 'm_a1') * TALENT.m_a1.pct;
  return 0;
}

export function critChance(s, src, dst, o) {
  if (typeof src === 'number') return ENEMY_CRIT;
  const d = s.player.d;
  if (src === 'pet') return d.petCrit;
  let c = d.crit + (o.critBonus || 0);
  if (o.school === 'fire') {
    c += tr(s, 'm_a2') * TALENT.m_a2.crit;
    if (findSt(s.fight.p.st, 'CONFLAGRANT')) c += findSt(s.fight.p.st, 'CONFLAGRANT').value;
  }
  if (typeof dst === 'number' && hasSt(s.fight.enemies[dst].st, 'FROZEN')) c += tr(s, 'm_b6') * TALENT.m_b6.crit;
  if (typeof dst === 'number' && offBalanceOpen(s.fight.enemies[dst])) c += OFFBAL_CRIT; // rules 7.13 (combat v2)
  return c;
}

export function critMult(s, src) {
  if (src === 'player') return s.player.d.critMult;
  return CRIT_MULT;
}

function dodgeOf(s, u) {
  if (u === 'player') {
    const ev = findSt(s.fight.p.st, 'EVASION');
    return Math.min(DODGE_CAP, s.player.d.dodgeRaw + (ev ? ev.value : 0));
  }
  if (u === 'pet') return 0;
  const e = s.fight.enemies[u];
  return hasSt(e.st, 'OFF_BALANCE') ? 0 : e.dodge; // OFF_BALANCE: dodge 0 (rules 7.13, combat v2)
}

function armorOf(s, u) {
  if (u === 'player') return s.player.d.armor;
  if (u === 'pet') return s.player.d.petArmor;
  return s.fight.enemies[u].armor;
}

/**
 * One damage event (rules 7.2). Exactly 3 draws (r1 miss, r2 crit, r3 variance), also on a miss.
 * o: { base, school ('phys' or a magic school), spell (log id), pct (extra attacker %), critBonus,
 *      isSpell, noMiss, ignoreWard, ignoreImmune, multi (base multiplier before mods) }
 * Returns { hit, dodged, crit, raw, amount (HP lost), absorbed, killed }.
 */
export function damage(s, ev, src, dst, o) {
  const f = s.fight;
  const rng = f.rng;
  const phys = o.school === 'phys';
  const attL = unitLevel(s, src);
  const tgtL = unitLevel(s, dst);
  const base = o.base * (o.multi || 1);
  const pre = snapshot(s, src, dst, 1, o); // multiplier from steps 2 and 6 (applied below in pipeline order)
  // Step 3: miss
  const r1 = nextFloat(rng);
  const baseMiss = Math.min(MISS_CAP, MISS_BASE + MISS_PER_LEVEL * Math.max(0, tgtL - attL));
  const dodge = phys ? dodgeOf(s, dst) : 0;
  const stealth = typeof src === 'number' && dst === 'player' && hasSt(f.p.st, 'STEALTH') ? STEALTH_MISS_BONUS : 0;
  const r2 = nextFloat(rng);
  const r3 = nextFloat(rng);
  if (!o.noMiss && r1 < baseMiss + dodge + stealth) {
    const dodged = r1 >= baseMiss && r1 < baseMiss + dodge;
    ev.push({ t: 'miss', src, dst, spell: o.spell, dodge: dodged });
    if (dodged && dst === 'player' && tr(s, 'r_a4')) f.p.riposte = true;
    return { hit: false, dodged, crit: false, raw: 0, amount: 0, absorbed: 0, killed: false };
  }
  // Steps 1, 2, 6 (snapshot), 4 crit, 5 variance, 7 mitigation, 8 round
  let x = base * pre;
  const crit = r2 < critChance(s, src, dst, o);
  if (crit) x *= critMult(s, src);
  x *= 1 - DMG_VARIANCE + 2 * DMG_VARIANCE * r3;
  if (phys) x *= 1 - mitigation(armorOf(s, dst), attL);
  const raw = Math.max(MIN_HIT_DAMAGE, rnd(x));
  const res = applyDamage(s, ev, src, dst, raw, { spell: o.spell, crit, school: o.school, ignoreWard: o.ignoreWard, ignoreImmune: o.ignoreImmune });
  res.hit = true;
  res.crit = crit;
  res.raw = raw;
  if (src === 'player' && crit) afterPlayerCrit(s, ev, dst, raw, o);
  if (src === 'pet' && crit && tr(s, 'h_a4')) gainResource(s, ev, tr(s, 'h_a4') * TALENT.h_a4.focus);
  return res;
}

function afterPlayerCrit(s, ev, dst, raw, o) {
  const f = s.fight;
  const ig = tr(s, 'm_a5');
  if (ig && o.school === 'fire' && typeof dst === 'number' && f.enemies[dst].alive) {
    const rounds = TALENT.m_a5.rounds;
    addStatus(s, ev, dst, { id: 'BURN', src: 'ignite', dur: rounds, tick: Math.max(MIN_HIT_DAMAGE, rnd((raw * ig * TALENT.m_a5.pct) / rounds)), canCrit: false });
  }
  const hh = tr(s, 'm_a8');
  if (hh) addStatus(s, ev, 'player', { id: 'WARD', dur: null, amount: rnd(hh * TALENT.m_a8.wardPct * s.player.d.maxHp), src: 'heat_haze' });
}

/** Focus or energy gain (capped), used by talents and spells. */
export function gainResource(s, ev, n) {
  const f = s.fight;
  const cls = s.player.classId;
  if (cls === 'hunter') f.p.focus = Math.min(f.p.focusMax, f.p.focus + n);
  else if (cls === 'rogue') f.p.energy = Math.min(f.p.energyMax, f.p.energy + n);
}

/**
 * Apply HP damage after rolls: WARD/shield, IMMUNE, Mindguard, Shared Wounds, Death's Sidestep, then HP and
 * death checks. Used by damage events and DOT ticks. Returns { amount, hpLost, absorbed, killed }.
 * Event fields: amount = damage after absorbs, not capped at the HP left (a killing blow can exceed it);
 * hpLost = HP the target actually lost (min(amount, HP before)); absorbed = taken by WARD, shield or Mindguard.
 */
export function applyDamage(s, ev, src, dst, raw, o = {}) {
  const f = s.fight;
  let dmg = raw;
  let absorbed = 0;
  if (dst === 'player') {
    // Dev tools (engine-api.md 12, dev runs only): god mode is a lasting IMMUNE that Final Dark does not pierce.
    if (s.dev && s.dev.god) {
      ev.push({ t: 'damage', src, dst, amount: 0, hpLost: 0, absorbed: 0, immune: true, god: true, spell: o.spell, crit: !!o.crit, school: o.school, tick: !!o.tick });
      return { amount: 0, hpLost: 0, absorbed: 0, killed: false };
    }
    if (!o.ignoreImmune && hasSt(f.p.st, 'IMMUNE')) {
      ev.push({ t: 'damage', src, dst, amount: 0, hpLost: 0, absorbed: 0, immune: true, spell: o.spell, crit: !!o.crit, school: o.school, tick: !!o.tick });
      return { amount: 0, hpLost: 0, absorbed: 0, killed: false };
    }
    const ward = o.ignoreWard ? null : findSt(f.p.st, 'WARD');
    if (ward) {
      absorbed = Math.min(ward.amount, dmg);
      ward.amount -= absorbed;
      dmg -= absorbed;
      if (ward.amount <= 0) {
        removeStatus(s, ev, 'player', 'WARD');
        if (ward.lattice && typeof src === 'number' && f.enemies[src].alive) {
          addStatus(s, ev, src, { id: 'CHILLED', dur: TALENT.m_b7.chill, value: CHILL_PCT + tr(s, 'm_b3') * TALENT.m_b3.chill });
        }
      }
    }
    const mg = tr(s, 'm_c7');
    if (mg && dmg > 0) {
      let part = rnd(TALENT.m_c7.share * dmg);
      part = Math.min(part, Math.floor(s.player.mana / TALENT.m_c7.manaPerDmg));
      s.player.mana -= part * TALENT.m_c7.manaPerDmg;
      dmg -= part;
      absorbed += part;
    }
    if (tr(s, 'h_a8') && dmg > 0 && petAlive(s)) {
      const moved = rnd(TALENT.h_a8.share * dmg);
      dmg -= moved;
      if (moved > 0) applyDamage(s, ev, src, 'pet', moved, { spell: 'shared_wounds' });
    }
    if (dmg > 0 && tr(s, 'r_b9') && !f.p.sidestepUsed && s.player.hp - dmg < TALENT.r_b9.below * s.player.d.maxHp) {
      f.p.sidestepUsed = true;
      ev.push({ t: 'damage', src, dst, amount: 0, hpLost: 0, absorbed: dmg, sidestep: true, spell: o.spell, school: o.school });
      dispersal(s, ev, 'player');
      gainStealth(s, ev, true);
      healUnit(s, ev, 'player', rnd(TALENT.r_b9.healPct * s.player.d.maxHp), 'deaths_sidestep');
      return { amount: 0, hpLost: 0, absorbed: dmg, killed: false };
    }
    const hpLost = Math.min(dmg, s.player.hp);
    s.player.hp -= dmg;
    s.stats.dmgTaken += dmg;
    ev.push({ t: 'damage', src, dst, amount: dmg, hpLost, absorbed, spell: o.spell, crit: !!o.crit, school: o.school, tick: !!o.tick });
    if (s.player.hp <= 0) {
      s.player.hp = 0;
      playerDeath(s, ev, src, o.spell);
    }
    return { amount: dmg, hpLost, absorbed, killed: s.player.hp <= 0 };
  }
  if (dst === 'pet') {
    const pet = s.player.pet;
    if (!pet.alive) return { amount: 0, hpLost: 0, absorbed: 0, killed: false };
    const hpLost = Math.min(dmg, pet.hp);
    pet.hp -= dmg;
    ev.push({ t: 'damage', src, dst, amount: dmg, hpLost, absorbed: 0, spell: o.spell, crit: !!o.crit, school: o.school, tick: !!o.tick });
    if (pet.hp <= 0) {
      pet.hp = 0;
      pet.alive = false;
      f.pet.st = [];
      ev.push({ t: 'death', u: 'pet' });
    }
    return { amount: dmg, hpLost, absorbed: 0, killed: !pet.alive };
  }
  // Enemy
  const e = f.enemies[dst];
  if (!e.alive) return { amount: 0, hpLost: 0, absorbed: 0, killed: false };
  if (raw > 0) {
    removeStatus(s, ev, dst, 'HEXED');
    removeStatus(s, ev, dst, 'SAPPED'); // Sap breaks on any damage, DOT ticks and AoE included (rules 7.10)
  }
  if (e.shield > 0) {
    absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    dmg -= absorbed;
  }
  const dealt = Math.min(dmg, e.hp);
  e.hp -= dmg;
  if (src === 'player' || src === 'pet') {
    s.stats.dmgDealt += dealt;
    const key = src === 'pet' ? 'pet' : o.spell || 'other';
    s.stats.spellDmg[key] = (s.stats.spellDmg[key] || 0) + dealt;
  }
  ev.push({ t: 'damage', src, dst, amount: dmg, hpLost: dealt, absorbed, spell: o.spell, crit: !!o.crit, school: o.school, tick: !!o.tick });
  if (e.hp < 0) e.hp = 0;
  if (e.kind === 'boss') onBossDamaged(s, ev);
  if (e.hp <= 0) {
    enemyDeath(s, ev, dst);
    return { amount: dmg, hpLost: dealt, absorbed, killed: true };
  }
  checkEnrage(s, ev, e);
  return { amount: dmg, hpLost: dealt, absorbed, killed: false };
}

/** Template ability "enrage" (rules 12.4): once, passive, below 30 % HP the enemy deals +pct damage. */
function checkEnrage(s, ev, e) {
  if (e.enraged || !e.alive) return;
  for (const abId of e.abilities) {
    const ab = s.content.abilities[abId];
    if (ab.template === 'enrage' && e.hp < ABILITY_TEMPLATE.enrage.below * e.maxHp) {
      e.enraged = ab.pct;
      ev.push({ t: 'enrage', u: e.idx, name: ab.name, pct: ab.pct });
    }
  }
}

/**
 * Heal a unit (no rolls, no crit). Returns the amount restored. The heal event is sent only when HP is
 * restored (amount > 0): a heal at full health sends none.
 */
export function healUnit(s, ev, u, amount, spell) {
  if (!(amount > 0)) return 0;
  if (u === 'player') {
    // M2b v13 (D107): MAIMED cuts every heal on the player before the cap; the event says so (`maimed`).
    const maimed = !!(s.fight && findSt(s.fight.p.st, 'MAIMED'));
    const n = Math.min(maimed ? maimedHeal(s, amount) : amount, s.player.d.maxHp - s.player.hp);
    s.player.hp += n;
    if (n > 0) ev.push(maimed ? { t: 'heal', dst: 'player', amount: n, spell, maimed: true } : { t: 'heal', dst: 'player', amount: n, spell });
    return n;
  }
  if (u === 'pet') {
    const pet = s.player.pet;
    if (!pet || !pet.alive) return 0;
    const n = Math.min(amount, s.player.d.petMaxHp - pet.hp);
    pet.hp += n;
    if (n > 0) ev.push({ t: 'heal', dst: 'pet', amount: n, spell });
    return n;
  }
  const e = s.fight.enemies[u];
  if (!e.alive) return 0;
  const n = Math.min(amount, e.maxHp - e.hp);
  e.hp += n;
  if (n > 0) ev.push({ t: 'heal', dst: u, amount: n, spell });
  return n;
}

// ---------------- Kills ----------------
function killXpMult(e) {
  if (e.kind === 'elite') return ELITE_XP_MULT;
  if (e.kind === 'rare') return RARE_XP_MULT;
  if (e.kind === 'dboss') return DUNGEON_BOSS_XP_MULT;
  if (e.kind === 'trash') return DUNGEON_MOB_XP_MULT;
  if (e.kind === 'shardspawn') return DIM_XP_MULT; // rules 1.9.6 (expedition)
  return 1;
}

function enemyDeath(s, ev, idx) {
  const f = s.fight;
  const e = f.enemies[idx];
  e.alive = false;
  e.intent = null;
  e.track = [];
  ev.push({ t: 'death', u: idx, name: e.name });
  if (e.kind === 'boss') {
    s.stats.kills.boss += 1;
    f.over = 'victory';
    return;
  }
  if (e.kind === 'shard') {
    if (!livingShards(s)) ev.push({ t: 'linked', on: false, n: 0 });
    return;
  }
  if (e.noReward) {
    // A Signal reinforcement (rules 7.12, combat v2): no XP, coin or loot.
    s.stats.kills.normal += 1;
    if (!f.enemies.some((x) => x.alive)) f.over = 'victory';
    return;
  }
  // Kill rewards (rules 2.0, 4.4, 8.4, 8.5): XP, coin, drops. Expedition (1.9.8): XP × XP_WEIGHT_MULT; a Shardspawn
  // (1.9.6) gives XP × DIM_XP_MULT and no coin or loot. M2b v11 (D91, D92): a normal or trash kill's item and junk chance
  // × EXPED_DROP_MULT (with the node's GRIND_DROP_MULT), a dungeon boss EXPED_DUNGEON_BOSS_DROPS rolls.
  const xp = eventXp(s, MOB_XP_FRAC * killXpMult(e) * xpWeight(s), e.level);
  gainXp(s, ev, xp, 'kill', true);
  if (e.kind === 'elite' || e.kind === 'rare') gainGold(s, ev, ELITE_GOLD_V * V(e.level), 'kill');
  else if (e.kind !== 'shardspawn') gainGold(s, ev, MOB_COIN_V * V(e.level), 'kill');
  const lr = s.lootRng;
  const z = f.z;
  if (e.kind === 'shardspawn') {
    s.stats.kills.normal += 1;
  } else if (e.kind === 'elite' || e.kind === 'rare') {
    f.drops.push(...rollDrop(s, lr, e.kind, e.level, z));
    if (nextFloat(lr) < EMBER_ELITE_DROP_CHANCE) f.drops.push(makeConsumable(s, 'ember_of_return'));
    s.stats.kills[e.kind] += 1;
  } else if (e.kind === 'dboss') {
    for (let i = 0, n = bossDropRolls(s); i < n; i++) f.drops.push(...rollDrop(s, lr, 'dboss', e.level, z));
    s.stats.kills.boss += 1;
  } else {
    f.drops.push(...rollDrop(s, lr, e.kind === 'trash' ? 'trash' : 'mob', e.level, z, (f.dropMult || 1) * killDropMult(s)));
    s.stats.kills.normal += 1;
  }
  const heal = hasEffect(s, 'healOnKill');
  if (heal) healUnit(s, ev, 'player', rnd(UNIQUE_HEAL_ON_KILL * heal * s.player.d.maxHp), 'unique');
  // Plague Heart (r_c9): POISON and Open Vein copy to every other enemy (full duration).
  if (tr(s, 'r_c9')) {
    const poison = findSt(e.st, 'POISON');
    const vein = findSt(e.st, 'BLEED', 'open_vein');
    if (poison) {
      for (const o of f.enemies) {
        if (!o.alive || o.idx === idx) continue;
        const cur = findSt(o.st, 'POISON');
        if (cur) { cur.stacks = Math.max(cur.stacks, poison.stacks); cur.dur = poison.full; }
        else o.st.push({ ...poison, dur: poison.full });
        if (vein) {
          const v = findSt(o.st, 'BLEED', 'open_vein');
          if (v) Object.assign(v, { ...vein, dur: vein.full });
          else o.st.push({ ...vein, dur: vein.full });
        }
        ev.push({ t: 'status', u: o.idx, id: 'POISON', on: true, spread: true });
      }
    }
  }
  if (!f.enemies.some((x) => x.alive)) f.over = 'victory';
}

// ---------------- Death and resurrection ----------------
/**
 * Resurrect charges a death would use, in the order they are used (rules 9): Boon of Return, Second Breath
 * (meta; not in the end-boss fight, M2 v3), Ember of Return. None under the Oath of Frailty (rules 11.5).
 * endBoss: the death happens in the end-boss fight.
 */
export function resurrectOrder(s, endBoss) {
  if (s.oaths.includes('frailty')) return [];
  const p = s.player;
  const out = [];
  for (let i = 0; i < p.res.boon; i++) out.push('boon');
  if (!endBoss) for (let i = 0; i < p.res.meta; i++) out.push('second_breath');
  for (let i = countConsumable(s, 'ember_of_return'); i > 0; i--) out.push('ember');
  return out;
}

function playerDeath(s, ev, killer, spell) {
  const f = s.fight;
  const p = s.player;
  // M3 guided run (m3-onboarding.md 2.6, E3): in the guided zone a death is a rescue, before any resurrect charge.
  if (rescueCovers(s)) {
    f.over = 'rescue';
    const r = rescueTarget(s);
    ev.push({ t: 'rescue', tolls: ONB_RESCUE_TOLLS, node: r.node, to: r.to, hp: p.d.maxHp, mana: p.d.maxMana });
    return;
  }
  // In the end-boss fight Second Breath is skipped; it stays unused (M2 v3).
  const source = resurrectOrder(s, f.kind === 'boss')[0] || null;
  if (source === 'boon') p.res.boon -= 1;
  else if (source === 'second_breath') p.res.meta -= 1;
  else if (source === 'ember') takeConsumable(s, 'ember_of_return', 1);
  if (source) {
    p.hp = Math.max(1, rnd(RES_HP_PCT * p.d.maxHp));
    if (p.d.maxMana) p.mana = rnd(RES_MANA_PCT * p.d.maxMana);
    dispersal(s, ev, 'player');
    s.stats.resUsed += 1;
    ev.push({ t: 'resurrect', source, hp: p.hp, mana: p.mana });
    return;
  }
  f.over = 'death';
  const node = s.node;
  s.death = {
    zone: s.zone ? s.zone.z : null,
    row: node && node.r !== undefined ? node.r : null,
    lane: node && node.l !== undefined ? node.l : null,
    nodeType: f.kind === 'boss' ? 'boss' : f.kind === 'camp' ? 'camp' : node ? node.type : null,
    fightIdx: f.k,
    enemies: f.enemies.map((x) => x.tid),
    round: f.round,
    killer: typeof killer === 'number' ? { idx: killer, name: f.enemies[killer].name, ability: spell || null } : { idx: null, name: String(killer), ability: spell || null },
  };
  // Expedition (rules 1.9.6, 9): the node id and ring; a Dimmed encounter has nodeType 'dim' and its depth.
  if (isExpedition(s) && s.zone && !s.zone.camp) {
    const id = node ? node.id : s.zone.pos;
    Object.assign(s.death, { node: id, ring: s.zone.nodes[id].ring, depth: node && node.type === 'dim' ? node.depth : null });
  }
  ev.push({ t: 'death', u: 'player' });
}
