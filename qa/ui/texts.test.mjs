// The UI's side of the engine hand-off engine-2026-11-13d (D144, blind tester panel 2026-11-13), pure parts in Node: the
// hub's welcome line and Trainer card by R.trainerView (UI need 1), H05's shield line (need 2), an elite's own level and
// its gap to the player's (need 5), a Grind's waves on the expedition map and the tracker's wave (need 8), and the hit
// chance of an answer that lands on a hit roll (need 11). The browser checks are ui-regress part S (S1, S3, S5-S7) and
// part M (the contract slots header, need 10).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// a localStorage for Node, unless a test file run before this one in the same process (qa/ui/index.js) has its own:
// onboarding.test.mjs reads back what the hint store writes to it
const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const R = await import('../../src/rules.js');
const { CONTENT } = await import('../../src/content/index.js');
const { hubWelcome } = await import('../../src/ui/director.js');
const { trainerMeta, nodeLevel, expNodeDesc } = await import('../../src/ui/screens.js');
const { grindLine } = await import('../../src/ui/hud.js');
const { answerChance } = await import('../../src/ui/tracks.js');
const { rawLine, fillLine } = await import('../../src/ui/onboarding.js');

const T = CONTENT.tutorial;
const data = { tutorial: { table: T } };
const RULES = { grindMaxWaves: 3, grindWaveSize: 2 }; // nodeDesc's classic-map numbers (not read by the cases below)

test('need 1: the hub welcome is guide.hubLine while the trainer has nothing to teach, guide.hubTrainerLine when it has', () => {
  const zone = { name: 'Thornmere' };
  assert.equal(hubWelcome({ zone, trainer: { learn: [], train: [], next: 4, useful: false } }, data), fillLine(T.guide.hubLine, { zone: 'Thornmere' }).text);
  assert.equal(hubWelcome({ zone, trainer: { learn: [{ id: 'x', lvl: 4, cost: 1 }], train: [], next: 6, useful: true } }, data), fillLine(T.guide.hubTrainerLine, { zone: 'Thornmere' }).text);
  assert.ok(!/Visit the trainer/.test(hubWelcome({ zone, trainer: { useful: false, next: 4 } }, data)), 'no "Visit the trainer" with nothing to learn');
  assert.ok(hubWelcome({ zone, trainer: { useful: false } }, data).includes('Thornmere'), '{zone} filled');
});

test('need 1: at the first hub every class gets useful false (R.trainerView); the Trainer card names the next spell\'s level', () => {
  for (const classId of ['rogue', 'mage', 'hunter']) {
    let s = R.newRun({ classId, petId: classId === 'hunter' ? 'ridgewolf' : null, seed: 8736, content: CONTENT });
    for (const a of [{ type: 'START_RUN' }, { type: 'SET_OUT' }]) s = R.step(s, a).state; // the start camp, then zone 1's hub
    assert.deepEqual([s.phase, s.player.level], ['ZONE_HUB', 1], classId);
    const tv = R.trainerView(s);
    assert.equal(tv.useful, false, `${classId}: nothing to learn at level 1`);
    assert.equal(trainerMeta({ trainer: tv }), `Nothing new to learn yet (next spell at level ${tv.next})`);
  }
  assert.equal(trainerMeta({ trainer: { useful: true, next: 6 } }), 'Learn and rank up spells');
  assert.equal(trainerMeta({ trainer: null }), 'Learn and rank up spells', 'no view (an older engine): as before');
  assert.equal(trainerMeta({ trainer: { useful: false, next: null } }), 'Nothing new to learn');
});

test('need 2: H05 reads its shield line by alt or as H05.shield; its own line otherwise', () => {
  const h05 = T.hints.find((x) => x.id === 'H05');
  assert.equal(rawLine(T, 'H05', 'rogue', 'shield'), h05.alt.shield);
  assert.equal(rawLine(T, 'H05.shield', 'rogue'), h05.alt.shield);
  assert.equal(rawLine(T, 'H05', 'rogue'), h05.line);
  assert.equal(rawLine(T, 'H05', 'rogue', 'nope'), h05.line, 'an alt it does not have: its own line');
  assert.ok(!/Spend your big hit now/.test(h05.alt.shield));
});

test('need 5: an elite node is at its own level (mapView level), said against the player\'s', () => {
  const elite = { type: 'elite', cl: 9, level: 10 };
  assert.equal(nodeLevel(elite), 10);
  assert.equal(nodeLevel({ type: 'quest', cl: 9 }), 9);
  assert.equal(nodeLevel({ type: 'elite', cl: 9 }), 9, 'no level in the view (not seen in full): the node level');
  assert.equal(expNodeDesc({ type: 'elite', cl: 16, level: 17 }, { level: 10 }, RULES), 'One powerful enemy at level 17, 7 levels above you. High experience and a guaranteed good item.');
  assert.match(expNodeDesc({ type: 'elite', cl: 10, level: 11 }, { level: 10 }, RULES), /at level 11, 1 level above you\./);
  assert.match(expNodeDesc({ type: 'elite', cl: 9, level: 10 }, { level: 10 }, RULES), /at level 10, your level\./);
  assert.match(expNodeDesc({ type: 'elite', cl: 7, level: 8 }, { level: 10 }, RULES), /at level 8, 2 levels below you\./);
});

test('need 8: a Grind on the expedition map is one wave of its enemies; the tracker counts the wave being fought', () => {
  assert.equal(expNodeDesc({ type: 'grind', cl: 12, waves: 1, archetypes: ['mender', 'brute'] }, { level: 10 }, RULES), 'One wave of 2 enemies. Steady experience, gold and more drops.');
  assert.match(expNodeDesc({ type: 'grind', cl: 12, waves: 3, archetypes: ['brute'] }, { level: 10 }, RULES), /^1 to 3 waves; the first of 1 enemy\./);
  const node = (k, done, planned) => ({ type: 'grind', fightNo: k + 1, waves: done, wavesChosen: planned });
  assert.equal(grindLine(node(0, 0, 1), { over: null }), 'Wave 1 of 1', 'in the first wave (it read "Wave 0 of 1")');
  assert.equal(grindLine(node(0, 0, 1), { over: 'victory' }), '1 of 1 wave done', 'its spoils: the node as it was in the fight');
  assert.equal(grindLine(node(1, 1, 3), null), '1 of 3 waves done', 'between waves');
  assert.equal(grindLine(node(1, 1, 3), { over: null }), 'Wave 2 of 3');
  assert.equal(grindLine(node(0, 0, 0), null), 'Choose how many waves');
});

test('need 11: an answer that lands on a hit roll gives its chance in words; a sure one or an amount gives none', () => {
  assert.equal(answerChance({ id: 'rime_burst', chance: 0.9512 }), '95 %');
  assert.equal(answerChance({ id: 'deadfall_trap', chance: 1 }), '100 %');
  assert.equal(answerChance({ id: 'arcane_ward', sure: false }), null);
  assert.equal(answerChance(null), null);
});
