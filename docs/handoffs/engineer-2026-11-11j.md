# M2b v13 in the engine, 2026-11-11 (Core Gameplay Engineer)

Task: docs/specs/changes-m2b-v13.md rows 1-6 (D105-D109; owner go-ahead 21:26, O11-O13 on their defaults), the views the
UI list needs, the specs folded with "(M2b v13)". Added by the Lead mid-task: the v12 Ricochet gate passed
(docs/reports/balance-2026-11-11h.md), so RICOCHET_BOUNCE_FRAC is 0.30 (separate commit). Not in it: B59-B62 (sim and
balance only), sim/, game.html, the full Deathblow UI (separate UI task). Status: draft, as the change doc.

## 1. What changed
| Row | Change | Where |
|---|---|---|
| 1 (D105) | **Deathblow**: the SIGNATURE_TURN wind-up of an elite, rare or dungeon boss gets `deathblow: true` (entry, intent, `cancelled`, `replaced`). Hit, rend, cleave: pct × **DEATHBLOW_MULT 2.0** on top of HEAVY/CAST_SCRIPT_MULT (× 3.0 of the ability), so `est` shows it. Curse, self_heal, self_shield Deathblows keep their pct (reading 1). The dungeon boss's SIGNATURE_TURN_2 wind-up is not one | track.js `makeEntry` |
| 2 (D106) | EMPOWERED and STAGGERED `value` = **sum of the stacks' values**; a landed Deathblow's stack is **DEATHBLOW_EMPOWER 1.00**, others EMPOWER_DMG / STAGGER_DMG. New status fields `deathblows`, `deathblowValue` (the "+100 %" part). `empower` and `stagger` events carry `deathblow: true` | damage.js `windupStack`, `landWindup`, `answerWindup` |
| 3 (D107) | **MAIMED** (player; dur null, value **MAIM_HEAL 0.50**, `by`, `src`, `name`): a landed Deathblow adds it once per fight (`empower.maimed` true when it did). `healUnit` cuts every heal on the player × (1 - value) before the cap, rounded once; the heal event gets `maimed: true`. Not in DEBUFFS: dispersal, Purifying Tonic and a resurrect keep it; gone with the fight. `potionInfo.heal` is the cut amount, new field `maim` | damage.js `maimedHeal`, `healUnit`; rules.js `potionInfo` |
| 4 (D108) | **Autoplay rule E2** before rule E: the class's control option on the first living elite, rare or dungeon boss (index order) whose track shows a wind-up in turns 1..INTENT_TRACK_LEN, if legal (Disrupt on a dungeon boss; lone enemies included; the Rogue may Sap here; rule E keeps D49) | autoplay.js `engageAnswer` |
| 5 (D109, gated) | **RARE_HP_MULT_Z1 3.0** for a rare whose fight is in zone 1 (both maps), only while `C.GATES.rareHpMultZ1` is true. **Default: off** (the spec applies it only through cell 6's gate) | combat.js `makeEnemy`; constants.js |
| 6 (D109, gated) | `state.met` (new run field; normal templates of every fight but grind, trash, Camp, Dimmed, boss, recorded at fight start whatever the switch). With `C.GATES.firstMeetWindup` true, in a quest fight a normal enemy whose template was not met at the fight's start gets `firstMeet: true` and its turn-2 (SIGNATURE_TURN) scripted entry becomes a wind-up (`windup`, `cast`, `firstMeet`; pct unchanged; EMPOWER_DMG / STAGGER_DMG, never Deathblow or MAIMED). **Default: off** (cell 7 decides) | combat.js `meetEnemies`; track.js; nodes.js |
| Views | `windupView(state)` (every wind-up with Deathblow flag, est, stakes, answers, `ready`), `autoplayEngage(state)` (the E2 hint), map `deathblow` on elite nodes and `bossDeathblow` on dungeon nodes (`deathblowOf` in track.js) | new src/engine/answers.js; rules.js; expedition.js `details` |
| UI | ui-text.js: STATUS_INFO `MAIMED` and its tooltip line from `value` (otherwise the new player status had no text). EMPOWERED already renders `value`, so "+100 %" shows | src/ui/ui-text.js |
| Ricochet | RICOCHET_BOUNCE_FRAC 0.4 -> **0.3** (gate passed); RICOCHET_BOUNCE_FRAC_GATED stays 0.3 so the sim's `--ricochet-gated` arm still works; rules 5.6 "at 30 %", 13; tests s05, s13, s01f | commit fe8dc44 |
| Docs | rules.md status, 2.3, 7.2, 7.4 (MAIMED row), 7.5, 7.9 (E2), 7.12 (Deathblow, first meeting), 13; combat-v2.md status, 4.1, 8, 10 (item 10), 12, 14, 15, new 17; engine-api.md 1, 4, 5, 6, new 6.2, 8, 10.3; ARCHITECTURE.md rows (answers.js new) | |

Commits: fe8dc44 (Ricochet), 0555a8c (v13 code, tests, specs), this hand-off.

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **423/423**. New s07d-v13 (13 tests): Deathblow flags and × DEATHBLOW_MULT (est too; heals/shields/curses keep pct; dboss turn 4 and normals none); landed: DEATHBLOW_EMPOWER, MAIMED status and event fields, later estimates × 2; one MAIMED per fight; answered: STAGGERED, no MAIMED (interrupt, full WARD); MAIMED halves a Healing Draught (potionInfo equals the heal event) and a HOT tick, Purifying Tonic keeps it, next fight clean; E2 for every class on lone elites, rares, an elite with an add, Disrupt on a dungeon boss, not after the engage round; E2 answers cancel at turn 2 with STAGGERED; gates off by default and armed (zone-1 rare HP ratio, other zones and elites untouched; first meeting wind-up, EMPOWER_DMG, met list, no repeat, elite adds not first-met); windupView, autoplayEngage, map fields (both maps, real content); 4 full autoplay runs. s13: the v13 constants table (rows 1-3 "New", gated rows 5-6 Old/New, `GATES` off). Changed for v13: s07c (signature pct × DEATHBLOW_MULT, empower values, status fields, Disrupt test: E2 alone and with adds, rule E without a wind-up), s16 (`maim: 0`), s01c (real-content mage seed 1 -> 6: its autoplay run no longer reaches the Camp) |
| qa/rules | **56/56** |
| qa/docs | **3/3** |
| qa/sim | **117/118** (sim/ not edited). Fails: onebutton.test.mjs "a slot-1 talent of the slot-1 tree is spent whenever one is legal": `mage: 5 talent points` (needs 6 over seeds 47-56). One-button mages now die earlier (the package's purpose); passes on the pre-v13 engine. Needs more seeds or a lower count |
| ui-regress | parts A and E at 1366x768 on a build in /tmp/ui-game-v13.html: **37/37** |
| Speed | autoplay full runs 42-60 ms per run (40 runs per class, real content, one process) |

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/ && node --test qa/sim/
node --test qa/engine/s07d-v13.test.mjs
node tools/build.mjs --out /tmp/ui-game.html && node qa/browser/ui-regress.mjs --file /tmp/ui-game.html --sizes 1366x768 --parts A,E
```

## 3. Engine readings (designer or Lead to confirm; each is one place to change)
1. **Non-damaging Deathblows.** "Exact behaviour" row 1 can be read as "deathblow only if it deals damage"; the change table (row 1 "heals, shields and curses keep their pct", row 2 "Self Shield, Self Heal and Curse Deathblows ... carry their weight through this row and row 3") says they are Deathblows. Built: they are (flag, DEATHBLOW_EMPOWER, MAIMED), without the multiplier.
2. **Rogue E2 on a lone special enemy.** Sap cancels turn 1, then autoplay's rules 1-6 hit the only target in round 2, which breaks Sap; the Deathblow (turn 2, round 3) is then answered only by rule 3 (Throat Jab from level 6, Temple Blow). Traced on seeds 5001 and 5008 (Throat Jab answered it). Below level 6 a lone elite's Deathblow lands after a Rogue E2 Sap. Built as the spec says (its numbers were measured that way, pooled). Possible fix if the sim's per-class B61 shows it: autoplay holds damage on a lone sapped special enemy until its wind-up turn has passed. Mage (FROZEN), Hunter (trap) and Disrupt hold.
3. **Who is "met".** Every fight kind except grind, trash, Camp, Dimmed and boss records its normal templates (so an elite's add or a treasure guard is met without a first-meeting wind-up); the wind-up is quest fights only. Turn 2 is SIGNATURE_TURN.
4. **Map Deathblow and hidden elites.** An elite's `deathblow` is shown only when its name is (classic map: rares need Scout's Eye; expedition: never, D50, since a rare's ability would identify it). So expedition elites show no Deathblow before the fight; the dungeon boss's always shows. Designer: show at least `type` (heavy or cast) for hidden elites?
5. **windupView answers** are availability, not a simulation: engage answers from `engagePreview` (cancels the wind-up's turn, or a heavy single hit to the pet); bar spells by tag (interrupt, stun, Hexbind; defensives for heavy ones) when their cooldown is over by the wind-up's round; `now` only in its own round (`castError`); resources for later rounds and control cast in earlier rounds are not predicted.
6. **STATE_VERSION unchanged.** `met` is new; a saved run without it starts recording at its next fight (only the gated row 6 reads it).

## 4. For the Simulation & Balance Engineer (sim/ not edited)
- The engine is the v13 package (rows 1-4) by default; rows 5-6 are off. Arm them as the Ricochet arm, in every process before a run: `C.GATES.rareHpMultZ1 = true` (cell 6), `C.GATES.firstMeetWindup = true` (cell 7); set both back to false for other cells (a worker plays several cells).
- Recorder fields: `empower.deathblow`, `empower.maimed`, `stagger.deathblow`, `heal.maimed`; MAIMED status events (`u: 'player'`); enemy `firstMeet`; entries `deathblow` / `firstMeet`. EMPOWERED / STAGGERED `value` is now a sum (not stacks × a constant).
- Bots on autoplay (planner, greedy, speedrunner, opener after its plan, tactician continuations) get E2 through `autoAction`; the onebutton and masher bots pick the strike option in the engage round and never a control option (the masher calls `autoAction` only when its basic attack is illegal), so they meet every Deathblow unless a later interrupt or a miss stops it.
- qa/sim onebutton talent test: see section 2.
- Classic runs change by design (every special fight, and autoplay's engage round in them).
