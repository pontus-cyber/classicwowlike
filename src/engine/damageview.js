// damageview.js - the character sheet's damage numbers (owner feedback 2026-11-11 11:58; engine-api.md 1 damageView).
// Pure: no draw, no change to the state. The numbers come from the damage pipeline itself (damage.js snapshot,
// critChance, critMult; spells.js base): a direct hit of the class's main attack on a foe of the player's level with no
// armour, no statuses and no damage-taken modifiers, so the level step and mitigation are 1 and 0.
import { CLASS, SPELL, PET, TALENT, DMG_VARIANCE, MIN_HIT_DAMAGE } from '../constants.js';
import { snapshot, critChance, critMult, playerPct, petPct } from './damage.js';
import { base, spellTl } from './spells.js';
import { tr } from './stats.js';
import { rnd } from './util.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r2 = (x) => Math.round(x * 100) / 100;

/** The % the main attack's own cast adds without conditions (spells.js cast): Keen Shot's talent. */
const SPELL_PCT = { keen_shot: (s) => tr(s, 'h_b1') * TALENT.h_b1.pct };

/**
 * A copy of the state's fight part to read from: in a fight its own player and pet statuses (Rapid Volley, Communion,
 * Conflagrant Core, Chilled or Cursed on the player), with one target-free foe in place of the enemies; else none.
 */
function shim(s) {
  const f = s.fight;
  const foe = { idx: 0, level: s.player.level, st: [], kind: 'normal', alive: true, hp: 1, maxHp: 1, armor: 0, dodge: 0 };
  return { ...s, fight: { kind: f ? f.kind : 'quest', round: f ? f.round : 1, p: f ? f.p : { st: [] }, pet: f ? f.pet : { st: [] }, enemies: [foe] } };
}

/** Hit range, crit range and average (crit included) of `raw` × `mult` with crit chance `c` and multiplier `cm`. */
function hit(raw, mult, c, cm) {
  const x = raw * mult;
  const lo = Math.max(MIN_HIT_DAMAGE, rnd(x * (1 - DMG_VARIANCE)));
  const hi = Math.max(MIN_HIT_DAMAGE, rnd(x * (1 + DMG_VARIANCE)));
  const cc = Math.min(1, Math.max(0, c));
  return { lo, hi, critLo: Math.max(MIN_HIT_DAMAGE, rnd(x * cm * (1 - DMG_VARIANCE))), critHi: Math.max(MIN_HIT_DAMAGE, rnd(x * cm * (1 + DMG_VARIANCE))),
    crit: r4(cc), critMult: cm, avg: r2(x * (1 + cc * (cm - 1))) };
}

/**
 * The character sheet's damage block, or null without a character (CREATE): { pct, main, pet, perPower, perWd }.
 * pct: the summed outgoing % modifiers that hold for every attack (boons, elixir, talents, in a fight its buffs).
 * main: the class's main attack (CLASS.startSpells[0]: Gutting Jab, Ember Bolt, Keen Shot) at its training level:
 *   { spellId, name, school, tl, base (b + l×tl + p×Power + w×WD, rounded), pct (every % on it: pct + school and spell
 *   talents), lo, hi (a hit), critLo, critHi, crit (chance), critMult, avg (per hit, crit included) }.
 * pet: the Hunter's pet attack, else null: { id, name, base (petDmg), pct, lo, hi, critLo, critHi, crit, critMult, avg }.
 * perPower, perWd: the average (crit included) one more point of Power or Weapon damage adds to the main attack.
 * Target-free: a foe of the player's level with no armour or statuses; procs (Twin Fangs, unique procs), off-balance
 * windows and conditional bonuses (Riposte, poison stacks, an elite target) are not in it.
 */
export function damageView(s) {
  const p = s && s.player;
  if (!p || !p.d || !CLASS[p.classId]) return null;
  const sh = shim(s);
  const id = CLASS[p.classId].startSpells[0];
  const sp = SPELL[id];
  const tl = p.spells && p.spells[id] ? spellTl(s, id) : p.level;
  const o = { school: sp.school, spell: id, isSpell: sp.school !== 'phys', pct: SPELL_PCT[id] ? SPELL_PCT[id](s) : 0, critBonus: 0 };
  const mult = snapshot(sh, 'player', 0, 1, o);
  const c = critChance(sh, 'player', 0, o); const cm = critMult(sh, 'player');
  const raw = base(s, sp, tl);
  const per = (k) => r2((sp[k] || 0) * mult * (1 + Math.min(1, c) * (cm - 1)));
  const main = { spellId: id, name: sp.name, school: sp.school, tl, base: rnd(raw), pct: r4(mult - 1), ...hit(raw, mult, c, cm) };
  let pet = null;
  if (p.classId === 'hunter' && p.pet) {
    const po = { school: 'phys', spell: 'pet' };
    const pm = snapshot(sh, 'pet', 0, 1, po);
    pet = { id: p.pet.id, name: PET[p.pet.id] ? PET[p.pet.id].name : p.pet.id, base: rnd(p.d.petDmg), pct: r4(petPct(sh)), ...hit(p.d.petDmg, pm, critChance(sh, 'pet', 0, po), critMult(sh, 'pet')) };
  }
  return { pct: r4(playerPct(sh, null)), main, pet, perPower: per('p'), perWd: r2(((sp.w || 0) + (sp.wFlat || 0)) * mult * (1 + Math.min(1, c) * (cm - 1))) };
}
