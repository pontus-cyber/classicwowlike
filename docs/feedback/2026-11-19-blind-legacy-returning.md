# Blind tester: Returning player, Legacy campaign (D144, Legacy phase 1)

Date: 2026-11-19. Tester: fresh agent, Fable, high effort, no repo or docs access, game.html db32e06 opened with ?legacy=1 (both Legacy switches on), 1366x768. Persona: 32-year-old roguelike player who plays for what carries over. About 247 actions; Autoplay for most fights, Speedrun mode from run 3, Abandon run to end runs 2-4. Screenshot names refer to the tester's folder outside the repo; s0001-s0084 were not viewable at report time, so run 1 is from the tester's log.

Status: feedback. Lead triage in BACKLOG 2026-11-19.

## Runs

| Run | Hero level | XP | Ended | Legacy points |
|---|---|---|---|---|
| 1 | 1 -> 1 | +1040 | died to a level 3 rare elite on autoplay, zone 1 (s0059) | 70 (60 welcome) |
| 2 | 1 -> 2 | +2068 | abandoned in zone 2 after 3 quests and 1 elite (s0165) | 42 |
| 3 | 2 -> 3 | +1181 | abandoned in zone 1 after 2 quests, a dungeon and the trainer (s0236) | 44 |
| 4 | 3 -> 3 | +0 | set out and abandoned at once, testing a suspected exploit (s0247) | 20 |

## Between runs

- Carried over: hero level and XP (hero select "Level 2 · Vex", s0172, s0238), trained spells and ranks (s0224), Legacy unlocks (Packed Satchel, Deeper Pockets, s0179). Gear, gold and bags did not, and nothing says so.
- Earned: the end screen itemises Legacy points (hero levels +20, zones +8, elites +3, quests +1, dungeon +8, reserve kept +2 per point) (s0165, s0236): "the best screen in the loop".
- Spend: the Legacy hall has about 30 unlocks in clear groups, priced 50-500 (s0167). At 42-44 per run: one cheap unlock after runs 1 and 2; after run 3 (46 points) nothing affordable (cheapest left 60).
- Clicked: the purchase banner and "Your next run" strip (s0170); 20 bag slots and 3 draughts at the start of run 3 (s0179).
- Did not click: the camp went from 5 points to 10 and three contracts with no explanation (s0174); one resource with four names ("points left", "preparation points", "Reserve", "unspent camp points"); level-ups nearly invisible (only a log line, s0119); gear loss not stated.

## Did the next run feel stronger?

Partly. HP at set-out 200 -> 270 -> 375, start gold up, four spells at level 3. But zones scale with the hero (Amberfold Downs "Levels 1-2" in runs 1-3, "levels 2-3" in run 4, s0243), and quest XP in the same zone dropped at level 2 (63 and 161, s0189/s0200) against level 1 (270 and 407, s0100/s0122). The affordable unlocks were convenience. The one moment of progress: clearing the dungeon in run 3 after dying to an elite in run 1.

## Wrong or confusing

- Exploit: set out with nothing bought and abandon at once pays "Reserve kept (10) +20" Legacy for zero play (s0247), nearly half a real run's income; buying supplies therefore costs Legacy.
- Run 4 camp says "the road to Greywater Fens" (s0241), then arrives in Amberfold Downs (s0243).
- Run 1 end screen: "0 Infernal" despite Infernal shown in the run; bottom line cut off by the buttons (s0059, from log).
- "Estimated time 2 min manual · 2 min autoplay" for a run with 0 fights (s0247).
- "You abandon the run" toast over the Deeds text (s0236, s0247).
- "Equip now" on a quest reward lost to an immediate Dimming fight ("EQUIP is not allowed during a fight", s0044, from log).
- Contract "Win 2 sites" never counted ordinary fights in the region (0/2, s0133); "site" unexplained; tracker overlaps enemy intent icons (s0096).
- Rogue offered a "Fierce Yew Shortbow" as +21.7 (s0122) and shields as off-hands (s0206).
- Loot "Leave" button moves between the first and the confirming click (s0152, s0154).
- "Equip now" with full bags sends the item to "Items waiting" (s0160).

## Play tomorrow or stop

Back for: a real, visible hero level and kept spells; wanted hall items (Second Breath, Lost Techniques, Heirloom Blade); the end screen's breakdown. Stop for: Legacy pace (about 42-44 a run against 100-500 prices), scaling that cancels feeling stronger and lower XP for the same quests, unannounced gear loss, and the reserve payout making "not playing" the best way to earn.

## Ratings

| | Score |
|---|---|
| Clarity of progression | 6 |
| Sense of progress | 5 |
| Fun | 5 (mostly autoplayed) |
| Would play again tomorrow | 6 |
