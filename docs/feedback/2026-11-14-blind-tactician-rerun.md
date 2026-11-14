# Blind tester re-run: Tactician (D144, M3 3.8, after the D150 text pass)

Date: 2026-11-14. Tester: fresh agent, Fable, high effort, no repo or docs access, same persona brief as the 2026-11-13 pilot, played game.html build c18c372 through screenshots and key/click actions at 1366x768.
Session: one Mage run, guided first run on, about 240 actions, never died; alive at level 13 in zone 2 after 7 fights. Did not fight Gorrak. Screenshot names (sNNNN) refer to the tester's shots folder outside the repo.

Status: feedback (ideas and findings, not work orders). Lead triage pending.

## Scores against the pilot (2026-11-13, build 30a5f30)

| Rating | Pilot (Mage) | Re-run (Mage) |
|---|---|---|
| Clarity | 6 | 6 (combat 8, map and meta systems 4) |
| Depth | 5 | 5 |
| Challenge | 3 | 3 |
| Fun | 6 | 6 |
| Look | 7 | 7 |
| Would play again tomorrow | 6 | 6 |

## 1. What is this game

Single-character turn-based roguelike with MMO dressing: class pick, 10 camp points, circular zone node maps; every move costs tolls feeding the Furnace (boss gets stronger if you overspend) and the Dimming (a darkness from a purple star that swallows nodes). Combat against 1-2 enemies with three upcoming moves and damage shown; a free opening move; fast levelling, trainer, rewards, talents.

## 2. First 5 minutes

Clear: enemy intent display (s0052, s0053, s0087), "best thing in the game"; map node tooltips (s0040, s0041, s0069); guided tips "short and arrive one at a time".
Confusing: class-select spell tooltips are flavour with no numbers (s0004); the camp's contract 2 + supplies 1+4+1+2 add up to exactly 10 points, so buying everything felt like a non-choice, and only in zone 2 did a contract cost "2 Reserve" with 0 held (s0012-s0022, s0208): the camp must say loudly that unspent points become Reserve; the first map screen still shows tolls, Furnace, Dimming, Bell, contracts, regions, rings and a key at once (s0039-s0045); nodes at level 4 and 7 while the player was 1 and 4, with no word on danger (s0041, s0087); "Off-balance" used in the opener menu before it is explained (s0051).

## 3. Decisions

Meaningful: target order and Glyph target with two enemies (s0088, s0166, s0190); first trainer visit (Arcane Ward vs two rank-ups, s0073); route against the Dimming and when to ring the Bell (s0161-s0183).
Fake or obvious: Binding Glyph answers almost everything (free, 2-turn freeze, +50 % damage, +20 % crit); Glyph then Ember Bolt killed 5 of 7 targets in one or two casts; Ember Bolt about 90 % of casts, Frost Lance never worth pressing; rewards are "take the bigger Upgrade number" (s0064, s0104, s0125, s0153, s0240); "Train all" always affordable (s0134, s0210); talent tier 1 flat and the mana talent dead (mana never under about 60 %, s0157, s0158); shrine "free respec + all spells trained" vs "a pouch of gold" with no amount, one node after paying 3s 69c at the trainer (s0219); the wind-up prompt names the answer ("Wind-up now: stop it with [4] Rime Burst", s0232), good tutorial but no puzzle.
Information gaps: Spark and Spark Flask show no damage number (s0027, s0030, s0128); tooltip vs real damage diverge (Ember "about 33" hit 40; "about 79" hit 101 and 69-102), level modifier not shown; "Train to 4" has no preview (s0073, s0075); Wither "Curses you" unexplained (s0188); the Heavy Smash forecast of 121 missed with no miss chance shown (s0197); mana regen never stated; combat log holds about five lines with no scroll back; "Boss gets stronger" in the Furnace tooltip has no numbers (s0024).

## 4. Difficulty

Too easy by a wide margin: no potion, ration or flask used, never below about 80 % health; zone 1 quests stayed level 5 while the player reached 9-10 after three fights (one contract hand-in 5 to 9, s0101-s0102). The Bell's Dimmed fight (level 14 Hexer and a 298 HP Ogre at player level 10, s0185-s0190) was the first threat, but Glyph plus one crit Ember deleted the Hexer; finished 428/504 (s0205). The only real pressure came from the map clock, not enemies.

## 5. Where it got stuck or did not work

- Never fought Gorrak. "He comes back after 3 more fights" (s0068) still read 3 after a grind fight (s0109), then 2 and 1 after two quests (s0139, s0162). Meanwhile the Dimming went from 7 to 20 of 31 nodes within about 3 tolls (s0138 to s0161), taking the hub with vendor and inn. After a Dimmed fight the counter still said 1, and the elite node read both "Lost to the Dimming: it can no longer be done" and "comes back after 1 more fights" (s0182). A toast said "The Roads are open" (s0165) although the Road tooltip had said "Face Gorrak first" (s0108). "Locked out of the zone's main fight by a gate I could not speed up and a clock I could not read, then let through anyway."
- The Dimming panel's "spreads again in N tolls" did not prepare for a jump from 7 to 20 nodes.
- Bell price moved from 2 tolls to 4 tolls plus a fight once standing in the dark (s0183), with no earlier warning.
- Zone 2 contract locked behind Reserve the player did not know to keep (s0208).

## 6. What felt good

Three-move forecast and plans landing exactly (Cutpurse fight s0166-s0178); the wind-up tooltip "Stopped: −30% damage for the rest of the fight. Landed: +15%. On your bar: Rime Burst" (s0227); off-balance "+50%" badges and "(33 absorbed)" log lines; item comparison with per-stat deltas (s0113) and the character sheet (s0110); free click-to-retarget showing that enemy's plan; the mood change from the downs to the fens (s0205, s0215).

## 7. What would make the tester quit

Another hour of Glyph, Ember, Ember with no enemy that punishes it; losing content to the Dimming for reasons not readable on screen; reward and trainer screens that stay "pick the bigger number / press Train all".

## 8. Bugs and visual problems

- Furnace bar "SMOULDERING · 4 tolls to spare" (s0141) and "INFERNAL · 1 toll to spare" (s0165): the tooltip (s0024) defines those states as overspent, so the label contradicts the number.
- Elite node "can no longer be done" together with "comes back after 1 more fights" (s0182).
- Roads opened without the Gorrak fight the tooltip required (s0165 vs s0108).
- Gorrak counter did not move after a grind fight (s0068 vs s0109).
- A cleared quest node showed "The Wolf at the Wallow", 2 beasts, "Done", though the quest done there was "Tusks in the Verge" against one boar (s0084).
- Hedge Ogre target frame shows the boar portrait (s0143).
- Stale map tooltip drawn over the Bags window (s0112).
- Item tooltip covers its own "Equip now" button (s0065); Rime Burst tooltip covers its row's price and Learn button (s0210); companion tooltip covers neighbouring cards (s0005-s0008).
- Supply tooltip still says "press D to buy it" after buying (s0022).
- Furnace tooltip rows misaligned (s0024).
- "Train to 4" vs "Rank 2 · level 4": two numbering systems (s0078).
- Vendor described as "potions, rations and gear" but sells only consumables (s0028).
- "Fierce Smuggler's Quiver" is a caster offhand with a book icon (s0240).
- Bell tooltip overlaps the Regions panel (s0183).
