// D150 (owner 2026-11-14, text pass; docs/feedback/2026-11-14-blind-wording.md section 4 and 7): the UI's pure text parts
// in Node. The Furnace's line and its choice block (items 1, 5, 6, 25), the Deathblow's one instruction in the turn prompt
// built from the view (item 2, the real bridge on the guided seed 8736 up to Gorrak's engage round), a stopped wind-up's
// line (item 24), the engage cards without "You stay in Stealth" and the Ambush line from the spells known (item 4), the
// hub Trainer card when it has nothing to teach (item 22), the finisher's damage line (section 7), and the naming rule
// in the texts these modules write. The browser checks are ui-regress part T (and the parts the pass changed).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const R = await import('../../src/rules.js');
const C = await import('../../src/constants.js');
const { CONTENT } = await import('../../src/content/index.js');
const { standText, bossShown, heatToast, costText, stateRows, FURNACE_LINE } = await import('../../src/ui/heat.js');
const { deathblowPrompt, answersToShow, stoppedText } = await import('../../src/ui/tracks.js');
const { engageText, sapWaitText, oathEffect } = await import('../../src/ui/ui-text.js');
const { trainerIdle, trainerMeta } = await import('../../src/ui/screens.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');

const BANNED = /\bpar\b|Ascendancy|Star's line|\bPays\b|Spoils|\bilvl\b|Unlit Star|stay hidden|answered/;
const text = (parts) => parts.map((x) => (typeof x === 'string' ? x : x.key)).join('');

test('items 1, 25: the Furnace reads "Calm · 18 tolls to spare"; Boss only above 0; the log line in the same words', () => {
  assert.equal(standText({ heat: -18 }), '18 tolls to spare');
  assert.equal(standText({ heat: -1 }), '1 toll to spare');
  assert.equal(standText({ heat: 0 }), 'No tolls to spare');
  assert.equal(standText({ heat: 8 }), '8 tolls overspent');
  assert.equal(bossShown(0), '', 'no "Boss +0 %"');
  assert.equal(bossShown(0.004), '', 'rounds to 0: none');
  assert.equal(bossShown(0.06), 'Boss +6 %');
  assert.equal(heatToast({ state: 'warm', heat: -8, by: 'dim' }), 'The Furnace: Smouldering · 8 tolls to spare.', 'item 25: no "the Dimming draws near"');
  for (const st of ['clear', 'warm', 'hot', 'scorched']) assert.doesNotMatch(heatToast({ state: st, heat: 3 }), BANNED);
});

test('item 5: the tooltip is one sentence and the four states, from the engine\'s thresholds and rewards', () => {
  assert.equal(FURNACE_LINE, 'Every move costs tolls. Overspend and fights pay more, but the final boss gets stronger.');
  const H = { hotAt: C.HEAT_HOT_AT, scorchAt: C.HEAT_SCORCH_AT, gain: C.HEAT_GAIN, rarityUp: C.HEAT_RARITY_UP };
  const rows = stateRows(H);
  assert.deepEqual(rows.map((r) => r[0]), ['clear', 'warm', 'hot', 'scorched']);
  assert.equal(rows[0][1], 'Tolls to spare');
  assert.equal(rows[1][1], `Up to ${C.HEAT_HOT_AT} overspent`);
  assert.equal(rows[0][2], '', 'Calm: no bonus line (never "no reward")');
  assert.equal(rows[2][2], `+${Math.round(C.HEAT_GAIN.hot * 100)} % XP and gold, 1 in 2 drops a rarity up`);
  for (const r of rows) assert.doesNotMatch(r.join(' '), BANNED);
});

test('item 6: a choice costs "Costs 3 tolls." (a wave, the Dimming\'s fight said in the same line)', () => {
  assert.equal(costText({ time: 3 }), 'Costs 3 tolls.');
  assert.equal(costText({ time: 1 }), 'Costs 1 toll.');
  assert.equal(costText({ time: 3, perWave: true }), 'Costs 3 tolls a wave.');
  assert.equal(costText({ time: 4, dimFight: true }), 'Costs 4 tolls, then a fight in the Dimming.', 'section 7: the Bell names the fight');
  assert.equal(costText(null), '');
});

test('item 4: the engage cards say no "You stay in Stealth"; Ambush from the spells known, no "else"', () => {
  const n = { shadowstep: 'Shadowstep Strike', jab: 'Gutting Jab', trackLen: 3 };
  const amb = C.ENGAGE_OPTION.ambush;
  assert.equal(engageText(amb, n, { knows: () => false }), `Gutting Jab at ×${C.AMBUSH_MULT}. +${amb.cp} combo points.`);
  assert.equal(engageText(amb, n, { knows: (id) => id === 'shadowstep_strike', spells: { shadowstep_strike: { raw: C.SPELL.shadowstep_strike } } }), `Shadowstep Strike. +${C.SPELL.shadowstep_strike.cp} combo points.`);
  for (const id of ['ambush', 'sap', 'premeditate', 'lay_trap']) {
    const t = engageText(C.ENGAGE_OPTION[id], n, {});
    assert.doesNotMatch(t, /Stealth|\belse\b|\bElse\b/, `${id}: ${t}`);
  }
  assert.equal(sapWaitText({ stealth: true }), 'Sure if you wait: press Pass next round', 'one word for hidden: no "you stay hidden"');
  assert.doesNotMatch(oathEffect({ id: 'haste' }, { names: { boss: 'Oruvath' }, num: { oathHaste: 20 } }).long, BANNED);
});

test('item 24: a stopped Deathblow or wind-up is one sentence; "hit it now" only while it is off-balance', () => {
  assert.equal(stoppedText({ offBalance: { taken: 0.5 } }, { deathblow: true }), 'Deathblow stopped. It is weakened: hit it now.');
  assert.equal(stoppedText({ offBalance: null }, { deathblow: true }), 'Deathblow stopped. It is weakened.');
  assert.equal(stoppedText({ offBalance: { taken: 0.5 } }, { deathblow: false }), 'Wind-up stopped. It is weakened: hit it now.');
});

test('item 22: the hub Trainer with nothing to teach is idle (greyed, no toll): "Next spell at level N."', () => {
  assert.equal(trainerIdle({ trainer: { learn: [], train: [], next: 4, useful: false } }), true);
  assert.equal(trainerMeta({ trainer: { learn: [], train: [], next: 4, useful: false } }), 'Next spell at level 4.');
  // engine-2026-11-14d UI need 10: greyed whenever the gold covers nothing (a visit would buy nothing)
  assert.equal(trainerIdle({ trainer: { learn: [{ id: 'x' }], train: [], next: 6, useful: false } }), true, 'a lesson the gold does not cover: greyed too');
  assert.equal(trainerMeta({ trainer: { learn: [{ id: 'x' }], train: [], next: 6, useful: false } }), 'Its lessons cost more gold than you have.');
  assert.equal(trainerIdle({ trainer: { useful: true } }), false);
  assert.equal(trainerIdle({ trainer: null }), false, 'no view: as before');
});

test('item 2: Gorrak\'s engage round (guided seed 8736, Rogue): the prompt is "Round 3: Threshing Blow, about N. Sap now [W], then Pass [X]."; round 2 "Pass [X]"', () => {
  const b = createBridge({ seed: 8736 });
  b.dispatch({ type: 'START_RUN' });
  const elite = () => { const v = b.view; return !!(v.combat && !v.combat.over && v.combat.enemies.some((e) => e.rank === 'elite') && v.node && v.node.step === 'combat'); };
  for (let i = 0; i < 160 && !elite(); i++) assert.ok(b.dispatch({ type: 'AUTO' }).ok, `step ${i}`);
  assert.ok(elite(), 'Gorrak\'s fight');
  const ctx = { data: b.data, ui: { target: null } };
  let v = b.view; assert.ok(v.combat.engage, 'its engage round');
  const w = v.combat.windups.find((x) => x.deathblow);
  assert.ok(w, 'his Deathblow in view (R.windupView)');
  const parts = deathblowPrompt(w, answersToShow(w, v, ctx), v, ctx, v.combat.target);
  assert.equal(text(parts), `Round ${w.round}: ${w.name}, about ${w.est}. Sap now W, then Pass X.`);
  assert.deepEqual(parts.filter((x) => typeof x !== 'string').map((x) => x.key), ['W', 'X'], 'the keys are key chips');
  // round 1: Sap (the engine's choice for the Rogue, D49); round 2: waiting is the answer (windupView's PASS answer)
  const a = b.autoAction(); assert.equal(a.action ? a.action.option : a.option, 'sap', `autoplay saps: ${JSON.stringify(a)}`);
  b.dispatch(a); v = b.view;
  const w2 = v.combat.windups.find((x) => x.deathblow);
  assert.ok(w2 && w2.answers.some((x) => x.via === 'pass' && x.now), 'Pass answers it now');
  assert.equal(text(deathblowPrompt(w2, answersToShow(w2, v, ctx), v, ctx, v.combat.target)), `Round ${w2.round}: ${w2.name}, about ${w2.est}. Pass X. Attacking breaks Sap.`);
  assert.equal(text(deathblowPrompt({ ...w, ready: false }, { list: [], when: 'now' }, v, ctx)), `Round ${w.round}: ${w.name}, about ${w.est}. No answer ready: kill it first or brace for it.`);
});

test('section 7, item 17: one damage line; out of a fight "per combo point", in one the engine\'s estimate on the target "with N combo points"', () => {
  const b = createBridge({ seed: 8736 });
  b.dispatch({ type: 'START_RUN' });
  const d0 = b.describeSpell('severing_flourish');
  assert.ok(d0.lines.some((l) => /per combo point\.$/.test(l)), JSON.stringify(d0.lines));
  assert.ok(!d0.lines.some((l) => /^Before level/.test(l)), 'item 17: no developer disclaimer');
  const s = R.deserialize(b.serialized(), CONTENT);
  for (let i = 0; i < 60 && !s.fight; i++) Object.assign(s, R.step(s, R.autoAction(s)).state);
  assert.ok(s.fight, 'a fight');
  s.fight.p.cp = 3; b.testLoad(R.serialize(s));
  const s3 = R.deserialize(b.serialized(), CONTENT);
  const tgt = s3.fight.enemies.findIndex((e) => e.hp > 0);
  const est = R.spellInfo(s3, 'severing_flourish', tgt).est;
  const d3 = b.describeSpell('severing_flourish', tgt);
  // engine-2026-11-14d UI need 11: spellInfo est (after level, crits and armour) on the target, the total at amount.cp points
  assert.ok(typeof est === 'number' && d3.lines.includes(`Deals about ${est} physical damage to the ${s3.fight.enemies[tgt].name} with 3 combo points.`), JSON.stringify({ est, lines: d3.lines }));
  assert.equal(d3.lines.filter((l) => /damage/.test(l)).length, 1, 'one damage line');
});

test('section 7 (engine-2026-11-14d UI need 17): the spoils\' experience is the whole fight\'s, the sum of the XP it floated', () => {
  // the real bridge on a normal run (seed 7, no guide): AUTO until the spoils of a fight with two or more enemies; the
  // fight's xp events (each kill's in its own step; a quest's, story's or contract's show on their own windows)
  const b = createBridge({ seed: 7 });
  b.dispatch({ type: 'START_RUN' });
  let sum = 0; let n = 0; let found = null;
  for (let i = 0; i < 400 && !found; i++) {
    const r = b.dispatch({ type: 'AUTO' }); assert.ok(r.ok, `step ${i}`);
    for (const e of r.events) {
      if (e.t === 'fightStart') { sum = 0; n = e.enemies.length; }
      if (e.t === 'xp' && !['quest', 'story', 'contract'].includes(e.why)) sum += e.amount;
    }
    const v = b.view;
    if (v.loot && v.loot.kind === 'loot' && n >= 2) found = { xp: v.loot.xp, sum, n };
  }
  assert.ok(found, 'spoils of a fight with two or more enemies');
  assert.equal(found.xp, found.sum, JSON.stringify(found));
});
