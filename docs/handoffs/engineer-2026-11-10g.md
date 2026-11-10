# Hand-off: Core Gameplay Engineer, 2026-11-10g (combat v2.1 in the engine; D55, D56, D57)

## Summary
- The engine plays combat v2.1 on its defaults (docs/specs/combat-v2.md 16; rules.md 7 and 13, lines marked "(combat v2.1)"):
  - **D55 and D57 constants**: OFFBAL_TAKEN 0.50, HEAVY_SCRIPT_MULT and CAST_SCRIPT_MULT 1.5, OFFBAL_BOSS_TAKEN 0, PREMED_CP 5,
    GATHER_SPELLS 3, GATHER_CRIT 1.0. SIGNATURE_TURN_2 is 4.
  - **Wind-ups (D56)**: the signature entries of elites, rares and dungeon bosses carry `windup` and `cast` from the moment
    they enter the track, so they show from the engage round. Every interrupt, stun-tagged spell or control stops one,
    on a dungeon boss too.
  - **Lasting result**: an answered wind-up gives one STAGGERED stack (-STAGGER_DMG damage dealt); a landed one gives one
    EMPOWERED stack (+EMPOWER_DMG). Both are enemy statuses `{ id, dur: null, stacks, value }` in the enemy's 7.2 step 2
    sum. Two events report them: `stagger` and `empower`.
  - **Disrupt (D56)**: on a dungeon boss, every class's control option traps the first visible wind-up. It is legal only
    while a wind-up is visible, and greyed out with a reason otherwise. `engageOptions` lists it, and `engagePreview`
    covers it.
- **Checked against the designer's evidence**: main's simulator ran on this engine with the designer's seeds, risk table
  and bots. Planner reach is 81.4 % (designer's v2.1 arm: 81.6 %), masher 64.9 % (64.8 %), and the gap is +16.6 pp
  (+16.8 pp).
  - 882 of 900 planner runs and 869 of 900 masher runs are step-for-step identical to the designer's.
  - With the prototype's hit rule, all 1 800 runs are identical. That rule differs from rules.md 7.12 in two cases (Decision 1).
- All suites are green, and qa/sim needed no change. The build works, and the UI regression parts A, D and H pass on
  it (38/38).

## Commits (all on main)
| Commit | What | Files |
|---|---|---|
| d44dd8c | D55/D57 constants, SIGNATURE_TURN_2 4, EMPOWER_DMG and STAGGER_DMG exported; the constants test passes again. Three tests adapted: the turn-4 signature, the weighted pick of a dungeon boss's turn 5, and Gathered Power's charges. The Wayfinder test also strips the profile-derived end-of-run fields, because the hunter's seed-6 run now ends within its 400 steps | src/constants.js, qa/engine/s07b-combat-v2.test.mjs, qa/engine/s11-s12-meta-content.test.mjs, docs/ARCHITECTURE.md |
| 0bd5a55 | Wind-ups and their lasting result: the flags, the stacks, the answered and landed hooks, the events, the `stagger` flag in the predicted cancel (D52) | src/engine/{track,damage,spells,combat}.js, qa/engine/s07c-combat-v21.test.mjs (new), docs/specs/engine-api.md, docs/ARCHITECTURE.md, qa/rules/COVERAGE.md |
| 5161174 | Disrupt: legality, the trap, `engageOptions.disrupt`, `engagePreview` `stagger` and `disrupt`, the `disrupt` flag on the action and trapSprung events, the wind-up's `turn` on stagger and empower events. The s07b immune-target test is rewritten, and its preview and D52 play-outs now cover wind-ups and Disrupt | src/engine/{engage,track,damage}.js, src/rules.js, qa/engine/s07b-combat-v2.test.mjs, qa/engine/s07c-combat-v21.test.mjs, docs/specs/engine-api.md, docs/ARCHITECTURE.md, qa/rules/COVERAGE.md |
| (this commit) | "Engine: combat v2.1 implemented": determinism and full-run tests; rules.md status and the engine's clarifications (7.11, 7.12, marked "(combat v2.1, engine)"); this note | qa/engine/s07c-combat-v21.test.mjs, docs/specs/rules.md, docs/handoffs/engineer-2026-11-10g.md |

No src/ui/, sim/ or src/content/ file was changed.

## Rules and tests (qa/engine/s07c-combat-v21.test.mjs unless named)
Each rule's test was mutation-checked: the rule was reverted in a scratch copy, the tests were run, and the copy was
restored. Every one of the 26 mutations made at least one test fail.

| Rule | Behaviour | Tests |
|---|---|---|
| 7.12 wind-up flags | `windup` and `cast` appear only on SIGNATURE_TURN (elite, rare, dungeon boss) and a dungeon boss's SIGNATURE_TURN_2, over turns 1-8; normal enemies and adds have none. The pct takes the multiplier of the ability's own flag only: Heavy Blow × HEAVY_SCRIPT_MULT, Dark Cast × CAST_SCRIPT_MULT, Cleave × 1. The intent copies `windup` | "signature entries are wind-ups ..." |
| 7.7 | An interrupt (Throat Jab on an elite's heavy wind-up), a stun-tagged spell on a dungeon boss (Temple Blow on both wind-ups), or control landing mid-round (Hexbind) stops a wind-up. Its cooldown starts and the enemy is OFF_BALANCE. Autoplay rule 3 interrupts it | "every interrupt, stun or control ..." |
| 7.12 answered, turn start | STUN, FROZEN, HEXED or SAPPED at the turn's start cancels the wind-up (OFF_BALANCE, STAGGERED, `why: 'control'`); so does a Lay Trap (`why: 'trap'`). A wind-up that becomes now while SILENCED is replaced by the basic attack and staggered (`why: 'silenced'`), without OFF_BALANCE | "answered at the turn's start ..." |
| 7.12 answered, avoided | A heavy wind-up that costs the player 0 HP is answered (`why: 'avoided'`): a miss, a full WARD, or the pet by TAUNT (even when the pet loses HP). A Dark Cast (not heavy) that misses or is fully warded is neither | "answered: a heavy wind-up ..." |
| 7.12 landed | Landed: a hit on the player; a hit on the pet by its own aggro draw; a Rend; Cleave, Curse and Shield even when a WARD takes it all; Self Heal below 70 %. A dungeon boss stacks two | "landed: ..." |
| 7.12 neither | Neither: Self Heal while not wounded (replaced; `replaced.windup`), Chrono Sigil | "neither: ..." |
| 7.2 step 2 | Hits and the shown estimates are × (1 + EMPOWER_DMG × e − STAGGER_DMG × s), for e EMPOWERED and s STAGGERED stacks, over five stack mixes | "EMPOWERED and STAGGERED are the enemy's attacker modifiers ..." |
| 7.4 | The stack statuses stay through 9 more rounds, interrupts and the player's dispersal. They are gone with the fight: in full runs every fight starts without them | "the stacks are enemy statuses ...", full runs |
| 7.10 Disrupt | All three classes on a dungeon boss: action `disrupt: true`; TRAP `{ turn: 2, stun: 1, disrupt: true }`; no SAPPED or FROZEN; D52 predicts `{ by: 'TRAP', stagger: true }`. At round 3 the Dark Cast is cancelled (OFF_BALANCE OFFBAL_DURATION − 1, STAGGERED `why: 'disrupt'`). The boss skips that round only and plays turn 3. The second wind-up still needs its own answer. Sap keeps STEALTH | "on a dungeon boss every class's control option is Disrupt ..." |
| 7.10 legality and lists | Disrupt is legal only on a visible wind-up in the engage round; otherwise it is illegal, with a reason. `legalActions`, `engageOptions.disrupt` and `engagePreview` list it. Rule E Disrupts the boss when it has an add; alone it uses the strike option. The Rogue's rule E is always Ambush | "Disrupt is legal only ..."; s07b "control options on an enemy immune to control ...", "engagePreview ..." (6 new wind-up and Disrupt cases checked against play) |
| 7.11 (D52) | `cancel.stagger === !!windup` for every predicted cancel. Predictions for wind-ups and Disrupt are checked against play: each class's control option on an elite, and Disrupt on a dungeon boss | "a wind-up entry's predicted cancel ..."; s07b "control statuses by their rounds left ..." (now with elites and dungeon bosses) |
| 7.10 setup (D57) | Premeditate gives CP_MAX (5): Temple Blow's STUN stunMax cancels the turn-2 wind-up and turn 3. Each of GATHER_SPELLS gathered spells crits on a draw of 0.99 | "Premeditate ...", "Gathered Power ..." |
| 13 | Every combat v2.1 constant equals the table | s13 "every constant of the table ..." |
| Determinism | The same actions give the same state through Disrupt and the stacks, with serialize/deserialize every step of a dungeon-boss fight. A full real-content run with Disrupt replays from its action log to the same state | "same seed + same actions ..." |
| Full runs | 60 runs: 3 classes × 2 map modes × fixture and real content × 5 seeds, three with autoAction and two with a policy that Disrupts every dungeon boss. All end. After every step: results only on elites, rares and dungeon bosses, on the signature turns, one per wind-up, stacks equal to events. Totals: 41 answered (interrupt, Disrupt, avoided, silenced), 45 landed, 21 Disrupts | "full autoplay runs per class ..." |

## Measured against the designer's prototype (same seeds, same bots, scratch output outside the repo)
- Both arms run main's simulator on the same engine base: the prototype's scratch is main 8507303 plus the patch, and
  src/ and sim/ are unchanged from 8507303 to b71fcc3. Arguments: P0, 300 runs per class, seeds 1000-1299, the
  designer's risk table (sim/out/combat21/obs-P0.json in the designer worktree), `--profile fresh --warmup 0`, masher
  with `--replay`. [source: /tmp/v21sim/out-eng, read with the designer's sim/out/combat21/an.mjs]

| | Planner reach R / M / H (all) | Masher reach R / M / H (all) | Planner − masher | Deaths per 1 000 fights, planner (elite / dungeon boss) | Runs identical to the designer's |
|---|---|---|---|---|---|
| designer's v2.1 arm K (prototype) | 80.3 / 87.0 / 77.3 (81.6) | 62.0 / 84.3 / 48.0 (64.8) | +16.8 pp | 4.29 (24.9 / 46.4) | - |
| this engine | 80.3 / 87.0 / 77.0 (81.4) | 61.7 / 84.3 / 48.7 (64.9) | +16.6 pp (13.2 - 19.9) | 4.32 (24.9 / 47.1) | planner 882 / 900, masher 869 / 900 (reach differs in 1 and 3 runs) |
| this engine with the prototype's hit rule (scratch only) | 80.3 / 87.0 / 77.3 | 62.0 / 84.3 / 48.0 | +16.8 pp | - | 900 / 900 and 900 / 900 |

- Window counts are equal: 37.7 used per 100 fights for the planner and 3.9 for the masher. So are the planner's median
  rounds (6 / 7 / 9 / 41) and combat minutes (26.2).
- The opener (B48) was not run. Its D59 beam fix is the Simulation Engineer's task.
- Throughput (B37), planner, 150 runs per class on one worker, run back to back: base b71fcc3 27.8 ms per run, this
  engine 30.4 ms per run. Part of the difference comes from the runs themselves, which differ (the Rogue reaches the boss
  more often).

## Decisions where the spec left a choice, and deviations from the prototype (please confirm)
1. **The hit rule follows rules.md 7.12, not the prototype.** The engine: a heavy wind-up that costs the player 0 HP is
   answered; a hit or rend that costs the player or the pet HP is landed; anything else is neither. The prototype
   staggered every wind-up hit that cost the player 0 HP, heavy or not, and empowered every hit aimed at the pet by its
   own aggro draw, even a miss. Two cases differ:
   - a Dark Cast that misses or is fully warded is neither here (the prototype: answered);
   - a hit on the pet by its own aggro that misses is neither here (the prototype: landed).

   Effect on these seeds: planner −0.2 pp and masher +0.1 pp. 18 planner and 31 masher runs differ.
   If the designer wants the prototype's rule, it is a two-line change in combat.js `enemyAct`, and the 7.12 text
   changes with it.
2. **A wind-up whose hit kills the player (no resurrect) gives no stack and no `empower` event.** The fight is over, as
   in the prototype. For B55 the recorder can count it from the death: `s.death.killer.ability` is the wind-up's id.
3. **Chrono Sigil and a summon that takes the turn: neither.** The spec's answered list names neither; the prototype did
   the same. This is now explicit in rules.md 7.12 ("(combat v2.1, engine)").
4. **Disrupt's STUN covers exactly one turn, whatever TRAP_STUN is.** The spec says "STUN for that one turn, which cancels
   only that entry". Today TRAP_STUN is 1 too, so the two are equal.
5. **CAST_SCRIPT_MULT also scaled scripted heals:** Mend on turn 3 healed 0.25 × 1.5 = 37.5 %, and a Self Heal wind-up
   0.18 × 1.5 = 27 % of max HP. Rules 7.12 said this ("a cast action's pct"), and the prototype measured it.
   **Changed by D60** (Lead): the script multipliers now apply to scripted damage only (hit, rend, cleave). Mend,
   Bolster, Self Heal and Self Shield keep their pct. Decisions 1-4 and 6 stand as implemented. See the D60 addendum
   below.
6. **The "later scripted entry" cooldown rule (rules 7.11) can no longer bind at the defaults.** A dungeon boss's turns 1-4
   are all scripted (SIGNATURE_TURN_2 4 = OPENING_TURNS + 1). The s07b test now checks turn 5 and states this.
7. **Autoplay never Disrupts with the real content.** Every dungeon-boss fight starts with the boss alone (nodes.js), no
   real-content dungeon boss summons, and rule E needs 2 enemies (open choice 9, default "no"). The designer's autoplay
   numbers have the same property. Only manual players and the bots Disrupt.
8. **`engagePreview.stagger` lists the cancelled wind-ups only.** Send the Pet also answers a heavy wind-up that the pet
   takes by TAUNT (7.13 (3)). The preview shows that turn under `pet`, as it never listed Send the Pet's OFF_BALANCE
   either (engine-api.md says so).

## For the UI Engineer (combat-v2.md 10 item 9; nothing changed in src/ui/)
- **Wind-up badge**: track entries and the intent carry `windup: true`. A wind-up always has `cast: true`. Keep `heavy` to
  list the extra answers of a heavy one: a full dodge, WARD, Mirrorshade or the pet by TAUNT.
- **The predicted cancel**: it now has `stagger`, which means the cancel answers the wind-up.
- **Cancelled or replaced intents**: `intent.cancelled.windup` and `intent.replaced.windup` mark a wind-up that will not
  happen.
- **Frame badges**: enemy statuses `EMPOWERED` and `STAGGERED`, each `{ stacks, value }`, with `value` the damage dealt
  more or less ("+15 % damage", "-30 % damage"). The bridge's `statuses()` passes them through today (rounds 99), but
  `TXT.STATUS_INFO` has no entry for them yet.
- **Log lines**:
  - `stagger` `{ u, id, name, turn, why, by, stacks, value }`: "Wind-up answered: staggered". `why` is one of
    interrupt, control, trap, disrupt, silenced, avoided.
  - `empower` `{ u, id, name, turn, stacks, value }`: "Wind-up landed: empowered".
  - The bridge ignores both today (its default case), so nothing breaks before you add them.
- **Disrupt label**:
  - `engageOptions(...)[i].disrupt` holds the targets on which the control option is Disrupt; label it there.
  - `engagePreview` items have `stagger` (turns) and `disrupt` (boolean).
  - The ENGAGE `action` event and `trapSprung` carry `disrupt: true`.
  - The boss's TRAP status has `disrupt: true`.

## For the Simulation Engineer
- **Recorder (B55)**: count `stagger` and `empower` events by fight kind. Their `why` gives the kind of answer; their
  `turn` is the wind-up's turn: SIGNATURE_TURN, or SIGNATURE_TURN_2 for a dungeon boss. A wind-up that kills the player
  sends no event (Decision 2).
- **Opener (D59)**: the boss's wind-up intent is a `cast` (the beam's candidate rule). Disrupt comes through
  `legalActions` as the class's control ENGAGE on the boss; `engageOptions(s)` lists it under `disrupt`.
- **Tuning**: EMPOWER_DMG and STAGGER_DMG are the levers (src/constants.js; rules.md 13 and combat-v2.md 15 hold the
  values).
- **Params**: sim params were not changed, and qa/sim passes 65/65. No suite failure comes from sim params.
- **Reproduce the comparison above**: run `node sim/run.mjs --bot planner --class all --runs 300 --seed-start 1000
  --profile fresh --warmup 0 --risk-in <designer>/sim/out/combat21/obs-P0.json --workers 2 --out /tmp/v21sim/out-eng`,
  then the same with `--bot masher --replay`. Read the result with
  `cd <designer>/sim/out/combat21 && node an.mjs K=out-K eng=/tmp/v21sim/out-eng`.

## For QA
- The designer's QA list is covered:
  - a wind-up interrupted on a dungeon boss staggers it (s07c "every interrupt, stun or control ...");
  - Disrupt is illegal without a visible wind-up (s07c "Disrupt is legal only ...", s07b "control options on an enemy
    immune to control ...");
  - stacks last to the fight's end and are gone after it (s07c "the stacks are enemy statuses ...", and the full-run
    invariants).
- UI regression on this build (`node tools/build.mjs --out /tmp/eng-game.html`), 1366x768, parts A, D and H: 38/38 pass.
  Parts B, C, E, F, G and I were not run.

## How to test
```
node --test qa/engine/     # 305 pass (s07c: 15 new)
node --test qa/rules/      # 56 pass
node --test qa/docs/       # 3 pass
node --test qa/sim/        # 65 pass
node tools/build.mjs --out /tmp/eng-game.html    # 54 modules, 1 336 KB
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/eng-game.html --sizes 1366x768 --parts A,D,H
```

## Known issues
- **The engine's default policy dies early.** Its runs (the default out-of-combat policy) mostly die before level 20,
  on main before this work too: on 30 real-content seeds per class at b71fcc3, 21, 25 and 13 runs of 30 died before
  level 20 for the Rogue, Mage and Hunter. It is not a balance measure; the simulator's bots are. It does mean that
  autoplay-only health runs see few dungeon bosses, so the full-run test adds a Disrupt policy.
- **B48 and B51 still fail on the designer's evidence**; that is open choices 4 and 5 (designer and sim).

## Addendum: D60 (commit "Engine: combat v2.1 D60 ...")
- **What changed**: HEAVY_SCRIPT_MULT and CAST_SCRIPT_MULT now multiply the pct of scripted damaging actions only (hit,
  rend, cleave) (src/engine/track.js `entryOf`). A scripted heal or shield keeps its pct: Mend on a mender's turn 3
  heals 25 %, and a Self Heal wind-up heals 18 %. Bolster and Self Shield had no multiplier before either.
- **Docs**: rules.md 7.12 (the script paragraph and the wind-up paragraph) and the 13 table descriptions say so. The
  values stay 1.5. combat-v2.md 15 (the designer's file) still describes them as "× the action's pct"; the designer may
  want to align it.
- **Tests**: s07b "scripted heavy and cast actions ... damage only" checks the mender's Bolster and Mend pct and the
  shown Mend estimate. s07c "landed ..." checks that the Self Heal wind-up has pct 0.18 and heals exactly 18 %; s07c
  flags shows a Shield wind-up at × 1. Both tests fail with the old rule.
- **Suites**: qa/engine 305, qa/rules 56, qa/docs 3 and qa/sim 65 pass.
- **Measured effect**, same seeds, bots and risk table as above (scratch /tmp/v21sim/out-d60):

| | Planner reach R / M / H (all) | Masher reach R / M / H (all) | Planner − masher | Deaths per 1 000 fights, planner (elite / dungeon boss) | Masher (elite / dungeon boss) |
|---|---|---|---|---|---|
| before D60 | 80.3 / 87.0 / 77.0 (81.4) | 61.7 / 84.3 / 48.7 (64.9) | +16.6 pp | 4.32 (24.9 / 47.1) | 8.99 (73.0 / 128.3) |
| D60 | 80.3 / 87.3 / 79.7 (82.4) | 62.7 / 85.0 / 55.0 (67.6) | +14.9 pp (11.7 - 18.1) | 4.05 (25.4 / 40.2) | 8.15 (73.0 / 104.6) |

  The dungeon bosses whose second wind-up is a Self Heal heal less, and so do menders. The masher gains more than the
  planner: its Hunter rises +6.3 pp, against +2.7 pp for the planner's. B49 still passes (gap at least 8 pp).
  [inference: from the dungeon-boss deaths, which fall most] The gain is mostly in the fights against the two
  real-content dungeon bosses whose second wind-up is a Self Heal (zones 2 and 4). It is not broken down by fight here.
