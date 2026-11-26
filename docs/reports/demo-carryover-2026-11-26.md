# Demo: the zone 2 exit and carry-over (2026-11-26)

Status: **draft** (Lead Game Designer), for the Lead and the owner. Nothing here is approved by the owner. BACKLOG 'Demo blind round 2' R2-1 (built, demo only) and R2-2 (measured and proposed, not built). Sources: docs/feedback/2026-11-26-blind-demo-skipper-retest.md, docs/feedback/2026-11-26-blind-demo-returning.md; spec docs/specs/demo.md 1.2a (new, draft); tool sim/demo-carry.mjs.

## 1. Verdict

1. **R2-1 built:** the demo's end now needs **three fights won in Greywater Fens** (DEMO_END_WINS 3). Leaving zone 2 with fewer is an early run end (outcome `left`): no demo-end screen, no "You made it through", no zone line for zone 2, and the 60-point first-run welcome waits for the next run. The zone 2 Bell reads "End the demo run" (gold) or "End this run early" (muted red), and the map header counts the wins. The full game is unchanged (run hashes identical).
2. **R2-2 measured:** a stronger single-rank hall (Vigor +8 %, Edge +5 %, Cartographer with Pathfinder) **changes nothing the sim can see** (deaths 0.33 to 0.31 a run for the weakest fighter; run 4 damage per fight -1 to -6 %). Zones that trail the hero **do** make run 4 feel stronger: damage per fight as a share of max HP falls to 0.16-0.57 of run 1 (today 0.52-1.35), the one-key fighter's deaths fall from 0.33 to 0.12 a run, and hero 7 comes about 4-5 minutes sooner. At one zone level per two hero levels a good player takes under 2 % of his health a fight from run 3 on, which is no game; **two zone levels per three hero levels** (a middle step, measured too) keeps run 4 at 3-9 % a fight.
3. **Recommendation (owner decision):** variant (a) in its milder form: zones 1 and 2 rise about two levels for every three hero levels (ZONE_LAG + 0.33 for zones 1-2), in the full game as well as the demo, so the demo teaches the real game. Keep today's hall numbers; rework Cartographer (section 5).

## 2. R2-1: the rule chosen and why

**Rule:** the demo end needs DEMO_END_WINS = 3 fights won in zone 2, any kind (quest, Grind wave, elite, rare, dungeon fight, contract fight, a Dimmed encounter including the Bell's own fight). Spec: demo.md 1.2a.

Why fights won, not "the zone 2 elite beaten":
- Every map and every route has fights; an elite sits on one node that the Dimming can take or the route may not reach, and it is the fight that killed autoplay players in both blind rounds.
- The player can count wins; the map header shows "Demo end: 1 of 3 fights won here".

Why three (demo campaigns of section 3, 60 campaigns a class and bot, seven runs each; zone 2 wins at the exit of runs that were not deaths):

| Player (sim bot) | Median zone 2 wins | Exits with at least 3 | Exits with 0-2 (now early) |
|---|---|---|---|
| Good player (planner) | 5-7 | 99.5-100 % | 0-0.5 % (0-2 of 420 runs) |
| One-key fighter (onebutton: the planner's map play, one key in fights) | 5-6 | 99 % | about 1 % (1-3 of 420 runs) |
| Hurried player (greedy) | 4 | 84-86 % | 13-15 % (54-61 of 420 runs) |
| Engine autoplay (qa/engine s32 A1, three classes) | 3-7 | every run | none |
| Blind skipper, run 1 | 0 | | early |

The hurried bot leaves early in 15 % of its runs because it does not see the count; a person sees "1 of 3" and the Bell's "End this run early". Two wins would let a two-fight sprint through zone 2 count; four would turn about 45 % of the hurried bot's exits into early ends (earlier sample, 12 campaigns a class).

What an early leave pays [source: tester run 1, re-played by the UI test seed 21]: the skipper's two-fight run paid 80 (60 welcome + 20 for two zones); the same exit now pays the zone 1 line and its own fights and quests (17 in the test run), says "Vex left Greywater Fens early" and "The demo ends after three fights won in Greywater Fens. This run won none there.", and adds "Your first-run welcome waits for the next run."

**The welcome:** not paid on an early leave; it stays due and the next run that is not left early pays it (a death pays it, as today). Reason: it is a gift for playing the first run, and paying it on a two-minute exit made that exit the best-paying run of the demo.

Full game: sim/blindahash.mjs against 3d009eb, seeds 1000-1009: off 200/200 and Legacy 180/180 run hashes identical; demo runs 14/60 identical (meant to change: the win counter is part of a demo run's state).

## 3. R2-2: set-up

`node sim/demo-carry.mjs --variant <v> --bot <b> --campaigns 20 --runs 7 --seed 7000` (20 campaigns a class, 60 a cell, 420 runs). A campaign starts from a fresh profile under C.DEMO_GATES: the guided first run, then runs at the kept hero level, buying the demo hall strictly in order (demo.md 6) whenever the balance covers the next entry. Engine: main 3d009eb with R2-1 built. Bots: planner (good player), greedy (hurried player, fewer fights), onebutton (the planner's map play, one key in fights: the nearest stand-in for the autoplay and skipping testers, who died in 2 of 4 and 1 of 3 runs). Variants are sim-only changes to the engine's tables:
- **base**: the demo as built.
- **(a) lag**: zones 1-2 trail the hero, about one zone level per two hero levels (ZONE_LAG + 0.5 for zones 1 and 2; a zone's band is P + tier - round(lag × (P - 1)), and the power level P is about 1 + 2.5 × (hero level - 1)).
- **lag33** (not asked; the middle step): ZONE_LAG + 0.33, about two zone levels per three hero levels.
- **(b) hall**: today's scaling; Vigor I +8 % max HP (was +3 %), Edge I +5 % Power (was +2 %), Cartographer with Pathfinder (node types within two steps).

Minutes are the summary's pace minutes by hand (estSeconds; start camp included, hall screen not). "Minutes to hero 7" is cumulative to the level-up to 7 inside the run that reaches it. Damage per fight is the run's damage taken over its fights; "% HP" divides by the hero's max HP at the run's end, so it reads as "how much of my health a fight costs". Run 1 is the guided first run (scripted zone 1, hero 1). Noise [estimate]: deaths a run ±0.02 (planner) to ±0.04 (onebutton); minutes ±1.

## 4. R2-2: results

### 4.1 The table

| Variant | Bot | Deaths a run | Minutes to hero 7 (median) | Demo end (win rate, zones 1-2) | Run 4 / run 1, damage per fight | Run 4 / run 1, as % of max HP | Run 4 % HP a fight |
|---|---|---|---|---|---|---|---|
| base | planner | 0.005 | 56.4 | 99.0 % | 1.90 | 0.64 | 7.1 |
| base | greedy | 0.052 | 56.4 | 80.2 % | 2.77 | 1.35 | 14.8 |
| base | onebutton | **0.333** | 57.0 | 66.0 % | 1.47 | 0.52 | 14.0 |
| (a) lag | planner | 0.005 | 51.3 | 99.5 % | 0.43 | 0.16 | 1.8 |
| (a) lag | greedy | 0.026 | 51.6 | 84.5 % | 1.04 | 0.57 | 6.2 |
| (a) lag | onebutton | **0.119** | 52.6 | 87.9 % | 0.52 | 0.19 | 5.1 |
| lag33 | planner | 0.005 | 52.7 | 99.5 % | 0.85 | 0.29 | 3.2 |
| lag33 | greedy | 0.031 | 53.3 | 82.6 % | 1.53 | 0.79 | 8.6 |
| lag33 | onebutton | **0.155** | 53.7 | 84.0 % | 0.93 | 0.34 | 9.1 |
| (b) hall | planner | 0.005 | 56.3 | 99.0 % | 1.89 | 0.61 | 6.7 |
| (b) hall | greedy | 0.048 | 56.2 | 80.7 % | 2.75 | 1.29 | 14.1 |
| (b) hall | onebutton | **0.307** | 57.0 | 68.6 % | 1.44 | 0.49 | 13.1 |

Demo end = the run reached the demo-end screen (R2-1 rule); the rest died or (greedy only) left early.

### 4.2 What the runs say
- **Today the demo gets harder for a weak fighter as he levels.** The one-key fighter dies in 17 % of run 4 and 40-47 % of runs 5-7, and a fight costs him 14 % of his health at run 4 and 21 % at runs 5-7. This is the testers' "zones scale with the kept level". The good player is not hurt either way (under 1 % deaths), so the planner cannot tell the variants apart on deaths.
- **(a) changes that.** One-key deaths: 27-30 % in runs 1-3 (unchanged: hero 1-3 zones barely move), then 0 % from run 4. A fight costs the planner 1.6-2 % of his health from run 3 on: zones 1-2 stop being a fight.
- **lag33 sits between.** One-key deaths 10-12 % at runs 4-5, then 0; a fight costs 3 % (planner) to 9 % (one-key) at run 4. Hero 7 comes 3-4 minutes sooner than today (fights are shorter; XP per fight is counted against the zone, legacy.md 4.7 E2, so it does not fall).
- **(b) is not felt.** +8 % max HP and +5 % Power move deaths by 0.00-0.03 a run and run 4's damage share by 3-6 %. The returning tester said it in words: "+2 % Power for a whole run's points is not something I would feel"; at +5 % it is still not something the sim can see. The hall is bought in order, so Vigor and Edge land after runs 2-3 and Cartographer after run 6: by run 4 a buyer owns 3-4 entries.
- DM4 (deaths at most 12 % a class) with the one-key fighter: today 29-37 %, lag 9-16 %, lag33 11-18 %. The planner passes everywhere.

### 4.3 Limits of the sim
- No bot takes contracts in a demo run without Tracker's Notes (section 5), and no bot spends extra camp points, so **Quartermaster is worth nothing to the sim** while the returning tester rated it the only purchase that changed a run. Human value of camp points is not measured here.
- The one-key fighter is a stand-in for an autoplay player, not a person. The blind panel is the check.

## 5. Cartographer rework (proposal)

Today Cartographer (60) gives Region Charts every run: worth 1 camp point (the charts' price) plus region names and the dungeon's place. Quartermaster (70) gives 2 camp points. The tester saw no effect from the charts (BACKLOG R2-6 "Region Charts no visible effect").

Measured as one entry owned at hero 4 (`--single <entry> --hero 4`, 60 runs a class, 180 a cell):

| Entry owned (hero 4) | Planner: hero XP a minute | Planner: Legacy a run | One-key: deaths a run | One-key: hero XP a minute | Contracts done / taken (planner) |
|---|---|---|---|---|---|
| none | 216 | 53.5 | 0.36 | 202 | 0 / 0 |
| Cartographer today (Region Charts) | 218 (+1 %) | 55.0 | 0.49 | 187 | 0 / 0 |
| Cartographer + Pathfinder (types within 2 steps) | 221 (+2 %) | 54.3 | 0.41 | 189 | 0 / 0 |
| Cartographer + whole-zone types | 221 (+2 %) | 54.0 | 0.46 | 188 | 0 / 0 |
| **Cartographer + Tracker's Notes** | **247 (+14 %)** | **58.2 (+9 %)** | **0.31** | **226 (+12 %)** | 1.6 / 2.0 |
| Quartermaster | 216 | 53.5 | 0.36 | 202 | 0 / 0 (sim limit, 4.3) |

**Proposal (draft):** Cartographer becomes **"Region Charts and Tracker's Notes"**: region names, the dungeon's place, and the marked sites of your contracts within two steps, every run; price 60 unchanged. Reasons: map vision alone is worth 0-2 % to any player the sim can model; the contract marks are what turned the tester's Wanted contract from "close to luck" into "easy in run 3 with Tracker's Notes", and they pay through contracts (XP and Legacy). Caveat: the sim's gain comes from the planner taking contracts once it can find their sites; a person may take contracts without it. In the full game Tracker's Notes is Old Hand's perk (not sold in the demo): the demo can merge the two now; for the full game either merge them (Old Hand then needs a new effect) or keep the merge demo-only. Owner and Content to name it.

## 6. Owner note (draft)

**Should zones 1-2 keep rising with the hero's kept level?** Today a zone sets its level from your hero's level, so a returning player's run 4 is as hard as run 1 and, for a player who leans on autoplay, harder: the sim's one-key fighter dies in a third of its demo runs, and in 40-47 % of runs 5-7. Making the hall's single ranks bigger (+8 % health, +5 % Power) does not change that in the measures. Letting zones 1 and 2 trail the hero does: at two zone levels for every three hero levels, run 4 costs a third of the health per fight that run 1 does, the one-key fighter's deaths fall to about one run in six and to none from hero 6, and hero 7 comes about 4 minutes sooner; zones 3-6 and Oruvath keep rising with the hero as now. At one zone level per two hero levels, zones 1-2 stop being a fight for a good player from run 3. **Recommendation: zones 1-2 trail the hero at two levels per three (ZONE_LAG +0.33), in the full game and the demo; the hall keeps its numbers and Cartographer gets Tracker's Notes.** Default if you do not answer: nothing changes until the next blind round reports. This touches D154 ("zones scale to the hero's level"), so it is your call.

| Option | Deaths a run, one-key fighter | Health lost a fight, run 4 (one-key / good player) | Minutes to hero 7 | Run 4 against run 1 (damage per fight as % HP) |
|---|---|---|---|---|
| Today | 33 % | 14 % / 7 % | 57 | 0.52 / 0.64 (one-key / good) |
| Bigger hall ranks | 31 % | 13 % / 7 % | 57 | 0.49 / 0.61 |
| **Zones 1-2 trail, 2 per 3 (recommended)** | **16 %** | **9 % / 3 %** | **54** | **0.34 / 0.29** |
| Zones 1-2 trail, 1 per 2 | 12 % | 5 % / 2 % | 52-53 | 0.19 / 0.16 |

## 7. Reproduce
- R2-2 campaigns: `node sim/demo-carry.mjs --variant base|lag|lag33|hall --bot planner|greedy|onebutton --campaigns 20 --runs 7 --seed 7000 --out <file>`; tables `node sim/demo-carry.mjs --report <files>`.
- Single entries: `node sim/demo-carry.mjs --single none|cartographer|carto2|carto3|carto4|quartermaster --hero 4 --bot planner|onebutton --campaigns 60 --out <file>` (carto2 Pathfinder, carto3 whole-zone types, carto4 Tracker's Notes).
- R2-1 hashes: `node sim/blindahash.mjs <root of 3d009eb> <this root> --seeds 1000-1009`.
