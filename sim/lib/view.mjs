// Player-visible view of a fight and the combat v2 adapters the bots and the recorder share (combat-v2.md 3, 5,
// 6, 11). The look-ahead bots (opener, tactician engage search) plan only on playerView(): a copy of the state in
// which every part a player cannot see is replaced by a stream drawn from the bot stream, so a plan can only use
// what the player sees (combat-v2.md 11 "Look-ahead fairness": entries already in the track are facts; entries not
// yet shown are re-drawn). The hidden parts are listed in HIDDEN and are never read here; qa/sim/combat2.test.mjs
// checks that the opener's choice does not change when they change and that it never reads them.
// Adapters: one place that knows how the engine shows the engage round, the engage options, the intent track and
// OFF_BALANCE, so the bots work on the M2 v5 engine (no track, Rogue stealth round only) and on combat v2.
import { R, C, makeRng } from './engine.mjs';
import { treeClone } from './clone.mjs';

/** Hidden parts of the state: the random streams. state.lootRng and state.fight.rng. */
export const HIDDEN = Object.freeze({ state: ['lootRng'], fight: ['rng'] });

/**
 * Look-ahead copy of a fight state built only from visible parts: as fightClone (sim/lib/clone.mjs), but the fight
 * stream and the loot stream are fresh streams seeded from `rng` (a BotRng). The hidden fields are skipped, never
 * read. Re-seed `view.fight.rng` per sample (resample) to draw other unseen futures.
 */
export function playerView(s, rng) {
  const o = {};
  for (const k in s) {
    if (HIDDEN.state.includes(k) || k === 'fight') continue;
    o[k] = s[k];
  }
  const f = s.fight;
  const vf = {};
  for (const k in f) {
    if (HIDDEN.fight.includes(k)) continue;
    vf[k] = treeClone(f[k]);
  }
  vf.rng = makeRng(rng.u32());
  o.fight = vf;
  o.lootRng = f.kind === 'boss' ? null : makeRng(rng.u32());
  o.player = treeClone(s.player);
  o.stats = treeClone(s.stats);
  o.node = treeClone(s.node);
  o.loot = treeClone(s.loot);
  o.death = treeClone(s.death);
  o.service = treeClone(s.service);
  o.hub = treeClone(s.hub);
  o.camp = treeClone(s.camp);
  if (s.zone) {
    o.zone = { ...s.zone, pos: { ...s.zone.pos } };
    if (s.zone.rows) o.zone.rows = s.zone.rows.map((row) => row.map((n) => ({ ...n })));
    if (s.zone.path) o.zone.path = s.zone.path.slice();
  }
  return o;
}

/** A copy of a view for one look-ahead sample: as fightClone, with its own fight stream from `seed`. */
export function resample(view, seed, clone) {
  const c = clone(view);
  c.fight.rng = makeRng(seed >>> 0);
  return c;
}

// ---------------- Combat v2 adapters ----------------
/** Status id of OFF_BALANCE (combat-v2.md 5): the engine's id, else the spec's name. */
export const OFFBAL_ID = typeof C.OFFBAL_STATUS === 'string' ? C.OFFBAL_STATUS : 'OFF_BALANCE';
const OFFBAL_IDS = new Set([OFFBAL_ID, 'OFF_BALANCE', 'OFFBAL']);
export const isOffBalanceId = (id) => OFFBAL_IDS.has(id);
export const offBalance = (e) => !!(e && e.alive && e.st.some((x) => OFFBAL_IDS.has(x.id)));
/** The enemy is in a window the engine counts (combat v2 R.offBalance: OFF_BALANCE, or FROZEN while it lasts). */
export function inWindow(s, e) {
  if (!e || !e.alive) return false;
  if (typeof R.offBalance === 'function') return !!R.offBalance(s, e.idx);
  return offBalance(e);
}

/** True in the engage round (combat-v2.md 6): round 1 of a fight with one (every non-boss fight in v2, the Rogue's
 *  stealth round before). */
export function isEngageRound(s) {
  const f = s.fight;
  if (!f) return false;
  if (typeof R.isEngageRound === 'function') return !!R.isEngageRound(s);
  if (f.round !== 1 || f.kind === 'boss') return false;
  if (f.engage !== undefined) return !!f.engage;
  return !!f.unaware;
}

/** ENGAGE actions legal now (combat-v2.md 6.1), from the engine's legal actions. */
export function engageActions(s) {
  if (!isEngageRound(s)) return [];
  return R.legalActions(s).filter((a) => a.type === 'ENGAGE');
}

/** Option id of an ENGAGE action (field name of the engine's action). */
export const engageId = (a) => (a ? a.option ?? a.optionId ?? a.id ?? null : null);

/** Engage option kinds of combat-v2.md 6.2 (strike, control, setup); the engine's table when it has one. */
const ENGAGE_KIND = {
  ambush: 'strike', sap: 'control', premeditate: 'setup',
  precast: 'strike', binding_glyph: 'control', gather_power: 'setup',
  opening_shot: 'strike', lay_trap: 'control', send_pet: 'setup',
};
export function engageKind(id) {
  const t = C.ENGAGE_OPTION || null;
  if (t && t[id] && t[id].kind) return t[id].kind;
  return ENGAGE_KIND[id] || 'other';
}
/** Engage options per class (combat-v2.md 6.2) in the order strike, control, setup: the engine's table when it has one. */
export const CLASS_ENGAGE = C.ENGAGE_OPTIONS || { rogue: ['ambush', 'sap', 'premeditate'], mage: ['precast', 'binding_glyph', 'gather_power'], hunter: ['opening_shot', 'lay_trap', 'send_pet'] };

/**
 * Visible track of an enemy (combat-v2.md 3.1): [{ turn, id, heavy, cast, est, target, ... }], "now" first. The
 * M2 v5 engine has no track: its current intent is the only entry.
 */
export function trackOf(e) {
  if (!e || !e.alive) return [];
  if (Array.isArray(e.track)) return e.track;
  return e.intent ? [e.intent] : [];
}

/** An entry announces a big move (heavy hit or cast) that is not already stopped. */
export const isThreat = (it) => !!(it && (it.heavy || it.cast) && !it.interrupted && !it.skipped && !it.cancelled);

/**
 * The enemy's next `n` actions as the player sees them: in the engage round the track's first entries (turns 1..n;
 * nobody acts this round); later the now-entry as it will be played (enemy.intent: cancelled, replaced, interrupted
 * show there) and the track entries after it. M2 v5 engine: the current intent only.
 */
export function nextEntries(s, e, n = 2) {
  if (!e || !e.alive) return [];
  const tr = trackOf(e);
  if (!Array.isArray(e.track)) return tr.slice(0, n);
  if (isEngageRound(s)) return tr.slice(0, n);
  return [e.intent, ...tr.slice(1, n)].filter(Boolean);
}

/** Estimated damage on the player of an enemy's next `n` actions (nextEntries; the est values the UI shows). */
export function trackDamage(s, e, n = 2) {
  let d = 0;
  for (const it of nextEntries(s, e, n)) if (it && (it.target === 'player' || it.target === 'all') && !it.interrupted && !it.cancelled) d += it.est || 0;
  return d;
}

/**
 * Default target (rules 7.9): the engine's when it exports one; else rules 7.9 as written there (living, not HEXED,
 * mender > caster > others, lowest HP, lowest index; HEXED enemies only when no other is left).
 */
const PRIORITY = { mender: 0, caster: 1 };
export function defaultTarget(s) {
  if (typeof R.defaultTarget === 'function') return R.defaultTarget(s);
  const f = s.fight;
  const rank = (e) => (e.arch in PRIORITY ? PRIORITY[e.arch] : 2);
  for (const pass of [false, true]) {
    let best = null;
    for (const e of f.enemies) {
      if (!e.alive || (!pass && e.st.some((x) => x.id === 'HEXED'))) continue;
      if (!best || rank(e) < rank(best) || (rank(e) === rank(best) && e.hp < best.hp)) best = e;
    }
    if (best) return best.idx;
  }
  return null;
}

/** Enemy index an action aims at (ENGAGE, CAST on an enemy, ATTACK), else null. */
export function actionTarget(a) {
  if (!a) return null;
  if (a.type === 'ATTACK' || a.type === 'ENGAGE') return typeof a.target === 'number' ? a.target : null;
  if (a.type === 'CAST' && C.SPELL[a.spellId] && C.SPELL[a.spellId].target === 'enemy') return typeof a.target === 'number' ? a.target : null;
  return null;
}

/** Short label of a combat action for the recorder and logs. */
export function actionLabel(a) {
  if (!a) return '';
  if (a.type === 'ENGAGE') return `${engageKind(engageId(a))}:${engageId(a)}`;
  if (a.type === 'CAST') return `spell:${a.spellId}`;
  if (a.type === 'ATTACK') return 'attack';
  if (a.type === 'USE_ITEM') return 'item';
  return a.type.toLowerCase();
}
