// D169 Hunter package (docs/specs/legacy.md 2.4.3 item 2, draft): the UI's pure parts in Node. With ?legacy=1 (legacy,
// oruvathLegacy, economyV2 on) Lost Technique I (Hunter)'s hall card says what the passive does (the bridge's entry carries
// `passive`, C.KEEN_RICOCHET), its card still names hero level 9, its icon is Keen Shot's, and the next run's lines name the
// passive, not Ricochet Bolt. Outside Legacy the card is Ricochet Bolt's as before.
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
const { metaEffect, nextRunLines, passiveEffect } = await import('../../src/ui/ui-text.js');
const { cardReq } = await import('../../src/ui/meta.js');

const done = () => { C.GATES.legacy = false; C.GATES.oruvathLegacy = false; C.GATES.economyV2 = false; setDisplay({}); clear(); };

test('Legacy hall: Lost Technique I (Hunter) is Keen Shot\'s passive on its card, from hero level 9', () => {
  clear();
  try {
    const b = createBridge({ seed: 3, legacy: true });
    const D = b.data.meta; const e = D.entries.sp_h1;
    assert.deepEqual(e.passive, { ...C.KEEN_RICOCHET });
    const fx = metaEffect(e, D, b.data, 'expedition');
    assert.equal(fx.short, 'Keen Shot also hits up to two other enemies for 30 %');
    assert.match(fx.long, /from hero level 9, every Keen Shot also hits up to two other enemies for 30 % of its damage/);
    assert.doesNotMatch(`${fx.short} ${fx.long}`, /Ricochet|trainer/);
    assert.equal(cardReq(e, b.data), 'From hero level 9');
    // the other techniques are spells as before
    for (const id of ['sp_h2', 'sp_r1', 'sp_m1']) { assert.equal(D.entries[id].passive, undefined, id); assert.match(metaEffect(D.entries[id], D, b.data, 'expedition').short, /trainer teaches/); }
  } finally { done(); }
});

test('Legacy: the next run of a Hunter that owns it lists the passive (the dry START_RUN carries meta.keenRicochet)', () => {
  clear();
  try {
    const b = createBridge({ seed: 3, legacy: true });
    const D = b.data.meta;
    const lines = nextRunLines({ meta: { keenRicochet: true, spells: ['beastcall_horn'] }, classId: 'hunter', oaths: [] }, D, b.data);
    assert.deepEqual(lines.map((l) => l.id), ['sp_h1', 'sp_h2']);
    assert.equal(lines[0].text, passiveEffect(C.KEEN_RICOCHET, b.data).short);
    // the engine's own dry START_RUN of a Legacy Hunter that owns it
    const prof = R.debug.setHero({ ...R.newProfile(), unlocks: { sp_h1: 1 } }, 'hunter', { level: 20, xp: 0 });
    const s = R.step(R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 4, content: CONTENT, profile: prof }), { type: 'START_RUN' }).state;
    assert.equal(s.meta.keenRicochet, true);
    assert.deepEqual(nextRunLines({ meta: s.meta, classId: 'hunter', oaths: [] }, D, b.data).filter((l) => l.id === 'sp_h1').length, 1);
  } finally { done(); }
});

test('outside Legacy: the card is Ricochet Bolt\'s, as before', () => {
  clear(); done();
  const b = createBridge({ seed: 3 });
  const D = b.data.meta; const e = D.entries.sp_h1;
  assert.equal(e.passive, undefined);
  assert.equal(metaEffect(e, D, b.data, 'expedition').short, 'The Hunter trainer teaches Ricochet Bolt');
  assert.equal(cardReq(e, b.data), `From level ${C.SPELL.ricochet_bolt.lvl}`);
});
