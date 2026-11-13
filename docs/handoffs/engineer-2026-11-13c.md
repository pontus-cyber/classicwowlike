# Coach lines yield after showing (D141), 2026-11-13 (Core Gameplay Engineer)

Task: the open item of ui-2026-11-13b 4.1 and D140 ("the 2-step rule for coach lines stays until the engine closes G12 once
shown"). G12 (the Dimming) stayed the top `tutorialView.line` for the whole of zone 1, so G13 never became `line`.
Status: **draft** (spec m3-onboarding.md is draft). D141 is not yet in docs/DECISIONS.md (outside my files): for the Lead.

## 1. What changed
| Part | Change | Where |
|---|---|---|
| Rule | After every action of a guided run while the guide runs (one step), the top line (open beat with a line, not resting, by ONB_BEAT_PRIORITY) counts one step shown. A top line already shown ONB_LINE_STEPS steps, unlearned, rests when another open beat has a line; the next one is `line`. With no other open beat line it stays (G1 at the camp, G12 alone on the map). A resting beat stays open and can still be learned or closed (G12 still closes at the guide's end as before) | src/engine/tutorial.js `yieldLines`, called from `tutorialAfter` |
| Return | A resting line comes back (count from 0) when its line changes (`setLine`; covers G3, G7, G8, G9 at their next fight, G12.caught, G13.onRoad) or its trigger fires again: G12 when the front comes within ONB_DIM_NEAR_HOPS of the player after a step on which it was not (beat field `near`). The return of the same line sends `beat` what `line` with that line, so the UI's "Got it" set clears as it does today | tutorial.js `again`, G12 block of `trackBeats` |
| View | `open` entries are `{ id, line, rest }`; `beat` / `line` skip resting beats | tutorialView |
| Constant | `ONB_LINE_STEPS = 2` | src/constants.js Part 5 |
| Docs | m3-onboarding.md 2.5 new line "(D141)" and 12 row ONB_LINE_STEPS; engine-api.md event `beat` (`line` also for a return), 14.3 view, 14.4 the yield rule; ARCHITECTURE row of tutorial.js | docs/ |

Seed 8736 (autoplay, every class): G12 opens on the map and is the line on most map steps from then on (fight beats outrank it while open); at the PASS_THROUGH
onto Road 23 G13 opens, G12 rests in the same step and `line` is `G13.onRoad`; TAKE_ROAD then learns G13 and G12.
Side effect of the general rule: in the first fight G3 ("Press 1") yields to G10 (the site line) after 2 steps, and G6 / G8
yield to G12 after 2 steps. That matches what the UI's own rule already did.

## 2. Tests
| Suite | Result |
|---|---|
| qa/engine (new: s18 "coach lines yield" x2: G13 becomes the line on seed 8736 after G12 has shown 2+ steps, G12 open with `rest: true`, no G12 event; G12 returns with a `beat` `line` event when the front comes near again; G1 alone stays the line after 3 camp steps. s13: m3-onboarding.md 12 table equals the constants, 20 values, ONB_LINE_STEPS 2) | **477/477** |
| qa/rules | **58/58** |
| qa/docs | **6/6** |
The golden check (runs without the option unchanged) passes; the change only runs in a guided run.

## 3. For the UI and the Lead
1. The UI's own 2-step rule (src/ui/onboarding.js `YIELD_STEPS` and the auto-advance block in `advance`) can now be
   removed: show `tutorialView.line`. Until then both rules agree on the seed 8736 run (both 2 steps), so nothing breaks.
   The UI's `beatNow` reads `open` and should skip entries with `rest: true` (or read `line`).
2. Add D141 to docs/DECISIONS.md (coach lines yield after ONB_LINE_STEPS steps; engine side of D140's follow-up).
3. game.html not rebuilt (not in my files).
