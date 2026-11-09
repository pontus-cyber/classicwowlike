# QA test plan, M1 (first playable)

Done-when line (docs/MILESTONES.md): the owner can play one class from level 1 to the boss in the visual build and in the text simulator, every rule in rules.md has a test, and a full run completes headless with no console errors; HUD layout, scrolling world and fight flow are in place.

| # | Check | How | Expected |
|---|---|---|---|
| P1 | Engine unit tests | `node --test qa/engine/` | 154 pass, 0 fail |
| P2 | Rule coverage: every section of rules.md maps to a test | qa/rules/COVERAGE.md; gaps filled in qa/rules/*.test.mjs; `node --test qa/rules/` | every section listed with its tests; new tests pass (known bugs run as `todo`) |
| P3 | Build is the source | `node tools/build.mjs --out /tmp/qa-game.html`; diff against the committed game.html | only the build stamp differs |
| P4 | Full run per class in the visual build, real controls only | `node qa/browser/full-run.mjs` (Playwright): clicks and keys on cards, buttons, map nodes, action bar, bags, spellbook, talents; manual combat in zone 1, Autoplay toggle after | each run reaches the run summary; one seed per class reaches the boss |
| P5 | No console errors, no page errors, no requests | same run, listeners on console, pageerror, request, requestfailed | 0 / 0 / 0 |
| P6 | The UI shows the engine's state | same run: a Node twin (src/rules.js, same seed and choices) is compared after every action; summary screen vs twin summary | 0 differences |
| P7 | Layout at 1366x768 and 1920x1080 | same run at both sizes: every clicked control and every visible panel inside the viewport, right panels clear of the minimap, once per screen kind; screenshots | 0 layout findings |
| P8 | Manual fight flow and autoplay | `node qa/browser/ui-checks.mjs`: keys 1-7 and A act; Autoplay (button and key Z) plays a fight on its own | each input advances the fight |
| P9 | Information the player needs | ui-checks: map tooltip shows how many enemies; combat log names items | count and names shown |
| P10 | Text simulator: level 1 to the boss | review of sim/ on main (task 1.2, Simulation & Balance Engineer) | a run to the boss in the terminal |
| P11 | Playtest | qa/browser/playtest.mjs (same player as P4, engine API, 40 seeds per class) plus the browser runs and screenshots | notes on pacing, empty decisions, spikes, confusing UI; compare with BRIEF.md and balance.md |

Out of M1 scope: balance targets (M2), the Echoes spending screen (M3), phone layout and sound (brief).
