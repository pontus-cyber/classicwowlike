# Hand-off: Lead Game Designer, 2026-11-11f (M2b v11 flip package, draft)

Task: the next package after the merged v9 + v10 measure (docs/reports/balance-2026-11-11f.md, docs/handoffs/sim-2026-11-11g.md). Spec: docs/specs/changes-m2b-v11.md. Status: draft. No src/ or sim/ change; balance.md not edited (band rows 5-7 are folded in when accepted, as v9 row 5 and v10 C3).

## Finding
The expedition's win gap is at the boss and it is gear: boss win given reach 21.6 % at ilvl 46.5 against about 39-42 % at ilvl 50.1 on the classic map, which sits on the classic map's own boss-win-by-ilvl line. Missing: about 4.5 loot-bearing kill drops and about one dungeon clear per run (0.46 against 1.5). Potions are not the gap (8.9 used per run against 7.0-8.6). Source: 11-11f run records (sim worktree sim/out/pass-v9v10), scratch script, nothing re-simulated.

## Package (8 rows)
1. EXPED_DROP_MULT 1.6 (new): kill item and junk chance on expedition runs, as GRIND_DROP_MULT.
2. EXPED_DUNGEON_BOSS_DROPS 3 (new; classic stays 2).
3. Delve price 2 -> 1: at 0.35 completion a Delve is worth about 49 per point at price 2 and 98 at price 1 (threshold 60). The swap problem price 2 answered is gone (0.83 -> 0.10 swaps per run after v10 D1); guard: price 2 returns if > 0.25 Delves abandoned per run.
4. TIME_DIM_FIGHT 1 -> 2 for B43: raises the encounter's price by about 35 % without raising its death chance; arm DIM_DMG_MULT 1.6.
5. B41 C_step PALL band 0.70-0.92 and >= P0 + 0.05 (target).
6. B42: no-vision cell also loses the camp's vision perks (definition).
7. B12: 30-minute cap counted from SET_OUT on expedition runs (the camp minute), 200 wins (target).
8. Beastcall Horn cooldown 12 -> 15, gated on expedition PALL >= 50 % and on an attribution arm (B6 PALL hunter on both maps).
Confirmed: C1 1.4. B4: one final read now that Delves return (8 pp rule), then keep or drop. No rows: B40 random (D2 value set), B7 (0.2 pp, interval), B1 greedy and B32 (classic only).
Expected: planner P0 21-25 %, PALL 49-54 % (PALL is the risk; conditional cell 10 with EXPED_DROP_MULT 1.9).

## Flip criteria
Rows 1-3 for criterion 2; rows 4, 5, 7 (and the D2 value for B40) for criterion 1. Criterion 3 (8.2 entries in C.META, B31 re-measured, ui-regress A and M) has no designer row: Engineer, Sim and QA.

## Sim plan
12 cells plus a hash check, about 42 min on 2 workers; decision rules for rows 3, 4, 8, B4 and cell 10 are in the spec.

## Owner items
- O7: appendix P stays after the flip (O5 default); it becomes the next arm if v11 leaves a criterion about 1 pp short. Reason: it does not target the gear gap and it is a new stream with four hooks, not a one-line change.
- O8: classic-map residue (B1 greedy 18.2 %, B7 0.59, B32 runs 1-5 37.3 %) accepted, not tuned, since the classic map stops being the default at the flip.

## Risks
- Every effect except the Delve value arithmetic is an inference; the ilvl-to-win slope is taken from between-run spread on the classic map (an upper bound).
- Row 4 can chain (the front advances 0.8 hop during a 2-toll fight); the arm covers it.
- New in BACKLOG: expedition greedy wins 0.2 % (B1 greedy band 8-18); expedition P0 class spread 9 pp with the hunter last (10.7 %).

## Proposed decisions
D91-D98 (team), O7-O8 (owner, defaults apply); table in the spec.

## Files
docs/specs/changes-m2b-v11.md (new), docs/BACKLOG.md, this note.
