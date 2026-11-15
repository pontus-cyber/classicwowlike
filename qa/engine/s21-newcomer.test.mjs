// Newcomer check 2026-11-15 (docs/feedback/2026-11-15-blind-newcomer.md; BACKLOG 2026-11-15; engine and content side,
// docs/handoffs/engine-2026-11-15.md): (1) a guided node's map tooltip names only the quest it holds: the node being played
// keeps its quest through its reward stage (the finished Rooted Rows node was renamed to the next script's quest), and an
// unresolved guided node, whose quest is fixed only when it is entered (m3-onboarding.md 2.3), names none; (2) the trainer
// at a level (R.trainerView(state, level)): one step can give several levels, and each banner reads its own level.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { trainerUseful } from '../../src/engine/nodes.js';

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

  test('the newcomer\'s Mage: one step from level 7 to 11; the level 8 and 9 banners name no Rime Burst (learned from level 10, as the trainer row says), the level 10 one does', () => {
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
  });

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
