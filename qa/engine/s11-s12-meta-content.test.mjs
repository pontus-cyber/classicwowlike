// rules.md sections 11 (meta progression) and 12 (content ranges).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { R, C, CONTENT, started, atLevel, withSpells, inFight, tweak, forceDraws, st, cloneState, play } from './helpers.mjs';
import { echoes } from '../../src/engine/meta.js';
import { V } from '../../src/engine/items.js';
import * as STATS from '../../src/engine/stats.js';

const prof = (unlocks, extra = {}) => ({ ...R.newProfile(), unlocks, ...extra });
const mob = (tid = 'z1_brute', level = 20, variant = 'normal') => ({ tid, level, variant });

describe('rules 11 meta progression', () => {
  test('11.1 Echoes: one line per source, Oath multiplier on the total', () => {
    const facts = { classId: 'mage', level: 31, zonesLeft: 2, dungeons: 2, kills: { elite: 3, rare: 1 }, quests: 12, reachedBoss: false, bossPhase: 0, outcome: 'death', hoursAtBoss: null, oaths: [] };
    const e = echoes(facts, R.newProfile());
    assert.equal(e.total, 30 * C.ECHO_PER_LEVEL + 2 * C.ECHO_PER_ZONE + 2 * C.ECHO_PER_DUNGEON + 3 * C.ECHO_PER_ELITE + C.ECHO_PER_RARE + 12 * C.ECHO_PER_QUEST);
    const win = { ...facts, level: 60, zonesLeft: 6, reachedBoss: true, bossPhase: 3, outcome: 'victory', hoursAtBoss: 120, oaths: ['thrift', 'haste'] };
    const w = echoes(win, R.newProfile());
    const ids = w.lines.map((l) => l.id);
    for (const id of ['bossReached', 'bossPhases', 'bossKill', 'firstKill']) assert.ok(ids.includes(id), id);
    assert.ok(!ids.includes('speed'), 'Haste: par is 110 h');
    assert.equal(w.total, Math.round(w.base * (1 + 2 * C.OATH_ECHO_BONUS)));
    const again = echoes(win, prof({}, { firstKill: { mage: true } }));
    assert.ok(!again.lines.some((l) => l.id === 'firstKill'), 'first kill once per profile per class');
  });

  test('11.2 catalogue: cost per rank, max ranks, requirements; buyMeta throws when not allowed', () => {
    let p = prof({}, { echoes: 10000 });
    p = R.buyMeta(p, 'vigor');
    p = R.buyMeta(p, 'vigor');
    assert.equal(p.unlocks.vigor, 2);
    assert.equal(p.echoes, 10000 - 60 - 90);
    assert.throws(() => R.buyMeta(p, 'swift_boots'), /not available/);
    p = R.buyMeta(R.buyMeta(p, 'wayfinder'), 'swift_boots');
    assert.equal(p.unlocks.swift_boots, 1);
    assert.throws(() => R.buyMeta(p, 'second_breath'), /not available/);
    assert.ok(R.buyMeta({ ...p, reachedBoss: true }, 'second_breath'));
    assert.throws(() => R.buyMeta(p, 'oaths'), /not available/);
    assert.throws(() => R.buyMeta(p, 'sp_m2'), /not available/);
    assert.throws(() => R.buyMeta(prof({}, { echoes: 5 }), 'scout'), /costs 100/);
    let full = prof({}, { echoes: 1e6 });
    for (let i = 0; i < 5; i++) full = R.buyMeta(full, 'edge');
    assert.throws(() => R.buyMeta(full, 'edge'), /not available/);
    const total = Object.values(C.META).reduce((n, m) => n + m.costs.reduce((a, b) => a + b, 0), 0);
    assert.ok(total > 6000 && total < 7500, `catalogue total ${total}`);
    const offers = R.metaOffers(prof({}, { echoes: 100 }));
    assert.equal(offers.find((o) => o.id === 'scout').affordable, true);
    assert.equal(offers.find((o) => o.id === 'relics').available, false);
  });

  test('11.3 unique effects: on-hit proc, heal on kill, +damage vs elites, potion healing, WARD at fight start', () => {
    const uniq = (effect) => ({ uid: `u_${effect}`, kind: 'gear', slot: 'trinket', rarity: 'rare', ilvl: 20, name: 'U', stats: { AGI: 0, INT: 0, STA: 0, SPI: 0 }, power: 0, crit: 0, armor: 0, bonusArmor: 0, wd: 0, affix: 'power', unique: 'x', effect });
    const { refreshDerived } = STATS;
    const base = (effect) => tweak(withSpells(atLevel(started('rogue'), 20), []), (x) => { x.player.equipped.trinket = uniq(effect); refreshDerived(x); });
    // WARD at fight start
    const w = inFight(base('ward'), [mob()], { noStealth: true }).state;
    assert.equal(st(w.fight.p.st, 'WARD').amount, Math.round(C.UNIQUE_WARD_PCT * w.player.d.maxHp));
    // Proc: a hit with a proc draw below UNIQUE_PROC_CHANCE adds a magic hit
    const pr = tweak(inFight(base('proc'), [mob()], { noStealth: true }).state, (x) => { for (const e of x.fight.enemies) { e.maxHp = e.hp = 1e6; e.st.push({ id: 'STUN', dur: 3 }); } });
    const c = cloneState(pr);
    forceDraws(c, 4, (d) => d[0] > 0.9 && d[3] < C.UNIQUE_PROC_CHANCE);
    assert.ok(R.step(c, { type: 'ATTACK', target: 0 }).events.some((e) => e.t === 'damage' && e.spell === 'unique_proc'));
    // Heal on kill
    const hk = tweak(inFight(base('healOnKill'), [mob('z1_brute', 1)], { noStealth: true }).state, (x) => { x.player.hp = 10; x.fight.enemies[0].hp = 1; x.fight.enemies[0].dodge = 0; });
    const c2 = cloneState(hk);
    forceDraws(c2, 3, (d) => d[0] > 0.9);
    assert.ok(R.step(c2, { type: 'ATTACK', target: 0 }).events.some((e) => e.t === 'heal' && e.spell === 'unique' && e.amount === Math.round(C.UNIQUE_HEAL_ON_KILL * hk.player.d.maxHp)));
    // Potion bonus
    const pot = tweak(inFight(base('potion'), [mob()], { noStealth: true }).state, (x) => { x.player.hp = 1; x.player.bag.push({ uid: 'h', kind: 'cons', id: 'healing_draught', qty: 1 }); x.player.itemBar = ['healing_draught', null, null]; });
    const h = R.step(pot, { type: 'USE_ITEM', slot: 0, target: null }).events.find((e) => e.t === 'heal');
    assert.equal(h.amount, Math.round(C.HEAL_DRAUGHT_PCT * pot.player.d.maxHp * (1 + C.UNIQUE_POTION_PCT)));
  });

  test('11.4 unlocks enter a run: meta spells at the trainer, Trainer\'s Ledger, Prospector gold, Scout\'s Eye map, Starforged at the camp', () => {
    const plain = tweak(atLevel(started('mage'), 20, { learnAll: false }), (x) => { x.player.gold = 1e5; });
    let t = R.step(plain, { type: 'SERVICE', service: 'trainer' }).state;
    assert.ok(!R.isLegal(t, { type: 'LEARN', spellId: 'chrono_sigil' }));
    const meta = tweak(atLevel(started('mage', { profile: prof({ sp_m1: 1, ledger: 1, prospector: 2 }) }), 20, { learnAll: false }), (x) => { x.player.gold = 1e5; });
    t = R.step(meta, { type: 'SERVICE', service: 'trainer' }).state;
    const g = t.player.gold;
    t = R.step(t, { type: 'LEARN', spellId: 'chrono_sigil' }).state;
    assert.equal(t.player.gold, g, 'first LEARN at a hub is free with the Ledger');
    t = R.step(t, { type: 'LEARN', spellId: 'arcane_ward' }).state;
    assert.equal(t.player.gold, g - C.TRAIN_NEW_V * V(C.SPELL.arcane_ward.lvl));
    const s = cloneState(meta);
    import('../../src/engine/progress.js').then(({ gainGold }) => {
      const e = [];
      gainGold(s, e, 100, 'x');
      assert.equal(e[0].amount, Math.round(100 * (1 + 2 * C.META.prospector.goldPct)));
    });
    const hidden = R.mapView(R.step(started('mage', { seed: 8 }), { type: 'LEAVE_HUB' }).state);
    const shown = R.mapView(R.step(started('mage', { seed: 8, profile: prof({ scout: 1 }) }), { type: 'LEAVE_HUB' }).state);
    const cells = (m) => m.rows.flat();
    assert.ok(cells(hidden).filter((n) => n.type === 'treasure').every((n) => n.trap === null));
    assert.ok(cells(shown).filter((n) => n.type === 'treasure').every((n) => typeof n.trap === 'boolean'));
    let camp = R.step(started('rogue', { profile: prof({ starforged: 1, relics: 1, cache: 1 }, { bossKills: 1 }) }), { type: 'LEAVE_HUB' }).state;
    camp = tweak(atLevel(camp, 60), (x) => { x.zone.z = 6; });
    camp = play(camp, [{ type: 'TRAVEL_ON' }, { type: 'SERVICE', service: 'vendor' }]).state;
    const sw = camp.service.stock.find((e) => e.kind === 'gear' && e.item.unique === 'u_weapon_rogue');
    assert.ok(sw);
    assert.equal(sw.item.ilvl, 62);
    assert.equal(sw.item.rarity, 'epic');
  });

  test('11.5 Oaths: only with the unlock; Thrift raises vendor prices × 1.5; Haste lowers the par', () => {
    const s = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT });
    assert.match(R.whyIllegal(s, { type: 'SET_OATH', oath: 'thrift', on: true }), /not unlocked/);
    let o = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT, profile: prof({ oaths: 1 }, { bossKills: 1 }) });
    o = play(o, [{ type: 'SET_OATH', oath: 'thrift', on: true }, { type: 'START_RUN' }, { type: 'SERVICE', service: 'vendor' }]).state;
    const p = play(started('rogue', { seed: 1 }), [{ type: 'SERVICE', service: 'vendor' }]).state;
    assert.equal(o.service.stock[0].price, Math.round(C.PRICE_HEAL_V * V(1) * C.OATH_THRIFT_MULT));
    assert.equal(p.service.stock[0].price, Math.round(C.PRICE_HEAL_V * V(1)));
    assert.deepEqual(o.oaths, ['thrift']);
  });

  test('END_RUN writes Echoes and flags into the returned profile', () => {
    let s = started('hunter');
    s = tweak(s, (x) => { x.phase = 'SUMMARY'; x.outcome = 'victory'; x.stats.reachedBoss = true; x.stats.hoursAtBoss = 140; x.stats.bossPhase = 3; x.player.level = 60; });
    const r = R.step(s, { type: 'END_RUN' }).state.result;
    assert.equal(r.profile.runs, 1);
    assert.equal(r.profile.echoes, r.echoes);
    assert.ok(r.profile.reachedBoss);
    assert.equal(r.profile.bossKills, 1);
    assert.ok(r.profile.firstKill.hunter);
  });
});


describe('rules 12 content ranges', () => {
  test('12 the fixture passes the structural validator; strict mode reports the 12.1 count shortfalls', () => {
    assert.deepEqual(R.validateContent(CONTENT), []);
    const strict = R.validateContent(CONTENT, { strict: true });
    assert.ok(strict.length > 0 && strict.every((e) => /entries|names|rares|epics|expected/.test(e)), strict.join('\n'));
  });

  test('12.2-12.5 the validator catches range, reference and text errors', () => {
    const bad = JSON.parse(JSON.stringify(CONTENT));
    bad.enemies.z1_brute.archetype = 'dragon';
    bad.enemies.z1_beast.hpMult = 1.5;
    bad.enemies.z1_caster.hpMult = 1.2; bad.enemies.z1_caster.dmgMult = 1.2;
    bad.enemies.z1_elite.abilities = ['ab_heavy', 'ab_dark'];
    bad.enemies.z1_rare.abilities = ['ab_missing', 'ab_heavy'];
    bad.abilities.ab_dark.pct = 3;
    bad.quests.q_z1_1.title = 'x'.repeat(40);
    bad.zones[1].id = 'zz';
    bad.zones[0].quests.push('q_nope');
    delete bad.classes.mage.startChest;
    const errs = R.validateContent(bad).join('\n');
    for (const re of [/unknown archetype "dragon"/, /z1_beast.hpMult: 1.5/, /hpMult × dmgMult/, /z1_elite.abilities: 2 for kind elite/, /unknown ability "ab_missing"/, /ab_dark.pct: 3/, /q_z1_1.title: 40 chars/, /zones\[1\].id/, /unknown quest "q_nope"/, /classes.mage.startChest/]) assert.match(errs, re);
    assert.throws(() => R.newRun({ content: bad }), /content is invalid/);
  });

  test('12 the engine never changes content (it is frozen at newRun)', () => {
    const c = JSON.parse(JSON.stringify(CONTENT));
    const before = JSON.stringify(c);
    let s = R.newRun({ classId: 'mage', seed: 3, content: c });
    for (let i = 0; i < 300 && s.phase !== 'ENDED'; i++) s = R.step(s, R.autoAction(s)).state;
    assert.equal(JSON.stringify(c), before);
    assert.ok(Object.isFrozen(c.enemies.z1_brute));
  });

  const REAL = fileURLToPath(new URL('../../src/content/index.js', import.meta.url));
  test('12 real content (src/content/index.js) passes the strict validator', { skip: !existsSync(REAL) && 'src/content/index.js not present' }, async () => {
    const { CONTENT: real } = await import(REAL);
    assert.deepEqual(R.validateContent(real, { strict: true }), []);
  });
});
