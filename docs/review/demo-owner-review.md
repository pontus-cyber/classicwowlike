# Demo: names and lines for the owner (draft)

Status: **draft for the owner**. Task MD D.5. Author: Content Designer, 2026-11-25, at origin/main after the D.5 part 2 commits. The full list of every demo line is docs/review/demo-text-review.md (441 rows); this page is the short version.

How to answer: for each name, keep the current one, take the alternative, or write your own. For each line, write **yes** or **change** (with the new words) in the last column. Nothing here is approved until you say so. Every name is original to this project.

## 1. Names not yet approved

| # | What | Current name | One alternative | Where the player meets it |
|---|---|---|---|---|
| N1 | Zone 1 | Amberfold Downs | Goldenfurrow Downs | start camp, map title, zone banner, demo end |
| N2 | Zone 2 | Greywater Fens | Stillmere Fens | map title, zone 2 leave line, demo end |
| N3 | Zone 1 hub | Millbrook Rest | Millbrook Green | map, hub panel |
| N4 | Zone 2 hub | Stilt Haven | Lanternstilts | map, hub panel |
| N5 | Zone 1 regions | Barleyreach Verge, Carter's Furrow Road, Boundary Stone Hollow, Millbrook Steadings | Barley Verge, Carters' Road, Stonering Hollow, Millbrook Farms | map regions, contract cards |
| N6 | Zone 2 regions | Sedge Flats, Rotplank Causeway, Gloamwater Hollow, Stiltrow Hamlets | Reed Flats, Old Causeway, Darkwater Hollow, Stilt Hamlets | map regions, contract cards |
| N7 | Roads out of zones 1 and 2 | Millbrook Gate, Harrow Lane, Stonecutters' Way; Stilt Haven Boardwalk, Lanternless Causeway, Heron's Ford | Mill Gate, Burnt Lane, Quarry Way; Haven Boardwalk, Dark Causeway, Heron Ford | Road nodes and tooltips |
| N8 | Dungeons | The Harrow Cellars; The Sunken Weir | The Burnt Manor Cellars; The Drowned Weir | map, dungeon dialog, contracts |
| N9 | The toll meter | The Furnace | The Bellows | meter on the map, hints G5/H16, run summary card |
| N10 | Its four states | Calm, Smouldering, Burning, Infernal | Cool, Warm, Hot, Blazing | meter, tooltips, summary |
| N11 | The bell-ringers who hold back the dark | the Bellwrights | the Bellkeepers | guided run: rescue, held road, Gorrak's bounty |
| N12 | The first-run gift on the summary | First-run welcome (was "The Bellwrights' welcome", changed in part 2) | Welcome gift | first run summary, Legacy lines |
| N13 | The gear every new run starts with | not named on screen any more: "Your next run starts with new gear for your level." (was "the Wayfarer's kit") | Starting kit | run summary, demo end |
| N14 | The revive | Ember of Return (D150; HUD, log and banner use it for every revive since part 2) | keep | start camp supply, HUD, fight log |
| N15 | The shrine blessing that gives the revive | Boon of Return (an engine name) | Boon of the Ember | shrine choice |
| N16 | The rare elite of zone 1 and his two moves | Hobb Tollwright: Toll Hook, Final Receipt ("Toll" is also the move-cost word) | Hobb Ledgerhand: Snag Hook, Final Receipt | map, fight |
| N17 | Zone 1 dungeon boss and his chain move | Warden Belk of Harrow: Ledger-Breaker, Distraint Chain (a third "Warden" in zone 1; "distraint" is a rare word) | Steward Belk of Harrow: Ledger-Breaker, Debtor's Chain | dungeon, fight |
| N18 | Zone 1 neck item | Boundary Charm (one word from the unique Boundarystone Charm) | Hedgestone Charm | loot |
| N19 | Zone 2 quiver and dirk | Stiltwalker's Quiver, Stiltwalker's Dirk (and the rare Skerrow Stiltwalker) | Fowler's Quiver, Poleman's Dirk | loot |
| N20 | Armour prefix | Warded (also Arcane Ward and the Ward status) | Ironbound | loot |
| N21 | Two quest givers renamed in part 2 (a second Hobb and a second Pell in zones 1-2) | Jory Larrow (was Hobb Larrow), Hayward Tobin (was Warden Pell) | Wat Larrow, Hayward Brisk | guided run quests |
| N22 | Contract kinds | Cull, Wanted (was Bounty, changed in part 2 so it does not clash with Gorrak's bounty), Delve | Clear-out, Wanted, Dungeon | start camp cards, tracker |
| N23 | The fire damage status | Ablaze (was Burning, changed in part 2: Burning is a Furnace state) | Scorched | status chip in fights |
| N24 | The points that carry over and the hall | Legacy points, Legacy hall (D154, draft) | Renown, Hall of Renown | summary, hall, hero select |
| N25 | The points spent at the start camp | camp points (D159, draft) | supply points | start camp, tracker |
| N26 | The hall entries of the demo | Packed Satchel, Vigor of the Line, Edge of the Line, Quick Study, Deeper Pockets, Cartographer, Quartermaster | Full Satchel, Hardy Line, Keen Line, Quick Learner, Deep Pockets, Mapmaker, Quartermaster | Legacy hall |
| N27 | One word for a point on the map | "node" on the map and in boons ("for the next 3 nodes"); "places" in the Dimming lines (D150 item 13) | "place" everywhere | map, Dimming, boons |

Names N16-N20 are not changed in the code yet: enemy, ability and item names are in the engine's golden run hashes, so an approved rename goes in one commit with the hashes re-recorded.

## 2. The 30 most visible lines

In the order a new player meets them. `{key}` and the like are filled in on screen (key letters, numbers, names).

| # | Where | Line (current text) | yes / change |
|---|---|---|---|
| 1 | First screen, title | A classic fantasy roguelike | |
| 2 | First screen, heading | Choose your hero | |
| 3 | First screen, under the heading (demo) | Your hero keeps its level from run to run, up to level 7 in the demo. | |
| 4 | First screen, guided run switch | Guided first run: Zone 1 teaches the game as you play: one short line at a time. Skip it at any point. Settings can play it again later. | |
| 5 | First screen, button | Enter the world | |
| 6 | Start camp, first run | The start camp · Pick your supplies for the road to Amberfold Downs. | |
| 7 | Start camp, over Set out | Camp points you do not spend are lost. | |
| 8 | Start camp, contract board (run 2 on) | Contracts · Up to three at a time. Each gives its reward when its task is done. | |
| 9 | Start camp, run 2 | Your camp has grown: {points} camp points and a contract board. Contracts give XP, gold and a choice of gear. | |
| 10 | Guided run, first move | Click a lit node next to you to walk there. | |
| 11 | Guided run, first enemy track | Its next three moves, in order. The big one is marked. | |
| 12 | Guided run, first wind-up | Wind-up: stop it with {W}, an interrupt or a stun, and it is weakened all fight. | |
| 13 | Guided run, a wind-up landed | It landed: that enemy hits harder until it dies. | |
| 14 | Guided run, low health | Low health: drink a Healing Draught ({8}). | |
| 15 | Guided run, the meter (demo) | Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll. | |
| 16 | Guided run, a contract fight | Contract site: win this fight to count it. | |
| 17 | Guided run, the held road | The Bellwrights ring back the dark on this road until Gorrak's fight is over. | |
| 18 | Guided run, a rescue | The Bellwrights ring you back to safety ({n} tolls). | |
| 19 | Guided run, Gorrak's Deathblow landed | Maimed: your healing is halved this fight. Drink early. | |
| 20 | Guided run, after Gorrak | Gorrak is beaten: the Bellwrights pay his bounty when you reach the next hub. | |
| 21 | Guided run, the Bell | Far from a Road? Ring the Homeward Bell to leave the zone. | |
| 22 | Zone 2 leave dialog (demo) | Leaving Greywater Fens ends this demo run. You keep your levels and Legacy points. | |
| 23 | Level-up banner | New spell: {spell}. Learn it at a trainer. · Talent point to spend ({N}). · +{n} Legacy points when this run ends, to spend in the Legacy hall. | |
| 24 | Level-up banner and HUD at the cap (demo) | Level 7: the demo's highest | |
| 25 | Demo end, heading and first line | End of the demo · You made it through Amberfold Downs and Greywater Fens. | |
| 26 | Demo end, so far | Runs so far: 4 · Vex, Rogue, level 5 · Maren, Hunter, level 3 · Legacy hall: 3 of 7 unlocks owned | |
| 27 | Demo end, the full game | The full game goes on past Greywater Fens: four more zones and a final boss. | |
| 28 | Demo end and every summary, kept and lost | Kept: level 5 (was 4) · spells and ranks · talents · Legacy unlocks · Left behind: gear, gold, potions and camp points. Your next run starts with new gear for your level. | |
| 29 | First summary, the nudge | Your first unlock is ready: Packed Satchel. · Buy Packed Satchel: 3 potions every run, and your first potion each fight costs no turn, at half strength. | |
| 30 | Legacy hall, header and first card | Legacy points from every run buy lasting unlocks. Each applies from the start of your next run. · Packed Satchel · 50 Legacy points · Start with 3 Healing Draughts; first potion each fight costs no turn, at half strength | |

## 3. One open question that decides lines 15 and the Furnace tooltip

The full game warns that overspending tolls makes the final boss stronger; no demo run meets him (demo spec question Q1, default "keep the Furnace as in the full game"). The demo lines above (line 15, and the Furnace tooltip "Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll.") say the cost the demo player can feel. Default: these demo lines. Alternative: the full game's lines in the demo too.
