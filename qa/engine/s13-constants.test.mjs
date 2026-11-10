// rules.md section 13 and the data tables: src/constants.js matches the spec text, cell by cell.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as K from '../../src/constants.js';

const SPEC = readFileSync(fileURLToPath(new URL('../../docs/specs/rules.md', import.meta.url)), 'utf8');

function section(title) {
  const i = SPEC.indexOf(title);
  assert.ok(i >= 0, `section ${title} not found in rules.md`);
  const rest = SPEC.slice(i + title.length);
  const j = rest.search(/\n#{2,3} /);
  return j >= 0 ? rest.slice(0, j) : rest;
}

function rows(text) {
  return text.split('\n').filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l.trim()))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

describe('rules 13 constant table', () => {
  const table = rows(section('## 13. Constant table')).filter((r) => /^[A-Z][A-Z0-9_]+$/.test(r[0]));
  test('every constant of the table is exported with the same value', () => {
    assert.ok(table.length > 250, `parsed ${table.length} constants`);
    for (const [name, raw] of table) {
      assert.ok(name in K, `${name} missing from src/constants.js`);
      let want;
      if (raw.startsWith('[')) want = JSON.parse(raw);
      else if (/^[a-z]/.test(raw)) want = Object.fromEntries(raw.split(',').map((p) => { const [k, v] = p.trim().split(/\s+/); return [k, Number(v)]; }));
      else want = Number(raw.replace(/\s/g, ''));
      assert.deepEqual(K[name], want, `${name}: spec ${raw}, constants.js ${JSON.stringify(K[name])}`);
    }
  });
});

describe('rules data tables', () => {
  test('1.4 node weights', () => {
    for (const r of rows(section('### 1.4 Zone map generation'))) {
      if (!K.NODE_TYPE[r[0].toLowerCase()] || !/^W_/.test(r[1] || '')) continue;
      assert.equal(K.NODE_TYPE[r[0].toLowerCase()].weight, Number(r[2]), r[0]);
      assert.equal(K[r[1]], Number(r[2]), r[1]);
    }
  });

  test('5.1 class base stats and growth', () => {
    const t = rows(section('### 5.1 Base stats and growth'));
    const get = (label) => t.find((r) => r[0] === label).slice(1);
    const ids = ['rogue', 'mage', 'hunter'];
    ids.forEach((c, i) => {
      const C = K.CLASS[c];
      const [hb, hl] = get('hpBase / hpPerLevel')[i].split('/').map(Number);
      assert.equal(C.hpBase, hb); assert.equal(C.hpPerLevel, hl);
      for (const stat of ['STA', 'AGI', 'INT', 'SPI']) assert.deepEqual(C.stats[stat], get(`${stat} base / growth`)[i].split('/').map(Number), `${c} ${stat}`);
      const [ab, al] = get('armorBase / armorPerLevel')[i].split('/').map(Number);
      assert.equal(C.armorBase, ab); assert.equal(C.armorPerLevel, al);
      assert.equal(C.armorMult, Number(get('armorMult (item armor)')[i]));
      const [db, da] = get('dodgeBase / dodgeFromAgi')[i].split('/').map(Number);
      assert.equal(C.dodgeBase, db); assert.equal(C.dodgeFromAgi, da);
    });
  });

  test('5.3-5.6 spells: level, cost and cooldown', () => {
    const parseCost = (c) => (c === '0' ? 0 : c.endsWith('%M') ? Number(c.slice(0, -2)) / 100 : Number(c.slice(0, -1)));
    let n = 0;
    for (const title of ['### 5.3 Rogue spells', '### 5.4 Mage spells', '### 5.5 Hunter spells and pets']) {
      for (const r of rows(section(title))) {
        if (!K.SPELL[r[0]]) continue;
        const sp = K.SPELL[r[0]];
        assert.equal(sp.name, r[1], r[0]);
        assert.equal(sp.lvl, Number(r[2]), `${r[0]} lvl`);
        assert.equal(sp.cost, parseCost(r[3]), `${r[0]} cost`);
        assert.equal(sp.cd, Number(r[4]), `${r[0]} cd`);
        assert.deepEqual(sp.tags, r[6].split(',').map((x) => x.trim()), `${r[0]} tags`);
        n++;
      }
    }
    assert.equal(n, 36);
    for (const r of rows(section('### 5.6 Meta-unlock spells'))) {
      if (!K.SPELL[r[0]]) continue;
      const sp = K.SPELL[r[0]];
      assert.equal(sp.name, r[2]); assert.equal(sp.lvl, Number(r[3]));
      assert.equal(sp.cost, parseCost(r[4]), `${r[0]} cost`); assert.equal(sp.cd, Number(r[5]));
      n++;
    }
    assert.equal(n, 42);
  });

  test('5.5 pets', () => {
    let n = 0;
    for (const r of rows(section('### 5.5 Hunter spells and pets'))) {
      const p = K.PET[r[0]];
      if (!p) continue;
      assert.equal(p.hpPct, Number(r[2])); assert.equal(p.armorMult, Number(r[3])); assert.equal(p.dmgMult, Number(r[4]));
      assert.equal(p.critBonus, Number(r[5])); assert.equal(p.aggro, Number(r[6]));
      n++;
    }
    assert.equal(n, 4);
  });

  test('6 talents: tree, tier, name and ranks of all 81', () => {
    let n = 0;
    for (const title of ['### 6.1 Rogue', '### 6.2 Mage', '### 6.3 Hunter']) {
      for (const r of rows(section(title))) {
        const t = K.TALENT[r[0]];
        if (!t) continue;
        const [tree, tier] = [r[1].replace(/\s*\d+$/, ''), Number(r[1].match(/(\d+)$/)[1])];
        assert.equal(K.CLASS[t.cls].trees[t.tree], tree, r[0]);
        assert.equal(t.tier, tier, `${r[0]} tier`);
        assert.equal(t.name, r[2], `${r[0]} name`);
        assert.equal(t.ranks, Number(r[3]), `${r[0]} ranks`);
        n++;
      }
    }
    assert.equal(n, 81);
  });

  test('6.3 Beastbond: every per-rank number of the tree matches the spec (M2 v5: Ferocity, Pack Leader, Savage Mastery +25 %, D44)', () => {
    // [talent, field, pattern in the Effect cell, scale]: "%" values are fractions in constants.js.
    const want = [
      ['h_a1', 'petHpPct', /pet max HP \+([\d.]+) %/, 0.01],
      ['h_a2', 'petDmgPct', /pet damage \+([\d.]+) %/, 0.01],
      ['h_a3', 'share', /heals you for ([\d.]+) %/, 0.01],
      ['h_a4', 'petCrit', /pet crit \+([\d.]+) /, 1],
      ['h_a4', 'focus', /gives you ([\d.]+) focus/, 1],
      ['h_a5', 'revive', /revives after fights at \+([\d.]+) /, 1],
      ['h_a5', 'petDr', /pet takes -([\d.]+) % damage/, 0.01],
      ['h_a6', 'pct', /deal \+([\d.]+) % damage/, 0.01],
      ['h_a7', 'cd', /CD -([\d.]+) /, 1],
      ['h_a7', 'pct', /and \+([\d.]+) % \/rank/, 0.01],
      ['h_a8', 'share', /^([\d.]+) % of damage you take/, 0.01],
    ];
    const effect = Object.fromEntries(rows(section('### 6.3 Hunter')).filter((r) => /^h_a\d$/.test(r[0])).map((r) => [r[0], r[4]]));
    assert.equal(Object.keys(effect).length, 9, 'nine Beastbond rows');
    for (const [id, field, re, scale] of want) {
      const m = effect[id].match(re);
      assert.ok(m, `${id}: "${effect[id]}" does not match ${re}`);
      const spec = Number(m[1]) * scale;
      assert.ok(Math.abs(K.TALENT[id][field] - spec) < 1e-12, `${id}.${field}: spec ${spec}, constants.js ${K.TALENT[id][field]}`);
    }
    assert.equal(K.TALENT.h_a9.spell, effect.h_a9.match(/new spell `(\w+)`/)[1]);
    // D44 itself, as numbers: 0.10 -> 0.125, 0.05 -> 0.0625, 0.10 -> 0.125
    assert.deepEqual([K.TALENT.h_a2.petDmgPct, K.TALENT.h_a6.pct, K.TALENT.h_a7.pct], [0.125, 0.0625, 0.125]);
  });

  test('7.6 archetypes', () => {
    for (const r of rows(section('### 7.6 Enemy AI and intents'))) {
      const a = K.ARCHETYPE[r[0]];
      if (!a) continue;
      assert.equal(a.hp, Number(r[1])); assert.equal(a.dmg, Number(r[2])); assert.equal(a.armor, Number(r[3])); assert.equal(a.dodge, Number(r[4]));
      const weights = [...r[5].matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]));
      assert.deepEqual(a.actions.map((x) => x.w), weights, `${r[0]} weights`);
    }
  });

  test('7.12 opening scripts (combat v2): OPENING_SCRIPT equals the script table; every id is an archetype action or a SCRIPT_ACTION', () => {
    const t = rows(section('### 7.12 Opening scripts and pack roles')).filter((r) => K.ARCHETYPE[r[0]] && r.length === 4);
    assert.equal(t.length, Object.keys(K.ARCHETYPE).length);
    for (const [arch, ...turns] of t) {
      assert.deepEqual(K.OPENING_SCRIPT[arch], turns, arch);
      for (const id of turns) assert.ok(K.SCRIPT_ACTION[id] || K.ARCHETYPE[arch].actions.some((a) => a.id === id), `${arch}: ${id}`);
    }
    assert.equal(K.OPENING_SCRIPT.brute.length, K.OPENING_TURNS);
    assert.equal(K.SCRIPT_ACTION.bolster.pct, K.BOLSTER_PCT);
    assert.equal(K.SCRIPT_ACTION.signal.adds, K.SIGNAL_ADDS);
    assert.equal(K.ARCHETYPE.mender.actions.find((a) => a.id === 'mend').below, K.MEND_BELOW);
  });

  test('7.10 engage options (combat v2): ENGAGE_OPTION equals the option table (id, class, kind, name); three per class in ENGAGE_OPTIONS', () => {
    const t = rows(section('### 7.10 Engage round')).filter((r) => K.ENGAGE_OPTION[r[0]]);
    assert.equal(t.length, 9);
    for (const [id, cls, kind, name] of t) assert.deepEqual([K.ENGAGE_OPTION[id].cls, K.ENGAGE_OPTION[id].kind, K.ENGAGE_OPTION[id].name], [cls, kind, name], id);
    for (const c of K.CLASS_IDS) {
      assert.deepEqual(K.ENGAGE_OPTIONS[c].map((id) => K.ENGAGE_OPTION[id].kind), ['strike', 'control', 'setup'], c);
      assert.ok(K.ENGAGE_OPTIONS[c].every((id) => K.ENGAGE_OPTION[id].cls === c));
    }
  });

  test('8.1 slots, 8.2 rarity, 8.4 drop tables', () => {
    for (const r of rows(section('### 8.1 Slots'))) {
      const s = Object.values(K.SLOT).find((x) => x.name === r[0]);
      if (!s) continue;
      assert.equal(s.slotW, Number(r[1])); assert.equal(s.armor, r[2] === 'yes');
    }
    for (const r of rows(section('### 8.2 Rarity'))) {
      const id = r[0].toLowerCase();
      if (!K.RARITY[id] || id === 'junk') continue;
      assert.equal(K.RARITY[id].mult, Number(r[1])); assert.equal(K.RARITY[id].ilvlBonus, Number(r[2]));
      assert.equal(K.RARITY[id].stats, Number(r[3])); assert.equal(K.RARITY[id].sellMult, Number(r[5]));
    }
    const map = { 'Normal mob kill': 'mob', 'Dungeon trash kill': 'trash', 'Elite (guaranteed 1)': 'elite', 'Rare elite (guaranteed 1)': 'rare', 'Dungeon boss (DUNGEON_BOSS_DROPS rolls)': 'dboss', 'Quest reward (each choice)': 'quest', 'Story reward (each choice)': 'story', Treasure: 'treasure', 'Vendor stock': 'vendor' };
    let n = 0;
    for (const r of rows(section('### 8.4 Drops per kill'))) {
      const id = map[r[0]];
      if (!id) continue;
      assert.deepEqual(K.DROP_TABLE[id].weights, r[3].split('/').map((x) => Number(x.trim())), id);
      n++;
    }
    assert.equal(n, 9);
  });

  test('2.9 boons and 11.2 meta catalogue', () => {
    for (const r of rows(section('### 2.9 Shrine'))) {
      const b = Object.values(K.BOON).find((x) => x.name === r[0]);
      if (b) assert.equal(b.weight, K[r[1]]);
    }
    let n = 0;
    for (const r of rows(section('### 11.2 Catalogue'))) {
      const ids = r[0].split('/').map((x) => x.trim());
      for (const id of ids) {
        const m = K.META[id];
        if (!m) continue;
        assert.equal(m.ranks, Number(r[3]), `${id} ranks`);
        assert.deepEqual(m.costs, r[4].split('/').map(Number), `${id} costs`);
        n++;
      }
    }
    assert.equal(n, Object.keys(K.META).length);
  });

  test('12.4 ability templates: ranges and cooldowns', () => {
    for (const r of rows(section('### 12.4 Ability templates'))) {
      const t = K.ABILITY_TEMPLATE[r[0]];
      if (!t) continue;
      const nums = (r[2].match(/[\d.]+/g) || []).map(Number);
      if (t.pct) assert.deepEqual(t.pct, [nums[0] / 100, nums[1] / 100], `${r[0]} pct`);
      if (t.count) assert.deepEqual(t.count, [nums[0], nums[1]]);
      if (t.cd) {
        const cd = r[3].split('-').map(Number);
        assert.deepEqual(t.cd, cd.length === 1 ? [cd[0], cd[0]] : cd, `${r[0]} cd`);
      }
    }
  });

  test('ENGINE_ASSUMPTION autopilot lists cover every class spell exactly once', () => {
    for (const c of K.CLASS_IDS) {
      const pick = K.ENGINE_ASSUMPTION.AUTO_PICK[c];
      const order = K.ENGINE_ASSUMPTION.AUTO_BAR_ORDER[c];
      assert.deepEqual([...pick].sort(), [...order].sort(), c);
      assert.equal(new Set(pick).size, pick.length);
      const all = Object.values(K.SPELL).filter((s) => s.cls === c).map((s) => s.id).sort();
      assert.deepEqual([...pick].sort(), all, `${c} lists every spell`);
    }
  });
});
