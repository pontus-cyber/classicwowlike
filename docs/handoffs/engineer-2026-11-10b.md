# Hand-off: Core Gameplay Engineer, 2026-11-10b (M2 v4 engine changes)

## Summary
- Every engine row of docs/specs/changes-m2-v4.md is on main: the number rows 1, 3, 4, 5, 6, 8, 9 and 11, the new
  constants META_TIME_BUDGET_H 5 and DUNGEON_DANGER_FRAC 0.5, mechanic X1 (dungeon zone danger at half), mechanic X2
  (Wayfinder removed, Swift Boots without a prerequisite) and the meta power budget test with the potion and time lines.
- New API from the UI requests: `bossPar(state)` and `zoneDanger(level, variant)` on src/rules.js (engine-api.md 1).
- Tests: `qa/engine/` 184/184, `qa/rules/` 56/56, `qa/sim/` 44/44 (the Sim Engineer's M2 v4 BAL and purchase order
  are already on main). Build: `node tools/build.mjs --out /tmp/eng-game.html` succeeds (982 KB).

## Commits (all on main)
| Commit | What |
|---|---|
| 2a853b4 | Numbers: GREATER_HEAL_PCT 0.375, Vigor/Edge 4 ranks (80/120/170/230), Keen 0.0075, Quick Study 0.0375, Prospector 0.06, BOSS_HP 13900, BOSS_ENRAGE_ROUND 57, DUNGEON_BOSS_DMG_MULT 1.5, META_TIME_BUDGET_H, DUNGEON_DANGER_FRAC |
| 2788d90 | Swift Boots: `req []` |
| dfd7388 | X2 Wayfinder removed; TRAVEL_ON always HOURS_TRAVEL; owned removed ids ignored (as D32) |
| 6e025e9 | Meta power budget test: potion and time lines |
| 35fdcd2 | X1 dungeon zone danger |
| ff3b54c | `bossPar`, `zoneDanger` on the API |
| (this note) | "Engine: M2 v4 implemented" |

## Mechanics (one commit and at least one test each)
| # | Behaviour | Code | Test |
|---|---|---|---|
| X1 | `zoneDanger(level, variant)`: `zd = 1 + ZONE_DANGER_STEP × max(0, M - 20) / 10`; `'trash'` and `'dboss'` take `1 + DUNGEON_DANGER_FRAC × (zd - 1)`; normal, elite and rare (Camp waves and summoned adds are normal) take zd. HP, armor and XP are unchanged, and no draws are added | combat.js `zoneDanger`, `makeEnemy` | s07: multiplier for 5 variants × 10 levels (level 60: dungeon 1.5, others 2.0); level-60 hits with forced draws, where trash and dboss deal 1.5 × the zone-danger-free formula and quest and elite deal 2.0 × (the QA request); a zone-6 dungeon node through CHOOSE_NODE and NEXT_FIGHT (trash 55, boss 57 at half); an add summoned in a dungeon fight at full danger. All three fail with the mechanic reverted (checked) |
| Swift Boots | No prerequisite | constants.js | s11: bought on a profile with nothing else |
| X2 | `META.wayfinder`, the run flag and the travel branch are gone. A saved profile that owns it: no effect, no refund, not listed by `metaOffers`, `buyMeta` throws "unknown meta unlock", and the id stays in `profile.unlocks` and in the END_RUN profile. This is documented like D32 (engine-api.md 9, nodes.js `metaFromProfile`) | constants.js, nodes.js, meta.js | s00: TRAVEL_ON costs HOURS_TRAVEL with Swift Boots, with a stored Wayfinder, and with the full catalogue in every zone including the Camp. s11: a profile with Wayfinder plays a run identical to one without (400 autoplay steps: same events, same state); every requirement id is a catalogue id or a known flag; catalogue total 7 010 |
| Budget | Full catalogue: HP +0.04, Power +0.04, crit +0.015, +1 talent point, no end-boss resurrect. Potion line: the Greater draught is the only potion the catalogue adds, and in a fight it heals GREATER_HEAL_PCT, at most +0.025 of max HP over the Healing Draught (each class). Time line: META_TIME_BUDGET_H = ASC_STEP_HOURS / 2, and every `hours` event of full-catalogue runs costs its rules-table hours. Time is saved only through the route (Quick Study, Swift Boots), which only the sim measures (B17). A stored Vigor or Edge 5 counts as 4 | s11 | s11 (two tests), s03 Quick Study XP reads the per-rank constant |

The constants test (`qa/engine/s13-constants.test.mjs`, unchanged) passes against the M2 v4 tables of rules.md.

## API (engine-api.md 1)
- `bossPar(state)`: BOSS_TIME_PAR, minus OATH_HASTE_HOURS under the Oath of Haste. After START_RUN it reads `state.oaths`; in CREATE it reads the Oaths chosen so far. Ascendancy and the Echoes speed bonus now use the same helper (`parHours` in meta.js).
- `zoneDanger(level, variant = 'normal')`: the multiplier makeEnemy applies. With the default variant it keeps the old call `zoneDanger(level)` (qa/browser/ui-regress.mjs imports it from combat.js and keeps working).

## For the UI Engineer (src/ui/, not changed by me)
1. Camp par: engine-bridge.js:547 `{ par: C.BOSS_TIME_PAR }` and the rules table `par` (hud.js tooltips) ignore the Oath of Haste. Use `R.bossPar(s)`.
2. Zone danger: screens.js `nodeDanger` and hud.js still compute the bonus with `dangerAt` (ui-text.js), which is now wrong for dungeon nodes (+100 % shown at level 60, the engine deals +50 %). Use `R.zoneDanger(level) - 1` for quest, grind and elite nodes, and `R.zoneDanger(n.level, 'trash') - 1` and `R.zoneDanger(n.bossLevel, 'dboss') - 1` for dungeon nodes. The minimap rule sentence should then say that dungeons get half the bonus.
3. Wayfinder: the UI commit 89c5a13 removed the texts. qa/browser/ui-regress.mjs:771 still has `F_OLD = { id: 'wayfinder', cost: 80 }` (QA/UI: that profile now gets no effect, as intended).

## For the Simulation Engineer
- Nothing open: purchase order and BAL are already updated (qa/sim 44/44). The time budget constant is also on `C.META_TIME_BUDGET_H` (rules.md 13).
- The risk tables must relearn dungeons (designer hand-off); the engine side of X1 and DUNGEON_BOSS_DMG_MULT 1.5 is in.

## How to test
```
node --test qa/engine/     # 184 pass
node --test qa/rules/      # 56 pass
node --test qa/sim/        # 44 pass
node tools/build.mjs --out /tmp/eng-game.html
node qa/engine/bench.mjs 100
```
Throughput (`bench.mjs 100`, shared machine): pure `step` 5 270 runs/min on the fixture and 6 745 on src/content; `stepInPlace` 13 092 and 29 317. These meet the targets (B37, role file 1 000).

## Known issues
- `profileHash` (run summary) still hashes every stored id, so a profile with a stored Wayfinder hashes differently from one without, although the runs are identical. Nothing reads the hash today.
- Not requested and not done: the UI's `reqMet` list in `metaOffers` and a `profile.log` (ui-2026-11-10b notes 1-2).
- Decision record: the saved-profile handling of a removed entry is in rules.md 11.2 ("as D32"). The Lead may add it to D34.
