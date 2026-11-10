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
/** The Camp vendor of a started run (rules 1.6): level 60 in zone 6, TRAVEL_ON, SERVICE vendor. */
function campVendor(s) {
  s = tweak(atLevel(R.step(s, { type: 'LEAVE_HUB' }).state, 60), (x) => { x.zone.z = 6; });
  s = play(s, [{ type: 'TRAVEL_ON' }, { type: 'SERVICE', service: 'vendor' }]).state;
  assert.deepEqual([s.phase, s.service.where], ['CAMP', 'camp']);
  return s.service.stock;
}

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

  test('11.1 Echo lines are rounded half away from zero, round(count × each), before the total (M2 v3)', () => {
    assert.deepEqual([C.ECHO_PER_LEVEL, C.ECHO_PER_ZONE, C.ECHO_BOSS_PHASE], [1.5, 7.5, 12]);
    const facts = (f) => ({ classId: 'rogue', level: 1, zonesLeft: 0, dungeons: 0, kills: { elite: 0, rare: 0 }, quests: 0, reachedBoss: false, bossPhase: 0, outcome: 'death', hoursAtBoss: null, oaths: [], ...f });
    const line = (e, id) => e.lines.find((l) => l.id === id);
    // 1 level × 1.5 = 1.5 -> 2; 59 × 1.5 = 88.5 -> 89; 1 zone × 7.5 -> 8; 3 zones 22.5 -> 23; 6 zones 45
    for (const [level, want] of [[2, 2], [3, 3], [4, 5], [31, 45], [60, 89]]) assert.equal(line(echoes(facts({ level }), null), 'levels').echoes, want, `level ${level}`);
    for (const [zonesLeft, want] of [[1, 8], [2, 15], [3, 23], [5, 38], [6, 45]]) assert.equal(line(echoes(facts({ zonesLeft }), null), 'zones').echoes, want, `${zonesLeft} zones`);
    const e = echoes(facts({ level: 60, zonesLeft: 5, dungeons: 3, kills: { elite: 4, rare: 1 }, quests: 9, reachedBoss: true, bossPhase: 3 }), R.newProfile());
    assert.equal(line(e, 'bossPhases').echoes, 2 * C.ECHO_BOSS_PHASE);
    assert.ok(e.lines.every((l) => Number.isInteger(l.echoes) && l.echoes === Math.round(l.count * l.each)), 'every line shows its rounded value');
    assert.equal(e.base, e.lines.reduce((n, l) => n + l.echoes, 0), 'total = sum of the rounded lines');
    assert.equal(e.base, 89 + 38 + 3 * C.ECHO_PER_DUNGEON + 4 * C.ECHO_PER_ELITE + C.ECHO_PER_RARE + 9 * C.ECHO_PER_QUEST + C.ECHO_BOSS_REACHED + 24);
    assert.equal(e.total, e.base);
    // Oath multiplier on the sum of the rounded lines, rounded once: 3 levels (4.5 -> 5) + 1 zone (7.5 -> 8) = 13; × 1.25 = 16.25 -> 16
    const o = echoes(facts({ level: 4, zonesLeft: 1, oaths: ['thrift'] }), R.newProfile());
    assert.deepEqual([o.base, o.oathMult, o.total], [5 + 8, 1 + C.OATH_ECHO_BONUS, Math.round(13 * (1 + C.OATH_ECHO_BONUS))]);
    // The run summary carries the same rounded lines (the UI shows them).
    const s = tweak(started('mage'), (x) => { x.player.level = 2; x.stats.zonesLeft = 3; });
    const sum = R.summary(s);
    assert.deepEqual(sum.echoes.lines.map((l) => [l.id, l.echoes]), [['levels', 2], ['zones', 23]]);
    assert.equal(sum.echoes.total, 25);
  });

  test('11.2 catalogue: cost per rank, max ranks, requirements; buyMeta throws when not allowed', () => {
    let p = prof({}, { echoes: 10000 });
    p = R.buyMeta(p, 'vigor');
    p = R.buyMeta(p, 'vigor');
    assert.equal(p.unlocks.vigor, 2);
    assert.equal(p.echoes, 10000 - 80 - 120, 'Vigor ranks 1-2 cost 80 + 120 (M2 v3)');
    assert.equal(p.spent, 200);
    // M2 v4: Swift Boots has no prerequisite (was Wayfinder)
    assert.deepEqual(C.META.swift_boots.req, []);
    assert.equal(R.metaOffers(prof({}, { echoes: 200 })).find((o) => o.id === 'swift_boots').affordable, true);
    p = R.buyMeta(p, 'swift_boots');
    assert.equal(p.unlocks.swift_boots, 1);
    assert.equal(p.echoes, 10000 - 200 - 200);
    assert.throws(() => R.buyMeta(p, 'second_breath'), /not available/);
    assert.ok(R.buyMeta({ ...p, reachedBoss: true }, 'second_breath'));
    assert.throws(() => R.buyMeta(p, 'oaths'), /not available/);
    assert.throws(() => R.buyMeta(p, 'sp_m2'), /not available/);
    assert.throws(() => R.buyMeta(prof({}, { echoes: 5 }), 'scout'), /costs 100/);
    let full = prof({}, { echoes: 1e6 });
    for (let i = 0; i < 4; i++) full = R.buyMeta(full, 'edge');
    assert.equal(full.unlocks.edge, 4, 'Edge of the Line: 4 ranks (M2 v4)');
    assert.throws(() => R.buyMeta(full, 'edge'), /not available/);
    const total = Object.values(C.META).reduce((n, m) => n + m.costs.reduce((a, b) => a + b, 0), 0);
    assert.equal(total, 6560, 'catalogue total 6 560 Echoes (rules 11.2, M2 v5: Starforged Arms removed)');
    const offers = R.metaOffers(prof({}, { echoes: 100 }));
    assert.equal(offers.find((o) => o.id === 'scout').affordable, true);
    assert.equal(offers.find((o) => o.id === 'relics').available, false);
  });

  test('11.2 catalogue M2 v4: Vigor and Edge 4 ranks, Keen 2, Ancestral Insight 1, costs per rank; buying stops at the last rank', () => {
    const withReqs = (p, id) => {
      for (const r of C.META[id].req) if (!r.startsWith('flag:') && !p.unlocks[r]) p = R.buyMeta(withReqs(p, r), r);
      return p;
    };
    const buyAll = (id) => {
      let p = withReqs(prof({}, { echoes: 1e6, reachedBoss: true, bossKills: 1 }), id);
      const before = p.spent;
      const paid = [];
      for (let i = 0; i < C.META[id].ranks; i++) { const e = p.echoes; p = R.buyMeta(p, id); paid.push(e - p.echoes); }
      assert.throws(() => R.buyMeta(p, id), /not available/, `${id} past its last rank`);
      assert.equal(p.spent - before, paid.reduce((a, b) => a + b, 0));
      return paid;
    };
    const want = {
      vigor: [80, 120, 170, 230], edge: [80, 120, 170, 230], keen: [150, 250], quick_study: [100, 180, 280],
      prospector: [60, 110, 170], swift_boots: [200], alchemist: [150], cache: [200], relics: [400],
      sp_r2: [300], sp_m2: [300], sp_h2: [300], stormhawk: [250], talent_pt: [500], second_breath: [500],
    };
    for (const [id, costs] of Object.entries(want)) assert.deepEqual(buyAll(id), costs, id);
    assert.equal(C.META.vigor.hpPct, 0.01);
    assert.equal(C.META.edge.powerPct, 0.01);
    // M2 v4: Keen, Quick Study and Prospector give a quarter less per rank (rules 11.2)
    assert.equal(C.META.keen.crit, 0.0075);
    assert.equal(C.META.quick_study.xpPct, 0.0375);
    assert.equal(C.META.prospector.goldPct, 0.06);
    const s = started('rogue', { profile: prof({ keen: 2, quick_study: 3, prospector: 3 }) });
    assert.ok(Math.abs(s.meta.crit - 0.015) < 1e-12 && Math.abs(s.meta.xpPct - 0.1125) < 1e-12 && Math.abs(s.meta.goldPct - 0.18) < 1e-12, JSON.stringify(s.meta));
  });

  test('11.2 meta power budget (M2 v4, M2 v5): the full catalogue adds at most max HP +0.04, Power +0.04, crit +0.015, +1 talent point, and no class weapon', () => {
    const all = prof(Object.fromEntries(Object.values(C.META).map((m) => [m.id, m.ranks])), { reachedBoss: true, bossKills: 1 });
    // M2 v5 (D45): the item entries are the Greater draught (Alchemist) and the unique rares and epics (Cache, Relics)
    assert.deepEqual(Object.values(C.META).filter((m) => m.kind === 'items').map((m) => m.id), ['alchemist', 'cache', 'relics']);
    for (const c of C.CLASS_IDS) {
      const s = started(c, { profile: all });
      assert.ok(Math.abs(s.meta.hpPct - 0.04) < 1e-12, `${c} hpPct ${s.meta.hpPct}`);
      assert.ok(Math.abs(s.meta.powerPct - 0.04) < 1e-12, `${c} powerPct ${s.meta.powerPct}`);
      assert.ok(Math.abs(s.meta.crit - 0.015) < 1e-12, `${c} crit ${s.meta.crit}`);
      assert.equal(s.meta.talentPoints, 1);
      assert.equal(R.talentPointsFree(atLevel(s, 60)), R.talentPointsFree(atLevel(started(c), 60)) + 1);
      // the only resurrect from the catalogue is not usable at the end boss
      assert.deepEqual(R.resurrectCharges(s).boss, []);
      // max HP: the catalogue's +4 % on top of the same raw value (no talents)
      const d = s.player.d;
      const raw = C.CLASS[c].hpBase + C.HP_PER_STA * d.STA;
      assert.equal(d.maxHp, Math.round(raw * 1.04));
      // M2 v5 (D45): the Camp vendor sells VENDOR_GEAR_STOCK generated items and no unique (no class weapon)
      const gear = campVendor(s).filter((e) => e.kind === 'gear');
      assert.equal(gear.length, C.VENDOR_GEAR_STOCK, `${c}: Camp gear`);
      assert.ok(gear.every((e) => !e.item.unique), `${c}: unique at the Camp: ${gear.map((e) => e.item.unique).join(',')}`);
    }
    // A profile saved under an older catalogue (Keen 3, Ancestral Insight 2, Vigor 7) counts at the new maximum ranks.
    const old = prof({ keen: 3, talent_pt: 2, vigor: 7, edge: 5 });
    const s = started('rogue', { profile: old });
    assert.ok(Math.abs(s.meta.crit - 0.015) < 1e-12 && s.meta.talentPoints === 1 && Math.abs(s.meta.hpPct - 0.04) < 1e-12 && Math.abs(s.meta.powerPct - 0.04) < 1e-12, JSON.stringify(s.meta));
    const offers = R.metaOffers(old);
    assert.deepEqual(['keen', 'talent_pt', 'vigor', 'edge'].map((id) => { const o = offers.find((x) => x.id === id); return [o.rank, o.available, o.nextCost]; }), [[2, false, null], [1, false, null], [4, false, null], [4, false, null]]);
    assert.throws(() => R.buyMeta(old, 'keen'), /not available/);
    // M2 v4: a profile that bought Vigor and Edge rank 5 under M2 v3 counts as rank 4 (D32), no Echoes refunded.
    const v3 = prof({ vigor: 5, edge: 5 }, { echoes: 40, spent: 1800 });
    const v3s = started('mage', { profile: v3 });
    assert.ok(Math.abs(v3s.meta.hpPct - 0.04) < 1e-12 && Math.abs(v3s.meta.powerPct - 0.04) < 1e-12);
    assert.throws(() => R.buyMeta(v3, 'vigor'), /not available/);
    assert.deepEqual([v3s.profile.echoes, v3s.profile.spent, v3s.profile.unlocks.vigor], [40, 1800, 5], 'stored as saved');
  });

  test('11.2 meta power budget (M2 v4): potion line +0.025 of max HP per healing potion; time line: no entry makes an action cost fewer hours', () => {
    const all = prof(Object.fromEntries(Object.values(C.META).map((m) => [m.id, m.ranks])), { reachedBoss: true, bossKills: 1 });
    // Potion line: Alchemist's Greater Healing Draught is the only healing potion the catalogue adds.
    const metaPotions = Object.values(C.CONSUMABLE).filter((c) => c.meta);
    assert.deepEqual(metaPotions.map((c) => c.id), ['greater_healing_draught']);
    assert.equal(C.GREATER_HEAL_PCT, 0.375);
    assert.ok(C.CONSUMABLE.greater_healing_draught.heal - C.HEAL_DRAUGHT_PCT <= 0.025 + 1e-12, 'Greater draught at most +0.025 over the Healing Draught');
    for (const c of C.CLASS_IDS) {
      const base = tweak(inFight(withSpells(atLevel(started(c, { profile: all }), 60), []), [mob('z1_brute', 60)], { noStealth: true }).state, (x) => {
        x.player.hp = 1;
        x.player.bag.push({ uid: 'g', kind: 'cons', id: 'greater_healing_draught', qty: 1 }, { uid: 'h', kind: 'cons', id: 'healing_draught', qty: 1 });
        x.player.itemBar = ['greater_healing_draught', 'healing_draught', null];
        for (const e of x.fight.enemies) e.st.push({ id: 'STUN', dur: 3 });
      });
      const heal = (slot) => R.step(base, { type: 'USE_ITEM', slot, target: null }).events.find((e) => e.t === 'heal' && e.dst === 'player').amount;
      const max = base.player.d.maxHp;
      assert.equal(heal(0), Math.round(C.GREATER_HEAL_PCT * max), `${c} Greater draught`);
      assert.equal(heal(1), Math.round(C.HEAL_DRAUGHT_PCT * max), `${c} Healing Draught`);
      assert.ok(heal(0) - heal(1) <= 0.025 * max + 1, `${c}: +${heal(0) - heal(1)} of ${max}`);
    }
    // Time line: META_TIME_BUDGET_H is half an Ascendancy step; the catalogue saves time only through the route
    // (Quick Study XP, Swift Boots one level earlier), which balance.md B17 measures. Every hours event of a full-catalogue
    // run costs what the rules table says for its reason.
    assert.equal(C.META_TIME_BUDGET_H, C.ASC_STEP_HOURS / 2);
    const want = { quest: C.HOURS_QUEST, grind: C.HOURS_GRIND_WAVE, elite: C.HOURS_ELITE, dungeon: C.HOURS_DUNGEON, rest: C.HOURS_REST, vendor: C.HOURS_VENDOR, trainer: C.HOURS_TRAINER, treasure: C.HOURS_TREASURE, shrine: C.HOURS_SHRINE, travel: C.HOURS_TRAVEL, inn: C.HOURS_REST, camp: C.HOURS_GRIND_WAVE };
    const seen = new Set();
    for (const seed of [1, 2, 3]) {
      let s = started('hunter', { seed, profile: all });
      for (let i = 0; i < 6000 && s.phase !== 'ENDED'; i++) {
        const r = R.step(s, R.autoAction(s));
        for (const e of r.events) if (e.t === 'hours') { assert.equal(e.add, want[e.why], `${e.why}: ${e.add} h`); seen.add(e.why); }
        s = r.state;
      }
    }
    assert.ok(seen.has('quest') && seen.size >= 4, [...seen].join(','));
  });

  test('11.2 Wayfinder removed (M2 v4): a saved profile that owns it gets no effect and no refund; metaOffers, START_RUN, buyMeta and END_RUN work', () => {
    assert.equal(C.META.wayfinder, undefined);
    for (const m of Object.values(C.META)) for (const r of m.req) assert.ok(r.startsWith('flag:') ? ['flag:bossKill', 'flag:reachedBoss'].includes(r) : !!C.META[r], `${m.id} requires unknown ${r}`);
    const saved = prof({ wayfinder: 1, vigor: 2 }, { echoes: 500, spent: 280 });
    const offers = R.metaOffers(saved);
    assert.equal(offers.length, Object.keys(C.META).length);
    assert.ok(!offers.some((o) => o.id === 'wayfinder'));
    assert.equal(offers.find((o) => o.id === 'vigor').rank, 2);
    assert.throws(() => R.buyMeta(saved, 'wayfinder'), /unknown meta unlock wayfinder/);
    const bought = R.buyMeta(saved, 'swift_boots');
    assert.deepEqual(bought.unlocks, { wayfinder: 1, vigor: 2, swift_boots: 1 }, 'the removed id stays stored');
    assert.deepEqual([bought.echoes, bought.spent], [300, 480], 'no refund');
    // START_RUN: the same run as the profile without the removed id (no effect, no draws changed)
    const without = prof({ vigor: 2, swift_boots: 1 }, { echoes: 300, spent: 480 });
    let a = started('hunter', { seed: 6, profile: bought });
    let b = started('hunter', { seed: 6, profile: without });
    assert.ok(!('wayfinder' in a.meta));
    assert.deepEqual(a.meta, b.meta);
    for (let i = 0; i < 400 && a.phase !== 'ENDED'; i++) {
      const act = R.autoAction(a);
      const ra = R.step(a, act); const rb = R.step(b, act);
      assert.deepEqual(ra.events, rb.events, `step ${i}`);
      a = ra.state; b = rb.state;
    }
    const strip = (s) => { const o = JSON.parse(R.serialize(s)); delete o.profile; return o; };
    assert.deepEqual(strip(a), strip(b));
    // END_RUN keeps the stored id in the returned profile
    const end = R.step(tweak(started('rogue', { profile: bought }), (x) => { x.phase = 'SUMMARY'; x.outcome = 'death'; }), { type: 'END_RUN' }).state;
    assert.equal(end.result.profile.unlocks.wayfinder, 1);
  });

  test('11.2 Starforged Arms removed (M2 v5, D45): not offered, cannot be bought; a saved profile that owns it gets no effect and no refund; the Camp sells no class weapon', () => {
    assert.equal(C.META.starforged, undefined);
    assert.deepEqual(Object.values(CONTENT.uniques).filter((u) => u.kind === 'weapon').map((u) => u.classId).sort(), ['hunter', 'mage', 'rogue'], 'the class weapons stay in content (rules 12.1)');
    assert.throws(() => R.buyMeta(prof({ cache: 1, relics: 1 }, { echoes: 1e4, reachedBoss: true, bossKills: 1 }), 'starforged'), /unknown meta unlock starforged/);
    // A profile saved before M2 v5: Starforged 450 + Relics 400 + Cache 200 + Vigor 80 spent
    const saved = prof({ starforged: 1, relics: 1, cache: 1, vigor: 1 }, { echoes: 600, spent: 1130, reachedBoss: true, bossKills: 1 });
    const offers = R.metaOffers(saved);
    assert.equal(offers.length, Object.keys(C.META).length);
    assert.ok(!offers.some((o) => o.id === 'starforged'));
    assert.throws(() => R.buyMeta(saved, 'starforged'), /unknown meta unlock starforged/);
    const bought = R.buyMeta(saved, 'scout');
    assert.deepEqual(bought.unlocks, { starforged: 1, relics: 1, cache: 1, vigor: 1, scout: 1 }, 'the removed id stays stored');
    assert.deepEqual([bought.echoes, bought.spent], [500, 1230], 'no refund');
    const without = { ...bought, unlocks: { relics: 1, cache: 1, vigor: 1, scout: 1 } };
    // START_RUN: no flag, the same run modifiers; the Camp vendor stock is the one of the profile without the id
    for (const c of C.CLASS_IDS) {
      const a = started(c, { seed: 5, profile: bought });
      const b = started(c, { seed: 5, profile: without });
      assert.ok(!('starforged' in a.meta), c);
      assert.deepEqual(a.meta, b.meta, c);
      const stock = campVendor(a);
      assert.deepEqual(stock, campVendor(b), `${c}: Camp stock`);
      assert.ok(!stock.some((e) => e.kind === 'gear' && e.item.unique), `${c}: no unique at the Camp`);
    }
    // A whole autoplay run is the same run, event for event (hunter seed 1 opens the Camp vendor on the way)
    let a = started('hunter', { seed: 1, profile: bought });
    let b = started('hunter', { seed: 1, profile: without });
    for (let i = 0; i < 5000 && a.phase !== 'ENDED'; i++) {
      const act = R.autoAction(a);
      const ra = R.step(a, act); const rb = R.step(b, act);
      assert.deepEqual(ra.events, rb.events, `step ${i}`);
      a = ra.state; b = rb.state;
    }
    assert.equal(a.phase, 'ENDED');
    // Only the stored profile differs (and the run summary's profile hash, which hashes every stored id)
    assert.equal(a.result.profile.unlocks.starforged, 1, 'END_RUN keeps the stored id');
    const strip = (s) => { const o = JSON.parse(R.serialize(s)); delete o.profile; delete o.result.profile; delete o.result.summary.profileHash; return o; };
    assert.deepEqual(strip(a), strip(b));
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

  test('11.4 unlocks enter a run: meta spells at the trainer, Trainer\'s Ledger, Prospector gold, Scout\'s Eye map', async () => {
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
    const { gainGold } = await import('../../src/engine/progress.js');
    const e = [];
    gainGold(s, e, 100, 'x');
    assert.equal(e[0].amount, Math.round(100 * (1 + 2 * C.META.prospector.goldPct)));
    const hidden = R.mapView(R.step(started('mage', { seed: 8 }), { type: 'LEAVE_HUB' }).state);
    const shown = R.mapView(R.step(started('mage', { seed: 8, profile: prof({ scout: 1 }) }), { type: 'LEAVE_HUB' }).state);
    const cells = (m) => m.rows.flat();
    assert.ok(cells(hidden).filter((n) => n.type === 'treasure').every((n) => n.trap === null));
    assert.ok(cells(shown).filter((n) => n.type === 'treasure').every((n) => typeof n.trap === 'boolean'));
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
