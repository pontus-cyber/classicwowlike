# Blind check: Newcomer reads the map systems (D144, after D152)

Date: 2026-11-15. Tester: fresh agent, Fable, high effort, no repo or docs access, played game.html build 902c976 through screenshots at 1366x768. Persona: 28-year-old occasional player, reads short hints but not long tooltips, first time with the game. Brief: play the guided zone 1 and explain the map systems in own words.
Session: Mage, about 80 actions, left zone 1 by Road at level 10 after 4 fights plus Gorrak; no deaths, no potion used. Screenshot names refer to the tester's shots folder outside the repo.

Status: feedback. Lead triage done (see BACKLOG 2026-11-15).

## Understanding

| System | Understood | Where |
|---|---|---|
| Tolls as a cost | Fully | s0010, s0016 |
| Tolls and the final boss | Partly | budget reset to 20 in zone 2 (s0142): does overspending carry over? |
| What the Dimming is | Fully | s0033, s0063 |
| How fast it moves | Partly | felt at s0084 and s0105; the number only in a long tooltip (s0055, "at most 2 places a toll") while the box later says 3 (s0128) |
| Top bar, basic reading | Fully | s0010, s0012 |
| Top bar diamond marker | Not at all | jumps around, never explained (s0017, s0040, s0057, s0101, s0133) |
| BURNING with tolls to spare | Only after hovering | s0133; explained at s0139 |
| Why Gorrak matters | Fully | s0036, s0084 |
| Where Gorrak is | By accident | s0066: node titled "Unknown" |
| How to leave | Mostly | s0107, s0137 |
| Which node is "on the Road" | Only after a mistake | s0129 |

Own words (excerpt): tolls are "the price of doing anything on the map"; the Dimming is "darkness that starts at the purple star on the rim and eats the map node by node as you spend tolls"; Gorrak is "the gate to leaving".

## Most lost moment

s0129: after Gorrak, a quest on a node that looked next to the Road signpost; back on the map the Road node said "Not next to you", the hub was dark, 18 of 31 dimmed, the only way on showed a red "4 tolls". Escaped only by noticing "Pass through (1 toll) X"; no hint taught pass-through. Suggested: highlight the rim node that belongs to each Road and draw the line from signpost to node; once Roads open show "Nearest Road: 2 hops, 4 tolls"; one hint for pass-through the first time a red toll label appears. Second: s0133, BURNING while 3 tolls to spare.

## Contradictions and bugs

- BURNING while the marker is left of the red line and the table defines Burning as overspent; the reason ("The Dimming near you sets the Furnace now") only on hover (s0133, s0137, s0139).
- Dimming tooltip "at most 2 places a toll" vs box "Spreads in 1 toll: 3 places" (s0055, s0128).
- Grind node "Costs 4 tolls... Burning bonus +35 %" with exactly 4 to spare (s0131).
- Same quest node cost 3 tolls, later 5 (red), no reason (s0033, s0065).
- Two quest nodes both named "The Hedge Breaker" (s0037, s0038), and "Straw and Tusk" (s0065, s0068): names follow the order taken, so map tooltips name the wrong quest.
- Trainer "Next spell at level 4" then level 3 banner "New at the trainer: Arcane Ward" (s0010, s0049); Rime Burst "Requires level 10" announced as new at level 8 (s0058, s0101).
- "He comes back after 1 more fights" on a node titled "Unknown" (s0066); Gorrak's tooltip titled "Elite", name in small print (s0086).
- "One point every 2 levels" but 1 point at level 10 (s0108).
- Mage offhand "Quiver of Rushes" with a book icon (s0126).
- Bags window over the Loot window hides Continue (s0028); hint bubble over the "SPACE..." prompt (s0026); Key tooltip covers half the key (s0054).
- About 1.5 s of empty screen after "Set out" (s0013).
- "Dims in 1!" / "dims in 2" labels float between nodes (s0134).
- Bags 3 to 10 of 16 without seeing what filled them (s0124).

## Ratings

| | Score |
|---|---|
| Clarity of the map | 5 |
| Clarity of fights | 8 |
| Amount of text | 6 |
| Fun | 6 |
| Would play again tomorrow | 6 |

Difficulty: level 10 against level 5 enemies, Gorrak never hit once (s0097, s0101); no ward, potion or Ember needed; the Deathblow banner names the exact key, "nothing to work out".
