# Rules spec (M0 task 0.2)

Owner: Lead Game Designer. Status: draft for Lead review, 2026-11-09; M2 v4 changes 2026-11-10 (marked "(M2 v4)"); M2 v5 changes 2026-11-10 (marked "(M2 v5)"); combat v2 (docs/specs/combat-v2.md, on its defaults) folded into sections 3, 7 and 13 by the Core Gameplay Engineer, 2026-11-10 (marked "(combat v2)"); the expedition map (docs/specs/expedition.md 1, 4-7, 9.5; a run option until the switch-over) folded into 1.9 and 13 by the Core Gameplay Engineer, 2026-11-10 (marked "(expedition)"); heat (docs/specs/expedition.md section H, on its defaults, both map modes) folded into 1.7.1-1.7.4, 1.9.10, 8.4, 9, 11.1 and 13 by the Core Gameplay Engineer, 2026-11-10 (marked "(heat)"); combat v2.1 (docs/specs/combat-v2.md 16, docs/specs/changes-combat-v21.md) in section 7 and 13 by the Lead Game Designer, 2026-11-10 (marked "(combat v2.1)"), in the engine since 2026-11-10 (Core Gameplay Engineer, docs/handoffs/engineer-2026-11-10g.md; its clarifications in 7.11 and 7.12 are marked "(combat v2.1, engine)"); tuning pass M2b v6 by the Lead Game Designer, 2026-11-11 (docs/specs/changes-m2b-v6.md; marked "(M2b v6)"); time in tolls and the Furnace, M2b v7 by the Lead Game Designer, 2026-11-11 (docs/specs/changes-m2b-v7.md; rule lines marked "(M2b v7)"; in the engine since 2026-11-11, docs/handoffs/engineer-2026-11-11d.md). M2b v7 renamed every time constant from HOURS_* / *_H to TIME_* (values unchanged, list in changes-m2b-v7.md); lines changed only by that rename are not marked. Tuning pass M2b v8 by the Lead Game Designer, 2026-11-11 (docs/specs/changes-m2b-v8.md rows 1-9, D72-D77; status draft as that file: BOSS_DMG_MULT 1.30 until the sim's ladder confirms it, D77 open to the owner's veto), folded into 5.1, 6.1, 6.3, 7.5, 7.6, 10.1, 11.2 and 13 by the Core Gameplay Engineer with the engine, 2026-11-11 (docs/handoffs/engineer-2026-11-11e.md; marked "(M2b v8)"). Tuning pass M2b v9 by the Lead Game Designer, 2026-11-11 (docs/specs/changes-m2b-v9.md rows 1-4, D78-D81; status draft as that file; row 2's Beastbond values are the main arm, the sim's arm B may replace them (D79); row 5 is a balance.md target under owner review, O4), folded into 6.1, 6.3, 7.6, 11.1 and 13 by the Core Gameplay Engineer with the engine, 2026-11-11 (docs/handoffs/engineer-2026-11-11g.md; marked "(M2b v9)"). Expedition tuning M2b v10 by the Lead Game Designer, 2026-11-11 (docs/specs/changes-m2b-v10.md rows A1-A3, B1-B4, C1, D82-D86; status draft as that file; XP_WEIGHT_MULT 1.4 until the sim's cell-8 rule, DUNGEON_DIM_HOLD kept by the same cell), folded into 1.9, 1.9.6, 1.9.8, 1.9.9, 1.9.10 and 13 by the Core Gameplay Engineer with the engine, 2026-11-11 (same hand-off; marked "(M2b v10)"; the contract rows are in expedition.md 3.1 and 13). The flip package M2b v11 by the Lead Game Designer, 2026-11-11 (docs/specs/changes-m2b-v11.md engine rows 1-4 and the gated row 8, D91-D94, D98; status draft as that file; row 8 is a named constant at its old value until the sim's gate passes), and the meta catalogue of expedition.md 8.2, folded into 1.9, 1.9.5, 1.9.6, 1.9.8, 2.4, 5.6, 8.4, 11.2 and 13 by the Core Gameplay Engineer with the engine, 2026-11-11 (docs/handoffs/engineer-2026-11-11h.md; marked "(M2b v11)"; the Delve price is in expedition.md 2.2 and 13). The last package before the flip, M2b v12 by the Lead Game Designer, 2026-11-11 (docs/specs/changes-m2b-v12.md engine rows 1-2 and the gated row 5, D100, D101, D104; status draft as that file): v11's outcomes (EXPED_DROP_MULT 1.9, DUNGEON_DIM_HOLD removed, Beastcall Horn stays 12 without its gated switch), the new TIME_DIM_ESCAPE, and Ricochet Bolt's bounce as a named constant at its old value 0.40 until the sim's gate passes, folded into 1.9.6, 1.9.8, 1.9.9, 1.9.10, 5, 8.4 and 13 by the Core Gameplay Engineer with the engine, 2026-11-11 (docs/handoffs/engineer-2026-11-11i.md; marked "(M2b v12)"; the Delve price 2 is in expedition.md 13). Its gated row 5 passed (docs/reports/balance-2026-11-11h.md): Ricochet Bolt bounces at 30 % (5.6, 13). Combat package M2b v13 "special fights demand thought" by the Lead Game Designer, 2026-11-11 (docs/specs/changes-m2b-v13.md rows 1-6, D105-D109; owner go-ahead 21:26 with O11-O13 on their defaults): the Deathblow, DEATHBLOW_EMPOWER with summed wind-up stacks, MAIMED, autoplay rule E2, and the gated rows 5-6 (zone-1 rare HP, first meeting) behind switches that stay off until the sim's gates pass, folded into 2.3, 7.2, 7.4, 7.5, 7.9, 7.12 and 13 by the Core Gameplay Engineer with the engine, 2026-11-11 (docs/handoffs/engineer-2026-11-11j.md; marked "(M2b v13)"; targets B59-B62 are the sim's, changes-m2b-v13.md and balance.md). Tuning M2b v14 by the Lead Game Designer, 2026-11-12 (docs/specs/changes-m2b-v14.md rows 1, 2 and 4, D111-D113; status draft as that file): autoplay rule H and the PASS that keeps STEALTH while every living enemy is SAPPED, a hidden elite's Deathblow type on the map with its content invariant, and the v13 switches on by default, folded into 1.9.5, 2.3, 7.4, 7.9, 7.12, 12.4 and 13 by the Core Gameplay Engineer with the engine, 2026-11-12 (docs/handoffs/engineer-2026-11-12.md; marked "(M2b v14)"). The expedition map (1.9) with the start camp is the default since D116 (2026-11-12, docs/handoffs/engineer-2026-11-12b.md): `newRun` starts a run there unless `mapMode: 'rows'` asks for the classic map (1.4, 1.5), an option for the simulator and the Dev menu. Tuning M2b v15 by the Lead Game Designer, 2026-11-12 (docs/specs/changes-m2b-v15.md rows 1, 2 and 4, D123-D125; status draft as that file): the Swift passage of a Road (ROAD_SWIFT_TOLLS, ROAD_SWIFT_XP_FRAC behind the switch `GATES.swiftRoad`), and the content values Warden Belk hpMult 0.90 and Mawgrim hpMult 0.95, folded into 1.9.7, 1.9.8, 4.4, 12.2 and 13 by the Core Gameplay Engineer with the engine, 2026-11-12 (docs/handoffs/engineer-2026-11-12c.md; marked "(M2b v15)"). v15 outcomes by their decision rules (D126, docs/reports/balance-2026-11-12c.md): the Swift passage is off (`GATES.swiftRoad` false; the rule and the switch stay), Mawgrim's HP arm applies (hpMult 1.1 -> 0.95 in content; the switch `GATES.mawgrimHp` and content `gated` are removed).
Audience: Core Gameplay Engineer (src/rules.js), Simulation & Balance Engineer, UI/UX Engineer, Content Designer.

Every global number is a named constant (UPPER_SNAKE_CASE) in section 13. The data tables (classes, spells, pets, talents, archetypes, boss, meta catalogue) are named constant groups: each cell is addressed as `TABLE.id.field` (e.g. `SPELL.ember_bolt.cost`) and is exported as data from src/. Values are starting values; the Simulation & Balance Engineer tunes them within the limits in balance.md.

Tags: most of this document is design choice and carries no tag. Owner requirements are tagged [stated] (source: docs/BRIEF.md and the owner correction of 2026-11-09 14:46).

---

## 0. Conventions

| Topic | Rule |
|---|---|
| Engine model | Pure function `step(state, action) -> state`. No clock, no DOM, no `Math.random`. All randomness from seeded streams below. |
| Integers | HP, mana, energy, focus, damage, heals, XP, copper are integers. Round with `Math.round` at the end of each formula (half away from zero), unless a formula says floor. |
| Percentages | Stored as fractions (0.35 = 35 %). |
| Currency | Integer copper. UI shows 100 c = 1 s, 100 s = 1 g. |
| Time | In-game time is counted in **tolls**, whole numbers only (M2b v7). 1 toll = 1 former in-game hour, so every value keeps its number. The engine stores tolls directly (`state.time`, the TIME_* constants); there are no hours, days or clock times anywhere in the engine or on screen. Real time is only estimated (section 3); the engine never reads a clock. Measurements recorded before M2b v7 say "h": read 1 h as 1 toll. (M2b v7) |
| RNG | One 32-bit seeded PRNG (sfc32 or mulberry32, Engineer's choice) per stream. Stream seeds come from a 32-bit string hash (Engineer's choice) of the listed keys. |
| Streams | `map(z)` = hash(runSeed, "map", z): zone map. `node(z,r,l)` = hash(runSeed, "node", z, r, l): node setup (encounter make-up, quest, vendor stock). `fight(z,r,l,k)` = hash(runSeed, "fight", z, r, l, k), k = fight index in node: combat. `loot(z,r,l)` = hash(runSeed, "loot", z, r, l): all drops and rewards of that node. `boss` = hash(runSeed, "boss"). |
| Consequence | Maps and loot of a node do not depend on how fights were played; fights replay exactly from seed + action log [stated: deterministic]. |
| Level | Character level L (1..MAX_LEVEL). Content level CL of a node or enemy. |
| "tl" | Trained level of a spell (section 5.2). |
| "P" | Power (section 4.2). "WD" = weapon damage of the equipped weapon (section 8). |

---

## 1. Run structure

### 1.1 Phases (state machine)
`CREATE -> ZONE_HUB -> MAP <-> NODE -> ... -> CAMP -> BOSS -> SUMMARY`

| Phase | Player actions |
|---|---|
| CREATE | `SELECT_CLASS(rogue|mage|hunter)`, `SELECT_PET(id)` (Hunter only), `SET_NAME(text)`, `SET_SEED(int|random)`, `START_RUN` |
| ZONE_HUB | Hub services (1.4), `LEAVE_HUB` |
| MAP | `CHOOSE_NODE(lane)` (legal lanes only), `TRAVEL_ON` (when legal, 1.5), out-of-combat actions |
| NODE | Node-specific actions (section 2), combat actions (section 7), `LOOT_*`, `CHOOSE_REWARD(i)` |
| CAMP | Camp services (1.6), `FIGHT_BOSS` |
| BOSS | Combat actions |
| SUMMARY | `END_RUN` (writes meta points to profile) |

Out-of-combat actions (allowed in ZONE_HUB, MAP, CAMP, and between fights in a node): `EQUIP(itemId)`, `UNEQUIP(slot)`, `DISCARD(itemId)`, `USE_ITEM(itemId)` (out-of-combat items only), `SET_BAR(slot, spellId|null)`, `SET_ITEM_BAR(slot, itemId|null)`, `SPEND_TALENT(talentId)`, `SET_AUTOPLAY(on|off)`.

### 1.2 Character creation
- Class: Rogue, Mage or Hunter [stated]. Hunter also picks a pet (5.5).
- Start: level 1, 0 XP, full HP/mana, START_GOLD copper, gear: common ilvl 1 weapon and chest of the class (Weapon, Chest), START_RATIONS Trail Rations in the bag, spells known: the two level-1 spells of the class (tl = 1) on bar slots 1 and 2.
- Meta unlocks owned by the profile are applied here (section 11.4).

### 1.3 Zones
ZONE_COUNT zones in fixed order, each a level band of ZONE_LEVELS levels. Names and themes come from the Content Designer within section 12; the ids and bands are fixed.

| Zone | Band | Exit level (`ZONE_LEVELS × z`) | Theme direction for Content |
|---|---|---|---|
| Z1 | 1-10 | 10 | farmland and forest edge |
| Z2 | 11-20 | 20 | wetlands |
| Z3 | 21-30 | 30 | highlands |
| Z4 | 31-40 | 40 | dry ruins |
| Z5 | 41-50 | 50 | haunted woods |
| Z6 | 51-60 | 60 | scorched peaks |
| Camp + Boss | 60 (boss 62) | - | the Sunken Observatory |

### 1.4 Zone map generation (stream `map(z)`)
Each zone has a hub (row 0) and ZONE_CHOICE_ROWS rows (r = 1..7) of LANES lanes (l = 0..2). The whole map of the current zone is visible on entry (types, content level, quest titles, enemy archetypes, quest enemy count; rare elites hidden unless meta "Scout's Eye"). (M2 v2)

Movement: from the hub the player may enter any lane of row 1. From (r, l) the player may enter (r+1, l-1), (r+1, l), (r+1, l+1) within 0..2. Each node is entered once. After the last row (row ZONE_CHOICE_ROWS) the zone ends (forced `TRAVEL_ON`). (M2 v2)

Generation order (draws in this order):
1. Dungeon: row `DUNGEON_ROW_MIN + floor(rng × (DUNGEON_ROW_MAX - DUNGEON_ROW_MIN + 1))`, lane `floor(rng × 3)`. Exactly one dungeon per zone.
2. Rest guarantee: one Rest in a random cell of rows REST_ROW_MIN..REST_ROW_MAX not already filled (row first, then lane, each uniform).
2b. Trainer guarantee: one Trainer in a random cell of rows TRAINER_ROW_MIN..TRAINER_ROW_MAX not already filled (row uniform, then lane uniform over the free cells of that row; a row always has a free cell). Drawn after step 2, before step 3. Spells of level 4-6 are therefore learnable inside zone 1. (M2 v2)
3. Every other cell, row by row, lane 0..2: weighted draw from the node weights below. Re-draw (max 10 tries, then Quest) if the result breaks a constraint:
   - no more than MAX_SAME_TYPE_PER_ROW of one type in a row;
   - no Elite, Rest, Vendor or Trainer in row 1;
   - no Dungeon outside step 1.
4. Per node (stream `node(z,r,l)`): quest template, encounter make-up, level offset, rare flag (Elite only, chance RARE_CHANCE), vendor stock, shrine boons, treasure guard.

| Node type | Weight constant | Weight |
|---|---|---|
| Quest | W_QUEST | 38 |
| Grind | W_GRIND | 14 |
| Elite | W_ELITE | 14 |
| Rest | W_REST | 12 |
| Vendor | W_VENDOR | 6 |
| Trainer | W_TRAINER | 4 |
| Treasure | W_TREASURE | 6 |
| Shrine | W_SHRINE | 6 |

Content level of row r in zone z: `CL(z,r) = ZONE_LEVELS×(z-1) + 1 + floor((r-1) × (ZONE_LEVELS-1) / (ZONE_CHOICE_ROWS-1))` (Z1: rows 1..7 -> 1,2,4,5,7,8,10) (M2 v2). Node offsets: Quest + one of QUEST_LEVEL_OFFSETS (uniform); Elite + ELITE_LEVEL_OFFSET; Dungeon trash at `ZONE_LEVELS×(z-1)+1+DUNGEON_LEVEL_OFFSET`, dungeon boss + DUNGEON_BOSS_LEVEL_OFFSET more; other nodes CL(z,r). Content level never exceeds 60 except the end boss.

Hub (row 0) services; each may be used once per hub visit, in any order, and costs tolls:

| Service | Tolls | Effect |
|---|---|---|
| Trainer | TIME_TRAINER | as Trainer node (2.7) |
| Vendor | TIME_VENDOR | as Vendor node (2.6), content level = zone band minimum |
| Inn | TIME_REST | as Rest node (2.5) |

### 1.5 Leaving a zone
`TRAVEL_ON` is legal in MAP when `L >= exit level - TRAVEL_EARLY_LEVELS` (meta Swift Boots: one level lower again), or after the last row (then forced). It costs TIME_TRAVEL and moves to the next zone's hub (Z6 -> Camp). Leaving early skips the remaining rows: this is the speedrun lever. A player who leaves under the exit level, or is under it after the last row, faces higher content in the next zone (more risk, and more XP via the level-difference bonus). (M2 v2)

### 1.6 Camp (before the boss)
Services as a hub (Trainer, Vendor at CL 60 with ilvl 60 stock, Inn) plus repeatable `CAMP_GRIND` waves: one wave = one Grind wave (2.2) at CAMP_GRIND_LEVEL, TIME_GRIND_WAVE each, no limit. `FIGHT_BOSS` starts the single boss attempt (section 10). Tolls keep counting, so every camp wave raises boss Ascendancy (1.7).

### 1.7 In-game time and Ascendancy
Every node and service costs a whole number of tolls (table 2.0). The run's total `time` (tolls) at `FIGHT_BOSS` sets the boss Ascendancy: (M2b v7)
`asc = min(ASC_CAP, ASC_PER_STEP × floor(max(0, time - BOSS_TIME_PAR) / ASC_STEP_TIME))`.
Boss HP (incl. adds) and all boss damage are multiplied by `(1 + asc)` (boss damage also by BOSS_DMG_MULT, 10.1; M2b v6). With ASC_PER_STEP 0.02 every 10 tolls past the par add 2 % (M2b v6: was 4 %). Runs at or under BOSS_TIME_PAR also earn ECHO_SPEED_BONUS on a kill.

#### 1.7.1 Heat: the line and the player's heat (heat)
Source: docs/specs/expedition.md section H (H.1, H.2), folded in by the Core Gameplay Engineer; it applies to both map modes. Constants: section 13, marked "(heat)". Player-facing name of the meter: **the Furnace** (M2b v7; `heat` stays the engine's name).
- The **line** is the par schedule, in whole tolls: `line(z) = ceil(par × min(z, ZONE_COUNT) / ZONE_COUNT)`, z = the current zone (the Camp counts as ZONE_COUNT), computed in integers as `floor((par × min(z, ZONE_COUNT) + ZONE_COUNT - 1) / ZONE_COUNT)`. `par` is the par above: BOSS_TIME_PAR, OATH_HASTE_TIME less under the Oath of Haste (11.5). With par 120 the line is 20 tolls per zone: 20, 40, ... 120. Under the Oath of Haste (par 100): 17, 34, 50, 67, 84, 100. The line per zone is derived, not a constant. (M2b v7: was par × z / 6 kept at 6 decimals; rounding up keeps every state and every projected Ascendancy exactly as before, because tolls are whole: time >= line + T holds for the exact line exactly when it holds for the rounded-up one)
- `heat = time - line(z)`, a whole number of tolls. Negative heat is tolls in hand, positive heat tolls past the line. Entering the next zone moves the line one share ahead; the tolls of TRAVEL_ON (and of TAKE_ROAD and the Bell's channel, 1.9.7) count against the zone being left. Time saved or lost in one zone carries into the next. (M2b v7)
- At the Camp the line is the par, so `heat` at FIGHT_BOSS is the over-par tolls of the Ascendancy formula above, which is unchanged.
- **Projected Ascendancy**: `ascIfPar = min(ASC_CAP, ASC_PER_STEP × floor(max(0, heat) / ASC_STEP_TIME))`, the boss Ascendancy if the player leaves the zone now and plays every later zone in exactly its line share (an honest floor: staying longer only raises it).

#### 1.7.2 Heat states (heat)
| State (engine id) | Shown to the player (M2b v7) | Run heat (tolls past the line) | Meaning at the boss if the line is kept from here |
|---|---|---|---|
| Clear (`clear`) | Calm | heat < HEAT_WARM_AT | under par: no Ascendancy, ECHO_SPEED_BONUS in reach |
| Warm (`warm`) | Smouldering | HEAT_WARM_AT <= heat < HEAT_HOT_AT | speed bonus lost, no Ascendancy yet |
| Hot (`hot`) | Burning | HEAT_HOT_AT <= heat < HEAT_SCORCH_AT | Ascendancy +2 % to +4 % | (M2b v6: was +4 % to +8 %)
| Scorched (`scorched`) | Infernal | heat >= HEAT_SCORCH_AT | Ascendancy +6 % or more (cap ASC_CAP) | (M2b v6: was +12 % or more)

The specs keep the engine names Clear, Warm, Hot and Scorched; the player only ever sees Calm, Smouldering, Burning and Infernal (M2b v7). HEAT_HOT_AT equals ASC_STEP_TIME: Hot starts where Ascendancy starts to cost. In an expedition zone the Dimming adds a second clock and the meter's state is the hotter of the two (1.9.10); elsewhere the state is the run state. The meter is `heatView` and the hover preview of a choice ("3 tolls, ends Smouldering") is `heatPreview` (engine-api.md 11); the UI rules for the meter are expedition.md H.4. (M2b v7)

#### 1.7.3 What heat gives (heat)
Source: expedition.md H.3.
- A node's **heat state is fixed when the player enters it** (today's map: CHOOSE_NODE; expedition: MOVE into an unresolved node): the state at that moment, before any of the node's tolls are spent, on the expedition map with the Dimming's clock of the node entered (1.9.10). It applies to everything the node pays, whatever the meter shows later inside it; `heatPreview(...).pays` shows it before the choice.
- **XP and gold**: every XP and gold gain inside the node (kills, the quest turn-in and story bonus, grind waves, the dungeon clear, treasure gold, Boon of Plenty) × (1 + HEAT_GAIN[state]), after every other modifier (rested doubling, Boon of Insight, meta Quick Study and Prospector), rounded half away from zero. Selling is not a gain.
- **Better drops**: every item rolled on a drop table in the node (kill drops, elite and dungeon boss drops, treasure, quest and story reward choices; not vendor stock) draws once more on its loot stream right after the rarity draw (8.4): below HEAT_RARITY_UP[state] the rarity is one step higher (common -> uncommon -> rare -> epic; epic stays).
- **Echoes**: ECHO_PER_HEAT_FIGHT per fight won in a node entered Hot or Scorched (11.1).
- **Not paid**: hub services, walks, passes and travel (they have no XP or gold), the Camp (its waves are repeatable: heat there would be a farm), the boss, and Dimmed encounters (1.9.6). A Dimmed node cannot be entered, so no node is entered Scorched by the Dimming's clock.
- What it costs: the tolls themselves, which become Ascendancy at the boss (1.7, unchanged), and the lost ECHO_SPEED_BONUS. No new penalty is added.

#### 1.7.4 Heat in the run summary (heat)
The summary's `heat` block (9): `trackPerZone` (per zone entered, and the Camp: its number, its line, the run's tolls at arrival and when it was left; the zone the run ends in has the tolls at the end), `timeByState` (every toll spent counts in the state it starts in; TRAVEL_ON and TAKE_ROAD tolls by the run state alone; M2b v7: was `hoursByState`), `nodesByState` (nodes entered, by entry state), `fightsByState` (fights won in map nodes, by the node's entry state; Camp waves, the boss and Dimmed encounters are not counted) and `echoHeat` (the Echo line of 11.1). States in the order Clear, Warm, Hot, Scorched.

### 1.8 Where long-term trade-offs come from
| Trade-off | Mechanism |
|---|---|
| XP vs gear | Leaving a zone at exit level saves tolls (lower Ascendancy) but skips quest rewards, dungeon loot and gold. |
| Risk vs reward | Elites and dungeons give the best XP per toll and rare/epic loot; they are the main causes of death. |
| Gold vs time | Rations (gold) replace Rest (4 tolls). Grind waves give gold and drops per toll. Vendors sell rares and the Ember of Return. |
| Spells vs gold | Spells only improve at a trainer (rank = trained level). Skipping trainers saves tolls and gold but weakens every spell. |
| Rested XP | Rest gives a rested pool that doubles kill XP; resting before a grind or dungeon is efficient. |
| Resurrects | Ember of Return (30 V gold), Shrine boon, meta Second Breath (journey only, not in the end-boss fight). Spending gold on an Ember competes with gear and potions. | (M2 v3)
| Consumables vs bag | 16 bag slots shared by gear, potions and junk; potion stacks are 5. |
| Bar slots | 7 spell slots for 12+ spells: choosing interrupt, cleanse, AoE or defensive matters at the boss. |
| Talents | 26 points; one capstone per run; the boss tests interrupt, cleanse, AoE, burst and sustain. |
| Story chain | 3 quests in a zone grant the story reward; planning the path through quest nodes pays off. |

### 1.9 Expedition map (expedition)
Source: docs/specs/expedition.md sections 1, 4-7 and 9.5 (task M2b 2b.3), folded in by the Core Gameplay Engineer. A run plays this map when it is created with `newRun({ mapMode: 'expedition' })`, the default since D116; `mapMode: 'rows'` plays the classic map (1.4, 1.5). (D116: status) In an expedition run this section replaces 1.4's layout and movement and all of 1.5; every other rule applies. The start camp (PREP), contracts and their sites, the hub contract, the Spyglass and the story chain's retirement are specified in expedition.md 2-3 and played by the engine in a run created with `prep: true` (the default on this map since D116; engine-api.md 13), and so are the meta catalogue's expedition effects of expedition.md 8.2 (Pathfinder, Cartographer, Old Hand, Quartermaster, Swift Boots as a Bell charge; 11.2, M2b v11); not here yet: Ask the Locals. (M2b v10: status; M2b v11) Constants are in section 13, marked "(expedition)".

#### 1.9.1 Phases and actions
`CREATE -> ZONE_HUB -> MAP <-> NODE -> ... -> CAMP -> BOSS -> SUMMARY`

| Phase | Player actions |
|---|---|
| ZONE_HUB | hub services (1.4), `LEAVE_HUB` (to MAP, standing on the hub) |
| MAP | `MOVE(nodeId)` (a node next to the player's), `PASS_THROUGH(nodeId)` (a neighbour that MOVE would enter), `TAKE_ROAD` (on a Road), `RING_BELL` (Homeward Bell), out-of-combat actions. `CHOOSE_NODE` and `TRAVEL_ON` are not legal. |
| NODE | node actions (2); a Dimmed encounter (1.9.6) is a fight in phase NODE whose node type is `dim` |

expedition.md's PASS is `PASS_THROUGH`, chosen on the map before the step: adjacent nodes are always fully in view (1.9.5), `PASS` is already the combat action, and Rest and unguarded Treasure nodes have no choice point inside.

#### 1.9.2 Zone graph (stream map(z))
Each zone is a graph of RING_NODES[0] hub (ring 0, id 0) and rings 1-3 of RING_NODES[1..3] nodes. Ids go ring by ring, in angle order within a ring: ring 1 ids 1-6, ring 2 ids 7-18, ring 3 ids 19-30. Draws on map(z), in this order:
1. Angles: a1 = uniform × 360 / RING_NODES[1], a2 = uniform × 360 / RING_NODES[2]. Ring 1 node i at a1 + i × 360 / RING_NODES[1]; ring 2 node j at a2 + j × 360 / RING_NODES[2]; ring 3 node j at a2 + (j + 0.5) × 360 / RING_NODES[3] (with equal counts: ring 2 node j's angle plus half a step). Degrees in [0, 360), kept at 6 decimals.
2. Edges: the hub to every ring 1 node; ring 1 node i to i + 1 (mod RING_NODES[1]) when a draw < EDGE_KEEP_R1 (i = 0, 1, ...); every ring 2 node to the ring 1 node nearest in angle (ties: the lower id); ring 2 node j to j + 1 when a draw < EDGE_KEEP_R2; ring 3 node j to its parent, the nearer of the two ring 2 nodes around its angle (ties: the earlier one, so ring 2 node j with equal counts), and to the other one when a draw < EDGE_DIAG_R23 (j = 0, 1, ...; expedition.md's "ring 2 node j to ring 3 node j - 1"); ring 3 node j to j + 1 when a draw < EDGE_KEEP_R3. The spokes connect every node.
3. Regions: offset = uniform × 360 / REGION_COUNT; wedge w covers the angles [offset + w × 360 / REGION_COUNT, offset + (w + 1) × 360 / REGION_COUNT). The zone's REGION_COUNT regions are shuffled onto the wedges (Fisher-Yates from the last wedge down: REGION_COUNT - 1 draws). A node's region is the one of its wedge; the hub has none. Regions come from content (`zones[i].regions`: id, name, kind, families); a zone without them has one region of each kind in REGION_KINDS order, without a name or families.
4. Landmarks: start = uniform ring 3 index; Road k (k = 0..ROAD_COUNT-1) on ring 3 index start + round(k × RING_NODES[3] / ROAD_COUNT); then a uniform Road p: the Shardfall is the ring 3 node halfway to the next Road, index road_p + round(gap / 2).
5. Node types: the Dungeon on a uniform node of rings 2-3 that is not a Road or the Shardfall; a Rest on a uniform free node of rings 1-2; a Trainer on a uniform free node of ring 2 (one draw each, candidates in id order); the Shardfall is a Treasure; every other node, in id order, one weighted draw over the node types (order of NODE_DRAW_ORDER) with the weights of its region's kind (table below), Elite, Vendor and Trainer weighing 0 in ring 1 (RING1_FORBIDDEN).
6. Node setup on stream node(z, id) (1.9.3).

| Region kind | Quest | Grind | Elite | Rest | Vendor | Trainer | Treasure | Shrine | Feel |
|---|---|---|---|---|---|---|---|---|---|
| wilds | 36 | 24 | 10 | 10 | 2 | 2 | 10 | 6 | beasts, open country |
| road | 34 | 10 | 18 | 8 | 12 | 6 | 8 | 4 | bandits, waystations |
| haunt | 34 | 12 | 16 | 8 | 2 | 4 | 10 | 14 | ruins, casters, shrines |
| steads | 42 | 8 | 8 | 20 | 10 | 6 | 2 | 4 | farms, villages, rest |

The weights are `REGION_W.kind.type` (constants: `REGION_W`). Streams by node id: node(z, id) = hash(runSeed, "node", z, id), fight(z, id, k), loot(z, id); the n-th Dimmed encounter at node id uses dim(z, id, n) = hash(runSeed, "dim", z, id, n) for its make-up and then its fight. The hub is id 0: its vendor's stock is drawn on node(z, 0) at the first visit and keeps what was sold for the rest of the zone.

#### 1.9.3 Content level and node setup (stream node(z, id))
The first draw is u, uniform in 0..RING_CL_SPREAD-1: CL = ZONE_LEVELS × (z - 1) + 1 + RING_CL_BASE[ring] + u (zone 1: ring 1 levels 2-4, ring 2 5-7, ring 3 8-10). The hub is the band minimum. Then as 1.4 step 4 (quest offsets, Elite + ELITE_LEVEL_OFFSET, dungeon levels as 1.4, rare flag, vendor stock, shrine boons, treasure guard) with EXPED_GRIND_MAX_WAVES grind wave(s) and EXPED_DUNGEON_TRASH_FIGHTS dungeon trash fights. Every enemy template pick of a quest, a grind wave, an elite (its elite or rare template and its add) and a treasure guard takes two draws: the first decides the family share (below REGION_FAMILY_SHARE the pick comes from the list's templates whose `family` is one of the region's families, when the list has any), the second picks. Dungeons, the Camp and Dimmed encounters do not use regions. The treasure trap is the first draw of loot(z, id). Quest sizes: zone 1's cap (2.1), and while GATES.zone2InnerCap is on also in zone 2's rings 1..QUEST_CAP_Z2_RINGS (D146).

#### 1.9.4 Moving and tolls
- `MOVE(id)`, id next to the player's node: when id is unresolved, not the hub and not Dimmed, the player enters it: its content starts and costs its node tolls (1.9.8). Otherwise the step is a walk of TIME_WALK. A walk onto the hub, when it is not Dimmed, starts a new hub visit (phase ZONE_HUB; each service once per visit again).
- `PASS_THROUGH(id)`, a neighbour MOVE would enter: a walk of TIME_WALK through it; it stays unresolved and can be entered later.
- Each node is resolved at most once; a fled fight resolves its node, as on today's map.
- Zone time zt = the run's tolls since arrival at the zone's hub, hub services included (M2b v7: was zone hours hz). Run tolls keep counting for Ascendancy (1.7).

#### 1.9.5 Vision
- Always visible: every node (id, ring, angle, neighbours), every edge, the hub, the Roads, the Shardfall, which nodes are Dimmed and the zone toll each one dims at (1.9.6), the ring's level band, the zone's region names and kinds.
- Fully visible: the nodes within the vision radius of the player's node (hops on the graph): type, content level, resolved or not, region, and the details of 1.4's map view (quest title and archetypes, grind archetypes, elite level and the add's archetype, dungeon name, levels and fights, treasure guard). Nodes seen once stay seen for the rest of the zone. Vision is refreshed on arrival at the hub and after every step.
- An elite's own name and archetype are not shown, rare or not (D50): content gives each zone's rares other archetypes than its elites, so either one would tell a rare (expedition.md 5.3). The view keeps one archetype entry per enemy, the elite's as null.
- An elite whose name is hidden (every expedition elite; on the rows map a rare without Scout's Eye) shows only its Deathblow's type (7.12): `deathblow: { type }`, `heavy` or `cast`, without its ability's name or kind. Every zone's elite pool has a heavy and a cast Deathblow (12.4), so the type never tells a rare; a kind would (D50). A named elite shows the full Deathblow. (M2b v14, D112)
- Radius: VISION_RADIUS, + GUIDE_RADIUS_BONUS with Local Guide; the full radius is capped at VISION_RADIUS_MAX. Region Charts: every node's region and the dungeon's type. Pathfinder: node types (only) within PATHFINDER_RADIUS hops. The start camp buys Region Charts and the Guide (expedition.md 2.4); in a run with the start camp the catalogue's Cartographer owns Region Charts, Old Hand Tracker's Notes, and Scout's Eye is Pathfinder (11.2, M2b v11). newRun's `vision` option ({ guide, charts, pathfinder }) gives them too (a test and measurement option); a run without either has the fresh-profile vision.
- Never shown: rare elite flags, treasure traps, vendor Embers (meta Scout's Eye shows them only on the rows map; in an expedition run it is Pathfinder with the start camp and does nothing without it, M2b v11).
- Names and lines (D51, content): the zone's Road names (`zones[i].roads`, Road k takes name k), its regions with their families, and the texts of the Shardfall, Shardspawn, the Dimming and the Homeward Bell (`texts.expedition`); all optional, shown when content has them.
- `mapView` returns only this; no front end or bot reads the zone state.

#### 1.9.6 The Dimming
- front(zt) = floor(DIM_FRONT_HOPS × (zt - DIM_GRACE) / DIM_FRONT_TIME) from DIM_GRACE on (before: none), in integers. A node is Dimmed when front >= 0 and its hops from the Shardfall (on the zone graph) are <= front, i.e. from zone toll `dimAt(hops) = DIM_GRACE + ceil(hops × DIM_FRONT_TIME / DIM_FRONT_HOPS)` on. The front advances DIM_FRONT_HOPS hops every DIM_FRONT_TIME tolls (two every five: one step after 3 tolls, the next after 2). With the starting values the Shardfall dims at 6 and a node 1, 2, 3, 4, 5, 6 hops away at 9, 11, 14, 16, 19, 21: the same tolls as the old 2.5 hours per hop. The front only moves with tolls. (M2b v7: DIM_HOURS_PER_HOP 2.5 replaced by DIM_FRONT_HOPS 2 per DIM_FRONT_TIME 5)
- Every node, the zone's Dungeon too, dims at `dimAt(hops)`: the Dimmed test (entering, the settle step, lost content), the map's "dims in N" (1.9.5), the Dimming clock (1.9.10) and the autoplay map policy (1.9.9) all use it. (M2b v12, D100: M2b v10's "the dungeon holds out", DUNGEON_DIM_HOLD 3 tolls added to the Dungeon's dimAt, is removed)
- Dimmed encounter: at the end of an action that cost tolls (a step, a node's content, a hub service, the Bell's channel), when the player stands in a Dimmed node with nothing open (no node, fight, service or loot window), once per such action: DIM_PACK_SIZE enemies from the zone's normal templates (uniform picks on dim(z, id, n), then the composition repair of 7.14), variant shardspawn: HP × DIM_HP_MULT and damage × DIM_DMG_MULT on top of the archetype, zone danger as a normal enemy (7.6), ENGAGE_DMG_COMP as every template enemy (7.10); level min(MAX_LEVEL, max(CL, L) + DIM_LEVEL_PER_DEPTH × depth), CL the node's content level, depth = front - hops from the Shardfall. It costs TIME_DIM_FIGHT (M2b v11: 2 tolls, was 1), which does not start another one; the front check after it uses the new zone time, so the next action in the dark may meet the front further on. The way out (M2b v12, D101): when the action was a `MOVE` that walked farther from the Shardfall (`outward = shardDist[to] > shardDist[from]`, hops on the zone graph, recorded at the MOVE and cleared at the next action), the encounter its settle step starts costs TIME_DIM_ESCAPE (1 toll) instead. Every other Dimmed encounter costs TIME_DIM_FIGHT: after a node's content (a MOVE that enters a node is not a walk), a PASS_THROUGH, the Bell's channel, a hub service, or a walk sideways or inward. Depth, level, pack and rewards are unchanged. So a walk out of the dark costs TIME_WALK + TIME_DIM_ESCAPE = 2 tolls, the front moves 0.8 hop and the step adds 1 hop of distance: depth falls 0.2 per outward step. The tolls previews (heatPreview's `dimFight`, 1.9.10) and the autoplay's escape route (1.9.9) count the same tolls. Kill XP × DIM_XP_MULT; no coin, no loot. Flee is allowed (7.8) and counts as passing through: the player stays on the node. The node is not resolved by it.
- Content lost: MOVE into an unresolved Dimmed node does not enter it (it is a walk, and the Dimmed encounter follows); PASS_THROUGH refuses it. The hub's services stop while it is Dimmed (SERVICE is refused; a walk onto it starts no visit).
- Death in a Dimmed encounter ends the run as any death (9); the death location has the node id, its ring, node type `dim` and the depth.
- Measurement option (D50): a run created with `newRun({ mapMode: 'expedition', dimming: false })` has no Dimming: no front, no node dims (`dimAt` is Infinity), no Dimmed encounters, the hub's services never stop, and the meter has no Dimming clock (1.9.10). Everything else is as above. Used by the simulator for balance.md B44.

#### 1.9.7 Leaving a zone
- `TAKE_ROAD`, standing on a Road in phase MAP: TIME_TRAVEL, then the next zone's hub (zone 6: the Camp). There is no level gate (TRAVEL_EARLY_LEVELS and Swift Boots do not apply). A Dimmed Road is taken after its Dimmed encounter.
- Swift passage (M2b v15, D124; expedition.md 7.1): `TAKE_ROAD` checks the zone time zt (1.9.4: tolls since arrival at the zone's hub) before TIME_TRAVEL is paid; when zt <= ROAD_SWIFT_TOLLS the player first gains `round(ROAD_SWIFT_XP_FRAC × xpToNext(L))` XP (L the level then; no level-difference modifier, XP_WEIGHT_MULT, xpPctMods, rested doubling or heat; level-ups apply as for any XP gain), then the travel. Event `swift { xp, zt, tolls (ROAD_SWIFT_TOLLS), node }`, then the `xp` event with `why: 'swift'`. Once per zone (the Road leaves it); zone 6's Road to the Camp counts; the Homeward Bell never pays it; nothing at MAX_LEVEL (xpToNext is 0). The map view shows it (`swift`: tolls left in the window and the XP; engine-api.md 10.3). Switch `GATES.swiftRoad` (off since D126: the planner's win falls with it on; the rule stays for a later rusher reward); a dev jump (`debug.nextZone`) takes the Road without it. (M2b v15)
- Homeward Bell: a run starts with BELL_START_CHARGES charges, + the catalogue's Swift Boots in a run with the start camp (11.2, M2b v11) and the start camp's Second Clapper (never more than BELL_MAX_CHARGES). `RING_BELL` on the map (not in a node, the hub screen, the Camp or at the boss): one charge, a channel of BELL_CHANNEL_TIME tolls; when the player's node is Dimmed at its end the Dimmed encounter comes first; then the next zone's hub (zone 6: the Camp), with no TIME_TRAVEL.
- Either way the zone counts as left (zonesLeft, Echoes 11.1). The `travel` event names the Road taken (content `zones[i].roads`, D51).

#### 1.9.8 Pacing values of an expedition run (expedition.md 9.5)
| Rule | Today's map | Expedition run |
|---|---|---|
| Grind waves (2.2) | 1-GRIND_MAX_WAVES | 1-EXPED_GRIND_MAX_WAVES; a Grind of one wave starts it on entry |
| Dungeon trash fights (2.4) | DUNGEON_TRASH_FIGHTS | EXPED_DUNGEON_TRASH_FIGHTS |
| Tolls of a Quest / Elite / grind wave / Dungeon (2.0) | TIME_QUEST / TIME_ELITE / TIME_GRIND_WAVE / TIME_DUNGEON | EXPED_TIME_QUEST / EXPED_TIME_ELITE / EXPED_TIME_GRIND_WAVE / EXPED_TIME_DUNGEON (Camp waves too; M2b v10: a Dungeon 5 tolls, was 6) |
| XP of kills, quest turn-ins, grind waves, dungeon clears (Camp included); contracts (prep) | × 1 | × XP_WEIGHT_MULT (M2b v10: 1.4, was 1.6) |
| Item and junk chance of a normal or dungeon-trash kill (8.4; Camp waves included, as the XP) | × 1 (× GRIND_DROP_MULT on a Grind) | × EXPED_DROP_MULT, and × GRIND_DROP_MULT as well on a Grind node or a Camp wave; a chance is capped at 1 (M2b v11; M2b v12: 1.9) |
| Rolls on "Dungeon boss" at a dungeon clear (2.4, 8.4) | DUNGEON_BOSS_DROPS | EXPED_DUNGEON_BOSS_DROPS (M2b v11) |

The story chain (2.1) stays in an expedition run without the start camp; its XP is not weighted. With the start camp contracts replace it (expedition.md 3.2): their XP is weighted and has no level-difference modifier (M2b v10). Pacing terms (3): every walk and pass costs PACE_DECIDE_S + PACE_TRAVEL_NODE_S; a Bell costs PACE_BELL_S, and a zone left by the Bell no PACE_ZONE_TRAVEL_S.

Run summary (9) of an expedition run: `mapMode` and `expedition` = walks, passes, Dimmed encounters, zones with at least one, Bell charges rung and left, Roads taken, Roads taken with the Swift passage (M2b v15), the furthest ring, and per zone: zone tolls, resolved nodes, walks, passes, Dimmed encounters, the exit (`road`, `bell` or none yet), the Swift passage XP its Road paid (0 without; M2b v15).

#### 1.9.9 Default autoplay map policy (engine, not a bot)
`autoAction` must take an expedition run from CREATE to SUMMARY. On the map it reads only what the player sees (the seen nodes, the skeleton, the Dimming):
1. Trail Rations below AUTO_TOPUP_HP, as on today's map.
2. Escape route: the cheapest way from the player's node to a Road, by (Dimmed steps, tolls, Road id): every step TIME_WALK, a step onto a node that is Dimmed on arrival also its Dimmed encounter: TIME_DIM_ESCAPE when the step is a walk (the node is resolved, the hub, or Dimmed when the step starts) farther from the Shardfall, else TIME_DIM_FIGHT (M2b v12).
3. Explore while the level is under the zone's exit level (10 × z) and the escape route has no Dimmed step: enter the adjacent seen node with the best default node score (AUTO_NODE_SCORE, not risky) that is not Dimmed, will not be Dimmed when its content ends, and leaves a Road reachable without a Dimmed step afterwards; else take one step (PASS_THROUGH an unresolved node, MOVE otherwise) towards the nearest node worth exploring (seen: by the same test; unseen: a clean way out after EXPED_TIME_QUEST tolls), on nodes out of the Dimming on arrival.
4. Otherwise leave: TAKE_ROAD on the Road; RING_BELL when the escape route has a Dimmed step and a charge is left; else the next step of the escape route.
5. Hub services (1.4 policy) are used only when the hub stays out of the Dimming and the escape route stays clean after their tolls.

Every Dimming test of this policy uses the Dimming as the player sees it, which since M2b v12 (the Dungeon's hold removed) is the engine's own dimAt for every node.

#### 1.9.10 Heat in an expedition zone (heat)
Source: expedition.md H.5. In an expedition zone a second clock runs: `dimIn = dimAt(node) - zt`, the tolls until the player's node dims (1.9.6; `dimAt` is the zone toll of 1.9.6 for the node's hops, whether the front has started or not; M2b v12: the Dungeon too, its hold removed). (M2b v7)

| Dimming state | Condition |
|---|---|
| Clear | dimIn > HEAT_DIM_WARM |
| Warm | HEAT_DIM_HOT < dimIn <= HEAT_DIM_WARM |
| Hot | 0 < dimIn <= HEAT_DIM_HOT |
| Scorched | the node is Dimmed (dimIn <= 0) |

The meter's state is the **hotter** of the run state (1.7.2) and the Dimming state; `heatView.by` names the clock that sets it (`dim` only when the Dimming state is hotter). The Camp, a rows run and a run without the Dimming have no Dimming clock (`dimIn` null).

Rewards (1.7.3) use this combined state at node entry, so a node entered with dimIn <= HEAT_DIM_HOT pays as Hot: the reward for working near the dark. Dimmed encounters pay nothing (they keep DIM_XP_MULT and no loot). Contract rewards × (1 + HEAT_GAIN) arrive with contracts (task 2b.5).

---

## 2. Node types

### 2.0 Summary
XP values are fractions of `xpToNext(contentLevel)` before the level-difference modifier (4.4). V = value scale (8.5). Fights listed are for the manual pacing model.

| Type | Tolls | Fights | XP (before diff mod) | Gold | Loot | Main risk |
|---|---|---|---|---|---|---|
| Quest | TIME_QUEST | 1 encounter of 1-3 mobs | kills + QUEST_TURNIN_XP_FRAC | kills + QUEST_GOLD_V × V | choose 1 of QUEST_REWARD_CHOICES (2.1) | low |
| Grind | TIME_GRIND_WAVE per wave, 1-GRIND_MAX_WAVES waves | 1 per wave, 2 mobs | kills + GRIND_WAVE_XP_FRAC per wave | kills | drops × GRIND_DROP_MULT | low, attrition |
| Elite | TIME_ELITE | 1: elite (+ add at ELITE_ADD_CHANCE) | ELITE_XP_MULT × MOB_XP_FRAC (rare: RARE_XP_MULT) | ELITE_GOLD_V × V | 1 guaranteed (table 8.4) | high |
| Dungeon | TIME_DUNGEON | DUNGEON_TRASH_FIGHTS trash + 1 boss | kills + DUNGEON_CLEAR_XP_FRAC | kills + DUNGEON_GOLD_V × V | trash drops + DUNGEON_BOSS_DROPS | highest |
| Rest | TIME_REST | 0 | rested pool | 0 | 0 | none |
| Vendor | TIME_VENDOR | 0 | 0 | spend/sell | buy | none |
| Trainer | TIME_TRAINER | 0 | 0 | spend | spells | none |
| Treasure | TIME_TREASURE | 0-1 (guard at TREASURE_GUARD_CHANCE) | kill only | TREASURE_GOLD_V × V | 1 roll | trap |
| Shrine | TIME_SHRINE | 0 | 0 | 0 | choose 1 of 2 boons | none |

Mob kill XP = `MOB_XP_FRAC × mult × xpToNext(enemyLevel) × diffMod`, with mult 1 (normal), DUNGEON_MOB_XP_MULT (dungeon trash), ELITE_XP_MULT, RARE_XP_MULT, DUNGEON_BOSS_XP_MULT.

### 2.1 Quest
- On enter: shows quest title and text (Content), then one encounter. Encounter size weights: the quest template's own weights (12.3), else 1 mob QUEST_SIZE_W1, 2 mobs QUEST_SIZE_W2, 3 mobs QUEST_SIZE_W3. Mob archetypes from the zone's normal templates. (M2 v2)
- Zone 1 cap: in zone 1 the encounter has at most QUEST_MAX_SIZE_Z1 mobs; a drawn size above the cap becomes the cap. The size draw itself is unchanged (same stream draws), so only zone 1 encounters change. (M2 v2) On the expedition map (1.9.3) the cap also holds in zone 2's rings 1..QUEST_CAP_Z2_RINGS (ring 1, levels 12-14) while the switch GATES.zone2InnerCap is on (the default; off: zone 2 as before), so three-enemy quests start at zone 2's ring 2; the classic map is unchanged. The size draw is made either way, so only those quests that drew three mobs change, with their own node's later draws (one template pick fewer); every other node's draws are the same (a held Cull's site on such a node may need one more family-repair draw, expedition.md 3.3). (D146: report balance-2026-11-13c option a6, the zone 2 entry cliff)
- On victory: turn-in XP `QUEST_TURNIN_XP_FRAC × xpToNext(CL) × diffMod`, gold `QUEST_GOLD_V × V(CL)`, and `CHOOSE_REWARD(i)` among QUEST_REWARD_CHOICES generated items (rarity table 8.4 "Quest reward").
- Story chain: the STORY_QUESTS-th quest completed in a zone also grants `STORY_XP_FRAC × xpToNext(CL)` and a choice of STORY_REWARD_CHOICES rare items at CL + RARITY_ILVL_BONUS.rare.
- Flee: allowed; no turn-in, quest not counted.

### 2.2 Grind
- On enter: `GRIND_SET_WAVES(n)` with 1 <= n <= GRIND_MAX_WAVES. After each wave the player may `GRIND_STOP`. Each started wave costs TIME_GRIND_WAVE.
- Each wave: one encounter of GRIND_WAVE_SIZE normal mobs at CL; wave bonus `GRIND_WAVE_XP_FRAC × xpToNext(CL) × diffMod`.
- Item and junk drop chances × GRIND_DROP_MULT.

### 2.3 Elite
- One elite (archetype from the zone's elite templates) at CL + ELITE_LEVEL_OFFSET, plus one normal add at ELITE_ADD_CHANCE.
- Rare variant (RARE_CHANCE): a rare template (RARE_HP_MULT, RARE_DMG_MULT, one extra ability), RARE_XP_MULT, loot table "Rare elite". Gated (M2b v13 row 5, D109): a rare of zone 1 (both maps) has RARE_HP_MULT_Z1 instead of RARE_HP_MULT while the switch GATES.rareHpMultZ1 is on. (M2b v13) The switch is on (M2b v14, D113: the sim's decision rules of the v13 measure); it stays for sim arms. (M2b v14)
- Elites and rares have 1-2 abilities from the ability templates (12.4).

### 2.4 Dungeon
- Sequence: DUNGEON_TRASH_FIGHTS trash encounters (size weights DUNGEON_SIZE_W2 / DUNGEON_SIZE_W3), then the dungeon boss (alone). Between fights: post-fight regen, out-of-combat actions, rations allowed.
- `DUNGEON_LEAVE` between fights: keeps loot so far; full tolls are spent; no clear bonus; the dungeon counts as not cleared.
- Boss: DUNGEON_BOSS_HP_MULT, DUNGEON_BOSS_DMG_MULT, exactly 2 abilities from 12.4, immune to stun/freeze/hex (they interrupt casts instead). No flee from the boss fight.
- Zone danger in dungeons (M2 v4): dungeon trash and dungeon bosses get DUNGEON_DANGER_FRAC of the zone-danger bonus of 7.6 (level 60: ×1.5 instead of ×2.0). Dungeons already carry their own multipliers; full zone danger on top made them 39-65 % deadly per entry and the planner stopped entering them. (M2 v4)
- Clear: `DUNGEON_CLEAR_XP_FRAC × xpToNext(boss level) × diffMod`, gold DUNGEON_GOLD_V × V, DUNGEON_BOSS_DROPS rolls on "Dungeon boss" (an expedition run: EXPED_DUNGEON_BOSS_DROPS, 1.9.8, M2b v11).

### 2.5 Rest
Full HP, mana and pet HP; revives a dead pet; rested pool `+= REST_RESTED_FRAC × xpToNext(L)`, capped at `RESTED_CAP_FRAC × xpToNext(L)`. While the pool is > 0, each kill's XP is multiplied by RESTED_MULT and the extra XP is subtracted from the pool (quest, wave and clear XP are not doubled).

### 2.6 Vendor
Stock (stream `node`): VENDOR_CONSUMABLES always (Healing Draught, Mana Draught, Trail Rations, Purifying Tonic, Spark Flask, Elixir of Ferocity; unlimited), VENDOR_GEAR_STOCK equipment items (rarity table "Vendor"), and an Ember of Return at EMBER_STOCK_CHANCE (one). Actions: `BUY(i)`, `SELL(itemId)`, `SELL_JUNK`, `LEAVE`.

### 2.7 Trainer
Actions: `LEARN(spellId)` for any class spell with `learnLevel <= L` not yet known, cost `TRAIN_NEW_V × V(learnLevel)`, sets tl = L. `TRAIN(spellId)` raises tl of a known spell to L, cost `TRAIN_RANK_V × V(L)`. `TRAIN_ALL` = TRAIN on every known spell the player can afford, in bar order. `RESPEC` refunds all talent points, cost `RESPEC_V × V(L)`. `LEAVE`.

### 2.8 Treasure
Guard (TREASURE_GUARD_CHANCE): one normal mob at CL; then chest: gold TREASURE_GOLD_V × V(CL), one roll on "Treasure". Trap (TREASURE_TRAP_CHANCE, rolled on stream `loot`): lose TREASURE_TRAP_PCT of max HP (cannot kill: min 1 HP).

### 2.9 Shrine
Offers 2 different boons drawn by weight; `CHOOSE_REWARD(i)` takes one. Duration in nodes counts nodes entered after the shrine.

| Boon | Weight | Effect |
|---|---|---|
| Boon of Return | BOON_W_RETURN | 1 resurrect charge (section 9) until used |
| Boon of Insight | BOON_W_INSIGHT | +BOON_XP_PCT XP for BOON_NODES nodes |
| Boon of Fury | BOON_W_FURY | +BOON_DMG_PCT damage for BOON_NODES nodes |
| Boon of Plenty | BOON_W_PLENTY | +BOON_GOLD_V × V(CL) gold now |
| Boon of Mending | BOON_W_MENDING | full HP and mana now, rested pool + REST_RESTED_FRAC |
| Boon of Clarity | BOON_W_CLARITY | next RESPEC is free and every known spell trained to L now |

---

## 3. Pacing model

Combat is manual by default; autoplay is an option [stated: owner correction 2026-11-09]. The 45-minute target is set with manual play [stated]. The simulator estimates real seconds per run with these terms:

| Term | Constant | Seconds |
|---|---|---|
| Character creation | PACE_CREATE_S | 40 |
| Read map and choose node | PACE_DECIDE_S | 5 per node |
| Walk to node (scroll animation) | PACE_TRAVEL_NODE_S | 3.5 per node (M2 v2) |
| Zone travel | PACE_ZONE_TRAVEL_S | 8 per zone |
| Quest text (accept + turn-in) | PACE_QUEST_TEXT_S | 5 per quest |
| Fight overhead (intro, loot window) | PACE_FIGHT_OVERHEAD_S | 3 per fight |
| Engage round: reading the tracks, choosing the engage (manual profile) | PACE_ENGAGE_S | 6 per fight with an engage round (combat v2) |
| Round, manual | PACE_MANUAL_ROUND_S = PACE_ROUND_ANIM_S + PACE_ROUND_DECIDE_S | 2.1 + 1.0 = 3.1 per round (combat v2: animation +40 % [stated]; M2 v2: 1.5 + 1.0) |
| Round, autoplay | PACE_AUTO_ROUND_S | 1.1 per round (combat v2; was 0.8) |
| Equipment drop decision | PACE_LOOT_S | 3 per equipment item |
| Level-up | PACE_LEVELUP_S | 2 per level |
| Talent point | PACE_TALENT_S | 6 per point |
| Rest / Shrine / Treasure screen | PACE_REST_S / PACE_SHRINE_S / PACE_TREASURE_S | 5 / 6 / 4 |
| Vendor | PACE_VENDOR_S + PACE_VENDOR_TX_S per buy/sell | 20 + 3 |
| Trainer | PACE_TRAINER_S + PACE_TRAINER_TX_S per spell | 6 + 2 |
| Boss intro | PACE_BOSS_INTRO_S | 20 |

`estSeconds(run) = sum of the terms`, counting rounds with PACE_MANUAL_ROUND_S for the manual profile and PACE_AUTO_ROUND_S for the autoplay profile (balance.md says which bot uses which); PACE_ENGAGE_S counts in the manual profile only (combat v2).

Round time budget for the UI (M2 v2): at the default animation speed, a manual round (player action, pet action, enemy actions, end-of-round ticks) is on screen for at most PACE_ROUND_ANIM_S before the action bar accepts the next input; an input given while enemy animations still play finishes them at once. PACE_ROUND_DECIDE_S is the player's reading and choosing time. QA measured 2.3-2.7 s on screen per round at 1x on build 5b3e929 (1.65 s at 2x) [source: docs/handoffs/qa-2026-11-09.md, finding 5], so the default speed must be faster than today's 1x. QA checks the budget with qa/browser/pace.mjs.

Worked estimate (design intent, to be verified by the simulator):

| Per zone | Normal route (manual) | Speed route (autoplay) |
|---|---|---|
| Hub | Trainer (3 spells) + Vendor (4 tx): 44 s, 2 tolls | Trainer (3 spells): 12 s, 1 toll |
| Nodes | 4 Quest, 1 Dungeon, 1 Elite, 1 Grind (2 waves), 1 Rest = 8 nodes | 3 Quest, 1 Dungeon, 2 Elite = 6 nodes |
| Fights / rounds | 11 fights; quest 5 r, wave 5 r, elite 8 r, trash 6 r, dungeon boss 10 r | 9 fights, same rounds |
| Seconds | about 375 s | about 190 s |
| Tolls | 25 (incl. travel) | 18 |
| XP (levels, before diff mod) | about 11.8 | about 10.9 incl. story bonus and under-level bonus |

Run totals: normal = 6 × 375 + create 40 + level-ups 118 + talents 156 + boss (20 + 40 rounds manual) about 2690 s = 45 min, 150 tolls (Ascendancy +8 %). Speed = 6 × 190 + 40 + 118 + 156 + 120 (boss manual) about 1575 s = 26 min, 108 tolls (no Ascendancy). A speedrunner playing every fight manually lands near 37 min.

Measured with the M2 v2 values (7 rows; designer scratch run of the simulator, planner P0, 600 runs per class, runs that reach the boss): 42 nodes, 300-345 rounds, 142 h, 44-46 min manual, 35-36 min autoplay. Speedrunner PALL: 31 nodes, 78-80 h, 28-29 min autoplay. Speedrunner P0: 36-37 nodes, 104-112 h, 31-32 min autoplay [source: docs/handoffs/designer-2026-11-09b.md]. (M2 v2)

---

## 4. Character

### 4.1 Stats
| Stat | Effect |
|---|---|
| Stamina (STA) | max HP |
| Agility (AGI) | Power for Rogue and Hunter; crit; dodge (Rogue, Hunter) |
| Intellect (INT) | Power for Mage; crit for Mage; max mana |
| Spirit (SPI) | post-fight regeneration of HP, mana and pet HP |

Primary stat: AGI (Rogue, Hunter), INT (Mage). Base value at level L: `base + growth × (L-1)` (table 5.1), plus items, plus meta and talent modifiers.

### 4.2 Derived values
Let `R(L) = RATING_K × L + RATING_C` (level normaliser).

| Value | Formula |
|---|---|
| Max HP | `(CLASS.hpBase + CLASS.hpPerLevel × (L-1) + HP_PER_STA × STA) × (1 + hpPctMods)` |
| Power P | `(POWER_PER_PRIMARY × primary + itemPower) × (1 + powerPctMods)` |
| Crit chance | `min(CRIT_CAP, CRIT_BASE + CRIT_FROM_PRIMARY × primary / R(L) + itemCrit + talentCrit + metaCrit)` |
| Crit multiplier | `CRIT_MULT + talent bonuses` |
| Dodge | `min(DODGE_CAP, CLASS.dodgeBase + CLASS.dodgeFromAgi × AGI / R(L) + talent + EVASION)` |
| Armor | `CLASS.armorBase + CLASS.armorPerLevel × (L-1) + CLASS.armorMult × itemArmor + affixArmor` |
| Mitigation vs attacker level A | `min(ARMOR_MIT_CAP, armor / (armor + ARMOR_K × A + ARMOR_C))` (physical only) |
| Max mana (Mage) | `(MANA_BASE + MANA_PER_LEVEL × (L-1) + MANA_PER_INT × INT) × (1 + manaPctMods)` |
| Base mana (cost basis) | same formula with INT = base INT at L (no items, no mods) |
| Energy (Rogue) | max ENERGY_MAX, starts each fight full, +ENERGY_REGEN at end of round |
| Focus (Hunter) | max FOCUS_MAX, starts each fight full, +FOCUS_REGEN at end of round |
| Combo points (Rogue) | 0..CP_MAX on the Rogue, reset at fight end |
| Post-fight regen | `pct = POST_FIGHT_REGEN_BASE + POST_FIGHT_REGEN_SPI × SPI / (SPI + REGEN_SPI_K × L + REGEN_SPI_C)`; restores pct of max HP, max mana and pet max HP after each won fight |
| In-fight mana regen | `MANA_REGEN_ROUND_PCT × max mana` at end of each round |

### 4.3 Levelling curve
`xpToNext(L) = XP_A × L² + XP_B × L + XP_C` for L < MAX_LEVEL (L1: 400, L30: 23 600, L59: 80 440). On reaching xpToNext the level rises, extra XP carries over, max HP/mana rise and current HP/mana rise by the same amount (no full heal). XP is not gained at MAX_LEVEL. Talent points at levels TALENT_FIRST_LEVEL, then every TALENT_LEVEL_STEP (26 points by 60).

### 4.4 XP per event
`XP = round(frac × xpToNext(CL) × diffMod(CL - L) × (1 + xpPctMods))`, then rested doubling for kills (2.5).

| d = CL - L | diffMod |
|---|---|
| d >= XP_DIFF_SOFT_FLOOR (-2) | `min(XP_DIFF_MAX, 1 + XP_DIFF_STEP × d)` |
| XP_GREY_DIFF < d < XP_DIFF_SOFT_FLOOR | `1 + XP_DIFF_STEP × XP_DIFF_SOFT_FLOOR - XP_DIFF_FALL × (XP_DIFF_SOFT_FLOOR - d)` (-3: 0.7, -4: 0.5, -5: 0.3) |
| d <= XP_GREY_DIFF (-6) | XP_GREY_MOD |

Expected XP per node at d = 0, in levels: Quest (2 mobs) 1.7; Grind wave 0.7; Elite 1.7 (x1.05 for +1 level); Rare 2.3; Dungeon about 5; Story bonus 0.9. (M2 v2)

Not by this formula: the Swift passage of a Road (1.9.7), `round(ROAD_SWIFT_XP_FRAC × xpToNext(L))` of the player's own level, with no modifier. (M2b v15)

---

## 5. Classes

### 5.1 Base stats and growth
| Field | Rogue | Mage | Hunter |
|---|---|---|---|
| hpBase / hpPerLevel | 100 / 21 | 62 / 21.06 | 60 / 15.5 | (M2 v3: mage 17.5 -> 19.5, hunter 17 -> 15.5; M2b v6: rogue 70 / 20 -> 100 / 21; M2b v8: mage 50 / 19.5 -> 62 / 21.06)
| STA base / growth | 10 / 1.4 | 8 / 1.25 | 9 / 1.2 | (M2 v2: mage 1.0 -> 1.25)
| AGI base / growth | 20 / 2.0 | 8 / 0.5 | 18 / 1.8 |
| INT base / growth | 6 / 0.3 | 22 / 2.2 | 10 / 0.8 |
| SPI base / growth | 8 / 0.6 | 12 / 1.0 | 9 / 0.8 |
| armorBase / armorPerLevel | 20 / 6 | 10 / 3 | 25 / 7 |
| armorMult (item armor) | 1.0 | 0.5 | 1.3 |
| dodgeBase / dodgeFromAgi | 0.05 / 0.10 | 0.03 / 0 | 0.04 / 0.06 |
| Resource | Energy + combo points | Mana | Focus + pet |
| Basic attack (free, not on bar) | Strike: phys `WD + 0.30P` | Spark: arcane `2 + 0.6L + 0.35P` | Auto Shot: phys `WD + 0.35P` |
| Role | melee burst, stealth, evasion | ranged nuker, control, shields | ranged, pet, traps, sustain |

### 5.2 Learning spells and ranks
- A spell becomes learnable at its `lvl`. It is learned only at a Trainer (hub, camp or node) for `TRAIN_NEW_V × V(lvl)`; it starts at tl = L.
- Spell strength uses tl (trained level). Training raises tl to the current L (`TRAIN_RANK_V × V(L)`). UI shows "Rank n" where n = number of times trained.
- Talent capstone spells and meta spells after learning: talent spells always use tl = L; meta spells follow the trainer rule.
- Action bar: SPELL_BAR_SLOTS = 7 spell slots, ITEM_BAR_SLOTS = 3 item slots [stated: at most 7 spells plus items]. Only spells on the bar and items on the item bar can be used in combat. Bar edits are out of combat only. Slot order is also the autoplay priority (7.9).

Formula columns: phys = physical (dodge and armor apply), fire/frost/arcane = magic (no dodge, no armor). Damage = `b + l×tl + p×P + w×WD`. Cost: Energy (E), % of base mana (M), Focus (F). CD in rounds (usable again in round r + CD).

### 5.3 Rogue spells
| id | Name | Lvl | Cost | CD | Effect | Tags | Autoplay condition |
|---|---|---|---|---|---|---|---|
| gutting_jab | Gutting Jab | 1 | 40E | 0 | phys 6 + 1.3tl + 0.55P + 1.0WD; +1 CP | builder | always |
| severing_flourish | Severing Flourish | 1 | 35E | 0 | phys (4 + 1.0tl + 0.30P) × CP + 0.5WD | finisher | CP >= 4, or CP >= 2 and target HP < 25 % |
| shadowstep_strike | Shadowstep Strike | 4 | 50E | 0 | phys 10 + 2.0tl + 0.9P + 1.5WD; +2 CP; requires STEALTH | opener | in STEALTH |
| throat_jab | Throat Jab | 6 | 20E | 4 | phys 2 + 0.4tl + 0.2P; interrupt (always hits, 7.7); SILENCED 1 | interrupt | target intent is a cast | (M2 v2: lvl 8 -> 6)
| open_vein | Open Vein | 10 | 30E | 0 | BLEED 4 rounds, tick (2 + 0.45tl + 0.10P) × CP | finisher, dot | CP >= 4, target elite/boss, no Open Vein on target | (M2 v2: 0.13P -> 0.10P)
| temple_blow | Temple Blow | 12 | 25E | 5 | STUN 1 + floor(CP/2) rounds (max 3) | finisher, stun | CP >= 1 and target intent is a cast or a heavy ability |
| smoke_veil | Smoke Veil | 16 | 25E | 8 | EVASION +0.45 dodge, 3 rounds | defensive | HP < 50 % and (>= 2 enemies or elite/boss) |
| whirling_edges | Whirling Edges | 20 | 50E | 0 | phys to all enemies 3 + 0.6tl + 0.3P + 0.6WD; +1 CP | aoe, builder | >= 2 enemies |
| expose_weakness | Expose Weakness | 24 | 25E | 0 | EXPOSED: target takes +0.04 × CP damage, 5 rounds | finisher | CP >= 4, target elite/boss, not EXPOSED |
| adrenal_surge | Adrenal Surge | 30 | 0 | 10 | +60 energy; energy regen x2 for 3 rounds | resource | energy < 40 |
| vanishing_step | Vanishing Step | 36 | 0 | 12 | dispersal (remove all debuffs on self); gain STEALTH | defensive, cleanse | HP < 30 % or own debuff stacks >= 3 |
| final_reckoning | Final Reckoning | 44 | 40E | 0 | phys (6 + 1.3tl + 0.35P) × CP; x2 if target HP < 35 % | finisher, execute | target HP < 35 % and CP >= 3 |

Finishers need CP >= 1 and consume all CP. Rogue starts every fight in STEALTH except the end boss and dungeon bosses.

### 5.4 Mage spells
| id | Name | Lvl | Cost | CD | Effect | Tags | Autoplay condition |
|---|---|---|---|---|---|---|---|
| ember_bolt | Ember Bolt | 1 | 9%M | 0 | fire 6 + 2.1tl + 1.12P | nuke | always | (M2 v2: 1.5tl + 0.8P -> 2.1tl + 1.12P)
| frost_lance | Frost Lance | 1 | 8%M | 0 | frost 4 + 1.54tl + 0.84P; CHILLED 2 | control | target not CHILLED | (M2 v2: 1.1tl + 0.6P -> 1.54tl + 0.84P)
| arcane_ward | Arcane Ward | 4 | 12%M | 5 | WARD absorbs 10 + 3.0tl + 1.0P, 4 rounds | defensive | no WARD active | (M2 v2: lvl 6 -> 4)
| rime_burst | Rime Burst | 10 | 12%M | 6 | frost to all 2 + 0.5tl + 0.25P; FROZEN 1 (non-boss) | aoe, stun | >= 2 enemies or HP < 50 % |
| living_flame | Living Flame | 12 | 10%M | 0 | BURN 5 rounds, tick 2 + 0.5tl + 0.22P | dot | target HP >= 60 %, no Living Flame on target |
| spellsnap | Spellsnap | 14 | 6%M | 5 | arcane 2 + 0.3tl + 0.2P; interrupt (always hits, 7.7); SILENCED 2 | interrupt | target intent is a cast | (M2 v2)
| hexbind | Hexbind | 18 | 10%M | 6 | HEXED 3 (non-boss) | control | >= 2 enemies; target = highest-HP non-focus enemy |
| cinder_storm | Cinder Storm | 22 | 22%M | 0 | fire to all 5 + 1.4tl + 0.63P | aoe | >= 3 enemies | (M2 v2: 1.0tl + 0.45P -> 1.4tl + 0.63P)
| mana_siphon | Mana Siphon | 26 | 0 | 12 | restore 30 % max mana | resource | mana < 30 % |
| glacial_tomb | Glacial Tomb | 30 | 0 | 15 | IMMUNE until end of next round (you skip your next action); dispersal; heal 10 % max HP | defensive, cleanse | HP < 25 % or own debuff stacks >= 3 |
| pyre_comet | Pyre Comet | 38 | 20%M | 3 | fire 12 + 4.2tl + 2.1P; +0.25 crit chance if target has BURN | nuke | always | (M2 v2: 3.0tl + 1.5P -> 4.2tl + 2.1P)
| starlance_barrage | Starlance Barrage | 46 | 25%M | 4 | arcane 3 hits of 4 + 1.2tl + 0.6P (each rolls hit/crit) | nuke | always | (M2 v2: 1.0tl + 0.5P -> 1.2tl + 0.6P)

### 5.5 Hunter spells and pets
| id | Name | Lvl | Cost | CD | Effect | Tags | Autoplay condition |
|---|---|---|---|---|---|---|---|
| keen_shot | Keen Shot | 1 | 30F | 0 | phys 5 + 1.1tl + 0.5P + 0.9WD | nuke | always |
| barbed_arrow | Barbed Arrow | 1 | 20F | 0 | BLEED 4 rounds, tick 2 + 0.45tl + 0.18P | dot | target HP >= 60 %, no Barbed Arrow on target |
| mark_prey | Mark Prey | 4 | 10F | 0 | MARKED: target takes +0.08 damage, 6 rounds | debuff | target elite/boss, not MARKED | (M2 v2: lvl 6 -> 4)
| mend_companion | Mend Companion | 6 | 25F | 3 | heal pet 15 + 4.0tl + 0.8P; if pet dead, revive at 0.30 | pet | pet HP < 45 % or pet dead | (M2 v2: lvl 8 -> 6)
| muzzle_shot | Muzzle Shot | 12 | 20F | 5 | phys 2 + 0.4tl + 0.25P + 0.3WD; interrupt (always hits, 7.7); SILENCED 2 | interrupt | target intent is a cast | (M2 v2)
| snare_trap | Snare Trap | 14 | 20F | 6 | STUN 2 (non-boss) | stun | >= 2 enemies (target = highest-HP non-focus) or HP < 40 % |
| field_dressing | Field Dressing | 18 | 25F | 6 | heal 12 % max HP now; HOT 4 % max HP per round, 3 rounds | heal | HP < 50 % |
| volley_rain | Volley Rain | 22 | 45F | 0 | phys to all 3 + 0.7tl + 0.3P + 0.4WD | aoe | >= 3 enemies |
| feign_stillness | Feign Stillness | 28 | 10F | 10 | dispersal; all enemies target the pet for 2 rounds (no pet: STEALTH) | defensive, cleanse | HP < 35 % or own debuff stacks >= 3 |
| savage_order | Savage Order | 34 | 30F | 4 | pet strikes phys 8 + 2.0tl + 1.0P (needs live pet) | pet | pet alive |
| rapid_volley | Rapid Volley | 40 | 0 | 10 | 3 rounds: your damage +40 %, focus regen +50 % | burst | target elite/boss |
| heartseeker_shot | Heartseeker Shot | 46 | 40F | 3 | phys 14 + 3.0tl + 1.3P + 1.5WD; +0.5 crit chance if target HP < 30 % | nuke | always |

Pets: chosen at creation, level = hunter level. Pet acts after the hunter each round with its basic attack (phys) on the hunter's current target. Pet damage `= (PET_DMG_BASE + PET_DMG_PER_LEVEL × L + PET_DMG_POWER × P) × PET.dmgMult`; pet crit = hunter crit + PET.critBonus; pet HP = PET.hpPct × hunter max HP; pet armor = hunter armor × PET.armorMult. A dead pet revives after the fight at PET_REVIVE_PCT, at Rest, or by Mend Companion. (M2 v2: PET_DMG_PER_LEVEL, PET_DMG_POWER raised)

| id | Name | hpPct | armorMult | dmgMult | critBonus | aggro | Special |
|---|---|---|---|---|---|---|---|
| ridgewolf | Ridgewolf | 0.50 | 1.0 | 1.0 | 0 | 0.30 | every 3rd pet action hits twice |
| thornback | Thornback Boar | 0.80 | 1.4 | 1.1 | 0 | 0.60 | TAUNT all enemies in round 1 and every 4 rounds after (1 round) | (M2 v3: dmgMult 0.9 -> 1.1)
| duskcat | Duskcat | 0.40 | 0.8 | 1.3 | 0.10 | 0.20 | none |
| stormhawk | Stormhawk (meta unlock) | 0.35 | 0.7 | 0.8 | 0 | 0.15 | attack also hits a second enemy |

`aggro` = chance an enemy single-target attack picks the pet (rolled at intent time) when no TAUNT/feign is active.

### 5.6 Meta-unlock spells (section 11)
| id | Class | Name | Lvl | Cost | CD | Effect | Autoplay condition |
|---|---|---|---|---|---|---|---|
| ghostblade_rush | Rogue | Ghostblade Rush | 20 | 45E | 5 | 2 strikes, each 0.8 × Gutting Jab amount; +2 CP | CP <= 3 |
| bloodprice_gambit | Rogue | Bloodprice Gambit | 40 | 0 | 12 | lose 10 % current HP; +5 CP; +50 energy | HP > 60 % and target elite/boss |
| chrono_sigil | Mage | Chrono Sigil | 20 | 10%M | 8 | target skips its action this round (bosses too; a channel is paused, not cancelled) | target intent is a heavy ability or cast and no interrupt ready |
| mirrorshade | Mage | Mirrorshade | 40 | 15%M | 10 | 3 rounds: each enemy attack on you has 0.5 chance to hit an image (no damage) | HP < 60 % |
| ricochet_bolt | Hunter | Ricochet Bolt | 20 | 35F | 0 | phys 5 + 1.1tl + 0.5P + 0.9WD on target, then 2 other enemies at 30 % | >= 2 enemies | (M2 v3: bounce 70 % -> 40 %; M2b v12 row 5, D104: bounceFrac is RICOCHET_BOUNCE_FRAC, 40 % -> 30 % since the sim's gate passed, balance-2026-11-11h)
| beastcall_horn | Hunter | Beastcall Horn | 40 | 0 | 12 | pet healed to full (revived if dead); pet TAUNT 2 rounds | HP < 40 % | (M2b v11 row 8, D98: CD is BEASTCALL_HORN_CD; M2b v12, D100: row 8 void, stays 12, the gated switch removed)

---

## 6. Talents

- Points: one at TALENT_FIRST_LEVEL and every TALENT_LEVEL_STEP levels after (26 at level 60). Spend any time out of combat (`SPEND_TALENT`). Reset only by RESPEC at a trainer.
- Three trees per class, 9 talents each. Tier t (1..5) requires `TALENT_TIER_GATE × (t-1)` points already spent in that tree. Tier 5 (capstone) needs 16 points in the tree, so one capstone per run is the maximum (17 + 17 > 26).
- "/rank" values multiply by ranks taken. "New spell" talents add a spell to the known list (tl = L, no trainer needed); it still needs a bar slot.

### 6.1 Rogue
| id | Tree / tier | Name | Ranks | Effect |
|---|---|---|---|---|
| r_a1 | Bladework 1 | Honed Edges | 3 | +0.03 crit chance /rank |
| r_a2 | Bladework 1 | Swift Hands | 3 | Gutting Jab costs -3 energy /rank |
| r_a3 | Bladework 2 | Serrated Finish | 3 | finishers +8 % damage /rank | (M2 v2: 6 -> 8 %)
| r_a4 | Bladework 2 | Riposte Stance | 2 | after you dodge an attack, your next Gutting Jab +25 % /rank |
| r_a5 | Bladework 3 | Keen Calculus | 2 | crit multiplier +0.20 /rank |
| r_a6 | Bladework 3 | Ruthless Momentum | 2 | finishers restore 5 energy per CP spent /rank |
| r_a7 | Bladework 4 | Twin Fangs | 3 | Strike and Gutting Jab: 0.10 /rank chance to hit again for 50 % |
| r_a8 | Bladework 4 | Whetted Whirl | 2 | Whirling Edges +15 % damage /rank and +1 CP /rank |
| r_a9 | Bladework 5 | Thousand Cuts | 1 | new spell `thousand_cuts`: 30E, CD 6, 4 strikes each 0.6 × Gutting Jab amount (each rolls), +2 CP |
| r_b1 | Shadowcraft 1 | Silent Footing | 3 | openers +10 % damage /rank |
| r_b2 | Shadowcraft 1 | Slippery | 3 | +0.02 dodge /rank |
| r_b3 | Shadowcraft 2 | Lingering Shade | 2 | openers grant +1 CP /rank |
| r_b4 | Shadowcraft 2 | Veiled Recovery | 2 | while EVASION is active, heal 2 % max HP per round /rank | (M2b v8: 3 -> 2 %)
| r_b5 | Shadowcraft 3 | Cheap Trick | 2 | Temple Blow -10 energy and -1 CD /rank |
| r_b6 | Shadowcraft 3 | Ambusher's Patience | 2 | first finisher each fight +20 % damage /rank |
| r_b7 | Shadowcraft 4 | Shroudwalk | 2 | Vanishing Step -3 CD /rank and heals 5 % max HP /rank | (M2b v8: heal 10 -> 5 %)
| r_b8 | Shadowcraft 4 | Night Instinct | 3 | +5 % damage /rank while in STEALTH and on the action right after leaving it |
| r_b9 | Shadowcraft 5 | Death's Sidestep | 1 | passive, once per fight: when a hit would drop you below 20 % HP, take no damage from it, dispersal, gain STEALTH, heal 15 % max HP | (M2b v8: heal 20 -> 10 %; M2b v9: 10 -> 15 %)
| r_c1 | Venomcraft 1 | Toxic Coating | 3 | Strike, Gutting Jab, Shadowstep Strike and Whirling Edges apply 1 POISON stack (4 rounds, max 5 stacks); tick per stack (0.5 + 0.15L + 0.04P) × rank |
| r_c2 | Venomcraft 1 | Deep Wounds | 3 | Open Vein +9 % /rank | (M2 v2: 12 -> 9 %)
| r_c3 | Venomcraft 2 | Lethal Mixture | 2 | POISON max stacks +2 /rank |
| r_c4 | Venomcraft 2 | Crippling Toxin | 2 | enemies with your POISON deal -5 % damage /rank |
| r_c5 | Venomcraft 3 | Hemorrhage Mastery | 2 | rank 1: your DOT ticks can crit; rank 2: also DOT damage +10 % |
| r_c6 | Venomcraft 3 | Septic Edge | 2 | Gutting Jab +4 % per POISON stack on target /rank |
| r_c7 | Venomcraft 4 | Rupture Venom | 1 | new spell `rupture_venom`: 30E finisher, phys (4 + 0.9L + 0.3P) × CP, +15 % per POISON stack on target |
| r_c8 | Venomcraft 4 | Fester | 3 | targets with your Open Vein take +3 % damage from you /rank |
| r_c9 | Venomcraft 5 | Plague Heart | 1 | passive: when an enemy with your POISON dies, its POISON stacks and Open Vein copy to every other enemy (full duration) |

### 6.2 Mage
| id | Tree / tier | Name | Ranks | Effect |
|---|---|---|---|---|
| m_a1 | Pyromancy 1 | Kindling | 3 | fire damage +4 % /rank |
| m_a2 | Pyromancy 1 | Searing Focus | 3 | fire spells +0.02 crit /rank |
| m_a3 | Pyromancy 2 | Smoldering | 2 | Living Flame +1 round and +10 % /rank |
| m_a4 | Pyromancy 2 | Fire Economy | 2 | Ember Bolt cost -1 %M /rank |
| m_a5 | Pyromancy 3 | Combustive Crits | 2 | fire crits apply IGNITE: BURN 2 rounds, total 20 % /rank of the crit's damage |
| m_a6 | Pyromancy 3 | Flashpoint | 2 | Pyre Comet CD -1 /rank |
| m_a7 | Pyromancy 4 | Wildfire | 2 | Cinder Storm applies Living Flame at 50 % strength /rank |
| m_a8 | Pyromancy 4 | Heat Haze | 3 | each crit grants WARD of 3 % max HP /rank (does not stack; refreshes, keeps the larger) |
| m_a9 | Pyromancy 5 | Conflagrant Core | 1 | new spell `conflagrant_core`: 0 cost, CD 12; 3 rounds: fire spells cost 0 and have +0.50 crit |
| m_b1 | Rimecraft 1 | Biting Cold | 3 | Frost Lance +12 % /rank | (M2 v2: 8 -> 12 %)
| m_b2 | Rimecraft 1 | Hoarfrost Skin | 3 | max HP +3 % /rank |
| m_b3 | Rimecraft 2 | Deep Chill | 2 | CHILLED reduces damage by a further 0.05 /rank |
| m_b4 | Rimecraft 2 | Brittle | 2 | CHILLED or FROZEN targets take +6 % from your spells /rank |
| m_b5 | Rimecraft 3 | Permafrost | 2 | Rime Burst CD -1 /rank |
| m_b6 | Rimecraft 3 | Shatter | 2 | +0.25 crit /rank against FROZEN targets |
| m_b7 | Rimecraft 4 | Lattice Ward | 2 | Arcane Ward absorbs +15 % /rank; when it breaks, attacker becomes CHILLED 2 |
| m_b8 | Rimecraft 4 | Deep Tomb | 1 | Glacial Tomb CD -5, heals 25 % instead of 10 % |
| m_b9 | Rimecraft 5 | Winter's Crown | 1 | new spell `glacier_spike`: 15 %M, CD 3, frost 10 + 3.9L + 2.1P; x1.5 vs CHILLED or FROZEN | (M2 v2: 2.6L + 1.4P -> 3.9L + 2.1P)
| m_c1 | Arcanism 1 | Deep Reserves | 3 | max mana +5 % /rank |
| m_c2 | Arcanism 1 | Arcane Acuity | 3 | Power +3 % /rank |
| m_c3 | Arcanism 2 | Lucid Flow | 2 | each spell cast: 0.05 /rank chance the next spell costs 0 |
| m_c4 | Arcanism 2 | Ward Weaving | 2 | Arcane Ward absorbs +10 % /rank | (M2 v2: 20 -> 10 %)
| m_c5 | Arcanism 3 | Spell Rebound | 2 | Spellsnap CD -1 /rank; a successful interrupt restores 3 % max mana /rank |
| m_c6 | Arcanism 3 | Barrage Mastery | 2 | Starlance Barrage +15 % /rank |
| m_c7 | Arcanism 4 | Mindguard | 1 | 20 % of damage taken is paid from mana instead, at 2 mana per 1 damage, while mana allows | (M2 v2: 30 -> 20 %)
| m_c8 | Arcanism 4 | Arcane Momentum | 3 | each consecutive round you cast a damaging spell: +1 % damage /rank, max 5 stacks; reset on any other action | (M2 v2: 2 -> 1 %)
| m_c9 | Arcanism 5 | Hourglass Reversal | 1 | new spell `hourglass_reversal`: 0 cost, CD 15; reset all other cooldowns; restore 20 % max mana |

### 6.3 Hunter
| id | Tree / tier | Name | Ranks | Effect |
|---|---|---|---|---|
| h_a1 | Beastbond 1 | Thick Hide | 3 | pet max HP +11.5 % /rank | (M2b v8: 8 -> 10 %; M2b v9: 10 -> 11.5 %, × 1.15)
| h_a2 | Beastbond 1 | Ferocity | 3 | pet damage +18 % /rank | (M2 v2: 6 -> 10 %; M2 v5: 10 -> 12.5 %; M2b v8: 12.5 -> 15.625 %, × 1.25; M2b v9: 15.625 -> 18 %, × 1.15)
| h_a3 | Beastbond 2 | Bonded Spirit | 2 | Mend Companion also heals you for 30 % /rank of the amount |
| h_a4 | Beastbond 2 | Frenzy Link | 2 | pet crit +0.05 /rank; each pet crit gives you 5 focus /rank |
| h_a5 | Beastbond 3 | Unbreakable Bond | 2 | pet revives after fights at +0.25 /rank; pet takes -5 % damage /rank |
| h_a6 | Beastbond 3 | Pack Leader | 2 | you and pet deal +6.25 % damage /rank while pet is alive | (M2 v2: 3 -> 5 %; M2 v5: 5 -> 6.25 %)
| h_a7 | Beastbond 4 | Savage Mastery | 2 | Savage Order CD -1 and +12.5 % /rank | (M2 v5: 10 -> 12.5 %)
| h_a8 | Beastbond 4 | Shared Wounds | 1 | 20 % of damage you take is moved to the live pet |
| h_a9 | Beastbond 5 | Primal Unity | 1 | new spell `wild_communion`: 30F, CD 10; 4 rounds: pet damage +50 % and pet TAUNT |
| h_b1 | Marksmanship 1 | Steady Aim | 3 | Keen Shot +4 % /rank | (M2 v2: 6 -> 4 %)
| h_b2 | Marksmanship 1 | Lethal Shots | 3 | +0.02 crit /rank |
| h_b3 | Marksmanship 2 | Efficiency | 2 | Keen Shot and Heartseeker Shot cost -5 focus /rank |
| h_b4 | Marksmanship 2 | Mortal Shots | 2 | crit multiplier +0.15 /rank (your shots, not pet) | (M2 v2: 0.20 -> 0.15)
| h_b5 | Marksmanship 3 | Deep Mark | 2 | MARKED +0.04 /rank |
| h_b6 | Marksmanship 3 | Piercing Volley | 2 | Volley Rain +20 % /rank |
| h_b7 | Marksmanship 4 | Trueshot Focus | 2 | Rapid Volley CD -2 and its bonus +10 % /rank |
| h_b8 | Marksmanship 4 | Concussive Precision | 1 | Muzzle Shot also STUN 1 (non-boss) |
| h_b9 | Marksmanship 5 | Starfall Arrow | 1 | new spell `starfall_arrow`: 50F, CD 5, phys 20 + 4.0L + 1.8P + 2.0WD; refund 50F if it kills |
| h_c1 | Wildcraft 1 | Hardy | 3 | max HP +3 % /rank | (M2b v8: 4 -> 3 %)
| h_c2 | Wildcraft 1 | Barbed Mastery | 3 | Barbed Arrow +20 % /rank | (M2 v2: 10 -> 20 %)
| h_c3 | Wildcraft 2 | Trapper | 2 | Snare Trap CD -1 /rank and deals phys (4 + 1.0tl + 0.4P) × rank |
| h_c4 | Wildcraft 2 | Field Medic | 2 | Field Dressing +10 % /rank | (M2b v8: 20 -> 10 %)
| h_c5 | Wildcraft 3 | Survivalist | 2 | +0.02 dodge /rank | (M2b v8: 0.03 -> 0.02)
| h_c6 | Wildcraft 3 | Venom Barbs | 2 | Barbed Arrow stacks to 1 + rank (each stack a full tick) |
| h_c7 | Wildcraft 4 | Fire Snare | 1 | Snare Trap also applies BURN 3 rounds to all enemies, tick 3 + 0.6tl + 0.25P |
| h_c8 | Wildcraft 4 | Cornered Beast | 3 | +8 % damage /rank while HP < 50 % | (M2 v2: 4 -> 8 %)
| h_c9 | Wildcraft 5 | Deadfall Mastery | 1 | new spell `deadfall_trap`: 30F, CD 8, phys to all 10 + 2.4L + 1.0P; STUN 1 non-boss; interrupts boss casts |

---

## 7. Combat

### 7.1 Manual-first fight flow
Manual control is the default; the player picks every action [stated: owner correction]. Each round:
1. **Intents.** Every living enemy that can act shows its intent for this round and the UI shows it: ability name, target (player or pet), estimated damage, and flags `cast` (interruptible) and `heavy` (telegraphed big hit). The intent is the "now" entry of the enemy's intent track, which also shows its next INTENT_TRACK_LEN - 1 turns (7.11, combat v2; it replaces the per-round intent roll). This is the main source of manual decisions: interrupt a cast, stun or hex the heavy hitter, kill the healer, raise a shield, drink now or later.
2. **Player action.** Exactly one: `CAST(spellId, targetIdx)`, `ATTACK(targetIdx)`, `USE_ITEM(itemBarSlot, targetIdx)`, `FLEE`, or `PASS`; in the engage round also `ENGAGE(optionId, targetIdx)` (7.10, combat v2). Autoplay chooses with policy 7.9 if on.
3. **Pet action** (Hunter).
4. **Enemy actions** in index order, each performing its intent (re-targeted if TAUNT or feign changed the valid target).
5. **End of round:** DOT/HOT ticks (player side first, then enemies in index order), WARD/status durations -1, cooldowns -1, resources regen, Eclipse etc.; then a Signal reinforcement joins (7.12, combat v2). Death checks after every damage event; the fight ends at once when all enemies are dead (victory) or the player is dead (section 9).

Round 1 is the engage round of every fight except the end boss (7.10, combat v2): enemies are "Unaware" and do not act. (Before combat v2 only a stealthed Rogue's enemies were Unaware in round 1.)

`SET_AUTOPLAY(on|off)` is legal at any time, including mid-fight; it changes who decides the next player action and nothing else.

Fight start: energy/focus full, CP 0, all cooldowns 0. Fight end: statuses (except run-level boons and Elixir) and WARD removed, cooldowns reset, then post-fight regen.

### 7.2 Damage pipeline (exact order)
1. `base` from the formula (spell, basic attack, enemy ability).
2. × attacker modifiers (sum of % mods: talents, buffs, boons, elixir, meta), × level modifier `clamp(1 + LVL_DMG_STEP × (attackerLevel - targetLevel), LVL_DMG_MIN, LVL_DMG_MAX)`, × CHILLED/CURSED on attacker.
3. Draw r1: miss if `r1 < missChance`. `missChance = min(MISS_CAP, MISS_BASE + MISS_PER_LEVEL × max(0, targetLevel - attackerLevel)) + (physical ? target dodge : 0) + STEALTH bonus`. Interrupt-tagged spells (Throat Jab, Spellsnap, Muzzle Shot) never miss and cannot be dodged; r1 is still drawn. (M2 v2) An OFF_BALANCE enemy has dodge 0 (7.13). (combat v2)
4. Draw r2: crit if `r2 < critChance` -> × crit multiplier. The player's crit chance is +OFFBAL_CRIT against an OFF_BALANCE or FROZEN enemy (7.13) and +GATHER_CRIT on a spell cast under Gathered Power (7.10). (combat v2)
5. Draw r3: × `(1 - DMG_VARIANCE + 2 × DMG_VARIANCE × r3)`.
6. × target modifiers (EXPOSED, MARKED, Brittle, Fester, Linked, Shard brittleness, shield-wall effects, OFF_BALANCE from the player and pet (combat v2), PET_LEAD on the pet (combat v2)), summed as % and applied once. Linked on the end boss: `-min(LINK_DR, LINK_DR_PER_SHARD × living Shards)`. Shard brittleness: a Shard takes `+SHARD_AOE_TAKEN` from direct hits of the player's aoe-tagged spells (not from DOT ticks or the pet). (M2 v2)
7. Physical: × `(1 - mitigation(target armor, attacker level))`. Magic: unchanged.
8. Round; a hit deals at least MIN_HIT_DAMAGE.
9. WARD absorbs first, then HP. IMMUNE: 0 damage (still draws r1-r3).

Each damage event draws exactly 3 numbers (r1, r2, r3) even on a miss. Multi-hit spells are separate events. DOT ticks: damage is fixed at application (steps 1-2 and 6 snapshot), no miss, no armor, draw 1 number only if the tick can crit. Heals: no rolls, no crit.

Enemy crit chance ENEMY_CRIT, crit multiplier CRIT_MULT. Enemy dodge ENEMY_DODGE (+ archetype). Step 2 attacker modifiers of a beast include Bloodlust (7.12). (combat v2) Step 2 attacker modifiers of every template enemy include EMPOWERED (+EMPOWER_DMG per stack) and STAGGERED (-STAGGER_DMG per stack), the lasting result of its wind-ups (7.12). (combat v2.1) Each is the sum of its stacks' values: a landed Deathblow's EMPOWERED stack is DEATHBLOW_EMPOWER, every other stack EMPOWER_DMG or STAGGER_DMG (7.12). (M2b v13)

### 7.3 Resources and costs
Cost is paid on use, also on a miss. Mana costs are `round(cost% × base mana(L))`. Not enough resource = spell unusable. Energy/Focus regen at end of round; mana regen MANA_REGEN_ROUND_PCT at end of round.

### 7.4 Status effects
Durations count end-of-round decrements including the round of application (a 1-round STUN applied by the player cancels that enemy's action in the same round). Re-applying refreshes duration unless stacking is listed. "Dispersal" removes every debuff on self.

| Status | On | Effect | Stacking | Removed by |
|---|---|---|---|---|
| STUN | enemy | skips actions (cancels its now-entries, 7.11) | refresh | end; bosses immune (stun on boss = interrupt) |
| FROZEN | enemy | skips actions (cancels its now-entries, 7.11); counts as OFF_BALANCE (7.13) (combat v2) | refresh | end; bosses immune (= interrupt) |
| HEXED | enemy | skips actions, intent "none" | refresh | any damage to it; bosses immune (= interrupt) |
| SAPPED | enemy | skips actions, intent "Sapped" (Sap, 7.10) (combat v2) | refresh | end, any damage to it (DOT ticks and AoE included); bosses immune |
| OFF_BALANCE | enemy | 7.13: damage taken +value from the player and pet, player crit +OFFBAL_CRIT, dodge 0 (combat v2) | refresh | end |
| EMPOWERED | enemy | +EMPOWER_DMG damage dealt per stack (7.2 step 2): one stack per wind-up it landed unanswered (7.12) (combat v2.1); value = the sum of its stacks' values, a Deathblow's stack DEATHBLOW_EMPOWER (M2b v13) | +1 stack per wind-up, no cap, no expiry | fight end |
| STAGGERED | enemy | -STAGGER_DMG damage dealt per stack (7.2 step 2): one stack per wind-up the player answered (7.12) (combat v2.1); value = the sum of its stacks' values (M2b v13) | +1 stack per wind-up, no cap, no expiry | fight end |
| MAIMED | player | every heal the player receives × (1 - MAIM_HEAL) (7.5): a Deathblow landed (7.12) (M2b v13) | one; a second Deathblow changes nothing | fight end only (not dispersal, not a resurrect) |
| TRAP | enemy | Lay Trap: springs at the start of turn `turn` (7.10) (combat v2) | - | springing |
| SILENCED | enemy | cannot play `cast` intents: a cast entry that becomes now while SILENCED is replaced by the basic attack (7.11) (combat v2); a wind-up replaced this way counts as answered (7.12) (combat v2.1) | refresh | end |
| BLEED / BURN | any | tick damage at end of round | one per source spell; refresh | end, dispersal (on player) |
| POISON | enemy | tick per stack | up to cap; each application +1 stack, refresh | end |
| CHILLED | any | outgoing damage -CHILL_PCT | refresh | end, dispersal |
| CURSED | player | outgoing damage -CURSE_PCT | refresh | end, dispersal |
| EXPOSED / MARKED | enemy | damage taken + value | separate statuses add | end |
| BRAND | player | BRAND_DMG per stack per round | +1 stack up to BRAND_MAX, no expiry | dispersal only |
| WARD | player | absorbs damage | one; new replaces if larger | broken, end, fight end |
| EVASION | player | + dodge | refresh | end |
| STEALTH | player | openers usable; enemy attacks vs you +STEALTH_MISS_BONUS miss | - | any non-opener action (except Sap, Premeditate, and a PASS while every living enemy is SAPPED; M2b v14), after 1 round if gained mid-fight |
| IMMUNE | player | no damage, cannot act | - | end (Final Dark ignores it) |
| HOT | any | heal per tick | refresh | end |
| TAUNT | pet | all enemy single-target attacks target the pet | refresh | end, pet death |
| PET_LEAD | pet | damage taken -value (Send the Pet, 7.10) (combat v2) | refresh | end, pet death |
| GATHER | player | Gathered Power: `stacks` damaging spells left at 0 mana and +GATHER_CRIT crit (7.10) (combat v2) | - | used up, fight end |

### 7.5 Usable items in combat
Only items on the 3 item-bar slots, one item per action. Healing and Mana Draughts share POTION_CD. Other items have no cooldown. See 8.6 for effects.

**Free potion (Packed Satchel, 11.2) (M2b v6).** With Packed Satchel, the first potion the player drinks in each fight costs no turn. A potion is an item with the potion flag (Healing Draught, Mana Draught, Greater Healing Draught; the POTION_CD group). Exact behaviour:
- The first legal `USE_ITEM` of a potion in a fight (any round, the end-boss fight included) resolves as a normal player action (its effect, POTION_CD starts, and every side effect of a player action: STEALTH is removed (7.4), Arcane Momentum resets), and then the round does not go on: no pet action, no enemy actions, no end of round, the round number stays. The player chooses an action again in the same round (autoplay runs its policy again, 7.9). The fight's free potion is then used.
- Every later potion in the fight costs the turn as before. Without Packed Satchel nothing changes. Other items (Tonic, Spark Flask) are never free.
- It is legal only when the player could act in that round (not while the player's action is skipped).
- It restores FREE_POTION_MULT × its normal amount: Healing Draught 0.35 -> 0.175 of max HP, Mana Draught 0.35 -> 0.175 of max mana, Greater Healing Draught 0.375 -> 0.1875 of max HP. The normal amount includes a potion unique's +UNIQUE_POTION_PCT (11.3); the result is rounded once, at the end. Later potions in the fight cost the turn and restore their full amount. The first potion of a fight is always the free one: the player does not choose between a free half potion and a full paid one. (M2b v8)
- Event: the item-use event carries `free: true` and `mult` (FREE_POTION_MULT; M2b v8) so the UI can say "Free action, half strength (Packed Satchel)"; the run summary's potions count includes free potions.

**MAIMED (M2b v13, D107).** While the player is MAIMED (a landed Deathblow, 7.12), every heal the player receives is × (1 - MAIM_HEAL), applied to the heal's amount before the cap at max HP and rounded once: Healing and Greater Healing Draughts (the free potion after its FREE_POTION_MULT), heal spells and talents, HOT ticks, heal-on-kill. Mana is not healing. It lasts the rest of the fight: dispersal (Vanishing Step, Glacial Tomb, Feign Stillness, Purifying Tonic) and a resurrect do not remove it; no potion cap is added. The item tooltip shows the cut amount (potionInfo). (M2b v13)

### 7.6 Enemy AI and intents
Each enemy has an archetype (table) plus up to 2 template abilities (12.4). Its intents come from its intent track (7.11, combat v2; it replaces the per-round intent roll): each entry is an opening-script action (7.12) or a weighted pick (1 draw) among the basic attack and the abilities eligible for that turn (off cooldown, condition holds), by the weights below, then 1 draw for the target while a live pet exists. Conditions and SILENCED are checked again when the entry becomes now (7.11).

| Archetype | HP mult | Dmg mult | Armor mult | Extra dodge | Actions (weight) |
|---|---|---|---|---|---|
| brute | 1.2 | 1.0 | 1.0 | 0 | Strike 100 % phys (70); Heavy Smash 180 % phys, heavy, CD 3 (30) |
| skulker | 0.9 | 1.0 | 0.8 | 0.10 | Strike (60); Rend 60 % + BLEED 3 rounds tick 20 % (40), CD 3 |
| caster | 0.8 | 1.1 | 0.5 | 0 | Bolt 110 % magic (60); Hex Bolt 200 % magic, cast, CD 3 (25); Wither: CURSED 3, cast, CD 5 (15) |
| beast | 1.0 | 0.9 | 0.8 | 0.05 | Bite 100 % phys (60); Frenzy 2 × 70 % phys (40), CD 2 |
| guardian | 1.5 | 0.8 | 2.0 | 0 | Strike (60); Brace: self takes -50 % 2 rounds, CD 4 (20); Shield Ally: its ward takes -50 % 2 rounds, CD 4 (20) (combat v2: the ward, 7.12; was the lowest-HP ally) |
| mender | 0.9 | 0.6 | 0.8 | 0 | Strike (50); Mend: heal lowest-HP ally (incl. self) 25 % max HP, cast, CD 3, only if some ally < 70 % (50) |

Normal enemy at level M: `HP = (ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL × M) × archetype × variant`, `dmg (100 %) = (ENEMY_DMG_BASE + ENEMY_DMG_PER_LEVEL × M) × archetype × variant` (× zone danger below, × ENGAGE_DMG_COMP for every template enemy: the price of the engage round, 7.10 (combat v2); not in the Rogue's fights except its dungeon-boss fights (D48, D49)), `armor = ENEMY_ARMOR_PER_LEVEL × M × archetype`. Variants: normal 1/1, dungeon trash DUNGEON_TRASH_HP_MULT/DUNGEON_TRASH_DMG_MULT, elite ELITE_HP_MULT/ELITE_DMG_MULT, rare RARE_HP_MULT/RARE_DMG_MULT, dungeon boss DUNGEON_BOSS_HP_MULT/DUNGEON_BOSS_DMG_MULT.

Zone danger (M2 v3): every enemy made from an enemy template (normal, quest, grind, elite, rare, dungeon trash and boss, Camp waves, summoned adds) has its damage multiplied by `zd(M) = early(M) × (1 + ZONE_DANGER_STEP × max(0, M - ZONE_DANGER_FROM) / 10)` (level 30 ×1.45, 40 ×1.9, 50 ×2.35, 60 ×2.8) (M2b v8: ZONE_DANGER_STEP 0.25 -> 0.375; M2b v9: 0.375 -> 0.45, were ×1.375, 1.75, 2.125, 2.5). Dungeon trash and dungeon bosses use `early(M) × (1 + DUNGEON_DANGER_FRAC × (zd0(M) - 1))` instead, zd0 being zd without the early factor (level 60 ×1.9; M2b v8 ×1.75, M2b v9) (M2 v4). Early enemies: `early(M) = EARLY_DMG_MULT` if `M <= EARLY_DMG_MAX_LEVEL`, else 1, so every template enemy of level 20 or lower deals × 0.80; at level 21 the factor is 1 (a level-20 enemy's 100 % damage is (4 + 2.6 × 20) × 0.80 = 44.8, a level-21 enemy's (4 + 2.6 × 21) × 1.045 = 61.2, before archetype, variant and ENGAGE_DMG_COMP) (M2b v8; M2b v9: × 1.045). HP, armor and XP are unchanged. The end boss and the Dimming Shards use their own constants (section 10) and are not affected. Purpose: same-level content stays about as threatening in zones 3-6 as in zone 2; the player's power growth (talents, ranks, rarity) otherwise outpaces the linear damage curve. (M2 v3)

Soft enrage (non-boss fights): from round FIGHT_SOFT_ENRAGE_ROUND, enemies deal +FIGHT_SOFT_ENRAGE_STEP more damage per round (additive). Prevents endless fights.

### 7.7 Interrupts
An enemy whose intent has `cast` loses that action if, before it acts in that round, it is hit by an interrupt (Throat Jab, Spellsnap, Muzzle Shot; these always hit, 7.2 step 3), or becomes STUN/FROZEN/HEXED, or (bosses) is hit by any stun-tagged spell. (M2 v2) Cooldown of the cast ability still starts. 2-round boss channels (10.3) can be interrupted in either round. An interrupted enemy becomes OFF_BALANCE (7.13); so does the end boss when its Collapse Litany is interrupted. (combat v2) A wind-up (7.12) has `cast`, so everything above stops it, on a dungeon boss too (an interrupt, or a stun-tagged spell, which is an interrupt on a CC-immune enemy). (combat v2.1)

### 7.8 Flee
`FLEE` succeeds if a draw < `FLEE_BASE - FLEE_PER_EXTRA_ENEMY × (living enemies - 1)` (1.0 in STEALTH). Success: leave the node; tolls already spent; no further rewards from the node; quest not counted; dungeon not cleared. Not allowed vs dungeon boss or end boss. Legal in the engage round as in any round (combat v2).

### 7.9 Autoplay policy (autoplay toggle and bots)
Deterministic given state and seed. Each player turn, the first rule that yields an action wins:
- E2. (M2b v13, D108) Answer the Deathblow, in the engage round only, before rule E: for each living elite, rare or dungeon boss in index order whose track shows a wind-up in turns 1..INTENT_TRACK_LEN: if the class's control option (7.10) is legal on it, use it on that enemy (on a dungeon boss it is Disrupt). A lone special enemy counts, and the Rogue may Sap here: E2 supersedes D49 (and combat-v2.md open choice 9) for this case only; rule E keeps both. (M2b v13)
- E. (combat v2) Engage, in the engage round only, before rule 1: if at least 2 enemies are alive and the class's control option (7.10) is usable on some enemy: the control option on the enemy whose track shows the largest estimated damage on the player (entries aimed at the player or at all) over its turns 1..ENGAGE_AUTO_LOOK (ties: default-target order). The Rogue never uses Sap here; Sap stays a manual option (combat v2, D49). Otherwise the strike option on the default target (Mage: Pre-cast of the first bar spell whose autoplay condition holds; if none, rules 1-6).
1. HP < AUTO_POTION_HP and a healing item on the item bar is usable -> use it.
2. Own debuff stacks (BRAND counts per stack) >= AUTO_TONIC_STACKS and a cleanse spell (tag cleanse) or Purifying Tonic is usable -> use it (spell first).
- H. (M2b v14, D111) Wait in the shadows, not in the engage round: every living enemy is SAPPED and some SAPPED enemy's track shows, after its now-entry, a wind-up whose cancel the track predicts by SAPPED (7.11, "what the track shows") -> PASS. Sap then cancels the wind-up at its turn (answered: STAGGERED, 7.12; OFF_BALANCE, 7.13), and the PASS keeps STEALTH (7.4), so the next action can be an opener. Any class with SAPPED enemies (today the Rogue after rule E2's Sap of a lone special enemy, or of an elite whose add died). Switch GATES.sapHold (on), kept for sim arms. (M2b v14)
3. Some enemy intent is `cast` and an interrupt or stun-tagged spell on the bar is usable on it -> use it on the cast with the highest estimated damage (ties: lowest index).
4. Mana < AUTO_MANA_POTION and a Mana Draught is on the item bar and usable -> use it.
5. Bar slots 1..7 in order: the first usable spell whose autoplay condition holds -> cast on the default target (or the spell's own target rule).
6. Basic attack on the default target.

Default target: living, non-HEXED, non-SAPPED (combat v2) enemy, priority mender > caster > others; within a priority, lowest current HP; ties lowest index. An enemy that was sapped this fight is the default target only when no other living non-HEXED, non-SAPPED enemy is left, so autoplay never switches back to it while it fights another (combat v2, D48); HEXED or SAPPED enemies only when no other is left. "Focus" = default target. ">= N enemies" counts living non-HEXED, non-SAPPED enemies. Rules 1-6 read only the now-entry of each track and never hold a spell for an OFF_BALANCE window (combat v2): the track and the window are the manual player's edge. Rule H reads the track's predicted cancel (7.11) only to wait for Sap (M2b v14).
Between fights in a node: if HP < AUTO_FOOD_HP (or mana < AUTO_FOOD_HP for Mage) and Trail Rations are in the bag, eat one.

### 7.10 Engage round (combat v2)
- Round 1 of every fight except the end boss is the engage round for every class: enemies show "Unaware" and do not act; DOT ticks, regen, durations and the pet act as in any round. An enemy's turn t is fight round t + 1 (end boss: round t). Dungeon bosses included; their immunity to control limits the control options. (combat v2)
- In the engage round the player sees every track (turns 1..INTENT_TRACK_LEN) and takes one action: `ENGAGE(optionId, targetIdx)`, any bar spell (`CAST`), `ATTACK`, `USE_ITEM`, `PASS`, or `FLEE` (7.8). `ENGAGE` is legal only in the engage round, so at most once per fight. (combat v2)
- Engage options are class abilities, not bar spells: no bar slot, no training, no resource, known from level 1; their strength uses L (tl = L); damage options follow 7.2 like a spell. Control options cannot control an enemy immune to control (dungeon bosses); on adds they work normally. On a CC-immune enemy every control option (Sap, Binding Glyph, Lay Trap) is instead **Disrupt**: legal only while the enemy's track shows a wind-up (7.12) within turns 1..INTENT_TRACK_LEN; it lays a TRAP on the first such turn that springs as Lay Trap's (STUN for that one turn, which cancels only that entry: OFF_BALANCE and STAGGERED); nothing else (no SAPPED, no FROZEN); Sap keeps the Rogue in STEALTH as usual. (combat v2.1) "n turns" of an option = status duration n + 1 (7.4 counts the round of application). (combat v2)
- Price of the free round: every template enemy deals × ENGAGE_DMG_COMP (7.6; not the end boss or the Dimming Shards). (combat v2) Not in the Rogue's fights: its enemies were already Unaware in round 1 before combat v2, so the engage round is no new free round for it (D48). Except its dungeon-boss fights, which it starts without STEALTH (5.3): there every template enemy, the boss and its adds, deals × ENGAGE_DMG_COMP (D49).

| id | Class | Kind | Name | Target | Effect |
|---|---|---|---|---|---|
| ambush | rogue | strike | Ambush | enemy | Shadowstep Strike on the target if learned (its talents and CP), else Gutting Jab × AMBUSH_MULT and +2 CP on a hit; the Rogue stays in STEALTH like after a stealth opener (7.4; D48) |
| sap | rogue | control | Sap | enemy (CC-immune: Disrupt, above; combat v2.1) | SAPPED for SAP_TURNS turns (cancels those now-entries, 7.11); breaks on any damage to it, DOT ticks and AoE included; the Rogue stays in STEALTH |
| premeditate | rogue | setup | Premeditate | none | +PREMED_CP CP; the Rogue stays in STEALTH |
| precast | mage | strike | Pre-cast | a bar spell and its target | casts that bar spell at 0 mana cost (its cooldown starts) |
| binding_glyph | mage | control | Binding Glyph | enemy (CC-immune: Disrupt, above; combat v2.1) | FROZEN for GLYPH_TURNS turns, not broken by damage (counts as OFF_BALANCE while FROZEN, 7.13) |
| gather_power | mage | setup | Gathered Power | none | GATHER: the next GATHER_SPELLS damaging spells cost 0 mana and have +GATHER_CRIT crit chance; lasts the fight |
| opening_shot | hunter | strike | Opening Shot | enemy | Keen Shot × OPENING_SHOT_MULT on the target (its talents), then MARKED (value SPELL.mark_prey.marked) for OPENING_MARK_ROUNDS rounds |
| lay_trap | hunter | control | Lay Trap | enemy (CC-immune: Disrupt, above; combat v2.1) | TRAP: springs at the start of the target's first turn among 1..INTENT_TRACK_LEN whose entry has `heavy` or `cast` (else of its turn 1): STUN TRAP_STUN, which cancels that now-entry (a cancelled heavy or cast: OFF_BALANCE, 7.13) |
| send_pet | hunter | setup | Send the Pet | enemy (the pet's target) | needs a live pet; the pet engages first: pet TAUNT and PET_LEAD (damage taken -PET_LEAD_DR) for PET_LEAD_TURNS turns |

### 7.11 Intent track (combat v2)
- Turns: an enemy's turn t is fight round turn0 + t - 1; turn0 = 2 for enemies present at the start of a fight with an engage round, 1 in the end-boss fight, the next round for an enemy that appears mid-fight (template summon, Signal reinforcement, Shards that come with phase 2). A Shards wave at the start of a round acts in that round (10.2 unchanged). (combat v2)
- Every living enemy has a track of INTENT_TRACK_LEN entries: its current turn ("now") and the next INTENT_TRACK_LEN - 1 turns; before its turn 1 (the engage round, an add that just appeared) the track shows turns 1..INTENT_TRACK_LEN. An entry holds the action with its flags `cast` and `heavy` and the drawn pet-aggro target; the shown target and estimated damage are computed from the current state each round (they change with CHILLED, CURSED, WARD, Bloodlust, TAUNT). (combat v2)
- Filling (stream `fight`): at fight start the entries for turns 1..INTENT_TRACK_LEN are made turn by turn, enemies in index order; at the start of every later round the used head entries are dropped and one entry is appended to each living enemy's track, enemies in index order; an enemy that appears mid-fight draws its whole track at once. Draws happen only when an entry enters the track, never later: entries already shown are fixed facts, entries not yet shown are not in the state. (combat v2)
- Entry for turn t: the scripted action (7.12), or a weighted pick (1 draw) with the 7.6 weights among the actions eligible for turn t: off cooldown at that turn (by the enemy's cooldowns, by earlier entries of the track that use it within its cooldown, and by a later scripted entry that uses it within its cooldown) and whose 7.6 condition holds now (Mend: an ally below MEND_BELOW; Shield Ally: a living ward; self_heal: below 70 %; self_shield: no shield). Then 1 draw for the pet-aggro target (PET.aggro) whenever a live pet exists; TAUNT and feign apply when the entry becomes now, so a taunt does not bend entries beyond its duration (the track shows the pet as target for turns a running TAUNT or feign covers). (combat v2)
- When an entry becomes now (the start of the enemy's turn), in this order: a TRAP that is due springs; if the enemy is STUN, FROZEN, HEXED or SAPPED the entry is cancelled (intent "Stunned", "Hexed" or "Sapped"; a cancelled `cast` or `heavy` entry: OFF_BALANCE, 7.13); a template summon at its HP trigger takes the turn (12.4, once); an entry that cannot be played (its cooldown still runs, `cast` while SILENCED, Mend with no ally below MEND_BELOW, Shield Ally without a living ward, self_heal not below 70 %, self_shield while shielded, Signal already given this fight or by an enemy whose turn started first this round) is replaced by the archetype's basic attack aimed at the entry's drawn target, and the intent says what it replaced and why. TAUNT and feign retarget single-target entries (7.1 step 4). (combat v2)
- Control that lands during a round (the player's action) cancels the now-entry at once: a cast is interrupted (7.7), a heavy is cancelled with OFF_BALANCE, any other action is just cancelled. The rest of the track keeps its turns (a stun cancels, it does not delay). (combat v2)
- What the track shows also includes, per entry, whether it will be cancelled (D52), and whether that cancel answers a wind-up (7.12; combat v2.1, engine), predicted from the current state each round: the now-entry when its intent is cancelled; a later entry whose turn a laid TRAP's STUN covers (from the trap's turn for TRAP_STUN turns); else a later entry whose round still has a control status on (a status with n rounds left is on at the start of the next n - 1 rounds, 7.4; the first of STUN, FROZEN, HEXED, SAPPED). HEXED and SAPPED predictions hold only while the enemy takes no damage. Actions still to come (an interrupt, new control) are not predicted. (combat v2)
- End boss (10.3): the track shows its next INTENT_TRACK_LEN rounds; each entry's target is drawn when it enters the track (pet aggro); the scheduled actions are projected each round from the current phase, and later entries carry the next phase and its actions where a phase change would change them. (combat v2)

### 7.12 Opening scripts and pack roles (combat v2)
Turns 1..OPENING_TURNS of every enemy present at fight start (not summons, Signal reinforcements, Shards or the end boss) follow its archetype's script (no draw for the action):

| Script | Turn 1 | Turn 2 | Turn 3 |
|---|---|---|---|
| brute | strike | heavy_smash | strike |
| caster | bolt | hex_bolt | wither |
| skulker | rend | strike | signal |
| beast | frenzy | bite | frenzy |
| guardian | shield_ally | strike | brace |
| mender | bolster | strike | mend |

A skulker plays `signal` only if the fight started with at least 2 enemies, else `strike`. Elite, rare and dungeon boss: the entry for turn SIGNATURE_TURN is the template ability with the highest pct (ties: first listed); a dungeon boss also plays its other template ability on turn SIGNATURE_TURN_2; abilities with `once` (enrage, summon) are never scripted and keep their HP triggers. A scripted action's pct is × HEAVY_SCRIPT_MULT if it is heavy, × CAST_SCRIPT_MULT if it is a cast. Scripted entries are checked when they become now like every entry (7.11). (combat v2) The multipliers raise scripted damage only (hit, rend, cleave): a scripted heal or shield (Mend, Bolster, Self Heal, Self Shield) keeps its pct, cast or not (combat v2.1, D60).

Wind-ups (combat v2.1): a signature entry (an elite's, rare's or dungeon boss's entry on SIGNATURE_TURN, a dungeon boss's on SIGNATURE_TURN_2) is a **wind-up**: the entry has the flag `windup` and also `cast`, whatever its kind, so every interrupt, stun or control stops it (7.7), on CC-immune enemies too; its pct takes only the script multiplier of its own flag (a heavy one × HEAVY_SCRIPT_MULT, a cast one × CAST_SCRIPT_MULT; the added `cast` adds nothing), and only if it deals damage (a Self Heal or Self Shield wind-up keeps its pct, D60). Its result lasts the whole fight:
- **Answered** (it is interrupted; it is cancelled by STUN, FROZEN, HEXED, SAPPED, a trap or Disrupt; it is replaced because the enemy is SILENCED; or it is a heavy one from which the player lost 0 HP, 7.13 (3)): the enemy gains a STAGGERED stack (-STAGGER_DMG damage dealt for the rest of the fight), besides OFF_BALANCE where 7.13 gives it.
- **Landed** (it is played, and for a hit or rend the player or the pet lost HP to it; cleave, curse, self_heal and self_shield count as landed whenever they are played): the enemy gains an EMPOWERED stack (+EMPOWER_DMG damage dealt for the rest of the fight).
- An entry replaced for any other reason (cooldown, a condition) is neither. The track, the intent and the frame show the wind-up flag; the frame shows the stacks; the log says "Wind-up answered: staggered" or "Wind-up landed: empowered".
- Neither, too (combat v2.1, engine): a wind-up that is not heavy and costs the player and the pet no HP (a miss, a full WARD), a hit that goes to the pet by its own aggro draw and misses, one skipped by Chrono Sigil, and one whose turn a template summon takes. A wind-up whose hit ends the fight (the player dies, no resurrect) gives no stack: the fight is over.

**Deathblow (M2b v13, D105-D107).** The wind-up of an elite, rare or dungeon boss on SIGNATURE_TURN is its **Deathblow** (flag `deathblow` on the entry and the intent, set when it enters the track). A dungeon boss's wind-up on SIGNATURE_TURN_2, summons, Signal reinforcements, the Dimming Shards and the end boss have none.
- If it deals damage (hit, rend, cleave), its pct is × DEATHBLOW_MULT on top of the script multiplier of its flag (a heavy or cast Deathblow is × HEAVY_SCRIPT_MULT × DEATHBLOW_MULT of the ability's pct); its estimate on the track shows that number. A curse, self_heal or self_shield Deathblow keeps its pct (D60) and is a Deathblow all the same.
- Answered as any wind-up: STAGGERED (STAGGER_DMG), OFF_BALANCE where 7.13 gives it; nothing else.
- Landed as any wind-up, but its EMPOWERED stack is worth DEATHBLOW_EMPOWER (other wind-ups' stacks EMPOWER_DMG; EMPOWERED and STAGGERED values are the sums of their stacks, 7.4), and the player becomes MAIMED for the rest of the fight (7.4, 7.5; value MAIM_HEAL; once per fight). The log says "Deathblow answered: staggered" or "Deathblow landed: empowered, you are maimed".

**First meeting (M2b v13 row 6, D109; gated).** The engine keeps the run's met normal templates (state `met`): when a fight starts, every normal enemy present at its start adds its template, except in grind waves, dungeon trash, Camp waves, Dimmed encounters and the end-boss fight. While the switch GATES.firstMeetWindup (FIRST_MEET_WINDUP) is on, in a quest fight every normal enemy whose template was not in `met` at the fight's start is a first meeting (`firstMeet`): its scripted entry of turn 2 (SIGNATURE_TURN) is a wind-up (`windup`, `cast`; its pct unchanged), answered and landed as above with STAGGER_DMG and EMPOWER_DMG; never a Deathblow, never MAIMED. (M2b v13) The switch is on (M2b v14, D113: the sim's decision rules of the v13 measure); it stays for sim arms. (M2b v14)

| Action | Archetype | Effect | Flags | CD |
|---|---|---|---|---|
| Signal | skulker | at the end of the round SIGNAL_ADDS normal enemy joins: template drawn (1 draw) from the encounter's add pool (zone `addPool`, else the zone's normals; Camp: the Camp pool), at the skulker's level, no XP, coin or loot; at most once per fight; script only | cast | once |
| Bolster | mender | the lowest-HP ally (self included) gains an enemy shield of BOLSTER_PCT × its max HP (absorbed first; a larger shield stays); script only | - | BOLSTER_CD |
| Bloodlust | beast | passive: +BLOODLUST_STEP damage per turn the beast has acted, at most BLOODLUST_MAX (7.2 step 2) | - | - |
| Shield Ally (changed) | guardian | the target is the guardian's ward: the living ally with the lowest index that is not a guardian, fixed when the guardian enters the fight; the ward takes -50 % for 2 rounds; not played without a living ward | - | 4 |

### 7.13 Off-balance (combat v2)
An enemy becomes OFF_BALANCE when (1) its now-entry with `cast` is interrupted (7.7); (2) it is STUN, FROZEN, HEXED, SAPPED or trapped on a turn whose now-entry has `cast` or `heavy` (the big move is cancelled); (3) it completes a `heavy` action from which the player lost 0 HP: every hit missed, was dodged or absorbed (WARD, IMMUNE, Mirrorshade image, Death's Sidestep) or went to the pet because of TAUNT or feign (a hit the pet takes by its own aggro draw does not count). End boss: (1) an interrupted Collapse Litany, (3) a Gravity Crush that costs the player 0 HP. Dimming Shards: as normal enemies. (combat v2)

| Field | Value |
|---|---|
| Damage taken from the player and pet | +OFFBAL_TAKEN (end boss +OFFBAL_BOSS_TAKEN), in the 7.2 step 6 sum (DOT ticks snapshot it at application) |
| Player crit chance against it | +OFFBAL_CRIT |
| Its dodge | 0 |
| Duration | status duration OFFBAL_DURATION, applied at the event: gained by the player's action, the pet hits in that round and the player gets the next round's action; gained during enemy actions, the player gets exactly the next action. Gained at the start of a round (control that was already on cancels the new turn's entry): OFFBAL_DURATION - 1, again exactly the player's next action |
| Stacking | refresh, no stacks |
| FROZEN | a FROZEN enemy counts as OFF_BALANCE (OFFBAL_TAKEN, OFFBAL_CRIT, not its dodge) while FROZEN; never both |

### 7.14 Encounter composition (combat v2)
An encounter of 2 or more enemies holds at least 2 different archetypes; one of 3 or more holds a caster, mender, skulker or beast; a guardian never appears alone with menders only. The engine applies this when a node is set up (stream `node`, rules 1.4 step 4) to quest encounters, grind waves, an elite with its add, dungeon trash fights, and Camp waves (stream `node(7,w,0)`): when the drawn encounter breaks a rule, its last enemy is redrawn (1 draw) among the templates of its pool that make it valid (quest: the quest's enemy list; grind and elite add: the zone's normals; dungeon: the trash list; Camp: the Camp pool), and if none would, among the zone's normals (quests only); if none would, it stays as drawn. A valid encounter costs no draw. Content keeps the pools varied enough that the repair stays within them (12.2). The map shows one archetype per enemy for every fight node (quests, grind, elite and add, treasure guard, each dungeon fight and the dungeon boss), so a pull can be planned from the map. (combat v2)

---

## 8. Items

### 8.1 Slots
| Slot | slotW | Armor slot |
|---|---|---|
| Head | 1.00 | yes |
| Chest | 1.00 | yes |
| Legs | 1.00 | yes |
| Hands | 0.75 | yes |
| Feet | 0.75 | yes |
| Neck | 0.56 | no |
| Ring | 0.56 | no |
| Trinket | 0.56 | no |
| Weapon | 1.00 | no (has WD) |
| Off-hand | 0.56 | no |

No armor types and no durability: any class can equip any item; drops lean to the current class (DROP_CLASS_BIAS).

### 8.2 Rarity
| Rarity | Stat mult (rarityMult) | ilvl bonus | Stats | Affix | Sell mult |
|---|---|---|---|---|---|
| Junk (grey) | - | - | none | - | JUNK_V × V(L) |
| Common | 0.60 | 0 | 1 | no | 0.5 |
| Uncommon | 1.00 | 0 | 2 | no | 1.0 |
| Rare | 1.30 | 1 | 2 | 1 | 2.5 |
| Epic | 1.65 | 3 | 3 | 1 | 6.0 |

### 8.3 Item level and budget
- `ilvl = source content level + RARITY_ILVL_BONUS`, max ILVL_MAX.
- Budget `B = round(ilvl × BUDGET_PER_ILVL × slotW × rarityMult)`.
- Affix share (rare, epic): `A = round(AFFIX_SHARE × B)`; stats get `B - A`.
- Stat split of `B - A`: 1 stat: primary or STA (50/50) all points; 2 stats: primary SPLIT2_MAIN, second (STA or SPI, 70/30) the rest; 3 stats: primary SPLIT3_MAIN, STA SPLIT3_SECOND, SPI the rest. Draws: split (1-2 stat items), primary, affix (rare, epic); an item rolled on a drop table makes all three draws (8.4, heat).
- Primary on generated items: current class's primary at DROP_CLASS_BIAS, else the other primary (AGI or INT). (D144, draft; blind tester pilot 2026-11-13: zone 1 quest rewards offered Agility rings to a Mage and Intellect items to a Rogue.) A reward choice (an item rolled on a table of REWARD_DROP_TABLES: Quest reward, Story reward, contract and bounty, 8.4) takes the class's primary at REWARD_CLASS_BIAS (1: always) while the switch GATES.rewardPrimary is on (the default; off: DROP_CLASS_BIAS as before). The primary draw is made either way, so no later draw moves; only the reward items' stats (and so their names) change.
- Affix (uniform): Crit `+AFFIX_CRIT_PCT × slotW × (epic ? AFFIX_EPIC_MULT : 1)`; Power `+AFFIX_POWER_PER_PT × A`; Armor `+AFFIX_ARMOR_PER_PT × A`.
- Weapon damage `WD = round((WEAPON_DMG_BASE + WEAPON_DMG_PER_ILVL × ilvl) × rarityMult)`. Item armor (armor slots) `= round(ARMOR_PER_ILVL × ilvl × slotW × rarityMult)`.
- Item score (UI upgrade arrow, bots): `Σ stat × ITEM_SCORE.weight` with weights primary 1.0, STA 0.6, SPI 0.3, Power 1.1, crit (per 0.01) 1.5, armor 0.02, WD 2.0 (Mage: WD 0); the wrong primary scores 0.

### 8.4 Drops per kill and per source (stream `loot`)
| Source | Item chance | Junk chance | Rarity weights C / U / R / E |
|---|---|---|---|
| Normal mob kill | MOB_ITEM_CHANCE | MOB_JUNK_CHANCE | 60 / 35 / 5 / 0 |
| Dungeon trash kill | DUNGEON_ITEM_CHANCE | MOB_JUNK_CHANCE | 30 / 50 / 18 / 2 |
| Elite (guaranteed 1) | 1 | 1 | 0 / 40 / 55 / 5 |
| Rare elite (guaranteed 1) | 1 | 1 | 0 / 0 / 75 / 25 |
| Dungeon boss (DUNGEON_BOSS_DROPS rolls) | 1 each | 0 | 0 / 0 / 85 / 15 |
| Quest reward (each choice) | 1 | 0 | 0 / 80 / 20 / 0 |
| Story reward (each choice) | 1 | 0 | 0 / 0 / 100 / 0 |
| Treasure | 1 | 0 | 0 / 70 / 27 / 3 |
| Vendor stock | 1 | 0 | 0 / 60 / 40 / 0 |

Expedition run (1.9.8, M2b v11): a normal or dungeon-trash kill's item and junk chance are × EXPED_DROP_MULT (M2b v12, D100: 1.9, was 1.6; × GRIND_DROP_MULT as well on a Grind node or a Camp wave), each capped at 1; the draws are the same, so the stream moves only where a draw now succeeds. A dungeon clear rolls EXPED_DUNGEON_BOSS_DROPS times on "Dungeon boss" (Relics of the Deep's unique draw per roll). Elites, rares, treasure and rewards are unchanged; Dimmed encounters drop nothing (1.9.6).

Drop order per kill: item chance draw, junk chance draw, rarity draw, heat step draw, slot draw (uniform over 10 slots), stat draws in 8.3 order. Elites additionally drop an Ember of Return at EMBER_ELITE_DROP_CHANCE. Unique items from meta unlocks (11.3) replace a generated item of matching rarity at UNIQUE_DROP_CHANCE.

Heat step (heat, 1.7.3): whenever an item is rolled on a drop table (every source above but vendor stock), one draw follows the rarity draw; below HEAT_RARITY_UP of the state the current node was entered in, the rarity is one step higher (common -> uncommon -> rare -> epic; epic stays). Outside such a node (Camp waves) the chance is 0. The rarity weights above are those of a Clear or Warm node.

The loot stream does not depend on heat (heat): an item rolled on a drop table always makes the same draws whatever its rarity: its three stat draws of 8.3 (split, primary, affix) are all made and each is used only when the rarity needs it, and the unique draw is made whenever the profile makes the source a unique source (Cache of the Wanderer: elite, rare and treasure drops; Relics of the Deep: dungeon boss drops), whatever the rarity; it replaces the item only when an eligible unique of the final rarity exists (11.3). A rarity step therefore changes only that item's rarity and stats, never a later draw. Vendor stock (2.6) keeps the draws of 8.3.

### 8.5 Gold
| Source | Copper |
|---|---|
| Value scale | `V(L) = round(VALUE_BASE + VALUE_COEF × L^VALUE_EXP)` (V1 = 13, V30 = 503, V60 = 1404) |
| Mob kill | MOB_COIN_V × V(M) (elite × ELITE_GOLD_V, dungeon boss × DUNGEON_GOLD_V on clear) |
| Junk sell | JUNK_V × V(level) |
| Item sell | `V(ilvl) × slotW × sell mult` |
| Item buy | `BUY_MULT × sell value` |

### 8.6 Consumables
| id | Name | Use | Effect | Price | Stack |
|---|---|---|---|---|---|
| healing_draught | Healing Draught | combat or out | heal HEAL_DRAUGHT_PCT max HP; POTION_CD | PRICE_HEAL_V × V | STACK_POTION |
| mana_draught | Mana Draught | combat or out | restore MANA_DRAUGHT_PCT max mana; POTION_CD | PRICE_MANA_V × V | STACK_POTION |
| trail_rations | Trail Rations | out of combat | restore RATION_PCT max HP, mana and pet HP | PRICE_RATION_V × V | STACK_FOOD |
| purifying_tonic | Purifying Tonic | combat | dispersal | PRICE_TONIC_V × V | STACK_POTION |
| spark_flask | Spark Flask | combat | magic to all enemies SPARK_BASE + SPARK_PER_LEVEL × L | PRICE_SPARK_V × V | STACK_POTION |
| elixir_ferocity | Elixir of Ferocity | out of combat | +ELIXIR_DMG_PCT damage for ELIXIR_NODES nodes | PRICE_ELIXIR_V × V | STACK_ELIXIR |
| ember_of_return | Ember of Return | passive | resurrect charge (section 9); max EMBER_MAX_CARRIED | EMBER_V × V | 1 |
| greater_healing_draught | Greater Healing Draught (meta) | combat or out | heal GREATER_HEAL_PCT; POTION_CD | PRICE_GHEAL_V × V | STACK_POTION |

V for prices = V(content level of the vendor).

### 8.7 Bags
BAG_SLOTS slots (+meta). One equipment item per slot; consumables stack per table; junk stacks to STACK_JUNK. Equipped items do not use bag slots. When a drop does not fit, the loot window asks to discard; autoplay/bots discard the lowest sell-value non-consumable (junk first).

---

## 9. Death and resurrection
- Death: player HP <= 0 (pet death never ends a fight).
- Resurrect charges, used in this order: Boon of Return, Second Breath (meta, RES_META_CHARGES per run; not usable in the end-boss fight, where the next charge in the order is used instead), Ember of Return. (M2 v3) One charge is consumed automatically at death: the player returns at once at RES_HP_PCT HP and RES_MANA_PCT mana, debuffs removed, in the same fight and round; enemies keep their state.
- No charge left: the run ends. Death location is recorded: zone, row, lane, node type, fight index, enemy ids, round, killing ability.
- The run also ends on boss victory.

Run summary (SUMMARY phase): class, pet, talents (per tree), seed, outcome (victory/death), death location, level and XP, zone/row reached, tolls (`time`), Ascendancy, estimated minutes (manual and autoplay profiles), nodes by type, fights, rounds, kills (normal/elite/rare/boss), quests and story rewards, dungeons cleared, gold earned and spent, potions used, resurrects used, damage dealt/taken, top 3 spells by damage, equipped items with ilvl and rarity, boss phase reached and boss HP % left, Echoes earned with the line-by-line breakdown (11.1), and the heat block (1.7.4).

---

## 10. End boss: Oruvath, the Unlit Star

### 10.1 Setup
Fought once at the end of the Camp in the Sunken Observatory. Level BOSS_LEVEL. HP `BOSS_HP × (1 + asc)`, armor BOSS_ARMOR, crit ENEMY_CRIT. Every damage the boss fight's enemies deal (Oruvath's attacks, the Shards' hits, the Brand's ticks; 10.2) is × BOSS_DMG_MULT × (1 + asc), at the same step as (1 + asc) today (7.2 step 2 and the Brand tick); Shard HP stays `SHARD_HP × (1 + asc)`. (M2b v6) BOSS_HP 13066 -> 12282 and BOSS_DMG_MULT 1.17 -> 1.30 (the sim's ladder may set 1.32 or 1.34, never more; D74): Umbral Strike at Ascendancy 0 is 260 × 1.30 = 338 before the level modifier and armor (was 304). (M2b v8) Immune to STUN, FROZEN, HEXED (they interrupt casts instead). No flee. The boss always targets the player except when a pet has TAUNT, feign is active, or a single-target attack rolls pet aggro.

### 10.2 Phases and mechanics
| Phase | HP band | Mechanics | What it tests |
|---|---|---|---|
| 1 | 100 % - P2_AT | Umbral Strike every round it is not channelling: BOSS_MELEE phys. Gravity Crush every BOSS_CRUSH_EVERY rounds: BOSS_CRUSH phys, heavy (telegraphed, not interruptible). Collapse Litany: 2-round channel starting round LITANY_FIRST, then every LITANY_EVERY rounds; on completion BOSS_LITANY_DMG magic to player and pet. Brand of the Hollow: at end of every BRAND_EVERY-th round, +1 BRAND stack. | interrupt on bar; defensive timing |
| 2 | P2_AT - P3_AT | On entry and every SHARD_EVERY rounds: summon SHARD_COUNT Dimming Shards (HP SHARD_HP, phys hit SHARD_DMG, max SHARD_MAX alive, level 60, can be stunned/hexed). Linked: the boss takes -LINK_DR_PER_SHARD damage per living Shard, at most -LINK_DR (2 Shards -30 %, 4 Shards -60 %), so every Shard killed speeds up the boss kill. Shards take +SHARD_AOE_TAKEN damage from the player's AoE spells (aoe tag: Whirling Edges, Rime Burst, Cinder Storm, Volley Rain, Deadfall Trap, Ricochet Bolt). Litany, Crush and Brand continue. | AoE, control, target choice | (M2 v2)
| 3 | < P3_AT | Shards despawn. Eclipse: boss damage +ECLIPSE_STEP per round in phase 3 (additive). Starless Pulse every PULSE_EVERY rounds: PULSE_DMG magic to player and pet (not interruptible). Litany and Brand continue. | burst, potions, sustain, cleanse |
| Enrage | round >= BOSS_ENRAGE_ROUND | Final Dark each round: FINAL_DARK_DMG magic; ignores WARD and IMMUNE. | overall damage check |

All boss and Shard damage × BOSS_DMG_MULT × (1 + asc) (M2b v6: was × (1 + asc)). Phase changes happen at once when HP crosses the threshold (no skipping: damage that crosses two thresholds triggers both in order).

### 10.3 Intent display
The channel shows "Collapse Litany 1/2" then "2/2 - resolves". Gravity Crush shows its round one round ahead ("next round"). Brand stack timing is shown as a counter.

---

## 11. Meta progression

### 11.1 Echoes (meta currency) per run
| Line | Echoes |
|---|---|
| Per level gained (L - 1) | round(ECHO_PER_LEVEL × (L - 1)) (level 60: 59 Echoes) | (M2 v3; M2b v9: ECHO_PER_LEVEL 1.5 -> 1.0)
| Per zone left by TRAVEL_ON | round(ECHO_PER_ZONE × zones left) | (M2 v3)
| Per dungeon cleared | ECHO_PER_DUNGEON |
| Per elite / rare killed | ECHO_PER_ELITE / ECHO_PER_RARE |
| Per quest completed | ECHO_PER_QUEST |
| Fights won in heat: per fight won in a node entered Hot or Scorched (1.7.3) | ECHO_PER_HEAT_FIGHT | (heat)
| Reached the boss | ECHO_BOSS_REACHED |
| Per boss phase reached after phase 1 | ECHO_BOSS_PHASE |
| Boss killed | ECHO_BOSS_KILL |
| Kill with time <= BOSS_TIME_PAR (tolls) | ECHO_SPEED_BONUS |
| First kill with this class (once per profile per class) | ECHO_FIRST_KILL_CLASS |
| Oath multiplier | × (1 + OATH_ECHO_BONUS × oaths taken) on the total |

All lines scale with progress [stated: scaled by progress]. Each line is rounded (half away from zero) before the total. Typical (M2 v3): planner run about 235, a win about 430. (M2 v3)

### 11.2 Catalogue
Bought between runs on the profile screen. Ranked entries: cost listed per rank. "Req" = prerequisite.

| id | Name | Kind | Ranks | Cost per rank | Effect | Req |
|---|---|---|---|---|---|---|
| vigor | Vigor of the Line | stat | 4 | 80/120/170/230 | max HP +0.005 /rank | - | (M2 v4: 5 ranks -> 4; M2b v6: 0.01 -> 0.005)
| edge | Edge of the Line | stat | 4 | 80/120/170/230 | Power +0.005 /rank | - | (M2 v4: 5 ranks -> 4; M2b v6: 0.01 -> 0.005)
| keen | Keen Lineage | stat | 2 | 150/250 | crit +0.0075 /rank | - | (M2 v4: 0.01 -> 0.0075)
| quick_study | Quick Study | stat | 3 | 100/180/280 | XP +0.0375 /rank | - | (M2 v4: 0.05 -> 0.0375)
| prospector | Prospector | stat | 3 | 60/110/170 | gold +0.06 /rank | - | (M2 v4: 0.08 -> 0.06)
| satchel | Packed Satchel | start kit | 1 | 60 | start with 3 Healing Draughts; the first potion each fight costs no turn and works at half strength (7.5) | - | (M2b v6: free potion; M2b v8: half strength)
| heirloom_blade | Heirloom Blade | start kit | 1 | 80 | starting weapon is uncommon ilvl 3 | - |
| pockets | Deeper Pockets | start kit | 2 | 50/100 | +4 bag slots /rank | - |
| ledger | Trainer's Ledger | economy | 1 | 120 | first LEARN or TRAIN at each hub is free | - |
| scout | Scout's Eye | map | 1 | 100 | rare elites, treasure traps and vendor Embers visible on the map; expedition run with the start camp: Pathfinder, node types (only) within PATHFINDER_RADIUS hops (1.9.5) | - | (M2b v11: expedition effect, expedition.md 8.2)
| swift_boots | Swift Boots | map | 1 | 200 | TRAVEL_ON legal at exit level - 1; expedition run with the start camp: +1 Homeward Bell charge (1.9.7, at most BELL_MAX_CHARGES) | - | (M2 v4: no requirement; was wayfinder; M2b v11: expedition effect)
| cartographer | Cartographer | map | 1 | 100 | expedition only: Region Charts every run with the start camp (owned, not bought) | - | (M2b v11, expedition.md 8.2: META_COST_CARTOGRAPHER)
| old_hand | Old Hand | map | 1 | 150 | expedition only: Tracker's Notes every run with the start camp | - | (M2b v11: META_COST_OLD_HAND)
| quartermaster | Quartermaster | start kit | 2 | 120/200 | expedition only: +PREP_POINTS_PER_QM preparation points per rank at the start camp | - | (M2b v11: META_COST_QM_1 / META_COST_QM_2)
| alchemist | Alchemist's Notes | items | 1 | 150 | Greater Healing Draught (heals GREATER_HEAL_PCT 0.375) in all vendors | satchel | (M2 v4: heal 0.50 -> 0.375)
| cache | Cache of the Wanderer | items | 1 | 200 | 6 unique rares (one per zone band) in elite and treasure pools | - | (M2 v3: cost)
| relics | Relics of the Deep | items | 1 | 400 | 6 unique epics (one per dungeon) in dungeon boss pools | cache | (M2 v3: cost)
| sp_r1 / sp_m1 / sp_h1 | Lost Technique I (per class) | skill | 1 | 150 | Ghostblade Rush / Chrono Sigil / Ricochet Bolt learnable | - |
| sp_r2 / sp_m2 / sp_h2 | Lost Technique II (per class) | skill | 1 | 300 | Bloodprice Gambit / Mirrorshade / Beastcall Horn learnable | same-class I | (M2 v3: cost)
| stormhawk | Stormhawk Companion | skill | 1 | 250 | Stormhawk pet selectable | - | (M2 v3: cost)
| talent_pt | Ancestral Insight | stat | 1 | 500 | +1 talent point at level 60 | - | (M2 v3)
| second_breath | Second Breath | resurrect | 1 | 500 | 1 resurrect charge per run, not usable in the end-boss fight | reached the boss once | (M2 v3)
| oaths | Oaths | challenge | 1 | 0 | unlocks Oaths at creation (11.5) | first boss kill |

Catalogue total: 7 130 Echoes (M2b v11: the expedition entries Cartographer, Old Hand and Quartermaster add 570; M2 v5: 6 560; M2 v4: 7 010, M2 v3: 7 690, before: 6 730). Entries marked "expedition only" (data: `mapMode: 'expedition'`) do nothing on the rows map; the Hall of Echoes labels them. (M2b v11)

Removed (M2 v4): Wayfinder (80 Echoes, TRAVEL_ON cost 0 hours). Its 12 hours per run (6 travels × 2 h) lowered the full-catalogue planner's boss Ascendancy by about one step (0.04: boss HP and damage) and was worth about 12 pp of PALL win rate in the M2 v4 package (about 6 pp per hour of travel cost, two paired steps), about as much as Vigor, Edge and Keen together (11.5 pp). A saved profile that owns it keeps the Echoes spent and gets no effect (as D32). (M2 v4)

Removed (M2 v5): Starforged Arms (450 Echoes; required Relics of the Deep and a first boss kill): each class's unique epic weapon (ilvl 62) sold at the Camp vendor for the normal gear price (35 400 copper). Its price made it a hunter item: on the 11-10b full catalogue the hunter, whose dungeon clears give it about 40 % more gold, bought it in 72 % of runs, the rogue in 18 %, the mage in 9 %, and a hunter holding it won 91 % of its boss fights against 50 % without. It was the cause of the class spread at full catalogue (hunter 77.6 % against 63 %), and Prospector mattered to the hunter mostly because it tipped this purchase. A saved profile that owns it keeps the Echoes spent and gets no effect, as Wayfinder (D42). The three class weapons stay in the content tables (12.1) for a later reward that does not depend on run gold. (M2 v5)

**Meta power budget (M2 v3, revised M2 v4 and M2b v6).** The full catalogue may add at most: one free potion action per fight (Packed Satchel, 7.5; M2b v6) at FREE_POTION_MULT strength (M2b v8), max HP +0.02, Power +0.02 (M2b v6: were +0.04 each; Vigor and Edge pay for the free potion), crit +0.015, potion healing +0.025 of max HP per healing potion (Alchemist's Notes: Greater Healing Draught 0.375 against the Healing Draught's 0.35), +1 talent point, the unique items (normal rarity budget plus one 11.3 effect), and no resurrect in the end-boss fight. (M2 v4; M2 v5: the Starforged weapon is no longer in the catalogue)

Time is budgeted too (M2 v4): tolls saved before the boss lower boss Ascendancy (1.7), which is boss HP and damage, so the time entries together (Quick Study, Swift Boots) may save at most META_TIME_BUDGET on the planner's median route (measured: planner median tolls at the boss on PALL against P0, balance.md B17). (M2 v4)

Every other entry gives economy (gold, training), information (map), bag space, starting consumables, or a new choice (spells and pet that are side-grades, not strict upgrades). A new entry that adds combat power or saves time must take it from this budget. Measured check: balance.md B2, B3, B6, B10. (M2 v3)

Known gap (M2 v4): economy is not free either. Quick Study, Prospector and Trainer's Ledger together are worth about 9.6 pp of PALL planner win rate in the M2 v4 package (Prospector alone 4.3 pp; at half value it still gives 3.7 pp, so the effect is not linear in gold) [source: designer scratch sim/out/v4/Fab]. It is inside the measured B10 cap; if the catalogue grows in M3, give economy a budget line first. (M2 v4) With Starforged Arms removed, Prospector is worth 3.7 / 3.7 / 1.3 pp of PALL planner win rate to the rogue / mage / hunter (was 1.1 / 2.7 / 8.3 pp): gold now buys consumables and ordinary vendor gear, which no class converts much better than another [source: docs/specs/changes-m2-v5.md row 3]. (M2 v5)

### 11.3 Unique items (Content fills names)
Unique items use the normal budget at their rarity and one effect from: on-hit proc (chance UNIQUE_PROC_CHANCE, magic `UNIQUE_PROC_BASE + UNIQUE_PROC_PER_LEVEL × L`); heal UNIQUE_HEAL_ON_KILL of max HP on kill; +UNIQUE_ELITE_DMG damage vs elites and bosses; +UNIQUE_POTION_PCT potion healing; WARD of UNIQUE_WARD_PCT max HP at fight start.

### 11.4 How unlocks enter a run
Applied at character creation: stat ranks as % modifiers, start kit into the bag/slots, map/economy rules as flags, unique items into drop pools from the start of the run, meta spells added to the class's trainer list. Unlocks never change the seed streams except by adding pool entries (so the same seed is not identical across profiles; the run summary records the profile hash).

### 11.5 Oaths (after the first kill)
Each Oath adds +OATH_ECHO_BONUS Echoes: Oath of Haste (BOSS_TIME_PAR - OATH_HASTE_TIME), Oath of Frailty (no resurrect charges), Oath of Thrift (vendor prices × OATH_THRIFT_MULT). They keep late profiles challenged; power from meta stays capped (balance.md B10).

---

## 12. Content ranges (for the Content Designer)

### 12.1 Counts
| Table | Per zone | Total |
|---|---|---|
| Zone (name, 1-line theme, hub name) | 1 | 6 |
| Normal enemy templates | 6-9 | 36-54 |
| Elite templates | 2-3 | 12-18 |
| Rare elite templates | 1-3 | 6-18 | (M2b: one rare per contract family, Bounties)
| Dungeon (name, 3-5 trash templates, 1 boss) | 1 | 6 |
| Quest templates (title, giver, text) | 8-12 | 48-72 |
| Item base names per slot per zone band | >= 3 | >= 180 |
| Stat-flavour words (prefix/suffix) per stat pair | >= 2 | - |
| Unique rares / epics / class weapons | - | 6 / 6 / 3 | (M2 v5: the 3 class weapons stay in content and are not offered while Starforged Arms is removed, 11.2)
| Shrine and treasure flavour lines | 2 each | 12 each |

### 12.2 Enemy templates
| Field | Allowed |
|---|---|
| Archetype | one of 7.6 |
| Level | normal: zone band; elite: band + ELITE_LEVEL_OFFSET; dungeon as 1.4 |
| HP mult on top of archetype | 0.85-1.20 |
| Dmg mult on top of archetype | 0.85-1.20 |
| HP mult × dmg mult | 0.90-1.15 |
| Dungeon-boss HP (M2b v15) | Warden Belk of Harrow's hpMult is 0.90 (row 1, was 1.05); Mawgrim of the Locks' hpMult is 0.95 (row 4, was 1.1; applied by D126) |
| Abilities | normal: archetype only; elite: 1 template; rare: 2; dungeon boss: exactly 2 |
| Text | name <= 28 chars, description <= 140 chars |

### 12.3 Quests
Objective types (flavour only; mechanics are 2.1): slay, gather, rescue, deliver, scout. Title <= 32 chars, text <= 240 chars, turn-in line <= 120 chars. Encounter size weights may be set per quest within 1-3 mobs, average 1.6-2.4.

### 12.4 Ability templates (elites, rares, dungeon bosses)
| id | Effect | Range | CD |
|---|---|---|---|
| heavy_blow | phys, heavy | 160-220 % | 3-4 |
| dark_cast | magic, cast | 180-250 % | 3-5 |
| cleave_all | phys to player and pet | 70-100 % | 3 |
| rend | phys + BLEED 3 rounds | 50-80 % + tick 15-25 % | 3 |
| curse | CURSED 3 rounds, cast | - | 4 |
| self_heal | heal self, cast | 15-20 % max HP | 5 |
| self_shield | absorb | 15-25 % max HP | 5 |
| enrage | below 30 % HP: damage + | 30-50 % | once |
| summon | at 50 % HP: summon normal mobs of zone | 1-2 mobs | once |

Deathblow types (M2b v14, D112): every zone's elite pool (`elites`) keeps at least one elite whose Deathblow (its template ability with the highest pct, 7.12) is heavy (heavy_blow) and at least one whose Deathblow is not (a cast), because the map shows a hidden elite's Deathblow type (1.9.5) and it must not tell a rare (D50). The strict content validator fails a zone without both. (M2b v14)

### 12.5 Items
Names <= 30 chars; flavour text <= 100 chars; no stats set by hand except unique effects within 11.3.

---

## 13. Constant table

Data tables (`CLASS`, `SPELL`, `PET`, `TALENT`, `ARCHETYPE`, `SLOT`, `RARITY`, `DROP_TABLE`, `ITEM_SCORE`, `CONSUMABLE`, `BOON`, `META`, `ABILITY_TEMPLATE`, `CONTENT_RANGE`, `REGION_W`) are defined in sections 1.9.2, 2.9, 5, 6, 7.6, 8, 11 and 12; each cell is a constant named `TABLE.id.field`.

| Constant | Value | Unit |
|---|---|---|
| MAX_LEVEL | 60 | level |
| ZONE_COUNT | 6 | zones |
| ZONE_LEVELS | 10 | levels per zone |
| ZONE_CHOICE_ROWS | 7 | rows | (M2 v2)
| LANES | 3 | lanes |
| DUNGEON_ROW_MIN | 4 | row |
| DUNGEON_ROW_MAX | 6 | row |
| REST_ROW_MIN | 3 | row |
| REST_ROW_MAX | 5 | row |
| TRAINER_ROW_MIN | 3 | row | (M2 v2)
| TRAINER_ROW_MAX | 5 | row | (M2 v2)
| MAX_SAME_TYPE_PER_ROW | 2 | nodes |
| W_QUEST | 38 | weight |
| W_GRIND | 14 | weight |
| W_ELITE | 14 | weight |
| W_REST | 12 | weight |
| W_VENDOR | 6 | weight |
| W_TRAINER | 4 | weight |
| W_TREASURE | 6 | weight |
| W_SHRINE | 6 | weight |
| QUEST_LEVEL_OFFSETS | [-1, 0, 0, 1] | levels |
| ELITE_LEVEL_OFFSET | 1 | levels | (M2 v2)
| DUNGEON_LEVEL_OFFSET | 4 | levels above band minimum | (M2 v2)
| DUNGEON_BOSS_LEVEL_OFFSET | 2 | levels above trash |
| RARE_CHANCE | 0.20 | probability |
| CAMP_GRIND_LEVEL | 58 | level |
| TIME_QUEST | 2 | tolls |
| TIME_GRIND_WAVE | 1 | tolls |
| TIME_ELITE | 2 | tolls |
| TIME_DUNGEON | 5 | tolls |
| TIME_REST | 4 | tolls |
| TIME_VENDOR | 1 | tolls |
| TIME_TRAINER | 1 | tolls |
| TIME_TREASURE | 1 | tolls |
| TIME_SHRINE | 1 | tolls |
| TIME_TRAVEL | 2 | tolls |
| TRAVEL_EARLY_LEVELS | 1 | levels below exit level | (M2 v2)
| BOSS_TIME_PAR | 120 | tolls | (M2 v2)
| ASC_STEP_TIME | 10 | tolls |
| ASC_PER_STEP | 0.02 | fraction | (M2b v6: was 0.04)
| ASC_CAP | 0.40 | fraction |
| META_TIME_BUDGET | 5 | tolls saved by the full catalogue's time entries, planner median (half of ASC_STEP_TIME) | (M2 v4)
| QUEST_SIZE_W1 | 25 | weight |
| QUEST_SIZE_W2 | 50 | weight |
| QUEST_SIZE_W3 | 25 | weight |
| QUEST_MAX_SIZE_Z1 | 2 | mobs | (M2 v2)
| QUEST_CAP_Z2_RINGS | 1 | rings of zone 2 (from ring 1) whose quests keep the zone 1 cap; expedition map, switch GATES.zone2InnerCap (on); 0 = none (1.9.3, 2.1) | (D146)
| QUEST_TURNIN_XP_FRAC | 1.15 | of xpToNext | (M2 v2)
| QUEST_GOLD_V | 2 | × V |
| QUEST_REWARD_CHOICES | 2 | items |
| STORY_QUESTS | 3 | quests |
| STORY_XP_FRAC | 0.90 | of xpToNext | (M2 v2)
| STORY_REWARD_CHOICES | 3 | items |
| GRIND_MAX_WAVES | 3 | waves |
| GRIND_WAVE_SIZE | 2 | mobs |
| GRIND_WAVE_XP_FRAC | 0.115 | of xpToNext | (M2 v2)
| GRIND_DROP_MULT | 1.5 | × |
| ELITE_ADD_CHANCE | 0.30 | probability |
| ELITE_GOLD_V | 2 | × V |
| DUNGEON_TRASH_FIGHTS | 3 | fights |
| DUNGEON_SIZE_W2 | 50 | weight |
| DUNGEON_SIZE_W3 | 50 | weight |
| DUNGEON_CLEAR_XP_FRAC | 0.70 | of xpToNext | (M2 v2)
| DUNGEON_GOLD_V | 6 | × V |
| DUNGEON_BOSS_DROPS | 2 | rolls |
| TREASURE_GUARD_CHANCE | 0.50 | probability |
| TREASURE_GOLD_V | 3 | × V |
| TREASURE_TRAP_CHANCE | 0.10 | probability |
| TREASURE_TRAP_PCT | 0.15 | of max HP |
| BOON_W_RETURN | 10 | weight |
| BOON_W_INSIGHT | 20 | weight |
| BOON_W_FURY | 20 | weight |
| BOON_W_PLENTY | 20 | weight |
| BOON_W_MENDING | 20 | weight |
| BOON_W_CLARITY | 10 | weight |
| BOON_XP_PCT | 0.20 | fraction |
| BOON_DMG_PCT | 0.15 | fraction |
| BOON_NODES | 3 | nodes |
| BOON_GOLD_V | 4 | × V |
| MOB_XP_FRAC | 0.285 | of xpToNext | (M2 v2)
| DUNGEON_MOB_XP_MULT | 1.0 | × |
| ELITE_XP_MULT | 6 | × |
| RARE_XP_MULT | 8 | × |
| DUNGEON_BOSS_XP_MULT | 8 | × |
| XP_A | 20 | XP |
| XP_B | 180 | XP |
| XP_C | 200 | XP |
| XP_DIFF_STEP | 0.05 | per level |
| XP_DIFF_MAX | 1.25 | × |
| XP_DIFF_SOFT_FLOOR | -2 | levels |
| XP_DIFF_FALL | 0.20 | per level |
| XP_GREY_DIFF | -6 | levels |
| XP_GREY_MOD | 0.10 | × |
| REST_RESTED_FRAC | 0.60 | of xpToNext |
| RESTED_CAP_FRAC | 1.50 | of xpToNext |
| RESTED_MULT | 2 | × |
| TALENT_FIRST_LEVEL | 10 | level |
| TALENT_LEVEL_STEP | 2 | levels |
| TALENT_TIER_GATE | 4 | points |
| START_GOLD | 50 | copper |
| START_RATIONS | 2 | items |
| HP_PER_STA | 10 | HP |
| POWER_PER_PRIMARY | 1 | Power |
| RATING_K | 4 | per level |
| RATING_C | 20 | - |
| CRIT_BASE | 0.05 | fraction |
| CRIT_FROM_PRIMARY | 0.12 | fraction |
| CRIT_CAP | 0.50 | fraction |
| CRIT_MULT | 1.5 | × |
| DODGE_CAP | 0.75 | fraction |
| ARMOR_K | 40 | per attacker level |
| ARMOR_C | 100 | armor |
| ARMOR_MIT_CAP | 0.75 | fraction |
| MANA_BASE | 50 | mana |
| MANA_PER_LEVEL | 12 | mana |
| MANA_PER_INT | 6 | mana |
| MANA_REGEN_ROUND_PCT | 0.025 | of max mana | (M2 v2)
| ENERGY_MAX | 100 | energy |
| ENERGY_REGEN | 25 | per round | (M2 v2)
| FOCUS_MAX | 100 | focus |
| FOCUS_REGEN | 25 | per round |
| CP_MAX | 5 | points |
| POST_FIGHT_REGEN_BASE | 0.10 | fraction |
| POST_FIGHT_REGEN_SPI | 0.12 | fraction |
| REGEN_SPI_K | 2 | per level |
| REGEN_SPI_C | 10 | - |
| SPELL_BAR_SLOTS | 7 | slots |
| ITEM_BAR_SLOTS | 3 | slots |
| PET_DMG_BASE | 2 | damage |
| PET_DMG_PER_LEVEL | 0.65 | damage | (M2 v2)
| PET_DMG_POWER | 0.375 | × P | (M2 v2)
| PET_REVIVE_PCT | 0.25 | of pet max HP |
| MISS_BASE | 0.05 | fraction |
| MISS_PER_LEVEL | 0.02 | per level |
| MISS_CAP | 0.35 | fraction |
| LVL_DMG_STEP | 0.04 | per level |
| LVL_DMG_MIN | 0.70 | × |
| LVL_DMG_MAX | 1.30 | × |
| DMG_VARIANCE | 0.10 | fraction |
| ENEMY_CRIT | 0.05 | fraction |
| ENEMY_DODGE | 0.05 | fraction |
| CHILL_PCT | 0.20 | fraction |
| CURSE_PCT | 0.15 | fraction |
| STEALTH_MISS_BONUS | 0.50 | fraction |
| POTION_CD | 4 | rounds |
| FREE_POTION_MULT | 0.5 | × the normal amount of Packed Satchel's free potion (7.5) | (M2b v8)
| FLEE_BASE | 0.60 | probability |
| FLEE_PER_EXTRA_ENEMY | 0.05 | probability |
| FIGHT_SOFT_ENRAGE_ROUND | 20 | round |
| FIGHT_SOFT_ENRAGE_STEP | 0.25 | per round |
| ENEMY_HP_BASE | 20 | HP |
| ENEMY_HP_PER_LEVEL | 12 | HP |
| ENEMY_DMG_BASE | 4 | damage |
| ENEMY_DMG_PER_LEVEL | 2.6 | damage |
| ZONE_DANGER_FROM | 20 | level | (M2 v3)
| ZONE_DANGER_STEP | 0.45 | × per 10 levels above ZONE_DANGER_FROM | (M2 v3; M2b v8: was 0.25; M2b v9: was 0.375)
| DUNGEON_DANGER_FRAC | 0.5 | share of the zone-danger bonus for dungeon trash and dungeon bosses | (M2 v4)
| EARLY_DMG_MULT | 0.80 | × the damage of every template enemy of level <= EARLY_DMG_MAX_LEVEL (7.6) | (M2b v8)
| EARLY_DMG_MAX_LEVEL | 20 | enemy level | (M2b v8)
| ENEMY_ARMOR_PER_LEVEL | 15 | armor |
| DUNGEON_TRASH_HP_MULT | 1.2 | × |
| DUNGEON_TRASH_DMG_MULT | 1.1 | × |
| ELITE_HP_MULT | 2.8 | × | (M2 v2)
| ELITE_DMG_MULT | 1.5 | × |
| RARE_HP_MULT | 4.5 | × |
| RARE_DMG_MULT | 1.6 | × |
| DUNGEON_BOSS_HP_MULT | 5.6 | × | (M2 v2)
| DUNGEON_BOSS_DMG_MULT | 1.5 | × | (M2 v4: was 1.7)
| AUTO_POTION_HP | 0.35 | fraction |
| AUTO_MANA_POTION | 0.20 | fraction |
| AUTO_TONIC_STACKS | 3 | stacks |
| AUTO_FOOD_HP | 0.50 | fraction |
| BUDGET_PER_ILVL | 0.6 | points |
| ILVL_MAX | 63 | item level |
| MIN_HIT_DAMAGE | 1 | damage |
| RARITY_ILVL_BONUS | common 0, uncommon 0, rare 1, epic 3 | levels |
| AFFIX_SHARE | 0.25 | of budget |
| AFFIX_CRIT_PCT | 0.015 | fraction × slotW |
| AFFIX_EPIC_MULT | 1.4 | × |
| AFFIX_POWER_PER_PT | 1 | Power |
| AFFIX_ARMOR_PER_PT | 10 | armor |
| SPLIT2_MAIN | 0.60 | fraction |
| SPLIT3_MAIN | 0.45 | fraction |
| SPLIT3_SECOND | 0.35 | fraction |
| DROP_CLASS_BIAS | 0.70 | probability |
| REWARD_CLASS_BIAS | 1.0 | probability: a reward choice's primary is the class's (8.3; tables REWARD_DROP_TABLES; switch GATES.rewardPrimary, on) | (D144, draft)
| REWARD_DROP_TABLES | ["quest","story","contract","bounty"] | the "choose one" reward tables of 8.4 (8.3) | (D144, draft)
| WEAPON_DMG_BASE | 4 | damage |
| WEAPON_DMG_PER_ILVL | 1.8 | damage |
| ARMOR_PER_ILVL | 5 | armor |
| MOB_ITEM_CHANCE | 0.15 | probability |
| DUNGEON_ITEM_CHANCE | 0.25 | probability |
| MOB_JUNK_CHANCE | 0.30 | probability |
| EMBER_ELITE_DROP_CHANCE | 0.04 | probability |
| UNIQUE_DROP_CHANCE | 0.15 | probability |
| VALUE_BASE | 10 | copper |
| VALUE_COEF | 3 | copper |
| VALUE_EXP | 1.5 | exponent |
| MOB_COIN_V | 0.5 | × V |
| JUNK_V | 0.6 | × V |
| BUY_MULT | 4 | × sell |
| TRAIN_NEW_V | 2 | × V |
| TRAIN_RANK_V | 0.5 | × V |
| RESPEC_V | 10 | × V |
| VENDOR_CONSUMABLES | 6 | item types |
| VENDOR_GEAR_STOCK | 3 | items |
| EMBER_STOCK_CHANCE | 0.15 | probability |
| EMBER_V | 30 | × V |
| EMBER_MAX_CARRIED | 1 | items |
| HEAL_DRAUGHT_PCT | 0.35 | of max HP |
| MANA_DRAUGHT_PCT | 0.35 | of max mana |
| RATION_PCT | 0.40 | of max |
| GREATER_HEAL_PCT | 0.375 | of max HP | (M2 v4: was 0.50)
| SPARK_BASE | 6 | damage |
| SPARK_PER_LEVEL | 2.2 | damage |
| ELIXIR_DMG_PCT | 0.10 | fraction |
| ELIXIR_NODES | 3 | nodes |
| PRICE_HEAL_V | 1.5 | × V |
| PRICE_MANA_V | 1.5 | × V |
| PRICE_RATION_V | 0.5 | × V |
| PRICE_TONIC_V | 2 | × V |
| PRICE_SPARK_V | 1 | × V |
| PRICE_ELIXIR_V | 3 | × V |
| PRICE_GHEAL_V | 2.5 | × V |
| STACK_POTION | 5 | items |
| STACK_FOOD | 10 | items |
| STACK_ELIXIR | 3 | items |
| STACK_JUNK | 10 | items |
| BAG_SLOTS | 16 | slots |
| RES_HP_PCT | 0.40 | of max HP |
| RES_MANA_PCT | 0.40 | of max mana |
| RES_META_CHARGES | 1 | charges |
| BOSS_LEVEL | 62 | level |
| BOSS_HP | 12282 | HP | (M2 v4: was 13500; M2b v6: 13900 -> 13066, × 0.94; M2b v8: 13066 -> 12282, × 0.94)
| BOSS_DMG_MULT | 1.30 | × every damage of the end-boss fight's enemies (10.1); ladder 1.32, 1.34 by sim result, never above 1.34 (D74) | (M2b v6; M2b v8: was 1.17)
| BOSS_ARMOR | 1200 | armor |
| BOSS_MELEE | 260 | damage | (M2 v2)
| BOSS_CRUSH | 380 | damage |
| BOSS_CRUSH_EVERY | 6 | rounds |
| BOSS_LITANY_DMG | 850 | damage |
| LITANY_FIRST | 3 | round |
| LITANY_EVERY | 5 | rounds |
| BRAND_EVERY | 4 | rounds |
| BRAND_DMG | 35 | damage per stack per round |
| BRAND_MAX | 10 | stacks |
| P2_AT | 0.70 | boss HP fraction |
| P3_AT | 0.40 | boss HP fraction |
| SHARD_HP | 1000 | HP | (M2 v2)
| SHARD_DMG | 110 | damage |
| SHARD_COUNT | 2 | adds |
| SHARD_EVERY | 8 | rounds |
| SHARD_MAX | 4 | adds |
| LINK_DR | 0.60 | fraction |
| LINK_DR_PER_SHARD | 0.15 | fraction per living Shard | (M2 v2)
| SHARD_AOE_TAKEN | 1.00 | fraction (+100 % from aoe spells) | (M2 v2)
| ECLIPSE_STEP | 0.05 | per round |
| PULSE_DMG | 280 | damage |
| PULSE_EVERY | 3 | rounds |
| BOSS_ENRAGE_ROUND | 57 | round | (M2 v4: was 55)
| FINAL_DARK_DMG | 99999 | damage |
| ECHO_PER_LEVEL | 1.0 | Echoes | (M2 v3; M2b v9: was 1.5)
| ECHO_PER_ZONE | 7.5 | Echoes | (M2 v3)
| ECHO_PER_DUNGEON | 8 | Echoes |
| ECHO_PER_ELITE | 3 | Echoes |
| ECHO_PER_RARE | 6 | Echoes |
| ECHO_PER_QUEST | 1 | Echoes |
| ECHO_BOSS_REACHED | 20 | Echoes |
| ECHO_BOSS_PHASE | 12 | Echoes | (M2 v3)
| ECHO_BOSS_KILL | 120 | Echoes |
| ECHO_SPEED_BONUS | 40 | Echoes |
| ECHO_FIRST_KILL_CLASS | 100 | Echoes |
| OATH_ECHO_BONUS | 0.25 | fraction |
| OATH_HASTE_TIME | 20 | tolls |
| OATH_THRIFT_MULT | 1.5 | × |
| UNIQUE_PROC_CHANCE | 0.15 | probability |
| UNIQUE_PROC_BASE | 5 | damage |
| UNIQUE_PROC_PER_LEVEL | 2 | damage |
| UNIQUE_HEAL_ON_KILL | 0.08 | of max HP |
| UNIQUE_ELITE_DMG | 0.08 | fraction |
| UNIQUE_POTION_PCT | 0.25 | fraction |
| UNIQUE_WARD_PCT | 0.08 | of max HP |
| PACE_CREATE_S | 40 | s |
| PACE_DECIDE_S | 5 | s per node |
| PACE_TRAVEL_NODE_S | 3.5 | s per node | (M2 v2)
| PACE_ZONE_TRAVEL_S | 8 | s per zone |
| PACE_QUEST_TEXT_S | 5 | s per quest |
| PACE_FIGHT_OVERHEAD_S | 3 | s per fight |
| PACE_ENGAGE_S | 6 | s per fight with an engage round (manual profile) | (combat v2)
| PACE_MANUAL_ROUND_S | 3.1 | s per round (PACE_ROUND_ANIM_S + PACE_ROUND_DECIDE_S) | (combat v2: was 2.5)
| PACE_ROUND_ANIM_S | 2.1 | s per round (UI budget at default speed) | (combat v2: was 1.5)
| PACE_ROUND_DECIDE_S | 1.0 | s per round | (M2 v2)
| PACE_AUTO_ROUND_S | 1.1 | s per round | (combat v2: was 0.8)
| PACE_LOOT_S | 3 | s per equipment drop |
| PACE_LEVELUP_S | 2 | s per level |
| PACE_TALENT_S | 6 | s per point |
| PACE_REST_S | 5 | s |
| PACE_SHRINE_S | 6 | s |
| PACE_TREASURE_S | 4 | s |
| PACE_VENDOR_S | 20 | s |
| PACE_VENDOR_TX_S | 3 | s per transaction |
| PACE_TRAINER_S | 6 | s |
| PACE_TRAINER_TX_S | 2 | s per spell |
| PACE_BOSS_INTRO_S | 20 | s |
| INTENT_TRACK_LEN | 3 | entries (now + 2) | (combat v2)
| OPENING_TURNS | 3 | enemy turns with a scripted action | (combat v2)
| SIGNATURE_TURN | 2 | enemy turn (elite, rare, dungeon boss) | (combat v2)
| SIGNATURE_TURN_2 | 4 | enemy turn (dungeon boss, second template ability; was 5) | (combat v2.1)
| HEAVY_SCRIPT_MULT | 1.5 | × a heavy damaging action's pct on a scripted turn (tuning lever; was 1.0; damage only, D60) | (combat v2.1)
| CAST_SCRIPT_MULT | 1.5 | × a cast damaging action's pct on a scripted turn (tuning lever; was 1.0; damage only, not Mend or Self Heal, D60) | (combat v2.1)
| MEND_BELOW | 0.70 | fraction of max HP (ARCHETYPE.mender Mend `below`) | (combat v2)
| SIGNAL_ADDS | 1 | enemies | (combat v2)
| BOLSTER_PCT | 0.20 | fraction of the ally's max HP | (combat v2)
| BOLSTER_CD | 4 | turns | (combat v2)
| BLOODLUST_STEP | 0.10 | damage per turn acted | (combat v2)
| BLOODLUST_MAX | 0.50 | damage | (combat v2)
| OFFBAL_TAKEN | 0.50 | damage taken (was 0.30) | (combat v2.1)
| OFFBAL_BOSS_TAKEN | 0 | damage taken (end boss; was 0.15; its crit and dodge effects stay) | (combat v2.1)
| OFFBAL_CRIT | 0.20 | crit chance | (combat v2)
| OFFBAL_DURATION | 2 | status duration (one player action) | (combat v2)
| ENGAGE_DMG_COMP | 1.15 | × enemy damage (all template enemies; end boss excluded; not in the Rogue's fights except dungeon-boss fights, D48, D49) | (combat v2)
| AMBUSH_MULT | 1.5 | × Gutting Jab before Shadowstep Strike is learned | (combat v2)
| SAP_TURNS | 4 | enemy turns | (combat v2; M2b v6: was 3)
| PREMED_CP | 5 | CP (was 3) | (combat v2.1)
| GLYPH_TURNS | 2 | enemy turns | (combat v2)
| GATHER_SPELLS | 3 | spells (was 2) | (combat v2.1)
| GATHER_CRIT | 1.0 | crit chance (was 0.50: gathered spells always crit) | (combat v2.1)
| OPENING_SHOT_MULT | 1.5 | × Keen Shot | (combat v2)
| OPENING_MARK_ROUNDS | 4 | rounds | (combat v2)
| TRAP_STUN | 1 | rounds | (combat v2)
| PET_LEAD_TURNS | 2 | enemy turns | (combat v2)
| PET_LEAD_DR | 0.30 | damage taken by the pet | (combat v2)
| ENGAGE_AUTO_LOOK | 2 | enemy turns (autoplay rule E) | (combat v2)
| EMPOWER_DMG | 0.15 | damage dealt per EMPOWERED stack (a wind-up landed, 7.12) | (combat v2.1)
| STAGGER_DMG | 0.30 | damage dealt less per STAGGERED stack (a wind-up answered, 7.12) | (combat v2.1)
| DEATHBLOW_MULT | 2.0 | × the pct of a damaging Deathblow, on top of the script multiplier (7.12) | (M2b v13, D105)
| DEATHBLOW_EMPOWER | 1.00 | EMPOWERED value of a landed Deathblow's stack (7.4, 7.12) | (M2b v13, D106)
| MAIM_HEAL | 0.50 | share of every heal on the player that MAIMED removes (7.4, 7.5) | (M2b v13, D107)
| RARE_HP_MULT_Z1 | 3.0 | × HP of a zone-1 rare while GATES.rareHpMultZ1 is on (2.3; the switch is on since M2b v14, D113; off: RARE_HP_MULT) | (M2b v13 row 5, D109; M2b v14)
| RING_NODES | [1, 6, 12, 12] | nodes per ring (ring 0 = the hub) | (expedition)
| RING_CL_BASE | [0, 1, 4, 7] | levels above the zone's band minimum, per ring | (expedition)
| RING_CL_SPREAD | 3 | levels (u in 0..RING_CL_SPREAD-1) | (expedition)
| EDGE_KEEP_R1 | 0.80 | probability (ring 1 neighbours linked) | (expedition)
| EDGE_KEEP_R2 | 0.70 | probability (ring 2 neighbours linked) | (expedition)
| EDGE_KEEP_R3 | 0.65 | probability (ring 3 neighbours linked) | (expedition)
| EDGE_DIAG_R23 | 0.35 | probability (a ring 3 node's second ring 2 link) | (expedition)
| REGION_COUNT | 4 | regions (wedges) per zone | (expedition)
| REGION_FAMILY_SHARE | 0.70 | share of a region's template picks from its families | (expedition)
| TIME_WALK | 1 | tolls (a walk or a pass) | (expedition)
| ROAD_COUNT | 3 | Roads on the rim | (expedition)
| VISION_RADIUS | 1 | hops (full vision, fresh profile) | (expedition)
| VISION_RADIUS_MAX | 2 | hops (full vision cap) | (expedition)
| GUIDE_RADIUS_BONUS | 1 | hops (Local Guide) | (expedition)
| PATHFINDER_RADIUS | 2 | hops (Pathfinder, node types only) | (expedition)
| DIM_GRACE | 6 | zone tolls before the front starts | (expedition)
| DIM_FRONT_HOPS | 2 | hops the front advances per DIM_FRONT_TIME (1.9.6) | (M2b v7: with DIM_FRONT_TIME replaces DIM_HOURS_PER_HOP 2.5)
| DIM_FRONT_TIME | 5 | zone tolls per DIM_FRONT_HOPS hops (1.9.6; 2.5 per hop, as expedition.md 9.5) | (M2b v7)
| DIM_PACK_SIZE | 2 | enemies in a Dimmed encounter | (expedition)
| DIM_LEVEL_PER_DEPTH | 2 | levels per hop of depth | (expedition)
| DIM_HP_MULT | 1.2 | × Shardspawn HP | (expedition)
| DIM_DMG_MULT | 1.3 | × Shardspawn damage | (expedition)
| DIM_XP_MULT | 0.25 | × Shardspawn kill XP | (expedition)
| TIME_DIM_FIGHT | 2 | tolls (a Dimmed encounter; not one after a walk farther from the Shardfall) | (expedition; M2b v11: was 1)
| TIME_DIM_ESCAPE | 1 | tolls of a Dimmed encounter after a MOVE that walked farther from the Shardfall (1.9.6) | (M2b v12, D101)
| BELL_START_CHARGES | 1 | Homeward Bell charges per run | (expedition)
| BELL_MAX_CHARGES | 2 | charges | (expedition)
| BELL_CHANNEL_TIME | 2 | tolls (the Bell's channel) | (expedition)
| PACE_BELL_S | 6 | s per Bell (instead of PACE_ZONE_TRAVEL_S) | (expedition)
| ROAD_SWIFT_TOLLS | 15 | zone tolls within which a Road pays the Swift passage (1.9.7; switch GATES.swiftRoad, off since D126) | (M2b v15, D124)
| ROAD_SWIFT_XP_FRAC | 0.75 | × xpToNext(L), the Swift passage XP (1.9.7) | (M2b v15, D124)
| XP_WEIGHT_MULT | 1.4 | × XP of kills, quest turn-ins, grind waves, dungeon clears, contracts (expedition.md 9.5) | (expedition; M2b v10: was 1.6)
| EXPED_GRIND_MAX_WAVES | 1 | waves (expedition.md 9.5) | (expedition)
| EXPED_DUNGEON_TRASH_FIGHTS | 2 | fights (expedition.md 9.5) | (expedition)
| EXPED_TIME_QUEST | 3 | tolls (expedition.md 9.5) | (expedition)
| EXPED_TIME_ELITE | 3 | tolls (expedition.md 9.5) | (expedition)
| EXPED_TIME_GRIND_WAVE | 2 | tolls per wave, Camp waves too (expedition.md 9.5) | (expedition)
| EXPED_TIME_DUNGEON | 5 | tolls (expedition.md 9.5) | (expedition; M2b v10: was 6)
| EXPED_DROP_MULT | 1.9 | × item and junk chance of normal and dungeon-trash kills, expedition runs (1.9.8, 8.4) | (M2b v11; M2b v12, D100: was 1.6)
| EXPED_DUNGEON_BOSS_DROPS | 3 | rolls on "Dungeon boss" at a dungeon clear, expedition runs (1.9.8, 8.4) | (M2b v11)
| BEASTCALL_HORN_CD | 12 | rounds (SPELL.beastcall_horn.cd, 5.6) | (M2b v11 row 8; M2b v12, D100: row 8 void, the gated value 15 removed)
| RICOCHET_BOUNCE_FRAC | 0.3 | × the main hit per bounce (SPELL.ricochet_bolt.bounceFrac, 5.6) | (M2b v12 row 5: was 0.4; the gate passed, balance-2026-11-11h)
| RICOCHET_BOUNCE_FRAC_GATED | 0.3 | × per bounce, the gated value (changes-m2b-v12.md row 5); equal to RICOCHET_BOUNCE_FRAC since the gate passed | (M2b v12 row 5)
| HEAT_WARM_AT | 0 | tolls past the line: Warm (Smouldering) from here (1.7.2) | (heat)
| HEAT_HOT_AT | 10 | tolls past the line: Hot (Burning) from here (= ASC_STEP_TIME) | (heat)
| HEAT_SCORCH_AT | 30 | tolls past the line: Scorched (Infernal) from here | (heat)
| HEAT_DIM_WARM | 4 | tolls until the player's node dims: Warm at or below (1.9.10) | (heat)
| HEAT_DIM_HOT | 2 | tolls until the player's node dims: Hot at or below (1.9.10) | (heat)
| HEAT_GAIN | clear 0, warm 0, hot 0.35, scorched 0.50 | × extra XP and gold of a node, by the state it was entered in (1.7.3) | (heat)
| HEAT_RARITY_UP | clear 0, warm 0, hot 0.50, scorched 0.70 | chance per item rolled in a node of one rarity step, by its entry state (8.4) | (heat; M2b v6: hot 0.25 -> 0.50, scorched 0.40 -> 0.70)
| ECHO_PER_HEAT_FIGHT | 1 | Echoes per fight won in a node entered Hot or Scorched (11.1) [assumption: not prototyped] | (heat)
| HEAT_BAR_MIN | -20 | tolls of heat at the meter's left end (expedition.md H.4) | (heat)
| HEAT_BAR_MAX | 40 | tolls of heat at the meter's right end (expedition.md H.4) | (heat)
