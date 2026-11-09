# Hand-off: Lead Game Designer, 2026-11-09c (M2 task 2.3, design pass M2 v3)

## Summary
- Changed docs/specs/rules.md and docs/specs/balance.md in place; every changed or new line is marked "(M2 v3)". Full list with old -> new, problem, evidence and type: docs/specs/changes-m2-v3.md. Decisions D24-D31 (status team).
- 23 changes: 13 number changes (src/constants.js only; one row covers 11 catalogue costs), 3 mechanic changes (zone danger, Second Breath not at the end boss, Echo line rounding), 1 design rule (meta power budget), 3 bot changes, 3 target changes (B21, B24, new B38).
- Miss 1 decision: a **zone-scaled danger mechanic** (D24). B21 bands are also re-based, because no lever brings a risk-aware planner's deaths to 20-35 % per stage without breaking B1. Tension is now measured directly (B38: how low HP goes in fights, per zone).
- Everything was measured together in designer scratch copies (sim/out/d3/*, git-ignored; src/ and sim/ unchanged). Main numbers: planner P0 26.8 %, greedy 18.7 %, speedrunner 16.8 %, P10 42.3 %, PALL 74.3 %, campaigns median 28 runs.

## Evidence (scratch, 300 runs per class, seeds 1000-1299, 600-run warm-up; campaigns 50 per class)
| Step | Planner P0 R / M / H (pooled) | Other |
|---|---|---|
| ctl (main, unchanged) | 29.7 / 28.7 / 27.7 (28.7) | mean lowest HP per fight Z1..Z6: 65/71/75/79/87/92 %; deaths Z3-Z6 0.9-0.0 % of entering runs |
| zone danger 0.25 | 31.0 / 22.0 / 27.3 (26.8) | Z1..Z6 65/72/72/68/73/83 %; greedy 22.0 -> 17.4, speedrunner 28.4 -> 17.4 % |
| + meta budget, Ricochet, Echo, enrage 55, Thornback (v3a) | 31.0 / 23.0 / 35.3 (29.8) | P10 40.0, PALL 74.1 % |
| + mage HP 19.5, hunter HP 15.5 (v3b) | 31.0 / 31.3 / 29.3 (30.6) | greedy 23.2, speedrunner 18.3 %; route style speed 45.1 % / 43 min vs balanced 30.6 % / 44 min |
| + BOSS_HP 13500 + planner hour weight ×2 (v3c, final P0) | 22.7 / 28.7 / 29.0 (26.8) | greedy 18.7, speedrunner 16.8 %; deaths (share of deaths) Z1-2 13.7, Z3-4 8.2, Z5-6 4.9, boss 73.3 %; Final Dark 22.8 % of boss losses; end-boss rounds 42 |
| + catalogue costs (v3d, final meta) | - | P10 42.3 % (42.0 / 46.3 / 38.7), PALL 74.3 % (58.3 / 83.3 / 81.3); Echoes 235 per run, 427 per win; campaigns median 28, fewest 24, runs 1-5 28 %, runs 21-30 about 70 % |

## Expected effect per target (scratch values; the sim pass on main is the measurement that counts)
| Target | Report 2026-11-09b | Expected | Band | Result |
|---|---|---|---|---|
| B1 planner / greedy / speedrunner P0 | 30.5 / 24.1 / 29.6 % | 26.8 / 18.7 / 16.8 % | 20-35 / 8-18 / 10-25 | pass / 0.7 over / pass |
| B2 P10 | 53.9 % | 42.3 % | 32-48 | pass |
| B3 PALL planner | 91.1 % | 74.3 % | 55-75 | pass (at the edge) |
| B10 meta gap | 60.6 pp | 47.5 pp | 20-45 | 2.5 over |
| B5 tactician gap | +7.0 pp | about +9 pp (sim estimate for the T2 change) | 8-25 | expected pass, needs the 24-min cell |
| B6 class band P0 | spread 6.0 | spread 6.3, max deviation 4.1 | <= 8, <= 5 | pass |
| B6 class band PALL | spread 15.9 | spread 25 (rogue 58 %) | <= 8 | fail, see Risks |
| B9 pets | 0.45 | 0.88 | >= 0.7 | pass |
| B21 (new definition) | - | runs dying Z1-2 about 11 %, Z3-4 about 6 %, Z5-6 about 4 %; boss 73 % of deaths | <= 12 / 3-10 / 2-8 / 55-80 | pass |
| B24 (new definition) | - | 5.6 % | 4-12 | pass |
| B38 tension (new) | Z2-Z5 spread 16 pp, Z6 92 % | 5 pp, Z6 82 % | <= 10, <= 85 % | pass |
| B29 Final Dark | 35.8 % | about 23 % | 5-20 | better, still 3 over |
| B30 Echoes per run / per win | 297 / 488 | 235 / 427 | 150-260 / 400-540 | pass |
| B31 campaigns median / fewest | 19 / 17 | 28 / 24 | 25-40 / >= 18 | pass |
| B32 runs 1-5 / 21-30 | 47 / 86 % | 28 / about 70 % | 15-35 / 45-70 | pass / at the edge |
| B11 run length | 45.7 min | 43.8 min | 40-50 | pass |

## Owner review (only what changes the game for you)
1. **Later zones hit harder.** Enemies above level 20 deal more damage, up to double at level 60. Zones 3-6 now feel about as dangerous as zone 2 instead of getting easier, and rushing ahead under-levelled is a real risk.
2. **Meta unlocks are smaller and cost more.** Stat ranks give +1 % each (max +5 % HP, +5 % Power), Keen has 2 ranks and Ancestral Insight 1. The full catalogue costs 7 690 Echoes and takes about 28 runs. A fully unlocked profile wins about 3 runs in 4 instead of 9 in 10.
3. **Second Breath saves you on the way, not at the final boss.** The boss stays the test of the run.
4. **The end boss** has 13 500 HP and Final Dark starts at round 55 (was 50).
5. **Hunter Ricochet Bolt** bounces for 40 % (was 70 %); it is now an alternative to Keen Shot, not a must-have.

## Requests
- **Core Gameplay Engineer:** constants per changes-m2-v3.md; mechanics X1-X3. No new events.
- **Simulation & Balance Engineer:** BAL PLANNER_HOUR_MULT and the new/changed bands (balance.md 6); bot rows 15-17; recorder: lowest HP and zone per fight for B21 (share of runs), B24 and B38. Then the full pass. First levers within TUNE_LIMIT: greedy 0.7 over (BOSS_HP), B10 2.5 pp over (vigor/edge ranks), B29 (BOSS_ENRAGE_ROUND 57). Before tuning B6 PALL, find why the rogue's PALL win rate is 58 % with Satchel and 85 % without it on the same seeds (scratch v3a; not the risk table).
- **UI/UX Engineer:** Second Breath text "not in the final fight"; Echo lines show rounded values.
- **QA:** constant tests follow the new tables; one engine test that Second Breath does not fire in the end-boss fight; one that enemy damage at level 60 is 2.0 × the old formula.

## Risks and known gaps
- B6 PALL: rogue 58 % against 81-83 % for mage and hunter. The Satchel anomaly above suggests a bot or engine interaction, not a class gap; not tuned.
- PALL and B32 runs 21-30 sit at the top of their bands; B10 is 2.5 pp over. If the sim pass lands high, cut Vigor and Edge to 4 ranks before touching other entries.
- Scratch prototypes of X1 and X2 are one-line changes; the bot hour weight was prototyped as a multiplier in makeCtx for the planner only (tactician and speedrunner not measured with it).
