# Demo text review: the owner's list (draft)

Status: **draft for the owner**. Task MD D.5, part 1. Author: Content Designer, 2026-11-25. Source commit: origin/main c53d04d (the demo spec is docs/specs/demo.md; nothing demo-specific is built yet).

This is every player-facing line, name and number a demo player can see, grouped by screen. Mark each row **approve**, **change** (with the new text) or **cut**. Every name, text and number the owner has not approved is a draft.

## Counts

| | Rows |
|---|---|
| Total rows | **438** |
| Approved earlier (decision named in the Status column) | 24 |
| Draft | **414** |
| of which "to come" (the demo spec adds them; not built) | 19 |
| Flagged (any flag below) | **137** |
| Flag R, repetition | 40 |
| Flag M, machine-sounding | 11 |
| Flag U, unclear | 43 |
| Flag N, naming: breaks the one-word rule of D150 | 12 |
| Flag B, wrong or broken in the demo | 2 |
| Flag X, does not fit the demo (a full-game line the demo player cannot use or reach) | 45 |

A row is one line, or one tight group of lines on one screen (a tooltip, a dialog, a list of names). A row can carry several flags. Counts are computed from the rows below.

## How to read

- **Text** is the exact current text from src (src/content/*.js, src/ui/ui-text.js and the other src/ui files), copied from the source. `{n}`, `{name}` and the like are filled in on screen. `·` separates lines of one card or tooltip. Where the source says "Echoes", a Legacy run shows "Legacy points" and "Hall of Echoes" shows "Legacy hall" (word swap in src/ui/util.js); the rows quote the source.
- **Status:** `approved <id>` = the owner approved the line, or the wording of a cut-list item, with that decision (D7, D150 and its item number). `draft` = not approved. `to come` = the demo spec adds the line; it is not in src yet; it is a draft too.
- **Flag** = the line breaks the text rules of D150 or does not fit the demo. R repetition (the same thing said twice, or one word more than once in a line), M machine-sounding (a label, a formula or a code word), U unclear (a player cannot tell what it means), N naming (two words for one mechanic, or a word D150 retired), B wrong or untrue in the demo, X not for the demo (a full-game line, or a line the demo spec changes). The note says why.
- **Source** names the file the line is read from. Rows marked with several files are tooltips built from several strings.
- Lore terms (Bellwrights, Wayfarer, the zone, hub, road and region names) come from an inherited, agent-written strawman (docs/lore/world.md) and are draft. Furnace names are "team (owner review: names)" in D68, so draft.

## The 10 lines that most need the owner's eye

Chosen by how early and how often the player meets the line, and how plainly it is wrong for a demo.

| # | Row | Why |
|---|---|---|
| 1 | HS3 | First screen says "1 to 25" and "Six zones, then Oruvath." The demo stops at level 7 and zone 2. The demo spec does not change this line. |
| 2 | SC6 | Start camp: "One per zone. Each gives its reward when its last site is won." The demo board has three slots over two zones, and "site" is not defined. |
| 3 | GR36 | First-fight hint H09: "It uses your turn." The Packed Satchel, which the demo pushes in run 1, makes the first potion free. The hint becomes untrue. |
| 4 | FT3 | Every fight: stop, cancel, interrupt, control and answer all name one thing in the wind-up tooltips (D150 fixed "stopped"). FT4 adds "cancelled" and "missed". |
| 5 | GR43 | Furnace hints and tooltip (H16, H17, FU4) warn that "the final boss gets stronger". No demo run meets him (demo spec question Q1). |
| 6 | MP29 | The revive has three names: "Boon of Return" (shrine), "resurrect charge" (its tooltip) and "Ember of Return" (D150). FT14 adds "a resurrect". |
| 7 | HS21 | Stormhawk card: "Unlock it with Stormhawk in the Legacy hall." The demo hall does not sell it, so the line sends a Hunter to a dead end. |
| 8 | HL2 | Hall: Vigor and Edge tooltips name rank II, which the demo does not sell. HL9 and HL10 mention Oruvath, the first-kill bonus and "0 with Oruvath defeated". |
| 9 | MP22 | Zone 2 leave dialog says "the hub of Highcairn Reach" and "No way back to Greywater Fens". The new demo line (DM9) has to replace them. |
| 10 | DM6 | Demo-end screen: "the Camp and Oruvath" are new words on the last screen. DM8: the block is 86 words with the Wayfarer sentence, 78 without; the limit is 80. |

Also open: the names the owner has not yet approved (the Furnace and its four states FU2, Bellwrights MP20/SU5, the Wayfarer's kit SU7, the zone, hub and region names in WD, Hobb Tollwright EN31).

## Contents

| Section | Screen | Rows | Draft | To come | Flagged |
|---|---|---|---|---|---|
| [NUM](#num-numbers-the-owner-should-see) | Numbers the owner should see | 14 | 14 | 2 | 2 |
| [HS](#hs-hero-select-class-select) | Hero select (class select) | 23 | 20 | 1 | 6 |
| [SC](#sc-start-camp) | Start camp | 26 | 25 | 0 | 5 |
| [GR](#gr-the-guided-first-run-coach-lines-hints-and-guide-lines) | The guided first run: coach lines, hints and guide lines | 82 | 73 | 0 | 17 |
| [WD](#wd-world-zones-1-2-hubs-roads-regions-dungeons) | World: zones 1-2, hubs, roads, regions, dungeons | 23 | 23 | 0 | 6 |
| [MP](#mp-zone-map-nodes-and-dialogs) | Zone map, nodes and dialogs | 30 | 27 | 0 | 14 |
| [FU](#fu-the-furnace-heat-bar-and-the-dimming-meter) | The Furnace (heat bar) and the Dimming meter | 13 | 10 | 0 | 7 |
| [HB](#hb-hub-trainer-vendor-inn) | Hub, trainer, vendor, inn | 9 | 7 | 0 | 1 |
| [QU](#qu-quests-zones-1-2) | Quests (zones 1-2) | 24 | 24 | 0 | 3 |
| [CT](#ct-contracts) | Contracts | 18 | 18 | 0 | 5 |
| [EN](#en-enemies-of-zones-1-2) | Enemies of zones 1-2 | 36 | 35 | 0 | 6 |
| [FT](#ft-the-fight-bars-tracks-wind-ups-and-the-log) | The fight: bars, tracks, wind-ups and the log | 14 | 14 | 0 | 12 |
| [SP](#sp-spells-and-talents-a-demo-hero-can-reach-hero-levels-1-7) | Spells and talents a demo hero can reach (hero levels 1-7) | 39 | 39 | 0 | 4 |
| [IT](#it-items-bags-and-loot) | Items, bags and loot | 24 | 22 | 0 | 15 |
| [LV](#lv-level-up-banner-and-hero-lines) | Level-up banner and hero lines | 14 | 14 | 0 | 6 |
| [SU](#su-run-summary-every-run-end) | Run summary (every run end) | 12 | 12 | 0 | 7 |
| [HL](#hl-legacy-hall-the-demo-hall-of-seven-entries) | Legacy hall (the demo hall of seven entries) | 14 | 14 | 2 | 10 |
| [ST](#st-menu-and-settings) | Menu and settings | 11 | 11 | 2 | 6 |
| [DM](#dm-lines-the-demo-adds-not-built-yet-to-come) | Lines the demo adds (not built yet: "to come") | 12 | 12 | 12 | 5 |

## Approved lines

The owner approved: the three classes (D7); D150 cut-list items 1 to 25 and the naming rule ("Go"); every line equal to a "Proposed" wording of that list carries its item number. Everything else, including every Legacy and Economy v2 line (D154-D173) and the hall prices (D167), is draft.

HS4 (D7) · HS5 (D7) · HS6 (D7) · SC12 (D150 item 15) · GR4 (D150 item 18) · GR5 (D150 item 12) · GR7 (D150 item 11) · GR15 (D150 item 13) · GR16 (D150 item 13) · GR27 (D150 item 11) · GR38 (D150 item 18) · GR43 (D150 item 12) · GR45 (D150 item 13) · MP7 (D150 item 23 (Deathblow line)) · MP12 (D150 item 6) · MP13 (D150 item 23) · FU1 (D150 item 1) · FU4 (D150 item 5) · FU5 (D150 item 5) · HB2 (D150 item 22 (Next spell at level {n}.)) · HB7 (D150 item 21 (subtitle)) · EN36 (D150 item 23 (Deathblow line)) · IT20 (D150 item 13 (name)) · IT21 (D150 item 12 (item level word))

## NUM Numbers the owner should see

Values a demo player meets or that shape what he meets. "Value" is what the code holds today. Status is draft unless a decision records the owner approving the number.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| NUM1 | Hero level cap in the demo: 7 (HERO_MAX_DEMO) | to come | X: demo spec 3.1 (inference, to be measured in DM1); the full game stops at 25 | docs/specs/demo.md 3.1 |
| NUM2 | Hero XP to the next level, levels 1 to 7 (Economy v2): 1 800, 1 850, 1 900, 2 100, 2 150, 2 250; cumulative 1 800 / 3 650 / 5 550 / 7 650 / 9 800 / 12 050 | draft |  | constants.js HERO_XP_ECON2 |
| NUM3 | Hero level to engine power level (what zones scale to): hero 1-7 = power 1, 3, 6, 8, 11, 13, 16 | draft |  | constants.js POWER_OF_LEVEL |
| NUM4 | Spells known by hero 7: Rogue Gutting Jab, Severing Flourish (1), Shadowstep Strike, Throat Jab (3), Open Vein (5), Temple Blow (6), Smoke Veil (7); Mage Ember Bolt, Frost Lance (1), Arcane Ward (3), Rime Burst (5), Living Flame (6), Spellsnap (7); Hunter Keen Shot, Barbed Arrow (1), Mark Prey, Mend Companion (3), Muzzle Shot (6), Snare Trap (7) | draft |  | rules.js learnLevel |
| NUM5 | Talent points: 1 at hero level 5, 4 by level 7 | draft |  | docs/specs/demo.md 3.1 |
| NUM6 | Legacy hall in the demo: seven entries, rank I only, 450 in all: Packed Satchel 50, Vigor of the Line 70, Edge of the Line 70, Quick Study 80, Deeper Pockets 50, Cartographer 60, Quartermaster 70 (hall v3d, D167: "numbers draft until the owner approves") | to come |  | docs/specs/demo.md 3.2 |
| NUM7 | Hall effects, rank I: Packed Satchel 3 potions each run and the first potion each fight costs no turn at half strength; Vigor +3 % max health; Edge +2 % Power; Quick Study +5 % experience; Deeper Pockets +8 bag slots; Cartographer free Region Charts every run; Quartermaster +2 camp points | draft |  | constants.js META_HERO |
| NUM8 | Earned by a player to the cap: about 380 Legacy points (planner estimate), so one or two entries stay unbought | draft |  | docs/specs/demo.md 3.1 |
| NUM9 | Legacy points paid per run: welcome 60 (once per profile), 20 per hero level gained, 10 per zone left, 8 per dungeon, 6 per rare, 3 per elite, 1 per quest, 1 per fight won while Burning or Infernal, 0 per unspent camp point | draft |  | constants.js LEGACY_* |
| NUM10 | Camp points: 10 at a normal camp, 5 on the first run; Field Draughts 1, Ember of Return 4, Region Charts 1, Tracker's Notes 2; 3 contract slots | draft |  | constants.js PREP_* |
| NUM11 | The Furnace: Calm to 0 tolls overspent, Smouldering up to 10, Burning 10 to 30, Infernal 30 or more; Burning gives +35 % XP and gold and 1 in 2 drops a rarity up, Infernal +50 % and 7 in 10 | draft | X: it warns that the final boss gets stronger and no demo run meets him (demo spec question Q1) | constants.js HEAT_* |
| NUM12 | The Dimming: starts to spread after 6 tolls in a zone, takes at most 2 places per toll, its front moves every 4 tolls; a guided rescue costs 2 tolls (3 rescues end the guide) | draft |  | constants.js DIM_*, ONB_RESCUE_* |
| NUM13 | Zone damage factor on top of zone danger: zone 1 +25 %, zone 2 +30 % (the banner line "Enemies here deal up to +N % damage") | draft |  | constants.js ZONE_TIER_DMG |
| NUM14 | Homeward Bell: 1 charge at the start, at most 2. Bags: 16 slots (24 with Deeper Pockets). Healing Draught and Mana Draught 35 %, Trail Rations 40 %, Ember of Return returns you with 40 % health | draft |  | constants.js |

## HS Hero select (class select)

The first screen. Words with "Echoes" show as "Legacy points" and "Hall of Echoes" as "Legacy hall" in a Legacy profile (util.js word swap); rows give the swapped text, which is what the demo shows.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| HS1 | A classic fantasy roguelike | draft |  | ui/screens.js |
| HS2 | Choose your hero | draft |  | ui/screens.js |
| HS3 | Your hero keeps its level, 1 to 25, from run to run. Six zones, then Oruvath. | draft | X: says 25 and six zones; the demo has a cap of 7 and two zones, and the demo spec does not change this line | ui/screens.js |
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
| HS15 | Seed (label) · random (placeholder) | draft | X: the demo hides the Seed field (spec 2.3); it is already hidden on a first run | ui/screens.js |
| HS16 | Guided first run (switch) | draft |  | ui/screens.js |
| HS17 | Guided first run: Zone 1 teaches the game as you play: one short line at a time. Skip it at any point. Settings can play it again later. | draft |  | ui/screens.js |
| HS18 | Legacy hall button: "{n} Legacy points" with a badge of unlocks in reach; tooltip: Legacy hall · Spend Legacy points on lasting unlocks: stats, items in the drop pools, skills and more. · {n} Legacy points · {k} unlocks within reach · Click to open | draft | X: "items in the drop pools, skills and more" describes the full hall; the demo sells seven entries and none of those kinds | ui/screens.js |
| HS19 | Resource: Energy and combo points / Mana / Focus, plus a pet · Basic attack: Strike / Spark / Auto Shot · Primary stat: Agility / Intellect · Starting spells / Spells · Companion | draft |  | ui/screens.js |
| HS20 | Hunter companions: Ridgewolf (Balanced hunter. Every third attack strikes twice.) · Thornback Boar (A sturdy tank. Taunts every enemy in round 1 and every 4 rounds after.) · Duskcat (Fragile and deadly. Hits hard with a higher critical chance.) · Stormhawk (Meta unlock. Its attacks also strike a second enemy.) | draft | M, X: "Meta unlock" is developer wording; the Stormhawk is a locked card whose hall entry is not sold in the demo | ui/mock-data.js |
| HS21 | Unlock it with Stormhawk in the Legacy hall. (Stormhawk card tooltip) | draft | X: points at a hall entry the demo does not sell (dead end) | ui/screens.js |
| HS22 | Hall of Echoes: "Unlocked with meta progression" (fallback tooltip line) | draft | M: "meta progression" is design vocabulary | ui/screens.js |
| HS23 | This browser window cannot save your progress. | to come |  | docs/specs/demo.md 2.4 |

## SC Start camp

Run 1 is the lean camp (supplies only, 5 camp points); run 2 shows one contract offer; from run 3 the board shows three (demo spec 4.3: zones 1-2 only). Economy v2 wording ("camp points") is on in the demo.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| SC1 | The start camp | draft |  | ui/prep.js |
| SC2 | Pick your supplies for the road to Amberfold Downs. (first run) | draft |  | ui/prep.js |
| SC3 | Pick your contracts and supplies for the road to Amberfold Downs. (later runs) | draft |  | ui/prep.js |
| SC4 | Your camp has grown: {points} camp points and a contract board. Contracts pay XP, gold and a choice of gear. | draft |  | content/texts.js |
| SC5 | Keys line: 1-3 contracts · A-D supplies · Enter set out | draft |  | ui/prep.js |
| SC6 | Contracts (heading) · One per zone. Each gives its reward when its last site is won. | draft | X: the demo board has three slots over two zones ([[1,1],[1,2],[2,2]]), so "One per zone" cannot hold; U: "site" is undefined here | ui/prep.js |
| SC7 | Card: Cull / Bounty / Delve · Zone {n} · {family or elite or dungeon} · Win {n} marked sites in {region} / Hunt it down in {region} / Clear the dungeon, its boss included · Reward {xp} XP · gold {coins} · choose 1 of 3 · Take / Drop / Taken | draft | U: "Cull", "Bounty" and "Delve" are not explained on the card; the tooltip names the task | ui/prep.js |
| SC8 | Contract tooltip: Win {n} of its marked sites: Quest or Grind nodes that carry its mark on the map, most of them in {region}. Other fights do not count. | draft | R: "marked", "mark" and "sites" four times in two sentences | ui/prep.js |
| SC9 | Contract tooltip: Hunt down {elite} in {region}. | draft |  | ui/prep.js |
| SC10 | Contract tooltip: Clear {dungeon}, its boss included. | draft |  | ui/prep.js |
| SC11 | Contract tooltip: Reward: {n} XP, {gold}, and 1 of 3 items. · Cost: {n} camp points. | draft |  | ui/prep.js |
| SC12 | Supplies (heading) | approved D150 item 15 |  | ui/prep.js |
| SC13 | Supply cards: Field Draughts 1 · Ember of Return 4 · Region Charts 1 · Tracker's Notes 2; tags Supply / Sight; Buy / Sell / Owned | draft | U: "Sight" is not explained | ui/prep.js |
| SC14 | Field Draughts · effect: 2 Healing Draughts in your bags. · flavour: Corked bottles of bitter red, brewed by a hedge healer who will not say what is in them. | draft |  | content/texts.js |
| SC15 | Ember of Return · effect: One Ember of Return: you rise again once when you would die. · flavour: A coal that never cools, kept in a clay pot for the day the road ends badly. | draft |  | content/texts.js |
| SC16 | Region Charts · effect: Every node's region and every dungeon shown on each zone map. · flavour: Hand-inked sheets, folded soft from use, with the roads and the bad ground marked. | draft |  | content/texts.js |
| SC17 | Tracker's Notes · effect: Contract sites marked within 2 hops of you, even on nodes you have not seen yet. · flavour: A scout's cramped notes on tracks, droppings and where the quarry sleeps. | draft |  | content/texts.js |
| SC18 | Option tooltip: {n} camp points, in effect when you set out (vision: for the whole run) · sold back for a full refund until you set out · Click or press {A-D} to buy it / to sell it back (+{n}) | draft |  | ui/prep.js |
| SC19 | Option tooltip, owned: Owned already (Legacy hall or the run's options): nothing to buy. | draft |  | ui/prep.js |
| SC20 | Camp points (counter) · tooltip: {n} this run; {m} spent. Camp points buy contracts and supplies here. Points you keep can buy a contract at a hub on the way. They do not carry over to the next run. · {k} of 3 contract slots used | draft | R: the counter, the tooltip and hint H23 say the same thing three times | ui/prep.js |
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
| GR3 | G2 Moving: Click a lit node next to you to walk there. | draft |  | content/tutorial.js |
| GR4 | G4 Loot: Green arrow means upgrade. Equip it in your bags {key_bags}. | approved D150 item 18 |  | content/tutorial.js |
| GR5 | G5 The Furnace: Every move costs tolls. Spend too many and the final boss gets stronger. | approved D150 item 12 |  | content/tutorial.js |
| GR6 | G6 Intents: Its next three moves, in order. The big one is marked. | draft |  | content/tutorial.js |
| GR7 | G7 Engage round: Round 1 is yours: they act from round 2. Open with {key_engage1}, {key_engage2} or {key_engage3}. | approved D150 item 11 |  | content/tutorial.js |
| GR8 | G8 Wind-up: Wind-up: stop it with {key_engage2}, an interrupt or a stun, and it is weakened all fight. | draft |  | content/tutorial.js |
| GR9 | G8 Wind-up (landed): It landed: that enemy hits harder until it dies. | draft |  | content/tutorial.js |
| GR10 | G8 Wind-up (withEngage): Round 1 is yours: open with {key_engage2} on the wind-up and it is weakened all fight. | draft |  | content/tutorial.js |
| GR11 | G9 Deathblow (landed): Maimed: your healing is halved this fight. Drink early. | draft | R: the Maimed fact is said again by hint H06, the status chip and its tooltip, and the log | content/tutorial.js |
| GR12 | G10 Contract sites: Contract site: win this fight to count it. | draft |  | content/tutorial.js |
| GR13 | G10 Contract sites (done): Contract done: choose one reward. | draft |  | content/tutorial.js |
| GR14 | G11 Potions: Low health: drink a Healing Draught ({key_item1}). It uses your turn. | draft |  | content/tutorial.js |
| GR15 | G12 The Dimming: The dark spreads from the purple star. Places it reaches are lost. | approved D150 item 13 |  | content/tutorial.js |
| GR16 | G12 The Dimming (road): Take a Road to leave. | approved D150 item 13 |  | content/tutorial.js |
| GR17 | G13 Homeward Bell: Far from a Road? Ring the Homeward Bell to reach the next hub. | draft | U, X: the Bell is hidden in zone 1 on a first run and the demo leaves zone 2 by a Road or the Bell; "the next hub" is the demo end for zone 2 | content/tutorial.js |
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
| GR31 | H05 Off-balance: Off-balance: it takes +{offbalPct}% damage. Spend your big hit now. | draft | M: "+{offbalPct}%" has no space before % (every other line writes " %") | content/tutorial.js |
| GR32 | H05 (shield): Off-balance, but its shield takes your hits first: break it, then spend your big hit. | draft |  | content/tutorial.js |
| GR33 | H06 Maimed: Maimed: your healing is halved for this fight. | draft | R: same fact as G9 landed | content/tutorial.js |
| GR34 | H07 Lethal: Lethal: this hit kills you. Stop it, heal, or kill first. | draft |  | content/tutorial.js |
| GR35 | H08 DoT preview: The marked end of a health bar is what damage over time will still take. | draft | U: "the marked end of a health bar" is hard to picture | content/tutorial.js |
| GR36 | H09 Potions: Low health: drink a Healing Draught ({key_item1}). It uses your turn. | draft | B: "It uses your turn" is untrue once Packed Satchel is owned (the first potion each fight is free); the demo nudges the Satchel in run 1 | content/tutorial.js |
| GR37 | H10 Free potion: Packed Satchel: your first potion each fight costs no turn, at half strength. | draft |  | content/tutorial.js |
| GR38 | H11 Loot: Green arrow means upgrade. Equip it in your bags {key_bags}. | approved D150 item 18 |  | content/tutorial.js |
| GR39 | H12 Trainer: retired, no line | draft |  | content/tutorial.js |
| GR40 | H13 Spell bar: Drag your new spell onto the bar (spellbook, {key_spellbook}). | draft |  | content/tutorial.js |
| GR41 | H14 Talents: Talent point: spend it in Talents ({key_talents}). | draft |  | content/tutorial.js |
| GR42 | H15 Fog: You see the nodes next to you. Walking shows more. | draft |  | content/tutorial.js |
| GR43 | H16 The Furnace: Every move costs tolls. Spend too many and the final boss gets stronger. | approved D150 item 12 | X: "the final boss" is out of reach in the demo (also G5) | content/tutorial.js |
| GR44 | H17 Burning: Burning: more XP, gold and better drops, but the final boss gets stronger. | draft | X: "the final boss" is out of reach in the demo | content/tutorial.js |
| GR45 | H18 The Dimming: The dark spreads from the purple star. Places it reaches are lost. | approved D150 item 13 |  | content/tutorial.js |
| GR46 | H19 Homeward Bell: same line as beat G13 | draft |  | content/tutorial.js |
| GR47 | H20 Contract site: Contract site: win this fight to count it. | draft |  | content/tutorial.js |
| GR48 | H21 Contract done: Contract done: choose one reward. | draft |  | content/tutorial.js |
| GR49 | H22 Hub contract: This hub offers a contract. Pay in camp points, or swap one you hold. | draft |  | content/tutorial.js |
| GR50 | H23 Start camp: Camp points buy contracts and supplies. Keep a few to take a contract at a hub later. | draft |  | content/tutorial.js |
| GR51 | H24 Elite: Elite: hover it to see its Deathblow before you go in. | draft |  | content/tutorial.js |
| GR52 | H25 Rare: Rare: a named foe with better loot. Read its moves first. | draft |  | content/tutorial.js |
| GR53 | H26 Dungeon: Dungeon: several fights and a boss in one visit. | draft |  | content/tutorial.js |
| GR54 | H27 Disrupt: Bosses resist control: {key_engage2} disrupts their first wind-up instead. | draft |  | content/tutorial.js |
| GR55 | H28 Vendor: Sell what you do not need. Potions are always in stock. | draft |  | content/tutorial.js |
| GR56 | H29 Rest: Rest: back to full health and mana, for tolls. | draft |  | content/tutorial.js |
| GR57 | H30 Pass: Waiting ({key_pass}) keeps them sapped: the wind-up never comes. | draft | U: "Waiting" keeps them "sapped" mixes two words for Pass and refers to Sap before the player knows it | content/tutorial.js |
| GR58 | H31 Autoplay: {key_autoplay} lets autoplay fight for you. It answers Deathblows too. | draft |  | content/tutorial.js |
| GR59 | H32 Flee: You can flee ({key_flee}). The node stays open for later. | draft |  | content/tutorial.js |
| GR60 | H33 Pet: Your pet fights beside you and draws some of the blows. | draft |  | content/tutorial.js |
| GR61 | H34 Stealth: retired, no line | draft |  | content/tutorial.js |
| GR62 | H35 The Camp: The Camp: last stop before Oruvath. Spend your gold here. | draft | X: cannot fire in the demo (no Camp) | content/tutorial.js |
| GR63 | H36 End boss: No engage round here: read its schedule above it. | draft | X: cannot fire in the demo (no Oruvath) | content/tutorial.js |
| GR64 | H37 Hall of Echoes: Echoes buy lasting unlocks. They stay when a run ends. | draft |  | content/tutorial.js |
| GR65 | guide.rescueLine: The Bellwrights pull you back ({rescueTolls} tolls). | draft | U: "the Bellwrights" is never explained to the player | content/tutorial.js |
| GR66 | guide.rescueCapLine: That was the last rescue: the guide ends here, and from now on a death ends the run. | draft |  | content/tutorial.js |
| GR67 | guide.rescueLeftLine: Rescues left before the guide ends: {rescuesLeft}. | draft |  | content/tutorial.js |
| GR68 | guide.skipLine: You skip the guide: new things get one hint each. | draft |  | content/tutorial.js |
| GR69 | guide.roadsOpenLine: The Roads are open. | draft |  | content/tutorial.js |
| GR70 | guide.endLine: The guide ends here. New things get one hint each. | draft |  | content/tutorial.js |
| GR71 | guide.hubLine: Welcome to {zone}. | draft |  | content/tutorial.js |
| GR72 | guide.hubTrainerLine: Welcome to {zone}. The trainer has something new for you. | draft |  | content/tutorial.js |
| GR73 | guide.holdLine: The Bellwrights keep the dark off this road until Gorrak's fight is over. | draft | U: "the Bellwrights" is never explained to the player | content/tutorial.js |
| GR74 | guide.dimBackLine: The Bellwrights ring the dark back. | draft | U: "the Bellwrights" is never explained to the player | content/tutorial.js |
| GR75 | guide.bountyLine: Gorrak's bounty: the Bellwrights pay for the Fieldbreaker. | draft | U: "the Bellwrights" and "the Fieldbreaker" are not explained | content/tutorial.js |
| GR76 | guide.bountyRoadLine: The Bellwrights pay for the road you kept open: +{xp} XP. | draft | U: "the Bellwrights"; "the road you kept open" is unclear | content/tutorial.js |
| GR77 | Gorrak's gate: Gorrak is out on the downs. Fights before he comes back: {n}. · Gorrak is back on his threshing floor. | draft |  | content/tutorial.js |
| GR78 | First-run nudge: The Bellwrights' welcome (the welcome line on the run summary) · Your first unlock is ready: Packed Satchel. · Buy Packed Satchel: {satchelPotions} potions every run, and your first potion each fight costs no turn. · Later | draft | U: "The Bellwrights' welcome" is not explained; the hall line leaves out "at half strength" that hint H10 states | content/tutorial.js |
| GR79 | Coach strip buttons: Got it · Skip · Keep it · confirm: Skip the guide for this run? First-time hints stay on. · toast: Hints off. Settings can turn them on again. | draft |  | ui/onboarding.js |
| GR80 | UI hints: U01 Nearest Road: {hops}, {tolls}. · U02 Pass through a place for {passTolls} {key_pass}. · "Take a Road to leave. Nearest: {hops}, {tolls}." | draft |  | ui/ui-text.js |
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
| WD11 | Roads (exits): Stilt Haven Boardwalk · Lanternless Causeway · Heron's Ford | draft | X: in the demo every Road of zone 2 ends the run; the Road tooltip says "leads to the hub of {zone 3}" (demo spec 4.3 adds one line) | content/zones.js |
| WD12 | Regions: Sedge Flats (wilds) · Rotplank Causeway (road) · Gloamwater Hollow (haunt) · Stiltrow Hamlets (steads) | draft |  | content/zones.js |
| WD13 | Dungeon The Sunken Weir: A flooded dam-keep where the water rises one step each day. | draft |  | content/zones.js |
| WD14 | Shrine lines: A shrine of knotted reeds floats on a still pool, glowing with a dim green light. \| A sunken bell chimes beneath the mist, though no wind moves it. | draft |  | content/zones.js |
| WD15 | Treasure lines: A smuggler's oilcloth bundle is wedged in the roots of a drowned willow. \| A tilted pole holds a lockbox just above the waterline, left by a fisher who never returned. | draft |  | content/zones.js |
| WD16 | Junk items (grey, sold for coin): Waterlogged Rope · Cracked Eel Jar · Rotten Net Float | draft |  | content/zones.js |
| WD17 | Zone banner on arrival: {zone name} · Levels {a}-{b} · Enemies here deal up to +{N} % damage | draft | U: "deal up to +25 % damage" has no stated base | ui/ui-text.js |
| WD18 | Region lines on the map: Wilds: beasts, open country · Road country: bandits and waystations · Haunt: ruins, casters and shrines · Steads: farms, villages and rest | draft |  | ui/screens.js |
| WD19 | Where a shard of Oruvath fell and cracked the rim. The dark starts here. | draft | U: "cracked the rim" (which rim?); names Oruvath before the player has met him | content/texts.js |
| WD20 | Darkness that spreads from the Shardfall. It takes the land hop by hop, and whoever stands in it. | draft | U: "hop by hop" is map jargon | content/texts.js |
| WD21 | It takes at most {maxPerToll} places a toll, nearest the purple star first, from toll {grace} in the zone. | draft | M, U: "It takes at most 2 places a toll ... from toll 6 in the zone" reads like a formula | content/texts.js |
| WD22 | A small brass bell. Rung, it carries you on to the next zone's hub. | draft |  | content/texts.js |
| WD23 | Things that walked into the Dimming and came out hollow, lit only by the shard's cold glow. | draft | X: appears to be unused (the Dimming fights use the zone's own enemies); no screen found that shows it | content/texts.js |

## MP Zone map, nodes and dialogs

The map is the main screen. Each node type has a tooltip, and a dialog on entering. "Level N" is on the hero scale in a Legacy run.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| MP1 | Node names: Quest, Grind, Elite (Rare elite), Dungeon, Rest, Vendor, Trainer, Treasure, Shrine · Hub: Zone hub: trainer, vendor and inn | draft |  | ui/screens.js |
| MP2 | Fog: Unknown: not seen yet. Its ring gives its level range. · Known from afar: its type only. · Remembered: seen before, out of sight now. · Ring {n} · levels {a}-{b} · Ring {n} · guided fight | draft | U: "ring" is never explained; "guided fight" appears in the tooltip of a scripted fight | ui/screens.js |
| MP3 | Legend: Seen: in sight · Remembered · Type known · Unknown · Dimmed · Dims in 3 tolls · Shardfall | draft | M: "Type known" and "Seen: in sight" are internal states; four words for fog | ui/screens.js |
| MP4 | Vision: Nodes within {n} hop(s) of you are in full view; a node once seen stays on the map. · Your charts show every region. / A region shows where you have seen its land. · Pathfinder: node types within {n} hops. | draft | U: "hop" | ui/screens.js |
| MP5 | Quest tooltip: {quest title} · From {giver} · Foes: {n} enemies + role badges · A quest giver needs help. One fight, then experience, gold and a choice of two rewards. Three quests in a zone complete its story. | draft |  | ui/screens.js |
| MP6 | Grind tooltip: Wave 1: {n} enemies · Fight 1 to 3 waves of two enemies. Steady experience, gold and more drops. | draft |  | ui/screens.js |
| MP7 | Elite tooltip: {name} · Elite level {n} · Has a Deathblow: one huge hit you must stop. · One powerful enemy, two levels higher. High experience and a guaranteed good item. | approved D150 item 23 (Deathblow line) |  | ui/screens.js |
| MP8 | Dungeon tooltip: {dungeon} · Boss: {boss} · Fight 1: 2 enemies … · Its boss has a Deathblow: one huge hit you must stop. · Three fights and a dungeon boss. The best loot in the zone, and the most dangerous node. | draft |  | ui/screens.js |
| MP9 | Treasure / Rest / Vendor / Shrine tooltips: Unguarded · Full health and mana, and rested experience: kills give double XP until it runs out. · Buy potions, rations and gear; sell junk and old equipment. · Learn new spells and train known ones to your level. · Choose one of two blessings. | draft |  | ui/screens.js |
| MP10 | Zone danger line: Zone danger: enemies here deal up to +{N} % damage (above level {n}). | draft | R: says the same as the zone banner line "Enemies here deal up to +{N} % damage" | ui/screens.js |
| MP11 | Move lines: Click to enter · Click to walk here · Click to travel here · Costs {n} tolls. · Not here yet. · You are here · Not next to you · Not reachable from your position · Visited · Done | draft | M: "Not reachable from your position" and "Not next to you" say one thing two ways | ui/screens.js |
| MP12 | Costs {n} tolls. (move cost; "Costs {n} tolls a wave." for a Grind; "Costs {n} tolls, then a fight in the Dimming.") | approved D150 item 6 |  | ui/heat.js |
| MP13 | Not here yet. (a barred node) | approved D150 item 23 |  | ui/screens.js |
| MP14 | Entered {Calm/Smouldering/Burning/Infernal}: it gave a bonus · {state} bonus: +35 % XP and gold, 1 in 2 drops a rarity up. | draft |  | ui/heat.js |
| MP15 | Road node: {Road name}: leads to {next zone hub} · A Road out of the zone, to {hub}. · Standing on it: Take the Road · {n} tolls · Dimmed: first a fight with this zone's creatures, made stronger by the dark; then the Road can still be taken. | draft | X: in zone 2 the next zone is Highcairn Reach (zone 3), a name the demo never shows elsewhere; the demo ends the run instead | ui/screens.js |
| MP16 | Road click: Walk to the Road first · Too far: click a lit node | draft |  | ui/screens.js |
| MP17 | Dimmed node: Lost to the Dimming: it can no longer be done. · Dimmed: entering or staying here starts a fight with this zone's creatures, made stronger by the dark; what it held is lost. | draft | R: the same sentence is in the node tooltip, the Road tooltip and the Dimming panel tooltip | ui/screens.js |
| MP18 | Dimming panel: {n} of {m} places Dimmed · Starts to spread in {n} tolls · Spreads in {n} tolls: {k} places · Spreads again in {n} tolls · You stand in the Dimming! · Your node dims in {n} tolls | draft |  | ui/screens.js |
| MP19 | Dimming panel tooltip: The Dimming · Darkness that spreads from the Shardfall. It takes the land hop by hop, and whoever stands in it. · It takes at most 2 places a toll, nearest the purple star first, from toll 6 in the zone. · Entering or standing in a Dimmed node starts a fight with this zone's creatures, made stronger by the dark; what it held is lost. Leave by a Road or the Bell. | draft | R, M: the Dimmed-node sentence again; "places a toll" is formula-like | content/texts.js, ui/screens.js |
| MP20 | Held corridor (guided zone): The Bellwrights keep the dark off this road until Gorrak's fight is over. | draft | U: Bellwrights | content/tutorial.js |
| MP21 | Travel: Ring the Bell ({n}) · It takes you to the hub of {zone} · Leave for {zone}. · {n} contracts here will expire: {list}. No reward. · Click, then confirm | draft | X: in zone 2 the line reads "the hub of Highcairn Reach" (zone 3); in the demo the Bell and the Roads end the run | ui/screens.js |
| MP22 | Leave dialog: Leave {zone}? · Take the Road anyway · Ring the Homeward Bell? · The Homeward Bell takes you to the hub of {zone}. Costs {n} tolls. It is your only charge this run. No way back to {zone}. · {n} contracts here will expire: {list}. They pay nothing once expired. · Esc: stay | draft | X: in zone 2 the dialog says "The Homeward Bell takes you to the hub of Highcairn Reach" and "No way back to Greywater Fens"; the line "Leaving Greywater Fens ends this demo run. You keep your levels and Legacy points." is to come (DM9) and would sit beside them | ui/screens.js |
| MP23 | Spyglass (not offered at the demo camp): Look at any node of the zone, however far… | draft | X: cannot occur in the demo (Spyglass is not a camp option) | ui/screens.js |
| MP24 | Quest dialog: {title} · Quest · level {n} · {giver} says: “{quest text}” · Enemies · Reward: experience, gold and a choice of two items. · Accept | draft |  | ui/screens.js |
| MP25 | Grind dialog: Grind · Level {n} · {n} wave(s) · {n} tolls · Enemies · You can stop after any wave. · Wave {n} of {m} done | draft |  | ui/screens.js |
| MP26 | Elite dialog: {elite name} · Elite · level {n} (Rare elite for a rare) · {flavour line} · Threat: High: elites hit hard and have special abilities · Reward: Large experience, gold and a guaranteed good item · Escort: {name} · Engage | draft |  | ui/screens.js |
| MP27 | Dungeon dialog: {dungeon} · Dungeon · level {n} · {dungeon text} · Fights: {n} groups, then {boss} · Between fights: You may eat, change gear, or leave with what you have · Warning: No fleeing from the dungeon boss · Enter the dungeon · Eat Trail Rations ({n}) · Leave the dungeon · Press on · Face the boss · Fight {n} of {m} cleared · Next: {boss}. There is no fleeing from the boss. | draft |  | ui/screens.js |
| MP28 | Treasure / Rest / Shrine dialogs: A guardian watches the chest: {name}. · The chest is yours. · Open the chest · Rest · Campfire · You rest by the fire until the ache leaves your bones. · {n} XP: kills give double experience · Shrine · Choose one blessing · An old shrine hums softly. · A needle trap! · You lost some health opening it. | draft |  | ui/screens.js |
| MP29 | Shrine blessings: Boon of Return (A resurrect charge that lasts until used.) · Boon of Insight (+20 % experience for the next 3 nodes.) · Boon of Fury (+15 % damage for the next 3 nodes.) · Boon of Plenty (A pouch of gold, now.) · Boon of Mending (Full health and mana now, plus rested experience.) · Boon of Clarity (Your next respec is free, and every spell is trained to your level now.) | draft | N, R: "Boon of Return" is a second name for the revive (D150 fixed it as "Ember of Return"); "resurrect charge" is a third | ui/mock-data.js |
| MP30 | Minimap and tracker: Story: {n} / 3 quests · Levels {a}-{b} · Contract slots {n}/3 · {points} camp points · None in this zone · Expires when you leave this zone · Both expire when you leave this zone · Later: {n} contract(s) (zone {z}) · L | draft | U: "Story: 0 / 3 quests"; what the story is, is never said except in a node tooltip | ui/prep.js |

## FU The Furnace (heat bar) and the Dimming meter

The bar is hidden in the guided first run until its coach line has shown. State words: Calm, Smouldering, Burning, Infernal (D68, team decision with owner review of names; D150 kept "tolls" and "the Dimming").

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| FU1 | Meter line: {state} · {n} tolls to spare / {n} tolls overspent / No tolls to spare · Boss +{n} % (only above 0) | approved D150 item 1 |  | ui/heat.js |
| FU2 | The Furnace (title and tooltip heading) | draft | N: D68 chose the name; D150 did not address it. Owner review of names is still open | ui/ui-text.js |
| FU3 | Calm · Smouldering · Burning · Infernal | draft | R: "Burning" is also the name of the fire damage-over-time status (section FT); "Infernal" appears only on the bar | ui/ui-text.js |
| FU4 | Tooltip: Every move costs tolls. Overspend and fights pay more, but the final boss gets stronger. | approved D150 item 5 | X: no demo run meets the final boss (demo spec Q1: keep, default) | ui/heat.js |
| FU5 | Tooltip rows: Calm: Tolls to spare · Smouldering: Up to 10 overspent · Burning: 10 to 30 overspent, +35 % XP and gold, 1 in 2 drops a rarity up · Infernal: 30 or more overspent, +50 % XP and gold, 7 in 10 drops a rarity up | approved D150 item 5 |  | ui/heat.js |
| FU6 | Tooltip when the Dimming sets the state: Your node dims in {n} tolls. Tolls: {n} overspent / to spare / none to spare. The Dimming near you sets the Furnace now. · ◆ The Dimming near you. Whichever marker is further right sets the state. | draft | R: "Dimming" three times; "sets" twice | ui/heat.js |
| FU7 | Meter line while the Dimming sets it: The Dimming is near · You stand in the Dimming · tag: Set by your tolls / Set by this place | draft |  | ui/heat.js |
| FU8 | Inside a node: This place counts as {state}. A place counts in the state you entered it in, whatever the Furnace shows later. | draft |  | ui/heat.js |
| FU9 | Carry-over: Tolls carry over: {n} overspent / saved before this zone, which adds {m}. · Zone 2 adds 20 tolls; you saved 10: 30 to spare. (on arrival in zone 2, beside Set out) | draft | U: "adds 20" is hard to read without the meter | ui/heat.js |
| FU10 | The Dimming takes {n} places while you are inside. (node tooltip) | draft |  | ui/heat.js |
| FU11 | Item badge: ▲ The Furnace · Raised by the Furnace: Found in a node entered Burning: the Furnace raised this item one rarity. · ▲ The Furnace raised it one rarity (found Rare) | draft | R: "raised" three times | ui/heat.js |
| FU12 | Log line on a change of state: The Furnace: Burning · 3 tolls overspent. | draft |  | ui/heat.js |
| FU13 | Run summary, Furnace card: The Furnace · Tolls in each state: Calm {n} · Smouldering {n} … · Tolls per zone: above 0 overspent, below 0 to spare · Tolls: {n} · {n} tolls to spare / overspent in the last zone · Nodes entered, by the state you entered them in: … · Fights won while Burning or Infernal: {n}. The Dimming caught you {n} times (Infernal where it stands). Hover a point for its tolls. | draft | R, X: states "Tolls" four times; the "Oruvath … at his base strength" end line applies only after the Camp | ui/heat.js |

## HB Hub, trainer, vendor, inn

Hubs: Millbrook Rest (zone 1), Stilt Haven (zone 2).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| HB1 | Hub panel: {hub name} · {zone} · levels {a}-{b} · {hub text} · Set out | draft |  | ui/screens.js |
| HB2 | Trainer card: Learn and rank up spells · Waiting: {n} new spells, {m} rank(s) · Its lessons cost more gold than you have. · Next spell at level {n}. · Nothing new to learn. | approved D150 item 22 (Next spell at level {n}.) |  | ui/screens.js |
| HB3 | Vendor card: Potions, rations and gear · Potions and rations (gear sold out) | draft |  | ui/screens.js |
| HB4 | Inn card: Full rest and rested experience · Used this visit · Rest anyway? · Health {n} %, mana {n} %: nearly full · Rest · {n} tolls · Cancel | draft |  | ui/screens.js |
| HB5 | You have {n} unspent talent point(s). Press N. | draft |  | ui/screens.js |
| HB6 | Hub contract (from the second zone on): Contract on offer · {hub} has work on the board: {contract} · Take for {n} camp points (you have {m}) · Swap… · Keep my contracts · Give up: {contract} · zone {z}, {progress} · Take it for camp points: Pay {n} camp points of your {m}. It needs a free slot ({k} of 3 used). Only before you leave this hub. · Swap: Give up one contract you hold and take this one for free. No refund; its progress is lost. Only before you leave this hub. · Contract taken · {title}: its sites are on the map and in your tracker. | draft | R: the last two lines repeat "Only before you leave this hub"; U: "Swap" and "sites" | ui/prep.js |
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
| QU11 | The Hedge Breaker · Hobb Larrow · “An ogre keeps smashing through the hedges on the east lane. He swings slow and heavy. Send him back to the woods.” · Turn-in: “The lane is quiet again. Well struck.” · (guided run) | draft | U: 3 sentences; the other quests have two; R: a second Hobb in zone 1 (the rare Hobb Tollwright) | content/quests.js |
| QU12 | Straw and Tusk · Tamsy Crake · “A scarecrow walks the turnip field at night, and a boar trots at its heels. When the straw man starts to chant, stop it.” · Turn-in: “No more chanting in my field. Thank you.” · (guided run) | draft |  | content/quests.js |
| QU13 | Tusks in the Verge · Warden Pell · “Boars come down from the Verge and churn every field they cross. Thin them out for us.” · Turn-in: “That will keep them off the fields a while.” · (guided run) | draft | R: Warden Pell (zone 1) and Harbourwarden Pell (zone 2) are two people with one name | content/quests.js |
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
| QU24 | Quest log and tracker lines: Quest complete! · Zone story complete: a rare reward awaits. · {zone}: the story · {zone}: the story is told · Three tasks done; the people of this land will remember your name. · Complete 3 quests in this zone for a rare reward and bonus experience. Done: {n} / 3. | draft | U: "the story" and "stories" are never defined; the summary says "(1 stories)" when the count is 1 | ui/engine-bridge.js, ui/windows.js |

## CT Contracts

Contract sentences are built from four templates and the family names. Zone 1-2 families: outlaw, wild beast, blightborn, fen beast, reedfolk, witchkin. In the demo the board draws from zones 1-2 only (demo spec 4.3).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| CT1 | cull: Beat the {family} at {n} marked sites, most of them in {region}. | draft |  | content/texts.js |
| CT2 | bounty: Hunt down {elite}, a {familyOne} roaming {region}. | draft |  | content/texts.js |
| CT3 | delve: Clear {dungeon}, its boss included. | draft |  | content/texts.js |
| CT4 | hub: {hub} has work on the board: {contract} | draft |  | content/texts.js |
| CT5 | Kind names: Cull · Bounty · Delve · Win fights at its sites: Quest and Grind nodes, most of them in one region. · Hunt down one named elite that roams one region. · Clear the zone's dungeon, its boss included. | draft | N: "Cull" and "Delve" are new words to a first-time player; "Bounty" is also the name of the first-run reward (Gorrak's bounty) | ui/ui-text.js |
| CT6 | Family outlaws · done line: “Fewer outlaws on the roads. The carters will sleep easier.” | draft |  | content/texts.js |
| CT7 | Family wild beasts · done line: “The wild beasts keep their distance now. The herders thank you.” | draft |  | content/texts.js |
| CT8 | Family blightborn · done line: “The blightborn are burnt back. The fields can breathe.” | draft | U: "blightborn" is a new word | content/texts.js |
| CT9 | Family fen beasts · done line: “The fen beasts have gone quiet in the reeds. Good riddance.” | draft |  | content/texts.js |
| CT10 | Family reedfolk · done line: “The reedfolk have pulled back into the marsh. The boats can go out again.” | draft |  | content/texts.js |
| CT11 | Family witchkin · done line: “The witchkin's hexes are broken, and the wells taste clean.” | draft |  | content/texts.js |
| CT12 | Delve done line: {dungeon} is quiet at last. | draft |  | ui/ui-text.js |
| CT13 | Fallback done line: A runner from {hub} brings your pay. Well done. | draft |  | ui/ui-text.js |
| CT14 | Site lines: While you hold it, {dungeon} shows on the zone map. · Only Quest or Grind nodes with its mark count; other fights do not. · Marks show within {n} hops (, {n} more with the Local Guide) (; with Tracker's Notes within {n} hops, even on nodes you have not seen). · It can be found at {n} Elite nodes away from the hub; beat it at either. | draft | R: "Marks show within" repeats the Tracker's Notes rule; "Local Guide" is not offered at the demo camp | ui/ui-text.js |
| CT15 | Reward line: choose 1 of {n}: {p} % rare, {p} % epic | draft | M: percentages read as a drop table | ui/ui-text.js |
| CT16 | Contract log lines: Contract taken: {name} · Contract site won: {name} · {n} / {m} · Contract complete: {name} · Contract expired: {name} · Contract given up: {name} | draft |  | ui/engine-bridge.js |
| CT17 | Board screen (run 2): Your camp has grown: {points} camp points and a contract board. Contracts pay XP, gold and a choice of gear. | draft | R: "Contracts pay" is a short form of "Pays", which D150 retired from player text | content/texts.js |
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
| EN15 | Warden Belk of Harrow (dungeon boss) · The manor reeve who bricked himself in with his stolen rents and never left. · abilities: Ledger-Breaker, Distraint Chain | draft | U: Ledger-Breaker, Distraint Chain: "distraint" is a word a player will not know | content/enemies.js |
| EN16 | Mire Brute (normal) · A hulking swamp-dweller coated in peat. Its fists hit like dropped boulders. | draft |  | content/enemies.js |
| EN17 | Reed Stalker (normal) · A thin fen-hunter who moves unseen through the tall reeds. | draft |  | content/enemies.js |
| EN18 | Bog Witch (normal) · A hag who brews fever-mist over her cauldron and flings it at travellers. | draft |  | content/enemies.js |
| EN19 | Marsh Lurker (normal) · A gape-jawed amphibian that waits just below the waterline. | draft |  | content/enemies.js |
| EN20 | Peat Sentinel (normal) · A walking heap of sodden turf and old timber, slow but nearly unbreakable. | draft |  | content/enemies.js |
| EN21 | Fenmother Acolyte (normal) · A priestess of the slow waters who knits wounds with silt and prayer. | draft |  | content/enemies.js |
| EN22 | Mistfang Hound (normal) · A pale hound bred by smugglers, fast and silent in the fog. | draft |  | content/enemies.js |
| EN23 | Bargh the Drowned King (elite) · A chieftain dragged under years ago who returned wearing the marsh like a crown. · abilities: Tidefall Slam | draft |  | content/enemies.js |
| EN24 | Sisel Mistweaver (elite) · A fen-witch who stitches fog into a shroud around her enemies. · abilities: Choking Mist | draft | R: three witch elites in two zones (Mother Thistlewick, Sisel Mistweaver, Old Wrenna Marshlight) with the same shape of name | content/enemies.js |
| EN25 | The Gloam Eel (rare elite) · An enormous eel said to be older than the causeways. · abilities: Venom Fangs, Thrashing Coils | draft |  | content/enemies.js |
| EN26 | Weir Crawler (trash) · A pale cave-crab grown huge on the dam's drowned stores. | draft |  | content/enemies.js |
| EN27 | Drowned Sentry (trash) · A rotting gate-guard that still stands its watch under the water. | draft |  | content/enemies.js |
| EN28 | Sluice Cutthroat (trash) · A smuggler who works the underwater sluices with a hooked blade. | draft |  | content/enemies.js |
| EN29 | Tidecaller Adept (trash) · A cultist who calls surges of cold brine against intruders. | draft |  | content/enemies.js |
| EN30 | Mawgrim of the Locks (dungeon boss) · A bloated gatekeeper who opens the floodgates on those who owe him toll. · abilities: Flood Hammer, Draw the Tide | draft | N: "owe him toll" uses toll in a second sense | content/enemies.js |
| EN31 | Hobb Tollwright (rare elite) · A road-warden turned robber who still writes a receipt for every purse. · abilities: Toll Hook, Final Receipt | draft | N: "Toll" is the move-cost word (tolls); the rare's abilities Toll Hook and Final Receipt would read as costing tolls | content/enemies.js |
| EN32 | The Mildew Warden (rare elite) · A stone-walled field guardian crusted in grey rot that spreads wherever it stands. · abilities: Blight Husk, Rotting Haymaker | draft | R: three Wardens in zone 1 (this one, Wardkeeper Ilsa, Warden Pell) and Warden Belk | content/enemies.js |
| EN33 | Skerrow Stiltwalker (rare elite) · A gaunt reed-hunter who crosses the mire on poles and is never where you struck. · abilities: Reed Barb, Pole Sweep | draft |  | content/enemies.js |
| EN34 | Old Wrenna Marshlight (rare elite) · A fen-crone who bottles marsh fires and drinks what her enemies spill. · abilities: Peat Poultice, Drowning Whisper | draft |  | content/enemies.js |
| EN35 | Role cards (Brute, Caster, Skulker, Beast, Guardian, Mender): Brute: Hits hard. Its Heavy Smash is a telegraphed big blow. Ask: Stop or absorb its Heavy Smash, then punish the opening. \| Caster: Fragile, but its casts hurt and curse you. Ask: Interrupt or control its Hex Bolt, or kill it before it casts. \| Skulker: Bleeds you, and as a lookout signals for help when it is not alone. Ask: Kill, interrupt or control it before it signals. \| Beast: Bloodlust: deals more damage every turn it acts. Ask: Kill it early: every turn alive makes it stronger. \| Guardian: Shields its ward and braces itself; tough to bring down. Ask: Do not spend your burst on its ward early, or control the guardian. \| Mender: Bolsters the weakest ally with a shield and mends the wounded. Ask: Kill or control it; interrupt its Mend. | draft | R: the ask lines say "stop" in five ways (stop, interrupt, control, absorb, kill first); D150 fixed "stopped" for a wind-up. N: "Heavy Smash", "Hex Bolt", "Mend" are ability names that no enemy in zones 1-2 shows under those words | ui/ui-text.js |
| EN36 | Enemy tooltip small lines: Elite level {n} · Level {n} · Rare elite · Has a Deathblow: one huge hit you must stop. · {n} enemies · Boss: {name} | approved D150 item 23 (Deathblow line) |  | ui/screens.js |

## FT The fight: bars, tracks, wind-ups and the log

Shown in every fight. Key letters are the ones in the build today. Status words are STATUS_INFO (what the player sees when hovering a status).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| FT1 | Status words (zones 1-2): Stunned: Skips its actions. \| Frozen: Frozen solid; skips its actions. \| Hexed: Skips its actions. Damage breaks the hex. \| Silenced: Cannot cast spells. \| Bleeding: Takes damage at the end of each round. \| Burning: Takes fire damage at the end of each round. \| Poisoned: Takes poison damage per stack each round. \| Chilled: Deals 20 % less damage. \| Cursed: Deals 15 % less damage. \| Exposed: Takes more damage. \| Marked: Takes 8 % more damage. \| Arcane Ward: Absorbs damage. \| Evasion: Greatly increased dodge. \| Stealth: Unseen. Openers are usable; enemies miss more often. \| Field Dressing: Heals at the end of each round. \| Taunting: Enemies attack the pet. \| Braced: Takes 50 % less damage. \| Off-balance: Its big move failed: it takes more damage, your hits crit more often, and it cannot dodge. Hit it now. \| Sapped: Skips its turns. Any damage wakes it, damage over time included. \| Trap: A trap waits under it and springs on its first heavy blow or cast, else on its first turn. \| Empowered: A wind-up landed: it deals more damage for the rest of the fight. \| Staggered: A wind-up was stopped: it deals less damage for the rest of the fight. \| Maimed: A Deathblow landed: the healing you receive is cut for the rest of the fight. Cleansing does not remove it. | draft | N: "Burning" (the fire status) is also a Furnace state (Burning); "Empowered", "Braced", "Staggered" and "off-balance" are four words for a hit that is stronger or weaker; Stealth is the one word for it (D150) | ui/ui-text.js |
| FT2 | Wind-up track, heading and tooltip: Wind-up now: stop it with {spell} · Wind-up on another enemy: · Heavy wind-up now: {spell} can blunt it · Wind-up now: nothing on your bar can stop it this round · Low health: {potion} · {enemy}'s {ability} this round: ≈ {n} on your {hp} health | draft | R: "stop it" and "blunt it" for one thing; U: "≈" | ui/hud.js |
| FT3 | Wind-up tooltip: Wind-up: {enemy}'s signature, telegraphed from the round it shows. · Heavy: a telegraphed big hit. Stun or control it on that turn to cancel it (it is then off-balance), or let a shield, a dodge or your pet take it. · Cast: interrupt it or control the caster on that turn to cancel it; a cancelled cast leaves it off-balance. · ★ Signature: its strongest ability, on a scripted turn. · Opening move: the same for every enemy of its role. | draft | N, R: "cancel", "stop", "interrupt", "control" and "answer" for one idea (D150: "stopped"); M: "Opening move" and "Signature" are not explained; the Deathblow line (item 23) is the approved one | ui/tracks.js |
| FT4 | Wind-up result lines: Deathblow stopped: {enemy}'s {ability} ({how}): −{n} % damage for the rest of the fight. · Deathblow landed: {enemy}'s {ability}. Empowered: +{n} % damage for the rest of the fight. · Wind-up stopped: … · Wind-up landed: … · Maimed: healing −{n} % · {who}: {ability} cancelled ({how}) → off-balance! · {who} is off-balance ({why}): hit it now | draft | N: "cancelled", "stopped", "missed" in three lines for one result | ui/director.js |
| FT5 | Track tooltip rows: Deathblow R3 · MAIMS if it lands · Estimated damage to you: about {n} · LETHAL: about {n} against your {hp} health. · No answer ready: nothing you have now can stop it. Kill it first, or be ready to take it. · Nothing on your bar stops it: plan your engage round, or kill it first. · {X}: wait (press Pass); it will be staggered. · Silenced: it cannot cast it. Stopped: staggered. · Aimed at your pet: if it hits your pet it lands all the same (empowered, and you are maimed). Send the Pet makes your pet take it on purpose: stopped. | draft | R: "No answer ready" and "Nothing on your bar stops it" twice; U: the last line needs a Hunter's pet and the move "Send the Pet", which is a Hunter-only action; "R3" is unexplained | ui/tracks.js |
| FT6 | Engage and action bar: Empty slot {n} · Drag a spell here from the spellbook (P). · Empty item slot 8/9/0 · Drag a potion or flask here from your bags (B). · Off-balance window: lands on {names} for more damage and more crits. · Off-balance window on {names}: target it first (click its nameplate or Tab). · Not enough energy for Gutting Jab: it costs 40, you have 30 · Not enough {mana/focus/energy} for {spell} | draft | R: "Off-balance window" twice | ui/hud.js |
| FT7 | Potion slot: {n} health · {n} mana · Free action, half strength (Packed Satchel) · Maimed: restores {n} health now (healing you receive −{n} % for the rest of this fight). · Item slot {key}: {potion}. Low health: drink it | draft | U: "Free action" is the Satchel's own term; "Maimed" is a status the demo player meets only through a Deathblow | ui/hud.js |
| FT8 | Autoplay: When on, the game picks each combat action for you (bar order is the priority). You can switch at any time, also mid-fight. · Key: Z · Autoplay will stop the Deathblow/wind-up with {enemy}, then wait a round · Pass: Do nothing this round. Resources still regenerate. · Key: X | draft | R: "bar order is the priority" is also in the Spellbook line (one instruction, two places) | ui/hud.js |
| FT9 | Flee: Try to escape. On success you leave the node with no further rewards. · Chance: {n} % · Key: F (press twice) · Flee this fight? ({n} % chance) · again or Confirm to run · or any action to stay · You fail to escape! | draft |  | ui/hud.js, ui/director.js |
| FT10 | Combat log: You use {spell}. · Your {spell} hits/crits {enemy} for {n}. · Your {spell} misses {enemy}. · {Enemy} dodges your {spell}. · {Enemy}'s {ability} hits/crits you for {n}. · {Enemy} winds up {ability}! · {Enemy} uses {ability}. · {n} absorbed · {ability} costs you {n} health. · You suffer {n} from {ability}. · {name} dies. / {name} has fallen. · {source} flares: you return to the fight! · {Enemy} signals for help: one more enemy joins · {Enemy} bolsters {name}: a {n} shield. · The channel begins / resolves. · You interrupt {enemy}: {ability} is cancelled. · Pre-cast: {spell}, no mana. | draft | R: "{name} dies" and "{name} has fallen" are two lines for one event; N: the line is "{source} flares: you return to the fight!" with the source name (the Ember of Return, or the Boon of Return from a shrine): two names for one revive | ui/director.js |
| FT11 | Rewards in the log: You gain {n} experience (+{n} rested) · +{n} XP · You receive {n} copper · You receive loot: {item} (waiting in the loot window) · You receive loot: {item} (raised by the Furnace) · Your old {item} is left behind (no room in your bags). | draft | U: "copper" is the only unit shown here; gold and silver appear elsewhere | ui/director.js, ui/engine-bridge.js |
| FT12 | Fight header: Fight {n} of {m}: {boss} · Wave {n} of {m} · {n} of {m} waves done · Return to {node} | draft |  | ui/hud.js |
| FT13 | Boss bar: {boss}, phase {n} · {boss} defeated · Final Dark at round {n} · Crush next round! · Linked | draft | X: all boss-bar words are for Oruvath; a dungeon boss (Belk, Mawgrim) shows only "{boss}, phase 1" | ui/engine-bridge.js, ui/hud.js |
| FT14 | Resurrect line in the fight HUD: It would kill you; {resurrect} would bring you back. · When you die, it brings you back to the fight at once. · {source} flares: you return to the fight! | draft | N: three ways to name the Ember of Return (a resurrect, the item, a source); D150 keeps "Ember of Return"; "resurrect" is not a word the player has | ui/hud.js |

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
| SP7 | Rogue · level 7 · Smoke Veil · 25 energy · cooldown 8 · Gain Evasion: +45 % dodge for 3 rounds. | draft | U: "Gain Evasion"; the status is shown as "Evasion"; the spell is Smoke Veil | ui/ui-text.js |
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
| SP18 | Hunter · level 6 · Muzzle Shot · 20 focus · cooldown 5 · Interrupts a cast and silences the target for 2 rounds. Never misses and cannot be dodged. | draft | R: Throat Jab, Spellsnap and Muzzle Shot are one move with three names (one per class); the line repeats | ui/ui-text.js |
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
| SP38 | Talent window: Talents unlock at level {first}. · Points come with your level from level {first}. Reset at a trainer. · One point at level {first}, then one every {step} levels. Reset at a trainer. · Unspent points: {n} · Rank {n}/{m} · Requires {n} points in this tree ({m} spent) · Next rank: … | draft | R: "Reset at a trainer" appears in two lines of the same window; the third line repeats the first | content/texts.js, ui/windows.js |
| SP39 | Spellbook: Drag onto the action bar (slots 1–7); right-click a bar slot to clear it. The bar order is also the autoplay priority. · {n} spells known · 7 bar slots · Next at a trainer: {spells} · Rank {n}. A trainer can raise it to rank {n}. · {n} round cooldown · Free · basic attack · Your basic attack. Costs nothing; use it when nothing better is ready. | draft | R: the autoplay-priority rule is also in the Autoplay tooltip | ui/windows.js, ui/tooltip.js |

## IT Items, bags and loot

Item names are plain data (src/content/item-names.js, affix-words.js, uniques.js). A generated name is: [prefix] base name [suffix]; the prefix is the affix word on a rare or epic, the suffix names the stats. Rarity names: junk, common, uncommon, rare, epic.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| IT1 | Zone 1 (Amberfold Downs), armour and jewellery: Head: Hempen Hood, Farmhand's Cap, Boarhide Helm · Chest: Linen Jerkin, Tanner's Coat, Tenant's Vest · Legs: Field Leggings, Wool Breeches, Hedge-Walker Trousers · Hands: Work Gloves, Reaper's Mitts, Thornproof Gauntlets · Feet: Ploughman's Boots, Furrow Treads, Millroad Shoes · Neck: Seed-Bead Necklace, Cord of Wheat, Boundary Charm · Ring: Copper Tally Ring, Straw-Plait Band, Brass Sowing Ring · Trinket: Barleycorn Token, Scarecrow Button, Millstone Chip | draft | R: "Boundary Charm" (neck, zone 1) and the unique "Boundarystone Charm" (zone 1 rare) are one word apart | content/item-names.js |
| IT2 | Zone 1 (Amberfold Downs), weapons: Agility Harvest Knife, Yew Shortbow, Skinning Blade · Intellect Hazel Wand, Hazel Rod, Elm Switch · Rogue Harvest Knife, Skinning Blade, Hedge Dagger · off-hand: shields Wooden Buckler, Millwheel Buckler, Hedgewood Shield · tomes Lantern Orb, Almanac of the Furrow, Millbrook Tome · quivers Quiver of Rushes, Boarhide Quiver, Strawbound Quiver · Rogue blades Pruning Knife, Sickle Blade, Thresher's Dirk | draft |  | content/item-names.js |
| IT3 | Zone 2 (Greywater Fens), armour and jewellery: Head: Reedweave Cap, Fenwarden's Cowl, Eelskin Hood · Chest: Waxed Fen Coat, Peatstained Jerkin, Marshwalker Tunic · Legs: Waders, Reedcloth Leggings, Bogtrotter Breeches · Hands: Net-Mender Gloves, Silt-Stained Mitts, Eelhide Grips · Feet: Stilt Boots, Marsh Treads, Reedsoles · Neck: Pearl Drop Pendant, Lantern-Fly Charm, Bog-Oak Amulet · Ring: Mist Signet, Fen-Silver Band, Brineglass Ring · Trinket: Fen-Bell Clapper, Glow-Moss Vial, Heron Feather Charm | draft |  | content/item-names.js |
| IT4 | Zone 2 (Greywater Fens), weapons: Agility Gutting Hook, Reedwood Longbow, Fen Cutlass · Intellect Bog-Oak Staff, Reed Rod, Willow Staff · Rogue Gutting Hook, Fen Cutlass, Reedcutter's Knife · off-hand: shields Driftwood Shield, Reedwoven Buckler, Stilt-Plank Shield · tomes Witchlight Orb, Gloam-Bound Tome, Mirewater Codex · quivers Smuggler's Quiver, Eelskin Quiver, Stiltwalker's Quiver · Rogue blades Eel-Bone Knife, Mudlark's Shiv, Stiltwalker's Dirk | draft | R: Stiltwalker appears in two item names (quiver, dirk) and in the rare Skerrow Stiltwalker | content/item-names.js |
| IT5 | Prefixes: Keen, Honed, Deft (crit) · Runed, Potent, Hallowed (power) · Sturdy, Reinforced, Warded (armour) | draft | M: "Warded" (armour prefix) and Arcane Ward / the Ward status are one word | content/affix-words.js |
| IT6 | Suffixes (tiers 2 and 4): of Quick Hands / of the Long Stride · of Lamplight / of the Inkwell · of Deep Roots / of the Long Winter · of the Drover / of Hard Roads · of Still Water / of the Calm Hand · of the Watchfire / of Thick Walls · of Quiet Hours / of the Hermit · of the Outrider / of Open Country · of Old Lore / of the Hedge-Seer | draft | U: "of the Outrider", "of the Hedge-Seer" and "of Old Lore" name nothing the player has met | content/affix-words.js |
| IT7 | Heartseeker, the Last Bowshot (unique weapon, hunter) · A longbow strung with a drake's sinew, said never to miss twice. · Equip: your hits sometimes release a burst of magic damage. | draft | X: no drop source is stated; Lead to confirm whether a class weapon can drop in the demo | content/uniques.js |
| IT8 | Starfall Staff (unique weapon, mage) · A staff of black glass that blazes against the great and the proud. · Equip: more damage against elites and bosses. | draft | X: no drop source is stated; Lead to confirm whether a class weapon can drop in the demo | content/uniques.js |
| IT9 | Whisperfang, Veil-Cutter (unique weapon, rogue) · A thin blade that sings only when drawn in shadow. · Equip: your hits sometimes release a burst of magic damage. | draft | X: no drop source is stated; Lead to confirm whether a class weapon can drop in the demo | content/uniques.js |
| IT10 | Harrowbane Greaves (unique epic, zone 1) · Taken from a deserter's corpse, they seem to renew with each kill. · Equip: heal a little each time you kill an enemy. | draft | X: unique epics drop only with the hall entry Relics, which the demo hall does not sell (demo spec 3.2); the line cannot show | content/uniques.js |
| IT11 | Boundarystone Charm (unique rare, zone 1) · A pebble from the first field wall. Each victory warms it. · Equip: heal a little each time you kill an enemy. | draft | X: unique rares drop only with the hall entry Cache, which the demo hall does not sell (demo spec 3.2); the line cannot show | content/uniques.js |
| IT12 | Mistwalker's Hood (unique epic, zone 2) · Fog clings to this hood and shrugs off the first blow. · Equip: begin each fight behind a small ward. | draft | X: unique epics drop only with the hall entry Relics, which the demo hall does not sell (demo spec 3.2); the line cannot show | content/uniques.js |
| IT13 | Reedlight Lantern (unique rare, zone 2) · A fen lamp that steeps every draught in swamp-warmth. · Equip: potions heal more. | draft | X: unique rares drop only with the hall entry Cache, which the demo hall does not sell (demo spec 3.2); the line cannot show | content/uniques.js |
| IT14 | Healing Draught · Restores 35 % of your maximum health. Shares a 4-round cooldown with other draughts. | draft |  | ui/mock-data.js |
| IT15 | Mana Draught · Restores 35 % of your maximum mana. Shares a 4-round cooldown with other draughts. | draft |  | ui/mock-data.js |
| IT16 | Trail Rations · Out of combat: restores 40 % of health, mana and pet health. | draft |  | ui/mock-data.js |
| IT17 | Purifying Tonic · Removes every debuff on you, including Brand stacks. | draft | U: "Brand stacks" is Oruvath's status; the demo player never sees a Brand | ui/mock-data.js |
| IT18 | Spark Flask · Throw it: magic damage to every enemy. | draft |  | ui/mock-data.js |
| IT19 | Elixir of Ferocity · +10 % damage for the next 3 nodes. | draft | M: "nodes" here, "places" in the Dimming lines | ui/mock-data.js |
| IT20 | Ember of Return · Carried: when you die, you return at once with 40 % health. One at a time. | approved D150 item 13 (name) |  | ui/mock-data.js |
| IT21 | Item tooltip: {Slot} · Item level {n} · {n} Armor · +{n} {Stamina/Agility/Intellect/Spirit/Power/Critical strike/Weapon damage} · ▲ Upgrade (+{n} item score) · ▼ Weaker than {item} ({n}) · Same item score as equipped · ▲ Empty slot: an upgrade · Not an upgrade: {stat} is the {class}'s main stat · Right-click to equip · click for options · Right-click to use · drag to the item bar · Sells for: {price} · Stack: {n} / {m} | approved D150 item 12 (item level word) | U: "item score" is a second word for the item's worth, next to "item level"; "Spirit" and "Weapon damage" are not explained | ui/tooltip.js, ui/windows.js |
| IT22 | Loot window: Take all · Continue · Waiting in the loot window: equip, take or drop it · Click or Equip now: put it on · Leave {n} item(s) behind? Click Leave again. · left behind · Click to choose this reward · Equip now: choose it and put it on · {giver} says: · “{done line}” · Quest complete: {title} · Contract complete: {title} · Story complete: {title} | draft | R: "Leave" twice (button and its confirmation); fine; U: "Story complete" has no earlier meaning | ui/screens.js |
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
| LV8 | +{legacy} Legacy points at the end of the run. | draft | U: "at the end of the run"; the first time a player sees Legacy points; no earlier line explains them | content/texts.js |
| LV9 | Level {from} → {to} | draft |  | content/texts.js |
| LV10 | Level 20: your other talent trees can open in the Legacy hall. | draft | X: cannot occur under the demo cap (level 7); demo spec 4.1 hides it | content/texts.js |
| LV11 | Level 25, the highest. From now on every {xp} XP pays {legacy} Legacy points. | draft | X: cannot occur under the demo cap; demo spec 4.1 hides it | content/texts.js |
| LV12 | You have reached level {n}! · New at the trainer: {spells} · +1 talent point / +{n} talent points · Welcome to {zone}. Visit the trainer, then set out. · You arrive in {zone}. | draft | R: "reached level" and the banner title say it twice; "New at the trainer" and "New spell: … Learn it at a trainer." say it twice | ui/director.js |
| LV13 | HUD bar: Level {n} · {xp} / {next} XP ({p} %) · Rested: {n} (kills give double XP) · Level {n} · maximum level | draft | X: "maximum level" is the full-game cap (25); the demo adds "Level 7: the demo's highest" (to come, DM1) | ui/hud.js |
| LV14 | Hero rest lines: You rest. Health and mana restored; you feel rested. · You rest by the fire until the ache leaves your bones. · {n} XP: kills give double experience | draft | R: "rested" in three ways | ui/director.js, ui/screens.js |

## SU Run summary (every run end)

The screen after a run: "The run has ended" (death or Abandon, or the demo exit). Rows below are from buildSummary. Under Legacy, "Echoes" shows as "Legacy points".

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| SU1 | The run has ended · {Name} has fallen / Your {class} has fallen / {Name} left the run · {Name} · level {n} {Class} with {pet} · {zone} | draft | X: the demo exit is not a death; its heading is "End of the demo" (to come, DM1) | ui/screens.js |
| SU2 | The journey: Reached · Hero · Level {a} → {b} · +{n} XP · {n} / {m} XP to level {n} · Time · Fights {n} ({n} rounds) · Oruvath · Base strength: no tolls overspent · Play time · about {n} min by hand, {m} with autoplay · Seed | draft | X: demo spec 4.1 hides Seed, Play time and the Oruvath row; "Oruvath" in a demo run names a boss the player never meets | ui/screens.js |
| SU3 | Death rows: Killed by · {enemy} ({ability}) · Where · {node}, round {n} · Ended · Abandoned from the menu | draft |  | ui/screens.js |
| SU4 | Deeds: Kills · {n} normal · {n} elite · {n} rare · {n} boss · Quests · Contracts · {n} of {m} completed · {n} expired · {n} given up · Dungeons cleared · Gold · earned {n} · spent {n} · Potions used · Times revived · Damage · dealt {n} · taken {n} · Top spells | draft | N: "Times revived"; the revive is the Ember of Return; the line should name it | ui/screens.js |
| SU5 | Legacy lines (card heading "Echoes earned"): The Bellwrights' welcome · Hero levels gained · Zones completed · Dungeons cleared · Elites slain · Rares slain · Quests completed · Fights won Burning or Infernal · Contracts completed · Total · {n} Echoes · Your Echoes after this run | draft | U: "The Bellwrights' welcome"; who the Bellwrights are is never said | ui/screens.js, ui/ui-text.js |
| SU6 | Kept: level {level} (was {was}) · spells and ranks · talents · Legacy unlocks | draft |  | content/texts.js |
| SU7 | Left behind: gear, gold, potions and camp points. Your next run starts with the Wayfarer's kit. | draft | N: "the Wayfarer's kit" appears nowhere else in the player text | content/texts.js |
| SU8 | You have {legacy} Legacy points. Next in the hall: {next}, {cost}. | draft |  | content/texts.js |
| SU9 | You have {n} Legacy points. Every entry in the hall is yours. · Echoes buy lasting unlocks between runs. {N} unlock(s) within reach. · Echoes buy lasting unlocks between runs. Keep them for the next one. | draft | R: says what the card heading says; X: "Every entry in the hall" will read as the full hall (the demo hall has 7); the demo's own line is "You own every unlock in the demo." (to come) | ui/screens.js |
| SU10 | Summary buttons: Begin a new run (tooltip: Back to class select. Your Echoes are kept: the Hall of Echoes is there too.) · Spend Echoes (tooltip: Hall of Echoes · Spend the Echoes of this run and the runs before on lasting unlocks. · {n} Echoes · {n} unlocks within reach · Then choose your next hero.) | draft | R: the word "Echoes" four times in two tooltips; the demo spec asks for "Next run" and "Legacy hall" | ui/screens.js |
| SU11 | Nudge, first summary: Your first unlock is ready: Packed Satchel. | draft |  | content/tutorial.js |
| SU12 | Furnace card on the summary (see FU11). | draft |  | ui/heat.js |

## HL Legacy hall (the demo hall of seven entries)

The hall opens from hero select and from the summary. In the demo it lists exactly seven entries at rank I (demo spec 3.2, prices from hall v3d, D167, draft). The card line is the "short" text, the tooltip the "long" text, from ui-text.js metaEffect.

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| HL1 | Packed Satchel · 50 Legacy points · Start with 3 Healing Draughts; first potion each fight is free, at half strength · Every run begins with three Healing Draughts in your bags, and the first potion you drink in each fight is a free action at half strength. | draft |  | ui/ui-text.js |
| HL2 | Vigor of the Line I · 70 Legacy points · +3 % max health, then +1 % · Every hero starts with 3 % more maximum health with rank I and 1 % more with rank II (4 % in all). | draft | X: the line names rank II, which the demo hall does not sell | ui/ui-text.js |
| HL3 | Edge of the Line I · 70 Legacy points · +2 % Power, then +1 % · Every hero has 2 % more Power with rank I and 1 % more with rank II (3 % in all): more damage from every attack and spell. | draft | X: the line names rank II, which the demo hall does not sell | ui/ui-text.js |
| HL4 | Quick Study I · 80 Legacy points · +5 % experience per rank · Every hero earns 5 % more experience for each rank: levels come sooner. | draft | X: "per rank" with only rank I on sale | ui/ui-text.js |
| HL5 | Deeper Pockets · 50 Legacy points · +8 bag slots per rank · Your bags hold 8 more items for each rank. | draft | X: "per rank" with only rank I on sale | ui/ui-text.js |
| HL6 | Cartographer · 60 Legacy points · Free Region Charts every run · Every run starts with Region Charts: each zone map shows every node's region and where the dungeon is. | draft |  | ui/ui-text.js |
| HL7 | Quartermaster I · 70 Legacy points · +2 camp points per rank · On the expedition map you have two more camp points to spend at the start camp for each rank. | draft | X: "per rank" with only rank I on sale | ui/ui-text.js |
| HL8 | Hall header and lines: Legacy hall · Legacy points from every run buy lasting unlocks. Each applies from the start of your next run. · Earned {n} · spent {n} · {N} unlock(s) within reach · {n} of {m} rank(s) owned · Your next run: {text} · Nothing yet. Every unlock you buy shows here, and applies from the first step of the run. · Needs {req} · You need {n} more Legacy points. · Next rank: {text} · ✓/✗ Requires: {req} · Owned. · From hero level {n} | draft | U: "rank(s) owned" with one rank per entry; "From hero level {n}" lines belong to the wing, which the demo hides | ui/meta.js |
| HL9 | Hall balance tooltip: Every run earns Echoes: for levels, zones, dungeons, elites and quests, and for facing Oruvath. They buy lasting unlocks here. | draft | X: "and for facing Oruvath"; no demo run reaches him; this is the full-game list | ui/meta.js |
| HL10 | Hall history: {n} run(s) ended, {n} with Oruvath defeated. · Every run earns Echoes. The first victory with each class adds +{n} Echoes. · First-kill bonus ✓ · {n} runs · best level {n} · The first {class} to defeat Oruvath earns +{n} Echoes. · First-kill bonus claimed (+{n} Echoes). | draft | X: Oruvath and the first-kill bonus cannot happen in the demo; every one of these lines would read "0 with Oruvath defeated" | ui/meta.js |
| HL11 | After a buy: +{n} Echoes from {hero}'s run · Now open: {names}. · Next run: {text}. · Swear them on class select. | draft | X: "Swear them" is the Oaths line; Oaths are not in the demo hall | ui/meta.js |
| HL12 | Vendor/hall nudge: Buy Packed Satchel: {n} potions every run, and your first potion each fight costs no turn. | draft | R: "{n} potions every run" repeats the card line | content/tutorial.js |
| HL13 | Hall refusal for an entry not in the demo: not in the demo | to come |  | docs/specs/demo.md 3.2 |
| HL14 | Next in the hall (demo, all owned): You own every unlock in the demo. | to come |  | docs/specs/demo.md 3.2 |

## ST Menu and settings

The window "Menu and settings". The Dev tools row, the Classic map setting and the mode chip are not built in a demo (demo spec 2.3).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| ST1 | Abandon run · Ends this run where your hero stands, as a death. Your hero keeps its level and the run pays its Legacy points. · Abandon run: click again · Abandon this run? You keep your level, XP and spells. Gear, gold and camp points are lost. Legacy points pay only for what you did. Click again to end it. | draft | R: "Abandon" four times in one row; the note and the confirmation tell the same thing twice (kept: level) | ui/windows.js, content/texts.js |
| ST2 | Animation speed · Space or a click skips to the end of the hit on screen. A key pressed while a round plays is queued as your next action. · 1× 2× 4× Instant | draft | U: "queued" is a programming word | ui/windows.js |
| ST3 | Speedrun mode · Instant animations, no travel scenes, fast autoplay. · Skip travel scenes · Autoplay pace · Pause between autoplay rounds. · Calm Normal Quick Rush | draft | R: "no travel scenes" and "Skip travel scenes" say the same twice | ui/windows.js |
| ST4 | Screen shake · Reduce motion · No screen shake, smaller recoil, numbers without the slam. · Combat log | draft | R: "Reduce motion" says "No screen shake", which is the row above | ui/windows.js |
| ST5 | Hints · One short line the first time you meet something new. · On / Off · First-time hints and the guide · Reset hints · Play the guide again · Every first-time hint shows again. · This run is the guided run. · Your next run is the guided run. | draft |  | ui/windows.js |
| ST6 | Mute sound · Sound starts with your first click or key. Everything it tells you is also on screen. · Volume · Master {n} % · Effects {n} % · Interface {n} % | draft |  | ui/windows.js |
| ST7 | Keys: 1–7 Spells · 8 9 0 Items · A Basic attack · Tab Next target · Z Autoplay · F F Flee · X Pass · Space Skip a hit / take loot · C B P Character, bags, spells · N L M Talents, quests, map | draft | U: three keys on the hint line may differ; see GR hints (the T/N key) | ui/windows.js |
| ST8 | Footer: Engine: {engine} · build {build} | draft | X: developer text; "Engine: engine" means nothing to a player; hide it in the demo | ui/windows.js |
| ST9 | Window titles and tabs: Menu and settings · Character · Bags · Spellbook · Talents · Quest log · Map · Vendor · Trainer · Loot | draft |  | ui/windows.js |
| ST10 | Start over · Start over? Your heroes and Legacy unlocks are deleted. | to come |  | docs/specs/demo.md 2.4 |
| ST11 | This browser window cannot save your progress. | to come |  | docs/specs/demo.md 2.4 |

## DM Lines the demo adds (not built yet: "to come")

From docs/specs/demo.md 1.3, 1.4, 2.4, 3.1, 3.2. Every line is a draft for the owner. The demo-end screen may hold at most 80 words beyond the summary lines (DEMO_END_MAX_WORDS).

| ID | Text | Status | Flag | Source |
|---|---|---|---|---|
| DM1 | Heading: End of the demo | to come |  | docs/specs/demo.md 1.4 |
| DM2 | You made it through Amberfold Downs and Greywater Fens. | to come |  | docs/specs/demo.md 1.4 |
| DM3 | So far: Runs: 4 · Vex, Rogue, level 5 · Maren, Hunter, level 3 · Legacy hall: 3 of 7 unlocks | to come | U: "Runs: 4" and the hero list read as a table; "unlocks" is a word the hall card uses ("within reach") | docs/specs/demo.md 1.4 |
| DM4 | Kept: level 5 (was 4) · spells and ranks · talents · Legacy unlocks · Left behind: gear, gold, potions and camp points. Your next run starts with the Wayfarer's kit. | to come | U: the second sentence is the content run_left line (SU); "Wayfarer's kit" is not explained | docs/specs/demo.md 1.4 |
| DM5 | At the cap only: Vex has reached level 7, the highest level in the demo. | to come |  | docs/specs/demo.md 1.4 |
| DM6 | The full game goes on past Greywater Fens: four more zones, the Camp and Oruvath. | to come | U: "the Camp" and "Oruvath" are new words on the last screen; the player has not met either (D150 allows "Oruvath" only after the first mention). M: "four more zones" fixes the count | docs/specs/demo.md 1.4 |
| DM7 | Buttons: Next run · Legacy hall | to come |  | docs/specs/demo.md 1.4 |
| DM8 | Word count of the demo block as listed above (with the content line "Your next run starts with the Wayfarer's kit."): 86 words; without it 78. Limit: 80 | to come | B: 86 words with the Wayfarer sentence (over by 6); 78 without it (within 2 of the limit, and a three-hero list or a longer name pushes it over) | docs/specs/demo.md 1.4 |
| DM9 | Zone 2 leave line: Leaving Greywater Fens ends this demo run. You keep your levels and Legacy points. | to come | X: the existing leave dialog says "No way back to Greywater Fens" and, in zone 2, "the hub of Highcairn Reach"; the new line has to replace them, not sit beside them (see MP22) | docs/specs/demo.md 1.3 |
| DM10 | Level 7: the demo's highest (XP bar of a capped hero, hero select and HUD; the banner to level 7 adds it once) | to come |  | docs/specs/demo.md 3.1 |
| DM11 | Contract board bands from run 3: zones 1-2 only (no text change) | to come |  | docs/specs/demo.md 4.3 |
| DM12 | Road tooltip in zone 2 (and the leave confirmation) carry the line of 1.3; node chips do not | to come |  | docs/specs/demo.md 4.3 |

## Method and limits

- Built by reading src, not by playing the build: content tables are loaded from src/content, UI strings are copied from src/ui. A line that is built from several strings (a tooltip) is one row. The wording of a screen may differ slightly where the UI joins pieces at run time.
- Spells and talents are listed for hero levels 1 to 7 on the Legacy scale (R.learnLevel). Talent tiers above 1 need four points already spent in the tree, so they cannot be bought by level 7 and are left out.
- Left out: lines of zones 3 to 6, the Camp and Oruvath, the Dev menu, the mock engine, the classic map, Oaths, Lost Techniques and the level-20 wing (none of them can show in the demo).
- Numbers: the hero cap is the demo spec's proposal (7); the code has no demo cap yet. The hall prices are hall v3d (D167, draft).
- The demo spec asks for a blind panel (D.7) and owner sign-off (D.8); this list is the input to D.5, not its result.
