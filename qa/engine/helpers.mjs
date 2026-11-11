// Test helpers for qa/engine/*.test.mjs (node:test, no dependencies).
import { before, after } from 'node:test';
import * as R from '../../src/rules.js';
import { CONTENT } from '../fixtures/content-min.js';
import { cloneState } from '../../src/engine/util.js';
import { refreshDerived } from '../../src/engine/stats.js';
import { startFight } from '../../src/engine/combat.js';
import { STREAM, nextFloat } from '../../src/rng.js';

export { R, CONTENT, cloneState, refreshDerived, STREAM, nextFloat };
export const C = R.C;
export const MAX_ACTIONS_PER_RUN = 20000; // balance.md 6 (B36)

/**
 * Set rule switches (C.GATES) for the enclosing describe and restore them after it (M2b v14, D113: the v13 rows 5-6 are on
 * by default; a suite written for the rules without one sets it off explicitly).
 */
export function gates(values) {
  let saved = null;
  before(() => { saved = { ...C.GATES }; Object.assign(C.GATES, values); });
  after(() => { Object.assign(C.GATES, saved); });
}

/** A started run (phase ZONE_HUB). */
export function started(classId = 'rogue', opts = {}) {
  const s = R.newRun({
    classId, petId: classId === 'hunter' ? (opts.petId || 'ridgewolf') : null, seed: opts.seed ?? 1,
    content: opts.content || CONTENT, profile: opts.profile || null,
  });
  return R.step(s, { type: 'START_RUN' }).state;
}

/** Apply a list of actions; returns the final state and all events. */
export function play(s, actions) {
  const events = [];
  for (const a of actions) {
    const r = R.step(s, a);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/** Copy of a started run at level L with full HP/mana and (optionally) every class spell up to L at tl = L. */
export function atLevel(s, L, { learnAll = true, bar = null } = {}) {
  s = cloneState(s);
  const p = s.player;
  p.level = L;
  refreshDerived(s);
  if (learnAll) {
    for (const sp of Object.values(C.SPELL)) {
      if (sp.cls === p.classId && sp.source === 'class' && sp.lvl <= L && !p.spells[sp.id]) { p.spells[sp.id] = { tl: L, rank: 1 }; p.spellOrder.push(sp.id); }
    }
    for (const id of Object.keys(p.spells)) p.spells[id].tl = L;
  }
  if (bar) p.bar = [...bar, ...new Array(C.SPELL_BAR_SLOTS - bar.length).fill(null)];
  p.hp = p.d.maxHp;
  p.mana = p.d.maxMana;
  if (p.pet) { p.pet.alive = true; p.pet.hp = p.d.petMaxHp; }
  return s;
}

/** Give spells (tl = L) and put them on the bar in this order. */
export function withSpells(s, ids) {
  s = cloneState(s);
  const p = s.player;
  for (const id of ids) if (!p.spells[id]) { p.spells[id] = { tl: p.level, rank: 1 }; p.spellOrder.push(id); }
  p.bar = [...ids, ...new Array(C.SPELL_BAR_SLOTS - ids.length).fill(null)].slice(0, C.SPELL_BAR_SLOTS);
  return s;
}

export function withTalents(s, talents) {
  s = cloneState(s);
  for (const [id, r] of Object.entries(talents)) {
    s.player.talents[id] = r;
    s.player.talentSpent += r;
  }
  refreshDerived(s);
  s.player.hp = s.player.d.maxHp;
  return s;
}

/**
 * Put the run into a fight. enemies: [{tid, level, variant}] (fixture template ids, e.g. 'z1_brute').
 * Returns { state, events }. kind: fight kind (quest, elite, trash, dboss, ...). engage: false starts the fight
 * without the engage round (combat v2, rules 7.10), so round 1 is every enemy's turn 1.
 */
export function inFight(s, enemies, { kind = 'quest', k = 0, noStealth = false, canFlee = !['dboss', 'boss'].includes(kind), engage } = {}) {
  s = cloneState(s);
  const cl = enemies.length ? enemies[0].level : 1;
  s.phase = 'NODE';
  s.zone.pos = { r: 1, l: 0 };
  s.node = { type: kind === 'elite' ? 'elite' : kind === 'trash' || kind === 'dboss' ? 'dungeon' : kind === 'grind' ? 'grind' : 'quest', r: 1, l: 0, cl, stage: 'fight', k, quest: 'q_z1_1', bossLevel: cl, planned: 1, wavesDone: 0 };
  s.lootRng = STREAM.loot(s.seed, 1, 1, 0);
  const ev = [];
  startFight(s, ev, {
    kind, k, z: 1, rng: STREAM.fight(s.seed, 1, 1, 0, k),
    enemies: enemies.map((e) => ({ tid: e.tid, level: e.level, variant: e.variant || 'normal' })),
    addLevel: cl, addPool: CONTENT.zones[0].normals, canFlee, noStealth: noStealth || kind === 'dboss', engage,
  });
  return { state: s, events: ev };
}

/** The next n draws of a generator state, without advancing it. */
export function peek(rngState, n) {
  const r = rngState.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(nextFloat(r));
  return out;
}

/** Run autoAction until pred(state) or the run ends. */
export function autoUntil(s, pred, max = MAX_ACTIONS_PER_RUN) {
  let n = 0;
  while (!pred(s) && s.phase !== 'ENDED' && n < max) {
    s = R.step(s, R.autoAction(s)).state;
    n++;
  }
  return s;
}

export const ev = (events, t) => events.filter((e) => e.t === t);
export const enemy = (s, i) => s.fight.enemies[i];
export const st = (list, id) => list.find((x) => x.id === id) || null;

/** Mutable copy with the given function applied (for setting up edge cases). */
export function tweak(s, fn) {
  const c = cloneState(s);
  fn(c);
  return c;
}

import { makeRng } from '../../src/rng.js';

/** Set s.fight.rng to the first generator state whose next n draws satisfy pred(draws). Returns the draws. */
export function forceDraws(s, n, pred) {
  for (let i = 0; i < 100000; i++) {
    const g = makeRng(i);
    const d = peek(g, n);
    if (pred(d)) { s.fight.rng = g; return d; }
  }
  throw new Error('forceDraws: no generator state found');
}

/** Draws for "hit, no crit, variance r3": r1 >= 0.9 (above any miss chance in tests), r2 >= 0.95. */
export const HIT = (d) => d[0] >= 0.9 && d[1] >= 0.95;
export const HIT_CRIT = (d) => d[0] >= 0.9 && d[1] < 0.01;
export const MISS = (d) => d[0] < 0.01;

/** Independent re-implementation of the rules 7.2 pipeline for expected values in tests. */
export function pipeline({ base, attPct = 0, attMult = 1, attL, tgtL, phys, dodge = 0, stealth = 0, crit = 0, critMult = 1.5, tgtPct = 0, armor = 0, draws }) {
  const [r1, r2, r3] = draws;
  const lvl = Math.min(1.3, Math.max(0.7, 1 + 0.04 * (attL - tgtL)));
  const baseMiss = Math.min(0.35, 0.05 + 0.02 * Math.max(0, tgtL - attL));
  if (r1 < baseMiss + (phys ? dodge : 0) + stealth) return { miss: true };
  let x = base * (1 + attPct) * attMult * lvl;
  const isCrit = r2 < crit;
  if (isCrit) x *= critMult;
  x *= 0.9 + 0.2 * r3;
  x *= Math.max(0, 1 + tgtPct);
  if (phys) x *= 1 - Math.min(0.75, armor / (armor + 40 * attL + 100));
  return { amount: Math.max(1, Math.round(x + 1e-9)), crit: isCrit };
}
