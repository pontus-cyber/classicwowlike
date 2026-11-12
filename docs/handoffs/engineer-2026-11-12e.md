# D132 the camp board across the run, 2026-11-12 (Core Gameplay Engineer, UI text allowed for this task)

Task: D132 (report 2026-11-12d: PALL 48.2 % < 50 %, B46 5.1 % < 8 %, because the zone 4-6 contracts left the camp board).
The start camp keeps 3 offers (D128) but draws one from each band: zones 1-2, 3-4, 5-6. Engine, specs, tests. Not in it:
sim/ and qa/sim (not edited; section 4), game.html. Status: draft until the sim measures it and the owner plays it.

## 1. What changed
| Part | Change | Where |
|---|---|---|
| Constants | New `CONTRACT_BOARD_BANDS = [[1, 2], [3, 4], [5, 6]]` (one band per board slot); new switch `GATES.boardAcrossRun` **on** | src/constants.js |
| Engine: board | New `boardBand(i)`: with the switch on, slot i's band is `CONTRACT_BOARD_BANDS[i]`; off, zone i + 1 alone (the D128 board); a slot past those, 1..ZONE_COUNT. `drawBoard` takes each slot's zone first: one `nextInt` draw on `prep(k)` when the band holds more than one zone, none for a single zone, then the offer as before. The no-repeat replacement draws over the slot's band (each zone 1 / band size). With the switch off the stream and every board are exactly D128's (checked on 300 seeds) | src/engine/contracts.js |
| Views | No new fields: prepView's `z`, `zoneName`, `band` and `reward` follow the drawn zone | - |
| Specs | expedition.md 2.2 (the band rule, the switch, the no-repeat wording), 3.5, table 13 (`CONTRACT_BOARD_BANDS` row), marked "(D132)"; engine-api.md header line 2026-11-12e, 13.1 (D132 line, the draw order), 13.4 (autoplay's camp, see 6); ARCHITECTURE rows (constants, contracts.js `boardBand`) | docs/ |
| UI | No change. The card's zone tag, title and pay line fit at 1366x768 with the late zone names (Sunscoured Wastes, Mournwood, Cindercrown Peaks); the board's sub-line "One per zone" stays true (each card its own zone) | - |

## 2. Commit
- "Engine: D132 board across the run" (this note included).

## 3. Checks
| Check | Result |
|---|---|
| qa/engine | **457/457**. s01d: the board = the documented draw (zone from the band, then the offer); each slot in its band (4 seeds) and, over 300 seeds, every zone 1-6 comes up 110-190 times; the zone is the slot's first draw; switch off = zones 1, 2, 3 and the D128 plain board; the views follow the drawn zone; the no-repeat test runs with the switch on (bands) and off (D128), on 8-slot boards with rerolls and kept offers; the constants: bands, band count = CONTRACT_BOARD_SIZE, the bands cover 1..ZONE_COUNT in order, the spec row. s13: GATES keys incl. `boardAcrossRun` (on) |
| qa/rules | **58/58** (new r12-camp-board: 40 seeds, each card in its band and listed as TAKE_CONTRACT; a zone 5-6 contract taken at the camp is 'later' through the early zones, gets its sites in its own zone and expires when that zone is left; switch off: zones 1-3) |
| qa/docs | 6/6 |
| ui-regress 1366x768, parts M and A | **51/51** (M 26, A 25), no console errors. Expectations unchanged: part M reads the zones from R.prepView, so the new zones pass as they are (screenshot checked: three cards fit, pay lines uncut) |
| qa/sim | 142/143 (not edited): the one failure is section 4 item 1 |

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/
node tools/build.mjs --out /tmp/g.html
node qa/browser/ui-regress.mjs --file /tmp/g.html --sizes 1366x768 --parts M,A
```
Play: start a run; the camp's three cards show one early zone (1 or 2), one middle (3 or 4), one late (5 or 6).

## 4. What sim/ must change (not edited here)
1. `sim/lib/output.mjs GATE_TAG`: add a tag for `boardAcrossRun` (e.g. `ba`); qa/sim "the cell name marks every switch
   played at another value than its default" fails until then (the only qa/sim failure).
2. The sim's gate rule (`gatesFor`: named switches on, the rest off) turns `boardAcrossRun` **off** in every cell that
   names its gates: such a cell plays the D128 board unless it names `boardAcrossRun`. The old-board arm is a cell that
   names its gates without it; the new board is the default cell (no gates) or one naming it.
3. The bots read the board generically (`estComplete(risk, kind, tracker, z)`, `offerValue`), so no code change is needed;
   their zone 5-6 completion prior now carries a camp contract held through four zones.
4. Measure per D132: PALL win (>= 50 %), B46 contract XP share (>= 8 %), B39 completion and B40 plan value, paired with
   the D128 board (switch off). Fallback in D132: richer hub offers in zones 4-6.

## 5. Known issues
- None found. A late contract is held (one slot) from the camp to its zone; with 4 slots the hub contract of zones 2-6
  still has one slot free if all three camp offers are taken.

## 6. Open questions (defaults taken, Lead to confirm)
- Autoplay's camp (an engine default, not a bot) takes the board's contract for zones 1-AUTO_PREP_ZONES (3): on the new
  board that is the zone 1-2 offer and the middle offer only when it is zone 3. Left unchanged; raise AUTO_PREP_ZONES to
  6 if autoplay should take a late contract too.
- Band draw is uniform within a band (zone 1 or 2 at 50 % each). A weighted band (e.g. favour zone 5 over 6) would be a
  constant per band if the sim shows zone 6 contracts are rarely completed.
