// Blind Legacy v2 (docs/feedback/2026-11-20-blind-legacy-returning-v2.md; BACKLOG 2026-11-20 "hall" and "bags and loot"),
// the UI's pure parts in Node, ?legacy=1 (legacy, oruvathLegacy, economyV2 on). Hall: a Lost Technique's learn level on the
// card face (meta.js cardReq); the run end's "Next in the hall" names an entry the balance buys, else the cheapest with
// "N more points" (the bridge's nextHall, screens.js hallCost), and "N unlocks within reach" always holds it. The browser
// checks are ui-regress part AA.
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
const { setDisplay } = await import('../../src/ui/util.js');
const { econLine } = await import('../../src/ui/ui-text.js');
const { cardReq } = await import('../../src/ui/meta.js');
const { hallCost } = await import('../../src/ui/screens.js');

const gatesOn = () => { C.GATES.legacy = true; C.GATES.oruvathLegacy = true; C.GATES.economyV2 = true; };
const done = () => { C.GATES.legacy = false; C.GATES.oruvathLegacy = false; C.GATES.economyV2 = false; setDisplay({}); clear(); };

/** A stored version 3 profile (hero `cls` at level 3) with `bought` and `bal` Legacy points. */
function store(cls, bought, bal) {
  gatesOn();
  let p = { ...R.newProfile(), runs: 3, guide: 'done', welcome: true, legacy: 2000 };
  for (const id of bought) p = R.buyMeta(p, id);
  p.legacy = bal;
  p = R.debug.setHero(p, cls, { level: 3, xp: 0 });
  globalThis.localStorage.setItem('tbwcr.profile.v3', JSON.stringify(p));
}
/** The run summary of an abandoned run of `cls` (past the start camp): view.meta.after (the bridge's dry END_RUN). */
function summaryOf(cls, seed = 5) {
  const b = createBridge({ seed, legacy: true });
  b.dispatch({ type: 'SELECT_CLASS', classId: cls });
  b.dispatch({ type: 'SET_GUIDE', on: false });
  b.dispatch({ type: 'START_RUN' });
  for (let i = 0; i < 20 && b.view.phase === 'PREP'; i++) b.dispatch({ type: 'AUTO' });
  assert.ok(b.dispatch({ type: 'ABANDON_RUN' }).ok);
  assert.equal(b.view.phase, 'SUMMARY');
  return b.view.meta.after;
}
const line = (after) => econLine(CONTENT.texts, 'run_balance', { legacy: after.echoes, next: after.nextHall.name, cost: hallCost(after.nextHall) });

test('hall: a Lost Technique card names its learn level on the hero scale ("From hero level 9", s0564); other entries none', () => {
  clear();
  try {
    gatesOn();
    const b = createBridge({ seed: 3, legacy: true });
    const D = b.data.meta;
    assert.equal(cardReq(D.entries.sp_h1, b.data), `From hero level ${R.learnLevel({ legacy: true }, 'ricochet_bolt')}`);
    assert.equal(cardReq(D.entries.sp_h1, b.data), 'From hero level 9');
    assert.equal(cardReq(D.entries.sp_r2, b.data), `From hero level ${R.learnLevel({ legacy: true }, C.META.sp_r2.spell)}`);
    for (const id of ['satchel', 'vigor', 'pockets', 'cartographer', 'stormhawk', 'second_breath']) assert.equal(cardReq(D.entries[id], b.data), null, id);
  } finally { done(); }
});

test('hall: outside Legacy the card reads the engine level ("From level 20")', () => {
  clear(); done();
  const b = createBridge({ seed: 3 });
  assert.equal(cardReq(b.data.meta.entries.sp_h1, b.data), `From level ${C.SPELL.ricochet_bolt.lvl}`);
});

test('next in the hall: with 63 points (Satchel and Pockets owned) it names Cartographer 60, the one unlock within reach (s0561)', () => {
  clear();
  try {
    store('hunter', ['satchel', 'pockets'], 63);
    const after = summaryOf('hunter');
    assert.equal(after.echoes, 63);
    assert.equal(after.affordable, 1, 'one unlock within reach');
    assert.deepEqual(after.nextHall, { id: 'cartographer', name: 'Cartographer', cost: 60, short: 0 });
    assert.equal(line(after), 'You have 63 Legacy points. Next in the hall: Cartographer, 60.');
  } finally { done(); }
});

test('next in the hall: with 8 points it names the cheapest entry and how far off it is (s0596)', () => {
  clear();
  try {
    store('hunter', ['satchel', 'pockets'], 8);
    const after = summaryOf('hunter');
    assert.equal(after.affordable, 0);
    assert.deepEqual(after.nextHall, { id: 'cartographer', name: 'Cartographer', cost: 60, short: 52 });
    assert.equal(line(after), 'You have 8 Legacy points. Next in the hall: Cartographer, 60 (52 more points).');
  } finally { done(); }
});

test('next in the hall: with enough points, the first entry of the buying order that the balance buys', () => {
  clear();
  try {
    store('rogue', ['satchel', 'pockets'], 300);
    const after = summaryOf('rogue');
    assert.deepEqual(after.nextHall, { id: 'vigor', name: 'Vigor of the Line I', cost: 70, short: 0 });
    store('rogue', ['satchel', 'pockets', 'vigor', 'edge', 'quick_study'], 125);
    const a2 = summaryOf('rogue');
    // Lost Technique I (120) is next in the order and the balance buys it
    assert.equal(a2.nextHall.id, 'sp_r1');
    assert.equal(a2.nextHall.short, 0);
  } finally { done(); }
});

test('next in the hall: "N unlocks within reach" and the named entry agree for every balance from 0 to 260', () => {
  clear();
  try {
    for (let bal = 0; bal <= 260; bal += 13) {
      for (const [cls, bought] of [['hunter', ['satchel', 'pockets']], ['mage', []], ['rogue', ['satchel', 'vigor', 'cartographer']]]) {
        store(cls, bought, bal);
        const after = summaryOf(cls);
        const n = after.nextHall;
        assert.ok(n, `${cls} ${bal}`);
        if (after.affordable > 0) assert.equal(n.short, 0, `${cls} ${bal}: within reach, so the named entry is affordable: ${JSON.stringify(n)}`);
        else assert.equal(n.short, n.cost - after.echoes, `${cls} ${bal}: ${JSON.stringify(n)}`);
        assert.ok(n.short === 0 ? n.cost <= after.echoes : n.cost > after.echoes);
      }
    }
  } finally { done(); }
});

// ------------------------------------------------------------------ bags and loot
const { upgradeInfo } = await import('../../src/ui/engine-bridge.js');
const { trackNewItems } = await import('../../src/ui/hud.js');
const { BAGS_FULL } = await import('../../src/ui/ui-text.js');
const nodeOf = (b) => R.deserialize(b.backend.serialized(), CONTENT);
const junk = (k) => ({ uid: `t-junk-${k}`, kind: 'junk', id: 'junk', name: 'Bent Nail', qty: 1, level: 1, value: 1 });
/** The state with its bags filled with junk up to `free` free slots. */
const fill = (s, free = 0) => { const cap = R.bagCapacity(s); for (let k = 0; s.player.bag.length < cap - free; k++) s.player.bag.push(junk(k)); return s; };
/** A Legacy Rogue run (seed) on autoplay up to a quest's item choice; null if none comes. */
function toQuestReward(seed) {
  store('rogue', ['satchel'], 0);
  const b = createBridge({ seed, legacy: true });
  b.dispatch({ type: 'SET_GUIDE', on: false });
  b.dispatch({ type: 'START_RUN' });
  let s = nodeOf(b);
  for (let i = 0; i < 3000 && !(s.node && s.node.stage === 'reward' && s.node.type === 'quest' && s.node.rewards[0].kind === 'items' && Object.values(s.player.equipped).filter(Boolean).length > 2); i++) {
    const r = b.dispatch({ type: 'AUTO' }); if (!r.ok || b.view.phase === 'SUMMARY') return null; s = nodeOf(b);
  }
  return s.node && s.node.stage === 'reward' ? b : null;
}

test('Equip now on a quest reward with full bags: the reward is worn, the replaced piece is left behind, no "Items waiting" window (s0318)', () => {
  clear();
  try {
    let b = null; for (const seed of [7, 11, 13, 21]) { b = toQuestReward(seed); if (b) break; }
    assert.ok(b, 'a quest reward');
    const s = fill(nodeOf(b));
    const items = s.node.rewards[0].items;
    let i = items.findIndex((it) => it.kind === 'gear' && s.player.equipped[it.slot]);
    assert.ok(i >= 0, 'a reward for a worn slot');
    const it = items[i]; const old = s.player.equipped[it.slot];
    b.testLoad(R.serialize(s));
    assert.ok(b.view.player.bag.every(Boolean), 'bags full');
    const r = b.dispatch({ type: 'CHOOSE_REWARD', i, equip: true });
    assert.ok(r.ok);
    const after = nodeOf(b);
    assert.equal(after.player.equipped[it.slot].uid, it.uid, 'the reward is worn');
    assert.ok(!(after.loot || []).some((x) => x.uid === old.uid), 'the replaced piece is not in the loot window');
    assert.ok(!(b.view.loot && b.view.loot.title === 'Items waiting'), `no Items waiting window: ${JSON.stringify(b.view.loot && b.view.loot.title)}`);
    const msg = r.events.find((e) => e.t === 'msg' && e.replaced === old.uid);
    assert.ok(msg && msg.text === `Your old ${old.name} is left behind (no room in your bags).`, JSON.stringify(msg));
    const log = b.backend.engineLog();
    assert.deepEqual(log.slice(-2), [{ type: 'CHOOSE_REWARD', index: i, equip: true }, { type: 'LOOT_DROP', itemId: old.uid }]);
  } finally { done(); }
});

test('a reward chosen without Equip now with full bags still waits in the loot window (the player decides)', () => {
  clear();
  try {
    let b = null; for (const seed of [7, 11, 13, 21]) { b = toQuestReward(seed); if (b) break; }
    const s = fill(nodeOf(b));
    const it = s.node.rewards[0].items[0];
    b.testLoad(R.serialize(s));
    assert.ok(b.dispatch({ type: 'CHOOSE_REWARD', i: 0 }).ok);
    assert.ok(b.view.loot && b.view.loot.items.some((x) => x.uid === it.uid && x.pending), JSON.stringify(b.view.loot && b.view.loot.title));
    // and a Take the bags cannot hold says the one full-bags sentence
    const r = b.dispatch({ type: 'LOOT_TAKE', i: b.view.loot.items.findIndex((x) => x.uid === it.uid) });
    assert.equal(r.ok, false);
    assert.equal(r.error, BAGS_FULL);
  } finally { done(); }
});

test('the full-bags sentence is the draft line', () => {
  assert.equal(BAGS_FULL, 'Your bags are full: equip, sell or discard something (B).');
});

test('upgrade arrow: another class\'s main stat is never an upgrade (s0502: an Intellect codex for a Hunter); the class\'s own is', () => {
  const score = (x) => (x ? (x.stats.agi || 0) + (x.stats.int || 0) + (x.stats.sta || 0) * 0.6 + (x.stats.armor || 0) * 0.02 : 0);
  const g = (uid, stats, slot = 'offhand') => ({ uid, kind: 'gear', slot, stats: { sta: 0, agi: 0, int: 0, spi: 0, power: 0, crit: 0, armor: 0, wd: 0, ...stats } });
  const codex = g('c', { int: 2, sta: 1 });
  assert.deepEqual(upgradeInfo(codex, null, 'agi', score), { up: false, diff: score(codex), empty: true, off: true }, 'Hunter, empty off-hand');
  assert.equal(upgradeInfo(codex, g('w', { agi: 1 }), 'agi', score).up, false, 'Hunter, a weaker piece worn');
  assert.equal(upgradeInfo(codex, null, 'int', score).up, true, 'Mage: the same codex is an upgrade');
  assert.equal(upgradeInfo(g('a', { agi: 3 }), null, 'int', score).off, true, 'Mage: Agility is off');
  assert.equal(upgradeInfo(g('a', { agi: 3 }), g('w', { agi: 1 }), 'agi', score).up, true, 'Rogue: more Agility');
  assert.equal(upgradeInfo(g('b', { agi: 2, int: 2 }), null, 'agi', score).off, false, 'both main stats: not off');
  assert.equal(upgradeInfo(g('s', { sta: 4 }), null, 'agi', score).up, true, 'Stamina only: not off');
  assert.equal(upgradeInfo(g('w', { agi: 3 }), g('w', { agi: 3 }), 'agi', score).up, false, 'the worn piece itself');
  assert.equal(upgradeInfo({ uid: 'p', kind: 'consumable' }, null, 'agi', score).up, false);
});

test('upgrade arrow in the bridge: every gear item of a Legacy Hunter run with another class\'s main stat and none of its own reads off', () => {
  clear();
  try {
    store('hunter', [], 0);
    const b = createBridge({ seed: 9, legacy: true });
    b.dispatch({ type: 'SELECT_CLASS', classId: 'hunter' });
    b.dispatch({ type: 'SET_GUIDE', on: false });
    b.dispatch({ type: 'START_RUN' });
    let seen = 0; let offSeen = 0;
    for (let i = 0; i < 1500 && b.view.phase !== 'SUMMARY'; i++) {
      const r = b.dispatch({ type: 'AUTO' }); if (!r.ok) break;
      const p = b.view.player; if (!p) continue;
      for (const it of [...p.bag, ...((b.view.loot && b.view.loot.items) || []), ...((b.view.loot && b.view.loot.choices) || [])]) {
        if (!it || it.kind !== 'gear') continue;
        const u = b.upgrade(it); seen++;
        const off = it.stats.int > 0 && !(it.stats.agi > 0);
        assert.equal(u.off, off, JSON.stringify(it.stats));
        if (off) { offSeen++; assert.equal(u.up, false); }
      }
    }
    assert.ok(seen > 20, `gear seen ${seen}`);
    assert.ok(offSeen > 0, 'an Intellect item met');
  } finally { done(); }
});

test('bag badge: "+N items" counts only new items still in the bags, never more than the bags hold (s0313, s0511)', () => {
  const set = new Set();
  const bag = Array.from({ length: 20 }, (_, i) => ({ uid: `b${i}` }));
  assert.equal(trackNewItems(set, bag.slice(0, 12).map((x) => x.uid), bag), 12);
  // 12 more come in while 8 of the first are sold: the bags hold 20
  const after = [...bag.slice(8), ...Array.from({ length: 8 }, (_, i) => ({ uid: `n${i}` }))];
  assert.equal(trackNewItems(set, [...after.slice(12).map((x) => x.uid), 'n0', 'gone'], after), 4 + 8);
  assert.ok(set.size <= after.length);
  assert.equal(trackNewItems(set, [], after.slice(0, 5)), 4, 'equipped or discarded items leave the count');
  assert.equal(trackNewItems(set, 0), 0, 'opening the bags clears it');
});

test('Leave asks for exactly the items it leaves: the count in the spoils window = the items LOOT_CLOSE drops (s0478)', () => {
  clear();
  try {
    store('rogue', ['satchel'], 0);
    const b = createBridge({ seed: 11, legacy: true });
    b.dispatch({ type: 'SET_GUIDE', on: false });
    b.dispatch({ type: 'START_RUN' });
    let met = 0;
    for (let i = 0; i < 4000 && b.view.phase !== 'SUMMARY' && met < 3; i++) {
      // one free slot on the map: the next spoils fill the bags and the rest waits in the loot window
      if (b.view.phase === 'MAP' && !b.view.loot) { const s = nodeOf(b); if (R.bagCapacity(s) - s.player.bag.length !== 1) { s.player.bag = s.player.bag.filter((x) => x.kind !== 'junk' || !String(x.uid).startsWith('t-junk')); b.testLoad(R.serialize(fill(s, 1))); } }
      const L = b.view.loot;
      if (L && L.kind === 'loot' && L.items.some((x) => x.pending) && L.items.some((x) => x.inBag)) {
        const waiting = L.items.filter((x) => x.pending).reduce((a, x) => a + (x.uids ? x.uids.length : 1), 0);
        const s = nodeOf(b);
        assert.equal(waiting, s.loot.length, 'pending rows = the engine\'s loot window');
        const r = b.dispatch({ type: 'LOOT_CLOSE' });
        assert.ok(r.ok);
        const log = b.backend.engineLog().slice(-waiting);
        assert.ok(log.every((a) => a.type === 'LOOT_DROP'), JSON.stringify(log));
        assert.equal(nodeOf(b).loot.length, 0);
        for (const it of L.items.filter((x) => x.inBag)) assert.ok(nodeOf(b).player.bag.some((x) => x.uid === it.uid), 'rows in the bags are kept');
        met++;
        continue;
      }
      if (!b.dispatch({ type: 'AUTO' }).ok) break;
    }
    assert.ok(met > 0, 'a spoils window with items in the bags and items waiting');
  } finally { done(); }
});
