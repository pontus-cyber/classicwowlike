// Demo blind round 2, R2-6 "Smaller" (docs/feedback/2026-11-26-blind-demo-*.md; docs/handoffs/ui-2026-11-26e.md; draft): the pure parts
// in Node. Weapon and off-hand icons by the item's kind; "N unlocks within reach" counts what the balance buys together; the
// hero-levels summary line; one name for the Hunter's resource; one word ("place") for a map location in the texts a player
// reads; the idle Trainer place; the contract sentences. The browser checks are ui-regress part AE.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const R = await import('../../src/rules.js');
const C = await import('../../src/constants.js');
const { CONTENT } = await import('../../src/content/index.js');
const { ITEM_NAMES } = await import('../../src/content/item-names.js');
const { weaponKindOf, offhandKindOf } = await import('../../src/ui/art-icons.js');
const T = await import('../../src/ui/ui-text.js');
const { idleTrainer, idleTrainerLine, trainerGreyed, expNodeDesc } = await import('../../src/ui/screens.js');
const { BOONS, CONSUMABLES } = await import('../../src/ui/mock-data.js');

test('weapon and off-hand icons follow the item\'s kind, for every base name in the content', () => {
  const bad = [];
  for (const band of ITEM_NAMES) {
    for (const list of Object.values(band.weapon)) for (const n of list) if (!weaponKindOf(n)) bad.push(n);
    for (const list of Object.values(band.offhand)) for (const n of list) if (!offhandKindOf(n)) bad.push(n);
  }
  assert.deepEqual(bad, []);
  assert.equal(weaponKindOf('Keen Harvest Knife'), 'dagger');
  assert.equal(weaponKindOf('Skinning Blade of the Fox'), 'blade');
  assert.equal(weaponKindOf('Fen Cutlass'), 'blade');
  assert.equal(weaponKindOf('Gutting Hook'), 'hook');
  assert.equal(weaponKindOf('Cinder Hatchet'), 'axe');
  assert.equal(weaponKindOf('Sunscribe Staff'), 'staff');
  assert.equal(weaponKindOf('Reedwood Longbow'), 'bow');
  assert.equal(weaponKindOf("Hunter's Whitebow"), 'bow');
  assert.equal(weaponKindOf('Highland Recurve'), 'bow');
  assert.equal(weaponKindOf('Whisperfang, Veil-Cutter'), null, 'a unique with no kind word keeps its class\'s icon');
  assert.equal(offhandKindOf('Hornquiver'), 'quiver');
  assert.equal(offhandKindOf('Wooden Buckler'), 'shield');
  assert.equal(offhandKindOf('Lantern Orb'), 'tome');
  assert.equal(offhandKindOf('Thresher\'s Dirk'), 'dagger');
});

test('"N unlocks within reach": the entries the balance buys together, cheapest first', () => {
  const offers = [50, 70, 70, 80, 50, 60, 70].map((c) => ({ available: true, nextCost: c }));
  const at = (b) => T.reachCount(offers, b);
  assert.deepEqual([0, 49, 50, 77, 99, 100, 115, 200, 500].map(at), [0, 0, 1, 1, 1, 2, 2, 3, 7]);
  assert.equal(T.reachCount([{ available: false, nextCost: 10 }, { available: true, nextCost: 10 }], 100), 1, 'an entry that is not open does not count');
  assert.equal(T.reachCount([], 100), 0);
  assert.equal(T.reachCount(null, 100), 0);
});

test('the summary line for hero levels says the number of levels', () => {
  assert.equal(T.heroLevelsLine(1), '1 hero level gained');
  assert.equal(T.heroLevelsLine(2), '2 hero levels gained');
});

test('the Hunter\'s resource is Focus in every line it appears in; Rest does not name mana for a class without it', () => {
  const rules = R.C && {};
  const rest = (kind) => expNodeDesc({ type: 'rest' }, { level: 1, res: { kind } }, rules);
  assert.match(rest('mana'), /^Full health and mana,/);
  assert.doesNotMatch(rest('focus'), /mana/);
  assert.doesNotMatch(rest('energy'), /mana/);
  assert.doesNotMatch(BOONS.mending.text, /^Full health and mana/, 'the shrine boon names mana for the Mage only');
  assert.match(BOONS.mending.text, /A Mage also gets its mana back/);
  const hunter = CONTENT.tutorial.hints.find((h) => h.id === 'H29');
  assert.doesNotMatch(hunter.line, /mana/);
  const g15 = CONTENT.tutorial.beats.find((b) => b.id === 'G15');
  assert.match(g15.byClass.hunter, /focus/);
  assert.doesNotMatch(g15.byClass.hunter, /mana|resource/i);
});

test('one word, "place", for a point on the map in the texts a player reads (content lines, tooltips, camp texts)', () => {
  const hit = [];
  const scan = (where, x) => {
    if (typeof x === 'string') { if (/\b(nodes?|sites?)\b/i.test(x)) hit.push(`${where}: ${x}`); } else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) scan(`${where}.${k}`, v);
  };
  scan('tutorial.hints', CONTENT.tutorial.hints.map((h) => [h.line, h.alt]));
  scan('tutorial.beats', CONTENT.tutorial.beats.map((b) => [b.line, b.alt, b.byClass]));
  scan('texts.prep', CONTENT.texts.prep);
  scan('texts.contracts', CONTENT.texts.contracts);
  for (const id of ['elixir_ferocity']) scan(`consumable ${id}`, CONSUMABLES[id].text);
  for (const b of Object.values(BOONS)) scan(`boon ${b.id}`, b.text);
  const r = { vision: 1, guide: 1, tracker: 2, bountyPlaced: 2, expVision: 1 };
  for (const k of ['cull', 'bounty', 'delve']) scan(`contractSitesText ${k}`, T.contractSitesText({ kind: k, regionName: 'Sedge Flats', name: 'Sisel', dungeon: 'The Hollow' }, r, { guide: true, tracker: true }));
  scan('contractKind', T.contractKindText('cull'));
  for (const id of ['prep_charts', 'prep_tracker', 'prep_spyglass']) scan(`prepOptionEffect ${id}`, T.prepOptionEffect({ id, charges: 2, kind: 'x' }, { tracker: 2, vision: 1 }, (x) => x, CONTENT));
  assert.deepEqual(hit, []);
});

test('contract tooltips say where to go: the region first, then which places count, then how far the marks show', () => {
  const r = { vision: 1, guide: 1, tracker: 2, bountyPlaced: 2 };
  const cull = T.contractSitesText({ kind: 'cull', regionName: 'Sedge Flats' }, r, { tracker: true });
  assert.match(cull, /^Go to Sedge Flats\. Only the marked Quest and Grind places count; other fights do not\. Its marks show on the map up to 1 step away; with Tracker's Notes up to 2 steps, even on places you have not seen\.$/);
  const bounty = T.contractSitesText({ kind: 'bounty', regionName: 'Sedge Flats', name: 'Sisel Mistweaver' }, r);
  assert.match(bounty, /^Go to Sedge Flats\. Sisel Mistweaver stands at two marked Elite places there\. Beat it at either one\./);
  assert.match(T.contractSitesText({ kind: 'delve', dungeon: 'The Hollow' }, r), /^Go to The Hollow\. It shows on the zone map while you hold this contract\.$/);
});

test('the idle map Trainer: the hub row\'s test, the same grey-out, one plain line', () => {
  const v = (useful, talents = {}, next = 4, lists = {}) => ({ trainer: { useful, next, learn: [], train: [], ...lists }, player: { talents } });
  const node = { type: 'trainer', know: 'full', done: false };
  assert.equal(idleTrainer(node, v(false)), true);
  assert.equal(idleTrainer(node, v(true)), false, 'something to teach: not idle');
  assert.equal(idleTrainer(node, v(false, { h_a1: 1 })), false, 'the hub row is not greyed once a talent is spent: nor is the place');
  assert.equal(trainerGreyed(v(false)), true);
  assert.equal(idleTrainer({ ...node, done: true }, v(false)), false, 'a used place says "Done"');
  assert.equal(idleTrainer({ ...node, know: 'type' }, v(false)), false, 'a place not seen in full says nothing of its trainer');
  assert.equal(idleTrainer({ type: 'quest', know: 'full' }, v(false)), false);
  assert.match(idleTrainerLine(v(false, {}, 4)), /^Nothing to train yet\. Next spell at level \d+\.$/);
  assert.equal(idleTrainerLine(v(false, {}, null)), 'Nothing new to learn.');
  assert.match(idleTrainerLine(v(false, {}, 4, { learn: [{ id: 'x' }] })), /^Nothing to train yet\. Its lessons cost more gold than you have\.$/);
});

test('the zone band line and the Legacy hall count are plain text', () => {
  assert.equal(T.ZONE_MATCH_LINE, 'The zone matches your level, so its levels change from run to run.');
  assert.ok(C.CONTRACT_SLOTS === 4, 'the camp heading says the rule: four contracts at a time');
});
