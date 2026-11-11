// M2b v11 simulator rows (docs/specs/changes-m2b-v11.md): the value model reads EXPED_DROP_MULT and
// EXPED_DUNGEON_BOSS_DROPS (rows 1-2); PALL holds the expedition entries of expedition.md 8.2 (no stand-in); catalogue
// entries removed from a profile (B42's no-vision cell, row 6; row 8's attribution arm); the gated Beastcall Horn arm
// (row 8); B12 counted from SET_OUT (row 7); the target rows 5-7 in params.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { C, R, newRunFor } from '../../sim/lib/engine.mjs';
import { SIM, EXP } from '../../sim/lib/params.mjs';
import { buildProfile, withoutMeta } from '../../sim/lib/profiles.mjs';
import { makeCtx, evalNode, copyM } from '../../sim/lib/model.mjs';
import { priorTable } from '../../sim/lib/risk.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { runLength } from '../../sim/lib/metrics.mjs';
import { cellName } from '../../sim/lib/output.mjs';

describe('M2b v11 sim rows', () => {
  test('rows 1-2: an expedition node values kill loot × EXPED_DROP_MULT and EXPED_DUNGEON_BOSS_DROPS boss rolls', () => {
    assert.ok(C.EXPED_DROP_MULT > 1 && C.EXPED_DUNGEON_BOSS_DROPS > C.DUNGEON_BOSS_DROPS, 'engine with rows 1-2');
    const s = newRunFor({ classId: 'mage', seed: 1000, mapMode: 'expedition', prep: true });
    R.stepInPlace(s, { type: 'START_RUN' });
    while (s.phase === 'PREP') R.stepInPlace(s, { type: 'SET_OUT' });
    const risk = priorTable();
    const ctx = makeCtx(s, risk);
    const without = { ...ctx, exp: { ...ctx.exp, dropMult: 1, bossDrops: C.DUNGEON_BOSS_DROPS } };
    const lvl = s.player.level;
    const quest = { type: 'quest', cl: lvl + 1, archetypes: ['a', 'b'] };
    const dungeon = { type: 'dungeon', level: lvl + 1, bossLevel: lvl + 2 };
    for (const node of [quest, dungeon]) {
      const a = evalNode(ctx, copyM(ctx.m), node).value;
      const b = evalNode(without, copyM(without.m), node).value;
      assert.ok(a > b, `${node.type}: ${a} > ${b}`);
    }
    // Classic map: no expedition context, the classic chances.
    const r = newRunFor({ classId: 'mage', seed: 1000 });
    R.stepInPlace(r, { type: 'START_RUN' });
    assert.equal(makeCtx(r, risk).exp, null);
  });

  test('PALL holds the 8.2 entries; withoutMeta removes entries (row 6 no-vision cell, row 8 attribution)', () => {
    const all = buildProfile('all', 'hunter');
    for (const id of ['cartographer', 'old_hand', 'quartermaster', 'scout']) assert.ok(all.unlocks[id] >= 1, id);
    const nv = withoutMeta(all, EXP.B42_VISION_ENTRIES);
    for (const id of EXP.B42_VISION_ENTRIES) assert.equal(nv.unlocks[id], undefined, id);
    assert.equal(nv.unlocks.quartermaster, all.unlocks.quartermaster, 'points kept');
    assert.ok(all.unlocks.scout >= 1, 'the original profile is not changed');
    // The B42 no-vision cell: no Charts, no Tracker held; same points as PALL.
    const cell = { bot: 'planner', cls: 'hunter', prof: 'all', tree: 0, map: 'expedition', prep: true, metaDrop: EXP.B42_VISION_ENTRIES, prepBan: EXP.B42_VISION_PERKS };
    const { record } = runWithBot(cell, 1001, null, { maxActions: 4000 });
    assert.ok(!record.err || record.err.startsWith('stuck'), record.err);
    assert.equal(record.ct.tr, 0, 'no Tracker');
    assert.equal(record.ct.ch, 0, 'no Region Charts');
    for (const id of EXP.B42_VISION_PERKS) assert.ok(!record.ct.bought.includes(id), id);
    assert.match(cellName({ ...cell, tree: null }), /dropscoucartoldh/);
    const full = runWithBot({ ...cell, metaDrop: null, prepBan: null }, 1001, null, { maxActions: 4000 }).record;
    assert.equal(full.ct.ch, 1, 'PALL owns Region Charts (Cartographer)');
  });

  test('row 8 arm: the Beastcall Horn cooldown is the gated value in an armed run and the default otherwise', () => {
    // M2b v12 (D100) removed the gated switch (BEASTCALL_HORN_CD_GATED): an armed run then keeps BEASTCALL_HORN_CD, and
    // run.mjs refuses --beastcall-gated.
    runWithBot({ bot: 'planner', cls: 'hunter', prof: 'all', tree: 0, beastcallGated: true }, 1000, null, { maxActions: 50 });
    assert.equal(C.SPELL.beastcall_horn.cd, C.BEASTCALL_HORN_CD_GATED ?? C.BEASTCALL_HORN_CD);
    runWithBot({ bot: 'planner', cls: 'hunter', prof: 'all', tree: 0 }, 1000, null, { maxActions: 50 });
    assert.equal(C.SPELL.beastcall_horn.cd, C.BEASTCALL_HORN_CD);
  });

  test('row 7: B12 from SET_OUT leaves the start camp\'s minute out; row 5 bands in params', () => {
    const rec = (min, ps) => ({ out: 'v', rb: 1, min: [40, min], fights: 30, rounds: 100, nodes: 30, ...(ps !== undefined ? { ct: { ps } } : {}) });
    const l = runLength([rec(31, 60), rec(32, 60), rec(33, 60)], () => 0);
    assert.equal(l.autoWins.v, 32);
    assert.equal(l.autoWinsSetOut.v, 31);
    const rows = runLength([rec(31), rec(32), rec(33)], () => 0);
    assert.equal(rows.autoWinsSetOut.v, 32, 'a run without a start camp keeps its minutes');
    assert.deepEqual(EXP.C_STEP_PALL, [0.80, 0.92]);
    assert.deepEqual(EXP.C_STEP_PALL_V11, [0.70, 0.92]);
    assert.equal(EXP.C_STEP_PALL_OVER_P0, 0.05);
    assert.equal(EXP.B12_MIN_WINS, 200);
    const s = newRunFor({ classId: 'rogue', seed: 1000, mapMode: 'expedition', prep: true });
    assert.ok(s);
    assert.equal(SIM.POTION_VALUE, 30);
  });
});
