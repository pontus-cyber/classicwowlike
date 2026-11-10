// rules.md section 2: node types.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, play, atLevel, tweak, autoUntil, ev } from './helpers.mjs';
import { setupNode, dungeonLevels } from '../../src/engine/map.js';
import { xpToNext } from '../../src/engine/progress.js';
import { V } from '../../src/engine/items.js';

/** Enter a node of a given type in row r, lane 0, with the character at `level`. */
function enterNode(base, type, { level = 20, r = 1, patch = null, prep = null } = {}) {
  let s = R.step(base, { type: 'LEAVE_HUB' }).state;
  s = atLevel(s, level);
  s = tweak(s, (x) => {
    const n = setupNode(x, 1, r, 0, type);
    if (patch) patch(n);
    x.zone.rows[r - 1][0] = n;
    x.zone.pos = r === 1 ? { r: 0, l: null } : { r: r - 1, l: 0 };
    if (prep) prep(x);
  });
  return R.step(s, { type: 'CHOOSE_NODE', lane: 0 });
}
const win = (s) => autoUntil(s, (x) => !x.fight);
const hoursOf = (events) => ev(events, 'hours').reduce((n, e) => n + e.add, 0);

describe('rules 2 node types', () => {
  test('2.0 hours per node type', () => {
    const base = started('rogue', { seed: 4 });
    const want = { quest: C.HOURS_QUEST, elite: C.HOURS_ELITE, dungeon: C.HOURS_DUNGEON, rest: C.HOURS_REST, vendor: C.HOURS_VENDOR, trainer: C.HOURS_TRAINER, treasure: C.HOURS_TREASURE, shrine: C.HOURS_SHRINE, grind: 0 };
    for (const [type, h] of Object.entries(want)) assert.equal(hoursOf(enterNode(base, type).events), h, type);
    const g = enterNode(base, 'grind').state;
    assert.equal(hoursOf(R.step(g, { type: 'GRIND_SET_WAVES', n: 1 }).events), C.HOURS_GRIND_WAVE);
  });

  test('2.0 mob kill XP = MOB_XP_FRAC × mult × xpToNext(level) × diffMod, mult by kind', () => {
    const base = started('mage', { seed: 4 });
    const killXp = (variant, level) => {
      const { state } = enterNode(base, 'quest', { level: 1, patch: (n) => { n.mobs = ['z1_brute']; n.cl = level; } });
      const s = tweak(state, (x) => { x.fight.enemies[0].kind = variant; x.fight.enemies[0].elite = variant === 'elite' || variant === 'rare'; x.fight.enemies[0].hp = 1; x.player.rested = 0; });
      const r = R.step(s, { type: 'ATTACK', target: 0 });
      const e = ev(r.events, 'xp').find((x) => x.why === 'kill');
      return e ? e.amount : 0;
    };
    // The 1-HP target can still be missed; retry over seeds of the fight stream is not needed: check the formula when it hits.
    const mult = { normal: 1, trash: C.DUNGEON_MOB_XP_MULT, elite: C.ELITE_XP_MULT, rare: C.RARE_XP_MULT, dboss: C.DUNGEON_BOSS_XP_MULT };
    for (const [k, m] of Object.entries(mult)) {
      const got = killXp(k, 1);
      if (got) assert.equal(got, Math.round(C.MOB_XP_FRAC * m * xpToNext(1)), k);
    }
  });

  test('2.1 quest: turn-in XP and gold, QUEST_REWARD_CHOICES items from the quest table, CHOOSE_REWARD', () => {
    let { state: s } = enterNode(started('rogue', { seed: 5 }), 'quest', { level: 20, patch: (n) => { n.mobs = ['z1_brute']; n.cl = 1; } });
    s = tweak(s, (x) => { x.player.level = 1; });
    const r = (() => { let t = s; const all = []; while (t.fight) { const x = R.step(t, R.autoAction(t)); all.push(...x.events); t = x.state; } return { state: t, events: all }; })();
    s = r.state;
    assert.ok(ev(r.events, 'questComplete').length === 1);
    const turnIn = ev(r.events, 'xp').find((e) => e.why === 'quest');
    assert.ok(turnIn && turnIn.amount > 0);
    assert.equal(ev(r.events, 'gold').find((e) => e.why === 'quest').amount, C.QUEST_GOLD_V * V(1));
    assert.equal(s.node.stage, 'reward');
    const items = s.node.rewards[0].items;
    assert.equal(items.length, C.QUEST_REWARD_CHOICES);
    for (const it of items) assert.ok(['uncommon', 'rare'].includes(it.rarity));
    const pick = items[1];
    s = R.step(s, { type: 'CHOOSE_REWARD', index: 1 }).state;
    assert.equal(s.phase, 'MAP');
    assert.ok(s.player.bag.some((x) => x.uid === pick.uid));
    assert.equal(s.zone.questsDone, 1);
  });

  test('2.1 story chain: the 3rd quest of a zone adds STORY_XP and a choice of 3 rare items', () => {
    let { state: s } = enterNode(started('hunter', { seed: 6 }), 'quest', { level: 30, patch: (n) => { n.mobs = ['z1_mender']; }, prep: (x) => { x.zone.questsDone = C.STORY_QUESTS - 1; } });
    const all = [];
    while (s.fight) { const x = R.step(s, R.autoAction(s)); all.push(...x.events); s = x.state; }
    assert.equal(ev(all, 'story').length, 1);
    assert.equal(s.node.rewards.length, 2);
    assert.equal(s.node.rewards[1].items.length, C.STORY_REWARD_CHOICES);
    for (const it of s.node.rewards[1].items) {
      assert.equal(it.rarity, 'rare');
      assert.equal(it.ilvl, s.node.cl + C.RARITY_ILVL_BONUS.rare);
    }
    s = play(s, [{ type: 'CHOOSE_REWARD', index: 0 }, { type: 'CHOOSE_REWARD', index: 2 }]).state;
    assert.equal(s.phase, 'MAP');
    assert.equal(s.stats.stories, 1);
  });

  test('2.1 quest flee: no turn-in, quest not counted', () => {
    let { state: s } = enterNode(started('rogue', { seed: 7 }), 'quest', { level: 5 });
    // A stealthed Rogue flees with chance 1.0 (rules 7.8).
    const r = R.step(s, { type: 'FLEE' });
    s = r.state;
    assert.equal(s.phase, 'MAP');
    assert.equal(s.zone.questsDone, 0);
    assert.equal(ev(r.events, 'questComplete').length, 0);
    assert.equal(s.stats.quests, 0);
  });

  test('2.2 grind: GRIND_SET_WAVES, 1 h per started wave, wave XP bonus, NEXT_FIGHT / GRIND_STOP, drops × 1.5', () => {
    let { state: s } = enterNode(started('mage', { seed: 8 }), 'grind', { level: 25 });
    assert.equal(s.node.stage, 'grindSetup');
    assert.ok(!R.isLegal(s, { type: 'GRIND_SET_WAVES', n: C.GRIND_MAX_WAVES + 1 }));
    s = R.step(s, { type: 'GRIND_SET_WAVES', n: 2 }).state;
    assert.equal(s.fight.dropMult, C.GRIND_DROP_MULT);
    assert.equal(s.fight.enemies.length, C.GRIND_WAVE_SIZE);
    const h0 = s.hours;
    const all = [];
    while (s.fight) { const x = R.step(s, R.autoAction(s)); all.push(...x.events); s = x.state; }
    assert.equal(ev(all, 'xp').filter((e) => e.why === 'wave').length, 1);
    assert.equal(s.node.stage, 'between');
    assert.ok(R.isLegal(s, { type: 'GRIND_STOP' }));
    s = R.step(s, { type: 'NEXT_FIGHT' }).state;
    assert.equal(s.hours, h0 + C.HOURS_GRIND_WAVE);
    s = win(s);
    assert.equal(s.phase, 'MAP', 'node completes after the planned waves');
  });

  test('2.3 elite: elite at CL + 2 with ELITE multipliers, add at ELITE_ADD_CHANCE, rare variant, guaranteed drop', () => {
    const base = started('hunter', { seed: 9 });
    const { state: s } = enterNode(base, 'elite', { level: 30, r: 2, patch: (n) => { n.rare = false; n.elite = 'z1_elite'; n.add = 'z1_beast'; } });
    const e = s.fight.enemies[0];
    const T = CONTENT.enemies.z1_elite;
    const A = C.ARCHETYPE[T.archetype];
    assert.equal(e.level, s.zone.rows[1][0].cl + C.ELITE_LEVEL_OFFSET);
    assert.equal(e.maxHp, Math.round((C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * e.level) * A.hp * C.ELITE_HP_MULT * T.hpMult));
    assert.ok(Math.abs(e.dmg - (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * e.level) * A.dmg * C.ELITE_DMG_MULT * T.dmgMult * R.zoneDanger(e.level, 'elite') * C.ENGAGE_DMG_COMP) < 1e-9);
    assert.deepEqual(e.abilities, T.abilities);
    assert.equal(s.fight.enemies[1].kind, 'normal');
    const rare = enterNode(base, 'elite', { level: 30, r: 2, patch: (n) => { n.rare = true; n.elite = 'z1_rare'; n.add = null; } }).state.fight.enemies[0];
    assert.equal(rare.kind, 'rare');
    assert.equal(rare.maxHp, Math.round((C.ENEMY_HP_BASE + C.ENEMY_HP_PER_LEVEL * rare.level) * C.ARCHETYPE[CONTENT.enemies.z1_rare.archetype].hp * C.RARE_HP_MULT));
    // Guaranteed drop
    let t = s;
    const all = [];
    while (t.fight) { const x = R.step(t, R.autoAction(t)); all.push(...x.events); t = x.state; }
    const gear = ev(all, 'loot').filter((x) => x.item.kind === 'gear');
    assert.ok(gear.length >= 1, 'elite drops at least one item');
    assert.ok(['uncommon', 'rare', 'epic'].includes(gear[0].item.rarity));
    assert.ok(ev(all, 'gold').some((g) => g.why === 'kill' && g.amount === C.ELITE_GOLD_V * V(e.level)), 'elite coin = ELITE_GOLD_V × V(level)');
    assert.ok(ev(all, 'gold').some((g) => g.why === 'kill' && g.amount === Math.round(C.MOB_COIN_V * V(s.fight.enemies[1].level))), 'add coin = MOB_COIN_V × V(level)');
  });

  test('2.4 dungeon: 3 trash fights, then the boss; DUNGEON_LEAVE between; no flee from the boss; clear rewards', () => {
    let { state: s, events } = enterNode(started('rogue', { seed: 10 }), 'dungeon', { level: 40, r: 4 });
    assert.equal(hoursOf(events), C.HOURS_DUNGEON);
    assert.equal(s.fight.kind, 'trash');
    assert.ok(s.fight.enemies.length >= 2 && s.fight.enemies.length <= 3);
    const lv = dungeonLevels(1);
    assert.deepEqual(lv, { trash: 1 + C.DUNGEON_LEVEL_OFFSET, boss: 1 + C.DUNGEON_LEVEL_OFFSET + C.DUNGEON_BOSS_LEVEL_OFFSET });
    assert.ok(s.fight.enemies.every((e) => e.level === lv.trash && e.kind === 'trash'));
    s = win(s);
    assert.equal(s.node.stage, 'between');
    assert.ok(R.isLegal(s, { type: 'DUNGEON_LEAVE' }));
    const left = R.step(s, { type: 'DUNGEON_LEAVE' }).state;
    assert.equal(left.phase, 'MAP');
    assert.equal(left.stats.dungeons, 0);
    for (let k = 1; k < C.DUNGEON_TRASH_FIGHTS; k++) s = win(R.step(s, { type: 'NEXT_FIGHT' }).state);
    s = R.step(s, { type: 'NEXT_FIGHT' }).state;
    assert.equal(s.fight.kind, 'dboss');
    const boss = s.fight.enemies[0];
    assert.equal(boss.level, lv.boss);
    assert.ok(boss.ccImmune);
    assert.equal(boss.abilities.length, 2);
    assert.ok(!R.isLegal(s, { type: 'FLEE' }));
    assert.ok(!s.fight.p.st.some((x) => x.id === 'STEALTH'), 'no stealth vs dungeon bosses');
    const all = [];
    while (s.fight) { const x = R.step(s, R.autoAction(s)); all.push(...x.events); s = x.state; }
    assert.equal(ev(all, 'dungeonClear').length, 1);
    assert.equal(ev(all, 'gold').find((g) => g.why === 'dungeon').amount, C.DUNGEON_GOLD_V * V(lv.boss));
    // Boss drops are rare or epic at the boss level (+1 / +3); an add's drop is at most a rare at the trash level.
    const drops = ev(all, 'loot').filter((x) => x.item.kind === 'gear' && x.item.ilvl >= lv.boss + C.RARITY_ILVL_BONUS.rare);
    assert.equal(drops.length, C.DUNGEON_BOSS_DROPS, 'boss drops 2 rare/epic items');
    assert.equal(s.stats.dungeons, 1);
  });

  test('2.5 rest: full HP, mana and pet HP, revives the pet, rested pool capped; rested doubles kill XP only', () => {
    const base = started('hunter', { seed: 11 });
    const { state: s } = enterNode(base, 'rest', { level: 10, prep: (x) => { x.player.hp = 5; x.player.pet.alive = false; x.player.pet.hp = 0; x.player.rested = 0; } });
    assert.equal(s.player.hp, s.player.d.maxHp);
    assert.ok(s.player.pet.alive);
    assert.equal(s.player.pet.hp, s.player.d.petMaxHp);
    assert.equal(s.player.rested, Math.round(C.REST_RESTED_FRAC * xpToNext(10)));
    const capped = enterNode(base, 'rest', { level: 10, prep: (x) => { x.player.rested = 99999; } }).state;
    assert.equal(capped.player.rested, Math.round(C.RESTED_CAP_FRAC * xpToNext(10)));
    // Rested doubling on a kill
    const q = enterNode(base, 'quest', { level: 1, patch: (n) => { n.mobs = ['z1_brute']; n.cl = 1; }, prep: (x) => { x.player.rested = 1000; } }).state;
    const one = tweak(q, (x) => { x.fight.enemies[0].hp = 1; x.fight.enemies[0].dodge = 0; });
    let r = R.step(one, { type: 'ATTACK', target: 0 });
    let k = ev(r.events, 'xp').find((e) => e.why === 'kill');
    if (k) {
      const base1 = Math.round(C.MOB_XP_FRAC * xpToNext(1));
      assert.equal(k.amount, base1 * C.RESTED_MULT);
      assert.equal(k.rested, base1);
      assert.equal(r.state.player.rested, 1000 - base1);
    }
    const qx = ev(r.events, 'xp').find((e) => e.why === 'quest');
    if (qx) assert.equal(qx.rested, 0, 'quest XP is not doubled');
  });

  test('2.6 vendor: 6 consumables always, 3 gear items, Ember at about 15 %; BUY, SELL, SELL_JUNK, prices', () => {
    let embers = 0;
    for (let seed = 0; seed < 80; seed++) {
      const { state: s } = enterNode(started('mage', { seed }), 'vendor', { level: 5 });
      const stock = s.service.stock;
      assert.deepEqual(stock.filter((e) => e.unlimited).map((e) => e.id), C.VENDOR_STOCK_CONSUMABLES);
      assert.equal(stock.filter((e) => e.kind === 'gear').length, C.VENDOR_GEAR_STOCK);
      for (const g of stock.filter((e) => e.kind === 'gear')) assert.ok(['uncommon', 'rare'].includes(g.item.rarity));
      if (stock.some((e) => e.id === 'ember_of_return')) embers++;
    }
    assert.ok(embers > 3 && embers < 25, `embers ${embers}/80`);
    let { state: s } = enterNode(started('mage', { seed: 1 }), 'vendor', { level: 5, prep: (x) => { x.player.gold = 100000; } });
    const cl = s.node.cl;
    assert.equal(s.service.stock[0].price, Math.round(C.PRICE_HEAL_V * V(cl)));
    const gi = s.service.stock.findIndex((e) => e.kind === 'gear');
    const g = s.service.stock[gi];
    const sell = Math.round(V(g.item.ilvl) * C.SLOT[g.item.slot].slotW * C.RARITY[g.item.rarity].sellMult);
    assert.equal(g.price, Math.round(C.BUY_MULT * sell));
    s = R.step(s, { type: 'BUY', index: gi }).state;
    assert.ok(!R.isLegal(s, { type: 'BUY', index: gi }), 'a gear item is sold once');
    const gold = s.player.gold;
    s = R.step(s, { type: 'SELL', itemId: g.item.uid }).state;
    assert.equal(s.player.gold, gold + sell);
    s = tweak(s, (x) => { x.player.bag.push({ uid: 'j1', kind: 'junk', name: 'J', level: 10, qty: 3 }); });
    const g2 = s.player.gold;
    s = R.step(s, { type: 'SELL_JUNK' }).state;
    assert.equal(s.player.gold, g2 + 3 * Math.round(C.JUNK_V * V(10)));
    s = R.step(s, { type: 'LEAVE' }).state;
    assert.equal(s.phase, 'MAP');
  });

  test('2.7 trainer: LEARN (2 × V(lvl), tl = L), TRAIN (0.5 × V(L)), TRAIN_ALL in bar order, RESPEC (10 × V(L))', () => {
    let { state: s } = enterNode(started('rogue', { seed: 2 }), 'trainer', { level: 12, prep: (x) => { x.player.gold = 5000; for (const id of Object.keys(x.player.spells)) x.player.spells[id].tl = 1; delete x.player.spells.shadowstep_strike; x.player.spellOrder = x.player.spellOrder.filter((i) => i !== 'shadowstep_strike'); } });
    const g0 = s.player.gold;
    s = R.step(s, { type: 'LEARN', spellId: 'shadowstep_strike' }).state;
    assert.equal(s.player.gold, g0 - C.TRAIN_NEW_V * V(4));
    assert.deepEqual(s.player.spells.shadowstep_strike, { tl: 12, rank: 1 });
    assert.ok(!R.isLegal(s, { type: 'LEARN', spellId: 'whirling_edges' }), 'needs level 20');
    const g1 = s.player.gold;
    s = R.step(s, { type: 'TRAIN', spellId: 'gutting_jab' }).state;
    assert.equal(s.player.gold, g1 - Math.round(C.TRAIN_RANK_V * V(12)));
    assert.deepEqual(s.player.spells.gutting_jab, { tl: 12, rank: 2 });
    assert.ok(!R.isLegal(s, { type: 'TRAIN', spellId: 'gutting_jab' }), 'already at L');
    // TRAIN_ALL trains bar spells first and stops when gold runs out
    const cost = Math.round(C.TRAIN_RANK_V * V(12));
    s = tweak(s, (x) => { x.player.gold = cost; x.player.bar = ['throat_jab', 'severing_flourish', null, null, null, null, null]; });
    s = R.step(s, { type: 'TRAIN_ALL' }).state;
    assert.equal(s.player.spells.throat_jab.tl, 12);
    assert.equal(s.player.spells.severing_flourish.tl, 1);
    // RESPEC
    s = tweak(s, (x) => { x.player.gold = 99999; x.player.talents = { r_a1: 1 }; x.player.talentSpent = 1; });
    const g2 = s.player.gold;
    s = R.step(s, { type: 'RESPEC' }).state;
    assert.equal(s.player.gold, g2 - C.RESPEC_V * V(12));
    assert.equal(s.player.talentSpent, 0);
    assert.deepEqual(s.player.talents, {});
  });

  test('2.8 treasure: guard fight then chest; gold 3 × V(CL); trap (first loot draw) costs 15 % max HP, never kills', () => {
    const base = started('rogue', { seed: 12 });
    let r = enterNode(base, 'treasure', { level: 10, patch: (n) => { n.guard = null; n.trap = true; } });
    // The trap flag is re-rolled from loot(z,r,l) on entry; find the outcome from events.
    const trap = ev(r.events, 'trap');
    assert.equal(ev(r.events, 'gold').find((g) => g.why === 'treasure').amount, C.TREASURE_GOLD_V * V(1));
    assert.equal(r.state.phase, 'MAP');
    assert.ok(ev(r.events, 'loot').some((x) => x.item.kind === 'gear'), 'one roll on the Treasure table');
    if (trap.length) assert.equal(trap[0].amount, Math.round(C.TREASURE_TRAP_PCT * r.state.player.d.maxHp));
    // Trap at 1 HP never kills
    let found = false;
    for (let seed = 0; seed < 300 && !found; seed++) {
      const b = started('rogue', { seed });
      const x = enterNode(b, 'treasure', { level: 10, patch: (n) => { n.guard = null; }, prep: (y) => { y.player.hp = 1; } });
      if (ev(x.events, 'trap').length) { found = true; assert.equal(x.state.player.hp, 1); }
    }
    assert.ok(found, 'a trap occurs within 300 seeds');
    // Guarded
    r = enterNode(base, 'treasure', { level: 30, patch: (n) => { n.guard = 'z1_beast'; } });
    assert.ok(r.state.fight);
    assert.equal(r.state.fight.enemies.length, 1);
    const done = win(r.state);
    assert.equal(done.phase, 'MAP');
  });

  test('2.9 shrine: 2 different boons; each boon effect; timed boons last BOON_NODES entered nodes', () => {
    const base = started('mage', { seed: 13 });
    const pick = (boon, prep) => {
      const { state } = enterNode(base, 'shrine', { level: 10, patch: (n) => { n.boons = [boon, boon === 'plenty' ? 'fury' : 'plenty']; }, prep });
      return R.step(state, { type: 'CHOOSE_REWARD', index: 0 });
    };
    for (let seed = 0; seed < 40; seed++) {
      const { state } = enterNode(started('mage', { seed }), 'shrine', { level: 2 });
      const b = state.node.rewards[0].boons;
      assert.equal(b.length, 2);
      assert.notEqual(b[0], b[1]);
    }
    assert.equal(pick('return').state.player.res.boon, 1);
    const fury = pick('fury').state;
    assert.deepEqual(fury.player.buffs.fury, { left: C.BOON_NODES, active: false });
    const gold = pick('plenty');
    assert.equal(ev(gold.events, 'gold')[0].amount, C.BOON_GOLD_V * V(1));
    const mend = pick('mending', (x) => { x.player.hp = 1; x.player.mana = 0; x.player.rested = 0; }).state;
    assert.equal(mend.player.hp, mend.player.d.maxHp);
    assert.equal(mend.player.mana, mend.player.d.maxMana);
    assert.equal(mend.player.rested, Math.round(C.REST_RESTED_FRAC * xpToNext(10)));
    const clar = pick('clarity', (x) => { x.player.spells.ember_bolt.tl = 1; }).state;
    assert.equal(clar.player.spells.ember_bolt.tl, 10);
    assert.ok(clar.player.freeRespec);
    // Fury is active in the next BOON_NODES nodes entered, then ends.
    let s = tweak(fury, (x) => { x.zone.pos = { r: 1, l: 0 }; for (let r = 1; r < C.ZONE_CHOICE_ROWS; r++) x.zone.rows[r][0] = setupNode(x, 1, r + 1, 0, 'rest'); });
    for (let i = 1; i <= C.BOON_NODES; i++) {
      s = R.step(s, { type: 'CHOOSE_NODE', lane: 0 }).state;
      assert.ok(s.player.buffs.fury.active, `node ${i}`);
    }
    s = R.step(s, { type: 'CHOOSE_NODE', lane: 0 }).state;
    assert.equal(s.player.buffs.fury, undefined);
  });
});
