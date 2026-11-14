# M3 onboarding: guided first run, first-time hints, first-run nudge

Owner: Game Designer (onboarding and systems), 2026-11-13. Status: **draft**. Section 5 E1-E8 (in the engine), 2026-11-13 (M3 3.4, engine-api.md 14; D138's gate and wind-up rule included); the UI (section 6) and QA (section 7) are not built. M3 3.7 (D142 items 1 and 5, engine and content side, 2026-11-13): the Roads of the guided zone wait for Gorrak's fight (2.3, G13), G10 opens on the map, G12 comes back at most once (2.4, 2.5, E10); the UI side is open. M3 3.7 (D143, D144; engine and content side, 2026-11-13, docs/handoffs/engine-2026-11-13d.md): Gorrak's gate after S3 (2.3); the G9 lines without a turn number, the guided zone's quest texts, H05's shield line and the hub welcome lines (2.3, 2.4, 3.2; draft); the UI side is open. D145 G8 fix (Designer, 2026-11-13, **draft**, section 2.8): S3 and S4 swap, so the wind-up fight comes before Gorrak's gate; G7 and G8 share S3's engage round in one line. D147 (engine, 2026-11-14, **draft**, docs/handoffs/engine-2026-11-14.md): a rescue starts no fight, and ONB_RESCUE_MAX rescues end the guide (2.6); the 2.8 fix built (S3/S4 swap, G8's joint line from the engine), route re-measured (2.8 item 5). D148 follow-up (Designer, 2026-11-14, **draft**, not built, 2.8 item 6): S3's wind-up on the Hexer's turn 1 (ONB_WINDUP_TURN), so every class that follows the joint line learns G8, route unchanged.
Audience: Lead, Core Gameplay Engineer, UI/UX Engineer, Content Designer, Simulation & Balance Engineer, QA.

Sources: M3 scope [source: docs/MILESTONES.md M3: "a guided first run (fixed seed, zone 1: intent track, engage round, wind-ups, DoT preview, potions, the Furnace, the map), the first-loss-to-first-unlock nudge to the potion upgrade, and skippable first-time hints for every system"]; owner wishes [stated: docs/feedback/2026-11-11-1026-owner.md: "the first runs very hard", "the first win hard but not that hard", "after the first run the first Echoes, with a tutorial, nudge the player to buy the potion upgrade at once, so losing feels like a win"]; lean screens [stated: docs/feedback/2026-11-12-2019-owner.md: "strip it down, make it more easy"]; Sap not found [stated: docs/feedback/2026-11-11-0803-owner.md]; the game today [source: docs/specs/expedition.md 2-7, H; combat-v2.md 6, 16-17; rules.md 7.5, 11; engine-api.md 1, 9, 12, 13]; the hints that exist today [source: src/ui/tracks.js engage hint, `tbwcr.hints.v1`; src/ui/heat.js first-time note, `tbwcr.heatIntro.v1`; src/ui/hud.js POTION_HINT_HP pulse].

Out of scope: the parked ideas X1-X3 [source: docs/EXPERIMENTS.md] and meta v2 [source: docs/specs/meta-v2.md, draft]. Nothing here needs persistent characters, Peal, Undertakings, talents as meta, Ascension or the dungeon-as-finale structure. Section 4.4 says how this spec and meta v2 6.1 would fit together if the owner later approves meta v2.

Every number is a named constant in the table of section 12. Player-facing names and lines are drafts for the Content Designer and the owner.

---

## 1. Principles

1. **Teach in play.** Each beat teaches one thing at the moment the player needs it. There are no text pages, no slideshow and no modal dialogs.
2. **One line per hint.** A hint is one sentence of at most ONB_HINT_MAX_CHARS characters, plus a key chip where a key exists. Only one hint is on screen at a time. Detail stays in the tooltips that already exist.
3. **Never block.** No hint pauses the game or disables a button. A hint goes away on "Got it", or when the player does what it asks, or when its moment passes.
4. **Skippable at every point.** The guide can be turned off before the run and skipped during it. Hints can be turned off in Settings and in one click from any hint.
5. **First runs stay hard.** The guide makes zone 1 of the first run forgiving (section 2.6). Zones 2-6 of the first run play exactly as any run, so the first win stays hard [stated: 1026].
6. **One system.** The two one-off notes that exist today (the engage hint and the Furnace note) become hints of section 3, with the same look and the same once-only rule.

---

## 2. The guided first run

### 2.1 Shape
- The first run of a profile is the **guided run** (the toggle "Guided first run" at class select is on while `profile.guide` is `todo`).
- The guided run is a normal expedition run with the start camp (`newRun({ mapMode: 'expedition', prep: true, tutorial: true })`). The player picks any class, as usual.
- **Zone 1 is the guided zone.** Its map, nodes, node contents and fight draws come from the fixed seed TUTORIAL_SEED, with an authored overlay (2.3). Every new player gets the same zone 1. That makes QA's checks reproducible.
- **Zones 2-6 are normal.** They use the run's random seed and every rule. The guide ends when the player leaves zone 1 (2.7). The run then goes on to the end boss or a death, and pays its Echoes like any run. (Owner question Q1, default.)
- Expected length of the guided zone: about 10-13 minutes, against about 7.5 for an unguided zone 1 [inference: 45-minute run / 6 zones, plus about 3-5 minutes of reading]. Target ONB1 (section 8).

### 2.2 Starting and skipping
- **Before the run:** class select shows one line under `Set out`: "Guided first run [on]". Turning it off starts a normal run, sets `profile.guide` to `skipped`, and leaves first-time hints on.
- **During the run:** every guide hint carries a small "Skip guide" link. It asks for no confirmation. It sends `SKIP_GUIDE`. The rest of the run is normal: the beats stop, the rescue (2.6) stops, Gorrak's node and the Roads open (2.3, D138, D142), and the zone 1 map stays as it is. Systems that the guide had not taught yet get their first-time hints (section 3).
- **After ONB_RESCUE_MAX rescues** (D147, draft) the guide ends the same way, by itself (2.6).
- **Again later:** Settings has "Play the guide again". The next run is a guided run, with normal Echoes. The welcome (4.2) is not paid again.
- A dev run (engine-api.md 12) is never guided, and Dev menu tools work in a guided run as in any run (they mark it a dev run).

### 2.3 The guided zone: seed and overlay
Content table `src/content/tutorial.js` (Content Designer, numbers from this section):

| Part | Rule |
|---|---|
| Map | Zone 1 is generated on TUTORIAL_SEED (streams `map(1)`, `node(1, id)`, `fight(1, id, k)`, `loot(1, id)` take TUTORIAL_SEED in place of the run seed). Before the content is written, the seed is chosen by script so that: (a) the Barleyreach Verge (wilds) holds at least 3 Quest or Grind nodes in rings 1-2; (b) an Elite node lies in ring 2 within 2 hops of a ring 1 node of the Verge; (c) the Shardfall is on the opposite side from the Verge (at least 150 degrees away); (d) a Road lies within 3 hops of that Elite node; (e) the Rest guarantee is in ring 1 or 2. Simulation & Balance Engineer, one scratch script; the chosen value goes into the constant table |
| Board | At the start camp, board slot 1 is fixed: a **Cull** of the wild family (boars) in the Barleyreach Verge, zone 1. Slots 2 and 3 are drawn as usual (D132 bands; stream `prep` on the run seed). The four camp options are as usual |
| Cull sites | The Cull's sites are placed by the normal rule (expedition.md 3.3) on the fixed map. Each site plays a site fight from the table: site 1 a lone Furrow Boar, site 2 a Furrow Boar and a Barn Wolf, both at the node's level |
| Scripted fights | The first ONB_SCRIPTED_FIGHTS fights the player starts in zone 1 on Quest or Grind nodes that are **not** Cull sites play scripts S1-S4 in order, whichever node they are on. A Grind node plays its script as its only wave. Levels are the node's own (ring 1: 2-4, ring 2: 5-7) [source: expedition.md 4.2], capped at ONB_SCRIPT_LEVEL_MAX. A Quest node shows the quest of the fight it plays (content `quest` of each script and site fight: a quest whose enemies are that fight's), so its text names the enemies [D144, draft: the blind testers met S1's boar under a quest about cutpurses] |
| S1 | Furrow Boar alone (beast). Fixed loot: one uncommon item for the class's weakest gear slot (an upgrade by `itemScore`), and ONB_LOOT_POTIONS Healing Draught |
| S2 | Hedge Ogre alone (brute: Strike, Heavy Smash (heavy), Strike [source: combat-v2.md 4.1]) |
| S3 | Scarecrow Hexer and Furrow Boar; the Hexer's turn 2 (Hex Bolt, cast) is a **wind-up** at the grind's stakes, using the FIRST_MEET_WINDUP mechanism (2.8 item 6, draft, not built: turn ONB_WINDUP_TURN 1, its Bolt) [source: combat-v2.md 17.3]. Quest Straw and Tusk. (D145 fix, draft, 2.8: was S4; built 2026-11-14, D147) |
| S4 | Hedge Ogre and Barn Wolf (brute and beast). Quest Lost Lambs. No beat of its own; G7's "If not" may show here. Not played on the autoplay route (it comes after Gorrak's gate). (D145 fix, draft, 2.8: was S3; built 2026-11-14, D147) |
| Elite | The Elite node nearest the hub (ties: lowest id) holds **Gorrak the Fieldbreaker** (elite brute; Deathblow: Threshing Blow, heavy [source: src/content/abilities.js]) at level clamp(L at entry, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX). Other Elite nodes generate as usual. The Deathblow type shows on the map as it does today (D112). His node is barred until script S3 has ended (won, fled or rescued; content `elite.gate.afterScript`), open at once after a skip [source: docs/DECISIONS.md D138; D143: S3, was S4, so the guided zone ends by a Road before the Dimming; on the autoplay route S4 is then not played, docs/handoffs/engine-2026-11-13d.md 1] |
| Roads (D142) | While the guide runs, the zone's Roads stay closed until Gorrak's fight has ended (won, fled or rescued): `TAKE_ROAD` is refused and the coach line points to him (G13's closed line, 2.4) [source: docs/DECISIONS.md D142 (1)]. They open as well when he can no longer be fought (his node resolved or Dimmed, or still barred with no Quest or Grind node left to play the scripts that open it), so zone 1 never locks; never while his fight is on [engine choice, draft]. The Homeward Bell stays legal (the emergency exit) [engine choice, draft]. `SKIP_GUIDE` opens them at once; outside the guided zone nothing changes |
| Everything else | Rest, Vendor, Trainer, Treasure, Shrine, dungeon (the Harrow Cellars), rares, the Dimming, the Roads, the Homeward Bell: as generated on TUTORIAL_SEED, under the normal rules |

The player roams freely. The beats fire on what happens (2.4), not on where the player stands, so any route works. The overlay only makes the first fights simple and in a good order.

### 2.4 The beats
Each beat fires once, the first time its trigger is met in the guided zone. The beat's line shows in the coach line (2.5) at the anchor given. "Learned" is the check the UI reads from engine events and views. When it passes, the beat is done and its matching first-time hint (section 3) is marked seen. "If not" is what happens when the moment passes without it.

| # | Beat | Trigger | Line (draft) and anchor | Player does | Learned when | If not |
|---|---|---|---|---|---|---|
| G1 | Contracts | phase PREP of the guided run | "Take a contract: win its sites for extra XP and a reward." Over the board, arrow at slot 1 | takes a contract | `SET_OUT` with at least 1 contract held | `Set out` with none: the line changes once to "Set out with no contract? Press Set out again." Then done. G10 is skipped |
| G2 | Moving | first MAP view at the zone 1 hub | "Click a lit node next to you to walk there." Arrow at the player's node | walks | first `MOVE` | none (the player cannot go on without moving) |
| G3 | First fight | round 1 of the first fight | "Press 1 to attack. Bring their health to zero." Arrow at bar slot 1 | fights | the fight is won | rescue (2.6); the beat repeats in the next fight |
| G4 | Loot | first loot window (S1's or a site's) | "Space takes all. A green arrow marks an upgrade: equip it in your bags (B)." At the loot window | takes the loot, equips | `EQUIP` of the upgrade before the next fight ends | the bags button keeps its upgrade mark (today's UI); done |
| G5 | The Furnace | first return to the map after G4 | "The Furnace: each step costs tolls. Stay left of the Star's line." Under the Furnace, top centre | moves on | the next map action (shown beat) | none |
| G6 | Intents | round 1 of the first fight with a `heavy` or `cast` entry on a track (S2) | "Its next three moves, in order. The big one is marked." Arrow at that enemy's track | reads, plans | hovers a track entry, or loses 0 HP to the heavy | done when the fight ends (QA checks it in 7.2) |
| G7 | Engage round | round 1 of the first fight with 2 or more enemies (S3; with G8 in the same round, the joint line of 2.8) | "Round 1 is yours: they act from round 2. Open with Q, W or E." Arrow at the engage panel | opens | any `ENGAGE` | shown once more in the next fight's round 1, then done |
| G8 | Wind-up | round 1 of the first fight with a `windup` entry (S3; with G7 in the same round, the joint line of 2.8) | "Wind-up: stop it with W, an interrupt or a stun, and it is weakened all fight." Arrow at the wind-up badge | answers it | wind-up answered event (STAGGERED) | it lands: "It landed: that enemy hits harder until it dies." The beat stays open for ONB_BEAT_RETRIES more wind-up |
| G9 | Deathblow and its answer | engage round of the first fight with a Deathblow on a track (Gorrak) | By class (D144, draft: no turn number, which read against the round labels "Deathblow R3"; the badge shows the round). Rogue: "This Deathblow maims you if it lands. Sap it (W), then wait a round (X)." Mage: "This Deathblow maims you if it lands. Freeze it: Binding Glyph (W)." Hunter: "This Deathblow maims you if it lands. Trap it (W): the trap springs on it." Arrow at the Deathblow badge | answers it | Deathblow answered event | it lands: "Maimed: your healing is halved this fight. Drink early." The next Deathblow in the guided zone shows the line again |
| G10 | Contract sites | a Cull site first comes into view on the map (its site mark shown; never at the hub screen, D142); then its completion | "Contract site: win this fight to count it." Arrow at the site badge. On completion: "Contract done: choose one reward." At the reward window | wins the sites, picks a reward | contract completed | the contract expires on leaving zone 1 (normal rule); done |
| G11 | Potions | in a fight, HP below ONB_POTION_HP with a healing potion on the bar, first time | "Low health: drink a Healing Draught (8). It uses your turn." Arrow at the item slot | drinks | potion used (`USE_ITEM`, heal event) | the existing pulse stays; the hint (3.2 H09) stays unseen for later |
| G12 | The Dimming | the first node dims, or the front is within 2 hops of the player, whichever comes first | "The Dimming spreads from the Shardfall. Leave by a Road before it reaches you." Arrow at the dark wash nearest the player | heads for a Road | zone 1 left with no Dimmed encounter | caught: "In the dark: walk away from the Shardfall." Done when zone 1 is left. Its line comes back at most ONB_LINE_RETURNS times (2.5, D142) |
| G13 | Homeward Bell | the player is ONB_BELL_HOPS or more hops from every Road and their node dims within ONB_BELL_DIM tolls; or else the player first stands on a Road. While the Roads are closed (2.3, D142): also when Gorrak's node opens | far: "Far from a Road? Ring the Homeward Bell: home in 2 tolls, once per run." On a Road: "Take the Road on. The Bell works from anywhere, once per run." Arrow at the button. While the Roads are closed, at any of these moments (draft, D142): "Face Gorrak first: the Roads open once his fight is over." Arrow at Gorrak's node; when his fight ends the line waits for the far or Road moment | leaves zone 1 | `TAKE_ROAD` or `RING_BELL` | none (the Dimming makes the player leave) |

Notes:
- G3 and G7 overlap by design: every fight has an engage round (combat-v2.md 6.1). In the first fight G3 only says "Press 1" (a bar spell is legal in the engage round). The engage panel is explained in G7, when there is a choice worth making.
- G9's Rogue line keeps Sap's wait rule [source: combat-v2.md 6.2, M2b v14: a PASS keeps STEALTH while every enemy is sapped]. The Hunter's line teaches the trap and not Send the Pet, because a Deathblow aimed at the pet is still under review [source: docs/BACKLOG.md, QA playtest 2026-11-12 #8].
- Key names in lines come from the UI's key map (today: 1-6 spells, 8/9/0 items, Q/W/E engage, X pass, Z autoplay, A attack, B bags, N talents, M map) [source: src/ui/app.js].
- The beat lines name no numbers that the engine owns, except "2 tolls" (BELL_CHANNEL_TIME), read from `C` when the line is built. The G9 lines name no turn since D144: "turn 2" (the enemy's turn) read against the round labels ("Deathblow R3": its turn 2 is round 3, the engage round being round 1).

### 2.5 The coach line (what the player sees)
- One line in a small parchment strip with an arrow to its anchor, a key chip where the line names a key, "Got it" (×), and at the right end in small text "Skip guide" (in the guided run) or "Hints off" (elsewhere). There is no title and no second line.
- It never covers the anchor, the bar, the engage panel's buttons, the Furnace pointer, the target frame or `Set out`. It sits beside them at 1366x768 and 1920x1080.
- At most one on screen. If two triggers fire together, the higher priority shows and the other waits, at most ONB_QUEUE_MAX deep. Priority: Deathblow > wind-up > lethal > potion > engage > the rest. A waiting line whose moment has passed is dropped, unseen.
- A beat's line that has been the top line for ONB_LINE_STEPS steps without being learned yields to the next open beat with a line. The beat stays open and can still be learned; its line comes back when its trigger fires again (G12: the Dimming comes within 2 hops again), at most ONB_LINE_RETURNS times per zone (D142), or when the line changes. With no other open beat line it stays (D141).
- Autoplay and fast mode do not wait for a line. A line that was on screen less than ONB_HINT_MIN_MS does not count as seen.
- Reduce motion: no slide-in, no pulse; the strip just appears.

### 2.6 The rescue (guided zone only)
In the guided zone, while the guide is on, a death does not end the run. **The Bellwrights pull the player back** (draft line): the fight ends as a flight to the node the player came from, with full HP and mana and a living pet. The node stays unresolved. The rescue costs ONB_RESCUE_TOLLS tolls, so the Dimming keeps moving. The run counts it (`summary.tutorial.rescues`).
- **A rescue starts no fight** (D147, engine 2026-11-14, draft): the player lands on the map (on the hub screen when the rescue goes back to the hub, as a walk there) with no fight started, also on a Dimmed node; the next action's tolls are checked as usual, so the player can walk out of the dark, take an open Road or ring the Bell. Before D147 the settle step started a Dimmed encounter where the rescue landed, and a rescue from it led to the next one for ever [source: docs/specs/changes-m3-v1.md, engine finding 1: 259 of 300 guided onebutton Hunter runs with the zone 1 lever].
- **ONB_RESCUE_MAX rescues end the guide** (D147, draft): the ONB_RESCUE_MAX-th rescue still pulls the player back; then the guide ends as `SKIP_GUIDE` does (the beats stop, Gorrak's node and the Roads open, the zone stays), and a later death is a normal one. The UI shows content `guide.rescueCapLine` (draft) on that rescue (engine event `guideSkipped` with `why: 'rescues'`). `profile.guide` becomes `skipped` at END_RUN. (Was: no limit, "the Dimming and the tolls are the limit"; the Dimming does not end a zone.)
- An Ember of Return or a boon resurrect is not used in a death that a rescue covers.
- From zone 2 on, after `SKIP_GUIDE`, or after ONB_RESCUE_MAX rescues, deaths are normal.
- Why: a new player who dies in the first ten minutes learns little and may quit before the loop starts. The first run stays hard from zone 2 on (principle 5). (Owner question Q2, default.)

### 2.7 End of the guide
- Arriving at zone 2's hub shows one toast: "The guide ends here. New things get one hint each." `profile.guide` becomes `done` at END_RUN (or `skipped` if `SKIP_GUIDE` was sent).
- Beats that never fired (for example G11 for a player who never fell below half health) leave their first-time hints unseen, so they still show later (section 3).

### 2.8 D145 fix: the wind-up beat before Gorrak (Designer, 2026-11-13, **draft**)
Problem [source: docs/handoffs/engine-2026-11-13d.md 2; D145]: with Gorrak's gate after S3 (D143) the autoplay route plays S1, S2, S3, Gorrak, site 2 and leaves by a Road at zone toll 19. S4 (the only scripted wind-up) is never played, so G8 never opens and the player meets a normal wind-up first outside the guide, after Gorrak's Deathblow (G9) has already used the word.

Options weighed: (a) accept: rejected, G9's line leans on the wind-up idea that G8 teaches; (b) gate after S4 again: rejected, D143 measured the Dimming catching the route (Bell spent); (c) let autoplay play S4 after Gorrak: rejected, his node dims at 19 and there is no toll left; (d) **chosen: swap S3 and S4**. The fight count before the gate, the gate itself (`afterScript: 's3'`) and the route length do not change; only the content of the third scripted fight does.

Exact changes:
1. **Content (src/content/tutorial.js `scripts`):** the third entry becomes `{ id: 's3', beat: 'G8', teaches: 'Open on the wind-up: the Hexer winds up Hex Bolt on its turn 2.', quest: 'q_z1_guide_straw_and_tusk', enemies: [{ enemy: 'z1_scarecrow_hexer', windup: true }, { enemy: 'z1_furrow_boar' }] }`; the fourth becomes `{ id: 's4', beat: 'G7', teaches: 'Use the engage round on one of two foes.', quest: 'q_z1_lost_lambs', enemies: [{ enemy: 'z1_hedge_ogre' }, { enemy: 'z1_barn_wolf' }] }`. `elite.gate.afterScript` stays `'s3'`. The comments that say "G8 (wind-ups) may then come after Gorrak" are replaced by "G7 and G8 come in S3, before Gorrak (D145 fix)".
2. **Beat collision (UI, onboarding.js):** S3 is the first fight with 2 or more enemies and the first with a wind-up, so G7 and G8 trigger in the same engage round, and G7's moment would pass while it waits behind G8 (2.5 priority). When both trigger in one round, the coach line shows **one joint line**, content `G8.alt.withEngage` (draft, 75 characters): "Round 1 is yours: open with W on the wind-up and it is weakened all fight." Arrow at the engage panel's W button, a second marker on the wind-up badge. Both beats count as shown. G7 is learned on any `ENGAGE`, G8 on the wind-up answered event, as in 2.4. W (each class's control option) answers a normal enemy's wind-up for every class [source: combat-v2.md 6.2, 16.2: Sap cancels at its turn, Binding Glyph freezes, Lay Trap springs on its turn].
3. **Engine:** no rule change. `validateTutorial` keeps checking the ids. The s18 tests change: the autoplay beat list gains G8 (it fires in S3's engage round; it is learned only if the wind-up is answered: autoplay rule E puts the control option on the enemy with the largest estimated damage, and the Rogue's autoplay never Saps [source: combat-v2.md rules 7.9 E], so on some classes it lands and G8's "It landed" line shows instead), and the D143 measure test is re-run on the swapped scripts. Done-when for the engineer: for every class and the 20 run seeds of the D143 measure, the route still fights Gorrak, leaves by a Road with the Bell kept and 0 rescues, and G8 fires before G9; the test records per class whether G8 was learned or landed.
4. **If the re-run shows the route no longer leaves by a Road before the Dimming** (the Hexer and Boar fight is longer than the Ogre and Wolf), the fallback is option (e): keep the swap and lower ONB_SCRIPTED_FIGHTS to 3 (S4 is dropped and its node plays its own quest). Report it; do not move the gate.
5. **Built** (Core Gameplay Engineer, 2026-11-14, D147, draft; docs/handoffs/engine-2026-11-14.md). Content as item 1, with `G8.alt.withEngage` ("Round 1 is yours: open with {key_engage2} on the wind-up and it is weakened all fight.", 74 characters with the key filled in as W). Engine choice for item 2 (draft): the engine gives the joint line, so the view's coach line carries it: when G7 and G8 open in the same engage round, G8 opens on line `G8.withEngage` and G7 opens with its line waiting (null); the joint line counts as G7's first showing, so G7's own line comes once at the next engage fight (S4) if it is still open, then it is missed (ONB_ENGAGE_SHOWS). The UI anchors and marks it (handoff, UI needs). Re-run of the D143 measure (seed 8736, autoplay, board slot 1 taken, 3 classes x 20 run seeds; one route per class, the same for every class): site 1, S1, S2, S3 at zone toll 13, Gorrak at toll 16 (won), site 2 at toll 18, Road 19 at toll 19; 0 Dimmed encounters, the Bell kept, 0 rescues, level 12 at zone 2: the route did not change, so the fallback of item 4 is not needed. G7 and G8 open together in S3's engage round, G8 before G9. G8 per class: **Hunter learned** (Lay Trap, W, on the Hexer springs on its turn: STAGGERED); **Rogue and Mage neither learned nor landed**: the Rogue's autoplay opens with Ambush (Q; rule E never Saps), which kills the Hexer (61 HP at level 5) in the engage round, and the Mage's autoplay opens with Binding Glyph (W) on the Hexer as the line says, then kills the frozen Hexer with Frost Lance in round 2, before its turn-2 wind-up; G8 waits (line null) and closes missed when zone 1 is left. No class sees "It landed". A player who follows the joint line (W on the Hexer, then autoplay) learns G8 as Rogue (Sap) and Hunter (trap); the Mage still kills the frozen Hexer first [measured, scratch script; for the Designer: options in the hand-off].
6. **D148 follow-up: the S3 wind-up on the Hexer's turn 1** (Designer, 2026-11-14, **draft**, not built). Problem [source: docs/handoffs/engine-2026-11-14.md 4, 7.1; D148 "Open"]: the Hexer (61 HP at level 5) winds up on its turn 2, which is round 3. A control from the engage round covers that turn, but the Hexer must live through the player's actions of rounds 2 and 3 for the wind-up's turn to come. The Mage who follows the line freezes it (W), then kills it with Frost Lance in round 2 (70 damage on a frozen target), so the wind-up never resolves. The Rogue's autoplay opens with Ambush (Q, 75 damage) and kills the Hexer in round 1 [measured, both: scratch trace on seed 8736].
   **Change:** the guided zone's marked wind-up comes on the enemy's turn ONB_WINDUP_TURN = 1 (round 2) instead of SIGNATURE_TURN 2. A control from the engage round (Sap, Binding Glyph, Lay Trap) then cancels it at the start of round 2, before the player's next action: STAGGERED, and G8 learned, in the same step as the W press, whatever the player does next. The wound-up action is the Hexer's turn-1 scripted action, Bolt (caster opening script: Bolt, Hex Bolt, Wither [source: src/constants.js OPENING_SCRIPT]), a cast while it is a wind-up. Hex Bolt on turn 2 stays a normal cast. Only S3's Hexer carries a `windup` mark, so nothing else changes. No change to HP, level, enemy order, the gate, the lines or the UI.
   Exact changes for the Core Gameplay Engineer:
   - `src/constants.js`: `export const ONB_WINDUP_TURN = 1;` beside the other ONB_ constants, with a comment. Section 12 gets the plain value in the same commit; s13 then checks it.
   - `src/engine/combat.js` (startFight, the D138 line): an enemy that the overlay marks gets `e.firstMeet = true; e.windupTurn = ONB_WINDUP_TURN;`. An unmarked enemy deletes both `firstMeet` and `windupTurn`.
   - `src/engine/track.js` makeEntry, the first-meeting branch: `t === (e.windupTurn || SIGNATURE_TURN)` in place of `t === SIGNATURE_TURN`. First meetings outside the overlay keep turn 2, so standard runs are unchanged run for run.
   - `src/content/tutorial.js`: S3's `teaches` becomes `'Open on the wind-up: the Hexer winds up its Bolt on its turn 1.'`. In the scripts comment, "makes its turn-2 action a wind-up" becomes "makes its turn-ONB_WINDUP_TURN (1) action a wind-up". `src/content/SCHEMA.md` 2.11 Fight row: "turn-2 action" becomes "turn-ONB_WINDUP_TURN action (1, m3-onboarding.md 2.8 item 6)".
   - 2.3 S3 row and rules.md 7.12 (first meetings): note the guided exception (turn ONB_WINDUP_TURN for overlay marks). engine-api.md 14 if it names the wind-up turn.
   - Tests (s18). The D138 wind-ups test expects `[[C.ONB_WINDUP_TURN, 'bolt']], []` for S3's tracks. In the D143/D147 route measure, `G8_AT_END` becomes `{ rogue: 'missed', mage: 'done', hunter: 'done' }`. The G7/G8 test "W on the Hexer answers its wind-up" covers all three classes and collects the events of the W step itself: the stagger and G8's `done` now come in that step. Add one assertion to the route measure, or as a new test: the "follow the line" policy (below) learns G8 for every class with the route unchanged. On the scratch build, the full suite (`node --test qa/engine qa/rules qa/docs qa/sim qa/ui`) gave 766/769: only these three s18 tests failed, all as expected. Golden hashes held.
   **Measure** (scratch build with exactly the edits above, outside the repo). The D143 measure: seed 8736, board slot 1 taken, 3 classes × 20 run seeds (1000 + 7919k). Route OK means zone 1 is left by a Road with 0 Dimmed encounters, 0 rescues, the Bell kept, Gorrak won and G9 learned. Four policies for S3's engage round, autoplay everywhere else:

   | Policy in S3's engage round | Build | Rogue | Mage | Hunter | Route OK, routes per class |
   |---|---|---|---|---|---|
   | Autoplay (rule E) | before | missed (Ambush kills) | missed (frozen Hexer killed in round 2) | **learned** | 20/20 each, 1 route |
   | Autoplay (rule E) | **change** | missed (Ambush kills; rule E never Saps, D49) | **learned** | **learned** | 20/20 each, 1 route |
   | Follow the line: W on the Hexer | before | learned | missed | learned | 20/20 each, 1 route |
   | Follow the line: W on the Hexer | **change** | **learned** | **learned** | **learned** | 20/20 each, 1 route |
   | X (pass) | before | missed | missed | missed | 20/20 each |
   | X (pass) | **change** | **landed** ("It landed") | **landed** | **landed** | 20/20 each |
   | Q (strike) on the Hexer | before / change | missed | missed | missed | 20/20 each |

   Every arm keeps one route per class, the route measured on 2026-11-14: site 1 (toll 4), S1 (7), S2 (10), S3 (13), Gorrak (16, won), site 2 (18), Road 19 at toll 19, level 12 at zone 2. Robustness: W on the Hexer, then random legal fight actions for the rest of S3 (50 action seeds per class). Before the change G8 was learned in 31, 36 and 44 of 50 (Rogue, Mage, Hunter). After it, in 50 of 50 for each class, every time in the W step itself. Guided sim cell (onebutton, expedition with the start camp, P0, X0 tables, `--warmup 0`, seeds 1000-1299, 300 per class): 900 of 900 run records identical before and after (sim/samerecords.mjs); the guided planner cell (same settings) also 900 of 900 identical.
   **Options measured and not chosen** (same measure, scratch knobs):

   | Option | Autoplay: Rogue / Mage / Hunter | Follow the line: Rogue / Mage / Hunter | Why not |
   |---|---|---|---|
   | S3 Hexer HP × 1.1 | missed / missed / learned | learned / missed / learned | too small |
   | S3 Hexer HP × 1.2 (to × 2.5) | missed / learned / learned | learned / learned / learned | needs a new per-script HP field. It works only while the Hexer outlives the player's round 2 and 3 actions: × 1.2 is 73 HP against a 70-damage Frost Lance, so a crit or a different cast would kill it first [inference: from those numbers, not measured] |
   | S3 Hexer HP × 3 | landed / learned / learned | learned / learned / learned | a 183 HP normal enemy at level 5; the fight becomes a slog |
   | Enemy order swapped (Boar first) | missed / missed / learned | learned / missed / learned | no effect: the default target is the caster wherever it stands (rules 7.9) |
   | The wind-up on the Boar, not the Hexer | missed / landed / landed | learned / learned / learned | the W target is no longer the default target, and the line, `teaches` and quest would no longer match the fight. The Mage learns it only while the 80 HP Boar outlives a 70-damage Lance [inference: from the trace, not measured with other actions] |
   | Line only: "...W on the wind-up, then hit the other one" | as before | learned / learned / learned | asks the player to turn away from the default target. Autoplay is unchanged (Mage missed) |

   Not fixed: the Rogue's autoplay. Rule E opens with Ambush on the default target, and Sap stays manual (D49). Only a Hexer of about 3× HP lets the wind-up land there. A real Rogue who follows the line (Sap) learns G8. Status: **draft**. Changes 2.3's S3 row, the s18 tests and SCHEMA 2.11; no UI work.

---

## 3. First-time hints (every system outside the guided run)

### 3.1 Rules
- **Trigger:** the first time the condition in 3.2 is met, in any run (guided or not). In the guided zone a beat takes the place of its matching hint (column "Beat").
- **Text:** one line, as in the coach line (2.5). Numbers come from the engine (`C` or the views), never typed into the line.
- **Where:** the coach line, anchored as in 3.2.
- **Once only:** a hint shows once per profile. It counts as seen when the player dismisses it, does what it asks, or its moment ends after at least ONB_HINT_MIN_MS on screen. Seen ids are stored with the profile in this browser (`tbwcr.hints.v2`: `{ off, seen: { id: true } }`). On first load, the old keys move over: `tbwcr.hints.v1` (engage hint per class) marks H01 seen, and `tbwcr.heatIntro.v1` marks H16 seen.
- **Per class:** H01, H04, H33 and H34 are per class (`seen['H01:rogue']`), because their answer differs by class. Every other hint is per profile.
- **Hints off:** Settings, Interface: "Hints: On / Off" (default On), "Reset hints" (clears `seen`), "Play the guide again" (2.2). "Hints off" on any coach line sets Off. Off hides every hint and every beat line, but not the rescue.
- **Pace:** at most one hint per fight round and one per map step, and at most ONB_HINTS_PER_FIGHT per fight. A hint that has to wait more than one step is dropped and stays unseen.

### 3.2 Hint table
| Id | System | Trigger | Line (draft) | Anchor | Beat |
|---|---|---|---|---|---|
| H01 | Engage round | engage round of the first fight of a class | "Round 1 is yours: they act from round 2. Open with Q, W or E." | engage panel | G7 |
| H02 | Intent track | first fight | "Above each enemy: its next three moves, in order." | first enemy's track | G6 |
| H03 | Wind-up | first `windup` entry on a track | "Wind-up: stop it with W, an interrupt or a stun, and it is weakened all fight." | wind-up badge | G8 |
| H04 | Deathblow | first Deathblow on a track | Class line as G9 | Deathblow badge | G9 |
| H05 | Off-balance | first OFF_BALANCE window on an enemy | "Off-balance: it takes +{OFFBAL_TAKEN} damage. Spend your big hit now." While the target's shield absorbs a whole hit (`R.offBalance(...).absorbs`, D144, draft): "Off-balance, but its shield takes your hits first: break it, then spend your big hit." (content H05 `alt.shield`; blind tester report 2026-11-13, casual: a crit for 0 into a shield) | the enemy frame | |
| H06 | Maimed | first MAIMED on the player | "Maimed: your healing is halved for this fight." | player frame | G9 |
| H07 | Lethal | first entry marked LETHAL (when the BACKLOG item ships) | "Lethal: this hit kills you. Stop it, heal, or kill first." | the entry | |
| H08 | DoT preview | first pending-tick segment on an enemy bar | "The marked end of a health bar is what its damage over time will take." | that bar | |
| H09 | Potions | HP below ONB_POTION_HP in a fight with a healing potion ready | "Low health: drink a Healing Draught (8). It uses your turn." | item slot | G11 |
| H10 | Free potion | first fight with Packed Satchel | "Packed Satchel: your first potion each fight costs no turn, at half strength." | item slot | |
| H11 | Loot | first loot window | "Space takes all. A green arrow marks an upgrade: equip it in your bags (B)." | loot window | G4 |
| H12 | Trainer | first level-up with a spell to learn or train | "New spell ranks: visit the trainer at a hub." The hub's welcome names the trainer only while `R.trainerView(state).useful` (content `guide.hubTrainerLine`, else `guide.hubLine`; D144, draft: both blind testers paid a toll at level 1 with nothing to learn) | hub marker on the map | |
| H13 | Spell bar | first spell learned that is not on the bar | "Drag your new spell onto the bar (spellbook, P)." | the bar | |
| H14 | Talents | first talent point (level TALENT_FIRST_LEVEL) | "Talent point: spend it in Talents (N)." | talents button | |
| H15 | Fog | first map view | "You see the nodes next to you. Walking shows more." | player's node | G2 |
| H16 | The Furnace | first map view after the first node | "The Furnace: each step costs tolls. Stay left of the Star's line." | the Furnace | G5 |
| H17 | Heat pays | first node entered Burning | "Burning: more XP, gold and better drops, but the end boss grows stronger." | the Furnace | |
| H18 | The Dimming | first Dimmed node in view | "The Dimming spreads from the Shardfall. Leave by a Road before it reaches you." | dark wash | G12 |
| H19 | Homeward Bell | G13's trigger | as G13 | Bell or Road button | G13 |
| H20 | Contract site | first contract site in view | "Contract site: win this fight to count it." | site badge | G10 |
| H21 | Contract done | first contract completed | "Contract done: choose one reward." | reward window | G10 |
| H22 | Hub contract | first hub with a contract on offer | "This hub offers a contract: pay from your Reserve or swap one you hold." | hub contract card | |
| H23 | Start camp | first PREP without the guide | "Points buy contracts and supplies. Points you keep become Reserve." | points counter | G1 |
| H24 | Elite | first Elite node in view | "Elite: hover it to see its Deathblow before you go in." | the node | |
| H25 | Rare | first fight with a rare | "Rare: a named foe with better loot. Read its moves first." | target frame | |
| H26 | Dungeon | first dungeon node in view | "Dungeon: several fights and a boss in one visit." | the node | |
| H27 | Disrupt | engage round of the first dungeon boss | "Bosses resist control: W disrupts their first wind-up instead." | engage panel | |
| H28 | Vendor | first vendor open | "Sell what you do not need. Potions are always in stock." | vendor window | |
| H29 | Rest | first Rest node in view | "Rest: back to full health and mana, for tolls." | the node | |
| H30 | Pass | first round in which PASS answers a wind-up (`windupView` PASS answer) | "Waiting (X) keeps them sapped: the wind-up never comes." | pass button | G9 |
| H31 | Autoplay | first fight after ONB_AUTOPLAY_AFTER fights won, autoplay never used | "Z lets autoplay fight for you. It answers Deathblows too." | autoplay toggle | |
| H32 | Flee | HP below ONB_FLEE_HP in a non-boss fight where `FLEE` is legal, first time | "You can flee (F). The node stays open for later." | flee button | |
| H33 | Pet (Hunter) | first fight of a Hunter | "Your pet fights beside you and draws some of the blows." | pet frame | |
| H34 | Stealth (Rogue) | first fight of a Rogue | "You start hidden: openers work only from stealth." | stealth badge | |
| H35 | The Camp | first arrival at the Camp | "The Camp: last stop before the Unlit Star. Spend your gold here." | Camp title | |
| H36 | End boss | first end-boss fight | "No engage round here: read its schedule above it." | boss track | |
| H37 | Hall of Echoes | first time the Hall opens | "Echoes buy lasting unlocks. They stay when a run ends." | balance | |

The table covers every system the player meets in a run today [source: expedition.md 1-7, H; combat-v2.md 3-6, 16-17; rules.md 7.5, 11]. A system added later gets a row in the same form, in the same commit as its UI.

### 3.3 What is retired
- The engage hint panel (src/ui/tracks.js: heading, paragraph, list of three options, "Shown once for the ...") becomes H01's one line. The per-option lines move into the options' existing tooltips, so nothing is lost.
- The Furnace note (src/ui/heat.js `#heat-intro`) becomes H16.
- The low-health potion pulse (src/ui/hud.js) stays. It is not a hint and it does not count as one.
- The Furnace's state toasts (expedition.md H.4) stay. They are game feedback, not hints.

---

## 4. The first-run nudge to the potion upgrade

### 4.1 Trigger
The summary of the profile's first non-dev run, guided or not, whatever the outcome (in practice a loss), when Packed Satchel is not owned.

### 4.2 The welcome
- That summary pays a one-time line, **"The Bellwrights' welcome"** (draft, lore: docs/lore/world.md 6): ONB_WELCOME_ECHOES Echoes, once per profile. It equals Packed Satchel's price (60) [source: rules.md 11.2], so every first run can buy it at once. (Owner question Q3, default.)
- Why a grant: a first run that dies in zone 1 or 2 earns about 10-40 Echoes [inference: rules.md 11.1, ECHO_PER_LEVEL 1 × levels gained + ECHO_PER_ZONE 7.5 per zone left + a few quest, elite and contract lines]. Without it the nudge would have nothing to buy.
- Engine: `profile.welcome` (false in `newProfile()`; a saved profile with `runs > 0` loads as true, so the owner's profile gets nothing). END_RUN of the first non-dev run adds the summary line `welcome` and sets the flag. A dev run neither pays it nor sets it.

### 4.3 What the player sees
1. Summary: the Echo lines as today, the welcome as its own line. The "Spend Echoes" button glows (no pulse under reduce motion) with one line under it: "Your first unlock is ready: Packed Satchel."
2. Hall of Echoes (opened from that button): the Packed Satchel card is highlighted, with one coach line at it: "Buy Packed Satchel: 3 potions every run, and your first potion each fight costs no turn." Next to it is "Later".
3. Nothing is disabled. "Later", Esc or leaving the Hall closes the nudge. It does not come back. If the Satchel is still not bought, the next summary repeats only step 1's line, once.
4. After the purchase: the Hall shows "Next run: 3 Healing Draughts" in its next-run lines (today's `nextRunLines`), and H10 explains the free potion in the first fight.

### 4.4 Relation to meta v2 (parked)
Meta v2 6.1 has the same grant (ECHO_FIRST_RUN 60) and the same Satchel highlight [source: docs/specs/meta-v2.md 6.1]. If the owner approves meta v2, its 6.1 uses this spec's grant and screens and pays nothing twice. Meta v2's proposal to keep `Set out` disabled until the player buys or presses "Later" is not taken: principle 3.

---

## 5. What the engine must expose (Core Gameplay Engineer)
Status: E1-E8 (in the engine), 2026-11-13: engine-api.md 14, src/engine/tutorial.js, qa/engine/s18-tutorial.test.mjs. E9's rules.md lines are not written (outside the engineer's files). E10 (D142) in the engine, 2026-11-13 (M3 3.7).

| # | Need | Detail |
|---|---|---|
| E1 | `newRun({ tutorial: true })` | Legal only with the expedition map and `prep: true` (throws otherwise). `state.tutorial = { on: true, skipped: false, rescues: 0, script: 0 }`. Zone 1 streams on TUTORIAL_SEED (2.3) |
| E2 | Overlay from `CONTENT.tutorial` | Board slot 1, site fights, scripts S1-S4 by order, S1's fixed loot, the forced wind-up of S4, Gorrak on the nearest Elite node with the level clamp. Validated by `validateContent` (template ids exist, levels in range) |
| E3 | Rescue (2.6) | In zone 1 with `tutorial.on && !skipped`: a death becomes event `rescue { tolls }`; the player goes back to the previous node with full HP, mana and pet; the node stays unresolved; `time` and zone time + ONB_RESCUE_TOLLS; `rescues` + 1. Resurrect charges are not used. (D147) No fight starts where it lands (no Dimmed encounter from its tolls); the ONB_RESCUE_MAX-th rescue ends the guide as `SKIP_GUIDE` (event `guideSkipped` with `why: 'rescues'`) |
| E4 | `SKIP_GUIDE` | Legal in any phase of a tutorial run while `!skipped`; sets `skipped`; no other change; event `guideSkipped` |
| E5 | `tutorialView(state)` | `{ on, skipped, guidedZone (in zone 1 and not skipped), script (fights scripted so far), eliteNodeId, rescues }` or null. Pure and cheap |
| E6 | Profile | `profile.guide` (`'todo'`, `'done'`, `'skipped'`; END_RUN of a tutorial run sets `done` or `skipped`); `profile.welcome` (4.2); pure helper `setGuide(profile, value)` for class select and Settings; migration (a profile with `runs > 0` loads as `guide: 'done'`, `welcome: true`) |
| E7 | Summary | Echo line `welcome`; block `tutorial: { rescues, skipped }` in a tutorial run |
| E8 | Dev tools | `debug.resetOnboarding(profile)`: guide `todo`, welcome false; the Dev menu's "Reset onboarding" also clears `tbwcr.hints.v2` |
| E9 | Tests and docs | engine-api.md rows for E1-E8; rules.md 1.2 and 11.1 lines (tutorial option, the welcome); a qa/engine test per row; the code-map row for the new files (D41) |
| E10 | D142 (M3 3.7, in the engine) | The Roads of 2.3: `TAKE_ROAD` refused on a closed Road, `mapView` Road nodes `closed: true` and `onRoad` false on one, `state.tutorial.elite` (how Gorrak's fight ended), `tutorialView.roads` `{ closed, why, node, line }` and `elite.outcome`; G13's line `G13.closed`; the autoplay map policy goes to Gorrak once his node opens (and to the next script where it would leave while his node is barred); G10 opens on the map only; G12's return cap ONB_LINE_RETURNS (engine-api.md 14) |

Nothing else changes: the beats and hints are presentation and read events and views that exist today (`windupView`, `potionInfo`, `pendingTicks`, `offBalance`, `mapView`, `heatView`, `contractView`, the wind-up, item-use and equip events).

## 6. What the UI must build (UI/UX & Visual Engineer)

| # | Need |
|---|---|
| U1 | The coach line component (2.5): anchor and arrow, key chip, Got it, Skip guide / Hints off; one at a time; queue and priority; never over the protected elements at 1366x768 and 1920x1080; reduce motion |
| U2 | `src/ui/onboarding.js`: one table for beats (2.4) and hints (3.2), each row `{ id, trigger(view, events), line(view), anchor, learned(view, events), ifNot }`; state in `tbwcr.hints.v2` with the migration of 3.1; the guided run's beat state is kept per run and ends at zone 2 |
| U3 | Class select: "Guided first run" toggle while `profile.guide` is `todo`; Settings: Hints On/Off, Reset hints, Play the guide again |
| U4 | Retire the engage hint panel and the Furnace note into H01 and H16 (3.3) |
| U5 | Rescue presentation: a float "The Bellwrights pull you back (2 tolls)" and a log line; the travel animation back to the node |
| U6 | Summary and Hall: the welcome line, the Spend Echoes glow and line, the Satchel highlight with its coach line and "Later" (4.3) |
| U7 | Guide end toast (2.7); "Skip guide" on guide lines |
| U8 | Lines in `ui-text.js`, numbers from `C` and the views; the Content Designer checks wording and originality |

## 7. QA (Playtest & QA Lead)

### 7.1 Automated checks
1. A headless guided run per class with autoplay reaches zone 2. Beats G1-G4, G6-G8 and G12-G13 fire in order, each once; G7 and G8 fire together in S3's engage round (2.8). G9 fires in the Gorrak fight, after G8.
2. The guided zone is the same on every run: map hash, scripts and the elite are equal across 5 run seeds; zones 2-6 differ.
3. Rescue: a forced death in zone 1 (dev `setGod` off, enemy damage raised by a test hook) gives `rescue`, full HP, the node unresolved, +ONB_RESCUE_TOLLS. A death in zone 2 ends the run. After `SKIP_GUIDE` a death in zone 1 ends the run. (D147) A rescue from a Dimmed encounter, or back to a Dimmed node, leaves the player on the map with no fight; the ONB_RESCUE_MAX-th rescue ends the guide and the next death ends the run.
4. Welcome: paid once (first non-dev run), not in a dev run, not again after "Play the guide again"; a migrated profile with runs gets none.
5. Hints: each id shows at most once across reloads; per-class ids once per class; Hints off hides all; Reset hints shows them again; the v1 keys migrate.
6. Layout: at 1366x768 and 1920x1080, no coach line overlaps its anchor, the bar, the engage buttons, the Furnace pointer, the target frame or `Set out` (ui-regress hook per beat). Style snapshot updated once.
7. Lines: every beat and hint line is at most ONB_HINT_MAX_CHARS characters and holds no "hours", "h" or decimal (expedition.md H.4 wording rules).

### 7.2 New-player playtest checklist
Setup: a fresh browser profile (Dev menu "Reset onboarding" and cleared storage), one run per class, guide on. The tester reads only the screen: no docs, no specs. Record the time, every rescue, every hint dismissed unread, and every moment of confusion, with a screenshot.

Questions after zone 1 (target: 4 of 5 right per class, ONB5):
1. What do the icons above an enemy show?
2. What happens in round 1 of a fight, and what are Q, W and E for?
3. What is a Deathblow, and how does your class stop it?
4. What does the Furnace measure, and what happens past the Star's line?
5. What is the Dimming, and what are the two ways to leave a zone?

Observations to log:
- Did any hint cover something the tester needed? Did any screen feel cluttered (owner 2026-11-12)?
- Did the tester find the engage options without the hint (the owner did not find Sap, 2026-11-11 08:03)?
- Time to leave zone 1 (target ONB1); rescues (target ONB2).
- After the first run ends: did the tester buy Packed Satchel? How many clicks from the summary?
- Second run: did the tester use the free potion, and say what it does?
- Skip paths: guide off at class select; "Skip guide" mid-zone; "Hints off" from a line. Nothing breaks, no beat line shows after.

The owner plays the same checklist once on a fresh profile (M3 done-when).

## 8. Targets (proposed; for balance.md after the Lead accepts)
| Id | What | Target | Measured by |
|---|---|---|---|
| ONB1 | Time to leave the guided zone | <= ONB_GUIDE_MAX_MIN minutes for a new player | QA playtest 7.2 |
| ONB2 | Rescues in the guided zone | autoplay 0 per class; one-button bot <= 2 per class; new player <= 2 | sim tutorial cell (deterministic zone 1: one run per class per policy); QA |
| ONB3 | The first run is not easier after zone 1 | planner level and gear score at zone 2's hub within B20's zone-1 band and within 1 level of an unguided planner P0 | sim tutorial cell, 300 runs per class |
| ONB4 | The nudge can be acted on | Packed Satchel affordable at the first summary in 100 % of first runs | by construction (4.2); engine test |
| ONB5 | Comprehension | 4 of 5 questions right, per class | QA playtest 7.2 |

The balance bots never play the tutorial option; balance targets B1-B62 stay measured without it.

## 9. Cost (rough, in sessions)
| Role | Sessions | Work |
|---|---|---|
| Game Designer | 0.5 | This spec (done); reading the sim and QA results; line edits |
| Content Designer | 1 | `src/content/tutorial.js`; wording and originality check of all lines |
| Simulation & Balance Engineer | 0.5 | TUTORIAL_SEED selection script (2.3); tutorial cell for ONB2-ONB3 |
| Core Gameplay Engineer | 2 | E1-E9 with tests and spec rows |
| UI/UX & Visual Engineer | 3 | U1-U8: coach line, onboarding table with 13 beats and 37 hints, class select and Settings, summary and Hall nudge, retiring the two old notes, layouts and ui-regress hooks |
| Playtest & QA Lead | 1.5 | 7.1 checks; the new-player playtest, three classes |
| Lead | 1 | Review, build, owner report |
| **Total** | **about 9.5** | Order: Sim seed script and Content table, then Engine, then UI, then QA |

## 10. Open questions for the owner (the team builds on the default)
| # | Question | Default |
|---|---|---|
| Q1 | After the guided zone 1, does the first run go on as a full run (zones 2-6), or stop as a short prologue? | Goes on: one first run, guided in zone 1, then normal and hard |
| Q2 | In the guided zone 1, is a death a rescue (back to the last node, full health, 2 tolls), so a new player cannot lose in the first ten minutes? | Yes, zone 1 of the guided run only |
| Q3 | Does the first run pay a one-time welcome of 60 Echoes, so every new player can buy Packed Satchel at once? | Yes, once per profile |

## 11. Proposed decisions (for the Lead to log)
| # | Decision | Owner |
|---|---|---|
| D-a | The first run of a profile is guided in zone 1 on TUTORIAL_SEED with the overlay of 2.3 and continues as a normal run (Q1) | owner (default) |
| D-b | Rescue instead of death in the guided zone (Q2) | owner (default) |
| D-c | One-time welcome of ONB_WELCOME_ECHOES at the first summary; Packed Satchel nudge without blocking (Q3, 4) | owner (default) |
| D-d | One hint system: one-line coach line, once per profile, Hints off; the engage hint and the Furnace note fold into it | team |

## 12. Constant table (starting values)
| Name | Value | Use |
|---|---|---|
| TUTORIAL_SEED | to be chosen (2.3) | zone 1 streams of the guided run |
| ONB_SCRIPTED_FIGHTS | 4 | fights S1-S4 played in order on non-site Quest or Grind nodes |
| ONB_SCRIPT_LEVEL_MAX | 5 | level cap of scripted fights [assumption] |
| ONB_LOOT_POTIONS | 1 | Healing Draughts in S1's fixed loot |
| ONB_ELITE_LEVEL_MIN / MAX | 4 / 6 | Gorrak's level clamp in the guided zone [assumption; checked by ONB2] |
| ONB_RESCUE_TOLLS | 2 | tolls a rescue costs (2.6) |
| ONB_RESCUE_MAX | 3 | rescues after which the guide ends (2.6; D147, draft, not measured) [source: docs/specs/changes-m3-v1.md, engine finding 1] |
| ONB_BEAT_RETRIES | 1 | extra chances for G8 |
| ONB_WINDUP_TURN | draft, 1 (2.8 item 6; not built: the engineer writes the plain value with the code) | enemy turn of the guided zone's marked wind-up (S3's Hexer), in place of SIGNATURE_TURN |
| ONB_POTION_HP | 0.5 | HP share that triggers G11 / H09 |
| ONB_FLEE_HP | 0.25 | HP share that triggers H32 |
| ONB_BELL_HOPS | 3 | hops from every Road that make G13 / H19 eligible |
| ONB_BELL_DIM | 4 | tolls until the player's node dims for G13 / H19 (equals HEAT_DIM_WARM) |
| ONB_AUTOPLAY_AFTER | 5 | fights won before H31 can show |
| ONB_HINT_MAX_CHARS | 90 | characters per line, key chip excluded |
| ONB_HINT_MIN_MS | 1500 | ms on screen before a line counts as seen |
| ONB_HINTS_PER_FIGHT | 2 | hints per fight at most |
| ONB_QUEUE_MAX | 2 | lines waiting at most |
| ONB_LINE_STEPS | 2 | steps a beat's line stays the top line before it yields to the next open beat with a line (2.5, D141) |
| ONB_LINE_RETURNS | 1 | times a resting line comes back when its trigger fires again, per zone (2.5, G12; D142) |
| ONB_WELCOME_ECHOES | 60 | the Bellwrights' welcome, once per profile (= Packed Satchel's price) |
| ONB_GUIDE_MAX_MIN | 15 | minutes, target ONB1 |
