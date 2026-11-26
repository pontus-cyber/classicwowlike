# Blind tester: Returning player on the demo (MD D.7, round 2)

Date: 2026-11-26. Tester: fresh agent, Fable, high effort, no repo or docs access. Build demo.html 4977f7b, 1366x768. Persona: 32-year-old roguelike player who plays for what carries over; Hunter "Vessa" with Ridgewolf. 449 actions, 3 runs. Screenshot names refer to the tester's folder outside the repo; some early run 1 points are from the tester's notes.

Status: feedback. Lead triage in BACKLOG 2026-11-26.

## Runs

| Run | Level | Ended | Earned | Spent |
|---|---|---|---|---|
| 1 | 1 -> 2 | End of the demo by the Road out of zone 2; 13 fights, 6 quests, no dungeon | 115 (55 play + 60 welcome) | Packed Satchel 50, Deeper Pockets 50 |
| 2 | 2 -> 4 | died: rang the Bell standing in the Dimming; the forced fight killed the hero after an Ember revive ("Killed by Bog Witch (Bolt)"); 14 fights, dungeon and boss, 1 contract expired | 62 | Quartermaster 70 |
| 3 | 4 -> 5 | End of the demo by the Bell in zone 2 from Calm; 6 fights, both contracts done, 24 tolls | 56 | none (Cartographer 60 affordable) |

Reached the demo end without help in run 1 (s0180). The Kept / Left behind box "is the best piece of text in the demo". Caveat: the demo can be finished very fast (run 1 at hero 2 without the dungeon; run 3 after 6 fights with 16 tolls unspent).

## Between runs

- Carried: hero level and XP, spells and ranks, talents (first point at hero 5), Legacy unlocks. Reset: gear, gold, potions, camp points.
- Hall: seven single-rank entries (s0354, s0356). The 60 welcome buys two after run 1; then 56-62 a run, about one entry a run, the whole hall in about 7 runs.
- Worth it: Quartermaster yes (the only purchase that changed how a run played); Packed Satchel modest; Deeper Pockets only delays the bag problem; the three stat entries no ("+2 % Power for a whole run's points is not something I would feel"); Cartographer the worse deal next to Quartermaster.
- Stronger next run: partly, mostly through setup (12 camp points paid for two contracts and supplies; both contracts done by the fourth node; damage taken 298 / 1 557 / 129 over 13 / 14 / 6 fights). But zones scale with the kept level (zone 1 "Levels 1-2" to "3-4", zone 2 "3-4" to "5-6") and gear resets, so the kept level "unlocks spells and talents; that is the real carry-over".

## Wrong, broken or confusing

1. Bell fight in the Dimming killed the run with nothing shown: with Autoplay and Speedrun, one click went from the map to "Vessa has fallen"; no enemy, fight or revive seen; the warning gives no threat level (s0349-s0351).
2. A chest re-offered the same item when bags were full, then paid the gold on the second open (s0315, s0319, s0332).
3. Camp "Up to three at a time" vs tracker "Contract slots 2/4" (s0360, s0370).
4. Hunter resource has three names: focus, "Resource: Full", "health and mana restored" (s0277, s0304, s0306).
5. Bags fill with junk constantly; each fight needs Leave then Leave again (s0297, s0338).
6. "Bags are full" three times on one screen: toast, loot panel, log (s0315).
7. Hunter weapon rewards are knives, hooks, a cutlass and a staff with a bow icon while the hero shoots a bow; "Upgrade (+18.5)" scores dwarf armour scores with no unit (s0376, s0308, s0315, s0443).
8. A map trainer node cost 1 toll with nothing to train; the hub row was correctly greyed (s0407, s0367).
9. Furnace state hard to predict: Calm, Burning, Smouldering, Calm, Burning in four nodes; what Burning does is unclear; an enemy "+30 %" tag while the bar said Calm (s0296-s0336).
10. Wanted contract close to luck: marks "up to 1 step away", the target region was Dimmed, it expired; easy in run 3 with Tracker's Notes (s0265-s0275).
11. Region Charts had no visible effect (s0370, s0437).
12. End-screen Furnace chart clipped; death screen caption cut (s0180, s0449, s0351).
13. "N unlocks within reach" counts each separately ("Four" with 77 points, "Seven" with 115) (s0351, s0180).
14. End-screen buttons differ between screens and "Same hero" vs "Next run" is unclear (s0449, s0351); the hall route adds two screens (s0189).
15. Accept and Engage show no key hint while Continue shows Space (s0414).
16. Speed options, including Speedrun mode, are under Esc (s0325).
17. First guide tip needed a hover to read in full (s0012).

Keep: the contract-expiry confirm (s0273); the toll carry-over line (s0275); "Your old Scout's Vest is left behind (no room in your bags)" (s0302); Autoplay.

## Wording

- Repeated: the full-bags line up to three times at once; "You receive loot: X (waiting in the loot window)." per item; the hero line twice in the end-screen header (s0449).
- Unclear: "Where: dim, round 6" (s0351); "It can be found at two Elite nodes away from the hub" (s0265); "2 marked sites, most of them in ..." (s0395); "This place counts as Calm"; "1 contract ... They pay nothing"; "Hero levels gained +20" vs "Hero levels gained (2) +40"; one thing has four names: nodes, places, sites, marks.
- Machine-written: the contract tooltip ("Sites won: 0 of 1. Only nodes with its mark count; ..."); "Contract slots 1/4 · 1 done · 0 camp points"; "Costs 4 tolls: 2 for the Bell, +2 for a fight in the Dimming." as a warning.
- Reads well: quest-giver lines, the rest line, the Kept / Left behind box.

## Scores

Clarity 6/10. Another run now: yes (the hero, not the hall: level 6 unlocks Muzzle Shot, a talent build started). Again tomorrow: 5/10 (seven small one-rank unlocks, zones scale, gear resets: "I can see the ceiling already"). What the demo kept, in one sentence: yes.

## Top 3 changes (tester)

1. Make carry-over feel like power: stop zones fully scaling with the kept level, or deepen the hall (more entries, ranks, effects larger than +2-3 %); rework Cartographer.
2. Make the Dimming Bell fight visible and survivable for autoplay players: enemy and threat in the confirm, pause autoplay and speed for it, show the death before the fallen screen.
3. Fix inventory friction: a junk pouch or auto-sell, one-click Leave, "bags full" once, fix the chest that re-offers its item.
