# M3 3.4 guided first run in the engine, 2026-11-13 (Core Gameplay Engineer)

Task: docs/specs/m3-onboarding.md section 5 (E1-E8) with D135, D137 (TUTORIAL_SEED 8736) and D138 (the content's wind-up
rule and Gorrak's gate), reading CONTENT.tutorial (03d3072). Status: **draft** (the spec is draft; owner questions O15-O17
on their defaults). Not in it: src/ui, sim/, src/content, game.html, rules.md (E9's rules lines, outside my files).

## 1. What changed
| Part | Change | Where |
|---|---|---|
| E1 | `newRun({ tutorial: true })` (expedition with the start camp; throws otherwise or without CONTENT.tutorial); `state.tutorial` from START_RUN; zone 1's streams map, node, fight, loot, dim and the hub vendor on `C.TUTORIAL_SEED` (`zoneSeed`) | src/rules.js, src/engine/expedition.js, nodes.js, tutorial.js |
| E2 | Board slot 1 = the content's Cull after the board's own draws; Gorrak on the nearest Elite (alone, not rare, level clamp 4-6, live on the map); scripts S1-S4 and site fights laid on the Quest / Grind nodes after every action (the map shows them; scripts at min(level, 5)); S1's fixed loot (uncommon item for the weakest slot + 1 Healing Draught); D138: only `windup: true` enemies wind up, no first-meeting wind-ups in other guided-zone quest fights; D138 gate: node barred (MOVE / PASS_THROUGH illegal, mapView `barred`, autoplay avoids it) until `s4` has ended, open after SKIP_GUIDE; `validateContent` checks the table | tutorial.js, combat.js, contracts.js, actions.js, autoplay.js, content.js |
| E3 | Rescue: event `rescue`, back to the previous node, full HP / mana / pet, node unresolved, +2 tolls (`time` why `rescue`), `rescues` + 1, no resurrect used | damage.js, nodes.js `rescueEnd`, combat.js |
| E4 | `SKIP_GUIDE` (any phase, fights and loot window included), event `guideSkipped` | actions.js, tutorial.js |
| E5 | `tutorialView` with the beats (below) | tutorial.js, rules.js |
| Beats | G1-G13 tracked in the engine (task request): `beat` events (`open`, `line`, `done`, `missed`, `skip`) with coach line ids; `guideEnd` when zone 1 is left | tutorial.js `tutorialAfter` (called by actions.js after every action) |
| E6-E7 | `profile.guide` / `profile.welcome` (newProfile, `migrateProfile`, `setGuide`); END_RUN sets them; Echo line `welcome` (60) while due; summary block `tutorial: { rescues, skipped, learned }` | meta.js, summary.js |
| E8 | `debug.resetOnboarding(profile)` | debug.js |
| Constants | TUTORIAL_SEED and every ONB_* of spec 12; engine-named: ONB_DIM_NEAR_HOPS 2 (G12 "within 2 hops"), ONB_ENGAGE_SHOWS 2 (G7 "once more"), ONB_BEATS, ONB_BEAT_PRIORITY, ONB_GUIDE_STATES | src/constants.js Part 5 |
| Docs | engine-api.md header line and section 14 (14.1 overlay, 14.2 rescue and skip, 14.3 view, 14.4 beat table, 14.5 profile); rows for newRun, migrateProfile / setGuide, tutorialView, SKIP_GUIDE, events `rescue`, `beat`, `guideSkipped`, `guideEnd`, `move` via `rescue`, profile, `resetOnboarding`; ARCHITECTURE rows (new tutorial.js; rules, constants, actions, autoplay, combat, content, contracts, damage, debug, expedition, meta, nodes, summary, qa/engine); m3-onboarding.md status lines | docs/ |

## 2. The view for the UI
`R.tutorialView(state)` (null in any other run): `{ on, skipped, ended, guidedZone, script, scripts, next, sites, eliteNodeId,
elite: { node, enemy, level, barred, afterScript, left }, rescues, rescueTolls, beat, line, open: [{ id, line }], done, learned,
skippedBeats }`. `beat` / `line` = the open beat with a line, highest priority first (spec 2.5 order in C.ONB_BEAT_PRIORITY).
Line ids map to content: `G<n>` = `beats[i].line`; `G<n>.<key>` = `alt[key]` or `byClass[key]`: `G8.landed`, `G9.rogue` /
`G9.mage` / `G9.hunter`, `G9.landed`, `G10.done`, `G12.caught`, `G13.onRoad`. UI-only: `G1.noContract` (first Set out press
with no contract: prepView `held` 0), G6's hover, "Got it", the queue and pace, the hints and `tbwcr.hints.v2` (spec 3.1, U2:
not in the engine). Gorrak's lines: `elite.barred` with `{n}` = `elite.left`. Rescue float: event `rescue` (`tolls`), then
`move` via `rescue`. Guide end toast: event `guideEnd`. Profile: call `R.migrateProfile` on load; class select toggle and
Settings use `R.setGuide`; summary Echo line id `welcome` (label: content `nudge.welcomeLabel`).

## 3. Choices made (draft, for the Lead)
1. Script order follows D138: a scripted fight's end (won, fled or rescued) moves to the next script, so a lost S1 gives no
   loot. Site fights by order started (content). The gate's `left` counts scripted fights still to end.
2. After SKIP_GUIDE the zone, its streams and its overlay stay (E4 "no other change"); beats, rescue and the gate stop.
   SKIP_GUIDE is refused once the guide has ended (spec says "while not skipped").
3. Rescue target: the previous node of the zone's path; after a Dimmed encounter or a dev fight the same node; onto the hub
   out of the Dimming it is a hub visit (as a walk). Unlimited, as the spec says.
4. The welcome is an Echo line (inside the Oath multiplier, which a first run cannot have), paid on the first non-dev run
   whatever the Satchel; a dev run neither pays nor sets it.
5. The dim stream and the hub vendor of zone 1 are on TUTORIAL_SEED too (the spec names four streams), so zone 1 is fully
   reproducible; item names keep the run seed (they never touch a stream).
6. The engine-named numbers above (ONB_DIM_NEAR_HOPS, ONB_ENGAGE_SHOWS) belong in spec 12 (Designer).

## 4. Checks
| Check | Result |
|---|---|
| qa/engine + qa/rules + qa/docs | **538/538** (was 523; new qa/engine/s18-tutorial.test.mjs 15 tests; s11 test 11.1 now uses a profile that had its welcome) |
| qa/sim | **154/154** (not edited) |
| Golden (s18): 18 autoplay runs (rows, expedition, expedition with the camp; 3 classes; seeds 11, 4242) | actions, events, final states and summaries hash-equal to the engine before this task (25a8879); profile keys not hashed |
| Guided zone across 5 run seeds × classes | identical; sites 1, 4, 7, Gorrak 18, Roads 23, 27, 19, Shardfall 25 (the seed report's facts) |
| `node sim/pick-tutorial-seed.mjs --seed 8736` after the stream change | **still meets (a)-(e)**: tour 5 hops (0 > 2 > 1 > 18 > 7 > 19), 4 ring-1 script slots, 2 near Cull sites, Shardfall 176.4 deg from the Verge; unchanged |
| Guided autoplay run per class | reaches zone 2 (55-62 steps), 0 rescues, G1-G5 learned, G6-G8, G12, G13 open, guide ends once |
| `node tools/build.mjs --out /tmp/...` | builds |

How to test: `node --test qa/engine/ qa/rules/ qa/docs/ qa/sim/`.

## 5. For other roles
- Sim: `newProfile()` now has `welcome: false`, so a fresh-profile run's summary carries the 60-Echo welcome line. Campaigns
  get it once (correct); per-run P0 cells get it every run: set `welcome: true` (or `runs: 1`) in the sim's profiles to
  measure B30 and the Echo numbers without it. No qa/sim test fails today.
- Designer / Lead: rules.md 1.2 (newRun's tutorial option) and 11.1 (the welcome line) are E9 lines outside my files.
- QA (7.1): `R.tutorialView`, the `beat` / `rescue` / `guideEnd` events and the s18 helpers (forced death by HP 1 and enemy
  damage) cover checks 1-4.
