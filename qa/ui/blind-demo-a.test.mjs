// Blind demo round 1, group A (BACKLOG 2026-11-26 A; feedback 2026-11-26-blind-demo-skipper and -newcomer; lines draft):
// danger before the click, the pure parts in Node. The map's enemy count includes the enemy a fight calls in later
// (mapView `calls`); the call reads "Calls 1 more in round 4 unless stopped." (with the caller's name in the panels); an
// elite with an escort is not "One powerful enemy"; a seen chest says only that it may be trapped. The browser side is
// ui-regress part N (fogDiff: the badge's count) and part S (D144-5: the elite line) and the hand-off's screenshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const R = await import('../../src/rules.js');
const { CONTENT } = await import('../../src/content/index.js');
const { foeCount, callsText, expNodeDesc } = await import('../../src/ui/screens.js');

const RULES = { grindMaxWaves: 3, grindWaveSize: 2 };

test('the map badge counts every enemy: the fight\'s own and the one it calls in later', () => {
  assert.equal(foeCount({ archetypes: ['skulker', 'caster'], calls: { count: 1, round: 4 } }), 3);
  assert.equal(foeCount({ archetypes: ['brute', 'caster'], calls: null }), 2);
  assert.equal(foeCount({ archetypes: [null, 'beast'] }), 2, 'an elite and its escort');
});

test('the call in words (D150: plain, once)', () => {
  assert.equal(callsText({ count: 1, round: 4 }), 'Calls 1 more in round 4 unless stopped.');
  assert.equal(callsText({ count: 1, round: 4 }, 'Hedgerow Cutpurse'), 'Hedgerow Cutpurse calls 1 more in round 4 unless stopped.');
  assert.equal(callsText(null), '');
});

test('an elite with an escort is not "One powerful enemy" (newcomer s0270: "Foes: 2 enemies" then "One powerful enemy")', () => {
  assert.equal(expNodeDesc({ type: 'elite', cl: 16, level: 17, archetypes: [null] }, { level: 10 }, RULES), 'One powerful enemy at level 17, 7 levels above you. High experience and a guaranteed good item.');
  assert.equal(expNodeDesc({ type: 'elite', cl: 16, level: 17, archetypes: [null, 'beast'] }, { level: 10 }, RULES), 'A powerful enemy at level 17, 7 levels above you, and its escort. High experience and a guaranteed good item.');
});

test('a seen chest: "Unguarded" is not followed by "may be guarded" (newcomer s0250, skipper s0258)', () => {
  assert.equal(expNodeDesc({ type: 'treasure', cl: 3, guarded: false, archetypes: [] }, { level: 3 }, RULES), 'A chest with gold and an item. It may be trapped.');
  assert.match(expNodeDesc({ type: 'treasure', cl: 3, guarded: true, archetypes: ['beast'] }, { level: 3 }, RULES), /watched by a guard\. It may also be trapped\./);
  assert.match(expNodeDesc({ type: 'treasure', cl: 3 }, { level: 3 }, RULES), /may be guarded or trapped/, 'not seen in full: as before');
});

test('the engine view gives what the UI reads: mapView calls on a quest with a skulker, R.fightSignal in its fight', () => {
  const sk = Object.keys(CONTENT.enemies).find((t) => CONTENT.enemies[t].archetype === 'skulker' && /^z1_/.test(t));
  const br = Object.keys(CONTENT.enemies).find((t) => CONTENT.enemies[t].archetype === 'brute' && /^z1_/.test(t));
  let s = R.debug.build({ content: CONTENT, classId: 'rogue', zone: 1, level: 3, seed: 4 }).state;
  s = R.debug.encounter(s, { ids: [br, sk] }).state;
  const c = R.fightSignal(s);
  assert.equal(c.count, R.C.SIGNAL_ADDS);
  assert.equal(c.round, 4);
  assert.equal(c.name, CONTENT.enemies[sk].name);
  assert.equal(callsText(c, c.name), `${CONTENT.enemies[sk].name} calls 1 more in round 4 unless stopped.`);
});
