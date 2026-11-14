# Blind tester re-run: Casual (D144, M3 3.8, after the D150 text pass)

Date: 2026-11-14. Tester: fresh agent, Fable, high effort, no repo or docs access, same persona brief as the 2026-11-13 pilot, played game.html build c18c372 through screenshots and key/click actions at 1366x768.
Session: one Rogue run, guided first run on, about 240 actions; ended alive at level 10 in zone 2 after two rescues. Screenshot names (sNNNN) refer to the tester's shots folder outside the repo.

Status: feedback (ideas and findings, not work orders). Lead triage pending.

## Scores against the pilot (2026-11-13, build 30a5f30)

| Rating | Pilot (Rogue) | Re-run (Rogue) |
|---|---|---|
| Clarity | 3 | 4 (fights clear; map, tolls, Dimming and heat not) |
| Fun | 5 | 5 |
| Challenge | 3 ("none for 20 minutes, then a wall") | 6 ("swings between trivial one-shots and unwinnable") |
| Look | 7 | 7 |
| Would play again tomorrow | 4 | 4 |

## 1. What is this game

A turn-based fantasy RPG on a round zone map of nodes (quests, grind fights, chests, a dungeon, a camp, a town). Every move costs tolls and a purple Dimming eats the map over time. Side-view fights with combo points and a finisher, enemies' next three moves shown. The heat bar (Calm / Smouldering / Infernal) was never understood beyond "bad if it goes right".

## 2. First 5 minutes

Clear: hero select and naming (s0001); the Q/W/E opener menu with one line each (s0020); hotbar, potion on 8 and the "YOUR TURN" bar; enemy next-move chips; the quest panel with one Accept button; reward choice with "Upgrade (+2.4)" and "Equip now" (s0102), "exactly how much I want to read".
Confusing: start camp supplies bought blind; tooltip still says "press A to buy" after buying (s0004-s0010); the town says Trainer/Vendor/Inn cost tolls before anything says what a toll is (s0011, s0012); the first map shows six systems at once (Dimming box, "spreads again in 2 tolls", "your node dims in 7 tolls", CLOSED signs, "Ring the Bell (1)", "Contract slots 1/4 - Reserve 0", regions, heat bar) (s0014); the map "Key" box is an empty header in every screenshot (s0014, s0105, s0234); "3 tolls overspent" (s0243) never explained.

## 3. Where it got stuck or did not work

- Second fight: a node marked "guided fight", level 7 with 2 enemies at player level 4 (s0040). Three misses or dodges, enemies gained +10 % per turn, a potion cost the whole turn, 79 HP with 88 incoming (s0057); fled. "'Guided' suggested safe; it was not."
- Clicking an item in the Loot window does nothing (s0071-s0073); wearing a dropped upgrade needs Continue, Bags, click, Equip (s0077-s0079). Quest rewards have "Equip now", drops do not.
- Never visited a Trainer from level 1 to 8; nothing reminded. In the second town two rank-ups and two new spells were waiting (s0279). Played zone 1 including the dungeon boss with two buttons.
- Dungeon (Harrow Cellars, level 5, entered at 6): fight 2 lasted 24+ rounds against two guards, a deserter and a reinforcement; out of energy most turns; dodge streaks (s0198). "Boring, not tense."
- Dungeon boss: 629 HP, no potions, Flee greyed out; switched Autoplay on and watched; died, rescued (s0232, s0233).
- After that rescue 26 of 31 nodes were Dimmed, bar on INFERNAL, "1 toll to spare" (s0234). "One dungeon visit burned the whole zone and I did not see it coming." Every move then forced a Dimmed fight.
- "Take a Road to leave": clicking the "Greywater Fens >>" label at the map edge did nothing (s0235-s0237); walking to a Road node cost tolls and forced a fight against level 12 enemies at player level 8 (s0254, s0269); an Ember of Return bought blind and Flee saved the run.
- Autoplay left on walked from one won fight straight into a second forced fight and died there, using the last rescue (s0245-s0249). Autoplay never flees.
- Zone 2 (levels 11-20) at player level 8: every node level 12-14 (s0303). The 5-point finisher missed on the opening turn (s0314).

## 4. Ignored or skipped

Contracts, Reserve and Swap (took the first, it expired half done); the Bell; the heat bar and Dimming numbers until they punished; Sap (a paragraph; Premeditate was simpler), used only when the boss screen said so in red (s0215); enemy tags ("GUARDS DESERTER", "SIGNAL R4", "WARD"); character sheet, spellbook, quest log; town services in zone 1 (cost tolls); talents until the level 10 hint (icons have no names until hovered, s0327, s0331); Pass (X).

## 5. What felt good

Premeditate then finisher one-shotting a level 3 enemy (s0069-s0071), "best moment of the session"; fast level jumps; the red "DEATHBLOW R3 ... Disrupt now [W]" warning with the highlighted interrupt (s0215, s0314): "the game told me the one thing to press and it worked. More of that."; "Low health: [8] Healing Draught +151" in the turn bar (s0180); enemy damage shown before it lands; green upgrade arrows and "Equip now" on quest rewards; the moonlit swamp of zone 2 (s0277); one-click "Train all" and "Sell junk".

## 6. What would make the tester quit

Long two-button slog fights with miss and dodge streaks; a "guided" fight nearly killing on the second fight; the map going almost fully dark after one dungeon attempt, then every step a forced fight above level; arriving in a level 11-20 zone at level 8 with no visible way to catch up; too many named systems at once ("I would like two of them in the first zone, not seven").

## 7. Bugs and visual problems

- Rescue banner overlaps the map panel text (s0061).
- Dungeon rest panel does not refresh after eating Trail Rations (bar 420/420, panel 325/420 and "(2)") (s0146, s0148).
- Harrow Cellars described as sunken storerooms but fought on the sunny meadow (s0109-s0215).
- Dungeon count: entry "3 groups, then Warden Belk", counter "Fight 1 of 4", boss arrives as "Fight 3 of 4" after "Fight 2 of 4 cleared" (s0109, s0210, s0215).
- With four enemies the next-move chips and name plates overlap and are cut off ("Rust-Shackled Gua", "Shiel...") (s0162, s0166).
- "Hedgerow Cutpurse" target frame shows the ogre portrait (s0254).
- Bought supply tooltip still says "press A to buy" (s0010).
- Map "Key" panel empty (s0014 and all map shots).
- Clicking the Road label at the map edge gives no feedback (s0235-s0237).
- Map labels collide ("dims in 4" over a node, "1 toll" badge over the hub, "Greywater Fens" over a node) (s0105, s0234, s0249).
- "SPACE OR CLICK: SKIP THIS HIT" barely legible behind the hero (s0245 on).
- Talent tooltip covers its own rank counter (s0334).
- Autoplay keeps running across fights and on the map after a death and rescue, starting the next forced fight (s0234-s0249).
