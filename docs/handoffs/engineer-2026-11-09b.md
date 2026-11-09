# Hand-off: Core Gameplay Engineer, 2026-11-09b (QA engine bugs, API requests, M2 v2 engine changes)

## Summary
- BUG-QA-06 and BUG-QA-07 fixed; QA's three todo tests are now passing tests.
- API requests from the Simulation and UI Engineers done: `V`, `xpCurve`, `diffMod`, `bagCapacity` exported from
  src/rules.js; `damage` events carry `hpLost`; new `regen` event; `levelUp` and `resurrect` carry HP/mana values;
  no `heal` or `mana` event of 0. Existing event fields keep their meaning, so sim/ and src/ui/ needed no change.
- M2 v2 (docs/specs/changes-m2-v2.md, 143f758): every engine change is implemented: all 46 number rows in
  src/constants.js plus the 8 new constants, and the 6 mechanics M1-M6, each with a test. Not mine and not done:
  UI rows 50 (UI literal 8s), 51-52 (round budget), 54 (map count text); bot row 55 and target row 56 (sim/).
- Tests on main with the Simulation Engineer's M2 v2 commits (4658761, 20869ce): `qa/engine/` 169/169, `qa/rules/`
  56/56 (0 todo), `qa/sim/` 31/31. Build: `node tools/build.mjs --out /tmp/eng-game.html` succeeds (892 KB).

## Commits (all on main)
| Commit | What |
|---|---|
| 5ee0d83 | BUG-QA-06: `spellInfo(...).tl` of a talent spell is L (uses `spellTl`, the rule the damage code uses) |
| a6f2564 | BUG-QA-07: `pulseInRounds` is 0 on the Pulse round; `shardsInRounds` is null while SHARD_MAX Shards are alive |
| 04dac48 | Exports `V`, `xpCurve`, `diffMod`, `bagCapacity` (+ engine-api.md 1) |
| e580c35 | Events: `hpLost`, `regen`, level-up gains, resurrect values, no heal of 0 (+ engine-api.md 5-6) |
| 31bcc36 | qa/bugs.md status lines for 06 and 07 |
| 9000dae | No `mana` event of 0 either (the UI floated "+0 mana") |
| 746e408 | M2 v2 numbers (src/constants.js) and the tests that assumed old values or 8 rows |
| 0d495ad | M2 v2 M1: interrupts always hit |
| 3ba6e49 | M2 v2 M2: Linked per living Shard; `linked` events carry `n` |
| 7ca9b71 | M2 v2 M3: Shards take +SHARD_AOE_TAKEN from aoe-tagged player spells |
| 7222097 | M2 v2 M4: Trainer guarantee in rows 3-5 |
| 3c12b09 | M2 v2 M5: zone 1 quests at most QUEST_MAX_SIZE_Z1 mobs |
| 9e21137 | M2 v2 M6: TRAVEL_ON one level early; `travelLevel(state)` helper |
| (this note) | "Engine: M2 v2 implemented" |

## Part 1: QA bugs
- BUG-QA-06 (src/rules.js): `spellInfo` read the stored `tl`, which for talent spells stays at the level the talent
  was taken. The amount was already right.
- BUG-QA-07 (src/engine/boss.js, `bossIntent` telegraph):
  - `pulseInRounds`: 0 when this round's intent has Starless Pulse ("this round", like Litany and Brand), else the
    rounds to the next Pulse. The schedule itself is unchanged.
  - `shardsInRounds`: `null` while SHARD_MAX Shards are alive (the wave would summon none). When a Shard dies, the
    next intent shows the countdown to the next scheduled wave again. The schedule is unchanged (a wave tick with
    SHARD_MAX alive still passes; the next tick is SHARD_EVERY later). The HUD already hides a null counter.

## Part 2: API requests (docs/specs/engine-api.md 1, 5, 6)
| Item | Change |
|---|---|
| `V(L)`, `xpCurve(L)`, `diffMod(d)` | exported from src/rules.js (the engine's own functions) |
| `bagCapacity(state)` | exported; in CREATE it reads the profile's Deeper Pockets |
| `damage` | new `hpLost` = min(amount, HP before). `amount` unchanged: the hit after absorbs, not capped (overkill shows there). IMMUNE and Death's Sidestep: `hpLost` 0. Bloodprice Gambit's self-damage too. |
| `regen` (new) | `{ pct, hpGain, manaGain, petHpGain }` right after `victory`; not sent when nothing was restored or after `fled` |
| `levelUp` | adds `hpGain, manaGain, petHpGain, maxHp, maxMana, petMaxHp` (one event per level) |
| `resurrect` | adds `hp, mana` (values after the resurrect) |
| `heal`, `mana` | sent only when something is restored (`amount > 0`), in and out of combat; no more 0-heal HOT ticks at full health |
| telegraph | engine-api.md 6 has a table of every counter's meaning |
| status objects | engine-api.md 6: `tick` (DOT damage) vs `amount` (HOT heal, WARD left) |

engine-api.md 5 has a recipe to track the player's HP from events; qa/engine/api-events.test.mjs checks it for every
combat step of 33 full runs (24 fixture, 9 real content). `healUnit` now ignores a non-numeric amount (it used to set
HP to NaN, see the QA test fix below).

## Part 3: M2 v2 (docs/specs/changes-m2-v2.md)
### Numbers (746e408)
All 46 number rows: 4-33, 35-38, 40-44, 46-51, 53. New constants: TRAINER_ROW_MIN 3, TRAINER_ROW_MAX 5,
TRAVEL_EARLY_LEVELS 1, QUEST_MAX_SIZE_Z1 2, LINK_DR_PER_SHARD 0.15, SHARD_AOE_TAKEN 1.00, PACE_ROUND_ANIM_S 1.5,
PACE_ROUND_DECIDE_S 1.0 (PACE_MANUAL_ROUND_S is defined as their sum, 2.5, and the run-time estimate uses it).
ZONE_CHOICE_ROWS 7 needed no engine code: map, movement, content level and travel read the constant.
qa/engine/s13-constants.test.mjs passes against the updated rules.md tables.

### Mechanics (one commit and one test each)
| # | Behaviour | Code | Test |
|---|---|---|---|
| M1 | Interrupt-tagged spells (Throat Jab, Spellsnap, Muzzle Shot) never miss and cannot be dodged; r1-r3 still drawn | spells.js `pHit` (by tag) | s07-combat: forced miss and dodge draws still hit, interrupt and silence, same stream position as a hit; control: the draw makes a basic attack miss |
| M2 | Boss takes -min(LINK_DR, LINK_DR_PER_SHARD × living Shards); `linked` events carry `n` | damage.js `linkedDr` in the step-6 target modifiers; boss.js events | s10-boss: same draws with 0-5 Shards (1 - 0.15n, capped at 0.60); `n` on the entry wave, last Shard's death, phase-3 despawn |
| M3 | Shards take +SHARD_AOE_TAKEN from direct hits of the player's aoe-tagged spells | damage.js step-6 target modifiers | s10-boss: ×2 for Cinder Storm, Rime Burst, Volley Rain; ×1 for Ember Bolt, Spark, the Living Flame DOT snapshot and the pet |
| M4 | Trainer in a random free cell of rows 3-5, drawn after the Rest guarantee, before the fill | map.js `generateLayout` | s00-s01: a Trainer in rows 3-5 on 300 seeds × 6 zones; for 1 200 maps the Trainer and Rest cells equal a replay of the draw sequence |
| M5 | Zone 1 quest size capped at QUEST_MAX_SIZE_Z1 after the unchanged size draw; mobs drawn for the capped size | map.js `setupNode` | s00-s01: replay of the node stream (template, size, mobs, offset) on 300 seeds in zones 1-2; qa/rules size distribution |
| M6 | TRAVEL_ON from exit level - TRAVEL_EARLY_LEVELS (Swift Boots one lower) or after the last row | nodes.js `travelLevel`/`canTravel`; rules.js `travelLevel(state)` | s00-s01: zone 1 levels 8/9 (7/8 with Swift Boots), zone 2, last row, Wayfinder; helper null in CREATE and at the Camp |

Real content check (300 seeds): 7 rows per zone, a Trainer in rows 3-5 on every zone 1 map, zone 1 quests at most 2
mobs, `travelLevel` 9 in zone 1.

New API pieces from M2 v2 (engine-api.md): `travelLevel(state)` (section 1; "Travel on at level N"), `linked` events
`{ on, n }` (section 5), map and quest draw order (section 7), TRAVEL_ON legality (section 3).

### Tests changed because the spec changed
| File | Change |
|---|---|
| qa/engine/health.test.mjs | legalActions soundness takes further seeds when a run ends before 1 000 checked actions |
| qa/engine/s00-s01-structure.test.mjs | content levels for 7 rows, dungeon levels from the offsets, par-relative Ascendancy and boss hours; new M4, M5, M6 tests |
| qa/engine/s02-nodes.test.mjs | dungeon levels from `dungeonLevels`, boss-drop filter by level, 7-row loop |
| qa/engine/s05-classes.test.mjs, s06-talents.test.mjs | new Open Vein, Ember Bolt and talent values (Serrated Finish, Biting Cold, Steady Aim, Mortal Shots, Mindguard 20 % incl. a new share check) |
| qa/engine/s10-boss.test.mjs, s11-s12-meta-content.test.mjs | par-relative hours, Arcane Ward learn level; new M2, M3 tests |
| qa/rules/r01-r02-map-nodes.test.mjs (QA) | rows 2 and 7 for the weight sample, last two rows of zone 6, size distribution in zone 2 plus the zone 1 cap |
| qa/rules/r06-talents.test.mjs (QA) | new values for Pack Leader, Cornered Beast, Deep Wounds, Barbed Mastery, Ward Weaving, Ferocity, Arcane Momentum |
| qa/rules/r10-boss.test.mjs (QA) | par-relative hours in the Ascendancy test |

Part 1-2 test changes: QA's 06/07 todo tests are tests now; QA's 7.1 end-of-round test built a HOT with `tick: 4` (the
DOT field), so the old engine healed NaN; it now uses `amount: 4` like Field Dressing and checks the HP. New:
qa/engine/api-events.test.mjs (10 tests) and a Shards-countdown test in s10-boss.

## How to test
```
node --test qa/engine/     # 169 pass
node --test qa/rules/      # 56 pass, 0 todo
node --test qa/sim/        # 31 pass (with sim/ at 20869ce)
node tools/build.mjs --out /tmp/eng-game.html
node qa/engine/bench.mjs 100
```
Throughput (`bench.mjs 100`, 2-core machine shared with a running simulator job): pure `step` 3 233 runs/min on the
fixture, 6 204 on src/content; `stepInPlace` 7 487 and 27 799. Targets (B37 200 per core, role file 1 000) met.

## Notes for other roles
- **Simulation Engineer**: `exitLevelOf` (planner, speedrunner) restates the travel rule from the constants; it can
  call `R.travelLevel(state)` instead (same value, one place). sim/lib/recorder.mjs can use `hpLost`, `levelUp.hpGain`,
  `resurrect.hp` and `regen` instead of rebuilding HP. I did not edit sim/.
- **UI Engineer**: "Travel on at level N" = `R.travelLevel(state)`; the `linked` event has `n` (Linked strength
  -min(LINK_DR, LINK_DR_PER_SHARD × n)); `R.bagCapacity(state)` replaces the bridge's copy of the sum. The literal 8s
  in src/ui (change row 50) are yours.
- **QA**: `qa/browser/ui-regress.mjs` "BUG-QA-03 the potion's heal names its source in the log" now fails by design
  (31/32 at 1366x768 on a build of e580c35, run with `NODE_PATH=/opt/npm-tools/node_modules`): it drinks a Healing
  Draught at full health and expects a "heals you for N" line, and a 0 heal is no longer sent. Drink after taking damage,
  or assert that no "+0" line appears. Browser checks that assume 8 rows or old maps may need the same review.
- Not done (not asked): an exported Ascendancy helper (the UI reads it from a dry FIGHT_BOSS step).

## Known issues
- The default autopilot (`autoAction` outside combat) still travels at the exit level, not one level early; it is a
  baseline policy, not a bot. Its win rate stays low (bench: 0-2 boss kills in 300 runs per content set).
- `linked` is still sent only when a wave comes or the last Shard goes (the UI floats "Linked" on each); a Shard death
  that leaves others alive sends none, so a UI showing the strength should count living Shards in the state.
