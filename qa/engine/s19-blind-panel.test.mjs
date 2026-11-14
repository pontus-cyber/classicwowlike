// Blind tester pilot follow-ups, engine and content side (D144; docs/feedback/2026-11-13-blind-casual.md and
// -tactician.md; docs/handoffs/engine-2026-11-13d.md): (2) the hub's trainer advice follows R.trainerView (nothing to learn
// at level 1), and the off-balance hint's "spend your big hit" has a shield line when the target's shield absorbs a whole
// hit (R.offBalance `shield`, `absorbs`); (5) a hit roll that decides a control is shown (spellInfo `hit`, `hitAll`;
// windupView answers' `chance`), and the tactician's s0204 (Rime Burst left one of three wind-ups unanswered) is that
// roll, not a rule or a bug; (3) the text and data mismatches on the engine and content side (G9 lines, the guided zone's
// quest texts, mapView `waves` and `guided`); (4) reward choices carry the class's primary stat (rules 8.3, D144). D146
// (report balance-2026-11-13c, option a6): zone 2's inner ring keeps zone 1's quest cap (GATES.zone2InnerCap). D147
// (changes-m3-v1.md row 1; the testers' "nothing could hurt in zone 1"): zone 1 enemy damage (GATES.z1Dmg).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, atLevel, withSpells, inFight, tweak, forceDraws, ev } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';
import { mainHitEstimate } from '../../src/engine/spells.js';
import { rollDrop } from '../../src/engine/items.js';
import { makeRng } from '../../src/rng.js';

/** One roll on a drop table at level 20, zone 1 (rules 8.4). */
const rollDropOf = (s, g, table) => rollDrop(s, g, table, 20, 1);

const near = (a, b) => Math.abs(a - b) < 1e-12;

describe('blind panel (5): the hit roll of a control that lands only on a hit is shown (tactician s0204)', () => {
  /** A class at level L with these bar spells in a quest fight (engage round) against `foes` at level `lvl`, everyone tough. */
  const fightOf = (cls, L, spells, foes, lvl) => {
    let s = withSpells(atLevel(started(cls, { seed: 21 }), L), spells);
    s = inFight(s, foes.map((tid) => ({ tid, level: lvl })), { kind: 'quest', noStealth: true }).state;
    return tweak(s, (x) => { for (const e of x.fight.enemies) e.maxHp = e.hp = 1e6; x.player.d.maxHp = x.player.hp = 1e6; });
  };
  /** Three guardians met for the first time: each one's turn 2 (round 3) is a wind-up; PASS to round 3. */
  const sentinels = () => {
    let s = fightOf('mage', 13, ['ember_bolt', 'rime_burst', 'spellsnap'], ['z1_guardian', 'z1_guardian', 'z1_guardian'], 15);
    assert.ok(s.fight.enemies.every((e) => e.firstMeet));
    for (let i = 0; i < 2; i++) s = R.step(s, { type: 'PASS' }).state;
    assert.equal(s.fight.round, 3);
    assert.ok(s.fight.enemies.every((e) => e.intent.windup), 'every wind-up is now');
    return s;
  };

  test('spellInfo hit / hitAll: 1 - (MISS_BASE + MISS_PER_LEVEL per level above, at most MISS_CAP) (- dodge for a physical hit); 1 for an interrupt; null outside a fight', () => {
    const s = fightOf('mage', 13, ['ember_bolt', 'rime_burst', 'spellsnap'], ['z1_guardian', 'z1_guardian', 'z1_brute'], 15);
    const want = 1 - (C.MISS_BASE + C.MISS_PER_LEVEL * 2);
    assert.ok(near(R.spellInfo(s, 'ember_bolt', 0).hit, want));
    const all = R.spellInfo(s, 'rime_burst', null);
    assert.equal(all.hit, null);
    assert.deepEqual(all.hitAll.map((x) => x.u), [0, 1, 2]);
    for (const x of all.hitAll) assert.ok(near(x.chance, want), 'each enemy its own roll');
    assert.equal(R.spellInfo(s, 'spellsnap', 0).hit, 1, 'an interrupt never misses');
    assert.ok(near(R.spellInfo(fightOf('mage', 13, ['ember_bolt'], ['z1_brute'], 40), 'ember_bolt', 0).hit, 1 - C.MISS_CAP), 'capped');
    assert.ok(near(R.spellInfo(fightOf('mage', 13, ['ember_bolt'], ['z1_brute'], 9), 'ember_bolt', 0).hit, 1 - C.MISS_BASE), 'below: the base');
    // a physical hit can be dodged: the skulker's dodge counts
    const r = fightOf('rogue', 10, ['gutting_jab'], ['z1_skulker'], 10);
    assert.ok(near(R.spellInfo(r, 'gutting_jab', 0).hit, 1 - (C.MISS_BASE + C.ENEMY_DODGE + C.ARCHETYPE.skulker.dodge)));
    assert.deepEqual([R.spellInfo(started('mage'), 'ember_bolt', 0).hit, R.spellInfo(started('mage'), 'ember_bolt', 0).hitAll], [null, null]);
  });

  test('windupView: Rime Burst\'s answer to each wind-up carries the hit chance on that enemy (sure false); sure answers carry none', () => {
    const s = sentinels();
    const w = R.windupView(s);
    assert.equal(w.length, 3);
    const hitAll = R.spellInfo(s, 'rime_burst', null).hitAll;
    for (const x of w) {
      const rb = x.answers.find((a) => a.id === 'rime_burst');
      assert.deepEqual([rb.how, rb.sure, rb.now], ['stun', false, true]);
      assert.ok(near(rb.chance, hitAll.find((h) => h.u === x.u).chance) && rb.chance < 1, `enemy ${x.u}: ${rb.chance}`);
      const sn = x.answers.find((a) => a.id === 'spellsnap');
      assert.deepEqual([sn.how, sn.sure, sn.chance], ['interrupt', true, undefined]);
    }
  });

  test('s0204 is the hit roll: Rime Burst missing one of three wind-up enemies leaves that wind-up to land (EMPOWERED); the two it hit are staggered; the miss is an event', () => {
    const c = tweak(sentinels(), () => {});
    // draws: Rime Burst's three hits (3 draws each: r1 miss, r2 crit, r3 variance), then enemy 1's wind-up hit on the player
    forceDraws(c, 12, (d) => d[0] >= 0.5 && d[3] < 0.05 && d[6] >= 0.5 && d[9] >= 0.5);
    const r = R.step(c, { type: 'CAST', spellId: 'rime_burst', target: null });
    assert.deepEqual(ev(r.events, 'miss').map((x) => [x.dst, x.spell]), [[1, 'rime_burst']]);
    assert.deepEqual(ev(r.events, 'stagger').map((x) => [x.u, x.why]), [[0, 'interrupt'], [2, 'interrupt']]);
    assert.deepEqual(ev(r.events, 'empower').map((x) => x.u), [1], 'the missed one\'s wind-up landed');
  });
});

describe('blind panel (2a): the hub does not send a character with nothing to learn to the trainer (R.trainerView)', () => {
  const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
  const hub = (classId, tutorial) => {
    let s = R.newRun({ classId, petId: PET(classId), seed: 5, content: REAL, tutorial });
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }]) s = R.step(s, a).state;
    return s;
  };

  test('at the first hub (level 1), every class, guided or not: nothing to learn or train, the next spell at level 4, not useful; autoplay leaves without the trainer', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      for (const tutorial of [false, true]) {
        let s = hub(classId, tutorial);
        assert.deepEqual([s.phase, s.player.level], ['ZONE_HUB', 1]);
        assert.deepEqual(R.trainerView(s), { learn: [], train: [], next: 4, useful: false }, `${classId} ${tutorial}`);
        const seen = [];
        for (let n = 0; s.phase === 'ZONE_HUB' && n < 20; n++) { const a = R.autoAction(s); seen.push(a.type === 'SERVICE' ? a.service : a.type); s = R.step(s, a).state; }
        assert.ok(!seen.includes('trainer') && seen[seen.length - 1] === 'LEAVE_HUB', `${classId}: ${seen.join(' ')}`);
      }
    }
    assert.equal(R.trainerView(R.newRun({ classId: 'mage', content: REAL })), null, 'null before START_RUN');
  });

  test('a spell to learn or a rank to train makes it useful only when the gold covers it; prices are the trainer\'s', () => {
    const s = hub('mage', false);
    const lvl4 = tweak(s, (x) => { x.player.level = 4; x.player.gold = 1e6; });
    const v = R.trainerView(lvl4);
    assert.ok(v.learn.length > 0 && v.learn.every((x) => x.lvl <= 4 && x.cost > 0 && C.SPELL[x.id].cls === 'mage'), JSON.stringify(v.learn));
    assert.deepEqual(v.train.map((x) => x.id).sort(), Object.keys(s.player.spells).sort(), 'the start spells trained at level 1 rank up');
    assert.ok(v.next > 4 && v.useful);
    const poor = R.trainerView(tweak(lvl4, (x) => { x.player.gold = 0; }));
    assert.deepEqual([poor.learn.length, poor.train.length, poor.useful], [v.learn.length, v.train.length, false]);
    // only ranks: every spell up to the level known, trained below it
    const ranks = tweak(lvl4, (x) => { for (const l of v.learn) { x.player.spells[l.id] = { tl: 4, rank: 1 }; x.player.spellOrder.push(l.id); } });
    const r = R.trainerView(ranks);
    assert.deepEqual([r.learn, r.train.length > 0, r.train.every((x) => x.tl < 4 && x.cost === r.train[0].cost), r.useful], [[], true, true, true]);
  });

  test('content: the hub lines (draft) say {zone}; the plain one does not send to the trainer; both fit ONB_HINT_MAX_CHARS with the longest zone name', () => {
    const g = REAL.tutorial.guide;
    const longest = Math.max(...REAL.zones.map((z) => z.name.length));
    for (const line of [g.hubLine, g.hubTrainerLine]) {
      assert.ok(line.includes('{zone}'), line);
      assert.ok(line.length - '{zone}'.length + longest <= C.ONB_HINT_MAX_CHARS, line);
    }
    assert.ok(!/visit the trainer/i.test(g.hubLine) && /trainer/i.test(g.hubTrainerLine));
  });
});

describe('blind panel (2b): "spend your big hit now" is not the advice when the target\'s shield absorbs a whole hit (casual s0193)', () => {
  /** A Rogue of level L in an elite fight with Bargh (zone 2's elite, level 18) and his Fenmother Acolyte (a mender). */
  const bargh = (L = 10) => {
    const s = atLevel(started('rogue', { content: REAL, seed: 3 }), L);
    return inFight(s, [{ tid: 'z2_bargh', level: 18, variant: 'elite' }, { tid: 'z2_fen_healer', level: 18 }], { kind: 'elite', noStealth: true }).state;
  };
  const offBal = (x, i = 0, id = 'OFF_BALANCE') => { x.fight.enemies[i].st.push({ id, dur: 2, value: C.OFFBAL_TAKEN }); };

  test('offBalance: shield (its enemy shield, 0 without) and absorbs (shield >= the main attack\'s average hit on it now)', () => {
    const s = bargh();
    const plain = R.offBalance(tweak(s, (x) => offBal(x)), 0);
    assert.deepEqual([plain.status, plain.shield, plain.absorbs], ['OFF_BALANCE', 0, false]);
    // the casual's case: a Bolster's shield (BOLSTER_PCT of max HP) on a level 18 elite against a level 10 Rogue
    const bolstered = tweak(s, (x) => { offBal(x); x.fight.enemies[0].shield = Math.round(C.BOLSTER_PCT * x.fight.enemies[0].maxHp); });
    const est = mainHitEstimate(bolstered, 0);
    assert.ok(bolstered.fight.enemies[0].shield > 3 * est, `shield ${bolstered.fight.enemies[0].shield}, hit ${est}`);
    assert.deepEqual([R.offBalance(bolstered, 0).shield, R.offBalance(bolstered, 0).absorbs], [bolstered.fight.enemies[0].shield, true]);
    // the boundary: a shield smaller than one hit lets the big hit through
    const at = (sh) => R.offBalance(tweak(bolstered, (x) => { x.fight.enemies[0].shield = sh; }), 0);
    assert.deepEqual([at(est - 1).absorbs, at(est).absorbs], [false, true]);
    // a FROZEN window counts as off-balance, the same rule
    const fr = R.offBalance(tweak(s, (x) => { offBal(x, 0, 'FROZEN'); x.fight.enemies[0].shield = 1e5; }), 0);
    assert.deepEqual([fr.status, fr.absorbs], ['FROZEN', true]);
    // the window's +OFFBAL_TAKEN is in the estimate (the snapshot reads the target's statuses)
    assert.ok(mainHitEstimate(tweak(s, (x) => offBal(x)), 0) > mainHitEstimate(s, 0));
  });

  test('content: H05 keeps its line and has the shield line (draft) for that case, within ONB_HINT_MAX_CHARS, without "spend your big hit now"', () => {
    const h = REAL.tutorial.hints.find((x) => x.id === 'H05');
    assert.match(h.line, /Spend your big hit now/);
    assert.ok(h.alt && typeof h.alt.shield === 'string');
    assert.ok(h.alt.shield.length <= C.ONB_HINT_MAX_CHARS && /shield/.test(h.alt.shield) && !/now/.test(h.alt.shield), h.alt.shield);
    assert.deepEqual(R.validateContent(REAL, { strict: true }), []);
  });
});

describe('D150 (owner text pass, wrong texts): offBalance bigHit, spellInfo est, a finisher\'s amount.cp', () => {
  /** A class at level L with these bar spells in a quest fight's engage round with one tough enemy of its level. */
  const fightOf = (cls, L, spells, { cp = 0, ob = true } = {}) => {
    let s = withSpells(atLevel(started(cls, { content: REAL, seed: 7 }), L), spells);
    s = inFight(s, [{ tid: 'z1_hedge_ogre', level: L }], { kind: 'quest', noStealth: true }).state;
    return tweak(s, (x) => {
      x.fight.enemies[0].maxHp = x.fight.enemies[0].hp = 1e7; x.player.d.maxHp = x.player.hp = 1e7; x.fight.p.cp = cp;
      if (ob) x.fight.enemies[0].st.push({ id: 'OFF_BALANCE', dur: 2, value: C.OFFBAL_TAKEN });
    });
  };

  test('bigHit: only with a big hit castable now: a Rogue\'s finisher with combo points (0: none, the blind tester\'s case), a Mage\'s cooldown nuke off cooldown', () => {
    assert.equal(R.offBalance(fightOf('rogue', 10, ['gutting_jab', 'severing_flourish']), 0).bigHit, false, '0 combo points');
    assert.equal(R.offBalance(fightOf('rogue', 10, ['gutting_jab', 'severing_flourish'], { cp: 2 }), 0).bigHit, true, '2 combo points');
    assert.equal(R.offBalance(fightOf('rogue', 10, ['gutting_jab'], { cp: 2 }), 0).bigHit, false, 'no finisher on the bar');
    assert.equal(R.offBalance(fightOf('mage', 40, ['ember_bolt', 'frost_lance']), 0).bigHit, false, 'the main attack is no big hit');
    const pc = fightOf('mage', 40, ['ember_bolt', 'pyre_comet']);
    assert.equal(R.offBalance(pc, 0).bigHit, true, 'Pyre Comet ready');
    assert.equal(R.offBalance(tweak(pc, (x) => { x.fight.p.cds.pyre_comet = x.fight.round + 2; }), 0).bigHit, false, 'on cooldown');
    assert.equal(R.offBalance(fightOf('rogue', 10, ['severing_flourish'], { cp: 2, ob: false }), 0), null, 'no window: null as before');
  });

  test('est: the direct hit after level, crits and armour, a finisher at the fight\'s combo points; amount is a total at amount.cp, not per point; the average of the casts\' hits; mainHitEstimate unchanged', () => {
    const s = fightOf('rogue', 10, ['gutting_jab', 'severing_flourish'], { cp: 2, ob: false });
    const info = R.spellInfo(s, 'severing_flourish', 0);
    assert.deepEqual([info.amount.kind, info.amount.perCp, info.amount.cp], ['damage', true, 2]);
    assert.ok(info.est > 0 && info.est < info.amount.amount, `a physical hit after armour: est ${info.est}, amount ${info.amount.amount}`);
    assert.equal(R.spellInfo(fightOf('rogue', 10, ['severing_flourish'], { cp: 4, ob: false }), 'severing_flourish', 0).amount.cp, 4);
    assert.equal(R.spellInfo(s, 'gutting_jab', 0).est, mainHitEstimate(s, 0), 'the main attack: mainHitEstimate');
    assert.equal(R.spellInfo(s, 'gutting_jab', 0).amount.cp, undefined, 'not a finisher: no cp');
    // the average of 300 casts at 2 combo points (hits only), each from its own draws
    let sum = 0; let n = 0;
    for (let k = 0; k < 300; k++) {
      const x = tweak(s, (y) => { y.fight.rng = makeRng(1000 + k); y.fight.p.cp = 2; });
      const r = R.step(x, { type: 'CAST', spellId: 'severing_flourish', target: 0 });
      const d = r.events.find((e) => e.t === 'damage' && e.src === 'player' && e.dst === 0 && !e.miss && e.spell === 'severing_flourish');
      if (d) { sum += d.amount; n += 1; }
    }
    assert.ok(n > 200 && Math.abs(sum / n - info.est) / info.est < 0.08, `average ${Math.round(sum / n)} over ${n} hits, est ${info.est}`);
    assert.equal(R.spellInfo(atLevel(started('rogue', { content: REAL, seed: 7 }), 10), 'severing_flourish').est, null, 'no fight: null');
  });
});

describe('blind panel (3): text and data mismatches, engine and content side', () => {
  const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
  /** A guided run on zone 1's map, the board slot 1 Cull taken (real content). */
  const guided = (classId = 'mage', seed = 5) => {
    let s = R.newRun({ classId, petId: PET(classId), seed, content: REAL, tutorial: true });
    for (const a of [{ type: 'START_RUN' }, { type: 'TAKE_CONTRACT', index: 0 }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) s = R.step(s, a).state;
    return s;
  };
  /** The state with `script` scripted fights ended, the overlay laid on again by two no-op steps. */
  const atScript = (s, script) => {
    const x = tweak(s, (y) => { y.tutorial.script = script; });
    return R.step(R.step(x, { type: 'SET_AUTOPLAY', on: true }).state, { type: 'SET_AUTOPLAY', on: false }).state;
  };
  const sameSet = (a, b) => [...new Set(a)].sort().join() === [...new Set(b)].sort().join();

  test('G9 and H04 name no turn (D144); since D150 they have no line before a landed Deathblow (the UI\'s prompt bar gives its answer, once); the badge gives the round', () => {
    const T = REAL.tutorial;
    const g9 = T.beats.find((b) => b.id === 'G9');
    assert.deepEqual([g9.line, g9.byClass, Object.keys(g9.alt)], [undefined, undefined, ['landed']]);
    assert.ok(!/\bturn\b|\{deathblowTurn\}|round \d/i.test(g9.alt.landed) && g9.alt.landed.length <= C.ONB_HINT_MAX_CHARS, g9.alt.landed);
    const h04 = T.hints.find((h) => h.id === 'H04');
    assert.deepEqual([h04.line, h04.sameAs, h04.retired], [null, undefined, 'D150']);
    // the round: an elite present from the start plays its Deathblow on its turn SIGNATURE_TURN, round SIGNATURE_TURN + 1
    const s = inFight(atLevel(started('rogue'), 20), [{ tid: 'z1_elite', level: 20, variant: 'elite' }], { kind: 'elite', noStealth: true }).state;
    const db = R.windupView(s).find((w) => w.deathblow);
    assert.deepEqual([db.turn, db.round, db.inRounds], [C.SIGNATURE_TURN, C.SIGNATURE_TURN + 1, C.SIGNATURE_TURN]);
  });

  test('guided zone: a Quest node shows the quest of the fight it plays (its enemies are that fight\'s), the fight carries it, and its own quest comes back once the scripts are used up', () => {
    const T = REAL.tutorial;
    const s0 = guided();
    for (let k = 0; k < T.scripts.length; k++) {
      const s = atScript(s0, k);
      const mv = R.mapView(s);
      let seen = 0;
      for (const n of s.zone.nodes) {
        if (n.type !== 'quest' || !n.tutRole) continue;
        const role = n.tutRole.kind === 'site' ? T.siteFights[n.tutRole.i] : T.scripts[n.tutRole.i];
        const q = REAL.quests[n.quest];
        assert.equal(n.quest, role.quest, `node ${n.id}`);
        assert.ok(sameSet(q.enemies, role.enemies.map((e) => e.enemy)) && sameSet(n.mobs, q.enemies), `node ${n.id}: ${q.title} / ${n.mobs}`);
        if (mv.nodes[n.id].know === 'full') { assert.equal(mv.nodes[n.id].title, q.title); seen++; }
      }
      assert.ok(seen > 0, `script ${k}: a quest node in view`);
    }
    // the fight: the first scripted quest fight (S1 on node 3 here) carries the boar's quest, not the node's own
    const f = R.step(s0, { type: 'MOVE', nodeId: 3 });
    assert.equal(f.state.fight.tut.id, 's1');
    assert.equal(f.state.node.quest, 'q_z1_guide_rooted_rows');
    assert.ok(f.events.some((e) => e.t === 'quest' && e.quest === 'q_z1_guide_rooted_rows'));
    assert.ok(sameSet(REAL.quests[f.state.node.quest].enemies, f.state.fight.enemies.map((e) => e.tid)));
    assert.notEqual(s0.zone.nodes[3].gen.quest, 'q_z1_guide_rooted_rows');
    // scripts used up: every unresolved Quest node without a site plays and shows its own encounter and quest again
    const used = atScript(s0, C.ONB_SCRIPTED_FIGHTS);
    for (const n of used.zone.nodes) if (n.type === 'quest' && !n.tutRole) assert.deepEqual([n.quest, n.mobs], [n.gen.quest, n.gen.mobs], `node ${n.id}`);
    // the guided quests are in no zone's list: normal runs never draw them; the table names existing quests
    const listed = new Set(REAL.zones.flatMap((z) => z.quests));
    for (const x of [...T.scripts, ...T.siteFights]) assert.ok(REAL.quests[x.quest], x.id);
    for (const id of Object.keys(REAL.quests).filter((q) => q.startsWith('q_z1_guide_'))) assert.ok(!listed.has(id), id);
    // validateContent: a script's or site fight's quest must exist
    const bad = { ...REAL, tutorial: { ...T, scripts: [{ ...T.scripts[0], quest: 'q_nope' }, ...T.scripts.slice(1)], siteFights: [{ ...T.siteFights[0], quest: 'q_gone' }, ...T.siteFights.slice(1)] } };
    const errs = R.validateContent(bad).join('\n');
    assert.ok(errs.includes('tutorial.scripts[0].quest') && errs.includes('tutorial.siteFights[0].quest'), errs);
  });

  test('mapView: a Grind\'s `waves` (expedition: EXPED_GRIND_MAX_WAVES; rows: GRIND_MAX_WAVES; wave 1 is `archetypes`); `guided` marks only the guided zone\'s overlay fights', () => {
    const s = guided();
    const mv = R.mapView(s);
    const grinds = mv.nodes.filter((n) => n.know === 'full' && n.type === 'grind');
    assert.ok(grinds.length > 0 && grinds.every((n) => n.waves === C.EXPED_GRIND_MAX_WAVES && n.archetypes.length >= 1));
    assert.deepEqual([...new Set(mv.nodes.filter((n) => n.guided).map((n) => n.guided))].sort(), ['script', 'site']);
    for (const n of mv.nodes.filter((x) => x.guided)) assert.equal(n.guided, s.zone.nodes[n.id].tutRole.kind);
    assert.ok(mv.nodes.filter((n) => n.know === 'full' && (n.type === 'quest' || n.type === 'grind')).every((n) => n.guided));
    // a normal run: no marks; Grinds the same
    let p = R.newRun({ classId: 'mage', seed: 5, content: REAL });
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }, { type: 'LEAVE_HUB' }]) p = R.step(p, a).state;
    const pv = R.mapView(p);
    assert.ok(pv.nodes.every((n) => n.guided === undefined));
    assert.ok(pv.nodes.filter((n) => n.know === 'full' && n.type === 'grind').every((n) => n.waves === C.EXPED_GRIND_MAX_WAVES));
    const rows = R.mapView(started('mage')).rows.flat().filter((n) => n.type === 'grind');
    assert.ok(rows.length > 0 && rows.every((n) => n.waves === C.GRIND_MAX_WAVES));
  });
});

describe('blind panel (4): reward choices carry the class\'s primary stat (rules 8.3, REWARD_CLASS_BIAS, GATES.rewardPrimary)', () => {
  const PET = (c) => (c === 'hunter' ? 'ridgewolf' : null);
  /** Every reward choice set (quest and contract rewards) an autoplay run meets before zone 3: [{ table, items }]. */
  const rewardSets = (classId, seed, mapMode = 'expedition') => {
    let s = R.newRun({ classId, petId: PET(classId), seed, content: REAL, mapMode });
    const out = [];
    const seen = new Set();
    for (let n = 0; s.phase !== 'ENDED' && !(s.zone && s.zone.z >= 3) && n < 4000; n++) {
      for (const set of (s.node && s.node.rewards) || []) {
        if (set.kind !== 'items' || seen.has(set)) continue;
        seen.add(set);
        out.push({ contract: !!set.contract, items: set.items });
      }
      s = R.step(s, R.autoAction(s)).state;
    }
    return out;
  };

  test('every quest and contract reward choice of autoplay runs has the class\'s primary (Agility for a Rogue or Hunter, Intellect for a Mage), on both maps', () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const mine = C.CLASS[classId].primary;
      const other = mine === 'INT' ? 'AGI' : 'INT';
      let items = 0;
      let contracts = 0;
      for (const [seed, mapMode] of [[3, 'expedition'], [8, 'expedition'], [3, 'rows']]) {
        for (const set of rewardSets(classId, seed, mapMode)) {
          if (set.contract) contracts++;
          for (const it of set.items) {
            if (it.kind !== 'gear') continue;
            items++;
            assert.ok(it.stats[mine] > 0 && it.stats[other] === 0, `${classId} ${mapMode} ${seed}: ${it.name} ${JSON.stringify(it.stats)}`);
          }
        }
      }
      assert.ok(items >= 10 && contracts >= 1, `${classId}: ${items} reward items, ${contracts} contract rewards`);
    }
  });

  test('kill drops keep DROP_CLASS_BIAS; with the switch off a reward is drawn as before D144 (the same draws, only its primary differs)', () => {
    const s = started('mage', { content: REAL, seed: 4 });
    const draw = (table, n = 400) => {
      const g = makeRng(91);
      const c = tweak(s, () => {});
      const out = [];
      for (let i = 0; i < n; i++) out.push(...rollDropOf(c, g, table));
      return out.filter((x) => x.kind === 'gear');
    };
    const intShare = (xs) => xs.filter((x) => x.stats.INT > 0).length / xs.length;
    assert.ok(Math.abs(intShare(draw('elite')) - C.DROP_CLASS_BIAS) < 0.07, 'elite drops');
    assert.equal(intShare(draw('quest')), 1);
    C.GATES.rewardPrimary = false;
    let off;
    try { off = draw('quest'); } finally { C.GATES.rewardPrimary = true; }
    const on = draw('quest');
    assert.ok(Math.abs(intShare(off) - C.DROP_CLASS_BIAS) < 0.07, `switch off: ${intShare(off)}`);
    assert.deepEqual(on.map((x) => [x.slot, x.rarity, x.ilvl, x.affix]), off.map((x) => [x.slot, x.rarity, x.ilvl, x.affix]));
  });
});

describe('D146: zone 2\'s inner ring keeps zone 1\'s quest cap (rules 1.9.3, 2.1; QUEST_CAP_Z2_RINGS, GATES.zone2InnerCap)', () => {
  /** Zone `z` of an expedition run (no contract held) as generated: the run's nodes after the dev jumps to it. */
  const zoneOf = (seed, z, mapMode = 'expedition') => {
    let s = R.newRun({ classId: 'rogue', seed, content: REAL, mapMode });
    s = R.step(s, { type: 'START_RUN' }).state;
    if (s.phase === 'PREP') s = R.step(s, { type: 'SET_OUT' }).state;
    for (let k = 1; k < z; k++) s = R.debug.nextZone(s).state;
    return s.zone;
  };
  const withSwitch = (on, fn) => { C.GATES.zone2InnerCap = on; try { return fn(); } finally { C.GATES.zone2InnerCap = true; } };

  test('on: every zone 2 ring 1 quest has at most QUEST_MAX_SIZE_Z1 mobs, ring 2 and 3 quests may have three; off: ring 1 as before; nothing else differs', () => {
    assert.deepEqual([C.QUEST_CAP_Z2_RINGS, C.QUEST_MAX_SIZE_Z1, C.GATES.zone2InnerCap], [1, 2, true]);
    let capped = 0;
    let outerThree = 0;
    let innerQuests = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const on = zoneOf(seed, 2);
      const off = withSwitch(false, () => zoneOf(seed, 2));
      assert.equal(on.z, 2);
      for (const n of on.nodes) {
        const o = off.nodes[n.id];
        const inner = n.type === 'quest' && n.ring >= 1 && n.ring <= C.QUEST_CAP_Z2_RINGS;
        if (inner) {
          innerQuests++;
          assert.ok(n.mobs.length <= C.QUEST_MAX_SIZE_Z1, `seed ${seed} node ${n.id}: ${n.mobs}`);
          if (o.mobs.length > C.QUEST_MAX_SIZE_Z1) {
            capped++;
            // the same quest, its size drawn the same: cut to the cap, the first picks as drawn
            assert.deepEqual([n.quest, n.mobs.length], [o.quest, C.QUEST_MAX_SIZE_Z1]);
            continue;
          }
        }
        if (n.type === 'quest' && n.ring > C.QUEST_CAP_Z2_RINGS && n.mobs.length > C.QUEST_MAX_SIZE_Z1) outerThree++;
        assert.deepEqual(n, o, `seed ${seed} node ${n.id} (${n.type}, ring ${n.ring})`);
      }
    }
    assert.ok(capped > 0 && outerThree > 0 && innerQuests > capped, `capped ${capped}, outer three-mob quests ${outerThree}, inner quests ${innerQuests}`);
  });

  test('zone 1, zones 3-6 and the classic map are untouched by the switch', () => {
    for (const seed of [2, 7, 13]) {
      for (const z of [1, 3, 6]) assert.deepEqual(zoneOf(seed, z).nodes, withSwitch(false, () => zoneOf(seed, z).nodes), `seed ${seed} zone ${z}`);
      const rows = (on) => withSwitch(on, () => zoneOf(seed, 2, 'rows'));
      assert.ok(rows(true).rows, 'a classic-map zone');
      assert.deepEqual(rows(true), rows(false), `classic map seed ${seed}`);
    }
    // zone 1 quests keep the cap whatever the switch
    for (const seed of [2, 7, 13]) for (const n of withSwitch(false, () => zoneOf(seed, 1)).nodes) if (n.type === 'quest') assert.ok(n.mobs.length <= C.QUEST_MAX_SIZE_Z1);
  });
});

describe('D147: zone 1 enemy damage (rules 7.6; Z1_DMG_MULT, Z1_DMG_MAX_LEVEL, GATES.z1Dmg; changes-m3-v1.md row 1)', () => {
  const withSwitch = (on, fn) => { C.GATES.z1Dmg = on; try { return fn(); } finally { C.GATES.z1Dmg = true; } };
  const VARIANTS = ['normal', 'elite', 'rare', 'trash', 'dboss', 'shardspawn'];

  test('zoneDanger: levels 1-10 x Z1_DMG_MULT on top of the early factor (1.0), 11-20 keep EARLY_DMG_MULT, 21 up unchanged, every variant; off as before D147', () => {
    assert.deepEqual([C.Z1_DMG_MULT, C.Z1_DMG_MAX_LEVEL, C.GATES.z1Dmg], [1.25, 10, true]);
    for (const v of VARIANTS) {
      for (const L of [1, 2, 5, 10, 11, 12, 20, 21, 30, 45, 60]) {
        const on = R.zoneDanger(L, v);
        const off = withSwitch(false, () => R.zoneDanger(L, v));
        assert.ok(near(on, off * (L <= C.Z1_DMG_MAX_LEVEL ? C.Z1_DMG_MULT : 1)), `${v} level ${L}: ${on} vs ${off}`);
        if (L > C.Z1_DMG_MAX_LEVEL) assert.equal(on, off, `${v} level ${L} unchanged`);
      }
      assert.deepEqual([R.zoneDanger(1, v), R.zoneDanger(10, v), R.zoneDanger(11, v)], [1, 1, C.EARLY_DMG_MULT], v);
      assert.equal(withSwitch(false, () => R.zoneDanger(10, v)), C.EARLY_DMG_MULT, `${v}: off, level 10`);
    }
  });

  test('makeEnemy: a level 10 template enemy (any variant) deals x Z1_DMG_MULT with the switch on, a level 11 one the same; HP and armor unchanged', () => {
    const s = started('mage', { seed: 4 });
    for (const variant of ['normal', 'elite', 'rare']) {
      for (const level of [3, 10, 11]) {
        const foe = [{ tid: 'z1_brute', level, variant }];
        const on = inFight(s, foe).state.fight.enemies[0];
        const off = withSwitch(false, () => inFight(s, foe).state.fight.enemies[0]);
        assert.ok(near(on.dmg, off.dmg * (level <= C.Z1_DMG_MAX_LEVEL ? C.Z1_DMG_MULT : 1)), `${variant} ${level}: ${on.dmg} vs ${off.dmg}`);
        assert.deepEqual([on.hp, on.maxHp, on.armor, on.dodge], [off.hp, off.maxHp, off.armor, off.dodge]);
      }
    }
  });
});
