# Legacy pace on the D168 reading (2026-11-25)

Status: **draft** (Simulation & Balance Engineer), for the Lead. Nothing here is approved by the owner. BACKLOG "Legacy pace on the D168 reading". src/ is untouched. The Hunter cells were played at HEAD 471fca3 and will move slightly once the Hunter Legacy numbers (D169 (1)) land; Rogue and Mage cells will not.

## Verdict

1. **A buyer reaches hero 25 in 5.36 h (seeds 9000-9059) and 5.35 h (seeds 9060-9119), read at the hero level; nothing bought takes 6.13 h and 6.14 h.** The buyer is under 6.0 h on both seed sets. Owner decision 2026-11-25 14:43 ("We dont slow hero xp. smart play should be rewarded."): a buyer under 6.0 h is accepted, so step 3 of the task (a hero-XP change and its sim-side override) was dropped and nothing was measured for it.
2. **LE3 passes on both readings and both seed sets**, with the first-kill line paid once a class: hero 20 at -3.9 % and -5.7 %, hero 25 at -9.7 % and -10.5 % (band ±15 %). LE4 passes (3, 2, 3, 3 entries after runs 1-4). The hall is complete after run 9 on both sets (LH3: by run 10).
3. **The nothing-bought chain is inside 6-8 h** (6.13-6.14 h) and its LE3 passes too (-4.6 / -3.4 % at hero 20, -7.5 / -6.7 % at hero 25).
4. **Paying the first-kill line once a class takes 127-143 points off the buyer's hero-20 reading and 246-260 off hero 25**, which is the difference between +2 to +5 % and -4 to -6 % at hero 20. It moves the hall's completion from run 8 to run 9 and does not move the hours.

Recommendation (one line): **keep hero XP, hall prices and payouts as they are (D167, D168); read pace at the hero level with the first-kill line paid once a class, accept the buyer's 5.4 h, and re-run these two chains once the Hunter numbers land.**

## 1. What changed in the tools

- `sim/lh1report.mjs`: `chain()` returns `at(L)`, the cumulative Legacy and the hours when the hero XP reaches level L, linear in XP across the run that crosses it (D168; the XP spent in that run is not charged in full, so the ninth run that starts at hero 24 no longer reads as 6.03 h). `chain` prints LE3 and hours on that reading and the old run-end reading for reference. The first-kill line is paid once a class (default; `--fk every` is the old reading): class c in run k pays 100 x P(no win before) x win rate of the cell, from the cells' own wins (`echFirst`). Arm `none` plays the nothing-bought chain from played cells (no purchases) instead of the interpolated reference of the LE3 report. After hero 25 the buyer chain keeps playing runs at hero 25 until the hall is bought, so the run that completes the hall is read from played cells.
- `sim/lh1-chain.sh`: env `SEED` (second sample 9060), `FK`, `WORKERS`; arm `none`; the plan carries the first-kill rule (purchase timing follows the lower income). `sim/legacy-le3report.mjs` `summarize` adds `h20` / `h25` (hero-level readings); its other outputs are unchanged.
- `qa/sim/pace.test.mjs`: the interpolation, `none` buys nothing, first kill once (3 tests).

## 2. Set-up

Engine HEAD 471fca3. Planner, `--map expedition --prep`, profile `later`, band tables sim/tables/legacy-hx/, Legacy + Oruvath + Economy v2, hall arm v3d (engine catalogue, D167). The chain is played as staged hero cells (run k at its start hero level with the entries bought after runs 1..k-1), 60 runs a class (180) per cell, plan re-made from the cells played until stable (buyer: 10 cells a set, nothing bought: 10). Set A seeds 9000-9059, set B 9060-9119. "Hero level reading": D168. Nothing bought: the same chain with no purchases. Noise [estimate]: a cell's Legacy a run carries about ±8 points, a chain's cumulative at hero 20 about ±2 %, its hours about ±0.03 h.

## 3. Hours to hero 25 and LE3

| | Set A | Set B | Mean |
|---|---|---|---|
| **Buyer, hours to hero 25 (hero level)** | **5.36** | **5.35** | **5.36** |
| Buyer, old run-end reading (after run 8) | 5.42 | 5.46 | 5.44 |
| Buyer, hours to hero 20 | 4.02 | 4.02 | 4.02 |
| **Nothing bought, hours to hero 25 (hero level)** | **6.13** | **6.14** | **6.14** |
| Nothing bought, old run-end reading (after run 10) | 6.37 | 6.40 | 6.39 |
| Nothing bought, hours to hero 20 | 4.44 | 4.45 | 4.45 |
| Buyer, hero 25 reached inside run | 8 | 8 | |
| Nothing bought, hero 25 reached inside run | 10 | 10 | |

| LE3 (first kill once a class) | Set A | Set B | Target |
|---|---|---|---|
| Buyer, hero 20 (inside run 6): cumulative against 1 650 | 1 586 (-3.9 %) | 1 557 (-5.7 %) | ±15 % |
| Buyer, hero 25 (inside run 8): cumulative against 2 350 | 2 122 (-9.7 %) | 2 102 (-10.5 %) | ±15 % |
| Nothing bought, hero 20 (inside run 7) | 1 573 (-4.6 %) | 1 594 (-3.4 %) | ±15 % |
| Nothing bought, hero 25 (inside run 10) | 2 174 (-7.5 %) | 2 192 (-6.7 %) | ±15 % |
| LE4: entries after runs 1-4 | 3, 2, 3, 3 | 3, 2, 3, 3 | at least 1 each |
| Hall complete after run | 9 | 9 | by run 10 |

The same cells with the first-kill line paid at every win (the earlier reading): buyer hero 20 +4.8 % / +2.0 %, hero 25 +1.4 % / -0.1 %, LE4 3, 2, 4, 3 and 3, 2, 3, 4, hall after run 8, hours unchanged (5.36 / 5.35). The old LE3 figure of +21.6 % came from reading run 7 whole; at the hero level it was +4 % and with the line once it is -4 to -6 %.

## 4. The two chains by run (set A; set B is within 0.04 h and 20 points a run)

Buyer:

| Run | Hero start -> end | Hours | Legacy | Cumulative | Bought after the run |
|---|---|---|---|---|---|
| 1 | 1 -> 4.2 | 0.57 | 225 | 225 | satchel, vigor I, edge I |
| 2 | 4 -> 7.8 | 1.24 | 214 | 438 | quick study I, technique I |
| 3 | 7 -> 11.5 | 2.01 | 321 | 759 | pockets, cartographer, vigor II |
| 4 | 11 -> 14.6 | 2.73 | 276 | 1 035 | edge II, old hand, quartermaster I |
| 5 | 14 -> 17.6 | 3.43 | 311 | 1 346 | quick study II, swift boots, quartermaster II |
| 6 | 17 -> 20.3 | 4.09 | 270 | 1 616 | technique II |
| 7 | 20 -> 22.8 | 4.76 | 266 | 1 882 | second breath |
| 8 | 22 -> 25.0 | 5.42 | 266 | 2 148 | second tree, Armoury |
| 9 | 25 | 6.06 | 287 | 2 435 | third tree |

Nothing bought: runs end at hero 4.2, 7.5, 10.7, 13.5, 16.0, 18.2, 20.3, 22.3, 24.0, 25.0 at 0.57, 1.23, 1.94, 2.60, 3.26, 3.90, 4.54, 5.17, 5.78, 6.37 h; Legacy a run 225, 189, 263, 235, 244, 229, 223, 219, 213, 227.

## 5. Reading it

- The buyer is 0.78 h (13 %) ahead of nothing bought at hero 25 (5.36 against 6.14 h); hero 20 comes at 4.02 h against 4.45 h. The 6.0 h line is crossed because the buyer climbs 8 runs against 10, not because a run is shorter.
- Hours on the hero-level reading are 0.06-0.25 h under the run-end figures (5.42 / 6.37 h): the run-end reading charges the whole last run for the last fraction of a level. The 6.03 h of D167 was that charge on a ninth run.
- The nothing-bought chain sits at 6.14 h, so the owner's 6-8 h (D154) holds for a player who buys nothing and the buyer's 5.4 h is the reward for buying and playing the planner's line. A human at 70 % of the planner's win rate would land at about 7.7 h [inference, from the LE3 report].
- Seed sets agree within 0.02 h on hours and within 1.8 points of LE3 at hero 20; the chain is stable at the 20.0 line this time (hero 20 falls inside run 6 for the buyer and inside run 7 for nothing bought on both sets).

## 6. Limits

- Planner, the good player; cells are played at integer start levels with the XP carried by the chain model, as in the earlier chains. Hero-level reading is linear in XP inside the crossing run. First kill once a class is an expected value from the cells' win rates (profile `later` has never killed Oruvath), not a played campaign; the Hunter's hawk, the Oaths and the level-20 wing's effects are not played.
- Hunter cells at HEAD 471fca3, before the engineer's Hunter Legacy numbers; expect the Hunter's win rate, and with it the Legacy a run and the buyer's pace, to move slightly. Re-run: `SEED=9000 WORKERS=1 sim/lh1-chain.sh /tmp/lp/a v3d` and `... none`, then `SEED=9060 ... /tmp/lp/b`.
- LE4 is not defined for the nothing-bought chain (no purchases); its LE4 line reads 0 and is not a result.
- Hero XP, Quick Study's -10 Legacy a run at hero 19 (mechanism unknown, not investigated here) and the hall prices are unchanged.

## 7. Commands

```
SEED=9000 WORKERS=1 sim/lh1-chain.sh /tmp/lp/a v3d ; SEED=9000 WORKERS=1 sim/lh1-chain.sh /tmp/lp/a none
SEED=9060 WORKERS=1 sim/lh1-chain.sh /tmp/lp/b v3d ; SEED=9060 WORKERS=1 sim/lh1-chain.sh /tmp/lp/b none
node sim/lh1report.mjs chain /tmp/lp/a v3d [--fk every]       # LE3, LE4, hours at the hero level, hall completion
node sim/lh1report.mjs chain /tmp/lp/a none
```

Checks: `node --test qa/docs qa/sim` pass.
