# Blind tester: Skipper on the demo (MD D.7)

Date: 2026-11-26. Tester: fresh agent, Fable, high effort, no repo or docs access. Build demo.html 965406d, 1366x768. Persona: 22-year-old who skips text, clicks fast, uses autoplay at once; Rogue, guided first run switched off, hints off. 356 actions, 3 runs. Screenshot names refer to the tester's folder outside the repo.

Status: feedback. Lead triage in BACKLOG 2026-11-26.

## Runs

| Run | Level | XP | Nodes | Ended |
|---|---|---|---|---|
| 1 | 1 -> 1 | +630 | 1 treasure, 2 quests | died in a third quest (level 3 Hedge Ogre, round 11); Ember of Return used |
| 2 | 1 -> 1 | +743 | 3 quests, dungeon entered and fled | died in a level 2 quest, round 14 |
| 3 | 1 -> 2 | +1323 | 4 quests, trainer, treasure, Dimming fight, elite | Bell to zone 2, elite on an exit, Road: End of the demo |

Reached the demo-end screen without help on run 3. The zone 2 map's "End of the demo »" exits were the clearest direction in the session; zone 1 had no visible goal.

## Slowed down or made to read

- Autoplay does nothing on the map; every node, Accept, reward and loot window is a click (s0010).
- Autoplay turns off after a death and in a Dimming fight; must press Z again (s0061, s0263).
- No visible speed setting; Space skips per hit.
- Begin a new run: hero picker, camp, hub, map: four screens before the first fight.
- Loot gear lands unequipped; quest rewards have Equip now, loot does not (s0103).
- First level-up after two and a half runs (1 800 XP).
- Run-end screen of three columns and a Furnace chart (s0069); star-node tooltip a wall of text (s0258); top bar never explained, ignored for three runs.

## Where skipping hurt

- Same quest name three times; the third was level 3 in small text; accepted on reflex and died (s0052-s0069).
- Entered the dungeon at level 1 because a contract pointed there; four level-2 enemies; fled, then died (s0153-s0202).
- Node badge x1/x2/x3 (enemy count) never explained with hints off.
- Region Charts and Tracker's Notes bought twice, no visible effect.
- The opener menu (Ambush / Sap / Premeditate) only seen once, when autoplay was forced off.

## Kept between runs

Hero level and XP; Legacy points and unlocks (Packed Satchel, 5 potions); the camp grew (10 camp points, contract board). The end screen's Kept / Left behind box is "the best-written text in the game". Unsure whether spell ranks carry over.

## Wrong, broken or confusing

1. Quest panel under-counts enemies: lists 2, fight has 3 (s0052, s0059); dungeon adds a fourth that "answers the signal" (s0153).
2. Same quest three times in run 1 with the same reward; another repeated in run 2 (s0024-s0052, s0090, s0130).
3. A level 3 quest in a "Levels 1-2" zone with only a small orange number (s0052).
4. A hint appeared in the Legacy hall after hints were turned off, covering a row (s0071).
5. Tooltips cover the Bell and Road confirm dialogs (s0260, s0352).
6. "Homeward Bell" takes you forward with "No way back" (s0261).
7. Ring the Bell anyway dropped into an Infernal fight first, not expected from "+2 for a fight in the Dimming" (s0261, s0263).
8. "Not an upgrade" for a ring when the ring slot was empty (s0097).
9. "Upgrade (+0)" with tooltip "As good overall as what you wear" (s0310).
10. Star-node tooltip contradicts itself: Treasure, Unguarded, may be guarded, Lost to the Dimming, starts a fight (s0258).
11. Dimming went from 4 to 14 of 31 places in one dungeon attempt (s0143, s0169).
12. Top bar flipped Calm · 14 tolls to spare to Burning after a 1-toll step to the trainer; tolls number vanished (s0248, s0251).
13. Hedge Ogre still tagged NEW in run 2 (s0196).
14. Log prints "Combat: ..." before Accept or Enter (s0024, s0146).
15. Log shows a bare "30." line before the trap line (s0019, s0021).
16. No name typed: hero frame reads "Rogue / Rogue" (s0006).
17. Dungeon fight uses the open-field backdrop; enemy plates overlap with 3-4 enemies (s0153).
18. "Bargh the Drowned Ki..." truncated (s0342).
19. Demo-end screen: Furnace chart cut off behind the buttons (s0354).
20. Zone 2 quest givers have green faces (s0282, s0301).
21. Every zone 1 quest giver is the same sprite.
22. Confirm dialogs highlight Stay; a fast clicker hits the wrong one (s0261, s0352).
23. Bag fills with junk (12/16 mid run 3) with no quick way to clear (s0325).
24. Legacy hall uses only the left half of the screen (s0356).

## Wording

- Repeated: "Reward: experience, gold and a choice of two items." on every quest; the treasure line on every chest including Unguarded or Done; "Rogue, level 2" and "Level 2 Rogue · Greywater Fens" on the demo-end screen; "Costs N tolls ..." in several tooltips.
- Unclear: tolls to spare, Set by your tolls, Set by this place, This place counts as Calm; The Furnace chart lines; "Your node dims in 14 tolls", "0 of 31 places Dimmed"; "Enemies here deal up to 25 % more damage than their level alone"; "Three unlocks within reach." with one affordable (s0069); "1 contract here will expire ... They pay nothing" (s0261); "Gloam Eel Tales" with no eels.
- Machine-written: "Hedge Ogre answers the signal!"; "Stonewall Sentinel: Shield Ally -> Strike (no ally to shield)."; "Costs no turn, half strength (Packed Satchel)."; "Wind-up landed: Hedge Ogre's Heavy Smash."; "The Furnace: Burning · The Dimming is near." as a log line; affix item names ("Millroad Shoes of Quick Hands", "Deft Barleycorn Token").
- Keep: the Kept / Left behind box; "Zone 2 gives you 20 tolls, plus the 9 you saved: 29 to spare."; the LETHAL warning with the key; "End of the demo »".

## Scores

Clarity 4/10. Another run now: yes, one (just levelled, 62 Legacy to spend; no new goal after the end). Again tomorrow: 4/10; two level-1 deaths nearly made them quit.

## Top 3 changes (tester)

1. Show danger before the click: node level and enemy count on the map node, red when above the hero; quest panel lists every enemy that will appear.
2. Autoplay as a real fast path: stays on after a revive and in Dimming fights (or asks once), walks past loot windows, auto-equips upgrades, a visible speed toggle; Begin a new run goes straight back in with the same hero.
3. Show the zone goal on the map from the start as zone 2 does; mark zone 1 exits "Next zone", rename the Homeward Bell, stop tooltips covering confirm dialogs.
