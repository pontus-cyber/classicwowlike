# Balance spec (M0 task 0.3)

Owner: Lead Game Designer. Status: draft for Lead review, 2026-11-09; M2 v4 changes 2026-11-10 (marked "(M2 v4)"); M2 v5 changes 2026-11-10 (marked "(M2 v5)"); M2b v6 changes 2026-11-11 (marked "(M2b v6)", docs/specs/changes-m2b-v6.md).
Audience: Simulation & Balance Engineer (sim/), Playtest & QA Lead, Lead.

Every target is checked by the headless simulator running src/rules.js. All target numbers are named constants in section 6. Rules references (e.g. "rules 7.9") point to docs/specs/rules.md.

---

## 1. Bots

All bots use the same engine and the autoplay combat policy (rules 7.9) unless stated. A bot's own decisions draw from a bot stream `hash(runSeed, "bot")`, never from game streams, so game streams stay identical across bots for the same seed.

| Bot | Map and node choices | Talents and bar | Economy | Time profile |
|---|---|---|---|---|
| random | Uniform over legal actions (lanes, grind waves 1-3, rewards, TRAVEL_ON when legal at 50 %) | Random legal talent each point; bar = known spells in learn order | Equips if item score is higher; trains with 50 % chance per known spell at a trainer; buys nothing | manual |
| greedy | Picks the node with the highest immediate value per hour (value function 1.1), no lookahead; travels on at exit level only if no remaining reachable node beats GREEDY_STAY_THRESHOLD | Fixed default build per class and profile group (default tree, 1.3; M2 v5: was the tree with the highest B5 win rate); bar by template 1.2 | Trains everything at each hub; keeps HEAL_STOCK_TARGET Healing Draughts | manual |
| planner | Full path search over the visible zone map (at most 3^8 paths) maximising the value function 1.1 over the remaining zone, including rest timing and the travel-on point | Build per class/tree from 1.3 (default tree: 1.3, M2 v5); bar template 1.2, swaps to the boss bar at Camp | As greedy, plus buys an Ember of Return when affordable and gold after it >= EMBER_RESERVE_V × V | manual |
| speedrunner | Path search minimising hours to reach the zone exit level; TRAVEL_ON as soon as legal; Camp grind only to reach 60 | As planner | Trains at hubs only; buys Healing Draughts to HEAL_STOCK_TARGET; no vendor nodes | autoplay |
| tactician | As planner | As planner | As planner | manual |

The tactician stands in for a skilled manual player who reads the intents (rules 7.1, 10.3). Each player turn it applies, in order (M2 v2):
1. **Telegraph rules** (first match wins; all in every fight, including the end boss):
   - T1 Big hit: if the damage the intents announce for this round (heavy abilities, casts it cannot interrupt this turn, Litany 2/2, Gravity Crush, Starless Pulse) would leave the player below TACTICIAN_SAFE_HP of max HP, use the first that stops or absorbs it: an interrupt or stun-tagged spell on its source (if the source's hit is interruptible), a defensive-tagged spell that is not active, a healing item on the item bar.
   - T2 Shards: in boss phase 2 with >= 2 living Shards, cast a usable aoe-tagged spell (not for the Rogue: Whirling Edges breaks its builder/finisher cycle and measured -6 pp boss wins; the Rogue skips this clause) (M2 v3); with 1 living Shard whose HP is below the player's expected damage of one action, attack that Shard.
2. **Otherwise**, in non-boss fights the search below; in the end-boss fight the autoplay policy (rules 7.9), which the search played worse [source: docs/reports/balance-2026-11-09.md, diagnostic cell tactician-P0-bossAuto].

Search: for each legal action, simulate TACTICIAN_DEPTH rounds ahead on cloned state with autoplay continuation over TACTICIAN_SAMPLES sampled seeds (cloned streams, not the live stream) and pick the action with the best mean of `(enemy HP removed, summoned adds weighted TACTICIAN_ADD_WEIGHT) - TACTICIAN_HP_WEIGHT × (own HP lost) - TACTICIAN_DEATH_PENALTY × deaths`. (M2 v2)

### 1.1 Value function (greedy, planner)
`value(node) = XP_in_levels × VAL_XP + expected item-score gain × VAL_GEAR + gold / V(L) × VAL_GOLD - hours × VAL_HOUR × hourMult - P(death) × VAL_DEATH`. hourMult = 1 for the greedy; PLANNER_HOUR_MULT for the bots with lookahead (planner, tactician, and the speedrunner's tie-breaks), which see that hours past BOSS_TIME_PAR raise boss Ascendancy (rules 1.7); the speed route style multiplies on top (STYLE_SPEED_HOUR_MULT). (M2 v3) The planner-based bots also value the heat rewards and pay a boss term for projected Ascendancy (expedition.md H.6; sim 2026-11-11). PLANNER_HOUR_MULT 3: on the v6 rules it wins 2.1 pp more than 2 (34.8 against 32.7 %, paired, 1 000 runs per class; 0.2 - 4.1). (M2b v6)

Resurrect awareness (M2 v3): when a bot ranks a Shrine boon or decides whether it already holds a resurrect, it counts only charges usable at the end boss (Boon of Return, Ember of Return); Second Breath does not work there (rules 9). P(death) is estimated from the simulator's own running table of death rate by (node type, CL - L, HP fraction at entry), refreshed every SIM_RISK_REFRESH runs; before data exists use RISK_PRIOR by node type.

### 1.2 Bar template
Fill slots in this order with known spells: interrupt, main nuke/builder, finisher or second nuke, defensive, cleanse, AoE, then highest-damage remaining. At Camp the planner, speedrunner and tactician put interrupt and cleanse first.

### 1.3 Standard builds
For each class and tree: spend points to reach the capstone of the tree first (tier order, highest-rank talents first within a tier), then the remaining points by tier order in the class's other two trees alternately. This gives 9 builds (3 classes × 3 trees).

**Default tree (M2 v5).** Every bot except random plays one default tree per class and **profile group**: the P0 group (P0 and P10 cells, campaigns, P0 route styles and pets, the B5 tactician) and the PALL group (every PALL cell: planner, greedy, speedrunner, tactician, B26-B28 variants, PALL route styles). Each pass re-checks both: the P0 group from the B7 cells (planner P0, each tree, N_RUNS_PER_CELL per class); the PALL group from planner PALL cells with each tree (N_RUNS_PER_CELL per class, after the PALL warm-up), whose chosen-tree cell is the planner PALL cell. The **incumbent** (the group's default recorded in the simulator's parameters) stays unless another tree's win rate p_c beats the incumbent's p_i by more than the interval of the difference: `p_c - p_i > TREE_SWITCH_Z × sqrt(p_c(1 - p_c)/n_c + p_i(1 - p_i)/n_i)`. If several trees clear it, the highest win rate wins (equal rates: higher reach-the-boss rate). A switch updates the recorded default in the same commit as the report. Incumbents from 2026-11-10: P0 group rogue Venomcraft (2), mage Arcanism (2), hunter Marksmanship (1); PALL group rogue Shadowcraft (1), mage Arcanism (2), hunter Beastbond (0) [source: docs/specs/changes-m2-v5.md row 1]. Reason: on 11-10b the rogue's default flipped to Shadowcraft on a 1.9 pp gap inside both 95 % intervals and moved B16, B21 and B29 across their bands; and a player with the full catalogue plays a different best tree than a fresh one (rogue Shadowcraft +5.7 pp over Venomcraft at PALL, hunter Beastbond +11 pp over Marksmanship). (M2 v5)

B5 fallback (M2 v5): if the tactician on the P0-group trees puts B5 under its floor, the P0 tactician cell is re-run with, per class, the tree with the best B7 planner point estimate (no incumbent rule) and that cell counts for B1 tactician and B5; the report says so. Reason: the tactician plays Venomcraft worse than the planner (19.4 % against 23.1 %, package scratch), and a skilled manual player picks the tree where manual play pays. (M2 v5)

### 1.4 Meta profiles
| Profile | Contents |
|---|---|
| P0 | fresh, no unlocks |
| P10 | the first 10 entries of the standard purchase order |
| PALL | full catalogue |

Standard purchase order: satchel, vigor 1, edge 1, quick_study 1, pockets 1, ledger, scout, vigor 2, edge 2, sp_(class)1, cache, keen 1, quick_study 2, second_breath (when its requirement is met), then cheapest remaining first. (M2 v4: wayfinder removed from the catalogue)

Campaign: a planner profile plays consecutive runs from P0 and buys in the standard order whenever affordable (requirements are tracked).

---

## 2. Method

- Cells: class × bot × profile. N_RUNS_PER_CELL runs per cell, seeds `SEED_BASE + i`.
- Campaigns: N_CAMPAIGNS campaigns per class, each until the catalogue is complete or CAMPAIGN_MAX_RUNS runs.
- Report: one markdown table per metric with value, target, pass/fail, and 95 % interval (Wilson for rates, bootstrap for medians).
- A metric passes when its point estimate is inside the band. Tuning stops when all P1 metrics pass and at most 2 P2 metrics fail.
- Tuning authority: the Simulation & Balance Engineer may change any rules constant or data-table value by up to TUNE_LIMIT (relative) from its spec value without asking. Larger changes, new mechanics or removed mechanics go to the Lead Game Designer. Every change is listed in the sim hand-off with old value, new value and the metric it fixed.

---

## 3. Targets

Priority: P1 = must pass for M1 sign-off; P2 = should pass; P3 = report only.

### 3.1 Win rates
| ID | Metric | Target | How computed | Pri |
|---|---|---|---|---|
| B1 | Win rate on P0, per bot (all classes pooled) | random <= WR_P0_RANDOM_MAX; greedy WR_P0_GREEDY; planner WR_P0_PLANNER; speedrunner WR_P0_SPEED; tactician WR_P0_TACTICIAN | wins / runs | P1 |
| B2 | Win rate on P10 | planner WR_P10_PLANNER; random <= WR_P10_RANDOM_MAX | same | P1 |
| B3 | Win rate on PALL | random <= WR_PALL_RANDOM_MAX; greedy WR_PALL_GREEDY; planner WR_PALL_PLANNER; speedrunner WR_PALL_SPEED; tactician <= WR_PALL_TACTICIAN_MAX | same | P1 |
| B4 | Choices matter | planner - random >= CHOICE_GAP_MIN on P0 and PALL | difference of B1/B3 rates | P1 |
| B5 | Manual play matters | tactician - planner on P0 within MANUAL_GAP band (both bounds) | difference of B1 rates | P1 |

### 3.2 Class and strategy spread
| ID | Metric | Target | How computed | Pri |
|---|---|---|---|---|
| B6 | Class band | for planner on P0 and PALL: every class within ±CLASS_BAND_PP of the 3-class mean; max - min <= CLASS_SPREAD_MAX_PP | per-class win rates | P1 |
| B7 | Talent trees | per class, planner with each of the 3 standard builds: worst >= TREE_FLOOR_RATIO × best | per-build win rate, N_RUNS_PER_CELL each | P1 |
| B8 | Route styles | planner variants with a fixed style weight: quest-first, grind-first, elite/dungeon-first, speed, balanced (default). No dominant style (definition below) | per-style win rate and median minutes | P2 |
| B9 | Hunter pets | worst pet >= PET_FLOOR_RATIO × best pet (planner, P0) | per-pet win rate | P2 |
| B10 | Meta power cap | planner PALL win rate - P0 win rate <= META_GAP_MAX_PP and >= META_GAP_MIN_PP | difference | P1 |

**Dominant strategy:** within a group (talent builds of one class, route styles, pets), strategy X dominates if for every other Y in the group `winrate(X) >= winrate(Y) + DOM_MARGIN_PP` and `medianMinutes(X) <= medianMinutes(Y)`. Target: no group has a dominant strategy, on P0 and PALL.

### 3.3 Run length and pacing
| ID | Metric | Target | How computed | Pri |
|---|---|---|---|---|
| B11 | Median run length, normal | MIN_NORMAL_LOW - MIN_NORMAL_HIGH min, aim MIN_NORMAL_TARGET | planner, P0, runs that reach the boss; estSeconds with manual profile (rules 3) / 60 | P1 |
| B12 | Speedrun length (M2 v4) | median <= SPEED_RATIO_MAX × B11 median and <= MIN_SPEED_MAX min; p10 reported, no target | speedrunner, PALL, wins only, autoplay profile. The p10 clause is dropped: one bot policy has only luck as spread (p10 1.0 min under the median in three passes, fastest of 3 891 wins 26.1 min), so it measured bot variance; the median clauses bound speed | P1 |
| B13 | Speedrun played manually | median <= SPEED_MANUAL_RATIO_MAX × B11 median | speedrunner wins, manual profile | P2 |
| B14 | Nodes per run | planner NODES_NORMAL band; speedrunner NODES_SPEED band | entered nodes, excl. hubs and Camp services | P2 |
| B15 | Fights per run | planner FIGHTS_NORMAL band | fights incl. boss | P2 |
| B16 | Fight length (rounds, planner, wins) | normal encounter median ROUNDS_NORMAL band; elite ROUNDS_ELITE band; dungeon boss ROUNDS_DBOSS band; end boss ROUNDS_BOSS band | median rounds by fight kind | P1 |
| B17 | Hours at boss | planner median HOURS_NORMAL band; speedrunner HOURS_SPEED band; planner median Ascendancy <= ASC_MEDIAN_MAX; time budget (M2 v4): planner P0 median - planner PALL median <= META_TIME_BUDGET_H (rules 11.2) | hours at FIGHT_BOSS | P2 |

### 3.4 Character at the boss
| ID | Metric | Target | How computed | Pri |
|---|---|---|---|---|
| B18 | Level at boss | planner: share at 60 >= LVL60_SHARE_MIN; speedrunner median >= LVL_SPEED_MEDIAN_MIN | level at FIGHT_BOSS | P1 |
| B19 | Item level at boss | planner mean equipped ilvl ILVL_BOSS band; share of rare-or-better slots >= RARE_SHARE_MIN | equipped items at FIGHT_BOSS | P2 |
| B20 | Level vs zone | planner median level when leaving Zz in [10z - ZONE_LVL_SLACK, 10z + ZONE_LVL_SLACK] | level at TRAVEL_ON | P2 |

### 3.5 Deaths and risk
| ID | Metric | Target | How computed | Pri |
|---|---|---|---|---|
| B21 | Death location by stage (planner, P0) (M2 v3) | runs dying in Z1-Z2 <= DEATH_EARLY_MAX; in Z3-Z4 DEATH_MID band; in Z5-Z6 and Camp DEATH_LATE band; end boss DEATH_BOSS band | stage bands: share of all runs; boss: share of deaths | P1 |
| B22 | Death by node type (planner, P0, non-boss deaths) | no type > DEATH_TYPE_MAX; dungeon share DEATH_DUNGEON band | share | P2 |
| B23 | Boss phase reached on boss losses | phase 1 <= BOSS_P1_LOSS_MAX; phase 3 + enrage >= BOSS_LATE_LOSS_MIN | share of boss deaths | P2 |
| B24 | Close fights (M2 v3) | share of won non-boss fights whose lowest HP during the fight fell below CLOSE_FIGHT_HP: CLOSE_FIGHT band | planner, P0; lowest HP tracked over the fight (end HP hid the dips, since autoplay drinks at 35 %) | P2 |
| B38 | Tension per zone (M2 v3) | mean lowest HP in won non-boss fights, per zone: max - min over Z2-Z5 <= TENSION_SPREAD_MAX; Z6 <= TENSION_Z6_MAX | planner, P0 | P1 |
| B25 | Rests and potions | planner per run: rests (nodes + inn) REST_COUNT band; potions used POTION_COUNT band | counts | P3 |

### 3.6 Boss mechanics bite
| ID | Metric | Target | How computed | Pri |
|---|---|---|---|---|
| B26 | Interrupt matters | planner (PALL) with interrupt removed from the bar: win rate <= MECH_RATIO_MAX × normal | paired seeds | P1 |
| B27 | Cleanse matters | same with cleanse removed (no cleanse spell, no Tonic) | paired seeds | P1 |
| B28 | AoE matters | same with AoE spells removed | paired seeds | P2 |
| B29 | Enrage is reachable but rare | planner boss losses by Final Dark: ENRAGE_LOSS band | share of boss deaths | P2 |

### 3.7 Economy and meta
| ID | Metric | Target | How computed | Pri |
|---|---|---|---|---|
| B30 | Echoes per run | planner P0 mean ECHO_P0 band; wins ECHO_WIN band | summary | P1 |
| B31 | Runs to full catalogue | campaign median CAMPAIGN_RUNS band; no campaign under CAMPAIGN_RUNS_MIN_ANY | campaigns | P1 |
| B32 | Progress curve | campaign win rate over runs 1-5 WR_RUNS_1_5 band; runs 21-30 WR_RUNS_21_30 band; monotone non-decreasing by blocks of 5 runs within CURVE_DIP_PP, counting only blocks that hold at least CURVE_BLOCK_MIN_RUNS runs (all classes pooled) (M2 v4) | campaigns | P1 |
| B33 | Trainer affordability | planner hub visits where gold covers TRAIN_ALL: >= TRAIN_AFFORD_MIN | hub logs | P2 |
| B34 | Ember use | planner runs with an Ember bought by the boss: EMBER_BUY band | summary | P3 |

### 3.8 Engine health
| ID | Metric | Target | How computed | Pri |
|---|---|---|---|---|
| B35 | Determinism | 100 % identical final state hash on replay of seed + action log | QA_REPLAY_RUNS random runs replayed | P1 |
| B36 | No stuck states | 0 runs that end without SUMMARY or exceed MAX_ACTIONS_PER_RUN | all sim runs | P1 |
| B37 | Throughput | >= SIM_RUNS_PER_MIN_MIN runs per minute per core (autoplay, no rendering) | timing on the sim machine | P3 |

---

## 4. Reading the results
- If B11 fails high, shorten fights first (enemy HP), then node counts (ZONE_CHOICE_ROWS), never the manual round time constant (that one is checked in playtest).
- If B4 fails, choices are too flat: widen elite/dungeon reward and risk before touching class power.
- If B5 fails low, combat decisions do not matter: strengthen intents (heavy/cast frequency, mender heals) before raising damage. If it fails high, autoplay is too weak: improve 7.9 conditions.
- If B10 fails high, cut stat-rank values in the catalogue before item unlocks. Check the time budget too (B17, rules 11.2): time saved before the boss lowers Ascendancy, and on the 11-10 pass Wayfinder alone kept the PALL planner 12 h under the P0 planner and was worth about 12 pp at PALL in the M2 v4 package (removed in M2 v4). (M2 v4)
- Meta power budget (rules 11.2, M2 v3): a catalogue change that adds combat power must stay inside the budget; check B2, B3, B10 and B6 PALL after it. (M2 v3)
- B6 PALL and gold (M2 v5): gold buys power only through the vendors, so a class with more gold income (the hunter clears about 4 dungeons per PALL run against 0.4-0.9 for the others) converts every gold entry (Prospector) into more of it. Before pricing an expensive power item at a vendor, check how often each class can afford it (11-10b: the Starforged weapon, 35 400 copper, was bought in 72 % of hunter PALL runs, 18 % rogue, 9 % mage). (M2 v5)
- B3 greedy and speedrunner bands on PALL (M2 v4): the greedy wins 0.65-0.78 × the planner on P0 and PALL alike (its mage and hunter come within 1-6 pp of the planner at PALL; its rogue wins 8-12 % of its boss fights, likely because it has no Camp bar swap (1.2) [inference: planner rogue 69-77 % on the same seeds]), and the speedrunner loses more than the planner when meta power is cut, because it reaches the boss under BOSS_TIME_PAR anyway and gains nothing from lower Ascendancy. The bands follow those measured ratios around the planner's band. (M2 v4)
- B1 planner band and the hour weight (M2b v6): the band WR_P0_PLANNER (20-35 %) was set and checked with a planner that did not price Ascendancy and reached the boss at about 141 h with +8 % (as the owner's own runs, 148 h). It is kept: on the v6 rules the planner at PLANNER_HOUR_MULT 3 wins 34.8 % and the planner before the heat terms 34.9 % (paired, 1 000 runs per class), so the better bot no longer finds an easier game. On the v5 rules the same weight-3 planner won 48.1 %: there the band would have had to move, because the steep Ascendancy step (0.04) punished only slow play. Re-check B1 tactician, B5, B3 and B10 with weight 3 (every planner-based bot inherits it). (M2b v6)
- B21 and B38 (M2 v3): the planner avoids nodes its risk table rates deadly, so mid- and late-zone deaths stay a few % of runs by design; tension in zones 3-6 is measured by B38 (HP dips) and B24, deaths by share of runs. Tune B38 with ZONE_DANGER_STEP first. (M2 v3)

---

## 5. Open measurement notes
- PACE_MANUAL_ROUND_S (rules 3) = PACE_ROUND_ANIM_S + PACE_ROUND_DECIDE_S. PACE_ROUND_ANIM_S is a UI budget that QA checks with qa/browser/pace.mjs at the default animation speed (2.3-2.7 s measured at 1x on 5b3e929, above the budget); PACE_ROUND_DECIDE_S is an [assumption]. (M2 v2)
- Death-risk table (1.1) starts from RISK_PRIOR; report its final values with each balance pass.

---

## 6. Constant table

| Constant | Value | Unit |
|---|---|---|
| N_RUNS_PER_CELL | 2000 | runs |
| SEED_BASE | 1000 | seed |
| N_CAMPAIGNS | 50 | campaigns per class |
| CAMPAIGN_MAX_RUNS | 80 | runs |
| TUNE_LIMIT | 0.25 | relative change |
| GREEDY_STAY_THRESHOLD | 0.15 | value per hour |
| HEAL_STOCK_TARGET | 5 | potions |
| EMBER_RESERVE_V | 5 | × V |
| TACTICIAN_DEPTH | 3 | rounds |
| TACTICIAN_SAMPLES | 8 | seeds |
| TACTICIAN_HP_WEIGHT | 1.5 | × |
| TACTICIAN_DEATH_PENALTY | 100000 | points |
| TACTICIAN_ADD_WEIGHT | 0.3 | × (summoned adds' HP in the search score) | (M2 v2)
| TACTICIAN_SAFE_HP | 0.25 | of max HP | (M2 v2)
| VAL_XP | 100 | points per level |
| VAL_GEAR | 1 | points per item score |
| VAL_GOLD | 5 | points per V |
| VAL_HOUR | 6 | points per hour |
| VAL_DEATH | 2000 | points |
| PLANNER_HOUR_MULT | 3 | × VAL_HOUR (planner, tactician, speedrunner) | (M2 v3; M2b v6: was 2)
| SIM_RISK_REFRESH | 500 | runs |
| RISK_PRIOR | quest 0.005, grind 0.004 per wave, elite 0.03, dungeon 0.05, treasure 0.002 | probability |
| WR_P0_RANDOM_MAX | 0.03 | rate |
| WR_P0_GREEDY | 0.08-0.18 | rate |
| WR_P0_PLANNER | 0.20-0.35 | rate |
| WR_P0_SPEED | 0.10-0.25 | rate |
| WR_P0_TACTICIAN | 0.30-0.50 | rate |
| WR_P10_PLANNER | 0.32-0.48 | rate |
| WR_P10_RANDOM_MAX | 0.08 | rate |
| WR_PALL_RANDOM_MAX | 0.15 | rate |
| WR_PALL_GREEDY | 0.35-0.55 | rate | (M2 v4: was 0.30-0.50)
| WR_PALL_PLANNER | 0.55-0.75 | rate |
| WR_PALL_SPEED | 0.30-0.50 | rate | (M2 v4: was 0.40-0.60)
| WR_PALL_TACTICIAN_MAX | 0.90 | rate |
| CHOICE_GAP_MIN | 0.15 | rate difference |
| MANUAL_GAP | 0.08-0.25 | rate difference |
| CLASS_BAND_PP | 0.05 | rate difference |
| CLASS_SPREAD_MAX_PP | 0.08 | rate difference |
| TREE_FLOOR_RATIO | 0.60 | ratio |
| TREE_SWITCH_Z | 1.96 | z (95 % two-sided) for the default-tree switch, 1.3 | (M2 v5)
| PET_FLOOR_RATIO | 0.70 | ratio |
| META_GAP_MIN_PP | 0.20 | rate difference |
| META_GAP_MAX_PP | 0.45 | rate difference |
| DOM_MARGIN_PP | 0.10 | rate difference |
| MIN_NORMAL_LOW | 40 | min |
| MIN_NORMAL_HIGH | 50 | min |
| MIN_NORMAL_TARGET | 45 | min |
| SPEED_RATIO_MAX | 0.70 | ratio |
| MIN_SPEED_MAX | 30 | min |
| MIN_SPEED_P10_MAX | - (report only) | min | (M2 v4: was 25; B12 p10 has no target)
| SPEED_MANUAL_RATIO_MAX | 0.85 | ratio |
| NODES_NORMAL | 38-47 | nodes | (M2 v2: 7 rows per zone)
| NODES_SPEED | 28-37 | nodes | (M2 v2: 7 rows per zone)
| FIGHTS_NORMAL | 48-66 | fights | (M2 v2: 7 rows per zone)
| ROUNDS_NORMAL | 4-6 | rounds |
| ROUNDS_ELITE | 6-10 | rounds |
| ROUNDS_DBOSS | 8-13 | rounds |
| ROUNDS_BOSS | 30-45 | rounds |
| HOURS_NORMAL | 125-155 | h | (M2 v2: 7 rows per zone)
| HOURS_SPEED | 80-110 | h | (M2 v2: 7 rows per zone; M2 v4: was 70-100, +12 h because Wayfinder is removed and every TRAVEL_ON costs HOURS_TRAVEL)
| ASC_MEDIAN_MAX | 0.12 | fraction |
| LVL60_SHARE_MIN | 0.90 | share |
| LVL_SPEED_MEDIAN_MIN | 60 | level |
| ILVL_BOSS | 55-62 | item level |
| RARE_SHARE_MIN | 0.50 | share |
| ZONE_LVL_SLACK | 1 | levels |
| DEATH_EARLY_MAX | 0.12 | share of runs | (M2 v3: was 0.15 of deaths)
| DEATH_MID | 0.03-0.10 | share of runs | (M2 v3: was 0.20-0.35 of deaths)
| DEATH_LATE | 0.02-0.08 | share of runs | (M2 v3: was 0.20-0.35 of deaths)
| DEATH_BOSS | 0.55-0.80 | share of deaths | (M2 v3: was 0.25-0.45)
| DEATH_TYPE_MAX | 0.45 | share |
| DEATH_DUNGEON | 0.15-0.35 | share |
| BOSS_P1_LOSS_MAX | 0.25 | share |
| BOSS_LATE_LOSS_MIN | 0.40 | share |
| CLOSE_FIGHT | 0.04-0.12 | share | (M2 v3: was 0.05-0.15 at end HP < 20 %)
| CLOSE_FIGHT_HP | 0.35 | of max HP | (M2 v3)
| TENSION_SPREAD_MAX | 0.10 | HP fraction | (M2 v3)
| TENSION_Z6_MAX | 0.85 | HP fraction | (M2 v3)
| REST_COUNT | 6-12 | rests |
| POTION_COUNT | 8-20 | potions |
| MECH_RATIO_MAX | 0.60 | ratio |
| ENRAGE_LOSS | 0.05-0.20 | share |
| ECHO_P0 | 150-260 | Echoes |
| ECHO_WIN | 400-540 | Echoes |
| CAMPAIGN_RUNS | 25-40 | runs |
| CAMPAIGN_RUNS_MIN_ANY | 18 | runs |
| WR_RUNS_1_5 | 0.15-0.35 | rate |
| WR_RUNS_21_30 | 0.45-0.70 | rate |
| CURVE_DIP_PP | 0.05 | rate difference |
| CURVE_BLOCK_MIN_RUNS | 50 | runs in a 5-run block (pooled) for the B32 dip check | (M2 v4)
| TRAIN_AFFORD_MIN | 0.70 | share |
| EMBER_BUY | 0.30-0.70 | share |
| QA_REPLAY_RUNS | 1000 | runs |
| MAX_ACTIONS_PER_RUN | 20000 | actions |
| SIM_RUNS_PER_MIN_MIN | 200 | runs per minute |
