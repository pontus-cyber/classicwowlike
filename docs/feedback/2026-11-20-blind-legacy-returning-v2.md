# Blind tester: Returning player, Legacy campaign, Economy v2 (D144, Legacy phase 1)

Date: 2026-11-20. Tester: fresh agent, Fable, high effort, no repo or docs access. Build 8018bc3 opened with ?legacy=1 (legacy, oruvathLegacy, economyV2 on), 1366x768. Persona: 32-year-old roguelike player who plays for what carries over. Hunter "Brann", 4 runs, about 250 actions; Autoplay and Speedrun for most fights. Screenshots are in the tester's folder outside the repo (run 1 s0001-s0207, run 2 s0216-s0382, run 3 s0386-s0561, run 4 s0568-s0596).

Status: feedback. Lead triage in BACKLOG 2026-11-20.

## Runs

| Run | Hero level | Ended | Legacy points earned |
|---|---|---|---|
| 1 | 1 -> 2 | abandoned in zone 3 (Highcairn Reach) | 109 |
| 2 | 2 -> 3 | died to dungeon boss Mawgrim of the Locks, zone 2, round 24, Autoplay (s0382) | 44 (levels +20, zone +10, elites +6, quests +5, contract +3) |
| 3 | 3 -> 5 | cleared the same dungeon, Road to zone 3, abandoned (s0561) | 84 (levels +40, zones +20, dungeon +8, rare +6, quests +4, elite +3, contract +3) |
| 4 | 5 -> 5 (+211 XP) | abandoned after one quest (action budget) (s0596) | 1 |

## Between runs

- Carried over: hero level, XP, spells and ranks, talents, Legacy unlocks. Gear, gold, potions and camp points did not. The end screen's "Kept / Left behind" box is "the clearest text in the game" (s0382).
- Bought: Packed Satchel 50 and Deeper Pockets 40 after run 1; nothing after run 2 (63 points, only Cartographer 60 affordable); Quick Study 80 and Cartographer 60 after run 3 (s0567). Never affordable: Stormhawk Companion 150, Second Breath 200, the hero-level-20 wing.
- Clear: prices, owned state, the running balance, the "Your next run" strip, "Your camp has grown: 10 camp points and a contract board" (s0218).
- Not clear: Lost Technique I says "The Hunter trainer teaches Ricochet Bolt"; only the hover says "from level 9" (s0564). Starting gold differs every run though gold is "left behind" (s0226, s0398, s0580). "Points you keep become Reserve" (s0218) is never explained. The start camp offers contracts for zones 4 and 5, never reached, and none for zone 1 (s0389, s0571).

## Did the next run feel stronger?

Yes, mostly from kept hero level and found gear, not from the hall. Starting health 205 / 288 / 425 at hero 2 / 3 / 5. The same dungeon killed the hero in run 2 and was cleared in run 3 (hand play for three boss rounds, plus an epic contract weapon). Zones scale with the hero (zone 1 "1-2", "2-3", "3-5"). Felt: Packed Satchel (5 potions, first potion free each fight), Quick Study (+5 % quest XP). Not felt: Deeper Pockets (bags full by fight 4-5 of zone 2), Cartographer.

## Wrong or confusing

- The top bar flips between "CALM · N tolls to spare" and "SMOULDERING · The Dimming is near" after one 1-3 toll move while the marker stays blue; "23 tolls to spare" went straight to Smouldering (s0254-s0257, s0460-s0465, s0530-s0533).
- The run 3 summary says "Smouldering 0" tolls and "9 Calm" nodes, while the HUD showed Smouldering through the dungeon (s0561, s0465-s0551).
- "Next in the hall: Vigor of the Line I, 70" every time; with 63 points it says "One unlock within reach" naming one he cannot afford; with 8 points it still names it (s0382, s0561, s0596).
- The Dimming went 0 -> 10 -> 16 -> 24 of 31 places across one dungeon and two quests and took two of three exits; dungeon map cost is unpredictable (s0453-s0551).
- "Leave 1 item behind? Click Leave again." shows while three items are listed, two with only "Equip now" (s0478).
- With full bags, every quest reward opens a second "Items waiting" window for the replaced item (s0318, s0518, s0546).
- Bag badge "+20 items" / "+24 items" while the bag is 20/20 (s0313, s0511).
- Piercing Mirewater Codex (+2 Intellect, -1 Agility) flagged as an upgrade for a Hunter (s0502).
- "The Weir Keeps Rising" repeats from run 2 with the same text and asks to "look into the dam-keep" after it was cleared (s0539, s0315).
- Zone 2 arrival by Bell gave 18 tolls to spare in run 2 and 30 in run 3, unexplained (s0299, s0433).
- "Oruvath: No stronger" and "Estimated time 13 min manual · 9 min autoplay" unexplained (s0382).
- Engage button moves lower when an elite has an Escort row (s0423).

## Wording

- Full bags in four phrasings (s0313, s0315, s0318, s0475).
- "Legacy points buy lasting unlocks" in three slightly different places (s0214, s0382).
- Reads machine-written: the contract tooltip (s0255, repeats itself), the Cartographer tooltip (s0385), end-screen lines "Tolls overspent (above 0) or to spare (below), per zone" and "Fights won in heat: 0 (no node entered Burning or Infernal)" (s0382), "Fights 1 (1 rounds)" (s0596).
- Both contracts end "A runner from Millbrook Rest brings your pay. Well done." (s0293, s0415). Two quest-complete lines read like openers (s0277, s0315).
- Item suffix pattern visible ("of the Hare / Fox / Oak / Heron / Wolf / Poise / Grit"); "Fierce Lucky Barleycorn" reads generated (s0293). Same junk twice in one loot window (s0426).

## Top 3 changes (tester)

1. Make the hall worth saving for: real requirements on the card (level 9, per hero), recommend something affordable, make the 70-point stat ranks noticeable.
2. One readable Furnace/Dimming state: HUD label, bar marker and end summary agree; the map shows what a node will cost in spread before entering.
3. Take junk and full-bag handling out of the loop: auto-sell or stack junk, drop the second "Items waiting" window, one sentence for full bags.

## Fifth run?

"Yes, because the hero's level, spells and talents carry over and the level 6 spell and a zone 2 bounty are concrete next goals; the Legacy hall is not yet the reason."
