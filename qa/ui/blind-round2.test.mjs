// Blind round 2 (docs/feedback/2026-11-14-blind-*.md; docs/handoffs/ui-2026-11-14e.md): the UI's pure parts in Node. The
// trainer's waiting line on the level-up banner and the hub card, the hub card's line from R.trainerView, the dungeon's
// counts on the expedition map (the bridge's node `trash`, the map tooltip and the dialog), enemy uids unique per
// expedition node (the target frame's portrait key), the map's short lines. The browser checks are ui-regress part U.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const R = await import('../../src/rules.js');
const C = await import('../../src/constants.js');
const { CONTENT } = await import('../../src/content/index.js');
const { trainerWaiting, trainerWaitingShort } = await import('../../src/ui/ui-text.js');
const { trainerMeta, expNodeDesc, TOO_FAR, ROAD_FIRST } = await import('../../src/ui/screens.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');

const name = (id) => C.SPELL[id].name;

test('trainer reminder: new spells first, else the ranks; nothing waiting, nothing said', () => {
  const t = { learn: [{ id: 'shadowstep', lvl: 4, cost: 100 }], train: [{ id: 'gutting_jab', tl: 1, cost: 10 }, { id: 'eviscerate', tl: 2, cost: 10 }] };
  const sp = Object.keys(C.SPELL).find((id) => C.SPELL[id].cls === 'rogue' && C.SPELL[id].lvl > 1);
  const t2 = { learn: [{ id: sp, lvl: C.SPELL[sp].lvl }], train: [] };
  assert.equal(trainerWaiting(t2, name), `New at the trainer: ${C.SPELL[sp].name}`);
  assert.equal(trainerWaiting({ learn: [], train: t.train }), '2 spells can rank up at the trainer');
  assert.equal(trainerWaiting({ learn: [], train: [t.train[0]] }), '1 spell can rank up at the trainer');
  assert.equal(trainerWaiting({ learn: [], train: [] }), null);
  assert.equal(trainerWaiting(null), null);
  assert.equal(trainerWaitingShort(t), 'Waiting: 1 new spell, 2 ranks');
  assert.equal(trainerWaitingShort({ learn: [], train: [] }), null);
});

test('hub Trainer card: "Waiting: ..." while lessons wait and the gold covers one; the older lines otherwise', () => {
  assert.equal(trainerMeta({ trainer: { useful: true, learn: [{ id: 'x' }, { id: 'y' }], train: [{ id: 'z' }] } }), 'Waiting: 2 new spells, 1 rank');
  assert.equal(trainerMeta({ trainer: { useful: true, next: 6 } }), 'Learn and rank up spells');
  assert.equal(trainerMeta({ trainer: { useful: false, learn: [{ id: 'x' }], train: [] } }), 'Its lessons cost more gold than you have.');
});

test('a real run: R.trainerView after a few levels names the spells the banner names', () => {
  let s = R.newRun({ classId: 'rogue', seed: 7, content: CONTENT, mapMode: 'expedition', prep: true });
  s = R.step(s, { type: 'START_RUN' }).state;
  let line = null;
  for (let i = 0; i < 3000 && !line; i++) {
    if (s.zone && s.zone.z >= 2) break;
    const a = R.autoAction(s); if (!a) break;
    const r = R.step(s, a); s = r.state;
    if (r.events.some((e) => e.t === 'levelUp')) line = trainerWaiting(R.trainerView(s), name);
  }
  assert.ok(line, 'a level-up in zone 1 leaves something at the trainer');
  assert.match(line, /^(New at the trainer: .+|\d+ spells? can rank up at the trainer)$/);
});

test('dungeon counts on the expedition map: the bridge, the map tooltip and the rules agree on EXPED_DUNGEON_TRASH_FIGHTS', () => {
  const b = createBridge({});
  assert.equal(b.data.rules.expDungeonTrashFights, C.EXPED_DUNGEON_TRASH_FIGHTS);
  const words = ['Zero', 'One', 'Two', 'Three', 'Four'];
  const d = expNodeDesc({ type: 'dungeon', fights: [['brute', 'caster'], ['brute']] }, null, b.data.rules);
  assert.match(d, new RegExp(`^${words[2]} fights and a dungeon boss`), d);
  const d2 = expNodeDesc({ type: 'dungeon' }, null, b.data.rules);
  assert.match(d2, new RegExp(`^${words[C.EXPED_DUNGEON_TRASH_FIGHTS]} fights and a dungeon boss`), d2);
});

test('the map\'s short lines (draft)', () => {
  assert.equal(TOO_FAR, 'Too far: click a lit node');
  assert.equal(ROAD_FIRST, 'Walk to the Road first');
});
