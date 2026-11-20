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
