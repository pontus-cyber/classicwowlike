// Player combat actions (rules 5, 6, 7.1 step 2, 7.3, 7.5, 7.7, 7.8) and the pet action (5.5).
import {
  SPELL, CLASS, TALENT, PET, CP_MAX, ENGINE_ASSUMPTION as EA, CHILL_PCT, CONSUMABLE, POTION_CD,
  UNIQUE_PROC_CHANCE, UNIQUE_PROC_BASE, UNIQUE_PROC_PER_LEVEL, UNIQUE_POTION_PCT, FLEE_BASE,
  FLEE_PER_EXTRA_ENEMY, MIN_HIT_DAMAGE,
} from '../constants.js';
import { nextFloat } from '../rng.js';
import { rnd } from './util.js';
import { tr, hasEffect } from './stats.js';
import {
  damage, snapshot, addStatus, removeStatus, findSt, hasSt, petAlive, healUnit, dispersal, gainStealth,
  gainResource, livingEnemies,
} from './damage.js';
import { interruptBoss } from './boss.js';
import { defaultTarget } from './combat.js';
import { countConsumable, takeConsumable } from './items.js';

// ---------------- Spell facts ----------------
export function knowsSpell(s, id) {
  return !!s.player.spells[id];
}

/** Trained level: talent spells always use tl = L (rules 5.2). */
export function spellTl(s, id) {
  if (SPELL[id].source === 'talent') return s.player.level;
  return s.player.spells[id].tl;
}

/** Resource cost after talents and free-cast effects (rules 7.3). Mage: round(cost% × base mana). */
export function spellCost(s, id) {
  const sp = SPELL[id];
  const f = s.fight;
  if (s.player.classId === 'mage') {
    if (f && f.p.lucid) return 0;
    if (f && sp.school === 'fire' && hasSt(f.p.st, 'CONFLAGRANT')) return 0;
    let frac = sp.cost;
    if (id === 'ember_bolt') frac -= tr(s, 'm_a4') * TALENT.m_a4.cost;
    return rnd(Math.max(0, frac) * s.player.d.baseMana);
  }
  let c = sp.cost;
  if (id === 'gutting_jab') c -= tr(s, 'r_a2') * TALENT.r_a2.cost;
  if (id === 'temple_blow') c -= tr(s, 'r_b5') * TALENT.r_b5.cost;
  if (id === 'keen_shot' || id === 'heartseeker_shot') c -= tr(s, 'h_b3') * TALENT.h_b3.cost;
  return Math.max(0, c);
}

/** Cooldown in rounds after talents. */
export function spellCd(s, id) {
  let cd = SPELL[id].cd;
  if (id === 'temple_blow') cd -= tr(s, 'r_b5') * TALENT.r_b5.cd;
  if (id === 'vanishing_step') cd -= tr(s, 'r_b7') * TALENT.r_b7.cd;
  if (id === 'rime_burst') cd -= tr(s, 'm_b5') * TALENT.m_b5.cd;
  if (id === 'spellsnap') cd -= tr(s, 'm_c5') * TALENT.m_c5.cd;
  if (id === 'pyre_comet') cd -= tr(s, 'm_a6') * TALENT.m_a6.cd;
  if (id === 'glacial_tomb') cd -= tr(s, 'm_b8') * TALENT.m_b8.cd;
  if (id === 'savage_order') cd -= tr(s, 'h_a7') * TALENT.h_a7.cd;
  if (id === 'rapid_volley') cd -= tr(s, 'h_b7') * TALENT.h_b7.cd;
  if (id === 'snare_trap') cd -= tr(s, 'h_c3') * TALENT.h_c3.cd;
  return Math.max(0, cd);
}

function resourceOf(s) {
  const f = s.fight;
  const cls = CLASS[s.player.classId].resource;
  if (cls === 'energy') return f.p.energy;
  if (cls === 'focus') return f.p.focus;
  return s.player.mana;
}

function pay(s, n) {
  const f = s.fight;
  const cls = CLASS[s.player.classId].resource;
  if (cls === 'energy') f.p.energy -= n;
  else if (cls === 'focus') f.p.focus -= n;
  else s.player.mana -= n;
}

export const isFinisher = (id) => SPELL[id].tags.includes('finisher');
export const isOpener = (id) => SPELL[id].tags.includes('opener');
const isDamaging = (id) => !!SPELL[id].school || !!SPELL[id].dot;

/** Why a spell cannot be cast now (null = castable). Bar membership is checked by the caller. */
export function castError(s, id, tgt) {
  const sp = SPELL[id];
  const f = s.fight;
  if (!sp || sp.cls !== s.player.classId) return `unknown spell ${id}`;
  if (!knowsSpell(s, id)) return `${id} is not known`;
  if ((f.p.cds[id] || 0) > f.round) return `${id} is on cooldown`;
  if (resourceOf(s) < spellCost(s, id)) return `not enough resource for ${id}`;
  if (isOpener(id) && !hasSt(f.p.st, 'STEALTH')) return `${id} requires STEALTH`;
  if (isFinisher(id) && f.p.cp < 1) return `${id} needs a combo point`;
  if ((id === 'savage_order' || id === 'wild_communion') && !petAlive(s)) return `${id} needs a live pet`;
  if ((id === 'mend_companion' || id === 'beastcall_horn') && !s.player.pet) return `${id} needs a pet`;
  if (sp.target === 'enemy') {
    if (typeof tgt !== 'number' || !f.enemies[tgt] || !f.enemies[tgt].alive) return `${id} needs a living enemy target`;
  }
  return null;
}

// ---------------- Helpers ----------------
function base(s, sp, tl, cp = 1) {
  const d = s.player.d;
  let x = (sp.b || 0) + (sp.l || 0) * tl + (sp.p || 0) * d.power;
  if (sp.perCp) x *= cp;
  return x + (sp.w || 0) * d.wd + (sp.wFlat || 0) * d.wd;
}

function gjAmount(s) {
  return base(s, SPELL.gutting_jab, s.player.spells.gutting_jab ? s.player.spells.gutting_jab.tl : s.player.level);
}

const poisonStacks = (e) => {
  const p = findSt(e.st, 'POISON');
  return p ? p.stacks : 0;
};

/** Interrupt-tagged spells (Throat Jab, Spellsnap, Muzzle Shot) never miss and cannot be dodged (rules 7.2 step 3, M2 v2). */
const alwaysHits = (id) => !!(SPELL[id] && SPELL[id].tags.includes('interrupt'));

/** One direct player hit plus on-hit effects (Toxic Coating, unique procs). */
function pHit(s, ev, tgt, b, o) {
  const f = s.fight;
  if (tgt === null || !f.enemies[tgt] || !f.enemies[tgt].alive) return null;
  const pct = (o.pct || 0) + f.p.niBonus + (o.isSpell ? f.p.momBonus : 0);
  // The miss draw r1 is still made (damage() always draws r1-r3), so stream positions do not change.
  const noMiss = o.noMiss || alwaysHits(o.spell);
  const res = damage(s, ev, 'player', tgt, { ...o, base: b, pct, noMiss });
  if (res.hit && TALENT.r_c1.spells.includes(o.spell) && tr(s, 'r_c1') && f.enemies[tgt].alive) applyPoison(s, ev, tgt);
  const procs = hasEffect(s, 'proc');
  for (let i = 0; i < procs; i++) {
    const r = nextFloat(f.rng);
    if (res.hit && r < UNIQUE_PROC_CHANCE && f.enemies[tgt].alive && !f.over) {
      damage(s, ev, 'player', tgt, { base: UNIQUE_PROC_BASE + UNIQUE_PROC_PER_LEVEL * s.player.level, school: 'magic', spell: 'unique_proc' });
    }
  }
  return res;
}

function dotPct(s) {
  return tr(s, 'r_c5') >= 2 ? TALENT.r_c5.rank2DotPct : 0;
}

function applyPoison(s, ev, tgt) {
  const rank = tr(s, 'r_c1');
  const T = TALENT.r_c1;
  const L = s.player.level;
  const tick = Math.max(MIN_HIT_DAMAGE, rnd(snapshot(s, 'player', tgt, (T.b + T.l * L + T.p * s.player.d.power) * rank, { pct: dotPct(s) + s.fight.p.niBonus })));
  addStatus(s, ev, tgt, { id: 'POISON', dur: T.rounds, full: T.rounds, tick, max: T.maxStacks + tr(s, 'r_c3') * TALENT.r_c3.stacks, canCrit: tr(s, 'r_c5') >= 1 });
}

function applyDot(s, ev, tgt, status, src, rounds, b, pct, extra = {}) {
  const f = s.fight;
  if (!f.enemies[tgt] || !f.enemies[tgt].alive) return;
  const tick = Math.max(MIN_HIT_DAMAGE, rnd(snapshot(s, 'player', tgt, b, { pct: pct + f.p.niBonus + f.p.momBonus, school: status === 'BURN' ? 'fire' : 'phys', isSpell: true })));
  addStatus(s, ev, tgt, { id: status, src, dur: rounds, full: rounds, tick, ...extra });
}

/** Interrupt an enemy's cast this round (rules 7.7). Returns true if a cast was stopped. */
function interrupt(s, ev, tgt, by) {
  const f = s.fight;
  const e = f.enemies[tgt];
  if (!e || !e.alive) return false;
  if (e.kind === 'boss') return interruptBoss(s, ev, by);
  const it = e.intent;
  if (it && it.cast && !it.interrupted) {
    it.interrupted = true;
    if (it.cd) e.cds[it.id] = f.round + it.cd;
    ev.push({ t: 'interrupt', u: tgt, by });
    return true;
  }
  return false;
}

/** STUN / FROZEN / HEXED: CC-immune bosses are interrupted instead (rules 7.4, 7.7). */
function control(s, ev, tgt, id, dur, by) {
  const e = s.fight.enemies[tgt];
  if (!e || !e.alive) return;
  if (e.ccImmune) { interrupt(s, ev, tgt, by); return; }
  addStatus(s, ev, tgt, { id, dur });
  interrupt(s, ev, tgt, by);
}

function addCp(s, n) {
  s.fight.p.cp = Math.min(CP_MAX, s.fight.p.cp + n);
}

/** Consume all CP for a finisher; returns { cp, pct } with Serrated Finish and Ambusher's Patience. */
function finisher(s, ev) {
  const f = s.fight;
  const cp = f.p.cp;
  f.p.cp = 0;
  let pct = tr(s, 'r_a3') * TALENT.r_a3.pct;
  if (!f.p.firstFinisher) {
    pct += tr(s, 'r_b6') * TALENT.r_b6.pct;
    f.p.firstFinisher = true;
  }
  const rm = tr(s, 'r_a6');
  if (rm) gainResource(s, ev, rm * TALENT.r_a6.energyPerCp * cp);
  return { cp, pct };
}

function chillValue(s) {
  return CHILL_PCT + tr(s, 'm_b3') * TALENT.m_b3.chill;
}

function hpFrac(e) {
  return e.hp / e.maxHp;
}

// ---------------- Cast ----------------
function cast(s, ev, id, tgt) {
  const f = s.fight;
  const p = s.player;
  const sp = SPELL[id];
  const d = p.d;
  const cost = spellCost(s, id);
  const wasLucid = f.p.lucid;
  pay(s, cost);
  if (p.classId === 'mage' && wasLucid) f.p.lucid = false;
  const cd = spellCd(s, id);
  if (cd > 0) f.p.cds[id] = f.round + cd;
  const tl = spellTl(s, id);
  if (sp.target === 'enemy') f.p.target = tgt;
  ev.push({ t: 'action', kind: 'cast', spell: id, target: sp.target === 'enemy' ? tgt : null, cost });
  const e = typeof tgt === 'number' ? f.enemies[tgt] : null;
  const phys = { school: 'phys', spell: id, isSpell: true };
  switch (id) {
    // ---- Rogue ----
    case 'gutting_jab': {
      let pct = 0;
      if (f.p.riposte) { pct += tr(s, 'r_a4') * TALENT.r_a4.pct; f.p.riposte = false; }
      pct += tr(s, 'r_c6') * TALENT.r_c6.pct * poisonStacks(e);
      const res = pHit(s, ev, tgt, base(s, sp, tl), { ...phys, pct });
      if (res && res.hit) addCp(s, sp.cp);
      twinFangs(s, ev, tgt, res, base(s, sp, tl), { ...phys, pct });
      break;
    }
    case 'severing_flourish': {
      const fin = finisher(s, ev);
      pHit(s, ev, tgt, base(s, sp, tl, fin.cp), { ...phys, pct: fin.pct });
      break;
    }
    case 'shadowstep_strike': {
      const res = pHit(s, ev, tgt, base(s, sp, tl), { ...phys, pct: tr(s, 'r_b1') * TALENT.r_b1.pct });
      if (res && res.hit) addCp(s, sp.cp + tr(s, 'r_b3') * TALENT.r_b3.cp);
      break;
    }
    case 'throat_jab': {
      const res = pHit(s, ev, tgt, base(s, sp, tl), phys);
      if (res && res.hit && f.enemies[tgt].alive) {
        interrupt(s, ev, tgt, id);
        addStatus(s, ev, tgt, { id: 'SILENCED', dur: sp.silence });
      }
      break;
    }
    case 'open_vein': {
      const fin = finisher(s, ev);
      const b = (sp.dot.b + sp.dot.l * tl + sp.dot.p * d.power) * fin.cp;
      applyDot(s, ev, tgt, 'BLEED', 'open_vein', sp.dot.rounds, b, fin.pct + tr(s, 'r_c2') * TALENT.r_c2.pct + dotPct(s), { canCrit: tr(s, 'r_c5') >= 1 });
      break;
    }
    case 'temple_blow': {
      const fin = finisher(s, ev);
      control(s, ev, tgt, 'STUN', Math.min(sp.stunMax, sp.stunBase + Math.floor(fin.cp / 2)), id);
      break;
    }
    case 'smoke_veil':
      addStatus(s, ev, 'player', { id: 'EVASION', dur: sp.rounds, value: sp.dodge });
      break;
    case 'whirling_edges': {
      let any = false;
      const pct = tr(s, 'r_a8') * TALENT.r_a8.pct;
      for (const x of livingEnemies(s)) {
        if (f.over) break;
        const res = pHit(s, ev, x.idx, base(s, sp, tl), { ...phys, pct });
        if (res && res.hit) any = true;
      }
      if (any) addCp(s, sp.cp + tr(s, 'r_a8') * TALENT.r_a8.cp);
      break;
    }
    case 'expose_weakness': {
      const fin = finisher(s, ev);
      addStatus(s, ev, tgt, { id: 'EXPOSED', dur: sp.rounds, value: sp.exposedPerCp * fin.cp });
      break;
    }
    case 'adrenal_surge':
      gainResource(s, ev, sp.energy);
      addStatus(s, ev, 'player', { id: 'ADRENAL', dur: sp.rounds, value: sp.regenMult });
      break;
    case 'vanishing_step':
      dispersal(s, ev, 'player');
      gainStealth(s, ev, true);
      if (tr(s, 'r_b7')) healUnit(s, ev, 'player', rnd(tr(s, 'r_b7') * TALENT.r_b7.healPct * d.maxHp), id);
      break;
    case 'final_reckoning': {
      const exec = hpFrac(e) < sp.executeBelow ? sp.executeMult : 1;
      const fin = finisher(s, ev);
      pHit(s, ev, tgt, base(s, sp, tl, fin.cp), { ...phys, pct: fin.pct, multi: exec });
      break;
    }
    case 'thousand_cuts':
    case 'ghostblade_rush': {
      let any = false;
      for (let i = 0; i < sp.hits; i++) {
        const t = f.enemies[tgt].alive ? tgt : defaultTarget(s);
        if (t === null || f.over) break;
        const res = pHit(s, ev, t, sp.gjFrac * gjAmount(s), phys);
        if (res && res.hit) any = true;
      }
      if (any) addCp(s, sp.cp);
      break;
    }
    case 'rupture_venom': {
      const pct = sp.perPoison * poisonStacks(e);
      const fin = finisher(s, ev);
      pHit(s, ev, tgt, base(s, sp, tl, fin.cp), { ...phys, pct: fin.pct + pct });
      break;
    }
    case 'bloodprice_gambit': {
      const loss = Math.min(p.hp - 1, rnd(sp.hpCost * p.hp));
      if (loss > 0) { p.hp -= loss; ev.push({ t: 'damage', src: 'player', dst: 'player', amount: loss, hpLost: loss, absorbed: 0, spell: id }); }
      addCp(s, sp.cpGain);
      gainResource(s, ev, sp.energy);
      break;
    }
    // ---- Mage ----
    case 'ember_bolt':
    case 'pyre_comet': {
      const critBonus = id === 'pyre_comet' && hasSt(e.st, 'BURN') ? sp.critVsBurn : 0;
      pHit(s, ev, tgt, base(s, sp, tl), { school: 'fire', spell: id, isSpell: true, critBonus });
      break;
    }
    case 'frost_lance': {
      const res = pHit(s, ev, tgt, base(s, sp, tl), { school: 'frost', spell: id, isSpell: true, pct: tr(s, 'm_b1') * TALENT.m_b1.pct });
      if (res && res.hit && f.enemies[tgt].alive) addStatus(s, ev, tgt, { id: 'CHILLED', dur: sp.chill, value: chillValue(s) });
      break;
    }
    case 'arcane_ward': {
      const amt = rnd(base(s, sp.ward, tl) * (1 + tr(s, 'm_b7') * TALENT.m_b7.pct + tr(s, 'm_c4') * TALENT.m_c4.pct));
      addStatus(s, ev, 'player', { id: 'WARD', dur: sp.rounds, amount: amt, lattice: tr(s, 'm_b7') > 0, src: id });
      break;
    }
    case 'rime_burst':
      for (const x of livingEnemies(s)) {
        if (f.over) break;
        const res = pHit(s, ev, x.idx, base(s, sp, tl), { school: 'frost', spell: id, isSpell: true });
        if (res && res.hit && x.alive) control(s, ev, x.idx, 'FROZEN', sp.freeze, id);
      }
      break;
    case 'living_flame':
      applyDot(s, ev, tgt, 'BURN', 'living_flame', sp.dot.rounds + tr(s, 'm_a3') * TALENT.m_a3.rounds, base(s, sp.dot, tl), tr(s, 'm_a3') * TALENT.m_a3.pct);
      break;
    case 'spellsnap': {
      const res = pHit(s, ev, tgt, base(s, sp, tl), { school: 'arcane', spell: id, isSpell: true });
      if (res && res.hit && f.enemies[tgt].alive) {
        const ok = interrupt(s, ev, tgt, id);
        addStatus(s, ev, tgt, { id: 'SILENCED', dur: sp.silence });
        if (ok && tr(s, 'm_c5')) p.mana = Math.min(d.maxMana, p.mana + rnd(tr(s, 'm_c5') * TALENT.m_c5.manaPct * d.maxMana));
      }
      break;
    }
    case 'hexbind':
      control(s, ev, tgt, 'HEXED', sp.hex, id);
      break;
    case 'cinder_storm': {
      const wf = tr(s, 'm_a7');
      for (const x of livingEnemies(s)) {
        if (f.over) break;
        const res = pHit(s, ev, x.idx, base(s, sp, tl), { school: 'fire', spell: id, isSpell: true });
        if (wf && res && res.hit && x.alive && knowsSpell(s, 'living_flame')) {
          const lf = SPELL.living_flame;
          applyDot(s, ev, x.idx, 'BURN', 'living_flame', lf.dot.rounds + tr(s, 'm_a3') * TALENT.m_a3.rounds,
            base(s, lf.dot, spellTl(s, 'living_flame')) * wf * TALENT.m_a7.strength, tr(s, 'm_a3') * TALENT.m_a3.pct);
        }
      }
      break;
    }
    case 'mana_siphon':
    case 'hourglass_reversal': {
      if (id === 'hourglass_reversal') {
        for (const k of Object.keys(f.p.cds)) if (k !== id) delete f.p.cds[k];
      }
      const gain = Math.min(d.maxMana - p.mana, rnd(sp.manaPct * d.maxMana));
      p.mana += gain;
      if (gain > 0) ev.push({ t: 'mana', amount: gain, spell: id }); // like heal: no event of 0
      break;
    }
    case 'glacial_tomb':
      addStatus(s, ev, 'player', { id: 'IMMUNE', dur: sp.rounds });
      f.p.skip = true;
      dispersal(s, ev, 'player');
      healUnit(s, ev, 'player', rnd((tr(s, 'm_b8') ? TALENT.m_b8.healPct : sp.healPct) * d.maxHp), id);
      break;
    case 'starlance_barrage':
      for (let i = 0; i < sp.hits; i++) {
        const t = f.enemies[tgt].alive ? tgt : defaultTarget(s);
        if (t === null || f.over) break;
        pHit(s, ev, t, base(s, sp, tl), { school: 'arcane', spell: id, isSpell: true, pct: tr(s, 'm_c6') * TALENT.m_c6.pct });
      }
      break;
    case 'conflagrant_core':
      addStatus(s, ev, 'player', { id: 'CONFLAGRANT', dur: sp.rounds, value: sp.critBonus });
      break;
    case 'glacier_spike': {
      const multi = hasSt(e.st, 'CHILLED') || hasSt(e.st, 'FROZEN') ? sp.vsChillMult : 1;
      pHit(s, ev, tgt, base(s, sp, tl), { school: 'frost', spell: id, isSpell: true, multi });
      break;
    }
    case 'chrono_sigil':
      if (e.intent) {
        e.intent.skipped = true;
        ev.push({ t: 'skip', u: tgt, by: id });
      }
      break;
    case 'mirrorshade':
      addStatus(s, ev, 'player', { id: 'MIRROR', dur: sp.rounds, value: sp.chance });
      break;
    // ---- Hunter ----
    case 'keen_shot':
    case 'heartseeker_shot': {
      const pct = id === 'keen_shot' ? tr(s, 'h_b1') * TALENT.h_b1.pct : 0;
      const critBonus = id === 'heartseeker_shot' && hpFrac(e) < sp.critBelow ? sp.critBonus : 0;
      pHit(s, ev, tgt, base(s, sp, tl), { ...phys, pct, critBonus });
      break;
    }
    case 'barbed_arrow':
      applyDot(s, ev, tgt, 'BLEED', 'barbed_arrow', sp.dot.rounds, base(s, sp.dot, tl), tr(s, 'h_c2') * TALENT.h_c2.pct,
        tr(s, 'h_c6') ? { maxStacks: 1 + tr(s, 'h_c6') * TALENT.h_c6.stacks } : {});
      break;
    case 'mark_prey':
      addStatus(s, ev, tgt, { id: 'MARKED', dur: sp.rounds, value: sp.marked + tr(s, 'h_b5') * TALENT.h_b5.marked });
      break;
    case 'mend_companion': {
      const pet = p.pet;
      let amt;
      if (!pet.alive) {
        pet.alive = true;
        pet.hp = Math.max(1, rnd(sp.revivePct * d.petMaxHp));
        amt = pet.hp;
        ev.push({ t: 'petRevive', hp: pet.hp, spell: id });
      } else {
        amt = rnd(base(s, sp.heal, tl));
        healUnit(s, ev, 'pet', amt, id);
      }
      if (tr(s, 'h_a3')) healUnit(s, ev, 'player', rnd(tr(s, 'h_a3') * TALENT.h_a3.share * amt), id);
      break;
    }
    case 'muzzle_shot': {
      const res = pHit(s, ev, tgt, base(s, sp, tl), phys);
      if (res && res.hit && f.enemies[tgt].alive) {
        interrupt(s, ev, tgt, id);
        addStatus(s, ev, tgt, { id: 'SILENCED', dur: sp.silence });
        if (tr(s, 'h_b8') && !f.enemies[tgt].ccImmune) control(s, ev, tgt, 'STUN', TALENT.h_b8.stun, id);
      }
      break;
    }
    case 'snare_trap': {
      const trap = tr(s, 'h_c3');
      if (trap) {
        const T = TALENT.h_c3;
        pHit(s, ev, tgt, (T.b + T.l * tl + T.p * d.power) * trap, phys);
      }
      if (!f.over && f.enemies[tgt].alive) control(s, ev, tgt, 'STUN', sp.stun, id);
      if (tr(s, 'h_c7')) {
        const T = TALENT.h_c7;
        for (const x of livingEnemies(s)) applyDot(s, ev, x.idx, 'BURN', 'fire_snare', T.rounds, T.b + T.l * tl + T.p * d.power, 0);
      }
      break;
    }
    case 'field_dressing': {
      const m = 1 + tr(s, 'h_c4') * TALENT.h_c4.pct;
      healUnit(s, ev, 'player', rnd(sp.healPct * d.maxHp * m), id);
      addStatus(s, ev, 'player', { id: 'HOT', dur: sp.rounds, amount: rnd(sp.hotPct * d.maxHp * m), src: id });
      break;
    }
    case 'volley_rain':
      for (const x of livingEnemies(s)) {
        if (f.over) break;
        pHit(s, ev, x.idx, base(s, sp, tl), { ...phys, pct: tr(s, 'h_b6') * TALENT.h_b6.pct });
      }
      break;
    case 'feign_stillness':
      dispersal(s, ev, 'player');
      if (petAlive(s)) addStatus(s, ev, 'player', { id: 'FEIGN', dur: sp.rounds });
      else gainStealth(s, ev, true);
      break;
    case 'savage_order':
      damage(s, ev, 'pet', tgt, { base: base(s, sp, tl), school: 'phys', spell: id, pct: tr(s, 'h_a7') * TALENT.h_a7.pct });
      break;
    case 'rapid_volley':
      addStatus(s, ev, 'player', { id: 'RAPID', dur: sp.rounds, value: sp.dmgPct + tr(s, 'h_b7') * TALENT.h_b7.pct, focus: sp.focusRegenPct });
      break;
    case 'wild_communion':
      addStatus(s, ev, 'player', { id: 'COMMUNION', dur: sp.rounds, value: sp.petDmgPct });
      addStatus(s, ev, 'pet', { id: 'TAUNT', dur: sp.rounds });
      break;
    case 'starfall_arrow': {
      const res = pHit(s, ev, tgt, base(s, sp, tl), phys);
      if (res && res.killed) gainResource(s, ev, sp.refundOnKill);
      break;
    }
    case 'deadfall_trap':
      for (const x of livingEnemies(s)) {
        if (f.over) break;
        const res = pHit(s, ev, x.idx, base(s, sp, tl), phys);
        if (res && res.hit && x.alive) control(s, ev, x.idx, 'STUN', sp.stun, id);
      }
      break;
    case 'ricochet_bolt': {
      pHit(s, ev, tgt, base(s, sp, tl), phys);
      let n = 0;
      for (const x of livingEnemies(s)) {
        if (n >= sp.bounces || f.over) break;
        if (x.idx === tgt) continue;
        pHit(s, ev, x.idx, base(s, sp, tl), { ...phys, multi: sp.bounceFrac });
        n++;
      }
      break;
    }
    case 'beastcall_horn': {
      const pet = p.pet;
      if (!pet.alive) { pet.alive = true; ev.push({ t: 'petRevive', hp: d.petMaxHp, spell: id }); }
      pet.hp = d.petMaxHp;
      addStatus(s, ev, 'pet', { id: 'TAUNT', dur: sp.taunt });
      break;
    }
    default:
      throw new Error(`no handler for spell ${id}`);
  }
  if (p.classId === 'mage' && tr(s, 'm_c3')) f.p.lucid = nextFloat(f.rng) < tr(s, 'm_c3') * TALENT.m_c3.chance;
}

/** Twin Fangs (r_a7): Strike and Gutting Jab may hit again for 50 % (one draw after a landed hit). */
function twinFangs(s, ev, tgt, res, b, o) {
  const rank = tr(s, 'r_a7');
  const f = s.fight;
  if (!rank || !res || !res.hit || f.over) return;
  if (nextFloat(f.rng) < rank * TALENT.r_a7.chance && f.enemies[tgt].alive) pHit(s, ev, tgt, b * TALENT.r_a7.frac, o);
}

/** Base amount of a spell for tooltips (before level, target, crit and variance modifiers). */
export function spellAmount(s, id) {
  const sp = SPELL[id];
  const tl = s.player.spells[id] ? spellTl(s, id) : s.player.level;
  const cp = s.fight ? Math.max(1, s.fight.p.cp) : 1;
  if (sp.dot) return { kind: 'dot', perTick: rnd(base(s, sp.dot, tl, cp)), rounds: sp.dot.rounds, school: sp.dot.status === 'BURN' ? 'fire' : 'phys' };
  if (sp.ward) return { kind: 'ward', amount: rnd(base(s, sp.ward, tl)), rounds: sp.rounds };
  if (sp.heal) return { kind: 'heal', amount: rnd(base(s, sp.heal, tl)) };
  if (sp.healPct) return { kind: 'heal', amount: rnd(sp.healPct * s.player.d.maxHp) };
  if (sp.gjFrac) return { kind: 'damage', amount: rnd(sp.gjFrac * gjAmount(s)), hits: sp.hits, school: 'phys' };
  if (sp.school && (sp.b || sp.p || sp.w)) {
    const a = { kind: 'damage', amount: rnd(base(s, sp, tl, cp)), hits: sp.hits || 1, school: sp.school, perCp: !!sp.perCp };
    // Ricochet Bolt: the target takes `amount`, then up to `bounces` other enemies take bounceFrac of it.
    if (sp.bounces) Object.assign(a, { bounces: sp.bounces, bounceFrac: sp.bounceFrac, bounceAmount: rnd(base(s, sp, tl, cp) * sp.bounceFrac) });
    return a;
  }
  return null;
}

/** FLEE success chance now (rules 7.8). */
export function fleeChance(s) {
  const f = s.fight;
  if (!f || !f.canFlee) return 0;
  if (hasSt(f.p.st, 'STEALTH')) return 1;
  return Math.max(0, FLEE_BASE - FLEE_PER_EXTRA_ENEMY * (livingEnemies(s).length - 1));
}

// ---------------- Items ----------------
function useItem(s, ev, id) {
  const f = s.fight;
  const p = s.player;
  const c = CONSUMABLE[id];
  takeConsumable(s, id, 1);
  ev.push({ t: 'action', kind: 'item', item: id });
  if (c.potion) {
    f.p.potionReady = f.round + POTION_CD;
    s.stats.potionsUsed += 1;
  }
  if (c.heal) healUnit(s, ev, 'player', rnd(c.heal * p.d.maxHp * (1 + UNIQUE_POTION_PCT * hasEffect(s, 'potion'))), id);
  if (c.mana && p.d.maxMana) {
    const gain = Math.min(p.d.maxMana - p.mana, rnd(c.mana * p.d.maxMana));
    p.mana += gain;
    if (gain > 0) ev.push({ t: 'mana', amount: gain, spell: id });
  }
  if (c.dispersal) dispersal(s, ev, 'player');
  if (c.sparkBase !== undefined) {
    for (const x of livingEnemies(s)) {
      if (f.over) break;
      damage(s, ev, 'player', x.idx, { base: c.sparkBase + c.sparkPerLevel * p.level, school: 'magic', spell: id });
    }
  }
}

export function itemUsableInCombat(s, id) {
  const c = CONSUMABLE[id];
  if (!c || !(c.use === 'any' || c.use === 'combat')) return false;
  if (countConsumable(s, id) < 1) return false;
  if (c.potion && s.fight.p.potionReady > s.fight.round) return false;
  if (c.mana && !s.player.d.maxMana) return false;
  return true;
}

// ---------------- Player action dispatcher ----------------
/** Resolve the player's action for the round (validated by the caller). */
export function playerAction(s, ev, a) {
  const f = s.fight;
  const p = s.player;
  if (f.p.skip) {
    f.p.skip = false;
    f.p.momentum = 0;
    ev.push({ t: 'action', kind: 'skip' });
    return;
  }
  const wasStealthed = hasSt(f.p.st, 'STEALTH');
  const opener = a.type === 'CAST' && isOpener(a.spellId);
  if (wasStealthed && (!opener || EA.OPENER_BREAKS_STEALTH)) removeStatus(s, ev, 'player', 'STEALTH');
  f.p.niBonus = (wasStealthed || f.p.stealthPrev) ? tr(s, 'r_b8') * TALENT.r_b8.pct : 0;
  f.p.stealthPrev = wasStealthed;
  const damagingSpell = a.type === 'CAST' && isDamaging(a.spellId);
  f.p.momBonus = damagingSpell ? f.p.momentum * tr(s, 'm_c8') * TALENT.m_c8.pct : 0;
  f.p.momentum = damagingSpell ? Math.min(TALENT.m_c8.maxStacks, f.p.momentum + 1) : 0;
  if (a.type === 'ATTACK') {
    const bas = CLASS[p.classId].basic;
    const d = p.d;
    f.p.target = a.target;
    ev.push({ t: 'action', kind: 'attack', spell: bas.id, target: a.target });
    const b = bas.b + bas.l * p.level + bas.p * d.power + bas.w * d.wd;
    const res = pHit(s, ev, a.target, b, { school: bas.school, spell: bas.id, isSpell: false });
    if (p.classId === 'rogue') twinFangs(s, ev, a.target, res, b, { school: bas.school, spell: bas.id, isSpell: false });
  } else if (a.type === 'CAST') {
    cast(s, ev, a.spellId, a.target);
  } else if (a.type === 'USE_ITEM') {
    useItem(s, ev, p.itemBar[a.slot]);
  } else if (a.type === 'PASS') {
    ev.push({ t: 'action', kind: 'pass' });
  } else if (a.type === 'FLEE') {
    const living = livingEnemies(s).length;
    const chance = wasStealthed ? 1 : FLEE_BASE - FLEE_PER_EXTRA_ENEMY * (living - 1);
    const r = nextFloat(f.rng);
    const ok = r < chance;
    ev.push({ t: 'action', kind: 'flee', success: ok });
    if (ok) f.over = 'fled';
  }
}

/** Pet acts after the hunter (rules 5.5): basic attack on the hunter's current target. */
export function petAction(s, ev) {
  const f = s.fight;
  const p = s.player;
  if (!p.pet || !p.pet.alive) return;
  const pet = PET[p.pet.id];
  let tgt = f.p.target;
  if (tgt === null || !f.enemies[tgt] || !f.enemies[tgt].alive) tgt = defaultTarget(s);
  if (tgt === null) return;
  f.pet.actions += 1;
  ev.push({ t: 'petAction', target: tgt });
  damage(s, ev, 'pet', tgt, { base: p.d.petDmg, school: 'phys', spell: 'pet' });
  if (pet.doubleEvery && f.pet.actions % pet.doubleEvery === 0 && !f.over) {
    const t2 = f.enemies[tgt].alive ? tgt : defaultTarget(s);
    if (t2 !== null) damage(s, ev, 'pet', t2, { base: p.d.petDmg, school: 'phys', spell: 'pet' });
  }
  if (pet.cleave && !f.over) {
    const other = f.enemies.find((e) => e.alive && e.idx !== tgt);
    if (other) damage(s, ev, 'pet', other.idx, { base: p.d.petDmg, school: 'phys', spell: 'pet' });
  }
}
