// Wind-up answers (rules 7.7, 7.10-7.13; M2b v13, docs/specs/changes-m2b-v13.md "UI needs" 1, 2, 4 and 8): for every
// wind-up on the enemies' tracks (each Deathblow among them) what it costs if it lands, which of the player's options
// answer it now ("answers ready"), and autoplay's engage answer (rule E2) for the engage-round hint. Read-only views:
// no draw, no state change; engine-api.md 6.2.
// M2b v14 (docs/specs/changes-m2b-v14.md row 1 and "UI needs" 1-2, D111): Sap is sure if the Rogue waits while no other
// enemy can be hit (`wait`), a PASS that waits for it is an answer (`via` 'pass'), and the hint says autoplay will wait.

import { SPELL, ENGAGE_OPTION, ENGAGE_OPTIONS, DEATHBLOW_EMPOWER, EMPOWER_DMG, STAGGER_DMG, MAIM_HEAL, GATES } from '../constants.js';
import { findSt, hasSt, petAlive } from './damage.js';
import { isEngageRound, isSingle, turnOf } from './track.js';
import { engageAct, engageError, engagePreview, isDisrupt, windupTurn } from './engage.js';
import { castError, passKeepsStealth } from './spells.js';
import { allSapped } from './combat.js';
import { engageAnswer } from './autoplay.js';

/** Bar spells whose control lands only on a hit (spells.js: Rime Burst, Deadfall Trap); every other answer is sure. */
const NEEDS_HIT = ['rime_burst', 'deadfall_trap'];
/** Bar spells that cancel the wind-up when it is now (rules 7.7, 7.11): interrupts, stun-tagged spells, Hexbind (HEXED). */
const stops = (sp) => sp.tags.includes('interrupt') || sp.tags.includes('stun') || sp.id === 'hexbind';
/**
 * Defensives against a heavy wind-up (rules 7.13 (3): it is answered when it costs the player 0 HP): how they do it and
 * whether that is sure (IMMUNE; the pet taking a single-target hit) or a chance or an amount (dodge, image, WARD, STEALTH).
 */
const DEFENSIVE = {
  glacial_tomb: ['immune', true], feign_stillness: ['pet', true], beastcall_horn: ['pet', true],
  arcane_ward: ['ward', false], mirrorshade: ['image', false], smoke_veil: ['dodge', false], vanishing_step: ['stealth', false],
};

/** Every legal ENGAGE action now (rules 7.10): option × target (× bar spell for Pre-cast). */
function engageActions(s) {
  const f = s.fight;
  const out = [];
  const live = f.enemies.filter((e) => e.alive).map((e) => e.idx);
  for (const id of ENGAGE_OPTIONS[s.player.classId]) {
    const o = ENGAGE_OPTION[id];
    if (o.target === 'spell') {
      for (const sid of s.player.bar) {
        if (!sid) continue;
        for (const t of SPELL[sid].target === 'enemy' ? live : [null]) out.push(engageAct(id, t, sid));
      }
    } else for (const t of o.target === 'none' ? [null] : live) out.push(engageAct(id, t));
  }
  return out.filter((a) => !engageError(s, a));
}

/** Engage-round answers to wind-up x of enemy e: ENGAGE actions whose preview cancels it, or sends its heavy single hit to the pet. */
function engageAnswers(s, e, x, acts) {
  const f = s.fight;
  const out = [];
  for (const a of acts) {
    const pv = engagePreview(s, a);
    const it = pv && pv.enemies.find((y) => y.u === e.idx);
    if (!it) continue;
    const o = ENGAGE_OPTION[a.option];
    const disrupt = isDisrupt(s, a);
    let how = null;
    if (it.stagger.includes(x.turn)) how = disrupt ? 'disrupt' : 'control';
    else if (x.heavy && isSingle(x.kind) && it.pet.includes(x.turn)) how = 'pet';
    if (!how) continue;
    const breaks = !disrupt && (a.option === 'sap' || a.spellId === 'hexbind');
    // M2b v14 (UI need 2): Sap is sure if the Rogue then waits (PASS) until the wind-up's turn, when every other living
    // enemy is SAPPED or none lives (nothing else to hit) and the wind-up comes after the enemy's turn 1; `stealth`: the
    // passes keep STEALTH (rules 7.4).
    const wait = a.option === 'sap' && !disrupt && x.turn > 1 && f.enemies.every((y) => !y.alive || y.idx === a.target || hasSt(y.st, 'SAPPED'));
    out.push({
      via: 'engage', id: a.option, name: disrupt ? 'Disrupt' : o.name, target: a.target, ...(a.spellId ? { spellId: a.spellId } : {}),
      how, sure: !breaks && a.spellId !== 'rime_burst', now: true, ...(breaks ? { breaks: true } : {}),
      ...(wait ? { wait: true, stealth: !!GATES.passStealth && hasSt(f.p.st, 'STEALTH') } : {}),
    });
  }
  return out;
}

/**
 * Bar answers to wind-up x of enemy e, played in round R: interrupts, stun-tagged spells and Hexbind (any wind-up; on a
 * CC-immune enemy they interrupt), and for a heavy one the defensives. Listed when the spell's cooldown is over by round R;
 * `now` = it can be cast this round (castError), only when R is this round.
 */
function barAnswers(s, e, x, R) {
  const f = s.fight;
  const out = [];
  for (const id of s.player.bar) {
    if (!id) continue;
    const sp = SPELL[id];
    let how = null;
    let sure = true;
    if (stops(sp)) {
      how = sp.tags.includes('interrupt') ? 'interrupt' : id === 'hexbind' ? 'control' : 'stun';
      sure = !NEEDS_HIT.includes(id);
    } else if (x.heavy && DEFENSIVE[id]) {
      [how, sure] = DEFENSIVE[id];
      if (how === 'pet' && (!isSingle(x.kind) || !petAlive(s))) continue;
    }
    if (!how || (f.p.cds[id] || 0) > R) continue;
    const t = sp.target === 'enemy' ? e.idx : null;
    out.push({ via: 'spell', id, name: sp.name, target: t, how, sure, now: R === f.round && !castError(s, id, t) });
  }
  return out;
}

/**
 * The PASS answer (M2b v14 row 1, D111; UI need 2): before wind-up x of SAPPED enemy e (after its now-entry), while every
 * living enemy is SAPPED and the track predicts the cancel by SAPPED, waiting is the answer: Sap cancels it at its turn
 * (STAGGERED). `stealth`: the PASS keeps STEALTH (rules 7.4). Autoplay plays it (rule H) when GATES.sapHold is on.
 */
function passAnswer(s, e, x) {
  const f = s.fight;
  if (isEngageRound(f) || x.turn <= turnOf(f, e) || !allSapped(s)) return [];
  if (!(x.cancel && x.cancel.by === 'SAPPED' && x.cancel.stagger)) return [];
  return [{ via: 'pass', id: 'pass', name: 'Pass', target: null, how: 'wait', sure: true, now: true, stealth: passKeepsStealth(s) && hasSt(f.p.st, 'STEALTH') }];
}

/**
 * Wind-up view (M2b v13, engine-api.md 6.2): one item per wind-up in the living enemies' tracks (enemy index order, then
 * turn), null outside a fight. Item: { u, enemy, turn, round, inRounds, id, name, kind, deathblow, firstMeet, heavy,
 * target, est, empower, maims, stagger, cancel, answers, ready }. est: its estimated damage now (a Deathblow's includes
 * DEATHBLOW_MULT). empower: the EMPOWERED value it adds if it lands (DEATHBLOW_EMPOWER or EMPOWER_DMG); maims: it would
 * MAIM the player (a Deathblow while the player is not MAIMED); stagger: STAGGER_DMG if answered. cancel: the track's
 * prediction (D52) that it will be cancelled. answers: [{ via ('engage' | 'spell'), id (option or spell id), name ('Disrupt'
 * on a CC-immune enemy), target, spellId (Pre-cast), how ('disrupt', 'control', 'pet', 'interrupt', 'stun', 'immune',
 * 'ward', 'image', 'dodge', 'stealth', 'wait'), sure (false: a chance, an amount or a hit roll), now (usable this round),
 * breaks (Sap, Hexbind: any damage ends it before the wind-up's turn), wait and stealth (M2b v14: Sap, sure if the player
 * then passes; the passes keep STEALTH) }]: engage answers only in the engage round; the PASS answer (`via` 'pass', how
 * 'wait'; M2b v14) while every living enemy is SAPPED and Sap will cancel it; bar answers whose cooldown is over by the
 * wind-up's round. ready: an answer or a cancel that does not break exists.
 */
export function windupView(s) {
  const f = s.fight;
  if (!f || !s.player) return null;
  const acts = isEngageRound(f) ? engageActions(s) : [];
  const maimed = !!findSt(f.p.st, 'MAIMED');
  const out = [];
  for (const e of f.enemies) {
    if (!e.alive || e.kind === 'boss' || !e.track) continue;
    for (const x of e.track) {
      if (!x.windup) continue;
      const R = e.turn0 + x.turn - 1;
      const answers = [...(acts.length ? engageAnswers(s, e, x, acts) : []), ...passAnswer(s, e, x), ...barAnswers(s, e, x, R)];
      const cancel = x.cancel || null;
      out.push({
        u: e.idx, enemy: e.name, turn: x.turn, round: R, inRounds: R - f.round, id: x.id, name: x.name, kind: x.kind,
        deathblow: !!x.deathblow, firstMeet: !!x.firstMeet, heavy: !!x.heavy, target: x.target, est: x.est,
        empower: x.deathblow ? DEATHBLOW_EMPOWER : EMPOWER_DMG, maims: !!x.deathblow && !maimed, maimHeal: x.deathblow ? MAIM_HEAL : 0,
        stagger: STAGGER_DMG, cancel, answers, ready: answers.length > 0 || !!(cancel && cancel.stagger && !cancel.breaks),
      });
    }
  }
  return out;
}

/**
 * Autoplay's engage answer for the UI hint (M2b v13 UI list 8: "Autoplay will answer the Deathblow with <option>"): in the
 * engage round, when rule E2 acts (rules 7.9): { action (the ENGAGE autoAction plays), option, name ('Disrupt' on a
 * CC-immune enemy, else the option's name), target, enemy (its name), windup: { turn, id, name, deathblow }, wait (M2b
 * v14: true when rule H will then wait a round: "..., then wait a round") }; else null. Shown whether or not autoplay is
 * on; the front end shows it when it is.
 */
export function autoplayEngage(s) {
  if (!s.fight || !s.player) return null;
  const a = engageAnswer(s);
  if (!a) return null;
  const e = s.fight.enemies[a.target];
  const t = windupTurn(e);
  const x = e.track.find((y) => y.turn === t);
  // M2b v14 (UI need 1): `wait` when rule H will apply next round: a Sap (not Disrupt) that leaves every living enemy
  // SAPPED, on a wind-up after the enemy's turn 1 that the Sap cancels (engagePreview), with GATES.sapHold on.
  const pv = a.option === 'sap' && !isDisrupt(s, a) ? engagePreview(s, a) : null;
  const it = pv && pv.enemies.find((y) => y.u === a.target);
  const lone = s.fight.enemies.every((y) => !y.alive || y.idx === a.target || hasSt(y.st, 'SAPPED'));
  const wait = !!(GATES.sapHold && it && it.stagger.includes(t) && t > 1 && lone);
  return {
    action: a, option: a.option, name: isDisrupt(s, a) ? 'Disrupt' : ENGAGE_OPTION[a.option].name, target: a.target, enemy: e.name,
    windup: { turn: x.turn, id: x.id, name: x.name, deathblow: !!x.deathblow }, ...(wait ? { wait: true } : {}),
  };
}
