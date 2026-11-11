# Hand-off: Lead Game Designer, 2026-11-11d (M2b v9 tuning package, draft)

Task: a small follow-up to v8 for the open P1 misses of the v8 measure (docs/reports/balance-2026-11-11c.md: P1 25 of 38). Spec: docs/specs/changes-m2b-v9.md. Status: draft. No src/ or sim/ change. The free potion (half strength) and the pet revive (v8 appendix A) are untouched, as the owner asked.

## Package (5 rows)
1. Death's Sidestep (r_b9) heal 0.10 -> 0.15: half of the v8 trim back, for the PALL rogue (B6 PALL, rogue part of B3 speedrunner). Unmeasured alone; bound by the measured trim (-11.9 pp on P0).
2. Beastbond × 1.15 (Ferocity 0.18, Thick Hide 0.115), with arm B (Thick Hide 0.13 alone) and a decision rule: B7. Expected about +3.5 pp (0.6 × the measured +5.9 pp step).
3. ZONE_DANGER_STEP 0.375 -> 0.45: B21 Z5-Z6 (1.8 %), B38 Z6, B24, and B1 greedy (18.7 %) with it. Estimated from the v8 step.
4. ECHO_PER_LEVEL 1.5 -> 1.0: B30 276 -> 248.7, computed exactly on the 3 000 v8 planner P0 runs (per win 443, in band). B31 moves to about 27-28 runs.
5. WR_PALL_SPEED 0.30-0.50 -> 0.20-0.40: owner review O4.

## B3 speedrunner cause
About -22 pp in three parts: (1) the half-strength free potion, about -9 pp. The speedrunner lost 10.2 pp when the end-boss free potion was removed (11-11b arm spfpb0), and on the planner half strength cost 0.9 of the removal. (2) The Shadowcraft trim on the PALL rogue, about -4 pp pooled (speedrunner rogue -31 pp). (3) The 1.30 boss against the thinnest kit: ilvl 47-49 and 24 % of its PALL boss fights won, against 62 % for the planner. At P0 the speedrunner/planner ratio held (0.47), so the miss is PALL-specific. No rules constant gives the speedrunner +10 pp without lifting the planner past its bands. Hence row 5 and diagnostic cell 6 (the package with the full free potion).

## Sample sizes
B5 needs 200 tactician runs per class (±4.8 pp; about 17 min). B32 needs 100 campaigns per class to read the 5 pp dip, with 50 per class as the minimum.

## Also done
balance.md: status line, recorded default trees after 11-11b and 11-11c (1.3), and v8 measured reading notes (4), marked "(M2b v8)". BACKLOG: O4 row; hunter PALL row updated.

## Proposed decisions
D78 row 1, D79 row 2, D80 row 3, D81 row 4 (team). O4 row 5 (owner review).

## Risks
- B6 PALL may still fail (expected 7-10 pp). Row 2 lifts the PALL hunter, which is already the high class. If cell 2 does not close it, the next lever is the PALL hunter.
- Row 3 also lowers planner PALL (58.7 %, floor 55) and the speedrunner by 1-2 pp.
- The designer read run records in the sim worktree (sim/out/pass-2026-11-11c, sim/out/v6b) with a scratch script in /tmp. Nothing was simulated.

## Commits and files
docs/specs/changes-m2b-v9.md (new), docs/specs/balance.md, docs/BACKLOG.md, this note. Checked by reading the 11-11b and 11-11c reports and recomputing B30 from the v8 run records.
