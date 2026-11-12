# M2b v15 in the engine, 2026-11-12 (Core Gameplay Engineer)

Task: docs/specs/changes-m2b-v15.md engine and content rows 1, 2 and 4 (D123-D125), the specs folded with "(M2b v15)", the
constants test against the v15 table. Not in it: row 3 (the sim's bot, no engine change), sim/ and qa/sim (not edited),
src/ui (held by the UI/UX Engineer; the UI line is in section 4), game.html. Status: draft, as the change doc.

## 1. What changed
| Row | Change | Where |
|---|---|---|
| 1 (D123) | `z1_belk.hpMult` 1.05 -> **0.9**: Warden Belk has 629 HP at level 7 (was 734), damage unchanged | src/content/enemies.js |
| 2 (D124) | **Swift passage.** `TAKE_ROAD` reads the zone time (tolls since arrival at the zone's hub, hub services and Dimmed encounters included; the recorder's zone `time`) before TIME_TRAVEL is paid. At zone time <= ROAD_SWIFT_TOLLS (15) the Road first grants `round(ROAD_SWIFT_XP_FRAC (0.75) × xpToNext(L))` XP: event `swift { xp, zt, tolls, node }`, then `xp` with `why: 'swift'` and any `levelUp`, then the travel's `time`, `travel`, `zone`. Zone 6's Road to the Camp counts; the Bell never pays it; nothing at level 60 (xpToNext 0). Switch `C.GATES.swiftRoad` (on) | constants.js; expedition.js `swiftXp`, `swiftView`; nodes.js `takeRoad` |
| 2, views | `mapView(state).swift` = `{ tolls, frac, left, xp, eligible }` on the hub and the map (`left`: tolls left in the window, `ROAD_SWIFT_TOLLS - zt`, 0 = a Road taken now still pays, null once passed; `xp`: what a Road taken now pays, 0 once passed or at level 60; `eligible`: xp > 0); null while the switch is off. `heatPreview(state, { type: 'TAKE_ROAD' }).swift` = that XP or null (null for every other action; `heatView.next` carries it) | expedition.js `expMapView`; heat.js `heatPreview` |
| 2, summary | `stats.exp.swift` and `summary.expedition.swift`: Roads taken with the Swift passage; each zone record's `swift`: the XP its Road paid (0 without) | nodes.js; summary.js |
| 2, dev | `debug.nextZone` takes the Road without the Swift passage (a dev jump keeps the level as built) | debug.js |
| 4 (D125) | **Gated content values**: an enemy template may carry `gated: { <C.GATES switch>: { hpMult?, dmgMult? } }`; while that switch is on the template is made with them (`combat.js tplMult`, the first entry whose switch is on). `z2_mawgrim.gated.mawgrimHp.hpMult` 0.95 (hpMult stays 1.1). `C.GATES.mawgrimHp` **off** by default. The validator checks a `gated` entry as the template's own (known switch, only hpMult / dmgMult, ranges, the product with the values the switch plays) | enemies.js; combat.js; content.js; SCHEMA.md 2.3 |
| Docs | rules.md status, 1.9.7, 1.9.8 (summary lines), 4.4, 12.2, 13 (ROAD_SWIFT_TOLLS, ROAD_SWIFT_XP_FRAC); expedition.md status, 7.1, 9.2 (UI line), 13; engine-api.md status, 5 (`swift`, `xp` why), 10.1-10.4, 11.2, 12 (`nextZone`); SCHEMA.md 2.3; ARCHITECTURE rows (constants, combat, debug, content, expedition, heat, nodes, summary, enemies, qa/engine). All marked "(M2b v15)" | docs/, src/content/SCHEMA.md |

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **452/452**. New s01g-v15 (14 tests): the window at zt 0, 7, 15 and nothing at 16; event order swift, xp, (levelUp), time, travel, zone; run time + TIME_TRAVEL only; level-up before the travel with rested 1000, Quick Study and Insight ignored; all six Roads pay (zone 6 to the Camp), summary `swift` 6; the Bell rung at once pays nothing; `mapView.swift` on the hub and at zt 4 / 15 / 16 / 40, `swiftView` and `heatPreview` / `heatView.next` agree with what the step pays; level 60 pays nothing; the default run (start camp) starts the window at SET_OUT's hub; rows map: no `swift`, TRAVEL_ON pays nothing; `debug.nextZone` pays nothing; switch off: nothing, view and preview null; Belk 629 HP at level 7 (734 at 1.05); Mawgrim 1.1 off / 0.95 on, damage and every other template unchanged; `gated` validation. s13: the v15 table (ROAD_SWIFT_TOLLS, ROAD_SWIFT_XP_FRAC, Belk 0.90 "was 1.05", Mawgrim "was 1.1" with the gated arm 0.95, switches) and the GATES keys; rules 13 rows auto-checked. s01b 1.9.7: each zone's Road taken from a quick walk pays the Swift passage before the travel (its "level 1" check now allows the passage XP) |
| qa/rules | **56/56** |
| qa/docs | **3/3** |
| Content | `validateContent(CONTENT, { strict: true })` returns [] |
| qa/sim | **122/128** (sim/ and qa/sim not edited). All 6 failures are the fixed C.GATES key lists of qa/sim/v13.test.mjs ("setGates arms the named switches ...", "a run of a gated cell leaves the gates ...") and qa/sim/v14.test.mjs (`KEYS` of 4: "the defaults are the engine as built", "gatesFor ...", "a plain cell plays the defaults ...", "the cell name marks ..." which now reads `planner-P0-noswiftRoad` for the 4-key ALL). Every other sim test passes, the expedition model and replay tests included |
| Smoke (scratch, /tmp/v15eng/smoke.mjs, not committed) | 90 default runs (seeds 1-30 × 3 classes, start camp, engine autoplay to the end): 79 of 263 Roads paid the Swift passage; view and preview agreed with the step on every TAKE_ROAD. Not a balance measure: autoplay's map policy (rules 1.9.9) is unchanged and does not seek the window |

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/ && node --test qa/sim/
node --test qa/engine/s01g-v15.test.mjs qa/engine/s13-constants.test.mjs
```

## 3. For the Simulation & Balance Engineer (sim/ not edited)
- **Two new switches.** `C.GATES` = `{ rareHpMultZ1, firstMeetWindup, sapHold, passStealth, swiftRoad: true, mawgrimHp: false }`.
  With the sim's rule (named switches on, every other off) a cell that names gates must name `swiftRoad` to keep row 2:
  cell 2 row 2 on = the defaults (no `--gates`) or all five on-switches; row 2 off = `--gates rareHpMultZ1,firstMeetWindup,sapHold,passStealth`;
  cell 4 arm = `--gates rareHpMultZ1,firstMeetWindup,sapHold,passStealth,swiftRoad,mawgrimHp`.
- qa/sim/v13 and v14 list the 4 v14 keys (6 failures above); sim/lib/output.mjs has no tag for the new keys yet (a switch
  without a tag is marked by its key: `noswiftRoad`, `mawgrimHp`).
- Recorder: `summary.expedition.swift` (swift exits per run) and `zones[].swift` (XP per zone, 0 without); the `swift` event
  per Road. Levels from swift ≈ `swift × ROAD_SWIFT_XP_FRAC` (each pays 0.75 of the level it is taken at).
- speedFog / planFog (spec row 2: value the XP as any XP, VAL_XP): read `mapView.swift` (`left`, `xp`) or
  `heatPreview(TAKE_ROAD).swift`; both are player-visible. The Road pays at zone time <= 15, checked before TIME_TRAVEL.
- Row 1 needs no switch (content). Belk's 0.90 applies on both maps.

## 4. UI line needed (UI/UX Engineer; src/ui not edited)
1. Hub and every Road node (tooltip, and the Road button): "Swift passage: take a Road within 15 tolls for +¾ of a level"
   with "N tolls left" from `mapView.swift.left` (and "+X XP" from `swift.xp` if wanted); greyed once passed (`left === null`
   or `eligible` false); nothing when `mapView.swift` is null (switch off). The Road button can read
   `heatPreview({ type: 'TAKE_ROAD' }).swift` (the XP, or null).
2. On the `swift` event: a float "+X XP Swift passage" and a log line "Swift passage: +X XP" (its `xp` event with
   `why: 'swift'` follows, so the XP float should not be shown twice).

## 5. Readings (designer or Lead to confirm; each is one place to change)
1. **The XP is the spec's formula only**: `round(ROAD_SWIFT_XP_FRAC × xpToNext(L))`, no level-difference modifier,
   XP_WEIGHT_MULT, Quick Study, Boon of Insight, rested doubling or heat (expedition.js `swiftXp`).
2. **The window is inclusive** (zone time <= 15) and the zone time is the one the Dimming and the recorder use, so hub
   services and Dimmed encounters count; a Dimmed Road is taken after its encounter, at the zone time after it.
3. **Level 60**: no XP, so no `swift` event and the view says `eligible: false`.
4. **Dev jump**: `debug.nextZone` never pays it (debug.js `nextZone` passes `swift: false`).
5. **Mawgrim's arm is content, not an engine constant**: the value sits in enemies.js under `gated.mawgrimHp`, as the
   spec's constant table puts it. If row 4 passes: set `C.GATES.mawgrimHp` true, or fold 0.95 into `hpMult` and drop the
   `gated` entry and the switch.
6. **View names**: the spec asks for `swift: { left }`; the field is `{ tolls, frac, left, xp, eligible }` (`left` is the
   "tolls left" of the Lead's example).
7. **Autoplay** (rules 1.9.9) is unchanged: it gets the XP when its exit falls in the window and does not aim for it.

## 6. Commits
| Commit | What |
|---|---|
| 10002c8 | Rows 1, 2, 4 in the engine and content, views, summary, dev jump, tests (s01g, s13, s01b), specs, SCHEMA, ARCHITECTURE rows |
| (this commit, "Engine: M2b v15 implemented ...") | This hand-off |

Logs (not committed): /tmp/v15eng/engine3.log, rules3.log, docs3.log, sim3.log; smoke script /tmp/v15eng/smoke.mjs.
