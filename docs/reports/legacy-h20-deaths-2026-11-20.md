# Legacy hero 20: why the autoplay runs die in zones 2-4, 2026-11-20

Status: measurement report (Simulation & Balance Engineer). Nothing tuned; src/ untouched. Commit under test: 0ebd513 (main, D161). Question: with Legacy and Economy v2 on, about a third of 40 autoplay runs per class at hero 20 die in zones 2-4 and quests are not the cause (docs/handoffs/qa-2026-11-19c.md section 3). Why?

## Answer

**It is (a), the out-of-combat policy of the autoplay player (build, spell and item bars, hub, start camp, map walk). It is not (b) and not mainly (c).** The combat is the same code on both sides: the sim planner fights with `R.autoAction`, as the autoplay does. On the same hero-20 profile and the same seeds 1-40 the planner loses 7.5 % of its runs in zones 2-4 (autoplay 45.8 %), 10.0 % in zones 1-6 (autoplay 70.0 %), and wins 46 % of runs (autoplay 0 %). Replacing the planner's talent tree, bars, start camp, hub and map walk by the engine's own, one part at a time and then all together, takes the planner to 47.5 % in zones 2-4 (autoplay 45.8 %): the whole gap is these parts, each worth 4-12 points, none sufficient alone.

| Hero 20, seeds 1-40, 40 runs a class (120) | Autoplay (QA player) | Planner |
|---|---|---|
| Die in zones 2-4, rogue / mage / hunter | 57.5 / 57.5 / 22.5 % (all 45.8 %) | 7.5 / 12.5 / 2.5 % (all 7.5 %) |
| Die in zones 1-6 | 80.0 / 82.5 / 47.5 % (all 70.0 %) | 12.5 / 15.0 / 2.5 % (all 10.0 %) |
| Win | 0 / 0 / 0 % | 52.5 / 50.0 / 35.0 % |
| Deaths per fight in zones 2-4 (quest fights) | 4.2 % (5.2 %) | 0.5 % (0.3 %) |
| Death rate per fight with 1 / 2 / 3 enemies | 0.3 / 1.0 / 14.7 % | 0.2 / 0.2 / 2.1 % |

(The QA hand-off measured 30 / 30 / 26 deaths in zones 1-6 of 40; this run has 32 / 33 / 19. Rogue and mage agree; the Hunter is 7 runs lower, which I did not chase: pet, loot rule and seeds can differ. "About a third" in zones 2-4 is 46 % here, 55 of 120.)

## 1. Method

- `sim/legacy-h20deaths.mjs run`: C.GATES.legacy, oruvathLegacy and economyV2 on; expedition map with the start camp; profile `later` (two runs played, nothing bought); the class's hero at hero level 20 by `R.debug.setHero` (power 48; the cell of `sim/run.mjs --hero 20 --oruvath --econ`); Hunter with the sim's default pet. Seeds 1-40 per class. Every fight is recorded (zone, node type, ring, enemies with level and archetype, hero power, HP, healing draughts and mean equipped item level at the start; outcome, lowest HP; resurrects).
- Drivers: `--bot autoplay` is qa/browser/policy.mjs with the game's autoplay in every fight (what qa-2026-11-19c measured); `--bot planner` is sim/bots/planner.mjs with the frozen band risk table sim/tables/legacy-hx/risk-H16-20.json (the batch `sim/run.mjs --bot planner --hero 20 --oruvath --econ` gives the same picture: 60.0 / 37.5 / 37.5 % wins, 22.5 / 10.0 / 2.5 % deaths before the Camp with its own table refresh).
- Ablations (`--abl`): the planner's spec with one part replaced by the engine's autoplay choice: `talent` (the engine's talent pick, EA.AUTO_TREE), `bar` (the engine's spell and item bar), `node`, `hub`, `prep` (the engine's map walk, hub and start camp), `vendor` (engine vendor and trainer stages). `--bot autoplay --abl talent` plays the sim's standard build of the planner's tree inside the QA player.
- Tables below come from `node sim/legacy-h20deaths.mjs tables <dir>`; `arms <dir>...` prints the ablation table.

## 2. Ablations: what moves the zone 2-4 deaths (hero 20, 120 runs per arm)

Share of runs dying in zones 2-4 / in zones 1-6 / winning, by class:

| Arm | Rogue | Mage | Hunter | All classes Z2-4 / Z1-6 |
|---|---|---|---|---|
| Planner | 7.5 / 12.5 / 52.5 | 12.5 / 15.0 / 50.0 | 2.5 / 2.5 / 35.0 | 7.5 / 10.0 |
| Planner, engine talent tree (0 / 0 / 1 for the planner's 2 / 1 / 2) | 30.0 / 45.0 / 35.0 | 15.0 / 20.0 / 37.5 | 12.5 / 12.5 / 17.5 | 19.2 / 25.8 |
| Planner, engine spell and item bar | 7.5 / 15.0 / 37.5 | 15.0 / 15.0 / 0.0 | 30.0 / 32.5 / 2.5 | 17.5 / 20.8 |
| Planner, engine map walk only | 17.5 / 40.0 / 32.5 | 40.0 / 75.0 / 12.5 | 0.0 / 20.0 / 22.5 | 19.2 / 45.0 |
| Planner, engine hub only | 15.0 / 20.0 / 42.5 | 20.0 / 22.5 / 52.5 | 0.0 / 0.0 / 40.0 | 11.7 / 14.2 |
| Planner, engine start camp only | 17.5 / 25.0 / 42.5 | 17.5 / 20.0 / 37.5 | 10.0 / 10.0 / 35.0 | 15.0 / 18.3 |
| Planner, engine vendor and trainer | 10.0 / 12.5 / 22.5 | 12.5 / 17.5 / 22.5 | 5.0 / 5.0 / 7.5 | 9.2 / 11.7 |
| **Planner, engine talent + bar + map + hub + start camp** | 62.5 / 82.5 / 2.5 | 55.0 / 85.0 / 0.0 | 25.0 / 60.0 / 0.0 | **47.5 / 75.8** |
| Autoplay (QA player) | 57.5 / 80.0 / 0.0 | 57.5 / 82.5 / 0.0 | 22.5 / 47.5 / 0.0 | 45.8 / 70.0 |
| Autoplay with the sim's talents of the planner's tree | 30.0 / 40.0 / 22.5 | 62.5 / 90.0 / 0.0 | 32.5 / 77.5 / 0.0 | 41.7 / 69.2 |

Readings. (1) The full engine package on the planner's shell reproduces autoplay (47.5 against 45.8 % in zones 2-4, 75.8 against 70.0 % in zones 1-6), so nothing else differs: same combat, same profile, same engine. (2) No single part is the cause. Talents, bars, map walk, start camp and hub each add 4-12 points; the planner's trees are the recorded defaults of balance.md 1.3 (Venom rogue, Frost mage, Hunter tree 2), the engine's are EA.AUTO_TREE (Honed Edges, Fire, Marksmanship). Putting the planner's tree into the QA player helps only the rogue (57.5 to 30.0 %). (3) The start bars differ in what they cast: the planner's mage bar holds Cinder Storm and Glacier Spike, the engine's does not; the planner's rogue bar holds Open Vein, the engine's Final Reckoning and Shadowstep Strike. The engine's item bar at the first fight lists one healing draught; the planner's template lists three entries (healing, tonic, flask or mana), though it carries no tonic or flask at that point (effect not isolated).
- Ablation arms with the Mage's or the Hunter's engine bar win 0-2.5 % at the Camp, as autoplay does: that is the Camp bar, not the zones, and not this question.

## 3. Setup (b): not the cause

- The planner runs the same profile and the same `setHero` hero: 7.5 % in zones 2-4. A setup that was wrong for the hero (talents, kit, spells) would hurt both drivers.
- Hero state at the start (any class): hero 20, power 48, free talent points 20 spent in the first hub, every spell the level allows learned and trained to 48, ten common kit items at item level 48. The same state a real hero 20 starts every run with (the kit is not kept between runs, legacy.md 1.6); a real hero's talents are its owner's choice, which is the point of the ablation.
- What a real hero 20 has that the `later` profile does not: the hall. With 1 700 Legacy points spent in the standard order (`--profile bought`; satchel, vigor, edge, quick study, pockets, old hand, quartermaster...): autoplay 35.8 % in zones 2-4 (was 45.8), 61.7 % in zones 1-6, 5 wins of 120; planner 8.3 % (7.5), 16.7 % (10.0). The hall helps the weak policy by 10 points and does not change the diagnosis.
- Gear: the kit is item level 48 for everyone; at the fights of zones 2-4 the mean equipped item level is 47.1-47.6 for both drivers, 0.5 apart (Z2 arrival 45.1 and 45.2, Z6 50.6 and 51.4). Death rate per fight by item level minus power is flat (-6..-3: 4.5 %, -3..0: 4.1 %, >= 0: 4.3 %).

## 4. Hero level: the gap grows with the level, and is not specific to 20

Deaths in zones 2-4 / zones 1-6 / wins, all classes, 120 runs per cell (seeds 1-40):

| Hero | Autoplay | Planner |
|---|---|---|
| 5 | 9.2 / 29.2 / 0.0 % | 0.8 / 0.8 / 5.8 % |
| 10 | 23.3 / 61.7 / 0.0 % | 7.5 / 15.8 / 30.0 % |
| 15 | 49.2 / 77.5 / 0.0 % | 12.5 / 17.5 / 43.3 % |
| 20 | 45.8 / 70.0 / 0.0 % | 7.5 / 10.0 / 46.7 % |
| 25 | 57.5 / 80.0 / 2.5 % | 10.0 / 13.3 / 50.8 % |

The planner's zone deaths stay between 1 and 13 % of runs from hero 5 to 25, the table the band risk tables and legacy.md 6.3 describe; the autoplay's rise from 9 to 58 %. The zones are not getting harder faster than a built hero can follow; the autoplay's build and bars do not follow the level.

## 5. Breakdown of the autoplay deaths in zones 2-4 (55 of 120 runs)

The full tables for both drivers follow in sections 7 and 8 (output of `sim/legacy-h20deaths.mjs tables`). The points that matter:

- **Class and zone.** Rogue 23 (17 in zone 2, 2 in zone 3, 4 in zone 4), mage 23 (2, 11, 10), hunter 9 (3, 4, 2). The planner: 3, 5, 1 deaths.
- **Node type.** 47 quest, 6 dungeon, 2 grind. Per fight the rate is the same for quests and dungeons (5.2 and 5.1 %), grinds 0.8 %, elites and treasures 0 of 44. Quests are 85 % of the deaths because they are 69 % of the fights, so the QA reading (quests are not the cause; there is no quest gate that would help) holds: autoplay dies at every fight that has three enemies. 30 of the 47 quest deaths are ring 1 (band to band + 1), the easiest ring.
- **Enemy count.** Death rate per fight in zones 2-4: 1 enemy 0.3 %, 2 enemies 1.0 %, **3 enemies 14.7 %** (48 of 55 deaths; planner 2.1 %, 6 of 9). Fatal fights have 2.9 enemies against 2.0 for all fights.
- **Enemy.** Casters are 42 % of the enemies in fatal fights and 20 % of all enemies in zones 2-4 (planner: 44 % and 21 %). The killers: Wind Shaman (hex bolt) 6, Bog Witch (hex bolt) 5, Cairn Brute (strike, heavy smash) 8, Marsh Lurker 3, Dust Jackal 3, Sunscribe Adept 3, Weir Crawler 2.
- **Power gap** (highest enemy level minus hero power): flat. <= 0: 2.6 %, 1-2: 5.4 %, 3-4: 3.5 % of fights fatal. The mean gap of fatal fights is 1.3 against 1.0 for all. The fights are at the hero's own level; no level gate would remove them.
- **Draughts.** Not out of them: 3.7 healing draughts at the start of the fatal fights (3.6 overall), 2.8 left at death, 0.87 used in the fatal fight. Death rate by draughts at the start: 0: 0 of 14, 1-2: 4.6 %, 3-4: 4.2 %. The planner dies with 3.8 left. The engine drinks one draught at HP below 35 % and the draught's cooldown is 4 rounds (POTION_CD); both drivers share the rule, so it is a common limit (see recommendation 3) and not the difference.
- **Gear item level.** Flat (section 3).
- **HP at the start.** 90.2 % for fatal fights, 94.3 % for all; fatal fights start nearly full, so HP management at the start is not the cause.

## 6. (c), a real balance problem?

Not at the level the question asks. A hero with the planner's build survives hero 20 zones 2-4 in 92.5 % of runs; the planner's remaining zone deaths are 3-enemy caster fights too (6 of 9; 2.1 % of such fights against 0.2 % of the others), a thin margin and what the band risk tables describe, and the same order as legacy.md 2.2's measurement for zones 5-6 at hero 20 (7.0 % of runs). Two things to keep in view for the Designer: the 3-enemy caster fights are the only fights with a double-digit death rate for a weak build; and the Camp bar results of the Mage and the Hunter with the engine's bars (0-2.5 % wins) are a separate matter from this report.

## 7. Autoplay: full tables

Outcome per run (deaths by where they happen):

| class | runs | win | die Z1 | die Z2-4 | die Z5-6 | die Camp/boss | power levels gained | kit ilvl at start |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rogue | 40 | 0.0 % | 0.0 % | 57.5 % | 22.5 % | 20.0 % | 1.4 | 48.0 |
| mage | 40 | 0.0 % | 0.0 % | 57.5 % | 25.0 % | 17.5 % | 1.6 | 48.0 |
| hunter | 40 | 0.0 % | 0.0 % | 22.5 % | 25.0 % | 52.5 % | 2.8 | 48.0 |

Deaths in zones 2-4: 55 of 120 runs.

| class | zone 2 | zone 3 | zone 4 | total |
| --- | --- | --- | --- | --- |
| rogue | 17 | 2 | 4 | 23 |
| mage | 2 | 11 | 10 | 23 |
| hunter | 3 | 4 | 2 | 9 |

| node type | rogue | mage | hunter | total | ring 1 / 2 / 3 |
| --- | --- | --- | --- | --- | --- |
| dungeon | 6 | 0 | 0 | 6 | 0 / 6 / 0 |
| grind | 2 | 0 | 0 | 2 | 1 / 0 / 1 |
| quest | 15 | 23 | 9 | 47 | 30 / 10 / 7 |

Fights in zones 2-4 by node type (fights, deaths, death rate per fight; mean lowest HP % of won fights):

| node type | fights | deaths | rate | min HP won | mean enemy-over-hero gap | draughts at start |
| --- | --- | --- | --- | --- | --- | --- |
| dungeon | 118 | 6 | 5.1 % | 58.5 | 1.4 | 3.5 |
| elite | 6 | 0 | 0.0 % | 83.9 | 0.0 | 3.8 |
| grind | 250 | 2 | 0.8 % | 71.0 | 1.3 | 3.3 |
| quest | 907 | 47 | 5.2 % | 71.0 | 0.9 | 3.7 |
| treasure | 38 | 0 | 0.0 % | 93.7 | 1.2 | 3.3 |

Power gap (highest enemy level minus hero power level) in zones 2-4 non-boss fights:

| gap | fights | deaths | rate | share of deaths |
| --- | --- | --- | --- | --- |
| <= 0 | 460 | 12 | 2.6 % | 21.8 % |
| 1-2 | 686 | 37 | 5.4 % | 67.3 % |
| 3-4 | 171 | 6 | 3.5 % | 10.9 % |
| 5+ | 2 | 0 | 0.0 % | 0.0 % |

Healing draughts in the bag at the start of the fight (zones 2-4, non-boss):

| draughts | fights | deaths | rate |
| --- | --- | --- | --- |
| 0 | 14 | 0 | 0.0 % |
| 1-2 | 130 | 6 | 4.6 % |
| 3-4 | 1175 | 49 | 4.2 % |
| 5+ | 0 | 0 | n/a |

Fatal fights: mean draughts at start 3.7 (all fights 3.6), mean HP at start 90.2 % (all 94.3 %), mean gear ilvl 47.2 (all 47.1), mean gap 1.3 (all 1.0), mean enemies 2.9 (all 2.0).

Mean equipped item level minus hero power level at the fight start (zones 2-4, non-boss):

| ilvl - power | fights | deaths | rate |
| --- | --- | --- | --- |
| < -6 | 0 | 0 | n/a |
| -6..-3 | 155 | 7 | 4.5 % |
| -3..0 | 1002 | 41 | 4.1 % |
| >= 0 | 162 | 7 | 4.3 % |

Killer (name / ability) of the zone 2-4 deaths:

| killer | deaths |
| --- | --- |
| Wind Shaman / hex_bolt | 6 |
| Bog Witch / hex_bolt | 5 |
| Cairn Brute / strike | 4 |
| Cairn Brute / heavy_smash | 4 |
| Marsh Lurker / bite | 3 |
| Dust Jackal / bite | 3 |
| Sunscribe Adept / bolt | 3 |
| Weir Crawler / frenzy | 2 |

Enemy archetype share, fatal fights against all zone 2-4 fights:

| archetype | fatal fights | all fights |
| --- | --- | --- |
| beast | 21.7 % | 27.8 % |
| brute | 14.6 % | 12.6 % |
| caster | 42.0 % | 19.9 % |
| guardian | 3.8 % | 12.5 % |
| mender | 4.5 % | 9.8 % |
| skulker | 13.4 % | 17.4 % |

Zone arrival (mean over runs that arrive): hero power, gear ilvl, draughts, HP %:

| zone | arrivals | power | gear ilvl | draughts | HP % |
| --- | --- | --- | --- | --- | --- |
| 1 | 120 | 48.0 | 48.0 | 2.0 | 100.0 |
| 2 | 120 | 48.0 | 45.1 | 2.7 | 96.8 |
| 3 | 98 | 48.1 | 47.0 | 3.5 | 95.1 |
| 4 | 81 | 49.4 | 48.3 | 3.2 | 95.9 |
| 5 | 65 | 49.9 | 49.2 | 3.3 | 92.1 |
| 6 | 52 | 50.3 | 50.6 | 3.1 | 97.2 |



## 8. Planner: full tables

Outcome per run (deaths by where they happen):

| class | runs | win | die Z1 | die Z2-4 | die Z5-6 | die Camp/boss | power levels gained | kit ilvl at start |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rogue | 40 | 52.5 % | 0.0 % | 7.5 % | 5.0 % | 35.0 % | 2.5 | 48.0 |
| mage | 40 | 50.0 % | 0.0 % | 12.5 % | 2.5 % | 35.0 % | 3.0 | 48.0 |
| hunter | 40 | 35.0 % | 0.0 % | 2.5 % | 0.0 % | 62.5 % | 3.4 | 48.0 |

Deaths in zones 2-4: 9 of 120 runs.

| class | zone 2 | zone 3 | zone 4 | total |
| --- | --- | --- | --- | --- |
| rogue | 1 | 1 | 1 | 3 |
| mage | 3 | 1 | 1 | 5 |
| hunter | 0 | 0 | 1 | 1 |

| node type | rogue | mage | hunter | total | ring 1 / 2 / 3 |
| --- | --- | --- | --- | --- | --- |
| dungeon | 1 | 3 | 0 | 4 | 0 / 4 / 0 |
| elite | 1 | 0 | 1 | 2 | 0 / 0 / 2 |
| quest | 1 | 2 | 0 | 3 | 1 / 1 / 1 |

Fights in zones 2-4 by node type (fights, deaths, death rate per fight; mean lowest HP % of won fights):

| node type | fights | deaths | rate | min HP won | mean enemy-over-hero gap | draughts at start |
| --- | --- | --- | --- | --- | --- | --- |
| dim | 39 | 0 | 0.0 % | 68.6 | 1.4 | 4.5 |
| dungeon | 330 | 4 | 1.2 % | 60.9 | 2.1 | 4.6 |
| elite | 92 | 2 | 2.2 % | 67.9 | 1.7 | 4.7 |
| grind | 208 | 0 | 0.0 % | 78.1 | 1.5 | 4.7 |
| quest | 1020 | 3 | 0.3 % | 77.2 | 1.1 | 4.9 |
| treasure | 97 | 0 | 0.0 % | 87.3 | 1.0 | 4.8 |

Power gap (highest enemy level minus hero power level) in zones 2-4 non-boss fights:

| gap | fights | deaths | rate | share of deaths |
| --- | --- | --- | --- | --- |
| <= 0 | 490 | 1 | 0.2 % | 11.1 % |
| 1-2 | 910 | 6 | 0.7 % | 66.7 % |
| 3-4 | 363 | 2 | 0.6 % | 22.2 % |
| 5+ | 23 | 0 | 0.0 % | 0.0 % |

Healing draughts in the bag at the start of the fight (zones 2-4, non-boss):

| draughts | fights | deaths | rate |
| --- | --- | --- | --- |
| 0 | 0 | 0 | n/a |
| 1-2 | 33 | 0 | 0.0 % |
| 3-4 | 221 | 1 | 0.5 % |
| 5+ | 1532 | 8 | 0.5 % |

Fatal fights: mean draughts at start 4.9 (all fights 4.8), mean HP at start 91.6 % (all 91.0 %), mean gear ilvl 47.6 (all 47.6), mean gap 1.8 (all 1.3), mean enemies 2.6 (all 1.8).

Mean equipped item level minus hero power level at the fight start (zones 2-4, non-boss):

| ilvl - power | fights | deaths | rate |
| --- | --- | --- | --- |
| < -6 | 0 | 0 | n/a |
| -6..-3 | 155 | 0 | 0.0 % |
| -3..0 | 1285 | 8 | 0.6 % |
| >= 0 | 346 | 1 | 0.3 % |

Killer (name / ability) of the zone 2-4 deaths:

| killer | deaths |
| --- | --- |
| Sisel Mistweaver / bolt | 1 |
| Wind Shaman / bolt | 1 |
| Veth Acolyte / bolt | 1 |
| Sunscribe Adept / bolt | 1 |
| Crag Prowler / bite | 1 |
| Mire Brute / heavy_smash | 1 |
| Weir Crawler / frenzy | 1 |
| Mire Brute / strike | 1 |

Enemy archetype share, fatal fights against all zone 2-4 fights:

| archetype | fatal fights | all fights |
| --- | --- | --- |
| beast | 13.0 % | 25.2 % |
| brute | 8.7 % | 13.7 % |
| caster | 43.5 % | 20.8 % |
| guardian | 4.3 % | 13.4 % |
| mender | 8.7 % | 10.3 % |
| skulker | 21.7 % | 16.7 % |

Zone arrival (mean over runs that arrive): hero power, gear ilvl, draughts, HP %:

| zone | arrivals | power | gear ilvl | draughts | HP % |
| --- | --- | --- | --- | --- | --- |
| 1 | 120 | 48.0 | 48.0 | 0.0 | 100.0 |
| 2 | 120 | 48.0 | 45.2 | 2.7 | 96.2 |
| 3 | 116 | 48.3 | 47.1 | 4.5 | 87.7 |
| 4 | 114 | 49.6 | 48.8 | 4.6 | 87.8 |
| 5 | 111 | 50.0 | 50.1 | 4.6 | 90.0 |
| 6 | 109 | 50.1 | 51.4 | 4.8 | 92.6 |



## 9. Recommendation (no tuning done)

Treat this as an autoplay-policy finding: the zones at hero 20 are survivable by the sim planner (7.5 % of runs die in zones 2-4, 10.0 % in zones 1-6, 46 % win), so no zone, damage or XP number needs to move on this evidence, and the QA hand-off's hero-20 numbers measure the weakness of the engine's autoplay player, not the game. If the Lead wants autoplay (the engine's `R.autoAction` out of combat, which the QA player and a player who switches autoplay on and decides little else both stand for) to be a sensible-player proxy at hero 20, the engineer's list in order of effect is: (1) the map walk and the start camp, where the engine takes quests with no regard to how many enemies they hold (3-enemy fights carry 87 % of the zone 2-4 deaths and are 25 % of autoplay's fights there against 16 % of the planner's); gate on enemy count and caster share (the QA player's `nodeValue` already reads the node view's archetype list), not on the level gap (flat) and not on the quest type; (2) the talent trees (EA.AUTO_TREE 0 / 0 / 1 against the recorded defaults 2 / 1 / 2) and the bar order (the engine's seven-slot bar at hero 20 holds none of Cinder Storm, Glacier Spike, Open Vein); (3) the potion rule shared by both drivers: one draught at HP below 35 % with a 4-round cooldown leaves 2-4 draughts in the bag at nearly every death (not tested; it is common to both, so it does not explain the gap but it is the cheapest margin for both). Each of these is worth 4-12 points alone and they add up, so test them together: `node sim/legacy-h20deaths.mjs run --bot autoplay --hero 20 --out <dir>` then `... arms <dir> planner` takes about 40 seconds on two cores and prints the zone 2-4 and zone 1-6 death rates; a target of 10-15 % in zones 1-6 matches the planner. The quest gate of qa-2026-11-19c remains useful for the zone 6 quests at hero 1 and does not touch these deaths. For balance questions at hero 20 read the planner cells, not the QA player's.

## 10. Reproduce

- `node sim/legacy-h20deaths.mjs run --bot autoplay --hero 20 --runs 40 --seed-start 1 --out /tmp/h20/autoplay`; the same with `--bot planner`; ablations `--bot planner --abl talent|bar|node|hub|prep|map|vendor` (comma list), `--tree rogue:0,mage:0,hunter:1`, `--profile bought`, `--bot autoplay --abl talent`.
- `node sim/legacy-h20deaths.mjs tables <dir>` (sections 7-8), `arms <dir> <dir>...` (sections 2 and 4). A cell of 120 runs takes 5-25 s on two cores. Seeds 1-40, commit 0ebd513; the driver sets the three gates itself.
- New files: sim/legacy-h20deaths.mjs, sim/lib/h20tables.mjs (docs/ARCHITECTURE.md rows added).
