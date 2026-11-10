# Hand-off: Core Gameplay Engineer, 2026-11-10d (M2b 2b.1, combat v2 in the engine)

## Summary
- docs/specs/combat-v2.md is in the engine on its default constants. That covers sections 3-9, the engine side of
  4.3 and the map tooltip data of 10.7. Section 10 (UI) belongs to the UI Engineer and section 11 (bots) to the Sim
  Engineer. In the engine: intent tracks, opening scripts and signature turns, Signal / Bolster / Bloodlust /
  guardian ward, OFF_BALANCE with its damage and crit hooks, the engage round with `ENGAGE` and the nine class
  options, autoplay rule E, the end-boss track and its OFF_BALANCE hooks, ENGAGE_DMG_COMP, the v2 pacing terms and
  encounter composition.
- Rules are folded into rules.md sections 3, 7.1-7.9, the new 7.10-7.14 and the section 13 constant table, marked
  "(combat v2)". The constants test reads that table, so it stays the single source. engine-api.md and the
  ARCHITECTURE.md rows are updated. `STATE_VERSION` is now 2.
- Tests at 7ef2ec8: qa/engine 227/227 (39 of them new, in qa/engine/s07b-combat-v2.test.mjs), qa/rules 56/56, qa/docs
  3/3, qa/sim 64/64. Nothing fails, so qa/sim needs nothing more from the Sim Engineer: 9d49d75 adapted sim/ to the
  v2 API. Build: `node tools/build.mjs --out /tmp/eng-game.html` succeeds (49 modules, 1 091 KB).
- Content: the engine reads an optional zone `addPool`. The fixture's zone 1 has one. I did not edit src/content/,
  because the engine runs on it unchanged. The list for the Content Designer is below.
- **Balance finding (Lead, Designer, Sim Engineer).** On the spec defaults the Rogue reaches the boss far less often:
  80.5 % before combat v2, 50.0 % now. Mage and Hunter hold or improve. I measured three causes (below). I did not
  change any spec default.
- **Update: the Lead decided D48** (all three Rogue fixes). They are on main in 88643a7, 177e625 and 7f9b4f0; see
  "D48 Rogue fixes" below. Reach the boss after the fixes, planner P0, 200 seeds per class: Rogue 70.5 %, Mage
  81.0 %, Hunter 88.0 % [measured].

## D48 Rogue fixes (after the Lead's decision)
| Commit | Fix | Code | Rules / API | Test (fails without the change) |
|---|---|---|---|---|
| 88643a7 | (1) The default target takes an enemy that was sapped this fight only when no other living, non-HEXED, non-SAPPED enemy is left, so autoplay never switches back to it while it fights another. Rule E's Sap never targets a beast. | combat.js (`defaultTarget` tiers, enemy field `wasSapped`), engage.js (Sap sets it), autoplay.js (rule E) | rules.md 7.9 (rule E, default target); engine-api.md `defaultTarget`, `wasSapped` | s07b "D48 (rules 7.9): rule E never saps a beast; the default target never switches back ..." |
| 177e625 | (2) Ambush keeps STEALTH like a stealth opener: `keepsStealth('ambush')` follows `OPENER_BREAKS_STEALTH` (false), so the Rogue can open again in round 2 | engage.js | rules.md 7.10 option row | s07b "Ambush: ... the Rogue stays in STEALTH like after an opener (D48)" (same STEALTH as after a CAST of Shadowstep Strike) |
| 7f9b4f0 | (3) No ENGAGE_DMG_COMP in the Rogue's fights; adds and Signal reinforcements included. Mage and Hunter unchanged | combat.js (`engageComp`) | rules.md 7.6, 7.10 and the ENGAGE_DMG_COMP row of the constant table; engine-api.md (enemy `dmg`) | s07b "ENGAGE_DMG_COMP: ... except in the Rogue's fights (D48) ..." (all three classes and a Signal add); s07 dungeon zone-danger test now uses the Rogue's formula |

Tests at 7f9b4f0:

| Suite | Result |
|---|---|
| qa/engine | 228/228 |
| qa/rules | 56/56 |
| qa/docs | 3/3 |
| qa/sim | 63/64 |
| build | 49 modules, 1 094 KB |

The qa/sim failure is not caused by D48. It is qa/sim/m2v3.test.mjs "planner and tactician map choices use
PLANNER_HOUR_MULT; the greedy uses 1" ("0 of 92 map choices change with the weight"; the test needs more than 100
map states and at least one difference). It fails the same way at f16b117, before my D48 commits, and passes at
a9cdd91. So it started with the Content Designer's a379e3c (new quest lists and add pools change the sampled map
states). It is a qa/sim test, outside my paths: the Sim Engineer should re-pick its seeds or thresholds.

Measurements. Planner, P0, seeds 1000-1199, 2 workers. All rows use the current content (a379e3c), so they are
comparable with each other but not with the old-content tables in the next section [measured]:

| Engine | Risk table | Rogue reach / win / early deaths | Mage reach / win | Hunter reach / win |
|---|---|---|---|---|
| f16b117 (before D48) | fixed (pass-2026-11-10c obs-P0) | 56.5 % / 21.5 % / 40.5 % | 81.0 % / 37.5 % | 88.0 % / 41.0 % |
| 7f9b4f0 (D48) | fixed | 70.5 % / 26.0 % / 27.0 % | 81.0 % / 37.5 % | 88.0 % / 41.0 % |
| 7f9b4f0 (D48) | fresh v2 warm-up, 1 000 runs per class | 65.5 % / 32.5 % / 30.5 % | 86.5 % / 42.0 % | 84.0 % / 36.0 % |
| scratch: D48 + rule E never saps for the Rogue | fixed | 79.0 % / 30.0 % / 20.0 % | - | - |

- Mage and Hunter runs are identical with and without D48 (every recorded field except the run time), because every
  change applies only in the Rogue's fights.
- The 78 % in D48's rationale came from my experiment (a), in which rule E never saps. D48's fix (1) keeps the Sap
  and guards it instead. On the current content that recovers 14 pp of the Rogue's reach (56.5 % to 70.5 %), while
  never sapping recovers 22.5 pp (to 79.0 %). [inference: from the last two fixed-table rows] Autoplay's Sap still
  costs the Rogue about 8.5 pp of reach. If the Lead wants the Rogue at the other classes' level, the next step is
  rule E without Sap for the Rogue (Sap stays a manual choice).
- Fix (3) applies in every Rogue fight, as D48 says, dungeon bosses included. Before combat v2 the Rogue did not
  start dungeon-boss fights in STEALTH (rules 5.3), so there it had no free round. Say so if the comp should stay in
  those fights.
- combat-v2.md 6.2 still says Ambush "leaves STEALTH". D48 supersedes it. The file is the Designer's, so I left it.
- Median manual minutes of wins at 7f9b4f0 (fixed table): 54.6 / 56.6 / 55.7 (Rogue / Mage / Hunter).

## Commits (all on main)
| Commit | What | Files |
|---|---|---|
| 79d3e3b | Combat v2 core: intent track, opening scripts, pack roles, engage round and options, OFF_BALANCE, rule E, end-boss track, pacing; existing tests moved to the v2 rules | src/constants.js, src/rules.js, src/engine/{actions,autoplay,boss,combat,content,damage,engage (new),nodes,spells,summary,track (new)}.js, docs/specs/rules.md, docs/specs/engine-api.md, docs/ARCHITECTURE.md, qa/engine/{helpers.mjs, api-events, s02-nodes, s05-classes, s07-combat, s10-boss}.test.mjs, qa/rules/{r04-r07-character-combat, r06-talents}.test.mjs |
| 7609df3 | One test or more per rule (s07b); fix: two skulkers no longer both Signal in one round; spec tables in the s13 constants test | src/engine/{combat,track}.js, docs/specs/rules.md, qa/engine/s07b-combat-v2.test.mjs (new), qa/engine/s13-constants.test.mjs, qa/rules/COVERAGE.md |
| 9cc6d0e | Encounter composition (rules 7.14) at node setup, add pool, fixture add pool | src/engine/{map,nodes}.js, docs/specs/{rules,engine-api}.md, docs/ARCHITECTURE.md, qa/engine/{s00-s01-structure,s07b-combat-v2}.test.mjs, qa/fixtures/content-min.js, qa/rules/COVERAGE.md |
| 7ef2ec8 | `engagePreview` for the engage panel's hover preview (combat-v2.md 10.3) | src/engine/engage.js, src/rules.js, docs/specs/engine-api.md, docs/ARCHITECTURE.md, qa/engine/s07b-combat-v2.test.mjs |
| 57cc3ae | "Engine: combat v2 implemented" (this note, first version) | docs/handoffs/engineer-2026-11-10d.md |
| 88643a7, 177e625, 7f9b4f0 | D48 Rogue fixes, one commit each (section "D48 Rogue fixes") | see that section |
| (this update) | "Engine: combat v2 Rogue fixes" | docs/handoffs/engineer-2026-11-10d.md |

The Sim Engineer's 07ba544 and 9d49d75 sit between my commits. They touch sim/ only.

## Changes and tests
| Rule | Behaviour | Code | Tests (qa/engine/s07b unless named) |
|---|---|---|---|
| 7.11 track | turn t = round turn0 + t - 1 (turn0 2; end boss 1; adds the next round); INTENT_TRACK_LEN entries; turn-major fill at fight start, one append per enemy per round, no draw at round 1 -> 2; draws only when an entry enters; weighted picks off cooldown by e.cds, earlier entries and later scripted entries; pet-aggro draw whenever a live pet exists | track.js, combat.js | "fight start ...", "draws happen only when ...", "entries are fixed facts ..." (look-ahead with a re-seeded stream re-draws only new entries), "weighted picks ..." |
| 7.11 now-entry | order: trap springs, control cancels (cast or heavy: OFF_BALANCE), summon HP trigger, invalid entry -> basic attack with `replaced`, TAUNT / feign retarget; control during the round cancels the now-entry (cast = interrupt); summons and adds draw a whole track and play no script | track.js, spells.js, combat.js | "control cancels the now-entry ...", "when an entry becomes now ...", "TAUNT and feign ...", "summoned adds ..."; s07 and s05 updated |
| 7.11 end boss | track of the next INTENT_TRACK_LEN rounds from the schedule, `ifPhase` / `alt` for a phase change, aggro drawn on entry | boss.js | s10 updated; s07b "fight start" (boss turn t = round t) |
| 7.12 scripts | archetype scripts turns 1-3; lone skulker strikes; signature on SIGNATURE_TURN, dungeon boss's second ability on SIGNATURE_TURN_2; HEAVY / CAST_SCRIPT_MULT | constants.js (OPENING_SCRIPT, SCRIPT_ACTION), track.js | "every archetype plays its opening script ...", "elite, rare and dungeon boss ...", "scripted heavy and cast ..."; s13 parses the rules.md script table |
| 7.12 pack roles | Signal (end of round, 1 draw from the add pool, skulker's level, no XP / coin / loot, once per fight, none if interrupted); Bolster; Bloodlust; guardian ward fixed at entry | combat.js, damage.js, track.js | "Signal ...", "Bolster ...", "Bloodlust ...", "guardian ward ..." |
| 7.6 / 7.10 | ENGAGE_DMG_COMP on every template enemy, not the end boss or Shards | combat.js | "ENGAGE_DMG_COMP ..." |
| 7.13 | OFF_BALANCE from an interrupt, from control on a cast or heavy turn, and from a heavy that costs 0 HP (not from the pet's own aggro); +OFFBAL_TAKEN from player and pet, +OFFBAL_CRIT, dodge 0; FROZEN counts, never both; durations; end boss Litany / Crush hooks (+OFFBAL_BOSS_TAKEN) | damage.js, spells.js, combat.js, boss.js | five 7.13 tests; qa/rules r06 Brittle-vs-FROZEN ratio now `(1.12 + OFFBAL_TAKEN) / (1 + OFFBAL_TAKEN)` |
| 7.10 | engage round in every fight but the end boss (enemies Unaware); `ENGAGE` only then; the nine options; control options refuse CC-immune targets; `engageOptions`, `engagePreview` | engage.js, actions.js, spells.js, combat.js, rules.js | "legalActions offers ENGAGE only in the engage round ..." (3 classes, round 2, end boss, FLEE), one test per option (Ambush, Sap / Premeditate, Pre-cast / Binding Glyph, Gathered Power, Opening Shot, Lay Trap, Send the Pet), immunity, `engagePreview` checked against play |
| 7.9 | rule E (control on the enemy with the most track damage on the player over turns 1..ENGAGE_AUTO_LOOK, else the strike option; Mage: Pre-cast); rules 1-6 read only the now-entry; the default target also skips SAPPED (it already skipped HEXED) | autoplay.js | "rule E ..."; s07 7.9 tests run with `engage: false` |
| 3 | PACE_ROUND_ANIM_S 2.1, PACE_AUTO_ROUND_S 1.1, PACE_ENGAGE_S 6 per fight with an engage round (manual profile only) | constants.js, summary.js | "pacing (rules 3) ..." |
| 7.14 | composition rules at node setup (quests, grind waves, elite + add, dungeon trash, Camp waves); a valid draw costs no draw; zone `addPool` validated; `mapView` archetypes per enemy for treasure guards and each dungeon fight | map.js, nodes.js, content.js, rules.js | four 7.14 tests; s00 quest replay applies the repair |
| all | determinism through engage rounds; serialize mid-track; STATE_VERSION 2 refuses older saves; full autoplay runs per class complete, and every fight but the end boss opens with an engage round | - | "same seed + same actions ...", "full autoplay runs per class complete ..." |

Other checks: real content, 400 seeds x 6 zones x 4 node types, gave 17 542 encounters, all valid after the
repair. 1 135 of the 1 655 multi-mob quest encounters took a zone normal from outside the quest's own list (see
content needs). Sim batches at 7ef2ec8: 600 + 3 600 runs, 0 errors.

## Decisions where combat-v2.md left a choice (please confirm or change)
1. "n turns" for an option = status duration n + 1, because rules 7.4 counts the round of application. Sap covers
   turns 1-3 and Binding Glyph turns 1-2.
2. OFF_BALANCE gained at the start of a round (control that was already on cancels the new turn's entry) lasts
   OFFBAL_DURATION - 1, so it covers exactly the player's next action, as the spec's duration row intends.
3. Signal and Bolster are script only, because combat-v2.md gives them no 7.6 weight. So BOLSTER_CD has no effect
   today. Give Bolster a weight if the mender should also pick it later in the fight. (Confirmed by D48.)
4. A second skulker whose Signal turn comes in the same round as the first one's plays its basic attack instead
   ("help already called"). An interrupted Signal brings nobody.
5. Signal adds give no coin either, since coin counts as loot. They still count as kills.
6. Bolster keeps a larger shield the ally already has.
7. The default target also skips SAPPED enemies, as it already skipped HEXED ones. Without this, autoplay would
   break its own Sap at once. (Confirmed by D48, which also keeps the default target off a once-sapped enemy.)
8. FLEE stays legal in the engage round (rules 7.8). The spec's 6.1 list leaves it out. (Confirmed by D48.)
9. Composition repair: the last enemy is redrawn (1 draw) from the encounter's pool among the templates that make
   it valid. For quests it falls back to the zone's normals. Camp waves are included. The spec states the rules
   only.
10. Add pool: zone `addPool`, else the zone's normals. combat-v2.md 4.2 says "of the node's region". Regions arrive
    with the expedition spec, and the pool can move to the region then.
11. Ambush's "+2 CP": if Shadowstep Strike is learned, Ambush gives Shadowstep's own CP (2, plus the r_b3 talent);
    otherwise Gutting Jab gives +2 on a hit.
12. Lay Trap's spring turn is fixed when the trap is laid (the first heavy or cast in turns 1..3 of the track at
    that moment).
13. ENGAGE_DMG_COMP applies to every template enemy: summons, Signal adds, Camp enemies and dungeon bosses
    included, but not the end boss or the Shards.

## Balance finding: Rogue, before D48 (old content, 7ef2ec8; for the Lead, the Designer and the Sim Engineer)
Planner, P0, 200 seeds per class (1000-1199), the same fixed risk table on both sides (the Sim Engineer's
pass-2026-11-10c obs-P0, copied to /tmp/obs-P0-pass10c.json), 2 workers [measured]:

| Commit | Rogue reach / win / early deaths | Mage | Hunter |
|---|---|---|---|
| 9322651 (before combat v2) | 80.5 % / 23.0 % / 15.0 % of runs | 81.5 % / 34.5 % / 7.0 % | 86.5 % / 27.0 % / 6.5 % |
| 7ef2ec8 (combat v2 defaults) | 50.0 % / 22.5 % / 46.5 % | 80.0 % / 37.5 % / 15.5 % | 90.5 % / 39.5 % / 7.0 % |
| 7ef2ec8, fresh v2 warm-up (1 000 runs per class) | 51.0 % / 16.0 % / 40.0 % | 83.5 % / 49.0 % / 12.0 % | 86.0 % / 36.0 % / 9.5 % |

- The Rogue's losses are in zone 1. At 7ef2ec8, 84 of its 155 deaths came in zone 1 (77 of them in quest and grind
  fights, mostly rounds 9-13, levels 2-10). At 9322651 it was 23 of 154. A risk table warmed on v2 does not fix
  this: the planner avoids some fights, arrives under-levelled, and wins less.
- Rogue-only experiments in scratch copies (not committed; same seeds and risk table) [measured]:
  | Change | Rogue reach / win / early deaths |
  |---|---|
  | none (7ef2ec8) | 50.0 % / 22.5 % / 46.5 % |
  | (a) rule E never Saps; the Rogue always Ambushes | 60.5 % / 25.5 % / 36.0 % |
  | (a) + (b) Ambush keeps STEALTH | 65.5 % / 27.0 % / 32.0 % |
  | (c) ENGAGE_DMG_COMP 1.0 (all classes) | 66.5 % / 29.5 % / 32.5 % (Mage 89.5 %, Hunter 96.5 %) |
  | (a) + (b) + (c) | 78.0 % / 31.5 % / 20.0 % |
- Causes [inference: from these experiments and one traced run]:
  - (a) Under rule E, autoplay Saps the enemy with the most track damage, usually the caster, and fights the other
    one. When Sap ends, the default target switches back to the caster (mender > caster priority), and a half-dead
    beast keeps ramping with Bloodlust.
  - (b) Ambush leaves STEALTH, while a bar opener cast from STEALTH keeps it (rules 7.4, `OPENER_BREAKS_STEALTH`
    false). combat-v2.md 6.2 calls Ambush "today's opening", but today's opening kept STEALTH.
  - (c) ENGAGE_DMG_COMP pays for a free round that the Rogue already had: before v2, enemies were Unaware in round 1
    against a stealthed Rogue. For the Rogue it is a pure nerf.
- Levers, for the Designer to choose: rule E without the control option for the Rogue (or Sap only when the
  default target is a different enemy), Ambush keeping STEALTH like openers, and a class-specific or Rogue-exempt
  ENGAGE_DMG_COMP. Each moves the Rogue 10-16 pp, and all three together bring it back to 78 %.
- Other numbers the Sim Engineer will want [measured, same batches]:
  - Pooled planner win rate at 7ef2ec8: 33.2 %, inside WR_P0_PLANNER.
  - Class spread: 17.0 pp, against 11.5 pp before; B6 asks for at most 8 pp.
  - Mage early deaths doubled: 7.0 % to 15.5 % of runs.
  - Median manual minutes of wins: 43.7 / 45.5 / 45.7 before, 55.5 / 57.2 / 55.3 now. This is the v2 pacing.
    combat-v2.md 9 expects the expedition spec's fewer fights to bring it back (B53).

## Content needs (Content Designer, src/content/)
Items 1-3 are done in a379e3c [measured at 7f9b4f0, same 400-seed sample]: all 6 zones have an `addPool`; 0 of
1 655 multi-mob quest encounters need a zone normal from outside the quest list (all 17 542 encounters are valid);
every dungeon boss has a second usable ability. Item 4 waits for the expedition spec. The original list:

1. `zones[i].addPool` (optional): the zone's normal templates that may join as Signal reinforcements or template
   summons. The engine validates that it is non-empty and a subset of the zone's normals; without it the zone's
   normals are used. Please add a row to src/content/SCHEMA.md. No real zone has one yet. The fixture has zone 1:
   `['z1_brute', 'z1_skulker', 'z1_beast']`.
2. Quest enemy lists that meet rules 7.14 by themselves: 2+ archetypes; a caster, mender, skulker or beast in
   3-mob encounters; never a guardian with menders only. Today 1 135 of 1 655 multi-mob quest encounters (sample
   above) need a zone normal from outside the quest's list, which waters down the quest's flavour. Dungeon trash
   lists and the Camp pool already repair within themselves.
3. Dungeon bosses z1_belk and z5_father_vael have only one template ability that is not `once`. They play it on
   SIGNATURE_TURN and have no SIGNATURE_TURN_2 entry (turn 5 is a weighted pick). Add a second ability if every
   dungeon boss should have a turn-5 signature.
4. Later, with the expedition's regions: add pools per region (combat-v2.md 4.2).

## For the UI Engineer (combat-v2.md 10; src/ui/ not changed by me)
engine-bridge.js imports `* as R`, so the new exports are already available through the bridge.
1. Tracks: `enemy.track` (turn, id, name, kind, cast, heavy, target, est, scripted). "Now" is `enemy.intent`, with
   `intent.replaced { id, name, reason }`, `intent.cancelled { by, id, name, cast, heavy }`, and the `replace` and
   `cancel` events.
2. Role badges:
   - Lookout: a skulker whose track holds `signal`.
   - Ward: `enemy.ward`.
   - Bloodlust: `min(BLOODLUST_MAX, BLOODLUST_STEP x enemy.acted)` for `arch === 'beast'`.
   - Bolster: the `shield` event with `spell: 'bolster'`, and `enemy.shield`.
3. Engage panel: `R.isEngageRound`, `R.engageOptions` (targets, Pre-cast spells, grey-out reason), and
   `R.engagePreview(state, action)` for the hover (cancelled turns, OFF_BALANCE turns, FROZEN windows, turns sent to
   the pet; no draw). Round 1 carries `round.engage: true`.
4. OFF_BALANCE: `R.offBalance(state, idx)`, `spellInfo(...).window`, the `offBalance` event.
5. Log lines: `cancel`, `signal`, `summon` with `signal: true`, `trapSprung`, `shield` with `by` and `spell`.
6. Map tooltip: `mapView` lists one archetype per enemy: `archetypes` on quest, elite, grind (first wave) and
   treasure nodes (the guard), and `fights` and `bossArchetype` on dungeons.

## For the Simulation Engineer
- qa/sim passes at 7ef2ec8. Risk tables learned before v2 are stale: my fixed-table and warmed batches above
  differ, the Rogue's win rate most.
- `stats.engages` counts fights with an engage round. `estSeconds` adds PACE_ENGAGE_S per such fight in the manual
  profile only.
- Throughput (`node qa/engine/bench.mjs 30`, shared 2-core machine, back to back) [measured]:
  | Mode | 7ef2ec8 runs/min (full-length runs) | 9322651 runs/min (full-length runs) |
  |---|---|---|
  | real content, `stepInPlace` | 10 171 (2 832) | 16 474 (5 771) |
  | real content, pure `step` | 3 432 (863) | 3 992 (1 370) |
  | fixture, pure `step` | 2 481 (700) | 2 782 (1 036) |

  The simulator uses `stepInPlace`, which stays far above B37 (200 per core) and the role file's 1 000. Pure
  `step` on full-length runs is now under 1 000. A profile shows `deepClone` at 30 % plus GC at 13 %: the tracks
  make the state larger.

## For QA
- New: qa/engine/s07b-combat-v2.test.mjs, 39 tests (7.10: 10, 7.11: 8, 7.12: 8, 7.13: 5, 7.14: 4, 7.9 / pacing: 2,
  determinism / full runs: 2). qa/rules/COVERAGE.md has rows for 7.10-7.14 and section 3.
- `qa/browser/full-run.mjs --classes mage --sizes 1366x768` fails at step 3 in ZONE_HUB, before any fight:
  `player.itemBar.0: ui "healing_draught" vs engine null`. It fails the same way at 9322651, before combat v2, so it
  is not an engine change. Left for QA and the UI Engineer.

## How to test
```
node --test qa/engine/     # 227 pass
node --test qa/rules/      # 56 pass
node --test qa/docs/       # 3 pass
node --test qa/sim/        # 64 pass
node tools/build.mjs --out /tmp/eng-game.html
node qa/engine/bench.mjs 30
node sim/run.mjs --bot planner --class all --runs 200 --seed-start 1000 --profile fresh --warmup 0 \
  --risk-in /tmp/obs-P0-pass10c.json --workers 2 --out /tmp/eng-final-sim
```

## Known issues
- qa/sim/m2v3.test.mjs "planner and tactician map choices use PLANNER_HOUR_MULT" fails since the content commit
  a379e3c (see "D48 Rogue fixes"). This is for the Sim Engineer; the engine is not involved.
- BOLSTER_CD has no effect while Bolster is script only (decision 3).
- Pure `step` throughput is lower (see above). If a pure-step consumer needs more speed, the tracks could keep only
  the fields that are set.
- The Rogue balance finding above is open. It is a spec-default question, not an engine defect.
