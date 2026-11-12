# UI architecture review, 2026-11-12 (draft)

Status: **draft**, not yet approved by the owner or the Lead. Reviewer: front-end architect (review only; no file in `src/` was changed).

Scope: `src/ui/` (23 JavaScript files and `style.css`, 14 353 lines), `tools/build.mjs`, `qa/browser/`. Question asked by the owner: is the structure agile enough to change while he playtests, with an art overhaul (docs/art/README.md, direction A) likely next?

All file:line references are to commit `fd32d7f`. Numbers are tagged: [measured] = counted or timed by a command during this review, [source] = read in the named file, [inference] = my conclusion from those.

## Summary

The layer has one good spine and four things that will slow change.

- **Keep:** one gate to the engine (`engine-bridge.js`), a pure rules engine, no import cycles in `src/ui/` [measured], art modules that import nothing but `util.js` [measured], engine-made views for new features (`R.heatView`, `R.prepView`, `R.windupView`), seeded test hooks (`window.__ui`), and a bridge that is fast (0.3 to 0.5 ms per view in Node [measured]).
- **Fix first, for the art overhaul:** colour, type and spacing live as about 2 000 literals in six places with no single source. A reskin today is a search through `style.css` and seven JavaScript files.
- **Fix next, for feature speed:** the bridge is one 1 284-line function; live tooltips take their text and numbers from the mock engine's data file; every widget keeps a hand-written list of the fields it depends on; the browser test is one 3 527-line script bound to 212 class and id names.

The plan in section 3 does this in 15 single-session steps, each behaviour-identical, the first five being what the art proof slice needs.

## 1. How the UI is built today

### 1.1 Data flow

```
 src/rules.js (R) + src/content (CONTENT)            pure, seeded, no DOM
        │  R.newRun / legalActions / step / *View / whyIllegal / autoAction
        ▼
 engine-bridge.js  ── engineBackend(seed, runOpts)   one closure, lines 314-1597
   │   state: st (engine state), local (intro seen, spoils, hold, heatUp), profile, history
   │   view()        engine state ──► plain "view" object (11 to 23 kB JSON)
   │   step(action)  UI action ──► engine action(s) ──► convEvents ──► UI events
   │   localStorage: tbwcr.profile.v1, tbwcr.history.v1
   │  (mockBackend: mock-engine.js behind ?mock=1, same interface)
   ▼
 Bridge.dispatch(action) ─► { ok, error, events, view }          engine-bridge.js:1611
   ▼
 App.act(action)  (app.js:152)   promise queue, one step at a time
   │  prev = bridge.view ─► dispatch ─► director.play(prev, next, events)
   ▼
 Director.play (director.js:106-440)
   │  shows makeInterim(prev, next): the next view with HP, statuses, tracks rolled back
   │  walks the events on a time budget from combat-feel.js (timeline, roundPace, BEAT)
   │  per event: scene effects (canvas) + hud.log + patches the interim view + ctx.setShown
   ▼
 App.render (app.js:334)   on requestAnimationFrame via queueRender
   ├─ syncScene(v) ─► scene.js (canvas: backdrop, actors, fx)  ◄─ art-world / art-actors
   ├─ hud.update(v)      hud.js ─► tracks.js, heat.js, prep.js            ◄─ art-icons (data URLs)
   ├─ screens.update(v)  screens.js ─► meta.js, prep.js, heat.js
   ├─ windows.update()   windows.js (only when nothing is playing)
   └─ devMenu.update(v)
 Frame loop (app.js:130-136): scene.frame(now) + hud.placeNameplates() every frame
 Input: app.bindInput / onKey ─► ctx.ui.* ─► App.act / combatAct (one queued action per round)
 Text: ui-text.js (words, sentences)   Style: style.css (one file)   Settings: settings.js (localStorage)
 Build: src/index.html + style.css + module graph ─► tools/build.mjs ─► game.html (1.85 MB, one file)
```

### 1.2 State

| State | Where | Notes |
|---|---|---|
| The run | `st` inside `engineBackend` (engine-bridge.js:330) | Only the bridge touches it. |
| Presentation state of the bridge | `local` (intro dialogs read, spoils window, held rest and chest results, `heatUp` marks) | Changes what the view shows without an engine step (engine-bridge.js:1296-1330). |
| The view on screen | `app.shown` (app.js:40) | The interim view while a step plays, else `bridge.view`. |
| UI state | `ctx.ui` (app.js:48-64): target, overlay, dragging, fleeArmed, precastArmed, preview | A plain mutable object shared by every view module. |
| Module-level state | `spy`, `leave` in screens.js:118-124; icon cache in art-icons.js:12; hints in tracks.js:611 | Outside `ctx`, so not visible to tests or resets. |
| Saved | profile, run history, settings, hints in localStorage | Four keys, three modules. |

### 1.3 Re-render model

Push the whole view, rebuild by key. `App.render` hands the full view to `hud`, `screens` and `windows` on every change. There is no diffing library. Each widget computes a string key from the fields it reads and rebuilds its DOM subtree with `clear()` and `h()` when the key changes:

- screens: `mount(key, build)` (screens.js:79-86) with `lootKey`, `svcKey`, `mapKey`, `hubContractKey` (screens.js:113-117).
- hud and tracks: `box.dataset.key === key` guards (tracks.js:233, 287, 348, 390, 555, 725; hud.js:399, 511, 749, 761).
- The prep screen is the exception: built once per run, then patched (screens.js:94).

### 1.4 Animation and timing

- `combat-feel.js` is pure: it turns a step's events into a timeline with a round budget.
- `Director.play` awaits `wait(ms, token)`; `SkipToken` ends a hit or the step. Speed and Instant come from `settings`.
- The canvas runs its own `requestAnimationFrame` loop; DOM nameplates follow canvas anchors every frame (hud.js:551-559).
- Banners, toasts, autoplay and the flee prompt use `setTimeout` in app.js (lines 67, 318, 428, 501).

### 1.5 Tests

| Check | What it is | Size |
|---|---|---|
| `qa/browser/ui-regress.mjs` | Playwright script, 20 part functions (A-P and more), 287 `check()` calls, two screen sizes | 3 527 lines |
| `qa/browser/full-run.mjs`, `ui-checks.mjs`, `pace.mjs`, `policy.mjs`, `playtest*.mjs` | Full runs, pace, playtest bots in the browser | 1 410 lines |
| `tools/ui-check.mjs` | Screenshots of the main screens | 244 lines |
| `qa/docs/code-map.test.mjs` | Every code file has a row in ARCHITECTURE.md | 1 test file |
| Node tests of UI modules | **None.** No file in `qa/` imports `src/ui/` outside the two browser scripts [measured]. | 0 |

## 2. Health findings, ranked by risk to change speed

### F1. No single source for colour, type or spacing (high; blocks the art overhaul)

- `style.css`: 980 hex literals (435 distinct), 534 `rgb()/rgba()` literals (384 distinct), against 12 colour variables in `:root` (style.css:2-15) [measured].
- JavaScript holds another 680 hex literals: art-world.js 175, art-actors.js 147, scene.js 97, director.js 72, screens.js 48, art-icons.js 40, hud.js 31, app.js 25, windows.js 22 [measured].
- The same family is defined several times with different values:
  - Heat colours four times: style.css:898-901, style.css:959-960, style.css:997, heat.js:37.
  - Rarity three times: `--r-uncommon: #4fe05a`, `--r-rare: #5aa0ff` (style.css:11); icons use `#5fd06a`, `#4f9cff` (art-icons.js:8-9); `conColor` repeats `#9d9d9d`, `#4fe05a` (hud.js:44-51).
  - Spell school colours: `SCHOOL_GLOW` (director.js:22) and the icon backgrounds `BG` (art-icons.js:4-10).
- Type and shape: 28 distinct font sizes, 28 distinct border radii, 20 distinct z-index values, 33 distinct durations, 300 box-shadows, 153 gradients in `style.css` [measured]. Canvas text names its fonts inline (scene.js:518, 618, 760).
- `style.css` is ordered by feature and then by date: later blocks override earlier ones ("UX readability pass (2026-11-11)" at line 1081, "M2b v13" at line 1414). To change a nameplate you must read three places (lines 378, 1147, 1414).

Effect [inference]: every art-direction rule in docs/art/README.md (R1 "the danger colour appears on nothing that is not a threat", R4 contrast on tokens) cannot be checked or applied until colours have names.

### F2. The bridge is one function and the highest-churn file (high)

- `engineBackend` is a single closure from line 314 to 1597 (1 284 lines) holding about 60 inner functions that share `st`, `local`, `data`, `profile`, `history`. Nothing in it can be imported or tested alone.
- 32 commits in four days, level with `style.css` (33), ahead of screens.js (26) and hud.js (24) [measured: git log]. With several agents on `main`, this is the file where they meet.
- The header comment (lines 1-83) is the only description of the view shape and is prose.
- 36 `try {` blocks and 16 feature guards such as `if (!R.windupView ...)` (lines 705, 713, 724, 792) protect against "an older engine". The UI and the engine ship in the same file, so that engine cannot exist; the guards hide real errors as `null` [inference].
- It reaches across layers: it imports a view module (`heat.js`, line 89) and builds player-facing sentences (lines 1055-1059, 1318).

### F3. The mock engine is a second, drifting rules implementation, and live text depends on it (high)

- `mock-engine.js` (1 565 lines) and `mock-data.js` (319 lines) re-implement the rules. 4 commits to the mock against 32 to the bridge [measured]. Hand-offs record the drift: "8 rows", "no zone danger", "no Second Breath", "Ricochet Bolt there still says 70 %" (docs/handoffs/ui-2026-11-09c.md:60, ui-2026-11-10.md:51).
- It has no dev tools, heat, expedition map, start camp, wind-ups or Deathblows, which is every feature built since 2026-11-10 (`Bridge` methods return null in mock mode, engine-bridge.js:1654-1672).
- It ships to the player: 126 kB of the 1.85 MB build (static import, engine-bridge.js:87) [measured].
- One check uses it: ui-regress part C, for the victory banner (ui-regress.mjs:621).
- **Hidden dependency:** `ui-text.js:4` imports `SPELLS`, `TALENTS`, `STATUS_INFO`, `CONSUMABLES`, `BOONS`, `CLASSES`, `PETS` from `mock-data.js`. `CONTENT.texts` has no `spells` or `talents` group [measured], so **every spell and talent description in the real game is the mock's text** (ui-text.js:150, 158, 210, 218, 222). Those texts carry 83 hand-typed percentages (for example "+45 % dodge for 3 rounds", mock-data.js:59, where the engine has `dodge: 0.45, rounds: 3`). A balance change in `constants.js` leaves the tooltip wrong and no test notices. A quick heuristic matched 77 of the 83 to an engine field today; the other 6 could not be matched automatically and are not confirmed wrong [measured].

### F4. Hand-written dependency lists decide what redraws (high for feature work)

- Every keyed widget lists its inputs by hand (section 1.3). A new field shown in a widget but not added to its key gives a stale screen that only appears in some sequences. Example of the size: the track key names 11 fields per entry (tracks.js:348, repeated at 390).
- `makeInterim` (director.js:52-83) lists by hand which fields roll back while a round plays (hp, statuses, track, role, offBalance, dot, resurrect...). A new combat field needs an edit here or it shows the future during the animation.
- Both lists are far from the code that reads the fields, and no test compares them.

### F5. Rules and engine internals inside the UI layer (medium)

The view modules are clean: the arithmetic I found in screens, tracks, windows, tooltip and meta is formatting [measured: grep of `Math.`]. The leaks are in the bridge and the text:

- A rule constant: `const need = 4 * (t.tier - 1)` (engine-bridge.js:831), the talent tier requirement.
- Counterfactual replays to recover a fact the engine does not report: `heatSteps` (engine-bridge.js:1246-1268) clones the state, sets `alt.node.heat = 'clear'`, steps again and compares rarities; `dryCost` (839), `dryBossAsc` (868) and `travelTime` (548) step a copy to read a price or a number.
- 76 reads of raw engine state (`s.fight`, `f.p.cds`, `s.node.rewards`...) [measured], for example cooldowns as `f.p.cds[id] - f.round` (engine-bridge.js:807). Any engine refactor of those fields breaks the UI silently.
- Rule numbers typed into text (F3).
- Thresholds in views: level-difference colours (hud.js:44-51). `POTION_HINT_HP` (hud.js:66) is a UI hint and fine.

### F6. Browser checks are bound to markup and to one file (medium)

- One script, 3 527 lines; 173 locators and 211 `querySelector` calls using 212 distinct class and id names, against 16 `data-` hooks [measured]. Renaming a class for the reskin breaks checks that test behaviour.
- 44 fixed `waitForTimeout` sleeps, 22 geometry checks, and colour literals asserted (ui-regress.mjs:166, 360, 3247).
- No visual baseline: nothing fails when a colour or a size changes by accident, which is exactly the risk of a token refactor.
- No Node tests for the parts that are pure and need no browser: `combat-feel.js`, `ui-text.js`, and the bridge itself. The bridge runs in Node with a 3-line `localStorage` stub; a seeded autoplay run of 91 steps took 3.1 ms per dispatch [measured]. A golden-file test of the view is cheap and missing.

### F7. Long lines, shared files, parallel agents (medium)

- Lines over 160 characters: engine-bridge.js 133, screens.js 137, art-icons.js 77, tracks.js 71, hud.js 68; the longest line is 487 characters; `style.css` has 37 lines over 300 [measured]. Two agents changing different things on one line conflict in git.
- docs/ARCHITECTURE.md rows are a change log: six rows exceed 1 500 characters, the longest 2 518, and the handbook requires an edit in the same commit [measured]. Every UI commit touches the same giant row.

### F8. Large closures (medium)

`createHud` 613 lines (hud.js:179-792), `Director.play` 334 (director.js:106-440), `buildExpMap` 207 (screens.js:416-623), `createWindows` 207 (windows.js:46-253), `createEngagePanel` 200 (tracks.js:613-813). `scene.js` mixes animation state with drawing (drawProp 601, drawFx 631-768, drawTelegraph 567), which is the code the art overhaul will rewrite.

### F9. Layering slips (low to medium)

No cycles, but arrows that point the wrong way: bridge → `heat.js` (engine-bridge.js:89); `ui-text.js` → `mock-data.js`; `screens.js` → `hud.js` (screens.js:18); `windows.js` → `screens.js`, `hud.js` and the bridge's `flags` (windows.js:8-13). `ctx` is passed everywhere and used as a service locator (`ctx.data` 87 uses, `ctx.act` 77, `ctx.ui` 67, `ctx.view` 66 in five files [measured]).

### F10. Build and size (low)

- 1.85 MB, unminified, comments included; fine from disk. UI JavaScript is 945 kB of source, the engine 542 kB, CSS 165 kB [measured].
- `tools/build.mjs` is a custom bundler that reads modules with regular expressions. It checks its own output (syntax, missing exports, no external URLs), so the risk is an unsupported syntax failing the build, not a wrong build.
- It inlines every local `<link rel="stylesheet">` and rejects `@import`, so CSS can be split into files through `src/index.html` without touching the builder [source: tools/build.mjs, build()].

### F11. Performance (low; no hot spot found)

- Bridge: `view()` 0.03 to 0.53 ms, dispatch 3.1 ms average and 18.5 ms worst over a seeded run, in Node [measured].
- Not measured in a browser: the per-frame nameplate placement (hud.js:551) and paint cost of 300 box-shadows under `will-change: transform` on `#hud` (style.css:21). Worth one profile during the art slice, not before.

## 3. Staged refactor plan

Ground rules for every step: one agent session; no behaviour change; `ui-regress` parts A-P, `ui-checks` and `full-run` pass before and after; the step's own proof (named below) is attached to the hand-off note; one step per commit series so it can be reverted alone. Steps touching `style.css`, `engine-bridge.js` or `hud.js` are scheduled by the Lead for a moment when no other agent holds those files.

### Stage A: what the art overhaul needs (steps 1-5)

| # | Step | Proof it changed nothing | Benefit |
|---|---|---|---|
| 1 | **Safety net.** Add `qa/browser/style-snapshot.mjs`: load about ten fixed states (`__ui.loadState` fixtures: class select, start camp, hub, map, fight with a Deathblow, loot, vendor, character and talent windows, summary), freeze animation, and write the computed colour, background, border, shadow, font and box of every element to JSON. Add `tools/css-audit.mjs`: counts of literals per file. No `src/` change. | New files only. | Every later CSS step can prove "identical" by an empty diff. The audit gives the art agent the real palette (which of the 435 colours are near-duplicates). |
| 2 | **Colour tokens and a theme layer.** New `src/ui/tokens.css`, linked before `style.css` in `src/index.html`: primitives (the existing 12 plus named ramps) and semantic tokens (`--surface-*`, `--ink-*`, `--edge-*`, `--danger`, `--heal`, `--heat-*`, `--rarity-*`, `--school-*`, `--con-*`), all under `:root, :root[data-theme="classic"]`. Replace literals in `style.css` only where the value is exactly equal to a token. | Style snapshot diff empty; `css-audit --expand` (tokens substituted back) equals the old file. | A second theme block (`[data-theme="a"]`) is now the art proof slice: no component CSS edited. Merging near-duplicate colours is then a visible art decision, taken in the slice, not hidden in a refactor. |
| 3 | **One palette for JavaScript and canvas.** New `src/ui/theme.js`: `token(name)` reads the CSS tokens once (cache cleared on theme change) and exports the shared families (heat, rarity, school, con, floating-text colours). Replace the duplicated definitions first: heat.js:37, hud.js:44-51, director.js:22, art-icons.js:4-10, then literals in director.js, app.js, screens.js, windows.js. | Same values by construction; style snapshot; `ui-check` screenshots compared by eye for the canvas. | Heat, rarity and school colours exist once. DOM and canvas cannot disagree. |
| 4 | **Type, spacing, shape, layer and time tokens.** `--fs-*` (28 sizes in use), `--radius-*`, `--sp-*`, `--z-*` (20 values become named layers), `--dur-*`; canvas fonts from `theme.js`. Exact-value replacement only. | Style snapshot diff empty. | "Body text one step up" (docs/art/README.md row 3) becomes a change to a few tokens. Named z-layers end the guessing when a new overlay is added. |
| 5 | **Art module boundary.** Rule: art modules export draw functions and palettes, take a `look` or `theme` object, and import only `util.js` and `theme.js` (true today for the three `art-*.js` files). Move the drawing code out of `scene.js` into `art-props.js` and `art-fx.js` (drawProp, drawFx, drawTelegraph, drawOffBalance, drawSleep); `scene.js` keeps layout and animation state. Add `tools/art-sheet.mjs`: a contact sheet of every actor, icon, prop and backdrop. | Functions moved, not edited; contact sheet before and after is pixel-equal (static frames, fixed seed). | The art agent works in `art-*.js` and `tokens.css` while feature agents work in hud, screens and the bridge: no shared files. The contact sheet is the review surface for the proof slice. |

### Stage B: structure for feature speed (steps 6-15)

| # | Step | Proof | Benefit |
|---|---|---|---|
| 6 | **Split `style.css` by component** into `src/ui/css/*.css` in today's order, linked in that order. Later (separately) fold the dated override blocks into their components. | Concatenation equals the old file byte for byte; for the fold, style snapshot. | The most-edited file stops being a merge point. |
| 7 | **Bridge golden test in Node.** `qa/ui/bridge-golden.test.mjs`: seeded autoplay runs for three classes and both map modes; store a hash of every view and event list. Also unit tests for `combat-feel.js`. | New tests only. | Makes steps 9-11 safe in seconds, without a browser. |
| 8 | **Cut the text loose from the mock.** Move the display tables from `mock-data.js` to `src/ui/text-data.js`; the mock imports them from there. Add `qa/ui/text-numbers.test.mjs`: every percentage and round count in a spell or talent text must equal a field of `C.SPELL` / `C.TALENT`. | Same strings (deep-equal test); bundle works. | The mock can be deleted without touching tooltips; a balance change that makes a tooltip wrong fails a test. |
| 9 | **Retire the mock engine** (decision for the Lead; my recommendation). Part C reaches a victory with the dev tools (`R.debug`: boss jump, god mode) on the real engine instead. Delete `mock-engine.js`, `mockBackend` and the `backend.x ? ... : null` branches. | Part C passes on the real engine; build 126 kB smaller. | 1 884 lines and a second rules implementation gone; every feature stops having a "what does the mock do" branch. |
| 10 | **Split the bridge.** Turn the closure state into one `env` object and move groups of functions out, one group per commit: `bridge/static-data.js` (lines 99-206), `bridge/storage.js` (253-280), `bridge/view-player.js`, `view-zone.js`, `view-fight.js`, `view-legal.js`, `bridge/events.js` (1069-1224), `bridge/actions.js` (1226-1443). Move the view-shape comment into `docs/specs/ui-view.md`. Remove the dead "older engine" guards. | Golden test hashes unchanged. | Two agents can change the fight view and the map view at once. Each part is importable in a Node test. |
| 11 | **Engine requests** (needs the Core Gameplay Engineer and a spec line each; UI side is then a deletion): the talent tier requirement in `talentInfo`; `heatUp` on the loot event instead of `heatSteps`; prices and travel cost in a view instead of dry steps; cooldowns left in a fight view. | Golden test: same view values from the new source. | The bridge stops knowing rules and state internals (F5). |
| 12 | **Keys that cannot go stale.** A helper `keyed(el, data, build)`: the builder receives only `data`, and the key is derived from that same object. Convert one widget per commit, starting with tracks.js:348/390. Same idea for `makeInterim`: fields declare themselves "live during a round" in one table next to the view builders. | ui-regress; golden test for `makeInterim`. | A new field cannot be drawn without being part of the key (F4). |
| 13 | **Break up the large closures.** `createHud` into frames, action bar, nameplates, minimap, tracker, log; `Director.play` into a table of handlers per event type; `buildExpMap` out of `screens.js`. One closure per session. | ui-regress parts for that area. | Smaller files, fewer conflicts, readable diffs. |
| 14 | **Loosen the browser checks.** Split `ui-regress.mjs` into one file per part plus `qa/browser/lib/` (open, idle, view helpers). Put selectors in one map (`sel.mjs`) and add `data-t` hooks where a check keys on a styling class. Replace fixed sleeps with `__ui.idle()`. Colour asserts compare against token values. | Same 287 checks pass. | The reskin can rename classes; a failing part can be run and fixed alone. |
| 15 | **Formatting.** Wrap `src/ui` at 160 columns, one file per commit, at a quiet moment. Shorten the ARCHITECTURE.md rows to purpose and exports (history is in git and DECISIONS.md). | Built bundle behaves the same (golden test and ui-regress); for the doc, `code-map.test.mjs`. | Fewer same-line conflicts between agents (F7). |

Order and parallelism [inference]: 1 → 2 → (3, 4, 5 in any order) covers the art slice in about five sessions. Steps 7 and 8 touch no file the art work touches and can run beside it. Steps 6, 10, 13 and 15 move large amounts of text, so each needs a short window with no other writer on that file.

What I would not do: introduce a framework or a virtual DOM, a CSS preprocessor, or a new bundler. The current model (plain view object, keyed rebuild, one file out) is adequate at this size, and the pain is in naming and file boundaries, not in the model.

## 4. Rules to add to docs/team/ui.md

Proposed text (draft). "Test" names where a rule can be enforced automatically; all of these are small Node scripts in the style of `qa/docs/code-map.test.mjs`.

| # | Rule | Enforced by |
|---|---|---|
| U1 | **Only the bridge imports the engine.** No file in `src/ui/` except `engine-bridge.js` (later `src/ui/bridge/`) imports `../rules.js`, `../engine/`, `../constants.js` or `../content/`. | `qa/docs/ui-rules.test.mjs`: scan import lines. |
| U2 | **No rule maths in the UI.** Every number on screen comes from an engine view or `data.rules`. The bridge does not step a copy of the state to find a number; if the engine does not report it, ask for a view field (engine-api.md) first. | Partly: the test bans `R.step(` outside `apply`, and digits multiplied with a view field in bridge files (allow-list for formatting helpers). Review for the rest. |
| U3 | **No rule numbers typed into text.** A sentence that names a number takes it from the engine entry. | `qa/ui/text-numbers.test.mjs` (step 8). |
| U4 | **Colours are tokens.** No hex or `rgb()` literal in `src/ui/css/` outside `tokens.css`, and none in `src/ui/*.js` outside `theme.js` and `art-*.js`. Until the backlog is cleared, the count per file may only go down. | `tools/css-audit.mjs --ratchet` with the counts stored in `qa/docs/css-budget.json`. |
| U5 | **Sizes, radii, z-index and durations are tokens** in CSS. New values are added to `tokens.css`, not inline. | Same audit, same ratchet. |
| U6 | **Art modules stay leaves.** `art-*.js` import only `util.js` and `theme.js`; they export draw functions and palettes; no DOM queries, no view object, no `ctx`. | `ui-rules.test.mjs`: import scan. |
| U7 | **View modules do not import each other sideways.** Shared pieces go to a shared module (`widgets.js`, `ui-text.js`, `theme.js`). The bridge imports no view module. | `ui-rules.test.mjs`: an allowed-imports table per file; fails on a new edge or a cycle. |
| U8 | **Size caps.** A JavaScript file in `src/ui/` stays under 700 lines and a function under 150; a CSS file under 400 lines; lines under 160 characters. Files over the cap today are listed with their current size and may only shrink. | `ui-rules.test.mjs` with a budget file. |
| U9 | **A widget's key is its data.** A keyed widget is built from the object its key is made from (`keyed()` helper); no hand-written field list. A field that must not change while a round plays is declared in the interim table. | Review; the helper makes the wrong way longer than the right way. |
| U10 | **Tests hold on to `data-t` hooks, not styling classes.** New checks use `data-t` or `data-*` state attributes; a class may be renamed without touching `qa/`. | `ui-rules.test.mjs`: new selectors in `qa/browser/` must come from `sel.mjs`. |
| U11 | **State lives in `ctx.ui` or the bridge.** No module-level mutable state in view modules except caches. | Review (a lint for top-level `let` and mutated top-level objects is possible, with an allow-list). |
| U12 | **One build, one engine.** No code path for an engine that lacks a function, and no `try/catch` around an engine view call without a logged error. | `ui-rules.test.mjs`: ban `!R.` and `R.x ?` guards; review for the catches. |
| U13 | **Dated layers are not a place.** A fix goes into the component's own CSS block and the function it changes; the date and reason go into the commit message and the hand-off note, not into a new "pass" section at the end of a file. | Review. |
| U14 | **ARCHITECTURE.md rows state purpose and exports** in at most 300 characters; history stays in git and DECISIONS.md. | `code-map.test.mjs`: row length. |

## 5. Limits of this review

- I read the code and ran counts and one Node timing run. I did not run `ui-regress` or profile in a browser; F11's browser items are open.
- The 6 unmatched percentages in F3 need a human or the step-8 test to confirm or clear.
- A UI engineer was changing `src/ui` during the review; line numbers are those of `fd32d7f`.
- Session estimates in section 3 are [inference] from file sizes, not measured.
