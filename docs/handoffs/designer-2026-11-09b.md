# Hand-off: Lead Game Designer, 2026-11-09b (M2 task 2.3, design pass M2 v2)

## Summary
- Changed docs/specs/rules.md and docs/specs/balance.md in place; every changed or new line ends with "(M2 v2)". Full change list with old -> new, problem, evidence and type: docs/specs/changes-m2-v2.md. Decisions D16-D23 (status team).
- 56 changes: 46 number changes (src/constants.js only), 6 mechanic changes (engine code), 2 UI-only changes, 1 simulator bot change, 1 balance-target change (5 bands).
- Every number change and the 6 mechanics were measured together in a designer scratch copy of the simulator (git-ignored, nothing in src/ or sim/ changed). Planner P0 now wins rogue 29.8 %, mage 22.8 %, hunter 27.5 % (was 39.1 / 0.0 / 0.1), pooled 26.7 % (band 20-35 %), and a run that reaches the boss takes 44-46 min in the pacing model (was 48-50).
- Not solved in this pass: PALL is too easy (B3, B10), too many boss losses end at Final Dark (B29), mid- and late-zone deaths are still rare (B21), Thornback trails the other pets (B9). Details and next levers under "Risks".

## What changed, by problem
1. **Mage and Hunter cannot win; boss phase 2 is a wall (D16-D18).** Interrupts always hit (a missed interrupt let a 950-damage Litany through). Linked weakens per living Shard (-15 % each, max -60 %) instead of all-or-nothing, so each Shard killed speeds up the kill. Shards take double damage from AoE spells: every class has one (Whirling Edges, Rime Burst/Cinder Storm, Volley Rain). Shard HP 1000. The boss got 13000 HP and 260 melee back to bring win rates into the band. The mage got the balance report's HP/STA/mana numbers plus about 40 % more damage on its main spells, which was the measured gap. The hunter got more pet damage.
2. **Zone 1 with two spells, early deaths (D20).** A Trainer is guaranteed in rows 3-5 of every zone. Arcane Ward and Mark Prey move to level 4, Throat Jab and Mend Companion to 6. Zone 1 quests have at most 2 mobs. Quest and kill XP go up so the player keeps pace with the rows instead of being 1-3 levels under them.
3. **Leaving early never happens; dungeons and elites are a bad deal (D21).** Travel on is legal one level below the exit level (Swift Boots: two). The player's level follows the rows' content level, so the exit level was only reached in the last row; this lowers the bar instead of raising XP further. Elites are now +1 level (was +2) with 2.8x HP. Dungeons are 2 levels lower with a 5.6x boss: the planner now clears 0.3-2.3 dungeons per run at about 97 % (was 0.02-0.1 per run, with 90-98 % deaths on entry).
4. **Pacing and manual play (D22, D23).** Zones have 7 rows instead of 8, with XP scaled to keep about 10 levels per zone, and BOSS_TIME_PAR 120. The round time in the model is now a UI budget (1.5 s on screen at the default speed; clicking during enemy animations finishes them) plus 1.0 s of decision. QA measured 2.3-2.7 s on screen at today's 1x speed, so the UI must make the default faster. B5: the tactician as specified measured the bot rather than manual play (its search lost to autoplay at the boss). It now applies telegraph rules first (pre-empt announced big hits, AoE on 2+ Shards) and uses autoplay instead of the search in the end-boss fight.
5. **Rogue talent trees (D19).** Rogue energy regen 25 (was 30), Open Vein and Deep Wounds trimmed, Serrated Finish raised. With always-hit interrupts the Bladework rogue gets reliable boss fights. Trees 21-30 % (ratio 0.71). Mage and hunter trees, measurable for the first time, got small talent trims and buffs to reach >= 0.6.

## Evidence (designer scratch runs)
Method: copy of src/ and sim/ at 541507d (sim/out/x-*, git-ignored) with constants overridden and the six mechanics prototyped; `sim/run.mjs --bot planner --class all --runs 300 --seed-start 1000 --warmup 600 --workers 2` unless noted. The unchanged copy reproduces the report (rogue 35.3 %, mage 0.0 %, hunter 0.0 % on 300 runs). Planner P0 win % rogue / mage / hunter unless noted.

| ID | Change set | Result |
|---|---|---|
| S-boss | Linked per Shard, AoE x2 on Shards, SHARD_HP 1000 (+ BOSS_ARMOR 900, later dropped) | 53.0 / 0.0 / 31.0; hunter boss losses move to phase 3 |
| S-mage1 | S-boss + mage HP 17.5/level, STA 1.25, mana regen 0.025 | mage 0.0 % (reaches the boss 31 %, was 15 %); PALL mage 70.3 % (was 0) |
| S-nomiss | S-mage1 + interrupts always hit (+ a Shard death hurting the boss, later dropped) | 67.7 / 1.0 / 75.0 |
| S-mage-dmg | S-nomiss + mage main spells x1.25 | mage 41.3 % (reaches the boss 64 %); a 50 % larger Arcane Ward instead: 8.3 % |
| S-early | Trainer guarantee, earlier spells, zone 1 cap; then + turn-in XP 1.0; + elite/dungeon numbers; + kill XP 0.25 | rogue reaches the boss 75 -> 81 -> 83 -> 88 %; rogue and hunter enter 0.6-0.85 dungeons per run, 97 % cleared |
| S-slack | 8-row package + travel on at exit level - 1 | speedrunner P0 leaves at 9, 19, ...; 42-44 nodes; planner unchanged |
| S-final8 | Full package with 8 rows, 600 runs | 38.2 / 28.8 / 35.0; 47-50 min manual |
| S-rows7 (final) | Full package as specified, 600 runs | 29.8 / 22.8 / 27.5; reaches the boss 80 / 86 / 88 %; 42 nodes, 300-345 rounds, 142 h, 44.0 / 46.1 / 46.2 min manual |
| S-rows7 others | same constants | speedrunner P0 29.3 / 19.3 / 29.3 (36-37 nodes, 31-32 min autoplay); speedrunner PALL 74.3 / 67.3 / 85.0 (31 nodes, 28-29 min autoplay, 77-80 h); planner PALL 72.3 / 82.0 / 91.7; greedy P0 10.3 / 19.0 / 28.0 |
| S-trees | same constants, planner P0 per tree | rogue 30.0 / 21.3 / 29.7; mage 26.3 / 23.0 / 28.7; hunter 23.7 / 27.7 / 22.0 (before the tree trims: mage 44.0 / 32.7 / 59.3, hunter 24.0 / 42.3 / 27.0) |
| S-pets | same constants | ridgewolf 27.5, duskcat 22.7, thornback 13.7 (thornback 11.0 before dmgMult 0.9) |

Rejected after measuring: a wider content-level span per zone (early deaths rose to 62-87 % of deaths), a steeper enemy damage curve (little effect on mid-zone deaths), a story XP bonus of 1.6 (1 node shorter speed route), discounting XP above the exit level in the planner's value (the planner still played every row).

## Expected effect per target (S-rows7 unless noted; "before" from docs/reports/balance-2026-11-09.md)
| Target | Before | After | Band | Result |
|---|---|---|---|---|
| B1 planner P0 | 13.1 % | 26.7 % | 20-35 % | pass |
| B1 greedy / speedrunner P0 | 1.2 % / 12.9 % | 19.1 % / 26.0 % | 8-18 % / 10-25 % | just above both bands |
| B1 tactician, B5 manual gap | 12.2 %, -0.8 pp | not measured | 30-50 %, 8-25 pp | needs the D23 bot |
| B3 planner PALL, B10 meta gap | 49.0 %, 36 pp | 82.0 %, 55 pp | 55-75 %, 20-45 pp | fail (too easy) |
| B6 class band P0 | spread 39.1 pp | spread 7.0 pp, max deviation 3.9 pp | <= 8, <= 5 | pass |
| B6 class band PALL | spread 96.7 pp | spread 19.4 pp | <= 8 | fail |
| B7 trees (worst/best) | rogue 0.32, mage and hunter no wins | rogue 0.71, mage 0.80, hunter 0.79 | >= 0.6 | pass |
| B9 pets | 0.00 | 0.50 | >= 0.7 | fail (P2) |
| B11 run length | 49.0 min | 44-46 min | 40-50, aim 45 | pass |
| B12 speedrun (autoplay, PALL) | 33.9 min | 28-29 min (runs at the boss) | <= 30, <= 0.7 x B11 | expected pass; wins-only and p10 to measure |
| B14 nodes normal / speed | 48 / 44 | 42 / 31 | 38-47 / 28-37 (new) | pass |
| B16 rounds: end boss | 32 | median 43 | 30-45 | pass; elites and dungeon bosses expected in band (the report measured 10-13 rounds with the same HP multipliers) |
| B17 hours normal / speed | 161 / 109 | 142 / 78 | 125-155 / 70-100 (new) | pass |
| B21 deaths Z1-Z2 / boss | 34.2 % / 53.8 % | 18.4 % / 78.8 % | <= 15 % / 25-45 % | better, still fail; mid and late deaths stay rare |
| B23 boss losses in phase 3 or enrage | 37.5 % | 83.9 % | >= 40 % | pass |
| B29 boss losses to Final Dark | 19.3 % | 42.1 % | 5-20 % | fail: mage and hunter boss fights run to round 45-50 |

## Owner review (defaults the team builds on)
1. Zones have 7 rows instead of 8. The map is one column shorter and a run lands near 45 minutes.
2. Interrupts never miss. When you interrupt the boss's Litany, it is stopped.
3. You may travel on one level before a zone's exit level (two with Swift Boots). Leaving early is the speed route: fewer hours, more risk in the next zone.
4. Every zone has a trainer in its middle rows. Mage Arcane Ward and Hunter Mark Prey come at level 4, Rogue Throat Jab and Hunter Mend Companion at 6. Zone 1 quests have at most 2 enemies.
5. End boss phase 2: each Dimming Shard you kill weakens the boss's shield (-15 % per Shard instead of -60 % while any lives), and AoE spells hit Shards twice as hard. The boss has more HP (13000) and hits harder.
6. The default animation speed gets faster: a combat round takes at most 1.5 s on screen, and clicking during the enemy animations skips them.

## Requests
- **Core Gameplay Engineer:** constants per docs/specs/changes-m2-v2.md; mechanics M1-M6 (exact behaviour in that file). No new events are needed; `n` on the `linked` event is optional.
- **Simulation & Balance Engineer:** update BAL (balance.md section 6: five bands and two tactician constants), the tactician (balance.md 1, D23) and `exitLevelOf` (TRAVEL_EARLY_LEVELS). Re-pick the default trees (B7 best). Then run the full pass. First tuning levers, within TUNE_LIMIT: Final Dark share (B29: hunter and mage boss damage, or BOSS_ENRAGE_ROUND), PALL (B3/B10: Second Breath and the resurrect-fuelled dungeon dives give PALL 3-5 dungeons per run), greedy and speedrunner P0 slightly high (BOSS_HP).
- **UI/UX Engineer:** the round time budget (rules 3, M2 v2) and input during enemy animations; the quest enemy count on the map (BUG-QA-02); replace the literal 8 rows in src/ui/screens.js and src/ui/hud.js; the travel-on text uses the new level.
- **QA:** the constant tests (qa/engine/s13-constants.test.mjs, qa/sim/params.test.mjs) fail until src/constants.js and sim/lib/params.mjs follow the spec; re-measure the round time with qa/browser/pace.mjs against PACE_ROUND_ANIM_S.

## Risks and known gaps
- The scratch numbers come from my prototype of the six mechanics; the Engineer's code may differ in detail (for example, how DOT snapshots see Linked). The sim pass on main is the measurement that counts.
- PALL (B3, B10): with dungeons worth entering, the PALL planner enters 3-5 dungeons per run (P0: 0.3-2.3) and almost never dies at the boss. Neither the stat ranks nor Second Breath alone explain it (removing either changed PALL by 0-9 pp). A meta change is a decision for the next pass.
- B21 mid and late zones: the planner avoids risk well, so deaths stay in zones 1-2 and at the boss. A steeper enemy damage curve did not change this.
- B5 is unmeasured until the tactician follows D23.
