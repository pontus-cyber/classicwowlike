# M2b v11 and the meta catalogue of expedition.md 8.2 in the engine, 2026-11-11 (Core Gameplay Engineer)

Task: docs/specs/changes-m2b-v11.md engine rows 1-4 and row 8 (D91-D94, D98), and expedition.md 8.2 (Pathfinder for Scout's
Eye in expedition runs, Swift Boots as a Bell charge, the catalogue entries Cartographer, Old Hand and Quartermaster). Not
in it: the target rows 5-7 (D95-D97, folded when the Lead accepts them), `ASK_LOCALS` (section 5). Status: draft, as the
change doc.

## 1. What changed
| Row | Change | Where |
|---|---|---|
| v11 1 (D91) | New EXPED_DROP_MULT 1.6: in an expedition run a normal or dungeon-trash kill's item and junk chance × 1.6 (× GRIND_DROP_MULT as well on a Grind node or a Camp wave), capped at 1. Same draws, so `loot` moves only where a draw now succeeds | src/constants.js; src/engine/expedition.js `killDropMult`; damage.js (kill rewards) |
| v11 2 (D92) | New EXPED_DUNGEON_BOSS_DROPS 3: a dungeon clear in an expedition run rolls 3 times on "Dungeon boss" (Relics' unique draw per roll); rows keep DUNGEON_BOSS_DROPS 2 | constants.js; expedition.js `bossDropRolls`; damage.js |
| v11 3 (D93) | CONTRACT.delve.price 2 -> 1 | constants.js |
| v11 4 (D94) | TIME_DIM_FIGHT 1 -> 2. Rule unchanged: the encounter's own tolls start no other encounter; the front check after it uses the new zone time | constants.js |
| v11 8 (D98, gated) | **Kept at 12** (the spec gates 15 on the sim's cell 9 / 11). New BEASTCALL_HORN_CD 12 (SPELL.beastcall_horn.cd reads it) and BEASTCALL_HORN_CD_GATED 15. The sim arms it at run time with `C.SPELL.beastcall_horn.cd = C.BEASTCALL_HORN_CD_GATED` in every process (the engine reads the field at each cast; tested), or in a scratch copy by changing one line | constants.js |
| 8.2 catalogue | `C.META` gets `cartographer` (100), `old_hand` (150), `quartermaster` (2 ranks, 120 / 200), each with `mapMode: 'expedition'`; costs are the new META_COST_* constants of expedition.md 13. Catalogue total 6 560 -> 7 130. `scout` carries `expedition: { name: 'Pathfinder', typeRadius: PATHFINDER_RADIUS }`, `swift_boots` `expedition: { bell: 1 }`. `C.META_EXPEDITION` stays (the sim uses it): the three entries, the same objects | constants.js |
| 8.2 effects | In an expedition run **with the start camp** (`prep: true`): Scout's Eye gives Pathfinder (vision `typeRadius` 2), Swift Boots +1 Bell charge (max 2, so the Second Clapper is then refused), Cartographer / Old Hand own Region Charts / Tracker's Notes, Quartermaster +2 points per rank (these three were already read from `profile.unlocks`). Without the start camp nothing changes. Rows runs keep Scout's Eye and Swift Boots as rules 11.2; the new entries add no `state.meta` flag, so a rows run's state is unchanged | src/engine/nodes.js `startExpedition`; contracts.js (`metaRank` reads META) |
| UI | Hall of Echoes: texts for the three entries with an "Expedition" tag on the card and "expedition map only" in the tooltip; Scout's Eye and Swift Boots texts follow the map new runs start on (the setting "Expedition map with start camp"), the other map's effect as a tooltip line; the next-run lines read the dry START_RUN's new `exp` (Pathfinder radius, Bell charges, points, entries owned). Layout: the economy group moved under the stats (column 1 no longer fits at 1366x768 with the new cards) | src/ui/ui-text.js (`metaEffect(m, D, d, mode)`, `nextRunLines`), meta.js, engine-bridge.js, style.css |
| Docs | rules.md status line, 1.9, 1.9.5, 1.9.6, 1.9.7, 1.9.8, 2.4, 5.6, 8.4, 11.2, 13 "(M2b v11)"; expedition.md status line, 6.3, 8.2, 9.5, 13 "(M2b v11)"; engine-api.md status, `newRun` vision, meta functions, section 9 (M2b v11 paragraph), 10, 13.4; ARCHITECTURE rows (constants, contracts, damage, expedition, nodes, qa/engine, ui files, lookups); qa/rules/COVERAGE 1.9.6, 5.6, 8.4, 11 | docs/, qa/rules/COVERAGE.md |

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **394/394** (new file s01e-v11-meta, 11 tests: the kill rule replayed on the dev loot stream for normal and trash kills on both maps (40 seeds each), a Grind node's first kill on `loot(z, id)` with both multipliers, boss rolls 2 / 3, the Delve at 1 on the board, the Dimmed encounter's 2 tolls, Beastcall's cooldown and its run-time arming, the catalogue entries, the effects with and without the start camp, rows runs step for step unchanged by the new entries). Changed: s01d (Delve price 1, Reserve 8, the new 13 names), s11 (total 7 130), s13 (v11 change-doc table; row 8 checked against its Old value) |
| qa/rules | **56/56** |
| qa/docs | **3/3** |
| qa/sim | **99/99** on the engine commit (sim/ not edited) |
| Rows golden | 60 rows autoplay runs (P0 and PALL, 3 classes × seeds 1-10): final state hash, per-step events and minutes identical to 15e0c75 (src extracted to a scratch folder) |
| Build | `node tools/build.mjs --out /tmp/eng-h/game.html`: 58 modules, 1 678 KB |
| ui-regress A, M, F at 1366x768 | **59/59**, no console errors (F added: it covers the Hall of Echoes). Screenshot checked: every card fits |

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/ && node --test qa/sim/
node --test qa/engine/s01e-v11-meta.test.mjs
node tools/build.mjs --out /tmp/eng-h/game.html
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/eng-h/game.html --sizes 1366x768 --parts A,M,F
```

## 3. Engine readings (Lead or designer to confirm; each is one place to change)
1. **Camp waves count as kills for row 1.** The row says "every ... normal or dungeon-trash kill" of an expedition run and "as XP does"; the XP weight includes the Camp (rules 1.9.8). So Camp waves get × 1.6 on top of GRIND_DROP_MULT. To exclude them: `killDropMult` in expedition.js (or skip it when `s.zone.camp`).
2. **The 8.2 effects need the start camp**, as Cartographer and Old Hand already did: an expedition run without `prep` plays as before (Scout's Eye does nothing there, Swift Boots no charge). At the flip (`prep` default true) this is every expedition run. One condition in nodes.js `startExpedition`.
3. **Kinds of the new entries:** Cartographer and Old Hand `map` (information, 8.2), Quartermaster `start kit` (its points buy the start camp's kit). Only labels; the designer may change them.
4. **Swift Boots fills the Bell** (1 + 1 = BELL_MAX_CHARGES 2), so a profile with it cannot buy the Second Clapper (`prepView` says why).
5. **Row 8 stays 12** until the gate passes; then set BEASTCALL_HORN_CD to 15 (the s13 and s01e tests follow the Old/New columns and must be switched with it).

## 4. For the Simulation & Balance Engineer (sim/ not edited)
- **PALL now holds the expedition entries.** `buildProfile('all')` takes every `C.META` entry, so PALL gets Quartermaster 2, Cartographer, Old Hand; with `prep` it also gets Pathfinder (from Scout's Eye) and Swift Boots' Bell charge. The PALL stand-in (`--exp-meta ...`, `--vision pathfinder`) is no longer needed; with it nothing doubles (the options are the same flags). New in PALL expedition runs: the second Bell charge, and no Second Clapper purchase. Rows PALL runs are unchanged in play; their `profileHash` changes (the profile has more ids).
- `standardOrder` (balance.md 1.4) does not have the new entries yet; expedition.md 8.2 asks for cartographer after scout, old_hand after cache, quartermaster ranks after keen 1. `nextPurchase` falls back to cheapest-first for entries not in the order, so campaigns buy them already. B31 needs the re-measure (catalogue 7 130).
- `C.META_EXPEDITION` keeps working for `withExpMeta`.
- Row 8 arm: `C.SPELL.beastcall_horn.cd = C.BEASTCALL_HORN_CD_GATED` in the main process and in each worker.
- The bots' Dimmed-encounter price follows `C.TIME_DIM_FIGHT`; the loot gain of rows 1-2 is not in `sim/lib/model.mjs`'s node value unless it reads `C.EXPED_DROP_MULT` / `C.EXPED_DUNGEON_BOSS_DROPS` (exported now).

## 5. Not done
- `ASK_LOCALS` (expedition.md 5.2, 5.3; TIME_ASK_LOCALS): a new hub action, the zone's regions for this zone, the hub button and its tests. Not started: it did not fit this slice.
- Target rows 5-7 (D95-D97), balance.md, the B4 decision (DUNGEON_DIM_HOLD stays), appendix P.
- Not touched: sim/, qa/sim/, game.html, src/ui/mock-engine.js (mock mode keeps its own catalogue). `STATE_VERSION` stays 3.

## 6. Commits (all on main)
| Commit | What |
|---|---|
| 616f8a7 | Engine: v11 rows 1-4, row 8 constant, 8.2 catalogue and effects; rules.md, expedition.md, engine-api.md, ARCHITECTURE, COVERAGE; tests s01e and updates |
| bed45c1 | UI: Hall of Echoes texts, tag and next-run lines for the 8.2 entries; ARCHITECTURE ui rows |
| (this note) | Hand-off |
