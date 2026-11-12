// M2b v15 sim rows (docs/specs/changes-m2b-v15.md "What the sim must run"; report docs/reports/balance-2026-11-12c.md):
// cell-name tags of the two new C.GATES switches (swiftRoad 'swift', on by default; mawgrimHp 'maw', off by default), the
// recorder's Swift passage fields (ex.swift, the eighth element of each zone entry), and the fog searches valuing the
// Swift passage XP from the view's `swift` block (planFog as any XP, VAL_XP; speedFog as levels at its level price), with
// the search unchanged when the block is null (the switch off).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, GATE_DEFAULTS, newRunFor } from '../../sim/lib/engine.mjs';
import { setGates, playRun } from '../../sim/lib/runner.mjs';
import { cellName, GATE_TAG } from '../../sim/lib/output.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { planFog, contractSites } from '../../sim/bots/planner.mjs';
import { speedFog, speedSites } from '../../sim/bots/speedrunner.mjs';
import { makeCtx, copyM, swiftModel, levelPos } from '../../sim/lib/model.mjs';
import { fogInput } from '../../sim/lib/view.mjs';
import { priorTable } from '../../sim/lib/risk.mjs';
import { BAL } from '../../sim/lib/params.mjs';

// Every switch on by default, named (a cell that names them plays the defaults).
const ON = Object.fromEntries(Object.keys(GATE_DEFAULTS).filter((k) => GATE_DEFAULTS[k]).map((k) => [k, true]));

describe('M2b v15 switches in the cell name', () => {
  test('tags: swiftRoad "swift" (on by default), mawgrimHp "maw" (off by default)', () => {
    assert.equal(GATE_TAG.swiftRoad, 'swift');
    assert.equal(GATE_TAG.mawgrimHp, 'maw');
    assert.equal(GATE_DEFAULTS.swiftRoad, true);
    assert.equal(GATE_DEFAULTS.mawgrimHp, false);
  });

  test('row 2 off arm is "-noswift"; row 4 arm is "-maw"; a plain cell has no mark', () => {
    const name = (gates, extra = {}) => cellName({ bot: 'speedrunner', prof: 'all', variant: 'v11', map: 'expedition', prep: true, ...extra, ...(gates ? { gates } : {}) });
    const off2 = { ...ON };
    delete off2.swiftRoad;
    assert.equal(name(null), 'speedrunner-PALL-v11-exp-prep');
    assert.equal(name(off2), 'speedrunner-PALL-v11-exp-prep-noswift');
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', gates: { ...ON, mawgrimHp: true } }), 'planner-P0-maw');
    assert.equal(cellName({ bot: 'planner', prof: 'fresh', gates: ON }), 'planner-P0');
  });

  test('setGates plays the row 4 arm and the row 2 off arm; null restores the defaults', () => {
    setGates({ ...ON, mawgrimHp: true });
    assert.equal(C.GATES.mawgrimHp, true);
    assert.equal(C.GATES.swiftRoad, true);
    const off2 = { ...ON };
    delete off2.swiftRoad;
    setGates(off2);
    assert.equal(C.GATES.swiftRoad, false);
    setGates(null);
    assert.deepEqual(C.GATES, { ...GATE_DEFAULTS });
  });
});

describe('recorder: Swift passage fields', () => {
  test('ex.swift counts the zones whose Road paid; each zone entry carries the XP its Road paid (0 without)', () => {
    let paid = 0;
    for (const [cls, seed] of [['mage', 1000], ['hunter', 1001], ['rogue', 1002]]) {
      const r = playRun({ bot: 'planner', cls, prof: 'fresh', tree: 1, map: 'expedition', prep: true }, seed, null);
      assert.equal(r.err, null);
      assert.ok(r.ex && Number.isInteger(r.ex.swift));
      for (const z of r.ex.zones) assert.equal(z.length, 8);
      const zs = r.ex.zones.filter((z) => z[7] > 0);
      assert.equal(zs.length, r.ex.swift);
      for (const z of zs) { assert.equal(z[6], 'r'); assert.ok(z[1] <= C.ROAD_SWIFT_TOLLS, `zone time ${z[1]}`); }
      paid += r.ex.swift;
    }
    assert.ok(paid > 0, 'some Road paid the Swift passage');
  });

  test('switch off: no Road pays (ex.swift 0, every zone 0)', () => {
    const off2 = { ...ON };
    delete off2.swiftRoad;
    const r = playRun({ bot: 'planner', cls: 'mage', prof: 'fresh', tree: 1, map: 'expedition', prep: true, gates: off2 }, 1000, null);
    setGates(null);
    assert.equal(r.ex.swift, 0);
    for (const z of r.ex.zones) assert.equal(z[7], 0);
  });
});

/** The first map decision of zone 1 of a planner expedition run with the start camp (zone time small: in the window). */
function firstMapState(cls, seed) {
  setGates(null);
  const risk = priorTable();
  const s = newRunFor({ classId: cls, petId: null, seed, profile: buildProfile('fresh', cls), mapMode: 'expedition', prep: true });
  const bot = createBot('planner', { classId: cls, seed, risk, tree: 1 });
  for (let n = 0; n < 4000 && s.phase !== 'ENDED'; n++) {
    if (s.phase === 'MAP' && s.zone && !s.zone.camp) return { s, risk };
    R.stepInPlace(s, bot.choose(s));
  }
  throw new Error('no map decision');
}

describe('fog searches value the Swift passage XP (M2b v15 row 2)', () => {
  test('the view carries the block; swiftModel pays round(frac × xpToNext(L)) inside the window only', () => {
    const { s } = firstMapState('mage', 1000);
    const v = fogInput(s);
    assert.ok(v.swift && v.swift.eligible, 'zone 1, first decision: in the window');
    assert.equal(v.swift.xp, Math.round(C.ROAD_SWIFT_XP_FRAC * R.xpToNext(s.player.level)));
    const m = { L: s.player.level, xp: s.player.xp, rested: 0, hp: 1, q: 0, rations: 0, tAt: 0, dh: 0 };
    const m2 = copyM(m);
    assert.equal(swiftModel(m2, v.swift, v.swift.tolls), v.swift.xp);
    assert.ok(levelPos(m2) > levelPos(m));
    assert.equal(swiftModel(copyM(m), v.swift, v.swift.tolls + 1), 0);
    assert.equal(swiftModel(copyM(m), null, 0), 0);
  });

  test('planFog: every option is worth at least as much with the block, some more; a Road taken now adds its XP value', () => {
    for (const [cls, seed] of [['mage', 1000], ['rogue', 1001]]) {
      const { s, risk } = firstMapState(cls, seed);
      const view = fogInput(s);
      const ctx = () => makeCtx(s, risk, { hourMult: BAL.PLANNER_TIME_MULT });
      // Full depth: no option is worth less with the block (zone 1's first decision rarely leaves in the window, so the
      // values may be equal); depth 0 (each option ends in a leaf inside the window): some option is worth more.
      for (const depth of [undefined, 0]) {
        const c1 = ctx();
        const a = planFog(view, c1, { depth, sites: contractSites(s, view, c1) });
        const c2 = ctx();
        const b = planFog({ ...view, swift: null }, c2, { depth, sites: contractSites(s, view, c2) });
        assert.equal(a.options.length, b.options.length);
        let more = 0;
        for (let i = 0; i < a.options.length; i++) {
          assert.deepEqual(a.options[i].action, b.options[i].action);
          assert.ok(a.options[i].value >= b.options[i].value - 1e-9, `${cls} depth ${depth} option ${i}`);
          if (a.options[i].value > b.options[i].value + 1e-9) more++;
        }
        if (depth === 0) assert.ok(more > 0, `${cls}: the window changes some option`);
      }
      // A Road under the player's feet (the same view marked onRoad): TAKE_ROAD's value differs by the XP's value.
      const ra = planFog({ ...view, onRoad: true }, ctx()).options.find((o) => o.action.type === 'TAKE_ROAD');
      const rb = planFog({ ...view, onRoad: true, swift: null }, ctx()).options.find((o) => o.action.type === 'TAKE_ROAD');
      const lv = view.swift.xp / R.xpToNext(s.player.level);
      assert.ok(ra.value - rb.value >= lv * BAL.VAL_XP - 1e-6, `${cls}: ${ra.value} - ${rb.value}`);
    }
  });

  test('speedFog: every option costs at most as much with the block, some less; a Road taken now is cheaper by its levels', () => {
    const { s, risk } = firstMapState('hunter', 1002);
    const view = fogInput(s);
    const exit = C.ZONE_LEVELS * view.z - 1;
    const ctx = () => makeCtx(s, risk, { hourMult: BAL.PLANNER_TIME_MULT });
    const c1 = ctx();
    const a = speedFog(view, c1, { exit, sites: speedSites(s, view, c1) });
    const c2 = ctx();
    const b = speedFog({ ...view, swift: null }, c2, { exit, sites: speedSites(s, view, c2) });
    let less = 0;
    for (let i = 0; i < a.options.length; i++) {
      assert.ok(a.options[i].cost <= b.options[i].cost + 1e-9, `option ${i}`);
      if (a.options[i].cost < b.options[i].cost - 1e-9) less++;
    }
    assert.ok(less > 0);
    const ra = speedFog({ ...view, onRoad: true }, ctx(), { exit }).options.find((o) => o.action.type === 'TAKE_ROAD');
    const rb = speedFog({ ...view, onRoad: true, swift: null }, ctx(), { exit }).options.find((o) => o.action.type === 'TAKE_ROAD');
    assert.ok(ra.cost < rb.cost);
  });

  test('switch off: the view has no block, so the searches play as before', () => {
    const off2 = { ...ON };
    delete off2.swiftRoad;
    const { s } = firstMapState('mage', 1000);
    setGates(off2);
    assert.equal(R.mapView(s).swift, null);
    setGates(null);
    assert.ok(R.mapView(s).swift);
    assert.ok(CONTENT);
  });
});
