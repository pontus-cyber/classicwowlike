# Brief

Status: approved by the owner 2026-11-09. Items marked "owner review" are defaults the team builds on until the owner says otherwise.

## Pitch
A turn-based roguelike with the feel of starting a fresh character in a classic fantasy MMO: pick a class, level from 1 to 60 through zones, quests, dungeons and grinds, gear up, and face a raid-style final boss at level 60. How well you levelled and geared decides whether you win [stated: owner 2026-11-09].

Each step you choose the next node on the path: quest, grind, dungeon, elite, rest, vendor, trainer. Every choice spends time and has a long-term effect, so the player has to plan ahead [stated].

## Feel
- Classic fantasy MMO levelling: zones by level band, quest hubs, dungeons with loot, gear rarity tiers, talent trees, a raid boss [stated].
- The character stands in the centre of the screen and the world scrolls past as you travel, as in a classic MMO. Click to play; no free roaming [stated].
- HUD in the classic MMO style: unit frames, action bar, XP bar, minimap, bags, character sheet, talent window, quest log [stated].
- High standard for UI, UX, graphics and feel from the first playable build [stated].
- Art: stylised 2D painted look drawn in code, with parallax layers. No pixel art [stated].
- All names, classes, places, items, text and art are original. Genre conventions are fine; nothing taken from existing games [source: docs/README.md].

## Core loop
1. Choose a class: Rogue, Mage or Hunter [stated].
2. Choose the next node on the path. Resolve it: XP, gold, items, damage, time.
3. Fights are played manually by default; the player can turn on autoplay. At most 7 spells on the action bar, plus usable items such as potions [stated: owner correction 2026-11-09 14:46].
4. Spend talent points as you level; equip gear; plan for the boss.
5. At level 60, fight the end boss.
6. If you die with no way to resurrect, the run ends. You get a run summary and meta-progression points based on how far you got [stated].
7. Spend meta points on permanent unlocks: new items in the drop pools, new skills, stat boosts. Many completed runs should feel rewarding and make the next run faster and stronger [stated].

## Run length
About 45 minutes from character creation to the boss kill for a normal player. A player who pushes hard must be able to speedrun it noticeably faster [stated]. The exact number of nodes is set by the designer and tuned by the simulator.

## Platform
Desktop browser first, landscape, mouse-first [stated]. One HTML file, plain JavaScript, canvas 2D. The rules engine is pure JavaScript so the simulator runs it in Node. Phone layout later (owner review).

## Playtesting
Two front ends on one rules engine [stated]:
- the visual game (game.html);
- a text-based simulator that plays tens of thousands of runs headless, for balancing and for checking that progression follows the targets.

## Out of scope for v1
Multiplayer, accounts, online services, a shop with real money. Sound is out of scope until M4 (owner review).
