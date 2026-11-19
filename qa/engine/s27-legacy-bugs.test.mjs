// Legacy bugs of the blind returning-player check (docs/feedback/2026-11-19-blind-legacy-returning.md, "Wrong or confusing";
// BACKLOG 2026-11-19), the engine's part: a Rogue's weapons and offhands are named from its own lists in a Legacy run (no
// bows or shields; content weapon.rogue, offhand.rogue, draft), the level-60 game's names unchanged; CHOOSE_REWARD `equip`
// puts the chosen item on in the same step, before a Dimmed encounter that starts at once (EQUIP is refused in a fight),
// and from the loot window when the bags are full. The UI's part: ui-regress part Z and qa/ui/legacy-bugs.test.mjs.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { rollDrop } from '../../src/engine/items.js';
import { dimAt } from '../../src/engine/expedition.js';
import { makeRng, hash32 } from '../../src/rng.js';

const C = R.C;
const BOTH = { legacy: true, oruvathLegacy: true };
function gates(set, fn) {
  const saved = { ...C.GATES };
  Object.assign(C.GATES, set);
  try { return fn(); } finally { Object.assign(C.GATES, saved); }
}
const copy = (s) => R.deserialize(R.serialize(s), CONTENT);
const baseIn = (name, list) => list.some((b) => name === b || name.endsWith(` ${b}`) || name.startsWith(`${b} `) || name.includes(` ${b} `));
const union = (slot, key) => CONTENT.itemNames.flatMap((b) => b[slot][key]);
const BOW = /\b(\w*bow|recurve)\b/i;
const SHIELD = /\b(shield|buckler|targe|bulwark)\b/i;

/** Gear of `slot` rolled for a run of classId: n drops on the elite table and the reward tables, levels 1-60. */
function drops(s, slot, n = 2500) {
  const out = [];
  const rng = makeRng(hash32(`s27|${s.player.classId}|${slot}`));
  for (let i = 0; i < n; i++) {
    const table = ['elite', ...C.REWARD_DROP_TABLES][i % (1 + C.REWARD_DROP_TABLES.length)];
    for (const it of rollDrop(s, rng, table, 1 + (i % C.MAX_LEVEL), 1)) if (it.kind === 'gear' && it.slot === slot && !it.unique) out.push(it);
  }
  return out;
}
const started = (classId, opts = {}) => R.step(R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed: 27, content: CONTENT, ...opts }), { type: 'START_RUN' }).state;

describe('Legacy bugs: a Rogue is offered no bows and no shields (s0122, s0206)', () => {
  test('content: every band has weapon.rogue and offhand.rogue (3 names each, no bow or shield) and passes strict validation', () => {
    for (const b of CONTENT.itemNames) {
      assert.equal(b.weapon.rogue.length, 3);
      assert.equal(b.offhand.rogue.length, 3);
      for (const x of b.weapon.rogue) assert.ok(!BOW.test(x), x);
      for (const x of b.offhand.rogue) assert.ok(!SHIELD.test(x) && !/quiver/i.test(x), x);
    }
    assert.deepEqual(R.validateContent(CONTENT, { strict: true }), []);
  });

  test('a Legacy run: every Agility weapon and offhand of a Rogue (drops and reward choices) takes its base from the Rogue\'s lists', () => gates(BOTH, () => {
    const s = started('rogue');
    assert.ok(s.legacy, 'a Legacy run');
    for (const [slot, bad] of [['weapon', BOW], ['offhand', SHIELD]]) {
      const agi = drops(s, slot).filter((it) => it.stats.AGI >= it.stats.INT);
      assert.ok(agi.length > 50, `${slot}: ${agi.length} Agility items`);
      for (const it of agi) assert.ok(baseIn(it.name, union(slot, 'rogue')) && !bad.test(it.name), `${slot}: "${it.name}"`);
    }
  }));

  test('a Legacy run: the Hunter keeps its lists (Agility weapons from AGI, offhands the quivers); a Mage\'s Intellect items as before', () => gates(BOTH, () => {
    const h = started('hunter');
    const hw = drops(h, 'weapon').filter((it) => it.stats.AGI >= it.stats.INT);
    assert.ok(hw.length && hw.every((it) => baseIn(it.name, union('weapon', 'AGI'))), hw.map((x) => x.name).slice(0, 5).join(', '));
    assert.ok(hw.some((it) => BOW.test(it.name)), 'Hunters still find bows');
    const ho = drops(h, 'offhand').filter((it) => it.stats.AGI >= it.stats.INT);
    assert.ok(ho.length && ho.every((it) => baseIn(it.name, union('offhand', 'hunter'))));
    const m = started('mage');
    const mw = drops(m, 'weapon').filter((it) => it.stats.INT > it.stats.AGI);
    assert.ok(mw.length && mw.every((it) => baseIn(it.name, union('weapon', 'INT'))));
  }));

  test('the switch off: a Rogue\'s names come from the AGI lists as before (the recorded runs keep their names)', () => {
    assert.equal(C.GATES.legacy, false);
    const s = started('rogue', { mapMode: 'rows' });
    const w = drops(s, 'weapon').filter((it) => it.stats.AGI >= it.stats.INT);
    assert.ok(w.every((it) => baseIn(it.name, union('weapon', 'AGI'))));
    assert.ok(w.some((it) => BOW.test(it.name)), 'unchanged: the AGI list has its bows');
  });
});

describe('Legacy bugs: CHOOSE_REWARD `equip` (s0044 "EQUIP is not allowed during a fight"; s0160 Equip now with full bags)', () => {
  /** A Legacy Rogue run at its first quest's item choice, and the same state with the quest node dimmed (zone time past it). */
  function atReward() {
    let s = started('rogue');
    for (let i = 0; i < 5000 && !(s.node && s.node.stage === 'reward' && s.node.type === 'quest' && s.node.rewards[0].kind === 'items'); i++) s = R.step(s, R.autoAction(s)).state;
    assert.ok(s.node && s.node.stage === 'reward', 'a quest reward');
    const dimmed = copy(s);
    dimmed.zone.start = dimmed.time - dimAt(dimmed.zone, dimmed.zone.pos) - 1;
    return { s, dimmed };
  }

  test('the bug: on a dimmed node the choice starts a Dimmed encounter at once, and EQUIP of the chosen item is then refused', () => gates(BOTH, () => {
    const { dimmed } = atReward();
    const it = dimmed.node.rewards[0].items[0];
    const r = R.step(dimmed, { type: 'CHOOSE_REWARD', index: 0 });
    assert.ok(r.state.fight && r.events.some((e) => e.t === 'dim'), 'a Dimmed encounter starts');
    assert.match(R.whyIllegal(r.state, { type: 'EQUIP', itemId: it.uid }), /fight/);
  }));

  test('with equip the item is worn before the encounter starts: loot, equip, then the Dimmed encounter, in one step', () => gates(BOTH, () => {
    const { dimmed } = atReward();
    const it = dimmed.node.rewards[0].items[0];
    const worn = dimmed.player.equipped[it.slot];
    const r = R.step(dimmed, { type: 'CHOOSE_REWARD', index: 0, equip: true });
    const t = r.events.map((e) => e.t);
    assert.equal(r.state.player.equipped[it.slot].uid, it.uid);
    assert.ok(t.indexOf('loot') < t.indexOf('equip') && t.indexOf('equip') < t.indexOf('dim') && r.state.fight, t.join(','));
    if (worn) assert.ok(r.state.player.bag.some((x) => x && x.uid === worn.uid), 'the old item takes the bag slot');
    assert.ok(!r.state.player.bag.some((x) => x && x.uid === it.uid));
  }));

  test('with equip and full bags: the item is worn from the loot window, the old one waits there; without equip the item waits', () => gates(BOTH, () => {
    const { s } = atReward();
    const full = copy(s);
    for (let k = 0; full.player.bag.length < R.bagCapacity(full); k++) full.player.bag.push({ uid: `s27j${k}`, kind: 'junk', id: 'junk', name: 'Bent Nail', rarity: 'poor', value: 1, count: 1, ilvl: 1 });
    const it = full.node.rewards[0].items[0];
    const worn = full.player.equipped[it.slot];
    const plain = R.step(full, { type: 'CHOOSE_REWARD', index: 0 }).state;
    assert.ok(plain.loot.some((x) => x.uid === it.uid), 'the reported case: the item waits in the loot window');
    const r = R.step(full, { type: 'CHOOSE_REWARD', index: 0, equip: true });
    assert.equal(r.state.player.equipped[it.slot].uid, it.uid);
    assert.ok(!r.state.loot.some((x) => x.uid === it.uid));
    assert.deepEqual(r.state.loot.map((x) => x.uid), worn ? [worn.uid] : []);
  }));

  test('equip is legal only for a gear choice; without it the step is as before', () => gates(BOTH, () => {
    const { s } = atReward();
    const a = R.step(s, { type: 'CHOOSE_REWARD', index: 0 });
    const b = R.step(s, { type: 'CHOOSE_REWARD', index: 0, equip: false });
    assert.equal(R.serialize(a.state), R.serialize(b.state));
    const boon = copy(s);
    boon.node.rewards[0] = { kind: 'boons', boons: ['plenty', 'insight'] };
    assert.match(R.whyIllegal(boon, { type: 'CHOOSE_REWARD', index: 0, equip: true }), /only a gear item/);
    assert.equal(R.whyIllegal(boon, { type: 'CHOOSE_REWARD', index: 0 }), null);
  }));
});

// D162 (docs/handoffs/qa-2026-11-19c.md section 3): autoplay's quest gate, Legacy runs only. A seen quest whose level
// (node.cl) is more than AUTO_QUEST_LEVEL_SLACK over the power level scores S.risky, so the expedition policy does not
// enter it (the same as a risky elite); a level-60 run keeps rule 1.9.9 (every quest scores S.quest).
describe('D162: autoplay does not enter a Legacy quest more than AUTO_QUEST_LEVEL_SLACK over the power level', () => {
  const V2 = { legacy: true, oruvathLegacy: true, economyV2: true };
  /** Autoplay a Legacy run; per MOVE onto a seen, open quest: [power level, node.cl]. Also the quests it walked past. */
  const play = (classId, seed, H) => {
    const prof = R.debug.setHero({ ...R.newProfile(), runs: 2, guide: 'done', welcome: true }, classId, { level: H });
    let s = R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed, content: CONTENT, profile: prof, mapMode: 'expedition', prep: true });
    const entered = [];
    let skipped = 0;
    for (let n = 0; s.phase !== 'ENDED' && n < 30000; n++) {
      const a = R.autoAction(s);
      if (s.zone && !s.zone.camp && s.zone.nodes && s.phase === 'MAP') {
        const z = s.zone;
        if (a.type === 'MOVE' && z.nodes[a.nodeId].type === 'quest' && z.seen[a.nodeId] && !z.nodes[a.nodeId].done) entered.push([s.player.level, z.nodes[a.nodeId].cl]);
        for (const id of z.nodes[z.pos].nb) {
          const q = z.nodes[id];
          if (q.type === 'quest' && z.seen[id] && !q.done && s.player.level < q.cl - C.ENGINE_ASSUMPTION.AUTO_QUEST_LEVEL_SLACK) skipped++;
        }
      }
      s = R.step(s, a).state;
    }
    return { entered, skipped, s };
  };

  test('AUTO_QUEST_LEVEL_SLACK is 3; every quest entered is within it; the gate turns some down (hero 1 and 10, seeds 1-6)', () => gates(V2, () => {
    assert.equal(C.ENGINE_ASSUMPTION.AUTO_QUEST_LEVEL_SLACK, 3);
    let entered = 0;
    let skipped = 0;
    for (const classId of ['rogue', 'mage', 'hunter']) for (const H of [1, 10]) for (let seed = 1; seed <= 6; seed++) {
      const r = play(classId, seed, H);
      for (const [lv, cl] of r.entered) assert.ok(lv >= cl - 3, `${classId} hero ${H} seed ${seed}: quest ${cl} at power ${lv}`);
      entered += r.entered.length;
      skipped += r.skipped;
    }
    assert.ok(entered > 0 && skipped > 0, `entered ${entered}, turned down ${skipped}`);
  }));

  test('seed 7 at hero 1 (the browser case of qa-2026-11-19b): no class dies on a quest; each reaches the Camp', () => gates(V2, () => {
    for (const classId of ['rogue', 'mage', 'hunter']) {
      const { s } = play(classId, 7, 1);
      const out = s.result.summary.outcome;
      const d = out === 'death' ? s.death : null;
      assert.ok(out === 'victory' || (d && ['camp', 'boss'].includes(d.nodeType)), `${classId}: ${out} ${d && `${d.nodeType} in zone ${d.zone}`}`);
    }
  }));
});
