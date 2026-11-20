# Hunter dungeon route, B6 with the v3d hall, and Lost Technique I (2026-11-20)

Status: **draft** (Lead Game Designer, with leave to run the sim), for the Lead. Nothing here is approved by the owner; every number below is a proposal. Task: BACKLOG row 2026-11-20 "Hunter hero-25 gap with a bought hall" (D166 section 4), with the v3d hall of D167. Nothing in src/ was changed: every arm is a checked edit on a scratch copy of the repository (sim/hunter-arms.sh).

## Verdict

1. **The dungeon route is not the lever.** With the whole v3d hall the Hunter's hero 25 lead does not come from the dungeons. Taking the Cartographer's dungeon mark away (the strongest dungeon-route change: the Hunter's clears fall from 3.5 to 1.6 a run) lowers every class by the same 2 pp (Rogue -2.3, Mage -1.7, Hunter -2.0 ± 3.1) and leaves B6 at 11.0 pp. Halving the dungeon boss loot (3 rolls to 2), +14 % dungeon damage, and a pet that stays down inside a dungeon move B6 by at most 1.3 pp. The three options of the techniques report, section 4, are measured or bounded below; none brings B6 inside 8 pp. The +17.5 pp of Cartographer + Old Hand is true when they are the only entries owned, and it is mostly the dungeon mark there (section 3); with the whole hall bought it is gone.
2. **What does work is a number on the Hunter that only exists at hero 24-25: Ferocity** (the pet damage talent; the Hunter buys its first rank at hero 24 and its second at 25, none at hero 20). Legacy Ferocity 0.10 → **0.045** a rank (`ORUVATH_TALENT.h_a2.petDmgPct`) takes the Hunter at hero 25 with the v3d hall from 83.8 % to 77.9 % and B6 from 12.3 to 6.4 pp, and does not touch hero 20 (no Ferocity rank there; run for run identical).
3. **Lost Technique I can be worth its 120 points from hero 18 as a passive, not as a spell.** Ricochet Bolt cannot win a bar slot from hero 18: it is Keen Shot's numbers at 35 focus, minus Steady Aim and Efficiency, plus bounces that need two enemies. Put on the bar by number or by rule it is no better than the spell it replaces (-8 to +2 pp, no clear gain, section 4). As a passive it pays: **while Lost Technique I is owned, Keen Shot also hits up to two other enemies for 30 %**: +10.6 pp at hero 10 (spell: +14.3), +1.4 at 14, +2.0 at 18, **+2.6 ± 1.4 at 20, +4.0 ± 1.9 at 25**. It widens hero 25 by the same 4 pp, which is why it travels with the Ferocity cut.
4. **Package (draft): Ferocity 0.10 → 0.045 and Lost Technique I as the Keen Shot passive.** B6 with the v3d hall: hero 20 **0.6 pp** (Rogue 63.7, Mage 63.1, Hunter 63.5; 1 500 runs a class), hero 25 **6.4 pp** (74.2, 71.5, 77.9; 1 200 a class). One cost, stated plainly: with **nothing bought** B6 at hero 25 goes from 2.2 to **9.2 pp** (Hunter 43.0 against 52.2 and 50.0, 600 a class), 1.2 pp over the line, and no Ferocity value passes both cells (section 5). The hall is bought by run 9, hero 25 is reached after it, so the Lead can read the nothing-bought hero 25 cell as the one that does not occur; it is the Lead's call.
5. **H20 with nothing bought, 13.1 pp, is not a seed effect.** On fresh seeds 8000-8449 it is 10.9 pp (8000-8119 alone: 9.2), pooled with 9000-9449 it is 12.0 pp (Rogue 45.7, Mage 37.3, Hunter 33.7; 900 runs a class, about ±4.5 pp at 95 % on the Rogue - Hunter difference). D157's pass was the band 16-20 pooled, and that still passes on 8000-8119 (5.5 pp); single levels at 120 runs a class swing from 6 to 18 pp (section 2). With the v3d hall hero 20 passes (2.9 pp at 1 500 runs a class).

## 1. Set-up

- Main 2a48b8a (D167: hall prices v3d), the D166 bar fix included, so the Hunter's techniques change no fight at hero 18-25 as built. `C.GATES.legacy`, `oruvathLegacy`, `economyV2` on; `sim/legacy-run.mjs grid --native --oruvath --econ --hall v3d` (the whole v3d hall at top ranks, techniques included; `v3d:<entries>` the named entries only; `-nt` without techniques; `none` nothing bought). Planner, expedition map with the start camp, profile `later`, band tables sim/tables/legacy-hx, seeds from 9000 (the seeds of LH1 and the techniques report; extended to 10199 at hero 25 and 10499 at hero 20; fresh set 8000-8449 for section 2).
- Arms: `sim/hunter-arms.sh <arm> <scratch dir>` copies the repository to a directory with `/scratch` in its path, makes one checked edit, and the copy's own `legacy-run.mjs` plays the cell. The `base` arm is the repository's cell run for run (checked: Hunter, hero 25, 40 runs, 32 wins in both). Tables: `sim/armstats.mjs` (win rate, B6 spread and largest distance from the mean, dungeons, boss-fight win, paired difference on the same seeds). **All ± are one standard error; 95 % is ± 1.96 ×.** A Hunter-only change leaves the Rogue and Mage as they were (their runs are identical), so Hunter cells take the Rogue and Mage of the base cell.
- Precision: 1 200 runs a class at hero 25 (± 2.2-2.6 pp at 95 %) and 1 500 at hero 20 (± 2.5-2.6) for the base and the package; screening cells hold 300-600 (± 4-6 pp at 95 %; paired differences on the same seeds are tighter, ± 1-3 pp one standard error). Differences under about 3 pp in screening cells are not distinguishable from zero.

### Baseline: the v3d hall after D166

| Hero | Runs a class | Rogue | Mage | Hunter | B6 spread | Largest distance from mean | B6 (8 pp, ± 5) | Dungeons a run R / M / H |
|---|---|---|---|---|---|---|---|---|
| 20 | 450 | 64.9 | 62.7 | 59.3 | 5.6 | 3.0 | pass | 2.19 / 2.57 / 2.26 |
| 20 | 1 500 | 63.7 | 63.1 | 60.9 | **2.9** | 1.7 | pass | 2.21 / 2.62 / 2.33 |
| 25 | 600 | 73.8 | 70.2 | 81.8 | 11.7 | 6.6 | fail | 1.60 / 0.83 / 3.47 |
| 25 | 1 200 | 74.2 | 71.5 | 83.8 | **12.3** | 7.3 | fail | 1.61 / 0.84 / 3.54 |

Hero 20 passes with the hall; hero 25 fails with the Hunter 9.6 pp above the Rogue and 12.3 above the Mage. (The 11.5 pp of the techniques report is the v2 hall; v3d is 12.3 at 1 200 runs.) Hunter dungeons at hero 25: 3.5 a run against 1.6 and 0.8; at hero 20 all three clear 2.2-2.6, so the dungeon gap is a hero 25 matter only.

## 2. H20 with nothing bought: seed effect?

| Seeds | Runs a class | Rogue | Mage | Hunter | Spread | Largest distance from mean |
|---|---|---|---|---|---|---|
| 9000-9449 (LH1, techniques report) | 450 | 46.9 | 36.4 | 33.8 | 13.1 | 7.9 |
| **8000-8119** (the fresh set asked for) | 120 | 45.0 | 39.2 | 35.8 | 9.2 | 5.0 |
| 8000-8449 (fresh, 8000-8119 included) | 450 | 44.4 | 38.2 | 33.6 | 10.9 | 5.7 |
| both sets | 900 | 45.7 | 37.3 | 33.7 | **12.0** | 7.0 |

Rogue ahead of Hunter by 9.2, 10.8 and 13.1 on three seed sets: the sign and size repeat, so 13.1 is partly high luck (the pooled 12.0) and the failure is real. The standard error of the Rogue - Hunter difference at 900 runs a class is 2.3 pp, so 8 pp is outside the 95 % interval. Band 16-20 pooled on seeds 8000-8119 (120 runs a class per level, 600 per class): Rogue 41.7, Mage 37.8, Hunter 43.3, **spread 5.5, pass**, as D157 read it. The levels of the band alone, 120 runs a class: spread 9.2 / 16.7 / 17.5 / 5.8 / 9.2 at hero 16-20 (error of one class ± 9 pp at 95 %), so D157's band reading is not contradicted; a single level needs 450 runs a class or more to be read. The Hunter is the lowest class at hero 20 with nothing bought (33.7 against 45.7 and 37.3), the opposite side from the hero 25 hall gap, which is why a general Hunter cut cannot serve both (section 5).

## 3. The three options, and what the dungeon route does at hero 25

Hero 25, v3d hall, seeds 9000-9299 (300 runs a class), paired on seed with the base:

| Arm | Rogue | Mage | Hunter | Spread | Dungeons a run R / M / H | Difference to base R / M / H (pp ± SE) |
|---|---|---|---|---|---|---|
| base | 73.7 | 70.3 | 81.7 | 11.3 | 1.61 / 0.82 / 3.48 | - |
| **nomark**: Region Charts (Cartographer) no longer mark the dungeon's node | 71.3 | 68.7 | 79.7 | 11.0 | 0.89 / 0.36 / 1.57 | -2.3 ± 2.9 / -1.7 ± 2.0 / -2.0 ± 3.1 |
| drops2: dungeon boss rolls 3 → 2 | 70.7 | 71.0 | 81.7 | 11.0 | 1.56 / 0.81 / 3.41 | -3.0 ± 2.4 / +0.7 ± 0.9 / +0.0 ± 2.3 |
| dmg: dungeon trash damage 1.1 → 1.25, boss 1.5 → 1.75 (option 1) | 73.7 | 70.3 | 80.3 | 10.0 | 1.60 / 0.82 / 3.48 | +0.0 / +0.0 / -1.3 ± 1.8 |
| pet: a pet that falls in a dungeon's trash stays down for the boss (option 1, pet tank) | 73.7 | 70.3 | 80.3 | 10.0 | 1.61 / 0.82 / 3.47 | +0.0 / +0.0 / -1.3 ± 0.9 |

Hero 20, nomark (300 runs a class, base 66.0 / 61.7 / 57.3): 62.3 / 59.7 / 59.0, spread 3.3; the clears fall to 1.05 / 1.40 / 1.32.

- **Option 2 (Charts mark the region, not the node).** The `nomark` arm is its upper bound: a region mark is worth between no mark and today's node mark. It cuts the Hunter's clears by 55 %, the Rogue's by 45 %, the Mage's by 56 %, and every class loses 2 pp: in win-rate terms (logit) -0.12, -0.12, -0.07. The dungeon mark is class-neutral in the whole-hall regime, so no version of it can close a 12 pp gap. Not run, and why: a belief model for "dungeon somewhere in this region" in the planner is a sim build that nomark already bounds at 0 pp of B6.
- **Option 1 (dungeon numbers against a pet tank).** Damage +14 % on trash and +17 % on bosses, and the pet staying down after a trash fight, each take the Hunter -1.3 pp and leave the Rogue and Mage unchanged (the Mage's runs are identical to the base, run for run: it clears 0.8 dungeons a run and the extra damage changes none of its fights). The Hunter's death risk per dungeon entry is low (2.4 % of entries in its hero 16-20 table), so numbers on the dungeon cost it little; this is the likely reason, not measured. Not run: dungeon HP (arm `hp`) and a diminishing boss-drop rule (`dim2`, `dim1`), which act through the same loot and risk as `drops2` and `dmg` (the arms exist in the script).
- **Option 3 (accept)** is the fallback if the Lead prefers it; section 6 gives the package instead.

Why the +17.5 pp is not there with the whole hall: hero 25, 300 runs a class, hall entries alone, win rate and difference to nothing bought:

| Entries owned | Rogue | Mage | Hunter | Difference R / M / H (pp ± SE) | Dungeons a run H |
|---|---|---|---|---|---|
| nothing | 49.7 | 50.3 | 53.3 | - | 1.65 |
| Vigor II + Edge II | 62.0 | 57.0 | 65.7 | +12.3 / +6.7 / +12.3 (± 3.5) | 1.67 |
| Satchel + Pockets + Quartermaster II (Satchel alone gives the same cell) | 51.7 | 51.7 | 60.3 | +2.0 / +1.3 / **+7.0** (± 3.5) | 1.66 |
| Cartographer + Old Hand + Swift Boots | 57.7 | 49.0 | **67.7** | +8.0 / -1.3 / **+14.3** (± 3.8) | 3.63 |
| the same, Charts without the dungeon mark | 59.7 | 49.0 | 60.3 | +10.0 / -1.3 / +7.0 | 1.54 |
| Cartographer alone | 53.0 | 48.0 | 65.0 | +3.3 / -2.3 / +11.7 | 4.29 |
| Old Hand + Swift Boots | 59.0 | 51.7 | 56.7 | | |
| Second Breath | 57.7 | 52.3 | 54.0 | +8.0 / +2.0 / +0.7 | 1.65 |
| Quick Study II | 49.7 | 49.7 | 51.7 | no effect (the hero is at the cap) | |
| **the whole v3d hall** | 73.7 | 70.3 | 81.7 | +24.0 / +20.0 / +28.3 (± 3.7) | 3.48 |

In isolation the map entries are worth +14.3 to the Hunter against +8.0 and -1.3, and without the dungeon mark the Hunter's lead over the Rogue is gone (60.3 against 59.7): the techniques report's reading holds for the map entries alone. In the whole hall the classes are close to the win-rate ceiling (the Hunter reaches Oruvath in 99 % of runs and wins 84 % of those fights, the Rogue 76 %, the Mage 73 %), the entries add in win-rate terms (logit) rather than in points, and the Hunter's extra response to the hall is spread over three entries: the stat ranks (+12.3, as the Rogue), the Satchel (+7.0 against +2.0; not its free potion: halving the free potion's heal takes the Rogue from 51.7 to 43.7 and the Mage to 47.0, the Hunter only from 60.3 to 59.0) and the map entries. The Hunter's boss-fight win goes from 54.8 % with nothing to 84.3 % with the hall, the Rogue's from 58.0 to 76.3 %, the Mage's from 55.3 to 72.7 %. The class kit decides this fight at hero 25, and it is the kit that has to be trimmed.

## 4. Hunter numbers, and Lost Technique I

Hunter-only arms, hero 25 and 20, v3d hall, seeds 9000-9599 / 9000-9449, paired on seed with the base (Hunter 81.8 / 59.3). Spread = B6 with the base Rogue and Mage.

| Arm | Hero 25 Hunter | B6 spread | vs base (pp ± SE) | Hero 20 Hunter | vs base |
|---|---|---|---|---|---|
| pdp: pet damage, `PET_DMG_POWER` 0.375 → 0.30 | 64.3 | 9.5 | -17.5 ± 2.3 | 38.2 | -21.1 ± 2.7 |
| so85: Savage Order × 0.85 | 81.0 | 10.8 | -0.8 ± 0.9 | 58.2 | -1.1 ± 1.6 |
| hpet: Ridgewolf HP share 0.50 → 0.42 | 80.7 | 10.5 | -1.2 ± 2.0 | 52.7 | -6.7 ± 2.6 |
| fer75: Ferocity 0.10 → 0.075 | 80.8 | 10.7 | -1.0 ± 1.7 | 59.3 | 0 (no rank) |
| fer60: Ferocity → 0.06 | 77.5 | 7.3 | -4.3 ± 1.9 | 59.3 | 0 |
| fer50: Ferocity → 0.05 | 75.3 | 5.2 | -6.5 ± 2.0 | 59.3 | 0 |

(Heartseeker Shot × 0.85 played the base run for run: the Legacy spell numbers `ORUVATH_SPELL` replace the constant the arm edited; the arm is invalid and left out.) The pet carries the Hunter: a fifth off the power term of its damage is -18 to -21 pp at both levels, so every pet number is too coarse and, with the HP share, hits hero 20 harder than hero 25. Ferocity is the only Hunter number that exists at hero 25 and not at hero 20 (talent ranks of the standard build: hero 20 none, 21-23 none, 24 one, 25 two; Thick Hide and Steady Aim, bought at 21-23, are not trimmed here). It also needs no new rule: it is an entry of the Legacy talent table that D157 already set (0.18 → 0.10).

**Lost Technique I at hero 18 and later.** Hero 20, 300-450 runs, Hunter-only, v3d hall (the technique owned):

| Arm | Hero 20 | vs base | Hero 25 | vs base |
|---|---|---|---|---|
| base (Ricochet Bolt never on the bar from 18; = the hall without techniques, run for run) | 59.3 | - | 81.8 | - |
| rbz: the zone bar counts the bounces again (Camp bar one target) | 55.0 (300) | -2.3 ± 3.0 | 77.3 (300) | -4.3 ± 2.3 |
| rb133: Ricochet Bolt × 1.33 (one-target value 427, between Savage Order 415 and Deadfall Trap 436) | 49.3 (300) | -8.0 ± 3.5 | 75.7 (300) | -6.0 ± 2.8 |
| rb160: × 1.6, kept off the Camp bar (a bar rule) | 55.0 (300) | -2.3 ± 3.1 | 83.3 (300) | +1.7 ± 2.0 |
| **ksb**: Keen Shot bounces to two other enemies for 30 % while the technique is owned; Ricochet Bolt itself off every bar | 61.8 (450) / 61.7 (900) / **63.5 (1 500)** | **+2.6 ± 1.4** (1 500) | 85.8 (600) | **+4.0 ± 1.9** |

- By number or by bar rule the spell does not pay from hero 18: it can only take a slot from Savage Order, Deadfall Trap or Heartseeker, and each of them is worth more (rbz, rb160), and a number big enough to beat Savage Order's value takes the Camp's AoE step from Deadfall Trap (rb133, the D166 failure again at the Camp). It is Keen Shot with a 35-focus cost, no Steady Aim and no Efficiency (Steady Aim acts on Keen Shot only, Efficiency on Keen Shot and Heartseeker Shot, spells.js), so one target is a loss and two targets are a small win.
- The passive has no bar and no value to rank, so no bar rule is needed. Across hero levels (Hunter, v3d hall, 300-450 runs): hero 10 spell 68.0 against no technique 53.7 (+14.3), passive 64.3 (+10.6); hero 14 spell 80.3, none 77.3 (+3.0), passive 78.7 (+1.4); hero 18 spell 70.9 = none 70.9, passive 72.9 (+2.0); hero 20 passive +2.6 ± 1.4; hero 25 +4.0 ± 1.9. It gives up 3.7 pp at hero 10 against today's spell and gains the 2-4 pp that the spell lacks from hero 18. Per 120 points that is 2-3 pp, close to the stat ranks (Vigor and Edge, 400 points, +12 pp at hero 25).
- Engine, for the Engineer: in `keen_shot`'s case in spells.js, after the main hit, `if (p.spells.ricochet_bolt)` hit up to two other living enemies at `multi: 0.3` (the arm's patch, sim/hunter-arms.sh `ksb`). The Ricochet Bolt spell and its bar entry go, or stay for hero 9-17 only. Gate on Legacy as the D157 numbers are. The sim bar template then needs nothing; the arm filters Ricochet Bolt out of `templateBar`.

## 5. Package and B6

Lost Technique I as the passive (+4 pp at hero 25) and Ferocity 0.045 (rank effect -5.8 ± 1.4 at hero 25 with the passive on):

| Cell | Runs a class | Rogue | Mage | Hunter | Spread | Largest distance from mean | B6 |
|---|---|---|---|---|---|---|---|
| Hero 20, v3d hall | 1 500 | 63.7 | 63.1 | 63.5 | **0.6** | 0.3 | pass (base 2.9) |
| Hero 25, v3d hall | 1 200 | 74.2 | 71.5 | 77.9 | **6.4** | 3.4 | pass (base 12.3) |
| Hero 25, nothing bought | 600 | 52.2 | 50.0 | 43.0 | **9.2** | 5.4 | **fail** (base 2.2) |
| Hero 20, nothing bought | 450 | 46.9 | 36.4 | 33.8 | 13.1 | 7.9 | fail as before (no Ferocity rank, no technique) |

Hero 25, nothing bought, Hunter only (600 runs a class; the base is 51.8, Rogue 52.2, Mage 50.0): Ferocity 0.075 gives 48.3 (spread 3.8, pass), 0.06 gives 42.3 (9.8), 0.045 gives 43.0 (9.2). With the hall, 0.075 leaves the Hunter at 80.8 (spread 10.7 before the passive). The nothing-bought Hunter loses 9 pp to the first 0.04 of Ferocity, the hall Hunter 4 pp, so **no Ferocity value passes both hero 25 cells**; the window is under 1 pp wide and the cells' error is ± 2 pp. A Hunter number cannot fix a hall response: the hall pushes the Hunter into the flat part of the win curve (84 %), where a pet cut moves it half as far as it moves the same Hunter at 52 %.

- Hero 20 with the hall passes in the base (2.9 pp) and with the package (0.6 pp); the Hunter is 0.2 below the Rogue at most, nowhere near 8 below. A general Hunter cut instead fails there: the pet numbers (pdp, hpet) take 7-21 pp at hero 20.
- The nothing-bought hero 25 cell fails by 1.2 pp at 600 runs (± 4 pp at 95 %): not a clean fail. It is also the cell the campaign does not play: hero 20 comes in run 7, the hall is complete in run 9 (LH1 chain, D167), and hero 25 follows. The hall cells are the reading that matters, and they pass at both levels with margin.
- Level-60 runs: Ferocity's Legacy value sits in `ORUVATH_TALENT` (gated on `legacy` and `oruvathLegacy`), so level 60 keeps 0.18; the passive needs the same gate (the engine has `sp_h1` in the level-60 meta too).

## 6. Recommendation (draft, for the Lead)

1. **Adopt the package behind `C.GATES.legacy`**: Legacy Ferocity `petDmgPct` 0.10 → 0.045 (one number in `ORUVATH_TALENT`), and Lost Technique I as "Keen Shot also hits up to two other enemies for 30 %" in place of the Ricochet Bolt spell from hero 18 (or in place of it at every level; hero 10 gives up 3.7 pp). B6 with the v3d hall: hero 20 0.6 pp, hero 25 6.4 pp.
2. **Do not build a dungeon-route lever.** Not the Cartographer's mark, not dungeon loot, not dungeon damage or the pet in dungeons: at the whole-hall level each moves B6 by 1 pp or less and takes 2 pp from every class. The Cartographer and Old Hand stay as built (D164, C1).
3. **Decide the nothing-bought hero 25 cell**: 9.2 pp with the package (2.2 before). Options: accept it (the cell is not played once the hall is bought), or keep Ferocity at 0.06-0.07 and read the hall cell at 8-9 pp, or replace the Lost Technique I passive by one bounce (about +2 pp at hero 25, not measured) to raise the allowed Ferocity.
4. **Re-read before Legacy is switched on by default** on fresh seeds (8000-8449 hero 20 nothing-bought is 10.9 pp and fails regardless of this package: the Rogue leads the Hunter by 9-13 pp there; that is a hero 16-20 Hunter matter for the class tuning of D157, not for this change).

Open: the Rogue's and Mage's Lost Techniques at hero 18+ were not measured (the Hunter's was the task); B7 tree spread and LE3 at hero 20 are unchanged; the engine behaviour in section 4 is a proposal and not built.

## 7. Reproduce

```
bash sim/hunter-arms.sh <arm> /tmp/scratch-dg/<arm>          # arms: base drops2 dim2 dim1 nomark dmg hp pet rbz rb133 rb160 pdp hpet so85 hs85 ksb fpm25 fer<NN>, joinable with +
node /tmp/scratch-dg/<arm>/sim/legacy-run.mjs grid --native --oruvath --econ --hall v3d --levels 25 --tables sim/tables/legacy-hx --out <dir> --runs 600 --seed 9000
node sim/armstats.mjs --level 25 base=<dir>[+<dir2>][@9000-9299] arm=<dir> ...          # --classes hunter --others <base dir> for a Hunter-only arm
```

Package cells: `ksb+fer45` hero 25 Hunter 1 200 runs from seed 9000 (v3d), nothing-bought Hunter 600; `ksb` hero 20 Hunter 1 500 runs (seeds 9000-10499); base cells: hero 25 seeds 9000-10199, hero 20 seeds 9000-10499. Hall ablation: `--hall v3d:vigor2,edge2`, `v3d:satchel1`, `v3d:cartographer1,old_hand1,swift_boots1`, `v3d:second_breath1`, `v3d:quick_study2`. Fresh nothing-bought cells: `--hall none --levels 20 --runs 450 --seed 8000`, `--levels 16-19 --runs 120 --seed 8000`.

Limits: the planner is the "good player" and its risk tables were warmed without the hall; the Hunter plays the Ridgewolf; the arms in section 3 that were not run are named there; the 1 200 and 1 500 run cells give about ± 2.5 pp per class at 95 %, the screening cells ± 4-6 pp.

Checks: `node --test qa/docs qa/sim` (hunter-arms.test.mjs, 5 tests: B6 and the paired difference, the script's guards and its Ferocity and Keen Shot edits on the scratch copy only); sim/hunter-arms.sh and sim/armstats.mjs have rows in docs/ARCHITECTURE.md.
