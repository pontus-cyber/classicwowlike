# Hand-off: Core Gameplay Engineer, 2026-11-11c (M2b v6 tuning: engine side)

Task: the engine rows of docs/specs/changes-m2b-v6.md (1, 2 and 5-8; decisions D62, D64-D66), with one commit and one
test per row. Rows 3 and 4 (PLANNER_HOUR_MULT 3, B56) are the Simulation Engineer's (d890fc4). Status: draft, as the
spec (owner-review items in docs/handoffs/designer-2026-11-11.md).

## What changed
| Row | Change | Where |
|---|---|---|
| 1 | ASC_PER_STEP 0.04 -> 0.02. heatView's ascIfPar follows, so the meter shows 2 % steps | src/constants.js |
| 2 | HEAT_RARITY_UP hot / scorched 0.25 / 0.40 -> 0.50 / 0.70. The UI texts read "1 in 2" and "7 in 10" from the constant | src/constants.js |
| 5 | BOSS_HP 13900 -> 13066. New BOSS_DMG_MULT 1.17: every damage an enemy of the end-boss fight deals is × BOSS_DMG_MULT × (1 + asc), also at Ascendancy 0. Where (1 + asc) was applied: the snapshot (`bossDmgFactor`, damage.js) and the Brand tick (combat.js). Intent estimates and the DoT preview use the same code. Shard HP stays SHARD_HP × (1 + asc). Dungeon bosses, Camp waves and Dimmed encounters are unchanged | src/constants.js, src/engine/damage.js, src/engine/combat.js |
| 6 | CLASS.rogue hpBase / hpPerLevel 70 / 20 -> 100 / 21 | src/constants.js |
| 7 | SAP_TURNS 3 -> 4. The UI's Sap texts read ENGAGE_OPTION.sap.turns ("four turns") | src/constants.js |
| 8 | Packed Satchel's free potion (rules 7.5, below). META vigor.hpPct and edge.powerPct 0.01 -> 0.005 | src/constants.js, src/engine/combat.js, src/engine/spells.js, src/rules.js |
| UI | The free-potion display, the log line and the Packed Satchel card text (below) | src/ui/{engine-bridge,hud,director,ui-text}.js, src/ui/style.css |

### The free potion (rules 7.5)
- **State.** `fight.p.freePotion` is set at fight start from `s.meta.satchel`.
- **Rule.** `combat.js isFreePotion(s, a)` is true for a `USE_ITEM` of an item with the potion flag while the fight's
  free potion is unused and the player's action is not skipped.
- **What happens.** `resolveRound` then resolves it through `playerAction` (its effect, POTION_CD from this round,
  STEALTH removed, Arcane Momentum reset, `potionsUsed` + 1). It marks the free potion used and returns:
  - no pet action, no enemy actions and no end of round;
  - no `round` or `intent` events;
  - `fight.round`, `stats.rounds` and `stats.bossRounds` stay.
- **Next action.** `legalActions` is unchanged: the potion is on cooldown, and in round 1 the engage options stay legal.
  `autoAction` runs its policy again on the new state.
- **Event and flag.** The item event is `{ t: 'action', kind: 'item', item, free: true }`. `R.freePotion(state)` is the
  exported flag the UI reads.
- **UI.** While the flag is true, the potions on the item bar show a "Free" tag (bottom left). Their aria-label and
  tooltip say "Free action (Packed Satchel)". The bridge passes `legal.items[].free` and the event's `free`. The log
  shows "You use Healing Draught." then "Free action (Packed Satchel).", with a "Free action" float on the hero.
- **Hall of Echoes.** The Packed Satchel card reads "Start with 3 Healing Draughts; first potion each fight is free",
  and its tooltip explains it. The next-run line is unchanged ("3 Healing Draughts in your bags").

## Commits (all on main)
| Commit | What | Files |
|---|---|---|
| 92dbb55 | Row 1, ASC_PER_STEP 0.02 | src/constants.js, qa/engine/s00-s01-structure.test.mjs, qa/engine/s10-boss.test.mjs, qa/rules/r10-boss.test.mjs, docs/specs/engine-api.md |
| 30dce6b | Row 2, HEAT_RARITY_UP 0.50 / 0.70 | src/constants.js, qa/engine/s01c-heat.test.mjs, docs/specs/engine-api.md |
| ff53f29 | Row 5, BOSS_HP 13066 and BOSS_DMG_MULT 1.17 | src/constants.js, src/engine/damage.js, src/engine/combat.js, qa/engine/s10-boss.test.mjs, docs/specs/engine-api.md, docs/ARCHITECTURE.md |
| a526cb6 | Row 6, Rogue HP 100 / 21 | src/constants.js, qa/engine/s03-s04-character.test.mjs |
| 31c4903 | Row 7, SAP_TURNS 4 | src/constants.js, qa/engine/s07b-combat-v2.test.mjs, docs/specs/engine-api.md |
| 09bf5e9 | Row 8, free potion; Vigor and Edge 0.005 | src/constants.js, src/engine/combat.js, src/engine/spells.js, src/rules.js, qa/engine/s16-free-potion.test.mjs (new), qa/engine/s11-s12-meta-content.test.mjs, docs/specs/engine-api.md, docs/ARCHITECTURE.md |
| 940f128 | UI: the free mark, the log line, the Satchel text; the Vigor check in ui-regress part F | src/ui/{director,engine-bridge,hud,ui-text}.js, src/ui/style.css, qa/browser/ui-regress.mjs |
| (this commit) | This note | docs/handoffs/engineer-2026-11-11c.md |

Not changed: sim/, src/content/, docs/specs/rules.md, balance.md, expedition.md, changes-m2b-v6.md and game.html.

## Tests
Each row's test fails if its change is reverted. For row 5 and the free potion this was checked by taking the code out
temporarily:
- Row 5 without the multiply: 2 tests fail.
- Free potion without the round stop: 7 of 9 tests fail.

| Row | Test |
|---|---|
| 1 | s00 "1.7 Ascendancy: 0.02 per full 10 h", up to the cap at par + 200 h. The boss HP tests at Ascendancy 0.06 and 0.08. The QA Litany ratio is 1.1 at 50 h over the par |
| 2 | s01c: the table value, and the step share of the 3 200 items rolled Hot is 0.50 ± 0.04 |
| 5 | s10, 4 new tests. HP at Ascendancy 0 and 0.10. Oruvath's snapshot, a landed Umbral Strike (variance 1, armor) and its intent estimate at Ascendancy 0 and 0.10. A Shard's snapshot. The Brand tick and its DoT preview. No factor on a dungeon boss or a Camp wave. The old Litany test now expects the factor; it passed before only through its ±10 % window |
| 6 | s03: the class values, and the Rogue's max HP at levels 1, 20 and 60 by rules 4.1 |
| 7 | s07b Sap: cancelled on turns 1-4, the enemy acts on turn 5. The engagePreview test now plays SAP_TURNS turns. It compares OFF_BALANCE and STAGGERED only on the turns the track shows (1-3): the preview cannot see an entry for turn 4 in the engage round |
| 8 | s16-free-potion.test.mjs, 9 tests: <br>1. The free potion's events, the round, counters, cooldown and legal actions; the next action plays the round. <br>2. Once per fight; a new fight has its own; a Mana Draught counts as a potion. <br>3. Never free without the unlock, nor Tonic or Flask (those keep the free potion unused). <br>4. STEALTH removed and Arcane Momentum reset. <br>5. The engage options stay legal in round 1. <br>6. The end-boss fight: no boss action, no Brand tick, bossRounds unchanged. <br>7. Not while the action is skipped. <br>8. Autoplay drinks it and picks again in the same round; full autoplay runs of all 3 classes with the unlock end, with at most one free potion per fight. <br>9. Vigor and Edge 0.005: four ranks give +2 % max HP and Power. <br>Also in s11: the meta budget is now +0.02 |

## How it was checked
- **Test suites:**

  | Suite | Result |
  |---|---|
  | qa/engine | 350/350 (336 before, plus 14 new) |
  | qa/rules | 56/56 |
  | qa/docs | 3/3 |
  | qa/sim | 83/83, on the Sim Engineer's d890fc4 (PLANNER_HOUR_MULT 3 and B56); its params test passes, nothing lags |

  The constants test (s13: the rules 13 table and the 5.1 class table) passes against the spec.
- **Build:** `node tools/build.mjs --out /tmp/v6-game.html` gives 56 modules, 1 503 KB.
- **Browser, parts A, F and L at 1366x768:** `NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/v6-game.html --parts A,F,L --sizes 1366x768`
  passed 61/61 with no console errors. This covers:
  - key 8 without the unlock (the round advances);
  - the Vigor "+0.5 %" text;
  - the Satchel card and its purchase line;
  - the potion pulse.
- **Free-potion page check** (scratch script /tmp/v6chk/free.mjs, not committed): a dev fight with Packed Satchel, loaded
  into the page at 1366x768 and 1920x1080:
  - Slot 8 shows "Free", and its aria-label and tooltip say "Free action (Packed Satchel)".
  - After key 8 the round stays 2, the potion cooldown shows 4, the tag is gone, and the log reads "You use Healing
    Draught." / "Free action (Packed Satchel)." / the heal.
  - Key A then plays round 2 (round 3 follows).
  - No console errors. Screenshots: /tmp/v6chk/*-free-before.png, *-free-after.png.
- **Speed** (qa/engine/bench.mjs, 200 runs per class): src/content `stepInPlace` 16 043 runs/min, `step` 4 114 runs/min.

The full ui-regress (parts B-E, G-K and both sizes) was not run. The Lead's build run should include it.

## Notes and questions (defaults taken)
1. **Rogue HP example numbers.** The change doc's row-6 example (level 1: 121 HP, level 20: 520, level 60: 1 360)
   computes hpBase + hpPerLevel × L. Rules 4.1 uses (L - 1), so the engine gives 100, 499 and 1 339 before STA and items
   (was 70, 450 and 1 250). The constants are as the spec. The designer measured on the real engine, so the measurement
   stands. Only the example line in changes-m2b-v6.md is off by one level (Designer's file).
2. **engagePreview for Sap** lists cancelled turns 1..SAP_TURNS (now 4). In the engage round the track shows turns 1-3,
   so the UI marks three entries; the hint text says four turns. `offBalance` and `stagger` cannot name turn 4, because
   its entry is not drawn yet. engine-api.md says so.
3. **Dev tool `refill`** resets the potion cooldown but not a used free potion: it is not a cooldown. Say if the Dev menu
   should restore it.
4. **Saved states.** A fight saved before this build has no `fight.p.freePotion` field, so it has no free potion; the
   next fight has one. STATE_VERSION stays 2.
5. **Float order.** BOSS_DMG_MULT is applied as `x × (BOSS_DMG_MULT × (1 + asc))`, as the spec's formula. The designer's
   scratch engine stored `(1 + asc) × 1.17 - 1` in `asc`. Rounding can differ in the last bit, so the sim's numbers may
   not match the designer's run for run; the difference is negligible in aggregate.
