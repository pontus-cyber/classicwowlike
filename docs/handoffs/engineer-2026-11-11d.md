# M2b v7 in the engine and the UI: time in tolls, 2026-11-11 (Core Gameplay Engineer, UI side included)

Task: docs/specs/changes-m2b-v7.md sections B, C, E (engine and UI rows), D68-D71. Spec tables are the source.

## 1. What changed
| Area | Change | Files |
|---|---|---|
| Constants (table B) | HOURS_* / *_H -> TIME_* with the same values (TIME_QUEST ... TIME_DIM_FIGHT, EXPED_TIME_*, BELL_CHANNEL_TIME, DIM_GRACE, ASC_STEP_TIME, OATH_HASTE_TIME, META_TIME_BUDGET, HEAT_DIM_WARM / HEAT_DIM_HOT); DIM_HOURS_PER_HOP 2.5 -> DIM_FRONT_HOPS 2 and DIM_FRONT_TIME 5; NODE_TYPE.<type>.time; OATH.haste.parTime | src/constants.js |
| The Star's line (A row 2, D70) | `lineAt = floor((par × min(z, 6) + 5) / 6)`: whole tolls, no 6-decimal rounding; heat = time - line is whole | src/engine/heat.js |
| The Dimming (A row 4, D70) | `frontAt(zt) = floor(DIM_FRONT_HOPS × (zt - DIM_GRACE) / DIM_FRONT_TIME)`; new `dimAtHops(h) = DIM_GRACE + ceil(h × DIM_FRONT_TIME / DIM_FRONT_HOPS)` in integers; `dimAt` and `frontNextIn` (= dimAt(front + 1) - zt, at least 1) through it; no `1e-9` | src/engine/expedition.js |
| API (table C) | `state.time`; event `time { add, total, why }`; `bossStart.time`; `heatView.time`; `heatPreview.time` / `timeAfter`; mapView `zt`, `moves[].time` / `passTime`, `dim { grace, frontHops, frontTime, front, nextIn, off }`; summary `time`, `heat.timeByState`, `expedition.zones[].time`; `debug.setTime`, `debug.build({ time })` (default the whole line of zone - 1); `setHeat` = line + x without rounding. Internal renames: parTime, zoneTime, nodeTime, addTime, heatTime | src/engine/{heat,expedition,nodes,autoplay,summary,meta,debug}.js, src/rules.js |
| Saves | STATE_VERSION 3. `deserialize` refuses every other version; a version 2 save gets: "state version 2, engine expects 3 (saved before M2b v7: it counts time in hours, the engine counts tolls); old saves cannot be loaded, start a new run". The UI stores only the profile (checked: engine-bridge.js), so no conversion | src/rules.js |
| UI | Reads the new fields; the 1:1 hours mapping is gone. Bridge view `time` (was `hours`), `data.rules.time`, `data.nodeTime`, `zone.travelTime`, `rules.heat.ascStepTime`, summary `time` / `heat.timeByState`; Dev menu op `time` (R.debug.setTime). heat.js: the line and the standing are the engine's whole numbers (no floor / ceil in the UI), `fmtH` -> `fmtTime`; `.hc-hours` -> `.hc-time`; screens.js `hourLabel` -> `tollLabel`; util.js `hoursText` (the removed day clock) deleted; mock engine `time` and `C.TIME` | src/ui/{engine-bridge,heat,screens,hud,app,dev-menu,mock-engine,ui-text,util}.js, src/ui/style.css |
| Tools and browser checks | Read the new fields; pace.mjs's stale button name "3 waves · 3 h" -> "3 waves · 3 tolls"; "hours" in check names and comments -> tolls; tools/ui-check.mjs passes `time` to the mock's DEBUG_JUMP | tools/ui-check.mjs, qa/browser/*.mjs |
| Docs | engine-api.md: status line, units, sections 1, 3 (actions), 4 (state), 5 (events), 10.1-10.4, 11.1-11.3, 12; ARCHITECTURE rows of rules.js, constants.js, debug.js, expedition.js, heat.js, meta.js, nodes.js (engine commit) and ui heat.js, dev-menu.js (UI commit); qa/rules/COVERAGE.md | docs/specs/engine-api.md, docs/ARCHITECTURE.md, qa/rules/COVERAGE.md |

Beyond table C, same reason (D69: no hidden hours): mapView `walkH` -> `walkTime`, `travelH` -> `travelTime`, `bell.channelH` -> `bell.channelTime`; summary and stats `hoursAtBoss` -> `timeAtBoss`; `debug.build({ hours })` throws instead of being ignored. Proposed to the designer to add to table C (draft).

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **354/354** (350 before, plus 4 new in s01c "M2b v7 (D70)") |
| s13-constants (rules 13 table) | pass (failed on main before this change: TIME_QUEST missing) |
| New: par 100 and 120, z 1-7 (the Camp), time 0-250 | the line equals ceil(old line) and is whole; runState and ascIfPar equal the old 6-decimal values: 0 mismatches in 3 514 points |
| New: zone time 0-60, hops 0-8 | front, dimAt, nextIn and the Dimming state equal the old 2.5-per-hop formulas; dimAt = 6, 9, 11, 14, 16, 19, 21, 24 for hops 0-7 |
| New: whole numbers | every time value of heatView, its previews, the expedition mapView and the summary is whole over 400 steps of two Oath-of-Haste runs (rows, expedition) |
| New: STATE_VERSION 3 | a version 2 save is refused with the message above; a version 3 save round-trips |
| Goldens (scratch, /tmp/v7/golden.mjs, not committed) | 48 autoplay runs (rows and expedition, three classes, seeds 1-4, with and without the Oath of Haste) and 28 dev sweeps (zones 1-7, time 0-200, both map modes, both pars: heatView, mapView, setHeat, the boss start): every event, heatView, heatPreview of every legal action, mapView, summary and final state equal the old engine's after renaming the keys and rounding the old line up. **76/76 identical** |
| qa/rules | **56/56** |
| qa/docs (code map) | **3/3** |
| ui-regress parts A, I, K at 1366x768 (build of the final sources) | **73/73** (BUG-QA-09 "no day clock", M2b-v7 "no Day N, N h, hours or decimals" on hub and map, 23 M2b-heat checks against R.heatView / R.heatPreview, 4 M2b-heat-exp, 18 DEV-K); no console errors |
| ui-checks at 1366x768 | **8/8** |
| qa/sim | 77/83 as expected: 2 failures already on main (sim parameter names against the renamed spec tables) and 4 from the engine rename. With list 3a applied on a scratch copy: 81/83 (main's baseline); with 3a and 3b: **83/83** |

Not run: full-run, playtest, pace (they read the renamed fields; pace's button name was updated), ui-regress parts B-H, J, L, 1920x1080.

## 3. What sim/ must rename (not edited here)
Line numbers on main after 9c96a0a.

**3a. Engine-facing (breaks on this engine):**
| File:line | Old | New |
|---|---|---|
| sim/lib/model.mjs:161 | `C.ASC_STEP_HOURS` | `C.ASC_STEP_TIME` |
| sim/lib/model.mjs:269, 289, 296, 297, 319, 335, 343, 359, 363, 369, 375 | `C.HOURS_QUEST`, `C.HOURS_GRIND_WAVE` (289, 296, 297), `C.HOURS_ELITE`, `C.HOURS_DUNGEON`, `C.HOURS_REST`, `C.HOURS_TREASURE`, `C.HOURS_SHRINE`, `C.HOURS_VENDOR`, `C.HOURS_TRAINER` | `C.TIME_*` |
| sim/lib/recorder.mjs:270 | `sum.hours`, `sum.hoursAtBoss` | `sum.time`, `sum.timeAtBoss` (the record's own keys `hours` / `hb` may stay) |
| sim/lib/textview.mjs:68, 171 | `s.hours` (state); bossStart `e.hours` and "h" | `s.time`; `e.time`, "tolls" |
| sim/play.mjs:100 | `s.hours} h` (summary) | `s.time} tolls` |
| sim/report.mjs:586 (and the labels at 591, the comment at params.mjs:6) | `C.META_TIME_BUDGET_H` | `C.META_TIME_BUDGET` |
| qa/sim/heat.test.mjs:89 | `y.hours += dh` (state) | `y.time += dh` |

**3b. Sim parameters, table B rows 29-33 (failing on main already):** `VAL_HOUR` -> `VAL_TIME` (params.mjs:33; model.mjs:289, 364, 384; speedrunner.mjs:17-18; planner.mjs:86; qa/sim/m2v3.test.mjs:42), `PLANNER_HOUR_MULT` -> `PLANNER_TIME_MULT` (params.mjs:35; greedy.mjs:5; planner.mjs:87, 94; speedrunner.mjs:47; model.mjs:64; report.mjs:757; heatreport.mjs:78, 96, 97; qa/sim/m2v3.test.mjs:35, 36, 45, 55; qa/sim/heat.test.mjs:42, 43), `HOURS_NORMAL` / `HOURS_SPEED` -> `TIME_NORMAL` / `TIME_SPEED` (params.mjs:74-75; report.mjs:415, 419), `STYLE_SPEED_HOUR_MULT` -> `STYLE_SPEED_TIME_MULT` (params.mjs:144; model.mjs:99; qa/sim/m2v3.test.mjs:36), `HEAT_SEEK_HOUR_MULT` / `HEAT_AVOID_HOUR_MULT` -> `HEAT_SEEK_TIME_MULT` / `HEAT_AVOID_TIME_MULT` (params.mjs:236-237; planner.mjs:90-91; qa/sim/heat.test.mjs:40-41), plus the names in comments on the lines listed. Internal value-object fields (`ev.hours`, `m.dh`, metrics `hoursBoss`, report texts "h") are the sim's own; renaming them is optional (D69 says no "h" in what the player sees).

## 4. Commits (all on main)
| Commit | What |
|---|---|
| 15d87cd | Engine: constants, API, integer line and front, STATE_VERSION 3; qa/engine, qa/rules; engine-api.md; engine ARCHITECTURE rows |
| 00dfaf3 | UI: the engine's tolls, no 1:1 mapping; tools/ui-check.mjs, qa/browser; UI ARCHITECTURE rows |
| (this note) | Engine: v7 tolls implemented; this hand-off |

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/
node tools/build.mjs --out /tmp/v7-game.html
export NODE_PATH=/opt/npm-tools/node_modules
node qa/browser/ui-regress.mjs --file /tmp/v7-game.html --sizes 1366x768 --parts A,I,K
node qa/browser/ui-checks.mjs --file /tmp/v7-game.html --size 1366x768
```

## 5. Known issues and open points
- rules.md, expedition.md and balance.md status lines still say M2b v7 is "not yet in the engine" (designer / Lead files).
- game.html in the repo root is not rebuilt (Lead).
- qa/sim fails until sim/ applies section 3 (3a for this engine, 3b for the spec tables).
- Engine logs saved by older builds that contain `{ type: 'DEV', fn: 'setHours' }` cannot replay (dev only).
