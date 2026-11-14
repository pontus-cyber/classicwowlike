// M3 onboarding (src/ui/onboarding.js; docs/specs/m3-onboarding.md 2.4, 3.1; D142 (3), (4)): the hint store counts
// showings (a hint counts as seen at its ONB_HINT_SHOWS-th showing, however short each was), keeps them and H31's counters
// across a reload, and Reset hints clears them; the key chips follow the view: G3's key is the first bar spell that can be
// cast now (QA playtest 2026-11-13 finding 5: a Rogue with Severing Flourish, a finisher, in slot 1), and the Mage's
// Pre-cast names Q, then the spell's bar key (finding 4). D147 (docs/handoffs/engine-2026-11-14.md section 6, UI needs 1-2):
// the bridge passes guideSkipped's `why` and `rescues` (the real bridge in Node, driven to the ONB_RESCUE_MAX-th rescue), the
// rescue cap's line in place of the skip line, and G8's joint line with G7: its text and the two hints it stands in for.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// a localStorage for Node: the store reads and writes tbwcr.hints.v2
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const { hints, HINTS_KEY, KEYS, lineParts, lineKeys, attackSlot, rawLine, lineHints, LINE_BEATS, guideSkippedLine, rescueLeftLine } = await import('../../src/ui/onboarding.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');
const R = await import('../../src/rules.js');
const { CONTENT } = await import('../../src/content/index.js');
const C = await import('../../src/constants.js');

const stored = () => JSON.parse(mem.get(HINTS_KEY));
const reload = () => { hints.state = null; return hints.get(); };
const text = (parts) => parts.map((x) => (typeof x === 'string' ? x : x.key)).join('');
const chips = (parts) => parts.filter((x) => typeof x !== 'string').map((x) => x.key);
const SPELLS = Object.fromEntries(Object.values(C.SPELL).map((s) => [s.id, { target: s.target }]));
/** A fight view as the bridge gives it (engine-bridge.js header): the bar, legal.spells, the engage round's options. */
const fightView = (bar, okIds, engage = null) => ({
  phase: 'NODE', player: { classId: 'rogue', bar: [...bar, ...Array(7 - bar.length).fill(null)] },
  legal: { spells: Object.fromEntries(bar.filter(Boolean).map((id) => [id, { ok: okIds.includes(id), reason: okIds.includes(id) ? null : 'Not now' }])) },
  combat: { round: 1, over: null, enemies: [{ idx: 0, alive: true }], engage },
});

// D143: ONB_HINT_SHOWS lives in src/constants.js; createOnboarding passes it to the store (the bridge's rules.hintShows)
beforeEach(() => { mem.clear(); hints.state = null; hints.need = C.ONB_HINT_SHOWS; });

test('D142 (3): a hint counts as seen at its second showing, however short each was', () => {
  assert.equal(C.ONB_HINT_SHOWS, 2);
  hints.noteShown('H02');
  assert.equal(hints.seen('H02'), false, 'one short showing: not seen yet (spec 3.1, ONB_HINT_MIN_MS)');
  assert.equal(stored().shows.H02, 1);
  hints.noteShown('H02');
  assert.equal(hints.seen('H02'), true, 'the second showing makes it seen');
  assert.deepEqual([stored().seen.H02, stored().shows.H02], [true, 2], 'stored in tbwcr.hints.v2');
  hints.noteShown('H02');
  assert.equal(stored().shows.H02, 2, 'a seen hint is not counted further');
  hints.noteShown(null); // a beat with no hint of its own (G3)
  assert.deepEqual(Object.keys(stored().shows), ['H02']);
});

test('D142 (3): per-class hints count per class; a hint marked seen (Got it, done) needs no showings', () => {
  hints.noteShown('H01:rogue'); hints.noteShown('H01:mage');
  assert.equal(hints.seen('H01:rogue'), false);
  assert.equal(hints.seen('H01:mage'), false);
  hints.noteShown('H01:rogue');
  assert.deepEqual([hints.seen('H01:rogue'), hints.seen('H01:mage')], [true, false]);
  hints.mark('H05');
  hints.noteShown('H05');
  assert.equal(stored().shows.H05, undefined);
});

test('the showings and H31\'s counters survive a reload; Reset hints clears seen and showings, keeps Hints off', () => {
  hints.noteShown('H14');
  hints.get().stats = { won: 4, auto: false }; hints.save();
  hints.setOff(true);
  const s = reload();
  assert.deepEqual([s.shows.H14, s.stats.won, s.off], [1, 4, true], 'shows and stats kept by loadHints');
  hints.noteShown('H14');
  assert.equal(hints.seen('H14'), true, 'the second showing after a reload still counts');
  hints.reset();
  const r = reload();
  assert.deepEqual([r.seen, r.shows, r.off], [{}, {}, true]);
});

test('the store as a new profile has it: off, seen, nudge, shows, stats', () => {
  const s = hints.get();
  assert.deepEqual(Object.keys(s).sort(), ['nudge', 'off', 'seen', 'shows', 'stats']);
  assert.deepEqual(stored().shows, {});
});

test('D142 (4): the content lines the view keys fill (G7, H01) use {key_engage1}; D150: G3 has no line (fight 1 shows G7\'s)', () => {
  const T = CONTENT.tutorial;
  assert.equal(rawLine(T, 'G3', 'rogue'), null);
  assert.match(rawLine(T, 'G7', 'mage'), /\{key_engage1\}/);
  assert.match(rawLine(T, 'H01', 'mage'), /\{key_engage1\}/);
});

test('D142 (4b): G3 names the first bar spell that can be cast now (a finisher in slot 1 with no combo points: key 2)', () => {
  const rogue = fightView(['severing_flourish', 'gutting_jab'], ['gutting_jab'], { options: [{ id: 'ambush', spells: null, reason: null }] });
  assert.equal(attackSlot(rogue, SPELLS), 1);
  assert.deepEqual(lineKeys(rogue, SPELLS), { key_spell1: '2' });
  // D150: no content line names {key_spell1} any more (G3's went); the key logic is checked on its former line
  const parts = lineParts('Press {key_spell1} to attack. Bring their health to zero.', {}, { ...KEYS, ...lineKeys(rogue, SPELLS) });
  assert.equal(text(parts), 'Press 2 to attack. Bring their health to zero.');
  assert.deepEqual(chips(parts), ['2']);
  // the class's start order (Gutting Jab in slot 1): key 1, as before
  assert.deepEqual(lineKeys(fightView(['gutting_jab', 'severing_flourish'], ['gutting_jab']), SPELLS), { key_spell1: '1' });
  // a castable spell on an enemy comes before one on yourself; without the spell table any castable one counts
  const ward = fightView(['arcane_ward', 'ember_bolt'], ['arcane_ward', 'ember_bolt']);
  assert.equal(SPELLS.arcane_ward.target === 'enemy', false);
  assert.equal(attackSlot(ward, SPELLS), 1);
  assert.equal(attackSlot(ward), 0);
  // nothing castable, or no fight: no key from the view (the key map's 1 stays)
  assert.deepEqual(lineKeys(fightView(['severing_flourish'], []), SPELLS), {});
  assert.equal(attackSlot({ phase: 'MAP', player: { bar: ['gutting_jab'] }, legal: { spells: { gutting_jab: { ok: true } } }, combat: null }, SPELLS), -1);
  assert.deepEqual(lineKeys(null), {});
});

test('D142 (4a): the Mage\'s Pre-cast names Q, then its spell\'s bar key; a line within ONB_HINT_MAX_CHARS', () => {
  const pre = (spells, reason = null) => ({ options: [{ id: 'precast', spells: spells.map((spellId) => ({ spellId, targets: [0] })), reason }, { id: 'binding_glyph', spells: null }, { id: 'gather_power', spells: null }] });
  const mage = fightView(['ember_bolt', 'frost_lance'], ['ember_bolt', 'frost_lance'], pre(['frost_lance', 'ember_bolt']));
  const keys = lineKeys(mage, SPELLS);
  assert.deepEqual(keys.key_engage1, ['Q', '1'], 'the first Pre-cast spell on the bar, in bar order');
  for (const id of ['G7', 'H01']) {
    const parts = lineParts(rawLine(CONTENT.tutorial, id, 'mage'), {}, { ...KEYS, ...keys });
    assert.equal(text(parts), 'Round 1 is yours: they act from round 2. Open with Q then 1, W or E.', id);
    assert.deepEqual(chips(parts), ['Q', '1', 'W', 'E'], id);
    assert.ok(text(parts).length <= C.ONB_HINT_MAX_CHARS, `${id}: ${text(parts).length} characters`);
  }
  // the bar the other way round names its slot; Pre-cast greyed out (a reason) or with no spell: Q alone
  assert.deepEqual(lineKeys(fightView(['frost_lance', 'ember_bolt'], ['frost_lance', 'ember_bolt'], pre(['ember_bolt'])), SPELLS).key_engage1, ['Q', '2']);
  assert.equal(lineKeys(fightView(['ember_bolt'], ['ember_bolt'], pre(['ember_bolt'], 'Not now')), SPELLS).key_engage1, undefined);
  assert.equal(lineKeys(fightView(['ember_bolt'], ['ember_bolt'], pre([])), SPELLS).key_engage1, undefined);
  // the other classes' first option takes no spell: Q alone
  const rogue = lineParts(rawLine(CONTENT.tutorial, 'H01', 'rogue'), {}, { ...KEYS, ...lineKeys(fightView(['gutting_jab'], ['gutting_jab'], { options: [{ id: 'ambush', spells: null }] }), SPELLS) });
  assert.equal(text(rogue), 'Round 1 is yours: they act from round 2. Open with Q, W or E.');
});

test('lineParts: numbers from num, unknown placeholders stay visible', () => {
  assert.equal(text(lineParts('Deathblow on turn {deathblowTurn}: {nope}', { deathblowTurn: 2 })), 'Deathblow on turn 2: {nope}');
});

test('D147 (UI need 2): G8\'s joint line names W, fits a line, and stands in for H01 and H03; every other line for its own beat\'s hint', () => {
  const T = CONTENT.tutorial;
  const parts = lineParts(rawLine(T, 'G8.withEngage', 'rogue'), {}, KEYS);
  assert.equal(text(parts), 'Round 1 is yours: open with W on the wind-up and it is weakened all fight.');
  assert.deepEqual(chips(parts), [KEYS.key_engage2], 'the key chip is the control option\'s key, W');
  assert.ok(text(parts).length <= C.ONB_HINT_MAX_CHARS);
  assert.deepEqual(Object.keys(LINE_BEATS), ['G8.withEngage']);
  assert.deepEqual(lineHints('G8', 'G8.withEngage'), ['H01', 'H03'], 'both beats count as shown (spec 2.8 item 2)');
  assert.deepEqual([lineHints('G8', 'G8'), lineHints('G8', 'G8.landed'), lineHints('G8')], [['H03'], ['H03'], ['H03']], 'G8\'s own lines: H03 only');
  assert.deepEqual([lineHints('G7', 'G7'), lineHints('G7')], [['H01'], ['H01']]);
  assert.deepEqual([lineHints('G13', 'G13.closed'), lineHints('G3', 'G3')], [[], []], 'the closed line and a beat with no hint: none');
  // the joint line's hints are seen as one: two showings make both seen (H01 per class), and a mark marks each
  for (const k of lineHints('G8', 'G8.withEngage').map((id) => (id === 'H01' ? 'H01:mage' : id))) { hints.noteShown(k); hints.noteShown(k); }
  assert.deepEqual([hints.seen('H01:mage'), hints.seen('H03'), hints.seen('H01:rogue')], [true, true, false]);
});

test('D147 (UI need 1): the rescue cap\'s line (content guide.rescueCapLine) in place of the skip line; Skip guide says content guide.skipLine (engine-2026-11-14b UI need 3)', () => {
  const T = CONTENT.tutorial;
  assert.equal(T.guide.rescueCapLine, 'That was the last rescue: the guide ends here, and from now on a death ends the run.');
  assert.equal(T.guide.skipLine, 'You skip the guide: new things get one hint each.');
  assert.equal(guideSkippedLine({ t: 'guideSkipped', why: 'rescues', rescues: C.ONB_RESCUE_MAX }, T), T.guide.rescueCapLine);
  assert.equal(guideSkippedLine({ t: 'guideSkipped', why: null, rescues: null }, T), T.guide.skipLine);
  assert.equal(guideSkippedLine({ t: 'guideSkipped' }, T), T.guide.skipLine, 'the SKIP_GUIDE action has no why');
  assert.equal(guideSkippedLine({ t: 'guideSkipped' }, null), '', 'no content table: no line');
  assert.ok(!/skip the guide/i.test(T.guide.rescueCapLine));
});

test('engine-2026-11-14b UI need 4: the rescue banner\'s second line (content guide.rescueLeftLine), rescueMax - rescues after the rescue; none on the cap rescue', () => {
  const T = CONTENT.tutorial;
  const max = C.ONB_RESCUE_MAX;
  const tv = (rescues, skipped = false) => ({ on: true, skipped, rescues, rescueMax: max });
  assert.equal(T.guide.rescueLeftLine, 'Rescues left before the guide ends: {rescuesLeft}.');
  assert.deepEqual([1, 2].map((n) => rescueLeftLine(tv(n), T)), [max - 1, max - 2].map((k) => `Rescues left before the guide ends: ${k}.`));
  assert.equal(rescueLeftLine(tv(max, true), T), '', 'the ONB_RESCUE_MAX-th rescue ends the guide: the cap line says it');
  assert.equal(rescueLeftLine(tv(max), T), '', 'none left: no line');
  assert.equal(rescueLeftLine(null, T), '', 'not a guided run');
  assert.equal(rescueLeftLine(tv(1), null), '', 'no content table');
});

test('D147 (UI need 1): the bridge passes guideSkipped\'s why and rescues: the ONB_RESCUE_MAX-th rescue of a guided run, seed 8736', () => {
  assert.equal(C.ONB_RESCUE_MAX, 3);
  const b = createBridge({ seed: 8736 }); // a new profile in Node: the guided first run (no ?guide=0)
  b.dispatch({ type: 'START_RUN' });
  assert.ok(b.view.tutorial && b.view.tutorial.on, 'a guided run');
  for (let i = 0; i < 80 && !(b.view.combat && !b.view.combat.over && b.view.node && b.view.node.step === 'combat'); i++) assert.ok(b.dispatch({ type: 'AUTO' }).ok);
  assert.ok(b.view.combat && b.view.tutorial.guidedZone, 'a fight in the guided zone');
  // two rescues behind, 1 HP: the next death is the third rescue
  const s0 = R.deserialize(b.serialized(), CONTENT); s0.player.hp = 1; s0.tutorial.rescues = C.ONB_RESCUE_MAX - 1;
  b.testLoad(R.serialize(s0));
  let ev = [];
  for (let k = 0; k < 10 && !ev.some((e) => e.t === 'guideSkipped'); k++) ev = b.dispatch({ type: 'PASS' }).events;
  const kinds = ev.map((e) => e.t);
  assert.deepEqual(ev.find((e) => e.t === 'guideSkipped'), { t: 'guideSkipped', why: 'rescues', rescues: C.ONB_RESCUE_MAX });
  assert.ok(kinds.indexOf('rescue') >= 0 && kinds.indexOf('rescue') < kinds.indexOf('guideSkipped'), `the rescue first: ${kinds}`);
  assert.deepEqual([b.view.tutorial.skipped, b.view.tutorial.rescues, b.view.player.hp === b.view.player.maxHp], [true, C.ONB_RESCUE_MAX, true]);
  assert.equal(guideSkippedLine(ev.find((e) => e.t === 'guideSkipped'), CONTENT.tutorial), CONTENT.tutorial.guide.rescueCapLine);
  assert.equal(rescueLeftLine(b.view.tutorial, CONTENT.tutorial), '', 'the cap rescue: no rescues-left line');
});
