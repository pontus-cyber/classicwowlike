# Spec changes M2b v10: expedition tuning for the switch-over (start camp, contracts, the Dimming)

Owner: Lead Game Designer, 2026-11-11. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), Lead. **Status: draft.** Proposed decisions D82-D90 (team) and owner items O5-O6; hand-off docs/handoffs/designer-2026-11-11e.md.

Scope: expedition runs with the start camp (`newRun({ mapMode: 'expedition', prep: true })`). No row changes the classic map, the free potion, the pet revive or the v9 package (changes-m2b-v9.md stays pending as written; the two packages touch different constants and can be built together).

Input: the fog-bot measure [source: docs/reports/balance-2026-11-11d.md, docs/handoffs/sim-2026-11-11d.md], the start camp and contracts measure [source: docs/reports/balance-2026-11-11e.md, docs/handoffs/sim-2026-11-11e.md], the engine defaults [source: docs/handoffs/engineer-2026-11-11f.md section 4], the owner's potion idea [stated: docs/feedback/2026-11-11-1401-owner.md]. Where a figure says "11-11e run records", the designer read the per-run files of that pass (sim/out/exp-2026-11-11e/*/runs-*.jsonl in the sim worktree, blocks `ct`, `ex`, `death`) with a scratch script; nothing was re-simulated.

When the Engineer builds this package, every changed line in expedition.md, rules.md (1.9) and engine-api.md is marked "(M2b v10)" in the same commit as the code.

## The misses and their causes

| Miss (11-11e) | Value | Band | Cause (basis) | Rows |
|---|---|---|---|---|
| B46 contract XP share, planner P0 | 6.1 % | 8-20 % | Contract XP takes the level-difference modifier against CL_c = 10z - 5, the zone's middle, while the player completes contracts late in the zone at 10z - 3 or above (diffMod 0.7 at -3, 0.3 at -5). Effective multiplier on contract XP: **0.51** (planner P0), 0.35 (planner PALL), 0.36 (Dimming off). With diffMod 1 the same completions would give 11.9 % (8.0 % without zone 6, where level 60 pays nothing) [source: 11-11e run records]. The retired story chain had no diffMod (rules 2.1) | A1, A2 |
| Gear at the boss, planner P0 | item score 352, ilvl 45.6, rare-or-better 0.42 | classic map 403 / 49.8 / 0.57 | Two parts. (1) Fewer fights: the story chain on the expedition map already gave only 360 / 46.8 / 0.48 (11-11d, 28 fights against 51); the 9.5 budget weighted XP × 1.6 per fight but not loot. (2) Contracts complete 2.3 per run against the chain's six rare choices, and late zones least (zone 4-6 completion 33 / 29 / 27 %) [source: 11-11e run records] | A1-A3, C1 |
| B39 Delve completion | 14 % P0, 23 % PALL (Dimming off: 42 %) | (overall 45-65 / 65-85) | Delves are a third of the contracts the planner takes (609 of 1 847), because the 1-point Delve is the cheapest per point under the 0.90 prior; 202 are swapped away at hubs and 282 expire [source: 11-11e run records]. The dungeon costs 6 tolls, lies in ring 2-3 and often dims before the planner gets there; a Delve pays 1.0 × 1.6 levels-worth × about 0.5 diffMod | B1-B4, E-sim 1 |
| B39 overall | 42.5 % P0, 58.1 % PALL | 45-65 / 65-85 | Delves as above; without Delves P0 is at 52 % (11-11e). Late zones complete least because contract XP is worth little there (row A1 cause) | A1, B1-B4 |
| B40 planned minus random prep | -2.7 pp | >= +2 pp | The planner's prep column (expedition.md 10.2) buys contracts, the Tracker and the Second Clapper only. Random prep buys the Ember (20 % of runs), Field Draughts and Region Charts and takes 3.8 contracts against the planner's 6.2, of which it completes 2.3 | D1-D2 |
| B43 caught zones / Dimmed death share, planner P0 | 7.2 % / 2.6 % | 8-18 % / 5-20 % | The planner's model prices a Dimmed encounter at a death chance of 0.08 × (1 + depth) (SIM.EXP_DIM_DEATH, prototype stand-in). Measured: **0.9 %** per encounter for the planner (2 deaths in 216 encounters), 19.5 % for the greedy (130 in 666, mostly deeper) [source: 11-11e run records]. The planner fears the edge of the dark about nine times too much, so it leaves before the front | C2 |
| B44 tolls without / with the Dimming | 1.05 | >= 1.5 | The default planner's zone is bounded by its time weight and the boss term (projected Ascendancy), not by the Dimming: 19.5 tolls per zone with the Dimming off against 17.8 with it [source: 11-11e run records]. The 1.5 bound came from the prototype planner, which had no boss term and wandered for 84 minutes [source: expedition.md 12.2; report 11-11d note 2] | C3 (target) |
| B20 exit levels, B14 / B15 | 11 / 22 / 32 / 42 / 53; 33 nodes / 29 fights | 10z ± 1; 44-56 / 34-42 | XP_WEIGHT_MULT 1.6 gives 2-3 levels over 10z, so the planner outgrows each zone's content after about 5.5 resolved nodes [source: report 11-11d note 2] | C1 |

Passing and to be kept: B11 42.4 min (40-50), B12 29.2 min = 0.69 × B11, B53 15.3 min (<= 21), B41, B45, B47, B43 greedy close calls 71.7 %.

## Change table (the package)

Type: **rule** = engine code; **number** = constant; **data** = data-table value; **bot** = simulator value (sim/, no engine change); **target** = balance target.

| # | Constant or rule (spec section) | Old | New | Target | Expected effect, with basis | Type |
|---|---|---|---|---|---|---|
| A1 | Contract XP modifier (expedition.md 3.1) | `xpFrac × XP_WEIGHT_MULT × xpToNext(CL_c) × diffMod(CL_c - L)` | `xpFrac × XP_WEIGHT_MULT × xpToNext(CL_c)`, no level-difference modifier (as the retired story chain, rules 2.1); heat and meta XP modifiers still apply; nothing at MAX_LEVEL | B46; gear (late-zone chasing) | **Bound computed** on the 11-11e records: planner P0 share 6.1 % -> at most 11.9 %, at least 8.0 % (zone-6 contracts done at level 60 pay 0); planner PALL 6.4 % -> 14.8-18.3 %; greedy 5.0 % -> about 5.5 % (it is under-levelled, diffMod is near 1). Indirect, unmeasured: zone 4-6 contracts are worth two to three times more to the planner, so it chases their sites (completion 27-33 % there) | rule |
| A2 | CONTRACT_CL_OFFSET (3.1, 13) | 5 (CL_c = 10z - 5) | 8 (CL_c = 10z - 2) | gear at the boss; B46 | Reward items at the zone's rim level: contract rare ilvl 10z - 1 (was 10z - 4), epic 10z + 1; zone 6 rare 59, epic 61. XP base xpToNext(CL_c) +83 % in zone 1, +22 % in zone 3, +13 % in zone 5, so B46 about +1 to +2 pp on top of A1 [inference: xpToNext ratios weighted by today's completions]. Gold V(CL_c) up by the same order (CULL_GOLD_V unchanged). Unmeasured on gear | number (+60 %, designer row) |
| A3 | Drop tables `contract` and `bounty` (3.1, 13): CONTRACT_RARE_W / CONTRACT_EPIC_W; BOUNTY_RARE_W / BOUNTY_EPIC_W | 80 / 20; 60 / 40 | 65 / 35; 40 / 60 | gear at the boss; item score | Chance that a choice of 3 holds at least one epic: Contract 0.49 -> 0.73, Bounty 0.78 -> 0.94 [computed: 1 - rare share³]. Rare-or-better share unchanged per item (all are rare or epic); item score up by the epic budget on about 0.5 more items per run [inference: 2.3 completions per run today, more after A1/B]. Unmeasured | data |
| B1 | DELVE_XP_FRAC (3.1, 13) | 1.0 | 1.5 | B39 Delve | With A1 a Delve pays 2.4 levels-worth at full value against about 0.8 today (1.6 × 0.51) [computed from the A1 multiplier]; about a Cull's 3.2 minus the dungeon's own clear XP, which the Delve adds to. Unmeasured alone | number (+50 %, designer row) |
| B2 | CONTRACT.delve.price (2.2, 13) | 1 | 2 | B39; B40 | The start camp stops buying the Delve as the cheapest contract per point and swapping it away (202 of 609 Delves abandoned, 0.83 per run) [source: 11-11e run records]. Expected Delves taken per run 2.0 -> about 1, completion of the rest higher (they are the ones the planner means to play). Board weights CW_* unchanged | number |
| B3 | EXPED_TIME_DUNGEON (rules 1.9.8, expedition.md 9.5) | 6 tolls | 5 tolls (the classic map's TIME_DUNGEON) | B39 Delve; gear | A dungeon is three fights and two boss rolls (85 % rare, 15 % epic) for 5 tolls. Planner P0 enters 0.26 dungeons per run (0.79 with the Dimming off) [source: 11-11e run records]; expected 0.4-0.6 with B1-B4 [inference]. Run tolls -1 per dungeon entered | number (-17 %, inside TUNE_LIMIT) |
| B4 | New rule: **the dungeon holds out** (expedition.md 6.2; rules 1.9.6). DUNGEON_DIM_HOLD | none | The zone's Dungeon node dims DUNGEON_DIM_HOLD = 3 tolls later than its hops give: `dimAt(dungeon) = DIM_GRACE + ceil(hops × DIM_FRONT_TIME / DIM_FRONT_HOPS) + DUNGEON_DIM_HOLD`. Its "dims in N" label and the Dimming heat state (H.5) use this value. The front's spread through other nodes is unchanged (the dungeon is not a gap the front walks around) | B39 Delve | The Dimming cost Delves 28 pp (42 % off, 14 % on) [source: report 11-11e]. A dungeon 2 hops from the Shardfall dims at 14 instead of 11, one 4 hops away at 19 instead of 16. Expected Delve completion 14 % -> 30-40 % with B1-B3 [inference: between the Dimming-on and Dimming-off values]. Fiction: the dungeon's walls hold the dark out a while. Arm: package without B4 | rule (small: one node's dimAt) |
| C1 | XP_WEIGHT_MULT (rules 1.9.8, expedition 9.5, 13) | 1.6 | 1.4 (arm: 1.5) | B20; B14 / B15; gear | Exit levels about -1 (11 / 22 / 32 / 42 / 53 -> about 10 / 21 / 31 / 41 / 52, inside 10z ± 1) [inference: -12.5 % XP per node, about 1.2 levels per zone at today's 5.5 nodes]. The planner outgrows the zone's content later, so it resolves +0.5 to +1 node per zone: B14 and B15 +3 to +6, more quest reward choices, more drops. B11 +2 to +4 min (42.4 -> about 45-46) and run tolls +5 to +10 (B17 band 125-155; boss Ascendancy may reach +2 %) [inference: about 45 s per added node, about 3 tolls]. Contract XP scales with it, so A1's share holds. Expedition runs only | number (-12.5 %, inside TUNE_LIMIT) |
| C2 | SIM.EXP_DIM_DEATH (bots' model of a Dimmed encounter, sim/lib/params.mjs; expedition.md 12.1 stand-in) | 0.08 × (1 + depth), fixed | Learned: the risk table gets a node kind `dim` keyed by depth (0, 1, 2+), refreshed as the other kinds (SIM_RISK_REFRESH); prior **0.02** × (1 + depth) | B43 caught zones and Dimmed death share | Measured 0.9 % per encounter for the planner (2 / 216) and 19.5 % for the greedy (130 / 666) [source: 11-11e run records]. The prototype showed the caught share follows this price (0.08 -> 0.05 moved the planner from 15 % to 20-28 % caught) [source: expedition.md 12.2]. Expected planner P0 caught zones 7.2 % -> 10-16 %, Dimmed share of non-boss deaths 2.6 % -> 5-12 % [inference: about 2 encounters per run at 1-3 % death each against 0.26 non-boss deaths per run]. No rules change. If the share stays under 5 %, the rules lever is DIM_PACK_SIZE 2 -> 3 (cell 10) | bot |
| C3 | B44 definition (expedition.md 11.1; balance.md 3) | planner P0 zone tolls, Dimming off / on, >= 1.5 | **heat-seek** planner P0 (time weight × HEAT_SEEK_TIME_MULT 0.5, H.6) zone tolls, Dimming off / on, >= THREAT_BOUND_MIN 1.5. The default planner's ratio stays in the report as a diagnostic, no target | B44 | The Furnace and the boss term already end the default planner's zone (1.05, Dimming off 19.5 tolls); its zone can only reach 1.5 if the Dimming cuts zones to about 12 tolls, which would cost B11 (about 35 min) and gear. The owner's intent is that something chases the player who stays [stated: docs/feedback/2026-11-10-1006-owner.md]; the player who stays is the one who ignores the clock. Unmeasured: the heat-seek planner was never run on the expedition map | target (team, P2) |
| D1 | Planner prep column (expedition.md 10.2) | contracts by completion × value per point; Tracker by completion gain; Second Clapper at BELL_KEEP_VALUE; buy while best > SIM.PREP_POINT_VALUE per point | One list of every option by value per point, bought best first while above SIM.PREP_POINT_VALUE: contracts (unchanged), Tracker (unchanged), Second Clapper (unchanged), and **supplies and the other perks** at the bot values of D2. A contract whose zone already has a held contract counts at SIM.PREP_SAME_ZONE_MULT 0.6 of its value (two contracts of one zone compete for the same tolls) | B40 | Random prep beats planned by 2.7 pp with the Ember, supplies and fewer contracts [source: report 11-11e]; the planner completes 2.3 of 6.2 contracts. Expected: planner buys Field Draughts in most runs, the Ember in some, 4-5 contracts. B40 planned minus random -2.7 -> +1 to +4 pp [inference: unmeasured; the differences are inside their intervals at 300 runs, so cell 3 runs 900] | bot |
| D2 | Bot values of the prep options (new SIM constants) | none (not bought) | SIM.PREP_VALUE = draughts 2 × SIM.POTION_VALUE (45) = 90; rations 3 × 15 = 45; ember SIM.EMBER_VALUE 320; mule 20; charts: EST_CHARTS_GAIN 0.05 × the held contracts' value (as the Tracker); guide: EST_GUIDE_GAIN 0.05 × the same; spyglass: EST_SPYGLASS_GAIN 0.03 × the same. Per point at today's prices: draughts 90, ember 80, rations 45, mule 20 | B40 | [assumption] starting values. Basis: the prototype's completion gains (Charts 56 -> 61 %, Tracker 56 -> 77 %) [source: expedition.md 12.2]; the Ember is a resurrect charge usable in the end-boss fight (rules 9: Second Breath is not, the Ember is next in the order), so it is worth more than its 30 V vendor price; a Healing Draught before the first vendor (none in ring 1) is worth more than its 1.5 V price. Calibrated by cell 9: if forcing an option changes the planner P0 win rate by more than its interval, the Sim Engineer sets its value from that difference and reports it | bot |

Count: 13 rows. 2 rules (A1, B4), 4 numbers (A2, B1, B2, B3, C1: five constants), 1 data row (A3), 3 bot rows (C2, D1, D2), 1 target row (C3). Inside TUNE_LIMIT: B3, C1. Designer rows beyond it: A2 (+60 %), B1 (+50 %), B2 (+100 %), A3. Not changed, on purpose:
- **CULL_XP_FRAC 2.0, BOUNTY_XP_FRAC 2.5**: A1 and A2 lift contract XP to the band without them; raising them on top would push B20 back up.
- **DIM_GRACE 6, DIM_FRONT_HOPS 2 / DIM_FRONT_TIME 5, node tolls**: the planner is not caught because it overprices the encounter (C2), not because the front is slow. A faster front shortens zones for a time-aware planner and costs B11 (42.4 min, floor 40). Fallback arm DIM_GRACE 5 in cell 10.
- **CW_CULL / CW_BOUNTY / CW_DELVE, CONTRACT_SLOTS, swap rules**: B2 removes the reason to buy and swap Delves; the swap stays as the spec has it.

### Expected package result [inference: estimated effects added, not measured together]
| Check | 11-11e | Expected v10 |
|---|---|---|
| B39 planner P0 / PALL / greedy | 42.5 / 58.1 / 6.2 % | 47-55 / 62-70 / under 15 % |
| B39 Delve, planner P0 | 14 % | 30-40 % |
| B40 planned - none / planned - random | +4.3 / -2.7 pp | +4 to +8 / +1 to +4 pp (the second may stay under 2 pp) |
| B42 vision value: completion | +8.2 pp | +9 to +12 pp (A1 makes late sites worth finding) |
| B43 caught / Dimmed death share / greedy close calls | 7.2 % / 2.6 % / 71.7 % | 10-16 % / 5-12 % / 70-75 % |
| B44 heat-seek (new definition) | not run | 1.2-1.8 (unknown; first measure) |
| B46 planner P0 | 6.1 % | 9-12 % |
| B20 exits | 11 / 22 / 32 / 42 / 53 | about 10 / 21 / 31 / 41 / 52 |
| B14 / B15 | 33 / 29 | 36-39 / 31-34 |
| B11 / B53 | 42.4 / 15.3 min | 44-47 / 16-17 min |
| Gear at the boss, planner P0 | 352 / 45.6 / 0.42 | 370-390 / 47-48 / 0.47-0.52 |
| B1 planner P0 win (expedition) | 12.7 % | 15-20 % (classic 32 %) |

The gear and win-rate rows will most likely stay under the classic map. If they do after this package, the next lever is the loot side of the 9.5 budget: an expedition loot weight on the item chances of normal and dungeon trash kills (as XP_WEIGHT_MULT does for XP), then a guaranteed contract reward per zone. That is the next package, not this one.

## Exact behaviour
- **A1.** `completeContract` (src/engine/contracts.js) pays `round(xpFrac × xpWeight × xpToNext(CL_c) × (1 + xpPct))`, then rested is not applied (it is not a kill) and heat applies as today; 0 at MAX_LEVEL. expedition.md 3.1 line "XP uses the player's level at completion for diffMod" becomes "Contract XP has no level-difference modifier (M2b v10)". The prep board's reward line and contractView show this amount.
- **A2.** Constant only. Every place that uses `contractLevel(z)` follows: XP base, gold V(CL_c), the item level of the reward choices.
- **A3.** DROP_TABLE.contract and DROP_TABLE.bounty weights. The heat rarity step (H.3) still applies to them (an epic stays epic).
- **B1, B2, B3.** Constants only. B2 changes the board's price label and the bots' value per point.
- **B4.** `dimAt(node)` adds DUNGEON_DIM_HOLD for the zone's Dungeon node only, in the engine's Dimmed test, `mapView` ("dims in N"), `heatView.dimIn` and the autoplay map policy's tests (1.9.9). The front formula and every other node are unchanged; the Shardfall is never a Dungeon (4.3 step 5). A Delve held on a Dimmed dungeon expires as today when the zone is left. Classic map: not affected.
- **C1.** Constant only (expedition runs).
- **C2.** Sim only: `risk.mjs` observations gain kind `dim` with depth buckets 0, 1, 2+ (deaths per Dimmed encounter); the model reads the table with the prior 0.02 × (1 + depth) and COMPLETION_SHRINK-style shrinkage (SIM.RISK_SHRINK as the other kinds). SIM.EXP_DIM_HP 0.30 stays until the recorder gives the HP lost per encounter, then learned the same way.
- **C3.** balance.md 3 B44 and expedition.md 11.1 B44 row read: "Threat bounds the zone: heat-seek planner P0 zone tolls with the Dimming off, divided by with it on (diagnostic cell). Default planner: reported, no target." THREAT_BOUND_MIN unchanged.
- **D1, D2.** expedition.md 10.2 planner Prep cell (text in the hand-off of the build); constants in sim/lib/params.mjs SIM block with the values above.

## Engine and simulator defaults (task item 5)

### Engine defaults (engineer-2026-11-11f section 4)
| # | Default | Decision |
|---|---|---|
| 1 | Each prep option once per run | **Confirmed.** Supplies do not stack; 2.3 reads "each once per run" (M2b v10). Stacking would let 10 points buy 10 draughts, which turns the start camp into a vendor |
| 2 | Cartographer, Old Hand, Quartermaster read from `profile.unlocks`, not in `C.META` until the switch-over | **Confirmed.** They enter the catalogue (8.2) in the flip commit; B31 is measured again then |
| 3 | Bounty elite: a zone rare of the target family, else any zone rare | **Confirmed** as a fallback. Content adds the missing family rares (engineer-11f section 5 list) before the flip; until then the board text names the elite, not the family |
| 4 | Bounty sites never use the Trainer or an existing site; a completed Bounty's other node gets its original elite back | **Confirmed** |
| 5 | Cull site without a mob of the family: a zone normal of the family replaces the last mob, else an earlier one, first that keeps 7.14; else unchanged | **Confirmed**. An unchanged encounter still counts as a site (the mark is the rule, the family is flavour) |
| 6 | Hub contract only before the zone's first LEAVE_HUB | **Confirmed** (3.6 "taken before LEAVE_HUB") |
| 7 | `swap` needs `contractId` | **Confirmed**: the action is `TAKE_HUB_CONTRACT(mode, contractId)`; expedition.md 1 and 3.6 updated |
| 8 | A Delve shows its dungeon's type while held or complete | **Confirmed** |
| 9 | A Grind site counts at its first wave won | **Confirmed** (3.3 says so; one wave on this map) |
| 10 | REROLL_BOARD replaces slot by slot from `prep(k + 1)` | **Confirmed** |
| 11 | Board draw order: kind, region, family (always), the Bounty's elite; extra slots draw their zone first | **Confirmed** |
| 12 | Autoplay's start camp: Field Draughts, one contract for each of zones 1-3 in board order, 2 points Reserve; its map policy does not seek sites | **Confirmed** for the switch-over. With B2 a zone's Delve costs 2: autoplay takes the board's contract for the zone whatever its kind and keeps AUTO_PREP_RESERVE |

### Simulator assumptions (sim-2026-11-11d and -11e)
| Assumption | Value | Decision |
|---|---|---|
| SIM.PREP_POINT_VALUE | 60 per point | **Confirmed.** A kept point buys about a third of a hub contract and 2 Echoes; 60 sits between the value per point of a good Cull and of rations |
| SIM.EST_TRACKER_GAIN | 0.20 | **Confirmed** (prototype +21 pp); the completion table replaces it once it has Tracker cells |
| SIM.CONTRACT_CHOICE_GEAR | 1 / 1.3 / 1.5 / 1.65 for 1-4 choices | **Confirmed** [assumption, standard best-of-n roll gain] |
| SIM.HUB_SWAP_MARGIN | 50 | **Confirmed** |
| SIM.COMPLETION_SHRINK | 20 | **Confirmed** |
| EST_COMPLETE prior (expedition.md 13) | cull 0.55 / bounty 0.50 / delve 0.90 | **Changed** to 0.55 / 0.45 / **0.35** (measured 55 / 40 / 14 %; delve set above 14 % for B1-B4). The table is refreshed from the package's own table pass (cell 1), not carried from 11-11e |
| SIM.EXP_UNDER_LEVEL_VALUE | 150 per level under 10z | **Confirmed** (1.5 × VAL_XP) |
| SIM.EXP_DIM_DEATH / EXP_DIM_HP | 0.08 × (1 + depth) / 0.30 | **Changed** (row C2): learned by depth, prior 0.02; HP stays 0.30 until recorded |
| Contract value at the start camp (report 11-11e reading 1) | XP at CL_c, items against an uncommon of that level | **Confirmed**; with A1 the XP term drops diffMod (the bots' model must follow the engine) |
| Site chance on unseen nodes (reading 2) | as written | **Confirmed** |
| "Keeps Bell charges" (reading 4) | Second Clapper at BELL_KEEP_VALUE per charge | **Confirmed** (40 per point: not bought at 60; the Bell already passes B47) |
| Random prep (reading 5) | TAKE_CONTRACT and BUY_PREP, no rerolls; hub contract once per zone at 50 % | **Confirmed** |
| Completion table key (reading 6) | (kind, Tracker held, zone), abandoned counted out | **Confirmed** |
| Greedy threat rule timing (11-11d reading 1) | "dims within 2 tolls of arrival" = of the end of the node's content | **Confirmed** (the engine checks the Dimming then) |
| Greedy on the expedition (11-11d question) | threat rule only; wins 0.0-0.7 % | **Changed**: the greedy adds the engine's clean-escape test (rules 1.9.9 step 3: enter only a node that is not Dimmed when its content ends and leaves a Road reachable without a Dimmed step). A human sees "dims in N"; the one-step greedy did not. The greedy band (B1 8-18 %) stays; report it against the rows map too |
| PALL stand-in (11-11e) | rows catalogue + Quartermaster 2, Cartographer, Old Hand as unlocks + `vision: { pathfinder }` | **Confirmed** until the flip puts them in the catalogue |

## What the sim must run

Engine: main with A1, A2, A3, B1-B4, C1 (rules and constants) on the Engineer's build, or on the sim's scratch copy with switches (A1 and B4 are a few lines each). Sim: C2, D1, D2, the EST_COMPLETE prior and the greedy's clean-escape test. Seeds 1000 onward, paired by class and seed with 11-11e. Risk table: sim/out/pass-2026-11-11c observations plus the cell-1 completion and `dim` tables. Default trees as 11-11e. Wall time from 11-11e (300-run planner cell about 45 s on 2 workers): about 40 minutes; run in this order and cut from the bottom.

| # | Cell | Runs | Checks | About |
|---|---|---|---|---|
| 1 | Table pass: package, planner P0 and planner PALL (full stand-in) | 100 per class each | completion table `ct` and `dim` table for every later cell | 1.5 min |
| 2 | Package, planner P0, planned prep | 300 per class | B39, B43, B46, B11, B53, B14, B15, B17, B20, B45, B47, gear at the boss, B1 (expedition) | 2.5 min |
| 3 | Package, planner P0, prep `none` and `random` | 300 per class each | B40 both parts (paired with cell 2; 900 runs give about ±2.5 pp) | 5 min |
| 4 | Package, planner PALL full stand-in, and Quartermaster 2 only | 300 per class each | B39 PALL, B42, B3 (expedition) | 4 min |
| 5 | Package, greedy P0 | 300 per class | B39 greedy, B43 close calls, B1 greedy (clean-escape rule) | 1.5 min |
| 6 | Package, speedrunner PALL | 300 per class | B12, B3 speedrunner (expedition) | 1.5 min |
| 7 | B44: heat-seek planner P0 with the Dimming on and off; default planner P0 with the Dimming off | 150 per class each (seeds 1000-1149) | B44 (new) and the diagnostic | 5 min |
| 8 | Arms, planner P0 planned: (a) C1 at 1.5; (b) without B4; (c) A1 alone on 11-11e rules | 300 per class each | C1 and B4 decision rules; A1's share of B46 | 7.5 min |
| 9 | Prep calibration, planner P0: planned + forced Ember; planned + forced Field Draughts | 300 per class each | D2 values (paired with cell 2) | 5 min |
| 10 | Conditional arms, only if cell 2 misses: DIM_PACK_SIZE 3 (Dimmed share < 5 %); DIM_GRACE 5 (caught < 8 %) | 300 per class | B43 | 2.5 min each |
| 11 | B41 with prep: planner P0 `--oracle --route` and PALL with the vision stand-in | 50 per class each | C_step, C_route still in band | 3 min |
| - | Hash identity: rows runs and expedition runs without `prep` (48 runs, as 11-11e) | 48 | the package touches only prep runs | < 1 min |

Decision rules:
- **C1:** keep 1.4 if cell 2 has B11 <= 48 min and B20 inside 10z ± 1 in at least four zones; else take 1.5 (arm a) if it does; else report both.
- **B4:** keep the hold if Delve completion in cell 2 is at least 8 pp above arm b; else drop the rule (it is code for nothing).
- **D2:** an option whose forced arm moves the planner P0 win by more than the paired interval gets its value set from the difference (report the value used); otherwise keep the starting value.

Report: the 11-11e tables with a v10 column, per-row measured effects (A1 from arm c), the C1 and B4 choices, and the D2 values.

## Criteria to flip prep and the expedition map to the default
Flip (engineer-2026-11-11f section 3, steps 1-3; step 1 is done) when, on the package build:
1. **P1 expedition rows pass:** B39 planner P0 and PALL inside their bands and greedy at least 8 pp under (point estimates; an interval that crosses an edge is reported, not a fail); B40 both parts on the point; B41 all four; B43 at least two of its three parts with the third within 2 pp; B11 40-50 min, B12, B53.
2. **The run is winnable on the new map:** planner P0 win at least 20 % (the B1 floor) and planner PALL at least 50 % (5 pp under the B3 floor), each at 900 runs.
3. **Nothing breaks:** qa/engine, qa/sim (leak test with prep), ui-regress parts A and M pass; the meta entries of 8.2 are in the catalogue; B31 measured again.

P2 rows (B42, B44, B45, B46, B47) are reported and do not block. If 1 and 3 pass and 2 does not, the flip waits for a win-rate (loot) package; the owner can still play the expedition through the preview setting (owner item O6).

## Appendix P: potions from enemies, bosses and treasure chests (draft, owner idea)

**Status: draft, owner idea** [stated: docs/feedback/2026-11-11-1401-owner.md]. Not in the package's measured rows: it needs new engine draws, and the package is already about one measured pass. Proposed for the pass after the flip.

Today potions come from vendors (unlimited stock), the Packed Satchel (3 at start) and, in expedition runs, Field Draughts (2 per point). Planner P0 uses 7.2 potions per run on the classic map (B25 8-20, P3, FAIL) [source: docs/reports/balance-2026-11-11c.md] and 6.3 on the expedition with prep [source: 11-11e run records]; the expedition has no vendor in ring 1 and fewer vendors overall.

| Source | Potion drop | Constant | Per run, planner P0 expedition [inference: 11-11e counts] |
|---|---|---|---|
| Normal mob kill | chance 0.03 | POTION_DROP_MOB | about 43 kills × 0.03 = 1.3 |
| Elite kill (rare elite: × 2) | chance 0.25 | POTION_DROP_ELITE | about 1.6 elites × 0.25 = 0.4 |
| Dungeon boss (not the end boss) | 1 guaranteed | POTION_DROP_DUNGEON_BOSS | 0.3-0.6 (with B3-B4) |
| Treasure chest | chance 0.50 | POTION_DROP_TREASURE | about 2 chests × 0.5 = 1.0 |
| End boss | none: the run ends at the kill | | 0 |
| Total | | | **about 3 per run** |

- **Which potion:** a Healing Draught; for the mage (the only class with mana) a Mana Draught at POTION_DROP_MANA_SHARE 0.3. With Alchemist's Notes (meta) a dropped Healing Draught is a Greater Healing Draught.
- **Stream:** a new stream `potion(z, id)` per node, so no draw on `loot` moves (classic and expedition goldens keep their item drops). Heat does not change potion drops.
- **Bag:** potions stack to STACK_POTION 5 per slot, as bought ones; a potion that does not fit goes to the loot window like any drop (discard choice), never lost silently. No new bag rule.
- **Vendors:** unchanged prices and stock. The bots' vendor rule (buy up to SIM POTION_COUNT) buys fewer, so gold goes to gear: about 3 × PRICE_HEAL_V 1.5 V = 4.5 V per run [inference].
- **Both maps:** proposed for both (the owner's playtests are on the classic map); on the classic map, with about 51 fights per run, the same rates give about 4-6 per run [inference: more kills and treasure nodes per run].
- **Expected effect:** B25 into its band on the classic map (7.2 -> about 10); B1-B3 +1 to +3 pp from fewer potion-dry deaths and more gold for gear [inference: unmeasured]. Field Draughts lose some value at the start camp; D2's value follows the measure.
- **Measure (when built):** one cell per map, planner P0 and speedrunner PALL, 300 per class, against the same seeds: B25, potions used and held at the boss, gold spent on potions, B1, B3.
- Owner item **O5**: rates about 3 potions per expedition run (4-6 on the classic map) and none from the end boss. Default without an answer: build at these rates after the flip.

## Proposed decisions (for the Lead to log)
| # | Decision | Owner |
|---|---|---|
| D82 | Contract XP has no level-difference modifier (A1) | team |
| D83 | CONTRACT_CL_OFFSET 8 and contract / bounty tables 65/35 and 40/60 (A2, A3) | team |
| D84 | Delve: DELVE_XP_FRAC 1.5, price 2, EXPED_TIME_DUNGEON 5 (B1-B3) | team |
| D85 | The dungeon holds out: DUNGEON_DIM_HOLD 3 (B4), kept by the cell-8 rule | team |
| D86 | XP_WEIGHT_MULT 1.4, or 1.5 by the cell-8 rule (C1) | team |
| D87 | Bots learn the Dimmed encounter risk by depth (C2); greedy uses the clean-escape test | team |
| D88 | B44 measured on the heat-seek planner; default planner diagnostic (C3) | team |
| D89 | Planner prep buys supplies and perks at bot values, calibrated by cell 9 (D1, D2) | team |
| D90 | Engine defaults 1-12 of engineer-2026-11-11f confirmed; flip criteria of this file | team |
| O5 | Potion drops (appendix P): rates and no end-boss drop. Default: build after the flip at these rates | owner |
| O6 | Before the flip, the owner plays the expedition with the start camp through the build's preview setting; the default map stays classic until the flip criteria pass. Default: as written | owner |

## Constants
New or changed by this package (expedition.md 13 unless stated).

| Constant | Old | New | Unit |
|---|---|---|---|
| Contract XP modifier (3.1) | diffMod(CL_c - L) | none | rule |
| CONTRACT_CL_OFFSET | 5 | 8 | levels above the band start (CL_c = 10(z-1) + 8) |
| CONTRACT_RARE_W / CONTRACT_EPIC_W | 80 / 20 | 65 / 35 | weight |
| BOUNTY_RARE_W / BOUNTY_EPIC_W | 60 / 40 | 40 / 60 | weight |
| DELVE_XP_FRAC | 1.0 | 1.5 | of xpToNext(CL_c) |
| CONTRACT.delve.price | 1 | 2 | points |
| EXPED_TIME_DUNGEON (rules 13) | 6 | 5 | tolls |
| DUNGEON_DIM_HOLD (new) | - | 3 | tolls added to the Dungeon node's dimAt |
| XP_WEIGHT_MULT | 1.6 | 1.4 (arm 1.5) | × XP per fight and node, expedition runs |
| EST_COMPLETE cull / bounty / delve (bots) | 0.55 / 0.50 / 0.90 | 0.55 / 0.45 / 0.35 | prior completion |
| SIM.EXP_DIM_DEATH (bots) | 0.08 × (1 + depth), fixed | learned by depth; prior 0.02 × (1 + depth) | death chance per Dimmed encounter |
| SIM.PREP_SAME_ZONE_MULT (bots, new) | - | 0.6 | × value of a second contract of one zone |
| SIM.POTION_VALUE / SIM.EMBER_VALUE (bots, new) | - | 45 / 320 | value units |
| SIM.PREP_VALUE rations / mule (bots, new) | - | 45 / 20 | value units |
| EST_CHARTS_GAIN / EST_GUIDE_GAIN / EST_SPYGLASS_GAIN (bots, new) | - | 0.05 / 0.05 / 0.03 | completion gain prior |
| B44 policy (balance.md 3) | default planner | heat-seek planner (default planner diagnostic) | target |
| Appendix P (draft, owner idea; not in the package): POTION_DROP_MOB / _ELITE / _DUNGEON_BOSS / _TREASURE / POTION_DROP_MANA_SHARE | - | 0.03 / 0.25 / 1 / 0.50 / 0.3 | probability or count |
