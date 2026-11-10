// M2 v5 simulator changes (docs/specs/changes-m2-v5.md row 1, balance.md 1.3 "Default tree" and "B5 fallback"):
// the switch rule with TREE_SWITCH_Z, the recorded incumbents per profile group, the B5 fallback's best point
// estimate; and the bar-template follow-up (changes-m2-v5.md Notes): a finisher's template damage scales only its
// per-combo-point part, so a high weapon damage no longer moves Severing Flourish ahead of Open Vein on the boss bar.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, newRunFor } from '../../sim/lib/engine.mjs';
import { BAL, SIM } from '../../sim/lib/params.mjs';
import { treeSwitch, bestPointTree, defaultTrees, profileGroup } from '../../sim/lib/trees.mjs';
import { templateBar, spellValue } from '../../sim/lib/policy.mjs';

/** byTree from win rates (and optional reach-boss rates), n runs per tree. */
const cells = (wins, n = 2000, boss = [0.5, 0.5, 0.5]) => wins.map((p, t) => ({ win: { p, n, k: Math.round(p * n) }, boss: { p: boss[t] } }));

describe('default tree per profile group (balance.md 1.3, M2 v5)', () => {
  test('TREE_SWITCH_Z and the recorded incumbents', () => {
    assert.equal(BAL.TREE_SWITCH_Z, 1.96);
    assert.deepEqual(SIM.DEFAULT_TREE, { rogue: 2, mage: 2, hunter: 1 });
    assert.deepEqual(SIM.DEFAULT_TREE_PALL, { rogue: 1, mage: 2, hunter: 0 });
    assert.deepEqual(defaultTrees('P0'), SIM.DEFAULT_TREE);
    assert.deepEqual(defaultTrees('PALL'), SIM.DEFAULT_TREE_PALL);
    for (const p of ['fresh', 'p0', 'meta10', 'p10']) assert.equal(profileGroup(p), 'P0', p);
    for (const p of ['all', 'pall', 'PALL']) assert.equal(profileGroup(p), 'PALL', p);
  });

  test('11-10b rogue: Shadowcraft 25.0 % does not replace Venomcraft 23.1 % (the switch needs 2.65 pp)', () => {
    const r = treeSwitch(cells([0.154, 0.250, 0.231]), 2);
    assert.equal(r.tree, 2);
    assert.equal(r.switched, false);
    assert.equal(r.best.tree, 1);
    assert.ok(Math.abs(r.best.gap - 0.019) < 1e-9);
    assert.ok(Math.abs(r.best.threshold - 0.0265) < 0.0002, `threshold ${r.best.threshold}`);
    assert.equal(r.rows.find((x) => x.tree === 0).clears, false);
  });

  test('a challenger beyond the threshold replaces the incumbent (package PALL hunter: Beastbond 65.2 % vs Marksmanship 54.1 %)', () => {
    const r = treeSwitch(cells([0.652, 0.541, 0.389]), 1);
    assert.equal(r.tree, 0);
    assert.equal(r.switched, true);
    assert.ok(Math.abs(r.best.threshold - 0.0303) < 0.0005, `threshold ${r.best.threshold}`);
    // The incumbent of the next pass keeps its tree against the same numbers.
    assert.equal(treeSwitch(cells([0.652, 0.541, 0.389]), 0).tree, 0);
  });

  test('several challengers clear: the highest win rate wins; equal rates: the higher reach-the-boss rate', () => {
    assert.equal(treeSwitch(cells([0.30, 0.34, 0.20]), 2).tree, 1);
    const tie = treeSwitch(cells([0.34, 0.34, 0.20], 2000, [0.6, 0.7, 0.5]), 2);
    assert.equal(tie.tree, 1);
    assert.equal(tie.best.tree, 1);
    // No challenger clears: the incumbent stays even when it is not the best point estimate.
    assert.equal(treeSwitch(cells([0.24, 0.25, 0.23]), 2).tree, 2);
  });

  test('the threshold follows the cell sizes (half the runs: a wider interval)', () => {
    const big = treeSwitch(cells([0.23, 0.26, 0.20], 2000), 0);
    const small = treeSwitch(cells([0.23, 0.26, 0.20], 1000), 0);
    assert.ok(small.best.threshold > big.best.threshold);
    assert.equal(big.tree, 1);
    assert.equal(small.tree, 0);
  });

  test('B5 fallback tree: the best point estimate, no incumbent rule; ties by reach-the-boss rate', () => {
    assert.equal(bestPointTree(cells([0.154, 0.250, 0.231])), 1);
    assert.equal(bestPointTree(cells([0.25, 0.25, 0.20], 2000, [0.5, 0.8, 0.9])), 1);
    assert.equal(bestPointTree(cells([0.20, 0.20, 0.20], 2000, [0.5, 0.5, 0.5])), 0);
  });
});

describe('bar template: finisher damage at 4 combo points (balance.md 1.2; changes-m2-v5.md Notes)', () => {
  /** A level-60 rogue knowing every class spell at tl 60, with power and weapon damage set. */
  function rogue60(power, wd) {
    const s = newRunFor({ classId: 'rogue', petId: null, seed: 3 });
    R.stepInPlace(s, { type: 'START_RUN' });
    s.player.level = 60;
    for (const sp of Object.values(R.C.SPELL)) {
      if (sp.cls !== 'rogue' || sp.source !== 'class') continue;
      s.player.spells[sp.id] = { tl: 60, rank: 1 };
      if (!s.player.spellOrder.includes(sp.id)) s.player.spellOrder.push(sp.id);
    }
    s.player.d.power = power;
    s.player.d.wd = wd;
    return s;
  }

  test('Severing Flourish is valued (4 + tl + 0.30P) × 4 + 0.5WD: the weapon term once per cast, as the engine deals it', () => {
    for (const [power, wd] of [[20, 3], [150, 80], [250, 191]]) {
      const s = rogue60(power, wd);
      const exact = (4 + 60 + 0.30 * power) * 4 + 0.5 * wd;
      assert.ok(Math.abs(spellValue(s, 'severing_flourish', true) - exact) <= 2, `power ${power} wd ${wd}: ${spellValue(s, 'severing_flourish', true)} vs ${exact}`);
    }
  });

  test('the rogue boss bar keeps Open Vein ahead of Severing Flourish at any weapon damage up to 400 (Starforged epic: 191)', () => {
    for (const power of [20, 150, 250, 350]) {
      for (const wd of [40, 150, 191, 300, 400]) {
        const bar = templateBar(rogue60(power, wd), { camp: true });
        const ov = bar.indexOf('open_vein');
        const sf = bar.indexOf('severing_flourish');
        assert.ok(ov >= 0, `power ${power} wd ${wd}: Open Vein on the boss bar (${bar.join(',')})`);
        assert.ok(sf < 0 || ov < sf, `power ${power} wd ${wd}: Open Vein before Severing Flourish (${bar.join(',')})`);
      }
    }
  });

  test('the normal bar is unchanged in kind: Severing Flourish is the finisher step, ahead of Open Vein', () => {
    for (const wd of [10, 191]) {
      const bar = templateBar(rogue60(150, wd), { camp: false });
      const sf = bar.indexOf('severing_flourish');
      const ov = bar.indexOf('open_vein');
      assert.ok(sf >= 0 && (ov < 0 || sf < ov), `wd ${wd}: ${bar.join(',')}`);
    }
  });
});
