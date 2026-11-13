// rules.md section 13 and the data tables: src/constants.js matches the spec text, cell by cell.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as K from '../../src/constants.js';
import { ENEMIES } from '../../src/content/enemies.js';

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

describe('m3-onboarding.md 12 constant table (M3)', () => {
  const doc = readFileSync(fileURLToPath(new URL('../../docs/specs/m3-onboarding.md', import.meta.url)), 'utf8');
  const i = doc.indexOf('## 12. Constant table');
  const text = doc.slice(i, doc.indexOf('\n## ', i + 1));
  test('every numeric row is exported with the same value ("A / B" rows: NAME_A / B); ONB_LINE_STEPS 2 (D141)', () => {
    const table = rows(text).filter((r) => /^[A-Z][A-Z0-9_]+( \/ [A-Z0-9_]+)?$/.test(r[0]));
    let n = 0;
    for (const [label, raw] of table) {
      const vals = raw.split('/').map((x) => Number(x.trim().split(/\s/)[0]));
      if (vals.some((x) => Number.isNaN(x))) continue;
      const [first, ...rest] = label.split(' / ');
      const names = [first, ...rest.map((x) => first.slice(0, first.lastIndexOf('_') + 1) + x)];
      assert.equal(names.length, vals.length, label);
      names.forEach((name, k) => { assert.ok(name in K, `${name} missing from src/constants.js`); assert.equal(K[name], vals[k], name); n += 1; });
    }
    assert.ok(n >= 17, `checked ${n}`);
    assert.equal(K.ONB_LINE_STEPS, 2);
  });
});

describe('change docs M2b v9, v10, v11 and v12: the engine constants equal the "New" column of their constant tables', () => {
  const doc = (f) => readFileSync(fileURLToPath(new URL(`../../docs/specs/${f}`, import.meta.url)), 'utf8');
  // [row label as the table starts it, getters in the order of the cell's "a / b" values]; bot, sim and balance rows are not engine constants
  const WANT = {
    'changes-m2b-v9.md': [
      ['TALENT.r_b9 heal', [() => K.TALENT.r_b9.healPct]], ['TALENT.h_a2.petDmgPct', [() => K.TALENT.h_a2.petDmgPct]],
      ['TALENT.h_a1.petHpPct', [() => K.TALENT.h_a1.petHpPct]], ['ZONE_DANGER_STEP', [() => K.ZONE_DANGER_STEP]], ['ECHO_PER_LEVEL', [() => K.ECHO_PER_LEVEL]],
    ],
    'changes-m2b-v10.md': [
      ['CONTRACT_CL_OFFSET', [() => K.CONTRACT_CL_OFFSET]], ['CONTRACT_RARE_W / CONTRACT_EPIC_W', [() => K.CONTRACT_RARE_W, () => K.CONTRACT_EPIC_W]],
      ['BOUNTY_RARE_W / BOUNTY_EPIC_W', [() => K.BOUNTY_RARE_W, () => K.BOUNTY_EPIC_W]], ['DELVE_XP_FRAC', [() => K.DELVE_XP_FRAC]],
      // CONTRACT.delve.price: 2 in v10, 1 in v11 (D93), 2 again in v12 (D100); DUNGEON_DIM_HOLD removed in v12 (D100):
      // both checked against the v12 table below
      ['EXPED_TIME_DUNGEON', [() => K.EXPED_TIME_DUNGEON]], ['XP_WEIGHT_MULT', [() => K.XP_WEIGHT_MULT]],
    ],
    // M2b v11 engine rows 1-4 (D91-D94); row 8 is gated (below); rows 5-7 are targets. EXPED_DROP_MULT (1.6) and
    // CONTRACT.delve.price (1) are superseded by v12 row 1 (D100), checked against the v12 table below.
    'changes-m2b-v11.md': [
      ['EXPED_DUNGEON_BOSS_DROPS', [() => K.EXPED_DUNGEON_BOSS_DROPS]], ['TIME_DIM_FIGHT', [() => K.TIME_DIM_FIGHT]], ['XP_WEIGHT_MULT', [() => K.XP_WEIGHT_MULT]],
    ],
    // M2b v12 engine rows 1-2 (D100, D101); row 5 is gated (below); row 3 is a target, row 4 a bot
    'changes-m2b-v12.md': [
      ['CONTRACT.delve.price', [() => K.CONTRACT.delve.price]], ['EXPED_DROP_MULT', [() => K.EXPED_DROP_MULT]],
      ['SPELL.beastcall_horn.cd', [() => K.SPELL.beastcall_horn.cd]], ['TIME_DIM_ESCAPE', [() => K.TIME_DIM_ESCAPE]],
    ],
  };
  for (const [file, want] of Object.entries(WANT)) {
    test(`${file}: ${want.length} engine rows (the main arm where the doc names an arm)`, () => {
      const text = doc(file);
      const table = rows(text.slice(text.indexOf('## Constants')));
      for (const [label, get] of want) {
        const row = table.find((r) => r[0] === label || r[0].startsWith(`${label} `));
        assert.ok(row, `${file}: no row ${label}`);
        const vals = row[2].split('/').map((x) => Number(x.trim().split(/\s/)[0]));
        assert.deepEqual(get.map((g) => g()), vals.slice(0, get.length), `${file} ${label}: New "${row[2]}"`);
      }
      assert.deepEqual(K.DROP_TABLE.contract.weights, [0, 0, K.CONTRACT_RARE_W, K.CONTRACT_EPIC_W]);
      assert.deepEqual(K.DROP_TABLE.bounty.weights, [0, 0, K.BOUNTY_RARE_W, K.BOUNTY_EPIC_W]);
      assert.equal(K.CONTRACT.delve.xpFrac, K.DELVE_XP_FRAC);
    });
  }
  test('changes-m2b-v11.md row 8 (gated, void in v12): SPELL.beastcall_horn.cd keeps the "Old" value; the gated switch is removed (v12 row 1, D100)', () => {
    const text = doc('changes-m2b-v11.md');
    const row = rows(text.slice(text.indexOf('## Constants'))).find((r) => r[0].startsWith('SPELL.beastcall_horn.cd'));
    assert.ok(row && /gated/.test(row[0]));
    assert.deepEqual([K.SPELL.beastcall_horn.cd, K.BEASTCALL_HORN_CD], [Number(row[1]), Number(row[1])]);
    assert.equal('BEASTCALL_HORN_CD_GATED' in K, false);
  });

  test('changes-m2b-v12.md: DUNGEON_DIM_HOLD "removed"; TIME_DIM_ESCAPE\'s "Old" is TIME_DIM_FIGHT 2; row 5 (gate passed, balance-2026-11-11h): bounceFrac, RICOCHET_BOUNCE_FRAC and RICOCHET_BOUNCE_FRAC_GATED are the "New" value', () => {
    const text = doc('changes-m2b-v12.md');
    const table = rows(text.slice(text.indexOf('## Constants')));
    const get = (label) => table.find((r) => r[0] === label || r[0].startsWith(`${label} `));
    assert.match(get('DUNGEON_DIM_HOLD')[2], /^removed/);
    assert.equal('DUNGEON_DIM_HOLD' in K, false);
    assert.match(get('TIME_DIM_ESCAPE')[1], /TIME_DIM_FIGHT 2/);
    assert.equal(K.TIME_DIM_FIGHT, 2);
    const ric = get('SPELL.ricochet_bolt.bounceFrac');
    assert.ok(ric && /gated/.test(ric[0]));
    assert.deepEqual([K.SPELL.ricochet_bolt.bounceFrac, K.RICOCHET_BOUNCE_FRAC, K.RICOCHET_BOUNCE_FRAC_GATED], [Number(ric[2]), Number(ric[2]), Number(ric[2])]);
    assert.notEqual(Number(ric[1]), Number(ric[2]), 'Old 0.40 is no longer the default');
  });
});

describe('change doc M2b v13 (docs/specs/changes-m2b-v13.md, D105-D109): the engine constants equal its constant table', () => {
  const text = readFileSync(fileURLToPath(new URL('../../docs/specs/changes-m2b-v13.md', import.meta.url)), 'utf8');
  const table = rows(text.slice(text.indexOf('## Constants')));
  const get = (label) => table.find((r) => r[0] === label || r[0].startsWith(`${label} `));
  test('rows 1-3: DEATHBLOW_MULT, DEATHBLOW_EMPOWER, MAIM_HEAL are the "New" column; EMPOWER_DMG and STAGGER_DMG unchanged', () => {
    for (const name of ['DEATHBLOW_MULT', 'DEATHBLOW_EMPOWER', 'MAIM_HEAL']) assert.equal(K[name], Number(get(name)[2]), name);
    const ws = get('EMPOWER_DMG, STAGGER_DMG');
    assert.match(ws[2], /^unchanged/);
    assert.deepEqual([K.EMPOWER_DMG, K.STAGGER_DMG], ws[1].split(',').map((x) => Number(x.trim())));
  });
  test('rows 5-6 (gated): RARE_HP_MULT_Z1 is the "New" value, applied only with GATES.rareHpMultZ1 (off: the "Old" RARE_HP_MULT); FIRST_MEET_WINDUP is GATES.firstMeetWindup; both switches on since M2b v14 (D113, checked below)', () => {
    const rare = get('RARE_HP_MULT_Z1');
    assert.ok(rare && /gated/.test(rare[0]));
    assert.deepEqual([K.RARE_HP_MULT_Z1, K.RARE_HP_MULT, K.VARIANT.rare.hp], [Number(rare[2]), Number(rare[1].split(/\s/)[0]), K.RARE_HP_MULT]);
    const fm = get('FIRST_MEET_WINDUP');
    assert.ok(fm && /gated/.test(fm[0]));
    assert.deepEqual([fm[1], fm[2]], ['off', 'on']);
    assert.deepEqual([K.GATES.rareHpMultZ1, K.GATES.firstMeetWindup], [fm[2] === 'on', fm[2] === 'on']);
  });
});

describe('change doc M2b v14 (docs/specs/changes-m2b-v14.md, D111-D113): the engine switches equal its constant table', () => {
  const text = readFileSync(fileURLToPath(new URL('../../docs/specs/changes-m2b-v14.md', import.meta.url)), 'utf8');
  const table = rows(text.slice(text.indexOf('## Constants')));
  const get = (label) => table.find((r) => r[0].startsWith(label));
  const on = (v) => ({ on: true, yes: true, true: true, off: false, no: false, false: false, '-': false })[v];
  test('rows 1 and 4: rule H and the PASS that keeps STEALTH are on (GATES.sapHold, GATES.passStealth); GATES.rareHpMultZ1 and GATES.firstMeetWindup are the "New" column (true)', () => {
    const rows4 = [['Autoplay rule H', 'sapHold'], ['PASS keeps STEALTH', 'passStealth'], ['`C.GATES.rareHpMultZ1`', 'rareHpMultZ1'], ['`C.GATES.firstMeetWindup`', 'firstMeetWindup']];
    for (const [label, key] of rows4) {
      const r = get(label);
      assert.ok(r, label);
      assert.equal(K.GATES[key], on(r[2]), `${label}: New ${r[2]}`);
      assert.notEqual(on(r[1]), on(r[2]), `${label}: Old ${r[1]} differs`);
    }
    // M2b v15 adds swiftRoad (checked with its table below; mawgrimHp was removed by D126)
    for (const [, key] of rows4) assert.ok(key in K.GATES, key);
  });
});

describe('change doc M2b v15 (docs/specs/changes-m2b-v15.md, D123-D125): the engine constants and content values equal its constant table', () => {
  const text = readFileSync(fileURLToPath(new URL('../../docs/specs/changes-m2b-v15.md', import.meta.url)), 'utf8');
  const table = rows(text.slice(text.indexOf('## Constants')));
  const get = (label) => table.find((r) => r[0] === label || r[0].startsWith(`${label} `));
  const value = (cell) => Number(cell.split(/\s/)[0]);
  const was = (cell) => Number(cell.match(/\(was ([\d.]+)\)/)[1]);
  const outcome = (r) => r[4];
  test('row 2: ROAD_SWIFT_TOLLS and ROAD_SWIFT_XP_FRAC are the table\'s values; GATES.swiftRoad is the "v15 outcome (D126)" column (off)', () => {
    assert.ok(/v15 outcome \(D126\)/.test(text.slice(text.indexOf('## Constants'))));
    for (const name of ['ROAD_SWIFT_TOLLS', 'ROAD_SWIFT_XP_FRAC']) assert.equal(K[name], value(get(name)[1]), name);
    const sw = get('`C.GATES.swiftRoad`');
    assert.ok(sw);
    assert.deepEqual([sw[1], outcome(sw)], ['on', 'off']);
    assert.equal(K.GATES.swiftRoad, outcome(sw) === 'on');
    assert.equal(K.GATES.swiftRoad, false);
  });
  test('row 1: z1_belk.hpMult is the table\'s value (was 1.05); row 4 applied (D126): z2_mawgrim.hpMult is the table\'s value (was 1.1), no `gated` field anywhere in content', () => {
    const belk = get('z1_belk.hpMult');
    assert.deepEqual([ENEMIES.z1_belk.hpMult, was(belk[1])], [value(belk[1]), 1.05]);
    const maw = get('z2_mawgrim.hpMult');
    assert.ok(maw && /^applies/.test(outcome(maw)));
    assert.deepEqual([ENEMIES.z2_mawgrim.hpMult, was(maw[1])], [value(maw[1]), 1.1]);
    assert.equal(value(maw[1]), 0.95);
    assert.deepEqual(Object.keys(ENEMIES).filter((id) => 'gated' in ENEMIES[id]), []);
  });
  test('C.GATES: the v14 switches, the v15 swiftRoad (off since D126), campReroll (D128, off), boardAcrossRun (D132, on) and autoEmberFirst (D133, on), nothing else (mawgrimHp removed)', () => {
    assert.deepEqual(Object.keys(K.GATES).sort(), ['autoEmberFirst', 'boardAcrossRun', 'campReroll', 'firstMeetWindup', 'passStealth', 'rareHpMultZ1', 'sapHold', 'swiftRoad']);
    assert.equal(K.GATES.campReroll, false);
    assert.equal(K.GATES.boardAcrossRun, true);
    assert.equal(K.GATES.autoEmberFirst, true);
    assert.deepEqual(K.CONTRACT_BOARD_BANDS, [[1, 2], [3, 4], [5, 6]]);
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

  test('1.9.2 region kinds (expedition): REGION_W equals the region table, cell by cell; REGION_KINDS in table order', () => {
    const t = rows(section('#### 1.9.2 Zone graph')).filter((r) => K.REGION_W[r[0]]);
    const head = rows(section('#### 1.9.2 Zone graph')).find((r) => r[0] === 'Region kind').slice(1, 9).map((x) => x.toLowerCase());
    assert.deepEqual(head, K.NODE_DRAW_ORDER, 'columns in NODE_DRAW_ORDER');
    assert.deepEqual(t.map((r) => r[0]), K.REGION_KINDS);
    for (const r of t) assert.deepEqual(K.NODE_DRAW_ORDER.map((ty) => K.REGION_W[r[0]][ty]), r.slice(1, 9).map(Number), r[0]);
    assert.deepEqual(Object.keys(K.REGION_W), K.REGION_KINDS);
    assert.match(section('#### 1.9.2 Zone graph'), /Elite, Vendor and Trainer weighing 0 in ring 1 \(RING1_FORBIDDEN\)/);
    assert.deepEqual(K.RING1_FORBIDDEN, ['elite', 'vendor', 'trainer']);
    assert.deepEqual(K.VARIANT.shardspawn, { hp: K.DIM_HP_MULT, dmg: K.DIM_DMG_MULT });
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
    // D44 itself, as numbers: 0.10 -> 0.125, 0.05 -> 0.0625, 0.10 -> 0.125; M2b v8 (D75): Ferocity 0.125 -> 0.15625, Thick Hide 0.08 -> 0.10;
    // M2b v9 (D79, changes-m2b-v9.md row 2, × 1.15): Ferocity 0.15625 -> 0.18, Thick Hide 0.10 -> 0.115
    assert.deepEqual([K.TALENT.h_a2.petDmgPct, K.TALENT.h_a6.pct, K.TALENT.h_a7.pct], [0.18, 0.0625, 0.125]);
    assert.equal(K.TALENT.h_a1.petHpPct, 0.115);
  });

  test('6.1 and 6.3 survival-tree trims (M2b v8, D76; Death\'s Sidestep M2b v9, D78): Shadowcraft and Wildcraft numbers match the spec', () => {
    // [section, talent, field, pattern in the Effect cell, scale, value now (v8; r_b9 v9)]
    const want = [
      ['### 6.1 Rogue', 'r_b4', 'healPct', /heal ([\d.]+) % max HP per round/, 0.01, 0.02],
      ['### 6.1 Rogue', 'r_b7', 'healPct', /heals ([\d.]+) % max HP \/rank/, 0.01, 0.05],
      ['### 6.1 Rogue', 'r_b9', 'healPct', /heal ([\d.]+) % max HP/, 0.01, 0.15],
      ['### 6.3 Hunter', 'h_c1', 'hpPct', /max HP \+([\d.]+) %/, 0.01, 0.03],
      ['### 6.3 Hunter', 'h_c4', 'pct', /Field Dressing \+([\d.]+) %/, 0.01, 0.10],
      ['### 6.3 Hunter', 'h_c5', 'dodge', /\+([\d.]+) dodge/, 1, 0.02],
    ];
    for (const [title, id, field, re, scale, v8] of want) {
      const row = rows(section(title)).find((r) => r[0] === id);
      const m = row && row[4].match(re);
      assert.ok(m, `${id}: "${row && row[4]}" does not match ${re}`);
      assert.ok(Math.abs(K.TALENT[id][field] - Number(m[1]) * scale) < 1e-12, `${id}.${field}: spec ${Number(m[1]) * scale}, constants.js ${K.TALENT[id][field]}`);
      assert.equal(K.TALENT[id][field], v8, `${id}.${field} is the v8 (r_b9: v9) value`);
    }
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
