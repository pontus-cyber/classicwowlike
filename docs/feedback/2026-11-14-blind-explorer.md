# Blind tester report: Explorer (D144, M3 3.8 round 2)

Date: 2026-11-14. Tester: fresh agent, Fable, high effort, no repo or docs access, played game.html build 2609a70 through screenshots and key/click actions at 1366x768. Persona: 42-year-old lore and atmosphere player who reads everything, hovers everything and takes side paths.
Session: one Hunter run ("Maren", Ridgewolf pet), guided first run on, about 250 actions, ended alive at level 13 in zone 2. Did not fight Gorrak: rang the Homeward Bell to leave zone 1 instead. No boss, dungeon interior or death screen seen. Screenshot names (sNNNN) refer to the tester's shots folder outside the repo.

Status: feedback (ideas and findings, not work orders). Lead triage pending.

## 1. What the game is

A turn-based node-map roguelike dressed as an old-school MMO (class, pet, trainer, vendor, inn, talents, "!" and "?" quest givers). Every move costs tolls; the Furnace heats from Calm to Infernal; a purple Dimming spreads from a Shardfall. World as pieced together: a shard of the Unlit Star fell and "the dark starts here"; you move from farm country (Amberfold Downs) into marsh (Greywater Fens) toward Highcairn Reach. The Unlit Star line was found only by hovering one map node in zone 2; nobody in the world says it.

## 2. First 5 minutes

Clear: class select and companion hovers (s0001-s0008); the Engage panel (Opening Shot, Lay Trap, Send the Pet) with enemy moves in advance, "the best thing in the game" (s0066, s0188); quest dialog and reward choice with Upgrade markers (s0086-s0088).
Confusing: the start camp (contracts, Reserve, supplies) before knowing what a toll is (s0016-s0024); the Furnace tooltip is a wall of rules (s0035); browsing the vendor costs a toll and then locks ("punished for looking", s0041-s0045); the map shows a key, regions, a Moves list, toll badges, "dims in N" badges and x2 badges at once (s0049, s0230); three metaphors on one clock (Furnace/heat, Dimming/dark, the Star); "Calm: you are ahead of the Star" (s0255) was the first hint the Star is chasing you.

## 3. World and writing

Original and alive:
- Place names good and consistent per zone: Barleyreach Verge, Carter's Furrow Road, Millbrook Steadings; Rotplank Causeway, Gloamwater Hollow, Stiltrow Hamlets, Lanternless Causeway.
- The time-and-bell idea hangs together (tolls; the Homeward Bell "calls its bearer home along the road it was cast for").
- Best lines: "A sunken bell chimes beneath the mist, though no wind moves it" (s0291); "A smuggler's oilcloth bundle is wedged in the roots of a drowned willow" (s0272); "No more chanting in my field."
- Zone-flavoured item bases (Millroad Shoes, Reedweave Cap, Lantern-Fly Charm, Willow Staff); "Fenmother Acolyte" and "The Gloam Eel" invite curiosity.

Generic, inconsistent or off:
- Quest text vs play: "The Lost Causeway" asks to "walk the margins and mark where the stones remain"; it is a kill-three fight, then "This map saves lives. Thank you." (s0339, s0356). Every quest is one fight whatever the text says; completion lines are formulaic ("[one sentence]. Thank you.").
- "Three quests in a zone complete its story" is promised on every quest tooltip (s0270); four done in zone 1, no story beat seen.
- Art vs text: Stilt Haven "rope bridges and lamplit stilts above black water" shows cottages on flat ground (s0258); the Scarecrow Hexer is a hooded monk (s0188); the smuggler's bundle is a standard chest (s0272); Marsh Lurker uses the hound sprite (s0341); quest givers share one body.
- The Dimming has no bite: the tooltip promises Shardspawn (s0297); the tester got a Stonewall Sentinel guarding a boar and later a wolf, in the same sunny meadow, 343 XP, no loot (s0202, s0228, s0236). "Standing in the dark should look and feel different."
- Both shrines visited use the identical flavour line (s0291, s0333).
- Duplicate quest names on different nodes ("Tusks in the Verge" twice, "Straw and Tusk" twice); the first quest node seen was later renamed and marked lost to the Dimming.
- Items have no flavour text; suffixes are stock ("of the Wolf", "of Grit"); talents are pure percentages (s0360).
- Gorrak is named only in a tutorial hint; his map tooltip just says "Elite" (s0233).
- Levelling too fast to mean anything (1 to 4 in the first fight; 9 to 13 from one quest, s0356).

## 4. Was exploring rewarded?

Partly. Hovering paid off (road names, the Unlit Star line, enemy roles, exact toll and Furnace results). Side nodes paid off mechanically (treasure: 5 silver and a weapon; shrines: a free heal and a boon). Reading time is not rewarded with lore: no books, rumours, NPC chatter or item text; one sentence per node. The toll clock and the Dimming punish wandering (nodes eaten while looking around; a contract expired). Unknown "?" nodes reveal only a type and a level range.

## 5. Where I got stuck

- Zone 1 grind next to the start: level 7 enemies at level 4; pet died, fled (s0117-s0121).
- Zone 2 grind near the hub (s0301-s0329): Flee failed about six rounds in a row, pet died, escaped at 33/430 HP. The map badge may have read 12 before entering (s0293) and 17 afterwards (s0329, s0337): check.
- Clicking a non-adjacent node does nothing and says nothing (s0299).
- Stilt Haven board: "Take · 3 Reserve" greyed out with "Not enough Reserve" (s0263); "Swap" found by trial; what Reserve is and how to earn it never understood.
- Flee needs two presses of F with no visible confirm state.

## 6. What felt good

Reading intent and answering a wind-up with Lay Trap ("Staggered!", s0193, s0347); the pet taking hits; the mood change into the misty Fens (s0255); the shrine scene; Upgrade comparisons; Autoplay for dull fights; the parchment map.

## 7. What would make me quit

The constant clock charging for poking around, including opening a shop; text-heavy system tooltips next to one-line world text ("the ratio is backwards for a lore player"); quests that read as stories but play as identical fights; being trapped in an unwinnable fight by repeated failed flees.

## 8. Bugs and visual problems

- Flee tooltip stayed on screen after combat (s0121).
- Hedge Ogre portrait frame showed boar art (s0167).
- Combat log "Enemy has fallen." when the player's own pet died (s0320).
- A grind node the player fled from is marked "Done" (s0337).
- Treasure gold in the purse before "Open the chest" (s0272, s0274).
- An Intellect/Spirit staff with a bow icon flagged as a big upgrade for a Hunter while lowering Agility (s0274).
- Furnace header overcrowded: marker diamonds cover "SMOULDERING" and "INFERNAL", "Dimming" twice in one line (s0230, s0339).
- Bags panel covers the map's Moves list (s0279).
- Tutorial hint bubbles over the pet and action area (s0188, s0236).
- The third enemy in The Lost Causeway appears with no announcement; the objective silently changes from 2 to 3 (s0341, s0350).

## 9. Ratings (1-10)

| Rating | Score |
|---|---|
| Clarity | 5 |
| World/atmosphere | 6 |
| Writing | 5 (good place names and a few fine lines; thin, formulaic quest text; no depth to find) |
| Fun | 6 |
| Look | 7 |
| Would play again tomorrow | 6 (for the combat and to see Highcairn Reach, not for the lore as it stands) |
