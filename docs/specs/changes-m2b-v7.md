# Spec changes M2b v7: time in tolls, the Furnace

Owner: Lead Game Designer, 2026-11-11. For: Core Gameplay Engineer (src/), UI/UX Engineer, Simulation & Balance Engineer (sim/), QA, Content Designer. Status: draft; decisions D68-D71 (team; the names are owner review), pitch and alternatives in docs/handoffs/designer-2026-11-11b.md.

Owner request [stated: docs/feedback/2026-11-11-1012-owner.md]: heat needs its own name; remove the idea of hours: time is spent in a different, much smaller measure (1, 2, ...), never with decimals; the meter sits at the top centre, its hot side like the core of hell, its cool side calm, with a pointer moving between them on a central bar.

Rule lines changed in docs/specs/rules.md, expedition.md and balance.md are marked "(M2b v7)". Lines changed only by the constant rename (table B) are not marked; each spec's status line says so.

## Summary
1. Names (player-facing): the meter is **the Furnace**; its states are **Calm, Smouldering, Burning, Infernal**; the time unit is the **toll** (plural tolls). The engine keeps the names `heat`, `heatView`, `HEAT_*` and the state ids `clear`, `warm`, `hot`, `scorched`; only what the player sees changes.
2. Unit: **1 toll = 1 former in-game hour.** Every cost, threshold and band keeps its number. All player-facing time values are whole numbers; there are no hours, days or clock times on screen.
3. The engine stores tolls directly: the run's time is `state.time`, the constants are `TIME_*` (unit-neutral, so a later change of the unit's name touches only text). No hidden hours anywhere.
4. Two rules change form to remove the only non-whole values: the Star's line rounds up per zone (it was par × z / 6 at 6 decimals, which shows decimals under the Oath of Haste), and the Dimming advances 2 hops every 5 tolls (it was 2.5 hours per hop). Both keep every heat state, every projected Ascendancy and every node's dimming toll exactly as before.
5. Balance delta: **none**. B1, B3, B17, B58 and every other target are unchanged by construction; no re-measure is needed. The sim's seeded cells and QA's goldens must reproduce run for run (only key names change).

## Why 1 toll = 1 former hour
- Every time cost is already a whole number of hours: walk, pass, vendor, trainer, treasure, shrine, Ask the Locals and a Dimmed encounter 1; travel, the Bell's channel and an expedition grind wave 2; an expedition quest or elite 3; Rest 4; a dungeon 5 (rows) or 6 (expedition). Their greatest common divisor is 1.
- A coarser unit (fewer, larger tolls) cannot keep these ratios: with 1 toll = 2 hours a walk (1 h) and a quest (3 h) must round, and walks, services and Dimmed encounters double in relative cost (alternative B in the hand-off). A finer unit makes every number larger, which is the opposite of the request.
- So the unit keeps the scale and the numbers the player sees per choice are 1 to 6: the request's "1, 2, ...". What goes is the idea of hours: the day clock ("Day 2, 14:00"), "h" after every number, and the decimals.

Where decimals appeared before [source: src/engine/heat.js line, src/engine/expedition.js frontAt/dimAt, src/ui/heat.js fmtH, src/ui/util.js hoursText]: the line under the Oath of Haste (par 100: 16.7, 33.3, ...) and so the heat shown ("3.3 h in hand"); DIM_HOURS_PER_HOP 2.5 (dims "at about 13.5 h" in the spec; the engine already rounded the node's dimming hour up); the HUD's day clock.

## A. Rules (old -> new)

| # | Rule (spec section) | Old | New | Balance effect |
|---|---|---|---|---|
| 1 | Unit of in-game time (rules 0) | hours (h), integer | tolls, whole numbers; 1 toll = 1 former hour; stored as `state.time` | none |
| 2 | The Star's line (rules 1.7.1, expedition H.1) | `line(z) = parHours × min(z, 6) / 6`, kept at 6 decimals | `line(z) = ceil(par × min(z, 6) / 6)`, in integers `floor((par × min(z, 6) + 5) / 6)` | none: for whole `time` and whole thresholds T, `time >= exact line + T` holds exactly when `time >= ceil(line) + T`, so every state, every `ascIfPar`, every preview's end state and the boss's Ascendancy (Camp line = par) are as before. Par 120: 20, 40, 60, 80, 100, 120 (unchanged). Oath of Haste, par 100: 16.67, 33.33, 50, 66.67, 83.33, 100 -> 17, 34, 50, 67, 84, 100; the heat shown moves by at most 0.67 to a whole number |
| 3 | Heat (rules 1.7.1) | `hours - line(z)`, 6 decimals | `time - line(z)`, a whole number of tolls | display only (row 2) |
| 4 | The Dimming's front (rules 1.9.6, expedition 6.2) | `front(hz) = floor((hz - DIM_GRACE_H) / DIM_HOURS_PER_HOP)`, DIM_HOURS_PER_HOP 2.5; a node dims at `ceil(DIM_GRACE_H + hops × 2.5)` | `front(zt) = floor(DIM_FRONT_HOPS × (zt - DIM_GRACE) / DIM_FRONT_TIME)` with 2 and 5; a node dims at `dimAt = DIM_GRACE + ceil(hops × DIM_FRONT_TIME / DIM_FRONT_HOPS)`; all in integers | none: the same schedule, hops 0-7 dim at zone toll 6, 9, 11, 14, 16, 19, 21, 24 (before: the same hours). `nextIn` (tolls until the front moves) = `dimAt(front + 1) - zt`, at least 1, as before |
| 5 | Zone time (rules 1.9.4) | zone hours `hz` | zone time `zt` (tolls since arrival at the hub) | none |
| 6 | Dimming clock on the meter (rules 1.9.10, expedition H.5) | `dimIn = dimAt(node) - hz` in hours | `dimIn = dimAt(node) - zt` in tolls; Smouldering at 3-4 tolls, Burning at 1-2 tolls, Infernal when Dimmed | none |
| 7 | State names shown to the player (rules 1.7.2, expedition H.2, H.4) | Clear, Warm, Hot, Scorched | Calm, Smouldering, Burning, Infernal (engine ids unchanged) | none |
| 8 | Meter name shown to the player (expedition H.4) | Heat | the Furnace | none |
| 9 | Meter place and look (expedition H.4) | fixed HUD element | top centre, always in view; a central bar with a moving pointer; left end a very calm setting, right end the core of hell [stated] | none |
| 10 | Day clock (UI) | "Day N, HH:00" in the HUD, "Day clock" on the hub, "zone hour" on the map | removed; the Furnace is the time display; the run's tolls are in its tooltip and the summary | none |
| 11 | Player-facing number format | `fmtH`: one decimal, "h" | whole numbers, the word "toll" / "tolls" written out, never abbreviated | none |

## B. Constants (old -> new name, value)

rules.md 13, expedition.md 13, balance.md 6. Every value is unchanged except row 21, which splits one constant into two.

| # | Old name | New name | Value | Unit (new) |
|---|---|---|---|---|
| 1 | HOURS_QUEST | TIME_QUEST | 2 | tolls (rows map) |
| 2 | HOURS_GRIND_WAVE | TIME_GRIND_WAVE | 1 | tolls per wave (rows map) |
| 3 | HOURS_ELITE | TIME_ELITE | 2 | tolls (rows map) |
| 4 | HOURS_DUNGEON | TIME_DUNGEON | 5 | tolls (rows map) |
| 5 | HOURS_REST | TIME_REST | 4 | tolls (Rest node, Inn) |
| 6 | HOURS_VENDOR | TIME_VENDOR | 1 | tolls |
| 7 | HOURS_TRAINER | TIME_TRAINER | 1 | tolls |
| 8 | HOURS_TREASURE | TIME_TREASURE | 1 | tolls |
| 9 | HOURS_SHRINE | TIME_SHRINE | 1 | tolls |
| 10 | HOURS_TRAVEL | TIME_TRAVEL | 2 | tolls (TRAVEL_ON, TAKE_ROAD) |
| 11 | HOURS_WALK | TIME_WALK | 1 | tolls (a walk or a pass) |
| 12 | HOURS_DIM_FIGHT | TIME_DIM_FIGHT | 1 | tolls (a Dimmed encounter) |
| 13 | HOURS_ASK_LOCALS | TIME_ASK_LOCALS | 1 | tolls (expedition.md; not yet in the engine) |
| 14 | EXPED_HOURS_QUEST | EXPED_TIME_QUEST | 3 | tolls |
| 15 | EXPED_HOURS_ELITE | EXPED_TIME_ELITE | 3 | tolls |
| 16 | EXPED_HOURS_GRIND_WAVE | EXPED_TIME_GRIND_WAVE | 2 | tolls per wave (Camp waves too) |
| 17 | EXPED_HOURS_DUNGEON | EXPED_TIME_DUNGEON | 6 | tolls |
| 18 | BELL_CHANNEL_H | BELL_CHANNEL_TIME | 2 | tolls |
| 19 | BOSS_TIME_PAR | BOSS_TIME_PAR (name kept) | 120 | tolls |
| 20 | DIM_GRACE_H | DIM_GRACE | 6 | zone tolls |
| 21 | DIM_HOURS_PER_HOP 2.5 | DIM_FRONT_HOPS 2 and DIM_FRONT_TIME 5 | 2 hops per 5 tolls | hops; zone tolls |
| 22 | ASC_STEP_HOURS | ASC_STEP_TIME | 10 | tolls |
| 23 | OATH_HASTE_HOURS | OATH_HASTE_TIME | 20 | tolls |
| 24 | META_TIME_BUDGET_H | META_TIME_BUDGET | 5 | tolls |
| 25 | HEAT_WARM_AT / HEAT_HOT_AT / HEAT_SCORCH_AT | names kept | 0 / 10 / 30 | tolls past the line |
| 26 | HEAT_DIM_WARM_H / HEAT_DIM_HOT_H | HEAT_DIM_WARM / HEAT_DIM_HOT | 4 / 2 | tolls until the player's node dims |
| 27 | HEAT_BAR_MIN / HEAT_BAR_MAX | names kept | -20 / 40 | tolls |
| 28 | HEAT_LINE_PER_ZONE (derived) | name kept | par / 6, the line rounded up per zone (20 at par 120) | tolls |
| 29 | VAL_HOUR (sim) | VAL_TIME | 6 | value points per toll |
| 30 | PLANNER_HOUR_MULT (sim) | PLANNER_TIME_MULT | 3 | × VAL_TIME |
| 31 | STYLE_SPEED_HOUR_MULT (sim) | STYLE_SPEED_TIME_MULT | unchanged | × |
| 32 | HEAT_SEEK_HOUR_MULT / HEAT_AVOID_HOUR_MULT (sim) | HEAT_SEEK_TIME_MULT / HEAT_AVOID_TIME_MULT | 0.5 / 4 | × VAL_TIME |
| 33 | HOURS_NORMAL / HOURS_SPEED (B17 bands) | TIME_NORMAL / TIME_SPEED | 125-155 / 80-110 | tolls at the boss |
| 34 | GREEDY_STAY_THRESHOLD | name kept | 0.15 | value per toll |
| 35 | NODE.<type>.hours (content table) | NODE.<type>.time | as rows 1-9 | tolls |
| 36 | OATH.haste.parHours | OATH.haste.parTime | OATH_HASTE_TIME | tolls |

Not time: the PACE_*_S terms (rules 3, combat-v2, expedition 9.4) are real seconds of play and are unchanged; "estimated minutes" in the summary is real time.

## C. Engine API renames (engine-api.md; the Core Gameplay Engineer edits it with the code)

| Where | Old | New |
|---|---|---|
| state | `hours` | `time` |
| event | `hours { add, total, why }` | `time { add, total, why }` |
| event | `bossStart { asc, hours, level }` | `bossStart { asc, time, level }` |
| `heatView` | `{ hours, par, z, line, heat, ... }`; line and heat at 6 decimals | `{ time, par, z, line, heat, ... }`, all whole numbers |
| `heatPreview` | `{ hours, hoursAfter, ... }` | `{ time, timeAfter, ... }` |
| `mapView` | `hz`; `moves[].hours`, `moves[].passHours`; `dim { graceH, hoursPerHop, front, nextIn, off }`; nodes `dimsIn`, `dimAt` | `zt`; `moves[].time`, `moves[].passTime`; `dim { grace, frontHops, frontTime, front, nextIn, off }`; nodes `dimsIn`, `dimAt` (whole tolls) |
| zone record | `start` (run hours at arrival) | `start` (run tolls at arrival) |
| summary | `hours`; `heat.hoursByState`; `expedition.zones[].hours` | `time`; `heat.timeByState`; `expedition.zones[].time` |
| `bossPar(state)` | hours | tolls |
| debug | `setHours(state, hours)`; `build({ ..., hours })` default `ceil(line of zone - 1)` | `setTime(state, time)`; `build({ ..., time })` default `line(zone - 1)` (now whole); `setHeat` sets `line + x` with x = -5 / 5 / 20 / 40 (whole, no ceil needed) |

No compatibility alias is needed: saves hold the profile, not a run [assumption: check src/ui save code; if a run is saved mid-way, read `hours` into `time` once].

## D. Player-facing wording (exact)

| Place | Text |
|---|---|
| Meter title | The Furnace |
| States | Calm · Smouldering · Burning · Infernal |
| Standing | "12 tolls in hand" · "On the line" · "8 tolls past the line" · "1 toll in hand" |
| Boss line | "Boss +4 %" |
| Reward line (Burning / Infernal) | "+35 % XP and gold, 1 in 2 drops a rarity up" / "+50 % XP and gold, 7 in 10 drops a rarity up" |
| Meter tooltip | "Tolls so far: 47 · the Star's line: 60" and "Oruvath grows stronger for every 10 tolls past 120 (Ascendancy)." |
| Dimming marker | "Dimming: 3 tolls" · "Dimmed" |
| Map node | "3 tolls" · "2 tolls/wave" · "walk 1 toll" · "dims in 4 tolls" |
| Moves | "Enter Ramsback Heath · 3 tolls" · "Walk to Windbarrow Hold · 1 toll" · "Pass · 1 toll" · "Take the Road · 2 tolls" · "Ring the Homeward Bell · 2 tolls" |
| Preview | "3 tolls, ends Smouldering" |
| Hub and Camp services | "Trainer · 1 toll" · "Inn · 4 tolls" |
| Toasts (once per state change) | "Calm: you are ahead of the Star." · "Smouldering: past the Star's line; the speed bonus is lost." · "Burning: the Unlit Star gains on you; spoils grow." · "Infernal: the Star burns high; spoils are richest." |
| Summary | "Tolls: 141 (par 120) · Ascendancy +4 %"; chart "Tolls against the Star's line"; "Tolls in each state: Calm 62 · Smouldering 51 · Burning 28 · Infernal 0" |
| Removed | "Day N, HH:00", "Day clock", "zone hour", "In-game time: N h", every "h" after a number, every decimal in a time value |

Fiction (tooltip and Content): the Unlit Star stirs a little more with every toll; the Furnace shows how hot it burns against the Star's line. Calm: it sleeps. Infernal: it is close to waking.

## E. Who changes what

| Who | Change | Check |
|---|---|---|
| Core Gameplay Engineer | Rename per tables B and C in src/constants.js, src/engine/*, src/rules.js exports; the line with integer ceil (heat.js); the front and `dimAt` / `nextIn` with DIM_FRONT_HOPS and DIM_FRONT_TIME in integers, no `1e-9` (expedition.js); engine-api.md and ARCHITECTURE.md rows in the same commit | qa/engine goldens identical except key names; a test over every zt 0-40 and hops 0-8 that the new front and dimAt equal the old ones; a test over par 100 and 120, z 1-7 and time 0-200 that the state and ascIfPar equal the old ones |
| UI/UX Engineer | Read `time` / `zt`; remove the day clock (util.js hoursText and its uses in hud.js, screens.js); `fmtH` -> whole numbers with "toll"/"tolls"; HEAT_NAME -> Calm, Smouldering, Burning, Infernal; the meter titled "the Furnace", at the top centre with the calm and hell ends (H.4); every string in table D | qa/browser checks for "Day ", " h" and decimals in time labels; a screenshot of the meter at each state |
| Simulation & Balance Engineer | Rename VAL_HOUR, PLANNER_HOUR_MULT, STYLE_SPEED_HOUR_MULT, HEAT_SEEK/AVOID_HOUR_MULT, HOURS_NORMAL/SPEED; read `time` | one paired cell (planner P0, 300 per class, warm-up table of 11-11) reproduces the pre-rename result run for run |
| QA | s13-constants and sim params tests follow the renamed tables | |
| Content Designer and lore chat (via the Lead) | docs/lore/style.md: tone rule "Hours are fine" -> time is counted in tolls; add the Furnace, toll, Calm, Smouldering, Burning, Infernal to the fixed terms | |

## F. Originality check (docs/lore/style.md 5)
| Name | Result |
|---|---|
| the Pyre (Lead default) | dropped: "Pyre" is a released game (Supergiant Games, 2017) |
| Kindled (Lead example state) | dropped: kindling is a well-known bonfire mechanic of the Dark Souls series |
| bells (Lead default unit) | dropped: "bells" is the hour unit of Eorzea time in Final Fantasy XIV, a classic fantasy MMO |
| the Furnace, Calm, Smouldering, Burning, Infernal, toll | plain English words; no game, book or film uses them as a named meter or a time unit in a way found by the search |
