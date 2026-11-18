# Legacy on the native engine: band tables and the gap to the scratch build, 2026-11-18

Status: **draft** (Simulation & Balance Engineer), for the Lead and the Designer; nothing here is approved by the owner. src/,
game.html and the specs are untouched. Both switches on in every cell: `C.GATES.legacy` and `C.GATES.oruvathLegacy` (D154-D156,
legacy.md 2.4.1).

## Verdict

1. **Band tables re-warmed on the native engine** and committed as new files: sim/tables/legacy-native/risk-H01-05.json ...
   risk-H21-25.json (300 warm-up runs per class per band). The scratch-engine tables in sim/tables/legacy/ are kept.
2. **Band table on fresh seeds, 600 runs per class per band** (seeds 6000-6119): pooled win 4.7 / 17.8 / 26.8 / 29.2 / 38.4 %,
   reach 82 / 74 / 73 / 74 / 87 %, 13-27 % of runs die in zones. **B6 passes in one band of five** (16-20, 7.8 pp); bands 1-5, 6-10
   and 11-15 fail by under 1 pp (8.7 / 8.7 / 8.8 pp), band 21-25 fails by 6 pp (Rogue low).
3. **The gap to the Designer's scratch build is not the tables and not zone damage. It is a difference in what the planner's
   model reads as banked XP** (exact cause below). On the scratch engine, `p.xp` is raw XP toward a level that costs 10 ×
   xpToNext, so the planner's model credited the hero with 0-9 levels it did not have. Those phantom levels lowered the XP the
   model expected from each quest. The scratch planner took about 16 quests a run; on the native engine it takes about 21. Each
   run is about 3 minutes longer, and the extra fights fall in zones 4-6. Swapping only this reading moves native reach from
   73-79 % to 82-91 % and scratch reach from 86-88 % to 81-84 %.
4. **A smaller, real rule difference** remains in bands 11-25: an in-run power level costs 12.2 / 14.2 / 15.7 level-equivalents
   on the native hero XP curve against a flat 10 on the scratch, so heroes gain fewer levels in a run (+4.4 to +5.0 against
   +6.0 to +6.5). It may account for the remaining 4 pp of reach in band 16-20 [inference: within about 2 standard errors].
5. **Next:** do not move class numbers on these readings. First build the hero-XP model in the planner (legacy.md 5.8 item 3,
   VAL_HERO_XP), so the planner values hero XP as the engine pays it. Then re-read B6 at 600 runs per class per band.

## Band table (native engine, native tables, fresh seeds)

Seeds 6000-6119: 120 runs per class and hero level, **600 runs per class per band**, 9 000 runs. D118: expedition map with
the start camp (`--map expedition --prep`), planner, profile `later` (two runs played, nothing bought), P0-group default trees,
pet ridgewolf, `--warmup 0`, each hero level read with its band's table from sim/tables/legacy-native/.

| Band | Win: Rogue / Mage / Hunter (pooled) | 95 % interval per class | B6 spread | Reach | Died in zones | Zone deaths by kind (% of runs): quest / elite / dungeon / Dimmed / grind | Boss fights won R / M / H | Final Dark share of boss losses R / M / H | Minutes | Power level at Oruvath |
|---|---|---|---|---|---|---|---|---|---|---|
| 1-5 | 4.5 / 0.5 / 9.2 (4.7) | 3-6 / 0-1 / 7-12 | 8.7 pp, fail | 82.2 % | 17.8 % | 7.6 / 4.6 / 2.9 / 2.1 / 0.6 | 5.5 / 0.7 / 10.2 | 0 / 7 / 31 % | 40.9 | 16.1 |
| 6-10 | 16.5 / 14.2 / 22.8 (17.8) | 14-20 / 12-17 / 20-26 | 8.7 pp, fail | 74.4 % | 25.6 % | 9.3 / 6.1 / 5.1 / 4.9 / 0.3 | 23.3 / 18.6 / 29.9 | 0 / 5 / 37 % | 46.0 | 27.2 |
| 11-15 | 28.7 / 30.3 / 21.5 (26.8) | 25-32 / 27-34 / 18-25 | 8.8 pp, fail | 73.0 % | 27.0 % | 10.3 / 8.1 / 3.7 / 4.4 / 0.6 | 40.7 / 41.9 / 28.2 | 0 / 15 / 35 % | 43.4 | 36.9 |
| 16-20 | 25.0 / 29.8 / 32.8 (29.2) | 22-29 / 26-34 / 29-37 | 7.8 pp, pass | 74.4 % | 25.6 % | 9.7 / 8.2 / 4.4 / 2.6 / 0.7 | 36.6 / 38.2 / 42.7 | 0 / 1 / 42 % | 40.5 | 48.3 |
| 21-25 | 31.0 / 39.2 / 45.2 (38.4) | 27-35 / 35-43 / 41-49 | 14.2 pp, fail | 87.1 % | 12.9 % | 6.9 / 2.8 / 0.7 / 1.5 / 0.9 | 39.6 / 43.0 / 49.2 | 0 / 2 / 24 % | 32.8 | 58.4 |

Deaths in zones by zone: in bands 6-20, 74-96 % of them fall in zones 4-6. Dungeons and elites entered a run: 0.31 / 2.02,
1.63 / 3.53, 1.38 / 3.02, 1.31 / 3.07, 0.49 / 1.70.

Win curve by start hero level (win %):

| Hero level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pooled win % | 1 | 5 | 4 | 4 | 9 | 19 | 16 | 20 | 18 | 17 | 24 | 28 | 28 | 29 | 25 | 27 | 29 | 27 | 33 | 30 | 27 | 47 | 53 | 58 | 7 |
| Rogue | 0 | 0 | 2 | 3 | 18 | 20 | 10 | 18 | 15 | 19 | 33 | 37 | 28 | 23 | 22 | 23 | 26 | 23 | 30 | 23 | 17 | 37 | 38 | 53 | 10 |
| Mage | 0 | 2 | 1 | 0 | 0 | 10 | 13 | 13 | 20 | 16 | 21 | 26 | 37 | 40 | 28 | 28 | 30 | 28 | 26 | 37 | 36 | 45 | 58 | 54 | 3 |
| Hunter | 4 | 14 | 10 | 8 | 9 | 26 | 24 | 28 | 19 | 17 | 18 | 23 | 18 | 23 | 26 | 30 | 33 | 28 | 43 | 31 | 28 | 60 | 63 | 68 | 8 |
| Reach % | 63 | 77 | 88 | 92 | 92 | 82 | 78 | 79 | 71 | 62 | 83 | 76 | 73 | 68 | 66 | 72 | 71 | 73 | 77 | 80 | 73 | 79 | 86 | 98 | 100 |

Reading: the curve rises from 1 % at H1 to 16-20 % at 6-10 and 24-33 % at 11-21. It then jumps to 47-58 % at 22-24 and falls
to 7 % at H25. Both ends are the old artefact: once the in-run level reaches 60, the planner stops valuing XP (legacy.md 5.8
item 3, not built). Inside each band, reach falls with the hero level (H10 62 %, H15 66 %): late levels of a band read a table
warmed on the whole band. The shape of 2.4.1 holds: the Rogue never loses to Final Dark, the Hunter is the slow class (24-42 %
of its boss losses), and in bands 1-20 boss-fight win rates are within about 5 pp of the scratch build, except the Hunter in
band 11-15 (28 % against 37 %). In band 21-25 they are 5-10 pp higher for the Mage and the Hunter.

## What the native warm-up saw

`node sim/legacyreport.mjs --tables <dir>` (entries / deaths over 300 warm-up runs a class, three classes):

| Band | dungeon: native / scratch tables | elite | elite2 | quest3 |
|---|---|---|---|---|
| 1-5 | 275 / 54 (19.6 %) ; 67 / 39 (58.2 %) | 1358 / 50 (3.7 %) ; 1004 / 35 (3.5 %) | 452 / 28 (6.2 %) ; 354 / 25 (7.1 %) | 3356 / 55 (1.6 %) ; 2900 / 40 (1.4 %) |
| 6-10 | 1512 / 60 (4.0 %) ; 1060 / 51 (4.8 %) | 2180 / 23 (1.1 %) ; 2323 / 29 (1.2 %) | 1091 / 39 (3.6 %) ; 993 / 31 (3.1 %) | 4360 / 97 (2.2 %) ; 3211 / 71 (2.2 %) |
| 11-15 | 1175 / 73 (6.2 %) ; 359 / 38 (10.6 %) | 1941 / 51 (2.6 %) ; 2539 / 58 (2.3 %) | 698 / 43 (6.2 %) ; 600 / 27 (4.5 %) | 3174 / 122 (3.8 %) ; 1617 / 80 (4.9 %) |
| 16-20 | 1148 / 77 (6.7 %) ; 625 / 45 (7.2 %) | 2207 / 48 (2.2 %) ; 2394 / 34 (1.4 %) | 632 / 30 (4.7 %) ; 303 / 13 (4.3 %) | 2070 / 122 (5.9 %) ; 1112 / 66 (5.9 %) |
| 21-25 | 437 / 22 (5.0 %) ; 162 / 8 (4.9 %) | 1334 / 24 (1.8 %) ; 471 / 9 (1.9 %) | 346 / 27 (7.8 %) ; 152 / 12 (7.9 %) | 1494 / 55 (3.7 %) ; 449 / 28 (6.2 %) |

The native warm-up enters more dungeons and many more three-mob quests (quest3) than the scratch one, for the reason in the
next section: the native planner stays longer in each zone.

## The gap to the scratch build

**Arms on the same seeds** (5000-5059, 60 runs per class and hero level; hero levels 6, 8, 10, 12, 14, 16, 18, 20 for the four
arms, 1 440 runs each; the full grids give the same picture). Columns: reach % / win % / quests a run / minutes / power levels
gained before Oruvath.

| Arm | Band 6-10 | Band 11-15 | Band 16-20 |
|---|---|---|---|
| Scratch build (the Designer's V4 grid, scratch tables) | 87.8 / 21.7 / 16.3 / 43.2 / +8.0 | 86.1 / 35.6 / 15.1 / 38.8 / +6.5 | 86.5 / 39.8 / 13.8 / 37.8 / +6.0 |
| Scratch build, planner reads XP as on the native engine (B) | 83.5 / 17.4 / 20.6 / 47.1 / +9.6 | 81.9 / 24.2 / 19.9 / 43.1 / +8.0 | 80.9 / 25.0 / 19.4 / 42.7 / +8.1 |
| Native, scratch tables (Engine hand-off section 6) | 78.7 / 18.0 / 21.0 / 46.1 / +9.2 | 76.4 / 30.3 / 20.2 / 41.5 / +5.9 | 73.3 / 28.5 / 19.8 / 40.9 / +5.3 |
| Native, native tables | 77.6 / 17.4 / 20.7 / 46.5 / +9.5 | 71.7 / 27.8 / 19.7 / 43.5 / +6.6 | 76.3 / 27.8 / 19.2 / 40.7 / +5.3 |
| Native, planner reads XP as on the scratch (A) | 90.6 / 27.2 / 16.9 / 42.8 / +8.0 | 88.3 / 39.7 / 15.9 / 38.4 / +5.0 | 82.2 / 35.4 / 15.5 / 37.7 / +4.4 |

Full native grids on seeds 5000-5059, all 25 levels (300 runs per class per band). Reach with the scratch tables: 85.6 / 80.3 /
77.9 / 73.6 / 83.6 %. With the native tables: 83.3 / 76.6 / 72.3 / 76.7 / 86.6 %. Quests a run are about 21-22 in both.

1. **Not the tables.** The engine's check and the Designer's grid used the same tables (sim/tables/legacy) on the same seeds.
   Re-warming on the native engine moves reach by -5 to +3 pp per band and leaves quests a run unchanged.
2. **Not zone damage.** The fight code is the same: ZONE_TIER_DMG of the same values on every template enemy, zone danger and
   rings as in the patch. The first fights of a seed are identical on both engines until the planner's first different map
   choice (seed 5000, Mage, H10: identical up to a MOVE where the scratch planner passes through). With the planner's choices
   matched (arm A against the scratch grid), the death rate per fight is the same. Zone-6 quests: 0.7 % against 0.8 %; zone-6
   elites: 2.6 % against 3.0 %. Without the match it is 2.1 % on the native engine: the extra quests are the riskier ones.
3. **The cause: the planner's model reads banked XP differently (sim side).**
   - sim/lib/model.mjs `makeCtx` sets the model state to `{ L: p.level, xp: p.xp, ... }`. `giveXp` levels it up while
     `m.xp >= XN[m.L]`, where `XN[L] = R.xpToNext(L)` (model.mjs line 33). It also gives XP by `killXp` / `evXp` at
     `diffMod(cl - m.L)`, and values a node by the change in `bankedPos(m)`.
   - On the scratch engine, sim/legacy-patch.py ("levels cost k x xpToNext", src/engine/progress.js patched,
     k = 10) makes `p.xp` raw XP that runs from 0 to 10 × xpToNext(P) before a level. At the first award of each node it
     evaluates, the model credits 0-9 levels the hero does not have (the "banked-level inflation" of the engine hand-off,
     section 5). At those phantom levels each quest's XP is worth fewer levels (higher xpToNext, lower diffMod). The planner
     therefore leaves a zone after fewer quests.
   - On the native engine, `p.xp` is hero XP (progress.js `eventXp` under `isLegacy`: HERO_XP_UNIT = 100 per
     level-equivalent, at most HERO_XP[H] <= 4 100). Against xpToNext(P) of 14 920 at P 23, that is at most 0.2 of a level,
     so no phantom levels. The planner values quests at the hero's true level and takes about 5 more a run, mostly in zones
     4-6.
   - Arm A gives the native model the scratch reading: `m.xp = ((p.xp / 100) mod 10) × xpToNext(P)`, 0-9 phantom levels.
     Quests a run fall to 16-17, reach rises 9-12 pp and wins 7-9 pp. Arm B gives the scratch model the true fraction
     (`m.xp = p.xp / 10`): quests rise to 20-21, reach falls 4-6 pp and wins 4-15 pp. Each arm changes only that one line.
4. **A real rule difference, smaller:** in-run levelling. The scratch build charges a flat 10 level-equivalents per power level
   (LEG.k). The native hero XP curve (HERO_XP over POWER_OF_LEVEL) costs 8.6 / 9.4 / 12.2 / 14.2 / 15.7 level-equivalents per
   power level by band. With the planner's choices matched (A against the scratch grid), native heroes gain +5.0 / +4.4 power
   levels before Oruvath in bands 11-15 / 16-20, against +6.5 / +6.0. This may explain the 4 pp of reach that A still lacks in
   band 16-20 [inference: about 2 standard errors at 540 runs a band]. In band 11-15, A reaches 2 pp more than the scratch
   build.

Neither reading of XP is correct for Legacy. The scratch planner undervalued XP. The native planner values in-run levels by
the old 1-60 curve, against hero XP that it does not model (legacy.md 5.8 item 3). The planner needs a hero-XP model:
level-equivalents at HERO_XP_UNIT, hero levels from HERO_XP, power from POWER_OF_LEVEL, and VAL_HERO_XP for the winner and
the leveller. Without it, B6 and the win curve depend on how long the planner stays in a zone.

## Method

- Engine: origin/main 6a8850d (src/ unchanged since; the sim commits 1fd7998 and 6db8710 add only `--resume`, `--curve` and
  the tables). Cells: `sim/run.mjs --hero H --oruvath` through `sim/legacy-run.mjs --native --oruvath`, two workers.
- Warm-up: `node sim/legacy-run.mjs warm --native --oruvath --band <lo-hi> --runs 30 --rounds 2 --resume --out <dir> --table
  sim/tables/legacy-native/risk-H<lo>-<hi>.json`. That is 30 runs per class at every hero level of the band, two chained rounds
  (the first cell from RISK_PRIOR), seeds 9 000 000 + 100 000 × round + 1 000 × H, 300 runs per class per band, 4 500 runs.
- Band table: `node sim/legacy-run.mjs grid --native --oruvath --levels 1-25 --tables sim/tables/legacy-native --runs 120
  --seed 6000 --resume --out <dir>`, then `node sim/legacyreport.mjs <dir> --levels --curve`. Same-seed check: `--runs 60
  --seed 5000`.
- Arms A and B are diagnostics on copies under sim/out (not committed). A is the repository's src/ and sim/ with the one line
  of model.mjs changed, run with `legacy-run.mjs grid --native --oruvath` and the scratch tables. B is the Designer's scratch
  copy (sim/out/oru/scratch3 on the Designer's worktree, 05f3b48 + legacy-patch.py, the V4 arm: the 2.4.1 values as LEG fields) with the other line changed. Unchanged,
  the scratch copy reproduces the V4 records exactly (checked on seeds 5000-5001 at H10). The native engine reproduces the
  engine's grid of hand-off section 6.
- `--resume` (new): a stopped warm-up or grid restarts at its first cell without summary.md, with the same seeds and results.
- B6 as balance.md 2 on point estimates: every class within 5 pp of the three-class mean and max - min <= 8 pp.

## Limits

- 600 runs per class per band: about ±3.5 pp per class at 25 % (the Wilson intervals above), so a band's spread carries about
  ±4 pp. Bands 1-15 fail B6 by less than 1 pp: this is a borderline reading, not a clear failure.
- Band 21-25 and H25 are low readings until the planner values hero XP (5.8 item 3).
- The arms use the scratch tables and even hero levels only (1 440 runs each).
- No Camp waves, Legacy purchases, trees or sets. One profile, one bot.
