// onebutton bot (sim/bots/onebutton.mjs; owner feedback 2026-11-11 18:41, report docs/reports/mash-2026-11-11.md): in
// fights it uses only the slot-1 spell, the basic attack, healing items (none with variant nopot), the strike engage
// option and PASS, always on the default target; it never reads intents or the track; it spends talents on the slot-1
// tree's slot-1 talents first. The think replays (sim/lib/replay.mjs replayThink, replayMash) reproduce the live fight
// with the bot's own policy, and the recorder's fc is aligned with fx.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, TALENT, newRunFor } from '../../sim/lib/engine.mjs';
import { buildProfile } from '../../sim/lib/profiles.mjs';
import { createBot } from '../../sim/bots/index.mjs';
import { oneButtonChoice, slot1Spell, slot1Tree, SLOT1_TALENTS } from '../../sim/bots/onebutton.mjs';
import { engageKind } from '../../sim/lib/view.mjs';
import { runWithBot } from '../../sim/lib/runner.mjs';
import { OUTCOME, snapshot, replayFight } from '../../sim/lib/replay.mjs';
import { mashChoice } from '../../sim/bots/masher.mjs';
import { FIGHT_KINDS } from '../../sim/lib/recorder.mjs';

const CLASSES = ['rogue', 'mage', 'hunter'];
const key = (a) => JSON.stringify(a, Object.keys(a).sort());
const isHeal = (s, a) => a.type === 'USE_ITEM' && !!C.CONSUMABLE[s.player.itemBar[a.slot]] && !!C.CONSUMABLE[s.player.itemBar[a.slot]].heal;

/** Play a onebutton run; call visit(state, action) at every decision in a fight and spend(state, talentId) at every
 *  talent point. Returns the final state. */
function playOneButton(cls, seed, { variant = null, map = null, visit = null, spend = null, maxSteps = 8000 } = {}) {
  const bot = createBot('onebutton', { classId: cls, seed, variant });
  const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, profile: buildProfile('fresh', cls), mapMode: map, prep: map === 'expedition' });
  for (let n = 0; n < maxSteps && s.phase !== 'ENDED'; n++) {
    const a = bot.choose(s);
    if (s.fight && visit) visit(s, a);
    if (a.type === 'SPEND_TALENT' && spend) spend(s, a.talentId);
    R.stepInPlace(s, a);
  }
  return s;
}

describe('onebutton (mash report): slot 1, basic attack, potions', () => {
  test('in fights only the slot-1 spell, the basic attack, healing items, the strike engage and PASS, on the default target', () => {
    for (const cls of CLASSES) {
      const seen = { CAST: 0, ATTACK: 0, USE_ITEM: 0, ENGAGE: 0, PASS: 0 };
      for (const [seed, map] of [[41, null], [42, null], [43, 'expedition']]) {
        playOneButton(cls, seed, {
          map,
          visit: (s, a) => {
            assert.ok(a.type in seen, `${cls}: ${a.type} is not a one-button action`);
            seen[a.type]++;
            assert.ok(R.isLegal(s, a), `${cls}: illegal ${JSON.stringify(a)}`);
            if (a.type === 'CAST') assert.equal(a.spellId, slot1Spell(cls));
            if (a.type === 'USE_ITEM') assert.ok(isHeal(s, a), `${cls}: item ${s.player.itemBar[a.slot]} is not a healing item`);
            if (a.type === 'ENGAGE') {
              assert.equal(engageKind(a.option), 'strike', `${cls}: engage ${a.option}`);
              if (a.spellId) assert.equal(a.spellId, slot1Spell(cls));
            }
            if (a.type === 'PASS') assert.ok(s.fight.p.skip || !R.isLegal(s, { type: 'ATTACK', target: R.defaultTarget(s) }), `${cls}: PASS while it could attack`);
            if (typeof a.target === 'number') assert.equal(a.target, R.defaultTarget(s), `${cls}: ${a.type} not on the default target`);
            if (a.type === 'ATTACK') assert.ok(!R.isLegal(s, { type: 'CAST', spellId: slot1Spell(cls), target: R.defaultTarget(s) }), `${cls}: basic attack while slot 1 was usable`);
          },
        });
      }
      assert.ok(seen.CAST > 50 && seen.ENGAGE > 5, `${cls}: ${JSON.stringify(seen)}`);
    }
  });

  test('the slot-1 spell is the first start spell and is always on the bar in fights', () => {
    assert.deepEqual(CLASSES.map(slot1Spell), ['gutting_jab', 'ember_bolt', 'keen_shot']);
    for (const cls of CLASSES) playOneButton(cls, 44, { maxSteps: 3000, visit: (s) => assert.ok(s.player.bar.includes(slot1Spell(cls)), `${cls}: slot-1 spell off the bar`) });
  });

  test('variant nopot never uses an item in a fight', () => {
    for (const cls of CLASSES) {
      let items = 0;
      playOneButton(cls, 45, { variant: 'nopot', visit: (s, a) => { if (a.type === 'USE_ITEM') items++; } });
      assert.equal(items, 0, cls);
    }
  });
});

describe('onebutton: never reads intents or the track', () => {
  test('the same choice with every intent and track entry scrambled (two ways)', () => {
    let checked = 0;
    const scrambles = [
      { id: 'heavy_smash', name: 'Heavy Smash', kind: 'hit', cast: true, heavy: true, windup: true, school: 'phys', cd: 3, pct: 3, hits: 1, target: 'player', est: 9999 },
      { id: 'strike', name: 'Strike', kind: 'hit', cast: false, heavy: false, school: 'phys', cd: 0, pct: 1, hits: 1, target: 'pet', est: 0 },
    ];
    for (const cls of CLASSES) {
      const states = [];
      playOneButton(cls, 46, { maxSteps: 4000, visit: (s) => { if (states.length < 12 && !s.fight.p.skip && s.fight.round <= 4) states.push(R.deserialize(R.serialize(s), s.content)); } });
      for (const s of states) {
        const a = oneButtonChoice(s);
        for (const sc of scrambles) {
          const c = R.deserialize(R.serialize(s), s.content);
          for (const e of c.fight.enemies) {
            e.intent = { ...sc };
            if (Array.isArray(e.track)) e.track = e.track.map((x) => ({ ...x, ...sc }));
          }
          assert.equal(key(oneButtonChoice(c)), key(a), `${cls}: onebutton read an intent`);
          checked++;
        }
      }
    }
    assert.ok(checked >= 60, `checked ${checked}`);
  });
});

describe('onebutton: talents of the slot-1 spell', () => {
  test('slot-1 trees are Bladework, Pyromancy, Marksmanship (autopilot ENGINE_ASSUMPTION.AUTO_TREE); the talents are the class\'s', () => {
    assert.deepEqual(CLASSES.map(slot1Tree), [0, 0, 1]);
    assert.deepEqual(CLASSES.map(slot1Tree), CLASSES.map((c) => C.ENGINE_ASSUMPTION.AUTO_TREE[c]));
    for (const cls of CLASSES) for (const id of SLOT1_TALENTS[cls]) assert.equal(TALENT[id].cls, cls, id);
  });

  test('a slot-1 talent of the slot-1 tree is spent whenever one is legal', () => {
    for (const cls of CLASSES) {
      const tree = slot1Tree(cls);
      const mine = SLOT1_TALENTS[cls].filter((id) => TALENT[id].tree === tree);
      let spent = 0;
      for (let seed = 47; seed < 57 && spent < 6; seed++) {
        playOneButton(cls, seed, {
          spend: (s, id) => {
            spent++;
            const legalMine = mine.filter((x) => R.isLegal(s, { type: 'SPEND_TALENT', talentId: x }));
            if (legalMine.length) assert.ok(legalMine.includes(id), `${cls}: spent ${id} while ${legalMine.join(', ')} was legal`);
          },
        });
      }
      assert.ok(spent >= 6, `${cls}: ${spent} talent points`);
    }
  });
});

describe('think replays and the fc record', () => {
  test('a replay never changes the live state, on the classic map and the expedition (fightClone copies exp and the zone graph)', () => {
    let checked = 0;
    for (const map of [null, 'expedition']) {
      for (const seed of [1001, 1002, 1003, 1004, 1005]) {
        const s = newRunFor({ classId: 'mage', seed, mapMode: map, prep: map === 'expedition', profile: buildProfile('fresh', 'mage') });
        const bot = createBot('onebutton', { classId: 'mage', seed });
        for (let n = 0; n < 8000 && s.phase !== 'ENDED'; n++) {
          if (s.fight && s.fight.round === 1 && s.fight.kind !== 'boss' && !s.fight.acted) {
            const before = JSON.stringify(R.serialize(s));
            replayFight(snapshot(s), mashChoice, mashChoice);
            assert.equal(JSON.stringify(R.serialize(s)), before, `${map || 'classic'} seed ${seed}: a replay changed the live state`);
            checked++;
          }
          R.stepInPlace(s, bot.choose(s));
        }
      }
    }
    assert.ok(checked >= 20, `checked ${checked}`);
  });

  test('the own-policy replay reproduces each live fight; fc is aligned with fx', () => {
    for (const cls of CLASSES) {
      const { record } = runWithBot({ bot: 'onebutton', cls, prof: 'fresh', tree: slot1Tree(cls), style: null, variant: null, pet: null, think: true, thinkMash: true }, 48, null);
      assert.equal(record.err, null, `${cls}: ${record.err}`);
      assert.equal(record.fc.length, record.fx.length);
      const nonBoss = record.fx.map((f, i) => [f, i]).filter(([f]) => FIGHT_KINDS[f[0]] !== 'boss').map(([, i]) => i);
      assert.deepEqual(record.tk.map((t) => t[0]), nonBoss, `${cls}: one think entry per non-boss fight`);
      assert.deepEqual(record.tm.map((t) => t.slice(0, 7)), record.tk.map((t) => t.slice(0, 7)), `${cls}: replayMash's own replay = replayThink's`);
      let prevNode = 0;
      for (let i = 0; i < record.fx.length; i++) {
        const [hp0, nodeN, comp] = record.fc[i];
        assert.ok(hp0 >= 0 && hp0 <= 100 && nodeN >= prevNode, `${cls} fight ${i}`);
        prevNode = nodeN;
        for (const x of comp ? comp.split(',') : []) {
          const [tid, k] = x.split(':');
          assert.ok(tid === 'boss' || CONTENT.enemies[tid], `${cls}: unknown template ${tid}`);
          assert.ok(['n', 't', 'e', 'r', 'd', 's', 'b'].includes(k), `${cls}: kind ${k}`);
        }
      }
      for (const t of record.tk) {
        const fx = record.fx[t[0]];
        assert.equal(t[1], fx[0], 'fight kind');
        assert.equal(t[3], fx[2], `${cls} fight ${t[0]}: own replay outcome = live outcome`);
        if (fx[2] === OUTCOME.victory) assert.ok(Math.abs(t[4] / 10 - fx[3]) <= 0.6, `${cls}: end HP ${t[4] / 10} vs ${fx[3]} %`);
        assert.equal(t[5], fx[6], `${cls}: potions`);
        assert.ok(Math.abs(t[2] / 10 - record.fc[t[0]][0]) <= 0.6, `${cls}: start HP`);
      }
    }
  });
});
