# Spec changes M2b v8 (M2b task 2b.7, tuning pass, second part)

Owner: Lead Game Designer, 2026-11-11. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), UI/UX Engineer, QA. **Status: draft.** Proposed decisions D72-D77 (team) for the Lead to log; owner decisions in section "Owner decisions"; hand-off docs/handoffs/designer-2026-11-11c.md.

Input: the full pass on M2b v6, P1 33 of 52 [source: docs/reports/balance-2026-11-11b.md, docs/handoffs/sim-2026-11-11b.md], and its measured proposals (scratch copy sim/out/v6b/var/x of the sim worktree, environment switches X_EARLY, X_ZS, X_MHP, X_MHPL, X_BH, X_BD, X_FER, X_HIDE, X_FPBOSS, X_EHP). Every "measured" figure below is from that report's "P1 misses and measured proposals" table and its package line, planner P0 1 000 runs per class unless stated, paired by class and seed with the pass. The engine is now M2b v7 (time in tolls, a5468b5); v7 changed no balance (changes-m2b-v7.md, Summary 5), so the v6b measurements carry over [inference: v7 is a rename with an exact-equivalence proof for the line and the Dimming].

When the Engineer builds this package, every changed line in rules.md, balance.md and the constant tables is marked "(M2b v8)" in the same commit as the code.

Type: **number** = src/constants.js or a data-table value only; **mechanic** = engine code (exact behaviour below); **target** = a balance target or its definition.

## Problems this package addresses

| # | Problem | Now (pass 11-11b) | Target |
|---|---|---|---|
| 1 | Early zones too deadly, zone 6 too safe | B21 Z1-Z2 19.9 %; B38 Z6 87.7 %; B21 Z5-Z6 1.1 % | <= 12 %; Z6 <= 85 %; 2-8 % |
| 2 | Mage weakest class | B6 P0 spread 12.8 pp (mage 31.8 %); B6 PALL 8.8 pp (mage 71.5 %) | spread <= 8 pp, deviation <= 5 pp |
| 3 | End boss too easy for the planner and too long | B1 planner 40.0 %; B16 end boss 42 rounds; B30 270 Echoes per run | 20-35 %; 30-40 rounds; 150-260 |
| 4 | Hunter's weakest tree | B7 hunter 0.60 (Beastbond 26.7 %) | >= 0.6 with margin |
| 5 | The two survival trees decide the class split | Shadowcraft 43.5 % vs Venomcraft 37.6 %; Wildcraft 44.6 % vs Marksmanship 36.6 %; the default trees switched | trees of one class within the switch threshold (about 3 pp) |
| 6 | Packed Satchel's free potion inflates meta profiles | B2 P10 56.0 %; B3 PALL 77.0 %; B32 runs 1-5 55.1 %; B31 22 runs | 32-48 %; 55-75 %; 15-35 %; 25-40 |
| 7 | Run length | B11 55.1 min; B12 30.6 min; B53 26.7 min | not tuned here: see "Run length" |

## Change table (the package)

| # | Constant or rule (spec section) | Old | New | Target | Measured effect (report 2026-11-11b) or "unmeasured" | Type |
|---|---|---|---|---|---|---|
| 1 | EARLY_DMG_MULT, EARLY_DMG_MAX_LEVEL (new; rules 7.6 zone danger, 13) | none (× 1) | × 0.80 on the damage of every template enemy of level <= 20 | B21 Z1-Z2, B38 | Together with row 2 [X_EARLY 0.8, X_ZS 0.375]: B21 Z1-Z2 19.9 -> **11.4 %** (pass), Z3-Z4 5.5 -> 9.0 % (band 3-10, pass), Z5-Z6 1.1 -> 1.8 % (still short), B38 Z6 87.7 -> **84.8 %** (pass), end boss share of deaths 60.9 %; win +2.7 pp (0.9..4.4), mage -2.4 pp. A milder arm (× 0.85, step 0.3125) was run first and not taken | mechanic |
| 2 | ZONE_DANGER_STEP (rules 7.6, 13) | 0.25 | 0.375 | B38 Z6, B21 Z5-Z6 | measured with row 1 (above) | number |
| 3 | CLASS.mage.hpBase / hpPerLevel (rules 5.1) | 50 / 19.5 | 62 / 21.06 | B6 P0, B6 PALL | mage P0 +4.3 pp (2.2..6.5; 2 000 runs), reach +3.0 pp; mage PALL +5.4 pp (2.9..7.9) [X_MHP 1.24, X_MHPL 1.08] | number |
| 4 | BOSS_HP (rules 10.1, 13) | 13066 | 12282 (× 0.94) | B16 end boss | with row 5 at 1.30: end boss 40 rounds (pass) [X_BH 0.94] | number |
| 5 | BOSS_DMG_MULT (rules 10.1, 13) | 1.17 | **1.30** (ladder 1.32, 1.34: see below) | B1 planner, B30, B1 greedy and tactician | Alone with row 4: 1.24 -> win -2.2 pp, 1.30 -> win -9.5 pp (-11.2..-7.7) to 31.2 % (pass), mage 21.8 % (B6 spread 14.9 pp). Package with 1.27 (rows 1-4, no end-boss free potion): P0 41.7 % (rogue 44.5, mage 33.7, hunter 46.9), PALL 63.5 % with the PALL hunter at 52.4 %. **1.30 in the package: unmeasured** | number |
| 6 | Beastbond: TALENT.h_a2 Ferocity petDmgPct, TALENT.h_a1 Thick Hide petHpPct (rules 6.3) | 0.125 / 0.08 per rank | 0.15625 / 0.10 per rank (× 1.25; text "+15.6 %", "+10 %") | B7 hunter; B6 PALL (Beastbond is the PALL hunter's default tree) | Beastbond P0 +5.9 pp (3.7..8.0; 2 000 runs) -> B7 ratio 0.73 [X_FER, X_HIDE 1.25]. On the PALL hunter: unmeasured | number |
| 7 | Shadowcraft trim (rules 6.1): r_b9 Death's Sidestep heal; r_b7 Shroudwalk heal; r_b4 Veiled Recovery | 20 % max HP; 10 % /rank; 3 % per round /rank | 10 % max HP; 5 % /rank; 2 % per round /rank | B6 P0 and PALL, B1 planner, B16 | unmeasured | number |
| 8 | Wildcraft trim (rules 6.3): h_c1 Hardy; h_c4 Field Medic; h_c5 Survivalist | max HP +4 % /rank; Field Dressing +20 % /rank; +0.03 dodge /rank | +3 % /rank; +10 % /rank; +0.02 /rank | B6 P0, B1 planner, B7 hunter, B16 | unmeasured | number |
| 9 | FREE_POTION_MULT (new; rules 7.5, 11.2 satchel) | 1 (the free potion restores its full amount) | 0.5: the free potion (first potion each fight, once per fight, every fight) restores half its normal amount; it still costs no turn | B2 P10, B3 PALL, B32 runs 1-5, B31 | unmeasured. Bounds: removing the free potion in the end-boss fight measured P10 -6.4 pp (-8.2..-4.6), PALL -8.0 pp (-9.6..-6.3); outside the end boss the free potion was worth +0.6 pp PALL (changes-m2b-v6.md, "not taken"). Expected about half of the removal effect [inference: the turn saved stays, the heal halves] | mechanic |

Count: 9 rows; 6 number rows (talent rows 6-8 are data-table values), 2 mechanics with 3 new constants. Every value is inside TUNE_LIMIT 0.25 except ZONE_DANGER_STEP (+50 %), the Shadowcraft and Wildcraft trims (-33 to -50 %) and the new mechanics, which is why they are designer rows (balance.md 4). No content, spell, item, heat, time or meta-catalogue change. The rows map stays the sim's map.

### Row 5: why 1.30, and what the sim must confirm
- The boss factor is the steepest lever measured: 1.24 -> 1.30 moved the planner 7.3 pp [source: report, rows "BOSS_HP x 0.94 and BOSS_DMG_MULT 1.24 / 1.30"]. It is also the lever that hurts the Mage most (mage 21.8 % at 1.30 alone): above 1.30 the boss widens B6 faster than it fixes B1.
- In the package at 1.27 the P0 cell was 41.7 %, and the excess sits in the Rogue (44.5 %) and the Hunter (46.9 %), the two classes on the survival trees. Rows 7 and 8 take that excess off at its source; the boss factor only has to carry the rest. So: **1.30**, not higher, with rows 7 and 8.
- Expected package result [inference: measured effects added, not measured together]: planner P0 33-36 %, rogue about 36-38, mage about 30-31, hunter about 37-39; end boss 38-40 rounds.
- **Sim confirms (ladder):** run the package at 1.30. If planner P0 is above 35 % with every class inside B6, run 1.32, then 1.34, and stop at the first value with planner P0 <= 35 %. Do not go past 1.34 (TUNE_LIMIT from 1.30 would allow more, but the Mage falls fastest; report back instead). At the chosen value, check: B1 planner 30-35 % (aim 32-33), B6 P0 (mage deviation <= 5 pp), B16 end boss <= 40 rounds, B23 phase 1 losses <= 25 %, B29 Final Dark 5-20 %, B30 <= 260.

### Rows 7 and 8: the switched default trees
The default trees switched by the pass's rule (balance.md 1.3): Rogue Venomcraft -> Shadowcraft (+5.8 pp), Hunter Marksmanship -> Wildcraft (+8.0 pp). Both winners are survival trees, and their won end-boss fights are the longest (Shadowcraft 43 rounds, Wildcraft 45; the other trees 34-42) [source: report, Findings 1]. On the old trees the class split passed (rogue 37.6, mage 31.8, hunter 36.6 %: spread 5.8 pp).

**Keep the switch rule, change the trees.** Arguments against keeping the trees as they are and tuning around them:
1. The switch is not a sim artefact: it shows a real gap a player will find. A Rogue on Shadowcraft and a Hunter on Wildcraft are 6-8 pp better than on their next tree, so the free choice of tree is not free (B7 hunter 0.60 fails because of it).
2. The boss factor cannot close the gap: it hits the Mage hardest (1.30 alone: mage 21.8 %, spread 14.9 pp), and the PALL Rogue on Shadowcraft barely moves with it (PALL rogue 79.1 % without the end-boss free potion, 77.4 % in the 1.27 package, while the PALL hunter fell 62.7 -> 52.4 %) [source: sim worktree sim/out/v6b/q5.log, arms pallfpb0 and pkgpall, 1 000 per class].
3. The Mage has no survival tree to switch to (31.9 / 30.7 / 31.8 %), so a boss that rewards survival talents will always leave the Mage behind.

What changes (rows 7, 8). Each trim cuts what a survival tree gives in a long fight: healing per fight and stacked mitigation. Tier 1 of Shadowcraft is untouched (Slippery dodge helps the Rogue in zone 1, where 27 % of Rogue runs die [source: report, Planner P0 by class]); the trims sit at tiers 2-5. The Wildcraft trims include tier 1 (Hardy), because the Hunter has the fewest early deaths (13.1 % of runs in Z1-Z2).

| Talent | Now | v8 | Second step (if the tree's P0 cell moves less than -4 pp) |
|---|---|---|---|
| r_b9 Death's Sidestep | negate the hit, dispersal, STEALTH, heal 20 % max HP | heal 10 % (the rest unchanged) | heal 0 % |
| r_b7 Shroudwalk | Vanishing Step -3 CD /rank, heals 10 % max HP /rank | heals 5 % /rank | Vanishing Step -2 CD /rank |
| r_b4 Veiled Recovery | 3 % max HP per round /rank while EVASION | 2 % /rank | unchanged |
| h_c1 Hardy | max HP +4 % /rank | +3 % /rank | +2 % /rank |
| h_c4 Field Medic | Field Dressing +20 % /rank | +10 % /rank | unchanged |
| h_c5 Survivalist | +0.03 dodge /rank | +0.02 /rank | +0.015 /rank |

Aim per tree (P0 planner, package rules): Shadowcraft -5 to -7 pp (to about Venomcraft's level), Wildcraft -6 to -8 pp (to about Marksmanship's). With row 6 the Hunter's trees would sit at about 32.6 (Beastbond) / 36.6 / 37-39 % before the package's other rows: B7 about 0.84 [inference: measured effects added]. If a trim makes another tree the best by more than the switch threshold, the switch rule picks it as usual; the target is the class's default-tree win rate, not a particular tree.

### Row 9: the free potion inside the owner's rule
The owner agreed "the first potion each fight is free, once per fight" [source: docs/BACKLOG.md, owner 08:04; D66]. Row 9 keeps that rule word for word in every fight, the end-boss fight included, and halves what the free potion restores. Its value was almost all in the end-boss fight (Mage and Hunter: P10 without it in that fight mage 53.8 -> 42.4 %, hunter 52.1 -> 45.4 %, rogue 60.8 -> 59.6 % [source: report, Findings 3]); outside it the cost of halving is at most about 0.3 pp [inference: half of +0.6 pp]. Removing the free potion in the end-boss fight is **not** in this package; it is owner decision O1.

## Exact behaviour

**Row 1, early enemy damage.** In the zone-danger factor (rules 7.6; engine combat.js `zoneDanger`): `zd(M) = early(M) × (1 + ZONE_DANGER_STEP × max(0, M - ZONE_DANGER_FROM) / 10)`, dungeon trash and dungeon bosses `early(M) × (1 + DUNGEON_DANGER_FRAC × (zd0(M) - 1))`, where `early(M) = EARLY_DMG_MULT` if `M <= EARLY_DMG_MAX_LEVEL`, else 1. M is the enemy's level. It applies to every enemy made from a template (normal, quest, grind, elite, rare, dungeon trash and boss, Camp waves, summoned adds), exactly as zone danger does; the end boss and the Dimming Shards are not affected. HP, armor and XP are unchanged. Intent estimates read the snapshot, so they show the new numbers. This is the form the sim measured (scratch `zoneDanger` with X_EARLY 0.8, X_EARLY_LVL 20).
- Known step: a level-20 enemy's 100 % damage is (4 + 2.6 × 20) × 0.80 = 44.8, a level-21 enemy's (4 + 2.6 × 21) × 1.0375 = 60.8 (+36 %; today +7 %). It lands where zones 2 and 3 meet [assumption: zone z enemies are levels 10(z-1)+1 to 10z; to verify in content]. The measured Z3-Z4 deaths (9.0 %) stay in their band. A ramp (for example × 0.80 at level 1 rising to × 1 at level 20) is the alternative if playtests feel the step; it is unmeasured and not in the package.

**Row 2, ZONE_DANGER_STEP 0.375.** Constant only. Zone danger: level 30 × 1.375, 40 × 1.75, 50 × 2.125, 60 × 2.5 (today 1.25 / 1.5 / 1.75 / 2.0); dungeons at level 60 × 1.75 (today × 1.5). Update the example levels in rules 7.6.

**Row 3, Mage HP.** CLASS.mage: hpBase 62, hpPerLevel 21.06 (level 1: 62 HP instead of 50; level 20: 462 instead of 421; level 60: 1 305 instead of 1 201, before STA and items).

**Rows 4, 5, end boss.** BOSS_HP 12282; BOSS_DMG_MULT 1.30 (or the ladder's value). No other boss rule changes. Oruvath's Umbral Strike at asc 0: 260 × 1.30 = 338 (today 304).

**Row 6, Beastbond.** TALENT.h_a2 petDmgPct 0.15625 (tooltip "+15.6 % per rank"); TALENT.h_a1 petHpPct 0.10. Pack Leader and Savage Mastery unchanged.

**Rows 7, 8, tree trims.** Data-table values only: r_b9 heal 0.10; r_b7 heal 0.05 per rank (CD reduction unchanged); r_b4 0.02 per rank; h_c1 0.03 per rank; h_c4 0.10 per rank; h_c5 0.02 per rank. Tooltips follow the values (the talent tooltip already shows "Now" and "Next" totals).

**Row 9, free potion at half strength.** Rules 7.5 "Free potion", new line: the free potion restores FREE_POTION_MULT × its normal amount (Healing Draught 0.35 -> 0.175 of max HP; Mana Draught 0.35 -> 0.175 of max mana; Greater Healing Draught 0.375 -> 0.1875 of max HP). Everything else is as in M2b v6: it is the first potion each fight, once per fight, in every fight; it costs no turn; POTION_CD starts; later potions in the fight cost the turn and restore their full amount. The player does not choose between a free half potion and a full paid one: the first potion of a fight is the free one [assumption: one rule is easier to read than a choice; UI can offer the choice later if the owner wants it].
- Event: the item-use event carries `free: true` and `mult: 0.5`. UI: log and item bar "Free action, half strength (Packed Satchel)"; the "free" mark on the item bar as today. Catalogue text (rules 11.2, satchel): "start with 3 Healing Draughts; the first potion each fight costs no turn and works at half strength".
- Autoplay and the bots keep their potion policy; the heal they expect from the first potion of a fight is the halved amount [assumption: check sim/bots potion valuation reads the engine's amount].

## Run length (B11, B12, B53): not tuning
B11 (55.1 min, band 40-50), B12 (30.6 min against 30) and B53 (26.7 min against 21) come from the number of fights and nodes on the rows map (B15 50 fights per run against FIGHTS_V2 34-42), not from fight balance. They belong to the expedition map default: the fog-only bots and their measure (MILESTONES 2b.4) and prep points, contracts and regions (2b.5), when the expedition map becomes the default. Measured and not taken: enemy HP × 0.80 shortens fights (B11 52.5 min, B53 24.3 min, both still over) and adds 10.4 pp of wins and 17.2 pp of reach, so it would need the damage back and still not reach the targets; neither the end-boss free potion nor boss HP × 0.88 moves B12 (30.8 / 30.6 min) [source: report, proposals table]. No change in this package.

## Owner decisions
| # | Question | Default (what the team does without an answer) | Why it is his |
|---|---|---|---|
| O1 | **No free potion at the end boss**: Packed Satchel's free potion does not work in the fight against Oruvath (it stays in every other fight). Measured: P10 56.0 -> 49.1 %, PALL 77.0 -> 68.5 % (B3 pass); P10 and PALL class spread widens to 17 pp because the Rogue does not lose [source: report]. | Not done. Row 9 (half strength, every fight) instead; if B2 P10 still fails after the v8 measure, the Lead asks again with the new numbers. | It changes a feature the owner agreed ("once per fight"). |
| O2 | Row 9 itself: the free potion works at half strength. | Done (in the package). | Inside his rule, but it changes how his feature feels; he can veto it. |
| O3 | Pet revive: 2-round channel plus taunt (appendix A). | Not done; appendix stays draft until he agrees. | Owner 12:02, under discussion. |

## Appendix A: Hunter pet revive (draft, pending owner agreement; not in the package)
Owner [stated: docs/feedback/2026-11-11-1202-owner.md]: "revive pet as a hunter should cost at least 2 turns. it should be expensive. but then might be worth it if the pet can taunt." Lead's proposal, same file. Not built and not measured until the owner agrees.

| Item | Today | Draft |
|---|---|---|
| Mend Companion (rules 5.x, lvl 6, 25 Focus, CD 3) | heals the pet, or revives a dead pet at 30 % in one action | heals a living pet only; not legal while the pet is dead |
| New Hunter spell "Call Back the Companion" (name draft; originality check pending) | none | level 6 (with Mend Companion), PET_RECALL_FOCUS 40 Focus, a channel of PET_RECALL_CHANNEL 2 rounds (the Hunter's action in both rounds; intent-style display "1/2", "2/2 - returns"). Legal only while the pet is dead and an enemy lives. On completion (the Hunter's action in round 2) the pet returns at PET_RECALL_HP_PCT 0.30 of its max HP and gains TAUNT on every enemy for PET_RECALL_TAUNT 2 rounds; the pet acts from the next round. During the channel, a single hit on the Hunter of more than PET_RECALL_BREAK_PCT 0.20 of the Hunter's max HP breaks it: Focus spent, cooldown starts, the pet stays dead. Cooldown PET_RECALL_CD 8 rounds from the end or break of the channel |
| Beastcall Horn (item, CD 12) | pet to full or revived, TAUNT 2 rounds, instant | unchanged: the expensive instant option |
| After a fight | a dead pet returns at PET_REVIVE_PCT 0.25 | unchanged (Unbreakable Bond unchanged) |

Notes: in the end-boss fight a pet's TAUNT turns Oruvath to the pet (rules 10.1), so the 2 taunt rounds buy 2 rounds of boss hits at 338 or more; Umbral Strike alone is about a quarter of a level-60 Hunter's HP [inference: 338 against about 1 300-1 500 HP], so the break threshold makes the channel risky against the boss unless the Hunter times it after a defensive. Autoplay rule (draft): channel when the pet is dead, at least 2 enemies live or it is the end-boss fight, the Hunter's HP is at least 50 %, and no wind-up or heavy hit is due in the next 2 rounds.

Sim check before it ships (draft targets): Hunter P0 and PALL inside B6; Call Back used in PET_RECALL_USE_MIN 20 % to PET_RECALL_USE_MAX 70 % of fights in which the pet dies while an enemy lives [assumption: the Lead's "not always and not never" as a band]; B7 hunter still >= 0.6; B9 pets (P2) re-run.

Draft constants (not in the package table): PET_RECALL_FOCUS 40, PET_RECALL_CHANNEL 2, PET_RECALL_HP_PCT 0.30, PET_RECALL_TAUNT 2, PET_RECALL_BREAK_PCT 0.20, PET_RECALL_CD 8, PET_RECALL_USE_MIN 0.20, PET_RECALL_USE_MAX 0.70.

## What the sim must run
Engine: main after the v7 rename, with the package on a scratch copy (switches as in sim/out/v6b plus new ones for rows 7, 8, 9), then on the Engineer's build. Seeds 1000 onward, paired by class and seed, warm-up risk tables of the 11-11b pass (re-warm only if the v7 reproduction check fails). Budget about 60 min wall on 2 cores, from the 11-11b cost table (planner P0 about 200 s per 6 000 runs, PALL about 300-430 s per 6 000, tactician about 230 s per 100 runs per class); run in this order and cut from the bottom.

| # | Cell | Runs | Checks | About |
|---|---|---|---|---|
| 1 | v7 reproduction: planner P0, 300 per class, pass rules | 900 | run for run identical to the 11-11b pass cells | 1 min |
| 2 | Tree-trim arms on pass rules: Shadowcraft (row 7) rogue tree 1; Wildcraft (row 8) hunter tree 2; planner P0 | 2 000 + 2 000 | each tree's change against the pass; apply the second step of a tree that moves less than -4 pp | 3 min (+3 if a second step) |
| 3 | Free potion half (row 9) on pass rules: planner P10 and PALL | 1 000 per class each | effect against the full free potion and against X_FPBOSS=0 | 5 min |
| 4 | Package v8 at BOSS_DMG_MULT 1.30: planner P0, every tree of every class (B7 and the switch rule) | 1 000 per tree per class (9 000) | B1 planner, B6 P0, B7, B16, B21, B23, B29, B30, B38; default trees | 6 min |
| 5 | Ladder: package at 1.32, then 1.34, planner P0 default trees, only if cell 4 has planner > 35 % | 1 000 per class each | as cell 4 | 2-4 min |
| 6 | Package at the chosen factor: planner P10 (default trees); planner PALL, all three hunter trees and the default rogue and mage trees | 1 000 per class; PALL hunter 3 000 | B2, B3, B6 PALL, B10, PALL switch rule | 8 min |
| 7 | Package: greedy P0 and greedy PALL, speedrunner P0 and PALL | 1 000 per class each | B1, B3 greedy and speedrunner | 6 min |
| 8 | Package: heat-seek and heat-avoid, planner P0 | 1 000 per class each | B58, B56 (the boss factor changes the price of Ascendancy) | 4 min |
| 9 | Package: campaigns | 30 per class | B30, B31, B32 | about 8 min [assumption: campaign cost not in the cost table] |
| 10 | Package: tactician P0 | 50 per class | B1 tactician, B5 (wide interval; report it as such) | 6 min |

Not run in v8: masher and opener (combat v2 checks passed and no row changes the engage round; B48 (a) passed on 200 per class), B26-B28 variants, stage E. Report: the 11-11b table with a v8 column, and per row of the change table its measured effect, so the Lead can fold the rows into rules.md and balance.md.

## Constants
New or changed by this package (rules.md 13 unless stated).

| Constant | Old | New | Unit |
|---|---|---|---|
| EARLY_DMG_MULT (new) | - | 0.80 | × enemy damage at level <= EARLY_DMG_MAX_LEVEL |
| EARLY_DMG_MAX_LEVEL (new) | - | 20 | enemy level |
| ZONE_DANGER_STEP | 0.25 | 0.375 | × per 10 levels above ZONE_DANGER_FROM |
| CLASS.mage.hpBase (rules 5.1) | 50 | 62 | HP |
| CLASS.mage.hpPerLevel (rules 5.1) | 19.5 | 21.06 | HP per level |
| BOSS_HP | 13066 | 12282 | HP |
| BOSS_DMG_MULT | 1.17 | 1.30 (ladder 1.32, 1.34) | × |
| TALENT.h_a2.petDmgPct (Ferocity) | 0.125 | 0.15625 | per rank |
| TALENT.h_a1.petHpPct (Thick Hide) | 0.08 | 0.10 | per rank |
| TALENT.r_b9 heal (Death's Sidestep) | 0.20 | 0.10 (second step 0) | of max HP |
| TALENT.r_b7 heal (Shroudwalk) | 0.10 | 0.05 | of max HP per rank |
| TALENT.r_b4 heal (Veiled Recovery) | 0.03 | 0.02 | of max HP per round per rank |
| TALENT.h_c1 hpPct (Hardy) | 0.04 | 0.03 (second step 0.02) | per rank |
| TALENT.h_c4 (Field Medic) | 0.20 | 0.10 | Field Dressing bonus per rank |
| TALENT.h_c5 dodge (Survivalist) | 0.03 | 0.02 (second step 0.015) | per rank |
| FREE_POTION_MULT (new) | 1 | 0.5 | × the free potion's normal amount |

Draft only (appendix A, not in the package): PET_RECALL_FOCUS 40, PET_RECALL_CHANNEL 2, PET_RECALL_HP_PCT 0.30, PET_RECALL_TAUNT 2, PET_RECALL_BREAK_PCT 0.20, PET_RECALL_CD 8, PET_RECALL_USE_MIN 0.20, PET_RECALL_USE_MAX 0.70.
