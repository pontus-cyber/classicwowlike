# Spec changes M2 v4 (M2 task 2.3, design pass 2026-11-10)

Owner: Lead Game Designer. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), UI/UX Engineer, QA.
Every changed or new line in docs/specs/rules.md and docs/specs/balance.md ends with "(M2 v4)". Decisions D33-D39 in docs/DECISIONS.md. Problems 1-5 are the remaining misses of docs/reports/balance-2026-11-10.md: 1 meta power (B3 all PALL bots, B10, B6 PALL), 2 B32 dip, 3 B1 greedy, 4 B12 p10, 5 dungeons dead after zone danger (B22).

Type: **number** = src/constants.js only; **mechanic** = engine code (exact behaviour below); **rule** = design rule in the spec; **target** = balance.md band or metric (sim/ change). No bot changes.

Evidence: designer scratch copies of src/ and sim/ at main 7031013 (sim/out/v4/*, git-ignored; src/ and sim/ unchanged), 300 runs per class on seeds 1000-1299. Two pairing methods:
- **Table**: start from the 11-10 pass's final risk table of the profile, as the sim's candidate experiments; paired with the sim's unchanged copy on the same seeds (ctl: planner P0 31.6 %, greedy P0 16.8 %, speedrunner P0 22.6 %, P10 42.6 %, PALL planner 90.0 %, greedy 70.1 %, speedrunner 65.2 %). The scratch control reproduces the sim's ctl records exactly (100 of 100 runs identical).
- **Warm**: 1 000 planner warm-up runs per class from RISK_PRIOR, then 300 measured, for both copies. Needed for the dungeon rows, because the pass tables rate dungeons by their v3 death rates. Warm ctl: planner P0 29.7 %, greedy P0 17.0 %, PALL planner 85.0 %, greedy 71.3 %.
"Projected" = 11-10 pass value + paired delta [inference: assumes the delta carries over from 900 runs].

Package names in the evidence column: **G** = the full M2 v4 package (rows 1-11); **F** = G with Wayfinder at 1 h instead of removed; **v4a** = rows 3-6, 8 at BOSS_HP 13700, and Alchemist as an economy entry (rejected, see Notes).

## Change table

| # | Constant or rule | Old -> new | Problem | Evidence | Type |
|---|---|---|---|---|---|
| 1 | GREATER_HEAL_PCT (Alchemist's Notes) | 0.50 -> 0.375 (-25 %) | 1 | sim gh375: PALL planner 90.0 -> 82.7 %; in G, owning Alchemist is worth 2.9 pp (rogue 9.3 pp), against 9.6 pp before | number |
| 2 | Meta power budget (rules 11.2); new META_TIME_BUDGET_H | HP +0.05, Power +0.05, crit +0.02; potions and time not counted -> HP +0.04, Power +0.04, crit +0.015, potion healing +0.025 of max HP per potion (Greater draught), time entries save at most META_TIME_BUDGET_H = 5 h on the planner's median route | 1 | Alchemist was the largest PALL power source and outside the budget (-9.6 pp); time lowers boss Ascendancy (row 7). G: planner 140 h on P0, 137 h on PALL (3 h) | rule |
| 3 | META.vigor, META.edge ranks and costs | 5 ranks, 80/120/170/230/300 -> 4 ranks, 80/120/170/230 (-20 %) | 1 | sim ve4: 90.0 -> 88.3 %; with row 1: 78.6 % | number |
| 4 | META.keen.crit | 0.01 -> 0.0075 per rank (-25 %) | 1 | sim pkg4 (rows 1, 3-6): 78.3 % | number |
| 5 | META.quick_study.xpPct | 0.05 -> 0.0375 per rank (-25 %) | 1 | as row 4 | number |
| 6 | META.prospector.goldPct | 0.08 -> 0.06 per rank (-25 %) | 1 | as row 4 | number |
| 7 | Wayfinder (META.wayfinder) | TRAVEL_ON costs 0 h, 80 Echoes -> entry removed; Swift Boots loses its Wayfinder requirement | 1 (B10, B3 greedy) | travel 0 h -> 1 h: v4a 73.4 -> 67.6 %; 1 h -> 2 h (same as no Wayfinder): 68.3 -> 61.7 %. G vs F: planner PALL 64.7 vs 69.7 %, greedy 46.7 vs 49.4 % (warm). PALL hours 131 -> 137 h | mechanic |
| 8 | BOSS_HP | 13500 -> 13900 (+3.0 %) | 3 (B1 greedy) | sim pkg1 (table): greedy P0 16.8 -> 15.2, planner 31.6 -> 28.1, speedrunner 22.6 -> 18.2, P10 42.6 -> 38.7 %. G warm: greedy P0 17.0 -> 15.2 %, planner 29.7 -> 25.3 % | number |
| 9 | BOSS_ENRAGE_ROUND | 55 -> 57 (+3.6 %) | P2 B29 (Final Dark 21.7 % of boss losses) | sim: Final Dark 20 -> 17 % of planner P0 boss losses; G warm 21 -> 19 % | number |
| 10 | Dungeon zone danger (rules 2.4, 7.6); new DUNGEON_DANGER_FRAC | dungeon trash and boss take the full zone-danger bonus -> DUNGEON_DANGER_FRAC 0.5 of it (level 60: ×1.5, was ×2.0) | 5 | warm planner P0: dungeons per run 0.09 -> 0.58, dungeon share of non-boss deaths 4.9 -> 13.5 %, runs dying in Z1-Z2 9.1 -> 10.2 % | mechanic |
| 11 | DUNGEON_BOSS_DMG_MULT | 1.7 -> 1.5 (-12 %) | 5 | with row 10 (warm): dungeons 0.95 per run (1.05 at the boss), death per entry 4.1 %, dungeon share 22.6 %, quest share 45.8 %, runs dying in Z1-Z2 10.6 %, planner P0 29.7 -> 30.4 % | number |
| 12 | WR_PALL_GREEDY (B3) | 0.30-0.50 -> 0.35-0.55 | 1 | greedy / planner win ratio 0.65 on P0 (11-10 pass) and 0.69-0.78 on PALL in every package measured (sim pkg1-5, designer v4a-h, F, G); band 0.30-0.50 assumed 0.46-0.62 around the planner band. G greedy PALL 46.7 % (projected 48.9 %) | target |
| 13 | WR_PALL_SPEED (B3) | 0.40-0.60 -> 0.30-0.50 | 1 | speedrunner reaches the boss at 88-101 h (under BOSS_TIME_PAR 120), so meta time savings give it nothing; cuts take 27 pp from it against 25 pp from the planner (G, table). G 38.3 % (projected 37.9 %) | target |
| 14 | HOURS_SPEED (B17) | 70-100 -> 80-110 h | consequence of row 7 | speedrunner PALL median 88 -> 101 h (G, table): six travels at 2 h | target |
| 15 | B32 dip; new CURVE_BLOCK_MIN_RUNS | all 5-run blocks -> only blocks with at least 50 runs (all classes pooled) | 2 | 11-10 pass blocks: 750 / 750 / 750 / 750 / 743 / 365 / 5 runs; the 5.8 pp dip was the 5-run block 31-35. A block of 50 runs is at least 10 campaigns | target |
| 16 | B12 p10; MIN_SPEED_P10_MAX | p10 <= 25 min -> reported, no target | 4 | speedrunner PALL wins: p10 1.0 min under the median in all three passes; fastest of 3 891 wins 26.1 min (11-10 pass); G: median 29.1, p10 28.1 min. The bot's spread is luck only; the median clauses (<= 0.7 × B11, <= 30 min) keep "noticeably faster" [stated: BRIEF] | target |
| 17 | B17 time budget check | none -> planner P0 median hours - planner PALL median hours <= META_TIME_BUDGET_H (P2) | 1 | makes row 2 measurable; G: 140 - 137 = 3 h | target |

Count: 17 rows. 8 number changes (rows 1, 3, 4, 5, 6, 8, 9, 11), 2 mechanic changes (rows 7, 10), 1 design rule (row 2), 6 target changes (rows 12-17). No bot changes. Catalogue total 7 690 -> 7 010 Echoes (rows 3 and 7).

Problem 3 (B1 greedy) is fixed by a number (row 8), not by a target change. Problem 2 adopts the sim's proposal (row 15); the measured candidate passes the dip without it as well (sim: 2.1 pp).

## Mechanic changes: exact behaviour

**X1. Dungeon zone danger (row 10).** In `makeEnemy` (src/engine/combat.js), the damage factor `zoneDanger(level)` becomes `1 + DUNGEON_DANGER_FRAC × (zoneDanger(level) - 1)` when `variant` is `trash` or `dboss`; every other variant (normal, elite, rare, Camp waves, and adds summoned in any fight, which are built as `normal`) keeps `zoneDanger(level)`. Level 60 dungeon enemies: ×1.5 (was ×2.0); level 20 and below: ×1.0 (unchanged). HP, armor, XP unchanged. No random draws added; seeds replay as before.

**X2. Wayfinder removed (row 7).**
- `META.wayfinder` is deleted; `META.swift_boots.req` becomes `[]`.
- TRAVEL_ON always costs HOURS_TRAVEL (src/engine/nodes.js: the `s.meta.wayfinder` branch and the `wayfinder` flag go). The rank helper `r(id)` reads `META[id].ranks`, so the flag line must go with the entry.
- Saved profiles: an owned id that is not in META is ignored (no effect, no refund), as D32 does for ranks above the maximum. Buying and requirement checks skip unknown ids.
- Sim: drop `['wayfinder', 1]` from the standard purchase order (sim/lib/profiles.mjs; balance.md 1.4). P10 does not change (Wayfinder was entry 13).
- UI: the catalogue screen reads META; remove the Wayfinder text and icon entries (src/ui/ui-text.js, src/ui/meta.js, src/ui/screens.js travel hint).

## Target and metric changes (sim/)
- BAL: WR_PALL_GREEDY 0.35-0.55, WR_PALL_SPEED 0.30-0.50, HOURS_SPEED 80-110, CURVE_BLOCK_MIN_RUNS 50, META_TIME_BUDGET_H 5; MIN_SPEED_P10_MAX removed.
- B32 (sim/lib/campaignreport.mjs): blocks with fewer than CURVE_BLOCK_MIN_RUNS runs (all classes pooled) are left out of the dip check; per-class rows still list them. The pooled check is the one that counts.
- B12: report p10 without pass/fail.
- B17: new check row, planner P0 median hours at the boss minus planner PALL median hours <= META_TIME_BUDGET_H.

## Notes
- **Rejected: Alchemist as an economy entry** (no Greater draught; Healing and Mana Draughts at half price; scratch v4a, prototyped in src/ of the copy). It removes the potion power, but the rogue's PALL rate depends on it: v4a rogue / mage / hunter 64.3 / 76.7 / 79.3 %, projected spread 10.6 pp (B6 fails). With the Greater draught at 0.375 the classes stay together (G: 61.0 / 63.0 / 70.0 %, projected 61.7 / 61.9 / 64.2 %).
- **Rejected: Wayfinder at 1 h (F).** Planner PALL 69.7 % (table) and 70.3 % (warm). Projected B10 is 41.9-49.1 pp depending on pairing method (ctl is 85.0 % warm, 90.0 % on the pass table; F does not move between them), so F does not pass B10 with confidence. G is 5 pp lower and passes on both methods.
- **Rejected: the sim's flat dungeon cut** (trash 0.85, boss 1.3; sim dng1, warm): dungeon share 21.1 %, but runs dying in Z1-Z2 9.1 -> 11.6 % (projected 12.4 %, over B21's 12 % P1 band), because it also softens zone 1-2 dungeons, which zone danger never touched. Also tried: dungeons fully exempt from zone danger (0.85 per run, dungeon share 14.6 %) and row 10 with trash 1.0 (Z1-Z2 deaths 11.8 %).
- **Why dungeons died.** The pass tables rate dungeons at 39-65 % death per entry. Once the tables relearn, the death rate per entry is 3-5 % in every variant above, but the planner's risk key (type, CL - L, HP) does not include the zone, so deadly zone 4-6 dungeons kept zone 1-2 dungeons out of the plan too. Sim option, not needed for this package: key the dungeon risk by zone band.
- Measured and too small to use: Vigor and Edge 3 ranks (-0.4 and -1.4 pp), Starforged ilvl 60 (0), Prospector 0.03 (-0.6).
- Measured in G (table, 300 per class): B27 cleanse ratio 26.9 / 64.7 = 0.42, B26 interrupt ratio 8.7 / 64.7 = 0.13. What remains of PALL power, ablated on F (table): stat ranks 11.5 pp, economy 9.6 pp, map 4.1 pp, Second Breath 3.3 pp, Alchemist 2.9 pp, Ancestral Insight 1.6 pp.
