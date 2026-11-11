# M2b v9 and v10 in the engine, 2026-11-11 (Core Gameplay Engineer)

Task: docs/specs/changes-m2b-v9.md rows 1-4 (D78-D81) and docs/specs/changes-m2b-v10.md engine rows A1-A3, B1-B4, C1
(D82-D86), the confirmed engine defaults and `TAKE_HUB_CONTRACT(mode, contractId)` (D90). Not in it: v9 row 5 (a
balance.md target, owner review O4), the v10 bot rows C2, D1, D2, the EST_COMPLETE prior, the C3 target and appendix P
(potion drops). Status: draft, as both change docs.

## 1. What changed
| Row | Change | Where |
|---|---|---|
| v9 1 | TALENT.r_b9 healPct 0.10 -> 0.15 (Death's Sidestep) | src/constants.js |
| v9 2 | Main arm: TALENT.h_a2 petDmgPct 0.15625 -> 0.18, TALENT.h_a1 petHpPct 0.10 -> 0.115 (arm B, Thick Hide 0.13 alone, is the sim's switch) | src/constants.js |
| v9 3 | ZONE_DANGER_STEP 0.375 -> 0.45: level 21 ×1.045, 30 ×1.45, 40 ×1.9, 50 ×2.35, 60 ×2.8; dungeons at 60 ×1.9 | src/constants.js |
| v9 4 | ECHO_PER_LEVEL 1.5 -> 1.0 (level 60: 59 Echoes) | src/constants.js |
| v10 A1 | Contract XP = round(xpFrac × XP_WEIGHT_MULT × xpToNext(CL_c) × (1 + Quick Study + Insight)), no level-difference modifier, not a kill (no rested), the node's heat after it, 0 at MAX_LEVEL. New `reward.xp` in `prepView` board offers and `contractView` contracts / hub offer: that amount if completed now, before heat | src/engine/progress.js (`flatXp`), src/engine/contracts.js |
| v10 A2, A3 | CONTRACT_CL_OFFSET 5 -> 8 (CL_c = 10z - 2; rare items 10z - 1, epic 10z + 1); CONTRACT_RARE_W / EPIC_W 65 / 35, BOUNTY_RARE_W / EPIC_W 40 / 60 | src/constants.js |
| v10 B1-B3 | DELVE_XP_FRAC 1.0 -> 1.5; CONTRACT.delve.price 1 -> 2; EXPED_TIME_DUNGEON 6 -> 5 | src/constants.js |
| v10 B4 | New DUNGEON_DIM_HOLD 3. `dimAt(zone, id)` adds it on the zone's Dungeon node, so the Dimmed test (entering, the settle step, lost content), `heatView.dimIn`, `heatPreview` and the Dimmed encounter follow. Front, `frontNextIn` and the `dimming` event are unchanged. New `dimAtSeen` / `dimmedSeen`: the hold only on a Dungeon the player knows (see 3.2); `mapView` nodes and the autoplay map policy (1.9.9) use them | src/engine/expedition.js, src/engine/autoplay.js, src/engine/nodes.js (comment) |
| v10 C1 | XP_WEIGHT_MULT 1.6 -> 1.4 | src/constants.js |
| Defaults, action | Engine defaults 1-12 of engineer-2026-11-11f are confirmed (D90). Nothing to change in code: `TAKE_HUB_CONTRACT(mode, contractId)` was already the action; `contractId` is ignored with `reserve`. Autoplay's start camp already takes the board's contract per zone whatever its kind and price | engine-api.md 3, 13.4 |
| UI | The contract tooltip said "N levels of XP at level L (less when you are above it)". That is no longer true under A1. It now reads "... at level L (8 176 XP), ..." from `reward.xp`, and the hub offer's tooltip does too. Talent texts: Death's Sidestep 15 %, Thick Hide +11.5 %, Ferocity +18 % | src/ui/prep.js, src/ui/mock-data.js |
| Docs | rules.md: 6.1, 6.3, 7.6, 11.1 and 13 "(M2b v9)"; 1.9 status sentence, 1.9.6 (the dungeon holds out), 1.9.8, 1.9.9, 1.9.10 and 13 (DUNGEON_DIM_HOLD, XP_WEIGHT_MULT, EXPED_TIME_DUNGEON) "(M2b v10)"; status line. expedition.md: 3.1, 6.2, the 9.5 plan rows and 13 "(M2b v10)"; status line. engine-api.md: status, `zoneDanger`, `TAKE_HUB_CONTRACT`, `dimming` event, 10.3 `dimAt`, 13 intro, 13.1, 13.2 `reward.xp`, 13.4 confirmed. ARCHITECTURE rows of constants.js, contracts.js, expedition.js, progress.js. qa/rules/COVERAGE rows 1.9.6, 1.9.8, 7.6 | docs/ |

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **381/381** (377 before). New: s01b "the dungeon holds out" (3 real-content seeds: dimAt on every node, the front on time, entry until the hold ends, `dimIn` on the Dungeon, the hidden Dungeon shows the hops' value, Region Charts show the hold); s01d "M2b v10" (CL_c = 10z - 2, `reward.xp` on every board offer, a played Cull site paying the same XP at levels 1, 9 and 30, 0 at 60); s13 "change docs M2b v9 and v10" (the engine constants equal the New column of both change docs' constant tables, main arm). Changed: v9 numbers in s06, s07, s11, s13, api-events; s01b tolls 5 and dimAt; s01d reward without diffMod, item levels at CL_c, Reserve with a Delve at 2 |
| qa/rules | **56/56** (r06 Ferocity 3: × 1.54) |
| qa/docs | **3/3** |
| qa/sim | **89/90**, one failure from a changed number, sim/ not edited (section 4) |
| Rows golden | 18 real-content rows autoplay runs (3 classes × seeds 1-6): per-step events identical between the v9 commit b17e86b and the v10 tree, so v10 does not touch rows runs |
| Fog leak tests | s01b 1.9.5 (hidden contents replaced: `mapView` and `autoAction` unchanged) and qa/sim's three leak tests: no decision changed. Without `dimAtSeen` both would fail, because the hold would show where a hidden Dungeon is |
| Build | `node tools/build.mjs --out /tmp/eng-g/game.html`: 58 modules, 1 668 KB |
| ui-regress parts M and L at 1366x768 | **40/40**, no console errors. M-prep's contract tooltip shows "2.8 levels of XP at level 8 (8 176 XP)"; M-reward: the completed contract pays +8 176 XP = the engine's events |

Not run: ui-regress parts other than M and L, 1920x1080.

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/ && node --test qa/sim/
node tools/build.mjs --out /tmp/eng-g/game.html
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/eng-g/game.html --sizes 1366x768 --parts M,L
```

## 3. Engine readings (Lead or designer to confirm; each is one place to change)
1. **B3, B4 and C1 act on every expedition run, not only on runs with `prep`.** They are expedition-map constants (rules 1.9.8, 1.9.6). The sim's model reads `C.XP_WEIGHT_MULT` and `C.EXPED_TIME_DUNGEON` for every expedition run (sim/lib/model.mjs), so gating them by `prep` would make the engine and the bots disagree in runs without `prep`. Consequence: the v10 sim plan's hash-identity cell ("expedition runs without prep ... the package touches only prep runs") will show differences in expedition runs without `prep`. Rows runs are identical (checked above). A1-A3, B1 and B2 only matter where contracts exist, so only in `prep` runs.
2. **The hold is visible only on a known Dungeon.** The map shows every node's "dims in N", hidden nodes too (rules 1.9.5). A hold on a hidden node would show where the Dungeon is, which Region Charts, a Delve contract and Pathfinder are meant to sell. So `mapView` adds DUNGEON_DIM_HOLD only when the Dungeon is seen or its type is known, and the autoplay map policy reads the same values. A hidden Dungeon can therefore show as Dimmed up to 3 tolls before it is. That changes nothing the player can do: he can only enter a neighbour of his node, and neighbours are always seen. The engine's own Dimmed test always uses the true value.
3. **The `dimming` event is unchanged.** It still lists the nodes the front newly covers, the Dungeon included at the front's toll. No event marks the end of the hold, because the UI reads Dimmed nodes from `mapView`. If the UI wants an event, it is a few lines in nodes.js `dimmingAfterTime`.
4. **Depth in the held Dungeon** stays `front - hops` (rules 1.9.6 unchanged). The hold (3 tolls) is longer than a hop of the front (2.5 tolls), so a Dimmed encounter there is at least depth 1 (+2 levels) once the hold ends.
5. **`reward.xp`** includes Quick Study and an active Boon of Insight, before heat. The UI shows it next to the levels-worth.
6. **Arms.** v9 row 2 arm B (Thick Hide 0.13, Ferocity 0.15625) and C1 arm 1.5 are one value each in src/constants.js. These tests pin the main arm and must follow a switch: s13 (the change-doc table and the 6.3 Beastbond numbers read from rules.md), s06 (Thick Hide × 1.345), r06 (Ferocity × 1.54), s01d (`XP_WEIGHT_MULT` 1.4 in the M2b v10 test). The UI talent texts (mock-data.js) must change too; ui-regress L checks them.

## 4. For the Simulation & Balance Engineer (sim/ not edited)
- **qa/sim failure:** fog.test.mjs "leak test with the start camp and contracts" fails only on its count check `speedrunner: 9 decisions checked` (each bot needs at least 10). No decision changed under a scramble. The speedrunner hunter of seed 1004 now makes 6 start-camp decisions instead of 7: with the Delve at 2 points, the four Delves and the Second Clapper leave nothing for Field Draughts. The run then dies where it died before, on zone 1 node 23 at level 2, after 3 map decisions. I checked this with a scratch run on 40c1ea5, b17e86b and this tree. Fix in the test: another seed, a lower count, or more runs for the speedrunner.
- v10 says the bots' contract value must follow A1. sim/lib/model.mjs values contract XP from `reward.xpFrac` and `reward.cl`. If it applies diffMod to that, it should stop. `reward.xp` is the exact amount if a bot wants it.
- The hold reaches the bots through `mapView` (`dimAt`, `dimsIn`, `dimmed`), with the visibility rule of 3.2.

## 5. Not done, not touched
- Not done: v9 row 5 and v10 C3 (balance.md targets), the v10 bot rows C2, D1, D2 and the EST_COMPLETE prior (expedition.md 10.2 and 13 keep the old bot values for the Sim Engineer and the designer to fold), appendix P.
- Not touched: sim/, qa/sim/, game.html, balance.md, the change docs, src/ui/mock-engine.js (mock mode keeps its own numbers). `STATE_VERSION` stays 3: no state field changed.

## 6. Commits (all on main)
| Commit | What |
|---|---|
| b17e86b | v9 rows 1-4: constants, UI talent texts, rules.md, engine-api.md, tests |
| d0aa76a | v10 A1-A3, B1-B4, C1: engine, constants, UI reward line, rules.md, expedition.md, engine-api.md, ARCHITECTURE, tests |
| (this note) | Hand-off |
