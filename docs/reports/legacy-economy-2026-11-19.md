# Legacy economy v2, 2026-11-19

Status: **draft** (Lead Game Designer), for the Lead; nothing here is approved by the owner. The change is docs/specs/legacy.md 4.7 (Economy v2) and its section 10 rows. src/, game.html and balance.md are untouched; every arm ran on a scratch copy of the native engine outside the repository. Source of the task: the returning-player check (docs/feedback/2026-11-19-blind-legacy-returning.md) and BACKLOG 2026-11-19 (Legacy economy).

## Verdict

1. **The exploit is closed by removing the payout.** In a Legacy run unspent camp points pay nothing (LEGACY_PER_PREP_POINT_HERO 0); they still buy hub contracts. On the engine, a hero-3 run that sets out with nothing bought and abandons at once paid 20 Legacy points (line `reserve`, 10 × 2); with the change it pays 0. Depth pays instead: a zone left pays 10 (was 7.5).
2. **The quest XP drop is a formula fault, fixed in the rule.** Legacy XP was `xpCurve(CL) / xpCurve(L) × diffMod(CL - L)` against the hero's power level, and zone 1's band is clamped at 1 for heroes 1-2, so the same zone-1 quest paid 233-346 at hero 1 and 92-137 at hero 2 (the tester's 270 / 407 and 63 / 161 are these terms exactly). XP is now counted against the zone's band: `100 × frac × (1 + 0.10 × max(0, CL - band)) × mods`. The same node pays the same at every hero level.
3. **Zone 1 now trails the hero** (ZONE_LAG 0.15 a power level; zone 2's 0.075 was tried and dropped, section 5). Zone 1's lowest HP in won fights is 89-93 % from hero 3 to 25 (main: falls from 86 % at hero 5 to 71 % at 15). Its fights shorten from 4.4 to 3.5 rounds. Zones 2-6 keep their levels, so L4's HP rise now passes at hero 20 (14 points, main -6).
4. **The pace fits the hall to hero 25.** A planner campaign earns 1 703 Legacy points by hero 20 and 2 469 by hero 25 (10 runs, 6.5 hours). The hall is re-priced to 1 640 (account entries + one class's techniques) plus 700 (the level-20 trees and the Armoury) = 2 340. Every one of runs 1-7 buys at least one entry; runs 1-4 buy two or three.
5. **The first run still ends at level 4** (4.3) after HERO_XP 1-3 drops to 1 800 / 1 850 / 1 900. With the zone-based XP a first run pays 21 % less, since the clamp's over-level bonus is gone.
6. **Not settled:** v2 lowers the top end. Pooled win at start hero 21-24 is 44.7 % against 48.5 % (section 5); hero 25 is unchanged at 54 %. Clarity (one name for camp points, the run-end "kept / left behind" lines, the level-up banner) is spec only, legacy.md 4.7 E6.

## 1. Set-up (D118)

- Engine: main 86cdb51 with `C.GATES.legacy` and `oruvathLegacy` on (`sim/legacy-run.mjs grid --native --oruvath`). Cells: `--map expedition --prep`, planner, profile `later` (two runs played, nothing bought), `--warmup 0`, the band risk tables sim/tables/legacy-hx/ by hero level, seeds 9000-9059, **60 runs per class and hero level (180 per level)**.
- Arms (scratch copy; env ECON read by legacy.js `bandNow` and progress.js `eventXp` / `flatXp`, and the planner's model in sim/lib/model.mjs):

| Arm | XP rule | ZONE_LAG | Other | Hero levels | Runs |
|---|---|---|---|---|---|
| main | today (curve × diffMod against the hero) | none | reserve line 2, zone line 7.5 | 1-25 | 4 500 |
| X1 | against the zone band, step 0.10 | none | | 1, 2, 3, 5, 8, 10, 13, 16, 20, 23, 25 | 1 980 |
| XL1 | as X1 | 0.15 / 0.075 | | same | 1 980 |
| XL2 | as X1 | 0.25 / 0.12 | | same | 1 980 |
| V2 (full arm) | as X1 | 0.15 / 0.075 | reserve line 0, zone line 10, HERO_XP 1-3 1800 / 1850 / 1900 | 1-25 | 4 500 |
| **V2z1 (proposal)** | as X1 | 0.15 / 0 | as V2 | 21-24 | 720 |
| V2m0, V2b | as V2; V2m0 with today's planner model, V2b with the Camp's XP reference 3 power levels lower | 0.15 / 0.075 | as V2 | 21-25, 21-24 | 900, 720 |

- Readings: hero XP of a run is the summary's `xpGained`. Legacy a run is the run's total, shown for main and X1-XL2 without the reserve line (the planner keeps 6 camp points in every run, so the line is a constant 12). Minutes are at manual pace (rules 3). Lowest HP is the mean over won quest and grind fights per zone (B38).
- Also run: main and V2 at hero 21-25 on seeds 9100-9159 (900 runs each; main's hero 21 on 9100-9219), and the guided first run (`sim/run.mjs --guided --hero 1 --profile fresh`, 40 runs per class) on main and V2.
- The campaign is the cells chained, not campaign v3. Each run takes the XP and Legacy points of the cell at its start level, with HERO_XP of the arm. Cells buy nothing, so the hall's own effects are not in the numbers (Quick Study is estimated in legacy.md 4.7 E5).

## 2. What was wrong (main)

| Hero level | 1 | 2 | 3 | 5 | 10 | 15 | 20 | 25 |
|---|---|---|---|---|---|---|---|---|
| Zone 1 quest, ring 1 / ring 2 (formula) | 233 / 346 | 92 / 137 | 106 / 143 | 120 / 148 | 131 / 152 | 136 / 153 | 138 / 154 | 140 / 155 |
| Hero XP a run (planner) | 7 782 | 7 569 | 7 808 | 7 641 | 8 170 | 7 277 | 6 904 | 6 447 |
| Legacy a run, of it reserve | 166, 12 | 185, 12 | 200, 12 | 197, 12 | 234, 12 | 263, 12 | 247, 12 | 276, 12 |
| Zone 1 / zones 5-6 lowest HP % | 69 / 68 | 82 / 70 | 84 / 74 | 86 / 76 | 77 / 64 | 71 / 66 | 75 / 81 | 76 / 79 |
| Zone 1 / zones 5-6 rounds a fight | 6.0 / 7.1 | 4.3 / 7.1 | 5.3 / 6.8 | 5.6 / 6.4 | 5.2 / 6.0 | 5.2 / 5.4 | 4.4 / 4.3 | 4.2 / 4.2 |

- The campaign on main: 10 runs, 6.4 hours, the first run ends at hero 4.8, Legacy 2 302 by hero 25 without the reserve line (2 420 with it). The level-60 catalogue a Legacy profile is sold today (24 entries, about 6 100 for one class) would take about 25 hours. 4.2's planned set (3 730 for one hero with the level-20 entries) would take about 10.
- The tester's 42-44 a run were runs that ended in zones 1-2. A planner run that plays to Oruvath earns 154-264.

## 3. The arms

Hero XP a run / Legacy a run (without the reserve line; V2 as paid) / zone 1 lowest HP % / win %, planner, 180 runs per cell:

| Hero | main | X1 | XL1 | XL2 | V2 |
|---|---|---|---|---|---|
| 1 | 7782 / 154 / 69 / 4 | 5962 / 136 / 75 / 2 | 5962 / 136 / 75 / 2 | 5962 / 136 / 75 / 2 | 6113 / 164 / 75 / 4 |
| 2 | 7569 / 173 / 82 / 6 | 6690 / 162 / 88 / 4 | 6690 / 162 / 88 / 4 | 6690 / 162 / 88 / 4 | 6788 / 182 / 89 / 3 |
| 3 | 7808 / 188 / 84 / 8 | 6733 / 197 / 88 / 17 | 6887 / 197 / 92 / 15 | 6918 / 196 / 92 / 14 | 6903 / 206 / 92 / 12 |
| 5 | 7641 / 185 / 86 / 8 | 6970 / 177 / 87 / 7 | 7098 / 181 / 93 / 8 | 7187 / 184 / 93 / 9 | 7096 / 196 / 93 / 8 |
| 8 | 8676 / 229 / 83 / 23 | 8160 / 237 / 85 / 27 | 8126 / 228 / 92 / 25 | 8164 / 229 / 94 / 24 | 8126 / 243 / 92 / 25 |
| 10 | 8170 / 222 / 77 / 24 | 7878 / 245 / 79 / 37 | 7931 / 228 / 91 / 29 | 7871 / 239 / 95 / 34 | 7927 / 242 / 91 / 29 |
| 13 | 7489 / 251 / 72 / 42 | 7505 / 265 / 73 / 48 | 7648 / 261 / 90 / 45 | 7485 / 239 / 94 / 37 | 7651 / 276 / 90 / 45 |
| 16 | 6866 / 228 / 70 / 36 | 7003 / 235 / 70 / 38 | 7314 / 245 / 90 / 40 | 7347 / 249 / 94 / 41 | 7312 / 257 / 90 / 39 |
| 20 | 6904 / 235 / 75 / 41 | 6981 / 226 / 76 / 37 | 7271 / 232 / 92 / 38 | 7265 / 230 / 95 / 37 | 7270 / 246 / 92 / 38 |
| 23 | 6713 / 258 / 76 / 51 | 6819 / 246 / 77 / 47 | 7184 / 246 / 92 / 43 | 7109 / 232 / 95 / 38 | 7188 / 261 / 92 / 43 |
| 25 | 6447 / 264 / 76 / 54 | 6609 / 259 / 77 / 52 | 6870 / 269 / 92 / 54 | 6737 / 254 / 95 / 49 | 6870 / 284 / 92 / 54 |

- **X1 (XP rule only):** XP a run -23 % at hero 1 and -9 to -12 % at 2-5 (the clamp's bonus is gone), within ±4 % from 8. The campaign is unchanged at 10 runs and 6.4 hours. The first run ends at 3.96 on the old HERO_XP, hence E4.
- **XL1 vs XL2 (zone lag):** both make zone 1 easy (90-95 %) and leave zones 3-6 as they were (lowest HP 65-78 %, fights 6.4 → 4.2 rounds). XL2 makes zone 1 trivial from hero 5 (3.4 rounds) and pooled win at hero 20 / 23 / 25 is about 4 pp under XL1 (41 against 45 %). XL1's zone 1 value is kept; zone 2's 0.075 is dropped (section 5).
- Zone 1 fight rounds under V2: 5.6 (hero 1), 4.4 (5), 4.2 (10), 4.1 (15), 3.5 (20), 3.5 (25). Runs dying in zones 1-2: 0-0.6 % from hero 5 (main 0-3.9 %). Zone 2 lowest HP 76-87 % (main 71-85 %).
- Mean equipped item level at Oruvath minus power level, hero 20 / 23 / 25 pooled: main +2.1 to 2.3, V2 +1.4 to 1.7 (zones 1-2 drop at their lower level).

## 4. The v2 curve

Legacy a run by start hero level (V2): 164, 182, 206, 189, 196 | 243, 259, 243, 242, 242 | 272, 273, 276, 259, 269 | 257, 257, 256, 245, 246 | 250, 245, 261, 274, 284 (hero 1-25). That is 265-452 an hour. Hero XP a run is 6 100-8 300 (177-196 a minute).

| Run | Hero start → end | Hours | Legacy this run | Cumulative | Bought after the run (legacy.md 4.7 E5 order) |
|---|---|---|---|---|---|
| 1 | 1 → 4.3 | 0.58 | 164 + 60 | 224 | Packed Satchel, Vigor I, Edge I |
| 2 | 4 → 7.5 | 1.24 | 189 | 413 | Quick Study I, Lost Technique I |
| 3 | 7 → 10.8 | 1.97 | 259 | 672 | Deeper Pockets, Cartographer, Vigor II |
| 4 | 10 → 13.6 | 2.64 | 242 | 915 | Edge II, Old Hand, Quartermaster I |
| 5 | 13 → 16.1 | 3.31 | 276 | 1 190 | Quick Study II |
| 6 | 16 → 18.4 | 3.96 | 257 | 1 447 | Lost Technique II, Swift Boots, Quartermaster II |
| 7 | 18 → 20.5 | 4.60 | 256 | 1 703 | Second Breath |
| 8 | 20 → 22.4 | 5.23 | 246 | 1 950 | second tree |
| 9 | 22 → 24.3 | 5.86 | 245 | 2 195 | the Armoury |
| 10 | 24 → 25 | 6.47 | 274 | 2 469 | third tree |

Hall: account entries + one class's techniques 1 640 (Hunter +150 Stormhawk), level-20 wing 700, total 2 340. Cumulative is +4 % of the account wing at hero 20 and +6 % of the hall at hero 25 (LE3 ± 15 %).

## 5. Win rate and B6 (reported, not tuned)

Pooled win by band (start hero level), seeds 9000-9059, 300 runs per class per band:

| Band | main: R / M / H (pooled), spread | V2: R / M / H (pooled), spread |
|---|---|---|
| 1-5 | 2.0 / 1.3 / 14.0 (5.8), 12.7 | 2.0 / 4.7 / 13.3 (6.7), 11.3 |
| 6-10 | 24.3 / 26.3 / 21.3 (24.0), 5.0 | 27.7 / 28.0 / 23.0 (26.2), 5.0 |
| 11-15 | 45.3 / 40.0 / 38.0 (41.1), 7.3 | 43.3 / 42.3 / 45.3 (43.7), 3.0 |
| 16-20 | 46.3 / 33.0 / 41.0 (40.1), 13.3 | 38.7 / 32.0 / 43.3 (38.0), 11.3 |
| 21-25 | 52.7 / 43.7 / 52.3 (49.6), 9.0 | 54.0 / 39.7 / 39.0 (44.2), 15.0 |


- Same seeds, more runs (seeds 9100-9159; hero 21 on 9100-9219), band 21-25: main 50.3 / 42.2 / 37.5 (43.3); V2 41.9 / 39.2 / 33.9 (38.3). Pooled over both seed sets (660 runs per class): main 51.4 / 42.9 / 44.2 (46.2 %, spread 8.5 pp), V2 47.4 / 39.4 / 36.2 (41.0 %, spread 11.2 pp). The 5 pp drop is real (about 3 standard errors).
- On these seeds B6 fails on main as well in bands 1-5, 16-20 and 21-25. At 300 runs per class one band moves by 5-7 pp per class, and D157 measured its pass on 600 runs per class on seeds 6000-6119. Bands 6-15 are unchanged or better under v2.
- **Where the top-end drop comes from** (start hero 21-24, seeds 9000-9059, pooled win; boss win of the runs that reach him):

| Arm | Hero 21 / 22 / 23 / 24 | Pooled | Item level at Oruvath minus power level |
|---|---|---|---|
| main | 42.8 / 47.2 / 51.1 / 52.8 | 48.5 | + 1.94 |
| V2 (zone 2 lag 0.075) | 37.2 / 36.7 / 42.8 / 50.0 | 41.7 | + 1.36 |
| V2m0 (today's planner model) | 36.1 / 35.6 / 45.0 / 46.7 | 40.8 | - |
| V2b (Camp XP reference - 3) | identical to V2, run for run | 41.7 | + 1.36 |
| **V2z1 (zone 1 lag only)** | 42.2 / 40.0 / 48.3 / 48.3 | **44.7** | + 1.72 |

  The hero reaches Oruvath at the same power level (53.7-60.0 against 53.5-60.0), so the drop is in the fight. About half came from zone 2's lag: its drops come at a lower level, and the gear at Oruvath is 0.6 item levels lower. V2z1 removes that half. The rest (about 4 pp) is not the sim's model and not the XP of the Camp and the boss fight. Its cause is not found. Lever if wanted: BOSS_HP_LEVEL at hero 21-24.
- V2z1 against the full V2 arm at hero 21-24: XP a run 1-4 % lower, Legacy a run within ±3 %, zone 2 lowest HP 76-78 % (V2 82-84, main 75-77). The curve of section 4 stands.

## 6. The guided first run

Planner, `--map expedition --prep --guided --hero 1 --profile fresh --oruvath`, band table H1-5, seeds 9000-9039, 120 runs:

| | Reaches hero 2 before zone 2 | Hero XP | Minutes | Legacy (welcome included) | End hero level (median) | Win |
|---|---|---|---|---|---|---|
| main | 120 / 120 | 8 972 | 36.7 | 180 | 5 | 1.7 % |
| V2 | 120 / 120 | 6 799 | 35.8 | 185 | 4 | 5.0 % |

## 7. Limits

- The planner is the "good player". Its cells hold the hero's level fixed and buy nothing. The campaign is chained by hand, not campaign v3. 180 runs per cell is about ±7 pp per cell and ±3-4 pp per pooled band.
- The scratch planner model (sim/lib/model.mjs) uses the hero's power level as the zone reference. That is close inside a zone, and the engine pays against the zone's band.
- The H1 cell is a later profile at hero 1, not the lean first run; section 6 covers the guided run.
- Clarity (legacy.md 4.7 E6) is spec only and is not measured. The owner should see the level-up banner and the run-end "Kept / Left behind" lines in a build.
