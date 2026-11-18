# Legacy class numbers on the 1-25 scale, 2026-11-18

Status: **draft** (Lead Game Designer), for the Lead; nothing here is approved by the owner. The change is docs/specs/legacy.md 2.4.2 and its section 10 rows. src/, game.html and balance.md are untouched; every arm ran on scratch copies of the native engine (sim/out/cls/ on the designer's worktree, not committed).

## Verdict

1. **B6 passes in every band** at 600 runs per class per band, on the seeds of the "before" table (6000-6119): spreads 6.7 / 5.0 / 5.3 / 4.2 / 4.5 pp (before 5.8 / 10.3 / 15.0 / 11.5 / 20.0).
2. **Nine readable changes** (legacy.md 2.4.2): four learn levels (Cinder Storm to hero 9, Glacial Tomb to 18, Feign Stillness to 10, Heartseeker Shot to 18), three spell numbers (Heartseeker Shot -5 %, Barbed Arrow +5 %, Open Vein +15 %), one talent (Ferocity 0.18 → 0.10 a rank) and four BOSS_HP_LEVEL entries (hero 9: 1.08; hero 23-25: 0.93 / 0.92 / 0.92).
3. **Top end:** pooled 21-25 50.8 → 44.6 %, H25 58 → 54 %, H22 40 %. The overshoot was both a class number and the HP table: the Hunter's +15-20 pp at H23-25 is Ferocity at talent points 24-26 of the default build; the remaining rise of every class from H22 to H25 is BOSS_HP_LEVEL falling to 0.89. Fix the Hunter with Ferocity and move the HP table only a little: at 0.94-0.96 for H21-25 the Hunter, the slow class, falls to 26-35 % (Final Dark). H24-25 still sit 6-10 pp above H22; one more step at H25 (0.95) is the next lever, not measured.
4. **The curve rises** 2 % (H1) → 26 % (H6-10) → 46 % (H15), holds 37-43 % at H16-22 and ends at 54 %. First win: around run 4-5 at hero 10-12 (41 % of campaigns by run 4, 60 % by run 5) [inference: the cell rates chained over 1.4's start levels 1, 4, 7-8, 10, 12]. One-button play: 1 win in 1 500 runs.
5. **Fresh seeds** (8000-8059, 300 runs per class per band): B6 passes in bands 1-20 and fails 21-25 by 2.7 pp (Mage 53.0 %). Pooled over both seed sets (900 runs per class), band 21-25 is 43.3 / 47.2 / 45.4 % (3.9 pp). Band 21-25 is the least settled reading.
6. **Finding for the sim:** the Camp bar template (balance.md 1.2) ranks fill spells by raw damage, so Frost Lance's chill (-30 % of Oruvath's damage) counts for nothing. At 2.4.1's +15 % Frost Lance stays on the bar only 3 % above Living Flame (hero 14); at +10 % it drops off and the Mage's 11-15 rate falls 52 → 21 % in full runs, while boss replays on the same states move it 7 pp. 2.4.1's steep Frost Lance readings were this threshold. With Glacial Tomb at 18 both spells fit to hero 17, so Frost Lance is off the edge.

## Band table (seeds 6000-6119, 600 runs per class per band)

| Band | Before: Rogue / Mage / Hunter (pooled) | Spread | After | Spread | B6 |
|---|---|---|---|---|---|
| 1-5 | 1.5 / 1.3 / 7.2 (3.3) | 5.8 | 2.0 / 1.3 / 8.0 (3.8) | 6.7 | pass (Hunter + 4.2 of the mean) |
| 6-10 | 21.5 / 19.7 / 30.0 (23.7) | 10.3 | 21.5 / 26.5 / 25.3 (24.4) | 5.0 | pass |
| 11-15 | 38.8 / 47.2 / 32.2 (39.4) | 15.0 | 39.5 / 40.3 / 35.0 (38.3) | 5.3 | pass |
| 16-20 | 34.8 / 42.3 / 46.3 (41.2) | 11.5 | 38.3 / 41.8 / 42.5 (40.9) | 4.2 | pass |
| 21-25 | 43.3 / 45.7 / 63.3 (50.8) | 20.0 | 42.5 / 44.3 / 47.0 (44.6) | 4.5 | pass |

95 % intervals after: 1-3 / 1-3 / 6-10, 18-25 / 23-30 / 22-29, 36-43 / 36-44 / 31-39, about ±4 in bands 16-25. Reach 85-90 %, zone deaths 10-15 % of runs (before 10-15 %).

Win curve after (start hero level 1-25, pooled): 2, 7, 6, 3, 2, 26, 23, 22, 26, 26, 31, 33, 40, 41, 46, 43, 39, 40, 43, 39, 37, 40, 44, 48, 54 % (before: 1, 5, 7, 3, 1, 17, 25, 22, 32, 23, 35, 36, 36, 46, 44, 44, 41, 41, 39, 40, 41, 46, 54, 55, 58). The Mage's H6 is 36 % (was 0).

Fresh seeds 8000-8059 (300 runs per class per band): 3.3 / 1.0 / 8.3, 21.3 / 20.0 / 24.3, 42.0 / 37.0 / 36.0, 38.3 / 36.7 / 39.7, 45.0 / 53.0 / 42.3 %; spreads 7.3 / 4.3 / 6.0 / 3.0 / 10.7 pp.

## The changes and what each did

| # | Change | Measured effect (full runs unless marked) |
|---|---|---|
| 1 | Cinder Storm power 22 → 21 (hero 10 → 9) | Mage 6-10 18 → 31 % (calibration), H6 0 → 53 % with the boss at 1.00 |
| 2 | BOSS_HP_LEVEL[9] 1.00 → 1.08 | pooled H6 33 → 19 % (replays, exact); with 1 the Mage's H6 36 % |
| 3 | Glacial Tomb power 30 → 43 (hero 13 → 18) | Mage 11-15 52 → 39 % (calibration); at hero 16 instead 43 % |
| 4 | Feign Stillness power 28 → 23 (hero 12 → 10) | Hunter 6-10 29 → 24 %: Mark Prey (+8 % damage taken) leaves its Camp bar at hero 10 |
| 5 | Heartseeker Shot power 46 → 43 (hero 20 → 18), coefficients -5 % | Hunter 16-20 44 → 39 % at hero 18 and -10 %; -10 % left the Hunter at 20-33 % at H20-23 on fresh seeds, so -5 % (16-20 42.5 %, 21-25 47.0 %) |
| 6 | Barbed Arrow DoT l 0.495 → 0.52, p 0.20 → 0.21 | Hunter 11-15 32 → 35 % |
| 7 | Ferocity 0.18 → 0.10 a rank | boss replays at H24-25: 81-83 → 67-72 % of fights; without Ferocity 49-54 % |
| 8 | Open Vein DoT l 0.45 → 0.52, p 0.10 → 0.115 | Rogue 16-20 34.8 → 38.3 %, 21-25 38.7 → 42.5 % |
| 9 | BOSS_HP_LEVEL[23-25] 0.92 / 0.89 / 0.89 → 0.93 / 0.92 / 0.92 | pooled 21-25 about -5 pp (replays, exact) |

Tried and rejected: Volley Rain at hero 12 (Hunter 6-10 29 → 11 %: its Shard answer is a switch); Frost Lance +10 % instead of +15 % (Mage 11-15 52 → 21 %, the bar threshold above); Throat Jab silence 2 (Rogue unchanged: its zone deaths are casters' bolts); Feign Stillness at hero 16 (Hunter 11-15 +8 but 6-10 +5); Vanishing Step at hero 20 (Rogue -8 to -17 at H16-17; it is the Rogue's best boss spell); Deadfall Trap -15 % and pet dmgMult 0.9 (Hunter -9 to -10 in 16-25, too steep); flat BOSS_HP_LEVEL 0.94-0.96 at H21-25 (Hunter 26-35 %).

## How the causes were found

- **Boss replays** of states dumped before FIGHT_BOSS (seeds 7000-7059, 60 runs per class and level), with a damage breakdown per spell and the Camp bar per level. A replay is exact for boss settings (BOSS_HP_LEVEL), close for late boss spells (Ferocity: replay 43 / 48 / 48 / 67 / 72 % against full runs 43 / 48 / 48 / 67 / 74 % at H21-25), and wrong for spells that change the Camp bar (Frost Lance).
- **Per-class boss win by hero level at the boss** (before): Rogue 53 % at hero 9, 15-20 % at 10-11 (BOSS_HP_LEVEL 1.00 → 1.12); Mage 0 % at 5-9, 64-80 % at 16-17 (Glacial Tomb, Lattice Ward, Frost Lance's chill, half-HP Shards); Hunter 1-3 % at 7-9, 38-45 % at 10-11 (Volley Rain, Mark Prey), 81-83 % at 24-25 (Ferocity).
- **The Rogue** loses 15-25 % of runs in zones at hero 16-25 (others 2-11 %), mostly to casters' bolts; its boss win is level with the others. Open Vein, on its Camp bar at every level, lifts its boss fights from 16 without touching the zones much.

## B7 (talent trees), reported, not fixed

Final rule before change 5's -5 % (Heartseeker -10 %), seeds 6000-6011, 12 runs per class and level (60 per band), worst tree >= 0.60 × best:

| Class (trees 0 / 1 / 2) | 1-5 | 6-10 | 11-15 | 16-20 | 21-25 |
|---|---|---|---|---|---|
| Rogue (Bladework / Shadowcraft / Venomcraft) | 0 / 0 / 0 | 0 / 0 / 23 fail | 0 / 0 / 43 fail | 18 / 3 / 38 fail | 58 / 42 / 38 pass |
| Mage (Pyromancy / Rimecraft / Arcanism) | 0 / 2 / 0 fail | 15 / 28 / 18 fail | 8 / 47 / 7 fail | 38 / 37 / 10 fail | 47 / 37 / 40 pass |
| Hunter (Beastbond / Marksmanship / Wildcraft) | 5 / 7 / 13 fail | 23 / 2 / 22 fail | 52 / 2 / 32 fail | 83 / 20 / 40 fail | 55 / 23 / 38 fail |

B7 fails in 12 of 15 cells. Venomcraft, Rimecraft and Beastbond carry their classes until hero 20; Marksmanship never reaches 25 %. Beastbond stays ahead with Ferocity at 0.10. Glacial Tomb at 18 also lowers Pyromancy and Arcanism at 11-20 (7-10 %). Tree balance on the 1-25 scale stays a separate class task.

## Method

- Engine: origin/main 10840c3 (src/ as built), both switches on (`C.GATES.legacy`, `C.GATES.oruvathLegacy`). Scratch copies with an environment override of SPELL, TALENT, PET and BOSS_HP_LEVEL values and a boss-state dump; a scratch copy without overrides reproduced the before table's records seed for seed (H14, 60 of 60 runs).
- Cells (D118): `node sim/legacy-run.mjs grid --native --oruvath --levels 1-25 --tables sim/tables/legacy-hx --runs 120 --seed 6000 --resume` (expedition map with the start camp, planner with the hero-XP model, VAL_HERO_XP 40, profile `later`, P0-group default trees Rogue Venomcraft, Mage Rimecraft, Hunter Wildcraft, pet ridgewolf, `--warmup 0`, each level read with its band's table). Before: the native report's grid on the same seeds.
- A class change moves only that class's runs, so the after table joins per-class grids on the same seeds (Mage: one grid; Rogue and Hunter: the grid plus per-class grids for the levels the last change touches). Calibration on seeds 7000-7059; fresh check on 8000-8059 (60 runs per class and level); one-button `--bot onebutton`, 20 runs per class and level; B7 `--tree 0/1/2`, 12 runs per class and level. About 45 000 runs.
- B6 as balance.md 2 on point estimates: every class within 5 pp of the three-class mean and max - min <= 8 pp.

## Limits

- 600 runs per class per band: about ±4 pp per class at 40 %; the 6000 seeds are the measurement, the 8000 seeds (300 per band) show band 21-25 can still fail on noise.
- Changes 1-5 lean on the sim's Camp bar (which spell a new one displaces); a better bar template (open item, section Verdict 6) would move them.
- Changes 5-8 and BOSS_HP_LEVEL also apply to level-60 runs under the switch: re-run the P0 and PALL cells (B6, B26-B29) when built (as 2.4.1 open item 3).
- B7 and one-button ran on the step before change 5's -5 %; no campaigns, Legacy purchases, trees or sets.
