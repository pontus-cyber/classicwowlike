# Legacy hall v3, arm LH1 (2026-11-20)

Status: **draft** (Simulation & Balance Engineer), for the Lead. Nothing here is approved by the owner. Measures docs/specs/legacy-hall-v3-draft.md section 5 (LH1) for D164. src/ is untouched; the hall arms are sim-side overrides (sim/lib/hall.mjs).

## Verdict

**LH1 fails: the v3 hall adds +13.5 pp win rate at hero 25 over the v2 hall (95 % interval +11.0 to +16.0; gate +4 pp), and the fallback (Vigor II +2 %, Edge II +1 %) adds +11.3 pp (+8.8 to +13.9), so it fails too.** Build neither. The win rate follows the stat ranks alone (Pockets moves nothing); a pair of ranks worth +4 % health and +3 % Power in all (Vigor +3 / +1, Edge +2 / +1, arm v3c) adds +2.6 pp at hero 25 and passes the gate.

## 1. Set-up

- Engine: main b7da9c9 plus the sim changes of this commit; `C.GATES.legacy`, `oruvathLegacy` and `economyV2` on (`sim/legacy-run.mjs grid --native --oruvath --econ --hall <arm>`). Planner, `--map expedition --prep`, profile `later`, the band risk tables sim/tables/legacy-hx/, warm-up 0, **seeds 9000-9599 at hero 25, 9000-9449 at hero 10 and 20, 9000-9299 at hero 1, the same seeds in every arm** (paired). Runs per class: 600 / 450 / 450 / 300 at hero 25 / 20 / 10 / 1. 0 errors in every cell.
- The hall bought is the whole hall at top ranks for the class (account entries, the class's two Lost Techniques, the Hunter's Stormhawk; Oaths and the level-20 wing left out), as LH1 asks. Arms (sim/lib/hall.mjs; effects set on C.META_HERO before each run, nothing else changes):

| Arm | Vigor (HP) rank I / II | Edge (Power) rank I / II | Deeper Pockets slots |
|---|---|---|---|
| none | nothing bought | | |
| v2 (engine as built) | +1 / +1 % | +1 / +1 % | +4 |
| v3 (draft S2, P1) | +5 / +3 % | +4 / +2 % | +8 |
| v3 fallback (v3fb) | +5 / +2 % | +4 / +1 % | +8 |
| v3c (calibration) | +3 / +1 % | +2 / +1 % | +8 |
| v3s / v3p (attribution) | v3 / v2 | v3 / v2 | +4 / +8 |
| `-nt` (v2-nt, v3-nt) | the arm without the Lost Techniques | | |

- Second Breath (150), Stormhawk (90) and Deeper Pockets (50) change price only (and Pockets' slots); prices matter to the chain (section 5), not to the cells.
- **Cartographer (C1) is not an arm.** The engine already plays the entry as C1 describes it: Region Charts are an owned perk (no camp point, contracts.js `ownedPerks`) and with Charts the dungeon's node is known (expedition.js `knowledge`); the Roads are always on the planner's map view (`mapView.roads`). The exit marks add nothing the planner lacks, so v2 and v3 play the same Cartographer. A player-facing effect of C1 is not measurable here.
- Hero levels 1, 10, 20, 25 only; hero XP and Legacy a run are read from the same cells.

## 2. Win rate (pooled = mean of the three classes)

| Hero | Arm | Rogue | Mage | Hunter | Pooled | B6 spread (pp) | B6 |
|---|---|---|---|---|---|---|---|
| 1 | nothing bought | 0.3 | 7.0 | 0.0 | 2.4 | 7.0 | pass |
| 1 | v2 | 4.7 | 13.0 | 8.3 | 8.7 | 8.3 | fail |
| 1 | v3 | 7.7 | 26.3 | 18.0 | 17.3 | 18.7 | fail |
| 1 | v3 fallback | 6.7 | 21.0 | 16.0 | 14.6 | 14.3 | fail |
| 10 | nothing bought | 31.6 | 31.1 | 32.7 | 31.8 | 1.6 | pass |
| 10 | v2 | 26.9 | 45.8 | 64.4 | 45.7 | 37.6 | fail |
| 10 | v3 | 44.0 | 71.3 | 80.4 | 65.3 | 36.4 | fail |
| 10 | v3 fallback | 39.8 | 65.8 | 77.6 | 61.0 | 37.8 | fail |
| 10 | v3c | 32.2 | 55.1 | 69.3 | 52.2 | 37.1 | fail |
| 20 | nothing bought | 46.9 | 36.4 | 33.8 | 39.0 | 13.1 | fail |
| 20 | v2 | 62.4 | 57.8 | 17.1 | 45.8 | 45.3 | fail |
| 20 | v3 | 73.8 | 72.2 | 29.8 | 58.6 | 44.0 | fail |
| 20 | v3 fallback | 74.7 | 68.9 | 28.2 | 57.3 | 46.4 | fail |
| 25 | nothing bought | 52.2 | 50.0 | 51.8 | 51.3 | 2.2 | pass |
| 25 | v2 | 69.8 | 68.2 | 46.5 | 61.5 | 23.3 | fail |
| 25 | v3 | 83.0 | 77.8 | 64.2 | 75.0 | 18.8 | fail |
| 25 | v3 fallback | 81.3 | 75.5 | 61.5 | 72.8 | 19.8 | fail |
| 25 | v3c | 73.8 | 70.2 | 48.3 | 64.1 | 25.5 | fail |

Difference against the v2 hall, pooled, paired on seed (pp ± one standard error):

| Hero | v3 - v2 | fallback - v2 | v3c - v2 |
|---|---|---|---|
| 1 | +8.7 ± 1.2 | +5.9 ± 1.2 | |
| 10 | +19.6 ± 1.5 | +15.3 ± 1.5 | +6.5 ± 1.5 |
| 20 | +12.8 ± 1.5 | +11.5 ± 1.5 | |
| **25 (gate +4)** | **+13.5 ± 1.3** | **+11.3 ± 1.3** | **+2.6 ± 1.2** |

- Every class gains at hero 25 under v3 (Rogue +13.2, Mage +9.7, Hunter +17.7 pp, each ± 2-2.4). The gain is larger below hero 25 (+19.6 at hero 10).
- **Attribution at hero 25 (600 runs per class):** v3's stat ranks with today's four slots give 83.0 / 77.8 / 64.2, run for run the v3 result; today's stat ranks with eight slots give 61.4 pooled against v2's 61.5 (-0.1 ± 0.1). Deeper Pockets, whatever its size, moves no planner win rate. The whole +13.5 pp is Vigor and Edge. The slope is about 1.1 to 1.35 pp for each point of HP % plus Power % over v2 (v3: +10 points, +13.5 pp; fallback: +8, +11.3; v3c: +3, +2.6). The gate's +4 pp is about 3 to 3.5 points over v2's +2 % / +2 %; the draft estimated 1.5-2 levels for +8 % / +6 %, and a hero level is worth about 3 pp of win rate here (D159's cells: 38 % at hero 20, 54 % at hero 25), not 1.2.
- **L5** (the whole hall against nothing bought, hero 25; 10-30 pp): v2 +10.2, v3 +23.7, fallback +21.4, v3c +12.8. All pass. The hall also lifts the hero XP a run by 37-45 % (6 560 with nothing bought, 9 018 v2, 9 119 v3 at hero 25), more than Quick Study's +10 %: a stronger hero keeps more of the run.

## 3. B6 and the Hunter's techniques

B6 already fails with the **v2** hall (spread 8.3 / 37.6 / 45.3 / 23.3 pp at hero 1 / 10 / 20 / 25), so "B6 still passes" cannot hold for any arm; v3 does not cause the break. The Hunter's Lost Techniques are the main cause at hero 20 and 25. Hunter, hero 20, 200 runs, seeds 9000-9199, v2 prices and effects:

| Hall owned | Hunter win |
|---|---|
| nothing | 35.5 % |
| Vigor II + Edge II only | 47.5 % |
| Second Breath + Satchel only | 45.0 % |
| both Lost Techniques only | **11.0 %** |
| whole hall except the Techniques | 60.0 % |
| whole hall (450 runs) | 17.1 % |

The Hunter with the techniques loses 25-35 pp (the Hunter's techniques are Ricochet Bolt and Beastcall Horn; the cause is not investigated: a class or sim bar task, not a hall task). The Mage's techniques change nothing (identical win rates with and without them), the Rogue's little. Without the techniques (arms `-nt`):

| Hero | Arm | Rogue | Mage | Hunter | Pooled | B6 spread | B6 |
|---|---|---|---|---|---|---|---|
| 20 | v2-nt | 59.8 | 57.8 | 53.8 | 57.1 | 6.0 | pass |
| 20 | v3-nt | 74.0 | 72.2 | 69.1 | 71.8 | 4.9 | pass |
| 25 | v2-nt | 72.7 | 68.2 | 79.7 | 73.5 | 11.5 | fail |
| 25 | v3-nt | 81.8 | 77.8 | 92.0 | 83.9 | 14.2 | fail |

v3-nt - v2-nt: +14.7 ± 1.5 pp at hero 20 and +10.4 ± 1.1 at hero 25. With the techniques out, B6 holds at hero 20 and fails at hero 25 under both halls (the Hunter leads); v3 widens the spread there by 2.7 pp and leaves the Hunter at 92 %.

## 4. LE targets and L5

- **LE5** (zone 1 mean lowest HP, won quest and grind fights, >= 85 %): 90-93 % at hero 10 and 20 in every arm (v2 90 / 92, v3 91 / 93). Pass; hero 5 was not run.
- **LE3 and LE4** (section 5): LE4 passes for both halls. LE3 at hero 20 fails for both once the hall is bought (v2 +20.9 %, v3 +16.5 %, tolerance ±15 %), and passes at hero 25 (+11.2 %, +10.0 %). The cells of D159 bought nothing; a bought hall lifts the Legacy a run (hero 25: 276 nothing, 330 v2 = +20 %, 365 v3 = +32 %), so a campaign with purchases pays ahead of the pace the hall was priced for.
- LE1, LE2, LE6 are engine checks (QA), not touched by a hall arm.

## 5. The chain: hours, LE3, LE4, the run that completes the hall

The campaign played as staged hero cells (sim/lh1-chain.sh): run k at its start level with only the hall entries bought after runs 1..k-1, in the order Satchel, Vigor I, Edge I, Quick Study I, first technique, Pockets, Cartographer, Vigor II, Edge II, Old Hand, Quartermaster I, Quick Study II, Swift Boots, Quartermaster II, second technique (from hero 17), Second Breath (from run 2), then the wing (second tree 250, Armoury 150, third tree 300, from hero 20) at each arm's prices; 60 runs per class per cell (180), 9 and 8 cells, seeds 9000-9059. The v3 chain uses v3's effects; the fallback has v3's prices and about 3 % lower power, so it chains alike (not run).

v2 hall (account + one class's techniques 1 640, whole hall 2 340):

| Run | Hero start -> end | Hours | Legacy | Cumulative | Bought after the run |
|---|---|---|---|---|---|
| 1 | 1 -> 4.2 | 0.57 | 225 | 225 | satchel, vigor I, edge I |
| 2 | 4 -> 7.5 | 1.23 | 204 | 429 | quick study I, technique I |
| 3 | 7 -> 11.0 | 1.95 | 293 | 721 | pockets, cartographer, vigor II |
| 4 | 11 -> 14.1 | 2.66 | 298 | 1 019 | edge II, old hand, quartermaster I |
| 5 | 14 -> 17.1 | 3.36 | 351 | 1 371 | quick study II, swift boots, quartermaster II |
| 6 | 17 -> 19.9 | 4.04 | 306 | 1 677 | technique II, second breath |
| 7 | 19 -> 22.5 | 4.72 | 305 | 1 982 | second tree |
| 8 | 22 -> 24.9 | 5.39 | 290 | 2 273 | Armoury |
| 9 | 24 -> 25 | 6.03 | 328 | 2 601 | third tree |

v3 hall (1 540, whole hall 2 240):

| Run | Hero start -> end | Hours | Legacy | Cumulative | Bought after the run |
|---|---|---|---|---|---|
| 1 | 1 -> 4.2 | 0.57 | 225 | 225 | satchel, vigor I, edge I |
| 2 | 4 -> 7.5 | 1.22 | 195 | 420 | quick study I, technique I |
| 3 | 7 -> 11.0 | 1.95 | 310 | 730 | pockets, cartographer, vigor II, edge II |
| 4 | 11 -> 14.2 | 2.67 | 350 | 1 080 | old hand, quartermaster I, quick study II, swift boots |
| 5 | 14 -> 17.4 | 3.38 | 370 | 1 450 | quartermaster II, technique II |
| 6 | 17 -> 20.2 | 4.06 | 343 | 1 794 | second breath, second tree |
| 7 | 20 -> 22.8 | 4.73 | 334 | 2 128 | Armoury |
| 8 | 22 -> 25 | 5.41 | 336 | 2 464 | third tree |

| | v2 | v3 | Target |
|---|---|---|---|
| LE3 at hero 20 | run 7, 1 982 against 1 640 (+20.9 %) | run 6, 1 794 against 1 540 (+16.5 %) | within ±15 % (both fail) |
| LE3 at hero 25 | run 9, 2 601 against 2 340 (+11.2 %) | run 8, 2 464 against 2 240 (+10.0 %) | within ±15 % (pass) |
| LE4: entries bought after runs 1-4 | 3, 2, 3, 3 | 3, 2, 4, 4 | at least 1 (pass) |
| LH2 hours to hero 25 | 6.03 | **5.41** | 6-8 h, within 0.3 h of v2 |
| LH3 hall complete | after run 9 | after run 8 | by run 10 (pass) |

- The nothing-bought chain of D159 took 10 runs and 6.4 hours; buying the hall shortens it to 9 runs (6.0 h) under v2 and 8 runs (5.4 h) under v3. v3 is 0.62 h under v2, over the 0.3 h of LH2 (the draft says a faster run is no fault) and under the 6-8 h band of D154 for the planner (D159's 6.1-6.5 reading stood on cells without purchases).
- **LH4 first buy** (a lean planner at 55 a run, the welcome 60 in run 1, the same order): after run 3 it owns Satchel, Vigor I and Edge I (3 entries) under v2 and v3 alike (their prices are equal until Pockets, and Pockets is entry 6); after run 4 also Quick Study I. Pass for both; v3 changes nothing for the casual player in the first four runs, since the changes are Vigor II, Edge II, Pockets and Second Breath.
- Vigor rank I and II are played at their own value in a stage (v3: +5 % with rank I alone, +8 % with both).

## 6. What the Lead can take from it

1. The draft's estimate was low by a factor of 3-5: one hero level is worth about 3 pp of win rate here (not 1.2), and 1 % of health or Power about 1.1-1.35 pp. The v2 hall's own +2 % / +2 % already holds L5 at +10 pp.
2. A stat budget that passes the gate: at most about 3 to 3.5 points of HP % plus Power % over v2's four, for example arm v3c: Vigor +3 / +1, Edge +2 / +1 (total +4 % health, +3 % Power), +2.6 ± 1.2 pp at hero 25 (+6.5 at hero 10, not gated). Rank I of +3 % is 13 health at hero 5: the "felt" target of the draft (+5 %) does not fit the gate unless another hall entry gives up power.
3. Hero 10 and hero 1 move more than hero 25 (+19.6 and +8.7 pp for v3); the gate is set at hero 25 only.
4. Deeper Pockets at +8 costs nothing in win rate; its value is the bag, not the planner's.
5. Not a v3 matter, found on the way: the Hunter's Lost Techniques cost the Hunter 25-35 pp at hero 20-25 with the v2 hall (section 3), so B6 fails with the v2 hall at every hero level run. It needs a class or bar fix before B6 can be read on a bought hall.

## 7. Limits

- The hall is bought whole at every hero level (an upper bound on a player's power at hero 1 and 10; LH1's own set-up). The chain section plays the staged hall.
- 450-600 runs per class: ±2.6 pp (95 %) per class and about ±2.5 pp for a pooled unpaired rate, ±1.3 pp for the paired differences above. The chain cells hold 180 runs, about ±1-2 % on hours and Legacy.
- The planner is the "good player". Its risk tables were warmed without the hall; the planner's choices are the same under every arm, only the hero's numbers differ.
- Vigor / Edge ranks are modelled as rank x mean value (exact at rank 0, the owned rank in a stage, and at both ranks).
- The v3c arm was chosen from the slope of three arms, then measured once at hero 25 and hero 10; it is a calibration point, not a design.

## 8. Commands

```
sim/lh1-arms.sh /tmp/lh1/main v2 v3 none v3fb        # hero 25, 20, 10, 1; N25=600 N20=450 N10=450 N1=300, SEED=9000
node sim/legacy-run.mjs grid --native --oruvath --econ --hall v3c --levels 25 --tables sim/tables/legacy-hx --out <dir> --runs 600 --seed 9000
sim/lh1-chain.sh /tmp/lh1/main v2 ; sim/lh1-chain.sh /tmp/lh1/main v3
node sim/lh1report.mjs /tmp/lh1/main --arms v2,v3,v3fb,v3c,v3s,v3p,v2-nt,v3-nt --base none
node sim/lh1report.mjs chain /tmp/lh1/main v3
```

Checks: `node --test qa/docs qa/sim` 194 pass (qa/sim/hall.test.mjs added). Cells without `--hall` are unchanged (the arm fields reset to the engine's values).

## 9. Chain with the v3c hall (D165 confirmation run)

Status: **draft**. Same method as section 5 (sim/lh1-chain.sh, 60 runs per class per cell, seeds 9000-9059, same buy order, plan converged in the usual rounds). v3c: Vigor +3 / +1 % and Edge +2 / +1 % at 70 / 100, Deeper Pockets 50 for +8, Second Breath 150, Stormhawk 90; account entries + one class's techniques 1 540, whole hall 2 240.

| Run | Hero start -> end | Hours | Legacy | Cumulative | Bought after the run |
|---|---|---|---|---|---|
| 1 | 1 -> 4.2 | 0.57 | 225 | 225 | satchel, vigor I, edge I |
| 2 | 4 -> 7.5 | 1.23 | 198 | 422 | quick study I, technique I |
| 3 | 7 -> 11.0 | 1.95 | 300 | 722 | pockets, cartographer, vigor II, edge II |
| 4 | 11 -> 14.2 | 2.67 | 304 | 1 026 | old hand, quartermaster I, quick study II |
| 5 | 14 -> 17.3 | 3.38 | 361 | 1 387 | swift boots, quartermaster II |
| 6 | 17 -> 20.1 | 4.04 | 295 | 1 682 | technique II, second breath |
| 7 | 20 -> 22.7 | 4.73 | 314 | 1 996 | second tree, Armoury |
| 8 | 22 -> 25.0 | 5.40 | 291 | 2 287 | third tree |

| | v2 | v3 | v3c | Target |
|---|---|---|---|---|
| Hours to hero 25 | 6.03 | 5.41 | **5.40** | at least 6.0 (D165 gate) |
| Runs to complete the hall | 9 | 8 | 8 | by run 10 |
| LE3 at hero 20 | +20.9 % | +16.5 % | +9.2 % (run 6, 1 682 vs 1 540) | within ±15 % |
| LE3 at hero 25 | +11.2 % | +10.0 % | +2.1 % (run 8, 2 287 vs 2 240) | within ±15 % |
| LE4 after runs 1-4 | 3, 2, 3, 3 | 3, 2, 4, 4 | 3, 2, 4, 3 | at least 1 each |

- **Verdict: the v3c chain misses the D165 gate (5.40 h against at least 6.0), though LE3 (both heroes) and LE4 now pass.** The hours are those of v3 to the hundredth: the stat ranks barely change the chain's pace, the faster pace comes from the price changes (Vigor II / Edge II at 100, cheaper Second Breath) and from the earlier hall completion they allow, and the v2 hall's 6.03 h is the only arm at or above 6.0.
- LE3 at hero 20 passes for the first time with a bought hall (9.2 %), because the v3c pace of Legacy is lower than v3's (the v3 stat ranks made the hero win more).
- Command: `sim/lh1-chain.sh /tmp/lh1/main v3c; node sim/lh1report.mjs chain /tmp/lh1/main v3c`.
