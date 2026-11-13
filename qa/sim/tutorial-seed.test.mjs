// M3 3.2 (docs/specs/m3-onboarding.md 2.3, D135): the chosen TUTORIAL_SEED still meets criteria (a)-(e) of the guided
// zone on the engine's map generation, and the map facts the Content Designer's overlay is written against
// (docs/reports/tutorial-seed-2026-11-13.md) have not moved. A failure here means the zone 1 generation changed: run
// `node sim/pick-tutorial-seed.mjs` again and tell the Content Designer before changing the seed or the pinned facts.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../../sim/lib/engine.mjs';
import { tutorialZone, evaluate, scan } from '../../sim/pick-tutorial-seed.mjs';

/** The engine's constant once the Engineer adds it (spec 12), else the seed chosen in the report. */
const SEED = C.TUTORIAL_SEED ?? 8736;

describe('TUTORIAL_SEED (m3-onboarding 2.3)', () => {
  test('the chosen seed meets (a)-(e)', () => {
    const e = evaluate(tutorialZone(SEED));
    assert.deepEqual(e.crit, { a: true, b: true, c: true, d: true, e: true });
    assert.equal(e.rank.tour, 5);
  });

  test("the overlay's map facts (report tutorial-seed-2026-11-13) are unchanged", () => {
    const s = tutorialZone(SEED);
    const f = evaluate(s).facts;
    const type = (id) => s.zone.nodes[id].type;
    assert.deepEqual(f.vergeQG, [1, 2, 7]);
    assert.deepEqual(f.vergeQG.map(type), ['quest', 'grind', 'grind']);
    assert.equal(f.elite, 18);
    assert.equal(type(18), 'elite');
    assert.equal(f.road, 19);
    assert.deepEqual([...f.roads].sort((a, b) => a - b), [19, 23, 27]);
    assert.equal(f.shardfall, 25);
    assert.deepEqual(f.innerRests, [8, 15]);
    assert.deepEqual(f.sites, [1, 4, 7]);
    assert.equal(f.dungeon, 21);
  });

  test('the scan keeps only passing seeds, best first', () => {
    const r = scan(8730, 10);
    assert.ok(r.length >= 1 && r[0].seed === 8736);
    for (const x of r) assert.ok(x.pass);
    assert.equal(evaluate(tutorialZone(1)).pass, false);
  });
});
