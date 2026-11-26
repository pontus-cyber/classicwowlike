// R2-6 (blind demo round 2: "the same elite, Sisel Mistweaver, twice in one zone in one run"; draft): GATES.eliteSpread.
// With the switch on no elite template stands on two Elite places of one expedition zone while its pool holds another;
// a repeat takes the pool's next template (no draw is made, so no other node changes). Off (the default), the zone is the
// zone every golden hash was recorded on. The scripted elite of a guided zone 1 is never repeated either.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { generateExpZone, spreadElites } from '../../src/engine/expedition.js';
import { validEncounter } from '../../src/engine/map.js';

const C = R.C;
const LATER = () => ({ ...R.newProfile(), runs: 2 });
const run = (seed) => R.step(R.step(R.newRun({ classId: 'mage', petId: null, seed, content: CONTENT, profile: LATER(), mapMode: 'expedition' }), { type: 'START_RUN' }).state, { type: 'SET_OUT' }).state;
const withGate = (v, fn) => { const old = C.GATES.eliteSpread; C.GATES.eliteSpread = v; try { return fn(); } finally { C.GATES.eliteSpread = old; } };
const elites = (zone) => zone.nodes.filter((n) => n.type === 'elite');
const repeats = (zone) => { const seen = new Set(); let k = 0; for (const n of elites(zone)) { if (seen.has(n.elite)) k++; seen.add(n.elite); } return k; };

describe('R2-6: no elite twice in one zone (GATES.eliteSpread)', () => {
  test('off by default; the switch changes only the nodes that repeated an earlier elite, and never a stream', () => {
    assert.equal(C.GATES.eliteSpread, false);
    let off = 0; let moved = 0;
    for (let seed = 1; seed <= 60; seed++) for (const z of [1, 2, 3]) {
      const a = withGate(false, () => generateExpZone(run(seed), z)); // a fresh run each time: generating items counts uids
      const b = withGate(true, () => generateExpZone(run(seed), z));
      off += repeats(a);
      assert.equal(a.nodes.length, b.nodes.length);
      const seen = new Set();
      a.nodes.forEach((n, i) => {
        const m = b.nodes[i];
        if (n.type === 'elite') {
          if (n.elite !== m.elite) { moved++; assert.ok(seen.has(n.elite), `seed ${seed} zone ${z} node ${i}: only a repeat moves`); }
          seen.add(n.elite);
          if (n.elite === m.elite) assert.deepEqual(n.add, m.add, 'a node that keeps its elite keeps its escort');
          assert.equal(n.rare, m.rare);
        }
        else assert.deepEqual(n, m, `seed ${seed} zone ${z} node ${i}: a non-elite node is unchanged`);
      });
    }
    assert.ok(off > 0, 'the old zones do repeat elites (so the switch has something to fix)');
    assert.ok(moved > 0 && moved <= off);
  });

  test('on: no elite repeats while the pool has another; rares draw from their own pool; every escort stays valid', () => {
    for (let seed = 1; seed <= 60; seed++) for (const z of [1, 2, 3, 4, 5, 6]) {
      const zone = withGate(true, () => generateExpZone(run(seed), z));
      const zn = CONTENT.zones[z - 1];
      for (const rare of [false, true]) {
        const list = elites(zone).filter((n) => !!n.rare === rare);
        const pool = rare ? zn.rares : zn.elites;
        for (const n of list) assert.ok(pool.includes(n.elite));
        // as many different templates as the pool and the places allow
        assert.equal(new Set(list.map((n) => n.elite)).size, Math.min(list.length, pool.length), `seed ${seed} zone ${z}: ${list.map((n) => n.elite)}`);
      }
      for (const n of elites(zone)) if (n.add) assert.ok(validEncounter(CONTENT, [n.elite, n.add]), `seed ${seed} zone ${z}: escort of ${n.elite}`);
    }
  });

  test('spreadElites: a repeat takes the next template that is not taken; with none left it stays; the taken list counts', () => {
    const zn = { elites: ['a', 'b', 'c'], rares: ['r1', 'r2'], normals: [] };
    const content = { enemies: {} };
    const nodes = () => [{ type: 'elite', elite: 'a' }, { type: 'quest' }, { type: 'elite', elite: 'a' }, { type: 'elite', elite: 'a' }, { type: 'elite', elite: 'a' }, { type: 'elite', rare: true, elite: 'r2' }, { type: 'elite', rare: true, elite: 'r2' }];
    const x = nodes(); spreadElites(content, zn, x);
    assert.deepEqual(x.filter((n) => n.type === 'elite').map((n) => n.elite), ['a', 'b', 'c', 'a', 'r2', 'r1']);
    const y = nodes().slice(0, 3); spreadElites(content, zn, y, ['a']);
    assert.deepEqual(y.filter((n) => n.type === 'elite').map((n) => n.elite), ['b', 'c']);
  });

  test('a guided zone 1 (TUTORIAL_SEED): the scripted elite stands on one place only', () => {
    const guided = (on) => withGate(on, () => {
      let st = R.newRun({ classId: 'mage', petId: null, seed: 5, content: CONTENT, tutorial: true, profile: { ...R.newProfile(), runs: 1 } });
      for (const a of [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) st = R.step(st, a).state;
      return st.zone;
    });
    const off = guided(false); const on = guided(true);
    const scripted = off.nodes[off.tut.elite].elite;
    assert.equal(on.nodes[on.tut.elite].elite, scripted, 'Gorrak keeps his place');
    assert.equal(elites(on).filter((n) => !n.rare && n.elite === scripted).length, 1, 'and stands on no other');
    // the rest of the zone is the same zone
    assert.deepEqual(off.nodes.map((n) => n.type), on.nodes.map((n) => n.type));
  });
});
