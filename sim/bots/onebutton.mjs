// onebutton bot (owner feedback docs/feedback/2026-11-11-1841-owner.md; report docs/reports/mash-2026-11-11.md): the
// planner for everything outside combat (map, hubs, gear, start camp, Camp), so only combat skill differs; in combat
// it presses one key. Engage round: the class's strike option (combat-v2.md 6.2) on the default target, the Mage's
// Pre-cast with the slot-1 spell. Every later turn: a healing item when HP < AUTO_POTION_HP (variant 'nopot': never);
// else the slot-1 spell on the default target; when it is not usable (cost, cooldown) the basic attack; else PASS.
// The slot-1 spell is the class's first start spell (C.CLASS[cls].startSpells[0]: Gutting Jab, Ember Bolt, Keen
// Shot), the spell in bar slot 1 of the game's default bar, the key the owner pressed. It never reads intents, the
// track or OFF_BALANCE windows (qa/sim/onebutton.test.mjs). The default target is the engine's (rules 7.9: mender >
// caster > others, lowest HP), what an action aims at when the player picks no target.
// Talents: the slot-1 tree (slot1Tree: the tree whose talents name the slot-1 spell or its school with the most ranks:
// Bladework, Pyromancy, Marksmanship; the same trees as autopilot's C.AUTO_TREE), those talents first, then the
// standard build of that tree (balance.md 1.3). Bar: the planner's template (it always holds the slot-1 spell), so
// replays of its fights with other combat policies (sim/lib/replay.mjs replayThink) play the planner's bar on the same
// character. Manual time profile.
import { C, R, TALENT, legal } from '../lib/engine.mjs';
import { defaultTarget, engageActions, engageId, engageKind } from '../lib/view.mjs';
import { talentOrder, standardTalent } from '../lib/policy.mjs';
import { healItem } from './masher.mjs';
import { createPlannerBot } from './planner.mjs';

/** The slot-1 spell of a class: its first start spell (the key "1" of the default bar). */
export const slot1Spell = (cls) => C.CLASS[cls].startSpells[0];

/**
 * Talents whose effect names the slot-1 spell or its school [source: docs/specs/rules.md 6.1-6.3, effect column]:
 * Rogue (Gutting Jab): Swift Hands, Riposte Stance, Twin Fangs (Bladework); Toxic Coating, Septic Edge (Venomcraft).
 * Mage (Ember Bolt, fire): Kindling, Searing Focus, Fire Economy, Combustive Crits (Pyromancy).
 * Hunter (Keen Shot, a shot): Steady Aim, Efficiency, Mortal Shots (Marksmanship).
 * Generic talents (crit chance, Power, mana) are left out: they boost every button alike.
 */
export const SLOT1_TALENTS = {
  rogue: ['r_a2', 'r_a4', 'r_a7', 'r_c1', 'r_c6'],
  mage: ['m_a1', 'm_a2', 'm_a4', 'm_a5'],
  hunter: ['h_b1', 'h_b3', 'h_b4'],
};

/** Ranks of the slot-1 talents per tree of a class (from C.TALENT): [tree0, tree1, tree2]. */
export function slot1Ranks(cls) {
  const r = [0, 0, 0];
  for (const id of SLOT1_TALENTS[cls]) r[TALENT[id].tree] += TALENT[id].ranks;
  return r;
}

/** The slot-1 tree: most slot-1 talent ranks (ties: lower index). */
export function slot1Tree(cls) {
  const r = slot1Ranks(cls);
  return r.indexOf(Math.max(...r));
}

/** The slot-1 trees of all classes: { rogue, mage, hunter } (run.mjs: the onebutton cells' default trees). */
export const oneButtonTrees = () => Object.fromEntries(C.CLASS_IDS.map((c) => [c, slot1Tree(c)]));

/**
 * Talent policy: the slot-1 talents of `tree` in standard order (tier, then ranks) while their tier gate allows, then
 * the standard build of `tree` (capstone first, then the other trees alternately).
 */
export function oneButtonTalent(s, tree) {
  const cls = s.player.classId;
  const mine = new Set(SLOT1_TALENTS[cls].filter((id) => TALENT[id].tree === tree));
  for (const id of talentOrder(cls, tree)) if (mine.has(id) && legal(s, { type: 'SPEND_TALENT', talentId: id })) return id;
  return standardTalent(s, tree);
}

/** Engage round: the strike option on the default target (Pre-cast: with the slot-1 spell); null when none is legal. */
function strikeEngage(s, tgt, spell) {
  for (const a of engageActions(s)) {
    if (engageKind(engageId(a)) !== 'strike') continue;
    if (typeof a.target === 'number' && a.target !== tgt) continue;
    if (a.spellId && a.spellId !== spell) continue;
    return a;
  }
  return null;
}

/** One combat turn of the onebutton bot (potions: use healing items at HP < AUTO_POTION_HP). */
export function oneButtonChoice(s, { potions = true } = {}) {
  const f = s.fight;
  if (f.p.skip) return { type: 'PASS' };
  const p = s.player;
  const spell = slot1Spell(p.classId);
  const tgt = defaultTarget(s);
  const eng = strikeEngage(s, tgt, spell);
  if (eng) return eng;
  if (potions && p.hp < C.AUTO_POTION_HP * p.d.maxHp) {
    const h = healItem(s);
    if (h) return h;
  }
  const cast = { type: 'CAST', spellId: spell, target: C.SPELL[spell].target === 'enemy' ? tgt : null };
  if (R.isLegal(s, cast)) return cast;
  const atk = { type: 'ATTACK', target: tgt };
  return R.isLegal(s, atk) ? atk : { type: 'PASS' };
}

/** opts as createBot (variant 'nopot': no healing items in fights). */
export function createOneButtonBot(opts) {
  const potions = opts.variant !== 'nopot';
  const tree = opts.tree ?? slot1Tree(opts.classId);
  return createPlannerBot({ ...opts, tree, name: 'onebutton', combat: (s) => oneButtonChoice(s, { potions }), talent: (s) => oneButtonTalent(s, tree) });
}
