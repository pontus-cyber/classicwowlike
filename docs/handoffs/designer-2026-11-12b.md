# Hand-off: Game Designer (balance), 2026-11-12b (M2b v15 draft)

Task: docs/specs/changes-m2b-v15.md, at most 4 rows: the expedition B60 dungeon-boss miss (Warden Belk of Harrow), B12 (speedrun 31.3 min from SET_OUT), one cheap extra. Status: **draft**. No src/, sim/ or other spec edited.

## The package
| Row | What | Basis |
|---|---|---|
| 1 | `z1_belk.hpMult` 1.05 -> 0.90 | The two opener-line deaths (seed 1040, Rogue and Hunter) replayed: the Deathblow was answered in both. The Rogue loses a 25-round damage race on every line (autoplay too; soft enrage from round 20). The Hunter's opener sends the pet, which dies in round 11. Planner Rogue against Belk: 21.2 rounds, 18.2 % deaths on classic (n 110), against 0 % for Mawgrim and Aldrec. Replays at × 0.857 HP: opener 2 -> 1 of 7 Belk fights, one button 7 -> 7 (classic 7 -> 6 of 10) |
| 2 | Swift passage: `TAKE_ROAD` within ROAD_SWIFT_TOLLS 15 of zone time gives ROAD_SWIFT_XP_FRAC 0.75 × xpToNext(L) XP | The rush path is XP-bound. Speedrunner wins take 27.6 fights against the planner's 28.3. They save nodes and tolls but need the same fights to reach level 60. Road cost moves tolls, not minutes. Expected B12 about 29.8 min [inference; unmeasured] |
| 3 | B12 and B3 speed read on the v11 speedrunner policy (it takes a dungeon on its way) | v12 policy: 69 wins of 2 100, too few to read; v11 policy: 286 wins. Its edge is gear |
| 4 | `z2_mawgrim.hpMult` 1.1 -> 0.95, gated (`C.GATES.mawgrimHp`, off) | Same long-fight pattern: planner Mage against Mawgrim, 23.7 rounds, 33.3 % deaths on classic P0 (n 162) |

Proposed D123-D125. Sim: 4 cells, about 30 minutes, main cells `--map expedition --prep`, decision rules in the spec.

## How the cause was found
I used a scratch script in /tmp (not committed). It replays each onebutton run of sim/out/pass-v14/think from its seed with `--log`, steps to the Belk fight and snapshots it. Then it replays the fight with the opener line, autoplay and one button, with event traces and with Belk's HP and damage scaled. The per-boss death and round tables come from the `fc` / `fx` fields of the pass-v13 and pass-v14 cells.

## For the Lead
- Content Designer or Engineer: row 1 is a single content value. Row 4 needs a `C.GATES.mawgrimHp` switch. Row 2 is engine code: expedition.js TAKE_ROAD, a `swift` event, `swift` in the map view or heatPreview. speedFog and planFog value its XP. Two constants and a UI tooltip.
- Sim: row 3 has no engine change. The v11 policy becomes B12's bot (balance.md 1 text and the flip script).
- The Rogue's seed-1040 Belk fight stays lost (no potions, every line dies). With row 1 that leaves 1 of 30 (3.3 %) on the v14 seeds.
- BACKLOG: the B12 row now points to rows 2-3, and there is a new Belk / Mawgrim row.
