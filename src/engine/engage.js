// Engage round (rules 7.10, combat v2): the ENGAGE action and the nine class engage options (strike, control,
// setup per class): legality, resolution, and the option list the UI shows. Options need no bar slot, training or
// resource and use L (tl = L); they are legal only in the engage round, once per fight. Combat v2.1: on a CC-immune
// enemy every control option is Disrupt (a trap on its first visible wind-up), legal only while one is visible.
import {
  SPELL, TALENT, ENGAGE_OPTION, ENGAGE_OPTIONS, OPENING_SHOT_MULT, AMBUSH_MULT, PREMED_CP, SAP_TURNS, GLYPH_TURNS,
  GATHER_SPELLS, GATHER_CRIT, OPENING_MARK_ROUNDS, TRAP_STUN, PET_LEAD_TURNS, PET_LEAD_DR, INTENT_TRACK_LEN,
  ENGINE_ASSUMPTION as EA,
} from '../constants.js';
import { tr } from './stats.js';
import { addStatus, petAlive } from './damage.js';
import { isEngageRound, isSingle } from './track.js';
import { base, pHit, addCp, control, cast, castError, twinFangs, knowsSpell } from './spells.js';

/**
 * Options that keep the Rogue in STEALTH (rules 7.10): Sap, Premeditate, and Ambush like a stealth opener (D48: as
 * long as openers keep STEALTH, rules 7.4). Every other option is a non-opener action.
 */
export const keepsStealth = (option) => option === 'sap' || option === 'premeditate' || (option === 'ambush' && !EA.OPENER_BREAKS_STEALTH);

/**
 * Status duration that covers an enemy's next n turns when applied in the engage round (rules 7.4 counts the round
 * of application; the enemies' turn 1 is round 2).
 */
const turnsDur = (n) => n + 1;

/** The ENGAGE action object, in the key order legalActions and autoAction use. */
export function engageAct(option, target, spellId) {
  return ENGAGE_OPTION[option].target === 'spell' ? { type: 'ENGAGE', option, spellId, target } : { type: 'ENGAGE', option, target };
}

/**
 * Turn of the first wind-up (rules 7.12, combat v2.1) within turns 1..INTENT_TRACK_LEN of the enemy's track, or 0:
 * the turn a Disrupt traps (rules 7.10).
 */
export function windupTurn(e) {
  const x = e.track.find((y) => y.turn >= 1 && y.turn <= INTENT_TRACK_LEN && y.windup);
  return x ? x.turn : 0;
}

/** Is this ENGAGE a Disrupt (rules 7.10, combat v2.1): a control option on an enemy immune to control? */
export function isDisrupt(s, a) {
  const o = ENGAGE_OPTION[a.option];
  const e = o && o.target === 'control' && Number.isInteger(a.target) ? s.fight.enemies[a.target] : null;
  return !!(e && e.alive && e.ccImmune);
}

/** Why an ENGAGE action is not legal now (rules 7.10), or null. */
export function engageError(s, a) {
  const f = s.fight;
  if (!isEngageRound(f)) return 'ENGAGE is legal only in the engage round (round 1 of a fight with one)';
  const o = ENGAGE_OPTION[a.option];
  if (!o || o.cls !== s.player.classId) return `unknown engage option ${a.option} for ${s.player.classId}`;
  const live = (t) => Number.isInteger(t) && !!f.enemies[t] && f.enemies[t].alive;
  if (o.target === 'enemy' || o.target === 'control') {
    if (!live(a.target)) return `${o.name} needs a living enemy target`;
    // Combat v2.1: on an enemy immune to control the option is Disrupt, legal only while a wind-up is visible.
    if (o.target === 'control' && f.enemies[a.target].ccImmune && !windupTurn(f.enemies[a.target])) {
      return `${o.name}: ${f.enemies[a.target].name} cannot be controlled, and Disrupt needs a wind-up in its turns 1-${INTENT_TRACK_LEN}`;
    }
  } else if (o.target === 'none') {
    if (a.target !== null && a.target !== undefined) return `${o.name} takes no target`;
  } else if (o.target === 'spell') {
    const sp = SPELL[a.spellId];
    if (!sp || !s.player.bar.includes(a.spellId)) return `${o.name} needs a spell on the action bar`;
    if (sp.target !== 'enemy' && a.target !== null && a.target !== undefined) return `${sp.name} takes no target`;
    const err = castError(s, a.spellId, a.target, { free: true });
    if (err) return err;
  }
  if (o.id === 'send_pet' && !petAlive(s)) return `${o.name} needs a live pet`;
  return null;
}

/**
 * Turn on which a trap laid in the engage round springs (rules 7.10): the target's first entry with heavy or cast
 * within turns 1..INTENT_TRACK_LEN, else turn 1.
 */
export function trapTurn(e) {
  const x = e.track.find((y) => y.turn >= 1 && y.turn <= INTENT_TRACK_LEN && (y.heavy || y.cast));
  return x ? x.turn : 1;
}

/**
 * Resolve an ENGAGE action (validated by the caller). STEALTH is handled by playerAction (Sap keeps it, also as a
 * Disrupt). Disrupt (rules 7.10, combat v2.1): a TRAP on the target's first visible wind-up turn whose STUN covers that
 * one turn (it cancels only that entry: OFF_BALANCE and STAGGERED, track.js nowIntent); no SAPPED, no FROZEN.
 */
export function engageAction(s, ev, a) {
  const f = s.fight;
  const p = s.player;
  const o = ENGAGE_OPTION[a.option];
  const tgt = a.target === undefined ? null : a.target;
  const L = p.level;
  if (o.target === 'spell') {
    // Pre-cast: one bar spell at 0 mana cost; its cooldown starts.
    cast(s, ev, a.spellId, SPELL[a.spellId].target === 'enemy' ? tgt : null, { free: true, engage: o.id });
    return;
  }
  if (isDisrupt(s, a)) {
    ev.push({ t: 'action', kind: 'engage', option: o.id, target: tgt, disrupt: true });
    // stun 1: "STUN for that one turn" (rules 7.10), whatever TRAP_STUN is.
    addStatus(s, ev, tgt, { id: 'TRAP', dur: null, turn: windupTurn(f.enemies[tgt]), stun: 1, disrupt: true });
    return;
  }
  ev.push({ t: 'action', kind: 'engage', option: o.id, target: tgt });
  switch (o.id) {
    case 'ambush': {
      // Shadowstep Strike if learned, else Gutting Jab × AMBUSH_MULT (+2 CP); STEALTH stays like an opener's (D48).
      f.p.target = tgt;
      if (knowsSpell(s, 'shadowstep_strike')) {
        const sp = SPELL.shadowstep_strike;
        const res = pHit(s, ev, tgt, base(s, sp, L), { school: 'phys', spell: sp.id, isSpell: true, pct: tr(s, 'r_b1') * TALENT.r_b1.pct });
        if (res && res.hit) addCp(s, sp.cp + tr(s, 'r_b3') * TALENT.r_b3.cp);
      } else {
        const b = base(s, SPELL.gutting_jab, L);
        const hit = { school: 'phys', spell: 'gutting_jab', isSpell: true, multi: AMBUSH_MULT };
        const res = pHit(s, ev, tgt, b, hit);
        if (res && res.hit) addCp(s, o.cp);
        twinFangs(s, ev, tgt, res, b, hit);
      }
      break;
    }
    case 'sap':
      // SAPPED for SAP_TURNS turns: cancels those now-entries; breaks on any damage (damage.js). wasSapped keeps
      // autoplay's default target off it while another enemy lives (rules 7.9, D48).
      addStatus(s, ev, tgt, { id: 'SAPPED', dur: turnsDur(SAP_TURNS) });
      f.enemies[tgt].wasSapped = true;
      break;
    case 'premeditate':
      addCp(s, PREMED_CP);
      break;
    case 'binding_glyph':
      // FROZEN for GLYPH_TURNS turns, not broken by damage; counts as OFF_BALANCE while FROZEN (rules 7.13).
      control(s, ev, tgt, 'FROZEN', turnsDur(GLYPH_TURNS), o.id);
      break;
    case 'gather_power':
      addStatus(s, ev, 'player', { id: 'GATHER', dur: null, stacks: GATHER_SPELLS, value: GATHER_CRIT });
      break;
    case 'opening_shot': {
      // Keen Shot × OPENING_SHOT_MULT, then MARKED (Mark Prey's value) for OPENING_MARK_ROUNDS rounds.
      f.p.target = tgt;
      pHit(s, ev, tgt, base(s, SPELL.keen_shot, L), { school: 'phys', spell: 'keen_shot', isSpell: true, multi: OPENING_SHOT_MULT, pct: tr(s, 'h_b1') * TALENT.h_b1.pct });
      if (!f.over && f.enemies[tgt].alive) addStatus(s, ev, tgt, { id: 'MARKED', dur: OPENING_MARK_ROUNDS, value: SPELL.mark_prey.marked });
      break;
    }
    case 'lay_trap': {
      // Springs on the first heavy or cast entry of turns 1..INTENT_TRACK_LEN, else on turn 1 (track.js nowIntent).
      const turn = trapTurn(f.enemies[tgt]);
      addStatus(s, ev, tgt, { id: 'TRAP', dur: null, turn, stun: TRAP_STUN });
      break;
    }
    case 'send_pet':
      // The pet engages first: TAUNT and -PET_LEAD_DR damage taken for PET_LEAD_TURNS turns; it attacks the target.
      f.p.target = tgt;
      addStatus(s, ev, 'pet', { id: 'TAUNT', dur: turnsDur(PET_LEAD_TURNS) });
      addStatus(s, ev, 'pet', { id: 'PET_LEAD', dur: turnsDur(PET_LEAD_TURNS), value: PET_LEAD_DR });
      break;
    default:
      throw new Error(`no handler for engage option ${o.id}`);
  }
}

/** Control statuses a Mage Pre-cast spell applies (for the preview): status and its duration field in SPELL. */
const PRECAST_CONTROL = { hexbind: ['HEXED', 'hex'], rime_burst: ['FROZEN', 'freeze'] };

/**
 * What an ENGAGE action does to the tracks (rules 7.10, for the engage panel's hover preview), without any draw:
 * null if it is not legal, else { enemies: [{ u, cancelled: [turns], offBalance: [turns], window: [turns], pet:
 * [turns], stagger: [turns], disrupt }] } for the enemies it changes: `cancelled` = turns whose entries it cancels
 * (Sap, Binding Glyph, Lay Trap, Disrupt, a Pre-cast Hexbind or Rime Burst; Sap and Hexbind only while no damage
 * breaks them; Rime Burst only if it hits), `offBalance` = those among them whose entry is a heavy or a cast (the
 * enemy will be OFF_BALANCE), `window` = turns it is FROZEN (counts as OFF_BALANCE), `pet` = turns whose
 * single-target entries go to the pet (Send the Pet), `stagger` (combat v2.1) = cancelled turns whose entry is a
 * wind-up (answered: STAGGERED), `disrupt` = the option is a Disrupt on this CC-immune enemy (its one cancelled turn
 * is the first visible wind-up). Damage options change no entry.
 */
export function engagePreview(s, a) {
  if (!a || a.type !== 'ENGAGE' || engageError(s, a)) return null;
  const f = s.fight;
  const out = [];
  const at = (e, t) => e.track.find((y) => y.turn === t);
  const big = (e, t) => { const x = at(e, t); return !!(x && (x.heavy || x.cast)); };
  const wind = (e, t) => { const x = at(e, t); return !!(x && x.windup); };
  const turns = (n) => Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);
  const item = (e, ts, frozen, pet, disrupt) => ({ u: e.idx, cancelled: ts, offBalance: ts.filter((t) => big(e, t)), window: frozen ? ts : [], pet, stagger: ts.filter((t) => wind(e, t)), disrupt });
  const cancel = (e, ts, frozen) => out.push(item(e, ts, frozen, [], false));
  const o = ENGAGE_OPTION[a.option];
  if (isDisrupt(s, a)) out.push(item(f.enemies[a.target], [windupTurn(f.enemies[a.target])], false, [], true));
  else if (o.id === 'sap') cancel(f.enemies[a.target], turns(SAP_TURNS), false);
  else if (o.id === 'binding_glyph') cancel(f.enemies[a.target], turns(GLYPH_TURNS), true);
  else if (o.id === 'lay_trap') cancel(f.enemies[a.target], [trapTurn(f.enemies[a.target])], false);
  else if (o.id === 'send_pet') {
    for (const e of f.enemies) if (e.alive) out.push(item(e, [], false, turns(PET_LEAD_TURNS).filter((t) => { const x = at(e, t); return x && isSingle(x.kind); }), false));
  } else if (o.id === 'precast' && PRECAST_CONTROL[a.spellId]) {
    // A status applied in the engage round covers turns 1..dur-1 (rules 7.4); immune enemies are only interrupted.
    const [id, field] = PRECAST_CONTROL[a.spellId];
    const dur = SPELL[a.spellId][field];
    const hit = SPELL[a.spellId].target === 'all' ? f.enemies.filter((e) => e.alive) : [f.enemies[a.target]];
    for (const e of hit) if (!e.ccImmune) cancel(e, turns(dur - 1), id === 'FROZEN');
  }
  return { enemies: out.filter((x) => x.cancelled.length || x.pet.length) };
}

/**
 * Engage options for the UI (rules 7.10), or null outside the engage round: each of the class's options with id,
 * kind, name, `targets` (enemy indices it may target; [null] for no target), `spells` (Pre-cast: bar spells with
 * their targets), `disrupt` (combat v2.1: the targets on which this control option is Disrupt, CC-immune enemies with
 * a visible wind-up; [] otherwise) and `reason` when it cannot be used now (e.g. an immune enemy without a wind-up).
 */
export function engageOptions(s) {
  const f = s.fight;
  if (!s.player || !isEngageRound(f)) return null;
  const live = f.enemies.filter((e) => e.alive).map((e) => e.idx);
  return ENGAGE_OPTIONS[s.player.classId].map((id) => {
    const o = ENGAGE_OPTION[id];
    const out = { id, kind: o.kind, name: o.name, targets: [], spells: null, disrupt: [], reason: null };
    if (o.target === 'spell') {
      out.spells = [];
      for (const sid of s.player.bar) {
        if (!sid) continue;
        const ts = SPELL[sid].target === 'enemy' ? live : [null];
        const ok = ts.filter((t) => !engageError(s, engageAct(id, t, sid)));
        if (ok.length) out.spells.push({ spellId: sid, targets: ok });
      }
      if (!out.spells.length) out.reason = 'no bar spell can be cast now';
    } else {
      const ts = o.target === 'none' ? [null] : live;
      let why = null;
      for (const t of ts) {
        const act = engageAct(id, t);
        const err = engageError(s, act);
        if (!err) {
          out.targets.push(t);
          if (isDisrupt(s, act)) out.disrupt.push(t);
        } else why = why || err;
      }
      if (!out.targets.length) out.reason = why;
    }
    return out;
  });
}
