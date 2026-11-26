# Blind tester: Skipper re-test on the demo (MD D.7, round 2)

Date: 2026-11-26. Tester: fresh agent, Fable, high effort, no repo or docs access. Build demo.html 4977f7b (blind fixes A-D), 1366x768. Persona: 22-year-old who skips text, clicks fast, uses autoplay and speed at once; Rogue. About 320 actions, 4 runs. Screenshot names refer to the tester's folder outside the repo.

Status: feedback. Lead triage in BACKLOG 2026-11-26.

## Runs

| Run | Level | Ended | Fights | Legacy |
|---|---|---|---|---|
| 1 | 1 -> 1 | rang the Homeward Bell from the Greywater Fens hub unread; End of the demo at about action 33 | 2 | 80 (60 welcome + 20 zones) |
| 2 | 1 -> 1 | died on autoplay in the third quest fight; Flee at 27 HP, then the death screen | 3 | 2 |
| 3 | 1 -> 2 | died to dungeon boss Warden Belk (level 3, 484 HP) at 15 % | 7 | 22 |
| 4 | 2 -> 3 | cleared most of zone 1, Road, 3 elites and the trainer in zone 2, Road out: End of the demo | 11 | 57 |

Reached the demo end twice without help (s0033, s0315). The first felt unearned: two fights, nothing in zone 2, about two minutes, and it paid more Legacy than the real clear.

## Slowed down / skipping hurt

- Speed chip "SPEED 1×" sits in the combat log header far from Autoplay; several misclicks to find (s0006-s0016).
- Autoplay resets every run; speed persists. Autoplay only fights: every node, loot and reward still needs Space or a click.
- Full bags: Space ("Take all") stops working; Leave needs two clicks; four times in run 4 (s0211-s0308).
- Quest reward with no upgrade: no button and Space ignored (s0205, s0207).
- Leaving with a contract: tooltip and dialog with the same text (s0313).
- Guide skipped: never learned tolls, Furnace states or the Dimming.
- The zone 2 Bell looks and sits like zone 1's "next zone" Bell; clicked it and ended run 1 (s0032).
- Autoplay walked into a three-enemy level 2 quest at level 1 and died (s0066).
- Dungeon at level 2: the rest screen warned, pressed on, died (s0128, s0134).
- Four contracts taken, none completed; marked sites never found; a second site never visible (s0279).
- Ember of Return bought every run, never understood.
- Vendor gear goes to bags; upgrades sat unequipped and were later left behind (s0193, s0224, s0215, s0308).

## Kept between runs

Hero level and XP, spells and ranks, Legacy unlocks (Quick Study, Deeper Pockets); talents listed but never seen. Lost: gear, gold, potions, camp points. The camp grew after run 1.

## Wrong, broken or confusing

- "You made it through Amberfold Downs and Greywater Fens" after two fights, paying 80 against 57 for a real clear (s0033).
- Class-select subtitle "from run to.run" (s0321; seen once before as a particle overlap).
- Camp "Up to three at a time" vs HUD "Contract slots 1/4" (s0038, s0180).
- Same elite, Sisel Mistweaver, twice in one zone in one run (s0283, s0305).
- "Enemies: 2 Old Marrow the Hexer, 1 Bramble Herbalist": levels read as counts (s0219).
- Reward panel with two "Not an upgrade" items has no button or Space default (s0205, s0207).
- "Items waiting" window at a treasure node before the chest was opened (s0239).
- Demo-end Furnace chart cut off behind the buttons (s0315).
- "Six unlocks within reach" with 81 points (s0315); "Seven" in run 1 (s0033).
- First guide hint cut off (s0005).
- Header BURNING with "Entered while Smouldering: this place still counts as Smouldering" (s0178).
- Purple number badges and dots not in the Key (s0184).
- Contract HUD "None in this zone / Later: 1 contract (zone 2) · L" (s0180).
- Vendor locks after closing; cannot return to sell (s0197, s0266).
- A "Levels 1-2" zone has a level 3 boss with 484 HP (s0128, s0134); Greywater Fens "Levels 1-2" in run 1 and "1-3" in run 4 (s0032, s0275).
- Flee at 27 HP gave no feedback before the death screen; "Returned to the fight: 1" unexplained (s0066, s0067).
- Price "1 [silver] 0 [copper]"; end screen says "Gold" and counts "10 s 71 c" (s0192).

## Wording

- Repeated: the demo leave line in tooltip and dialog on one screen (s0032, s0313); full-bags line as toast and in the loot window together (s0213); the end screen gives the Legacy total three ways (s0067); "Level 1 Rogue · Greywater Fens" under "Rogue, level 1" (s0033); every elite has the same Threat and Reward lines.
- Unclear or machine-like: "Kept: level 1 (was 1)"; "Per zone: above 0 overspent, below 0 to spare"; "Nodes entered, by the state you entered them in ..."; "Enemies here deal up to 25 % more damage than their level alone"; "Entered while Calm: this place still counts as Calm", "Raised by the Dimming nearby", "Set by your tolls"; "Beat the fen beasts at 2 marked sites, most of them in Sedge Flats"; "Hero levels gained +20" for one level; a space before every percent sign.

## Scores

Clarity 5/10. Another run now: yes (level 3, new spells, wants the boss that beat them). Again tomorrow: 5/10 (seen End of the demo twice; three runs to level 2 felt slow).

## Top 3 changes (tester)

1. Stop the two-minute End of the demo: make the zone 2 Bell look different from zone 1's; do not say "you made it through" or pay 80 for a run with no fights in the last zone.
2. Space always moves forward: full bags do not block it, vendor upgrades equip, the reward screen has a default pick.
3. Autoplay and Speed together and kept between runs; one plain line on tolls and the Dimming when they bite; a danger cue on nodes autoplay cannot win at your level.
