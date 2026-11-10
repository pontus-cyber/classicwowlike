// combat-feel.js - presentation timing of combat: how long each beat of a step plays at 1x speed and how heavy each
// action feels. Owner feedback 2026-11-10 (docs/feedback/2026-11-10-1043-owner.md): rounds at the default speed at least
// 40 % slower than the round budget of M2 v2 (rules 3: PACE_ROUND_ANIM_S, 1.5 s), every hit readable, and time that
// shows each ability's weight: the Rogue strikes at once, the Hunter draws the bow and the arrow flies, the Mage's light
// spells land at once while heavy spells build up and travel slower.
// Pure (no DOM) and no rules: an ability's weight is read from the engine's spell entry (power and weapon coefficients,
// hits, cooldown, tags); a hit's weight from the damage it did against the target's maximum health.
import { clamp, lerp } from './util.js';

/** The M2 v2 round budget the owner's "40 % slower" refers to (rules 3: PACE_ROUND_ANIM_S = 1.5 s). */
export const OLD_ROUND_MS = 1500;
/** Owner 2026-11-10: rounds at the default speed at least 40 % longer than OLD_ROUND_MS. */
export const SLOWER = 1.4;
/** The round cap: a round with many actors is compressed to this multiple of the average round. */
const CAP_OVER_AVG = 1.4;
/** Beats are tuned for this average round (ms at 1x, with about 150 ms of rendering and engine time on top). */
const TUNED_AVG_MS = OLD_ROUND_MS * SLOWER;

/**
 * Round pace at the default speed (1x): avgMs, the average round time the beats are tuned for: the engine's
 * PACE_ROUND_ANIM_S (rules.roundAnimMs) when it asks for more than the owner's floor, else 1.4 × 1.5 s = 2.1 s; capMs, the
 * most a round may take (a round with many actors is compressed to it); scale, how much every beat is stretched.
 */
export function roundPace(rules) {
  const avgMs = Math.max((rules && rules.roundAnimMs) || 0, TUNED_AVG_MS);
  return { avgMs, capMs: Math.round(avgMs * CAP_OVER_AVG), scale: avgMs / TUNED_AVG_MS };
}

// Beat lengths in ms at 1x. [light, heavy] pairs are interpolated by weight (0..1).
export const BEAT = {
  rogue: { windup: [80, 130] },                     // time from the key to the blade landing (contact)
  hunter: { draw: [180, 380], flight: [210, 320] }, // bow draw, then the arrow's flight
  mage: { cast: [70, 520], flight: [110, 400] },    // cast build-up, then the bolt's flight
  self: { cast: 240, aura: 220 },                   // buffs, heals, defensives on the player
  pass: 320, item: 340,
  pet: { windup: 100 },
  enemy: { melee: 380, heavy: 700, cast: 340, castFlight: 280, heavyCast: 560, boss: 600, support: 360 },
  nextEnemy: 0.55,                                  // wind-up of a later enemy in the same round (not a heavy one)
  hit: { stop: [45, 100], settle: [200, 280] },     // the player's hits on an enemy: hit-stop, then recoil and number
  rogueHit: { stop: [40, 85], settle: [300, 370] },
  petHit: { stop: [24, 38], settle: [80, 110] },
  taken: { stop: [60, 115], settle: [230, 310] },   // enemy hits on the player or the pet
  nextTaken: 0.6,                                   // settle of a later enemy's hit in the same round
  heavyPause: 380,                                  // after a telegraphed heavy hit lands: time to read it
  follow: 0.45,                                     // later hits of one action (multi-hit, AoE): settle × this
  ticks: 220, nextTick: 45,                         // the round's DoT and HoT ticks pop together: one beat, a small stagger
  miss: 240, immune: 240, heal: 240, status: 120, interrupt: 360, skip: 160, cleanse: 220, death: 440,
  round: 300, flee: 600, fleeFail: 320, summon: 600, channel: 480, linked: 280,
};

/**
 * Weight of a player spell, 0 (light: lands almost at once) .. 1 (heavy: build-up and a slower flight), from the engine's
 * spell entry `raw` (R.C.SPELL[id]): the larger of its power (p) and weapon (w) coefficients times its hits (0.75 and less
 * is light, 2.0 and more heavy), a gjFrac
 * strike series as that share of a jab per hit; +0.15 for a damaging spell with a cooldown of 3 rounds or more, +0.3
 * for area damage; interrupts and control spells without damage are light. A finisher that scales per combo point
 * weighs by the points spent (cp, 0..5).
 */
export function spellWeight(raw, cp = 0) {
  if (!raw) return 0.15;
  const tags = raw.tags || [];
  if (tags.includes('interrupt')) return 0;
  if (raw.perCp) return clamp((cp || 0) / 5, 0, 1) * 0.8;
  const hits = raw.hits || 1;
  let coef = Math.max(raw.p || 0, raw.w || 0) * hits;
  if (raw.gjFrac) coef = raw.gjFrac * hits * 0.9;
  if (!coef) return 0.1;
  let w = clamp((coef - 0.75) / 1.25, 0, 1);
  if ((raw.cd || 0) >= 3 && coef >= 1) w += 0.15;
  if (tags.includes('aoe')) w += 0.3;
  return clamp(w, 0, 1);
}

/** Weight of one hit, 0..1: the share of the target's maximum health it took (a quarter or more = 1), crits, and the action's weight. */
export function hitPower(e, actionWeight = 0) {
  const share = e.maxHp ? (e.amount || 0) / e.maxHp : 0;
  return clamp(Math.max(share * 4, actionWeight * 0.7, e.crit ? 0.55 : 0), 0, 1);
}
/** Share of the target's maximum health a hit took (screen shake scales with it). */
export const hitShare = (e) => (e.maxHp ? clamp((e.amount || 0) / e.maxHp, 0, 1) : 0);

/** Floating labels of statuses when they are applied (each takes a short beat). */
export const STATUS_LABEL = { STUN: 'Stunned!', FROZEN: 'Frozen!', HEXED: 'Hexed!', SILENCED: 'Silenced', CHILLED: 'Chilled', EXPOSED: 'Exposed', MARKED: 'Marked', CURSED: 'Cursed', BRAND: 'Brand', ENRAGED: 'Enraged!', TAUNT: 'Taunt!', SHIELDED: 'Braced',
  // combat v2: the window and the engage options' statuses
  OFF_BALANCE: 'Off-balance!', SAPPED: 'Sapped!', TRAP: 'Trap set', GATHER: 'Gathered Power' };
/**
 * Weight of an engage option's action (combat v2, rules 7.10; the presentation of ENGAGE, which has no spell entry): the
 * strikes like a solid spell, control and setup options light. Pre-cast plays as the bar spell it casts.
 */
export const ENGAGE_WEIGHT = { ambush: 0.6, opening_shot: 0.55, sap: 0.25, binding_glyph: 0.35, lay_trap: 0.15, send_pet: 0.15, premeditate: 0.1, gather_power: 0.2 };

const selfOnly = (e) => !e.dst || (e.tags && (e.tags.includes('defensive') || e.tags.includes('resource') || e.tags.includes('heal')) && !e.tags.includes('aoe'));

/**
 * The timeline of one step at 1x: one timing per event (beats[i] for events[i]) and the total of the waits play() makes.
 * prev: the view before the step (class, combo points); spells: data.spells (raw = the engine's entry).
 * Timings: player/pet/enemy action { side, style, windup, travel, act, w, aoe, heavy } (wait = windup + travel, + aura
 * for a buff); damage { stop, settle, pause, power } (wait = stop + settle + pause); others { wait }.
 */
export function timeline(events, prev, spells, scale = 1) {
  const cls = prev && prev.player ? prev.player.classId : null;
  let cp = prev && prev.player ? prev.player.cp || 0 : 0;
  const beats = []; let total = 0;
  let act = null; // the action whose hits follow: { side, w, heavy, hits }
  let foes = 0; // enemy actions so far in this round
  let ticks = 0; // DoT ticks so far in the run of ticks
  const S = (ms) => ms * scale;
  for (const e of events) {
    let b = { wait: 0 };
    if (e.t === 'action' || e.t === 'round' || (e.t === 'damage' && !e.tick)) ticks = 0;
    switch (e.t) {
      case 'action': {
        if (e.src.side === 'player') {
          if (e.kind === 'pass') { b = { side: 'player', style: 'pass', wait: S(BEAT.pass) }; act = null; break; }
          if (e.kind === 'item') { b = { side: 'player', style: 'item', wait: S(BEAT.item), act: S(420) }; act = null; break; }
          const sp = spells && e.id && e.kind !== 'engage' ? spells[e.id] : null;
          const w = e.kind === 'attack' ? 0.12 : e.kind === 'engage' ? ENGAGE_WEIGHT[e.option] ?? 0.2 : spellWeight(sp && sp.raw, cp);
          const self = selfOnly(e);
          if (self) b = { side: 'player', style: 'self', windup: S(BEAT.self.cast), travel: 0, aura: S(BEAT.self.aura), act: S(BEAT.self.cast * 1.6), w };
          else if (cls === 'rogue') { const wu = S(lerp(BEAT.rogue.windup[0], BEAT.rogue.windup[1], w)); b = { side: 'player', style: 'melee', windup: wu, travel: 0, act: wu / 0.42, w }; }
          else if (cls === 'hunter') { const wu = S(lerp(BEAT.hunter.draw[0], BEAT.hunter.draw[1], w)); b = { side: 'player', style: 'shoot', windup: wu, travel: e.dst ? S(lerp(BEAT.hunter.flight[0], BEAT.hunter.flight[1], w)) : 0, act: wu / 0.6, w }; }
          else { const wu = S(lerp(BEAT.mage.cast[0], BEAT.mage.cast[1], w)); b = { side: 'player', style: 'cast', windup: wu, travel: e.dst ? S(lerp(BEAT.mage.flight[0], BEAT.mage.flight[1], w)) : 0, act: wu / 0.6, w }; }
          b.aoe = !!e.aoe;
          b.wait = b.windup + b.travel + (b.aura || 0);
          act = { side: 'player', w, heavy: false, hits: 0, rogue: cls === 'rogue' };
          if (sp && sp.raw && sp.raw.perCp) cp = 0;
        } else if (e.src.side === 'pet') {
          b = { side: 'pet', style: 'melee', windup: S(BEAT.pet.windup), travel: 0, act: S(BEAT.pet.windup) / 0.45, w: 0.1 };
          b.wait = b.windup; act = { side: 'pet', w: 0.1, heavy: false, hits: 0 };
        } else {
          const E = BEAT.enemy;
          const style = e.support ? 'support' : e.boss ? 'boss' : e.kind === 'cast' ? 'cast' : 'melee';
          const later = foes > 0 && !e.heavy ? BEAT.nextEnemy : 1;
          const windup = S((style === 'support' ? E.support : style === 'boss' ? E.boss : style === 'cast' ? (e.heavy ? E.heavyCast : E.cast) : e.heavy ? E.heavy : E.melee) * later);
          const travel = style === 'cast' && e.dst ? S(E.castFlight * (e.heavy ? 1.25 : 1)) : 0;
          b = { side: 'enemy', style, windup, travel, act: windup / (style === 'melee' ? 0.5 : 0.6), heavy: !!e.heavy };
          b.wait = windup + travel; act = { side: 'enemy', w: e.heavy ? 0.8 : 0.3, heavy: !!e.heavy, hits: 0, later: foes > 0 };
          foes += 1;
        }
        break;
      }
      case 'damage': {
        if (e.miss) { b = { wait: S(BEAT.miss) }; break; }
        if (e.immune) { b = { wait: S(BEAT.immune) }; break; }
        if (e.tick) { b = { wait: S(ticks ? BEAT.nextTick : BEAT.ticks), tick: true }; ticks += 1; break; }
        const taken = e.dst.side === 'player' || e.dst.side === 'pet';
        const src = act || { side: e.src.side === 'enemy' ? 'enemy' : 'player', w: 0.3, heavy: false, hits: 0 };
        const power = hitPower(e, src.w);
        const T = taken ? BEAT.taken : src.side === 'pet' ? BEAT.petHit : src.rogue ? BEAT.rogueHit : BEAT.hit;
        const k = e.crit ? Math.min(1, power + 0.2) : power;
        const follow = src.hits > 0 ? BEAT.follow : taken && src.later && !src.heavy ? BEAT.nextTaken : 1;
        b = { stop: S(lerp(T.stop[0], T.stop[1], k)), settle: S(lerp(T.settle[0], T.settle[1], k) * follow), pause: 0, power, taken };
        if (taken && src.heavy && !src.paused) { b.pause = S(BEAT.heavyPause); src.paused = true; }
        b.wait = b.stop + b.settle + b.pause;
        src.hits += 1; act = src;
        break;
      }
      case 'heal': b = { wait: S(BEAT.heal) }; break;
      case 'status': b = { wait: e.op === 'add' && STATUS_LABEL[e.id] ? S(BEAT.status) : 0 }; break;
      case 'interrupt': b = { wait: S(BEAT.interrupt) }; break;
      case 'immune': b = { wait: S(BEAT.immune) }; break;
      case 'skip': b = { wait: S(BEAT.skip) }; break;
      case 'cleanse': b = { wait: S(BEAT.cleanse) }; break;
      case 'cp': cp = e.after; break;
      case 'death': b = { wait: e.dst.side !== 'player' ? S(BEAT.death) : 0 }; break;
      case 'round': b = { wait: S(BEAT.round) }; act = null; foes = 0; break;
      case 'flee': b = { wait: S(e.ok ? BEAT.flee : BEAT.fleeFail) }; break;
      case 'summon': b = { wait: S(BEAT.summon) }; break;
      case 'channel': b = { wait: S(BEAT.channel) }; break;
      case 'linked': b = { wait: S(BEAT.linked) }; break;
      default: break;
    }
    beats.push(b); total += b.wait || 0;
  }
  return { beats, total };
}
