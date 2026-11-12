# D128 lean start camp and a less cluttered map, 2026-11-12 (Core Gameplay Engineer, UI for this task)

Task: owner playtest 2026-11-12 20:19 (docs/feedback/2026-11-12-2019-owner.md; D128): the start camp stripped to three
contract choices and a few supplies, the fog map with smaller icons and less text. Engine, UI, specs, tests. Not in it:
sim/ and qa/sim (not edited; section 4), the sound files (audio.js, director.js, app.js, settings.js: not touched),
game.html. Status: draft until the owner plays it.

## 1. What changed
| Part | Change | Where |
|---|---|---|
| Engine: board | `CONTRACT_BOARD_SIZE` 8 -> **3**: one contract each for zones 1, 2, 3 (the first three slots of the board drawn before, same stream `prep(0)`). `CONTRACT_BOARD_EXTRA` retired. Zones 4-6 offer theirs at the hub (3.6, unchanged). `CONTRACT_SLOTS` unchanged (4) | constants.js; contracts.js `drawBoard(s, k, kept, size)` |
| Engine: reroll | `REROLL_BOARD` refused ("no reroll at the start camp") while the new switch `C.GATES.campReroll` is **off** (default). The rule, REROLL_PRICE and REROLL_MAX stay for a later meta unlock. `prepView.reroll.open` tells the screen | constants.js `GATES`; contracts.js `rerollError`, `prepView` |
| Engine: options | New `C.PREP_CAMP_OPTIONS` = Field Draughts, Ember of Return, Region Charts, Tracker's Notes (the four the planner valued, balance 2026-11-11f). `prepView.options` lists only these; `BUY_PREP` refuses the other five ("not offered at the start camp"); their rules and SET_OUT effects are unchanged | constants.js; contracts.js `buyPrepError`, `prepView` |
| UI: start camp | One lean screen: the 3 contract cards side by side (key, kind, zone, price; headline; one line of what to do, "Win 2 sites in Millbrook Steadings"; the pay in one line; Take / Drop), the 4 options as small cards in one row (key, icon, name, price, Buy / Sell or Owned), the points left with one Reserve line, Set out bottom right. Zone band, sites and where they lie, exact XP, rarities, effects, refunds and slots moved into the tooltips. Keys 1-3, A-D, Enter; R and the reroll button only while `reroll.open`. The held-contracts column is gone (the cards show taken) | src/ui/prep.js, style.css |
| UI: map | Node icons about 70 % (3.7 -> 2.6 rem; unknown 2.8 -> 2.0; hub 4.6 -> 3.2; flag, site pin, enemy count smaller). Text labels (level, enemy count, tolls) only on the player's node, the reachable nodes and contract sites; every other node is quiet: a fight's level as a small pip in its level colour, band, "Hub" and enemy count on hover (the tooltip has them). The Dimming clock in full ("dims in N", "Dims in 2!") on the player's node and reachable nodes; elsewhere its number only, at the node's lower right | src/ui/screens.js `buildExpMap`, style.css |
| Specs | expedition.md 1 (PREP actions), 2.2-2.5, 3.5, 9.1, 9.2, 13 (CONTRACT_BOARD_SIZE 3, CONTRACT_BOARD_EXTRA retired, REROLL lines, PREP_CAMP_OPTIONS row), all marked "(D128)"; engine-api.md 13.1, 13.2 (`options`, `reroll.open`), 13.4; ARCHITECTURE rows (constants, contracts, screens, prep) | docs/ |

## 2. Commits
- 79be9af D128 engine: lean start camp: 3 offers, no reroll, four camp options
- f1805c6 D128 UI: lean start camp and a less cluttered fog map
- this note, the two screenshots and one tooltip line in prep.js (the points' tooltip names the Reserve's Echoes without a
  fixed number): the commit after f1805c6. The browser runs above used f1805c6; the screenshots the final build (no
  console errors)

## 3. Checks
| Check | Result |
|---|---|
| qa/engine | **455/455**. s01d: the board is zones 1-3 = boardOf(prep(0)); the reroll refused with the switch off (legalActions, prepView `reroll` `{ open: false, ..., can: false }`) and played as before with it on (withGate); the no-repeat rule on 8-slot boards drawn through `drawBoard(..., 8)` (150 seeds, rerolls with kept offers, the QA seed-4 board), and the 3-slot board always equals the plain draw; the camp offers exactly PREP_CAMP_OPTIONS (prepView, whyIllegal, legalActions); the other options' effects (Bell, Mule, Guide, Spyglass, Rations) still checked with every option offered (withCamp). s13: GATES keys incl. `campReroll` (off). s01e: meta-owned perks with every option offered, and the camp shows Charts and Tracker owned |
| qa/rules | 56/56 |
| qa/docs | 6/6 (code-map: ARCHITECTURE rows) |
| ui-regress 1366x768, all parts (A-P) | **271/271**, no console errors (build of f1805c6). M: the camp = R.prepView after clicks and keys 1, 2, A, C, R (sends nothing), drop, sell, buy, 3; 3 cards side by side, 4 options in one row under them, no reroll button; every number with its word, the pay on one uncut line; tooltips cover no other card or Set out. N: fog states, levels, counts, sites, moves = R.mapView; labels only on the player's node, reachable nodes and sites; full clocks there, the number elsewhere; no label overlap around the hub and after the Dimming spread; nodes at least 24 px (unknown 18 px) |
| ui-regress 1920x1080, A, M, N | **63/63**, no console errors |
| full-run, Rogue, default (expedition, start camp) | **PASS** at 1366x768: death at level 23 in zone 3, 198 decisions, 296 clicks; console errors 0, page errors 0, divergences 0, layout 0 (534 s) |
| qa/sim | 136/137 (not edited): the one failure is section 4 item 1 |

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/
node tools/build.mjs --out /tmp/g.html
node qa/browser/ui-regress.mjs --file /tmp/g.html --sizes 1366x768 --parts M,N
node qa/browser/full-run.mjs --file /tmp/g.html --sizes 1366x768 --classes rogue
```
Play: start a run; the camp shows three cards and four options; keys 1-3 and A-D; hover a card for the details.

## 4. What sim/ must change (not edited here)
1. `sim/lib/output.mjs GATE_TAG`: add a tag for `campReroll` (e.g. `rr`); qa/sim/v14 "the cell name marks every switch ..."
   fails until then (the only qa/sim failure). The sim's gate rule (named switches on, the rest off) keeps the reroll off.
2. `sim/lib/params.mjs B42_VISION_PERKS` lists `prep_guide` and `prep_spyglass`, which the camp no longer sells: B42 (vision
   value) should read the camp's perks (`C.PREP_CAMP_OPTIONS` of kind `vision`: Charts, Tracker) or set `C.PREP_CAMP_OPTIONS`
   per arm.
3. `sim/run.mjs --prep-force / --prep-ban` accept any `C.PREP_OPTION` id; an id outside `C.PREP_CAMP_OPTIONS` is now never
   bought (prepView does not list it): warn or refuse.
4. `speedPrep` tries the Second Clapper first; it now falls through to Field Draughts (no code error, a policy change).
   `plannerPrep`'s Bell and Guide terms find no option and drop out.
5. Re-measure B39 (completion) and B40 (plan value) as the Lead's plan says: at most 3 contracts at the camp (planner P0
   took 3.4 before, 2026-11-11f), zones 4-6 only from hubs; the exit levels (B20) if contract XP per run falls.

## 5. Known issues
- The camp's cards say "Win 2 sites in <region>" for a Cull; "site" is the tracker's word, explained in the card's tooltip.
- A contract card's tooltip, opened from the left card, lies over the option row (it avoids the other cards and Set out,
  as part M checks).

## 6. Open questions (defaults taken, owner or Lead to confirm)
- The Lead's plan in the feedback file says "take 1"; the task said "keep held-contract slots as they are". Default: slots
  unchanged (4), all three offers can be taken. To allow one, set `CONTRACT_SLOTS` (whole run) or add a camp cap.
- Which four options: the default is the planner's four most bought. The Second Clapper and the Spyglass are gone from the
  first screen; a meta unlock could put one back by adding it to `PREP_CAMP_OPTIONS`.

Screenshots: docs/handoffs/screens/engineer-2026-11-12d-1-camp-1366.jpg, engineer-2026-11-12d-2-map-1366.jpg.
