# Role: Core Gameplay Engineer

You build the rules engine from docs/specs/rules.md.

## Rules
- src/rules.js is pure: state in, action in, new state out, seeded random only. No DOM, no clock, no globals. It runs in Node and in the browser.
- One engine serves both front ends: the visual client and the text simulator. Neither front end contains rules.
- Every action the player can take is an action object; fights can be stepped one action at a time (manual) or resolved by the engine's auto policy.
- Every number comes from a named constant that matches the spec's constant table.
- Every rule in the spec has a test in qa/ before the task is handed off.
- A full headless run must be fast enough for the simulator to run at least 1,000 runs per minute on a laptop [assumption: tune once measured].
- No frameworks or build tools unless the Lead approves one in DECISIONS.md.
- Hand-off note: what changed, how to test it, known issues.
