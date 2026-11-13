# Blind tester report: Casual (D144 pilot)

Date: 2026-11-13. Tester: fresh agent, Fable, high effort, no repo or docs access, played game.html (build 30a5f30) through screenshots and key/click actions at 1366x768. Persona: 30-year-old evening player, skims text, impatient when unclear.
Session: one Rogue run with the guided first run on, 247 actions, about 25 minutes. Reached level 12 in zone 2 and died in the first normal quest fight there. Screenshot numbers (sNNNN) refer to the tester's shots folder (kept outside the repo).

Status: feedback (ideas and findings, not work orders). Lead triage pending.

## 1. What is this game, as understood

A turn-based fantasy RPG where you walk node to node on a round zone map; nodes are fights, quest givers, chests, trainers or rest stops. Fights are side-view with number keys: one attack builds combo points, another spends them. Enemies show their coming moves. You level fast, get gear and spells, then move on. The second layer (tolls, the Dimming, the Furnace from Calm to Infernal) was never really understood; "tolls = a budget of moves per zone" became clear only after about 15 minutes, from the "Ring the Bell" tooltip.

## 2. First 5 minutes

Clear:
- Hero select: one big button, a hero preselected (s0001).
- First fight: press 1 three times, the finisher lights up, press 2, enemy dead (s0017-s0024).
- Enemy intent with damage numbers.
- Quest givers: two lines of text, an enemy list, Accept (s0034).

Confusing:
- Start camp shows Contracts, points, supplies and sight, Reserve and Echoes before any monster (s0002-s0007). Bought potions and the revive, skipped the rest.
- First town top bar: "The Furnace / CALM / 20 tolls in hand / Dimming: 14 tolls" means nothing yet (s0009).
- "Visit the trainer" advice: nothing to learn at level 1, cost a toll (s0010).
- After "Set out" a tip says "Click a lit node" with no map on screen; the map appears only after dismissing the tip (s0012, s0013).
- The map shows a Dimming box, a six-state key, a region list, a Moves list, toll labels and "Ring the Bell (1)" at once (s0013).
- Contract sites: the tip points at the bottom of the map, not at a node. A fight won in the right region did not count; only pin-marked nodes count, found by hovering (s0015, s0016, s0026, s0032).
- "Pays Calm: no reward" read as "this fight gives nothing" (s0015).
- "Stay left of the Star's line": what star, what line? (s0030-s0032).

## 3. Stuck or did not work

1. Contract: won a fight in the named region; contract stayed 0/2 (s0026). Only pin-marked nodes count.
2. Not enough energy, no message: pressing the finisher at 30 energy (cost 35) did nothing; same later with key 1 at 30 energy, cost 40 (s0075, s0239). The button is only slightly darker.
3. Elite node in zone 1 has no tooltip (s0093, s0094, s0158).
4. "Train all" does not learn new spells; each needs "Learn" (s0115-s0118).
5. Zone 2 hub misclick: taking a contract removed its card, the list moved up, the next click hit Inn instead of Trainer: 4 tolls for a rest at near full health, no confirm, no undo (s0161-s0164).
6. Bag items move after each equip (s0150-s0153).
7. Elite "Bargh the Drowned King" (level 18, 872 HP) at player level 10 (s0186-s0215): the tip said "then wait a round (X)" while the banner said "keep 4 Throat Jab for round 3" (s0190). The off-balance tip said "Spend your big hit now"; the hit crit for 0 (88 absorbed) (s0193, s0196). After six rounds he was still at 872/872. The pre-fight card said "Threat: High" but nothing said hits would do nothing.
8. Flee: F showed nothing (s0204); the confirm text "Press Flee again to run" is faint and fades (s0206); failed twice, worked the third time; about 200 HP and 3 tolls lost (s0209-s0215).
9. Death (s0217-s0247): quest "The Lost Causeway", two level 16 enemies; a third (Mire Brute) walked in at round 4 (s0229) after a small "SIGNAL R4" tag that was not understood. 366 HP to 4 HP in five rounds; revive used, potions ran out, Autoplay on, died at round 23.

## 4. Ignored or skipped

Hero name, seed, other heroes; "Sight" and other camp purchases; the Furnace bar and the Dimming; most guide tips from about the fourth one (each brings a new word); the map Key and Regions panels; Sap and Ambush until the game pointed at W; Throat Jab and Open Vein; talents (three trees of unnamed icons); vendor, the dungeon contract, "Pass" moves, "Swap" on contracts; who Gorrak is; the combat log.

## 5. What felt good

- Combo points: jab, jab, jab, finisher, with the lit finisher button.
- Big opening hits (Premeditate then finisher for a 78 crit, s0064; Shadowstep Strike for 89, s0128).
- Enemy next moves with numbers.
- Auto-switch to the next target.
- "Upgrade (+16.3)" on rewards: pick gear without reading stats.
- "Deathblow answered: staggered" after pressing the shown key: the one time a complicated mechanic was easy.
- The look: sunny downs then a misty swamp; the zone change was the nicest moment.
- Pace: short fights, skippable animations.

## 6. What would make the tester quit

- The vocabulary: tolls, Furnace, Calm/Smouldering/Burning/Infernal, Dimming, Shardfall, the Star's line, Reserve, Contracts, par, sight, Echoes, Deathblow, Wind-up, Off-balance, Staggered, Empowered, Signal, maims.
- The difficulty jump: nothing could hurt in zone 1 (level 1 to 10 in five fights; autoplay won a quest fight in two seconds, s0101); the first normal zone 2 quest killed. Nothing in between taught proper play, so the death felt unfair.
- Losing the whole run after 25 minutes.
- Tips that led wrong ("visit the trainer"; "spend your big hit now" into a shield).
- Flee needing two presses, then failing twice.
- Housekeeping: manual equip for every item including chosen rewards; paying the trainer again at every level.
- Levels meaning nothing (2 to 5 in one fight, s0045).

## 7. Bugs and visual problems

Text and data:
- "WIND-UP R3 null" / "WIND-UP NOW null" (s0219, s0223).
- Combat log shows "You receive 453 copper" and the hood before "Open the chest" is clicked (s0175).
- "You flee from the fight." logged twice (s0215).
- Tip says "Deathblow on turn 2" while labels say round 3; the same Deathblow warning appears in five places on one screen (s0188).
- Elite tooltip says "one level higher"; elite level 17, player 10 (s0184).
- "Contracts 1/4" changed to "0/4" on completing a contract (s0079).
- XP bar "0 / 1600" right after three levels in one fight (s0045), possibly coincidence.

Overlaps and clipping:
- Green toasts drawn over the centre banner ("Entering Amberfold Downs", "LEVEL UP") (s0009, s0079).
- Furnace header "SMOULDERING · Dimming" spills outside its frame (s0123 on).
- Region names "ROTPLANK CAUSEWAY" and "GLOAMWATER HOLLOW" overlap at the bottom of the map (s0215).
- "You have died" drawn over the enemy's Next Actions panel (s0247).
- "Deathblow answered: staggered" collides with the guide tip box (s0193).
- After a fight: map, leftover node tooltip, guide tip and Bags window stacked; tips half hidden behind tooltips (s0026, s0030, s0032).
- Tooltips cover needed things: a leftover map tooltip over a bag slot, the potion tooltip over the bag's second row, the trainer tooltip over the price column (s0086, s0106, s0010, s0113).
- Equip/Discard popup over the clicked item and neighbours (s0087, s0090, s0150).
- Map Moves list clipped at the right edge; hub list cut off at the bottom, Inn row half hidden, no visible scrollbar (s0013, s0161).

Other:
- No tooltip on the zone 1 elite node (s0093, s0094, s0158).
- Hero still holds daggers after equipping the staff-type "Elm Switch"; a Rogue offered Intellect switches as an "Upgrade" (s0118 on).
- Marsh Lurker sprite nearly invisible against the swamp background (s0219 on).
- Tiny "⇄ target" tag on every action button, unreadable (s0193).

## 8. Ratings (1-10)

| Rating | Score |
|---|---|
| Clarity | 3 |
| Fun | 5 |
| Challenge | 3 (none for 20 minutes, then a wall) |
| Look | 7 |
| Would play again tomorrow | 4 |
