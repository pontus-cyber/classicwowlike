// Content access and validation (src/content/SCHEMA.md, rules 12; expedition fields: zone regions and Road names,
// template families, the texts.expedition group, D51; texts.families, texts.prep, texts.contracts, 2b.5). M2b v14 (D112,
// rules 12.4): in strict mode every zone's elite pool keeps a heavy and a cast Deathblow. M3 (m3-onboarding.md 2.3, E2;
// SCHEMA.md 2.11): the optional guided-run table `tutorial` (validateTutorial).
import {
  ZONE_COUNT, CONTENT_RANGE as CR, ARCHETYPE, ABILITY_TEMPLATE, SLOT_IDS, CLASS_IDS, SPELL, TALENT, PET,
  BOON, CONSUMABLE, ENGINE_ASSUMPTION as EA, REGION_COUNT, REGION_W, ROAD_COUNT, EXPEDITION_TEXT_IDS, PREP_OPTION,
  TUTORIAL_SEED, ONB_SCRIPTED_FIGHTS, ONB_BEATS, CONTRACT, CONTRACT_KINDS, CONTRACT_BOARD_SIZE, RARITY,
} from '../constants.js';

/** Hints of the guided-run table (m3-onboarding.md 3.2: H01-H37). */
export const ONB_HINT_COUNT = 37;

/**
 * The guided-run table CONTENT.tutorial (SCHEMA.md 2.11; m3-onboarding.md 2.3, E2): errors as strings. The board slot
 * (a contract kind; region id of its zone; a family of that region), the site fights and ONB_SCRIPTED_FIGHTS scripts
 * (enemies are normals of the zone; windup a boolean; S1's loot a rarity and a consumable; D144: a `quest` a quest of the
 * content), the elite (an elite of the
 * zone with its Deathblow among its abilities; gate.afterScript a script id), the seed equal to C.TUTORIAL_SEED, and
 * with `beats` / `hints` present the 13 beat ids in order and 37 hint ids. Levels are constants, not content.
 */
export function validateTutorial(content) {
  const T = content.tutorial;
  const err = [];
  const e = (m) => err.push(`tutorial${m}`);
  if (!T || typeof T !== 'object') return ['tutorial: not an object'];
  const zone = Number.isInteger(T.zone) ? T.zone : 1;
  const zn = content.zones && content.zones[zone - 1];
  if (!zn) return [`tutorial.zone: no zone ${zone}`];
  const enemies = content.enemies || {};
  if (T.seed !== undefined && T.seed !== TUTORIAL_SEED) e(`.seed: ${T.seed}, the engine plays C.TUTORIAL_SEED ${TUTORIAL_SEED}`);
  const b = T.board || {};
  if (!Number.isInteger(b.slot) || b.slot < 1 || b.slot > CONTRACT_BOARD_SIZE) e(`.board.slot: 1-${CONTRACT_BOARD_SIZE}`);
  if (!CONTRACT_KINDS.includes(b.kind) || !CONTRACT[b.kind]) e(`.board.kind: unknown contract kind "${b.kind}"`);
  if (b.z !== zone) e(`.board.z: ${b.z}, expected the guided zone ${zone}`);
  const reg = (zn.regions || []).find((r) => r.id === b.region);
  if (!reg) e(`.board.region: "${b.region}" is not a region id of zone ${zone}`);
  else if (b.family !== null && b.family !== undefined && !(reg.families || []).includes(b.family)) e(`.board.family: "${b.family}" is not a family of ${b.region}`);
  const fight = (list, where) => {
    if (!Array.isArray(list) || !list.length) { e(`${where}: no enemies`); return; }
    list.forEach((x, i) => {
      if (!x || !(zn.normals || []).includes(x.enemy)) e(`${where}[${i}].enemy: "${x && x.enemy}" is not a normal of zone ${zone}`);
      if (x && x.windup !== undefined && typeof x.windup !== 'boolean') e(`${where}[${i}].windup: true or false`);
    });
  };
  // D144: a script's or site fight's `quest` (optional) names a quest of the content (its text is shown on the node)
  const quest = (x, where) => { if (x && x.quest !== undefined && !(content.quests || {})[x.quest]) e(`${where}.quest: unknown quest "${x.quest}"`); };
  if (!Array.isArray(T.siteFights) || !T.siteFights.length) e('.siteFights: at least one');
  else T.siteFights.forEach((f, i) => { fight(f && f.enemies, `.siteFights[${i}].enemies`); quest(f, `.siteFights[${i}]`); });
  if (!Array.isArray(T.scripts) || T.scripts.length !== ONB_SCRIPTED_FIGHTS) e(`.scripts: exactly ${ONB_SCRIPTED_FIGHTS} (ONB_SCRIPTED_FIGHTS)`);
  const ids = [];
  for (const [i, x] of (Array.isArray(T.scripts) ? T.scripts : []).entries()) {
    if (!x || typeof x.id !== 'string' || ids.includes(x.id)) e(`.scripts[${i}].id: a unique id`);
    else ids.push(x.id);
    fight(x && x.enemies, `.scripts[${i}].enemies`);
    quest(x, `.scripts[${i}]`);
    if (x && x.loot) {
      if (!RARITY[x.loot.upgrade]) e(`.scripts[${i}].loot.upgrade: unknown rarity "${x.loot.upgrade}"`);
      if (x.loot.consumable !== undefined && !CONSUMABLE[x.loot.consumable]) e(`.scripts[${i}].loot.consumable: unknown consumable "${x.loot.consumable}"`);
    }
  }
  const el = T.elite || {};
  if (!(zn.elites || []).includes(el.enemy)) e(`.elite.enemy: "${el.enemy}" is not an elite of zone ${zone}`);
  else if (el.deathblow !== undefined && !((enemies[el.enemy] && enemies[el.enemy].abilities) || []).includes(el.deathblow)) e(`.elite.deathblow: "${el.deathblow}" is not an ability of ${el.enemy}`);
  if (!el.gate || !ids.includes(el.gate.afterScript)) e(`.elite.gate.afterScript: "${el.gate && el.gate.afterScript}" is not a script id`);
  if (T.beats !== undefined && (!Array.isArray(T.beats) || T.beats.map((x) => x && x.id).join() !== ONB_BEATS.join())) e(`.beats: the ${ONB_BEATS.length} beats ${ONB_BEATS[0]}-${ONB_BEATS[ONB_BEATS.length - 1]} in order`);
  if (T.hints !== undefined) {
    const want = Array.from({ length: ONB_HINT_COUNT }, (_, i) => `H${String(i + 1).padStart(2, '0')}`);
    if (!Array.isArray(T.hints) || T.hints.map((x) => x && x.id).join() !== want.join()) e(`.hints: the ${ONB_HINT_COUNT} hints H01-H${ONB_HINT_COUNT} in order`);
  }
  return err;
}

export const SUFFIX_KEYS = ['AGI', 'INT', 'STA', 'AGI_STA', 'AGI_SPI', 'INT_STA', 'INT_SPI', 'AGI_STA_SPI', 'INT_STA_SPI'];
const KINDS = ['normal', 'elite', 'rare', 'trash', 'dboss'];
const EFFECTS = ['proc', 'healOnKill', 'eliteDmg', 'potion', 'ward'];

/** Zone content for zone number z (1..6). The camp (z = 7) uses zone 6 lists where it needs mobs. */
export function zoneContent(content, z) {
  return content.zones[Math.min(z, ZONE_COUNT) - 1];
}

export function campEnemies(content) {
  const c = content.camp;
  return c && Array.isArray(c.enemies) && c.enemies.length ? c.enemies : content.zones[ZONE_COUNT - 1].normals;
}

/** Zone number for stream keys and content lookups: camp = ZONE_COUNT + 1. */
export const CAMP_Z = EA.CAMP_ZONE;

/**
 * Validate a content object. Returns an array of error strings (empty when valid).
 * strict: also check the rules 12.1 counts and (M2b v14, D112) that each zone's elite pool has at least one heavy and one
 * cast Deathblow (rules 12.4; the map shows a hidden elite's Deathblow type, which then never tells a rare, D50); use for
 * src/content. Otherwise only what the engine needs.
 */
export function validateContent(content, { strict = false } = {}) {
  const err = [];
  const e = (m) => err.push(m);
  if (!content || typeof content !== 'object') return ['content: not an object'];
  const str = (v, max, where) => {
    if (typeof v !== 'string' || v.length === 0) e(`${where}: missing text`);
    else if (v.length > max) e(`${where}: ${v.length} chars > ${max}`);
  };
  const optStr = (v, max, where) => { if (v !== undefined) str(v, max, where); };
  const inRange = (v, [lo, hi], where) => {
    if (typeof v !== 'number' || !(v >= lo - 1e-9 && v <= hi + 1e-9)) e(`${where}: ${v} outside ${lo}-${hi}`);
  };
  const count = (arr, [lo, hi], where) => {
    if (!Array.isArray(arr)) { e(`${where}: not a list`); return; }
    const min = strict ? lo : 1;
    const max = strict ? hi : Infinity;
    if (arr.length < min || arr.length > max) e(`${where}: ${arr.length} entries, expected ${strict ? `${lo}-${hi}` : '>= 1'}`);
  };
  const enemies = content.enemies || {};
  const abilities = content.abilities || {};
  const quests = content.quests || {};
  // An elite template's Deathblow type (rules 7.12, track.js deathblowOf): its non-once ability with the highest pct
  // (ties: first listed); 'heavy' when that template is heavy, else 'cast'. null when it has none.
  const deathblowTypeOf = (id) => {
    const abs = ((enemies[id] && enemies[id].abilities) || []).filter((a) => abilities[a] && ABILITY_TEMPLATE[abilities[a].template] && !ABILITY_TEMPLATE[abilities[a].template].once);
    if (!abs.length) return null;
    let best = abs[0];
    for (const a of abs) if ((abilities[a].pct || 0) > (abilities[best].pct || 0)) best = a;
    return ABILITY_TEMPLATE[abilities[best].template].heavy ? 'heavy' : 'cast';
  };
  if (typeof content.enemies !== 'object') e('enemies: missing table');
  if (typeof content.abilities !== 'object') e('abilities: missing table');
  if (typeof content.quests !== 'object') e('quests: missing table');

  // Abilities
  for (const [id, a] of Object.entries(abilities)) {
    const w = `abilities.${id}`;
    if (a.id !== id) e(`${w}: id field "${a.id}" does not match key`);
    const t = ABILITY_TEMPLATE[a.template];
    if (!t) { e(`${w}: unknown template "${a.template}"`); continue; }
    str(a.name, CR.len.abilityName, `${w}.name`);
    optStr(a.text, CR.len.enemyText, `${w}.text`);
    if (t.pct) inRange(a.pct, t.pct, `${w}.pct`);
    if (t.tickPct) inRange(a.tickPct, t.tickPct, `${w}.tickPct`);
    if (t.count) inRange(a.count, t.count, `${w}.count`);
    if (t.cd) inRange(a.cd, t.cd, `${w}.cd`);
  }

  // Enemies
  for (const [id, en] of Object.entries(enemies)) {
    const w = `enemies.${id}`;
    if (en.id !== id) e(`${w}: id field "${en.id}" does not match key`);
    str(en.name, CR.len.enemyName, `${w}.name`);
    optStr(en.text, CR.len.enemyText, `${w}.text`);
    if (!KINDS.includes(en.kind)) e(`${w}: unknown kind "${en.kind}"`);
    if (!ARCHETYPE[en.archetype]) e(`${w}: unknown archetype "${en.archetype}"`);
    inRange(en.hpMult, CR.hpMult, `${w}.hpMult`);
    inRange(en.dmgMult, CR.dmgMult, `${w}.dmgMult`);
    if (typeof en.hpMult === 'number' && typeof en.dmgMult === 'number') inRange(en.hpMult * en.dmgMult, CR.hpDmgProduct, `${w}: hpMult × dmgMult`);
    // Optional family tag (rules 1.9.3, expedition): regions draw part of their encounters from their families.
    if (en.family !== undefined) str(en.family, CR.len.enemyName, `${w}.family`);
    if (!Array.isArray(en.abilities)) e(`${w}.abilities: not a list`);
    else {
      const range = CR.abilities[en.kind];
      if (range && (en.abilities.length < range[0] || en.abilities.length > range[1])) e(`${w}.abilities: ${en.abilities.length} for kind ${en.kind}, expected ${range[0]}-${range[1]}`);
      for (const ab of en.abilities) if (!abilities[ab]) e(`${w}.abilities: unknown ability "${ab}"`);
    }
  }

  // Quests
  for (const [id, q] of Object.entries(quests)) {
    const w = `quests.${id}`;
    if (q.id !== id) e(`${w}: id field "${q.id}" does not match key`);
    str(q.title, CR.len.questTitle, `${w}.title`);
    str(q.giver, CR.len.enemyName, `${w}.giver`);
    str(q.text, CR.len.questText, `${w}.text`);
    str(q.turnIn, CR.len.questTurnIn, `${w}.turnIn`);
    if (!CR.objectives.includes(q.objective)) e(`${w}: unknown objective "${q.objective}"`);
    if (q.sizeWeights !== undefined) {
      const sw = q.sizeWeights;
      if (!Array.isArray(sw) || sw.length !== 3 || sw.some((x) => typeof x !== 'number' || x < 0) || sw[0] + sw[1] + sw[2] <= 0) e(`${w}.sizeWeights: need 3 non-negative weights with a positive sum`);
      else if (strict) inRange((sw[0] + 2 * sw[1] + 3 * sw[2]) / (sw[0] + sw[1] + sw[2]), CR.questSizeAvg, `${w}: average encounter size`);
    }
  }

  // Zones
  if (!Array.isArray(content.zones) || content.zones.length !== ZONE_COUNT) e(`zones: expected exactly ${ZONE_COUNT}`);
  const zones = Array.isArray(content.zones) ? content.zones : [];
  const listOf = (ids, kind, where) => {
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      if (!enemies[id]) e(`${where}: unknown enemy "${id}"`);
      else if (enemies[id].kind !== kind) e(`${where}: "${id}" has kind ${enemies[id].kind}, expected ${kind}`);
    }
  };
  zones.forEach((zn, i) => {
    const w = `zones[${i}]`;
    if (!zn || typeof zn !== 'object') { e(`${w}: not an object`); return; }
    if (zn.id !== `z${i + 1}`) e(`${w}.id: expected z${i + 1}`);
    str(zn.name, CR.len.zoneName, `${w}.name`);
    str(zn.theme, CR.len.zoneTheme, `${w}.theme`);
    str(zn.hubName, CR.len.hubName, `${w}.hubName`);
    optStr(zn.hubText, CR.len.hubText, `${w}.hubText`);
    count(zn.normals, CR.normals, `${w}.normals`);
    count(zn.elites, CR.elites, `${w}.elites`);
    count(zn.rares, CR.rares, `${w}.rares`);
    listOf(zn.normals, 'normal', `${w}.normals`);
    // Optional add pool (rules 7.12, combat v2): normal templates of this zone for summons and Signal reinforcements.
    if (zn.addPool !== undefined) {
      if (!Array.isArray(zn.addPool) || !zn.addPool.length) e(`${w}.addPool: expected a non-empty list`);
      else for (const id of zn.addPool) if (!(zn.normals || []).includes(id)) e(`${w}.addPool: "${id}" is not a normal of ${zn.id}`);
    }
    listOf(zn.elites, 'elite', `${w}.elites`);
    listOf(zn.rares, 'rare', `${w}.rares`);
    // M2b v14 (D112): the elite pool keeps a heavy and a cast Deathblow (its signature ability, rules 7.12).
    if (strict && Array.isArray(zn.elites)) {
      const types = new Set(zn.elites.map((id) => deathblowTypeOf(id)).filter(Boolean));
      if (!types.has('heavy') || !types.has('cast')) e(`${w}.elites: Deathblow types ${[...types].sort().join(', ') || 'none'}, expected at least one heavy and one cast (D112)`);
    }
    // Optional regions (rules 1.9.2, expedition): exactly REGION_COUNT of { id, name, kind, families }.
    if (zn.regions !== undefined) {
      if (!Array.isArray(zn.regions) || zn.regions.length !== REGION_COUNT) e(`${w}.regions: expected ${REGION_COUNT} regions`);
      else {
        zn.regions.forEach((r, j) => {
          const rw = `${w}.regions[${j}]`;
          if (!r || typeof r !== 'object') { e(`${rw}: not an object`); return; }
          optStr(r.id, CR.len.zoneName, `${rw}.id`);
          str(r.name, CR.len.zoneName, `${rw}.name`);
          if (!REGION_W[r.kind]) e(`${rw}.kind: unknown region kind "${r.kind}"`);
          if (r.families !== undefined && (!Array.isArray(r.families) || r.families.some((f) => typeof f !== 'string' || !f))) e(`${rw}.families: expected a list of family tags`);
        });
      }
    }
    // Optional Road names (rules 1.9.7, expedition, D51): ROAD_COUNT names, Road k of the zone graph takes name k.
    if (zn.roads !== undefined) {
      if (!Array.isArray(zn.roads) || zn.roads.length !== ROAD_COUNT) e(`${w}.roads: expected ${ROAD_COUNT} names`);
      else zn.roads.forEach((n, j) => str(n, CR.len.zoneName, `${w}.roads[${j}]`));
    }
    const d = zn.dungeon;
    if (!d || typeof d !== 'object') e(`${w}.dungeon: missing`);
    else {
      str(d.name, CR.len.zoneName, `${w}.dungeon.name`);
      str(d.text, CR.len.hubText, `${w}.dungeon.text`);
      count(d.trash, CR.dungeonTrash, `${w}.dungeon.trash`);
      listOf(d.trash, 'trash', `${w}.dungeon.trash`);
      listOf([d.boss], 'dboss', `${w}.dungeon.boss`);
    }
    count(zn.quests, CR.quests, `${w}.quests`);
    for (const q of zn.quests || []) {
      if (!quests[q]) { e(`${w}.quests: unknown quest "${q}"`); continue; }
      for (const m of quests[q].enemies || []) if (!(zn.normals || []).includes(m)) e(`quests.${q}.enemies: "${m}" is not a normal of ${zn.id}`);
    }
    const lines = (arr, min, max, where) => {
      if (!Array.isArray(arr)) { e(`${where}: not a list`); return; }
      if (arr.length < (strict ? min : 1)) e(`${where}: ${arr.length} entries, expected >= ${strict ? min : 1}`);
      arr.forEach((t, j) => str(t, max, `${where}[${j}]`));
    };
    lines(zn.shrineLines, CR.shrineLines, CR.len.line, `${w}.shrineLines`);
    lines(zn.treasureLines, CR.treasureLines, CR.len.line, `${w}.treasureLines`);
    lines(zn.junkNames, CR.junkNames, CR.len.itemName, `${w}.junkNames`);
  });

  // Camp
  if (!content.camp || typeof content.camp !== 'object') e('camp: missing');
  else {
    str(content.camp.name, CR.len.hubName, 'camp.name');
    str(content.camp.text, CR.len.hubText, 'camp.text');
    optStr(content.camp.bossText, CR.len.bossText, 'camp.bossText');
    if (content.camp.enemies !== undefined) listOf(content.camp.enemies, 'normal', 'camp.enemies');
  }

  // Item names
  if (!Array.isArray(content.itemNames) || content.itemNames.length !== ZONE_COUNT) e(`itemNames: expected exactly ${ZONE_COUNT} bands`);
  (content.itemNames || []).forEach((band, i) => {
    for (const slot of SLOT_IDS) {
      const v = band && band[slot];
      const w = `itemNames[${i}].${slot}`;
      const checkList = (arr, where) => {
        if (!Array.isArray(arr)) { e(`${where}: not a list`); return; }
        if (arr.length < (strict ? CR.itemNamesPerSlot : 1)) e(`${where}: ${arr.length} names, expected >= ${strict ? CR.itemNamesPerSlot : 1}`);
        arr.forEach((t, j) => str(t, CR.len.itemName, `${where}[${j}]`));
      };
      if (Array.isArray(v)) checkList(v, w);
      else if (v && typeof v === 'object') { checkList(v.AGI, `${w}.AGI`); checkList(v.INT, `${w}.INT`); }
      else e(`${w}: missing`);
    }
  });

  // Affix words
  const aw = content.affixWords;
  if (!aw || typeof aw !== 'object') e('affixWords: missing');
  else {
    for (const k of SUFFIX_KEYS) {
      const arr = aw.suffix && aw.suffix[k];
      if (!Array.isArray(arr) || arr.length < (strict ? CR.affixWordsPerKey : 1)) e(`affixWords.suffix.${k}: expected >= ${strict ? CR.affixWordsPerKey : 1} words`);
    }
    for (const k of ['crit', 'power', 'armor']) {
      const arr = aw.prefix && aw.prefix[k];
      if (!Array.isArray(arr) || arr.length < (strict ? CR.affixWordsPerKey : 1)) e(`affixWords.prefix.${k}: expected >= ${strict ? CR.affixWordsPerKey : 1} words`);
    }
  }

  // Uniques
  const uq = content.uniques || {};
  const counts = { rare: 0, epic: 0, weapon: 0 };
  for (const [id, u] of Object.entries(uq)) {
    const w = `uniques.${id}`;
    if (u.id !== id) e(`${w}: id field "${u.id}" does not match key`);
    str(u.name, CR.len.itemName, `${w}.name`);
    optStr(u.text, CR.len.itemText, `${w}.text`);
    if (!(u.kind in counts)) { e(`${w}: unknown kind "${u.kind}"`); continue; }
    counts[u.kind]++;
    if (!SLOT_IDS.includes(u.slot)) e(`${w}: unknown slot "${u.slot}"`);
    if (!EFFECTS.includes(u.effect)) e(`${w}: unknown effect "${u.effect}"`);
    if (!['crit', 'power', 'armor'].includes(u.affix)) e(`${w}: unknown affix "${u.affix}"`);
    if (u.kind === 'weapon') {
      if (!CLASS_IDS.includes(u.classId)) e(`${w}: weapon needs classId`);
      if (u.slot !== 'weapon') e(`${w}: class weapon must use slot weapon`);
    } else if (!(Number.isInteger(u.zone) && u.zone >= 1 && u.zone <= ZONE_COUNT)) e(`${w}: zone must be 1-${ZONE_COUNT}`);
  }
  if (strict) {
    if (counts.rare !== CR.uniqueRares) e(`uniques: ${counts.rare} rares, expected ${CR.uniqueRares}`);
    if (counts.epic !== CR.uniqueEpics) e(`uniques: ${counts.epic} epics, expected ${CR.uniqueEpics}`);
    if (counts.weapon !== CR.uniqueWeapons) e(`uniques: ${counts.weapon} class weapons, expected ${CR.uniqueWeapons}`);
  }

  // Classes
  for (const c of CLASS_IDS) {
    const t = content.classes && content.classes[c];
    if (!t) { e(`classes.${c}: missing`); continue; }
    optStr(t.text, CR.len.classText, `classes.${c}.text`);
    str(t.startWeapon, CR.len.itemName, `classes.${c}.startWeapon`);
    str(t.startChest, CR.len.itemName, `classes.${c}.startChest`);
    str(t.heirloomWeapon, CR.len.itemName, `classes.${c}.heirloomWeapon`);
  }

  // Optional texts (D51: the expedition group, ids EXPEDITION_TEXT_IDS)
  const expeditionIds = Object.fromEntries(EXPEDITION_TEXT_IDS.map((id) => [id, true]));
  const known = { spells: SPELL, talents: TALENT, pets: PET, boons: BOON, consumables: CONSUMABLE, expedition: expeditionIds };
  // Expedition contract and prep texts (2b.5): object-shaped entries.
  const famIds = {};
  for (const z of content.zones || []) {
    for (const k of ['normals', 'elites', 'rares', 'dungeonTrash']) for (const t of z[k] || []) if (t.family) famIds[t.family] = true;
    for (const r of z.regions || []) for (const f of r.families || []) famIds[f] = true;
  }
  const shaped = {
    families: [famIds, ['singular', 'plural']],
    prep: [PREP_OPTION, ['name', 'flavour', 'rule']],
    contracts: [{ cull: 1, bounty: 1, delve: 1, hub: 1 }, null],
  };
  for (const [group, map] of Object.entries(content.texts || {})) {
    if (shaped[group]) {
      const [ids, fields] = shaped[group];
      for (const [id, t] of Object.entries(map || {})) {
        if (!ids[id]) e(`texts.${group}.${id}: unknown id`);
        if (fields) for (const f of fields) str(t && t[f], CR.len.flavour, `texts.${group}.${id}.${f}`);
        else str(t, CR.len.flavour * 2, `texts.${group}.${id}`);
      }
      continue;
    }
    if (!known[group]) { e(`texts.${group}: unknown group`); continue; }
    for (const [id, t] of Object.entries(map || {})) {
      if (!known[group][id]) e(`texts.${group}.${id}: unknown id`);
      str(t, CR.len.flavour, `texts.${group}.${id}`);
    }
  }
  // M3 (E2): the guided-run table, when present
  if (content.tutorial !== undefined) err.push(...validateTutorial(content));
  return err;
}
