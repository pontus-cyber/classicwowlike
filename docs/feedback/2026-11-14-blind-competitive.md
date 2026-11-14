# Blind tester report: Competitive (D144, M3 3.8 round 2)

Date: 2026-11-14. Tester: fresh agent, Fable, high effort, no repo or docs access, played game.html build 2609a70 through screenshots and key/click actions at 1366x768. Persona: 26-year-old speedrunner and min-maxer who takes hard fights early on purpose.
Session: one Rogue run with the guided first run switched off, about 245 actions. Died at level 6 to the zone 1 dungeon boss (round 16). One class, one zone, six fights. Screenshot names (sNNNN) refer to the tester's shots folder outside the repo.

Status: feedback (ideas and findings, not work orders). Lead triage pending.

## 1. What is this game

A turn-based single-character roguelike dressed as a classic MMO: class pick, 10 camp points for contracts and supplies, six zones on circular node maps toward the final boss Oruvath. Every step costs tolls; the two-clock Furnace (par line and the spreading Dimming) pays more for falling behind but strengthens the final boss. Combat is 1 vs up to 3 with three rounds of visible intent, a stealth opener, wind-ups to answer, and builders and finishers. Death pays Echoes.

## 2. First 5 minutes

Clear: class select (s0001, s0002); start camp with hotkeys and stated refund rule (s0007-s0016); the Opening strip with per-round "about X to you" and each enemy's next three moves, "the best thing in the game" (s0024, s0066); node tooltips with level, enemies, toll cost and Furnace result (s0021, s0143).

Confusing:
- The Furnace: "20 tolls in hand", "Boss +0 %", "Dimming: 14 tolls", "par 120", "the Star's line: 20" all at once; tooltip is a wall of text. About 40 actions before the two clocks made sense (s0017, s0018, s0140).
- The map Moves list pairs ("Enter Quest - 3 tolls / Pass - 1 toll") do not say which node they mean (s0020).
- With the guided first run off, hint popups still appeared on nearly every screen (s0007, s0020, s0066, s0089).
- "Ward" and the enemy "+10 % / +20 % / +30 %" ramp badges are not explained (s0030-s0035); "x1 / x2" badges on quest nodes unexplained.

## 3. Optimisation

Strongest:
- Sap is the best opener by a wide margin: removes four enemy turns, cancels a wind-up or a reinforcement Signal, staggers (-30 % damage all fight) and leaves the target off-balance (s0069, s0153, s0157).
- Sap then Shadowstep Strike looks degenerate: after Sap the Rogue stayed in stealth, Shadowstep did not break it, and no hits were taken while stealthed. Dungeon fight 2 advertised 146 damage on round 3 from two casters; sap one, Shadowstep the other twice, killed before its cast, zero damage taken (s0201, s0206, s0208). Only energy limits it. "If stealth is meant to persist through attacks this needs a hard look; if not, it is a bug."
- Treasure nodes: 1 toll, no fight, an item three levels up plus silver (s0122).
- Fighting up: a level 4 grind at level 1 gave levels 1 to 3 in one fight (s0049).
- Camp: all three contracts plus draughts and charts used all 10 points; contract payoff not reached.

Weak or never mattered: Premeditate (the 5-point Flourish did 39 and once missed outright, s0105); Basic Strike (5-13, only to wait for energy); Flee at 50 % with no cost shown; Region Charts value unclear.
Questionable incentive: Burning pays +35 % for +2 % boss strength per 10 tolls past 120 (cap +40 %); on paper sitting in Burning looks strictly correct (untested).

## 4. Difficulty and risk

Pushed back: a level 6 quest at level 3 (a Cutpurse Signal summoned a third enemy on round 4, no interrupt yet, incoming about 64 per round, fled on the second 50 % roll at 81/290 HP; "fair and readable") (s0066-s0085). Dungeon boss level 7, 629 HP: even with the Deathblow answered and the boss staggered, about 25 damage per round could not race 23-31 incoming; died with the boss at about 45 % (s0228-s0244).
Did not push back: anything at or one level above once Sap was available; dungeon fights 1 and 2 cost about 90 HP in total; Guardian enemies (112-158 HP, 10 per hit) are no threat, only time.
Risk worth it: early over-level grind, yes. Over-level quest with a summoner, no. The dungeon two levels early, no, only because of the boss; the leave option between fights (s0199) is a good risk valve.
Variance: finishers can miss or be dodged and lose every combo point; 3 of about 8 finishers (s0078, s0105, s0240). "The single most tilting thing in combat."

## 5. Pace

- Guardian mop-up: every fight ended with 6-10 rounds of Jab and Strike on a Guardian that cannot hurt you; about a third of 80 rounds.
- Equipping normal loot and chest items: bags, item, Equip per item (s0055-s0060); only quest rewards have "Equip now" (s0115).
- Confirms: quest Accept after paying tolls to enter (s0064), "Open the chest" (s0120), "Enter the dungeon" (s0145), loot Continue then "Press on" (s0199).
- Space during the walk-in skips the animation instead of accepting the dialog, so two presses (s0098).
- Autoplay was about 1.5 s per round early, but later 30 s moved only 2 rounds (s0240-s0242); possibly a headless artifact.
- Trainer visits cost a toll and gold each time ranks fall behind.

## 6. Stuck or did not work

- Trainer "Train all" trained ranks but did not buy the new spell Shadowstep Strike; separate Learn needed (s0131, s0133).
- Boss fight: W (Disrupt) on round 1, then 3 (Shadowstep) twice did nothing, no message; Disrupt had removed stealth, unlike Sap (s0234). A "needs stealth" message would help.
- Autoplay drank the Healing Draught twice without asking, once at about 85/235 HP with the last enemy at 24 HP (s0048, s0049), once in the boss fight; makes autoplay unusable while holding consumables.
- Target switching with Tab found by guessing; the prompt lists only 1-7, A and X (s0070).

## 7. What felt good

Three rounds of intent and solving the fight before it starts; Sap cancelling a Signal and the enemy going off-balance (s0157); deleting a caster before a 68-damage cast (s0208); two levels from one over-level fight; the end-of-run screen with seed, tolls vs par, damage by spell and Furnace graph (s0245); the Bell with unused tolls banked as a routing tool (s0137).

## 8. What would make me quit

Finisher misses wiping combo points; the Guardian mop-up; Sap plus Shadowstep staying this strong (every Rogue fight opens the same way); the zone 1 dungeon boss being a pure level check; equip click count.

## 9. Bugs and visual problems

- Furnace header overflows and overlaps in Smouldering (s0140, s0145, s0147 on); garbled at s0098.
- Dungeon count inconsistent: map tooltip lists Fight 1, Fight 2, Boss but says "Three fights and a dungeon boss" (s0143); entry panel "3 groups, then Warden Belk" (s0145); HUD "Fight 1 of 4" (s0153); the boss was the third fight, labelled "Fight 3 of 4" (s0234).
- Stale tooltips after keyboard actions: "Severing Flourish needs a combo point" with 5 points (s0028); the Strike tooltip survived into loot and map screens (s0038-s0055).
- Camp tooltip on a bought supply still says "Click or press A to buy it" (s0016).
- Wooden Buckler reward shows no stats, only "Empty slot: an upgrade", with a dagger icon (s0115, s0116).
- Basic Strike tooltip has no damage number (s0038).
- On the boss the Engage panel grows over the Combat Log header (s0228).
- Target ring stayed under the Ogre after Tab moved the target (s0070).
- Bag slots did not compact after equipping (s0058).
- The dungeon "Harrow Cellars" uses the same sunny meadow background (s0147, s0201).
- "Low health: drink a Healing Draught" fires at about 40 % HP with the fight nearly won (s0048).
- Junk items do not stack and filled 10 of 16 slots by the second dungeon fight (s0223).

## 10. Ratings (1-10)

| Rating | Score | Why |
|---|---|---|
| Clarity | 6 | Combat very clear; Furnace and map side panel not |
| Depth | 7 | Real decisions in openers, kill order, routing; held back by one dominant opener |
| Challenge | 6 | Good pushback when over-reaching, none at level |
| Pace | 4 | Tank slogs, confirms, equip clicks |
| Fun | 6 | |
| Would play again tomorrow | 7 | Wants to test Mage, the Burning strategy and the stealth chain in zone 2 |
