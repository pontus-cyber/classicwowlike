// QA API tests (docs/specs/engine-api.md 1 and 3): legalActions must list every legal action that changes
// the state. The visual client enables spells, items, map nodes and buttons from legalActions, so a legal
// action missing from the list is a control the player can never use. qa/engine/ checks the other direction
// (every listed action is legal).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT } from './helpers.mjs';
import { CONTENT as REAL } from '../../src/content/index.js';

const canon = (a) => JSON.stringify(Object.keys(a).sort().reduce((o, k) => { o[k] = a[k]; return o; }, {}));

/** Every action a player could try in this state, with all plausible parameters. */
function candidates(s) {
  const out = [];
  const push = (a) => out.push(a);
  for (const t of ['LEAVE_HUB', 'TRAVEL_ON', 'LEAVE', 'TRAIN_ALL', 'RESPEC', 'SELL_JUNK', 'NEXT_FIGHT', 'GRIND_STOP', 'DUNGEON_LEAVE', 'CAMP_GRIND', 'FIGHT_BOSS', 'END_RUN', 'START_RUN', 'FLEE', 'PASS']) push({ type: t });
  for (const sv of ['trainer', 'vendor', 'inn']) push({ type: 'SERVICE', service: sv });
  for (let l = 0; l < C.LANES; l++) push({ type: 'CHOOSE_NODE', lane: l });
  for (let n = 1; n <= C.GRIND_MAX_WAVES; n++) push({ type: 'GRIND_SET_WAVES', n });
  for (let i = 0; i < 4; i++) push({ type: 'CHOOSE_REWARD', index: i });
  push({ type: 'SET_AUTOPLAY', on: !s.autoplay });
  if (s.phase === 'CREATE') {
    for (const c of C.CLASS_IDS) push({ type: 'SELECT_CLASS', classId: c });
    for (const p of Object.keys(C.PET)) push({ type: 'SELECT_PET', petId: p });
    return out;
  }
  const p = s.player;
  for (const sp of Object.values(C.SPELL).filter((x) => x.cls === p.classId)) { push({ type: 'LEARN', spellId: sp.id }); push({ type: 'TRAIN', spellId: sp.id }); }
  if (s.service && s.service.stock) for (let i = 0; i <= s.service.stock.length; i++) push({ type: 'BUY', index: i });
  for (const it of p.bag) {
    push({ type: 'SELL', itemId: it.uid }); push({ type: 'EQUIP', itemId: it.uid }); push({ type: 'DISCARD', itemId: it.uid });
    if (it.kind === 'cons') push({ type: 'USE_ITEM', itemId: it.id });
  }
  for (const it of s.loot || []) { push({ type: 'EQUIP', itemId: it.uid }); push({ type: 'LOOT_TAKE', itemId: it.uid }); push({ type: 'LOOT_DROP', itemId: it.uid }); }
  for (const slot of C.SLOT_IDS) push({ type: 'UNEQUIP', slot });
  for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) push({ type: 'USE_ITEM', slot: i, target: null });
  for (let i = 0; i < C.SPELL_BAR_SLOTS; i++) { push({ type: 'SET_BAR', slot: i, spellId: null }); for (const id of Object.keys(p.spells)) push({ type: 'SET_BAR', slot: i, spellId: id }); }
  for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) { push({ type: 'SET_ITEM_BAR', slot: i, itemId: null }); for (const id of Object.keys(C.CONSUMABLE)) push({ type: 'SET_ITEM_BAR', slot: i, itemId: id }); }
  for (const t of Object.values(C.TALENT).filter((x) => x.cls === p.classId)) push({ type: 'SPEND_TALENT', talentId: t.id });
  if (s.fight) {
    for (const id of Object.keys(p.spells)) {
      if (C.SPELL[id].target === 'enemy') for (const e of s.fight.enemies) push({ type: 'CAST', spellId: id, target: e.idx });
      else push({ type: 'CAST', spellId: id, target: null });
    }
    for (const e of s.fight.enemies) push({ type: 'ATTACK', target: e.idx });
  }
  return out;
}

/** A legal action that leaves the state as it is (SET_BAR to the spell already there) need not be listed. */
const noOp = (s, a) => R.serialize(R.step(s, a).state) === R.serialize(s);

describe('engine API: legalActions', () => {
  test('every legal action that changes the state is in legalActions (fixture and real content, all classes)', () => {
    const missing = new Map();
    let checked = 0;
    for (const content of [CONTENT, REAL]) for (const cls of C.CLASS_IDS) for (let seed = 1; seed <= 4; seed++) {
      let s = R.newRun({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, content, mapMode: 'rows' });
      for (let n = 0; s.phase !== 'ENDED' && n < 4000; n++) {
        if (n % 4 === 0) {
          const listed = new Set(R.legalActions(s).map(canon));
          for (const a of candidates(s)) {
            if (!R.isLegal(s, a) || listed.has(canon(a))) continue;
            checked++;
            if (noOp(s, a)) continue;
            const k = `${s.phase}${s.fight ? ' (fight)' : ''}: ${canon(a)}`;
            missing.set(k, (missing.get(k) || 0) + 1);
          }
        }
        s = R.step(s, R.autoAction(s)).state;
      }
    }
    assert.deepEqual([...missing.keys()].slice(0, 10), [], `${missing.size} legal actions missing from legalActions (${checked} unlisted legal candidates checked)`);
  });

  test('CAST actions in legalActions carry an enemy index for enemy spells and null for self and area spells', () => {
    let s = R.newRun({ classId: 'mage', seed: 3, content: CONTENT, mapMode: 'rows' });
    s = R.step(s, { type: 'START_RUN' }).state;
    for (let n = 0; n < 400 && !s.fight; n++) s = R.step(s, R.autoAction(s)).state;
    assert.ok(s.fight, 'a fight');
    const listed = R.legalActions(s).filter((a) => a.type === 'CAST');
    for (const a of listed) {
      if (C.SPELL[a.spellId].target === 'enemy') assert.equal(typeof a.target, 'number');
      else assert.equal(a.target, null);
    }
  });
});
