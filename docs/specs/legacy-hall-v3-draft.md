# Legacy hall v3 (proposal, **draft**)

Status: **draft**, Lead Game Designer, 2026-11-20. Nothing here is approved by the owner. It changes no code and no other spec: legacy.md stays as written until the Lead accepts a part of this. Source: the blind returning-player check [source: docs/feedback/2026-11-20-blind-legacy-returning-v2.md], the BACKLOG row of 2026-11-20 (hall balance), D154, D159-D161, legacy.md 4.2, 4.7 E5, 2.3 and docs/reports/legacy-economy-2026-11-19.md.

Numbers marked [inference] are reasoned from the spec and the report, not measured. Section 5 lists the arms that would measure them.

## 0. The answer in six lines

1. The stat ranks are too small by design: +1 % of 205-425 health is 2-4 points. Vigor and Edge become **front-loaded: +5 % then +3 % health, +4 % then +2 % Power**, at 70 / 100 (was 70 / 130 for +1 % each).
2. Deeper Pockets becomes **+8 slots for 50** (was +4 for 40) and Cartographer **marks the zone's dungeon and exits on arrival** (was a tint of region names), both at about today's price. Both are small; neither fixes junk, which is a loot and UI item.
3. **Stormhawk 150 becomes 90** (a sidegrade priced above a technique), **Second Breath 200 becomes 150**. The level-20 wing stays at 700: it was never meant to be bought at hero 5, and the card must say so.
4. The hall total for one hero moves from 2 340 to **2 240** (Hunter 2 330). The planner still finishes the hall in run 10 at hero 25. Hours to hero 25 do not change (6.1-6.5 planner, D159), because no XP number moves.
5. A four-run player earns about 240 points in total, not the planner's 600-700. The new prices let that player own three felt entries by run 3 (section 4). Income is not raised.
6. legacy.md 2.3 is replaced (section 6): Camp waves are an optional top-up at run rate, not a levelling farm. This leaves D154's "optimise for levelling" thinner; that is an owner question (6.3).

## 1. What the tester saw, in numbers

| Run | Hero level | Legacy points | Cumulative | Bought |
|---|---|---|---|---|
| 1 | 1 to 2 | 109 | 109 | Packed Satchel 50, Deeper Pockets 40 |
| 2 | 2 to 3 | 44 | 153 | nothing (63 in hand, only Cartographer 60 in reach) |
| 3 | 3 to 5 | 84 | 237 | Quick Study 80, Cartographer 60 |
| 4 | 5 | 1 | 238 | nothing |

- The tester's rate is 44-84 a run for a run that reaches zone 3, 25-40 % of the planner's 164-284 (4.7). Hero XP was about 40 % of the planner's. Both are the same player: slower, abandoning, hand-playing bosses. The planner's curve is the pace the hall is sized to (D159); this proposal does not re-size it to a casual player, only makes the first 240 points count.
- Felt: Packed Satchel (5 potions) and Quick Study (+5 % quest XP, 80). Not felt: Deeper Pockets, Cartographer. Quick Study is the working benchmark: **a rank is felt at about +5 % of a number the player watches.** The stat ranks sit at +1 %.
- Health at hero 2 / 3 / 5 is 205 / 288 / 425, so one level-up is +83 then +137 (about +30 % each time). Early levels cannot be matched by a percentage rank; gear and level-ups are the early power, the hall is the thing that is left when they are gone. The target is therefore **one rank is worth about one gear piece**, and from hero 15 on about half a level-up [inference: level-ups shrink to +4-5 % of health by then, not measured].

## 2. Entry by entry

Prices in Legacy points. "Now" is the v2 hall (legacy.md 4.7 E5, META_HERO).

| Entry | Now: price, effect | Proposed: price, effect | Why |
|---|---|---|---|
| Packed Satchel | 50; 3 potions at start, first potion free each fight | **unchanged** | Felt by the tester. |
| Vigor of the Line I / II | 70 / 130; max health +1 % each | **70 / 100; +5 % / +3 %** | Option S2 below. At hero 5, rank I is +21 health (425), at hero 2 +10. Rank I is the felt buy, rank II is the luxury and costs 30 less. |
| Edge of the Line I / II | 70 / 130; Power +1 % each | **70 / 100; +4 % / +2 %** | Power at 4 % shortens a fight by about 4 % of its rounds [inference]; smaller than health because damage is seen less than a health bar. |
| Quick Study I / II | 80 / 140; XP +5 % each | **unchanged** | Felt; it is the benchmark. |
| Lost Technique I / II (per class) | 120 / 200; spell from hero level 9 / 17 | **unchanged** | The requirement on the card is a UI fix, already done (f04b4fe). |
| Second Breath | 200; one resurrect a run, not in Oruvath's fight; needs Oruvath reached once | **150; same effect and need** | See option B below. |
| Swift Boots | 100; +1 Homeward Bell charge | **unchanged** | Not raised by the tester. |
| Deeper Pockets | 40; +4 bag slots | **50; +8 bag slots** | Option P below. Bags were full by fight 4-5 of zone 2 at 20 slots; +4 only moves that to fight 6-7. +8 moves it to about fight 9 [inference]. |
| Cartographer | 60; Region Charts every run (names and tints regions; costs a camp point at the camp) | **60; Region Charts free (no camp point) and the arrival map marks the zone's dungeon and its exits** | Option C below. |
| Old Hand | 70; Tracker's Notes every run | **unchanged** | Not raised by the tester. |
| Quartermaster I / II | 70 / 110; +2 camp points per rank | **unchanged** | Cartographer's old value (1 camp point for 60) was below this (2 points for 70); the new effect fixes that. |
| Stormhawk Companion (Hunter) | 150; a fourth pet choice, 0.35 health, 0.7 armour, 0.8 damage, attacks hit a second enemy | **90; same pet** | Option H below. |
| Oaths | 0; needs a first Oruvath kill | **unchanged** | |
| Second / third talent tree (per hero, from hero 20) | 250 / 300 | **unchanged** | See option W below. |
| The Armoury (from hero 20) | 150 | **unchanged** | |

### 2.1 Stat ranks: three options, pick S2

| Option | Vigor | Edge | Price | For | Against |
|---|---|---|---|---|---|
| S1 flat | +4 % / +4 % | +3 % / +3 % | 70 / 130 | Simple; rank II also felt | Rank II is the dearest point of power in the hall (130 for +4 %). |
| **S2 front-loaded (pick)** | **+5 % / +3 %** | **+4 % / +2 %** | **70 / 100** | First buy is as big as Quick Study, the felt benchmark; rank II is priced as a luxury. Same total power as S1 (Vigor +8 %, Edge +6 %) with a cheaper second step. | Rank II is small; a player who stops at rank I loses little. That is the intent. |
| S3 keep +1 % | +1 % / +1 % | +1 % / +1 % | 25 / 45 | No power risk | The card still reads "+4 health"; this is the finding, not an answer. |

S1 and S2 reach the same total (Vigor +8 %, Edge +6 %, was +2 % each); S2 moves the weight to the first buy and cuts 60 points off the second tier.
The card must show the number the hero gets at once ("Health 288 to 302"), not only the percentage (4.7 E6 line style).

### 2.2 Deeper Pockets: three options, pick P1
- **P1 (pick):** +8 slots (28 in all) for 50. The effect becomes visible in the first zone where it is bought.
- P2: keep +4 and add a rank II that sells the cheapest item when the bag is full, 60 more. Better aimed at the real complaint (junk), but it puts a clean-up rule behind a purchase.
- P3: leave it at 40 and fix junk at the source (the BACKLOG row: auto-sell or stack junk, one "Items waiting" window). Correct, and the Lead's call: if junk is fixed for everyone, P1 is a convenience that is felt less and P3 is the only change needed.
P1 is recommended even so, because it is a constants change and P3 is a UI and loot job that is not mine.

### 2.3 Cartographer: three options, pick C1
- **C1 (pick):** Region Charts are free (no camp point) and the arrival map of each zone marks its dungeon and its exits (Road, Bell). The tester lost two of three exits to the Dimming and called the dungeon's cost unpredictable; this answers the first half with knowledge, not with a price on the map. The toll shown on a node and the Dimming places in its tooltip (D163) stay free for everyone. Needs an expedition.md change; if the map already marks dungeons and exits, use C2.
- C2: merge Cartographer and Old Hand into one entry at 90 (was 60 + 70): Charts and Tracker's Notes both free. Saves 2 camp points a run, the same as Quartermaster I for 70.
- C3: raise the effect to +1 camp point and price 60. A weaker Quartermaster; no.

### 2.4 Second Breath: three options, pick B
- A: keep 200. Buy in run 7 for the planner (D159), run 8 or later for the casual player.
- **B (pick): 150, same effect and need.** The planner buys it in run 6 or 7 instead of 7, the casual player after about 4 runs of 40-60. It is a once-a-run safety net, worth about a talent point of power, not a second tree.
- C: split into two ranks, I at 100 (return with 30 % health) and II at 100 more (also in Oruvath's fight). Largest effect on the save-for feeling, but it re-opens the resurrect rules (rules 11, expedition.md 8) and B10.

### 2.5 Stormhawk: two options, pick H
- **H (pick): 90.** It is a pet choice among four, not a growth in power (a sidegrade: 0.35 health against the Ridgewolf, plus cleave). At 150 it cost more than Lost Technique I (120), a new spell. At 90 a Hunter can own it after run 2.
- H2: keep 150 and give it a growth rank (it levels with the hero's talent in Beastbond). More design, more risk to B7 (tree spread).

### 2.6 The level-20 wing: three options, pick W1
- **W1 (pick): keep 250 / 300 / 150 (700 in all) and make the card say so.** The wing is sized to the income from hero 20 to 25 (4.7 E5): the planner has 163 spare after the account wing in run 7 and pays 700 by run 10. The tester at hero 5 should not afford it and should be told what it is for: "Opens at hero level 20. You have 5." The wing's items are not sold until phases 4-5 exist (D160).
- W2: cut it by 30 % (490). Brings the hall done two runs earlier for the planner; a hall that ends before hero 25 leaves nothing to save for at the top.
- W3: let a hero's level pay: every hero level from 20 pays 40 Legacy points (was 20). That raises the whole income by 4 % [inference] and breaks the 2 340 pace sizing; the Lead should not take it without a new pace run.

## 3. The hall total and the pace

| | v2 (4.7 E5) | v3 (this draft) |
|---|---|---|
| Account entries | 1 320 | 1 220 (Vigor II -30, Edge II -30, Second Breath -50, Pockets +10) |
| One class's techniques (120 + 200) | 320 | 320 |
| Account entries + one class's techniques | 1 640 | **1 540** |
| Stormhawk (Hunter) | 150 | 90 |
| Level-20 wing | 700 | 700 |
| All, one hero | 2 340 | **2 240** (Hunter 2 330) |

Chained on the planner campaign of 4.7 E5 (cumulative Legacy 224, 413, 672, 915, 1 190, 1 447, 1 703, 1 950, 2 195, 2 469) with the buying order of 5.8 item 7, new prices:

| Run | Cumulative | Bought after the run |
|---|---|---|
| 1 | 224 | Packed Satchel, Vigor I, Edge I (190) |
| 2 | 413 | Quick Study I, Lost Technique I (390) |
| 3 | 672 | Deeper Pockets, Cartographer, Vigor II (600) |
| 4 | 915 | Edge II, Old Hand, Quartermaster I (840) |
| 5 | 1 190 | Quick Study II, Swift Boots, Quartermaster II (1 190); Technique II waits for hero 17 |
| 6 | 1 447 | Lost Technique II (1 390) |
| 7 | 1 703 | Second Breath (1 540, account wing done) |
| 8 | 1 950 | second tree (1 790) |
| 9 | 2 195 | the Armoury (1 940) |
| 10 | 2 469 | third tree (2 240, hall done) |

- Same finish as D159 (run 10, hero 25). Runs 1-4 buy 3, 2, 3 and 3 entries (was 3, 2, 3, 3). Within HALL_PACE_TOL (0.15) at 20 and 25: 1 703 against 1 540 (+11 %), 2 469 against 2 240 (+10 %); the Hunter's 2 330 is 6 % under 2 469.
- D154's hero 25 in 6-8 hours stays at 6.1-6.5 for the planner: Quick Study, HERO_XP and every XP rule are unchanged. The only path by which the hall changes hours is power: +8 % health and +6 % Power can lift a run's pace by shortening fights and saving potions. Section 5 asks for that to be measured.

## 4. Who can buy what, at the tester's pace

Cumulative points at the tester's four runs: 109, 153, 237, 238.

| After run | Cumulative | v2 buys (the tester's own picks) | v3 can buy |
|---|---|---|---|
| 1 | 109 | Satchel 50 + Pockets 40 | Satchel + Pockets (100), or Vigor I (70) |
| 2 | 153 | Satchel, Pockets, 63 in hand | Satchel + Vigor I (120); a Hunter Stormhawk (90) |
| 3 | 237 | Quick Study 80, Cartographer 60 | Satchel, Vigor I, Edge I (190); or Satchel, Vigor I, Quick Study (200) |
| 4 | 238 | nothing new | the same set plus a 47-point carry |

So by run 3 a four-run player has two stat ranks that can be read on the hero's health bar, where v2 gave Quick Study and a vision entry. Second Breath (150) is within the cumulative total at run 3 but needs Oruvath reached once; the card says so.

**The card's recommendation (UI text, draft):** "Next in the hall" names the cheapest entry that is unlocked and not owned. With enough points: "Vigor of the Line I, 70. You have 109." Short of it: "Vigor of the Line I, 70. You have 63: 7 more, about 1 run at your average of 55." The average is the mean of the profile's runs, so the line stops naming an entry the player cannot reach.

## 5. What to measure before the Lead accepts it (inference to be replaced)

| Arm | Run | Gate |
|---|---|---|
| LH1 power | planner, the v3 effects on, nothing else changed, hero 5, 15 and 25 cells of the D118 grid, 180 runs per cell, the full hall bought in the campaign order | Win rate at hero 25 at most +4 pp over the v2 hall [inference: +2 to +3 pp: a hero level is worth about 1.2 pp, 8 % health and 6 % Power about 1.5-2 levels]; L5 (Legacy layer 10-30 pp) and B10 hold; B6 keeps its band |
| LH2 hours | the campaign v3 chain, hall bought | Hours to hero 25 within 6-8 and within 0.3 h of v2's 6.1-6.5 |
| LH3 pace | the chain of section 3 | Runs 1-4 buy 2-3 entries each; the hall done by run 10 |
| LH4 first buy | a lean planner, 55 a run (the tester's average) | After run 3 at least two entries owned |

If LH1 fails: Vigor II +2 %, Edge II +1 % (S2 total +7 % / +5 %), prices unchanged. If LH2 shows a shorter climb than 0.3 h: leave it, a faster run is not a fault.

## 6. legacy.md 2.3 against D161

### 6.1 The conflict
- legacy.md 2.3 (2.3 first bullets, 3.2, 3.3, 3.4 (a), 1.4's last bullet, section 10's CAMP_WAVE rows) still says Camp waves are the levelling route's farm: at most CAMP_WAVE_MAX (10) a run at CAMP_WAVE_XP_MULT (2) times the normal XP.
- 2.3 has one line from D161 under it: under Economy v2 a wave pays the E2 award times the level-gap falloff and CAMP_WAVE_MAX and CAMP_WAVE_XP_MULT "are not built". So the text above that line is wrong under v2 and the two cannot both stand. The owner's D154 ("optimise for levelling") rests on a farm that D161 removed.
- What D161 measured: a 700-wave grind from hero 5 ends at hero 11.2 at 53 XP a pace minute (was hero 25 at 247). In the first 1-2 hero levels past arrival a wave pays 154-183 XP a pace minute against 176-198 for a run. So a Camp stint is a **top-up at run rate for about a hero level or two, then it dries up**.

### 6.2 Replacement text for 2.3 (draft)

> ### 2.3 Kept: the Furnace, the Dimming and the Roads; the Camp waves are a top-up
> - Unchanged: tolls, the Furnace's line and states, Ascendancy at Oruvath, heat rewards (rules 1.7), the Dimming with D152's steady pace, the Roads and the Homeward Bell (expedition.md 6-7), the lean first run (D152).
> - **Camp waves** (draft, replaces the second bullet of 2.3 and its Economy v2 tail; D161). A wave's XP, kills and wave bonus, is the E2 award (4.7) times min(1, diffMod(Z - L)): Z the Camp's level, fixed at arrival (the hero's power level plus CAMP_TIER 3); L the hero's power level when it is paid. A wave pays in full up to the Camp's level and falls as the hero passes it, to a tenth from 6 power levels past. There is no wave cap and no XP multiple: the fall-off is the cap. Each wave still costs 2 tolls (so it raises Oruvath's Ascendancy) and the hero's health and potions.
> - What it is for: the hero who arrives at the Camp one or two hero levels short of the next spell or talent point can close that gap at about the pace the run would have paid. It is not a route to level 25: a grind from hero 5 ends at about hero 11 and stops paying. Oruvath's fight and everything outside the Camp keep E2. The Legacy level line (20 a level, 4.1) pays the same per level as anywhere.
> - Not built: CAMP_WAVE_MAX, CAMP_WAVE_XP_MULT.


### 6.3 Knock-on edits (not made here) and the owner question
- **3.2 The levelling route** becomes "the heat route": runs Burning or Infernal where it can (+35 / +50 % XP), clears dungeons and elites, and tops up at the Camp for a level or two. Its edge over the winning route is about 1-3 % of XP an hour (heat alone, legacy.md 6.4), not the 1.17-1.30 the Camp farm gave.
- **3.3** loses the "Camp farm" cells and the 5.6-6.2 hours figure; the winner's 6.8-7.8 stands.
- **3.4 (a)** LEVEL_ROUTE_XP_MIN 1.15 becomes **1.00** (the heat route is no worse), to be re-measured on the Economy v2 cells. (b) and (c) are unchanged.
- **1.4**'s last bullet: "the levelling route (the Camp farm) in about 5.6-6.2" goes.
- **Section 10:** CAMP_WAVE_MAX and CAMP_WAVE_XP_MULT rows are removed; the 4.7 row "Camp wave falloff" stays.
- **Owner question Q-R (draft):** D154 says players can optimise for levelling. Under D161 a levelling route is a top-up and a heat bonus, not a different game. Options: R1 (pick) keep it as above; R2 give the leveller a bounded farm with another shape, such as paying in full to the Camp's level plus 3 (a change to the falloff's reference, which D161 left alone and which would re-open the 700-wave measure); R3 drop the second route from the spec and tell the owner. The designer recommends R1 and asks the owner whether it is enough.

## 7. Constants (draft; names for the Engineer, nothing built)

| Constant | Value | Note |
|---|---|---|
| HALL_V3 (price, per rank) | satchel 50; vigor 70 / 100; edge 70 / 100; quick_study 80 / 140; sp_(class)1 120, sp_(class)2 200; second_breath 150; swift_boots 100; pockets 50; cartographer 60; old_hand 70; quartermaster 70 / 110; stormhawk 90; oaths 0 | replaces LEGACY_COST (4.7 E5) |
| HALL_VIGOR_PCT | 0.05, 0.03 | max health per rank (was 0.01 each) |
| HALL_EDGE_PCT | 0.04, 0.02 | Power per rank (was 0.01 each) |
| HALL_POCKETS_SLOTS | 8 | bag slots (was 4) |
| CARTOGRAPHER_CHARTS_FREE | on | Region Charts cost no camp point |
| CARTOGRAPHER_MARKS | dungeon, exits | marked on the arrival map of each zone (expedition.md change) |
| TREE_OPEN_COST, ARMOURY_COST | 250 / 300, 150 | unchanged |
| HALL_TOTAL_ONE_HERO | 2 240 (Hunter 2 330) | was 2 340 |
| STAT_GATE_PP | 4 | LH1: win rate at hero 25 over the v2 hall |
| STAT_FALLBACK | vigor II 0.02, edge II 0.01 | if LH1 fails |
| RUN_AVERAGE_LINE | mean of the profile's runs | "about N runs at your average" on the hall card |
| LEVEL_ROUTE_XP_MIN (3.4 a) | 1.00 | was 1.15; the Camp farm is gone (D161) |
| CAMP_WAVE_MAX, CAMP_WAVE_XP_MULT | removed | D161 |
