# D116 flip: the expedition map with the start camp is the default, 2026-11-12 (Core Gameplay Engineer)

Task: D116 (docs/DECISIONS.md), MILESTONES 2b.6 "switch default map": the default flip steps of
docs/handoffs/engineer-2026-11-11f.md section 3, the flip criteria of docs/specs/changes-m2b-v10.md (passed per D116, B12 a
known miss). UI changes were allowed for this task. Not touched: sim/ (changes listed in section 3), game.html, rules.md and
expedition.md beyond their status lines.

## 1. What changed
| Part | Change | Where |
|---|---|---|
| Engine | `newRun` defaults: `mapMode: 'expedition'`, and `prep` left out (null) is `true` on the expedition map and off on the rows map. `mapMode: 'rows'` keeps the classic map (an option for the simulator and the Dev menu); `prep: true` with `'rows'` still throws; `prep: false` plays the expedition without the start camp as before 2b.5 | src/rules.js `newRun` |
| Dev tools | `debug.build` follows `newRun`'s defaults (`mapMode` `'expedition'`, `prep` null): a build that names no map is an expedition run that set out from the start camp with nothing bought (every point Reserve) | src/engine/debug.js |
| Engine tests | Suites that test classic rules pass `mapMode: 'rows'` explicitly: `started()` in qa/engine/helpers.mjs, s14's `build`, and every direct `newRun` / `debug.build` of a classic test (api-events, health, s00, s01c, s01e/s01f helpers, s07b-e, s08, s11, s15, s16; qa/rules api-legal, r09). s01b and s01c `expRun` send SET_OUT after START_RUN (handoff 11-11f step 3); s01b 1.9.1 checks the new default; its Bell pacing test adds PACE_HUB_CONTRACT_S for a hub with an offer; s01c heat loops let autoplay play the start camp (heatView null in PREP), and its two expedition seeds were re-picked for long runs (fixture 6 -> 1, real 1 -> 4); s01d checks the defaults (`prep: false` now names the old expedition) | qa/engine, qa/rules |
| UI: new runs | The expedition with the start camp unless `?classic=1` or the Dev menu's "Classic map (old)" (rows); `?expedition=1` stays a test switch for the expedition without the camp (`?prep=1` keeps it). The bridge's `runMode` is always explicit (`{ mapMode: 'rows' }` or `{ mapMode: 'expedition', prep }`), as are `setRunMode` and the Dev ops `build` / `mapMode`; a Dev `build` that names no map gets the map new runs get | src/ui/engine-bridge.js `createBridge`, `setRunMode`, `dev`; src/ui/app.js |
| UI: setting | The preview setting `expeditionCamp` is gone (dropped from saved settings on load); new `classicMap` (off), shown only in the Dev menu (World: "Classic map (old) for new runs"); the settings window no longer has a map row. Toasts: "Classic map (old)" / "Expedition map with start camp" | src/ui/settings.js, windows.js, dev-menu.js, app.js |
| UI: Dev menu | Start at's map: "Expedition with start camp" (first, the default at class select), "Expedition without start camp" (now sends `prep: false`), "Classic map (old)"; World's mode buttons "Expedition" / "Classic (old)"; its note says what new runs get | src/ui/dev-menu.js |
| UI: class select | The map chip shows only when new runs are not the default: "Classic map (old)" or "Expedition map without start camp"; no "(preview)" | src/ui/screens.js |
| UI: Hall of Echoes | Expedition entries (Cartographer, Old Hand, Quartermaster) read as any entry: no "Expedition" tag, no "expedition map only", no "No effect on the classic map", plain "Owned"; all of these come back only while new runs are classic | src/ui/meta.js, ui-text.js `metaEffect` |
| Browser checks | ui-regress: `open()` adds `?classic=1` unless the query names a map (prep=1, expedition=1, classic=, mock=); classic twins pass `mapMode: 'rows'`; part I's expedition twin `prep: false`. full-run: `--map expedition` (default) plays the new default through the controls (contract and option cards, Set out, the hub's Take, map nodes, Pass in the moves list, Road and Bell with the leave warning); `--map classic` as before. policy.mjs: on the expedition the start camp, hub and map choices are autoplay's (`expAction`, autoplay's bars applied to a scratch copy only, so the player keeps the bars it can set). ui-checks, pace, playtest stay on the classic map (`classic=1` / `mapMode: 'rows'`) | qa/browser |
| Docs | engine-api.md status, `newRun` row, PREP row, 10, 10.1, 12 `build`, 13 intro (marked "(D116)"); expedition.md and rules.md status lines (rules.md 1.9's opening status sentence too): default since D116; ARCHITECTURE rows (rules.js, debug.js, app, bridge, dev menu, windows, meta, settings, qa/browser) | docs/ |

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **434/434** |
| qa/rules | **56/56** |
| qa/docs | **3/3** |
| qa/sim | **116/128** with sim/ unchanged (12 failures from the default change, section 3); **128/128** with the two-line `newRunFor` change of section 3 (run on a scratch copy, /tmp/flip-simfix; not committed). Before the change: 128/128 |
| ui-regress, 1366x768, all parts A-P | **261/261** on /tmp/flip-ui/game.html (built from this tree), no console errors |
| ui-regress, 1920x1080, parts A, M, N, P | **86/86** on the same build, no console errors |
| full-run, rogue, 1366x768, new default | **PASS**: start camp (Field Draughts, three contracts), hub contract taken from Reserve in zone 2, fog map moves; death at level 23 in zone 3; 198 decisions, 296 clicks; no divergence from the Node twin, no layout, console or page errors. Screens in /tmp/flip-ui/fr |

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/ && node --test qa/sim/
node tools/build.mjs --out /tmp/flip-ui/game.html
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/flip-ui/game.html --sizes 1366x768
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/full-run.mjs --file /tmp/flip-ui/game.html --sizes 1366x768 --classes rogue
```
By hand: a fresh page opens on class select; Enter the world goes to the start camp. Dev menu, World: "Classic map (old)
for new runs" switches class select to the classic map (chip "Classic map (old)"); off again, the camp returns.

## 3. Sim changes needed (sim/ not edited)
**Required** (all 12 qa/sim failures): sim/lib/engine.mjs `newRunFor` passes the map explicitly, so every cell plays as
before:
```js
  o.mapMode = mapMode || 'rows'; // D116: the engine's default is the expedition map; a sim cell names its map
  if (vision) o.vision = vision;
  if (dimming === false) o.dimming = false;
  if (o.mapMode === 'expedition') o.prep = !!prep; // D116: prep is the engine's default on the expedition map
```
(replacing `if (mapMode) o.mapMode = mapMode;` and `if (prep) o.prep = true;`; its doc comment "passed to the engine only
when set" changes accordingly, and the ARCHITECTURE row of sim/lib/engine.mjs can say so). Failing without it: bots
"fightClone copies everything a step can change"; combat2 "the masher replayed with the masher reproduces its fight"; fog
"expedition runs end without errors for every fog bot; rows runs are not marked as expedition" and "prep runs end without
errors for every bot and record the contracts; --prep-policy none keeps every point"; heat "the model's entry state and
projected Ascendancy equal the engine's" and "a node entered Hot pays × (1 + HEAT_GAIN.hot) XP ..."; m2v3 "planner and
tactician map choices use PLANNER_TIME_MULT", "where Greater Healing Draughts are sold ..." and "without Greater draughts in
stock ..."; play "scripted run ..."; tactician "exitLevelOf matches the engine"; v11 "rows 1-2: an expedition node values
kill loot ...". All come from runs created without a map (now the expedition with the start camp) or an expedition cell
without `prep` (now with it).

**For the Lead or the Sim Engineer to decide:** whether the sim's default cell becomes the game's default (`--map
expedition --prep`) for the next measures; with the change above every cell keeps its map until it names another.

## 4. Readings (one place to change each)
1. The engine keeps the classic map's id `'rows'` (`mapMode: 'rows'`, as in engine-api.md and the sim's `--map rows`); "classic" is only the UI's word and its URL flag `?classic=1`.
2. `debug.build` follows `newRun`'s defaults, so the Dev menu's Start at and test hooks that name no map get the default (the bridge fills in the map new runs get).
3. The World tab's "Expedition" button makes the next runs expedition runs with the start camp (it used to mean without); "Expedition without start camp" stays in Start at and `?expedition=1`.
4. The saved `expeditionCamp` setting is dropped, not carried over: an owner who had it on gets the default anyway, and one who had it off must not be moved to the classic map.
5. bench.mjs (B37 throughput) is unchanged and so measures the default run, now the expedition with the start camp.
6. playtest-db.mjs is unchanged: without flags it now opens the default run; `--exp` is the expedition without the camp.

## 5. Commits
| Commit | What |
|---|---|
| 2a8eb5c | Engine: `newRun` and `debug.build` defaults, tests, engine-api.md, expedition.md and rules.md status lines, ARCHITECTURE rows |
| (this commit, "UI: D116 flip ...") | UI (bridge, settings, Dev menu, class select, Hall of Echoes), browser checks (ui-regress, full-run, policy, ui-checks, pace, playtest), ARCHITECTURE rows, this hand-off |

Logs (not committed): /tmp/flip-eng5.log, /tmp/flip-sim1.log (sim/ unchanged), /tmp/flip-sim2.log (with the change),
/tmp/flip-ui/regress-1366.log, /tmp/flip-ui/regress-1920.log, /tmp/flip-ui/fr/full-run.log and its screens.
