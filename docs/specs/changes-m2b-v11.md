# Spec changes M2b v11: the flip package (expedition loot, the Dimming's price, Delves back, target readings)

Owner: Lead Game Designer, 2026-11-11. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), Lead. **Status: implemented (7b56d8e); folded into the main specs with "(M2b v11)" marks; this file is kept as the change record

Input: the merged v9 + v10 measure [source: docs/reports/balance-2026-11-11f.md, docs/handoffs/sim-2026-11-11g.md], changes-m2b-v9.md, changes-m2b-v10.md (appendix P, owner default O5), DECISIONS D78-D90. Where a figure says "11-11f run records", the designer read the per-run files of that pass (sim/out/pass-v9v10 in the sim worktree: the expedition cells under exp/, the classic default-tree cells planner-P0-tree*, planner-PALL-tree*) with a scratch script; nothing was re-simulated.

Scope: expedition runs with the start camp, plus one classic-and-expedition spell row (row 8, gated). When the Engineer builds this package, every changed line in expedition.md, rules.md and engine-api.md is marked "(M2b v11)" in the same commit as the code.

## Where the win-rate gap is (flip criterion 2)

| Check (planner P0, runs reaching the boss) | Expedition (v10) | Classic (v9) | Basis |
|---|---|---|---|
| Run win | 15.4 % (19.1 % with the D2 value) | 33.3 % | report 11-11f |
| Reach the boss | 71.7 % | 74-80 % by tree | 11-11f run records |
| Boss win, given reach | **21.6 %** | about 39-42 % | 11-11f run records |
| Mean equipped ilvl / rare-or-better share at the boss | **46.5 / 0.45** | 50.1 / 0.57 | report 11-11f |
| Normal kills per run (of which in Dimmed encounters, no loot) | 57 (about 6) | 96 | 11-11f run records (3.2 Dimmed encounters × DIM_PACK_SIZE 2) |
| Dungeons cleared per run | **0.46** | 1.44-1.52 | 11-11f run records |
| Gold earned per run | 70 thousand | 98 thousand | 11-11f run records |
| Potions used per run | 8.9 | 7.0-8.6 | 11-11f run records |

Reading: the gap is at the boss and it is gear. On the classic map, boss win rises about 2.5-4 pp per point of boss ilvl (planner P0 by boss ilvl 47 -> 54: rogue 33 -> 63 %, mage 17 -> 34 %, hunter 30 -> 45 %) [source: 11-11f run records; between-run spread, so an upper bound on the causal slope]. The expedition's 21.6 % at ilvl 46.5 sits on that line (classic runs at ilvl 47 win about 20-33 % of boss fights), so potions and the camp are not where the gap is. The missing gear is about 4.5 loot-bearing kill drops per run (51 loot kills × MOB_ITEM_CHANCE 0.15 = 7.7 items against 14.4) and about one dungeon per run (two boss rolls at rare 85 % / epic 15 %, which matches the 0.12 rare share, 1.2 slots). Run-win estimate used below: 2-3 pp boss win per ilvl point × reach 0.72 = **1.4-2.2 pp run win per ilvl point** [inference].

## Change table (the package)

Type: **rule** = engine code; **number** = constant; **data** = data-table value; **bot** = simulator value; **target** = balance target or definition.

| # | Constant or rule (spec section) | Old | New | Target | Expected effect, with basis | Type |
|---|---|---|---|---|---|---|
| 1 | **EXPED_DROP_MULT** (new; rules 8.4, expedition.md 9.5, 13): item and junk chance of normal and dungeon-trash kills in expedition runs, multiplied as GRIND_DROP_MULT is (the two multiply on a Grind node; a chance is capped at 1). Not Dimmed encounters (no loot) | 1 (none) | **1.6** | Flip 2 (gear); B19 ilvl | Kill loot follows the 9.5 budget as XP does: fights per run 31 against the classic 50 (1.6), and fight XP is already × XP_WEIGHT_MULT. Loot-bearing kill drops 7.7 -> 12.3 per run (classic 14.4) [computed: 51 loot kills × 0.15 × 1.6]; junk (gold) +60 % on those kills. Expected boss ilvl +0.7 to +1.2 (kill drops are 60 / 35 / 5 / 0 C/U/R/E at the mob's level, so they fill late slots, rarely add rares) [inference]; run win +1 to +2.5 pp [inference: 1.4-2.2 pp per ilvl]. Cost: about 4.5 more loot windows, about +14 s per run (PACE_LOOT_S 3) | number (new constant, designer row) |
| 2 | **EXPED_DUNGEON_BOSS_DROPS** (new; rules 8.4, 2.5 dungeon clear; expedition.md 13): rolls on table "Dungeon boss" at a dungeon clear in expedition runs | 2 (DUNGEON_BOSS_DROPS) | **3** | Flip 2 (gear, rare share); B39 Delve | One dungeon per zone and 5 tolls each: the expedition clears 0.46 dungeons per run against 1.5 on the classic map [source: 11-11f run records], and those missing clears are the missing rares (1.06 × 2 boss rolls at 85 % rare ≈ the 0.12 rare-share gap, 1.2 slots). A third roll gives +0.5 to +0.8 rare-or-epic items per run with row 3's extra clears [inference: 0.5-0.8 clears per run]; boss ilvl +0.3 to +0.6, rare share +0.03 to +0.06 [inference]. The planner's value function sees the extra gear in a Dungeon node, so it also pulls clears up. Classic map unchanged | number (new constant) |
| 3 | CONTRACT.delve.price (expedition.md 2.2, 13), with the abandon fix | 2 (v10 B2) | **1** (the starting price) | Delves taken (diag); B39 Delve; B4 readable; gear | **Computed:** the planner's value of a Delve is about 280 value units in zones 1-5 (2.1 levels-worth of XP at DELVE_XP_FRAC 1.5 × XP_WEIGHT_MULT 1.4 = 210, a choice of 2 on table "Contract" about 60, gold 2 V = 10), so at the 0.35 prior it pays about 49 per point at price 2 and 98 at price 1, against SIM.PREP_POINT_VALUE 60: price 2 is why no planner takes one [source: report 11-11f "none taken"; values balance.md 1.1]. Price 2 was set against buy-cheap-then-swap (11-11e: 202 of 609 Delves abandoned, 0.83 swaps per run). **Abandon fix (already in place, kept):** v10 D1 (prep by value per point, PREP_SAME_ZONE_MULT 0.6) and the learned completion table brought swaps to 0.10 per run [source: report 11-11f]; the guard is the decision rule below. Expected: 0.6-1.0 Delves taken per run, 35-40 % completed (random prep 39.9 %, speedrunner 34.2 %) [source: report 11-11f], so +0.2 to +0.4 dungeon clears per run with a Delve reward each | number (back to the spec value) |
| 4 | TIME_DIM_FIGHT (expedition.md 6.3, 13; rules 1.9.6) | 1 toll | **2 tolls** (arm: DIM_DMG_MULT 1.3 -> 1.6 with TIME_DIM_FIGHT 1) | B43 both parts | The planner now prices a depth-0 Dimmed encounter right (measured 1.4 % death, HP lost about 0.1) and takes 3.2 per run reaching the boss, because a Hot node at the edge pays (H.5) [source: report 11-11f]. Its price is about 28 (1.4 % × VAL_DEATH 2 000) + 18 (1 toll × VAL_TIME 6 × PLANNER_TIME_MULT 3) + the HP term; a second toll adds 18, about +35 %, **without** raising the death per encounter. The prototype moved caught zones +50 to +85 % for a -37 % price [source: expedition.md 12.2], an elasticity of about -1.5 to -2; so encounters × 0.55-0.65 and caught zones 28.6 -> **15-19 %**, Dimmed deaths × 0.55-0.65 (56 -> 31-36 of 900 runs) and the Dimmed share 22.0 -> **13-16 %** [inference]. Side effect: fewer non-boss deaths, planner P0 run win +0.3 to +0.8 pp [inference: 20-25 fewer deaths × boss win 0.22-0.30]. Fiction: the dark keeps coming while you fight in it; the front advances 0.8 hop during the fight, so a fight deep in the dark can be followed by another (the planner sees the front exactly and the learned `dim` table prices depth). Arm (raising the death price) is the fallback if the chain shows: it cuts encounters too but raises death per encounter, so it helps the first part of B43 more than the second. The bots read C.TIME_DIM_FIGHT (sim/bots/planner.mjs, sim/lib/view.mjs): no bot change | number (+100 %, designer row) |
| 5 | B41 C_step PALL band (expedition.md 11.1, 13: C_STEP_PALL) | 0.80-0.92 | **0.70-0.92 and at least C_step P0 + 0.05** (vision must still buy calculability) | B41 | Target change. The 0.80-0.92 band was set on 11-11d runs with no contracts and another PALL kit (0.847). With contracts, a decision's value depends on where the sites are; the oracle sees every site, the PALL stand-in only those its Tracker shows within 2 hops and the types Pathfinder shows; PALL holds more contracts (4.1 against 3.4 per run), so more of its decisions are site decisions [source: report 11-11f]. P0 held its value (0.691 -> 0.683) and PALL is still above it by 0.06; C_route PALL 0.161 passes with margin. The relative clause keeps the owner's point ("the best path is easy to compute" with more vision) [stated: expedition.md 11.1]. Measured 0.743 passes both clauses | target (team) |
| 6 | B42 definition (expedition.md 11.1) | PALL minus PALL without the vision entries (scout, cartographer, old_hand) | PALL minus PALL without the vision entries **and with the camp's vision perks unavailable** (Region Charts, Tracker, Guide, Spyglass not offered); same points | B42 (P2) | The measured "Quartermaster 2 only" cell bought Charts in 86 % and the Tracker in 96 % of runs, so both cells held the same vision (completion -0.3 pp) and the win gain (+12.7 pp) was the PALL cell's Ember (91 % against 15 %) [source: report 11-11f]. With the perks unavailable the points go to contracts, supplies and the Ember in both cells, and the difference measures vision. No engine change: the sim's prep option list drops the four perks in that cell | target (definition) |
| 7 | B12 clauses (balance.md 2, B12; MIN_SPEED_MAX) on expedition runs | median <= 0.70 × B11 and <= 30 min, from run start | median <= 0.70 × B11 (unchanged, whole run) and <= 30 min **counted from SET_OUT** (the start camp's PACE_PREP_S 60 s not counted); sample: at least 200 wins | B12 | Target change. The start camp is a fixed minute every expedition run pays and no route can skip (src/engine/summary.js adds PACE_PREP_S per prep); the 30-minute cap was set on the classic map, which has no camp [source: changes-m2-v4.md row 16, D39]. The ratio clause, which carries "noticeably faster" [stated: BRIEF], keeps counting the whole run. Measured 30.6 min (n = 86) -> about 29.6 from SET_OUT, ratio 0.70 [source: report 11-11f]. Rows 1-3 add about 15-30 s to the speedrunner (loot windows, Delves) [inference], so the result may sit at the edge; hence 200 wins (700 runs per class) | target (team) |
| 8 | SPELL.beastcall_horn.cd (rules 5, Lost Technique II, hunter; PALL only) | 12 rounds | **15 rounds** (+25 %, inside TUNE_LIMIT) — **gated**: applied only if planner PALL on the expedition stays >= 50 % with it | B6 PALL (both maps) | The PALL hunter leads on both maps: classic 68.6 % against rogue 58.0 and mage 55.0; expedition 57.3 % against 42.0 and 40.3 [source: report 11-11f]. Classic records: hunter boss win given reach **71.5 %** against 62.6 / 61.3 at the same boss ilvl (50.4 / 50.2 / 49.8), reach 95.9 against 92.7 / 89.7, dungeon clears 3.5 against 2.4 / 1.7; P0 hunter is not ahead (32.0 %) [source: 11-11f run records]. So the edge is a hunter PALL boss-fight edge, and the hunter's PALL-only entries are Ricochet Bolt and Beastcall Horn; Beastcall is a free full pet heal or revive plus a 2-round taunt every 12 rounds (about three uses in a 36-round boss fight). Expected hunter PALL -3 to -6 pp, B6 PALL spread 13.6 -> 8-11 pp [assumption: unmeasured; the attribution arm (PALL hunter without sp_h2) tells whether Beastcall is the source]. If the attribution arm moves the hunter by less than 3 pp, the row is void and the report names the hunter's PALL win by entry removed (sp_h1, sp_h2) | data (gated) |

Count: 8 rows. 2 new constants (rows 1-2: one-line multipliers on existing draws), 2 constant changes (rows 3-4), 1 data value (row 8, gated), 3 target rows (5-7). Every row except 8 touches expedition runs only. Designer rows beyond TUNE_LIMIT: 1, 2, 3 (back to its spec value), 4. Not changed, on purpose:
- **Contract rewards** (CONTRACT_REWARD_CHOICES, the tables of v10 A3): contracts already pay rare-or-epic choices at the zone's rim level and complete 61 % (B39 passes); the gap is the item count from kills and dungeons, not the contract reward.
- **Appendix P potion drops**: see "Appendix P" below.
- **Dimming front and grace** (DIM_GRACE, DIM_FRONT_*): a faster front shortens zones for every bot and costs B11 and gear; row 4 prices the encounter, not the front.
- **XP_WEIGHT_MULT**: confirmed at 1.4 (below); lowering it to fix B20 would cost levels at the boss, which the flip needs.

### Expected package result [inference: estimated effects added, not measured together]
| Check | v10 (11-11f) | Expected v11 |
|---|---|---|
| Planner P0 win (expedition, 900 runs) | 15.4 % (19.1 % with D2) | **21-25 %** (19.1 + rows 1-3 +2 to +5 + row 4 +0.3 to +0.8) |
| Planner PALL win (expedition, 900 runs) | 46.6 % | **49-54 %** (rows 1-3 +2 to +5; D2 value 0 to +2; row 8, if applied, -1 to -2) |
| Boss ilvl / rare share, planner P0 | 46.5 / 0.45 | 48-49 / 0.49-0.53 |
| Dungeons cleared per run, planner P0 | 0.46 | 0.7-0.9 |
| Delves taken / completed, planner P0 | 0 / - | 0.6-1.0 per run / 35-40 % |
| B39 planner P0 / PALL / greedy | 61.4 / 73.4 / 8.1 % | 57-63 / 68-74 / under 12 % (Delves complete less than Culls) |
| B40 planned - none / - random | +8.7 / +1.6 pp | +9 to +13 / +3 to +6 pp (D2 value: +12.3 / +5.2 measured) |
| B41 C_step P0 / PALL | 0.683 / 0.743 | about the same; row 5 band: pass |
| B43 caught / Dimmed share / greedy close calls | 28.6 / 22.0 / 55.8 % | 15-19 / 13-16 / 50-60 % |
| B11 / B12 (from SET_OUT) / B53 | 44.0 / 30.6 (29.6) / 17.0 min | 44.5-45.5 / 29.5-30.2 / 17-18 min |
| B46 | 9.5 % | 9-11 % (Delve XP back) |
| B6 PALL spread, classic (row 8 applied) | 13.6 pp | 8-11 pp |

PALL is the criterion most likely to stay short. If cell 3 measures PALL under 50 %, cell 10 runs the stronger loot arm (EXPED_DROP_MULT 1.9, the kill ratio 96 / 51) before anything else changes.

## Exact behaviour
- **Row 1.** In an expedition run, every item-chance and junk-chance draw of a normal or dungeon-trash kill (rules 8.4) uses `min(1, chance × EXPED_DROP_MULT)` (× GRIND_DROP_MULT as well on a Grind node). The draws themselves are made as today (one item draw, one junk draw per kill), so the stream `loot` moves only where a roll succeeds that did not before. Elites, rare elites, dungeon bosses, treasure, quest and contract rewards: unchanged. Dimmed encounters drop nothing (6.3). Classic runs: unchanged (EXPED_DROP_MULT not applied).
- **Row 2.** At a dungeon clear in an expedition run, the boss rolls EXPED_DUNGEON_BOSS_DROPS times on "Dungeon boss" (src/engine/damage.js loop bound). Relics of the Deep's unique draw applies per roll as today. Classic: DUNGEON_BOSS_DROPS 2.
- **Row 3.** Constant only (the board's price label and the bots' value per point follow). Autoplay's start camp (engineer-11f default 12) takes the board's contract for zones 1-3 whatever its kind, as today.
- **Row 4.** Constant only. The fight costs 2 tolls of zone time; the front check after the fight uses the new zone time (as today with 1). Text to update: expedition.md 6.3 and 13, rules 1.9.6. The "dims in N" label needs no change (it counts tolls to the node's dimAt), and the pace table has no minutes change (tolls, not seconds).
- **Rows 5-7.** Target and definition text: expedition.md 11.1 (B41, B42) and 13 (C_STEP_PALL); balance.md B12 and MIN_SPEED_MAX note. Not edited in this commit: they are folded in when the Lead accepts D95-D97 (as v9 row 5 and v10 C3).
- **Row 8.** SPELL.beastcall_horn.cd 15, only if the gate passes (cell 9). Tooltip follows the data.

## Confirmed or dropped (task item 6 and the open designer items)
| Item | Decision | Basis |
|---|---|---|
| **C1** XP_WEIGHT_MULT | **Confirm 1.4** (D88 arm 1.5 closed) | Both values miss B20 (exits 12 / 22 / 32 / 43 / 52 at 1.4; 12 / 23 / 33 / 43 / 53 at 1.5) and 1.5 only raises them, with win -0.6 pp (-3.4 - 2.3) [source: report 11-11f]. Exits are set by how long the planner stays in a zone now that it prices the Dimming as measured; row 4 shortens stays slightly. B20 is P2 and stays a reported miss; lowering XP to fix it would cost levels at the boss |
| **B4** DUNGEON_DIM_HOLD | **Keep for one read, then final** | The v10 rule could not be read: no planner took a Delve, so "drop" came from a proxy (dungeons entered 0.37 against 0.34, win -0.6 pp) [source: report 11-11f]. Row 3 brings Delves back; arm 9c reads it once. Final rule: keep if Delve completion with the hold is at least 8 pp above the arm; otherwise drop the rule (the Engineer removes it in the next engine pass). No further arm either way |
| **B40** random part | **No row** | The D2 value (SIM.POTION_VALUE 30) is set; its arm measured +5.2 pp (2.2 - 8.2) [source: report 11-11f]. Read again in cell 4 |
| **B7** hunter 0.59 | **No row** | Beastbond 19.0 % (16.7 - 21.5) against 0.60 × 32.0 = 19.2 %: a 0.2 pp miss inside the interval [source: report 11-11f]. A Wildcraft trim would lower the P0 hunter, already the weakest class on the expedition (10.7 % against 19.7 / 16.0); a Beastbond lift raises the PALL hunter (row 8's problem). Cell 11 re-reads the three hunter trees at 3 000 runs each; if the point stays under 0.60, the Lead logs it as a known miss until meta v2 (BACKLOG) redoes the trees |
| **B1** greedy 18.2 % (classic) | **No row** | 0.2 pp over, interval 16.8 - 19.6; the classic map stops being the default at the flip (O6). On the expedition the greedy wins 0.2 % (reaches the boss 3.2 %): that, not 18.2 %, is the greedy's next problem (BACKLOG) |
| **B32** runs 1-5 37.3 % (classic) | **No row** | A classic-map campaign row; after the flip the campaigns run on the expedition, where planner P0 wins 15-25 %, so runs 1-5 fall into or under the 15-35 band. The owner's meta v2 (hard first runs, BACKLOG) redesigns the curve. Re-measure B31 / B32 on the expedition with the 8.2 catalogue (flip criterion 3) |

## Appendix P (potion drops): not in v11
The owner's default (O5) is to build appendix P after the flip. It is not brought forward:
- **It does not target the gap.** The expedition's boss win sits on the classic map's gear line (section "Where the gap is"); potions used are already 8.9 per run against 7.0-8.6 on the classic map. The camp measure points the same way: banning Field Draughts (2 potions) and buying the Ember instead gained +3.7 pp [source: report 11-11f, D2 arm].
- **It is not a one-line change.** A new stream `potion(z, id)`, four drop hooks, bag overflow to the loot window, the mage's Mana Draught share, Alchemist's Notes' upgrade, and both maps' B25 economy; rows 1-2 are one multiplier each on existing draws.
- Expected effect when built: B25 into its band on the classic map, +1 to +3 pp win [inference, v10 appendix P]. If v11 leaves the win rates short by about 1 pp, appendix P is the next candidate, measured as one arm (O7).

## What the sim must run
Engine: main with rows 1-4 (two new constants, two values) on the Engineer's build or the sim's scratch copy with switches; row 8 as a switch (gated). Sim: B42 cell definition (row 6), B12 clock from SET_OUT (row 7; the run record has the prep minute), B41 band (row 5). SIM.POTION_VALUE 30 (D2, already set). Seeds 1000 onward, paired by class and seed with 11-11f. Node-risk tables: the 11-11f v9 observations; completion `ct` and `dim` tables from cell 1 (the `dim` table must be relearned: row 4 changes what a Dimmed encounter costs). Default trees as 11-11f. Wall time from 11-11f on 2 workers (expedition about 250 ms per run, a 900-run cell about 2 min; classic 26-38 ms per run): about 42 minutes. Run in this order; cut from the bottom.

| # | Cell | Runs | Checks | About |
|---|---|---|---|---|
| 1 | Table pass: package, planner P0 and planner PALL stand-in | 100 per class each | `ct` and `dim` tables for every later cell | 1.5 min |
| 2 | Package, planner P0, planned prep | 300 per class (900) | **flip 2 (P0)**, B39, B43, B46, B11, B53, B14, B15, B17, B20, gear at the boss, dungeons and Delves per run, Delves abandoned per run | 2 min |
| 3 | Package, planner PALL stand-in | 300 per class (900) | **flip 2 (PALL)**, B39 PALL, B3 (expedition), B6 PALL (expedition) | 2 min |
| 4 | Package, planner P0, prep `none` and `random` | 300 per class each | B40 both parts (paired with cell 2) | 4 min |
| 5 | Package, greedy P0 | 300 per class | B39 greedy, B43 close calls, B1 greedy (expedition, report) | 1.5 min |
| 6 | Package, speedrunner PALL | 700 per class | B12 both clauses (row 7; at least 200 wins), B3 speedrunner (expedition) | 4.5 min |
| 7 | B41: planner P0 `--oracle --route`; PALL stand-in with the oracle | 50 per class each | C_step, C_route (row 5 band) | 3 min |
| 8 | B42 (row 6): PALL stand-in without the vision entries and with the camp's vision perks unavailable | 150 per class | B42 both parts (paired with cell 3) | 1 min |
| 9 | Arms, planner P0 planned, 300 per class each: (a) TIME_DIM_FIGHT 1 (package without row 4); (b) TIME_DIM_FIGHT 1 with DIM_DMG_MULT 1.6 (row 4's arm); (c) without DUNGEON_DIM_HOLD (B4 read); (d) rows 1-2 off (EXPED_DROP_MULT 1, boss drops 2): the loot rows' measured effect | 900 each | row 4 rule, B4 rule, rows 1-2 effect | 8 min |
| 10 | Conditional, only if cell 3 PALL < 50 % or cell 2 P0 < 20 %: EXPED_DROP_MULT 1.9, planner P0 and PALL | 300 per class each | flip 2 with the stronger loot arm | 4 min |
| 11 | Classic, hunter: planner P0 each hunter tree (3 000 each); planner PALL hunter default tree with row 8, and without sp_h2 (attribution), 1 000 each; expedition planner PALL hunter with row 8, 300 | as listed | B7 (re-read), row 8 gate and attribution, B6 PALL classic | 2 min |
| 12 | Classic regression: planner P0 and PALL default trees, 1 000 per class | 6 000 | the package leaves the classic map unchanged (rows 1-4 are expedition-only) | 1 min |
| - | Hash identity: classic rows runs (24) and expedition runs without `prep` (24) against 11-11f | 48 | rows 1-4 touch only expedition runs; expedition goldens move by design (rows 1-2 change `loot`) | < 1 min |

Decision rules:
- **Row 4:** keep TIME_DIM_FIGHT 2 if cell 2 has B43 two parts in band and the third within 2 pp. Otherwise take arm 9b if it does. If neither, take the one with the smaller caught-zones share and report both; in no case raise DIM_PACK_SIZE or speed the front in this pass.
- **Row 3 (abandon guard):** if cell 2 abandons more than 0.25 Delves per run by hub swaps, the price returns to 2 and the report says so; otherwise keep 1.
- **B4:** as in "Confirmed or dropped" (cell 2 against arm 9c, Delve completion, 8 pp).
- **Row 8 gate:** apply if cell 3 with row 8 (cell 11 expedition hunter folded into the pooled PALL rate) stays >= 50 % and the attribution arm moves the classic PALL hunter by at least 3 pp; else void and report.
- **Cell 10:** if run, report it beside the package; EXPED_DROP_MULT 1.9 is adopted only if it brings the missing criterion in and B11 stays <= 48 min.

Report: the 11-11f expedition tables with a v11 column; the flip criteria table; per-row measured effects (rows 1-2 from arm 9d, row 4 from arm 9a); the row 4, row 3, B4 and row 8 decisions.

## Flip criteria: which rows meet them
Criteria as changes-m2b-v10.md "Criteria to flip".
| Criterion | Failing on 11-11f | v11 rows that, if they pass, meet it |
|---|---|---|
| 1. B40 random part | +1.6 pp | none needed: the D2 value (+5.2 pp measured); read in cell 4 |
| 1. B41 | C_step PALL 0.743 | row 5 (band; the measured value passes) |
| 1. B43 | 28.6 % / 22.0 % | row 4 (or its arm) |
| 1. B12 | 30.6 min | row 7 (from SET_OUT; at least 200 wins) |
| 2. Winnable | P0 15.4 % (19.1), PALL 46.6 % | rows 1-3 (rows 4 and D2 add a little); cell 10 if short |
| 3. Nothing breaks | 8.2 entries not in the catalogue, B31 not re-measured, ui-regress not run | **no v11 row**: Engineer (8.2 entries into C.META), Sim (B31 on that catalogue), QA (ui-regress A and M) |

If rows 1-7 pass as expected, criteria 1 and 2 are met on the v11 build and the flip waits only on criterion 3's engineering and QA steps.

## Proposed decisions (for the Lead to log)
| # | Decision | Owner |
|---|---|---|
| D91 | EXPED_DROP_MULT 1.6: kill loot follows the expedition's fight weight (row 1) | team |
| D92 | EXPED_DUNGEON_BOSS_DROPS 3 (row 2) | team |
| D93 | Delve price back to 1; guard: price 2 returns if hub swaps abandon > 0.25 Delves per run (row 3) | team |
| D94 | TIME_DIM_FIGHT 2, arm DIM_DMG_MULT 1.6 by the cell 9 rule (row 4) | team |
| D95 | B41 C_step PALL 0.70-0.92 and >= C_step P0 + 0.05 (row 5) | team (target) |
| D96 | B42 measured with the camp's vision perks unavailable in the no-vision cell (row 6) | team (definition) |
| D97 | B12 absolute cap counted from SET_OUT on expedition runs; at least 200 wins (row 7) | team (target) |
| D98 | Beastcall Horn cooldown 15, gated (row 8); C1 1.4 confirmed; B4 one final read; no rows for B7, B1 greedy, B32 (classic residue) | team |
| O7 | Appendix P stays after the flip (owner default O5), unless v11 leaves a win-rate criterion short by about 1 pp; then it is the next arm. Default: as written | owner, default applies |
| O8 | Classic-map residue (B1 greedy 18.2 %, B7 0.59, B32 runs 1-5 37.3 %) is accepted, not tuned, since the classic map stops being the default at the flip. Default: accept | owner, default applies |

## Constants
New or changed by this package (expedition.md 13 unless stated).

| Constant | Old | New | Unit |
|---|---|---|---|
| EXPED_DROP_MULT (new; rules 8.4) | - (1) | 1.6 (conditional arm 1.9) | × item and junk chance of normal and dungeon-trash kills, expedition runs |
| EXPED_DUNGEON_BOSS_DROPS (new; rules 8.4) | - (DUNGEON_BOSS_DROPS 2) | 3 | rolls at a dungeon clear, expedition runs |
| CONTRACT.delve.price | 2 | 1 | points |
| TIME_DIM_FIGHT | 1 | 2 (arm: 1 with DIM_DMG_MULT 1.6) | tolls |
| C_STEP_PALL (B41) | 0.80-0.92 | 0.70-0.92 and >= C_step P0 + 0.05 | share |
| B42 no-vision cell | vision entries removed | vision entries removed, camp vision perks unavailable | definition |
| MIN_SPEED_MAX (balance.md, B12), expedition runs | 30 min from run start | 30 min from SET_OUT | min |
| SPELL.beastcall_horn.cd (rules 5), gated | 12 | 15 | rounds |
| XP_WEIGHT_MULT | 1.4 (arm 1.5) | 1.4 (confirmed) | × |
