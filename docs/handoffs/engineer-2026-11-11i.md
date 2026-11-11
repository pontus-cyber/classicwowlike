# M2b v12 in the engine, 2026-11-11 (Core Gameplay Engineer)

Task: docs/specs/changes-m2b-v12.md engine rows 1-2 and the gated row 5 (D100, D101, D104), and row 3's B43 caught band
(D102, owner O9 default) in expedition.md. Not in it: row 4 (the simulator's speedrunner), sim/, game.html. Status: draft,
as the change doc.

## 1. What changed
| Row | Change | Where |
|---|---|---|
| 1 (D100) | CONTRACT.delve.price 1 -> **2**; EXPED_DROP_MULT 1.6 -> **1.9**; **DUNGEON_DIM_HOLD removed** (constant, `dimAt` term, `dimAtSeen` / `dimmedSeen`, tests, docs): every node, the Dungeon too, dims at `dimAtHops(hops)`, so the map's "dims in N", the Dimming clock, entry and the autoplay policy all read one value; Beastcall Horn stays 12 (BEASTCALL_HORN_CD kept), **BEASTCALL_HORN_CD_GATED removed** (the gated switch) | src/constants.js; src/engine/expedition.js; autoplay.js |
| 2 (D101) | New **TIME_DIM_ESCAPE 1**. A MOVE that walks (not an entry) to a node with more hops from the Shardfall sets `exp.outward`; the settle step of that action starts the Dimmed encounter at TIME_DIM_ESCAPE. Every other Dimmed encounter keeps TIME_DIM_FIGHT 2: after a node's content, a PASS_THROUGH, the Bell's channel, a hub service, a walk sideways or inward. Depth, level, pack, rewards unchanged. The flag is cleared by every settle step, so it is false between actions. Same tolls in `heatPreview` (`dimFight`) and in the autoplay escape route | constants.js; expedition.js `outwardStep`, `dimFightTime`; nodes.js `moveTo`, `settleExpedition`, `startDimEncounter(s, ev, id, escape)`, `startExpedition` (`outward: false`); heat.js `costOf`; autoplay.js `escapeRoute` |
| 3 (D102) | B43 caught band **8-25 %** in expedition.md 6.3, 11.1 and 13 (CAUGHT_ZONES 0.08-0.25); share and close-call bands unchanged | docs only |
| 5 (D104, gated) | **Default kept at 0.40** (the spec gates 0.30 on cell 3 against 3b). New RICOCHET_BOUNCE_FRAC 0.4 (SPELL.ricochet_bolt.bounceFrac reads it) and RICOCHET_BOUNCE_FRAC_GATED 0.3. The engine reads the field at each cast and in `spellInfo` (tested) | constants.js |
| Docs | rules.md status, 1.9.6, 1.9.8, 1.9.9, 1.9.10, 5 (spell table), 8.4, 13 "(M2b v12)"; expedition.md status, 6.2 (hold paragraph struck), 6.3 (Walking out bullet with the 6.3 fiction, B43 band), 9.5 kill-loot row, 11.1, 13; engine-api.md status, section 10, `exp.outward`, `mapView` dimAt, `dimming` event, `heatPreview` dimFight, 13 notes; ARCHITECTURE rows (constants, expedition, nodes, heat, autoplay, qa/engine); qa/rules/COVERAGE 1.9.6, 5.6, 8.4 | docs/, qa/rules/COVERAGE.md |

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **407/407**. New file s01f-v12 (6 tests): row 1 values and dimAt by hops; TIME_DIM_ESCAPE constants and helpers; outward walk 1 toll against a sideways or inward walk 2 tolls on 5 maps (depth, flag cleared, preview); PASS outward, an outward entry into a Quest that dims during its content, an outward walk then the Bell, a hub service: all 2 tolls; wandering god-mode runs (4 runs, a walk to a neighbour every other map action): every encounter's tolls against the rule, `exp.outward` false between actions, walk previews equal tolls spent; Ricochet's armed value at cast and in spellInfo. Changed: s01b (hold test replaced by "the Dungeon dims by its hops", the front test without the hold, the Dimmed-encounter test reads escape or fight), s01d (Delve price 2, Reserve 7), s01e (Delve price, Beastcall without the gated constant), s13 (v10 / v11 rows superseded by v12, new v12 table test: New column, DUNGEON_DIM_HOLD "removed", row 5 Old/New) |
| qa/rules | **56/56** |
| qa/docs | **3/3** |
| qa/sim | **102/103** (sim/ not edited). The failure: qa/sim/v11.test.mjs "row 8 arm: the Beastcall Horn cooldown is the gated value in an armed run" asserts `C.BEASTCALL_HORN_CD_GATED`, which v12 row 1 removes ("the gated switch removed"). sim/lib/runner.mjs already skips the arming without the constant and sim/run.mjs `--beastcall-gated` throws a clear error; the test needs deleting or guarding |
| Classic golden | 60 rows autoplay runs (P0 and PALL with every catalogue entry, 3 classes × seeds 1-10): every step's events and the final state identical to 1976b18 (src extracted to a scratch folder). PALL hunters hold Ricochet Bolt, so the default 0.40 is confirmed unchanged |
| Build / browser | Not run here (no game.html; the QA agent runs the browser checks). No src/ui file changed |

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/ && node --test qa/sim/
node --test qa/engine/s01f-v12.test.mjs
```

## 3. Engine readings (Lead or designer to confirm; each is one place to change)
1. **Only a walk escapes.** A MOVE that enters a node's content sets no flag, so the encounter after the content costs 2 tolls even when the step was outward (the row lists "after a node's content"). One line in nodes.js `moveTo`.
2. **"The flag clears at the next action"** is built as: set by the walk, cleared by the settle step that runs at the end of every expedition action. A walk always ends with nothing open (MOVE needs that), so its settle step runs in the same action; the two readings are the same. The flag is state (`exp.outward`), always false between actions.
3. **PASS_THROUGH outward costs 2** for its encounter, as the row lists ("a PASS"). A PASS can only meet the front on arrival (it is refused onto a Dimmed node), so this is rare.
4. **Autoplay escape route**: a step counts as a walk when its node is resolved, the hub or Dimmed when the step starts (the policy passes through every other node), so the route's tolls equal what the engine spends.
5. **Row 5 stays 0.40** until the gate passes; then set RICOCHET_BOUNCE_FRAC to 0.3, rules 5's "at 40 %" and rules 13 follow, and the tests that read the Old column switch with it (s05 ricochet test asserts 0.4; s13's v12 row-5 test). The tooltip reads `bounceFrac` (ui-text.js), so it follows.
6. expedition.md 9.5's prototype cost note still says "above B43 (8-18 %, 5-20 %)": a record of the 9.5 model, left as written.

## 4. For the Simulation & Balance Engineer (sim/ not edited)
- qa/sim v11 "row 8 arm" fails as above (BEASTCALL_HORN_CD_GATED removed).
- Row 5 arm: `C.SPELL.ricochet_bolt.bounceFrac = C.RICOCHET_BOUNCE_FRAC_GATED` in the main process and in every worker (as the v11 Beastcall arm). sim/lib/policy.mjs reads `sp.bounceFrac`, so its spell value follows.
- Row 2 for the bots: sim/lib/view.mjs `escapeV` and sim/bots/planner.mjs still price every Dimmed step at `C.TIME_DIM_FIGHT`; an outward walk now costs `C.TIME_DIM_ESCAPE` (the spec's sim row; `outwardStep` and `dimFightTime` are exported from src/engine/expedition.js). Until then the bots overprice walking out by 1 toll per step.
- The engine is the v12 configuration: Delve price 2, EXPED_DROP_MULT 1.9 and no hold need no scratch switches. sim/measure-v11.sh's patches of these lines no longer match (that script only).
- Expedition runs change by design (rows 1-2); rows runs are unchanged (section 2).

## 5. Not done
- `ASK_LOCALS` (expedition.md 5.2, 5.3), as before.
- Not touched: sim/, qa/sim/, game.html, src/ui/ (no UI text names the hold or the Dimmed encounter's toll count). `STATE_VERSION` stays 3 (a save without `exp.outward` reads it as false).

## 6. Commits (all on main)
| Commit | What |
|---|---|
| 2e74169 | Engine: v12 rows 1-2 and gated row 5; rules.md, expedition.md, engine-api.md, ARCHITECTURE; tests follow the v12 values; s13 v12 table |
| (this commit) | Engine: M2b v12 implemented: s01f tests, COVERAGE, ARCHITECTURE qa row, this hand-off |
