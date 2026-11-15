// Newcomer check 2026-11-15 (docs/feedback/2026-11-15-blind-newcomer.md; BACKLOG 2026-11-15; engine and content side,
// docs/handoffs/engine-2026-11-15.md): (1) a guided node's map tooltip names only the quest it holds: the node being played
// keeps its quest through its reward stage (the finished Rooted Rows node was renamed to the next script's quest), and an
// unresolved guided node, whose quest is fixed only when it is entered (m3-onboarding.md 2.3), names none.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';

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

