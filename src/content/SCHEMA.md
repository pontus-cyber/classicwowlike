# Content schema (engine contract)

Owner: Core Gameplay Engineer. Audience: Content Designer, UI/UX Engineer.
Authority: docs/specs/rules.md section 12 (ranges) and D14 (the engine never hard-codes content).

The engine reads one plain-data object, `CONTENT`, and never mutates it. Content holds names, text and
the per-enemy choices the designer leaves open (archetype, multipliers, abilities). Every rule number lives
in src/constants.js, not here.

## 1. Files and entry point
- Content lives in `src/content/*.js` as ES modules with plain data only (objects, arrays, strings, numbers,
  booleans). No functions, no classes, no `Math.random`, no imports from src/engine.
- Split the data into files as you like. **`src/content/index.js` must export `CONTENT`** (named export) with
  the shape in section 2. The engine, the simulator and the UI import only that.
- Ids: lowercase `snake_case`, unique per table, ASCII. Ids are stable: saved runs refer to them.
- Text: plain UTF-8, no markup. Lengths below are hard limits checked by the validator.
- Validate with `node --test qa/engine/` (the content test validates `src/content/index.js` when it exists,
  strict mode) or call `validateContent(CONTENT, {strict: true})` from `src/rules.js`, which returns a list of
  error strings (empty = valid).

## 2. Top level
```js
export const CONTENT = {
  version: 'm1-content-1',   // free label, shown in run summaries
  zones: [ /* exactly 6 Zone objects, index 0 = Z1 (levels 1-10) ... index 5 = Z6 (51-60) */ ],
  camp: { /* Camp */ },
  enemies: { /* id -> EnemyTemplate (all zones, dungeons and camp) */ },
  abilities: { /* id -> Ability (ability instances used by elites, rares, dungeon bosses) */ },
  quests: { /* id -> QuestTemplate */ },
  itemNames: [ /* exactly 6 ItemNameBand objects, index 0 = Z1 band (ilvl 1-10) ... */ ],
  affixWords: { /* AffixWords */ },
  uniques: { /* id -> UniqueItem: 6 rares, 6 epics, 3 class weapons */ },
  classes: { rogue: { /* ClassText */ }, mage: {}, hunter: {} },
  texts: { /* optional flavour for engine-defined ids (section 2.10) */ },
  tutorial: { /* optional: the guided first run (section 2.11, M3) */ },
};
```

### 2.1 Zone (rules 1.3, 12.1)
| Field | Type | Rule |
|---|---|---|
| `id` | string | `z1` .. `z6`, in order |
| `name` | string | <= 28 chars |
| `theme` | string | one line, <= 100 chars |
| `hubName` | string | <= 28 chars |
| `hubText` | string | optional, <= 140 chars |
| `normals` | id[] | 6-9 EnemyTemplate ids with `kind: 'normal'` |
| `elites` | id[] | 2-3 ids with `kind: 'elite'` |
| `rares` | id[] | 1-2 ids with `kind: 'rare'` |
| `dungeon` | object | `{ name, text, trash: id[] (3-5, kind 'trash'), boss: id (kind 'dboss') }`; name <= 28, text <= 140 |
| `addPool` | id[] | optional, non-empty subset of `normals`: the templates a Signal reinforcement or a template summon draws from (combat-v2 4.2). Default: all `normals`. Prefer brute, skulker and beast templates (fighters, not support) |
| `regions` | object[] | optional, exactly 4 (REGION_COUNT): `{ id, name (<= 28), kind ('wilds' \| 'road' \| 'haunt' \| 'steads'), families: string[] }`. Kind sets the node mix (rules 1.9.2); `families` are the family tags (2.3) the region draws REGION_FAMILY_SHARE of its encounter mobs from. Expedition maps only. Use one region of each kind per zone |
| `roads` | string[] | optional, exactly 3 (ROAD_COUNT) Road names, each <= 28 chars (D51). Road k of the expedition map (rules 1.9.2: the Roads in rim order from the first drawn one) takes name k; the map view and the `travel` event show them. Expedition maps only |
| `quests` | id[] | 8-12 QuestTemplate ids |
| `shrineLines` | string[] | >= 2, each <= 100 chars (shown on Shrine nodes) |
| `treasureLines` | string[] | >= 2, each <= 100 chars (shown on Treasure nodes) |
| `junkNames` | string[] | >= 3 grey junk item names, each <= 30 chars |

```js
{
  id: 'z1', name: 'Hollowmere Fields', theme: 'Farmland and the dark edge of the old forest.',
  hubName: 'Mossgate Crossing', hubText: 'A mill, a well and a tired militia.',
  normals: ['z1_fen_hog', 'z1_reed_lurker', /* ... 6-9 */],
  elites: ['z1_old_tusker', 'z1_barrow_hag'],
  rares: ['z1_ashen_stag'],
  dungeon: { name: 'The Drowned Granary', text: 'Rats, rot and something worse below the mill.',
             trash: ['z1_granary_rat', 'z1_mill_ghoul', 'z1_sack_golem'], boss: 'z1_miller_below' },
  quests: ['q_z1_lost_flock', /* ... 8-12 */],
  shrineLines: ['A moss-grown stone hums softly.', 'Wildflowers ring a weathered idol.'],
  treasureLines: ['A strongbox lies half sunk in the mud.', 'A cart lies overturned by the road.'],
  junkNames: ['Cracked Hoof', 'Torn Sackcloth', 'Bent Nail'],
}
```

### 2.2 Camp (rules 1.6, 10)
The end boss (Oruvath, the Unlit Star), the Dimming Shards and the raid name (the Sunken Observatory) are
fixed by rules 10; the camp only adds text and the mob list for `CAMP_GRIND` waves.

| Field | Type | Rule |
|---|---|---|
| `name` | string | camp name, <= 28 chars |
| `text` | string | <= 140 chars |
| `enemies` | id[] | optional: normal templates for camp grind waves. Default: Z6 `normals` |
| `bossText` | string | optional, <= 240 chars, boss intro |

```js
{ name: 'Observatory Steps', text: 'The last fire before the drowned dome.', bossText: 'The star that swallowed its own light.' }
```

### 2.3 EnemyTemplate (rules 7.6, 12.2)
Level is not part of the template: the node sets it (normal at the row's content level, elite +2, dungeon
per rules 1.4). The engine computes HP, damage and armor from the archetype, the variant multipliers and
the two template multipliers below.

| Field | Type | Rule |
|---|---|---|
| `id` | string | unique |
| `name` | string | <= 28 chars |
| `kind` | string | `normal`, `elite`, `rare`, `trash` (dungeon trash), `dboss` (dungeon boss) |
| `archetype` | string | `brute`, `skulker`, `caster`, `beast`, `guardian`, `mender` (rules 7.6) |
| `hpMult` | number | 0.85-1.20 |
| `dmgMult` | number | 0.85-1.20, and `hpMult × dmgMult` in 0.90-1.15 |
| `abilities` | id[] | Ability ids. normal and trash: `[]`; elite: exactly 1; rare: exactly 2; dboss: exactly 2 |
| `family` | string | optional tag (<= 28 chars, lowercase word) on normal, elite and rare templates (expedition regions and contracts). Every family used in a zone needs 2+ normal templates of different archetypes there, and not only guardian plus mender (rules 7.14) |
| `text` | string | <= 140 chars |

```js
z1_old_tusker: { id: 'z1_old_tusker', name: 'Old Tusker', kind: 'elite', archetype: 'beast',
  hpMult: 1.1, dmgMult: 1.0, abilities: ['ab_tusk_charge'], text: 'Scarred, slow and still the king of the fields.' }
```

### 2.4 Ability (rules 12.4)
One concrete ability instance. Several enemies may share one. `template` fixes the mechanic; you choose the
name and the numbers inside the ranges.

| `template` | Fields (range) | Mechanic |
|---|---|---|
| `heavy_blow` | `pct` 1.60-2.20, `cd` 3-4 | physical hit, flagged heavy |
| `dark_cast` | `pct` 1.80-2.50, `cd` 3-5 | magic hit, flagged cast (interruptible) |
| `cleave_all` | `pct` 0.70-1.00, `cd` 3 | physical hit on the player and the pet |
| `rend` | `pct` 0.50-0.80, `tickPct` 0.15-0.25, `cd` 3 | physical hit + BLEED 3 rounds |
| `curse` | `cd` 4 | CURSED 3 rounds on the player, cast |
| `self_heal` | `pct` 0.15-0.20, `cd` 5 | heal self (fraction of max HP), cast |
| `self_shield` | `pct` 0.15-0.25, `cd` 5 | absorb shield (fraction of max HP) |
| `enrage` | `pct` 0.30-0.50 | once, passive: below 30 % HP deals +pct damage |
| `summon` | `count` 1-2 | once, at or below 50 % HP: summons `count` normal mobs of the zone |

`pct` is a fraction of the enemy's 100 % damage (hits), of its max HP (heal, shield) or a damage bonus
(enrage). Fields: `id`, `template`, `name` (<= 28), the fields in the table, `text` (optional, <= 140).

```js
ab_tusk_charge: { id: 'ab_tusk_charge', template: 'heavy_blow', name: 'Tusk Charge', pct: 1.9, cd: 3,
  text: 'Lowers its head and charges.' }
```

### 2.5 QuestTemplate (rules 2.1, 12.3)
Mechanics are fixed by rules 2.1; the objective type is flavour only.

| Field | Type | Rule |
|---|---|---|
| `id` | string | unique |
| `title` | string | <= 32 chars |
| `giver` | string | quest giver name, <= 28 chars |
| `objective` | string | `slay`, `gather`, `rescue`, `deliver`, `scout` |
| `text` | string | <= 240 chars, two sentences at most |
| `turnIn` | string | <= 120 chars |
| `sizeWeights` | number[3] | optional weights for 1/2/3 mobs; average size 1.6-2.4. Default `[25, 50, 25]` |
| `enemies` | id[] | optional subset of the zone's `normals` the encounter draws from. Default: all zone normals. Keep it valid by itself (rules 7.14): 2+ archetypes, at least one of caster, mender, skulker or beast, and never a guardian with only menders, so composition repair stays inside the list |

```js
q_z1_lost_flock: { id: 'q_z1_lost_flock', title: 'The Lost Flock', giver: 'Shepherd Wenna', objective: 'rescue',
  text: 'My sheep fled into the reeds when the hogs came. Bring back whatever the hogs left.',
  turnIn: 'Six of nine. Better than none, and better than me going in there.',
  sizeWeights: [30, 50, 20], enemies: ['z1_fen_hog', 'z1_reed_lurker'] }
```

### 2.6 ItemNameBand (rules 8.1, 12.1)
Base names for generated items, one band per zone (item level band of that zone). Keys are slot ids:
`head`, `chest`, `legs`, `hands`, `feet`, `neck`, `ring`, `trinket`, `weapon`, `offhand`. Each slot holds at
least 3 names (<= 30 chars, room for affix words). A slot may instead hold `{ AGI: [...], INT: [...] }` when
names should follow the item's primary stat (each list >= 3). Items above ilvl 60 use band 6.

```js
{ head: ['Wool Hood', 'Leather Cap', 'Iron Coif'], chest: ['Quilted Vest', 'Hide Jerkin', 'Ring Shirt'],
  legs: ['...'], hands: ['...'], feet: ['...'], neck: ['...'], ring: ['...'], trinket: ['...'],
  weapon: { AGI: ['Skinning Knife', 'Hunting Bow', 'Short Blade'], INT: ['Ash Wand', 'Oak Staff', 'Reed Rod'] },
  offhand: ['Buckler', 'Lantern', 'Tome'] }
```

### 2.7 AffixWords (rules 8.3, 12.1)
Generated name = `[prefix] base [suffix]`. The suffix follows the item's stat signature (stats with
points > 0, in the order AGI, INT, STA, SPI, joined by `_`); the prefix follows the affix of rare and epic
items. Each list >= 2 words. Items with no stat points get no suffix.

```js
{ suffix: { AGI: ['of the Fox', 'of Quickness'], INT: ['of the Owl', 'of Insight'], STA: ['of the Ox', 'of Endurance'],
            AGI_STA: ['of the Wolf', 'of the Hunt'], AGI_SPI: ['of the Hare', 'of the Wind'],
            INT_STA: ['of the Bear', 'of Warding'], INT_SPI: ['of the Heron', 'of Stillness'],
            AGI_STA_SPI: ['of the Wilds', 'of the Ranger'], INT_STA_SPI: ['of the Sage', 'of the Stars'] },
  prefix: { crit: ['Keen', 'Piercing'], power: ['Mighty', 'Fierce'], armor: ['Sturdy', 'Bastion'] } }
```
Required suffix keys: `AGI`, `INT`, `STA`, `AGI_STA`, `AGI_SPI`, `INT_STA`, `INT_SPI`, `AGI_STA_SPI`, `INT_STA_SPI`.

### 2.8 UniqueItem (rules 11.2, 11.3)
Stats follow the normal budget at the item's rarity and level; content picks name, slot, effect and the
affix. 6 rares (`kind: 'rare'`, one per zone 1-6, meta Cache of the Wanderer: elite and treasure pools of
that zone), 6 epics (`kind: 'epic'`, one per zone's dungeon, meta Relics of the Deep: that dungeon boss's
pool), 3 class weapons (`kind: 'weapon'`, slot `weapon`, ilvl 62, one per class, kept in content but not sold or dropped since the Starforged Arms unlock was removed in M2 v5, D45;
formerly sold by the Camp vendor).

| Field | Type | Rule |
|---|---|---|
| `id` | string | unique |
| `name` | string | <= 30 chars |
| `kind` | string | `rare`, `epic`, `weapon` |
| `zone` | number | 1-6 (rare and epic only) |
| `classId` | string | `rogue`, `mage`, `hunter` (weapon only) |
| `slot` | string | slot id (2.6); weapons: `weapon` |
| `effect` | string | `proc` (on-hit magic proc), `healOnKill`, `eliteDmg`, `potion` (potion healing), `ward` (WARD at fight start) |
| `affix` | string | `crit`, `power` or `armor` |
| `text` | string | flavour, <= 100 chars |

```js
u_z1_rare: { id: 'u_z1_rare', name: 'Wenna\'s Lucky Bell', kind: 'rare', zone: 1, slot: 'trinket',
  effect: 'healOnKill', affix: 'power', text: 'It rang every time a sheep came home.' }
```

### 2.9 ClassText
Class names, spells, talents and pets are fixed by rules 5 and 6. Content adds text and starting gear names.

| Field | Type | Rule |
|---|---|---|
| `text` | string | class description, <= 240 chars |
| `startWeapon` | string | name of the common ilvl 1 starting weapon, <= 30 chars |
| `startChest` | string | name of the common ilvl 1 starting chest, <= 30 chars |
| `heirloomWeapon` | string | name of the meta Heirloom Blade weapon (uncommon ilvl 3), <= 30 chars |

```js
rogue: { text: 'Strikes from the shadows, builds combo points, spends them on finishers.',
  startWeapon: 'Chipped Dirk', startChest: 'Patched Jerkin', heirloomWeapon: 'Grandmother\'s Dirk' }
```

### 2.10 Spell, talent, pet, boon, consumable, status and expedition text (optional)
`texts` holds optional flavour lines for ids defined by the engine (rules 5, 6, 2.9, 8.6). Unknown ids are
reported by the validator. Each line <= 140 chars. Group `expedition` (D51; rules 1.9.5-1.9.7) has the ids
`shardfall`, `shardspawn`, `dimming` and `homeward_bell` (C.EXPEDITION_TEXT_IDS); the expedition map view returns them
as `mapView(state).texts`. src/content/texts.js holds the shipped lines.

```js
texts: { spells: { ember_bolt: 'A bolt of living ember.' }, talents: { r_a1: '...' }, pets: { ridgewolf: '...' },
         boons: { return: '...' }, consumables: { healing_draught: '...' },
         expedition: { shardfall: '...', shardspawn: '...', dimming: '...', homeward_bell: '...' } }
```

### 2.11 Tutorial (M3 guided first run; docs/specs/m3-onboarding.md 2.3-2.7, 3.2, 4.3; draft)
Optional. `src/content/tutorial.js` (`TUTORIAL`). The engine reads the overlay (E2); the UI reads the lines. Levels,
counts and every rule number stay constants (ONB_*, spec 12). Beat and hint ids keep the spec's form (`G1`..`G13`,
`H01`..`H37`), not snake_case, because the UI stores seen hints by them (`tbwcr.hints.v2`).

| Field | Type | Rule |
|---|---|---|
| `seed` | number | the accepted TUTORIAL_SEED (cross-check only; the engine reads `C.TUTORIAL_SEED`) |
| `zone` | number | 1 (the guided zone) |
| `board` | object | start camp slot 1: `{ slot: 1, kind: 'cull', z, region (a region id of zone z), family (a family of that region) }` |
| `siteFights` | object[] | Cull site fights by order of the site fights started (the last repeats): `{ id, beat, quest?, enemies: Fight[] }`; (D144) `quest`: a quest id whose enemies are this fight's, shown by a Quest node while it plays the fight |
| `scripts` | object[] | exactly ONB_SCRIPTED_FIGHTS scripted fights in order: `{ id ('s1'..), beat, teaches (designer note), quest?, enemies: Fight[], loot? }`; `loot: { upgrade: rarity id, consumable: CONSUMABLE id }` (count ONB_LOOT_POTIONS); (D144) `quest` as in `siteFights` |
| Fight | object | `{ enemy: id of a zone normal, windup?: true }`. In the guided zone only `windup: true` makes an enemy's turn-ONB_WINDUP_TURN action (1, m3-onboarding.md 2.8 item 6; D149, draft) a wind-up (FIRST_MEET_WINDUP is off for the other guided-zone fights) |
| `elite` | object | `{ id, beat, enemy (a zone elite), deathblow (an ability id of that enemy), add: false, rare: false, gate }` |
| `elite.gate` | object | `{ afterScript: a script id, barredLine, openLine }`: the elite's node cannot be entered until that scripted fight has ended (win, flight or rescue); open after SKIP_GUIDE. `{n}` = scripted fights still to come |
| `guide` | object | `{ rescueLine, endLine }` (spec 2.6, 2.7); (D147) `rescueCapLine`: the ONB_RESCUE_MAX-th rescue ends the guide (event `guideSkipped` with `why: 'rescues'`); (draft, engine-2026-11-14b) `rescueLeftLine`: with the rescue's line on a rescue that leaves the guide on, `{rescuesLeft}` = rescues still to come (spec 2.6), and `skipLine`: SKIP_GUIDE ended the guide (event `guideSkipped` without `why`); (D144) `hubLine`, `hubTrainerLine`: the welcome at a zone hub in any run, the trainer line only while `R.trainerView(state).useful`; `{zone}` = the zone's name |
| `beats` | object[] | exactly 13: `{ id, name, anchor, line \| byClass { rogue, mage, hunter }, alt?: { state: line }, hint?: hint id }`; (D147) G8 `alt.withEngage`: the joint line of G7 and G8 in one engage round (spec 2.8) |
| `hints` | object[] | exactly 37: `{ id, system, line \| sameAs (a beat id), perClass?: true, alt?: { state: line } }`; (D144) H05 `alt.shield`: the off-balance target's shield absorbs a whole hit (`R.offBalance(...).absorbs`) |
| `nudge` | object | `{ unlock (META id), welcomeLabel, summaryLine, hallLine, later }` (spec 4.2-4.3) |

Lines: one sentence each, at most ONB_HINT_MAX_CHARS (90) after the placeholders are filled; no "hours", "h" or
decimals. Placeholders the UI fills: keys from its key map `{key_spell1}`, `{key_engage1}`, `{key_engage2}`,
`{key_engage3}`, `{key_pass}`, `{key_item1}`, `{key_take_all}`, `{key_bags}`, `{key_talents}`, `{key_spellbook}`,
`{key_autoplay}`, `{key_flee}`; numbers from C `{deathblowTurn}` (SIGNATURE_TURN; no line uses it since D144), `{bellTolls}` (BELL_CHANNEL_TIME),
`{offbalPct}` (OFFBAL_TAKEN × 100), `{rescueTolls}` (ONB_RESCUE_TOLLS), `{satchelPotions}` (META.satchel.potions),
`{n}` (gate); the zone's name `{zone}` (D144, the hub lines); `{rescuesLeft}` (draft: `tutorialView` `rescueMax` -
`rescues` after the rescue, ONB_RESCUE_MAX - rescues). The validator does not check this table yet (engine task E2).

## 3. Counts (rules 12.1)
| Table | Per zone | Total |
|---|---|---|
| Zone | 1 | 6 |
| Normal enemy templates | 6-9 | 36-54 |
| Elite templates | 2-3 | 12-18 |
| Rare elite templates | 1-2 | 6-12 |
| Dungeon (name, 3-5 trash, 1 boss) | 1 | 6 |
| Quest templates | 8-12 | 48-72 |
| Item base names per slot per band | >= 3 | >= 180 |
| Affix words per key | >= 2 | - |
| Uniques: rares / epics / class weapons | - | 6 / 6 / 3 |
| Shrine and treasure lines | 2 each | 12 each |
| Junk names | >= 3 | >= 18 |

The validator has two modes: `strict` (the counts above, used for src/content) and structural (only what
the engine needs to run, used for the test fixture in qa/fixtures/content-min.js).

## 4. How the engine uses content (so names and numbers land where you expect)
- Quest node: the quest template is drawn from the zone's `quests` (stream `node`); its `sizeWeights` and
  `enemies` set the encounter. A zone's quests can repeat within a run when there are more quest nodes than
  templates, so write 8-12.
- Grind and treasure guards: zone `normals`. Elite nodes: zone `elites`; the rare variant uses zone `rares`.
  Elite adds: zone `normals`. Dungeons: `dungeon.trash` and `dungeon.boss`. Summons and Signal reinforcements: zone `addPool`, else `normals`.
- Generated item names: base name from `itemNames[band][slot]`, words from `affixWords`. The name is picked
  with a hash of the item, not from a game stream, so names never change drops.
- Junk: a name from the zone's `junkNames`.
- Uniques replace a generated item of the same rarity at UNIQUE_DROP_CHANCE when the profile owns the
  unlock (rules 8.4, 11.3).
