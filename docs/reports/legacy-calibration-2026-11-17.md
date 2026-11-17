# Legacy calibration 2026-11-17: band risk tables and the class spread on the 1-25 scale

Status: measurement, **draft** for the Lead and the Lead Game Designer (D155, Legacy phase 1, sim side; legacy.md 5.8 items 1-2, 6.6 reading 3). No rules constant, content value, balance.md constant or engine file was changed; src/ and game.html untouched. Every Legacy rule runs on a scratch copy of src/ (sim/legacy-patch.py), as the designer's measures of legacy.md 6 did.

**Verdict.**
1. **Band risk tables are warmed and committed** (sim/tables/legacy/risk-H01-05.json ... risk-H21-25.json). Read per band, the planner enters 0.03 / 1.07 / 0.27 / 0.74 / 0.20 dungeons and 1.5 / 3.7 / 3.6 / 2.9 / 0.6 elites a run in bands 1-5 / 6-10 / 11-15 / 16-20 / 21-25, against 0 dungeons and 0.2-0.45 elites on today's X0 tables and 0.8-1.1 dungeons with 42 % zone deaths at H15 on the designer's single H10 table. Dungeons stay shut where they kill (band 1: 58 % of warm-up dungeon entries died) and open where they pay (band 2: 4.8 %). Band 21-25 is not a fair reading yet: once the in-run level reaches 60 the planner rushes (5.8 item 3, VAL_HERO_XP, not built).
2. **B6 fails in every band** on the legacy.md scaling (arm T2): win Rogue / Mage / Hunter 8.5 / 4.0 / 16.5 % (H1-5), **89.0 / 13.5 / 27.0 %** (H6-10), 77.0 / 14.5 / 1.0 % (H11-15), 38.0 / 41.5 / 11.0 % (H16-20), 12.5 / 14.0 / 3.5 % (H21-25); spreads 12.5, 75.5, 76.0, 30.5, 10.5 pp (band: 8).
3. **Why.** The spread is Oruvath's fight, not the zones (reach per class 74.5-95.5 % in every band; in band 6-10 Rogue 90.5, Mage 74.5, Hunter 91.0 %, against wins 89.0 / 13.5 / 27.0 %). Below about hero level 16 the Oruvath HP factor and the quadratic damage scale make his fight a **damage race against Final Dark** (round 57): 62-99 % of the Mage's and Hunter's boss losses in bands 1-3 are Final Dark, the Rogue never reaches it. In a damage race the win rate swings from 0 to 90 % on about 20-40 % of boss damage (bench: Hunter +20 % boss damage lifts H11-15 from 0 to 19 %, +40 % to 74 %). Who wins the race at each level is set by **when each class gets its Shard answer and its burst on the compressed scale, and by the Rogue's Venomcraft tier 1**: Whirling Edges (power 20, hero 9; reached in-run from hero 6) carries Toxic Coating to every Shard and lifts the Rogue's boss win from about 6 % to 90-97 % in one level; with the other two Rogue trees the same Rogue wins 0 % up to hero 12. The Mage's jump is Pyre Comet (power 38, hero 16: boss win 5 → 60 %). The Hunter has no such jump before hero 20 and collapses from hero 9 to 15 with any spell timing, any tree, the full kit, and any Oruvath HP or damage factor tried. Gear is not the cause (every class has the same item level; the Rogue still wins 40 % with uncommon gear, the others 0 %). The zone multipliers are not the cause of the H10 spread: they cost the Mage some reach (74.5 % in band 6-10) but the gap is in the boss fights won (Rogue 98 %, Mage 18 %, Hunter 30 % of those reached).
4. **Proposal (section 5).** No learn-level remap (full runs) and no Oruvath HP or damage factor (boss bench) alone brings the three classes inside B6 in any band (section 4). The smallest measured change that does it in bands 3-5 is **three learn levels plus one Hunter number**: Whirling Edges to hero level 16 (power 38), Pyre Comet to 13 (power 31), Heartseeker Shot to 13 (power 31), and about +12 % Hunter damage in Oruvath's fight from about hero level 9 (arm F3: band 3 29.0 / 39.0 / 33.5 %, 2 pp outside; band 4 38.0 / 41.5 / 46.0 %, pass; band 5 pass, low reading). Learn levels alone (F1: Whirling Edges to 15, Heartseeker to 13) remove the band 2 outlier (spread 75.5 → 29.5 pp) but pass nowhere. Bands 1-2 (hero levels 1-10) stay outside B6 with every arm: there each class's win is a step at its Shard answer, and no learn level puts the Rogue between 0 and 90 %. The Hunter number is class numbers, the designer's call.

## Set-up

- **Engine:** origin/main 5c8dfef (D155), src/ untouched. Scratch copy built by `node sim/legacy-run.mjs build --scratch <dir>` (copies src/ and sim/, applies sim/legacy-patch.py). The patch is the designer's patch of legacy.md 6.1 (his `sim/out/design-legacy/patch.py`, applied unchanged; it applies cleanly to 5c8dfef) plus three environment fields for this report's arms: `learn` (per-spell learn levels), `bdmg` (Oruvath's damage by hero level) and `pdmg` (a class's damage in Oruvath's fight, sensitivity arms only). Without them the scratch engine plays the designer's T2 arm exactly.
- **Legacy scaling (arm T2, legacy.md 2.2, 2.4, 10):** run start at power level `round(1 + (H - 1) × 59 / 24)`, the Wayfarer's kit (common, every slot), every class spell up to the level trained to it, the default tree's points, gold 3 V; ZONE_TIER -2 .. +3; ZONE_TIER_DMG 1.25 .. 1.50 (the Camp zone 6's); rings [0, 0, 1, 2] spread 2; dungeons +2; contracts band + 2; CL up to 66; Oruvath at the hero's power level + 5, scaled by the enemy curve, HP × `min(1, 0.40 + 0.024 H)`; a level costs 10 × xpToNext (the designer's stand-in); no zone exit level; no Camp waves.
- **Map and cells (D118):** the expedition map with the start camp, `--map expedition --prep`. Bot: planner (PLANNER_TIME_MULT 3, autoplay combat, balance.md 1), the P0-group default trees (Rogue Venomcraft, Mage Rimecraft, Hunter Wildcraft), Hunter pet ridgewolf. Profile `later`: two runs played, nothing bought (contracts on). `--warmup 0`, each cell reads its band's table with `--risk-in`.
- **Runs per cell:** warm-up: 30 runs per class at every hero level of the band, two rounds, chained (each cell starts from the previous cell's observations, the first from RISK_PRIOR): 300 runs per class per band, seeds 9 000 000 + 100 000 × round + 1 000 × H; 4 500 runs. Grids: 40 runs per class at every hero level 1-25 (seeds 1000-1039), **200 runs per class per band**, 3 000 runs a grid; four grids (base, F1, F2, F3): 12 000 runs. Per band and class the 95 % interval is about ±6 pp at 30 %; per hero level and class about ±14 pp.
- **Boss bench** (`sim/legacy-boss.mjs`, diagnosis only): Oruvath's fight alone, built with `debug.build` at power level P(H) + 5 or + 7 (the planner gains 5-8 power levels in a run, measured), rare gear at item level + 1 in every slot (the measured gear at Oruvath, legacy.md 6.3), the default tree's standard build, the planner's Camp bars, 5 Healing Draughts and one Ember of Return, autoplay; 60-150 seeds per class and level. It tracks the full runs where it was checked (hero level 10: bench 89 / 14 / 2 % of fights won; full runs 32 / 32, 1 / 22 and 1 / 31 boss fights won by Rogue / Mage / Hunter) but carries no tonics or flasks, so it under-reads the Hunter late.
- **Commands:**
  - `node sim/legacy-run.mjs warm --scratch S --band 6-10 --runs 30 --rounds 2 --out O --table sim/tables/legacy/risk-H06-10.json` (one per band)
  - `node sim/legacy-run.mjs grid --scratch S --levels 1-25 --tables sim/tables/legacy --runs 40 --out O [--leg '<json>']`
  - `node sim/legacyreport.mjs O --levels`; `node sim/legacyreport.mjs --tables sim/tables/legacy`
  - `LEG='<json>' node sim/legacy-boss.mjs --hero 1-25 --gain 7 --seeds 60 [--tree N] [--ilvl-off N --rarity R]` (from the scratch copy)
- **Definitions:** win, reach and zone deaths as balance.md and legacy.md 6.1; B6 on point estimates (balance.md 2): every class within CLASS_BAND_PP (5 pp) of the 3-class mean and max - min <= CLASS_SPREAD_MAX_PP (8 pp). Entries are node entries a run (record `nt`); deaths in dungeons or elites are runs that ended there.

## 1. Risk tables per hero-level band

What the warm-up saw (the band tables' own observations, three classes, 300 warm-up runs per class):

| Band | dungeon: entries / deaths | elite: entries / deaths | elite with add | three-enemy quest |
|---|---|---|---|---|
| 1-5 | 67 / 39 (58.2 %) | 1004 / 35 (3.5 %) | 354 / 25 (7.1 %) | 2900 / 40 (1.4 %) |
| 6-10 | 1060 / 51 (4.8 %) | 2323 / 29 (1.2 %) | 993 / 31 (3.1 %) | 3211 / 71 (2.2 %) |
| 11-15 | 359 / 38 (10.6 %) | 2539 / 58 (2.3 %) | 600 / 27 (4.5 %) | 1617 / 80 (4.9 %) |
| 16-20 | 625 / 45 (7.2 %) | 2394 / 34 (1.4 %) | 303 / 13 (4.3 %) | 1112 / 66 (5.9 %) |
| 21-25 | 162 / 8 (4.9 %) | 471 / 9 (1.9 %) | 152 / 12 (7.9 %) | 449 / 28 (6.2 %) |

The planner read with each band's table (grid "base"):

| Band | Dungeons / elites entered a run | Deaths in dungeons / elites (% of runs) | Died in zones | Reach Oruvath | Minutes |
|---|---|---|---|---|---|
| 1-5 | 0.03 / 1.54 | 1.2 / 6.5 | 16.7 % | 83.3 % | 37.3 |
| 6-10 | 1.07 / 3.67 | 1.2 / 6.5 | 14.7 % | 85.3 % | 41.7 |
| 11-15 | 0.27 / 3.57 | 0.8 / 6.7 | 17.5 % | 82.5 % | 38.2 |
| 16-20 | 0.74 / 2.94 | 2.3 / 4.8 | 14.3 % | 85.7 % | 37.8 |
| 21-25 | 0.20 / 0.57 | 0.7 / 1.2 | 5.2 % | 94.8 % | 22.8 |

Against the other tables (designer cells of legacy.md 6.3, the same T2 arm, 100 runs per class, main 19719ed):

| Table | H2 | H5 | H10 | H15 | H20 |
|---|---|---|---|---|---|
| X0 (today's tables): dungeons / elites a run | 0 / 0.18 | 0 / 0.29 | 0 / 0.28 | 0 / 0.40 | 0 / 0.45 |
| The designer's H10 table at every level: dungeons / elites; died in zones | - | 1.09 / 3.56; 8.0 % | 1.04 / 3.37; 14.3 % | 0.87 / 3.55; **42.3 %** | 0.80 / 2.92; 19.7 % |
| **Band tables** (this report, per level): dungeons / elites; died in zones | 0.06 / 1.43; 20.0 % | 0.02 / 1.91; 4.2 % | 1.07 / 3.63; 29.2 % | 0.25 / 3.54; 21.7 % | 0.66 / 2.57; 3.3 % |

Readings:
- The band tables do what 5.8 item 2 asks: each band keeps the planner out of the fights its heroes do not survive and lets it in where they do. Band 1-5 learned that a dungeon kills a young hero (58 %), so it takes almost none, but takes 1.5 elites a run; band 6-10 clears about one dungeon and 3.7 elites a run at 1.2 % dungeon deaths; band 11-15 closes dungeons again (10.6 % deaths in the warm-up) and keeps the elites; band 16-20 reopens them. Today's game (P0, X0 tables) enters 0.4-0.55 dungeons and 1.7-2.0 elites a run (legacy.md 5.8): the band tables sit at or above that from hero level 6 [inference: a good player takes the content the hero can clear; the planner now does where the measured risk allows].
- Zone deaths rise within bands 2 and 3 (H6 6.7 % to H10 29.2 %; H11 9.2 % to H14 27.5 %; per-level table in the appendix): most are quests in zones 5-6 (H10: 10 of 35 deaths a quest in zone 6), the T2 tier damage at power 28-40, not dungeon or elite entries (1-2 % of runs). This is L4's rise and the designer's second phase 1 tuning item, not a table effect.
- H1 dies in zones in 40.8 % of the `later` profile's runs (quests in zones 4-6 at power 1-9); the designer measured 24 % on a fresh profile's first run with the X0 tables. Worth a look with the guided zone at its new levels (5.1); a per-level table for H1 alone is the sim's next lever if the Lead wants it.
- Band 21-25 is not read: from H23 the in-run level reaches 60 inside the run, hero XP has no value to the planner, and it rushes (22.8 minutes, 0.3 elites a run at H23-25). That needs VAL_HERO_XP (5.8 item 3), which is outside this task. Its table is committed but is the weakest of the five.

## 2. Class spread on the 1-25 scale (base, no change)

| Hero levels | Win: Rogue / Mage / Hunter (pooled) | Wins / boss fights: R / M / H | Reach | Power level at Oruvath | B6 spread |
|---|---|---|---|---|---|
| 1-5 | 8.5 / 4.0 / 16.5 (9.7) | 10.4 / 4.8 / 19.5 | 83.3 % | 13.7 | 12.5 pp, fail |
| 6-10 | **89.0 / 13.5 / 27.0** (43.2) | 98.3 / 18.1 / 29.7 | 85.3 % | 25.7 | 75.5 pp, fail |
| 11-15 | 77.0 / 14.5 / 1.0 (30.8) | 87.5 / 19.1 / 1.2 | 82.5 % | 36.8 | 76.0 pp, fail |
| 16-20 | 38.0 / 41.5 / 11.0 (30.2) | 43.7 / 47.4 / 13.3 | 85.7 % | 49.2 | 30.5 pp, fail |
| 21-25 | 12.5 / 14.0 / 3.5 (10.0) | 13.4 / 14.7 / 3.7 | 94.8 % | 57.0 | 10.5 pp, fail (planner rushes, section 1) |

Per hero level (Rogue / Mage / Hunter win %): H5 0 / 0 / 20; **H6 97.5 / 10 / 32.5**; H8 87.5 / 17.5 / 42.5; H10 80 / 2.5 / 2.5; H12 87.5 / 2.5 / 0; H14 72.5 / 27.5 / 0; H16 52.5 / 52.5 / 5; H18 22.5 / 35 / 15; H20 32.5 / 37.5 / 5 (full table in the appendix). The designer's H10 cell (X0 tables, 89 / 20 / 9 %) is reproduced in kind: the Rogue wins, the Mage and the Hunter run into Final Dark.

How the boss fights end (base, runs that reached Oruvath and lost):

| Band | Rogue: losses, Final Dark share, median rounds of wins | Mage | Hunter |
|---|---|---|---|
| 1-5 | 147, 97 %, 44 | 159, 99 %, 49 | 136, 66 %, 53 |
| 6-10 | 3, -, **35** | 122, **75 %**, 56 | 128, **92 %**, 52 |
| 11-15 | 22, 0 %, 35 | 123, 62 %, 46 | 165, 88 %, 50 |
| 16-20 | 98, 0 %, 36 | 92, 4 %, 41 | 143, 56 %, 49 |
| 21-25 | 162, 0 %, 37 | 163, 1 %, 40 | 184, 19 %, 51 |

## 3. Diagnosis: why Rogue 89 %, Mage 20 %, Hunter 9 % at hero level 10

The three candidate causes the Lead named, each tested.

**(a) The multipliers make the middle of the climb a damage race.** At hero level 10 (power about 31 at Oruvath, so Oruvath at about 36) his HP is about 0.41 of today's (the enemy curve 0.59 × the HP factor 0.69) and his damage about 0.35 of today's (zone danger is quadratic in level: × 0.27 at level 31, × 1.10 at 65), while the hero's HP and damage are about 0.55 of a level-60 hero's. Against today's fight the hero needs about 0.75 of the time to kill him and he needs about 1.6 times as long to kill the hero. So below about hero level 16 the hero rarely dies; the fight is won or lost on the clock: Final Dark at round 57 (section 2: 62-99 % of the Mage's and Hunter's boss losses in bands 1-3). From band 4 the fight is a survival fight, as today's level-60 fight is (losses are deaths, under 5 % Final Dark for the Rogue and the Mage). In a race, small damage gaps become large win gaps. Bench, Oruvath alone, per hero level band:

| Arm (bench, 60 seeds a level) | Hunter bands 1 / 2 / 3 / 4 / 5 | Mage bands 1-5 |
|---|---|---|
| Base | 16 / 28 / 0 / 9 / 3 | 6 / 12 / 29 / 53 / 36 |
| Class's damage in Oruvath's fight × 1.2 | 39 / 88 / 19 / 41 / 19 | 51 / 61 / 64 / 82 / 62 |
| × 1.4 | 73 / 98 / 74 / 80 / 57 | 75 / 82 / 96 / 98 / 79 |

The Oruvath multipliers act on every class at once, so they move the level of the curve, not the spread (arms `b`: HP factor × (1 - b (25 - H) / 24); `a`: damage × (1 + a (25 - H) / 24); bench, gain 5):

| Arm | Rogue bands 1-5 | Mage | Hunter |
|---|---|---|---|
| Base | 9 / 75 / 89 / 59 / 21 | 6 / 12 / 29 / 53 / 36 | 16 / 28 / 0 / 9 / 3 |
| b 0.3 (less HP early) | 43 / 89 / 96 / 73 / 14 | 69 / 70 / 55 / 68 / 36 | 68 / 91 / 9 / 16 / 4 |
| a 1, b 0.3 (less HP, more damage early) | 10 / 63 / 73 / 37 / 11 | 13 / 5 / 11 / 30 / 27 | 13 / 2 / 0 / 2 / 3 |
| a 1 (more damage early) | 0 / 29 / 50 / 28 / 10 | 0 / 0 / 3 / 17 / 26 | 0 / 0 / 0 / 1 / 3 |

Every multiplier arm leaves the Hunter at 0-16 % in bands 3-5 while it moves the Rogue and the Mage by 20-60 pp. A smaller HP factor early (b 0.35) brings bands 1-2 together but at 64-99 % wins for everyone at hero levels 1-10, against WR_FIRST_RUN_MAX 5 % and the "first runs very hard" target [stated, legacy.md 2.4].

**(b) Spell learn levels on the compressed scale decide who wins the race at each level.** One spell changes a class's boss win by 50-90 pp (bench, Oruvath alone):
- Rogue, **Whirling Edges** (power 20, hero 9): boss win 6 % at H6 (power 18 at Oruvath) → 97 % at H7 (power 21). In full runs the jump is at H6 (5 → 97.5 %), because the hero gains 7-8 power levels in a run and learns it at a trainer. It is an AoE builder; with Venomcraft's tier 1 **Toxic Coating** (poison on Gutting Jab, Shadowstep Strike and Whirling Edges) every hit puts poison on Oruvath and all his Shards. With Bladework or Shadowcraft the same Rogue wins **0 % up to hero level 12** and 0-36 % after (bench), so the Rogue's lead is Whirling Edges plus Venomcraft, not the class as such. (B7 fails as badly as B6 at these levels: Venomcraft 89 %, the other two trees 0 %.)
- Mage, **Pyre Comet** (power 38, hero 16): boss win 5 % at H13 → 60 % at H14 (bench); in runs H13 5 % → H16 52.5 %. Spellsnap (hero 6) costs the Mage 20-30 pp at hero levels 8-12 (an interrupt on the Camp bar that pushes a damage spell off) and is needed from hero 16.
- Hunter: **Snare Trap** (hero 6) costs 20-60 pp at hero levels 5-9 while it sits on the Camp bar (autoplay throws it at Oruvath while the Shards are up); Volley Rain (hero 10) pushes it off. Feign Stillness (hero 12) takes the cleanse slot of the Camp bar and pushes Mend Companion off; the pet then dies in phase 2. **Heartseeker Shot** (hero 20) moved to hero 9 lifts hero levels 6-10 to 60-85 % but not 11-15.
- Full kit at every level (every class spell learned from hero level 1): Rogue and Mage 88-100 % up to hero 12, Hunter 95-100 % to hero 6, then 69 → 1 % from hero 8 to 15, 40 % at 16. So in bands 1-2 the kit is the whole story; in band 3 the Hunter's gap is not a kit gap.

**(c) Gear is not the cause.** Every class has the same item level at Oruvath (power + 1, 73 % rare or better; legacy.md 6.3). At hero level 10 (bench, power 28): uncommon gear 40 / 0 / 0 %, rare 88 / 16 / 3 %, epic 98 / 33 / 22 %; item level - 5 rare 44 / 0 / 0 %, + 6 rare 97 / 52 / 46 %. Gear moves all three; the Rogue leads at every gear level.

**(d) The Hunter from hero level 9 to 17.** In every arm above the Hunter's Oruvath win stays at 0-30 % from about hero level 9 (power about 28 at the boss) to 17, with any learn level, the full kit, any of its three trees (Beastbond 0-35 %, Marksmanship 0-2 %), Mend Companion kept on the bar, any HP or damage factor. A traced fight at power 33: the Hunter spends phase 2 (rounds 12-57) on Shards and Barbed Arrow ticks; Oruvath goes from 69 % to 44 % HP in 45 rounds, and Final Dark ends it. In band 4 it reaches its Wildcraft capstone (Deadfall Trap) and climbs to 15-20 %. This is a class-numbers gap in Oruvath's fight, about 25-40 % of boss damage (the × 1.2 / × 1.4 arms above), or a survival gap in band 5.

Summary of the cause at hero level 10: the HP factor and the damage scale make the middle-level Oruvath a 57-round damage race; the Rogue's Venomcraft has its Shard answer (Whirling Edges) from hero level 9 and wins it in 35 rounds; the Mage's burst (Pyre Comet) comes at 16 and its Shard answer (Cinder Storm, hero 10) is weaker; the Hunter has no burst until 20 and loses about a quarter to a third of the damage it would need from hero level 9 on.

## 4. Fix arms on full runs

| Arm | Change (power level = learn level; hero level in brackets) |
|---|---|
| F1 | Whirling Edges 20 → 35 (hero 9 → 15); Heartseeker Shot 46 → 31 (hero 20 → 13) |
| F2 | F1 + the Hunter's and its pet's damage in Oruvath's fight × 1.3 (sensitivity, not a proposal of a mechanic) |
| F3 | Whirling Edges 20 → 38 (hero 16); Pyre Comet 38 → 31 (hero 16 → 13); Heartseeker Shot 46 → 31 (hero 13); Hunter × 1.3 in Oruvath's fight |

Bench search behind F1 and F3 (gain 7, 60 seeds a level; bands 1-5): Rogue Whirling Edges at power 20 / 31 / 36 / 41: band 2 87 / 1 / 1 / 1 %, band 3 80 / 80 / 51 / 16 %; Mage Pyre Comet at 38 / 31 / 26: band 2 12 / 12 / 39 %, band 3 41 / 71 / 71 %; Hunter Heartseeker Shot at 46 / 31 / 21: band 2 22 / 22 / 48 %, band 3 0 / 10 / 10 %, band 4 8 / 13 / 13 %.

Full runs, 200 runs per class per band (win Rogue / Mage / Hunter, pooled; B6 spread):

| Band | Base | F1 | F2 | F3 |
|---|---|---|---|---|
| 1-5 | 8.5 / 4.0 / 16.5 (9.7); 12.5 pp | 8.0 / 4.0 / 16.5 (9.5); 12.5 pp | 8.0 / 4.0 / 68.0 (26.7); 64.0 pp | 8.0 / 4.0 / 40.5 (17.5); 36.5 pp |
| 6-10 | 89.0 / 13.5 / 27.0 (43.2); 75.5 pp | 0.5 / 13.5 / 30.0 (14.7); **29.5 pp** | 0.5 / 13.5 / 78.5 (30.8); 78.0 pp | 0.5 / 13.5 / 52.5 (22.2); 52.0 pp |
| 11-15 | 77.0 / 14.5 / 1.0 (30.8); 76.0 pp | 51.0 / 14.5 / 11.0 (25.5); 40.0 pp | 51.0 / 14.5 / 68.5 (44.7); 54.0 pp | **29.0 / 39.0 / 33.5 (33.8); 10.0 pp** (fails by 2) |
| 16-20 | 38.0 / 41.5 / 11.0 (30.2); 30.5 pp | 38.0 / 41.5 / 17.0 (32.2); 24.5 pp | 38.0 / 41.5 / 71.0 (50.2); 33.0 pp | **38.0 / 41.5 / 46.0 (41.8); 8.0 pp, pass** |
| 21-25 (low reading) | 12.5 / 14.0 / 3.5 (10.0); 10.5 pp | 12.5 / 14.0 / 3.5 (10.0); 10.5 pp | 12.5 / 14.0 / 36.0 (20.8); 23.5 pp | **12.5 / 14.0 / 12.0 (12.8); 2.0 pp, pass** |

F3's Hunter factor is × 1.12 (not F2's 1.3): the full runs answer more steeply than the bench (F2's × 1.3 took the Hunter from 1 % to 68.5 % in band 3), so F3 was run at the interpolated × 1.12. Dungeon and elite entries move by at most 0.04 a run and reach by at most 3.3 pp (band 16-20: 85.7 → 89.0 % with F1-F3; Whirling Edges and Heartseeker Shot also fight in the zones): the arms act mainly on Oruvath's fight.

Readings:
- **F1 (learn levels only)** removes the band 2 outlier: the Rogue's 89 % becomes 0.5 %, because without Whirling Edges the Rogue has no Shard answer (it learns it in a run from hero level 12, where it wins 60-68 %). The Hunter gains 3-10 pp in bands 2-4 from Heartseeker Shot at 13. Spreads fall in bands 2-4 (75.5 → 29.5, 76.0 → 40.0, 30.5 → 24.5 pp), all still fail.
- **F2** sizes the Hunter's gap: × 1.3 overshoots in every band (68-79 % in bands 1-4).
- **F3 (three learn levels and the Hunter × 1.12)** passes B6 in band 4 (38.0 / 41.5 / 46.0) and band 5 (low reading), misses band 3 by 2 pp (29.0 / 39.0 / 33.5; inside the noise of 200 runs per class), and fails bands 1-2 because a flat Hunter factor also lifts its early levels (band 1: 16.5 → 40.5 %), and the Rogue without Whirling Edges wins nothing in band 2.
- **Bands 1-2 have no fix inside the two levers.** At hero levels 1-12 each class's Oruvath win is a step at the level where it gets its Shard answer: the Rogue 0-5 % without Whirling Edges, 90-97 % with it; no learn level puts the Rogue between. A smaller HP factor early lifts every class together (bench arm b 0.35: 64-99 % in bands 1-2), against WR_FIRST_RUN_MAX 5 % and the "first runs very hard" target.
- The pooled win rate per band moves with the arms (base 9.7 / 43.2 / 30.8 / 30.2 %, F3 17.5 / 22.2 / 33.8 / 41.8 %): F3 rises from band 2 to band 4, which L3's "non-decreasing from H5 to H25" wants, and the base does not.

## 5. Proposal (draft, for the designer)

The smallest change measured that brings the classes inside B6 where it can be reached (bands 3-5), in this order:

1. **Learn levels (legacy.md 1.7, SPELL.id.heroLvl), three spells:**

| Spell | Today's power level (hero level) | Proposed power level (hero level) | Measured effect |
|---|---|---|---|
| Whirling Edges (Rogue) | 20 (9) | **38 (16)** | removes the Rogue's band 2-3 lead (89 → 0.5 % in band 2, 77 → 29 % in band 3); learned in a run from about hero level 13 |
| Pyre Comet (Mage) | 38 (16) | **31 (13)** | Mage band 3 14.5 → 39.0 % |
| Heartseeker Shot (Hunter) | 46 (20) | **31 (13)** | Hunter bands 2-4 +3 to +6 pp (F1) |

2. **A Hunter number in Oruvath's fight from about hero level 9** worth about **+12 % of its and its pet's damage there** (F3 measured a flat × 1.12 in the boss fight only, as a stand-in: bands 3-5 then sit inside or 2 pp outside B6). Class numbers are the designer's call (balance.md 2: beyond TUNE_LIMIT and a new rule); candidates the bench points at: the Hunter's phase 2 against the Shards (Volley Rain or Barbed Arrow on adds), Mend Companion's place on the Camp bar, the pet's damage. A flat buff over all levels is wrong: it also lifts the Hunter at hero levels 1-8 (band 1: 16.5 → 40.5 %).
3. **Bands 1-2 (hero levels 1-10) stay outside B6** with any learn level or Oruvath multiplier measured. Two ways forward, for the designer: (a) accept a wider class band below hero level 11 while the first win is rare there (pooled 9.5-22 % with F3), reporting it as balance.md does H1 ("B6 at H10 and H25", 5.7); or (b) change the Rogue's early Oruvath answer (Toxic Coating's spread through Whirling Edges), which is class numbers again. The spec's phase 1 done-when ("B6 at H10 within its band, learn levels first", 7.1) cannot be met by learn levels; H10 with F3 reads 0.0 / 5.0 / 22.5 % (40 runs a class).

Not proposed: Snare Trap or Feign Stillness moves (they act through the planner's Camp bar template, a sim policy, not the game: Snare Trap costs the Hunter 20-60 pp at hero levels 5-9 while on that bar), and any change to ZONE_TIER_DMG (the H10 spread is in the boss fights won, not in reach).

## 6. Limits

- 40 runs per class and hero level: per-level rates carry ±14 pp; bands (200 per class) ±6 pp. B6's spread band (8 pp) is close to the noise of three band estimates; a pass needs about 600 runs per class per band.
- Band 21-25: the planner rushes once in-run levels end (VAL_HERO_XP, 5.8 item 3, not built), so its win rates and entry rates are low readings.
- The in-run level cost is the designer's stand-in (10 × xpToNext); the hero gains 5-8 power levels a run, so a spell is met in a run 2-3 hero levels before its learn level.
- The boss bench has no tonics, flasks, boons or Elixir; it reads the Hunter low at high levels (H25: bench 3 %, runs 16 % at H20 in the designer's cell).
- One seed range, one profile (`later`, nothing bought); no Legacy hall, trees or sets (phase 2-5); default trees of today's P0 group. The tree choice per hero cell (balance.md 1.3 switch rule) was not re-run; B7 at H10 fails as badly as B6 (Rogue 89 / 0 / 0 % by tree, bench).

## Appendix: per hero level (base)

| Hero level | Power at start / at Oruvath | Base: R / M / H | F1 | F2 | F3 | Reach (base) | Dungeons / elites a run (base) | Died in zones (base) |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 / 9.5 | 0.0 / 0.0 / 2.5 | 0.0 / 0.0 / 2.5 | 0.0 / 0.0 / 27.5 | 0.0 / 0.0 / 5.0 | 59.2 | 0.03 / 0.88 | 40.8 |
| 2 | 3 / 10.5 | 0.0 / 7.5 / 7.5 | 0.0 / 7.5 / 7.5 | 0.0 / 7.5 / 37.5 | 0.0 / 7.5 / 15.0 | 80.0 | 0.06 / 1.43 | 20.0 |
| 3 | 6 / 13.2 | 17.5 / 7.5 / 35.0 | 17.5 / 7.5 / 35.0 | 17.5 / 7.5 / 87.5 | 17.5 / 7.5 / 80.0 | 87.5 | 0.02 / 1.72 | 12.5 |
| 4 | 8 / 15.2 | 25.0 / 5.0 / 17.5 | 22.5 / 5.0 / 17.5 | 22.5 / 5.0 / 90.0 | 22.5 / 5.0 / 57.5 | 94.2 | 0.03 / 1.77 | 5.8 |
| 5 | 11 / 17.9 | 0.0 / 0.0 / 20.0 | 0.0 / 0.0 / 20.0 | 0.0 / 0.0 / 97.5 | 0.0 / 0.0 / 45.0 | 95.8 | 0.02 / 1.91 | 4.2 |
| 6 | 13 / 21.2 | 97.5 / 10.0 / 32.5 | 2.5 / 10.0 / 32.5 | 2.5 / 10.0 / 92.5 | 2.5 / 10.0 / 60.0 | 93.3 | 1.15 / 3.75 | 6.7 |
| 7 | 16 / 23.9 | 95.0 / 27.5 / 57.5 | 0.0 / 27.5 / 55.0 | 0.0 / 27.5 / 95.0 | 0.0 / 27.5 / 87.5 | 95.0 | 1.07 / 3.83 | 5.0 |
| 8 | 18 / 25.9 | 87.5 / 17.5 / 42.5 | 0.0 / 17.5 / 45.0 | 0.0 / 17.5 / 87.5 | 0.0 / 17.5 / 67.5 | 90.0 | 1.06 / 3.63 | 10.0 |
| 9 | 21 / 28.7 | 85.0 / 10.0 / 0.0 | 0.0 / 10.0 / 0.0 | 0.0 / 10.0 / 57.5 | 0.0 / 7.5 / 25.0 | 77.5 | 1.03 / 3.53 | 22.5 |
| 10 | 23 / 30.6 | 80.0 / 2.5 / 2.5 | 0.0 / 2.5 / 17.5 | 0.0 / 2.5 / 60.0 | 0.0 / 5.0 / 22.5 | 70.8 | 1.07 / 3.63 | 29.2 |
| 11 | 26 / 32.6 | 90.0 / 2.5 / 5.0 | 5.0 / 2.5 / 30.0 | 5.0 / 2.5 / 82.5 | 0.0 / 45.0 / 57.5 | 90.8 | 0.25 / 3.63 | 9.2 |
| 12 | 28 / 34.5 | 87.5 / 2.5 / 0.0 | 62.5 / 2.5 / 2.5 | 62.5 / 2.5 / 70.0 | 0.0 / 50.0 / 37.5 | 85.8 | 0.29 / 3.56 | 14.2 |
| 13 | 31 / 37.5 | 67.5 / 5.0 / 0.0 | 60.0 / 5.0 / 5.0 | 60.0 / 5.0 / 75.0 | 57.5 / 30.0 / 35.0 | 85.0 | 0.28 / 3.62 | 15.0 |
| 14 | 33 / 39.5 | 72.5 / 27.5 / 0.0 | 60.0 / 27.5 / 2.5 | 60.0 / 27.5 / 52.5 | 42.5 / 32.5 / 12.5 | 72.5 | 0.27 / 3.51 | 27.5 |
| 15 | 35 / 41.3 | 67.5 / 35.0 / 0.0 | 67.5 / 35.0 / 15.0 | 67.5 / 35.0 / 62.5 | 45.0 / 37.5 / 25.0 | 78.3 | 0.25 / 3.54 | 21.7 |
| 16 | 38 / 44.6 | 52.5 / 52.5 / 5.0 | 52.5 / 52.5 / 32.5 | 52.5 / 52.5 / 80.0 | 52.5 / 52.5 / 62.5 | 78.3 | 0.86 / 3.02 | 21.7 |
| 17 | 40 / 46.5 | 50.0 / 42.5 / 20.0 | 50.0 / 42.5 / 27.5 | 50.0 / 42.5 / 67.5 | 50.0 / 42.5 / 47.5 | 76.7 | 0.72 / 3.05 | 23.3 |
| 18 | 43 / 49.5 | 22.5 / 35.0 / 15.0 | 22.5 / 35.0 / 15.0 | 22.5 / 35.0 / 70.0 | 22.5 / 35.0 / 50.0 | 90.0 | 0.75 / 3.10 | 10.0 |
| 19 | 45 / 51.4 | 32.5 / 40.0 / 10.0 | 32.5 / 40.0 / 5.0 | 32.5 / 40.0 / 57.5 | 32.5 / 40.0 / 32.5 | 86.7 | 0.74 / 2.97 | 13.3 |
| 20 | 48 / 52.7 | 32.5 / 37.5 / 5.0 | 32.5 / 37.5 / 5.0 | 32.5 / 37.5 / 80.0 | 32.5 / 37.5 / 37.5 | 96.7 | 0.66 / 2.57 | 3.3 |
| 21 | 50 / 53.5 | 25.0 / 27.5 / 10.0 | 25.0 / 27.5 / 10.0 | 25.0 / 27.5 / 65.0 | 25.0 / 27.5 / 35.0 | 86.7 | 0.50 / 1.63 | 13.3 |
| 22 | 53 / 55.3 | 27.5 / 25.0 / 7.5 | 27.5 / 25.0 / 7.5 | 27.5 / 25.0 / 47.5 | 27.5 / 25.0 / 12.5 | 94.2 | 0.23 / 0.63 | 5.8 |
| 23 | 55 / 56.9 | 10.0 / 15.0 / 0.0 | 10.0 / 15.0 / 0.0 | 10.0 / 15.0 / 45.0 | 10.0 / 15.0 / 10.0 | 95.8 | 0.24 / 0.32 | 4.2 |
| 24 | 58 / 58.8 | 0.0 / 2.5 / 0.0 | 0.0 / 2.5 / 0.0 | 0.0 / 2.5 / 22.5 | 0.0 / 2.5 / 2.5 | 97.5 | 0.01 / 0.28 | 2.5 |
| 25 | 60 / 60.0 | 0.0 / 0.0 / 0.0 | 0.0 / 0.0 / 0.0 | 0.0 / 0.0 / 0.0 | 0.0 / 0.0 / 0.0 | 100.0 | 0.00 / 0.00 | 0.0 |
