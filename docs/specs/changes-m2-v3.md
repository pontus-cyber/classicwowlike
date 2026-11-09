# Spec changes M2 v3 (M2 task 2.3, design pass 2026-11-09c)

Owner: Lead Game Designer. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), QA.
Every changed or new line in docs/specs/rules.md and docs/specs/balance.md ends with "(M2 v3)". Decisions D24-D31 in docs/DECISIONS.md. Problems 1-5 are the five misses of docs/reports/balance-2026-11-09b.md; P2 = its "also measured" levers.

Type: **number** = src/constants.js only; **mechanic** = engine code (exact behaviour below); **bot** = sim/ change; **target** = balance.md band or metric.

Evidence: designer scratch copies of src/ and sim/ at cb448b0 (sim/out/d3/*, git-ignored); 300 runs per class, seeds 1000-1299, 600-run planner risk warm-up from the prior; campaigns 50 per class on the pass's P0 risk table. "ctl" = unchanged copy (planner P0 28.7 %). "v3" = the full package (scratch v3c with the bot hour weight for P0 bots, v3d for P10, PALL and campaigns; v3d differs from v3c only in catalogue costs, which do not affect P0). Results in docs/handoffs/designer-2026-11-09c.md.

## Change table

| # | Constant or rule | Old -> new | Problem | Evidence | Type |
|---|---|---|---|---|---|
| 1 | Zone danger (rules 7.6); new ZONE_DANGER_FROM, ZONE_DANGER_STEP | none -> enemy damage × (1 + 0.25 × max(0, M - 20) / 10) | 1 (zones 3-6 safe), 4 (speed route safe) | zw0.15/0.25/0.35; B38 spread Z2-Z5 16 pp -> 5 pp; speedrunner 28.4 -> 17.4 % | mechanic |
| 2 | Second Breath (rules 9, 11.2) | any fight -> not in the end-boss fight | 2 (meta power at the boss) | m1: PALL 83.3 -> 71.1 % with rows 3-6 | mechanic |
| 3 | META.vigor.hpPct, META.edge.powerPct | 0.02, 0.02 -> 0.01, 0.01 | 2 | m1 (with 2, 4, 5) | number |
| 4 | META.keen ranks / costs | 3, 100/160/240 -> 2, 150/250 | 2 | m1 | number |
| 5 | META.talent_pt ranks / costs | 2, 250/400 -> 1, 500 | 2 | m1 | number |
| 6 | Meta power budget (rules 11.2) | none -> HP +5 %, Power +5 %, crit +2 %, 1 talent point, uniques, Starforged, no boss resurrect | 2 | rows 2-5 implement it | rule (design) |
| 7 | SPELL.ricochet_bolt.bounceFrac | 0.7 -> 0.4 | 2, B6 (hunter P10 +36 pp from this unlock alone) | P10 ablation: hunter 63.3 % with, 36.7 % without; at 0.4: 38.7 % | number |
| 8 | META costs: vigor, edge 60/90/130/180/240 -> 80/120/170/230/300; quick_study 80/140/220 -> 100/180/280; prospector 50/90/140 -> 60/110/170; swift_boots 150 -> 200; alchemist 120 -> 150; cache 150 -> 200; relics 300 -> 400; starforged 350 -> 450; sp_*2 250 -> 300; stormhawk 200 -> 250; second_breath 400 -> 500 | total 6 730 -> 7 690 | 3 (campaigns too fast) | v3d campaigns: median 23 -> 28 runs, fewest 19 -> 24 | number |
| 9 | ECHO_PER_LEVEL | 2 -> 1.5 | 3 (B30) | sim report proposal; v3: 235 per run | number |
| 10 | ECHO_PER_ZONE | 10 -> 7.5 | 3 | as 9 | number |
| 11 | ECHO_BOSS_PHASE | 15 -> 12 | 3 | as 9 | number |
| 12 | Echo line rounding (rules 11.1) | integer constants -> each line round(constant × count) | 3 (rows 9-10 are fractional) | - | mechanic (one line) |
| 13 | BOSS_HP | 13000 -> 13500 | 4 (greedy and speed close to planner, after row 15) | v3c: planner 26.8, greedy 18.7, speedrunner 16.8 % | number |
| 14 | BOSS_ENRAGE_ROUND | 50 -> 55 | P2 B29 (Final Dark 36 % of boss losses) | sim x-enrage55; v3: 22.8 % | number |
| 15 | Planner hour weight (balance.md 1.1); new PLANNER_HOUR_MULT | VAL_HOUR × 1 for every bot -> × 2 for planner, tactician, speedrunner; greedy × 1 | 4 (lookahead bots ignored Ascendancy: the "speed" route style won 45 % vs 31 % balanced) | v3b out-hm2: planner 30.6 -> 34.4 %, greedy unchanged 23.2 % | bot |
| 16 | Resurrect awareness of bots (balance.md 1.1) | Second Breath counted -> only charges usable at the boss | 2 (bots skipped Boon of Return when holding Second Breath) | m1 before/after: PALL 71.1 -> 75.3 % | bot |
| 17 | Tactician T2 AoE clause (balance.md 1) | every class -> not for the Rogue | 5 (B5) | sim report: rogue boss wins 29.5 -> 35.5 %, est. B5 +8.8 pp | bot |
| 18 | CLASS.mage.hpPerLevel | 17.5 -> 19.5 | B6 (mage 23.0 % after row 1) | vm1: mage 23.0 -> 31.3 % | number |
| 19 | CLASS.hunter.hpPerLevel | 17 -> 15.5 | B6 (hunter 35.3 % after row 14) | vh3: hunter 35.3 -> 29.3 %, Final Dark share of hunter losses 61 -> 48 % | number |
| 20 | PET.thornback.dmgMult | 0.9 -> 1.1 | P2 B9 | v3b: ridgewolf 29.3, thornback 28.3, duskcat 25.7 % (ratio 0.88) | number |
| 21 | B21 (balance.md 3.5) | shares of deaths: Z1-2 <= 15 %, Z3-4 20-35 %, Z5-6 20-35 %, boss 25-45 % -> shares of runs: Z1-2 <= 12 %, Z3-4 3-10 %, Z5-6 + Camp 2-8 %; boss 55-80 % of deaths | 1 | no lever moved a risk-aware planner near the old bands without cutting B1 (zw0.35: 24 % win, mid+late still 18 % of deaths) | target |
| 22 | B24 (balance.md 3.5); new CLOSE_FIGHT_HP | end HP < 20 %, band 5-15 % -> lowest HP during the fight < 35 %, band 4-12 % | 1 (end HP hides dips: autoplay drinks at 35 %) | ctl 4.6 %, v3 5.6 % | target |
| 23 | New B38 tension per zone; TENSION_SPREAD_MAX, TENSION_Z6_MAX | none -> mean lowest HP per zone: max - min over Z2-Z5 <= 10 pp, Z6 <= 85 % | 1 | ctl: 71/75/79/87, Z6 92 (fail); v3: 72/72/69/74, Z6 82 (pass) | target |

Count: 23 rows. 13 number changes (rows 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 18, 19, 20; row 8 covers 11 cost cells), 3 mechanic changes (rows 1, 2, 12), 1 design rule (row 6), 3 bot changes (rows 15, 16, 17), 3 target changes (rows 21, 22, 23).

## Mechanic changes: exact behaviour

**X1. Zone danger (row 1).** In `makeEnemy` (src/engine/combat.js), `dmg = (ENEMY_DMG_BASE + ENEMY_DMG_PER_LEVEL × M) × archetype × variant × template × (1 + ZONE_DANGER_STEP × max(0, M - ZONE_DANGER_FROM) / 10)`, M = the enemy's level. Applies to every enemy built by `makeEnemy`: quest, grind, elite, rare, dungeon trash and boss, Camp waves, summoned adds (they are built at their own level). Not the end boss or Dimming Shards (boss.js, own constants). HP, armor, XP, gold unchanged. No random draws added; seeds replay as before.

**X2. Second Breath journey only (row 2).** In `playerDeath`: the Second Breath charge is skipped when `fight.kind === 'boss'` (the end boss); the order becomes Boon of Return, Second Breath (not at the end boss), Ember of Return. The charge stays unused if the run reaches the boss with it. UI: the profile and character sheet text says "not in the final fight".

**X3. Echo line rounding (row 12).** In `echoes()`: a line's Echoes = `rnd(count × each)`; the total is the sum of the lines × the Oath multiplier, rounded as before. The summary shows each line's rounded value.

## Bot changes (sim/)
- Row 15: `makeCtx` gets `hourMult = PLANNER_HOUR_MULT` (× STYLE_SPEED_HOUR_MULT for the speed style) for planner, tactician and speedrunner value calls; the greedy keeps 1. BAL gains PLANNER_HOUR_MULT 2.
- Row 16: `bestBoonIndex` (and any other resurrect count) uses `res.boon + Embers`, not `res.meta`.
- Row 17: tactician T2 `>= 2 Shards` clause skipped when classId is rogue; the 1-Shard clause stays.
- Recorder (rows 21-23): per fight add zone and lowest HP fraction during the fight (damage events on the player); B21 by share of runs, B24 on lowest HP, B38 per zone. The designer's scratch recorder (sim/out/d3/base/sim/lib/recorder.mjs) shows one way: fx entries gain `[zone, lowest HP %, potions used]`.

## Notes
- Tried and rejected: zone danger 0.15 (Z5 still 87 % mean lowest HP) and 0.35 (planner 24 %, mage reaches the boss 67 %); danger from level 10 (Z2 deaths 11 % of entering runs); Ricochet Bolt cooldown 3 (hunter P10 still 44 %); pet power 0.30-0.33 (hunter boss fights 47-50 rounds); BOSS_HP 13500 without the hour weight (planner rogue 21 %, class spread 9.3 pp).
- Open: the PALL rogue (58 %) trails mage and hunter (81-83 %); in scratch the rogue PALL rate rose to 85 % when only Satchel was removed from the profile, on the same seeds and with a swapped risk table. The cause (engine or bot) is not found; the Sim engineer should find it before B6 PALL is tuned.
