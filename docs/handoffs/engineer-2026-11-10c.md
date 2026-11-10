# Hand-off: Core Gameplay Engineer, 2026-11-10c (M2 v5 engine changes)

## Summary
- Both engine rows of docs/specs/changes-m2-v5.md are on main: row 2 (D44, Beastbond +25 %, number) and row 3
  (D45, Starforged Arms removed, mechanic). Row 1 (default-tree rule, D43) is the Sim Engineer's (sim/).
- Tests: `qa/engine/` 186/186, `qa/rules/` 56/56, `qa/docs/` 3/3, `qa/sim/` 43/44. The one sim failure is
  params.test.mjs "every balance.md section 6 constant is in BAL with the same value, and nothing else" on
  `TREE_SWITCH_Z`, the new BAL constant of row 1 (Sim Engineer). Build: `node tools/build.mjs --out /tmp/eng-game.html`
  succeeds (46 modules, 984 KB).

## Commits (all on main)
| Commit | What | Files |
|---|---|---|
| 3788068 | D44: Ferocity 0.125, Pack Leader 0.0625, Savage Mastery 0.125; Beastbond constants test; QA ratios | src/constants.js, qa/engine/s13-constants.test.mjs, qa/rules/r06-talents.test.mjs |
| 0f10368 | D45: Starforged Arms removed; a stored id is ignored as D42; no class weapon at the Camp | src/constants.js, src/engine/nodes.js, src/engine/map.js, src/engine/meta.js (comment), qa/engine/s11-s12-meta-content.test.mjs, docs/specs/engine-api.md |
| (this note) | "Engine: M2 v5 implemented" | docs/handoffs/engineer-2026-11-10c.md |

## Changes and tests (one commit and at least one test each)
| # | Behaviour | Code | Test |
|---|---|---|---|
| D44 (row 2) | `TALENT.h_a2.petDmgPct` 0.10 -> 0.125, `h_a6.pct` 0.05 -> 0.0625, `h_a7.pct` 0.10 -> 0.125 (Savage Order CD -1 per rank unchanged). Spec already in rules.md 6.3 (662dbe8) | constants.js | s13 "6.3 Beastbond": all 11 per-rank numbers of the nine Beastbond rows, parsed from the rules.md Effect cells, equal constants.js. qa/rules r06 (same fight and draws with and without the talent): Ferocity 3 1.375 (measured 1.389), Pack Leader 2 1.125 (1.133), Savage Mastery 2 1.25 (1.250), tolerance 0.02. The old constants measure 1.306 / 1.089 / 1.202 and fail |
| D45 (row 3) | `META.starforged` deleted (catalogue 6 560 Echoes). `metaFromProfile` loses the `starforged` flag. The Camp vendor's Starforged branch goes; `vendorStock(s, rng, cl)` drops its `camp` parameter, which only that branch used (both callers updated). The branch made no draws, so no stream changes. The class weapons stay in content; `makeUnique` keeps its weapon branch. A stored `starforged` id: no effect, no refund, not in `metaOffers`, `buyMeta` throws "unknown meta unlock starforged", the id stays in `profile.unlocks` and in the END_RUN profile | constants.js, nodes.js, map.js | s11: catalogue total 6 560 and costs list without it. Meta power budget (now "M2 v4, M2 v5"): the item entries are exactly alchemist, cache, relics, and each class's full-catalogue Camp vendor sells VENDOR_GEAR_STOCK generated items and no unique. New removal test: not offered, cannot be bought (also with Relics and a boss kill), no refund, id kept; per class the run modifiers and the Camp stock equal those of the profile without the id; a whole hunter autoplay run (seed 1, which opens the Camp vendor) is identical event for event, and the final state differs only in the stored profile and the summary's `profileHash`. These tests and s13 "11.2 meta catalogue" fail with the source change reverted (checked) |

Replay check (one-off script, not in the repo): full autoplay runs at 3788068 and with the D45 change, for P0, P10
and PALL without Starforged × 3 classes × 12 seeds × fixture and real content: 216 runs, 57 of which reach the Camp.
The Camp vendor stock, every event, the step count and the outcome are identical. The final state differs only in
`state.meta`, which no longer has `starforged: false`. PALL plus a stored `starforged` id now plays exactly like PALL
(72 runs: events, final state without `profileHash`, Camp stock); before the change its Camp stock held the weapon in
72 of 72.

Test fix on the way: the s11 "11.4" Prospector assertion ran in a promise the test did not return (qa/rules/COVERAGE.md,
"Test notes"). The test is now async and awaits it. The Starforged part of that test moved into the removal test.

## API (docs/specs/engine-api.md)
- Status line and section 9: Starforged Arms removed (D45), catalogue 6 560. A stored id is handled as Wayfinder
  (D42); `state.meta` has no `starforged` flag; the Camp vendor follows the same rule as every vendor.
- No change to functions, actions or events. No `STATE_VERSION` bump: a saved state loses only a dead flag, as with
  Wayfinder.
- docs/ARCHITECTURE.md unchanged: no file added, moved or deleted, and no main export changed.

## For the UI Engineer (src/ui/, not changed by me)
These are dead code now and cannot crash: the Hall lists only `C.META` entries and `metaOffers`, and the next-run lines
read `state.meta`, which never has `starforged`. Spec row 3 asks for their removal:
1. src/ui/ui-text.js:158, `metaEffect` case `'starforged'`.
2. src/ui/ui-text.js:210, `nextRunLines` line for `m.starforged`.
3. src/ui/meta.js:16, icon entry `starforged`.

Talent tooltips read the TALENT table, so D44 needs no UI change.

## For QA
- qa/browser/ui-regress.mjs:885 ``['starforged', `ilvl ${M.starforged.ilvl}`]`` now throws a TypeError
  (`M.starforged` is undefined). Drop the row (spec row 3). I did not run qa/browser; it is outside my paths.
- qa/rules/r06-talents.test.mjs: I changed three expected ratios and their labels (Ferocity, Pack Leader, Savage
  Mastery; M2 v5).
- qa/rules/COVERAGE.md "Test notes": the s11 "11.4" promise note can go.

## For the Content Designer
- src/content/SCHEMA.md:183 still says the class weapons are for "meta Starforged Arms". They stay in content for a
  later reward (rules 12.1 note). Validation still expects 3 weapons, and real content passes the strict validator.

## For the Simulation Engineer
- The engine side of rows 2 and 3 is in. PALL (`buildProfile('all')`, every `C.META` entry) no longer contains
  Starforged. In sim/ only the comment at sim/lib/profiles.mjs:28 names it (spec row 3).
- Smoke run at 0f10368: `node sim/run.mjs --bot planner --class all --runs 40 --seed-start 1000 --profile all --warmup 0
  --workers 2 --out /tmp/eng-sim` gave 120 runs and 0 errors. Win rates are not meaningful at warm-up 0.

## How to test
```
node --test qa/engine/     # 186 pass
node --test qa/rules/      # 56 pass
node --test qa/docs/       # 3 pass
node --test qa/sim/        # 43 of 44 until TREE_SWITCH_Z is in BAL (row 1)
node tools/build.mjs --out /tmp/eng-game.html
node qa/engine/bench.mjs 100
```
Throughput (`bench.mjs 60`, run back to back on the shared machine, bcbc4fa then 0f10368): pure `step` 4 456 / 4 569
runs/min on the fixture and 5 963 / 5 468 on src/content; `stepInPlace` 11 665 / 8 344 and 23 879 / 25 504. These are
the same within the machine's noise, and every figure is far above the 1 000 target (B37, role file).

## Known issues
- `profileHash` (run summary) still hashes every stored id (see the 11-10b note), so a profile with a stored
  `starforged` hashes differently from one without, although the runs are identical. Nothing reads the hash today.
- From 662dbe8 (spec) to 0f10368 (code), s13 "11.2 meta catalogue" failed on main because the spec table was ahead of
  the code.
- Decision record: the saved-profile handling of D45 is D42's; nothing new for DECISIONS.md.
