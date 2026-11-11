// M2b v12 simulator rows (docs/specs/changes-m2b-v12.md): the bots price a Dimmed encounter after an outward walk at
// TIME_DIM_ESCAPE through the engine's helpers (row 2: sim/lib/view.mjs escapeV, dimTollsV; sim/bots/planner.mjs), the
// recorder keeps each encounter's tolls, the expedition speedrunner follows balance.md 1 (row 4: speedFog; variant
// 'v11' keeps the v11 policy for arm 9), the gated Ricochet Bolt arm (row 5) and row 3's B43 band in params.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { C, R, newRunFor, outwardStep, dimFightTime } from '../../sim/lib/engine.mjs';
import { EXP, SIM } from '../../sim/lib/params.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { makeCtx, contractValue } from '../../sim/lib/model.mjs';
import { priorTable } from '../../sim/lib/risk.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { fogInput, escapeV, shardZoneV, dimTollsV, dimmedAtV } from '../../sim/lib/view.mjs';
import { speedFog, speedSites, speedExpMap } from '../../sim/bots/speedrunner.mjs';
import { cellName } from '../../sim/lib/output.mjs';

/** Play an expedition run with `bot` and call `each(s)` at every map decision (phase MAP, nothing open). */
function walkRun(bot, cls, seed, each, { prof = 'fresh', prep = true, max = 2500 } = {}) {
  const b = createBot(bot, { classId: cls, seed, risk: priorTable(), tree: 0 });
  const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, profile: buildProfile(prof, cls), mapMode: 'expedition', prep });
  for (let n = 0; n < max && s.phase !== 'ENDED'; n++) {
    if (s.phase === 'MAP' && !s.fight && !s.loot.length && s.zone && !s.zone.camp) each(s);
    R.stepInPlace(s, b.choose(s));
  }
  return s;
}

describe('M2b v12 sim rows', () => {
  test('row 2: the view prices each neighbour step as the engine (heatPreview tolls), outward walks at TIME_DIM_ESCAPE', () => {
    assert.equal(C.TIME_DIM_ESCAPE, 1, 'engine with D101');
    let n = 0;
    let esc = 0;
    // Wandering god-mode runs (as qa/engine s01f-v12): autoplay, but every other map action a walk to a neighbour, so the
    // front reaches the player; at every map decision each neighbour step is priced from the fog view and compared.
    for (const [cls, seed] of [['mage', 1], ['rogue', 2], ['hunter', 3]]) {
      let s = newRunFor({ classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, mapMode: 'expedition', prep: seed % 2 === 0 });
      R.stepInPlace(s, { type: 'START_RUN' });
      while (s.phase === 'PREP') s = R.step(s, R.autoAction(s)).state;
      s = R.debug.setGod(s, true).state;
      for (let k = 0; s.phase !== 'ENDED' && k < 3000; k++) {
        let a = R.autoAction(s);
        if (s.phase === 'MAP' && !s.fight && !s.loot.length && s.zone && !s.zone.camp) {
          const v = fogInput(s);
          const sz = shardZoneV(v);
          assert.deepEqual(sz.shardDist, s.zone.shardDist, 'the view skeleton gives the engine hops from the Shardfall');
          for (const mv of v.moves) {
            const walk = mv.via !== 'enter';
            const pv = R.heatPreview(s, { type: walk ? 'MOVE' : 'PASS_THROUGH', nodeId: mv.nodeId });
            if (!pv) continue;
            const dim = dimmedAtV(v, mv.nodeId, v.zt + v.walkTime);
            const t = dim ? dimTollsV(sz, v.pos, mv.nodeId, walk) : 0;
            assert.equal(pv.time, v.walkTime + t, `${cls} ${seed} ${walk ? 'walk' : 'pass'} to ${mv.nodeId}`);
            if (dim && walk && outwardStep(s.zone, v.pos, mv.nodeId)) { assert.equal(t, C.TIME_DIM_ESCAPE); esc++; }
            n++;
          }
          const moves = R.legalActions(s).filter((x) => x.type === 'MOVE');
          if (k % 2 === 0 && moves.length) a = moves[(k * 7 + seed) % moves.length];
        }
        s = R.step(s, a).state;
      }
    }
    assert.ok(n > 100, `steps compared (${n})`);
    assert.ok(esc > 0, `outward walks into the Dimming seen (${esc})`);
  });

  test('row 2: escapeV books the encounters of its route (dimTime, esc) and the route\'s first step costs what the engine previews', () => {
    let n = 0;
    walkRun('greedy', 'mage', 1004, (s) => {
      const v = fogInput(s);
      const e = escapeV(v, v.pos, v.zt);
      if (e.road === null || e.path.length < 2) return;
      assert.ok(e.dimTime >= e.dims * Math.min(C.TIME_DIM_ESCAPE, C.TIME_DIM_FIGHT) && e.dimTime <= e.dims * C.TIME_DIM_FIGHT);
      assert.equal(e.dimTime, e.esc * C.TIME_DIM_ESCAPE + (e.dims - e.esc) * C.TIME_DIM_FIGHT);
      const id = e.path[1];
      const mv = v.moves.find((x) => x.nodeId === id);
      const a = mv.via === 'enter' ? { type: 'PASS_THROUGH', nodeId: id } : { type: 'MOVE', nodeId: id };
      const pv = R.heatPreview(s, a);
      const next = escapeV(v, v.pos, v.zt, [id]);
      if (pv) { assert.equal(pv.time, next.time, 'first step of the escape route'); n++; }
    });
    assert.ok(n > 20, `routes checked (${n})`);
  });

  test('recorder: every Dimmed encounter keeps its tolls (dm[4]) as the engine spent them', () => {
    let seen = 0;
    let escSeen = 0;
    for (const [cls, seed] of [['rogue', 1000], ['mage', 1005], ['hunter', 1006]]) {
      const { record } = runWithBot({ bot: 'greedy', cls, prof: 'fresh', tree: 0, map: 'expedition', prep: true }, seed, null);
      for (const d of record.dm || []) {
        assert.ok(d[4] === C.TIME_DIM_ESCAPE || d[4] === C.TIME_DIM_FIGHT, `tolls ${d[4]}`);
        seen++;
        if (d[4] === C.TIME_DIM_ESCAPE) escSeen++;
      }
    }
    assert.ok(seen > 0, `encounters (${seen}, escapes ${escSeen})`);
  });

  test('row 4: speedFog has no gear, gold or heat terms; its sites count XP only; variant v11 keeps the v11 policy', () => {
    let n = 0;
    let differ = 0;
    walkRun('speedrunner', 'hunter', 1007, (s) => {
      const v = fogInput(s);
      const ctx = makeCtx(s, priorTable(), { hourMult: 3 });
      if (ctx.m.L >= 10 * v.z - 1) return;
      const sk = speedSites(s, v, ctx);
      if (sk) for (const k of sk.act) {
        assert.equal(k.value, contractValue(ctx, k.reward, { xpOnly: true }));
        assert.ok(k.value <= contractValue(ctx, k.reward) + 1e-9, 'XP only is at most the full value');
      }
      const a = speedFog(v, ctx, { exit: 10 * v.z - 1, sites: sk });
      // Gear and gold weights do not enter: a context whose equipped scores are all huge (no item is an upgrade) and
      // whose gold is worth nothing decides the same.
      const ctx2 = { ...ctx, eq: Object.fromEntries(Object.keys(ctx.eq).map((k) => [k, 1e9])), goldPct: -1, gainCache: new Map() };
      const b = speedFog(v, ctx2, { exit: 10 * v.z - 1, sites: sk });
      assert.deepEqual(a.action, b.action);
      assert.ok(Math.abs(a.cost - b.cost) < 1e-6);
      const old = speedExpMap(s, priorTable(), 'v11');
      if (JSON.stringify(old) !== JSON.stringify(a.action)) differ++;
      n++;
    }, { prof: 'all' });
    assert.ok(n >= 10, `decisions (${n})`);
    assert.ok(differ > 0, 'the v11 policy decides differently somewhere');
  });

  test('row 5 arm: --ricochet-gated sets Ricochet Bolt to RICOCHET_BOUNCE_FRAC_GATED for its runs only', () => {
    assert.equal(C.RICOCHET_BOUNCE_FRAC_GATED, 0.3);
    runWithBot({ bot: 'planner', cls: 'hunter', prof: 'all', tree: 0, ricochetGated: true }, 1000, null, { maxActions: 50 });
    assert.equal(C.SPELL.ricochet_bolt.bounceFrac, C.RICOCHET_BOUNCE_FRAC_GATED);
    runWithBot({ bot: 'planner', cls: 'hunter', prof: 'all', tree: 0 }, 1000, null, { maxActions: 50 });
    assert.equal(C.SPELL.ricochet_bolt.bounceFrac, C.RICOCHET_BOUNCE_FRAC);
    assert.equal(cellName({ bot: 'planner', prof: 'all', ricochetGated: true, map: 'expedition', prep: true }), 'planner-PALL-exp-prep-rcg');
    assert.equal(cellName({ bot: 'speedrunner', prof: 'all', variant: 'v11', map: 'expedition', prep: true }), 'speedrunner-PALL-v11-exp-prep');
  });

  test('row 3: B43 caught band 0.08-0.25 (old band kept for the second reading); dim and share bands unchanged', () => {
    assert.deepEqual(EXP.CAUGHT_ZONES, [0.08, 0.25]);
    assert.deepEqual(EXP.CAUGHT_ZONES_OLD, [0.08, 0.18]);
    assert.deepEqual(EXP.DIM_DEATH_SHARE, [0.05, 0.20]);
    assert.deepEqual(EXP.CLOSE_CALL_GREEDY, [0.40, 0.75]);
    assert.equal(dimFightTime(true), C.TIME_DIM_ESCAPE);
  });
});
