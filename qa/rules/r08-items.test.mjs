// QA rule tests, rules.md section 8: the rarity weights of every drop source (qa/engine/ checks normal mobs
// and boss/elite floors), slot spread, the item chance of dungeon trash and the grind multiplier, and the
// autoplay discard rule of 8.7.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, started, tweak, cloneState } from './helpers.mjs';
import { rollDrop, sellValue } from '../../src/engine/items.js';
import { makeRng } from '../../src/rng.js';

function rolls(table, n, { level = 30, dropMult = 1, seed = 5 } = {}) {
  const s = cloneState(started('hunter', { seed }));
  const g = makeRng(seed * 7919 + 13);
  const out = [];
  for (let i = 0; i < n; i++) out.push(...rollDrop(s, g, table, level, 1, dropMult));
  return out;
}
const share = (items, pred) => items.filter(pred).length / Math.max(1, items.length);
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(3)} vs ${want} (±${tol})`);

describe('rules 8.4 drop tables (QA additions)', () => {
  test('rarity weights C / U / R / E of every source follow the table', () => {
    const tables = {
      trash: [30, 50, 18, 2], elite: [0, 40, 55, 5], rare: [0, 0, 75, 25], dboss: [0, 0, 85, 15],
      quest: [0, 80, 20, 0], story: [0, 0, 100, 0], treasure: [0, 70, 27, 3], vendor: [0, 60, 40, 0],
    };
    for (const [table, w] of Object.entries(tables)) {
      assert.ok(C.DROP_TABLE[table], `table ${table}`);
      assert.deepEqual(C.DROP_TABLE[table].weights, w, `${table} weights`);
      const gear = rolls(table, 4000).filter((x) => x.kind === 'gear');
      const tot = w.reduce((a, b) => a + b, 0);
      ['common', 'uncommon', 'rare', 'epic'].forEach((r, i) => {
        const got = share(gear, (x) => x.rarity === r);
        if (w[i] === 0) assert.equal(got, 0, `${table}: no ${r}`);
        else near(got, w[i] / tot, 0.03, `${table} ${r}`);
      });
    }
  });

  test('item chance: dungeon trash DUNGEON_ITEM_CHANCE; grind waves × GRIND_DROP_MULT; slots uniform over the 10 slots', () => {
    const N = 8000;
    near(rolls('trash', N).filter((x) => x.kind === 'gear').length / N, C.DUNGEON_ITEM_CHANCE, 0.015, 'trash item chance');
    const g = rolls('mob', N, { dropMult: C.GRIND_DROP_MULT });
    near(g.filter((x) => x.kind === 'gear').length / N, C.MOB_ITEM_CHANCE * C.GRIND_DROP_MULT, 0.015, 'grind item chance');
    near(g.filter((x) => x.kind === 'junk').length / N, Math.min(1, C.MOB_JUNK_CHANCE * C.GRIND_DROP_MULT), 0.02, 'grind junk chance');
    const gear = rolls('treasure', 6000).filter((x) => x.kind === 'gear');
    for (const slot of C.SLOT_IDS) near(share(gear, (x) => x.slot === slot), 1 / C.SLOT_IDS.length, 0.02, `slot ${slot}`);
  });
});

describe('rules 8.7 bags (QA additions)', () => {
  test('8.7 when a drop does not fit, autoplay discards the lowest sell-value non-consumable, junk first', () => {
    const fill = (x, junk) => {
      x.player.bag = [];
      for (let i = 0; i < C.BAG_SLOTS; i++) {
        if (junk && i === 5) x.player.bag.push({ uid: `j${i}`, kind: 'junk', name: 'Junk', level: 30, qty: 1 });
        else x.player.bag.push({ uid: `g${i}`, kind: 'gear', slot: 'ring', rarity: 'uncommon', ilvl: 10 + i, name: `R${i}`, stats: { AGI: 1, INT: 0, STA: 0, SPI: 0 }, power: 0, crit: 0, armor: 0, bonusArmor: 0, wd: 0, affix: null, unique: null, effect: null });
      }
      x.loot = [{ uid: 'L', kind: 'gear', slot: 'ring', rarity: 'uncommon', ilvl: 30, name: 'New', stats: { AGI: 1, INT: 0, STA: 0, SPI: 0 }, power: 0, crit: 0, armor: 0, bonusArmor: 0, wd: 0, affix: null, unique: null, effect: null }];
      x.player.equipped.ring = { ...x.loot[0], uid: 'eq', stats: { AGI: 50, INT: 0, STA: 0, SPI: 0 } };
    };
    const base = R.step(started('rogue', { seed: 6 }), { type: 'LEAVE_HUB' }).state;
    const withJunk = tweak(base, (x) => fill(x, true));
    assert.deepEqual(R.autoAction(withJunk), { type: 'DISCARD', itemId: 'j5' }, 'junk goes first');
    const noJunk = tweak(base, (x) => fill(x, false));
    const a = R.autoAction(noJunk);
    const cands = [...noJunk.player.bag, ...noJunk.loot].sort((p, q) => sellValue(noJunk, p) - sellValue(noJunk, q));
    assert.equal(a.itemId, cands[0].uid, `discards the cheapest (${a.type} ${a.itemId})`);
    assert.equal(a.type, cands[0].uid === 'L' ? 'LOOT_DROP' : 'DISCARD');
  });
});
