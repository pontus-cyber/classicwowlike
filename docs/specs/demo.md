# Demo build (MD, task D.1)

Owner: Lead Game Designer, 2026-11-25. Status: **draft for the owner**. Scope from D170 (itself draft until the owner agrees). Nothing here is built. Every number is a named constant in section 10. Every player-facing line in this spec is a draft for D.5 (the owner approves every line and name).
Audience: Lead, Core Gameplay Engineer, UI/UX Engineer, Simulation & Balance Engineer, Content Designer, QA.

Sources: the owner's goal [stated: docs/OWNER.md 2026-11-25 14:18, "we need to work towards getting a demo out"]; the scope [source: docs/DECISIONS.md D170; docs/MILESTONES.md MD]; the demo target "zones 1-2 playable by a stranger without help" [source: D151]; the guided first run [source: docs/specs/m3-onboarding.md 2-4]; Legacy and Economy v2 with hall v3d [source: docs/specs/legacy.md 1, 2.1, 4.1, 4.7; D159-D169]; the text rules [source: D150, docs/feedback/2026-11-14-blind-wording.md]; the blind panel findings [source: docs/feedback/2026-11-14-* to 2026-11-20-*]; the build tool [source: tools/build.mjs]; the URL switches and the Dev menu [source: src/ui/engine-bridge.js, src/ui/dev-menu.js, src/ui/settings.js].

---

## 0. The demo in six lines
1. A new player gets the guided first run, then plays zones 1-2 (Amberfold Downs, Greywater Fens) as often as he likes, on any of the three classes, with Legacy on.
2. Leaving zone 2 (a Road or the Bell) ends the run with the **demo-end screen**: what this run did, what is kept, one plain line that the full game goes on. Then the next run.
3. Heroes keep level, XP, spells, talents and Legacy unlocks across demo runs, as in the full game. The hero stops at level HERO_MAX_DEMO (7).
4. The Legacy hall sells seven entries, rank I only: the ones a player feels in zones 1-2.
5. One build switch makes the demo: no URL switches, no Dev menu, no seed field, nothing that links out or asks for an account.
6. A good player reaches level 7 in about 75-80 minutes over six runs; a slower player stops before it [inference, section 3.1; to be measured, DM1].

---

## 1. The cut line

### 1.1 What a player can reach
| Part | In the demo | Note |
|---|---|---|
| Hero select, three classes (Rogue, Mage, Hunter) | yes | every hero is a Legacy hero (legacy.md 1.1) |
| Start camp (lean first run, then the board) | yes | board limited to zones 1-2 (4.3) |
| Zone 1 (guided on the first run, TUTORIAL_SEED; random later) | yes | m3-onboarding.md 2 unchanged |
| Zone 1 dungeon (the Harrow Cellars), elites, rares, Gorrak | yes | |
| Zone 2 with its hub, dungeon, elites, rares, hub contract | yes | |
| Roads and the Homeward Bell out of zone 2 | yes, they end the run (1.2) | |
| Zones 3-6, the Camp, Oruvath | **no** | never generated in a demo run |
| Legacy hall | seven entries (3.2) | |
| Level-20 wing (second and third tree, the Armoury), sets, Oaths, Second Breath, Lost Techniques, Stormhawk | **no** | not listed (4.1) |
| Level-60 runs, classic map | **no** | the demo makes every run a Legacy run on the expedition map |

### 1.2 The zone 2 exit (engine)
- In a run with `C.GATES.demo` on, `leaveZone` (src/engine/nodes.js) from zone DEMO_LAST_ZONE (2) runs as today up to its `travel` event: zone 2's held contracts expire, `stats.zonesLeft` + 1 (so the zone line pays LEGACY_PER_ZONE_HERO for zone 2), the Road's name is in the event. Then, in place of `enterZone(s, ev, 3)`: event `demoEnd { zone: 2, by }` and `endRun(s, ev, 'demo')`.
- A Bell rung on a Dimmed node plays its fight first, as today. A death in it is a death (outcome `death`); the run ends at the exit only if the hero lives.
- Outcome `demo` is an ending like any other (engine-api.md 15.3): it pays the run's Legacy lines, writes the hero (`runs` + 1, `wins` unchanged), sets `profile.runs` + 1 (the next run is no longer a lean first run), sets `profile.guide` as today, records the run in the history. The summary carries `demo: { lastZone: 2 }`.
- Zone 3 is never generated, so no Camp, no Oruvath and no zone 3-6 content can show. Nothing else in zones 1-2 changes.

### 1.3 Before the exit: one line
Zone 2's existing zone-leave confirmation (Road and Bell) gets one more line, only in the demo: "Leaving Greywater Fens ends this demo run. You keep your levels and Legacy points." (draft; the zone name from content). It replaces nothing and adds no second dialog.

### 1.4 The demo-end screen (UI)
The run summary of a run with outcome `demo`, with a demo block above the summary's existing lines. Visible text beyond the summary: at most DEMO_END_MAX_WORDS (80) words. Lines (draft):

| Part | Content |
|---|---|
| Heading | "End of the demo" |
| What you did | "You made it through Amberfold Downs and Greywater Fens." (zone names from content), then this run's summary lines as today: level "4 → 5" with the XP bar (legacy.md 4.7 E6.3), fights won, quests, dungeons cleared, elites; the Legacy lines and total |
| So far | "Runs: 4 · Vex, Rogue, level 5 · Maren, Hunter, level 3" (heroes with at least one run) · "Legacy hall: 3 of 7 unlocks" |
| Kept | the E6.3 lines as on every Legacy summary: "Kept: level 5 (was 4) · spells and ranks · talents · Legacy unlocks" and "Left behind: gear, gold, potions and camp points." |
| At the cap only | "Vex has reached level 7, the highest level in the demo." |
| The full game | "The full game goes on past Greywater Fens: four more zones, the Camp and Oruvath." |
| Buttons | "Next run" (primary, to hero select) · "Legacy hall" |

Not on it: links, URLs, store or wishlist words, sign-up, email, social, ratings, a "buy" or "coming soon" date, images loaded from outside the file, the seed, the play-time estimate, Oruvath's strength line. A run that ends by death or Abandon shows the normal summary, with no demo block.

---

## 2. The demo switch and the gates

### 2.1 One switch
- **Build:** `node tools/build.mjs --demo --out demo.html`. The builder sets `DEMO_BUILD = true` in a new one-line module src/build-flags.js (default `false`); nothing else differs between game.html and demo.html.
- **Start-up:** when `DEMO_BUILD` is true, the app calls `R.applyDemo()` once before the profile loads. It sets `C.GATES` to DEMO_GATES (2.2) and nothing can change them afterwards in that page.
- **Tests and the sim:** `R.applyDemo()` (or `setGates(DEMO_GATES)`) gives the same rules headless. The normal build may take `?demo=1` for the team's own checks; the demo build reads **no** URL parameter at all (`legacy`, `dev`, `debug`, `seed`, `classic`, `expedition`, `prep`, `dimming`, `guide`, `mock`, `speed`, `demo`).
- `?legacy=1` is not needed: the demo turns the Legacy switches on itself.

### 2.2 DEMO_GATES
Every switch at its main default, plus four on. One exported constant in src/constants.js; a test checks that `applyDemo()` sets exactly it.

| Switch | Demo | Why |
|---|---|---|
| `legacy` | on | heroes, levels 1-25 scale, Legacy points (D154) |
| `oruvathLegacy` | on | the Legacy class numbers (D157) are read only with it and `legacy` (D158); Oruvath himself is out of reach |
| `economyV2` | on | camp points pay nothing, zone 10, XP against the zone, zone 1 lag, hall v3d (D159, D167) |
| `demo` (new) | on | the cut (1.2), the cap (3.1), the hall (3.2), the board (4.3) |
| The Hunter package of D169 (switch named in D.2) | on | Legacy-only class numbers, as `oruvathLegacy` |
| `firstRunLean`, `gorrakBounty`, `guidedHold`, `steadyDim`, `rescueDim`, `gorrakLevel`, `bountyRoad`, `zone2InnerCap`, `z1Dmg`, `rewardPrimary`, `autoEmberFirst`, `boardAcrossRun`, `passStealth`, `sapHold`, `firstMeetWindup`, `rareHpMultZ1` | on (as main) | the guided and lean first run and the D150-D153 fixes |
| `swiftRoad`, `campReroll` | off (as main) | |

When D.2 turns Legacy on by default, DEMO_GATES equals the main defaults plus `demo`.

### 2.3 Nothing for developers on screen
In the demo build: no Dev menu (not created; the backquote key does nothing; the Settings toggle for it is not shown), no "Classic map (old)" setting, no mode chip, no Seed field at class select and no Seed row in the summary, no `mock` engine, no debug overlay. Dev runs cannot happen, so every run pays as a real run.

### 2.4 Storage
- The demo stores everything under DEMO_STORAGE_PREFIX (`tbwcr.demo.`): profile, hints, history, settings. A team build opened on the same machine never mixes with it.
- If storage throws or is unavailable (private window, a blocked frame), hero select shows one line: "This browser window cannot save your progress." (draft) and the game plays on without saving.
- Settings gets **Start over** (confirmation: "Start over? Your heroes and Legacy unlocks are deleted.", draft): clears the demo's keys and returns to hero select with a new profile. It replaces the Dev menu's "Reset onboarding" for testers and for a shared computer.

---

## 3. Hero level cap and the hall

### 3.1 Cap: HERO_MAX_DEMO 7
- In a run with `demo` on, `heroCap = HERO_MAX_DEMO` in place of HERO_MAX_LEVEL. At the cap the hero's XP stays at 0 into the next level and further XP is not counted; `heroView` gives `atMax: true, cap: 'demo'`; XP events carry `capped: true` and the UI shows no XP number for them. The level-25 rule (every HERO_XP_AT_MAX XP pays Legacy) does not apply. Every other Legacy line still pays.
- Hero select and the HUD show the full XP bar with "Level 7: the demo's highest" (draft) for a capped hero. The level-up banner to level 7 adds that line once.
- Why 7: every class gets a new spell at level 7 (Smoke Veil, Spellsnap, Snare Trap; legacy.md 1.7) and the first talent points (1 at level 5, 4 at level 7; legacy.md 1.8), so the last level-up of the demo is a visible gain. Level 9 brings the Lost Techniques, which are full-game content.
- Pace behind the number [inference; source: legacy.md 4.7 E4-E5, report legacy-economy-2026-11-19 sections 3 and 6]: a full Legacy run pays about 6 100-6 900 hero XP at hero 1-5 in about 36 pace minutes; zones 1-2 are about a third of its nodes, so a demo run pays about DEMO_RUN_XP (2 000) in 11-13 pace minutes plus about 1-2 minutes at the camp and the hall. The guided first run pays more: hero 2 (1 800) inside zone 1, the bounty's road XP (about 280) and zone 2. Chained on HERO_XP_ECON2 (cumulative 1 800 / 3 650 / 5 550 / 7 650 / 9 800 / 12 050 for levels 2-7):

| Run | Hero at start → end | Pace minutes, cumulative | Legacy this run (draft estimate) | Cumulative Legacy | Demo hall entries owned after |
|---|---|---|---|---|---|
| 1 (guided, lean) | 1 → 2.7 | 20 | about 110 (welcome 60, 1 level, 2 zones, quests, Gorrak) | 110 | 2 (Packed Satchel, one more) |
| 2 | 2.7 → 3.8 | 33 | about 55 | 165 | 3 |
| 3 | 3.8 → 4.8 | 46 | about 55 | 220 | 3-4 |
| 4 | 4.8 → 5.7 | 59 | about 55 | 275 | 4 |
| 5 | 5.7 → 6.6 | 72 | about 55 | 330 | 5 |
| 6 | 6.6 → 7 (cap mid-run) | about 78 | about 50 | 380 | 5-6 |

- So the planner meets the cap at about 78 pace minutes in run 6 with one or two hall entries still to buy. A player at 70 % of the planner's rate (legacy.md 4.7 E5's reading) is at about hero 6 after 90 minutes. Lever after DM1: HERO_MAX_DEMO 6 or 8.

### 3.2 The demo hall: DEMO_HALL, rank I only
Prices and effects are hall v3d (legacy.md 4.7 E5; `META_HERO`), unchanged.

| Entry | Price | Why it is in |
|---|---|---|
| Packed Satchel | 50 | the first-run nudge (m3-onboarding.md 4); potions matter from fight 1 |
| Vigor of the Line I | 70 | felt in every fight (+3 % max HP) |
| Edge of the Line I | 70 | felt in every fight (+2 % Power) |
| Quick Study I | 80 | levelling is the demo's progress (+5 % XP) |
| Deeper Pockets | 50 | bags fill in zone 2 [source: 2026-11-20 returning player] |
| Cartographer | 60 | Region Charts work in zones 1-2 |
| Quartermaster I | 70 | +2 camp points from the second camp on |
| **Total** | **450** | above the about 380 a planner earns to the cap, so the player leaves with something to want |

- `metaOffers` in a demo run lists exactly DEMO_HALL at ranks up to DEMO_HALL_MAX_RANK (1); a `BUY` of anything else is refused ("not in the demo"). Entries not listed are not shown (no locked rows, no teaser).
- Left out, and why: Vigor II, Edge II, Quick Study II, Quartermaster II (second ranks: the demo hall stays one row each); Old Hand and Swift Boots (a second vision entry and a Bell charge pay off over six zones); Second Breath and Oaths (need Oruvath); Lost Techniques (hero 9 and 17); Stormhawk (a Hunter-only purchase would give one class a bigger hall); the level-20 wing.
- "Next in the hall" (E6.3) names the cheapest affordable demo entry, or none; with all seven owned it reads "You own every unlock in the demo." (draft).
- The welcome (60) is paid once per demo profile, as today.

---

## 4. Hidden or trimmed in the demo
Rule: a system that pays off only after zone 2 is not shown; nothing is shown that the player cannot use in zones 1-2. The D150 rules hold for every line added here: one word per mechanic ("tolls", "the Dimming", "Oruvath", "Ember of Return", "camp points", "Legacy points"), no "Echoes", "Reserve", "par", "Ascendancy", "Pays", "Spoils", "the Star's line" or "ilvl" in player text, each instruction once on screen.

### 4.1 Hidden
| What | Where | Rule |
|---|---|---|
| Seed field, Seed summary row | class select, summary | not built in the demo (2.3) |
| Dev menu, Classic map, mode chip, Dev toggle | everywhere | 2.3 |
| Hall entries outside DEMO_HALL; the level-20 wing | Legacy hall | 3.2 |
| Oruvath's strength line ("Oruvath: no stronger") | summary | not shown in a demo run |
| Play-time estimate ("about N min by hand, M with autoplay") | summary | not shown [source: 2026-11-19 and 2026-11-20 returning player, read as unexplained] |
| Level-up banner lines for hero 20 and 25 | banner | cannot occur under the cap |
| Hints H35 (the Camp), H36 (end boss) | coach line | cannot fire (no Camp, no Oruvath); no code change |

### 4.2 Kept as in the full game
The guided first run and its beats; first-time hints; the lean first run; the start camp and the talent window (one tree; "Your first point chooses your tree until level 20." stays: it is true of the game); respec at the camp; Retire hero; Abandon run; the Furnace, tolls, heat rewards and the Dimming (owner question Q1); the trainer; contracts; autoplay and fast mode; Settings (Hints, Reset hints, Play the guide again).

### 4.3 Trimmed
- **Contract board:** from the third run the board draws its three slots from CONTRACT_BOARD_BANDS_DEMO ([[1, 1], [1, 2], [2, 2]]) in place of CONTRACT_BOARD_BANDS, so no offer names a zone the player cannot reach [source: 2026-11-20 returning player: offers for zones 4 and 5, none for zone 1]. The second run's one offer (CONTRACT_BOARD_FIRST_BANDS) and the first run's none are unchanged. Zone 2's hub contract is unchanged.
- **Map:** zone 2's Roads keep their names; their tooltip and the leave confirmation carry the line of 1.3 (once, not on the node chips).

---

## 5. Done when (the demo build)

### 5.1 Automated checks (QA, D.6; engine checks run headless with `applyDemo()`)
| # | Check | Pass |
|---|---|---|
| A1 | Headless demo campaign per class from a fresh profile, QA policy with autoplay in fights: guided run, then runs until the cap | every run ends at the zone 2 exit, by death or by Abandon; outcome `demo` with the summary's `demo` block; hero level and Legacy carried into the next run |
| A2 | Cut fuzz: DEMO_FUZZ_RUNS random-legal-action runs per class | 0 states with `zone.z` > 2, a Camp or a boss fight |
| A3 | Cap | a hero set to level 6 (debug) gains to 7 and stops; `atMax`, `cap: 'demo'`; no level line past 7; no XP-past-max Legacy |
| A4 | Hall | `metaOffers` lists exactly DEMO_HALL at rank 1; `BUY` of any other id or rank is refused |
| A5 | Board | DEMO_BOARD_SEEDS seeds × runs 1-5: no contract outside zones 1-2 |
| A6 | Gates | `applyDemo()` sets exactly DEMO_GATES; demo.html with any URL parameter plays the same seed-for-seed as without |
| A7 | Nothing for developers | in demo.html no Dev menu element, backquote does nothing, no "Seed" text on any ui-regress screen, no `?`-switch read |
| A8 | Nothing outside | the page makes no network request after load; the built file holds no `http://` or `https://` URL outside comments; no `<a href>` and no `window.open` on any demo screen |
| A9 | Text | qa/ui/text-pass naming rule over every demo screen; the demo-end block at most DEMO_END_MAX_WORDS words; every new line in the D.5 page |
| A10 | Existing suites | `node --test qa/engine qa/rules qa/docs qa/sim qa/ui` and ui-regress pass on the normal build and with `applyDemo()` |

### 5.2 Browser matrix (QA, D.6)
- Chrome, Firefox and Edge, current stable, on Windows; window inner size 1366x768 and 1920x1080 at 100 % zoom; 1920x1080 at 125 % display scaling as a report-only row.
- Each cell opens demo.html two ways: from disk (file://) and served over https inside an iframe (as a hosting page shows an HTML game).
- Each cell: one demo run to the demo-end screen (any class, the three classes across the matrix), the ui-regress screens, no console error or warning from game code, storage works (or the 2.4 line shows and the game plays on).

### 5.3 Save and reload (QA, D.6)
Reload (F5) and close-and-reopen at: hero select, start camp, map, a fight's round 1 and a later round, the loot window, the level-up banner, a hub service, the demo-end screen, the Legacy hall right after a purchase, Settings. Pass:
- heroes, levels, XP at the last checkpoint (zone arrival or run end), Legacy points, hall purchases, hints seen, guide state and settings are as before;
- the run in progress is lost as today (no run resume; owner question Q3) and nothing is paid twice: a reload on the demo-end screen or in the hall pays and charges nothing again; the welcome stays paid once;
- a reload during the guided run starts a guided run again (the profile's first run did not end).

### 5.4 Long session and performance (QA, D.6)
- One tab, DEMO_LONG_SESSION_MIN (120) minutes of scripted play at normal speed (and a second pass at fast speed), at least 8 runs including the cap: no console errors; JS heap after a forced GC at the end at most DEMO_HEAP_GROWTH_MAX (1.5) × the heap after the first run; DOM node count at most 1.2 × after the first run; the bridge's per-run logs cleared at each run end.
- Load to hero select within DEMO_LOAD_S (3) seconds from disk; demo.html at most DEMO_FILE_MB_MAX (3) MB (game.html is 2.4 MB today).
- Frame time p95 at most DEMO_FRAME_P95_MS (20) on the map and in fights at 1920x1080, in headless Chrome with 4× CPU throttling as the stand-in for a mid laptop; the owner's own machine in D.8 is the real check.

### 5.5 Blind panel (D.7)
- Three fresh blind testers (Fable, high effort, no repo or docs), the demo build, a fresh profile each, DEMO_PANEL_ACTIONS (400) actions each, told only "This is a game demo. Play as you like."
- Personas and classes: Newcomer, guide on, Mage, 1366x768; Impatient skipper, skips the guide, Rogue, 1366x768; Returning roguelike player (plays for what carries over, at least four runs), Hunter, 1920x1080.
- **Pass bar** (all of): each reaches the demo-end screen at least once without help (stuck = DEMO_STUCK_ACTIONS (20) actions with no way on); each says yes to "would you play another run now"; "would play again tomorrow" at least DEMO_PLAY_AGAIN_MIN (6) for each and median at least DEMO_PLAY_AGAIN_MEDIAN (7); clarity at least DEMO_CLARITY_MIN (6) for each; each can say in own words what the demo kept and that the full game goes on; no bug or quit moment that the Lead rates a blocker remains open after the fixes.
- A miss: fixes, then a re-run with three new testers on the same personas; after two rounds the Lead reports to the owner with the scores.

### 5.6 Owner sign-off (D.5, D.8)
- D.5: the owner approves the one review page with every draft line, name and number a demo player can see.
- D.8: the owner plays demo.html on his own machine from Start over to the demo-end screen at least once and says it can go out. Recorded in docs/feedback and DECISIONS. Then D.9 (the private preview package); publishing is the owner's own action.

---

## 6. Targets (proposed; to be measured by the Sim in D.2/D.3)
Planner campaign from a fresh profile with `applyDemo()`: the guided first run, then runs at the kept level, buying in the order satchel, vigor, edge, quick_study, pockets, cartographer, quartermaster; 40 campaigns per class.

| Id | Metric | Target | Inference today (3.1) |
|---|---|---|---|
| DM1 | Pace minutes to the cap, median | DEMO_CAP_MIN_LO-HI (65-90) | about 78 |
| DM2 | Runs to the cap, median | DEMO_RUNS_LO-HI (5-7) | 6 |
| DM3 | Pace minutes of a demo run: the guided first run / later runs | <= DEMO_FIRST_RUN_MAX (28) / DEMO_RUN_LO-HI (10-17) | about 20 / 13 |
| DM4 | Runs dying in zones 1-2, per class, at hero 1, 3, 5 and 7 | <= DEMO_DEATH_MAX (12 %) each; class spread <= DEMO_CLASS_SPREAD (8 pp) | not measured (B21 measured 5.0 % on the unguided first run, legacy.md 5.1) |
| DM5 | Hall entries bought after each of runs 1-4 | >= 1 (EARLY_BUY_MIN) | 2, 1, 0-1, 1 |
| DM6 | Cumulative Legacy at the cap | DEMO_LEGACY_AT_CAP_LO-HI (300-450) | about 380 |
| DM7 | ONB1 and ONB2 on the guided zone at hero 1 with DEMO_GATES | as m3-onboarding.md 8 | not re-measured since Legacy (legacy.md 5.1) |

Oruvath's B6 does not gate the demo: no demo run meets him. DM4 is the demo's class check.

---

## 7. Risks
| # | Risk | Mitigation |
|---|---|---|
| R1 | The guided zone and zone 2 are not re-measured at Legacy levels (5.1 of legacy.md); the first 20 minutes decide the demo | DM3, DM4, DM7 in the first sim pass, before the blind panel |
| R2 | Art: the demo's look waits on the owner-led proof slice (D121, D.4); dungeon interiors still show the meadow [source: 2026-11-14 casual and competitive] | the demo needs only zones 1-2, two dungeons and the hub; D.4 scoped to those |
| R3 | Open zone 1-2 bugs from the blind rounds (dungeon fight count, portraits, label overlaps, Furnace label flips) | QA triage of qa/bugs.md and BACKLOG for zone 1-2 screens before D.7 |
| R4 | Storage blocked or partitioned in a hosting page's iframe: progress lost | 5.2 iframe cells; the 2.4 line |
| R5 | A closed tab loses the run in progress | the zone checkpoint keeps XP; run resume is owner question Q3 (about 1.5 sessions) |
| R6 | Five or six runs over the same two zones feel repetitive | the cap and the hall end progression at about the 90-minute mark; DM2 and the panel's "would play again" |
| R7 | New demo lines bring the D150 text load back | A9; every line on the D.5 page |
| R8 | The Furnace's cost (Oruvath stronger) cannot be felt in the demo, so overspending looks free | the Dimming still costs places; owner question Q1 |

---

## 8. Estimate per MD task (sessions of one agent slot)
| Task | Sessions | Work |
|---|---|---|
| D.1 | 0.5 | this spec (done) |
| D.2 | 2 | Hunter package in the engine (0.5); pace check on the D168 reading and B6 on fresh seeds (1); DM1-DM7 cells with `applyDemo()` (0.5) |
| D.3 | 3.5 | Engine 1 (`demo` gate: cut, `demoEnd`, cap, hall list, board bands, `applyDemo`, tests, engine-api rows); UI 2 (build flag, no URL switches, hide list, demo-end screen, zone 2 line, storage prefix and Start over, cap display); Lead 0.5 (build, review) |
| D.4 | 3-4 | owner-led proof slice, then the zone 1-2 pass (UI); depends on the owner |
| D.5 | 1.5 | Content 1 (the review page: every line, name and number on the demo's screens); Lead 0.5 |
| D.6 | 2.5 | QA 1.5 (5.1-5.4); fixes 1 |
| D.7 | 3 | panel 1; fixes 1.5; re-run 0.5 |
| D.8 | 0.5 | Lead support; the owner's own play |
| D.9 | 0.5 | package: demo.html and a short readme |
| **Total** | **about 17-18** | Order: D.2 and D.3 together; D.5 and D.6 once D.3 builds; D.7 after D.6; D.4 when the owner starts it; D.8, D.9 last |

---

## 9. Open questions for the owner (the team builds on the default)
| # | Question | Default |
|---|---|---|
| Q1 | The Furnace warns that overspending makes Oruvath stronger, and the demo has no Oruvath. Keep the Furnace exactly as in the full game, or soften it in the demo? | Keep it as in the full game: the demo teaches the real game, and the Dimming still makes tolls cost places; **Lead call 2026-11-26 (draft, the owner may reverse it): the demo shows the demo Furnace lines (`TUTORIAL.demo` G5, H16, H17 and `DEMO_TEXT.furnaceLine`) and no "Boss +N %" on the meter, since no demo run meets the boss** |
| Q2 | Should demo progress carry into the full game, and should the demo-end screen say so? | No promise: the demo saves under its own keys and the screen says only that the full game goes on; an import can be added later (about 0.5 session) |
| Q3 | A player who closes the tab mid-run loses that run (XP up to the last zone arrival is kept). Add run resume for the demo? | No resume (saves about 1.5 sessions); runs are about 13 minutes |

---

## 10. Constant table
| Name | Value | Use |
|---|---|---|
| DEMO_LAST_ZONE | 2 | leaving this zone ends a demo run (1.2) |
| HERO_MAX_DEMO | 7 | hero level cap in the demo (3.1) [inference; DM1] |
| DEMO_HALL | satchel, vigor, edge, quick_study, pockets, cartographer, quartermaster | hall entries sold in the demo (3.2) |
| DEMO_HALL_MAX_RANK | 1 | highest rank sold of each (3.2) |
| CONTRACT_BOARD_BANDS_DEMO | [[1, 1], [1, 2], [2, 2]] | board slot bands from the third run (4.3) |
| DEMO_GATES | 2.2 | the switches `applyDemo()` sets |
| DEMO_STORAGE_PREFIX | `tbwcr.demo.` | storage keys of the demo build (2.4) |
| DEMO_END_MAX_WORDS | 80 | words of the demo block on the demo-end screen (1.4) |
| DEMO_RUN_XP | 2 000 | hero XP of a later demo run, planner (3.1) [inference] |
| DEMO_FUZZ_RUNS | 200 | random-action runs per class for A2 |
| DEMO_BOARD_SEEDS | 200 | seeds for A5 |
| DEMO_LONG_SESSION_MIN | 120 | minutes of the long-session check (5.4) |
| DEMO_HEAP_GROWTH_MAX | 1.5 | heap at the end over the heap after run 1, at most (5.4) |
| DEMO_LOAD_S | 3 | seconds from opening to hero select, at most (5.4) |
| DEMO_FILE_MB_MAX | 3 | size of demo.html, at most (5.4) |
| DEMO_FRAME_P95_MS | 20 | frame time p95, at most (5.4) |
| DEMO_PANEL_ACTIONS | 400 | actions per blind tester (5.5) |
| DEMO_STUCK_ACTIONS | 20 | actions with no way on that count as stuck (5.5) |
| DEMO_PLAY_AGAIN_MIN / MEDIAN | 6 / 7 | "would play again tomorrow", each / median (5.5) |
| DEMO_CLARITY_MIN | 6 | clarity score, each tester (5.5) |
| DEMO_CAP_MIN_LO-HI | 65-90 | DM1, pace minutes to the cap |
| DEMO_RUNS_LO-HI | 5-7 | DM2, runs to the cap |
| DEMO_FIRST_RUN_MAX | 28 | DM3, pace minutes of the guided first run to the demo end |
| DEMO_RUN_LO-HI | 10-17 | DM3, pace minutes of a later demo run |
| DEMO_DEATH_MAX | 12 % | DM4, runs dying in zones 1-2 per class and hero cell |
| DEMO_CLASS_SPREAD | 8 pp | DM4, largest class gap |
| DEMO_LEGACY_AT_CAP_LO-HI | 300-450 | DM6, cumulative Legacy points at the cap |
