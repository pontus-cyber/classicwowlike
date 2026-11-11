// docs/specs/changes-m2b-v12.md engine rows (D100, D101, D104): v11's outcomes in the engine (Delve price 2,
// EXPED_DROP_MULT 1.9, DUNGEON_DIM_HOLD removed, Beastcall Horn 12 without its gated switch), TIME_DIM_ESCAPE (rules
// 1.9.6: a Dimmed encounter after a MOVE that walks farther from the Shardfall) in the settle step, the tolls previews
// and the autoplay map policy, and Ricochet Bolt's bounce as a named constant at its old value (row 5, gated).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, ev, tweak } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { killDropMult, dimAt, dimAtHops, frontAt, zoneTime, outwardStep, dimFightTime, nodeTime } from '../../src/engine/expedition.js';

const pet = (cls) => (cls === 'hunter' ? 'ridgewolf' : null);
function startedRun(mode, { seed = 1, classId = 'mage', prep = false } = {}) {
  const o = { classId, petId: pet(classId), seed, content: REAL };
  if (mode === 'expedition') o.mapMode = 'expedition';
  if (prep) o.prep = true;
  return R.step(R.newRun(o), { type: 'START_RUN' }).state;
}
const onMap = (s) => R.step(s, { type: 'LEAVE_HUB' }).state;
const tolls = (events) => ev(events, 'time').map((e) => [e.add, e.why]);
/** Stand on node p on the map at zone toll zt (test set-up). */
const standAt = (s, p, zt) => tweak(s, (x) => { x.zone.pos = p; x.zone.seen[p] = true; x.time = x.zone.start + zt; x.phase = 'MAP'; });
/** A node with an outward and a not-outward neighbour, and both neighbours. */
function forkNode(zone) {
  for (const n of zone.nodes) {
    const out = n.nb.find((v) => outwardStep(zone, n.id, v));
    const other = n.nb.find((v) => !outwardStep(zone, n.id, v));
    if (out !== undefined && other !== undefined) return { p: n.id, out, other };
  }
  return null;
}

describe('M2b v12 row 1 (D100): v11 outcomes in the engine', () => {
  test('Delve price 2, EXPED_DROP_MULT 1.9 (killDropMult), DUNGEON_DIM_HOLD and BEASTCALL_HORN_CD_GATED removed, Beastcall Horn 12', () => {
    assert.equal(C.CONTRACT.delve.price, 2);
    assert.equal(C.EXPED_DROP_MULT, 1.9);
    assert.equal(killDropMult(startedRun('expedition')), 1.9);
    assert.equal(killDropMult(startedRun('rows')), 1);
    assert.equal('DUNGEON_DIM_HOLD' in C, false);
    assert.equal('BEASTCALL_HORN_CD_GATED' in C, false);
    assert.deepEqual([C.SPELL.beastcall_horn.cd, C.BEASTCALL_HORN_CD], [12, 12]);
    const s = onMap(startedRun('expedition', { seed: 4 }));
    for (const n of s.zone.nodes) assert.equal(dimAt(s.zone, n.id), dimAtHops(s.zone.shardDist[n.id]), `node ${n.id} (${n.type})`);
  });
});

describe('M2b v12 row 2 (D101): TIME_DIM_ESCAPE, rules 1.9.6', () => {
  test('constants: TIME_DIM_ESCAPE 1, TIME_DIM_FIGHT 2; dimFightTime; outwardStep is shardDist[to] > shardDist[from]', () => {
    assert.deepEqual([C.TIME_DIM_ESCAPE, C.TIME_DIM_FIGHT], [1, 2]);
    assert.deepEqual([dimFightTime(true), dimFightTime(false)], [C.TIME_DIM_ESCAPE, C.TIME_DIM_FIGHT]);
    const z = onMap(startedRun('expedition', { seed: 2 })).zone;
    for (const n of z.nodes) for (const v of n.nb) assert.equal(outwardStep(z, n.id, v), z.shardDist[v] > z.shardDist[n.id]);
  });

  test('a MOVE that walks farther from the Shardfall into the dark: its encounter costs TIME_DIM_ESCAPE; a walk sideways or inward TIME_DIM_FIGHT; depth, level and pack as before; the flag is clear after the action; the preview matches', () => {
    let both = 0;
    for (const seed of [1, 2, 3, 5, 8]) {
      const s0 = onMap(startedRun('expedition', { seed }));
      const f = forkNode(s0.zone);
      if (!f) continue;
      const s = standAt(s0, f.p, 40); // zone toll 40: every node Dimmed
      for (const [to, want] of [[f.out, C.TIME_DIM_ESCAPE], [f.other, C.TIME_DIM_FIGHT]]) {
        const a = { type: 'MOVE', nodeId: to };
        const pre = R.heatPreview(s, a);
        const r = R.step(s, a);
        assert.equal(ev(r.events, 'move')[0].via, 'walk');
        assert.deepEqual(tolls(r.events), [[C.TIME_WALK, 'walk'], [want, 'dim']], `seed ${seed} ${f.p} -> ${to}`);
        const st = r.state;
        assert.equal(st.node.type, 'dim');
        assert.equal(st.node.depth, frontAt(40 + C.TIME_WALK) - st.zone.shardDist[to], 'depth: the front at the walk\'s end');
        assert.equal(st.fight.enemies.length >= C.DIM_PACK_SIZE, true);
        assert.equal(st.exp.outward, false, 'cleared by the settle step');
        assert.equal(zoneTime(st), 40 + C.TIME_WALK + want);
        assert.deepEqual([pre.dimFight, pre.time], [true, C.TIME_WALK + want], 'heatPreview counts the same tolls');
      }
      both++;
    }
    assert.ok(both >= 3, `checked ${both} maps`);
  });

  test('every other Dimmed encounter costs TIME_DIM_FIGHT: after a PASS outward, after a node\'s content entered by an outward MOVE, after the Bell\'s channel, after a hub service; the flag clears at the next action', () => {
    let pass = 0;
    let content = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s0 = onMap(startedRun('expedition', { seed }));
      const zone = s0.zone;
      for (const n of zone.nodes) {
        const v = n.nb.find((x) => outwardStep(zone, n.id, x) && zone.nodes[x].ring > 0 && !zone.nodes[x].done);
        if (v === undefined) continue;
        // PASS_THROUGH an outward node that dims on arrival.
        const sp = standAt(s0, n.id, dimAt(zone, v) - C.TIME_WALK);
        const a = { type: 'PASS_THROUGH', nodeId: v };
        if (pass < 3 && R.isLegal(sp, a)) {
          const r = R.step(sp, a);
          assert.deepEqual(tolls(r.events), [[C.TIME_WALK, 'pass'], [C.TIME_DIM_FIGHT, 'dim']], `seed ${seed} pass ${n.id} -> ${v}`);
          assert.equal(R.heatPreview(sp, a).time, C.TIME_WALK + C.TIME_DIM_FIGHT);
          pass++;
        }
        // MOVE outward into a Quest that dims during its content: the encounter after it is not an escape.
        if (content < 2 && zone.nodes[v].type === 'quest') {
          let s = R.debug.setGod(standAt(s0, n.id, dimAt(zone, v) - 1), true).state;
          const r0 = R.step(s, { type: 'MOVE', nodeId: v });
          assert.equal(ev(r0.events, 'move')[0].via, 'enter');
          assert.equal(r0.state.exp.outward, false, 'an entry sets no escape');
          s = r0.state;
          let dimT = null;
          for (let i = 0; i < 400 && dimT === null; i++) {
            const r = R.step(s, R.autoAction(s));
            const d = ev(r.events, 'time').find((e) => e.why === 'dim');
            if (d) dimT = d.add;
            s = r.state;
          }
          assert.equal(dimT, C.TIME_DIM_FIGHT, `seed ${seed} quest ${v}`);
          assert.ok(nodeTime(s0, 'quest') >= 1);
          content++;
        }
      }
    }
    assert.ok(pass >= 3 && content >= 2, `pass ${pass}, content ${content}`);
    // An outward walk with no encounter, then the Bell rung where the channel ends in the dark: TIME_DIM_FIGHT.
    const s0 = onMap(startedRun('expedition', { seed: 3 }));
    const zone = s0.zone;
    const n = zone.nodes.find((x) => x.nb.some((v) => outwardStep(zone, x.id, v)));
    const v = n.nb.find((x) => outwardStep(zone, n.id, x));
    let s = tweak(standAt(s0, n.id, dimAt(zone, v) - C.TIME_WALK - 1), (x) => { x.zone.nodes[v].done = true; });
    const w = R.step(s, { type: 'MOVE', nodeId: v });
    assert.deepEqual(tolls(w.events), [[C.TIME_WALK, 'walk']], 'not Dimmed yet: no encounter');
    assert.equal(w.state.exp.outward, false, 'the flag does not outlive its action');
    const b = R.step(w.state, { type: 'RING_BELL' });
    assert.deepEqual(tolls(b.events), [[C.BELL_CHANNEL_TIME, 'bell'], [C.TIME_DIM_FIGHT, 'dim']]);
    // A hub service whose tolls end in the dark (the hub dims during it): TIME_DIM_FIGHT.
    s = tweak(onMap(startedRun('expedition', { seed: 3 })), (x) => { x.zone.pos = 0; x.phase = 'ZONE_HUB'; x.hub.used = { trainer: false, vendor: false, inn: false }; });
    s = tweak(s, (x) => { x.time = x.zone.start + dimAt(x.zone, 0) - 1; });
    const inn = { type: 'SERVICE', service: 'inn' };
    assert.equal(R.whyIllegal(s, inn), null);
    {
      const r = R.step(s, inn);
      let t = tolls(r.events);
      let st = r.state;
      for (let i = 0; i < 5 && !t.some((x) => x[1] === 'dim') && st.service; i++) { const q = R.step(st, R.autoAction(st)); t = t.concat(tolls(q.events)); st = q.state; }
      assert.deepEqual(t.find((x) => x[1] === 'dim'), [C.TIME_DIM_FIGHT, 'dim']);
    }
  });

  test('wandering expedition runs (autoplay, but every other map action a walk to a neighbour, god mode): every Dimmed encounter costs TIME_DIM_ESCAPE exactly when its action was a MOVE walking farther from the Shardfall; exp.outward is false between actions; a walk\'s preview matches', () => {
    const seen = { escape: 0, fight: 0 };
    for (const [cls, seed] of [['mage', 1], ['rogue', 2], ['hunter', 3], ['mage', 4]]) {
      let s = startedRun('expedition', { seed, classId: cls, prep: seed % 2 === 0 });
      while (s.phase === 'PREP') s = R.step(s, R.autoAction(s)).state; // the start camp (prep): autoplay's
      s = R.debug.setGod(s, true).state;
      for (let n = 0; s.phase !== 'ENDED' && n < 4000; n++) {
        let a = R.autoAction(s);
        if (s.phase === 'MAP' && n % 2 === 0) {
          const moves = R.legalActions(s).filter((x) => x.type === 'MOVE');
          if (moves.length) a = moves[(n * 7 + seed) % moves.length];
        }
        const pre = a.type === 'MOVE' ? R.heatPreview(s, a) : null;
        const from = s.zone && s.zone.pos;
        const r = R.step(s, a);
        const d = ev(r.events, 'time').find((e) => e.why === 'dim');
        if (d) {
          const mv = ev(r.events, 'move')[0];
          const esc = a.type === 'MOVE' && mv && mv.via === 'walk' && outwardStep(s.zone, from, a.nodeId);
          assert.equal(d.add, esc ? C.TIME_DIM_ESCAPE : C.TIME_DIM_FIGHT, `${cls} ${seed} step ${n} ${a.type}`);
          seen[esc ? 'escape' : 'fight']++;
        }
        // A walk's preview is spent in the same action (an entry's Dimmed encounter comes after its content, a later action).
        const walked = ev(r.events, 'move')[0];
        if (pre && walked && walked.via === 'walk') assert.equal(pre.time, ev(r.events, 'time').reduce((t, e) => t + e.add, 0), `${cls} ${seed} step ${n}: preview`);
        s = r.state;
        if (s.exp) assert.equal(s.exp.outward, false);
      }
    }
    assert.ok(seen.fight > 5 && seen.escape > 5, `encounters ${JSON.stringify(seen)}`);
  });
});

describe('M2b v12 row 5 (D104, gated): Ricochet Bolt bounce RICOCHET_BOUNCE_FRAC', () => {
  test('0.40 by default (gated: not applied); RICOCHET_BOUNCE_FRAC_GATED 0.30; arming the field at run time sets the bounce a cast and spellInfo use', () => {
    assert.deepEqual([C.RICOCHET_BOUNCE_FRAC, C.RICOCHET_BOUNCE_FRAC_GATED, C.SPELL.ricochet_bolt.bounceFrac], [0.4, 0.3, 0.4]);
    let s = startedRun('rows', { classId: 'hunter', seed: 4 });
    s = tweak(s, (x) => { x.player.level = 40; x.player.spells.ricochet_bolt = { tl: 40, rank: 1 }; x.player.spellOrder.push('ricochet_bolt'); x.player.bar[5] = 'ricochet_bolt'; });
    const z1 = REAL.zones[0].normals;
    let r = R.debug.encounter(s, { ids: [z1[0], z1[0], z1[0]], level: 40 });
    s = tweak(r.state, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; if (x.player.pet) x.player.pet.alive = false; });
    if (s.fight.engage) s = R.step(s, R.autoAction(s)).state;
    const cast = () => {
      const q = R.step(s, { type: 'CAST', spellId: 'ricochet_bolt', target: 0 });
      return ev(q.events, 'damage').filter((e) => e.spell === 'ricochet_bolt').map((e) => [e.dst, e.amount]);
    };
    const info = () => R.spellInfo(s, 'ricochet_bolt', 0).amount;
    const at40 = cast();
    const i40 = info();
    assert.equal(i40.bounceFrac, 0.4);
    try {
      C.SPELL.ricochet_bolt.bounceFrac = C.RICOCHET_BOUNCE_FRAC_GATED;
      const at30 = cast();
      const i30 = info();
      assert.deepEqual([i30.bounceFrac, i30.amount], [0.3, i40.amount]);
      assert.ok(Math.abs(i30.bounceAmount - i40.amount * 0.3) <= 1, `bounceAmount ${i30.bounceAmount} for a main hit of ${i40.amount}`);
      assert.deepEqual(at30.map((h) => h[0]), at40.map((h) => h[0]), 'same targets (same draws)');
      let bounces = 0;
      at40.forEach(([dst, amt], i) => {
        if (dst === 0) assert.equal(at30[i][1], amt, 'the main hit is unchanged');
        else if (amt > 0) { assert.ok(at30[i][1] < amt, `bounce on ${dst}: ${at30[i][1]} < ${amt}`); bounces++; }
      });
      assert.ok(bounces > 0, 'a bounce landed');
    } finally {
      C.SPELL.ricochet_bolt.bounceFrac = C.RICOCHET_BOUNCE_FRAC;
    }
    assert.deepEqual(cast(), at40, 'restored');
  });
});
