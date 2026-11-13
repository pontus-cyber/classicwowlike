# Blind tester report: Tactician (D144 pilot)

Date: 2026-11-13. Tester: fresh agent, Fable, high effort, no repo or docs access, played game.html (build 30a5f30) through screenshots and key/click actions at 1366x768. Persona: experienced turn-based tactics and deckbuilder player who reads every tooltip.
Session: one Mage run, 238 actions, stopped at the budget at level 14 in zone 2 of 6, 7 fights won, 0 deaths. Did not reach an elite, dungeon, zone boss or the final boss. Screenshot numbers (sNNNN) refer to the tester's shots folder (kept outside the repo).

Status: feedback (ideas and findings, not work orders). Lead triage pending.

## 1. What is this game, as understood

A single-character, turn-based roguelike with an MMO levelling skin. You pick Rogue, Mage or Hunter, spend 10 points at a camp on contracts (bonus objectives) and supplies, then travel through six zones (levels 1-60) towards a final boss called Oruvath. Each zone is a circular node map with quests, grind spots, rest camps, a trainer, an elite and a dungeon. Every move costs tolls from a shared time budget called the Furnace: about 20 tolls per zone is par; spending more heats the zone (more XP, gold and drops), but past 120 total the final boss gets stronger. A purple Dimming spreads across the map and closes nodes. Fights are one against several, round by round, with every enemy's next three moves and damage shown in advance. Each fight starts with a free Engage round and one of three openers.

## 2. First 5 minutes

Clear:
- Class select states the goal in one line and shows starting spells (s0001).
- The camp screen is a good first decision: 10 points, contracts cost 2, supplies 1-4, tooltips state costs and effects (s0010-s0020).
- The Furnace tooltip explains the time budget with numbers (s0022).
- Map node tooltips are the best thing in the first five minutes: type, level, enemies, toll cost and the Furnace reading afterwards (s0030, s0031).
- The first Engage screen shows enemy HP, three upcoming moves with damage, and a per-round "≈ N to you" track (s0036).

Confusing:
- Class-select spell tooltips are flavour only; numbers appear only in the game (s0003, s0024).
- The guide sent the player to the Trainer first; it cost 1 toll and had nothing to teach at level 1 (s0023).
- After leaving the hub the guide said "click a lit node" with no map open; pressing M fixed it, then the guide said the map "is the screen you are on" (s0026, s0028).
- The map is dense. The Moves list is clipped, and its buttons ("Enter Grind - 2 tolls", "Pass - 1 toll") do not say which node they mean (s0028, s0077).
- The relation between the Dimming and the Furnace stayed unclear ("your node dims in 14 tolls", "the hotter clock sets the state"). The Furnace label flipped to "SMOULDERING - Dimming" with no explanation (s0159).
- Blue and purple diamonds and "choose 1 of 3" on camp contracts were never explained (s0010).
- The first quest text talks about cutpurses; the enemy is a boar (s0034).
- The first fight ended in one keypress, so it taught nothing about the opener just chosen (s0042).

## 3. Decisions

Meaningful:
- Camp loadout: contracts against revive, potions and map charts.
- Route planning against the toll budget; node tooltips give enough to plan.
- Target priority in multi-enemy fights (s0089).
- The zone 2 wind-up fight (s0194-s0204): three enemies telegraphed a round-3 wind-up; the tooltip named the answering spell and the button showed an "Answer" tag. "The one fight that felt like the game I want."
- Finishing a 1 HP enemy with the free basic attack before its healer acted (s0230-s0232).

Fake or obvious:
- Opener choice against a single enemy: Binding Glyph (skip two turns, +50 % damage, +20 % crit, s0126) is always best, and its card undersells it (s0123).
- Pre-casting a control spell is a trap: Rime Burst's one-round freeze was spent in the round where enemies do not act anyway, with no warning (s0164).
- Spell choice: Ember Bolt was always right; after the opening it was Ember Bolt until dead. Autoplay (Z) finished two fights exactly as the tester would have (s0215, s0234).
- Zone 1 quest rewards offered agility items to a Mage (s0046, s0173).
- First talent tier is an obvious pick with one damage spell in use; spell-granting capstones need 16 points (s0138-s0142).

Information gaps:
- Crit multiplier not on the opener card (found later on the character sheet, s0109).
- Hit/miss chance shown nowhere, yet "Your Ember Bolt misses" appeared (s0215).
- Rime Burst says it freezes non-bosses, but one of three Sentinels was not staggered and its wind-up landed, with no visible reason (s0204).
- Enemies carry a stacking red "+10 %" to "+30 %" badge with no tooltip (s0099).
- The basic attack tooltip has no damage number and does not mention mana return (s0066, s0232).
- "Upgrade (+0.2)" / "(+3.7)" on items has no unit (s0046, s0105).
- The guide says "Elite: hover it to see its Deathblow", but hovering the elite node showed nothing (s0081, s0082, s0118).
- Trainer wording ("Spells grow only when trained to your level") did not match the tooltip numbers until after buying (s0024, s0148, s0150).

## 4. Difficulty

Too easy in everything played (zones 1-2).
- Zone 1: five fights, never below about 75 % health, no potion, ward or revive used. Fights one and two ended before the enemy acted (s0042, s0068).
- Levelling is very fast: 1 to 3 from one fight, 6 to 9 from one contract payout of 8,176 XP (s0101, s0103), 10 to 13 from one zone 2 quest (s0217). Left a levels 1-10 zone at level 10 after five fights and 18 of 20 tolls.
- Health and mana full after every fight; the only attrition is tolls.
- A level 17 grind at level 13 (s0224): the hound hit for 45-62, but Binding Glyph removed its first two turns; under 10 % health lost.
- Stayed in Calm throughout; the Burning reward (+35 %) never tempted because the character was already over-levelled.

## 5. Where it got stuck or did not work

1. Leaving the hub with "Set out": the guide says "click a lit node" with no map visible; M fixed it (s0026-s0028).
2. Bags: equip an item, close bags with B: an "Ember of Return" tooltip stays and follows the cursor over map nodes, replacing node tooltips (s0057, s0077, s0079).
3. Hovering the elite (skull) node as the guide instructs: no tooltip (s0081, s0082, s0118).
4. Click a quest node, press Space to skip the walk: the same Space also accepted the quest, so the quest dialog was never seen (s0059-s0061).
5. Trainer "Train all" raised ranks only; new spells still needed separate Learn clicks (s0150-s0152).
6. "Ring the Bell (1)" left the zone immediately, with no confirmation for a one-charge, irreversible action (s0177).
7. Bags reflow after equipping, so a second click hits an empty slot or another item (s0052-s0056). Quest rewards are never auto-equipped, even into an empty slot.

## 6. What felt good

- Enemy intent display with per-round damage totals.
- Frozen/off-balance feedback: struck-through enemy moves, "+50 %" tags, prompt line (s0126, s0129).
- The wind-up fight and the tooltip pointing at the answering spell.
- Map node tooltips including the Furnace outcome.
- Character sheet damage range and average (s0109).
- Camp point-buy before the run.
- The look: clean flat art, readable UI, clear mood change from zone 1 to zone 2 (s0177).
- Pace: skippable animations and the autoplay toggle.

## 7. What would make the tester quit

- Fights staying at "resolve the opening, then press 1 until it is dead"; autoplay playing as well as the tester is a warning sign.
- Levelling that outruns the zones, so the toll budget never forces a hard choice.
- Hidden rolls (miss, resist) breaking a plan with no number shown.
- Loot offering agility items to a Mage.
- Bag management: 15 of 16 slots full by zone 2, two clicks per equip.

## 8. Bugs and visual problems

- Wind-up banner prints the literal word "null" after "WIND-UP R3" / "WIND-UP NOW" (s0194, s0198, s0202).
- Stale bag tooltip stays after bags close and overrides map tooltips (s0057, s0077, s0079).
- Elite node has no hover tooltip (s0081, s0082, s0118).
- Furnace header text "The Furnace SMOULDERING - Dimming 4 tolls in hand..." overflows its frame (s0159, s0161).
- "Level up" banner covers the enemy panel and action numbers mid-fight (s0095, s0101).
- Moves list on the map clipped at the bottom with a cut-off scrollbar (s0028, s0077, s0109).
- Grind tooltip says "Wave 1: 1 enemy" / "1 to 3 waves of two enemies"; in combat the tracker reads "Wave 0 of 1" (s0031, s0083, s0093, s0230).
- Quest tooltip reads "Ring 3 - levels 8-10" and "Level 5" for the same node (s0119).
- Quest text (cutpurses) does not match the enemy (boar) (s0034).
- Equip/Discard menu opens on top of neighbouring bag items (s0052).
- Rime Burst left one of three enemies unanswered with no visible reason (s0204): bug or hidden roll.

## 9. Ratings (1-10)

| Rating | Score | Why |
|---|---|---|
| Clarity | 6 | Combat information strong; map layer, Dimming and guide order muddled |
| Depth | 5 | Systems exist, but only one fight in seven needed them |
| Challenge | 3 | Never in danger in two zones |
| Fun | 6 | |
| Look | 7 | |
| Would play again tomorrow | 6 | Would return to see whether elites and later zones use the wind-up system, and to try Hunter |
