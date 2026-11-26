#!/usr/bin/env node
/**
 * qa/browser/ui-regress.mjs - regression checks for the UI bugs fixed on 2026-11-09
 * (qa/bugs.md BUG-QA-01, 02, 03, 04, 05, 08, 09, 10, 11), for the M2 v2 UI changes (docs/specs/changes-m2-v2.md:
 * map rows from the engine, travel on early, Linked per Shard, the round time budget) and for the M2 v3 UI changes
 * (docs/specs/changes-m2-v3.md: zone danger, Second Breath not in the final fight, Ricochet Bolt at 40 %).
 *
 *   node qa/browser/ui-regress.mjs [--file <build>]   (no --file: builds /tmp/tbwcr-<worktree>/game.html from src/ first, build-path.mjs)
 *   node qa/browser/ui-regress.mjs [--sizes 1366x768,1920x1080] [--shots dir] [--parts A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,AA,BC]
 *
 * Every check drives the game's own controls: mouse clicks, hovers and keys on buttons, cards, map nodes,
 * the action bar, the bags and the Autoplay switch. window.__ui is used to read the view and to wait for
 * animations. As setup only, it also reaches late states fast: the camp (the engine's autoplay choices
 * through the AUTO helper, as tools/ui-check.mjs does) and, for the victory banner, a boss fight in the
 * mock engine (DEBUG_JUMP), because no seed of the real engine wins the boss fight today.
 *
 * Parts, each in a fresh browser context, for every size:
 *   A  real engine, seed 30 Hunter at 1x speed: vendor, item bar, the map (the engine's rows and lanes, the
 *      travel button before the travel level), map tooltip and labels, a fight played with keys A and 8, the
 *      Autoplay switch and key Z, quest reward, equip from the bags, the clock.
 *   B  real engine, a Hunter seed chosen at run time (bPick) at Instant speed, the engine's autoplay choices up to the camp: the clock
 *      across midnight, the travel button at every map step (and its tooltip when leaving early is legal), the
 *      camp panel, the bag menu at the right edge, an item used out of combat, Face Oruvath, and the boss fight
 *      played on the Autoplay switch with the Linked strength on the boss frame.
 *   C  mock engine, Mage at the boss at Instant speed: autoplay (key Z) to a victory; no banner over the summary.
 *   D  real engine, seed 9 Hunter at the default speed: manual rounds (the keys of the autoplay policy's choices) within
 *      PACE_ROUND_ANIM_S (D52: at 1920x1080 only the median is held to the round cap, headless rendering is slow there), an action key and a click during enemy animations finish them, and 2x, 4x and Instant from
 *      the settings window (setup outside fights: the engine's autoplay choices).
 *   E  real engine, seed 8 Hunter with a stored profile that holds Second Breath and Lost Technique I (Ricochet Bolt),
 *      at Instant speed, the engine's autoplay choices up to the camp: the resurrect badge and the character sheet in
 *      zone 1, at the camp and in the boss fight (only the charges that work there, Second Breath named as not working),
 *      the death screen when the hero dies at the boss with Second Breath unused, the Ricochet Bolt tooltip (spellbook),
 *      and zone danger in the zone banners, the minimap tooltip and the map tooltips of zone 3. Expected numbers come
 *      from the engine: a Node run of the same seed and profile (resurrectCharges, spellInfo, summary) and zoneDanger.
 *   F  M3 meta progression, real engine at Instant speed. A stored profile (Vigor of the Line, Wayfinder from the older catalogue, 70 Echoes,
 *      two earlier runs) and a Hunter run on the engine's autoplay choices to its death (the shortest such run of seeds
 *      1-80): the summary's balance after the run, "Spend Echoes" opens the Hall of Echoes, the balance and the run log,
 *      every offer of R.metaOffers in its kind's group with rank, cost and state, tooltips, buying Packed Satchel (UI,
 *      saved profile, Alchemist's Notes opens), Esc and the Echoes button, and a new run (seed typed in) that starts
 *      with the unlock (bridge view = a Node START_RUN with the bought profile). Then a profile after a first victory:
 *      Oaths bought for 0, the Oath switches on class select (SET_OATH), the Echo multiplier and the run's Oaths.
 *   G  M2 v4, real engine at Instant speed. A stored profile from the older catalogue (Wayfinder, removed in M2 v4) that
 *      owns the Oaths; class select with the Oath of Haste sworn; the run on the engine's autoplay choices: the first
 *      Travel on (tooltip cost and the tolls spent = TIME_TRAVEL, as a Node run), then the camp: the par on the camp
 *      panel, the tracker and the minimap tooltip is the engine's bossPar (Oath of Haste included), and the Ascendancy
 *      line is the engine's. The seed is chosen at run time (seeds 1-60 whose Node run reaches the camp; preferably one
 *      whose Ascendancy comes from the Oath alone: at least ASC_STEP_TIME past bossPar, less than that past BOSS_TIME_PAR).
 *   H  combat v2 display (docs/specs/combat-v2.md 10, M2b 2b.6), real engine at Instant speed. Hunter seed 16: the engage
 *      panel in round 1 only (the class's options from R.engageOptions and "any bar spell"), the opening ruler, every
 *      nameplate's and the target frame's track (INTENT_TRACK_LEN entries as the engine has them: a Node twin replays the
 *      page's engine actions, window.__ui.engineLog), the Lay Trap hover preview (= R.engagePreview), key W, and the trap's
 *      off-balance window: the marker and the bar's window highlight exactly where R.offBalance and R.spellInfo(...).window
 *      say. Mage seed 30: Pre-cast's spells, and Binding Glyph's FROZEN window (frost marker, bar highlight).
 *   I  the Heat meter (docs/specs/expedition.md H.4, H.5; engine-api.md 11; M2b 2b.6), real engine at Instant speed. A
 *      Hunter on a slow policy (every hub service, the reachable node that is no elite or dungeon with the most tolls, the
 *      most Grind waves; the engine's autoplay otherwise) to the summary. At the first hub and at the first map step in Warm, Hot and
 *      Scorched the meter (state, "N h in hand" / "N h past the line", "Boss +N %", the marker and the Star's line, the pay
 *      line) equals R.heatView of a Node twin (window.__ui.engineLog), and every service card and reachable node (and Travel
 *      on) shows R.heatPreview in its toll label, its tooltip and the meter's ghost; a node entered Hot has its badge and
 *      "This node pays Hot"; a toast and a log line come with every change of state; with every window open over the map
 *      and on every kind of screen met (hub, services, map, dialogs, fights, loot, camp, boss) the meter is in view and on
 *      top; the camp panel, tracker and minimap name heatView's par and Ascendancy; the boss frame's Ascendancy is the
 *      meter's "Boss +N %"; the summary's heat card (track points per zone record, tolls by state, over par) and the Echo
 *      line "Fights won while Burning or Infernal" match the engine's summary; loot marked "raised by heat" came from Hot or Scorched nodes.
 *      Then an expedition run (?expedition=1): the Dimming's marker and "Dimming: N tolls" at the hub, a move's preview, and
 *      a map step where the Dimming sets the state (marker, "· Dimming", the meter's tooltip) = heatView. Both seeds are
 *      chosen at run time on Node runs of the same choices (the UI's own item-bar actions included).
 *   J  combat v2.1 display (docs/specs/combat-v2.md 16, 10.9; M2b 2b.6), real engine at Instant speed, a Hunter seed chosen
 *      at run time (jPick: Node runs of the same choices). Stacked toasts on the map: the same message merges ("×3"), at most
 *      two show at once, a queued one follows, none covers the zone map. (A) an elite's engage round: the wind-up badge on
 *      exactly the track entries the engine flags `windup` (nameplate chips, target frame) and the line over the enemy
 *      ("Wind-up R3: answer it or it empowers"), the ruler's "Wind-up", each engage card's answered wind-ups = R.engagePreview
 *      (stagger; Send the Pet on a heavy one), the wind-up's tooltip (round, stakes from EMPOWER_DMG and STAGGER_DMG, what
 *      answers it) and the bar spells marked on hover; key W (Lay Trap): ANSWERED where the engine predicts cancel.stagger,
 *      then the STAGGERED badges (nameplate, target frame) = the engine's status and the log line. (B) a later fight where
 *      the Hunter passes: the wind-up lands, EMPOWERED badges = the engine's status, the log line. (C) a dungeon boss: its
 *      wind-up's tooltip (immune to control: an interrupt, a stun or control spell, or Disrupt), Lay Trap shows as Disrupt
 *      exactly as R.engageOptions says, key W logs the wind-up it stops, STAGGERED after it; then the same engage round
 *      loaded with no wind-up in view (window.__ui.loadState; the real content never shows a dungeon boss without one):
 *      greyed out with the engine's reason. After every combat key the bar marks exactly the usable spells that can answer
 *      a wind-up playing now (none without). Stacked toasts in a fight, and in the end-boss fight (jBossState: phase 2 with
 *      two Shards, a Shard targeted, loaded): merged, clear of the boss frame, the target frame, the ruler and nameplates.
 *      (D) a Rogue (jPickRogue: a seed whose autoplay run meets a wind-up playing while a bar spell can stop it): the bar
 *      marks that spell "Answer" as the engine's state says, hovering the wind-up marks every spell that can answer it,
 *      the spell's tooltip names the wind-up, and its key stops it ("is stopped by your ...", STAGGERED = the engine's).
 *   K  the Dev menu (owner feedback 2026-11-11; docs/specs/engine-api.md 12), real engine at Instant speed, seed 4: the corner
 *      button in view and clear of the minimap, the backquote key opens the menu fully in view; Start at (Mage, zone 4,
 *      level 35, the menu's own fields), Jump to the boss in phase 2, Fight an elite of zone 4 found by its id in the search;
 *      after each the view says so and the page's state equals a Node twin that replays the page's engine log
 *      (window.__ui.engineLog: R.debug for the dev ops, R.step for the rest; window.__ui.state = R.serialize); god mode
 *      from the World tab; the key closes it; ?dev=0 and the setting hide the button and the key. No console errors.
 *   L  owner feedback 2026-11-11 (08:03, 08:11, 08:14, 08:31), real engine at Instant speed. (1) the DoT preview: a level-11
 *      Hunter (Dev menu) casts Barbed Arrow; a set-up state (window.__ui.loadState) with DoTs on both enemies (one lethal),
 *      the player and the pet: every HP bar (nameplates, target frame, player and pet frames) marks R.pendingTicks of a Node
 *      twin exactly (data-dot, hatched width), the skull only where lethal, the tooltips' numbers and names; after Pass the
 *      lethal enemy is dead. (2) talent totals: Silent Footing clicked to 1/3 and 3/3 ("Now: +10 %", "Next rank: +20 %";
 *      "Now: +30 %", "Max rank"), Toxic Coating's formula, all = R.talentInfo; every one-percentage talent text states the
 *      engine's number. (3) the first-fight hint: the Rogue's first engage round lists Ambush, Sap, Premeditate on Q, W, E
 *      beside the panel, covering nothing; since M3 hint H01 on the coach line: "Got it" stores it (tbwcr.hints.v2 seen
 *      H01:rogue; a wind-up's H03 may come first, higher priority), a new Rogue run has none, a first Mage run
 *      has it until W. (4) a Healing Draught pulses at 30 % health, not at 50 % or on cooldown, and is never drunk for the
 *      player. (5) "Killed by" names Crown-Breaker, not its id; every content ability reads by its name. (6) the settings
 *      window shows Animation speed's four choices whole.
 *   M  the start camp and the contract tracker (docs/specs/expedition.md 9.1, 9.3; engine-api.md 13; M2b 2b.6), real engine
 *      at Instant speed, ?prep=1, seed 7. Class select's Enter opens the camp and a second Enter at once does not set out;
 *      the prep screen's numbers (points left, each offer's zone, price and sites, each option's price, bought and owned
 *      state, the held list, Reserve = N points = M Echoes) equal R.prepView of a Node twin (the page's engine log) after a
 *      click and the keys 2, A, C, R (no reroll: D128), a drop, a sell, a buy and key 3; D128 (a lean camp): 3 cards side by side
 *      and at most 4 options, no reroll button, a card's headline, one line of what to do and the pay in one line; Set out,
 *      every card and option fully in view; a contract's
 *      and an option's tooltip; Enter sets out (contracts and Reserve = R.contractView); on the map the tracker shows this
 *      zone's contracts (title, "N / M sites") clear of the zone map, site marks on exactly mapView's nodes, hidden ones
 *      unnamed; the quest log lists every contract; zone 2's hub (Dev menu Start at) shows its offer and Take pays from
 *      Reserve. Then seed 1 on the engine's autoplay choices to a completed contract: its reward window (title, +XP and gold
 *      = the engine's events, the item cards) and the choice. No console errors.
 *   N  the fog map (docs/specs/expedition.md 4-6, 9.2; M2b 2b.6; D128: icons about 70 %, text labels only on the player's
 *      node, the reachable nodes and contract sites, a quiet node's clock as its number), real engine at Instant speed, ?prep=1, seed M_SEED with
 *      Region Charts: every node's fog state (seen, remembered, type known, unknown), level, enemy count, site marks and moves,
 *      the region tints and rim names, the Roads' signposts, the Shardfall, the Dimming's wash and "dims in N" clocks = R.mapView
 *      of a Node twin (nothing the view hides is drawn); the disc round, in view and readable; again once the Dimming spread.
 *   O  the character sheet's Damage block (owner feedback 2026-11-11 11:58): bonus, main attack and pet ranges and averages, the
 *      Power and Weapon damage hovers = R.damageView of a Node twin, Hunter and Mage, at the hub and in a fight.
 *   P  the Deathblow (docs/specs/changes-m2b-v13.md "UI needs"; engine-api.md 6.2), real engine at Instant speed, Dev menu fights
 *      against the zone-2 elite Bargh the Drowned King; every number from a Node twin of the page's engine log (R.windupView,
 *      R.autoplayEngage, R.potionInfo, the statuses). Hunter: in the engage round the Deathblow's badge over the enemy (round,
 *      estimate, "MAIMS if it lands"), its chip, row and ruler round = windupView; the engage cards that answer it and the
 *      answers named on the badge = windupView's engage answers (keys, sure); the autoplay hint = R.autoplayEngage; round 2:
 *      "No answer ready" in red (ready false); landed: MAIMED on the player frame, the potion's cut amount on its button and
 *      tooltip = R.potionInfo (half the amount before), "Deathblow +100 % dmg" on the nameplate and target frame, the log line.
 *      Rogue: Sap marked a chance, Throat Jab kept for round 3 ("R3"), then answering now; its key answers it ("Deathblow
 *      answered"). The map tooltips of elite and dungeon nodes name the Deathblow and its kind = mapView. A loaded state with
 *      a first meeting shows "New" on that enemy only. M2b v14 (changes-m2b-v14.md "UI needs" 1-3): against the lone elite
 *      Sap's card reads "Sure if you wait: ..." (windupView `wait`); the Rogue's autoplay hint "..., then wait a round"
 *      (autoplayEngage `wait`); after Sap, round 2's Pass button has the answer ring, the line names "X Pass" and the prompt
 *      says to wait; X: Sap cancels the Deathblow and the Rogue stays in STEALTH; a hidden elite's map line has its type only.
 *      QA 2026-11-12 (playtest findings 2, 3, 4, 8): in that waiting round the chip, the row and the ruler say "If you wait"
 *      (the row "answered if you wait"), not ANSWERED, the line and the prompt warn "Attacking breaks Sap: the Deathblow will
 *      land", the attack button is marked "Breaks Sap"; once Sap cancels it, no "If you wait". A loaded state with health
 *      under the Deathblow's estimate and MAIMED: LETHAL on the line, the chip, the row and the prompt, whose heal hint names
 *      the potion's cut amount (R.potionInfo); none when the estimate is under health. A Deathblow aimed at the pet (loaded
 *      state): "MAIMS you if it hits your pet" on the line, the row and the alert (the engine lands it on a pet hit, s07d).
 *      At speed 1, a landed Deathblow's "Deathblow landed: empowered" and "Maimed: healing −50 %" sit in their own lane and
 *      overlap no damage number, pet number, Dodge or other float shown at the same time (window.__ui.floats()).
 *   Q  sound (docs/specs/audio.md; D127), real engine, the cue log of window.__ui.audio() and a count of AudioContexts made.
 *      Before any gesture (steps sent through window.__ui only): a new run to its first level-up and a Deathblow that lands
 *      on a Hunter log levelUp, deathblowTelegraph (once, before it lands), deathblowLanded and maimed, and nothing sounds:
 *      no AudioContext, every entry sound false. Then a click: the context exists, uiClick sounds. A Rogue answers the
 *      Deathblow (deathblowAnswered); in god mode at 4x, attacks until a crit and a kill (hitLight or hitHeavy, crit, kill,
 *      all sounding); a Mage passes until it dies (playerDeath). Every Instant step keeps at most one cue that is not a
 *      Deathblow cue or the death. The Dimming (cue 10): a Rogue's expedition run in zone 1 logs dimmingSpread in exactly
 *      the steps where the front reached new nodes near the player (the rule worked out from the two map views), and it
 *      sounds unless a higher-ranked cue of the same Instant step won. No console errors.
 *
 *   R  the guided first run and the first-time hints (M3 3.5; m3-onboarding.md 2.4-2.7, 3, 4.3, 7.1): see partR. The parts
 *      before R open with the guide off (?guide=0) and the hints off (tbwcr.hints.v2), part L(3) with hints on (H01).
 *      R(6)-(7), D142 (M3 3.7, playtest-2026-11-13 findings 2-5): G3's key, the turn prompt under a coach line, a refused
 *      key's reason, the Mage's "Q then N", a hint seen after two showings. D147 (docs/handoffs/engine-2026-11-14.md 6):
 *      R(1) G7 and G8 together in S3's engage round on G8's joint line (its ring on the W button, a second marker on the
 *      wind-up badge), R(2b) the rescue cap's line, R(8) Got it on the joint line and following it.
 *   S  M3 3.7: the D143 UI to-dos and the blind tester panel of 2026-11-13 (D144; docs/handoffs/ui-2026-11-13d.md items
 *      1-10) and the UI needs of docs/handoffs/engine-2026-11-13d.md (checks D144-n): see partS.
 *   T  D150, the text pass (owner 2026-11-14; docs/feedback/2026-11-14-blind-wording.md section 4 items 1-25, section 7 and
 *      the naming rule): the visible word counts of the first engage round and of the map at rest (under T_ENGAGE_MAX and
 *      T_MAP_MAX), the Furnace hidden until its coach line in a guided run and its one line, the Deathblow's one instruction
 *      in the turn prompt, the stopped line and its one status chip, the cards, the map's "Pass through" by mouse and by
 *      keyboard, the hub Trainer card, the Bell's ask, the loot rows, the first run's start camp (one contract, "Supplies"),
 *      the trainer's window (its line, "Level N ·" only on spells not known, Train all with its cost): see partT. The parts
 *      before T now expect the texts of D150 (no opening ruler; "stopped", never "answered"; no par, Ascendancy or "the
 *      Star's line") and the engine's D150 moments (engine-2026-11-14d: G7 in fight 1, G3 and G9 silent, G8's own line in S3).
 *   U  blind round 2 (docs/feedback/2026-11-14-blind-*.md; docs/handoffs/ui-2026-11-14e.md): Equip now on the spoils and
 *      chests, the trainer on the level-up banner, autoplay off after a rescue and at a fight in the Dimming, the map's
 *      clicks out of reach, Esc and Key, tooltips (keys, own controls, neighbours), the dungeon's counts, full bags: see partU.
 *   V  blind round 2 leftovers (docs/handoffs/ui-2026-11-14f.md): Packed Satchel's potions on the item bar, the vendor's gear
 *      in view and its card's line, rank-only trainer rows, one ring after Tab, bags compact after closing, a closed chest's
 *      gold not in the purse: see partV.
 *   W  D152 (docs/specs/changes-m3-v2.md; engine-2026-11-14f section 6): a first run's zone 1 (no Bell, no contracts, the held
 *      corridor's lamps, the steady Dimming's panel and tooltip, no contract hints), the dimBack line after a rescue, a first
 *      run's summary, a later run's Bell and tracker, a first run's zone 2 hub: see partW. The first-run camp is in part T,
 *      the bounty window in part R; parts M, N, S4 and the M rewards play a later-run profile (M_PROFILE, runs 2).
 *   X  the newcomer check (docs/feedback/2026-11-15-blind-newcomer.md; docs/handoffs/ui-2026-11-15.md): the Roads' post lines and
 *      rim nodes, the nearest Road's numbers when the Roads open, the pass-through hint at the first red toll label, the
 *      Furnace's line and diamond when the Dimming sets the state, pinned Dimming clocks, the Key's tip, the Bags beside the
 *      Loot window, the skip line under the coach line, the map at once after Set out, the "+N items" note: see partX.
 *   Y  Legacy phase 1 (D154-D157; docs/specs/legacy.md; docs/handoffs/ui-2026-11-18.md), C.GATES.legacy forced on with
 *      ?legacy=1: the profile's migration and the refund note once, Legacy words, hero select, the hero scale on the HUD,
 *      the hub, the map, nameplates, item and learn levels, the level-up banner, the summary's hero line: see partY.
 *      Y6 (D159-D160, Economy v2, part of the ?legacy=1 set): the old hall refunded once, the v2 hall and its level-20 wing,
 *      "camp points", the second camp, the hub offer, the level-up banner, Abandon's line, the run's end: see partY6.
 *   Z  the Legacy bugs of 2026-11-19 (docs/feedback/2026-11-19-blind-legacy-returning.md): the start camp's zone, "marked"
 *      sites, the tracker over a nameplate, Abandon run's summary, the summary's fit and Furnace line, the loot Leave button,
 *      a reward's Equip now on a dimmed node and with full bags: see partZ.
 *   BC demo blind round 1, B and C (docs/handoffs/ui-2026-11-26b.md): the Furnace's first-map note, "Next zone" signs, the
 *      Key's names, the Bell's button, tip and confirm dialog (the chosen action highlighted, no tooltip over it), and a
 *      Dimming fight before the Bell named before the click: see partBC.
 *
 * D116 (the flip): new runs start on the expedition map with the start camp. The parts written for the classic map (A-L, O,
 * P) open the page with ?classic=1 (open() adds it unless the query names a map) and their Node twins pass mapMode 'rows';
 * part I's expedition run (?expedition=1) is the expedition without the start camp (twin prep: false); M and N use ?prep=1
 * and (D150, a first run's board has one offer) a stored profile with one run behind it (M_PROFILE), so their board is full.
 *
 * Seeds were picked with the engine of 3559e0e (M2 v2): seed 30's first quest has two Guardians that last long
 * enough for the potion and Autoplay checks. M2 v3 (77c0ca5): seed 1's autoplay run no longer reaches the camp, so part B
 * moved to seed 51, whose engine autoplay run reached the camp hurt, with Trail Rations, could leave zone 1 early at level 9,
 * and whose boss fight reached phase 2 with 1 to 3 Shards. Seed 63 with the part E profile reached the camp holding a Boon
 * of Return and Second Breath; in the boss fight the Boon returned the hero once, then the hero died with Second Breath unused.
 * Combat v2 (e362fd0) changed every run: part B is now seed 20 and part E seed 8, picked by the same conditions on Node runs
 * of the engine's autoplay choices (seed 20 also passes phase 2 with 1 to 4 Shards). Heat's rarity step (7196e96) changed
 * every run's loot once: seed 20 no longer reaches the camp; seed 1 met part B's conditions again (engineer-2026-11-10f) until
 * the wind-ups of combat v2.1 (0bd5a55); since then part B, like part I, picks its seed on Node runs of the same choices.
 *
 * Prints PASS or FAIL per check with what it saw; exit 1 if any check fails or a page logs an error.
 * Playwright comes from /home/claude/tools-ui (or a local install).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
// the Furnace's player-facing words (changes-m2b-v7.md table D: names, states, whole tolls; UX pass 2026-11-11)
import { HEAT_WORDS, tolls, ECHO_LINE, deathblowKind, deathblowAnswers, sapWaitText, EXIT_WORDS, bellLabel, bellLine, bellCharges, leaveFightLine } from '../../src/ui/ui-text.js';
import { RANK as Q_RANK, DIM_NEAR as Q_DIM_NEAR, RETRIGGER_S as Q_RETRIGGER_S } from '../../src/ui/audio.js';
import { resolveBuild } from './build-path.mjs'; // each worktree builds to its own path (qa.md)
import { MAP_LINES, fillLine } from '../../src/ui/onboarding.js'; // D143: the beat lines that wait for the map on screen
import { trainerWaiting, trainerWaitingShort, BAGS_FULL } from '../../src/ui/ui-text.js'; // blind round 2 (part U); BAGS_FULL: blind Legacy v2
import { TOO_FAR, ROAD_FIRST, vendorMeta } from '../../src/ui/screens.js';
import { MAP_ESC } from '../../src/ui/app.js';
import { nearestRoad, hopsText, UI_HINTS, NEAREST_ROAD_TAIL } from '../../src/ui/ui-text.js'; // newcomer check 2026-11-15 (part X)
import { DIM_NEAR_WORDS, DIM_MARK_LINE, FURNACE_LINE, NOTE_KEY } from '../../src/ui/heat.js';
import { dimAt as dimAtZ } from '../../src/engine/expedition.js'; // part Z: a node dimmed for the reward check
const ONB_HINT_SHOWS = R.C.ONB_HINT_SHOWS; // D142 (3): showings after which a hint counts as seen (src/constants.js since D143)

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = resolveBuild(arg('--file', null));
const SIZES = arg('--sizes', '1366x768,1920x1080').split(',').map((s) => s.split('x').map(Number));
const SHOTS = arg('--shots', null);
const PARTS = arg('--parts', 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,AA,BC').split(',');
const URL = pathToFileURL(FILE).href;
const NEUTRAL = 'rgb(240, 224, 192)'; // label colour of map nodes that hold no fight
const NBSP = /\u00a0/g;
const DB_LINE = 'Has a Deathblow: one huge hit you must stop.'; // D150 item 23: an elite node's Deathblow line
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const R_LINK = { per: R.C.LINK_DR_PER_SHARD, cap: R.C.LINK_DR }; // Linked (rules 10.2, M2 v2)
const SLOWER = 1.4; // owner 2026-11-10: combat at the default speed at least 40 % slower than the M2 v2 round budget
// The M2 v2 round budget (PACE_ROUND_ANIM_S 1.5 s) the owner's "40 % slower" refers to (D47; src/ui/combat-feel.js
// OLD_ROUND_MS). Combat v2 raised PACE_ROUND_ANIM_S to 2.1 s = 1.4 × 1.5 s, so the floor is the larger of the two.
const BUDGET = Math.max(R.C.PACE_ROUND_ANIM_S * 1000, SLOWER * 1500) / SLOWER;
// Steps with these events hold a moment that has its own place in the pacing model (level-up, fight end, boss phase).
const MOMENTS = ['victory', 'levelUp', 'defeat', 'resurrect', 'bossPhase'];
const PROFILE_KEY = 'tbwcr.profile.v1'; // where the game keeps the meta profile (src/ui/engine-bridge.js)
const HISTORY_KEY = 'tbwcr.history.v1'; // the game's run log (src/ui/engine-bridge.js)
const HINTS_KEY = 'tbwcr.hints.v2'; // first-time hints (src/ui/onboarding.js, m3-onboarding.md 3.1)

function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url]) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found (looked in /home/claude/tools-ui and next to this file)');
}
const { chromium } = loadPlaywright();
if (!fs.existsSync(FILE)) { console.error(`no build at ${FILE}: run node tools/build.mjs --out ${FILE}`); process.exit(2); }
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let SIZE = '';
const check = (bug, name, ok, saw) => {
  results.push({ size: SIZE, bug, name, ok: !!ok, saw });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${SIZE}  ${bug}  ${name}${saw ? `\n      saw: ${saw}` : ''}`);
};

// ------------------------------------------------------------------ page helpers
/**
 * A page of the build. profile: a meta profile stored where the game reads it (localStorage) before it loads. D116: new
 * runs start on the expedition map with the start camp; the parts written for the classic map get ?classic=1 here unless
 * the query names a map (prep=1, expedition=1, classic=) or the mock engine.
 */
async function open(browser, W, H, query, profile = null, opts = {}) {
  if (!/(^|&)(prep|expedition|classic|mock|fresh)=/.test(query)) query += '&classic=1';
  // M3 (part R): the parts written before the guided run open with the guide off (?guide=0) and the first-time hints off
  // (tbwcr.hints.v2 stored as off, unless the page stored its own), so their seeds and screens are as before
  if (!opts.guide && !/(^|&)guide=/.test(query)) query += '&guide=0';
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  if (profile) await context.addInitScript(([key, json]) => { try { localStorage.setItem(key, json); } catch { /* storage blocked */ } }, [PROFILE_KEY, JSON.stringify(profile)]);
  if (!opts.hints) await context.addInitScript((key) => { try { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ off: true, seen: {} })); } catch { /* storage blocked */ } }, HINTS_KEY);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`request ${r.url()}`); });
  await page.goto(`${URL}?${query}`);
  await page.waitForFunction(() => window.__ui);
  return { context, page, errors };
}
const idle = (page) => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
/**
 * page.reload() that keeps the page's storage. Headless Chromium now and then (about 1 reload in 100 on this machine,
 * 2026-11-19, docs/handoffs/qa-2026-11-19.md) starts the reloaded page with empty localStorage and sessionStorage, as a
 * fresh profile would: a check that reads state written before the reload then sees the game's first-load path instead
 * (Y-1's refund note shown again). A sentinel tells such a reload apart; then the storage as it was before the reload
 * is put back and the page reloads again (at most 3 tries). Returns the number of reloads that dropped the storage.
 */
async function reloadKeep(page) {
  const token = `${Date.now()}-${Math.random()}`;
  const snap = await page.evaluate((t) => {
    const all = (st) => Object.fromEntries(Object.keys(st).map((k) => [k, st.getItem(k)]));
    localStorage.setItem('qa.reload', t); sessionStorage.setItem('qa.reload', t); return { local: all(localStorage), session: all(sessionStorage) };
  }, token);
  let dropped = 0;
  for (let n = 0; n < 3; n++) {
    await page.reload(); await page.waitForFunction(() => window.__ui);
    // both stores (qa-2026-11-19b): a reload that kept localStorage but lost sessionStorage let openY's init script seed its
    // profile again (Y6a "after a reload: no note" saw the refund note a second time, once in four part Y runs)
    const kept = await page.evaluate((t) => localStorage.getItem('qa.reload') === t && sessionStorage.getItem('qa.reload') === t, token);
    if (kept) break;
    dropped += 1;
    await page.evaluate((x) => { localStorage.clear(); sessionStorage.clear(); for (const [k, v] of Object.entries(x.local)) localStorage.setItem(k, v); for (const [k, v] of Object.entries(x.session)) sessionStorage.setItem(k, v); }, snap);
  }
  await page.evaluate(() => { localStorage.removeItem('qa.reload'); sessionStorage.removeItem('qa.reload'); });
  return dropped;
}
const view = (page) => page.evaluate(() => {
  const v = window.__ui.view();
  return {
    phase: v.phase, time: v.time, autoplay: v.autoplay, step: v.node && v.node.step, round: v.combat ? v.combat.round : null, over: v.combat ? v.combat.over : null,
    hp: v.player && v.player.hp, maxHp: v.player && v.player.maxHp, itemBar: v.player && v.player.itemBar, outcome: v.summary && v.summary.outcome,
    bag: v.player ? v.player.bag.map((b) => (b ? { uid: b.uid, id: b.id, kind: b.kind, name: b.name, count: b.count } : null)) : [],
  };
});
const logLines = async (page) => (await page.locator('#combatlog .lines').innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${SIZE}-${name}.png`) }); };
// M2b v7 (changes-m2b-v7.md A row 10): no day clock; the minimap's clock is empty and hidden at every reading
const clockLabel = () => '';
/** Time labels on screen (toll chips, service and wave labels, the Furnace, the minimap, footers, the tracker): none says "Day N", "N h" or a decimal time. */
const timeLabelsBad = (page) => page.evaluate(() => [...document.querySelectorAll('#heat, #minimap, #tracker, .hrs, .mhrs, .bh, .sfoot, .mfoot, .mhead')].map((el) => el.innerText || '').join(' | ')
  .split(' | ').filter((t) => /\bDay \d|\d h\b|\d\.\d+ tolls?\b|\bhours?\b/i.test(t)));
/** Wait until the fight's round passes `r` (or the fight is over); false on timeout. */
const roundPast = (page, r, ms) => page.waitForFunction((r0) => { const x = window.__ui.view(); return !(x.combat && !x.combat.over) || x.combat.round > r0; }, r, { timeout: ms, polling: 50 }).then(() => true, () => false);

/** Where an element lies: inside the window, not cut by a scrolling ancestor, and the element on top at its centre. */
function placement(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const inside = r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    let clippedBy = null;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (!/(auto|scroll|hidden)/.test(`${cs.overflowX} ${cs.overflowY}`)) continue;
      const ar = a.getBoundingClientRect();
      if (r.top < ar.top - 0.5 || r.bottom > ar.bottom + 0.5 || r.left < ar.left - 0.5 || r.right > ar.right + 0.5) { clippedBy = a.className || a.id || a.tagName; break; }
    }
    const cx = (r.left + r.right) / 2; const cy = (r.top + r.bottom) / 2;
    const top = document.elementFromPoint(cx, cy);
    return { inside, clippedBy, onTop: !!top && (top === el || el.contains(top)), cx, cy, rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
  });
}
const placeText = (p) => `rect ${p.rect.join(',')}${p.inside ? '' : ' (outside the window)'}${p.clippedBy ? ` (cut by .${p.clippedBy})` : ''}${p.onTop ? '' : ' (covered)'}`;
const fullyShown = (p) => p.inside && !p.clippedBy && p.onTop;

/** Open the bags with the micro-menu button, click the item with this uid, return the context-menu locator. */
async function bagMenu(page, uid) {
  if (!(await page.locator('#win-bags').count())) { await page.getByRole('button', { name: 'Bags' }).click(); await idle(page); }
  // the item's own slot (blind panel 2026-11-13: bag slots stay put, so the grid's order is not the bag's)
  await page.locator(`#win-bags .baggrid .slot[data-uid="${uid}"]`).click();
  return page.locator('.ctxmenu');
}
const closeBags = async (page) => { if (await page.locator('#win-bags').count()) { await page.locator('#win-bags').getByRole('button', { name: 'Close' }).click(); await idle(page); } };

// ------------------------------------------------------------------ part A: early game, real engine, 1x
async function partA(browser, W, H) {
  const SEED = 30;
  // The same run in Node, for the map facts the map and the tooltip must show.
  let twin = R.newRun({ classId: 'rogue', seed: SEED, content: CONTENT, mapMode: 'rows' });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) twin = R.step(twin, a).state;
  const mv = R.mapView(twin);
  const ROWS = mv.rows.length; const LANES = mv.rows[0].length;
  const need = R.travelLevel(twin); const exit = R.C.ZONE_LEVELS; // zone 1

  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}`);
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);

    check('BUG-QA-09', 'no day clock (M2b v7): the minimap shows no clock at the start', (await page.locator('#minimap .clock').textContent()) === clockLabel(0) && !(await page.locator('#minimap .clock').isVisible()), await page.locator('#minimap .clock').textContent());
    { const bad = await timeLabelsBad(page); check('M2b-v7', 'hub: no time label says "Day N", "N h", hours or a decimal (tolls in whole numbers)', !bad.length, bad.join(' | ') || 'none'); }
    const setOut = await placement(page.getByRole('button', { name: 'Set out' }));
    check('BUG-QA-10', 'hub: "Set out" is in view without scrolling', fullyShown(setOut), placeText(setOut));

    // ---- vendor: buy, the item bar, sell
    await page.locator('#screens .svc-card', { hasText: 'Vendor' }).click(); await idle(page);
    const stock = (name) => page.locator('.vendor-cols > div').nth(0).locator('.trow').filter({ has: page.locator('.nm', { hasText: new RegExp(`^${name}$`) }) });
    const mine = (name) => page.locator('.vendor-cols > div').nth(1).locator('.trow').filter({ has: page.locator('.nm', { hasText: new RegExp(`^${name}( ×\\d+)?$`) }) });
    await stock('Healing Draught').getByRole('button', { name: 'Buy' }).click(); await idle(page);
    let log = await logLines(page);
    check('BUG-QA-03', 'log names the item bought', log.includes('You buy Healing Draught.'), log.filter((l) => /buy/i.test(l)).join(' | '));
    const slot8 = page.getByRole('button', { name: 'Item slot 8: Healing Draught' });
    check('BUG-QA-04', 'a bought potion goes to the free item slot 8, and the log says so', (await slot8.count()) === 1 && log.some((l) => /^Healing Draught goes on item slot 8/.test(l)),
      `${(await view(page)).itemBar.join(',')} | ${log.filter((l) => /item slot/.test(l)).join(' | ')}`);
    // A slot the player clears stays clear when more of the same potion is bought.
    await slot8.click({ button: 'right' }); await idle(page);
    await stock('Healing Draught').getByRole('button', { name: 'Buy' }).click(); await idle(page);
    check('BUG-QA-04', 'a potion already in the bags is not put back on a slot the player cleared', (await page.getByRole('button', { name: 'Empty item slot 8' }).count()) === 1, (await view(page)).itemBar.join(','));
    // ...and the bag menu still puts it there.
    let v = await view(page);
    const menu = await bagMenu(page, v.bag.find((b) => b && b.id === 'healing_draught').uid);
    await menu.getByRole('button', { name: 'Put on item slot 8' }).click(); await idle(page);
    await closeBags(page);
    check('BUG-QA-04', 'the bag menu puts the potion on item slot 8', (await slot8.count()) === 1, (await view(page)).itemBar.join(','));
    await mine('Trail Rations').getByRole('button', { name: 'Sell' }).click(); await idle(page);
    log = await logLines(page);
    const sold = log.find((l) => /^You sell /.test(l)) || '';
    check('BUG-QA-03', 'log names the item sold and the money received (gold, silver, copper)', new RegExp(`^You sell Trail Rations for ${MONEY_RE}\\.$`).test(sold) && !/ for 0 c\./.test(sold) && !log.some((l) => /^You receive \d/.test(l)), log.filter((l) => /sell|receive/i.test(l)).join(' | '));
    await stock('Trail Rations').getByRole('button', { name: 'Buy' }).click(); await idle(page);
    log = await logLines(page);
    check('BUG-QA-04', 'food (out of combat only) stays off the item bar', log.includes('You buy Trail Rations.') && (await page.getByRole('button', { name: 'Empty item slot 9' }).count()) === 1, (await view(page)).itemBar.join(','));
    await page.getByRole('button', { name: 'Done' }).click(); await idle(page);

    // ---- map (M2 v2): the engine's rows and lanes, the travel button and the tracker before the travel level
    await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
    await page.mouse.move(2, 2);
    const nodeCount = await page.locator('#screens button.mnode').count();
    const ruler = await page.locator('#screens .mrow').allInnerTexts();
    const lastRow = [];
    for (let l = 0; l < LANES; l++) lastRow.push(await placement(page.locator(`#screens button.mnode[data-row="${ROWS}"][data-lane="${l}"]`)));
    check('M2v2-50', `the map draws the engine's ${ROWS} rows of ${LANES} lanes (ZONE_CHOICE_ROWS ${R.C.ZONE_CHOICE_ROWS}), the last row in view`,
      ROWS === R.C.ZONE_CHOICE_ROWS && nodeCount === ROWS * LANES && ruler.join(',') === Array.from({ length: ROWS }, (_, i) => i + 1).join(',') && lastRow.every(fullyShown),
      `${nodeCount} nodes, ruler ${ruler.join(',')}; last row: ${lastRow.map(placeText).join(' | ')}`);
    const tb = page.locator('#screens .mhead button[data-travel]');
    const tbText = (await tb.innerText()).trim(); const tbKind = await tb.getAttribute('data-travel'); const tbOff = await tb.isDisabled();
    await tb.hover();
    const tbTip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
    await shot(page, 'A-map-travel');
    await page.mouse.move(2, 2);
    check('M2v2-45', `travel button at level 1: disabled, "Travel on at level ${need}" (R.travelLevel), tooltip names level ${need}, the exit level ${exit} and row ${ROWS}`,
      tbOff && tbKind === 'locked' && tbText === `Travel on at level ${need}` && tbTip.includes(`Open from level ${need}`) && tbTip.includes(`below the exit level ${exit}`) && tbTip.includes(`Reach level ${need} or finish row ${ROWS} first (you are level 1).`),
      `"${tbText}" (${tbKind}, disabled ${tbOff}) | ${tbTip.replace(/\n/g, ' / ')}`);
    const tracker = (await page.locator('#tracker').innerText()).replace(/\n/g, ' / ');
    check('M2v2-50', `tracker: "Travel on at level ${need} (or after row ${ROWS})" and "Row 0 of ${ROWS}"`, tracker.includes(`Travel on at level ${need} (or after row ${ROWS})`) && tracker.includes(`Row 0 of ${ROWS}`), tracker);

    // ---- map: enemy count and archetypes in the tooltip (BUG-QA-02; combat v2 rules 7.14, mapView archetypes: one role
    // badge per archetype with its count), neutral labels for nodes without a fight
    let target = null;
    mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (!target && n.archetypes && n.archetypes.length >= 2) target = { r: ri + 1, l, n }; }));
    const roleName = (a) => a[0].toUpperCase() + a.slice(1);
    const groups = [...new Set(target.n.archetypes)].map((a) => { const k = target.n.archetypes.filter((x) => x === a).length; return `${k > 1 ? `${k} × ` : ''}${roleName(a)}`; });
    const want = `${target.n.type === 'grind' ? 'Wave 1' : 'Foes'}: ${target.n.archetypes.length} enemies`;
    await page.locator(`#screens button.mnode[data-row="${target.r}"][data-lane="${target.l}"]`).hover();
    const tipFoes = await page.getByRole('tooltip').locator('.tt-foes').evaluateAll((els) => els.map((el) => ({ k: el.querySelector('.k').textContent, archs: [...el.querySelectorAll('.arch')].map((a) => ({ text: a.textContent, icon: !!a.querySelector('img[src^="data:"]') })) })));
    await shot(page, 'A-map-tooltip');
    check('BUG-QA-02', `map tooltip tells the encounter size and archetypes (${target.n.type}, row ${target.r}: ${target.n.archetypes.join(', ')}): "${want}" and the badges ${groups.join(', ')}`,
      tipFoes.length === 1 && tipFoes[0].k === want && tipFoes[0].archs.map((a) => a.text).join(', ') === groups.join(', ') && tipFoes[0].archs.every((a) => a.icon),
      JSON.stringify(tipFoes));
    // a dungeon node lists every trash fight and the boss (mapView fights, bossArchetype)
    let dun = null;
    mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (!dun && n.type === 'dungeon') dun = { r: ri + 1, l, n }; }));
    if (dun) {
      await page.mouse.move(2, 2);
      await page.locator(`#screens button.mnode[data-row="${dun.r}"][data-lane="${dun.l}"]`).hover();
      const dFoes = await page.getByRole('tooltip').locator('.tt-foes').evaluateAll((els) => els.map((el) => ({ k: el.querySelector('.k').textContent, n: el.querySelectorAll('.arch').length })));
      const wantD = [...dun.n.fights.map((f, i) => `Fight ${i + 1}: ${f.length} ${f.length === 1 ? 'enemy' : 'enemies'}`), 'Boss: '];
      check('M2b-2b.6', `map tooltip of the dungeon (row ${dun.r}) lists its ${dun.n.fights.length} trash fights and the boss with role badges`,
        dFoes.length === wantD.length && dFoes.every((f, i) => f.k.startsWith(wantD[i]) && f.n >= 1), JSON.stringify(dFoes));
    }
    await page.mouse.move(2, 2);
    const labels = await page.locator('#screens button.mnode').evaluateAll((els) => els.map((b) => ({ row: b.dataset.row, lane: b.dataset.lane, text: b.querySelector('.cl').textContent, color: getComputedStyle(b.querySelector('.cl')).color })));
    const calm = labels.filter((x) => /^(Rest|Vendor|Trainer|Shrine)$/.test(x.text));
    const fights = labels.filter((x) => /^(Quest|Grind|Elite|Dungeon|Treasure) \d+$/.test(x.text));
    check('BUG-QA-08', `map labels of nodes without a fight are neutral (${calm.length} nodes: ${[...new Set(calm.map((x) => x.text))].join(', ')})`,
      calm.length > 0 && calm.every((x) => x.color === NEUTRAL) && fights.some((x) => x.color !== NEUTRAL), calm.filter((x) => x.color !== NEUTRAL).map((x) => `${x.text} r${x.row} ${x.color}`).join(' | ') || `fight labels ${[...new Set(fights.map((x) => x.color))].join(' ')}`);

    // ---- a fight: key A until the hero is hurt, key 8, the Autoplay switch, key Z (the row 1 quest with most enemies)
    const quests = mv.rows[0].map((n, l) => ({ n, l })).filter((x) => x.n.type === 'quest').sort((a, b) => b.n.archetypes.length - a.n.archetypes.length);
    const lane = quests[0].l;
    await page.locator(`#screens button.mnode.reach[data-row="1"][data-lane="${lane}"]`).click(); await idle(page);
    await page.getByRole('button', { name: 'Accept' }).click(); await idle(page);
    // The engine sends no heal of 0 (M2 v2 engine): take a hit first, so the potion has something to heal.
    for (let i = 0; i < 4; i++) { v = await view(page); if (v.over || v.hp < v.maxHp) break; await page.keyboard.press('KeyA'); await idle(page); }
    v = await view(page);
    const r0 = v.round; const hurt = `${v.hp}/${v.maxHp}`;
    await page.keyboard.press('Digit8'); await idle(page);
    v = await view(page); log = await logLines(page);
    check('BUG-QA-04', 'key 8 drinks the potion in a fight (the round advances)', v.round > r0 && log.includes('You use Healing Draught.'), `round ${r0} -> ${v.round}`);
    check('BUG-QA-03', `the potion's heal names its source in the log (drunk at ${hurt} health)`, log.some((l) => /^Healing Draught heals you for [1-9]/.test(l)), log.filter((l) => /heals|You use/.test(l)).join(' | '));
    const sw = page.getByRole('switch', { name: 'Autoplay' });
    const r1 = v.round;
    await sw.click();
    const moved = await roundPast(page, r1, 8000);
    v = await view(page);
    await shot(page, 'A-autoplay');
    check('BUG-QA-01', 'clicking the Autoplay switch plays the next round with no other input', moved && (await sw.getAttribute('aria-checked')) === 'true', `autoplay ${v.autoplay}, round ${r1} -> ${v.round}, over ${v.over}`);
    if (!v.over) {
      await page.keyboard.press('KeyZ'); await idle(page);
      const r2 = (await view(page)).round;
      await page.waitForTimeout(2500);
      v = await view(page);
      const stayed = !v.over && v.round === r2;
      check('BUG-QA-01', 'key Z switches autoplay off: the round then waits for the player', stayed && (await sw.getAttribute('aria-checked')) === 'false', `autoplay ${v.autoplay}, round ${r2} -> ${v.round} in 2.5 s`);
      if (stayed) {
        await page.keyboard.press('KeyZ');
        const moved2 = await roundPast(page, r2, 8000);
        v = await view(page);
        check('BUG-QA-01', 'key Z switches it on again: the fight goes on by itself', moved2 && v.autoplay, `autoplay ${v.autoplay}, round ${r2} -> ${v.round}`);
      }
    } else check('BUG-QA-01', 'key Z off and on (the fight lasted long enough to test)', false, 'the fight ended on the first autoplay round');
    const ended = await page.waitForFunction(() => { const x = window.__ui.view(); return !(x.combat && !x.combat.over); }, null, { timeout: 30000, polling: 100 }).then(() => true, () => false);
    v = await view(page);
    check('BUG-QA-01', 'autoplay plays the fight to its end', ended && v.phase === 'NODE', `phase ${v.phase}, over ${v.over}, round ${v.round}`);

    // ---- loot, quest reward, equip from the bags
    await idle(page);
    if (await page.locator('#screens .loot').count()) { await page.locator('#screens .loot .foot').getByRole('button', { name: /Continue|Take all/ }).click(); await idle(page); }
    const before = new Set((await view(page)).bag.filter(Boolean).map((b) => b.uid));
    await page.locator('#screens .choice-cards .icard').first().click(); await idle(page);
    v = await view(page);
    const reward = v.bag.find((b) => b && b.kind === 'gear' && !before.has(b.uid));
    if (reward) {
      const m = await bagMenu(page, reward.uid);
      await m.getByRole('button', { name: 'Equip' }).click(); await idle(page);
      log = await logLines(page);
      check('BUG-QA-03', 'log names the item equipped from the bags', log.includes(`Equipped ${reward.name}.`), log.filter((l) => /Equipped/.test(l)).join(' | '));
      await closeBags(page);
    } else check('BUG-QA-03', 'log names the item equipped from the bags', false, 'no quest reward reached the bags');
    v = await view(page);
    check('BUG-QA-09', `no day clock at ${v.time} tolls (M2b v7)`, (await page.locator('#minimap .clock').textContent()) === clockLabel(v.time), await page.locator('#minimap .clock').textContent());
    { const bad = await timeLabelsBad(page); check('M2b-v7', 'map: no time label says "Day N", "N h", hours or a decimal (tolls in whole numbers)', !bad.length, bad.join(' | ') || 'none'); }
  } catch (e) {
    check('-', 'part A ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part A: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part B: the camp, real engine, Instant
/**
 * Setup steps in the page: the engine's autoplay choices (AUTO) until the camp or the run's end. A TRAVEL_ON choice on
 * the map is sent as the UI's TRAVEL_ON action (what the Travel on button sends), so the zone travel and its banner play
 * as for a player. The clock is read after every change of the run's time, the travel button at every map step and the zone banner
 * after every change of zone.
 * stop.early: stop at the first map step where travelling on is legal under the exit level (the button's data-travel
 * is "early"); stop.zone: stop at the first map step in that zone or later; stop.travel: stop at the first map step where
 * the autoplay choice is TRAVEL_ON (before it is sent).
 */
const autoRun = (page, stop = {}) => page.evaluate(async (opt) => {
  const ui = window.__ui; const out = { clock: [], travel: [], early: null, at: null, banners: [] }; let last = -1;
  let zone = ui.view().zone ? ui.view().zone.idx : null;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let n = 0; n < 4000; n++) {
    const v = ui.view();
    if (v.phase === 'CAMP' || v.phase === 'SUMMARY') break;
    if (v.phase === 'MAP' && !v.loot) { // with items waiting in the loot window the map is not on screen
      await frame();
      const b = document.querySelector('#screens .mhead button[data-travel]');
      const rec = { z: v.zone.idx, level: v.player.level, need: v.zone.travelLevel, exit: v.zone.exitLevel, travelOn: !!v.legal.travelOn, must: !!v.legal.mustTravel,
        row: v.zone.pos.row, kind: b ? b.dataset.travel : null, disabled: b ? b.disabled : null, label: b ? b.textContent : null };
      out.travel.push(rec);
      if (opt.early && rec.kind === 'early') { out.early = rec; return out; }
      if (opt.zone && v.zone.idx >= opt.zone) { out.at = rec; return out; }
    }
    const c = v.phase === 'MAP' ? ui.autoChoice() : null;
    if (opt.travel && c && c.type === 'ENGINE' && c.action.type === 'TRAVEL_ON') { out.at = out.travel[out.travel.length - 1]; return out; }
    await ui.act(c && c.type === 'ENGINE' && c.action.type === 'TRAVEL_ON' ? { type: 'TRAVEL_ON' } : { type: 'AUTO' });
    await ui.idle();
    const nv = ui.view();
    if (nv.zone && nv.zone.idx !== zone) { zone = nv.zone.idx; out.banners.push({ z: zone, b1: document.querySelector('#banner .b1').textContent, b2: document.querySelector('#banner .b2').textContent }); }
    const h = nv.time;
    if (h !== last && nv.phase !== 'SUMMARY') { last = h; await frame(); out.clock.push([nv.time, document.querySelector('#minimap .clock').textContent]); }
  }
  await ui.idle();
  return out;
}, stop);
/** The travel button state the engine's legality and levels call for (rules 1.5). */
const travelKind = (r) => (r.must ? 'done' : r.travelOn ? (r.level >= r.exit ? 'open' : 'early') : 'locked');

let B_PICK = null;
/**
 * Part B's seed, chosen at run time on Node runs of the same choices (the engine still changes under combat v2.1): the
 * engine's autoplay choices with the UI's own item-bar actions (iUiOwn), the first Hunter seed of 1-60 whose run has a
 * first legal Travel on below the exit level at the travel level, reaches the camp hurt with Trail Rations, then (rations
 * eaten, Face Oruvath, autoplay) has phase 2 with at least two different counts of living Shards. Seed 1 was the part's
 * seed for the engine of 7196e96; it reaches the camp unhurt with the wind-ups of 0bd5a55.
 */
function bPick() {
  if (B_PICK) return B_PICK;
  const run = (s, a) => { const prev = s; let t = R.step(s, a).state; for (const o of iUiOwn(prev, t)) t = R.step(t, o).state; return t; };
  for (let seed = 1; seed <= 60; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    let early = null;
    for (let n = 0; n < 6000 && s.phase !== 'CAMP' && s.phase !== 'ENDED'; n++) {
      if (early === null && s.phase === 'MAP' && !(s.loot && s.loot.length) && R.isLegal(s, { type: 'TRAVEL_ON' })) early = s.player.level < R.C.ZONE_LEVELS * s.zone.z && s.player.level === R.travelLevel(s);
      s = run(s, R.autoAction(s));
    }
    if (!early || s.phase !== 'CAMP') continue;
    const food = s.player.bag.find((it) => it.kind === 'cons' && it.id === 'trail_rations');
    if (!food || s.player.hp >= s.player.d.maxHp) continue;
    s = run(s, { type: 'USE_ITEM', itemId: 'trail_rations' });
    s = run(s, { type: 'FIGHT_BOSS' });
    s = run(s, { type: 'SET_AUTOPLAY', on: true });
    const counts = new Set();
    for (let n = 0; n < 3000 && s.phase !== 'ENDED'; n++) {
      if (s.fight && s.fight.boss && s.fight.boss.phase === 2) { const k = s.fight.enemies.filter((e) => e.alive && e.kind === 'shard').length; if (k > 0) counts.add(k); }
      s = run(s, R.autoAction(s));
    }
    if (counts.size >= 2) { B_PICK = { seed, shards: [...counts].sort() }; return B_PICK; }
  }
  throw new Error('no Hunter seed of 1-60 meets part B\'s conditions');
}

async function partB(browser, W, H) {
  const pick = bPick(); const SEED = pick.seed;
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  check('-', `part B seed ${SEED} (chosen on Node runs: early travel, the camp hurt with Trail Rations, phase 2 with ${pick.shards.join(', ')} Shards)`, true, '');
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    // Setup: the engine's autoplay choices up to the first map step where leaving early is legal, then to the camp.
    const first = await autoRun(page, { early: true });
    let earlyTip = null;
    if (first.early) {
      await page.locator('#screens .mhead button[data-travel]').hover();
      earlyTip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
      await shot(page, 'B-travel-early');
      await page.mouse.move(2, 2);
    }
    const rest = await autoRun(page);
    const samples = [...first.clock, ...rest.clock];
    const steps = [...first.travel, ...rest.travel];
    const e = first.early;
    check('M2v2-45', `travel on early: at level ${e ? e.level : '?'} in zone ${e ? e.z : '?'} the button is enabled, "Travel on early", and the tooltip warns about the exit level`,
      !!e && e.level === e.need && e.need === e.exit - R.C.TRAVEL_EARLY_LEVELS && !e.disabled && e.label === 'Travel on early' && !!earlyTip && earlyTip.includes(`You are under the exit level (${e.exit})`),
      e ? `${JSON.stringify(e)} | ${(earlyTip || '').replace(/\n/g, ' / ')}` : 'no map step allowed leaving early');
    const wrongSteps = steps.filter((r) => r.kind !== travelKind(r) || r.disabled !== !r.travelOn || r.need !== r.exit - R.C.TRAVEL_EARLY_LEVELS || (r.kind === 'locked' && r.label !== `Travel on at level ${r.need}`));
    const kinds = steps.reduce((m, r) => ({ ...m, [r.kind]: (m[r.kind] || 0) + 1 }), {});
    check('M2v2-45', `the travel button follows the engine at all ${steps.length} map steps (travelLevel = exit level - ${R.C.TRAVEL_EARLY_LEVELS})`, steps.length > 0 && !wrongSteps.length,
      wrongSteps.length ? wrongSteps.slice(0, 3).map((r) => JSON.stringify(r)).join(' | ') : JSON.stringify(kinds));
    let v = await view(page);
    if (v.phase !== 'CAMP') throw new Error(`setup did not reach the camp (phase ${v.phase})`);
    const wrong = samples.filter(([h, txt]) => txt !== clockLabel(h));
    const midnight = samples.find(([h]) => h >= 18);
    check('BUG-QA-09', `no day clock at ${samples.length} readings (0 to ${v.time} tolls, M2b v7)`, !wrong.length && !!midnight,
      wrong.length ? wrong.slice(0, 3).map(([h, t]) => `${h} tolls: "${t}"`).join(' | ') : `none past 17 tolls shows a clock`);

    // ---- the camp panel
    await page.waitForTimeout(1500); // the zone banner fades
    await shot(page, 'B-camp');
    const face = page.getByRole('button', { name: 'Face Oruvath' });
    const pf = await placement(face);
    check('BUG-QA-10', 'camp: "Face Oruvath" is in view without scrolling', fullyShown(pf), placeText(pf));
    const foot = page.locator('#screens .side .sfoot');
    const asc = await placement(foot.locator('dd').nth(0));
    const footText = (await foot.innerText()).replace(/\n/g, ' ');
    // D150: one line, what the tolls did to Oruvath (no tolls, par or Ascendancy: the Furnace has the number)
    check('BUG-QA-10', 'camp: Oruvath\'s line (what the tolls did to him) is in view; no par or Ascendancy', fullyShown(asc) && /Oruvath (\+\d+ % health and damage|Base strength)/.test(footText) && !/\bpar\b|Ascendancy/.test(footText), `${footText} | ${placeText(asc)}`);
    const cards = page.locator('#screens .side .svc-card');
    const cardPl = [];
    for (let i = 0; i < await cards.count(); i++) cardPl.push(await placement(cards.nth(i)));
    check('BUG-QA-10', `camp: all ${cardPl.length} service cards are in view`, cardPl.length === 4 && cardPl.every(fullyShown), cardPl.map(placeText).join(' | '));

    // ---- the bag menu at the right edge (BUG-QA-11), and an item used out of combat (BUG-QA-03)
    await page.keyboard.press('KeyB'); await idle(page);
    v = await view(page);
    // the grid's filled slots (bag slots stay put: the grid's order, not the bag's)
    const filled = await page.evaluate(() => [...document.querySelectorAll('#win-bags .baggrid .slot')].map((e, i) => (e.dataset.uid ? i : -1)).filter((i) => i >= 0));
    const right = filled.filter((i) => i % 4 === 3);
    for (const [label, idx] of [['right column, first row', right[0] ?? filled[filled.length - 1]], ['last row', filled[filled.length - 1]]]) {
      await page.locator('#win-bags .baggrid .slot').nth(idx).click();
      const mb = await page.locator('.ctxmenu').boundingBox();
      check('BUG-QA-11', `bag menu of the item in the ${label} (slot ${idx + 1}) lies inside the window`, mb && mb.x >= 0 && mb.y >= 0 && mb.x + mb.width <= W && mb.y + mb.height <= H,
        mb ? `menu ${Math.round(mb.x)},${Math.round(mb.y)} to ${Math.round(mb.x + mb.width)},${Math.round(mb.y + mb.height)} in ${W}x${H}` : 'no menu');
      await page.mouse.click(W / 2, 40); // click away to close the menu
    }
    await shot(page, 'B-bag-menu');
    const food = v.bag.find((b) => b && b.id === 'trail_rations');
    if (food && v.hp < v.maxHp) {
      const m = await bagMenu(page, food.uid);
      await m.getByRole('button', { name: 'Use' }).click(); await idle(page);
      const log = await logLines(page);
      check('BUG-QA-03', 'an item used from the bags is named, and so is the heal it gives', log.includes('You use Trail Rations.') && log.some((l) => /^Trail Rations heals you for [1-9]/.test(l)), log.slice(-3).join(' | '));
    } else check('BUG-QA-03', 'an item used from the bags is named, and so is the heal it gives', false, `setup: no Trail Rations or full health (${v.hp}/${v.maxHp})`);
    await closeBags(page);

    // ---- Face Oruvath with a plain mouse click where it is drawn, then the fight on the Autoplay switch
    const pf2 = await placement(face);
    await page.mouse.click(pf2.cx, pf2.cy); await idle(page);
    v = await view(page);
    check('BUG-QA-10', 'a click on "Face Oruvath" (no scrolling) starts the boss fight', v.phase === 'BOSS', `phase ${v.phase}`);
    // Linked (M2 v2): record the boss frame's phase line with the Shards alive on screen whenever it changes.
    await page.evaluate(() => {
      window.__linked = [];
      const box = document.querySelector('#boss-frame .binfo');
      new MutationObserver(() => {
        const c = window.__ui.shown().combat; const el = box.querySelector('.bphase');
        if (!c || !c.boss || !el) return;
        const shards = c.enemies.filter((x) => x.rank === 'shard' && x.alive && !x.hidden).length;
        const rec = { phase: c.boss.phase, shards, text: el.textContent.replace(/\u00a0/g, ' ') };
        const last = window.__linked[window.__linked.length - 1];
        if (!last || last.text !== rec.text || last.shards !== shards) window.__linked.push(rec);
      }).observe(box, { childList: true, subtree: true, characterData: true });
    });
    const sw = page.getByRole('switch', { name: 'Autoplay' });
    await sw.click();
    const done = await page.waitForFunction(() => window.__ui.view().phase === 'SUMMARY', null, { timeout: 90000, polling: 200 }).then(() => true, () => false);
    v = await view(page);
    check('BUG-QA-01', 'the boss fight plays to its end on the Autoplay switch alone', done, `phase ${v.phase}, round ${v.round}`);
    const linked = (await page.evaluate(() => window.__linked)).filter((r) => r.phase === 2);
    const want = (n) => (n > 0 ? `Phase 2 · Linked −${Math.round(Math.min(R_LINK.cap, R_LINK.per * n) * 100)} % (${n} ${n === 1 ? 'Shard' : 'Shards'})` : 'Phase 2 · Link broken');
    const badLinked = linked.filter((r) => r.text !== want(r.shards));
    const counts = [...new Set(linked.filter((r) => r.shards > 0).map((r) => r.shards))].sort();
    check('M2v2-2', `boss frame: Linked −${Math.round(R_LINK.per * 100)} % per living Shard, at most −${Math.round(R_LINK.cap * 100)} % (phase 2 with ${counts.join(', ') || 'no'} Shards)`,
      counts.length >= 2 && !badLinked.length,
      badLinked.length ? badLinked.slice(0, 3).map((r) => `${r.shards} Shards: "${r.text}" (wanted "${want(r.shards)}")`).join(' | ') : counts.map((n) => `"${want(n)}"`).join(', '));
    if (done) {
      await page.locator('#screens .summary').waitFor({ timeout: 10000 });
      check('BUG-QA-05', `no banner over the run summary (${v.outcome})`, !(await page.locator('#banner').evaluate((b) => b.classList.contains('on'))), await page.locator('#banner').getAttribute('class'));
    }
  } catch (e) {
    check('-', 'part B ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part B: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part C: a victory, mock engine, Instant
async function partC(browser, W, H) {
  let done = false;
  for (const seed of [1, 2, 3, 4]) {
    const { context, page, errors } = await open(browser, W, H, `mock=1&seed=${seed}&speed=instant`);
    try {
      await page.locator('#create .ccard[data-cls="mage"]').click(); await idle(page);
      await page.evaluate(async () => { await window.__ui.act({ type: 'DEBUG_JUMP', to: 'boss', level: 60, gear: true, classId: 'mage' }); await window.__ui.idle(); });
      await page.keyboard.press('KeyZ');
      await page.locator('#screens .summary').waitFor({ timeout: 60000 });
      const v = await view(page);
      if (v.outcome !== 'victory') { await context.close(); continue; }
      const on = await page.locator('#banner').evaluate((b) => b.classList.contains('on'));
      await page.waitForTimeout(450);
      const opacity = await page.locator('#banner').evaluate((b) => Number(getComputedStyle(b).opacity));
      await shot(page, 'C-victory-summary');
      check('BUG-QA-05', `the victory banner is gone when the run summary appears (mock, Mage seed ${seed})`, !on && opacity < 0.05, `banner "on" ${on}, opacity after 0.45 s ${opacity}`);
      check('-', 'part C: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
      done = true;
      await context.close();
      break;
    } catch (e) {
      check('-', `part C (seed ${seed}) ran to the end`, false, e.message.split('\n')[0]);
      await context.close();
      done = true;
      break;
    }
  }
  if (!done) check('BUG-QA-05', 'the victory banner is gone when the run summary appears', false, 'no mock seed 1-4 won the boss fight');
}

// ------------------------------------------------------------------ part D: round time, real engine, default speed
/**
 * One manual combat round played with a key. Setup only: every step outside a fight (map, intros, rewards, hub)
 * is the engine's autoplay choice (AUTO helper, as in part B). In a fight it presses the key of the action the
 * autoplay policy would choose (1-7, A, X, 8-0), so the hero lives through many fights. Returns the step's timing
 * record (window.__ui.plays()) with the records after it, or null when the key was refused.
 * during: optional async function called while the step plays (e.g. a second input during enemy animations).
 */
async function fightStep(page, during) {
  for (let i = 0; i < 200; i++) {
    const s = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, step: x.node && x.node.step, round: x.combat && x.combat.round, over: x.combat && x.combat.over }; });
    if (s.phase === 'SUMMARY') throw new Error('the hero died during the round-time checks');
    if (!(s.round && !s.over && s.step !== 'intro')) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); continue; }
    const key = await page.evaluate(() => {
      const v = window.__ui.view(); const c = window.__ui.autoChoice(); const a = (c && c.action) || c || {};
      if (a.type === 'CAST' && v.player.bar.includes(a.spellId)) return `Digit${v.player.bar.indexOf(a.spellId) + 1}`;
      if (a.type === 'USE_ITEM' && a.slot != null) return ['Digit8', 'Digit9', 'Digit0'][a.slot];
      if (a.type === 'PASS') return 'KeyX';
      return 'KeyA';
    });
    const k = await page.evaluate(() => window.__ui.plays().length);
    await page.keyboard.press(key);
    if (during) await during(page);
    await idle(page);
    const plays = await page.evaluate(() => window.__ui.plays());
    return plays.length > k ? { ...plays[k], next: plays.slice(k + 1) } : null;
  }
  return null;
}
/** Wait until the director plays an enemy's action (true) or the step is over (false). */
const enemyOnScreen = (page) => page.waitForFunction(() => { const e = window.__ui.playingEvent(); return !e ? 'idle' : e.t === 'action' && e.side === 'enemy' ? 'enemy' : false; }, null, { timeout: 3000, polling: 'raf' })
  .then((h) => h.jsonValue(), () => 'timeout').then((x) => x === 'enemy');
const roundMs = (r) => Math.round(r.end - r.input);
const isMoment = (r) => r.events.some((t) => MOMENTS.includes(t));

async function setSpeed(page, label) {
  await page.keyboard.press('Escape');
  await page.locator('#win-settings').getByRole('button', { name: label, exact: true }).click();
  await page.locator('#win-settings').getByRole('button', { name: 'Close' }).click();
  await idle(page);
}

async function partD(browser, W, H) {
  const SEED = 9;
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}`); // the default animation speed
  try {
    const speed0 = await page.evaluate(() => window.__ui.settings.get('speed'));
    await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);

    // ---- manual rounds at the default speed: input to the end of the step (the action bar is live again).
    // Owner 2026-11-10: rounds at least 40 % slower than the M2 v2 budget (PACE_ROUND_ANIM_S); the UI's round cap is
    // the budget each round reports (src/ui/combat-feel.js roundPace).
    const rounds = [];
    for (let i = 0; i < 40 && rounds.filter((r) => !isMoment(r)).length < 12; i++) { const r = await fightStep(page); if (r) rounds.push(r); }
    const plain = rounds.filter((r) => !isMoment(r)); const ms = plain.map(roundMs);
    const budgets = [...new Set(plain.map((r) => r.round && r.round.budget))];
    const SLOW = SLOWER * BUDGET;
    // D52: headless rendering at 1920x1080 runs at about 10 fps, so there only the median is held to the cap; at 1366x768 every round is
    const maxCapped = !(W >= 1920 && H >= 1080);
    check('M2v2-52', `default speed (${speed0}x): rounds without a level-up or fight end take at least ${SLOW} ms at the median (D47: 1.4 × the M2 v2 budget = PACE_ROUND_ANIM_S ${R.C.PACE_ROUND_ANIM_S} s) and ${maxCapped ? 'at most the round cap' : 'at the median at most the round cap (D52)'}`,
      speed0 === 1 && plain.length >= 8 && budgets.length === 1 && budgets[0] >= SLOW && median(ms) >= SLOW && (maxCapped ? Math.max(...ms) <= budgets[0] : median(ms) <= budgets[0]),
      `${plain.length} rounds: median ${median(ms)} ms, max ${Math.max(...ms)} ms, cap ${budgets.join('/')} ms, tempo ${plain.map((r) => r.round ? r.round.tempo.toFixed(2) : '-').join(' ')}; with moments: ${rounds.filter(isMoment).map(roundMs).join(', ') || 'none'} ms`);

    // ---- key A pressed twice during enemy animations: the round plays on, A is queued once (visible), one attack follows
    let keyTest = null; let shown = false;
    for (let i = 0; i < 8 && !keyTest; i++) {
      let pressed = false;
      const r = await fightStep(page, async (pg) => {
        if (await enemyOnScreen(pg)) {
          await pg.keyboard.press('KeyA'); await pg.keyboard.press('KeyA'); pressed = true;
          shown = (await pg.locator('#actionbar .ab.basic.queued').count()) === 1 && /Next: Attack/.test(await pg.locator('#actionbar .qtag').innerText());
        }
      });
      if (r && pressed) keyTest = r;
    }
    const attacks = keyTest ? keyTest.next.filter((x) => x.type === 'ATTACK').length : 0;
    check('M2v2-52', 'key A twice during enemy animations: the round is not cut short, the attack is queued once and shown on the bar, then plays',
      !!keyTest && keyTest.skippedAt == null && keyTest.queued === 'attack' && shown && attacks === 1 && roundMs(keyTest) <= keyTest.round.budget,
      keyTest ? `round ${roundMs(keyTest)} ms, queued ${keyTest.queued}, bar shows it: ${shown}, attacks after it: ${attacks}` : 'no round with an enemy action on screen');

    // ---- a click on the scene during an enemy's action skips that hit only; the round goes on and no action follows
    let clickTest = null;
    for (let i = 0; i < 8 && !clickTest; i++) {
      let clicked = false;
      const r = await fightStep(page, async (pg) => { if (await enemyOnScreen(pg)) { await pg.mouse.click(Math.round(W * 0.5), Math.round(H * 0.16)); clicked = true; } });
      if (r && clicked && r.hitSkips.length) clickTest = r;
    }
    check('M2v2-52', 'a click during an enemy action skips to the end of that hit only (the round is not finished at once, no action follows)',
      !!clickTest && clickTest.hitSkips.length === 1 && clickTest.skippedAt == null && !clickTest.next.length,
      clickTest ? `hit skipped ${Math.round(clickTest.hitSkips[0].at - clickTest.input)} ms into the round (event ${clickTest.hitSkips[0].event}); round ended ${Math.round(clickTest.end - clickTest.hitSkips[0].at)} ms later; steps after it: ${clickTest.next.length}` : 'no round with an enemy action on screen');
    await shot(page, 'D-fight');

    // ---- 2x, 4x and Instant from the settings window: each faster than the one before
    const med = { 1: median(ms) };
    for (const [label, sp] of [['2×', 2], ['4×', 4], ['Instant', 0]]) {
      await setSpeed(page, label);
      const got = [];
      for (let i = 0; i < 30 && got.length < 5; i++) { const r = await fightStep(page); if (r && !isMoment(r)) got.push(r); }
      med[sp] = median(got.map(roundMs));
    }
    check('M2v2-52', 'speeds 2x, 4x and Instant (settings window) each play a round faster than the speed before',
      med[2] < med[1] && med[4] < med[2] && med[0] < med[4] && med[0] <= 150, `median per round: 1x ${med[1]} ms, 2x ${med[2]} ms, 4x ${med[4]} ms, Instant ${med[0]} ms`);
  } catch (e) {
    check('-', 'part D ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part D: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part E: M2 v3, real engine with a profile, Instant
const E_SEED = 8; // combat v2 (e362fd0): seed 63's run spends Second Breath before the camp; seed 8 keeps it, as 63 did before
/** The part E profile: Second Breath and Lost Technique I (Hunter: Ricochet Bolt), bought by the engine's own rules. */
function eProfile() {
  let p = R.newProfile(); p.echoes = 100000; p.reachedBoss = true; // Second Breath requires "reached the boss once"
  for (const id of ['second_breath', 'sp_h1']) p = R.buyMeta(p, id);
  return p;
}
let E_TWIN = null;
/** The same run in Node (the engine's autoplay choices, as the AUTO helper): facts at the start, in zone 3, at the camp, at the boss, at the end. */
function eTwin(profile) {
  if (E_TWIN) return E_TWIN;
  let s = R.newRun({ classId: 'rogue', seed: E_SEED, content: CONTENT, profile, mapMode: 'rows' });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
  const start = R.resurrectCharges(s);
  let map3 = null;
  for (let n = 0; n < 20000 && s.phase !== 'CAMP' && s.phase !== 'ENDED'; n++) {
    if (!map3 && s.phase === 'MAP' && s.zone.z >= 3) map3 = R.mapView(s);
    s = R.step(s, R.autoAction(s)).state;
  }
  if (s.phase !== 'CAMP') throw new Error(`the Node run of seed ${E_SEED} does not reach the camp (${s.phase})`);
  const camp = R.resurrectCharges(s); const bolt = R.spellInfo(s, 'ricochet_bolt', null).amount; const known = !!s.player.spells.ricochet_bolt;
  s = R.step(s, { type: 'FIGHT_BOSS' }).state;
  const boss = R.resurrectCharges(s);
  s = R.step(s, { type: 'SET_AUTOPLAY', on: true }).state;
  const sources = [];
  for (let n = 0; n < 5000 && s.phase !== 'ENDED' && s.phase !== 'SUMMARY'; n++) { const r = R.step(s, R.autoAction(s)); s = r.state; for (const e of r.events) if (e.t === 'resurrect') sources.push(e.source); }
  const sm = R.summary(s);
  E_TWIN = { start, map3, camp, bolt, known, boss, sources, outcome: sm.outcome, deathAt: sm.death ? sm.death.nodeType : null, metaLeft: s.player.res.meta };
  return E_TWIN;
}
const RES_NAMES = { boon: R.C.CONSUMABLE.ember_of_return.name, second_breath: R.C.META.second_breath.name, ember: R.C.CONSUMABLE.ember_of_return.name };
/** L5: copper as the UI's money text (util.js moneyText): "1 g 20 s 5 c", "12 s 34 c", "42 c". */
const moneyTxt = (copper) => { const c = Math.max(0, Math.round(copper || 0)); const g = Math.floor(c / 10000); const sv = Math.floor((c % 10000) / 100); return [g ? `${g} g` : '', g || sv ? `${sv} s` : '', `${c % 100} c`].filter(Boolean).join(' '); };
const MONEY_RE = '(?:\\d+ g )?(?:\\d+ s )?\\d+ c';
const NOT_FINAL = `${RES_NAMES.second_breath} does not work in the final fight.`;
/** The resurrect list for resurrectCharges().now: names in the engine's order, ×n for more than one, Second Breath marked. */
function resList(now, bossFight) {
  // L6: the boon's charge and an Ember share a name: one count
  const counts = new Map(); for (const k of now) counts.set(RES_NAMES[k], (counts.get(RES_NAMES[k]) || 0) + 1);
  const items = [...counts].map(([nm, n]) => `${nm}${n > 1 ? ` ×${n}` : ''}${nm === RES_NAMES.second_breath ? ' (not in the final fight)' : ''}`);
  return items.length ? items.join(', ') : bossFight ? 'None in this fight' : 'None';
}
const pct1 = (x) => `${Math.round(x * 1000) / 10} %`;
/** Hover an element and read its tooltip (one line, " / " between lines); shotName: a screenshot while it shows. */
const tipOf = async (page, locator, shotName) => {
  await locator.hover();
  const t = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ').replace(/\n/g, ' / ');
  if (shotName) await shot(page, shotName);
  await page.mouse.move(2, 2);
  return t;
};
/** The player frame's resurrect badge: shown, dimmed, its number, where it lies and its tooltip. */
async function badge(page, shotName) {
  const b = page.locator('#player-frame .resc');
  const st = await b.evaluate((el) => ({ hidden: el.classList.contains('hidden'), none: el.classList.contains('none'), n: el.querySelector('.n').textContent }));
  const pl = st.hidden ? null : await placement(b);
  return { ...st, pl, tip: st.hidden ? null : await tipOf(page, b, shotName) };
}
const badgeText = (b) => `badge ${b.hidden ? 'hidden' : `"${b.n}"${b.none ? ' dimmed' : ''}, ${placeText(b.pl)}, tooltip "${b.tip}"`}`;
/** The character sheet's resurrect row and note: key C opens the sheet, key C closes it. */
async function sheetRes(page, shotName) {
  await page.keyboard.press('KeyC'); await idle(page);
  const w = page.locator('#win-character');
  const line = (await w.locator('.resline b').innerText()).trim();
  const note = (await w.locator('.resnote').count()) ? (await w.locator('.resnote').innerText()).trim() : null;
  const pl = await placement(w.locator('.resline'));
  if (shotName) await shot(page, shotName);
  await page.keyboard.press('KeyC'); await idle(page);
  return { line, note, pl };
}
const sheetText = (s) => `sheet "${s.line}"${s.note ? ` note "${s.note}"` : ''} ${placeText(s.pl)}`;

async function partE(browser, W, H) {
  const profile = eProfile();
  const { context, page, errors } = await open(browser, W, H, `seed=${E_SEED}&speed=instant`, profile);
  try {
    const twin = eTwin(profile);
    const FROM = R.C.ZONE_DANGER_FROM;
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    const banners = [{ z: 1, b1: await page.locator('#banner .b1').innerText(), b2: await page.locator('#banner .b2').innerText() }];

    // ---- zone 1 (Second Breath works on the journey): the badge and the character sheet
    let bd = await badge(page); let sh = await sheetRes(page, 'E-sheet-zone1');
    let want = resList(twin.start.now, false);
    check('M2v3-2', `zone 1 hub: the resurrect badge shows ${twin.start.now.length} and, like the character sheet, lists "${want}" (resurrectCharges.now)`,
      twin.start.now.includes('second_breath') && !bd.hidden && !bd.none && bd.n === String(twin.start.now.length) && fullyShown(bd.pl) && bd.tip.includes(want) && !bd.tip.includes(NOT_FINAL)
        && sh.line === want && !sh.note && fullyShown(sh.pl), `${badgeText(bd)} | ${sheetText(sh)}`);
    const mm1 = await tipOf(page, page.locator('#minimap .disc'));
    check('M2v3-1', `zone 1 (levels 1-${R.C.ZONE_LEVELS}): the minimap tooltip has no zone danger line`, !/hit harder/.test(mm1), mm1);

    // ---- setup: the engine's autoplay choices to the first map of zone 3, then the map and minimap tooltips there
    const r1 = await autoRun(page, { zone: 3 });
    if (!r1.at) throw new Error('setup did not reach a map of zone 3');
    await page.waitForTimeout(300);
    const rows = twin.map3.rows; const tips = [];
    // a node of the engine's zone 3 map: { n, r (row, from 1), l (lane) }
    const pickNode = (pred) => { for (const [ri, row] of rows.entries()) for (const [l, n] of row.entries()) if (pred(n)) return { n, r: ri + 1, l }; return null; };
    const plain = pickNode((n) => n.type === 'quest' || n.type === 'grind');
    const multi = pickNode((n) => n.type === 'dungeon') || pickNode((n) => n.type === 'elite' && n.archetypes.length > 1) || pickNode((n) => n.type === 'elite');
    for (const { n, r, l } of [plain, multi].filter(Boolean)) {
      // enemies as the engine builds the fights (src/engine/nodes.js): quest and grind at cl; elite at its level, its
      // escort at cl; dungeon trash at its level, the dungeon boss at bossLevel (M2 v4: dungeon variants take half)
      const foes = n.type === 'dungeon' ? [[n.level, 'trash'], [n.bossLevel, 'dboss']] : n.type === 'elite' ? [[n.level, 'elite'], ...(n.archetypes.length > 1 ? [[n.cl, 'normal']] : [])] : [[n.cl, 'normal']];
      const levels = foes.map(([lv]) => lv);
      const ds = foes.map(([lv, va]) => R.zoneDanger(lv, va) - 1); const lo = Math.min(...ds); const hi = Math.max(...ds);
      const line = `Zone danger: enemies here deal ${hi > lo ? 'up to ' : ''}+${pct1(hi)} damage (above level ${FROM}).`;
      const t = await tipOf(page, page.locator(`#screens button.mnode[data-row="${r}"][data-lane="${l}"]`), `E-map-zone3-${n.type}`);
      tips.push({ n, r, levels, line, t, ok: t.includes(line) });
    }
    check('M2v3-1', `zone 3 map tooltips: the zone danger line with the engine's zoneDanger at the enemies' levels and variants (${tips.map((x) => `${x.n.type} r${x.r}: levels ${x.levels.join('/')}`).join('; ')})`,
      tips.length === 2 && tips.every((x) => x.ok), tips.map((x) => `${x.ok ? 'ok' : 'WRONG'} "${x.t}" (wanted "${x.line}")`).join(' | '));
    const mm3 = await tipOf(page, page.locator('#minimap .disc'));
    const step = R.zoneDanger(FROM + 10, 'normal') - 1; const dstep = R.zoneDanger(FROM + 10, 'trash') - 1;
    const rule = `Enemies above level ${FROM} hit harder: +${pct1(step)} damage per 10 levels (in dungeons +${pct1(dstep)}).`;
    check('M2v4-10', `zone 3: the minimap tooltip states the rule from the engine's zoneDanger (ZONE_DANGER_STEP ${R.C.ZONE_DANGER_STEP}, DUNGEON_DANGER_FRAC ${R.C.DUNGEON_DANGER_FRAC})`,
      Math.abs(step - R.C.ZONE_DANGER_STEP) < 1e-9 && mm3.includes(rule), `${mm3} (wanted "${rule}")`);

    // ---- setup: on to the camp; then the zone banners of the whole run
    const r2 = await autoRun(page);
    let v = await view(page);
    if (v.phase !== 'CAMP') throw new Error(`setup did not reach the camp (phase ${v.phase})`);
    banners.push(...r1.banners, ...r2.banners);
    const zb = banners.filter((b) => b.z <= R.C.ZONE_COUNT);
    const bandOf = (z) => [R.C.ZONE_LEVELS * (z - 1) + 1, R.C.ZONE_LEVELS * z];
    const wantBanner = (z) => { const [a, b] = bandOf(z); return `Levels ${a}–${b}${b > FROM ? ` · Enemies above level ${FROM} hit harder` : ''}`; };
    const badB = zb.filter((b) => b.b2 !== wantBanner(b.z));
    check('M2v3-1', `zone banners: "Enemies above level ${FROM} hit harder" in the zones whose levels pass ${FROM}, not before (${zb.length} zones)`,
      zb.length === R.C.ZONE_COUNT && !badB.length, badB.length ? badB.map((b) => `zone ${b.z}: "${b.b2}" (wanted "${wantBanner(b.z)}")`).join(' | ') : zb.map((b) => `${b.z}: "${b.b2}"`).join(' | '));

    // ---- the camp: Second Breath held, not for the final fight
    await page.waitForTimeout(1300); // the zone banner fades
    bd = await badge(page); sh = await sheetRes(page, 'E-sheet-camp');
    want = resList(twin.camp.now, false);
    check('M2v3-2', `camp: the badge shows ${twin.camp.now.length} and, like the character sheet, lists "${want}"`,
      twin.camp.now.includes('second_breath') && !bd.hidden && bd.n === String(twin.camp.now.length) && bd.tip.includes(want) && sh.line === want && !sh.note && fullyShown(sh.pl),
      `${badgeText(bd)} | ${sheetText(sh)}`);

    // ---- Ricochet Bolt (row 7): the spellbook tooltip, from the spell's constants and spellInfo
    const sp = R.C.SPELL.ricochet_bolt; const b = twin.bolt;
    await page.keyboard.press('KeyP'); await idle(page);
    const row = page.locator('#win-spellbook .sprow').filter({ has: page.locator('.nm', { hasText: /^Ricochet Bolt$/ }) });
    const boltTip = (await row.count()) ? await tipOf(page, row, 'E-ricochet') : '';
    await page.keyboard.press('KeyP'); await idle(page);
    const desc = `then up to ${['no', 'one', 'two', 'three', 'four'][sp.bounces] || sp.bounces} other ${sp.bounces === 1 ? 'enemy' : 'enemies'} for ${Math.round(sp.bounceFrac * 100)} % of the damage`;
    const amt = `Deals about ${b.amount} physical damage to the target, then about ${b.bounceAmount} to up to`;
    check('M2v3-7', `Ricochet Bolt tooltip: "${desc}" (bounces ${sp.bounces}, bounceFrac ${sp.bounceFrac}), the spellInfo amounts ${b.amount} and ${b.bounceAmount}, no "70 %", no "Hits every enemy"`,
      twin.known && boltTip.includes(desc) && boltTip.includes(amt) && !/70 %/.test(boltTip) && !/Hits every enemy/.test(boltTip), boltTip || 'no Ricochet Bolt row in the spellbook');

    // ---- the boss fight: only the charges that work there; Second Breath named as not working
    await page.getByRole('button', { name: 'Face Oruvath' }).click(); await idle(page);
    v = await view(page);
    if (v.phase !== 'BOSS') throw new Error(`Face Oruvath did not start the boss fight (phase ${v.phase})`);
    bd = await badge(page, 'E-badge-boss'); sh = await sheetRes(page, 'E-sheet-boss');
    want = resList(twin.boss.now, true);
    check('M2v3-2', `boss fight, round ${v.round}: the badge shows ${twin.boss.now.length} (resurrectCharges.now: ${twin.boss.now.join(', ') || 'none'}); badge and sheet list "${want}" and say "${NOT_FINAL}"`,
      !twin.boss.now.includes('second_breath') && twin.boss.secondBreath > 0 && !bd.hidden && bd.n === String(twin.boss.now.length) && bd.tip.includes(want) && bd.tip.includes(NOT_FINAL)
        && !bd.tip.includes('Second Breath (not') && sh.line === want && sh.note === NOT_FINAL, `${badgeText(bd)} | ${sheetText(sh)}`);

    // ---- the fight on autoplay (key Z): badge numbers, the resurrect banner and the death screen
    await page.evaluate(() => {
      const rec = window.__e = { counts: [], banners: [], death: [] };
      const bdg = document.querySelector('#player-frame .resc');
      const note = () => { const x = { n: bdg.querySelector('.n').textContent, none: bdg.classList.contains('none'), hidden: bdg.classList.contains('hidden') }; const l = rec.counts[rec.counts.length - 1]; if (!l || l.n !== x.n || l.none !== x.none || l.hidden !== x.hidden) rec.counts.push(x); };
      note(); new MutationObserver(note).observe(bdg, { attributes: true, childList: true, subtree: true, characterData: true });
      const bn = document.querySelector('#banner');
      new MutationObserver(() => { const t = `${bn.querySelector('.b1').textContent} | ${bn.querySelector('.b2').textContent}`; if (rec.banners[rec.banners.length - 1] !== t) rec.banners.push(t); }).observe(bn, { childList: true, subtree: true, characterData: true });
      const dm = document.querySelector('.deathmsg').parentElement;
      new MutationObserver(() => { if (!dm.classList.contains('hidden')) rec.death.push(dm.querySelector('.d2').textContent); }).observe(dm, { attributes: true });
    });
    await page.keyboard.press('KeyZ');
    // blind round 2: autoplay switches off after a revive (app.js noteAutoStop); Z switches it on again, as a player would
    let done = false; let autoStops = 0;
    for (let k = 0; k < 6 && !done; k++) {
      await page.waitForFunction(() => { const x = window.__ui.view(); return x.phase === 'SUMMARY' || !x.autoplay; }, null, { timeout: 120000, polling: 200 }).catch(() => null);
      await idle(page);
      done = await page.evaluate(() => window.__ui.view().phase === 'SUMMARY');
      if (!done && !(await page.evaluate(() => window.__ui.view().autoplay))) { autoStops++; await page.keyboard.press('KeyZ'); }
    }
    const rec = await page.evaluate(() => window.__e);
    check('M2v3-2', `boss fight: autoplay stops after each revive (blind round 2) and Z starts it again (${autoStops} stops, ${twin.sources.length} revives)`, done && autoStops === twin.sources.length, `${autoStops} stops`);
    v = await view(page);
    // D150 naming rule: the banner names the revive itself ("Boon of Return | You return to the fight"), never "Resurrected"
    const resBanners = rec.banners.filter((t) => / \| You return to the fight$/.test(t));
    const wantBanners = twin.sources.map((x) => `${RES_NAMES[x]} | You return to the fight`);
    check('M2v3-2', `boss fight: the resurrects played are the engine's (${twin.sources.join(', ') || 'none'}), and Second Breath is not one of them`,
      done && JSON.stringify(resBanners) === JSON.stringify(wantBanners) && !twin.sources.includes('second_breath'), `${resBanners.join(' / ') || 'no resurrect banner'} (wanted ${wantBanners.join(' / ') || 'none'})`);
    const counts = rec.counts.map((c) => `${c.hidden ? 'hidden' : c.n}${c.none ? ' dimmed' : ''}`);
    check('M2v3-2', 'boss fight: after the last charge that works there, the badge shows 0, dimmed (Second Breath held)',
      done && twin.metaLeft > 0 && rec.counts.length >= 2 && rec.counts[0].n === String(twin.boss.now.length) && rec.counts.some((c) => c.n === '0' && c.none && !c.hidden), counts.join(' -> '));
    const deathText = `${NOT_FINAL} Your journey ends here.`;
    check('M2v3-2', `death in the boss fight with Second Breath unused (${twin.outcome}, at the ${twin.deathAt}): the death screen says "${deathText}"`,
      done && v.outcome === 'death' && twin.deathAt === 'boss' && twin.metaLeft > 0 && rec.death.length >= 1 && rec.death.every((t) => t === deathText), rec.death.join(' | ') || 'no death screen');
  } catch (e) {
    check('-', 'part E ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part E: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part F: M3 meta progression, real engine, Instant
const F_OWNED = ['vigor']; // unlocks the stored profile holds before the run, bought by the engine's rules
// M2 v4 removed Wayfinder (80 Echoes) from the catalogue: the stored profile also holds it, as a profile saved under the
// older catalogue does. The engine ignores the unknown id (no effect, no refund); the Hall and class select must not break.
const F_OLD = { id: 'wayfinder', cost: 80 };
const F_ECHOES = 70; // its balance: with the run's Echoes, Packed Satchel is affordable
const F_BUY = 'satchel'; // the unlock bought in the check (60): it shows at run start (Healing Draughts in the bags)
const F_NEXT_SEED = 7; // typed into the Seed field for the run after the purchase
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // the game's number format (util.js fmtNum)
/** The part F profile, bought by the engine's own rules. */
function fProfile() {
  let p = R.newProfile(); p.echoes = 100000;
  for (const id of F_OWNED) p = R.buyMeta(p, id);
  p.unlocks[F_OLD.id] = 1; p.spent += F_OLD.cost;
  p.echoes = F_ECHOES; p.earned = p.spent + F_ECHOES; p.runs = 2;
  return p;
}
/** A Hunter (Ridgewolf) run on the engine's autoplay choices with this profile, to SUMMARY; null if it reaches the camp. */
function fRun(seed, profile) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, profile, mapMode: 'rows' });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
  let n = 0;
  for (; n < 5000 && s.phase !== 'SUMMARY' && s.phase !== 'CAMP'; n++) s = R.step(s, R.autoAction(s)).state;
  return s.phase === 'SUMMARY' ? { s, n } : null;
}
let F_TWIN = null;
/** The seed of the part F run (the shortest of seeds 1-80 that ends before the camp at level 3 or more) and its facts. */
function fTwin() {
  if (F_TWIN) return F_TWIN;
  const profile = fProfile();
  let best = null;
  for (let seed = 1; seed <= 80; seed++) { const r = fRun(seed, profile); if (r && R.summary(r.s).level >= 3 && (!best || r.n < best.n)) best = { seed, ...r }; }
  if (!best) throw new Error('no seed of 1-80 ends before the camp at level 3 or more');
  const sum = R.summary(best.s);
  const ended = R.step(best.s, { type: 'END_RUN' }).state.result; // what END_RUN stores
  const bought = R.buyMeta(ended.profile, F_BUY);
  let next = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: F_NEXT_SEED, content: CONTENT, profile: bought, mapMode: 'rows' });
  next = R.step(next, { type: 'START_RUN' }).state;
  F_TWIN = { seed: best.seed, steps: best.n, profile, sum, ended, bought, next };
  return F_TWIN;
}
/** Cards of the Hall of Echoes as drawn: id, group kind, state, rank text, the Buy button's text, effect and requirement lines. */
const metaCards = (page) => page.locator('#meta .mcard').evaluateAll((els) => els.map((el) => ({
  id: el.dataset.id, kind: el.closest('.mgroup').dataset.kind, state: el.dataset.state, rk: el.querySelector('.rk').textContent,
  buy: el.querySelector('.buy') ? el.querySelector('.buy').textContent.replace(/ /g, ' ').trim() : null, disabled: el.querySelector('.buy') ? el.querySelector('.buy').disabled : null,
  tag: el.querySelector('.mtag') ? el.querySelector('.mtag').textContent : null, fx: el.querySelector('.mc-fx').textContent, req: el.querySelector('.mc-req') ? el.querySelector('.mc-req').textContent : null,
})));
const stateOf = (o) => (o.rank >= o.ranks ? 'owned' : !o.available ? 'locked' : o.affordable ? 'affordable' : 'unaffordable'); // as the card shows R.metaOffers
const savedProfile = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), PROFILE_KEY);
const sameProfile = (a, b) => !!a && !!b && ['echoes', 'earned', 'spent', 'runs', 'bossKills', 'reachedBoss'].every((k) => a[k] === b[k]) && JSON.stringify(a.unlocks) === JSON.stringify(b.unlocks) && JSON.stringify(a.firstKill) === JSON.stringify(b.firstKill);
const profText = (p) => (p ? `echoes ${p.echoes}, earned ${p.earned}, spent ${p.spent}, runs ${p.runs}, unlocks ${JSON.stringify(p.unlocks)}` : 'none');

async function partF(browser, W, H) {
  const twin = fTwin();
  const { context, page, errors } = await open(browser, W, H, `seed=${twin.seed}&speed=instant`, twin.profile);
  try {
    const M = R.C.META; const after = twin.ended.profile;
    // ---- setup: a Hunter run on the engine's autoplay choices to its end
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    await autoRun(page);
    let v = await view(page);
    if (v.phase !== 'SUMMARY') throw new Error(`setup: seed ${twin.seed} did not end the run (phase ${v.phase})`);
    await page.locator('#screens .summary').waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const sumAfter = (await page.locator('#screens .summary .echo.after').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const spend = page.locator('#screens .summary .sfoot').getByRole('button', { name: /^Spend Echoes/ });
    check('M3-1', `summary (seed ${twin.seed}, ${twin.sum.outcome} at level ${twin.sum.level}, +${twin.sum.echoes.total} Echoes): the balance after the run is the engine's END_RUN profile (${after.echoes}), "Spend Echoes" is there`,
      sumAfter.includes(fmt(after.echoes)) && (await spend.count()) === 1, `"${sumAfter}", Spend Echoes buttons: ${await spend.count()}`);

    // ---- Spend Echoes: END_RUN, then the Hall of Echoes over class select
    await spend.click(); await idle(page);
    v = await view(page);
    const hall = page.locator('#meta');
    const bal = (await hall.locator('.mbal .n').innerText()).trim();
    const tick = (await hall.locator('.mtick').innerText()).trim();
    const saved = await savedProfile(page);
    await shot(page, 'F-hall-after-run');
    check('M3-1', `"Spend Echoes" opens the Hall of Echoes at class select: balance ${after.echoes}, "+${twin.ended.echoes} Echoes from Hunter's run", and the saved profile is END_RUN's`,
      v.phase === 'CREATE' && (await hall.isVisible()) && bal === fmt(after.echoes) && tick.includes(`+${fmt(twin.ended.echoes)} Echoes from ${twin.sum.name}'s run`) && sameProfile(saved, after),
      `phase ${v.phase}, Hall shown ${await hall.isVisible()}, balance "${bal}", ticker "${tick}" | saved: ${profText(saved)} | END_RUN: ${profText(after)}`);
    const hist = (await hall.locator('.mhist').innerText()).replace(/\n/g, ' / ');
    const hunter = (await hall.locator('.mh-cls[data-cls="hunter"]').innerText()).replace(/\n/g, ' / ');
    const zoneName = CONTENT.zones[twin.sum.reached.zone - 1].name;
    const log = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), HISTORY_KEY);
    check('M3-2', `run log: runs ${after.runs} (profile), Hunter "1 run · best level ${twin.sum.level} · ${zoneName} · slain 0×" and the first-kill bonus of ${R.C.ECHO_FIRST_KILL_CLASS} Echoes waiting; log in localStorage`,
      hist.includes(`Runs ${after.runs}`) && hunter.includes(`1 run · best level ${twin.sum.level} · ${zoneName} · slain 0×`) && hunter.includes(`First-kill bonus`) && hunter.includes(fmt(R.C.ECHO_FIRST_KILL_CLASS))
        && !!log && log.classes.hunter && log.classes.hunter.runs === 1 && log.classes.hunter.bestLevel === twin.sum.level,
      `${hist} | log ${JSON.stringify(log)}`);

    // ---- the catalogue: every offer of R.metaOffers in its kind's group, with rank, cost and state
    const offers = R.metaOffers(after);
    const cards = await metaCards(page);
    const wrong = offers.filter((o) => {
      const c = cards.find((x) => x.id === o.id);
      if (!c) return true;
      const cost = o.nextCost == null ? null : o.nextCost > 0 ? fmt(o.nextCost) : 'Free';
      return c.kind !== o.kind || c.state !== stateOf(o) || c.rk !== `${o.rank}/${o.ranks}` || (stateOf(o) === 'owned' ? !c.tag : !(c.buy && c.buy.endsWith(cost)) || c.disabled !== !o.affordable);
    });
    const states = cards.reduce((m, c) => ({ ...m, [c.state]: (m[c.state] || 0) + 1 }), {});
    check('M3-1', `catalogue: all ${offers.length} offers of R.metaOffers, each in its kind's group (${[...new Set(offers.map((o) => o.kind))].join(', ')}), with rank/ranks, next cost and state`,
      cards.length === offers.length && !wrong.length && states.affordable && states.unaffordable && states.locked, // owned: after the purchase below (M2 v4: Vigor has 4 ranks)
      wrong.length ? wrong.slice(0, 4).map((o) => `${o.id}: ${JSON.stringify(cards.find((x) => x.id === o.id) || 'missing')} (engine ${stateOf(o)} ${o.rank}/${o.ranks} cost ${o.nextCost})`).join(' | ') : `${cards.length} cards: ${JSON.stringify(states)}`);
    const fxOf = (id) => (cards.find((c) => c.id === id) || {}).fx || '';
    const reqOf = (id) => (cards.find((c) => c.id === id) || {}).req || '';
    const want = [
      ['vigor', `+${Math.round(M.vigor.hpPct * 1000) / 10} % max health per rank`], ['pockets', `+${M.pockets.slots} bag slots per rank`], // M2b v6: 0.5 %
      ['satchel', `Start with ${M.satchel.potions} ${R.C.CONSUMABLE.healing_draught.name}s`],
      ['heirloom_blade', `item level ${M.heirloom_blade.ilvl}`], ['sp_h1', R.C.SPELL[M.sp_h1.spell].name],
    ];
    const badFx = want.filter(([id, t]) => !fxOf(id).includes(t));
    check('M3-1', `effect texts carry the catalogue's numbers (${want.map(([id]) => id).join(', ')}); locked cards name what they need (Alchemist's Notes: ${M[M.alchemist.req[0]].name})`,
      !badFx.length && reqOf('alchemist').includes(M[M.alchemist.req[0]].name) && reqOf('second_breath').includes('reached once'),
      badFx.length ? badFx.map(([id, t]) => `${id}: "${fxOf(id)}" (wanted "${t}")`).join(' | ') : `alchemist "${reqOf('alchemist')}", second_breath "${reqOf('second_breath')}"`);

    // ---- M2 v4: the stored profile holds Wayfinder (older catalogue): no card for it, no text for it, Swift Boots not locked by it
    const hallText = await hall.innerText();
    const sb = cards.find((c) => c.id === 'swift_boots');
    if (M[F_OLD.id]) check('M2v4-7', `the engine still lists ${F_OLD.id} (before M2 v4): no check of the removed entry`, true, '');
    else check('M2v4-7', `a profile holding ${F_OLD.id} (removed in M2 v4): the Hall shows no card or text for it, ${M.swift_boots.name} is ${sb && sb.state} (req ${JSON.stringify(M.swift_boots.req)}), the saved unlock stays`,
      !cards.some((c) => c.id === F_OLD.id) && !/Wayfinder|costs no time/i.test(hallText) && sb && sb.state !== 'locked' && !sb.req && (saved.unlocks || {})[F_OLD.id] === 1,
      `cards ${cards.map((c) => c.id).join(',')} | swift_boots ${JSON.stringify(sb)} | saved unlocks ${JSON.stringify(saved.unlocks)}`);

    // ---- tooltips: an affordable card and a locked one
    const tSat = await tipOf(page, hall.locator(`.mcard[data-id="${F_BUY}"] .mc-fx`));
    const tAlc = await tipOf(page, hall.locator('.mcard[data-id="alchemist"] .mc-fx'));
    const costRe = new RegExp(`Cost:[\\s/]*${fmt(M[F_BUY].costs[0])}\\b`);
    check('M3-4', `tooltips: name, rank, cost (${M[F_BUY].costs[0]}) and "Click Buy" on ${M[F_BUY].name}; the requirement not met on ${M.alchemist.name}`,
      tSat.includes(M[F_BUY].name) && tSat.includes('Rank 0/1') && costRe.test(tSat) && tSat.includes('Click Buy') && tAlc.includes(`✗ Requires: Own ${M[M.alchemist.req[0]].name}`),
      `${tSat} || ${tAlc}`);

    // ---- buy Packed Satchel
    const cost = offers.find((o) => o.id === F_BUY).nextCost;
    await hall.locator(`.mcard[data-id="${F_BUY}"]`).getByRole('button', { name: `Buy ${M[F_BUY].name}` }).click(); await idle(page);
    await page.waitForTimeout(150);
    const bal2 = (await hall.locator('.mbal .n').innerText()).trim();
    const cards2 = await metaCards(page);
    const sat = cards2.find((c) => c.id === F_BUY); const alc = cards2.find((c) => c.id === 'alchemist');
    const tick2 = (await hall.locator('.mtick').innerText()).trim();
    const chip = (await hall.locator(`.mn-chip[data-id="${F_BUY}"]`).count()) ? (await hall.locator(`.mn-chip[data-id="${F_BUY}"]`).innerText()).trim() : null;
    const saved2 = await savedProfile(page);
    const offers2 = R.metaOffers(twin.bought);
    await shot(page, 'F-hall-bought');
    check('M3-1', `Buy ${M[F_BUY].name} (${cost}): balance ${after.echoes} -> ${twin.bought.echoes}, the card is owned 1/1, the saved profile is R.buyMeta's`,
      bal2 === fmt(twin.bought.echoes) && sat && sat.state === 'owned' && sat.rk === '1/1' && sameProfile(saved2, twin.bought),
      `balance "${bal2}", card ${JSON.stringify(sat)} | saved: ${profText(saved2)} | buyMeta: ${profText(twin.bought)}`);
    check('M3-2', `purchase feedback: "${M[F_BUY].name}: learned. Next run: ${M[F_BUY].potions} ${R.C.CONSUMABLE.healing_draught.name}s in your bags", the next-run line, and ${M.alchemist.name} opens (${stateOf(offers2.find((o) => o.id === 'alchemist'))})`,
      tick2.includes(`${M[F_BUY].name}: learned.`) && tick2.includes(`${M[F_BUY].potions} ${R.C.CONSUMABLE.healing_draught.name}s in your bags`) && tick2.includes(`Now open: ${M.alchemist.name}`)
        && chip === `${M[F_BUY].potions} ${R.C.CONSUMABLE.healing_draught.name}s in your bags` && alc && alc.state === stateOf(offers2.find((o) => o.id === 'alchemist')) && alc.state !== 'locked',
      `ticker "${tick2}" | chip "${chip}" | alchemist ${JSON.stringify(alc)}`);

    // ---- Esc closes the Hall; the Echoes button opens it again; "Choose your hero" closes it
    await page.keyboard.press('Escape'); await idle(page);
    const closed = !(await hall.isVisible()) && (await page.locator('#create .ccard').first().isVisible());
    const eb = page.getByRole('button', { name: 'Echoes', exact: true });
    const ebText = (await eb.innerText()).replace(/\n/g, ' ');
    await eb.click(); await idle(page);
    const reopened = await hall.isVisible();
    await hall.getByRole('button', { name: 'Choose your hero' }).click(); await idle(page);
    check('M3-4', `Esc closes the Hall (class select shows), the Echoes button ("${ebText}") opens it again, "Choose your hero" closes it`,
      closed && ebText.includes(fmt(twin.bought.echoes)) && reopened && !(await hall.isVisible()), `closed by Esc ${closed}, reopened ${reopened}, open now ${await hall.isVisible()}`);

    // ---- the next run starts with the unlock: the bridge's view against a Node START_RUN with the bought profile
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('textbox', { name: 'Run seed' }).fill(String(F_NEXT_SEED));
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    v = await view(page);
    const got = await page.evaluate(() => { const p = window.__ui.view().player; return { maxHp: p.maxHp, slots: p.bag.length, potions: p.bag.filter((b) => b && b.id === 'healing_draught').reduce((a, b) => a + b.count, 0), items: p.bag.filter(Boolean).map((b) => `${b.id || b.name}x${b.count || 1}`).join(',') }; });
    const nt = twin.next; const ntPot = nt.player.bag.filter((b) => b.kind === 'cons' && b.id === 'healing_draught').reduce((a, b) => a + b.qty, 0);
    const ntItems = nt.player.bag.map((b) => `${b.kind === 'cons' ? b.id : b.name}x${b.qty || 1}`).join(',');
    check('M3-1', `new run (seed ${F_NEXT_SEED}): the bridge's view starts with ${M[F_BUY].potions} Healing Draughts (${M[F_BUY].name}), ${R.bagCapacity(nt)} bag slots and ${nt.player.d.maxHp} max health (Vigor 1), as the engine's START_RUN with the bought profile`,
      v.phase === 'ZONE_HUB' && got.potions === M[F_BUY].potions && got.potions === ntPot && got.slots === R.bagCapacity(nt) && got.maxHp === nt.player.d.maxHp && got.items === ntItems,
      `phase ${v.phase}, view ${JSON.stringify(got)} | engine: potions ${ntPot}, slots ${R.bagCapacity(nt)}, maxHp ${nt.player.d.maxHp}, items ${ntItems}`);
  } catch (e) {
    check('-', 'part F ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part F: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  await partFOaths(browser, W, H);
}

/** Part F, Oaths: a profile after the first victory (Hunter); Oaths cost 0 and need a victory (rules 11.2, 11.5). */
async function partFOaths(browser, W, H) {
  let p = R.newProfile(); p.reachedBoss = true; p.bossKills = 1; p.firstKill.hunter = true; p.runs = 4; p.echoes = 40; p.earned = 40;
  const { context, page, errors } = await open(browser, W, H, 'seed=11&speed=instant', p);
  try {
    const O = R.C.OATH; const hall = page.locator('#meta');
    await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
    const before = await page.locator('#create .oaths').count();
    await page.getByRole('button', { name: 'Echoes', exact: true }).click(); await idle(page);
    const card = (await metaCards(page)).find((c) => c.id === 'oaths');
    await hall.locator('.mcard[data-id="oaths"]').getByRole('button', { name: `Buy ${R.C.META.oaths.name}` }).click(); await idle(page);
    const owned = (await metaCards(page)).find((c) => c.id === 'oaths');
    await page.keyboard.press('Escape'); await idle(page);
    const sw = (id) => page.getByRole('switch', { name: O[id].name });
    const texts = {};
    for (const id of R.C.OATH_IDS) texts[id] = (await sw(id).innerText()).replace(/\n/g, ' ');
    check('M3-3', `Oaths (cost ${R.C.META.oaths.costs[0]}, needs a victory): no switches before; bought in the Hall (${card && card.state} -> ${owned && owned.state}); then a switch per Oath on class select with its effect`,
      before === 0 && card && card.state === 'affordable' && /^Buy\s*Free$/.test(card.buy) && owned && owned.state === 'owned'
        && texts.haste.includes(`${tolls(R.C.OATH_HASTE_TIME)} sooner`) && texts.thrift.includes(`×${R.C.OATH_THRIFT_MULT}`) && texts.frailty.includes('No resurrections'),
      `before ${before}, card ${JSON.stringify(card)} -> ${JSON.stringify(owned)} | ${JSON.stringify(texts)}`);
    const tHaste = await tipOf(page, sw('haste'));
    await sw('haste').click(); await idle(page);
    await sw('thrift').click(); await idle(page);
    const v = await page.evaluate(() => window.__ui.view().create.oaths);
    // the engine's multiplier for these Oaths: a Node START_RUN with them sworn
    let tw = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 11, content: CONTENT, profile: R.buyMeta(p, 'oaths'), mapMode: 'rows' });
    for (const o of ['haste', 'thrift']) tw = R.step(tw, { type: 'SET_OATH', oath: o, on: true }).state;
    const mult = R.summary(R.step(tw, { type: 'START_RUN' }).state).echoes.oathMult;
    const foot = (await page.locator('#create .oaths .of').innerText()).trim();
    const checked = await Promise.all(R.C.OATH_IDS.map((id) => sw(id).getAttribute('aria-checked')));
    await shot(page, 'F-create-oaths');
    check('M3-3', `switches send SET_OATH: create.oaths ${JSON.stringify(v)}, aria-checked ${checked.join('/')}, "Echoes from this run ×${mult}" (the engine's oathMult); tooltip "+${Math.round(R.C.OATH_ECHO_BONUS * 100)} % Echoes"`,
      JSON.stringify(v) === '["haste","thrift"]' && checked.join(',') === 'true,false,true' && foot === `Echoes from this run ×${mult}` && tHaste.includes(`+${Math.round(R.C.OATH_ECHO_BONUS * 100)} % Echoes`),
      `foot "${foot}" | tooltip "${tHaste}"`);
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    const run = await page.evaluate(() => ({ phase: window.__ui.view().phase, oaths: window.__ui.view().oaths }));
    check('M3-3', 'the run starts with the Oaths sworn (the bridge view of the run)', run.phase === 'ZONE_HUB' && JSON.stringify(run.oaths) === '["haste","thrift"]', JSON.stringify(run));
  } catch (e) {
    check('-', 'part F (Oaths) ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part F (Oaths): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part G: M2 v4, real engine, Instant
/** The part G profile: owns the Oaths (after a victory) and still holds Wayfinder from the older catalogue (F_OLD). */
function gProfile() {
  let p = R.newProfile(); p.reachedBoss = true; p.bossKills = 1; p.firstKill.hunter = true; p.runs = 5; p.echoes = 30; p.earned = 30 + F_OLD.cost;
  p = R.buyMeta(p, 'oaths');
  p.unlocks[F_OLD.id] = 1; p.spent += F_OLD.cost;
  return p;
}
let G_TWIN = null;
/** The Node run of a seed (Hunter, Ridgewolf, Oath of Haste, the engine's autoplay choices): the first travel and the camp. */
function gRun(seed, profile) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, profile, mapMode: 'rows' });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'SET_OATH', oath: 'haste', on: true }, { type: 'START_RUN' }]) s = R.step(s, a).state;
  let travel = null;
  for (let n = 0; n < 20000 && s.phase !== 'CAMP' && s.phase !== 'ENDED' && s.phase !== 'SUMMARY'; n++) {
    const a = R.autoAction(s);
    const r = R.step(s, a);
    if (!travel && a.type === 'TRAVEL_ON') travel = { z: s.zone.z, before: s.time, spent: r.state.time - s.time };
    s = r.state;
  }
  if (s.phase !== 'CAMP') return null;
  const f = R.step(s, { type: 'FIGHT_BOSS' }).state.fight;
  return { seed, travel, time: s.time, par: R.bossPar(s), asc: f.boss.asc };
}
function gTwin() {
  if (G_TWIN) return G_TWIN;
  const profile = gProfile(); const runs = [];
  // preferred: Ascendancy only because of the Oath (at least one ASC_STEP_TIME past bossPar, less than one past BOSS_TIME_PAR)
  const onlyOath = (r) => r.time >= r.par + R.C.ASC_STEP_TIME && r.time < R.C.BOSS_TIME_PAR + R.C.ASC_STEP_TIME;
  for (let seed = 1; seed <= 60 && !runs.some(onlyOath); seed++) { const r = gRun(seed, profile); if (r && r.travel) runs.push(r); }
  if (!runs.length) throw new Error('no seed of 1-60 reaches the camp');
  const pick = runs.find(onlyOath) || runs[0];
  G_TWIN = { profile, ...pick };
  return G_TWIN;
}

async function partG(browser, W, H) {
  const twin = gTwin();
  const { context, page, errors } = await open(browser, W, H, `seed=${twin.seed}&speed=instant`, twin.profile);
  try {
    const PAR = R.C.BOSS_TIME_PAR - R.C.OATH_HASTE_TIME; // rules 1.7 with the Oath of Haste: what bossPar must give
    await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
    const sw = page.getByRole('switch', { name: R.C.OATH.haste.name });
    await sw.click(); await idle(page);
    const create = await page.evaluate(() => window.__ui.view().create.oaths);
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    let v = await page.evaluate(() => ({ phase: window.__ui.view().phase, oaths: window.__ui.view().oaths }));
    check('M2v4-7', `class select with a profile holding ${F_OLD.id} (older catalogue) and the Oaths: Oath of Haste sworn (${JSON.stringify(create)}), the run starts (seed ${twin.seed})`,
      JSON.stringify(create) === '["haste"]' && v.phase === 'ZONE_HUB' && JSON.stringify(v.oaths) === '["haste"]', JSON.stringify({ create, ...v }));

    // ---- the first Travel on: its tooltip and the tolls it spends
    const r1 = await autoRun(page, { travel: true });
    if (!r1.at) throw new Error('setup: no Travel on choice before the camp');
    await page.waitForTimeout(300);
    const btn = page.locator('#screens .mhead button[data-travel]');
    const tTip = await tipOf(page, btn, 'G-travel');
    const h0 = (await view(page)).time;
    await btn.click(); await idle(page);
    const h1 = (await view(page)).time;
    check('M2v4-7', `Travel on with ${F_OLD.id} in the profile (zone ${r1.at.z}): the tooltip says "Costs ${tolls(R.C.TIME_TRAVEL)}.", the time moves ${h0} -> ${h1} tolls (Node run: +${twin.travel.spent} at ${twin.travel.before})`,
      tTip.includes(`Costs ${tolls(R.C.TIME_TRAVEL)}.`) && !/no time/i.test(tTip) && h1 - h0 === R.C.TIME_TRAVEL && twin.travel.spent === R.C.TIME_TRAVEL && h0 === twin.travel.before,
      tTip);

    // ---- the camp: par from bossPar with the Oath of Haste, and the engine's Ascendancy
    await autoRun(page);
    v = await view(page);
    if (v.phase !== 'CAMP') throw new Error(`setup did not reach the camp (phase ${v.phase})`);
    await page.waitForTimeout(1500); // the zone banner fades
    const foot = (await page.locator('#screens .side .sfoot').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const track = (await page.locator('#tracker').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const mm = await tipOf(page, page.locator('#minimap .disc'));
    await shot(page, 'G-camp-haste');
    // D150 naming rule: no par or Ascendancy in player text; the panel says what the tolls did to Oruvath, the engine's
    // Ascendancy with the Oath of Haste's par (bossPar), and the tracker and the minimap say no tolls (the Furnace's number)
    const ascText = twin.asc > 0 ? `+${Math.round(twin.asc * 100)} % health and damage` : 'Base strength';
    check('M2v4-par', `camp with the Oath of Haste at ${v.time} tolls (bossPar ${twin.par} = ${R.C.BOSS_TIME_PAR} - ${R.C.OATH_HASTE_TIME}): the panel's "Oruvath ${ascText}" (the engine's Ascendancy); no par, Ascendancy or tolls in the panel, the tracker or the minimap`,
      twin.par === PAR && v.time === twin.time && foot.includes(`Oruvath ${ascText}`) && !/\bpar\b|Ascendancy/.test(`${foot} ${track} ${mm}`) && !track.includes(HEAT_WORDS.Units),
      `panel "${foot}" | tracker "${track}" | minimap "${mm}"`);
  } catch (e) {
    check('-', 'part G ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part G: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part H: combat v2 display, real engine
// Seeds chosen with the engine of e362fd0 (combat v2, D49): Hunter seed 16's first fight is a brute (Heavy Smash on its
// turn 2) and a skulker (Signal on its turn 3); Mage seed 30's is a beast and a guardian (its ward is the beast).
const H_SEED = 16;
const H_MAGE_SEED = 30;

/** A Node twin of the page's run: the same seed, then every engine action the page applied (window.__ui.engineLog). */
function makeTwin(seed) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' }); let n = 0;
  return {
    get s() { return s; },
    async sync(page) {
      const log = await page.evaluate(() => window.__ui.engineLog());
      for (const a of log.slice(n)) s = R.step(s, a).state;
      n = log.length;
      return s;
    },
  };
}
/** What a track shows (engine-api.md 6): its entries, the now-entry as it will be played (a replaced one: the basic attack). */
function wantTrack(e) {
  const it = e.intent || {};
  return e.track.map((x) => {
    const now = e.turn >= 1 && x.turn === e.turn; const live = now && !it.cancelled;
    return { turn: x.turn, id: live && it.replaced ? it.id : x.id, est: (live ? it.est : x.est) || 0 };
  });
}
/**
 * The combat v2 display on the page: engage panel, nameplate chips, target frame rows (on hover since D150; read from the
 * DOM), off-balance, bar windows. D150 item 16: no opening ruler (`ruler` counts it, 0). Item 24: `stopped` marks a
 * nameplate whose wind-up was stopped this round (its line says "hit it now"; the off-balance marks give way).
 */
const v2dom = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  return {
    engage: vis(document.querySelector('#engage')), options: [...document.querySelectorAll('#engage .eg-opt[data-opt]')].map((c) => c.dataset.opt),
    spells: [...document.querySelectorAll('#engage .eg-sp')].map((b) => b.dataset.spell), any: !!document.querySelector('#engage .eg-any'),
    ruler: document.querySelectorAll('#ruler').length,
    np: [...document.querySelectorAll('#nameplates .np')].filter((el) => !el.classList.contains('dead')).map((el) => ({
      idx: Number(el.dataset.idx), stopped: el.classList.contains('stopped'), offbal: el.classList.contains('offbal'), obal: vis(el.querySelector('.obal')) ? el.querySelector('.obal').textContent : null,
      frost: el.querySelector('.obal').classList.contains('frost'), role: (el.querySelector('img.role') || { dataset: {} }).dataset.role || null,
      chips: [...el.querySelectorAll('.trk .tk')].map((c) => ({ turn: Number(c.dataset.turn), id: c.dataset.id, est: Number(c.dataset.est), cancel: c.classList.contains('cancel'), ob: c.classList.contains('ob'), big: c.classList.contains('big') })),
    })),
    rows: [...document.querySelectorAll('#target-frame .ttrack .tr')].map((r) => ({ turn: Number(r.dataset.turn), id: r.dataset.id })),
    targetOffbal: document.querySelector('#target-frame').classList.contains('offbal'), targetStopped: document.querySelector('#target-frame').classList.contains('stopped'),
    bar: [...document.querySelectorAll('#actionbar .ab[data-slot]')].map((b) => ({ slot: Number(b.dataset.slot), window: b.classList.contains('window'), else: b.classList.contains('window-else') })),
  };
});
const chipText = (c) => c.map((x) => `${x.turn}:${x.id}:${x.est}`).join(' ');
/** Every living enemy's nameplate shows INTENT_TRACK_LEN chips that match the twin's track; the target frame shows the target's. */
function tracksMatch(d, s, target) {
  const bad = [];
  for (const e of s.fight.enemies.filter((x) => x.alive)) {
    const np = d.np.find((x) => x.idx === e.idx); const want = wantTrack(e);
    if (!np) { bad.push(`no nameplate for ${e.idx}`); continue; }
    if (want.length !== R.C.INTENT_TRACK_LEN || chipText(np.chips) !== chipText(want) || !np.chips[0].big) bad.push(`${e.name}: page ${chipText(np.chips)} vs engine ${chipText(want)}`);
  }
  const t = s.fight.enemies[target];
  if (t && t.alive && d.rows.map((r) => `${r.turn}:${r.id}`).join(' ') !== wantTrack(t).map((x) => `${x.turn}:${x.id}`).join(' ')) bad.push(`target frame rows ${JSON.stringify(d.rows)}`);
  return bad;
}
/** The bar's window highlight follows the engine: R.spellInfo(...).window on the current target (else on another enemy). */
function windowsMatch(d, s, target) {
  const bad = [];
  s.player.bar.forEach((id, slot) => {
    if (!id) return;
    const b = d.bar.find((x) => x.slot === slot);
    const legal = R.isLegal(s, { type: 'CAST', spellId: id, target: R.C.SPELL[id].target === 'enemy' ? target : null });
    const all = R.C.SPELL[id].target === 'all';
    const here = legal && (all ? R.spellInfo(s, id, null).window : R.spellInfo(s, id, target).window);
    const there = legal && !here && !all && s.fight.enemies.some((e) => e.alive && e.idx !== target && R.spellInfo(s, id, e.idx).window);
    if (!!b.window !== !!here || !!b.else !== !!there) bad.push(`${id}: page window ${b.window}/${b.else}, engine ${here}/${there}`);
  });
  return bad;
}
/**
 * Every living enemy's off-balance marker follows R.offBalance (the ribbon names its extra damage taken). D150 item 24: on an
 * enemy whose wind-up was stopped this round the marker gives way to the line over it ("... hit it now"), so none shows there.
 */
function offBalanceMatch(d, s) {
  const bad = [];
  for (const e of s.fight.enemies.filter((x) => x.alive)) {
    const ob = R.offBalance(s, e.idx); const np = d.np.find((x) => x.idx === e.idx);
    if (!np) continue;
    if (np.stopped) { if (np.offbal || np.obal) bad.push(`${e.name}: stopped this round, yet an off-balance marker "${np.obal}"`); continue; }
    const pct = ob ? `+${Math.round(ob.taken * 100)} %` : null;
    if (!!np.offbal !== !!ob || (ob && !(np.obal || '').includes(pct)) || (ob && np.frost !== (ob.status === 'FROZEN'))) bad.push(`${e.name}: page ${np.offbal} "${np.obal}", engine ${JSON.stringify(ob)}`);
  }
  return bad;
}

async function partH(browser, W, H) {
  // ---- Hunter: engage round, the tracks, the Lay Trap preview, the trap's off-balance window
  {
    const { context, page, errors } = await open(browser, W, H, `seed=${H_SEED}&speed=instant`);
    try {
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const twin = makeTwin(H_SEED);
      for (let i = 0; i < 200; i++) { const v = await view(page); if (v.round && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      let s = await twin.sync(page);
      const brute = s.fight.enemies.find((e) => e.arch === 'brute'); const skulker = s.fight.enemies.find((e) => e.arch === 'skulker');
      await page.locator(`#nameplates .np[data-idx="${brute.idx}"]`).click(); await idle(page);
      let d = await v2dom(page);
      const want = R.engageOptions(s).map((o) => o.id);
      await shot(page, 'H-engage');
      check('M2b-2b.6', `round 1 (R.isEngageRound): the engage panel offers the class's options ${want.join(', ')} in order and "any bar spell"; no opening ruler (D150 item 16)`,
        R.isEngageRound(s) && d.engage && d.options.join(',') === want.join(',') && d.any && d.ruler === 0, JSON.stringify({ engage: d.engage, options: d.options, any: d.any, ruler: d.ruler }));
      let bad = tracksMatch(d, s, brute.idx);
      check('M2b-2b.6', `each nameplate and the target frame show the enemy's ${R.C.INTENT_TRACK_LEN} track entries in order, as the engine has them (Node twin of the page's actions)`, !bad.length, bad.join(' | ') || d.np.map((x) => `${x.idx}: ${chipText(x.chips)}`).join(' | '));
      check('M2b-2b.6', 'role badges: brute and skulker; the skulker that will Signal is tagged with its round', d.np.find((x) => x.idx === brute.idx).role === 'brute' && d.np.find((x) => x.idx === skulker.idx).role === 'skulker'
        && (await page.locator(`#nameplates .np[data-idx="${skulker.idx}"] .rtag.look`).textContent()) === `Signal R${skulker.turn0 + skulker.track.find((x) => x.id === 'signal').turn - 1}`, d.np.map((x) => `${x.idx} ${x.role}`).join(', '));
      // hover Lay Trap with the brute targeted: the preview the page shows is R.engagePreview's, drawn on the brute's chips
      await page.locator('#engage .eg-opt[data-opt="lay_trap"]').hover(); await page.waitForTimeout(150);
      const pv = await page.evaluate(() => window.__ui.preview());
      const wantPv = R.engagePreview(s, { type: 'ENGAGE', option: 'lay_trap', target: brute.idx });
      d = await v2dom(page);
      const chips = d.np.find((x) => x.idx === brute.idx).chips;
      const pvRow = wantPv.enemies.find((x) => x.u === brute.idx) || { cancelled: [], offBalance: [] };
      await shot(page, 'H-engage-preview');
      check('M2b-2b.6', `hovering Lay Trap previews R.engagePreview on the brute's track: cancelled turn(s) ${pvRow.cancelled.join(',')}, off-balance on ${pvRow.offBalance.join(',')}`,
        pv && JSON.stringify(pv.data) === JSON.stringify(wantPv) && chips.filter((c) => c.cancel).map((c) => c.turn).join(',') === pvRow.cancelled.join(',') && chips.filter((c) => c.ob).map((c) => c.turn).join(',') === pvRow.offBalance.join(','),
        `page ${JSON.stringify(pv && pv.data)} chips ${JSON.stringify(chips.map((c) => [c.turn, c.cancel, c.ob]))}; engine ${JSON.stringify(wantPv)}`);
      await page.mouse.move(2, 2);
      // W: Lay Trap on the brute. Round 2: no engage panel, no window yet
      await page.keyboard.press('KeyW'); await idle(page);
      s = await twin.sync(page); d = await v2dom(page);
      const last = (await page.evaluate(() => window.__ui.engineLog())).slice(-1)[0];
      bad = [...tracksMatch(d, s, brute.idx), ...offBalanceMatch(d, s), ...windowsMatch(d, s, brute.idx)];
      check('M2b-2b.6', 'key W sends ENGAGE lay_trap on the target; round 2: no engage panel (ENGAGE is legal in round 1 only), tracks, markers and bar match the engine',
        last.type === 'ENGAGE' && last.option === 'lay_trap' && last.target === brute.idx && s.fight.round === 2 && !R.isEngageRound(s) && !d.engage && !bad.length,
        `${JSON.stringify(last)}; round ${s.fight.round}, engage panel ${d.engage}; ${bad.join(' | ')}`);
      // attack until the trap springs on the Heavy Smash: the brute is off-balance for the next action
      let opened = null;
      for (let r = 0; r < 4 && !opened; r++) {
        await page.keyboard.press('KeyA'); await idle(page);
        s = await twin.sync(page); d = await v2dom(page);
        if (!s.fight || s.fight.over) break;
        if (d.engage) { check('M2b-2b.6', `no engage panel in round ${s.fight.round}`, false, 'the panel is shown'); break; }
        if (s.fight.enemies.some((e) => e.alive && R.offBalance(s, e.idx))) opened = { round: s.fight.round, d, s };
      }
      if (opened) {
        await shot(page, 'H-offbalance');
        const tgt = await page.evaluate(() => window.__ui.target());
        bad = [...offBalanceMatch(opened.d, opened.s), ...windowsMatch(opened.d, opened.s, tgt), ...tracksMatch(opened.d, opened.s, tgt)];
        const bchips = opened.d.np.find((x) => x.idx === brute.idx).chips;
        // D150 item 24: when that Heavy Smash was the brute's wind-up, the line over it says "stopped ... hit it now" and is the mark
        const bnp = opened.d.np.find((x) => x.idx === brute.idx);
        check('M2b-2b.6', `round ${opened.round}: the trap cancels the brute's Heavy Smash (now chip struck, off-balance) and the off-balance marker (or, for a stopped wind-up, its line) and the bar's window highlight appear where R.offBalance and R.spellInfo(...).window say`,
          !bad.length && bchips[0].cancel && (bchips[0].ob || bnp.stopped) && (bnp.offbal || bnp.stopped) && opened.d.bar.some((b) => b.window) && (tgt !== brute.idx || opened.d.targetOffbal || opened.d.targetStopped),
          `${bad.join(' | ')} brute now chip ${JSON.stringify(bchips[0])}; bar ${JSON.stringify(opened.d.bar.filter((b) => b.window || b.else))}`);
      } else check('M2b-2b.6', 'the trap opens an off-balance window on the brute within 4 rounds', false, 'no enemy off-balance');
    } catch (e) {
      check('-', 'part H (Hunter) ran to the end', false, e.message.split('\n')[0]);
    }
    check('-', 'part H (Hunter): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- Mage: Pre-cast lists the engine's spells; Binding Glyph freezes the beast, which counts as off-balance
  {
    const { context, page, errors } = await open(browser, W, H, `seed=${H_MAGE_SEED}&speed=instant`);
    try {
      await page.locator('#create .ccard[data-cls="mage"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const twin = makeTwin(H_MAGE_SEED);
      for (let i = 0; i < 200; i++) { const v = await view(page); if (v.round && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      let s = await twin.sync(page);
      const beast = s.fight.enemies.find((e) => e.arch === 'beast') || s.fight.enemies[0];
      await page.locator(`#nameplates .np[data-idx="${beast.idx}"]`).click(); await idle(page);
      let d = await v2dom(page);
      const pre = R.engageOptions(s).find((o) => o.id === 'precast');
      check('M2b-2b.6', `Mage engage round: Pre-cast offers the bar spells R.engageOptions lists (${pre.spells.map((x) => x.spellId).join(', ')})`, d.engage && d.spells.join(',') === pre.spells.map((x) => x.spellId).join(','), JSON.stringify(d.spells));
      await page.keyboard.press('KeyW'); await idle(page);
      s = await twin.sync(page); d = await v2dom(page);
      const ob = R.offBalance(s, beast.idx);
      await shot(page, 'H-mage-frozen');
      const bad = [...offBalanceMatch(d, s), ...windowsMatch(d, s, beast.idx), ...tracksMatch(d, s, beast.idx)];
      check('M2b-2b.6', 'Binding Glyph: the frozen beast is marked as an off-balance window (FROZEN, frost ribbon) and the bar highlights the spells that land in it, as the engine says',
        ob && ob.status === 'FROZEN' && !bad.length && d.np.find((x) => x.idx === beast.idx).frost && d.bar.some((b) => b.window), `${JSON.stringify(ob)}; ${bad.join(' | ')}`);
    } catch (e) {
      check('-', 'part H (Mage) ran to the end', false, e.message.split('\n')[0]);
    }
    check('-', 'part H (Mage): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part I: the heat meter, real engine
// Both seeds are chosen at run time on Node runs (the engine still changes under combat v2.1): iPick for the rows run on
// the slow policy, iExpPick for the expedition run (?expedition=1) on the engine's autoplay choices.
const HNAME = HEAT_WORDS.state; // Calm, Smouldering, Burning, Infernal (M2b v7)
const fh = (x) => String(Math.round(Math.abs(x))); // whole tolls (M2b v7: no decimals)
const lineS = (l) => Math.ceil(l - 1e-9); // the Star's line as shown: the engine's, whole and rounded up (changes-m2b-v7.md A row 2)
// D150 (items 1, 25): the meter's one line, "Calm · 18 tolls to spare" ("8 tolls overspent"), and "Boss +N %" only above 0
// D152 (changes-m3-v2.md 4): when the Dimming sets the state (heatView `by` 'dim') the line is the Dimming's own words
// newcomer check 2026-11-15: "The Dimming is near" (heat.js DIM_NEAR_WORDS) says why; the node's clock is in the tooltip
const stand = (x) => { if (x.by === 'dim' && x.dimIn != null) return x.dimIn > 0 ? DIM_NEAR_WORDS : 'You stand in the Dimming'; // demo blind round 1 B: "Raised by the Dimming nearby"
  const past = Math.floor(x.heat + 1e-9); const hand = Math.ceil(-x.heat - 1e-9); return x.heat > 0 && past > 0 ? `${tolls(past)} overspent` : x.heat < 0 && hand > 0 ? `${tolls(hand)} to spare` : 'No tolls to spare'; };
const bossTxt = (a) => (Math.round((a || 0) * 100) > 0 ? `Boss +${Math.round((a || 0) * 100)} %` : '');
const barPct = (x) => (100 * (Math.min(R.C.HEAT_BAR_MAX, Math.max(R.C.HEAT_BAR_MIN, x)) - R.C.HEAT_BAR_MIN)) / (R.C.HEAT_BAR_MAX - R.C.HEAT_BAR_MIN);
const chanceTxt = (p) => { for (let d = 2; d <= 10; d++) { const n = p * d; if (Math.abs(n - Math.round(n)) < 1e-9 && Math.round(n) >= 1) return `${Math.round(n)} in ${d}`; } return `${Math.round(p * 100)} %`; };
/** What a state pays in the meter's short words and the tooltips' long ones (HEAT_GAIN, HEAT_RARITY_UP). */
const payTxt = (s, short) => {
  const g = R.C.HEAT_GAIN[s] || 0; const u = R.C.HEAT_RARITY_UP[s] || 0;
  if (!g && !u) return null;
  return [g ? `+${Math.round(g * 100)} % XP and gold` : null, u ? (short ? `${chanceTxt(u)} drops up` : `${chanceTxt(u)} drops a rarity up`) : null].filter(Boolean).join(short ? ' · ' : ', ');
};
const FIRST_PAYING = R.C.HEAT_STATES.find((s) => payTxt(s, true));
/** D150 item 1: the meter has no pay line any more (no "Burning pays ...", "Spoils: ...", "This node pays ..."). */
const wantPay = () => null;
/** The meter as drawn: its state, texts, the marker, line and Dimming positions (style.left, per cent of the bar). */
const meterDom = (page) => page.evaluate(() => {
  const m = document.querySelector('#heat'); if (!m) return null;
  const q = (s) => m.querySelector(s); const t = (s) => (q(s) ? q(s).textContent.replace(/ /g, ' ') : null);
  const pc = (s) => (q(s) ? parseFloat(q(s).style.left) : null);
  // D150: one line (name, "·", the tolls, Boss only above 0); no title, pay line, Dimming text or "· Dimming" (pay, dimTxt, by2: null)
  return { shown: !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none', state: m.dataset.state, by: m.dataset.by, sname: t('.ht-sname'), by2: q('.ht-by') ? t('.ht-by') : null, num: t('.ht-num'),
    boss: q('.ht-boss').classList.contains('hidden') ? '' : t('.ht-boss'), pay: q('.ht-pay') ? t('.ht-pay') : null, title: q('.ht-title') ? t('.ht-title') : null, segText: [...m.querySelectorAll('.ht-seg')].map((x) => x.textContent).join(''),
    on: [...m.querySelectorAll('.ht-seg.on')].map((x) => x.dataset.hs), mark: pc('.ht-mark.run'), line: pc('.ht-line'),
    runSets: q('.ht-mark.run').classList.contains('sets'), dimShown: !q('.ht-mark.dim').classList.contains('hidden'), dim: pc('.ht-mark.dim'), dimSets: q('.ht-mark.dim').classList.contains('sets'),
    dimTxt: q('.ht-dim') && !q('.ht-dim').classList.contains('hidden') ? t('.ht-dim span') : null, ghost: q('.ht-mark.ghost').classList.contains('hidden') ? null : pc('.ht-mark.ghost'),
    arrow: q('.ht-arrow').classList.contains('hidden') ? null : t('.ht-arrow'),
    // D163 (draft): the clock tag on the label, the line under the bar inside a node, and which marker is the main pointer
    clock: q('.ht-clock') && !q('.ht-clock').classList.contains('hidden') ? `${t('.ht-clock i')} ${t('.ht-clock span')}` : null,
    counts: q('.ht-counts') && !q('.ht-counts').classList.contains('hidden') ? t('.ht-counts span') : null,
    // demo blind round 1 B: "counts as" only inside a place (a node of the map; not a hub's or the camp's service)
    inside: (() => { const v = window.__ui.view(); return v.phase === 'NODE' && !!v.node && v.node.origin !== 'hub' && v.node.origin !== 'camp'; })(),
    runW: q('.ht-mark.run').getBoundingClientRect().width, dimW: q('.ht-mark.dim').getBoundingClientRect().width,
    runHead: getComputedStyle(q('.ht-mark.run'), '::before').display !== 'none' && getComputedStyle(q('.ht-mark.run'), '::before').content !== 'none',
    dimHead: getComputedStyle(q('.ht-mark.dim'), '::before').display !== 'none' && getComputedStyle(q('.ht-mark.dim'), '::before').content !== 'none' };
});
/** Is the meter inside the window and on top at five points (no panel, window or frame over it)? */
const meterCover = (page) => page.evaluate(() => {
  const m = document.querySelector('#heat'); const r = m.getBoundingClientRect(); const bad = [];
  for (const [fx, fy] of [[0.5, 0.5], [0.04, 0.2], [0.96, 0.2], [0.04, 0.85], [0.96, 0.85]]) {
    const x = r.left + r.width * fx; const y = r.top + r.height * fy; const el = document.elementFromPoint(x, y);
    if (!el || !el.closest('#heat')) bad.push(`${Math.round(x)},${Math.round(y)} under ${el ? (el.id ? `#${el.id}` : `.${[...el.classList].join('.')}` || el.tagName) : 'nothing'}`);
  }
  const inside = r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  return { ok: inside && !bad.length && !m.classList.contains('hidden'), text: `rect ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(',')}${inside ? '' : ' (outside)'}${bad.length ? ` covered at ${bad.join('; ')}` : ''}` };
});
/** Differences between the meter drawn and R.heatView (an empty list when they agree). */
function meterDiff(d, hv, camp) {
  const out = [];
  const eq = (k, got, want) => { if (got !== want) out.push(`${k} "${got}" (want "${want}")`); };
  const near = (k, got, want) => { if (got == null || Math.abs(got - want) > 0.05) out.push(`${k} ${got} (want ${want.toFixed(2)})`); };
  if (!d || !d.shown) return ['meter not shown'];
  eq('state', d.state, hv.state); eq('name', d.sname, HNAME[hv.state]); eq('by', d.by, hv.by); eq('numbers', d.num, stand(hv)); eq('boss', d.boss, bossTxt(hv.ascIfPar));
  eq('segment', d.on.join(','), hv.state); eq('pay line', d.pay, wantPay(hv, camp)); eq('title', d.title, null); eq('names on the bar', d.segText, '');
  near('marker', d.mark, barPct(hv.bar.marker)); near('line', d.line, barPct(0));
  eq('arrow', d.arrow, hv.bar.beyond < 0 ? '◀' : hv.bar.beyond > 0 ? '▶' : null);
  if (hv.dimIn === null || hv.dimIn === undefined) { if (d.dimShown || d.dimTxt) out.push('a Dimming marker without a Dimming clock'); } else {
    eq('Dimming text', d.dimTxt, null); // D150 item 8: the clock in words is the map's (its chips and the Dimming panel)
    const seg = { clear: [R.C.HEAT_BAR_MIN, R.C.HEAT_WARM_AT], warm: [R.C.HEAT_WARM_AT, R.C.HEAT_HOT_AT], hot: [R.C.HEAT_HOT_AT, R.C.HEAT_SCORCH_AT], scorched: [R.C.HEAT_SCORCH_AT, R.C.HEAT_BAR_MAX] }[hv.stateDim];
    if (!d.dimShown || d.dim < barPct(seg[0]) || d.dim > barPct(seg[1])) out.push(`Dimming marker ${d.dim} outside ${hv.stateDim} (${barPct(seg[0]).toFixed(1)}-${barPct(seg[1]).toFixed(1)})`);
    eq('the clock that sets the state', `${d.dimSets ? 'dim' : ''}${d.runSets ? 'run' : ''}`, hv.by); eq('by text', d.by2, null);
    // D163 (draft): the tag names the clock that sets the state; the diamond is the main pointer when the Dimming sets it
    // demo blind round 1 B (draft): while the Dimming sets the state the line says so (DIM_NEAR_WORDS), no tag beside it
    eq('clock tag', d.clock, hv.by === 'dim' ? null : '▼ Set by your tolls');
    const main = d.dimW > d.runW && d.dimHead && !d.runHead ? 'dim' : d.runHead && !d.dimHead ? 'run' : `unclear (${JSON.stringify([d.runW, d.dimW, d.runHead, d.dimHead])})`;
    eq('main pointer', main, hv.by);
  }
  if (hv.dimIn === null || hv.dimIn === undefined) eq('clock tag', d.clock, null); // one clock only: no tag
  eq('counts as', d.counts, wantCounts(hv, d.inside));
  return out;
}
/** Demo blind round 1 B (draft): the meter's line inside a place, with its reason when the meter shows another state. */
function wantCounts(hv, inside) {
  if (!hv.node || !hv.node.state || !inside) return null;
  const was = HNAME[hv.node.state];
  return hv.node.state !== hv.state ? `Entered while ${was}: this place still counts as ${was}` : `This place counts as ${was}`;
}
/** A Node twin like makeTwin, with newRun options (mapMode). */
function makeTwinOpts(seed, opts) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows', ...opts }); let n = 0;
  return { get s() { return s; }, async sync(page) { const log = await page.evaluate(() => window.__ui.engineLog()); for (const a of log.slice(n)) s = R.step(s, a).state; n = log.length; return s; } };
}
/** The tooltip's heat block (.tt-heat) and the meter's ghost while an element is hovered. */
async function hoverHeat(page, locator) {
  await locator.hover(); await page.waitForTimeout(60);
  const r = await page.evaluate(() => {
    const tt = document.querySelector('.tooltip.on .tt-heat'); const m = document.querySelector('#heat');
    const g = m.querySelector('.ht-mark.ghost');
    return { tip: tt ? [...tt.children].map((x) => x.textContent.replace(/ /g, ' ')) : null, ghost: g.classList.contains('hidden') ? null : parseFloat(g.style.left), pay: m.querySelector('.ht-pay') ? m.querySelector('.ht-pay').textContent : null };
  });
  await page.mouse.move(2, 2); await page.waitForTimeout(30);
  r.after = await page.evaluate(() => document.querySelector('#heat .ht-mark.ghost').classList.contains('hidden'));
  return r;
}
/** Differences between a hovered choice's tooltip block and ghost and R.heatPreview p. */
/**
 * D150 item 6: the block is one cost line, "Costs 3 tolls." (a wave: "Costs 3 tolls a wave."; ending in the Dimming:
 * "Costs 4 tolls, then a fight in the Dimming."), and a bonus line only when a node entered now pays one ("Burning bonus:
 * +35 % XP and gold, 1 in 2 drops a rarity up."); no "ends Smouldering", no "Pays Calm: no reward", no "Then ...". The ghost
 * marker on the meter stays (no words on the meter).
 */
/**
 * The cost line of a preview p (heat.js costText): engine-2026-11-15 UI need 5, a Dimmed encounter after the action's own
 * tolls (heatPreview parts) splits the sum: "Costs 5 tolls: 3 for the quest, +2 for a fight in the Dimming (it dims before you
 * finish)."; else "Costs N tolls[ a wave][, then a fight in the Dimming]."
 */
const COST_WORD = { walk: 'the walk', pass: 'passing through', travel: 'the Road', bell: 'the Bell', trainer: 'the trainer', vendor: 'the vendor', inn: 'the inn', grind: 'the wave' };
function wantCost(p) {
  const parts = p.parts || []; const dim = parts.find((x) => x.why === 'dimFight'); const own = parts.filter((x) => x.why !== 'dimFight');
  const n = own.reduce((a, x) => a + x.tolls, 0);
  if (dim && own.length && n > 0 && !p.perWave) return `Costs ${tolls(p.time)}: ${n} for ${COST_WORD[own[0].why] || `the ${own[0].why}`}, +${dim.tolls} for a fight in the Dimming${COST_WORD[own[0].why] ? '' : ' (it dims before you finish)'}.`;
  return `Costs ${tolls(p.time)}${p.perWave ? ' a wave' : ''}${p.dimFight ? ', then a fight in the Dimming' : ''}.`;
}
function previewDiff(r, p, opts = {}) {
  const out = [];
  if (!r.tip) return ['no heat block in the tooltip'];
  const head = r.tip[0];
  const wantHead = wantCost(p);
  if (head !== wantHead) out.push(`head "${head}" (want "${wantHead}")`);
  const wantBonus = p.pays && payTxt(p.pays, false) ? `${HNAME[p.pays]} bonus: ${payTxt(p.pays, false)}.` : null;
  if ((r.tip[1] || null) !== wantBonus || r.tip.length > (wantBonus ? 2 : 1)) out.push(`lines ${JSON.stringify(r.tip)} (want the bonus "${wantBonus}")`);
  if (r.tip.some((x) => /Pays|no reward|ends |Then |Dimming in|Star's line/.test(x))) out.push(`old words: ${JSON.stringify(r.tip)}`);
  if (r.ghost == null || Math.abs(r.ghost - barPct(p.heat)) > 0.05) out.push(`ghost ${r.ghost} (want ${barPct(p.heat).toFixed(2)})`);
  if (r.pay !== null) out.push(`meter text "${r.pay}" (want none)`);
  if (!r.after) out.push('the ghost stays after the hover');
  if (opts.chip !== undefined) {
    const want = `${tolls(p.time)}${p.perWave ? '/wave' : ''}`;
    if (!opts.chip || opts.chip.text !== want || (opts.chip.hs || null) !== (p.change ? p.state : null)) out.push(`toll label ${JSON.stringify(opts.chip)} (want "${want}"${p.change ? ` in ${p.state}` : ''})`);
  }
  return out;
}
/**
 * The slow policy, one pure function for the page (slowRun) and the Node seed pick (iPick): every hub service, the
 * reachable node that is no elite or dungeon with the most tolls (a Grind counts its most waves), the most Grind waves;
 * null: the engine's autoplay choice. x: { phase, svcOpen, services, mapChoices: [{ lane, time, perWave, type }], waves,
 * maxWaves }. Returns a UI action (HUB_SERVICE, CHOOSE_NODE, GRIND_SET_WAVES) or null.
 */
function iSlowChoice(x) {
  if (x.phase === 'ZONE_HUB' && !x.svcOpen) { for (const s of ['trainer', 'vendor', 'inn']) if (x.services[s]) return { type: 'HUB_SERVICE', service: s }; }
  const safe = x.mapChoices.filter((c) => c.type !== 'elite' && c.type !== 'dungeon'); const pool = safe.length ? safe : x.mapChoices;
  if (pool.length) { const val = (c) => c.time * (c.perWave ? x.maxWaves : 1); return { type: 'CHOOSE_NODE', lane: [...pool].sort((a, b) => val(b) - val(a) || a.lane - b.lane)[0].lane }; }
  if (x.waves.length) return { type: 'GRIND_SET_WAVES', n: Math.max(...x.waves) };
  return null;
}
const I_USE = { any: 'both', both: 'both', out: 'out', combat: 'combat', passive: 'passive' };
/** What the UI sends on its own after a step (app.js placeNewItems): a new combat consumable onto a free item-bar slot. */
function iUiOwn(prev, next) {
  const p = next.player; if (!p || next.fight || !['ZONE_HUB', 'MAP', 'NODE', 'CAMP'].includes(next.phase)) return [];
  const had = new Set(((prev.player && prev.player.bag) || []).filter((it) => it.kind === 'cons').map((it) => it.id));
  const fresh = [];
  for (const it of p.bag) {
    if (it.kind !== 'cons' || had.has(it.id) || fresh.includes(it.id) || p.itemBar.includes(it.id)) continue;
    const c = R.C.CONSUMABLE[it.id]; const use = I_USE[c.use] || 'both';
    if (!(use === 'combat' || use === 'both') || (c.mana && R.C.CLASS[p.classId].resource !== 'mana')) continue;
    fresh.push(it.id);
  }
  const free = p.itemBar.map((id, i) => (id ? -1 : i)).filter((i) => i >= 0);
  return fresh.slice(0, free.length).map((id, k) => ({ type: 'SET_ITEM_BAR', slot: free[k], itemId: id }));
}
/**
 * True when this step put into the loot window a gear drop that heat raised one rarity: the bridge's heatSteps test (the
 * same step with the node entered in Clear rolls the same items; an item whose rarity differs was raised), limited to the
 * drops the loot window shows, since part I records raised items from the loot window.
 */
function iRaised(before, action, r) {
  const paid = before.node ? before.node.heat : null;
  if (!paid || !((R.C.HEAT_RARITY_UP || {})[paid] > 0)) return false;
  const p0 = before.player;
  const known = new Set([...(p0 ? [...(p0.bag || []), ...Object.values(p0.equipped || {})] : []), ...(before.loot || [])].filter(Boolean).map((it) => it.uid));
  const shown = new Set((r.state.loot || []).map((it) => it.uid));
  const drops = r.events.filter((e) => e.t === 'loot' && e.item && e.item.kind === 'gear' && !known.has(e.item.uid));
  if (!drops.some((e) => shown.has(e.item.uid))) return false;
  try {
    const alt = R.deserialize(R.serialize(before), before.content);
    alt.node.heat = 'clear'; if (alt.fight) alt.fight.heat = 'clear';
    const altDrops = R.step(alt, action).events.filter((e) => e.t === 'loot' && e.item && e.item.kind === 'gear' && !known.has(e.item.uid));
    return altDrops.length === drops.length && drops.some((e, i) => shown.has(e.item.uid) && e.item.rarity !== altDrops[i].item.rarity);
  } catch { return false; }
}
let I_PICK = null;
/**
 * The seed for part I, chosen at run time (the engine changes): the first Hunter seed of 1-80 whose run on the slow policy
 * (a Node run of the same choices, with the UI's own item-bar actions) meets a map step in Warm and in Hot, a node entered
 * Hot, a Grind's wave choice, the camp, the boss fight and a loot window with an item that heat raised (iRaised).
 */
function iPick() {
  if (I_PICK) return I_PICK;
  const INTRO = new Set(['quest', 'elite', 'dungeon', 'treasure']);
  for (let seed = 1; seed <= 80; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    const met = {};
    for (let n = 0; n < 6000 && s.phase !== 'ENDED'; n++) {
      const hv = R.heatView(s);
      const onMap = s.phase === 'MAP' && hv && !s.zone.camp && !(s.loot && s.loot.length);
      if (onMap && hv.next.some((c) => c.action.type === 'CHOOSE_NODE')) met[hv.state] = met[hv.state] ?? s.time;
      if (s.node && s.node.heat === 'hot' && ((INTRO.has(s.node.type) && s.fight && !(s.node.k || 0) && s.fight.round <= 1) || s.node.stage === 'grindSetup')) met.hotNode = met.hotNode ?? s.time;
      if (s.node && s.node.type === 'grind' && s.node.stage === 'grindSetup') met.grind = met.grind ?? s.time;
      if (s.phase === 'CAMP') met.camp = met.camp ?? s.time;
      if (s.fight && s.fight.boss) met.boss = met.boss ?? s.time;
      const x = { phase: s.phase, svcOpen: !!s.service, services: {}, mapChoices: [], waves: [], maxWaves: R.C.GRIND_MAX_WAVES };
      for (const sv of ['trainer', 'vendor', 'inn']) x.services[sv] = R.isLegal(s, { type: 'SERVICE', service: sv });
      if (onMap && s.zone.rows) { const row = R.mapView(s).rows[s.zone.pos.r]; x.mapChoices = hv.next.filter((c) => c.action.type === 'CHOOSE_NODE').map((c) => ({ lane: c.action.lane, time: c.time, perWave: c.perWave, type: row[c.action.lane].type })); }
      if (s.node && s.node.type === 'grind' && s.node.stage === 'grindSetup' && hv) x.waves = hv.next.filter((c) => c.action.type === 'GRIND_SET_WAVES').map((c) => c.action.n);
      const c = iSlowChoice(x);
      const act = !c ? R.autoAction(s) : c.type === 'HUB_SERVICE' ? { type: 'SERVICE', service: c.service } : c;
      const prev = s; const r = R.step(s, act); s = r.state;
      if (met.raised === undefined && iRaised(prev, act, r)) met.raised = s.time;
      for (const o of iUiOwn(prev, s)) s = R.step(s, o).state;
    }
    if (['warm', 'hot', 'hotNode', 'grind', 'camp', 'boss', 'raised'].every((k) => met[k] !== undefined)) { I_PICK = { seed, met }; return I_PICK; }
  }
  throw new Error('no Hunter seed of 1-80 meets part I\'s conditions on the slow policy');
}
let I_EXP_PICK = null;
/** The expedition seed: the first Hunter seed of 1-40 whose autoplay run meets a map step where the Dimming sets the state. */
function iExpPick() {
  if (I_EXP_PICK) return I_EXP_PICK;
  for (let seed = 1; seed <= 40; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'expedition', prep: false });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    for (let n = 0; n < 3000 && s.phase !== 'ENDED'; n++) {
      const hv = R.heatView(s);
      if (s.phase === 'MAP' && hv && hv.by === 'dim' && !(s.loot && s.loot.length)) { I_EXP_PICK = { seed, time: s.time, z: s.zone.z }; return I_EXP_PICK; }
      const prev = s; s = R.step(s, R.autoAction(s)).state;
      for (const o of iUiOwn(prev, s)) s = R.step(s, o).state;
    }
  }
  throw new Error('no Hunter seed of 1-40 meets a map step where the Dimming sets the state');
}
/**
 * The slow policy in the page (setup, as autoRun; iSlowChoice on the view). Runs until a stop condition holds (a string,
 * or { key: source } to learn which) or the run ends. On the way it records every change of the meter's state, the heat
 * toasts and log lines, the coverage of the meter in each new kind of screen, and the items the loot window marks as
 * raised by heat.
 */
const slowRun = (page, stopSrc) => page.evaluate(async ([src, choiceSrc, maxWaves, stateNames]) => {
  const ui = window.__ui;
  const conds = Object.entries(typeof src === 'string' ? { stop: src } : src).map(([k, c]) => [k, new Function('v', `return (${c})(v)`)]);
  const stop = (v) => { const hit = conds.find(([, f]) => f(v)); return hit ? hit[0] : null; };
  const rec = window.__heat || (window.__heat = { states: [], toasts: [], logs: [], kinds: {}, raised: [], maxHeat: 0, maxAll: 0 });
  if (!window.__heatObs) {
    window.__heatObs = new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.classList && [...n.classList].some((c) => c.startsWith('heat-'))) rec.toasts.push({ text: n.textContent, cls: n.className });
      const all = [...document.querySelectorAll('#toasts .toast')];
      rec.maxAll = Math.max(rec.maxAll, all.length); rec.maxHeat = Math.max(rec.maxHeat, all.filter((t) => /\bheat-/.test(t.className)).length);
    });
    window.__heatObs.observe(document.querySelector('#toasts'), { childList: true });
    const states = new RegExp(`^The Furnace: (${stateNames.join('|')}) · `); // D150 item 25: the log line, as The Furnace: Burning · 3 tolls overspent
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent && states.test(n.textContent)) rec.logs.push(n.textContent); }).observe(document.querySelector('#combatlog .lines'), { childList: true });
  }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const kindOf = (v) => (v.phase === 'SUMMARY' ? null : v.loot ? `loot:${v.loot.kind}` : v.node && v.node.origin === 'hub' ? `service:${v.node.type}` : v.combat && !v.combat.over ? (v.combat.isBoss ? 'boss fight' : v.combat.engage ? 'engage round' : 'fight')
    : v.phase === 'NODE' && v.node ? `node:${v.node.type}:${v.node.step}` : v.phase);
  const cover = () => {
    const m = document.querySelector('#heat'); const r = m.getBoundingClientRect(); const bad = [];
    for (const [fx, fy] of [[0.5, 0.5], [0.04, 0.2], [0.96, 0.2], [0.04, 0.85], [0.96, 0.85]]) { const el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (!el || !el.closest('#heat')) bad.push(el ? el.id || el.className || el.tagName : 'nothing'); }
    const inside = r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    return { ok: inside && !bad.length && !m.classList.contains('hidden'), bad, rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
  };
  const choose = new Function('x', `return (${choiceSrc})(x)`);
  const slow = (v) => {
    const onMap = v.phase === 'MAP' && v.heat && v.zone.rows.length && !v.loot;
    const x = { phase: v.phase, svcOpen: !!(v.node && v.node.origin === 'hub'), services: v.legal.services || {}, mapChoices: [], waves: [], maxWaves };
    if (onMap) { const row = v.zone.rows[v.zone.pos.row]; x.mapChoices = v.heat.list.filter((c) => c.action.type === 'CHOOSE_NODE').map((c) => ({ lane: c.action.lane, time: c.time, perWave: c.perWave, type: row[c.action.lane].type })); }
    if (v.phase === 'NODE' && v.node && v.node.type === 'grind' && v.node.step === 'intro' && v.heat) x.waves = v.heat.list.filter((c) => c.action.type === 'GRIND_SET_WAVES').map((c) => c.action.n);
    return choose(x) || { type: 'AUTO' };
  };
  for (let n = 0; n < 5000; n++) {
    const v = ui.view();
    if (v.heat && rec.states[rec.states.length - 1] !== v.heat.state) rec.states.push(v.heat.state);
    const k = kindOf(v);
    if (k && !rec.kinds[k]) { await frame(); rec.kinds[k] = cover(); }
    if (v.loot && v.loot.items && v.loot.items.some((it) => it.heatUp && !rec.raised.some((x) => x.uid === it.uid))) {
      await frame();
      const rows = [...document.querySelectorAll('#screens .loot .lrow')].map((r) => ({ nm: r.querySelector('.nm') ? r.querySelector('.nm').firstChild.textContent : '', badge: !!r.querySelector('.heat-badge') }));
      for (const it of v.loot.items) if (it.heatUp && !rec.raised.some((x) => x.uid === it.uid)) rec.raised.push({ uid: it.uid, name: it.name, heatUp: it.heatUp, node: v.node ? v.node.heat : null, lootShown: !!document.querySelector('#screens .loot'), badge: rows.some((r) => r.nm.startsWith(it.name) && r.badge) });
    }
    const hit = stop(v);
    if (hit) { await frame(); return { stopped: true, key: hit, phase: v.phase, time: v.time }; }
    if (v.phase === 'SUMMARY') return { stopped: false, phase: v.phase, time: v.time };
    await ui.act(slow(v)); await ui.idle();
  }
  return { stopped: false, phase: ui.view().phase };
}, [stopSrc, iSlowChoice.toString(), R.C.GRIND_MAX_WAVES, Object.values(HEAT_WORDS.state)]);

async function partI(browser, W, H) {
  const pick = iPick(); const I_SEED = pick.seed;
  const twin = makeTwin(I_SEED);
  const { context, page, errors } = await open(browser, W, H, `seed=${I_SEED}&speed=instant`);
  check('-', `part I seed ${I_SEED} (chosen on Node runs of the slow policy: ${JSON.stringify(pick.met)})`, true, '');
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    // ---- the first hub: the meter, the first-time note, the service cards' previews
    let s = await twin.sync(page); let hv = R.heatView(s);
    const note = await page.locator('#heat-intro').evaluate((el) => ({ shown: !el.classList.contains('hidden') }));
    await shot(page, 'I-hub');
    let d = await meterDom(page); let diff = meterDiff(d, hv, false);
    check('M2b-heat', `hub (${s.time} tolls): the meter shows R.heatView: ${HNAME[hv.state]}, "${stand(hv)}", "${bossTxt(hv.ascIfPar)}", the marker at ${hv.bar.marker} and the Star's line at 0 on a ${R.C.HEAT_BAR_MIN} to ${R.C.HEAT_BAR_MAX} toll bar`, !diff.length, diff.join(' | ') || JSON.stringify(d));
    check('M3-U4', 'the old first-time note is retired (m3-onboarding.md 3.3: hint H16 on the coach line): none on the first hub', !note.shown, JSON.stringify(note));
    const svc = [];
    for (const service of ['trainer', 'vendor', 'inn']) {
      const card = page.locator('#screens .svc-card', { has: page.locator('.nm', { hasText: { trainer: 'Trainer', vendor: 'Vendor', inn: 'Inn' }[service] }) });
      // D150 item 22: a Trainer with nothing to teach (R.trainerView) is greyed with no toll label and no tooltip: no preview
      if (await card.evaluate((el) => el.classList.contains('off'))) {
        const tv = R.trainerView(s); const idle = service === 'trainer' && !tv.useful; // engine-2026-11-14d UI need 10: greyed while `useful` is false
        svc.push(`${service}: ${idle && !(await card.locator('.hrs').count()) ? 'idle, no toll: ok' : `greyed (trainerView ${JSON.stringify(tv)})`}`);
        continue;
      }
      const p = R.heatPreview(s, { type: 'SERVICE', service });
      const chip = await card.locator('.hrs').evaluate((el) => ({ text: el.textContent, hs: el.dataset.hs || null }));
      const r = await hoverHeat(page, card);
      svc.push(`${service}: ${previewDiff(r, p, { chip }).join(', ') || 'ok'}`);
    }
    check('M2b-heat', 'hub: each service card\'s toll label, tooltip ("1 toll, ends Calm", what follows) and the ghost on the meter equal R.heatPreview(SERVICE)', svc.every((x) => x.endsWith('ok')), svc.join(' | '));
    // ---- the run on the slow policy: checkpoints in the order the run meets them (the first map step in Warm, Hot and
    // Scorched, the first node entered Hot, the first Grind)
    const grindCheck = async () => {
      s = await twin.sync(page);
      const btns = page.locator('#screens .dialog .actions button');
      const out = [];
      for (let i = 0; i < await btns.count(); i++) {
        const b = btns.nth(i); const label = (await b.innerText()).replace(NBSP, ' ');
        const n = Number((/^(\d+) wave/.exec(label) || [])[1]);
        const p = R.heatPreview(s, { type: 'GRIND_SET_WAVES', n });
        const chip = await b.locator('.bh').evaluate((x) => ({ text: x.textContent, hs: x.dataset.hs || null }));
        const r = await hoverHeat(page, b);
        out.push(`${label}: ${p ? previewDiff(r, p, { chip }).join(', ') || 'ok' : 'no preview'}`);
      }
      check('M2b-heat', `Grind (${s.time} tolls): each wave button's tolls, tooltip and the meter's ghost equal R.heatPreview(GRIND_SET_WAVES n)`, out.length > 0 && out.every((x) => x.endsWith('ok')), out.join(' | '));
    };
    const mapCheck = async (label) => {
      s = await twin.sync(page); hv = R.heatView(s);
      d = await meterDom(page); diff = meterDiff(d, hv, false);
      check('M2b-heat', `${label} (zone ${s.zone.z}, ${s.time} tolls): the meter equals R.heatView (${HNAME[hv.state]}, "${stand(hv)}", "${bossTxt(hv.ascIfPar)}", pay line "${wantPay(hv, false)}")`, !diff.length, diff.join(' | ') || `${d.state} ${d.num} ${d.boss} marker ${d.mark}`);
      const nodes = page.locator('#screens button.mnode.reach');
      const out = [];
      for (let i = 0; i < await nodes.count(); i++) {
        const el = nodes.nth(i); const lane = Number(await el.getAttribute('data-lane'));
        const p = R.heatPreview(s, { type: 'CHOOSE_NODE', lane });
        const chip = await el.locator('.mhrs').evaluate((x) => ({ text: x.textContent, hs: x.dataset.hs || null })).catch(() => null);
        const r = await hoverHeat(page, el);
        out.push(`lane ${lane} (${fh(p.time)} tolls, ${p.state}${p.change ? ', new' : ''}): ${previewDiff(r, p, { chip }).join(', ') || 'ok'}`);
      }
      const tb = page.locator('#screens .mhead button[data-travel]');
      if (!(await tb.isDisabled())) { const p = R.heatPreview(s, { type: 'TRAVEL_ON' }); const r = await hoverHeat(page, tb); out.push(`Travel on (${fh(p.time)} tolls, ${p.state}): ${previewDiff(r, p).join(', ') || 'ok'}`); }
      check('M2b-heat', `${label}: every reachable node's toll label, tooltip and the meter's ghost (and Travel on's) equal R.heatPreview`, out.length > 0 && out.every((x) => x.endsWith('ok')), out.join(' | '));
    };
    const mapIn = (st) => `(v) => v.phase === 'MAP' && v.heat && v.heat.state === '${st}' && v.heat.list.some((x) => x.action.type === 'CHOOSE_NODE')`;
    const todo = { warm: mapIn('warm'), hot: mapIn('hot'), scorched: mapIn('scorched'), hotNode: "(v) => v.phase === 'NODE' && v.node && v.node.heat === 'hot' && v.node.step === 'intro'",
      grind: "(v) => v.phase === 'NODE' && v.node && v.node.type === 'grind' && v.node.step === 'intro' && !!v.heat" };
    while (Object.keys(todo).length) {
      const r = await slowRun(page, todo);
      if (!r.stopped) break;
      delete todo[r.key];
      if (r.key === 'grind') { await grindCheck(); continue; }
      if (r.key === 'hotNode') {
        // a node entered Hot: the dialog badge and the meter's "This node pays Hot"
        s = await twin.sync(page); hv = R.heatView(s);
        d = await meterDom(page); diff = meterDiff(d, hv, false);
        const badgeTxt = await page.locator('#screens .dialog .wtitle .heat-badge').innerText().catch(() => null);
        await shot(page, 'I-node-hot');
        check('M2b-heat', `a ${s.node.type} node entered Hot: the dialog badge "${HNAME.hot} bonus" (heatView.node; D150: no "spoils", and no pay line on the meter)`,
          !diff.length && hv.node && hv.node.state === 'hot' && (badgeTxt || '').toLowerCase().includes(`${HNAME.hot} bonus`.toLowerCase()), `${diff.join(' | ')} | badge "${badgeTxt}" | node ${JSON.stringify(hv.node)}`);
        continue;
      }
      await shot(page, `I-map-${r.key}`);
      await mapCheck(`map step in ${HNAME[r.key]}`);
      if (r.key === 'warm') {
        // windows over the map: the meter stays uncovered
        const wins = [];
        for (const w of ['character', 'bags', 'spellbook', 'talents', 'questlog', 'map', 'settings']) {
          await page.evaluate((x) => window.__ui.openWin(x), w); await page.waitForTimeout(80);
          const c = await meterCover(page); wins.push(`${w}: ${c.ok ? 'ok' : c.text}`);
          await page.evaluate(() => window.__ui.closeWins()); await page.waitForTimeout(40);
        }
        check('M2b-heat', 'with each window open over the map (character, bags, spellbook, talents, quest log, zone map, settings) the meter is in view and uncovered', wins.every((x) => x.endsWith('ok')), wins.join(' | '));
      }
    }
    const missed = Object.keys(todo).filter((k) => k !== 'scorched');
    if (missed.length) throw new Error(`setup: the slow run of seed ${I_SEED} never met ${missed.join(', ')}`);
    // ---- state changes (D150 item 25): no toast (the meter flashes); a log line each, the meter's own line, one full stop
    let rec = await page.evaluate(() => window.__heat);
    const changes = rec.states.slice(1).map((x, i) => ({ from: rec.states[i], to: x }));
    check('M2b-heat', `no toast on a change of state (${changes.length} so far: ${rec.states.join(' > ')}; D150 item 25)`, changes.length >= 3 && rec.toasts.length === 0 && rec.maxHeat === 0, `toasts: ${rec.toasts.map((t) => t.text).join(' | ')}`);
    const okLog = (l, c) => new RegExp(`^${HEAT_WORDS.Name}: ${HNAME[c.to]} · (\\d+ tolls? (to spare|overspent)|No tolls to spare|${DIM_NEAR_WORDS}|You stand in the Dimming)\\.$`).test(l); // D152: the Dimming's words when it sets the state
    check('M2b-heat', 'the combat log has a line for each change of state: "The Furnace: Burning · 3 tolls overspent." (one full stop, no "..")', rec.logs.length === changes.length && rec.logs.every((l, i) => okLog(l, changes[i])),
      rec.logs.slice(0, 6).join(' | '));
    check('M2b-heat', `the toast stack within its limit during the run (seen: ${rec.maxAll} at once)`, rec.maxAll <= 2, '');

    // ---- the camp: panel, tracker and minimap read heatView, as the meter
    const rc = await slowRun(page, "(v) => v.phase === 'CAMP' && !(v.node && v.node.origin === 'hub') && !v.combat");
    if (!rc.stopped) throw new Error(`setup: the slow run did not reach the camp (${rc.phase})`);
    await page.waitForTimeout(1500); // the zone banner fades
    s = await twin.sync(page); hv = R.heatView(s);
    d = await meterDom(page); diff = meterDiff(d, hv, true);
    const foot = (await page.locator('#screens .side .sfoot').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const track = (await page.locator('#tracker').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const mm = await tipOf(page, page.locator('#minimap .disc'));
    const ascText = hv.ascIfPar > 0 ? `+${Math.round(hv.ascIfPar * 100)} % health and damage` : 'Base strength';
    await shot(page, 'I-camp');
    check('M2b-heat', `camp (${s.time} tolls): the meter (${HNAME[hv.state]}, "${stand(hv)}"${bossTxt(hv.ascIfPar) ? `, "${bossTxt(hv.ascIfPar)}"` : ''}; no pay line) equals R.heatView`, !diff.length, diff.join(' | '));
    check('M2b-heat', `camp: the panel says "Oruvath ${ascText}" (heatView's ascIfPar, as the meter's Boss); D150: no par, Ascendancy, line or tolls in the panel, the tracker or the minimap`,
      foot.includes(`Oruvath ${ascText}`) && !/\bpar\b|Ascendancy|Star's line/.test(`${foot} ${track} ${mm}`) && !track.includes(HEAT_WORDS.Units) && !mm.includes(HEAT_WORDS.Name),
      `panel "${foot}" | tracker "${track}" | minimap "${mm}"`);
    // ---- the boss fight: the meter's "Boss +N %" is the boss frame's Ascendancy
    const rb = await slowRun(page, "(v) => !!(v.combat && v.combat.isBoss && !v.combat.over)");
    if (rb.stopped) {
      s = await twin.sync(page); hv = R.heatView(s);
      d = await meterDom(page);
      const binfo = (await page.locator('#boss-frame .binfo').innerText()).replace(NBSP, ' ');
      // D150: the boss frame says it as the meter does, "Boss +N %" (only above 0), never "Ascendancy"
      check('M2b-heat', `boss fight: the meter's "${bossTxt(hv.ascIfPar)}" is the boss's (+${Math.round(s.fight.boss.asc * 100)} %), and the boss frame says the same`, d.boss === bossTxt(s.fight.boss.asc) && (bossTxt(s.fight.boss.asc) ? binfo.includes(bossTxt(s.fight.boss.asc)) : !/Boss \+/.test(binfo)) && !/Ascendancy/.test(binfo), `${d.boss} | ${binfo.replace(/\n/g, ' ')}`);
    } else check('M2b-heat', 'boss fight reached', false, rb.phase);

    // ---- the summary: the heat card and the Echo line
    const rs = await slowRun(page, "(v) => v.phase === 'SUMMARY'");
    await idle(page); await page.locator('#screens .summary .heatcard').waitFor({ timeout: 10000 });
    s = await twin.sync(page);
    const sm = s.result ? s.result.summary : R.summary(s);
    const card = await page.locator('#screens .summary .heatcard').evaluate((el) => ({ end: el.querySelector('.hc-end').textContent, leg: el.querySelector('.hc-leg').textContent, dots: el.querySelectorAll('.hc-chart .dot').length,
      xv: [...el.querySelectorAll('.hc-chart .xv')].map((x) => x.textContent), foot: el.querySelector('.hc-foot').textContent, strip: el.querySelector('.hc-strip').getAttribute('aria-label') }));
    const recs = sm.heat.trackPerZone; const par = R.bossPar(s); const over = sm.time - par;
    const signedH = (v) => { const k = v > 0 ? Math.floor(v + 1e-9) : Math.ceil(-v - 1e-9); return v > 0 && k ? `+${k}` : v < 0 && k ? `−${k}` : '0'; };
    // D150: the run's tolls, what was overspent or to spare against bossPar, and Oruvath's gain (no par or Ascendancy)
    const wantEnd = sm.reached && sm.reached.camp ? `${HEAT_WORDS.Units}: ${fh(sm.time)} · ${over > 0 ? `${tolls(over)} overspent` : `${tolls(-over)} to spare`} · Oruvath ${sm.ascendancy ? `+${Math.round(sm.ascendancy * 100)} %` : 'at his base strength'}` : null; // the bridge's summary.asc = R.summary ascendancy
    const timeOk = card.leg.startsWith(`${HEAT_WORDS.Units} in each state: `) && R.C.HEAT_STATES.every((st, i) => card.leg.includes(`${HNAME[st]} ${fh(sm.heat.timeByState[i])}`));
    await shot(page, 'I-summary');
    check('M2b-heat', `summary: the heat card's track has ${recs.length} zone records (${recs.length * 2} points, each zone's heat when left under it), tolls by state ${sm.heat.timeByState.join('/')} and "${wantEnd}" (time - bossPar); no par, Ascendancy or "the Star's line"`,
      rs.phase === 'SUMMARY' && card.dots === recs.length * 2 && card.xv.join(',') === recs.map((r) => signedH(r.exit - r.line)).join(',') && timeOk && (!wantEnd || card.end === wantEnd) && !/\bpar\b|Ascendancy|Star's line/.test(JSON.stringify(card)),
      JSON.stringify(card));
    const echo = await page.locator('#screens .summary .card').nth(2).innerText();
    const line = sm.echoes.lines.find((l) => l.id === 'heat');
    check('M2b-heat', `summary: the Echo line of fights won in heat reads "${ECHO_LINE.heat} (${line ? line.count : 0})" with its ${line ? line.echoes : 0} Echoes (summary.echoes.lines "heat")`,
      !!line && new RegExp(`${ECHO_LINE.heat}${line.count > 1 ? ` \\(${line.count}\\)` : ''}\\s*\\+${line.echoes}\\b`).test(echo) && !/Heat \(\d+\)/.test(echo), echo.replace(/\n/g, ' / '));
    // ---- loot heat raised: badges only on items found in a node entered Hot or Scorched
    rec = await page.evaluate(() => window.__heat);
    const raisedOk = rec.raised.length > 0 && rec.raised.every((x) => x.badge && (x.heatUp === 'hot' || x.heatUp === 'scorched') && x.node === x.heatUp && R_UP_OK(x.heatUp));
    check('M2b-heat', `loot heat raised a rarity is marked "▲ Heat" (${rec.raised.length} items), only in nodes entered Hot or Scorched`, raisedOk, JSON.stringify(rec.raised.slice(0, 4)));
    // ---- coverage: the meter is in view and on top on every kind of screen met
    const kinds = Object.entries(rec.kinds);
    const need = ['ZONE_HUB', 'service:vendor', 'service:trainer', 'MAP', 'engage round', 'fight', 'loot:loot', 'CAMP', 'boss fight'];
    check('M2b-heat', `the meter is in view and uncovered on every screen of the run (${kinds.length} kinds: ${kinds.map(([k]) => k).join(', ')})`,
      need.every((k) => rec.kinds[k]) && kinds.every(([, c]) => c.ok), kinds.filter(([, c]) => !c.ok).map(([k, c]) => `${k}: ${c.bad.join(',')} ${c.rect.join(',')}`).join(' | ') || `missing: ${need.filter((k) => !rec.kinds[k]).join(', ')}`);
    check('M2b-heat', 'the meter is hidden on the summary', !(await meterDom(page)).shown, '');
  } catch (e) {
    check('-', 'part I ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part I: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  await partIExp(browser, W, H);
}
const R_UP_OK = (st) => (R.C.HEAT_RARITY_UP[st] || 0) > 0;

/** Part I, expedition runs (?expedition=1): the Dimming's marker and the clock that sets the state. */
async function partIExp(browser, W, H) {
  const I_EXP_SEED = iExpPick().seed;
  const twin = makeTwinOpts(I_EXP_SEED, { mapMode: 'expedition', prep: false });
  const { context, page, errors } = await open(browser, W, H, `seed=${I_EXP_SEED}&speed=instant&expedition=1`);
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    let s = await twin.sync(page); let hv = R.heatView(s);
    let d = await meterDom(page); let diff = meterDiff(d, hv, false);
    check('M2b-heat-exp', `expedition hub (mapMode ${s.mapMode}): the Dimming's marker (its clock in words is the map's, D150 item 8); the line sets the state (by ${hv.by})`, s.mapMode === 'expedition' && !diff.length && d.dimShown && hv.by === 'run', diff.join(' | ') || JSON.stringify(d));
    await page.getByRole('button', { name: 'Set out' }).click(); await idle(page); // M3: the Furnace note is retired (H16), no "Got it" here
    s = await twin.sync(page);
    const mv = R.mapView(s);
    const out = [];
    for (const m of mv.moves.slice(0, 3)) {
      const el = page.locator(`#screens .expmap button.mnode.reach[data-node="${m.nodeId}"]`);
      const p = R.heatPreview(s, { type: 'MOVE', nodeId: m.nodeId });
      const r = await hoverHeat(page, el);
      out.push(`node ${m.nodeId}: ${previewDiff(r, p).join(', ') || 'ok'}`);
    }
    check('M2b-heat-exp', 'expedition map (preview): a move\'s tooltip and the ghost equal R.heatPreview(MOVE), the Dimming tolls after it included', out.length > 0 && out.every((x) => x.endsWith('ok')), out.join(' | '));
    const r = await page.evaluate(async () => {
      const ui = window.__ui;
      for (let n = 0; n < 2000; n++) { const v = ui.view(); if (v.phase === 'SUMMARY') return { ok: false }; if (v.phase === 'MAP' && v.heat && v.heat.by === 'dim') { await new Promise((q) => requestAnimationFrame(() => requestAnimationFrame(q))); return { ok: true, n }; } await ui.act({ type: 'AUTO' }); await ui.idle(); }
      return { ok: false };
    });
    if (!r.ok) throw new Error(`setup: seed ${I_EXP_SEED}'s expedition run met no map step where the Dimming sets the state`);
    s = await twin.sync(page); hv = R.heatView(s);
    d = await meterDom(page); diff = meterDiff(d, hv, false);
    await shot(page, 'I-exp-dim');
    const tip = await tipOf(page, page.locator('#heat'));
    check('M2b-heat-exp', `the Dimming sets the state (zone toll ${s.time - s.zone.start}: ${HNAME[hv.stateDim]} by the Dimming, ${HNAME[hv.stateRun]} by the line): "${HNAME[hv.state]} · ${stand(hv)}" (D150 item 25), its marker in ${hv.stateDim} and marked as the clock that sets it`,
      !diff.length && hv.by === 'dim' && d.by === 'dim', diff.join(' | ') || JSON.stringify(d));
    // D152 (changes-m3-v2.md 4): the tolls figure moves to the tooltip's first line
    const tipWant = `Tolls: ${hv.heat > 0 ? `${hv.heat} overspent` : hv.heat < 0 ? `${-hv.heat} to spare` : 'none to spare'}. The dark near you sets the Furnace now.`;
    check('M2b-heat-exp', `the meter's tooltip, first line under the name: "${tipWant}" (D152); no "Raised by"`, tip.includes(tipWant) && tip.indexOf(tipWant) < tip.indexOf('Every move costs tolls') && !/Raised by|hotter clock/.test(tip), tip);
    await partIExpD163(page, twin);
  } catch (e) {
    check('-', 'part I (expedition) ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part I (expedition): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

/**
 * Part I, expedition (D163, engine-2026-11-20b recommendations; draft lines): a reachable node's tooltip says how many places
 * the Dimming takes while inside (= R.heatPreview(MOVE).dims), inside a node the meter's line under the bar names the state
 * the node counts as (= heatView.node) with the clock tag, and on arrival in zone 2 by the Road the hub and the log carry the
 * toll carry-over line (= heatView.carry; the hub line goes once a toll is spent there). From the map where the Dimming sets
 * the state, on the engine's autoplay choices.
 */
async function partIExpD163(page, twin) {
  const autoStep = () => page.evaluate(async () => { await window.__ui.act({ type: 'AUTO' }); await window.__ui.idle(); await new Promise((q) => requestAnimationFrame(() => requestAnimationFrame(q))); });
  const vw = () => page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, z: v.zone ? v.zone.idx : null, node: !!(v.heat && v.heat.node), onRoad: !!(v.zone && v.zone.exp && v.zone.exp.onRoad) }; });
  // ---- a node tooltip with places taken
  let tipDone = null; let nodeDone = null;
  for (let i = 0; i < 600 && !(tipDone && nodeDone); i++) {
    const v = await vw();
    if (v.phase === 'SUMMARY') break;
    if (!tipDone && v.phase === 'MAP') {
      const s = await twin.sync(page);
      const mv = R.mapView(s);
      const m = mv.moves.map((x) => ({ x, p: R.heatPreview(s, { type: 'MOVE', nodeId: x.nodeId }) })).find((y) => y.p && y.p.pays && !y.p.perWave && y.p.dims && y.p.dims.length > 0 && !y.x.barred);
      if (m) {
        const el = page.locator(`#screens .expmap button.mnode.reach[data-node="${m.x.nodeId}"]`);
        if (await el.count()) {
          await el.hover(); await page.waitForTimeout(120);
          const line = await page.evaluate(() => { const t = document.querySelector('.tooltip.on .xdims'); return t ? t.textContent : null; });
          await shot(page, 'I-exp-dims-tip');
          await page.mouse.move(2, 2);
          const n = m.p.dims.length; const want = `The Dimming takes ${n} ${n === 1 ? 'place' : 'places'} while you are inside.`;
          tipDone = { ok: line === want, line, want, node: m.x.nodeId };
        }
      }
    }
    if (!nodeDone && v.phase === 'NODE' && v.node) {
      const s = await twin.sync(page); const hv = R.heatView(s);
      const d = await meterDom(page); const diff = meterDiff(d, hv, false);
      if (hv.node.state !== hv.state || i > 400) { await shot(page, 'I-exp-in-node'); nodeDone = { ok: !diff.length && d.counts === wantCounts(hv, true), d, diff, hv: [hv.state, hv.by, hv.node.state] }; }
    }
    await autoStep();
  }
  check('M2b-heat-exp', 'D163: a node tooltip says how many places the Dimming takes while you are inside (R.heatPreview(MOVE).dims)', !!tipDone && tipDone.ok, JSON.stringify(tipDone));
  check('M2b-heat-exp', `D163: inside a node the meter says "This place counts as ..." (heatView.node; demo blind round 1 B: "Entered while X: this place still counts as X" when the meter shows another state), with the clock tag and the main pointer of the clock that sets the state${nodeDone ? ` (${nodeDone.hv.join(', ')})` : ''}`,
    !!nodeDone && nodeDone.ok, nodeDone ? (nodeDone.diff.join(' | ') || JSON.stringify({ counts: nodeDone.d.counts, clock: nodeDone.d.clock })) : 'no node met');
  // ---- zone arrival by the Road: the carry-over line on the hub and in the log
  let arrived = null;
  for (let i = 0; i < 1500 && !arrived; i++) {
    const v = await vw();
    if (v.phase === 'SUMMARY') break;
    if (v.phase === 'MAP' && v.z === 1 && v.onRoad) {
      const r = await page.evaluate(async () => { const res = await window.__ui.act({ type: 'TAKE_ROAD' }); await window.__ui.idle(); await new Promise((q) => requestAnimationFrame(() => requestAnimationFrame(q))); return !!(res && res.ok); });
      if (r) { arrived = await vw(); break; }
    }
    await autoStep();
  }
  if (!arrived || arrived.phase !== 'ZONE_HUB' || arrived.z !== 2) { check('M2b-heat-exp', 'D163: zone 2 reached by the Road', false, JSON.stringify(arrived)); return; }
  const s = await twin.sync(page); const hv = R.heatView(s); const c = hv.carry;
  const n = Math.abs(c.carried); const left = c.carried - c.share;
  const want = `Zone 2 gives you ${tolls(c.share)}${!n ? '' : c.carried > 0 ? `, less the ${n} you overspent` : `, plus the ${n} you saved`}: ${left < 0 ? `${-left} to spare` : left === 0 ? 'none to spare' : `still ${left} overspent`}.`;
  const got = await page.evaluate(() => ({ hub: (document.querySelector('#screens .hubcarry') || {}).textContent || null, log: [...document.querySelectorAll('#combatlog .lg-sys')].map((x) => x.textContent).slice(-6) }));
  await shot(page, 'I-exp-arrival');
  check('M2b-heat-exp', `D163: on arrival in zone 2 the hub and the log say "${want}" (heatView.carry; the meter reads ${standText0(hv.heat)})`,
    got.hub === want && got.log.includes(want) && hv.heat === left, JSON.stringify(got));
  // a toll spent at the hub: the line goes (the meter no longer reads the arrival figure)
  const svc = await page.evaluate(() => { const v = window.__ui.view(); const u = (v.hub && v.hub.used) || {}; return ['vendor', 'inn', 'trainer'].find((k) => !u[k]) || null; });
  if (svc) {
    await page.evaluate(async (k) => { await window.__ui.act({ type: 'HUB_SERVICE', service: k }); await window.__ui.idle(); }, svc);
    await page.keyboard.press('Escape'); await idle(page);
    const after = await page.evaluate(() => ({ phase: window.__ui.view().phase, hub: !!document.querySelector('#screens .hubcarry') }));
    check('M2b-heat-exp', `D163: after a toll at the hub (${svc}) the arrival line is gone`, !after.hub, JSON.stringify(after));
  }
}
const standText0 = (h) => (h > 0 ? `${tolls(h)} overspent` : h < 0 ? `${tolls(-h)} to spare` : 'No tolls to spare');

// ------------------------------------------------------------------ part J: combat v2.1 display (wind-ups, stacks, Disrupt)
/**
 * Can a bar spell answer a wind-up? The UI's documented reading of the engine's spell entry (src/ui/tracks.js answerKind, a
 * stopgap until the engine says it per spell): 'stop' for an interrupt, a stun-tagged spell or one that applies HEXED or
 * FROZEN (rules 7.7: these stop it, on a dungeon boss too); 'avoid' for a defensive spell or a taunt against a heavy one.
 */
function jAnswerKind(id, x) {
  const sp = R.C.SPELL[id]; if (!sp || !x || !x.windup) return null;
  const t = sp.tags || [];
  if (t.includes('interrupt') || t.includes('stun') || sp.hex || sp.freeze) return 'stop';
  if (x.heavy && (t.includes('defensive') || sp.taunt)) return 'avoid';
  return null;
}
const J_WINDUP_FIGHTS = new Set(['elite', 'rare', 'dboss']);
/** What a wind-up's tooltip says answers it (src/ui/ui-text.js windupAnswers): an enemy that can be controlled, one immune to control. */
const J_ANSWERS = { // D150 naming rule: a wind-up is stopped, never answered
  control: 'Stop it with an interrupt, a stun or control on its turn, or with an engage option that covers that turn',
  immune: 'Stop it with an interrupt, a stun or a control spell on its turn (it cannot be controlled: each interrupts it), or with Disrupt in the engage round',
};
/**
 * An elite, rare or dungeon-boss round (not the engage round) whose wind-up plays now while a bar spell that stops it (an
 * interrupt or a stun, jAnswerKind 'stop') is legal on it: { idx, name, ability, heavy, spellId, slot } or null.
 */
function jStopNow(s) {
  if (!(s.fight && !s.fight.over && J_WINDUP_FIGHTS.has(s.fight.kind) && !R.isEngageRound(s))) return null;
  const legal = R.legalActions(s);
  for (const e of s.fight.enemies) {
    if (!(e.alive && e.intent && e.intent.windup && !e.intent.interrupted && !e.intent.cancelled)) continue;
    const x = e.track.find((y) => y.turn === e.turn && y.windup); if (!x) continue;
    for (const [slot, id] of s.player.bar.entries()) {
      if (id && jAnswerKind(id, x) === 'stop' && legal.some((a) => a.type === 'CAST' && a.spellId === id && (a.target === e.idx || a.target == null))) {
        return { idx: e.idx, name: e.name, ability: x.name, turn: x.turn, heavy: !!x.heavy, spellId: id, slot, deathblow: !!x.deathblow };
      }
    }
  }
  return null;
}
let J_BOSS = null;
/**
 * An end-boss state in phase 2 with at least two Shards alive (a Node run of the engine's autoplay choices, the first Hunter
 * seed of 1-60 that gets there), serialized for window.__ui.loadState: { seed, ser, shard (a living Shard's index) }.
 */
function jBossState() {
  if (J_BOSS) return J_BOSS;
  for (let seed = 1; seed <= 60; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    for (let n = 0; n < 6000 && s.phase !== 'SUMMARY' && s.phase !== 'ENDED'; n++) {
      const f = s.fight; const shards = f && !f.over && f.kind === 'boss' ? f.enemies.filter((e) => e.alive && e.kind === 'shard') : [];
      if (shards.length >= 2) { J_BOSS = { seed, ser: R.serialize(s), shard: shards[0].idx }; return J_BOSS; }
      s = R.step(s, R.autoAction(s)).state;
    }
  }
  throw new Error('no Hunter seed of 1-60 reaches the end boss with two Shards alive');
}
let J_ROGUE = null;
/**
 * The Rogue seed for part J's bar check, chosen at run time: the first Rogue seed of 1-40 whose run on the engine's
 * autoplay choices (a Node run with the UI's own item-bar actions) meets jStopNow, a wind-up playing with a bar spell that
 * stops it (Throat Jab, Temple Blow).
 */
function jPickRogue() {
  if (J_ROGUE) return J_ROGUE;
  for (let seed = 1; seed <= 40; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'rogue' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    for (let n = 0; n < 4000 && s.phase !== 'SUMMARY' && s.phase !== 'ENDED'; n++) {
      const w = jStopNow(s);
      if (w) { J_ROGUE = { seed, kind: s.fight.kind, ...w }; return J_ROGUE; }
      const prev = s; s = R.step(s, R.autoAction(s)).state;
      for (const o of iUiOwn(prev, s)) s = R.step(s, o).state;
    }
  }
  throw new Error('no Rogue seed of 1-40 meets a wind-up with a bar spell that stops it');
}
/** The first living enemy (immune to control or not) whose track shows a wind-up in turns 1..INTENT_TRACK_LEN, or null. */
const jFoe = (s, immune = false) => s.fight.enemies.find((e) => e.alive && !!e.ccImmune === immune && e.track.some((x) => x.windup && x.turn >= 1 && x.turn <= R.C.INTENT_TRACK_LEN)) || null;
const jRound = (e, x) => (e.turn0 || 1) + x.turn - 1;
const jStack = (e, id) => { const st = (e.st || []).find((x) => x.id === id); return st ? { id, stacks: st.stacks, value: st.value, deathblows: st.deathblows || 0 } : null; };
/** M2b v13: a Deathblow's words where an ordinary wind-up's stood ("Deathblow R3", "Deathblow stopped: ..."; D150: stopped). */
const jWord = (x) => (x && x.deathblow ? 'Deathblow' : 'Wind-up');
const jPct = (x) => `${Math.round((x || 0) * 100)} %`;
let J_PICK = null;
/**
 * The seed for part J, chosen at run time (the engine still changes): the first Hunter seed of 1-40 whose run on these
 * choices (a Node run with the UI's own item-bar actions) meets (A) an elite or rare fight whose engage round shows a
 * wind-up that Lay Trap answers, and the trap answers it; (B) a later elite, rare or dungeon-boss fight whose wind-up lands
 * while the Hunter passes; (C) a dungeon-boss fight where Lay Trap is Disrupt. Elsewhere: the engine's autoplay choices.
 */
function jPick() {
  if (J_PICK) return J_PICK;
  for (let seed = 1; seed <= 40; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    const step = (a) => { const prev = s; const r = R.step(s, a); s = r.state; const ev = [...r.events]; for (const o of iUiOwn(prev, s)) { const r2 = R.step(s, o); s = r2.state; ev.push(...r2.events); } return ev; };
    const over = () => s.phase === 'SUMMARY' || s.phase === 'ENDED';
    const until = (pred) => { for (let n = 0; n < 3000 && !over(); n++) { if (pred()) return true; step(R.autoAction(s)); } return false; };
    const inFight = () => !!(s.fight && !s.fight.over);
    // (A) Lay Trap answers an elite's wind-up
    if (!until(() => s.fight && R.isEngageRound(s) && (s.fight.kind === 'elite' || s.fight.kind === 'rare') && jFoe(s))) continue;
    const a = jFoe(s); const kindA = s.fight.kind;
    const pvA = R.engagePreview(s, { type: 'ENGAGE', option: 'lay_trap', target: a.idx });
    if (!pvA || !(pvA.enemies.find((q) => q.u === a.idx) || { stagger: [] }).stagger.length) continue;
    let staggered = step({ type: 'ENGAGE', option: 'lay_trap', target: a.idx }).some((e) => e.t === 'stagger' && e.u === a.idx);
    for (let n = 0; n < 300 && inFight(); n++) if (step(R.autoAction(s)).some((e) => e.t === 'stagger' && e.u === a.idx)) staggered = true;
    if (!staggered || over()) continue;
    // (B) a wind-up lands while the Hunter passes
    if (!until(() => s.fight && R.isEngageRound(s) && J_WINDUP_FIGHTS.has(s.fight.kind) && (jFoe(s) || jFoe(s, true)))) continue;
    const kindB = s.fight.kind; let landed = false;
    for (let n = 0; n < 6 && inFight() && !landed; n++) if (step({ type: 'PASS' }).some((e) => e.t === 'empower')) landed = true;
    if (!landed) continue;
    for (let n = 0; n < 300 && inFight(); n++) step(R.autoAction(s));
    if (over()) continue;
    // (C) Disrupt on a dungeon boss
    if (!until(() => s.fight && R.isEngageRound(s) && s.fight.kind === 'dboss')) continue;
    const boss = s.fight.enemies.find((e) => e.alive && e.ccImmune);
    const ctl = (R.engageOptions(s) || []).find((o) => o.id === 'lay_trap');
    if (!boss || !ctl || !ctl.disrupt.includes(boss.idx)) continue;
    J_PICK = { seed, a: `${kindA} ${a.name}`, b: kindB, c: boss.name };
    return J_PICK;
  }
  throw new Error('no Hunter seed of 1-40 meets part J\'s conditions');
}
/** The combat v2.1 display on the page: wind-up chips, rows, lines over enemies, stack badges, the ruler, the bar, the engage cards. */
const j21dom = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  const wst = (root) => [...root.querySelectorAll('.wstk .wst')].map((b) => ({ id: b.dataset.id, stacks: Number(b.dataset.stacks), value: Number(b.dataset.value), text: b.textContent, part: b.dataset.part || '' }));
  const tf = document.querySelector('#target-frame');
  return {
    np: [...document.querySelectorAll('#nameplates .np')].filter((el) => !el.classList.contains('dead')).map((el) => {
      const wub = el.querySelector('.wub');
      return { idx: Number(el.dataset.idx), chips: [...el.querySelectorAll('.trk .tk')].map((c) => ({ turn: Number(c.dataset.turn), windup: c.dataset.windup || '', ribbon: (c.querySelector('.b-wu') || {}).textContent || '' })),
        wub: vis(wub) ? { text: wub.textContent, turn: Number(wub.dataset.turn), state: wub.dataset.state } : null, wst: wst(el) };
    }),
    rows: vis(tf) ? [...tf.querySelectorAll('.ttrack .tr')].map((r) => ({ turn: Number(r.dataset.turn), windup: r.dataset.windup || '' })) : [],
    twst: vis(tf) ? wst(tf) : [],
    ruler: document.querySelectorAll('#ruler').length, // D150 item 16: no opening ruler
    bar: [...document.querySelectorAll('#actionbar .ab[data-slot]')].map((b) => ({ slot: Number(b.dataset.slot), ans: b.classList.contains('wu-ans'), else: b.classList.contains('wu-else'), avoid: b.classList.contains('wu-avoid'), hl: b.classList.contains('wu-hl'),
      tag: (b.querySelector('.atag') || {}).textContent || '', wtag: !!b.querySelector('.wtag') })),
    cards: [...document.querySelectorAll('#engage .eg-opt[data-opt]')].map((c) => ({ opt: c.dataset.opt, disrupt: c.dataset.disrupt === '1', answers: c.dataset.answers || '', off: c.classList.contains('off'),
      name: (c.querySelector('.eg-name') || {}).textContent || '', was: (c.querySelector('.eg-was') || {}).textContent || '', tg: (c.querySelector('.eg-tg') || {}).textContent || '' })),
    engage: vis(document.querySelector('#engage')),
  };
});
/** The wind-up badges follow the engine: a chip and a target-frame row carry one exactly for the entries the engine flags `windup`. */
function jBadgesMatch(d, s, target) {
  const bad = [];
  for (const e of s.fight.enemies.filter((x) => x.alive)) {
    const np = d.np.find((x) => x.idx === e.idx); if (!np) { bad.push(`no nameplate for ${e.idx}`); continue; }
    const want = e.track.map((x) => `${x.turn}:${x.windup ? 1 : 0}`).join(' '); const saw = np.chips.map((c) => `${c.turn}:${c.windup ? 1 : 0}`).join(' ');
    if (want !== saw) bad.push(`${e.name} chips ${saw} vs engine ${want}`);
    // a now-entry replaced for another reason than SILENCED is neither answered nor landed: no line for it (tracks.js)
    const voidNow = (x) => e.turn >= 1 && x.turn === e.turn && e.intent && e.intent.replaced && !e.intent.cancelled && e.intent.replaced.reason !== 'silenced';
    const first = e.track.find((x) => x.windup && !voidNow(x));
    if (!!np.wub !== !!first) bad.push(`${e.name}: wind-up line ${np.wub ? 'shown' : 'hidden'}, engine ${first ? `wind-up on turn ${first.turn}` : 'none'}`);
  }
  const t = s.fight.enemies[target];
  if (t && t.alive && d.rows.length && d.rows.map((r) => `${r.turn}:${r.windup ? 1 : 0}`).join(' ') !== t.track.map((x) => `${x.turn}:${x.windup ? 1 : 0}`).join(' ')) bad.push(`target frame rows ${JSON.stringify(d.rows)}`);
  return bad;
}
/** EMPOWERED and STAGGERED badges = the engine's statuses ({ stacks, value }) on every living enemy and on the target frame. */
function jStacksMatch(d, s, target) {
  const bad = [];
  const want = (e) => ['EMPOWERED', 'STAGGERED'].map((id) => jStack(e, id)).filter(Boolean);
  // M2b v13: EMPOWERED's Deathblow share is its own badge ("Deathblow +100 % dmg"): per status, the badges' stacks and values
  // add up to the engine's, each badge states its own share, and a Deathblow badge exactly when EMPOWERED has deathblows (the
  // engine counts them on STAGGERED too; an answered one is a plain Staggered badge)
  const same = (page, w) => w.length === new Set(page.map((p) => p.id)).size && w.every((x) => {
    const mine = page.filter((p) => p.id === x.id);
    return mine.length && mine.reduce((a, p) => a + p.stacks, 0) === x.stacks && Math.abs(mine.reduce((a, p) => a + p.value, 0) - x.value) < 1e-6
      && mine.every((p) => p.text.includes(`${x.id === 'EMPOWERED' ? '+' : '−'}${jPct(p.value)} dmg`)) && mine.some((p) => p.part === 'deathblow') === (x.id === 'EMPOWERED' && x.deathblows > 0);
  });
  for (const e of s.fight.enemies.filter((x) => x.alive)) {
    const np = d.np.find((x) => x.idx === e.idx); if (!np) continue;
    if (!same(np.wst, want(e))) bad.push(`${e.name}: page ${JSON.stringify(np.wst)} vs engine ${JSON.stringify(want(e))}`);
  }
  const t = s.fight.enemies[target];
  if (t && t.alive && !same(d.twst, want(t))) bad.push(`target frame ${JSON.stringify(d.twst)} vs engine ${JSON.stringify(want(t))}`);
  return bad;
}
/** The bar marks what answers a wind-up playing this round, as the engine's state says (its intent, legality, the spell entries). */
function jBarMatch(d, s, target) {
  const bad = [];
  const now = s.fight.enemies.filter((e) => e.alive && e.intent && e.intent.windup && !e.intent.interrupted && !e.intent.cancelled)
    .map((e) => ({ e, x: e.track.find((x) => x.turn === e.turn && x.windup) || { windup: true, heavy: !!e.intent.heavy } }));
  const legal = R.legalActions(s);
  s.player.bar.forEach((id, slot) => {
    if (!id) return;
    const b = d.bar.find((x) => x.slot === slot); const sp = R.C.SPELL[id];
    const kinds = now.map((w) => ({ w, k: jAnswerKind(id, w.x) })).filter((z) => z.k);
    const ok = legal.some((a) => a.type === 'CAST' && a.spellId === id) && kinds.length > 0;
    const onTgt = kinds.some((z) => z.k === 'avoid' || sp.target !== 'enemy' || z.w.e.idx === target);
    const stop = ok && kinds.some((z) => z.k === 'stop');
    const want = { ans: stop && onTgt, else: stop && !onTgt, avoid: ok && !stop };
    if (b.ans !== want.ans || b.else !== want.else || b.avoid !== want.avoid) bad.push(`${id}: page ${JSON.stringify({ ans: b.ans, else: b.else, avoid: b.avoid })} vs ${JSON.stringify(want)}`);
  });
  return bad;
}
/** Each engage card's "answers the wind-up" = R.engagePreview on its target: cancelled wind-ups, and Send the Pet's heavy ones. */
function jCardsMatch(d, s, target) {
  const bad = [];
  for (const o of R.engageOptions(s) || []) {
    if (o.spells) continue;
    const c = d.cards.find((x) => x.opt === o.id); if (!c) { bad.push(`no card ${o.id}`); continue; }
    const none = o.targets.length === 1 && o.targets[0] === null;
    const t = none ? null : o.targets.includes(target) ? target : o.targets[0];
    let want = [];
    if (!o.reason && (none || t != null)) {
      const pv = R.engagePreview(s, { type: 'ENGAGE', option: o.id, target: t });
      for (const q of (pv && pv.enemies) || []) {
        const e = s.fight.enemies[q.u];
        for (const x of e.track) if (x.windup && (q.stagger.includes(x.turn) || (x.heavy && q.pet.includes(x.turn)))) want.push({ k: `${e.idx}:${x.turn}`, r: jRound(e, x) });
      }
      want = want.sort((a, b) => a.r - b.r);
    }
    if (c.answers !== want.map((w) => w.k).join(' ')) bad.push(`${o.id}: page answers "${c.answers}" vs engine "${want.map((w) => w.k).join(' ')}"`);
    const dis = !o.reason && t != null && o.targets.includes(target) && o.disrupt.includes(target);
    if (c.disrupt !== dis || (dis && (c.name !== 'Disrupt' || c.was !== o.name)) || (!dis && c.name !== o.name)) bad.push(`${o.id}: page ${c.disrupt ? 'Disrupt' : 'no Disrupt'} "${c.name}" (${c.was}) vs engine disrupt ${JSON.stringify(o.disrupt)} on ${target}`);
    if (c.off !== !!o.reason || (o.reason && c.tg !== `${o.reason[0].toUpperCase()}${o.reason.slice(1)}`)) bad.push(`${o.id}: page off ${c.off} "${c.tg}" vs engine reason ${JSON.stringify(o.reason)}`);
  }
  return bad;
}
/** Toasts on screen: their text and box, and the boxes of the panels they must not cover. */
const jToasts = (page) => page.evaluate(() => {
  const box = (el) => { if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none') return null; const r = el.getBoundingClientRect(); return r.width ? [r.left, r.top, r.right, r.bottom] : null; };
  return { toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => ({ text: t.textContent, box: box(t) })),
    panels: [['map', '#screens .mapwin'], ['player frame', '#player-frame'], ['pet frame', '#pet-frame'], ['target frame', '#target-frame'], ['ruler', '#ruler'], ['engage panel', '#engage'], ['boss frame', '#boss-frame'],
      ['combat log', '#combatlog'], ['heat meter', '#heat'], ...[...document.querySelectorAll('#nameplates .np:not(.dead)')].map((el, i) => [`nameplate ${i}`, el])]
      .map(([n, sel]) => [n, box(typeof sel === 'string' ? document.querySelector(sel) : sel)]).filter(([, b]) => b) };
});
const jOverlaps = (t) => t.toasts.flatMap((x) => t.panels.filter(([, b]) => x.box && x.box[0] < b[2] && x.box[2] > b[0] && x.box[1] < b[3] && x.box[3] > b[1]).map(([n]) => `"${x.text}" over the ${n}`));
/** A burst of messages: the same refused action three times and two others; the UI's toasts are its answer. */
const jBurst = (page) => page.evaluate(() => { for (const t of ['NOPE', 'NOPE', 'NOPE', 'NOPE_TWO', 'NOPE_THREE']) window.__ui.act({ type: t }); });

async function partJ(browser, W, H) {
  const pick = jPick(); const SEED = pick.seed;
  const twin = makeTwin(SEED);
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  check('-', `part J seed ${SEED} (chosen on Node runs: Lay Trap answers the ${pick.a}'s wind-up, a wind-up lands in a ${pick.b} fight, Disrupt on ${pick.c})`, true, '');
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const nowBad = []; let nowSeen = 0; let barSeen = 0;
  /** AUTO until pred(twin state) holds with the fight on screen. */
  const until = async (pred, label) => {
    for (let n = 0; n < 2500; n++) {
      const s = await twin.sync(page); const v = await view(page);
      if (v.phase === 'SUMMARY') throw new Error(`the run ended before ${label}`);
      if (pred(s) && v.step === 'combat' && v.round) { await frame(); return s; }
      await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
    }
    throw new Error(`no ${label} within 2500 steps`);
  };
  /**
   * One combat action: a key, or 'AUTO' (the engine's autoplay choice, as the Node pick); returns { s } (the twin after it).
   * After it the bar's wind-up marks are checked against the engine's state (none in a round without a wind-up playing).
   */
  const press = async (key) => {
    if (key === 'AUTO') await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); else await page.keyboard.press(key);
    await idle(page); await page.mouse.move(2, 2); await frame();
    const s = await twin.sync(page);
    if (s.fight && !s.fight.over) {
      const d = await j21dom(page); const tgt = await page.evaluate(() => window.__ui.target());
      barSeen++; if (s.fight.enemies.some((e) => e.alive && e.intent && e.intent.windup)) nowSeen++;
      nowBad.push(...jBarMatch(d, s, tgt));
    }
    return { s };
  };
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page); await page.mouse.move(2, 2);
    // ---- stacked toasts on the map: merged and at most two at once, clear of the zone map
    for (let n = 0; n < 60; n++) { const v = await view(page); if (v.phase === 'MAP' && !(await page.evaluate(() => !!window.__ui.view().loot))) break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
    await frame();
    await jBurst(page); await page.waitForTimeout(250);
    const tm = await jToasts(page);
    await shot(page, 'J-toasts-map');
    const merged = tm.toasts.find((t) => /NOPE" ×3$/.test(t.text));
    check('M2b-2b.6', `stacked toasts on the map merge and queue: the same message three times is one toast "×3", at most 2 show at once, none over the zone map, a unit frame, the log or the heat meter`,
      tm.toasts.length <= 2 && !!merged && !jOverlaps(tm).length && tm.panels.some(([n]) => n === 'map'), `${JSON.stringify(tm.toasts.map((t) => t.text))}; ${jOverlaps(tm).join(', ')}`);
    await page.waitForTimeout(2900);
    const tq = await jToasts(page);
    check('M2b-2b.6', 'a queued toast shows when one leaves (NOPE_THREE after the first two)', tq.toasts.some((t) => t.text.includes('NOPE_THREE')), JSON.stringify(tq.toasts.map((t) => t.text)));
    await page.waitForTimeout(2900);

    // ---- (A) an elite's wind-up, from the engage round: badges, the line over it, the ruler, the tooltip, the engage cards
    let s = await until((x) => x.fight && R.isEngageRound(x) && (x.fight.kind === 'elite' || x.fight.kind === 'rare') && jFoe(x), 'an elite fight with a wind-up');
    const a = jFoe(s); const wx = a.track.find((x) => x.windup); const wRound = jRound(a, wx);
    await page.locator(`#nameplates .np[data-idx="${a.idx}"]`).click(); await idle(page); await page.mouse.move(2, 2); await frame();
    let d = await j21dom(page);
    await shot(page, 'J-windup-engage');
    let bad = jBadgesMatch(d, s, a.idx);
    const line = d.np.find((x) => x.idx === a.idx).wub;
    // D150 item 2: the line over it names it and its stakes only (how to stop it is the turn prompt's)
    check('M2b-2b.6', `engage round of the ${s.fight.kind} fight: the wind-up badge is on exactly the entries the engine flags (chips, target frame), and over ${a.name}: "${jWord(wx)} R${wRound}${wx.deathblow ? ' MAIMS if it lands' : ''}", no instruction`,
      !bad.length && line && line.turn === wx.turn && line.text.includes(`${jWord(wx)} R${wRound}`) && (!wx.deathblow || line.text.includes('MAIMS if it lands')) && !/answer it|Answer:|then wait/.test(line.text), `${bad.join(' | ')}; line ${JSON.stringify(line)}`);
    check('M2b-2b.6', 'no opening ruler (D150 item 16: the chips over the enemies say it)', d.ruler === 0, JSON.stringify(d.ruler));
    bad = jCardsMatch(d, s, a.idx);
    check('M2b-2b.6', 'each engage card says which wind-ups it answers exactly as R.engagePreview does (stagger, Send the Pet on a heavy one) on its target', !bad.length, bad.join(' | ') || JSON.stringify(d.cards.map((c) => [c.opt, c.answers])));
    // hover the wind-up chip: the tooltip says what answers it; the bar marks every spell that can
    await page.locator(`#nameplates .np[data-idx="${a.idx}"] .trk .tk[data-turn="${wx.turn}"]`).hover(); await page.waitForTimeout(200); await frame();
    const tip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
    const hv = await page.evaluate(() => window.__ui.windupHover());
    d = await j21dom(page);
    const wantHl = s.player.bar.map((id, slot) => (id && jAnswerKind(id, wx) ? slot : null)).filter((x) => x !== null);
    const sawHl = d.bar.filter((b) => b.hl).map((b) => b.slot);
    await shot(page, 'J-windup-tooltip');
    const wEmp = wx.deathblow ? R.C.DEATHBLOW_EMPOWER : R.C.EMPOWER_DMG; // M2b v13: a Deathblow's stakes
    check('M2b-2b.6', `hovering the wind-up: its tooltip gives the round, the stakes (−${jPct(R.C.STAGGER_DMG)} / +${jPct(wEmp)}${wx.deathblow ? ', MAIMED' : ''}) and what answers it${wx.heavy ? ' (heavy: a full dodge, a ward or the pet too)' : ''}; the bar marks the spells that can (slots ${wantHl.join(',') || 'none'})`,
      tip.includes(`${jWord(wx)}, round ${wRound}`) && tip.includes(`−${jPct(R.C.STAGGER_DMG)}`) && tip.includes(`+${jPct(wEmp)}`) && (!wx.deathblow || tip.includes(`MAIMED: healing you receive −${jPct(R.C.MAIM_HEAL)}`)) && tip.includes(J_ANSWERS.control) && !tip.includes('Disrupt') && tip.includes('full dodge') === !!wx.heavy
        && hv && hv.idx === a.idx && hv.turn === wx.turn && sawHl.join(',') === wantHl.join(','), `hover ${JSON.stringify(hv)}; bar ${sawHl.join(',')}; tooltip: ${tip.replace(/\n/g, ' / ')}`);
    await page.mouse.move(2, 2);
    // W: Lay Trap on it; then the engine's autoplay choices: the trap answers it, STAGGERED as the engine has it
    let r = await press('KeyW');
    const sent = (await page.evaluate(() => window.__ui.engineLog())).slice(-1)[0];
    d = await j21dom(page);
    const pred = (r.s.fight.enemies[a.idx].track.find((x) => x.turn === wx.turn) || {}).cancel;
    check('M2b-2b.6', `key W sends Lay Trap on ${a.name}; the engine predicts its wind-up stopped (cancel.stagger) and the page says so (the chip's state, "your trap: stopped")`,
      sent.type === 'ENGAGE' && sent.option === 'lay_trap' && sent.target === a.idx && pred && pred.stagger && (d.np.find((x) => x.idx === a.idx).chips.find((c) => c.turn === wx.turn) || {}).windup === 'answered'
        && (d.np.find((x) => x.idx === a.idx).wub || { text: '' }).text.includes('your trap'), `${JSON.stringify(sent)}; cancel ${JSON.stringify(pred)}; ${JSON.stringify(d.np.find((x) => x.idx === a.idx))}`);
    let answered = null;
    for (let n = 0; n < 60 && r.s.fight && !r.s.fight.over && !answered; n++) {
      r = await press('AUTO'); // the engine's autoplay choices, as in the Node pick
      const st = r.s.fight && r.s.fight.enemies[a.idx] && jStack(r.s.fight.enemies[a.idx], 'STAGGERED');
      if (st) answered = { s: r.s, d: await j21dom(page), tgt: await page.evaluate(() => window.__ui.target()), log: await logLines(page) };
    }
    if (answered) {
      await shot(page, 'J-answered');
      bad = jStacksMatch(answered.d, answered.s, answered.tgt);
      const logOk = answered.log.some((l) => l.startsWith(`${jWord(wx)} stopped: ${a.name}'s ${wx.name}`) && l.includes(`Staggered: −${jPct(R.C.STAGGER_DMG)} damage`));
      check('M2b-2b.6', `stopped: the STAGGERED badge on ${a.name} (nameplate and target frame) equals the engine's status, and the log says "${jWord(wx)} stopped"`, !bad.length && logOk, `${bad.join(' | ')}; log ${answered.log.slice(-4).join(' / ')}`);
    } else check('M2b-2b.6', `the trap answers ${a.name}'s wind-up`, false, 'no STAGGERED status');
    for (let n = 0; n < 300 && twin.s.fight && !twin.s.fight.over; n++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); await twin.sync(page); }

    // ---- (B) a wind-up lands while the Hunter passes: EMPOWERED as the engine has it
    s = await until((x) => x.fight && R.isEngageRound(x) && J_WINDUP_FIGHTS.has(x.fight.kind) && (jFoe(x) || jFoe(x, true)), 'a second fight with a wind-up');
    let landed = null;
    for (let n = 0; n < 6 && !landed; n++) {
      r = await press('KeyX');
      const e = r.s.fight && r.s.fight.enemies.find((x) => x.alive && jStack(x, 'EMPOWERED'));
      if (e) landed = { s: r.s, e, d: await j21dom(page), tgt: await page.evaluate(() => window.__ui.target()), log: await logLines(page) };
    }
    if (landed) {
      await shot(page, 'J-landed');
      bad = jStacksMatch(landed.d, landed.s, landed.tgt);
      const ldb = jStack(landed.e, 'EMPOWERED').deathblows > 0; // M2b v13: a landed Deathblow, +DEATHBLOW_EMPOWER
    check('M2b-2b.6', `landed: the EMPOWERED badge on ${landed.e.name} equals the engine's status (+${jPct(jStack(landed.e, 'EMPOWERED').value)} dmg${ldb ? ', a Deathblow badge' : ''}) and the log says "${ldb ? 'Deathblow' : 'Wind-up'} landed"`,
        !bad.length && landed.log.some((l) => l.startsWith(`${ldb ? 'Deathblow' : 'Wind-up'} landed: ${landed.e.name}'s`) && l.includes(`Empowered: +${jPct(ldb ? R.C.DEATHBLOW_EMPOWER : R.C.EMPOWER_DMG)} damage`)), `${bad.join(' | ')}; log ${landed.log.slice(-4).join(' / ')}`);
    } else check('M2b-2b.6', 'a wind-up lands while the Hunter passes', false, 'no EMPOWERED status');
    for (let n = 0; n < 300 && twin.s.fight && !twin.s.fight.over; n++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); await twin.sync(page); }

    // ---- (C) a dungeon boss: the control option is Disrupt, as R.engageOptions says
    s = await until((x) => x.fight && R.isEngageRound(x) && x.fight.kind === 'dboss', 'a dungeon-boss fight');
    const boss = s.fight.enemies.find((e) => e.alive && e.ccImmune);
    await page.locator(`#nameplates .np[data-idx="${boss.idx}"]`).click(); await idle(page); await page.mouse.move(2, 2); await frame();
    d = await j21dom(page);
    await shot(page, 'J-disrupt');
    bad = [...jCardsMatch(d, s, boss.idx), ...jBadgesMatch(d, s, boss.idx)];
    const ctlOpt = R.engageOptions(s).find((o) => o.id === 'lay_trap');
    check('M2b-2b.6', `dungeon boss ${boss.name}: Lay Trap shows as "Disrupt" exactly where R.engageOptions lists it (disrupt ${JSON.stringify(ctlOpt.disrupt)}), enabled, with the wind-up it answers`,
      !bad.length && d.cards.some((c) => c.opt === 'lay_trap' && c.disrupt && !c.off), bad.join(' | ') || JSON.stringify(d.cards));
    // the boss's wind-up tooltip: an enemy immune to control is answered by an interrupt, a stun or control spell, or Disrupt
    const bx = boss.track.find((x) => x.windup);
    await page.locator(`#nameplates .np[data-idx="${boss.idx}"] .trk .tk[data-turn="${bx.turn}"]`).hover(); await page.waitForTimeout(200);
    const btip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
    check('M2b-2b.6', `the dungeon boss's wind-up tooltip says what answers it on an enemy immune to control ("${J_ANSWERS.immune.slice(0, 60)}...")`, btip.includes(J_ANSWERS.immune), btip.replace(/\n/g, ' / '));
    await page.mouse.move(2, 2); await frame();
    const bossTrack = JSON.parse(R.serialize(s)); // the state of this engage round, for the greyed-out check below
    r = await press('KeyW');
    const dx = boss.track.find((x) => x.windup);
    const log1 = await logLines(page);
    check('M2b-2b.6', `key W sends Disrupt; the log names the wind-up it will stop ("Disrupt (Lay Trap): ${boss.name} will miss ${dx.name} in round ${jRound(boss, dx)}")`,
      log1.some((l) => l === `Disrupt (Lay Trap): ${boss.name} will miss ${dx.name} in round ${jRound(boss, dx)}.`), log1.slice(-3).join(' / '));
    answered = null;
    for (let n = 0; n < 8 && r.s.fight && !r.s.fight.over && !answered; n++) {
      r = await press('KeyA');
      if (r.s.fight && r.s.fight.enemies[boss.idx] && jStack(r.s.fight.enemies[boss.idx], 'STAGGERED')) answered = { s: r.s, d: await j21dom(page), tgt: await page.evaluate(() => window.__ui.target()), log: await logLines(page) };
    }
    if (answered) {
      await shot(page, 'J-disrupt-answered');
      bad = jStacksMatch(answered.d, answered.s, answered.tgt);
      check('M2b-2b.6', 'Disrupt stops the boss\'s wind-up: its STAGGERED badge equals the engine\'s status and the log says "stopped: ... by your Disrupt"',
        !bad.length && answered.log.some((l) => l.startsWith(`${jWord(dx)} stopped: ${boss.name}'s ${dx.name} by your Disrupt`)), `${bad.join(' | ')}; ${answered.log.slice(-3).join(' / ')}`);
    } else check('M2b-2b.6', 'Disrupt answers the boss\'s wind-up', false, 'no STAGGERED status');
    check('M2b-2b.6', `in every round met (${barSeen}, ${nowSeen} with a wind-up playing), the bar marked exactly the usable spells that can answer one now (none without)`, barSeen > 0 && !nowBad.length, nowBad.slice(0, 4).join(' | '));

    // ---- Disrupt greyed out with the engine's reason: the same engage round with no wind-up in view (a state the real
    // content never reaches: every dungeon boss shows its turn-2 wind-up; loaded through the test hook)
    for (const e of bossTrack.fight.enemies) if (e.ccImmune) for (const x of e.track) delete x.windup;
    const grey = R.deserialize(JSON.stringify(bossTrack), CONTENT);
    const loaded = await page.evaluate((str) => window.__ui.loadState(str), JSON.stringify(bossTrack));
    await idle(page); await page.mouse.move(2, 2); await frame();
    d = await j21dom(page);
    await shot(page, 'J-disrupt-grey');
    const gOpt = R.engageOptions(grey).find((o) => o.id === 'lay_trap');
    bad = [...jCardsMatch(d, grey, boss.idx), ...jBadgesMatch(d, grey, boss.idx)];
    check('M2b-2b.6', `no wind-up in view: Lay Trap is greyed out with the engine's reason ("${gOpt.reason}"), not Disrupt; no wind-up badge`, loaded && !bad.length && d.cards.some((c) => c.opt === 'lay_trap' && c.off && !c.disrupt), bad.join(' | ') || JSON.stringify(d.cards));
    // ---- stacked toasts in a fight: merged, at most two, clear of the target frame, the ruler, the engage panel and nameplates
    await jBurst(page); await page.waitForTimeout(250);
    const tf = await jToasts(page);
    await shot(page, 'J-toasts-fight');
    check('M2b-2b.6', 'stacked toasts in a fight merge, at most 2 show at once, and none covers a unit frame, the ruler, the engage panel, a nameplate, the log or the heat meter',
      tf.toasts.length <= 2 && tf.toasts.some((t) => /NOPE" ×3$/.test(t.text)) && !jOverlaps(tf).length, `${JSON.stringify(tf.toasts.map((t) => t.text))}; ${jOverlaps(tf).join(', ')}`);
    // ---- the end-boss fight (phase 2, two Shards, a Shard targeted: its frame sits under the boss frame), loaded: the
    // toasts go between the target frame and the boss's nameplate, under the boss frame
    const bs = jBossState();
    await page.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 12000 });
    const bLoaded = await page.evaluate((str) => window.__ui.loadState(str), bs.ser);
    await idle(page); await frame();
    await page.locator(`#nameplates .np[data-idx="${bs.shard}"]`).click(); await idle(page); await page.mouse.move(2, 2); await frame();
    await jBurst(page); await page.waitForTimeout(250);
    const tb = await jToasts(page);
    await shot(page, 'J-toasts-boss');
    check('M2b-2b.6', `stacked toasts in the end-boss fight (seed ${bs.seed}, phase 2 with Shards, a Shard targeted) merge, at most 2 show, and none covers the boss frame, a unit frame, a nameplate, the log or the heat meter`,
      bLoaded && tb.toasts.length <= 2 && tb.toasts.some((t) => /NOPE" ×3$/.test(t.text)) && tb.panels.some(([n]) => n === 'boss frame') && tb.panels.some(([n]) => n === 'target frame') && !jOverlaps(tb).length,
      `${JSON.stringify(tb.toasts.map((t) => t.text))}; ${jOverlaps(tb).join(', ')}`);
  } catch (e) {
    check('-', 'part J ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part J: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  await partJRogue(browser, W, H);
}

/**
 * Part J, Rogue (jPickRogue): a wind-up plays this round and a bar spell can stop it. The bar marks exactly the spells the
 * engine's state allows ("Answer"), hovering the wind-up marks every bar spell that can answer it, the spell's tooltip names
 * the wind-up, and its key stops it: the log's "is stopped by your ..." and STAGGERED = the engine's status.
 */
async function partJRogue(browser, W, H) {
  const pick = jPickRogue(); const SEED = pick.seed;
  const twin = makeTwin(SEED);
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  const spName = R.C.SPELL[pick.spellId].name;
  check('-', `part J (Rogue) seed ${SEED} (chosen on Node runs: ${pick.name}'s ${pick.ability} in a ${pick.kind} fight, ${spName} on the bar can stop it)`, true, '');
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  try {
    await page.locator('#create .ccard[data-cls="rogue"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page); await page.mouse.move(2, 2);
    let s = null;
    for (let n = 0; n < 2500 && !s; n++) {
      const t = await twin.sync(page); const v = await view(page);
      if (v.phase === 'SUMMARY') throw new Error('the run ended before the wind-up');
      if (jStopNow(t) && v.step === 'combat' && v.round) { s = t; break; }
      await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
    }
    if (!s) throw new Error('no wind-up with an answer on the bar within 2500 steps');
    const w = jStopNow(s);
    await page.locator(`#nameplates .np[data-idx="${w.idx}"]`).click(); await idle(page); await page.mouse.move(2, 2); await frame();
    let d = await j21dom(page); const tgt = await page.evaluate(() => window.__ui.target());
    let bad = jBarMatch(d, s, tgt);
    const b = d.bar.find((x) => x.slot === w.slot);
    await shot(page, 'J-rogue-answer');
    check('M2b-2b.6', `a wind-up plays this round (${w.name}'s ${w.ability}): the bar marks exactly the usable spells that can stop it, ${spName} (key ${w.slot + 1}) tagged "Stop"`,
      tgt === w.idx && !bad.length && !!b && b.ans && b.tag.startsWith('Stop') && !b.wtag, `${bad.join(' | ')}; target ${tgt}; slot ${JSON.stringify(b)}`);
    // UX pass 2026-11-11: the turn prompt over the action bar names the answer and its key; the bar is framed as your turn
    const tp = await page.evaluate(() => { const el = document.querySelector('#turnprompt'); const r = el.getBoundingClientRect(); const bar = document.querySelector('#actionbar');
      const c = (x, y) => { const e = document.elementFromPoint(x, y); return e ? e.closest('#actionbar .ab, #actionbar .ctrl') : null; };
      return { shown: !el.classList.contains('hidden'), kind: el.dataset.kind, text: el.textContent.replace(/\s+/g, ' ').trim(), turn: bar.classList.contains('your-turn'),
        inView: r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0, overBar: [[0.1, 0.5], [0.5, 0.5], [0.9, 0.5]].some(([fx, fy]) => c(r.left + r.width * fx, r.top + r.height * fy)) }; });
    // D150: a wind-up "Wind-up now: stop it with 1 Throat Jab"; a Deathblow the prompt's one instruction, "... Throat Jab now 1."
    const tpWant = w.deathblow ? `${spName} now ${w.slot + 1}` : `Wind-up now: stop it with ${w.slot + 1} ${spName}`;
    check('UX-1', `turn prompt on the wind-up round: "${tpWant}", the bar framed as your turn, in view and covering no bar button`,
      tp.shown && tp.kind === (w.deathblow ? 'deathblow' : 'windup') && tp.text.includes(tpWant) && tp.turn && tp.inView && !tp.overBar, JSON.stringify(tp));
    // hovering the wind-up's chip marks every bar spell that can answer it (stop or, for a heavy one, avoid)
    await page.locator(`#nameplates .np[data-idx="${w.idx}"] .trk .tk[data-turn="${w.turn}"]`).hover(); await page.waitForTimeout(200); await frame();
    d = await j21dom(page);
    const x = s.fight.enemies[w.idx].track.find((y) => y.turn === w.turn);
    const wantHl = s.player.bar.map((id, slot) => (id && jAnswerKind(id, x) ? slot : null)).filter((q) => q !== null);
    const sawHl = d.bar.filter((q) => q.hl).map((q) => q.slot);
    check('M2b-2b.6', `hovering the wind-up marks every bar spell that can answer it (keys ${wantHl.map((q) => q + 1).join(', ')})`, wantHl.includes(w.slot) && sawHl.join(',') === wantHl.join(','), `saw ${sawHl.map((q) => q + 1).join(', ') || 'none'}`);
    await page.mouse.move(2, 2); await frame();
    // the spell's tooltip names the wind-up it can stop
    await page.locator(`#actionbar .ab[data-slot="${w.slot}"]`).hover(); await page.waitForTimeout(200);
    const tip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
    check('M2b-2b.6', `${spName}'s tooltip names the wind-up it can stop this round`, tip.includes(`Wind-up this round: ${w.name}'s ${w.ability}. This can stop it`), tip.replace(/\n/g, ' / '));
    await page.mouse.move(2, 2); await frame();
    // its key stops it, played at the default speed (D47): the moment on screen, the round within its cap; then answered by
    // the interrupt, STAGGERED = the engine's status, the log line
    await setSpeed(page, '1×'); await page.mouse.move(2, 2); await frame();
    const k0 = await page.evaluate(() => performance.now()); // plays() keeps the last 200 steps: find the round by its input time
    await page.keyboard.press(`Digit${w.slot + 1}`);
    const atMoment = await page.waitForFunction(() => { const e = window.__ui.playingEvent(); return !!(e && e.t === 'windup'); }, null, { timeout: 6000, polling: 'raf' }).then(() => true, () => false);
    const tpDuring = atMoment ? await page.evaluate(() => document.querySelector('#turnprompt').classList.contains('hidden')) : null;
    if (atMoment) { await page.waitForTimeout(150); await shot(page, 'J-rogue-moment'); }
    await idle(page);
    const rec = (await page.evaluate(() => window.__ui.plays())).find((r) => r.input >= k0) || null;
    { const after = await page.evaluate(() => { const v = window.__ui.view(); return { hidden: document.querySelector('#turnprompt').classList.contains('hidden'), live: !!(v.combat && !v.combat.over) }; });
      check('UX-1', 'the turn prompt is hidden while the round plays (at the wind-up\'s moment) and back when the game waits again', atMoment && tpDuring === true && (!after.live || !after.hidden), `during the moment: hidden ${tpDuring}; after: ${JSON.stringify(after)}`); }
    const ms = rec ? roundMs(rec) : null; const cap = rec && rec.round ? rec.round.budget : null;
    // D52: headless rendering at 1920x1080 runs at about 10 fps, so there a single round is reported and not held to the cap
    const capHeld = !(W >= 1920 && H >= 1080);
    check('M2v2-52', `at the default speed the round with the wind-up's moment ("Stopped!", its beat) plays within the round cap (D47)${capHeld ? '' : ' (1920x1080: reported only, D52)'}`,
      atMoment && !!rec && rec.events.includes('windup') && cap != null && (!capHeld || ms <= cap), `round ${ms} ms, cap ${cap} ms, tempo ${rec && rec.round ? rec.round.tempo.toFixed(2) : '-'}, moment seen ${atMoment}; events ${rec ? rec.events.join(' ') : '-'}`);
    await setSpeed(page, 'Instant');
    await page.mouse.move(2, 2); await frame();
    s = await twin.sync(page);
    const sent = (await page.evaluate(() => window.__ui.engineLog())).slice(-1)[0];
    d = await j21dom(page); const log = await logLines(page);
    const e = s.fight && s.fight.enemies[w.idx];
    const st = e && jStack(e, 'STAGGERED');
    bad = s.fight && !s.fight.over ? jStacksMatch(d, s, await page.evaluate(() => window.__ui.target())) : [];
    await shot(page, 'J-rogue-stopped');
    check('M2b-2b.6', `key ${w.slot + 1} casts ${spName} on ${w.name}: the wind-up is stopped ("${jWord(w)} stopped: ${w.name}'s ${w.ability} by your ${spName}") and the STAGGERED badge equals the engine's status`,
      !!sent && sent.type === 'CAST' && sent.spellId === w.spellId && !!st && !bad.length && log.some((l) => l.startsWith(`${jWord(w)} stopped: ${w.name}'s ${w.ability} by your ${spName}.`)),
      `${JSON.stringify(sent)}; stack ${JSON.stringify(st)}; ${bad.join(' | ')}; log ${log.slice(-3).join(' / ')}`);
  } catch (e) {
    await shot(page, 'J-rogue-error');
    check('-', 'part J (Rogue) ran to the end', false, e.message.split('\n').slice(0, 4).join(' / '));
  }
  check('-', 'part J (Rogue): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part K: the Dev menu (engine-api.md 12)
/** Replay a page's engine log in Node: dev ops through R.debug (build with the content), engine actions through R.step. */
function devTwin(log) {
  let s = null;
  for (const e of log) {
    if (e.type === 'DEV') s = e.fn === 'build' ? R.debug.build({ ...e.args[0], content: CONTENT }).state : R.debug[e.fn](s, ...e.args).state;
    else s = R.step(s, e).state;
  }
  return s;
}
async function partK(browser, W, H) {
  const SEED = 4;
  const ELITE = R.debug.enemies(CONTENT).find((x) => x.kind === 'elite' && x.zone === 4);
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  const panel = page.locator('#devmenu');
  const f = (key) => page.locator(`#devmenu [data-f="${key}"]`);
  const tab = async (name) => { await panel.getByRole('tab', { name }).click(); await idle(page); };
  /** The page's state against the Node twin of its engine log. */
  const twinCheck = async (what) => {
    const [log, state] = await page.evaluate(() => [window.__ui.engineLog(), window.__ui.state()]);
    let twin = null; let err = null;
    try { twin = R.serialize(devTwin(log)); } catch (e) { err = e.message; }
    const errs = twin ? R.debug.validate(R.deserialize(state, CONTENT), { steps: false }) : [];
    check('DEV-K', `${what}: the page's state equals the engine's (a Node twin of ${log.length} logged ops) and passes R.debug.validate`, !err && twin === state && !errs.length,
      err || (twin !== state ? `differs (${log.map((x) => x.fn || x.type).join(', ')})` : errs.join('; ')));
  };
  try {
    const btn = page.locator('#devbtn');
    const bp = await placement(btn);
    await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
    check('DEV-K', 'the DEV corner button is in view and on top', fullyShown(bp), placeText(bp));
    const clearOfMap = async () => page.evaluate(() => {
      const b = document.getElementById('devbtn').getBoundingClientRect();
      return [...document.querySelectorAll('#minimap, #minimap .zname, #tracker')].map((el) => el.getBoundingClientRect()).every((r) => r.width === 0 || b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom);
    });
    await page.keyboard.press('Backquote'); await idle(page);
    const pp = await placement(panel);
    check('DEV-K', 'the backquote key opens the Dev menu, fully in view', await page.evaluate(() => window.__ui.devOpen()) && fullyShown(pp), placeText(pp));
    // ---- Start at: Mage, zone 4, level 35 (the menu's own fields)
    await tab('Start at');
    await f('classId').selectOption('mage');
    await f('zone').selectOption('4');
    await f('level').fill('35');
    await panel.getByRole('button', { name: 'Start here' }).click(); await idle(page);
    let v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, zone: x.zone && x.zone.idx, level: x.player && x.player.level, cls: x.player && x.player.classId, dev: x.dev }; });
    check('DEV-K', 'Start at: a level 35 Mage in the hub of zone 4, marked a dev run', v.phase === 'ZONE_HUB' && v.zone === 4 && v.level === 35 && v.cls === 'mage' && !!v.dev, JSON.stringify(v));
    check('DEV-K', 'the DEV button covers no part of the minimap, its zone name (17 letters, the longest) or the tracker', await clearOfMap(), await btn.evaluate((el) => JSON.stringify(el.getBoundingClientRect())));
    await twinCheck('Start at');
    // ---- Jump: the end-boss fight in phase 2
    await tab('Jump');
    await panel.locator('[data-dev="boss2"]').click(); await idle(page);
    v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, boss: x.combat && x.combat.boss && x.combat.boss.phase, shards: x.combat ? x.combat.enemies.filter((e) => e.rank === 'shard' && e.alive).length : 0, level: x.player.level }; });
    check('DEV-K', `Jump: the end-boss fight in phase 2 with ${R.C.SHARD_COUNT} Shards, the Mage still level 35`, v.phase === 'BOSS' && v.boss === 2 && v.shards === R.C.SHARD_COUNT && v.level === 35, JSON.stringify(v));
    await twinCheck('Boss phase 2');
    // ---- Fight: an elite of zone 4 by its id
    await tab('Fight');
    await f('q').fill(ELITE.id); await idle(page);
    const rows = await panel.locator('.dm-row').evaluateAll((els) => els.map((e) => e.dataset.enemy));
    check('DEV-K', `Fight: searching "${ELITE.id}" lists exactly that template`, rows.length === 1 && rows[0] === ELITE.id, rows.join(', '));
    await panel.locator(`button[data-enemy="${ELITE.id}"]`).click(); await idle(page);
    v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, node: x.node && x.node.type, enemies: x.combat ? x.combat.enemies.map((e) => ({ tpl: e.tplId, level: e.level, rank: e.rank })) : null }; });
    check('DEV-K', `Fight: ${ELITE.name} (${ELITE.id}), an elite at level 35, in a dev fight`, v.phase === 'NODE' && v.node === 'dev' && v.enemies && v.enemies.length === 1 && v.enemies[0].tpl === ELITE.id && v.enemies[0].level === 35 && v.enemies[0].rank === 'elite',
      JSON.stringify(v));
    await twinCheck('Elite fight');
    const tf = await placement(page.locator('#devmenu'));
    check('DEV-K', 'the menu stays in view in the fight', fullyShown(tf), placeText(tf));
    await shot(page, 'K-elite-fight');
    // ---- World: god mode on
    await tab('World');
    await panel.getByRole('switch', { name: 'God mode' }).click(); await idle(page);
    v = await page.evaluate(() => window.__ui.view().dev);
    check('DEV-K', 'World: god mode on (the view and the menu say so)', !!(v && v.god) && (await panel.locator('.dm-run').innerText()) === 'Dev run · god mode', JSON.stringify(v));
    await twinCheck('God mode');
    // ---- the key closes it; the setting hides the button and the key
    await page.keyboard.press('Backquote'); await idle(page);
    check('DEV-K', 'the backquote key closes the menu', !(await page.evaluate(() => window.__ui.devOpen())) && !(await panel.isVisible()), '');
    await page.evaluate(() => window.__ui.settings.set('devTools', false)); await idle(page);
    await page.keyboard.press('Backquote'); await idle(page);
    check('DEV-K', 'the setting hides the button and the key', !(await btn.isVisible()) && !(await page.evaluate(() => window.__ui.devOpen())), '');
    await page.evaluate(() => window.__ui.settings.set('devTools', true)); await idle(page);
  } catch (e) {
    await shot(page, 'K-error');
    check('DEV-K', 'part K ran to the end', false, e.message.split('\n').slice(0, 4).join(' / '));
  }
  check('DEV-K', 'part K: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  // ?dev=0: no button, the key does nothing
  const off = await open(browser, W, H, `seed=${SEED}&speed=instant&dev=0`);
  await off.page.keyboard.press('Backquote'); await idle(off.page);
  check('DEV-K', '?dev=0: no Dev button, the key opens nothing', !(await off.page.locator('#devbtn').isVisible()) && !(await off.page.evaluate(() => window.__ui.devOpen())), '');
  check('DEV-K', '?dev=0: no console errors', off.errors.length === 0, off.errors.join(' | '));
  await off.context.close();
}

// ------------------------------------------------------------------ part L: DoT preview, talent totals, hints, Killed by
// Owner feedback 2026-11-11 (08:03, 08:11, 08:14, 08:31). The preview's numbers come from R.pendingTicks of a Node twin of
// the page's run; set-up states (window.__ui.loadState) put DoTs on every kind of unit at once, a lethal one included.
import('../../src/ui/engine-bridge.js').then((m) => { L_BRIDGE.actionName = m.actionName; }).catch(() => {});
import('../../src/ui/ui-text.js').then((m) => { L_BRIDGE.text = m; }).catch(() => {});
const L_BRIDGE = { actionName: null, text: null };
/** A dev-built fight (R.debug) past its engage round, edited, serialized for window.__ui.loadState. */
function lFight(cls, seed, zone, edit) {
  let s = R.debug.build({ content: CONTENT, classId: cls, seed, zone }).state;
  const foes = R.debug.enemies(CONTENT).filter((x) => x.zone === zone && x.kind === 'normal').slice(0, 2).map((x) => x.id);
  s = R.debug.encounter(s, { ids: foes }).state;
  s = R.step(s, { type: 'PASS' }).state;
  const o = JSON.parse(R.serialize(s));
  if (edit) edit(o);
  return JSON.stringify(o);
}
/** Every HP bar of the HUD: where it is, its preview mark (data-dot), the hatched width and the fill's share, the skull. */
const hpBars = (page) => page.evaluate(() => [...document.querySelectorAll('.bar.hp')].filter((b) => b.offsetParent).map((b) => {
  const frame = b.closest('#player-frame, #pet-frame, #target-frame, #boss-frame, .np');
  const dot = b.querySelector('.dot'); const sk = b.querySelector('.skull');
  // the hatched width as set (share of the bar); its box eases over .3 s when the target frame changes enemy
  return { where: frame.id || `np${frame.dataset.idx}`, dot: b.dataset.dot || '', w: dot && !dot.classList.contains('hidden') ? parseFloat(dot.style.width) / 100 : 0,
    skull: !!sk && !sk.classList.contains('hidden') && getComputedStyle(sk).display !== 'none', lethal: !!dot && dot.classList.contains('lethal') };
}));
/** The marks R.pendingTicks of state s asks for, per bar ('player-frame', 'pet-frame', 'target-frame', 'np<idx>'). */
function wantMarks(s, target) {
  const out = {};
  const mark = (u, maxHp) => {
    const x = R.pendingTicks(s, u);
    if (!x || (!x.amount && !x.absorbed && !x.lethal)) return { dot: '', w: 0 };
    const loss = Math.min(x.hp, Math.max(0, x.hp - (x.lethal ? 0 : x.hpAfter)));
    return { dot: `${loss}${x.lethal ? ':lethal' : ''}`, w: loss / maxHp, lethal: x.lethal };
  };
  out['player-frame'] = mark('player', s.player.d.maxHp);
  if (s.player.pet && s.player.pet.alive) out['pet-frame'] = mark('pet', s.player.d.petMaxHp);
  for (const e of s.fight.enemies) if (e.alive) out[`np${e.idx}`] = mark(e.idx, e.maxHp);
  if (target != null && s.fight.enemies[target] && s.fight.enemies[target].alive) out['target-frame'] = out[`np${target}`];
  return out;
}
function marksMatch(bars, want) {
  const bad = [];
  for (const [where, w] of Object.entries(want)) {
    const b = bars.find((x) => x.where === where);
    if (!b) { bad.push(`${where}: no bar`); continue; }
    if (b.dot !== w.dot || Math.abs(b.w - w.w) > 0.02 || (!!w.lethal !== b.lethal) || (!!w.lethal !== b.skull)) bad.push(`${where}: page ${JSON.stringify(b)}, engine ${JSON.stringify(w)}`);
  }
  return bad;
}
const tipText = async (page, locator) => { await locator.hover(); await page.waitForTimeout(180); const t = await page.locator('.tooltip.on').innerText().catch(() => ''); await page.mouse.move(2, 2); return t.replace(NBSP, ' '); };

async function partL(browser, W, H) {
  // ---- (1) DoT preview: a cast that applies a DoT, then a set-up state with DoTs on every unit, one lethal
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'hunter', zone: 2 })); await idle(page);
      const foes = R.debug.enemies(CONTENT).filter((x) => x.zone === 2 && x.kind === 'normal').slice(0, 2).map((x) => x.id);
      await page.evaluate((ids) => window.__ui.dev('fight', { ids }), foes); await idle(page);
      await page.keyboard.press('KeyX'); await idle(page); // past the engage round
      let s = devTwin(await page.evaluate(() => window.__ui.engineLog()));
      const slot = s.player.bar.indexOf('barbed_arrow');
      const target = await page.evaluate(() => window.__ui.target());
      if (slot >= 0) {
        await page.keyboard.press(`Digit${slot + 1}`); await idle(page);
        s = devTwin(await page.evaluate(() => window.__ui.engineLog()));
        const tgt = await page.evaluate(() => window.__ui.target());
        const bad = s.fight && !s.fight.over ? marksMatch(await hpBars(page), wantMarks(s, tgt)) : ['the fight ended'];
        await shot(page, 'L-barbed');
        check('OWN-L', 'Barbed Arrow cast: every HP bar marks what R.pendingTicks of the engine state says (hatched width = HP lost / max HP), the target included',
          !bad.length && R.pendingTicks(s, target) && R.pendingTicks(s, target).amount > 0, bad.join(' | ') || JSON.stringify(R.pendingTicks(s)));
      } else check('OWN-L', 'Barbed Arrow is on the level-11 Hunter\'s bar', false, JSON.stringify(s.player.bar));
      // set-up state: DoTs on both enemies (enemy 1 lethal: 3 × 9 Poison on 20 HP), on the player and on the pet
      const ser = lFight('hunter', 5, 2, (o) => {
        const [e0, e1] = o.fight.enemies;
        e0.st.push({ id: 'BLEED', src: 'barbed_arrow', dur: 3, full: 4, tick: Math.round(e0.hp * 0.3), canCrit: false, stacks: 1 });
        e1.hp = 20; e1.st.push({ id: 'POISON', dur: 3, full: 4, tick: 9, stacks: 3, max: 5, canCrit: false });
        o.fight.p.st.push({ id: 'BLEED', src: 'rend@1', by: 1, dur: 2, full: 3, tick: 14, canCrit: false });
        o.fight.pet.st.push({ id: 'BLEED', src: 'rend@0', by: 0, dur: 2, full: 3, tick: 11, canCrit: false });
        o.player.hp = Math.round(o.player.d.maxHp * 0.6);
      });
      await page.evaluate((x) => window.__ui.loadState(x), ser); await idle(page);
      await page.locator('#nameplates .np[data-idx="1"]').click(); await idle(page); await page.mouse.move(2, 2);
      s = R.deserialize(ser, CONTENT);
      const bars = await hpBars(page);
      let bad = marksMatch(bars, wantMarks(s, 1));
      await shot(page, 'L-dot-preview');
      check('OWN-L', 'set-up state: nameplates, target frame, player and pet frames mark R.pendingTicks exactly; the lethal Poison has the skull on its nameplate and the target frame, the others none',
        !bad.length && bars.filter((b) => b.skull).map((b) => b.where).sort().join(',') === 'np1,target-frame', bad.join(' | ') || JSON.stringify(bars));
      const tt = await tipText(page, page.locator('#target-frame .bar.hp'));
      const t1 = R.pendingTicks(s, 1);
      check('OWN-L', `target frame tooltip: lethal, ${t1.amount} from Poison ×3, "no need to attack it"`, /Lethal/.test(tt) && tt.includes(`Poison ×3: ${t1.amount}`) && /no need to attack/.test(tt), tt);
      const pt = await tipText(page, page.locator('#player-frame .bar.hp'));
      const enemy1 = s.fight.enemies[1].name;
      check('OWN-L', `player frame tooltip: the rend's tick by name and enemy (Rend (${enemy1}): ${R.pendingTicks(s, 'player').amount}), never an id`, pt.includes(`Rend (${enemy1}): ${R.pendingTicks(s, 'player').amount}`) && !/@|_/.test(pt), pt);
      // the round plays: the poisoned enemy dies at its end, as previewed; the marks follow the new state
      await page.keyboard.press('KeyX'); await idle(page);
      const log = await page.evaluate(() => window.__ui.engineLog());
      let t = R.deserialize(ser, CONTENT); for (const a of log) t = R.step(t, a).state;
      bad = t.fight && !t.fight.over ? marksMatch(await hpBars(page), wantMarks(t, await page.evaluate(() => window.__ui.target()))) : [];
      check('OWN-L', 'after Pass: the enemy the preview called lethal is dead (engine), its bar is gone, and the other bars mark the new R.pendingTicks',
        t.fight && !t.fight.enemies[1].alive && !(await page.locator('#nameplates .np[data-idx="1"]:not(.dead)').count()) && !bad.length, bad.join(' | ') || `enemy 1 alive: ${t.fight && t.fight.enemies[1].alive}`);
    } catch (e) {
      await shot(page, 'L-error-dot');
      check('OWN-L', 'part L (DoT preview) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('OWN-L', 'part L (DoT preview): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2) talent totals: Silent Footing and Toxic Coating rank by rank, from R.talentInfo
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant');
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 20, talents: 'unspent' })); await idle(page);
      await page.keyboard.press('KeyN'); await idle(page);
      const cell = (id) => page.locator(`#win-talents .tal[data-id="${id}"]`);
      const want = [];
      for (let r = 1; r <= 3; r++) {
        await cell('r_b1').click(); await idle(page);
        const s = devTwin(await page.evaluate(() => window.__ui.engineLog()));
        const info = R.talentInfo(s, 'r_b1');
        const txt = await tipText(page, cell('r_b1'));
        const nowWant = `Now: +${Math.round(info.now.pct * 100)} %`;
        const nextWant = info.next ? `Next rank: +${Math.round(info.next.pct * 100)} %` : 'Max rank';
        want.push(`${r}/3 ${nowWant} · ${nextWant}`);
        if (r === 1 || r === 3) {
          check('OWN-L', `Silent Footing ${r}/3: the tooltip says "${nowWant}" and "${nextWant}" (R.talentInfo)`, txt.includes(nowWant) && txt.includes(nextWant) && txt.includes(`Rank ${r}/3`), txt);
          if (r === 3) await shot(page, 'L-talent-max');
        }
      }
      await cell('r_c1').click(); await idle(page);
      const s = devTwin(await page.evaluate(() => window.__ui.engineLog()));
      const tc = R.talentInfo(s, 'r_c1');
      const txt = await tipText(page, cell('r_c1'));
      check('OWN-L', `Toxic Coating 1/3: "Now: Poison ticks ${tc.now.base} per stack", "Next rank: ... ${tc.next.base}" (the formula with the character's level and Power)`,
        txt.includes(`Now: Poison ticks ${tc.now.base} per stack`) && txt.includes(`Next rank: Poison ticks ${tc.next.base} per stack`), txt);
      // every talent text with one per-rank percentage names the engine's number (the texts were behind M2 v2 and v5)
      const T = L_BRIDGE.text;
      const PCT = new Set(['pct', 'crit', 'dodge', 'hpPct', 'manaPct', 'powerPct', 'petHpPct', 'petDmgPct', 'chance', 'healPct', 'share', 'marked', 'wardPct', 'strength', 'chill']);
      const off = Object.keys(R.C.TALENT).filter((id) => { const k = R.C.TALENT_PER_RANK[id]; if (!T || k.length !== 1 || !PCT.has(k[0])) return false; return !T.talentText(id, CONTENT).replace(/\+/g, '').includes(T.pct2(R.C.TALENT[id][k[0]])); });
      check('OWN-L', 'every talent text with one per-rank percentage states the engine\'s number (C.TALENT)', T && !off.length, off.map((id) => `${id}: "${T.talentText(id, CONTENT)}" vs ${T.pct2(R.C.TALENT[id][R.C.TALENT_PER_RANK[id][0]])}`).join(' | '));
    } catch (e) {
      await shot(page, 'L-error-talent');
      check('OWN-L', 'part L (talent totals) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('OWN-L', 'part L (talent totals): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (3) the first-fight hint, since M3 hint H01 on the coach line (m3-onboarding.md 3.2, 3.3): once per class in this
  // browser's saved game (tbwcr.hints.v2 seen['H01:<class>']); (4) the low-health potion pulse
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=16&speed=instant', null, { hints: true });
    const toFight = async () => { for (let i = 0; i < 200; i++) { const v = await view(page); if (v.round && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); } };
    const newRun = async (cls) => {
      await page.goto(`${URL}?seed=16&speed=instant&classic=1&guide=0`); await page.waitForFunction(() => window.__ui);
      await page.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await toFight();
    };
    const coachNow = () => page.evaluate(() => window.__ui.coach().shown);
    const stored = async () => JSON.parse((await page.evaluate((k) => localStorage.getItem(k), HINTS_KEY)) || '{}');
    try {
      const hint = page.locator('#coach');
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await toFight();
      const twin = makeTwin(16); twin.s.create.classId = 'rogue';
      const s = await twin.sync(page);
      // a higher-priority hint of the same round (spec 2.5: a wind-up's H03 before the engage round's H01) comes first;
      // H01 waits one step and shows when that one is put away
      let first = await coachNow();
      if (first && first.id !== 'H01' && first.kind === 'hint') { await page.locator('#coach .co-ok').click(); await idle(page); }
      const sh = await coachNow();
      const keys = await page.locator('#coach .co-t .kbd').evaluateAll((els) => els.map((e) => e.textContent));
      const hp = await placement(hint);
      const clear = await page.evaluate(() => {
        const r = document.getElementById('coach').getBoundingClientRect();
        const hit = (q) => [...document.querySelectorAll(q)].filter((x) => x.offsetParent).some((x) => { const b = x.getBoundingClientRect(); return b.width && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom); });
        return { engage: hit('#engage'), target: hit('#target-frame'), np: hit('#nameplates .np'), ruler: hit('#ruler'), bar: hit('#actionbar') };
      });
      await shot(page, 'L-hint');
      check('OWN-L', `Rogue's first engage round: hint H01 on the coach line${first && first.id !== 'H01' ? ` (after ${first.id}, higher priority)` : ''}, one line with the keys Q, W, E (content line, keys from the key map)`,
        R.isEngageRound(s) && fullyShown(hp) && sh && sh.id === 'H01' && keys.join(',') === 'Q,W,E' && /^Round 1 is yours: they act from round 2\. Open with Q, W or E\.$/.test(sh.text), `${placeText(hp)} ${JSON.stringify(sh)} keys ${keys}`);
      check('OWN-L', 'the coach line covers no engage card, target frame, nameplate, opening ruler or action bar', !clear.engage && !clear.target && !clear.np && !clear.ruler && !clear.bar, JSON.stringify(clear));
      await page.locator('#coach .co-ok').click(); await idle(page);
      const st1 = await stored();
      check('OWN-L', '"Got it" hides it and stores it for the Rogue (tbwcr.hints.v2 seen H01:rogue)', (await coachNow() || {}).id !== 'H01' && st1.seen && st1.seen['H01:rogue'] === true, JSON.stringify(st1.seen));
      await newRun('rogue');
      check('OWN-L', 'a new Rogue run (page reloaded): its first engage round shows no H01', (await view(page)).round === 1 && (await coachNow() || {}).id !== 'H01', JSON.stringify(await coachNow()));
      await newRun('mage');
      const shownMage = (await coachNow() || {}).id === 'H01';
      await page.keyboard.press('KeyW'); await idle(page);
      const st2 = await stored();
      check('OWN-L', 'a first Mage run shows H01; opening with W (ENGAGE) puts it away and stores it for the Mage too', shownMage && (await coachNow() || {}).id !== 'H01' && st2.seen['H01:mage'] === true, JSON.stringify(st2.seen));
      await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ off: true, seen: {} })), HINTS_KEY); // (4) below without hints
      await page.goto(`${URL}?seed=16&speed=instant&classic=1&guide=0`); await page.waitForFunction(() => window.__ui);
      // (4) the potion: below POTION_HINT_HP with a Healing Draught ready the slot pulses; never drunk for the player
      const at = (frac, cd) => lFight('hunter', 5, 2, (o) => { o.player.hp = Math.round(o.player.d.maxHp * frac); if (cd) o.fight.p.potionReady = o.fight.round + 2; });
      const potSlot = async () => page.evaluate(() => { const v = window.__ui.view(); const i = v.player.itemBar.findIndex((x) => x === 'healing_draught'); const b = document.querySelector(`#actionbar .ab[data-islot="${i}"]`); return { i, pulse: !!b && b.classList.contains('pulse'), label: b ? b.getAttribute('aria-label') : '' }; });
      await page.evaluate((x) => window.__ui.loadState(x), at(0.3)); await idle(page); await page.mouse.move(2, 2);
      const low = await potSlot();
      await shot(page, 'L-potion');
      await page.waitForTimeout(700);
      const drank = (await page.evaluate(() => window.__ui.engineLog())).some((a) => a.type === 'USE_ITEM');
      await page.evaluate((x) => window.__ui.loadState(x), at(0.5)); await idle(page);
      const high = await potSlot();
      await page.evaluate((x) => window.__ui.loadState(x), at(0.3, true)); await idle(page);
      const cool = await potSlot();
      check('OWN-L', 'Healing Draught on the item bar: pulses at 30 % health ("Low health: drink it"), not at 50 %, not while the potion cooldown runs, and is never drunk for the player',
        low.i >= 0 && low.pulse && /Low health/.test(low.label) && !high.pulse && !cool.pulse && !drank, JSON.stringify({ low, high, cool, drank }));
    } catch (e) {
      await shot(page, 'L-error-hint');
      check('OWN-L', 'part L (hints) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('OWN-L', 'part L (hints): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (5) Killed by: the killing blow by its display name, never its id; (6) the settings window at this size
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=1&speed=instant');
    try {
      const names = L_BRIDGE.actionName ? Object.keys(CONTENT.abilities).filter((id) => L_BRIDGE.actionName(id) !== CONTENT.abilities[id].name) : ['(bridge not loaded)'];
      check('OWN-L', `every content ability (${Object.keys(CONTENT.abilities).length}) reads by its content name (the bridge's actionName)`, !names.length, names.join(', '));
      let s = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT, mapMode: 'rows' });
      s = R.step(s, { type: 'START_RUN' }).state;
      for (let i = 0; i < 20000 && s.phase !== 'SUMMARY' && s.phase !== 'ENDED'; i++) s = R.step(s, R.autoAction(s)).state;
      const o = JSON.parse(R.serialize(s));
      if (o.phase === 'SUMMARY' && o.death) {
        o.death.killer = { idx: 0, name: 'Aldrec Barrow-King', ability: 'ab_z3_king_aldrec_heavy_blow' };
        await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
        await page.evaluate((x) => window.__ui.loadState(x), JSON.stringify(o)); await idle(page);
        const line = await page.locator('.killed').innerText();
        await shot(page, 'L-killed-by');
        check('OWN-L', 'the run summary names the killing blow: "Aldrec Barrow-King (Crown-Breaker)", not "Ab Z3 King Aldrec Heavy Blow"', line === `Aldrec Barrow-King (${CONTENT.abilities.ab_z3_king_aldrec_heavy_blow.name})`, line);
      } else check('OWN-L', 'a Rogue autoplay run (seed 1) ends in a death', false, `${o.phase} ${o.outcome}`);
      await page.goto(`${URL}?seed=1&speed=instant`); await page.waitForFunction(() => window.__ui);
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.openWin('settings')); await idle(page);
      const segs = await page.locator('#win-settings .setrow').first().locator('.seg button').all();
      const ps = []; for (const b of segs) ps.push({ t: await b.innerText(), p: await placement(b) });
      await shot(page, 'L-settings');
      check('OWN-L', 'settings window: Animation speed shows all four choices (1×, 2×, 4×, Instant) whole and in view', ps.length === 4 && ps.every((x) => fullyShown(x.p)) && ps.map((x) => x.t).join(',') === '1×,2×,4×,Instant',
        ps.map((x) => `${x.t} ${placeText(x.p)}`).join(' | '));
    } catch (e) {
      await shot(page, 'L-error-summary');
      check('OWN-L', 'part L (summary, settings) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('OWN-L', 'part L (summary, settings): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part M: the start camp and the contract tracker
// docs/specs/expedition.md 9.1, 9.3, engine-api.md 13 (M2b 2b.6): real engine at Instant speed, ?prep=1, seed M_SEED.
// Every number on the prep screen, the tracker, the map's site marks and the hub offer is compared with a Node twin
// that replays the page's engine log (R.step; R.debug for the Dev menu's build).
const M_SEED = 7;
/**
 * D150 (engine-2026-11-14d, cut list item 15): a profile's first run offers one zone 1 contract; parts M and N check the
 * full board (CONTRACT_BOARD_SIZE offers), so they play a later run: a stored profile with one run, the twin's the same.
 */
// D152 (changes-m3-v2.md 1.2): a profile with no run is a lean first run (no board, no zone 1 Bell); the board of
// CONTRACT_BOARD_SIZE offers and the Bell in zone 1 come from the third run (runs >= 2)
const M_PROFILE = () => ({ ...R.newProfile(), runs: 2, welcome: true, guide: 'done' });
/**
 * D150 item 14: what a start-camp offer's tooltip says (prep.js boardTip), as text pieces: "Win 2 fights on Quest or Grind nodes that carry its mark,
 * most of them in <region>. Other fights do not count." (Legacy bugs 2026-11-19, s0133; a Bounty: "Hunt down <elite> in <region>.", a Delve: "Clear <dungeon>, its boss included."), "Reward: about
 * N levels of XP", "1 of N items." and "Cost: N points." (the gold is a coins element between them).
 */
const boardTipWant = (o) => {
  const lv = o.reward.xpFrac; const n = lv >= 1 ? Math.round(lv) : Math.round(lv * 10) / 10;
  const what = o.kind === 'delve' ? `Clear ${o.dungeon}, its boss included.` : o.kind === 'bounty' ? `Hunt down ${o.name} in ${o.regionName}.` : `Win ${o.need} fights on Quest or Grind nodes that carry its mark, most of them in ${o.regionName}. Other fights do not count.`;
  return [what, `Reward: about ${n} ${n === 1 ? 'level' : 'levels'} of XP`, ...(o.reward.choices ? [`1 of ${o.reward.choices} items.`] : []), `Cost: ${o.price} ${o.price === 1 ? 'point' : 'points'}.`];
};
function mTwin(seed) {
  const run = () => R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'expedition', prep: true, profile: M_PROFILE() });
  return {
    async sync(page) {
      const log = await page.evaluate(() => window.__ui.engineLog());
      let s = null;
      for (const a of log) {
        if (a.type === 'DEV' && a.fn === 'build') s = R.debug.build({ ...a.args[0], content: CONTENT }).state;
        else if (a.type === 'DEV') s = R.debug[a.fn](s, ...a.args).state;
        else { if (!s) s = run(); s = R.step(s, a).state; }
      }
      return s || run();
    },
  };
}
async function partM(browser, W, H) {
  const { context, page, errors } = await open(browser, W, H, `seed=${M_SEED}&speed=instant&prep=1`, M_PROFILE());
  const twin = mTwin(M_SEED);
  const T = await import('../../src/ui/ui-text.js');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pagePrep = () => page.evaluate(() => window.__ui.view().prep);
  try {
    await page.keyboard.press('Enter');
    // Enter again at once (a double press of the key that started the run): the camp stays open (prep.js's guard). The
    // second press is sent the moment the screen is there, so a slow machine cannot stretch the gap past the guard.
    const age = await page.evaluate(async () => {
      for (let i = 0; i < 400 && !document.getElementById('prep'); i++) await new Promise((r) => setTimeout(r, 10));
      const el = document.getElementById('prep'); const a = el ? performance.now() - Number(el.dataset.mounted) : null;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true }));
      return a;
    });
    await idle(page);
    let s = await twin.sync(page); let pv = R.prepView(s);
    const ui0 = await page.evaluate(() => ({ phase: window.__ui.view().phase, bar: document.querySelector('#actionbar').classList.contains('hidden'), n: document.querySelector('#prep .pm-n') && document.querySelector('#prep .pm-n').textContent }));
    check('M-prep', `class select's Enter opens the start camp (phase ${ui0.phase}); a second Enter ${Math.round(age)} ms after it opened does not set out; no HUD around it`, ui0.phase === 'PREP' && s.phase === 'PREP' && ui0.bar && age != null && age < 700, JSON.stringify({ ...ui0, age }));
    const dom = () => page.evaluate(() => ({
      left: document.querySelector('#prep .pm-n').textContent, rl: document.querySelectorAll('#prep .pm-rl').length,
      cards: [...document.querySelectorAll('#prep .pp-card')].map((b) => ({ zone: b.querySelector('.pc-zone').textContent, price: b.querySelector('.pc-price').textContent, do: b.querySelector('.pc-do').textContent, taken: b.classList.contains('taken') })),
      opts: [...document.querySelectorAll('#prep .pp-opt')].map((b) => ({ id: b.dataset.id, price: (b.querySelector('.pc-price') || {}).textContent || null, bought: b.classList.contains('bought'), owned: b.classList.contains('owned') })),
      held: document.querySelectorAll('#prep .pp-card.taken').length,
    }));
    // D128: what to do in one line: "Win 2 marked sites in <region>" (Legacy bugs 2026-11-19: "marked"), "Hunt it down in <region>", the dungeon cleared
    const doWant = (o) => (o.kind === 'delve' ? 'Clear the dungeon, its boss included' : o.kind === 'bounty' ? `Hunt it down in ${o.regionName}` : `Win ${o.need} marked ${o.need === 1 ? 'site' : 'sites'} in ${o.regionName}`);
    const domDiff = (d, x) => {
      const out = [];
      if (d.left !== String(x.left)) out.push(`points left ${d.left} (engine ${x.left})`);
      // D150 item 15: no "Unspent: N points = N Echoes" line under the points (the points' tooltip has the Reserve)
      if (d.rl) out.push('the "Unspent ... Echoes" line is back');
      if (d.cards.length !== x.board.length) out.push(`${d.cards.length} cards (engine ${x.board.length})`);
      if (d.opts.length !== x.options.length) out.push(`${d.opts.length} options (engine ${x.options.length})`);
      x.board.forEach((o, i) => { const c = d.cards[i]; if (!c || c.zone !== `Zone ${o.z}` || c.price !== String(o.price) || c.do !== doWant(o) || c.taken !== o.taken) out.push(`card ${i + 1} ${JSON.stringify(c)} (engine zone ${o.z}, ${o.price}, ${o.need}, taken ${o.taken})`); });
      x.options.forEach((o) => { const c = d.opts.find((y) => y.id === o.id); if (!c || c.bought !== o.bought || c.owned !== o.owned || (!o.owned && c.price !== String(o.price))) out.push(`option ${o.id} ${JSON.stringify(c)}`); });
      if (d.held !== x.held) out.push(`held list ${d.held} (engine ${x.held})`);
      return out;
    };
    let d = await dom();
    // D150 item 15: the Reserve's Echoes are in the points' tooltip (no line under the points)
    await page.locator('#prep .pm-points').hover(); await page.waitForTimeout(150);
    const ptTip = await page.evaluate(() => { const t = document.querySelector('.tooltip'); return t && t.classList.contains('on') ? t.innerText.replace(/\u00a0/g, ' ') : ''; });
    await page.mouse.move(2, 2);
    const rWant = pv.reserve.points ? `(${pv.reserve.echoes} for the ${pv.reserve.points} ${pv.reserve.points === 1 ? 'point' : 'points'} left now)` : 'Unspent points become Reserve';
    check('M-prep', `the screen's numbers = R.prepView: ${pv.left} of ${pv.points} points left, ${pv.board.length} offers (zone, price, sites), ${pv.options.length} options; the points' tooltip: Reserve ${pv.reserve.points} = ${pv.reserve.echoes} Echoes`, same(await pagePrep(), JSON.parse(JSON.stringify(pv))) && !domDiff(d, pv).length && ptTip.includes(rWant), [...domDiff(d, pv), ptTip.includes(rWant) ? '' : `tooltip "${ptTip}"`].filter(Boolean).join(' | '));
    // everything in view: Set out at the bottom right, every card and option uncut (BUG-QA-10)
    const goP = await placement(page.locator('#pp-go'));
    check('M-prep', 'Set out is in view at the bottom right, on top', fullyShown(goP) && goP.rect[2] > W * 0.8 && goP.rect[3] > H * 0.85, placeText(goP));
    const cut = [];
    for (const sel of ['#prep .pp-card', '#prep .pp-opt']) { const n = await page.locator(sel).count(); for (let i = 0; i < n; i++) { const p = await placement(page.locator(sel).nth(i)); if (!p.inside || p.clippedBy) cut.push(`${sel} ${i} ${placeText(p)}`); } }
    check('M-prep', 'every contract card and option is fully in view (nothing below the fold)', !cut.length, cut.join(' | '));
    // D128 (owner playtest 2026-11-12 20:19): a lean camp: CONTRACT_BOARD_SIZE cards side by side, the camp's options (at
    // most 4) in one row, no reroll button while R.prepView's reroll is closed
    const lean = await page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const cards = [...document.querySelectorAll('#prep .pp-card')].map(r); const opts = [...document.querySelectorAll('#prep .pp-opt')].map(r);
      const rr = document.getElementById('pp-reroll');
      return { cards: cards.length, row: cards.every((c, i) => Math.abs(c.top - cards[0].top) < 4 && (i === 0 || c.left >= cards[i - 1].right - 1)),
        opts: opts.length, optRow: opts.every((c, i) => Math.abs(c.top - opts[0].top) < 4 && (i === 0 || c.left >= opts[i - 1].right - 1)), below: opts.length ? opts[0].top >= Math.max(...cards.map((c) => c.bottom)) : true,
        reroll: !!rr && rr.getClientRects().length > 0 };
    });
    check('M-prep', `D128 lean camp: ${lean.cards} contract cards side by side (R.prepView ${pv.board.length} = CONTRACT_BOARD_SIZE ${R.C.CONTRACT_BOARD_SIZE}), ${lean.opts} options in one row under them (at most 4), no reroll button (reroll.open ${pv.reroll.open})`,
      lean.cards === pv.board.length && pv.board.length === R.C.CONTRACT_BOARD_SIZE && lean.row && lean.opts === pv.options.length && lean.opts <= 4 && lean.optRow && lean.below && !lean.reroll && !pv.reroll.open, JSON.stringify(lean));
    // mouse and keys: take (click), take (key 2), buy (A), buy a vision perk (C), R (no reroll since D128), drop (click the taken card)
    const steps = [['click card 1', () => page.locator('#prep .pp-card').nth(0).click()], ['key 2', () => page.keyboard.press('Digit2')],
      ['key A', () => page.keyboard.press('KeyA')], ['key C', () => page.keyboard.press('KeyC')], ['key R', () => page.keyboard.press('KeyR')],
      ['click card 2 (drop)', () => page.locator('#prep .pp-card').nth(1).click()], ['click Field Draughts (sell)', () => page.locator('#prep .pp-opt[data-id="prep_draughts"]').click()],
      ['click Field Draughts (buy)', () => page.locator('#prep .pp-opt[data-id="prep_draughts"]').click()], ['key 3', () => page.keyboard.press('Digit3')]];
    const bad = [];
    for (const [what, fn] of steps) {
      await fn(); await idle(page);
      s = await twin.sync(page); pv = R.prepView(s); d = await dom();
      const diff = domDiff(d, pv);
      if (!same(await pagePrep(), JSON.parse(JSON.stringify(pv))) || diff.length) bad.push(`${what}: ${diff.join(', ') || 'view differs'}`);
    }
    const log = await page.evaluate(() => window.__ui.engineLog().map((a) => a.type));
    check('M-prep', `mouse and keys send TAKE, DROP, BUY, SELL and no REROLL (D128; log ${log.slice(1).join(' ')}); after each the screen = R.prepView (left ${pv.left}, held ${pv.held}, rerolls ${pv.reroll.used})`,
      !bad.length && ['TAKE_CONTRACT', 'DROP_CONTRACT', 'BUY_PREP', 'SELL_PREP'].every((t) => log.includes(t)) && !log.includes('REROLL_BOARD'), bad.join(' | '));
    // tooltips: a contract says where its sites are and what it pays; an option says what it does
    await page.mouse.move(2, 2);
    const k = pv.board.findIndex((o) => o.kind === 'cull'); const o = pv.board[k >= 0 ? k : 0];
    await page.locator('#prep .pp-card').nth(k >= 0 ? k : 0).hover(); await page.waitForTimeout(80);
    const tt1 = (await page.evaluate(() => (document.querySelector('.tooltip.on') || {}).innerText || '')).replace(NBSP, ' ');
    const tt1Money = await page.evaluate(() => !!document.querySelector('.tooltip.on .money'));
    const want1 = boardTipWant(o);
    check('M-prep', `D150 item 14: an offer's tooltip in three sentences ("${want1.join(' ... ')}"), the gold in coins; no sites, refund or key lines`, want1.every((x) => tt1.includes(x)) && tt1Money && !/Sites:|refunded|Click or press/.test(tt1), tt1.replace(/\n/g, ' / '));
    const spy = pv.options.find((x) => x.id === 'prep_tracker');
    await page.locator('#prep .pp-opt[data-id="prep_tracker"]').hover(); await page.waitForTimeout(80);
    const tt2 = await page.evaluate(() => (document.querySelector('.tooltip.on') || {}).innerText || '');
    const want2 = T.prepOptionEffect(spy, { vision: R.C.VISION_RADIUS, guide: R.C.GUIDE_RADIUS_BONUS, tracker: R.C.TRACKER_RADIUS, bountyPlaced: R.C.BOUNTY_PLACED, bellMax: R.C.BELL_MAX_CHARGES, emberMax: R.C.EMBER_MAX_CARRIED }, (id) => R.C.CONSUMABLE[id].name);
    check('M-prep', `an option's tooltip says what it does in one line ("${want2}") and its refund`, tt2.includes(want2) && /full refund/.test(tt2), tt2.replace(/\n/g, ' / '));
    // QA playtest 2026-11-11 finding 5: every number on a card has its word (levels, price, sites, XP, gold, the item choice)
    const lab = await page.evaluate(() => [...document.querySelectorAll('#prep .pp-card')].map((b) => { const pay = b.querySelector('.pc-reward'); return { zone: b.querySelector('.pc-zone').textContent, price: b.querySelector('.pc-price').textContent,
      pl: (b.querySelector('.pc-pl') || {}).textContent, do: b.querySelector('.pc-do').textContent, pay: pay.innerText.replace(/\s+/g, ' '), it: (b.querySelector('.pc-reward .it') || {}).textContent, one: pay.scrollWidth <= pay.clientWidth + 1 && pay.getClientRects().length === 1 }; }));
    const lBad = pv.board.map((o, i) => { const c = lab[i] || {}; const bad = [];
      if (c.zone !== `Zone ${o.z}`) bad.push(`zone "${c.zone}"`);
      if (c.price !== String(o.price) || c.pl !== (o.price === 1 ? 'pt' : 'pts')) bad.push(`price "${c.price} ${c.pl}"`);
      if (o.kind === 'cull' && !(c.do || '').startsWith(`Win ${o.need} marked ${o.need === 1 ? 'site' : 'sites'} in `)) bad.push(`sites "${c.do}"`);
      if (!/^Reward /.test(c.pay || '') || !(c.pay || '').includes(`${Math.round(o.reward.xpFrac * 10) / 10} levels of XP`) || !/ gold /.test(c.pay || '')) bad.push(`pay "${c.pay}"`); // D150: no "Pays"
      if (!(c.it || '').startsWith(`choose 1 of ${o.reward.choices}`)) bad.push(`items "${c.it}"`);
      if (!c.one) bad.push('the pay line is cut or wraps');
      return bad.length ? `card ${i + 1}: ${bad.join(', ')}` : null; }).filter(Boolean);
    check('M-prep', 'every number on a contract card has its word: "Zone 1", "2 pts", "Win 2 marked sites in ...", "Reward 2.8 levels of XP", "gold", "choose 1 of 3", the pay on one uncut line (QA 2026-11-11 finding 5; D128; D150: no "Pays")', !lBad.length, lBad.slice(0, 3).join(' | '));
    // QA playtest 2026-11-11 finding 4 (an engine fix, contracts.js drawBoard): no two cards are the same contract
    const keys = pv.board.map((o) => [o.z, o.kind, o.region, o.family, o.template].join('|'));
    const shown = await page.evaluate(() => [...document.querySelectorAll('#prep .pp-card')].map((b) => [b.querySelector('.pc-zone').textContent, b.querySelector('.pc-kind').textContent, b.querySelector('.pc-target').textContent, b.querySelector('.pc-do').textContent].join(' / ')));
    check('M-prep', `the board's ${keys.length} cards are ${new Set(shown).size} different offers (no two the same contract)`, new Set(keys).size === keys.length && new Set(shown).size === shown.length, shown.join(' | '));
    // QA playtest 2026-11-11 finding 7: a card's tooltip covers no other card and not Set out; an option's no other option
    const tipHits = (sel, i, avoid) => page.evaluate(([s, k, av]) => {
      const t = document.querySelector('.tooltip.on'); if (!t) return ['no tooltip'];
      const a = t.getBoundingClientRect(); const own = document.querySelectorAll(s)[k];
      return [...document.querySelectorAll(av)].filter((e) => e !== own && !e.contains(own) && e.offsetParent).filter((e) => { const r = e.getBoundingClientRect(); return r.left < a.right - 1 && r.right > a.left + 1 && r.top < a.bottom - 1 && r.bottom > a.top + 1; })
        .map((e) => e.id || `${e.className.split(' ')[0]} ${e.dataset.index || e.dataset.id || ''}`.trim());
    }, [sel, i, avoid]);
    const tBad = [];
    for (const [sel, n] of [['#prep .pp-card', pv.board.length], ['#prep .pp-opt', pv.options.length]]) {
      for (let i = 0; i < n; i++) {
        await page.mouse.move(2, 2); await page.locator(sel).nth(i).hover(); await page.waitForTimeout(50);
        const hit = await tipHits(sel, i, `${sel}, #pp-go, .btn.primary`);
        if (hit.length) tBad.push(`${sel} ${i + 1}: over ${hit.join(', ')}`);
      }
    }
    check('M-prep', 'a card\'s tooltip covers no other card and not Set out; an option\'s no other option (QA 2026-11-11 finding 7)', !tBad.length, tBad.slice(0, 4).join(' | '));
    await page.mouse.move(2, 2);
    await shot(page, 'M-prep');
    // Set out (Enter, after the guard): the purchases take effect, Reserve, zone 1's hub
    await page.waitForTimeout(750);
    await page.keyboard.press('Enter'); await idle(page);
    s = await twin.sync(page);
    const cv = R.contractView(s); const pc = await page.evaluate(() => window.__ui.view().contracts);
    check('M-track', `Enter sets out (phase ${s.phase}): the contracts and Reserve on screen = R.contractView (held ${cv.held}, Reserve ${cv.reserve})`, s.phase === 'ZONE_HUB' && same(pc, JSON.parse(JSON.stringify(cv))), JSON.stringify(pc && { held: pc.held, reserve: pc.reserve }));
    // QA playtest 2026-11-11 finding 7: a hub service's tooltip never covers Set out (or another primary button)
    const got = page.getByRole('button', { name: 'Got it' }); if (await got.count()) await got.first().click();
    // D150 item 22: a greyed Trainer (nothing to teach) has no tooltip, no toll and no click: the cards with a tooltip are checked
    const svcBad = [];
    const SVC = '#screens .svc-card:not(.off)';
    const nSvc = await page.locator(SVC).count(); const nIdle = await page.locator('#screens .svc-card.off').count();
    for (let i = 0; i < nSvc; i++) {
      const bx = await page.locator(SVC).nth(i).boundingBox();
      for (const [fx, fy] of [[0.5, 0.5], [0.95, 0.9], [0.05, 0.9], [0.95, 0.1]]) {
        await page.mouse.move(bx.x + bx.width * fx, bx.y + bx.height * fy); await page.waitForTimeout(40);
        const hit = await tipHits(SVC, i, '.btn.primary');
        if (hit.length) svcBad.push(`service ${i + 1} at ${fx},${fy}: over ${hit.join(', ')}`);
      }
    }
    await page.mouse.move(2, 2);
    check('M-track', `the hub's ${nSvc} service tooltips never cover Set out, wherever the pointer is on the card (QA 2026-11-11 finding 7; ${nIdle} greyed card without one)`, nSvc + nIdle >= 3 && nSvc >= 2 && !svcBad.length, svcBad.slice(0, 4).join(' | '));
    // the map: the tracker pins this zone's contracts; site marks exactly where mapView has them; hidden nodes unnamed
    await page.locator('#screens .side .btn.primary').click(); await idle(page);
    s = await twin.sync(page);
    const mv = R.mapView(s); const cv2 = R.contractView(s);
    const here = cv2.contracts.filter((c) => c.z === 1 && c.status !== 'abandoned');
    const tr = await page.evaluate(() => ({ dimmed: document.querySelector('#tracker').classList.contains('dimmed'), rows: [...document.querySelectorAll('#tracker .tk-c')].map((e) => ({ id: e.dataset.contract, t: e.querySelector('.t').textContent, pr: e.querySelector('.pr').textContent })) }));
    const trBad = here.filter((c) => { const r = tr.rows.find((x) => x.id === c.id); return !r || r.t !== T.contractTitle(c, CONTENT) || r.pr !== `${c.progress} / ${c.need} ${c.need === 1 ? 'site' : 'sites'}`; });
    check('M-track', `on the map the tracker shows this zone's ${here.length} ${here.length === 1 ? 'contract' : 'contracts'} with title and progress (= R.contractView), not dimmed`, s.phase === 'MAP' && !tr.dimmed && tr.rows.length === here.length && !trBad.length, JSON.stringify(tr));
    // QA playtest 2026-11-11 finding 3: the tracker says this zone's contracts expire on leaving; the Bell asks first
    const act1 = here.filter((c) => c.status === 'active');
    const expL = await page.evaluate(() => { const e = document.querySelector('#tracker .tk-exp'); return e ? e.textContent : null; });
    check('M-track', `the tracker says this zone's ${act1.length} held ${act1.length === 1 ? 'contract expires' : 'contracts expire'} on leaving ("${expL}")`, act1.length > 0 && expL === (act1.length === 1 ? 'Expires when you leave this zone' : `${act1.length === 2 ? 'Both' : `All ${act1.length}`} expire when you leave this zone`), expL);
    const nLog = () => page.evaluate(() => window.__ui.engineLog().length);
    const n0 = await nLog();
    const wantWarn = `${act1.length === 1 ? '1 contract' : `${act1.length} contracts`} here will expire: ${act1.map((c) => `${T.contractTitle(c, CONTENT)} (${c.progress} / ${c.need} ${c.need === 1 ? 'site' : 'sites'})`).join('; ')}`;
    await page.locator('.expmap [data-leave="RING_BELL"]').hover(); await page.waitForTimeout(80);
    const bellTip = await page.evaluate(() => ((document.querySelector('.tooltip.on') || {}).innerText || '').replace(/\s+/g, ' '));
    await page.locator('.expmap [data-leave="RING_BELL"]').click(); await idle(page);
    const warnTxt = (await page.locator('.expmap .leavewarn').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const n1 = await nLog();
    await shot(page, 'M-leave');
    await page.locator('.expmap .leavewarn').getByRole('button', { name: 'Stay' }).click(); await idle(page);
    const gone1 = !(await page.locator('.expmap .leavewarn').count()); const n2 = await nLog();
    await page.locator('.expmap [data-leave="RING_BELL"]').click(); await idle(page);
    const again = await page.locator('.expmap .leavewarn').count();
    await page.keyboard.press('Escape'); await idle(page);
    const gone2 = !(await page.locator('.expmap .leavewarn').count()); const n3 = await nLog();
    check('M-track', `Ring the Bell holding a contract of this zone: the tooltip warns and a prompt names what expires ("${wantWarn}") before anything is sent; Stay and Esc send nothing`,
      bellTip.includes(wantWarn) && warnTxt.includes(wantWarn) && n1 === n0 && gone1 && n2 === n0 && again === 1 && gone2 && n3 === n0, JSON.stringify({ bellTip, warnTxt, n: [n0, n1, n2, n3], gone1, again, gone2 }));
    const trP = await page.locator('#tracker').evaluate((el) => { const r = el.getBoundingClientRect(); const m = document.querySelector('#screens .mapwin').getBoundingClientRect(); return { overlap: r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top, r: [r.left, r.right].map(Math.round), m: [m.left, m.right].map(Math.round) }; });
    check('M-track', 'the tracker on the map stays clear of the zone map', !trP.overlap, JSON.stringify(trP));
    const marks = await page.evaluate(() => [...document.querySelectorAll('.expmap .mnode')].filter((n) => n.querySelector('.xsite')).map((n) => ({ id: Number(n.dataset.node), sites: n.querySelector('.xsite').dataset.sites, label: n.querySelector('.cl').textContent, aria: n.getAttribute('aria-label') })));
    const want = mv.nodes.filter((n) => n.sites).map((n) => ({ id: n.id, sites: n.sites.join(','), know: n.know }));
    const mBad = want.filter((w) => { const m = marks.find((x) => x.id === w.id); return !m || m.sites !== w.sites || (w.know === 'none' && (m.label !== '?' || !/^Unknown/.test(m.aria))); });
    check('M-track', `site marks on exactly the ${want.length} nodes mapView marks (${want.filter((w) => w.know === 'none').length} hidden: shown as "?", never named)`, marks.length === want.length && !mBad.length, JSON.stringify({ marks, want }));
    await shot(page, 'M-map');
    // the quest log is the contract list
    await page.keyboard.press('KeyL'); await idle(page);
    const rows = await page.locator('#win-questlog .cl-row').count();
    check('M-track', `the quest log (L) lists every contract of the run (${cv2.contracts.length})`, rows === cv2.contracts.length, `${rows} rows`);
    await page.keyboard.press('KeyL'); await idle(page);
    // the prompt's "anyway" rings the Bell: the zone's held contracts expire (the engine's rule)
    await page.locator('.expmap [data-leave="RING_BELL"]').click(); await idle(page);
    await page.locator('.expmap .leavewarn').getByRole('button', { name: 'Ring the Bell anyway' }).click(); await idle(page);
    s = await twin.sync(page);
    const lastA = await page.evaluate(() => window.__ui.engineLog().slice(-1)[0].type);
    const expd = R.contractView(s).contracts.filter((c) => act1.some((x) => x.id === c.id)).map((c) => c.status);
    check('M-track', `"Ring the Bell anyway" sends RING_BELL (${lastA}); the zone's contracts then expire (${expd.join(', ')})`, lastA === 'RING_BELL' && expd.length === act1.length && expd.every((x) => x === 'expired'), JSON.stringify({ lastA, expd }));
    // the hub contract: a run at zone 2's hub (Dev menu Start at, the start camp left with every point as Reserve)
    await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, mapMode: 'expedition', prep: true })); await idle(page);
    s = await twin.sync(page);
    const off = R.contractView(s).hub;
    const hc = await page.evaluate(() => { const e = document.querySelector('.hubc'); return e ? { s: e.querySelector('.hc-s').textContent, take: e.querySelector('[data-hub="reserve"]').textContent, pay: e.querySelector('.hc-rw').innerText.replace(/\s+/g, ' ') } : null; });
    check('M-hub', `zone 2's hub shows its contract offer (${off ? T.contractTitle(off, CONTENT) : 'none'}) with its price in Reserve and its pay with words ("${hc && hc.pay}")`, !!off && !!hc && hc.s === T.hubOfferSentence(off, CONTENT.zones[1].hubName, CONTENT) && hc.take.includes(`${off.price} Reserve`)
      && /^Reward /.test(hc.pay) && hc.pay.includes(`${Math.round(off.reward.xpFrac * 10) / 10} levels of XP`) && / gold /.test(hc.pay) && hc.pay.includes(`choose 1 of ${off.reward.choices}`), JSON.stringify(hc));
    const res0 = R.contractView(s).reserve;
    await page.locator('.hubc [data-hub="reserve"]').click(); await idle(page);
    s = await twin.sync(page);
    const cv3 = R.contractView(s); const pc3 = await page.evaluate(() => window.__ui.view().contracts);
    check('M-hub', `Take pays from Reserve (${res0} -> ${cv3.reserve}) and the offer is held from the hub; the page = R.contractView`, cv3.reserve === res0 - off.price && cv3.contracts.some((c) => c.from === 'hub') && !cv3.hub && same(pc3, JSON.parse(JSON.stringify(cv3))) && !(await page.locator('.hubc').count()), JSON.stringify({ reserve: pc3.reserve, hub: pc3.hub }));
  } catch (e) {
    await shot(page, 'M-error');
    check('-', 'part M (start camp and contracts) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
  }
  check('-', 'part M: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  await partMReward(browser, W, H);
}
/** Part M, a completed contract: seed 1 on the engine's autoplay choices (its start camp takes contracts) to the reward. */
async function partMReward(browser, W, H) {
  const { context, page, errors } = await open(browser, W, H, 'seed=1&speed=instant&prep=1', M_PROFILE()); // D152: a later run
  const T = await import('../../src/ui/ui-text.js');
  try {
    await page.keyboard.press('Enter'); await idle(page);
    let L = null;
    for (let i = 0; i < 1500 && !L; i++) {
      const v = await page.evaluate(() => { const x = window.__ui.view(); return { loot: x.loot && x.loot.kind === 'contract' ? x.loot : null, phase: x.phase }; });
      if (v.loot) { L = v.loot; break; }
      if (v.phase === 'SUMMARY') break;
      await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
    }
    if (!L) throw new Error('seed 1 completed no contract on the autoplay choices');
    // the engine's pay: replay the log, sum the XP and gold events after the step's contract complete event
    const log = await page.evaluate(() => window.__ui.engineLog());
    let s = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT, mapMode: 'expedition', prep: true, profile: M_PROFILE() }); let pay = null;
    for (const a of log) { const r = R.step(s, a); s = r.state; const k = r.events.findIndex((e) => e.t === 'contract' && e.what === 'complete'); if (k >= 0) { const after = r.events.slice(k + 1).filter((e) => e.why === 'contract'); pay = { id: r.events[k].id, xp: after.filter((e) => e.t === 'xp').reduce((x, e) => x + e.amount, 0), gold: after.filter((e) => e.t === 'gold').reduce((x, e) => x + e.amount, 0) }; } }
    const c = R.contractView(s).contracts.find((x) => x.id === pay.id);
    const dlg = await page.evaluate(() => { const d = document.querySelector('.dialog.contract-reward'); return d ? { title: d.querySelector('.wtitle .title').textContent, text: d.innerText, cards: d.querySelectorAll('.choice-cards .icard').length } : null; });
    check('M-reward', `a completed contract shows its reward choice: "${c ? T.contractTitle(c, CONTENT) : '?'}", +${pay.xp} XP and its gold (the engine's events), ${s.node.rewards[0].items.length} items to choose from`,
      !!dlg && dlg.title === 'Contract complete' && dlg.text.includes(T.contractTitle(c, CONTENT)) && L.xp === pay.xp && L.gold === pay.gold && /\+[\d,.\s\u202f\u00a0]+ XP/.test(dlg.text) && dlg.cards === s.node.rewards[0].items.length,
      JSON.stringify({ dlg: dlg && { title: dlg.title, cards: dlg.cards }, view: { xp: L.xp, gold: L.gold }, engine: pay }));
    await shot(page, 'M-reward');
    await page.locator('.dialog.contract-reward .choice-cards .icard').first().click(); await idle(page);
    const after = await page.evaluate(() => { const x = window.__ui.view(); return { loot: x.loot && x.loot.kind, log: window.__ui.engineLog().slice(-1)[0] }; });
    check('M-reward', 'choosing a card sends CHOOSE_REWARD and closes the window', after.log.type === 'CHOOSE_REWARD' && after.loot !== 'contract', JSON.stringify(after));
    // D144 (engine-2026-11-13d UI need 10; casual s0079: "Contracts 1/4" read "0/4" after one was done): the header says slots
    // (held of CONTRACT_SLOTS, R.contractView) and the contracts done
    const hd = await page.evaluate(() => { const e = document.querySelector('#tracker .tk-ch'); const cv = window.__ui.view().contracts; return { text: e ? e.textContent : null, held: cv.held, slots: cv.slots, reserve: cv.reserve, done: cv.contracts.filter((c) => c.status === 'complete').length }; });
    check('D144-10', `the tracker's contract header after one is done: "Contract slots ${hd.held}/${hd.slots} · ${hd.done} done · Reserve ${hd.reserve}" (R.contractView)`, hd.done >= 1 && hd.text === `Contract slots ${hd.held}/${hd.slots} · ${hd.done} done · Reserve ${hd.reserve}`, JSON.stringify(hd));
  } catch (e) {
    await shot(page, 'M-reward-error');
    check('-', 'part M (contract reward) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
  }
  check('-', 'part M (contract reward): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part N: the fog map (expedition.md 4-6, 9.2; M2b 2b.6)
// Real engine at Instant speed, ?prep=1, seed M_SEED: two contracts and Region Charts bought, set out. Every node's fog
// state, the regions, Roads, the Shardfall, the Dimming's wash and clocks, site marks and moves are compared with
// R.mapView of a Node twin (mTwin); nothing the view hides is drawn. Then the run on the engine's autoplay choices until
// the Dimming has spread, and the same checks again.
/** The fog map's DOM, as the checks read it. */
const fogDom = (page) => page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); };
  const disc = document.querySelector('#screens .expmap .xdisc');
  return {
    disc: disc ? r(disc) : null,
    nodes: [...document.querySelectorAll('#screens .expmap .mnode')].map((n) => ({ id: Number(n.dataset.node), fog: n.dataset.fog, img: !!n.querySelector('.ring img'), label: n.querySelector('.cl').textContent,
      quiet: n.classList.contains('quiet'), text: (() => { const c = n.querySelector('.cl'); const cs = getComputedStyle(c); return cs.display !== 'none' && parseFloat(cs.fontSize) > 0; })(),
      clockText: n.querySelector('.xclock') ? n.querySelector('.xclock').textContent : null, foesShown: !!n.querySelector('.xfoes') && n.querySelector('.xfoes').getClientRects().length > 0,
      aria: n.getAttribute('aria-label'), foes: n.querySelector('.xfoes') ? Number(n.querySelector('.xfoes').dataset.foes) : null, clock: n.querySelector('.xclock') ? Number(n.querySelector('.xclock').dataset.dimsIn) : null,
      reach: n.classList.contains('reach'), here: n.classList.contains('here'), dimmed: n.classList.contains('dimmed'), sites: n.querySelector('.xsite') ? n.querySelector('.xsite').dataset.sites : null, rect: r(n), size: n.getBoundingClientRect().width })),
    tints: [...document.querySelectorAll('#screens .expmap .xregions path')].map((x) => Number(x.dataset.region)),
    names: [...document.querySelectorAll('#screens .expmap .xrname')].map((x) => ({ region: Number(x.dataset.region), text: x.textContent })),
    legend: document.querySelectorAll('#screens .expmap .xreg').length,
    // D150 (the map's word budget): a closed Road's sign shows "Closed"; demo blind round 1 C: and its goal, "Next zone"
    roads: [...document.querySelectorAll('#screens .expmap .xroad')].map((x) => ({ id: Number(x.dataset.road), text: x.innerText.replace(/\s+/g, ' '), name: (x.querySelector('.xsign b') || {}).textContent || '', closed: x.classList.contains('rclosed'), rect: r(x) })),
    sides: [...document.querySelectorAll('#screens .expmap .xside .xpanel')].map(r),
    shard: document.querySelectorAll('#screens .expmap .xshard').length, wash: document.querySelectorAll('#screens .expmap .xdimwash path').length,
    mine: (document.querySelector('#screens .expmap .xmine') || {}).dataset ? Number(document.querySelector('#screens .expmap .xmine').dataset.dimsIn) : null,
    // D150 item 9: no Moves panel; "Pass through" offered on the nodes that can be walked through
    movesPanel: document.querySelectorAll('#screens .expmap .expmoves').length, passes: [...document.querySelectorAll('#screens .expmap .xpass')].map((b) => Number(b.dataset.node)).sort((a, b) => a - b),
  };
});
/** What the fog map must show of R.mapView mv; a list of differences (empty = equal). */
function fogDiff(d, mv, nextZone) {
  const out = [];
  const fogOf = (n) => (n.hub ? 'seen' : n.know === 'full' ? (n.hops <= mv.vision.radius ? 'seen' : 'remembered') : n.know === 'type' ? 'typed' : 'unknown');
  if (d.nodes.length !== mv.nodes.length) out.push(`${d.nodes.length} nodes drawn (view ${mv.nodes.length})`);
  // hops from the Shardfall on the view's edges, for the clocks within two hops of the front
  const nb = mv.nodes.map(() => []); for (const [a, b] of mv.edges) { nb[a].push(b); nb[b].push(a); }
  const hs = mv.nodes.map(() => Infinity); hs[mv.shardfall] = 0; const q = [mv.shardfall];
  while (q.length) { const x = q.shift(); for (const y of nb[x]) if (hs[y] === Infinity) { hs[y] = hs[x] + 1; q.push(y); } }
  const front = mv.dim.off ? -Infinity : mv.dim.front;
  const moves = new Set(mv.moves.map((m) => m.nodeId));
  for (const n of mv.nodes) {
    const e = d.nodes.find((x) => x.id === n.id);
    if (!e) { out.push(`node ${n.id} missing`); continue; }
    const f = fogOf(n);
    if (e.fog !== f) out.push(`node ${n.id} fog ${e.fog} (view ${f})`);
    if (n.know === 'none' && !n.hub && (e.img || e.label !== '?' || !/^Unknown/.test(e.aria) || e.foes !== null)) out.push(`hidden node ${n.id} shows more than the view: ${JSON.stringify(e)}`);
    if (n.know === 'type' && (e.label !== `${mv.bands[n.ring][0]}–${mv.bands[n.ring][1]}` || e.foes !== null || !e.img)) out.push(`type-known node ${n.id}: label ${e.label}, foes ${e.foes}`);
    // D144 (engine-2026-11-13d UI need 5): an elite's label is its own level (mapView `level`), not the node's
    const lvl = n.type === 'elite' && n.level ? n.level : n.cl;
    if (n.know === 'full' && !n.hub && n.cl && e.label !== String(lvl)) out.push(`seen node ${n.id} level ${e.label} (view ${lvl})`);
    const foes = n.know === 'full' && !n.hub && !n.done && n.type !== 'dungeon' && n.archetypes && n.archetypes.length ? n.archetypes.length : null;
    if (e.foes !== foes) out.push(`node ${n.id} enemy count ${e.foes} (view ${foes})`);
    const clock = !mv.dim.off && !n.dimmed && Number.isFinite(n.dimsIn) && (hs[n.id] <= front + 2 || (n.id === mv.pos && n.dimsIn <= 2)) ? n.dimsIn : null;
    if (e.clock !== clock) out.push(`node ${n.id} clock ${e.clock} (view ${clock}: dimsIn ${n.dimsIn}, ${hs[n.id]} hops from the Shardfall, front ${front})`);
    if (e.reach !== moves.has(n.id)) out.push(`node ${n.id} reachable ${e.reach}`);
    if (e.here !== (n.id === mv.pos)) out.push(`node ${n.id} here ${e.here}`);
    if (e.dimmed !== !!n.dimmed) out.push(`node ${n.id} dimmed ${e.dimmed}`);
    if ((e.sites || null) !== (n.sites ? n.sites.join(',') : null)) out.push(`node ${n.id} sites ${e.sites} (view ${n.sites})`);
    // D128: text labels only on the player's node, the reachable nodes and contract sites; a clock in full ("dims in N")
    // on the player's node and the reachable ones, its number alone elsewhere; an enemy count only where labels show
    const loud = n.id === mv.pos || moves.has(n.id) || !!(n.sites && n.sites.length);
    if (e.quiet === loud || (!loud && e.text) || (!loud && e.foesShown)) out.push(`node ${n.id} labels: quiet ${e.quiet}, text ${e.text}, foes shown ${e.foesShown} (loud ${loud})`);
    if (clock !== null) {
      // newcomer check 2026-11-15: the number alone on every clock but the player's urgent one (pinned badges; the Key names it)
      const want = n.id === mv.pos && n.dimsIn <= 2 ? `Dims in ${n.dimsIn}!` : String(n.dimsIn);
      if (e.clockText !== want) out.push(`node ${n.id} clock "${e.clockText}" (want "${want}")`);
    }
  }
  const tintWant = mv.nodes.filter((n) => !n.hub && n.region != null).map((n) => n.region).sort();
  if (JSON.stringify([...d.tints].sort()) !== JSON.stringify(tintWant)) out.push(`region tints on ${d.tints.length} nodes (view gives ${tintWant.length} regions)`);
  const nameWant = [...new Set(mv.nodes.filter((n) => n.ring >= 2 && n.region != null).map((n) => n.region))].sort();
  if (JSON.stringify(d.names.map((x) => x.region).sort()) !== JSON.stringify(nameWant) || d.names.some((x) => x.text !== mv.regions[x.region].name)) out.push(`region names ${JSON.stringify(d.names)} (view: ${nameWant})`);
  if (d.legend !== mv.regions.length) out.push(`legend ${d.legend} regions`);
  // demo blind round 1 C (draft): a sign names the goal, "Next zone" (the last zone's: the Camp's name); a closed one adds "Closed"
  const sw = nextZone === ((CONTENT.camp && CONTENT.camp.name) || 'the Camp') ? nextZone : EXIT_WORDS.nextZone;
  if (d.roads.length !== mv.roads.length || d.roads.some((r) => !mv.roads.includes(r.id) || !r.name.includes(sw) || !r.text.includes(sw) || (r.closed && !/Closed$/i.test(r.text)))) out.push(`roads ${JSON.stringify(d.roads.map((r) => [r.text, r.closed]))} (view ${mv.roads}, to ${nextZone}, sign "${sw}"; a closed one adds "Closed")`);
  if (d.shard !== 1) out.push(`${d.shard} Shardfall stars`);
  if (d.wash !== mv.nodes.filter((n) => n.dimmed).length) out.push(`Dimming wash on ${d.wash} nodes (view ${mv.nodes.filter((n) => n.dimmed).length})`);
  const me = mv.nodes[mv.pos]; if (d.mine !== (me.dimmed ? 0 : me.dimsIn)) out.push(`"your node dims in" ${d.mine} (view ${me.dimsIn})`);
  const passWant = mv.moves.filter((m) => m.passTime != null && !m.barred && !mv.nodes[m.nodeId].barred).map((m) => m.nodeId).sort((a, b) => a - b);
  if (d.movesPanel !== 0 || JSON.stringify(d.passes) !== JSON.stringify(passWant)) out.push(`Moves panel ${d.movesPanel}; "Pass through" on ${d.passes} (view: the moves with passTime ${passWant})`);
  return out;
}
/** The disc is round and in view, every node inside it and big enough to read (D128: smaller icons), no signpost on a side panel. */
function fogLayout(d, W, H) {
  const out = [];
  const [l, t, r, b] = d.disc || [0, 0, 0, 0];
  if (!d.disc || Math.abs((r - l) - (b - t)) > 2 || l < 0 || t < 0 || r > W || b > H) out.push(`disc ${d.disc}`);
  if ((r - l) < 0.45 * H) out.push(`disc ${r - l} px high, under 45 % of the window`);
  // D128: icons about 70 % of before: at least 24 px (an unknown "?" marker 18 px)
  for (const n of d.nodes) { const [nl, nt, nr, nb] = n.rect; if (nl < l - 4 || nt < t - 4 || nr > r + 4 || nb > b + 4) out.push(`node ${n.id} outside the disc ${n.rect}`); if (n.size < (n.fog === 'unknown' ? 18 : 24)) out.push(`node ${n.id} ${n.size} px`); }
  for (const s of d.roads) for (const p of d.sides) if (s.rect[0] < p[2] && s.rect[2] > p[0] && s.rect[1] < p[3] && s.rect[3] > p[1]) out.push(`signpost ${s.text} ${s.rect} over a side panel ${p}`);
  return out;
}
/** Labels of the fog map (level, toll label, clock) that overlap another label, or the icon of another node (a "?" marker
 * of an unknown node included since QA playtest 2026-11-11), by more than 2 px. */
const fogOverlaps = (page) => page.evaluate(() => {
  const nodes = [...document.querySelectorAll('#screens .expmap .xdisc > .mnode')];
  const labs = nodes.flatMap((n) => [...n.querySelectorAll(':scope > .mhrs, :scope > .xclock, :scope > .cl')].filter((e) => e.getClientRects().length).map((e) => ({ n: n.dataset.node, c: e.className.split(' ')[0], t: e.textContent, r: e.getBoundingClientRect() })));
  const rings = nodes.map((n) => ({ n: n.dataset.node, unknown: n.classList.contains('x-unknown'), r: n.querySelector('.ring').getBoundingClientRect() }));
  const ov = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const out = [];
  labs.forEach((a, i) => {
    for (const b of labs.slice(i + 1)) if (ov(a.r, b.r)) out.push(`${a.c} "${a.t}" of node ${a.n} on ${b.c} "${b.t}" of node ${b.n}`);
    for (const g of rings) if (g.n !== a.n && ov(a.r, g.r)) out.push(`${a.c} "${a.t}" of node ${a.n} on ${g.unknown ? 'the "?" of ' : ''}node ${g.n}`);
  });
  return out;
});
async function partN(browser, W, H) {
  const { context, page, errors } = await open(browser, W, H, `seed=${M_SEED}&speed=instant&prep=1`, M_PROFILE());
  const twin = mTwin(M_SEED);
  const nextZone = CONTENT.zones[1].name;
  try {
    await page.keyboard.press('Enter'); await idle(page); await page.waitForTimeout(750);
    await page.locator('#prep .pp-card').nth(0).click(); await idle(page);
    await page.locator('#prep .pp-card').nth(1).click(); await idle(page);
    await page.locator('#prep .pp-opt[data-id="prep_charts"]').click(); await idle(page);
    await page.keyboard.press('Enter'); await idle(page);
    const got = page.getByRole('button', { name: 'Got it' }); if (await got.count()) await got.first().click();
    await page.locator('#screens .side .btn.primary').click(); await idle(page);
    let s = await twin.sync(page); let mv = R.mapView(s);
    let d = await fogDom(page); let diff = fogDiff(d, mv, nextZone);
    const fogs = (x) => ['seen', 'remembered', 'typed', 'unknown'].map((f) => `${x.nodes.filter((n) => n.fog === f).length} ${f}`).join(', ');
    check('N-fog', `zone 1 after setting out with Region Charts: every node's fog state (${fogs(d)}), level, enemy count, site marks and moves = R.mapView; hidden nodes show "?" only`, s.phase === 'MAP' && !diff.length, diff.slice(0, 6).join(' | '));
    check('N-fog', `regions: a tint on the ${d.tints.length} nodes whose region the view gives, ${d.names.length} names on the rim, the legend; ${d.roads.length} Roads signposted to ${nextZone}; the Shardfall's star; "your node dims in ${d.mine}"`, mv.vision.regions && d.names.length === mv.regions.length && !diff.length, JSON.stringify({ names: d.names, roads: d.roads.map((r) => r.text) }));
    const ovl = await fogOverlaps(page);
    check('N-fog', `around the hub at ${W}x${H}: no level, toll label or Dimming clock overlaps another label, a node's icon or a "?" marker (screens.js declutterLabels)`, !ovl.length, ovl.slice(0, 6).join(' | '));
    const lay = fogLayout(d, W, H);
    check('N-fog', `readable at ${W}x${H}: the disc round and in view (${d.disc && d.disc[2] - d.disc[0]} px), every node inside it and at least 24 px (an unknown marker 18 px, D128), no signpost over a side panel`, !lay.length, lay.slice(0, 5).join(' | '));
    // a hover: the move's tooltip names the node and its tolls; a hidden node's names nothing
    const hid = mv.nodes.find((n) => n.know === 'none' && !n.shardfall && !n.road);
    const t1 = await tipOf(page, page.locator(`#screens .expmap .mnode[data-node="${hid.id}"]`));
    check('N-fog', `a hidden node's tooltip: "Unknown", its ring's levels ${mv.bands[hid.ring].join('–')} and its region (charts), nothing of its content`, /^Unknown/.test(t1) && t1.includes(`levels ${mv.bands[hid.ring][0]}–${mv.bands[hid.ring][1]}`) && !/Level \d|Foes|Wave|Click to/.test(t1), t1);
    await shot(page, 'N-fog-start');
    // the run on the engine's autoplay choices until the Dimming has spread two hops, then the map again
    const r = await page.evaluate(async () => {
      const ui = window.__ui;
      for (let n = 0; n < 600; n++) { const v = ui.view(); if (v.phase === 'SUMMARY') return false; if (v.phase === 'MAP' && v.zone && v.zone.exp && v.zone.exp.z === 1 && v.zone.exp.dim.front >= 1) return true; if (v.zone && v.zone.exp && v.zone.exp.z > 1) return false; await ui.act({ type: 'AUTO' }); await ui.idle(); }
      return false;
    });
    if (!r) throw new Error(`setup: seed ${M_SEED}'s run left zone 1 before the Dimming spread`);
    await idle(page); await page.mouse.move(2, 2);
    s = await twin.sync(page); mv = R.mapView(s);
    d = await fogDom(page); diff = fogDiff(d, mv, nextZone);
    check('N-fog', `the Dimming spread (front ${mv.dim.front}, zone toll ${mv.zt}): its wash on the ${d.wash} Dimmed nodes, "dims in N" on the ${d.nodes.filter((n) => n.clock !== null).length} nodes within two hops of the front, the rest as R.mapView`, mv.dim.front >= 1 && d.wash > 0 && !diff.length, diff.slice(0, 6).join(' | '));
    await page.waitForTimeout(2500); await shot(page, 'N-fog-dim');
    // QA playtest 2026-11-11 finding 9: after the spread the outer rings' clocks and labels sit on no label, icon or "?"
    const ovl2 = await fogOverlaps(page);
    check('N-fog', `after the Dimming spread at ${W}x${H}: no level, toll label or clock overlaps another label, a node's icon or a "?" marker`, !ovl2.length, ovl2.slice(0, 6).join(' | '));
    // M on the map screen: the map is already the screen, a toast says so and no second map opens
    await page.keyboard.press('KeyM'); await page.waitForTimeout(120);
    const mToast = await page.locator('#toasts .toast').allInnerTexts();
    check('N-fog', 'M on the fog map screen opens no second map and a toast says the map is the screen', !(await page.locator('#win-map').count()) && mToast.some((t) => /zone map is the screen/.test(t)), mToast.join(' | '));
    // toasts never cover an open window: bags and the quest log open, two toasts
    const toastClear = async () => page.evaluate(() => {
      const wins = [...document.querySelectorAll('#windows > .win')].map((w) => w.getBoundingClientRect());
      const ts = [...document.querySelectorAll('#toasts .toast')].map((t) => t.getBoundingClientRect());
      // under the windows: the stack's z-index below the windows' (same stacking context, #hud), so a window paints over it
      const under = document.querySelector('#toasts').classList.contains('under-wins') && Number(getComputedStyle(document.querySelector('#toasts')).zIndex) < Math.min(...[...document.querySelectorAll('#windows > .win')].map((w) => Number(getComputedStyle(w).zIndex) || 30));
      const hit = under ? [] : ts.filter((t) => wins.some((w) => t.left < w.right && t.right > w.left && t.top < w.bottom && t.bottom > w.top));
      return { n: ts.length, wins: wins.length, under, hit: hit.length };
    });
    const tw = [];
    for (const set of [['bags', 'questlog'], ['character', 'bags'], ['talents'], ['settings']]) {
      await page.evaluate(() => window.__ui.closeWins());
      for (const w of set) await page.evaluate((x) => window.__ui.openWin(x), w);
      await page.waitForTimeout(80);
      await page.evaluate(() => { window.__ui.toast('Test toast one', 'info'); window.__ui.toast('Test toast two, a longer line of text', 'good'); });
      await page.waitForTimeout(80);
      const c = await toastClear(); tw.push(`${set.join('+')}: ${c.n} toasts, ${c.hit} over a window${c.under ? ' (under the windows)' : ''}`);
      if (set[0] === 'bags') await shot(page, 'N-toast-windows');
    }
    await page.evaluate(() => window.__ui.closeWins());
    check('N-fog', 'toasts never cover an open window (bags + quest log, character + bags, talents, settings): they move aside or go under', tw.every((x) => / 0 over a window/.test(x)), tw.join(' | '));
    // QA playtest 2026-11-11 finding 1: five heat changes at once (a zone change) leave one heat toast, the final state
    await page.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 12000 }).catch(() => {});
    const flap = await page.evaluate(async () => {
      const ui = window.__ui; ui.toast('Test toast before the burst', 'info');
      for (const [k, t] of [['hot', 'Burning: one.'], ['warm', 'Smouldering: two.'], ['clear', 'Calm: three.'], ['warm', 'Smouldering: four.'], ['clear', 'Calm: you are ahead of the Star.']]) ui.toast(t, `heat-${k}`);
      await new Promise((r) => requestAnimationFrame(r));
      const ts = [...document.querySelectorAll('#toasts .toast')];
      return { n: ts.length, heat: ts.filter((t) => /\bheat-/.test(t.className)).map((t) => t.textContent) };
    });
    check('N-fog', `five heat changes at once leave one heat toast with the final state and at most 2 toasts in all (saw ${flap.n}: ${flap.heat.join(' | ')})`, flap.n <= 2 && flap.heat.length === 1 && flap.heat[0] === 'Calm: you are ahead of the Star.', JSON.stringify(flap));
    // M in a node of an expedition run: the fog map, read-only, in a window
    const left = await page.evaluate(async () => { const ui = window.__ui; for (let n = 0; n < 40; n++) { const v = ui.view(); if (v.phase !== 'MAP' && v.phase !== 'SUMMARY' && v.zone && v.zone.exp) return v.phase; await ui.act({ type: 'AUTO' }); await ui.idle(); } return null; });
    await idle(page); await page.keyboard.press('KeyM'); await page.waitForTimeout(150);
    const mw = await page.evaluate(() => { const w = document.querySelector('#win-map'); if (!w) return null; const r = w.getBoundingClientRect(); return { exp: w.classList.contains('expmap'), nodes: w.querySelectorAll('.mnode').length, reach: w.querySelectorAll('.mnode.reach').length, moves: !!w.querySelector('.expmoves'), r: [r.left, r.top, r.right, r.bottom].map(Math.round) }; });
    await shot(page, 'N-map-window');
    check('N-fog', `M in an expedition run off the map screen (${left}): the fog map opens read-only in a window (no moves), fully in view`, !!mw && mw.exp && mw.nodes > 10 && !mw.reach && !mw.moves && mw.r[0] >= 0 && mw.r[1] >= 0 && mw.r[2] <= W && mw.r[3] <= H, JSON.stringify(mw));
    await page.keyboard.press('KeyM');
  } catch (e) {
    await shot(page, 'N-error');
    check('-', 'part N (fog map) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
  }
  check('-', 'part N: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part O: the character sheet's Damage block
// Owner feedback 2026-11-11 11:58: every number of the block and the Power / Weapon damage hovers = R.damageView of a
// Node twin; a Hunter (pet line) and a Mage (no Weapon damage on Ember Bolt), in a hub and in a fight.
async function partO(browser, W, H) {
  for (const cls of ['hunter', 'mage']) {
    const { context, page, errors } = await open(browser, W, H, 'seed=12&speed=instant');
    const twin = makeTwinOpts(12, {});
    try {
      await page.locator(`#create .ccard[data-cls="${cls}"]`).click();
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const got = page.getByRole('button', { name: 'Got it' }); if (await got.count()) await got.first().click();
      const read = async () => {
        if (!(await page.locator('#win-character').count())) { await page.keyboard.press('KeyC'); await idle(page); }
        return page.evaluate(() => {
          const b = document.querySelector('#win-character .dmgblock'); if (!b) return null;
          const row = (sel) => { const e = b.querySelector(sel); return e ? { name: e.querySelector('.dk').textContent, range: e.querySelector('.dr').textContent, avg: e.querySelector('.da').textContent, lo: Number(e.dataset.lo), hi: Number(e.dataset.hi), mean: Number(e.dataset.avg) } : null; };
          return { pct: Number(b.querySelector('.dmbonus').dataset.pct), bonus: b.querySelector('.dmbonus .dr').textContent, main: row('.dmmain'), pet: row('.dmpet') };
        });
      };
      const cmp = (ui, dv) => {
        const out = [];
        if (!ui) return ['no Damage block'];
        if (ui.pct !== dv.pct) out.push(`bonus ${ui.pct} (engine ${dv.pct})`);
        const one = (u, x, what) => { if (!u) { out.push(`${what} missing`); return; } if (u.lo !== x.lo || u.hi !== x.hi || u.mean !== x.avg || u.range.replace(/[\s,  ]/g, '') !== `${x.lo}–${x.hi}` || !u.avg.includes(String(Math.round(x.avg * 100) / 100))) out.push(`${what} ${JSON.stringify(u)} (engine ${x.lo}-${x.hi}, ${x.avg})`); };
        one(ui.main, dv.main, dv.main.name);
        if (dv.pet) one(ui.pet, dv.pet, 'pet'); else if (ui.pet) out.push('a pet line without a pet');
        return out;
      };
      let s = await twin.sync(page); let dv = R.damageView(s);
      let ui = await read(); let diff = cmp(ui, dv);
      check('O-sheet', `${cls} at the hub: Damage bonus ${ui && ui.bonus}, ${dv.main.name} ${dv.main.lo}–${dv.main.hi} avg ${dv.main.avg}${dv.pet ? `, ${dv.pet.name} ${dv.pet.lo}–${dv.pet.hi}` : ''} = R.damageView`, !diff.length, diff.join(' | '));
      const tp = await tipOf(page, page.locator('#win-character .statgrid div').filter({ hasText: 'Power' }).first());
      const tw = await tipOf(page, page.locator('#win-character .statgrid div').filter({ hasText: 'Weapon damage' }).first());
      const n2 = (x) => (Math.round(x * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
      const wantW = dv.perWd > 0 ? `1 Weapon damage = +${n2(dv.perWd)} damage on ${dv.main.name}` : `Weapon damage does not add to ${dv.main.name}`;
      check('O-sheet', `${cls}: hovering Power and Weapon damage gives the value per point ("1 Power = +${n2(dv.perPower)} damage on ${dv.main.name}"; "${wantW}")`, tp.includes(`1 Power = +${n2(dv.perPower)} damage on ${dv.main.name}`) && tw.includes(wantW), `${tp} || ${tw}`);
      const tm = await tipOf(page, page.locator('#win-character .dmmain'));
      check('O-sheet', `${cls}: the main attack's tooltip has its crit range and chance (${dv.main.critLo}–${dv.main.critHi})`, tm.includes(`A critical hit: ${dv.main.critLo}–${dv.main.critHi}`), tm);
      const pl = await placement(page.locator('#win-character .dmgblock'));
      check('O-sheet', `${cls}: the Damage block is fully in view in the character window`, fullyShown(pl), placeText(pl));
      if (cls === 'hunter') await shot(page, 'O-sheet');
      // in a fight: the engine's numbers with the fight's buffs
      await page.keyboard.press('KeyC'); await idle(page);
      const r = await page.evaluate(async () => { const ui = window.__ui; for (let n = 0; n < 300; n++) { const v = ui.view(); if (v.combat && !v.combat.over) return true; if (v.phase === 'SUMMARY') return false; await ui.act({ type: 'AUTO' }); await ui.idle(); } return false; });
      if (!r) throw new Error('setup: no fight reached');
      s = await twin.sync(page); dv = R.damageView(s);
      ui = await read(); diff = cmp(ui, dv);
      check('O-sheet', `${cls} in a fight (round ${s.fight.round}): the block = R.damageView`, !diff.length, diff.join(' | '));
    } catch (e) {
      await shot(page, `O-error-${cls}`);
      check('-', `part O (${cls}) ran to the end`, false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', `part O (${cls}): no console errors, page errors or requests`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part P: the Deathblow (M2b v13)
const P_ELITE = 'z2_bargh'; // zone 2 elite with a heavy Deathblow (Tidefall Slam)
/** The Deathblow display on the page: the line over each enemy, chips, rows, ruler, engage cards and alert, bar, items, MAIMED, the prompt. */
const pDom = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  const wst = (root) => [...root.querySelectorAll('.wstk .wst')].map((b) => ({ part: b.dataset.part || '', value: Number(b.dataset.value), text: b.textContent }));
  const tf = document.querySelector('#target-frame'); const mb = document.querySelector('#player-frame .maimb'); const tp = document.querySelector('#turnprompt');
  return {
    np: [...document.querySelectorAll('#nameplates .np')].filter((el) => !el.classList.contains('dead')).map((el) => {
      const wub = el.querySelector('.wub'); const no = wub && wub.querySelector('.db-a.no');
      return { idx: Number(el.dataset.idx), newTag: vis(el.querySelector('.newtag')), wst: wst(el),
        chips: [...el.querySelectorAll('.trk .tk')].map((c) => ({ turn: Number(c.dataset.turn), db: c.classList.contains('db'), ribbon: (c.querySelector('.b-wu') || {}).textContent || '', soft: c.dataset.soft || '', lethal: c.dataset.lethal || '' })),
        wub: vis(wub) ? { text: wub.textContent, turn: Number(wub.dataset.turn), db: wub.dataset.deathblow === '1', est: Number(wub.dataset.est), ready: wub.dataset.ready, state: wub.dataset.state, lethal: wub.dataset.lethal || '', warn: (wub.querySelector('.db-warn') || {}).textContent || '',
          no: vis(no) ? getComputedStyle(no).color : null, answers: [...wub.querySelectorAll('.ans-o')].map((a) => ({ via: a.dataset.via, id: a.dataset.id, text: a.textContent.trim() })) } : null };
    }),
    rows: vis(tf) ? [...tf.querySelectorAll('.ttrack .tr')].map((r) => ({ turn: Number(r.dataset.turn), db: r.classList.contains('db'), text: r.textContent, soft: r.dataset.soft || '', lethal: r.dataset.lethal || '', flag: (r.querySelector('.flag.wu') || {}).textContent || '' })) : [],
    twst: vis(tf) ? wst(tf) : [], tnew: vis(tf) && !!tf.querySelector('.rank-tag.new'),
    ruler: document.querySelectorAll('#ruler').length, // D150 item 16: no opening ruler
    cards: [...document.querySelectorAll('#engage .eg-opt')].map((c) => ({ opt: c.dataset.opt, db: c.dataset.db || '', tag: !!c.querySelector('.eg-dbtag'), mark: c.classList.contains('db-ans'), dbc: (c.querySelector('.eg-dbc') || {}).textContent || '' })),
    alert: [...document.querySelectorAll('#engage .eg-db')].map((a) => ({ u: Number(a.dataset.u), turn: Number(a.dataset.turn), ready: a.dataset.ready, text: a.textContent })),
    bar: [...document.querySelectorAll('#actionbar .ab[data-slot]')].map((b) => ({ slot: Number(b.dataset.slot), db: b.dataset.db || '', now: b.classList.contains('db-now'), soon: b.classList.contains('db-soon'), tag: (b.querySelector('.atag') || {}).textContent || '' })),
    items: [...document.querySelectorAll('#actionbar .ab[data-islot]')].map((b) => ({ slot: Number(b.dataset.islot), mtag: (b.querySelector('.mtag') || {}).textContent || '' })),
    maim: vis(mb) ? { text: mb.textContent, value: Number(mb.dataset.value) } : null,
    prompt: vis(tp) ? { kind: tp.dataset.kind, text: tp.textContent.replace(/\s+/g, ' ').trim(), lethal: tp.dataset.lethal || '' } : null,
    attack: (() => { const b = document.querySelector('#actionbar .ab.basic'); return b ? { sap: b.classList.contains('breaks-sap'), tag: (b.querySelector('.sapw') || {}).textContent || '' } : null; })(),
    alertText: [...document.querySelectorAll('#engage .eg-db')].map((a) => a.textContent).join(' | '),
  };
});
/** The key the page names for a windupView answer: Q, W, E by R.engageOptions' order; a bar spell's slot + 1. */
const pKey = (s, a) => (a.via === 'engage' ? ['Q', 'W', 'E'][(R.engageOptions(s) || []).findIndex((o) => o.id === a.id)] || '' : String(s.player.bar.indexOf(a.id) + 1));
const pDigits = (t) => (t || '').replace(/\D/g, '');
/** "MAIMS if it lands"; aimed at the pet: "MAIMS you if it hits your pet" (QA 2026-11-12; the engine lands it on a pet hit). */
const pMaims = (w) => (w.target === 'pet' ? 'MAIMS you if it hits your pet' : 'MAIMS if it lands');
const P_WARN = 'Attacking breaks Sap: the Deathblow will land'; // src/ui/tracks.js SAP_BREAK_WARN
/**
 * The Deathblow's telegraph on the page against windupView item w (enemy e): the line, the chip, the row. D150 item 2: the
 * line names it and its stakes ("Deathblow R3 MAIMS if it lands"), no estimate and no answers (the turn prompt's); no ruler.
 */
function pTelegraph(d, w, opts = {}) {
  const bad = [];
  const np = d.np.find((x) => x.idx === w.u);
  if (!np || !np.wub) return [`no line over enemy ${w.u}`];
  const L = np.wub;
  if (!L.db || L.turn !== w.turn || L.est !== w.est) bad.push(`line ${JSON.stringify(L)} vs turn ${w.turn} est ${w.est}`);
  if (!L.text.includes(`Deathblow ${w.inRounds === 0 ? 'now' : `R${w.round}`}`) || L.text.includes('≈') || !L.text.includes(w.maims ? pMaims(w) : '') || L.answers.length) bad.push(`line text "${L.text}" (answers ${L.answers.length})`);
  const chip = np.chips.find((c) => c.turn === w.turn);
  if (!chip || !chip.db || chip.ribbon !== 'DEATHBLOW' || np.chips.some((c) => c.db && c.turn !== w.turn)) bad.push(`chips ${JSON.stringify(np.chips)}`);
  if (opts.target) { const row = d.rows.find((r) => r.turn === w.turn); if (!row || !row.db || !row.text.includes(pMaims(w)) || d.rows.some((r) => r.db && r.turn !== w.turn)) bad.push(`rows ${JSON.stringify(d.rows)}`); }
  if (d.ruler) bad.push(`an opening ruler (${d.ruler})`);
  return bad;
}
/** D150 item 2: the turn prompt's head for windupView item w: "Round 3: Tidefall Slam, about 130." ("on your pet" when aimed at it). */
const pHead = (w) => `Round ${w.round}: ${w.name}${w.est ? `, about ${w.est}` : ''}${w.target === 'pet' ? ' on your pet' : ''}.`;
async function partP(browser, W, H) {
  // ---- (1) Hunter: telegraph, answers, autoplay hint, no answer ready, landed (MAIMED, potions, +100 %), the map tooltips
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'hunter', zone: 2 })); await idle(page);
      // the map first: elite and dungeon nodes name their Deathblow and its kind (mapView deathblow, bossDeathblow)
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page); await page.mouse.move(2, 2);
      let s = await twin();
      const mv = R.mapView(s); const nodes = [];
      mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (n.type === 'elite' || n.type === 'dungeon') nodes.push({ r: ri + 1, l, n }); }));
      const badMap = []; let named = 0;
      for (const { r, l, n } of nodes) {
        await page.locator(`#screens button.mnode[data-row="${r}"][data-lane="${l}"]`).hover(); await page.waitForTimeout(160);
        const t = (await page.getByRole('tooltip').innerText().catch(() => '')).replace(NBSP, ' ');
        const db = n.type === 'elite' ? n.deathblow : n.bossDeathblow;
        // D150 item 23: one line, the same for a named or a hidden elite: no rules for answers the hero may not own yet
        const want = !db ? null : `${n.type === 'dungeon' ? 'Its boss has a Deathblow' : 'Has a Deathblow'}: one huge hit you must stop.`;
        if (want ? !t.includes(want) || /Landed, it maims you|stun, control or interrupt/.test(t) : /Deathblow/.test(t)) badMap.push(`${n.type} r${r} l${l}: want ${want || 'no Deathblow line'}; saw ${t.replace(/\n/g, ' / ').slice(0, 160)}`);
        if (want) named++;
        await page.mouse.move(2, 2);
      }
      check('M2b-v13', `map: every elite and dungeon node's tooltip has its Deathblow line exactly when mapView gives one, "Has a Deathblow: one huge hit you must stop." (D150 item 23) (${nodes.length} nodes, ${named} lines)`, nodes.length > 0 && named > 0 && !badMap.length, badMap.join(' | ') || `${nodes.length} nodes`);
      // the fight: Bargh the Drowned King, its engage round
      await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
      s = await twin();
      const w = (R.windupView(s) || []).find((x) => x.deathblow);
      let d = await pDom(page);
      await shot(page, 'P-engage');
      let bad = w ? pTelegraph(d, w, { target: true }) : ['no Deathblow in windupView'];
      check('M2b-v13', `engage round: the Deathblow over ${w && w.enemy} ("Deathblow R${w && w.round} MAIMS if it lands"), its chip and target row = R.windupView`, !bad.length, bad.join(' | '));
      // the answers: engage cards and the names on the line = windupView's engage answers (keys; sure)
      const eng = w.answers.filter((a) => a.via === 'engage');
      const wantCards = [...new Set(eng.map((a) => a.id))].map((id) => `${id}:${eng.some((a) => a.id === id && a.sure) ? 'sure' : 'chance'}`).sort().join(' ');
      // D150 item 2: the cards that answer it keep their crimson mark (data-db, .db-ans), with no tag or text; no alert box
      const sawCards = d.cards.filter((c) => c.db && c.mark && !c.tag && !c.dbc).map((c) => `${c.opt}:${c.db}`).sort().join(' ');
      const L = d.np.find((x) => x.idx === w.u).wub;
      check('M2b-v13', `the engage cards that stop it marked (${wantCards}) = windupView's engage answers; ready ${w.ready}; no Deathblow box in the panel, no answers on the line`,
        eng.length > 0 && sawCards === wantCards && w.ready && L.ready === '1' && !L.no && !L.answers.length && d.alert.length === 0, `cards ${JSON.stringify(d.cards)} | line ${JSON.stringify(L)} | alert ${JSON.stringify(d.alert)}`);
      const first = [...eng.filter((a) => a.now)].sort((p, q) => (q.sure ? 1 : 0) - (p.sure ? 1 : 0))[0] || eng[0];
      check('M2b-v13', `engage round: the turn prompt says it once: "${pHead(w)} ${first.name} now ${pKey(s, first)}..."`, !!d.prompt && d.prompt.kind === 'deathblow' && d.prompt.text.includes(pHead(w)) && d.prompt.text.includes(`${first.name} now ${pKey(s, first)}`), JSON.stringify(d.prompt));
      // the autoplay hint (rule E2): Z on, the line, Z off before autoplay acts (its delay held long for the reading)
      await page.evaluate(() => { window.__ui.settings.set('autoDelay', 9000); window.__ui.settings.set('speed', 1); });
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__ui.view().autoplay === true, null, { timeout: 4000 }); await idle(page); await page.waitForTimeout(150);
      const ae = R.autoplayEngage(await twin());
      d = await pDom(page);
      await shot(page, 'P-autoplay-hint');
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__ui.view().autoplay === false, null, { timeout: 4000 }); await idle(page);
      await page.evaluate(() => { window.__ui.settings.set('speed', 0); window.__ui.settings.set('autoDelay', 350); });
      const stillEngage = R.isEngageRound(await twin());
      check('M2b-v13', `autoplay on in the engage round: "Autoplay will stop the Deathblow with ${ae && ae.name}" (R.autoplayEngage); off again before it acts`,
        !!ae && !!d.prompt && d.prompt.kind === 'auto-db' && d.prompt.text.includes(`Autoplay will stop the Deathblow with ${ae.name}`) && stillEngage, `${JSON.stringify(d.prompt)}; autoplayEngage ${JSON.stringify(ae && ae.name)}; still the engage round ${stillEngage}`);
      // round 2: nothing on the bar answers it by round 3 (windupView ready false): "No answer ready" in red
      const potBefore = R.potionInfo(s, 'healing_draught');
      await page.keyboard.press('KeyX'); await idle(page); await page.mouse.move(2, 2);
      s = await twin();
      const w2 = (R.windupView(s) || []).find((x) => x.deathblow);
      d = await pDom(page);
      const L2 = w2 && d.np.find((x) => x.idx === w2.u).wub;
      const red = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c || ''); return !!m && Number(m[1]) >= 200 && Number(m[2]) < 110 && Number(m[3]) < 110; };
      // D150 item 2: "No answer ready" is the prompt's (the line keeps its stakes only)
      check('M2b-v13', `round 2: windupView ready ${w2 && w2.ready}: the turn prompt says "${pHead(w2 || w)} No answer ready: kill it first or brace for it."; the line no instruction`,
        !!w2 && !w2.ready && !!L2 && !L2.text.includes('No answer ready') && L2.ready === '' && !!d.prompt && d.prompt.kind === 'deathblow-no' && d.prompt.text.includes(`${pHead(w2)} No answer ready: kill it first or brace for it.`), `${JSON.stringify(L2)}; prompt ${JSON.stringify(d.prompt)}; red ${typeof red}`);
      // it lands: MAIMED, the cut potion amount, "+100 %" on the enemy, the log
      for (let n = 0; n < 3; n++) { const t = await twin(); if (t.fight.p.st.some((x) => x.id === 'MAIMED')) break; await page.keyboard.press('KeyX'); await idle(page); }
      await page.mouse.move(2, 2); await page.waitForTimeout(150);
      s = await twin();
      const mst = s.fight.p.st.find((x) => x.id === 'MAIMED'); const est = s.fight.enemies[w.u].st.find((x) => x.id === 'EMPOWERED');
      const pot = R.potionInfo(s, 'healing_draught');
      d = await pDom(page);
      await shot(page, 'P-maimed');
      check('M2b-v13', `landed: MAIMED on the player frame, "Healing −${jPct(mst && mst.value)}" = the engine's status`, !!mst && !!d.maim && d.maim.text.includes(`Healing −${jPct(mst.value)}`) && Math.abs(d.maim.value - mst.value) < 1e-9, `${JSON.stringify(d.maim)}; engine ${JSON.stringify(mst)}`);
      const slot = s.player.itemBar.indexOf('healing_draught');
      const it = d.items.find((x) => x.slot === slot);
      const ttip = slot >= 0 ? await tipText(page, page.locator(`#actionbar .ab[data-islot="${slot}"]`)) : '';
      check('M2b-v13', `MAIMED halves the potion: its button shows +${pot && pot.heal} and its tooltip "restores ${pot && pot.heal} health" (R.potionInfo; ${potBefore && potBefore.heal} before, × ${1 - (pot ? pot.maim : 0)})`,
        !!pot && pot.maim > 0 && Math.abs(pot.heal - potBefore.heal * (1 - pot.maim)) <= 0.5 && !!it && pDigits(it.mtag) === String(pot.heal) && ttip.includes(`Maimed: restores ${pot.heal} health`), `${JSON.stringify(it)}; tooltip ${ttip.replace(/\n/g, ' / ')}; engine ${JSON.stringify(pot)}`);
      const npd = d.np.find((x) => x.idx === w.u);
      const dbB = (list) => list.filter((b) => b.part === 'deathblow');
      const okBadge = (list) => dbB(list).length === 1 && Math.abs(dbB(list)[0].value - est.deathblowValue) < 1e-9 && dbB(list)[0].text.includes(`+${jPct(est.deathblowValue)} dmg`);
      check('M2b-v13', `landed: "Deathblow +${jPct(est && est.deathblowValue)} dmg" on the nameplate and the target frame = EMPOWERED's deathblowValue`, !!est && est.deathblows === 1 && !!npd && okBadge(npd.wst) && okBadge(d.twst), `${JSON.stringify(npd && npd.wst)}; target ${JSON.stringify(d.twst)}; engine ${JSON.stringify(est)}`);
      const log = await logLines(page);
      check('M2b-v13', 'landed: the log says "Deathblow landed: ..., you are maimed"', log.some((l) => l.startsWith(`Deathblow landed: ${w.enemy}'s ${w.name}`) && l.includes(`+${jPct(R.C.DEATHBLOW_EMPOWER)} damage`) && l.includes(`you are maimed: healing you receive −${jPct(mst.value)}`)), log.slice(-3).join(' / '));
    } catch (e) {
      await shot(page, 'P-error-hunter');
      check('-', 'part P (Hunter) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (Hunter): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2) Rogue: Sap a chance; Throat Jab kept for round 3, then answering now; its key answers it
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2 })); await idle(page);
      await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
      let s = await twin();
      let w = (R.windupView(s) || []).find((x) => x.deathblow);
      let d = await pDom(page);
      const spell = w && w.answers.find((a) => a.via === 'spell' && a.how === 'interrupt');
      const sap = w && w.answers.find((a) => a.via === 'engage' && a.id === 'sap');
      const slot = spell ? s.player.bar.indexOf(spell.id) : -1;
      const b1 = d.bar.find((x) => x.slot === slot);
      // M2b v14 (UI need 2): a lone elite: Sap is sure if you wait (windupView `wait`): its card "wait" with the engine's words
      // D150 item 2: the card is marked (data-db "wait") and says what Sap does, not how to stop the Deathblow (the prompt's)
      const sapCard = await page.evaluate(() => { const c = document.querySelector('#engage .eg-opt[data-opt="sap"] .eg-dbc'); return c ? c.textContent : ''; });
      check('M2b-v14', `Rogue, engage round: Sap stops it (sure ${sap && sap.sure}, wait ${sap && sap.wait}): its card marked "${sap && sap.wait ? 'wait' : 'chance'}" with no instruction text; ${spell && spell.name} (not now) kept for round ${w && w.round}: "R${w && w.round}" on key ${slot + 1}`,
        !!sap && !sap.sure && d.cards.some((c) => c.opt === 'sap' && c.db === (sap.wait ? 'wait' : 'chance') && c.mark) && sapCard === '' && !!spell && !spell.now && !!b1 && b1.soon && !b1.now && b1.tag === `R${w.round}`, `cards ${JSON.stringify(d.cards)}; card text "${sapCard}"; bar ${JSON.stringify(b1)}`);
      for (let n = 0; n < 4; n++) { s = await twin(); w = (R.windupView(s) || []).find((x) => x.deathblow); if (!w || w.inRounds === 0) break; await page.keyboard.press('KeyX'); await idle(page); }
      await page.mouse.move(2, 2);
      d = await pDom(page);
      const now = w && w.answers.find((a) => a.via === 'spell' && a.id === spell.id);
      const b3 = d.bar.find((x) => x.slot === slot);
      const bad = w ? pTelegraph(d, w) : ['no Deathblow'];
      await shot(page, 'P-rogue-now');
      check('M2b-v13', `Rogue, round ${w && w.round}: the Deathblow plays now; ${spell.name} stops it now (windupView now ${now && now.now}): the bar marks it ("Stop"), the prompt names key ${slot + 1}`,
        !bad.length && !!now && now.now && !!b3 && b3.now && b3.tag.startsWith('Stop') && !!d.prompt && d.prompt.text.includes(`${pHead(w)} ${spell.name} now ${slot + 1}.`),
        `${bad.join(' | ')}; bar ${JSON.stringify(b3)}; prompt ${JSON.stringify(d.prompt)}`);
      await page.keyboard.press(`Digit${slot + 1}`); await idle(page);
      s = await twin();
      const st = s.fight && s.fight.enemies[w.u].st.find((x) => x.id === 'STAGGERED');
      const log = await logLines(page);
      check('M2b-v13', `key ${slot + 1}: the Deathblow is stopped (STAGGERED in the engine), the log says "Deathblow stopped: ... by your ${spell.name}", no MAIMED`,
        !!st && !s.fight.p.st.some((x) => x.id === 'MAIMED') && log.some((l) => l.startsWith(`Deathblow stopped: ${w.enemy}'s ${w.name} by your ${spell.name}.`)) && !(await pDom(page)).maim, log.slice(-3).join(' / '));
    } catch (e) {
      await shot(page, 'P-error-rogue');
      check('-', 'part P (Rogue) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (Rogue): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2b) M2b v14 (UI needs 1-2): the Rogue's autoplay hint "..., then wait a round"; Sap, then Pass rings in round 2 and
  // the prompt says to wait; X: Sap cancels the Deathblow (STAGGERED), the Rogue still hidden
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2 })); await idle(page);
      await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
      await page.evaluate(() => { window.__ui.settings.set('autoDelay', 9000); window.__ui.settings.set('speed', 1); });
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__ui.view().autoplay === true, null, { timeout: 4000 }); await idle(page); await page.waitForTimeout(150);
      let s = await twin();
      const ae = R.autoplayEngage(s);
      let d = await pDom(page);
      await shot(page, 'P-rogue-autoplay-wait');
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__ui.view().autoplay === false, null, { timeout: 4000 }); await idle(page);
      await page.evaluate(() => { window.__ui.settings.set('speed', 0); window.__ui.settings.set('autoDelay', 350); });
      check('M2b-v14', `Rogue, autoplay on in the engage round: "Autoplay will stop the Deathblow with Sap, then wait a round" (R.autoplayEngage wait ${ae && ae.wait})`,
        !!ae && ae.option === 'sap' && ae.wait === true && !!d.prompt && d.prompt.kind === 'auto-db' && d.prompt.text.includes('Autoplay will stop the Deathblow with Sap, then wait a round') && R.isEngageRound(await twin()), `${JSON.stringify(d.prompt)}; autoplayEngage ${JSON.stringify(ae)}`);
      // Sap (its key on the engage panel), then round 2: Pass is the answer
      const sapKey = ['Q', 'W', 'E'][(R.engageOptions(s) || []).findIndex((o) => o.id === 'sap')];
      // QA 2026-11-12: the manual prompt in the engage round says Sap is sure if you wait, as the line and the card do (not "(a chance)")
      await page.mouse.move(2, 2); await page.waitForTimeout(100);
      d = await pDom(page);
      const wS = (R.windupView(s) || []).find((x) => x.deathblow) || { answers: [] };
      const sapW = wS.answers.find((a) => a.id === 'sap');
      check('M2b-v14', `Rogue, engage round, autoplay off: the turn prompt reads "${wS.round ? pHead(wS) : ''} Sap now ${sapKey}, then Pass X.", no "(a chance)" (windupView Sap wait ${sapW && sapW.wait})`,
        !!sapW && sapW.wait && !!d.prompt && d.prompt.kind === 'deathblow' && d.prompt.text.includes(`${pHead(wS)} Sap now ${sapKey}, then Pass X.`) && !d.prompt.text.includes('a chance'), JSON.stringify(d.prompt));
      await page.keyboard.press(`Key${sapKey}`); await idle(page);
      const t0 = await twin();
      if (R.isEngageRound(t0)) { await page.locator(`#nameplates .np[data-idx="${ae.target}"]`).click().catch(() => {}); await idle(page); }
      await page.mouse.move(2, 2);
      s = await twin();
      const w = (R.windupView(s) || []).find((x) => x.deathblow);
      const pa = w && w.answers.find((a) => a.via === 'pass');
      d = await pDom(page);
      const passBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('.ctrl .btn')].find((x) => /^Pass/.test(x.textContent)); return b ? { ring: b.classList.contains('db-now'), db: b.dataset.db || '' } : null; });
      const L = w && d.np.find((x) => x.idx === w.u);
      await shot(page, 'P-rogue-wait');
      check('M2b-v14', `Rogue, round ${s.fight && s.fight.round} after Sap: windupView's PASS answer (now ${pa && pa.now}): the Pass button has the answer ring, the prompt says it once ("${w ? pHead(w) : ''} Pass X. Attacking breaks Sap."), the line no instruction`,
        !!pa && pa.now && w.ready && !!passBtn && passBtn.ring && passBtn.db === 'now' && !!L && !!L.wub && !L.wub.answers.length && !L.wub.warn
          && !!d.prompt && d.prompt.kind === 'deathblow' && d.prompt.text.includes(`${pHead(w)} Pass X. Attacking breaks Sap.`) && !/hidden/.test(d.prompt.text),
        `pass ${JSON.stringify(passBtn)}; line ${JSON.stringify(L && L.wub && L.wub.answers)}; prompt ${JSON.stringify(d.prompt)}; answer ${JSON.stringify(pa)}`);
      // QA 2026-11-12 (finding 2): until Sap cancels it, "If you wait" (not ANSWERED) on its chip, its row and the ruler; attacking warned
      const wChip = L && L.chips.find((c) => c.turn === w.turn); const wRow = d.rows.find((r) => r.turn === w.turn);
      check('QA-2026-11-12', 'Rogue, waiting round: the Deathblow\'s chip and target row say "If you wait" (the row "Sapped: stopped if you wait"), not STOPPED; the prompt warns "Attacking breaks Sap." (D150: once); the attack button is marked "Breaks Sap"',
        !!wChip && wChip.ribbon === 'IF YOU WAIT' && wChip.soft === 'wait' && !!wRow && wRow.soft === 'wait' && wRow.flag === 'If you wait' && wRow.text.includes('stopped if you wait') && !/Stopped/.test(wRow.flag)
          && d.prompt.text.includes('Attacking breaks Sap.') && !!d.attack && d.attack.sap && d.attack.tag === 'Breaks Sap',
        `chip ${JSON.stringify(wChip)}; row ${JSON.stringify(wRow)}; prompt ${JSON.stringify(d.prompt)}; attack ${JSON.stringify(d.attack)}`);
      await page.keyboard.press('KeyX'); await idle(page);
      s = await twin();
      const e = s.fight && s.fight.enemies[w.u];
      const stg = e && e.st.find((x) => x.id === 'STAGGERED');
      const passB2 = await page.evaluate(() => { const b = [...document.querySelectorAll('.ctrl .btn')].find((x) => /^Pass/.test(x.textContent)); return b ? b.classList.contains('db-now') : null; });
      check('M2b-v14', 'X: Sap cancels the Deathblow at its turn (STAGGERED, no MAIMED), the Rogue is still in STEALTH, and the Pass ring is gone',
        !!stg && stg.deathblows === 1 && !s.fight.p.st.some((x) => x.id === 'MAIMED') && s.fight.p.st.some((x) => x.id === 'STEALTH') && passB2 === false, `${JSON.stringify(stg)}; player ${JSON.stringify(s.fight && s.fight.p.st.map((x) => x.id))}; ring ${passB2}`);
      await page.mouse.move(2, 2);
      const d3 = await pDom(page); const L3 = d3.np.find((x) => x.idx === w.u);
      check('QA-2026-11-12', 'once Sap has cancelled it: no "If you wait" on the chips or rows, no warning on the line or the prompt, the attack button unmarked',
        !!L3 && !L3.chips.some((c) => c.soft) && !d3.rows.some((r) => r.soft) && !(L3.wub && L3.wub.warn) && !(d3.prompt && /breaks Sap/.test(d3.prompt.text)) && !!d3.attack && !d3.attack.sap,
        `chips ${JSON.stringify(L3 && L3.chips)}; rows ${JSON.stringify(d3.rows)}; line ${JSON.stringify(L3 && L3.wub)}; prompt ${JSON.stringify(d3.prompt)}; attack ${JSON.stringify(d3.attack)}`);
    } catch (e) {
      await shot(page, 'P-error-rogue-wait');
      check('-', 'part P (Rogue wait) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (Rogue wait): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (3) a first meeting (gated, rules 7.12): "New" on that enemy's nameplate and the target frame, no other
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      const ser = lFight('hunter', 5, 2, (o) => { o.fight.enemies[1].firstMeet = true; });
      await page.evaluate((x) => window.__ui.loadState(x), ser); await idle(page);
      await page.locator('#nameplates .np[data-idx="1"]').click(); await idle(page); await page.mouse.move(2, 2);
      const d = await pDom(page);
      check('M2b-v13', 'first meeting: "New" on the nameplate of the enemy the engine marks firstMeet, and on the target frame; none on the other', d.np.find((x) => x.idx === 1).newTag && !d.np.find((x) => x.idx === 0).newTag && d.tnew, JSON.stringify(d.np.map((x) => [x.idx, x.newTag])) + ` target ${d.tnew}`);
    } catch (e) {
      check('-', 'part P (first meeting) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (first meeting): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (4) QA 2026-11-12: a Mage's Disrupt on the zone 1 dungeon boss answers its Deathblow: the line says "Disrupt: answered" (not "your trap")
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'mage', zone: 1 })); await idle(page);
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z1_belk'] })); await idle(page); await page.mouse.move(2, 2);
      await page.keyboard.press('KeyW'); await idle(page); await page.mouse.move(2, 2);
      const d = await pDom(page);
      const L = d.np.map((x) => x.wub).find((w) => w && w.db);
      check('M2b-v13', 'dungeon boss, Disrupt (key W) stops the Deathblow: the line over it reads "Disrupt: stopped"', !!L && L.text.includes('Disrupt: stopped') && !L.text.includes('your trap'), JSON.stringify(L));
    } catch (e) {
      check('-', 'part P (Disrupt) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (Disrupt): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (5) QA 2026-11-12 (finding 3): LETHAL when the Deathblow's estimate is at least your health; MAIMED: the heal hint's cut amount
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      let s0 = R.debug.build({ content: CONTENT, classId: 'hunter', seed: 5, zone: 2, mapMode: 'rows' }).state;
      s0 = R.debug.encounter(s0, { ids: [P_ELITE] }).state;
      s0 = R.step(s0, { type: 'PASS' }).state; // round 2: nothing on the bar answers it by round 3 (as in (1))
      const w0 = R.windupView(s0).find((x) => x.deathblow);
      const load = async (edit) => {
        const o = JSON.parse(R.serialize(s0));
        for (const x of o.fight.enemies[w0.u].track) if (x.deathblow) { x.aggro = 'player'; x.target = 'player'; }
        edit(o);
        const ser = JSON.stringify(o);
        await page.evaluate((x) => window.__ui.loadState(x), ser); await idle(page);
        await page.locator(`#nameplates .np[data-idx="${w0.u}"]`).click(); await idle(page); await page.mouse.move(2, 2);
        return R.deserialize(ser, CONTENT);
      };
      // full health: no LETHAL anywhere
      let t = await load((o) => { o.player.hp = Math.max(o.player.hp, w0.est + 50); o.player.d.maxHp = Math.max(o.player.d.maxHp, o.player.hp); });
      let d = await pDom(page);
      const wF = R.windupView(t).find((x) => x.deathblow);
      const noL = (dd, w) => { const np = dd.np.find((x) => x.idx === w.u); return !!np && !!np.wub && !np.wub.lethal && !np.chips.some((c) => c.lethal) && !dd.rows.some((r) => r.lethal) && !!dd.prompt && !dd.prompt.lethal && !/LETHAL/.test(dd.prompt.text); };
      check('QA-2026-11-12', `health ${t.player.hp} above the Deathblow's estimate ${wF.est}: no LETHAL on the line, the chips, the rows or the prompt`, wF.est < t.player.hp && noL(d, wF), JSON.stringify({ np: d.np.find((x) => x.idx === wF.u), rows: d.rows, prompt: d.prompt }));
      // health under it, MAIMED: LETHAL on the line, its chip, its row, the prompt; the heal hint names the potion's cut amount
      t = await load((o) => { o.player.hp = Math.max(1, Math.floor(w0.est * 0.6)); o.fight.p.st.push({ id: 'MAIMED', dur: null, value: R.C.MAIM_HEAL, by: w0.u, src: w0.id, name: w0.name }); });
      d = await pDom(page);
      await shot(page, 'P-lethal-maimed');
      const w = R.windupView(t).find((x) => x.deathblow);
      const pot = R.potionInfo(t, 'healing_draught');
      const slot = t.player.itemBar.indexOf('healing_draught');
      const np = d.np.find((x) => x.idx === w.u); const chip = np && np.chips.find((c) => c.turn === w.turn); const row = d.rows.find((r) => r.turn === w.turn);
      check('QA-2026-11-12', `health ${t.player.hp} under the Deathblow's estimate ${w.est}: LETHAL on the line, its chip, its row and the prompt; MAIMED: the prompt's heal hint "+${pot && pot.heal} (maimed)" = R.potionInfo (maim ${pot && pot.maim})`,
        w.est >= t.player.hp && !!np && !!np.wub && np.wub.lethal === '1' && np.wub.text.includes('LETHAL') && !!chip && chip.lethal === '1' && !!row && row.lethal === '1' && row.text.includes('Lethal')
          && !!d.prompt && d.prompt.lethal === '1' && d.prompt.text.includes(`LETHAL ${pHead(w)}`) && !!pot && pot.maim > 0 && slot >= 0 && d.prompt.text.includes(`${['8', '9', '0'][slot]} Healing Draught +${pot.heal} (maimed)`),
        JSON.stringify({ wub: np && np.wub, chip, row, prompt: d.prompt, pot, slot }));
    } catch (e) {
      await shot(page, 'P-error-lethal');
      check('-', 'part P (LETHAL) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (LETHAL): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (6) QA 2026-11-12 (finding 8): a Deathblow aimed at the pet says what the engine does (lands, and MAIMS you, if it hits your pet)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      let s0 = R.debug.build({ content: CONTENT, classId: 'hunter', seed: 5, zone: 2, mapMode: 'rows' }).state;
      s0 = R.debug.encounter(s0, { ids: [P_ELITE] }).state; // the engage round
      const o = JSON.parse(R.serialize(s0));
      const u = R.windupView(s0).find((x) => x.deathblow).u;
      for (const x of o.fight.enemies[u].track) if (x.deathblow) { x.aggro = 'pet'; x.target = 'pet'; }
      const ser = JSON.stringify(o);
      await page.evaluate((x) => window.__ui.loadState(x), ser); await idle(page);
      await page.locator(`#nameplates .np[data-idx="${u}"]`).click(); await idle(page); await page.mouse.move(2, 2);
      const t = R.deserialize(ser, CONTENT);
      const w = R.windupView(t).find((x) => x.deathblow);
      const d = await pDom(page);
      await shot(page, 'P-pet-deathblow');
      const np = d.np.find((x) => x.idx === u); const row = d.rows.find((r) => r.turn === w.turn);
      // D150 item 2: no alert box; the line and the row say what happens, the prompt "about N on your pet"
      check('QA-2026-11-12', `a Deathblow aimed at the pet (windupView target ${w.target}, maims ${w.maims}, Send the Pet an answer): the line and the row say "MAIMS you if it hits your pet", the prompt "${pHead(w)}"; no LETHAL`,
        w.target === 'pet' && w.maims && w.answers.some((a) => a.id === 'send_pet') && !!np && !!np.wub && np.wub.text.includes('MAIMS you if it hits your pet') && np.wub.text.includes('your pet') && !np.wub.lethal
          && !!row && row.text.includes('MAIMS you if it hits your pet') && !d.alertText && !!d.prompt && d.prompt.text.includes(pHead(w)),
        JSON.stringify({ wub: np && np.wub, row, prompt: d.prompt }));
    } catch (e) {
      await shot(page, 'P-error-pet');
      check('-', 'part P (pet Deathblow) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (pet Deathblow): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (7) QA 2026-11-12 (finding 4): at speed 1 a landed Deathblow's floats overlap nothing shown at the same time
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'hunter', zone: 2 })); await idle(page);
      await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
      const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
      for (let n = 0; n < 3; n++) { const w = (R.windupView(await twin()) || []).find((x) => x.deathblow); if (!w || w.inRounds === 0) break; await page.keyboard.press('KeyX'); await idle(page); }
      await page.evaluate(() => window.__ui.settings.set('speed', 1));
      await page.keyboard.press('KeyX'); await idle(page);
      await page.waitForTimeout(400);
      const fl = await page.evaluate(() => window.__ui.floats());
      await page.evaluate(() => window.__ui.settings.set('speed', 0));
      const maim = fl.floats.find((f) => /^Maimed/.test(f.text)); const land = fl.floats.find((f) => /^Deathblow landed/.test(f.text));
      const t0 = maim ? maim.t0 : 0;
      const near = fl.floats.filter((f) => f.t0 >= t0 - 1.2 && f.t0 <= t0 + 2.5);
      const hit = (a, b) => a.t0 < b.t1 && b.t0 < a.t1 && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      const bad = [];
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
        const a = near[i]; const b = near[j];
        const care = a.lane === 'head' || b.lane === 'head' || (a.lane === 'num') !== (b.lane === 'num') || (a.lane === 'num' && b.lane === 'num' && a.id !== b.id);
        if (care && hit(a, b)) bad.push(`"${a.text}" (${a.id}, ${a.lane}) x "${b.text}" (${b.id}, ${b.lane})`);
      }
      check('QA-2026-11-12', `landed Deathblow at speed 1: "Deathblow landed: empowered" and "Maimed: ..." in the headline lane, and no float shown with them overlaps another (${near.length} floats: numbers, pet numbers, Dodge, words)`,
        !!maim && !!land && maim.lane === 'head' && land.lane === 'head' && !bad.length, bad.join(' | ') || JSON.stringify(near.map((f) => [f.text, f.id, f.lane])));
    } catch (e) {
      await shot(page, 'P-error-floats');
      check('-', 'part P (floats) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (floats): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part Q: sound (docs/specs/audio.md; D127)
const Q_DIM_SEED = 1; // a dev-built expedition run whose zone 1 brings the Dimming near the player within about 30 steps
const Q_PROTECTED = new Set(['deathblowTelegraph', 'deathblowFirstShow', 'deathblowAnswered', 'deathblowLanded', 'maimed', 'playerDeath']);
async function partQ(browser, W, H) {
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  // count the AudioContexts the page makes (none may exist before the first gesture)
  await context.addInitScript(() => { const A = window.AudioContext; let n = 0; window.__acMade = () => n; if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); n += 1; } }; });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) errors.push(`request ${r.url()}`); });
  const audio = () => page.evaluate(() => ({ ...window.__ui.audio(), made: window.__acMade() }));
  const has = (log, cue, from = 0, o = {}) => log.filter((x, i) => i >= from && x.cue === cue && x.kept && (!o.sound || x.sound));
  const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
  try {
    await page.goto(`${URL}?seed=5&speed=instant&classic=1`);
    await page.waitForFunction(() => window.__ui);
    let a = await audio();
    check('SOUND', 'page loaded: no AudioContext, sound locked, nothing logged', a.made === 0 && !a.unlocked && a.state === null && a.log.length === 0, JSON.stringify({ made: a.made, unlocked: a.unlocked, n: a.log.length }));
    // (1) no gesture: a new run on the engine's autoplay choices to its first level-up (steps through window.__ui only)
    await page.evaluate(async () => {
      const ui = window.__ui; await ui.act({ type: 'START_RUN' }); await ui.idle();
      for (let n = 0; n < 400 && !ui.audio().log.some((x) => x.cue === 'levelUp'); n++) { if (ui.view().phase === 'SUMMARY') break; await ui.act({ type: 'AUTO' }); await ui.idle(); }
    });
    a = await audio();
    check('SOUND', 'no gesture: a new run to its first level-up logs levelUp (kept) and hits, with no sound', has(a.log, 'levelUp').length >= 1 && a.log.some((x) => /^hit|^crit|^tick/.test(x.cue)), a.log.slice(-6).map((x) => `${x.cue}${x.kept ? '' : '(dropped)'}`).join(' '));
    // a Hunter against Bargh passes until the Deathblow lands (dev ops and PASS through window.__ui: still no gesture)
    await page.evaluate(() => window.__ui.dev('build', { classId: 'hunter', zone: 2 })); await idle(page);
    await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page);
    const from1 = (await audio()).log.length;
    for (let n = 0; n < 5; n++) { const s = await twin(); if (s.fight && s.fight.p.st.some((x) => x.id === 'MAIMED')) break; await page.evaluate(() => window.__ui.act({ type: 'PASS' })); await idle(page); }
    a = await audio();
    const L1 = a.log.slice(from1); const tel = L1.filter((x) => x.cue === 'deathblowTelegraph'); const land = L1.findIndex((x) => x.cue === 'deathblowLanded' && x.kept);
    check('SOUND', 'no gesture: the Deathblow logs deathblowTelegraph once at its decision, then deathblowLanded and maimed (kept)',
      tel.length === 1 && tel[0].kept && land > L1.indexOf(tel[0]) && has(L1, 'maimed').length === 1, L1.map((x) => `${x.cue}@${x.step}${x.kept ? '' : '(dropped)'}`).join(' '));
    check('SOUND', 'nothing plays before the first gesture: no AudioContext made, every logged cue unsounded', a.made === 0 && !a.unlocked && a.log.length > 0 && a.log.every((x) => !x.sound), `made ${a.made}, unlocked ${a.unlocked}, ${a.log.filter((x) => x.sound).length} of ${a.log.length} sounded`);
    // (2) the first gesture: a click on a button
    const from2 = a.log.length;
    await page.getByRole('button', { name: 'Bags' }).click(); await idle(page);
    await page.locator('#win-bags').getByRole('button', { name: 'Close' }).click(); await idle(page);
    a = await audio();
    check('SOUND', 'first click: one AudioContext, unlocked; uiClick sounds (and the window opens and closes with winOpen, winClose)', a.made === 1 && a.unlocked && has(a.log, 'uiClick', from2, { sound: true }).length >= 2 && has(a.log, 'winOpen', from2).length === 1 && has(a.log, 'winClose', from2).length === 1,
      `made ${a.made} ${a.state}: ${a.log.slice(from2).map((x) => `${x.cue}${x.sound ? '' : '(silent)'}`).join(' ')}`);
    // (3) a Rogue answers the Deathblow with its interrupt (keys: gestures)
    await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2 })); await idle(page);
    await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
    let s = await twin(); let w = null; let spell = null;
    for (let n = 0; n < 5; n++) { s = await twin(); w = (R.windupView(s) || []).find((x) => x.deathblow); if (!w || w.inRounds === 0) break; await page.keyboard.press('KeyX'); await idle(page); }
    spell = w && w.answers.find((x) => x.via === 'spell' && x.how === 'interrupt' && x.now);
    const from3 = (await audio()).log.length;
    if (spell) { await page.keyboard.press(`Digit${s.player.bar.indexOf(spell.id) + 1}`); await idle(page); }
    a = await audio();
    check('SOUND', `Rogue: ${spell ? spell.name : 'an interrupt'} answers the Deathblow: deathblowAnswered sounds`, !!spell && has(a.log, 'deathblowAnswered', from3, { sound: true }).length === 1, a.log.slice(from3).map((x) => `${x.cue}${x.sound ? '' : '(silent)'}`).join(' '));
    // (4) god mode, 4x: attack until a crit and a kill
    await page.evaluate(() => window.__ui.dev('god')); await idle(page);
    await page.evaluate(() => window.__ui.settings.set('speed', 4));
    const from4 = (await audio()).log.length;
    for (let n = 0; n < 80; n++) {
      a = await audio();
      if (has(a.log, 'crit', from4).length && has(a.log, 'kill', from4).length) break;
      const v = await view(page);
      if (v.over || v.round == null) { await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); continue; }
      await page.keyboard.press('KeyA'); await idle(page);
    }
    a = await audio();
    const L4 = a.log.slice(from4);
    check('SOUND', 'god mode at 4x, attacks: hits (hitLight or hitHeavy), a crit and a kill sound', L4.some((x) => /^hit(Light|Heavy)$/.test(x.cue) && x.sound) && has(L4, 'crit', 0, { sound: true }).length > 0 && has(L4, 'kill', 0, { sound: true }).length > 0,
      `${L4.length} cues: ${[...new Set(L4.filter((x) => x.sound).map((x) => x.cue))].join(' ')}`);
    // (5) a Mage passes against Bargh at Instant until it dies
    await page.evaluate(() => { window.__ui.settings.set('speed', 0); }); 
    await page.evaluate(() => window.__ui.dev('build', { classId: 'mage', zone: 2 })); await idle(page);
    await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page);
    const from5 = (await audio()).log.length;
    for (let n = 0; n < 40; n++) { const v = await view(page); if (v.phase === 'SUMMARY' || v.round == null) break; await page.keyboard.press('KeyX'); await idle(page); }
    a = await audio();
    const v5 = await view(page);
    check('SOUND', `Mage passes until it dies (phase ${v5.phase}): playerDeath sounds`, has(a.log, 'playerDeath', from5, { sound: true }).length === 1, a.log.slice(from5).slice(-6).map((x) => `${x.cue}${x.kept ? '' : '(dropped)'}`).join(' '));
    // the Instant rule: no Instant step keeps more than one cue besides the Deathblow cues and the death
    const plays = await page.evaluate(() => window.__ui.plays().length);
    const bySteps = new Map(); for (const x of a.log) if (x.kept && !Q_PROTECTED.has(x.cue) && !['uiClick', 'winOpen', 'winClose', 'error', 'arrive'].includes(x.cue)) bySteps.set(x.step, (bySteps.get(x.step) || []).concat(x.cue));
    const instantSteps = [...a.log.slice(from5).map((x) => x.step)];
    const over = [...bySteps.entries()].filter(([st, list]) => instantSteps.includes(st) && list.length > 1);
    check('SOUND', 'Instant: each step keeps at most one cue besides the Deathblow cues and the death', over.length === 0, over.map(([st, l]) => `step ${st}: ${l.join(' ')}`).join(' | ') || `${plays} steps played`);
    // (6) the Dimming (README cue 10, the reserved glass voice): a Rogue on the expedition map in zone 1 (god mode, the
    // engine's autoplay choices, Instant). After every step the rule is worked out here from the two map views: the front
    // reached new nodes and now the player's node is Dimmed, dims in Q_DIM_NEAR tolls or fewer, or a node next to it was
    // just Dimmed. The cue is logged in exactly those steps (never on a spread far away), kept unless a higher-ranked cue
    // of the same Instant step won, and it sounds (the page is unlocked since (2)). The steps are paced at least
    // RETRIGGER_S apart: back to back, Instant AUTO steps take about 3 ms each on a fast machine, so two near-player
    // spreads a dozen steps apart fell inside the retrigger window and the second was dropped by that rule (correct by
    // audio.md 3, but not what this check tests; 2026-11-19).
    await page.evaluate((seed) => window.__ui.dev('build', { classId: 'rogue', zone: 1, mapMode: 'expedition', prep: true, seed }), Q_DIM_SEED); await idle(page);
    await page.evaluate(() => window.__ui.dev('god', { on: true })); await idle(page);
    const dimSteps = await page.evaluate(async ([near, gapMs]) => {
      const ui = window.__ui; const out = [];
      const rule = (a, b) => {
        const x = a && a.zone && a.zone.exp; const y = b && b.zone && b.zone.exp;
        if (!x || !y || x.z !== y.z || a.seed !== b.seed || x.nodes.length !== y.nodes.length) return { fresh: 0, want: false };
        const fresh = y.nodes.map((n, i) => (n.dimmed && !x.nodes[i].dimmed ? i : -1)).filter((i) => i >= 0);
        const me = y.nodes[y.pos]; const next = new Set(y.edges.filter((e) => e.includes(y.pos)).map(([p, q]) => (p === y.pos ? q : p)));
        return { fresh: fresh.length, want: fresh.length > 0 && (!!me.dimmed || (Number.isFinite(me.dimsIn) && me.dimsIn <= near) || fresh.some((i) => next.has(i))) };
      };
      for (let n = 0; n < 200; n++) {
        const a = ui.view(); if (a.phase === 'SUMMARY' || (a.zone && a.zone.exp && a.zone.exp.z > 1)) break;
        await new Promise((r) => setTimeout(r, gapMs));
        const from = ui.audio().log.length;
        await ui.act({ type: 'AUTO' }); await ui.idle();
        const b = ui.view(); const r = rule(a, b); const L = ui.audio().log.slice(from);
        const dim = L.filter((x) => x.cue === 'dimmingSpread');
        out.push({ n, ...r, got: dim.length, kept: dim.some((x) => x.kept), sound: dim.some((x) => x.sound), others: L.filter((x) => x.kept && x.cue !== 'dimmingSpread').map((x) => x.cue), me: b.zone && b.zone.exp ? b.zone.exp.nodes[b.zone.exp.pos].dimsIn : null });
        if (out.filter((x) => x.want).length >= 2) break;
      }
      return out;
    }, [Q_DIM_NEAR, Math.ceil(Q_RETRIGGER_S * 1000) + 20]);
    const wants = dimSteps.filter((x) => x.want); const spreads = dimSteps.filter((x) => x.fresh > 0);
    const wrong = dimSteps.filter((x) => x.got !== (x.want ? 1 : 0));
    check('SOUND', `the Dimming near the player logs dimmingSpread in exactly the steps the rule names (${spreads.length} spread steps in ${dimSteps.length}, ${wants.length} near the player)`, wants.length >= 1 && !wrong.length,
      wrong.map((x) => `step ${x.n}: fresh ${x.fresh}, dims in ${x.me}, want ${x.want}, got ${x.got}`).join(' | ') || wants.map((x) => `step ${x.n}: dims in ${x.me}`).join(' | ') || 'the run never brought the Dimming near the player');
    const lost = wants.filter((x) => !(x.kept ? x.sound : x.others.some((c) => (Q_RANK[c] || 0) > Q_RANK.dimmingSpread)));
    check('SOUND', 'dimmingSpread sounds when kept; at Instant only a higher-ranked cue of the same step drops it', wants.length >= 1 && !lost.length, lost.map((x) => `step ${x.n}: kept ${x.kept}, sound ${x.sound}, with ${x.others.join(' ')}`).join(' | ') || wants.map((x) => `step ${x.n}: ${x.kept ? 'kept, sounded' : `dropped for ${x.others.join(' ')}`}`).join(' | '));
  } catch (e) {
    await shot(page, 'Q-error');
    check('-', 'part Q ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
  }
  check('-', 'part Q: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ run
const browser = await chromium.launch({ headless: true });
// ------------------------------------------------------------------ part R: the guided first run (M3 3.5)
/**
 * The guided first run and the first-time hints (docs/specs/m3-onboarding.md 2.4-2.7, 3, 4.3, 7.1; engine-api.md 14), real
 * engine at Instant speed, a fresh profile (no stored profile, no hints). (1) Class select offers "Guided first run", on;
 * Enter starts the guided run (create.tutorial). The run is played through the UI on the engine's autoplay choices (AUTO)
 * to zone 2: after every step the coach line shows the engine's beat line (R.tutorialView `line`, content text with the
 * placeholders filled) and every beat line the engine opened appeared on the coach line, in the engine's order. D150
 * (engine-2026-11-14d): G1, G2, G4-G8, G10, G12 (then G12.road) and G13 among them, G3 and G9 with no line; G7 opens in
 * fight 1 and is learned there; S3 (the wind-up fight, D147) opens G8 on its own line: its ring on the wind-up badge, one
 * showing of H03; the joint line G8.withEngage (G7 still open in S3's engage round) is no longer on the route; G9 opens
 * after G8, on Gorrak's node. No coach line covers its anchor, the bar, the engage buttons, the Furnace, the target frame
 * or Set out. Gorrak's node is barred until its script
 * (content elite.gate.afterScript, S3 since D143) has ended: its map tooltip shows the gate line with the fights still to come.
 * (2) Rescue: a loaded state with 1 HP in a guided-zone fight; passing until the hero falls gives the rescue banner with the
 * content's line and toll cost, full health, +ONB_RESCUE_TOLLS. (2b) D147: the same with ONB_RESCUE_MAX - 1 rescues behind:
 * the rescue's banner, then content guide.rescueCapLine as a toast and in the log (not the skip line); no beat line after,
 * the Roads open; a later death ends the run. (3) Skip: "Skip guide" asks in one line, Skip sends
 * SKIP_GUIDE; no beat line after. (4) Hints: the toggle off starts a normal run (guide 'skipped'); hint H23 shows at the
 * camp, once (not after a reload); Hints Off silences them. (5) The nudge after the first summary (a loaded 1 HP fight in
 * the normal run): the welcome line, Spend Echoes glowing with its line, the Hall's Packed Satchel highlighted with the
 * coach line and "Later". D142 (M3 3.7; playtest-2026-11-13 findings 2-5): (6) a Rogue's first guided fight on the
 * route the engine's autoplay plays: D150 item 11, G7's line (key chips Q, W, E, its ring on the engage panel), not G3's;
 * no turn prompt line in the engage round, with or without the coach line; a refused key shows its reason at once, by
 * the spell's name, with two notes on screen; Q plays the engage round (ENGAGE, the strike option). (7) a Mage's first engage round (normal run, hints on): H01 says
 * "Open with Q then N, W or E" (N: the bar key of the first Pre-cast spell), the turn prompt hidden, Q then N pre-casts it;
 * then on to the fifth fight won: no hint shows a third time, each shown twice is stored seen with ONB_HINT_SHOWS
 * showings. (8) D147: a Rogue's S3 engage round: "Got it" on the joint line marks H01:rogue and H03 seen; following it (W,
 * Sap, on the Hexer, then autoplay) learns G7 and G8, with no "It landed" line. Every expected key is worked out from the
 * engine's view (viewKeys). No console errors.
 */
async function partR(browser, W, H) {
  const T = CONTENT.tutorial;
  // keys: the view's own key chips (D142 (4): G3's key is the first bar spell castable now; the Mage's Pre-cast is "Q then N")
  const fill = (raw, n = {}, keys = {}) => raw.replace(/\{(\w+)\}/g, (m, k) => ({ key_spell1: '1', key_engage1: 'Q', key_engage2: 'W', key_engage3: 'E', key_pass: 'X', key_item1: '8', key_take_all: 'Space', key_bags: 'B', key_talents: 'N', key_spellbook: 'P', key_autoplay: 'Z', key_flee: 'F', ...keys }[k]
    ?? { deathblowTurn: R.C.SIGNATURE_TURN, bellTolls: R.C.BELL_CHANNEL_TIME, offbalPct: Math.round(R.C.OFFBAL_TAKEN * 100), rescueTolls: R.C.ONB_RESCUE_TOLLS, satchelPotions: R.C.META.satchel.potions, ...n }[k] ?? m));
  const lineText = (id, cls, keys = {}) => { const [b, k] = id.split('.'); const x = T.beats.find((y) => y.id === b); return fill(!k ? x.line || x.byClass[cls] : (x.alt && x.alt[k]) || x.byClass[k], {}, keys); };
  /**
   * The view's keys, worked out here from the engine's view (D142 (4)): key_spell1 = the bar slot of the first spell the
   * view says can be cast now (one cast on an enemy first, R.C.SPELL target); key_engage1 = "Q then N" when the first
   * engage option takes a spell (Pre-cast), N the bar key of the first of its spells on the bar.
   */
  const viewKeys = (page) => page.evaluate((tgt) => {
    const v = window.__ui.view(); const out = {}; const p = v.player; const c = v.combat;
    if (!p || !c || c.over) return out;
    const L = (v.legal && v.legal.spells) || {}; const ok = (id) => !!(id && L[id] && L[id].ok);
    let i = p.bar.findIndex((id) => ok(id) && tgt[id] === 'enemy'); if (i < 0) i = p.bar.findIndex(ok);
    if (i >= 0) out.key_spell1 = String(i + 1);
    const o = c.engage && c.engage.options[0];
    if (o && o.spells && o.spells.length && !o.reason) { const j = p.bar.findIndex((id) => id && o.spells.some((x) => x.spellId === id)); if (j >= 0) out.key_engage1 = `Q then ${j + 1}`; }
    return out;
  }, Object.fromEntries(Object.values(R.C.SPELL).map((s) => [s.id, s.target])));
  const coach = (page) => page.evaluate(() => window.__ui.coach());
  /** The coach line's rect against the protected elements and its anchor (spec 2.5): the names it overlaps. */
  const overlaps = (page) => page.evaluate(() => {
    const c = document.getElementById('coach'); if (!c || c.classList.contains('hidden')) return [];
    const r = c.getBoundingClientRect(); const out = [];
    const sel = { bar: '#actionbar', engage: '#engage .eg-opt, #engage button', furnace: '#heat', target: '#target-frame', setOut: '#pp-go', anchor: '.coach-on', marker: '.coach-also' };
    for (const [k, q] of Object.entries(sel)) for (const x of document.querySelectorAll(q)) { const b = x.getBoundingClientRect(); if (b.width && b.height && !x.closest('.hidden') && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom)) out.push(k); }
    return [...new Set(out)];
  });
  // ---- (1) the guided run to zone 2
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      const tg = page.locator('#create .toggle.guide');
      check('M3-R', 'class select: "Guided first run" shown and on for a new profile', (await tg.isVisible()) && (await tg.getAttribute('aria-checked')) === 'true', await tg.getAttribute('aria-checked'));
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      let c = await coach(page);
      await shot(page, 'R-prep');
      // D152 (changes-m3-v2.md 1.2): a first run's camp has no board, G1 closes at START_RUN: no coach line there, no H23
      check('M3-R', 'the start camp of a first run (D152): no coach line (no G1, no H23: no board)', !c.shown && !c.log.some((x) => x.id === 'G1' || x.id === 'H23'), JSON.stringify(c.shown));
      const engineLines = []; const bad = []; const shownSoFar = new Set(); const layout = []; let gate = null; let gateOpen = null; let reachedZ2 = false; let steps = 0; let bounty = null;
      // the order the coach line should show them: each step's line by the UI's rule (the engine's top line, tutorialView
      // `line`, when it can show; else the first open line that can), first appearances (D150: G14-G17 take priority over G10)
      const engineOrder = [];
      let shownSig = null; let shownKeys = {};
      // D147: the engine's beat events by step (with the next script, the player's node and Gorrak's), and G8's joint line
      // as it first showed (S3's engage round): its ring, second marker and arrow, and the hints' store at that moment
      const beatEv = []; let joint = null; const jointLate = []; // D149 / engine-2026-11-14b finding 1: the joint line only in round 1
      for (; steps < 260; steps++) {
        const st = await page.evaluate(() => { const v = window.__ui.view(); const tp = document.querySelector('#turnprompt:not(.hidden) .tp-t'); return { phase: v.phase, z: v.zone ? v.zone.idx : null, t: v.tutorial, cls: v.player ? v.player.classId : 'rogue', fight: !!(v.combat && !v.combat.over && !v.loot), map: v.phase === 'MAP' && !!(v.zone && v.zone.exp) && !v.node, contract: !!(v.loot && v.loot.kind === 'contract'), tab: !!tp && /\bTab\b/.test(tp.textContent) }; });
        const t = st.t;
        // D152 (changes-m3-v2.md 1.4): Gorrak's bounty on a first run, its own window after his fight's spoils
        if (!bounty) bounty = await page.evaluate(() => { const v = window.__ui.view(); if (!(v.loot && v.loot.kind === 'bounty')) return null; const d = document.querySelector('.dialog.bounty-reward');
          return { L: { xp: v.loot.xp, gold: v.loot.gold, text: v.loot.text, choices: v.loot.choices.length }, title: d ? d.querySelector('.wtitle .title').textContent : null, text: d ? d.innerText : '', cards: d ? d.querySelectorAll('.choice-cards .icard').length : 0 }; });
        // a fight's beat line waits while the quest's intro dialog is up (no fight on screen yet); a map line waits for the
        // map on screen (QA playtest 2026-11-13); a resting line (D141) waits for its trigger
        const FIGHT = ['G3', 'G6', 'G7', 'G8', 'G9', 'G11', 'G14', 'G15', 'G16', 'G17']; // D150: G14-G17 (engine-2026-11-14d section 7)
        const MAPL = [...MAP_LINES]; // D143: G2 and G13.closed too (onboarding.js)
        // D150 (engine-2026-11-14d UI need 5): "Contract done" waits for the contract's own window
        const open = t && !t.skipped && !t.ended ? (t.open || []).filter((o) => o.line && !o.rest && (st.fight || !FIGHT.includes(o.id)) && (st.map || !MAPL.includes(o.line)) && (o.line !== 'G10.done' || st.contract) && (o.id !== 'G17' || !st.tab)).map((o) => o.line) : [];
        for (const l of open) if (!engineLines.includes(l)) engineLines.push(l);
        const expLine = open.includes(t && t.line) ? t.line : open[0];
        if (expLine && !engineOrder.includes(expLine)) engineOrder.push(expLine);
        c = await coach(page);
        // the coach line shows one of the engine's open beat lines (tutorialView.line, or the next once the engine rests it, D141), its content text
        for (const x of c.log) if (x.kind === 'beat') shownSoFar.add(x.id);
        const fresh = open.filter((l) => !shownSoFar.has(l));
        // the view's keys when the line came up (its text stays while it is up: after G3's "Press 2" a combo point makes slot 1
        // castable, and the line keeps its key)
        const last = c.log[c.log.length - 1];
        const sig = c.shown && last ? `${c.shown.id}@${last.step}@${last.at}` : null;
        if (sig !== shownSig) { shownSig = sig; shownKeys = c.shown && c.shown.kind === 'beat' ? await viewKeys(page) : {}; }
        // a line already shown may rest (D141, the engine); an open line not yet shown must be on screen now (or one with it)
        // newcomer check 2026-11-15: the guided "Take a Road" line (G12.road) ends with the nearest Road's numbers
        if ((fresh.length || (c.shown && c.shown.kind === 'beat')) && !(c.shown && c.shown.kind === 'beat' && open.includes(c.shown.id) && (c.shown.text === lineText(c.shown.id, st.cls, shownKeys) || (c.shown.id === 'G12.road' && /^Nearest: \d+ hops?, \d+ tolls?\.$/.test(c.shown.text.slice(lineText(c.shown.id, st.cls, shownKeys).length + 1)) && c.shown.text.startsWith(lineText(c.shown.id, st.cls, shownKeys)))))) bad.push(`step ${steps}: engine ${open.join('/')}, coach ${c.shown ? `${c.shown.id} "${c.shown.text}"` : 'none'}`);
        if (c.shown) { const o = await overlaps(page); if (o.length) layout.push(`${c.shown.id}: ${o.join(',')}`); }
        if (c.shown && c.shown.id === 'G3' && !(await page.evaluate(() => window.__shotG3))) { await page.evaluate(() => { window.__shotG3 = true; }); await shot(page, 'R-coach-fight'); }
        if (st.fight && c.shown && c.shown.id === 'G8.withEngage') jointLate.push(`step ${steps}: the joint line on the route`);
        // D150 (engine-2026-11-14d): G7 is learned in fight 1, so S3 opens G8 on its own line: its ring on the wind-up badge
        if (!joint && st.fight && c.shown && c.shown.id === 'G8') {
          await page.mouse.move(2, 2);
          joint = await page.evaluate(() => {
            const v = window.__ui.view(); const on = document.querySelector('.coach-on'); const also = document.querySelector('.coach-also'); const a = document.querySelector('#coach .co-arrow');
            const wu = v.combat.enemies.find((e) => e.alive && (e.track || []).some((x) => x.windup && !x.deathblow));
            const np = also ? also.closest('#nameplates .np') : null;
            const onNp = on ? on.closest('#nameplates .np') : null;
            return { round: v.combat.round, enemies: v.combat.enemies.map((e) => e.name), windup: wu ? wu.idx : null, opts: v.combat.engage ? v.combat.engage.options.map((o) => `${o.key}:${o.id}`) : null,
              ring: on && on.matches('#engage .eg-opt') ? { key: on.dataset.key || null, opt: on.dataset.opt || null } : null,
              on: on ? { badge: on.matches('#nameplates .wub:not(.db)') && !on.classList.contains('hidden'), idx: onNp ? Number(onNp.dataset.idx) : null, text: on.textContent } : null,
              marker: also ? { badge: also.matches('#nameplates .wub:not(.db)'), text: also.textContent } : null,
              arrow: a ? a.className : null, text: window.__ui.coach().shown.text, store: window.__ui.coach().store };
          });
          await shot(page, 'R-g8-line');
        }
        // Gorrak's gate (D138; D143: after S3): his node barred while its script is still to come; the map tooltip says how many fights are left
        if (t && t.elite && st.phase === 'MAP' && gate === null && t.elite.barred) {
          const el = page.locator(`#screens .mnode[data-node="${t.elite.node}"]`);
          if (await el.count()) {
            await el.hover({ force: true }); await page.waitForTimeout(150);
            const tipText = (await page.locator('.tooltip.on').innerText().catch(() => '')).replace(NBSP, ' ');
            gate = { left: t.elite.left, cls: await el.getAttribute('class'), tip: tipText };
            await page.mouse.move(2, 2);
          }
        }
        if (t && t.elite && gate && !t.elite.barred && gateOpen === null && st.phase === 'MAP') gateOpen = { script: t.script, barred: await page.locator(`#screens .mnode[data-node="${t.elite.node}"].barred`).count() };
        if (st.z !== null && st.z >= 1 && st.phase !== 'PREP' && t && t.ended) { reachedZ2 = true; break; }
        const evs = await page.evaluate(async () => { const r = await window.__ui.act({ type: 'AUTO' }); return r && r.events ? r.events.filter((e) => e.t === 'beat').map((e) => ({ id: e.id, what: e.what, line: e.line })) : []; });
        await idle(page);
        if (evs.length) {
          const at = await page.evaluate(() => { const v = window.__ui.view(); const x = v.tutorial; return { next: x ? x.next : null, pos: v.zone && v.zone.exp ? v.zone.exp.pos : null, elite: x && x.elite ? x.elite.node : null }; });
          for (const e of evs) beatEv.push({ step: steps, ...e, ...at });
        }
      }
      c = await coach(page);
      const shownBeats = c.log.filter((x) => x.kind === 'beat').map((x) => x.id);
      const seq = shownBeats.filter((x, i) => shownBeats[i - 1] !== x);
      const firstShown = [...new Set(seq)];
      const missing = engineLines.filter((l) => !firstShown.includes(l));
      const order = engineOrder.filter((l) => firstShown.includes(l)).join('>') === firstShown.filter((l) => engineOrder.includes(l)).join('>');
      check('M3-R', `every beat line the engine opened showed on the coach line, in the engine's order (top line first; ${engineOrder.join(' > ')})`, reachedZ2 && !missing.length && order && !bad.length, `steps ${steps}, shown ${seq.join(' > ')}${missing.length ? ` | never shown: ${missing}` : ''}${bad.length ? ` | ${bad.slice(0, 4).join(' | ')}` : ''}`);
      const ids = new Set(engineLines.map((x) => x.split('.')[0]));
      const cls = await page.evaluate(() => (window.__ui.view().player || {}).classId || 'rogue');
      // D150 (engine-2026-11-14d section 2, the route): G5 at the hub, G2, G7 in fight 1 (learned there), G12 once and later
      // G12.road, G4 at S1's spoils, G6 in S2, G8 on its own line in S3, G13; G3 and G9 have no line. D152 (a lean first run):
      // no G1 (no board) and no G10 (no contract); G13 on the Road reads G13.onRoadFirst (no Bell in zone 1)
      check('M3-R', 'G2, G4-G8, G12 (and G12.road) and G13 (G13.onRoadFirst) among them; no line for G1, G3, G9 or G10 (D152: no contracts on a first run), G8 on its own line (D150)',
        ['G2', 'G4', 'G5', 'G6', 'G7', 'G8', 'G12', 'G13'].every((x) => ids.has(x)) && !ids.has('G1') && !ids.has('G10') && !ids.has('G3') && !ids.has('G9') && !engineLines.includes('G8.withEngage') && engineLines.includes('G12.road') && engineLines.includes('G13.onRoadFirst') && !engineLines.includes('G13.onRoad'),
        `${[...ids].join(',')} | ${engineLines.join(' > ')}`);
      // the engine's bounty event (a Node replay of the page's engine actions) against the window
      // D153 (engine-2026-11-17 UI needs 3, 4): the victory's event (xp 0 with bountyRoad on) and the road's (road: true, at zone 2's hub)
      let bEv = null; let rEv = null; { let s1 = R.newRun({ classId: 'rogue', seed: 8736, content: CONTENT, mapMode: 'expedition', prep: true, tutorial: true, profile: R.newProfile() });
        for (const a of await page.evaluate(() => window.__ui.engineLog())) { const r = R.step(s1, a); s1 = r.state; for (const e of r.events.filter((x) => x.t === 'bounty')) { if (e.road) rEv = e; else bEv = e; } } }
      const roadWant = rEv ? T.guide.bountyRoadLine.replace('{xp}', String(rEv.xp)) : null;
      const allLog = await logLines(page).catch(() => []);
      check('D153-bounty', `the bounty's road share at zone 2's hub (event road: true): the log says "${roadWant}"; the victory window shows no "+0 XP"`,
        !!rEv && rEv.xp > 0 && allLog.includes(roadWant) && !!bounty && !/\+0 XP/.test(bounty.text), JSON.stringify({ rEv, roadWant, last: allLog.slice(-6), bountyText: bounty && bounty.text.slice(0, 200) }));
      check('D152-bounty', `Gorrak's bounty on a first run: its window "${"Gorrak's bounty"}" with "${T.guide.bountyLine}", +XP and gold = the engine's bounty event${bEv ? ` (${bEv.xp} XP, ${bEv.gold} c)` : ''}, ${R.C.CONTRACT_REWARD_CHOICES} items to choose from`,
        !!bounty && !!bEv && bounty.title === "Gorrak's bounty" && bounty.text.includes(T.guide.bountyLine) && bounty.L.xp === bEv.xp && bounty.L.gold === bEv.gold && bounty.cards === R.C.CONTRACT_REWARD_CHOICES, JSON.stringify({ bounty: bounty && { ...bounty, text: bounty.text.slice(0, 160) }, bEv }));
      const evOf = (id, what) => beatEv.find((e) => e.id === id && e.what === what) || null;
      const o7 = evOf('G7', 'open'); const o8 = evOf('G8', 'open'); const o9 = evOf('G9', 'open');
      const end7 = beatEv.find((e) => e.id === 'G7' && (e.what === 'done' || e.what === 'missed')) || null;
      const own7InS3 = beatEv.filter((e) => e.id === 'G7' && e.what === 'line' && e.line && e.next === 's3'); // tutorialView.next stays 's3' until S3 ends
      check('M3-R', 'D150: G7 opens in fight 1 (site 1, before S1) on its own line and is learned there (ENGAGE); G8 opens as S3 starts on its own line; G9 opens later, on Gorrak\'s node, with no line',
        !!o7 && o7.line === 'G7' && o7.next === 's1' && !!end7 && end7.what === 'done' && !!o8 && end7.step < o8.step && o8.next === 's3' && o8.line === 'G8' && !own7InS3.length
        && !!o9 && o9.line == null && o9.step > o8.step && o9.pos != null && o9.pos === o9.elite, JSON.stringify({ o7, o8, own7InS3, end7, o9 }));
      // the joint line on screen (D147, engine-2026-11-14 UI need 2): the class's control option is the engage panel's W
      const ctl = R.C.ENGAGE_OPTIONS[cls][1];
      // D149: S3's wind-up comes on the Hexer's turn ONB_WINDUP_TURN, so the badge the second marker sits on reads that round
      const wuRound = `Wind-up R${R.C.ONB_WINDUP_TURN + 1}`;
      // D150: G8's own line in S3's engage round rings the wind-up badge (ANCHOR.G8); the D147 joint line (G7 still open in the
      // same engage round) is not on the route any more (its case: part R (8)'s note); G8's line counts one showing of H03
      check('D147-2', `G8's own line in S3's engage round (D150: G7 learned in fight 1): "${lineText('G8', cls)}"; its ring on the wind-up badge ("${wuRound}", D149) over the ${ctl} target, the arrow at it`,
        !!joint && joint.round === 1 && joint.text === lineText('G8', cls) && !!joint.ring === false && !!joint.marker === false && !!joint.arrow && !/none/.test(joint.arrow) && !!joint.on && joint.on.badge && joint.on.idx === joint.windup && joint.on.text.startsWith(wuRound),
        JSON.stringify(joint && { ...joint, store: undefined }));
      check('D147-2', 'the joint line (G8.withEngage) never shows on the route (D150: G7 is learned before S3)', !jointLate.length && !c.log.some((x) => x.id === 'G8.withEngage'), jointLate.join(' | ') || 'none');
      check('D147-2', `G8's line counts one showing of the hint it stands in for, H03 (H01:${cls} was G7's, in fight 1)`,
        !!joint && joint.store.shows.H03 === 1, JSON.stringify(joint && { seen: joint.store.seen, shows: joint.store.shows }));
      check('M3-R', 'no coach line overlapped its anchor, the bar, the engage buttons, the Furnace, the target frame or Set out', !layout.length, layout.slice(0, 6).join(' | ') || 'none');
      const gateAt = Number(String(T.elite.gate.afterScript).replace(/\D/g, '')); // D143: 's3'
      check('M3-R', `Gorrak barred until S${gateAt}: the node is marked and its tooltip shows the gate line with the fights still to come`, !!gate && /barred/.test(gate.cls) && gate.tip.includes(fill(T.elite.gate.barredLine, { n: gate.left })), JSON.stringify(gate));
      check('M3-R', `after S${gateAt} the node opens (no bar on the map)`, !!gateOpen && gateOpen.script >= gateAt && gateOpen.barred === 0, JSON.stringify(gateOpen));
      check('M3-R', 'the guide ends on leaving zone 1: the end line as a toast', (await page.locator('#toasts .toast', { hasText: T.guide.endLine }).count()) > 0 || c.log.length > 0, '');
    } catch (e) { await shot(page, 'R-error-1'); check('M3-R', 'part R (guided run) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('M3-R', 'part R (guided run): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2) rescue, (3) skip
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 120; i++) { const v = await view(page); if (v.round >= 2 && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      const ser = await page.evaluate(() => window.__ui.state());
      const s0 = R.deserialize(ser, CONTENT); s0.player.hp = 1;
      const before = { time: s0.time, rescues: s0.tutorial.rescues };
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      let banner = ''; let sub = ''; let v = null;
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('KeyX'); await page.waitForTimeout(60);
        if (!banner) { banner = await page.locator('#banner.on .b1').innerText().catch(() => ''); if (banner) sub = await page.locator('#banner.on .b2').innerText().catch(() => ''); }
        await idle(page);
        v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, hp: x.player.hp, maxHp: x.player.maxHp, time: x.time, rescues: x.tutorial.rescues, rescueMax: x.tutorial.rescueMax, combat: !!x.combat }; });
        if (v.rescues > before.rescues) break;
      }
      const log = await logLines(page);
      const line = fill(T.guide.rescueLine);
      await shot(page, 'R-rescue');
      check('M3-R', `rescue: the banner "${line}", a log line, full health, +${R.C.ONB_RESCUE_TOLLS} tolls or more, back on the map`,
        v && v.rescues === before.rescues + 1 && banner === line && log.includes(line) && v.hp === v.maxHp && v.time >= before.time + R.C.ONB_RESCUE_TOLLS && !v.combat, `${JSON.stringify(v)} banner "${banner}"`);
      // engine-2026-11-14b UI need 4: a rescue that leaves the guide on says how many are left (banner's second line, log)
      const leftLine = v ? fill(T.guide.rescueLeftLine, { rescuesLeft: v.rescueMax - v.rescues }) : '';
      check('M3-R', `rescue ${v && v.rescues} of ${R.C.ONB_RESCUE_MAX}: the banner's second line and the log say "${leftLine}"`,
        !!v && v.rescues < v.rescueMax && sub === leftLine && log.includes(leftLine), `sub "${sub}" log ${JSON.stringify(log.slice(-3))}`);
      // (3) skip from the coach line: one-line confirm, then SKIP_GUIDE
      for (let i = 0; i < 80 && ((await coach(page)).shown || {}).kind !== 'beat'; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      const sh = (await coach(page)).shown;
      await page.locator('#coach .co-skip').click(); await idle(page);
      const ask = await page.locator('#coach .co-t').innerText();
      await page.locator('#coach .co-skip').click(); await idle(page);
      const t = await page.evaluate(() => window.__ui.view().tutorial);
      const sent = (await page.evaluate(() => window.__ui.engineLog())).some((a) => a.type === 'SKIP_GUIDE');
      let after = null;
      for (let i = 0; i < 25; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); const x = (await coach(page)).shown; if (x && x.kind === 'beat') { after = x.id; break; } }
      const skipLog = await logLines(page);
      check('M3-R', `skip: "Skip guide" asks in one line, Skip sends SKIP_GUIDE; the log says "${T.guide.skipLine}" (content); no beat line after`, !!sh && sh.kind === 'beat' && /Skip the guide/.test(ask) && sent && t.skipped && !after && skipLog.includes(T.guide.skipLine), `${JSON.stringify(sh)} ask "${ask}" sent ${sent} skipped ${t.skipped} after ${after} skip line ${skipLog.includes(T.guide.skipLine)}`);
    } catch (e) { await shot(page, 'R-error-2'); check('M3-R', 'part R (rescue, skip) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('M3-R', 'part R (rescue, skip): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2b) D147 (spec 2.6; engine-2026-11-14 UI need 1): the ONB_RESCUE_MAX-th rescue ends the guide. A guided-zone fight
  // loaded with ONB_RESCUE_MAX - 1 rescues behind and 1 HP: the rescue's banner, then content guide.rescueCapLine as a toast
  // and in the log, not the skip line; the guide is off after it (no beat line, the Roads open); a death after it ends the run
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      const max = R.C.ONB_RESCUE_MAX;
      const capLine = T.guide.rescueCapLine;
      const auto = async () => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };
      const toRound2 = async () => { for (let i = 0; i < 120; i++) { const v = await view(page); if (v.round >= 2 && !v.over && v.step === 'combat') return true; await auto(); } return false; };
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await toRound2();
      await page.evaluate(() => { window.__rT = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) window.__rT.push(n.textContent); }).observe(document.querySelector('#toasts'), { childList: true }); });
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); s0.player.hp = 1; s0.tutorial.rescues = max - 1;
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      let banner = ''; let sub = null; let v = null;
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('KeyX'); await page.waitForTimeout(60);
        if (!banner) { banner = await page.locator('#banner.on .b1').innerText().catch(() => ''); if (banner) sub = await page.locator('#banner.on .b2').innerText().catch(() => null); }
        await idle(page);
        v = await page.evaluate(() => { const x = window.__ui.view(); const t = x.tutorial; return { phase: x.phase, hp: x.player.hp, maxHp: x.player.maxHp, combat: !!x.combat, rescues: t.rescues, rescueMax: t.rescueMax, skipped: t.skipped, guidedZone: t.guidedZone, roadsClosed: t.roads.closed }; });
        if (v.rescues >= max) break;
      }
      await page.waitForFunction((t) => window.__rT.some((x) => x.startsWith(t)), capLine, { timeout: 6000, polling: 100 }).catch(() => null);
      const toasts = await page.evaluate(() => window.__rT.slice());
      // the toast on screen: inside the window, clear of the screen's panel (the hub's, where this rescue lands)
      const tbox = await page.evaluate((t) => {
        const el = [...document.querySelectorAll('#toasts .toast')].find((x) => x.textContent.startsWith(t)); if (!el) return null;
        const r = el.getBoundingClientRect();
        const panels = [...document.querySelectorAll('#screens .panel')].filter((p) => !p.closest('.hidden')).map((p) => p.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0);
        return { rect: [r.left, r.top, r.right, r.bottom].map(Math.round), inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, panels: panels.length,
          meets: panels.filter((b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top).length };
      }, capLine);
      const log = await logLines(page);
      await shot(page, 'R-rescue-cap');
      check('D147-1', `rescue ${max} of ${max} (ONB_RESCUE_MAX) ends the guide: the rescue's banner with no rescues-left line, then "${capLine}" as a toast (in the window, clear of the screen's panel) and in the log, not the skip line`,
        !!v && v.rescues === max && v.rescueMax === max && v.skipped && banner === fill(T.guide.rescueLine) && toasts.some((x) => x.startsWith(capLine)) && log.includes(capLine)
        && !log.some((x) => /skip the guide/i.test(x)) && v.hp === v.maxHp && !v.combat && !!tbox && tbox.inside && tbox.meets === 0
        && sub === '' && !log.some((x) => x.startsWith(T.guide.rescueLeftLine.split('{')[0])),
        `${JSON.stringify(v)} banner "${banner}" second line "${sub}" toasts ${JSON.stringify(toasts)} toast box ${JSON.stringify(tbox)} log ${JSON.stringify(log.slice(-4))}`);
      let after = null;
      for (let i = 0; i < 20; i++) { await auto(); const x = (await coach(page)).shown; if (x && x.kind === 'beat') { after = x.id; break; } }
      check('D147-1', 'after it the guide is off as after Skip guide: no beat line on the next steps, the guided zone over, the Roads open', !!v && !after && !v.guidedZone && v.roadsClosed === false, `beat line ${after} ${JSON.stringify(v)}`);
      // the line's promise: from now on a death ends the run (no rescue, no resurrect held)
      await toRound2();
      const s1 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); s1.player.hp = 1; s1.player.res.boon = 0; s1.player.res.meta = 0;
      s1.player.bag = s1.player.bag.filter((x) => !(x.kind === 'cons' && x.id === 'ember_of_return'));
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s1)); await idle(page);
      let banner2 = '';
      for (let i = 0; i < 12 && (await view(page)).phase !== 'SUMMARY'; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(60); banner2 = banner2 || await page.locator('#banner.on .b1').innerText().catch(() => ''); await idle(page); }
      const end = await view(page);
      check('D147-1', 'as the line says, a death after it ends the run: the summary (death), no rescue banner', end.phase === 'SUMMARY' && end.outcome === 'death' && banner2 !== fill(T.guide.rescueLine), `${end.phase} ${end.outcome} banner "${banner2}"`);
    } catch (e) { await shot(page, 'R-error-2b'); check('D147-1', 'part R (2b, rescue cap) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('D147-1', 'part R (2b, rescue cap): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2c) ui-2026-11-14 finding 2: the toast stack keeps clear of the hub's panel (app.js placeToasts, TOAST_KEEP), not
  // only of the banner and windows: toasts of every length, with the zone's banner up and after it, never meet the panel
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&classic=1');
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const lens = [40, 84, 120, 200];
      const seen = [];
      for (const banner of [true, false]) {
        for (const n of lens) {
          const txt = `Toast ${n}: ${'a long line of words '.repeat(12)}`.slice(0, n);
          const box = await page.evaluate(async ([t, keepBanner]) => {
            for (const x of [...document.querySelectorAll('#toasts .toast')]) x.remove();
            if (!keepBanner) document.querySelector('#banner').classList.remove('on');
            window.__ui.toast(t, 'info');
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const el = [...document.querySelectorAll('#toasts .toast')].find((x) => x.textContent.startsWith(t.slice(0, 12))); if (!el) return null;
            const r = el.getBoundingClientRect();
            const panels = [...document.querySelectorAll('#screens .panel')].filter((p) => !p.closest('.hidden')).map((p) => p.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0);
            const bn = document.querySelector('#banner.on'); const b = bn ? bn.getBoundingClientRect() : null;
            return { phase: window.__ui.view().phase, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), panels: panels.length, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
              meets: panels.filter((q) => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top).length,
              onBanner: !!b && b.width > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top };
          }, [txt, banner]);
          seen.push({ n, banner, ...box });
        }
        if (banner) await shot(page, 'R-toast-hub');
      }
      check('UI-F2', `on the hub, toasts of ${lens.join(', ')} characters, with the banner up and after it: inside the window, clear of the hub's panel and the banner`,
        seen.every((x) => x.phase === 'ZONE_HUB' && x.panels >= 1 && x.inside && x.meets === 0 && !x.onBanner), JSON.stringify(seen.filter((x) => !(x.inside && x.meets === 0 && !x.onBanner)).concat(seen.slice(0, 1))));
    } catch (e) { await shot(page, 'R-error-2c'); check('UI-F2', 'part R (2c, toasts on the hub) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('UI-F2', 'part R (2c, toasts on the hub): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (4) hints once, Hints off; (5) the nudge after the first summary
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=21&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.locator('#create .toggle.guide').click(); await idle(page);
      const off = await page.locator('#create .toggle.guide').getAttribute('aria-checked');
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const prof = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), PROFILE_KEY));
      const t0 = await page.evaluate(() => window.__ui.view().tutorial);
      const sh = (await coach(page)).shown;
      // D152 (changes-m3-v2.md 1.2): a first run with the guide off is still a first run: no board, so no H23 at its camp
      check('M3-R', 'toggle off: a normal run (no tutorial), the profile\'s guide "skipped"; no H23 at a first run\'s camp (D152: no board)', off === 'false' && !t0 && prof.guide === 'skipped' && !(sh && sh.id === 'H23'), `${off} ${JSON.stringify(t0)} ${prof.guide} ${JSON.stringify(sh)}`);
      if (sh) { await page.locator('#coach .co-ok').click(); await idle(page); }
      // Hints off from Settings: no line on the next steps
      await page.keyboard.press('Escape'); await page.locator('#win-settings .hintseg button', { hasText: 'Off' }).click(); await page.keyboard.press('Escape'); await idle(page);
      let any = null;
      for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); const x = (await coach(page)).shown; if (x) { any = x.id; break; } }
      const st = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), HINTS_KEY));
      check('M3-R', 'Hints Off (Settings) silences every hint (stored off)', !any && st.off === true, `${any} ${JSON.stringify(st)}`);
      await page.evaluate((k) => { const x = JSON.parse(localStorage.getItem(k)); x.off = false; localStorage.setItem(k, JSON.stringify(x)); }, HINTS_KEY);
      // (5) a death in a fight of the normal run: the first summary with the welcome
      await page.goto(`${URL}?seed=21&speed=instant&fresh=1`); await page.waitForFunction(() => window.__ui);
      check('M3-R', 'a second visit: no "Guided first run" (guide skipped)', !(await page.locator('#create .toggle.guide').isVisible()), '');
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const again = (await coach(page)).shown;
      check('M3-R', 'H23 shows once: not at the camp of the next run', !again || again.id !== 'H23', JSON.stringify(again));
      for (let i = 0; i < 120; i++) { const v = await view(page); if (v.round >= 2 && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); s0.player.hp = 1; s0.player.res.boon = 0; s0.player.res.meta = 0;
      s0.player.bag = s0.player.bag.filter((x) => !(x.kind === 'cons' && x.id === 'ember_of_return'));
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      for (let i = 0; i < 12 && (await view(page)).phase !== 'SUMMARY'; i++) { await page.keyboard.press('KeyX'); await idle(page); }
      const sum = await page.evaluate(() => ({ phase: window.__ui.view().phase, welcome: [...document.querySelectorAll('.echo.welcome')].map((e) => e.textContent), glow: !!document.querySelector('.sfoot .btn.glow'), line: (document.querySelector('.sfoot .nudgeline') || {}).textContent || '' }));
      check('M3-R', `the first summary: "${T.nudge.welcomeLabel}" +${R.C.ONB_WELCOME_ECHOES}, Spend Echoes glows with "${T.nudge.summaryLine}"`,
        sum.phase === 'SUMMARY' && sum.welcome.length === 1 && sum.welcome[0].includes(T.nudge.welcomeLabel) && sum.welcome[0].includes(`+${R.C.ONB_WELCOME_ECHOES}`) && sum.glow && sum.line === T.nudge.summaryLine, JSON.stringify(sum));
      await page.getByRole('button', { name: 'Spend Echoes' }).click(); await idle(page); await page.waitForTimeout(200);
      const hall = await page.evaluate(() => ({ nudge: !!document.querySelector('#meta .mcard.nudge[data-id="satchel"]'), coach: window.__ui.coach().shown, later: (document.querySelector('#coach .co-ok') || {}).textContent }));
      const ov = await overlaps(page);
      await shot(page, 'R-nudge');
      check('M3-R', 'the Hall: Packed Satchel highlighted, its coach line (content, potions from C) with "Later", the card not covered', hall.nudge && hall.coach && hall.coach.kind === 'nudge' && hall.coach.text === fill(T.nudge.hallLine) && hall.later === T.nudge.later && !ov.length, `${JSON.stringify(hall)} overlaps ${ov}`);
      await page.locator('#coach .co-ok').click(); await idle(page);
      const st2 = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), HINTS_KEY));
      check('M3-R', '"Later" closes it for good (stored), the card stays buyable', !(await page.locator('#meta .mcard.nudge').count()) && st2.nudge.hall === true && (await page.locator('#meta .mcard[data-id="satchel"] button.buy').isEnabled()), JSON.stringify(st2.nudge));
    } catch (e) { await shot(page, 'R-error-3'); check('M3-R', 'part R (hints, nudge) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('M3-R', 'part R (hints, nudge): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (6) D142 (playtest-2026-11-13 findings 2-5): the Rogue's first guided fight (G3's key, the turn prompt, a refused key)
  const tp = (page) => page.evaluate(() => { const t = document.getElementById('turnprompt'); const c = document.getElementById('coach'); return { kind: t.dataset.kind, shown: getComputedStyle(t).display !== 'none' && !t.classList.contains('hidden'), text: t.textContent, coach: !!c && !c.classList.contains('hidden') }; });
  const chips = (page) => page.locator('#coach .co-t .kbd').evaluateAll((els) => els.map((e) => e.textContent));
  /** "Got it" until no coach line is up (a queued hint may follow the one put away); true when none is left. */
  const clearCoach = async (page) => { for (let i = 0; i < 6; i++) { if (!(await coach(page)).shown) return true; await page.locator('#coach .co-ok').click(); await idle(page); } return !(await coach(page)).shown; };
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      let c = null;
      // D150 item 11 (engine-2026-11-14d): fight 1 shows G7's line ("Round 1 is yours ... Open with Q, W or E."); G3 has none
      for (let i = 0; i < 160; i++) { c = await coach(page); const v = await view(page); if (v.step === 'combat' && v.round === 1 && c.shown && c.shown.id === 'G7') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      await page.mouse.move(2, 2);
      const fv = await page.evaluate(() => { const v = window.__ui.view(); return { round: v.combat && v.combat.round, bar: v.player.bar, legal: Object.fromEntries(Object.entries(v.legal.spells).map(([id, x]) => [id, { ok: x.ok, reason: x.reason || null }])) }; });
      const vk = await viewKeys(page); const key = vk.key_spell1;
      const ring = await page.evaluate(() => { const r = document.querySelector('.coach-on'); return r ? `${r.id || r.className.split(' ')[0]}:${r.dataset.slot ?? ''}` : null; });
      const k1 = await chips(page);
      await shot(page, 'R-d142-rogue-g7');
      check('D142-4b', 'the Rogue\'s first guided fight (D150 item 11): G7\'s line, not G3\'s ("Press 1 to attack" contradicted the engage panel), key chips Q, W, E, its ring on the engage panel',
        c.shown && c.shown.id === 'G7' && c.shown.text === lineText('G7', 'rogue', vk) && k1.join(',') === 'Q,W,E' && ring === 'engage:' && !c.log.some((x) => x.id === 'G3'),
        `${JSON.stringify(c.shown)} chips ${k1} ring ${ring}`);
      const p1 = await tp(page);
      check('D142-2', 'while the coach line is up, the turn prompt\'s "Opening move" line is hidden (no second instruction)', p1.coach && p1.kind === 'engage' && !p1.shown, JSON.stringify(p1));
      // a key that is refused (the finisher: no combo point in round 1) answers at once with the engine's reason, by the spell's
      // name, even with two notes on screen (QA: the refusal waited behind two toasts and the key seemed to do nothing)
      const badSlot = fv.bar.findIndex((id) => id && !fv.legal[id].ok);
      await page.evaluate(() => { window.__ui.toast('Test note one', 'info'); window.__ui.toast('Test note two', 'good'); });
      let refused = null;
      if (badSlot >= 0) {
        await page.keyboard.press(`Digit${badSlot + 1}`); await page.waitForTimeout(150);
        refused = await page.evaluate(() => ({ toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent), round: window.__ui.view().combat.round }));
      }
      const why = badSlot >= 0 ? fv.legal[fv.bar[badSlot]].reason : '';
      check('D142-4b', `a refused key (${badSlot + 1}: ${fv.bar[badSlot]}) shows its reason at once, by the spell's name ("${why}"), in place of a note; the round does not move`,
        badSlot >= 0 && refused.toasts.length <= 2 && refused.toasts.includes(why) && !/_/.test(why) && why.includes(R.C.SPELL[fv.bar[badSlot]].name) && refused.round === 1, JSON.stringify(refused));
      const cleared = await clearCoach(page);
      const p2 = await tp(page);
      // D150 item 3: the engage round's choice is the engage panel's ("Free first move. They act from round 2."): the prompt
      // stays out of the engage round with no coach line up too, and the panel's head is back
      const head2 = await page.evaluate(() => { const e = document.querySelector('#engage .eg-h'); return e && getComputedStyle(e).display !== 'none' ? e.textContent : null; });
      check('D142-2', 'with no coach line up: no turn prompt line in the engage round (D150 item 3), and the engage panel says "Free first move. They act from round 2."', cleared && p2.kind === 'engage' && !p2.shown && head2 === 'Free first move. They act from round 2.', JSON.stringify({ p2, head2 }));
      await page.keyboard.press('KeyQ'); await idle(page);
      const after = await page.evaluate(() => { const v = window.__ui.view(); const log = window.__ui.engineLog(); return { round: v.combat ? v.combat.round : null, over: v.combat ? v.combat.over : null, last: log[log.length - 1] }; });
      const strike = R.C.ENGAGE_OPTIONS.rogue[0];
      check('D142-4b', `the first key G7 names (Q) plays the engage round: ENGAGE ${strike}`, after.last && after.last.type === 'ENGAGE' && after.last.option === strike && (after.round > 1 || !!after.over), JSON.stringify(after));
    } catch (e) { await shot(page, 'R-error-6'); check('D142', 'part R (6, Rogue) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('D142', 'part R (6, Rogue): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (7) D142: the Mage's first engage round in a normal run (H01 names Q then the spell key), then a hint is seen after
  // two showings: the run played on to its fifth fight won, no hint shows a third time
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, { hints: true });
    try {
      await page.locator('#create .ccard[data-cls="mage"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 160; i++) { const v = await view(page); if (v.step === 'combat' && v.round === 1) break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      // a higher-priority hint of the same round (a wind-up's H03) comes first; H01 shows when it is put away
      for (let i = 0; i < 3; i++) { const x = (await coach(page)).shown; if (!x || x.id === 'H01' || x.kind !== 'hint') break; await page.locator('#coach .co-ok').click(); await idle(page); }
      await page.mouse.move(2, 2);
      const sh = (await coach(page)).shown;
      const vk = await viewKeys(page); const n = (vk.key_engage1 || '').replace('Q then ', '');
      const k = await chips(page);
      const p1 = await tp(page);
      await shot(page, 'R-d142-mage-h01');
      check('D142-4a', `the Mage's first engage round: H01 names Q, then the Pre-cast spell's key ("Open with Q then ${n}, W or E"), key chips Q, ${n}, W, E`,
        sh && sh.id === 'H01' && !!n && sh.text === fill(T.hints.find((x) => x.id === 'H01').line, {}, vk) && k.join(',') === `Q,${n},W,E`, `${JSON.stringify(sh)} chips ${k} keys ${JSON.stringify(vk)}`);
      check('D142-2', 'the Mage\'s H01 on screen: the turn prompt\'s "Opening move" line is hidden', p1.coach && p1.kind === 'engage' && !p1.shown, JSON.stringify(p1));
      const spell = await page.evaluate((i) => window.__ui.view().player.bar[i], Number(n) - 1);
      await page.keyboard.press('KeyQ'); await idle(page);
      await page.keyboard.press(`Digit${n}`); await idle(page);
      const after = await page.evaluate(() => { const v = window.__ui.view(); const log = window.__ui.engineLog(); return { round: v.combat ? v.combat.round : null, last: log[log.length - 1] }; });
      check('D142-4a', `Q then ${n} pre-casts ${spell} (ENGAGE precast) and the round moves on`, after.last && after.last.type === 'ENGAGE' && after.last.option === 'precast' && after.last.spellId === spell && after.round === 2, JSON.stringify(after));
      // (3) the run on AUTO to its fifth fight won (the hints come and go at Instant speed, most under ONB_HINT_MIN_MS)
      let won = 0;
      for (let i = 0; i < 400 && won < 5; i++) {
        const r0 = await page.evaluate(async () => { const r = await window.__ui.act({ type: 'AUTO' }); return r && r.events ? r.events.map((e) => e.t) : []; });
        if (r0.includes('victory')) won += 1;
        await idle(page);
        if ((await view(page)).phase === 'SUMMARY') break;
      }
      const co = await coach(page);
      const shows = {};
      co.log.forEach((x, i) => { if (x.kind !== 'hint') return; (shows[x.key] = shows[x.key] || []).push(co.log[i + 1] ? co.log[i + 1].at - x.at : null); });
      const twice = Object.entries(shows).filter(([, a]) => a.length >= 2);
      const over = Object.entries(shows).filter(([, a]) => a.length > ONB_HINT_SHOWS);
      const notSeen = twice.filter(([key]) => !(co.store.seen[key] === true && co.store.shows[key] === ONB_HINT_SHOWS));
      check('D142-3', `a hint counts as seen after two showings: after ${won} fights won no hint showed a third time; each one shown twice is stored seen with 2 showings (${twice.map(([key, a]) => `${key} ${a.map((ms) => (ms == null ? '?' : `<${ms} ms`)).join('/')}`).join(', ') || 'none'})`,
        won >= 3 && twice.length >= 1 && !over.length && !notSeen.length, `over ${JSON.stringify(over)} not seen ${JSON.stringify(notSeen)} store ${JSON.stringify(co.store.shows)}`);
    } catch (e) { await shot(page, 'R-error-7'); check('D142', 'part R (7, Mage, hints) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('D142', 'part R (7, Mage, hints): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (8) D147 (spec 2.8 item 2; engine-2026-11-14 UI need 2), D150: a Rogue's S3 engage round on the guided route, G8
  // on its own line (G7 was learned in fight 1). "Got it" on it marks H03 seen; following it, W (Sap) on the Hexer and then
  // autoplay, G8 is learned (its wind-up stopped), with no "It landed" line; since D149 (the wind-up on the Hexer's turn 1)
  // in the W step itself. (The Rogue's autoplay alone opens with Ambush and kills the Hexer first.)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      const auto = async () => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      let c = null;
      // D150: S3 opens G8 on its own line (G7 was learned in fight 1)
      for (let i = 0; i < 160; i++) { c = await coach(page); const v = await view(page); if (v.step === 'combat' && v.round === 1 && c.shown && c.shown.id === 'G8') break; await auto(); }
      const before = c.store;
      await page.mouse.move(2, 2);
      await page.locator('#coach .co-ok').click(); await idle(page);
      const st1 = (await coach(page)).store;
      check('D147-2', 'Got it on G8\'s own line marks the hint it stands in for seen: H03 (one showing, not seen, before)',
        !!c.shown && c.shown.id === 'G8' && before.shows.H03 === 1 && !before.seen.H03 && st1.seen.H03 === true,
        `${JSON.stringify(c.shown)} before ${JSON.stringify({ seen: before.seen, shows: before.shows })} after ${JSON.stringify(st1.seen)}`);
      // follow the line: the enemy whose track shows the wind-up (the Hexer), targeted on its nameplate, then W
      const hex = await page.evaluate(() => { const e = window.__ui.view().combat.enemies.find((x) => x.alive && (x.track || []).some((y) => y.windup && !y.deathblow)); return e ? { idx: e.idx, name: e.name } : null; });
      await page.locator(`#nameplates .np[data-idx="${hex.idx}"]`).click(); await idle(page);
      await page.keyboard.press('KeyW'); await idle(page);
      const sent = await page.evaluate(() => { const l = window.__ui.engineLog(); return l[l.length - 1]; });
      // D149: the wind-up comes on the Hexer's turn 1, so W answers it in the same step: staggered, G8 learned, before any autoplay
      const wStep = await page.evaluate(() => { const v = window.__ui.view(); return { round: v.combat ? v.combat.round : null, learned: v.tutorial.learned, n: window.__ui.engineLog().length }; });
      const wLog = await logLines(page);
      for (let i = 0; i < 40; i++) { const v = await view(page); if (v.step !== 'combat' || v.over) break; await auto(); }
      const t = await page.evaluate(() => window.__ui.view().tutorial);
      const co = await coach(page);
      const log = await logLines(page);
      const ctl = R.C.ENGAGE_OPTIONS.rogue[1];
      await shot(page, 'R-g8-followed');
      check('D147-2', `following G8's line: W sends ENGAGE ${ctl} on the ${hex && hex.name}; G7 (fight 1) and G8 are then learned (its wind-up stopped, staggered), no "It landed" line`,
        !!sent && sent.type === 'ENGAGE' && sent.option === ctl && sent.target === hex.idx && t.learned.includes('G7') && t.learned.includes('G8') && !co.log.some((x) => x.id === 'G8.landed')
        && log.some((x) => /^Wind-up stopped/.test(x)), `${JSON.stringify(sent)} learned ${t.learned} lines ${co.log.filter((x) => x.kind === 'beat').map((x) => x.id).join(',')}`);
      check('D147-2', 'D149: W answers the wind-up in its own step: the stagger in the log and G7 and G8 learned before the next action',
        !!sent && wStep.learned.includes('G7') && wStep.learned.includes('G8') && wLog.some((x) => /^Wind-up stopped/.test(x)), `${JSON.stringify(wStep)} log ${JSON.stringify(wLog.slice(-4))}`);
    } catch (e) { await shot(page, 'R-error-8'); check('D147-2', 'part R (8, G8\'s line followed) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('D147-2', 'part R (8, G8\'s line followed): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part S: D143 and the blind tester panel (UI side)
/**
 * Part S (M3 3.7): the D143 UI to-dos (docs/handoffs/engine-2026-11-13c.md section 2) and the findings of the blind tester
 * panel of 2026-11-13 (docs/feedback/2026-11-13-blind-casual.md, 2026-11-13-blind-tactician.md), items 1-10 of
 * docs/handoffs/ui-2026-11-13d.md. Real engine; every check drives the game's own keys and clicks; window.__ui reads the
 * view and, as setup only, steps the engine's autoplay choices (AUTO), runs Dev menu ops or loads a state (R.serialize).
 *   S1  the guided run (seed 8736, Rogue, Instant): G13.closed on the coach line with its ring on Gorrak's node; every
 *       closed Road node and signpost marked, its tooltip the closed line; H19 not counted by the closed line; a toast when
 *       the Roads open; Gorrak's barred node has its tooltip (item 3); a quest reward's "Equip now" (item 9); the Furnace
 *       header fits when the Dimming sets the state (item 5); no wind-up line prints "null" (item 10; the run goes on into
 *       zone 2 until a normal wind-up has shown). D144-1: the first hub's welcome and Trainer card by R.trainerView;
 *       D144-9: a guided fight's node says so, not the ring's band.
 *   S2  at 1x: the camp's Set out, the hub's toasts under the zone banner (item 6); the hub's Set out: no coach line while
 *       the hero walks out, "Click a lit node" once the map shows (item 2).
 *   S3  zone 2 and 3 (Dev menu): every elite's tooltip (item 3); no Moves list, the Pass through offer on its node inside
 *       the map (D150 items 6-10, was the Moves list in one column, item 5); a bag
 *       item's tooltip goes with the bags (item 4); the bag menu beside the grid (item 6); bag slots stay put (item 9); the
 *       Bell asks first (item 8); the rim names apart on a state where they would meet (item 5). D144-5: every elite at its
 *       own level, with its gap to the player's.
 *   S4  the hub (Dev menu, zone 2): all of it in view; Take keeps the cards under it in place; the Inn asks at full health
 *       and rests at once when hurt (items 5, 8).
 *   S5  fights at 1x (Dev menu): a refused key answers at once, also while a round plays, in words (energy, mana); the flee
 *       ask stays until answered, F and the button alike, a refused flee says why (item 7); a level-up banner clear of the
 *       fight's panels; the enemy's Deathblow headline clear of the coach line; the death screen clear of the panels (item 6).
 *       D144-7: one flight, one log line; D144-11: Rime Burst's answer gives its hit chance in the Deathblow's tooltip (D150
 *       item 2: no answers over the enemy), its spell tooltip the chance on each enemy.
 * The D144-n checks are the UI needs n of docs/handoffs/engine-2026-11-13d.md section 4 (D144-10 is in part M's reward):
 *   S6  a zone 2 map (Dev menu, seed 8748): a Grind's tooltip on the expedition map (one wave), the ring's band only for a
 *       node of unknown level, an unguarded chest's gold and loot in the log only after "Open the chest", the tracker's
 *       wave in a Grind ("Wave 1 of 1", then "1 of 1 wave done"), Gutting Jab's tooltip with its hit chance.
 *   S7  hints on, every hint but H05 seen: an off-balance elite whose shield takes the whole hit gives H05's shield line and
 *       leaves H05 unseen; a later window without a shield gives the plain line. D150 (engine-2026-11-14d UI need 6): only
 *       while a big hit can be cast (offBalance bigHit; 3 combo points held), none with 0 combo points (D150-6).
 */
async function partS(browser, W, H) {
  const T = CONTENT.tutorial;
  const coach = (page) => page.evaluate(() => window.__ui.coach());
  const box = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || e.closest('.hidden')) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }, sel);
  // the boxes of what shows (an ancestor's opacity counts: the death screen fades #nameplates, not each nameplate)
  const boxes = (page, sel) => page.evaluate((s) => {
    const seen = (e) => { if (e.closest('.hidden') || getComputedStyle(e).visibility === 'hidden') return false; let o = 1; for (let a = e; a && a.nodeType === 1; a = a.parentElement) o *= Number(getComputedStyle(a).opacity); return o > 0.05; };
    return [...document.querySelectorAll(s)].filter(seen).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, id: e.id || e.className.split(' ')[0] }; }).filter((r) => r.r > r.l && r.b > r.t);
  }, sel);
  const meet = (a, b, pad = 0.5) => !!a && !!b && a.l < b.r - pad && a.r > b.l + pad && a.t < b.b - pad && a.b > b.t + pad;
  const fmt = (r) => (r ? [r.l, r.t, r.r, r.b].map(Math.round).join(',') : 'none');
  const tipOn = (page) => page.evaluate(() => { const t = document.querySelector('.tooltip'); return t && t.classList.contains('on') ? t.innerText.replace(/ /g, ' ') : null; });
  const engineLen = (page) => page.evaluate(() => window.__ui.engineLog().length);
  const lastActs = (page, n) => page.evaluate((k) => window.__ui.engineLog().slice(-k), n);
  const watchToasts = (page) => page.evaluate(() => { window.__sT = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) window.__sT.push(n.textContent); }).observe(document.querySelector('#toasts'), { childList: true }); });
  const load = async (page, edit) => { const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); edit(s0); const ok = await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page); return ok; };
  const auto = async (page) => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };

  // ---- S1: the guided run (D143; items 3, 5, 9, 10)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await watchToasts(page);
      let closed = null; let roadsOpened = null; let barredTip = null; let furnace = null; let eqNow = null; const wub = []; let zone2 = false;
      let hub1 = null; let guidedTip = null; let z2Steps = 0;
      const plainWu = () => wub.some((x) => !/Deathblow/.test(x));
      // to zone 2; then on in zone 2 until a wind-up that is not a Deathblow has shown (D143 played no wind-up fight before
      // zone 2; since D147 S3, the Hexer's wind-up fight, comes before Gorrak, so one has shown by then on this route)
      for (let i = 0; i < 440; i++) {
        const st = await page.evaluate(() => {
          const v = window.__ui.view(); const mv = v.zone && v.zone.exp; const t = v.tutorial;
          return { phase: v.phase, z: v.zone ? v.zone.idx : null, onMap: v.phase === 'MAP' && !!mv && !v.node, t: t && { roads: t.roads, elite: t.elite, ended: t.ended },
            closedRoads: mv ? mv.nodes.filter((n) => n.road && n.closed).map((n) => n.id) : [], by: v.heat ? v.heat.by : null, loot: v.loot ? v.loot.kind : null,
            // Gorrak's node seen, barred and next to the player (a move mapView lists as barred: its tooltip threw)
            eliteNext: !!(mv && t && t.elite && t.elite.barred && mv.nodes[t.elite.node].know === 'full' && mv.moves.some((m) => m.nodeId === t.elite.node)),
            // a guided fight's node (mapView `guided`, D144) with its level known
            guided: mv ? (mv.nodes.find((n) => n.guided && n.know === 'full' && n.cl && !n.done) || {}).id ?? null : null,
            wub: [...document.querySelectorAll('#nameplates .wub:not(.hidden)')].map((e) => e.textContent) };
        });
        wub.push(...st.wub);
        if (st.z >= 2) zone2 = true;
        if (zone2) { if (plainWu() || ++z2Steps > 160) break; await auto(page); continue; }
        // the first hub (D144, engine-2026-11-13d UI need 1): the welcome line and the Trainer card by R.trainerView
        if (!hub1 && st.phase === 'ZONE_HUB' && st.z === 1) {
          hub1 = await page.evaluate(() => {
            const v = window.__ui.view(); const card = [...document.querySelectorAll('#screens .svc-card')].find((e) => e.querySelector('.nm').textContent === 'Trainer');
            return { zone: v.zone.name, tv: v.trainer, log: [...document.querySelectorAll('#combatlog .lines .lg-sys')].map((e) => e.textContent), card: card ? card.querySelector('.meta').textContent : null, off: !!card && card.classList.contains('off'), toll: !!card && !!card.querySelector('.hrs') };
          });
        }
        // a guided fight's node (D144, UI need 9): "guided fight", not the ring's band, once its level is known
        if (!guidedTip && st.onMap && st.guided != null) {
          const el = page.locator(`#screens .expmap .mnode[data-node="${st.guided}"]`);
          if (await el.count()) { await el.hover({ force: true }); await page.waitForTimeout(120); guidedTip = { id: st.guided, tip: await tipOn(page) }; await page.mouse.move(2, 2); }
        }
        const c = await coach(page);
        // G13.closed on the map: the ring and arrow at Gorrak's node; the closed Roads marked; H19 not counted
        if (!closed && st.onMap && c.shown && c.shown.id === 'G13.closed') {
          await page.mouse.move(2, 2);
          const ring = await page.evaluate(() => { const r = document.querySelector('.coach-on'); const a = document.querySelector('#coach .co-arrow'); return { node: r && r.matches('.mnode') ? Number(r.dataset.node) : null, arrow: a ? a.className : null }; });
          const marks = await page.evaluate(() => ({ nodes: [...document.querySelectorAll('#screens .expmap .mnode.rclosed')].map((e) => Number(e.dataset.node)).sort((a, b) => a - b), signs: [...document.querySelectorAll('#screens .expmap .xroad.rclosed')].map((e) => ({ road: Number(e.dataset.road), tag: (e.querySelector('.xshut') || {}).textContent || '' })) }));
          let roadTip = null;
          if (st.closedRoads.length) { await page.locator(`#screens .expmap .mnode[data-node="${st.closedRoads[0]}"]`).hover({ force: true }); await page.waitForTimeout(120); roadTip = await tipOn(page); await page.mouse.move(2, 2); }
          await shot(page, 'S1-g13-closed');
          await page.locator('#coach .co-ok').click(); await idle(page);
          const store = (await coach(page)).store;
          closed = { ring, marks, roadTip, want: st.closedRoads.sort((a, b) => a - b), node: st.t.roads.node, h19: { seen: !!store.seen.H19, shows: store.shows.H19 || 0 } };
        }
        // Gorrak's node while barred: a tooltip (it threw before), with the gate line and no "Click to enter"
        if (!barredTip && st.onMap && st.eliteNext) {
          const el = page.locator(`#screens .expmap .mnode[data-node="${st.t.elite.node}"]`);
          if (await el.count()) { const e0 = errors.length; await el.hover({ force: true }); await page.waitForTimeout(150); barredTip = { text: await tipOn(page), errors: errors.length - e0 }; await page.mouse.move(2, 2); }
        }
        // the Roads open: their toast (it may wait behind two others, TOAST_MAX, for a few seconds)
        if (closed && roadsOpened === null && st.t && st.t.roads && !st.t.roads.closed) {
          await page.waitForFunction((t) => window.__sT.some((x) => x.startsWith(t)), T.guide.roadsOpenLine, { timeout: 9000, polling: 100 }).catch(() => null);
          roadsOpened = await page.evaluate(() => window.__sT.slice());
        }
        // the Furnace header when the Dimming sets the state (the longest header)
        if (!furnace && st.onMap && st.by === 'dim') furnace = await page.evaluate(() => { const h0 = document.getElementById('heat'); const row = h0.querySelector('.ht-row'); const hr = h0.getBoundingClientRect(); const kids = [...row.children].filter((k) => getComputedStyle(k).display !== 'none').map((k) => k.getBoundingClientRect()); return { sw: row.scrollWidth, cw: row.clientWidth, inside: kids.every((k) => k.left >= hr.left - 0.5 && k.right <= hr.right + 0.5), text: row.textContent, cls: h0.className }; });
        // the first reward window with "Equip now": choose and put on at once
        if (!eqNow && st.loot && st.loot !== 'loot' && await page.locator('#screens .choice-cards .eqnow').count()) {
          const uid = await page.locator('#screens .choice-cards .eqnow').first().getAttribute('data-uid');
          const n0 = await engineLen(page);
          await page.locator('#screens .choice-cards .eqnow').first().click(); await idle(page);
          const acts = (await page.evaluate(() => window.__ui.engineLog())).slice(n0);
          const worn = await page.evaluate((u) => Object.values(window.__ui.view().player.equip).some((x) => x && x.uid === u), uid);
          eqNow = { uid, acts: acts.map((a) => `${a.type}${a.itemId ? `:${a.itemId}` : ''}${a.equip ? ':equip' : ''}`), worn };
          continue;
        }
        // the camp's Set out as its button sends it (AUTO sends autoplay's choice inside its own step, which the hub's
        // arrival, its banner and welcome line, do not play for)
        if (st.phase === 'PREP' && await page.evaluate(() => { const a = window.__ui.autoChoice(); return !!(a && a.action && a.action.type === 'SET_OUT'); })) { await page.evaluate(() => window.__ui.act({ type: 'SET_OUT' })); await idle(page); continue; }
        await auto(page);
      }
      check('D143-1', `G13.closed on the map: its ring on Gorrak's node (${closed && closed.node}), the arrow pointing at it`, !!closed && closed.ring.node === closed.node && closed.ring.arrow && !/none/.test(closed.ring.arrow), JSON.stringify(closed && closed.ring));
      check('D143-1', 'every closed Road node (mapView closed) has the closed mark, its signpost a Closed tag, its tooltip the closed line',
        !!closed && closed.want.length > 0 && JSON.stringify(closed.marks.nodes) === JSON.stringify(closed.want) && closed.marks.signs.length === closed.want.length && closed.marks.signs.every((x) => x.tag === 'Closed')
        && !!closed.roadTip && closed.roadTip.includes(T.beats.find((b) => b.id === 'G13').alt.closed), JSON.stringify(closed && { want: closed.want, marks: closed.marks, tip: closed.roadTip }));
      check('D143-1', 'the closed line shown and put away does not count for the Bell\'s hint H19 (no showing, not seen)', !!closed && !closed.h19.seen && closed.h19.shows === 0, JSON.stringify(closed && closed.h19));
      check('D143-1', `a toast when the Roads open ("${T.guide.roadsOpenLine}")`, Array.isArray(roadsOpened) && roadsOpened.some((x) => x.startsWith(T.guide.roadsOpenLine)), JSON.stringify(roadsOpened));
      check('S-3', `Gorrak's barred node next to the player has a tooltip: titled "Gorrak the Fieldbreaker" (mapView name; engine-2026-11-15 UI need 3), "${DB_LINE}" (D150 item 23), the gate line, no "Click to enter", no "Not here yet.", no error`, !!barredTip && !!barredTip.text && /^Gorrak the Fieldbreaker/.test(barredTip.text) && barredTip.text.includes(DB_LINE) && barredTip.text.includes('Gorrak is out on the downs') && !/Click to enter|Not here yet/.test(barredTip.text) && barredTip.errors === 0, JSON.stringify(barredTip));
      check('S-5', 'the Furnace header fits its frame when the Dimming sets the state: "State · Raised by the Dimming nearby" (demo blind round 1 B) or "Infernal · You stand in the Dimming" (D152; newcomer check 2026-11-15)', !!furnace && furnace.sw <= furnace.cw + 1 && furnace.inside && new RegExp(`^(Calm|Smouldering|Burning|Infernal)\\s*·\\s*(${DIM_NEAR_WORDS}|You stand in the Dimming)`, 'i').test(furnace.text) && !/to spare|overspent/.test(furnace.text), JSON.stringify(furnace));
      // Legacy bugs 2026-11-19 (engine-2026-11-19b): one CHOOSE_REWARD with `equip` (worn in the same step; it was CHOOSE_REWARD
      // then EQUIP, which a Dimmed encounter starting at once refused)
      check('S-9', 'a reward that is an upgrade offers "Equip now": one click sends CHOOSE_REWARD with equip, and the item is worn', !!eqNow && eqNow.acts.length === 1 && eqNow.acts[0] === 'CHOOSE_REWARD:equip' && eqNow.worn, JSON.stringify(eqNow));
      check('S-10', `no wind-up line over an enemy prints "null" (${wub.length} seen, ${wub.filter((x) => !/Deathblow/.test(x)).length} not a Deathblow, to ${z2Steps} steps into zone 2)`, plainWu() && !wub.some((x) => /null/.test(x)), [...new Set(wub)].slice(0, 6).join(' | '));
      check('S-1', 'the guided run reached zone 2', zone2, '');
      // D144 (engine-2026-11-13d UI need 1): at level 1 the trainer has nothing to teach (R.trainerView useful false), so the
      // welcome is content guide.hubLine, not "Visit the trainer"; the Trainer card says when its next spell comes
      const hubWant = hub1 ? fillLine(hub1.tv && !hub1.tv.useful ? T.guide.hubLine : T.guide.hubTrainerLine, { zone: hub1.zone }).text : null;
      check('D144-1', `the first hub's welcome line follows R.trainerView (useful ${hub1 && hub1.tv ? hub1.tv.useful : '?'}): "${hubWant}"; no "Visit the trainer" with nothing to learn`,
        !!hub1 && !!hub1.tv && hub1.tv.useful === false && hub1.log.includes(hubWant) && !hub1.log.some((x) => /Visit the trainer/.test(x)), JSON.stringify(hub1));
      check('D144-1', `the first hub's Trainer card is greyed, no toll: "Next spell at level ${hub1 && hub1.tv ? hub1.tv.next : '?'}." (D150 item 22)`, !!hub1 && !!hub1.tv && hub1.card === `Next spell at level ${hub1.tv.next}.` && hub1.off && !hub1.toll, JSON.stringify(hub1 && { card: hub1.card, off: hub1.off, toll: hub1.toll }));
      check('D144-9', 'a guided fight\'s node with its level known: its tooltip says "guided fight", not the ring\'s level band', !!guidedTip && !!guidedTip.tip && /guided fight/.test(guidedTip.tip) && !/levels \d/.test(guidedTip.tip), JSON.stringify(guidedTip));
    } catch (e) { await shot(page, 'S1-error'); check('S-1', 'part S1 (guided run) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-1', 'part S1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S2: at 1x, the camp's Set out (toasts under the zone banner) and the hub's Set out (the coach line waits for the map)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&fresh=1', null, { guide: true, hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      if (await page.locator('#prep .pp-card').count()) { await page.locator('#prep .pp-card').first().click(); await idle(page); } // D152: a first run has no board
      await page.locator('#pp-go').click();
      const under = [];
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(60);
        const r = await page.evaluate(() => { const b = document.getElementById('banner'); if (!b.classList.contains('on')) return null; const q = b.getBoundingClientRect(); return { b: { l: q.left, t: q.top, r: q.right, b: q.bottom }, ts: [...document.querySelectorAll('#toasts .toast')].map((t) => { const x = t.getBoundingClientRect(); return { text: t.textContent, l: x.left, t: x.top, r: x.right, b: x.bottom }; }) }; });
        if (r) under.push(r);
      }
      const hits = under.flatMap((r) => r.ts.filter((t) => meet(t, r.b)).map((t) => t.text));
      check('S-6', `the zone banner and the toasts at the hub: no toast over the banner (${under.length} looks with the banner on, ${under.reduce((a, r) => a + r.ts.length, 0)} toasts)`, under.length > 0 && under.some((r) => r.ts.length) && !hits.length, hits.join(' | ') || JSON.stringify(under[0]));
      await idle(page);
      // the hub's Set out: the walk out plays; no coach line shows until the map does, then G2's
      await page.locator('#screens .side .btn.primary', { hasText: 'Set out' }).click();
      const looks = [];
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(50);
        looks.push(await page.evaluate(() => { const c = document.getElementById('coach'); const vis = !c.classList.contains('hidden') && getComputedStyle(c).visibility !== 'hidden'; return { coach: vis ? c.dataset.id : null, map: !!document.querySelector('#screens .expmap .xdisc') }; }));
        if (looks[looks.length - 1].coach && looks[looks.length - 1].map) break;
      }
      const early = looks.filter((x) => x.coach && !x.map);
      // newcomer check 2026-11-15 (s0013): no walk out with an empty screen any more: the map shows at once (part X3)
      check('S-2', `after the hub's Set out no coach line shows before the map (${looks.filter((x) => !x.map).length} looks without it); then "${T.beats.find((b) => b.id === 'G2').line}" with the map`,
        !early.length && looks.some((x) => x.coach === 'G2' && x.map), JSON.stringify({ early: early.slice(0, 3), last: looks[looks.length - 1] }));
      await shot(page, 'S2-map-g2');
    } catch (e) { await shot(page, 'S2-error'); check('S-2', 'part S2 (Set out at 1x) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-2', 'part S2: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S3: zone 2 and 3 on the map (Dev menu): elites, Pass through, bags, the Bell, rim names
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, {});
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page);
      // D150 items 6-10: no Moves list on the map; a node that can be walked through offers "Pass through (N tolls)" on
      // itself while hovered, beside its node and inside the map
      const passIds = await page.evaluate(() => [...document.querySelectorAll('#screens .expmap .xpass')].map((b) => b.dataset.node));
      const mv = { list: await page.locator('#screens .expmoves, #screens .em').count(), n: passIds.length, bad: [] };
      for (const id of passIds) {
        await page.locator(`#screens .expmap .mnode[data-node="${id}"]`).hover({ force: true }); await page.waitForTimeout(120);
        const r = await page.evaluate((i) => {
          const b = document.querySelector(`#screens .expmap .xpass[data-node="${i}"]`); const w = document.querySelector('#screens .mapwin'); const br = b.getBoundingClientRect(); const wr = w.getBoundingClientRect();
          return { on: b.classList.contains('on') && getComputedStyle(b).display !== 'none', inside: br.left >= wr.left - 0.5 && br.right <= wr.right + 0.5 && br.top >= wr.top - 0.5 && br.bottom <= wr.bottom + 0.5, text: b.firstChild.textContent };
        }, id);
        if (!r.on || !r.inside || !/^Pass through \(\d+ tolls?\)$/.test(r.text)) mv.bad.push({ id, ...r });
        if (!mv.shot) { await shot(page, 'S3-pass'); mv.shot = true; }
        await page.mouse.move(2, 2); await page.waitForTimeout(300);
      }
      check('S-5', `no Moves list on the map (D150 items 6-10); every node that can be passed through (${mv.n}) offers "Pass through (N tolls)" beside it on hover, inside the map`, mv.list === 0 && mv.n >= 1 && !mv.bad.length, JSON.stringify(mv));
      // every elite of zones 2 and 3 has its tooltip (the map revealed)
      const eliteTips = [];
      for (const z of [2, 3]) {
        if (z === 3) { await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 3, level: 22, mapMode: 'expedition', prep: true })); await idle(page); await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page); }
        await page.evaluate(() => window.__ui.dev('reveal')); await idle(page);
        const els = await page.evaluate(() => { const v = window.__ui.view(); return v.zone.exp.nodes.filter((n) => n.type === 'elite').map((n) => ({ id: n.id, level: n.level, cl: n.cl, pl: v.player.level, label: document.querySelector(`#screens .expmap .mnode[data-node="${n.id}"] .cl`).textContent })); });
        for (const x of els) { await page.locator(`#screens .expmap .mnode[data-node="${x.id}"]`).hover({ force: true }); await page.waitForTimeout(120); eliteTips.push({ z, ...x, tip: await tipOn(page) }); await page.mouse.move(2, 2); }
      }
      check('S-3', `every elite node of zones 2 and 3 shows its tooltip (Elite, "${DB_LINE}"): ${eliteTips.length} nodes`, eliteTips.length >= 2 && eliteTips.every((x) => x.tip && /^Elite/.test(x.tip) && x.tip.includes(DB_LINE)), JSON.stringify(eliteTips.filter((x) => !x.tip || !x.tip.includes(DB_LINE))));
      // D144 (engine-2026-11-13d UI need 5; casual: "one level higher" for a level 17 elite at level 10): the elite's own level
      // (mapView `level`, above the node's cl) on the node, in the tooltip, and its gap to the player's level in words
      const gapText = (x) => { const g = x.level - x.pl; return g > 0 ? `${g} level${g === 1 ? '' : 's'} above you` : g < 0 ? `${-g} level${g === -1 ? '' : 's'} below you` : 'your level'; };
      const badElite = eliteTips.filter((x) => !(x.level > x.cl && x.label === String(x.level) && x.tip && x.tip.includes(`Level ${x.level}`) && x.tip.includes(`One powerful enemy at level ${x.level}, ${gapText(x)}.`)));
      check('D144-5', `every elite node says its own level (${eliteTips.map((x) => `${x.level} vs node ${x.cl}`).join(', ')}) on the map and in its tooltip, with the gap to the player's level in words`, eliteTips.length >= 2 && !badElite.length, JSON.stringify(badElite.map((x) => ({ id: x.id, level: x.level, cl: x.cl, pl: x.pl, label: x.label, tip: x.tip && x.tip.slice(0, 160) }))));
      // bags: a bag of gear (set up: two pieces worn now and a second head piece), the item's tooltip goes with the bags
      await load(page, (s0) => {
        const p0 = s0.player; const head = JSON.parse(JSON.stringify(p0.equipped.head)); head.uid = 'iS9001';
        const legs = p0.equipped.legs; p0.equipped.legs = null; const chest = p0.equipped.chest; p0.equipped.chest = null;
        p0.bag.push(legs, head, chest);
      });
      await page.keyboard.press('KeyB'); await idle(page);
      const slotUids = () => page.evaluate(() => [...document.querySelectorAll('#win-bags .baggrid .slot')].map((e) => e.dataset.uid || null));
      const first = page.locator('#win-bags .baggrid .slot[data-uid]').first();
      const name0 = await first.evaluate((e) => e.dataset.uid);
      const itemName = await page.evaluate((u) => window.__ui.view().player.bag.find((x) => x && x.uid === u).name, name0);
      await first.hover(); await page.waitForTimeout(150);
      const t1 = await tipOn(page);
      await page.keyboard.press('KeyB'); await idle(page);
      const t2 = await tipOn(page);
      const node = page.locator('#screens .expmap .mnode.here');
      await node.hover({ force: true }); await page.waitForTimeout(150);
      const t3 = await tipOn(page);
      await page.mouse.move(2, 2);
      check('S-4', `a bag item's tooltip ("${itemName}") goes when B closes the bags, and a map node's tooltip is its own after`, !!t1 && t1.includes(itemName) && !t2 && !!t3 && !t3.includes(itemName), JSON.stringify({ t1: t1 && t1.slice(0, 40), t2, t3: t3 && t3.slice(0, 40) }));
      // the bag menu opens beside the grid (it covered the item and its neighbours)
      await page.keyboard.press('KeyB'); await idle(page);
      const lay0 = await slotUids();
      const legsUid = await page.evaluate(() => { const p = window.__ui.view().player; return p.bag.find((x) => x && x.slot === 'legs').uid; });
      await page.locator(`#win-bags .baggrid .slot[data-uid="${legsUid}"]`).click();
      const menuR = await box(page, '.ctxmenu');
      const slotsR = await boxes(page, '#win-bags .baggrid .slot');
      const covered = slotsR.filter((r) => meet(menuR, r));
      check('S-6', `the bag item menu opens beside the grid: it covers none of the ${slotsR.length} slots`, !!menuR && !covered.length, `menu ${fmt(menuR)} covers ${covered.length}`);
      // equip the legs (no legs worn): every other item keeps its slot
      await page.locator('.ctxmenu').getByRole('button', { name: 'Equip', exact: true }).click(); await idle(page);
      const lay1 = await slotUids();
      const moved = lay0.map((u, i) => (u && u !== legsUid && lay1[i] !== u ? `${u}@${i}` : null)).filter(Boolean);
      check('S-9', 'equipping a bag item leaves its slot empty; every other item keeps its slot', !moved.length && !lay1.includes(legsUid) && lay1[lay0.indexOf(legsUid)] === null, JSON.stringify({ lay0, lay1 }));
      // equip the second head piece over the worn one: the worn one takes its slot
      const wornHead = await page.evaluate(() => window.__ui.view().player.equip.head.uid);
      const at = lay1.indexOf('iS9001');
      await page.locator('#win-bags .baggrid .slot[data-uid="iS9001"]').click();
      await page.locator('.ctxmenu').getByRole('button', { name: 'Equip', exact: true }).click(); await idle(page);
      const lay2 = await slotUids();
      const moved2 = lay1.map((u, i) => (u && u !== 'iS9001' && lay2[i] !== u ? `${u}@${i}` : null)).filter(Boolean);
      check('S-9', 'equipping over a worn piece puts the worn piece in the same slot; the rest stay', at >= 0 && lay2[at] === wornHead && !moved2.length, JSON.stringify({ at, wornHead, lay1, lay2 }));
      await page.keyboard.press('KeyB'); await idle(page);
      // the Bell asks first: nothing sent until "Ring the Bell"
      const n0 = await engineLen(page);
      await page.locator('#screens .expmap [data-leave="RING_BELL"]').click(); await idle(page);
      const ask = (await page.locator('#screens .expmap .leavewarn').innerText().catch(() => '')).replace(/\s+/g, ' ');
      const n1 = await engineLen(page);
      await page.locator('#screens .expmap .leavewarn').getByRole('button', { name: 'Stay' }).click(); await idle(page);
      const gone = !(await page.locator('#screens .expmap .leavewarn').count()); const n2 = await engineLen(page);
      await page.locator('#screens .expmap [data-leave="RING_BELL"]').click(); await idle(page);
      await page.locator('#screens .expmap .leavewarn').getByRole('button', { name: 'Ring the Bell', exact: true }).click(); await idle(page);
      const last = (await lastActs(page, 1))[0];
      check('S-8', 'Ring the Bell asks first ("Ring the Homeward Bell?", its charge named); Stay sends nothing; "Ring the Bell" sends RING_BELL',
        /Ring the Homeward Bell\?/.test(ask) && /only charge|charges left/.test(ask) && n1 === n0 && gone && n2 === n0 && last && last.type === 'RING_BELL', JSON.stringify({ ask, n: [n0, n1, n2], last }));
      // rim names: zone 2 with only the two ring-2 nodes next to the border of two regions seen: the names would meet
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page);
      let pair = null;
      await load(page, (s0) => {
        const z = s0.zone; const ns = z.nodes.filter((n) => n.ring === 2); const regs = R.mapView(s0).regions;
        // the two neighbouring ring-2 nodes of different regions whose names are longest together (they would meet)
        const sorted = [...ns].sort((a, b) => a.angle - b.angle); let best = -1;
        for (let i = 0; i < sorted.length; i++) {
          const a = sorted[i]; const b = sorted[(i + 1) % sorted.length]; if (a.region === b.region) continue;
          const len = (regs[a.region].name || '').length + (regs[b.region].name || '').length;
          if (len > best) { best = len; pair = [a.id, b.id]; }
        }
        for (const n of z.nodes) if (n.ring >= 2) z.seen[n.id] = pair.includes(n.id);
      });
      await page.waitForTimeout(500);
      const rim = await page.evaluate(() => {
        const svg = document.querySelector('#screens .expmap svg.xsvg'); const R0 = 437;
        const labs = [...svg.querySelectorAll('text.xrname')].map((t) => ({ name: t.textContent, mid: Number(t.dataset.mid), at: Number(t.dataset.at || t.dataset.mid), half: (t.getComputedTextLength() / 2 / R0) * (180 / Math.PI) }));
        const sep = (a, b, k) => Math.abs(((((a[k] - b[k]) % 360) + 540) % 360) - 180) - a.half - b.half;
        return { labs, raw: labs.length === 2 ? sep(labs[0], labs[1], 'mid') : null, now: labs.length === 2 ? sep(labs[0], labs[1], 'at') : null };
      });
      await shot(page, 'S3-rim');
      check('S-5', `rim names that would meet are moved apart along the rim (${rim.labs.map((x) => x.name).join(' / ')}: ${rim.raw == null ? '?' : rim.raw.toFixed(1)} deg apart before, ${rim.now == null ? '?' : rim.now.toFixed(1)} after)`,
        rim.labs.length === 2 && rim.raw < 0 && rim.now >= 0, JSON.stringify(rim));
    } catch (e) { await shot(page, 'S3-error'); check('S-3', 'part S3 (zones 2 and 3) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-3', 'part S3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S4: the zone 2 hub (Dev menu): in view; Take keeps the cards in place; the Inn asks at full health. D152: a later run
  // (a first run has no hub contract)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', M_PROFILE(), {});
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.mouse.move(2, 2);
      const cards = page.locator('#screens .side .svc-card');
      const pl = []; for (let i = 0; i < await cards.count(); i++) pl.push(await placement(cards.nth(i)));
      const foot = await box(page, '#screens .side'); const gold = await box(page, '.goldline'); const micro = await box(page, '#micromenu');
      const fits = await page.evaluate(() => { const b = document.querySelector('#screens .side > .body'); return { sh: b.scrollHeight, ch: b.clientHeight }; });
      await shot(page, 'S4-hub');
      check('S-5', `the zone 2 hub with its contract offer: all ${pl.length} service cards in view, no scrolling needed, the panel clear of the gold line and the micro menu`,
        pl.length === 3 && pl.every(fullyShown) && fits.sh <= fits.ch + 1 && !meet(foot, gold) && !meet(foot, micro), `${pl.map(placeText).join(' | ')} | body ${fits.sh}/${fits.ch} | panel ${fmt(foot)} gold ${fmt(gold)}`);
      const trainer0 = await page.locator('#screens .side .svc-card', { hasText: 'Trainer' }).boundingBox();
      await page.locator('.hubc [data-hub="reserve"]').click(); await idle(page);
      const trainer1 = await page.locator('#screens .side .svc-card', { hasText: 'Trainer' }).boundingBox();
      const stub = await page.locator('#screens .side .hubtaken').count();
      const offerGone = !(await page.locator('#screens .side .hubc').count());
      check('S-8', 'Take on the hub\'s contract: the offer leaves a note of its height, the Trainer card stays under the pointer', stub === 1 && offerGone && Math.abs(trainer1.y - trainer0.y) <= 1, JSON.stringify({ before: trainer0 && Math.round(trainer0.y), after: trainer1 && Math.round(trainer1.y), stub, offerGone }));
      // the Inn at full health asks first, in its own place
      const inn = () => page.locator('#screens .side .svc-card', { has: page.locator('.nm', { hasText: /^(Inn|Rest anyway\?)$/ }) });
      const innY0 = (await inn().boundingBox()).y;
      const n0 = await engineLen(page);
      await inn().click(); await idle(page);
      const ask = await page.evaluate(() => { const a = document.querySelector('#screens .side .svc-card.ask'); return a ? a.innerText.replace(/\s+/g, ' ') : null; });
      const innY1 = (await page.locator('#screens .side .svc-card.ask').boundingBox()).y;
      const n1 = await engineLen(page);
      await page.locator('#screens .side .svc-card.ask [data-inn="cancel"]').click(); await idle(page);
      const back = !(await page.locator('#screens .side .svc-card.ask').count()); const n2 = await engineLen(page);
      await inn().click(); await idle(page);
      await page.locator('#screens .side .svc-card.ask [data-inn="rest"]').click(); await idle(page);
      const last = (await lastActs(page, 1))[0];
      check('S-8', 'the Inn at full health and mana asks first in its own place ("Rest anyway?"); Cancel sends nothing; Rest rests',
        !!ask && /Rest anyway\?/.test(ask) && Math.abs(innY1 - innY0) <= 1 && n1 === n0 && back && n2 === n0 && last && last.type === 'SERVICE' && last.service === 'inn', JSON.stringify({ ask, y: [innY0, innY1], n: [n0, n1, n2], last }));
      // hurt: one click rests (zone 3's hub)
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 3, level: 22, mapMode: 'expedition', prep: true })); await idle(page);
      await load(page, (s0) => { s0.player.hp = Math.round(s0.player.d.maxHp * 0.5); });
      await inn().click(); await idle(page);
      const last2 = (await lastActs(page, 1))[0];
      check('S-8', 'the Inn when hurt rests at once (no ask)', last2 && last2.type === 'SERVICE' && last2.service === 'inn' && !(await page.locator('#screens .side .svc-card.ask').count()), JSON.stringify(last2));
    } catch (e) { await shot(page, 'S4-error'); check('S-4', 'part S4 (the hub) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-4', 'part S4: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S5: fights at 1x (Dev menu)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&fresh=1&guide=0', null, { hints: true });
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const clearCoach = async () => { for (let i = 0; i < 4; i++) { if (!(await coach(page)).shown) return; await page.locator('#coach .co-ok').click(); await idle(page); } };
      await clearCoach();
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'] })); await idle(page);
      await page.mouse.move(2, 2);
      // the Deathblow hint (H04) on the coach line (hints come with a step: after Sap, W); then Pass (X): its "Deathblow
      // stopped" headline clear of the line (D150: "stopped", not "answered")
      await page.keyboard.press('KeyW'); await idle(page);
      const h04 = (await coach(page)).shown;
      await page.keyboard.press('KeyX');
      let head = null; let co = null;
      for (let i = 0; i < 60 && !head; i++) {
        await page.waitForTimeout(60);
        const f = (await page.evaluate(() => window.__ui.floats())).floats.filter((x) => /^Deathblow stopped/.test(x.text));
        if (f.length) { head = f[0]; co = await box(page, '#coach'); }
      }
      await idle(page);
      check('S-6', `the enemy's "Deathblow stopped" headline keeps clear of the coach line (${h04 ? h04.id : 'no line'})`, !!h04 && !!head && !!co && !meet({ l: head.x0, t: head.y0, r: head.x1, b: head.y1 }, co), JSON.stringify({ head: head && [head.x0, head.y0, head.x1, head.y1].map(Math.round), coach: fmt(co) }));
      await clearCoach();
      // a refused key: energy too low, also while a round plays: the reason at once, in words, nothing queued
      await load(page, (s0) => { s0.fight.p.energy = 45; s0.fight.p.cds = {}; });
      const bar = await page.evaluate(() => window.__ui.view().player.bar);
      const gj = bar.indexOf('gutting_jab') + 1;
      await watchToasts(page);
      await page.keyboard.press(`Digit${gj}`); await page.waitForTimeout(150);
      const s1 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const want = `Not enough energy for ${R.C.SPELL.gutting_jab.name}: it costs ${R.spellCost(s1, 'gutting_jab')}, you have ${Math.floor(s1.fight.p.energy)}`;
      const playing0 = !!(await page.evaluate(() => window.__ui.playingEvent()));
      await page.keyboard.press(`Digit${gj}`); await page.waitForTimeout(200);
      const mid = await page.evaluate(() => ({ playing: !!window.__ui.playingEvent(), queued: window.__ui.queued(), toasts: window.__sT.slice() }));
      await idle(page);
      check('S-7', `a spell key with too little energy, pressed while the round plays: "${want}" at once, nothing queued`, playing0 && mid.playing && !mid.queued && mid.toasts.some((t) => t.startsWith(want)), JSON.stringify(mid));
      // the flee ask: F, the box stays (past the old 2.2 s), Esc puts it away; F then the button runs
      const ask = () => page.evaluate(() => { const a = document.getElementById('fleeask'); const b = [...document.querySelectorAll('#actionbar .ctrl .btn')].find((x) => /Flee|Confirm/.test(x.textContent)); return { shown: !!a && !a.classList.contains('hidden'), text: a ? a.innerText.replace(/\s+/g, ' ') : '', btn: b ? b.textContent : null }; });
      const nF = await engineLen(page);
      await page.keyboard.press('KeyF'); await idle(page);
      const a1 = await ask(); await page.waitForTimeout(2600); const a2 = await ask();
      const fa = await box(page, '#fleeask'); const tp = await box(page, '#turnprompt');
      await shot(page, 'S5-flee-ask');
      await page.keyboard.press('Escape'); await idle(page);
      const a3 = await ask(); const nE = await engineLen(page);
      check('S-7', 'F asks "Flee this fight?" over the control row and the button reads Confirm?; the ask stays until answered (2.6 s on); Esc puts it away, nothing sent',
        a1.shown && /Flee this fight\?/.test(a1.text) && /^Confirm\?/.test(a1.btn) && a2.shown && !meet(fa, tp) && !a3.shown && /^Flee/.test(a3.btn) && nE === nF, JSON.stringify({ a1, a2: a2.shown, a3, n: [nF, nE] }));
      const fleeLines = () => page.evaluate(() => [...document.querySelectorAll('#combatlog .lines > div')].map((e) => e.textContent).filter((x) => x === 'You flee from the fight.' || x === 'You fail to escape!'));
      const fl0 = await fleeLines();
      await page.keyboard.press('KeyF'); await idle(page);
      await page.locator('#actionbar .ctrl .btn', { hasText: 'Confirm?' }).click(); await idle(page);
      const fl = (await page.evaluate(() => window.__ui.engineLog())).slice(nE).map((x) => x.type);
      check('S-7', 'F then the Confirm? button flees (FLEE sent)', fl.includes('FLEE'), JSON.stringify(fl));
      // D144 (engine-2026-11-13d UI need 7): one flight, one line (the engine's action and `fled` were both logged)
      const fl1 = (await fleeLines()).slice(fl0.length);
      check('D144-7', `one flee, one line in the log ("${fl1.join('" / "')}")`, fl1.length === 1, JSON.stringify(fl1));
      // a refused flee says why (a fight that cannot be fled)
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'] })); await idle(page);
      await load(page, (s0) => { s0.fight.canFlee = false; });
      await watchToasts(page);
      const nR = await engineLen(page);
      await page.keyboard.press('KeyF'); await page.waitForTimeout(200);
      const why = await page.evaluate(() => ({ toasts: window.__sT.slice(), ask: !document.getElementById('fleeask').classList.contains('hidden') }));
      check('S-7', 'F where fleeing is not allowed: the reason as a toast at once, no ask, nothing sent', why.toasts.some((t) => /flee/i.test(t)) && !why.ask && (await engineLen(page)) === nR, JSON.stringify(why));
      // a mana spell with no mana: the reason in words at once
      await page.evaluate(() => window.__ui.dev('build', { classId: 'mage', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'] })); await idle(page);
      await page.keyboard.press('KeyX'); await idle(page);
      // D144 (engine-2026-11-13d UI need 11): an answer that lands only on a hit roll (Rime Burst) gives its chance
      // (windupView answers' `chance`), not "?"; D150 item 2: the line over the enemy lists no answers, the Deathblow's
      // tooltip does (with the chance), and the turn prompt when Rime Burst is its instruction; Rime Burst's tooltip gives
      // its chance on every enemy (spellInfo hitAll)
      const rb = await page.evaluate(() => { const v = window.__ui.view(); const w = (v.combat.windups || []).find((x) => x.answers.some((a) => a.id === 'rime_burst' && typeof a.chance === 'number')); const a = w ? w.answers.find((x) => x.id === 'rime_burst') : null; return { chance: a ? a.chance : null, first: w && w.answers[0] ? w.answers[0].id : null, prompt: document.querySelector('#turnprompt .tp-t').textContent, over: document.querySelectorAll('#nameplates .ans-o, #nameplates .db-a').length }; });
      const rbPc = rb.chance == null ? null : `${Math.round(rb.chance * 100)} %`;
      const dbBan = page.locator('#nameplates .wub.db:not(.hidden)').first();
      let dbTip = null;
      if (await dbBan.count()) { await dbBan.hover(); await page.waitForTimeout(150); dbTip = await tipOn(page); await page.mouse.move(2, 2); }
      check('D144-11', `a wind-up's answer that lands on a hit roll gives its chance: the Deathblow's tooltip "Rime Burst (${rbPc} to hit)" (windupView answers' chance), the turn prompt too when it is the instruction; no answers over the enemy`,
        !!rbPc && !!dbTip && dbTip.includes(`Rime Burst (${rbPc} to hit)`) && rb.over === 0 && (rb.first !== 'rime_burst' || rb.prompt.includes(`(${rbPc} to hit)`)), JSON.stringify({ rb, tip: dbTip }));
      const sM = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const hitAll = R.spellInfo(sM, 'rime_burst', null).hitAll || [];
      const rbSlot = (await page.evaluate(() => window.__ui.view().player.bar)).indexOf('rime_burst');
      let rbTip = null;
      if (rbSlot >= 0) { await page.locator(`#actionbar button.ab[data-slot="${rbSlot}"]`).hover(); await page.waitForTimeout(150); rbTip = await tipOn(page); await page.mouse.move(2, 2); }
      const wantAll = `Hit chance: ${hitAll.map((x) => `${sM.fight.enemies[x.u].name} ${Math.round(x.chance * 100)} %`).join(', ')}`;
      check('D144-11', `an AoE spell's tooltip gives its hit chance on each enemy: "${wantAll}" (R.spellInfo hitAll)`, hitAll.length > 0 && !!rbTip && rbTip.includes(wantAll), JSON.stringify({ slot: rbSlot, tip: rbTip }));
      await load(page, (s0) => { s0.player.mana = 0; });
      const mbar = await page.evaluate(() => window.__ui.view().player.bar);
      const sp = mbar.find((id) => id && R.C.SPELL[id] && R.C.SPELL[id].cost > 0 && R.C.SPELL[id].target === 'enemy');
      await watchToasts(page);
      await page.keyboard.press(`Digit${mbar.indexOf(sp) + 1}`); await page.waitForTimeout(150);
      const s2 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const wantM = `Not enough mana for ${R.C.SPELL[sp].name}: it costs ${R.spellCost(s2, sp)}, you have 0`;
      const mt = await page.evaluate(() => window.__sT.slice());
      check('S-7', `a spell key with no mana: "${wantM}" at once`, mt.some((t) => t.startsWith(wantM)), JSON.stringify(mt));
      // a level-up in the middle of a fight: the banner keeps clear of the fight's panels
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z1_furrow_boar', 'z1_furrow_boar'], level: 10 })); await idle(page);
      await page.keyboard.press('KeyX'); await idle(page);
      await load(page, (s0) => { s0.player.xp = R.xpToNext(s0.player.level) - 5; s0.player.mana = s0.player.d.maxMana; s0.fight.enemies[0].hp = 1; });
      const lv0 = await page.evaluate(() => window.__ui.view().player.level);
      const eb = await page.evaluate(() => window.__ui.view().player.bar.indexOf('ember_bolt') + 1);
      await page.mouse.move(2, 2);
      await page.keyboard.press(`Digit${eb}`);
      let lb = null;
      for (let i = 0; i < 60 && !lb; i++) { await page.waitForTimeout(50); lb = await page.evaluate(() => { const b = document.getElementById('banner'); return b.classList.contains('on') && b.classList.contains('level') ? (() => { const r = b.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; })() : null; }); }
      const panels = lb ? await boxes(page, '#target-frame, #ruler, #nameplates .np, #turnprompt, #actionbar, #player-frame, #tracker') : [];
      await shot(page, 'S5-levelup');
      await idle(page);
      const lv1 = await page.evaluate(() => window.__ui.view().player.level);
      const hitP = panels.filter((p) => meet(lb, p)).map((p) => p.id);
      check('S-6', `a level-up mid-fight (${lv0} -> ${lv1}): the banner covers none of the fight's panels (${panels.length} in view)`, lv1 > lv0 && !!lb && !hitP.length, `banner ${fmt(lb)} covers ${hitP.join(', ') || 'none'}`);
      // the death screen: the fight's panels give way to "You have died"
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'] })); await idle(page);
      await load(page, (s0) => { s0.player.hp = 1; s0.player.res.boon = 0; s0.player.res.meta = 0; s0.player.bag = s0.player.bag.filter((x) => !(x.kind === 'cons' && x.id === 'ember_of_return')); });
      let dead = null;
      for (let k = 0; k < 12 && !dead; k++) {
        await page.keyboard.press('KeyX');
        for (let i = 0; i < 50 && !dead; i++) {
          await page.waitForTimeout(60);
          dead = await page.evaluate(() => { const d = document.querySelector('.deathmsg'); if (d.parentElement.classList.contains('hidden')) return null; return { dying: document.body.classList.contains('dying') }; });
        }
        if (!dead) await idle(page);
      }
      if (dead) { await page.waitForTimeout(450); dead.msg = await box(page, '.deathmsg'); dead.panels = await boxes(page, '#target-frame, #nameplates .np, #ruler, #turnprompt'); }
      await shot(page, 'S5-death');
      await idle(page);
      check('S-6', '"You have died": the fight\'s panels (target frame, nameplates, ruler, turn prompt) give way while it shows', !!dead && dead.dying && !!dead.msg && !dead.panels.some((p) => meet(dead.msg, p)), JSON.stringify(dead));
    } catch (e) { await shot(page, 'S5-error'); check('S-5', 'part S5 (fights at 1x) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-5', 'part S5: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S6: the engine hand-off's UI needs (engine-2026-11-13d section 4) on a zone 2 map (Dev menu, seed 8748: an
  // unguarded chest and a Grind next to the hub, the Grind next to the chest)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, {});
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 10, mapMode: 'expedition', prep: true, seed: 8748 })); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page);
      const mv0 = await page.evaluate(() => window.__ui.view().zone.exp);
      const reach = new Set(mv0.moves.map((m) => m.nodeId));
      const chest = mv0.nodes.find((n) => n.type === 'treasure' && n.know === 'full' && n.guarded === false && reach.has(n.id) && n.nb.some((j) => mv0.nodes[j].type === 'grind'));
      if (!chest) throw new Error('seed 8748: no unguarded chest with a Grind next to it in reach');
      const grind = mv0.nodes[chest.nb.find((j) => mv0.nodes[j].type === 'grind')];
      const hoverTip = async (id) => { await page.locator(`#screens .expmap .mnode[data-node="${id}"]`).hover({ force: true }); await page.waitForTimeout(120); const t = await tipOn(page); await page.mouse.move(2, 2); return t; };
      // need 8: a Grind on the expedition map is one wave (mapView `waves`): no "Wave 1" or "1 to 3 waves"
      const k = grind.archetypes.length; const foes = `${k} ${k === 1 ? 'enemy' : 'enemies'}`;
      const gTip = await hoverTip(grind.id);
      check('D144-8', `a Grind's tooltip on the expedition map (mapView waves ${grind.waves}): "Foes: ${foes}" and "One wave of ${foes}", no "Wave 1" or "1 to N waves"`,
        grind.waves === 1 && !!gTip && gTip.includes(`Foes: ${foes}`) && gTip.includes(`One wave of ${foes}.`) && !/Wave 1|1 to \d+ waves/.test(gTip), JSON.stringify(gTip));
      // need 9: the ring's level band only while a node's own level is unknown
      const far = mv0.nodes.find((n) => !n.hub && n.know === 'none');
      const band = far ? mv0.bands[far.ring] : null;
      const fTip = far ? await hoverTip(far.id) : null;
      check('D144-9', `a node whose level is known gives its level, not the ring's band; an unknown node gives the band (levels ${band ? band.join('–') : '?'})`,
        !!gTip && gTip.includes(`Level ${grind.cl}`) && !/levels \d/.test(gTip) && !!fTip && fTip.includes(`levels ${band[0]}–${band[1]}`), JSON.stringify({ grind: gTip && gTip.split('\n').slice(0, 2), far: fTip && fTip.split('\n').slice(0, 2) }));
      // need 6: the unguarded chest: nothing of it in the log before "Open the chest"; its gold and loot after, once
      const logLines = () => page.evaluate(() => [...document.querySelectorAll('#combatlog .lines > div')].map((e) => e.textContent));
      const fmtN = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // util.js fmtNum (part S's fmt is for boxes)
      const inChest = (x) => new RegExp(`^You receive ${MONEY_RE}`).test(x) || /^You receive loot:/.test(x) || /Needle trap/.test(x);
      const n0 = (await logLines()).length;
      await page.evaluate((id) => window.__ui.act({ type: 'MOVE', nodeId: id }), chest.id); await idle(page);
      const held = await page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, step: v.node && v.node.step }; });
      const before = (await logLines()).slice(n0);
      await page.getByRole('button', { name: 'Open the chest' }).click(); await idle(page);
      const all = (await logLines()).slice(n0);
      const after = all.slice(before.length);
      const spoils = await page.evaluate(() => { const l = window.__ui.view().loot; return l ? { title: l.title, gold: l.gold, items: l.items.length } : null; });
      check('D144-6', `an unguarded chest: no gold, loot or trap in the log while it waits for "Open the chest" (${before.length} lines); after it, its gold once and one line per item (${spoils ? spoils.items : '?'})`,
        held.phase === 'NODE' && held.step === 'chest' && !before.some(inChest) && !!spoils && spoils.title === 'Treasure chest'
        && after.filter((x) => x === `You receive ${moneyTxt(spoils.gold)}.`).length === 1 && after.filter((x) => /^You receive loot:/.test(x)).length === spoils.items && after.filter((x) => /Needle trap/.test(x)).length <= 1,
        JSON.stringify({ held, before, after, spoils }));
      await auto(page);
      // need 8: the Grind's fight: the tracker says the wave being fought ("Wave 1 of 1", not "Wave 0 of 1"); its spoils, the wave done
      await page.evaluate((id) => window.__ui.act({ type: 'MOVE', nodeId: id }), grind.id); await idle(page);
      const trk = () => page.evaluate(() => document.querySelector('#tracker').innerText.replace(/\s+/g, ' '));
      const tr1 = await trk();
      // need 11: a spell's tooltip gives its hit chance on the target (R.spellInfo hit)
      const bar = await page.evaluate(() => window.__ui.view().player.bar);
      const gj = bar.indexOf('gutting_jab');
      const s1 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const t0 = await page.evaluate(() => window.__ui.target());
      const ti = t0 != null && s1.fight.enemies[t0] && s1.fight.enemies[t0].alive ? t0 : s1.fight.enemies.find((e) => e.alive).idx;
      const hit = R.spellInfo(s1, 'gutting_jab', ti).hit;
      await page.locator(`#actionbar button.ab[data-slot="${gj}"]`).hover(); await page.waitForTimeout(150);
      const jTip = await tipOn(page); await page.mouse.move(2, 2);
      const wantHit = `Hit chance on ${['elite', 'rare', 'boss', 'dboss'].includes(s1.fight.enemies[ti].kind) ? '' : 'the '}${s1.fight.enemies[ti].name}: ${Math.round(hit * 100)} %`; // D150: "the Hedge Ogre"
      check('D144-11', `a spell's tooltip gives its hit chance on the target: "${wantHit}" (R.spellInfo hit)`, typeof hit === 'number' && !!jTip && jTip.includes(wantHit), JSON.stringify(jTip));
      let tr2 = null;
      for (let i = 0; i < 60 && !tr2; i++) {
        await auto(page);
        const v = await page.evaluate(() => { const x = window.__ui.view(); return { over: x.combat ? x.combat.over : null, loot: !!x.loot, phase: x.phase }; });
        if (v.over === 'victory' && v.loot) tr2 = await trk();
        if (v.phase === 'MAP') break;
      }
      check('D144-8', `the tracker in a Grind: "Wave 1 of 1" while the wave is fought, "1 of 1 wave done" with its spoils (never "Wave 0")`,
        /Grind Wave 1 of 1/.test(tr1) && !!tr2 && /1 of 1 wave done/.test(tr2) && !/Wave 0/.test(tr1 + tr2), JSON.stringify({ tr1, tr2 }));
    } catch (e) { await shot(page, 'S6-error'); check('S-6', 'part S6 (the engine hand-off\'s UI needs) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-6', 'part S6: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S7: H05's shield line (D144, engine-2026-11-13d UI need 2): hints on, every hint but H05 seen
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, { hints: true });
    try {
      const seen = {};
      for (const x of T.hints) if (x.id !== 'H05') { seen[x.id] = true; for (const c of ['rogue', 'mage', 'hunter']) seen[`${x.id}:${c}`] = true; }
      await page.evaluate(([key, json]) => localStorage.setItem(key, json), [HINTS_KEY, JSON.stringify({ off: false, seen, nudge: { summary: 0, hall: false }, shows: {} })]);
      await reloadKeep(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 10, mapMode: 'expedition', prep: true })); await idle(page);
      const H05 = T.hints.find((x) => x.id === 'H05');
      // the casual's case: an elite 8 levels up with a Bolster's shield (BOLSTER_PCT of its health) while it is off-balance;
      // D150 (engine-2026-11-14d UI need 6): H05 only while a big hit can be cast (offBalance bigHit): 3 combo points held
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'], level: 18 })); await idle(page);
      await load(page, (s0) => { const e = s0.fight.enemies[0]; e.st.push({ id: 'OFF_BALANCE', dur: 3, value: R.C.OFFBAL_TAKEN }); e.shield = Math.round(R.C.BOLSTER_PCT * e.maxHp); s0.player.hp = s0.player.d.maxHp; s0.fight.p.cp = 3; });
      await page.keyboard.press('KeyX'); await idle(page);
      const ob = await page.evaluate(() => window.__ui.view().combat.enemies[0].offBalance);
      const c1 = await coach(page);
      await shot(page, 'S7-h05-shield');
      if (c1.shown) { await page.locator('#coach .co-ok').click(); await idle(page); }
      const st1 = (await coach(page)).store;
      check('D144-2', `an off-balance enemy whose shield takes the whole hit (offBalance shield ${ob && ob.shield}, absorbs ${ob && ob.absorbs}): H05's shield line "${H05.alt.shield}"; H05 stays unseen`,
        !!ob && ob.absorbs && !!c1.shown && c1.shown.id === 'H05' && c1.shown.text === fillLine(H05.alt.shield, {}).text && !st1.seen.H05 && !st1.shows.H05, JSON.stringify({ ob, shown: c1.shown, seen: st1.seen.H05, shows: st1.shows.H05 }));
      // a later window with no shield: the plain line ("Spend your big hit now"), and then H05 is seen. A new page: a Dev
      // menu fight is no new fight for the coach (no fightStart event), and H05's try in this one is spent
      await reloadKeep(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 10, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z1_furrow_boar'], level: 10 })); await idle(page);
      // D150 (engine-2026-11-14d UI need 6): first with no big hit to cast (0 combo points: bigHit false): no H05 ("Spend your
      // big hit now" at 0 combo points was the blind tester's case); then 3 combo points: the line
      await load(page, (s0) => { const e = s0.fight.enemies[0]; e.st.push({ id: 'OFF_BALANCE', dur: 3, value: R.C.OFFBAL_TAKEN }); e.shield = 0; s0.fight.p.cp = 0; });
      await page.keyboard.press('KeyX'); await idle(page);
      const c0 = await page.evaluate(() => ({ shown: window.__ui.coach().shown, ob: window.__ui.view().combat.enemies[0].offBalance }));
      check('D150-6', 'an off-balance window with no big hit to cast (0 combo points, offBalance bigHit false): no H05 line', !!c0.ob && c0.ob.bigHit === false && !(c0.shown && c0.shown.id === 'H05'), JSON.stringify(c0));
      await load(page, (s0) => { const e = s0.fight.enemies[0]; if (!e.st.some((x) => x.id === 'OFF_BALANCE')) e.st.push({ id: 'OFF_BALANCE', dur: 3, value: R.C.OFFBAL_TAKEN }); e.shield = 0; s0.fight.p.cp = 3; s0.player.hp = s0.player.d.maxHp; });
      await page.keyboard.press('KeyX'); await idle(page);
      const c2 = await coach(page);
      if (c2.shown) { await page.locator('#coach .co-ok').click(); await idle(page); }
      const st2 = (await coach(page)).store;
      check('D144-2', 'a later off-balance window without a shield: H05\'s own line ("Spend your big hit now"); seen once put away', !!c2.shown && c2.shown.id === 'H05' && /^Off-balance: it takes \+\d+% damage\. Spend your big hit now\.$/.test(c2.shown.text) && !!st2.seen.H05, JSON.stringify({ shown: c2.shown, seen: st2.seen.H05 }));
    } catch (e) { await shot(page, 'S7-error'); check('S-7', 'part S7 (H05\'s shield line) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-7', 'part S7: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part T: the text pass (D150)
/**
 * Visible words on the page (D150 word budget): text nodes laid out in the window with no hidden or transparent ancestor,
 * outside the combat log (a record the player can fold), the toast stack (passing messages), the Dev tab and key chips
 * (glyphs, not words); a word is a token with a letter in it. { words, text }.
 */
const visibleWords = async (page) => { await page.waitForTimeout(700); return page.evaluate(() => { // the panels' fades are over
  const toks = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  const shown = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; } return true; };
  while ((n = w.nextNode())) {
    const t = n.textContent.trim(); const el = n.parentElement;
    if (!t || !el || el.closest('script, style, #combatlog, #toasts, #devbtn, #devmenu, #boot, kbd, .kbd, .key, .mk, .k')) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0) || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth || !shown(el)) continue;
    toks.push(...t.split(/\s+/));
  }
  const words = toks.filter((x) => /[A-Za-z]/.test(x));
  return { words: words.length, text: words.join(' ') };
}); };
/** The engage round's and the map's word budgets (D150, the Lead's task: engage under 120, map under 90). */
const T_ENGAGE_MAX = 120;
const T_MAP_MAX = 90;
/** Player text the naming rule drops (D150): par, Ascendancy, the Star's line, Pays, Spoils, ilvl, "you stay hidden", "answered". */
const T_BANNED = /\bpar\b|Ascendancy|Star's line|\bPays\b|\bSpoils\b|\bilvl\b|stay hidden|\b[Aa]nswered\b|Unlit Star|Resurrect charges/;
const T_WORDS = {}; // the counts this run measured, printed in the summary line of part T

async function partT(browser, W, H) {
  const T = CONTENT.tutorial;
  const watchToasts = (page) => page.evaluate(() => { window.__sT = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) window.__sT.push(n.textContent); }).observe(document.querySelector('#toasts'), { childList: true }); });
  const coach = (page) => page.evaluate(() => window.__ui.coach());
  const tipOn = (page) => page.evaluate(() => { const t = document.querySelector('.tooltip'); return t && t.classList.contains('on') ? t.innerText.replace(/ /g, ' ') : null; });
  const auto = async (page) => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };
  // the Furnace's one line as written (the state's name is upper-cased by style.css): "Calm · 16 tolls to spare", "Boss +N %" after
  const heatLine = (page) => page.evaluate(() => {
    const e = document.querySelector('#heat'); if (!e || e.classList.contains('hidden')) return null;
    const t = (sel) => { const x = e.querySelector(sel); return x && !x.classList.contains('hidden') ? x.textContent.trim() : ''; };
    return [`${t('.ht-sname')} ${t('.ht-sep')} ${t('.ht-num')}`, t('.ht-boss')].filter(Boolean).join(' ');
  });
  const want = (hv) => `${HEAT_WORDS.state[hv.state]} · ${stand(hv)}${Math.round((hv.ascIfPar || 0) * 100) > 0 ? ` Boss +${Math.round(hv.ascIfPar * 100)} %` : ''}`; // D152: stand() as section 4
  // ---- T1: the guided first run, Rogue, seed 8736, a new profile (guide and hints on)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      // class select on a first run: no Seed field, no Echoes button (D150 naming rule)
      const cs = await page.evaluate(() => ({ seed: !!document.querySelector('#create .bottom .seedf:not(.hidden)'), echoes: !!document.querySelector('#create .bottom .echoes:not(.hidden)'), guide: !!document.querySelector('#create .bottom .guide:not(.hidden)') }));
      check('D150-naming', 'class select on a first run: no Seed field and no Echoes button; the guide toggle shown', !cs.seed && !cs.echoes && cs.guide, JSON.stringify(cs));
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      // D152 (changes-m3-v2.md 1.2-1.3; engine-2026-11-14f UI need 2): a lean first run's start camp: no board, no contracts
      // section, the two supplies under "Supplies", PREP_POINTS_FIRST points, and over Set out content prep.unspentFirst
      // with prepView.unspent.echoes; the points' and Set out's tooltips (they threw on a missing Reserve) name no Reserve or
      // contract; buying both supplies spends every point and the line goes
      const camp = await page.evaluate(() => { const pv = window.__ui.view().prep; return { first: pv.first, points: pv.points, board: pv.board.length, opts: pv.options.map((o) => o.id), unspent: pv.unspent,
        cards: document.querySelectorAll('#prep .pp-card').length, boardEl: !!document.querySelector('#prep .pp-board'), shop: (document.querySelector('#prep .pp-shop .pp-lab') || {}).textContent || null,
        sub: !!document.querySelector('#prep .pp-shop .pp-sub'), optEls: document.querySelectorAll('#prep .pp-opt').length, line: (document.querySelector('#prep .pp-unspent:not(.hidden)') || {}).textContent || null, keys: (document.querySelector('#prep .pp-keys') || {}).textContent || '' }; });
      const unspentWant = (e) => CONTENT.tutorial.prep.unspentFirst.replace('{echoes}', String(e));
      check('D152-camp', `a first run's start camp (D152): no board or contracts section, the ${R.C.PREP_POINTS_FIRST} points, two supplies (Field Draughts, Ember of Return) under "Supplies"; over Set out "${unspentWant(camp.unspent && camp.unspent.echoes)}"`,
        camp.first === true && camp.board === 0 && camp.cards === 0 && !camp.boardEl && camp.points === R.C.PREP_POINTS_FIRST && camp.opts.join(',') === 'prep_draughts,prep_ember' && camp.optEls === 2 && camp.shop === 'Supplies' && !camp.sub
          && camp.line === unspentWant(camp.unspent.echoes) && camp.unspent.echoes === camp.points * R.C.PREP_ECHO_PER_POINT && !/contracts/.test(camp.keys), JSON.stringify(camp));
      const tipOf = async (sel) => { await page.locator(sel).hover(); await page.waitForTimeout(150); const t = await page.evaluate(() => { const x = document.querySelector('.tooltip.on'); return x ? x.innerText.replace(/\u00a0/g, ' ') : null; }); await page.mouse.move(2, 2); await page.waitForTimeout(80); return t; };
      const ptsTip = await tipOf('#prep .pm-points'); const goTip = await tipOf('#pp-go');
      check('D152-camp', 'a first run\'s points and Set out tooltips show (no error on a missing Reserve), say what unspent points pay, and name no Reserve or contract',
        !!ptsTip && !!goTip && ptsTip.includes(unspentWant(camp.unspent.echoes)) && goTip.includes(unspentWant(camp.unspent.echoes)) && !/Reserve|contract/i.test(ptsTip + goTip) && errors.length === 0, JSON.stringify({ ptsTip, goTip, errors }));
      await shot(page, 'T1-camp');
      await page.keyboard.press('KeyA'); await idle(page); await page.keyboard.press('KeyB'); await idle(page);
      const spent = await page.evaluate(() => ({ left: window.__ui.view().prep.left, line: !!document.querySelector('#prep .pp-unspent:not(.hidden)') }));
      check('D152-camp', `both supplies bought with A and B: every one of the ${R.C.PREP_POINTS_FIRST} points spent, the unspent line goes`, spent.left === 0 && !spent.line, JSON.stringify(spent));
      await page.keyboard.press('KeyA'); await idle(page); await page.keyboard.press('KeyB'); await idle(page); // sold back: the run below is as before
      const furnaceBefore = []; let furnaceAt = null; let hub = null; let map = null; let engage = null; let elite = null; let elite2 = null; let stopped = null; let map2 = null;
      let g15 = null; // D150 (Lead): a key refused for lack of resource while G15 is open shows its line, no toast
      for (let i = 0; i < 320; i++) {
        const st = await page.evaluate(() => {
          const v = window.__ui.view(); const c = v.combat; const sh = window.__ui.coach().shown; const log = window.__ui.coach().log;
          return { phase: v.phase, z: v.zone ? v.zone.idx : null, onMap: v.phase === 'MAP' && !!(v.zone && v.zone.exp) && !v.node && !v.loot, fight: !!(c && !c.over && !v.loot && v.node && v.node.step === 'combat'),
            engage: !!(c && c.engage), elite: !!(c && c.enemies.some((e) => e.rank === 'elite')), round: c ? c.round : null, coach: sh ? sh.id : null,
            furnaceShown: log.some((x) => x.id === 'G5' || x.id === 'H16'), g5done: !!(v.tutorial && (v.tutorial.done || []).includes('G5')), heatOn: !!document.querySelector('#heat:not(.hidden)'),
            stopped: !!document.querySelector('#nameplates .wub.stopped:not(.hidden)'), g15: !!(v.tutorial && (v.tutorial.open || []).some((o) => o.id === 'G15' && o.line && !o.rest)) };
        });
        if (st.z >= 2) break;
        // engine-2026-11-14d section 7: G15 opens when a bar spell is refused only for its resource; a press of that key
        // shows G15's coach line (ringing the resource bar) in place of the refusal toast, and sends nothing
        if (!g15 && st.fight && st.g15) {
          const slot = await page.evaluate(() => { const v = window.__ui.view(); const L = v.legal.spells || {}; return v.player.bar.findIndex((id) => id && L[id] && !L[id].ok && /^Not enough (energy|mana|focus)/.test(L[id].reason || '')); });
          if (slot >= 0) {
            await watchToasts(page); const n0 = await page.evaluate(() => window.__ui.engineLog().length);
            await page.keyboard.press(`Digit${slot + 1}`); await page.waitForTimeout(200);
            g15 = await page.evaluate((n) => { const c = window.__ui.coach().shown; const on = document.querySelector('.coach-on'); return { slot: n.slot, shown: c, ring: on ? on.matches('#player-frame .bar.res') : false, toasts: window.__sT.slice(), sent: window.__ui.engineLog().length - n.n0 }; }, { slot, n0 });
            await shot(page, 'T1-g15-refused');
          }
        }
        // D150 item 1: the Furnace waits for its coach line (G5, or H16) in a guided first run
        // (engine D150 item 12: G5 opens at zone 1's first hub screen, so the steps before it are the start camp's)
        if (st.phase !== 'CREATE') {
          if (!st.furnaceShown && !st.g5done) furnaceBefore.push({ i, phase: st.phase, on: st.heatOn });
          else if (!furnaceAt && st.coach && (st.coach === 'G5' || st.coach === 'H16')) {
            const hv = await page.evaluate(() => window.__ui.view().heat);
            furnaceAt = { i, phase: st.phase, coach: st.coach, on: st.heatOn, line: await heatLine(page), want: want(hv), row2: await page.locator('#heat .ht-row2').count(), segText: await page.evaluate(() => [...document.querySelectorAll('#heat .ht-seg')].map((x) => x.textContent).join('')), anchor: await page.evaluate(() => !!document.querySelector('#heat.coach-on')) };
            await shot(page, 'T1-furnace-line');
          }
        }
        // the first hub: the Trainer with nothing to teach is greyed, no toll, no click; no "Tolls so far"
        if (!hub && st.phase === 'ZONE_HUB' && st.z === 1) {
          hub = await page.evaluate(() => {
            const v = window.__ui.view(); const card = [...document.querySelectorAll('#screens .svc-card')].find((e) => e.querySelector('.nm') && e.querySelector('.nm').textContent === 'Trainer');
            return { tv: v.trainer, off: !!(card && card.classList.contains('off')), meta: card ? card.querySelector('.meta').textContent : null, toll: card ? !!card.querySelector('.hrs') : null, foot: (document.querySelector('#screens .side .sfoot') || {}).innerText || '', log: window.__ui.engineLog().length };
          });
          await page.locator('#screens .svc-card.off').first().click({ force: true }).catch(() => {}); await idle(page);
          const after = await page.evaluate(() => ({ log: window.__ui.engineLog().length, phase: window.__ui.view().phase, node: !!window.__ui.view().node }));
          hub.click = after; hub.words = await visibleWords(page);
          await shot(page, 'T1-hub');
        }
        // the first map at rest (the pointer parked): no Moves panel, no zone toll, the tracker without tolls; its word count;
        // a reachable node's tooltip ("Costs N tolls.") and its "Pass through" button, from the engine's previews
        if (!map && st.onMap && st.z === 1) {
          await page.mouse.move(2, 2); await page.waitForTimeout(150);
          const w = await visibleWords(page);
          const m = await page.evaluate(() => {
            const v = window.__ui.view(); const mv = v.zone.exp;
            const mv0 = mv.moves.find((x) => x.passTime != null && !x.barred && !mv.nodes[x.nodeId].barred && !mv.nodes[x.nodeId].hub) || null;
            return { moves: document.querySelectorAll('#screens .expmoves').length, sub: (document.querySelector('#screens .mhead .subtitle') || {}).textContent || '', tracker: document.querySelector('#tracker').innerText,
              node: mv0 ? mv0.nodeId : null, go: mv0 ? (v.heat.next[`MOVE:${mv0.nodeId}`] || {}).time : null, pass: mv0 ? (v.heat.next[`PASS_THROUGH:${mv0.nodeId}`] || {}).time : null };
          });
          let tipText = null; let passBtn = null;
          if (m.node != null) {
            await page.locator(`#screens .expmap .mnode[data-node="${m.node}"]`).hover({ force: true }); await page.waitForTimeout(150);
            tipText = await tipOn(page);
            passBtn = await page.evaluate((id) => { const b = document.querySelector(`#screens .expmap .xpass[data-node="${id}"]`); return b ? { on: b.classList.contains('on') && getComputedStyle(b).display !== 'none', text: b.firstChild.textContent, key: (b.querySelector('.kbd') || {}).textContent || null } : null; }, m.node);
            await page.mouse.move(2, 2); await page.waitForTimeout(420);
            passBtn.after = await page.evaluate((id) => { const b = document.querySelector(`#screens .expmap .xpass[data-node="${id}"]`); return !!b && getComputedStyle(b).display !== 'none'; }, m.node);
          }
          // the Bell's ask (section 7): its tolls and the fight that comes first, as the engine's preview of RING_BELL says; Stay
          let bell = null;
          const bb = page.locator('#screens .mhead .btn[data-leave="RING_BELL"]');
          if (await bb.count()) {
            await bb.click(); await idle(page);
            bell = await page.evaluate(() => { const x = window.__ui.view(); const e = document.querySelector('#screens .leavewarn .lw-bell'); return { p: x.heat.next.RING_BELL || null, text: e ? e.textContent : null }; });
            await shot(page, 'T1-bell-ask');
            await page.getByRole('button', { name: 'Stay' }).click(); await idle(page);
          }
          map = { w, m, tipText, passBtn, bell };
          await shot(page, 'T1-map');
        }
        // the first engage round (no elite): the word budget, one "free first move", no strip, the cards (item 4), no prompt line
        if (!engage && st.fight && st.engage && !st.elite) {
          await page.mouse.move(2, 2); await page.waitForTimeout(120);
          const w = await visibleWords(page);
          engage = await page.evaluate(() => {
            const v = window.__ui.view(); const eh = document.querySelector('#engage .eg-h'); const zz = document.querySelector('#nameplates .np .zz');
            const amb = document.querySelector('#engage .eg-opt[data-opt="ambush"] .eg-txt');
            return { head: eh && getComputedStyle(eh).display !== 'none' ? eh.innerText.replace(/\s+/g, ' ').trim() : null, coach: window.__ui.coach().shown, ruler: document.querySelectorAll('#ruler').length, unaware: !!(zz && !zz.classList.contains('hidden')),
              ambush: amb ? amb.textContent : null, knowsSS: v.player.spells.some((s) => s.id === 'shadowstep_strike'), cards: [...document.querySelectorAll('#engage .eg-txt')].map((x) => x.textContent).join(' | '),
              prompt: !document.querySelector('#turnprompt').classList.contains('hidden'), rows: (() => { const t = document.querySelector('#target-frame .ttrack'); return t ? getComputedStyle(t).display : null; })() };
          });
          await page.locator('#target-frame .plate').hover({ force: true }); await page.waitForTimeout(80);
          engage.rowsHover = await page.evaluate(() => { const t = document.querySelector('#target-frame .ttrack'); return t ? { d: getComputedStyle(t).display, head: (t.querySelector('.tr-h') || {}).textContent || '' } : null; });
          await page.mouse.move(2, 2);
          engage.w = w;
          await shot(page, 'T1-engage');
        }
        // Gorrak's engage round: the Deathblow's instruction once, in the turn prompt (item 2)
        if (!elite && st.fight && st.engage && st.elite) {
          await page.mouse.move(2, 2); await page.waitForTimeout(120);
          const w = await visibleWords(page);
          elite = await page.evaluate(() => {
            const v = window.__ui.view(); const wv = v.combat.windups.find((x) => x.deathblow);
            const out = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
            while ((n = tw.nextNode())) { const el = n.parentElement; if (!el || !el.closest('#engage, #nameplates, #target-frame, #heat') || el.closest('.hidden')) continue; const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push(n.textContent); }
            const wub = document.querySelector('#nameplates .wub.db:not(.hidden)');
            const parts = (e) => (e ? [...e.children].map((c) => c.textContent.trim()).filter(Boolean).join(' ') : null); // style.css upper-cases the badge
            return { w: wv ? { round: wv.round, name: wv.name, est: wv.est } : null, prompt: document.querySelector('#turnprompt .tp-t').innerText.replace(/\s+/g, ' ').trim(), tag: document.querySelector('#turnprompt .tp-k').textContent,
              egDb: document.querySelectorAll('#engage .eg-db, #engage .eg-dbc, #engage .eg-dbtag').length, sapMark: !!document.querySelector('#engage .eg-opt[data-opt="sap"].db-ans'),
              wub: parts(wub), wubAns: wub ? wub.querySelectorAll('.db-a, .db-est').length : null, rest: out.join(' ').replace(/\s+/g, ' ') };
          });
          elite.words = w;
          await shot(page, 'T1-elite-engage');
        }
        if (elite && !elite2 && st.fight && st.elite && st.round === 2) {
          elite2 = await page.evaluate(() => { const v = window.__ui.view(); const wv = v.combat.windups.find((x) => x.deathblow); const wub = document.querySelector('#nameplates .wub.db:not(.hidden)'); return { w: wv ? { round: wv.round, name: wv.name, est: wv.est } : null, prompt: document.querySelector('#turnprompt .tp-t').innerText.replace(/\s+/g, ' ').trim(), wub: wub ? [...wub.children].map((c) => c.textContent.trim()).filter(Boolean).join(' ') : null }; });
        }
        // the Deathblow stopped (item 24): one line over Gorrak and one status chip
        if (!stopped && st.fight && st.elite && st.stopped) {
          await page.mouse.move(2, 2); await page.waitForTimeout(100);
          stopped = await page.evaluate(() => {
            const v = window.__ui.view(); const g = v.combat.enemies.find((e) => e.rank === 'elite');
            const np = document.querySelector(`#nameplates .np[data-idx="${g.idx}"]`); const tf = document.querySelector('#target-frame');
            const vis = (e) => !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none';
            return { off: !!g.offBalance, line: np.querySelector('.wub').innerText.replace(/\s+/g, ' ').trim(), npObal: vis(np.querySelector('.obal')), npStacks: [...np.querySelectorAll('.wstk .wst')].map((x) => x.innerText.replace(/\s+/g, ' ')),
              tfObal: vis(tf.querySelector('.obal')), tfStk: vis(tf.querySelector('.wstk')), ribbon: [...np.querySelectorAll('.tk.now .b-wu, .tk.now .b-ob')].map((x) => x.textContent), coach: window.__ui.coach().shown };
          });
          await shot(page, 'T1-deathblow-stopped');
        }
        if (!map2 && elite && st.onMap && st.z === 1 && !st.fight) {
          await page.mouse.move(2, 2); await page.waitForTimeout(150);
          map2 = { w: await visibleWords(page), line: await heatLine(page), want: want(await page.evaluate(() => window.__ui.view().heat)) };
          await shot(page, 'T1-map-later');
        }
        await auto(page);
      }
      // ---- the checks
      check('D150-1', `the Furnace stays hidden in the guided run until its coach line has shown (${furnaceBefore.length} steps before it)`, furnaceBefore.length > 0 && furnaceBefore.every((x) => !x.on), JSON.stringify(furnaceBefore.filter((x) => x.on).slice(0, 4)));
      check('D150-1', `with its line (${furnaceAt && furnaceAt.coach}) the Furnace shows, ringed, its one line "${furnaceAt && furnaceAt.want}" (heatView), no title, no pay line, no names on the bar`,
        !!furnaceAt && furnaceAt.on && furnaceAt.anchor && furnaceAt.line === furnaceAt.want && furnaceAt.row2 === 0 && furnaceAt.segText === '' && !/Furnace|Boss \+0|pays|Dimming/.test(furnaceAt.line), JSON.stringify(furnaceAt));
      // Lead 2026-11-14: H16 at G5's moment and never both: the guided run shows G5 at the first hub, H16 never
      const log1 = (await coach(page)).log;
      check('D150-H16', 'the guided run: G5\'s line at the first hub, H16 never (G5 stands in for it)', !!furnaceAt && furnaceAt.coach === 'G5' && furnaceAt.phase === 'ZONE_HUB' && !log1.some((x) => x.id === 'H16'), JSON.stringify({ at: furnaceAt && { coach: furnaceAt.coach, phase: furnaceAt.phase }, h16: log1.filter((x) => x.id === 'H16') }));
      check('D150-22', `the first hub's Trainer, nothing to teach (R.trainerView next ${hub && hub.tv && hub.tv.next}): greyed, "Next spell at level N.", no toll, a click spends nothing; no "Tolls so far"`,
        !!hub && hub.off && hub.meta === `Next spell at level ${hub.tv.next}.` && hub.toll === false && hub.click.log === hub.log && hub.click.phase === 'ZONE_HUB' && !hub.click.node && !/Tolls so far/.test(hub.foot), JSON.stringify(hub && { ...hub, words: undefined }));
      check('D150-9', 'the map: no Moves panel, no "zone toll", no toll counter in the tracker', !!map && map.m.moves === 0 && !/zone toll/.test(map.m.sub) && !/Tolls:|par\b/.test(map.m.tracker), JSON.stringify(map && map.m));
      check('D150-6', `a reachable node's tooltip: "Costs ${map && map.m.go} tolls." (heatView), no Dimming countdown, no Pass sentence, no "Pays"`,
        !!map && map.m.node != null && !!map.tipText && map.tipText.includes(`Costs ${tolls(map.m.go)}.`) && !/Dims in|Dimming in|Pass in the list|walk through it|Pays|no reward/.test(map.tipText), map && map.tipText);
      check('D150-9', `hovered, the node offers "Pass through (${map && map.m.pass} toll)" on itself (heatView's PASS_THROUGH), and the offer goes with the pointer`,
        !!map && !!map.passBtn && map.passBtn.on && map.passBtn.text === `Pass through (${tolls(map.m.pass)})` && map.passBtn.key === 'X' && map.passBtn.after === false, JSON.stringify(map && map.passBtn));
      // D152: zone 1 of a first run has no Bell (the ask of section 7 is checked on a later run, part W3)
      check('D152-bell', 'the guided first run\'s zone 1 map: no Bell button, so no Bell ask', !!map && !map.bell, JSON.stringify(map && map.bell));
      if (map) T_WORDS.map = map.w.words;
      check('D150-words', `the map at rest: ${map && map.w.words} visible words (under ${T_MAP_MAX}; the combat log, toasts and key chips not counted)`, !!map && map.w.words < T_MAP_MAX, map && map.w.text);
      if (engage) T_WORDS.engage = engage.w.words;
      check('D150-words', `the first engage round: ${engage && engage.w.words} visible words (under ${T_ENGAGE_MAX})`, !!engage && engage.w.words < T_ENGAGE_MAX, engage && engage.w.text);
      const jointUp = engage && engage.coach && ['G7', 'H01', 'G8.withEngage'].includes(engage.coach.id);
      check('D150-3', `the engage round: "Free first move. They act from round 2." once (none while ${engage && engage.coach ? engage.coach.id : 'no coach line'} says it), the UNAWARE badge, no "do not act" anywhere, no opening ruler`,
        !!engage && (jointUp ? engage.head === null : engage.head === 'Free first move. They act from round 2.') && engage.unaware && engage.ruler === 0 && !/do not act|not noticed|still do not|They do not/.test(engage.w.text), JSON.stringify(engage && { ...engage, w: undefined }));
      const ambWant = engage && engage.knowsSS ? `${R.C.SPELL.shadowstep_strike.name}. +${R.C.SPELL.shadowstep_strike.cp} combo points.` : `${R.C.SPELL.gutting_jab.name} at ×${R.C.AMBUSH_MULT}. +${R.C.ENGAGE_OPTION.ambush.cp} combo points.`;
      check('D150-4', `the cards: Ambush "${ambWant}" (the spells known), no "You stay in Stealth", no "else"`, !!engage && engage.ambush === ambWant && !/Stealth|\belse\b/i.test(engage.cards), engage && engage.cards);
      check('D150-16', 'the target frame\'s list of next actions shows on hover only (the chips over the enemy stay); its head is "Next actions"; no turn prompt line in the engage round',
        !!engage && engage.rows === 'none' && !!engage.rowsHover && engage.rowsHover.d !== 'none' && engage.rowsHover.head === 'Next actions' && engage.prompt === false, JSON.stringify(engage && { rows: engage.rows, rowsHover: engage.rowsHover, prompt: engage.prompt }));
      const pWant = elite && elite.w ? `Round ${elite.w.round}: ${elite.w.name}, about ${elite.w.est}. Sap now W, then Pass X.` : null;
      if (elite) T_WORDS.elite = elite.words.words;
      const g15Want = fillLine(T.beats.find((b) => b.id === 'G15').byClass.rogue, {}).text;
      check('D150-G15', `a bar key refused for its energy while G15 is open: G15's line on the coach line ("${g15Want}"), ringing the resource bar; no refusal toast; nothing sent`,
        !!g15 && !!g15.shown && g15.shown.id === 'G15.rogue' && g15.shown.text === g15Want && g15.ring && !g15.toasts.some((x) => /^Not enough/.test(x)) && g15.sent === 0, JSON.stringify(g15));
      check('D150-2', `Gorrak's engage round: the turn prompt says it once, "${pWant}" (windupView), tagged "Deathblow" (no "· R1": the line names its round)`, !!elite && elite.prompt === pWant && elite.tag === 'Deathblow', JSON.stringify(elite && { prompt: elite.prompt, tag: elite.tag }));
      check('D150-2', 'no Deathblow box in the engage panel, no "how to stop it" on the cards (the Sap card keeps its crimson mark), no answers or estimate over Gorrak; no "Sap, then wait" or "Pass X" on the panel, the nameplates, the target frame or the Furnace',
        !!elite && elite.egDb === 0 && elite.sapMark && elite.wubAns === 0 && /^Deathblow R\d MAIMS if it lands$/.test(elite.wub || '') && !/then wait|Answer:|Wait:|Sap now|Pass X/.test(elite.rest), JSON.stringify(elite && { egDb: elite.egDb, sapMark: elite.sapMark, wub: elite.wub, wubAns: elite.wubAns, rest: elite.rest.slice(0, 600) }));
      const p2Want = elite2 && elite2.w ? `Round ${elite2.w.round}: ${elite2.w.name}, about ${elite2.w.est}. Pass X. Attacking breaks Sap.` : null;
      check('D150-2', `round 2 after Sap: the prompt "${p2Want}"; the line over Gorrak gives no instruction`, !!elite2 && elite2.prompt === p2Want && !/Wait|Pass|answered/.test(elite2.wub || ''), JSON.stringify(elite2));
      const sWant = stopped ? `Deathblow stopped. It is weakened${stopped.off ? ': hit it now' : ''}.` : null;
      check('D150-24', `the Deathblow stopped: one line over Gorrak, "${sWant}", and one status chip (Staggered); no off-balance marks, no STOPPED ribbon, no H05 line meanwhile`,
        !!stopped && stopped.line === sWant && !stopped.npObal && !stopped.tfObal && !stopped.tfStk && stopped.npStacks.length === 1 && /^Staggered/.test(stopped.npStacks[0]) && stopped.ribbon.length === 0 && !(stopped.coach && stopped.coach.id === 'H05'), JSON.stringify(stopped));
      if (map2) T_WORDS.mapLater = map2.w.words;
      check('D150-25', `the map later, the Furnace on: its one line "${map2 && map2.want}" (no "Dimming", no toast); ${map2 && map2.w.words} words`, !!map2 && map2.line === map2.want, JSON.stringify(map2 && { line: map2.line, text: map2.w.text }));
      const all = [map, engage, elite].filter(Boolean).map((x) => (x.w || x.words).text).join(' ');
      check('D150-naming', 'no par, Ascendancy, "the Star\'s line", Pays, Spoils, ilvl, "you stay hidden" or "answered" on these screens', !T_BANNED.test(all), (all.match(T_BANNED) || []).join(', '));
    } catch (e) { await shot(page, 'T1-error'); check('T-1', 'part T1 (the guided run) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('T-1', 'part T1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- T2: a run that is not guided (guide and hints off): the Furnace from the hub on, its tooltip, the pass-through button
  // by mouse and by keyboard, the Bell's ask, the loot rows
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1');
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.locator('#pp-go').click(); await idle(page); // the start camp: set out
      await page.waitForFunction(() => window.__ui.view().phase === 'ZONE_HUB', null, { timeout: 8000 }).catch(() => null);
      let v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, heat: x.heat }; });
      const line = await heatLine(page);
      check('D150-1', `not a guided run: the Furnace shows at the first hub, "${v.heat && want(v.heat)}"`, v.phase === 'ZONE_HUB' && line === want(v.heat), `${v.phase} | ${line}`);
      await page.locator('#heat').hover({ force: true }); await page.waitForTimeout(150);
      const tt = await tipOn(page); await page.mouse.move(2, 2);
      const names = Object.values(HEAT_WORDS.state);
      check('D150-5', `the Furnace's tooltip: "${FURNACE_LINE}" (demo blind round 1 B, draft) and the four states`, !!tt && tt.includes(FURNACE_LINE) && names.every((x) => tt.includes(x)) && !T_BANNED.test(tt) && !/no reward|in hand|so far/.test(tt), tt);
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
      // a reachable node that can be passed through: hover, then the button; then by keyboard on the next node
      const pick = () => page.evaluate(() => { const x = window.__ui.view(); const mv = x.zone.exp; const m = mv.moves.find((y) => y.passTime != null && !y.barred && !mv.nodes[y.nodeId].hub && !mv.nodes[y.nodeId].barred); return m ? { node: m.nodeId, t: (x.heat.next[`PASS_THROUGH:${m.nodeId}`] || {}).time, time: x.time } : null; });
      const p1 = await pick();
      let mouse = null;
      if (p1) {
        await page.locator(`#screens .expmap .mnode[data-node="${p1.node}"]`).hover({ force: true }); await page.waitForTimeout(120);
        await page.locator(`#screens .expmap .xpass[data-node="${p1.node}"]`).click(); await idle(page);
        mouse = await page.evaluate(() => ({ last: window.__ui.engineLog().slice(-1)[0], time: window.__ui.view().time, pos: window.__ui.view().zone.exp.pos }));
      }
      check('D150-9', `"Pass through" by mouse: PASS_THROUGH on that node, its tolls as the label said (${p1 && p1.t})`, !!mouse && mouse.last.type === 'PASS_THROUGH' && mouse.last.nodeId === p1.node && mouse.time - p1.time === p1.t, JSON.stringify({ p1, mouse }));
      // the key: X passes through the node whose offer shows (hovered, or with the focus), as X passes a round in a fight
      const p2 = await pick();
      let keys = null;
      if (p2) {
        await page.locator(`#screens .expmap .mnode[data-node="${p2.node}"]`).hover({ force: true }); await page.waitForTimeout(80);
        await page.keyboard.press('KeyX'); await idle(page);
        keys = { hover: await page.evaluate(() => window.__ui.engineLog().slice(-1)[0]) };
        await page.mouse.move(2, 2); await page.waitForTimeout(350);
        const p3 = await pick();
        if (p3) {
          await page.locator(`#screens .expmap .mnode[data-node="${p3.node}"]`).focus(); await page.waitForTimeout(60);
          keys.p3 = p3; keys.shownOnFocus = await page.evaluate((id) => { const b = document.querySelector(`#screens .expmap .xpass[data-node="${id}"]`); return !!b && getComputedStyle(b).display !== 'none'; }, p3.node);
          await page.keyboard.press('KeyX'); await idle(page);
          keys.focus = await page.evaluate(() => window.__ui.engineLog().slice(-1)[0]);
        }
      }
      check('D150-9', 'the key: X passes through the node hovered, and the node with the focus (its offer shown)', !!keys && keys.hover.type === 'PASS_THROUGH' && keys.hover.nodeId === p2.node && !!keys.p3 && keys.shownOnFocus && keys.focus.type === 'PASS_THROUGH' && keys.focus.nodeId === keys.p3.node, JSON.stringify({ p2, keys }));
      // a fight's loot: no notes, "item level"
      let loot = null;
      for (let i = 0; i < 80 && !loot; i++) {
        const has = await page.evaluate(() => { const x = window.__ui.view(); return !!(x.loot && x.loot.kind === 'loot'); });
        if (has) loot = await page.evaluate(() => ({ text: document.querySelector('#screens .loot').innerText.replace(/\s+/g, ' '), gear: (window.__ui.view().loot.items || []).filter((it) => it.kind === 'gear').map((it) => it.ilvl) }));
        else await auto(page);
      }
      check('D150-19', 'loot rows: no "(already in your purse)", "Earned in this fight" or "in your bags"; gear says "item level N"', !!loot && !/purse|Earned in this fight|in your bags|ilvl/.test(loot.text) && loot.gear.every((n) => loot.text.includes(`item level ${n}`)), loot && loot.text);
      // D150 item 21 (engine-2026-11-14d UI need 9): the trainer's line; "Level N ·" only on spells not yet known; Train all
      // with what it spends in all (the ranks, then the new spells the gold covers: the engine's dry TRAIN_ALL). Set up: a
      // zone 2 hub at level 12, one known spell a rank behind, one spell of the level not known, gold for both
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const cls0 = Object.keys(s0.player.spells).filter((id) => R.C.SPELL[id] && R.C.SPELL[id].source === 'class' && R.C.SPELL[id].lvl > 1 && R.C.SPELL[id].lvl <= 12);
      const forget = cls0[cls0.length - 1]; const behind = Object.keys(s0.player.spells).find((id) => id !== forget && R.C.SPELL[id].source === 'class');
      delete s0.player.spells[forget]; s0.player.bar = s0.player.bar.map((x) => (x === forget ? null : x)); if (s0.player.spellOrder) s0.player.spellOrder = s0.player.spellOrder.filter((x) => x !== forget);
      s0.player.spells[behind].tl = 10; s0.player.gold = 5000000;
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'HUB_SERVICE', service: 'trainer' })); await idle(page);
      const s1 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const dry = s1.player.gold - R.step(s1, { type: 'TRAIN_ALL' }).state.player.gold;
      const tr = await page.evaluate(() => {
        const w = document.querySelector('#screens .svc'); const b = [...w.querySelectorAll('button')].find((x) => /^Train all/.test(x.textContent));
        return { sub: (w.querySelector('.subtitle') || {}).textContent || '', rows: [...w.querySelectorAll('.trow')].map((r) => ({ nm: r.querySelector('.nm').textContent, meta: r.querySelector('.meta').textContent })), btn: b ? { text: b.textContent, money: !!b.querySelector('.money') } : null, cost: window.__ui.view().legal.trainAllCost };
      });
      const knownNames = Object.keys(s1.player.spells).map((id) => R.C.SPELL[id].name);
      const badRows = tr.rows.filter((r) => (knownNames.includes(r.nm) ? /^Level \d+ ·/.test(r.meta) : !/^Level \d+ ·/.test(r.meta)));
      check('D150-21', `the trainer: "Train spells to bring them up to your level."; "Level N ·" only on spells not known (${tr.rows.length} rows); Train all with its cost, the engine's dry TRAIN_ALL (${dry} copper: a rank and ${R.C.SPELL[forget].name})`,
        tr.sub === 'Train spells to bring them up to your level.' && tr.rows.length > 0 && !badRows.length && !!tr.btn && tr.btn.money && tr.cost === dry && dry > 0, JSON.stringify({ sub: tr.sub, badRows, btn: tr.btn, cost: tr.cost, dry }));
      await shot(page, 'T2-trainer');
    } catch (e) { await shot(page, 'T2-error'); check('T-2', 'part T2 (not guided) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('T-2', 'part T2: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- T3: the guide off, hints on (Lead 2026-11-14; demo blind round 1 B, 2026-11-26: at the first map, not the hub): H16 on
  // the Furnace when the map first shows; none at the hub; no G5; and no first-map note (the coach line carries the sentence)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1&fresh=1', null, { hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 3 && (await coach(page)).shown; i++) { await page.locator('#coach .co-ok').click(); await idle(page); } // the camp's H23
      await page.locator('#pp-go').click(); await idle(page);
      await page.waitForFunction(() => window.__ui.view().phase === 'ZONE_HUB', null, { timeout: 8000 }).catch(() => null);
      await page.mouse.move(2, 2); await page.waitForTimeout(150);
      const hub = await page.evaluate(() => { const c = window.__ui.coach(); return { phase: window.__ui.view().phase, shown: c.shown }; });
      for (let i = 0; i < 3 && (await coach(page)).shown; i++) { await page.locator('#coach .co-ok').click(); await idle(page); } // another hub hint
      await page.locator('#screens').getByRole('button', { name: 'Set out' }).click(); await idle(page);
      await page.waitForFunction(() => window.__ui.view().phase === 'MAP', null, { timeout: 8000 }).catch(() => null);
      await page.mouse.move(2, 2); await page.waitForTimeout(250);
      const h16 = await page.evaluate(() => { const v = window.__ui.view(); const c = window.__ui.coach(); const on = document.querySelector('.coach-on'); return { phase: v.phase, tutorial: !!(v.tutorial && v.tutorial.on), shown: c.shown, ring: on ? on.id : null, g5: c.log.some((x) => x.id === 'G5'), note: !document.querySelector('#heat-intro').classList.contains('hidden') }; });
      const want16 = T.hints.find((x) => x.id === 'H16').line;
      await shot(page, 'T3-h16-map');
      check('D150-H16', `the guide off, hints on: no H16 at the hub (${hub.shown ? hub.shown.id : 'none'}); at the first map H16's line ("${want16}"), ringing the Furnace; no G5, no first-map note`,
        hub.phase === 'ZONE_HUB' && !(hub.shown && hub.shown.id === 'H16') && h16.phase === 'MAP' && !h16.tutorial && !!h16.shown && h16.shown.id === 'H16' && h16.shown.text === want16 && h16.ring === 'heat' && !h16.g5 && !h16.note, JSON.stringify({ hub, h16 }));
    } catch (e) { await shot(page, 'T3-error'); check('T-3', 'part T3 (H16 at the first map) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('T-3', 'part T3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  console.log(`      part T word counts (${SIZE}): ${JSON.stringify(T_WORDS)}`);
}

// ------------------------------------------------------------------ part U: blind round 2 (2026-11-14)
/**
 * Part U: the UI bugs and friction of blind round 2 (docs/feedback/2026-11-14-blind-{casual-rerun,tactician-rerun,skipper,
 * competitive,explorer}.md; docs/handoffs/ui-2026-11-14e.md), real engine at Instant speed, every check through the
 * game's own controls (window.__ui for setup and reading only).
 *   U1 seed 7 (start camp, guide off): a bought supply's tip goes on its key and comes back up to date; the map's Key shows
 *      the node icons; Esc on the map opens nothing; a click on a node out of reach or on a Road's sign says why and sends
 *      nothing; a key puts a map node's tip away (B over the node); every gear row of the spoils and of a chest has "Equip
 *      now" and it equips; the level-up banner names what waits at the trainer; the reward card's tip clears every Equip
 *      now; the trainer row's tip clears every price and Learn; enemy uids (the target frame's portrait key) are unique per
 *      fight; the combat log stays where it was scrolled.
 *   U2 seed 5: the dungeon's counts (map tooltip, entry, tracker, the panel between fights) from the engine; the panel
 *      between fights shows a ration eaten there (health, rations left).
 *   U3 loaded states: the step that fills the bags says so; items waiting in the loot window ask before Leave drops them.
 *   U4 autoplay switches off after a rescue (guided run) and when a fight in the Dimming starts, with its line; the rescue's
 *      banner beside the map panel.
 *   U5 four enemies: plates, chips and names clear of each other; the skip line on a backing; the talent tip clears its
 *      rank counter; a companion's tip clears the other companions; the guided run's Skip needs one confirm and no hint
 *      follows on that screen; seed 11's Road sign clear of the nodes.
 */
async function partU(browser, W, H) {
  const watch = (page) => page.evaluate(() => { window.__uT = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) window.__uT.push(n.textContent); }).observe(document.querySelector('#toasts'), { childList: true }); });
  const toasts = (page) => page.evaluate(() => window.__uT.slice());
  // a toast may wait in the stack's queue (TOAST_MAX on screen): up to 7 s
  const toastSeen = (page, re) => page.waitForFunction((src) => window.__uT.some((t) => new RegExp(src).test(t)), re.source, { timeout: 7000, polling: 100 }).then(() => true, () => false);
  const auto = async (page) => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };
  const tipOn = (page) => page.evaluate(() => { const t = document.querySelector('.tooltip.on'); return t ? t.innerText.replace(/ /g, ' ') : null; });
  const tipRect = (page) => page.evaluate(() => { const t = document.querySelector('.tooltip.on'); if (!t) return null; const r = t.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  const overSel = (page, sel) => page.evaluate((q) => { const t = document.querySelector('.tooltip.on'); if (!t) return null; const r = t.getBoundingClientRect();
    return [...document.querySelectorAll(q)].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && r.left < b.right - 1 && r.right > b.left + 1 && r.top < b.bottom - 1 && r.bottom > b.top + 1; }).length; }, sel);
  const nLog = (page) => page.evaluate(() => window.__ui.engineLog().length);
  const sv = (page) => page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, z: v.zone ? v.zone.idx : null, node: v.node ? { type: v.node.type, step: v.node.step, trash: v.node.trash ?? null, fightNo: v.node.fightNo } : null, loot: v.loot ? v.loot.kind : null, fight: !!(v.combat && !v.combat.over), level: v.player ? v.player.level : null, autoplay: v.autoplay }; });
  const spellName = (id) => (R.C.SPELL[id] || {}).name || id;
  // ---- U1
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1');
    try {
      await watch(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      // a supply bought with its key while its tip shows: the tip goes, and comes back with "sell it back"
      const opt = page.locator('#prep .pp-opt').first();
      await opt.hover(); await page.waitForTimeout(150);
      const t0 = await tipOn(page);
      const key = await opt.evaluate((e) => (e.querySelector('.kbd, .k') || {}).textContent || null);
      if (key) await page.keyboard.press(`Key${key.trim().toUpperCase()}`); await idle(page);
      const t1 = await tipOn(page);
      const b = await opt.boundingBox(); await page.mouse.move(b.x + b.width / 2 + 3, b.y + b.height / 2 + 2); await page.waitForTimeout(150);
      const t2 = await tipOn(page);
      check('U-stale', `a supply bought with its key (${key}): the tip ("${(t0 || '').split('\n').pop()}") goes; back under the pointer it says "sell it back"`, !!t0 && /to buy it/.test(t0) && !t1 && !!t2 && /sell it back/.test(t2), JSON.stringify({ t0, t1, t2 }));
      await page.mouse.move(2, 2);
      for (let i = 0; i < 40 && (await sv(page)).phase !== 'MAP'; i++) await auto(page);
      await page.mouse.move(2, 2); await page.waitForTimeout(500);
      // the Key: the node icons at rest
      const keyP = await page.evaluate(() => { const k = document.querySelector('.expmap .xkey'); return { icons: [...k.querySelectorAll('.xki img')].filter((i) => i.getClientRects().length && i.getBoundingClientRect().width > 0).length,
        clipped: [...k.querySelectorAll('.xki img')].filter((i) => i.getBoundingClientRect().right > k.getBoundingClientRect().right + 0.5).length, words: k.innerText.trim(),
        cut: [...k.querySelectorAll('.xki b')].filter((b) => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > k.getBoundingClientRect().right + 0.5).length }; });
      // demo blind round 1 B (newcomer s0246: "nine unlabelled icons"): each icon with its name, at rest, none cut
      const KEY_NAMES = ['Quest', 'Grind', 'Elite', 'Dungeon', 'Treasure', 'Shrine', 'Rest', 'Vendor', 'Trainer'];
      check('U-key', 'the map\'s Key shows the 9 node icons at rest inside its panel, each with its name (demo blind round 1 B)', keyP.icons === 9 && keyP.clipped === 0 && KEY_NAMES.every((n) => keyP.words.split(/\s+/).includes(n)) && keyP.cut === 0, JSON.stringify(keyP));
      await shot(page, 'U1-map');
      // Esc on the map: no Settings, one line
      let n0 = await nLog(page);
      await page.keyboard.press('Escape'); await idle(page);
      const esc = await page.evaluate(() => ({ settings: !!document.querySelector('#win-settings'), onMap: !!document.querySelector('#screens .expmap') }));
      const escSaid = await toastSeen(page, new RegExp(`^${MAP_ESC}`));
      check('U-esc', `Esc on the zone map opens no Settings and says "${MAP_ESC}"; the map stays`, !esc.settings && esc.onMap && escSaid, JSON.stringify({ esc, t: await toasts(page) }));
      // a node out of reach and a Road's sign
      const far = await page.evaluate(() => { const v = window.__ui.view(); const mv = v.zone.exp; const near = new Set(mv.moves.map((m) => m.nodeId));
        const n = mv.nodes.find((x) => x.id !== mv.pos && !near.has(x.id) && !x.barred && document.querySelector(`.expmap .mnode[data-node="${x.id}"]`));
        const rd = (mv.roads || []).find((r) => r !== mv.pos);
        return { node: n ? n.id : null, road: rd ?? null }; });
      n0 = await nLog(page);
      await page.locator(`.expmap .mnode[data-node="${far.node}"]`).click({ force: true }); await idle(page);
      await page.locator(`.expmap .xroad[data-road="${far.road}"]`).click({ force: true }); await idle(page);
      const n1 = await nLog(page); const seenFar = await toastSeen(page, new RegExp(`^${TOO_FAR}`)); const seenRoad = await toastSeen(page, new RegExp(`^${ROAD_FIRST}`)); const tt = await toasts(page);
      check('U-far', `a click on node ${far.node} (out of reach) says "${TOO_FAR}", on a Road's sign "${ROAD_FIRST}"; nothing sent`, far.node != null && far.road != null && seenFar && seenRoad && n1 === n0, JSON.stringify({ far, tt, n0, n1 }));
      // the Bell's tip clears the Regions panel (tactician s0183)
      const bell = page.locator('.expmap [data-leave="RING_BELL"]');
      if (await bell.count()) {
        await bell.hover(); await page.waitForTimeout(150);
        const bo = { tip: !!(await tipOn(page)), over: await overSel(page, '.expmap .xside .xpanel') };
        check('U-tips', 'the Bell\'s tip covers none of the map\'s side panels (Regions, the Dimming, Key)', bo.tip && bo.over === 0, JSON.stringify(bo));
        await page.mouse.move(2, 2);
      } else {
        // D152 (changes-m3-v2.md 1.2): zone 1 of a first run has no Bell (mapView.bell.hidden): no button. The Bell's tip
        // over the panels is checked on a later run in part W
        const bh = await page.evaluate(() => { const b = window.__ui.view().zone.exp.bell; return b ? { hidden: !!b.hidden, charges: b.charges } : null; });
        check('D152-bell', 'zone 1 of a first run: no Bell button (mapView.bell hidden)', !!bh && bh.hidden && bh.charges === 0, JSON.stringify(bh));
      }
      // a key puts a tip away: a map node's tip, then B opens the bags over the map
      await page.mouse.move(2, 2);
      const reach = page.locator('.expmap .mnode.reach').first();
      await reach.hover(); await page.waitForTimeout(150);
      const k0 = await tipOn(page);
      await page.keyboard.press('KeyB'); await idle(page);
      const k1 = await tipOn(page);
      check('U-tipkey', 'a map node\'s tip goes when a key is pressed (B opens the bags): none left over the Bags window', !!k0 && !k1 && !!(await page.locator('#win-bags').count()), JSON.stringify({ k0: k0 && k0.split('\n')[0], k1 }));
      await page.keyboard.press('Escape'); await idle(page); await page.mouse.move(2, 2);
      // the run: spoils, chests, level-ups, rewards, the trainer, enemy uids, the log
      let lootDone = null; let chestDone = null; let banner = null; let reward = null; let trainer = null; let logScroll = null;
      const uids = new Map(); const uidClash = [];
      for (let i = 0; i < 420; i++) {
        const s = await sv(page);
        if (s.z >= 2 || s.phase === 'SUMMARY') break;
        if (s.fight) {
          const us = await page.evaluate(() => window.__ui.view().combat.enemies.map((e) => [e.uid, e.name]));
          for (const [u, nm] of us) { if (uids.has(u) && uids.get(u) !== nm) uidClash.push(`${u}: ${uids.get(u)} / ${nm}`); uids.set(u, nm); }
          if (!logScroll && (await page.evaluate(() => document.querySelector('#combatlog .lines').scrollHeight > document.querySelector('#combatlog .lines').clientHeight + 20))) {
            await page.evaluate(() => { document.querySelector('#combatlog .lines').scrollTop = 0; });
            const before = await page.evaluate(() => document.querySelector('#combatlog .lines').children.length);
            await auto(page);
            const after = await page.evaluate(() => { const l = document.querySelector('#combatlog .lines'); return { top: l.scrollTop, n: l.children.length }; });
            logScroll = { before, ...after };
            continue;
          }
        }
        // the spoils (a fight's or a chest's): every gear row offers Equip now; the first one not worn is put on with it
        if (s.loot === 'loot' && ((s.node && s.node.type === 'treasure') ? !chestDone : !lootDone)) {
          const rows = await page.evaluate(() => { const v = window.__ui.view(); const p = v.player; const L = v.loot;
            return (L.items || []).filter((it) => it.kind === 'gear').map((it) => ({ uid: it.uid, name: it.name, worn: !!(p.equip[it.slot] && p.equip[it.slot].uid === it.uid),
              btn: !!document.querySelector(`.loot .lrow[data-uid="${it.uid}"] .eqnow`) })); });
          if (rows.length) {
            const first = rows.find((r) => !r.worn);
            let worn = null;
            if (first) { await page.locator(`.loot .lrow[data-uid="${first.uid}"] .eqnow`).click(); await idle(page); worn = await page.evaluate((u) => Object.values(window.__ui.view().player.equip).some((e) => e && e.uid === u), first.uid); }
            const res = { rows, worn, tag: first ? await page.locator(`.loot .lrow[data-uid="${first.uid}"] .meta`).innerText().catch(() => null) : null };
            if (s.node && s.node.type === 'treasure') chestDone = res; else lootDone = res;
            await shot(page, s.node && s.node.type === 'treasure' ? 'U1-chest' : 'U1-loot');
          }
        }
        if (s.loot === 'reward' && !reward && (await page.locator('.choice-cards .eqnow').count())) {
          const cards = page.locator('.choice-cards .icard'); const nc = await cards.count(); const over = [];
          for (let k = 0; k < nc; k++) { const c = cards.nth(k); const bb = await c.boundingBox(); await page.mouse.move(bb.x + 20, bb.y + bb.height - 12); await page.waitForTimeout(120); over.push(await overSel(page, '.choice-cards .eqnow')); }
          reward = { cards: nc, over }; await shot(page, 'U1-reward'); await page.mouse.move(2, 2);
        }
        if (s.node && s.node.type === 'trainer' && !trainer && (await page.locator('.svc .list .trow').count())) {
          const rows = page.locator('.svc .list .trow'); const nr = await rows.count(); const over = [];
          for (let k = 0; k < nr; k++) { await rows.nth(k).scrollIntoViewIfNeeded(); const bb = await rows.nth(k).boundingBox(); await page.mouse.move(bb.x + 30, bb.y + bb.height - 6); await page.waitForTimeout(120); over.push(await overSel(page, '.svc .list .trow .right')); }
          trainer = { rows: nr, over }; await shot(page, 'U1-trainer'); await page.mouse.move(2, 2);
        }
        const lv = s.level;
        await auto(page);
        if (!banner) {
          const after = await page.evaluate(() => { const v = window.__ui.view(); return { level: v.player ? v.player.level : null, trainer: v.trainer, b2: (document.querySelector('#banner .b2') || {}).textContent || '', on: document.querySelector('#banner').classList.contains('level') }; });
          if (after.level > lv && after.on && after.trainer && ((after.trainer.learn || []).length || (after.trainer.train || []).length)) banner = { ...after, want: trainerWaiting(after.trainer, spellName) };
        }
      }
      check('U-loot', 'the spoils: every gear row has "Equip now"; it puts the item on and the row says "equipped"', !!lootDone && lootDone.rows.every((r) => r.btn || r.worn) && lootDone.worn === true && /equipped/.test(lootDone.tag || ''), JSON.stringify(lootDone));
      check('U-chest', 'a chest\'s spoils: its gear row has "Equip now" and it equips', !!chestDone && chestDone.rows.every((r) => r.btn || r.worn) && chestDone.worn === true, JSON.stringify(chestDone));
      check('U-trainer', 'the level-up banner names what waits at the trainer (R.trainerView after the step)', !!banner && !!banner.want && banner.b2.includes(banner.want), JSON.stringify(banner && { b2: banner.b2, want: banner.want }));
      check('U-tips', 'a reward card\'s tip covers no Equip now (its own or the other card\'s)', !!reward && reward.over.every((x) => x === 0), JSON.stringify(reward));
      check('U-tips', 'a trainer row\'s tip covers no price or Learn (its own row or another)', !trainer || trainer.over.every((x) => x === 0), JSON.stringify(trainer));
      if (!trainer) console.log('      (U1: no trainer visit on this seed: the trainer rows are checked in U5)');
      check('U-portrait', `enemy uids (the target frame's portrait key) name one enemy each across the zone's fights (${uids.size} uids)`, uids.size > 4 && !uidClash.length, uidClash.slice(0, 4).join(' | '));
      check('U-log', 'the combat log scrolled up stays where it is while new lines come', !!logScroll && logScroll.top === 0 && logScroll.n > logScroll.before, JSON.stringify(logScroll));
    } catch (e) { await shot(page, 'U1-error'); check('U-1', 'part U1 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('U-1', 'part U1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- U2: the dungeon (seed 5)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant&prep=1');
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const trash = R.C.EXPED_DUNGEON_TRASH_FIGHTS; const words = ['No', 'One', 'Two', 'Three', 'Four'];
      let mapTip = null; let entry = null; let between = null; let boss = null; let ration = null;
      for (let i = 0; i < 400; i++) {
        const s = await sv(page);
        if (s.z >= 2 || s.phase === 'SUMMARY' || (between && boss)) break;
        if (s.phase === 'MAP' && !s.loot && !mapTip) {
          const d = await page.evaluate(() => { const mv = window.__ui.view().zone.exp; const n = mv.nodes.find((x) => x.type === 'dungeon' && x.know === 'full' && x.fights && x.fights.length); return n ? { id: n.id, fights: n.fights.length } : null; });
          if (d) { const el = page.locator(`.expmap .mnode[data-node="${d.id}"]`); await el.hover({ force: true }); await page.waitForTimeout(150); mapTip = { ...d, tip: await tipOn(page) }; await page.mouse.move(2, 2); }
        }
        if (s.node && s.node.type === 'dungeon' && s.node.step === 'intro' && !entry) entry = { trash: s.node.trash, text: await page.locator('#screens .dialog').innerText() };
        if (s.node && s.node.type === 'dungeon' && s.fight && !s.loot) {
          const tr = await page.evaluate(() => document.querySelector('#tracker').innerText);
          if (s.node.fightNo === trash + 1 && !boss) boss = { tracker: tr };
          else if (!entry || !entry.tracker) entry = { ...(entry || {}), tracker: tr };
        }
        if (s.node && s.node.type === 'dungeon' && s.node.step === 'between' && !s.loot && !between) {
          between = { sub: await page.locator('#screens .dialog .subtitle').first().innerText().catch(() => ''), fightNo: s.node.fightNo };
          // a ration eaten here: the panel shows it (loaded: health at half)
          const st = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
          if (!st.player.bag.some((x) => x.id === 'trail_rations')) { st.player.bag.push({ uid: 'u-test-ration', kind: 'cons', id: 'trail_rations', qty: 2 }); }
          st.player.hp = Math.floor(st.player.d.maxHp / 2);
          await page.evaluate((x) => window.__ui.loadState(x), R.serialize(st)); await idle(page);
          const eat = page.locator('#screens .dialog').getByRole('button', { name: /^Eat Trail Rations/ });
          const label0 = await eat.innerText();
          await eat.click(); await idle(page);
          const after = await page.evaluate(() => { const v = window.__ui.view(); const r = v.player.bag.find((x) => x && x.id === 'trail_rations'); return { hp: v.player.hp, max: v.player.maxHp, left: r ? r.count : 0, text: document.querySelector('#screens .dialog').innerText }; });
          ration = { label0, ...after, ok: after.text.includes(`Health ${after.hp.toLocaleString('en-US')} / ${after.max.toLocaleString('en-US')}`) && (after.left ? after.text.includes(`Eat Trail Rations (${after.left})`) : !/Eat Trail Rations/.test(after.text)) };
          await shot(page, 'U2-between');
        }
        await auto(page);
      }
      check('U-dungeon', `the map tooltip of a dungeon says "${words[mapTip ? mapTip.fights : trash]} fights and a dungeon boss" (its own fights)`, !!mapTip && mapTip.tip.includes(`${words[mapTip.fights]} fights and a dungeon boss`), JSON.stringify(mapTip));
      check('U-dungeon', `the dungeon's entry: "${trash} groups, then ..." (EXPED_DUNGEON_TRASH_FIGHTS); the tracker "Fight 1 of ${trash + 1}"`, !!entry && entry.trash === trash && new RegExp(`${trash} groups, then`).test(entry.text) && new RegExp(`Fight 1 of ${trash + 1}`).test(entry.tracker || ''), JSON.stringify(entry));
      check('U-dungeon', `between fights "Fight N of ${trash + 1} cleared"; the boss is "Fight ${trash + 1} of ${trash + 1}"`, !!between && new RegExp(`Fight ${between.fightNo} of ${trash + 1} cleared`).test(between.sub) && (!boss || new RegExp(`Fight ${trash + 1} of ${trash + 1}:`).test(boss.tracker)), JSON.stringify({ between, boss }));
      check('U-rest', 'the panel between fights shows a ration eaten there: health and the rations left', !!ration && ration.ok, JSON.stringify(ration));
    } catch (e) { await shot(page, 'U2-error'); check('U-2', 'part U2 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('U-2', 'part U2: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- U3: full bags (loaded states)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1');
    try {
      await watch(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 40 && (await sv(page)).phase !== 'MAP'; i++) await auto(page);
      const base = await page.evaluate(() => window.__ui.state());
      const junk = (k) => ({ uid: `u-junk-${k}`, kind: 'junk', name: 'Cracked Hoof', qty: 1, value: 1 });
      // one slot free, then the chest piece taken off: the bags fill and say so
      const s1 = R.deserialize(base, CONTENT); while (s1.player.bag.length < R.C.BAG_SLOTS - 1) s1.player.bag.push(junk(s1.player.bag.length));
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s1)); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'UNEQUIP', slot: 'chest' })); await idle(page);
      const full = await page.evaluate(() => window.__ui.view().player.bag.every(Boolean));
      // blind Legacy v2 (2026-11-20): one sentence for full bags (ui-text.js BAGS_FULL, draft)
      const seen = await toastSeen(page, /^Your bags are full: equip, sell or discard something \(B\)\./); const logged = (await logLines(page)).includes(BAGS_FULL);
      check('U-full', `the step that fills the last bag slot warns at once ("${BAGS_FULL}" as a toast and a log line)`, full && seen && logged, JSON.stringify({ full, logged, tt: await toasts(page) }));
      // an item waiting in the loot window with the bags full: "Equip now" on its row; Leave asks first, then drops it
      const s2 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const worn = Object.values(s2.player.equipped).find(Boolean);
      s2.loot = [{ ...JSON.parse(JSON.stringify(worn)), uid: 'u-test-loot', name: `${worn.name} (spare)` }];
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s2)); await idle(page);
      const eq = await page.locator('.loot .lrow[data-uid="u-test-loot"] .eqnow').count();
      const n0 = await nLog(page);
      await page.locator('.loot .foot').getByRole('button', { name: 'Leave' }).click(); await idle(page);
      const ask = await page.locator('.loot .foot .lleave').innerText().catch(() => null); const n1 = await nLog(page);
      await page.locator('.loot .foot').getByRole('button', { name: 'Leave' }).click(); await idle(page);
      const log = await page.evaluate(() => window.__ui.engineLog()); const gone = await page.evaluate(() => !window.__ui.view().loot);
      await shot(page, 'U3-leave');
      check('U-full', 'an item waiting in the loot window (bags full): its row has "Equip now"; Leave asks ("Leave 1 item behind?") and sends nothing; a second Leave drops it', eq === 1 && /Leave 1 item behind\?/.test(ask || '') && n1 === n0 && log.slice(n1).some((a) => a.type === 'LOOT_DROP') && gone, JSON.stringify({ eq, ask, n0, n1, sent: log.slice(n1).map((a) => a.type), gone }));
    } catch (e) { await shot(page, 'U3-error'); check('U-3', 'part U3 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('U-3', 'part U3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- U4: autoplay stops (a rescue in the guided run; a fight in the Dimming)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await watch(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 120; i++) { const v = await view(page); if (v.round >= 2 && !v.over && v.step === 'combat') break; await auto(page); }
      // loaded: 1 health against enemies autoplay cannot beat in time, so the hero falls on autoplay and is rescued
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); s0.player.hp = 1;
      for (const e of s0.fight.enemies) { e.hp = 9999; e.maxHp = 9999; }
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      await page.locator('#actionbar .toggle').click();
      await page.waitForFunction(() => { const v = window.__ui.view(); return !(v.combat && !v.combat.over); }, null, { timeout: 15000 }).catch(() => null);
      await idle(page); await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const v = window.__ui.view(); return { autoplay: v.autoplay, rescues: v.tutorial ? v.tutorial.rescues : null, own: window.__ui.ownActions().filter((a) => a.type === 'SET_AUTOPLAY') }; });
      const ban = await page.evaluate(() => { const b = document.querySelector('#banner'); const r = [...b.children].filter((c) => c.textContent).map((c) => c.getBoundingClientRect());
        const ps = [...document.querySelectorAll('#screens .panel, #screens .mapwin')].map((m) => m.getBoundingClientRect()).filter((q) => q.width > 0);
        return { cls: b.className, text: b.querySelector('.b1').textContent, panels: ps.length, meets: ps.some((q) => r.some((a) => a.left < q.right && a.right > q.left && a.top < q.bottom && a.bottom > q.top)) }; });
      await shot(page, 'U4-rescue');
      const said = await toastSeen(page, /^Autoplay off after your death\.$/);
      check('U-auto', 'after a rescue autoplay is off (an own SET_AUTOPLAY), with "Autoplay off after your death."', r.rescues >= 1 && r.autoplay === false && r.own.length === 1 && said, JSON.stringify({ r, t: await toasts(page) }));
      check('U-banner', 'the rescue banner keeps clear of the screen\'s panel it lands on (the hub here; the zone map: a side column)', /\brescue\b/.test(ban.cls) && ban.panels > 0 && !ban.meets, JSON.stringify(ban));
    } catch (e) { await shot(page, 'U4-error'); check('U-4', 'part U4 (rescue) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('U-4', 'part U4 (rescue): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1');
    try {
      await watch(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 40 && (await sv(page)).phase !== 'MAP'; i++) await auto(page);
      // the zone's clock moved on until a node next to the player is Dimmed (loaded: zone.start earlier)
      let dimNode = null;
      for (const back of [8, 9, 10, 11, 12, 13, 14, 16, 18]) {
        const st = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); st.zone.start -= back;
        const mv = R.mapView(st); const me = mv.nodes[mv.pos];
        if (me && me.dimmed) continue;
        const m = mv.moves.find((x) => mv.nodes[x.nodeId].dimmed);
        if (m) { await page.evaluate((x) => window.__ui.loadState(x), R.serialize(st)); await idle(page); dimNode = m.nodeId; break; }
      }
      await page.keyboard.press('KeyZ'); await idle(page);
      const on = (await sv(page)).autoplay;
      await page.locator(`.expmap .mnode[data-node="${dimNode}"]`).click({ force: true }); await idle(page);
      const r = await page.evaluate(() => { const v = window.__ui.view(); return { node: v.node && v.node.type, fight: !!(v.combat && !v.combat.over), autoplay: v.autoplay, round: v.combat ? v.combat.round : null }; });
      await page.waitForTimeout(400);
      const r2 = await page.evaluate(() => { const v = window.__ui.view(); return { round: v.combat ? v.combat.round : null }; });
      const said = await toastSeen(page, /^Autoplay off: a fight in the Dimming\.$/);
      await shot(page, 'U4-dim');
      check('U-auto', 'a fight in the Dimming switches autoplay off at its start, with "Autoplay off: a fight in the Dimming."; nothing is played for the player', dimNode != null && on && r.node === 'dim' && r.fight && !r.autoplay && r2.round === r.round && said, JSON.stringify({ dimNode, on, r, r2, t: await toasts(page) }));
    } catch (e) { await shot(page, 'U4-error-dim'); check('U-4', 'part U4 (Dimming) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('U-4', 'part U4 (Dimming): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- U5: four enemies, the skip line, talents, companions, the trainer rows, the guide's Skip, a Road's sign
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1');
    try {
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      const pets = page.locator('#create .pet'); const np = await pets.count(); const pov = [];
      for (let k = 0; k < np; k++) { await pets.nth(k).hover(); await page.waitForTimeout(120); pov.push(await overSel(page, `#create .pet:not(:nth-child(${k + 1}))`)); }
      check('U-tips', `a companion's tip covers none of the ${np} companion cards`, np >= 2 && pov.every((x) => x === 0), JSON.stringify(pov));
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      // the trainer's rows (a Dev menu build: level 8 in zone 1, gold given; the trainer opened from the hub card)
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 1, level: 8 })); await idle(page);
      for (let i = 0; i < 40 && (await sv(page)).phase !== 'ZONE_HUB'; i++) await auto(page);
      // loaded: one spell of the build unlearned (not on the bar) and another a rank behind, so lessons wait
      const sb = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const known = Object.keys(sb.player.spells).filter((id) => R.C.SPELL[id] && R.C.SPELL[id].lvl > 1);
      const off = known.find((id) => !sb.player.bar.includes(id)) || known[known.length - 1];
      if (off) { delete sb.player.spells[off]; sb.player.spellOrder = sb.player.spellOrder.filter((x) => x !== off); sb.player.bar = sb.player.bar.map((x) => (x === off ? null : x)); }
      const behind = known.find((id) => id !== off); if (behind) sb.player.spells[behind].tl = 1;
      sb.player.gold += 50000;
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(sb)); await idle(page);
      const card = await page.evaluate(() => { const c = [...document.querySelectorAll('#screens .svc-card')].find((x) => /Trainer/.test(x.textContent)); return c ? { waiting: c.classList.contains('waiting'), meta: c.querySelector('.meta').textContent, t: window.__ui.view().trainer } : null; });
      check('U-trainer', 'the hub Trainer card while a new spell waits: highlighted, "Waiting: N new spells, M ranks" (R.trainerView)', !!card && card.waiting && card.meta === trainerWaitingShort(card.t), JSON.stringify(card && { waiting: card.waiting, meta: card.meta }));
      await shot(page, 'U5-hub');
      await page.locator('#screens .svc-card', { hasText: 'Trainer' }).click().catch(() => null); await idle(page);
      const rows = page.locator('.svc .list .trow'); const nr = await rows.count(); const tov = [];
      for (let k = 0; k < nr; k++) { await rows.nth(k).scrollIntoViewIfNeeded(); const bb = await rows.nth(k).boundingBox(); await page.mouse.move(bb.x + 30, bb.y + bb.height - 6); await page.waitForTimeout(120); tov.push(await overSel(page, '.svc .list .trow .right')); }
      check('U-tips', `a trainer row's tip covers no row's price or Learn (${nr} rows)`, nr > 0 && tov.every((x) => x === 0), JSON.stringify(tov));
      await page.mouse.move(2, 2);
      await page.locator('.svc').getByRole('button', { name: 'Done' }).click().catch(() => null); await idle(page);
      // the talent window: a talent's tip clears its rank counter
      await page.keyboard.press('KeyN'); await idle(page);
      const tal = page.locator('#win-talents .tal').first(); await tal.hover(); await page.waitForTimeout(150);
      const rk = await page.evaluate(() => { const t = document.querySelector('.tooltip.on'); const k = document.querySelector('#win-talents .tal .rk'); if (!t || !k) return null; const a = t.getBoundingClientRect(); const b = k.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; });
      check('U-tips', 'a talent\'s tip does not cover its rank counter', rk === false, String(rk));
      await page.keyboard.press('Escape'); await page.mouse.move(2, 2); await idle(page);
      // four enemies (Dev menu fight): the plates' chips and names clear of each other, no name cut
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z1_stonewall_sentinel', 'z1_hedgerow_cutpurse', 'z1_scarecrow_hexer', 'z1_bramble_herbalist'], level: 12 })); await idle(page);
      await page.keyboard.press('KeyQ'); await idle(page);
      // the enemies walk in: read once the plates stand still (two reads 200 ms apart, at most 4 s)
      const lefts = () => page.evaluate(() => [...document.querySelectorAll('#nameplates .np:not(.dead)')].map((p) => Math.round(p.getBoundingClientRect().left)).join(','));
      for (let i = 0, a = await lefts(); i < 20; i++) { await page.waitForTimeout(200); const b2 = await lefts(); if (b2 === a) break; a = b2; }
      const four = await page.evaluate(() => {
        const plates = [...document.querySelectorAll('#nameplates .np:not(.dead)')];
        const boxes = plates.map((p) => [...p.querySelectorAll('.trk .tk, .nm')].filter((x) => x.getClientRects().length && getComputedStyle(x).display !== 'none').map((x) => x.getBoundingClientRect()));
        let hits = 0;
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) for (const a of boxes[i]) for (const b of boxes[j]) if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) hits++;
        const cut = [...document.querySelectorAll('#nameplates .np:not(.dead) .nm .n')].filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent);
        return { plates: plates.length, tight: document.querySelector('#nameplates').classList.contains('tight'), hits, cut };
      });
      const skip = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#skiphint')); return { bg: cs.backgroundColor, color: cs.color }; });
      await shot(page, 'U5-four');
      check('U-four', 'four enemies: no plate\'s chips or name over another plate\'s; no name cut', four.plates === 4 && four.tight && four.hits === 0 && !four.cut.length, JSON.stringify(four));
      check('U-skip', '"Space or click to skip" sits on a dark backing', /rgba\(12, 9, 6/.test(skip.bg), JSON.stringify(skip));
    } catch (e) { await shot(page, 'U5-error'); check('U-5', 'part U5 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('U-5', 'part U5: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      // D152: a first run's camp has no beat line (no board, G1 closed): the first one comes at the hub (G5)
      for (let i = 0; i < 20 && ((await page.evaluate(() => window.__ui.coach().shown)) || {}).kind !== 'beat'; i++) await auto(page);
      const c0 = await page.evaluate(() => window.__ui.coach().shown);
      const ph0 = await page.evaluate(() => window.__ui.view().phase);
      await page.locator('#coach .co-skip').click(); await idle(page);
      await page.locator('#coach .co-skip').click(); await idle(page);
      const r = await page.evaluate(() => ({ skipped: !!(window.__ui.view().tutorial && window.__ui.view().tutorial.skipped), shown: window.__ui.coach().shown, phase: window.__ui.view().phase }));
      check('U-skipguide', `the guide's Skip: "Skip guide", then one confirm; no first-time hint for the line just skipped (${c0 && c0.id}) on that screen`, !!c0 && c0.kind === 'beat' && r.skipped && !(r.shown && r.shown.kind === 'hint' && r.phase === ph0), JSON.stringify({ c0, ph0, r }));
      // after the skip, hints on: one line at a time, each hint at most ONB_HINT_SHOWS times (60 steps, Got it on each)
      for (let i = 0; i < 60; i++) { if ((await page.evaluate(() => window.__ui.coach().shown))) { await page.locator('#coach .co-ok').click().catch(() => null); await idle(page); } await auto(page); }
      const lg = await page.evaluate(() => window.__ui.coach().log.filter((x) => x.kind === 'hint'));
      const per = {}; for (const x of lg) per[x.id] = (per[x.id] || 0) + 1;
      check('U-skipguide', `after the skip (hints on), each first-time hint shows at most ${ONB_HINT_SHOWS} times (${lg.length} lines)`, lg.length > 0 && Object.values(per).every((n) => n <= ONB_HINT_SHOWS), JSON.stringify(per));
    } catch (e) { check('U-5', 'part U5 (skip) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('U-5', 'part U5 (skip): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=11&speed=instant&prep=1');
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 40 && (await sv(page)).phase !== 'MAP'; i++) await auto(page);
      await page.mouse.move(2, 2); await page.waitForTimeout(600);
      const ov = await page.evaluate(() => { const d = document.querySelector('#screens .xdisc'); const rings = [...d.querySelectorAll(':scope > .mnode .ring')].map((x) => x.getBoundingClientRect());
        return [...d.querySelectorAll(':scope > .xroad')].map((s) => { const a = s.getBoundingClientRect(); return { road: s.textContent, on: rings.filter((b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1).length }; }); });
      await shot(page, 'U5-roads');
      check('U-maplabels', 'seed 11\'s first map: no Road sign over a node (it moves out along its angle)', ov.length > 0 && ov.every((x) => x.on === 0), JSON.stringify(ov));
    } catch (e) { check('U-5', 'part U5 (roads) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('U-5', 'part U5 (roads): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part V: blind round 2 leftovers (ui-2026-11-14e 2.3)
/**
 * Part V (docs/handoffs/ui-2026-11-14f.md): the six UI leftovers of blind round 2. V1 Packed Satchel's potions reach the item
 * bar (a Mage and a Rogue with the unlock: the run's first step out of the camp puts them on); V2 the hub vendor's gear is in
 * view and its card says what it sells; V3 the trainer numbers spells by rank only; V4 Tab leaves one ring, under the new
 * target; V5 the gaps an equip leaves stay while the bags are open and close up when they close; V6 a closed chest's gold is
 * not in the purse (or the log) before "Open the chest".
 */
async function partV(browser, W, H) {
  // the purse's money element (gold, silver, copper as digits on their own lines) as copper
  const moneyNum = (t) => { const p = String(t).replace(/,/g, '').split(/\s+/).filter(Boolean).map(Number); return p.reduce((a, x) => a * 100 + x, 0); };
  const auto = async (page) => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };
  const later = { ...R.newProfile(), runs: 2, guide: 'done', welcome: true, unlocks: { satchel: 1 } };
  // ---- V1: Packed Satchel's potions on the item bar (Mage and Rogue)
  for (const cls of ['mage', 'rogue']) {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1', later);
    try {
      await page.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const camp = await view(page);
      await page.locator('#pp-go').click(); await idle(page);
      for (let i = 0; i < 4 && (await view(page)).phase === 'PREP'; i++) { const ok = page.getByRole('button', { name: /^(Set out|Leave)/ }).last(); if (await ok.count()) await ok.click(); await idle(page); }
      const hub = await view(page);
      const own = await page.evaluate(() => window.__ui.ownActions().filter((a) => a.type === 'SET_ITEM_BAR'));
      const draughts = camp.bag.filter((b) => b && b.id === 'healing_draught').reduce((a, b) => a + (b.count || 0), 0);
      check('V-satchel', `${cls}: Packed Satchel's ${draughts} Healing Draughts (in the bags from the start) go on the item bar when the hero leaves the camp (one SET_ITEM_BAR of the UI's own)`,
        draughts === R.C.META.satchel.potions && hub.phase === 'ZONE_HUB' && hub.itemBar.includes('healing_draught') && own.some((a) => a.itemId === 'healing_draught'), JSON.stringify({ draughts, phase: hub.phase, bar: hub.itemBar, own }));
    } catch (e) { await shot(page, `V1-${cls}-error`); check('V-1', `part V1 (${cls}) ran to the end`, false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('V-1', `part V1 (${cls}): no console errors`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- V2-V6: one Rogue run (seed 7, a later-run profile)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1', { ...later, unlocks: {} });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 20 && (await view(page)).phase !== 'ZONE_HUB'; i++) await auto(page);
      // V2: the hub's Vendor card and the vendor's stock: every gear row in view, the card's line names what is sold
      const card = await page.locator('#screens .svc-card', { has: page.locator('.nm', { hasText: 'Vendor' }) }).locator('.meta').innerText();
      await page.locator('#screens .svc-card', { has: page.locator('.nm', { hasText: 'Vendor' }) }).click(); await idle(page);
      const vs = await page.evaluate(() => {
        const v = window.__ui.view(); const list = document.querySelector('.vendor-cols > div:nth-child(1) .list'); const lr = list.getBoundingClientRect();
        const rows = [...list.querySelectorAll('.trow')].map((r) => { const b = r.getBoundingClientRect(); return { i: Number(r.dataset.i), name: r.querySelector('.nm').textContent, inView: b.top >= lr.top - 0.5 && b.bottom <= lr.bottom + 0.5 }; });
        return { rows, stock: (v.node.stock || []).map((x) => ({ kind: x.kind, name: x.name })) };
      });
      const gear = vs.stock.map((x, i) => [x, i]).filter(([x]) => x.kind === 'gear');
      check('V-vendor', `the hub Vendor card says "${card}" and the vendor sells ${gear.length} pieces of gear: each gear row is in view without scrolling, each row's data-i names its stock entry`,
        gear.length > 0 && card === vendorMeta({ hub: { gearLeft: gear.length } }) && /gear/.test(card) && gear.every(([x, i]) => vs.rows.some((r) => r.i === i && r.name === x.name && r.inView)) && vs.rows.every((r) => vs.stock[r.i] && vs.stock[r.i].name === r.name),
        JSON.stringify({ card, vs }));
      await shot(page, 'V2-vendor');
      // buy every piece of gear (gold loaded), leave: the card then says the gear is gone
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); s0.player.gold = 5000000;
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      for (const [, i] of gear) { await page.locator(`.vendor-cols > div:nth-child(1) .trow[data-i="${i}"]`).getByRole('button', { name: 'Buy' }).click(); await idle(page); }
      await page.locator('.svc').getByRole('button', { name: 'Done' }).click(); await idle(page);
      // the card says "Used this visit" until the hub is visited again: loaded with the visit's services unused
      const s2 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); if (s2.hub) s2.hub.used = {};
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s2)); await idle(page);
      const card2 = await page.locator('#screens .svc-card', { has: page.locator('.nm', { hasText: 'Vendor' }) }).locator('.meta').innerText();
      check('V-vendor', `with the gear bought, the card says "${vendorMeta({ hub: { gearLeft: 0 } })}"`, card2 === vendorMeta({ hub: { gearLeft: 0 } }), card2);
      // V5: the bags: an equip leaves a gap while open (the next item stays under the pointer); closed and opened: compact
      const bagIds = async () => page.evaluate(() => [...document.querySelectorAll('#win-bags .baggrid .slot')].map((e) => e.dataset.uid || null));
      await page.getByRole('button', { name: 'Bags' }).click(); await idle(page);
      const b0 = await bagIds();
      const gearUids = await page.evaluate(() => window.__ui.view().player.bag.filter((x) => x && x.kind === 'gear').map((x) => x.uid));
      const first = gearUids[0]; const last = gearUids[gearUids.length - 1];
      const at0 = b0.indexOf(last);
      await page.locator(`#win-bags .baggrid .slot[data-uid="${first}"]`).click({ button: 'right' }); await idle(page);
      const b1 = await bagIds();
      const gone = !(await page.evaluate((u) => window.__ui.view().player.bag.some((x) => x && x.uid === u), first));
      await page.keyboard.press('KeyB'); await idle(page);
      await page.keyboard.press('KeyB'); await idle(page);
      const b2 = await bagIds();
      const filled = b2.filter(Boolean).length; const compact = b2.slice(0, filled).every(Boolean);
      check('V-bags', `an equip from the bags (${gearUids.length} gear pieces): its slot stays empty while the bags are open, the last piece stays in slot ${at0}; closed and opened again the bags are compact`,
        gearUids.length >= 2 && gone && b1.indexOf(first) < 0 && b1.indexOf(last) === at0 && b1.slice(0, b1.filter(Boolean).length).some((x) => !x) && compact,
        JSON.stringify({ b0, b1, b2, at0 }));
      await page.keyboard.press('Escape'); await idle(page);
      // V3: the trainer at level 4: rank only ("Train to rank N", "Rank N"), no "level N" on a known spell's row
      const s3 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      s3.player.level = 4; s3.player.gold = 5000000; if (s3.hub && s3.hub.used) s3.hub.used = {};
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s3)); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'HUB_SERVICE', service: 'trainer' })); await idle(page);
      const trRows = () => page.evaluate(() => { const known = window.__ui.view().player.spells; return [...document.querySelectorAll('.svc .list .trow')].map((r) => {
        const nm = r.querySelector('.nm').textContent; const k = known.find((x) => (window.__ui.view().legal.trainer || []).some((e) => e.id === x.id && e.name === nm));
        return { nm, right: r.querySelector('.right').innerText.replace(/\s+/g, ' ').trim(), rank: k ? k.rank : null }; }); });
      const t0 = await trRows();
      const trainable = t0.filter((r) => /Train/.test(r.right));
      const tr0 = trainable[0];
      if (tr0) { await page.locator('.svc .list .trow', { has: page.locator('.nm', { hasText: new RegExp(`^${tr0.nm}$`) }) }).getByRole('button', { name: /^Train to/ }).click(); await idle(page); }
      const t1 = await trRows();
      const after = tr0 ? t1.find((r) => r.nm === tr0.nm) : null;
      check('V-trainer', `the trainer numbers known spells by rank only: "Train to rank N+1" on ${trainable.length} rows, "Rank N" after training; no "level" on a known spell's row`,
        trainable.length > 0 && trainable.every((r) => r.rank != null && r.right.endsWith(`Train to rank ${r.rank + 1}`)) && !!after && after.right === `Rank ${tr0.rank + 1}` && t1.filter((r) => r.rank != null).every((r) => !/level/i.test(r.right)),
        JSON.stringify({ t0, t1 }));
      await shot(page, 'V3-trainer');
      await page.locator('.svc').getByRole('button', { name: 'Done' }).click(); await idle(page);
      // V6: a closed chest: its gold is not in the purse or the log before "Open the chest"
      let chest = null;
      for (let i = 0; i < 300 && !chest; i++) {
        const v = await page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, z: v.zone && v.zone.idx, type: v.node && v.node.type, step: v.node && v.node.step, gold: v.player && v.player.gold }; });
        if (v.phase === 'SUMMARY' || v.z >= 2) break;
        if (v.type === 'treasure' && v.step === 'chest') {
          const purse = await page.locator('#hud .goldline, .goldline').first().innerText();
          const st = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
          const before = await logLines(page);
          await page.getByRole('button', { name: 'Open the chest' }).click(); await idle(page);
          const o = await page.evaluate(() => { const v = window.__ui.view(); return { gold: v.player.gold, loot: v.loot ? v.loot.gold : null }; });
          const purse2 = await page.locator('.goldline').first().innerText();
          const lines = await logLines(page);
          const line = `You receive ${o.loot != null ? moneyTxt(o.loot) : '?'}.`;
          chest = { closed: v.gold, engine: st.player.gold, purse, logged: before.slice(-3).includes(line), opened: o, purse2, line: lines.slice(-4).includes(line) ? line : null };
          break;
        }
        await auto(page);
      }
      check('V-chest', 'a closed chest: the purse shows the gold before it (engine gold minus the chest\'s); "Open the chest" adds it, with its log line',
        !!chest && chest.opened.loot > 0 && chest.closed === chest.engine - chest.opened.loot && chest.opened.gold === chest.engine && !chest.logged && !!chest.line && moneyNum(chest.purse) === chest.closed && moneyNum(chest.purse2) === chest.engine,
        JSON.stringify(chest));
    } catch (e) { await shot(page, 'V2-error'); check('V-2', 'part V2-V6 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('V-2', 'part V2-V6: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- V4: Tab with the pointer on the old target: one ring, under the new target
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2 })); await idle(page);
      const foes = R.debug.enemies(CONTENT).filter((x) => x.zone === 2 && x.kind === 'normal').slice(0, 2).map((x) => x.id);
      await page.evaluate((ids) => window.__ui.dev('fight', { ids }), foes); await idle(page);
      const t0 = await page.evaluate(() => window.__ui.target());
      // the pointer on the target's nameplate (as on its body: the hover ring), then Tab
      const plate = page.locator(`#nameplates .np[data-idx="${t0}"]`); await plate.hover(); await page.waitForTimeout(120);
      const r0 = await page.evaluate(() => window.__ui.rings());
      await page.keyboard.press('Tab'); await idle(page); await page.waitForTimeout(80);
      const t1 = await page.evaluate(() => window.__ui.target());
      const r1 = await page.evaluate(() => window.__ui.rings());
      await page.mouse.move(2, 2); await plate.hover(); await page.waitForTimeout(120);
      const r2 = await page.evaluate(() => window.__ui.rings());
      check('V-tab', `Tab with the pointer on the target (enemy ${t0}): one ring after it, the red one under the new target (enemy ${t1}); the hover ring comes back when the pointer moves`,
        t1 !== t0 && r1.length === 1 && r1[0].id === `enemy:${t1}` && r1[0].sel && r2.some((r) => r.id === `enemy:${t0}` && !r.sel), JSON.stringify({ t0, t1, r0, r1, r2 }));
      await shot(page, 'V4-tab');
    } catch (e) { await shot(page, 'V4-error'); check('V-4', 'part V4 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('V-4', 'part V4: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part W: D152, the UI of changes-m3-v2
/**
 * Part W (docs/specs/changes-m3-v2.md; docs/handoffs/engine-2026-11-14f.md section 6; docs/handoffs/ui-2026-11-14f.md):
 * W1 a guided first run (seed 8736): zone 1's map with no Bell button, no contract tracker or site marks, the held
 * corridor's lamp on every held node but the hub (mapView `held`) with content guide.holdLine in its tooltip, the steady
 * Dimming's panel ("Starts to spread in N tolls", "{count} of {total} places Dimmed") and its tooltip line (texts
 * dimming_pace), no contract hint (H20-H23); then a rescue with most of the zone dark (loaded: dimShift back): the dimBack
 * line (guide.dimBackLine) in the log. W2 a first run with the guide off, ended by a death: the summary's Echo line for
 * unspent camp points reads prep.unspentLabel, no Contracts row, no "Reserve". W3 a later run (runs 2): the Bell in zone 1,
 * its tooltip clear of the map's side panels, the tracker. W4 a zone 2 hub of a first run (Dev menu): no contract card.
 * Gorrak's bounty window is checked in part R (the guided route wins his fight).
 */
async function partW(browser, W, H) {
  const auto = async (page) => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };
  const T = CONTENT.tutorial;
  // ---- W1
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 40 && !(await page.evaluate(() => { const v = window.__ui.view(); return v.phase === 'MAP' && !v.node && !v.loot; })); i++) await auto(page);
      await page.mouse.move(2, 2); await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const v = window.__ui.view(); const mv = v.zone.exp;
        return { bell: mv.bell, bellBtn: document.querySelectorAll('#screens [data-leave="RING_BELL"]').length, contracts: v.contracts, tracker: document.querySelectorAll('#tracker .tk-c, #tracker [data-contract]').length,
          sites: document.querySelectorAll('#screens .mnode .xsite').length, dim: mv.dim, held: mv.nodes.filter((n) => n.held && !n.hub).map((n) => n.id).sort((a, b) => a - b),
          lamps: [...document.querySelectorAll('#screens .mnode .xheld')].map((e) => Number(e.closest('.mnode').dataset.node)).sort((a, b) => a - b),
          heldClock: mv.nodes.filter((n) => n.held).filter((n) => document.querySelector(`#screens .mnode[data-node="${n.id}"] .xclock`)).length,
          panel: [...document.querySelectorAll('#screens .xdimp .xpl')].map((e) => e.textContent), texts: mv.texts };
      });
      check('D152-bell', 'zone 1 of a first run: no Bell button (mapView.bell hidden, no charge shown)', m.bell && m.bell.hidden && m.bellBtn === 0, JSON.stringify({ bell: m.bell, btn: m.bellBtn }));
      check('D152-contracts', 'a first run: R.contractView null, no tracker contract line, no site marks on the map', m.contracts === null && m.tracker === 0 && m.sites === 0, JSON.stringify({ c: m.contracts, tracker: m.tracker, sites: m.sites }));
      check('D152-held', `the held corridor: a lamp on each held node but the hub (${m.held.join(', ')}), no "dims in" chip on a held node`, m.held.length > 0 && JSON.stringify(m.lamps) === JSON.stringify(m.held) && m.heldClock === 0, JSON.stringify({ held: m.held, lamps: m.lamps, heldClock: m.heldClock }));
      const pw = (dm) => [dm.count ? `Spreads in ${tolls(dm.nextIn)}: ${dm.nextCount} ${dm.nextCount === 1 ? 'place' : 'places'}` : `Starts to spread in ${tolls(dm.nextIn)}`, `${dm.count} of ${dm.total} places Dimmed`];
      const want = pw(m.dim);
      check('D152-dim', `the Dimming panel (steady): "${want.join('" / "')}" (mapView.dim); no "dims in" line for a held node`, m.dim.steady && m.panel[0] === want[0] && m.panel[m.panel.length - 1] === want[1] && !m.panel.some((x) => /Your node dims in 0/.test(x)), JSON.stringify(m.panel));
      const lamp = m.held.find((id) => id != null);
      await page.locator(`#screens .mnode[data-node="${lamp}"]`).hover({ force: true }); await page.waitForTimeout(150);
      const ltip = await page.evaluate(() => { const t = document.querySelector('.tooltip.on'); return t ? t.innerText : null; });
      await page.locator('#screens .xdimp').hover(); await page.waitForTimeout(150);
      const dtip = await page.evaluate(() => { const t = document.querySelector('.tooltip.on'); return t ? t.innerText : null; });
      await page.mouse.move(2, 2);
      const pace = m.texts.dimming_pace.replace('{maxPerToll}', String(m.dim.maxPerToll)).replace('{grace}', String(m.dim.grace));
      check('D152-held', `a held node's tooltip: "${T.guide.holdLine}"`, !!ltip && ltip.includes(T.guide.holdLine), ltip);
      check('D152-dim', `the Dimming's tooltip: "${pace}", not the hops rule`, !!dtip && dtip.includes(pace) && !/hops every/.test(dtip), dtip);
      await shot(page, 'W1-map');
      // a rescue with most of the zone dark (loaded: the Dimming's clock moved on): the Dimming falls back, the dimBack line
      for (let i = 0; i < 120; i++) { const v = await view(page); if (v.round >= 2 && !v.over && v.step === 'combat') break; await auto(page); }
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      s0.player.hp = 1; s0.zone.dimShift = (s0.zone.dimShift || 0) - 80;
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      const before = await page.evaluate(() => window.__ui.view().zone.exp.nodes.filter((n) => n.dimmed).length);
      for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyX'); await idle(page); const r = await page.evaluate(() => window.__ui.view().tutorial.rescues); if (r > s0.tutorial.rescues) break; }
      const after = await page.evaluate(() => ({ dimmed: window.__ui.view().zone.exp.nodes.filter((n) => n.dimmed).length, total: window.__ui.view().zone.exp.nodes.length, rescues: window.__ui.view().tutorial.rescues }));
      const lines = await logLines(page);
      check('D152-dimback', `a rescue with ${before} of ${after.total} places Dimmed: the Dimming falls back to ${after.dimmed} (at most half); the log says "${T.guide.dimBackLine}"`,
        after.rescues === s0.tutorial.rescues + 1 && before > after.total / 2 && after.dimmed <= Math.floor(after.total / 2) && lines.includes(T.guide.dimBackLine), JSON.stringify({ before, after, last: lines.slice(-4) }));
      const hintIds = await page.evaluate(() => window.__ui.coach().log.map((x) => x.id));
      check('D152-hints', 'a first run shows none of the contract hints H20-H23 (and no G1 or G10)', !hintIds.some((x) => ['H20', 'H21', 'H22', 'H23', 'G1', 'G10'].includes(x)), hintIds.join(','));
    } catch (e) { await shot(page, 'W1-error'); check('W-1', 'part W1 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('W-1', 'part W1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- W2: a first run's summary
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&fresh=1&guide=0', null, {});
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.locator('#pp-go').click(); await idle(page); // nothing bought: every point unspent
      for (let i = 0; i < 80; i++) { const v = await view(page); if (v.round >= 2 && !v.over && v.step === 'combat') break; await auto(page); }
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); s0.player.hp = 1;
      for (const e of s0.fight.enemies) { e.hp = 9999; e.maxHp = 9999; }
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      for (let i = 0; i < 12 && (await view(page)).phase !== 'SUMMARY'; i++) { await page.keyboard.press('KeyX'); await idle(page); }
      await page.waitForTimeout(300);
      const sm = await page.evaluate(() => { const v = window.__ui.view(); const el = document.querySelector('#screens .summary'); return { phase: v.phase, firstRun: v.summary && v.summary.firstRun, text: el ? el.innerText : '',
        line: [...document.querySelectorAll('#screens .summary .echo[data-line="reserve"]')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()) }; });
      await shot(page, 'W2-summary');
      check('D152-summary', `a first run's summary: the unspent points' Echo line reads "${T.prep.unspentLabel}"; no Contracts row, no "Reserve"`,
        sm.phase === 'SUMMARY' && sm.firstRun === true && sm.line.length === 1 && sm.line[0].startsWith(T.prep.unspentLabel) && !/Reserve|Contracts/.test(sm.text), JSON.stringify(sm).slice(0, 600));
    } catch (e) { await shot(page, 'W2-error'); check('W-2', 'part W2 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('W-2', 'part W2: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- W3: a later run: the Bell in zone 1, its tooltip clear of the side panels, the tracker
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1', M_PROFILE());
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 40 && (await view(page)).phase !== 'MAP'; i++) await auto(page);
      await page.mouse.move(2, 2); await page.waitForTimeout(300);
      const bell = page.locator('#screens .expmap [data-leave="RING_BELL"]');
      const n = await bell.count(); let over = null; let tipShown = false;
      if (n) {
        await bell.hover(); await page.waitForTimeout(150);
        tipShown = await page.evaluate(() => !!document.querySelector('.tooltip.on'));
        over = await page.evaluate(() => { const t = document.querySelector('.tooltip.on'); if (!t) return null; const r = t.getBoundingClientRect();
          return [...document.querySelectorAll('.expmap .xside .xpanel')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && r.left < b.right - 1 && r.right > b.left + 1 && r.top < b.bottom - 1 && r.bottom > b.top + 1; }).length; });
        await page.mouse.move(2, 2);
      }
      const cv = await page.evaluate(() => !!window.__ui.view().contracts);
      // D150 section 7 (moved here from part T1 by D152): the Bell's ask names its tolls and any fight first, as its tooltip does
      let ask = null;
      if (n) {
        await bell.click(); await idle(page);
        ask = await page.evaluate(() => { const x = window.__ui.view(); const e = document.querySelector('#screens .leavewarn .lw-bell'); return { p: x.heat.next.RING_BELL || null, text: e ? e.textContent : null }; });
        await shot(page, 'W3-bell-ask');
        await page.getByRole('button', { name: 'Stay' }).click(); await idle(page);
      }
      const bw = ask && ask.p ? wantCost(ask.p) : null;
      check('D150-s7', `the Bell's ask names its tolls and any fight first (heatView RING_BELL: "${bw}"), as its tooltip does`, !!bw && !!ask.text && ask.text.includes(bw), JSON.stringify(ask));
      check('D152-bell', 'a later run (runs 2): the Bell in zone 1, its tooltip clear of the map\'s side panels; the contract tracker is there', n === 1 && tipShown && over === 0 && cv, JSON.stringify({ n, tipShown, over, cv }));
    } catch (e) { await shot(page, 'W3-error'); check('W-3', 'part W3 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('W-3', 'part W3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- W4: a zone 2 hub on a first run: no contract card (zone.hubOffer null)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, {});
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      const hub = await page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, z: v.zone && v.zone.idx, contracts: v.contracts, card: document.querySelectorAll('#screens .hubc, #screens [data-hub-offer]').length, text: (document.querySelector('#screens .side') || {}).innerText || '' }; });
      check('D152-contracts', 'a zone 2 hub of a first run: no contract card, no "Reserve"', hub.phase === 'ZONE_HUB' && hub.z === 2 && hub.contracts === null && hub.card === 0 && !/Reserve/.test(hub.text), JSON.stringify({ ...hub, text: hub.text.slice(0, 200) }));
    } catch (e) { await shot(page, 'W4-error'); check('W-4', 'part W4 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('W-4', 'part W4: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part X: the newcomer check of 2026-11-15
/**
 * Part X (docs/feedback/2026-11-15-blind-newcomer.md; docs/handoffs/ui-2026-11-15.md). X1 a guided first run (seed 8736, hints
 * on) on the engine's autoplay choices to zone 2: on every map screen each Road (mapView roads) has its post line
 * (svg .xroadln) from its sign towards its own rim node, which carries the Road ring (.xrd, an outline); every Dimming clock is
 * pinned to its node (no translate, touching its ring) and shows the number alone (the player's own at 2 or less "Dims in
 * N!"); while the Dimming sets the Furnace (heatView `by` 'dim') the meter reads "<State> · Raised by the Dimming nearby" and its tip
 * has the diamond's line; when the Roads open, the "Take a Road" line (G12.road) ends with "Nearest: N hops, M tolls."
 * (nearestRoad on mapView) and U01 counts as seen; the Key's tip does not cover the Key; at the first loot window with
 * items the Bags (B) open beside it, Continue on top, and the "+N items" note on the Bags button goes when they open. X2 a
 * first run with the guide off (seed 7, hints on): U02 at a red toll label (MOVE ending Burning or Infernal), its ring on that
 * node, its Pass through button shown and taken by X (PASS_THROUGH); U01 "Nearest Road: N hops, M tolls." at the nearest
 * Road's sign; each shown once. X3 the default speed: the hub's Set out shows the map at once (no empty screen); the skip
 * line hides while a coach line is up.
 */
async function partX(browser, W, H) {
  const auto = async (page) => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };
  const onMapNow = (page) => page.evaluate(() => { const v = window.__ui.view(); return v.phase === 'MAP' && !v.node && !v.loot && !!(v.zone && v.zone.exp); });
  /** The map's Roads, clocks and Furnace as drawn, with mapView and heatView. */
  const mapFacts = (page) => page.evaluate(() => {
    const v = window.__ui.view(); const mv = v.zone.exp;
    const rc = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width }; };
    const roads = mv.roads.map((id) => {
      const lines = [...document.querySelectorAll(`#screens .xsvg .xroadln[data-road="${id}"]`)];
      const node = document.querySelector(`#screens .mnode[data-node="${id}"]`);
      const ring = node && node.querySelector('.ring'); const sign = document.querySelector(`#screens .xroad[data-road="${id}"] .xpost`);
      const ln = lines[lines.length - 1];
      const ends = ln ? [[+ln.getAttribute('x1'), +ln.getAttribute('y1')], [+ln.getAttribute('x2'), +ln.getAttribute('y2')]].map(([x, y]) => { const p = ln.ownerSVGElement.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(ln.getScreenCTM()); return [q.x, q.y]; }) : null;
      return { id, closed: !!mv.nodes[id].closed, dimmed: !!mv.nodes[id].dimmed, lines: lines.length, kind: ln ? ln.dataset.kind : null, ends, ring: ring ? rc(ring) : null, post: sign ? rc(sign) : null,
        xrd: !!node && node.classList.contains('xrd'), outline: ring ? getComputedStyle(ring).outlineStyle : null };
    });
    const clocks = [...document.querySelectorAll('#screens .mnode .xclock')].map((e) => { const n = e.closest('.mnode'); const id = Number(n.dataset.node);
      return { id, text: e.textContent, urgent: e.classList.contains('urgent'), translate: e.style.translate || '', c: rc(e), ring: rc(n.querySelector('.ring')), here: id === mv.pos, dimsIn: mv.nodes[id].dimsIn }; });
    const hm = document.querySelector('#heat');
    return { pos: mv.pos, roads, clocks, closedRoads: !!(v.tutorial && v.tutorial.roads && v.tutorial.roads.closed), mv, heat: v.heat ? { by: v.heat.by, state: v.heat.state, dimIn: v.heat.dimIn } : null,
      meter: hm && !hm.classList.contains('hidden') ? hm.querySelector('.ht-row').innerText.replace(/\s+/g, ' ').trim() : null, coach: window.__ui.coach().shown };
  });
  const near = (a, ring, slack) => { const dx = Math.max(ring.l - a[0], 0, a[0] - ring.r); const dy = Math.max(ring.t - a[1], 0, a[1] - ring.b); return Math.hypot(dx, dy) <= slack; };
  // ---- X1
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      let maps = 0; const badRoads = []; const badClocks = []; let clocksSeen = 0; let dimFurnace = null; let roadLine = null; let keyTip = null; let loot = null; let roadsOpenAt = null;
      for (let i = 0; i < 260; i++) {
        const v = await view(page);
        const z = await page.evaluate(() => (window.__ui.view().zone || {}).idx);
        if (z > 1 || v.phase === 'SUMMARY') break;
        const lv = await page.evaluate(() => { const x = window.__ui.view(); return x.loot && x.loot.kind === 'loot' && (x.loot.items || []).length > 0 && !document.querySelector('#win-bags'); });
        if (lv && !loot) {
          await page.waitForTimeout(400);
          const before = await page.evaluate(() => { const e = document.querySelector('#micromenu .mm-new'); return e && !e.classList.contains('hidden') ? e.textContent : null; });
          await page.keyboard.press('KeyB'); await idle(page); await page.waitForTimeout(450);
          loot = await page.evaluate(() => {
            const bags = document.querySelector('#win-bags'); const panel = document.querySelector('#screens .loot');
            const a = bags && bags.getBoundingClientRect(); const b = panel && panel.getBoundingClientRect();
            const btns = [...document.querySelectorAll('#screens .loot button')].map((x) => { const r = x.getBoundingClientRect(); const t = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return { text: x.textContent.trim(), top: !!t && (t === x || x.contains(t)) }; });
            const note = document.querySelector('#micromenu .mm-new');
            return { bags: !!bags, overlap: !!(a && b) && a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1, btns, noteAfter: note && !note.classList.contains('hidden') ? note.textContent : null };
          });
          loot.noteBefore = before;
          await shot(page, 'X1-loot-bags');
          await page.keyboard.press('KeyB'); await idle(page);
        }
        if (await onMapNow(page)) {
          await page.mouse.move(2, 2); await page.waitForTimeout(450);
          const f = await mapFacts(page); maps += 1;
          for (const r of f.roads) {
            const okLine = r.lines === 2 && r.kind === (r.closed ? 'closed' : r.dimmed ? 'dimmed' : 'open') && !!r.ends && !!r.ring && near(r.ends[1], r.ring, r.ring.w * 0.6) && !!r.post && Math.hypot(r.ends[0][0] - r.post.cx, r.ends[0][1] - r.post.cy) <= 3 * r.post.w + 40;
            if (!okLine || !r.xrd || r.outline === 'none') badRoads.push({ step: i, ...r, ends: r.ends && r.ends.map((p) => p.map(Math.round)), ring: r.ring && [r.ring.l, r.ring.t, r.ring.r, r.ring.b].map(Math.round), post: r.post && [r.post.cx, r.post.cy].map(Math.round) });
          }
          for (const c of f.clocks) {
            clocksSeen += 1;
            const want = c.urgent ? `Dims in ${c.dimsIn}!` : String(c.dimsIn);
            const touch = c.c.l <= c.ring.r + 2 && c.c.r >= c.ring.l - 2 && c.c.t <= c.ring.b + 2 && c.c.b >= c.ring.t - 2;
            if (c.text !== want || c.translate || (!c.urgent && !touch) || (c.urgent && !c.here)) badClocks.push({ step: i, id: c.id, text: c.text, want, translate: c.translate, touch });
          }
          if (f.heat && f.heat.by === 'dim' && f.heat.dimIn > 0 && !dimFurnace && f.meter) {
            await page.locator('#heat').hover(); await page.waitForTimeout(200);
            const t = await page.evaluate(() => { const e = document.querySelector('.tooltip.on'); return e ? e.innerText : null; }); await page.mouse.move(2, 2);
            dimFurnace = { meter: f.meter, state: HEAT_WORDS.state[f.heat.state], tip: t };
            await shot(page, 'X1-furnace-dim');
          }
          if (!f.closedRoads && roadsOpenAt == null) roadsOpenAt = i;
          if (f.coach && f.coach.id === 'G12.road' && !roadLine) {
            const nr = nearestRoad(f.mv);
            roadLine = { text: f.coach.text, want: nr ? NEAREST_ROAD_TAIL.replace('{hops}', hopsText(nr.hops)).replace('{tolls}', tolls(nr.tolls)) : null,
              ring: await page.evaluate(() => { const e = document.querySelector('.coach-on'); return e ? e.className + ' ' + (e.dataset.road || '') : null; }), nr, u01: (await page.evaluate(() => window.__ui.coach().store.seen)).U01 || false };
            await shot(page, 'X1-roads-open');
          }
          if (!keyTip) {
            await page.locator('#screens .xkey').hover(); await page.waitForTimeout(200);
            keyTip = await page.evaluate(() => { const t = document.querySelector('.tooltip.on'); const k = document.querySelector('#screens .xkey'); if (!t || !k) return null; const a = t.getBoundingClientRect(); const b = k.getBoundingClientRect();
              return { tip: [a.left, a.top, a.right, a.bottom].map(Math.round), key: [b.left, b.top, b.right, b.bottom].map(Math.round), overlap: a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1, row: [...k.querySelectorAll('.xk')].some((x) => /Dims in 3 tolls/.test(x.textContent)) }; });
            await page.mouse.move(2, 2);
          }
        }
        await auto(page);
      }
      check('X-roads', `every Road on ${maps} map screens: a post line from its sign to its own rim node (open, closed or Dimmed colour), the node ringed (.xrd)`, maps > 3 && badRoads.length === 0, JSON.stringify(badRoads.slice(0, 3)));
      check('X-clocks', `${clocksSeen} Dimming clocks: each pinned to its node (no declutter shift, touching its ring), the number alone; the player's own at 2 or less "Dims in N!"`, clocksSeen > 10 && badClocks.length === 0, JSON.stringify(badClocks.slice(0, 4)));
      check('X-furnace', `the Dimming sets the Furnace: the meter reads "<State> · ${DIM_NEAR_WORDS}" and no clock tag (demo blind round 1 B, draft; was "◆ Set by this place"), its tip "Your node dims in N tolls" and the diamond's line`, !!dimFurnace && dimFurnace.meter.toLowerCase() === `${dimFurnace.state} · ${DIM_NEAR_WORDS}`.toLowerCase() && !!dimFurnace.tip && /Your node dims in \d+ tolls?\./.test(dimFurnace.tip) && dimFurnace.tip.includes(DIM_MARK_LINE), JSON.stringify(dimFurnace));
      check('X-nearest', 'the Roads open (Gorrak\'s fight over): the "Take a Road" line (G12.road) ends with the nearest Road\'s hops and tolls (nearestRoad on mapView), rings that Road\'s sign, and counts for U01', roadsOpenAt != null && !!roadLine && !!roadLine.want && roadLine.text.endsWith(roadLine.want) && !!roadLine.ring && roadLine.ring.endsWith(` ${roadLine.nr.id}`) && roadLine.u01 === true, JSON.stringify({ roadsOpenAt, roadLine }));
      check('X-key', 'the map Key\'s tip lies beside the Key, not over it; the Key names the clock badge ("Dims in 3 tolls")', !!keyTip && !keyTip.overlap && keyTip.row, JSON.stringify(keyTip));
      check('X-bags', 'the first loot window with items: the Bags (B) open beside it, not over it; Continue and every button of the window on top; a "+N items" note on the Bags button before, gone once they open',
        !!loot && loot.bags && !loot.overlap && loot.btns.length > 0 && loot.btns.every((b) => b.top) && /^\+\d+ items?$/.test(loot.noteBefore || '') && loot.noteAfter === null, JSON.stringify(loot));
    } catch (e) { await shot(page, 'X1-error'); check('X-1', 'part X1 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('X-1', 'part X1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- X2: U02 and U01 on a first run with the guide off
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&fresh=1&guide=0', null, { hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      if (await page.locator('#pp-go').count()) { await page.locator('#pp-go').click(); await idle(page); }
      let u02 = null; let u01 = null;
      for (let i = 0; i < 200 && !(u02 && u01); i++) {
        const v = await view(page); if (v.phase === 'SUMMARY') break;
        const sh = await page.evaluate(() => window.__ui.coach().shown);
        if (sh && sh.id === 'U02' && !u02) {
          await page.waitForTimeout(300);
          const x = await page.evaluate(() => { const v = window.__ui.view(); const on = document.querySelector('#screens .mnode.coach-on'); const pb = document.querySelector('#screens .xpass.coach-also');
            const id = on ? Number(on.dataset.node) : null; const p = id != null && v.heat.next ? v.heat.next[`MOVE:${id}`] : null; const pt = id != null && v.heat.next ? v.heat.next[`PASS_THROUGH:${id}`] : null;
            return { id, red: !!p && p.change && (p.state === 'hot' || p.state === 'scorched'), label: on ? { ...(on.querySelector('.mhrs') || {}).dataset } : null, pass: pt ? pt.time : null, btn: pb ? { node: Number(pb.dataset.node), shown: getComputedStyle(pb).display !== 'none' } : null };
          });
          x.text = sh.text;
          await shot(page, 'X2-u02');
          const seen = await page.evaluate(() => !!window.__ui.coach().store.seen.U02);
          await page.keyboard.press('KeyX'); await idle(page);
          const after = await page.evaluate(() => window.__ui.view().zone.exp.pos);
          u02 = { ...x, seen, after, want: UI_HINTS.U02 };
          continue;
        }
        if (sh && sh.id === 'U01' && !u01) {
          const f = await mapFacts(page); const nr = nearestRoad(f.mv);
          const ring = await page.evaluate(() => { const e = document.querySelector('.coach-on'); return e && e.dataset.road != null ? Number(e.dataset.road) : null; });
          u01 = { text: sh.text, nr, ring, want: nr ? `Nearest Road: ${hopsText(nr.hops)}, ${tolls(nr.tolls)}.` : null };
          await shot(page, 'X2-u01');
        }
        await auto(page);
      }
      const log = (await page.evaluate(() => window.__ui.coach().log)).map((x) => x.id);
      check('X-pass', `the first red toll label: U02 "${UI_HINTS.U02.replace('{passTolls}', 'N tolls').replace('{key_pass}', '[X]')}" (heatView PASS_THROUGH), ringed on that node, its Pass through button shown; X passes through it; seen at once`,
        !!u02 && u02.red && u02.text === `Pass through a place for ${tolls(u02.pass)} X.` && !!u02.btn && u02.btn.node === u02.id && u02.btn.shown && u02.after === u02.id && u02.seen, JSON.stringify(u02));
      check('X-nearest', 'a first run with the guide off: U01 "Nearest Road: N hops, M tolls." (nearestRoad: hops, walk tolls plus the Road\'s) at the nearest Road\'s sign', !!u01 && u01.text === u01.want && u01.ring === u01.nr.id, JSON.stringify(u01));
      check('X-once', 'U01 and U02 each shown once', log.filter((x) => x === 'U01').length === 1 && log.filter((x) => x === 'U02').length === 1, log.filter((x) => /^U0/.test(x)).join(','));
    } catch (e) { await shot(page, 'X2-error'); check('X-2', 'part X2 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('X-2', 'part X2: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- X3: the default speed: Set out shows the map at once; the skip line under a coach line
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&fresh=1', null, { guide: true, hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.locator('#pp-go').click(); await idle(page); await page.waitForTimeout(600);
      // every frame from the click on (in the page): is a screen panel shown, and is it the map
      await page.evaluate(() => {
        const go = [...document.querySelectorAll('#screens button')].find((b) => b.textContent.trim() === 'Set out');
        window.__xso = []; let t0 = null;
        go.addEventListener('click', () => { t0 = performance.now(); const tick = () => { const sc = document.querySelector('#screens'); window.__xso.push({ t: Math.round(performance.now() - t0), map: !!sc.querySelector('.expmap'), n: sc.children.length }); if (performance.now() - t0 < 1600) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, { capture: true });
      });
      await page.locator('#screens').getByRole('button', { name: 'Set out' }).click(); await page.waitForTimeout(1800);
      const samples = await page.evaluate(() => window.__xso);
      const first = samples.find((x) => x.map);
      check('X-setout', 'the default speed: the hub\'s Set out shows the zone map at once (within 250 ms of the click), and no frame after it is empty', !!first && first.t <= 250 && samples.every((x) => x.n > 0) && samples.slice(samples.indexOf(first)).every((x) => x.map), JSON.stringify({ first, frames: samples.length, empty: samples.filter((x) => !x.n).length, notMap: samples.filter((x) => !x.map).map((x) => x.t).slice(0, 8) }));
      await shot(page, 'X3-map');
      const skip = await page.evaluate(() => { const s = document.querySelector('#skiphint'); const was = s.className; s.classList.add('on'); document.body.classList.add('coach-up'); const a = getComputedStyle(s).visibility; document.body.classList.remove('coach-up'); const b = getComputedStyle(s).visibility; s.className = was; return { underCoach: a, alone: b }; });
      check('X-skip', 'the skip line ("Space or click to skip") hides while a coach line is up (they share the place over the action bar)', skip.underCoach === 'hidden' && skip.alone === 'visible', JSON.stringify(skip));
    } catch (e) { await shot(page, 'X3-error'); check('X-3', 'part X3 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('X-3', 'part X3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- X4: D153 (engine-2026-11-17 UI need 1): Gorrak's Deathblow after the Rogue's first Deathblow fight on the profile
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: false });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const inDb = () => page.evaluate(() => { const v = window.__ui.view(); return !!(v.combat && !v.combat.over && (v.combat.windups || []).some((w) => w.deathblow)); });
      for (let i = 0; i < 200 && !(await inDb()); i++) await auto(page);
      const read = () => page.evaluate(() => { const v = window.__ui.view(); const w = v.combat.windups.find((x) => x.deathblow); const tp = document.querySelector('#turnprompt');
        return { first: w.firstDeathblow, ready: w.ready, prompt: tp && !tp.classList.contains('hidden') ? tp.querySelector('.tp-t').innerText.replace(/\s+/g, ' ').trim() : null, kbd: tp ? tp.querySelectorAll('kbd, .kbd').length : 0,
          rings: [...document.querySelectorAll('#actionbar .ab.db-now, #actionbar .ab.db-soon, #actionbar .ctrl .btn.db-now, #engage .eg-opt.db-ans, #engage .eg-sp.db')].map((e) => `${e.tagName}.${[...e.classList].join('.')}`), w: { round: w.round, name: w.name, est: w.est } }; });
      await page.mouse.move(2, 2); await page.waitForTimeout(200);
      const a = await read();
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      s0.profile = { ...(s0.profile || {}), deathblowMet: { ...((s0.profile || {}).deathblowMet || {}), [s0.player.classId]: true } };
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page); await page.waitForTimeout(200);
      const b = await read();
      await shot(page, 'X4-deathblow-later');
      check('X-db', 'the first Deathblow fight of the class: the prompt names the answer with key chips and the crimson ring shows', a.first === true && a.ready && a.kbd > 0 && a.rings.length > 0, JSON.stringify(a));
      check('X-db', 'after the class\'s first Deathblow fight (windupView firstDeathblow false): "Round N: <name>, about X. Stop it.", no key chip, no crimson answer ring',
        b.first === false && b.prompt === `Round ${b.w.round}: ${b.w.name}, about ${b.w.est}. Stop it.` && b.kbd === 0 && b.rings.length === 0, JSON.stringify(b));
    } catch (e) { await shot(page, 'X4-error'); check('X-4', 'part X4 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('X-4', 'part X4: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part Y: Legacy phase 1 (D154-D157), the switch forced on
/**
 * Part Y (docs/specs/legacy.md 1.1-1.8, 4.1, 4.6; engine-api.md 15; docs/handoffs/ui-2026-11-18.md): the page opens with
 * ?legacy=1 (C.GATES.legacy on for that page); every expected number from the engine in Node (shownLevel, heroView,
 * heroesView, summary). Y1: a stored version 1 profile migrates under the version 3 key (the version 1 key untouched), the
 * refund note once (gone after a reload), "Legacy points" and the "Legacy hall" with no Echo word on class select or in the
 * hall; the same profile without the switch: as before. Y2: hero select with a level 12 Rogue and a level 4 Mage (R.debug.
 * setHero): levels and XP bars = R.heroesView, "New hero", the name field only for a new hero, the hero's spells. Y3: the
 * run: the start camp's pay in hero XP, the HUD level and XP bar = R.heroView, the checkpoint stored at zone 1, the hub's
 * and the map's levels, the nameplates, the item levels and the spellbook's learn levels on the hero scale; a level-up's
 * banner on the hero level. Y4: the summary's hero line and Legacy lines = R.summary, no Echo word; then hero select keeps
 * the level the hero reached. Y5 (engine-2026-11-19 UI needs; ui-2026-11-19): the Dev menu's hero level picker at class
 * select (R.debug.setHero), the minimap's zone danger line = zoneDanger × mapView.tierDmg - 1, the spellbook's learn levels =
 * R.learnLevel, the menu's "Abandon run" asked once, then the summary of a run ended as a death and its Legacy points paid.
 */
const Y_KEY = 'tbwcr.profile.v3';
/** A Node computation with C.GATES.legacy on (newProfile and setHero make version 3 profiles), the switch back after. */
const withLegacy = (fn) => { const was = R.C.GATES.legacy; R.C.GATES.legacy = true; try { return fn(); } finally { R.C.GATES.legacy = was; } };
const yShown = (n) => R.shownLevel({ legacy: true }, n);
const yLearn = (M) => R.learnLevel({ legacy: true }, M); // engine-2026-11-19: the engine's learn level (was the UI's own loop)
async function openY(browser, W, H, query, store) {
  const { context, page, errors } = await (async () => {
    const context = await browser.newContext({ viewport: { width: W, height: H } });
    await context.addInitScript((pairs) => { try { if (!sessionStorage.getItem('y-init')) { sessionStorage.setItem('y-init', '1'); for (const [k, v] of pairs) localStorage.setItem(k, v); } } catch { /* storage blocked */ } }, Object.entries(store));
    await context.addInitScript((key) => { try { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ off: true, seen: {} })); } catch { /* storage blocked */ } }, HINTS_KEY);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`request ${r.url()}`); });
    return { context, page, errors };
  })();
  await page.goto(`${URL}?${query}`);
  await page.waitForFunction(() => window.__ui);
  await idle(page);
  return { context, page, errors };
}
const echoWords = (page, sel) => page.evaluate((q) => [...document.querySelectorAll(q)].map((e) => e.innerText).join(' | ').match(/[^|.]*\bEcho(es)?\b[^|.]*/g) || [], sel);

/**
 * D159: the page's ?legacy=1 set turns C.GATES.economyV2 on (legacy.md 4.7); the Node side reads it at each use (prepView,
 * summary, migrateProfile), so part Y runs with it on, and puts it back after.
 */
async function partY(browser, W, H) {
  const econWas = R.C.GATES.economyV2; R.C.GATES.economyV2 = true;
  try { await partY0(browser, W, H); await partY6(browser, W, H); } finally { R.C.GATES.economyV2 = econWas; }
}
/** Hero select's level line under Economy v2: "Level 4 → 7" for the hero of the run just ended, else "Level 7". */
const yLevels = (from, to) => (from !== to ? `Level ${from} → ${to}` : `Level ${to}`);
async function partY0(browser, W, H) {
  // ---- Y1: the migration, the refund note, the words; the same profile with the switch off
  {
    const v1 = { ...R.newProfile(), echoes: 40, earned: 400, spent: 360, runs: 4, guide: 'done', welcome: true, unlocks: { satchel: 1, vigor: 2 } };
    const want = withLegacy(() => R.migrateProfile(v1));
    const back = 360 - want.spent;
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=5', { [PROFILE_KEY]: JSON.stringify(v1) });
    try {
      const read = () => page.evaluate(() => {
        const q = (s) => document.querySelector(s); const rf = q('#create .ctitle .refund');
        return { t3: q('#create .ctitle .t3').innerText, refund: rf && !rf.classList.contains('hidden') ? rf.innerText : null, heroes: [...document.querySelectorAll('#create .ccard .chero')].map((e) => (e.classList.contains('hidden') ? null : e.innerText.trim())),
          btn: q('#create .bottom .echoes') ? q('#create .bottom .echoes').innerText.replace(/\s+/g, ' ').trim() : null, v1: localStorage.getItem('tbwcr.profile.v1'), v3: localStorage.getItem('tbwcr.profile.v3') };
      });
      const a = await read();
      await shot(page, 'Y1-hero-select-refund');
      check('Y-1', 'the version 1 profile migrates under the version 3 key (Legacy points = Echoes + spent; under Economy v2 nothing kept, D160); the version 1 key is left as it was',
        a.v1 === JSON.stringify(v1) && a.v3 && JSON.parse(a.v3).v === 3 && JSON.parse(a.v3).legacy === want.legacy, `v3 ${a.v3 && a.v3.slice(0, 120)} want legacy ${want.legacy}`);
      check('Y-1', 'class select: the refund note once ("Echoes are now Legacy points. The N you had spent are back.", draft), the hero line, three "New hero" cards',
        a.refund === `Echoes are now Legacy points. The ${back} you had spent are back.` && /keeps its level, 1 to 25/.test(a.t3) && a.heroes.join(',') === 'New hero,New hero,New hero', JSON.stringify(a));
      check('Y-1', 'the balance button reads Legacy points with the migrated balance', !!a.btn && a.btn.startsWith(`${fmtN(want.legacy)} Legacy points`), a.btn);
      const ew = await echoWords(page, '#create');
      check('Y-1', 'no Echo word on class select but the refund note', ew.length === 1 && /now Legacy points/.test(ew[0]), JSON.stringify(ew));
      await page.locator('#create .bottom .echoes').click(); await idle(page);
      const hall = await page.evaluate(() => ({ title: document.querySelector('#meta .mhead .title').innerText, n: document.querySelector('#meta .mbal .n').innerText, u: document.querySelector('#meta .mbal .u').innerText,
        label: document.querySelector('#meta').getAttribute('aria-label'), offers: document.querySelectorAll('#meta .mgroup [data-id], #meta .mgroup .mcard').length }));
      const ewh = await echoWords(page, '#meta');
      await shot(page, 'Y1-legacy-hall');
      check('Y-1', 'the Hall of Echoes reads as the Legacy hall (title, balance, unit, no Echo word), with the same items', hall.title === 'Legacy hall' && hall.u === 'Legacy points' && Number(hall.n.replace(/\D/g, '')) === want.legacy && ewh.length === 0 && hall.offers > 0,
        `${JSON.stringify(hall)} ${JSON.stringify(ewh)}`);
      await page.keyboard.press('Escape'); await idle(page);
      const dropped = await reloadKeep(page); await idle(page);
      const b = await read();
      check('Y-1', 'after a reload the refund note is gone (shown once)', b.refund === null && b.heroes.join(',') === 'New hero,New hero,New hero', `${JSON.stringify(b)}${dropped ? ` (the browser dropped the storage on ${dropped} reload(s): put back, reloaded again)` : ''}`);
    } catch (e) { await shot(page, 'Y1-error'); check('Y-1', 'part Y1 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Y-1', 'part Y1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
    // the same profile with the switch off: as before (no hero line, Echoes, the old title line)
    const off = await openY(browser, W, H, 'prep=1&speed=instant&seed=5', { [PROFILE_KEY]: JSON.stringify(v1) });
    try {
      const c = await off.page.evaluate(() => ({ t3: document.querySelector('#create .ctitle .t3').innerText, heroes: [...document.querySelectorAll('#create .ccard .chero')].filter((e) => !e.classList.contains('hidden')).length,
        refund: !document.querySelector('#create .ctitle .refund').classList.contains('hidden'), btn: document.querySelector('#create .bottom .echoes').innerText.replace(/\s+/g, ' ').trim(), v3: localStorage.getItem('tbwcr.profile.v3') }));
      check('Y-1', 'switch off: class select as before (the level line to 60, Echoes, no hero line, no note, no version 3 profile)',
        c.t3 === `Level from 1 to ${R.C.MAX_LEVEL} across six zones, then face Oruvath.` && c.heroes === 0 && !c.refund && c.btn === '40 Echoes' && c.v3 === null, JSON.stringify(c));
    } catch (e) { check('Y-1', 'part Y1 (switch off) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Y-1', 'part Y1 (switch off): no console errors', off.errors.length === 0, off.errors.join(' | '));
    await off.context.close();
  }
  // ---- Y2-Y4: hero select, the run, the summary
  {
    const prof = withLegacy(() => { let p = { ...R.newProfile(), runs: 3, guide: 'done', welcome: true }; p = R.debug.setHero(p, 'rogue', { level: 12, xp: 1000 }); p = R.debug.setHero(p, 'mage', { level: 4, xp: 0 }); return p; });
    const heroes = R.heroesView(prof);
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=7', { [Y_KEY]: JSON.stringify(prof) });
    const nodeState = async () => R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
    try {
      // Y2: hero select
      const cards = await page.evaluate(() => [...document.querySelectorAll('#create .ccard')].map((c) => { const x = c.querySelector('.chero'); return { cls: c.dataset.cls, text: x.innerText.trim(), level: x.dataset.level, xp: x.dataset.xp, w: x.querySelector('.ch-xp i').style.width }; }));
      const nameShown = () => page.evaluate(() => !document.querySelector('#create .bottom .field:not(.seedf)').classList.contains('hidden'));
      const rogueName = await nameShown();
      const pct = (hv) => `${Math.round((hv.xp / hv.xpToNext) * 1000) / 10}%`;
      check('Y-2', 'hero select: each card names its hero\'s level and fills its XP bar as R.heroesView says; a class without one reads "New hero"',
        cards[0].text === `Level ${heroes[0].level}` && cards[0].w === pct(heroes[0]) && cards[1].text === `Level ${heroes[1].level}` && cards[1].w === '0%' && cards[2].text === 'New hero', JSON.stringify(cards));
      const spells = await page.evaluate(() => ({ head: document.querySelector('#create .details .body .subtitle').innerText, n: document.querySelectorAll('#create .details .startspells .sp').length }));
      const wantSpells = Object.values(R.C.SPELL).filter((x) => x.cls === 'rogue' && x.source === 'class' && x.lvl <= heroes[0].power).length;
      check('Y-2', 'the Rogue\'s details list the spells its level gives (every class spell up to its power level)', /^Spells$/i.test(spells.head) && spells.n === wantSpells, `${JSON.stringify(spells)} want ${wantSpells}`);
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      const hunterName = await nameShown();
      check('Y-2', 'the name field shows for a new hero only', !rogueName && hunterName, `rogue ${rogueName} hunter ${hunterName}`);
      await shot(page, 'Y2-hero-select-levels');
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      // Y3: the run
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const pay = await page.evaluate(() => [...document.querySelectorAll('#prep .pp-card')].map((c) => c.innerText.replace(/\s+/g, ' ')));
      const pv = R.prepView(await nodeState());
      const offers = (pv && pv.board) || [];
      check('Y-3', 'the start camp pays contracts in hero XP ("280 XP"), never "levels of XP" (legacy.md 5.3)',
        pay.length > 0 && pay.every((t) => !/levels? of XP/.test(t)) && offers.every((o, i) => !pay[i] || pay[i].includes(`${String(o.reward.xp).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XP`)), `${JSON.stringify(pay)} ${JSON.stringify(offers.map((o) => o.reward && o.reward.xp))}`);
      await shot(page, 'Y3-start-camp');
      await page.keyboard.press('Enter'); await idle(page);
      for (let i = 0; i < 6 && (await page.evaluate(() => window.__ui.view().phase)) === 'PREP'; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      let s = await nodeState(); let hv = R.heroView(s);
      const hud = await page.evaluate(() => ({ lvl: document.querySelector('#player-frame .lvl').innerText, xp: document.querySelector('#xpbar .txt').textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' '), v3: localStorage.getItem('tbwcr.profile.v3'), hub: (document.querySelector('#screens .side .subtitle') || {}).innerText || '' }));
      const stored = hud.v3 ? (JSON.parse(hud.v3).heroes || {}).rogue : null;
      check('Y-3', 'the HUD shows the hero level and the hero\'s XP bar (R.heroView)', hud.lvl === String(hv.level) && hud.xp.startsWith(`Level ${hv.level} · ${fmtN(hv.xp)} / ${fmtN(hv.xpToNext)} XP`), `${JSON.stringify(hud)} hero ${JSON.stringify(hv)}`);
      check('Y-3', 'the hero checkpoint is stored at the zone 1 arrival (legacy.md 1.5)', !!stored && stored.level === hv.level && stored.xp === hv.xp, JSON.stringify(stored));
      const mv0 = R.mapView(s);
      const lo = Math.min(...mv0.bands.map((b) => b[0])); const hi = Math.max(...mv0.bands.map((b) => b[1]));
      check('Y-3', 'the hub names the zone\'s levels on the hero scale (its rings\' bands, shownLevel)', hud.hub.includes(`levels ${yShown(lo)}–${yShown(hi)}`), `${hud.hub} want ${yShown(lo)}-${yShown(hi)}`);
      await shot(page, 'Y3-hub-hud');
      // the map: every fight node's level label
      for (let i = 0; i < 120 && (await page.evaluate(() => { const v = window.__ui.view(); return v.phase === 'MAP' && !v.loot; })) === false; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      s = await nodeState(); const mv = R.mapView(s);
      const labels = await page.evaluate(() => [...document.querySelectorAll('#screens .mnode .cl.lvl')].map((e) => [Number(e.closest('.mnode').dataset.node), e.innerText.trim()]));
      const bad = labels.filter(([id, t]) => { const n = mv.nodes.find((x) => x.id === id); const L = n.type === 'elite' && n.level ? n.level : n.cl; return t !== String(yShown(L)); });
      check('Y-3', 'every fight node\'s level on the map is on the hero scale (shownLevel of its level)', labels.length > 0 && bad.length === 0, `${labels.length} labels, wrong ${JSON.stringify(bad)}`);
      await shot(page, 'Y3-map-levels');
      // a fight: the nameplates
      for (let i = 0; i < 80 && !(await page.evaluate(() => { const v = window.__ui.view(); return !!(v.combat && !v.combat.over); })); i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      s = await nodeState();
      const plates = await page.evaluate(() => [...document.querySelectorAll('#nameplates .np:not(.dead) .lv')].map((e) => e.innerText.trim()));
      const wantPlates = s.fight ? s.fight.enemies.filter((e) => e.alive).map((e) => String(yShown(e.level))) : [];
      check('Y-3', 'the nameplates show the enemies\' levels on the hero scale', plates.length > 0 && [...plates].sort().join(',') === [...wantPlates].sort().join(','), `${JSON.stringify(plates)} want ${JSON.stringify(wantPlates)}`);
      await shot(page, 'Y3-fight-nameplates');
      // the character sheet's item levels and the spellbook's next spells
      await page.keyboard.press('KeyC'); await idle(page);
      const it0 = await tipText(page, page.locator('#win-character .slot').first());
      const ilvls = Object.values(s.player.equipped).filter(Boolean).map((x) => `Item level ${yShown(x.ilvl)}`);
      check('Y-3', 'an item\'s tooltip names its item level on the hero scale', ilvls.some((t) => it0.includes(t)), `${it0.split('\n').slice(0, 3).join(' / ')} want one of ${ilvls.join(', ')}`);
      await page.keyboard.press('KeyC'); await page.keyboard.press('KeyP'); await idle(page);
      const nextLine = await page.evaluate(() => { const e = [...document.querySelectorAll('#win-spellbook .muted')].find((x) => /Next at a trainer/.test(x.innerText)); return e ? e.innerText : null; });
      const unknown = Object.values(R.C.SPELL).filter((x) => x.cls === 'rogue' && x.source === 'class' && !s.player.spells[x.id]).sort((a, b) => a.lvl - b.lvl).slice(0, 3);
      check('Y-3', 'the spellbook names the next spells at the hero level that opens them (legacy.md 1.7)', !unknown.length || nextLine === `Next at a trainer: ${unknown.map((x) => `${x.name} (${yLearn(x.lvl)})`).join(', ')}`, `${nextLine} want ${unknown.map((x) => `${x.name} (${yLearn(x.lvl)})`).join(', ')}`);
      await page.keyboard.press('KeyP'); await idle(page);
      // a level-up: the banner on the hero level
      await page.evaluate(() => { window.__yB = []; new MutationObserver(() => { const b = document.querySelector('#banner'); if (b.classList.contains('on')) window.__yB.push([b.querySelector('.b0').textContent, b.querySelector('.b1').textContent, b.querySelector('.b2').textContent]); }).observe(document.querySelector('#banner'), { attributes: true, childList: true, subtree: true, characterData: true }); });
      const lvl0 = hv.level;
      for (let i = 0; i < 1500; i++) {
        const v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, hero: x.player && x.player.heroLevel }; });
        if (v.phase === 'SUMMARY' || v.hero > lvl0) break;
        await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
      }
      await shot(page, 'Y3-level-up');
      s = await nodeState(); hv = R.heroView(s);
      const banners = (await page.evaluate(() => window.__yB)).filter((b) => b[0] === 'Level up');
      const hud2 = await page.evaluate(() => ({ lvl: document.querySelector('#player-frame .lvl').innerText, xp: document.querySelector('#xpbar .txt').textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ') }));
      check('Y-3', 'a hero level-up gets the level-up banner with the hero level; the HUD follows', hv.level > lvl0 && banners.some((b) => b[1] === `Level ${hv.level}`) && hud2.lvl === String(hv.level) && hud2.xp.startsWith(`Level ${hv.level} · ${fmtN(hv.xp)} / ${fmtN(hv.xpToNext)} XP`),
        `${lvl0} -> ${hv.level}; banners ${JSON.stringify(banners)} hud ${JSON.stringify(hud2)}`);
      // Y4: the summary (the run ended where it stands: health 1 in a fight, then the engine's autoplay)
      for (let i = 0; i < 200 && !(await page.evaluate(() => { const v = window.__ui.view(); return !!(v.combat && !v.combat.over); })); i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      const s1 = await nodeState();
      if (s1.fight && !s1.fight.over) { s1.player.hp = 1; await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s1)); await idle(page); }
      // Since D162 (and the careful Legacy autoplay) the hero survives health 1 in a node fight and plays on to the final
      // boss, which takes more than 400 steps: the run gets a budget of 2500 steps, and the boss fight is pinned to health 1
      // once as well, so the run ends as a death, as the comment above says. Not reaching the summary is its own failure
      // (the old TypeError on '.s-who' hid why).
      let bossPinned = false;
      for (let i = 0; i < 2500; i++) {
        const v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, fight: !!(x.combat && !x.combat.over) }; });
        if (v.phase === 'SUMMARY') break;
        if (v.phase === 'BOSS' && v.fight && !bossPinned) {
          bossPinned = true;
          const sb = await nodeState();
          if (sb.fight && !sb.fight.over) { sb.player.hp = 1; await page.evaluate((x) => window.__ui.loadState(x), R.serialize(sb)); await idle(page); }
        }
        await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
      }
      const endPhase = await page.evaluate(() => window.__ui.view().phase);
      check('Y-4', 'the run (health 1 in a fight, the boss fight at health 1) ends in the summary within the step budget', endPhase === 'SUMMARY', `phase ${endPhase} after the loop`);
      if (endPhase !== 'SUMMARY') throw new Error(`the run did not reach the summary (phase ${endPhase})`);
      s = await nodeState();
      const sm = R.summary(s);
      const sv = await page.evaluate(() => {
        const e = document.querySelector('.summary .s-hero'); const cards = [...document.querySelectorAll('.summary .card')];
        const c3 = cards.find((c) => /earned/.test(c.querySelector('h3').innerText));
        return { hero: e ? { ...e.dataset, text: e.innerText.replace(/\s+/g, ' ') } : null, who: document.querySelector('.summary .s-who').innerText, h3: c3 ? c3.querySelector('h3').innerText : null,
          lines: c3 ? [...c3.querySelectorAll('.echo[data-line]')].map((x) => [x.dataset.line, x.innerText.replace(/\s+/g, ' ').trim()]) : [], total: c3 ? c3.querySelector('.echo.total').innerText.replace(/\s+/g, ' ').trim() : null,
          btns: [...document.querySelectorAll('.summary .sfoot button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()) };
      });
      const ews = await echoWords(page, '.summary');
      await shot(page, 'Y4-summary');
      const gained = sm.hero.gained || 0; const xpG = s.stats.xpGained;
      check('Y-4', 'the summary\'s hero line: its level before and after the run and the hero XP it gained (summary.hero, stats.xpGained)',
        !!sv.hero && Number(sv.hero.from) === sm.hero.start.level && Number(sv.hero.to) === sm.hero.level && Number(sv.hero.xp) === xpG && sv.hero.text === `Level ${sm.hero.start.level}${sm.hero.level !== sm.hero.start.level ? ` → ${sm.hero.level}` : ''} · +${fmtN(xpG)} XP` && sv.who.startsWith(`Level ${sm.hero.level} Rogue`),
        `${JSON.stringify(sv.hero)} ${sv.who} want ${sm.hero.start.level} -> ${sm.hero.level}, ${xpG}`);
      const lvLine = sv.lines.find((l) => l[0] === 'levels');
      check('Y-4', 'Legacy points earned: the engine\'s lines ("Hero levels gained" at 20 a level), the total, and no Echo word on the summary',
        sv.h3 === 'Legacy points earned' && (gained === 0 ? !lvLine : !!lvLine && lvLine[1] === `Hero levels gained${gained > 1 ? ` (${gained})` : ''} +${gained * R.C.LEGACY_PER_LEVEL}`) && sv.total === `Total ${sm.legacy.total} Legacy points` && ews.length === 0 && sv.btns.some((b) => b.startsWith('Spend Legacy points')),
        `${JSON.stringify(sv)} ${JSON.stringify(ews)} total ${sm.legacy.total}`);
      await page.getByRole('button', { name: 'Begin a new run' }).click(); await idle(page);
      const after = await page.evaluate(() => ({ card: document.querySelector('#create .ccard[data-cls="rogue"] .chero').innerText.trim(), v3: JSON.parse(localStorage.getItem('tbwcr.profile.v3')) }));
      check('Y-4', 'after the run hero select keeps the level the hero reached (the stored profile\'s hero, runs + 1)', after.card === yLevels(sm.hero.start.level, sm.hero.level) && after.v3.heroes.rogue.level === sm.hero.level && after.v3.heroes.rogue.runs === 1,
        `${after.card} ${JSON.stringify(after.v3.heroes.rogue && { level: after.v3.heroes.rogue.level, runs: after.v3.heroes.rogue.runs })}`);
      await shot(page, 'Y4-hero-select-after');
    } catch (e) { await shot(page, 'Y-error'); check('Y-2', 'part Y2-Y4 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Y-2', 'part Y2-Y4: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- Y5: the hero level picker, the zone danger line with the tier factor, Abandon run
  {
    const prof = withLegacy(() => { let p = { ...R.newProfile(), runs: 3, guide: 'done', welcome: true }; p = R.debug.setHero(p, 'rogue', { level: 12, xp: 0 }); return p; });
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=9', { [Y_KEY]: JSON.stringify(prof) });
    const nodeState = async () => R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
    try {
      // the Dev menu's hero level picker (Give, Profile): the Mage's hero at level 9
      await page.keyboard.press('Backquote'); await idle(page);
      await page.locator('#devmenu').getByRole('tab', { name: 'Give' }).click(); await idle(page);
      await page.locator('#devmenu [data-f="heroClass"]').selectOption('mage');
      await page.locator('#devmenu [data-f="heroLevel"]').fill('9');
      await page.locator('#devmenu [data-dev="hero"]').click(); await idle(page);
      await shot(page, 'Y5-dev-hero-level');
      await page.keyboard.press('Backquote'); await idle(page);
      const pick = await page.evaluate(() => ({ card: document.querySelector('#create .ccard[data-cls="mage"] .chero').innerText.trim(), v3: JSON.parse(localStorage.getItem('tbwcr.profile.v3')).heroes.mage }));
      check('Y-5', 'the Dev menu\'s hero level picker sets a class\'s hero at class select (R.debug.setHero): the card and the stored profile', pick.card === 'Level 9' && pick.v3 && pick.v3.level === 9 && pick.v3.xp === 0, JSON.stringify(pick));
      // the run: the Rogue at level 12, to the zone 1 map
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.keyboard.press('Enter'); await idle(page);
      for (let i = 0; i < 80 && !(await page.evaluate(() => { const v = window.__ui.view(); return v.phase === 'MAP' && !!(v.zone && v.zone.exp) && !v.loot; })); i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      let s = await nodeState(); const mv = R.mapView(s);
      const exitL = Math.max(...mv.bands.map((b) => b[1]));
      const want = R.zoneDanger(exitL, 'normal') * mv.tierDmg - 1;
      const mm = await tipOf(page, page.locator('#minimap .disc'));
      check('Y-5', 'the minimap\'s zone danger line in a Legacy zone: zoneDanger × mapView.tierDmg - 1 at its highest level (legacy.md 2.2)',
        mv.tierDmg === R.C.ZONE_TIER_DMG[s.zone.z - 1] && (want > 0 ? mm.includes(`Enemies here deal up to ${pct1(want)} more damage than their level alone.`) : !/hit harder|deal up to/.test(mm)) && !/per 10 levels/.test(mm), `${mm} want ${pct1(want)} (tier ${mv.tierDmg})`);
      // the spellbook: learn levels from R.learnLevel
      await page.keyboard.press('KeyP'); await idle(page);
      const nextLine = await page.evaluate(() => { const e = [...document.querySelectorAll('#win-spellbook .muted')].find((x) => /Next at a trainer/.test(x.innerText)); return e ? e.innerText : null; });
      const unknown = Object.values(R.C.SPELL).filter((x) => x.cls === 'rogue' && x.source === 'class' && !s.player.spells[x.id]).sort((a, b) => a.lvl - b.lvl).slice(0, 3);
      check('Y-5', 'the spellbook\'s learn levels are R.learnLevel\'s', !unknown.length || nextLine === `Next at a trainer: ${unknown.map((x) => `${x.name} (${R.learnLevel(s, x.id)})`).join(', ')}`, `${nextLine}`);
      await page.keyboard.press('KeyP'); await idle(page);
      // Abandon run: asked once
      const lvl0 = R.heroView(s).level;
      const bal0 = JSON.parse(await page.evaluate(() => localStorage.getItem('tbwcr.profile.v3'))).legacy;
      await page.getByRole('button', { name: 'Menu and settings' }).first().click(); await idle(page);
      const ab = page.locator('#win-settings .setrow.abandon button');
      const first = await ab.innerText();
      await ab.click(); await idle(page);
      const asked = { text: await ab.innerText(), phase: await page.evaluate(() => window.__ui.view().phase), note: await page.locator('#win-settings .setrow.abandon .muted').innerText() };
      await shot(page, 'Y5-abandon-ask');
      check('Y-5', 'the menu\'s "Abandon run" asks once (the first click only asks; the run goes on)', first === 'Abandon run' && asked.text === 'Abandon: click again' && asked.phase === 'MAP' && /Click again/.test(asked.note), JSON.stringify({ first, ...asked }));
      await ab.click(); await idle(page);
      for (let i = 0; i < 20 && (await page.evaluate(() => window.__ui.view().phase)) !== 'SUMMARY'; i++) await idle(page);
      s = await nodeState(); const sm = R.summary(s);
      const sv = await page.evaluate(() => ({ phase: window.__ui.view().phase, t2: (document.querySelector('.summary .shead .t2') || {}).innerText || '', settings: !!document.querySelector('#win-settings'),
        kv: [...document.querySelectorAll('.summary dl.kv dt')].map((d) => [d.innerText, d.nextElementSibling.innerText]) }));
      const ews = await echoWords(page, '.summary');
      await shot(page, 'Y5-abandon-summary');
      const ended = sv.kv.find((x) => x[0] === 'Ended');
      check('Y-5', 'the second click ends the run as a death where the hero stands (ABANDON_RUN): the summary says the run was abandoned, no "Killed by", no Echo word',
        sv.phase === 'SUMMARY' && s.outcome === 'death' && s.death && s.death.killer.name === 'abandon' && !sv.settings && /left the run$/.test(sv.t2) && !!ended && ended[1] === 'Abandoned from the menu' && !sv.kv.some((x) => x[0] === 'Killed by') && ews.length === 0 && sm.hero.level === lvl0,
        `${JSON.stringify(sv)} ${JSON.stringify(ews)}`);
      await page.getByRole('button', { name: 'Begin a new run' }).click(); await idle(page);
      const after = await page.evaluate(() => ({ card: document.querySelector('#create .ccard[data-cls="rogue"] .chero').innerText.trim(), v3: JSON.parse(localStorage.getItem('tbwcr.profile.v3')) }));
      check('Y-5', 'END_RUN pays the abandoned run\'s Legacy points (R.summary\'s total) and the hero keeps its level (runs + 1)',
        // Economy v2 (legacy.md 4.7 E1, LE1): kept camp points pay nothing, so an abandon soon after Set out may pay 0
        after.v3.legacy === bal0 + sm.legacy.total && !sm.legacy.lines.some((l) => l.id === 'reserve') && after.card === `Level ${lvl0}` && after.v3.heroes.rogue.level === lvl0 && after.v3.heroes.rogue.runs === 1,
        `${bal0} + ${sm.legacy.total} -> ${after.v3.legacy}; ${after.card}`);
    } catch (e) { await shot(page, 'Y5-error'); check('Y-5', 'part Y5 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Y-5', 'part Y5: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
// ------------------------------------------------------------------ part Y6: Legacy Economy v2 (D159-D160), ?legacy=1
/**
 * Part Y6 (docs/specs/legacy.md 4.7 E5-E6, engine-api.md 15.5; docs/handoffs/engine-2026-11-19c.md section 4,
 * ui-2026-11-19b.md): the ?legacy=1 set with C.GATES.economyV2 on. Y6a the hall: a version 3 profile that bought under the
 * old catalogue is refunded once (D160: the note "The Legacy hall has new prices ...", gone after reloadKeep, no second
 * refund); the cards read C.META_HERO (Vigor 0/2 at 70, hall v3d D167: "+3 % max health, then +1 %" from its rank list;
 * Deeper Pockets "+8 bag slots" for 50; the Hunter's Stormhawk 90), no retired entry, the level-20 wing
 * priced and "Not yet open". Y6b the second camp (profile runs 1): its line, the one name "camp points" (the number, its
 * tooltip, Set out's tooltip and log line, the tracker, the quest log), the board's exact XP (no "about"), no "Reserve",
 * "points left" or "Preparation points"; a zone 2 hub's offer "Take for N camp points (you have M)". Y6c the level-up
 * banner (hero 3 to 4; hero 19 to 20): one banner, its lines in order (health, the new spell or ranks, the Legacy line or
 * the trees line at 20), the XP bar flash and the hero frame glow. Y6d the run's end after Abandon: the confirmation's
 * line, Kept / Left behind, the balance against the next hall entry, "Level 19 → 20" in the summary and at hero select.
 */
const ECON = CONTENT.texts.economy;
const econFill = (id, v = {}) => ECON[id].replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined ? m : typeof v[k] === 'number' ? fmtN(v[k]) : String(v[k])))
  .replace(/(^|[^\d\s])(\s?)\b1 (contract|camp point|spell|Legacy point)s\b/g, '$1$2' + '1 $3'); // "1 contract" (ui-text.js econLine)
/**
 * Part Y6's expected next hall entry (the bridge's nextHall; blind Legacy v2, 2026-11-20): the first offer of the 4.7 E5
 * buying order that the balance buys, else any other it buys, else the cheapest available one; `cost` as the summary
 * writes it ("60 (52 more points)" when the balance does not buy it; screens.js hallCost).
 */
function yNextHall(p, classId) {
  const c = { rogue: 'r', mage: 'm', hunter: 'h' }[classId];
  const order = ['satchel', 'vigor', 'edge', 'quick_study', `sp_${c}1`, 'pockets', 'cartographer', 'vigor', 'edge', 'old_hand', 'quartermaster', 'quick_study', `sp_${c}2`, 'swift_boots', 'quartermaster', 'second_breath', ...(classId === 'hunter' ? ['stormhawk'] : [])];
  const pos = (o) => { const i = order.indexOf(o.id); return i < 0 ? order.length : i; };
  const open = R.metaOffers(p).filter((o) => o.available).sort((a, b) => pos(a) - pos(b));
  const o = open.find((x) => x.affordable && x.nextCost > 0) || open.find((x) => x.affordable) || open.filter((x) => x.nextCost > 0).reduce((b, x) => (!b || x.nextCost < b.nextCost ? x : b), null);
  if (!o) return null;
  const bal = p.legacy || 0; const short = Math.max(0, o.nextCost - bal);
  return { name: o.ranks > 1 ? `${o.name} ${['I', 'II'][o.rank]}` : o.name, cost: short > 0 ? `${fmtN(o.nextCost)} (${fmtN(short)} more ${short === 1 ? 'point' : 'points'})` : o.nextCost };
}
/** Records every level-up banner shown (title, lines) and whether the XP bar flashed and the hero frame glowed. */
const watchLevel = (page) => page.evaluate(() => {
  window.__y6 = { banners: [], flash: false, glow: false };
  const b = document.querySelector('#banner');
  new MutationObserver(() => { if (b.classList.contains('on') && b.classList.contains('hero')) { const v = window.__ui.view(); const rec = [b.querySelector('.b1').textContent, [...b.querySelectorAll('.b2 .bl')].map((x) => x.textContent), v.player ? v.player.maxHp : null, v.combat ? !!v.combat.over : null]; const last = window.__y6.banners[window.__y6.banners.length - 1]; if (!last || JSON.stringify(last) !== JSON.stringify(rec)) window.__y6.banners.push(rec); } }).observe(b, { attributes: true, childList: true, subtree: true, characterData: true });
  new MutationObserver(() => { if (document.querySelector('#xpbar').classList.contains('lvflash')) window.__y6.flash = true; }).observe(document.querySelector('#xpbar'), { attributes: true });
  new MutationObserver(() => { if (document.querySelector('#player-frame').classList.contains('lvglow')) window.__y6.glow = true; }).observe(document.querySelector('#player-frame'), { attributes: true });
});
async function partY6(browser, W, H) {
  const bad = /\bReserve\b|points left|Preparation points|Unspent camp points/;
  // ---- Y6a: the D160 refund note once, the hall from C.META_HERO, the level-20 wing
  {
    const old = (() => { const was = { ...R.C.GATES }; Object.assign(R.C.GATES, { legacy: true, economyV2: false }); try { let p = { ...R.newProfile(), legacy: 700, runs: 3, guide: 'done', welcome: true }; for (const id of ['satchel', 'vigor', 'vigor', 'keen']) p = R.buyMeta(p, id); return p; } finally { Object.assign(R.C.GATES, was); } })();
    const back = old.spent; const bal = old.legacy + old.spent;
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=5', { [Y_KEY]: JSON.stringify(old) });
    try {
      const read = () => page.evaluate(() => { const rf = document.querySelector('#create .ctitle .refund'); return { refund: rf && !rf.classList.contains('hidden') ? rf.innerText : null, v3: JSON.parse(localStorage.getItem('tbwcr.profile.v3')) }; });
      const a = await read();
      await shot(page, 'Y6a-refund-note');
      check('Y-6', 'D160: a version 3 profile bought under the old hall gets every Legacy point back once, its purchases cleared; the note says so (draft)',
        a.refund === `The Legacy hall has new prices. The ${fmtN(back)} Legacy points you had spent are back.` && a.v3.legacy === bal && a.v3.spent === 0 && Object.keys(a.v3.unlocks).length === 0 && a.v3.hallV2 === true, JSON.stringify({ refund: a.refund, legacy: a.v3.legacy, unlocks: a.v3.unlocks }));
      await page.locator('#create .bottom .echoes').click(); await idle(page);
      const hall = await page.evaluate(() => {
        const card = (id) => { const c = document.querySelector(`#meta .mcard[data-id="${id}"]`); return c ? { rk: c.querySelector('.rk') ? c.querySelector('.rk').innerText : null, fx: c.querySelector('.mc-fx').innerText, buy: c.querySelector('.buy') ? c.querySelector('.buy').innerText.replace(/\s+/g, ' ').trim() : null, tag: c.querySelector('.mtag') ? c.querySelector('.mtag').textContent : null, req: c.querySelector('.mc-req') ? c.querySelector('.mc-req').innerText.replace(/\s+/g, ' ').trim() : null } : null; };
        return { vigor: card('vigor'), edge: card('edge'), pockets: card('pockets'), storm: card('stormhawk'), quick: card('quick_study'), keen: card('keen'), cards: document.querySelectorAll('#meta .mcard:not(.wing)').length, wing: ['tree2', 'tree3', 'armoury'].map(card), head: (document.querySelector('#meta .mgroup.wing .mg-h .t') || {}).innerText || null,
          over: (() => { const w = document.querySelector('#meta .mwin').getBoundingClientRect(); return [...document.querySelectorAll('#meta .mcard')].filter((c) => { const r = c.getBoundingClientRect(); return r.bottom > w.bottom + 1 || r.right > w.right + 1; }).length; })(),
          body: document.querySelector('#meta .mbody').scrollHeight > document.querySelector('#meta .mbody').clientHeight + 2 };
      });
      await shot(page, 'Y6a-legacy-hall');
      // hall v3d (D167): the stat cards write each rank's value from C.META_HERO's lists; prices from the engine
      const pc = (x) => `${Math.round(x * 1000) / 10} %`;
      const H6 = R.C.META_HERO;
      check('Y-6', `the hall's cards read C.META_HERO (hall v3d): Vigor 0/2 for ${H6.vigor.costs[0]} at +${pc(H6.vigor.hpPct[0])} then +${pc(H6.vigor.hpPct[1])}, Edge +${pc(H6.edge.powerPct[0])} then +${pc(H6.edge.powerPct[1])}, Deeper Pockets +${H6.pockets.slots} for ${H6.pockets.costs[0]}, Stormhawk ${H6.stormhawk.costs[0]}, Quick Study +5 % a rank; no retired entry; 18 cards`,
        hall.vigor && hall.vigor.rk === `0/${H6.vigor.ranks}` && hall.vigor.buy === `Buy ${H6.vigor.costs[0]}` && hall.vigor.fx.includes(`+${pc(H6.vigor.hpPct[0])} max health, then +${pc(H6.vigor.hpPct[1])}`)
          && hall.edge && hall.edge.fx.includes(`+${pc(H6.edge.powerPct[0])} Power, then +${pc(H6.edge.powerPct[1])}`)
          && hall.pockets && hall.pockets.fx.includes(`+${H6.pockets.slots} bag slots`) && hall.pockets.buy === `Buy ${H6.pockets.costs[0]}`
          && hall.storm && hall.storm.buy === `Buy ${H6.stormhawk.costs[0]}`
          && /\+5 % experience per rank/.test(hall.quick.fx) && hall.keen === null && hall.cards === Object.keys(H6).length,
        JSON.stringify(hall));
      check('Y-6', 'the level-20 wing: second and third tree and the Armoury, priced (TREE_OPEN_COST, ARMOURY_COST) and "Not yet open", nothing to buy',
        hall.head === `From hero level ${R.C.TREE_OPEN_LEVEL}` && hall.wing.every((c) => c && c.tag === 'Not yet open' && c.buy === null) && hall.wing.map((c) => Number(c.req.replace(/^.*·\s*/, '').replace(/\D/g, ''))).join(',') === [...R.C.TREE_OPEN_COST, R.C.ARMOURY_COST].join(','),
        JSON.stringify(hall.wing));
      check('Y-6', 'the hall fits at this size (no card outside its window)', hall.over === 0, JSON.stringify({ over: hall.over, scroll: hall.body }));
      await page.keyboard.press('Escape'); await idle(page);
      const dropped = await reloadKeep(page); await idle(page);
      const b = await read();
      check('Y-6', 'after a reload: no note, no second refund', b.refund === null && b.v3.legacy === bal, `${JSON.stringify({ refund: b.refund, legacy: b.v3.legacy })}${dropped ? ` (storage put back after ${dropped} dropped reload(s))` : ''}`);
    } catch (e) { await shot(page, 'Y6a-error'); check('Y-6', 'part Y6a ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Y-6', 'part Y6a: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- Y6b: the second camp, "camp points", the hub offer
  {
    const prof = withLegacy(() => ({ ...R.newProfile(), runs: 1, guide: 'done', welcome: true }));
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=5', { [Y_KEY]: JSON.stringify(prof) });
    const nodeState = async () => R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const pv = R.prepView(await nodeState());
      const camp = await page.evaluate(() => ({ grown: (document.querySelector('#prep .pp-grown') || {}).innerText || null, n: document.querySelector('#prep .pm-n').innerText, l: document.querySelector('#prep .pm-l').innerText, all: document.querySelector('#prep').innerText }));
      const ptTip = await tipOf(page, page.locator('#prep .pm-points'));
      const goTip = await tipOf(page, page.locator('#pp-go'));
      const boardTip = pv.board.length ? await tipOf(page, page.locator('#prep .pp-card').first()) : '';
      await shot(page, 'Y6b-second-camp');
      check('Y-6', 'the second camp says what grew, once per profile (content second_camp with prepView.points)', camp.grown === econFill('second_camp', { points: pv.points }), JSON.stringify(camp.grown));
      // once per profile (qa-2026-11-19b): a reload in that camp (the run is not kept, the profile's runs still 1) and Enter
      // the world again: the profile carries the mark, no line
      {
        const dropped = await reloadKeep(page); await idle(page);
        await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
        const re = await page.evaluate((k) => ({ phase: window.__ui.view().phase, grown: !!document.querySelector('#prep .pp-grown'), seen: (JSON.parse(localStorage.getItem(k) || '{}') || {}).secondCampSeen === true, runs: (JSON.parse(localStorage.getItem(k) || '{}') || {}).runs }), Y_KEY);
        check('Y-6', 'after a reload in that camp the second camp line does not show again (profile secondCampSeen)', re.phase === 'PREP' && !re.grown && re.seen && re.runs === 1, `${JSON.stringify(re)}${dropped ? ` (storage put back after ${dropped} dropped reload(s))` : ''}`);
      }
      check('Y-6', 'the camp\'s number reads "camp points"; its tooltip is the content\'s camp points line; no Reserve / points left / Preparation points',
        camp.n === String(pv.left) && camp.l === 'camp points' && ptTip.startsWith('Camp points') && ptTip.includes(ECON.camp_points_tip) && !bad.test(camp.all) && !bad.test(ptTip), `${JSON.stringify({ n: camp.n, l: camp.l })} ${ptTip}`);
      check('Y-6', 'Set out\'s tooltip: "You set out with N contracts and M camp points."; the board\'s XP is exact (no "about")',
        goTip.includes(econFill('set_out', { contracts: pv.held, points: pv.left })) && !bad.test(goTip) && (!pv.board.length || (boardTip.includes(`Reward: ${fmtN(pv.board[0].reward.xp)} XP`) && !/about/.test(boardTip))), `${goTip} || ${boardTip}`);
      // take the first contract, then set out
      if (pv.board.length) { await page.keyboard.press('Digit1'); await idle(page); }
      const pv2 = R.prepView(await nodeState());
      await page.locator('#pp-go').click(); await idle(page);
      const log = await logLines(page);
      const trk = await page.evaluate(() => (document.querySelector('#tracker') || {}).innerText || '');
      check('Y-6', 'Set out\'s log line and the tracker say camp points (no Reserve)', log.includes(econFill('set_out', { contracts: pv2.held, points: pv2.left })) && trk.includes(econFill('tracker', { points: pv2.left })) && !bad.test(trk),
        `${log.filter((x) => /set out/.test(x)).join(' / ')} || ${trk.replace(/\n/g, ' / ')}`);
      await page.keyboard.press('KeyL'); await idle(page);
      const ql = await page.evaluate(() => (document.querySelector('.clog .cl-head') || {}).innerText || '');
      await shot(page, 'Y6b-quest-log');
      await page.keyboard.press('KeyL'); await idle(page);
      check('Y-6', 'the quest log\'s head says camp points', ql.includes(econFill('tracker', { points: pv2.left })) && !bad.test(ql), ql);
      // a zone 2 hub with its contract offer (the same run played on in Node, loaded into the page)
      let s = await nodeState();
      for (let i = 0; i < 4000 && !(s.phase === 'ZONE_HUB' && s.zone && s.zone.z === 2) && s.phase !== 'ENDED'; i++) s = R.step(s, R.autoAction(s)).state;
      const cv = R.contractView(s);
      if (s.phase === 'ZONE_HUB' && cv && cv.hub) {
        await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s)); await idle(page);
        const hub = await page.evaluate(() => ({ take: (document.querySelector('#screens .hubc [data-hub="reserve"]') || {}).innerText || null, all: (document.querySelector('#screens') || {}).innerText || '', trk: (document.querySelector('#tracker') || {}).innerText || '' }));
        const takeTip = await tipOf(page, page.locator('#screens .hubc [data-hub="reserve"]'));
        await shot(page, 'Y6b-hub-offer');
        check('Y-6', 'a hub\'s offer: "Take for N camp points (you have M)", its tooltip and the tracker without Reserve',
          hub.take === econFill('hub_offer', { price: cv.hub.price, points: cv.reserve }).replace(/\.$/, '') && !bad.test(hub.all) && !bad.test(takeTip) && !bad.test(hub.trk), `${hub.take} || ${takeTip}`);
      } else check('Y-6', 'a zone 2 hub with an offer was reached in Node', false, `${s.phase} zone ${s.zone && s.zone.z}`);
    } catch (e) { await shot(page, 'Y6b-error'); check('Y-6', 'part Y6b ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Y-6', 'part Y6b: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- Y6c-d: the level-up banner (3 to 4, then 19 to 20), Abandon's line, the run's end, hero select
  for (const [from, seed] of [[3, 7], [19, 9]]) {
    const prof = withLegacy(() => { let p = { ...R.newProfile(), runs: 3, guide: 'done', welcome: true }; p = R.debug.setHero(p, 'rogue', { level: from, xp: R.heroXpToNext(from) - 5 }); return p; });
    const { context, page, errors } = await openY(browser, W, H, `legacy=1&prep=1&speed=instant&seed=${seed}`, { [Y_KEY]: JSON.stringify(prof) });
    const nodeState = async () => R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
    const tag = `Y6c-${from}`;
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.keyboard.press('Enter'); await idle(page);
      await watchLevel(page);
      let heldMidFight = false;
      for (let i = 0; i < 400; i++) {
        const v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, hero: x.player && x.player.heroLevel }; });
        // the banner waits for the end of the fight (legacy.md 4.7 E6.4: after the victory, before the loot window)
        if (v.phase === 'SUMMARY' || (v.hero > from && (await page.evaluate(() => window.__y6.banners.length)) > 0)) break;
        if (v.hero > from) heldMidFight = heldMidFight || (await page.evaluate(() => { const x = window.__ui.view(); return !!(x.combat && !x.combat.over); }));
        await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
      }
      await shot(page, `${tag}-level-up`);
      const s = await nodeState(); const hv = R.heroView(s);
      const got = await page.evaluate(() => window.__y6);
      const ban = got.banners[got.banners.length - 1] || ['', [], null, null];
      const n = hv.level - from;
      const spells = Object.values(R.C.SPELL).filter((x) => x.cls === 'rogue' && x.source === 'class' && R.learnLevel(s, x.id) > from && R.learnLevel(s, x.id) <= hv.level).map((x) => x.name);
      const lines = ban[1];
      const lastWant = hv.level >= R.C.TREE_OPEN_LEVEL && from < R.C.TREE_OPEN_LEVEL ? ECON.level_hero20 : econFill('level_legacy', { legacy: R.C.LEGACY_PER_LEVEL * n });
      const hp = /^Health ([\d\s]+) → ([\d\s]+)$/.exec(lines[0] || '');
      check('Y-6', `the level-up banner (hero ${from} to ${hv.level}): one banner, "${n > 1 ? `Level ${hv.level} (+${n})` : `Level ${hv.level}`}", health before and after, the new spell or ranks, the last line ${hv.level >= 20 ? 'of the trees' : 'of the Legacy points'}`,
        hv.level > from && got.banners.length === 1 && ban[0] === (n > 1 ? econFill('level_title_multi', { level: hv.level, n }) : econFill('level_title', { level: hv.level })) && !!hp && Number(hp[2].replace(/\D/g, '')) === Math.round(ban[2]) && ban[3] !== false && Number(hp[1].replace(/\D/g, '')) < Number(hp[2].replace(/\D/g, ''))
          && spells.every((x) => lines.includes(econFill('level_new_spell', { spell: x }))) && (spells.length > 0 || lines.some((l) => /^Better ranks for \d+ spells at a trainer\.$/.test(l)) || lines.length >= 2) && lines[lines.length - 1] === lastWant,
        `${JSON.stringify(got.banners)} hero ${hv.level} spells ${spells.join(',')}${heldMidFight ? ' (held while the fight went on)' : ''}`);
      check('Y-6', `the level-up (hero ${from}): the XP bar flashes and the hero frame glows`, got.flash && got.glow, JSON.stringify({ flash: got.flash, glow: got.glow }));
      // Abandon: the confirmation's line, then the run's end
      await page.getByRole('button', { name: 'Menu and settings' }).first().click(); await idle(page);
      const ab = page.locator('#win-settings .setrow.abandon button');
      await ab.click(); await idle(page);
      const note = await page.locator('#win-settings .setrow.abandon .muted').innerText();
      await shot(page, `${tag}-abandon-ask`);
      check('Y-6', 'Abandon\'s confirmation is the content\'s line (what is kept and lost)', note === `${ECON.abandon_confirm} Click again to end it.`, note);
      await ab.click(); await idle(page);
      for (let i = 0; i < 20 && (await page.evaluate(() => window.__ui.view().phase)) !== 'SUMMARY'; i++) await idle(page);
      const s2 = await nodeState(); const sm = R.summary(s2); const pAfter = R.step(s2, { type: 'END_RUN' }).state.result.profile;
      const next = yNextHall(pAfter, 'rogue');
      const sv = await page.evaluate(() => ({ kept: (document.querySelector('.summary .s-kept') || {}).innerText || null, left: (document.querySelector('.summary .s-left') || {}).innerText || null, bal: (document.querySelector('.summary .s-balance') || {}).innerText || null,
        hero: (document.querySelector('.summary .s-hero') || {}).innerText || null, xpbar: !!document.querySelector('.summary .s-hero .s-xp i'), reserve: [...document.querySelectorAll('.summary .echo[data-line]')].map((x) => x.dataset.line).includes('reserve'), all: document.querySelector('.summary').innerText,
        fits: (() => { const r = document.querySelector('.summary').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; })() }));
      await shot(page, `${tag}-summary`);
      check('Y-6', 'the run\'s end: Kept (level now, was), Left behind, the balance against the next hall entry; no reserve line, no Reserve word; it fits',
        sv.kept === econFill('run_kept', { level: sm.hero.level, was: sm.hero.start.level }) && sv.left === ECON.run_left && next && sv.bal === econFill('run_balance', { legacy: pAfter.legacy, next: next.name, cost: next.cost }) && !sv.reserve && !bad.test(sv.all) && sv.fits,
        `${JSON.stringify({ kept: sv.kept, left: sv.left, bal: sv.bal, fits: sv.fits })} want next ${JSON.stringify(next)} legacy ${pAfter.legacy}`);
      check('Y-6', 'the summary\'s hero line reads "Level A → B" with the hero\'s XP bar', sv.hero && sv.hero.startsWith(`${econFill('level_progress', { from: sm.hero.start.level, to: sm.hero.level })} · +`) && sv.xpbar, sv.hero);
      await page.getByRole('button', { name: 'Begin a new run' }).click(); await idle(page);
      const card = await page.evaluate(() => document.querySelector('#create .ccard[data-cls="rogue"] .chero .ch-l').innerText.trim());
      await shot(page, `${tag}-hero-select`);
      check('Y-6', 'hero select: the hero of the run just ended reads "Level A → B"', card === econFill('level_progress', { from: sm.hero.start.level, to: sm.hero.level }), card);
    } catch (e) { await shot(page, `${tag}-error`); check('Y-6', `part ${tag} ran to the end`, false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Y-6', `part ${tag}: no console errors`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
// ------------------------------------------------------------------ part Z: the Legacy bugs of 2026-11-19
/**
 * Part Z: the Legacy bugs of the blind returning-player check (docs/feedback/2026-11-19-blind-legacy-returning.md, "Wrong or
 * confusing"; docs/handoffs/engine-2026-11-19b.md), ?legacy=1. Z1 a Rogue hero at level 3 (seed 11, whose board has no zone 1
 * contract): the start camp names the zone it sets out for; the Cull card's line says "marked" sites; in a fight the tracker
 * gives way to a nameplate under it; Abandon run: no "You have died", no toast over the summary, no time estimate for a run
 * without a fight, the Furnace line without "0 Infernal". Z2 a first run to its death (seed 11): the summary fits at this
 * size, the Furnace's last line in view and clear of the buttons. Z3 the loot window with full bags: Leave stays under the
 * pointer between its two clicks. Z4 a quest reward's Equip now on a dimmed node (the Dimmed encounter starts at once) and
 * with full bags: the item is worn.
 */
async function partZ(browser, W, H) {
  const prof = withLegacy(() => { let p = { ...R.newProfile(), runs: 3, guide: 'done', welcome: true, legacy: 40 }; p = R.debug.setHero(p, 'rogue', { level: 3, xp: 0 }); return p; });
  const auto = async (page, until, n = 300) => { for (let i = 0; i < n && !(await page.evaluate(until)); i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); } };
  const nodeState = async (page) => R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
  const toastsNow = (page) => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.innerText));
  // ---- Z1
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=11', { [Y_KEY]: JSON.stringify(prof) });
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const pv = R.prepView(await nodeState(page));
      const head = await page.locator('#prep .pp-t2').innerText();
      const z1 = CONTENT.zones[0].name;
      check('Z-1', `the start camp names the zone the run sets out for (${z1}), also when the board holds no zone 1 contract (s0241)`,
        !pv.board.some((o) => o.z === 1) && head.includes(`the road to ${z1}.`), `${head} board zones ${pv.board.map((o) => o.z).join(',')}`);
      const dos = await page.evaluate(() => [...document.querySelectorAll('#prep .pp-card .pc-do')].map((e) => e.textContent));
      const culls = pv.board.map((o, i) => [o, dos[i]]).filter(([o]) => o.kind === 'cull');
      check('Z-1', 'a Cull card says "Win N marked sites in <region>" (s0133: which nodes count)', culls.length > 0 && culls.every(([o, d]) => d === `Win ${o.need} marked ${o.need === 1 ? 'site' : 'sites'} in ${o.regionName}`), JSON.stringify(dos));
      const ci = pv.board.findIndex((o) => o.kind === 'cull');
      const bt = await tipText(page, page.locator('#prep .pp-card').nth(ci));
      check('Z-1', 'the Cull offer\'s tooltip says that only the marked Quest or Grind nodes count and other fights do not', /Win \d fights on Quest or Grind nodes that carry its mark, most of them in .+\. Other fights do not count\./.test(bt), bt.replace(/\n/g, ' / '));
      await page.keyboard.press('Enter'); await idle(page);
      await auto(page, () => window.__ui.view().phase !== 'PREP', 10);
      const zn = await page.evaluate(() => window.__ui.view().zone.name);
      check('Z-1', 'and the run arrives there', zn === z1, zn);
      // a fight: the tracker gives way to a nameplate under it (s0096), and comes back when none is
      await auto(page, () => { const v = window.__ui.view(); return !!(v.combat && !v.combat.over && v.combat.round >= 1 && !v.loot); }, 200);
      await page.waitForTimeout(300);
      const has = await page.evaluate(() => { const t = document.querySelector('#tracker'); return { kids: t.childElementCount, cls: t.className, np: document.querySelectorAll('#nameplates .np').length }; });
      const yieldAt = (top) => page.evaluate(async (y) => {
        const t = document.querySelector('#tracker');
        t.style.top = y == null ? '' : `${y}px`;
        await new Promise((r) => setTimeout(r, 400));
        const r = t.getBoundingClientRect();
        const over = [...document.querySelectorAll('#nameplates .np')].filter((e) => e.style.opacity !== '0').some((e) => { const q = e.getBoundingClientRect(); return q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; });
        return { yield: t.classList.contains('yield'), over, op: getComputedStyle(t).opacity };
      }, top);
      const npBox = await page.evaluate(() => { const e = [...document.querySelectorAll('#nameplates .np')].filter((x) => x.style.opacity !== '0').sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0]; const q = e.getBoundingClientRect(); return { top: q.top, right: q.right }; });
      const natural = await yieldAt(null);
      // the tracker moved over the rightmost nameplate (its right edge is the window's minus 1.8rem): it must give way
      const forced = npBox.right > W * 0.6 ? await yieldAt(Math.round(npBox.top)) : null;
      const back = await yieldAt(null);
      await shot(page, 'Z1-fight-tracker');
      check('Z-1', 'in a fight the tracker never lies over a shown nameplate: it gives way while one is under it (.yield, opacity 0) and comes back after (s0096)',
        has.kids > 0 && has.np > 0 && natural.yield === natural.over && (!forced || (forced.over && forced.yield && forced.op === '0')) && back.yield === back.over,
        JSON.stringify({ has, natural, forced, back, npBox }));
    } catch (e) { await shot(page, 'Z1-error'); check('Z-1', 'part Z1 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Z-1', 'part Z1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- Z1b: set out and abandon at once (the tester's run 4, s0247)
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=11', { [Y_KEY]: JSON.stringify(prof) });
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.keyboard.press('Enter'); await idle(page);
      await auto(page, () => window.__ui.view().phase !== 'PREP', 10);
      // Abandon run
      await page.evaluate(() => { window.__zDeath = false; const d = document.querySelector('.deathmsg').parentElement; new MutationObserver(() => { if (!d.classList.contains('hidden')) window.__zDeath = true; }).observe(d, { attributes: true }); });
      await page.getByRole('button', { name: 'Menu and settings' }).first().click(); await idle(page);
      const ab = page.locator('#win-settings .setrow.abandon button');
      await ab.click(); await idle(page); await ab.click();
      for (let i = 0; i < 20 && (await page.evaluate(() => window.__ui.view().phase)) !== 'SUMMARY'; i++) await idle(page);
      await page.locator('.summary').waitFor(); await idle(page);
      const sm = R.summary(await nodeState(page));
      const sv = await page.evaluate(() => ({ death: window.__zDeath, kv: [...document.querySelectorAll('.summary dl.kv dt')].map((d) => d.innerText), foot: document.querySelector('.summary .hc-foot').innerText }));
      const tt = await toastsNow(page); const lines = await logLines(page);
      await shot(page, 'Z1-abandon-summary');
      check('Z-1', 'Abandon run: no "You have died" screen, no toast over the summary ("You abandon the run." in the log only; s0236, s0247)',
        !sv.death && tt.length === 0 && lines.join(' ').includes('You abandon the run.'), JSON.stringify({ death: sv.death, tt, last: lines.slice(-3) }));
      check('Z-1', 'a run without a fight shows no time estimate (s0247); the Furnace names no "0 Infernal" (s0059)',
        sm.fights === 0 && !sv.kv.includes('Play time') && sv.kv.includes('Fights') && !/\b0 (Calm|Smouldering|Burning|Infernal)\b/.test(sv.foot) && /^No node entered\./.test(sv.foot), JSON.stringify(sv));
    } catch (e) { await shot(page, 'Z1b-error'); check('Z-1', 'part Z1b ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Z-1', 'part Z1b: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- Z2: a first run to its death; the summary at this size
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&guide=0&seed=11', {});
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await auto(page, () => window.__ui.view().phase === 'SUMMARY', 3000);
      await page.locator('.summary .hc-foot').waitFor(); await page.waitForTimeout(3200); // the death screen
      const s = await nodeState(page);
      const sm = R.summary(s);
      const foot = page.locator('.summary .hc-foot');
      const p0 = await placement(foot);
      const geo = await page.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(); const b = r('.summary .sbody'); const f = r('.summary .sfoot'); const x = document.querySelector('.summary .sbody'); return { bodyBottom: b.bottom, footTop: f.top, scroll: x.scrollHeight - x.clientHeight, text: document.querySelector('.summary .hc-foot').innerText, kv: [...document.querySelectorAll('.summary dl.kv dt')].map((d) => d.innerText) }; });
      await shot(page, 'Z2-summary');
      const ent = R.C.HEAT_STATES.map((st, i) => [st, sm.heat.nodesByState[i]]).filter(([, n]) => n > 0);
      const name = { clear: 'Calm', warm: 'Smouldering', hot: 'Burning', scorched: 'Infernal' };
      const dim = sm.expedition.dimFights;
      check('Z-2', 'the summary of a death: the Furnace\'s last line is in view without a scroll and not under the buttons (s0059), the body ends above them',
        s.outcome === 'death' && fullyShown(p0) && geo.bodyBottom <= geo.footTop + 0.5 && geo.scroll <= 1, `${placeText(p0)} ${JSON.stringify(geo)}`);
      check('Z-2', `the Furnace line names only the states nodes were entered in (${ent.map(([st, n]) => `${n} ${name[st]}`).join(' · ')}) and the Dimmed encounters (${dim})`,
        geo.text.startsWith(`Nodes entered, by the state you entered them in: ${ent.map(([st, n]) => `${n} ${name[st]}`).join(' · ')}.`) && (dim ? geo.text.includes(`The Dimming caught you ${dim === 1 ? 'once' : `${dim} times`} (Infernal where it stands).`) : !/Dimming/.test(geo.text)) && geo.kv.includes('Play time'),
        geo.text);
    } catch (e) { await shot(page, 'Z2-error'); check('Z-2', 'part Z2 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Z-2', 'part Z2: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- Z3: the loot window with full bags; Z4: a reward's Equip now
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&guide=0&seed=11', {});
    const fill = (s) => { for (let k = 0; s.player.bag.length < withLegacy(() => R.bagCapacity(s)); k++) s.player.bag.push({ uid: `zj${k}`, kind: 'junk', id: 'junk', name: 'Bent Nail', rarity: 'poor', value: 1, count: 1, ilvl: 1 }); return s; };
    const load = async (s) => { await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s)); await idle(page); };
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await auto(page, () => { const v = window.__ui.view(); return v.phase === 'MAP' && !v.loot; }, 80);
      await load(fill(await nodeState(page)));
      await auto(page, () => { const v = window.__ui.view(); return v.phase === 'SUMMARY' || !!(v.loot && v.loot.kind === 'loot' && v.loot.items.some((it) => it.pending)); }, 300);
      const leave = page.locator('.loot .foot').getByRole('button', { name: 'Leave' });
      const b0 = await leave.boundingBox();
      await leave.click(); await idle(page);
      const b1 = await leave.boundingBox();
      const ask = await page.locator('.loot .foot .lleave').innerText().catch(() => null);
      const askShown = await placement(page.locator('.loot .foot .lleave'));
      await shot(page, 'Z3-loot-leave-ask');
      await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2); await idle(page);
      const gone = await page.evaluate(() => !document.querySelector('.loot .foot .lleave'));
      check('Z-3', 'loot with full bags: Leave stays where it was between the first click (the ask) and the second, which leaves (s0152, s0154)',
        !!b0 && !!b1 && Math.abs(b0.x - b1.x) < 0.5 && Math.abs(b0.y - b1.y) < 0.5 && Math.abs(b0.width - b1.width) < 0.5 && /^Leave \d+ items? behind\? Click Leave again\.$/.test(ask || '') && fullyShown(askShown) && gone,
        JSON.stringify({ b0, b1, ask, ask2: placeText(askShown), gone }));
    } catch (e) { await shot(page, 'Z3-error'); check('Z-3', 'part Z3 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Z-3', 'part Z3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&guide=0&seed=11', {});
    const fill = (s) => { for (let k = 0; s.player.bag.length < withLegacy(() => R.bagCapacity(s)); k++) s.player.bag.push({ uid: `zj${k}`, kind: 'junk', id: 'junk', name: 'Bent Nail', rarity: 'poor', value: 1, count: 1, ilvl: 1 }); return s; };
    const load = async (s) => { await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s)); await idle(page); };
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      // Z4: a quest's item choice on a dimmed node, and with full bags
      await auto(page, () => { const v = window.__ui.view(); return v.phase === 'SUMMARY' || !!(v.loot && v.loot.kind !== 'loot' && document.querySelector('#screens .choice-cards .eqnow')); }, 600);
      const base = await nodeState(page);
      if (!(base.node && base.node.stage === 'reward')) throw new Error(`no quest reward with Equip now (${base.phase})`);
      const card = await page.evaluate(() => { const b = document.querySelector('#screens .choice-cards .eqnow'); return { uid: b.dataset.uid, i: [...document.querySelectorAll('#screens .choice-cards .icard')].indexOf(b.closest('.icard')) }; });
      const it = base.node.rewards[0].items[card.i];
      const dimmed = R.deserialize(R.serialize(base), CONTENT);
      dimmed.zone.start = dimmed.time - withLegacy(() => dimAtZ(dimmed.zone, dimmed.zone.pos)) - 1;
      await load(dimmed);
      await page.locator('#screens .choice-cards .eqnow').nth(0).click(); await idle(page);
      const a = await nodeState(page); const tt = await toastsNow(page);
      await shot(page, 'Z4-equip-dimmed');
      check('Z-4', 'Equip now on a quest reward whose node has dimmed: the item is worn and the Dimmed encounter starts; no refusal (s0044)',
        a.player.equipped[it.slot] && a.player.equipped[it.slot].uid === it.uid && !!a.fight && a.node && a.node.type === 'dim' && !tt.some((t) => /not allowed/i.test(t)), JSON.stringify({ worn: a.player.equipped[it.slot] && a.player.equipped[it.slot].uid, want: it.uid, fight: !!a.fight, node: a.node && a.node.type, tt }));
      await load(fill(R.deserialize(R.serialize(base), CONTENT)));
      await page.locator('#screens .choice-cards .eqnow').nth(0).click(); await idle(page);
      const f = await nodeState(page);
      const win = await page.evaluate(() => { const v = window.__ui.view(); return v.loot ? { title: v.loot.title, items: v.loot.items.map((x) => x.uid) } : null; });
      await shot(page, 'Z4-equip-full-bags');
      check('Z-4', 'Equip now with full bags: the item is worn, not sent to "Items waiting" (s0160; the old item may wait there)',
        f.player.equipped[it.slot] && f.player.equipped[it.slot].uid === it.uid && !(win && win.items.includes(it.uid)), JSON.stringify({ worn: f.player.equipped[it.slot] && f.player.equipped[it.slot].uid, win }));
    } catch (e) { await shot(page, 'Z4-error'); check('Z-4', 'part Z4 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('Z-4', 'part Z4: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part AA: blind Legacy v2, hall and bags (2026-11-20)
/**
 * Part BC: demo blind round 1, B and C (BACKLOG 2026-11-26; docs/feedback/2026-11-26-blind-demo-skipper.md, -newcomer.md;
 * docs/handoffs/ui-2026-11-26b.md; every line a draft). BC1, a fresh profile with hints off: at the first map the Furnace's
 * one sentence (heat.js FURNACE_LINE) in the note at the coach line's place, the meter ringed; the note takes no clicks but
 * its button's; it goes with the first step off the map and never comes back (tbwcr.furnaceNote.v1, H16 marked seen); the
 * Road signs read "Next zone"; the Key's icons carry their names. BC2, zone 2 (Dev build): the Bell's button says where it
 * takes you and its number ("(1 left)"), its tip the destination and what the number means; the confirm dialog highlights
 * the Bell, not Stay; no tooltip covers the dialog (the Bell's own, a map node's). BC3: walking towards the Dimming until
 * the Bell's preview holds a Dimming fight: the tip and the dialog say so before the click.
 */
async function partBC(browser, W, H) {
  const tipRect = (page) => page.evaluate(() => { const t = document.querySelector('.tooltip'); if (!t || !t.classList.contains('on') || t.classList.contains('off-dialog')) return null; const a = t.getBoundingClientRect(); return [a.left, a.top, a.right, a.bottom]; });
  const dlgRect = (page) => page.evaluate(() => { const d = document.querySelector('#screens .leavewarn'); if (!d) return null; const a = d.getBoundingClientRect(); return [a.left, a.top, a.right, a.bottom]; });
  const meets = (a, b) => !!a && !!b && a[0] < b[2] - 1 && a[2] > b[0] + 1 && a[1] < b[3] - 1 && a[3] > b[1] + 1;
  const auto = async (page) => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };
  // ---- BC1: the first map
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1&fresh=1');
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 40 && (await page.evaluate(() => window.__ui.view().phase)) !== 'MAP'; i++) {
        const hub = await page.evaluate(() => ({ phase: window.__ui.view().phase, note: !document.querySelector('#heat-intro').classList.contains('hidden') }));
        if (hub.note) check('BC-1', 'the Furnace note shows before the first map', false, JSON.stringify(hub));
        await auto(page);
      }
      await page.mouse.move(2, 2); await page.waitForTimeout(300);
      const n = await page.evaluate(() => {
        const e = document.querySelector('#heat-intro'); const r = e.getBoundingClientRect(); const mid = document.elementFromPoint(r.left + 8, r.top + r.height / 2);
        const map = document.querySelector('#screens .expmap'); const m = map ? map.getBoundingClientRect() : null;
        return { phase: window.__ui.view().phase, shown: !e.classList.contains('hidden'), text: (e.querySelector('.hi-b') || {}).textContent || '', noted: document.querySelector('#heat').classList.contains('noted'),
          clickThrough: !(mid && mid.closest('#heat-intro')), rect: [r.left, r.top, r.right, r.bottom].map(Math.round), mapBottom: m ? Math.round(m.bottom) : null,
          signs: [...document.querySelectorAll('#screens .expmap .xroad .xsign b')].map((b) => b.textContent),
          key: [...document.querySelectorAll('#screens .expmap .xkey .xki b')].filter((b) => b.getClientRects().length && b.getBoundingClientRect().width > 0).map((b) => b.textContent) };
      });
      await shot(page, 'BC1-first-map');
      check('BC-1', `the first map, hints off: the Furnace's sentence ("${FURNACE_LINE}") in its note, the meter ringed, the note takes no clicks but its button's`,
        n.phase === 'MAP' && n.shown && n.text === FURNACE_LINE && n.noted && n.clickThrough, JSON.stringify(n));
      check('BC-1', 'zone 1\'s Roads read "Next zone" from the first view (closed or not); the Key names its 9 icons', n.signs.length >= 1 && n.signs.every((x) => x.includes(EXIT_WORDS.nextZone)) && n.key.length === 9, JSON.stringify({ signs: n.signs, key: n.key }));
      for (let i = 0; i < 20 && (await page.evaluate(() => window.__ui.view().phase)) === 'MAP'; i++) await auto(page);
      const off = await page.evaluate(([nk]) => ({ phase: window.__ui.view().phase, shown: !document.querySelector('#heat-intro').classList.contains('hidden'), noted: document.querySelector('#heat').classList.contains('noted'),
        stored: Object.keys(localStorage).filter((k) => k.endsWith(nk.slice('tbwcr.'.length))).map((k) => localStorage.getItem(k)), h16: window.__ui.coach().store.seen.H16 || false }), [NOTE_KEY]);
      let back = null;
      for (let i = 0; i < 80 && !back; i++) { await auto(page); const v = await page.evaluate(() => ({ phase: window.__ui.view().phase, node: !!window.__ui.view().node, shown: !document.querySelector('#heat-intro').classList.contains('hidden') })); if (v.phase === 'MAP' && !v.node) back = v; }
      check('BC-1', 'the note goes with the first step off the map, is stored as shown and marks H16 seen; back on the map it does not come again',
        off.phase !== 'MAP' && !off.shown && !off.noted && off.stored.includes('1') && off.h16 === true && !!back && !back.shown, JSON.stringify({ off, back }));
    } catch (e) { await shot(page, 'BC1-error'); check('BC-1', 'part BC1 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('BC-1', 'part BC1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- BC2: the Bell in zone 2, its tip and its confirm dialog
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1');
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page);
      await page.mouse.move(2, 2); await page.waitForTimeout(300);
      const v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, z: x.zone.idx, bell: x.zone.exp.bell, next: (window.__ui.view().zone || {}).name }; });
      const zs = CONTENT.zones || []; const to = zs[v.z] ? zs[v.z].name : null;
      const b = page.locator('#screens .expmap [data-leave="RING_BELL"]');
      const label = (await b.innerText()).trim();
      await b.hover(); await page.waitForTimeout(200);
      const tip = await page.evaluate(() => { const t = document.querySelector('.tooltip.on'); return t ? t.innerText.replace(/\s+/g, ' ') : null; });
      await shot(page, 'BC2-bell-tip');
      check('BC-2', `the Bell's button says where it goes and its number ("${bellLabel(v.bell.charges, 'next')}"); its tip: "${bellLine('next', to)}" and "${bellCharges(v.bell.charges)}"`,
        label === bellLabel(v.bell.charges, 'next') && !!tip && tip.startsWith(EXIT_WORDS.bellTitle) && tip.includes(bellLine('next', to)) && tip.includes(bellCharges(v.bell.charges)), JSON.stringify({ label, tip }));
      await b.click(); await idle(page);
      const btns = await page.evaluate(() => [...document.querySelectorAll('#screens .leavewarn .lw-b button')].map((x) => ({ t: x.textContent.trim(), primary: x.classList.contains('primary'), danger: x.classList.contains('danger') })));
      check('BC-2', 'the confirm dialog highlights the action chosen ("Ring the Bell"), not Stay', btns.length === 2 && btns[0].t === 'Ring the Bell' && btns[0].primary && !btns[1].primary && btns[1].t === 'Stay', JSON.stringify(btns));
      // the Bell's own tip again, and a map node's next to the dialog: neither covers it
      const over = [];
      await page.mouse.move(2, 2); await b.hover(); await page.waitForTimeout(200);
      over.push({ what: 'bell', tip: await tipRect(page), dlg: await dlgRect(page) });
      for (const sel of ['#screens .expmap .mnode.xhub', '#screens .expmap .mnode.reach']) {
        const el = page.locator(sel).first(); if (!(await el.count())) continue;
        await page.mouse.move(2, 2); await el.hover({ force: true }); await page.waitForTimeout(200);
        over.push({ what: sel, tip: await tipRect(page), dlg: await dlgRect(page) });
      }
      await shot(page, 'BC2-bell-dialog');
      check('BC-2', 'with the dialog open no tooltip covers it (the Bell\'s, the hub\'s, a reachable node\'s)', over.length >= 2 && over.every((x) => x.dlg && !meets(x.tip, x.dlg)), JSON.stringify(over));
      await page.keyboard.press('Escape'); await idle(page);
      check('BC-2', 'Esc closes the dialog', !(await page.locator('#screens .leavewarn').count()));
    } catch (e) { await shot(page, 'BC2-error'); check('BC-2', 'part BC2 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('BC-2', 'part BC2: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- BC3: a ring that ends in a Dimming fight says so before the click
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&prep=1');
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 40 && (await page.evaluate(() => window.__ui.view().phase)) !== 'ZONE_HUB'; i++) await auto(page);
      await page.evaluate(() => window.__ui.dev('nextZone')); await idle(page);
      await page.evaluate(() => window.__ui.dev('god', { on: true })); await idle(page);
      let met = null;
      for (let i = 0; i < 300 && !met; i++) {
        const v = await page.evaluate(() => { const x = window.__ui.view(); const mv = x.zone && x.zone.exp; const p = x.heat && x.heat.next && x.heat.next.RING_BELL;
          return { phase: x.phase, node: !!x.node, p: p || null, inDim: !!(mv && mv.nodes[mv.pos] && mv.nodes[mv.pos].dimmed), moves: mv && x.phase === 'MAP' && !x.node ? mv.moves.map((m) => ({ id: m.nodeId, d: mv.nodes[m.nodeId].dimsIn, dimmed: !!mv.nodes[m.nodeId].dimmed, pass: m.passTime != null && !m.barred })) : [] }; });
        const line = leaveFightLine(v.p, v.inDim);
        if (v.phase === 'MAP' && !v.node && line) { met = { line }; break; }
        if (v.phase === 'MAP' && !v.node && v.moves.length) {
          const ok = v.moves.filter((m) => !m.dimmed && m.d != null).sort((a, b) => a.d - b.d); const t = ok[0] || v.moves[0];
          const r = await page.evaluate(([id, pass]) => window.__ui.act({ type: pass ? 'PASS_THROUGH' : 'MOVE', nodeId: id }), [t.id, t.pass]);
          if (r && r.ok === false) await auto(page); else await idle(page);
        } else await auto(page);
      }
      if (met) {
        const b = page.locator('#screens .expmap [data-leave="RING_BELL"]');
        await page.mouse.move(2, 2); await b.hover(); await page.waitForTimeout(200);
        met.tip = await page.evaluate(() => { const t = document.querySelector('.tooltip.on .lw-fight'); return t ? t.textContent : null; });
        await b.click(); await idle(page);
        met.dlg = await page.evaluate(() => { const d = document.querySelector('#screens .leavewarn'); const f = d && d.querySelector('.lw-fight'); return { first: d ? d.querySelector('.lw-t + *') === f : false, text: f ? f.textContent : null }; });
        await shot(page, 'BC3-bell-fight');
        await page.keyboard.press('Escape'); await idle(page);
      }
      check('BC-3', 'the Bell\'s preview holds a Dimming fight: its tip and its dialog (first line under the title) say so before the click',
        !!met && met.tip === met.line && met.dlg.first && met.dlg.text === met.line, JSON.stringify(met));
    } catch (e) { await shot(page, 'BC3-error'); check('BC-3', 'part BC3 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('BC-3', 'part BC3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

/**
 * Part AA: the hall and the bags of the second blind Legacy check (docs/feedback/2026-11-20-blind-legacy-returning-v2.md;
 * BACKLOG 2026-11-20 "hall" and "bags and loot"), ?legacy=1 (economyV2 on). AA1 the hall of a Hunter profile owning Packed
 * Satchel and Deeper Pockets: each Lost Technique card says its learn level on its face ("From hero level 9"; II: what it
 * needs and "from hero level 17"), the level-20 wing says "Per hero" on its face, the card text is in view; "One unlock
 * within reach." with exactly one Buy button enabled. AA2 the run end of that profile at 63 and at 8 Legacy points: "Next in
 * the hall" names Cartographer 60 (the one unlock within reach), or "60 (52 more points)" with none (the bridge's nextHall,
 * R.metaOffers of a Node END_RUN). AA3 full bags (seed 11 Rogue): the reward window's full-bags line is BAGS_FULL, Equip
 * now's tooltip says the worn piece is left behind, Equip now leaves no "Items waiting" window and one line names the piece;
 * an item waiting in the loot window: Leave's ask counts the rows it marks "left behind", and only those; a Take the bags
 * cannot hold answers BAGS_FULL. AA4 a Hunter with an Intellect piece in the bags (stronger by item score than the worn
 * one): no upgrade arrow in the bags, its tooltip says "Not an upgrade"; the Bags button's "+N items" never counts more than
 * the bags hold along the way.
 */
async function partAA(browser, W, H) {
  const was = { ...R.C.GATES }; Object.assign(R.C.GATES, { legacy: true, oruvathLegacy: true, economyV2: true });
  try { await partAA0(browser, W, H); } finally { Object.assign(R.C.GATES, was); }
}
async function partAA0(browser, W, H) {
  const hunter = (bal) => { let p = { ...R.newProfile(), runs: 3, guide: 'done', welcome: true, legacy: 500 }; p = R.buyMeta(p, 'satchel'); p = R.buyMeta(p, 'pockets'); p.legacy = bal; return R.debug.setHero(p, 'hunter', { level: 3, xp: 0 }); };
  const auto = async (page, until, n = 300) => { for (let i = 0; i < n && !(await page.evaluate(until)); i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); } };
  const nodeState = async (page) => R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
  const load = async (page, s) => { await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s)); await idle(page); };
  const fill = (s, free = 0) => { for (let k = 0; s.player.bag.length < R.bagCapacity(s) - free; k++) s.player.bag.push({ uid: `aj${k}`, kind: 'junk', id: 'junk', name: 'Bent Nail', rarity: 'poor', value: 1, qty: 1, level: 1 }); return s; };
  // ---- AA1: the hall's cards
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=5', { [Y_KEY]: JSON.stringify(hunter(63)) });
    try {
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      await page.locator('#create .bottom .echoes').click(); await idle(page);
      const hall = await page.evaluate(() => {
        const win = document.querySelector('#meta .mbody').getBoundingClientRect();
        const card = (id) => { const c = document.querySelector(`#meta .mcard[data-id="${id}"]`); const q = c && c.querySelector('.mc-req'); const r = q && q.getBoundingClientRect(); const cr = c && c.getBoundingClientRect();
          return c ? { req: q ? q.innerText.replace(/\s+/g, ' ').trim() : null, fx: c.querySelector('.mc-fx').innerText, seen: !!r && r.height > 0 && r.top >= cr.top - 0.5 && r.bottom <= cr.bottom + 0.5 && r.top >= win.top - 0.5 && r.bottom <= win.bottom + 0.5 } : null; };
        return { ids: ['sp_r1', 'sp_m1', 'sp_h1', 'sp_r2', 'sp_m2', 'sp_h2', 'tree2', 'tree3', 'vigor', 'cartographer'].map((id) => [id, card(id)]), tick: document.querySelector('#meta .mtick').innerText.trim(),
          enabled: [...document.querySelectorAll('#meta .mcard .buy')].filter((b) => !b.disabled).map((b) => b.dataset.id) };
      });
      const c = Object.fromEntries(hall.ids);
      await shot(page, 'AA1-hall');
      const l1 = R.learnLevel({ legacy: true }, 'ricochet_bolt'); const l2 = R.learnLevel({ legacy: true }, R.C.META.sp_h2.spell);
      check('AA-1', `each Lost Technique I card says "From hero level ${l1}" on its face, in view (s0564)`, ['sp_r1', 'sp_m1', 'sp_h1'].every((id) => c[id] && c[id].req === `From hero level ${l1}` && c[id].seen), JSON.stringify(hall.ids.slice(0, 3)));
      check('AA-1', `each Lost Technique II card: "Needs Lost Technique I (class) · from hero level ${l2}" on its face`,
        [['sp_r2', 'Rogue'], ['sp_m2', 'Mage'], ['sp_h2', 'Hunter']].every(([id, cl]) => c[id] && c[id].req === `Needs Lost Technique I (${cl}) · from hero level ${l2}` && c[id].seen), JSON.stringify(hall.ids.slice(3, 6)));
      check('AA-1', 'the level-20 trees say "Per hero" and "From hero level 20" on their faces; entries without a condition show none',
        ['tree2', 'tree3'].every((id) => c[id] && /Per hero\./.test(c[id].fx) && c[id].req.startsWith(`From hero level ${R.C.TREE_OPEN_LEVEL}`)) && c.vigor.req === null && c.cartographer.req === null, JSON.stringify([c.tree2, c.tree3, c.vigor.req, c.cartographer.req]));
      check('AA-1', 'with 63 points "One unlock within reach." and exactly that one Buy button enabled (Cartographer)', hall.tick === 'One unlock within reach.' && hall.enabled.join(',') === 'cartographer', JSON.stringify({ tick: hall.tick, enabled: hall.enabled }));
    } catch (e) { await shot(page, 'AA1-error'); check('AA-1', 'part AA1 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('AA-1', 'part AA1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- AA2: the run end's next hall entry at 63 and at 8 points
  for (const bal of [63, 8]) {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&seed=5', { [Y_KEY]: JSON.stringify(hunter(bal)) });
    try {
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await auto(page, () => window.__ui.view().phase !== 'PREP', 10);
      await page.getByRole('button', { name: 'Menu and settings' }).first().click(); await idle(page);
      const ab = page.locator('#win-settings .setrow.abandon button');
      await ab.click(); await idle(page); await ab.click(); await idle(page);
      for (let i = 0; i < 20 && (await page.evaluate(() => window.__ui.view().phase)) !== 'SUMMARY'; i++) await idle(page);
      const pAfter = R.step(await nodeState(page), { type: 'END_RUN' }).state.result.profile;
      const next = yNextHall(pAfter, 'hunter'); const reach = R.metaOffers(pAfter).filter((o) => o.affordable).length;
      const sv = await page.evaluate(() => ({ bal: (document.querySelector('.summary .s-balance') || {}).innerText || null, reach: [...document.querySelectorAll('.summary .card .muted')].map((x) => x.innerText).find((t) => /unlock|Keep them/.test(t)) || null,
        fits: (() => { const e = document.querySelector('.summary .s-balance'); if (!e) return false; const r = e.getBoundingClientRect(); return r.height > 0 && r.bottom <= innerHeight + 1; })() }));
      await shot(page, `AA2-summary-${bal}`);
      const want = econFill('run_balance', { legacy: pAfter.legacy, next: next.name, cost: next.cost });
      const wantReach = reach ? `${reach === 1 ? 'One' : String(reach)} ${reach === 1 ? 'unlock' : 'unlocks'} within reach.` : 'Keep them for the next run.';
      check('AA-2', `the run end with ${pAfter.legacy} Legacy points: "${want}" (${bal >= 60 ? 'the one unlock within reach' : 'none within reach: how far off'}), and the reach line agrees (s0382, s0561, s0596)`,
        sv.bal === want && sv.reach === wantReach && sv.fits && (bal >= 60 ? next.cost === 60 && reach === 1 : /\(\d+ more points\)$/.test(String(next.cost)) && reach === 0), JSON.stringify({ sv, want, wantReach }));
    } catch (e) { await shot(page, `AA2-error-${bal}`); check('AA-2', `part AA2 (${bal}) ran to the end`, false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('AA-2', `part AA2 (${bal}): no console errors`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- AA3: full bags: the reward window, Equip now, the loot window's Leave, a Take refused
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&guide=0&seed=11', {});
    try {
      await page.evaluate(() => { window.__aaT = []; new MutationObserver(() => { for (const t of document.querySelectorAll('#toasts .toast')) if (!window.__aaT.includes(t.innerText)) window.__aaT.push(t.innerText); }).observe(document.body, { childList: true, subtree: true }); });
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await auto(page, () => { const v = window.__ui.view(); return v.phase === 'SUMMARY' || !!(v.loot && v.loot.kind !== 'loot' && document.querySelector('#screens .choice-cards .eqnow')); }, 600);
      const base = await nodeState(page);
      if (!(base.node && base.node.stage === 'reward')) throw new Error(`no quest reward with Equip now (${base.phase})`);
      await load(page, fill(R.deserialize(R.serialize(base), CONTENT)));
      const card = await page.evaluate(() => { const b = document.querySelector('#screens .choice-cards .eqnow'); return b ? [...document.querySelectorAll('#screens .choice-cards .icard')].indexOf(b.closest('.icard')) : -1; });
      if (card < 0) throw new Error('no Equip now with full bags');
      const it = base.node.rewards[0].items[card]; const old = base.player.equipped[it.slot];
      const warn = await page.locator('#screens .bfull').allInnerTexts();
      const tt = await tipText(page, page.locator('#screens .choice-cards .icard').nth(card));
      await shot(page, 'AA3-reward-full-bags');
      check('AA-3', 'the reward window with full bags says the one full-bags sentence; Equip now\'s tooltip says the worn piece is left behind',
        warn.length === 1 && warn[0] === BAGS_FULL && (!old || tt.includes(`your bags are full, so your ${old.name} is left behind`)), JSON.stringify({ warn, tt: tt.slice(-160) }));
      await page.locator('#screens .choice-cards .eqnow').first().click(); await idle(page);
      // the stack shows two toasts at a time and queues the rest (app.js TOAST_MAX 2, TOAST_MS 2.7 s). A toast of the run so far
      // that is still up puts this line in the queue, so wait for it to show (BUG-QA-14); the log line is checked at once
      if (old) await page.waitForFunction((l) => window.__aaT.includes(l), `Your old ${old.name} is left behind (no room in your bags).`, { timeout: 9000 }).catch(() => {});
      const f = await nodeState(page);
      const win = await page.evaluate(() => ({ loot: (() => { const v = window.__ui.view(); return v.loot ? v.loot.title : null; })(), dom: !!document.querySelector('#screens .loot'), log: [...document.querySelectorAll('#combatlog .lines div')].map((x) => x.innerText).slice(-6), toasts: window.__aaT }));
      await shot(page, 'AA3-equip-now-full-bags');
      const line = old ? `Your old ${old.name} is left behind (no room in your bags).` : null;
      check('AA-3', 'Equip now with full bags: the reward is worn, no "Items waiting" window follows, one line names the piece left behind (s0318, s0518, s0546)',
        f.player.equipped[it.slot] && f.player.equipped[it.slot].uid === it.uid && !(f.loot || []).length && win.loot !== 'Items waiting' && !(win.loot === null && win.dom) && (!line || (win.log.includes(line) && win.toasts.includes(line))), JSON.stringify({ worn: f.player.equipped[it.slot] && f.player.equipped[it.slot].uid, want: it.uid, loot: f.loot && f.loot.length, win }));
      // the loot window: one item waiting with full bags; Leave marks what it leaves
      await auto(page, () => { const v = window.__ui.view(); return v.phase === 'MAP' && !v.loot; }, 80);
      const s2 = fill(await nodeState(page));
      const worn = Object.values(s2.player.equipped).find(Boolean);
      s2.loot = [{ ...JSON.parse(JSON.stringify(worn)), uid: 'aa-loot', name: `${worn.name} (spare)` }];
      await load(page, s2);
      const take = await page.evaluate(async () => { const v = window.__ui.view(); const r = await window.__ui.act({ type: 'LOOT_TAKE', i: v.loot.items.findIndex((x) => x.uid === 'aa-loot') }); return r ? r.error : null; });
      const foot = await page.locator('.loot .foot .bfull').innerText().catch(() => null);
      const leave = page.locator('.loot .foot').getByRole('button', { name: 'Leave' });
      await leave.click(); await idle(page);
      const ask = await page.evaluate(() => ({ ask: (document.querySelector('.loot .foot .lleave') || {}).innerText || null, rows: document.querySelectorAll('.loot .lrow').length, leaving: [...document.querySelectorAll('.loot .lrow.leaving')].map((r) => [r.dataset.uid, r.innerText.includes('left behind')]) }));
      await shot(page, 'AA3-loot-leave-ask');
      check('AA-3', 'a Take the bags cannot hold answers the one full-bags sentence; the loot window\'s foot says it too', take === BAGS_FULL && foot === BAGS_FULL, JSON.stringify({ take, foot }));
      check('AA-3', 'Leave asks for exactly the rows it marks "left behind" (s0478)', ask.ask === 'Leave 1 item behind? Click Leave again.' && ask.leaving.length === 1 && ask.leaving[0][0] === 'aa-loot' && ask.leaving[0][1], JSON.stringify(ask));
      await leave.click(); await idle(page);
      const after = await nodeState(page);
      check('AA-3', 'and the second click leaves it', !(after.loot || []).length, JSON.stringify(after.loot));
    } catch (e) { await shot(page, 'AA3-error'); check('AA-3', 'part AA3 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('AA-3', 'part AA3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- AA4: a Hunter's Intellect piece; the "+N items" note along a run
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&guide=0&seed=9', { [Y_KEY]: JSON.stringify(hunter(0)) });
    try {
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      let worst = null; let notes = 0;
      for (let i = 0; i < 260; i++) {
        const v = await page.evaluate(() => { const x = window.__ui.view(); const e = document.querySelector('#micromenu .mm-new'); return { phase: x.phase, bag: x.player ? x.player.bag.filter(Boolean).length : 0, note: e && !e.classList.contains('hidden') ? e.textContent : null }; });
        if (v.phase === 'SUMMARY') break;
        const n = v.note ? Number((/^\+(\d+) items?$/.exec(v.note) || [])[1]) : 0;
        if (v.note) notes++;
        if (!(n <= v.bag) && !worst) worst = { step: i, ...v };
        await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
      }
      check('AA-4', 'the Bags button\'s "+N items" never counts more than the bags hold (s0313, s0511)', notes > 0 && !worst, JSON.stringify({ notes, worst }));
      await auto(page, () => { const v = window.__ui.view(); return v.phase === 'SUMMARY' || (['MAP', 'ZONE_HUB'].includes(v.phase) && !v.loot && !v.combat); }, 100);
      const s = await nodeState(page);
      if (s.phase === 'ENDED') throw new Error('the run ended before the Intellect check');
      const slot = ['chest', 'legs', 'head', 'hands', 'feet'].find((k) => s.player.equipped[k]);
      const w = s.player.equipped[slot];
      const codex = { ...JSON.parse(JSON.stringify(w)), uid: 'aa-int', name: 'Test Mirewater Vestment', stats: { STA: (w.stats.STA || 0) + 6, AGI: 0, INT: 8, SPI: 0 } };
      s.player.bag = s.player.bag.filter((x) => x.kind !== 'gear').slice(0, R.bagCapacity(s) - 1); s.player.bag.push(codex);
      if (!(R.itemScore(codex, 'hunter') > R.itemScore(w, 'hunter'))) throw new Error('the test piece does not out-score the worn one');
      await load(page, s);
      await page.keyboard.press('KeyB'); await idle(page);
      const slotEl = page.locator('#win-bags .slot[data-uid="aa-int"]');
      const arrow = await slotEl.locator('.upg').count();
      const tt = await tipText(page, slotEl);
      await shot(page, 'AA4-int-piece');
      check('AA-4', `a Hunter's Intellect ${slot} piece with a higher item score than the worn one: no upgrade arrow in the bags, its tooltip says "Not an upgrade" (s0502)`,
        arrow === 0 && tt.includes('Not an upgrade: Agility is the Hunter\'s main stat') && !tt.includes('▲ Upgrade'), JSON.stringify({ arrow, tt: tt.replace(/\n/g, ' / ') }));
    } catch (e) { await shot(page, 'AA4-error'); check('AA-4', 'part AA4 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('AA-4', 'part AA4: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- AA5: junk (2026-11-20, s0426): the same junk is one row with a count; a vendor sells the bags' junk in one log line
  {
    const { context, page, errors } = await openY(browser, W, H, 'legacy=1&prep=1&speed=instant&guide=0&seed=11', {});
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await auto(page, () => { const v = window.__ui.view(); return v.phase === 'SUMMARY' || (['MAP', 'ZONE_HUB'].includes(v.phase) && !v.loot && !v.combat); }, 100);
      const s = await nodeState(page);
      const jk = (uid, name, qty = 1) => ({ uid, kind: 'junk', id: 'junk', name, qty, level: 3 });
      s.player.bag = s.player.bag.filter((x) => x.kind !== 'junk');
      for (let k = 0; s.player.bag.length < R.bagCapacity(s) - 1; k++) s.player.bag.push(jk(`aa5f${k}`, `Filler ${k}`));
      s.loot = [jk('aa5-1', 'Torn Pelt'), jk('aa5-2', 'Torn Pelt'), jk('aa5-3', 'Bent Buckle')];
      await load(page, s);
      const rows = await page.evaluate(() => [...document.querySelectorAll('.loot .lrow')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
      await shot(page, 'AA5-junk-stack');
      check('AA-5', 'two of the same junk in the loot window are one row with a count (s0426)', rows.length === 2 && rows.some((r) => /^Torn Pelt ×2\b/.test(r)) && rows.filter((r) => r.startsWith('Torn Pelt')).length === 1, JSON.stringify(rows));
      await page.locator('.loot .lrow', { hasText: 'Torn Pelt' }).getByRole('button', { name: 'Drop' }).click(); await idle(page);
      const left = (await nodeState(page)).loot.map((x) => x.name);
      check('AA-5', 'Drop on the stack drops every piece of it', left.length === 1 && left[0] === 'Bent Buckle', JSON.stringify(left));
      await page.evaluate(() => window.__ui.act({ type: 'LOOT_CLOSE' })); await idle(page);
      // a vendor with junk in the bags: sold on opening, one log line
      await auto(page, () => window.__ui.view().phase === 'ZONE_HUB' || window.__ui.view().phase === 'SUMMARY', 400);
      const s3 = await nodeState(page);
      if (s3.phase !== 'ZONE_HUB') throw new Error(`no zone hub (${s3.phase})`);
      s3.player.bag = s3.player.bag.filter((x) => x.kind !== 'junk'); s3.player.bag.push(jk('aa5-v1', 'Cracked Tooth'), jk('aa5-v2', 'Torn Pelt', 3));
      await load(page, s3);
      await page.evaluate(() => window.__ui.act({ type: 'HUB_SERVICE', service: 'vendor' })); await idle(page);
      const v = await page.evaluate(() => ({ log: [...document.querySelectorAll('#combatlog .lines div')].map((x) => x.innerText).filter((t) => /^You sell/.test(t)), bag: window.__ui.view().player.bag.filter((x) => x && x.kind === 'junk').length, sellBtn: [...document.querySelectorAll('#screens button')].some((b) => /Sell junk/.test(b.innerText)) }));
      await shot(page, 'AA5-vendor-auto-sold');
      check('AA-5', 'opening a vendor sells the junk at once: one log line with the total, no junk left, no Sell junk button', v.log.length === 1 && new RegExp(`^You sell 4 junk items for ${MONEY_RE}\\.$`).test(v.log[0]) && v.bag === 0 && !v.sellBtn, JSON.stringify(v));
    } catch (e) { await shot(page, 'AA5-error'); check('AA-5', 'part AA5 ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('AA-5', 'part AA5: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

/** fmtNum's digits with a plain space between thousands (the game's thin space: texts compared after \s+ to ' '). */
const fmtN = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

for (const [W, H] of SIZES) {
  SIZE = `${W}x${H}`;
  if (PARTS.includes('A')) await partA(browser, W, H);
  if (PARTS.includes('B')) await partB(browser, W, H);
  if (PARTS.includes('C')) await partC(browser, W, H);
  if (PARTS.includes('D')) await partD(browser, W, H);
  if (PARTS.includes('E')) await partE(browser, W, H);
  if (PARTS.includes('F')) await partF(browser, W, H);
  if (PARTS.includes('G')) await partG(browser, W, H);
  if (PARTS.includes('H')) await partH(browser, W, H);
  if (PARTS.includes('I')) await partI(browser, W, H);
  if (PARTS.includes('J')) await partJ(browser, W, H);
  if (PARTS.includes('K')) await partK(browser, W, H);
  if (PARTS.includes('L')) await partL(browser, W, H);
  if (PARTS.includes('M')) await partM(browser, W, H);
  if (PARTS.includes('N')) await partN(browser, W, H);
  if (PARTS.includes('O')) await partO(browser, W, H);
  if (PARTS.includes('P')) await partP(browser, W, H);
  if (PARTS.includes('Q')) await partQ(browser, W, H);
  if (PARTS.includes('R')) await partR(browser, W, H);
  if (PARTS.includes('S')) await partS(browser, W, H);
  if (PARTS.includes('T')) await partT(browser, W, H);
  if (PARTS.includes('U')) await partU(browser, W, H);
  if (PARTS.includes('V')) await partV(browser, W, H);
  if (PARTS.includes('W')) await partW(browser, W, H);
  if (PARTS.includes('X')) await partX(browser, W, H);
  if (PARTS.includes('Y')) await partY(browser, W, H);
  if (PARTS.includes('Z')) await partZ(browser, W, H);
  if (PARTS.includes('AA')) await partAA(browser, W, H);
  if (PARTS.includes('BC')) await partBC(browser, W, H);
}
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed${bad.length ? `; failed: ${bad.map((r) => `${r.size} ${r.bug} ${r.name}`).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
