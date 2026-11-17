// Newcomer check 2026-11-15 (docs/feedback/2026-11-15-blind-newcomer.md; BACKLOG 2026-11-15; engine and content side,
// docs/handoffs/engine-2026-11-15.md): (1) a guided node's map tooltip names only the quest it holds: the node being played
// keeps its quest through its reward stage (the finished Rooted Rows node was renamed to the next script's quest), and an
// unresolved guided node, whose quest is fixed only when it is entered (m3-onboarding.md 2.3), names none; (2) the trainer
// at a level (R.trainerView(state, level)): one step can give several levels, and each banner reads its own level; (3)
// Gorrak's name on his node in mapView at any `know`, and a gate line that reads right at one fight left; (4) the Dimming's
// `maxPerToll` is the most one toll can still take (the guided corridor's release counted), `cap` the rule's value.
// (5) heatPreview `parts`: the tolls of a cost in spend order, so a cost that grows (a Dimmed encounter) says why.
// (6) content texts.progress: the talent window's rule line, kept on TALENT_FIRST_LEVEL and TALENT_LEVEL_STEP.
// (7) offhand base names by the item's primary stat and the class: quivers for a Hunter's Agility offhand only.
// (8) heatView `carry`: the line is cumulative, so a zone's tolls in hand are its share less what it carried in.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { trainerUseful } from '../../src/engine/nodes.js';
import { dimAt, dimClock } from '../../src/engine/expedition.js';
import { rollDrop, makeFixedGear } from '../../src/engine/items.js';
import { makeRng, hash32 } from '../../src/rng.js';
import { lineAt } from '../../src/engine/heat.js';

const C = R.C;
const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
/** A guided run: a first run (runs 0), or (replay) "Play the guide again" with its Cull taken. */
const guidedRun = (classId, seed, replay = false) => R.newRun({ classId, petId: PET(classId), seed, content: CONTENT, tutorial: true, ...(replay ? { profile: { ...R.newProfile(), runs: 1 } } : {}) });
const copy = (s) => { const o = JSON.parse(R.serialize(s)); o.content = CONTENT; return o; };

describe('newcomer (1): a guided node names only the quest it holds (s0037, s0038, s0065, s0068)', () => {
  test('autoplay through zone 1, first run and replay, every class: done nodes keep the quest they were played as, an unresolved guided node has no title, any other quest node names the quest its MOVE starts', () => {
    for (const classId of C.CLASS_IDS) {
      for (const replay of [false, true]) {
        let s = guidedRun(classId, 11, replay);
        if (replay) {
          for (const a of [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }]) s = R.step(s, a).state;
        }
        const played = {}; // node id -> the quest its fight started with (the `quest` event)
        let checked = 0;
        let guidedSeen = 0;
        let doneSeen = 0;
        for (let i = 0; i < 3000 && s.phase !== 'ENDED' && !(s.zone && s.zone.z === 2); i++) {
          if (s.phase === 'MAP' && s.zone && s.zone.z === 1 && !s.fight) {
            const mv = R.mapView(s);
            const titles = [];
            for (const v of mv.nodes) {
              if (v.know !== 'full' || v.type !== 'quest') continue;
              if (v.done) { doneSeen++; assert.equal(v.title, CONTENT.quests[played[v.id]].title, `${classId} node ${v.id} done`); continue; }
              if (v.lost) continue;
              if (v.guided) { guidedSeen++; assert.equal(v.title, null, `${classId} node ${v.id} (${v.guided})`); continue; }
              titles.push(v.title);
              // an enterable node with a title: its MOVE starts that very quest
              const m = mv.moves.find((x) => x.nodeId === v.id && x.via === 'enter');
              if (m) {
                const q = R.step(copy(s), { type: 'MOVE', nodeId: v.id }).events.find((e) => e.t === 'quest');
                assert.equal(CONTENT.quests[q.quest].title, v.title, `${classId} node ${v.id}`);
                checked++;
              }
            }
          }
          const a = R.autoAction(s);
          const r = R.step(s, a);
          for (const e of r.events) if (e.t === 'quest' && r.state.zone.z === 1) played[r.state.node.id] = e.quest;
          s = r.state;
        }
        assert.ok(guidedSeen > 0 && doneSeen > 0, `${classId} replay ${replay}: guided ${guidedSeen}, done ${doneSeen}`);
        assert.equal(checked, 0, 'on this route every unresolved Quest node in view is a guided one (the scripts are not used up)');
      }
    }
  });

  test('the node being played keeps its role, quest and enemies through its reward stage; the next script waits for the other nodes', () => {
    let s = guidedRun('mage', 5);
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }, { type: 'MOVE', nodeId: 1 }]) s = R.step(s, a).state;
    assert.deepEqual([s.fight.tut.id, s.node.quest], ['s1', 'q_z1_guide_rooted_rows']);
    for (let n = 0; s.fight && n < 50; n++) s = R.step(s, R.autoAction(s)).state;
    assert.equal(s.node.stage, 'reward');
    assert.equal(s.tutorial.script, 1, 'S1 has ended');
    const def = s.zone.nodes[1];
    assert.deepEqual([def.quest, def.mobs, def.tutRole.id], ['q_z1_guide_rooted_rows', ['z1_furrow_boar'], 's1']);
    assert.equal(R.mapView(s).nodes[1].title, 'Rooted Rows', 'the node being played names its quest');
    // the other unresolved Quest nodes play S2 now (by the order taken), and name no quest
    const others = s.zone.nodes.filter((n) => n.type === 'quest' && n.id !== 1 && n.tutRole && !n.done);
    assert.ok(others.length > 0 && others.every((n) => n.tutRole.id === 's2' && n.quest === 'q_z1_guide_hedge_breaker'));
    for (let n = 0; s.node && n < 20; n++) s = R.step(s, R.autoAction(s)).state;
    const mv = R.mapView(s);
    assert.deepEqual([s.zone.nodes[1].done, mv.nodes[1].title, s.zone.nodes[1].quest], [true, 'Rooted Rows', 'q_z1_guide_rooted_rows']);
    assert.ok(mv.nodes.filter((v) => v.know === 'full' && v.type === 'quest' && !v.done).every((v) => v.guided === 'script' && v.title === null));
  });
});

describe('newcomer (2): the trainer at a level: the hub card and every level-up banner follow one rule (s0010, s0049, s0058, s0101)', () => {
  /** Every autoplay step of a guided run up to zone 3 that gives levels: { before, after, levels }. */
  const levelSteps = (classId, seed = 5) => {
    let s = guidedRun(classId, seed);
    const out = [];
    for (let i = 0; i < 6000 && s.phase !== 'ENDED' && !(s.zone && s.zone.z === 3); i++) {
      const r = R.step(s, R.autoAction(s));
      const levels = r.events.filter((e) => e.t === 'levelUp').map((e) => e.level);
      if (levels.length) out.push({ before: s, after: r.state, levels });
      s = r.state;
    }
    return out;
  };

  test('a spell is in `learn` from its own level on, so a level\'s banner names only what that level can learn and the card\'s "next" names the level a spell first appears', () => {
    for (const classId of C.CLASS_IDS) {
      const steps = levelSteps(classId);
      assert.ok(steps.some((x) => x.levels.length >= 3), `${classId}: a step that gives three or more levels`);
      for (const { before, after, levels } of steps) {
        for (const L of levels) {
          const at = R.trainerView(after, L);
          const prev = R.trainerView(after, L - 1);
          for (const x of at.learn) assert.ok(C.SPELL[x.id].lvl <= L, `${classId} level ${L}: ${x.id} needs level ${C.SPELL[x.id].lvl}`);
          const fresh = at.learn.filter((x) => !prev.learn.some((y) => y.id === x.id));
          for (const x of fresh) assert.equal(x.lvl, L, `${classId} level ${L}: ${x.id} is new at its own level`);
          if (fresh.length) assert.equal(prev.next, L, `${classId}: "Next spell at level ${L}" one level before`);
        }
        // the hub card before the step and the first banner agree; the view after the step is the last level's
        assert.deepEqual(R.trainerView(before), R.trainerView(before, before.player.level));
        assert.deepEqual(R.trainerView(after), R.trainerView(after, levels[levels.length - 1]));
      }
    }
  });

  test('the newcomer\'s Mage (build 902c976: D153\'s switches off): one step from level 7 to 11; the level 8 and 9 banners name no Rime Burst (learned from level 10, as the trainer row says), the level 10 one does', () => {
    const saved = { ...C.GATES };
    Object.assign(C.GATES, { gorrakLevel: false, bountyRoad: false });
    try { newcomerMage(); } finally { Object.assign(C.GATES, saved); }
  });
  const newcomerMage = () => {
    const step = levelSteps('mage').find((x) => x.levels.includes(8));
    assert.deepEqual(step.levels, [8, 9, 10, 11]);
    const names = (L) => R.trainerView(step.after, L).learn.map((x) => x.id);
    assert.equal(C.SPELL.rime_burst.lvl, 10);
    assert.ok(!names(8).includes('rime_burst') && !names(9).includes('rime_burst') && names(10).includes('rime_burst'), JSON.stringify([names(8), names(10)]));
    assert.equal(R.trainerView(step.before).next, 10, 'the card said "Next spell at level 10"');
    // and the first step: levels 2-4 in one, Arcane Ward (level 4) not on the level 2 or 3 banner
    const first = levelSteps('mage')[0];
    assert.deepEqual(first.levels, [2, 3, 4]);
    assert.deepEqual([R.trainerView(first.after, 3).learn, R.trainerView(first.after, 4).learn.map((x) => x.id)], [[], ['arcane_ward']]);
    assert.equal(R.trainerView(first.before).next, 4);
  };

  test('the default level is the character\'s; `useful` there is the autoplay\'s test; a level outside 1..MAX_LEVEL is refused; no state change', () => {
    const s = levelSteps('rogue')[1].after;
    const snap = R.serialize(s);
    for (const L of [1, 5, s.player.level, C.MAX_LEVEL]) {
      const v = R.trainerView(s, L);
      assert.deepEqual(Object.keys(v), ['learn', 'train', 'next', 'useful']);
      assert.ok(v.train.every((x) => x.tl < L));
    }
    for (const x of levelSteps('hunter')) assert.equal(R.trainerView(x.after).useful, trainerUseful(x.after));
    for (const bad of [0, C.MAX_LEVEL + 1, 2.5, '3', null]) assert.throws(() => R.trainerView(s, bad), RangeError, String(bad));
    assert.equal(R.serialize(s), snap);
    assert.equal(R.trainerView(R.newRun({ classId: 'mage', seed: 1, content: CONTENT }), 3), null, 'before START_RUN');
  });
});

describe('newcomer (3): Gorrak is named on his node; the gate line reads right for every count (s0066, s0086)', () => {
  test('his node carries his content name at every `know`, the other elites none; the barred line is a label', () => {
    let s = guidedRun('hunter', 3);
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) s = R.step(s, a).state;
    const id = R.tutorialView(s).eliteNodeId;
    const gorrak = CONTENT.enemies[CONTENT.tutorial.elite.enemy].name;
    assert.equal(gorrak, 'Gorrak the Fieldbreaker');
    let mv = R.mapView(s);
    assert.deepEqual([mv.nodes[id].know, mv.nodes[id].name, mv.nodes[id].barred], ['none', gorrak, true], 'unseen and barred: named');
    const elites = (v) => v.nodes.filter((n) => n.type === 'elite' && n.id !== id);
    // walk to him (autoplay) until his node is seen: still named; every other elite in view stays unnamed (D50)
    for (let i = 0; i < 2000 && R.mapView(s).nodes[id].know !== 'full'; i++) s = R.step(s, R.autoAction(s)).state;
    mv = R.mapView(s);
    // the zone's other elites, seen in a copy: unnamed (D50)
    const all = copy(s);
    all.zone.seen = all.zone.seen.map(() => true);
    assert.ok(elites(R.mapView(all)).length > 0 && elites(R.mapView(all)).every((n) => n.know === 'full' && n.name === null));
    assert.deepEqual([mv.nodes[id].know, mv.nodes[id].type, mv.nodes[id].name, mv.nodes[id].rare], ['full', 'elite', gorrak, null]);
    assert.equal(mv.nodes.filter((n) => n.name === gorrak).length, 1);
    // the gate line: "Fights before he comes back: {n}." (the old "after {n} more fights" read "1 more fights")
    const line = CONTENT.tutorial.elite.gate.barredLine;
    assert.ok(/: \{n\}\.$/.test(line) && !/more fights/.test(line), line);
  });

  test('no name outside a guided run\'s zone 1: a normal run, and the guided run\'s zone 2', () => {
    let p = R.newRun({ classId: 'mage', seed: 5, content: CONTENT });
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) p = R.step(p, a).state;
    assert.ok(R.mapView(p).nodes.every((n) => n.name == null || n.type === 'dungeon'));
    let s = guidedRun('rogue', 11);
    for (let i = 0; i < 4000 && !(s.zone && s.zone.z === 2 && s.phase === 'MAP'); i++) s = R.step(s, R.autoAction(s)).state;
    assert.equal(s.zone.z, 2);
    assert.ok(R.mapView(s).nodes.every((n) => n.name == null || n.type === 'dungeon'));
  });
});

describe('newcomer (4): the Dimming tooltip\'s "at most {maxPerToll} places a toll" holds for the rest of the zone (s0055, s0128)', () => {
  /** Nodes that dim in each toll after Dimming clock c, on the final state's schedule: the most in one toll. */
  const peakAfter = (zone, c) => {
    const at = zone.nodes.map((n) => dimAt(zone, n.id) - (zone.dimShift || 0)).filter((x) => x > c && x !== Infinity);
    const k = {};
    for (const x of at) k[x] = (k[x] || 0) + 1;
    return Math.max(0, ...Object.values(k));
  };

  test('autoplay, every class, first run and replay: nextCount never exceeds maxPerToll, the bound read at any toll holds for the zone\'s rest, and the old cap did not', () => {
    let over = 0;
    for (const classId of C.CLASS_IDS) {
      for (const replay of [false, true]) {
        let s = guidedRun(classId, 4, replay);
        if (replay) for (const a of [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }]) s = R.step(s, a).state;
        const reads = []; // [zone, Dimming clock, maxPerToll] at each map state
        let last = null;
        for (let i = 0; i < 5000 && s.phase !== 'ENDED' && !(s.zone && s.zone.z === 3); i++) {
          if (s.phase === 'MAP' && s.zone && !s.zone.camp) {
            const d = R.mapView(s).dim;
            assert.ok(d.nextCount <= d.maxPerToll, `${classId} z${s.zone.z} zt ${R.mapView(s).zt}: ${d.nextCount} > ${d.maxPerToll}`);
            assert.equal(d.cap, C.DIM_MAX_PER_TOLL);
            if (!s.zone.hold) assert.equal(d.maxPerToll, C.DIM_MAX_PER_TOLL, 'no corridor: the cap');
            if (s.zone.z === 1) { reads.push([dimClock(s.zone, R.mapView(s).zt), d.maxPerToll]); last = s.zone; }
          }
          s = R.step(s, R.autoAction(s)).state;
        }
        // the schedule zone 1 really kept (its release fixed by the end): no toll after a read took more than it said
        for (const [c, b] of reads) {
          const p = peakAfter(last, c);
          assert.ok(p <= b, `${classId}: ${p} in one toll after clock ${c}, read ${b}`);
          if (p > C.DIM_MAX_PER_TOLL) over++;
        }
      }
    }
    assert.ok(over > 0, 'the corridor\'s release took more than DIM_MAX_PER_TOLL in a toll (the tester\'s 3)');
  });

  test('while the corridor is held the bound covers a release at any later toll, and is reached by one', () => {
    let s = guidedRun('mage', 5);
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) s = R.step(s, a).state;
    const b = R.mapView(s).dim.maxPerToll;
    const c0 = dimClock(s.zone, R.mapView(s).zt);
    assert.ok(b > C.DIM_MAX_PER_TOLL && R.tutorialView(s).hold.released === false, `held: ${b}`);
    let top = 0;
    for (let k = 0; k <= 30; k++) {
      // k tolls later (the clock only; nothing else is spent), the guide ends: the release happens at that clock
      const x = copy(s);
      x.time += k;
      const r = R.step(x, { type: 'SKIP_GUIDE' }).state;
      assert.equal(R.tutorialView(r).hold.released, true, `k ${k}`);
      const p = peakAfter(r.zone, c0);
      assert.ok(p <= b, `release ${k} tolls on: ${p} in one toll, bound ${b}`);
      top = Math.max(top, p);
      // once released, the bound is the remaining schedule's own peak (at least the cap)
      assert.equal(R.mapView(r).dim.maxPerToll, Math.max(C.DIM_MAX_PER_TOLL, peakAfter(r.zone, dimClock(r.zone, R.mapView(r).zt))));
    }
    assert.equal(top, b, 'the bound is reached by a release still possible');
  });
});

describe('newcomer (5): a toll cost that grows says why: heatPreview `parts` (s0033, s0065)', () => {
  test('the same Quest node: 3 tolls, then 5 once it dims before its tolls end: [quest 3] then [quest 3, dimFight 2]', () => {
    let s = guidedRun('mage', 5);
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) s = R.step(s, a).state;
    const id = 4; // a Quest node next to the hub, Dimmed from zone toll 10 on TUTORIAL_SEED
    const at = dimAt(s.zone, id);
    const later = (k) => { const x = copy(s); x.time += k; return x; };
    const before = R.heatPreview(later(at - C.EXPED_TIME_QUEST - 1 - R.mapView(s).zt), { type: 'MOVE', nodeId: id });
    const after = R.heatPreview(later(at - C.EXPED_TIME_QUEST - R.mapView(s).zt), { type: 'MOVE', nodeId: id });
    assert.deepEqual([before.time, before.dimFight, before.parts], [3, false, [{ why: 'quest', tolls: 3 }]]);
    assert.deepEqual([after.time, after.dimFight, after.parts], [5, true, [{ why: 'quest', tolls: 3 }, { why: 'dimFight', tolls: C.TIME_DIM_FIGHT }]]);
  });

  test('every preview of autoplay runs, both maps: parts sum to `time`, the action\'s own part first, a dimFight part exactly when `dimFight`', () => {
    const OWN = new Set(['quest', 'grind', 'elite', 'dungeon', 'rest', 'vendor', 'trainer', 'treasure', 'shrine', 'walk', 'pass', 'travel', 'bell', 'inn']);
    const seen = new Set();
    for (const mapMode of ['expedition', 'rows']) {
      let s = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 7, content: CONTENT, mapMode, profile: { ...R.newProfile(), runs: 2 } });
      for (let i = 0; i < 6000 && s.phase !== 'ENDED' && !(s.zone && s.zone.z >= 3); i++) {
        if (!s.fight && s.player && s.zone) {
          for (const p of R.heatView(s).next) {
            const sum = p.parts.reduce((a, x) => a + x.tolls, 0);
            assert.equal(sum, p.time, JSON.stringify(p.action));
            assert.ok(OWN.has(p.parts[0].why), p.parts[0].why);
            const dim = p.parts.filter((x) => x.why === 'dimFight');
            assert.equal(dim.length, p.dimFight ? 1 : 0);
            if (dim.length) assert.equal(dim[0].tolls, dim[0].escape ? C.TIME_DIM_ESCAPE : C.TIME_DIM_FIGHT);
            for (const x of p.parts) seen.add(x.why + (x.escape ? ':escape' : ''));
          }
        }
        s = R.step(s, R.autoAction(s)).state;
      }
    }
    for (const w of ['quest', 'walk', 'pass', 'travel', 'grind', 'dimFight', 'trainer', 'vendor', 'inn']) assert.ok(seen.has(w), `${w} seen: ${[...seen]}`);
  });
});

describe('newcomer (6): the talent window\'s rule line matches the engine\'s rule (s0108)', () => {
  const fill = (line) => line.replace('{first}', String(C.TALENT_FIRST_LEVEL)).replace('{step}', String(C.TALENT_LEVEL_STEP));
  test('content texts.progress: one point at TALENT_FIRST_LEVEL, then one every TALENT_LEVEL_STEP; the engine pays exactly that', () => {
    const P = CONTENT.texts.progress;
    assert.deepEqual(Object.keys(P).sort(), [...C.PROGRESS_TEXT_IDS].sort());
    assert.equal(fill(P.talent_points), 'One point at level 10, then one every 2 levels. Reset at a trainer.');
    assert.equal(fill(P.talents_locked), 'Talents unlock at level 10.');
    // the engine's rule (rules 6, progress.js talentPointsEarned) at the levels the line names
    let s = R.newRun({ classId: 'rogue', seed: 3, content: CONTENT, mapMode: 'rows' });
    s = R.step(s, { type: 'START_RUN' }).state;
    const at = (L) => { const x = copy(s); x.player.level = L; return R.talentPointsFree(x); };
    const F = C.TALENT_FIRST_LEVEL;
    const S = C.TALENT_LEVEL_STEP;
    assert.deepEqual([at(F - 1), at(F), at(F + S - 1), at(F + S), at(F + 2 * S)], [0, 1, 1, 2, 3]);
    assert.equal(at(C.MAX_LEVEL), Math.floor((C.MAX_LEVEL - F) / S) + 1, 'rules 6: 26 points by level 60');
  });

  test('validateContent keeps the line on the rule: a missing placeholder or an unknown id is reported', () => {
    const bad = { ...CONTENT, texts: { ...CONTENT.texts, progress: { talent_points: 'One point every 2 levels. Reset at a trainer.', talents_locked: 'Talents unlock later.', other: 'x' } } };
    const errs = R.validateContent(bad).join('\n');
    for (const w of ['texts.progress.talent_points: needs {first}', 'texts.progress.talent_points: needs {step}', 'texts.progress.talents_locked: needs {first}', 'texts.progress.other: unknown id']) assert.ok(errs.includes(w), w);
    assert.deepEqual(R.validateContent(CONTENT, { strict: true }), []);
  });
});

describe('newcomer (7): offhand base names follow the item and the class: quivers only for Hunters, casters\' offhands from the INT list (s0126)', () => {
  const bandOf = (ilvl) => CONTENT.itemNames[Math.min(C.ZONE_COUNT, Math.max(1, Math.ceil(ilvl / C.ZONE_LEVELS))) - 1];
  const baseOf = (name, list) => list.find((b) => name === b || name.endsWith(` ${b}`) || name.startsWith(`${b} `) || name.includes(` ${b} `));

  test('every offhand of 3000 drops per class takes its base from the list of its primary stat, a Hunter\'s Agility one from `hunter`', () => {
    const counts = {};
    for (const classId of C.CLASS_IDS) {
      let s = R.newRun({ classId, petId: PET(classId), seed: 21, content: CONTENT, mapMode: 'rows' });
      s = copy(R.step(s, { type: 'START_RUN' }).state);
      const rng = makeRng(hash32(`offhand|${classId}`));
      for (let i = 0; i < 3000; i++) {
        for (const it of rollDrop(s, rng, 'elite', 1 + (i % C.MAX_LEVEL), 1)) {
          if (it.kind !== 'gear' || it.slot !== 'offhand' || it.unique) continue;
          const lists = bandOf(it.ilvl).offhand;
          const k = it.stats.INT > it.stats.AGI ? 'INT' : 'AGI';
          const want = classId === 'hunter' && k === 'AGI' ? 'hunter' : k;
          assert.ok(baseOf(it.name, lists[want]), `${classId} ${k} ilvl ${it.ilvl}: "${it.name}" not from ${want}`);
          if (want !== 'hunter') assert.ok(!/quiver/i.test(it.name), `${classId}: "${it.name}"`);
          counts[`${classId}:${want}`] = (counts[`${classId}:${want}`] || 0) + 1;
        }
      }
    }
    // the drops cover each class's own lists (other-primary drops too: a Mage's Agility offhand is a shield)
    for (const k of ['rogue:AGI', 'mage:INT', 'hunter:hunter', 'mage:AGI', 'rogue:INT', 'hunter:INT']) assert.ok(counts[k] > 0, `${k}: ${JSON.stringify(counts)}`);
  });

  test('the newcomer\'s case: a Mage\'s Intellect offhand at item level 5 is a caster base of band 1, never "Quiver of Rushes"; weapons keep their lists', () => {
    let s = R.newRun({ classId: 'mage', seed: 7, content: CONTENT, mapMode: 'rows' });
    s = copy(R.step(s, { type: 'START_RUN' }).state);
    const names = new Set();
    for (let i = 0; i < 40; i++) names.add(makeFixedGear(s, 'offhand', 'uncommon', 5, null).name);
    assert.ok([...names].every((n) => baseOf(n, CONTENT.itemNames[0].offhand.INT)), [...names].join(', '));
    assert.ok(names.size >= 2, 'more than one caster base');
    assert.ok(baseOf(makeFixedGear(s, 'weapon', 'uncommon', 5, null).name, CONTENT.itemNames[0].weapon.INT));
  });

  test('validateContent: a slot object keeps AGI and INT lists, and any other key is a class id with its own list', () => {
    const band = CONTENT.itemNames[0];
    const bad = { ...CONTENT, itemNames: [{ ...band, offhand: { ...band.offhand, priest: ['A', 'B', 'C'], hunter: ['Only One'] } }, ...CONTENT.itemNames.slice(1)] };
    const errs = R.validateContent(bad, { strict: true }).join('\n');
    assert.ok(errs.includes('itemNames[0].offhand.priest: not AGI, INT or a class id'), errs);
    assert.ok(errs.includes('itemNames[0].offhand.hunter: 1 names'), errs);
    for (const b of CONTENT.itemNames) assert.deepEqual(Object.keys(b.offhand).sort(), ['AGI', 'INT', 'hunter']);
  });
});

describe('newcomer (8): does overspending carry over? heatView `carry` says so (s0142; no rule change)', () => {
  test('every state of autoplay runs on both maps: cumulative, carried = the heat at entry on the zone before\'s line, heat = carried - share + tolls since entry', () => {
    for (const mapMode of ['expedition', 'rows']) {
      let most = 0;
      for (const classId of C.CLASS_IDS) {
        let s = R.newRun({ classId, petId: PET(classId), seed: 13, content: CONTENT, mapMode, profile: { ...R.newProfile(), runs: 2 } });
        let entry = null;
        let z = null;
        let zones = 0;
        for (let i = 0; i < 20000 && s.phase !== 'ENDED'; i++) {
          const hv = R.heatView(s);
          if (hv) {
            const zl = s.zone.camp ? C.ZONE_COUNT + 1 : s.zone.z;
            if (zl !== z) { z = zl; entry = s.time; zones++; } // the first state in a zone is its entry (the hub)
            const before = lineAt(s.oaths, zl - 1);
            assert.deepEqual(hv.carry, { cumulative: true, carried: entry - before, share: hv.line - before }, `${mapMode} ${classId} z${zl}`);
            assert.equal(hv.heat, hv.carry.carried - hv.carry.share + (s.time - entry));
            if (zl === C.ZONE_COUNT + 1) assert.equal(hv.carry.share, 0, 'the Camp: the line is the par');
          }
          s = R.step(s, R.autoAction(s)).state;
        }
        most = Math.max(most, zones);
      }
      assert.ok(most >= 3, `${mapMode}: a run through three or more zones (${most})`);
    }
  });

  test('three tolls over in zone 1 are three fewer in hand in zone 2, and a step nearer a stronger Oruvath', () => {
    const toZone2 = (extra) => {
      let s = R.newRun({ classId: 'mage', seed: 5, content: CONTENT, profile: { ...R.newProfile(), runs: 2 } });
      for (let i = 0; i < 4000 && !(s.zone && s.zone.z === 1 && s.phase === 'MAP'); i++) s = R.step(s, R.autoAction(s)).state;
      s = copy(s);
      s.time += extra; // tolls spent over the line in zone 1
      for (let i = 0; i < 4000 && !(s.zone && s.zone.z === 2); i++) s = R.step(s, R.autoAction(s)).state;
      return R.heatView(s);
    };
    const a = toZone2(0);
    const b = toZone2(3);
    assert.equal(b.carry.carried, a.carry.carried + 3);
    assert.equal(b.carry.share, a.carry.share);
    assert.equal(b.heat, a.heat + 3);
    assert.ok(b.ascIfPar >= a.ascIfPar);
  });
});
