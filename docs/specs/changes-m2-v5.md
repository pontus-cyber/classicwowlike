# Spec changes M2 v5 (M2 task 2.3, design pass 2026-11-10b, the last before M2 closes)

Owner: Lead Game Designer. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), UI/UX Engineer, QA.
Every changed or new line in docs/specs/rules.md and docs/specs/balance.md is marked "(M2 v5)". Decisions D43-D46 in docs/DECISIONS.md. Problems 1-3 are the P1 misses of docs/reports/balance-2026-11-10b.md: 1 the rogue's default tree (B16 end boss, B21 Z1-Z2 and Z3-Z4; P2 B29), 2 B7 hunter, 3 B6 PALL.

Type: **number** = src/constants.js only; **mechanic** = engine code (exact behaviour below); **bot** = balance.md bot rule (sim/ change); **target** = balance.md band or metric.

## Evidence

Designer scratch copies of src/ and sim/ at main 074be82 (git-ignored sim/out/v5/*; src/ and sim/ unchanged). Every arm starts from the 11-10b pass's risk tables, as the sim's own experiments: P0 from warmup-P0.json (the B7 cells' table; the unchanged copy reproduces the pass's B7 cells exactly, e.g. rogue tree 1 25.0 %, tree 2 23.1 %), P10 from warmup-P10.json, every other P0 bot from obs-P0.json, PALL from obs-PALL.json (the unchanged copy reproduces the sim's PALL arms exactly: hunter tree 1 76.3 %, minus Prospector 68.0 %). Seeds 1000 onward, paired across arms. Sizes: 2 000 runs per class for the P0 and P10 planner cells, the PALL planner with each tree, the pets and the B5 tactician; 1 000 per class for the PALL greedy, speedrunner and B26-B28 variants and every exploratory arm; 50 campaigns per class. The scratch copy logs vendor purchases (gold per item per run) in its own recorder; no such field exists in sim/.

**Package** (rows 1-3 together, scratch `fin`): default-tree rule with the trees it selects, Beastbond +25 %, Starforged Arms removed.

## Change table

| # | Constant or rule | Old -> new | Problem | Evidence | Type |
|---|---|---|---|---|---|
| 1 | Default tree per class (balance.md 1.3); new TREE_SWITCH_Z | best planner P0 win rate, re-chosen every pass, one tree for every profile -> one default per class and profile group (P0 group: P0, P10, campaigns, P0 styles and pets, B5 tactician; PALL group: every PALL cell), chosen from that group's planner cells; the incumbent stays unless a tree beats it by more than TREE_SWITCH_Z = 1.96 × the standard error of the difference | 1, and 3 at PALL | 11-10b: rogue tree 1 25.0 % vs tree 2 23.1 % (2 000 each; the switch needs 2.65 pp) flipped B16, B21 and B29. Package P0 group (2 000 per class): rogue Venomcraft 23.1, mage Arcanism 25.4 (Pyromancy 25.6, needs 2.7 pp), hunter Marksmanship 25.4 %. PALL group (2 000 per class, incumbents P0 trees): rogue Shadowcraft 62.7 vs Venomcraft 57.0 (needs 3.0 pp: switch), mage Arcanism 63.6 (best), hunter Beastbond 65.2 vs Marksmanship 54.1 (switch) | bot |
| 2 | TALENT.h_a2.petDmgPct, h_a6.pct, h_a7.pct (Beastbond) | Ferocity 0.10 -> 0.125, Pack Leader 0.05 -> 0.0625, Savage Mastery 0.10 -> 0.125 (+25 %, TUNE_LIMIT) | 2 | sim candidate taken as measured: hunter trees 13.6 / 23.5 / 21.0 -> 20.6 / 25.4 / 23.4 % (B7 0.58 -> 0.81), reproduced exactly in the package. Hunter P0 (Marksmanship) +1.9 pp; B9 pets 24.5 / 21.0 / 18.6 % (0.76) | number |
| 3 | Starforged Arms (META.starforged) | 450 Echoes, class epic weapon ilvl 62 sold at the Camp vendor for the gear price (35 400 copper) -> entry removed; saved profiles keep the id with no effect (as D42) | 3 | Purchase log, PALL planner 11-10b trees: the hunter bought it in 72 % of runs (rogue 18 %, mage 9 %); hunter gold earned 133 300 per run against 97 700 rogue and 92 900 mage (about 4 dungeons cleared per run against 0.4-0.9). A hunter holding it won 91 % of its boss fights, without 50 %. Minus Starforged: hunter 76.3 -> 48.9 %, rogue 61.5 -> 63.6, mage 63.1 -> 62.5. Without Prospector the hunter still bought it in 51 % of runs (68.0 %): Prospector's 8.3 pp were this purchase. Package PALL (group trees, 2 000 per class): 62.7 / 63.6 / 65.2 %, spread 2.5 pp; Prospector is now worth 3.7 / 3.7 / 1.3 pp (rogue / mage / hunter, 1 000 per class) | mechanic |

Count: 3 rows. 1 number change, 1 mechanic change (an entry removed), 1 bot rule. No target changes. Catalogue total 7 010 -> 6 560 Echoes.

## Exact behaviour

**Row 1, default tree (sim/).**
- `SIM.DEFAULT_TREE` stays the P0-group incumbent: `{ rogue: 2, mage: 2, hunter: 1 }` (unchanged). New `SIM.DEFAULT_TREE_PALL = { rogue: 1, mage: 2, hunter: 0 }`. New BAL constant TREE_SWITCH_Z = 1.96.
- Stage A: the B7 cells stay as they are. Replace "best tree by win rate" with the switch rule: for each class, challenger t clears when `p_t - p_inc > TREE_SWITCH_Z × sqrt(p_t(1-p_t)/n_t + p_inc(1-p_inc)/n_inc)`; among those that clear, highest win rate (equal: higher reach-boss rate); none clears: incumbent. These trees run every P0 and P10 cell, the campaigns and the P0 route-style and pet cells, as now.
- Stage C: the PALL warm-up runs with `SIM.DEFAULT_TREE_PALL`; then planner PALL with each tree (N_RUNS_PER_CELL per class, from the warm-up table); the same rule with the PALL incumbents picks the PALL trees; the chosen-tree cell of each class is the planner-PALL cell (its observations become obs-PALL.json); greedy, speedrunner, random, the B26-B28 variants, the PALL route styles and the PALL tactician use the PALL trees. Compute: about 12 000 extra PALL runs (about 4 min on 2 workers at 21 ms per run).
- The report prints both tree sets and, per class and group, the incumbent, the best challenger, the gap and the threshold. A switch updates the recorded default in sim/lib/params.mjs in the same commit as the report.
- B6 P0 uses the P0-group trees; B6 PALL, B3 and B10 use the PALL-group trees. B7 is unchanged (P0, all three trees).

**Row 2 (src/constants.js).** `h_a2.petDmgPct 0.125`, `h_a6.pct 0.0625`, `h_a7.pct 0.125`. Talent text in the UI reads the table.

**Row 3, Starforged Arms removed (src/).**
- `META.starforged` is deleted. src/engine/nodes.js: the `starforged: r('starforged') > 0` flag goes (the rank helper reads `META[id].ranks`, as with Wayfinder). src/engine/map.js: the Camp vendor's Starforged branch goes; the Camp vendor stock is otherwise unchanged. No random draws are removed (the branch made none), so seeds replay as before for every profile without the entry.
- Saved profiles that own `starforged`: ignored, no effect, no refund (D42 handling). Requirement checks and the catalogue screen skip unknown ids already (D42).
- The three class weapons (u_weapon_rogue, u_weapon_mage, u_weapon_hunter) stay in src/content/uniques.js; content validation still expects 3 (rules 12.1). `makeUnique` keeps its weapon branch for a later use.
- Tests that name the entry change with it: qa/engine/s11-s12-meta-content.test.mjs (costs list; the Camp stock test that buys the weapon), qa/browser/ui-regress.mjs (catalogue row). UI: src/ui/ui-text.js and src/ui/meta.js lose the Starforged text and icon entries, if present.
- Sim: the standard purchase order (balance.md 1.4) ends with "cheapest remaining first", so it needs no edit; sim/lib/profiles.mjs's comment on catalogue requirements drops "starforged".

## Combined result (package, scratch)

Planner P0 and every P0-group check from the B7 cells with trees rogue 2 / mage 2 / hunter 1 (2 000 runs per class); PALL from the PALL-group trees rogue 1 / mage 2 / hunter 0.

| Check | 11-10b pass | Package | Band | Result |
|---|---|---|---|---|
| B6 PALL (planner) | 63.2 / 62.5 / 77.6 %, spread 15.1 pp | 62.7 / 63.6 / 65.2 % (2 000 per class), deviation 1.4, spread 2.5 pp | dev <= 5, spread <= 8 | pass |
| B7 hunter | 13.6 / 23.5 / 21.0 % (0.58) | 20.6 / 25.4 / 23.4 % (0.81) | >= 0.60 | pass |
| B16 end boss rounds | 46 | 42 (normal 5, elite 8, dungeon boss 11) | 30-45 | pass |
| B21 runs dying Z1-Z2 / Z3-Z4 / Z5-6 | 13.1 / 10.1 / 3.6 % | 11.2 / 4.3 / 4.3 %; boss 73.7 % of deaths | <= 12 / 3-10 / 2-8; 55-80 | pass |
| B1 planner / greedy / speedrunner / tactician P0 | 24.7 / 15.8 / 16.1 / 37.3 % | 24.6 / 16.0 / 19.8 / 33.1 % | 20-35 / 8-18 / 10-25 / 30-50 | pass |
| B5 tactician - planner P0 | 12.6 pp | 8.5 pp (tactician 19.4 / 47.1 / 32.9 %, 2 000 per class) | 8-25 | pass, 0.5 pp above the floor (D43 fallback) |
| B6 P0 | 25.0 / 25.6 / 23.5 % | 23.1 / 25.4 / 25.4 %, spread 2.4 pp | dev <= 5, spread <= 8 | pass |
| B7 rogue / mage | 0.62 / 0.95 | 0.62 / 0.95 (unchanged) | >= 0.60 | pass |
| B2 P10 planner | 36.7 % | 34.9 % (30.0 / 37.7 / 37.0) | 32-48 | pass |
| B3 PALL planner / greedy / speedrunner | 67.8 / 48.6 / 35.0 % | 63.8 / 40.1 / 42.2 % | 55-75 / 35-55 / 30-50 | pass |
| B10 PALL - P0 | 43.1 pp | 39.2 pp | 20-45 | pass |
| B11 / B12 / B13 | 46.2 / 29.6 / 37.2 min | 45.2 / 29.4 / 36.9 min | 40-50 / <= 30 and <= 0.7 × B11 / <= 0.85 × B11 | pass |
| B18 level 60 at boss | 100 % | 100 % | >= 90 % | pass |
| B26 / B27 / B28 ratios | 0.29 / 0.47 / 0.34 | 0.13 / 0.33 / 0.09 | <= 0.6 | pass |
| B30 Echoes per run / win | 224 / 432 | 237 / 435 | 150-260 / 400-540 | pass |
| B31 median / fewest runs to full catalogue | 28 / 22 | 26 / 20 | 25-40 / >= 18 | pass |
| B32 runs 1-5 / 21-30 / dip | 32.0 / 58.7 % / 0.0 pp | 26.8 / 52.2 % / 3.8 pp | 15-35 / 45-70 / <= 5 | pass |
| B38 tension spread / Z6 | 7.9 pp / 82.1 % | 5.3 pp / 83.9 % | <= 10 / <= 85 | pass |
| B29 Final Dark (P2) | 27.4 % | 18.0 % | 5-20 | pass |
| B22 quest share (P2) | 51.9 % | 46.4 % (dungeon 24.1 %) | <= 45 | fail (M4, D46) |
| B9 pets (P2) | 0.77 | 0.76 | >= 0.70 | pass |
| B17 hours P0 / PALL / speedrunner PALL (P2) | 141 / 140 / 102 h | 141 / 140 / 102 h | budget <= 5 h; 80-110 | pass |

Not re-measured: random cells (0 % throughout), the PALL tactician (75.2 % against an upper bound of 90 %; the package lowers PALL power), B8 route styles, B35-B37 engine health (0 errors in every scratch run). B19 and B20 unchanged (ilvl 49.9, exit levels 11, 22, 32, 43, 53; D40: M4).

## Notes

**Rejected for row 3 (all 1 000 per class, PALL, trees rogue 1 / mage 0 / hunter 1 unless noted).**

| Candidate | rogue | mage | hunter | Why not |
|---|---|---|---|---|
| control | 61.5 | 63.1 | 76.3 | |
| Prospector removed (sim) | 60.4 | 60.4 | 68.0 | spread 7.6, hunter deviation 5.1 pp; treats the multiplier, not the purchase |
| Starforged price × 1.25 / × 1.5 / × 2 | 62.8 / 63.3 / 63.7 | 62.6 / 62.5 / 62.5 | 71.1 / 66.9 / 56.7 | with Beastbond +25 % the PALL hunter's best tree is Beastbond, which at × 2 still wins 69.7 % (spread 6.4, deviation 4.1 pp); at × 2 rogues and mages never buy it (0 %), so it stays in the catalogue as a hunter-only item |
| Starforged free at Camp (epic 62 / rare 62 / rare 58 / rare 54 / uncommon 62) | 58.8 / 84.0 / 81.1 / 76.8 / 71.2 | 75.2 / 74.1 / 73.2 / 72.7 / 69.2 | 85.6 / 77.9 / 72.0 / 67.1 / 57.8 | puts the class weapon in every run: PALL planner 66-79 % (B10 needs about <= 69 %), spread 9.6-26.8 pp; the hunter's dependence on weapon damage makes any weapon grade swing it most |
| Starforged weapon damage at the rare grade (epic stats kept), price × 1 / × 1.5 (with Beastbond +25 %; rogue Shadowcraft, mage Arcanism, hunter Beastbond) | 65.9 / 63.8 | 64.6 / 63.6 | 79.9 / 73.3 | gold still decides who owns it |

**Bot artefact found on the way (sim follow-up, not a rules change).** The rogue's Camp bar (balance.md 1.2, "finisher or second nuke" by raw value) puts Severing Flourish ahead of Open Vein once weapon damage passes a threshold between 150 and 191 (24 of 24 sampled boss bars of rogues holding the epic weapon, 0 of 24 holding the rare-grade one). With Severing Flourish first, autoplay spends the combo points before Open Vein fires: rogues holding the Starforged epic (weapon damage 191) won 63-64 % of their boss fights, rogues holding the rare-grade version (150) 92-93 %. The greedy, which keeps its normal bar at Camp, shows the reverse (38 % with the weapon, 6 % without). Removing Starforged Arms removes the only item that reaches that weapon damage, so the package does not hit it, but the 1.2 template is sensitive to it; worth a sim look before M3 adds weapons (a rule such as "finishers whose autoplay condition is 'not on target' go before direct finishers").

**Observed, not changed.** At full catalogue the hunter's trees are 65.2 / 54.1 / 38.9 % (Beastbond / Marksmanship / Wildcraft) while at P0 Beastbond is the weakest; B7 is a P0 check, so this passes, but a full-catalogue hunter has one clear tree. The rogue's Shadowcraft remains the fastest-dying P0 path (its runs die in Z1-Z4 41 % of the time, boss fights 49 rounds) and is now only the PALL default; worth a look in M3. The tactician plays Venomcraft worse than the planner (rogue tactician 19.4 % against planner 23.1 %), which is what keeps B5 near its lower bound (D43 fallback: the tactician alone plays the rogue's best point-estimate P0 tree, Shadowcraft, where it won 28.5 % on 11-10b; B5 about 11.5 pp [inference: 11-10b rogue tactician cell with the package's mage and hunter cells]).
