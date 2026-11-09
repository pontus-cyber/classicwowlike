// Helpers for qa/rules/*.test.mjs (QA's rule tests that fill the gaps of qa/engine/, M1 1.5).
// Builds on qa/engine/helpers.mjs (fixture content, state set-up, forced draws).
import { R, C, CONTENT, started, atLevel, tweak, cloneState, forceDraws, ev } from '../engine/helpers.mjs';
import { setupNode } from '../../src/engine/map.js';

export * from '../engine/helpers.mjs';
export { setupNode };

/** Enter a node of a given type at (row r, lane 0) of zone 1 with the character at `level`. Returns step()'s result. */
export function enterNode(base, type, { level = 20, r = 1, patch = null, prep = null } = {}) {
  let s = R.step(base, { type: 'LEAVE_HUB' }).state;
  s = atLevel(s, level);
  s = tweak(s, (x) => {
    const n = setupNode(x, 1, r, 0, type);
    if (patch) patch(n);
    x.zone.rows[r - 1][0] = n;
    x.zone.pos = r === 1 ? { r: 0, l: null } : { r: r - 1, l: 0 };
    if (prep) prep(x);
  });
  return R.step(s, { type: 'CHOOSE_NODE', lane: 0 });
}

/** Kill every enemy of the current fight at once: each enemy at 1 HP, the next attacks forced to hit. */
export function winFight(s) {
  const events = [];
  let guard = 0;
  while (s.fight && guard++ < 50) {
    const c = cloneState(s);
    for (const e of c.fight.enemies) if (e.alive) { e.hp = 1; e.dodge = 0; e.shield = 0; }
    const t = c.fight.enemies.find((e) => e.alive).idx;
    forceDraws(c, 3, (d) => d[0] > 0.6);
    const r = R.step(c, { type: 'ATTACK', target: t });
    events.push(...r.events);
    s = r.state;
  }
  return { state: s, events };
}

/** A fresh zone-1 map (phase MAP) for a class and seed. */
export const onMap = (classId, seed, opts = {}) => R.step(started(classId, { seed, ...opts }), { type: 'LEAVE_HUB' }).state;

export const xpOf = (events, why) => ev(events, 'xp').filter((e) => e.why === why).reduce((n, e) => n + e.amount, 0);
export const hoursOf = (events) => ev(events, 'hours').reduce((n, e) => n + e.add, 0);
export { R, C, CONTENT };
