# Hand-off: Lead Game Designer, 2026-11-11b (M2b v7: time in tolls, the Furnace)

Task: give heat its own name, replace hours with a small whole-number unit across the rules, the expedition and pacing, and fix the meter's wording [stated: docs/feedback/2026-11-11-1012-owner.md]. Spec: docs/specs/changes-m2b-v7.md. Decisions D68-D71 (team; names owner review). Status: draft, not yet in the engine, UI or sim.

## Pitch for the owner
1. Heat is now **the Furnace**. It reads **Calm**, **Smouldering**, **Burning** or **Infernal**. The cool end is a calm scene and the hot end is the core of hell, with a pointer on a bar at the top centre.
2. Time is counted in **tolls**. Every choice costs a few tolls, from 1 to 6, and always a whole number. There are no hours, days, clock or decimals anywhere.
3. Nothing about difficulty changes. One toll is exactly one old hour, so every cost, the boss par (120) and every threshold keep their numbers.

Example: a zone in the new numbers (expedition, Highcairn Reach, zone 3; the Star's line is at 60, arriving on schedule at 40 tolls)

| Choice | Cost | Tolls so far | The Furnace |
|---|---|---|---|
| Arrive at Windbarrow Hold | - | 40 | Calm, 20 tolls in hand |
| Trainer | 1 | 41 | Calm, 19 in hand |
| Enter a quest next to the hub | 3 | 44 | Calm, 16 in hand |
| Enter an elite | 3 | 47 | Calm, 13 in hand |
| Walk through a cleared node | 1 | 48 | Calm, 12 in hand |
| Enter the dungeon | 6 | 54 | Calm, 6 in hand |
| Enter a quest | 3 | 57 | Calm, 3 in hand |
| Walk to the Road | 1 | 58 | Calm, 2 in hand |
| Take the Road | 2 | 60 | On the line (Smouldering); in zone 4 the line moves to 80: Calm, 20 in hand |

If the player stays for one more elite and a quest instead (6 tolls), they reach the Road at 66, which is Smouldering, 6 tolls past the line. Pushing on to 70 or more makes them Burning. From then on, every node they enter pays +35 % XP and gold, and 1 in 2 drops come one rarity up. The cost is that the boss gains +2 % for every 10 tolls they never win back. The Dimming in this zone: the Shardfall goes dark at zone toll 6, the hub (3 steps away) at 14, and the far rim at 21-24. The map shows "dims in N tolls" on every node.

## Alternatives (owner choice; the default is in bold)
| Item | Default | Alternative 1 | Alternative 2 |
|---|---|---|---|
| Meter | **the Furnace** | the Brazier | the Cinderline |
| States | **Calm / Smouldering / Burning / Infernal** | Still / Glowing / Blazing / White-hot | Cool / Simmering / Searing / Molten |
| Unit | **tolls** ("3 tolls"; a toll is also a price paid) | candles ("3 candles"; light against the Dimming) | marks ("3 marks") |
| Scale | **1 toll = 1 old hour** (no balance change) | B: 1 toll = 2 old hours: par 60, line 10 per zone, Ascendancy step 5, thresholds 0 / 5 / 15, Dimming grace 3. Walks, services and Dimmed encounters cost twice as much relative to nodes, and quests and elites 33 % more (3 h -> 2 tolls). Every balance target needs a re-measure: B1, B3, B17, B43-B47, B56-B58. Not recommended | |

The Lead's defaults "the Pyre", "Kindled" and "bells" failed the originality check (docs/lore/style.md 5). Pyre is a released Supergiant game, kindling is the Dark Souls bonfire mechanic, and bells are Final Fantasy XIV's hour unit. They are recorded in changes-m2b-v7.md F (style.md 5.5 asks for a docs/feedback note; this hand-off stands in for it so that only the requested docs are committed).

## Balance deltas
None. For the default par (120) every value is identical. The two rules that change form keep every heat state, every projected Ascendancy and every dimming toll exactly. These are the line rounding up per zone (it only matters under the Oath of Haste: 17, 34, 50, 67, 84, 100) and the Dimming's 2 hops per 5 tolls. I checked this with a script (/tmp, not committed) over par 100 and 120, zones 1-7, run time 0-250 and zone time 0-60: 0 mismatches. B1, B3, B17 and B58 are unchanged and need no re-measure. The sim's seeded cells and the QA goldens must reproduce run for run, and only key names change.

## What engine, UI and sim must change (details: changes-m2b-v7.md B, C, E)
- Engine: rename HOURS_* / *_H to TIME_* and `hours` to `time` (state, events, heatView, heatPreview, mapView `hz` -> `zt`, summary, debug `setHours` -> `setTime`). The line uses integer ceil. The front, `dimAt` and `nextIn` use DIM_FRONT_HOPS / DIM_FRONT_TIME in integers. Update engine-api.md and ARCHITECTURE.md in the same commit.
- UI: remove the day clock (util.js hoursText; hud.js, screens.js "Day clock", "zone hour", "In-game time"). Show every time label as a whole number followed by "toll" or "tolls". Use the state names Calm, Smouldering, Burning and Infernal. Title the meter "the Furnace" and place it top centre with the calm and hell ends. Use the texts in table D.
- Sim: rename VAL_HOUR, PLANNER_HOUR_MULT, STYLE_SPEED_HOUR_MULT, HEAT_SEEK/AVOID_HOUR_MULT, HOURS_NORMAL/SPEED and read `time`. Then check one paired cell for identity.
- Lore and Content (via the Lead): docs/lore/style.md still says "Hours are fine". It should say time is counted in tolls, and add the new fixed terms.

## Owner-review items
1. The names (D68): the Furnace, Calm / Smouldering / Burning / Infernal, tolls.
2. The scale: 1 toll = 1 old hour (D69). Alternative B gives smaller totals but costs a full re-tune.

## Commits
| Commit | What |
|---|---|
| (this commit) | rules.md, expedition.md, balance.md edits; docs/specs/changes-m2b-v7.md; DECISIONS.md D68-D71; this hand-off |

Files: docs/specs/{rules,expedition,balance,changes-m2b-v7}.md, docs/DECISIONS.md, docs/handoffs/designer-2026-11-11b.md. src/, sim/ and docs/lore/ are untouched.

## How it was checked
- grep over the three specs: the only "hour" / "h" left are historical measurement records (rules 3 measured line, 11.2 Wayfinder note; expedition 9.5, 12, H.7; balance notes). Each spec's status line says to read 1 h as 1 toll.
- Integer equivalence script: 0 mismatches. The dimming tolls for hops 0-7 are 6, 9, 11, 14, 16, 19, 21, 24, and the Oath line is 17, 34, 50, 67, 84, 100.
- Web searches for the originality check of the names.
