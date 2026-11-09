// Engine health (balance.md 3.8 B35-B37) and API guarantees.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { R, C, CONTENT, started, MAX_ACTIONS_PER_RUN } from './helpers.mjs';
import { makeRng, nextInt, hash32 } from '../../src/rng.js';

const REAL = fileURLToPath(new URL('../../src/content/index.js', import.meta.url));
const realContent = existsSync(REAL) ? (await import(REAL)).CONTENT : null;
const NO_LIST = new Set(['SET_NAME', 'SET_SEED']);

function newRun(classId, seed, content = CONTENT) {
  return R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed, content });
}

/** Autoplay a run; returns { state, actions, steps }. */
function autoRun(classId, seed, content = CONTENT, onStep = null) {
  let s = newRun(classId, seed, content);
  const actions = [];
  let n = 0;
  while (s.phase !== 'ENDED' && n < MAX_ACTIONS_PER_RUN) {
    const a = R.autoAction(s);
    if (onStep) onStep(s, a, n);
    actions.push(a);
    s = R.step(s, a).state;
    n++;
  }
  return { state: s, actions, steps: n };
}

describe('engine health', () => {
  test('B35 determinism: same seed + same actions = identical state at every step; replay from the action log', () => {
    for (const c of C.CLASS_IDS) {
      const a = autoRun(c, 4242);
      const states = [];
      autoRun(c, 4242, CONTENT, (s) => states.push(R.serialize(s)));
      let s = newRun(c, 4242);
      for (let i = 0; i < a.actions.length; i++) {
        assert.equal(R.serialize(s), states[i], `${c} step ${i}`);
        s = R.step(s, a.actions[i]).state;
      }
      assert.equal(hash32(R.serialize(s)), hash32(R.serialize(a.state)));
    }
    const m1 = R.mapView(R.step(started('mage', { seed: 1 }), { type: 'LEAVE_HUB' }).state);
    const m2 = R.mapView(R.step(started('mage', { seed: 2 }), { type: 'LEAVE_HUB' }).state);
    assert.notDeepEqual(m1.rows, m2.rows, 'different seeds give different maps');
  });

  test('B36 full autoplay runs from CREATE to SUMMARY to ENDED complete for every class (fixture, 20 seeds each)', () => {
    for (const c of C.CLASS_IDS) {
      for (let seed = 0; seed < 20; seed++) {
        const r = autoRun(c, 9000 + seed);
        assert.equal(r.state.phase, 'ENDED', `${c} seed ${9000 + seed} stuck in ${r.state.phase}`);
        assert.ok(r.steps < MAX_ACTIONS_PER_RUN);
        assert.ok(['victory', 'death'].includes(r.state.result.summary.outcome));
        assert.ok(Number.isInteger(r.state.result.echoes) && r.state.result.echoes >= 0);
      }
    }
  });

  test('B36 full autoplay runs complete on the real content (src/content/index.js)', { skip: !realContent && 'no src/content/index.js' }, () => {
    for (const c of C.CLASS_IDS) {
      for (let seed = 0; seed < 10; seed++) {
        const r = autoRun(c, 7000 + seed, realContent);
        assert.equal(r.state.phase, 'ENDED', `${c} seed ${7000 + seed}`);
      }
    }
  });

  test('legalActions never offers an illegal action (every listed action steps without error, every 2nd state of runs per class)', () => {
    for (const c of C.CLASS_IDS) {
      let checked = 0;
      // Runs from seed 31337 on until more than 1000 listed actions were stepped (a short run may end early).
      for (let seed = 31337; seed < 31342 && checked <= 1000; seed++) {
        autoRun(c, seed, CONTENT, (s, a, n) => {
          const list = R.legalActions(s);
          if (!NO_LIST.has(a.type)) assert.ok(list.some((x) => JSON.stringify(x) === JSON.stringify(a)), `autoAction ${JSON.stringify(a)} not listed in ${s.phase}`);
          if (n % 2) return;
          for (const x of list) {
            assert.doesNotThrow(() => R.step(s, x), `${c} ${s.phase} ${JSON.stringify(x)}`);
            checked++;
          }
        });
      }
      assert.ok(checked > 1000, `${c}: ${checked} actions checked`);
    }
  });

  test('random walk: 4000 random legal actions per class never throw and keep the state plain JSON', () => {
    for (const c of C.CLASS_IDS) {
      const g = makeRng(hash32(c));
      let s = newRun(c, 77);
      for (let i = 0; i < 4000; i++) {
        if (s.phase === 'ENDED') s = newRun(c, 77 + i);
        const list = R.legalActions(s);
        assert.ok(list.length > 0, `no legal action in ${s.phase}`);
        // Prefer progress so the walk moves through the run: 70 % autoAction, 30 % a random legal action.
        const a = nextInt(g, 10) < 7 ? R.autoAction(s) : list[nextInt(g, list.length)];
        s = R.step(s, a).state;
      }
      assert.doesNotThrow(() => JSON.parse(R.serialize(s)));
    }
  });

  test('step on an illegal action throws IllegalActionError with a clear reason', () => {
    const s = started('rogue');
    const cases = [
      [{ type: 'NOPE' }, /unknown action type "NOPE"/],
      [{ type: 'START_RUN' }, /only during CREATE/],
      [{ type: 'CHOOSE_NODE', lane: 0 }, /only on the map/],
      [{ type: 'CAST', spellId: 'gutting_jab', target: 0 }, /not in a fight|not allowed/],
      [{ type: 'SERVICE', service: 'blacksmith' }, /unknown service/],
      [{ type: 'EQUIP', itemId: 'nope' }, /not in bag/],
      [{ type: 'SET_BAR', slot: 0, spellId: 'ember_bolt' }, /not known/],
      [{}, /string "type"/],
    ];
    for (const [a, re] of cases) {
      assert.throws(() => R.step(s, a), (e) => e instanceof R.IllegalActionError && e.code === 'ILLEGAL_ACTION' && re.test(e.message), JSON.stringify(a));
    }
    assert.throws(() => R.step(R.newRun({ content: CONTENT }), { type: 'START_RUN' }), /select a class first/);
    assert.throws(() => R.newRun({ content: CONTENT, classId: 'paladin' }), /unknown class/);
  });

  test('step is pure; stepInPlace gives the same state; serialize/deserialize round-trips and continues identically', () => {
    let s = newRun('hunter', 5);
    for (let i = 0; i < 400 && s.phase !== 'ENDED'; i++) {
      const a = R.autoAction(s);
      const before = R.serialize(s);
      const r = R.step(s, a);
      assert.equal(R.serialize(s), before, 'input unchanged');
      const copy = R.deserialize(before, CONTENT);
      const ev2 = R.stepInPlace(copy, a);
      assert.equal(R.serialize(copy), R.serialize(r.state));
      assert.deepEqual(ev2, r.events);
      s = r.state;
    }
    assert.throws(() => R.deserialize(R.serialize(s), { ...CONTENT, version: 'other' }), /saved with content/);
  });

  test('every state is a tree of plain JSON: no object is shared between two places (content excluded)', () => {
    const shared = (root) => {
      const seen = new Set();
      const walk = (v, path) => {
        if (v === null || typeof v !== 'object') return null;
        if (seen.has(v)) return path;
        seen.add(v);
        for (const k of Object.keys(v)) { const r = walk(v[k], `${path}.${k}`); if (r) return r; }
        return null;
      };
      for (const k of Object.keys(root)) if (k !== 'content') { const r = walk(root[k], k); if (r) return r; }
      return null;
    };
    for (const c of C.CLASS_IDS) {
      let s = newRun(c, 606);
      for (let i = 0; i < MAX_ACTIONS_PER_RUN && s.phase !== 'ENDED'; i++) {
        s = R.step(s, R.autoAction(s)).state;
        assert.equal(shared(s), null, `${c} step ${i}`);
      }
    }
  });

  test('B37 throughput: autoplay runs per minute (reported, not asserted)', () => {
    const t0 = Date.now();
    let runs = 0;
    while (Date.now() - t0 < 1500) { autoRun(C.CLASS_IDS[runs % 3], 100 + runs); runs++; }
    const perMin = Math.round(runs / ((Date.now() - t0) / 60000));
    console.log(`# throughput: ${perMin} autoplay runs per minute (fixture content, pure step)`);
    assert.ok(perMin > 0);
  });
});
