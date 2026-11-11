# Hand-off: Lead Game Designer, 2026-11-11g (M2b v12, last package before the flip, draft)

Task: the package after the v11 measure (docs/reports/balance-2026-11-11g.md, docs/handoffs/sim-2026-11-11h.md). Spec: docs/specs/changes-m2b-v12.md. Status: draft. No src/ or sim/ change; balance.md and expedition.md not edited (row 3's band is folded in when D102 is accepted, as v11 rows 5-7).

## Findings (v11 run records, scratch script, nothing re-simulated)
1. **The chain of TIME_DIM_FIGHT 2 is walking through the dark.** An encounter's own tolls start no second encounter; a step into a Dimmed node costs 1 + 2 tolls, the front moves 0.4 hop per toll, so each outward step goes 0.2 hop deeper (with 1 toll: 0.2 shallower). 45 % of Dimmed encounters follow another; 44 of 52 Dimmed deaths are at depth 1+.
2. **Caught zones are mostly a chosen brush with the edge.** 52 % of caught zones hold one encounter; runs with a Dimming-Hot entry have 2.93 encounters against 1.12. The 8-18 % band predates H.5 (the edge pays) and the 9.5 budget (model 26 %).
3. **B12 rose 1.0-1.5 min per class at the same fights and nodes** (per-event time, most likely v11's extra gear drops). The expedition speedrunner is the planner with a speed weight, valuing gear and gold; balance.md 1 specifies tolls to the exit level.

## Package (5 rows)
1. v11 outcomes into the engine: Delve price 2, EXPED_DROP_MULT 1.9, DUNGEON_DIM_HOLD removed, Beastcall Horn stays 12.
2. TIME_DIM_ESCAPE 1 (new): a Dimmed encounter after a MOVE farther from the Shardfall costs 1 toll; all others 2. Share 20.2 -> 10-14 % expected.
3. B43 caught band 8-18 -> 8-25 % (target, argued; owner item O9). Share band unchanged.
4. Speedrunner on the expedition follows balance.md 1 (tolls, death, missing levels; no gear, gold or heat terms). B12 -0.4 to -1.0 min expected.
5. Ricochet Bolt bounce 0.40 -> 0.30, gated on expedition PALL >= 50 %. Classic PALL hunter -3 to -4 pp; one bounce would fix the classic spread but costs PALL about 2.3 pp.
P10: standardOrder unchanged (P10 holds Cartographer; B31/B32 pass with this order; B2 is read on the expedition after the flip).

## Expected flip outcome
Criteria 2 and 3 pass; criterion 1 passes on B43 (rows 2-3); B12 is at the edge (29.9-30.6 min from SET_OUT, ratio 0.69-0.71), about an even chance. O10 covers a miss of 0.5 min or less.

## Sim plan
13 cells, about 40 min on 2 workers, decision rules for rows 2 and 5 and for B12 in the spec.

## Owner items
- O9: B43 caught band 8-25 %, because H.5 pays the player to work at the dark's edge. Default: as written.
- O10: B12 missed by <= 0.5 min after row 4 -> flip with B12 as a known miss, next arm the speedrunner's prep; larger miss holds the flip. Default: as written.

## Risks
- Row 2 and row 4 effects are inferences; row 4 may cut less if the toll-optimal path already avoids most gear detours.
- Row 2 could add up to 1.5 pp of caught zones (a cheaper way out makes the edge cheaper); the new band has room.
- Row 4 lowers the speedrunner's win rate (B3 speedrunner already under its band, O4) and the B12 sample.
- Row 3 is a band change; its reasons are in the spec ("Where v11 stands").

## Proposed decisions
D100-D104 (team), O9-O10 (owner, defaults apply); table in the spec.

## Files
docs/specs/changes-m2b-v12.md (new), docs/BACKLOG.md (two items, the Beastcall item updated), this note.
