// Legacy pace reading (D168; sim/lh1report.mjs, sim/lh1-chain.sh; report legacy-pace-2026-11-25):
// LE3 and the hours to hero 25 are read at the hero level inside the run that crosses it, the first-kill line is paid once a
// class, and the `none` chain buys nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../../sim/lib/engine.mjs';
import { chain, chainValue, cellStats } from '../../sim/lh1report.mjs';

const T = C.HERO_XP_ECON2;
const cumT = (L) => T.slice(0, L - 1).reduce((a, b) => a + b, 0);
/** A cell of n records a class: win share w (echFirst 100 on a win), ech = 200 + echFirst, hero XP xp, minutes min. */
const cellOf = (n, w, xp, min) => Object.fromEntries(['rogue', 'mage', 'hunter'].map((c) => [c, Array.from({ length: n }, (_, i) => {
  const won = i < Math.round(n * w);
  return { out: won ? 'v' : 'd', ech: 200 + (won ? 100 : 0), echFirst: won ? 100 : 0, ct: { xp }, min: [min, min] };
})]));

test('D168: hero level 20 and 25 are read inside the run that crosses them, linear in the hero XP of that run', () => {
  const res = chain('v3d', () => ({ leg: 300, xp: 8000, min: 42 }), 14, { buy: false });
  const r = res.rows.find((x) => x.x1 >= cumT(20));
  const a = res.at(20);
  const f = (cumT(20) - r.x0) / (r.x1 - r.x0);
  assert.equal(a.run, r.run);
  assert.ok(Math.abs(a.cum - (r.cum - r.leg + f * r.leg)) < 1e-9);
  assert.ok(Math.abs(a.hours - (r.hours - 0.7 + f * 0.7)) < 1e-9);
  assert.ok(a.cum < r.cum && a.cum > r.cum - r.leg);
  // hero 25: the run that crosses it is charged for the XP it needs, not for the whole run
  const b = res.at(25);
  const last = res.rows[res.rows.length - 1];
  assert.equal(b.run, last.run);
  assert.ok(b.hours <= last.hours && b.hours > last.hours - 0.7);
  assert.equal(res.at(26), null);
});

test('chain buy: false buys nothing and the stage stays empty', () => {
  const res = chain('v3d', () => ({ leg: 500, xp: 8000, min: 40 }), 14, { buy: false });
  assert.ok(res.rows.every((r) => r.bought.length === 0 && r.stage === ''));
  const bought = chain('v3d', () => ({ leg: 500, xp: 8000, min: 40 }));
  assert.ok(bought.rows[0].bought.length > 0);
});

test('first kill once a class: the expected line over the runs is 100 x (1 - (1 - w)^runs) a class, not 100 x w a run', () => {
  const cells = { 1: { 1: cellOf(20, 0.5, 8000, 40) }, 2: { 4: cellOf(20, 0.5, 8000, 40) } };
  const once = chainValue(cells, {}, 'once');
  const every = chainValue(cells, {}, 'every');
  const a1 = once(1, 1, ''); const a2 = once(2, 4, '');
  const e1 = every(1, 1, ''); const e2 = every(2, 4, '');
  assert.equal(e1.leg, 250); // 200 + the 100 of the half that won
  assert.equal(a1.leg, 250); // run 1: 100 x 0.5
  assert.equal(e2.leg, 250);
  assert.equal(a2.leg, 225); // run 2: 100 x 0.5 x 0.5 left to win for the first time
  assert.equal(cellStats(cells[1][1]).w.rogue, 0.5);
});
