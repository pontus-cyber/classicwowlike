# Legacy progression (D154): persistent heroes, zones at the hero's level, Legacy points

Owner: Lead Game Designer, 2026-11-17. Status: **draft for owner steering**. Only what D154 states is the owner's; every rule, number and name below is the designer's proposal. Nothing here is built; rules.md, expedition.md, balance.md and m3-onboarding.md are not edited until the owner has steered (section 5 lists what changes in them).
Audience: owner, Lead, Core Gameplay Engineer, UI/UX Engineer, Simulation & Balance Engineer, Content Designer, QA, lore chat.

Sources: the owner's decision and his two answers [stated: docs/feedback/2026-11-17-1448-owner-legacy.md; docs/DECISIONS.md D154]; his earlier wishes on talents, respec and banked sets [stated: docs/feedback/2026-11-11-1902-owner.md; EXPERIMENTS X1], on hard first runs [stated: docs/feedback/2026-11-11-1026-owner.md, as quoted in m3-onboarding.md], on skill [stated: 2026-11-11-1858; X2] and on dungeons and Ascension [stated: 2026-11-11-1909; X3]; the game today [source: docs/specs/rules.md 1-11, expedition.md 2-7 and H, balance.md, m3-onboarding.md, changes-m3-v2.md, changes-m3-v3.md]; the parked meta v2 draft [source: docs/specs/meta-v2.md], which this spec replaces where they differ. Measurements: section 6 (designer scratch on main 19719ed; src/ untouched).

Every number is a named constant in the table of section 10. Player-facing names (the Legacy hall, the Armoury, the Wayfarer's kit, set names) are drafts for the owner and for the originality check of docs/lore/style.md 5.

---

## 0. The owner's decision and the answer in one line each

| # | Owner [stated] | This spec |
|---|---|---|
| 1 | Account-wide Legacy points, earned every run, buy permanent upgrades | Legacy lines on every run (4.1); a first set of 13 upgrades in the Legacy hall (4.2); Echoes become Legacy points (4.6) |
| 2 | Each hero has its own level, 1 to 25 | One hero per class on the profile, level 1-25 kept across runs (1.1-1.3) |
| 3 | A good playthrough reaches 25 in 6 to 8 hours | XP curve sized on the simulator: the planner bot reaches 25 in 6.5-7.6 hours (11-13 runs of about 36 minutes), the levelling route in about 6 (1.4) |
| 4 | Zones scale to the hero's level | Each zone's level is fixed when the hero arrives: the hero's level plus the zone's tier; enemies also hit harder zone by zone (2.1-2.2) |
| 5 | Death ends the run, pays Legacy points, keeps level and XP | 1.5 |
| 6 | Optimise for beating the game or for levelling | Two routes, each paying both currencies at different rates; measured (section 3) |
| 7 | From about level 20, Legacy currency unlocks talent trees and set building | The second and third talent trees open from level 20 (4.3); the Armoury, a bank of nine three-piece tree sets (4.4) |

---

## 1. The hero

### 1.1 One hero per class
- The profile holds at most one hero per class (HEROES_PER_CLASS 1): Rogue, Mage, Hunter [assumption: the Lead's task; the owner chose one character per class for meta v2 on 2026-11-11, meta-v2.md 3.1].
- A hero is made the first time its class is picked (a name; the Hunter still picks a pet each run). Play never deletes it. **Retire hero** (behind a confirmation) resets that hero to level 1 with no talents; the account's Legacy points, Legacy hall and Armoury stay.
- Class select becomes hero select: three cards (an empty one reads "New hero"), each with level, XP bar, the open talent tree, runs, wins and best result.

### 1.2 Hero level and the power scale
- The hero's level runs from 1 to HERO_MAX_LEVEL (25). It is the only level the player sees.
- The engine keeps its 1-60 scale for every formula that takes a level (stats, HP and mana, spell strength, enemy HP and damage, armour, hit chance, XP modifiers, item budgets, prices). This spec calls it the **power level**. A hero of level H has power level `POWER_OF_LEVEL[H] = round(1 + (H - 1) × (MAX_LEVEL - 1) / (HERO_MAX_LEVEL - 1))`:

| Hero level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Power level | 1 | 3 | 6 | 8 | 11 | 13 | 16 | 18 | 21 | 23 | 26 | 28 | 31 | 33 | 35 | 38 | 40 | 43 | 45 | 48 | 50 | 53 | 55 | 58 | 60 |

- So a level-25 hero has today's level-60 stats and kit, and every curve tuned in D16-D153 keeps its meaning. A level-up raises the power level by 2 or 3 at once.
- Enemies, nodes and items carry power levels in the engine. On screen every level is on the hero scale: `shownLevel(M) = 1 + round((M - 1) × (HERO_MAX_LEVEL - 1) / (MAX_LEVEL - 1))` (Oruvath at power 65 over a level-25 hero shows 27). A level's colour (grey to red) is computed on power levels, as today.
- Why a conversion and not new formulas: the 1-60 curves carry fifty tuned decisions; one table and one display function keep them [inference]. The player never sees a power level.

### 1.3 Hero XP
- XP is counted in **hero XP**. Every award keeps today's formula (rules 2.0, 4.4; expedition.md 3.1: a fraction of a level, the level-difference modifier, XP_WEIGHT_MULT, rested, heat, Quick Study), counted in level-equivalents at the hero's power level L and multiplied by HERO_XP_UNIT (100):
  `xp = round(HERO_XP_UNIT × frac × xpCurve(CL) / xpCurve(L) × diffMod(CL - L) × (1 + xpPctMods))`, CL and L power levels; contracts and Gorrak's bounty without diffMod, as today.
  At the hero's level a normal kill pays 40 XP (0.285 × 1.4 × 100), a quest turn-in 161, a Cull contract about 280, a dungeon clear about 100 to 130 plus its kills. The rested pool is REST_RESTED_FRAC × HERO_XP_UNIT (60 XP), capped at RESTED_CAP_FRAC × HERO_XP_UNIT (150).
- A level costs HERO_XP[H] (1.4). XP carries over and is never lost.
- At level 25 XP keeps counting: every HERO_XP_AT_MAX (4 100) XP gained pays LEGACY_PER_LEVEL Legacy points at the run's end (4.1).

### 1.4 The XP curve: level 25 in 6 to 8 hours
Sized on what the simulator measures (section 6):
- **Run length.** Today's runs last 41.0 minutes at manual-play pace (rules 3; planner, all runs, deaths included; a win 46.0) [measured 6.2]. At the hero's level runs last 33-39 minutes, mean 36 (6.3: no Camp grind to level 60, fewer fights at the top); 32-42 for a planner that also clears dungeons and elites. So **one run is about 0.6 hours**, and 6-8 hours is 10-13 runs.
- **XP per run.** Because zones follow the hero, a run pays about the same share of a level at every level: 70 level-equivalents (7 000 hero XP) at level 1-2, 66 at level 5, 59 at 10, 53 at 15, 49 at 20 for the planner on today's risk tables; 17 % more an hour (11-19 %) for a planner with a warmed table, which clears about one dungeon and three elites a run (6.3, 5.8 item 2). Per minute of play: 211 hero XP in the first run, 191 at level 2, 169 at 5, 156 at 10, 148 at 15, 145 at 20 (planner, today's tables).
- **The rule:** `HERO_XP[H] = m(H) × r(H) × HERO_XP_UNIT × XP_RATE_ADJ`, rounded to 50, with `m(H) = MIN_PER_LEVEL_BASE + MIN_PER_LEVEL_STEP × H` minutes (8.125 + 0.75 H), r(H) the measured level-equivalents per minute above (interpolated) and XP_RATE_ADJ 1.08 the middle of the two planners, so both land inside 6-8 hours: **7.6 hours for the planner on today's tables, about 6.5 for the planner that clears dungeons and elites**. Level 2 comes inside zone 1 of the first run, level 4-5 at the end of a typical first run (so the first talent point and the tree choice open run 2), level 10 after about 1.6-1.9 hours, 20 after 4.6-5.3.

| Level H | XP from H to H + 1 | Total XP to reach H + 1 | Minutes for this level (planner) | Hours to reach H + 1: planner / with dungeons and elites |
|---|---|---|---|---|
| 1 | 2 000 | 2 000 | 9.5 | 0.16 / 0.14 |
| 2 | 2 000 | 4 000 | 10.5 | 0.33 / 0.28 |
| 3 | 2 050 | 6 050 | 11.2 | 0.52 / 0.44 |
| 4 | 2 100 | 8 150 | 11.9 | 0.72 / 0.61 |
| 5 | 2 150 | 10 300 | 12.7 | 0.93 / 0.79 |
| 6 | 2 250 | 12 550 | 13.5 | 1.15 / 0.99 |
| 7 | 2 350 | 14 900 | 14.3 | 1.39 / 1.19 |
| 8 | 2 450 | 17 350 | 15.2 | 1.65 / 1.41 |
| 9 | 2 550 | 19 900 | 16.1 | 1.91 / 1.64 |
| 10 | 2 650 | 22 550 | 17.0 | 2.20 / 1.88 |
| 11 | 2 750 | 25 300 | 17.8 | 2.49 / 2.13 |
| 12 | 2 850 | 28 150 | 18.7 | 2.81 / 2.40 |
| 13 | 2 900 | 31 050 | 19.2 | 3.13 / 2.67 |
| 14 | 3 000 | 34 050 | 20.1 | 3.46 / 2.96 |
| 15 | 3 100 | 37 150 | 20.9 | 3.81 / 3.26 |
| 16 | 3 200 | 40 350 | 21.7 | 4.17 / 3.56 |
| 17 | 3 300 | 43 650 | 22.5 | 4.55 / 3.88 |
| 18 | 3 400 | 47 050 | 23.3 | 4.93 / 4.22 |
| 19 | 3 500 | 50 550 | 24.0 | 5.33 / 4.56 |
| 20 | 3 600 | 54 150 | 24.8 | 5.75 / 4.91 |
| 21 | 3 750 | 57 900 | 25.9 | 6.18 / 5.28 |
| 22 | 3 850 | 61 750 | 26.6 | 6.62 / 5.66 |
| 23 | 3 950 | 65 700 | 27.2 | 7.07 / 6.05 |
| 24 | 4 100 | 69 800 | 28.3 | 7.55 / 6.45 |

- In runs, at the measured XP per run (planner on today's tables): run 1 ends at level 4.4, run 2 at 7.5, run 3 at 10.0, run 4 at 12.2, run 5 at 14.2, run 8 at 19.1, run 13 at 25; with dungeons and elites 25 comes in run 11 [inference: the measured XP per run by level, chained]. About two and a half levels a run early, one and a half late.
- The routes (section 3): the winning route reaches 25 in about 6.8-7.8 hours, the levelling route (the Camp farm) in about 5.6-6.2 [inference: the route rates of 6.4 over this table]; heat alone moves XP per hour by 2-3 %. Quick Study (4.2, +10 % at full) takes about 0.6-0.7 hours off for a player who buys it early.

### 1.5 Death and the end of a run
- A run ends at a death with no resurrect (rules 9), at Oruvath's death, or when the player abandons it from the menu (it ends as a death where the hero stands).
- Every ending keeps the hero's level, XP, talents, open trees and trained spells, and pays the run's Legacy lines (4.1).
- The hero's XP is written to the profile at every zone arrival and at the run's end, so a closed browser loses at most the zone in progress.
- Nothing else of the run is kept (1.6).

### 1.6 What a new run starts with, and what resets

| Part | At Set out | Between runs |
|---|---|---|
| Level and XP | the hero's | kept |
| Talents | as last set at the start camp (4.3) | kept; changed only at the start camp |
| Spells and ranks | every spell the hero's level allows, learned and trained to its level, free (1.7) | kept |
| Action bar | the hero's last layout; new spells go to the spellbook | kept |
| Gear | **the Wayfarer's kit**: a common item of the hero's power level in each of the ten slots (rules 8.1; weapon and chest keep the class's start names); banked set pieces chosen at the camp replace the kit's Neck, Ring and Trinket (4.4) | everything found is lost; set pieces go back to the Armoury |
| Gold | START_GOLD_V × V(power level) (3 V: two Healing Draughts at the first vendor, at every level; was 50 copper) | lost |
| Consumables | START_RATIONS Trail Rations; Packed Satchel's draughts (4.2) | lost |
| Camp points, contracts, Reserve | as today (expedition.md 2; D152's first run) | lost |
| Homeward Bell | BELL_START_CHARGES (+ Swift Boots) | lost |
| Tolls, the Furnace, zones, the Dimming, boons, Embers | new | lost |

The kit exists because gear is about half of a high-level hero's stats: a level-25 hero with today's weapon and chest only would meet level-60 enemies with eight empty slots [inference: at item level 60 an uncommon item in each of the ten slots gives about 280 stat points, against a primary stat of 138 from level]. Run drops at the zone's level replace it piece by piece: that is the run's gear curve (measured: item level at Oruvath = the hero's power level + 1, rare or epic in 56-73 % of slots; 6.3).

### 1.7 Spells, ranks and the trainer on the 1-25 scale
- A spell's learn level is the first hero level whose power level reaches today's learn level (SPELL.id.heroLvl; content keeps `lvl` as the power value):

| Hero level | Rogue | Mage | Hunter |
|---|---|---|---|
| 1 | Gutting Jab, Severing Flourish | Ember Bolt, Frost Lance | Keen Shot, Barbed Arrow |
| 3 | Shadowstep Strike, Throat Jab | Arcane Ward | Mark Prey, Mend Companion |
| 5 | Open Vein | Rime Burst | - |
| 6 | Temple Blow | Living Flame | Muzzle Shot |
| 7 | Smoke Veil | Spellsnap | Snare Trap |
| 8 | - | Hexbind | Field Dressing |
| 9 | Whirling Edges; Ghostblade Rush (Legacy) | Chrono Sigil (Legacy) | Ricochet Bolt (Legacy) |
| 10 | - | Cinder Storm | Volley Rain |
| 11 | Expose Weakness | Mana Siphon | - |
| 12 | - | - | Feign Stillness |
| 13 | Adrenal Surge | Glacial Tomb | - |
| 15 | - | - | Savage Order |
| 16 | Vanishing Step | Pyre Comet | - |
| 17 | Bloodprice Gambit (Legacy) | Mirrorshade (Legacy) | Rapid Volley; Beastcall Horn (Legacy) |
| 19 | Final Reckoning | - | - |
| 20 | - | Starlance Barrage | Heartseeker Shot |

- **(designer, 2026-11-18, draft, 2.4.1):** Pyre Comet moves to hero level 9 (power 21), with the Rogue's Whirling Edges.
- **Rank** is the hero level a spell was trained at ("Rank 12"); the engine's trained level tl is that level's power level (rules 5.2).
- At the start camp every spell the level allows is learned and trained to the hero's level, free [draft line: "The Bellwrights' trainers have you ready."]. In a run, a level-up opens new spells and ranks at any trainer (hub, node, the Camp) for gold as today (TRAIN_NEW_V, TRAIN_RANK_V × V(power level)); what is trained is kept. Trainer's Ledger is retired (4.6).
- The hero gets a new spell about every one or two levels up to level 20: the classic trainer rhythm. These learn levels are also the first lever for class balance on the new scale (6.6 reading 3): the Mage's and the Hunter's strongest spells come at 15-20, the Rogue's kit early.

### 1.8 Talent points
- Points come with the hero's level (TALENT_POINTS[H], today's schedule on the power level; 26 at level 25):

| Hero level | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Points | 1 | 2 | 4 | 5 | 6 | 7 | 9 | 10 | 11 | 12 | 13 | 15 | 16 | 17 | 18 | 20 | 21 | 22 | 23 | 25 | 26 |

- New points are spent out of combat at any time, as today, in an open tree (4.3). The capstone (tier 5: 16 points in the tree first, so the 17th point) is reachable from level 18; one capstone per hero, as today.
- **The first point picks the hero's tree.** The talent window says it once: "Your first point chooses your tree until level 20." Until level 20 that is the only open tree.

---

## 2. Zones scale to the hero

### 2.1 Zone level
- When the hero arrives at zone z's hub, the zone's band is fixed for the whole zone: `band(z) = clamp(P(hero) + ZONE_TIER[z], 1, CL_MAX)`, P the hero's power level at arrival. A level-up inside the zone does not move it; the next zone is set from the new level.
- Node levels keep today's rules relative to the band, on compressed rings: `CL = band + RING_CL_BASE[ring] + u`, u uniform in 0..RING_CL_SPREAD - 1, with **RING_CL_BASE [0, 0, 1, 2] and RING_CL_SPREAD 2** (ring 1 the band to +1, ring 2 +1 to +2, ring 3 +2 to +3; was [0, 1, 4, 7] and 3, a ten-level climb that no longer happens inside one zone). Quest offsets and ELITE_LEVEL_OFFSET (+1) unchanged; dungeon trash at band + DUNGEON_LEVEL_OFFSET (**2**, was 4), its boss DUNGEON_BOSS_LEVEL_OFFSET (+2) above; contracts at band + CONTRACT_CL_OFFSET (**2**, the rim; was 8 of a ten-level band); the hub's vendor at the band.
- **CL_MAX 66** (was 60): a level-25 hero's late zones and Oruvath sit above 60; ILVL_MAX 69 (was 63). Every formula is defined there (rules 4.3, 7.6, 8.3).
- Shown on the map and the node cards as hero levels (1.2): zone 1's nodes show the hero's level or one under, zone 6's one or two over.

### 2.2 Difficulty still rises within a run
The old climb (level 1 to 60 across six zones) set the rise, and gear that ran about eleven levels behind the player made it hard (today's item level at the boss: 48.8 at level 60; 6.2). At the hero's level, drops come at the zone's level and the gear lag is gone (6.3), so levels alone leave the zones easy (arm R: 75-91 % lowest HP in won fights, almost no deaths in zones). The proposal has four levers, measured together as arm T2 (6.3):
1. **Zone tier, levels:** ZONE_TIER = [-2, -1, 0, +1, +2, +3] power levels for zones 1-6 (zone 1 about one hero level under the hero, zone 6 about one over). Without it (all zones at the hero's level) there is no rise at all (arm F, 6.3).
2. **Zone tier, damage:** every enemy made from an enemy template (rules 7.6: normal, elite, rare, dungeon, Camp waves, shardspawn, adds) deals × ZONE_TIER_DMG[z] = [1.25, 1.30, 1.35, 1.40, 1.45, 1.50] in zones 1-6 (the Camp uses zone 6's), on top of zone danger by power level (rules 7.6, unchanged). This pays back the gear the old climb withheld.
3. **Specials as today:** elites (+1), rares, dungeon bosses (+2 above the trash), their Deathblows (rules 7.12).
4. **Oruvath** at the hero's level plus BOSS_TIER, with an HP factor by hero level (2.4).
Measured with T2 (planner on today's tables, no Legacy bought): runs that die in zones 5-6 against zones 1-2, 7.4 % against 0.3 % at level 10, 17.4 % against 1.3 % at 15, 7.0 % against 1.0 % at 20; mean lowest HP of won fights falls from zone 1 to zone 6 by 12 points at level 10 and 18 at level 2, but only 2-3 points at 15 and 20. The planner that clears dungeons and elites feels it more: at level 10 its lowest HP falls 73 → 59 % and 14 % of its runs die in zones (L4, 7.2; the flat top end is the second tuning item of phase 1).
The hero's own level-ups in a run (one and a half to two and a half, 1.4) help only until the next zone is set.

### 2.3 Kept: the Furnace, the Dimming and the Roads; the Camp waves change
- Unchanged: tolls, the Furnace's line and states, Ascendancy at Oruvath, heat rewards (rules 1.7), the Dimming with D152's steady pace, the Roads and the Homeward Bell (expedition.md 6-7), the lean first run (D152).
- **Camp waves** become the levelling route's farm (section 3): at most CAMP_WAVE_MAX (10) per run, each paying CAMP_WAVE_XP_MULT (2) × its normal XP (the kills and the wave bonus), at the Camp's level, at 2 tolls each as today (so each wave also raises Oruvath's Ascendancy). They existed to reach level 60 before the boss; uncapped they would now be an endless farm.

### 2.4 The Camp and Oruvath
- The Camp's level is P(hero at arrival) + CAMP_TIER (3, zone 6's tier): its vendor's stock and its waves.
- Oruvath's level is `LB = P(hero at FIGHT_BOSS) + BOSS_TIER` (5). His numbers scale from today's level-62 fight:
  - HP and Shard HP × `hpScale(LB) × bossHpLevel(H)`, with `hpScale(M) = (ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL × M) / (ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL × BOSS_REF_LEVEL)` (the normal enemy curve) and `bossHpLevel(H) = min(1, BOSS_HP_LEVEL_BASE + BOSS_HP_LEVEL_STEP × H)` (0.40 + 0.024 H: 0.52 at level 5, 0.64 at 10, 0.88 at 20, 1 at 25);
  - every damage of the fight (his attacks, the Shards, the Brand) × `dmgScale(LB)`, the same ratio for a normal enemy's damage with zone danger;
  - BOSS_ARMOR × LB / BOSS_REF_LEVEL; Shards at LB - 2.
  Phases, schedule, Ascendancy, BOSS_DMG_MULT and the enrage are unchanged. BOSS_REF_LEVEL is today's BOSS_LEVEL (62).
- Why the HP factor: with the enemy curve alone Oruvath was unwinnable below level 10 and for the Mage and the Hunter until 20; their fights ran into Final Dark in phase 2, the Shards outlasting a kit that gets its big spells late (arm R: 0 % at levels 2 and 5; at 10 Rogue 59 %, Mage 0 %, Hunter 0 %; 6.3). The factor gives a young hero a short fight he can learn; at level 25 it is today's fight.
- There is no level gate. A first run wins about 1 in 75 (1.3 %, measured) [stated: "the first runs very hard"].
- **(designer, 2026-11-18)** The HP factor `bossHpLevel(H)` and the damage scale `dmgScale(LB)` above are replaced by the change of 2.4.1 (draft).

### 2.4.1 Oruvath on the 1-25 scale (change, Lead Game Designer 2026-11-18, **draft**)
Status: **draft**, not approved by the owner; replaces the Oruvath scaling of 2.4 when the owner or the Lead accepts it. Measured in docs/reports/legacy-oruvath-2026-11-18.md (full runs, the band risk tables of sim/tables/legacy/, 300 runs per class per band, seeds 3000-3059, `--map expedition --prep`, D118). Every number is in section 10 (rows marked "2.4.1").

**Problem** [source: docs/reports/legacy-calibration-2026-11-17.md]. Below about hero level 16 Oruvath's fight on the 2.4 scaling is a race against Final Dark at round 57, decided by whether a class has a Shard answer: the Rogue's Whirling Edges carries Venomcraft's Toxic Coating to every Shard (boss win 6 → 97 % in one level), the Mage's Pyre Comet comes at 16, the Hunter never gets one. Learn levels alone could not fix bands 1-10. This pass found three more causes [measured, report section 2]:
1. In a race the win rate jumps from 0 to 100 % over a 40 % change of Oruvath's HP; so any class difference of 10-20 % becomes a 50-90 pp gap, and any spell that adds 20 % flips a class.
2. Oruvath's damage scale took zone danger's early factors (EARLY_DMG_MULT, Z1_DMG_MULT; rules 7.6), which drop his damage 20 % at boss level 11 and raise it 37 % at level 21: a hole in the win curve at hero level 5.
3. Two causes outside the fight's numbers: autoplay casts Living Flame and Barbed Arrow on fresh Shards (they die before the DoT pays) and never on Oruvath under 60 % HP (phase 3); and the sim's Camp bar (balance.md 1.2) drops the Hunter's Mend Companion from hero 12, so the pet dies in phase 2. With both fixed the Hunter's mid-level collapse disappears on the bench (boss win at hero levels 9-15: 15-55 % → 85-100 %).

**The rule.** The fight becomes a survival fight at every level (losses are deaths, as at level 60), its Shards stop being an AoE wall, and its numbers follow the hero level in one table, so that no level step and no single spell flips it. H is the hero's level at FIGHT_BOSS (in a run it is 2-3 levels above the level the run started at); LB = P(H) + BOSS_TIER as in 2.4.
1. **HP.** Oruvath's HP and the Shards' base HP × `hpScale(LB) × BOSS_HP_LEVEL[H]` (table in section 10: 0.50 at H1, 0.71 at H5, 1.00 at H9, 1.12 at H10, 1.02 at H17, 0.89 at H24-25). Replaces `bossHpLevel(H)`. The table is the measured hero power on the 1-25 scale: it rises fastest at H5-10, where a hero in a band 6-10 run clears about one dungeon and four elites (sim/tables/legacy, risk-H06-10), and falls slowly after H17.
2. **Damage.** Every damage of the fight (his attacks, the Shards, the Brand) × `dmgScale0(LB) × bossDmgLevel(H)`, with `dmgScale0(M) = ((ENEMY_DMG_BASE + ENEMY_DMG_PER_LEVEL × M) × (1 + ZONE_DANGER_STEP × max(0, M - ZONE_DANGER_FROM) / 10)) / (the same at BOSS_REF_LEVEL)` (the normal enemy curve with zone danger but without the early factors: smooth in level) and `bossDmgLevel(H) = max(BOSS_DMG_LEVEL_MIN, min(BOSS_DMG_LEVEL_MAX, BOSS_DMG_LEVEL_BASE - BOSS_DMG_LEVEL_STEP × H))` (1.40 - 0.021 H between 0.90 and 1.20: 1.20 up to H9, 1.19 at H10, 1.08 at H15, 0.98 at H20, 0.90 from H24). A young hero meets an Oruvath whose hits threaten his life, so the fight is lost by dying, not by the clock; the cap keeps the fragile Mage alive at H1-9 (at 1.38 it won 2-5 % there against 10-13 % for the Hunter).
3. **The Shards scale with the hero.** The Shards' HP is further × `shardHpLevel(H)`: SHARD_HP_LEVEL_LOW (0.5) up to hero level SHARD_HP_RAMP_FROM (17), then rising linearly to 1 at SHARD_HP_RAMP_TO (23). At half HP a single-target hero clears a wave in about two to four actions and an AoE hero in one or two, so a Shard answer helps but no longer decides the fight; from H23, when every class has its AoE, they are today's Shards. Count, schedule, Linked and the AoE bonus are unchanged (measured: Linked 0.15 → 0.05 per Shard moved no class more than 3 pp).
4. **Final Dark comes later for a younger hero:** at round `min(FINAL_DARK_ROUND_MAX, BOSS_ENRAGE_ROUND + round(FINAL_DARK_LEVEL_STEP × (HERO_MAX_LEVEL - H)))` (57 + 1.4 per level under 25, at most 76: 76 up to H11, 74 at H13, 71 at H15, 64 at H20, 57 at H25). The enrage still ends a fight that is not being won; a slow kit no longer loses a fight it is surviving. The intent track and the enrage counter show the round as today.
5. **Autoplay DoTs (rules 7.9, when 2.4.1 is folded in):** Living Flame and Barbed Arrow are cast on a boss (Oruvath or a dungeon boss) at any HP and never on a Dimming Shard; on other enemies the condition is today's (target HP at least `autoTargetHp`).
6. **The sim's Camp bar (balance.md 1.2, when folded in):** at the Camp the Hunter's bar keeps Mend Companion (a pet step after the defensive step), as a player who fights Oruvath with a pet does.
7. **Class numbers** (content, constants.js SPELL; the Rogue unchanged):

| Spell | Today | Change | Why (measured) |
|---|---|---|---|
| Frost Lance (Mage) | l 1.54, p 0.84 | l **1.77**, p **0.97** (+15 %) | the Rimecraft Mage's main nuke until Pyre Comet; the Mage was the weakest class at hero levels 4-15 in every fight arm (+10 %: 23 % in band 11-15, +20 %: 53 %) |
| Pyre Comet (Mage) | learn power 38 (hero 16) | power **21 (hero 9)** | the Mage's burst arrives with the Rogue's and Hunter's AoE instead of six levels later; at hero 16 it flipped the Mage's boss win 5 → 60 % |
| Barbed Arrow (Hunter) | DoT l 0.45, p 0.18 | l **0.495**, p **0.20** (+10 %) | the Hunter's armour-free damage against Oruvath (his armour takes a third of every physical hit) |
| Field Dressing (Hunter) | healPct 0.12 | **0.18** | the Hunter's phase 3 sustain; it lost 50-86 % of its boss fights to Final Dark, healing instead of shooting |

The Rogue's Shard answer stays Whirling Edges at hero 9 with Toxic Coating: with half-HP Shards the step at hero 9 is gone (bench: Rogue boss win at hero 5 → 6 in a survival fight, 0.95 → 1.32 in the HP it can take, against 0.82 → 1.66 today). Tried and rejected: Toxic Coating no longer applied through Whirling Edges (full runs: the Rogue fell to 0-5 % from hero 15, since its late power is that spread); Whirling Edges at power 26 or 38 (moves the step, the sim's F1/F3); Smoke Veil 0.45 → 0.30 and Toxic Coating × 0.8 (each cost the Rogue 8-18 pp in every band, also where it was balanced).

**What the engineer builds.** One switch `C.GATES.oruvathLegacy` (default off until the owner or Lead accepts): the HP table, `dmgScale0` and `bossDmgLevel`, `shardHpLevel` applied in makeShard after the HP scale, the Final Dark round by H in `scheduleAt` and the enrage counter (boss.js reads it from the fight, not from BOSS_ENRAGE_ROUND), the autoplay DoT rule (autoplay.js `autoTarget`, cases living_flame and barbed_arrow), and the four SPELL values. The sim adds the Hunter's pet step to `templateBar` (sim/lib/policy.mjs). Scratch reference: sim/legacy-patch.py fields `bhp`, `bdmg`, `bsmooth`, `shp`, `fd`, `dotfix`, `barfix`, `learn`, `spell` (report 2026-11-18, the arm's JSON).

**Measured** (full runs on fresh seeds 5000-5059, 60 runs per class and hero level, **300 per class per band**; planner, band risk tables, `later` profile; report docs/reports/legacy-oruvath-2026-11-18.md):

| Band (hero level at the run's start) | Win: Rogue / Mage / Hunter (pooled) | B6: spread, each within 5 pp of the mean | Before: 2.4 scaling (calibration report, 200 per class) |
|---|---|---|---|
| 1-5 | 2.0 / 2.3 / 8.0 (4.1) | 6.0 pp, **pass** | 8.5 / 4.0 / 16.5 (9.7), 12.5 pp |
| 6-10 | 23.7 / 19.7 / 27.7 (23.7) | 8.0 pp, **pass** | 89.0 / 13.5 / 27.0 (43.2), 75.5 pp |
| 11-15 | 34.3 / 43.0 / 32.0 (36.4) | 11.0 pp, **fail** (Mage + 6.6) | 77.0 / 14.5 / 1.0 (30.8), 76.0 pp |
| 16-20 | 34.3 / 37.3 / 39.7 (37.1) | 5.3 pp, **pass** | 38.0 / 41.5 / 11.0 (30.2), 30.5 pp |
| 21-25 (low reading, 5.8 item 3) | 32.7 / 32.0 / 39.7 (34.8) | 7.7 pp, **pass** | 12.5 / 14.0 / 3.5 (10.0), 10.5 pp |

- The win rate rises with the hero level: pooled by start level (3-level mean) 2, 4, 5, 5, 7, 14, 22, 27, 26, 27, 28, 32, 36, 41, 41, 37, 34, 34, 40, 43, 45, 47 % at levels 1-22 (23-25 fall: the planner rushes). Per class the largest rise of that mean between neighbouring levels is 7.8 pp (Rogue), 11.1 (Mage), 9.4 (Hunter); before, one level flipped the Rogue by 92 pp (hero 5 → 6), the Mage by 47 and the Hunter by 42. From hero level 7 to 23 no class wins more than 63 % or less than 15 % at any level; the Mage's lowest point is hero 6 (0-8 % on three seed sets), the last level before Pyre Comet is in reach.
- Losses are deaths: Final Dark ends 0 % of the Rogue's boss losses, 1-14 % of the Mage's and 15-59 % of the Hunter's (before: 62-99 % of the Mage's and Hunter's in bands 1-3).
- L3 (the first win): with runs starting at hero levels 1, 4, 7-8, 10 and 12 (1.4) the measured rates (1, 4, 27, 24, 31 %) give a first win by run 4 in 47 % of campaigns and by run 5 in 63 %: around run 4-5, hero level 10-12 [inference: the cell rates chained]. The first run of a fresh profile is not this cell (lean camp, D152); its rate is under 5 % [inference: H1 1 %].
- B7 (trees, 100 runs per class per band): fails for the Rogue in bands 1-4 (Venomcraft 20-36 %, its other trees 0-15 %) and for the Hunter in every band (Beastbond 64-86 % in bands 2-4, Marksmanship 2-25 %); the Mage passes in bands 2, 4, 5. Tree balance on the 1-25 scale is a class task, not a fight setting; if the sim applies balance.md 1.3's switch rule here the Hunter moves to Beastbond and B6 breaks.
- One-button play (`--bot onebutton`) wins 0-4 % in band 1-5 and 0 % from hero 6 (0 of 230 boss fights): special fights still demand thought.

**Open (for the Lead):**
1. **Band 11-15 fails B6 by 3 pp** (the Mage 43 % against 32-34 %). It is the steepest cell found: on the same states the Mage's rate there moves 43 → 21 % with the Shards at 0.55 instead of 0.5, and Frost Lance + 10 / + 15 / + 20 % gave 23 / 37-43 / 53 % in full runs (three seed sets). The next step is a Mage number at hero levels 11-15 tuned on 600 runs per class per band (for example Frost Lance + 12 %), not a fight setting.
2. **The Hunter is still the slow class:** 40-59 % of its boss losses in bands 6-25 are Final Dark (pooled over the classes about 15-20 % of boss losses, inside B29's 5-20 %); the later Final Dark is what keeps it level. A Hunter speed number against Oruvath's armour would let FINAL_DARK_LEVEL_STEP come down.
3. Rules 5 and 6 also change today's level-60 game (autoplay DoTs at any boss HP; the Hunter's Camp bar): re-run the P0 and PALL cells (B6, B26-B29) when they are built.
4. Phase 1's done-when (7.1) reads "B6 at H10 within its band (1.7 learn levels first)": with 2.4.1 it is B6 in every band on 300 runs per class, met in four of five.

### 2.5 Items and gold
- Item level as rules 8.3 (source power level + rarity bonus), shown on the hero scale; capped at ILVL_MAX.
- Gold scales with the hero (1.6). Vendors as today at their level (the hub at the band, the Camp at the Camp level).

---

## 3. Two ways to play

Every run pays two currencies the player keeps: **hero XP** (this hero's level) and **Legacy points** (the account's upgrades). A run is played for one more than the other [stated: "optimize for beating the game ... or for levelling the character"].

### 3.1 The winning route
Plays for Oruvath: keeps tolls low (the Furnace Calm or Smouldering, so Oruvath has no Ascendancy), takes contracts and dungeons for gear, skips the Camp waves, answers the Deathblows. It is paid mostly in Legacy points (zones, dungeons, contracts, elites, Oruvath reached, his phases, the kill +120, the speed bonus +40, the first kill per class +100) and, from level 20, in set pieces (4.4).

### 3.2 The levelling route
Plays for the hero: farms the Camp waves (up to 10, double XP), runs Burning or Infernal where it can (+35 / +50 % XP), and meets a stronger Oruvath for it (each wave adds 2 tolls toward Ascendancy, and the waves cost HP and potions). It is paid mostly in hero XP, so the level-20 trees and sets come sooner, plus the Legacy level line (+20 a level).

### 3.3 What each route earns, and what it gives up

| | Hero XP | Legacy points | Items |
|---|---|---|---|
| Winning route | the run's nodes, contracts and dungeons | zone, dungeon, contract, elite and Oruvath lines; first kill per class; speed bonus | dungeon boss rolls, contract choices; set pieces from level 20 |
| Levelling route | the run's nodes plus the Camp farm (double XP), heat | per hero level gained; XP past level 25; fights won in heat | Camp wave drops, heat's rarity steps |
| Gives up | the Camp farm | Oruvath's lines, often (a stronger Oruvath) | the boss's set piece |

Measured (6.4, planner, levels 10 and 20, on today's tables and on a warmed table): the Camp farm earns 1.17-1.30 × the winner's XP per hour; the winner earns 1.19-1.32 × the leveller's Legacy points per hour and wins 15-19 points more often (for example 37.7 against 19.3 % at level 10, 25.0 against 7.0 % at 20). So the winning route reaches 25 in about 6.8-7.8 hours and the levelling route in about 5.6-6.2, while the winner earns about a quarter more Legacy points an hour.

What did not work as a levelling route (6.4): heat alone (the leveller with the heat-seek time weight earns 1-3 % more XP per hour; the Dimming ends a zone before many nodes run Burning), a steeper road (every zone +2 power levels: +6 % XP per hour at level 10, none at 20, and Oruvath out of reach), and the Camp waves at normal XP (+7-10 %). XP per hour is set by the run's own structure; only a farm that pays above it makes a route.

### 3.4 Both must pay (target L2, 7.2)
- (a) the leveller gains at least LEVEL_ROUTE_XP_MIN (1.15) × the winner's hero XP per hour;
- (b) the winner earns at least WIN_ROUTE_LEGACY_MIN (1.10) × the leveller's Legacy points per hour and wins at least WIN_ROUTE_GAP_MIN (5 pp) more often;
- (c) no route leads on both currencies per hour.
Levers if a route falls short: CAMP_WAVE_XP_MULT and CAMP_WAVE_MAX for the leveller; the Oruvath lines and SET_DROP_CHANCE for the winner; LEGACY_PER_LEVEL between them.

---

## 4. Legacy points

### 4.1 Earned every run
Legacy points replace Echoes (4.6). The lines are today's Echo lines (rules 11.1, expedition.md 8.1) with one change, the level line:

| Line | Legacy points | Change |
|---|---|---|
| Per hero level gained in the run; at level 25, per HERO_XP_AT_MAX XP gained | LEGACY_PER_LEVEL (20) | was ECHO_PER_LEVEL 1 per in-run level (59 in a full run) |
| Per zone left (Road or Bell) | 7.5 | - |
| Per dungeon cleared / elite / rare / quest / contract | 8 / 3 / 6 / 1 / 3 | - |
| Per fight won in a node entered Burning or Infernal | 1 | - |
| Oruvath reached / per phase after 1 / killed / at or under par | 20 / 12 / 120 / 40 | - |
| First Oruvath kill with this class | 100 | - |
| Unspent camp points (first run) | 2 per point | - |
| Welcome (first run of a profile) | 60 | - |
| A set piece the Armoury already holds (4.4) | SET_DUPLICATE_LEGACY (40) | new |
| Oaths | × (1 + 0.25 × Oaths) on the total | - |

Measured income (6.5, planner, no Legacy bought): the first run 135 (plus the 60 welcome), later runs 153 at level 2, 207 at 10, 173 at 20; 244-327 an hour, 301-347 for the planner that clears dungeons and elites (today's Echoes: 209 and 259 a run, 306 and 383 an hour). The level line is 20-33 % of it.

### 4.2 The Legacy hall: the first set
Bought between runs, account-wide (every hero gets them). Small and readable: thirteen entries, all from today's catalogue at its tuned strength or less.

| id | Name | Ranks | Legacy per rank | Effect | Needs |
|---|---|---|---|---|---|
| satchel | Packed Satchel | 1 | 60 | start each run with 3 Healing Draughts; the first potion of each fight costs no turn, at half strength | - |
| pockets | Deeper Pockets | 1 | 80 | +4 bag slots | - |
| quartermaster | Quartermaster | 2 | 120 / 200 | +2 camp points per rank | - |
| cartographer | Cartographer | 1 | 100 | Region Charts every run | - |
| old_hand | Old Hand | 1 | 150 | Tracker's Notes every run | - |
| swift_boots | Swift Boots | 1 | 200 | +1 Homeward Bell charge | - |
| vigor | Vigor of the Line | 2 | 120 / 240 | max HP +1 % per rank | - |
| edge | Edge of the Line | 2 | 120 / 240 | Power +1 % per rank | - |
| quick_study | Quick Study | 2 | 100 / 200 | XP +5 % per rank | - |
| second_breath | Second Breath | 1 | 400 | one resurrect per run, not in Oruvath's fight | Oruvath reached once |
| sp_(class)1, sp_(class)2 | Lost Technique I, II (per class) | 1 each | 150 / 300 | the class's technique spell, learnable from hero level 9 / 17 (1.7) | I before II |
| stormhawk | Stormhawk Companion | 1 | 250 | the Stormhawk pet (Hunter) | - |
| oaths | Oaths | 1 | 0 | Oaths at the start camp (rules 11.5) | first Oruvath kill |

- The account entries cost 2 330 Legacy points; each class adds 450 (techniques), the Hunter 250 more (Stormhawk). At the measured income (about 290-320 an hour over the climb) the account entries take about 7-8 hours and a class's techniques 1.5 more [inference: 4.1 rates], while from level 20 the trees and the Armoury compete for the same points: a real choice.
- Each run buys about one entry; the first run's 195 (with the welcome) buys Packed Satchel and one more.
- Power: against today's full catalogue the set drops crit +1.5 %, the Greater Healing Draught, the extra talent point and the unique items, and keeps HP +2 %, Power +2 %, the free potion and Second Breath at today's values, so its combat power is below today's PALL, whose cap B10 holds [inference: every remaining effect is today's or a split of it]. The uniques (Cache of the Wanderer, Relics of the Deep) are parked: from level 20 the Armoury brings new things into the drop pools.
- From level 20 the hall adds the talent trees (4.3) and the Armoury (4.4).

### 4.3 From level 20: talent trees
- A hero has one open tree until level 20: the tree of its first point (1.8).
- From hero level TREE_OPEN_LEVEL (20) the hero's second and third trees open for TREE_OPEN_COST (300, then 450) Legacy points each, per hero. Points can then go to any open tree; the capstone rule is unchanged (one per hero).
- **Respec** (every point back) only at the start camp, before Set out: RESPEC_COST (30) Legacy points, a fifth to a seventh of a run's income. Free: the first respec after each tree opens. Respec inside a run is retired: the trainer's RESPEC goes, and Boon of Clarity's "next respec free" becomes "your next respec at the start camp is free".
- Why one tree until 20: the owner's "from level 20, unlock different talent trees" [stated] makes trying another play style the reward of level 20. A player who regrets his tree can Retire the hero (1.1). Owner question Q1.

### 4.4 The Armoury: set building
- **What a set is:** three pieces for one talent tree of one class, worn in the Neck, Ring and Trinket slots, so a set never blocks a weapon or armour drop. Each piece has the stats of an uncommon item of the hero's power level in its slot (it levels with the hero; no affix). Two pieces give the set's small bonus, three its play-style bonus. A bonus works while at least SET_TREE_POINTS (10) points are spent in its tree.
- **How many:** one set per tree: nine sets, 27 pieces. The Armoury keeps every piece earned, without limit; it is account-wide, each piece belonging to its class.
- **How it opens:** the Armoury costs ARMOURY_COST (200) Legacy points once, when a hero reaches level 20 [stated: "from about level 20 ... start building sets"].
- **How pieces are earned:** with the Armoury open and the hero at level 20 or more, (a) each dungeon boss killed drops a piece with chance SET_DROP_CHANCE (0.35); (b) Oruvath's kill always drops one; (c) a missing piece can be forged at the Armoury for SET_FORGE_COST (150) Legacy points. A dropped piece is a missing piece of a set of the hero's open trees (uniform), drawn on its own stream `set(z)` = hash(runSeed, "set", z), so no loot draw moves; a piece the Armoury already holds pays SET_DUPLICATE_LEGACY instead. A piece won in a run goes to the Armoury at the run's end, death included.
- **How it enters a run:** at the start camp the player picks up to three banked pieces of the hero's class; they start the run equipped in Neck, Ring and Trinket in place of the kit's. In the run they are gear like any other (swap them for a better drop and back), cannot be sold or discarded, and return to the Armoury when the run ends. Pieces of different sets count only toward their own set.
- **The sets** (names draft, for the originality check; bonuses draft, numbers in 10):

| Class | Tree | Set (draft name) | 2 pieces | 3 pieces |
|---|---|---|---|---|
| Rogue | Bladework | Nightglass Edges | finishers +6 % damage | a finisher spent at 5 combo points gives 1 combo point back |
| Rogue | Shadowcraft | Hushwick Charms | openers +6 % damage | once per fight, falling under 50 % HP gives Stealth (the next action may be an opener) |
| Rogue | Venomcraft | Fenroot Vials | Poison max stacks +1 | when an enemy with 3 or more of your Poison stacks dies, 2 stacks pass to the nearest enemy |
| Mage | Pyromancy | Cinderwake Seals | Burn ticks +8 % | a fire crit adds 1 round to the target's Burn |
| Mage | Rimecraft | Hoarward Seals | Chilled lasts 1 round longer | Frost Lance on a Frozen target costs no mana |
| Mage | Arcanism | Quietstar Loops | Arcane Ward absorbs +8 % | a successful interrupt gives a ward of 6 % max HP |
| Hunter | Beastbond | Packbound Tokens | pet damage +8 % | the pet's first attack of each fight strikes twice |
| Hunter | Marksmanship | Longeye Chits | Keen Shot +6 % | Mark Prey costs no focus and Marked takes +3 % more |
| Hunter | Wildcraft | Briarsnare Knots | Barbed Arrow ticks +8 % | Snare Trap also applies Barbed Arrow to its target |

- **Power budget** (target S1, 7.2): a full set of the default tree, at hero level 25, adds at most SET_POWER_MAX (5 pp) of planner win rate over three uncommon accessories of the same level. Sets change how a tree plays; raw power stays in run drops [source: EXPERIMENTS X1, the Lead's draft shape].
- Pace (inference, not measured): about one dungeon clear a run (a warmed planner, 6.3) and Oruvath won in about a quarter of runs at level 20 give about 0.6 pieces a run, so a set takes about five runs, fewer with forging (target L7).

### 4.5 The Legacy power budget
- The whole Legacy layer (the first set, the opened trees, a full set) may add at most LEGACY_GAP_MAX (30 pp) of planner win rate at hero level 25 over the same hero with nothing bought, and at least LEGACY_GAP_MIN (10 pp), so many runs feel rewarding [stated: BRIEF] (target L5).
- The hero level is not in this budget: a level-25 hero has today's level-60 stats and kit by construction (1.2).

### 4.6 Echoes become Legacy points
- On loading a saved profile: `legacy = echoes + spent` (every Echo ever spent comes back), the catalogue's ranks are cleared except Packed Satchel (kept, so the first-run nudge does not repeat; its 60 not refunded), and the boss flags (reached, kills, first kills per class) are kept. No hero exists yet; each is made at hero select, at level 1.
- Retired from the catalogue: Keen Lineage, Prospector, Heirloom Blade, Trainer's Ledger, Scout's Eye (Pathfinder), Alchemist's Notes, Cache of the Wanderer, Relics of the Deep, Ancestral Insight. Their engine data stays for later use, as D42 and D45 did.
- The first-run welcome (m3-onboarding.md 4.2) pays 60 Legacy points; the Packed Satchel nudge is unchanged.
- Player text: "Echoes" becomes "Legacy points" everywhere; the Hall of Echoes becomes the **Legacy hall** (draft). The lore chat owns the fiction (section 9).

---

## 5. Fit with what exists

### 5.1 The guided first run (M3)
The first run of a profile is its first hero's first run, at level 1. The guided zone keeps its seed (TUTORIAL_SEED 8736), map, beats G1-G17, scripts S1-S4, Gorrak, the corridor, the rescue and the road XP. What changes:
- **Levels:** zone 1 at hero level 1 has band 1 (ZONE_TIER -2, clamped at 1): rings 1-2 at power 1-3, ring 3 at 3-4, below today's 2-10. Scripts play at their node's level (ONB_SCRIPT_LEVEL_MAX 5 no longer binds). **Gorrak** stays one power level above the hero: `clamp(L + ELITE_LEVEL_OFFSET, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX)` with ONB_ELITE_LEVEL_MIN **2** (was 4) and MAX 8, so a hero at power 3-6 meets him at 4-7 (was 8 at power 7). EARLY_DMG_MULT and Z1_DMG_MULT (D147) keep acting by power level, as zone danger does, so in a first run they cover every zone (the first-run cell of 6.3 was measured with them and with ZONE_TIER_DMG on top).
- **XP:** the hero reaches level 2 inside the guided zone (9 minutes against the zone's 10-13, ONB1) and leaves it at level 2. Gorrak's road XP (D153) is hero XP: about 280 at zone 2's hub.
- **Re-measure** (phase 1): ONB2, ONB3, B63 and B65 at the new levels (changes-m3-v2 5.4 and changes-m3-v3 5.3 measured power 1-11 in zone 1). The unguided first run (6.3): zones 1-2 kill 5.0 % of runs (B21 <= 12 % holds), lowest HP 74 % in zone 1.

### 5.2 The lean first run (D152)
Unchanged and still keyed to the profile's first run (`profile.runs` 0): no contracts, Reserve or vision perks; PREP_POINTS_FIRST 5; no Bell in zone 1. A second hero's first run is not a lean run: the player already knows the systems.

### 5.3 Contracts
Unchanged in kind, price, sites, slots and board (D128, D132). Their level is the zone's: CL_c = band + CONTRACT_CL_OFFSET (2.1), set when the hero arrives; the board shows the zone and the pay in hero XP ("about 280 XP"), since the zone's level is not known at the camp. Contract XP keeps no level-difference modifier.

### 5.4 The start camp
Before the board and the supplies, the camp shows the hero: level and XP, the talent window (respec, 4.3), the Armoury loadout (from level 20, 4.4) and a link to the Legacy hall. Set out as today. The camp stays one lean screen [stated: D128]: the hero panel folds to one line ("Level 12 Hunter · Beastbond · Set: none") until opened.

### 5.5 The trainer and spell ranks
As 1.7: learn levels on the 1-25 scale, rank = hero level at training, free training at the start camp, paid training after a level-up in a run. `R.trainerView(state).useful` (D145) then reads false at a run's start, so the hub's trainer line shows only after a level-up. B33 (trainer affordability) is retired.

### 5.6 Gear item levels
Item level = source power level + rarity bonus (rules 8.3), shown on the hero scale; the kit at the hero's power level; CL_MAX 66 and ILVL_MAX 69 (2.1). Item names keep their zone band words (rules 12.5) by zone number, not by item level, since a zone's level no longer matches its band (one line in items.js).

### 5.7 Balance targets to re-band
Fixed cells become **hero cells**: H1 (a profile's first run, nothing bought), H5, H10, H15, H20 and H25, each with the Legacy state a planner campaign has at that level (the order of 5.8 item 7), plus H25-full (everything bought) and H25-none.

| Target | Today | Under Legacy |
|---|---|---|
| B1, B2, B3 win rates (P0, P10, PALL) | bands per bot and profile | bands per hero cell, set from the campaign (L3); H1 keeps "very hard" (planner <= WR_FIRST_RUN_MAX 5 %; measured 1.3 %) |
| B4 choices matter, B5 manual play | P0, PALL | H10 and H25 |
| B6 class band | P0, PALL | H10 and H25 (H1 reported only). Measured at H10: Rogue 89, Mage 20, Hunter 9 % (6.6 reading 3): the first tuning task |
| B7 talent trees | each tree, P0 | H25 with three open trees; H10 the open tree only (report) |
| B8 route styles | five planner styles | adds the two routes, target L2 |
| B10 meta power cap | PALL - P0, 20-45 pp | becomes L5: H25-full - H25-none, 10-30 pp |
| B11-B13 run length, speedrun | 40-50 min; speedrun | B11 re-banded to MIN_RUN_HERO 32-45 min (measured 32-42 without the Camp grind to 60); B12-B13 at H25-full |
| B14, B15 nodes and fights | expedition bands | unchanged (measured 29-32 nodes, 23-26 fights) |
| B16 fight length | rounds by kind | unchanged; the end boss (measured 45-57 rounds) at H10 and H25 |
| B17 tolls at boss | bands | unchanged (measured 109-121) |
| B18 level at boss (share at 60) | >= 90 % | retired; replaced by L1 |
| B19 item level at boss | 55-62 | re-banded: mean equipped item level - the hero's power level at Oruvath, ILVL_GAP band 0-3 (measured +1) |
| B20 level leaving zone z (10z ± 1) | per zone | retired (zones follow the hero) |
| B21 deaths by stage | P0 shares | per hero cell; also feeds L4 |
| B22-B25, B38 | as today | per hero cell; B38 joins L4 |
| B26-B29 boss mechanics bite | PALL | H20 and H25 (the full kit) |
| B30 Echoes per run | 150-260 | Legacy per run, same lines (4.1): LEGACY_RUN 130-230 (measured 135-207) |
| B31 runs to full catalogue | 25-40 runs | hours to the first set (L6) |
| B32 progress curve | campaign blocks of runs | replaced by L1 and L3 (curves by hours) |
| B33 trainer affordability | >= 70 % | retired (free training at the camp) |
| B39-B47 expedition | P0, PALL | H10 and H25 |
| B48-B55, B59-B62 combat and special fights | P0 | H10; B59's zone 1 rows at every cell's zone 1 |
| B56-B58 heat | P0 | H10; read with heat's XP value (3.3) |
| B63 zone 1 care, B65 zone step | P0 | per hero cell; B65 now measures the tier step |
| B64 zone 1 levels per fight | <= 2.1 | retired: the hero's XP pace is L1 |
| ONB1-ONB5 | guided cell | unchanged; re-measured at the guided zone's new levels (5.1) |
| meta-v2 M1-M7, N1 | draft | superseded |

New targets: section 7.2.

### 5.8 The simulator's bots: what the planner must do differently
1. **No zone exit level.** `expExitLevel` (10z) and the under-level penalty (SIM.EXP_UNDER_LEVEL_VALUE) go; the planner leaves by value against the Dimming. The greedy's "leave if L >= 10z - 2" becomes "leave when no reachable node beats GREEDY_STAY_THRESHOLD"; the speedrunner leaves after its target nodes; autoplay's map rule (rules 1.9.9 step 3) explores while a node is worth it, not while L < 10z.
2. **A new risk table, warmed per hero cell.** The X0 tables were learned on the old climb, where dungeons and elites were mostly entered over-levelled. Read with them, the prototype's planner entered no dungeon and 0.3-0.45 elites a run (today 0.4-0.55 and 1.7-2.0). With a table warmed on 300 runs per class at level 10 it entered 0.9-1.1 dungeons and 2.7-4.2 elites a run and earned 11-19 % more XP an hour at levels 5-20; the same table read at levels 1-2 sent it into zones it could not survive (22 % reached Oruvath at level 2) [measured 6.3]. So each hero cell needs its own warm-up before L1-L3, L7 or the set pace are read (6.6 reading 5). **(sim, 2026-11-17)** Done per hero-level band (1-5, 6-10, 11-15, 16-20, 21-25; sim/tables/legacy/, 300 warm-up runs per class each): the planner enters 0.03 / 1.07 / 0.27 / 0.74 / 0.20 dungeons and 1.5 / 3.7 / 3.6 / 2.9 / 0.6 elites a run, runs dying in zones 16.7 / 14.7 / 17.5 / 14.3 / 5.2 %; band 21-25 is a low reading until item 3 is built (the planner rushes once the in-run level reaches 60). Report docs/reports/legacy-calibration-2026-11-17.md.
3. **Hero XP has its own value.** VAL_HERO_XP (value units per 100 hero XP) on top of today's in-run level value: the winner values it at VAL_HERO_XP_WIN, the leveller at VAL_HERO_XP_LEVEL; at level 25 it is valued as the Legacy it converts to. Without it the planner rushes once in-run levels stop paying (the prototype's level-24 cell: 20-minute runs).
4. **Camp:** no grind to level 60; the leveller takes the Camp waves to CAMP_WAVE_MAX, the winner goes to Oruvath.
5. **Talents:** the first point goes to the group's default tree (balance.md 1.3), which stays the open tree; at level 20 the campaign opens the PALL group's default tree second, then the third; the build follows 1.3 within open trees.
6. **Sets:** wear the banked pieces of the default tree's set first, then any.
7. **Campaign v3:** one hero from level 1 for CAMPAIGN_V3_RUNS runs, buying in the order satchel, vigor 1, edge 1, quick_study 1, pockets, cartographer, quartermaster 1, old_hand, vigor 2, edge 2, swift_boots, technique I, quick_study 2, quartermaster 2, second_breath, technique II, and from level 20 the second tree, the Armoury, the third tree; reports hours to each level (L1), the win rate by hero level and by hour (L3), Legacy per hour, sets built (L7).
8. **Recorder:** hero XP per run and its sources, the Legacy lines, set pieces, hero level at start and end.
9. **Two route bots** for L2: winner = planner with HEAT_AVOID_TIME_MULT and VAL_HERO_XP_WIN, no Camp waves; leveller = planner with VAL_HERO_XP_LEVEL and the Camp waves to the cap.

---

## 6. Measured (designer scratch, how the numbers above were made)

### 6.1 Set-up
- **Engine:** origin/main 19719ed; src/ untouched. A scratch copy of src/ and sim/ under sim/out/design-legacy/ (git-ignored): `patch.py` gates a run at the hero's level by an environment value LEG (`mk.sh`, `mk2.sh` build the trees; `proto.sh`, `proto2.sh` and `batch*.sh` run the cells; `read.mjs`, `boss.mjs`, `routes.mjs`, `ech.mjs` read them). With LEG the run starts at power level P with the kit (common, item level P, every slot), every class spell learned and trained to P, the talent points of P (the bot spends them on its default tree), gold 3 V(P); each zone is set at arrival from the player's level and ZONE_TIER, rings [0, 0, 1, 2] spread 2, dungeons +2, contracts P + tier + 2, content up to 66; Oruvath at the player's level + BOSS_TIER, scaled by the enemy curve and (arms T, T2) the HP factor of 2.4; a level costs 10 × xpToNext (about 25 level-equivalents a hero level, inside the curve's 20-41); the planner's zone exit level removed; Camp waves off except in the Camp-farm cells. The `le` field records every XP award divided by xpToNext of the level it was gained at.
- **Cells:** the expedition with the start camp (`--map expedition --prep`, D118), planner (PLANNER_TIME_MULT 3), the X0 tables of D152-D153 (`--risk-in sim/out/pass-v9v10/obs-P0.json --tables-in sim/out/pass-v12/exp/table/planner-P0-exp-prep/risk.json`), `--warmup 0`, seeds 1000-1099, **100 runs per class, 300 per cell**, a profile that has played two runs with nothing bought (contracts on), at power 3, 11, 23, 35 and 48 (hero levels 2, 5, 10, 15, 20); the first run on a fresh profile at power 1 (hero 1); the warmed planner and the route cells as their tables say. Today's game: 300 runs per class on main, P0 and P10. About 16 000 runs in all.
- **Definitions:** win and reach as balance.md; zone deaths as a share of runs; lowest HP as B38 (mean of won non-boss fights, per zone); minutes at manual pace (rules 3); Legacy per run = the run's Echo lines with the old level line removed, the first-kill line removed (a fixed profile pays it on every win) and 20 per hero level gained added.

### 6.2 Today's game (main 19719ed, 300 runs per class)

| Cell | Win | Reach Oruvath | Minutes a run: all / wins (median) / deaths (mean) | XP a run (level-equivalents; capped at 60) | Echoes a run (wins) | Echoes an hour | Item level at Oruvath (level 60) |
|---|---|---|---|---|---|---|---|
| P0, first run | 24.2 % | 80.7 % | 41.0 / 46.0 / 39.4 | 52.5 | 209 (405) | 306 | - |
| P10, later run | 40.9 % | 87.1 % | 40.5 / 44.5 / 37.8 | 53.8 | 259 (413) | 383 | 48.8 (rare or epic 47 %) |

### 6.3 Zones at the hero's level: four arms

| Arm | ZONE_TIER (power) | Damage by zone | Oruvath |
|---|---|---|---|
| R | -2 .. +3 | - | +5, enemy curve |
| F | 0 (all zones at the hero's level) | - | +4, enemy curve |
| T | -2 .. +3 | × 1.4 .. 1.9 | +5, enemy curve × HP factor |
| **T2 (proposal)** | -2 .. +3 | × 1.25 .. 1.50 | +5, enemy curve × HP factor |

Arm R (levels only):

| Hero level (power) | Win (Rogue / Mage / Hunter) | Reach | Died in zones | Lowest HP, zone 1 → 6 | Minutes | XP a run (LE) |
|---|---|---|---|---|---|---|
| 2 (3) | 0 % | 99.0 % | 0.7 % | 91 → 79 % | 38.1 | 73.4 |
| 5 (11) | 0 % | 99.7 % | 0.3 % | 90 → 84 % | 39.3 | 66.4 |
| 10 (23) | 19.7 % (59 / 0 / 0) | 100 % | 0 % | 84 → 76 % | 38.8 | 60.9 |
| 15 (35) | 14.3 % (41 / 2 / 0) | 94.7 % | 5.3 % | 75 → 76 % | 38.6 | 57.9 |
| 20 (48) | 17.0 % (25 / 17 / 9) | 99.3 % | 0.7 % | 84 → 84 % | 35.3 | 51.3 |

Arm F at level 10: lowest HP 78 → 81 % (no rise), win 28.0 % (84 / 0 / 0). Arm T: win 10.0 / 27.7 / 21.0 / 21.7 % at levels 5 / 10 / 15 / 20, but runs that die in zones 2.6 / 27.7 / 53.0 / 25.7 %: too deadly in the middle.

**Arm T2 (the proposal):**

| Hero level (power) | Win (Rogue / Mage / Hunter) | Reach | Died in zone 1 / 2 / 3 / 4 / 5 / 6 (% of runs) | Lowest HP, zones 1-6 | Wins at Oruvath (rounds) | Minutes | XP a run (LE) | Legacy a run / an hour |
|---|---|---|---|---|---|---|---|---|
| 1, first run (1) | 1.3 % (0 / 4 / 0) | 76.0 % | 3.3 / 1.7 / 2.7 / 7.0 / 7.3 / 2.0 | 74 / 76 / 70 / 70 / 69 / 68 | 1.8 % (54) | 33.1 | 69.8 | 135 / 244 |
| 2 (3) | 5.3 % (2 / 12 / 2) | 86.0 % | 0 / 1.3 / 1.3 / 3.3 / 4.7 / 3.3 | 89 / 78 / 74 / 73 / 71 / 71 | 6.2 % (55) | 36.3 | 69.2 | 153 / 253 |
| 5 (11) | 10.7 % (10 / 3 / 19) | 99.7 % | 0 / 0 / 0 / 0 / 0 / 0.3 | 88 / 83 / 83 / 82 / 81 / 78 | 10.7 % (57) | 39.1 | 66.0 | 168 / 258 |
| 10 (23) | 39.3 % (89 / 20 / 9) | 92.3 % | 0 / 0.3 / 0 / 0 / 3.7 / 3.7 | 79 / 76 / 73 / 71 / 70 / 67 | 42.6 % (50) | 37.9 | 59.1 | 207 / 327 |
| 15 (35) | 34.0 % (65 / 36 / 1) | 75.3 % | 0 / 1.3 / 1.0 / 5.0 / 8.7 / 8.7 | 70 / 66 / 65 / 65 / 68 / 68 | 45.1 % (47) | 35.8 | 52.8 | 182 / 305 |
| 20 (48) | 25.0 % (21 / 38 / 16) | 88.0 % | 0 / 1.0 / 1.3 / 2.7 / 3.7 / 3.3 | 81 / 79 / 79 / 82 / 80 / 78 | 28.4 % (45) | 34.1 | 49.4 | 173 / 306 |

Item level at Oruvath in T2: the hero's power level + 0.9 to 1.3 (today 11 under), rare or epic in 48 % (first run) to 67 % of slots. Nodes a run 29-32, fights 23-26.

**T2 with a warmed risk table** (the planner's own table from 300 warm-up runs per class at level 10, `--warmup 300`, no X0 tables; then the same table, `--risk-in`, at the other levels):

| Hero level | Win (Rogue / Mage / Hunter) | Reach | Died in zones | Lowest HP, zone 1 → 6 | Dungeons / elites a run | Minutes | XP a run (LE) | Hero XP an hour (today's tables) | Legacy an hour |
|---|---|---|---|---|---|---|---|---|---|
| 5 | 21.0 % | 92.0 % | 8.0 % | 80 → 69 % | - | 41.5 | 83.3 | 12 035 (10 127) | 301 |
| 10 (its own warm-up) | 31.7 % (86 / 6 / 3) | 85.7 % | 14.3 % | 73 → 59 % | 1.0 / 3.4 | 41.1 | 76.6 | 11 168 (9 356) | 316 |
| 15 | 27.3 % | 57.7 % | 42.3 % | 63 → 65 % | - | 34.7 | 60.8 | 10 523 (8 841) | 301 |
| 20 | 26.0 % | 80.3 % | 19.7 % | 75 → 72 % | - | 32.2 | 52.0 | 9 683 (8 704) | 342 |

At levels 1 and 2 the level-10 table failed (reach 14 % and 22 %: it sends a young hero into fights it cannot survive), so those cells need their own warm-up; the curve of 1.4 takes their rate from today's tables.

### 6.4 The two routes (T2, hero levels 10 and 20)

| Route (planner) | Win | Hero XP an hour | Legacy an hour | Minutes a run | Tolls at Oruvath |
|---|---|---|---|---|---|
| Winner (heat-avoid time weight) | 37.7 / 25.0 % | 9 271 / 8 527 | 345 / 318 | 35.5 / 31.8 | 111 / 101 |
| Default planner | 39.3 / 25.0 % | 9 356 / 8 704 | 327 / 306 | 37.9 / 34.1 | 120 / 109 |
| Heat-seek time weight | 34.0 / 21.3 % | 9 424 / 8 764 | 306 / 281 | 36.6 / 33.4 | 137 / 131 |
| Steep road (every zone and Oruvath +2 power levels) | 15.7 / 0.3 % | 9 893 / 8 671 | 271 / 223 | 35.4 / 31.9 | 117 / 108 |
| Camp farm, 10 waves | 22.0 / 10.0 % | 9 907 / 9 420 | 255 / 242 | 43.1 / 38.3 | 141 / 131 |
| **Camp farm, 10 waves at double XP (proposal: leveller)** | 19.3 / 7.0 % | 11 565 / 11 088 | 261 / 248 | 43.2 / 38.3 | 141 / 130 |

With the warmed table (6.3), levels 10 and 20:

| Route (planner, warmed table) | Win | Hero XP an hour | Legacy an hour | Minutes a run | Tolls at Oruvath |
|---|---|---|---|---|---|
| Winner (heat-avoid time weight) | 34.0 / 25.0 % | 10 990 / 9 664 | 333 / 347 | 39.0 / 30.9 | 121 / 98 |
| **Leveller (Camp farm, double XP)** | 19.0 / 5.7 % | 12 874 / 11 883 | 279 / 271 | 45.7 / 36.1 | 148 / 125 |

L2 on the proposal, today's tables / warmed: (a) 1.25 / 1.30 and 1.17 / 1.23 (>= 1.15, pass); (b) 1.32 / 1.28 and 1.19 / 1.28 (>= 1.10, pass), win gap 18.4 / 18.0 and 15.0 / 19.3 pp (>= 5, pass); (c) pass. 4 and 15 of 300 runs died in the Camp waves (today's tables).

### 6.5 Legacy income
From the T2 cells (6.3): 135 a run in the first run (plus the 60 welcome), 153-207 later, 244-327 an hour (301-347 with the warmed table); the level line (20 a hero level, 1.7-2.5 levels a run in the prototype) is 20-33 % of it. Today's Echoes: 209-259 a run, 306-383 an hour (6.2): Legacy income is lower early, because a young hero wins less.

### 6.6 Readings
1. **Gear tracks the zones.** At the hero's level the drops come at about his level (item level at Oruvath = power level + 1; today 11 under), so levels alone leave the zones easy (R: lowest HP 75-91 %, almost no deaths). The tier's damage (T2) brings zone deaths back where today has them (first run: 24 % of runs die in zones, today 19 %) and puts most of them in zones 4-6.
2. **Oruvath needs the HP factor.** With the enemy curve alone his fights ran into Final Dark in phase 2 for every class below level 10 and for the Mage and the Hunter until 20. With it, Oruvath is won at about 1 in 10 of the fights reached at level 5, 4 in 10 at 10-15, 3 in 10 at 20.
3. **Class spread is the first tuning task.** At level 10 the Rogue wins 89 %, the Mage 20 %, the Hunter 9 %; at 15 the Hunter 1 %. The Rogue's kit is front-loaded on the new scale (Whirling Edges at 9), the Mage's and the Hunter's power comes at 15-20 (Pyre Comet 16, Starlance Barrage 20; Savage Order 15, Rapid Volley 17, Heartseeker Shot 20). Levers, in order: the per-class learn levels of 1.7 (the new scale is free to set), the Hunter's tier damage (it dies in zones 4-6 at 15: 44 % of runs), then class numbers. **(sim, 2026-11-17)** Re-measured with the band tables (200 runs per class per band): Rogue / Mage / Hunter 8.5 / 4.0 / 16.5 % (H1-5), 89.0 / 13.5 / 27.0 % (H6-10), 77.0 / 14.5 / 1.0 % (H11-15), 38.0 / 41.5 / 11.0 % (H16-20); B6 fails in every band. Below about hero level 16 Oruvath's fight is a damage race against Final Dark; Whirling Edges with Venomcraft's Toxic Coating is the Rogue's lead (with its other two trees the Rogue wins 0 % to hero 12); the learn levels of 1.7 move bands 1-2 but not the Hunter's gap from hero level 9, which needs class numbers. Report docs/reports/legacy-calibration-2026-11-17.md section 5.
4. **XP per run falls with level** (70 to 49 level-equivalents) and the planner's runs shorten (39 to 34 minutes); the curve of 1.4 uses the measured rate per level, so it is not a guess.
5. **Two planners bracket the player.** On today's tables the planner is dungeon-shy (no dungeon, few elites; 5.8 item 2); warmed at level 10 it clears about one dungeon and three elites a run, earns 11-19 % more XP an hour, dies more in zones and wins about as often. The XP curve sits between them (XP_RATE_ADJ, 1.4), the routes pass L2 on both, and the warm-up per hero cell is the first sim task of phase 1.
6. **Not measured:** level 25 (the planner at power 58 rushed once level 60 ended its XP value: 20-minute runs, 1 % wins; 5.8 item 3), Legacy purchases, opened trees and sets (L5, L6, S1, L7), a campaign (each cell holds the level fixed), a human player (B5), and the guided zone at its new levels (5.1).
7. **Limits:** 100 runs per class (about ±5-9 points per class, ±3-5 pooled); the in-run level cost is a stand-in; one seed range.

---

## 7. Build plan

### 7.1 Phases (smallest playable slice first)

| Phase | What | Who | Done when |
|---|---|---|---|
| 1 Hero and scaled zones | Profile v3 with one hero per class (level, XP, bar); POWER_OF_LEVEL and shown levels; hero XP and HERO_XP; zones set at arrival (ZONE_TIER, ZONE_TIER_DMG, rings, dungeon and contract offsets, CL_MAX); the Camp level, CAMP_WAVE_MAX and CAMP_WAVE_XP_MULT; Oruvath's scaling and HP factor; run start (kit, free training, gold); death keeps the hero; XP after 25 counted; Echoes shown as Legacy points with the new level line; the guided zone at its new levels; hero select, the hero XP bar and 1-25 levels in the UI. Sim: no exit level, a warmed risk table, VAL_HERO_XP, hero cells, campaign v3 (levels only) | Engineer, UI, Sim, QA | A fresh profile plays five runs in a row with one hero and the level survives runs and reloads; every level on screen is 1-27; L1 and L4 pass on the campaign and the hero cells; B6 at H10 within its band (1.7 learn levels first); the guided run passes ONB2, ONB3, B63 and B65 at its new levels; qa green |
| 2 The Legacy hall | The lines of 4.1, the first set of 4.2 with its needs, the migration of 4.6, the first-run nudge in Legacy points | Engineer, UI, Content, Sim | A saved profile migrates (Echoes in = Legacy points out, Satchel kept); the hall sells exactly the 13 entries; Legacy per run in LEGACY_RUN; L6 measured |
| 3 Talents on the hero | Talents kept on the hero; the first point picks the open tree; respec at the camp for RESPEC_COST; the trainer's RESPEC and Boon of Clarity changed | Engineer, UI | A hero's talents survive runs; respec works only at the camp; the campaign's B7 report at H10 |
| 4 Level 20: trees | TREE_OPEN_COST per hero; points across open trees; the free respec after an opening | Engineer, UI, Sim | B7 passes at H25 with three open trees; L5 measured with trees |
| 5 The Armoury | ARMOURY_COST, the bank, drops (stream `set`), forging, duplicates, the camp loadout; content: nine sets (names, texts, bonuses within 4.4) | Content, Engineer, UI, Sim | S1 passes for every class's default tree; L7 passes |
| 6 Balance pass | The two routes (L2) on the campaign, the re-banded targets of 5.7, L3 and L5 tuned; the owner plays five runs in a row | Sim, Designer, Lead, owner | Every L target and the re-banded P1 targets pass; the owner has played five runs (M3's done-when) |

Order inside phase 1: engine (hero and zones), then sim (warmed tables, campaign v3 and the hero cells measure L1, L4 and B6 before UI work), then UI, then QA. Phases 2-5 can overlap once phase 1 is in. Every new rule sits behind a `C.GATES` switch until its measure passes, as D152 did.

### 7.2 New targets (proposed; numbers in 10)

| ID | Pri | Metric | Target | Measured (6) |
|---|---|---|---|---|
| L1 | P1 | Hours of play (manual pace) to hero level 25, planner campaign, median; the level at the end of the first run, median | HOURS_TO_MAX 6-8; FIRST_RUN_LEVEL 4-5 | 7.6 (today's tables) and about 6.5 (warmed); 4.4 [inference: 1.4 chains the cells]; the campaign checks it |
| L2 | P1 | The two routes (3.4) at H10 and H20 | (a) LEVEL_ROUTE_XP_MIN; (b) WIN_ROUTE_LEGACY_MIN and WIN_ROUTE_GAP_MIN; (c) no route leads on both | pass on both tables (6.4) |
| L3 | P1 | Hero level at the first win, planner campaign, median; win rate per hero cell non-decreasing from H5 to H25 within CURVE_DIP_PP; H1 under WR_FIRST_RUN_MAX; H25-full in WR_H25 | FIRST_WIN_LEVEL 8-13; WR_FIRST_RUN_MAX 5 %; WR_H25 40-60 % | first win about run 4, level 10-12 [inference: the cell rates chained over 1.4's runs]; H1 1.3 %; the curve fails (39 → 34 → 25 % from H10 to H20, the class spread) |
| L4 | P1 | The rise within a run, planner, H10 and H20: runs dying in zones 5-6 >= RISE_DEATH_RATIO × zones 1-2 (or more than RISE_DEATH_FLOOR); mean lowest HP falls from zone 1 to zone 6 by >= RISE_HP_MIN | RISE_DEATH_RATIO 2, RISE_DEATH_FLOOR 2 %; RISE_HP_MIN 5 points | deaths pass (7.4 / 0.3 %, 7.0 / 1.0 %); HP passes at H10 (12), fails at H20 (3) |
| L5 | P1 | Legacy power cap: planner H25-full - H25-none | LEGACY_GAP_MIN - LEGACY_GAP_MAX (10-30 pp) | not measured |
| L6 | P2 | Hours to the first set's account entries, campaign median | FIRST_SET_HOURS 7-12 | about 7-8 [inference: 4.1 income] |
| L7 | P2 | Runs from level 20 to the first full set, campaign median (drops and forging) | SET_RUNS_MAX 8 | about 5 [inference: 4.4] |
| S1 | P2 | Set power: H25 with the default tree's full set - with uncommon accessories, planner | <= SET_POWER_MAX (5 pp) | not measured |

---

## 8. Open questions for the owner (the team builds on the default)

| # | Question | Default |
|---|---|---|
| Q1 | Before level 20, is a hero's talent tree fixed to the tree of its first point (level 5), so that opening other trees is the level-20 reward? | Yes. Respec inside the open tree is allowed at the camp; a player who regrets the tree can Retire the hero |
| Q2 | Between runs the hero keeps level, XP, talents, trained spells and Armoury set pieces, and nothing else: all gear found in a run, gold and potions are lost. Right? | Yes: run gear is the run's variance and decisions; sets are the kept gear |
| Q3 | When should a good player first beat Oruvath? | Around the fourth run, near level 10-12, about two and a half hours in; the first runs stay very hard (1-10 % below level 5) |
| Q4 | Is a grind at the Camp the right levelling route (up to 10 waves at double XP before Oruvath, each making him stronger)? | Yes: it is the only lever measured that makes levelling pay (+25-30 % XP an hour against the winning route); the alternatives did not (3.3) |
| Q5 | Legacy hall upgrades are shared by all three heroes; talent points and open trees belong to each hero; set pieces belong to their class. Right? | Yes |

---

## 9. Notes for other roles
- **Lore chat:** docs/lore/world.md 6 says each Wayfarer is a new person and Echoes pass to the next one. With persistent heroes the Bell carries its fallen bearer home alive and remembers (as meta-v2.md 3.4 proposed); Legacy is the owner's word [stated]. The Legacy hall, the Armoury, the Wayfarer's kit and the nine set names need the originality check (style.md 5).
- **Content:** set texts and bonus lines (4.4); the kit's item names for the eight new slots; "Retire hero", the first-point tree line, the free-training line, the respec and Armoury screens; level-up lines on the hero scale.
- **UI:** hero select (1.1), the hero panel at the camp (5.4), the XP bar in hero XP, every level through `shownLevel`, the Legacy hall and the Armoury screens, the Camp's wave count and its Ascendancy cost, the summary's level progress and Legacy lines.
- **QA:** levels on screen never below 1 or above 27; a hero's state survives reloads; the migration of a saved profile; the guided run at its new levels.

---

## 10. Constant table

| Constant | Value | Unit |
|---|---|---|
| HEROES_PER_CLASS | 1 | heroes per class per profile (1.1) |
| HERO_MAX_LEVEL | 25 | hero levels (1.2) |
| POWER_OF_LEVEL | 1, 3, 6, 8, 11, 13, 16, 18, 21, 23, 26, 28, 31, 33, 35, 38, 40, 43, 45, 48, 50, 53, 55, 58, 60 | power level (engine level, 1-60) of hero levels 1-25: round(1 + (H - 1) × 59 / 24) (1.2) |
| HERO_XP_UNIT | 100 | hero XP per level-equivalent (1.3) |
| HERO_XP | 2000, 2000, 2050, 2100, 2150, 2250, 2350, 2450, 2550, 2650, 2750, 2850, 2900, 3000, 3100, 3200, 3300, 3400, 3500, 3600, 3750, 3850, 3950, 4100 | hero XP from level H to H + 1, H = 1-24; 69 800 in all (1.4) |
| HERO_XP_AT_MAX | 4100 | hero XP past level 25 that pays LEGACY_PER_LEVEL (= HERO_XP[24]) (1.3) |
| MIN_PER_LEVEL_BASE / MIN_PER_LEVEL_STEP | 8.125 / 0.75 | minutes of play per level, m(H) = base + step × H, for a player between the two planners (design target of HERO_XP) (1.4) |
| XP_RATE_MEASURED | level 1: 211, 2: 191, 5: 169, 10: 156, 15: 148, 20 and above: 145 | hero XP per minute, planner on today's risk tables, interpolated between levels (the measure behind HERO_XP) (1.4, 6.3) |
| XP_RATE_ADJ | 1.08 | × XP_RATE_MEASURED in HERO_XP: the middle of the planner on today's tables (× 1) and the warmed planner (× 1.17) (1.4, 6.3) |
| START_GOLD_V | 3 | × V(power level), gold at Set out (was START_GOLD 50 copper) (1.6) |
| KIT_RARITY / KIT_SLOTS | common / all ten | the Wayfarer's kit, item level = the hero's power level (1.6) |
| SPELL.id.heroLvl | table of 1.7 | hero level a spell is learnable (1.7) |
| TALENT_POINTS | levels 1-4: 0; 5-25: 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 18, 20, 21, 22, 23, 25, 26 | talent points by hero level (1.8) |
| ZONE_TIER | -2, -1, 0, +1, +2, +3 | power levels added to zones 1-6's band at arrival (2.1, 2.2) |
| ZONE_TIER_DMG | 1.25, 1.30, 1.35, 1.40, 1.45, 1.50 | × damage of template enemies in zones 1-6; the Camp uses zone 6's (2.2) |
| RING_CL_BASE | 0, 0, 1, 2 | levels above the band, rings 0-3 (was 0, 1, 4, 7) (2.1) |
| RING_CL_SPREAD | 2 | levels (was 3) (2.1) |
| DUNGEON_LEVEL_OFFSET | 2 | levels above the band (was 4) (2.1) |
| CONTRACT_CL_OFFSET | 2 | levels above the band (was 8) (2.1, 5.3) |
| CL_MAX | 66 | highest content level (was MAX_LEVEL 60) (2.1) |
| ILVL_MAX | 69 | item level (was 63) (2.1, 5.6) |
| CAMP_TIER | 3 | power levels above the hero at the Camp (2.4) |
| CAMP_WAVE_MAX | 10 | Camp waves per run (2.3) |
| CAMP_WAVE_XP_MULT | 2 | × XP of a Camp wave's kills and bonus (2.3) |
| BOSS_TIER | 5 | power levels of Oruvath above the hero (2.4) |
| BOSS_REF_LEVEL | 62 | today's BOSS_LEVEL, the level his numbers are tuned at (2.4) |
| BOSS_HP_LEVEL_BASE / BOSS_HP_LEVEL_STEP | 0.40 / 0.024 | Oruvath's and the Shards' HP × min(1, base + step × hero level) (2.4; replaced by BOSS_HP_LEVEL under 2.4.1) |
| BOSS_HP_LEVEL (2.4.1, draft) | 0.50, 0.53, 0.57, 0.61, 0.71, 0.84, 0.87, 0.90, 1.00, 1.12, 1.10, 1.07, 1.07, 1.07, 1.05, 1.03, 1.02, 1.01, 0.99, 0.96, 0.94, 0.94, 0.92, 0.89, 0.89 | × Oruvath's and the Shards' HP (after hpScale(LB)) by the hero's level at FIGHT_BOSS, H = 1-25 |
| BOSS_DMG_LEVEL_BASE / BOSS_DMG_LEVEL_STEP / BOSS_DMG_LEVEL_MIN / BOSS_DMG_LEVEL_MAX (2.4.1, draft) | 1.40 / 0.021 / 0.90 / 1.20 | × every damage of Oruvath's fight: max(MIN, min(MAX, BASE - STEP × H)) |
| dmgScale0 (2.4.1, draft) | ENEMY_DMG_BASE 4, ENEMY_DMG_PER_LEVEL 2.6, ZONE_DANGER_STEP 0.45, ZONE_DANGER_FROM 20 (rules 13), at LB over the same at BOSS_REF_LEVEL; no EARLY_DMG_MULT or Z1_DMG_MULT | ratio, replaces dmgScale(LB) in Oruvath's fight |
| SHARD_HP_LEVEL_LOW / SHARD_HP_RAMP_FROM / SHARD_HP_RAMP_TO (2.4.1, draft) | 0.5 / 17 / 23 | × the Shards' HP: LOW up to hero level RAMP_FROM, linear to 1 at RAMP_TO |
| FINAL_DARK_LEVEL_STEP / FINAL_DARK_ROUND_MAX (2.4.1, draft) | 1.4 / 76 | rounds per hero level under HERO_MAX_LEVEL added to BOSS_ENRAGE_ROUND (round to nearest), at most MAX: 76 up to H11, 57 at H25 |
| AUTO_DOT_BOSS (2.4.1, draft; rules 7.9) | on | autoplay casts Living Flame and Barbed Arrow on a boss at any HP and never on a Dimming Shard |
| HUNTER_CAMP_PET_SLOT (2.4.1, draft; balance.md 1.2) | on | the sim's Camp bar keeps the Hunter's Mend Companion |
| SPELL changes (2.4.1, draft) | frost_lance l 1.77, p 0.97 (was 1.54, 0.84); pyre_comet lvl 21, hero 9 (was 38, hero 16); barbed_arrow dot l 0.495, p 0.20 (was 0.45, 0.18); field_dressing healPct 0.18 (was 0.12) | content values |
| GATES.oruvathLegacy (2.4.1, draft) | off until accepted | engine switch for every 2.4.1 rule |
| ONB_ELITE_LEVEL_MIN | 2 | Gorrak's lowest power level (was 4) (5.1) |
| LEGACY_PER_LEVEL | 20 | Legacy points per hero level gained, and per HERO_XP_AT_MAX past 25 (4.1) |
| LEGACY lines | as ECHO_PER_ZONE 7.5, ECHO_PER_DUNGEON 8, ECHO_PER_ELITE 3, ECHO_PER_RARE 6, ECHO_PER_QUEST 1, ECHO_CONTRACT_MULT 3, ECHO_PER_HEAT_FIGHT 1, ECHO_BOSS_REACHED 20, ECHO_BOSS_PHASE 12, ECHO_BOSS_KILL 120, ECHO_SPEED_BONUS 40, ECHO_FIRST_KILL_CLASS 100, PREP_ECHO_PER_POINT 2, ONB_WELCOME_ECHOES 60, OATH_ECHO_BONUS 0.25 (renamed LEGACY_*) | Legacy points (4.1) |
| LEGACY_COST | satchel 60; pockets 80; quartermaster 120 / 200; cartographer 100; old_hand 150; swift_boots 200; vigor 120 / 240; edge 120 / 240; quick_study 100 / 200; second_breath 400; sp_(class)1 150, sp_(class)2 300; stormhawk 250; oaths 0 | Legacy points per rank (4.2) |
| LEGACY_EFFECT | vigor +0.01 max HP; edge +0.01 Power; quick_study +0.05 XP (per rank); quartermaster +2 camp points per rank | per rank (4.2) |
| TECH_LEVELS | 9 / 17 | hero levels from which Lost Technique I / II spells are learnable (1.7, 4.2) |
| TREE_OPEN_LEVEL | 20 | hero level (4.3) |
| TREE_OPEN_COST | 300 / 450 | Legacy points for the second / third tree, per hero (4.3) |
| RESPEC_COST | 30 | Legacy points per respec at the start camp (4.3) |
| ARMOURY_COST | 200 | Legacy points, once per account (4.4) |
| SET_COUNT / SET_PIECES | 9 / 3 | sets (one per tree) / pieces per set (4.4) |
| SET_SLOTS | neck, ring, trinket | slots a set piece is worn in (4.4) |
| SET_PIECE_RARITY | uncommon | stats of a set piece, at the hero's power level, no affix (4.4) |
| SET_TREE_POINTS | 10 | points in its tree for a set bonus to work (4.4) |
| SET_DROP_CHANCE | 0.35 | per dungeon boss killed, hero level 20+, Armoury open (4.4) |
| SET_FORGE_COST | 150 | Legacy points per missing piece (4.4) |
| SET_DUPLICATE_LEGACY | 40 | Legacy points for a piece already held (4.4) |
| SET bonuses | 2 pieces: finishers +0.06, openers +0.06, Poison max stacks +1, Burn ticks +0.08, Chilled +1 round, Arcane Ward +0.08, pet damage +0.08, Keen Shot +0.06, Barbed Arrow ticks +0.08; 3 pieces as the table of 4.4 (1 combo point back at 5; Stealth under 0.50 HP once a fight; 2 Poison stacks pass at 3+; +1 Burn round on a fire crit; free Frost Lance on Frozen; ward 0.06 max HP on an interrupt; the pet's first attack twice; Mark Prey 0 focus and Marked +0.03) | draft (4.4) |
| VAL_HERO_XP_WIN / VAL_HERO_XP_LEVEL | to be set by the sim (start 40 / 120) | value units per 100 hero XP, route bots (5.8) [assumption] |
| CAMPAIGN_V3_RUNS | 20 | runs per campaign v3 (5.8) |
| HOURS_TO_MAX | 6-8 | hours (L1) |
| FIRST_RUN_LEVEL | 4-5 | hero level at the end of the first run, median (L1) |
| LEVEL_ROUTE_XP_MIN | 1.15 | × the winner's hero XP per hour (L2) |
| WIN_ROUTE_LEGACY_MIN | 1.10 | × the leveller's Legacy points per hour (L2) |
| WIN_ROUTE_GAP_MIN | 0.05 | win-rate difference, winner - leveller (L2) |
| FIRST_WIN_LEVEL | 8-13 | hero level at the first win, campaign median (L3) |
| WR_FIRST_RUN_MAX | 0.05 | planner win rate at H1 (L3) |
| WR_H25 | 0.40-0.60 | planner win rate at H25-full (L3) |
| RISE_DEATH_RATIO / RISE_DEATH_FLOOR | 2 / 0.02 | zones 5-6 against zones 1-2, share of runs (L4) |
| RISE_HP_MIN | 0.05 | mean lowest HP, zone 1 - zone 6 (L4) |
| LEGACY_GAP_MIN / LEGACY_GAP_MAX | 0.10 / 0.30 | win-rate difference, H25-full - H25-none (L5) |
| FIRST_SET_HOURS | 7-12 | hours (L6) |
| SET_RUNS_MAX | 8 | runs from level 20 to the first full set (L7) |
| SET_POWER_MAX | 0.05 | win-rate difference (S1) |
| MIN_RUN_HERO | 32-45 | minutes, B11 re-banded (5.7) |
| ILVL_GAP | 0-3 | equipped item level - power level at Oruvath, B19 re-banded (5.7) |
| LEGACY_RUN | 130-230 | Legacy points a run, planner, B30 re-banded (5.7) |
