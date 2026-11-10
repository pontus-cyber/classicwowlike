# Hand-off: Lead Game Designer, 2026-11-10b (M2 task 2.3: design pass v5, the last before M2 closes)

Spec only; src/ and sim/ unchanged. Change table and exact behaviour: docs/specs/changes-m2-v5.md. Decisions D43-D46.

## Summary
Three changes close the five P1 misses of docs/reports/balance-2026-11-10b.md, confirmed together in one scratch package:
1. **Default-tree rule (bot, D43).** One default tree per class and profile group (P0 group, PALL group); the incumbent stays unless beaten by more than 1.96 standard errors of the difference. P0 keeps rogue Venomcraft (the 1.9 pp Shadowcraft lead was noise), so B16, B21 and B29 pass again. PALL: rogue Shadowcraft, mage Arcanism, hunter Beastbond, chosen by the same rule from planner PALL cells with each tree (about 4 min of extra compute per pass). B5 fallback for the tactician included (below).
2. **Beastbond +25 % (number, D44).** The sim's measured candidate, taken unchanged: B7 hunter 0.58 -> 0.81.
3. **Starforged Arms removed (mechanic, D45).** The cause of B6 PALL: the Camp sold each class's epic weapon for 35 400 gold. The hunter, which clears about 4 dungeons per full-catalogue run and earns about 40 % more gold, bought it in 72 % of runs (rogue 18 %, mage 9 %) and then won 91 % of its boss fights against 50 % without. Prospector's 8.3 pp for the hunter were this purchase. Removed, Prospector is worth 3.7 / 3.7 / 1.3 pp to rogue / mage / hunter.

B22 (quest share) and B34 (Ember purchases) go to M4 with B19 and B20 (D46, extends D40).

## Expected P1 result of the package
All 45 P1 checks pass in scratch (2 000 runs per class for the planner, tree, P10, pet and tactician cells; 1 000 per class for the PALL greedy, speedrunner and B26-B28 variants; 50 campaigns per class). The five 11-10b misses:

| Check | 11-10b | Package | Band |
|---|---|---|---|
| B6 PALL | 63.2 / 62.5 / 77.6 %, spread 15.1 pp | 62.7 / 63.6 / 65.2 %, spread 2.5 pp, deviation 1.4 pp | spread <= 8, deviation <= 5 |
| B7 hunter | 0.58 | 0.81 (20.6 / 25.4 / 23.4 %) | >= 0.60 |
| B16 end boss | 46 rounds | 42 rounds | 30-45 |
| B21 Z1-Z2 | 13.1 % of runs | 11.2 % | <= 12 |
| B21 Z3-Z4 | 10.1 % of runs | 4.3 % | 3-10 |

Narrow passes to watch in the measure:
- **B5 8.5 pp (floor 8).** The tactician plays Venomcraft worse than the planner (19.4 % against 23.1 %). If the measure puts B5 under 8, the D43 fallback applies without another design pass: the P0 tactician plays each class's best point-estimate P0 tree (rogue Shadowcraft; about 11.5 pp [inference: 11-10b rogue tactician cell, 28.5 %]).
- **B21 Z1-Z2 11.2 % (limit 12), B31 median 26 runs (floor 25).** The catalogue is 450 Echoes smaller.
- The scratch tables come from the 11-10b pass; the pass relearns them, so expect shifts of 1-2 pp.

P2: B29 18.0 % (passes again); B22 quest share 46.4 % (fails, M4); B19 and B20 unchanged (M4). Other values: P0 planner 24.6 %, greedy 16.0 %, speedrunner 19.8 %, tactician 33.1 %; P10 34.9 %; PALL planner 63.8 %, greedy 40.1 %, speedrunner 42.2 %; B10 39.2 pp; B26 / B27 / B28 0.13 / 0.33 / 0.09; B32 26.8 % / 52.2 %, dip 3.8 pp; B12 29.4 min. Full table: changes-m2-v5.md "Combined result".

## Owner review
1. **Starforged Arms is gone from the catalogue.** It was the last unlock (after Relics and a first boss kill). For a rogue or mage player it was a 450-Echo purchase they could afford in about 1 run in 6 (rogue) or 1 in 11 (mage). The class weapons stay in the content for a later reward that does not cost run gold (M3 or M4). Default: removed. Measured alternative: keep it at twice the price, which leaves it a hunter-only item (hunter buys it in 23 % of runs, rogue and mage never).
2. **A full-catalogue hunter has one clear tree.** At the full catalogue the hunter's trees win 65 / 54 / 39 % (Beastbond / Marksmanship / Wildcraft), while on a fresh profile Beastbond is its weakest. No target covers this (B7 is checked on fresh profiles). Default: leave it for M3's talent pass.

## For the Engineer, the Sim and QA
- Engineer: rows 2 and 3 (src/constants.js; delete META.starforged, the nodes.js flag and the map.js Camp branch; tests and UI rows that name the entry). D41: the code commit carries no new spec text; the spec is already in place.
- Sim: row 1 (DEFAULT_TREE_PALL, TREE_SWITCH_Z, the switch rule in stage A and the PALL tree cells in stage C, both tree sets in the report). The B5 fallback is a re-run of one cell.
- Follow-up for the sim, not needed for M2: the bar template (balance.md 1.2) puts the rogue's Severing Flourish ahead of Open Vein once weapon damage is high (24 of 24 Camp bars with the Starforged epic), which cost those rogues about 28 pp of boss wins. Removing Starforged removes the only item that reaches that weapon damage. Details: changes-m2-v5.md Notes.

## Commits
| Commit | What |
|---|---|
| 662dbe8 | docs/specs/rules.md (6.3 Beastbond, 11.2 Starforged removed, budget and economy notes, 12.1 note), docs/specs/balance.md (1.3 default tree, B5 fallback, 4 reading note, TREE_SWITCH_Z), docs/specs/changes-m2-v5.md |
| b2e7379 | docs/DECISIONS.md D43-D46 |
| (this commit) | this note |

## How it was checked
Scratch copies of src/ and sim/ at main 074be82 under sim/out/v5/ (git-ignored), started from the 11-10b pass's risk tables. The unchanged copy reproduced the pass's B7 cells and the sim's PALL arms run for run. Every arm used paired seeds from 1000. Package copy `fin`: P0 planner with each tree, P10, PALL planner with each tree, greedy, speedrunner and tactician P0, PALL greedy and speedrunner, B26-B28 variants, pets and 150 campaigns. 0 errors in every scratch run. The scratch recorder logged gold spent per item, which is how the Starforged purchase was found. It is not part of sim/.
