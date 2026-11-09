# Bugs

Found by the Playtest & QA Lead. Severity: blocker (a run cannot go on), critical (a core feature does not work, no workaround), major (wrong behaviour or missing information that changes decisions), minor (wrong text or small UX fault), trivial (cosmetic or API detail with no player impact).

Build: game.html 5b3e929 on main (source a4ed861; my rebuild differs only in the build stamp). Bugs 01-05 were first seen on f973648 and are unchanged on 5b3e929. Check scripts: qa/browser/ui-checks.mjs (01, 02, 03), qa/browser/full-run.mjs (01), `node --test qa/rules/` todo tests (06, 07).

Status: open unless marked.

## BUG-QA-01 · critical · Autoplay never plays a fight in the visual build
- Build: f973648, 5b3e929.
- Steps: start a run, enter any fight (Accept), click the Autoplay toggle on the action bar (or press Z). Wait.
- Expected: autoplay picks each action at the autoplay pace until the fight ends or the toggle is turned off (rules 7.1, BRIEF core loop 3).
- Actual: the toggle turns green and `state.autoplay` is true, but the round never advances. Each manual action still plays exactly one round. Seen in every browser run (zone 2, first fight: "round 1 for 5 s").
- Cause (read in the code): src/ui/app.js `scheduleAuto()` is called only from `afterPlay()`, which runs inside `act()` before its `finally { this.pending-- }`, so the guard `this.pending > 0` always returns early and no timer is ever set.
- Note: the hand-off's headless checks drove autoplay through `window.__ui.act({ type: 'AUTO' })`, which bypasses the toggle. The 17:50 report to the owner lists autoplay as working.

## BUG-QA-02 · major · Map tooltip hides how many enemies a node holds
- Build: f973648, 5b3e929.
- Steps: on the zone map, hover a quest or grind node whose enemies share an archetype (5b3e929 seed 5: row 1 quest "Ashes on the Wind", 3 enemies: skulker, caster, caster).
- Expected: the tooltip tells the encounter size (rules 1.4: the map shows enemy archetypes; mapView gives one entry per enemy).
- Actual: "Foes: Skulker, Caster": duplicates are merged, so a 3-enemy quest reads like a 2-enemy one, and "Foes: Skulker" can be 1 or 3 enemies. The count is only visible after the node is entered (intro dialog), when the hours are already spent.
- Cause: src/ui/engine-bridge.js convZone builds `enemyNames` with `new Set(...)`.

## BUG-QA-03 · minor · Combat log says "item" and "0 copper" for vendor and bag actions
- Build: f973648, 5b3e929.
- Steps: at a vendor buy a Healing Draught, sell Trail Rations; equip an item from the bags; use a consumable from the bags. Read the combat log.
- Expected: the item's name and the copper received, e.g. "You buy Healing Draught.", "You sell Trail Rations for N copper.", "Equipped <item name>.", "You use Trail Rations."
- Actual: "You buy item.", "You sell item for 0 copper.", "Equipped item.", "You use item.", and the heal that follows an item used out of combat logs " heals you for 110." with no source (src/engine/nodes.js healUnitOoc sends no `spell`).
- Cause: engine-bridge.js convEvents reads `e.name`, `e.gold`, `e.id`, `e.item.name`; the engine's events carry `{ item: id or uid, price }`, `{ item: uid, value }`, `{ item: uid, slot, old }`, `{ item: id }`.

## BUG-QA-04 · minor · Bought potions stay off the item bar, and nothing says so
- Build: 5b3e929.
- Steps: new run, Vendor, buy Healing Draughts, set out, enter a fight with low HP.
- Expected (proposal): a bought or looted combat consumable goes to a free item-bar slot, as a learned spell goes to a free spell slot (src/engine/nodes.js placeOnBar), or the vendor says it must be put on the bar.
- Actual: the item bar stays empty; in the fight the potion cannot be used (rules 7.5 allow only item-bar items). The only hint is the tooltip of an empty slot ("Drag a potion or flask here from your bags").

## BUG-QA-05 · minor · Victory banner covers the run summary
- Build: f973648.
- Steps: win a run (seed 7 Rogue on f973648 with the QA player); look at the summary as it appears.
- Expected: the summary is readable when it appears.
- Actual: "The end of the road / Victory / Oruvath, the Unlit Star, is no more." is drawn over the Deeds column for about 3 s (1.2 s at Instant). Screenshot: docs/handoffs/qa-screens/1366-victory-banner-over-summary.jpg.

## BUG-QA-06 · trivial · spellInfo reports a stale trained level for talent spells
- Build: source a4ed861.
- Steps: take a capstone spell talent (e.g. Winter's Crown at level 42), level to 44, call `spellInfo(state, 'glacier_spike')`.
- Expected: `tl` = 44 (rules 5.2: talent spells always use tl = L; the engine does use 44 for damage).
- Actual: `tl` = 42 (the level the talent was taken). The amount is right; only the reported tl is stale. No UI text shows it today.
- Test: qa/rules/r04-r07-character-combat.test.mjs (todo).

## BUG-QA-07 · minor · Boss telegraph counters: Pulse and Shards
- Build: source a4ed861.
- Steps: boss fight into phases 2 and 3 (qa/rules/r10-boss.test.mjs builds the schedule).
- Expected: like Litany and Brand ("this round" on the round it happens), and a Shards countdown only for a wave that will come.
- Actual: (a) on a round whose intent includes Starless Pulse, `pulseInRounds` already counts to the next Pulse, so the boss frame reads "Pulse in 3" while the Pulse lands this round. (b) with SHARD_MAX Shards alive, the Shards counter still counts down to "next round" and then resets with no Shards.
- Tests: qa/rules/r10-boss.test.mjs (two todo tests).

## BUG-QA-08 · trivial · Map labels of non-combat nodes are coloured as if dangerous
- Build: f973648, 5b3e929.
- Steps: zone 1 map at level 1.
- Expected: Rest, Vendor, Trainer and Shrine labels in a neutral colour (they hold no fight).
- Actual: their labels use the content-level colour, so a Shrine or Trainer in row 5 shows red like a hard fight.

## BUG-QA-09 · trivial · The minimap clock keeps the same day past midnight
- Build: f973648, 5b3e929.
- Steps: play past 18 in-game hours and watch the clock under the minimap.
- Expected: Day 2 starts at midnight ("Day 1, 23:00" is followed by "Day 2, 00:00").
- Actual: "Day 1, 23:00" (17 h) is followed by "Day 1, 00:00" and "Day 1, 02:00" (20 h); the day number changes at 06:00. Cause: src/ui/util.js hoursText counts days from hour 0 but shows the time from 06:00.

## BUG-QA-10 · major · The camp hides "Face Oruvath" below the fold
- Build: f973648, 5b3e929; 1366x768 and 1920x1080.
- Steps: reach the camp (Observatory Steps) and look at the camp panel.
- Expected: the button that starts the boss fight, the time and the Boss Ascendancy line are visible.
- Actual: the panel shows the four service cards; the time, Ascendancy, level lines and "Face Oruvath" sit below the panel's visible area (button at y 690-730 inside a panel that ends at 618 at 1366x768; 969-1025 inside 869 at 1920x1080). The panel scrolls (`.side`, max-height calc(100vh - 36rem)), but no scrollbar shows in Chromium's screenshots, so nothing tells the player how to start the fight or what the hours cost. Screenshot: docs/handoffs/qa-screens/1920-camp-no-boss-button.jpg. The browser run found it only by scrolling to click; full-run.mjs now flags a primary button that is hidden in a scrolling panel.

## BUG-QA-11 · minor · The bag item menu runs off the right edge at 1920x1080
- Build: 5b3e929; 1920x1080 (fine at 1366x768).
- Steps: open the bags (B), click an item in one of the right-hand columns.
- Expected: the menu (Equip, Use, Put on item slot, Discard) lies inside the window.
- Actual: the menu is 212 px wide at this size and starts at x = 1727, so its right 19 px are cut off (seen 8 times in the 1920x1080 Rogue run). Cause: src/ui/windows.js clamps the left edge to `innerWidth - 200` px, but the menu's width grows with the UI scale (rem).
