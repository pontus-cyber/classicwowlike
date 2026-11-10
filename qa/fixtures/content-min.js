// Minimal fixture content for engine tests (qa/engine) and early integration.
// Follows src/content/SCHEMA.md. Names are deliberately plain placeholders.
// It passes the structural validator; it uses the strict minimum counts where cheap
// (6 normals per zone, one of each archetype) so every archetype is exercised.
// Combat v2 (rules 7.12): zone 1 has an add pool (summons and Signal reinforcements); the other zones use their
// normals.

const ARCHES = ['brute', 'skulker', 'caster', 'beast', 'guardian', 'mender'];
const SLOTS = ['head', 'chest', 'legs', 'hands', 'feet', 'neck', 'ring', 'trinket', 'weapon', 'offhand'];

const abilities = {
  ab_heavy: { id: 'ab_heavy', template: 'heavy_blow', name: 'Fixture Heavy Blow', pct: 1.9, cd: 3 },
  ab_dark: { id: 'ab_dark', template: 'dark_cast', name: 'Fixture Dark Cast', pct: 2.1, cd: 4 },
  ab_cleave: { id: 'ab_cleave', template: 'cleave_all', name: 'Fixture Cleave', pct: 0.85, cd: 3 },
  ab_rend: { id: 'ab_rend', template: 'rend', name: 'Fixture Rend', pct: 0.65, tickPct: 0.2, cd: 3 },
  ab_curse: { id: 'ab_curse', template: 'curse', name: 'Fixture Curse', cd: 4 },
  ab_heal: { id: 'ab_heal', template: 'self_heal', name: 'Fixture Self Heal', pct: 0.18, cd: 5 },
  ab_shield: { id: 'ab_shield', template: 'self_shield', name: 'Fixture Shield', pct: 0.2, cd: 5 },
  ab_enrage: { id: 'ab_enrage', template: 'enrage', name: 'Fixture Enrage', pct: 0.4 },
  ab_summon: { id: 'ab_summon', template: 'summon', name: 'Fixture Summon', count: 1 },
};

const ELITE_AB = [['ab_heavy'], ['ab_dark'], ['ab_cleave'], ['ab_rend'], ['ab_curse'], ['ab_shield']];
const RARE_AB = [['ab_enrage', 'ab_heavy'], ['ab_summon', 'ab_dark'], ['ab_heal', 'ab_cleave'],
  ['ab_enrage', 'ab_rend'], ['ab_summon', 'ab_curse'], ['ab_heal', 'ab_dark']];
const DBOSS_AB = [['ab_heavy', 'ab_dark'], ['ab_dark', 'ab_rend'], ['ab_heavy', 'ab_curse'],
  ['ab_dark', 'ab_shield'], ['ab_heavy', 'ab_heal'], ['ab_dark', 'ab_cleave']];

const enemies = {};
const quests = {};
const zones = [];
const itemNames = [];

function enemy(id, name, kind, archetype, abilityIds) {
  enemies[id] = { id, name, kind, archetype, hpMult: 1, dmgMult: 1, abilities: abilityIds, text: `${name}.` };
  return id;
}

for (let z = 1; z <= 6; z++) {
  const normals = ARCHES.map((a) => enemy(`z${z}_${a}`, `Z${z} ${a}`, 'normal', a, []));
  const elite = enemy(`z${z}_elite`, `Z${z} Elite`, 'elite', z % 2 ? 'brute' : 'caster', ELITE_AB[z - 1]);
  const rare = enemy(`z${z}_rare`, `Z${z} Rare`, 'rare', z % 2 ? 'beast' : 'guardian', RARE_AB[z - 1]);
  const trash = ['brute', 'caster', 'mender'].map((a) => enemy(`z${z}_trash_${a}`, `Z${z} Trash ${a}`, 'trash', a, []));
  const boss = enemy(`z${z}_dboss`, `Z${z} Dungeon Boss`, 'dboss', 'brute', DBOSS_AB[z - 1]);
  const qids = [];
  for (let q = 1; q <= 3; q++) {
    const id = `q_z${z}_${q}`;
    quests[id] = {
      id, title: `Zone ${z} Quest ${q}`, giver: `Giver ${z}-${q}`, objective: ['slay', 'gather', 'rescue'][q - 1],
      text: `Fixture quest ${q} of zone ${z}.`, turnIn: 'Thank you.',
      ...(q === 3 ? { sizeWeights: [20, 50, 30], enemies: normals.slice(0, 3) } : {}),
    };
    qids.push(id);
  }
  zones.push({
    id: `z${z}`, name: `Fixture Zone ${z}`, theme: `Theme ${z}.`, hubName: `Hub ${z}`, hubText: 'A hub.',
    normals, elites: [elite], rares: [rare],
    ...(z === 1 ? { addPool: [normals[0], normals[1], normals[3]] } : {}),
    dungeon: { name: `Dungeon ${z}`, text: 'A dungeon.', trash, boss },
    quests: qids,
    shrineLines: ['A shrine.', 'A quiet shrine.'],
    treasureLines: ['A chest.', 'A buried chest.'],
    junkNames: [`Junk ${z}A`, `Junk ${z}B`, `Junk ${z}C`],
  });
  const band = {};
  for (const s of SLOTS) {
    band[s] = s === 'weapon'
      ? { AGI: [`Blade ${z}a`, `Blade ${z}b`, `Bow ${z}`], INT: [`Staff ${z}a`, `Staff ${z}b`, `Wand ${z}`] }
      : [`${s} ${z}a`, `${s} ${z}b`, `${s} ${z}c`];
  }
  itemNames.push(band);
}

const uniques = {};
const EFFECTS = ['proc', 'healOnKill', 'eliteDmg', 'potion', 'ward', 'proc'];
for (let z = 1; z <= 6; z++) {
  uniques[`u_rare_z${z}`] = { id: `u_rare_z${z}`, name: `Unique Rare ${z}`, kind: 'rare', zone: z,
    slot: ['ring', 'neck', 'trinket', 'offhand', 'head', 'hands'][z - 1], effect: EFFECTS[z - 1], affix: 'power', text: 'Rare.' };
  uniques[`u_epic_z${z}`] = { id: `u_epic_z${z}`, name: `Unique Epic ${z}`, kind: 'epic', zone: z,
    slot: ['chest', 'legs', 'feet', 'trinket', 'ring', 'neck'][z - 1], effect: EFFECTS[(z + 2) % 6], affix: 'crit', text: 'Epic.' };
}
for (const c of ['rogue', 'mage', 'hunter']) {
  uniques[`u_weapon_${c}`] = { id: `u_weapon_${c}`, name: `Starforged ${c}`, kind: 'weapon', classId: c,
    slot: 'weapon', effect: 'eliteDmg', affix: 'power', text: 'Forged from a fallen star.' };
}

const suffixKeys = ['AGI', 'INT', 'STA', 'AGI_STA', 'AGI_SPI', 'INT_STA', 'INT_SPI', 'AGI_STA_SPI', 'INT_STA_SPI'];
const suffix = {};
for (const k of suffixKeys) suffix[k] = [`of ${k} I`, `of ${k} II`];

export const CONTENT = {
  version: 'fixture-min-1',
  zones,
  camp: { name: 'Fixture Camp', text: 'The last camp.', bossText: 'The boss.' },
  enemies,
  abilities,
  quests,
  itemNames,
  affixWords: { suffix, prefix: { crit: ['Keen', 'Sharp'], power: ['Mighty', 'Fierce'], armor: ['Sturdy', 'Stout'] } },
  uniques,
  classes: {
    rogue: { text: 'Fixture rogue.', startWeapon: 'Fixture Dirk', startChest: 'Fixture Jerkin', heirloomWeapon: 'Heirloom Dirk' },
    mage: { text: 'Fixture mage.', startWeapon: 'Fixture Staff', startChest: 'Fixture Robe', heirloomWeapon: 'Heirloom Staff' },
    hunter: { text: 'Fixture hunter.', startWeapon: 'Fixture Bow', startChest: 'Fixture Vest', heirloomWeapon: 'Heirloom Bow' },
  },
  texts: {},
};

export default CONTENT;
