# Hand-off: Lead Game Designer, 2026-11-11c (M2b v8 tuning package, draft)

Task: build the v8 tuning package from the sim's measured proposals on the M2b v6 pass (docs/reports/balance-2026-11-11b.md, docs/handoffs/sim-2026-11-11b.md). Spec: docs/specs/changes-m2b-v8.md. Status: draft. No src/ or sim/ change (the Core Engineer is on the v7 rename).

## Package (9 rows)
1-2. Early enemy damage × 0.80 at enemy level <= 20 (new EARLY_DMG_MULT, EARLY_DMG_MAX_LEVEL) and ZONE_DANGER_STEP 0.25 -> 0.375: measured B21 Z1-Z2 11.4 %, B38 Z6 84.8 % (both pass), Z5-Z6 1.8 % (short), win +2.7 pp.
3. Mage hpBase / hpPerLevel 50 / 19.5 -> 62 / 21.06: measured mage +4.3 pp P0, +5.4 pp PALL.
4-5. BOSS_HP 13066 -> 12282, BOSS_DMG_MULT 1.17 -> 1.30, with a ladder of 1.32 and 1.34 if planner P0 stays above 35 %. 1.30 in the package is unmeasured (1.27 gave 41.7 %).
6. Beastbond Ferocity and Thick Hide × 1.25: measured +5.9 pp, B7 ratio 0.73. It also lifts the PALL hunter, whose default tree is Beastbond (unmeasured).
7-8. Shadowcraft and Wildcraft trims (heals and mitigation, each with a second step): unmeasured. I kept the switch rule and changed the trees, because the boss factor cannot close the class split. It hits the Mage hardest, and the PALL Shadowcraft rogue hardly moves with it.
9. Packed Satchel's free potion stays free once per fight in every fight, but restores half (new FREE_POTION_MULT 0.5): unmeasured. It is bounded by the measured removal at the end boss (P10 -6.4, PALL -8.0 pp).

Run length (B11, B12, B53) stays with the expedition map default (2b.4, 2b.5). Enemy HP × 0.80 was measured and is not enough. Pet revive is appendix A, a draft outside the package.

## Owner review
- O1: no free potion at the end boss (measured; not done by default).
- O2: free potion at half strength (in the package; he can veto it).
- O3: pet revive channel plus taunt (appendix A).
- Names: "Call Back the Companion" is a draft and needs an originality check.

## Proposed decisions (for the Lead to log)
D72 rows 1-2; D73 row 3; D74 rows 4-5 (factor from the ladder); D75 row 6; D76 rows 7-8 (keep the switch rule, trim the trees); D77 row 9. All are team decisions, with O1-O3 as owner decisions.

## Risks
- B6 PALL is the most uncertain target. Package at 1.27: rogue 77.4, mage 60.6, hunter 52.4 %. Rows 6, 7 and 9 all push it toward closing, but none of them is measured on PALL.
- B2 P10 may still be above 48 % with row 9. If it is, O1 is the remaining lever.
- B1 greedy follows the planner at about 0.6 × and may stay above 18 %. B32 runs 1-5 (55.1 %) needs about -20 pp. Both are re-measured in cells 7 and 9 of the run list.
- Row 1 makes damage jump +36 % between enemy levels 20 and 21. The measured Z3-Z4 deaths stay in band. A ramp is the alternative and is unmeasured.

## Commits and files
- docs/specs/changes-m2b-v8.md (new), docs/BACKLOG.md (rows: Packed Satchel, pet revive, Hunter full-catalogue), this note. Commit hash in the Lead's reply.
- Checked: every measured figure was traced to the 11-11b report's proposals table and package line, or to the sim worktree's sim/out/v6b logs (q1, q2, q5) and the scratch diff (sim/out/v6b/var/x: the X_EARLY form of row 1). No test was run because docs only changed.
