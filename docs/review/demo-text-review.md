# Demo text review: the owner's list (draft)

Status: **draft for the owner**. Task MD D.5, part 1 (the list) and part 2 (the fixes). Author: Content Designer, 2026-11-25. Part 1 read at origin/main c53d04d, then checked against 832be34. Part 2 (this update) read at 4792392 and after: the demo UI lines of D.3 (src/ui/demo.js `DEMO_TEXT`, 40e675d) are built, and the 137 flagged rows are fixed, given a demo variant, explained, or left open with the reason (Flag column). Every line stays a draft until the owner approves it. The short page for the owner is docs/review/demo-owner-review.md.

This is every player-facing line, name and number a demo player can see, grouped by screen. Mark each row **approve**, **change** (with the new text) or **cut**. Every name, text and number the owner has not approved is a draft.

## Counts

| | Rows |
|---|---|
| Total rows | **449** (438 in part 1, plus DM13-DM15: lines D.3 added, D176; plus R2-1 to R2-8: blind round 2, R2-6) |
| Approved earlier (decision named in the Status column) | 24 |
| Draft | **425** |
| of which "to come" in part 1 (the demo spec adds them); built in D.3 since | 18 |
| Flagged in part 1 (any flag) | **137** |
| Part 2: **fixed** (the text in src changed, or the logic it needed is built) | **84** (76, plus the 8 that needed logic: L2-L5, built in ui-2026-11-26) |
| Part 2: **demo variant** (the demo shows its own line; the full game's line stays) | **6** (2 built and wired in D.3: HS3, HS18; 4 added in part 2, wired in ui-2026-11-26 (L1): NUM11, GR43, GR44, FU4) |
| Part 2: **explained** (no change needed: the line cannot show in the demo, D.3 already handles it, or the two lines never show together; the note says which) | **40** |
| Part 2: **open: needs logic** (text change alone cannot fix it; hand-off docs/handoffs/content-2026-11-25.md L1-L6) | **0** (L1-L6 built, docs/handoffs/ui-2026-11-26.md; FT5, FT11, HL2, HL3, HL4, HL5, HL7, ST8 moved to fixed) |
| Part 2: **open: owner name** (a rename is proposed on the owner page; not applied, see below) | **7** (FU2, EN15, EN31, EN32, IT1, IT4, IT5) |
| Still flagged (open) | **7** (the owner-name rows) |
| Blind round 2, R2-6 (2026-11-26, ui-2026-11-26e) | **34** earlier rows reworded ("place" for a map location, N27, and the rows named in the section R2), **8** new rows (R2-1 to R2-8). All draft |

Part 1 flag letters, kept in brackets in each row's Flag cell: R repetition 40, M machine-sounding 11, U unclear 43, N naming 12, B wrong in the demo 2, X not for the demo 45 (a row can carry several).

Why the owner-name rows are not applied: enemy, ability and item names are part of the engine's golden run hashes (qa/engine s18, s23, s28 hash the event stream), so renaming them moves those hashes. An approved rename goes in one commit with the hashes re-recorded by the Core Gameplay Engineer. Flavour text, quest givers, family names and UI words are not in the hashes and are changed here.

## How to read

- **Text** is the exact current text from src (src/content/*.js, src/ui/ui-text.js and the other src/ui files), copied from the source. `{n}`, `{name}` and the like are filled in on screen. `·` separates lines of one card or tooltip. Where the source says "Echoes", a Legacy run shows "Legacy points" and "Hall of Echoes" shows "Legacy hall" (word swap in src/ui/util.js); the rows quote the source.
- **Status:** `approved <id>` = the owner approved the line, or the wording of a cut-list item, with that decision (D7, D150 and its item number). `draft` = not approved. `draft (built in D.3)` = a line the demo spec added (part 1 called it "to come"); it is in src/ui/demo.js now and is a draft too.
- **Flag** = part 2 first says what was done (**fixed**, **demo variant**, **explained**, **open: needs logic**, **open: owner name**), then the part 1 letters in brackets and the note. Part 1: the line breaks the text rules of D150 or does not fit the demo. R repetition (the same thing said twice, or one word more than once in a line), M machine-sounding (a label, a formula or a code word), U unclear (a player cannot tell what it means), N naming (two words for one mechanic, or a word D150 retired), B wrong or untrue in the demo, X not for the demo (a full-game line, or a line the demo spec changes). The note says why.
- **Source** names the file the line is read from. Rows marked with several files are tooltips built from several strings.
- Lore terms (Bellwrights, Wayfarer, the zone, hub, road and region names) come from an inherited, agent-written strawman (docs/lore/world.md) and are draft. Furnace names are "team (owner review: names)" in D68, so draft.

## The 10 lines that most need the owner's eye

Chosen by how early and how often the player meets the line, and how plainly it is wrong for a demo.

| # | Row | Why (part 1) | Now (part 2) |
|---|---|---|---|
| 1 | HS3 | First screen says "1 to 25" and "Six zones, then Oruvath." The demo stops at level 7 and zone 2. The demo spec does not change this line. | demo variant, built in D.3: "Your hero keeps its level from run to run, up to level 7 in the demo." |
| 2 | SC6 | Start camp: "One per zone. Each gives its reward when its last site is won." The demo board has three slots over two zones, and "site" is not defined. | fixed: "Up to three at a time. Each gives its reward when its task is done." |
| 3 | GR36 | First-fight hint H09: "It uses your turn." The Packed Satchel, which the demo pushes in run 1, makes the first potion free. The hint becomes untrue. | fixed: "Low health: drink a Healing Draught ({key_item1})." (G11 and H09) |
| 4 | FT3 | Every fight: stop, cancel, interrupt, control and answer all name one thing in the wind-up tooltips (D150 fixed "stopped"). FT4 adds "cancelled" and "missed". | fixed: "stop" / "stopped" in the wind-up tooltips, the result and log lines, the role cards and H31 |
| 5 | GR43 | Furnace hints and tooltip (H16, H17, FU4) warn that "the final boss gets stronger". No demo run meets him (demo spec question Q1). | demo variant: "Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll." (G5, H16, FU4; H17 likewise); wired (L1) |
| 6 | MP29 | The revive has three names: "Boon of Return" (shrine), "resurrect charge" (its tooltip) and "Ember of Return" (D150). FT14 adds "a resurrect". | fixed: the HUD, log, banner and shrine text name the revive "Ember of Return"; the summary row reads "Returned to the fight" |
| 7 | HS21 | Stormhawk card: "Unlock it with Stormhawk in the Legacy hall." The demo hall does not sell it, so the line sends a Hunter to a dead end. | explained: D.3 does not list the Stormhawk in the demo; "Meta unlock." removed from its text |
| 8 | HL2 | Hall: Vigor and Edge tooltips name rank II, which the demo does not sell. HL9 and HL10 mention Oruvath, the first-kill bonus and "0 with Oruvath defeated". | fixed (L3) for the rank II and "per rank" wording; fixed: HL9 without Oruvath; HL10 explained (D.3 drops those lines in the demo) |
| 9 | MP22 | Zone 2 leave dialog says "the hub of Highcairn Reach" and "No way back to Greywater Fens". The new demo line (DM9) has to replace them. | explained: D.3 drops the zone 3 hub and "No way back" in zone 2 and shows the demo line once |
| 10 | DM6 | Demo-end screen: "the Camp and Oruvath" are new words on the last screen. DM8: the block is 86 words with the Wayfarer sentence, 78 without; the limit is 80. | fixed: "The full game goes on past Greywater Fens: four more zones and a final boss."; block 47 words typical, 59 longest (limit 80) |

Also open: the names the owner has not yet approved, each with one alternative on docs/review/demo-owner-review.md (the Furnace and its four states, the Bellwrights, the Wayfarer's kit (now out of player text), the revive, the zone, hub and region names, Hobb Tollwright and the other proposed renames).

## Contents

| Section | Screen | Rows | Draft | To come (part 1) | Flagged (part 1) | Open after part 2 |
|---|---|---|---|---|---|---|
| [NUM](#num-numbers-the-owner-should-see) | Numbers the owner should see | 14 | 14 | 1 | 2 | 0 |
| [HS](#hs-hero-select-class-select) | Hero select (class select) | 23 | 20 | 1 | 6 | 0 |
| [SC](#sc-start-camp) | Start camp | 26 | 25 | 0 | 5 | 0 |
| [GR](#gr-the-guided-first-run-coach-lines-hints-and-guide-lines) | The guided first run: coach lines, hints and guide lines | 82 | 73 | 0 | 17 | 0 |
| [WD](#wd-world-zones-1-2-hubs-roads-regions-dungeons) | World: zones 1-2, hubs, roads, regions, dungeons | 23 | 23 | 0 | 6 | 0 |
| [MP](#mp-zone-map-nodes-and-dialogs) | Zone map, nodes and dialogs | 30 | 27 | 0 | 14 | 0 |
| [FU](#fu-the-furnace-heat-bar-and-the-dimming-meter) | The Furnace (heat bar) and the Dimming meter | 13 | 10 | 0 | 7 | 1 |
| [HB](#hb-hub-trainer-vendor-inn) | Hub, trainer, vendor, inn | 9 | 7 | 0 | 1 | 0 |
| [QU](#qu-quests-zones-1-2) | Quests (zones 1-2) | 24 | 24 | 0 | 3 | 0 |
| [CT](#ct-contracts) | Contracts | 18 | 18 | 0 | 5 | 0 |
| [EN](#en-enemies-of-zones-1-2) | Enemies of zones 1-2 | 36 | 35 | 0 | 6 | 3 |
| [FT](#ft-the-fight-bars-tracks-wind-ups-and-the-log) | The fight: bars, tracks, wind-ups and the log | 14 | 14 | 0 | 12 | 2 |
| [SP](#sp-spells-and-talents-a-demo-hero-can-reach-hero-levels-1-7) | Spells and talents a demo hero can reach (hero levels 1-7) | 39 | 39 | 0 | 4 | 0 |
| [IT](#it-items-bags-and-loot) | Items, bags and loot | 24 | 22 | 0 | 15 | 3 |
| [LV](#lv-level-up-banner-and-hero-lines) | Level-up banner and hero lines | 14 | 14 | 0 | 6 | 0 |
| [SU](#su-run-summary-every-run-end) | Run summary (every run end) | 12 | 12 | 0 | 7 | 0 |
| [HL](#hl-legacy-hall-the-demo-hall-of-seven-entries) | Legacy hall (the demo hall of seven entries) | 14 | 14 | 2 | 10 | 5 |
| [ST](#st-menu-and-settings) | Menu and settings | 11 | 11 | 2 | 6 | 1 |
| [DM](#dm-lines-the-demo-adds-built-in-d3) | Lines the demo adds (built in D.3) | 15 | 15 | 12 | 5 | 0 |
| [R2](#r2-blind-round-2-smaller-items-r2-6-draft) | Blind round 2: smaller items (R2-6) | 8 | 8 | 0 | 0 | 0 |

## Approved lines

The owner approved: the three classes (D7); D150 cut-list items 1 to 25 and the naming rule ("Go"); every line equal to a "Proposed" wording of that list carries its item number. Everything else, including every Legacy and Economy v2 line (D154-D173) and the hall prices (D167), is draft.

HS4 (D7) · HS5 (D7) · HS6 (D7) · SC12 (D150 item 15) · GR4 (D150 item 18) · GR5 (D150 item 12) · GR7 (D150 item 11) · GR15 (D150 item 13) · GR16 (D150 item 13) · GR27 (D150 item 11) · GR38 (D150 item 18) · GR43 (D150 item 12) · GR45 (D150 item 13) · MP7 (D150 item 23 (Deathblow line)) · MP12 (D150 item 6) · MP13 (D150 item 23) · FU1 (D150 item 1) · FU4 (D150 item 5) · FU5 (D150 item 5) · HB2 (D150 item 22 (Next spell at level {n}.)) · HB7 (D150 item 21 (subtitle)) · EN36 (D150 item 23 (Deathblow line)) · IT20 (D150 item 13 (name)) · IT21 (D150 item 12 (item level word))

## NUM Numbers the owner should see

Values a demo player meets or that shape what he meets. "Value" is what the code holds today. Status is draft unless a decision records the owner approving the number.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| NUM1 | Hero level cap in the demo: 7 (HERO_MAX_DEMO, D177) | draft | **explained** (X): D177 (Lead): the demo hero cap stays 7; the full game stops at 25 | constants.js HERO_MAX_DEMO |
| NUM2 | Hero XP to the next level, levels 1 to 7 (Economy v2): 1 800, 1 850, 1 900, 2 100, 2 150, 2 250; cumulative 1 800 / 3 650 / 5 550 / 7 650 / 9 800 / 12 050 | draft |  | constants.js HERO_XP_ECON2 |
| NUM3 | Hero level to engine power level (what zones scale to): hero 1-7 = power 1, 3, 6, 8, 11, 13, 16 | draft |  | constants.js POWER_OF_LEVEL |
| NUM4 | Spells known by hero 7: Rogue Gutting Jab, Severing Flourish (1), Shadowstep Strike, Throat Jab (3), Open Vein (5), Temple Blow (6), Smoke Veil (7); Mage Ember Bolt, Frost Lance (1), Arcane Ward (3), Rime Burst (5), Living Flame (6), Spellsnap (7); Hunter Keen Shot, Barbed Arrow (1), Mark Prey, Mend Companion (3), Muzzle Shot (6), Snare Trap (7) | draft |  | rules.js learnLevel |
| NUM5 | Talent points: 1 at hero level 5, 4 by level 7 | draft |  | docs/specs/demo.md 3.1 |
| NUM6 | Legacy hall in the demo: seven entries, rank I only, 450 in all: Packed Satchel 50, Vigor of the Line 70, Edge of the Line 70, Quick Study 80, Deeper Pockets 50, Cartographer 60, Quartermaster 70 (hall v3d, D167: "numbers draft until the owner approves") | draft (built in D.3) |  | docs/specs/demo.md 3.2 |
| NUM7 | Hall effects, rank I: Packed Satchel 3 potions each run and the first potion each fight costs no turn at half strength; Vigor +3 % max health; Edge +2 % Power; Quick Study +5 % experience; Deeper Pockets +8 bag slots; Cartographer free Region Charts every run; Quartermaster +2 camp points | draft |  | constants.js META_HERO |
| NUM8 | Earned by a player to the cap: about 380 Legacy points (planner estimate), so one or two entries stay unbought | draft |  | docs/specs/demo.md 3.1 |
| NUM9 | Legacy points paid per run: welcome 60 (once per profile), 20 per hero level gained, 10 per zone left, 8 per dungeon, 6 per rare, 3 per elite, 1 per quest, 1 per fight won while Burning or Infernal, 0 per unspent camp point | draft |  | constants.js LEGACY_* |
| NUM10 | Camp points: 10 at a normal camp, 5 on the first run; Field Draughts 1, Ember of Return 4, Region Charts 1, Tracker's Notes 2; 3 contract slots | draft |  | constants.js PREP_* |
| NUM11 | The Furnace: Calm to 0 tolls overspent, Smouldering up to 10, Burning 10 to 30, Infernal 30 or more; Burning gives +35 % XP and gold and 1 in 2 drops a rarity up, Infernal +50 % and 7 in 10 | draft | **demo variant** (X): demo lines for the Furnace without the final boss: tutorial.js `demo` (G5, H16, H17) and DEMO_TEXT.furnaceLine; wired (L1, ui-2026-11-26): the demo reads them under C.GATES.demo; the meter's "Boss +N %" is hidden in the demo | constants.js HEAT_* |
| NUM12 | The Dimming: starts to spread after 6 tolls in a zone, takes at most 2 places per toll, its front moves every 4 tolls; a guided rescue costs 2 tolls (3 rescues end the guide) | draft |  | constants.js DIM_*, ONB_RESCUE_* |
| NUM13 | Zone damage factor on top of zone danger: zone 1 +25 %, zone 2 +30 % (the banner line "Enemies here deal up to +N % damage") | draft |  | constants.js ZONE_TIER_DMG |
| NUM14 | Homeward Bell: 1 charge at the start, at most 2. Bags: 16 slots (24 with Deeper Pockets). Healing Draught and Mana Draught 35 %, Trail Rations 40 %, Ember of Return returns you with 40 % health | draft |  | constants.js |

## HS Hero select (class select)

The first screen. Words with "Echoes" show as "Legacy points" and "Hall of Echoes" as "Legacy hall" in a Legacy profile (util.js word swap); rows give the swapped text, which is what the demo shows.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| HS1 | A classic fantasy roguelike | draft |  | ui/screens.js |
| HS2 | Choose your hero | draft |  | ui/screens.js |
| HS3 | Your hero keeps its level, 1 to 25, from run to run. Six zones, then Oruvath. | draft | **demo variant** (X): built in D.3 (DEMO_TEXT.heroIntro, wired): the demo shows "Your hero keeps its level from run to run, up to level 7 in the demo."; the full-game line is right for the full game | ui/screens.js |
| HS4 | Rogue | approved D7 |  | ui/mock-data.js |
| HS5 | Mage | approved D7 |  | ui/mock-data.js |
| HS6 | Hunter | approved D7 |  | ui/mock-data.js |
| HS7 | Rogue role line: Melee burst · Stealth · Evasion | draft |  | ui/mock-data.js |
| HS8 | Mage role line: Ranged nuker · Control · Shields | draft |  | ui/mock-data.js |
| HS9 | Hunter role line: Ranged · Pet · Traps · Sustain | draft |  | ui/mock-data.js |
| HS10 | Rogue blurb: Strikes from the shadows, builds combo points and spends them on finishers. Fast, fragile and lethal to the unwary. | draft |  | content/classes.js |
| HS11 | Mage blurb: Commands fire, frost and arcane power from a distance. Shields and control spells keep the foe at bay. | draft |  | content/classes.js |
| HS12 | Hunter blurb: Fights with bow and a loyal companion, laying traps and wearing foes down. Patient and resilient. | draft |  | content/classes.js |
| HS13 | Level {n} (hero card, with the XP bar) · Level {from} → {to} after a run · New hero · "· {hero name}" after the level | draft |  | ui/screens.js |
| HS14 | Name (label) · Your name (placeholder) · Enter the world (button) | draft |  | ui/screens.js |
| HS15 | Seed (label) · random (placeholder) | draft | **explained** (X): D.3: the demo build has no Seed field (spec 2.3) | ui/screens.js |
| HS16 | Guided first run (switch) | draft |  | ui/screens.js |
| HS17 | Guided first run: Zone 1 teaches the game as you play: one short line at a time. Skip it at any point. Settings can play it again later. | draft |  | ui/screens.js |
| HS18 | Legacy hall button: "{n} Legacy points" with a badge of unlocks in reach; tooltip: Legacy hall · Spend Legacy points on lasting unlocks: stats, items in the drop pools, skills and more. · {n} Legacy points · {k} unlocks within reach (the entries the balance buys together, cheapest first, R2-6) · Click to open | draft | **demo variant** (X): built in D.3 (wired): the demo tooltip reads "Spend Legacy points on lasting unlocks." | ui/screens.js |
| HS19 | Resource: Energy and combo points / Mana / Focus, plus a pet · Basic attack: Strike / Spark / Auto Shot · Primary stat: Agility / Intellect · Starting spells / Spells · Companion | draft |  | ui/screens.js |
| HS20 | Hunter companions: Ridgewolf (Balanced hunter. Every third attack strikes twice.) · Thornback Boar (A sturdy tank. Taunts every enemy in round 1 and every 4 rounds after.) · Duskcat (Fragile and deadly. Hits hard with a higher critical chance.) · Stormhawk (Its attacks also strike a second enemy.; full game only) | draft | **fixed** (M, X): "Meta unlock." removed; D.3 does not list the Stormhawk in the demo | ui/mock-data.js |
| HS21 | Unlock it with Stormhawk in the Legacy hall. (Stormhawk card tooltip) | draft | **explained** (X): D.3 does not list the Stormhawk in the demo, so the line cannot show there; in the full game the hall sells it | ui/screens.js |
| HS22 | Legacy hall: "Unlocked in the Legacy hall." (fallback tooltip line) | draft | **fixed** (M): no design vocabulary | ui/screens.js |
| HS23 | This browser window cannot save your progress. | draft (built in D.3) |  | docs/specs/demo.md 2.4 |

## SC Start camp

Run 1 is the lean camp (supplies only, 5 camp points); run 2 shows one contract offer; from run 3 the board shows three (demo spec 4.3: zones 1-2 only). Economy v2 wording ("camp points") is on in the demo.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| SC1 | The start camp | draft |  | ui/prep.js |
| SC2 | Pick your supplies for the road to Amberfold Downs. (first run) | draft |  | ui/prep.js |
| SC3 | Pick your contracts and supplies for the road to Amberfold Downs. (later runs) | draft |  | ui/prep.js |
| SC4 | Your camp has grown: {points} camp points and a contract board. Contracts give XP, gold and a choice of gear. | draft |  | content/texts.js |
| SC5 | Keys line: 1-3 contracts · A-D supplies · Enter set out | draft |  | ui/prep.js |
| SC6 | Contracts (heading) · You can hold up to four at a time. Each gives its reward when its task is done. | draft | **fixed** (X, R2-6): the number is the board's slot count in words, the same four as the tracker's "Contract slots 1/4"; "site" gone | ui/prep.js |
| SC7 | Card: Cull / Wanted / Delve · Zone {n} · {family or elite or dungeon} · Win {n} marked places in {region} / Hunt it down in {region} / Clear the dungeon, its boss included · Reward {xp} XP · gold {coins} · choose 1 of 3 · Take / Drop / Taken | draft | **explained** (U): the card line under the kind says the task ("Win 3 marked places in ...", "Hunt it down in ...", "Clear the dungeon ..."); the bounty kind is now "Wanted" (CT5) | ui/prep.js |
| SC8 | Contract tooltip: Win {n} fights at marked Quest or Grind places, most of them in {region}. Other fights do not count. | draft | **fixed** (R, R2-6): "places", the one word for a map location (N27) | ui/prep.js |
| SC9 | Contract tooltip: Hunt down {elite} in {region}. | draft |  | ui/prep.js |
| SC10 | Contract tooltip: Clear {dungeon}, its boss included. | draft |  | ui/prep.js |
| SC11 | Contract tooltip: Reward: {n} XP, {gold}, and 1 of 3 items. · Cost: {n} camp points. | draft |  | ui/prep.js |
| SC12 | Supplies (heading) | approved D150 item 15 |  | ui/prep.js |
| SC13 | Supply cards: Field Draughts 1 · Ember of Return 4 · Region Charts 1 · Tracker's Notes 2; tags Supply / Map; Buy / Sell / Owned | draft | **fixed** (U): tag "Map" for the two map supplies | ui/prep.js |
| SC14 | Field Draughts · effect: 2 Healing Draughts in your bags. · flavour: Corked bottles of bitter red, brewed by a hedge healer who will not say what is in them. | draft |  | content/texts.js |
| SC15 | Ember of Return · effect: One Ember of Return: you rise again once when you would die. · flavour: A coal that never cools, kept in a clay pot for the day the road ends badly. | draft |  | content/texts.js |
| SC16 | Region Charts · effect: Every place's region and every dungeon shown on each zone map. · flavour: Hand-inked sheets, folded soft from use, with the roads and the bad ground marked. | draft |  | content/texts.js |
| SC17 | Tracker's Notes · effect: Contract marks show up to 2 steps away, even on places you have not seen yet. · flavour: A scout's cramped notes on tracks, droppings and where the quarry sleeps. | draft |  | content/texts.js |
| SC18 | Option tooltip: {n} camp points, in effect when you set out (vision: for the whole run) · sold back for a full refund until you set out · Click or press {A-D} to buy it / to sell it back (+{n}) | draft |  | ui/prep.js |
| SC19 | Option tooltip, owned: Owned already (Legacy hall or the run's options): nothing to buy. | draft |  | ui/prep.js |
| SC20 | Camp points (counter) · tooltip: {n} this run; {m} spent. Points you keep can buy a contract at a hub on the way. They do not carry over to the next run. · {k} of 3 contract slots used | draft | **fixed** (R): the tooltip no longer says what H23 says | ui/prep.js |
| SC21 | Camp points you do not spend are lost. | draft |  | content/texts.js |
| SC22 | Set out (button) · tooltip, first run: Leave the camp for Amberfold Downs. Supplies go into your bags. | draft |  | ui/prep.js |
| SC23 | Set out tooltip, later runs: Leave the camp for Amberfold Downs. Supplies go into your bags and the perks last the run. · You set out with {contracts} contracts and {points} camp points. | draft |  | ui/prep.js |
| SC24 | You hold no contract: the zones then pay only what you find. | draft |  | ui/prep.js |
| SC25 | Set out with no contract? Press Set out again. (coach G1 alternative) | draft |  | content/tutorial.js |
| SC26 | Log line on setting out: You set out. (first run) · You set out with {n} contracts and {m} camp points. | draft |  | ui/engine-bridge.js |

## GR The guided first run: coach lines, hints and guide lines

Coach lines show one at a time under the HUD. {key_...} is filled with the key (Q W E engage, X pass, 8 first item, B bags, N talents, P spellbook, Z autoplay, F flee, Tab target). Beats G1-G17 are the guided run; H01-H37 are the first-time hints (a beat stands in for its hint). H35 and H36 cannot fire in the demo.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| GR1 | G1 Contracts: Take a contract: win its fights for extra XP and a reward. | draft |  | content/tutorial.js |
| GR2 | G1 Contracts (noContract): Set out with no contract? Press Set out again. | draft |  | content/tutorial.js |
| GR3 | G2 Moving: Click a lit place next to you to walk there. | draft |  | content/tutorial.js |
| GR4 | G4 Loot: Green arrow means upgrade. Equip it in your bags {key_bags}. | approved D150 item 18 |  | content/tutorial.js |
| GR5 | G5 The Furnace: Every move costs tolls. Spend too many and the final boss gets stronger. | approved D150 item 12 |  | content/tutorial.js |
| GR6 | G6 Intents: Its next three moves, in order. The big one is marked. | draft |  | content/tutorial.js |
| GR7 | G7 Engage round: Round 1 is yours: they act from round 2. Open with {key_engage1}, {key_engage2} or {key_engage3}. | approved D150 item 11 |  | content/tutorial.js |
| GR8 | G8 Wind-up: Wind-up: stop it with {key_engage2}, an interrupt or a stun, and it is weakened all fight. | draft |  | content/tutorial.js |
| GR9 | G8 Wind-up (landed): It landed: that enemy hits harder until it dies. | draft |  | content/tutorial.js |
| GR10 | G8 Wind-up (withEngage): Round 1 is yours: open with {key_engage2} on the wind-up and it is weakened all fight. | draft |  | content/tutorial.js |
| GR11 | G9 Deathblow (landed): Maimed: your healing is halved this fight. Drink early. | draft | **fixed** (R): H06 now has the same words; G9 stands in for H06 (one line on screen); the chip tooltip is the status on hover | content/tutorial.js |
| GR12 | G10 Contract marks: Marked place: win this fight to count it. | draft |  | content/tutorial.js |
| GR13 | G10 Contract sites (done): Contract done: choose one reward. | draft |  | content/tutorial.js |
| GR14 | G11 Potions: Low health: drink a Healing Draught ({key_item1}). | draft |  | content/tutorial.js |
| GR15 | G12 The Dimming: The dark spreads from the purple star. Places it reaches are lost. | approved D150 item 13 |  | content/tutorial.js |
| GR16 | G12 The Dimming (road): Take a Road to leave. | approved D150 item 13 |  | content/tutorial.js |
| GR17 | G13 Homeward Bell: Far from a Road? Ring the Homeward Bell to leave the zone. | draft | **fixed** (U, X): true in the full game and in the demo (in zone 2 the Bell ends the demo run); the beat shows only when the Bell is on the bar | content/tutorial.js |
| GR18 | G13 Homeward Bell (onRoad): On a Road: take it to the next zone. Keep the Bell for when no Road is near. | draft |  | content/tutorial.js |
| GR19 | G13 Homeward Bell (closed): Face Gorrak first: the Roads open once his fight is over. | draft |  | content/tutorial.js |
| GR20 | G13 Homeward Bell (onRoadFirst): On a Road: take it to the next zone. | draft |  | content/tutorial.js |
| GR21 | G14 Combo points: A finisher is ready: it spends all your combo points, and each point adds damage. | draft |  | content/tutorial.js |
| GR22 | G15 Resource (rogue): Not enough energy for that spell yet: energy refills every round. | draft |  | content/tutorial.js |
| GR23 | G15 Resource (mage): Not enough mana for that spell: mana refills slowly, and a Mana Draught restores it. | draft |  | content/tutorial.js |
| GR24 | G15 Resource (hunter): Not enough focus for that spell yet: focus refills every round. | draft |  | content/tutorial.js |
| GR25 | G16 Bloodlust: The red badge is Bloodlust: a beast hits harder each turn it acts, so kill it early. | draft |  | content/tutorial.js |
| GR26 | G17 Targets: Press Tab or click an enemy to choose your target. | draft |  | content/tutorial.js |
| GR27 | H01 Engage round: Round 1 is yours: they act from round 2. Open with {key_engage1}, {key_engage2} or {key_engage3}. | approved D150 item 11 |  | content/tutorial.js |
| GR28 | H02 Intent track: Above each enemy: its next three moves, in order. | draft |  | content/tutorial.js |
| GR29 | H03 Wind-up: Wind-up: stop it with {key_engage2}, an interrupt or a stun, and it is weakened all fight. | draft |  | content/tutorial.js |
| GR30 | H04 Deathblow: retired, no line | draft |  | content/tutorial.js |
| GR31 | H05 Off-balance: Off-balance: it takes +{offbalPct} % damage. Spend your big hit now. | draft | **fixed** (M): space before % | content/tutorial.js |
| GR32 | H05 (shield): Off-balance, but its shield takes your hits first: break it, then spend your big hit. | draft |  | content/tutorial.js |
| GR33 | H06 Maimed: Maimed: your healing is halved this fight. Drink early. | draft | **fixed** (R): same words as G9 landed, which stands in for it | content/tutorial.js |
| GR34 | H07 Lethal: Lethal: this hit kills you. Stop it, heal, or kill first. | draft |  | content/tutorial.js |
| GR35 | H08 DoT preview: The striped end of a health bar is what bleeds, burns and poisons take this round. | draft | **fixed** (U): names what the player sees (the striped end) | content/tutorial.js |
| GR36 | H09 Potions: Low health: drink a Healing Draught ({key_item1}). | draft | **fixed** (B): true with or without the Packed Satchel; H10 says what the Satchel does (also G11, GR14) | content/tutorial.js |
| GR37 | H10 Free potion: Packed Satchel: your first potion each fight costs no turn, at half strength. | draft |  | content/tutorial.js |
| GR38 | H11 Loot: Green arrow means upgrade. Equip it in your bags {key_bags}. | approved D150 item 18 |  | content/tutorial.js |
| GR39 | H12 Trainer: retired, no line | draft |  | content/tutorial.js |
| GR40 | H13 Spell bar: Drag your new spell onto the bar (spellbook, {key_spellbook}). | draft |  | content/tutorial.js |
| GR41 | H14 Talents: Talent point: spend it in Talents ({key_talents}). | draft |  | content/tutorial.js |
| GR42 | H15 Fog: You see the places next to you. Walking shows more. | draft |  | content/tutorial.js |
| GR43 | H16 The Furnace: Every move costs tolls. Spend too many and the final boss gets stronger. | approved D150 item 12 | **demo variant** (X): demo line (tutorial.js demo.hints.H16): "Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll." Also G5. Wired (L1): content/index.js binds `TUTORIAL.demo` under C.GATES.demo | content/tutorial.js |
| GR44 | H17 Burning: Burning: more XP, gold and better drops, but the final boss gets stronger. | draft | **demo variant** (X): demo line (tutorial.js demo.hints.H17): "Burning: more XP, gold and better drops. The Dimming still spreads with every toll." Wired (L1): content/index.js binds `TUTORIAL.demo` under C.GATES.demo | content/tutorial.js |
| GR45 | H18 The Dimming: The dark spreads from the purple star. Places it reaches are lost. | approved D150 item 13 |  | content/tutorial.js |
| GR46 | H19 Homeward Bell: same line as beat G13 | draft |  | content/tutorial.js |
| GR47 | H20 Contract mark: Marked place: win this fight to count it. | draft |  | content/tutorial.js |
| GR48 | H21 Contract done: Contract done: choose one reward. | draft |  | content/tutorial.js |
| GR49 | H22 Hub contract: This hub offers a contract. Pay in camp points, or swap one you hold. | draft |  | content/tutorial.js |
| GR50 | H23 Start camp: Camp points buy contracts and supplies. Keep a few to take a contract at a hub later. | draft |  | content/tutorial.js |
| GR51 | H24 Elite: Elite: hover it to see its Deathblow before you go in. | draft |  | content/tutorial.js |
| GR52 | H25 Rare: Rare: a named foe with better loot. Read its moves first. | draft |  | content/tutorial.js |
| GR53 | H26 Dungeon: Dungeon: several fights and a boss in one visit. | draft |  | content/tutorial.js |
| GR54 | H27 Disrupt: Bosses resist control: {key_engage2} disrupts their first wind-up instead. | draft |  | content/tutorial.js |
| GR55 | H28 Vendor: Sell what you do not need. Potions are always in stock. | draft |  | content/tutorial.js |
| GR56 | H29 Rest: Rest: back to full health, for tolls. | draft | **fixed** (R2-6): says "health" only; mana is named for a Mage in the Rest tooltip (MP9) and in the Mage's own resource line (GR23) | content/tutorial.js |
| GR57 | H30 Pass: Sapped: press Pass ({key_pass}) and it stays sapped, so its wind-up never comes. | draft | **fixed** (U): one word, Pass; Sapped is on the enemy when the hint shows | content/tutorial.js |
| GR58 | H31 Autoplay: {key_autoplay} lets autoplay fight for you. It stops Deathblows too. | draft |  | content/tutorial.js |
| GR59 | H32 Flee: You can flee ({key_flee}). The place stays open for later. | draft |  | content/tutorial.js |
| GR60 | H33 Pet: Your pet fights beside you and draws some of the blows. | draft |  | content/tutorial.js |
| GR61 | H34 Stealth: retired, no line | draft |  | content/tutorial.js |
| GR62 | H35 The Camp: The Camp: last stop before Oruvath. Spend your gold here. | draft | **explained** (X): cannot fire in the demo (no Camp; spec 4.1); no change | content/tutorial.js |
| GR63 | H36 End boss: No engage round here: read its schedule above it. | draft | **explained** (X): cannot fire in the demo (no Oruvath; spec 4.1); no change | content/tutorial.js |
| GR64 | H37 Hall of Echoes: Echoes buy lasting unlocks. They stay when a run ends. | draft |  | content/tutorial.js |
| GR65 | guide.rescueLine: The Bellwrights ring you back to safety ({rescueTolls} tolls). | draft | **fixed** (U): says what the Bellwrights do (they ring) | content/tutorial.js |
| GR66 | guide.rescueCapLine: That was the last rescue: the guide ends here, and from now on a death ends the run. | draft |  | content/tutorial.js |
| GR67 | guide.rescueLeftLine: Rescues left before the guide ends: {rescuesLeft}. | draft |  | content/tutorial.js |
| GR68 | guide.skipLine: You skip the guide: new things get one hint each. | draft |  | content/tutorial.js |
| GR69 | guide.roadsOpenLine: The Roads are open. | draft |  | content/tutorial.js |
| GR70 | guide.endLine: The guide ends here. New things get one hint each. | draft |  | content/tutorial.js |
| GR71 | guide.hubLine: Welcome to {zone}. | draft |  | content/tutorial.js |
| GR72 | guide.hubTrainerLine: Welcome to {zone}. The trainer has something new for you. | draft |  | content/tutorial.js |
| GR73 | guide.holdLine: The Bellwrights ring back the dark on this road until Gorrak's fight is over. | draft | **fixed** (U): says what the Bellwrights do | content/tutorial.js |
| GR74 | guide.dimBackLine: The Bellwrights ring their bells, and the dark falls back. | draft | **fixed** (U): says what the Bellwrights do | content/tutorial.js |
| GR75 | guide.bountyLine: Gorrak is beaten: the Bellwrights pay his bounty when you reach the next hub. | draft | **fixed** (U): no epithet; says when the bounty comes | content/tutorial.js |
| GR76 | guide.bountyRoadLine: The Bellwrights pay Gorrak's bounty: +{xp} XP. | draft | **fixed** (U): names the bounty | content/tutorial.js |
| GR77 | Gorrak's gate: Gorrak is out on the downs. Fights before he comes back: {n}. · Gorrak is back on his threshing floor. | draft |  | content/tutorial.js |
| GR78 | First-run nudge: First-run welcome (the welcome line on the run summary) · Your first unlock is ready: Packed Satchel. · Buy Packed Satchel: {satchelPotions} potions every run, and your first potion each fight costs no turn, at half strength. · Later | draft | **fixed** (U): plain welcome label; the hall line has "at half strength" as H10 | content/tutorial.js |
| GR79 | Coach strip buttons: Got it · Skip · Keep it · confirm: Skip the guide for this run? First-time hints stay on. · toast: Hints off. Settings can turn them on again. | draft |  | ui/onboarding.js |
| GR80 | UI hints: U01 Nearest Road: {steps}, {tolls}. · U02 Pass through a place for {passTolls} {key_pass}. · "Take a Road to leave. Nearest: {steps}, {tolls}." ("2 steps", was "2 hops") | draft |  | ui/ui-text.js |
| GR81 | Zone arrival and hub welcome: Welcome to {zone}. · Welcome to {zone}. The trainer has something new for you. · Welcome to {zone}. Visit the trainer, then set out. (fallback) | draft |  | ui/director.js |
| GR82 | Guided quests: see section QU (Rooted Rows, The Hedge Breaker, Straw and Tusk, Tusks in the Verge, The Wolf at the Wallow) | draft |  | content/quests.js |

## WD World: zones 1-2, hubs, roads, regions, dungeons

All names are inherited from earlier content (docs/lore/world.md is "inherited, agent-written strawman"); none is recorded as approved by the owner.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| WD1 | Zone 1: Amberfold Downs · theme: Farmland giving way to the forest edge, where old boundary stones keep failing. | draft |  | content/zones.js |
| WD2 | Hub Millbrook Rest: A mill, a well and a militia that has not slept in days. | draft |  | content/zones.js |
| WD3 | Roads (exits): Millbrook Gate · Harrow Lane · Stonecutters' Way | draft |  | content/zones.js |
| WD4 | Regions: Barleyreach Verge (wilds) · Carter's Furrow Road (road) · Boundary Stone Hollow (haunt) · Millbrook Steadings (steads) | draft |  | content/zones.js |
| WD5 | Dungeon The Harrow Cellars: Sunken storerooms under a burned manor, now home to bandits and worse. | draft |  | content/zones.js |
| WD6 | Shrine lines: A mossy boundary stone hums softly, warm under your hand, as though a ward still sleeps within it. \| Ribbons and wheat sheaves cover a roadside altar, tied there by farmers praying for a good year. | draft |  | content/zones.js |
| WD7 | Treasure lines: A farmer's strongbox lies half-buried beneath a collapsed haystack, its lock long rusted. \| Behind a loose hearthstone in a burned cottage, a pouch of coins waits for whoever looks. | draft |  | content/zones.js |
| WD8 | Junk items (grey, sold for coin): Cracked Hoof · Torn Sackcloth · Bent Nail | draft |  | content/zones.js |
| WD9 | Zone 2: Greywater Fens · theme: Drowned wetlands of reed, mist and rotting causeways. | draft |  | content/zones.js |
| WD10 | Hub Stilt Haven: Rope bridges and lamplit stilts above black water. | draft |  | content/zones.js |
| WD11 | Roads (exits): Stilt Haven Boardwalk · Lanternless Causeway · Heron's Ford | draft | **explained** (X): D.3: in the demo the zone 2 Road sign reads "End of the demo" and its tooltip carries the demo leave line (DEMO_TEXT.roadSign, leaveLine); the names stay | content/zones.js |
| WD12 | Regions: Sedge Flats (wilds) · Rotplank Causeway (road) · Gloamwater Hollow (haunt) · Stiltrow Hamlets (steads) | draft |  | content/zones.js |
| WD13 | Dungeon The Sunken Weir: A flooded dam-keep where the water rises one step each day. | draft |  | content/zones.js |
| WD14 | Shrine lines: A shrine of knotted reeds floats on a still pool, glowing with a dim green light. \| A sunken bell chimes beneath the mist, though no wind moves it. | draft |  | content/zones.js |
| WD15 | Treasure lines: A smuggler's oilcloth bundle is wedged in the roots of a drowned willow. \| A tilted pole holds a lockbox just above the waterline, left by a fisher who never returned. | draft |  | content/zones.js |
| WD16 | Junk items (grey, sold for coin): Waterlogged Rope · Cracked Eel Jar · Rotten Net Float | draft |  | content/zones.js |
| WD17 | Zone banner on arrival: {zone name} · Levels {a}-{b} · Enemies here deal up to {N} % more damage than their level alone | draft | **fixed** (U): states the base (their level) | ui/ui-text.js |
| WD18 | Region lines on the map: Wilds: beasts, open country · Road country: bandits and waystations · Haunt: ruins, casters and shrines · Steads: farms, villages and rest | draft |  | ui/screens.js |
| WD19 | Where a falling shard struck the land. The dark spreads from here. | draft | **fixed** (U): no rim, no Oruvath | content/texts.js |
| WD20 | Darkness that spreads from the Shardfall, place by place. Whoever stands in it must fight. | draft | **fixed** (U): no "hop"; says what standing in it means | content/texts.js |
| WD21 | It spreads up to {maxPerToll} places for each toll, nearest the purple star first, once you have spent {grace} tolls in the zone. | draft | **fixed** (M, U): a sentence, not a formula | content/texts.js |
| WD22 | A small brass bell. Rung, it carries you on to the next zone's hub. | draft |  | content/texts.js |
| WD23 | Things that walked into the Dimming and came out hollow, lit only by the shard's cold glow. | draft | **explained** (X): unused: no screen shows it (Dimmed fights use the zone's own enemies); no change | content/texts.js |

## MP Zone map, nodes and dialogs

The map is the main screen. Each node type has a tooltip, and a dialog on entering. "Level N" is on the hero scale in a Legacy run.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| MP1 | Node names: Quest, Grind, Elite (Rare elite), Dungeon, Rest, Vendor, Trainer, Treasure, Shrine · Hub: Zone hub: trainer, vendor and inn | draft |  | ui/screens.js |
| MP2 | Fog: Unknown: not seen yet. Its ring (how far it is from the hub) gives its level range. · Seen from afar: its type only. · Remembered: seen before, out of sight now. · Ring {n} · levels {a}-{b} · Ring {n} · guided fight | draft | **fixed** (U): the ring is explained; "guided fight" names the guided run's set fights | ui/screens.js |
| MP3 | Legend: In sight · Remembered · Seen from afar · Unknown · Dimmed · Dims in 3 tolls · Shardfall | draft | **fixed** (M): player words for the fog states | ui/screens.js |
| MP4 | Vision: Places up to {n} step(s) away are in full view; a place once seen stays on the map. · Your charts show every region. / A region shows where you have seen its land. · Pathfinder: place types up to {n} steps away. | draft | **fixed** (U, R2-6): "steps" for map distance (as the Tracker's Notes rule); "place" for a map location (N27) | ui/screens.js |
| MP5 | Quest tooltip: {quest title} · From {giver} · Foes: {n} enemies + role badges · A quest giver needs help. One fight, then experience, gold and a choice of two rewards. Three quests in a zone complete its story. | draft |  | ui/screens.js |
| MP6 | Grind tooltip: Wave 1: {n} enemies · Fight 1 to 3 waves of two enemies. Steady experience, gold and more drops. | draft |  | ui/screens.js |
| MP7 | Elite tooltip: {name} · Elite level {n} · Has a Deathblow: one huge hit you must stop. · One powerful enemy, two levels higher. High experience and a guaranteed good item. | approved D150 item 23 (Deathblow line) |  | ui/screens.js |
| MP8 | Dungeon tooltip: {dungeon} · Boss: {boss} · Fight 1: 2 enemies … · Its boss has a Deathblow: one huge hit you must stop. · Three fights and a dungeon boss. The best loot in the zone, and the most dangerous place. | draft |  | ui/screens.js |
| MP9 | Treasure / Rest / Vendor / Shrine tooltips: Unguarded · Full health (and mana, for a Mage), and rested experience: kills give double XP until it runs out. · Buy potions, rations and gear; sell junk and old equipment. · Learn new spells and train known ones to your level. · Choose one of two blessings. | draft | **fixed** (R2-6): a Hunter or Rogue starts every fight with a full resource, so the Rest tooltip names mana only for a Mage | ui/screens.js |
| MP10 | Zone danger line: Zone danger: enemies here deal up to +{N} % damage (above level {n}). | draft | **explained** (R): the banner shows once on arrival; this is the same rule on hover over the zone line, where the player looks it up later | ui/screens.js |
| MP11 | Move lines: Click to enter · Click to walk here · Click to travel here · Costs {n} tolls. · Not here yet. · You are here · Not next to you · Visited · Done | draft | **fixed** (M): one wording | ui/screens.js |
| MP12 | Costs {n} tolls. (move cost; "Costs {n} tolls a wave." for a Grind; "Costs {n} tolls, then a fight in the Dimming.") | approved D150 item 6 |  | ui/heat.js |
| MP13 | Not here yet. (a barred place) | approved D150 item 23 |  | ui/screens.js |
| MP14 | Entered {Calm/Smouldering/Burning/Infernal}: it gave a bonus · {state} bonus: +35 % XP and gold, 1 in 2 drops a rarity up. | draft |  | ui/heat.js |
| MP15 | Road node: {Road name}: leads to {next zone hub} · A Road out of the zone, to {hub}. · Standing on it: Take the Road · {n} tolls · Dimmed: first a fight with this zone's creatures, made stronger by the dark; then the Road can still be taken. | draft | **explained** (X): D.3: in zone 2 of the demo the Road tooltip reads "{Road name}. Leaving Greywater Fens ends this demo run. You keep your levels and Legacy points." (no zone 3 name) | ui/screens.js |
| MP16 | Road click: Walk to the Road first · Too far: click a lit place | draft |  | ui/screens.js |
| MP17 | Dimmed node: Lost to the Dimming: it can no longer be done. · Dimmed: entering or staying here starts a fight with this zone's creatures, made stronger by the dark; what it held is lost. | draft | **fixed** (R): the Dimming panel no longer repeats it (MP19); the node and the Road tooltips are hovered one at a time | ui/screens.js |
| MP18 | Dimming panel: {n} of {m} places Dimmed · Starts to spread in {n} tolls · Spreads in {n} tolls: {k} places · Spreads again in {n} tolls · You stand in the Dimming! · Your place dims in {n} tolls | draft |  | ui/screens.js |
| MP19 | Dimming panel tooltip: The Dimming · Darkness that spreads from the Shardfall, place by place. Whoever stands in it must fight. · It spreads up to 2 places for each toll, nearest the purple star first, once you have spent 6 tolls in the zone. · What a Dimmed place held is lost. Leave by a Road or the Bell before the dark reaches you. | draft | **fixed** (R, M): the Dimmed-node rule said once (the node tooltip); the pace line is a sentence | content/texts.js, ui/screens.js |
| MP20 | Held corridor (guided zone): The Bellwrights ring back the dark on this road until Gorrak's fight is over. | draft | **fixed** (U): see GR73 | content/tutorial.js |
| MP21 | Travel: Ring the Bell ({n}) · It takes you to the hub of {zone} · Leave for {zone}. · {n} contracts here will expire: {list}. No reward. · Click, then confirm | draft | **explained** (X): D.3: in zone 2 of the demo the Bell and Road tooltips carry the demo leave line, not the zone 3 hub | ui/screens.js |
| MP22 | Leave dialog: Leave {zone}? · Take the Road anyway · Ring the Homeward Bell? · The Homeward Bell takes you to the hub of {zone}. Costs {n} tolls. It is your only charge this run. No way back to {zone}. · {n} contracts here will expire: {list}. They pay nothing once expired. · Esc: stay | draft | **explained** (X): D.3: in zone 2 of the demo the dialog drops "takes you to the hub of ..." and "No way back to ..." and shows the demo line (DM9) once | ui/screens.js |
| MP23 | Spyglass (not offered at the demo camp): Look at any node of the zone, however far… | draft | **explained** (X): cannot occur in the demo (no Spyglass at the camp); no change | ui/screens.js |
| MP24 | Quest dialog: {title} · Quest · level {n} · {giver} says: “{quest text}” · Enemies · Reward: experience, gold and a choice of two items. · Accept | draft |  | ui/screens.js |
| MP25 | Grind dialog: Grind · Level {n} · {n} wave(s) · {n} tolls · Enemies · You can stop after any wave. · Wave {n} of {m} done | draft |  | ui/screens.js |
| MP26 | Elite dialog: {elite name} · Elite · level {n} (Rare elite for a rare) · {flavour line} · Threat: High: elites hit hard and have special abilities · Reward: Large experience, gold and a guaranteed good item · Escort: {name} · Engage | draft |  | ui/screens.js |
| MP27 | Dungeon dialog: {dungeon} · Dungeon · level {n} · {dungeon text} · Fights: {n} groups, then {boss} · Between fights: You may eat, change gear, or leave with what you have · Warning: No fleeing from the dungeon boss · Enter the dungeon · Eat Trail Rations ({n}) · Leave the dungeon · Press on · Face the boss · Fight {n} of {m} cleared · Next: {boss}. There is no fleeing from the boss. | draft |  | ui/screens.js |
| MP28 | Treasure / Rest / Shrine dialogs: A guardian watches the chest: {name}. · The chest is yours. · Open the chest · Rest · Campfire · You rest by the fire until the ache leaves your bones. · {n} XP: kills give double experience · Shrine · Choose one blessing · An old shrine hums softly. · A needle trap! · You lost some health opening it. | draft |  | ui/screens.js |
| MP29 | Shrine blessings: Boon of Return (An extra Ember of Return, kept until you use it.) · Boon of Insight (+20 % experience for the next 3 places.) · Boon of Fury (+15 % damage for the next 3 places.) · Boon of Plenty (A pouch of gold, now.) · Boon of Mending (Full health now, plus rested experience. A Mage also gets its mana back.) · Boon of Clarity (Your next respec is free, and every spell is trained to your level now.) | draft | **fixed** (N, R): the boon grants an Ember of Return; the HUD, log and banner name the revive "Ember of Return" for both sources. The badge and tooltip show one count when both sources are held ("Ember of Return ×2", L6). The blessing's own name "Boon of Return" is an engine constant (owner page) | ui/mock-data.js |
| MP30 | Minimap and tracker: Zone story: {n} / 3 quests · Levels {a}-{b} · Contract slots {n}/3 · {points} camp points · None in this zone · Expires when you leave this zone · Both expire when you leave this zone · Later: {n} contract(s) (zone {z}) · L | draft | **fixed** (U): "Zone story" in the tracker, the reward window and the summary | ui/prep.js |

## FU The Furnace (heat bar) and the Dimming meter

The bar is hidden in the guided first run until its coach line has shown. State words: Calm, Smouldering, Burning, Infernal (D68, team decision with owner review of names; D150 kept "tolls" and "the Dimming").

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| FU1 | Meter line: {state} · {n} tolls to spare / {n} tolls overspent / No tolls to spare · Boss +{n} % (only above 0) | approved D150 item 1 | "Boss +{n} %" is not shown in the demo (L1: no demo run meets the boss) | ui/heat.js |
| FU2 | The Furnace (title and tooltip heading) | draft | **open: owner name** (N): name on the owner page (docs/review/demo-owner-review.md) | ui/ui-text.js |
| FU3 | Calm · Smouldering · Burning · Infernal | draft | **fixed** (R): the fire status is now "Ablaze" (FT1), so "Burning" names only the Furnace state; "Infernal" is the fourth state and shows on the bar and its tooltip | ui/ui-text.js |
| FU4 | Tooltip: Every move costs tolls. Overspend and fights pay more, but the final boss gets stronger. | approved D150 item 5 | **demo variant** (X): demo line DEMO_TEXT.furnaceLine: "Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll." The approved line stays for the full game. Wired (L1): heat.js `furnaceLine(ctx)` in the meter tooltip and the hub intro; "Boss +N %" hidden in the demo | ui/heat.js |
| FU5 | Tooltip rows: Calm: Tolls to spare · Smouldering: Up to 10 overspent · Burning: 10 to 30 overspent, +35 % XP and gold, 1 in 2 drops a rarity up · Infernal: 30 or more overspent, +50 % XP and gold, 7 in 10 drops a rarity up | approved D150 item 5 |  | ui/heat.js |
| FU6 | Tooltip when the Dimming sets the state: Your place dims in {n} tolls. Tolls: {n} overspent / to spare / none to spare. The dark near you sets the Furnace now. · ◆ The dark near you. The marker further right sets the state. | draft | **fixed** (R): "the dark" for the second mention; one "sets" per line | ui/heat.js |
| FU7 | Meter line while the Dimming sets it: The Dimming is near · You stand in the Dimming · tag: Set by your tolls / Set by this place | draft |  | ui/heat.js |
| FU8 | Inside a place: This place counts as {state}. A place counts in the state you entered it in, whatever the Furnace shows later. | draft |  | ui/heat.js |
| FU9 | Carry-over: Tolls carry over: {n} overspent / saved before this zone; this zone gives {m}. · Zone 2 gives you 20 tolls, plus the 10 you saved: 30 to spare. (on arrival in zone 2, beside Set out) | draft | **fixed** (U): plain sum | ui/heat.js |
| FU10 | The Dimming takes {n} places while you are inside. (place tooltip) | draft |  | ui/heat.js |
| FU11 | Item badge: ▲ The Furnace · Raised by the Furnace: Found in a place entered Burning: one rarity better than it dropped. · ▲ The Furnace raised it one rarity (found Rare) | draft | **fixed** (R): "raised" once in the tooltip | ui/heat.js |
| FU12 | Log line on a change of state: The Furnace: Burning · 3 tolls overspent. | draft |  | ui/heat.js |
| FU13 | Run summary, Furnace card: The Furnace · Tolls in each state: Calm {n} · Smouldering {n} … · Tolls per zone: above 0 overspent, below 0 to spare · Tolls: {n} · {n} tolls to spare / overspent in the last zone · Places entered, by the state you entered them in: … · Fights won while Burning or Infernal: {n}. The Dimming caught you {n} times (Infernal where it stands). Hover a point for its tolls. | draft | **fixed** (R, X): one "Tolls" fewer (caption "Per zone: ..."); the Oruvath end line shows only after the Camp (summary reachedCamp), never in the demo | ui/heat.js |

## HB Hub, trainer, vendor, inn

Hubs: Millbrook Rest (zone 1), Stilt Haven (zone 2).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| HB1 | Hub panel: {hub name} · {zone} · levels {a}-{b} · {hub text} · Set out | draft |  | ui/screens.js |
| HB2 | Trainer card: Learn and rank up spells · Waiting: {n} new spells, {m} rank(s) · Its lessons cost more gold than you have. · Next spell at level {n}. · Nothing new to learn. | approved D150 item 22 (Next spell at level {n}.) |  | ui/screens.js |
| HB3 | Vendor card: Potions, rations and gear · Potions and rations (gear sold out) | draft |  | ui/screens.js |
| HB4 | Inn card: Full rest and rested experience · Used this visit · Rest anyway? · Health {n} %, mana {n} %: nearly full · Rest · {n} tolls · Cancel | draft |  | ui/screens.js |
| HB5 | You have {n} unspent talent point(s). Press N. | draft |  | ui/screens.js |
| HB6 | Hub contract (from the second zone on): Contract on offer · {hub} has work on the board: {contract} · Take for {n} camp points (you have {m}) · Swap… · Keep my contracts · Give up: {contract} · zone {z}, {progress} · Take it for camp points: Pay {n} camp points of your {m}. It needs a free slot ({k} of {slots} used). Only before you leave this hub. · Swap: Give up one contract you hold and take this one for free. No refund; its progress is lost. Only before you leave this hub. · Contract taken · {title}: its marks are on the map and in your tracker. | draft | **fixed** (R): "Only before you leave this hub" once (Take); Swap explains itself in its tooltip; "its marks are on the map" | ui/prep.js |
| HB7 | Trainer window: Trainer · Train spells to bring them up to your level. · Train to rank {n} · Requires level {n} · Train all · Raises each spell that can train by one rank, then learns the new spells your gold covers. | approved D150 item 21 (subtitle) |  | ui/screens.js |
| HB8 | Vendor window: Vendor · Buy and sell · Wandering merchant · Need more gold · Potions, rations and gear · Sells for: {price} | draft |  | ui/screens.js |
| HB9 | Vendor log lines: You buy {item}. · You sell {item} for {n} copper. · You sell {n} junk items for {n} copper. · You learn {spell}. · {spell} trained to rank {n}. | draft |  | ui/director.js |

## QU Quests (zones 1-2)

Each row: title, giver, quest text, turn-in line. Shown in the quest dialog, the tracker and the quest log (L). The five "guide" quests are the guided first run. Rule of thumb in D150: two short sentences at most; flagged where a quest breaks it.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| QU1 | Blight in the Barley · Farmer Osric Dunne · “The boars have trampled my north field flat, and thieves are stripping what is left. Cull them before the harvest is lost.” · Turn-in: “Good. The barley may yet stand next year.” | draft |  | content/quests.js |
| QU2 | Lost Lambs · Maud Thatcher · “Three lambs strayed into the wood, where wolves circle and an ogre has been seen. Find them and drive the lot off.” · Turn-in: “You found them! I will light a candle for you tonight.” | draft |  | content/quests.js |
| QU3 | Hedge and Thorn · Wardkeeper Ilsa · “Cutpurses have taken to the hedgerows along the Millbrook road. Clear them out.” · Turn-in: “The road is quiet again. Take your fee.” | draft |  | content/quests.js |
| QU4 | Flour for the Crossing · Miller Teodor · “Carry this sack of flour to the guard post by the old bridge. Mind the wolves and the road thieves on the way.” · Turn-in: “Fresh bread tonight, thanks to you.” | draft |  | content/quests.js |
| QU5 | What the Scarecrow Saw · Elder Wynne · “Strange lights move among the straw men and the old stone sentinels at night. Go see what stirs them.” · Turn-in: “A stolen charm, then. I will see it found. You have done enough.” | draft |  | content/quests.js |
| QU6 | Pillars of the Field · Wardkeeper Ilsa · “The boundary stones are cracking. Gather shards from the stone sentinels to be reset, and watch for boars rooting among the rubble.” · Turn-in: “These shards will mend the old wards.” | draft |  | content/quests.js |
| QU7 | A Hermit's Debt · Brother Alden · “An old herbalist in the briars owes me a favour and will not answer. See that she is well.” · Turn-in: “She lives, though changed. I am in your debt.” | draft |  | content/quests.js |
| QU8 | The Ogre of the Threshing Floor · Reeve Hollis · “An ogre and his thieving crew have seized the village threshing floor and the grain with it. Drive them out.” · Turn-in: “The floor is ours again. Well fought.” | draft |  | content/quests.js |
| QU9 | Ashes on the Wind · Captain Brae · “Smoke rises from the old Harrow manor, where thieves and straw figures shelter in the ruins. Learn who lit the fires.” · Turn-in: “Cultists below and thieves above. I will send word to the wardens. Your part is done.” | draft |  | content/quests.js |
| QU10 | Rooted Rows · Goodwife Ennet · “A furrow boar is rooting up the seed rows behind the mill. Drive it off before it eats the lot.” · Turn-in: “Bless you. Take this, and a draught for the road.” · (guided run) | draft |  | content/quests.js |
| QU11 | The Hedge Breaker · Jory Larrow · “A slow, heavy ogre keeps smashing through the hedges on the east lane. Send him back to the woods.” · Turn-in: “The lane is quiet again. Well struck.” · (guided run) | draft | **fixed** (U): two sentences; the giver is Jory Larrow (one Hobb in zone 1) | content/quests.js |
| QU12 | Straw and Tusk · Tamsy Crake · “A scarecrow walks the turnip field at night, and a boar trots at its heels. When the straw man starts to chant, stop it.” · Turn-in: “No more chanting in my field. Thank you.” · (guided run) | draft |  | content/quests.js |
| QU13 | Tusks in the Verge · Hayward Tobin · “Boars come down from the Verge and churn every field they cross. Thin them out for us.” · Turn-in: “That will keep them off the fields a while.” · (guided run) | draft | **fixed** (R): the zone 1 giver is Hayward Tobin (one Pell, in zone 2) | content/quests.js |
| QU14 | The Wolf at the Wallow · Swineherd Brannick · “A barn wolf stalks the boar wallow by the old fence. Clear out the boar and the wolf together.” · Turn-in: “Good. The herd can graze in peace again.” · (guided run) | draft |  | content/quests.js |
| QU15 | Fever on the Water · Healer Maren · “The fen fever spreads. Bring me sap from the stalks guarded by the bog witches and their acolytes.” · Turn-in: “Brewed and ready. The sick will thank you.” | draft |  | content/quests.js |
| QU16 | Stilts and Snares · Harbourwarden Pell · “Mist hounds and the reed stalkers who run with them are snatching the catch from our drying racks. Thin their ranks.” · Turn-in: “The racks hold fish again.” | draft |  | content/quests.js |
| QU17 | The Lost Causeway · Surveyor Ansel · “The old causeway has sunk out of sight. Walk the margins and mark where the stones remain.” · Turn-in: “This map saves lives. Thank you.” | draft |  | content/quests.js |
| QU18 | Salt for the Smokehouse · Ketil Reedman · “Bring this salt crate across the fen to the smokehouse. The lurkers hunt the shallows and witches hex the path.” · Turn-in: “Not a grain wet. You have my thanks.” | draft |  | content/quests.js |
| QU19 | A Witch's Bargain · Old Sedge · “The bog witches poison the wells to sell the cure, and their peat guardians keep watch. End their trade for good.” · Turn-in: “The wells run clear. At last.” | draft |  | content/quests.js |
| QU20 | Fenmother's Request · Priestess Lorn · “Two of our acolytes are missing past the black pool. Bring them home, if they live.” · Turn-in: “They are safe. The waters bless you.” | draft |  | content/quests.js |
| QU21 | Gloam Eel Tales · Fisher Dagny · “Gape-jawed lurkers and a mire brute have taken three boats this season. Hunt them down in the dark channel.” · Turn-in: “Things like that should not be swimming. Well done.” | draft |  | content/quests.js |
| QU22 | Rot Beneath the Planks · Harbourwarden Pell · “Peat guardians wake near the stilt walkways and crack our footings, and lurkers follow the noise. Break them apart.” · Turn-in: “The footings hold. We owe you.” | draft |  | content/quests.js |
| QU23 | The Weir Keeps Rising · Surveyor Ansel · “Something works the floodgates of the old weir at night. Look into the dam-keep and report.” · Turn-in: “Someone holds the weir from inside. That tells us plenty. Thank you.” | draft |  | content/quests.js |
| QU24 | Quest log and tracker lines: Quest complete! · Zone story complete: a rare reward awaits. · {zone}: zone story · {zone}: the story is told · Three tasks done; the people of this land will remember your name. · Complete 3 quests in this zone for a rare reward and bonus experience. Done: {n} / 3. | draft | **fixed** (U): "Zone story" everywhere; the summary reads "(zone stories: 1)", no plural slip | ui/engine-bridge.js, ui/windows.js |

## CT Contracts

Contract sentences are built from four templates and the family names. Zone 1-2 families: outlaw, wild beast, blightborn, fen beast, reedfolk, witchkin. In the demo the board draws from zones 1-2 only (demo spec 4.3).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| CT1 | cull: Beat the {family} at {n} marked places, most of them in {region}. | draft |  | content/texts.js |
| CT2 | bounty: Hunt down {elite}, a {familyOne} roaming {region}. | draft |  | content/texts.js |
| CT3 | delve: Clear {dungeon}, its boss included. | draft |  | content/texts.js |
| CT4 | hub: {hub} has work on the board: {contract} | draft |  | content/texts.js |
| CT5 | Kind names: Cull · Wanted · Delve · Win fights at its marked places: Quest and Grind places, most of them in one region. · Hunt down one named elite that roams one region. · Clear the zone's dungeon, its boss included. | draft | **fixed** (N): Bounty is now "Wanted" (no clash with Gorrak's bounty); Cull and Delve are plain English and each kind has its one-line tooltip; the kind names are on the owner page | ui/ui-text.js |
| CT6 | Family outlaws · done line: “Fewer outlaws on the roads. The carters will sleep easier.” | draft |  | content/texts.js |
| CT7 | Family wild beasts · done line: “The wild beasts keep their distance now. The herders thank you.” | draft |  | content/texts.js |
| CT8 | Family blighted things · done line: “The blighted things are burnt back. The fields can breathe.” | draft | **fixed** (U): plain family name | content/texts.js |
| CT9 | Family fen beasts · done line: “The fen beasts have gone quiet in the reeds. Good riddance.” | draft |  | content/texts.js |
| CT10 | Family reedfolk · done line: “The reedfolk have pulled back into the marsh. The boats can go out again.” | draft |  | content/texts.js |
| CT11 | Family witchkin · done line: “The witchkin's hexes are broken, and the wells taste clean.” | draft |  | content/texts.js |
| CT12 | Delve done line: {dungeon} is quiet at last. | draft |  | ui/ui-text.js |
| CT13 | Fallback done line: A runner from {hub} brings your pay. Well done. | draft |  | ui/ui-text.js |
| CT14 | Where-to-go lines: Delve: Go to {dungeon}. It shows on the zone map while you hold this contract. · Cull: Go to {region}. Only the marked Quest and Grind places count; other fights do not. · Wanted: Go to {region}. {elite} stands at {n} marked Elite places there. Beat it at either one. · every kind: Its marks show on the map up to {n} steps away (, {n} more with the Local Guide) (; with Tracker's Notes up to {n} steps, even on places you have not seen). | draft | **fixed** (R, R2-6): plain sentences that say where to go first, then what counts, then how far away the marks show; "places" and "steps"; the Local Guide and Tracker's Notes parts show only when the player has them | ui/ui-text.js |
| CT15 | Reward line: choose 1 of {n}: {p} % rare, {p} % epic | draft | **explained** (M): the card holds it on one uncut line (ui-regress M-prep); the figures are the item chances the player asked for in the blind rounds; no change | ui/ui-text.js |
| CT16 | Contract log lines: Contract taken: {name} · Contract site won: {name} · {n} / {m} · Contract complete: {name} · Contract expired: {name} · Contract given up: {name} | draft |  | ui/engine-bridge.js |
| CT17 | Board screen (run 2): Your camp has grown: {points} camp points and a contract board. Contracts give XP, gold and a choice of gear. | draft | **fixed** (R): "give", not "pay" | content/texts.js |
| CT18 | Contract slot rows: Contract slots {n}/3 · {points} camp points · Later: {n} contract(s) (zone {z}) | draft |  | ui/prep.js |

## EN Enemies of zones 1-2

Name, kind and the line shown in the enemy tooltip, dialog or Elite card. "abilities" are the names that show on the wind-up track. Kind: normal, trash (a dungeon fight), elite, rare elite, boss.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| EN1 | Hedge Ogre (normal) · A stooped giant who tears fence posts from the earth and swings them like clubs. | draft |  | content/enemies.js |
| EN2 | Furrow Boar (normal) · A tusked boar driven wild by the blight in the barley. It charges anything that moves. | draft |  | content/enemies.js |
| EN3 | Barn Wolf (normal) · A lean grey wolf that has learned to open latches. It hunts in the hour before dawn. | draft |  | content/enemies.js |
| EN4 | Hedgerow Cutpurse (normal) · A road bandit who lurks in the briars and takes coin before the knife. | draft |  | content/enemies.js |
| EN5 | Scarecrow Hexer (normal) · A straw figure animated by a stolen charm. Its crooked fingers throw sparks of blight. | draft |  | content/enemies.js |
| EN6 | Stonewall Sentinel (normal) · A boundary-stone given legs by an old warding. It guards fields no one tends any more. | draft |  | content/enemies.js |
| EN7 | Bramble Herbalist (normal) · A hermit who binds wounds with thorn-sap. She fights for whoever last fed her. | draft |  | content/enemies.js |
| EN8 | Gorrak the Fieldbreaker (elite) · Pillar-fisted ogre who claimed the Millbrook threshing floor as his throne. · abilities: Threshing Blow | draft |  | content/enemies.js |
| EN9 | Old Marrow the Hexer (elite) · A gaunt scarecrow-maker whose last straw man learned to curse its master. · abilities: Rot-in-the-Seed | draft |  | content/enemies.js |
| EN10 | Mother Thistlewick (rare elite) · An ancient herb-witch whose garden grows only at night. · abilities: Nightbloom Poultice, Thorn Lash | draft |  | content/enemies.js |
| EN11 | Cellar Rat Swarm (trash) · A shifting carpet of black rats gnawing at the old grain stores. | draft |  | content/enemies.js |
| EN12 | Harrow Deserter (trash) · A runaway soldier turned cellar thief, knives drawn. | draft |  | content/enemies.js |
| EN13 | Rust-Shackled Guard (trash) · A dead jailer still bound to the keys it never gave up. | draft |  | content/enemies.js |
| EN14 | Candle Cultist (trash) · A robed zealot burning tallow to a hungry darkness. | draft |  | content/enemies.js |
| EN15 | Warden Belk of Harrow (dungeon boss) · The manor reeve who bricked himself in with his stolen rents and never left. · abilities: Ledger-Breaker, Distraint Chain | draft | **open: owner name** (U): rename proposed on the owner page (Distraint Chain → Debtor's Chain); not applied: ability and enemy names are in the engine's golden run hashes (s18, s23, s28), so an approved rename goes in one commit with the hashes re-recorded | content/enemies.js |
| EN16 | Mire Brute (normal) · A hulking swamp-dweller coated in peat. Its fists hit like dropped boulders. | draft |  | content/enemies.js |
| EN17 | Reed Stalker (normal) · A thin fen-hunter who moves unseen through the tall reeds. | draft |  | content/enemies.js |
| EN18 | Bog Witch (normal) · A hag who brews fever-mist over her cauldron and flings it at travellers. | draft |  | content/enemies.js |
| EN19 | Marsh Lurker (normal) · A gape-jawed amphibian that waits just below the waterline. | draft |  | content/enemies.js |
| EN20 | Peat Sentinel (normal) · A walking heap of sodden turf and old timber, slow but nearly unbreakable. | draft |  | content/enemies.js |
| EN21 | Fenmother Acolyte (normal) · A priestess of the slow waters who knits wounds with silt and prayer. | draft |  | content/enemies.js |
| EN22 | Mistfang Hound (normal) · A pale hound bred by smugglers, fast and silent in the fog. | draft |  | content/enemies.js |
| EN23 | Bargh the Drowned King (elite) · A chieftain dragged under years ago who returned wearing the marsh like a crown. · abilities: Tidefall Slam | draft |  | content/enemies.js |
| EN24 | Sisel Mistweaver (elite) · A fen-witch who stitches fog into a shroud around her enemies. · abilities: Choking Mist | draft | **explained** (R): three different people in two zones with three name shapes (title + name, name + byname, "Old" + name + byname); kept; listed for the lore chat | content/enemies.js |
| EN25 | The Gloam Eel (rare elite) · An enormous eel said to be older than the causeways. · abilities: Venom Fangs, Thrashing Coils | draft |  | content/enemies.js |
| EN26 | Weir Crawler (trash) · A pale cave-crab grown huge on the dam's drowned stores. | draft |  | content/enemies.js |
| EN27 | Drowned Sentry (trash) · A rotting gate-guard that still stands its watch under the water. | draft |  | content/enemies.js |
| EN28 | Sluice Cutthroat (trash) · A smuggler who works the underwater sluices with a hooked blade. | draft |  | content/enemies.js |
| EN29 | Tidecaller Adept (trash) · A cultist who calls surges of cold brine against intruders. | draft |  | content/enemies.js |
| EN30 | Mawgrim of the Locks (dungeon boss) · A bloated gatekeeper who opens the floodgates on anyone who crosses his locks unpaid. · abilities: Flood Hammer, Draw the Tide | draft | **fixed** (N): no "toll" | content/enemies.js |
| EN31 | Hobb Tollwright (rare elite) · A road-warden turned robber who still writes a receipt for every purse. · abilities: Toll Hook, Final Receipt | draft | **open: owner name** (N): name and ability on the owner page (Hobb Tollwright → Hobb Ledgerhand; Toll Hook → Snag Hook); not applied, golden hashes as EN15 | content/enemies.js |
| EN32 | The Mildew Warden (rare elite) · A stone-walled field guardian crusted in grey rot that spreads wherever it stands. · abilities: Blight Husk, Rotting Haymaker | draft | **open: owner name** (R): Warden Pell is now Hayward Tobin (QU13); Warden Belk → Steward Belk proposed on the owner page; golden hashes as EN15 | content/enemies.js |
| EN33 | Skerrow Stiltwalker (rare elite) · A gaunt reed-hunter who crosses the mire on poles and is never where you struck. · abilities: Reed Barb, Pole Sweep | draft |  | content/enemies.js |
| EN34 | Old Wrenna Marshlight (rare elite) · A fen-crone who bottles marsh fires and drinks what her enemies spill. · abilities: Peat Poultice, Drowning Whisper | draft |  | content/enemies.js |
| EN35 | Role cards: Brute: Hits hard. Its Heavy Smash is a big blow, shown ahead on its track. Ask: Stop its Heavy Smash with a stun or control, or let a shield take it; then hit it while it is off-balance. | Caster: Fragile, but its casts hurt and curse you. Ask: Stop its Hex Bolt with an interrupt or control, or kill it before it casts. | Skulker: Bleeds you, and as a lookout signals for help when it is not alone. Ask: Kill it, or stop it with an interrupt or control, before it signals. | Beast: Bloodlust: deals more damage every turn it acts. Ask: Kill it early: every turn alive makes it stronger. | Guardian: Shields its ward and braces itself; tough to bring down. Ask: Do not spend your burst on its ward early, or control the guardian. | Mender: Bolsters the weakest ally with a shield and mends the wounded. Ask: Kill or control it, and stop its Mend with an interrupt. | draft | **fixed** (R): the asks use "stop"; Heavy Smash, Hex Bolt and Mend are the roles' own moves (C.ARCHETYPE actions) and show on the track under those names | ui/ui-text.js |
| EN36 | Enemy tooltip small lines: Elite level {n} · Level {n} · Rare elite · Has a Deathblow: one huge hit you must stop. · {n} enemies · Boss: {name} | approved D150 item 23 (Deathblow line) |  | ui/screens.js |

## FT The fight: bars, tracks, wind-ups and the log

Shown in every fight. Key letters are the ones in the build today. Status words are STATUS_INFO (what the player sees when hovering a status).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| FT1 | Status words (zones 1-2): Stunned: Skips its actions. \| Frozen: Frozen solid; skips its actions. \| Hexed: Skips its actions. Damage breaks the hex. \| Silenced: Cannot cast spells. \| Bleeding: Takes damage at the end of each round. \| Burning: Takes fire damage at the end of each round. \| Poisoned: Takes poison damage per stack each round. \| Chilled: Deals 20 % less damage. \| Cursed: Deals 15 % less damage. \| Exposed: Takes more damage. \| Marked: Takes 8 % more damage. \| Arcane Ward: Absorbs damage. \| Evasion: Greatly increased dodge. \| Stealth: Unseen. Openers are usable; enemies miss more often. \| Field Dressing: Heals at the end of each round. \| Taunting: Enemies attack the pet. \| Braced: Takes 50 % less damage. \| Off-balance: Its big move failed: it takes more damage, your hits crit more often, and it cannot dodge. Hit it now. \| Sapped: Skips its turns. Any damage wakes it, damage over time included. \| Trap: A trap waits under it and springs on its first heavy blow or cast, else on its first turn. \| Empowered: A wind-up landed: it deals more damage for the rest of the fight. \| Staggered: A wind-up was stopped: it deals less damage for the rest of the fight. \| Maimed: A Deathblow landed: the healing you receive is cut for the rest of the fight. Cleansing does not remove it. | draft | **fixed** (N): the fire status is "Ablaze" (Living Flame "sets the target ablaze"); Empowered, Staggered, Braced and Off-balance are four different effects, each with its own chip | ui/ui-text.js |
| FT2 | Wind-up track, heading and tooltip: Wind-up now: stop it with {spell} · Wind-up on another enemy: · Heavy wind-up now: {key} {spell} can stop it · Wind-up now: nothing on your bar can stop it this round · Low health: {potion} · {enemy}'s {ability} this round / in round {n}: about {n} on your {hp} health | draft | **fixed** (R): "stop" for a heavy wind-up; "about" for ≈; "in round 3" | ui/hud.js |
| FT3 | Wind-up tooltip: Wind-up: {enemy}'s strongest move, shown on its track ahead of time. · Heavy: a big hit, shown ahead. Stun or control the enemy on that turn to stop it (it is then off-balance), or let a shield, a dodge or your pet take it. · Cast: interrupt it or control the caster on that turn to stop it; a stopped cast leaves it off-balance. · ★ Signature: its strongest ability, on a set turn. · Opening move: every enemy of its role opens this way. | draft | **fixed** (N, R): one verb, "stop"; Signature and Opening move say what they are | ui/tracks.js |
| FT4 | Wind-up result lines: Deathblow stopped: {enemy}'s {ability} ({how}): −{n} % damage for the rest of the fight. · Deathblow landed: {enemy}'s {ability}. Empowered: +{n} % damage for the rest of the fight. · Wind-up stopped: … · Wind-up landed: … · Maimed: healing −{n} % · {who}: {ability} stopped ({how}) → off-balance! · {who} is off-balance ({why}): hit it now | draft | **fixed** (N): "stopped" in every result line; "missed you" stays only for a dodged blow (a different result) | ui/director.js |
| FT5 | Track tooltip rows: Deathblow R3 · MAIMS if it lands · Estimated damage to you: about {n} · LETHAL: about {n} against your {hp} health. · No answer ready: nothing you have now can stop it. Kill it first, or be ready to take it. · Nothing on your bar stops it: plan your engage round, or kill it first. · {X}: wait (press Pass); it will be staggered. · Silenced: it cannot cast it. Stopped: staggered. · Aimed at your pet: if it hits your pet it lands all the same (empowered, and you are maimed). Send the Pet makes your pet take it on purpose: stopped. | draft | **fixed** (R): text fixed ("Nothing you have now can stop it. Kill it first, or be ready to take it."; the pet line in plain words, Hunter only); the two "nothing stops it" lines no longer show together: the wind-up tooltip adds "Nothing on your bar stops it" only when "Nothing you have now can stop it" is not shown (L2). "R3" is the nameplate chip's short form (pinned by ui-regress); the tooltip says "round 3" | ui/tracks.js |
| FT6 | Engage and action bar: Empty slot {n} · Drag a spell here from the spellbook (P). · Empty item slot 8/9/0 · Drag a potion or flask here from your bags (B). · Off-balance window: lands on {names} for more damage and more crits. · Off-balance window on {names}: target it first (click its nameplate or Tab). · Not enough energy for Gutting Jab: it costs 40, you have 30 · Not enough {mana/focus/energy} for {spell} | draft | **explained** (R): the two lines are alternatives (target on it / not); one shows | ui/hud.js |
| FT7 | Potion slot: {n} health · {n} mana · Costs no turn, half strength (Packed Satchel) · Maimed: restores {n} health now (healing you receive −{n} % for the rest of this fight). · Item slot {key}: {potion}. Low health: drink it | draft | **fixed** (U): "Costs no turn", as H10; the Maimed line shows only when maimed | ui/hud.js |
| FT8 | Autoplay: When on, the game picks each combat action for you (bar order is the priority). You can switch at any time, also mid-fight. · Key: Z · Autoplay will stop the Deathblow/wind-up with {enemy}, then wait a round · Pass: Do nothing this round. Resources still regenerate. · Key: X | draft | **fixed** (R): the priority rule is now only here (removed from the Spellbook, SP39) | ui/hud.js |
| FT9 | Flee: Try to escape. On success you leave the place with no further rewards. · Chance: {n} % · Key: F (press twice) · Flee this fight? ({n} % chance) · again or Confirm to run · or any action to stay · You fail to escape! | draft |  | ui/hud.js, ui/director.js |
| FT10 | Combat log: You use {spell}. · Your {spell} hits/crits {enemy} for {n}. · Your {spell} misses {enemy}. · {Enemy} dodges your {spell}. · {Enemy}'s {ability} hits/crits you for {n}. · {Enemy} winds up {ability}! · {Enemy} uses {ability}. · {n} absorbed · {ability} costs you {n} health. · You suffer {n} from {ability}. · {name} dies. / {name} has fallen. · {source} flares: you return to the fight! · {Enemy} signals for help: one more enemy joins · {Enemy} bolsters {name}: a {n} shield. · The channel begins / resolves. · You interrupt {enemy}: {ability} is cancelled. · Pre-cast: {spell}, no mana. | draft | **fixed** (R): the revive is named "Ember of Return" for both sources; "dies" is an enemy, "has fallen" your pet (two events) | ui/director.js |
| FT11 | Rewards in the log: You gain {n} experience (+{n} rested) · +{n} XP · You receive {n} copper · You receive loot: {item} (waiting in the loot window) · You receive loot: {item} (raised by the Furnace) · Your old {item} is left behind (no room in your bags). | draft | **fixed** (U): the gold and sell lines use moneyText (gold, silver, copper) as the summary does (L5), "You receive 12 s 34 c" and "You sell Trail Rations for 85 c"; "(+N from heat)" now reads "(+N from the Furnace)" | ui/director.js, ui/engine-bridge.js |
| FT12 | Fight header: Fight {n} of {m}: {boss} · Wave {n} of {m} · {n} of {m} waves done · Return to {node} | draft |  | ui/hud.js |
| FT13 | Boss bar: {boss}, phase {n} · {boss} defeated · Final Dark at round {n} · Crush next round! · Linked | draft | **explained** (X): only Oruvath's bar shows these words; a demo dungeon boss shows "{boss}, phase 1" | ui/engine-bridge.js, ui/hud.js |
| FT14 | Resurrect line in the fight HUD: It would kill you; {resurrect} would bring you back. · When you die, it brings you back to the fight at once. · {source} flares: you return to the fight! | draft | **fixed** (N): the HUD names the boon's charge "your Ember of Return"; {resurrect} is filled with the item's name | ui/hud.js |

## SP Spells and talents a demo hero can reach (hero levels 1-7)

Spell text is the spellbook and trainer line. Learn level is the hero level (Legacy scale). Mage costs are shown as mana. Talents: 1 point at hero level 5, 2 at level 6, 4 at level 7 (legacy.md 1.8); tier 2 needs 4 points already spent in the tree, so only the tier 1 rows (two per tree) can be bought in the demo. Higher tiers are in the game but not reachable and are left out of this list. The first point chooses the tree.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| SP1 | Rogue · level 1 · Gutting Jab · 40 energy · A vicious stab. Awards 1 combo point. | draft |  | ui/ui-text.js |
| SP2 | Rogue · level 1 · Severing Flourish · 35 energy · Finisher: spends all your combo points. | draft |  | ui/ui-text.js |
| SP3 | Rogue · level 3 · Shadowstep Strike · 50 energy · Opener. Requires Stealth. Awards 2 combo points. | draft |  | ui/ui-text.js |
| SP4 | Rogue · level 3 · Throat Jab · 20 energy · cooldown 4 · Interrupts a cast and silences the target for 1 round. Never misses and cannot be dodged. | draft |  | ui/ui-text.js |
| SP5 | Rogue · level 5 · Open Vein · 30 energy · Finisher. The target bleeds for 4 rounds; stronger per combo point. | draft |  | ui/ui-text.js |
| SP6 | Rogue · level 6 · Temple Blow · 25 energy · cooldown 5 · Finisher. Stuns for 1 round plus 1 per 2 combo points (max 3). | draft |  | ui/ui-text.js |
| SP7 | Rogue · level 7 · Smoke Veil · 25 energy · cooldown 8 · +45 % dodge for 3 rounds (Evasion). | draft | **fixed** (U): effect first, status in brackets | ui/ui-text.js |
| SP8 | Mage · level 1 · Ember Bolt · 9 % mana · Hurls a bolt of fire at the target. | draft |  | ui/ui-text.js |
| SP9 | Mage · level 1 · Frost Lance · 8 % mana · A shard of ice. Chills the target for 2 rounds (20 % less damage dealt). | draft |  | ui/ui-text.js |
| SP10 | Mage · level 3 · Arcane Ward · 12 % mana · cooldown 5 · A ward absorbs damage for 4 rounds. | draft |  | ui/ui-text.js |
| SP11 | Mage · level 5 · Rime Burst · 12 % mana · cooldown 6 · Frost to all enemies; freezes non-bosses for 1 round. | draft |  | ui/ui-text.js |
| SP12 | Mage · level 6 · Living Flame · 10 % mana · Sets the target ablaze for 5 rounds. | draft |  | ui/ui-text.js |
| SP13 | Mage · level 7 · Spellsnap · 6 % mana · cooldown 5 · Interrupts a cast and silences the target for 2 rounds. Never misses. | draft |  | ui/ui-text.js |
| SP14 | Hunter · level 1 · Keen Shot · 30 focus · A carefully aimed shot. | draft |  | ui/ui-text.js |
| SP15 | Hunter · level 1 · Barbed Arrow · 20 focus · The target bleeds for 4 rounds. | draft |  | ui/ui-text.js |
| SP16 | Hunter · level 3 · Mark Prey · 10 focus · Marked: the target takes 8 % more damage for 6 rounds. | draft |  | ui/ui-text.js |
| SP17 | Hunter · level 3 · Mend Companion · 25 focus · cooldown 3 · Heals your pet, or revives it at 30 %. | draft |  | ui/ui-text.js |
| SP18 | Hunter · level 6 · Muzzle Shot · 20 focus · cooldown 5 · Interrupts a cast and silences the target for 2 rounds. Never misses and cannot be dodged. | draft | **explained** (R): one move per class by design (class flavour); the same words on purpose, so the player sees it is the same kind of move | ui/ui-text.js |
| SP19 | Hunter · level 7 · Snare Trap · 20 focus · cooldown 6 · Stuns a non-boss enemy for 2 rounds. | draft |  | ui/ui-text.js |
| SP20 | Rogue · tree 1, tier 1 · Honed Edges (3 ranks) · +3 % crit chance per rank. | draft |  | ui/ui-text.js |
| SP21 | Rogue · tree 1, tier 1 · Swift Hands (3 ranks) · Gutting Jab costs 3 less energy per rank. | draft |  | ui/ui-text.js |
| SP22 | Rogue · tree 2, tier 1 · Silent Footing (3 ranks) · Openers deal 10 % more damage per rank. | draft |  | ui/ui-text.js |
| SP23 | Rogue · tree 2, tier 1 · Slippery (3 ranks) · +2 % dodge per rank. | draft |  | ui/ui-text.js |
| SP24 | Rogue · tree 3, tier 1 · Toxic Coating (3 ranks) · Your strikes apply Poison (4 rounds, up to 5 stacks). | draft |  | ui/ui-text.js |
| SP25 | Rogue · tree 3, tier 1 · Deep Wounds (3 ranks) · Open Vein deals 9 % more per rank. | draft |  | ui/ui-text.js |
| SP26 | Mage · tree 1, tier 1 · Kindling (3 ranks) · Fire damage +4 % per rank. | draft |  | ui/ui-text.js |
| SP27 | Mage · tree 1, tier 1 · Searing Focus (3 ranks) · Fire spells +2 % crit per rank. | draft |  | ui/ui-text.js |
| SP28 | Mage · tree 2, tier 1 · Biting Cold (3 ranks) · Frost Lance deals 12 % more per rank. | draft |  | ui/ui-text.js |
| SP29 | Mage · tree 2, tier 1 · Hoarfrost Skin (3 ranks) · Max health +3 % per rank. | draft |  | ui/ui-text.js |
| SP30 | Mage · tree 3, tier 1 · Deep Reserves (3 ranks) · Max mana +5 % per rank. | draft |  | ui/ui-text.js |
| SP31 | Mage · tree 3, tier 1 · Arcane Acuity (3 ranks) · Power +3 % per rank. | draft |  | ui/ui-text.js |
| SP32 | Hunter · tree 1, tier 1 · Thick Hide (3 ranks) · Pet max health +11.5 % per rank. | draft |  | ui/ui-text.js |
| SP33 | Hunter · tree 1, tier 1 · Ferocity (3 ranks) · Pet damage +18 % per rank. | draft |  | ui/ui-text.js |
| SP34 | Hunter · tree 2, tier 1 · Steady Aim (3 ranks) · Keen Shot deals 4 % more per rank. | draft |  | ui/ui-text.js |
| SP35 | Hunter · tree 2, tier 1 · Lethal Shots (3 ranks) · +2 % crit per rank. | draft |  | ui/ui-text.js |
| SP36 | Hunter · tree 3, tier 1 · Hardy (3 ranks) · Max health +3 % per rank. | draft |  | ui/ui-text.js |
| SP37 | Hunter · tree 3, tier 1 · Barbed Mastery (3 ranks) · Barbed Arrow deals 20 % more per rank. | draft |  | ui/ui-text.js |
| SP38 | Talent window: Talents unlock at level {first}. · Points come with your level from level {first}. Reset at a trainer. · One point at level {first}, then one every {step} levels. Reset at a trainer. · Unspent points: {n} · Rank {n}/{m} · Requires {n} points in this tree ({m} spent) · Next rank: … | draft | **explained** (R): the rule lines are alternatives (one shows: locked, or the Legacy line, or the classic line) | content/texts.js, ui/windows.js |
| SP39 | Spellbook: Drag onto the action bar (slots 1–7); right-click a bar slot to clear it. · {n} spells known · 7 bar slots · Next at a trainer: {spells} · Rank {n}. A trainer can raise it to rank {n}. · {n} round cooldown · Free · basic attack · Your basic attack. Costs nothing; use it when nothing better is ready. | draft | **fixed** (R): the priority rule removed here (it is in the Autoplay tooltip) | ui/windows.js, ui/tooltip.js |

## IT Items, bags and loot

Item names are plain data (src/content/item-names.js, affix-words.js, uniques.js). A generated name is: [prefix] base name [suffix]; the prefix is the affix word on a rare or epic, the suffix names the stats. Rarity names: junk, common, uncommon, rare, epic.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| IT1 | Zone 1 (Amberfold Downs), armour and jewellery: Head: Hempen Hood, Farmhand's Cap, Boarhide Helm · Chest: Linen Jerkin, Tanner's Coat, Tenant's Vest · Legs: Field Leggings, Wool Breeches, Hedge-Walker Trousers · Hands: Work Gloves, Reaper's Mitts, Thornproof Gauntlets · Feet: Ploughman's Boots, Furrow Treads, Millroad Shoes · Neck: Seed-Bead Necklace, Cord of Wheat, Boundary Charm · Ring: Copper Tally Ring, Straw-Plait Band, Brass Sowing Ring · Trinket: Barleycorn Token, Scarecrow Button, Millstone Chip | draft | **open: owner name** (R): rename proposed on the owner page (Boundary Charm → Hedgestone Charm); not applied, golden hashes as EN15 | content/item-names.js |
| IT2 | Zone 1 (Amberfold Downs), weapons: Agility Harvest Knife, Yew Shortbow, Skinning Blade · Intellect Hazel Wand, Hazel Rod, Elm Switch · Rogue Harvest Knife, Skinning Blade, Hedge Dagger · off-hand: shields Wooden Buckler, Millwheel Buckler, Hedgewood Shield · tomes Lantern Orb, Almanac of the Furrow, Millbrook Tome · quivers Quiver of Rushes, Boarhide Quiver, Strawbound Quiver · Rogue blades Pruning Knife, Sickle Blade, Thresher's Dirk | draft |  | content/item-names.js |
| IT3 | Zone 2 (Greywater Fens), armour and jewellery: Head: Reedweave Cap, Fenwarden's Cowl, Eelskin Hood · Chest: Waxed Fen Coat, Peatstained Jerkin, Marshwalker Tunic · Legs: Waders, Reedcloth Leggings, Bogtrotter Breeches · Hands: Net-Mender Gloves, Silt-Stained Mitts, Eelhide Grips · Feet: Stilt Boots, Marsh Treads, Reedsoles · Neck: Pearl Drop Pendant, Lantern-Fly Charm, Bog-Oak Amulet · Ring: Mist Signet, Fen-Silver Band, Brineglass Ring · Trinket: Fen-Bell Clapper, Glow-Moss Vial, Heron Feather Charm | draft |  | content/item-names.js |
| IT4 | Zone 2 (Greywater Fens), weapons: Agility Gutting Hook, Reedwood Longbow, Fen Cutlass · Intellect Bog-Oak Staff, Reed Rod, Willow Staff · Rogue Gutting Hook, Fen Cutlass, Reedcutter's Knife · off-hand: shields Driftwood Shield, Reedwoven Buckler, Stilt-Plank Shield · tomes Witchlight Orb, Gloam-Bound Tome, Mirewater Codex · quivers Smuggler's Quiver, Eelskin Quiver, Stiltwalker's Quiver · Rogue blades Eel-Bone Knife, Mudlark's Shiv, Stiltwalker's Dirk | draft | **open: owner name** (R): renames proposed on the owner page (Stiltwalker's Quiver → Fowler's Quiver, Stiltwalker's Dirk → Poleman's Dirk); not applied, golden hashes as EN15 | content/item-names.js |
| IT5 | Prefixes: Keen, Honed, Deft (crit) · Runed, Potent, Hallowed (power) · Sturdy, Reinforced, Warded (armour) | draft | **open: owner name** (M): rename proposed on the owner page (Warded → Ironbound); not applied, golden hashes as EN15 | content/affix-words.js |
| IT6 | Suffixes (tiers 2 and 4): of Quick Hands / of the Long Stride · of Lamplight / of the Inkwell · of Deep Roots / of the Long Winter · of the Drover / of Hard Roads · of Still Water / of the Calm Hand · of the Watchfire / of Thick Walls · of Quiet Hours / of the Hermit · of the Outrider / of Open Country · of Old Lore / of the Hedge-Seer | draft | **explained** (U): suffixes are flavour; the stat lines under the name say what the item does; no change | content/affix-words.js |
| IT7 | Heartseeker, the Last Bowshot (unique weapon, hunter) · A longbow strung with a drake's sinew, said never to miss twice. · Equip: your hits sometimes release a burst of magic damage. | draft | **explained** (X): cannot drop: the engine draws uniques only as Cache rares and Relics epics (engine/items.js uniqueFor); class weapons have no drop source | content/uniques.js |
| IT8 | Starfall Staff (unique weapon, mage) · A staff of black glass that blazes against the great and the proud. · Equip: more damage against elites and bosses. | draft | **explained** (X): as IT7 | content/uniques.js |
| IT9 | Whisperfang, Veil-Cutter (unique weapon, rogue) · A thin blade that sings only when drawn in shadow. · Equip: your hits sometimes release a burst of magic damage. | draft | **explained** (X): as IT7 | content/uniques.js |
| IT10 | Harrowbane Greaves (unique epic, zone 1) · Taken from a deserter's corpse, they seem to renew with each kill. · Equip: heal a little each time you kill an enemy. | draft | **explained** (X): cannot show in the demo (Relics not in the demo hall); no change | content/uniques.js |
| IT11 | Boundarystone Charm (unique rare, zone 1) · A pebble from the first field wall. Each victory warms it. · Equip: heal a little each time you kill an enemy. | draft | **explained** (X): cannot show in the demo (Cache not in the demo hall); no change | content/uniques.js |
| IT12 | Mistwalker's Hood (unique epic, zone 2) · Fog clings to this hood and shrugs off the first blow. · Equip: begin each fight behind a small ward. | draft | **explained** (X): as IT10 | content/uniques.js |
| IT13 | Reedlight Lantern (unique rare, zone 2) · A fen lamp that steeps every draught in swamp-warmth. · Equip: potions heal more. | draft | **explained** (X): as IT11 | content/uniques.js |
| IT14 | Healing Draught · Restores 35 % of your maximum health. Shares a 4-round cooldown with other draughts. | draft |  | ui/mock-data.js |
| IT15 | Mana Draught · Restores 35 % of your maximum mana. Shares a 4-round cooldown with other draughts. | draft |  | ui/mock-data.js |
| IT16 | Trail Rations · Out of combat: restores 40 % of health, mana and pet health. | draft |  | ui/mock-data.js |
| IT17 | Purifying Tonic · Removes every debuff on you. | draft | **fixed** (U): true in both builds; Maimed is not a debuff (engine dispersal), so "every debuff" is exact | ui/mock-data.js |
| IT18 | Spark Flask · Throw it: magic damage to every enemy. | draft |  | ui/mock-data.js |
| IT19 | Elixir of Ferocity · +10 % damage for the next 3 places. | draft | **fixed** (M, R2-6): "places", one word for a map location (N27), as in the Dimming lines (D150 item 13) | ui/mock-data.js |
| IT20 | Ember of Return · Carried: when you die, you return at once with 40 % health. One at a time. | approved D150 item 13 (name) |  | ui/mock-data.js |
| IT21 | Item tooltip: {Slot} · Item level {n} · {n} Armor · +{n} {Stamina/Agility/Intellect/Spirit/Power/Critical strike/Weapon damage} · ▲ Upgrade (+{n} overall) · ▼ Weaker than {item} ({n}) · As good overall as what you wear · ▲ Empty slot: an upgrade · Not an upgrade: {stat} is the {class}'s main stat · Right-click to equip · click for options · Right-click to use · drag to the item bar · Sells for: {price} · Stack: {n} / {m} | approved D150 item 12 (item level word) | **fixed** (U): "overall" in place of "item score"; Spirit and Weapon damage are full stat names (D150) | ui/tooltip.js, ui/windows.js |
| IT22 | Loot window: Take all · Continue · Waiting in the loot window: equip, take or drop it · Click or Equip now: put it on · Leave {n} item(s) behind? Click Leave again. · left behind · Click to choose this reward · Equip now: choose it and put it on · {giver} says: · “{done line}” · Quest complete: {title} · Contract complete: {title} · Story complete: {title} | draft | **fixed** (R): "Zone story complete"; Leave twice is the button and its confirmation | ui/screens.js |
| IT23 | Bags full: Your bags are full: equip, sell or discard something (B). · Bags {n}/{m} · {n} / {m} slots | draft |  | ui/ui-text.js |
| IT24 | Vendor and junk lines: Wandering merchant · Sells for: {price} · junk items are sold together: You sell {n} junk items for {n} copper. | draft |  | ui/director.js |

## LV Level-up banner and hero lines

Economy v2 texts (content texts.economy, draft; D150 item 22 approved "Next spell at level {n}."). The banner shows the hero level.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| LV1 | Level {level} | draft |  | content/texts.js |
| LV2 | Level {level} (+{n}) | draft |  | content/texts.js |
| LV3 | Health {from} → {to} | draft |  | content/texts.js |
| LV4 | Mana {from} → {to} | draft |  | content/texts.js |
| LV5 | New spell: {spell}. Learn it at a trainer. | draft |  | content/texts.js |
| LV6 | Better ranks for {n} spells at a trainer. | draft |  | content/texts.js |
| LV7 | Talent point to spend ({key_talents}). | draft |  | content/texts.js |
| LV8 | level_legacy: +{legacy} Legacy points when this run ends, to spend in the Legacy hall. | draft | **fixed** (U): says where they go | content/texts.js |
| LV9 | Level {from} → {to} | draft |  | content/texts.js |
| LV10 | Level 20: your other talent trees can open in the Legacy hall. | draft | **explained** (X): cannot occur under the demo cap (spec 4.1); no change | content/texts.js |
| LV11 | Level 25, the highest. From now on every {xp} XP pays {legacy} Legacy points. | draft | **explained** (X): cannot occur under the demo cap (spec 4.1); no change | content/texts.js |
| LV12 | You have reached level {n}! · New at the trainer: {spells} · +1 talent point / +{n} talent points · Welcome to {zone}. Visit the trainer, then set out. · You arrive in {zone}. | draft | **explained** (R): the log keeps a record of what the banner shows for a moment; two places by design | ui/director.js |
| LV13 | HUD bar: Level {n} · {xp} / {next} XP ({p} %) · Rested: {n} (kills give double XP) · Level {n} · maximum level | draft | **explained** (X): D.3: a capped demo hero shows "Level 7: the demo's highest"; "maximum level" is the full game's | ui/hud.js |
| LV14 | Hero rest lines: You rest: health restored. (a Mage: health and mana restored.) · You rest by the fire until the ache leaves your bones. · {n} XP: kills give double experience | draft | **fixed** (R, R2-6): the log line without "rested"; "mana" only for a Mage | ui/director.js, ui/screens.js |

## SU Run summary (every run end)

The screen after a run: "The run has ended" (death or Abandon, or the demo exit). Rows below are from buildSummary. Under Legacy, "Echoes" shows as "Legacy points".

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| SU1 | The run has ended · {Name} has fallen / Your {class} has fallen / {Name} left the run · {Name} · level {n} {Class} with {pet} · {zone} | draft | **explained** (X): D.3: outcome demo shows "End of the demo" and the demo block; death and Abandon keep this heading | ui/screens.js |
| SU2 | The journey: Reached · Hero · Level {a} → {b} · +{n} XP · {n} / {m} XP to level {n} · Time · Fights {n} ({n} rounds) · Oruvath · Base strength: no tolls overspent · Play time · about {n} min by hand, {m} with autoplay · Seed | draft | **explained** (X): D.3: a demo run's summary has no Seed, Play time or Oruvath row | ui/screens.js |
| SU3 | Death rows: Killed by · {enemy} ({ability}) · Where · {node}, round {n} · Ended · Abandoned from the menu | draft |  | ui/screens.js |
| SU4 | Deeds: … Potions used · Returned to the fight · Damage … | draft | **fixed** (N): names the event as the log does | ui/screens.js |
| SU5 | Legacy lines (card heading "Echoes earned"): The Bellwrights' welcome · {n} hero level(s) gained · Zones completed · Dungeons cleared · Elites slain · Rares slain · Quests completed · Fights won Burning or Infernal · Contracts completed · Total · {n} Echoes · Your Echoes after this run | draft | **fixed** (U, R2-6): the welcome line reads "First-run welcome"; the levels line is the number in words ("1 hero level gained"), because the figure beside it is Legacy points | ui/screens.js, ui/ui-text.js |
| SU6 | Kept: level {level} (was {was}) · spells and ranks · talents · Legacy unlocks | draft |  | content/texts.js |
| SU7 | Left behind: gear, gold, potions and camp points. Your next run starts with new gear for your level. | draft | **fixed** (N): no new name | content/texts.js |
| SU8 | You have {legacy} Legacy points. Next in the hall: {next}, {cost}. | draft |  | content/texts.js |
| SU9 | You have {n} Legacy points. Every entry in the hall is yours. (demo: You own every unlock in the demo.) · {N} unlock(s) within reach. · Keep them for the next run. | draft | **fixed** (R): the reach line no longer repeats the card heading; D.3 shows "You own every unlock in the demo." in the demo | ui/screens.js |
| SU10 | Summary buttons: Begin a new run (tooltip: Back to class select, where the Legacy hall is too. Your Legacy points are kept.) · Spend Legacy points (tooltip: Legacy hall · Spend the Legacy points of this run and the runs before on lasting unlocks. · …) · demo-end: Next run · Legacy hall | draft | **fixed** (R): "Echoes" (shown as Legacy points) twice in the tooltip, not three times; D.3 shows "Next run" and "Legacy hall" on the demo-end screen | ui/screens.js |
| SU11 | Nudge, first summary: Your first unlock is ready: Packed Satchel. | draft |  | content/tutorial.js |
| SU12 | Furnace card on the summary (see FU11). | draft |  | ui/heat.js |

## HL Legacy hall (the demo hall of seven entries)

The hall opens from hero select and from the summary. In the demo it lists exactly seven entries at rank I (demo spec 3.2, prices from hall v3d, D167, draft). The card line is the "short" text, the tooltip the "long" text, from ui-text.js metaEffect.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| HL1 | Packed Satchel · 50 Legacy points · Start with 3 Healing Draughts; first potion each fight costs no turn, at half strength · Every run begins with three Healing Draughts in your bags, and the first potion you drink in each fight costs no turn at half strength (part 2: "costs no turn" as H10, in place of "free"). | draft |  | ui/ui-text.js |
| HL2 | Vigor of the Line I · 70 Legacy points · +3 % max health, then +1 % · Every hero starts with 3 % more maximum health with rank I and 1 % more with rank II (4 % in all). | draft | **fixed** (X): the demo hall entry has one rank, so the card reads "+3 % max health" and the tooltip "Every hero starts with 3 % more maximum health." (L3); the full game keeps its rank wording | ui/ui-text.js |
| HL3 | Edge of the Line I · 70 Legacy points · +2 % Power, then +1 % · Every hero has 2 % more Power with rank I and 1 % more with rank II (3 % in all): more damage from every attack and spell. | draft | **fixed** (X): one rank: "+2 % Power" and "Every hero has 2 % more Power: more damage from every attack and spell." (L3) | ui/ui-text.js |
| HL4 | Quick Study I · 80 Legacy points · +5 % experience per rank · Every hero earns 5 % more experience for each rank: levels come sooner. | draft | **fixed** (X): one rank: "+5 % experience" and "Every hero earns 5 % more experience: levels come sooner." (L3) | ui/ui-text.js |
| HL5 | Deeper Pockets · 50 Legacy points · +8 bag slots per rank · Your bags hold 8 more items for each rank. | draft | **fixed** (X): one rank: "+8 bag slots" and "Your bags hold 8 more items." (L3) | ui/ui-text.js |
| HL6 | Cartographer · 60 Legacy points · Free Region Charts every run · Every run starts with Region Charts: each zone map shows every place's region and where the dungeon is. | draft |  | ui/ui-text.js |
| HL7 | Quartermaster I · 70 Legacy points · +2 camp points per rank · On the expedition map you have two more camp points to spend at the start camp for each rank. | draft | **fixed** (X): one rank: "+2 camp points" and "On the expedition map you have two more camp points to spend at the start camp." (L3) | ui/ui-text.js |
| HL8 | Hall header and lines: Legacy hall · Legacy points from every run buy lasting unlocks. Each applies from the start of your next run. · Earned {n} · spent {n} · {N} unlock(s) within reach · {n} of {m} rank(s) owned · Your next run: {text} · Nothing yet. Every unlock you buy shows here, and applies from the first step of the run. · Needs {req} · You need {n} more Legacy points. · Next rank: {text} · ✓/✗ Requires: {req} · Owned. · From hero level {n} | draft | **explained** (U): the count is plural-aware ("1 of 1 rank owned"); the wing and its "From hero level" lines are hidden in the demo (D.3) | ui/meta.js |
| HL9 | Hall balance tooltip: Every run earns Legacy points for what it did: levels, zones, dungeons, elites, quests and more. They buy lasting unlocks here. | draft | **fixed** (X): true in both builds, no boss named | ui/meta.js |
| HL10 | Hall history: {n} run(s) ended, {n} with Oruvath defeated. · Every run earns Echoes. The first victory with each class adds +{n} Echoes. · First-kill bonus ✓ · {n} runs · best level {n} · The first {class} to defeat Oruvath earns +{n} Echoes. · First-kill bonus claimed (+{n} Echoes). | draft | **explained** (X): D.3: the demo hall's run log has no Oruvath or first-kill lines ("{n} runs ended."; "Every run earns Legacy points.") | ui/meta.js |
| HL11 | After a buy: +{n} Echoes from {hero}'s run · Now open: {names}. · Next run: {text}. · Swear them on class select. | draft | **explained** (X): the Oaths line cannot show in the demo (no Oaths in the demo hall) | ui/meta.js |
| HL12 | Vendor/hall nudge: Buy Packed Satchel: {n} potions every run, and your first potion each fight costs no turn. | draft | **fixed** (R): adds "at half strength" (GR78); the nudge and the hall card are on different screens | content/tutorial.js |
| HL13 | Hall refusal for an entry not in the demo: not in the demo | draft (built in D.3) |  | docs/specs/demo.md 3.2 |
| HL14 | Next in the hall (demo, all owned): You own every unlock in the demo. | draft (built in D.3) |  | docs/specs/demo.md 3.2 |

## ST Menu and settings

The window "Menu and settings". The Dev tools row, the Classic map setting and the mode chip are not built in a demo (demo spec 2.3).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| ST1 | Abandon run · Ends this run where your hero stands, as a death. · Abandon: click again · End the run here? You keep your level, XP and spells; gear, gold and camp points are lost. Legacy points count only what you did. Click again to end it. | draft | **fixed** (R): the note says what Abandon does; the confirmation says what is kept and lost | ui/windows.js, content/texts.js |
| ST2 | Animation speed · Space or a click skips to the end of the hit on screen. A key pressed while a round plays becomes your next action. · 1× 2× 4× Instant | draft | **fixed** (U): no "queued" | ui/windows.js |
| ST3 | Speedrun mode · Instant animations, no travel scenes, fast autoplay. · Skip travel scenes · Autoplay pace · Pause between autoplay rounds. · Calm Normal Quick Rush | draft | **explained** (R): two settings: Speedrun mode lists what it switches on; Skip travel scenes is the one switch on its own | ui/windows.js |
| ST4 | Screen shake · Reduce motion · No screen shake, smaller recoil, numbers without the slam. · Combat log | draft | **explained** (R): Reduce motion also turns shake off, so its line says so; Screen shake is the one switch on its own | ui/windows.js |
| ST5 | Hints · One short line the first time you meet something new. · On / Off · First-time hints and the guide · Reset hints · Play the guide again · Every first-time hint shows again. · This run is the guided run. · Your next run is the guided run. | draft |  | ui/windows.js |
| ST6 | Mute sound · Sound starts with your first click or key. Everything it tells you is also on screen. · Volume · Master {n} % · Effects {n} % · Interface {n} % | draft |  | ui/windows.js |
| ST7 | Keys: 1–7 Spells · 8 9 0 Items · A Basic attack · Tab Next target · Z Autoplay · F F Flee · X Pass · Space Skip a hit / take loot · C B P Character, bags, spells · N L M Talents, quests, map | draft | **fixed** (U): the level-up banner wrote "Talent point to spend (T)." but the Talents key is N (app.js); director.js now passes N. The Settings keys list matches the hint keys (onboarding.js KEYS) | ui/windows.js |
| ST8 | Footer: Engine: {engine} · build {build} | draft | **fixed** (X): developer text: the "Engine: … · build …" footer is not shown in the demo (L4) | ui/windows.js |
| ST9 | Window titles and tabs: Menu and settings · Character · Bags · Spellbook · Talents · Quest log · Map · Vendor · Trainer · Loot | draft |  | ui/windows.js |
| ST10 | Start over · Start over? Your heroes and Legacy unlocks are deleted. | draft (built in D.3) |  | docs/specs/demo.md 2.4 |
| ST11 | This browser window cannot save your progress. | draft (built in D.3) |  | docs/specs/demo.md 2.4 |

## DM Lines the demo adds (built in D.3)

From docs/specs/demo.md 1.3, 1.4, 2.4, 3.1, 3.2. Every line is a draft for the owner. The demo-end screen may hold at most 80 words beyond the summary lines (DEMO_END_MAX_WORDS).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| DM1 | Heading: End of the demo | draft (built in D.3) |  | docs/specs/demo.md 1.4 |
| DM2 | You made it through Amberfold Downs and Greywater Fens. | draft (built in D.3) |  | docs/specs/demo.md 1.4 |
| DM3 | So far: Runs so far: 4 · Vex, Rogue, level 5 · Maren, Hunter, level 3 · Legacy hall: 3 of 7 unlocks owned | draft (built in D.3) | **fixed** (U): "so far" and "owned" say what the numbers are | docs/specs/demo.md 1.4 |
| DM4 | Kept: level 5 (was 4) · spells and ranks · talents · Legacy unlocks · Left behind: gear, gold, potions and camp points. Your next run starts with new gear for your level. | draft (built in D.3) | **fixed** (U): the content line without the Wayfarer's kit (SU7) | docs/specs/demo.md 1.4 |
| DM5 | At the cap only: Vex has reached level 7, the demo's highest. (shortened in part 2) | draft (built in D.3) |  | docs/specs/demo.md 1.4 |
| DM6 | The full game goes on past Greywater Fens: four more zones and a final boss. | draft (built in D.3) | **fixed** (U): no Camp, no boss name; the count comes from the content | docs/specs/demo.md 1.4 |
| DM7 | Buttons: Next run · Legacy hall | draft (built in D.3) |  | docs/specs/demo.md 1.4 |
| DM8 | Word count of the demo block: typical 47 words, longest 59 (limit 80, block only); with the summary's Kept and Left behind lines 76 typical, 88 longest | draft (built in D.3) | **fixed** (B): the demo block (spec 1.4: the lines beyond the summary) is 47 words in a typical case and 59 at its longest (three heroes with 16-letter names and the cap line), within the 80 of DEMO_END_MAX_WORDS (qa/ui/demo checks the longest case). With the summary's own Kept and Left behind lines (29 words) it is 76 typical and 88 at the longest; the spec counts only the block | docs/specs/demo.md 1.4 |
| DM9 | Zone 2 leave line: Leaving Greywater Fens ends this demo run. You keep your levels and Legacy points. | draft (built in D.3) | **explained** (X): D.3: built as one line in the zone 2 dialog and tooltips; the dialog drops the zone 3 hub and "No way back" there (MP22) | docs/specs/demo.md 1.3 |
| DM10 | Level 7: the demo's highest (XP bar of a capped hero, hero select and HUD; the banner to level 7 adds it once) | draft (built in D.3) |  | docs/specs/demo.md 3.1 |
| DM11 | Contract board bands from run 3: zones 1-2 only (no text change) | draft (built in D.3) |  | docs/specs/demo.md 4.3 |
| DM12 | Road tooltip in zone 2 (and the leave confirmation) carry the line of 1.3; node chips do not | draft (built in D.3) |  | docs/specs/demo.md 4.3 |
| DM13 | Zone 2 Road sign on the map: End of the demo (D176: in place of the zone 3 hub) | draft (built in D.3) |  | ui/demo.js DEMO_TEXT.roadSign |
| DM14 | Settings: Start over · Deletes your heroes and Legacy unlocks and starts the demo from the beginning. · Start over: click again · Start over? Your heroes and Legacy unlocks are deleted. | draft (built in D.3) |  | ui/demo.js DEMO_TEXT |
| DM15 | Hero select heading in the demo: Your hero keeps its level from run to run, up to level 7 in the demo. (HS3's demo line) | draft (built in D.3) |  | ui/demo.js DEMO_TEXT.heroIntro |

## R2 Blind round 2: smaller items (R2-6, draft)

Lines added or changed for the second blind demo round, item R2-6 (docs/handoffs/ui-2026-11-26e.md). Every line is a draft for the owner. They show in the full game and the demo alike, unless the Flag says otherwise. The rows above that changed in the same pass carry "R2-6" in their Flag cell (the one word "place" for a map location is N27 of this review).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| R2-1 | Zone level line (Legacy runs only; hub header, zone map header, minimap tooltip): The zone matches your level, so its levels change from run to run. | draft |  | ui/ui-text.js ZONE_MATCH_LINE |
| R2-2 | Trainer place on the zone map with nothing to teach (tooltip line, the place is dimmed before the click): Nothing to train yet. Next spell at level {n}. / Nothing new to learn. | draft | **fixed** (R2-6): the hub row greys out the same way | ui/screens.js idleTrainerLine |
| R2-3 | Enemy list of a place: {name} (level {n}) · 2 × {name} (level {n}) | draft | **fixed** (R2-6): was "2 Name", which read as a count | ui/screens.js foeList |
| R2-4 | Item comparison: ▲ Upgrade (+{n} score) · ▼ Weaker than {item} ({n} score) · Score adds up the item's stats, weighted for your class. Higher is better. · reward card: ▲ Upgrade (+{n} score) | draft | **fixed** (R2-6): the number has a unit and a tooltip line that says what it is | ui/tooltip.js, ui/screens.js |
| R2-5 | Run summary, Legacy points card: 1 hero level gained · 2 hero levels gained (the figure beside it is Legacy points) | draft | **fixed** (R2-6): was "Hero levels gained +20", read as twenty levels | ui/ui-text.js heroLevelsLine |
| R2-6 | Zone map, Regions panel: Your Region Charts show every region and the dungeon. (only when the Charts are owned) | draft | **fixed** (R2-6): says what the Region Charts do on the map; without them the panel has no line (the first map's word budget, ui-regress part T) | ui/screens.js |
| R2-7 | Contracts heading at the start camp: You can hold up to {four} at a time. Each gives its reward when its task is done. (see SC6) | draft | **fixed** (R2-6): the number is the tracker's slot count | ui/prep.js |
| R2-8 | Legacy hall badge and button tooltip: {n} unlocks within reach | draft | **fixed** (R2-6): the count is what the balance buys together, cheapest first, not each entry on its own | ui/ui-text.js reachCount |

## Method and limits

- Built by reading src, not by playing the build: content tables are loaded from src/content, UI strings are copied from src/ui. A line that is built from several strings (a tooltip) is one row. The wording of a screen may differ slightly where the UI joins pieces at run time.
- Spells and talents are listed for hero levels 1 to 7 on the Legacy scale (R.learnLevel). Talent tiers above 1 need four points already spent in the tree, so they cannot be bought by level 7 and are left out.
- Left out: lines of zones 3 to 6, the Camp and Oruvath, the Dev menu, the mock engine, the classic map, Oaths, Lost Techniques and the level-20 wing (none of them can show in the demo).
- Numbers: the hero cap 7 (kept by D177) and the hall prices are the numbers of the demo spec; the engine holds them as constants (HERO_MAX_DEMO, DEMO_HALL, D.3), and the UI shows the demo lines since D.3 (40e675d). The hall prices are hall v3d (D167, draft).
- Part 2 (2026-11-25): changed in src/content (tutorial.js, texts.js, quests.js, enemies.js flavour) and the src/ui string tables only; no rule or logic changed. Lines that needed logic are L1-L6 in docs/handoffs/content-2026-11-25.md; built in docs/handoffs/ui-2026-11-26.md.
- The demo spec asks for a blind panel (D.7) and owner sign-off (D.8); this list is the input to D.5, not its result.
