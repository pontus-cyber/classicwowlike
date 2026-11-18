// D154-D155 (docs/specs/legacy.md 5.7-5.8, phase 1): the simulator's hero cells on the engine's Legacy switch. The profile
// `later` (two runs played, nothing bought); a hero cell (cell.hero, C.GATES.legacy among its gates: sim/run.mjs --hero) plays
// the class's hero at that level on the version 3 profile; the bots have no zone exit level and no Camp grind in a Legacy
// run (5.8 items 1 and 4); the cell marks 'leg' and 'h<H>'; a plain cell after a hero cell plays the defaults again.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, GATE_DEFAULTS } from '../../sim/lib/engine.mjs';
import { buildProfile, profileLabel, FIXED_PROFILE_RUNS } from '../../sim/lib/profiles.mjs';
import { cellName, GATE_TAG } from '../../sim/lib/output.mjs';
import { runWithBot, setGates, cellProfile } from '../../sim/lib/runner.mjs';
import { expExitLevel } from '../../sim/bots/planner.mjs';
import { templateBar, legacyRules } from '../../sim/lib/policy.mjs';
import { newRunFor } from '../../sim/lib/engine.mjs';

after(() => setGates(null));
const LEG = { ...Object.fromEntries(Object.entries(GATE_DEFAULTS).filter(([, on]) => on)), legacy: true };

describe('Legacy hero cells (legacy.md 5.7-5.8)', () => {
  test('profile later: FIXED_PROFILE_RUNS runs, nothing bought, label PL; the switch is off by default (tag leg)', () => {
    const p = buildProfile('later', 'mage');
    assert.deepEqual([p.runs, p.unlocks, p.welcome, profileLabel('later')], [FIXED_PROFILE_RUNS, {}, true, 'PL']);
    assert.deepEqual([GATE_DEFAULTS.legacy, GATE_TAG.legacy], [false, 'leg']);
  });

  test('cellProfile: a hero cell gets the version 3 profile with the class hero at its level; without the switch it is refused', () => {
    setGates(LEG);
    const p = cellProfile({ bot: 'planner', cls: 'hunter', prof: 'later', hero: 12 });
    assert.equal(p.v, 3);
    assert.deepEqual([p.heroes.hunter.level, p.heroes.hunter.xp, p.runs], [12, 0, FIXED_PROFILE_RUNS]);
    setGates(null);
    assert.throws(() => cellProfile({ bot: 'planner', cls: 'hunter', prof: 'later', hero: 12 }), /legacy/);
    assert.equal(cellProfile({ bot: 'planner', cls: 'hunter', prof: 'later' }).v, 1);
  });

  test('no zone exit level in a Legacy run (the planner leaves by value); the cell name marks leg and the hero level', () => {
    setGates(null);
    assert.equal(expExitLevel(3), 30);
    setGates(LEG);
    assert.equal(expExitLevel(3), 0);
    setGates(null);
    assert.equal(cellName({ bot: 'planner', prof: 'later', cls: 'rogue', map: 'expedition', prep: true, gates: LEG, hero: 10 }), 'planner-PL-exp-prep-leg-h10');
  });

  test('a planner hero cell plays a Legacy run to its end: no error, the hero at its level, no Camp grind; a plain cell after it plays the defaults', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const { record, state } = runWithBot({ bot: 'planner', cls, prof: 'later', tree: null, map: 'expedition', prep: true, gates: LEG, hero: 10 }, 1000, null);
      assert.equal(record.err, null, cls);
      assert.equal(state.legacy, true);
      assert.equal(state.result.summary.hero.start.level, 10);
      assert.ok(state.result.summary.hero.level >= 10);
      assert.equal(state.stats.campWaves, 0);
      assert.equal(state.result.profile.heroes[cls].runs, 1);
    }
    const plain = runWithBot({ bot: 'planner', cls: 'mage', prof: 'fresh', tree: null, map: 'expedition', prep: true }, 1000, null);
    assert.equal(plain.record.err, null);
    assert.equal(C.GATES.legacy, false);
    assert.equal(plain.state.legacy, undefined);
    assert.equal(plain.state.profile.v, 1);
  });
});

describe('D156 (legacy.md 2.4.1 item 6): the Hunter keeps Mend Companion on the Camp bar; D158: in Legacy runs only', () => {
  const DEF = Object.fromEntries(Object.entries(GATE_DEFAULTS).filter(([, on]) => on));
  /** A Hunter at power 60 with every class spell trained; legacy: a Legacy run (made with C.GATES.legacy on). */
  function hunter60(legacy) {
    if (legacy) setGates({ ...DEF, legacy: true });
    try {
      const s = newRunFor({ classId: 'hunter', petId: 'ridgewolf', seed: 3, ...(legacy ? { profile: cellProfile({ bot: 'planner', cls: 'hunter', prof: 'later', hero: 25 }) } : {}) });
      R.stepInPlace(s, { type: 'START_RUN' });
      s.player.level = 60;
      for (const sp of Object.values(C.SPELL)) if (sp.cls === 'hunter' && sp.source === 'class') { s.player.spells[sp.id] = { tl: 60, rank: 1 }; if (!s.player.spellOrder.includes(sp.id)) s.player.spellOrder.push(sp.id); }
      return s;
    } finally { setGates(null); }
  }
  const barsWith = (s, set) => { setGates(set); try { return [templateBar(s, { camp: true }), templateBar(s, { camp: false })]; } finally { setGates(null); } };

  test('a level-60 run: the Camp bar as before with oruvathLegacy on, alone or with legacy (D158); tag or2', () => {
    assert.deepEqual([GATE_DEFAULTS.oruvathLegacy, GATE_TAG.oruvathLegacy], [false, 'or2']);
    const s = hunter60(false);
    assert.equal(s.legacy, undefined);
    const off = barsWith(s, DEF);
    assert.ok(!off[0].includes('mend_companion'), `the level-60 Camp bar drops it: ${off[0].join(',')}`);
    assert.equal(legacyRules(s), false);
    assert.deepEqual(barsWith(s, { ...DEF, oruvathLegacy: true }), off);
    assert.deepEqual(barsWith(s, { ...DEF, legacy: true, oruvathLegacy: true }), off);
  });

  test('a Legacy run with both switches on: mend_companion on the Camp bar; the road bar unchanged; oruvathLegacy off: as before', () => {
    const s = hunter60(true);
    assert.equal(s.legacy, true);
    const [campOff, road] = barsWith(s, { ...DEF, legacy: true });
    assert.ok(!campOff.includes('mend_companion'), campOff.join(','));
    const ON = { ...DEF, legacy: true, oruvathLegacy: true };
    setGates(ON);
    try { assert.equal(legacyRules(s), true); } finally { setGates(null); }
    const [camp, road2] = barsWith(s, ON);
    assert.ok(camp.includes('mend_companion'), camp.join(','));
    assert.equal(camp.filter(Boolean).length, 7);
    assert.deepEqual(road2, road);
  });
});

describe('legacy.md 5.8 item 3: the planner model counts hero XP in a Legacy run (VAL_HERO_XP)', async () => {
  const { makeCtx, evalNode, copyM, xpWorth, bankedPos, levelPos } = await import('../../sim/lib/model.mjs');
  const { priorTable } = await import('../../sim/lib/risk.mjs');
  const { SIM, BAL } = await import('../../sim/lib/params.mjs');
  const heroState = (cls, level) => {
    setGates(LEG);
    const s = newRunFor({ classId: cls, seed: 7, profile: cellProfile({ bot: 'planner', cls, prof: 'later', hero: level }) });
    R.stepInPlace(s, { type: 'START_RUN' });
    setGates(null);
    return s;
  };

  test('makeCtx: hero level and hero XP in a Legacy run, no hero level otherwise; levelPos follows POWER_OF_LEVEL', () => {
    const s = heroState('mage', 10);
    s.player.xp = 1325; // half of HERO_XP[9] (2650)
    const ctx = makeCtx(s, priorTable());
    assert.deepEqual([ctx.hero, ctx.m.H, ctx.m.L, ctx.m.xp], [true, 10, C.POWER_OF_LEVEL[9], 1325]);
    assert.equal(levelPos(ctx.m), C.POWER_OF_LEVEL[9] + (C.POWER_OF_LEVEL[10] - C.POWER_OF_LEVEL[9]) / 2);
    assert.equal(copyM(ctx.m).H, 10);
    const s0 = newRunFor({ classId: 'mage', seed: 7 });
    R.stepInPlace(s0, { type: 'START_RUN' });
    const plain = makeCtx(s0, priorTable());
    assert.deepEqual([plain.hero, plain.m.H], [false, undefined]);
  });

  test('a quest pays hero XP at every level (also at power 60, hero 25) and xpWorth counts it at VAL_HERO_XP per 100', () => {
    for (const H of [10, 25]) {
      const s = heroState('rogue', H);
      const ctx = makeCtx(s, priorTable());
      const m = copyM(ctx.m);
      const w0 = xpWorth(m);
      evalNode(ctx, m, { type: 'quest', cl: m.L + 1, archetypes: ['a', 'b'] });
      const hx = xpWorth(m) - w0;
      assert.ok(hx > 0, `H${H}: the quest's XP has value (${hx})`);
      if (H === 25) assert.equal(bankedPos(m), 60);
      // one level-equivalent of hero XP is worth at least VAL_HERO_XP
      const m2 = copyM(ctx.m);
      m2.xp += C.HERO_XP_UNIT;
      assert.ok(xpWorth(m2) - xpWorth(ctx.m) >= SIM.VAL_HERO_XP - 1e-9);
      assert.ok(xpWorth(m2) - xpWorth(ctx.m) <= SIM.VAL_HERO_XP + BAL.VAL_XP);
    }
  });
});
