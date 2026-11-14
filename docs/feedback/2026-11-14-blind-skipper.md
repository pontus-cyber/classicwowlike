# Blind tester report: Impatient skipper (D144, M3 3.8 round 2)

Date: 2026-11-14. Tester: fresh agent, Sonnet, high effort (model varied on purpose), no repo or docs access, played game.html build 2609a70 through screenshots and key/click actions at 1366x768. Persona: 19-year-old break-time player who never reads more than one line, skips every tip and mashes keys.
Session: about 190 actions, two runs: Rogue (skipped the guide, died at level 17 in zone 2) and a short Mage run. Screenshot names (sNNNN) refer to the tester's shots folder outside the repo.

Status: feedback (ideas and findings, not work orders). Lead triage pending.

## 1. What is this game

A fantasy RPG roguelike on a circular node map (quests, fights, elites, shops). Turn-based fights with telegraphed enemy attacks. You level, loot and push through zones; on death you get Echoes for permanent unlocks.

## 2. Moment I would have quit

Never quit. Closest: the first 90 seconds (s0001-s0006): hero select, the camp screen, then three popups in a row (Skip guide, "Skip the guide for this run?" confirm, then "Points buy contracts..."), then a hub panel, before any fight. The first fight was the first real quit risk (s0010-s0020): Ambush missed, Gutting Jab missed twice, the Boar crit, then "Not enough energy... you have 25 x2" and key 1 stopped working, with no clear alternative. Autoplay (Z) carried every fight from the ogre on (s0032). After death (s0170) would start another run at once.

## 3. What I skipped and whether it hurt

- Trainer: hurt a lot. Reached level 15 with only the two starting spells. The only prompt was a small grey line in the first hub ("next spell at level 4"); nothing said new spells were waiting (spellbook at s0140 showed three). Walking back cost tolls (s0143-s0149).
- Potions and vendor: none bought; died with 0 potions (s0170).
- Furnace, Dimming, tolls: ignored; in zone 2 the Dimming covered the map, "Your node dims in 2!" (s0164), "You stand in the Dimming!" (s0168), every move added a Dimmed fight, died in one under autoplay at about 500/780 HP with no potions. "I had no idea this was the game's clock until it killed me."
- Camp contracts and supplies: skipped; no visible harm over 17 levels.
- Bags: filled to 16/16 with junk; loot silently dropped, no warning (s0161, s0166).

## 4. What worked without reading

Big buttons ("Enter the world", "Set out", "Continue (Space)"); Autoplay (Z) plus Space to skip animations; quest flow (click "!", Accept, fight, "Equip now" with green "Upgrade +X"); fast level-ups (4 levels from one quest, s0186); clear death screen (s0170); Hall of Echoes in two clicks (s0171); talents by one click on a glowing icon (s0116).

## 5. Where I got stuck

- First fight: key 1 stops working at low energy; only a small line said to use A (s0020).
- Clicking a non-adjacent map node does nothing and says nothing (s0037, s0125, s0143, the Hub); only small toll labels mark reachable nodes. The Moves list was the fix.
- Getting back to the Hub or Trainer from mid zone 2 took several clicks with no "Walk to Hub" button (s0143, s0145).
- Escape on the map opens Settings instead of closing the map (s0118); the map stays open behind Talents (s0114).
- "Train all" ranked up old spells and spent the gold but did not learn the three new ones; each needed Learn (s0151, s0154).
- The reward tooltip covers the second option's "Equip now" button (s0045, s0084, s0135).
- Hover tooltips covered the Trainer row at the hub (s0147).
- Mage: Packed Satchel bought, but the 3 potions never appeared on the bar (s0179, s0186); in the Rogue run the first potion auto-slotted to slot 8.
- Autoplay was off again at the start of the second run; Speedrun mode persisted.

## 6. What felt good

Autoplay plus Speedrun mode (hidden in Settings, s0118; wanted it offered at the start); art and atmosphere (parallax hills, zone weather, level-up beam, s0032); big damage numbers and "Deathblow answered: staggered"; constant loot and fast levels (12 to 17 in minutes); telegraphed attacks readable without text; clear class select; 113 Echoes at the end made another run tempting.

## 7. Bugs and visual problems

- Loot screen "789 experience, earned in this fight" vs combat log "You gain 220 experience" (s0024).
- Rogue offered "Potent Yew Shortbow of the Still Blade" with a sword icon as an upgrade (s0045).
- Reward tooltip over the second "Equip now" button (s0045, s0084, s0135); loot tooltip over loot rows (s0127).
- Loot silently lost with full bags (s0166).
- Skip guide needs an extra confirm, then a third hint popup (s0003, s0004).
- Mage Packed Satchel potions missing from the bar (s0179, s0186).
- Furnace bar and Dimming text overlap at the top (s0147, s0166).
- No feedback on clicking unreachable map nodes (s0037, s0125).
- Ambush missed on the very first action of the game (s0011).

## 8. Ratings (1-10)

| Rating | Score |
|---|---|
| Clarity | 5 |
| Fun | 7 |
| Pace | 6 (fast with Speedrun mode; normal speed waits several seconds per round) |
| Would play again tomorrow | 7 |

Tester's summary: autoplay plus Space makes it playable without reading, but the trainer prompt and the Dimming must be impossible to miss; offer Speedrun and Autoplay at the start; fix "Train all", the XP mismatch and the reward tooltip overlap.
