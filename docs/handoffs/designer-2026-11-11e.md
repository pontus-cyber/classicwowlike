# Hand-off: Lead Game Designer, 2026-11-11e (M2b v10 expedition tuning package, draft)

Task: the expedition tuning package for the switch-over to the expedition map with the start camp. Spec: docs/specs/changes-m2b-v10.md. Status: draft. No src/ or sim/ change.

## Package (13 rows)
- **Contract rewards (B46, gear):** A1 contract XP loses the level-difference modifier (as the retired story chain). On the 11-11e records the modifier cut contract XP to 0.51 of its value (P0) and 0.35 (PALL); without it the same completions give 8.0-11.9 % of XP (band 8-20). A2 CONTRACT_CL_OFFSET 5 -> 8 (rewards at the zone's rim level). A3 contract / bounty tables 65/35 and 40/60.
- **Delves (B39):** DELVE_XP_FRAC 1.0 -> 1.5, Delve price 1 -> 2 (the camp bought Delves as the cheapest contract and swapped them away: 202 of 609 abandoned), EXPED_TIME_DUNGEON 6 -> 5, new rule DUNGEON_DIM_HOLD 3 (the dungeon dims 3 tolls late), EST_COMPLETE.delve prior 0.90 -> 0.35.
- **Dimming (B43, B44):** the planner prices a Dimmed encounter at 8 % death at depth 0; measured 0.9 % for the planner (2 / 216) and 19.5 % for the greedy. C2: the bots learn it by depth (prior 0.02). No front change (a faster front costs B11). C1 XP_WEIGHT_MULT 1.6 -> 1.4 for B20 / B14 / B15 and more nodes per zone (arm 1.5). C3: B44 measured on the heat-seek planner; the default planner's zone is bounded by the Furnace, not the Dimming (1.05 with 19.5 tolls with the Dimming off).
- **Prep (B40):** planner buys supplies and perks by value per point (draughts 90 per point, Ember 80), a second contract of one zone at 0.6; values calibrated by forced-option arms.
- **Defaults:** engineer-11f section 4 items 1-12 confirmed (item 7: `TAKE_HUB_CONTRACT(mode, contractId)`); sim assumptions confirmed except EST_COMPLETE, EXP_DIM_DEATH and the greedy, which gains the engine's clean-escape test.
- **Potions (appendix P, draft, owner idea):** mob 0.03, elite 0.25, dungeon boss 1, treasure 0.50, none from the end boss; about 3 per expedition run; own stream; outside the measured rows.
- **Sim plan:** 11 cells plus a hash check, about 40 min on 2 workers, with decision rules for C1, B4 and the prep values. **Flip criteria:** P1 expedition rows pass, planner P0 >= 20 % and PALL >= 50 % at 900 runs, tests and B31 re-measured.

## Owner items
- O5: potion drop rates of appendix P (about 3 per expedition run, none from the end boss). Default: build after the flip at these rates.
- O6: until the flip criteria pass, the default map stays classic and the owner plays the expedition through the preview setting. Default: as written.

## Risks
- Gear and the expedition win rate will probably stay under the classic map (expected planner P0 15-20 % against 32 %). The story chain on the expedition map already gave less gear (11-11d), so the gap is the loot side of the 9.5 budget, not the contracts. Next lever in BACKLOG (expedition loot weight).
- C1 adds 2-4 minutes (B11 42.4 -> about 45-46) and 5-10 tolls; boss Ascendancy may reach +2 %.
- Every expected effect except A1's bound is an inference; C2 is the main bet for B43.

## Proposed decisions
D82-D90 (team), O5-O6 (owner); table in changes-m2b-v10.md.

## For the Lead
- expedition.md: only the status line, 2.3 (options once per run), 1 and 3.6 (`TAKE_HUB_CONTRACT(mode, contractId)`, hub offer until the first LEAVE_HUB). The package's constants are folded in when built.
- balance.md B44 changes only when D88 is accepted (row C3; not edited here).

## Commits and files
docs/specs/changes-m2b-v10.md (new), docs/specs/expedition.md, docs/BACKLOG.md, this note. Checked by reading the 11-11d and 11-11e reports and hand-offs and by recomputing from the 11-11e run records (sim worktree sim/out/exp-2026-11-11e, scratch scripts in /tmp): contract XP shares with and without diffMod, contract status by kind, Dimmed encounter death rates, zone tolls, kills, chests and dungeons per run.
