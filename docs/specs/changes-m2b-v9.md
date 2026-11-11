# Spec changes M2b v9 (M2b task 2b.7, tuning pass, third part)

Owner: Lead Game Designer, 2026-11-11. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), Lead. **Status: draft.** Proposed decisions D78-D81 (team) and one owner review item; hand-off docs/handoffs/designer-2026-11-11d.md.

Input: the v8 measure, P1 25 of 38 [source: docs/reports/balance-2026-11-11c.md, docs/handoffs/sim-2026-11-11c.md], the v6 pass and its proposal arms [source: docs/reports/balance-2026-11-11b.md; arm logs in the sim worktree sim/out/v6b/q5.log, q6.log], the owner's notes of 14:01 [source: docs/feedback/2026-11-11-1401-owner.md]. Where a figure below says "v8 run records", the designer read the per-run files of the 11-11c pass (sim/out/pass-2026-11-11c/*/runs-*.jsonl in the sim worktree); nothing was re-simulated.

Fixed by the owner and not touched here: the free potion stays at half strength (FREE_POTION_MULT 0.5, v8 row 9); the pet revive stays the draft of changes-m2b-v8.md appendix A (owner decision O3).

When the Engineer builds this package, every changed line in rules.md and balance.md is marked "(M2b v9)" in the same commit as the code.

## The misses and their causes

| P1 miss | v8 value | Band | Cause (basis) | In this package |
|---|---|---|---|---|
| B3 speedrunner PALL | 19.2 % (was 41.7) | 30-50 % | Three parts, about -22 pp together. (1) Half-strength free potion: about -9 pp [inference: removing the end-boss free potion cost the speedrunner PALL -10.2 pp on 11-11b rules (arm spfpb0: rogue -3.6, mage -8.8, hunter -18.2 pp), and on the planner PALL half strength cost 7.3 of the 8.0 pp that removal cost]. (2) The Shadowcraft trim on the PALL rogue: speedrunner rogue -31.1 pp against mage -16.1 and hunter -20.4, so about -13 pp on the rogue, -4 pp pooled [inference: the rogue's loss beyond the other two classes]. (3) The 1.30 boss against the thinnest kit: the speedrunner meets the boss at ilvl 47.2-48.7 against the planner's 49.8-50.4 (it skips vendor nodes) and wins 24 % of its PALL boss fights against the planner's 62 % [source: v8 run records]. At P0, where there is no free potion and the rogue plays Venomcraft, the speedrunner/planner ratio held (0.48 -> 0.47); at PALL it fell (0.54 -> 0.33) | Row 1 (rogue part); row 5 (band, owner review) |
| B6 PALL spread | 11.4 pp (rogue 52.9, mage 58.9, hunter 64.3) | <= 8 pp, each within 5 pp | The PALL rogue plays trimmed Shadowcraft: 80.3 -> 52.9 % (-27.4 pp) while the untrimmed PALL trees lost 12.6 (mage, with its HP row) and 14.8 pp (hunter, with its Beastbond row). Only the default PALL trees of rogue and mage were run, so the PALL switch rule is unchecked for them. 11-11b had PALL rogue Venomcraft at 71.5 % against Shadowcraft 80.3 % | Row 1; cell 2 runs every PALL tree |
| B7 hunter | 0.57 (Beastbond 16.6 %, Wildcraft 29.1 %) | >= 0.60 | The boss factor hits the pet tree hardest: Beastbond was 26.7 % on 11-11b plus a measured +5.9 pp from v8 row 6, and measured 16.6 %; Wildcraft lost only 3.8 pp beyond its trim. Beastbond hunters reach the boss most often (94 %) and lose 56 % of their boss losses in phase 2 (Wildcraft 32 %) [source: v8 run records]. Needs Beastbond >= 17.5 % at Wildcraft 29.1 % | Row 2 |
| B30 Echoes per run | 276 | 150-260 | Reach rose (85 % of planner P0 runs reach the boss, 74 % in 11-11b) and losses pay more: level 60 alone is 88.5 Echoes | Row 4 |
| B21 Z5-Z6 deaths | 1.8 % (1.4 - 2.4) | 2-8 % | Late zones are still too safe for the risk-pricing planner (B38 Z6 83.2 %, ceiling 85; B24 close fights 3.5 %, band 4-12, P2) | Row 3 |
| B1 greedy | 18.7 % (17.3 - 20.1) | 8-18 % | Follows the planner at 0.57 x; misses by 0.7 pp | Row 3 (no own row) |

Not tuned here: B11, B12, B53 (run length: the expedition map default, as in v8 "Run length"); B5 and B32 (noisy: see "Sample sizes").

## Change table (the package)

| # | Constant or rule (spec section) | Old | New | Target | Expected effect, with basis | Type |
|---|---|---|---|---|---|---|
| 1 | TALENT.r_b9 heal, Death's Sidestep (rules 6.1) | 0.10 of max HP (v8; was 0.20) | 0.15 | B6 PALL, B3 speedrunner (rogue part) | Unmeasured alone. Bound: the whole v8 Shadowcraft trim (three talents) measured -11.9 pp (-14.2..-9.6) on P0 Shadowcraft [source: report 11-11c, row 7]; at PALL it cost about -13 pp [inference: PALL rogue -27.4 against -12.6 / -14.8 for the untrimmed trees]. Half of the largest of the three heals back: PALL rogue +3 to +6 pp, P0 Shadowcraft +2 to +4 pp [inference: one of three trimmed heals, the once-per-fight one that triggers in most long fights]. P0 defaults unchanged (Venomcraft 36.3 % stays ahead of Shadowcraft 28.5 + 4 by more than the switch threshold) | number (data) |
| 2 | Beastbond: TALENT.h_a2 Ferocity petDmgPct, TALENT.h_a1 Thick Hide petHpPct (rules 6.3) | 0.15625 / 0.10 per rank | 0.18 / 0.115 per rank (× 1.15; tooltips "+18 %", "+11.5 %") | B7 hunter | Beastbond P0 +3.5 pp to about 20 %, B7 ratio about 0.69 [inference: 0.6 × the measured × 1.25 step, +5.9 pp (3.7..8.0) on 11-11b rules]. The v8 boss may shrink it: hence arm B in cell 3. Side effect: PALL hunter (Beastbond is its default) +1 to +3 pp [inference], which works against B6 PALL; arm B is chosen if it costs less there | number (data) |
| 3 | ZONE_DANGER_STEP (rules 7.6, 13) | 0.375 (v8; was 0.25) | 0.45 (+20 %, inside TUNE_LIMIT) | B21 Z5-Z6, B38 Z6, B24, B1 greedy | Z5-Z6 +0.4 to +0.6 pp to about 2.2-2.4 % [inference: the v8 step of +0.125 moved Z5-Z6 +0.7 pp (1.1 -> 1.8 %) together with the early-damage row, which does not act there; +0.075 is 60 % of it]. Level 60 enemies × 2.8 (v8 × 2.5), level 40 × 1.9 (1.75), level 30 × 1.45 (1.375); dungeons at 60 × 1.9 (1.75). Planner P0 -1 to -2 pp, greedy -1 to -1.5 pp to about 17-18 %, Z3-Z4 +0.5 to +1.5 pp (3.4 % now, band 3-10) [assumption: not measured without the early row]. PALL planner -1 to -2 pp (58.7 % now, floor 55) | number |
| 4 | ECHO_PER_LEVEL (rules 11.1, 13) | 1.5 | 1.0 | B30 | **Computed exactly** on the 3 000 v8 planner P0 runs (Echoes do not change P0 play): B30 per run 275.7 -> **248.7** (band 150-260), per win 472.7 -> 442.7 (band 400-540), per win without the first-kill line 342.7 [source: v8 run records]. Campaigns: B31 median 25 -> about 27-28 runs [inference: about 10 % less income against the 6 560-Echo catalogue]; B32 runs 1-5 slightly lower (later first unlocks; unmeasured). Rejected: ECHO_PER_LEVEL 1.2 with ECHO_PER_ZONE 6 (251.5, two constants for the same result) | number |
| 5 | WR_PALL_SPEED (balance.md 6, B3) | 0.30-0.50 | 0.20-0.40 (**owner review**) | B3 speedrunner | Target change. The M2 v4 band was set from measured speedrunner/planner ratios with no free potion and the boss at × 1.0. Since then the boss is × 1.30 and the free potion is the owner's half-strength rule; the speedrunner, which meets the boss with the least gear, carries most of both (cause table). After rows 1 and 3 the expected value is about 20-22 % [inference: row 1 about +1.5 pp pooled, row 3 about -1 pp]. 0.20-0.40 is the planner band 55-75 % × the ratio 0.36-0.53 (the measured 0.33 plus the rogue part back). Keeping 0.30-0.50 needs about +10 pp for the speedrunner alone, and no rules constant gives that without lifting the planner past its bands. Cell 6 measures the potion share directly | target |

Count: 5 rows; 3 number rows (rows 1-2 are data-table values), 1 data row, 1 target row; 4 constants change. Rows 3 and 4 are the only ones that touch every bot. Every value is inside TUNE_LIMIT 0.25 of its v8 value except row 1 (+50 %, a half-back of a v8 designer row), row 4 (-33 %) and row 5 (target), which is why they are designer rows (balance.md 2). No free-potion, pet-revive, boss, content, heat, time or catalogue change.

### Expected package result [inference: measured or estimated effects added, not measured together]
| Check | v8 | Expected v9 |
|---|---|---|
| B1 planner P0 | 33.0 % | 31-32 % (band 20-35) |
| B1 greedy P0 | 18.7 % | 17-18 % (band 8-18; may stay at the edge) |
| B3 planner PALL | 58.7 % | 58-60 % (band 55-75) |
| B3 speedrunner PALL | 19.2 % | 20-22 % (row 5 band 20-40) |
| B6 PALL spread | 11.4 pp | 7-10 pp: may still fail; the PALL switch rule (cell 2) can close it |
| B7 hunter | 0.57 | 0.65-0.70 |
| B21 Z5-Z6 | 1.8 % | 2.2-2.4 % |
| B30 | 276 | about 245-250 (row 4 exact on v8 runs; row 3 lowers reach slightly) |
| B31 | 25 | 27-28 |

If B6 PALL still fails after cell 2, the next lever is the PALL hunter, not the PALL rogue: report the PALL hunter's three trees and its gold and dungeon clears per run.

## Exact behaviour
- **Row 1.** TALENT.r_b9 heal 0.15 (Death's Sidestep: negate the hit, dispersal, STEALTH, heal 15 % max HP; the rest unchanged). Rules 6.1 line: "(M2b v8: heal 20 -> 10 %; M2b v9: 10 -> 15 %)".
- **Row 2.** TALENT.h_a2 petDmgPct 0.18; TALENT.h_a1 petHpPct 0.115. Arm B (cell 3): h_a1 petHpPct 0.13, h_a2 unchanged at 0.15625. Decision rule: take the arm whose Beastbond P0 cell is >= 18.5 % (ratio >= 0.64 at Wildcraft 29.1 %); if both qualify, the one with the smaller PALL Beastbond rise; if neither, keep row 2 as written and report.
- **Row 3.** Constant only. Update the example levels in rules 7.6 (30 × 1.45, 40 × 1.9, 50 × 2.35, 60 × 2.8; dungeons at 60 × 1.9) and the zone-danger line in engine-api.md.
- **Row 4.** Constant only. Run summary and Echo screen use the constant; no text change.
- **Row 5.** balance.md 6 WR_PALL_SPEED and the B3 reading note in balance.md 4. Applied only after the owner agrees; until then the report shows B3 speedrunner against both bands.

## Sample sizes (B5, B32 and the edge misses)
- **B5** (tactician minus planner, P0, paired): +9.3 pp (-0.2 - 18.9) on 50 tactician runs per class. The interval half-width scales with 1/sqrt(n): 9.6 pp at 150 runs. **200 per class (600 runs) gives about ±4.8 pp**, enough to tell the 15 pp floor from today's 9-10 pp. Cost: 3.3 s per tactician run, about 17 min wall on 2 cores [source: report 11-11c, ms/run 3 278]. No tuning row until then.
- **B32** (campaign curve): blocks hold 450 runs at 30 campaigns per class. The difference of two block rates has a 95 % half-width of about 6.4 pp, more than the 5 pp CURVE_DIP_PP, and the check takes the largest of five differences, so noise alone makes dips of 3-6 pp. **100 campaigns per class** (1 500 runs per block, half-width about 3.5 pp) settles the dip and runs 1-5 (about ±2.5 pp); **50 per class** (N_CAMPAIGNS) is the minimum for any reading (about ±5 pp on the dip). Today's 37.8 % for runs 1-5 has an interval (33.4 - 42.3) that reaches into the band.
- **B21 Z5-Z6** and **B1 greedy** miss by 0.2 and 0.7 pp with intervals that cross the band edge; 1 000 runs per class is enough to see row 3's effect (it moves them by more than the interval half-width only together with the package; report the point estimate as usual).

## What the sim must run
Engine: main 945e460 (v8) with rows 1-4 as value changes, on the Engineer's build or on the sim's scratch copy with switches (all four rows are constants or data values). Seeds 1000 onward, paired by class and seed with the 11-11c pass, starting from the 11-11c warm-up and observation tables. Budget about 40 min wall on 2 cores, from the 11-11c ms/run (planner P0 82, planner PALL 42, greedy 22-25, speedrunner 45-51, tactician 3 278); run in this order and cut from the bottom.

| # | Cell | Runs | Checks | About |
|---|---|---|---|---|
| 1 | Package v9: planner P0, every tree of every class | 1 000 per tree per class (9 000) | B1 planner, B6 P0, B7, B21, B24, B30, B38; P0 switch rule | 6 min |
| 2 | Package: planner PALL, every tree of every class | 1 000 per tree per class (9 000) | B3 planner, B6 PALL, B10; PALL switch rule (rogue and mage trees unchecked since 11-11b) | 4 min |
| 3 | Row 2 arm B (Thick Hide 0.13 alone): planner P0 and planner PALL, hunter Beastbond | 1 000 each | row 2 decision rule | 1 min |
| 4 | Package: greedy P0 and PALL, speedrunner P0 and PALL (default trees after cells 1-3) | 1 000 per class each (12 000) | B1 greedy, B1 speedrunner, B3 greedy, B3 speedrunner (both bands) | 5 min |
| 5 | Package: planner P10 | 1 000 per class | B2 | 1.5 min |
| 6 | Diagnostic: package with FREE_POTION_MULT 1, speedrunner PALL | 1 000 per class | the free potion's share of the B3 speedrunner miss (owner information for row 5; no change follows) | 1.5 min |
| 7 | Package: campaigns | 50 per class (N_CAMPAIGNS) | B30 campaign, B31, B32 (report the dip with its interval) | 13 min [inference: 30 per class took about 8 min in v8] |
| 8 | Package: tactician P0 | 200 per class if time remains, else 50 per class | B1 tactician, B5 | 17 min at 200 (fits only if cells 1-7 run fast); 4 min at 50 |

Not run in v9: heat-seek and heat-avoid (B56, B58 passed with margin; row 3 raises danger in every node alike), masher, opener, B26-B28 variants, random cells, B35 replay. Report: the 11-11c table with a v9 column, the per-row measured effect, and the row 2 arm choice.

## Proposed decisions (for the Lead to log)
| # | Decision | Owner |
|---|---|---|
| D78 | Death's Sidestep heal 0.15 (half of the v8 trim back), row 1 | team |
| D79 | Beastbond × 1.15 or arm B by the cell 3 rule, row 2 | team |
| D80 | ZONE_DANGER_STEP 0.45, row 3 | team |
| D81 | ECHO_PER_LEVEL 1.0, row 4 | team |
| O4 | WR_PALL_SPEED 0.20-0.40: the speedrunner band follows the half-strength free potion, row 5. Default without an answer: report both bands, change nothing | owner review |

## Constants
New or changed by this package (rules.md 13 unless stated).

| Constant | Old | New | Unit |
|---|---|---|---|
| TALENT.r_b9 heal (Death's Sidestep, rules 6.1) | 0.10 | 0.15 | of max HP |
| TALENT.h_a2.petDmgPct (Ferocity, rules 6.3) | 0.15625 | 0.18 (arm B: 0.15625) | per rank |
| TALENT.h_a1.petHpPct (Thick Hide, rules 6.3) | 0.10 | 0.115 (arm B: 0.13) | per rank |
| ZONE_DANGER_STEP | 0.375 | 0.45 | × per 10 levels above ZONE_DANGER_FROM |
| ECHO_PER_LEVEL | 1.5 | 1.0 | Echoes per level gained |
| WR_PALL_SPEED (balance.md 6) | 0.30-0.50 | 0.20-0.40 (owner review) | rate |
