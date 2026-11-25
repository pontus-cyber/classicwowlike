// D166 (draft; report legacy-hunter-techniques-2026-11-20): in a Legacy run (sim/lib/policy.mjs legacyRules) the bar
// template counts one target for every multi-target spell, Ricochet Bolt's bounces included, so Lost Technique I no longer
// takes the Hunter's Camp AoE step from Deadfall Trap or a zone slot from Savage Order. Off the switch (level-60 runs) the
// bounces still count, so those bars are as before. D169 (legacy.md 2.4.3, draft): with both gates on a Legacy run teaches no
// Ricochet Bolt at all (Lost Technique I is Keen Shot's passive), so the hero's bars are the same with and without it.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, GATE_DEFAULTS, newRunFor } from '../../sim/lib/engine.mjs';
import { setGates } from '../../sim/lib/runner.mjs';
import { spellValue, legacyRules, templateBar } from '../../sim/lib/policy.mjs';
import { cellProfile } from '../../sim/lib/runner.mjs';
import { CONTENT } from '../../sim/lib/engine.mjs';
import { campBars } from '../../sim/campbars.mjs';

after(() => setGates(null));
const ON = { ...Object.fromEntries(Object.entries(GATE_DEFAULTS).filter(([, on]) => on)), legacy: true, oruvathLegacy: true };
const TECH = ['ricochet_bolt', 'beastcall_horn'];

/** A level-60 Hunter with every class spell and both Lost Techniques learned (template input only). */
function hunter60() {
  const s = newRunFor({ classId: 'hunter', petId: 'ridgewolf', seed: 3 });
  R.stepInPlace(s, { type: 'START_RUN' });
  s.player.level = 60;
  for (const sp of Object.values(C.SPELL)) if (sp.cls === 'hunter' && (sp.source === 'class' || sp.source === 'meta')) { s.player.spells[sp.id] = { tl: 60, rank: 1 }; if (!s.player.spellOrder.includes(sp.id)) s.player.spellOrder.push(sp.id); }
  return s;
}

describe('D166: Lost Techniques on the Hunter bar (Legacy runs only)', () => {
  test('Legacy: the Camp bar at hero 20 and 25 is the same with and without the techniques (Deadfall Trap kept)', () => {
    setGates(ON);
    try {
      for (const H of [20, 25]) {
        const without = campBars('hunter', H);
        const withTech = campBars('hunter', H, { extra: TECH });
        assert.ok(without.prevent.includes('deadfall_trap'), `H${H}`);
        assert.deepEqual(withTech.prevent, without.prevent, `H${H}`);
      }
    } finally { setGates(null); }
  });

  test('Legacy: Ricochet Bolt is valued at one target (its main hit, Keen Shot\'s numbers); off the switch its bounces count', () => {
    const s = hunter60();
    setGates(null);
    assert.equal(legacyRules(s), false);
    const k = spellValue(s, 'keen_shot');
    const sp = C.SPELL.ricochet_bolt;
    assert.ok(Math.abs(spellValue(s, 'ricochet_bolt') - k * (1 + sp.bounces * sp.bounceFrac)) < 1e-6);
    setGates(ON);
    try {
      s.legacy = { heroLevel: 25 };
      assert.equal(legacyRules(s), true);
      assert.ok(Math.abs(spellValue(s, 'ricochet_bolt') - spellValue(s, 'keen_shot')) < 1e-6);
    } finally { setGates(null); }
  });
});

describe('D169: Lost Technique I as Keen Shot\'s passive (Legacy runs, both gates)', () => {
  /** A Legacy Hunter at the hero's power level in zone z with the v3d hall bought (both techniques), sp_h1 dropped when !tech. */
  function hero(H, z, tech) {
    const profile = cellProfile({ bot: 'planner', cls: 'hunter', prof: 'later', hero: H, hall: 'v3d' });
    assert.equal(profile.unlocks.sp_h1, 1);
    if (!tech) delete profile.unlocks.sp_h1;
    return R.debug.build({ content: CONTENT, classId: 'hunter', petId: 'ridgewolf', seed: 2, profile, zone: z, level: C.POWER_OF_LEVEL[H - 1] }).state;
  }
  test('hero 20 and 25: no Ricochet Bolt known, and the zone and Camp template bars equal the bars without the technique', () => {
    setGates(ON);
    try {
      for (const H of [20, 25]) for (const z of [4, C.ZONE_COUNT + 1]) {
        const a = hero(H, z, true); const b = hero(H, z, false);
        assert.ok(!a.player.spells.ricochet_bolt && a.meta.keenRicochet, `H${H} z${z}`);
        for (const camp of [false, true]) assert.deepEqual(templateBar(a, { camp }), templateBar(b, { camp }), `H${H} z${z} camp ${camp}`);
      }
    } finally { setGates(null); }
  });
});
