# Spec changes M2b v15: Warden Belk's long fight, the rush path (B12), Mawgrim's long fight

Owner: Game Designer (balance), 2026-11-12. For: Content Designer and Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), UI/UX Engineer, Lead. **Status: draft** (not approved). Outcomes by the decision rules logged as D126 (report 2026-11-12c): row 1 stays, row 2 off, row 3 the v11 policy reads B12, row 4 applies (Constants, last column).

Input: the v13 and v14 measures [source: docs/reports/balance-2026-11-12.md, -12b.md; docs/handoffs/sim-2026-11-12.md, -12b.md]; D105-D118 (D114 logs the Belk miss for the next combat pass, D116 logs B12 as a known miss, D118 makes `--map expedition --prep` the main cell); BACKLOG B12 row; rules.md 7.6 (soft enrage), 12.4, 13; expedition.md 7.1; balance.md B11, B12. Run records read: sim/out/pass-v14 and pass-v13 (main d7b2776 / 30d565a), with scratch fight replays (below). Every other expected effect is marked [inference] or unmeasured.

Scope: one content value for the zone 1 dungeon boss, one rusher reward on Roads, the bot that reads B12, and one gated content value for the zone 2 dungeon boss. Nothing else changes. When the Engineer builds this package, every changed line in rules.md, expedition.md, balance.md and the content tables is marked "(M2b v15)" in the same commit.

## Why Warden Belk kills the opener line (B60 expedition, 2 of 30)
Both deaths (seed 1040, Rogue and Hunter, level 8 against Belk at level 7, 734 HP) were replayed from the onebutton runs' action logs with the opener line, autoplay and the one-button policy (scratch script, same snapshot as `replayThink`):
- **The Deathblow is not the cause.** Both lines answered Ledger-Breaker (Disrupt or the pet's taunt); neither was MAIMED.
- **Rogue:** the fight runs 25 rounds and the Rogue dies at round 25 on every line (opener, autoplay, one button), no potions in the bag. The Rogue deals about 24 per round to a brute (Belk at round 24: 13 HP left at 0.8 × HP), and from round 20 the soft enrage (FIGHT_SOFT_ENRAGE_ROUND 20, +0.25 per round) lifts Belk's hits to 39-59. It is a damage race, not a choice the opener got wrong.
- **Hunter:** the opener sends the pet in the engage round; the pet takes the Deathblow and dies in round 11; the Hunter fights on alone and dies in round 24 after two potions. Autoplay (Lay Trap) wins the same fight in 16 rounds.

**The pattern is fight length, and it holds for autoplay too:** planner Rogue against Belk lasts **21.2 rounds with 18.2 % deaths** on classic P0 (n 110) and **24.1 rounds, 33.3 %** on the expedition (n 9), against 10.5-12.1 rounds and 0 % for the same Rogue against Mawgrim and Aldrec; Hunter and Mage meet Belk in 14-16 rounds with 0-2 % deaths [source: pass-v14 classic/planner-P0 and exp/planner-P0-exp-prep, per-boss fight records]. At levels 7-9 the Rogue's kit is thin, its dungeon-boss fights start without STEALTH and pay ENGAGE_DMG_COMP (D49), and Belk has DUNGEON_BOSS_HP_MULT 5.6 × 1.05. Fights past round 20 are where the soft enrage kills.

## Change table
Type: **content** = content table value; **rule** = engine code; **number** = constant; **sim** = bot or measure; **target** = balance target.

| # | Rule or constant (spec section) | Old | New | Target | Expected effect, with basis | Type |
|---|---|---|---|---|---|---|
| 1 | **Warden Belk of Harrow** `z1_belk.hpMult` (content enemies.js; rules 12.4 dungeon boss) | 1.05 | **0.90** (734 -> 629 HP at level 7) | B60 expedition dungeon boss <= 5 %; B59 (c) >= 70 % | Replays of all 7 Belk fights of the v14 expedition think cell at × 0.857 HP: opener-line deaths **2 -> 1** (the Hunter's fight is won in 17 rounds; the Rogue's 1040 fight stays lost, autoplay loses it too), autoplay 1 -> 1, one button **7 -> 7**; opener fight length 20.6 -> 17.4 rounds. Classic think cell (10 Belk fights): opener 0 -> 0, one button 7 -> 6 [measured: scratch replays, same snapshots]. So B60 expedition dungeon bosses 6.7 -> **3.3 %** (1 of 30) on the v14 seeds; B59 (c) pooled one-button dungeon-boss deaths fall at most about 1 pp (classic 80.0 %, Belk 88 of 962 fights) [inference from the replays]. Planner Rogue against Belk: fights under round 20, deaths 18.2 % -> under 10 % on classic [inference; unmeasured]. Alternatives replayed and not taken: damage × 0.905 alone (opener 2 -> 2), HP and damage × 0.905 (opener 2 -> 1, one button 6 of 10 on classic as row 1, but it also softens the Deathblow) | content |
| 2 | **Swift passage** (expedition.md 7.1 Roads, new; rules 1.9 XP): `TAKE_ROAD` when the zone time (tolls since arriving at the zone's hub, the recorder's zone `time`) is <= ROAD_SWIFT_TOLLS grants ROAD_SWIFT_XP_FRAC × xpToNext(L) XP (no diffMod; once per zone; not by the Homeward Bell). The hub and the Road node show "Swift passage: leave by a Road within N tolls for +XP" and the tolls left | none | **ROAD_SWIFT_TOLLS 15, ROAD_SWIFT_XP_FRAC 0.75** | B12 <= 30.0 min from SET_OUT and <= 0.70 × B11; B11 40-50; planner P0 >= 20 %, PALL >= 50 % | **Why XP:** the rush path is XP-bound, not map-bound. Speedrunner wins (v11 policy, PALL) take 27.6 fights and 218 rounds to 32.3 min from run start; planner PALL wins 28.3 fights and 210 rounds to 33.9 min: the speedrunner saves nodes (4 per zone against 5-6) and tolls (14-17 per zone against 18), but it needs the same fights to reach level 60 [source: pass-v13 exp speedrunner-PALL-v11-exp-prep and planner-PALL-exp-prep, wins]. Road cost (TIME_TRAVEL) is tolls, not minutes, so a cheaper Road moves Ascendancy, not B12. **Effect:** about 3-4 swift exits per speedrunner run (its median zone time is 14-17) × 0.75 level = 2.5 levels, about 1.3 fights and 1.5 min (32.3 min / 27.6 fights) -> B12 about 29.8 min from SET_OUT, 30.8 from run start = 0.69 × B11 [inference; unmeasured]. The planner's zones run 16-18 tolls at p25-median, so it qualifies in about a quarter of its zones; B11 44.8 -> 43-44 min, planner win within ±1 pp (fewer fights is less gear, fewer tolls is less Ascendancy) [inference; unmeasured]. It is the reward the BACKLOG asks for: a rusher gets a level for crossing fast, a normal player loses nothing | rule + 2 numbers + UI line |
| 3 | **B12's bot** (balance.md 1 speedrunner row, B12): the speedrunner reading B12 is the v11 map policy (`--variant v11`: it takes a dungeon on its way, 0.76 per run) with balance.md 1's level price | the v12 policy (no gear term, D103): 69 wins of 2 100 (3.3 %), too few to read B12 | **v11 policy reads B12 and B3 speed**; the v12 policy is reported | B12 readable (>= 200 wins) | A real speedrunner buys the one upgrade that keeps the boss winnable: the v11 policy wins 13.6 % (286 of 2 100) with boss ilvl 46.5 against 45.1, boss win given reach about 17 % against 9 %; no level price (4.6-60 tolls) closes the gap [source: report 11-12, speedrunner level price]. It is the policy whose 31.3 min is B12's known miss (D116), so row 2 is measured on it. No engine change | sim |
| 4 | **Mawgrim of the Locks** `z2_mawgrim.hpMult` (content; zone 2 dungeon boss, brute with Self Heal), **gated** `C.GATES.mawgrimHp` (off by default) | 1.1 | **0.95** in the arm | B61 per class (Mage dungeon-boss deaths) | Same long-fight pattern as row 1: planner Mage against Mawgrim lasts **23.7 rounds with 33.3 % deaths** on classic P0 (n 162), against 15.4 rounds and 0.9 % for the Mage against Aldrec and 0-1.8 % for Rogue and Hunter against Mawgrim; expedition Mage 7.7-14.3 % (n 13-14) [source: pass-v14 classic/planner-P0, pass-v13 and -v14 exp planner cells, per-boss fight records]. Draw the Tide (Self Heal 0.18) on a 5.6 × 1.1 HP pool carries the Mage past the soft enrage. Expected: Mage Mawgrim fights under 20 rounds, deaths under 10 % [inference; unmeasured]; one-button Mawgrim deaths (67-84 %) fall a few pp. Applies only by its decision rule | content (gated) |

Count: 4 rows. 2 content values (row 4 gated), 1 rule with 2 constants and a UI line (row 2), 1 sim change (row 3).

### Levers considered for B12 and not taken
| Lever | Why not |
|---|---|
| Road cost (TIME_TRAVEL 2 -> 1) | tolls are the in-game clock; B12 is real minutes, set by fights and rounds. It would lower Ascendancy for everyone and not shorten the rush |
| A start-camp option for speed | it competes with the contracts and Ember the speedrunner already buys with 10 points; the reward should come from playing fast, not from buying it. Kept as the reserve if row 2 misses |
| Fewer forced fights on the rush path | the fights are not forced by the map: they are the XP to level 60. Cutting them for everyone moves B11 and the planner's gear |
| Reading B12 against a looser cap | the owner's speed band (0.70 × B11, 30 min) stays |

## Exact behaviour (row 2)
- The zone time is the tolls spent in the zone since its hub was reached (the value the Dimming front and the recorder already track). `TAKE_ROAD` checks it before TIME_TRAVEL is paid; if <= ROAD_SWIFT_TOLLS, the player gains `round(ROAD_SWIFT_XP_FRAC × xpToNext(L))` XP (level-ups apply as for any XP gain, then the travel). Event `{ t: 'swift', xp }`.
- Zone 6's Road (to the Camp) counts. The Bell does not (it is already the speed tool, expedition.md 7.2).
- heatPreview / the map view gain `swift: { left }` (tolls left, or null when passed) so the UI and the planner's search see it; speedFog and planFog value the XP as any XP (balance.md 1 VAL_XP).

## UI needs (UI/UX Engineer)
1. Hub and Road node tooltip: "Swift passage: take a Road within 15 tolls for +¾ of a level" with tolls left; greyed once passed.
2. Float and log line on `swift`.

## What the sim must run
Engine: the package as built (row 1 content value; row 2 behind `C.GATES.swiftRoad`, on by default; row 4 behind `C.GATES.mawgrimHp`, off by default). Main cells `--map expedition --prep` (D118); seeds 1000 on; the v13 / v14 tables (sim/measure-v14.sh variables X0, R0), paired with pass-v14 (Belk) and pass-v13 (speedrunner, planner flip cells). About 30 minutes, 2 workers; run in order, cut from the bottom.

| # | Cell | Runs | Checks | About |
|---|---|---|---|---|
| 1 | Expedition P0: onebutton `--think --think-mash` 50 per class; onebutton full runs 300 per class; planner 300 per class | as listed | **row 1**: B60 expedition (dungeon bosses, with the templates), B59 (c) and (d), B61 per class, Belk fights per class (deaths, rounds) | 10 min |
| 2 | Expedition PALL speedrunner `--variant v11`, row 2 on and off (`--gates` naming every other switch); the v12 policy with row 2 on | 700 per class (v12 policy 300) | **row 2-3**: B12 from SET_OUT and from run start against B11, wins (>= 200), swift exits per run, levels from swift, B3 speed | 10 min |
| 3 | Expedition planner P0 and PALL, row 2 on | 300 per class each | **B11**, planner win (criterion 2: P0 >= 20 %, PALL >= 50 %), swift exits per run, paired with pass-v13 / v14 planner cells | 7 min |
| 4 | Classic P0 planner, row 4 arm (`mawgrimHp` on) and as built | 1 000 per class (Mage only is enough) | **row 4**: Mage Mawgrim deaths and rounds, Mage reach and win; classic Belk Rogue rounds and deaths (row 1, continuity) | 3 min |

Decision rules:
- **Row 1 stays** if cell 1's opener-line dungeon-boss deaths are <= 5 % and one-button dungeon-boss deaths (300 per class full runs) are >= 70 %. If B60 still misses on Belk, report the fights (class, level, potions, rounds); no further cut without a replay showing the cause.
- **Row 2 stays** if B12 (v11 policy) is <= 30.0 min from SET_OUT and <= 0.70 × B11, B11 is 40-50, planner P0 win >= 20 % and PALL >= 50 %, and planner win falls by no more than 2 pp (paired). If B12 misses by <= 1 min: arm ROAD_SWIFT_XP_FRAC 1.0 (scratch). If B11 < 40: ROAD_SWIFT_TOLLS 15 -> 13. If planner win falls > 2 pp: report, keep row 2 off.
- **Row 3:** report B12 on both policies; the v11 policy decides if it has >= 200 wins.
- **Row 4 applies** (`mawgrimHp` on by default) if the Mage's Mawgrim deaths fall >= 10 pp with Mage reach and win not lower than as built by > 1 pp; else stays off.

## Not in this package
- The Hunter's classic rares (+3.3 pp per class, B61 is read on all), B43, the greedy on the expedition: no cheap lever with a measured basis.

## Proposed decisions (for the Lead to log)
| # | Decision | Owner |
|---|---|---|
| D123 | Warden Belk's HP mult 1.05 -> 0.90: the expedition B60 miss is fight length past the soft enrage, not the Deathblow (row 1) | team |
| D124 | Swift passage: a Road taken within 15 tolls of the zone's hub gives 0.75 × xpToNext(L) XP; the rusher's reward for B12 (row 2) | team (owner sees it in playtest, D115) |
| D125 | B12 and B3 speed are read on the v11 speedrunner policy (takes a dungeon on its way); the v12 policy is reported (row 3) | team |

## Constants
v15 outcomes (D126, docs/reports/balance-2026-11-12c.md): each row by its decision rule. The last column is the engine as built after D126; qa/engine s13 reads it.

| Name | Value | Unit | Where | v15 outcome (D126) |
|---|---|---|---|---|
| ROAD_SWIFT_TOLLS | 15 | tolls of zone time | expedition.md 7.1, constants (M2b v15) | kept; the Swift passage is off (`C.GATES.swiftRoad`) |
| ROAD_SWIFT_XP_FRAC | 0.75 | × xpToNext(L) | expedition.md 7.1, constants (M2b v15) | kept; the Swift passage is off (`C.GATES.swiftRoad`) |
| `C.GATES.swiftRoad` | on | switch | constants (M2b v15 row 2) | off |
| z1_belk.hpMult | 0.90 (was 1.05) | × | content enemies.js | stays |
| z2_mawgrim.hpMult | 0.95 (was 1.1) | × | content enemies.js (row 4; measured as the gated arm `C.GATES.mawgrimHp`) | applies: the content value; the switch and content `gated` are removed |
