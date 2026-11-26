// Legacy bugs of the blind returning-player check (docs/feedback/2026-11-19-blind-legacy-returning.md, "Wrong or confusing"),
// the UI's pure parts in Node: the bridge sends CHOOSE_REWARD with `equip` (the reward is worn before a Dimmed encounter);
// "You abandon the run." is a quiet line (the log, no toast); the summary's Furnace block carries the Dimmed encounters
// (dimFights); a Cull contract's site line says that only the marked nodes count. The browser checks are ui-regress part Z.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem0 = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem0.has(k) ? mem0.get(k) : null), setItem: (k, v) => { mem0.set(k, String(v)); }, removeItem: (k) => { mem0.delete(k); } };
const KEYS = ['tbwcr.profile.v1', 'tbwcr.profile.v3', 'tbwcr.history.v1', 'tbwcr.history.v3', 'tbwcr.legacy.refund.v1'];
const clear = () => { for (const k of KEYS) globalThis.localStorage.removeItem(k); };
const R = await import('../../src/rules.js');
const C = R.C;
const { CONTENT } = await import('../../src/content/index.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const { contractSitesText } = await import('../../src/ui/ui-text.js');
const { dimAt } = await import('../../src/engine/expedition.js');

const gateOff = () => { C.GATES.legacy = false; C.GATES.oruvathLegacy = false; };
const nodeOf = (b) => R.deserialize(b.backend.serialized(), CONTENT);

test('a Cull contract\'s line says where to go and exactly which places count (s0133: ordinary fights in the region never counted)', () => {
  const r = { vision: 1, guide: 1, tracker: 2, bountyPlaced: 2 };
  const t = contractSitesText({ kind: 'cull', regionName: 'Barleyreach Verge' }, r);
  // R2-6 (draft): plain sentences: where to go, then what counts, then how far the marks show
  assert.match(t, /^Go to Barleyreach Verge\. Only the marked Quest and Grind places count; other fights do not\. Its marks show on the map up to 1 step away\.$/);
  assert.match(contractSitesText({ kind: 'bounty', name: 'Grosk', regionName: 'Harrow Lane' }, r), /^Go to Harrow Lane\. Grosk stands at two marked Elite places there\. Beat it at either one\./);
  assert.match(contractSitesText({ kind: 'delve', dungeon: 'The Sunken Vault' }, r), /^Go to The Sunken Vault\. It shows on the zone map while you hold this contract\.$/);
  assert.doesNotMatch(t, /\b(node|site)s?\b/i, 'one word for a place on the map')
});

test('Equip now on a reward: the bridge sends CHOOSE_REWARD with equip; on a dimmed node the item is worn as the encounter starts', () => {
  clear();
  try {
    const b = createBridge({ seed: 7, legacy: true });
    b.dispatch({ type: 'SET_GUIDE', on: false });
    b.dispatch({ type: 'START_RUN' });
    let s = nodeOf(b);
    for (let i = 0; i < 3000 && !(s.node && s.node.stage === 'reward' && s.node.type === 'quest' && s.node.rewards[0].kind === 'items'); i++) {
      const r = b.dispatch({ type: 'AUTO' }); if (!r.ok) break; s = nodeOf(b);
    }
    assert.ok(s.node && s.node.stage === 'reward', 'a quest reward');
    // the quest node has dimmed: the choice starts a Dimmed encounter at once
    s.zone.start = s.time - dimAt(s.zone, s.zone.pos) - 1;
    b.backend.testLoad(R.serialize(s));
    const it = s.node.rewards[0].items[0];
    const r = b.dispatch({ type: 'CHOOSE_REWARD', i: 0, equip: true });
    assert.ok(r.ok);
    const log = b.backend.engineLog();
    assert.deepEqual(log[log.length - 1], { type: 'CHOOSE_REWARD', index: 0, equip: true });
    const after = nodeOf(b);
    assert.equal(after.player.equipped[it.slot].uid, it.uid, 'worn');
    assert.ok(after.fight, 'the Dimmed encounter is on');
    assert.equal(b.view.player.equip[it.slot].uid, it.uid);
  } finally { gateOff(); }
});

test('Abandon run: "You abandon the run." is a quiet line; the summary is an abandoned death; the Furnace block has dimFights', () => {
  clear();
  try {
    const b = createBridge({ seed: 11, legacy: true });
    b.dispatch({ type: 'SET_GUIDE', on: false });
    b.dispatch({ type: 'START_RUN' });
    for (let i = 0; i < 60 && b.view.phase !== 'MAP'; i++) b.dispatch({ type: 'AUTO' });
    const r = b.dispatch({ type: 'ABANDON_RUN' });
    const msg = r.events.find((e) => e.t === 'msg' && /abandon/.test(e.text));
    assert.deepEqual(msg, { t: 'msg', text: 'You abandon the run.', kind: 'info', quiet: true });
    const sm = b.view.summary;
    assert.equal(b.view.phase, 'SUMMARY');
    assert.equal(sm.death.abandoned, true);
    assert.equal(sm.fights, 0, 'no fight: the summary shows no time estimate');
    const want = R.summary(nodeOf(b)).expedition.dimFights;
    assert.equal(sm.heat.dimFights, want);
  } finally { gateOff(); }
});
