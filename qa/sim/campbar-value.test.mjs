// Camp bar template under C.GATES.oruvathLegacy (handoff sim-2026-11-18c; report legacy-classes-2026-11-18 Verdict 6):
// a spell's value is (expected damage + damage prevented) × its usage share, the AoE step stays on damage, and the fill
// step treats values within SIM.BAR_TIE_BAND as tied (earliest learned wins). Off the switch the bar is as before.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, GATE_DEFAULTS, newRunFor } from '../../sim/lib/engine.mjs';
import { SIM } from '../../sim/lib/params.mjs';
import { setGates } from '../../sim/lib/runner.mjs';
import { templateBar, preventedRounds, campPrevents } from '../../sim/lib/policy.mjs';
import { campBars } from '../../sim/campbars.mjs';

after(() => setGates(null));
const ON = { ...Object.fromEntries(Object.entries(GATE_DEFAULTS).filter(([, on]) => on)), legacy: true, oruvathLegacy: true };

/** Swap fields of a spell (getters included) for the body of f, then put them back. */
function withSpell(id, fields, f) {
  const sp = C.SPELL[id];
  const was = {};
  for (const k of Object.keys(fields)) was[k] = Object.getOwnPropertyDescriptor(sp, k);
  try {
    for (const [k, v] of Object.entries(fields)) Object.defineProperty(sp, k, { value: v, enumerable: true, configurable: true, writable: true });
    return f();
  } finally { for (const [k, d] of Object.entries(was)) Object.defineProperty(sp, k, d); }
}

/** The Mage's hero at hero 14 at the Camp (as sim/campbars.mjs), with the switches on for the body of f. */
function mage14(f) {
  setGates(ON);
  try {
    const b = campBars('mage', 14);
    assert.ok(b.prevent.includes('frost_lance'));
    return f(b);
  } finally { setGates(null); }
}

describe('Camp bar value: damage plus damage prevented (handoff sim-2026-11-18c)', () => {
  test('off the switch (non-Legacy): the Camp and road bars do not depend on SIM.CAMP_BAR_PREVENT', () => {
    setGates(null);
    for (const cls of ['rogue', 'mage', 'hunter']) {
      const s = newRunFor({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed: 3 });
      R.stepInPlace(s, { type: 'START_RUN' });
      s.player.level = 60;
      for (const sp of Object.values(C.SPELL)) if (sp.cls === cls && sp.source === 'class') { s.player.spells[sp.id] = { tl: 60, rank: 1 }; if (!s.player.spellOrder.includes(sp.id)) s.player.spellOrder.push(sp.id); }
      assert.equal(campPrevents(true), false);
      const was = SIM.CAMP_BAR_PREVENT;
      try {
        SIM.CAMP_BAR_PREVENT = false;
        const a = [templateBar(s, { camp: true }), templateBar(s, { camp: false })];
        SIM.CAMP_BAR_PREVENT = true;
        assert.deepEqual([templateBar(s, { camp: true }), templateBar(s, { camp: false })], a, cls);
      } finally { SIM.CAMP_BAR_PREVENT = was; }
    }
  });

  test('preventedRounds from the spell data: chill × (CHILL_PCT + Deep Chill), control × CAMP_CC_SHARE, silence × CAMP_SILENCE_SHARE', () => {
    const s = newRunFor({ classId: 'mage', seed: 1 });
    R.stepInPlace(s, { type: 'START_RUN' });
    s.player.talents.m_b3 = 2;
    assert.ok(Math.abs(preventedRounds(s, 'frost_lance') - 2 * (C.CHILL_PCT + 2 * C.TALENT.m_b3.chill)) < 1e-9);
    assert.ok(Math.abs(preventedRounds(s, 'rime_burst') - SIM.CAMP_CC_SHARE) < 1e-9);
    assert.ok(Math.abs(preventedRounds(s, 'spellsnap') - 2 * SIM.CAMP_SILENCE_SHARE) < 1e-9);
    assert.equal(preventedRounds(s, 'ember_bolt'), 0);
    // Temple Blow at FINISHER_CP 4: stunBase 1 + 2 = 3 (stunMax 3)
    assert.ok(Math.abs(preventedRounds(s, 'temple_blow') - 3 * SIM.CAMP_CC_SHARE) < 1e-9);
  });

  test('Frost Lance at 2.4.1\'s +10 % (the threshold of Verdict 6): off the raw Camp bar at hero 14, kept on the new one', () => {
    mage14(() => {
      // +10 % over rules.md (1.54 / 0.84) in place of the switch's +15 %
      withSpell('frost_lance', { l: 1.694, p: 0.924 }, () => {
        const b = campBars('mage', 14);
        assert.ok(!b.raw.includes('frost_lance'), `raw: ${b.raw.join(',')}`);
        assert.ok(b.raw.includes('living_flame'));
        assert.ok(b.prevent.includes('frost_lance'), `prevent: ${b.prevent.join(',')}`);
      });
    });
  });

  test('stable fill: a fill spell within BAR_TIE_BAND of the earlier-learned one does not take its slot', () => {
    mage14((b0) => {
      const lf = C.SPELL.living_flame.dot;
      // Living Flame's DoT scaled so its value is 4 % above, then 4 % below, Frost Lance's: Frost Lance (learned first) keeps the slot
      for (const r of [1.04, 0.96]) {
        const k = (r * b0.values.frost_lance) / b0.values.living_flame;
        withSpell('living_flame', { dot: { ...lf, b: lf.b * k, l: lf.l * k, p: lf.p * k } }, () => {
          const b = campBars('mage', 14);
          assert.ok(Math.abs(b.values.living_flame / b.values.frost_lance - r) < 0.01, JSON.stringify(b.values));
          assert.ok(b.prevent.includes('frost_lance') && !b.prevent.includes('living_flame'), `${r}: ${b.prevent.join(',')}`);
        });
      }
      // well past the band (+20 %) the better spell takes it
      const k = (1.2 * b0.values.frost_lance) / b0.values.living_flame;
      withSpell('living_flame', { dot: { ...lf, b: lf.b * k, l: lf.l * k, p: lf.p * k } }, () => {
        const b = campBars('mage', 14);
        assert.ok(b.prevent.includes('living_flame'), b.prevent.join(','));
      });
    });
  });

  test('the AoE step stays on damage: Cinder Storm, not Rime Burst, on the Mage\'s Camp bar from hero 10', () => {
    setGates(ON);
    try {
      for (const H of [10, 14, 18, 22]) {
        const b = campBars('mage', H);
        assert.ok(b.prevent.includes('cinder_storm') && !b.prevent.includes('rime_burst'), `H${H}: ${b.prevent.join(',')}`);
        assert.ok(b.values.rime_burst > b.values.cinder_storm, 'Rime Burst values higher with its freeze, yet the AoE slot is by damage');
      }
    } finally { setGates(null); }
  });

  test('the measured hero levels: the new template gives the same Camp bars as the raw one (6, 10, 14, 18, 22)', () => {
    for (const cls of ['rogue', 'mage', 'hunter']) for (const H of [6, 10, 14, 18, 22]) {
      const b = campBars(cls, H);
      assert.deepEqual(b.prevent, b.raw, `${cls} H${H}`);
    }
  });
});
