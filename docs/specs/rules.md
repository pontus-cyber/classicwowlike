# Rules spec (M0 task 0.2)

Owner: Lead Game Designer. Status: draft for Lead review, 2026-11-09; M2 v4 changes 2026-11-10 (marked "(M2 v4)").
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
| Time | In-game time in hours (h, integer). Real time is only estimated (section 3); the engine never reads a clock. |
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

Hub (row 0) services; each may be used once per hub visit, in any order, and costs hours:

| Service | Hours | Effect |
|---|---|---|
| Trainer | HOURS_TRAINER | as Trainer node (2.7) |
| Vendor | HOURS_VENDOR | as Vendor node (2.6), content level = zone band minimum |
| Inn | HOURS_REST | as Rest node (2.5) |

### 1.5 Leaving a zone
`TRAVEL_ON` is legal in MAP when `L >= exit level - TRAVEL_EARLY_LEVELS` (meta Swift Boots: one level lower again), or after the last row (then forced). It costs HOURS_TRAVEL and moves to the next zone's hub (Z6 -> Camp). Leaving early skips the remaining rows: this is the speedrun lever. A player who leaves under the exit level, or is under it after the last row, faces higher content in the next zone (more risk, and more XP via the level-difference bonus). (M2 v2)

### 1.6 Camp (before the boss)
Services as a hub (Trainer, Vendor at CL 60 with ilvl 60 stock, Inn) plus repeatable `CAMP_GRIND` waves: one wave = one Grind wave (2.2) at CAMP_GRIND_LEVEL, HOURS_GRIND_WAVE each, no limit. `FIGHT_BOSS` starts the single boss attempt (section 10). Hours keep counting, so every camp wave raises boss Ascendancy (1.7).

### 1.7 In-game time and Ascendancy
Every node and service costs hours (table 2.0). The total `hours` at `FIGHT_BOSS` sets the boss Ascendancy:
`asc = min(ASC_CAP, ASC_PER_STEP × floor(max(0, hours - BOSS_TIME_PAR) / ASC_STEP_HOURS))`.
Boss HP (incl. adds) and all boss damage are multiplied by `(1 + asc)`. Runs at or under BOSS_TIME_PAR also earn ECHO_SPEED_BONUS on a kill.

### 1.8 Where long-term trade-offs come from
| Trade-off | Mechanism |
|---|---|
| XP vs gear | Leaving a zone at exit level saves hours (lower Ascendancy) but skips quest rewards, dungeon loot and gold. |
| Risk vs reward | Elites and dungeons give the best XP per hour and rare/epic loot; they are the main causes of death. |
| Gold vs time | Rations (gold) replace Rest (4 h). Grind waves give gold and drops per hour. Vendors sell rares and the Ember of Return. |
| Spells vs gold | Spells only improve at a trainer (rank = trained level). Skipping trainers saves hours and gold but weakens every spell. |
| Rested XP | Rest gives a rested pool that doubles kill XP; resting before a grind or dungeon is efficient. |
| Resurrects | Ember of Return (30 V gold), Shrine boon, meta Second Breath (journey only, not in the end-boss fight). Spending gold on an Ember competes with gear and potions. | (M2 v3)
| Consumables vs bag | 16 bag slots shared by gear, potions and junk; potion stacks are 5. |
| Bar slots | 7 spell slots for 12+ spells: choosing interrupt, cleanse, AoE or defensive matters at the boss. |
| Talents | 26 points; one capstone per run; the boss tests interrupt, cleanse, AoE, burst and sustain. |
| Story chain | 3 quests in a zone grant the story reward; planning the path through quest nodes pays off. |

---

## 2. Node types

### 2.0 Summary
XP values are fractions of `xpToNext(contentLevel)` before the level-difference modifier (4.4). V = value scale (8.5). Fights listed are for the manual pacing model.

| Type | Hours | Fights | XP (before diff mod) | Gold | Loot | Main risk |
|---|---|---|---|---|---|---|
| Quest | HOURS_QUEST | 1 encounter of 1-3 mobs | kills + QUEST_TURNIN_XP_FRAC | kills + QUEST_GOLD_V × V | choose 1 of QUEST_REWARD_CHOICES (2.1) | low |
| Grind | HOURS_GRIND_WAVE per wave, 1-GRIND_MAX_WAVES waves | 1 per wave, 2 mobs | kills + GRIND_WAVE_XP_FRAC per wave | kills | drops × GRIND_DROP_MULT | low, attrition |
| Elite | HOURS_ELITE | 1: elite (+ add at ELITE_ADD_CHANCE) | ELITE_XP_MULT × MOB_XP_FRAC (rare: RARE_XP_MULT) | ELITE_GOLD_V × V | 1 guaranteed (table 8.4) | high |
| Dungeon | HOURS_DUNGEON | DUNGEON_TRASH_FIGHTS trash + 1 boss | kills + DUNGEON_CLEAR_XP_FRAC | kills + DUNGEON_GOLD_V × V | trash drops + DUNGEON_BOSS_DROPS | highest |
| Rest | HOURS_REST | 0 | rested pool | 0 | 0 | none |
| Vendor | HOURS_VENDOR | 0 | 0 | spend/sell | buy | none |
| Trainer | HOURS_TRAINER | 0 | 0 | spend | spells | none |
| Treasure | HOURS_TREASURE | 0-1 (guard at TREASURE_GUARD_CHANCE) | kill only | TREASURE_GOLD_V × V | 1 roll | trap |
| Shrine | HOURS_SHRINE | 0 | 0 | 0 | choose 1 of 2 boons | none |

Mob kill XP = `MOB_XP_FRAC × mult × xpToNext(enemyLevel) × diffMod`, with mult 1 (normal), DUNGEON_MOB_XP_MULT (dungeon trash), ELITE_XP_MULT, RARE_XP_MULT, DUNGEON_BOSS_XP_MULT.

### 2.1 Quest
- On enter: shows quest title and text (Content), then one encounter. Encounter size weights: the quest template's own weights (12.3), else 1 mob QUEST_SIZE_W1, 2 mobs QUEST_SIZE_W2, 3 mobs QUEST_SIZE_W3. Mob archetypes from the zone's normal templates. (M2 v2)
- Zone 1 cap: in zone 1 the encounter has at most QUEST_MAX_SIZE_Z1 mobs; a drawn size above the cap becomes the cap. The size draw itself is unchanged (same stream draws), so only zone 1 encounters change. (M2 v2)
- On victory: turn-in XP `QUEST_TURNIN_XP_FRAC × xpToNext(CL) × diffMod`, gold `QUEST_GOLD_V × V(CL)`, and `CHOOSE_REWARD(i)` among QUEST_REWARD_CHOICES generated items (rarity table 8.4 "Quest reward").
- Story chain: the STORY_QUESTS-th quest completed in a zone also grants `STORY_XP_FRAC × xpToNext(CL)` and a choice of STORY_REWARD_CHOICES rare items at CL + RARITY_ILVL_BONUS.rare.
- Flee: allowed; no turn-in, quest not counted.

### 2.2 Grind
- On enter: `GRIND_SET_WAVES(n)` with 1 <= n <= GRIND_MAX_WAVES. After each wave the player may `GRIND_STOP`. Each started wave costs HOURS_GRIND_WAVE.
- Each wave: one encounter of GRIND_WAVE_SIZE normal mobs at CL; wave bonus `GRIND_WAVE_XP_FRAC × xpToNext(CL) × diffMod`.
- Item and junk drop chances × GRIND_DROP_MULT.

### 2.3 Elite
- One elite (archetype from the zone's elite templates) at CL + ELITE_LEVEL_OFFSET, plus one normal add at ELITE_ADD_CHANCE.
- Rare variant (RARE_CHANCE): a rare template (RARE_HP_MULT, RARE_DMG_MULT, one extra ability), RARE_XP_MULT, loot table "Rare elite".
- Elites and rares have 1-2 abilities from the ability templates (12.4).

### 2.4 Dungeon
- Sequence: DUNGEON_TRASH_FIGHTS trash encounters (size weights DUNGEON_SIZE_W2 / DUNGEON_SIZE_W3), then the dungeon boss (alone). Between fights: post-fight regen, out-of-combat actions, rations allowed.
- `DUNGEON_LEAVE` between fights: keeps loot so far; full hours are spent; no clear bonus; the dungeon counts as not cleared.
- Boss: DUNGEON_BOSS_HP_MULT, DUNGEON_BOSS_DMG_MULT, exactly 2 abilities from 12.4, immune to stun/freeze/hex (they interrupt casts instead). No flee from the boss fight.
- Zone danger in dungeons (M2 v4): dungeon trash and dungeon bosses get DUNGEON_DANGER_FRAC of the zone-danger bonus of 7.6 (level 60: ×1.5 instead of ×2.0). Dungeons already carry their own multipliers; full zone danger on top made them 39-65 % deadly per entry and the planner stopped entering them. (M2 v4)
- Clear: `DUNGEON_CLEAR_XP_FRAC × xpToNext(boss level) × diffMod`, gold DUNGEON_GOLD_V × V, DUNGEON_BOSS_DROPS rolls on "Dungeon boss".

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
| Round, manual | PACE_MANUAL_ROUND_S = PACE_ROUND_ANIM_S + PACE_ROUND_DECIDE_S | 1.5 + 1.0 = 2.5 per round (M2 v2) |
| Round, autoplay | PACE_AUTO_ROUND_S | 0.8 per round |
| Equipment drop decision | PACE_LOOT_S | 3 per equipment item |
| Level-up | PACE_LEVELUP_S | 2 per level |
| Talent point | PACE_TALENT_S | 6 per point |
| Rest / Shrine / Treasure screen | PACE_REST_S / PACE_SHRINE_S / PACE_TREASURE_S | 5 / 6 / 4 |
| Vendor | PACE_VENDOR_S + PACE_VENDOR_TX_S per buy/sell | 20 + 3 |
| Trainer | PACE_TRAINER_S + PACE_TRAINER_TX_S per spell | 6 + 2 |
| Boss intro | PACE_BOSS_INTRO_S | 20 |

`estSeconds(run) = sum of the terms`, counting rounds with PACE_MANUAL_ROUND_S for the manual profile and PACE_AUTO_ROUND_S for the autoplay profile (balance.md says which bot uses which).

Round time budget for the UI (M2 v2): at the default animation speed, a manual round (player action, pet action, enemy actions, end-of-round ticks) is on screen for at most PACE_ROUND_ANIM_S before the action bar accepts the next input; an input given while enemy animations still play finishes them at once. PACE_ROUND_DECIDE_S is the player's reading and choosing time. QA measured 2.3-2.7 s on screen per round at 1x on build 5b3e929 (1.65 s at 2x) [source: docs/handoffs/qa-2026-11-09.md, finding 5], so the default speed must be faster than today's 1x. QA checks the budget with qa/browser/pace.mjs.

Worked estimate (design intent, to be verified by the simulator):

| Per zone | Normal route (manual) | Speed route (autoplay) |
|---|---|---|
| Hub | Trainer (3 spells) + Vendor (4 tx): 44 s, 2 h | Trainer (3 spells): 12 s, 1 h |
| Nodes | 4 Quest, 1 Dungeon, 1 Elite, 1 Grind (2 waves), 1 Rest = 8 nodes | 3 Quest, 1 Dungeon, 2 Elite = 6 nodes |
| Fights / rounds | 11 fights; quest 5 r, wave 5 r, elite 8 r, trash 6 r, dungeon boss 10 r | 9 fights, same rounds |
| Seconds | about 375 s | about 190 s |
| Hours | 25 h (incl. travel) | 18 h |
| XP (levels, before diff mod) | about 11.8 | about 10.9 incl. story bonus and under-level bonus |

Run totals: normal = 6 × 375 + create 40 + level-ups 118 + talents 156 + boss (20 + 40 rounds manual) about 2690 s = 45 min, 150 h (Ascendancy +8 %). Speed = 6 × 190 + 40 + 118 + 156 + 120 (boss manual) about 1575 s = 26 min, 108 h (no Ascendancy). A speedrunner playing every fight manually lands near 37 min.

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

---

## 5. Classes

### 5.1 Base stats and growth
| Field | Rogue | Mage | Hunter |
|---|---|---|---|
| hpBase / hpPerLevel | 70 / 20 | 50 / 19.5 | 60 / 15.5 | (M2 v3: mage 17.5 -> 19.5, hunter 17 -> 15.5)
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
| ricochet_bolt | Hunter | Ricochet Bolt | 20 | 35F | 0 | phys 5 + 1.1tl + 0.5P + 0.9WD on target, then 2 other enemies at 40 % | >= 2 enemies | (M2 v3: bounce 70 % -> 40 %)
| beastcall_horn | Hunter | Beastcall Horn | 40 | 0 | 12 | pet healed to full (revived if dead); pet TAUNT 2 rounds | HP < 40 % |

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
| r_b4 | Shadowcraft 2 | Veiled Recovery | 2 | while EVASION is active, heal 3 % max HP per round /rank |
| r_b5 | Shadowcraft 3 | Cheap Trick | 2 | Temple Blow -10 energy and -1 CD /rank |
| r_b6 | Shadowcraft 3 | Ambusher's Patience | 2 | first finisher each fight +20 % damage /rank |
| r_b7 | Shadowcraft 4 | Shroudwalk | 2 | Vanishing Step -3 CD /rank and heals 10 % max HP /rank |
| r_b8 | Shadowcraft 4 | Night Instinct | 3 | +5 % damage /rank while in STEALTH and on the action right after leaving it |
| r_b9 | Shadowcraft 5 | Death's Sidestep | 1 | passive, once per fight: when a hit would drop you below 20 % HP, take no damage from it, dispersal, gain STEALTH, heal 20 % max HP |
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
| h_a1 | Beastbond 1 | Thick Hide | 3 | pet max HP +8 % /rank |
| h_a2 | Beastbond 1 | Ferocity | 3 | pet damage +10 % /rank | (M2 v2: 6 -> 10 %)
| h_a3 | Beastbond 2 | Bonded Spirit | 2 | Mend Companion also heals you for 30 % /rank of the amount |
| h_a4 | Beastbond 2 | Frenzy Link | 2 | pet crit +0.05 /rank; each pet crit gives you 5 focus /rank |
| h_a5 | Beastbond 3 | Unbreakable Bond | 2 | pet revives after fights at +0.25 /rank; pet takes -5 % damage /rank |
| h_a6 | Beastbond 3 | Pack Leader | 2 | you and pet deal +5 % damage /rank while pet is alive | (M2 v2: 3 -> 5 %)
| h_a7 | Beastbond 4 | Savage Mastery | 2 | Savage Order CD -1 and +10 % /rank |
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
| h_c1 | Wildcraft 1 | Hardy | 3 | max HP +4 % /rank |
| h_c2 | Wildcraft 1 | Barbed Mastery | 3 | Barbed Arrow +20 % /rank | (M2 v2: 10 -> 20 %)
| h_c3 | Wildcraft 2 | Trapper | 2 | Snare Trap CD -1 /rank and deals phys (4 + 1.0tl + 0.4P) × rank |
| h_c4 | Wildcraft 2 | Field Medic | 2 | Field Dressing +20 % /rank |
| h_c5 | Wildcraft 3 | Survivalist | 2 | +0.03 dodge /rank |
| h_c6 | Wildcraft 3 | Venom Barbs | 2 | Barbed Arrow stacks to 1 + rank (each stack a full tick) |
| h_c7 | Wildcraft 4 | Fire Snare | 1 | Snare Trap also applies BURN 3 rounds to all enemies, tick 3 + 0.6tl + 0.25P |
| h_c8 | Wildcraft 4 | Cornered Beast | 3 | +8 % damage /rank while HP < 50 % | (M2 v2: 4 -> 8 %)
| h_c9 | Wildcraft 5 | Deadfall Mastery | 1 | new spell `deadfall_trap`: 30F, CD 8, phys to all 10 + 2.4L + 1.0P; STUN 1 non-boss; interrupts boss casts |

---

## 7. Combat

### 7.1 Manual-first fight flow
Manual control is the default; the player picks every action [stated: owner correction]. Each round:
1. **Intents.** Every living enemy that can act rolls its intent for this round (7.6) and the UI shows it: ability name, target (player or pet), estimated damage, and flags `cast` (interruptible) and `heavy` (telegraphed big hit). This is the main source of manual decisions: interrupt a cast, stun or hex the heavy hitter, kill the healer, raise a shield, drink now or later.
2. **Player action.** Exactly one: `CAST(spellId, targetIdx)`, `ATTACK(targetIdx)`, `USE_ITEM(itemBarSlot, targetIdx)`, `FLEE`, or `PASS`. Autoplay chooses with policy 7.9 if on.
3. **Pet action** (Hunter).
4. **Enemy actions** in index order, each performing its intent (re-targeted if TAUNT or feign changed the valid target).
5. **End of round:** DOT/HOT ticks (player side first, then enemies in index order), WARD/status durations -1, cooldowns -1, resources regen, Eclipse etc. Death checks after every damage event; the fight ends at once when all enemies are dead (victory) or the player is dead (section 9).

Round 1 exception: a stealthed Rogue's enemies have intent "Unaware" (no action) in round 1.

`SET_AUTOPLAY(on|off)` is legal at any time, including mid-fight; it changes who decides the next player action and nothing else.

Fight start: energy/focus full, CP 0, all cooldowns 0. Fight end: statuses (except run-level boons and Elixir) and WARD removed, cooldowns reset, then post-fight regen.

### 7.2 Damage pipeline (exact order)
1. `base` from the formula (spell, basic attack, enemy ability).
2. × attacker modifiers (sum of % mods: talents, buffs, boons, elixir, meta), × level modifier `clamp(1 + LVL_DMG_STEP × (attackerLevel - targetLevel), LVL_DMG_MIN, LVL_DMG_MAX)`, × CHILLED/CURSED on attacker.
3. Draw r1: miss if `r1 < missChance`. `missChance = min(MISS_CAP, MISS_BASE + MISS_PER_LEVEL × max(0, targetLevel - attackerLevel)) + (physical ? target dodge : 0) + STEALTH bonus`. Interrupt-tagged spells (Throat Jab, Spellsnap, Muzzle Shot) never miss and cannot be dodged; r1 is still drawn. (M2 v2)
4. Draw r2: crit if `r2 < critChance` -> × crit multiplier.
5. Draw r3: × `(1 - DMG_VARIANCE + 2 × DMG_VARIANCE × r3)`.
6. × target modifiers (EXPOSED, MARKED, Brittle, Fester, Linked, Shard brittleness, shield-wall effects), summed as % and applied once. Linked on the end boss: `-min(LINK_DR, LINK_DR_PER_SHARD × living Shards)`. Shard brittleness: a Shard takes `+SHARD_AOE_TAKEN` from direct hits of the player's aoe-tagged spells (not from DOT ticks or the pet). (M2 v2)
7. Physical: × `(1 - mitigation(target armor, attacker level))`. Magic: unchanged.
8. Round; a hit deals at least MIN_HIT_DAMAGE.
9. WARD absorbs first, then HP. IMMUNE: 0 damage (still draws r1-r3).

Each damage event draws exactly 3 numbers (r1, r2, r3) even on a miss. Multi-hit spells are separate events. DOT ticks: damage is fixed at application (steps 1-2 and 6 snapshot), no miss, no armor, draw 1 number only if the tick can crit. Heals: no rolls, no crit.

Enemy crit chance ENEMY_CRIT, crit multiplier CRIT_MULT. Enemy dodge ENEMY_DODGE (+ archetype).

### 7.3 Resources and costs
Cost is paid on use, also on a miss. Mana costs are `round(cost% × base mana(L))`. Not enough resource = spell unusable. Energy/Focus regen at end of round; mana regen MANA_REGEN_ROUND_PCT at end of round.

### 7.4 Status effects
Durations count end-of-round decrements including the round of application (a 1-round STUN applied by the player cancels that enemy's action in the same round). Re-applying refreshes duration unless stacking is listed. "Dispersal" removes every debuff on self.

| Status | On | Effect | Stacking | Removed by |
|---|---|---|---|---|
| STUN | enemy | skips actions | refresh | end; bosses immune (stun on boss = interrupt) |
| FROZEN | enemy | skips actions | refresh | end; bosses immune (= interrupt) |
| HEXED | enemy | skips actions, intent "none" | refresh | any damage to it; bosses immune (= interrupt) |
| SILENCED | enemy | cannot pick `cast` intents | refresh | end |
| BLEED / BURN | any | tick damage at end of round | one per source spell; refresh | end, dispersal (on player) |
| POISON | enemy | tick per stack | up to cap; each application +1 stack, refresh | end |
| CHILLED | any | outgoing damage -CHILL_PCT | refresh | end, dispersal |
| CURSED | player | outgoing damage -CURSE_PCT | refresh | end, dispersal |
| EXPOSED / MARKED | enemy | damage taken + value | separate statuses add | end |
| BRAND | player | BRAND_DMG per stack per round | +1 stack up to BRAND_MAX, no expiry | dispersal only |
| WARD | player | absorbs damage | one; new replaces if larger | broken, end, fight end |
| EVASION | player | + dodge | refresh | end |
| STEALTH | player | openers usable; enemy attacks vs you +STEALTH_MISS_BONUS miss | - | any non-opener action, after 1 round if gained mid-fight |
| IMMUNE | player | no damage, cannot act | - | end (Final Dark ignores it) |
| HOT | any | heal per tick | refresh | end |
| TAUNT | pet | all enemy single-target attacks target the pet | refresh | end, pet death |

### 7.5 Usable items in combat
Only items on the 3 item-bar slots, one item per action. Healing and Mana Draughts share POTION_CD. Other items have no cooldown. See 8.6 for effects.

### 7.6 Enemy AI and intents
Each enemy has an archetype (table) plus up to 2 template abilities (12.4). Intent roll (1 draw per enemy, then 1 draw for target if a live pet exists and no TAUNT): eligible actions = basic attack + abilities off cooldown whose condition holds (SILENCED removes casts); pick by weight.

| Archetype | HP mult | Dmg mult | Armor mult | Extra dodge | Actions (weight) |
|---|---|---|---|---|---|
| brute | 1.2 | 1.0 | 1.0 | 0 | Strike 100 % phys (70); Heavy Smash 180 % phys, heavy, CD 3 (30) |
| skulker | 0.9 | 1.0 | 0.8 | 0.10 | Strike (60); Rend 60 % + BLEED 3 rounds tick 20 % (40), CD 3 |
| caster | 0.8 | 1.1 | 0.5 | 0 | Bolt 110 % magic (60); Hex Bolt 200 % magic, cast, CD 3 (25); Wither: CURSED 3, cast, CD 5 (15) |
| beast | 1.0 | 0.9 | 0.8 | 0.05 | Bite 100 % phys (60); Frenzy 2 × 70 % phys (40), CD 2 |
| guardian | 1.5 | 0.8 | 2.0 | 0 | Strike (60); Brace: self takes -50 % 2 rounds, CD 4 (20); Shield Ally: lowest-HP ally takes -50 % 2 rounds, CD 4 (20) |
| mender | 0.9 | 0.6 | 0.8 | 0 | Strike (50); Mend: heal lowest-HP ally (incl. self) 25 % max HP, cast, CD 3, only if some ally < 70 % (50) |

Normal enemy at level M: `HP = (ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL × M) × archetype × variant`, `dmg (100 %) = (ENEMY_DMG_BASE + ENEMY_DMG_PER_LEVEL × M) × archetype × variant`, `armor = ENEMY_ARMOR_PER_LEVEL × M × archetype`. Variants: normal 1/1, dungeon trash DUNGEON_TRASH_HP_MULT/DUNGEON_TRASH_DMG_MULT, elite ELITE_HP_MULT/ELITE_DMG_MULT, rare RARE_HP_MULT/RARE_DMG_MULT, dungeon boss DUNGEON_BOSS_HP_MULT/DUNGEON_BOSS_DMG_MULT.

Zone danger (M2 v3): every enemy made from an enemy template (normal, quest, grind, elite, rare, dungeon trash and boss, Camp waves, summoned adds) has its damage multiplied by `zd(M) = 1 + ZONE_DANGER_STEP × max(0, M - ZONE_DANGER_FROM) / 10` (level 30 ×1.25, 40 ×1.5, 50 ×1.75, 60 ×2.0). Dungeon trash and dungeon bosses use `1 + DUNGEON_DANGER_FRAC × (zd(M) - 1)` instead (level 60 ×1.5) (M2 v4). HP, armor and XP are unchanged. The end boss and the Dimming Shards use their own constants (section 10) and are not affected. Purpose: same-level content stays about as threatening in zones 3-6 as in zone 2; the player's power growth (talents, ranks, rarity) otherwise outpaces the linear damage curve. (M2 v3)

Soft enrage (non-boss fights): from round FIGHT_SOFT_ENRAGE_ROUND, enemies deal +FIGHT_SOFT_ENRAGE_STEP more damage per round (additive). Prevents endless fights.

### 7.7 Interrupts
An enemy whose intent has `cast` loses that action if, before it acts in that round, it is hit by an interrupt (Throat Jab, Spellsnap, Muzzle Shot; these always hit, 7.2 step 3), or becomes STUN/FROZEN/HEXED, or (bosses) is hit by any stun-tagged spell. (M2 v2) Cooldown of the cast ability still starts. 2-round boss channels (10.3) can be interrupted in either round.

### 7.8 Flee
`FLEE` succeeds if a draw < `FLEE_BASE - FLEE_PER_EXTRA_ENEMY × (living enemies - 1)` (1.0 in STEALTH). Success: leave the node; hours already spent; no further rewards from the node; quest not counted; dungeon not cleared. Not allowed vs dungeon boss or end boss.

### 7.9 Autoplay policy (autoplay toggle and bots)
Deterministic given state and seed. Each player turn, the first rule that yields an action wins:
1. HP < AUTO_POTION_HP and a healing item on the item bar is usable -> use it.
2. Own debuff stacks (BRAND counts per stack) >= AUTO_TONIC_STACKS and a cleanse spell (tag cleanse) or Purifying Tonic is usable -> use it (spell first).
3. Some enemy intent is `cast` and an interrupt or stun-tagged spell on the bar is usable on it -> use it on the cast with the highest estimated damage (ties: lowest index).
4. Mana < AUTO_MANA_POTION and a Mana Draught is on the item bar and usable -> use it.
5. Bar slots 1..7 in order: the first usable spell whose autoplay condition holds -> cast on the default target (or the spell's own target rule).
6. Basic attack on the default target.

Default target: living, non-HEXED enemy, priority mender > caster > others; within a priority, lowest current HP; ties lowest index. "Focus" = default target. ">= N enemies" counts living non-HEXED enemies.
Between fights in a node: if HP < AUTO_FOOD_HP (or mana < AUTO_FOOD_HP for Mage) and Trail Rations are in the bag, eat one.

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
- Stat split of `B - A`: 1 stat: primary or STA (50/50) all points; 2 stats: primary SPLIT2_MAIN, second (STA or SPI, 70/30) the rest; 3 stats: primary SPLIT3_MAIN, STA SPLIT3_SECOND, SPI the rest.
- Primary on generated items: current class's primary at DROP_CLASS_BIAS, else the other primary (AGI or INT).
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

Drop order per kill: item chance draw, junk chance draw, rarity draw, slot draw (uniform over 10 slots), stat draws in 8.3 order. Elites additionally drop an Ember of Return at EMBER_ELITE_DROP_CHANCE. Unique items from meta unlocks (11.3) replace a generated item of matching rarity at UNIQUE_DROP_CHANCE.

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

Run summary (SUMMARY phase): class, pet, talents (per tree), seed, outcome (victory/death), death location, level and XP, zone/row reached, hours, Ascendancy, estimated minutes (manual and autoplay profiles), nodes by type, fights, rounds, kills (normal/elite/rare/boss), quests and story rewards, dungeons cleared, gold earned and spent, potions used, resurrects used, damage dealt/taken, top 3 spells by damage, equipped items with ilvl and rarity, boss phase reached and boss HP % left, Echoes earned with the line-by-line breakdown (11.1).

---

## 10. End boss: Oruvath, the Unlit Star

### 10.1 Setup
Fought once at the end of the Camp in the Sunken Observatory. Level BOSS_LEVEL. HP `BOSS_HP × (1 + asc)`, armor BOSS_ARMOR, crit ENEMY_CRIT. Immune to STUN, FROZEN, HEXED (they interrupt casts instead). No flee. The boss always targets the player except when a pet has TAUNT, feign is active, or a single-target attack rolls pet aggro.

### 10.2 Phases and mechanics
| Phase | HP band | Mechanics | What it tests |
|---|---|---|---|
| 1 | 100 % - P2_AT | Umbral Strike every round it is not channelling: BOSS_MELEE phys. Gravity Crush every BOSS_CRUSH_EVERY rounds: BOSS_CRUSH phys, heavy (telegraphed, not interruptible). Collapse Litany: 2-round channel starting round LITANY_FIRST, then every LITANY_EVERY rounds; on completion BOSS_LITANY_DMG magic to player and pet. Brand of the Hollow: at end of every BRAND_EVERY-th round, +1 BRAND stack. | interrupt on bar; defensive timing |
| 2 | P2_AT - P3_AT | On entry and every SHARD_EVERY rounds: summon SHARD_COUNT Dimming Shards (HP SHARD_HP, phys hit SHARD_DMG, max SHARD_MAX alive, level 60, can be stunned/hexed). Linked: the boss takes -LINK_DR_PER_SHARD damage per living Shard, at most -LINK_DR (2 Shards -30 %, 4 Shards -60 %), so every Shard killed speeds up the boss kill. Shards take +SHARD_AOE_TAKEN damage from the player's AoE spells (aoe tag: Whirling Edges, Rime Burst, Cinder Storm, Volley Rain, Deadfall Trap, Ricochet Bolt). Litany, Crush and Brand continue. | AoE, control, target choice | (M2 v2)
| 3 | < P3_AT | Shards despawn. Eclipse: boss damage +ECLIPSE_STEP per round in phase 3 (additive). Starless Pulse every PULSE_EVERY rounds: PULSE_DMG magic to player and pet (not interruptible). Litany and Brand continue. | burst, potions, sustain, cleanse |
| Enrage | round >= BOSS_ENRAGE_ROUND | Final Dark each round: FINAL_DARK_DMG magic; ignores WARD and IMMUNE. | overall damage check |

All boss and Shard damage × (1 + asc). Phase changes happen at once when HP crosses the threshold (no skipping: damage that crosses two thresholds triggers both in order).

### 10.3 Intent display
The channel shows "Collapse Litany 1/2" then "2/2 - resolves". Gravity Crush shows its round one round ahead ("next round"). Brand stack timing is shown as a counter.

---

## 11. Meta progression

### 11.1 Echoes (meta currency) per run
| Line | Echoes |
|---|---|
| Per level gained (L - 1) | round(ECHO_PER_LEVEL × (L - 1)) | (M2 v3)
| Per zone left by TRAVEL_ON | round(ECHO_PER_ZONE × zones left) | (M2 v3)
| Per dungeon cleared | ECHO_PER_DUNGEON |
| Per elite / rare killed | ECHO_PER_ELITE / ECHO_PER_RARE |
| Per quest completed | ECHO_PER_QUEST |
| Reached the boss | ECHO_BOSS_REACHED |
| Per boss phase reached after phase 1 | ECHO_BOSS_PHASE |
| Boss killed | ECHO_BOSS_KILL |
| Kill with hours <= BOSS_TIME_PAR | ECHO_SPEED_BONUS |
| First kill with this class (once per profile per class) | ECHO_FIRST_KILL_CLASS |
| Oath multiplier | × (1 + OATH_ECHO_BONUS × oaths taken) on the total |

All lines scale with progress [stated: scaled by progress]. Each line is rounded (half away from zero) before the total. Typical (M2 v3): planner run about 235, a win about 430. (M2 v3)

### 11.2 Catalogue
Bought between runs on the profile screen. Ranked entries: cost listed per rank. "Req" = prerequisite.

| id | Name | Kind | Ranks | Cost per rank | Effect | Req |
|---|---|---|---|---|---|---|
| vigor | Vigor of the Line | stat | 4 | 80/120/170/230 | max HP +0.01 /rank | - | (M2 v4: 5 ranks -> 4)
| edge | Edge of the Line | stat | 4 | 80/120/170/230 | Power +0.01 /rank | - | (M2 v4: 5 ranks -> 4)
| keen | Keen Lineage | stat | 2 | 150/250 | crit +0.0075 /rank | - | (M2 v4: 0.01 -> 0.0075)
| quick_study | Quick Study | stat | 3 | 100/180/280 | XP +0.0375 /rank | - | (M2 v4: 0.05 -> 0.0375)
| prospector | Prospector | stat | 3 | 60/110/170 | gold +0.06 /rank | - | (M2 v4: 0.08 -> 0.06)
| satchel | Packed Satchel | start kit | 1 | 60 | start with 3 Healing Draughts | - |
| heirloom_blade | Heirloom Blade | start kit | 1 | 80 | starting weapon is uncommon ilvl 3 | - |
| pockets | Deeper Pockets | start kit | 2 | 50/100 | +4 bag slots /rank | - |
| ledger | Trainer's Ledger | economy | 1 | 120 | first LEARN or TRAIN at each hub is free | - |
| scout | Scout's Eye | map | 1 | 100 | rare elites, treasure traps and vendor Embers visible on the map | - |
| swift_boots | Swift Boots | map | 1 | 200 | TRAVEL_ON legal at exit level - 1 | - | (M2 v4: no requirement; was wayfinder)
| alchemist | Alchemist's Notes | items | 1 | 150 | Greater Healing Draught (heals GREATER_HEAL_PCT 0.375) in all vendors | satchel | (M2 v4: heal 0.50 -> 0.375)
| cache | Cache of the Wanderer | items | 1 | 200 | 6 unique rares (one per zone band) in elite and treasure pools | - | (M2 v3: cost)
| relics | Relics of the Deep | items | 1 | 400 | 6 unique epics (one per dungeon) in dungeon boss pools | cache | (M2 v3: cost)
| starforged | Starforged Arms | items | 1 | 450 | each class's unique epic weapon (ilvl 62) sold at the Camp vendor | relics, first boss kill | (M2 v3: cost)
| sp_r1 / sp_m1 / sp_h1 | Lost Technique I (per class) | skill | 1 | 150 | Ghostblade Rush / Chrono Sigil / Ricochet Bolt learnable | - |
| sp_r2 / sp_m2 / sp_h2 | Lost Technique II (per class) | skill | 1 | 300 | Bloodprice Gambit / Mirrorshade / Beastcall Horn learnable | same-class I | (M2 v3: cost)
| stormhawk | Stormhawk Companion | skill | 1 | 250 | Stormhawk pet selectable | - | (M2 v3: cost)
| talent_pt | Ancestral Insight | stat | 1 | 500 | +1 talent point at level 60 | - | (M2 v3)
| second_breath | Second Breath | resurrect | 1 | 500 | 1 resurrect charge per run, not usable in the end-boss fight | reached the boss once | (M2 v3)
| oaths | Oaths | challenge | 1 | 0 | unlocks Oaths at creation (11.5) | first boss kill |

Catalogue total: 7 010 Echoes (M2 v4; M2 v3: 7 690, before: 6 730).

Removed (M2 v4): Wayfinder (80 Echoes, TRAVEL_ON cost 0 hours). Its 12 hours per run (6 travels × 2 h) lowered the full-catalogue planner's boss Ascendancy by about one step (0.04: boss HP and damage) and was worth about 12 pp of PALL win rate in the M2 v4 package (about 6 pp per hour of travel cost, two paired steps), about as much as Vigor, Edge and Keen together (11.5 pp). A saved profile that owns it keeps the Echoes spent and gets no effect (as D32). (M2 v4)

**Meta power budget (M2 v3, revised M2 v4).** The full catalogue may add at most: max HP +0.04, Power +0.04, crit +0.015, potion healing +0.025 of max HP per healing potion (Alchemist's Notes: Greater Healing Draught 0.375 against the Healing Draught's 0.35), +1 talent point, the unique items (normal rarity budget plus one 11.3 effect) and the Starforged weapon, and no resurrect in the end-boss fight. (M2 v4)

Time is budgeted too (M2 v4): hours saved before the boss lower boss Ascendancy (1.7), which is boss HP and damage, so the time entries together (Quick Study, Swift Boots) may save at most META_TIME_BUDGET_H on the planner's median route (measured: planner median hours at the boss on PALL against P0, balance.md B17). (M2 v4)

Every other entry gives economy (gold, training), information (map), bag space, starting consumables, or a new choice (spells and pet that are side-grades, not strict upgrades). A new entry that adds combat power or saves time must take it from this budget. Measured check: balance.md B2, B3, B6, B10. (M2 v3)

Known gap (M2 v4): economy is not free either. Quick Study, Prospector and Trainer's Ledger together are worth about 9.6 pp of PALL planner win rate in the M2 v4 package (Prospector alone 4.3 pp; at half value it still gives 3.7 pp, so the effect is not linear in gold) [source: designer scratch sim/out/v4/Fab]. It is inside the measured B10 cap; if the catalogue grows in M3, give economy a budget line first. (M2 v4)

### 11.3 Unique items (Content fills names)
Unique items use the normal budget at their rarity and one effect from: on-hit proc (chance UNIQUE_PROC_CHANCE, magic `UNIQUE_PROC_BASE + UNIQUE_PROC_PER_LEVEL × L`); heal UNIQUE_HEAL_ON_KILL of max HP on kill; +UNIQUE_ELITE_DMG damage vs elites and bosses; +UNIQUE_POTION_PCT potion healing; WARD of UNIQUE_WARD_PCT max HP at fight start.

### 11.4 How unlocks enter a run
Applied at character creation: stat ranks as % modifiers, start kit into the bag/slots, map/economy rules as flags, unique items into drop pools from the start of the run, meta spells added to the class's trainer list. Unlocks never change the seed streams except by adding pool entries (so the same seed is not identical across profiles; the run summary records the profile hash).

### 11.5 Oaths (after the first kill)
Each Oath adds +OATH_ECHO_BONUS Echoes: Oath of Haste (BOSS_TIME_PAR - OATH_HASTE_HOURS), Oath of Frailty (no resurrect charges), Oath of Thrift (vendor prices × OATH_THRIFT_MULT). They keep late profiles challenged; power from meta stays capped (balance.md B10).

---

## 12. Content ranges (for the Content Designer)

### 12.1 Counts
| Table | Per zone | Total |
|---|---|---|
| Zone (name, 1-line theme, hub name) | 1 | 6 |
| Normal enemy templates | 6-9 | 36-54 |
| Elite templates | 2-3 | 12-18 |
| Rare elite templates | 1-2 | 6-12 |
| Dungeon (name, 3-5 trash templates, 1 boss) | 1 | 6 |
| Quest templates (title, giver, text) | 8-12 | 48-72 |
| Item base names per slot per zone band | >= 3 | >= 180 |
| Stat-flavour words (prefix/suffix) per stat pair | >= 2 | - |
| Unique rares / epics / class weapons | - | 6 / 6 / 3 |
| Shrine and treasure flavour lines | 2 each | 12 each |

### 12.2 Enemy templates
| Field | Allowed |
|---|---|
| Archetype | one of 7.6 |
| Level | normal: zone band; elite: band + ELITE_LEVEL_OFFSET; dungeon as 1.4 |
| HP mult on top of archetype | 0.85-1.20 |
| Dmg mult on top of archetype | 0.85-1.20 |
| HP mult × dmg mult | 0.90-1.15 |
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

### 12.5 Items
Names <= 30 chars; flavour text <= 100 chars; no stats set by hand except unique effects within 11.3.

---

## 13. Constant table

Data tables (`CLASS`, `SPELL`, `PET`, `TALENT`, `ARCHETYPE`, `SLOT`, `RARITY`, `DROP_TABLE`, `ITEM_SCORE`, `CONSUMABLE`, `BOON`, `META`, `ABILITY_TEMPLATE`, `CONTENT_RANGE`) are defined in sections 2.9, 5, 6, 7.6, 8, 11 and 12; each cell is a constant named `TABLE.id.field`.

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
| HOURS_QUEST | 2 | h |
| HOURS_GRIND_WAVE | 1 | h |
| HOURS_ELITE | 2 | h |
| HOURS_DUNGEON | 5 | h |
| HOURS_REST | 4 | h |
| HOURS_VENDOR | 1 | h |
| HOURS_TRAINER | 1 | h |
| HOURS_TREASURE | 1 | h |
| HOURS_SHRINE | 1 | h |
| HOURS_TRAVEL | 2 | h |
| TRAVEL_EARLY_LEVELS | 1 | levels below exit level | (M2 v2)
| BOSS_TIME_PAR | 120 | h | (M2 v2)
| ASC_STEP_HOURS | 10 | h |
| ASC_PER_STEP | 0.04 | fraction |
| ASC_CAP | 0.40 | fraction |
| META_TIME_BUDGET_H | 5 | h saved by the full catalogue's time entries, planner median (half of ASC_STEP_HOURS) | (M2 v4)
| QUEST_SIZE_W1 | 25 | weight |
| QUEST_SIZE_W2 | 50 | weight |
| QUEST_SIZE_W3 | 25 | weight |
| QUEST_MAX_SIZE_Z1 | 2 | mobs | (M2 v2)
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
| FLEE_BASE | 0.60 | probability |
| FLEE_PER_EXTRA_ENEMY | 0.05 | probability |
| FIGHT_SOFT_ENRAGE_ROUND | 20 | round |
| FIGHT_SOFT_ENRAGE_STEP | 0.25 | per round |
| ENEMY_HP_BASE | 20 | HP |
| ENEMY_HP_PER_LEVEL | 12 | HP |
| ENEMY_DMG_BASE | 4 | damage |
| ENEMY_DMG_PER_LEVEL | 2.6 | damage |
| ZONE_DANGER_FROM | 20 | level | (M2 v3)
| ZONE_DANGER_STEP | 0.25 | × per 10 levels above ZONE_DANGER_FROM | (M2 v3)
| DUNGEON_DANGER_FRAC | 0.5 | share of the zone-danger bonus for dungeon trash and dungeon bosses | (M2 v4)
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
| BOSS_HP | 13900 | HP | (M2 v4: was 13500)
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
| ECHO_PER_LEVEL | 1.5 | Echoes | (M2 v3)
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
| OATH_HASTE_HOURS | 20 | h |
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
| PACE_MANUAL_ROUND_S | 2.5 | s per round |
| PACE_ROUND_ANIM_S | 1.5 | s per round (UI budget at default speed) | (M2 v2)
| PACE_ROUND_DECIDE_S | 1.0 | s per round | (M2 v2)
| PACE_AUTO_ROUND_S | 0.8 | s per round |
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
