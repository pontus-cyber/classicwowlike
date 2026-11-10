// Public API helpers and event fields added for the simulator and the UI (engine-api.md 1 and 5):
// V / xpCurve / diffMod / bagCapacity on src/rules.js; damage `hpLost`; no heal event of 0; post-fight `regen`;
// level-up gains; resurrect values. The last test rebuilds the player's HP from events alone over full runs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { R, C, CONTENT, started, atLevel, withSpells, inFight, tweak, cloneState, forceDraws, ev, MAX_ACTIONS_PER_RUN } from './helpers.mjs';
import { V as engineV, bagCapacity as engineBag } from '../../src/engine/items.js';
import { xpCurve as engineCurve, diffMod as engineDiff, gainXp } from '../../src/engine/progress.js';
import { applyDamage } from '../../src/engine/damage.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REAL = fileURLToPath(new URL('../../src/content/index.js', import.meta.url));
const realContent = existsSync(REAL) ? (await import(REAL)).CONTENT : null;

const mob = (level, tid = 'z1_brute') => ({ tid, level, variant: 'normal' });
const stunAll = (x) => { for (const e of x.fight.enemies) e.st.push({ id: 'STUN', dur: 9 }); };
/** Kill enemy 0 with one forced hit (1 HP left, no dodge). */
function killFirst(s) {
  const c = tweak(s, (x) => { const e = x.fight.enemies[0]; e.hp = 1; e.dodge = 0; e.shield = 0; });
  forceDraws(c, 3, (d) => d[0] > 0.6);
  return R.step(c, { type: 'ATTACK', target: 0 });
}

describe('public rule helpers (engine-api.md 1)', () => {
  test('V, xpCurve and diffMod are the engine functions; xpCurve is defined at MAX_LEVEL where xpToNext is 0', () => {
    for (const L of [1, 2, 10, 30, 59, 60, 62]) {
      assert.equal(R.V(L), engineV(L), `V(${L})`);
      assert.equal(R.xpCurve(L), engineCurve(L), `xpCurve(${L})`);
      if (L < C.MAX_LEVEL) assert.equal(R.xpToNext(L), R.xpCurve(L));
    }
    assert.equal(R.V(30), Math.round(C.VALUE_BASE + C.VALUE_COEF * Math.pow(30, C.VALUE_EXP)));
    assert.equal(R.xpCurve(C.MAX_LEVEL), C.XP_A * C.MAX_LEVEL ** 2 + C.XP_B * C.MAX_LEVEL + C.XP_C);
    assert.equal(R.xpToNext(C.MAX_LEVEL), 0);
    for (let d = -9; d <= 9; d++) assert.equal(R.diffMod(d), engineDiff(d), `diffMod(${d})`);
    assert.equal(R.diffMod(0), 1);
    assert.equal(R.diffMod(20), C.XP_DIFF_MAX);
    assert.equal(R.diffMod(C.XP_GREY_DIFF), C.XP_GREY_MOD);
  });

  test('bagCapacity: BAG_SLOTS plus Deeper Pockets, in CREATE (from the profile) and during the run', () => {
    const prof = { ...R.newProfile(), unlocks: { pockets: 2 } };
    const create = R.newRun({ classId: 'mage', seed: 1, content: CONTENT, profile: prof });
    assert.equal(R.bagCapacity(create), C.BAG_SLOTS + 2 * C.META.pockets.slots);
    assert.equal(R.bagCapacity(R.newRun({ seed: 1, content: CONTENT })), C.BAG_SLOTS, 'no class chosen, fresh profile');
    const run = R.step(create, { type: 'START_RUN' }).state;
    assert.equal(R.bagCapacity(run), engineBag(run));
    assert.equal(R.bagCapacity(run), C.BAG_SLOTS + 2 * C.META.pockets.slots);
    assert.equal(R.bagCapacity(started('rogue')), C.BAG_SLOTS);
  });
});

describe('bossPar and zoneDanger on the API (engine-api.md 1, M2 v4)', () => {
  test('bossPar: BOSS_TIME_PAR, OATH_HASTE_HOURS less under Haste, in CREATE and in a run; Ascendancy and the speed bonus use it', () => {
    const prof = { ...R.newProfile(), unlocks: { oaths: 1 }, bossKills: 1 };
    let c = R.newRun({ classId: 'rogue', seed: 3, content: CONTENT, profile: prof });
    assert.equal(R.bossPar(c), C.BOSS_TIME_PAR);
    c = R.step(c, { type: 'SET_OATH', oath: 'haste', on: true }).state;
    assert.equal(R.bossPar(c), C.BOSS_TIME_PAR - C.OATH_HASTE_HOURS, 'CREATE: Oaths chosen so far');
    for (const haste of [false, true]) {
      let s = R.newRun({ classId: 'rogue', seed: 3, content: CONTENT, profile: prof });
      if (haste) s = R.step(s, { type: 'SET_OATH', oath: 'haste', on: true }).state;
      s = R.step(R.step(s, { type: 'START_RUN' }).state, { type: 'LEAVE_HUB' }).state;
      const par = R.bossPar(s);
      assert.equal(par, C.BOSS_TIME_PAR - (haste ? C.OATH_HASTE_HOURS : 0));
      for (const [over, asc] of [[0, 0], [C.ASC_STEP_HOURS - 1, 0], [C.ASC_STEP_HOURS, C.ASC_PER_STEP]]) {
        // arrive at the camp at par + over hours, then FIGHT_BOSS
        const t = tweak(atLevel(s, 60), (x) => { x.zone.z = C.ZONE_COUNT; x.hours = par + over - C.HOURS_TRAVEL; });
        const b = R.step(R.step(t, { type: 'TRAVEL_ON' }).state, { type: 'FIGHT_BOSS' }).state;
        assert.equal(R.bossPar(b), par);
        assert.equal(b.fight.boss.asc, asc, `haste ${haste}, par + ${over} h`);
        const won = tweak(b, (x) => { x.fight = null; x.phase = 'SUMMARY'; x.outcome = 'victory'; });
        assert.equal(R.summary(won).echoes.lines.some((l) => l.id === 'speed'), over === 0, `speed bonus at par + ${over} h`);
      }
    }
  });

  test('zoneDanger(level, variant) is the multiplier makeEnemy applies, for every variant and level', () => {
    assert.equal(R.zoneDanger(20), 1);
    assert.equal(R.zoneDanger(60), 2);
    assert.equal(R.zoneDanger(60, 'normal'), 2);
    assert.equal(R.zoneDanger(60, 'elite'), 2);
    assert.equal(R.zoneDanger(60, 'trash'), 1.5);
    assert.equal(R.zoneDanger(60, 'dboss'), 1.5);
    for (const [tid, variant] of [['z1_brute', 'normal'], ['z1_caster', 'trash'], ['z1_elite', 'elite'], ['z1_rare', 'rare'], ['z1_dboss', 'dboss']]) {
      for (const L of [1, 20, 21, 33, 47, 55, 57, 60]) {
        const s = inFight(atLevel(started('mage'), 20), [{ tid, level: L, variant }], { noStealth: true }).state;
        const e = s.fight.enemies[0];
        const free = (C.ENEMY_DMG_BASE + C.ENEMY_DMG_PER_LEVEL * L) * C.ARCHETYPE[e.arch].dmg * C.VARIANT[variant].dmg;
        // combat v2: e.dmg also carries ENGAGE_DMG_COMP (not part of zoneDanger)
        assert.ok(Math.abs(e.dmg - free * R.zoneDanger(L, variant) * C.ENGAGE_DMG_COMP) < 1e-9, `${variant} level ${L}`);
      }
    }
  });
});

describe('damage events: amount and hpLost (engine-api.md 5)', () => {
  test('killing blow on an enemy: amount is the full hit, hpLost the HP it had; run stats count hpLost', () => {
    let s = withSpells(atLevel(started('rogue', { seed: 3 }), 20), []);
    s = inFight(s, [mob(20), mob(20)], { noStealth: true }).state;
    const c = tweak(s, (x) => { x.fight.enemies[0].hp = 3; x.fight.enemies[0].dodge = 0; });
    forceDraws(c, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
    const r = R.step(c, { type: 'ATTACK', target: 0 });
    const kill = r.events.find((e) => e.t === 'damage' && e.dst === 0);
    assert.ok(kill.amount > 3, `hit ${kill.amount}`);
    assert.equal(kill.hpLost, 3);
    assert.equal(r.state.stats.dmgDealt - c.stats.dmgDealt, 3);
    const n = tweak(s, (x) => { x.fight.enemies[1].dodge = 0; });
    forceDraws(n, 3, (d) => d[0] > 0.9 && d[1] > 0.6);
    const hit = R.step(n, { type: 'ATTACK', target: 1 }).events.find((e) => e.t === 'damage' && e.dst === 1);
    assert.ok(hit.amount > 0 && hit.hpLost === hit.amount, 'a hit that does not kill loses its full amount');
  });

  test('player and pet: hpLost capped at the HP left; WARD absorbs (absorbed, not in amount); IMMUNE: 0 and 0', () => {
    const s = inFight(atLevel(started('hunter', { seed: 4 }), 20), [mob(20)]).state;
    const w = tweak(s, (x) => { x.fight.p.st.push({ id: 'WARD', dur: 3, amount: 10 }); });
    const e1 = [];
    applyDamage(w, e1, 0, 'player', 30, { spell: 'strike', school: 'phys' });
    assert.deepEqual([e1.at(-1).amount, e1.at(-1).hpLost, e1.at(-1).absorbed], [20, 20, 10]);
    const im = tweak(s, (x) => { x.fight.p.st.push({ id: 'IMMUNE', dur: 2 }); });
    const e2 = [];
    applyDamage(im, e2, 0, 'player', 30, {});
    assert.deepEqual([e2[0].amount, e2[0].hpLost, e2[0].immune], [0, 0, true]);
    const pet = tweak(s, (x) => { x.player.pet.hp = 4; });
    const e3 = [];
    applyDamage(pet, e3, 0, 'pet', 30, {});
    assert.deepEqual([e3[0].dst, e3[0].amount, e3[0].hpLost], ['pet', 30, 4]);
    assert.ok(ev(e3, 'death').some((x) => x.u === 'pet'));
  });

  test('a lethal hit on the player: hpLost = HP left; the resurrect event carries the HP and mana it sets', () => {
    const s = inFight(atLevel(started('mage', { seed: 5 }), 20), [mob(20)]).state;
    const c = tweak(s, (x) => { x.player.hp = 7; x.player.mana = 3; x.player.res.boon = 1; });
    const events = [];
    applyDamage(c, events, 0, 'player', 50, { spell: 'strike', school: 'phys' });
    const hit = ev(events, 'damage')[0];
    assert.deepEqual([hit.amount, hit.hpLost], [50, 7]);
    const res = ev(events, 'resurrect')[0];
    assert.equal(res.source, 'boon');
    assert.equal(res.hp, Math.max(1, Math.round(C.RES_HP_PCT * c.player.d.maxHp)));
    assert.equal(res.mana, Math.round(C.RES_MANA_PCT * c.player.d.maxMana));
    assert.deepEqual([res.hp, res.mana], [c.player.hp, c.player.mana]);
  });
});

describe('heal, regen, level-up and resurrect events (engine-api.md 5)', () => {
  test('no heal event when nothing is restored: Healing Draught at full health in a fight and out of one', () => {
    let s = withSpells(atLevel(started('rogue', { seed: 6 }), 20), []);
    s = tweak(s, (x) => { x.player.bag.push({ uid: 'h1', kind: 'cons', id: 'healing_draught', qty: 3 }); x.player.itemBar = ['healing_draught', null, null]; });
    const f = tweak(inFight(s, [mob(20)], { noStealth: true }).state, stunAll);
    const full = R.step(f, { type: 'USE_ITEM', slot: 0, target: null });
    assert.equal(ev(full.events, 'heal').length, 0);
    assert.equal(ev(full.events, 'action').filter((e) => e.kind === 'item').length, 1, 'the potion is still drunk');
    assert.equal(full.state.stats.potionsUsed, 1);
    const low = R.step(tweak(f, (x) => { x.player.hp = 10; }), { type: 'USE_ITEM', slot: 0, target: null });
    assert.deepEqual(ev(low.events, 'heal').map((e) => e.amount), [Math.round(C.HEAL_DRAUGHT_PCT * f.player.d.maxHp)]);
    const ooc = R.step(s, { type: 'USE_ITEM', itemId: 'trail_rations' });
    assert.equal(ev(ooc.events, 'useItem').length, 1);
    assert.equal(ev(ooc.events, 'heal').length, 0, 'rations at full health');
    const oocLow = R.step(tweak(s, (x) => { x.player.hp = 10; }), { type: 'USE_ITEM', itemId: 'trail_rations' });
    assert.equal(ev(oocLow.events, 'heal')[0].amount, Math.round(C.RATION_PCT * s.player.d.maxHp));
  });

  test('no mana event when nothing is restored: Mana Siphon and a Mana Draught at full mana', () => {
    let s = withSpells(atLevel(started('mage', { seed: 9 }), 30), ['mana_siphon']);
    s = tweak(s, (x) => { x.player.bag.push({ uid: 'm1', kind: 'cons', id: 'mana_draught', qty: 2 }); x.player.itemBar = ['mana_draught', null, null]; });
    const f = tweak(inFight(s, [mob(30)]).state, stunAll);
    const siphon = R.step(f, { type: 'CAST', spellId: 'mana_siphon', target: null });
    assert.equal(ev(siphon.events, 'mana').length, 0);
    const draught = R.step(f, { type: 'USE_ITEM', slot: 0, target: null });
    assert.equal(ev(draught.events, 'mana').length, 0);
    const low = R.step(tweak(f, (x) => { x.player.mana = 0; }), { type: 'USE_ITEM', slot: 0, target: null });
    assert.deepEqual(ev(low.events, 'mana').map((e) => e.amount), [Math.round(C.MANA_DRAUGHT_PCT * f.player.d.maxMana)]);
  });

  test('post-fight regen: a regen event right after victory with the HP, mana and pet HP restored', () => {
    for (const cls of ['hunter', 'mage']) {
      let s = withSpells(atLevel(started(cls, { seed: 7 }), 30), []);
      // A grind wave: kill XP + wave XP stay below a level (a quest's turn-in XP would level up).
      s = tweak(inFight(s, [mob(30)], { kind: 'grind' }).state, (x) => {
        x.player.hp = Math.floor(x.player.d.maxHp / 2);
        if (x.player.d.maxMana) x.player.mana = Math.floor(x.player.d.maxMana / 2);
        if (x.player.pet) x.player.pet.hp = Math.floor(x.player.d.petMaxHp / 2);
      });
      const r = killFirst(s);
      const i = r.events.findIndex((e) => e.t === 'victory');
      assert.ok(i >= 0, cls);
      const g = r.events[i + 1];
      assert.equal(g.t, 'regen', `${cls}: regen follows victory`);
      assert.equal(ev(r.events, 'levelUp').length, 0);
      const d = r.state.player.d;
      assert.equal(g.pct, d.regenPct);
      assert.equal(g.hpGain, Math.round(d.regenPct * d.maxHp));
      assert.equal(r.state.player.hp - s.player.hp, g.hpGain);
      assert.equal(g.manaGain, d.maxMana ? Math.round(d.regenPct * d.maxMana) : 0, `${cls} mana`);
      assert.equal(r.state.player.mana - s.player.mana, g.manaGain);
      assert.equal(g.petHpGain, cls === 'hunter' ? Math.round(d.regenPct * d.petMaxHp) : 0, `${cls} pet`);
      if (cls === 'hunter') assert.equal(r.state.player.pet.hp - s.player.pet.hp, g.petHpGain);
    }
    const fresh = inFight(withSpells(atLevel(started('rogue', { seed: 7 }), 30), []), [mob(30)], { kind: 'grind', noStealth: true }).state;
    const r = killFirst(fresh);
    assert.ok(ev(r.events, 'victory').length === 1 && ev(r.events, 'regen').length === 0, 'nothing to restore: no regen event');
  });

  test('levelUp carries hpGain, manaGain, petHpGain and the new maxima; current values rise by the max gains (rules 4.3)', () => {
    for (const cls of ['mage', 'hunter']) {
      const s = cloneState(atLevel(started(cls, { seed: 8 }), 5));
      s.player.hp = 30;
      if (s.player.d.maxMana) s.player.mana = 20;
      if (s.player.pet) s.player.pet.hp = 9;
      const d0 = s.player.d;
      const [hp0, mana0, pet0] = [s.player.hp, s.player.mana, s.player.pet ? s.player.pet.hp : 0];
      const events = [];
      gainXp(s, events, R.xpToNext(5) + R.xpToNext(6) + 1, 'test');
      const ups = ev(events, 'levelUp');
      assert.deepEqual(ups.map((e) => e.level), [6, 7], cls);
      const sum = (k) => ups.reduce((n, e) => n + e[k], 0);
      assert.equal(sum('hpGain'), s.player.d.maxHp - d0.maxHp);
      assert.equal(s.player.hp, hp0 + sum('hpGain'));
      assert.equal(sum('manaGain'), s.player.d.maxMana - d0.maxMana);
      assert.equal(s.player.mana, mana0 + sum('manaGain'));
      assert.equal(ups[1].maxHp, s.player.d.maxHp);
      assert.equal(ups[1].maxMana, s.player.d.maxMana);
      if (cls === 'hunter') {
        assert.equal(sum('petHpGain'), s.player.d.petMaxHp - d0.petMaxHp);
        assert.equal(s.player.pet.hp, pet0 + sum('petHpGain'));
        assert.equal(ups[1].petMaxHp, s.player.d.petMaxHp);
      } else assert.equal(sum('petHpGain'), 0);
      assert.ok(ups[0].hpGain > 0 && ups[0].maxHp < ups[1].maxHp);
    }
  });

  test('full runs: the player HP of every combat step follows from the events alone; no heal event of 0', () => {
    let steps = 0;
    const runs = [];
    for (const cls of C.CLASS_IDS) {
      for (let seed = 11; seed <= 18; seed++) runs.push([cls, seed, CONTENT]);
      if (realContent) for (let seed = 21; seed <= 23; seed++) runs.push([cls, seed, realContent]);
    }
    for (const [cls, seed, content] of runs) {
      let s = R.newRun({ classId: cls, petId: cls === 'hunter' ? 'ridgewolf' : null, seed, content });
      for (let n = 0; n < MAX_ACTIONS_PER_RUN && s.phase !== 'ENDED'; n++) {
        const a = R.autoAction(s);
        const fight = !!s.fight;
        const r = R.step(s, a);
        for (const e of r.events) {
          if (e.t === 'heal') assert.ok(e.amount > 0, `${cls} ${seed} step ${n}: heal of ${e.amount}`);
          if (e.t === 'damage') assert.ok(e.hpLost >= 0 && e.hpLost <= e.amount, `${cls} ${seed} step ${n}: hpLost ${e.hpLost} amount ${e.amount}`);
        }
        if (fight) {
          let hp = s.player.hp;
          for (const e of r.events) {
            if (e.t === 'damage' && e.dst === 'player') hp -= e.hpLost;
            else if (e.t === 'heal' && e.dst === 'player') hp += e.amount;
            else if (e.t === 'regen' || e.t === 'levelUp') hp += e.hpGain;
            else if (e.t === 'resurrect') hp = e.hp;
            else if (e.t === 'trap') hp -= e.amount;
          }
          assert.equal(hp, r.state.player.hp, `${cls} seed ${seed} step ${n} (${a.type})`);
          steps++;
        }
        s = r.state;
      }
    }
    assert.ok(steps > 1000, `${steps} combat steps traced`);
  });
});
